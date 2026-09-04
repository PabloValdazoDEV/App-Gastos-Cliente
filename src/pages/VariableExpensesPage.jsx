import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BarChart3, CalendarDays, ListPlus, Pencil, Plus, ShoppingBasket, Trash2, UserRound, UsersRound } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { z } from 'zod';

import { queryKeys } from '../api/queryKeys';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState, LoadingState } from '../components/ui/FeedbackStates';
import { PageHeader } from '../components/ui/PageHeader';
import { StatusBadge } from '../components/ui/StatusBadge';
import { AuthError, SubmitButton } from '../features/auth/components/AuthFeedback';
import { FormField } from '../features/auth/components/FormField';
import { financeService } from '../features/finance/financeService';
import { eurosInputToCents, formatCents } from '../features/finance/money';
import { householdService } from '../features/households/householdService';
import { CategoryIconBadge } from '../features/households/categoryIcons';
import { useHousehold } from '../features/households/useHousehold';
import {
  FormCard,
  ConfirmationDialog,
  ExpenseFilters,
  HouseholdGate,
  SelectField,
  TextareaField,
} from './expensePageShared';
import {
  categoriesFrom,
  currentMonthInput,
  formatCivilDate,
  formatMonth,
  moneyInputSchema,
  peopleFrom,
  positiveMoneyInputSchema,
  todayIso,
} from './expensePageUtils';

const variableEntrySchema = z.object({
  amount: z.string(),
  merchant: z.string().trim().max(120, 'El comercio es demasiado largo.').optional(),
  notes: z.string().trim().max(1_000, 'Las notas son demasiado largas.').optional(),
  spentOn: z.string().optional(),
});

const variableSchema = z
  .object({
    categoryId: z.string().min(1, 'Selecciona una categoría.'),
    entries: z.array(variableEntrySchema).max(1_000),
    entryMode: z.enum(['SUMMARY', 'DETAIL']),
    notes: z.string().trim().max(2_000, 'Las notas son demasiado largas.').optional(),
    period: z.string().regex(/^\d{4}-\d{2}$/, 'Selecciona un mes.'),
    personalPersonId: z.string().optional(),
    scope: z.enum(['HOUSEHOLD', 'PERSONAL']),
    summaryAmount: z.string().optional(),
  })
  .superRefine((values, context) => {
    if (values.scope === 'PERSONAL' && !values.personalPersonId) {
      context.addIssue({
        code: 'custom',
        message: 'Selecciona la persona responsable.',
        path: ['personalPersonId'],
      });
    }
    if (values.entryMode === 'SUMMARY') {
      const amountResult = moneyInputSchema.safeParse(values.summaryAmount ?? '');
      if (!amountResult.success) {
        context.addIssue({
          code: 'custom',
          message: amountResult.error.issues[0].message,
          path: ['summaryAmount'],
        });
      }
    }
    if (values.entryMode === 'DETAIL') {
      if (values.entries.length === 0) {
        context.addIssue({
          code: 'custom',
          message: 'Añade al menos un apunte.',
          path: ['entries'],
        });
      }
      values.entries.forEach((entry, index) => {
        const amountResult = positiveMoneyInputSchema.safeParse(entry.amount);
        if (!amountResult.success) {
          context.addIssue({
            code: 'custom',
            message: amountResult.error.issues[0].message,
            path: ['entries', index, 'amount'],
          });
        }
        if (entry.spentOn && !entry.spentOn.startsWith(`${values.period}-`)) {
          context.addIssue({
            code: 'custom',
            message: 'La fecha debe pertenecer al mes seleccionado.',
            path: ['entries', index, 'spentOn'],
          });
        }
      });
    }
  });

function dateBounds(period) {
  if (!/^\d{4}-\d{2}$/.test(period ?? '')) return {};
  const [year, month] = period.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    max: `${period}-${String(lastDay).padStart(2, '0')}`,
    min: `${period}-01`,
  };
}

function initialEntryDate(period) {
  return todayIso().startsWith(`${period}-`) ? todayIso() : `${period}-01`;
}

function totalForMonth(item) {
  if (item.entryMode === 'SUMMARY') return item.summaryAmountCents;
  return (item.entries ?? []).reduce(
    (total, entry) => total + (Number.isSafeInteger(entry.amountCents) ? entry.amountCents : 0),
    0,
  );
}

function centsForInput(cents) {
  return Number.isSafeInteger(cents) ? (cents / 100).toFixed(2) : '';
}

function dateForInput(value) {
  return typeof value === 'string' ? value.slice(0, 10) : '';
}

function personName(people, personId) {
  return people.find((person) => person.id === personId)?.name ?? 'Persona';
}

function VariableForm({ categories, householdId, initialMonth = null, onClose, people }) {
  const queryClient = useQueryClient();
  const isEditing = Boolean(initialMonth);
  const saveMonth = useMutation({
    mutationFn: financeService.saveVariableMonth,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.variableExpenses.all(householdId, undefined),
        }),
        queryClient.invalidateQueries({ queryKey: ['variableStatistics', householdId] }),
      ]);
      toast.success(isEditing ? 'Gasto variable actualizado.' : 'Gasto variable guardado.');
      onClose();
    },
  });
  const currentPeriod = initialMonth
    ? `${initialMonth.year}-${String(initialMonth.month).padStart(2, '0')}`
    : currentMonthInput();
  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
    setValue,
    watch,
  } = useForm({
    defaultValues: {
      entries: [
        ...(initialMonth?.entryMode === 'DETAIL' && initialMonth.entries?.length
          ? initialMonth.entries.map((entry) => ({
              amount: centsForInput(entry.amountCents),
              merchant: entry.merchant ?? '',
              notes: entry.notes ?? '',
              spentOn: dateForInput(entry.spentOn) || initialEntryDate(currentPeriod),
            }))
          : [{
              amount: '',
              merchant: '',
              notes: '',
              spentOn: initialEntryDate(currentPeriod),
            }]),
      ],
      categoryId: initialMonth?.categoryId ?? categories[0]?.id ?? '',
      entryMode: initialMonth?.entryMode ?? 'SUMMARY',
      notes: initialMonth?.notes ?? '',
      period: currentPeriod,
      personalPersonId: initialMonth?.personalPersonId ?? '',
      scope: initialMonth?.scope ?? 'HOUSEHOLD',
      summaryAmount: centsForInput(initialMonth?.summaryAmountCents),
    },
    resolver: zodResolver(variableSchema),
  });
  const { append, fields, remove } = useFieldArray({ control, name: 'entries' });
  const [dateEntryIds, setDateEntryIds] = useState([]);
  const entryMode = watch('entryMode');
  const entries = watch('entries');
  const period = watch('period');
  const scope = watch('scope');
  const bounds = dateBounds(period);
  const periodField = register('period');

  const toggleEntryDate = (entryId) => {
    setDateEntryIds((entryIds) =>
      entryIds.includes(entryId)
        ? entryIds.filter((currentEntryId) => currentEntryId !== entryId)
        : [...entryIds, entryId],
    );
  };

  const handlePeriodChange = (event) => {
    periodField.onChange(event);
    const nextPeriod = event.target.value;

    fields.forEach((_, index) => {
      setValue(`entries.${index}.spentOn`, initialEntryDate(nextPeriod), {
        shouldDirty: false,
        shouldValidate: false,
      });
    });
  };

  const onSubmit = handleSubmit(async (values) => {
    const [year, month] = values.period.split('-').map(Number);

    try {
      await saveMonth.mutateAsync({
        householdId,
        body: {
          categoryId: values.categoryId,
          entries:
            values.entryMode === 'DETAIL'
              ? values.entries.map((entry) => ({
                  amountCents: eurosInputToCents(entry.amount),
                  merchant: entry.merchant || null,
                  notes: entry.notes || null,
                  spentOn: entry.spentOn || initialEntryDate(values.period),
                }))
              : undefined,
          entryMode: values.entryMode,
          month,
          notes: values.notes || null,
          personalPersonId: values.scope === 'PERSONAL' ? values.personalPersonId : null,
          scope: values.scope,
          summaryAmountCents:
            values.entryMode === 'SUMMARY'
              ? eurosInputToCents(values.summaryAmount)
              : undefined,
          year,
        },
      });
    } catch {
      // El error normalizado se muestra dentro del formulario.
    }
  });

  return (
    <FormCard
      description={
        isEditing
          ? 'Corrige el total o los apuntes de este mes. La media se actualizará automáticamente.'
          : 'Elige un total mensual o apuntes individuales. Cada mes utiliza un único modo.'
      }
      onClose={onClose}
      title={isEditing ? 'Editar gasto variable' : 'Añadir gasto variable'}
    >
      {categories.length === 0 ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          Necesitas al menos una categoría activa antes de añadir un gasto.
        </p>
      ) : (
        <form className="space-y-5" noValidate onSubmit={onSubmit}>
          <div className="grid gap-5 sm:grid-cols-2">
            <SelectField error={errors.categoryId?.message} label="Categoría" {...register('categoryId')}>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </SelectField>
            <FormField
              error={errors.period?.message}
              label="Mes"
              type="month"
              {...periodField}
              onChange={handlePeriodChange}
            />
          </div>

          <fieldset>
            <legend className="text-sm font-bold text-text">Cómo quieres registrarlo</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {[
                ['SUMMARY', 'Total mensual', 'Una única cantidad para todo el mes.'],
                ['DETAIL', 'Apuntes detallados', 'Importe y comercio de cada compra; la fecha solo si la necesitas.'],
              ].map(([value, label, description]) => (
                <label
                  className="flex min-h-16 items-start gap-3 rounded-xl border border-border-strong p-3.5 has-[:checked]:border-brand has-[:checked]:bg-brand-soft"
                  key={value}
                >
                  <input
                    aria-label={label}
                    className="mt-1 size-4 accent-brand"
                    type="radio"
                    value={value}
                    {...register('entryMode')}
                  />
                  <span>
                    <span className="block text-sm font-bold text-text">{label}</span>
                    <span className="mt-0.5 block text-xs leading-5 text-text-muted">{description}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {entryMode === 'SUMMARY' ? (
            <FormField
              error={errors.summaryAmount?.message}
              inputMode="decimal"
              label="Total del mes (€)"
              placeholder="0,00"
              {...register('summaryAmount')}
            />
          ) : (
            <fieldset>
              <legend className="text-sm font-bold text-text">Apuntes del mes</legend>
              <p className="mt-1 text-xs leading-5 text-text-muted">
                El total se calculará exclusivamente desde estos apuntes; no se guarda un resumen adicional.
              </p>
              <div className="mt-4 space-y-4">
                {fields.map((field, index) => {
                  const isDateExpanded = dateEntryIds.includes(field.id);
                  const entryDate = entries?.[index]?.spentOn || initialEntryDate(period);

                  return (
                    <div className="rounded-2xl border border-border bg-surface-muted p-4" key={field.id}>
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="text-sm font-extrabold text-text">Apunte {index + 1}</h3>
                        {fields.length > 1 ? (
                          <button
                            aria-label={`Eliminar apunte ${index + 1}`}
                            className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-bold text-red-700 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
                            onClick={() => {
                              setDateEntryIds((entryIds) =>
                                entryIds.filter((entryId) => entryId !== field.id),
                              );
                              remove(index);
                            }}
                            type="button"
                          >
                            <Trash2 aria-hidden="true" className="size-4" />
                            Eliminar
                          </button>
                        ) : null}
                      </div>
                      <div className="mt-4 grid gap-5 sm:grid-cols-2">
                        <FormField
                          error={errors.entries?.[index]?.amount?.message}
                          inputMode="decimal"
                          label="Importe (€)"
                          placeholder="0,00"
                          {...register(`entries.${index}.amount`)}
                        />
                        <FormField
                          error={errors.entries?.[index]?.merchant?.message}
                          label="Comercio (opcional)"
                          maxLength={120}
                          placeholder="Por ejemplo, supermercado"
                          {...register(`entries.${index}.merchant`)}
                        />
                      </div>
                      <div className="mt-5">
                        <FormField
                          error={errors.entries?.[index]?.notes?.message}
                          label="Nota breve (opcional)"
                          maxLength={1_000}
                          {...register(`entries.${index}.notes`)}
                        />
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
                        <button
                          aria-expanded={isDateExpanded}
                          className="inline-flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm font-bold text-brand-strong hover:bg-brand-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                          onClick={() => toggleEntryDate(field.id)}
                          type="button"
                        >
                          <CalendarDays aria-hidden="true" className="size-4" />
                          {isDateExpanded ? 'Ocultar fecha' : 'Cambiar fecha'}
                        </button>
                        <p className="text-xs text-text-muted">Por defecto: {formatCivilDate(entryDate)}</p>
                      </div>
                      {isDateExpanded ? (
                        <div className="mt-3 max-w-xs">
                          <FormField
                            error={errors.entries?.[index]?.spentOn?.message}
                            label="Fecha del apunte (opcional)"
                            max={bounds.max}
                            min={bounds.min}
                            type="date"
                            {...register(`entries.${index}.spentOn`)}
                          />
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
              {typeof errors.entries?.message === 'string' ? (
                <p className="mt-2 text-sm font-medium text-red-700" role="alert">
                  {errors.entries.message}
                </p>
              ) : null}
              <button
                className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-border-strong bg-surface px-4 py-2.5 text-sm font-bold text-text hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus sm:w-auto"
                onClick={() =>
                  append({
                    amount: '',
                    merchant: '',
                    notes: '',
                    spentOn: initialEntryDate(period),
                  })
                }
                type="button"
              >
                <ListPlus aria-hidden="true" className="size-5" />
                Añadir otro apunte
              </button>
            </fieldset>
          )}

          <fieldset>
            <legend className="text-sm font-bold text-text">A quién corresponde</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {[
                ['HOUSEHOLD', UsersRound, 'Común'],
                ['PERSONAL', UserRound, 'Personal'],
              ].map(([value, Icon, label]) => (
                <label
                  className="flex min-h-12 items-center gap-3 rounded-xl border border-border-strong px-3.5 py-2.5 text-sm font-bold has-[:checked]:border-brand has-[:checked]:bg-brand-soft"
                  key={value}
                >
                  <input className="size-4 accent-brand" type="radio" value={value} {...register('scope')} />
                  <Icon aria-hidden="true" className="size-5 text-brand-strong" />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>

          {scope === 'PERSONAL' ? (
            <SelectField
              error={errors.personalPersonId?.message}
              label="Persona responsable"
              {...register('personalPersonId')}
            >
              <option value="">Selecciona una persona</option>
              {people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </SelectField>
          ) : null}

          <TextareaField
            error={errors.notes?.message}
            label="Notas del mes (opcional)"
            maxLength={2_000}
            {...register('notes')}
          />
          <AuthError error={saveMonth.error} />
          <SubmitButton isPending={saveMonth.isPending} pendingLabel="Guardando mes…">
            {isEditing ? 'Guardar cambios' : 'Guardar gasto variable'}
          </SubmitButton>
        </form>
      )}
    </FormCard>
  );
}

function VariableStatistics({ currency, people, statistics }) {
  if (statistics.length === 0) return null;

  return (
    <section aria-labelledby="estadisticas-variables">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-brand-soft text-brand-strong">
          <BarChart3 aria-hidden="true" className="size-5" />
        </span>
        <div>
          <h2 className="text-xl font-extrabold tracking-tight" id="estadisticas-variables">
            Medias de gasto
          </h2>
          <p className="mt-0.5 text-sm text-text-muted">
            La media usa automáticamente solo los meses que ya han terminado.
          </p>
        </div>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {statistics.map((item) => (
          <article
            className="rounded-2xl border border-border bg-surface p-5 shadow-card"
            key={`${item.categoryId}:${item.ownerKey}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <CategoryIconBadge category={item.category} />
                <div>
                  <h3 className="font-extrabold text-text">{item.category?.name ?? 'Categoría'}</h3>
                  <p className="mt-1 text-xs text-text-muted">
                    {item.scope === 'PERSONAL'
                      ? personName(people, item.personalPersonId)
                      : 'Gasto común'}{' '}
                    · {item.completedMonths} {item.completedMonths === 1 ? 'mes' : 'meses'}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold uppercase tracking-wide text-text-soft">Recomendado</p>
                <p className="mt-1 text-xl font-extrabold text-brand-strong">
                  {formatCents(item.recommendedCents, currency)}
                </p>
              </div>
            </div>
            <dl className="mt-5 grid grid-cols-3 gap-3">
              {[
                ['3 meses', item.averages?.months3, item.availableMonths?.months3],
                ['6 meses', item.averages?.months6, item.availableMonths?.months6],
                ['12 meses', item.averages?.months12, item.availableMonths?.months12],
              ].map(([label, value, count]) => (
                <div className="rounded-xl bg-surface-muted p-3" key={label}>
                  <dt className="text-xs font-semibold text-text-muted">{label}</dt>
                  <dd className="mt-1 text-sm font-extrabold text-text">{formatCents(value, currency)}</dd>
                  <dd className="mt-0.5 text-[0.6875rem] text-text-soft">{count ?? 0} disponibles</dd>
                </div>
              ))}
            </dl>
          </article>
        ))}
      </div>
    </section>
  );
}

export function VariableExpensesPage() {
  const queryClient = useQueryClient();
  const household = useHousehold();
  const householdId = household.currentHousehold?.id;
  const currency = household.currentHousehold?.currency ?? 'EUR';
  const [showForm, setShowForm] = useState(false);
  const [editingMonthId, setEditingMonthId] = useState(null);
  const [deletingMonthId, setDeletingMonthId] = useState(null);
  const [search, setSearch] = useState('');
  const [scopeFilter, setScopeFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const months = useQuery({
    enabled: Boolean(householdId),
    queryFn: () => financeService.variableExpenses(householdId),
    queryKey: queryKeys.variableExpenses.all(householdId, undefined),
  });
  const statistics = useQuery({
    enabled: Boolean(householdId),
    queryFn: () => financeService.variableStatistics(householdId),
    queryKey: ['variableStatistics', householdId],
  });
  const categoriesQuery = useQuery({
    enabled: Boolean(householdId),
    queryFn: () => householdService.listCategories(householdId),
    queryKey: ['householdCategories', householdId],
  });
  const peopleQuery = useQuery({
    enabled: Boolean(householdId),
    queryFn: () => householdService.listPeople(householdId),
    queryKey: ['householdPeople', householdId],
  });
  const categories = categoriesFrom(categoriesQuery.data);
  const people = peopleFrom(peopleQuery.data).filter((person) => person.isActive !== false);
  const deleteMonth = useMutation({
    mutationFn: financeService.deleteVariableMonth,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.variableExpenses.all(householdId, undefined),
        }),
        queryClient.invalidateQueries({ queryKey: ['variableStatistics', householdId] }),
        queryClient.invalidateQueries({ queryKey: ['budget', householdId] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard', householdId] }),
      ]);
      setDeletingMonthId(null);
      toast.success('Gasto variable eliminado.');
    },
  });
  const monthToDelete = months.data?.find((item) => item.id === deletingMonthId);
  const filteredMonths = useMemo(() => {
    const normalized = search.trim().toLocaleLowerCase('es');
    return (months.data ?? []).filter((item) => {
      const matchesSearch = !normalized || [
        item.category?.name,
        item.notes,
        item.personalPerson?.name,
        formatMonth(item.year, item.month),
      ].some((value) => String(value ?? '').toLocaleLowerCase('es').includes(normalized));
      return matchesSearch &&
        (scopeFilter === 'ALL' || item.scope === scopeFilter) &&
        (categoryFilter === 'ALL' || item.categoryId === categoryFilter);
    });
  }, [categoryFilter, months.data, scopeFilter, search]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <PageHeader
          eyebrow="Gastos"
          title="Gastos variables"
        />
        {household.currentHousehold ? (
          <button
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-extrabold text-on-brand shadow-sm hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            onClick={() => {
              setEditingMonthId(null);
              setShowForm(true);
            }}
            type="button"
          >
            <Plus aria-hidden="true" className="size-5" />
            Añadir gasto variable
          </button>
        ) : null}
      </div>

      <HouseholdGate household={household}>
        {monthToDelete ? (
          <ConfirmationDialog
            confirmLabel="Eliminar gasto"
            description={`Se eliminará el registro de ${formatMonth(monthToDelete.year, monthToDelete.month)} y todos sus apuntes. Esta acción no se puede deshacer.`}
            isPending={deleteMonth.isPending}
            onCancel={() => setDeletingMonthId(null)}
            onConfirm={() =>
              deleteMonth.mutate({ householdId, variableMonthId: monthToDelete.id })
            }
            pendingLabel="Eliminando…"
            title="¿Eliminar este gasto variable?"
          />
        ) : null}
        <AuthError error={deleteMonth.error} />
        {showForm ? (
          categoriesQuery.isPending || peopleQuery.isPending ? (
            <LoadingState label="Preparando formulario" />
          ) : categoriesQuery.isError || peopleQuery.isError ? (
            <ErrorState
              description={(categoriesQuery.error ?? peopleQuery.error)?.message}
              onRetry={() => {
                categoriesQuery.refetch();
                peopleQuery.refetch();
              }}
              title="No se puede preparar el formulario"
            />
          ) : (
            <VariableForm
              categories={categories}
              householdId={householdId}
              onClose={() => setShowForm(false)}
              people={people}
            />
          )
        ) : null}

        {statistics.isPending ? <LoadingState label="Calculando estadísticas" /> : null}
        {statistics.isError ? (
          <ErrorState
            description={statistics.error.message}
            onRetry={statistics.refetch}
            title="No se han podido calcular las estadísticas"
          />
        ) : null}
        {statistics.isSuccess ? (
          <VariableStatistics currency={currency} people={people} statistics={statistics.data} />
        ) : null}

        {months.isPending ? <LoadingState label="Cargando gastos variables" /> : null}
        {months.isError ? (
          <ErrorState
            description={months.error.message}
            onRetry={months.refetch}
            title="No se han podido cargar los gastos variables"
          />
        ) : null}
        {months.isSuccess && months.data.length === 0 ? (
          <EmptyState
            action={
              <button
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-on-brand hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                onClick={() => {
                  setEditingMonthId(null);
                  setShowForm(true);
                }}
                type="button"
              >
                Añadir el primer mes
              </button>
            }
            description="Registra el total mensual o cada compra. El mes en curso no entra en la media hasta que termine."
            icon={ShoppingBasket}
            title="No hay gastos variables"
          />
        ) : null}
        {months.isSuccess && months.data.length > 0 ? (
          <section aria-labelledby="historico-variables">
            <h2 className="text-xl font-extrabold tracking-tight" id="historico-variables">
              Meses registrados
            </h2>
            <div className="mt-4">
              <ExpenseFilters
                categories={categories}
                categoryId={categoryFilter}
                onCategoryChange={setCategoryFilter}
                onScopeChange={setScopeFilter}
                onSearchChange={setSearch}
                scope={scopeFilter}
                search={search}
              />
            </div>
            {filteredMonths.length === 0 ? <p className="mt-4 rounded-2xl border border-dashed border-border-strong p-6 text-center text-sm text-text-muted">No hay meses que coincidan con los filtros.</p> : null}
            <ul className="mt-4 space-y-3">
              {filteredMonths.map((item) => {
                const isEditing = editingMonthId === item.id;

                return (
                <li className="rounded-2xl border border-border bg-surface p-5 shadow-card" key={item.id}>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <CategoryIconBadge category={item.category} />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-extrabold text-text">{item.category?.name ?? 'Sin categoría'}</h3>
                          <StatusBadge>
                            {item.entryMode === 'SUMMARY' ? 'Total mensual' : 'Detallado'}
                          </StatusBadge>
                        </div>
                        <p className="mt-1 text-sm text-text-muted">
                          {formatMonth(item.year, item.month)} ·{' '}
                          {item.scope === 'PERSONAL'
                            ? item.personalPerson?.name ?? personName(people, item.personalPersonId)
                            : 'Gasto común'}
                        </p>
                      </div>
                    </div>
                    <div className="sm:text-right">
                      <p className="text-xl font-extrabold text-text">
                        {formatCents(totalForMonth(item), currency)}
                      </p>
                      <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
                        <button
                          aria-label={`Editar gasto de ${item.category?.name ?? 'esta categoría'} de ${formatMonth(item.year, item.month)}`}
                          className="inline-flex min-h-11 w-full min-w-0 items-center justify-center gap-2 rounded-xl border border-border-strong px-2 py-2 text-sm font-bold text-text hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus sm:w-auto sm:px-3"
                          onClick={() => {
                            setShowForm(false);
                            setDeletingMonthId(null);
                            setEditingMonthId((current) => current === item.id ? null : item.id);
                          }}
                          type="button"
                        >
                          <Pencil aria-hidden="true" className="size-4" />
                          Editar
                        </button>
                        <button
                          aria-label={`Eliminar gasto de ${item.category?.name ?? 'esta categoría'} de ${formatMonth(item.year, item.month)}`}
                          className="inline-flex min-h-11 w-full min-w-0 items-center justify-center gap-2 rounded-xl border border-red-300 px-2 py-2 text-sm font-bold text-red-800 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 disabled:cursor-wait disabled:opacity-60 sm:w-auto sm:px-3"
                          disabled={deleteMonth.isPending}
                          onClick={() => {
                            deleteMonth.reset();
                            setEditingMonthId(null);
                            setDeletingMonthId(item.id);
                          }}
                          type="button"
                        >
                          <Trash2 aria-hidden="true" className="size-4" />
                          Eliminar
                        </button>
                      </div>
                    </div>
                  </div>
                  {item.entryMode === 'DETAIL' && item.entries?.length ? (
                    <ul className="mt-4 divide-y divide-border rounded-xl bg-surface-muted px-4">
                      {item.entries.map((entry) => (
                        <li className="flex items-center justify-between gap-4 py-3" key={entry.id}>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-text">
                              {entry.merchant || 'Apunte sin comercio'}
                            </p>
                            <p className="mt-0.5 text-xs text-text-muted">
                              {formatCivilDate(entry.spentOn)}
                            </p>
                          </div>
                          <p className="shrink-0 text-sm font-extrabold text-text">
                            {formatCents(entry.amountCents, currency)}
                          </p>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {isEditing ? (
                    categoriesQuery.isPending || peopleQuery.isPending ? (
                      <LoadingState label="Preparando edición" />
                    ) : categoriesQuery.isError || peopleQuery.isError ? (
                      <ErrorState
                        description={(categoriesQuery.error ?? peopleQuery.error)?.message}
                        onRetry={() => {
                          categoriesQuery.refetch();
                          peopleQuery.refetch();
                        }}
                        title="No se puede editar el gasto variable"
                      />
                    ) : (
                      <div className="mt-5">
                        <VariableForm
                          categories={categories}
                          householdId={householdId}
                          initialMonth={item}
                          key={item.id}
                          onClose={() => setEditingMonthId(null)}
                          people={people}
                        />
                      </div>
                    )
                  ) : null}
                </li>
                );
              })}
            </ul>
          </section>
        ) : null}
      </HouseholdGate>
    </div>
  );
}
