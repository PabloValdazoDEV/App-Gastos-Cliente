// Shared browser-side hints; the API independently verifies the actual bytes.
export const DOCUMENT_MAX_BYTES = 10 * 1_024 * 1_024;
export const DOCUMENT_ACCEPT = [
  '.pdf', '.jpg', '.jpeg', '.png', '.webp',
  'application/pdf', 'image/jpeg', 'image/png', 'image/webp',
].join(',');
export const DOCUMENT_CONTENT_TYPES = Object.freeze([
  'application/pdf', 'image/jpeg', 'image/png', 'image/webp',
]);

const contentTypeByExtension = Object.freeze({
  jpeg: 'image/jpeg', jpg: 'image/jpeg', pdf: 'application/pdf',
  png: 'image/png', webp: 'image/webp',
});

export function getDocumentContentType(file) {
  const declaredType = typeof file?.type === 'string' ? file.type.trim().toLowerCase() : '';
  if (declaredType) return declaredType;
  const extension = typeof file?.name === 'string' ? file.name.split('.').pop()?.toLowerCase() : '';
  return contentTypeByExtension[extension] ?? '';
}

export function formatDocumentSize(sizeBytes) {
  const size = Number(sizeBytes);
  if (!Number.isFinite(size) || size < 0) return 'Tamaño no disponible';
  if (size < 1_024) return `${size} B`;
  const units = [['MiB', 1_024 * 1_024], ['KiB', 1_024]];
  const [unit, divisor] = units.find(([, threshold]) => size >= threshold);
  const value = size / divisor;
  return `${new Intl.NumberFormat('es-ES', { maximumFractionDigits: value >= 10 ? 0 : 1 }).format(value)} ${unit}`;
}
