const DEFAULT_AUTH_DESTINATION = '/dashboard';
const AUTH_RETURN_STORAGE_KEY = 'budgetapp.authReturnTo';
const INTERNAL_URL_BASE = 'https://budgetapp.local';

function normalizeInternalDestination(candidate) {
  if (typeof candidate !== 'string' || !candidate.startsWith('/')) {
    return DEFAULT_AUTH_DESTINATION;
  }

  try {
    const url = new URL(candidate, INTERNAL_URL_BASE);

    if (url.origin !== INTERNAL_URL_BASE) {
      return DEFAULT_AUTH_DESTINATION;
    }

    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return DEFAULT_AUTH_DESTINATION;
  }
}

export function getAuthDestination(from) {
  if (typeof from === 'string') {
    return normalizeInternalDestination(from);
  }

  if (!from || typeof from.pathname !== 'string') {
    return DEFAULT_AUTH_DESTINATION;
  }

  const search = typeof from.search === 'string' ? from.search : '';
  const hash = typeof from.hash === 'string' ? from.hash : '';

  return normalizeInternalDestination(`${from.pathname}${search}${hash}`);
}

export function storeAuthDestination(from) {
  const destination = getAuthDestination(from);

  try {
    window.sessionStorage.setItem(AUTH_RETURN_STORAGE_KEY, destination);
  } catch {
    // El acceso puede continuar aunque el navegador bloquee sessionStorage.
  }

  return destination;
}

export function readStoredAuthDestination({ consume = false } = {}) {
  try {
    const destination = getAuthDestination(
      window.sessionStorage.getItem(AUTH_RETURN_STORAGE_KEY),
    );

    if (consume) {
      window.sessionStorage.removeItem(AUTH_RETURN_STORAGE_KEY);
    }

    return destination;
  } catch {
    return DEFAULT_AUTH_DESTINATION;
  }
}

export function authDestinationLocation(destination) {
  const url = new URL(getAuthDestination(destination), INTERNAL_URL_BASE);

  return {
    hash: url.hash,
    pathname: url.pathname,
    search: url.search,
  };
}
