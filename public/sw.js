/* eslint-disable no-undef */

// Self-destructing service worker.
//
// The previous version of this file used a cache-first strategy with no
// dev-mode guard, which pinned stale JS/HTML chunks until a hard reload.
// This replacement unregisters itself and wipes all caches as soon as the
// browser picks it up. Browsers re-fetch sw.js on every navigation to check
// for updates, so any client running the old worker will swap to this one
// on their next page load and then lose the worker entirely.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((name) => caches.delete(name)));
      await self.registration.unregister();
      const clients = await self.clients.matchAll({ type: "window" });
      clients.forEach((client) => client.navigate(client.url));
    })(),
  );
});
