import { zodResolver } from '@hookform/resolvers/zod';
import { Chrome, ExternalLink, TriangleAlert } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import {
  Link,
  useLocation,
  useNavigate,
  useSearchParams,
} from 'react-router-dom';

import { publicEnv } from '../../config/env';
import { useRegisterMutation } from '../../features/auth/authQueries';
import {
  getAuthDestination,
  storeAuthDestination,
} from '../../features/auth/authReturnTo';
import { registerSchema } from '../../features/auth/authSchemas';
import { AuthError, SubmitButton } from '../../features/auth/components/AuthFeedback';
import { FormField, PasswordField } from '../../features/auth/components/FormField';
import { usePrivacyPolicyQuery } from '../../features/legal/privacyPolicyQueries';

const privacyAcknowledgement =
  'Confirmo que he leído la Política de privacidad y he sido informado sobre el tratamiento de mis datos';
const privacyRedirectErrors = Object.freeze({
  PRIVACY_POLICY_NOT_CONFIGURED:
    'El registro está deshabilitado hasta que el responsable complete la Política de privacidad.',
  PRIVACY_POLICY_OUTDATED:
    'La Política de privacidad ha cambiado. Revisa la versión vigente y vuelve a confirmar que la has leído.',
});

function BasicPrivacyInformation({ metadata }) {
  if (!metadata?.configured || !metadata.version) return null;

  const controller = metadata.controller ?? {};

  return (
    <details className="rounded-2xl border border-border bg-surface p-4" open>
      <summary className="flex min-h-11 cursor-pointer items-center font-bold text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
        Información básica de protección de datos
      </summary>
      <dl className="mt-3 space-y-3 text-sm leading-6 text-text-muted">
        <div>
          <dt className="font-bold text-text">Responsable</dt>
          <dd>
            {controller.name ?? 'No configurado'}
            {controller.contactEmail ? (
              <>
                {' · '}
                <a className="font-bold text-brand-strong underline" href={`mailto:${controller.contactEmail}`}>
                  {controller.contactEmail}
                </a>
              </>
            ) : null}
          </dd>
        </div>
        <div>
          <dt className="font-bold text-text">Finalidades</dt>
          <dd>Crear y proteger tu cuenta, gestionar hogares compartidos y ofrecer presupuestos, planificación y previsiones financieras orientativas.</dd>
        </div>
        <div>
          <dt className="font-bold text-text">Bases jurídicas</dt>
          <dd>Ejecución del servicio solicitado; y, cuando el responsable las confirme y documente, obligaciones legales, interés legítimo para seguridad o consentimiento para funciones opcionales que lo requieran.</dd>
        </div>
        <div>
          <dt className="font-bold text-text">Destinatarios y transferencias</dt>
          <dd>Personas autorizadas del hogar, proveedores técnicamente necesarios y autoridades cuando proceda. Si un proveedor implica transferencias fuera del EEE, el responsable debe identificar y documentar antes el mecanismo y las garantías aplicables.</dd>
        </div>
        <div>
          <dt className="font-bold text-text">Derechos</dt>
          <dd>Acceso, rectificación, supresión, limitación, oposición y portabilidad cuando resulten aplicables. Puedes dirigirte al contacto anterior y reclamar ante la AEPD.</dd>
        </div>
      </dl>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
        <Link
          className="inline-flex min-h-11 items-center font-bold text-brand-strong underline underline-offset-4"
          rel="noreferrer"
          target="_blank"
          to="/privacidad"
        >
          Leer la información detallada
          <span className="sr-only"> en una pestaña nueva</span>
        </Link>
        <a
          className="inline-flex min-h-11 items-center gap-1 font-bold text-brand-strong underline underline-offset-4"
          href="https://www.aepd.es/derechos-y-deberes/ejerce-tus-derechos"
          rel="noreferrer"
          target="_blank"
        >
          Consultar la AEPD
          <ExternalLink aria-hidden="true" className="size-4" />
          <span className="sr-only"> (se abre en una pestaña nueva)</span>
        </a>
      </div>
    </details>
  );
}

function PrivacyPolicyAvailability({ query }) {
  if (query.isPending || query.isFetching) {
    return (
      <p
        className="rounded-xl border border-border bg-surface-muted p-3 text-sm text-text-muted"
        id="privacy-policy-status"
        role="status"
      >
        Comprobando la información de privacidad necesaria para el registro…
      </p>
    );
  }

  if (query.isError) {
    return (
      <div
        className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-red-950"
        id="privacy-policy-status"
        role="alert"
      >
        <div className="flex items-start gap-3">
          <TriangleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-red-700" />
          <div>
            <p className="text-sm font-bold">No podemos habilitar el registro</p>
            <p className="mt-1 text-sm leading-5">
              No se ha podido cargar la Política de privacidad. Reintenta la consulta antes de crear la cuenta.
            </p>
            <button
              className="mt-3 min-h-11 rounded-lg border border-red-300 bg-surface px-3 text-sm font-bold text-red-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
              onClick={() => query.refetch()}
              type="button"
            >
              Reintentar carga de la política
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!query.data?.configured || !query.data?.version) {
    return (
      <div
        className="rounded-xl border border-amber-300 bg-amber-50 p-3.5 text-amber-950"
        id="privacy-policy-status"
        role="alert"
      >
        <p className="text-sm font-bold">Registro temporalmente no disponible</p>
        <p className="mt-1 text-sm leading-5">
          El responsable aún no ha configurado todos los datos obligatorios y la versión de la Política de privacidad. No es posible crear cuentas hasta completarlos.
        </p>
      </div>
    );
  }

  return (
    <p className="text-xs leading-5 text-text-soft" id="privacy-policy-status">
      Política {query.data.version ? `versión ${query.data.version}` : 'vigente'}
      {query.data.effectiveDate ? ` · efectiva desde ${query.data.effectiveDate}` : ''}.
    </p>
  );
}

export function RegisterPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const createAccount = useRegisterMutation();
  const privacyPolicy = usePrivacyPolicyQuery();
  const displayedPolicyVersion = useRef(null);
  const {
    formState: { errors },
    handleSubmit,
    register,
    setValue,
    watch,
  } = useForm({
    defaultValues: {
      privacyPolicyAcknowledged: false,
      privacyPolicyVersion: '',
    },
    resolver: zodResolver(registerSchema),
  });
  const policyVersion = privacyPolicy.data?.version;
  const policyReady =
    privacyPolicy.isSuccess
    && !privacyPolicy.isFetching
    && privacyPolicy.data?.configured === true
    && typeof policyVersion === 'string'
    && policyVersion.length > 0;
  const policyAcknowledged = watch('privacyPolicyAcknowledged');
  const googleRegistrationEnabled =
    policyReady && policyAcknowledged && !createAccount.isPending;
  const googleRegistrationUrl = `${publicEnv.apiUrl}/auth/google/start?privacyPolicyAcknowledged=true&privacyPolicyVersion=${encodeURIComponent(policyVersion ?? '')}`;
  const privacyRedirectError = privacyRedirectErrors[searchParams.get('privacyError')];
  const privacySubmissionError = privacyRedirectErrors[createAccount.error?.code];
  const privacyError = privacyRedirectError ?? privacySubmissionError;

  useEffect(() => {
    if (!policyReady) return;

    if (
      displayedPolicyVersion.current
      && displayedPolicyVersion.current !== policyVersion
    ) {
      setValue('privacyPolicyAcknowledged', false, { shouldValidate: true });
    }

    displayedPolicyVersion.current = policyVersion;
    setValue('privacyPolicyVersion', policyVersion, {
      shouldValidate: false,
    });
  }, [policyReady, policyVersion, setValue]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      await createAccount.mutateAsync({
        email: values.email,
        name: values.name,
        password: values.password,
        privacyPolicyAcknowledged: values.privacyPolicyAcknowledged,
        privacyPolicyVersion: values.privacyPolicyVersion,
      });
      navigate(getAuthDestination(location.state?.from), { replace: true });
    } catch (error) {
      if (
        error?.code === 'PRIVACY_POLICY_OUTDATED'
        || error?.code === 'PRIVACY_POLICY_NOT_CONFIGURED'
      ) {
        setValue('privacyPolicyAcknowledged', false);
        setValue('privacyPolicyVersion', '');
        privacyPolicy.refetch();
      }
      // React Query exposes the normalized error in the form feedback.
    }
  });

  return (
    <div>
      <p className="text-sm font-bold text-brand-strong">Empieza en unos minutos</p>
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-text">
        Crea tu cuenta
      </h1>
      <p className="mt-3 text-sm leading-6 text-text-muted">
        Solo necesitamos tus datos de acceso. Configurarás el hogar después.
      </p>

      {privacyError ? (
        <div
          className="mt-5 flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-3.5 text-amber-950"
          role="alert"
        >
          <TriangleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
          <div>
            <p className="text-sm font-bold">Revisa la información de privacidad</p>
            <p className="mt-1 text-sm leading-5">{privacyError}</p>
          </div>
        </div>
      ) : null}

      <form className="mt-7 space-y-5" noValidate onSubmit={onSubmit}>
        <FormField
          autoComplete="name"
          error={errors.name?.message}
          label="Nombre"
          placeholder="Cómo quieres que te llamemos"
          {...register('name')}
        />
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
        <PasswordField
          autoComplete="new-password"
          error={errors.password?.message}
          help="Mínimo 8 caracteres, con mayúscula, minúscula, número y símbolo."
          label="Contraseña"
          {...register('password')}
        />
        <PasswordField
          autoComplete="new-password"
          error={errors.passwordConfirmation?.message}
          label="Repite la contraseña"
          {...register('passwordConfirmation')}
        />
        <input type="hidden" {...register('privacyPolicyVersion')} />

        <BasicPrivacyInformation metadata={privacyPolicy.data} />

        <div className="space-y-3 rounded-2xl border border-border bg-surface-muted p-4">
          <div className="flex items-start gap-3">
            <input
              aria-describedby={
                errors.privacyPolicyAcknowledged
                  ? 'privacy-policy-error'
                  : 'privacy-policy-status'
              }
              aria-invalid={Boolean(errors.privacyPolicyAcknowledged)}
              className="mt-1 size-5 shrink-0 rounded accent-brand disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!policyReady}
              id="privacy-policy-acknowledged"
              type="checkbox"
              {...register('privacyPolicyAcknowledged')}
            />
            <div className="min-w-0">
              <label
                className="block cursor-pointer text-sm font-semibold leading-6 text-text"
                htmlFor="privacy-policy-acknowledged"
              >
                {privacyAcknowledgement}
              </label>
              <Link
                className="mt-2 inline-flex min-h-11 items-center text-sm font-bold text-brand-strong underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                rel="noreferrer"
                target="_blank"
                to="/privacidad"
              >
                Abrir la Política de privacidad
                <span className="sr-only"> en una pestaña nueva</span>
              </Link>
            </div>
          </div>
          {errors.privacyPolicyAcknowledged ? (
            <p
              className="text-sm font-semibold text-red-700"
              id="privacy-policy-error"
              role="alert"
            >
              {errors.privacyPolicyAcknowledged.message}
            </p>
          ) : null}
          {errors.privacyPolicyVersion ? (
            <p className="text-sm font-semibold text-red-700" role="alert">
              {errors.privacyPolicyVersion.message}
            </p>
          ) : null}
          <PrivacyPolicyAvailability query={privacyPolicy} />
        </div>

        {privacySubmissionError ? null : <AuthError error={createAccount.error} />}
        <SubmitButton
          disabled={!policyReady}
          isPending={createAccount.isPending}
          pendingLabel="Creando tu cuenta…"
        >
          Crear mi cuenta
        </SubmitButton>

        {publicEnv.enableGoogleLogin ? (
          <>
            <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-text-soft">
              <span className="h-px flex-1 bg-border" />
              o
              <span className="h-px flex-1 bg-border" />
            </div>
            <a
              aria-describedby="privacy-policy-status"
              aria-disabled={!googleRegistrationEnabled}
              className={`inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-border-strong bg-surface px-5 py-3 text-sm font-extrabold text-text shadow-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${
                googleRegistrationEnabled
                  ? 'hover:bg-surface-muted'
                  : 'cursor-not-allowed opacity-60'
              }`}
              href={googleRegistrationUrl}
              onClick={(event) => {
                if (!googleRegistrationEnabled) {
                  event.preventDefault();
                  return;
                }

                storeAuthDestination(location.state?.from);
              }}
            >
              <Chrome aria-hidden="true" className="size-5" />
              Crear cuenta con Google
            </a>
          </>
        ) : null}
      </form>

      <p className="mt-7 text-center text-sm text-text-muted">
        ¿Ya tienes cuenta?{' '}
        <Link
          className="font-bold text-brand-strong underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          state={{ from: location.state?.from }}
          to="/login"
        >
          Iniciar sesión
        </Link>
      </p>
    </div>
  );
}
