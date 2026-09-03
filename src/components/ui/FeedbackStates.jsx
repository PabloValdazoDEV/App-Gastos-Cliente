import { CheckCircle2, LockKeyhole, TriangleAlert } from 'lucide-react';
import { useId } from 'react';

export function LoadingState({ label = 'Cargando contenido' }) {
  return (
    <section
      aria-busy="true"
      aria-live="polite"
      className="space-y-4"
      role="status"
    >
      <span className="sr-only">{label}</span>
      <div aria-hidden="true" className="animate-pulse space-y-4 motion-reduce:animate-none">
        <div className="h-7 w-2/3 max-w-sm rounded-lg bg-surface-muted" />
        <div className="h-28 rounded-3xl bg-surface-muted" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <div className="h-28 rounded-2xl bg-surface-muted" key={item} />
          ))}
        </div>
      </div>
    </section>
  );
}

export function ErrorState({
  description = 'No hemos podido cargar la información. Comprueba tu conexión e inténtalo de nuevo.',
  onRetry,
  title = 'Algo no ha ido bien',
}) {
  const titleId = useId();

  return (
    <section
      aria-labelledby={titleId}
      className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-950"
      role="alert"
    >
      <TriangleAlert aria-hidden="true" className="size-6 text-red-700" />
      <h2 className="mt-3 font-bold" id={titleId}>
        {title}
      </h2>
      <p className="mt-1 text-sm leading-6 text-red-900">{description}</p>
      {onRetry ? (
        <button
          className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl border border-red-300 bg-surface px-4 py-2 text-sm font-bold text-red-900 transition-colors hover:bg-red-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
          onClick={onRetry}
          type="button"
        >
          Volver a intentarlo
        </button>
      ) : null}
    </section>
  );
}

export function SuccessNotice({ description, title }) {
  return (
    <section
      aria-live="polite"
      className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950"
      role="status"
    >
      <CheckCircle2
        aria-hidden="true"
        className="mt-0.5 size-5 shrink-0 text-emerald-700"
      />
      <div>
        <p className="font-bold">{title}</p>
        {description ? (
          <p className="mt-1 text-sm leading-6 text-emerald-900">
            {description}
          </p>
        ) : null}
      </div>
    </section>
  );
}

export function RestrictedState({
  description = 'Tu rol actual no permite ver o modificar esta información.',
  title = 'Acceso limitado',
}) {
  const titleId = useId();

  return (
    <section
      aria-labelledby={titleId}
      className="rounded-2xl border border-border bg-surface p-5"
    >
      <LockKeyhole aria-hidden="true" className="size-6 text-text-muted" />
      <h2 className="mt-3 font-bold text-text" id={titleId}>
        {title}
      </h2>
      <p className="mt-1 text-sm leading-6 text-text-muted">{description}</p>
    </section>
  );
}
