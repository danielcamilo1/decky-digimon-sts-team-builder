import json
import os
from typing import Any

import decky

import second_screen
from second_screen import SecondScreenServer

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


def _read_json(path: str) -> Any:
    if not os.path.exists(path):
        return None
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (OSError, json.JSONDecodeError) as e:
        decky.logger.error(f"Could not read {path}: {e}")
        return None


class Plugin:
    _second_screen: SecondScreenServer | None = None

    def _path(self) -> str:
        return os.path.join(decky.DECKY_PLUGIN_SETTINGS_DIR, SETTINGS_FILE)

    def _preferences_path(self) -> str:
        return os.path.join(decky.DECKY_PLUGIN_SETTINGS_DIR, PREFERENCES_FILE)

    def _read_state(self) -> dict[str, Any]:
        state = _read_json(self._path())
        if state is None:
            return dict(DEFAULT_STATE)
        if not isinstance(state, dict):
            decky.logger.error(f"{self._path()} did not contain an object, falling back to an empty team")
            return dict(DEFAULT_STATE)
        # The frontend validates chain shape; this only guarantees the top-level keys exist.
        return {**DEFAULT_STATE, **state}

    def _write_state(self, state: dict[str, Any]) -> bool:
        return _write_json(self._path(), state)

    async def load_state(self) -> dict[str, Any]:
        """Returns the persisted team, or the empty default if nothing is stored yet."""
        return self._read_state()

    async def save_state(self, state: dict[str, Any]) -> bool:
        """Persists the team, and tells an open second-screen page to pick it up."""
        if not self._write_state(state):
            return False
        if self._second_screen is not None:
            await self._second_screen.team_saved()
        return True

    # --- second screen ----------------------------------------------------------

    def _preferences(self) -> dict[str, Any]:
        prefs = _read_json(self._preferences_path())
        return prefs if isinstance(prefs, dict) else {}

    def _second_screen_state(self) -> dict[str, Any]:
        server = self._second_screen
        return {
            "supported": second_screen.on_droiddeck(),
            "enabled": bool(self._preferences().get("second_screen")),
            "running": bool(server and server.running),
            "url": f"http://{second_screen.HOST}:{second_screen.PORT}/",
            "error": server.error if server else None,
        }

    async def _save_from_page(self, state: dict[str, Any]) -> bool:
        return self._write_state(state)

    async def _page_saved(self, state: dict[str, Any]) -> None:
        await decky.emit(REMOTE_EVENT, state)

    async def _start_second_screen(self) -> None:
        if self._second_screen is None:
            self._second_screen = SecondScreenServer(
                os.path.join(decky.DECKY_PLUGIN_DIR, "dist"),
                load=self._read_state,
                save=self._save_from_page,
                on_remote_save=self._page_saved,
                log=decky.logger,
            )
        await self._second_screen.start()

    async def get_second_screen(self) -> dict[str, Any]:
        return self._second_screen_state()

    async def set_second_screen(self, enabled: bool) -> dict[str, Any]:
        """Turns the second-screen page on or off, and remembers the choice."""
        _write_json(self._preferences_path(), {**self._preferences(), "second_screen": bool(enabled)})
        if enabled:
            await self._start_second_screen()
        elif self._second_screen is not None:
            await self._second_screen.stop()
        return self._second_screen_state()

    # --- lifecycle --------------------------------------------------------------

    async def _main(self):
        decky.logger.info("Digimon Time Stranger Team Builder loaded")
        if self._preferences().get("second_screen") and second_screen.on_droiddeck():
            await self._start_second_screen()

    async def _unload(self):
        if self._second_screen is not None:
            await self._second_screen.stop()
        decky.logger.info("Digimon Time Stranger Team Builder unloaded")

    async def _uninstall(self):
        for path in (self._path(), self._preferences_path()):
            try:
                if os.path.exists(path):
                    os.remove(path)
            except OSError as e:
                decky.logger.error(f"Could not remove {path}: {e}")
