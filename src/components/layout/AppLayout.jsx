import { useQuery } from '@tanstack/react-query';
import { Bell, CircleDollarSign, LogOut } from 'lucide-react';
import { useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';

import { primaryNavigation } from '../../app/navigation';
import { queryKeys } from '../../api/queryKeys';
import { publicEnv } from '../../config/env';
import { useHousehold } from '../../features/households/useHousehold';
import { useLogoutMutation } from '../../features/auth/authQueries';
import { notificationService } from '../../features/notifications/notificationService';

function getNavigationClassName(isActive, mobile) {
  if (mobile) {
    return [
      'relative flex min-h-16 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-[0.625rem] font-semibold tracking-tight whitespace-nowrap transition-colors min-[375px]:text-[0.6875rem] min-[420px]:text-xs',
      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
      isActive
        ? 'bg-brand-soft text-brand-strong ring-1 ring-brand/25 shadow-sm'
        : 'text-text-muted hover:bg-surface-muted hover:text-text',
    ].join(' ');
  }

  return [
    'relative flex min-h-12 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
    isActive
      ? 'bg-brand-soft text-brand-strong ring-1 ring-brand/20 before:absolute before:inset-y-3 before:left-0 before:w-1 before:rounded-r-full before:bg-brand'
      : 'text-text-muted hover:bg-surface-muted hover:text-text',
  ].join(' ');
}

function NavigationItems({ mobile = false, pathname }) {
  return primaryNavigation.map(({ end, icon: Icon, label, relatedPaths = [], to }) => {
    const isCurrent =
      pathname === to ||
      (!end && pathname.startsWith(`${to}/`)) ||
      relatedPaths.some((path) => pathname === path);

    return (
      <Link
        aria-current={isCurrent ? 'page' : undefined}
        className={getNavigationClassName(isCurrent, mobile)}
        key={to}
        to={to}
      >
        <Icon aria-hidden="true" className="size-5 shrink-0" strokeWidth={2} />
        <span>{label}</span>
      </Link>
    );
  });
}

function NotificationBell({ compact = false }) {
  const unread = useQuery({
    queryFn: notificationService.listUnread,
    queryKey: queryKeys.notifications.unreadCount(),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
  const count = Array.isArray(unread.data) ? unread.data.length : 0;
  const countLabel = count > 99 ? '99+' : String(count);
  const accessibleLabel = count === 0
    ? 'Notificaciones, ninguna sin leer'
    : `Notificaciones, ${count} ${count === 1 ? 'aviso' : 'avisos'} sin leer`;

  return (
    <Link
      aria-label={accessibleLabel}
      className={`relative inline-flex min-h-11 items-center justify-center rounded-xl text-text-muted transition-colors hover:bg-surface-muted hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${
        compact ? 'min-w-11 px-2' : 'w-full gap-3 px-3 text-sm font-semibold'
      }`}
      to="/notificaciones"
    >
      <span className="relative">
        <Bell aria-hidden="true" className="size-5" />
        {count > 0 ? (
          <span
            aria-hidden="true"
            className="absolute -right-2.5 -top-2.5 grid min-h-5 min-w-5 place-items-center rounded-full bg-red-700 px-1 text-[0.625rem] font-extrabold leading-none text-white"
          >
            {countLabel}
          </span>
        ) : null}
      </span>
      {compact ? null : <span>Notificaciones</span>}
    </Link>
  );
}

function LogoutButton({ compact = false }) {
  const navigate = useNavigate();
  const logout = useLogoutMutation();

  async function handleLogout() {
    try {
      await logout.mutateAsync();
      navigate('/login', { replace: true });
    } catch (error) {
      toast.error(error?.message ?? 'No se ha podido cerrar la sesión.');
    }
  }

  return (
    <button
      aria-label={compact ? 'Cerrar sesión' : undefined}
      className={`inline-flex min-h-11 items-center justify-center rounded-xl text-text-muted transition-colors hover:bg-surface-muted hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-60 ${
        compact ? 'min-w-11 px-2' : 'w-full gap-3 px-3 text-sm font-semibold'
      }`}
      disabled={logout.isPending}
      onClick={handleLogout}
      title="Cerrar sesión"
      type="button"
    >
      <LogOut aria-hidden="true" className="size-5" />
      {compact ? <span className="sr-only">Cerrar sesión</span> : <span>Cerrar sesión</span>}
    </button>
  );
}

export function AppLayout() {
  const location = useLocation();
  const mainRef = useRef(null);
  const previousPath = useRef(location.pathname);
  const { currentHousehold, households, selectHousehold } = useHousehold();
  const activeDestination = primaryNavigation.find(
    ({ relatedPaths = [], to }) =>
      location.pathname === to ||
      location.pathname.startsWith(`${to}/`) ||
      relatedPaths.some((path) => location.pathname === path),
  );

  useEffect(() => {
    document.title = activeDestination
      ? `${activeDestination.label} · ${publicEnv.appName}`
      : `Página no encontrada · ${publicEnv.appName}`;

    if (previousPath.current === location.pathname) return;

    previousPath.current = location.pathname;
    const heading = mainRef.current?.querySelector('h1');

    if (heading) {
      heading.setAttribute('tabindex', '-1');
      heading.focus();
    } else {
      mainRef.current?.focus();
    }
  }, [activeDestination, location.pathname]);

  return (
    <div className="min-h-dvh bg-background text-text ">
      <a
        className="fixed left-3 top-3 z-50 -translate-y-24 rounded-lg bg-brand px-4 py-3 text-sm font-bold text-on-brand shadow-lg transition-transform focus:translate-y-0 focus:outline-2 focus:outline-offset-2 focus:outline-focus"
        href="#contenido-principal"
      >
        Saltar al contenido principal
      </a>

      <div className="mx-auto min-h-dvh max-w-screen-2xl md:grid md:grid-cols-[17rem_minmax(0,1fr)]">
        <aside className="hidden border-r border-border bg-surface px-5 py-6 md:flex md:flex-col">
          <Link
            aria-label={`${publicEnv.appName}, ir al inicio`}
            className="mb-9 flex min-h-12 items-center gap-3 rounded-xl px-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            to="/dashboard"
          >
            <span className="grid size-10 place-items-center rounded-xl bg-brand text-on-brand shadow-sm">
              <CircleDollarSign aria-hidden="true" className="size-6" />
            </span>
            <span className="text-lg font-extrabold tracking-tight">
              {publicEnv.appName}
            </span>
          </Link>

          <div className="mb-6 rounded-2xl border border-border bg-surface-muted p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-text-soft">
              Hogar actual
            </p>
            {households.length > 1 ? (
              <select
                aria-label="Hogar actual"
                className="mt-2 min-h-11 w-full rounded-xl border border-border-strong bg-surface px-2 text-sm font-semibold"
                onChange={(event) => selectHousehold(event.target.value)}
                value={currentHousehold?.id ?? ''}
              >
                {households.map((household) => (
                  <option key={household.id} value={household.id}>{household.name}</option>
                ))}
              </select>
            ) : (
              <p className="mt-1 text-sm font-semibold text-text">
                {currentHousehold?.name ?? 'Sin hogar configurado'}
              </p>
            )}
            <Link className="mt-2 inline-flex min-h-9 items-center text-xs font-bold text-brand-strong" to="/hogar">
              {currentHousehold ? 'Gestionar hogar' : 'Crear hogar'}
            </Link>
          </div>

          <nav aria-label="Navegación principal" className="space-y-1.5">
            <NavigationItems pathname={location.pathname} />
          </nav>

          <div className="mt-4 space-y-1.5 border-t border-border pt-4">
            <NotificationBell />
            <LogoutButton />
          </div>

        </aside>

        <div className="min-w-0">
          <header className="sticky top-0 z-30 border-b border-border/90 bg-surface/95 backdrop-blur md:hidden">
            <div className="flex min-h-16 items-center justify-between gap-3 px-4">
              <Link
                aria-label={`${publicEnv.appName}, ir al inicio`}
                className="flex min-h-11 items-center gap-2 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                to="/dashboard"
              >
                <span className="grid size-9 place-items-center rounded-xl bg-brand text-on-brand">
                  <CircleDollarSign aria-hidden="true" className="size-5" />
                </span>
                <span className="font-extrabold tracking-tight">
                  {publicEnv.appName}
                </span>
              </Link>
              <div className="flex min-w-0 items-center gap-1">
                <Link className="max-w-36 truncate rounded-lg px-2 py-2 text-xs font-bold text-brand-strong focus-visible:outline-2 focus-visible:outline-focus" to="/hogar">
                  {currentHousehold?.name ?? 'Crear hogar'}
                </Link>
                <NotificationBell compact />
                <LogoutButton compact />
              </div>
            </div>
          </header>

          <main
            className="mx-auto w-full max-w-6xl px-4 pb-28 pt-6 focus:outline-none sm:px-6 sm:pt-8 md:px-8 md:pb-12 lg:px-10"
            id="contenido-principal"
            ref={mainRef}
            tabIndex="-1"
          >
            <Outlet />
          </main>
        </div>
      </div>

      <nav
        aria-label="Navegación principal móvil"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_28px_rgba(22,35,29,0.08)] backdrop-blur md:hidden"
      >
        <div className="mx-auto flex max-w-xl gap-1 pb-2">
          <NavigationItems mobile pathname={location.pathname} />
        </div>
      </nav>

      <p aria-atomic="true" aria-live="polite" className="sr-only">
        {activeDestination ? `Página ${activeDestination.label}` : 'Página no encontrada'}
      </p>
    </div>
  );
}
