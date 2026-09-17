import {
  Bell,
  ChevronRight,
  Settings,
  ShoppingBag,
  SlidersHorizontal,
  UsersRound,
  WalletCards,
} from 'lucide-react';
import { Link } from 'react-router-dom';

import { PageHeader } from '../components/ui/PageHeader';

const secondarySections = [
  {
    description: 'Tus compras importantes, productos y garantías.',
    icon: ShoppingBag,
    title: 'Compras',
    to: '/compras',
  },
  {
    description: 'Saldo de la cuenta conjunta y de las cuentas personales.',
    icon: WalletCards,
    title: 'Cuentas y saldos',
    to: '/cuentas',
  },
  {
    description: 'Personas, reparto y permisos de acceso.',
    icon: UsersRound,
    title: 'Hogar',
    to: '/hogar',
  },
  {
    description: 'Avisos sobre pagos y recordatorios importantes.',
    icon: Bell,
    title: 'Notificaciones',
    to: '/notificaciones',
  },
  {
    description: 'Margen de seguridad y preferencias del presupuesto.',
    icon: SlidersHorizontal,
    title: 'Preferencias',
    to: '/ajustes',
  },
  {
    description: 'Cuenta, accesibilidad y configuración general.',
    icon: Settings,
    title: 'Cuenta y sesiones',
    to: '/mas/sesiones',
  },
];

export function MorePage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Más opciones"
      />

      <section aria-label="Opciones secundarias" className="grid gap-3 sm:grid-cols-2">
        {secondarySections.map(({ description, icon: Icon, title, to }) => {
          const content = (
            <>
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-muted text-text-muted">
              <Icon aria-hidden="true" className="size-5" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-bold text-text">{title}</h2>
              </div>
              <p className="mt-1 text-sm leading-6 text-text-muted">
                {description}
              </p>
            </div>
            <ChevronRight aria-hidden="true" className="ml-auto size-5 shrink-0 text-text-soft" />
            </>
          );

          return (
            <Link
              className="flex min-h-24 items-start gap-4 rounded-2xl border border-border bg-surface p-5 shadow-card transition-colors hover:border-border-strong hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              key={title}
              to={to}
            >
              {content}
            </Link>
          );
        })}
      </section>
    </div>
  );
}
