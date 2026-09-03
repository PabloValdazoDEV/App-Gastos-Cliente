import { describe, expect, it } from 'vitest';

import {
  INVOICE_DOCUMENT_MAX_BYTES,
  formatDocumentSize,
  getInvoiceDocumentContentType,
  validateInvoiceDocumentSelection,
} from './invoiceDocumentSchema';

describe('validación de documentos de factura', () => {
  it('acepta los cuatro tipos permitidos', () => {
    const files = [
      new File(['pdf'], 'factura.pdf', { type: 'application/pdf' }),
      new File(['jpg'], 'contador.jpg', { type: 'image/jpeg' }),
      new File(['png'], 'contador.png', { type: 'image/png' }),
      new File(['webp'], 'contador.webp', { type: 'image/webp' }),
    ];

    expect(validateInvoiceDocumentSelection(files)).toEqual({
      error: null,
      files,
    });
  });

  it('infiere el MIME de una extensión permitida si el proveedor móvil lo omite', () => {
    const file = new File(['jpg'], 'contador.JPEG', { type: '' });

    expect(getInvoiceDocumentContentType(file)).toBe('image/jpeg');
    expect(validateInvoiceDocumentSelection([file]).error).toBeNull();
  });

  it('rechaza un MIME no permitido aunque el nombre termine en pdf', () => {
    const file = new File(['texto'], 'factura.pdf', { type: 'text/plain' });

    expect(validateInvoiceDocumentSelection([file]).error).toBe(
      'factura.pdf: usa un archivo PDF, JPEG, PNG o WebP.',
    );
  });

  it('rechaza archivos mayores de 10 MiB y selecciones que superan cinco', () => {
    const largeFile = new File(['x'], 'grande.pdf', { type: 'application/pdf' });
    Object.defineProperty(largeFile, 'size', { value: INVOICE_DOCUMENT_MAX_BYTES + 1 });
    const first = new File(['x'], 'uno.pdf', { type: 'application/pdf' });
    const second = new File(['x'], 'dos.pdf', { type: 'application/pdf' });

    expect(validateInvoiceDocumentSelection([largeFile]).error).toBe(
      'grande.pdf: el archivo supera el máximo de 10 MiB.',
    );
    expect(validateInvoiceDocumentSelection([first, second], 4).error).toBe(
      'Puedes añadir 1 documento más a esta factura.',
    );
  });

  it('rechaza archivos vacíos antes de enviarlos', () => {
    const emptyFile = new File([], 'vacia.pdf', { type: 'application/pdf' });

    expect(validateInvoiceDocumentSelection([emptyFile]).error).toBe(
      'vacia.pdf: el archivo está vacío.',
    );
  });

  it('formatea tamaños binarios de forma legible', () => {
    expect(formatDocumentSize(2_048)).toBe('2 KiB');
    expect(formatDocumentSize(1_572_864)).toBe('1,5 MiB');
  });
});
