import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link2 } from 'lucide-react';
import { useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { http } from '../api/client';
import { queryKeys } from '../api/queryKeys';
import { ErrorState, LoadingState } from '../components/ui/FeedbackStates';
import { useCurrentUserQuery } from '../features/auth/authQueries';

function invitationToken(hash) {
  try {
    return new URLSearchParams(hash.replace(/^#/, '')).get('token') ?? '';
  } catch {
    return '';
  }
}

export function InvitationAcceptPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const token = useMemo(() => invitationToken(location.hash), [location.hash]);
  const session = useCurrentUserQuery();
  const preview = useQuery({
    queryKey: ['invitationPreview', token],
    queryFn: () => http.post('/invitations/preview', { token }),
    enabled: Boolean(token),
    retry: false,
  });
  const accept = useMutation({
    mutationFn: () => http.post('/invitations/accept', { token }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.households.all() });
      navigate('/hogar', { replace: true });
    },
  });

  if (!token) {
    return <ErrorState description="El enlace no contiene un token de invitación." title="Enlace incompleto" />;
  }
  if (preview.isPending) return <LoadingState label="Comprobando invitación" />;
  if (preview.isError) {
    return <ErrorState description={preview.error.message} onRetry={preview.refetch} title="La invitación no está disponible" />;
  }

  const data = preview.data;
  const isAuthenticated = session.isSuccess;
  const from = { pathname: location.pathname, search: location.search, hash: location.hash };

  return (
    <div>
      <span className="grid size-11 place-items-center rounded-2xl bg-brand-soft text-brand-strong">
        <Link2 className="size-6" aria-hidden="true" />
      </span>
      <p className="mt-5 text-sm font-bold text-brand-strong">Invitación al hogar</p>
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight">{data.household.name}</h1>
      <p className="mt-3 text-sm leading-6 text-text-muted">
        {data.invitedByName} te ha invitado como {data.role === 'ADMIN' ? 'administrador' : 'miembro'}.
        {data.householdPerson?.name ? ` Se vinculará con ${data.householdPerson.name}.` : ''}
      </p>
      {data.emailHint ? <p className="mt-2 text-sm text-text-muted">Correo esperado: {data.emailHint}</p> : null}

      {isAuthenticated ? (
        <div className="mt-7">
          <button className="min-h-12 w-full rounded-xl bg-brand px-5 py-3 font-bold text-on-brand disabled:opacity-60" disabled={accept.isPending} onClick={() => accept.mutate()} type="button">
            {accept.isPending ? 'Aceptando…' : 'Aceptar invitación'}
          </button>
          {accept.isError ? <p className="mt-3 text-sm text-red-700" role="alert">{accept.error.message}</p> : null}
        </div>
      ) : session.isPending ? (
        <p className="mt-7 text-sm text-text-muted">Comprobando tu sesión…</p>
      ) : (
        <div className="mt-7 space-y-3">
          <Link className="flex min-h-12 items-center justify-center rounded-xl bg-brand px-5 py-3 font-bold text-on-brand" state={{ from }} to="/login">Iniciar sesión para aceptar</Link>
          <Link className="flex min-h-12 items-center justify-center rounded-xl border border-border-strong px-5 py-3 font-bold text-brand-strong" state={{ from }} to="/register">Crear cuenta y aceptar</Link>
        </div>
      )}
    </div>
  );
}

