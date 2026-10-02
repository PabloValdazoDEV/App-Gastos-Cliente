const storageKey = 'budgetapp:development-date';

export function developmentDateEnabled() {
  return import.meta.env.MODE === 'development';
}

export function isCivilDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
    && Number(value.slice(0, 4)) >= 100;
}

export function getDevelopmentDate() {
  if (!developmentDateEnabled()) return null;
  try {
    const date = sessionStorage.getItem(storageKey);
    return isCivilDate(date) ? date : null;
  } catch { return null; }
}

export function saveDevelopmentDate(date) {
  if (!developmentDateEnabled()) throw new Error('La fecha simulada solo está disponible en desarrollo.');
  if (date !== null && !isCivilDate(date)) throw new Error('Selecciona una fecha válida.');
  try {
    if (date === null) sessionStorage.removeItem(storageKey);
    else sessionStorage.setItem(storageKey, date);
  } catch {
    throw new Error('El navegador no permite guardar la fecha de desarrollo en esta pestaña.');
  }
}

export function developmentDateForRequest(url = '') {
  // Never send the override to authentication or an absolute external URL.
  return /^\/households(?:\/|$)/.test(url) ? getDevelopmentDate() : null;
}
