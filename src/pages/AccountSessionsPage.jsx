import { Laptop, LogOut, MonitorSmartphone, ShieldCheck, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

import {
  useCurrentUserQuery,
  useLogoutMutation,
  useRevokeSessionMutation,
  useSessionsQuery,
} from '../features/auth/authQueries';
import { AuthError } from '../features/auth/components/AuthFeedback';
import { ErrorState, LoadingState } from '../components/ui/FeedbackStates';
import { PageHeader } from '../components/ui/PageHeader';

function formatDate(value) {
  if (!value) return 'Sin actividad registrada';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Fecha no disponible';

  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function sessionName(userAgent) {
  if (!userAgent) return 'Dispositivo sin identificar';
  if (/mobile|android|iphone/i.test(userAgent)) return 'Dispositivo móvil';
  return 'Navegador de escritorio';
}

export function AccountSessionsPage() {
  const navigate = useNavigate();
  const currentUser = useCurrentUserQuery();
  const sessions = useSessionsQuery();
  const revokeSession = useRevokeSessionMutation();
  const logout = useLogoutMutation();
  const logoutAll = useLogoutMutation({ allDevices: true });

  async function handleLogout() {
    try {
      await logout.mutateAsync();
      navigate('/login', { replace: true });
    } catch {
      // React Query exposes the normalized error below the action.
    }
  }

  async function handleLogoutAll() {
    try {
      await logoutAll.mutateAsync();
      navigate('/login', { replace: true });
    } catch {
      // React Query exposes the normalized error below the action.
    }
  }

  async function handleRevoke(sessionId) {
    try {
      await revokeSession.mutateAsync(sessionId);
      toast.success('La sesión se ha cerrado.');
    } catch {
      // React Query exposes the normalized error below the list.
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Cuenta"
        title="Cuenta y sesiones"
      />

      <section className="rounded-2xl border border-border bg-surface p-5 shadow-card sm:p-6">
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand-strong">
            <ShieldCheck aria-hidden="true" className="size-6" />
          </span>
          <div className="min-w-0">
            <h2 className="font-bold text-text">Tu cuenta</h2>
            <p className="mt-1 break-words text-sm text-text-muted">
              {currentUser.data?.name ?? 'Usuario'} · {currentUser.data?.email ?? 'Email no disponible'}
            </p>
          </div>
        </div>
        <button
          className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-border-strong bg-surface px-4 py-2.5 text-sm font-bold text-text transition-colors hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          disabled={logout.isPending}
          onClick={handleLogout}
          type="button"
        >
          <LogOut aria-hidden="true" className="size-4" />
          {logout.isPending ? 'Cerrando sesión…' : 'Cerrar esta sesión'}
        </button>
        <AuthError error={logout.error} />
      </section>

      <section aria-labelledby="sesiones-activas">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-extrabold tracking-tight" id="sesiones-activas">
              Sesiones activas
            </h2>
            <p className="mt-1 text-sm leading-6 text-text-muted">
              Las fechas reflejan la última actividad conocida por el servidor.
            </p>
          </div>
          <button
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-red-300 bg-surface px-4 py-2.5 text-sm font-bold text-red-800 transition-colors hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={logoutAll.isPending}
            onClick={handleLogoutAll}
            type="button"
          >
            <Trash2 aria-hidden="true" className="size-4" />
            {logoutAll.isPending ? 'Cerrando sesiones…' : 'Cerrar todas las sesiones'}
          </button>
        </div>

        <div className="mt-5">
          {sessions.isPending ? <LoadingState label="Cargando sesiones" /> : null}
          {sessions.isError ? (
            <ErrorState
              description={sessions.error.message}
              onRetry={sessions.refetch}
              title="No se han podido cargar las sesiones"
            />
          ) : null}
          {sessions.isSuccess && sessions.data.length === 0 ? (
            <p className="rounded-2xl border border-border bg-surface p-5 text-sm text-text-muted">
              No hay sesiones activas para mostrar.
            </p>
          ) : null}
          {sessions.isSuccess && sessions.data.length > 0 ? (
            <ul className="space-y-3">
              {sessions.data.map((session) => {
                const Icon = /mobile|android|iphone/i.test(session.userAgent ?? '')
                  ? MonitorSmartphone
                  : Laptop;
                const revoking =
                  revokeSession.isPending && revokeSession.variables === session.id;

                return (
                  <li
                    className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5 shadow-card sm:flex-row sm:items-center"
                    key={session.id}
                  >
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-muted text-text-muted">
                      <Icon aria-hidden="true" className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-bold text-text">{sessionName(session.userAgent)}</p>
                        {session.current ? (
                          <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-bold text-brand-strong">
                            Sesión actual
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-sm leading-5 text-text-muted">
                        Última actividad: {formatDate(session.lastUsedAt ?? session.createdAt)}
                      </p>
                      <p className="mt-0.5 text-xs leading-5 text-text-soft">
                        Caduca: {formatDate(session.expiresAt)}
                      </p>
                    </div>
                    {!session.current ? (
                      <button
                        aria-label={`Cerrar sesión de ${sessionName(session.userAgent)}`}
                        className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border-strong px-4 py-2 text-sm font-bold text-text hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={revoking}
                        onClick={() => handleRevoke(session.id)}
                        type="button"
                      >
                        {revoking ? 'Cerrando…' : 'Cerrar sesión'}
                      </button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : null}
          <AuthError error={logoutAll.error ?? revokeSession.error} />
        </div>
      </section>
    </div>
  );
}
