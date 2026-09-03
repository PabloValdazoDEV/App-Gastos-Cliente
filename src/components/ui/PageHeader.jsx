export function PageHeader({ description, eyebrow, title }) {
  return (
    <header className="max-w-3xl">
      {eyebrow ? (
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-brand-strong">
          {eyebrow}
        </p>
      ) : null}
      <h1 className="text-balance text-2xl font-extrabold tracking-tight text-text sm:text-3xl">
        {title}
      </h1>
      {description ? (
        <p className="mt-2 max-w-2xl text-pretty text-sm leading-6 text-text-muted sm:text-base sm:leading-7">
          {description}
        </p>
      ) : null}
    </header>
  );
}
