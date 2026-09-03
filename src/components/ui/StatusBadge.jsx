export function StatusBadge({ children }) {
  return (
    <span className="inline-flex min-h-7 items-center gap-1.5 rounded-full border border-current/20 bg-surface/10 px-2.5 py-1 text-xs font-bold text-inherit">
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}
