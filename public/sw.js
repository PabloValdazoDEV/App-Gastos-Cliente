const DEFAULT_RELATED_PATH = '/notificaciones';

function safeRelatedPath(value) {
  if (
    typeof value !== 'string' ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('\\')
  ) {
    return DEFAULT_RELATED_PATH;
  }

  try {
    const url = new URL(value, self.location.origin);
    if (url.origin !== self.location.origin) return DEFAULT_RELATED_PATH;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return DEFAULT_RELATED_PATH;
  }
}

self.addEventListener('push', (event) => {
  let payload = {};

  try {
    payload = event.data?.json() ?? {};
  } catch {
    payload = { message: event.data?.text() ?? '' };
  }

  const title = payload.title || 'BudgetApp';
  const requestedPath = payload.relatedPath ?? payload.path;
  const relatedPath = safeRelatedPath(requestedPath);

  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.message || payload.body || 'Tienes un nuevo recordatorio.',
      data: { relatedPath },
      tag: payload.tag || undefined,
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const relatedPath = safeRelatedPath(event.notification.data?.relatedPath);
  const targetUrl = new URL(relatedPath, self.location.origin).href;

  event.waitUntil(
    self.clients
      .matchAll({ includeUncontrolled: true, type: 'window' })
      .then((windowClients) => {
        const matchingClient = windowClients.find((client) => client.url === targetUrl);

        if (matchingClient) {
          return matchingClient.focus();
        }

        const appClient = windowClients.find((client) => {
          try {
            return new URL(client.url).origin === self.location.origin;
          } catch {
            return false;
          }
        });

        if (appClient) {
          const navigation =
            typeof appClient.navigate === 'function'
              ? appClient.navigate(targetUrl).catch(() => appClient)
              : Promise.resolve(appClient);

          return navigation.then((client) => (client ?? appClient).focus());
        }

        return self.clients.openWindow(targetUrl);
      }),
  );
});
