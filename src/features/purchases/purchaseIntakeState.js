import { purchaseDefaults, purchaseItemDefaults } from './purchaseFormState';

const moneyInput = (value) => Number.isSafeInteger(value) && value >= 0 && value <= 2_147_483_647 ? (value / 100).toFixed(2) : '';

export function purchaseIntakeQuantity(item) {
  if (Number.isInteger(item?.quantity) && item.quantity >= 1 && item.quantity <= 10_000) return { value: item.quantity, source: 'DETECTED' };
  // Exact integer ratios only; do not round weight-based or discounted lines.
  const ratio = item?.unitPriceCents > 0 && item?.totalPriceCents > 0 ? item.totalPriceCents / item.unitPriceCents : null;
  if (Number.isInteger(ratio) && ratio >= 1 && ratio <= 10_000) return { value: ratio, source: 'CALCULATED' };
  return { value: 1, source: 'SUGGESTED' };
}

export function purchaseIntakeHints(extraction, selectedIndex) {
  const item = extraction?.items?.[selectedIndex];
  const source = purchaseIntakeQuantity(item).source;
  return {
    quantity: source === 'SUGGESTED' ? 'La IA no ha identificado las unidades. Proponemos 1 unidad: comprueba y corrige la cantidad.'
      : source === 'CALCULATED' ? 'Unidades calculadas con el total de la línea y el precio unitario. Comprueba que no haya descuentos ni venta al peso.' : 'Unidades detectadas en el documento. Puedes corregirlas.',
    warranty: item?.warranty ? 'Garantía detectada en el documento. Revisa su alcance, fecha de inicio y condiciones; no se ha deducido por la marca del producto.' : null,
    date: extraction?.purchaseDate?.value ? 'Fecha detectada en el documento. Comprueba que sea la fecha de compra.' : 'La IA no ha identificado la fecha de compra. Indícala antes de guardar.',
  };
}

// A receipt can cover several products, but each new purchase represents one.
// Never apply the grand total to every selected line or invent a conversion.
export function purchaseIntakeValues(extraction, selectedIndex, currency) {
  const item = extraction?.items?.[selectedIndex];
  const knownCurrency = extraction?.currency === currency;
  const lineTotal = item?.totalPriceCents ?? (item?.quantity != null && item?.unitPriceCents != null ? item.quantity * item.unitPriceCents : null);
  const amount = knownCurrency && item ? (extraction.items.length === 1 ? extraction.totalCents ?? lineTotal : lineTotal) : null;
  const warranty = item?.warranty;
  const itemDefaults = purchaseItemDefaults(warranty ? {
    warrantyDurationMonths: warranty.endsAt ? null : warranty.durationMonths,
    warrantyEndsAt: warranty.endsAt,
    warrantySource: warranty.endsAt ? 'EXPLICIT_DATE' : 'DURATION',
  } : null);
  return {
    ...purchaseDefaults(),
    merchant: extraction?.merchant?.name ?? '', purchaseDate: extraction?.purchaseDate?.value ?? '',
    total: moneyInput(amount),
    items: [{ ...itemDefaults, name: item?.name ?? '', brand: item?.brand ?? '', model: item?.model ?? '', quantity: String(purchaseIntakeQuantity(item).value) }],
  };
}
