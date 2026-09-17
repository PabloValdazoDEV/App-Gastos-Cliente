import { z } from 'zod';

import { eurosInputToCents, isoDate } from '../finance/money';
import { hasRecordedFinancingPayments } from './purchasePaymentForm';
import { MAX_PURCHASE_ITEMS } from './purchaseFormState';

export const ANALYSIS_MIMES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
export const analysisDocumentSupported = (document) => ANALYSIS_MIMES.includes(document.contentType);
export const analysisTotalProtected = (purchase) => hasRecordedFinancingPayments(purchase);
const inputCents = (value) => Number.isSafeInteger(value) ? (value / 100).toFixed(2) : '';
const optionalText = (max) => z.string().trim().max(max, `Usa como máximo ${max} caracteres.`);

export function analysisMoney(value) {
  if (!String(value).trim()) return null;
  // Accept ordinary comma/dot decimals and unambiguous Spanish grouping.
  const text = /^\d{1,3}(?:\.\d{3})+,\d{1,2}$/.test(value.trim()) ? value.replaceAll('.', '') : value;
  try {
    const cents = eurosInputToCents(text);
    return Number.isSafeInteger(cents) && cents >= 0 && cents <= 2_147_483_647 ? cents : NaN;
  } catch { return NaN; }
}

export function analysisItemDefaults(item = {}) {
  return {
    name: item.name ?? '', quantity: item.quantity == null ? '' : String(item.quantity),
    unitPrice: inputCents(item.unitPriceCents), totalPrice: inputCents(item.totalPriceCents),
    brand: item.brand ?? '', model: item.model ?? '', confidence: item.confidence ?? null,
  };
}

export function analysisReviewDefaults(analysis, purchase, currency = 'EUR') {
  const data = analysis.extractedData ?? {};
  return {
    merchant: data.merchant?.name ?? purchase.merchant ?? '',
    purchaseDate: data.purchaseDate?.value ?? isoDate(purchase.purchaseDate),
    total: inputCents(data.totalCents ?? purchase.totalCents),
    currency: data.currency ?? currency,
    items: (data.items ?? []).map(analysisItemDefaults),
    applyMerchant: true, applyPurchaseDate: true,
    applyTotal: !analysisTotalProtected(purchase), applyItems: false,
    acknowledgeTotalMismatch: false,
  };
}

export function analysisReviewMismatch(values) {
  const total = analysisMoney(values.total);
  const lines = values.items.map((item) => analysisMoney(item.totalPrice));
  if (total === null || !Number.isFinite(total) || !lines.length || lines.some((line) => line === null || !Number.isFinite(line))) return false;
  return lines.reduce((sum, line) => sum + line, 0) !== total;
}

export function analysisReviewSchema(purchase, currency = 'EUR') {
  const money = z.string().refine((value) => !Number.isNaN(analysisMoney(value)), 'Introduce un importe no negativo con hasta dos decimales.');
  return z.object({
    merchant: optionalText(200), purchaseDate: z.string(), total: money,
    currency: z.string().trim().regex(/^[A-Z]{3}$/, 'Indica una moneda de tres letras, por ejemplo EUR.'),
    applyMerchant: z.boolean(), applyPurchaseDate: z.boolean(), applyTotal: z.boolean(), applyItems: z.boolean(), acknowledgeTotalMismatch: z.boolean(),
    items: z.array(z.object({
      name: optionalText(200), quantity: z.string(), unitPrice: money, totalPrice: money,
      brand: optionalText(120), model: optionalText(120), confidence: z.string().nullable(),
    })).max(MAX_PURCHASE_ITEMS, 'Puedes revisar hasta 50 productos.'),
  }).superRefine((values, context) => {
    const issue = (path, message) => context.addIssue({ code: 'custom', path, message });
    if (values.purchaseDate && !z.iso.date().safeParse(values.purchaseDate).success) issue(['purchaseDate'], 'Indica una fecha de compra válida.');
    if (values.applyPurchaseDate && !values.purchaseDate) issue(['purchaseDate'], 'Indica la fecha o desmarca aplicar la fecha.');
    if (values.applyTotal && analysisMoney(values.total) === null) issue(['total'], 'Indica el total o desmarca aplicar el total.');
    if (values.applyTotal && analysisTotalProtected(purchase)) issue(['applyTotal'], 'El total está protegido porque hay cuotas pagadas.');
    if ((values.applyTotal || values.applyItems) && values.currency !== currency) issue(['currency'], `La moneda debe ser ${currency}. No se realiza conversión automática.`);
    if (values.applyItems && values.items.length + (purchase.items?.length ?? 0) > MAX_PURCHASE_ITEMS) issue(['applyItems'], `Esta compra puede tener como máximo ${MAX_PURCHASE_ITEMS} productos. Reduce los productos que vas a añadir.`);
    values.items.forEach((item, index) => {
      if (values.applyItems && !item.name.trim()) issue(['items', index, 'name'], 'Escribe el nombre del producto.');
      if ((values.applyItems || item.quantity) && (!/^\d+$/.test(item.quantity) || Number(item.quantity) < 1 || Number(item.quantity) > 10000)) issue(['items', index, 'quantity'], 'Introduce una cantidad entera entre 1 y 10.000.');
    });
    if (analysisReviewMismatch(values) && !values.acknowledgeTotalMismatch) issue(['acknowledgeTotalMismatch'], 'Confirma que has revisado la diferencia antes de guardar.');
  });
}

export function analysisReviewPayload(values, analysis) {
  return {
    purchaseVersion: analysis.purchaseVersion,
    reviewedData: {
      merchant: values.merchant.trim() || null, purchaseDate: values.purchaseDate || null,
      totalCents: analysisMoney(values.total), currency: values.currency,
      items: values.items.map((item) => ({ name: item.name.trim() || null, quantity: item.quantity ? Number(item.quantity) : null, unitPriceCents: analysisMoney(item.unitPrice), totalPriceCents: analysisMoney(item.totalPrice), brand: item.brand.trim() || null, model: item.model.trim() || null })),
    },
    apply: { merchant: values.applyMerchant, purchaseDate: values.applyPurchaseDate, total: values.applyTotal, items: values.applyItems ? 'ADD' : 'NONE' },
    acknowledgeTotalMismatch: values.acknowledgeTotalMismatch,
  };
}
