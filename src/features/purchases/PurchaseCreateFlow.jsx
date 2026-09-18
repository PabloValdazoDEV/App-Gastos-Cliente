import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useRef, useState } from 'react';

import { AuthError } from '../auth/components/AuthFeedback';
import { PurchaseConfirmation } from './PurchaseConfirmation';
import { PurchaseForm } from './PurchaseForm';
import { purchaseDraftsService } from './purchaseDraftsService';
import { PURCHASE_DOCUMENT_ACCEPT, validatePurchaseDocumentFile } from './purchaseDocumentSchema';
import { purchaseIntakeHints, purchaseIntakeValues } from './purchaseIntakeState';
import { purchasesService } from './purchasesService';

const button = 'inline-flex min-h-11 items-center justify-center rounded-xl border border-border-strong px-4 py-2.5 text-sm font-bold hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:opacity-60 disabled:cursor-not-allowed';
const primary = `${button} border-brand bg-brand text-on-brand hover:bg-brand-hover`;

export function PurchaseCreateFlow({ householdId, currency, timezone, people, onCreated, onCancel }) {
  const queryClient = useQueryClient();
  const [stage, setStage] = useState('SOURCE');
  const [draft, setDraft] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [selected, setSelected] = useState('');
  const [consent, setConsent] = useState(false);
  const [initialValues, setInitialValues] = useState();
  const [fileError, setFileError] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const mounted = useRef(true);
  const locked = useRef(false);
  const heading = useRef(null);
  const id = useId();
  const key = ['purchases', householdId, 'drafts'];
  const drafts = useQuery({ queryKey: key, queryFn: () => purchaseDraftsService.list(householdId), enabled: stage === 'SOURCE', retry: false, gcTime: 0 });
  const operation = useMutation({ mutationFn: (action) => action(), retry: false });
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { heading.current?.focus(); }, [stage]);
  const ids = { householdId, draftId: draft?.id };
  const extraction = analysis?.extractedData;

  async function run(action, success) {
    if (locked.current) return;
    locked.current = true;
    setFileError(null);
    try {
      const result = await operation.mutateAsync(action);
      if (mounted.current) await success?.(result);
    } catch { /* Keep the current step and normalized mutation error for retry. */ }
    finally { locked.current = false; }
  }

  function setSource(source) {
    setDraft(source);
    const prior = source.analyses?.find((entry) => entry.status === 'COMPLETED') ?? null;
    setAnalysis(prior);
    setSelected(prior?.extractedData?.items?.length === 1 ? '0' : '');
    setConsent(false);
    setStage('REVIEW');
  }

  function startForm(withAnalysis) {
    operation.reset();
    setInitialValues(withAnalysis ? purchaseIntakeValues(extraction, selected === '' ? null : Number(selected), currency) : undefined);
    if (!withAnalysis) setAnalysis(null);
    setStage('FORM');
  }

  async function save(body) {
    if (locked.current) return;
    locked.current = true;
    try {
      const purchase = await operation.mutateAsync(() => draft
        ? purchaseDraftsService.confirm({ ...ids, body: { purchase: body, analysisId: analysis?.id ?? null, currency } })
        : purchasesService.create({ householdId, body }));
      void queryClient.invalidateQueries({ queryKey: key });
      if (mounted.current) await onCreated(purchase);
    } finally { locked.current = false; }
  }

  return <section aria-busy={operation.isPending} className="min-w-0 space-y-5">
    <p aria-label="Progreso de la compra" className="text-xs font-bold uppercase tracking-wide text-brand-strong">{stage === 'SOURCE' ? 'Paso 1 · Archivo o entrada manual' : stage === 'REVIEW' ? 'Paso 2 de 3 · Análisis y selección' : draft ? 'Paso 3 de 3 · Confirmación' : 'Paso 2 de 2 · Confirmación'}</p>
    <h3 className="text-lg font-extrabold outline-none" ref={heading} tabIndex={-1}>{stage === 'SOURCE' ? 'Empieza por el ticket' : stage === 'REVIEW' ? 'Revisa el archivo' : 'Revisa y guarda tu compra'}</h3>
    {stage === 'SOURCE' ? <>
      <p className="text-sm leading-6 text-text-muted">Una compra, un producto. Sube una foto o PDF y utiliza la IA para rellenar los datos, o introdúcelos a mano.</p>
      <div className="space-y-3 rounded-2xl border border-dashed border-border-strong bg-surface-muted p-5">
        <label className="block text-sm font-bold" htmlFor={`${id}-file`}>Subir ticket o factura</label>
        <input accept={PURCHASE_DOCUMENT_ACCEPT} aria-describedby={`${id}-help`} className="block min-h-12 w-full min-w-0 rounded-xl text-sm file:mr-3 file:min-h-11 file:rounded-xl file:border-0 file:bg-brand file:px-4 file:font-bold file:text-on-brand focus-visible:outline-2 focus-visible:outline-focus" disabled={operation.isPending} id={`${id}-file`} type="file" onChange={(event) => {
          const file = event.target.files?.[0]; event.target.value = '';
          if (!file) return;
          const failure = validatePurchaseDocumentFile(file);
          if (failure) { setFileError(failure); return; }
          void run(() => purchaseDraftsService.upload({ householdId, file }), setSource);
        }} />
        <p className="text-xs leading-5 text-text-muted" id={`${id}-help`}>PDF, JPEG, PNG o WebP · Máximo 10 MB. El borrador es privado y caduca en 24 horas. Todavía no se crea ninguna compra ni gasto.</p>
      </div>
      <button className={button} disabled={operation.isPending} onClick={() => startForm(false)} type="button">Introducir sin archivo</button>
      {drafts.isError ? <p className="text-sm text-text-muted">No se han podido cargar tus borradores. <button className={button} onClick={() => drafts.refetch()} type="button">Reintentar</button></p> : null}
      {drafts.data?.length > 0 ? <section aria-label="Tus borradores" className="space-y-3">
        <h4 className="font-bold">Continuar un borrador</h4>
        <ul className="space-y-2">{drafts.data.map((entry) => <li className="flex min-w-0 flex-wrap items-center gap-2 rounded-xl border border-border p-3" key={entry.id}>
          <span className="min-w-0 flex-1 break-all text-sm">{entry.filename}</span>
          <button className={button} disabled={operation.isPending} onClick={() => run(() => purchaseDraftsService.get({ householdId, draftId: entry.id }), setSource)} type="button">Continuar<span className="sr-only"> {entry.filename}</span></button>
          <button className={button} disabled={operation.isPending} onClick={() => setDeleting(entry)} type="button">Eliminar<span className="sr-only"> {entry.filename}</span></button>
        </li>)}</ul>
      </section> : null}
    </> : null}
    {draft ? <div className="rounded-xl border border-border bg-surface-muted p-4 text-sm leading-6">
      <p className="break-all font-bold">Archivo: {draft.filename}</p>
      <p>Se adjuntará al guardar. Después podrás añadir o eliminar archivos desde la compra. Si cierras ahora, podrás retomar este borrador durante 24 horas desde su subida.</p>
    </div> : null}
    {stage === 'REVIEW' ? <>
      {!analysis ? <>
        <label className="flex min-h-11 items-start gap-3 rounded-xl border border-border p-3 text-sm leading-6">
          <input checked={consent} className="mt-1 size-4 shrink-0 accent-brand" disabled={operation.isPending} onChange={(event) => setConsent(event.target.checked)} type="checkbox" />
          <span>Autorizo enviar este archivo a OpenAI para extraer los datos con IA. Revisaré el resultado antes de guardarlo.</span>
        </label>
        <div className="flex flex-wrap gap-3">
          <button className={primary} disabled={!consent || operation.isPending} onClick={() => run(() => purchaseDraftsService.analyze(ids), (result) => { setAnalysis(result); setSelected(result.extractedData?.items?.length === 1 ? '0' : ''); })} type="button">{operation.isPending ? 'Procesando…' : 'Analizar y rellenar con IA'}</button>
          <button className={button} disabled={operation.isPending} onClick={() => startForm(false)} type="button">Rellenar manualmente y conservar archivo</button>
        </div>
      </> : <>
        <p className="text-sm leading-6 text-text-muted">La IA puede equivocarse. Revisa nombres, unidades, fechas, importes y cualquier garantía indicada en el documento. No se inventan condiciones de garantía ni financiación.</p>
        {extraction.currency !== currency ? <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">La moneda del archivo no coincide o no se ha identificado. Introduce los importes en {currency}; no se convertirán automáticamente.</p> : null}
        {extraction.items.length > 1 ? <p className="text-sm font-semibold">El ticket contiene varios productos. Elige uno para esta compra; no se le asignará el total del ticket. Para guardar otro, crea una nueva compra.</p> : null}
        {extraction.items.length ? <fieldset className="space-y-2">
          <legend className="mb-2 font-bold">Producto que vas a guardar</legend>
          {extraction.items.map((item, index) => <label className="flex min-h-12 items-center gap-3 rounded-xl border border-border-strong p-3 text-sm has-[:checked]:border-brand has-[:checked]:bg-brand-soft" key={index}>
            <input checked={selected === String(index)} className="size-4 shrink-0 accent-brand" disabled={operation.isPending} name={`${id}-product`} onChange={() => setSelected(String(index))} type="radio" /><span className="min-w-0 break-words">{item.name || `Producto ${index + 1} sin identificar`}{item.confidence !== 'HIGH' ? ' · Revisar: confianza limitada' : ''}</span>
          </label>)}
        </fieldset> : <p className="text-sm">No se identificaron productos. Completa su nombre, cantidad e importe en el siguiente paso.</p>}
        {extraction.warnings?.length > 0 ? <ul className="list-disc space-y-1 pl-5 text-sm text-text-muted">{extraction.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul> : null}
        <button className={primary} disabled={operation.isPending || (extraction.items.length > 0 && selected === '')} onClick={() => startForm(true)} type="button">Revisar datos de este producto</button>
        <button className={button} disabled={operation.isPending} onClick={() => { setAnalysis(null); setSelected(''); setConsent(false); operation.reset(); }} type="button">Repetir análisis de este archivo</button>
      </>}
    </> : null}
    {stage === 'FORM' ? <PurchaseForm intakeHints={analysis ? purchaseIntakeHints(extraction, selected === '' ? null : Number(selected)) : undefined} currency={currency} error={operation.error} initialValues={initialValues} isPending={operation.isPending} onCancel={onCancel} onSubmit={save} people={people} singleProduct timezone={timezone} /> : <>
      {fileError ? <p className="text-sm text-red-700" role="alert">{fileError}</p> : null}
      <AuthError error={operation.error} />
      {operation.isPending ? <p aria-live="polite" className="text-sm text-text-muted">Procesando el archivo…</p> : null}
      <button className={button} disabled={operation.isPending} onClick={onCancel} type="button">Cancelar</button>
    </>}
    {deleting ? <PurchaseConfirmation confirmLabel="Eliminar borrador" description="Se eliminarán este archivo y sus análisis. No se borrará ninguna compra guardada." error={operation.error} isPending={operation.isPending} onCancel={() => setDeleting(null)} onConfirm={() => run(() => purchaseDraftsService.remove({ householdId, draftId: deleting.id }), async () => { setDeleting(null); await queryClient.invalidateQueries({ queryKey: key }); })} title="¿Eliminar este borrador?" /> : null}
  </section>;
}
