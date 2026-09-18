import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Receipt, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { z } from 'zod';

import { queryKeys } from '../api/queryKeys';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState, LoadingState } from '../components/ui/FeedbackStates';
import { PageHeader } from '../components/ui/PageHeader';
import { MonthGroupedList } from '../components/ui/MonthGroupedList';
import { FormDialog } from '../components/ui/FormDialog';
import { AuthError, SubmitButton } from '../features/auth/components/AuthFeedback';
import { FormField } from '../features/auth/components/FormField';
import { financeService } from '../features/finance/financeService';
import { invalidateBudgetQueries } from '../features/finance/invalidateBudgetQueries';
import { SafetyMarginCheckbox } from '../features/finance/SafetyMarginCheckbox';
import { eurosInputToCents, formatCents, isoDate } from '../features/finance/money';
import { householdService } from '../features/households/householdService';
import { CategoryIconBadge } from '../features/households/categoryIcons';
import { useHousehold } from '../features/households/useHousehold';
import { PurchaseLinkedExpenses } from '../features/purchases/PurchaseLinkedExpenses';
import { linkedPurchaseExpenses, useLinkedPurchaseExpenses } from '../features/purchases/linkedPurchaseExpenses';
import {
  ConfirmationDialog,
  ExpenseFilters,
  HouseholdGate,
  SelectField,
  TextareaField,
} from './expensePageShared';
import {
  categoriesFrom,
  peopleFrom,
  positiveMoneyInputSchema,
  todayIso,
} from './expensePageUtils';

const oneTimeSchema = z
  .object({
    applySafetyMargin: z.boolean().default(false),
    amount: positiveMoneyInputSchema,
    categoryId: z.string().min(1, 'Selecciona una categoría.'),
    expenseDate: z.string().min(1, 'Indica la fecha del gasto.'),
    name: z.string().trim().min(1, 'Introduce un nombre.').max(120),
    notes: z.string().trim().max(2_000, 'Las notas son demasiado largas.').optional(),
    personalPersonId: z.string().optional(),
    scope: z.enum(['HOUSEHOLD', 'PERSONAL']),
  })
  .superRefine((values, context) => {
    if (values.scope === 'PERSONAL' && !values.personalPersonId) {
      context.addIssue({
        code: 'custom',
        message: 'Selecciona la persona responsable.',
        path: ['personalPersonId'],
      });
    }
  });

function OneTimeForm({ categories, householdId, initialExpense, onClose, onBusyChange, people }) {
  const queryClient = useQueryClient();
  const formRef = useRef(null);
  const isEditing = Boolean(initialExpense);
  const save = useMutation({
    mutationFn: isEditing ? financeService.updateOneTimeExpense : financeService.createOneTimeExpense,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.oneTimeExpenses(householdId) }),
        invalidateBudgetQueries(queryClient, householdId),
      ]);
      toast.success(isEditing ? 'Gasto puntual actualizado.' : 'Gasto puntual guardado.');
      onClose();
    },
  });
  useEffect(() => { onBusyChange(save.isPending); }, [onBusyChange, save.isPending]);
  useEffect(() => { formRef.current?.querySelector('input')?.focus({ preventScroll: true }); }, []);
  const {
    formState: { errors },
    handleSubmit,
    register,
    watch,
  } = useForm({
    defaultValues: {
      applySafetyMargin: initialExpense?.applySafetyMargin ?? false,
      amount: Number.isSafeInteger(initialExpense?.amountCents)
        ? (initialExpense.amountCents / 100).toFixed(2)
        : '',
      categoryId: initialExpense?.categoryId ?? categories[0]?.id ?? '',
      expenseDate: isoDate(initialExpense?.expenseDate) || todayIso(),
      name: initialExpense?.name ?? '',
      notes: initialExpense?.notes ?? '',
      personalPersonId: initialExpense?.personalPersonId ?? '',
      scope: initialExpense?.scope ?? 'HOUSEHOLD',
    },
    resolver: zodResolver(oneTimeSchema),
  });
  const scope = watch('scope');
  const onSubmit = handleSubmit(async (values) => {
    if (save.isPending) return;
    try {
      await save.mutateAsync({
        householdId,
        ...(isEditing ? { expenseId: initialExpense.id } : {}),
        body: {
          applySafetyMargin: values.applySafetyMargin,
          amountCents: eurosInputToCents(values.amount),
          categoryId: values.categoryId,
          expenseDate: values.expenseDate,
          name: values.name.trim(),
          notes: values.notes || null,
          personalPersonId: values.scope === 'PERSONAL' ? values.personalPersonId : null,
          scope: values.scope,
        },
      });
    } catch {
      // El error normalizado se muestra en el formulario.
    }
  });

  return (
    <>
      {categories.length === 0 ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          Necesitas al menos una categoría activa antes de añadir un gasto.
        </p>
      ) : (
        <form aria-busy={save.isPending} noValidate onSubmit={onSubmit} ref={formRef}>
          <fieldset className="min-w-0 space-y-5" disabled={save.isPending}>
          <div className="grid gap-5 sm:grid-cols-2">
            <FormField error={errors.name?.message} label="Nombre" {...register('name')} />
            <FormField
              error={errors.amount?.message}
              inputMode="decimal"
              label="Importe (€)"
              placeholder="0,00"
              {...register('amount')}
            />
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <SelectField error={errors.categoryId?.message} label="Categoría" {...register('categoryId')}>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </SelectField>
            <FormField
              error={errors.expenseDate?.message}
              label="Fecha del gasto"
              type="date"
              {...register('expenseDate')}
            />
          </div>
          <fieldset>
            <legend className="text-sm font-bold text-text">¿A quién corresponde?</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <label className="flex min-h-12 items-center gap-3 rounded-xl border border-border-strong px-3.5 py-2.5 text-sm font-semibold has-[:checked]:border-brand has-[:checked]:bg-brand-soft">
                <input className="size-4 accent-brand" type="radio" value="HOUSEHOLD" {...register('scope')} />
                Gasto común
              </label>
              <label className="flex min-h-12 items-center gap-3 rounded-xl border border-border-strong px-3.5 py-2.5 text-sm font-semibold has-[:checked]:border-brand has-[:checked]:bg-brand-soft">
                <input className="size-4 accent-brand" type="radio" value="PERSONAL" {...register('scope')} />
                Gasto personal
              </label>
            </div>
          </fieldset>
          {scope === 'PERSONAL' ? (
            <SelectField error={errors.personalPersonId?.message} label="Persona" {...register('personalPersonId')}>
              <option value="">Selecciona una persona</option>
              {people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </SelectField>
          ) : null}
          <SafetyMarginCheckbox
            disabled={save.isPending}
            help="Si lo activas se aplicará el margen de su categoría o, si no tiene uno propio, el margen general del hogar."
            label="Aplicar margen de seguridad a este gasto"
            {...register('applySafetyMargin')}
          />
          <TextareaField
            error={errors.notes?.message}
            label="Notas (opcional)"
            maxLength={2_000}
            {...register('notes')}
          />
          <AuthError error={save.error} />
          <div className="grid gap-3 sm:grid-cols-2">
            <button className="min-h-12 rounded-xl border border-border-strong px-4 py-3 text-sm font-bold hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:opacity-60" onClick={onClose} type="button">Cancelar</button>
            <SubmitButton isPending={save.isPending} pendingLabel="Guardando…">
              {isEditing ? 'Guardar cambios' : 'Guardar gasto'}
            </SubmitButton>
          </div>
          </fieldset>
        </form>
      )}
    </>
  );
}

export function OneTimeExpensesPage() {
  const household = useHousehold();
  const queryClient = useQueryClient();
  const householdId = household.currentHousehold?.id;
  const currency = household.currentHousehold?.currency ?? 'EUR';
  const purchases = useLinkedPurchaseExpenses(householdId);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [search, setSearch] = useState('');
  const [scopeFilter, setScopeFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [formBusy, setFormBusy] = useState(false);
  const expenses = useQuery({
    enabled: Boolean(householdId),
    queryFn: () => financeService.oneTimeExpenses(householdId),
    queryKey: queryKeys.oneTimeExpenses(householdId),
  });
  const categoriesQuery = useQuery({
    enabled: Boolean(householdId),
    queryFn: () => householdService.listCategories(householdId),
    queryKey: queryKeys.categories.all(householdId),
  });
  const peopleQuery = useQuery({
    enabled: Boolean(householdId),
    queryFn: () => householdService.listPeople(householdId),
    queryKey: ['householdPeople', householdId],
  });
  const categories = categoriesFrom(categoriesQuery.data);
  const people = peopleFrom(peopleQuery.data).filter((person) => person.isActive !== false);
  const deleteExpense = useMutation({
    mutationFn: financeService.deleteOneTimeExpense,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.oneTimeExpenses(householdId) }),
        invalidateBudgetQueries(queryClient, householdId),
      ]);
      setDeletingId(null);
      toast.success('Gasto puntual eliminado.');
    },
  });
  const visibleExpenses = useMemo(() => {
    const normalized = search.trim().toLocaleLowerCase('es');
    return (expenses.data ?? []).filter((expense) => {
      const matchesSearch = !normalized || [
        expense.name,
        expense.category?.name,
        expense.notes,
        expense.personalPerson?.name,
      ].some((value) => String(value ?? '').toLocaleLowerCase('es').includes(normalized));
      const matchesScope = scopeFilter === 'ALL' || expense.scope === scopeFilter;
      const matchesCategory = categoryFilter === 'ALL' || expense.categoryId === categoryFilter;
      return matchesSearch && matchesScope && matchesCategory;
    });
  }, [categoryFilter, expenses.data, scopeFilter, search]);
  const editingExpense = expenses.data?.find((expense) => expense.id === editingId);
  const deletingExpense = expenses.data?.find((expense) => expense.id === deletingId);
  const openForm = (expenseId) => {
    setEditingId(expenseId);
    setFormBusy(false);
    setShowForm(true);
  };
  const closeForm = () => {
    setShowForm(false);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <PageHeader eyebrow="Gastos" title="Gastos puntuales" />
        {household.currentHousehold ? (
          <button
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-extrabold text-on-brand shadow-sm hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            onClick={() => openForm(null)}
            type="button"
          >
            <Plus aria-hidden="true" className="size-5" />
            Añadir gasto puntual
          </button>
        ) : null}
      </div>
      <HouseholdGate household={household}>
        {deletingExpense ? (
          <ConfirmationDialog
            confirmLabel="Eliminar gasto"
            description="Se eliminará este gasto puntual y no se podrá recuperar."
            isPending={deleteExpense.isPending}
            onCancel={() => setDeletingId(null)}
            onConfirm={() => deleteExpense.mutate({ householdId, expenseId: deletingExpense.id })}
            pendingLabel="Eliminando…"
            title="¿Eliminar este gasto puntual?"
          />
        ) : null}
        {showForm ? <FormDialog busy={formBusy} title={editingId ? 'Editar gasto puntual' : 'Añadir gasto puntual'} description="Registra una compra o pago excepcional para tenerlo en cuenta en el mes indicado." onClose={closeForm}>
          {categoriesQuery.isPending || peopleQuery.isPending ? (
            <LoadingState label="Preparando formulario" />
          ) : categoriesQuery.isError || peopleQuery.isError ? (
            <ErrorState description={(categoriesQuery.error ?? peopleQuery.error)?.message} onRetry={() => { categoriesQuery.refetch(); peopleQuery.refetch(); }} title="No se puede preparar el formulario" />
          ) : (
            <OneTimeForm
              key={`${householdId}:${editingId ?? 'new'}`}
              categories={categories}
              householdId={householdId}
              initialExpense={editingExpense}
              onClose={closeForm}
              onBusyChange={setFormBusy}
              people={people}
            />
          )}
          {!categoriesQuery.isSuccess || !peopleQuery.isSuccess ? <button className="mt-3 min-h-11 rounded-xl border border-border-strong px-4 py-2 text-sm font-bold hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" onClick={closeForm} type="button">Cancelar</button> : null}
        </FormDialog> : null}
        <PurchaseLinkedExpenses query={purchases} householdId={householdId} currency={currency} kind="ONE_TIME" timezone={household.currentHousehold?.timezone} />
        {expenses.isPending ? <LoadingState label="Cargando gastos puntuales" /> : null}
        {expenses.isError ? <ErrorState description={expenses.error.message} onRetry={expenses.refetch} title="No se han podido cargar los gastos puntuales" /> : null}
        {expenses.isSuccess && expenses.data.length > 0 ? (
          <section aria-labelledby="lista-gastos-puntuales">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-xl bg-brand-soft text-brand-strong"><Receipt aria-hidden="true" className="size-5" /></span>
              <div><h2 className="text-xl font-extrabold tracking-tight" id="lista-gastos-puntuales">Gastos registrados</h2><p className="text-sm text-text-muted">Agrupados por año y mes del gasto, más recientes primero. Se incorporan al cálculo del mes de su fecha.</p></div>
            </div>
            <div className="mt-4">
              <ExpenseFilters
                categories={categories}
                categoryId={categoryFilter}
                onCategoryChange={setCategoryFilter}
                onScopeChange={setScopeFilter}
                onSearchChange={setSearch}
                scope={scopeFilter}
                search={search}
                searchLabel="Buscar gastos puntuales"
              />
            </div>
            {visibleExpenses.length === 0 ? <p className="mt-4 rounded-2xl border border-dashed border-border-strong p-6 text-center text-sm text-text-muted">No hay gastos que coincidan con la búsqueda.</p> : (
              <MonthGroupedList className="mt-4" items={visibleExpenses} getDate={(expense) => expense.expenseDate}
                renderItem={(expense) => (
                  <li className="min-w-0 rounded-2xl border border-border bg-surface p-5 shadow-card" key={expense.id}>
                    <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex min-w-0 items-start gap-3"><CategoryIconBadge category={expense.category} /><div className="min-w-0"><h5 className="break-words font-extrabold text-text">{expense.name}</h5><p className="mt-1 break-words text-sm text-text-muted">{expense.category?.name ?? 'Sin categoría'} · {expense.expenseDate?.slice(0, 10)} · {expense.scope === 'PERSONAL' ? expense.personalPerson?.name ?? 'Personal' : 'Gasto común'}</p>{expense.notes ? <p className="mt-2 break-words text-sm text-text-muted">{expense.notes}</p> : null}</div></div>
                      <div className="shrink-0 sm:text-right"><p className="text-xl font-extrabold text-text">{formatCents(expense.amountCents, currency)}</p><div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end"><button className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-border-strong px-2 py-2 text-sm font-bold text-text hover:bg-surface-muted sm:w-auto sm:px-3" onClick={() => openForm(expense.id)} type="button"><Pencil aria-hidden="true" className="size-4" />Editar</button><button className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-red-200 px-2 py-2 text-sm font-bold text-red-800 hover:bg-red-50 sm:w-auto sm:px-3" onClick={() => setDeletingId(expense.id)} type="button"><Trash2 aria-hidden="true" className="size-4" />Eliminar</button></div></div>
                    </div>
                  </li>
                )}
              />
            )}
          </section>
        ) : null}
        {expenses.isSuccess && expenses.data.length === 0 && !linkedPurchaseExpenses(purchases.data, 'ONE_TIME').length ? <EmptyState action={<button className="inline-flex min-h-11 items-center justify-center rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-on-brand hover:bg-brand-hover" onClick={() => openForm(null)} type="button">Añadir el primer gasto</button>} description="Registra compras o pagos excepcionales que no se repiten cada mes." icon={Receipt} title="No hay gastos puntuales" /> : null}
      </HouseholdGate>
    </div>
  );
}
