import { zodResolver } from '@hookform/resolvers/zod';
import { Link2, TriangleAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { useCurrentUserQuery, useGoogleLinkMutation } from '../../features/auth/authQueries';
import {
  authDestinationLocation,
  readStoredAuthDestination,
} from '../../features/auth/authReturnTo';
import { googleLinkSchema } from '../../features/auth/authSchemas';
import { AuthError, SubmitButton } from '../../features/auth/components/AuthFeedback';
import { FormField, PasswordField } from '../../features/auth/components/FormField';

const callbackErrors = {
  PRIVACY_POLICY_ACKNOWLEDGEMENT_REQUIRED:
    'Debes confirmar que has leído la Política de privacidad antes de crear una cuenta con Google.',
  PRIVACY_POLICY_NOT_CONFIGURED:
    'El registro está deshabilitado hasta que se configure la Política de privacidad.',
  PRIVACY_POLICY_OUTDATED:
    'La Política de privacidad ha cambiado. Revísala y vuelve a confirmar la versión vigente desde el registro.',
  access_denied: 'Has cancelado el acceso con Google.',
  invalid_state: 'La solicitud ha caducado o no se ha podido verificar.',
  oauth_failed: 'Google no ha podido completar el inicio de sesión.',
};
const privacyErrorCodes = new Set([
  'PRIVACY_POLICY_ACKNOWLEDGEMENT_REQUIRED',
  'PRIVACY_POLICY_NOT_CONFIGURED',
  'PRIVACY_POLICY_OUTDATED',
]);

function LinkingForm() {
  const navigate = useNavigate();
  const linkAccount = useGoogleLinkMutation();
  const {
    formState: { errors },
    handleSubmit,
    register,
  } = useForm({ resolver: zodResolver(googleLinkSchema) });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await linkAccount.mutateAsync(values);
      navigate(readStoredAuthDestination({ consume: true }), { replace: true });
    } catch {
      // React Query exposes the normalized error in the form feedback.
    }
  });

  return (
    <div>
      <span className="grid size-12 place-items-center rounded-2xl bg-brand-soft text-brand-strong">
        <Link2 aria-hidden="true" className="size-6" />
      </span>
      <h1 className="mt-5 text-3xl font-extrabold tracking-tight">Vincula tu cuenta</h1>
      <p className="mt-3 text-sm leading-6 text-text-muted">
        Ya existe una cuenta con ese email. Confirma sus credenciales para vincular Google de forma segura.
      </p>
      <form className="mt-7 space-y-5" noValidate onSubmit={onSubmit}>
        <FormField
          autoCapitalize="none"
          autoComplete="email"
          error={errors.email?.message}
          inputMode="email"
          label="Email de tu cuenta"
          placeholder="nombre@ejemplo.com"
          type="email"
          {...register('email')}
        />
        <PasswordField
          autoComplete="current-password"
          error={errors.password?.message}
          label="Contraseña actual"
          {...register('password')}
        />
        <AuthError error={linkAccount.error} />
        <SubmitButton isPending={linkAccount.isPending} pendingLabel="Vinculando cuenta…">
          Confirmar y vincular Google
        </SubmitButton>
      </form>
    </div>
  );
}

export function GoogleCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const status = searchParams.get('status');
  const errorCode = searchParams.get('error') ?? 'oauth_failed';
  const [failed, setFailed] = useState(null);
  const session = useCurrentUserQuery({ enabled: status === 'success' });

  useEffect(() => {
    if (status !== 'success') return;

    if (session.isSuccess) {
      navigate(readStoredAuthDestination({ consume: true }), { replace: true });
    } else if (session.isError) {
      setFailed('No hemos podido confirmar la sesión creada por Google.');
    }
  }, [navigate, session.isError, session.isSuccess, status]);

  if (status === 'link_required') return <LinkingForm />;

  if (status === 'success' && !failed) {
    return (
      <div aria-busy="true" className="py-8 text-center" role="status">
        <span className="mx-auto block size-10 animate-spin rounded-full border-4 border-brand-soft border-t-brand motion-reduce:animate-none" />
        <h1 className="mt-5 text-2xl font-extrabold tracking-tight">Completando el acceso…</h1>
        <p className="mt-2 text-sm text-text-muted">Estamos verificando tu sesión segura.</p>
      </div>
    );
  }

  const returnTo = authDestinationLocation(readStoredAuthDestination());
  const shouldReturnToRegister = privacyErrorCodes.has(errorCode);

  return (
    <div>
      <TriangleAlert aria-hidden="true" className="size-12 text-red-700" />
      <h1 className="mt-5 text-3xl font-extrabold tracking-tight">No se ha podido acceder con Google</h1>
      <p className="mt-3 text-sm leading-6 text-text-muted">
        {failed ?? callbackErrors[errorCode] ?? callbackErrors.oauth_failed} Puedes volver a intentarlo desde la pantalla de acceso.
      </p>
      <Link
        className="mt-7 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-brand px-5 py-3 text-sm font-extrabold text-on-brand hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        state={{ from: returnTo }}
        to={shouldReturnToRegister ? '/register' : '/login'}
      >
        {shouldReturnToRegister ? 'Volver al registro' : 'Volver a iniciar sesión'}
      </Link>
    </div>
  );
}
