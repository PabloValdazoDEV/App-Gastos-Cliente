import { Info } from 'lucide-react';

/*
 * Secondary explanations stay one tap away instead of filling the screen.
 * Native <details>: keyboard and screen-reader friendly with no extra state.
 */
export function MoreInfo({ children, className = '', label = 'Ver más' }) {
  return (
    <details className={`min-w-0 ${className}`}>
      <summary className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-lg text-sm font-semibold text-brand-strong marker:content-none hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus [&::-webkit-details-marker]:hidden">
        <Info aria-hidden="true" className="size-4 shrink-0" />
        {label}
      </summary>
      <div className="mt-1 max-w-2xl text-sm leading-6 text-text-muted">{children}</div>
    </details>
  );
}
