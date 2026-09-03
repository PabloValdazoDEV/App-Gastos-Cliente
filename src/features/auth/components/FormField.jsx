import { Eye, EyeOff } from 'lucide-react';
import { forwardRef, useId, useState } from 'react';

const inputClasses = [
  'min-h-12 w-full rounded-xl border border-border-strong bg-surface px-3.5 py-2.5 text-base text-text shadow-sm outline-none transition-colors',
  'placeholder:text-text-soft focus:border-brand focus:ring-3 focus:ring-brand-soft',
  'disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-text-muted',
].join(' ');

export const FormField = forwardRef(function FormField(
  {
    autoComplete,
    className = '',
    error,
    help,
    label,
    name,
    placeholder,
    type = 'text',
    ...inputProps
  },
  ref,
) {
  const generatedId = useId();
  const inputId = inputProps.id ?? `${name}-${generatedId}`;
  const errorId = `${inputId}-error`;
  const helpId = `${inputId}-help`;
  const describedBy = error ? errorId : help ? helpId : undefined;

  return (
    <div>
      <label className="mb-1.5 block text-sm font-bold text-text" htmlFor={inputId}>
        {label}
      </label>
      <input
        {...inputProps}
        aria-describedby={describedBy}
        aria-invalid={Boolean(error)}
        autoComplete={autoComplete}
        className={`${inputClasses} ${className} ${error ? 'border-red-500 focus:border-red-600 focus:ring-red-100' : ''}`}
        id={inputId}
        name={name}
        placeholder={placeholder}
        ref={ref}
        type={type}
      />
      {error ? (
        <p className="mt-1.5 text-sm font-medium text-red-700" id={errorId} role="alert">
          {error}
        </p>
      ) : help ? (
        <p className="mt-1.5 text-xs leading-5 text-text-muted" id={helpId}>
          {help}
        </p>
      ) : null}
    </div>
  );
});

export const PasswordField = forwardRef(function PasswordField(props, ref) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <FormField {...props} className="pr-12" ref={ref} type={visible ? 'text' : 'password'} />
      <button
        aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        className="absolute right-1.5 top-[1.7rem] grid size-11 place-items-center rounded-lg text-text-muted transition-colors hover:bg-surface-muted hover:text-text focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus"
        onClick={() => setVisible((current) => !current)}
        type="button"
      >
        {visible ? (
          <EyeOff aria-hidden="true" className="size-5" />
        ) : (
          <Eye aria-hidden="true" className="size-5" />
        )}
      </button>
    </div>
  );
});
