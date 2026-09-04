import {
  CalendarDays,
  ChartNoAxesCombined,
  CircleEllipsis,
  House,
  ReceiptText,
} from 'lucide-react';

export const primaryNavigation = Object.freeze([
  {
    label: 'Inicio',
    to: '/dashboard',
    icon: House,
    end: true,
    relatedPaths: ['/presupuesto'],
  },
  {
    label: 'Gastos',
    to: '/gastos',
    icon: ReceiptText,
    relatedPaths: ['/facturas'],
  },
  { label: 'Calendario', to: '/calendario', icon: CalendarDays },
  {
    label: 'Planificación',
    to: '/planificacion',
    icon: ChartNoAxesCombined,
    relatedPaths: ['/simulador'],
  },
  {
    label: 'Más',
    to: '/mas',
    icon: CircleEllipsis,
    relatedPaths: ['/ajustes', '/hogar', '/notificaciones', '/cuentas'],
  },
]);
