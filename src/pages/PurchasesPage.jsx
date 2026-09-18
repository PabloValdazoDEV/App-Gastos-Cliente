import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Plus, ShoppingBag } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Link, useNavigate } from 'react-router-dom';

import { queryKeys } from '../api/queryKeys';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState, LoadingState } from '../components/ui/FeedbackStates';
import { PageHeader } from '../components/ui/PageHeader';
import { formatCents } from '../features/finance/money';
import { householdService } from '../features/households/householdService';
import { useHousehold } from '../features/households/useHousehold';
import { invalidatePurchaseQueries } from '../features/purchases/invalidatePurchaseQueries';
import { PurchaseFilters } from '../features/purchases/PurchaseFilters';
import { PurchaseCreateFlow } from '../features/purchases/PurchaseCreateFlow';
import { filterPurchases, ownershipLabel, purchaseDateLabel, purchaseTitle } from '../features/purchases/presentation';
import { purchasesService } from '../features/purchases/purchasesService';
import { PurchaseWarrantySummary } from '../features/purchases/WarrantyStatus';
import { FormCard } from './expensePageShared';
import { peopleFrom } from './expensePageUtils';

function PurchasesContent({ household }) {
  const householdId = household.id;
  const currency = household.currency ?? 'EUR';
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [ownership, setOwnership] = useState('ALL');
  const [warranty, setWarranty] = useState('ALL');
  const triggerRef = useRef(null);
  const restoreFocusRef = useRef(false);
  const formRef = useRef(null);
  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);
  const purchases = useQuery({ queryKey: queryKeys.purchases.all(householdId), queryFn: () => purchasesService.list(householdId) });
  const peopleQuery = useQuery({ enabled: showForm, queryKey: ['householdPeople', householdId], queryFn: () => householdService.listPeople(householdId) });
  const onCreated = async (purchase) => {
      await invalidatePurchaseQueries(queryClient, householdId, purchase.id);
      if (!mountedRef.current) return;
      setShowForm(false);
      toast.success(purchase.accessRevoked ? 'Compra guardada. Ya no tienes acceso con esta propiedad.' : 'Compra guardada.');
      if (!purchase.accessRevoked) navigate(`/compras/${purchase.id}`);
      else restoreFocusRef.current = true;
  };
  useEffect(() => {
    if (showForm && peopleQuery.isSuccess) formRef.current?.querySelector('input, select, textarea')?.focus();
    if (!showForm && restoreFocusRef.current) { triggerRef.current?.focus(); restoreFocusRef.current = false; }
  }, [showForm, peopleQuery.isSuccess]);
  const openForm = () => { setShowForm(true); };
  const closeForm = () => { restoreFocusRef.current = true; setShowForm(false); };
  const visible = filterPurchases(purchases.data ?? [], { search, ownership, warranty });
  const addButton = <button className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-extrabold text-on-brand shadow-sm hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" onClick={openForm} ref={triggerRef} type="button"><Plus aria-hidden="true" className="size-5 shrink-0" />Añadir compra</button>;

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <PageHeader eyebrow="Compras y garantías" title="Compras" description="Ten localizados tus productos, garantías y pagos. El presupuesto recoge los pagos de cada mes, no el precio completo de una compra financiada." />
        {!showForm && purchases.data?.length > 0 ? addButton : null}
      </div>
      {showForm ? <div ref={formRef}>
        <FormCard title="Añadir compra" description="Un producto por compra, con sus documentos, garantía y pagos.">
          {peopleQuery.isPending ? <LoadingState label="Preparando formulario de compra" /> : peopleQuery.isError ? <ErrorState title="No se puede preparar el formulario" description={peopleQuery.error.message} onRetry={peopleQuery.refetch} /> : (
            <PurchaseCreateFlow householdId={householdId} currency={currency} onCancel={closeForm} onCreated={onCreated} people={peopleFrom(peopleQuery.data).filter((person) => person.isActive !== false)} timezone={household.timezone} />
          )}
          {!peopleQuery.isSuccess ? <button className="mt-4 min-h-11 rounded-xl border border-border-strong px-4 py-2 font-bold focus-visible:outline-2 focus-visible:outline-focus" onClick={closeForm} type="button">Cancelar</button> : null}
        </FormCard>
      </div> : null}
      {purchases.isPending ? <LoadingState label="Cargando compras" /> : purchases.isError ? <ErrorState title="No se han podido cargar las compras" description={purchases.error.message} onRetry={purchases.refetch} /> : purchases.data.length === 0 ? (
        !showForm ? <EmptyState title="Todavía no has guardado ninguna compra" description="Guarda compras importantes para tener localizados sus productos y garantías." icon={ShoppingBag} action={addButton} /> : null
      ) : <section aria-label="Compras guardadas" className="min-w-0 space-y-4">
        <PurchaseFilters search={search} ownership={ownership} warranty={warranty} onSearchChange={setSearch} onOwnershipChange={setOwnership} onWarrantyChange={setWarranty} />
        <p aria-live="polite" className="text-sm text-text-muted">{visible.length} {visible.length === 1 ? 'compra' : 'compras'} · Más recientes primero</p>
        {visible.length === 0 ? <p className="rounded-2xl border border-dashed border-border-strong p-5 text-sm text-text-muted">No hay compras que coincidan. Prueba otra búsqueda o limpia los filtros.</p> : <ul className="grid min-w-0 gap-4 lg:grid-cols-2">
          {visible.map((purchase) => <li className="min-w-0" key={purchase.id}>
            <Link aria-labelledby={`purchase-${purchase.id}-title`} aria-describedby={`purchase-${purchase.id}-action`} className="group flex h-full min-w-0 cursor-pointer flex-col rounded-2xl border border-border bg-surface p-5 shadow-card transition-colors hover:border-brand hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" to={`/compras/${purchase.id}`}>
              <h2 className="break-words text-xl font-extrabold text-brand-strong [overflow-wrap:anywhere]" id={`purchase-${purchase.id}-title`}>{purchaseTitle(purchase)}</h2>
              {(purchase.items?.length ?? 0) > 1 ? <p className="mt-1 text-sm font-bold">{purchase.items.length} productos</p> : null}
              <p className="mt-1 break-words text-sm text-text-muted">{purchase.merchant || 'Tienda sin indicar'}</p>
              <p className="mt-4 break-words text-2xl font-extrabold tabular-nums">{formatCents(purchase.totalCents, currency)}</p>
              <p className="mt-1 break-words text-sm text-text-muted"><time dateTime={purchase.purchaseDate?.slice(0, 10)}>{purchaseDateLabel(purchase.purchaseDate)}</time> · {ownershipLabel(purchase)}</p>
              <div className="mt-4 border-t border-border pt-4"><PurchaseWarrantySummary items={purchase.items} /></div>
              <div className="mt-auto pt-4"><span className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand-soft px-4 py-2.5 text-sm font-bold text-brand-strong group-hover:bg-brand group-hover:text-on-brand group-focus-visible:bg-brand group-focus-visible:text-on-brand" id={`purchase-${purchase.id}-action`}>Ver compra<ArrowRight aria-hidden="true" className="size-4 shrink-0" /></span></div>
            </Link>
          </li>)}
        </ul>}
      </section>}
    </div>
  );
}

export function PurchasesPage() {
  const household = useHousehold();
  if (household.isPending) return <LoadingState label="Cargando hogar" />;
  if (household.isError) return <ErrorState title="No se ha podido cargar el hogar" description={household.error?.message} onRetry={household.refetch} />;
  if (!household.currentHousehold) return <div className="space-y-6"><PageHeader title="Compras" /><EmptyState title="Necesitas un hogar" description="Crea o selecciona un hogar para guardar tus compras y garantías." icon={ShoppingBag} /></div>;
  return <PurchasesContent household={household.currentHousehold} key={household.currentHousehold.id} />;
}
