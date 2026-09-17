import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, Pencil, Undo2 } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';

import { queryKeys } from '../../api/queryKeys';
import { ErrorState, SuccessNotice } from '../../components/ui/FeedbackStates';
import { formatCents } from '../finance/money';
import { PurchaseConfirmation } from './PurchaseConfirmation';
import { PurchaseInstallmentForm } from './PurchaseInstallmentForm';
import { purchaseDateLabel } from './presentation';
import { invalidatePurchasePaymentQueries, purchasePaymentsService } from './purchasePaymentsService';

const secondaryButton = 'inline-flex min-h-11 min-w-0 max-w-full items-center justify-center gap-2 rounded-xl border border-border-strong px-3 py-2 text-sm font-bold text-text hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-60';
const statusLabels = { PLANNED: 'Pendiente', PAID: 'Pagada', CANCELLED: 'Anulada' };

function installmentDraftIsStale(draft, purchase) {
  if (!draft) return false;
  const current = purchase.financing?.installments?.find((installment) => installment.id === draft.id);
  if (purchase.archivedAt || purchase.paymentMethod !== 'FINANCED' || !current || current.status !== draft.status) return true;
  if (current.status === 'PLANNED' && current.canRegisterPayment !== true) return true;
  if (current.status === 'PAID' && current.canEditPayment === false) return true;
  return ['dueDate', 'expectedAmountCents', 'actualAmountCents', 'paidAt', 'notes']
    .some((field) => (current[field] ?? null) !== (draft[field] ?? null));
}

function PaymentValue({ label, children }) {
  return <div className="min-w-0"><dt className="text-sm text-text-muted">{label}</dt><dd className="mt-1 min-w-0 font-bold tabular-nums [overflow-wrap:anywhere]">{children}</dd></div>;
}

function PaymentsContent({ householdId, purchase, currency, timezone, disabled, onBusyChange }) {
  const queryClient = useQueryClient();
  const titleId = useId();
  const containerRef = useRef(null);
  const headingRef = useRef(null);
  const triggerRef = useRef(null);
  const restoreFocusRef = useRef(false);
  const mountedRef = useRef(true);
  const lockRef = useRef(false);
  const [form, setForm] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const [success, setSuccess] = useState(null);
  const [changeNotice, setChangeNotice] = useState(null);
  const [accessError, setAccessError] = useState(null);
  const purchaseId = purchase.id;
  const financing = purchase.financing;
  const progress = financing?.progress;
  const installments = financing?.installments ?? [];

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  async function finish(updated, message) {
    if (mountedRef.current) {
      // Publish the authoritative result, then refresh this purchase and its
      // household financial views. Documents and bank balances are unchanged.
      queryClient.setQueryData(queryKeys.purchases.detail(householdId, purchaseId), updated);
      restoreFocusRef.current = true;
      setForm(null); setConfirmation(null); setChangeNotice(null); setSuccess(message);
    }
    await invalidatePurchasePaymentQueries(queryClient, householdId, purchaseId, { active: mountedRef.current });
    if (mountedRef.current) onBusyChange?.(false);
  }
  async function failure(error) {
    if (error?.status === 409) {
      // A conflict can be caused by another tab/device or a newly pending prior
      // installment. Refresh the authoritative purchase and financial views;
      // never reinterpret the stale pay draft as a correction of an actual pay.
      await invalidatePurchasePaymentQueries(queryClient, householdId, purchaseId, { active: mountedRef.current });
      if (mountedRef.current) {
        restoreFocusRef.current = true;
        setForm(null); setConfirmation(null); setSuccess(null);
        setChangeNotice('La cuota ha cambiado y no se ha guardado tu solicitud. Revisa la información antes de intentarlo de nuevo.');
        onBusyChange?.(false);
      }
      return;
    }
    if (mountedRef.current && [401, 403, 404].includes(error?.status)) {
      setAccessError(error);
      onBusyChange?.(false);
      await queryClient.invalidateQueries({ queryKey: queryKeys.purchases.detail(householdId, purchaseId), exact: true });
    }
  }
  const pay = useMutation({ mutationFn: purchasePaymentsService.pay, onSuccess: (result) => finish(result, 'Cuota registrada como pagada.'), onError: failure });
  const correct = useMutation({ mutationFn: purchasePaymentsService.correct, onSuccess: (result) => finish(result, 'Pago corregido. Se conserva la auditoría del cambio.'), onError: failure });
  const revert = useMutation({ mutationFn: purchasePaymentsService.revert, onSuccess: (result) => finish(result, 'Cuota devuelta a pendiente. La corrección queda auditada.'), onError: failure });
  const busy = pay.isPending || correct.isPending || revert.isPending;
  useEffect(() => {
    // Do not interrupt our own pending request or overwrite its success/error.
    // Ignore unrelated metadata refreshes; compare only the action's source data.
    if (busy || accessError || (!installmentDraftIsStale(form, purchase) && !installmentDraftIsStale(confirmation, purchase))) return;
    restoreFocusRef.current = true;
    setForm(null); setConfirmation(null); setSuccess(null);
    setChangeNotice('La cuota ha cambiado. Hemos cerrado la edición sin guardar. Revisa los datos actualizados antes de continuar.');
    onBusyChange?.(false);
  }, [busy, accessError, form, confirmation, purchase, onBusyChange]);
  useEffect(() => {
    if (!disabled && !busy && !form && !confirmation && restoreFocusRef.current) {
      // A mutation can finish before React Query notifies the parent that its
      // cached purchase changed. Do not focus an old action that will disappear
      // on that pending render (for example "Volver a pendiente" after undo).
      const published = queryClient.getQueryData(queryKeys.purchases.detail(householdId, purchaseId));
      if (published && published !== purchase) return;
      const target = [...(containerRef.current?.querySelectorAll('[data-payment-trigger]:not(:disabled)') ?? [])].find((node) => node.dataset.paymentTrigger === triggerRef.current);
      (target ?? headingRef.current)?.focus();
      restoreFocusRef.current = false;
    }
  }, [busy, disabled, form, confirmation, householdId, purchaseId, purchase, queryClient]);
  function reset() { pay.reset(); correct.reset(); revert.reset(); setSuccess(null); setChangeNotice(null); }
  function openForm(installment) {
    if (disabled || lockRef.current || (installment.status !== 'PAID' && installment.canRegisterPayment !== true)) return;
    reset(); triggerRef.current = installment.id; setForm(installment); onBusyChange?.(true);
  }
  function close() { restoreFocusRef.current = true; setForm(null); setConfirmation(null); onBusyChange?.(false); }
  async function run(action) {
    if (lockRef.current || disabled) return;
    lockRef.current = true;
    onBusyChange?.(true);
    try { await action(); }
    finally { lockRef.current = false; }
  }
  async function save(body) {
    return run(() => (form.status === 'PAID' ? correct : pay).mutateAsync({ householdId, purchaseId, installmentId: form.id, body }));
  }
  async function undo() {
    try { await run(() => revert.mutateAsync({ householdId, purchaseId, installmentId: confirmation.id })); }
    catch { /* The confirmation keeps the error and permits retry. */ }
  }

  if (accessError) return <ErrorState title="No se pueden consultar los pagos" description={accessError.message} />;
  const financed = purchase.paymentMethod === 'FINANCED';
  return <section aria-labelledby={titleId} className="min-w-0 space-y-4 [overflow-wrap:anywhere]" ref={containerRef}>
    <h2 className="rounded-lg text-xl font-extrabold focus:outline-2 focus:outline-focus" id={titleId} ref={headingRef} tabIndex={-1}>Forma de pago · {financed ? 'Financiado' : 'Al contado'}</h2>
    <p className="text-sm leading-6 text-text-muted">El presupuesto incluye las obligaciones de cada mes. Los pagos confirmados suman gasto utilizado por su fecha real y se muestran en el calendario. Los saldos no se modifican automáticamente.</p>
    {success ? <SuccessNotice title={success} /> : null}
    {changeNotice ? <p aria-live="polite" className="rounded-xl border border-border bg-surface-muted p-4 text-sm leading-6 text-text" role="status">{changeNotice}</p> : null}
    {!financed ? <div className="min-w-0 rounded-2xl border border-border bg-surface p-5 shadow-card">
      {purchase.paymentDate && purchase.paidAmountCents != null ? <dl className="grid min-w-0 gap-4 sm:grid-cols-2">
        <PaymentValue label="Importe pagado">{formatCents(purchase.paidAmountCents, currency)}</PaymentValue>
        <PaymentValue label="Fecha de pago">{purchaseDateLabel(purchase.paymentDate)}</PaymentValue>
      </dl> : <p className="text-sm text-text-muted">Pago sin confirmar. No se ha supuesto que esta compra esté pagada. Puedes registrar sus datos en «Editar compra».</p>}
      <p className="mt-3 text-xs leading-5 text-text-muted">La fecha y el importe del pago se pueden corregir en «Editar compra».</p>
    </div> : !financing || !progress ? <ErrorState title="No se ha podido mostrar la financiación" description="Vuelve a abrir la compra para cargar el plan de cuotas." /> : <>
      <div className="min-w-0 space-y-5 rounded-2xl border border-border bg-surface p-5 shadow-card sm:p-6">
        <dl className="grid min-w-0 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <PaymentValue label="Precio de compra">{formatCents(purchase.totalCents, currency)}</PaymentValue>
          <PaymentValue label="Entrada">{formatCents(financing.downPaymentCents, currency)}<span className="mt-1 block text-xs font-medium text-text-muted">{financing.downPaymentCents === 0 ? 'Sin entrada' : financing.downPaymentPaidAt ? `Pagada el ${purchaseDateLabel(financing.downPaymentPaidAt)}` : 'Pendiente de confirmar el pago'}</span></PaymentValue>
          <PaymentValue label="Principal financiado">{formatCents(financing.financedPrincipalCents, currency)}</PaymentValue>
          <PaymentValue label="Total a pagar en cuotas">{formatCents(financing.financingTotalCents, currency)}</PaymentValue>
          <PaymentValue label="Coste de financiación">{formatCents(progress.costOfFinancingCents, currency)}</PaymentValue>
          <PaymentValue label="Coste total previsto">{formatCents(progress.totalCostCents, currency)}</PaymentValue>
          <PaymentValue label="Entidad o tienda financiera">{financing.provider || 'Sin indicar'}</PaymentValue>
        </dl>
        <div aria-label="Progreso de pagos" className="min-w-0 space-y-4 rounded-xl bg-brand-soft p-4">
          <dl className="grid min-w-0 gap-4 sm:grid-cols-2">
            <PaymentValue label="Pagado registrado">{formatCents(progress.paidCents, currency)}</PaymentValue>
            <PaymentValue label="Pendiente previsto">{formatCents(progress.pendingCents, currency)}</PaymentValue>
          </dl>
          <p className="font-bold">{progress.paidInstallmentCount} / {progress.installmentCount} cuotas pagadas</p>
          <progress aria-label="Cuotas pagadas" className="block h-3 w-full max-w-full accent-brand" max={Math.max(1, progress.installmentCount)} value={progress.paidInstallmentCount} />
          <p className="text-xs leading-5 text-text-muted">Pagado suma los importes reales y la entrada confirmada. Pendiente suma las cuotas pendientes y la entrada sin confirmar. Un pago distinto al previsto no cambia las demás cuotas.</p>
        </div>
        <div><h3 className="text-sm font-bold">Próxima cuota</h3><p className="mt-1 text-sm">{progress.nextInstallment ? <>Cuota {progress.nextInstallment.sequence} · {purchaseDateLabel(progress.nextInstallment.dueDate)} · {formatCents(progress.nextInstallment.expectedAmountCents, currency)}</> : 'No hay cuotas pendientes.'}</p></div>
        <p className="text-xs leading-5 text-text-muted">Puedes editar la entidad y los datos de financiación en «Editar compra». Si hay cuotas pagadas, el plan queda protegido frente a cambios que borrarían el historial.</p>
      </div>
      {form ? <PurchaseInstallmentForm currency={currency} error={form.status === 'PAID' ? correct.error : pay.error} installment={form} isPending={busy} key={form.id} onCancel={close} onSubmit={save} timezone={timezone} /> : null}
      <h3 className="text-lg font-extrabold">Calendario de cuotas de esta compra</h3>
      {!installments.length ? <p className="rounded-xl border border-border p-4 text-sm text-text-muted">No hay cuotas en este plan.</p> : <ol aria-label="Cuotas de la compra" className="min-w-0 space-y-3">
        {installments.map((installment) => <li className="min-w-0 rounded-2xl border border-border bg-surface p-4 shadow-card sm:p-5" key={installment.id}>
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-2"><h4 className="font-extrabold">Cuota {installment.sequence}</h4><span className="rounded-lg bg-surface-muted px-2.5 py-1 text-xs font-bold">{statusLabels[installment.status] ?? 'Estado no disponible'}</span></div>
          <p className="mt-2 text-sm">Vencimiento: <time dateTime={installment.dueDate?.slice(0, 10)}>{purchaseDateLabel(installment.dueDate)}</time> · Previsto: <span className="font-bold tabular-nums">{formatCents(installment.expectedAmountCents, currency)}</span></p>
          {installment.status === 'PAID' ? <p className="mt-2 text-sm text-brand-strong">Pagado: <strong className="tabular-nums">{formatCents(installment.actualAmountCents, currency)}</strong> · {purchaseDateLabel(installment.paidAt)}</p> : null}
          {installment.notes ? <p className="mt-2 whitespace-pre-wrap text-sm text-text-muted">{installment.notes}</p> : null}
          {installment.status === 'CANCELLED' ? <p className="mt-2 text-xs text-text-muted">Cuota anulada. No se considera pagada ni una cuota que se pueda omitir.</p> : <div className="mt-4 flex min-w-0 flex-wrap gap-2">
            <button aria-label={installment.status === 'PAID' ? `Editar pago de cuota ${installment.sequence}` : `Marcar cuota ${installment.sequence} como pagada`} className={secondaryButton} data-payment-trigger={installment.id} disabled={disabled || busy || Boolean(form) || (installment.status !== 'PAID' && installment.canRegisterPayment !== true)} onClick={() => openForm(installment)} type="button">{installment.status === 'PAID' ? <Pencil aria-hidden="true" className="size-4 shrink-0" /> : <Check aria-hidden="true" className="size-4 shrink-0" />}{installment.status === 'PAID' ? 'Editar pago' : 'Marcar como pagada'}</button>
            {installment.status === 'PAID' ? <button aria-label={`Volver cuota ${installment.sequence} a pendiente`} className={`${secondaryButton} border-red-200 text-red-800 hover:bg-red-50`} data-payment-trigger={`revert:${installment.id}`} disabled={disabled || busy || Boolean(form)} onClick={() => { reset(); triggerRef.current = `revert:${installment.id}`; setConfirmation(installment); onBusyChange?.(true); }} type="button"><Undo2 aria-hidden="true" className="size-4 shrink-0" />Volver a pendiente</button> : null}
          </div>}
          {installment.status === 'PLANNED' && installment.canRegisterPayment !== true ? <p className="mt-2 text-xs leading-5 text-text-muted">Primero registra la cuota pendiente anterior. Solo se puede anticipar la primera cuota pendiente.</p> : null}
        </li>)}
      </ol>}
    </>}
    {confirmation ? <PurchaseConfirmation title={`¿Volver la cuota ${confirmation.sequence} a pendiente?`} description={`Se retirará el pago registrado de ${formatCents(confirmation.actualAmountCents, currency)} del ${purchaseDateLabel(confirmation.paidAt)} del gasto utilizado. Úsalo para corregir un registro erróneo, no para omitir una deuda. La obligación volverá a calcularse con la propiedad actual. La corrección quedará auditada y no cambia los saldos automáticamente.`} confirmLabel="Confirmar vuelta a pendiente" error={revert.error} isPending={busy} onCancel={close} onConfirm={undo} /> : null}
  </section>;
}

export function PurchasePaymentsPanel({ householdId, purchase, currency = 'EUR', timezone, disabled = false, onBusyChange }) {
  return <PaymentsContent currency={currency} disabled={disabled} householdId={householdId} key={`${householdId}:${purchase.id}`} onBusyChange={onBusyChange} purchase={purchase} timezone={timezone} />;
}
