import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Eye, File, FileText, Pencil, Plus, Receipt, ShieldCheck, Trash2 } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';

import { queryKeys } from '../../api/queryKeys';
import { ErrorState, SuccessNotice } from '../../components/ui/FeedbackStates';
import { AuthError } from '../auth/components/AuthFeedback';
import { PurchaseConfirmation } from './PurchaseConfirmation';
import { PurchaseDocumentForm } from './PurchaseDocumentForm';
import { PurchaseDocumentAnalysisPanel } from './PurchaseDocumentAnalysisPanel';
import { PURCHASE_DOCUMENT_TYPES, formatDocumentSize } from './purchaseDocumentSchema';
import { purchaseDocumentsService } from './purchaseDocumentsService';

const secondaryButton = 'inline-flex min-h-11 min-w-0 max-w-full items-center justify-center gap-2 rounded-xl border border-border-strong px-3 py-2 text-sm font-bold text-text hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-60';
const downloadLifetimeMs = 60_000;
const icons = { RECEIPT: Receipt, INVOICE: FileText, WARRANTY: ShieldCheck, OTHER: File };
const noDocuments = [];

function dateLabel(value) {
  const date = new Date(value);
  return value && Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' }).format(date) : 'Fecha no disponible';
}

function DocumentsContent({ householdId, purchase, currency, disabled, onBusyChange }) {
  const purchaseId = purchase.id;
  const items = purchase.items ?? [];
  const queryClient = useQueryClient();
  const titleId = useId();
  const containerRef = useRef(null);
  const headingRef = useRef(null);
  const focusTargetRef = useRef(null);
  const restoreFocusRef = useRef(false);
  const mountedRef = useRef(true);
  const actionRef = useRef(false);
  const downloadRef = useRef(false);
  const urlsRef = useRef(new Map());
  const [form, setForm] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [success, setSuccess] = useState(null);
  const [downloadError, setDownloadError] = useState(null);
  const [activeAnalysisId, setActiveAnalysisId] = useState(null);
  const documentsQuery = useQuery({
    queryKey: queryKeys.purchases.documents(householdId, purchaseId),
    queryFn: ({ signal }) => purchaseDocumentsService.list({ householdId, purchaseId, signal }),
  });
  const documents = documentsQuery.data ?? noDocuments;
  const accessUnavailable = documentsQuery.isError && [401, 403, 404].includes(documentsQuery.error?.status);
  useEffect(() => {
    onBusyChange?.(Boolean(activeAnalysisId));
    return () => { onBusyChange?.(false); };
  }, [activeAnalysisId, onBusyChange]);
  useEffect(() => {
    if (activeAnalysisId && (documentsQuery.isError || (documentsQuery.isSuccess && !documents.some((document) => document.id === activeAnalysisId)))) {
      setActiveAnalysisId(null);
      headingRef.current?.focus();
    }
  }, [activeAnalysisId, documents, documentsQuery.isError, documentsQuery.isSuccess]);

  useEffect(() => {
    mountedRef.current = true;
    const urls = urlsRef.current;
    return () => {
      mountedRef.current = false;
      for (const [url, timer] of urls) { window.clearTimeout(timer); URL.revokeObjectURL(url); }
      urls.clear();
    };
  }, []);

  useEffect(() => {
    if (!form && !pendingDelete && restoreFocusRef.current) {
      const target = [...(containerRef.current?.querySelectorAll('[data-document-trigger]') ?? [])].find((node) => node.dataset.documentTrigger === focusTargetRef.current);
      (target ?? headingRef.current)?.focus();
      restoreFocusRef.current = false;
    }
  }, [form, pendingDelete]);

  async function finish(message) {
    await queryClient.invalidateQueries({ queryKey: queryKeys.purchases.documents(householdId, purchaseId), exact: true, ...(!mountedRef.current ? { refetchType: 'none' } : {}) });
    if (!mountedRef.current) return;
    restoreFocusRef.current = true;
    setForm(null);
    setPendingDelete(null);
    setSuccess(message);
  }
  const upload = useMutation({ mutationFn: purchaseDocumentsService.upload, onSuccess: () => finish('Documento añadido.') });
  const update = useMutation({ mutationFn: purchaseDocumentsService.update, onSuccess: () => finish('Documento actualizado.') });
  const remove = useMutation({ mutationFn: purchaseDocumentsService.remove, onSuccess: async (_, { documentId }) => {
    await queryClient.cancelQueries({ queryKey: queryKeys.purchases.analyses(householdId, purchaseId, documentId), exact: true });
    queryClient.removeQueries({ queryKey: queryKeys.purchases.analyses(householdId, purchaseId, documentId), exact: true });
    await finish('Documento eliminado.');
  } });
  const download = useMutation({ mutationFn: purchaseDocumentsService.content });
  const busy = upload.isPending || update.isPending || remove.isPending;

  function startForm(document = null) {
    if (actionRef.current) return;
    focusTargetRef.current = document ? `edit:${document.id}` : 'add';
    upload.reset(); update.reset();
    setSuccess(null);
    setForm({ document });
  }
  function closeForm() { restoreFocusRef.current = true; setForm(null); }
  async function save(values) {
    if (actionRef.current) return;
    actionRef.current = true;
    try {
      if (form.document) await update.mutateAsync({ householdId, purchaseId, documentId: form.document.id, body: values });
      else await upload.mutateAsync({ householdId, purchaseId, ...values });
    } finally { actionRef.current = false; }
  }
  function confirmDelete(document) {
    if (actionRef.current) return;
    focusTargetRef.current = `delete:${document.id}`;
    remove.reset(); setSuccess(null); setPendingDelete(document);
  }
  async function deleteDocument() {
    if (actionRef.current || !pendingDelete) return;
    actionRef.current = true;
    try { await remove.mutateAsync({ householdId, purchaseId, documentId: pendingDelete.id }); }
    catch { /* The confirmation keeps the normalized error and permits retry. */ }
    finally { actionRef.current = false; }
  }
  async function downloadDocument(document) {
    if (downloadRef.current) return;
    downloadRef.current = true;
    setDownloadError(null);
    setSuccess(null);
    let url = null;
    let link = null;
    try {
      const blob = await download.mutateAsync({ householdId, purchaseId, documentId: document.id });
      if (!mountedRef.current) return;
      url = URL.createObjectURL(blob);
      link = window.document.createElement('a');
      link.href = url;
      link.download = Array.from(document.filename).map((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127 || ['/', '\\'].includes(character) ? '_' : character).join('');
      link.rel = 'noopener';
      link.hidden = true;
      window.document.body.append(link);
      link.click();
      link.remove();
      link = null;
      const timer = window.setTimeout(() => { URL.revokeObjectURL(url); urlsRef.current.delete(url); }, downloadLifetimeMs);
      urlsRef.current.set(url, timer);
      setSuccess('Descarga iniciada. Comprueba las descargas de tu navegador.');
    } catch (error) {
      link?.remove();
      if (url) URL.revokeObjectURL(url);
      if (mountedRef.current) setDownloadError(error);
    } finally { downloadRef.current = false; }
  }

  return (
    <section aria-labelledby={titleId} className="min-w-0 space-y-4 [overflow-wrap:anywhere]" ref={containerRef}>
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="rounded-lg text-xl font-extrabold focus:outline-2 focus:outline-focus" id={titleId} ref={headingRef} tabIndex={-1}>Documentos{documentsQuery.isSuccess ? ` (${documents.length})` : ''}</h2>
        <button className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-extrabold text-on-brand hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-60" data-document-trigger="add" disabled={Boolean(form) || busy || documentsQuery.isError} onClick={() => startForm()} type="button"><Plus aria-hidden="true" className="size-4 shrink-0" />Añadir documento</button>
      </div>
      <p className="text-sm leading-6 text-text-muted">Tickets, facturas y garantías privados. Solo pueden acceder quienes pueden ver esta compra. Guardarlos no modifica el presupuesto ni los saldos.</p>
      {documentsQuery.isPending ? <p aria-live="polite" className="text-sm font-semibold text-text-muted" role="status">Cargando documentos…</p> : null}
      {documentsQuery.isError ? <ErrorState title="No se han podido cargar los documentos" description={documentsQuery.error.message} onRetry={documentsQuery.refetch} /> : null}
      {success ? <SuccessNotice title={success} /> : null}
      <AuthError error={downloadError} />
      {form && !accessUnavailable ? <PurchaseDocumentForm error={form.document ? update.error : upload.error} initialDocument={form.document} isPending={form.document ? update.isPending : upload.isPending} items={items} key={form.document?.id ?? 'new'} onCancel={closeForm} onSubmit={save} /> : null}
      {documentsQuery.isSuccess && !documents.length ? <div className="rounded-2xl border border-dashed border-border-strong bg-surface p-5 text-sm text-text-muted">No hay documentos guardados.</div> : null}
      {documentsQuery.isSuccess && documents.length ? <ul aria-label="Documentos de la compra" className="min-w-0 space-y-3">
        {documents.map((document) => {
          const Icon = icons[document.type] ?? File;
          const type = PURCHASE_DOCUMENT_TYPES.find((entry) => entry.value === document.type)?.label ?? 'Otro';
          const item = items.find((entry) => entry.id === document.purchaseItemId);
          const isDownloading = download.isPending && download.variables?.documentId === document.id;
          return <li className="min-w-0 rounded-2xl border border-border bg-surface p-4 shadow-card sm:p-5" key={document.id}>
            <div className="flex min-w-0 items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand-strong"><Icon aria-hidden="true" className="size-5" /></span>
              <div className="min-w-0 flex-1">
                <h3 className="break-words font-extrabold [overflow-wrap:anywhere]">{document.filename}</h3>
                <p className="mt-1 text-sm leading-6 text-text-muted">{type} · {formatDocumentSize(document.sizeBytes)} · <time dateTime={document.createdAt}>{dateLabel(document.createdAt)}</time></p>
                <p className="mt-1 break-words text-sm text-text-muted [overflow-wrap:anywhere]">{document.purchaseItemId ? `Producto: ${item?.name ?? 'Producto de la compra'}` : 'Compra completa'}</p>
              </div>
            </div>
            <div className="mt-4 grid min-w-0 grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              <a aria-label={`Ver ${document.filename} (abre otra pestaña)`} className={secondaryButton} href={purchaseDocumentsService.contentUrl({ householdId, purchaseId, documentId: document.id, disposition: 'inline' })} rel="noopener noreferrer" target="_blank"><Eye aria-hidden="true" className="size-4 shrink-0" />Ver</a>
              <button aria-label={`Descargar ${document.filename}`} className={secondaryButton} disabled={download.isPending || busy} onClick={() => downloadDocument(document)} type="button"><Download aria-hidden="true" className="size-4 shrink-0" /><span className="min-w-0 break-words">{isDownloading ? 'Descargando…' : 'Descargar'}</span></button>
              <button aria-label={`Editar ${document.filename}`} className={secondaryButton} data-document-trigger={`edit:${document.id}`} disabled={Boolean(form) || busy || activeAnalysisId === document.id} onClick={() => startForm(document)} type="button"><Pencil aria-hidden="true" className="size-4 shrink-0" />Editar</button>
              <button aria-label={`Eliminar ${document.filename}`} className={`${secondaryButton} border-red-200 text-red-800 hover:bg-red-50`} data-document-trigger={`delete:${document.id}`} disabled={Boolean(form) || busy || activeAnalysisId === document.id} onClick={() => confirmDelete(document)} type="button"><Trash2 aria-hidden="true" className="size-4 shrink-0" />Eliminar</button>
            </div>
            <PurchaseDocumentAnalysisPanel active={activeAnalysisId === document.id} currency={currency} disabled={disabled || busy || Boolean(form || pendingDelete) || Boolean(activeAnalysisId && activeAnalysisId !== document.id)} document={document} householdId={householdId} onClose={() => setActiveAnalysisId(null)} onOpen={() => setActiveAnalysisId(document.id)} purchase={purchase} />
          </li>;
        })}
      </ul> : null}
      {pendingDelete && !accessUnavailable ? <PurchaseConfirmation title="¿Eliminar documento?" description={`Se eliminará «${pendingDelete.filename}» de forma definitiva para todas las personas con acceso a esta compra. La compra, sus productos y garantías no cambian.`} confirmLabel="Eliminar documento" error={remove.error} isPending={remove.isPending} onCancel={() => { restoreFocusRef.current = true; setPendingDelete(null); }} onConfirm={deleteDocument} /> : null}
    </section>
  );
}

export function PurchaseDocumentsPanel({ householdId, purchase, currency = 'EUR', disabled = false, onBusyChange }) {
  return <DocumentsContent currency={currency} disabled={disabled} householdId={householdId} key={`${householdId}:${purchase.id}`} onBusyChange={onBusyChange} purchase={purchase} />;
}
