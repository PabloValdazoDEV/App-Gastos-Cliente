import { z } from 'zod';

export const INVOICE_DOCUMENT_MAX_BYTES = 10 * 1_024 * 1_024;
export const INVOICE_DOCUMENT_MAX_COUNT = 5;
export const INVOICE_DOCUMENT_ACCEPT = [
  '.pdf',
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
].join(',');

const acceptedContentTypes = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
]);
const contentTypeByExtension = Object.freeze({
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  pdf: 'application/pdf',
  png: 'image/png',
  webp: 'image/webp',
});

export function getInvoiceDocumentContentType(file) {
  const declaredType = typeof file?.type === 'string'
    ? file.type.trim().toLowerCase()
    : '';

  if (declaredType) return declaredType;

  const extension = typeof file?.name === 'string'
    ? file.name.split('.').pop()?.toLowerCase()
    : '';
  return contentTypeByExtension[extension] ?? '';
}

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

export function formatDocumentSize(sizeBytes) {
  const size = Number(sizeBytes);

  if (!Number.isFinite(size) || size < 0) return 'Tamaño no disponible';
  if (size < 1_024) return `${size} B`;

  const units = [
    ['MiB', 1_024 * 1_024],
    ['KiB', 1_024],
  ];
  const [unit, divisor] = units.find(([, threshold]) => size >= threshold);
  const value = size / divisor;

  return `${new Intl.NumberFormat('es-ES', {
    maximumFractionDigits: value >= 10 ? 0 : 1,
  }).format(value)} ${unit}`;
}
