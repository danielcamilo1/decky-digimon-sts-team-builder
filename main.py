import json
import os
from typing import Any

import decky

SETTINGS_FILE = "team.json"

DEFAULT_STATE: dict[str, Any] = {
    "chains": [],
    "selected": 0,
}


class Plugin:
    def _path(self) -> str:
        return os.path.join(decky.DECKY_PLUGIN_SETTINGS_DIR, SETTINGS_FILE)

    async def load_state(self) -> dict[str, Any]:
        """Returns the persisted team, or the empty default if nothing is stored yet."""
        path = self._path()
        if not os.path.exists(path):
            return DEFAULT_STATE

        try:
            with open(path, "r", encoding="utf-8") as f:
                state = json.load(f)
        except (OSError, json.JSONDecodeError) as e:
            decky.logger.error(f"Could not read {path}, falling back to an empty team: {e}")
            return DEFAULT_STATE

        if not isinstance(state, dict):
            decky.logger.error(f"{path} did not contain an object, falling back to an empty team")
            return DEFAULT_STATE

        # The frontend validates chain shape; this only guarantees the top-level keys exist.
        return {**DEFAULT_STATE, **state}

    async def save_state(self, state: dict[str, Any]) -> bool:
        """Persists the team. Writes to a temp file first so a crash mid-write can't
        leave a truncated file behind."""
        path = self._path()
        tmp = f"{path}.tmp"
        try:
            os.makedirs(decky.DECKY_PLUGIN_SETTINGS_DIR, exist_ok=True)
            with open(tmp, "w", encoding="utf-8") as f:
                json.dump(state, f)
                f.flush()
                os.fsync(f.fileno())
            os.replace(tmp, path)
            return True
        except OSError as e:
            decky.logger.error(f"Could not save team to {path}: {e}")
            return False

    async def _main(self):
        decky.logger.info("Digimon Time Stranger Team Builder loaded")

    async def _unload(self):
        decky.logger.info("Digimon Time Stranger Team Builder unloaded")

    async def _uninstall(self):
        path = self._path()
        try:
            if os.path.exists(path):
                os.remove(path)
        except OSError as e:
            decky.logger.error(f"Could not remove {path}: {e}")
