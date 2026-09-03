export function formatCents(cents, currency = 'EUR') {
  if (!Number.isSafeInteger(cents)) return '—';
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency,
  }).format(cents / 100);
}

export function eurosInputToCents(value) {
  const normalized = String(value).trim().replace(',', '.');
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(normalized);
  if (!match) throw new Error('Introduce un importe válido con hasta dos decimales.');
  return Number(BigInt(match[1]) * 100n + BigInt((match[2] ?? '').padEnd(2, '0')));
}

export function isoDate(value) {
  return typeof value === 'string' ? value.slice(0, 10) : '';
}

