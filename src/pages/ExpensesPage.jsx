import { CalendarRange, ChevronRight, Package, Plus, Receipt, ReceiptText, ShoppingBasket } from 'lucide-react';
import { Link } from 'react-router-dom';

import { PageHeader } from '../components/ui/PageHeader';

// Ordered by how often a household records each type. Examples, not
// definitions, are what let people pick the right one at a glance.
const expenseTypes = [
  {
    examples: 'Súper, gasolina, farmacia, comer fuera',
    hint: 'Lo que cambia cada mes. Apunta cada ticket o el total.',
    icon: ShoppingBasket,
    title: 'Variable',
    listLabel: 'Ver variables',
    to: '/gastos/variables',
  },
  {
    examples: 'Alquiler, hipoteca, Netflix, gimnasio, seguros',
    hint: 'Se repite con un importe conocido: mensual, anual…',
    icon: CalendarRange,
    title: 'Recurrente',
    listLabel: 'Ver recurrentes',
    to: '/gastos/recurrentes',
  },
  {
    examples: 'Luz, agua, gas, internet',
    hint: 'Recibos cuyo importe cambia: apunta la factura real.',
    icon: ReceiptText,
    title: 'Factura',
    listLabel: 'Ver facturas',
    to: '/facturas',
  },
  {
    examples: 'Dentista, avería del coche, un regalo',
    hint: 'Un pago que no se repite.',
    icon: Receipt,
    title: 'Puntual',
    listLabel: 'Ver puntuales',
    to: '/gastos/puntuales',
  },
  {
    examples: 'Electrodoméstico, móvil, mueble',
    hint: 'Un producto con garantía, ticket o pago a plazos.',
    icon: Package,
    title: 'Compra',
    listLabel: 'Ver compras',
    to: '/compras',
  },
];

export function ExpensesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        description="Elige el que más se parezca: los ejemplos te ayudan."
        title="¿Qué quieres apuntar?"
      />

      <ul aria-label="Tipos de gasto" className="grid gap-3 md:grid-cols-2">
        {expenseTypes.map(({ examples, hint, icon: Icon, listLabel, title, to }) => (
          <li className="min-w-0 rounded-2xl border border-border bg-surface p-4 shadow-card" key={title}>
            <div className="flex min-w-0 items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand-strong">
                <Icon aria-hidden="true" className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-bold text-text">{title}</h2>
                <p className="mt-0.5 break-words text-sm font-semibold text-text">{examples}</p>
                <p className="mt-0.5 text-sm leading-6 text-text-muted">{hint}</p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                aria-label={`Añadir ${title.toLowerCase()}`}
                className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand px-4 text-sm font-bold text-on-brand hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                to={`${to}?nuevo=1`}
              >
                <Plus aria-hidden="true" className="size-4" />Añadir
              </Link>
              <Link
                className="inline-flex min-h-11 items-center justify-center gap-1 rounded-xl border border-border-strong px-4 text-sm font-bold text-brand-strong hover:bg-brand-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                to={to}
              >
                {listLabel}<ChevronRight aria-hidden="true" className="size-4" />
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
