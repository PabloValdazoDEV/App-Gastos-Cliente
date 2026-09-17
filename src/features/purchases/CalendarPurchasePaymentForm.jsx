import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';

import { queryKeys } from '../../api/queryKeys';
import { ErrorState, LoadingState } from '../../components/ui/FeedbackStates';
import { PurchaseInstallmentForm } from './PurchaseInstallmentForm';
import { invalidatePurchasePaymentQueries, purchasePaymentsService } from './purchasePaymentsService';
import { purchasesService } from './purchasesService';

// Calendar amounts are privacy-filtered allocations. Fetch the authorized
// purchase before editing a real installment; never submit a participant's
// displayed share as if it were the installment's complete payment.
export function CalendarPurchasePaymentForm({ householdId, event, mode, currency, timezone, onClose }) {
  const queryClient = useQueryClient();
  const mountedRef = useRef(true);
  const mutationLock = useRef(false);
  const [accessError, setAccessError] = useState(null);
  const purchaseId = event.purchaseId;
  const editing = mode === 'edit';
  const purchaseQuery = useQuery({
    queryKey: queryKeys.purchases.detail(householdId, purchaseId),
    queryFn: ({ signal }) => purchasesService.detail({ householdId, purchaseId, signal }),
    staleTime: 0,
    refetchOnMount: 'always',
  });
  const installment = purchaseQuery.data?.financing?.installments?.find((item) => item.id === event.installmentId);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (purchaseQuery.isError && [401, 403, 404].includes(purchaseQuery.error?.status)) {
      // A previously visible calendar card may have lost purchase access. Ask
      // the calendar for its privacy-filtered replacement; do not keep offering
      // an action just because its old event is still cached.
      queryClient.invalidateQueries({ queryKey: ['calendar', householdId] });
    }
  }, [householdId, purchaseQuery.error, purchaseQuery.isError, queryClient]);

  const savePayment = useMutation({
    mutationFn: editing ? purchasePaymentsService.correct : purchasePaymentsService.pay,
    onSuccess: async (purchase) => {
      if (mountedRef.current) {
        queryClient.setQueryData(queryKeys.purchases.detail(householdId, purchaseId), purchase);
        toast.success(editing ? 'Pago de cuota corregido.' : 'Cuota registrada como pagada.');
      }
      await invalidatePurchasePaymentQueries(queryClient, householdId, purchaseId, { active: mountedRef.current });
      if (mountedRef.current) onClose();
    },
    onError: async (error) => {
      if (!mountedRef.current) return;
      if ([401, 403, 404].includes(error.status)) setAccessError(error);
      if ([401, 403, 404, 409].includes(error.status)) {
        toast.error(error.message);
        await invalidatePurchasePaymentQueries(queryClient, householdId, purchaseId, { active: mountedRef.current });
        if (mountedRef.current) onClose();
      }
    },
  });

  async function save(body) {
    if (mutationLock.current || savePayment.isPending) return;
    mutationLock.current = true;
    try { await savePayment.mutateAsync({ householdId, purchaseId, installmentId: event.installmentId, body }); }
    finally { mutationLock.current = false; }
  }

  const cancel = <button className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl border border-border-strong px-4 py-2.5 text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-60" disabled={savePayment.isPending} onClick={onClose} type="button">Cancelar</button>;
  if (accessError) return <div className="mt-5"><ErrorState title="No se puede registrar esta cuota" description={accessError.message} />{cancel}</div>;
  if (purchaseQuery.isPending || (purchaseQuery.isFetching && !purchaseQuery.isFetchedAfterMount)) return <div className="mt-5"><LoadingState label="Cargando datos del pago de compra" />{cancel}</div>;
  if (purchaseQuery.isError) return <div className="mt-5"><ErrorState title="No se puede abrir el pago de esta compra" description={purchaseQuery.error.message} onRetry={purchaseQuery.refetch} />{cancel}</div>;
  const allowed = installment && (editing ? installment.status === 'PAID' && event.canEditPayment === true : installment.status === 'PLANNED' && installment.canRegisterPayment === true && event.canRegisterPayment === true);
  if (!installment || (!allowed && !savePayment.isPending)) return <div className="mt-5"><ErrorState title="Esta cuota ya no admite esta acción" description="Puede haberse registrado desde otro dispositivo, o existir una cuota anterior pendiente. Actualiza el calendario antes de continuar." />{cancel}</div>;

  return <div className="mt-5 min-w-0 space-y-3 border-t border-border pt-5">
    {event.ownershipType === 'SPLIT' ? <p className="rounded-xl bg-brand-soft p-3 text-sm leading-6 text-brand-strong">En el calendario ves solo tu parte. Aquí registras el importe total pagado de la cuota para todas las personas participantes; el reparto se calcula automáticamente.</p> : null}
    <PurchaseInstallmentForm currency={currency} error={savePayment.error} installment={installment} isPending={savePayment.isPending} key={`${event.installmentId}:${mode}`} onCancel={onClose} onSubmit={save} timezone={timezone} />
  </div>;
}
