"""The renderer's connection to the plugin: the team, long-polled, and edits written back.

Mirrors the plugin side in bottom_screen/server.py. Both directions run on their own
threads and hand results to the main loop through `results`, ringing the wake pipe.
"""

from __future__ import annotations

import http.client
import json
import os
import threading
import time
import urllib.parse

TOKEN_HEADER = "x-dtb-token"
POLL_TIMEOUT_S = 40.0
RETRY_S = 2.0
WRITE_DEBOUNCE_S = 0.25


class Wake:
    """A pipe the main loop selects on, so other threads can interrupt its wait."""

    def __init__(self):
        self.read_fd, self.write_fd = os.pipe()
        os.set_blocking(self.read_fd, False)
        os.set_blocking(self.write_fd, False)

    def ring(self) -> None:
        try:
            os.write(self.write_fd, b"x")
        except BlockingIOError:
            pass

    def drain(self) -> None:
        try:
            while os.read(self.read_fd, 64):
                pass
        except BlockingIOError:
            pass


class Link:
    def __init__(self, url: str, token: str, wake: Wake):
        parsed = urllib.parse.urlsplit(url)
        self._host = parsed.hostname or "127.0.0.1"
        self._port = parsed.port or 80
        self._token = token
        self._wake = wake
        self._lock = threading.Condition()
        self._results: list = []
        self._version = None
        # Chains waiting to be written; None when there's nothing to write.
        self._pending = None
        self._pending_at = 0.0
        self._writing = False
        self.online = True

    # --- called from the main loop ---------------------------------------------------

    def start(self) -> None:
        threading.Thread(target=self._poll_loop, name="dtb-poll", daemon=True).start()
        threading.Thread(target=self._write_loop, name="dtb-write", daemon=True).start()

    def take(self) -> list:
        with self._lock:
            out, self._results = self._results, []
            return out

    def write(self, chains: list) -> None:
        with self._lock:
            self._pending = chains
            self._pending_at = time.monotonic()
            self._lock.notify_all()

    def report(self, **status) -> None:
        """Tells the plugin how the renderer is doing; best effort, on the caller's thread."""
        try:
            self._request("POST", "/api/status", json.dumps(status), 3.0)
        except (OSError, http.client.HTTPException, ValueError):
            pass

    # --- threads --------------------------------------------------------------------

    def _post(self, kind: str, value) -> None:
        with self._lock:
            self._results.append((kind, value))
        self._wake.ring()

    def _set_online(self, online: bool) -> None:
        if online != self.online:
            self.online = online
            self._post("online", online)

    def _request(self, method: str, path: str, body: str | None, timeout: float) -> dict:
        conn = http.client.HTTPConnection(self._host, self._port, timeout=timeout)
        try:
            headers = {TOKEN_HEADER: self._token, "Content-Type": "application/json"}
            conn.request(method, path, body, headers)
            response = conn.getresponse()
            payload = response.read()
            if response.status != 200:
                raise http.client.HTTPException(f"http_{response.status}")
            return json.loads(payload or b"{}")
        finally:
            conn.close()

    def _poll_loop(self) -> None:
        while True:
            since = "" if self._version is None else str(self._version)
            try:
                reply = self._request("GET", f"/api/state?since={since}", None, POLL_TIMEOUT_S)
            except (OSError, http.client.HTTPException, ValueError):
                self._set_online(False)
                time.sleep(RETRY_S)
                continue
            self._set_online(True)
            with self._lock:
                version = reply.get("version")
                if isinstance(version, int):
                    self._version = max(self._version or 0, version)
                # An edit not yet written is newer than whatever the plugin had.
                busy = self._pending is not None or self._writing
            if not busy:
                self._post("state", (reply.get("state") or {}).get("chains"))

    def _write_loop(self) -> None:
        while True:
            with self._lock:
                while self._pending is None or time.monotonic() - self._pending_at < WRITE_DEBOUNCE_S:
                    wait = None if self._pending is None else WRITE_DEBOUNCE_S - (time.monotonic() - self._pending_at)
                    self._lock.wait(wait)
                chains, self._pending = self._pending, None
                self._writing = True
            try:
                reply = self._request("PUT", "/api/state", json.dumps({"chains": chains}), 10.0)
                with self._lock:
                    version = reply.get("version")
                    if isinstance(version, int):
                        self._version = max(self._version or 0, version)
                self._set_online(True)
            except (OSError, http.client.HTTPException, ValueError):
                self._set_online(False)
                with self._lock:
                    # Kept for the next attempt rather than dropped: the edit is still on screen.
                    if self._pending is None:
                        self._pending = chains
                    self._pending_at = time.monotonic() + RETRY_S
            finally:
                with self._lock:
                    self._writing = False
