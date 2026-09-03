import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Download,
  FileImage,
  FileText,
  Paperclip,
  Trash2,
  TriangleAlert,
  Upload,
} from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import toast from 'react-hot-toast';

import { queryKeys } from '../../api/queryKeys';
import { SuccessNotice } from '../../components/ui/FeedbackStates';
import { AuthError } from '../auth/components/AuthFeedback';
import { financeService } from './financeService';
import {
  INVOICE_DOCUMENT_ACCEPT,
  INVOICE_DOCUMENT_MAX_COUNT,
  formatDocumentSize,
  validateInvoiceDocumentSelection,
} from './invoiceDocumentSchema';

const BLOB_URL_REVOKE_DELAY_MS = 60_000;

function documentName(document) {
  return document.filename || 'Documento sin nombre';
}

function documentTypeLabel(contentType) {
  const labels = {
    'application/pdf': 'PDF',
    'image/jpeg': 'JPEG',
    'image/png': 'PNG',
    'image/webp': 'WebP',
  };
  return labels[contentType] ?? contentType ?? 'Tipo no disponible';
}

function formatUploadedAt(value) {
  if (!value) return 'Fecha no disponible';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Fecha no disponible';

  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function InlineQueryError({ error, onRetry }) {
  return (
    <div
      className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-950"
      role="alert"
    >
      <div className="flex items-start gap-3">
        <TriangleAlert
          aria-hidden="true"
          className="mt-0.5 size-5 shrink-0 text-red-700"
        />
        <div>
          <p className="text-sm font-bold">No se han podido cargar los documentos</p>
          <p className="mt-1 text-sm leading-5">{error.message}</p>
          <button
            className="mt-3 inline-flex min-h-11 items-center rounded-lg border border-red-300 bg-surface px-3 text-sm font-bold text-red-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
            onClick={onRetry}
            type="button"
          >
            Reintentar carga
          </button>
        </div>
      </div>
    </div>
  );
}

export function InvoiceDocumentsPanel({ householdId, invoice }) {
  const queryClient = useQueryClient();
  const panelId = useId();
  const fileInputId = useId();
  const helpId = useId();
  const privacyHelpId = useId();
  const cancelDeleteRef = useRef(null);
  const fileInputRef = useRef(null);
  const [expanded, setExpanded] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [partialUploadMessage, setPartialUploadMessage] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [selectionError, setSelectionError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [downloadError, setDownloadError] = useState(null);
  const documentsQuery = useQuery({
    enabled: expanded,
    queryFn: () => financeService.invoiceDocuments({
      householdId,
      invoiceId: invoice.id,
    }),
    queryKey: queryKeys.invoices.documents(householdId, invoice.id),
  });
  const documents = documentsQuery.data ?? [];
  const visibleCount = documentsQuery.data?.length ?? invoice.documentCount ?? 0;

  function resetFileInput() {
    setSelectedFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function refreshDocuments() {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: queryKeys.invoices.documents(householdId, invoice.id),
      }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.invoices.all(householdId),
      }),
    ]);
  }

  const uploadDocuments = useMutation({
    mutationFn: async (files) => {
      const uploaded = [];

      for (const file of files) {
        try {
          uploaded.push(await financeService.uploadInvoiceDocument({
            file,
            householdId,
            invoiceId: invoice.id,
          }));
        } catch (error) {
          const partialError = new Error(
            error?.message ?? 'No se han podido subir todos los documentos.',
          );
          Object.assign(partialError, error, {
            cause: error,
            uploadedCount: uploaded.length,
          });
          throw partialError;
        }
      }

      return uploaded;
    },
    onError: async (error) => {
      const uploadedCount = error?.uploadedCount ?? 0;
      setPartialUploadMessage(uploadedCount > 0
        ? `${uploadedCount === 1 ? 'Se subió 1 documento' : `Se subieron ${uploadedCount} documentos`}; los restantes no se subieron. Revisa el error y vuelve a seleccionar solo los que falten.`
        : null);
      resetFileInput();
      await refreshDocuments();
    },
    onMutate: () => {
      setPartialUploadMessage(null);
      setSelectionError(null);
      setSuccessMessage(null);
    },
    onSuccess: async (uploaded) => {
      setPartialUploadMessage(null);
      resetFileInput();
      await refreshDocuments();
      const count = uploaded.length;
      setSuccessMessage(
        `${count} ${count === 1 ? 'documento subido' : 'documentos subidos'} correctamente.`,
      );
      toast.success(count === 1 ? 'Documento añadido.' : 'Documentos añadidos.');
    },
  });

  const deleteDocument = useMutation({
    mutationFn: financeService.deleteInvoiceDocument,
    onMutate: () => {
      setSuccessMessage(null);
    },
    onSuccess: async () => {
      const deletedName = pendingDelete ? documentName(pendingDelete) : 'El documento';
      setPendingDelete(null);
      await refreshDocuments();
      setSuccessMessage(`${deletedName} se ha eliminado de la factura.`);
      toast.success('Documento eliminado.');
    },
  });

  const downloadDocument = useMutation({
    mutationFn: financeService.invoiceDocumentContent,
  });

  useEffect(() => {
    if (pendingDelete) cancelDeleteRef.current?.focus();
  }, [pendingDelete]);

  function handleFileSelection(event) {
    uploadDocuments.reset();
    setPartialUploadMessage(null);
    setSelectionError(null);
    setSuccessMessage(null);

    const result = validateInvoiceDocumentSelection(
      event.target.files,
      documents.length,
    );

    if (result.error) {
      setSelectionError(result.error);
      setSelectedFiles([]);
      event.target.value = '';
      return;
    }

    setSelectedFiles(result.files);
  }

  async function handleUpload(event) {
    event.preventDefault();
    if (selectedFiles.length === 0) return;

    try {
      await uploadDocuments.mutateAsync(selectedFiles);
    } catch {
      // React Query conserva el error normalizado para mostrarlo en el panel.
    }
  }

  async function handleDelete() {
    if (!pendingDelete) return;

    try {
      await deleteDocument.mutateAsync({
        documentId: pendingDelete.id,
        householdId,
        invoiceId: invoice.id,
      });
    } catch {
      // React Query conserva el error normalizado para mostrarlo en el panel.
    }
  }

  async function handleDownload(document) {
    setDownloadError(null);
    setSuccessMessage(null);
    downloadDocument.reset();

    let blobUrl = null;
    let revokeScheduled = false;
    let downloadLink = null;

    try {
      const blob = await downloadDocument.mutateAsync({
        documentId: document.id,
        householdId,
        invoiceId: invoice.id,
      });
      blobUrl = URL.createObjectURL(blob);
      downloadLink = window.document.createElement('a');
      downloadLink.download = documentName(document).replaceAll(/[\\/]/g, '_');
      downloadLink.href = blobUrl;
      downloadLink.hidden = true;
      downloadLink.rel = 'noopener';
      window.document.body.append(downloadLink);
      downloadLink.click();
      downloadLink.remove();
      downloadLink = null;
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), BLOB_URL_REVOKE_DELAY_MS);
      revokeScheduled = true;
      setSuccessMessage(`${documentName(document)} se ha descargado para que puedas revisarlo.`);
    } catch (error) {
      downloadLink?.remove();
      if (blobUrl && !revokeScheduled) URL.revokeObjectURL(blobUrl);
      setDownloadError(
        error?.message ?? 'No se ha podido descargar el documento.',
      );
    }
  }

  function startDelete(document) {
    deleteDocument.reset();
    setSuccessMessage(null);
    setPendingDelete(document);
  }

  function cancelDelete() {
    deleteDocument.reset();
    setPendingDelete(null);
  }

  const uploadLimitReached = documents.length >= INVOICE_DOCUMENT_MAX_COUNT;

  return (
    <div className="border-t border-border pt-4">
      <button
        aria-controls={panelId}
        aria-expanded={expanded}
        className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border-strong bg-surface px-3.5 py-2 text-sm font-bold text-text shadow-sm hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        onClick={() => setExpanded((current) => !current)}
        type="button"
      >
        <Paperclip aria-hidden="true" className="size-4" />
        {expanded ? 'Ocultar adjuntos' : 'Gestionar adjuntos'}
        <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs text-brand-strong">
          {visibleCount}/{INVOICE_DOCUMENT_MAX_COUNT}
        </span>
      </button>

      {expanded ? (
        <section
          aria-labelledby={`${panelId}-title`}
          className="mt-4 space-y-5 rounded-2xl bg-surface-muted p-4 sm:p-5"
          id={panelId}
        >
          <div>
            <h4 className="font-extrabold text-text" id={`${panelId}-title`}>
              Documentos de esta factura
            </h4>
            <p
              className="mt-1 text-sm leading-6 text-text-muted"
              id={privacyHelpId}
            >
              Los adjuntos son opcionales. Cada miembro activo con acceso al hogar puede verlos y eliminarlos. Antes de subirlos, quita datos personales o sensibles que no sean necesarios.
            </p>
            <p className="mt-1 text-xs leading-5 text-text-soft">
              Por seguridad, los documentos se descargan en tu dispositivo antes de abrirlos.
            </p>
          </div>

          {documentsQuery.isPending ? (
            <p
              aria-live="polite"
              className="text-sm font-semibold text-text-muted"
              role="status"
            >
              Cargando documentos…
            </p>
          ) : null}

          {documentsQuery.isError ? (
            <InlineQueryError
              error={documentsQuery.error}
              onRetry={documentsQuery.refetch}
            />
          ) : null}

          {documentsQuery.isSuccess ? (
            <>
              {documents.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border-strong bg-surface p-4">
                  <p className="text-sm font-bold text-text">Todavía no hay documentos</p>
                  <p className="mt-1 text-sm leading-5 text-text-muted">
                    Puedes conservar la factura sin adjuntos o añadirlos más abajo.
                  </p>
                </div>
              ) : (
                <ul className="space-y-3" aria-label="Documentos adjuntos">
                  {documents.map((document) => {
                    const name = documentName(document);
                    const isImage = document.contentType?.startsWith('image/');
                    const isDownloading = downloadDocument.isPending
                      && downloadDocument.variables?.documentId === document.id;

                    return (
                      <li
                        className="rounded-xl border border-border bg-surface p-4"
                        key={document.id}
                      >
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand-strong">
                            {isImage ? (
                              <FileImage aria-hidden="true" className="size-5" />
                            ) : (
                              <FileText aria-hidden="true" className="size-5" />
                            )}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="break-words text-sm font-extrabold text-text">{name}</p>
                            <p className="mt-1 text-xs leading-5 text-text-muted">
                              {documentTypeLabel(document.contentType)} ·{' '}
                              {formatDocumentSize(document.sizeBytes)} ·{' '}
                              {formatUploadedAt(document.createdAt)}
                            </p>
                            {document.uploadedBy?.name ? (
                              <p className="mt-0.5 text-xs text-text-soft">
                                Subido por {document.uploadedBy.name}
                              </p>
                            ) : null}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              aria-label={`Descargar ${name}`}
                              className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border-strong px-3 text-sm font-bold text-brand-strong hover:bg-brand-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-wait disabled:opacity-60"
                              disabled={downloadDocument.isPending}
                              onClick={() => handleDownload(document)}
                              type="button"
                            >
                              <Download aria-hidden="true" className="size-4" />
                              {isDownloading ? 'Descargando…' : 'Descargar'}
                            </button>
                            <button
                              aria-label={`Eliminar ${name}`}
                              className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-red-300 px-3 text-sm font-bold text-red-800 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 disabled:cursor-wait disabled:opacity-60"
                              disabled={deleteDocument.isPending}
                              onClick={() => startDelete(document)}
                              type="button"
                            >
                              <Trash2 aria-hidden="true" className="size-4" />
                              Eliminar
                            </button>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}

          {pendingDelete ? (
                <div
                  aria-live="assertive"
                  className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-950"
                  role="alert"
                >
                  <p className="font-bold">¿Eliminar {documentName(pendingDelete)}?</p>
                  <p className="mt-1 text-sm leading-5">
                    Dejará de estar disponible para todos los miembros del hogar. La factura y sus importes no se eliminarán.
                  </p>
                  <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <button
                      className="min-h-11 rounded-lg border border-border-strong bg-surface px-4 text-sm font-bold text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                      disabled={deleteDocument.isPending}
                      onClick={cancelDelete}
                      ref={cancelDeleteRef}
                      type="button"
                    >
                      Conservar documento
                    </button>
                    <button
                      className="min-h-11 rounded-lg bg-red-700 px-4 text-sm font-bold text-white hover:bg-red-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 disabled:cursor-wait disabled:opacity-60"
                      disabled={deleteDocument.isPending}
                      onClick={handleDelete}
                      type="button"
                    >
                      {deleteDocument.isPending ? 'Eliminando…' : 'Eliminar documento'}
                    </button>
                  </div>
                </div>
          ) : null}

          <form className="space-y-3" noValidate onSubmit={handleUpload}>
                <div>
                  <label className="block text-sm font-bold text-text" htmlFor={fileInputId}>
                    Añadir documentos (opcional)
                  </label>
                  <p className="mt-1 text-xs leading-5 text-text-muted" id={helpId}>
                    PDF, JPEG, PNG o WebP · máximo 10 MiB por archivo · hasta 5 por factura.
                  </p>
                  <input
                    accept={INVOICE_DOCUMENT_ACCEPT}
                    aria-describedby={`${privacyHelpId} ${helpId}`}
                    className="mt-3 block min-h-12 w-full cursor-pointer rounded-xl border border-border-strong bg-surface px-3 py-2 text-sm text-text file:mr-3 file:rounded-lg file:border-0 file:bg-brand-soft file:px-3 file:py-2 file:font-bold file:text-brand-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={uploadLimitReached || uploadDocuments.isPending}
                    id={fileInputId}
                    multiple
                    onChange={handleFileSelection}
                    ref={fileInputRef}
                    type="file"
                  />
                </div>

                {uploadLimitReached ? (
                  <p className="text-sm font-semibold text-text-muted" role="status">
                    Esta factura ya tiene el máximo de 5 documentos.
                  </p>
                ) : null}

                {selectedFiles.length > 0 ? (
                  <div className="rounded-xl border border-border bg-surface p-3">
                    <p className="text-sm font-bold text-text">
                      {selectedFiles.length}{' '}
                      {selectedFiles.length === 1 ? 'documento seleccionado' : 'documentos seleccionados'}
                    </p>
                    <ul className="mt-2 space-y-1 text-xs text-text-muted">
                      {selectedFiles.map((file) => (
                        <li className="break-words" key={`${file.name}-${file.size}`}>
                          {file.name} · {formatDocumentSize(file.size)}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {selectionError ? (
                  <p className="text-sm font-semibold text-red-700" role="alert">
                    {selectionError}
                  </p>
                ) : null}
                {partialUploadMessage ? (
                  <p
                    className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm font-semibold leading-5 text-amber-950"
                    role="alert"
                  >
                    {partialUploadMessage}
                  </p>
                ) : null}
                <AuthError error={uploadDocuments.error} />
                <AuthError error={deleteDocument.error} />
                {downloadError ? (
                  <p className="text-sm font-semibold text-red-700" role="alert">
                    {downloadError}
                  </p>
                ) : null}
                {successMessage ? (
                  <SuccessNotice description={successMessage} title="Documentos actualizados" />
                ) : null}

                {selectedFiles.length > 0 ? (
                  <button
                    className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-extrabold text-on-brand hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-wait disabled:opacity-65 sm:w-auto"
                    disabled={uploadDocuments.isPending}
                    type="submit"
                  >
                    <Upload aria-hidden="true" className="size-4" />
                    {uploadDocuments.isPending
                      ? 'Subiendo documentos…'
                      : `Subir ${selectedFiles.length === 1 ? 'documento' : 'documentos'}`}
                  </button>
                ) : null}
              </form>
            </>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
