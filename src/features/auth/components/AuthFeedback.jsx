import { TriangleAlert } from 'lucide-react';

export function AuthError({ error }) {
  if (!error) return null;

  return (
    <div
      className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-3.5 text-red-950"
      role="alert"
    >
      <TriangleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-red-700" />
      <div className="min-w-0">
        <p className="text-sm font-bold">No se ha podido completar la acción</p>
        <p className="mt-0.5 text-sm leading-5">{error.message}</p>
        {error.requestId ? (
          <p className="mt-1 text-xs text-red-800">Referencia: {error.requestId}</p>
        ) : null}
      </div>
    </div>
  );
}

export function SubmitButton({ children, disabled = false, isPending, pendingLabel }) {
  return (
    <button
      className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-brand px-5 py-3 text-sm font-extrabold text-on-brand shadow-sm transition-colors hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-65"
      disabled={disabled || isPending}
      type="submit"
    >
      {isPending ? pendingLabel : children}
    </button>
  );
}
