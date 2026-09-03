import { z } from 'zod';

const emailSchema = z
  .string()
  .trim()
  .min(1, 'Introduce tu email.')
  .max(320, 'El email es demasiado largo.')
  .email('Introduce un email válido.')
  .transform((value) => value.toLowerCase());

const passwordSchema = z
  .string()
  .min(8, 'Usa al menos 8 caracteres.')
  .max(1_024, 'La contraseña no puede superar 1024 caracteres.')
  .regex(/[a-z]/, 'Añade al menos una letra minúscula.')
  .regex(/[A-Z]/, 'Añade al menos una letra mayúscula.')
  .regex(/[0-9]/, 'Añade al menos un número.')
  .regex(/[^A-Za-z0-9]/, 'Añade al menos un carácter especial.');

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Introduce tu contraseña.'),
});

export const registerSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, 'Introduce tu nombre.')
      .max(120, 'El nombre no puede superar 120 caracteres.'),
    email: emailSchema,
    password: passwordSchema,
    passwordConfirmation: z.string().min(1, 'Repite tu contraseña.'),
    privacyPolicyAcknowledged: z.literal(true, {
      error: 'Confirma que has leído la Política de privacidad para crear tu cuenta.',
    }),
    privacyPolicyVersion: z
      .string()
      .trim()
      .min(1, 'Recarga la Política de privacidad para confirmar su versión vigente.')
      .max(120, 'La versión de la Política de privacidad no es válida.'),
  })
  .refine((values) => values.password === values.passwordConfirmation, {
    message: 'Las contraseñas no coinciden.',
    path: ['passwordConfirmation'],
  });

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    passwordConfirmation: z.string().min(1, 'Repite tu nueva contraseña.'),
  })
  .refine((values) => values.password === values.passwordConfirmation, {
    message: 'Las contraseñas no coinciden.',
    path: ['passwordConfirmation'],
  });

export const googleLinkSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Introduce tu contraseña.'),
});
