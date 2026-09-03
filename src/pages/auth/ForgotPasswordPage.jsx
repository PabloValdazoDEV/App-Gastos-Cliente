import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, MailCheck } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';

import { useForgotPasswordMutation } from '../../features/auth/authQueries';
import { forgotPasswordSchema } from '../../features/auth/authSchemas';
import { AuthError, SubmitButton } from '../../features/auth/components/AuthFeedback';
import { FormField } from '../../features/auth/components/FormField';

const genericMessage =
  'Si existe una cuenta asociada al correo, recibirás las instrucciones para restablecer la contraseña.';

export function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const forgotPassword = useForgotPasswordMutation();
  const {
    formState: { errors },
    handleSubmit,
    register,
  } = useForm({ resolver: zodResolver(forgotPasswordSchema) });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await forgotPassword.mutateAsync(values);
      setSent(true);
    } catch {
      // React Query exposes the normalized error in the form feedback.
    }
  });

  if (sent) {
    return (
      <div>
        <span className="grid size-12 place-items-center rounded-2xl bg-brand-soft text-brand-strong">
          <MailCheck aria-hidden="true" className="size-6" />
        </span>
        <h1 className="mt-5 text-3xl font-extrabold tracking-tight">Revisa tu correo</h1>
        <p className="mt-3 text-sm leading-6 text-text-muted">{genericMessage}</p>
        <Link
          className="mt-7 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-brand px-5 py-3 text-sm font-extrabold text-on-brand hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          to="/login"
        >
          Volver a iniciar sesión
        </Link>
      </div>
    );
  }

  return (
    <div>
      <Link
        className="inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-bold text-text-muted hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        to="/login"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Volver al inicio de sesión
      </Link>
      <h1 className="mt-5 text-3xl font-extrabold tracking-tight">Recupera tu contraseña</h1>
      <p className="mt-3 text-sm leading-6 text-text-muted">
        Indica tu email y, si existe una cuenta, te enviaremos un enlace de un solo uso.
      </p>

      <form className="mt-7 space-y-5" noValidate onSubmit={onSubmit}>
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
        <AuthError error={forgotPassword.error} />
        <SubmitButton
          isPending={forgotPassword.isPending}
          pendingLabel="Enviando instrucciones…"
        >
          Enviar instrucciones
        </SubmitButton>
      </form>
    </div>
  );
}
