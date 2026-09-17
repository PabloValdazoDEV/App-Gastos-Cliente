import { describe, expect, it } from 'vitest';

import {
  MAX_PURCHASE_DOCUMENT_BYTES, PURCHASE_DOCUMENT_ACCEPT, PURCHASE_DOCUMENT_TYPES,
  formatDocumentSize, getPurchaseDocumentContentType, validatePurchaseDocumentFile,
} from './purchaseDocumentSchema';
import { INVOICE_DOCUMENT_MAX_BYTES } from '../finance/invoiceDocumentSchema';

describe('purchase document file selection', () => {
  it.each([
    ['receipt.pdf', 'application/pdf'], ['receipt.jpg', 'image/jpeg'],
    ['receipt.png', 'image/png'], ['receipt.webp', 'image/webp'],
  ])('accepts %s as a browser hint, leaving signature checks to the API', (name, type) => {
    expect(validatePurchaseDocumentFile(new File(['not-a-parsed-document'], name, { type }))).toBeNull();
    expect(PURCHASE_DOCUMENT_ACCEPT).toContain(type);
  });

  it('uses an extension only when the browser does not provide a MIME', () => {
    const file = new File(['binary'], 'Ticket.JPEG');
    expect(getPurchaseDocumentContentType(file)).toBe('image/jpeg');
    expect(validatePurchaseDocumentFile(file)).toBeNull();
    expect(validatePurchaseDocumentFile(new File(['<html>'], 'fake.pdf', { type: 'text/html' }))).toMatch(/Solo se admiten/);
  });

  it.each(['image/svg+xml', 'text/html', 'application/javascript', 'application/zip', 'application/octet-stream'])('rejects %s', (type) => {
    expect(validatePurchaseDocumentFile(new File(['bytes'], 'file.pdf', { type }))).toMatch(/Solo se admiten/);
  });

  it('rejects empty, missing and nameless files', () => {
    expect(validatePurchaseDocumentFile(null)).toBe('Selecciona un archivo.');
    expect(validatePurchaseDocumentFile({ name: 'a.pdf', size: 1 })).toBe('Selecciona un archivo.');
    expect(validatePurchaseDocumentFile(new File([], 'a.pdf', { type: 'application/pdf' }))).toMatch(/vacío/);
    expect(validatePurchaseDocumentFile(new File(['x'], ' ', { type: 'application/pdf' }))).toMatch(/nombre/);
  });

  it('shares the size policy with invoices and accepts exactly the maximum', () => {
    expect(MAX_PURCHASE_DOCUMENT_BYTES).toBe(INVOICE_DOCUMENT_MAX_BYTES);
    const file = new File(['x'], 'a.pdf', { type: 'application/pdf' });
    Object.defineProperty(file, 'size', { value: MAX_PURCHASE_DOCUMENT_BYTES, configurable: true });
    expect(validatePurchaseDocumentFile(file)).toBeNull();
    Object.defineProperty(file, 'size', { value: MAX_PURCHASE_DOCUMENT_BYTES + 1 });
    expect(validatePurchaseDocumentFile(file)).toBe('El archivo supera el tamaño máximo permitido.');
  });

  it('uses friendly metadata types and clear file size units', () => {
    expect(PURCHASE_DOCUMENT_TYPES.map((type) => type.label)).toEqual(['Ticket', 'Factura', 'Garantía', 'Otro']);
    expect(formatDocumentSize(1536)).toBe('1,5 KiB');
  });
});
