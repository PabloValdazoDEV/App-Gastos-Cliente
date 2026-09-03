import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';

import { ErrorState } from '../../components/ui/FeedbackStates';
import { getAuthDestination } from './authReturnTo';
import { clearSessionCache, useCurrentUserQuery } from './authQueries';

const publicPaths = new Set([
  '/auth/callback',
  '/auth/google/link',
  '/forgot-password',
  '/invitaciones/aceptar',
  '/login',
  '/privacidad',
  '/register',
  '/reset-password',
]);

function SessionLoading() {
  return (
    <main
      aria-busy="true"
      className="grid min-h-dvh place-items-center bg-background px-4 text-center text-text"
    >
      <div role="status">
        <span className="mx-auto block size-10 animate-spin rounded-full border-4 border-brand-soft border-t-brand motion-reduce:animate-none" />
        <p className="mt-4 text-sm font-semibold text-text-muted">Comprobando tu sesión…</p>
      </div>
    </main>
  );
}

export function SessionEventBoundary() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    function handleSessionExpired() {
      if (publicPaths.has(location.pathname)) return;

      clearSessionCache(queryClient);
      navigate('/login', {
        replace: true,
        state: { from: location, reason: 'expired' },
      });
    }

    window.addEventListener('budgetapp:session-expired', handleSessionExpired);
    return () => window.removeEventListener('budgetapp:session-expired', handleSessionExpired);
  }, [location, navigate, queryClient]);

  return <Outlet />;
}

export function RequireAuth() {
  const location = useLocation();
  const session = useCurrentUserQuery();

  if (session.isPending) return <SessionLoading />;

  if (session.isError) {
    if (session.error?.status === 401) {
      return <Navigate replace state={{ from: location }} to="/login" />;
    }

    return (
      <main className="mx-auto grid min-h-dvh max-w-xl place-items-center bg-background px-4">
        <ErrorState
          description={session.error.message}
          onRetry={session.refetch}
          title="No podemos comprobar tu sesión"
        />
      </main>
    );
  }

  return <Outlet context={{ user: session.data }} />;
}

export function PublicOnly() {
  const location = useLocation();
  const session = useCurrentUserQuery();

  if (session.isPending) return <SessionLoading />;
  if (session.isSuccess) {
    return (
      <Navigate
        replace
        to={getAuthDestination(location.state?.from)}
      />
    );
  }

  return <Outlet />;
}
