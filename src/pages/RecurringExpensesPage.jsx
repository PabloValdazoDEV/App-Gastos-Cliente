import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CalendarCheck2,
  CheckCircle2,
  ChevronDown,
  Pencil,
  Plus,
  Trash2,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { useParams, useSearchParams } from 'react-router-dom';
import { z } from 'zod';

import { queryKeys } from '../api/queryKeys';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState, LoadingState } from '../components/ui/FeedbackStates';
import { PageHeader } from '../components/ui/PageHeader';
import { StatusBadge } from '../components/ui/StatusBadge';
import { AuthError, SubmitButton } from '../features/auth/components/AuthFeedback';
import { FormField } from '../features/auth/components/FormField';
import { RecurringExpenseDetails } from '../features/finance/RecurringExpenseDetails';
import { financeService } from '../features/finance/financeService';
import { eurosInputToCents, formatCents, isoDate } from '../features/finance/money';
import { householdService } from '../features/households/householdService';
import { useHousehold } from '../features/households/useHousehold';
import { CategoryIconBadge } from '../features/households/categoryIcons';
import {
  FormCard,
  ConfirmationDialog,
  HouseholdGate,
  SelectField,
  TextareaField,
} from './expensePageShared';
import {
  categoriesFrom,
  formatCivilDate,
  peopleFrom,
  positiveMoneyInputSchema,
  todayIso,
} from './expensePageUtils';

const recurringSchema = z
  .object({
    name: z.string().trim().min(1, 'Introduce un nombre.').max(120),
    categoryId: z.string().min(1, 'Selecciona una categoría.'),
    amount: positiveMoneyInputSchema,
    scope: z.enum(['HOUSEHOLD', 'PERSONAL']),
    personalPersonId: z.string().optional(),
    frequency: z.enum([
      'WEEKLY',
      'MONTHLY',
      'BIMONTHLY',
      'QUARTERLY',
      'SEMIANNUAL',
      'YEARLY',
      'CUSTOM_MONTHS',
      'ONE_TIME',
    ]),
    intervalMonths: z.string().optional(),
    startDate: z.string().min(1, 'Indica la fecha de inicio.'),
    nextDueDate: z.string().min(1, 'Indica el próximo vencimiento.'),
    endDate: z.string().optional(),
    marginMode: z.enum(['GENERAL', 'SPECIFIC']),
    safetyMargin: z.string().optional(),
    remindersEnabled: z.boolean(),
    notes: z.string().trim().max(2_000, 'Las notas son demasiado largas.').optional(),
  })
  .superRefine((values, context) => {
    if (values.scope === 'PERSONAL' && !values.personalPersonId) {
      context.addIssue({
        code: 'custom',
        message: 'Selecciona la persona responsable.',
        path: ['personalPersonId'],
      });
    }
    if (
      values.frequency === 'CUSTOM_MONTHS' &&
      (!values.intervalMonths || Number(values.intervalMonths) < 1)
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Indica cada cuántos meses se repite.',
        path: ['intervalMonths'],
      });
    }
    if (values.endDate && values.endDate < values.startDate) {
      context.addIssue({
        code: 'custom',
        message: 'La fecha final no puede ser anterior a la inicial.',
        path: ['endDate'],
      });
    }
    if (values.nextDueDate && values.nextDueDate < values.startDate) {
      context.addIssue({
        code: 'custom',
        message: 'El próximo vencimiento no puede ser anterior al inicio.',
        path: ['nextDueDate'],
      });
    }
    if (values.marginMode === 'SPECIFIC') {
      const normalized = String(values.safetyMargin ?? '').trim().replace(',', '.');
      const percent = Number(normalized);
      if (
        !/^\d{1,3}(?:\.\d{1,2})?$/.test(normalized) ||
        !Number.isFinite(percent) ||
        percent < 0 ||
        percent > 100
      ) {
        context.addIssue({
          code: 'custom',
          message: 'El margen debe estar entre 0 % y 100 %, con hasta dos decimales.',
          path: ['safetyMargin'],
        });
      }
    }
  });

const paymentSchema = z
  .object({
    status: z.enum(['PAID', 'SKIPPED']),
    actualAmount: z.string().optional(),
    paymentDate: z.string().optional(),
    updateNextAmount: z.boolean(),
    notes: z.string().trim().max(2_000, 'Las notas son demasiado largas.').optional(),
  })
  .superRefine((values, context) => {
    if (values.status === 'PAID') {
      const amountResult = positiveMoneyInputSchema.safeParse(values.actualAmount ?? '');
      if (!amountResult.success) {
        context.addIssue({
          code: 'custom',
          message: amountResult.error.issues[0].message,
          path: ['actualAmount'],
        });
      }
      if (!values.paymentDate) {
        context.addIssue({
          code: 'custom',
          message: 'Indica la fecha de pago.',
          path: ['paymentDate'],
        });
      }
    }
    if (values.status === 'SKIPPED' && values.updateNextAmount) {
      context.addIssue({
        code: 'custom',
        message: 'Un vencimiento omitido no puede cambiar el próximo importe.',
        path: ['updateNextAmount'],
      });
    }
  });

const frequencyLabels = {
  WEEKLY: 'Semanal',
  MONTHLY: 'Mensual',
  BIMONTHLY: 'Bimestral',
  QUARTERLY: 'Trimestral',
  SEMIANNUAL: 'Semestral',
  YEARLY: 'Anual',
  CUSTOM_MONTHS: 'Cada varios meses',
  ONE_TIME: 'Pago único',
};

function centsForInput(cents) {
  return Number.isSafeInteger(cents) ? (cents / 100).toFixed(2) : '';
}

function bpsForInput(bps) {
  return Number.isInteger(bps) ? String(bps / 100).replace('.', ',') : '';
}

function marginInputToBps(value) {
  return Math.round(Number(String(value).trim().replace(',', '.')) * 100);
}

function PaymentForm({ currency, expense, householdId, onClose }) {
  const queryClient = useQueryClient();
  const payment = useMutation({
    mutationFn: financeService.registerPayment,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.recurringExpenses.all(householdId),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.recurringExpenses.payments(householdId, expense.id),
        }),
        queryClient.invalidateQueries({ queryKey: ['calendar', householdId] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard', householdId] }),
      ]);
      toast.success('Pago registrado.');
      onClose();
    },
  });
  const {
    formState: { errors },
    handleSubmit,
    register,
    setValue,
    watch,
  } = useForm({
    defaultValues: {
      actualAmount: centsForInput(expense.amountCents),
      notes: '',
      paymentDate: todayIso(),
      status: 'PAID',
      updateNextAmount: false,
    },
    resolver: zodResolver(paymentSchema),
  });
  const status = watch('status');
  const statusRegistration = register('status', {
    onChange: (event) => {
      if (event.target.value === 'SKIPPED') {
        setValue('updateNextAmount', false, {
          shouldDirty: true,
          shouldValidate: true,
        });
      }
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await payment.mutateAsync({
        householdId,
        expenseId: expense.id,
        body: {
          actualAmountCents:
            values.status === 'PAID' ? eurosInputToCents(values.actualAmount) : null,
          dueDate: isoDate(expense.nextDueDate),
          expectedAmountCents: expense.amountCents,
          nextAmountDecision: values.updateNextAmount
            ? 'UPDATE_NEXT_AMOUNT'
            : 'KEEP_PREVIOUS',
          nextExpectedAmountCents: values.updateNextAmount
            ? eurosInputToCents(values.actualAmount)
            : null,
          notes: values.notes || null,
          paymentDate: values.status === 'PAID' ? values.paymentDate : null,
          status: values.status,
        },
      });
    } catch {
      // El error normalizado se muestra dentro del formulario.
    }
  });

  return (
    <form
      aria-label={`Registrar pago de ${expense.name}`}
      className="mt-5 border-t border-border pt-5"
      noValidate
      onSubmit={onSubmit}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="font-extrabold text-text">Registrar vencimiento</h4>
          <p className="mt-1 text-sm text-text-muted">
            Previsto: {formatCents(expense.amountCents, currency)} ·{' '}
            {formatCivilDate(expense.nextDueDate)}
          </p>
        </div>
        <button
          aria-label="Cancelar registro de pago"
          className="grid size-11 shrink-0 place-items-center rounded-xl text-text-muted hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          onClick={onClose}
          type="button"
        >
          <X aria-hidden="true" className="size-5" />
        </button>
      </div>

      <fieldset className="mt-5">
        <legend className="text-sm font-bold text-text">Resultado del vencimiento</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {[
            ['PAID', 'Pagado'],
            ['SKIPPED', 'Omitido'],
          ].map(([value, label]) => (
            <label
              className="flex min-h-12 items-center gap-3 rounded-xl border border-border-strong px-3.5 py-2.5 text-sm font-semibold has-[:checked]:border-brand has-[:checked]:bg-brand-soft"
              key={value}
            >
              <input
                className="size-4 accent-brand"
                type="radio"
                value={value}
                {...statusRegistration}
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      {status === 'PAID' ? (
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <FormField
            error={errors.actualAmount?.message}
            inputMode="decimal"
            label="Importe real (€)"
            placeholder="0,00"
            {...register('actualAmount')}
          />
          <FormField
            error={errors.paymentDate?.message}
            label="Fecha de pago"
            type="date"
            {...register('paymentDate')}
          />
        </div>
      ) : null}

      {status === 'PAID' ? (
        <label className="mt-5 flex min-h-11 items-start gap-3 rounded-xl bg-surface-muted px-3.5 py-3 text-sm text-text">
          <input className="mt-0.5 size-4 accent-brand" type="checkbox" {...register('updateNextAmount')} />
          <span>
            <span className="block font-bold">Usar el importe real en el próximo vencimiento</span>
            <span className="mt-0.5 block text-xs leading-5 text-text-muted">
              El histórico conservará por separado el importe que se esperaba y el que se pagó.
            </span>
          </span>
        </label>
      ) : null}

      <div className="mt-5">
        <TextareaField
          error={errors.notes?.message}
          label="Notas (opcional)"
          maxLength={2_000}
          {...register('notes')}
        />
      </div>
      <div className="mt-5 space-y-4">
        <AuthError error={payment.error} />
        <SubmitButton isPending={payment.isPending} pendingLabel="Registrando pago…">
          Guardar pago
        </SubmitButton>
      </div>
    </form>
  );
}

function RecurringForm({ categories, householdId, initialExpense = null, onClose, people }) {
  const queryClient = useQueryClient();
  const isEditing = Boolean(initialExpense);
  const saveExpense = useMutation({
    mutationFn: isEditing ? financeService.updateRecurring : financeService.createRecurring,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.recurringExpenses.all(householdId),
      });
      toast.success(isEditing ? 'Gasto recurrente actualizado.' : 'Gasto recurrente creado.');
      onClose();
    },
  });
  const {
    formState: { errors },
    handleSubmit,
    register,
    watch,
  } = useForm({
    defaultValues: {
      amount: centsForInput(initialExpense?.amountCents),
      categoryId: initialExpense?.categoryId ?? categories[0]?.id ?? '',
      endDate: isoDate(initialExpense?.endDate),
      frequency: initialExpense?.frequency ?? 'MONTHLY',
      intervalMonths: initialExpense?.intervalMonths
        ? String(initialExpense.intervalMonths)
        : '',
      marginMode: Number.isInteger(initialExpense?.safetyMarginOverrideBps)
        ? 'SPECIFIC'
        : 'GENERAL',
      name: initialExpense?.name ?? '',
      nextDueDate: isoDate(initialExpense?.nextDueDate) || todayIso(),
      notes: initialExpense?.notes ?? '',
      personalPersonId: initialExpense?.personalPersonId ?? '',
      remindersEnabled: initialExpense?.remindersEnabled ?? true,
      safetyMargin: bpsForInput(initialExpense?.safetyMarginOverrideBps),
      scope: initialExpense?.scope ?? 'HOUSEHOLD',
      startDate: isoDate(initialExpense?.startDate) || todayIso(),
    },
    resolver: zodResolver(recurringSchema),
  });
  const scope = watch('scope');
  const frequency = watch('frequency');
  const marginMode = watch('marginMode');

  const onSubmit = handleSubmit(async (values) => {
    try {
      await saveExpense.mutateAsync({
        householdId,
        ...(isEditing ? { expenseId: initialExpense.id } : {}),
        body: {
          amountCents: eurosInputToCents(values.amount),
          categoryId: values.categoryId,
          endDate: values.endDate || null,
          frequency: values.frequency,
          intervalMonths:
            values.frequency === 'CUSTOM_MONTHS' ? Number(values.intervalMonths) : null,
          name: values.name,
          nextDueDate: values.nextDueDate,
          notes: values.notes || null,
          personalPersonId: values.scope === 'PERSONAL' ? values.personalPersonId : null,
          remindersEnabled: values.remindersEnabled,
          safetyMarginOverrideBps:
            values.marginMode === 'SPECIFIC'
              ? marginInputToBps(values.safetyMargin)
              : null,
          scope: values.scope,
          startDate: values.startDate,
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
          ? 'Actualiza el próximo vencimiento sin alterar los pagos ya registrados.'
          : 'Define el importe esperado y cuándo vuelve a vencer.'
      }
      onClose={onClose}
      title={isEditing ? `Editar ${initialExpense.name}` : 'Añadir gasto recurrente'}
    >
      {categories.length === 0 ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          Necesitas al menos una categoría activa antes de añadir un gasto.
        </p>
      ) : (
        <form className="space-y-5" noValidate onSubmit={onSubmit}>
          <div className="grid gap-5 sm:grid-cols-2">
            <FormField
              error={errors.name?.message}
              label="Nombre del gasto"
              placeholder="Por ejemplo, alquiler"
              {...register('name')}
            />
            <SelectField error={errors.categoryId?.message} label="Categoría" {...register('categoryId')}>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </SelectField>
            <FormField
              error={errors.amount?.message}
              inputMode="decimal"
              label="Importe previsto (€)"
              placeholder="0,00"
              {...register('amount')}
            />
            <SelectField error={errors.frequency?.message} label="Periodicidad" {...register('frequency')}>
              {Object.entries(frequencyLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </SelectField>
          </div>

          {frequency === 'CUSTOM_MONTHS' ? (
            <FormField
              error={errors.intervalMonths?.message}
              inputMode="numeric"
              label="Se repite cada (meses)"
              max="120"
              min="1"
              type="number"
              {...register('intervalMonths')}
            />
          ) : null}

          <fieldset>
            <legend className="text-sm font-bold text-text">Tipo de gasto</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {[
                ['HOUSEHOLD', UsersRound, 'Común', 'Se incluye en el presupuesto del hogar.'],
                ['PERSONAL', UserRound, 'Personal', 'Se asigna a una persona concreta.'],
              ].map(([value, Icon, label, description]) => (
                <label
                  className="flex min-h-16 items-start gap-3 rounded-xl border border-border-strong p-3.5 has-[:checked]:border-brand has-[:checked]:bg-brand-soft"
                  key={value}
                >
                  <input className="mt-1 size-4 accent-brand" type="radio" value={value} {...register('scope')} />
                  <Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-brand-strong" />
                  <span>
                    <span className="block text-sm font-bold">{label}</span>
                    <span className="mt-0.5 block text-xs leading-5 text-text-muted">{description}</span>
                  </span>
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

          <div className="grid gap-5 sm:grid-cols-3">
            <FormField
              error={errors.startDate?.message}
              help="El día en que empezó este gasto. Por ejemplo, cuando comenzó tu contrato de alquiler."
              label="Fecha de inicio"
              type="date"
              {...register('startDate')}
            />
            <FormField
              error={errors.nextDueDate?.message}
              help="La fecha del siguiente pago que tienes que hacer."
              label="Próximo vencimiento"
              type="date"
              {...register('nextDueDate')}
            />
            <FormField
              error={errors.endDate?.message}
              help="La fecha del último pago. Si el gasto seguirá activo, déjala vacía."
              label="Fecha final (opcional)"
              type="date"
              {...register('endDate')}
            />
          </div>

          <fieldset>
            <legend className="text-sm font-bold text-text">Margen de seguridad</legend>
            <p className="mt-1 text-xs leading-5 text-text-muted">
              El margen propio del gasto tiene prioridad sobre el de su categoría y el general.
            </p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {[
                ['GENERAL', 'Heredar margen', 'Usa la categoría o el margen general.'],
                ['SPECIFIC', 'Margen propio', 'Solo se aplica a este gasto.'],
              ].map(([value, label, description]) => (
                <label
                  className="flex min-h-16 items-start gap-3 rounded-xl border border-border-strong p-3.5 has-[:checked]:border-brand has-[:checked]:bg-brand-soft"
                  key={value}
                >
                  <input
                    className="mt-1 size-4 accent-brand"
                    type="radio"
                    value={value}
                    {...register('marginMode')}
                  />
                  <span>
                    <span className="block text-sm font-bold">{label}</span>
                    <span className="mt-0.5 block text-xs leading-5 text-text-muted">
                      {description}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {marginMode === 'SPECIFIC' ? (
            <FormField
              error={errors.safetyMargin?.message}
              help="Admite valores entre 0 y 100, con hasta dos decimales."
              inputMode="decimal"
              label="Margen específico (%)"
              placeholder="10"
              {...register('safetyMargin')}
            />
          ) : null}

          <label className="flex min-h-11 items-center gap-3 rounded-xl bg-surface-muted px-3.5 py-3 text-sm font-semibold text-text">
            <input className="size-4 accent-brand" type="checkbox" {...register('remindersEnabled')} />
            Activar recordatorios de vencimiento
          </label>

          <TextareaField
            error={errors.notes?.message}
            label="Notas (opcional)"
            maxLength={2_000}
            placeholder="Información útil para reconocer este gasto"
            {...register('notes')}
          />
          <AuthError error={saveExpense.error} />
          <SubmitButton isPending={saveExpense.isPending} pendingLabel="Guardando gasto…">
            {isEditing ? 'Guardar cambios' : 'Guardar gasto recurrente'}
          </SubmitButton>
        </form>
      )}
    </FormCard>
  );
}

export function RecurringExpensesPage() {
  const queryClient = useQueryClient();
  const { expenseId: routeExpenseId } = useParams();
  const [searchParams] = useSearchParams();
  const household = useHousehold();
  const householdId = household.currentHousehold?.id;
  const currency = household.currentHousehold?.currency ?? 'EUR';
  const [showForm, setShowForm] = useState(false);
  const [paymentExpenseId, setPaymentExpenseId] = useState(null);
  const [editingExpenseId, setEditingExpenseId] = useState(null);
  const [deletingExpenseId, setDeletingExpenseId] = useState(null);
  const [expandedExpenseId, setExpandedExpenseId] = useState(routeExpenseId ?? null);
  const expenses = useQuery({
    enabled: Boolean(householdId),
    queryFn: () => financeService.recurring(householdId),
    queryKey: queryKeys.recurringExpenses.all(householdId),
  });
  const categoriesQuery = useQuery({
    enabled: Boolean(householdId),
    queryFn: () => householdService.listCategories(householdId),
    queryKey: queryKeys.categories.list(householdId),
  });
  const peopleQuery = useQuery({
    enabled: Boolean(householdId),
    queryFn: () => householdService.listPeople(householdId),
    queryKey: ['householdPeople', householdId],
  });
  const categories = categoriesFrom(categoriesQuery.data);
  const people = peopleFrom(peopleQuery.data).filter((person) => person.isActive !== false);
  const deleteExpense = useMutation({
    mutationFn: financeService.deleteRecurring,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.recurringExpenses.all(householdId) }),
        queryClient.invalidateQueries({ queryKey: ['budget', householdId] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard', householdId] }),
        queryClient.invalidateQueries({ queryKey: ['calendar', householdId] }),
      ]);
      setDeletingExpenseId(null);
      toast.success('Gasto recurrente eliminado del presupuesto.');
    },
  });
  const routeExpenseFound = Boolean(
    routeExpenseId &&
      expenses.isSuccess &&
      expenses.data.some((expense) => expense.id === routeExpenseId),
  );
  const routeExpenseMissing = Boolean(routeExpenseId && expenses.isSuccess && !routeExpenseFound);
  const shouldRegisterRoutePayment = searchParams.get('action') === 'register-payment';
  const expenseToDelete = expenses.data?.find((expense) => expense.id === deletingExpenseId);

  useEffect(() => {
    if (routeExpenseId) setExpandedExpenseId(routeExpenseId);
  }, [routeExpenseId]);

  useEffect(() => {
    if (!routeExpenseFound) return;
    const linkedExpense = document.getElementById(`recurring-expense-${routeExpenseId}`);
    if (typeof linkedExpense?.scrollIntoView === 'function') {
      linkedExpense.scrollIntoView({ block: 'center' });
    }
  }, [routeExpenseFound, routeExpenseId]);

  useEffect(() => {
    if (routeExpenseFound && shouldRegisterRoutePayment) {
      setPaymentExpenseId(routeExpenseId);
    }
  }, [routeExpenseFound, routeExpenseId, shouldRegisterRoutePayment]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <PageHeader
          eyebrow="Gastos"
          title="Gastos recurrentes"
        />
        {household.currentHousehold ? (
          <button
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-extrabold text-on-brand shadow-sm hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            onClick={() => {
              setEditingExpenseId(null);
              setPaymentExpenseId(null);
              setShowForm(true);
            }}
            type="button"
          >
            <Plus aria-hidden="true" className="size-5" />
            Añadir gasto recurrente
          </button>
        ) : null}
      </div>

      <HouseholdGate household={household}>
        {expenseToDelete ? (
          <ConfirmationDialog
            confirmLabel="Eliminar gasto"
            description="Dejará de aparecer en el presupuesto y en los próximos vencimientos. El historial de pagos se conservará."
            isPending={deleteExpense.isPending}
            onCancel={() => setDeletingExpenseId(null)}
            onConfirm={() =>
              deleteExpense.mutate({ householdId, expenseId: expenseToDelete.id })
            }
            pendingLabel="Eliminando…"
            title={`¿Eliminar ${expenseToDelete.name}?`}
          />
        ) : null}
        <AuthError error={deleteExpense.error} />
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
            <RecurringForm
              categories={categories}
              householdId={householdId}
              onClose={() => setShowForm(false)}
              people={people}
            />
          )
        ) : null}

        {routeExpenseMissing ? (
          <div
            className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"
            role="alert"
          >
            <p className="font-extrabold">No se encuentra el gasto enlazado</p>
            <p className="mt-1 leading-6">
              Puede que se haya archivado o que pertenezca a otro hogar. Puedes seguir consultando
              los demás gastos recurrentes.
            </p>
          </div>
        ) : null}

        {expenses.isPending ? <LoadingState label="Cargando gastos recurrentes" /> : null}
        {expenses.isError ? (
          <ErrorState
            description={expenses.error.message}
            onRetry={expenses.refetch}
            title="No se han podido cargar los gastos"
          />
        ) : null}
        {expenses.isSuccess && expenses.data.length === 0 ? (
          <EmptyState
            action={
              <button
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-on-brand hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                onClick={() => {
                  setEditingExpenseId(null);
                  setShowForm(true);
                }}
                type="button"
              >
                Añadir el primer gasto
              </button>
            }
            description="Añade pagos como alquiler, seguros o suscripciones para anticipar sus vencimientos."
            icon={CalendarCheck2}
            title="No hay gastos recurrentes"
          />
        ) : null}
        {expenses.isSuccess && expenses.data.length > 0 ? (
          <section aria-labelledby="listado-recurrentes">
            <h2 className="text-xl font-extrabold tracking-tight" id="listado-recurrentes">
              Todos los gastos recurrentes
            </h2>
            <ul className="mt-4 space-y-3">
              {expenses.data.map((expense) => {
                const isLinkedExpense = routeExpenseId === expense.id;
                const isExpanded = expandedExpenseId === expense.id;
                const isEditing = editingExpenseId === expense.id;

                return (
                <li
                  className={`rounded-2xl border bg-surface p-5 shadow-card ${
                    isLinkedExpense
                      ? 'border-brand ring-2 ring-brand-soft'
                      : 'border-border'
                  }`}
                  id={`recurring-expense-${expense.id}`}
                  key={expense.id}
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <CategoryIconBadge category={expense.category} />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="break-words font-extrabold text-text">{expense.name}</h3>
                          <StatusBadge>{frequencyLabels[expense.frequency] ?? expense.frequency}</StatusBadge>
                        </div>
                        <p className="mt-1 text-sm text-text-muted">
                          {expense.category?.name ?? 'Sin categoría'} ·{' '}
                          {expense.scope === 'PERSONAL'
                            ? expense.personalPerson?.name ?? 'Personal'
                            : 'Gasto común'}
                        </p>
                        <p className="mt-2 text-sm font-semibold text-text">
                          Próximo: {formatCivilDate(expense.nextDueDate)}
                        </p>
                        {isLinkedExpense ? (
                          <p className="mt-2 text-xs font-bold uppercase tracking-wide text-brand-strong">
                            Gasto relacionado con el aviso
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <div className="sm:text-right">
                      <p className="text-xl font-extrabold text-text">
                          {formatCents(expense.amountCents, currency)}
                        </p>
                      <p className="mt-1 text-xs font-semibold text-text-muted">
                        {Number.isInteger(expense.safetyMarginOverrideBps)
                          ? `Margen propio: ${expense.safetyMarginOverrideBps / 100} %`
                          : 'Margen heredado'}
                      </p>
                      <div className="mt-3 flex flex-col gap-2 min-[430px]:flex-row sm:justify-end">
                        <button
                          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-brand px-3 py-2 text-sm font-bold text-brand-strong hover:bg-brand-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                          onClick={() => {
                            setEditingExpenseId(null);
                            setPaymentExpenseId((current) =>
                              current === expense.id ? null : expense.id,
                            );
                          }}
                          type="button"
                        >
                          <CheckCircle2 aria-hidden="true" className="size-4" />
                          Registrar pago
                        </button>
                        <button
                          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border-strong px-3 py-2 text-sm font-bold text-text hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                          onClick={() => {
                            setShowForm(false);
                            setPaymentExpenseId(null);
                            setExpandedExpenseId(null);
                            setEditingExpenseId((current) =>
                              current === expense.id ? null : expense.id,
                            );
                          }}
                          type="button"
                        >
                          <Pencil aria-hidden="true" className="size-4" />
                          Editar
                        </button>
                        <button
                          aria-label={`Eliminar ${expense.name}`}
                          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-red-300 px-3 py-2 text-sm font-bold text-red-800 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 disabled:cursor-wait disabled:opacity-60"
                          disabled={deleteExpense.isPending}
                          onClick={() => {
                            deleteExpense.reset();
                            setEditingExpenseId(null);
                            setPaymentExpenseId(null);
                            setDeletingExpenseId(expense.id);
                          }}
                          type="button"
                        >
                          <Trash2 aria-hidden="true" className="size-4" />
                          Eliminar
                        </button>
                        <button
                          aria-controls={`recurring-details-${expense.id}`}
                          aria-expanded={isExpanded}
                          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border-strong px-3 py-2 text-sm font-bold text-text hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                          onClick={() => {
                            setEditingExpenseId(null);
                            setPaymentExpenseId(null);
                            setExpandedExpenseId((current) =>
                              current === expense.id ? null : expense.id,
                            );
                          }}
                          type="button"
                        >
                          <ChevronDown
                            aria-hidden="true"
                            className={`size-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                          />
                          {isExpanded ? 'Ocultar detalles' : 'Ver detalles'}
                        </button>
                      </div>
                    </div>
                  </div>
                  {paymentExpenseId === expense.id ? (
                    <PaymentForm
                      currency={currency}
                      expense={expense}
                      householdId={householdId}
                      onClose={() => setPaymentExpenseId(null)}
                    />
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
                        title="No se puede editar el gasto"
                      />
                    ) : (
                      <div className="mt-5">
                        <RecurringForm
                          categories={categories}
                          householdId={householdId}
                          initialExpense={expense}
                          key={expense.id}
                          onClose={() => setEditingExpenseId(null)}
                          people={people}
                        />
                      </div>
                    )
                  ) : null}
                  {isExpanded ? (
                    <div id={`recurring-details-${expense.id}`}>
                      <RecurringExpenseDetails
                        currency={currency}
                        expense={expense}
                        householdId={householdId}
                      />
                    </div>
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
