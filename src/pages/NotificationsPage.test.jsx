import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { http } from '../api/client';
import { NotificationsPage } from './NotificationsPage';

vi.mock('../api/client', () => ({
  http: {
    delete: vi.fn(),
    get: vi.fn(),
    patch: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock('../config/env', () => ({
  publicEnv: {
    enableWebPush: true,
    vapidPublicKey: 'AQIDBA',
  },
}));

const notification = {
  id: '10000000-0000-4000-8000-000000000001',
  title: 'Seguro próximo',
  message: 'El seguro del hogar vence dentro de siete días.',
  relatedPath: '/gastos/recurrentes',
  readAt: null,
  createdAt: '2026-08-26T12:00:00.000Z',
  deliveries: [{ channel: 'IN_APP', status: 'SENT' }],
  recurringExpense: { name: 'Seguro del hogar' },
};

const preferences = {
  id: '10000000-0000-4000-8000-000000000002',
  inAppEnabled: true,
  emailEnabled: true,
  webPushEnabled: false,
  defaultOffsets: [30, 7, 1],
};

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });

  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <NotificationsPage />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe('NotificationsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete window.Notification;
    delete window.PushManager;
    delete navigator.serviceWorker;
    http.get.mockImplementation((url) => {
      if (url === '/notification-preferences') return Promise.resolve(preferences);
      if (url.includes('unreadOnly=true')) return Promise.resolve([notification]);
      if (url.startsWith('/notifications')) return Promise.resolve([notification]);
      return Promise.resolve([]);
    });
  });

  it('muestra avisos reales y permite marcar uno como leído', async () => {
    const user = userEvent.setup();
    http.patch.mockImplementation((url) => {
      if (url.endsWith('/read')) {
        return Promise.resolve({ ...notification, readAt: '2026-08-26T13:00:00.000Z' });
      }
      return Promise.resolve(preferences);
    });

    renderPage();
    expect(await screen.findByText('Seguro próximo')).toBeInTheDocument();
    expect(screen.getByText('Tienes 1 aviso sin leer.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Marcar como leída' }));

    await waitFor(() =>
      expect(http.patch).toHaveBeenCalledWith(
        `/notifications/${notification.id}/read`,
        {},
      ),
    );
    expect(await screen.findByText('Leída')).toBeInTheDocument();
  });

  it('guarda canales y antelaciones validadas', async () => {
    const user = userEvent.setup();
    http.patch.mockResolvedValue({
      ...preferences,
      emailEnabled: false,
      defaultOffsets: [30, 7],
    });

    renderPage();
    await screen.findByText('Preferencias');
    await user.click(
      screen.getByRole('checkbox', { name: /Correo electrónico/i }),
    );
    await user.click(screen.getByRole('checkbox', { name: '1 día antes' }));
    await user.click(screen.getByRole('button', { name: 'Guardar preferencias' }));

    await waitFor(() =>
      expect(http.patch).toHaveBeenCalledWith('/notification-preferences', {
        defaultOffsets: [30, 7],
        emailEnabled: false,
        inAppEnabled: true,
        webPushEnabled: false,
      }),
    );
  });

  it('diseña explícitamente el estado vacío', async () => {
    http.get.mockImplementation((url) => {
      if (url === '/notification-preferences') return Promise.resolve(preferences);
      return Promise.resolve([]);
    });

    renderPage();

    expect(
      await screen.findByRole('heading', { name: 'No tienes notificaciones' }),
    ).toBeInTheDocument();
    expect(screen.getByText('No tienes avisos pendientes de leer.')).toBeInTheDocument();
  });

  it('no convierte destinos externos en enlaces navegables', async () => {
    const unsafeNotification = {
      ...notification,
      id: '10000000-0000-4000-8000-000000000099',
      relatedPath: '//evil.example/path',
    };
    http.get.mockImplementation((url) => {
      if (url === '/notification-preferences') return Promise.resolve(preferences);
      if (url.includes('unreadOnly=true')) return Promise.resolve([unsafeNotification]);
      if (url.startsWith('/notifications')) return Promise.resolve([unsafeNotification]);
      return Promise.resolve([]);
    });

    renderPage();

    expect(await screen.findByText('Seguro próximo')).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Ver información relacionada' }),
    ).not.toBeInTheDocument();
  });

  it('solo pide permiso Web Push tras pulsar la activación explícita', async () => {
    const user = userEvent.setup();
    const subscription = {
      endpoint: 'https://push.example/subscription',
      toJSON: () => ({
        endpoint: 'https://push.example/subscription',
        expirationTime: null,
        keys: { auth: 'auth-key', p256dh: 'public-key' },
      }),
      unsubscribe: vi.fn().mockResolvedValue(true),
    };
    const pushManager = {
      getSubscription: vi.fn().mockResolvedValue(null),
      subscribe: vi.fn().mockResolvedValue(subscription),
    };
    const registration = { pushManager };
    const requestPermission = vi.fn().mockResolvedValue('granted');
    const register = vi.fn().mockResolvedValue(registration);

    Object.defineProperty(window, 'Notification', {
      configurable: true,
      value: { permission: 'default', requestPermission },
    });
    Object.defineProperty(window, 'PushManager', {
      configurable: true,
      value: function PushManager() {},
    });
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        getRegistration: vi.fn().mockResolvedValue(null),
        register,
      },
    });
    http.get.mockImplementation((url) => {
      if (url === '/notification-preferences') return Promise.resolve(preferences);
      if (url === '/push-subscriptions') return Promise.resolve([]);
      if (url.includes('unreadOnly=true')) return Promise.resolve([notification]);
      return Promise.resolve([notification]);
    });
    http.post.mockResolvedValue({ id: 'push-subscription-id' });
    http.patch.mockResolvedValue({ ...preferences, webPushEnabled: true });

    renderPage();
    const activate = await screen.findByRole('button', {
      name: 'Activar avisos web',
    });
    expect(requestPermission).not.toHaveBeenCalled();
    await user.click(activate);

    await waitFor(() => expect(requestPermission).toHaveBeenCalledOnce());
    expect(register).toHaveBeenCalledWith('/sw.js', { scope: '/' });
    expect(pushManager.subscribe).toHaveBeenCalledWith({
      applicationServerKey: expect.any(Uint8Array),
      userVisibleOnly: true,
    });
    expect(http.post).toHaveBeenCalledWith('/push-subscriptions', {
      endpoint: subscription.endpoint,
      expirationTime: null,
      keys: { auth: 'auth-key', p256dh: 'public-key' },
    });
    expect(http.patch).toHaveBeenCalledWith('/notification-preferences', {
      webPushEnabled: true,
    });
  });
});
