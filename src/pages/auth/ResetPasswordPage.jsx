import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2, KeyRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useLocation } from 'react-router-dom';

import { useResetPasswordMutation } from '../../features/auth/authQueries';
import { resetPasswordSchema } from '../../features/auth/authSchemas';
import { AuthError, SubmitButton } from '../../features/auth/components/AuthFeedback';
import { PasswordField } from '../../features/auth/components/FormField';

function readResetToken(location) {
  const searchToken = new URLSearchParams(location.search).get('token');
  const hashToken = new URLSearchParams(location.hash.replace(/^#/, '')).get('token');
  const token = searchToken || hashToken || '';

  return token.length >= 32 && token.length <= 512 ? token : '';
}

export function ResetPasswordPage() {
  const location = useLocation();
  const [token] = useState(() => readResetToken(location));
  const [complete, setComplete] = useState(false);
  const resetPassword = useResetPasswordMutation();
  const {
    formState: { errors },
    handleSubmit,
    register,
  } = useForm({ resolver: zodResolver(resetPasswordSchema) });

  useEffect(() => {
    if (token && (location.search || location.hash)) {
      window.history.replaceState(window.history.state, '', '/reset-password');
    }
  }, [location.hash, location.search, token]);

  const onSubmit = handleSubmit(async ({ password }) => {
    try {
      await resetPassword.mutateAsync({ password, token });
      setComplete(true);
    } catch {
      // React Query exposes the normalized error in the form feedback.
    }
  });

  if (!token) {
    return (
      <div>
        <span className="grid size-12 place-items-center rounded-2xl bg-amber-100 text-amber-800">
          <KeyRound aria-hidden="true" className="size-6" />
        </span>
        <h1 className="mt-5 text-3xl font-extrabold tracking-tight">Enlace no válido</h1>
        <p className="mt-3 text-sm leading-6 text-text-muted">
          Falta el token de recuperación. Solicita un enlace nuevo para continuar de forma segura.
        </p>
        <Link
          className="mt-7 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-brand px-5 py-3 text-sm font-extrabold text-on-brand hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          to="/forgot-password"
        >
          Solicitar otro enlace
        </Link>
      </div>
    );
  }

  if (complete) {
    return (
      <div>
        <CheckCircle2 aria-hidden="true" className="size-12 text-emerald-700" />
        <h1 className="mt-5 text-3xl font-extrabold tracking-tight">Contraseña actualizada</h1>
        <p className="mt-3 text-sm leading-6 text-text-muted">
          Ya puedes acceder con tu nueva contraseña. Por seguridad, se han cerrado las sesiones anteriores.
        </p>
        <Link
          className="mt-7 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-brand px-5 py-3 text-sm font-extrabold text-on-brand hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          to="/login"
        >
          Iniciar sesión
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-extrabold tracking-tight">Crea una contraseña nueva</h1>
      <p className="mt-3 text-sm leading-6 text-text-muted">
        El enlace es de un solo uso. Elige una contraseña que no utilices en otros servicios.
      </p>
      <form className="mt-7 space-y-5" noValidate onSubmit={onSubmit}>
        <PasswordField
          autoComplete="new-password"
          error={errors.password?.message}
          help="Mínimo 8 caracteres, con mayúscula, minúscula, número y símbolo."
          label="Nueva contraseña"
          {...register('password')}
        />
        <PasswordField
          autoComplete="new-password"
          error={errors.passwordConfirmation?.message}
          label="Repite la nueva contraseña"
          {...register('passwordConfirmation')}
        />
        <AuthError error={resetPassword.error} />
        <SubmitButton
          isPending={resetPassword.isPending}
          pendingLabel="Actualizando contraseña…"
        >
          Guardar nueva contraseña
        </SubmitButton>
      </form>
    </div>
  );
}
