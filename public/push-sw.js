self.addEventListener('push', (event) => {
  let payload;
  try { payload = event.data?.json(); } catch { payload = null; }
  const notification = payload?.notification ?? payload;
  event.waitUntil(self.registration.showNotification('ZIPFIT', {
    body: typeof notification?.message === 'string' ? notification.message : '새 알림이 도착했어요.',
    tag: notification?.notificationId ? `zipfit-${notification.notificationId}` : undefined,
  }));
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const url = new URL('/notifications', self.location.origin).href;
    const tabs = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const tab = tabs.find((client) => new URL(client.url).origin === self.location.origin);
    if (tab) { await tab.navigate(url); await tab.focus(); }
    else await self.clients.openWindow(url);
  })());
});
