import { Info } from 'lucide-react';
import { useId, useState } from 'react';

/*
 * Small ⓘ button that reveals a field's help text. The text stays in the DOM
 * (hidden) so aria-describedby keeps announcing it to screen readers.
 */
export function useHelpToggle(label) {
  const [open, setOpen] = useState(false);
  const buttonId = useId();
  const button = (controlsId) => (
    <button
      aria-controls={controlsId}
      aria-expanded={open}
      aria-label={`${open ? 'Ocultar ayuda' : 'Ayuda'}: ${label}`}
      className="-my-2 grid size-9 shrink-0 place-items-center rounded-full text-text-muted hover:bg-surface-muted hover:text-brand-strong focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus"
      id={buttonId}
      onClick={() => setOpen((current) => !current)}
      type="button"
    >
      <Info aria-hidden="true" className="size-4" />
    </button>
  );
  return { open, button };
}
