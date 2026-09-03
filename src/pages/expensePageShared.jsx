import { TriangleAlert, WalletCards, X } from 'lucide-react';
import { useEffect, useId, useRef } from 'react';

import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState, LoadingState } from '../components/ui/FeedbackStates';
import { controlClassName } from './expensePageUtils';

export function SelectField({ children, error, label, name, ...props }) {
  const generatedId = useId();
  const id = props.id ?? `${name}-${generatedId}`;
  const errorId = `${id}-error`;

  return (
    <div>
      <label className="mb-1.5 block text-sm font-bold text-text" htmlFor={id}>
        {label}
      </label>
      <select
        {...props}
        aria-describedby={error ? errorId : undefined}
        aria-invalid={Boolean(error)}
        className={`${controlClassName} ${error ? 'border-red-500 focus:border-red-600 focus:ring-red-100' : ''}`}
        id={id}
        name={name}
      >
        {children}
      </select>
      {error ? (
        <p className="mt-1.5 text-sm font-medium text-red-700" id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function TextareaField({ error, help, label, name, ...props }) {
  const generatedId = useId();
  const id = props.id ?? `${name}-${generatedId}`;
  const errorId = `${id}-error`;
  const helpId = `${id}-help`;

  return (
    <div>
      <label className="mb-1.5 block text-sm font-bold text-text" htmlFor={id}>
        {label}
      </label>
      <textarea
        {...props}
        aria-describedby={error ? errorId : help ? helpId : undefined}
        aria-invalid={Boolean(error)}
        className={`${controlClassName} min-h-24 resize-y ${error ? 'border-red-500 focus:border-red-600 focus:ring-red-100' : ''}`}
        id={id}
        name={name}
      />
      {error ? (
        <p className="mt-1.5 text-sm font-medium text-red-700" id={errorId} role="alert">
          {error}
        </p>
      ) : help ? (
        <p className="mt-1.5 text-xs leading-5 text-text-muted" id={helpId}>
          {help}
        </p>
      ) : null}
    </div>
  );
}

export function FormCard({ children, description, onClose, title }) {
  const titleId = useId();

  return (
    <section
      aria-labelledby={titleId}
      className="rounded-3xl border border-border bg-surface p-5 shadow-card sm:p-7"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight text-text" id={titleId}>
            {title}
          </h2>
          {description ? (
            <p className="mt-1 text-sm leading-6 text-text-muted">{description}</p>
          ) : null}
        </div>
        {onClose ? (
          <button
            aria-label="Cerrar formulario"
            className="grid size-11 shrink-0 place-items-center rounded-xl text-text-muted transition-colors hover:bg-surface-muted hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            onClick={onClose}
            type="button"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        ) : null}
      </div>
      <div className="mt-6">{children}</div>
    </section>
  );
}

export function ConfirmationDialog({
  cancelLabel = 'Cancelar',
  confirmLabel = 'Eliminar',
  description,
  isPending = false,
  onCancel,
  onConfirm,
  pendingLabel = 'Eliminando…',
  title,
}) {
  const titleId = useId();
  const descriptionId = useId();
  const cancelRef = useRef(null);

  useEffect(() => {
    cancelRef.current?.focus();
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !isPending) onCancel();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isPending, onCancel]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div aria-hidden="true" className="absolute inset-0 bg-black/40" />
      <section
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className="relative w-full max-w-lg rounded-2xl border border-border bg-surface p-5 shadow-xl sm:p-6"
        role="dialog"
      >
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-red-100 text-red-700">
            <TriangleAlert aria-hidden="true" className="size-5" />
          </span>
          <div>
            <h2 className="text-lg font-extrabold text-text" id={titleId}>{title}</h2>
            <p className="mt-2 text-sm leading-6 text-text-muted" id={descriptionId}>{description}</p>
          </div>
        </div>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border-strong bg-surface px-4 py-2.5 text-sm font-bold text-text hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isPending}
            onClick={onCancel}
            ref={cancelRef}
            type="button"
          >
            {cancelLabel}
          </button>
          <button
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-red-700 px-4 py-2.5 text-sm font-extrabold text-white hover:bg-red-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 disabled:cursor-wait disabled:opacity-60"
            disabled={isPending}
            onClick={onConfirm}
            type="button"
          >
            {isPending ? pendingLabel : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}

export function HouseholdGate({ household, children }) {
  if (household.isPending) return <LoadingState label="Cargando hogar" />;
  if (household.isError) {
    return (
      <ErrorState
        description={household.error?.message}
        onRetry={household.refetch}
        title="No se ha podido cargar el hogar"
      />
    );
  }
  if (!household.currentHousehold) {
    return (
      <EmptyState
        description="Crea o selecciona un hogar antes de registrar gastos. Así cada dato quedará asociado al presupuesto correcto."
        icon={WalletCards}
        title="Necesitas un hogar"
      />
    );
  }
  return children;
}
