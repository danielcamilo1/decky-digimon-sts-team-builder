"""The plugin's WebP sprites as cairo surfaces, scaled once to the size they're drawn at.

Cairo can't read WebP, so decoding goes through GdkPixbuf when it has a WebP loader and
otherwise straight to libwebp. Both give straight (not premultiplied) alpha, which cairo's
mask operation turns into its premultiplied format without a per-pixel Python loop.
"""

from __future__ import annotations

import ctypes as C
import os
from collections import OrderedDict

import cairo

CACHE_SIZE = 160


def _from_straight_alpha(width: int, height: int, bgra: bytearray, stride: int) -> cairo.ImageSurface:
    """A premultiplied ARGB32 surface from straight-alpha BGRA bytes (cairo's byte order)."""
    color = cairo.ImageSurface.create_for_data(bgra, cairo.FORMAT_RGB24, width, height, stride)
    alpha_stride = cairo.ImageSurface.format_stride_for_width(cairo.FORMAT_A8, width)
    alpha = bytearray(alpha_stride * height)
    for row in range(height):
        alpha[row * alpha_stride: row * alpha_stride + width] = bgra[row * stride + 3: row * stride + width * 4: 4]
    mask = cairo.ImageSurface.create_for_data(alpha, cairo.FORMAT_A8, width, height, alpha_stride)
    out = cairo.ImageSurface(cairo.FORMAT_ARGB32, width, height)
    ctx = cairo.Context(out)
    ctx.set_source_surface(color, 0, 0)
    ctx.mask_surface(mask, 0, 0)
    out.flush()
    return out


class _Libwebp:
    def __init__(self):
        lib = None
        for name in ("libwebp.so.7", "libwebp.so"):
            try:
                lib = C.CDLL(name)
                break
            except OSError:
                continue
        if lib is None:
            raise OSError("libwebp not found")
        lib.WebPGetInfo.argtypes = [C.c_char_p, C.c_size_t, C.POINTER(C.c_int), C.POINTER(C.c_int)]
        lib.WebPDecodeBGRAInto.argtypes = [C.c_char_p, C.c_size_t, C.c_void_p, C.c_size_t, C.c_int]
        lib.WebPDecodeBGRAInto.restype = C.c_void_p
        self._lib = lib

    def decode(self, data: bytes) -> cairo.ImageSurface | None:
        width, height = C.c_int(), C.c_int()
        if not self._lib.WebPGetInfo(data, len(data), C.byref(width), C.byref(height)):
            return None
        w, h = width.value, height.value
        stride = w * 4
        buffer = (C.c_ubyte * (stride * h))()
        if not self._lib.WebPDecodeBGRAInto(data, len(data), buffer, len(buffer), stride):
            return None
        return _from_straight_alpha(w, h, bytearray(buffer), stride)


class _Pixbuf:
    def __init__(self):
        import gi

        gi.require_version("GdkPixbuf", "2.0")
        from gi.repository import GdkPixbuf

        if not any("webp" in (f.get_name() or "") for f in GdkPixbuf.Pixbuf.get_formats()):
            raise OSError("GdkPixbuf has no WebP loader")
        self._GdkPixbuf = GdkPixbuf

    def decode(self, data: bytes) -> cairo.ImageSurface | None:
        loader = self._GdkPixbuf.PixbufLoader()
        loader.write(data)
        loader.close()
        pixbuf = loader.get_pixbuf()
        if pixbuf is None:
            return None
        if not pixbuf.get_has_alpha():
            pixbuf = pixbuf.add_alpha(False, 0, 0, 0)
        w, h, stride = pixbuf.get_width(), pixbuf.get_height(), pixbuf.get_rowstride()
        rgba = pixbuf.get_pixels()
        # RGBA to cairo's BGRA, one channel at a time.
        bgra = bytearray(w * 4 * h)
        for row in range(h):
            src = rgba[row * stride: row * stride + w * 4]
            dst = bytearray(w * 4)
            dst[0::4], dst[1::4], dst[2::4], dst[3::4] = src[2::4], src[1::4], src[0::4], src[3::4]
            bgra[row * w * 4: (row + 1) * w * 4] = dst
        return _from_straight_alpha(w, h, bgra, w * 4)


def _decoder():
    for factory in (_Pixbuf, _Libwebp):
        try:
            return factory()
        except (ImportError, ValueError, OSError, AttributeError):
            continue
    return None


class Sprites:
    def __init__(self, assets_dir: str):
        self._dir = os.path.join(assets_dir, "digimon")
        self._attributes = os.path.join(assets_dir, "attributes")
        self._decoder = _decoder()
        self._sources: OrderedDict = OrderedDict()
        self._scaled: OrderedDict = OrderedDict()
        self._icons: dict = {}

    @property
    def available(self) -> bool:
        return self._decoder is not None

    def get(self, digimon_id: int, size_px: int) -> cairo.ImageSurface | None:
        """The sprite at `size_px` square, or None when it can't be decoded (a placeholder is drawn)."""
        key = (digimon_id, size_px)
        if key in self._scaled:
            self._scaled.move_to_end(key)
            return self._scaled[key]
        source = self._source(digimon_id)
        if source is None:
            return None
        scaled = cairo.ImageSurface(cairo.FORMAT_ARGB32, size_px, size_px)
        ctx = cairo.Context(scaled)
        factor = size_px / max(source.get_width(), source.get_height())
        ctx.scale(factor, factor)
        ctx.set_source_surface(source, 0, 0)
        ctx.get_source().set_filter(cairo.FILTER_GOOD)
        ctx.paint()
        scaled.flush()
        self._scaled[key] = scaled
        if len(self._scaled) > CACHE_SIZE:
            self._scaled.popitem(last=False)
        return scaled

    def _source(self, digimon_id: int) -> cairo.ImageSurface | None:
        if digimon_id in self._sources:
            return self._sources[digimon_id]
        surface = None
        if self._decoder is not None:
            try:
                with open(os.path.join(self._dir, f"{int(digimon_id)}.webp"), "rb") as handle:
                    surface = self._decoder.decode(handle.read())
            except (OSError, ValueError):
                surface = None
        self._sources[digimon_id] = surface
        # The 256 px sources are only kept long enough to scale the visible ones.
        if len(self._sources) > 48:
            self._sources.popitem(last=False)
        return surface

    def attribute(self, filename: str) -> cairo.ImageSurface | None:
        if filename not in self._icons:
            try:
                self._icons[filename] = cairo.ImageSurface.create_from_png(os.path.join(self._attributes, filename))
            except (OSError, cairo.Error, MemoryError):
                self._icons[filename] = None
        return self._icons[filename]
