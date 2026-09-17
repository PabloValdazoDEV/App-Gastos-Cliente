const sourceLabels = Object.freeze({
  PURCHASE_UPFRONT: 'Compra al contado',
  PURCHASE_DOWN_PAYMENT: 'Entrada de compra',
  PURCHASE_INSTALLMENT: 'Cuota de compra',
});

export function isPurchaseFinancialSource(sourceType) {
  return Object.hasOwn(sourceLabels, sourceType);
}

export function purchaseFinancialSourceLabel(sourceType) {
  return sourceLabels[sourceType] ?? 'Compra';
}

export function purchaseFinancialScopeLabel(entry) {
  if (entry.ownershipType === 'SPLIT') {
    const percentage = Number.isInteger(entry.shareBps) ? ` (${new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 }).format(entry.shareBps / 100)} %)` : '';
    return `Tu parte de una compra repartida${percentage}`;
  }
  return entry.scope === 'PERSONAL' ? 'Gasto personal' : 'Gasto común';
}
