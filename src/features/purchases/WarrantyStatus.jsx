import { ShieldCheck } from 'lucide-react';

import { purchaseDateLabel } from './presentation';

export function WarrantyStatus({ item }) {
  const status = item.warrantyStatus ?? 'NONE';
  const date = purchaseDateLabel(item.warrantyEndsAt);
  const tone = status === 'EXPIRED' ? 'text-red-800' : status === 'EXPIRING_SOON' ? 'text-amber-900' : status === 'ACTIVE' ? 'text-brand-strong' : 'text-text-muted';
  return (
    <div className={`flex min-w-0 items-start gap-2 text-sm ${tone}`}>
      <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 break-words">
        <p className="font-bold">{status === 'NONE' ? 'Sin garantía' : status === 'EXPIRED' ? `Caducó el ${date}` : `Vigente hasta ${date}`}</p>
        {status === 'EXPIRING_SOON' ? <p>{item.warrantyDaysRemaining === 0 ? 'Caduca hoy' : `Caduca en ${item.warrantyDaysRemaining} ${item.warrantyDaysRemaining === 1 ? 'día' : 'días'}`}</p> : null}
      </div>
    </div>
  );
}

export function PurchaseWarrantySummary({ items = [] }) {
  if (items.length === 1) return <WarrantyStatus item={items[0]} />;
  const counts = items.reduce((result, item) => {
    const status = item.warrantyStatus ?? 'NONE';
    result[status] = (result[status] ?? 0) + 1;
    return result;
  }, {});
  const labels = {
    ACTIVE: ['vigente', 'vigentes'], EXPIRING_SOON: ['próxima a caducar', 'próximas a caducar'],
    EXPIRED: ['caducada', 'caducadas'], NONE: ['sin garantía', 'sin garantía'],
  };
  return <p className="break-words text-sm text-text-muted">Garantías por producto: {['ACTIVE', 'EXPIRING_SOON', 'EXPIRED', 'NONE'].filter((status) => counts[status]).map((status) => `${counts[status]} ${labels[status][counts[status] === 1 ? 0 : 1]}`).join(' · ')}</p>;
}
