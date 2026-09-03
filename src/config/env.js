import { parsePublicEnv } from './parsePublicEnv.js';

export { parsePublicEnv } from './parsePublicEnv.js';

export const publicEnv = parsePublicEnv({
  VITE_API_URL: import.meta.env.VITE_API_URL,
  VITE_CSRF_COOKIE_NAME: import.meta.env.VITE_CSRF_COOKIE_NAME,
  VITE_APP_NAME: import.meta.env.VITE_APP_NAME,
  VITE_VAPID_PUBLIC_KEY: import.meta.env.VITE_VAPID_PUBLIC_KEY,
  VITE_ENABLE_GOOGLE_LOGIN: import.meta.env.VITE_ENABLE_GOOGLE_LOGIN,
  VITE_ENABLE_WEB_PUSH: import.meta.env.VITE_ENABLE_WEB_PUSH,
});
