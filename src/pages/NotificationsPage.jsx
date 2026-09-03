import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  BellOff,
  CheckCheck,
  ExternalLink,
  Mail,
  MonitorSmartphone,
  Settings2,
} from 'lucide-react';
import { useEffect, useId, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';

import { http } from '../api/client';
import { queryKeys } from '../api/queryKeys';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState, LoadingState } from '../components/ui/FeedbackStates';
import { PageHeader } from '../components/ui/PageHeader';
import { publicEnv } from '../config/env';
import { AuthError } from '../features/auth/components/AuthFeedback';
import { FormField } from '../features/auth/components/FormField';
import { notificationService } from '../features/notifications/notificationService';

const preferenceQueryKey = ['notificationPreferences'];
const primaryButton =
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-extrabold text-on-brand shadow-sm transition-colors hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-60';
const secondaryButton =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border-strong bg-surface px-4 py-2.5 text-sm font-bold text-text transition-colors hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-60';

const webPushQueryKeys = Object.freeze({
  browser: ['webPush', 'browserSubscription'],
  server: ['webPush', 'serverSubscriptions'],
});

const webPushApi = Object.freeze({
  list: () => http.get('/push-subscriptions'),
  create: (body) => http.post('/push-subscriptions', body),
  remove: (subscriptionId) => http.delete(`/push-subscriptions/${subscriptionId}`),
});

const deliveryLabels = Object.freeze({
  EMAIL: 'Email',
  IN_APP: 'En la aplicación',
  WEB_PUSH: 'Aviso web',
});

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Fecha no disponible';

  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function parseOffsets(value) {
  const parts = String(value)
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0 || parts.length > 20) {
    throw new Error('Indica entre 1 y 20 avisos separados por comas.');
  }

  const offsets = parts.map((part) => {
    if (!/^\d{1,3}$/.test(part)) {
      throw new Error('Usa días enteros separados por comas, por ejemplo: 30, 7, 1.');
    }

    const offset = Number(part);
    if (offset < 0 || offset > 365) {
      throw new Error('Cada aviso debe estar entre 0 y 365 días antes.');
    }
    return offset;
  });

  return [...new Set(offsets)].sort((left, right) => right - left);
}

function safeRelatedPath(value) {
  if (typeof value !== 'string' || !value.startsWith('/')) return null;

  try {
    const base = 'https://budgetapp.local';
    const url = new URL(value, base);
    return url.origin === base ? `${url.pathname}${url.search}${url.hash}` : null;
  } catch {
    return null;
  }
}

function supportsWebPush() {
  return Boolean(
    typeof window !== 'undefined' &&
      'Notification' in window &&
      'PushManager' in window &&
      'serviceWorker' in navigator,
  );
}

function vapidKeyToBytes(value) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replaceAll('-', '+').replaceAll('_', '/');
  const raw = window.atob(base64);
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}

async function getBrowserPushSubscription() {
  if (!supportsWebPush()) return null;
  const registration = await navigator.serviceWorker.getRegistration('/');
  return registration?.pushManager.getSubscription() ?? null;
}

function NotificationItem({ item, markRead }) {
  const titleId = useId();
  const unread = !item.readAt;
  const marking = markRead.isPending && markRead.variables === item.id;
  const relatedPath = safeRelatedPath(item.relatedPath);
  const sentChannels = (item.deliveries ?? [])
    .filter((delivery) => delivery.status === 'SENT')
    .map((delivery) => deliveryLabels[delivery.channel] ?? delivery.channel);

  return (
    <li>
      <article
        aria-labelledby={titleId}
        className={`rounded-2xl border p-5 shadow-card transition-colors sm:p-6 ${
          unread ? 'border-brand/35 bg-brand-soft/60' : 'border-border bg-surface'
        }`}
      >
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className={`mt-1 size-2.5 shrink-0 rounded-full ${
              unread ? 'bg-brand' : 'bg-border-strong'
            }`}
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h3 className="font-extrabold text-text" id={titleId}>
                {item.title}
              </h3>
              <span className="text-xs font-semibold text-text-soft">
                {unread ? 'Sin leer' : 'Leída'}
              </span>
            </div>
            <p className="mt-2 text-sm leading-6 text-text-muted">{item.message}</p>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs leading-5 text-text-soft">
              <span>{formatDateTime(item.createdAt)}</span>
              {item.recurringExpense?.name ? (
                <span>Gasto: {item.recurringExpense.name}</span>
              ) : null}
              {sentChannels.length > 0 ? <span>Enviada por: {sentChannels.join(', ')}</span> : null}
            </div>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              {relatedPath ? (
                <Link className={secondaryButton} to={relatedPath}>
                  <ExternalLink aria-hidden="true" className="size-4" />
                  Ver información relacionada
                </Link>
              ) : null}
              {unread ? (
                <button
                  className={secondaryButton}
                  disabled={marking}
                  onClick={() => markRead.mutate(item.id)}
                  type="button"
                >
                  <CheckCheck aria-hidden="true" className="size-4" />
                  {marking ? 'Marcando…' : 'Marcar como leída'}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </article>
    </li>
  );
}

function NotificationCenter({ notificationsQuery, unreadQuery }) {
  const queryClient = useQueryClient();
  const markRead = useMutation({
    mutationFn: notificationService.markRead,
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.notifications.all(), (current = []) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      queryClient.setQueryData(queryKeys.notifications.unreadCount(), (current = []) =>
        current.filter((item) => item.id !== updated.id),
      );
      toast.success('Notificación marcada como leída.');
    },
  });
  const markAll = useMutation({
    mutationFn: notificationService.markAllRead,
    onSuccess: (result) => {
      const readAt = new Date().toISOString();
      queryClient.setQueryData(queryKeys.notifications.all(), (current = []) =>
        current.map((item) => ({ ...item, readAt: item.readAt ?? readAt })),
      );
      queryClient.setQueryData(queryKeys.notifications.unreadCount(), []);
      toast.success(
        result.updated === 1
          ? '1 notificación marcada como leída.'
          : `${result.updated} notificaciones marcadas como leídas.`,
      );
    },
  });
  const items = notificationsQuery.data ?? [];
  const unreadCount = unreadQuery.data?.length ?? items.filter((item) => !item.readAt).length;

  return (
    <section aria-labelledby="notification-center-title">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight text-text" id="notification-center-title">
            Centro de notificaciones
          </h2>
          <p aria-live="polite" className="mt-1 text-sm leading-6 text-text-muted">
            {unreadCount === 0
              ? 'No tienes avisos pendientes de leer.'
              : unreadCount === 1
                ? 'Tienes 1 aviso sin leer.'
                : `Tienes ${unreadCount} avisos sin leer.`}
          </p>
        </div>
        {unreadCount > 0 ? (
          <button
            className={secondaryButton}
            disabled={markAll.isPending}
            onClick={() => markAll.mutate()}
            type="button"
          >
            <CheckCheck aria-hidden="true" className="size-5" />
            {markAll.isPending ? 'Marcando todas…' : 'Marcar todas como leídas'}
          </button>
        ) : null}
      </div>

      <div className="mt-5">
        {notificationsQuery.isPending ? <LoadingState label="Cargando notificaciones" /> : null}
        {notificationsQuery.isError ? (
          <ErrorState
            description={notificationsQuery.error.message}
            onRetry={notificationsQuery.refetch}
            title="No se han podido cargar las notificaciones"
          />
        ) : null}
        {notificationsQuery.isSuccess && items.length === 0 ? (
          <EmptyState
            description="Aquí aparecerán los recordatorios de pagos y otros avisos importantes cuando se generen."
            icon={BellOff}
            title="No tienes notificaciones"
          />
        ) : null}
        {notificationsQuery.isSuccess && items.length > 0 ? (
          <ul className="space-y-3">
            {items.map((item) => (
              <NotificationItem item={item} key={item.id} markRead={markRead} />
            ))}
          </ul>
        ) : null}
      </div>
      <div className="mt-3">
        <AuthError error={markRead.error ?? markAll.error} />
      </div>
    </section>
  );
}

function WebPushControls({ preferences }) {
  const queryClient = useQueryClient();
  const configured = publicEnv.enableWebPush && Boolean(publicEnv.vapidPublicKey);
  const supported = supportsWebPush();
  const serverSubscriptions = useQuery({
    enabled: configured && supported,
    queryFn: webPushApi.list,
    queryKey: webPushQueryKeys.server,
  });
  const browserSubscription = useQuery({
    enabled: configured && supported,
    queryFn: getBrowserPushSubscription,
    queryKey: webPushQueryKeys.browser,
  });
  const currentEndpoint = browserSubscription.data?.endpoint;
  const serverSubscription = serverSubscriptions.data?.find(
    (subscription) => subscription.endpoint === currentEndpoint,
  );
  const isActive = Boolean(currentEndpoint && serverSubscription);

  const activate = useMutation({
    mutationFn: async () => {
      const permission =
        Notification.permission === 'default'
          ? await Notification.requestPermission()
          : Notification.permission;

      if (permission !== 'granted') {
        throw new Error(
          'El navegador no ha concedido permiso. Puedes cambiarlo desde la configuración del sitio.',
        );
      }

      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
      });
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          applicationServerKey: vapidKeyToBytes(publicEnv.vapidPublicKey),
          userVisibleOnly: true,
        });
      }

      const payload = subscription.toJSON();
      const created = await webPushApi.create(payload);
      const updatedPreferences = await notificationService.updatePreferences({
        webPushEnabled: true,
      });

      return {
        browserSubscription: subscription,
        preferences: updatedPreferences,
        serverSubscription: {
          id: created.id,
          endpoint: subscription.endpoint,
          expirationTime: payload.expirationTime ?? null,
        },
      };
    },
    onSuccess: (result) => {
      queryClient.setQueryData(webPushQueryKeys.browser, result.browserSubscription);
      queryClient.setQueryData(webPushQueryKeys.server, (current = []) => [
        ...current.filter(
          (subscription) =>
            subscription.endpoint !== result.serverSubscription.endpoint,
        ),
        result.serverSubscription,
      ]);
      queryClient.setQueryData(preferenceQueryKey, result.preferences);
      toast.success('Avisos web activados en este dispositivo.');
    },
  });

  const deactivate = useMutation({
    mutationFn: async () => {
      const subscription = await getBrowserPushSubscription();
      const matchingServerSubscription = serverSubscriptions.data?.find(
        (item) => item.endpoint === subscription?.endpoint,
      );

      if (matchingServerSubscription) {
        await webPushApi.remove(matchingServerSubscription.id);
      }
      if (subscription) {
        await subscription.unsubscribe();
      }

      const remaining = (serverSubscriptions.data ?? []).filter(
        (item) => item.id !== matchingServerSubscription?.id,
      );
      const updatedPreferences =
        remaining.length === 0
          ? await notificationService.updatePreferences({ webPushEnabled: false })
          : preferences;

      return { preferences: updatedPreferences, remaining };
    },
    onSuccess: (result) => {
      queryClient.setQueryData(webPushQueryKeys.browser, null);
      queryClient.setQueryData(webPushQueryKeys.server, result.remaining);
      queryClient.setQueryData(preferenceQueryKey, result.preferences);
      toast.success('Avisos web desactivados en este dispositivo.');
    },
  });

  const error =
    activate.error ??
    deactivate.error ??
    serverSubscriptions.error ??
    browserSubscription.error;
  const pending = activate.isPending || deactivate.isPending;

  return (
    <div className="rounded-2xl border border-border-strong bg-surface p-4 sm:col-span-2 lg:col-span-1">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface-muted text-text-muted">
          <MonitorSmartphone aria-hidden="true" className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-text">Avisos web en este dispositivo</p>
          <p className="mt-1 text-xs leading-5 text-text-muted">
            {!configured
              ? 'No están configurados en este entorno. Los otros canales siguen disponibles.'
              : !supported
                ? 'Este navegador no admite notificaciones web.'
                : isActive
                  ? 'Este dispositivo puede recibir avisos aunque la aplicación no esté abierta.'
                  : 'Actívalos cuando quieras; el permiso solo se solicita al pulsar el botón.'}
          </p>
        </div>
      </div>
      {configured && supported ? (
        <button
          className={`${secondaryButton} mt-4 w-full`}
          disabled={
            pending || serverSubscriptions.isPending || browserSubscription.isPending
          }
          onClick={() => (isActive ? deactivate.mutate() : activate.mutate())}
          type="button"
        >
          <MonitorSmartphone aria-hidden="true" className="size-4" />
          {pending
            ? 'Actualizando dispositivo…'
            : isActive
              ? 'Desactivar en este dispositivo'
              : 'Activar avisos web'}
        </button>
      ) : null}
      {error ? (
        <p className="mt-3 text-sm font-semibold text-red-700" role="alert">
          {error.message}
        </p>
      ) : null}
    </div>
  );
}

function PreferenceOption({ checked, description, disabled, icon: Icon, label, onChange }) {
  return (
    <label
      className={`flex min-h-24 items-start gap-3 rounded-2xl border p-4 ${
        disabled
          ? 'cursor-not-allowed border-border bg-surface-muted opacity-70'
          : checked
            ? 'cursor-pointer border-brand/40 bg-brand-soft'
            : 'cursor-pointer border-border-strong bg-surface'
      }`}
    >
      <input
        checked={checked}
        className="mt-1 size-5 rounded accent-brand"
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
      />
      <span className="min-w-0">
        <span className="flex items-center gap-2 font-bold text-text">
          <Icon aria-hidden="true" className="size-4 shrink-0" />
          {label}
        </span>
        <span className="mt-1 block text-xs leading-5 text-text-muted">{description}</span>
      </span>
    </label>
  );
}

function NotificationPreferences({ query }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    defaultOffsets: '30, 7, 1',
    emailEnabled: true,
    inAppEnabled: true,
    webPushEnabled: false,
  });
  const [validationError, setValidationError] = useState('');
  const mutation = useMutation({
    mutationFn: notificationService.updatePreferences,
    onSuccess: (preferences) => {
      queryClient.setQueryData(preferenceQueryKey, preferences);
      setValidationError('');
      toast.success('Preferencias de notificación guardadas.');
    },
  });

  useEffect(() => {
    if (!query.data) return;
    setForm({
      defaultOffsets: query.data.defaultOffsets.join(', '),
      emailEnabled: query.data.emailEnabled,
      inAppEnabled: query.data.inAppEnabled,
      webPushEnabled: query.data.webPushEnabled,
    });
  }, [query.data]);

  const channelCount = useMemo(
    () =>
      [
        form.inAppEnabled,
        form.emailEnabled,
        publicEnv.enableWebPush && form.webPushEnabled,
      ].filter(Boolean).length,
    [form],
  );

  if (query.isPending) {
    return (
      <section aria-busy="true" className="rounded-2xl border border-border bg-surface p-5" role="status">
        <p className="text-sm font-semibold text-text-muted">Cargando preferencias…</p>
      </section>
    );
  }

  if (query.isError) {
    return (
      <ErrorState
        description={query.error.message}
        onRetry={query.refetch}
        title="No se han podido cargar las preferencias"
      />
    );
  }

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    try {
      const defaultOffsets = parseOffsets(form.defaultOffsets);
      setValidationError('');
      mutation.mutate({
        defaultOffsets,
        emailEnabled: form.emailEnabled,
        inAppEnabled: form.inAppEnabled,
        webPushEnabled: form.webPushEnabled,
      });
    } catch (error) {
      setValidationError(error.message);
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-surface p-5 shadow-card sm:p-6">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand-strong">
          <Settings2 aria-hidden="true" className="size-5" />
        </span>
        <div>
          <h2 className="text-xl font-extrabold tracking-tight text-text">Preferencias</h2>
          <p className="mt-1 text-sm leading-6 text-text-muted">
            Elige cómo quieres recibir los recordatorios y con cuánta antelación.
          </p>
        </div>
      </div>

      <form className="mt-6" onSubmit={handleSubmit}>
        <fieldset>
          <legend className="text-sm font-bold text-text">Canales de aviso</legend>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <PreferenceOption
              checked={form.inAppEnabled}
              description="Los avisos aparecen siempre en este centro."
              icon={Bell}
              label="En la aplicación"
              onChange={(checked) => updateField('inAppEnabled', checked)}
            />
            <PreferenceOption
              checked={form.emailEnabled}
              description="Recibe una copia en el correo de tu cuenta."
              icon={Mail}
              label="Correo electrónico"
              onChange={(checked) => updateField('emailEnabled', checked)}
            />
            <WebPushControls preferences={query.data} />
          </div>
        </fieldset>

        <div className="mt-5 max-w-md">
          <FormField
            error={validationError}
            help="Días antes del vencimiento, separados por comas. Usa 0 para avisar el mismo día."
            inputMode="numeric"
            label="Antelación predeterminada"
            name="defaultOffsets"
            onChange={(event) => updateField('defaultOffsets', event.target.value)}
            placeholder="30, 7, 1"
            required
            value={form.defaultOffsets}
          />
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
          <button className={primaryButton} disabled={mutation.isPending} type="submit">
            <Settings2 aria-hidden="true" className="size-5" />
            {mutation.isPending ? 'Guardando preferencias…' : 'Guardar preferencias'}
          </button>
          <p aria-live="polite" className="text-xs leading-5 text-text-muted">
            {channelCount === 0
              ? 'No recibirás avisos hasta activar al menos un canal.'
              : `${channelCount} ${channelCount === 1 ? 'canal activo' : 'canales activos'}.`}
          </p>
        </div>
        <div className="mt-3">
          <AuthError error={mutation.error} />
        </div>
      </form>
    </section>
  );
}

export function NotificationsPage() {
  const notificationsQuery = useQuery({
    queryFn: notificationService.list,
    queryKey: queryKeys.notifications.all(),
  });
  const unreadQuery = useQuery({
    queryFn: notificationService.listUnread,
    queryKey: queryKeys.notifications.unreadCount(),
  });
  const preferencesQuery = useQuery({
    queryFn: notificationService.getPreferences,
    queryKey: preferenceQueryKey,
  });

  if (
    notificationsQuery.isPending &&
    unreadQuery.isPending &&
    preferencesQuery.isPending
  ) {
    return <LoadingState label="Cargando notificaciones y preferencias" />;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Recordatorios"
        title="Notificaciones"
      />

      <NotificationCenter
        notificationsQuery={notificationsQuery}
        unreadQuery={unreadQuery}
      />
      <NotificationPreferences query={preferencesQuery} />
    </div>
  );
}
