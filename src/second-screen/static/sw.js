// Chrome only offers to install a page that registers a service worker. This one adds
// nothing else: everything comes from the plugin over loopback, and the page is useless
// while the plugin isn't serving it, so there's nothing worth caching for offline use.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
