import { beforeEach, describe, expect, it, vi } from 'vitest';

const clientMocks = vi.hoisted(() => ({
  delete: vi.fn(),
  get: vi.fn(),
  patch: vi.fn(),
  post: vi.fn(),
}));

vi.mock('../../api/client', () => ({
  http: clientMocks,
}));

import { financeService } from './financeService';

describe('financeService · documentos de factura', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('normaliza la colección pública de metadatos', async () => {
    const documents = [{ filename: 'luz.pdf', id: 'document-1' }];
    clientMocks.get.mockResolvedValue(documents);

    await expect(financeService.invoiceDocuments({
      householdId: 'household-1',
      invoiceId: 'invoice-1',
    })).resolves.toEqual(documents);
    expect(clientMocks.get).toHaveBeenCalledWith(
      '/households/household-1/invoices/invoice-1/documents',
    );
  });

  it('sube el File crudo con MIME inferido y nombre codificado fuera de la URL', async () => {
    const file = new File(['pdf'], 'Factura agosto #1.pdf', { type: '' });
    clientMocks.post.mockResolvedValue({ id: 'document-1' });

    await financeService.uploadInvoiceDocument({
      file,
      householdId: 'household-1',
      invoiceId: 'invoice-1',
    });

    expect(clientMocks.post).toHaveBeenCalledWith(
      '/households/household-1/invoices/invoice-1/documents',
      file,
      {
        headers: {
          'Content-Type': 'application/pdf',
          'X-Document-Filename': 'Factura%20agosto%20%231.pdf',
        },
        timeout: 60_000,
      },
    );
  });

  it('obtiene contenido como blob desde la ruta protegida', async () => {
    const blob = new Blob(['pdf'], { type: 'application/pdf' });
    clientMocks.get.mockResolvedValue(blob);

    await expect(financeService.invoiceDocumentContent({
      documentId: 'document-1',
      householdId: 'household-1',
      invoiceId: 'invoice-1',
    })).resolves.toBe(blob);
    expect(clientMocks.get).toHaveBeenCalledWith(
      '/households/household-1/invoices/invoice-1/documents/document-1/content',
      { responseType: 'blob', timeout: 60_000 },
    );
  });

  it('elimina por el identificador del documento', async () => {
    clientMocks.delete.mockResolvedValue({ deleted: true, id: 'document-1' });

    await financeService.deleteInvoiceDocument({
      documentId: 'document-1',
      householdId: 'household-1',
      invoiceId: 'invoice-1',
    });

    expect(clientMocks.delete).toHaveBeenCalledWith(
      '/households/household-1/invoices/invoice-1/documents/document-1',
    );
  });
});

describe('financeService · facturas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('actualiza una factura por su identificador', async () => {
    const body = { amountCents: 8_050 };
    clientMocks.patch.mockResolvedValue({ id: 'invoice-1', ...body });

    await financeService.updateInvoice({
      householdId: 'household-1',
      invoiceId: 'invoice-1',
      body,
    });

    expect(clientMocks.patch).toHaveBeenCalledWith(
      '/households/household-1/invoices/invoice-1',
      body,
    );
  });
});
