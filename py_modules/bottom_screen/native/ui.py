"""The builder on the bottom screen: what's drawn, where touches land, and what they do.

Everything here is in logical units on a landscape canvas: 620×540 on the AYN Thor, whose
1240×1080 panel is drawn at 2×. The app maps that canvas onto the panel's real orientation.
The layout follows the Steam builder: the team down the left, the selected line across the
top, and the details of the Digimon last tapped below it, with the edits on sheets.

Hit areas and scroll areas are collected while painting, so what's tappable is always
exactly what's on screen.
"""

from __future__ import annotations

import time

import cairo

import draw
import team
from draw import (ACCENT, ACCENT_DIM, BG, BORDER, BORDER_STRONG, DANGER, LOCKED, ON_ACCENT, PANEL, PANEL_RAISED,
                  SHEET, TEXT, TEXT_DIM, TEXT_FAINT)

M = 8
RAIL_W = 72
RAIL_ITEM_H = 70
HEAD_H = 44
STRIP_H = 136
CELL_W = 86
ARROW_W = 16
TILE = 64
DRAG_SLOP = 10
ARM_S = 3.0
STAT_SCALE = {"HP": 4200, "SP": 2400, "ATK": 1800, "DEF": 1600, "INT": 1800, "SPI": 1600, "SPD": 1500}
CONDITION_LABEL = {"simple": "Requires", "stats": "Stats", "jogress": "JOGRESS", "item": "ITEM"}


class Rect:
    __slots__ = ("x", "y", "w", "h")

    def __init__(self, x, y, w, h):
        self.x, self.y, self.w, self.h = x, y, w, h

    def contains(self, px, py) -> bool:
        return self.x <= px <= self.x + self.w and self.y <= py <= self.y + self.h

    def intersect(self, other: "Rect") -> "Rect | None":
        x1, y1 = max(self.x, other.x), max(self.y, other.y)
        x2, y2 = min(self.x + self.w, other.x + other.w), min(self.y + self.h, other.y + other.h)
        return Rect(x1, y1, x2 - x1, y2 - y1) if x2 > x1 and y2 > y1 else None


class Screen:
    def __init__(self, dex: team.Dex, sprites, scale: float, width: float, height: float):
        self.dex = dex
        self.sprites = sprites
        self.scale = scale
        self.W, self.H = width, height
        self.chains: list = []
        self.loaded = False
        self.online = True
        self.selected = 0
        self.inspected: dict = {}
        self.sheet = None
        self.generation = None
        self.armed = None
        self.offsets: dict = {}
        self.extents: dict = {}
        # Set by the app: called with the new chain list after every edit.
        self.on_edit = lambda chains: None
        self._hits: list = []
        self._scrollers: list = []
        self._blockers: list = []
        self._layer = 0
        self._origin = (0.0, 0.0)
        self._clip = None
        self._pressed = None
        self._touch = None

    # --- state ------------------------------------------------------------------------

    def set_chains(self, chains: list) -> None:
        self.chains = chains
        self.loaded = True
        self.selected = min(self.selected, max(0, len(chains) - 1))

    def edit(self, apply) -> None:
        chains = apply(self.chains)
        if chains is self.chains:
            return
        self.set_chains(chains)
        self.on_edit(chains)

    def select(self, index: int) -> None:
        self.selected = index
        self.sheet = None
        self.offsets.pop("strip", None)
        self.offsets.pop("details", None)

    def open_sheet(self, sheet) -> None:
        self.sheet = sheet
        self.armed = None
        for key in ("sheet", "gens"):
            self.offsets.pop(key, None)

    def press_armed(self, key: str, act) -> None:
        """Two-tap confirmation: the first tap arms, a second within ARM_S acts."""
        if self.armed and self.armed[0] == key and time.monotonic() < self.armed[1]:
            self.armed = None
            act()
        else:
            self.armed = (key, time.monotonic() + ARM_S)

    def is_armed(self, key: str) -> bool:
        return bool(self.armed and self.armed[0] == key and time.monotonic() < self.armed[1])

    def next_deadline(self) -> float | None:
        return self.armed[1] if self.armed else None

    def expire(self, now: float) -> bool:
        if self.armed and now >= self.armed[1]:
            self.armed = None
            return True
        return False

    # --- touch ------------------------------------------------------------------------

    def _top_layer(self, x, y) -> int:
        return max((layer for layer, rect in self._blockers if rect.contains(x, y)), default=0)

    def _hit_at(self, x, y):
        floor = self._top_layer(x, y)
        for layer, rect, key, action in reversed(self._hits):
            if layer >= floor and rect.contains(x, y):
                return key, action
        return None, None

    def _scroller_at(self, x, y):
        floor = self._top_layer(x, y)
        for layer, sid, rect, axis in reversed(self._scrollers):
            if layer >= floor and rect.contains(x, y) and self.extents.get(sid, 0) > 0:
                return sid, axis
        return None, None

    def touch_down(self, x, y) -> None:
        key, _ = self._hit_at(x, y)
        sid, axis = self._scroller_at(x, y)
        self._pressed = key
        self._touch = {"x": x, "y": y, "sid": sid, "axis": axis, "start": self.offsets.get(sid, 0.0), "dragging": False}

    def touch_move(self, x, y) -> None:
        t = self._touch
        if not t or not t["sid"]:
            return
        delta = (x - t["x"]) if t["axis"] == "x" else (y - t["y"])
        if not t["dragging"] and abs(delta) > DRAG_SLOP:
            t["dragging"] = True
            self._pressed = None
        if t["dragging"]:
            self.offsets[t["sid"]] = min(max(0.0, t["start"] - delta), self.extents.get(t["sid"], 0.0))

    def touch_up(self, x, y) -> None:
        t, self._touch = self._touch, None
        pressed, self._pressed = self._pressed, None
        if not t or t["dragging"] or pressed is None:
            return
        key, action = self._hit_at(t["x"], t["y"])
        # A tap counts where it went down; a finger that slid off the button cancels it.
        if key == pressed and action is not None and self._hit_at(x, y)[0] == key:
            action()

    # --- paint plumbing ---------------------------------------------------------------

    def _hit(self, x, y, w, h, key, action=None) -> None:
        ox, oy = self._origin
        rect = Rect(x + ox, y + oy, w, h)
        if self._clip is not None:
            rect = rect.intersect(self._clip)
        if rect is not None:
            self._hits.append((self._layer, rect, key, action))

    def _block(self, rect: Rect) -> None:
        """Everything registered after this sits above whatever is under `rect`."""
        self._layer += 1
        self._blockers.append((self._layer, rect))
        self._hits.append((self._layer, rect, "block", None))

    def _begin_scroll(self, ctx, sid: str, rect: Rect, axis: str) -> float:
        offset = min(self.offsets.get(sid, 0.0), self.extents.get(sid, 0.0))
        self.offsets[sid] = offset
        ctx.save()
        ctx.rectangle(rect.x, rect.y, rect.w, rect.h)
        ctx.clip()
        if axis == "x":
            ctx.translate(-offset, 0)
            self._origin = (-offset, 0.0)
        else:
            ctx.translate(0, -offset)
            self._origin = (0.0, -offset)
        self._clip = rect
        self._scrollers.append((self._layer, sid, rect, axis))
        return offset

    def _end_scroll(self, ctx, sid: str, rect: Rect, axis: str, content: float) -> None:
        ctx.restore()
        self._origin = (0.0, 0.0)
        self._clip = None
        self.extents[sid] = max(0.0, content - (rect.w if axis == "x" else rect.h))

    def pressed(self, key) -> bool:
        return self._pressed is not None and self._pressed == key

    # --- paint ------------------------------------------------------------------------

    def paint(self, ctx: cairo.Context) -> None:
        self._hits, self._scrollers, self._blockers, self._layer = [], [], [], 0
        draw.color(ctx, BG)
        ctx.paint()
        glow = cairo.RadialGradient(self.W, 0, 0, self.W, 0, self.W * 0.9)
        glow.add_color_stop_rgba(0, 0.075, 0.145, 0.227, 1)
        glow.add_color_stop_rgba(1, *BG, 0)
        ctx.set_source(glow)
        ctx.paint()

        main = Rect(M + RAIL_W + M, M, self.W - (M + RAIL_W + M) - M, self.H - 2 * M)
        self._rail(ctx, Rect(M, M, RAIL_W, self.H - 2 * M))
        chain = self.chains[self.selected] if self.loaded and self.chains else None
        if not self.loaded:
            self._center(ctx, main, "Loading…")
        elif chain is None:
            self._empty(ctx, main)
        else:
            self._line(ctx, main, chain, self.selected)
        if self.sheet is not None and self.loaded:
            self._sheet(ctx, main, chain)
        if not self.online:
            self._offline(ctx)

    def _center(self, ctx, rect: Rect, message: str) -> None:
        draw.text(ctx, message, rect.x + rect.w / 2, rect.y + rect.h / 2 - 8, 13, TEXT_DIM, align="center")

    def _offline(self, ctx) -> None:
        message = "Can't reach the plugin. Is \"Show on the bottom screen\" still on?"
        draw.font(ctx, 11)
        w = draw.width(ctx, message) + 28
        x, y = (self.W - w) / 2, self.H - M - 36
        draw.fill_rounded(ctx, x, y, w, 30, 15, (0.16, 0.05, 0.05, 0.96))
        draw.stroke_rounded(ctx, x, y, w, 30, 15, DANGER)
        draw.text(ctx, message, self.W / 2, y + 8, 11, TEXT, align="center")

    # --- rail -------------------------------------------------------------------------

    def _rail(self, ctx, rect: Rect) -> None:
        if not self.loaded:
            return
        count = len(self.chains)
        content = count * (RAIL_ITEM_H + 6) + 48
        self._begin_scroll(ctx, "rail", rect, "y")
        y = rect.y
        for index, chain in enumerate(self.chains):
            self._rail_item(ctx, Rect(rect.x, y, rect.w, RAIL_ITEM_H), index, chain)
            y += RAIL_ITEM_H + 6
        key = ("add-line",)
        if self.pressed(key):
            draw.fill_rounded(ctx, rect.x, y, rect.w, 46, 12, ACCENT_DIM)
        draw.stroke_rounded(ctx, rect.x, y, rect.w, 46, 12, BORDER_STRONG, dash=True)
        draw.icon(ctx, "plus", rect.x + rect.w / 2, y + 23, 22, TEXT_DIM)
        self._hit(rect.x, y, rect.w, 46, key, lambda: self.open_sheet(("add",)))
        self._end_scroll(ctx, "rail", rect, "y", content)

    def _rail_item(self, ctx, r: Rect, index: int, chain: dict) -> None:
        on = index == self.selected
        key = ("line", index)
        progress = team.Progress(chain, self.dex)
        draw.fill_rounded(ctx, r.x, r.y, r.w, r.h, 12, ACCENT_DIM if on or self.pressed(key) else PANEL)
        draw.stroke_rounded(ctx, r.x, r.y, r.w, r.h, 12, ACCENT if on else BORDER, 2 if on else 1)
        draw.text(ctx, str(index + 1), r.x + 7, r.y + 5, 10, ACCENT if on else TEXT_FAINT, bold=True)
        if chain.get("locked"):
            draw.icon(ctx, "lock", r.x + r.w - 11, r.y + 11, 11, LOCKED)
        # Where the line is is what you glance down for mid-game, so that's the sprite.
        if progress.current:
            self._sprite(ctx, progress.current, r.x + (r.w - 44) / 2, r.y + 6, 44)
        label = f"{progress.index + 1}/{len(progress.members)}"
        draw.font(ctx, 10)
        label_w = draw.width(ctx, label) + (12 if progress.marked else 0)
        lx = r.x + (r.w - label_w) / 2
        if progress.marked:
            draw.icon(ctx, "flag", lx + 4, r.y + r.h - 12, 10, ACCENT)
            lx += 12
        draw.text(ctx, label, lx, r.y + r.h - 18, 10, TEXT_DIM)
        self._hit(r.x, r.y, r.w, r.h, key, lambda: self.select(index))

    # --- empty team -------------------------------------------------------------------

    def _empty(self, ctx, rect: Rect) -> None:
        cy = rect.y + rect.h / 2
        draw.text(ctx, "No evolution lines yet.", rect.x + rect.w / 2, cy - 44, 14, TEXT_DIM, align="center")
        add = self._button(ctx, rect.x + rect.w / 2 - 158, cy - 10, 150, "Add a line", "plus", ("empty-add",),
                           lambda: self.open_sheet(("add",)), primary=True)
        self._button(ctx, add + 8, cy - 10, 150, "Random team", "dice", ("random",),
                     lambda: self.edit(lambda chains: team.random_team(self.dex, 6, [c for c in chains if c.get("locked")])))

    # --- the selected line ----------------------------------------------------------

    def _line(self, ctx, rect: Rect, chain: dict, index: int) -> None:
        progress = team.Progress(chain, self.dex)
        members = progress.members
        tail = members[-1] if members else None
        fallback = progress.next or progress.current or tail
        inspected = next((m for m in members if m["id"] == self.inspected.get(index)), fallback)

        # Header: name of the line and where it is.
        title = f"Line {index + 1}"
        if members:
            title += f" · {members[0]['name']} → {tail['name']}" if members[0]["id"] != tail["id"] else f" · {tail['name']}"
        draw.text(ctx, title, rect.x + 2, rect.y + 2, 15, TEXT, bold=True, max_width=rect.w - 56)
        sub_y = rect.y + 24
        if progress.marked and progress.current:
            draw.icon(ctx, "flag", rect.x + 7, sub_y + 6, 10, ACCENT)
            used = draw.text(ctx, f"On {progress.current['name']}", rect.x + 16, sub_y, 11, ACCENT)
            rest = f" · next {progress.next['name']}" if progress.next else " · final stage"
            draw.text(ctx, rest, rect.x + 16 + used, sub_y, 11, TEXT_DIM, max_width=rect.w - 80 - used)
        else:
            x = rect.x + 2
            if chain.get("locked"):
                draw.icon(ctx, "lock", x + 5, sub_y + 6, 10, LOCKED)
                x += 14
            draw.text(ctx, "Tap a Digimon, then \"I'm here\" to mark your progress", x, sub_y, 11, TEXT_FAINT,
                      max_width=rect.w - 60 - (x - rect.x))
        self._icon_button(ctx, rect.x + rect.w - 44, rect.y, "dots", ("menu",), lambda: self.open_sheet(("menu",)))

        strip = Rect(rect.x, rect.y + HEAD_H + 6, rect.w, STRIP_H)
        self._strip(ctx, strip, chain, index, members, inspected)

        details = Rect(rect.x, strip.y + strip.h + 8, rect.w, rect.y + rect.h - (strip.y + strip.h + 8))
        if inspected is not None:
            position = next((i for i, m in enumerate(members) if m["id"] == inspected["id"]), 0)
            self._details(ctx, details, chain, index, inspected, position, len(members))

    def _strip(self, ctx, rect: Rect, chain, index, members, inspected) -> None:
        draw.fill_rounded(ctx, rect.x, rect.y, rect.w, rect.h, 12, PANEL)
        draw.stroke_rounded(ctx, rect.x, rect.y, rect.w, rect.h, 12, BORDER)
        locked = bool(chain.get("locked"))
        before = [] if locked else team.prepend_options(chain, self.dex)
        tail_evolutions = [] if locked or not members else self.dex.evolutions(members[-1])

        cells = []
        if before:
            cells.append(("devolve", None, None))
        for position, digimon in enumerate(members):
            cells.append(("tile", digimon, position))
        if tail_evolutions:
            cells.append(("evolve", None, len(members) - 1))
        content = len(cells) * CELL_W + (len(cells) - 1) * ARROW_W + 16

        # Brings the inspected Digimon into view when the line opens.
        if "strip" not in self.offsets and inspected is not None:
            at = next((i for i, c in enumerate(cells) if c[0] == "tile" and c[1]["id"] == inspected["id"]), 0)
            centre = 8 + at * (CELL_W + ARROW_W) + CELL_W / 2
            self.offsets["strip"] = max(0.0, centre - rect.w / 2)
            self.extents["strip"] = max(0.0, content - rect.w)
        self._begin_scroll(ctx, "strip", rect, "x")
        x = rect.x + 8
        for i, (kind, digimon, position) in enumerate(cells):
            if i:
                draw.icon(ctx, "chevron", x + ARROW_W / 2 - 2, rect.y + 12 + TILE / 2, 14, TEXT_FAINT)
                x += ARROW_W
            fx = x + (CELL_W - TILE) / 2
            fy = rect.y + 12
            if kind == "tile":
                key = ("inspect", digimon["id"])
                is_inspected = inspected is not None and digimon["id"] == inspected["id"]
                self._frame(ctx, digimon, fx, fy, TILE, current=chain.get("current") == digimon["id"], badge=True,
                            ring=is_inspected, pressed=self.pressed(key))
                draw.text(ctx, digimon["name"], x + CELL_W / 2, fy + TILE + 6, 10.5, TEXT if is_inspected else TEXT_DIM,
                          bold=is_inspected, max_width=CELL_W - 4, align="center")
                self._hit(x, fy - 4, CELL_W, TILE + 26, key,
                          lambda d=digimon: self.inspected.__setitem__(index, d["id"]))
                branches = [] if locked or position == len(members) - 1 else self.dex.evolutions(digimon)
                if len(branches) > 1:
                    self._chip(ctx, x + CELL_W / 2, fy + TILE + 26, "Change", "edit", ("change", position),
                               lambda p=position: self.open_sheet(("evolve", p)))
            else:
                key = (kind,)
                if self.pressed(key):
                    draw.fill_rounded(ctx, fx, fy, TILE, TILE, 8, ACCENT_DIM)
                draw.stroke_rounded(ctx, fx, fy, TILE, TILE, 8, BORDER_STRONG, dash=True)
                draw.icon(ctx, "plus", fx + TILE / 2, fy + TILE / 2, 22, TEXT_DIM)
                draw.text(ctx, "Devolve" if kind == "devolve" else "Evolve", x + CELL_W / 2, fy + TILE + 6, 10.5,
                          TEXT_DIM, align="center")
                sheet = ("devolve",) if kind == "devolve" else ("evolve", position)
                self._hit(x, fy - 4, CELL_W, TILE + 26, key, lambda s=sheet: self.open_sheet(s))
            x += CELL_W
        self._end_scroll(ctx, "strip", rect, "x", content)

    def _details(self, ctx, rect: Rect, chain, index, digimon, position, length) -> None:
        draw.fill_rounded(ctx, rect.x, rect.y, rect.w, rect.h, 12, PANEL)
        draw.stroke_rounded(ctx, rect.x, rect.y, rect.w, rect.h, 12, BORDER)
        inner = Rect(rect.x + 1, rect.y + 1, rect.w - 2, rect.h - 2)
        self._begin_scroll(ctx, "details", inner, "y")
        x, y, w = rect.x + 12, rect.y + 12, rect.w - 24
        accent = draw.attribute_color(digimon.get("attribute"))

        self._frame(ctx, digimon, x, y, 56)
        tx = x + 66
        draw.text(ctx, digimon["name"], tx, y + 1, 17, TEXT, bold=True, max_width=w - 66)
        icon = self.sprites.attribute(draw.ATTRIBUTE_ICONS.get(digimon.get("attribute"), "unknown.png"))
        ax = tx
        if icon is not None:
            self._image(ctx, icon, tx, y + 24, 13)
            ax += 17
        used = draw.text(ctx, digimon.get("attribute", ""), ax, y + 25, 11, accent)
        draw.text(ctx, f"  {digimon.get('generation', '')} · {digimon.get('type', '')}", ax + used, y + 25, 11, TEXT_DIM,
                  max_width=w - 66 - (ax - tx) - used)
        if digimon.get("base_personality"):
            used = draw.text(ctx, "Base personality ", tx, y + 41, 11, TEXT_FAINT)
            draw.text(ctx, digimon["base_personality"], tx + used, y + 41, 11, TEXT_DIM)
        y += 66

        is_current = chain.get("current") == digimon["id"]
        bx = x
        bx = self._button(ctx, bx, y, None, "Clear mark" if is_current else "I'm here", "flag", ("mark",),
                          lambda: self.edit(lambda c: team.set_current(c, index, None if is_current else digimon["id"])),
                          primary=not is_current)
        if not chain.get("locked"):
            if length == 1:
                label = "Remove line"
            elif position in (0, length - 1):
                label = "Remove"
            else:
                label = "Cut here"
            armed = self.is_armed("remove")
            self._button(ctx, bx + 8, y, None, "Tap again" if armed else label, "trash", ("remove",),
                         lambda: self.press_armed("remove",
                                                  lambda: self.edit(lambda c: team.trim_at(c, index, digimon["id"]))),
                         danger=True, armed=armed)
        y += 52

        y = self._label(ctx, f"How to evolve into {digimon['name']}", x, y, w)
        y = self._requirements(ctx, digimon, x, y, w) + 12

        y = self._label(ctx, "Base stats · Lv 99", x, y, w)
        stats = (digimon.get("base_stats") or {}).get("lv99") or {}
        col_w = (w - 18) / 2
        for i, key in enumerate(team.STAT_KEYS):
            cx = x + (i % 2) * (col_w + 18)
            cy = y + (i // 2) * 19
            value = stats.get(key, 0) or 0
            draw.text(ctx, key, cx, cy, 10, TEXT_DIM)
            bar_x, bar_w = cx + 30, col_w - 30 - 40
            draw.fill_rounded(ctx, bar_x, cy + 4, bar_w, 5, 2.5, (1, 1, 1, 0.07))
            fill = min(1.0, value / STAT_SCALE.get(key, 2000))
            if fill > 0:
                draw.fill_rounded(ctx, bar_x, cy + 4, max(5, bar_w * fill), 5, 2.5, accent)
            draw.text(ctx, str(value), cx + col_w, cy, 10, TEXT, align="right")
        y += ((len(team.STAT_KEYS) + 1) // 2) * 19 + 10

        y = self._label(ctx, "Evolves into", x, y, w)
        into = self.dex.evolutions(digimon)
        message = " · ".join(d["name"] for d in into) if into else "End of the line. It doesn't evolve further."
        for line in draw.wrap(ctx, message, 11, w):
            draw.text(ctx, line, x, y, 11, TEXT_FAINT)
            y += draw.line_height(11)
        self._end_scroll(ctx, "details", inner, "y", y + 12 - inner.y)

    def _label(self, ctx, value: str, x, y, w) -> float:
        draw.text(ctx, value.upper(), x, y, 9.5, TEXT_FAINT, bold=True, max_width=w)
        return y + 17

    def _requirements(self, ctx, digimon, x, y, w) -> float:
        conditions = digimon.get("evolution_conditions") or []
        if not conditions:
            draw.text(ctx, "No recorded requirements.", x, y, 11, TEXT_FAINT)
            return y + 16
        for i, condition in enumerate(conditions):
            cx = x
            if i:
                cx += draw.text(ctx, "or", cx, y + 5, 10, TEXT_FAINT) + 6
            kind = condition.get("type")
            if kind in ("jogress", "item"):
                cx += draw.text(ctx, CONDITION_LABEL[kind], cx, y + 6, 9, TEXT_FAINT, bold=True) + 6
            for key, value in (condition.get("requirements") or {}).items():
                name, amount = team.short_requirement(key), str(value)
                draw.font(ctx, 11)
                name_w = draw.width(ctx, name + " ")
                draw.font(ctx, 11, True)
                pill_w = min(w, 18 + name_w + draw.width(ctx, amount))
                if cx + pill_w > x + w and cx > x:
                    cx, y = x, y + 28
                draw.fill_rounded(ctx, cx, y, pill_w, 24, 12, (1, 1, 1, 0.04))
                draw.stroke_rounded(ctx, cx, y, pill_w, 24, 12, BORDER)
                used = draw.text(ctx, name + " ", cx + 9, y + 5, 11, TEXT_FAINT, max_width=pill_w - 18)
                draw.text(ctx, amount, cx + 9 + used, y + 5, 11, TEXT, bold=True, max_width=pill_w - 18 - used)
                cx += pill_w + 6
            y += 28
        return y

    # --- sheets ---------------------------------------------------------------------

    def _sheet(self, ctx, rect: Rect, chain) -> None:
        self._block(rect)
        draw.fill_rounded(ctx, rect.x, rect.y, rect.w, rect.h, 12, SHEET)
        draw.stroke_rounded(ctx, rect.x, rect.y, rect.w, rect.h, 12, BORDER_STRONG)
        kind = self.sheet[0]
        members = self.dex.resolve(chain["ids"]) if chain else []
        if kind == "add":
            self._add_sheet(ctx, rect)
        elif kind == "menu" and chain is not None:
            self._menu_sheet(ctx, rect, chain)
        elif kind == "devolve" and members:
            head = members[0]
            self._picker(ctx, rect, f"{head['name']} devolves from…", "Added to the front of the line.",
                         team.prepend_options(chain, self.dex), None,
                         lambda d: self.edit(lambda c: team.prepend(c, self.selected, d["id"])))
        elif kind == "evolve" and members and self.sheet[1] < len(members):
            position = self.sheet[1]
            source = members[position]
            last = position == len(members) - 1
            taken = chain["ids"][position + 1] if position + 1 < len(chain["ids"]) else None
            self._picker(ctx, rect, f"Evolve {source['name']} into…",
                         "Added to the end of the line." if last else "Replaces everything after it.",
                         self.dex.evolutions(source), taken,
                         lambda d: self.edit(lambda c: team.choose_branch(c, self.selected, position, d["id"])))
        else:
            self.sheet = None

    def _sheet_head(self, ctx, rect: Rect, title: str, note: str | None) -> float:
        draw.text(ctx, title, rect.x + 14, rect.y + 12, 15, TEXT, bold=True, max_width=rect.w - 74)
        if note:
            draw.text(ctx, note, rect.x + 14, rect.y + 33, 11, TEXT_DIM, max_width=rect.w - 74)
        self._icon_button(ctx, rect.x + rect.w - 52, rect.y + 8, "close", ("close",), self._close_sheet)
        return rect.y + (58 if note else 52)

    def _close_sheet(self) -> None:
        self.sheet = None

    def _picker(self, ctx, rect: Rect, title, note, options, taken, pick) -> None:
        top = self._sheet_head(ctx, rect, title, note)
        body = Rect(rect.x + 8, top, rect.w - 16, rect.y + rect.h - 8 - top)
        self._begin_scroll(ctx, "sheet", body, "y")
        y = body.y
        for option in options:
            key = ("pick", option["id"])
            is_taken = option["id"] == taken
            # Measures the requirement pills first so the row is as tall as it needs to be.
            probe = cairo.Context(cairo.ImageSurface(cairo.FORMAT_A8, 1, 1))
            reqs_h = self._requirements(probe, option, 0, 0, body.w - 80)
            row_h = max(64, 44 + reqs_h)
            draw.fill_rounded(ctx, body.x, y, body.w, row_h, 10,
                              ACCENT_DIM if self.pressed(key) else ((0.25, 0.82, 1, 0.07) if is_taken else (1, 1, 1, 0.04)))
            draw.stroke_rounded(ctx, body.x, y, body.w, row_h, 10, BORDER_STRONG if is_taken else BORDER)
            self._frame(ctx, option, body.x + 10, y + 8, 48, member=is_taken)
            tx = body.x + 70
            used = draw.text(ctx, option["name"], tx, y + 8, 13, TEXT, bold=True, max_width=body.w - 150)
            if is_taken:
                draw.fill_rounded(ctx, tx + used + 8, y + 9, 52, 16, 8, ACCENT)
                draw.text(ctx, "IN LINE", tx + used + 34, y + 11, 8.5, ON_ACCENT, bold=True, align="center")
            meta = f"{option.get('attribute', '')} · {team.generation_short(option.get('generation', ''))}"
            if option.get("base_personality"):
                meta += f" · {option['base_personality']}"
            draw.text(ctx, meta, tx, y + 26, 10.5, TEXT_DIM, max_width=body.w - 80)
            self._requirements(ctx, option, tx, y + 42, body.w - 80)
            self._hit(body.x, y, body.w, row_h, key, lambda d=option: (pick(d), self._close_sheet()))
            y += row_h + 6
        self._end_scroll(ctx, "sheet", body, "y", y - body.y)

    def _menu_sheet(self, ctx, rect: Rect, chain) -> None:
        index = self.selected
        top = self._sheet_head(ctx, rect, f"Line {index + 1}", None)
        x, w, y = rect.x + 10, rect.w - 20, top
        locked = chain.get("locked")

        def item(label, icon_name, key, action, enabled=True, danger=False, armed=False):
            nonlocal y
            background = DANGER if armed else (ACCENT_DIM if self.pressed(key) else (1, 1, 1, 0.05))
            draw.fill_rounded(ctx, x, y, w, 48, 10, background)
            fg = ON_ACCENT if armed else (DANGER if danger else TEXT)
            if not enabled:
                fg = TEXT_FAINT
            draw.icon(ctx, icon_name, x + 24, y + 24, 18, fg)
            draw.text(ctx, label, x + 44, y + 16, 13, fg, max_width=w - 56)
            if enabled:
                self._hit(x, y, w, 48, key, action)
            y += 54

        item("Unlock (allow edits)" if locked else "Lock (keep through a random reroll)", "lock", ("lock",),
             lambda: (self.edit(lambda c: team.toggle_lock(c, index)), self._close_sheet()))
        item("Move up", "up", ("up",), lambda: (self.edit(lambda c: team.move(c, index, -1)), self.select(index - 1)),
             enabled=index > 0)
        item("Move down", "down", ("down",),
             lambda: (self.edit(lambda c: team.move(c, index, 1)), self.select(index + 1)),
             enabled=index < len(self.chains) - 1)
        armed = self.is_armed("line")
        item("Tap again to remove the line" if armed else "Remove line", "trash", ("remove-line",),
             lambda: self.press_armed("line", lambda: (self.edit(lambda c: team.remove_chain(c, index)),
                                                       self.select(max(0, index - 1)))),
             danger=True, armed=armed)

    def _add_sheet(self, ctx, rect: Rect) -> None:
        top = self._sheet_head(ctx, rect, "Start a new line with…", "Pick a stage, then a Digimon.")
        gens = Rect(rect.x + 8, top, rect.w - 16, 34)
        self._begin_scroll(ctx, "gens", gens, "x")
        x = gens.x
        for generation in [None, *team.GENERATIONS]:
            label = "All" if generation is None else team.generation_short(generation)
            x = self._chip(ctx, x, gens.y + 3, label, None, ("gen", generation),
                           lambda g=generation: (setattr(self, "generation", g), self.offsets.pop("sheet", None)),
                           on=self.generation == generation, align="left") + 6
        self._end_scroll(ctx, "gens", gens, "x", x - gens.x)

        body = Rect(rect.x + 8, gens.y + gens.h + 6, rect.w - 16, rect.y + rect.h - 8 - (gens.y + gens.h + 6))
        entries = self.dex.of_generation(self.generation)
        columns = max(1, int(body.w // 82))
        cell_w = body.w / columns
        cell_h = 94
        offset = self._begin_scroll(ctx, "sheet", body, "y")
        first = max(0, int(offset // cell_h) * columns)
        last = min(len(entries), int((offset + body.h) // cell_h + 1) * columns + columns)
        # Only the visible rows are drawn; the dataset has 475 entries.
        for i in range(first, last):
            digimon = entries[i]
            cx = body.x + (i % columns) * cell_w
            cy = body.y + (i // columns) * cell_h
            key = ("add", digimon["id"])
            if self.pressed(key):
                draw.fill_rounded(ctx, cx + 2, cy, cell_w - 4, cell_h - 4, 10, ACCENT_DIM)
            self._frame(ctx, digimon, cx + (cell_w - 62) / 2, cy + 6, 62, badge=True)
            draw.text(ctx, digimon["name"], cx + cell_w / 2, cy + 72, 10, TEXT_DIM, max_width=cell_w - 6, align="center")
            self._hit(cx, cy, cell_w, cell_h, key, lambda d=digimon: self._add_line(d["id"]))
        rows = (len(entries) + columns - 1) // columns
        self._end_scroll(ctx, "sheet", body, "y", rows * cell_h)

    def _add_line(self, digimon_id: int) -> None:
        self.edit(lambda c: team.add_chain(c, digimon_id))
        self.select(len(self.chains) - 1)

    # --- widgets ----------------------------------------------------------------------

    def _sprite(self, ctx, digimon, x, y, size) -> None:
        image = self.sprites.get(digimon["id"], max(1, round(size * self.scale)))
        if image is None:
            initials = "".join(part[0] for part in digimon["name"].split()[:2]).upper()
            draw.text(ctx, initials, x + size / 2, y + size / 2 - size * 0.18, size * 0.32, TEXT_DIM, bold=True,
                      align="center")
            return
        self._image(ctx, image, x, y, size)

    def _image(self, ctx, image, x, y, size) -> None:
        ctx.save()
        ctx.translate(x, y)
        factor = size / max(image.get_width(), image.get_height())
        ctx.scale(factor, factor)
        ctx.set_source_surface(image, 0, 0)
        ctx.get_source().set_filter(cairo.FILTER_GOOD)
        ctx.paint()
        ctx.restore()

    def _frame(self, ctx, digimon, x, y, size, member=True, current=False, badge=False, ring=False, pressed=False):
        accent = draw.attribute_color(digimon.get("attribute"))
        if ring:
            draw.fill_rounded(ctx, x - 4, y - 4, size + 8, size + 8, 11, TEXT)
            draw.fill_rounded(ctx, x - 2, y - 2, size + 4, size + 4, 9, BG)
        ctx.save()
        draw.rounded(ctx, x, y, size, size, 8)
        ctx.clip()
        if member:
            wash = cairo.LinearGradient(x, y, x + size * 0.35, y + size)
            wash.add_color_stop_rgba(0, *accent, 0.22)
            wash.add_color_stop_rgba(1, 0.04, 0.06, 0.09, 0.9)
            ctx.set_source(wash)
        else:
            draw.color(ctx, PANEL_RAISED)
        ctx.paint()
        inset = size * 0.04
        self._sprite(ctx, digimon, x + inset, y + inset, size - 2 * inset)
        if badge:
            label = team.generation_short(digimon.get("generation", ""))
            fs = size * 0.14
            pad = size * 0.05
            bh = fs * 1.5
            draw.font(ctx, fs, True)
            bw = draw.width(ctx, label) + 2 * pad
            ctx.rectangle(x, y + size - bh, bw, bh)
            draw.color(ctx, accent)
            ctx.fill()
            draw.text_at_baseline(ctx, label, x + pad, y + size - bh * 0.27, fs, ON_ACCENT, bold=True)
            if current:
                draw.font(ctx, fs, True)
                nw = draw.width(ctx, "NOW") + 2 * pad
                ctx.rectangle(x + size - nw, y, nw, bh)
                draw.color(ctx, ACCENT)
                ctx.fill()
                draw.text_at_baseline(ctx, "NOW", x + size - nw + pad, y + bh * 0.73, fs, ON_ACCENT, bold=True)
        if pressed:
            draw.color(ctx, (1, 1, 1, 0.12))
            ctx.paint()
        ctx.restore()
        draw.stroke_rounded(ctx, x, y, size, size, 8, accent if member else BORDER, 1.2)
        if current:
            draw.stroke_rounded(ctx, x, y, size, size, 8, ACCENT, 2.4)

    def _button(self, ctx, x, y, w, label, icon_name, key, action, primary=False, danger=False, armed=False) -> float:
        """A 40-unit-tall text button; returns its right edge."""
        draw.font(ctx, 12, True)
        w = w or draw.width(ctx, label) + 50
        if armed:
            background, border, fg = DANGER, DANGER, ON_ACCENT
        elif self.pressed(key):
            background, border, fg = ACCENT, ACCENT, ON_ACCENT
        elif primary:
            background, border, fg = ACCENT_DIM, ACCENT, TEXT
        else:
            background, border, fg = (1, 1, 1, 0.07), BORDER, DANGER if danger else TEXT
        draw.fill_rounded(ctx, x, y, w, 40, 9, background)
        draw.stroke_rounded(ctx, x, y, w, 40, 9, border, 1.2)
        draw.icon(ctx, icon_name, x + 20, y + 20, 15, fg)
        draw.text(ctx, label, x + 34, y + 12, 12, fg, bold=True, max_width=w - 42)
        self._hit(x, y, w, 40, key, action)
        return x + w

    def _icon_button(self, ctx, x, y, icon_name, key, action) -> None:
        draw.fill_rounded(ctx, x, y, 44, 44, 10, ACCENT_DIM if self.pressed(key) else (1, 1, 1, 0.06))
        draw.icon(ctx, icon_name, x + 22, y + 22, 20, TEXT if self.pressed(key) else TEXT_DIM)
        self._hit(x, y, 44, 44, key, action)

    def _chip(self, ctx, x, y, label, icon_name, key, action, on=False, align="center") -> float:
        """A pill 28 units tall; `x` is its centre unless align is "left". Returns its right edge."""
        draw.font(ctx, 10.5)
        w = draw.width(ctx, label) + (36 if icon_name else 22)
        left = x - w / 2 if align == "center" else x
        if self.pressed(key):
            background, border, fg = ACCENT, ACCENT, ON_ACCENT
        elif on:
            background, border, fg = ACCENT_DIM, ACCENT, TEXT
        else:
            background, border, fg = (1, 1, 1, 0.05), BORDER, TEXT_DIM
        draw.fill_rounded(ctx, left, y, w, 28, 14, background)
        draw.stroke_rounded(ctx, left, y, w, 28, 14, border)
        tx = left + 11
        if icon_name:
            draw.icon(ctx, icon_name, left + 17, y + 14, 12, fg)
            tx = left + 26
        draw.text(ctx, label, tx, y + 8, 10.5, fg)
        self._hit(left, y - 4, w, 36, key, action)
        return left + w
