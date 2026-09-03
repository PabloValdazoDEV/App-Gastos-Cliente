import { useId } from 'react';

export function EmptyState({ action, description, icon: Icon, title }) {
  const titleId = useId();

  return (
    <section
      aria-labelledby={titleId}
      className="rounded-3xl border border-dashed border-border-strong bg-surface px-5 py-8 text-left sm:px-8 sm:py-10"
    >
      <span className="grid size-11 place-items-center rounded-2xl bg-brand-soft text-brand-strong">
        <Icon aria-hidden="true" className="size-6" strokeWidth={1.9} />
      </span>
      <h2 className="mt-5 text-lg font-bold text-text" id={titleId}>
        {title}
      </h2>
      <p className="mt-2 max-w-xl text-sm leading-6 text-text-muted">
        {description}
      </p>
      {action ? <div className="mt-6">{action}</div> : null}
    </section>
  );
}
