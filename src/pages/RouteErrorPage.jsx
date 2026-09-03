import { CircleDollarSign, TriangleAlert } from 'lucide-react';
import { useEffect } from 'react';

import { publicEnv } from '../config/env';

export function RouteErrorPage() {
  useEffect(() => {
    document.title = `Error · ${publicEnv.appName}`;
  }, []);

  return (
    <main className="grid min-h-dvh place-items-center bg-background px-4 py-10 text-text">
      <section
        aria-labelledby="route-error-title"
        className="w-full max-w-xl rounded-3xl border border-border bg-surface px-5 py-9 shadow-card sm:px-10 sm:py-12"
        role="alert"
      >
        <span className="grid size-12 place-items-center rounded-2xl bg-red-50 text-red-700">
          <TriangleAlert aria-hidden="true" className="size-6" />
        </span>
        <p className="mt-6 text-sm font-bold text-red-700">Error de la aplicación</p>
        <h1
          className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl"
          id="route-error-title"
        >
          No hemos podido mostrar esta página
        </h1>
        <p className="mt-3 text-sm leading-6 text-text-muted sm:text-base">
          Vuelve al inicio para reintentar. Si el problema continúa, inténtalo de
          nuevo dentro de unos minutos.
        </p>
        <a
          className="mt-7 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-bold text-on-brand transition-colors hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          href="/dashboard"
        >
          <CircleDollarSign aria-hidden="true" className="size-5" />
          Volver al inicio
        </a>
      </section>
    </main>
  );
}
