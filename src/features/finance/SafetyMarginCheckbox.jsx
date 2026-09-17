import { forwardRef, useId } from 'react';

export const SafetyMarginCheckbox = forwardRef(function SafetyMarginCheckbox(
  { label, help, groupName, children, ...inputProps },
  ref,
) {
  const id = useId();
  return (
    <fieldset className="min-w-0 rounded-xl border border-border bg-surface-muted p-4">
      <legend className="px-1 text-sm font-bold text-text">
        Margen de seguridad{groupName ? <span className="sr-only"> · {groupName}</span> : null}
      </legend>
      <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-semibold text-text has-[:disabled]:cursor-wait has-[:disabled]:text-text-muted" htmlFor={id}>
        <input {...inputProps} aria-describedby={`${id}-help`} className="size-4 shrink-0 accent-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" id={id} ref={ref} type="checkbox" />
        <span className="min-w-0 break-words">{label}{groupName ? <span className="sr-only"> · {groupName}</span> : null}</span>
      </label>
      <p className="mt-2 text-xs leading-5 text-text-muted" id={`${id}-help`}>{help}</p>
      {children}
    </fieldset>
  );
});
