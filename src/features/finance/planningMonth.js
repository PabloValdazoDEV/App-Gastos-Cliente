export function nextPlanningMonth(today) {
  const [year, month] = today.split('-').map(Number);
  return month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, '0')}`;
}

export function isPlanningMonth(value) {
  return /^(20\d{2}|21\d{2}|2200)-(0[1-9]|1[0-2])$/.test(value);
}

export function planningMonthLabel(month) {
  return new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${month}-01T00:00:00Z`));
}
