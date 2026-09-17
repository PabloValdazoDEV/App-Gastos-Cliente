export function purchaseTitle(purchase) {
  return purchase.items?.[0]?.name || 'Compra guardada';
}

export function ownershipLabel(purchase) {
  if (purchase.ownershipType === 'PERSONAL') return purchase.personalPerson?.name || 'Personal';
  if (purchase.ownershipType === 'SPLIT') return 'Repartida';
  return 'Del hogar';
}

export function purchaseDateLabel(value) {
  if (!value) return 'Sin fecha';
  const date = new Date(`${String(value).slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return 'Fecha no disponible';
  return new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(date);
}

export function filterPurchases(purchases, { search = '', ownership = 'ALL', warranty = 'ALL' } = {}) {
  const normalize = (value) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');
  const term = normalize(search.trim());
  return purchases.filter((purchase) => {
    const searchable = [purchase.merchant, ...(purchase.items ?? []).flatMap((item) => [item.name, item.brand, item.model])];
    const matchesWarranty = warranty === 'ALL' || (purchase.items ?? []).some((item) => (
      warranty === 'ACTIVE'
        ? ['ACTIVE', 'EXPIRING_SOON'].includes(item.warrantyStatus)
        : (item.warrantyStatus ?? 'NONE') === warranty
    ));
    return (!term || searchable.some((value) => normalize(value).includes(term)))
      && (ownership === 'ALL' || purchase.ownershipType === ownership)
      && matchesWarranty;
  }).sort((a, b) => String(b.purchaseDate).localeCompare(String(a.purchaseDate)) || String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')));
}
