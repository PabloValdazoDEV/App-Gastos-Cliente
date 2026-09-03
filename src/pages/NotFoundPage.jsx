import { Compass } from 'lucide-react';
import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <section className="mx-auto max-w-xl rounded-3xl border border-border bg-surface px-5 py-10 shadow-card sm:px-10 sm:py-14">
      <span className="grid size-12 place-items-center rounded-2xl bg-brand-soft text-brand-strong">
        <Compass aria-hidden="true" className="size-6" />
      </span>
      <p className="mt-6 text-sm font-bold text-brand-strong">Error 404</p>
      <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-text sm:text-3xl">
        Esta página no existe
      </h1>
      <p className="mt-3 text-sm leading-6 text-text-muted sm:text-base">
        Puede que el enlace haya cambiado o que la dirección no sea correcta.
      </p>
      <Link
        className="mt-7 inline-flex min-h-12 items-center justify-center rounded-xl bg-brand px-5 py-3 text-sm font-bold text-on-brand transition-colors hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        to="/dashboard"
      >
        Volver al inicio
      </Link>
    </section>
  );
}
