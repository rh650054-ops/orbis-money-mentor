// Kill-switch service worker.
// Cleans up the previous vite-plugin-pwa worker that was caching a broken
// build of the published Orbis app. On activate it claims clients, deletes
// every cache, and unregisters itself. It only forces a navigation reload
// when there were actually caches to clear, so brand-new visitors do not
// get stuck in a register → navigate → reload loop.
self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    try {
      await self.clients.claim();
      const cacheNames = await caches.keys();
      const hadCaches = cacheNames.length > 0;
      await Promise.all(cacheNames.map((name) => caches.delete(name)));

      if (hadCaches) {
        const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
        await Promise.all(clients.map((client) => {
          try {
            const url = new URL(client.url);
            if (url.searchParams.has("sw-cleanup")) return Promise.resolve();
            url.searchParams.set("sw-cleanup", Date.now().toString());
            return client.navigate(url.toString());
          } catch (e) {
            return Promise.resolve();
          }
        }));
      }

      await self.registration.unregister();
    } catch (e) {
      // Best-effort cleanup; swallow errors so install never blocks.
    }
  })());
});

// Pass through every fetch to the network, no caching.
self.addEventListener("fetch", () => {});
