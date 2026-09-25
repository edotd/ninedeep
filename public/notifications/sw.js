self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
    const openClient = clients.find((client) => 'focus' in client);
    return openClient ? openClient.focus() : self.clients.openWindow(event.notification.data?.url || '/');
  }));
});
