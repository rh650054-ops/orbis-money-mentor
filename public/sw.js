// Kill-switch service worker.
// Replaces the previous vite-plugin-pwa worker that was caching a broken
// build of the published Orbis app. On install it activates immediately,
// claims all clients, deletes every cache, navigates open tabs to a fresh
// URL, and unregisters itself. After this rolls out for one cycle, the
// file can be removed.
self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    try {
      await self.clients.claim();
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((name) => caches.delete(name)));
      const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      await Promise.all(clients.map((client) => {
        try {
          const url = new URL(client.url);
          url.searchParams.set("sw-cleanup", Date.now().toString());
          return client.navigate(url.toString());
        } catch (e) {
          return Promise.resolve();
        }
      }));
      await self.registration.unregister();
    } catch (e) {
      // Best-effort cleanup; swallow errors so install never blocks.
    }
  })());
});

// Pass through every fetch to the network, no caching.
self.addEventListener("fetch", () => {});
