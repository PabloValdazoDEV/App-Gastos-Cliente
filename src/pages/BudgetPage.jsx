import { useQuery } from '@tanstack/react-query';
import { Calculator, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState, LoadingState } from '../components/ui/FeedbackStates';
import { PageHeader } from '../components/ui/PageHeader';
import { financeService } from '../features/finance/financeService';
import { formatCents } from '../features/finance/money';
import { useHousehold } from '../features/households/useHousehold';
import { CategoryIconBadge } from '../features/households/categoryIcons';

const typeLabels = {
  RECURRING: 'Recurrente',
  INVOICE: 'Factura',
  VARIABLE: 'Variable',
};

export function BudgetPage() {
  const { currentHousehold, isPending: householdPending } = useHousehold();
  const householdId = currentHousehold?.id;
  const query = useQuery({
    queryKey: ['budget', householdId],
    queryFn: () => financeService.budget(householdId),
    enabled: Boolean(householdId),
  });

  if (householdPending) return <LoadingState />;
  if (!householdId) {
    return (
      <EmptyState
        action={<Link className="font-bold text-brand-strong" to="/hogar">Crear hogar</Link>}
        description="Necesitas un hogar para calcular el presupuesto."
        icon={Calculator}
        title="No hay un hogar seleccionado"
      />
    );
  }
  if (query.isPending) return <LoadingState label="Calculando presupuesto" />;
  if (query.isError) return <ErrorState description={query.error.message} onRetry={query.refetch} />;

  const budget = query.data;
  return (
    <div className="space-y-8">
      <PageHeader
        title="Presupuesto mensual estándar"
      />
      {!budget.readiness.ready ? (
        <EmptyState
          action={<Link className="font-bold text-brand-strong" to="/hogar">Revisar personas y reparto</Link>}
          description="Los porcentajes de todas las personas activas deben sumar exactamente 100 %."
          icon={Calculator}
          title="Falta completar el reparto"
        />
      ) : (
        <>
          <section className="grid gap-3 sm:grid-cols-3" aria-label="Totales del presupuesto">
            <article className="rounded-2xl border border-border bg-surface p-5">
              <p className="text-sm font-semibold text-text-muted">Gastos comunes</p>
              <p className="mt-2 text-2xl font-extrabold">{formatCents(budget.householdBudgetCents, currentHousehold.currency)}</p>
            </article>
            <article className="rounded-2xl border border-border bg-surface p-5">
              <p className="text-sm font-semibold text-text-muted">Gastos personales</p>
              <p className="mt-2 text-2xl font-extrabold">{formatCents(budget.personalBudgetCents, currentHousehold.currency)}</p>
            </article>
            <article className="rounded-2xl bg-brand-deep p-5 text-on-brand">
              <p className="text-sm font-semibold text-on-brand-muted">Total recomendado</p>
              <p className="mt-2 text-2xl font-extrabold">{formatCents(budget.recommendedBudgetCents, currentHousehold.currency)}</p>
            </article>
          </section>

          <section aria-labelledby="reparto-presupuesto">
            <h2 className="text-lg font-bold" id="reparto-presupuesto">Aportación por persona</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {budget.contributions.map((item) => (
                <article className="rounded-2xl border border-border bg-surface p-5" key={item.personId}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-bold">{item.personName}</h3>
                      <p className="mt-1 text-sm text-text-muted">{item.contributionBps / 100} % de los gastos comunes</p>
                    </div>
                    <p className="text-xl font-extrabold">{formatCents(item.totalStandardCents, currentHousehold.currency)}</p>
                  </div>
                  {item.personalExpenseCents ? (
                    <p className="mt-3 text-xs text-text-soft">Incluye {formatCents(item.personalExpenseCents, currentHousehold.currency)} de gastos personales.</p>
                  ) : null}
                </article>
              ))}
            </div>
          </section>

          <section aria-labelledby="desglose-presupuesto">
            <h2 className="text-lg font-bold" id="desglose-presupuesto">Desglose del cálculo</h2>
            {budget.lines.length ? (
              <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-surface">
                <ul className="divide-y divide-border">
                  {budget.lines.map((line) => (
                    <li className="flex flex-wrap items-center gap-3 p-4" key={`${line.type}-${line.id}`}>
                      <CategoryIconBadge category={line.category} />
                      <span className="rounded-full bg-surface-muted px-2.5 py-1 text-xs font-bold text-text-muted">{typeLabels[line.type]}</span>
                      <div className="min-w-0 flex-1">
                        <h3 className="break-words text-sm font-extrabold">{line.name || typeLabels[line.type]}</h3>
                        <p className="mt-0.5 text-xs font-semibold text-text-muted">
                          {line.scope === 'PERSONAL' ? 'Gasto personal' : 'Gasto común'}
                        </p>
                        <p className="text-xs text-text-soft">Base {formatCents(line.baseCents, currentHousehold.currency)} + margen {line.effectiveMarginBps / 100} %</p>
                      </div>
                      <p className="font-extrabold">{formatCents(line.amountCents, currentHousehold.currency)}</p>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <EmptyState
                action={<Link className="inline-flex items-center gap-1 font-bold text-brand-strong" to="/gastos">Añadir gastos <ChevronRight className="size-4" /></Link>}
                description="El presupuesto será cero hasta que registres al menos un gasto."
                icon={Calculator}
                title="No hay partidas todavía"
              />
            )}
          </section>
        </>
      )}
    </div>
  );
}
