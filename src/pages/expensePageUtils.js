import { z } from 'zod';

import { eurosInputToCents } from '../features/finance/money';

export const controlClassName = [
  'min-h-12 w-full rounded-xl border border-border-strong bg-surface px-3.5 py-2.5 text-base text-text shadow-sm outline-none transition-colors',
  'focus:border-brand focus:ring-3 focus:ring-brand-soft disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-text-muted',
].join(' ');

export const moneyInputSchema = z
  .string()
  .trim()
  .min(1, 'Introduce un importe.')
  .refine((value) => {
    try {
      eurosInputToCents(value);
      return true;
    } catch {
      return false;
    }
  }, 'Introduce un importe válido con hasta dos decimales.');

export const positiveMoneyInputSchema = moneyInputSchema.refine((value) => {
  try {
    return eurosInputToCents(value) > 0;
  } catch {
    return false;
  }
}, 'El importe debe ser mayor que cero.');

export function categoriesFrom(data) {
  if (Array.isArray(data)) return data;
  return data?.categories ?? [];
}

export function peopleFrom(data) {
  if (Array.isArray(data)) return data;
  return data?.people ?? [];
}

export function todayIso() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

export function currentMonthInput() {
  return todayIso().slice(0, 7);
}

export function formatCivilDate(value) {
  if (!value) return 'Sin fecha';
  const normalized = typeof value === 'string' ? value.slice(0, 10) : '';
  const [year, month, day] = normalized.split('-').map(Number);
  if (!year || !month || !day) return 'Fecha no disponible';
  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' }).format(
    new Date(Date.UTC(year, month - 1, day)),
  );
}

export function formatMonth(year, month) {
  if (!Number.isInteger(year) || !Number.isInteger(month)) return 'Periodo desconocido';
  const label = new Intl.DateTimeFormat('es-ES', {
    month: 'long',
    timeZone: 'UTC',
    year: 'numeric',
  }).format(new Date(Date.UTC(year, month - 1, 1)));
  return label.charAt(0).toUpperCase() + label.slice(1);
}
