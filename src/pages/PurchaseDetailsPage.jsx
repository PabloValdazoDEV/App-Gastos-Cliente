import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, ArrowLeft, Pencil, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { queryKeys } from '../api/queryKeys';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState, LoadingState } from '../components/ui/FeedbackStates';
import { PageHeader } from '../components/ui/PageHeader';
import { formatCents } from '../features/finance/money';
import { householdService } from '../features/households/householdService';
import { useHousehold } from '../features/households/useHousehold';
import { invalidatePurchaseQueries } from '../features/purchases/invalidatePurchaseQueries';
import { PurchaseConfirmation } from '../features/purchases/PurchaseConfirmation';
import { PurchaseForm } from '../features/purchases/PurchaseForm';
import { PurchaseItemForm } from '../features/purchases/PurchaseItemForm';
import { PurchaseDocumentsPanel } from '../features/purchases/PurchaseDocumentsPanel';
import { PurchasePaymentsPanel } from '../features/purchases/PurchasePaymentsPanel';
import { ownershipLabel, purchaseDateLabel, purchaseTitle } from '../features/purchases/presentation';
import { purchasesService } from '../features/purchases/purchasesService';
import { WarrantyStatus } from '../features/purchases/WarrantyStatus';
import { FormCard } from './expensePageShared';
import { peopleFrom } from './expensePageUtils';

const secondaryButton = 'inline-flex min-h-11 max-w-full items-center justify-center gap-2 rounded-xl border border-border-strong px-4 py-2.5 text-sm font-bold text-text hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-60';
const destructiveButton = 'inline-flex min-h-11 max-w-full items-center justify-center gap-2 rounded-xl border border-red-200 px-4 py-2.5 text-sm font-bold text-red-800 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 disabled:cursor-not-allowed disabled:opacity-60';

function DetailValue({ label, children }) {
  return <div className="min-w-0"><dt className="text-sm text-text-muted">{label}</dt><dd className="mt-1 min-w-0 break-words font-bold text-text [overflow-wrap:anywhere]">{children}</dd></div>;
}

function PurchaseDetailsContent({ household, purchaseId }) {
  const householdId = household.id;
  const currency = household.currency ?? 'EUR';
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [form, setForm] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [analysisBusy, setAnalysisBusy] = useState(false);
  const triggerRef = useRef(null);
  const formTriggerRef = useRef(null);
  const restoreFocusRef = useRef(false);
  const formRef = useRef(null);
  const productsRef = useRef(null);
  const mountedRef = useRef(true);
  const retireDetailRef = useRef(false);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      // Remove after the route unmounts: removing an observed query earlier can
      // recreate it and briefly cache a stale detail during navigation.
      if (retireDetailRef.current) {
        queryClient.removeQueries({ queryKey: queryKeys.purchases.detail(householdId, purchaseId), exact: true });
        queryClient.removeQueries({ queryKey: queryKeys.purchases.documents(householdId, purchaseId), exact: true });
        queryClient.removeQueries({ queryKey: queryKeys.purchases.analyses(householdId, purchaseId) });
      }
    };
  }, [householdId, purchaseId, queryClient]);
  const purchaseQuery = useQuery({ queryKey: queryKeys.purchases.detail(householdId, purchaseId), queryFn: () => purchasesService.detail({ householdId, purchaseId }) });
  const peopleQuery = useQuery({ enabled: form?.mode === 'purchase', queryKey: ['householdPeople', householdId], queryFn: () => householdService.listPeople(householdId) });
  const closeForm = () => { restoreFocusRef.current = true; setForm(null); };
  const retireDetail = (message) => {
    queryClient.cancelQueries({ queryKey: queryKeys.purchases.detail(householdId, purchaseId), exact: true });
    queryClient.cancelQueries({ queryKey: queryKeys.purchases.documents(householdId, purchaseId), exact: true });
    queryClient.cancelQueries({ queryKey: queryKeys.purchases.analyses(householdId, purchaseId) });
    queryClient.setQueryData(queryKeys.purchases.all(householdId), (previous) => previous?.filter((entry) => entry.id !== purchaseId));
    if (mountedRef.current) {
      retireDetailRef.current = true;
      toast.success(message);
      navigate('/compras', { replace: true });
    } else {
      queryClient.removeQueries({ queryKey: queryKeys.purchases.detail(householdId, purchaseId), exact: true });
      queryClient.removeQueries({ queryKey: queryKeys.purchases.documents(householdId, purchaseId), exact: true });
      queryClient.removeQueries({ queryKey: queryKeys.purchases.analyses(householdId, purchaseId) });
    }
  };
  const finishSave = async (purchase) => {
    if (purchase?.accessRevoked) {
      retireDetail('Compra guardada. Ya no tienes acceso con esta propiedad.');
      await invalidatePurchaseQueries(queryClient, householdId);
      return;
    }
    await invalidatePurchaseQueries(queryClient, householdId, purchaseId);
    if (!mountedRef.current) return;
    closeForm();
    toast.success('Compra actualizada.');
  };
  const update = useMutation({ mutationFn: purchasesService.update, onSuccess: finishSave });
  const createItem = useMutation({ mutationFn: purchasesService.createItem, onSuccess: finishSave });
  const updateItem = useMutation({ mutationFn: purchasesService.updateItem, onSuccess: finishSave });
  const archive = useMutation({
    mutationFn: purchasesService.archive,
    onSuccess: async () => {
      retireDetail('Compra archivada.');
      await invalidatePurchaseQueries(queryClient, householdId);
    },
  });
  const deleteItem = useMutation({
    mutationFn: purchasesService.deleteItem,
    onSuccess: async () => {
      await invalidatePurchaseQueries(queryClient, householdId, purchaseId);
      if (!mountedRef.current) return;
      setConfirmation(null);
      productsRef.current?.focus();
      toast.success('Producto eliminado.');
    },
  });
  useEffect(() => {
    if (form && (form.mode !== 'purchase' || peopleQuery.isSuccess)) formRef.current?.querySelector('input, select, textarea')?.focus();
    if (!form && restoreFocusRef.current) {
      const trigger = [...document.querySelectorAll('[data-purchase-trigger]')].find((element) => element.dataset.purchaseTrigger === formTriggerRef.current);
      trigger?.focus();
      restoreFocusRef.current = false;
    }
  }, [form, peopleQuery.isSuccess]);
  const openForm = (mode, event, item = null) => {
    triggerRef.current = event.currentTarget;
    formTriggerRef.current = mode === 'purchase' ? 'purchase' : item?.id ?? 'new';
    update.reset(); createItem.reset(); updateItem.reset();
    setForm({ mode, item });
  };
  const openConfirmation = (mode, event, item = null) => {
    triggerRef.current = event.currentTarget;
    archive.reset(); deleteItem.reset();
    setConfirmation({ mode, item });
  };
  const closeConfirmation = () => { setConfirmation(null); triggerRef.current?.focus(); };
  const backLink = <Link className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-bold text-brand-strong hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" to="/compras"><ArrowLeft aria-hidden="true" className="size-4" />Volver a Compras</Link>;

  if (purchaseQuery.isPending) return <div className="space-y-6">{backLink}<LoadingState label="Cargando compra" /></div>;
  if (purchaseQuery.isError) return <div className="space-y-6">{backLink}<ErrorState title="No se puede abrir esta compra" description={purchaseQuery.error?.status === 404 ? 'Puede estar archivada o no estar disponible para ti en este hogar.' : purchaseQuery.error.message} onRetry={purchaseQuery.refetch} /></div>;
  const purchase = purchaseQuery.data;
  const items = purchase.items ?? [];
  const itemMutation = form?.item ? updateItem : createItem;
  const busy = update.isPending || createItem.isPending || updateItem.isPending || paymentBusy || analysisBusy;

  return (
    <div className="min-w-0 space-y-6">
      {backLink}
      <div className="min-w-0 [overflow-wrap:anywhere]"><PageHeader eyebrow="Compras y garantías" title={purchaseTitle(purchase)} description="El precio describe lo comprado. Su forma de pago determina el presupuesto y el gasto registrado de cada mes." /></div>
      {confirmation ? <PurchaseConfirmation
        title={confirmation.mode === 'archive' ? '¿Archivar esta compra?' : `¿Eliminar ${confirmation.item.name}?`}
        description={confirmation.mode === 'archive' ? 'Dejará de aparecer en Compras. Se conservarán sus datos, productos y documentos, pero no podrás consultarlos desde la aplicación mientras esté archivada. Los pagos registrados conservan su historial financiero; las obligaciones pendientes dejan de incluirse en el presupuesto y el calendario. Archivar no cancela una deuda con la entidad ni cambia los saldos.' : 'Este producto se eliminará de la compra. Sus documentos se conservarán asociados a la compra completa. Los demás productos y el total registrado no cambiarán.'}
        confirmLabel={confirmation.mode === 'archive' ? 'Archivar compra' : 'Eliminar producto'}
        error={confirmation.mode === 'archive' ? archive.error : deleteItem.error}
        isPending={confirmation.mode === 'archive' ? archive.isPending : deleteItem.isPending}
        onCancel={closeConfirmation}
        onConfirm={() => confirmation.mode === 'archive' ? archive.mutate({ householdId, purchaseId }) : deleteItem.mutate({ householdId, purchaseId, itemId: confirmation.item.id })}
      /> : null}
      {form ? <div ref={formRef}>
        <FormCard title={form.mode === 'purchase' ? 'Editar compra' : form.item ? 'Editar producto' : 'Añadir producto'} description={form.mode === 'purchase' ? 'Los productos se editan por separado. Al cambiar la fecha, solo se recalculan las garantías registradas por duración.' : undefined}>
          {form.mode === 'purchase' ? peopleQuery.isPending ? <LoadingState label="Preparando edición" /> : peopleQuery.isError ? <ErrorState title="No se puede preparar la edición" description={peopleQuery.error.message} onRetry={peopleQuery.refetch} /> : <PurchaseForm currency={currency} error={update.error} initialPurchase={purchase} isPending={update.isPending} key={purchaseId} onCancel={closeForm} onSubmit={(body) => update.mutateAsync({ householdId, purchaseId, body })} people={peopleFrom(peopleQuery.data).filter((person) => person.isActive !== false)} timezone={household.timezone} /> : <PurchaseItemForm currency={currency} error={itemMutation.error} initialItem={form.item} isPending={itemMutation.isPending} key={form.item?.id ?? 'new'} onCancel={closeForm} onSubmit={(body) => itemMutation.mutateAsync({ householdId, purchaseId, ...(form.item ? { itemId: form.item.id } : {}), body })} purchaseDate={purchase.purchaseDate} />}
          {form.mode === 'purchase' && !peopleQuery.isSuccess ? <button className={`${secondaryButton} mt-4`} onClick={closeForm} type="button">Cancelar</button> : null}
        </FormCard>
      </div> : null}
      <section aria-label="Datos de compra" className="min-w-0 rounded-2xl border border-border bg-surface p-5 shadow-card sm:p-6">
        <dl className="grid min-w-0 gap-5 sm:grid-cols-2">
          <DetailValue label="Tienda">{purchase.merchant || 'Sin indicar'}</DetailValue>
          <DetailValue label="Fecha de compra"><time dateTime={purchase.purchaseDate?.slice(0, 10)}>{purchaseDateLabel(purchase.purchaseDate)}</time></DetailValue>
          <DetailValue label="Precio de compra"><span className="text-2xl tabular-nums">{formatCents(purchase.totalCents, currency)}</span></DetailValue>
          <DetailValue label="Propiedad">{ownershipLabel(purchase)}</DetailValue>
        </dl>
        {purchase.ownershipType === 'SPLIT' ? <ul aria-label="Reparto de propiedad" className="mt-4 space-y-2 border-t border-border pt-4">{purchase.shares?.map((share) => <li className="flex min-w-0 flex-wrap justify-between gap-2 text-sm" key={share.householdPersonId}><span className="min-w-0 break-words">{share.householdPerson?.name ?? 'Persona del hogar'}</span><span className="font-bold">{new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 }).format(share.shareBps / 100)} %</span></li>)}</ul> : null}
        {purchase.notes ? <div className="mt-5 border-t border-border pt-4"><h2 className="text-sm font-bold">Notas de la compra</h2><p className="mt-1 whitespace-pre-wrap break-words text-sm text-text-muted [overflow-wrap:anywhere]">{purchase.notes}</p></div> : null}
        {!form ? <div className="mt-5 flex flex-wrap gap-2"><button className={secondaryButton} data-purchase-trigger="purchase" disabled={busy} onClick={(event) => openForm('purchase', event)} type="button"><Pencil aria-hidden="true" className="size-4 shrink-0" />Editar compra</button><button className={destructiveButton} disabled={busy} onClick={(event) => openConfirmation('archive', event)} type="button"><Archive aria-hidden="true" className="size-4 shrink-0" />Archivar compra</button></div> : null}
      </section>
      <PurchasePaymentsPanel currency={currency} disabled={Boolean(form || confirmation) || update.isPending || archive.isPending || deleteItem.isPending || analysisBusy} householdId={householdId} onBusyChange={setPaymentBusy} purchase={purchase} timezone={household.timezone} />
      <section aria-labelledby="productos-compra" className="min-w-0 space-y-4">
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="rounded-lg text-xl font-extrabold focus:outline-2 focus:outline-focus" id="productos-compra" ref={productsRef} tabIndex={-1}>Productos ({items.length})</h2>
          {!form ? <button className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-extrabold text-on-brand hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:opacity-60" data-purchase-trigger="new" disabled={busy} onClick={(event) => openForm('item', event)} type="button"><Plus aria-hidden="true" className="size-4 shrink-0" />Añadir producto</button> : null}
        </div>
        <ul className="min-w-0 space-y-4">
          {items.map((item) => <li className="min-w-0 rounded-2xl border border-border bg-surface p-5 shadow-card sm:p-6" key={item.id}>
            <h3 className="break-words text-lg font-extrabold [overflow-wrap:anywhere]">{item.name}</h3>
            {item.brand || item.model ? <p className="mt-1 break-words text-sm text-text-muted [overflow-wrap:anywhere]">{[item.brand, item.model].filter(Boolean).join(' · ')}</p> : null}
            <div className="my-4 rounded-xl bg-surface-muted p-3"><WarrantyStatus item={item} /></div>
            <dl className="grid min-w-0 gap-4 sm:grid-cols-2">
              <DetailValue label="Cantidad">{item.quantity}</DetailValue>
              {item.priceCents != null ? <DetailValue label="Precio registrado">{formatCents(item.priceCents, currency)}</DetailValue> : null}
              {item.serialNumber ? <DetailValue label="Número de serie">{item.serialNumber}</DetailValue> : null}
              {item.imei ? <DetailValue label="IMEI">{item.imei}</DetailValue> : null}
            </dl>
            {item.notes ? <p className="mt-4 whitespace-pre-wrap break-words text-sm text-text-muted [overflow-wrap:anywhere]">{item.notes}</p> : null}
            {!form ? <div className="mt-5 flex flex-wrap gap-2"><button aria-label={`Editar ${item.name}`} className={secondaryButton} data-purchase-trigger={item.id} disabled={busy} onClick={(event) => openForm('item', event, item)} type="button"><Pencil aria-hidden="true" className="size-4 shrink-0" />Editar producto</button><button aria-label={`Eliminar ${item.name}`} className={destructiveButton} disabled={items.length === 1 || busy} onClick={(event) => openConfirmation('deleteItem', event, item)} type="button"><Trash2 aria-hidden="true" className="size-4 shrink-0" />Eliminar producto</button></div> : null}
          </li>)}
        </ul>
        {items.length === 1 ? <p className="text-sm leading-6 text-text-muted">La compra debe conservar al menos un producto. Para retirar la compra completa, utiliza «Archivar compra».</p> : null}
      </section>
      <PurchaseDocumentsPanel currency={currency} disabled={Boolean(form || confirmation) || update.isPending || archive.isPending || deleteItem.isPending || paymentBusy} householdId={householdId} onBusyChange={setAnalysisBusy} purchase={purchase} />
    </div>
  );
}

export function PurchaseDetailsPage() {
  const household = useHousehold();
  const { purchaseId } = useParams();
  if (household.isPending) return <LoadingState label="Cargando hogar" />;
  if (household.isError) return <ErrorState title="No se ha podido cargar el hogar" description={household.error?.message} onRetry={household.refetch} />;
  if (!household.currentHousehold) return <EmptyState title="Necesitas un hogar" description="Selecciona un hogar para consultar esta compra." icon={ShoppingBag} />;
  return <PurchaseDetailsContent household={household.currentHousehold} purchaseId={purchaseId} key={`${household.currentHousehold.id}:${purchaseId}`} />;
}
