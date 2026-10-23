"""The team builder on a second, touch screen — the AYN Thor's bottom panel under Armada OS.

The backend half lives here and runs inside Decky: it finds the panel, starts the renderer
in `native/` as a user service, and serves it the team. The renderer itself runs on the
system's own Python, outside Decky, and draws straight to the panel through a DRM lease.
"""
