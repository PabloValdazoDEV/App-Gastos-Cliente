import { z } from 'zod';

import { todayIso } from '../../pages/expensePageUtils';
import { eurosInputToCents, isoDate } from '../finance/money';
import { purchasePaymentDefaults, purchasePaymentFormShape, purchasePaymentPayload, validatePurchasePaymentForm } from './purchasePaymentForm';

export const MAX_PURCHASE_ITEMS = 50;
const MAX_CENTS = 2_147_483_647;
const optionalText = (length) => z.string().trim().max(length, `Usa como máximo ${length} caracteres.`);
const amountInput = z.string().trim().refine((value) => {
  try {
    const cents = eurosInputToCents(value);
    return Number.isSafeInteger(cents) && cents >= 0 && cents <= MAX_CENTS;
  } catch {
    return false;
  }
}, 'Introduce un importe entre 0 y 21.474.836,47 con hasta dos decimales.');
const optionalAmountInput = z.union([z.literal(''), amountInput]);
const integerInput = (min, max, message) => z.string().trim().refine(
  (value) => /^\d+$/.test(value) && Number(value) >= min && Number(value) <= max,
  message,
);

export function addWarrantyMonths(purchaseDate, durationMonths) {
  if (!z.iso.date().safeParse(purchaseDate).success || !Number.isInteger(durationMonths) || durationMonths < 1 || durationMonths > 1200) return null;
  const [year, month, day] = purchaseDate.split('-').map(Number);
  const target = new Date(0);
  target.setUTCFullYear(year, month - 1 + durationMonths, 1);
  const last = new Date(target);
  last.setUTCMonth(last.getUTCMonth() + 1, 0);
  target.setUTCDate(Math.min(day, last.getUTCDate()));
  if (target.getUTCFullYear() > 9999) return null;
  return target.toISOString().slice(0, 10);
}

export function formatWarrantyPreview(date) {
  if (!date) return '';
  return new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00.000Z`));
}

export const purchaseItemFormSchema = z.object({
  name: z.string().trim().min(1, 'Escribe el nombre del producto.').max(200, 'Usa como máximo 200 caracteres.'),
  brand: optionalText(120),
  model: optionalText(120),
  quantity: integerInput(1, 10_000, 'Introduce una cantidad entera entre 1 y 10.000.'),
  price: optionalAmountInput,
  serialNumber: optionalText(100),
  imei: optionalText(100),
  notes: optionalText(2_000),
  warrantyEnabled: z.boolean(),
  warrantyMethod: z.enum(['DURATION', 'EXPLICIT_DATE']),
  warrantyDuration: z.string(),
  warrantyUnit: z.enum(['MONTHS', 'YEARS']),
  warrantyEndsAt: z.string(),
}).superRefine((values, context) => {
  if (!values.warrantyEnabled) return;
  if (values.warrantyMethod === 'EXPLICIT_DATE') {
    if (!z.iso.date().safeParse(values.warrantyEndsAt).success) {
      context.addIssue({ code: 'custom', path: ['warrantyEndsAt'], message: 'Indica una fecha fin de garantía válida.' });
    }
    return;
  }
  const multiplier = values.warrantyUnit === 'YEARS' ? 12 : 1;
  const duration = Number(values.warrantyDuration) * multiplier;
  if (!/^\d+$/.test(values.warrantyDuration.trim()) || !Number.isInteger(duration) || duration < 1 || duration > 1200) {
    context.addIssue({ code: 'custom', path: ['warrantyDuration'], message: 'Introduce una duración entera de 1 a 1200 meses o de 1 a 100 años.' });
  }
});

export function purchaseFormSchema({ editing = false, initialPurchase = null, timezone } = {}) {
  return z.object({
    merchant: optionalText(200),
    purchaseDate: z.iso.date({ error: 'Indica una fecha de compra válida.' }),
    total: amountInput,
    notes: optionalText(2_000),
    ownershipType: z.enum(['HOUSEHOLD', 'PERSONAL', 'SPLIT']),
    personalPersonId: z.string(),
    shares: z.array(z.object({ householdPersonId: z.string(), percentage: z.string() })),
    ...purchasePaymentFormShape,
    ...(editing ? {} : { items: z.array(purchaseItemFormSchema).min(1, 'Añade al menos un producto.').max(MAX_PURCHASE_ITEMS, 'Puedes guardar hasta 50 productos por compra.') }),
  }).superRefine((values, context) => {
    validatePurchasePaymentForm(values, context, { initialPurchase, timezone });
    if (values.ownershipType === 'PERSONAL' && !values.personalPersonId) {
      context.addIssue({ code: 'custom', path: ['personalPersonId'], message: 'Selecciona a quién pertenece la compra.' });
    }
    if (values.ownershipType !== 'SPLIT') return;
    if (values.shares.length < 2) {
      context.addIssue({ code: 'custom', path: ['shares', 'root'], message: 'Selecciona al menos dos personas.' });
    }
    const people = new Set();
    values.shares.forEach((share, index) => {
      if (!share.householdPersonId || people.has(share.householdPersonId)) {
        context.addIssue({ code: 'custom', path: ['shares', index, 'householdPersonId'], message: share.householdPersonId ? 'Esta persona ya participa en el reparto.' : 'Selecciona una persona.' });
      }
      people.add(share.householdPersonId);
      const bps = percentageToBps(share.percentage);
      if (bps === null || bps <= 0 || bps > 10_000) {
        context.addIssue({ code: 'custom', path: ['shares', index, 'percentage'], message: 'Introduce un porcentaje mayor que 0 y hasta 100, con hasta dos decimales.' });
      }
    });
    const total = splitTotalBps(values.shares);
    if (total !== 10_000) context.addIssue({ code: 'custom', path: ['shares', 'root'], message: 'El reparto debe sumar exactamente 100 %.' });
  });
}

export function percentageToBps(value) {
  try {
    const bps = eurosInputToCents(value);
    return Number.isSafeInteger(bps) ? bps : null;
  } catch {
    return null;
  }
}

export function splitTotalBps(shares) {
  const values = shares.map((share) => percentageToBps(share.percentage));
  return values.some((value) => value === null) ? null : values.reduce((sum, value) => sum + value, 0);
}

export function isValidSplit(shares) {
  return shares.length >= 2 && splitTotalBps(shares) === 10_000 &&
    shares.every((share) => share.householdPersonId && percentageToBps(share.percentage) > 0) &&
    new Set(shares.map((share) => share.householdPersonId)).size === shares.length;
}

export function purchaseItemDefaults(item = null) {
  const duration = item?.warrantyDurationMonths;
  const years = Number.isInteger(duration) && duration > 0 && duration % 12 === 0;
  return {
    name: item?.name ?? '', brand: item?.brand ?? '', model: item?.model ?? '',
    quantity: String(item?.quantity ?? 1), price: item?.priceCents == null ? '' : (item.priceCents / 100).toFixed(2),
    serialNumber: item?.serialNumber ?? '', imei: item?.imei ?? '', notes: item?.notes ?? '',
    warrantyEnabled: Boolean(item?.warrantyEndsAt || duration),
    warrantyMethod: item?.warrantySource === 'DURATION' ? 'DURATION' : item?.warrantyEndsAt ? 'EXPLICIT_DATE' : 'DURATION',
    warrantyDuration: duration ? String(years ? duration / 12 : duration) : '',
    warrantyUnit: years ? 'YEARS' : 'MONTHS', warrantyEndsAt: isoDate(item?.warrantyEndsAt),
  };
}

export function purchaseDefaults(purchase = null) {
  return {
    ...purchasePaymentDefaults(purchase),
    merchant: purchase?.merchant ?? '', purchaseDate: isoDate(purchase?.purchaseDate) || todayIso(),
    total: purchase ? (purchase.totalCents / 100).toFixed(2) : '', notes: purchase?.notes ?? '',
    ownershipType: purchase?.ownershipType ?? 'HOUSEHOLD', personalPersonId: purchase?.personalPersonId ?? '',
    shares: purchase?.shares?.length ? purchase.shares.map((share) => ({ householdPersonId: share.householdPersonId, percentage: String(share.shareBps / 100) })) : [
      { householdPersonId: '', percentage: '' }, { householdPersonId: '', percentage: '' },
    ],
    items: purchase?.items?.map(purchaseItemDefaults) ?? [purchaseItemDefaults()],
  };
}

export function purchaseItemPayload(values) {
  return {
    name: values.name.trim(), brand: values.brand.trim() || null, model: values.model.trim() || null,
    quantity: Number(values.quantity), priceCents: values.price.trim() ? eurosInputToCents(values.price) : null,
    serialNumber: values.serialNumber.trim() || null, imei: values.imei.trim() || null, notes: values.notes.trim() || null,
    warrantyEndsAt: values.warrantyEnabled && values.warrantyMethod === 'EXPLICIT_DATE' ? values.warrantyEndsAt : null,
    warrantyDurationMonths: values.warrantyEnabled && values.warrantyMethod === 'DURATION' ? Number(values.warrantyDuration) * (values.warrantyUnit === 'YEARS' ? 12 : 1) : null,
  };
}

export function purchasePayload(values, { editing = false, initialPurchase = null } = {}) {
  return {
    ...purchasePaymentPayload(values, { editing, initialPurchase }),
    merchant: values.merchant.trim() || null, purchaseDate: values.purchaseDate,
    totalCents: eurosInputToCents(values.total), notes: values.notes.trim() || null,
    ownershipType: values.ownershipType,
    personalPersonId: values.ownershipType === 'PERSONAL' ? values.personalPersonId : null,
    shares: values.ownershipType === 'SPLIT' ? values.shares.map((share) => ({ householdPersonId: share.householdPersonId, shareBps: percentageToBps(share.percentage) })) : [],
    ...(editing ? {} : { items: values.items.map(purchaseItemPayload) }),
  };
}

export function focusPurchaseFormError(form) {
  if (!form) return;
  const invalid = form.querySelector('[aria-invalid="true"]');
  if (!invalid) return;
  // Invalid optional data can live inside the deliberately collapsed details.
  for (let parent = invalid.parentElement; parent && parent !== form; parent = parent.parentElement) {
    if (parent.tagName === 'DETAILS') parent.open = true;
  }
  invalid.focus();
}
