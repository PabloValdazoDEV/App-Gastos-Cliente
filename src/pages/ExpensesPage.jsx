import { CalendarRange, Receipt, ReceiptText, ShoppingBasket } from 'lucide-react';
import { Link } from 'react-router-dom';

import { PageHeader } from '../components/ui/PageHeader';

const expenseTypes = [
  {
    description: 'Pagos mensuales o periódicos con una cantidad prevista.',
    icon: CalendarRange,
    title: 'Recurrentes',
    to: '/gastos/recurrentes',
  },
  {
    description: 'Importes reales que ayudan a calcular una media fiable.',
    icon: ReceiptText,
    title: 'Facturas',
    to: '/facturas',
  },
  {
    description: 'Compras o totales mensuales que cambian cada periodo.',
    icon: ShoppingBasket,
    title: 'Variables',
    to: '/gastos/variables',
  },
  {
    description: 'Compras o pagos excepcionales que solo ocurren una vez.',
    icon: Receipt,
    title: 'Puntuales',
    to: '/gastos/puntuales',
  },
];

export function ExpensesPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Gastos"
      />

      <section aria-labelledby="tipos-gasto" id="tipos-de-gasto">
        <h2 className="text-lg font-bold text-text" id="tipos-gasto">
          Datos que necesitarás
        </h2>
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {expenseTypes.map(({ description, icon: Icon, title, to }) => (
            <Link
              className="min-w-0 rounded-2xl border border-border bg-surface p-3 shadow-card transition-colors hover:border-border-strong hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus sm:p-5"
              key={title}
              to={to}
            >
              <span className="grid size-10 place-items-center rounded-xl bg-brand-soft text-brand-strong">
                <Icon aria-hidden="true" className="size-5" />
              </span>
              <h3 className="mt-2 break-words text-base font-bold text-text sm:mt-4">{title}</h3>
              <p className="mt-2 hidden text-sm leading-6 text-text-muted sm:block">
                {description}
              </p>
              <span className="mt-5 hidden min-h-11 items-center text-sm font-bold text-brand-strong sm:inline-flex">Abrir {title.toLowerCase()}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
