import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BarChart3, ChevronDown, Pencil, Plus, ReceiptText, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { z } from 'zod';

import { queryKeys } from '../api/queryKeys';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState, LoadingState } from '../components/ui/FeedbackStates';
import { PageHeader } from '../components/ui/PageHeader';
import { AuthError, SubmitButton } from '../features/auth/components/AuthFeedback';
import { FormField } from '../features/auth/components/FormField';
import { InvoiceDocumentsPanel } from '../features/finance/InvoiceDocumentsPanel';
import { financeService } from '../features/finance/financeService';
import { eurosInputToCents, formatCents, isoDate } from '../features/finance/money';
import { householdService } from '../features/households/householdService';
import { CategoryIconBadge } from '../features/households/categoryIcons';
import { useHousehold } from '../features/households/useHousehold';
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
  positiveMoneyInputSchema,
  todayIso,
} from './expensePageUtils';

const invoiceSchema = z
  .object({
    amount: positiveMoneyInputSchema,
    categoryId: z.string().min(1, 'Selecciona una categoría.'),
    chargeDate: z.string().optional(),
    invoiceDate: z.string().min(1, 'Indica la fecha de la factura.'),
    notes: z.string().trim().max(2_000, 'Las notas son demasiado largas.').optional(),
    periodEnd: z.string().min(1, 'Indica el fin del periodo.'),
    periodStart: z.string().min(1, 'Indica el inicio del periodo.'),
  })
  .refine((values) => values.periodEnd >= values.periodStart, {
    message: 'El fin del periodo no puede ser anterior al inicio.',
    path: ['periodEnd'],
  });

function monthStart() {
  return `${todayIso().slice(0, 7)}-01`;
}

function centsForInput(cents) {
  return Number.isSafeInteger(cents) ? (cents / 100).toFixed(2) : '';
}

function invoiceRecency(invoice) {
  const timestamp = new Date(invoice.invoiceDate ?? invoice.periodEnd ?? 0).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function groupInvoicesByCategory(invoices) {
  const groups = new Map();

  invoices.forEach((invoice) => {
    const categoryName = invoice.category?.name ?? 'Sin categoría';
    const categoryId = invoice.categoryId ?? invoice.category?.id ?? categoryName;
    const existing = groups.get(categoryId);

    if (existing) {
      existing.invoices.push(invoice);
      return;
    }

    groups.set(categoryId, {
      category: invoice.category,
      categoryId,
      categoryName,
      invoices: [invoice],
    });
  });

  return [...groups.values()]
    .map((group) => {
      const invoicesByRecency = [...group.invoices].sort(
        (left, right) => invoiceRecency(right) - invoiceRecency(left),
      );

      return { ...group, invoices: invoicesByRecency, latestInvoice: invoicesByRecency[0] };
    })
    .sort((left, right) => invoiceRecency(right.latestInvoice) - invoiceRecency(left.latestInvoice));
}

function InvoiceForm({ categories, householdId, initialInvoice = null, onClose }) {
  const queryClient = useQueryClient();
  const isEditing = Boolean(initialInvoice);
  const saveInvoice = useMutation({
    mutationFn: isEditing ? financeService.updateInvoice : financeService.createInvoice,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all(householdId) }),
        queryClient.invalidateQueries({ queryKey: ['invoiceStatistics', householdId] }),
      ]);
      toast.success(isEditing ? 'Factura actualizada.' : 'Factura añadida al histórico.');
      onClose();
    },
  });
  const {
    formState: { errors },
    handleSubmit,
    register,
  } = useForm({
    defaultValues: {
      amount: centsForInput(initialInvoice?.amountCents),
      categoryId: initialInvoice?.categoryId ?? categories[0]?.id ?? '',
      chargeDate: isoDate(initialInvoice?.chargeDate),
      invoiceDate: isoDate(initialInvoice?.invoiceDate) || todayIso(),
      notes: initialInvoice?.notes ?? '',
      periodEnd: isoDate(initialInvoice?.periodEnd) || todayIso(),
      periodStart: isoDate(initialInvoice?.periodStart) || monthStart(),
    },
    resolver: zodResolver(invoiceSchema),
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await saveInvoice.mutateAsync({
        householdId,
        ...(isEditing ? { invoiceId: initialInvoice.id } : {}),
        body: {
          amountCents: eurosInputToCents(values.amount),
          categoryId: values.categoryId,
          chargeDate: values.chargeDate || null,
          invoiceDate: values.invoiceDate,
          notes: values.notes || null,
          periodEnd: values.periodEnd,
          periodStart: values.periodStart,
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
          ? 'Actualiza el importe o las fechas. Los documentos adjuntos se conservarán.'
          : 'Guarda el importe real y el periodo que cubre para obtener medias comparables.'
      }
      onClose={onClose}
      title={isEditing ? 'Editar factura' : 'Añadir factura'}
    >
      {categories.length === 0 ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          Necesitas al menos una categoría activa antes de añadir una factura.
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
              error={errors.amount?.message}
              inputMode="decimal"
              label="Importe de la factura (€)"
              placeholder="0,00"
              {...register('amount')}
            />
          </div>

          <fieldset>
            <legend className="text-sm font-bold text-text">Periodo facturado</legend>
            <p className="mt-1 text-xs leading-5 text-text-muted">
              Se incluyen ambos días para calcular el equivalente mensual ponderado.
            </p>
            <div className="mt-3 grid gap-5 sm:grid-cols-2">
              <FormField
                error={errors.periodStart?.message}
                label="Inicio del periodo"
                type="date"
                {...register('periodStart')}
              />
              <FormField
                error={errors.periodEnd?.message}
                label="Fin del periodo"
                type="date"
                {...register('periodEnd')}
              />
            </div>
          </fieldset>

          <div className="grid gap-5 sm:grid-cols-2">
            <FormField
              error={errors.invoiceDate?.message}
              label="Fecha de emisión"
              type="date"
              {...register('invoiceDate')}
            />
            <FormField
              error={errors.chargeDate?.message}
              label="Fecha de cobro (opcional)"
              type="date"
              {...register('chargeDate')}
            />
          </div>

          <TextareaField
            error={errors.notes?.message}
            label="Notas (opcional)"
            maxLength={2_000}
            placeholder="Por ejemplo, lectura estimada o regularización"
            {...register('notes')}
          />
          <AuthError error={saveInvoice.error} />
          <SubmitButton
            isPending={saveInvoice.isPending}
            pendingLabel={isEditing ? 'Guardando cambios…' : 'Guardando factura…'}
          >
            {isEditing ? 'Guardar cambios' : 'Guardar factura'}
          </SubmitButton>
        </form>
      )}
    </FormCard>
  );
}

function Statistics({ currency, statistics }) {
  if (statistics.length === 0) return null;

  return (
    <section aria-labelledby="estadisticas-facturas">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-brand-soft text-brand-strong">
          <BarChart3 aria-hidden="true" className="size-5" />
        </span>
        <div>
          <h2 className="text-xl font-extrabold tracking-tight" id="estadisticas-facturas">
            Medias por categoría
          </h2>
          <p className="mt-0.5 text-sm text-text-muted">
            Los importes se ponderan por los días que cubre cada factura.
          </p>
        </div>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {statistics.map((item) => (
          <article className="rounded-2xl border border-border bg-surface p-5 shadow-card" key={item.categoryId}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <CategoryIconBadge category={item.category} />
                <div>
                  <h3 className="font-extrabold text-text">{item.category?.name ?? 'Categoría'}</h3>
                  <p className="mt-1 text-xs text-text-muted">
                    {item.invoiceCount} {item.invoiceCount === 1 ? 'factura' : 'facturas'} · Margen{' '}
                    {(item.effectiveMarginBps ?? 0) / 100}%
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
            <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ['Histórica', item.historicalAverageCents],
                ['3 meses', item.averages?.months3],
                ['6 meses', item.averages?.months6],
                ['12 meses', item.averages?.months12],
              ].map(([label, value]) => (
                <div className="rounded-xl bg-surface-muted p-3" key={label}>
                  <dt className="text-xs font-semibold text-text-muted">{label}</dt>
                  <dd className="mt-1 text-sm font-extrabold text-text">{formatCents(value, currency)}</dd>
                </div>
              ))}
            </dl>
          </article>
        ))}
      </div>
    </section>
  );
}

export function InvoicesPage() {
  const queryClient = useQueryClient();
  const household = useHousehold();
  const householdId = household.currentHousehold?.id;
  const currency = household.currentHousehold?.currency ?? 'EUR';
  const [showForm, setShowForm] = useState(false);
  const [editingInvoiceId, setEditingInvoiceId] = useState(null);
  const [deletingInvoiceId, setDeletingInvoiceId] = useState(null);
  const [expandedCategoryId, setExpandedCategoryId] = useState(null);
  const invoices = useQuery({
    enabled: Boolean(householdId),
    queryFn: () => financeService.invoices(householdId),
    queryKey: queryKeys.invoices.all(householdId),
  });
  const statistics = useQuery({
    enabled: Boolean(householdId),
    queryFn: () => financeService.invoiceStatistics(householdId),
    queryKey: ['invoiceStatistics', householdId],
  });
  const categoriesQuery = useQuery({
    enabled: Boolean(householdId),
    queryFn: () => householdService.listCategories(householdId),
    queryKey: ['householdCategories', householdId],
  });
  const categories = categoriesFrom(categoriesQuery.data);
  const deleteInvoice = useMutation({
    mutationFn: financeService.deleteInvoice,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all(householdId) }),
        queryClient.invalidateQueries({ queryKey: ['invoiceStatistics', householdId] }),
        queryClient.invalidateQueries({ queryKey: ['budget', householdId] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard', householdId] }),
      ]);
      setDeletingInvoiceId(null);
      setEditingInvoiceId(null);
      toast.success('Factura eliminada.');
    },
  });
  const invoiceGroups = useMemo(
    () => groupInvoicesByCategory(invoices.data ?? []),
    [invoices.data],
  );
  const invoiceToDelete = invoices.data?.find((invoice) => invoice.id === deletingInvoiceId);

  useEffect(() => {
    setExpandedCategoryId((current) =>
      invoiceGroups.some((group) => group.categoryId === current)
        ? current
        : (invoiceGroups[0]?.categoryId ?? null),
    );
  }, [invoiceGroups]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <PageHeader
          eyebrow="Gastos"
          title="Facturas"
        />
        {household.currentHousehold ? (
          <button
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-extrabold text-on-brand shadow-sm hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            onClick={() => {
              setEditingInvoiceId(null);
              setShowForm(true);
            }}
            type="button"
          >
            <Plus aria-hidden="true" className="size-5" />
            Añadir factura
          </button>
        ) : null}
      </div>

      <HouseholdGate household={household}>
        {invoiceToDelete ? (
          <ConfirmationDialog
            confirmLabel="Eliminar factura"
            description="La factura se eliminará definitivamente junto con sus documentos adjuntos. Esta acción no se puede deshacer."
            isPending={deleteInvoice.isPending}
            onCancel={() => setDeletingInvoiceId(null)}
            onConfirm={() =>
              deleteInvoice.mutate({ householdId, invoiceId: invoiceToDelete.id })
            }
            pendingLabel="Eliminando…"
            title="¿Eliminar esta factura?"
          />
        ) : null}
        <AuthError error={deleteInvoice.error} />
        {showForm ? (
          categoriesQuery.isPending ? (
            <LoadingState label="Preparando formulario" />
          ) : categoriesQuery.isError ? (
            <ErrorState
              description={categoriesQuery.error.message}
              onRetry={categoriesQuery.refetch}
              title="No se puede preparar el formulario"
            />
          ) : (
            <InvoiceForm
              categories={categories}
              householdId={householdId}
              onClose={() => setShowForm(false)}
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
          <Statistics currency={currency} statistics={statistics.data} />
        ) : null}

        {invoices.isPending ? <LoadingState label="Cargando histórico de facturas" /> : null}
        {invoices.isError ? (
          <ErrorState
            description={invoices.error.message}
            onRetry={invoices.refetch}
            title="No se ha podido cargar el histórico"
          />
        ) : null}
        {invoices.isSuccess && invoices.data.length === 0 ? (
          <EmptyState
            action={
              <button
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-on-brand hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                onClick={() => {
                  setEditingInvoiceId(null);
                  setShowForm(true);
                }}
                type="button"
              >
                Añadir la primera factura
              </button>
            }
            description="Guarda varias facturas de luz, agua o gas para construir una media mensual fiable."
            icon={ReceiptText}
            title="No hay facturas guardadas"
          />
        ) : null}
        {invoices.isSuccess && invoices.data.length > 0 ? (
          <section aria-labelledby="historico-facturas">
            <h2 className="text-xl font-extrabold tracking-tight" id="historico-facturas">
              Histórico
            </h2>
            <div className="mt-4 space-y-3">
              {invoiceGroups.map((group) => {
                const isExpanded = expandedCategoryId === group.categoryId;
                const categoryContentId = `facturas-categoria-${group.categoryId}`;

                return (
                  <section className="overflow-hidden rounded-2xl border border-border bg-surface shadow-card" key={group.categoryId}>
                    <h3>
                      <button
                        aria-controls={categoryContentId}
                        aria-expanded={isExpanded}
                        className="flex min-h-16 w-full items-center gap-3 p-4 text-left hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-focus sm:p-5"
                        onClick={() => {
                          setEditingInvoiceId(null);
                          setExpandedCategoryId((current) =>
                            current === group.categoryId ? null : group.categoryId,
                          );
                        }}
                        type="button"
                      >
                        <CategoryIconBadge category={group.category} />
                        <span className="min-w-0 flex-1">
                          <span className="block break-words font-extrabold text-text">{group.categoryName}</span>
                          <span className="mt-0.5 block text-sm leading-5 text-text-muted">
                            {group.invoices.length} {group.invoices.length === 1 ? 'factura' : 'facturas'} · Última:{' '}
                            {formatCivilDate(group.latestInvoice.invoiceDate)}
                          </span>
                        </span>
                        <ChevronDown
                          aria-hidden="true"
                          className={`size-5 shrink-0 text-text-muted transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        />
                      </button>
                    </h3>
                    {isExpanded ? (
                      <div className="border-t border-border p-4 sm:p-5" id={categoryContentId}>
                        <ul className="space-y-3">
                          {group.invoices.map((invoice) => (
                            <li className="space-y-4 rounded-xl border border-border bg-surface-muted p-4" key={invoice.id}>
                              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm leading-5 text-text-muted">
                                    Periodo: {formatCivilDate(invoice.periodStart)} –{' '}
                                    {formatCivilDate(invoice.periodEnd)}
                                  </p>
                                  <p className="mt-0.5 text-xs leading-5 text-text-soft">
                                    Emitida: {formatCivilDate(invoice.invoiceDate)}
                                    {invoice.chargeDate ? ` · Cobrada: ${formatCivilDate(invoice.chargeDate)}` : ''}
                                  </p>
                                </div>
                                <div className="sm:text-right">
                                  <p className="text-xl font-extrabold text-text">
                                    {formatCents(invoice.amountCents, currency)}
                                  </p>
                                  <div className="mt-2 flex flex-wrap justify-end gap-2">
                                    <button
                                      aria-label={`Editar factura de ${group.categoryName}`}
                                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border-strong px-3 py-2 text-sm font-bold text-text hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                                      onClick={() => {
                                        setShowForm(false);
                                        setDeletingInvoiceId(null);
                                        setEditingInvoiceId((current) =>
                                          current === invoice.id ? null : invoice.id,
                                        );
                                      }}
                                      type="button"
                                    >
                                      <Pencil aria-hidden="true" className="size-4" />
                                      Editar
                                    </button>
                                    <button
                                      aria-label={`Eliminar factura de ${group.categoryName}`}
                                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-red-300 px-3 py-2 text-sm font-bold text-red-800 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 disabled:cursor-wait disabled:opacity-60"
                                      disabled={deleteInvoice.isPending}
                                      onClick={() => {
                                        deleteInvoice.reset();
                                        setEditingInvoiceId(null);
                                        setDeletingInvoiceId(invoice.id);
                                      }}
                                      type="button"
                                    >
                                      <Trash2 aria-hidden="true" className="size-4" />
                                      Eliminar
                                    </button>
                                  </div>
                                </div>
                              </div>
                              {editingInvoiceId === invoice.id ? (
                                categoriesQuery.isPending ? (
                                  <LoadingState label="Preparando edición" />
                                ) : categoriesQuery.isError ? (
                                  <ErrorState
                                    description={categoriesQuery.error.message}
                                    onRetry={categoriesQuery.refetch}
                                    title="No se puede editar la factura"
                                  />
                                ) : (
                                  <div className="mt-5">
                                    <InvoiceForm
                                      categories={categories}
                                      householdId={householdId}
                                      initialInvoice={invoice}
                                      key={invoice.id}
                                      onClose={() => setEditingInvoiceId(null)}
                                    />
                                  </div>
                                )
                              ) : null}
                              <InvoiceDocumentsPanel householdId={householdId} invoice={invoice} />
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </section>
                );
              })}
            </div>
          </section>
        ) : null}
      </HouseholdGate>
    </div>
  );
}
