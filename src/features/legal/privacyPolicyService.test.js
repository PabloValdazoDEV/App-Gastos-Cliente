import { describe, expect, it, vi } from 'vitest';

const clientMocks = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock('../../api/client', () => ({
  http: { get: clientMocks.get },
}));

import { privacyPolicyService } from './privacyPolicyService';

describe('privacyPolicyService', () => {
  it('obtiene los metadatos públicos sin sesión', async () => {
    const metadata = {
      configured: true,
      controller: {
        address: 'Calle Ejemplo 1',
        contactEmail: 'privacidad@example.com',
        dpoEmail: null,
        name: 'Responsable Demo',
      },
      effectiveDate: '2026-08-26',
      version: '2026-08-26',
    };
    clientMocks.get.mockResolvedValue(metadata);

    await expect(privacyPolicyService.getMetadata()).resolves.toEqual(metadata);
    expect(clientMocks.get).toHaveBeenCalledWith('/legal/privacy-policy');
  });
});
