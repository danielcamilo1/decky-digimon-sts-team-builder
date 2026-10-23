"""Whether this machine is Armada OS with a second screen, and whether it can be used right now."""

import os
import shlex
from dataclasses import dataclass
from typing import Callable

from bottom_screen import system

DEVICE_ENV = "/usr/libexec/armada/device-env"
# Created by the game-mode gamescope; it hands a DRM lease for the bottom panel to one client.
# The path is gamescope's; detect() only accepts it when it belongs to this plugin's user.
LEASE_SOCKET = "/tmp/gamescope-lease.sock"
# The renderer runs on the system's Python, not Decky's: it needs pycairo and runs natively.
SYSTEM_PYTHON = "/usr/bin/python3"

# Reasons that mean this machine will never have a usable second screen.
UNSUPPORTED = frozenset({"not_armada", "no_second_screen"})


@dataclass(frozen=True)
class Panel:
    connector: str
    touchscreen: str
    # How the panel is mounted, as Armada's gamescope is told: normal, left, right or upside_down.
    orientation: str
    uid: int


@dataclass(frozen=True)
class Detection:
    panel: "Panel | None"
    reason: str


def parse_env(text: str) -> dict:
    """device-env prints shell assignments (`NAME=value`, quoted with %q)."""
    values = {}
    for line in text.splitlines():
        name, sep, raw = line.partition("=")
        if not sep or not name.isidentifier():
            continue
        try:
            parts = shlex.split(raw)
        except ValueError:
            continue
        values[name] = parts[0] if parts else ""
    return values


def detect(
    exists: Callable[[str], bool] = os.path.exists,
    device_env: Callable[[], str] = lambda: system.run([DEVICE_ENV], timeout=5)[1],
    owner: Callable[[str], int] = lambda path: os.stat(path).st_uid,
    uid: Callable[[], int] = os.getuid,
) -> Detection:
    if not exists(DEVICE_ENV):
        return Detection(None, "not_armada")
    env = parse_env(device_env())
    connector = env.get("ARMADA_SECONDARY_CONNECTOR", "")
    touchscreen = env.get("ARMADA_SECONDARY_TOUCHSCREEN", "")
    if not connector or not touchscreen:
        return Detection(None, "no_second_screen")
    if not exists(SYSTEM_PYTHON):
        return Detection(None, "no_python")
    if not exists(LEASE_SOCKET):
        return Detection(None, "not_in_game_mode")
    try:
        session = owner(LEASE_SOCKET)
    except OSError:
        return Detection(None, "not_in_game_mode")
    # This plugin isn't root, so it can only start services in its own user's session.
    if uid() != session:
        return Detection(None, "other_user")
    orientation = env.get("ARMADA_PANEL_ORIENTATION", "") or "normal"
    return Detection(Panel(connector, touchscreen, orientation, session), "ok")
