import { X } from 'lucide-react';
import { useId, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

export function FormDialog({ children, title, description, onClose, busy = false }) {
  const dialogRef = useRef(null);
  const titleId = useId();
  const descriptionId = useId();

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    const trigger = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    const firstInput = dialog.querySelector('input, select, textarea');
    firstInput?.focus({ preventScroll: true });
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    };
  }, []);

  return createPortal(
    <dialog
      aria-describedby={description ? descriptionId : undefined}
      aria-labelledby={titleId}
      aria-modal="true"
      className="fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto overscroll-contain rounded-2xl border border-border bg-surface p-0 text-text shadow-xl backdrop:bg-black/40"
      onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}
      ref={dialogRef}
    >
      <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-border bg-surface p-5 sm:px-7">
        <div className="min-w-0">
          <h2 className="break-words text-xl font-extrabold" id={titleId}>{title}</h2>
          {description ? <p className="mt-1 text-sm leading-6 text-text-muted" id={descriptionId}>{description}</p> : null}
        </div>
        <button aria-label="Cerrar formulario" className="grid size-11 shrink-0 place-items-center rounded-xl text-text-muted hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:opacity-60" disabled={busy} onClick={onClose} type="button">
          <X aria-hidden="true" className="size-5" />
        </button>
      </div>
      <div className="min-w-0 p-5 sm:p-7">{children}</div>
    </dialog>,
    document.body,
  );
}
