import { MoreInfo } from './MoreInfo';

export function PageHeader({ description, eyebrow, title }) {
  return (
    <header className="max-w-3xl">
      {eyebrow ? (
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-brand-strong">
          {eyebrow}
        </p>
      ) : null}
      <h1 className="text-balance text-2xl font-extrabold tracking-tight text-text focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus sm:text-3xl">
        {title}
      </h1>
      {description ? <MoreInfo className="mt-1">{description}</MoreInfo> : null}
    </header>
  );
}
