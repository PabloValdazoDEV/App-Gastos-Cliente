import { useEffect, useId, useRef } from 'react';

import { AuthError } from '../auth/components/AuthFeedback';

export function PurchaseConfirmation({ title, description, confirmLabel, isPending, error, onCancel, onConfirm }) {
  const titleId = useId();
  const descriptionId = useId();
  const cancelRef = useRef(null);
  const dialogRef = useRef(null);
  useEffect(() => { cancelRef.current?.focus(); }, []);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4">
      <div aria-hidden="true" className="absolute inset-0 bg-black/40" />
      <section aria-describedby={descriptionId} aria-labelledby={titleId} aria-modal="true" className="relative w-full min-w-0 max-w-lg rounded-2xl border border-border bg-surface p-5 shadow-xl sm:p-6" ref={dialogRef} role="dialog" onKeyDown={(event) => {
        if (event.key === 'Escape' && !isPending) { event.stopPropagation(); onCancel(); }
        if (event.key === 'Tab') {
          const buttons = [...dialogRef.current.querySelectorAll('button:not(:disabled)')];
          const first = buttons[0];
          const last = buttons.at(-1);
          if (!first) event.preventDefault();
          else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        }
      }}>
        <h2 className="break-words text-lg font-extrabold text-text" id={titleId}>{title}</h2>
        <p className="mt-2 break-words text-sm leading-6 text-text-muted" id={descriptionId}>{description}</p>
        <div className="mt-4"><AuthError error={error} /></div>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border-strong px-4 py-2.5 text-sm font-bold hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:opacity-60" disabled={isPending} onClick={onCancel} ref={cancelRef} type="button">Cancelar</button>
          <button className="inline-flex min-h-11 items-center justify-center rounded-xl bg-red-700 px-4 py-2.5 text-sm font-extrabold text-white hover:bg-red-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 disabled:opacity-60" disabled={isPending} onClick={onConfirm} type="button">{isPending ? 'Guardando…' : confirmLabel}</button>
        </div>
      </section>
    </div>
  );
}
