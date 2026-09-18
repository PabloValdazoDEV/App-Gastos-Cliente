import { useQuery } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { queryKeys } from '../../api/queryKeys';
import { ErrorState, LoadingState } from '../../components/ui/FeedbackStates';
import { MonthGroupedList } from '../../components/ui/MonthGroupedList';
import { FormField } from '../auth/components/FormField';
import { formatCents } from '../finance/money';
import { linkedPurchaseExpenses } from './linkedPurchaseExpenses';
import { filterPurchases, ownershipLabel, purchaseDateLabel, purchaseTitle } from './presentation';
import { addWarrantyMonths } from './purchaseFormState';
import { PurchasePaymentsPanel } from './PurchasePaymentsPanel';
import { purchasesService } from './purchasesService';

const button = 'inline-flex min-h-11 items-center justify-center rounded-xl border border-border-strong px-3 py-2 text-sm font-bold hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:opacity-60';

function LinkedExpense({ purchase, householdId, kind, currency, timezone }) {
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const id = useId();
  const detail = useQuery({ queryKey: queryKeys.purchases.detail(householdId, purchase.id), queryFn: ({ signal }) => purchasesService.detail({ householdId, purchaseId: purchase.id, signal }), enabled: expanded });
  const recurring = kind === 'RECURRING';
  const Heading = recurring ? 'h3' : 'h5';
  const financing = purchase.financing;
  const entry = !recurring && purchase.paymentMethod === 'FINANCED';
  const paidAt = entry ? financing.downPaymentPaidAt : purchase.paymentDate;
  const amount = recurring ? financing.installmentAmountCents : entry ? financing.downPaymentCents : purchase.paidAmountCents ?? purchase.totalCents;
  const progress = financing?.progress;
  const lastDate = recurring ? financing.installmentCount === 1 ? financing.firstInstallmentDate : addWarrantyMonths(financing.firstInstallmentDate, financing.installmentCount - 1) : null;
  const lastAmount = recurring ? financing.financingTotalCents - (financing.installmentCount - 1) * financing.installmentAmountCents : null;
  return <li className="min-w-0 space-y-4 rounded-2xl border border-border bg-surface p-5 shadow-card">
    <div className="flex min-w-0 flex-col justify-between gap-3 sm:flex-row">
      <div className="min-w-0"><Heading className="break-words font-extrabold">{purchaseTitle(purchase)}{entry ? ' · Entrada' : ''}</Heading><p className="mt-1 break-words text-sm text-text-muted">{ownershipLabel(purchase)} · {purchase.merchant || 'Tienda sin indicar'}</p></div>
      <div className="sm:text-right"><p className="text-xl font-extrabold tabular-nums">{formatCents(amount, currency)}{recurring ? ' / mes' : ''}</p><p className="text-sm font-semibold text-brand-strong">Margen 0 %</p></div>
    </div>
    {recurring ? <div className="space-y-2 text-sm leading-6">
      <p>{financing.installmentCount} cuotas · Del {purchaseDateLabel(financing.firstInstallmentDate)} al {purchaseDateLabel(lastDate)}. Finaliza automáticamente en la última cuota.</p>
      <p>Última cuota: {formatCents(lastAmount, currency)} · Total de cuotas: {formatCents(financing.financingTotalCents, currency)}{financing.provider ? ` · ${financing.provider}` : ''}</p>
      {progress ? <>
        <p>{progress.paidInstallmentCount} de {progress.installmentCount} cuotas pagadas · Pendiente, incluida la entrada: {formatCents(progress.pendingCents, currency)}</p>
        <p>Coste total con entrada: {formatCents(progress.totalCostCents, currency)} · Coste de financiación: {formatCents(progress.costOfFinancingCents, currency)}</p>
        <p className="font-semibold">{progress.nextInstallment ? `Primera cuota pendiente: ${purchaseDateLabel(progress.nextInstallment.dueDate)} · ${formatCents(progress.nextInstallment.expectedAmountCents, currency)}` : 'No quedan cuotas pendientes.'}</p>
      </> : null}
    </div> : <p className="text-sm">{paidAt ? `Pagado el ${purchaseDateLabel(paidAt)}` : entry ? `Entrada pendiente · ${purchaseDateLabel(purchase.purchaseDate)}` : 'Pago sin confirmar. No suma gasto utilizado hasta registrar fecha e importe.'}</p>}
    <div className="flex flex-wrap gap-2">
      <Link className={button} to={`/compras/${purchase.id}`}>Ver compra y documentos</Link>
      {recurring ? <button aria-controls={`${id}-payments`} aria-expanded={expanded} className={button} disabled={busy} onClick={() => setExpanded(!expanded)} type="button">{expanded ? 'Ocultar cuotas' : 'Ver y registrar cuotas'}</button> : <Link className={button} to={`/compras/${purchase.id}`}>Gestionar pago</Link>}
    </div>
    {expanded ? <div id={`${id}-payments`}>
      {detail.isPending ? <LoadingState label="Cargando cuotas" /> : detail.isError ? <ErrorState title="No se han podido cargar las cuotas" description={detail.error.message} onRetry={detail.refetch} /> : <PurchasePaymentsPanel currency={currency} householdId={householdId} onBusyChange={setBusy} purchase={detail.data} timezone={timezone} />}
    </div> : null}
  </li>;
}

export function PurchaseLinkedExpenses({ query, householdId, kind, currency, timezone }) {
  const [search, setSearch] = useState('');
  const titleId = useId();
  const purchases = linkedPurchaseExpenses(query.data, kind);
  if (query.isPending) return <LoadingState label="Cargando pagos de compras" />;
  if (query.isError) return <ErrorState title="No se han podido cargar los pagos de compras" description={query.error.message} onRetry={query.refetch} />;
  if (!purchases.length) return null;
  const visible = filterPurchases(purchases, { search });
  const renderPurchase = (purchase) => <LinkedExpense currency={currency} householdId={householdId} key={`${householdId}:${purchase.id}`} kind={kind} purchase={purchase} timezone={timezone} />;
  return <section aria-labelledby={titleId} className="min-w-0 space-y-4">
    <h2 className="text-xl font-extrabold" id={titleId}>{kind === 'RECURRING' ? 'Financiaciones de compras' : 'Pagos únicos y entradas de compras'}</h2>
    <p className="text-sm leading-6 text-text-muted">Añadidos automáticamente desde Compras. Comparten sus registros de pago: no los añadas de nuevo como otro gasto. Los importes mostrados son los de la compra completa; el presupuesto respeta su reparto. Sin margen de seguridad.</p>
    <FormField label="Buscar compras vinculadas" onChange={(event) => setSearch(event.target.value)} type="search" value={search} />
    {kind === 'ONE_TIME' ? <p className="text-sm text-text-muted">Agrupados por año y mes del pago, más recientes primero.</p> : null}
    {visible.length ? kind === 'ONE_TIME'
      ? <MonthGroupedList items={visible} getDate={(purchase) => purchase.paymentMethod === 'FINANCED' ? purchase.financing?.downPaymentPaidAt : purchase.paymentDate} renderItem={renderPurchase} undatedLabel="Sin fecha de pago" />
      : <ul className="space-y-3">{visible.map(renderPurchase)}</ul>
      : <p className="text-sm text-text-muted">No hay compras que coincidan con la búsqueda.</p>}
  </section>;
}
