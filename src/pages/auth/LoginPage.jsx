import { zodResolver } from '@hookform/resolvers/zod';
import { Chrome } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { publicEnv } from '../../config/env';
import { useLoginMutation } from '../../features/auth/authQueries';
import {
  getAuthDestination,
  storeAuthDestination,
} from '../../features/auth/authReturnTo';
import { loginSchema } from '../../features/auth/authSchemas';
import { AuthError, SubmitButton } from '../../features/auth/components/AuthFeedback';
import { FormField, PasswordField } from '../../features/auth/components/FormField';

export function LoginPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const login = useLoginMutation();
  const {
    formState: { errors },
    handleSubmit,
    register,
  } = useForm({ resolver: zodResolver(loginSchema) });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await login.mutateAsync(values);
      navigate(getAuthDestination(location.state?.from), { replace: true });
    } catch {
      // React Query exposes the normalized error in the form feedback.
    }
  });

  return (
    <div>
      <div>
        <p className="text-sm font-bold text-brand-strong">Te damos la bienvenida</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-text">
          Inicia sesión
        </h1>
        <p className="mt-3 text-sm leading-6 text-text-muted">
          Accede a tus hogares y continúa con tu planificación.
        </p>
      </div>

      {location.state?.reason === 'expired' ? (
        <p
          className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-sm font-medium text-amber-950"
          role="status"
        >
          Tu sesión ha caducado. Inicia sesión de nuevo para continuar.
        </p>
      ) : null}

      {publicEnv.enableGoogleLogin ? (
        <>
          <a
            className="mt-7 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-border-strong bg-surface px-5 py-3 text-sm font-extrabold text-text shadow-sm transition-colors hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            href={`${publicEnv.apiUrl}/auth/google/start`}
            onClick={() => {
              storeAuthDestination(location.state?.from);
            }}
          >
            <Chrome aria-hidden="true" className="size-5" />
            Continuar con Google
          </a>
          <div className="my-6 flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-text-soft">
            <span className="h-px flex-1 bg-border" />
            o usa tu email
            <span className="h-px flex-1 bg-border" />
          </div>
        </>
      ) : null}

      <form className={publicEnv.enableGoogleLogin ? 'space-y-5' : 'mt-7 space-y-5'} noValidate onSubmit={onSubmit}>
        <FormField
          autoCapitalize="none"
          autoComplete="email"
          error={errors.email?.message}
          inputMode="email"
          label="Email"
          placeholder="nombre@ejemplo.com"
          type="email"
          {...register('email')}
        />
        <div>
          <PasswordField
            autoComplete="current-password"
            error={errors.password?.message}
            label="Contraseña"
            {...register('password')}
          />
          <div className="mt-2 text-right">
            <Link
              className="inline-flex min-h-11 items-center rounded-lg text-sm font-bold text-brand-strong underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              to="/forgot-password"
            >
              He olvidado mi contraseña
            </Link>
          </div>
        </div>

        <AuthError error={login.error} />
        <SubmitButton isPending={login.isPending} pendingLabel="Iniciando sesión…">
          Iniciar sesión
        </SubmitButton>
      </form>

      <p className="mt-7 text-center text-sm text-text-muted">
        ¿Aún no tienes cuenta?{' '}
        <Link
          className="font-bold text-brand-strong underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          state={{ from: location.state?.from }}
          to="/register"
        >
          Crear una cuenta
        </Link>
      </p>
    </div>
  );
}
