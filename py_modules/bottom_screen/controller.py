"""Keeps the renderer running on the bottom screen while it's switched on and the panel is usable."""

import asyncio
import time
from typing import Any, Awaitable, Callable

from bottom_screen import armada
from bottom_screen.launcher import Launcher
from bottom_screen.server import Server

SUPERVISE_S = 10.0
RETRY_MIN_S = 5.0
RETRY_MAX_S = 60.0


class Controller:
    def __init__(
        self,
        assets_dir: str,
        load: Callable[[], dict],
        save: Callable[[dict], Awaitable[bool]],
        log: Any,
        enabled: bool = False,
        detect: Callable[[], armada.Detection] = armada.detect,
        launcher_factory: Callable[[armada.Panel, str], Launcher] = Launcher,
        clock: Callable[[], float] = time.monotonic,
    ):
        self.enabled = enabled
        self._assets_dir = assets_dir
        self._log = log
        self._detect = detect
        self._launcher_factory = launcher_factory
        self._clock = clock
        self.server = Server(load, save, self._renderer_status, log)
        self._detection = armada.Detection(None, "not_checked")
        self._launcher: Launcher | None = None
        self._running = False
        self._yielded = False
        self._retry_at = 0.0
        self._retry_delay = RETRY_MIN_S
        self._error: str | None = None
        self._lock = asyncio.Lock()

    def state(self) -> dict:
        reason = self._detection.reason
        return {
            "supported": reason not in armada.UNSUPPORTED and reason != "not_checked",
            "enabled": self.enabled,
            "running": self._running,
            "reason": reason,
            "error": self._error,
        }

    def _renderer_status(self, status: dict) -> None:
        """The renderer reports why it can't draw (no cairo, lease taken) before it exits."""
        error = status.get("error")
        if isinstance(error, str):
            self._error = error[:120]
            self._log.warning(f"Bottom screen: renderer reported {self._error}")
        elif status.get("state") == "running":
            self._error = None

    async def refresh(self) -> dict:
        async with self._lock:
            self._detection = await asyncio.to_thread(self._detect)
        return self.state()

    async def set_enabled(self, enabled: bool) -> dict:
        self.enabled = bool(enabled)
        self._error = None
        self._retry_at = 0.0
        self._retry_delay = RETRY_MIN_S
        await self.tick()
        return self.state()

    async def tick(self) -> None:
        async with self._lock:
            detection = await asyncio.to_thread(self._detect)
            if detection.reason != self._detection.reason:
                self._log.info(f"Bottom screen: {detection.reason}")
                # Back in game mode (or newly usable): start now, not after an old backoff.
                if detection.reason == "ok":
                    self._retry_at = 0.0
                    self._retry_delay = RETRY_MIN_S
            self._detection = detection
            if not self.enabled or detection.panel is None:
                await self._stop()
                return
            if self._launcher is None or self._launcher.panel != detection.panel:
                await self._stop()
                self._launcher = self._launcher_factory(detection.panel, self._assets_dir)
                # A unit left by a plugin that died holds that plugin's address and token.
                if await asyncio.to_thread(self._launcher.is_active):
                    await asyncio.to_thread(self._launcher.stop)
            await self._ensure_running()

    async def _ensure_running(self) -> None:
        launcher = self._launcher
        assert launcher is not None
        await self.server.start()
        was_running = self._running
        self._running = await asyncio.to_thread(launcher.is_active)
        if was_running and not self._running:
            words = await asyncio.to_thread(launcher.last_words)
            self._log.warning(f"Bottom screen: renderer exited: {words or 'no output'}")
        if self._running:
            self._retry_delay = RETRY_MIN_S
            return
        now = self._clock()
        if now < self._retry_at:
            return
        if await asyncio.to_thread(launcher.yield_armada_bottom):
            self._yielded = True
            self._log.info("Bottom screen: stopped Armada's bottom-screen session")
        code, out = await asyncio.to_thread(launcher.start, self.server.url, self.server.token)
        self._retry_at = now + self._retry_delay
        self._retry_delay = min(self._retry_delay * 2, RETRY_MAX_S)
        self._running = code == 0
        if self._running:
            self._log.info("Bottom screen: renderer started")
        else:
            self._error = out or "start_failed"
            self._log.warning(f"Bottom screen: could not start the renderer: {self._error}")

    async def _stop(self) -> None:
        launcher, self._launcher = self._launcher, None
        if launcher is not None:
            await asyncio.to_thread(launcher.stop)
            if self._yielded:
                self._yielded = False
                restored = await asyncio.to_thread(launcher.restore_armada_bottom)
                self._log.info(f"Bottom screen: restored Armada's bottom-screen session (ok={restored})")
        self._running = False
        await self.server.stop()

    async def supervise(self) -> None:
        while True:
            try:
                if self.enabled or self._launcher is not None:
                    await self.tick()
                else:
                    await self.refresh()
            except Exception as e:  # noqa: BLE001
                self._log.error(f"Bottom screen: supervise failed: {type(e).__name__}: {e}")
            await asyncio.sleep(SUPERVISE_S)

    async def shutdown(self) -> None:
        async with self._lock:
            await self._stop()
