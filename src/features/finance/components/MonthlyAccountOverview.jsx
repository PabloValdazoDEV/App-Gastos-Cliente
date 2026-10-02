import { Link } from 'react-router-dom';

import { formatCents } from '../money';

const types = [
  ['RECURRING', 'Gastos recurrentes'], ['INVOICE', 'Facturas'],
  ['VARIABLE', 'Gastos variables'], ['ONE_TIME', 'Gastos puntuales'], ['PURCHASE', 'Pagos de compras'],
];
const statusLabel = { PAID: 'Pago confirmado', UNCONFIRMED: 'Pago pendiente de confirmar', ESTIMATED: 'Previsión, no es un recibo' };
const summaryClass = 'min-h-11 cursor-pointer content-center py-2 text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus';

function AmountRow({ label, cents, currency, strong = false }) {
  return <div className={`flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 ${strong ? 'font-bold' : ''}`}>
    <dt className="min-w-0">{label}</dt>
    <dd className="ml-auto break-words text-right tabular-nums">{formatCents(cents, currency)}</dd>
  </div>;
}

function ExpenseBreakdown({ lines, currency }) {
  if (!lines.length) return <p className="py-3 text-sm text-text-muted">No hay gastos ni estimaciones para este mes. Esto no garantiza que no vaya a haber pagos.</p>;
  return <div className="divide-y divide-border">
    {types.map(([type, label]) => {
      const group = lines.filter((line) => line.type === type);
      if (!group.length) return null;
      return <details key={type}>
        <summary className={summaryClass}>
          <span>{label}</span><span className="ml-2 inline-block tabular-nums">{formatCents(group.reduce((sum, line) => sum + line.amountCents, 0), currency)}</span>
        </summary>
        <ul className="space-y-3 pb-4">
          {group.map((line) => <li className="min-w-0 rounded-xl bg-surface-muted p-3 text-sm" key={line.id}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <span className="min-w-0 break-words font-semibold">{line.name}{line.status === 'ESTIMATED' ? ' · previsión restante' : ''}</span>
              <span className="ml-auto shrink-0 font-bold tabular-nums">{formatCents(line.amountCents, currency)}</span>
            </div>
            <p className="mt-1 text-xs font-semibold text-text-muted">{statusLabel[line.status]}{line.date && line.datePrecision !== 'MONTH' ? ` · ${new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${line.date}T00:00:00Z`))}` : ''}</p>
            {line.status === 'ESTIMATED' ? <p className="mt-2 text-xs leading-5 text-text-muted">
              {line.type === 'INVOICE' ? 'Estimación mensual según el historial; el importe y la fecha del próximo recibo pueden ser distintos. ' : 'Previsión según la media de meses anteriores. '}
              {formatCents(line.basisTotalCents, currency)} previstos{line.allowanceCents > 0 ? ` (incluyen ${formatCents(line.allowanceCents, currency)} de colchón configurado)` : ''} − {formatCents(line.recordedCents, currency)} registrados = {formatCents(line.amountCents, currency)} por prever.
            </p> : null}
          </li>)}
        </ul>
      </details>;
    })}
  </div>;
}

export function MonthlyAccountOverview({ overview, currency, scope, title, forecastReady = true }) {
  const personal = scope === 'personal';
  const hasBalance = Number.isSafeInteger(overview.balanceCents);
  const negative = overview.projectedBalanceCents < 0;
  return <section aria-labelledby={`${scope}-overview-heading`} className="min-w-0 overflow-hidden rounded-2xl border border-border bg-surface">
    <div className="bg-brand-soft p-5">
      <h2 className="text-lg font-bold" id={`${scope}-overview-heading`}>{title}</h2>
      <p className="mt-3 text-sm text-text-muted">Saldo que has anotado</p>
      <p className="mt-1 break-words text-3xl font-extrabold tracking-tight tabular-nums">{hasBalance ? formatCents(overview.balanceCents, currency) : 'Sin saldo registrado'}</p>
      <p className="mt-2 text-xs leading-5 text-text-muted">{!hasBalance ? 'Falta anotar un saldo actual en Cuentas.' : overview.balanceSource === 'HOUSEHOLD' ? 'Usamos el saldo conjunto guardado en el hogar.' : personal ? 'Suma de tus cuentas personales activas. No incluye la cuenta conjunta.' : 'Suma de las cuentas conjuntas activas.'}</p>
    </div>
    <div className="space-y-4 p-5">
      <div>
        <h3 className="font-bold">{personal ? 'Tus gastos de este mes' : 'Gastos comunes de este mes'}</h3>
        <dl className="mt-3 space-y-2 text-sm">
          <AmountRow label={forecastReady ? 'Previsto gastar en total' : 'Gastos conocidos (previsión incompleta)'} cents={overview.expectedCents} currency={currency} strong />
          <AmountRow label="Ya confirmado como pagado" cents={overview.paidCents} currency={currency} />
          {overview.unconfirmedCents > 0 ? <AmountRow label="Gastos registrados sin pago confirmado" cents={overview.unconfirmedCents} currency={currency} strong /> : null}
          {overview.estimatedCents > 0 ? <AmountRow label="Previsión aún sin registrar (no es un pago del calendario)" cents={overview.estimatedCents} currency={currency} strong /> : null}
        </dl>
        {overview.unconfirmedCents > 0 ? <p className="mt-3 text-xs leading-5 text-text-muted">Si ya pagaste alguno, confírmalo en Calendario para quitarlo de esta cifra.</p> : null}
        {overview.estimatedCents > 0 ? <p className="mt-2 text-xs leading-5 text-text-muted">Es una estimación de gastos variables o facturas todavía no registrados: no corresponde a un gasto concreto que puedas marcar en el calendario.</p> : null}
        {overview.unconfirmedCents === 0 && overview.estimatedCents === 0 ? <p className="mt-3 text-xs leading-5 text-text-muted">No hay gastos pendientes de pago ni estimaciones sin registrar.</p> : null}
      </div>
      <div className="border-t border-border pt-4">
        {!forecastReady ? <p className="text-sm leading-6 text-text-muted">Completa el reparto del hogar antes de estimar cuánto quedaría después de los gastos.</p> : hasBalance ? <>
          <p className="text-sm font-semibold">{negative ? 'Si se cumple la previsión, faltarían' : 'Si se cumple la previsión, quedarían'}</p>
          <p className={`mt-1 break-words text-2xl font-extrabold tabular-nums ${negative ? 'text-red-700' : 'text-brand-strong'}`}>{formatCents(Math.abs(overview.projectedBalanceCents), currency)}</p>
          <p className="mt-2 text-xs leading-5 text-text-muted">Solo si el saldo está al día y se cumple la previsión. {personal ? 'No descuenta tu aportación a la cuenta conjunta ni reservas para otros meses.' : 'No es dinero libre: puede estar reservado para otros meses. No incluye atrasos de meses anteriores.'}</p>
        </> : <p className="text-sm leading-6 text-text-muted">Anota tu saldo en Cuentas para ver si cubre lo pendiente. No usamos un saldo antiguo de Planificación como si fuera el actual.</p>}
      </div>
      <details className="border-t border-border pt-1">
        <summary className={summaryClass}>Ver de dónde sale cada importe</summary>
        {hasBalance && forecastReady ? <p className="mb-3 rounded-xl bg-surface-muted p-3 text-sm leading-6">Saldo anotado {formatCents(overview.balanceCents, currency)} − gastos registrados sin confirmar {formatCents(overview.unconfirmedCents, currency)} − previsión aún sin registrar {formatCents(overview.estimatedCents, currency)} = {formatCents(overview.projectedBalanceCents, currency)}. Los pagos ya confirmados no se restan otra vez.</p> : null}
        <ExpenseBreakdown lines={overview.lines} currency={currency} />
        <p className="mt-3 text-xs leading-5 text-text-muted">Sumamos los gastos que corresponden a este mes. Un pago anual cuenta entero cuando vence; el ahorro mensual para prepararlo está en Planificación. Una factura registrada sustituye su estimación.</p>
      </details>
      <Link className="inline-flex min-h-11 items-center text-sm font-bold text-brand-strong underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" to="/calendario">Revisar gastos y confirmar pagos</Link>
    </div>
  </section>;
}
