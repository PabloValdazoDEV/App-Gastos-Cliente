import { z } from 'zod';

const featureFlagSchema = z
  .enum(['true', 'false'])
  .default('false')
  .transform((value) => value === 'true');

const apiUrlSchema = z.string().trim().refine(
  (value) =>
    /^\/(?!\/)\S+$/.test(value) || z.string().url().safeParse(value).success,
  'Debe ser una URL absoluta o una ruta que empiece por /.',
);

const publicEnvSchema = z
  .object({
    VITE_API_URL: apiUrlSchema,
    VITE_CSRF_COOKIE_NAME: z
      .string()
      .trim()
      .min(1, 'Es obligatorio.')
      .default('csrf_token'),
    VITE_APP_NAME: z
      .string()
      .trim()
      .min(1, 'Es obligatoria.')
      .max(60, 'No puede superar 60 caracteres.'),
    VITE_VAPID_PUBLIC_KEY: z.string().trim().optional().default(''),
    VITE_ENABLE_GOOGLE_LOGIN: featureFlagSchema,
    VITE_ENABLE_WEB_PUSH: featureFlagSchema,
  })
  .superRefine((values, context) => {
    if (values.VITE_ENABLE_WEB_PUSH && !values.VITE_VAPID_PUBLIC_KEY) {
      context.addIssue({
        code: 'custom',
        message: 'Es obligatoria cuando Web Push está activado.',
        path: ['VITE_VAPID_PUBLIC_KEY'],
      });
    }
  });

export function parsePublicEnv(values) {
  const result = publicEnvSchema.safeParse(values);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join('.') || 'entorno'}: ${issue.message}`)
      .join('\n');

    throw new Error(
      `Configuración pública no válida. Revisa tu archivo .env:\n${details}`,
    );
  }

  return Object.freeze({
    apiUrl: result.data.VITE_API_URL.replace(/\/+$/, ''),
    csrfCookieName: result.data.VITE_CSRF_COOKIE_NAME,
    appName: result.data.VITE_APP_NAME,
    vapidPublicKey: result.data.VITE_VAPID_PUBLIC_KEY,
    enableGoogleLogin: result.data.VITE_ENABLE_GOOGLE_LOGIN,
    enableWebPush: result.data.VITE_ENABLE_WEB_PUSH,
  });
}
