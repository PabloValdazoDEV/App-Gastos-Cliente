import { formatCents } from '../money';
import { planningMonthLabel } from '../planningMonth';

const labels = { RECURRING: 'Gasto periódico · previsión mensual', INVOICE: 'Previsión de facturas', VARIABLE: 'Previsión de gasto variable', ONE_TIME: 'Extraordinario del mes', PURCHASE: 'Compra o cuota del mes' };

export function PlanningBudgetDetails({ lines = [], currency }) {
  if (!lines.length) return null;
  return (
    <details className="rounded-2xl border border-border bg-surface p-5">
      <summary className="min-h-11 cursor-pointer content-center font-bold focus-visible:outline-2 focus-visible:outline-focus">Desglose de la previsión</summary>
      <p className="mt-2 text-sm leading-6 text-text-muted">Incluye la provisión mensual de los gastos periódicos, no necesariamente su recibo completo. Los extraordinarios pertenecen solo al mes seleccionado. Solo se muestran tus gastos personales y los comunes.</p>
      <ul className="mt-4 divide-y divide-border">
        {lines.map((line) => (
          <li className="flex flex-wrap items-start justify-between gap-2 py-3" key={`${line.type}:${line.id}`}>
            <div className="min-w-0"><p className="break-words font-bold">{line.name}</p><p className="text-xs text-text-muted">{line.scope === 'HOUSEHOLD' ? 'Conjunto' : 'Personal'} · {labels[line.type] ?? 'Previsión'}</p>{line.estimatedClosingMonth ? <p className="mt-1 text-xs text-amber-900">La media incluye {planningMonthLabel(line.estimatedClosingMonth)} como cierre estimado, con el gasto registrado hasta preparar esta previsión. No es un cierre definitivo.</p> : null}</div>
            <div className="ml-auto text-right"><p className="font-bold">{formatCents(line.amountCents, currency)}</p>{line.amountCents > line.baseCents ? <p className="text-xs text-text-muted">Incluye {formatCents(line.amountCents - line.baseCents, currency)} de margen</p> : null}</div>
          </li>
        ))}
      </ul>
    </details>
  );
}
