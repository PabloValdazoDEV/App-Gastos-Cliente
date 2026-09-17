import { z } from 'zod';
import {
  DOCUMENT_ACCEPT as INVOICE_DOCUMENT_ACCEPT,
  DOCUMENT_CONTENT_TYPES,
  DOCUMENT_MAX_BYTES as INVOICE_DOCUMENT_MAX_BYTES,
  getDocumentContentType as getInvoiceDocumentContentType,
} from '../documents/documentFiles';

export { INVOICE_DOCUMENT_ACCEPT, INVOICE_DOCUMENT_MAX_BYTES, getInvoiceDocumentContentType };
export { formatDocumentSize } from '../documents/documentFiles';
export const INVOICE_DOCUMENT_MAX_COUNT = 5;
const acceptedContentTypes = new Set(DOCUMENT_CONTENT_TYPES);

export const invoiceDocumentFileSchema = z
  .custom(
    (value) => typeof File !== 'undefined' && value instanceof File,
    'Selecciona un archivo válido.',
  )
  .superRefine((file, context) => {
    if (typeof File === 'undefined' || !(file instanceof File)) return;

    if (!acceptedContentTypes.has(getInvoiceDocumentContentType(file))) {
      context.addIssue({
        code: 'custom',
        message: `${file.name}: usa un archivo PDF, JPEG, PNG o WebP.`,
      });
    }

    if (file.size === 0) {
      context.addIssue({
        code: 'custom',
        message: `${file.name}: el archivo está vacío.`,
      });
    }

    if (file.size > INVOICE_DOCUMENT_MAX_BYTES) {
      context.addIssue({
        code: 'custom',
        message: `${file.name}: el archivo supera el máximo de 10 MiB.`,
      });
    }
  });

const invoiceDocumentSelectionSchema = z
  .array(invoiceDocumentFileSchema)
  .min(1, 'Selecciona al menos un documento.')
  .max(
    INVOICE_DOCUMENT_MAX_COUNT,
    `Solo puedes seleccionar ${INVOICE_DOCUMENT_MAX_COUNT} documentos a la vez.`,
  );

export function validateInvoiceDocumentSelection(files, existingCount = 0) {
  const selection = Array.from(files ?? []);

  if (existingCount + selection.length > INVOICE_DOCUMENT_MAX_COUNT) {
    const remaining = Math.max(0, INVOICE_DOCUMENT_MAX_COUNT - existingCount);
    return {
      error: remaining === 0
        ? 'Esta factura ya tiene el máximo de 5 documentos.'
        : `Puedes añadir ${remaining} ${remaining === 1 ? 'documento más' : 'documentos más'} a esta factura.`,
      files: [],
    };
  }

  const result = invoiceDocumentSelectionSchema.safeParse(selection);

  if (!result.success) {
    return {
      error: result.error.issues[0]?.message ?? 'Revisa los documentos seleccionados.',
      files: [],
    };
  }

  return { error: null, files: result.data };
}
