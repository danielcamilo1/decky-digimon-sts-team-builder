"""The bottom-screen renderer: python3 app.py <plugin assets dir>, started by the plugin.

Runs on the system's Python with pycairo, outside Decky. It borrows the bottom panel from
gamescope as a DRM lease, draws the builder into it, takes touches, and syncs the team with
the plugin over loopback. Exit codes: 0 stopped, 3 the system lacks what it needs, 4 the
panel is held by something else (the plugin retries).

DTB_BOTTOM_FAKE_PANEL=<w>x<h> swaps the lease for an in-memory panel driven by commands on
stdin ("down x y", "move x y", "up", "shot <path>"), for testing without the hardware.
"""

from __future__ import annotations

import os
import select
import signal
import sys
import time

UNAVAILABLE = 3
BUSY = 4

FRAME_GAP_S = 1 / 30
# An OLED showing the same frame for hours burns in. With no touch for a while the screen
# dims, then goes black (pixels off) until it's touched again.
DIM_AFTER_S = 120.0
BLANK_AFTER_S = 600.0
DIM_ALPHA = 0.6
LOGICAL_HEIGHT = 540
LOGICAL_MIN_WIDTH = 560


def orientation_matrix(orientation: str, panel_w: int, panel_h: int) -> tuple:
    """cairo.Matrix values mapping the upright canvas onto the panel as it's mounted.

    "right" is the Thor's bottom panel: portrait scanout mounted a quarter turn clockwise.
    """
    if orientation == "right":
        return (0.0, 1.0, -1.0, 0.0, float(panel_w), 0.0)
    if orientation == "left":
        return (0.0, -1.0, 1.0, 0.0, 0.0, float(panel_h))
    if orientation == "upside_down":
        return (-1.0, 0.0, 0.0, -1.0, float(panel_w), float(panel_h))
    return (1.0, 0.0, 0.0, 1.0, 0.0, 0.0)


def canvas_size(orientation: str, panel_w: int, panel_h: int) -> tuple:
    return (panel_h, panel_w) if orientation in ("left", "right") else (panel_w, panel_h)


def panel_to_canvas(orientation: str, nx: float, ny: float, panel_w: int, panel_h: int) -> tuple:
    """A touch at (nx, ny), normalised to the panel's scanout, in upright canvas pixels."""
    px, py = nx * panel_w, ny * panel_h
    if orientation == "right":
        return py, panel_w - px
    if orientation == "left":
        return panel_h - py, px
    if orientation == "upside_down":
        return panel_w - px, panel_h - py
    return px, py


class FakePanel:
    """Two buffers in memory, standing in for LeasedPanel."""

    def __init__(self, width: int, height: int):
        import mmap

        self.width, self.height = width, height
        self.pitch = width * 4
        self.buffers = [type("Buffer", (), {"memory": mmap.mmap(-1, self.pitch * height), "pitch": self.pitch})()
                        for _ in range(2)]
        self._shown = 0
        self.read_fd, self.fd = os.pipe()
        self.touch_socket = None
        self.presented = 0

    @property
    def back_index(self) -> int:
        return 1 - self._shown

    def present(self) -> None:
        self._shown = self.back_index
        self.presented += 1

    def wait_flip(self, timeout: float) -> None:
        pass

    def drain(self) -> None:
        pass

    def request_touch(self) -> None:
        pass

    def shown_memory(self):
        return self.buffers[self._shown].memory

    def close(self) -> None:
        pass


class App:
    def __init__(self, panel, assets: str, url: str, token: str, orientation: str, touchscreen: str | None):
        import cairo

        import draw
        from link import Link, Wake
        from sprites import Sprites
        from team import Dex, normalize_chains
        from touch import TouchInput
        from ui import Screen

        self.cairo = cairo
        self.draw = draw
        self.normalize_chains = normalize_chains
        self.panel = panel
        self.orientation = orientation
        canvas_w, canvas_h = canvas_size(orientation, panel.width, panel.height)
        self.scale = canvas_h / LOGICAL_HEIGHT
        logical_w = max(LOGICAL_MIN_WIDTH, canvas_w / self.scale)
        self.surfaces = [
            cairo.ImageSurface.create_for_data(b.memory, cairo.FORMAT_RGB24, panel.width, panel.height, b.pitch)
            for b in panel.buffers
        ]
        self.matrix = cairo.Matrix(*orientation_matrix(orientation, panel.width, panel.height))
        self.screen = Screen(Dex.load(assets), Sprites(assets), self.scale, logical_w, LOGICAL_HEIGHT)
        self.screen.on_edit = self._edited
        self.wake = Wake()
        self.link = Link(url, token, self.wake)
        self.touch = TouchInput(panel.touch_socket, touchscreen)
        if panel.touch_socket is not None:
            panel.touch_socket.setblocking(False)
            panel.request_touch()
        self.dirty = True
        self.last_frame = 0.0
        self.last_touch = time.monotonic()
        self.idle = "awake"
        self.swallow = False
        self.stopping = False

    def _edited(self, chains: list) -> None:
        self.link.write(chains)

    def run(self, commands=None) -> None:
        self.link.start()
        self.link.report(state="running")
        while not self.stopping:
            now = time.monotonic()
            deadlines = [now + 1.0, self.last_touch + DIM_AFTER_S, self.last_touch + BLANK_AFTER_S]
            if self.dirty:
                deadlines.append(self.last_frame + FRAME_GAP_S)
            armed = self.screen.next_deadline()
            if armed:
                deadlines.append(armed)
            timeout = max(0.0, min(d for d in deadlines if d >= now - 0.001) - now) if deadlines else 1.0
            watched = [self.wake.read_fd, self.panel.fd, *self.touch.fds]
            if commands is not None:
                watched.append(commands.fileno())
            try:
                readable, _, _ = select.select(watched, [], [], timeout)
            except InterruptedError:
                continue
            if self.wake.read_fd in readable:
                self.wake.drain()
                for kind, value in self.link.take():
                    self._apply(kind, value)
            if self.panel.fd in readable:
                self.panel.drain()
            for fd in self.touch.fds:
                if fd in readable:
                    for kind, x, y in self.touch.read(fd):
                        self._touch(kind, x, y)
            if commands is not None and commands.fileno() in readable:
                if not self._command(commands.readline()):
                    break
            now = time.monotonic()
            if self.screen.expire(now):
                self.dirty = True
            self._update_idle(now)
            if self.dirty and now - self.last_frame >= FRAME_GAP_S:
                self._paint()

    def _apply(self, kind: str, value) -> None:
        if kind == "state":
            chains = self.normalize_chains(value)
            if chains is not None and chains != self.screen.chains:
                self.screen.set_chains(chains)
                # A change made on the Steam side is someone using the device: show it.
                self._wake_screen()
                self.dirty = True
            elif chains is not None and not self.screen.loaded:
                self.screen.set_chains(chains)
                self.dirty = True
        elif kind == "online":
            self.screen.online = bool(value)
            self.dirty = True

    def _wake_screen(self) -> None:
        self.last_touch = time.monotonic()
        if self.idle != "awake":
            self.idle = "awake"
            self.dirty = True

    def _update_idle(self, now: float) -> None:
        idle_for = now - self.last_touch
        state = "blank" if idle_for >= BLANK_AFTER_S else "dim" if idle_for >= DIM_AFTER_S else "awake"
        if state != self.idle:
            self.idle = state
            self.dirty = True

    def _touch(self, kind: str, nx, ny) -> None:
        if kind == "down":
            # The touch that wakes a dimmed or blank screen only wakes it.
            self.swallow = self.idle != "awake"
            self._wake_screen()
            if self.swallow:
                return
        elif self.swallow:
            if kind == "up":
                self.swallow = False
            return
        self.last_touch = time.monotonic()
        if kind == "up":
            x, y = self._last_point if hasattr(self, "_last_point") else (0, 0)
            self.screen.touch_up(x, y)
        else:
            cx, cy = panel_to_canvas(self.orientation, nx, ny, self.panel.width, self.panel.height)
            x, y = cx / self.scale, cy / self.scale
            self._last_point = (x, y)
            if kind == "down":
                self.screen.touch_down(x, y)
            else:
                self.screen.touch_move(x, y)
        self.dirty = True

    def _paint(self) -> None:
        cairo = self.cairo
        self.panel.wait_flip(0.1)
        index = self.panel.back_index
        surface = self.surfaces[index]
        ctx = cairo.Context(surface)
        ctx.set_matrix(self.matrix)
        ctx.scale(self.scale, self.scale)
        if self.idle == "blank":
            ctx.set_source_rgb(0, 0, 0)
            ctx.paint()
        else:
            self.screen.paint(ctx)
            if self.idle == "dim":
                ctx.set_source_rgba(0, 0, 0, DIM_ALPHA)
                ctx.paint()
        surface.flush()
        self.panel.present()
        self.last_frame = time.monotonic()
        self.dirty = False

    def _command(self, line: str) -> bool:
        """Test input for FakePanel, in panel-normalised coordinates like real touches."""
        parts = line.split()
        if not parts:
            return bool(line)
        if parts[0] in ("down", "move"):
            self._touch(parts[0], float(parts[1]), float(parts[2]))
        elif parts[0] == "up":
            self._touch("up", None, None)
        elif parts[0] == "idle":
            self.last_touch = time.monotonic() - float(parts[1])
        elif parts[0] == "wait":
            end = time.monotonic() + float(parts[1])
            while time.monotonic() < end:
                time.sleep(0.02)
                self.wake.drain()
                for kind, value in self.link.take():
                    self._apply(kind, value)
        elif parts[0] == "shot":
            self._update_idle(time.monotonic())
            self._paint()
            self._save_shot(parts[1])
        elif parts[0] == "hits":
            import json

            hits = [[repr(key), r.x, r.y, r.w, r.h] for _, r, key, action in self.screen._hits if action]
            sys.stdout.write(json.dumps({"hits": hits, "scale": self.scale, "size": [self.screen.W, self.screen.H]}) + "\n")
        elif parts[0] == "quit":
            return False
        sys.stdout.write("ok\n")
        sys.stdout.flush()
        return True

    def _save_shot(self, path: str) -> None:
        cairo = self.cairo
        panel = self.panel
        shown = cairo.ImageSurface.create_for_data(panel.shown_memory(), cairo.FORMAT_RGB24, panel.width,
                                                   panel.height, panel.pitch)
        shown.write_to_png(path + ".panel.png")
        # The same frame turned upright, as a person holding the device sees it.
        canvas_w, canvas_h = canvas_size(self.orientation, panel.width, panel.height)
        upright = cairo.ImageSurface(cairo.FORMAT_RGB24, canvas_w, canvas_h)
        ctx = cairo.Context(upright)
        inverse = cairo.Matrix(*orientation_matrix(self.orientation, panel.width, panel.height))
        inverse.invert()
        ctx.set_matrix(inverse)
        ctx.set_source_surface(shown, 0, 0)
        ctx.paint()
        upright.write_to_png(path + ".png")


def _unavailable(code: int, reason: str, url: str | None, token: str | None) -> int:
    print(f"dtb-bottom-screen: {reason}", file=sys.stderr)
    if url and token:
        try:
            from link import Link, Wake

            Link(url, token, Wake()).report(state="stopped", error=reason)
        except Exception:  # noqa: BLE001
            pass
    return code


def main(argv: list) -> int:
    here = os.path.dirname(os.path.abspath(__file__))
    sys.path.insert(0, here)
    url, token = os.environ.get("DTB_BOTTOM_URL"), os.environ.get("DTB_BOTTOM_TOKEN")
    if len(argv) < 2 or not url or not token:
        return _unavailable(UNAVAILABLE, "usage: app.py <assets dir>, with DTB_BOTTOM_URL and DTB_BOTTOM_TOKEN set",
                            None, None)
    try:
        import cairo  # noqa: F401
    except ImportError:
        return _unavailable(UNAVAILABLE, "no_cairo", url, token)

    fake = os.environ.get("DTB_BOTTOM_FAKE_PANEL")
    if fake:
        width, height = (int(v) for v in fake.lower().split("x"))
        panel = FakePanel(width, height)
    else:
        from lease import LeaseBusy, LeaseError, LeasedPanel

        try:
            panel = LeasedPanel()
        except LeaseBusy:
            return _unavailable(BUSY, "lease_busy", url, token)
        except (LeaseError, OSError) as error:
            return _unavailable(UNAVAILABLE, f"lease_failed:{error}", url, token)

    app = App(panel, argv[1], url, token, os.environ.get("DTB_BOTTOM_ORIENTATION", "normal"),
              os.environ.get("DTB_BOTTOM_TOUCHSCREEN"))

    def stop(*_):
        app.stopping = True
        app.wake.ring()

    signal.signal(signal.SIGTERM, stop)
    signal.signal(signal.SIGINT, stop)
    try:
        app.run(sys.stdin if fake else None)
    except ConnectionError:
        # gamescope closed the lease socket: the session is going away.
        pass
    finally:
        panel.close()
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
