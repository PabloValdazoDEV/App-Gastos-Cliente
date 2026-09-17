import { z } from 'zod';

import { todayIso } from '../../pages/expensePageUtils';
import { eurosInputToCents, isoDate } from '../finance/money';
import { purchasePaymentToday } from './purchaseInstallmentFormState';

export const MAX_PURCHASE_INSTALLMENTS = 1200;
const MAX_CENTS = 2_147_483_647;

export const purchasePaymentFormShape = {
  paymentMethod: z.enum(['UPFRONT', 'FINANCED']),
  upfrontPaid: z.boolean(),
  paymentDate: z.string(),
  paidAmount: z.string(),
  financingProvider: z.string(),
  downPayment: z.string(),
  downPaymentPaid: z.boolean(),
  downPaymentPaidAt: z.string(),
  installmentCount: z.string(),
  installmentAmount: z.string(),
  firstInstallmentDate: z.string(),
  financingTotal: z.string(),
};

export function paymentAmountCents(value) {
  try {
    const amount = eurosInputToCents(value);
    return Number.isSafeInteger(amount) && amount >= 0 && amount <= MAX_CENTS ? amount : null;
  } catch { return null; }
}

const inputAmount = (value) => Number.isSafeInteger(value) ? (value / 100).toFixed(2) : '';

export function hasRecordedFinancingPayments(purchase) {
  return Boolean(purchase?.financing?.installments?.some((installment) => installment.status === 'PAID') || purchase?.financing?.progress?.paidInstallmentCount > 0);
}

export function purchasePaymentDefaults(purchase = null) {
  const financing = purchase?.financing;
  return {
    paymentMethod: purchase?.paymentMethod ?? 'UPFRONT',
    upfrontPaid: !purchase || purchase.paymentMethod === 'FINANCED' || Boolean(purchase.paymentDate && purchase.paidAmountCents != null),
    paymentDate: isoDate(purchase?.paymentDate) || isoDate(purchase?.purchaseDate) || todayIso(),
    paidAmount: inputAmount(purchase?.paidAmountCents),
    financingProvider: financing?.provider ?? '',
    downPayment: inputAmount(financing?.downPaymentCents ?? 0),
    downPaymentPaid: Boolean(financing?.downPaymentPaidAt),
    downPaymentPaidAt: isoDate(financing?.downPaymentPaidAt) || isoDate(purchase?.purchaseDate) || todayIso(),
    installmentCount: financing ? String(financing.installmentCount) : '',
    installmentAmount: inputAmount(financing?.installmentAmountCents),
    firstInstallmentDate: isoDate(financing?.firstInstallmentDate),
    financingTotal: inputAmount(financing?.financingTotalCents),
  };
}

export function financingPreview(values) {
  const priceCents = paymentAmountCents(values.total);
  const downPaymentCents = paymentAmountCents(values.downPayment);
  const financingTotalCents = paymentAmountCents(values.financingTotal);
  const installmentAmountCents = paymentAmountCents(values.installmentAmount);
  const installmentCount = /^\d+$/.test(values.installmentCount ?? '') ? Number(values.installmentCount) : null;
  const financedPrincipalCents = priceCents !== null && downPaymentCents !== null ? priceCents - downPaymentCents : null;
  const totalCostCents = downPaymentCents !== null && financingTotalCents !== null ? downPaymentCents + financingTotalCents : null;
  const financingCostCents = totalCostCents !== null && priceCents !== null ? totalCostCents - priceCents : null;
  const lastInstallmentCents = installmentCount > 0 && financingTotalCents !== null && installmentAmountCents !== null
    ? financingTotalCents - installmentAmountCents * (installmentCount - 1) : null;
  return { priceCents, downPaymentCents, financedPrincipalCents, financingTotalCents, totalCostCents, financingCostCents, installmentCount, installmentAmountCents, lastInstallmentCents };
}

export function validatePurchasePaymentForm(values, context, { initialPurchase = null, timezone } = {}) {
  const issue = (field, message) => context.addIssue({ code: 'custom', path: [field], message });
  const today = purchasePaymentToday(timezone);
  const amount = (field, { positive = false } = {}) => {
    const cents = paymentAmountCents(values[field]);
    if (cents === null || (positive && cents === 0)) issue(field, positive ? 'Introduce un importe mayor que cero, con hasta dos decimales.' : 'Introduce un importe válido, no negativo y con hasta dos decimales.');
    return cents;
  };
  if (hasRecordedFinancingPayments(initialPurchase) && (values.paymentMethod !== 'FINANCED' || values.total !== inputAmount(initialPurchase.totalCents))) {
    if (values.paymentMethod !== 'FINANCED') issue('paymentMethod', 'Ya existen cuotas registradas como pagadas. Conserva la forma de pago para proteger su historial.');
    else if (paymentAmountCents(values.total) !== initialPurchase.totalCents) issue('total', 'Ya existen cuotas registradas como pagadas. No se puede cambiar el precio de esta financiación.');
  }
  if (values.paymentMethod === 'UPFRONT') {
    if (!values.upfrontPaid) return;
    if (!z.iso.date().safeParse(values.paymentDate).success) issue('paymentDate', 'Indica una fecha de pago válida.');
    else if (values.paymentDate > today) issue('paymentDate', 'La fecha de un pago realizado no puede estar en el futuro.');
    if (paymentAmountCents(values.paidAmount) === null) issue('paidAmount', 'Introduce un importe pagado válido, con hasta dos decimales.');
    return;
  }
  if (values.financingProvider.trim().length > 200) issue('financingProvider', 'Usa como máximo 200 caracteres.');
  const down = amount('downPayment');
  const usual = amount('installmentAmount', { positive: true });
  const total = amount('financingTotal', { positive: true });
  const price = paymentAmountCents(values.total);
  const count = Number(values.installmentCount);
  const countValid = /^\d+$/.test(values.installmentCount.trim()) && count >= 1 && count <= MAX_PURCHASE_INSTALLMENTS;
  if (!countValid) issue('installmentCount', `Introduce un número entero entre 1 y ${MAX_PURCHASE_INSTALLMENTS}.`);
  if (!z.iso.date().safeParse(values.firstInstallmentDate).success) issue('firstInstallmentDate', 'Indica una fecha válida para la primera cuota.');
  else if (countValid) {
    const [year, month] = values.firstInstallmentDate.split('-').map(Number);
    if (year + Math.floor((month - 1 + count - 1) / 12) > 9999) issue('firstInstallmentDate', 'El calendario de cuotas debe terminar antes del año 10000.');
  }
  if (down !== null && price !== null && down > price) issue('downPayment', 'La entrada no puede superar el precio de compra.');
  if (down !== null && price !== null && total !== null && total < price - down) issue('financingTotal', 'El total de cuotas no puede ser menor que el principal financiado.');
  if (countValid && usual > 0 && total > 0) {
    const last = total - usual * (count - 1);
    if (last <= 0 || last > MAX_CENTS) issue('financingTotal', 'Estos importes dejan una última cuota no válida. Revisa el número de cuotas, el importe habitual y el total.');
  }
  if (values.downPaymentPaid && down > 0) {
    if (!z.iso.date().safeParse(values.downPaymentPaidAt).success) issue('downPaymentPaidAt', 'Indica una fecha válida para el pago de la entrada.');
    else if (values.downPaymentPaidAt > today) issue('downPaymentPaidAt', 'La fecha de un pago realizado no puede estar en el futuro.');
  }
  if (hasRecordedFinancingPayments(initialPurchase)) {
    const financing = initialPurchase.financing;
    for (const [field, current, expected] of [
      ['downPayment', down, financing.downPaymentCents],
      ['installmentCount', count, financing.installmentCount],
      ['installmentAmount', usual, financing.installmentAmountCents],
      ['financingTotal', total, financing.financingTotalCents],
      ['firstInstallmentDate', values.firstInstallmentDate, isoDate(financing.firstInstallmentDate)],
    ]) {
      if (current !== expected) issue(field, 'Ya existen cuotas registradas como pagadas. No se puede regenerar su calendario.');
    }
  }
}

export function purchasePaymentPayload(values, { initialPurchase = null, editing = false } = {}) {
  if (values.paymentMethod === 'UPFRONT') {
    const paymentDate = values.upfrontPaid ? values.paymentDate || values.purchaseDate : null;
    const paidAmountCents = values.upfrontPaid ? eurosInputToCents(values.paidAmount || values.total) : null;
    if (editing && (initialPurchase?.paymentMethod ?? 'UPFRONT') === 'UPFRONT' && (isoDate(initialPurchase?.paymentDate) || null) === paymentDate && (initialPurchase?.paidAmountCents ?? null) === paidAmountCents) return {};
    return { paymentMethod: 'UPFRONT', paymentDate, paidAmountCents };
  }
  const financing = {
    provider: values.financingProvider.trim() || null,
    downPaymentCents: eurosInputToCents(values.downPayment),
    downPaymentPaidAt: values.downPaymentPaid && eurosInputToCents(values.downPayment) > 0 ? values.downPaymentPaidAt || values.purchaseDate : null,
    installmentCount: Number(values.installmentCount),
    installmentAmountCents: eurosInputToCents(values.installmentAmount),
    firstInstallmentDate: values.firstInstallmentDate,
    financingTotalCents: eurosInputToCents(values.financingTotal),
  };
  if (editing && initialPurchase?.paymentMethod === 'FINANCED' && initialPurchase.financing) {
    const previous = initialPurchase.financing;
    const changes = Object.fromEntries(Object.entries(financing).filter(([key, value]) => value !== (['firstInstallmentDate', 'downPaymentPaidAt'].includes(key) ? isoDate(previous[key]) || null : previous[key] ?? null)));
    // An amount correction resets an existing entry payment on the server unless
    // its date is explicitly supplied. Preserve the checked/date form intent;
    // PurchaseForm still requires confirmation before sending this correction.
    if (financing.downPaymentCents !== previous.downPaymentCents && financing.downPaymentPaidAt) changes.downPaymentPaidAt = financing.downPaymentPaidAt;
    return Object.keys(changes).length ? { financing: changes } : {};
  }
  return { paymentMethod: 'FINANCED', financing };
}

export function purchasePaymentNeedsReset(values, purchase) {
  if (!purchase) return false;
  if (purchase.paymentMethod === 'FINANCED' && purchase.financing?.downPaymentPaidAt) {
    return values.paymentMethod !== 'FINANCED' || !values.downPaymentPaid || paymentAmountCents(values.downPayment) !== purchase.financing.downPaymentCents;
  }
  return Boolean(purchase.paymentDate && purchase.paidAmountCents != null && (values.paymentMethod !== 'UPFRONT' || !values.upfrontPaid));
}
