import { CircleDollarSign, ShieldCheck } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';

import { publicEnv } from '../../config/env';

export function PublicLayout() {
  const location = useLocation();
  const mainRef = useRef(null);

  useEffect(() => {
    const heading = mainRef.current?.querySelector('h1');
    document.title = heading
      ? `${heading.textContent} · ${publicEnv.appName}`
      : publicEnv.appName;
  }, [location.pathname]);

  return (
    <div className="min-h-dvh bg-background text-text lg:grid lg:grid-cols-[minmax(20rem,0.9fr)_minmax(30rem,1.1fr)]">
      <a
        className="fixed left-3 top-3 z-50 -translate-y-24 rounded-lg bg-brand px-4 py-3 text-sm font-bold text-on-brand shadow-lg transition-transform focus:translate-y-0 focus:outline-2 focus:outline-offset-2 focus:outline-focus"
        href="#contenido-autenticacion"
      >
        Saltar al formulario
      </a>

      <aside className="hidden bg-brand-deep p-10 text-on-brand lg:flex lg:flex-col lg:justify-between xl:p-16">
        <Link
          className="flex w-fit min-h-12 items-center gap-3 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-on-brand"
          to="/login"
        >
          <span className="grid size-11 place-items-center rounded-xl bg-on-brand text-brand-deep">
            <CircleDollarSign aria-hidden="true" className="size-7" />
          </span>
          <span className="text-xl font-extrabold tracking-tight">{publicEnv.appName}</span>
        </Link>

        <div className="max-w-lg py-16">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-on-brand-muted">
            Finanzas del hogar
          </p>
          <p className="mt-5 text-4xl font-extrabold leading-tight tracking-tight xl:text-5xl">
            Planifica los gastos con calma y con toda la casa en mente.
          </p>
          <p className="mt-6 max-w-md text-base leading-7 text-on-brand-muted">
            Una base clara para organizar gastos, aportaciones y previsiones sin perder el control.
          </p>
        </div>

        <p className="flex items-center gap-2 text-sm text-on-brand-muted">
          <ShieldCheck aria-hidden="true" className="size-5" />
          Sesiones protegidas mediante cookies seguras.
        </p>
      </aside>

      <div className="flex min-h-dvh flex-col">
        <header className="flex min-h-16 items-center px-4 sm:px-6 lg:hidden">
          <Link
            className="flex min-h-11 items-center gap-2 rounded-lg font-extrabold tracking-tight focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            to="/login"
          >
            <span className="grid size-9 place-items-center rounded-xl bg-brand text-on-brand">
              <CircleDollarSign aria-hidden="true" className="size-5" />
            </span>
            {publicEnv.appName}
          </Link>
        </header>

        <main
          className="mx-auto flex w-full max-w-xl flex-1 items-center px-4 py-8 sm:px-6 sm:py-12 lg:px-10"
          id="contenido-autenticacion"
          ref={mainRef}
          tabIndex="-1"
        >
          <div className="w-full rounded-3xl border border-border bg-surface p-5 shadow-card sm:p-8 lg:border-0 lg:p-4 lg:shadow-none">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

