export const frequencyOptions = Object.freeze({
  WEEKLY: 'Semanal',
  CUSTOM_WEEKS: 'Cada varias semanas',
  MONTHLY: 'Mensual',
  BIMONTHLY: 'Bimestral',
  QUARTERLY: 'Trimestral',
  SEMIANNUAL: 'Semestral',
  YEARLY: 'Anual',
  CUSTOM_MONTHS: 'Cada varios meses',
  ONE_TIME: 'Pago único',
});

export const expenseFrequencies = Object.freeze(Object.keys(frequencyOptions));
export const minIntervalWeeks = 2;
export const maxIntervalWeeks = 520;

export function isValidIntervalWeeks(intervalWeeks) {
  return Number.isInteger(intervalWeeks) &&
    intervalWeeks >= minIntervalWeeks && intervalWeeks <= maxIntervalWeeks;
}

export function formatFrequency({ frequency, intervalWeeks, intervalMonths }) {
  if (frequency === 'CUSTOM_WEEKS' && isValidIntervalWeeks(intervalWeeks)) {
    return `Cada ${intervalWeeks} semanas`;
  }
  if (frequency === 'CUSTOM_MONTHS' && Number.isInteger(intervalMonths) && intervalMonths > 0) {
    return `Cada ${intervalMonths} ${intervalMonths === 1 ? 'mes' : 'meses'}`;
  }
  return frequencyOptions[frequency] ?? frequency;
}
