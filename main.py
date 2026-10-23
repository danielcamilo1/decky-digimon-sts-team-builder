import asyncio
import json
import os
from typing import Any

import decky

from bottom_screen.controller import Controller

SETTINGS_FILE = "team.json"
# Plugin preferences, kept apart from the team so a bad team file can't take them with it.
PREFERENCES_FILE = "settings.json"
# Matches REMOTE_EVENT in src/state/teamStore.ts.
REMOTE_EVENT = "team_state_changed"

DEFAULT_STATE: dict[str, Any] = {
    "chains": [],
    "selected": 0,
}


def _write_json(path: str, value: Any) -> bool:
    """Writes to a temp file first so a crash mid-write can't leave a truncated file behind."""
    tmp = f"{path}.tmp"
    try:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(value, f)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp, path)
        return True
    except OSError as e:
        decky.logger.error(f"Could not write {path}: {e}")
        return False


class Plugin:
    _bottom: Controller | None = None
    _bottom_task: asyncio.Task | None = None

    def _path(self) -> str:
        return os.path.join(decky.DECKY_PLUGIN_SETTINGS_DIR, SETTINGS_FILE)

    def _preferences_path(self) -> str:
        return os.path.join(decky.DECKY_PLUGIN_SETTINGS_DIR, PREFERENCES_FILE)

    def _read_state(self) -> dict[str, Any]:
        path = self._path()
        if not os.path.exists(path):
            return dict(DEFAULT_STATE)

        try:
            with open(path, "r", encoding="utf-8") as f:
                state = json.load(f)
        except (OSError, json.JSONDecodeError) as e:
            decky.logger.error(f"Could not read {path}, falling back to an empty team: {e}")
            return dict(DEFAULT_STATE)

        if not isinstance(state, dict):
            decky.logger.error(f"{path} did not contain an object, falling back to an empty team")
            return dict(DEFAULT_STATE)

        # The frontend validates chain shape; this only guarantees the top-level keys exist.
        return {**DEFAULT_STATE, **state}

    async def load_state(self) -> dict[str, Any]:
        """Returns the persisted team, or the empty default if nothing is stored yet."""
        return self._read_state()

    async def save_state(self, state: dict[str, Any]) -> bool:
        """Persists the team, and tells the bottom screen to pick it up."""
        if not _write_json(self._path(), state):
            return False
        if self._bottom is not None:
            await self._bottom.server.team_saved()
        return True

    # --- bottom screen ----------------------------------------------------------

    def _preferences(self) -> dict[str, Any]:
        try:
            with open(self._preferences_path(), "r", encoding="utf-8") as f:
                prefs = json.load(f)
        except (OSError, json.JSONDecodeError):
            return {}
        return prefs if isinstance(prefs, dict) else {}

    async def _save_from_bottom(self, state: dict[str, Any]) -> bool:
        """A save from the bottom screen: on disk, then out to the Steam UI."""
        if not await self.save_state(state):
            return False
        await decky.emit(REMOTE_EVENT, state)
        return True

    async def get_bottom_screen(self) -> dict[str, Any]:
        return await self._bottom.refresh() if self._bottom else {"supported": False}

    async def set_bottom_screen(self, enabled: bool) -> dict[str, Any]:
        """Turns the bottom-screen builder on or off, and remembers the choice."""
        _write_json(self._preferences_path(), {**self._preferences(), "bottom_screen": bool(enabled)})
        if self._bottom is None:
            return {"supported": False}
        return await self._bottom.set_enabled(bool(enabled))

    # --- lifecycle --------------------------------------------------------------

    async def _main(self):
        self._bottom = Controller(
            os.path.join(decky.DECKY_PLUGIN_DIR, "dist", "assets"),
            load=self._read_state,
            save=self._save_from_bottom,
            log=decky.logger,
            enabled=bool(self._preferences().get("bottom_screen")),
        )
        self._bottom_task = asyncio.create_task(self._bottom.supervise())
        decky.logger.info("Digimon Time Stranger Team Builder loaded")

    async def _unload(self):
        if self._bottom_task is not None:
            self._bottom_task.cancel()
        if self._bottom is not None:
            try:
                await asyncio.wait_for(self._bottom.shutdown(), 3.0)
            except Exception as e:  # noqa: BLE001
                decky.logger.warning(f"Bottom screen shutdown incomplete: {e}")
        decky.logger.info("Digimon Time Stranger Team Builder unloaded")

    async def _uninstall(self):
        for path in (self._path(), self._preferences_path()):
            try:
                if os.path.exists(path):
                    os.remove(path)
            except OSError as e:
                decky.logger.error(f"Could not remove {path}: {e}")
