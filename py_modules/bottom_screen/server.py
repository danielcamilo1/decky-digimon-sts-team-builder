"""Loopback HTTP for the renderer: the team, long-polled, and the renderer's own status.

The team carries a version number that every save bumps. The renderer asks with the version
it has and is answered as soon as there's a newer one, so a change on either screen shows
up on the other at once without anything polling on a timer.
"""

import asyncio
import hmac
import json
import secrets
import time
from typing import Any, Awaitable, Callable
from urllib.parse import parse_qs, urlsplit

HOST = "127.0.0.1"
TOKEN_HEADER = "x-dtb-token"
LONG_POLL_S = 25.0
READ_TIMEOUT_S = 10.0
MAX_BODY_BYTES = 256 * 1024

REASONS = {200: "OK", 400: "Bad Request", 403: "Forbidden", 404: "Not Found", 405: "Method Not Allowed",
           413: "Payload Too Large", 500: "Internal Server Error"}


def valid_chains(value: Any) -> bool:
    """The shape a write has to have; the Steam UI normalises the rest when it loads it."""
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
        current = chain.get("current")
        if current is not None and (not isinstance(current, int) or isinstance(current, bool)):
            return False
    return True


class Server:
    def __init__(self, load: Callable[[], dict], save: Callable[[dict], Awaitable[bool]],
                 on_status: Callable[[dict], None], log: Any):
        self._load = load
        self._save = save
        self._on_status = on_status
        self._log = log
        self.token = secrets.token_urlsafe(24)
        self.port: int | None = None
        self._server: asyncio.AbstractServer | None = None
        # From the clock, so a restarted plugin never repeats a version the renderer holds.
        self._version = time.time_ns() // 1_000_000
        self._changed = asyncio.Condition()

    @property
    def url(self) -> str | None:
        return f"http://{HOST}:{self.port}" if self.port else None

    async def start(self) -> None:
        if self._server is not None:
            return
        self._server = await asyncio.start_server(self._serve, HOST, 0)
        self.port = self._server.sockets[0].getsockname()[1]

    async def stop(self) -> None:
        if self._server is None:
            return
        server, self._server = self._server, None
        self.port = None
        server.close()
        # Wakes parked long polls so their connections close with the server.
        await self.team_saved()
        try:
            await asyncio.wait_for(server.wait_closed(), 2.0)
        except asyncio.TimeoutError:
            pass

    async def team_saved(self) -> None:
        async with self._changed:
            self._version += 1
            self._changed.notify_all()

    async def _serve(self, reader: asyncio.StreamReader, writer: asyncio.StreamWriter) -> None:
        try:
            try:
                status, payload = await asyncio.wait_for(self._request(reader), READ_TIMEOUT_S + LONG_POLL_S)
            except (asyncio.TimeoutError, asyncio.IncompleteReadError, ValueError, UnicodeDecodeError):
                status, payload = 400, {"error": "bad_request"}
            except Exception as e:  # noqa: BLE001
                self._log.error(f"Bottom screen: request failed: {type(e).__name__}: {e}")
                status, payload = 500, {"error": "internal"}
            body = json.dumps(payload).encode()
            head = (
                f"HTTP/1.1 {status} {REASONS.get(status, 'OK')}\r\n"
                "Content-Type: application/json\r\n"
                f"Content-Length: {len(body)}\r\n"
                "Connection: close\r\n\r\n"
            )
            writer.write(head.encode("latin-1") + body)
            await writer.drain()
        except ConnectionError:
            pass
        finally:
            writer.close()

    async def _request(self, reader: asyncio.StreamReader) -> tuple:
        line = (await asyncio.wait_for(reader.readline(), READ_TIMEOUT_S)).decode("latin-1").strip()
        method, _, rest = line.partition(" ")
        target = rest.partition(" ")[0]
        headers = {}
        while True:
            raw = (await asyncio.wait_for(reader.readline(), READ_TIMEOUT_S)).decode("latin-1")
            if raw in ("\r\n", "\n", ""):
                break
            name, _, value = raw.partition(":")
            headers[name.strip().lower()] = value.strip()

        # The renderer is the only intended client; anything else on the machine is refused.
        if not hmac.compare_digest(headers.get(TOKEN_HEADER, "").encode(), self.token.encode()):
            return 403, {"error": "forbidden"}

        url = urlsplit(target)
        body = b""
        if method in ("PUT", "POST"):
            length = int(headers.get("content-length", "0") or 0)
            if length > MAX_BODY_BYTES:
                return 413, {"error": "too_large"}
            body = await asyncio.wait_for(reader.readexactly(length), READ_TIMEOUT_S) if length else b""

        if url.path == "/api/state" and method == "GET":
            since = parse_qs(url.query).get("since", [""])[0]
            return await self._get_state(int(since) if since.isdigit() else None)
        if url.path == "/api/state" and method == "PUT":
            return await self._put_state(body)
        if url.path == "/api/status" and method == "POST":
            try:
                status = json.loads(body or b"{}")
            except ValueError:
                return 400, {"error": "bad_json"}
            if isinstance(status, dict):
                self._on_status(status)
            return 200, {}
        return 404, {"error": "not_found"}

    async def _get_state(self, since: int | None) -> tuple:
        if since == self._version:
            async with self._changed:
                try:
                    await asyncio.wait_for(self._changed.wait_for(lambda: self._version != since), LONG_POLL_S)
                except asyncio.TimeoutError:
                    pass
        return 200, {"version": self._version, "state": self._load()}

    async def _put_state(self, body: bytes) -> tuple:
        try:
            request = json.loads(body or b"{}")
        except ValueError:
            return 400, {"error": "bad_json"}
        chains = request.get("chains") if isinstance(request, dict) else None
        if not valid_chains(chains):
            return 400, {"error": "bad_team"}
        # Which line is selected belongs to each screen; keep the Steam side's.
        if not await self._save({**self._load(), "chains": chains}):
            return 500, {"error": "save_failed"}
        return 200, {"version": self._version}
