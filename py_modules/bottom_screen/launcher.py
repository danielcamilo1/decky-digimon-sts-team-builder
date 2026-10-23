"""Starting and stopping the renderer as a transient user service in the game session."""

import os
from typing import Callable

from bottom_screen import system
from bottom_screen.armada import SYSTEM_PYTHON, Panel

UNIT = "dtb-bottom-screen"
# Armada's own gamescope for the bottom panel, which runs a Plasma desktop there. It holds
# the panel's lease, so it has to step aside while the builder is up, and comes back after.
ARMADA_BOTTOM_UNIT = "armada-bottom-gamescope.service"
# Handed to the renderer in its environment, not argv: any local user can read a command line.
URL_ENV = "DTB_BOTTOM_URL"
TOKEN_ENV = "DTB_BOTTOM_TOKEN"
# The game on the top screen comes first.
NICE = 10
CPU_WEIGHT = 20

NATIVE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "native", "app.py")

Runner = Callable[[list, dict], tuple]


class Launcher:
    def __init__(self, panel: Panel, assets_dir: str, runner: Runner | None = None):
        self.panel = panel
        self.assets_dir = assets_dir
        self._env = system.user_env(panel.uid)
        self._runner = runner or (lambda argv, env: system.run(argv, env))

    def _systemctl(self, *args: str) -> tuple:
        return self._runner(["systemctl", "--user", *args], self._env)

    def start(self, url: str, token: str) -> tuple:
        self._systemctl("reset-failed", UNIT)
        return self._runner([
            "systemd-run", "--user", f"--unit={UNIT}", "--collect", "--quiet",
            f"--nice={NICE}", f"--property=CPUWeight={CPU_WEIGHT}",
            f"--setenv={URL_ENV}={url}", f"--setenv={TOKEN_ENV}={token}",
            f"--setenv=DTB_BOTTOM_TOUCHSCREEN={self.panel.touchscreen}",
            f"--setenv=DTB_BOTTOM_ORIENTATION={self.panel.orientation}",
            SYSTEM_PYTHON, NATIVE, self.assets_dir,
        ], self._env)

    def is_active(self) -> bool:
        code, out = self._systemctl("is-active", UNIT)
        return code == 0 and out == "active"

    def last_words(self) -> str:
        """The unit's final lines of output, for a renderer that died without reporting why."""
        code, out = self._runner(
            ["journalctl", "--user", f"--unit={UNIT}.service", "--lines=3", "--output=cat", "--no-pager"], self._env,
        )
        return out[-300:] if code == 0 else ""

    def stop(self) -> tuple:
        # --no-block: Decky kills a plugin that takes too long to unload. The unit is
        # --collect, so nothing is left behind once it's down.
        return self._systemctl("stop", "--no-block", UNIT)

    def yield_armada_bottom(self) -> bool:
        """Stops Armada's bottom-screen gamescope if it's up; True when it was."""
        _, state = self._systemctl("is-active", ARMADA_BOTTOM_UNIT)
        # "activating" is its restart loop, retrying while something else has the lease.
        if state not in ("active", "activating"):
            return False
        # Blocking on purpose: the lease is only free once that gamescope has exited.
        code, _ = self._systemctl("stop", ARMADA_BOTTOM_UNIT)
        return code == 0

    def restore_armada_bottom(self) -> bool:
        code, _ = self._systemctl("start", "--no-block", ARMADA_BOTTOM_UNIT)
        return code == 0
