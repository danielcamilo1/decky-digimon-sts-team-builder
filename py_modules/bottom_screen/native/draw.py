"""Drawing primitives on cairo: the Steam UI's colours, rounded shapes and single-line text.

Text uses cairo's own font selection rather than Pango, so the renderer needs nothing
beyond pycairo; fontconfig picks the system's sans-serif face.
"""

from __future__ import annotations

import math

import cairo


def hex_rgb(value: str) -> tuple:
    value = value.lstrip("#")
    return tuple(int(value[i:i + 2], 16) / 255 for i in (0, 2, 4))


# src/ui/theme.ts, flattened onto the page background where the original is translucent.
BG = hex_rgb("#0b1017")
PANEL = hex_rgb("#141c26")
PANEL_RAISED = hex_rgb("#1f2a38")
SHEET = hex_rgb("#0e151e")
BORDER = (1, 1, 1, 0.10)
BORDER_STRONG = (1, 1, 1, 0.22)
TEXT = hex_rgb("#e9eef5")
TEXT_DIM = hex_rgb("#93a1b3")
TEXT_FAINT = hex_rgb("#63718a")
ACCENT = hex_rgb("#3fd0ff")
ACCENT_DIM = (*ACCENT, 0.16)
ON_ACCENT = hex_rgb("#04121a")
DANGER = hex_rgb("#ff6b6b")
LOCKED = hex_rgb("#ffc65a")

ATTRIBUTE_COLORS = {
    "Vaccine": hex_rgb("#5aa9ff"), "Data": hex_rgb("#3ddc97"), "Virus": hex_rgb("#b96bff"),
    "Free": hex_rgb("#ffc65a"), "Variable": hex_rgb("#ff7fb8"), "Unknown": hex_rgb("#8a94a6"),
    "No Data": hex_rgb("#8a94a6"),
}
ATTRIBUTE_ICONS = {
    "Vaccine": "vaccine.png", "Data": "data.png", "Virus": "virus.png", "Free": "free.png",
    "Variable": "variable.png", "Unknown": "unknown.png", "No Data": "no-data.png",
}

FONT = "sans-serif"
# Cairo's own text API doesn't fall back between fonts, and the usual default (Noto Sans)
# lacks the arrows and comparison signs the dataset uses. Characters the main face can't
# draw come from these, or failing that from an ASCII stand-in.
FALLBACK_FONTS = ("DejaVu Sans", "Noto Sans Math", "Noto Sans Symbols")
ASCII = {"→": "->", "≥": ">=", "≤": "<=", "…": "...", "·": "-", "×": "x", "★": "*"}
_has_glyph: dict = {}


def attribute_color(attribute: str) -> tuple:
    return ATTRIBUTE_COLORS.get(attribute, ATTRIBUTE_COLORS["Unknown"])


def color(ctx: cairo.Context, rgba: tuple) -> None:
    if len(rgba) == 4:
        ctx.set_source_rgba(*rgba)
    else:
        ctx.set_source_rgb(*rgba)


def rounded(ctx: cairo.Context, x: float, y: float, w: float, h: float, r: float) -> None:
    r = max(0.0, min(r, w / 2, h / 2))
    ctx.new_sub_path()
    ctx.arc(x + w - r, y + r, r, -math.pi / 2, 0)
    ctx.arc(x + w - r, y + h - r, r, 0, math.pi / 2)
    ctx.arc(x + r, y + h - r, r, math.pi / 2, math.pi)
    ctx.arc(x + r, y + r, r, math.pi, 3 * math.pi / 2)
    ctx.close_path()


def fill_rounded(ctx, x, y, w, h, r, rgba) -> None:
    rounded(ctx, x, y, w, h, r)
    color(ctx, rgba)
    ctx.fill()


def stroke_rounded(ctx, x, y, w, h, r, rgba, width: float = 1.0, dash: bool = False) -> None:
    rounded(ctx, x + width / 2, y + width / 2, w - width, h - width, r)
    color(ctx, rgba)
    ctx.set_line_width(width)
    ctx.set_dash([4, 3] if dash else [])
    ctx.stroke()
    ctx.set_dash([])


def font(ctx: cairo.Context, size: float, bold: bool = False, family: str = FONT) -> None:
    ctx.select_font_face(family, cairo.FONT_SLANT_NORMAL, cairo.FONT_WEIGHT_BOLD if bold else cairo.FONT_WEIGHT_NORMAL)
    ctx.set_font_size(size)


def _covers(family: str, char: str) -> bool:
    key = (family, char)
    if key not in _has_glyph:
        probe = cairo.Context(cairo.ImageSurface(cairo.FORMAT_A8, 1, 1))
        probe.select_font_face(family)
        probe.set_font_size(12)
        glyphs = probe.get_scaled_font().text_to_glyphs(0, 0, char, False)
        _has_glyph[key] = bool(glyphs) and all(g.index != 0 for g in glyphs)
    return _has_glyph[key]


def _runs(ctx: cairo.Context, text: str) -> list:
    """`text` as (family, string) runs, each drawable by its family."""
    runs = []
    for char in text:
        family = FONT
        if not char.isascii() and not _covers(FONT, char):
            family = next((f for f in FALLBACK_FONTS if _covers(f, char)), None)
            if family is None:
                family, char = FONT, ASCII.get(char, "?")
        if runs and runs[-1][0] == family:
            runs[-1][1] += char
        else:
            runs.append([family, char])
    return runs


def _font_state(ctx: cairo.Context) -> tuple:
    face = ctx.get_font_face()
    weight = face.get_weight() if isinstance(face, cairo.ToyFontFace) else cairo.FONT_WEIGHT_NORMAL
    return ctx.get_font_matrix().xx, weight


def width(ctx: cairo.Context, text: str) -> float:
    size, weight = _font_state(ctx)
    total = 0.0
    for family, run in _runs(ctx, text):
        ctx.select_font_face(family, cairo.FONT_SLANT_NORMAL, weight)
        ctx.set_font_size(size)
        total += ctx.text_extents(run).x_advance
    ctx.select_font_face(FONT, cairo.FONT_SLANT_NORMAL, weight)
    ctx.set_font_size(size)
    return total


def _show(ctx: cairo.Context, text: str) -> None:
    """Draws at the current point, switching faces for characters the main one lacks."""
    size, weight = _font_state(ctx)
    for family, run in _runs(ctx, text):
        ctx.select_font_face(family, cairo.FONT_SLANT_NORMAL, weight)
        ctx.set_font_size(size)
        ctx.show_text(run)
    ctx.select_font_face(FONT, cairo.FONT_SLANT_NORMAL, weight)
    ctx.set_font_size(size)


def fit(ctx: cairo.Context, text: str, max_width: float) -> str:
    """`text`, cut with an ellipsis if it's wider than `max_width` in the current font."""
    if max_width <= 0:
        return ""
    if width(ctx, text) <= max_width:
        return text
    low, high = 0, len(text)
    while low < high:
        middle = (low + high + 1) // 2
        if width(ctx, text[:middle].rstrip() + "…") <= max_width:
            low = middle
        else:
            high = middle - 1
    return text[:low].rstrip() + "…"


def text(ctx: cairo.Context, value: str, x: float, y: float, size: float, rgba: tuple = TEXT,
         bold: bool = False, max_width: float | None = None, align: str = "left") -> float:
    """Draws one line with its top at `y`; returns its width."""
    font(ctx, size, bold)
    if max_width is not None:
        value = fit(ctx, value, max_width)
    advance = width(ctx, value)
    ascent = ctx.font_extents()[0]
    if align == "center":
        x -= advance / 2
    elif align == "right":
        x -= advance
    color(ctx, rgba)
    ctx.move_to(x, y + ascent)
    _show(ctx, value)
    return advance


def text_at_baseline(ctx: cairo.Context, value: str, x: float, baseline: float, size: float, rgba: tuple,
                     bold: bool = False) -> float:
    """Draws one line sitting on `baseline`, for text placed against an edge."""
    font(ctx, size, bold)
    color(ctx, rgba)
    ctx.move_to(x, baseline)
    _show(ctx, value)
    return width(ctx, value)


def wrap(ctx: cairo.Context, value: str, size: float, max_width: float, bold: bool = False) -> list:
    """Splits `value` into lines no wider than `max_width`."""
    font(ctx, size, bold)
    lines, line = [], ""
    for word in value.split():
        candidate = f"{line} {word}".strip()
        if line and width(ctx, candidate) > max_width:
            lines.append(line)
            line = word
        else:
            line = candidate
    if line:
        lines.append(line)
    return lines


def line_height(size: float) -> float:
    return size * 1.3


# --- icons, drawn as strokes in a 24-unit box like src/ui/icons.tsx ----------------------


def _icon_box(ctx, cx, cy, size):
    ctx.save()
    ctx.translate(cx - size / 2, cy - size / 2)
    ctx.scale(size / 24, size / 24)
    ctx.set_line_width(2)
    ctx.set_line_cap(cairo.LINE_CAP_ROUND)
    ctx.set_line_join(cairo.LINE_JOIN_ROUND)


def icon(ctx: cairo.Context, name: str, cx: float, cy: float, size: float, rgba: tuple = TEXT) -> None:
    _icon_box(ctx, cx, cy, size)
    color(ctx, rgba)
    if name == "plus":
        ctx.move_to(12, 5); ctx.line_to(12, 19); ctx.move_to(5, 12); ctx.line_to(19, 12); ctx.stroke()
    elif name == "close":
        ctx.move_to(6, 6); ctx.line_to(18, 18); ctx.move_to(18, 6); ctx.line_to(6, 18); ctx.stroke()
    elif name == "dots":
        for y in (5, 12, 19):
            ctx.arc(12, y, 2, 0, 2 * math.pi); ctx.fill()
    elif name == "flag":
        ctx.move_to(6, 21); ctx.line_to(6, 4); ctx.stroke()
        ctx.move_to(6, 4); ctx.line_to(17, 4); ctx.line_to(14.8, 8); ctx.line_to(17, 12); ctx.line_to(6, 12)
        ctx.close_path(); ctx.fill()
    elif name == "lock":
        rounded(ctx, 4, 9, 16, 12, 1.5); ctx.fill()
        ctx.set_line_width(2.4)
        ctx.arc(12, 7.5, 4, math.pi, 0); ctx.line_to(16, 9.5); ctx.move_to(8, 7.5); ctx.line_to(8, 9.5); ctx.stroke()
    elif name == "trash":
        ctx.move_to(4, 7); ctx.line_to(20, 7); ctx.move_to(9, 7); ctx.line_to(9, 5); ctx.line_to(15, 5)
        ctx.line_to(15, 7); ctx.move_to(6, 7); ctx.line_to(7, 20); ctx.line_to(17, 20); ctx.line_to(18, 7); ctx.stroke()
    elif name == "edit":
        ctx.move_to(4, 20); ctx.line_to(8, 20); ctx.line_to(19, 9); ctx.line_to(15, 5); ctx.line_to(4, 16)
        ctx.close_path(); ctx.move_to(13, 7); ctx.line_to(17, 11); ctx.stroke()
    elif name == "dice":
        rounded(ctx, 3, 3, 18, 18, 3); ctx.stroke()
        for x, y in ((8.5, 8.5), (15.5, 15.5), (15.5, 8.5), (8.5, 15.5)):
            ctx.arc(x, y, 1.3, 0, 2 * math.pi); ctx.fill()
    elif name == "up":
        ctx.move_to(12, 19); ctx.line_to(12, 5); ctx.move_to(6, 11); ctx.line_to(12, 5); ctx.line_to(18, 11); ctx.stroke()
    elif name == "down":
        ctx.move_to(12, 5); ctx.line_to(12, 19); ctx.move_to(6, 13); ctx.line_to(12, 19); ctx.line_to(18, 13); ctx.stroke()
    elif name == "chevron":
        ctx.move_to(9, 6); ctx.line_to(15, 12); ctx.line_to(9, 18); ctx.stroke()
    ctx.restore()
