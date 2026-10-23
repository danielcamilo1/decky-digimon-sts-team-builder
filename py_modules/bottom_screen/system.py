"""Running system commands from Decky's backend, which is an x86 PyInstaller bundle under FEX on ARM."""

import os
import platform
import subprocess

_BIN_DIRS = ("/usr/bin", "/bin", "/usr/sbin", "/sbin")
# An Arm64 kernel reports the CPU's main ID register here, whatever userspace is running.
_MIDR = "/sys/devices/system/cpu/cpu0/regs/identification/midr_el1"
# Under FEX, an absolute path resolves inside the x86 rootfs first; this reaches the host's.
_HOST_ROOT = "/proc/self/root"


def clean_env() -> dict:
    """The environment minus PyInstaller's library path.

    The frozen backend points LD_LIBRARY_PATH at its own bundled libraries, which are older
    than the system's and break system binaries that link against them (systemctl through
    libsystemd → libcrypto, for one). PyInstaller keeps the original value alongside.
    """
    env = dict(os.environ)
    original = env.pop("LD_LIBRARY_PATH_ORIG", None)
    if original:
        env["LD_LIBRARY_PATH"] = original
    else:
        env.pop("LD_LIBRARY_PATH", None)
    env.setdefault("PATH", "/usr/bin:/bin:/usr/sbin:/sbin")
    return env


def emulated() -> bool:
    """True when this Python is x86 running on an ARM kernel, i.e. under FEX."""
    return platform.machine() in ("x86_64", "i686", "i386") and os.path.exists(_MIDR)


def binary(name: str) -> str:
    """The path to run `name` from: the host's own build when emulated, which starts natively
    instead of through the emulator (about a second per spawn otherwise)."""
    path = next((os.path.join(d, name) for d in _BIN_DIRS if os.path.exists(os.path.join(d, name))), name)
    if emulated() and os.path.isabs(path):
        host = os.path.join(_HOST_ROOT, path.lstrip("/"))
        if os.access(host, os.X_OK):
            return host
    return path


def user_env(uid: int) -> dict:
    """What `systemctl --user` needs to find the session's service manager."""
    env = clean_env()
    runtime = f"/run/user/{uid}"
    env["XDG_RUNTIME_DIR"] = runtime
    env["DBUS_SESSION_BUS_ADDRESS"] = f"unix:path={runtime}/bus"
    return env


def run(argv: list, env: dict | None = None, timeout: float = 10) -> tuple:
    """(exit code, output) for a command; output is stdout, or stderr when stdout is empty."""
    try:
        done = subprocess.run(
            [binary(argv[0]), *argv[1:]], env=env if env is not None else clean_env(),
            capture_output=True, text=True, timeout=timeout, check=False,
        )
        return done.returncode, (done.stdout or done.stderr).strip()
    except (OSError, subprocess.SubprocessError) as e:
        return 1, f"{type(e).__name__}: {e}"
