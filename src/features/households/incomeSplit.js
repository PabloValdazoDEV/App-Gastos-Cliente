// "30.000", "30000" or "30.000,50" → cents; throws on anything else.
export function incomeInputToCents(value) {
  const compact = String(value ?? '').replace(/\s|€/g, '');
  const normalized = compact.includes(',')
    ? compact.replace(/\./g, '').replace(',', '.')
    : /^\d{1,3}(\.\d{3})+$/.test(compact) ? compact.replace(/\./g, '') : compact;
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(normalized);
  if (!match) throw new Error('Escribe el sueldo bruto anual en euros, por ejemplo 30.000.');
  return Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
}

// Live preview of the server's split: proportional, largest remainder, 100 %.
export function incomePreviewBps(draft) {
  const active = draft.filter((person) => person.active).map((person) => {
    try { return { id: person.id, cents: incomeInputToCents(person.income || '0') }; } catch { return { id: person.id, cents: 0 }; }
  });
  const total = active.reduce((sum, person) => sum + person.cents, 0);
  if (!total) return new Map();
  const shares = active.map((person, index) => {
    const exact = (person.cents * 10000) / total;
    return { id: person.id, index, bps: Math.floor(exact), remainder: exact - Math.floor(exact) };
  });
  let missing = 10000 - shares.reduce((sum, share) => sum + share.bps, 0);
  [...shares].sort((left, right) => right.remainder - left.remainder || left.index - right.index).forEach((share) => {
    if (missing > 0) { share.bps += 1; missing -= 1; }
  });
  return new Map(shares.map((share) => [share.id, share.bps]));
}
