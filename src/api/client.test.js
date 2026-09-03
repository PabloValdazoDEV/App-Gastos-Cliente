import { describe, expect, it } from 'vitest';

import { toApiErrorWithBlob } from './client';

describe('normalización de errores blob', () => {
  it('recupera el código y mensaje JSON de una descarga fallida', async () => {
    const response = {
      code: 'INVOICE_DOCUMENT_NOT_FOUND',
      message: 'El documento ya no existe.',
      requestId: 'request-1',
    };
    const error = {
      response: {
        data: new Blob([JSON.stringify(response)], { type: 'application/json' }),
        headers: { 'content-type': 'application/json; charset=utf-8' },
        status: 404,
      },
    };

    await expect(toApiErrorWithBlob(error)).resolves.toMatchObject({
      code: 'INVOICE_DOCUMENT_NOT_FOUND',
      message: 'El documento ya no existe.',
      requestId: 'request-1',
      status: 404,
    });
  });
});
