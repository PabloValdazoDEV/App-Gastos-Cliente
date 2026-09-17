import { z } from 'zod';

import { todayIso } from '../../pages/expensePageUtils';
import { eurosInputToCents, isoDate } from '../finance/money';

export function purchasePaymentToday(timezone) {
  if (!timezone) return todayIso();
  try {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
    const part = (type) => parts.find((entry) => entry.type === type)?.value;
    return `${part('year')}-${part('month')}-${part('day')}`;
  } catch { return todayIso(); }
}

export function purchaseInstallmentFormSchema(today) {
  return z.object({
    amount: z.string().trim().refine((value) => {
      try {
        const cents = eurosInputToCents(value);
        return Number.isSafeInteger(cents) && cents > 0 && cents <= 2_147_483_647;
      } catch { return false; }
    }, 'Introduce un importe mayor que cero, con hasta dos decimales y como máximo 21.474.836,47.'),
    paidAt: z.iso.date({ error: 'Indica una fecha de pago válida.' })
      .refine((value) => value <= today, 'La fecha de un pago realizado no puede estar en el futuro.'),
    notes: z.string().trim().max(2000, 'Usa como máximo 2000 caracteres.'),
  });
}

export function purchaseInstallmentDefaults(installment, today) {
  return {
    amount: ((installment.actualAmountCents ?? installment.expectedAmountCents) / 100).toFixed(2),
    paidAt: isoDate(installment.paidAt) || today,
    notes: installment.notes ?? '',
  };
}

export function purchaseInstallmentPayload(values) {
  return { actualAmountCents: eurosInputToCents(values.amount), paidAt: values.paidAt, notes: values.notes.trim() || null };
}
