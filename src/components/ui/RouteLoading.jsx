export function RouteLoading() {
  return (
    <div aria-busy="true" className="grid min-h-48 place-items-center" role="status">
      <span className="sr-only">Cargando página…</span>
      <span
        aria-hidden="true"
        className="size-9 animate-spin rounded-full border-4 border-brand-soft border-t-brand motion-reduce:animate-none"
      />
    </div>
  );
}

