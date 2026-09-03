import { describe, expect, it } from 'vitest';

import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from './authSchemas';

describe('schemas de autenticación', () => {
  it('normaliza email y nombre al registrar', () => {
    const result = registerSchema.parse({
      email: '  persona@example.com ',
      name: '  Persona Demo ',
      password: 'Segura123!',
      passwordConfirmation: 'Segura123!',
      privacyPolicyAcknowledged: true,
      privacyPolicyVersion: '2026-08-26',
    });

    expect(result.email).toBe('persona@example.com');
    expect(result.name).toBe('Persona Demo');
  });

  it.each([
    ['Corta1!', 'Usa al menos 8 caracteres.'],
    ['SINMINUSCULA1!', 'Añade al menos una letra minúscula.'],
    ['sinmayuscula1!', 'Añade al menos una letra mayúscula.'],
    ['SinNumero!', 'Añade al menos un número.'],
    ['SinSimbolo1', 'Añade al menos un carácter especial.'],
  ])('rechaza una contraseña que no cumple la política', (password, message) => {
    const result = registerSchema.safeParse({
      email: 'persona@example.com',
      name: 'Persona Demo',
      password,
      passwordConfirmation: password,
      privacyPolicyAcknowledged: true,
      privacyPolicyVersion: '2026-08-26',
    });

    expect(result.success).toBe(false);
    expect(result.error.issues.map((issue) => issue.message)).toContain(message);
  });

  it('informa cuando las contraseñas no coinciden', () => {
    const result = resetPasswordSchema.safeParse({
      password: 'Segura123!',
      passwordConfirmation: 'Distinta123!',
    });

    expect(result.success).toBe(false);
    expect(result.error.issues[0]).toMatchObject({
      message: 'Las contraseñas no coinciden.',
      path: ['passwordConfirmation'],
    });
  });

  it('exige confirmación explícita y una versión de privacidad', () => {
    const base = {
      email: 'persona@example.com',
      name: 'Persona Demo',
      password: 'Segura123!',
      passwordConfirmation: 'Segura123!',
      privacyPolicyVersion: '2026-08-26',
    };

    const unchecked = registerSchema.safeParse({
      ...base,
      privacyPolicyAcknowledged: false,
    });
    const missingVersion = registerSchema.safeParse({
      ...base,
      privacyPolicyAcknowledged: true,
      privacyPolicyVersion: '',
    });

    expect(unchecked.success).toBe(false);
    expect(unchecked.error.issues[0].message).toBe(
      'Confirma que has leído la Política de privacidad para crear tu cuenta.',
    );
    expect(missingVersion.success).toBe(false);
    expect(missingVersion.error.issues[0].message).toBe(
      'Recarga la Política de privacidad para confirmar su versión vigente.',
    );
  });

  it('no aplica la política nueva al login de cuentas existentes', () => {
    expect(
      loginSchema.safeParse({ email: 'persona@example.com', password: 'legacy' }).success,
    ).toBe(true);
  });

  it('valida el email en la recuperación', () => {
    expect(forgotPasswordSchema.safeParse({ email: 'incorrecto' }).success).toBe(false);
  });
});
