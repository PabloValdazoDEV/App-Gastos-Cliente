import { ChevronDown, Filter, Search, TriangleAlert, WalletCards, X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';

import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState, LoadingState } from '../components/ui/FeedbackStates';
import { controlClassName } from './expensePageUtils';

export function SelectField({ children, error, label, name, ...props }) {
  const generatedId = useId();
  const id = props.id ?? `${name}-${generatedId}`;
  const errorId = `${id}-error`;

  return (
    <div className="min-w-0">
      <label className="mb-1.5 block text-sm font-bold text-text" htmlFor={id}>
        {label}
      </label>
      <select
        {...props}
        aria-describedby={error ? errorId : undefined}
        aria-invalid={Boolean(error)}
        className={`${controlClassName} ${error ? 'border-red-500 focus:border-red-600 focus:ring-red-100' : ''}`}
        id={id}
        name={name}
      >
        {children}
      </select>
      {error ? (
        <p className="mt-1.5 text-sm font-medium text-red-700" id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function ExpenseFilters({
  additionalFilters = [],
  categories = [],
  categoryId = 'ALL',
  onCategoryChange,
  onScopeChange,
  onSearchChange,
  search = '',
  searchLabel = 'Buscar gastos',
  scope = 'ALL',
}) {
  const [expanded, setExpanded] = useState(false);
  const panelId = useId();
  const searchId = useId();
  const toggleRef = useRef(null);
  const searchRef = useRef(null);
  const filters = [
    ...(onScopeChange ? [{
      id: 'scope', label: 'Ámbito', value: scope, onChange: onScopeChange,
      options: [
        { value: 'ALL', label: 'Todos' },
        { value: 'HOUSEHOLD', label: 'Comunes' },
        { value: 'PERSONAL', label: 'Personales' },
      ],
    }] : []),
    ...(onCategoryChange ? [{
      id: 'category', label: 'Categoría', value: categoryId, onChange: onCategoryChange,
      options: [
        { value: 'ALL', label: 'Todas' },
        ...categories.map((category) => ({ value: category.id, label: category.name })),
      ],
    }] : []),
    ...additionalFilters,
  ];
  const activeCount = filters.filter((filter) => filter.value !== (filter.defaultValue ?? 'ALL')).length;
  const canClear = activeCount > 0 || search.length > 0;

  function clearFilters() {
    onSearchChange('');
    filters.forEach((filter) => filter.onChange(filter.defaultValue ?? 'ALL'));
    searchRef.current?.focus();
  }

  return (
    <div className="min-w-0 rounded-2xl border border-border bg-surface p-3 shadow-card sm:p-4">
      <label className="mb-1.5 block text-sm font-bold text-text" htmlFor={searchId}>{searchLabel}</label>
      <div className="flex items-end gap-2 sm:gap-3">
          <div className="relative min-w-0 flex-1">
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-4 size-4 text-text-soft" />
            <input
              className="min-h-12 w-full min-w-0 rounded-xl border border-border-strong bg-surface pl-10 pr-3 text-base text-text outline-none focus:border-focus focus:ring-2 focus:ring-focus/20"
              onChange={(event) => onSearchChange(event.target.value)}
              id={searchId}
              placeholder="Nombre, categoría o nota"
              ref={searchRef}
              type="search"
              value={search}
            />
          </div>
        <button
          aria-controls={panelId}
          aria-expanded={expanded}
          className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl border border-border-strong px-3 py-2 text-sm font-bold text-text hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          onClick={() => setExpanded((current) => !current)}
          ref={toggleRef}
          type="button"
        >
          <Filter aria-hidden="true" className="size-4 shrink-0" />
          Filtros
          {activeCount > 0 ? (
            <span className="rounded-full bg-brand-soft px-1.5 py-0.5 text-xs text-brand-strong">
              {activeCount}<span className="sr-only"> {activeCount === 1 ? 'activo' : 'activos'}</span>
            </span>
          ) : null}
          <ChevronDown aria-hidden="true" className={`hidden size-4 sm:block ${expanded ? 'rotate-180' : ''}`} />
        </button>
      </div>
      <div
        hidden={!expanded}
        id={panelId}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.stopPropagation();
            setExpanded(false);
            toggleRef.current?.focus();
          }
        }}
      >
        <div className="mt-4 grid min-w-0 gap-3 border-t border-border pt-4 sm:grid-cols-2 lg:grid-cols-3">
          {filters.map((filter) => (
            <SelectField key={filter.id} label={filter.label} onChange={(event) => filter.onChange(event.target.value)} value={filter.value}>
              {filter.options.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </SelectField>
          ))}
        </div>
      </div>
      {canClear ? (
        <button
          className="mt-2 inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-bold text-brand-strong underline underline-offset-4 hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          onClick={clearFilters}
          type="button"
        >
          Limpiar filtros
        </button>
      ) : null}
    </div>
  );
}

export function TextareaField({ error, help, label, name, ...props }) {
  const generatedId = useId();
  const id = props.id ?? `${name}-${generatedId}`;
  const errorId = `${id}-error`;
  const helpId = `${id}-help`;

  return (
    <div>
      <label className="mb-1.5 block text-sm font-bold text-text" htmlFor={id}>
        {label}
      </label>
      <textarea
        {...props}
        aria-describedby={error ? errorId : help ? helpId : undefined}
        aria-invalid={Boolean(error)}
        className={`${controlClassName} min-h-24 resize-y ${error ? 'border-red-500 focus:border-red-600 focus:ring-red-100' : ''}`}
        id={id}
        name={name}
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
}

export function FormCard({ children, compact = false, description, onClose, title }) {
  const titleId = useId();

  return (
    <section
      aria-labelledby={titleId}
      className={`min-w-0 border border-border bg-surface shadow-card ${compact ? 'rounded-xl p-3 sm:p-5' : 'rounded-3xl p-5 sm:p-7'}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="break-words text-xl font-extrabold tracking-tight text-text" id={titleId}>
            {title}
          </h2>
          {description ? (
            <p className="mt-1 text-sm leading-6 text-text-muted">{description}</p>
          ) : null}
        </div>
        {onClose ? (
          <button
            aria-label="Cerrar formulario"
            className="grid size-11 shrink-0 place-items-center rounded-xl text-text-muted transition-colors hover:bg-surface-muted hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            onClick={onClose}
            type="button"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        ) : null}
      </div>
      <div className="mt-6">{children}</div>
    </section>
  );
}

export function ConfirmationDialog({
  cancelLabel = 'Cancelar',
  confirmLabel = 'Eliminar',
  description,
  isPending = false,
  onCancel,
  onConfirm,
  pendingLabel = 'Eliminando…',
  title,
}) {
  const titleId = useId();
  const descriptionId = useId();
  const cancelRef = useRef(null);

  useEffect(() => {
    cancelRef.current?.focus();
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !isPending) onCancel();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isPending, onCancel]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div aria-hidden="true" className="absolute inset-0 bg-black/40" />
      <section
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className="relative w-full max-w-lg rounded-2xl border border-border bg-surface p-5 shadow-xl sm:p-6"
        role="dialog"
      >
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-red-100 text-red-700">
            <TriangleAlert aria-hidden="true" className="size-5" />
          </span>
          <div>
            <h2 className="text-lg font-extrabold text-text" id={titleId}>{title}</h2>
            <p className="mt-2 text-sm leading-6 text-text-muted" id={descriptionId}>{description}</p>
          </div>
        </div>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border-strong bg-surface px-4 py-2.5 text-sm font-bold text-text hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isPending}
            onClick={onCancel}
            ref={cancelRef}
            type="button"
          >
            {cancelLabel}
          </button>
          <button
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-red-700 px-4 py-2.5 text-sm font-extrabold text-white hover:bg-red-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 disabled:cursor-wait disabled:opacity-60"
            disabled={isPending}
            onClick={onConfirm}
            type="button"
          >
            {isPending ? pendingLabel : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}

export function HouseholdGate({ household, children }) {
  if (household.isPending) return <LoadingState label="Cargando hogar" />;
  if (household.isError) {
    return (
      <ErrorState
        description={household.error?.message}
        onRetry={household.refetch}
        title="No se ha podido cargar el hogar"
      />
    );
  }
  if (!household.currentHousehold) {
    return (
      <EmptyState
        description="Crea o selecciona un hogar antes de registrar gastos. Así cada dato quedará asociado al presupuesto correcto."
        icon={WalletCards}
        title="Necesitas un hogar"
      />
    );
  }
  return children;
}
