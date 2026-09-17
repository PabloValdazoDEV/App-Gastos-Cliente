import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Sparkles } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';

import { queryKeys } from '../../api/queryKeys';
import { ErrorState, LoadingState, SuccessNotice } from '../../components/ui/FeedbackStates';
import { PurchaseDocumentAnalysisReview } from './PurchaseDocumentAnalysisReview';
import { analysisDocumentSupported } from './purchaseAnalysisReviewState';
import { invalidatePurchaseAnalysisConfirmation, purchaseDocumentAnalysesService } from './purchaseDocumentAnalysesService';

const button = 'inline-flex min-h-11 min-w-0 max-w-full items-center justify-center gap-2 rounded-xl border border-border-strong px-3 py-2.5 text-sm font-bold hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-60';
const primary = 'inline-flex min-h-11 min-w-0 max-w-full items-center justify-center rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-on-brand hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:opacity-60';
const unavailable = (error) => [401, 403, 404].includes(error?.status);
const statusLabels = { COMPLETED: 'Sin confirmar', CONFIRMED: 'Confirmado', FAILED: 'No completado' };
function analysisDate(value) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' }).format(date) : 'Fecha no disponible';
}
function safeAnalysisError(error) {
  if (!error) return null;
  if (error.code === 'AI_NOT_CONFIGURED') return 'El análisis con IA no está configurado. Puedes seguir gestionando esta compra sin IA.';
  if (error.status === 429) return 'Has realizado varios análisis en poco tiempo. Inténtalo más tarde.';
  if (unavailable(error)) return 'El documento ya no está disponible o no tienes permiso para consultarlo.';
  return 'No se ha podido analizar el documento. Inténtalo de nuevo.';
}

function AnalysisWorkspace({ householdId, purchase, document, currency, initialAction, disabled, onClose }) {
  const queryClient = useQueryClient();
  const mounted = useRef(true);
  const lock = useRef(false);
  const promptCancelRef = useRef(null);
  const headingRef = useRef(null);
  const closeRef = useRef(null);
  const [selected, setSelected] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [prompt, setPrompt] = useState(initialAction === 'analyze' ? { kind: 'analyze' } : null);
  const [accessError, setAccessError] = useState(null);
  const [stale, setStale] = useState(false);
  const [success, setSuccess] = useState(null);
  const ids = { householdId, purchaseId: purchase.id, documentId: document.id };
  const analysesKey = queryKeys.purchases.analyses(householdId, purchase.id, document.id);
  const history = useQuery({
    queryKey: analysesKey, queryFn: ({ signal }) => purchaseDocumentAnalysesService.list({ ...ids, signal }),
    staleTime: 0, gcTime: 0, refetchOnMount: 'always', retry: false,
  });
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      queryClient.cancelQueries({ queryKey: queryKeys.purchases.analyses(householdId, purchase.id, document.id), exact: true });
      queryClient.removeQueries({ queryKey: queryKeys.purchases.analyses(householdId, purchase.id, document.id), exact: true });
    };
  }, [householdId, purchase.id, document.id, queryClient]);
  useEffect(() => { headingRef.current?.focus(); }, []);
  useEffect(() => { if (prompt) promptCancelRef.current?.focus(); }, [prompt]);
  useEffect(() => { if (accessError) closeRef.current?.focus(); }, [accessError]);
  useEffect(() => {
    if (history.isError && unavailable(history.error)) {
      setAccessError(history.error);
      queryClient.invalidateQueries({ queryKey: queryKeys.purchases.documents(householdId, purchase.id), exact: true });
      queryClient.invalidateQueries({ queryKey: queryKeys.purchases.detail(householdId, purchase.id), exact: true });
    }
  }, [history.isError, history.error, householdId, purchase.id, queryClient]);

  async function invalidateHistory() {
    await queryClient.invalidateQueries({ queryKey: analysesKey, exact: true, ...(!mounted.current ? { refetchType: 'none' } : {}) });
  }
  const analyze = useMutation({
    mutationFn: purchaseDocumentAnalysesService.analyze, retry: false,
    onSuccess: async (analysis) => {
      if (mounted.current) { setSelected(analysis); setDirty(false); setStale(false); setSuccess(null); }
      await invalidateHistory();
    },
    onError: async (error) => { if (mounted.current && unavailable(error)) setAccessError(error); await invalidateHistory(); },
  });
  const confirm = useMutation({
    mutationFn: purchaseDocumentAnalysesService.confirm, retry: false,
    onSuccess: async (result) => {
      if (mounted.current) {
        queryClient.setQueryData(queryKeys.purchases.detail(householdId, purchase.id), result.purchase);
        setSelected(result.analysis); setDirty(false); setSuccess('Datos confirmados. Los productos existentes y su historial se conservan.');
      }
      await invalidatePurchaseAnalysisConfirmation(queryClient, householdId, purchase.id, document.id, { active: mounted.current });
      if (mounted.current) headingRef.current?.focus();
    },
    onError: async (error) => {
      if (mounted.current && unavailable(error)) setAccessError(error);
      if (error.status === 409) {
        if (mounted.current) setStale(true);
        await invalidatePurchaseAnalysisConfirmation(queryClient, householdId, purchase.id, document.id, { active: mounted.current });
      }
    },
  });
  const busy = analyze.isPending || confirm.isPending;
  const authorizedHistory = history.isSuccess && !(history.isFetching && !history.isFetchedAfterMount);
  useEffect(() => {
    if (authorizedHistory && !selected && !analyze.isPending) setSelected(history.data?.[0] ?? null);
  }, [authorizedHistory, history.data, selected, analyze.isPending]);

  function choose(analysis) {
    setSelected(analysis); setDirty(false); setStale(false); setSuccess(null); confirm.reset(); analyze.reset(); setPrompt(null);
  }
  function requestChoice(analysis) {
    if (busy || disabled || !analysis) return;
    if (dirty) setPrompt({ kind: 'switch', analysis });
    else choose(analysis);
  }
  async function startAnalysis() {
    if (lock.current || busy || disabled) return;
    lock.current = true;
    setPrompt(null); setSuccess(null); analyze.reset();
    try { await analyze.mutateAsync(ids); }
    catch { /* Keep the existing draft and show a safe provider error. */ }
    finally { lock.current = false; }
  }
  async function save(body) {
    if (lock.current || busy || disabled || stale) return;
    lock.current = true;
    try { await confirm.mutateAsync({ ...ids, analysisId: selected.id, body }); }
    finally { lock.current = false; }
  }
  const closeButton = <button className={button} disabled={busy} onClick={onClose} ref={closeRef} type="button">Cerrar análisis</button>;
  if (accessError) return <div className="mt-4 space-y-3"><ErrorState title="Análisis no disponible" description={safeAnalysisError(accessError)} />{closeButton}</div>;

  return <section aria-label={`Análisis de ${document.filename}`} className="mt-4 min-w-0 space-y-5 rounded-xl border border-border bg-surface-muted p-4 [overflow-wrap:anywhere] sm:p-5">
    <h3 className="rounded-lg text-lg font-bold focus:outline-2 focus:outline-focus" ref={headingRef} tabIndex={-1}>Análisis del documento</h3>
    {prompt ? <section aria-label={prompt.kind === 'analyze' ? 'Confirmar envío a OpenAI' : 'Confirmar cambio de revisión'} className="min-w-0 space-y-3 rounded-xl border border-border-strong bg-surface p-4">
      <h4 className="font-bold">{prompt.kind === 'analyze' ? '¿Analizar este documento con IA?' : '¿Descartar los cambios de esta revisión?'}</h4>
      <p className="text-sm leading-6">{prompt.kind === 'analyze' ? 'Se enviará una copia a OpenAI para extraer datos. El documento original se conserva privado en BudgetApp. Esta operación puede tener coste; no se guardará nada en la compra sin tu confirmación.' : 'Solo se descarta el borrador que has editado. El análisis y el documento original se conservan.'}</p>
      {prompt.kind === 'analyze' && dirty ? <p className="text-sm font-semibold">Si el nuevo análisis se completa, sustituirá este borrador sin guardar. Los análisis anteriores se conservan.</p> : null}
      <div className="flex min-w-0 flex-col-reverse gap-2 sm:flex-row"><button className={button} disabled={busy} onClick={() => { setPrompt(null); headingRef.current?.focus(); }} ref={promptCancelRef} type="button">Cancelar</button><button className={primary} disabled={busy || disabled} onClick={() => prompt.kind === 'analyze' ? startAnalysis() : choose(prompt.analysis)} type="button">{prompt.kind === 'analyze' ? 'Enviar a OpenAI y analizar' : 'Descartar borrador y revisar'}</button></div>
    </section> : null}
    {analyze.isPending ? <p aria-live="polite" className="rounded-xl bg-brand-soft p-4 text-sm font-bold text-brand-strong" role="status">Analizando documento… Puedes seguir navegando; encontrarás el resultado en el historial cuando termine.</p> : null}
    {analyze.error ? <ErrorState title="No se ha podido analizar el documento" description={safeAnalysisError(analyze.error)} /> : null}
    {success ? <SuccessNotice title={success} /> : null}
    {history.isPending || (history.isFetching && !history.isFetchedAfterMount) ? <LoadingState label="Cargando análisis guardados" /> : history.isError ? <ErrorState title="No se han podido cargar los análisis guardados" description="Inténtalo de nuevo para consultar el historial de este documento." onRetry={history.refetch} /> : null}
    {authorizedHistory && history.data?.length ? <div className="min-w-0"><label className="mb-1.5 block text-sm font-bold" htmlFor={`analysis-history-${document.id}`}>Análisis guardados</label><select className="min-h-12 w-full min-w-0 max-w-full rounded-xl border border-border-strong bg-surface px-3 text-base" disabled={busy || disabled || Boolean(prompt)} id={`analysis-history-${document.id}`} onChange={(event) => requestChoice(history.data.find((analysis) => analysis.id === event.target.value))} value={selected?.id ?? history.data[0].id}>{history.data.map((analysis, index) => <option key={analysis.id} value={analysis.id}>{index === 0 ? 'Más reciente · ' : ''}{analysisDate(analysis.createdAt)} · {statusLabels[analysis.status] ?? 'Estado no disponible'}</option>)}</select></div> : null}
    {stale ? <div className="min-w-0 space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-950"><p className="text-sm" role="alert">La compra ha cambiado desde que abriste esta revisión. Revisa la versión actual antes de confirmar. No se ha aplicado este borrador.</p><button className={button} disabled={!authorizedHistory || busy || disabled} onClick={() => requestChoice(history.data.find((analysis) => analysis.id === selected?.id))} type="button">Revisar con datos actuales</button></div> : null}
    {selected && !history.isError ? selected.status === 'COMPLETED' && selected.extractedData ? <PurchaseDocumentAnalysisReview analysis={selected} currency={currency} disabled={disabled || Boolean(prompt) || analyze.isPending} error={!stale ? confirm.error : null} isPending={confirm.isPending} isStale={stale} key={`${selected.id}:${selected.purchaseVersion}`} onCancel={onClose} onDirtyChange={setDirty} onSubmit={save} purchase={purchase} /> : selected.status === 'CONFIRMED' ? <div className="rounded-xl border border-border bg-surface p-4 text-sm"><p className="font-bold">Este análisis ya está confirmado.</p><p className="mt-1 leading-6">Los datos revisados se guardaron el {analysisDate(selected.confirmedAt)}. No se volverán a añadir productos desde este análisis.</p></div> : <p className="rounded-xl border border-border bg-surface p-4 text-sm">Este análisis no pudo completarse. El documento original no ha cambiado. Puedes volver a analizarlo.</p> : null}
    {authorizedHistory && !history.data?.length && !selected && !analyze.isPending ? <p className="text-sm text-text-muted">Todavía no hay análisis guardados para este documento.</p> : null}
    <div className="flex min-w-0 flex-wrap gap-2"><button className={button} disabled={busy || disabled || Boolean(prompt)} onClick={() => setPrompt({ kind: 'analyze' })} type="button"><Sparkles aria-hidden="true" className="size-4 shrink-0" />{selected || history.data?.length ? 'Volver a analizar' : 'Analizar con IA'}</button>{closeButton}</div>
  </section>;
}

export function PurchaseDocumentAnalysisPanel({ householdId, purchase, document, currency = 'EUR', active, disabled = false, onOpen, onClose }) {
  const triggerRef = useRef(null);
  const contentId = useId();
  const [initialAction, setInitialAction] = useState('history');
  if (!analysisDocumentSupported(document)) return null;
  function open(event, action) { triggerRef.current = event.currentTarget; setInitialAction(action); onOpen(); }
  function close() { onClose(); requestAnimationFrame(() => { if (triggerRef.current?.isConnected) triggerRef.current.focus(); }); }
  return <div className="mt-3 min-w-0">
    <div className="flex min-w-0 flex-wrap gap-2"><button aria-controls={contentId} aria-expanded={Boolean(active)} aria-label={`Analizar con IA ${document.filename}`} className={button} disabled={disabled || active} onClick={(event) => open(event, 'analyze')} type="button"><Sparkles aria-hidden="true" className="size-4 shrink-0" />Analizar con IA</button><button aria-controls={contentId} aria-expanded={Boolean(active)} aria-label={`Ver análisis de ${document.filename}`} className={button} disabled={disabled || active} onClick={(event) => open(event, 'history')} type="button">Ver análisis guardados</button></div>
    {active ? <div id={contentId}><AnalysisWorkspace currency={currency} disabled={disabled} document={document} householdId={householdId} initialAction={initialAction} onClose={close} purchase={purchase} /></div> : null}
  </div>;
}
