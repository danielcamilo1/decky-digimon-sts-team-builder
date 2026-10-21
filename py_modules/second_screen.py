"""Serves the touch builder to a browser on a second screen (the AYN Thor's, under DroidDeck).

DroidDeck runs the Linux session inside an Android app, sharing Android's network, so a
page on 127.0.0.1 is reachable from any Android browser — which the Thor can put on its
bottom screen. Nothing here depends on DroidDeck itself; it only decides when to offer it.

Stdlib only, like main.py: an HTTP/1.1 server small enough to read in one sitting.
"""

import asyncio
import glob
import json
import mimetypes
import os
import time
from typing import Any, Awaitable, Callable
from urllib.parse import parse_qs, urlsplit

PORT = 47821
HOST = "127.0.0.1"
# The page asks again after this long, which keeps idle connections from piling up.
LONG_POLL_S = 25.0
READ_TIMEOUT_S = 10.0
MAX_BODY_BYTES = 256 * 1024
# A custom header on writes means a cross-site form or fetch can't make one: setting it
# forces a CORS preflight this server never approves.
WRITE_HEADER = "x-team-builder"
DROIDDECK_MARKERS = "/usr/local/bin/droiddeck-*"

# Files the page itself is made of, under dist/second-screen.
APP_FILES = {
    "/": "index.html",
    "/index.html": "index.html",
    "/app.js": "app.js",
    "/manifest.webmanifest": "manifest.webmanifest",
    "/sw.js": "sw.js",
    "/icon-192.png": "icon-192.png",
    "/icon-512.png": "icon-512.png",
}

LoadState = Callable[[], dict]
SaveState = Callable[[dict], Awaitable[bool]]


def on_droiddeck() -> bool:
    """DroidDeck ships its helpers into the Linux rootfs as /usr/local/bin/droiddeck-*."""
    return bool(glob.glob(DROIDDECK_MARKERS))


def valid_chains(value: Any) -> bool:
    """The shape check the page's writes have to pass; the frontends normalise the rest."""
    if not isinstance(value, list) or len(value) > 64:
        return False
    for chain in value:
        if not isinstance(chain, dict):
            return False
        ids = chain.get("ids")
        if not isinstance(ids, list) or not ids or len(ids) > 64:
            return False
        if not all(isinstance(i, int) and not isinstance(i, bool) for i in ids):
            return False
    return True


class Response:
    def __init__(self, status: int, body: bytes, content_type: str = "application/json", cache: str = "no-store"):
        self.status = status
        self.body = body
        self.content_type = content_type
        self.cache = cache


def _json(status: int, payload: Any) -> Response:
    return Response(status, json.dumps(payload).encode())


REASONS = {200: "OK", 400: "Bad Request", 403: "Forbidden", 404: "Not Found", 405: "Method Not Allowed",
           413: "Payload Too Large", 500: "Internal Server Error"}


class SecondScreenServer:
    """The team plus a version number, served over loopback.

    Each change bumps the version; the page long-polls with the version it has and is
    answered as soon as there's a newer one. Writes from the Steam side reach it through
    `team_saved`, and writes from the page go through `save` and on to Steam via `on_remote_save`.
    """

    def __init__(self, dist_dir: str, load: LoadState, save: SaveState,
                 on_remote_save: Callable[[dict], Awaitable[None]], log: Any, port: int = PORT):
        self.dist_dir = dist_dir
        self._load = load
        self._save = save
        self._on_remote_save = on_remote_save
        self._log = log
        self.port = port
        self._server: asyncio.AbstractServer | None = None
        # Starts from the clock so a restarted plugin never hands out a version the page
        # already holds for different data.
        self._version = time.time_ns() // 1_000_000
        self._changed = asyncio.Condition()
        self.error: str | None = None

    @property
    def running(self) -> bool:
        return self._server is not None

    @property
    def url(self) -> str:
        return f"http://{HOST}:{self.port}/"

    async def start(self) -> bool:
        if self._server is not None:
            return True
        try:
            self._server = await asyncio.start_server(self._serve, HOST, self.port)
        except OSError as e:
            self.error = "port_in_use" if e.errno in (98, 48) else f"{type(e).__name__}: {e}"
            self._log.error(f"Second screen: could not listen on {HOST}:{self.port}: {e}")
            return False
        self.error = None
        self._log.info(f"Second screen: serving {self.url}")
        return True

    async def stop(self) -> None:
        if self._server is None:
            return
        server, self._server = self._server, None
        server.close()
        # Wake parked long polls so their connections close with the server.
        await self.team_saved()
        try:
            await asyncio.wait_for(server.wait_closed(), 2.0)
        except asyncio.TimeoutError:
            pass
        self._log.info("Second screen: stopped")

    async def team_saved(self) -> None:
        """Called after any write to the team, from either surface."""
        async with self._changed:
            self._version += 1
            self._changed.notify_all()

    # --- HTTP -----------------------------------------------------------------

    async def _serve(self, reader: asyncio.StreamReader, writer: asyncio.StreamWriter) -> None:
        try:
            try:
                response = await asyncio.wait_for(self._request(reader), READ_TIMEOUT_S + LONG_POLL_S)
            except (asyncio.TimeoutError, asyncio.IncompleteReadError, ValueError, UnicodeDecodeError):
                response = _json(400, {"error": "bad_request"})
            except Exception as e:  # noqa: BLE001
                self._log.error(f"Second screen: request failed: {type(e).__name__}: {e}")
                response = _json(500, {"error": "internal"})
            head = (
                f"HTTP/1.1 {response.status} {REASONS.get(response.status, 'OK')}\r\n"
                f"Content-Type: {response.content_type}\r\n"
                f"Content-Length: {len(response.body)}\r\n"
                f"Cache-Control: {response.cache}\r\n"
                "X-Content-Type-Options: nosniff\r\n"
                "Connection: close\r\n\r\n"
            )
            writer.write(head.encode("latin-1") + response.body)
            await writer.drain()
        except ConnectionError:
            pass
        finally:
            writer.close()

    async def _request(self, reader: asyncio.StreamReader) -> Response:
        line = (await asyncio.wait_for(reader.readline(), READ_TIMEOUT_S)).decode("latin-1").strip()
        method, _, rest = line.partition(" ")
        target = rest.partition(" ")[0]
        headers: dict[str, str] = {}
        while True:
            raw = (await asyncio.wait_for(reader.readline(), READ_TIMEOUT_S)).decode("latin-1")
            if raw in ("\r\n", "\n", ""):
                break
            name, _, value = raw.partition(":")
            headers[name.strip().lower()] = value.strip()

        # Only ever answer to our own address: a page on another site that gets a hostname
        # resolved to 127.0.0.1 (DNS rebinding) still sends that hostname here.
        if headers.get("host", "") not in (f"{HOST}:{self.port}", f"localhost:{self.port}"):
            return _json(403, {"error": "forbidden_host"})

        url = urlsplit(target)
        path = url.path
        if path == "/api/state":
            if method == "GET":
                since = parse_qs(url.query).get("since", [""])[0]
                return await self._get_state(int(since) if since.isdigit() else None)
            if method == "PUT":
                length = int(headers.get("content-length", "0") or 0)
                if length > MAX_BODY_BYTES:
                    return _json(413, {"error": "too_large"})
                if headers.get(WRITE_HEADER) != "1" or not headers.get("content-type", "").startswith("application/json"):
                    return _json(403, {"error": "forbidden"})
                body = await asyncio.wait_for(reader.readexactly(length), READ_TIMEOUT_S) if length else b""
                return await self._put_state(body)
            return _json(405, {"error": "method_not_allowed"})
        if method != "GET":
            return _json(405, {"error": "method_not_allowed"})
        if path in APP_FILES:
            return self._file(os.path.join(self.dist_dir, "second-screen", APP_FILES[path]), "no-cache")
        if path.startswith("/assets/"):
            return self._asset(path[len("/assets/"):])
        return _json(404, {"error": "not_found"})

    async def _get_state(self, since: int | None) -> Response:
        if since == self._version:
            async with self._changed:
                try:
                    await asyncio.wait_for(self._changed.wait_for(lambda: self._version != since), LONG_POLL_S)
                except asyncio.TimeoutError:
                    pass
        return _json(200, {"version": self._version, "state": self._load()})

    async def _put_state(self, body: bytes) -> Response:
        try:
            request = json.loads(body or b"{}")
        except ValueError:
            return _json(400, {"error": "bad_json"})
        chains = request.get("chains") if isinstance(request, dict) else None
        if not valid_chains(chains):
            return _json(400, {"error": "bad_team"})
        # Selection belongs to each surface; keep whatever the Steam side last saved.
        state = {**self._load(), "chains": chains}
        if not await self._save(state):
            return _json(500, {"error": "save_failed"})
        await self.team_saved()
        await self._on_remote_save(state)
        return _json(200, {"version": self._version})

    def _asset(self, relative: str) -> Response:
        root = os.path.realpath(os.path.join(self.dist_dir, "assets"))
        path = os.path.realpath(os.path.join(root, relative))
        if not path.startswith(root + os.sep):
            return _json(404, {"error": "not_found"})
        # Sprites and the dataset only change with a plugin update, which restarts this.
        return self._file(path, "max-age=86400")

    @staticmethod
    def _file(path: str, cache: str) -> Response:
        try:
            with open(path, "rb") as handle:
                body = handle.read()
        except OSError:
            return _json(404, {"error": "not_found"})
        kind = {
            ".webmanifest": "application/manifest+json",
            ".js": "text/javascript; charset=utf-8",
            ".html": "text/html; charset=utf-8",
            ".json": "application/json",
            ".webp": "image/webp",
        }.get(os.path.splitext(path)[1]) or mimetypes.guess_type(path)[0] or "application/octet-stream"
        return Response(200, body, kind, cache)
