export function MetricCard({ helper, icon: Icon, label, value = 'Sin datos' }) {
  return (
    <article className="rounded-2xl border border-border bg-surface p-4 shadow-card sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm font-semibold text-text-muted">{label}</p>
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface-muted text-text-muted">
          <Icon aria-hidden="true" className="size-5" strokeWidth={1.9} />
        </span>
      </div>
      <p className="mt-4 text-xl font-extrabold tracking-tight text-text">{value}</p>
      <p className="mt-1 text-xs leading-5 text-text-soft">{helper}</p>
    </article>
  );
}
