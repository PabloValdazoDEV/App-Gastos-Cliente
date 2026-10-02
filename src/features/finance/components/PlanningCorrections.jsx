import { useMutation } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

import { useHouseholdDraftGuard } from '../../households/useHouseholdDraftGuard';
import { financeService } from '../financeService';
import { formatCents } from '../money';
import { ContributionBreakdown } from './ContributionBreakdown';

const secondary = 'min-h-12 rounded-xl border border-border-strong px-4 py-2 text-sm font-bold text-brand-strong disabled:opacity-60';

export function PlanningCorrections({ householdId, planning, currency, onSaved, onStale, onOpenChange, disabled = false }) {
  const [action, setAction] = useState(null);
  const [reason, setReason] = useState('');
  const mounted = useRef(true);
  const titleRef = useRef(null);
  const sectionRef = useRef(null);
  const hadAction = useRef(false);
  const isOpen = Boolean(action);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    onOpenChange?.(isOpen);
    if (isOpen) titleRef.current?.focus();
    else if (hadAction.current) sectionRef.current?.querySelector('button')?.focus();
    hadAction.current = isOpen;
  }, [isOpen, onOpenChange]);
  const preview = useMutation({ mutationFn: financeService.planningRevisionPreview });
  const save = useMutation({
    mutationFn: (input) => input.action === 'REVOKE' ? financeService.fundPlanning(input) : financeService.revisePlanning(input),
    onSuccess: async () => {
      await onSaved();
      if (mounted.current) { setAction(null); setReason(''); }
    },
    onError: (error) => { if (error.status === 409) onStale?.(); },
  });
  const pending = disabled || save.isPending;
  useHouseholdDraftGuard({ dirty: Boolean(action), pending: save.isPending });
  const commonConfirmed = planning.contributions.some((item) => item.funding?.commonConfirmed);
  const personalConfirmed = planning.contributions.some((item) => item.canConfirmPersonal && item.funding?.personalConfirmed);
  const stale = action && action.expectedVersion !== planning.stateVersion;
  function open(type) {
    setAction({ type, expectedVersion: planning.stateVersion });
    setReason('');
    save.reset();
    preview.reset();
    if (type === 'REVISION') preview.mutate({ householdId, planningId: planning.id });
  }
  function submit(event) {
    event.preventDefault();
    if (stale || pending || reason.trim().length < 3) return;
    if (action.type === 'REVISION') {
      if (!preview.data) return;
      save.mutate({ householdId, planningId: planning.id, body: {
        expectedVersion: preview.data.expectedVersion, previewFingerprint: preview.data.previewFingerprint, reason: reason.trim(),
      } });
    } else save.mutate({ householdId, planningId: planning.id, scope: action.type,
      action: 'REVOKE', expectedVersion: action.expectedVersion, reason: reason.trim() });
  }
  // Old API clients/server responses do not advertise the correction contract.
  if (planning.stateVersion === undefined) return null;
  return <section className="mt-5 min-w-0 rounded-2xl border border-border bg-surface p-4 sm:p-5" aria-labelledby="planning-corrections" ref={sectionRef}>
    <h3 className="font-bold" id="planning-corrections">Corregir esta previsión</h3>
    <p className="mt-2 text-sm leading-6 text-text-muted">Las correcciones conservan el histórico. No hacen ni devuelven transferencias, y no cambian los saldos de Cuentas.</p>
    {!action ? <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
      {planning.canRevise ? <button className={secondary} disabled={pending} onClick={() => open('REVISION')} type="button">Revisar importes antes de aportar</button> : <p className="text-sm leading-6 text-text-muted">No se recalcula una previsión con dinero ya confirmado, extras acordados o sin identidad histórica verificable. Deshaz una confirmación solo si fue un error.</p>}
      {commonConfirmed ? <button className={secondary} disabled={pending} onClick={() => open('HOUSEHOLD')} type="button">Corregir confirmación conjunta</button> : null}
      {personalConfirmed ? <button className={secondary} disabled={pending} onClick={() => open('PERSONAL')} type="button">Corregir mi confirmación personal</button> : null}
    </div> : <form className="mt-4 space-y-4" onSubmit={submit}>
      <h4 className="font-bold focus-visible:outline-2 focus-visible:outline-focus" ref={titleRef} tabIndex={-1}>{action.type === 'REVISION' ? 'Revisar la nueva previsión' : action.type === 'HOUSEHOLD' ? 'Deshacer la confirmación conjunta' : 'Deshacer mi confirmación personal'}</h4>
      <p className="text-sm leading-6 text-text-muted">{action.type === 'REVISION'
        ? 'Se actualizan la previsión común y tus gastos personales. Los personales de los demás y el ajuste temporal guardado se conservan. El cálculo original seguirá disponible en el historial.'
        : 'Úsalo solo si marcaste la aportación por error. El importe volverá a figurar pendiente, pero no se devolverá dinero ni se cambiará la previsión guardada.'}</p>
      {action.type === 'REVISION' ? <>
        {preview.isPending ? <p role="status">Calculando vista previa…</p> : null}
        {preview.isError ? <div role="alert"><p className="text-sm text-red-700">{preview.error.message}</p><button className={secondary} onClick={() => open('REVISION')} type="button">Volver a calcular</button></div> : null}
        {preview.data ? <div className="space-y-3">
          <p className="text-sm font-bold">Previsión común: {formatCents(planning.householdBudgetCents, currency)} → {formatCents(preview.data.householdBudgetCents, currency)}</p>
          <div className="grid gap-3 sm:grid-cols-2">{preview.data.contributions.map((item) => <article className="min-w-0 rounded-xl bg-surface-muted p-4" key={item.householdPersonId}>
            <h5 className="break-words font-bold">{item.personName}</h5>
            <ContributionBreakdown currency={currency} householdCents={item.standardHouseholdCents} personalCents={item.personalExpenseCents} personalAmountsHidden={item.personalAmountsHidden} adjustmentCents={item.temporaryAdjustmentCents} totalCents={item.totalRecommendedCents} totalLabel="Nueva previsión" />
          </article>)}</div>
        </div> : null}
      </> : null}
      <div>
        <label className="block text-sm font-bold" htmlFor="planning-correction-reason">Motivo de la corrección</label>
        <input aria-describedby="planning-correction-reason-help" className="mt-2 min-h-12 w-full rounded-xl border border-border-strong px-3" disabled={save.isPending} id="planning-correction-reason" maxLength={300} minLength={3} onChange={(event) => setReason(event.target.value)} required value={reason} />
        <p className="mt-1 text-xs text-text-muted" id="planning-correction-reason-help">{action.type === 'PERSONAL' ? 'Solo tú verás este motivo personal.' : 'Visible para las personas del hogar. No incluyas datos personales privados.'}</p>
      </div>
      {stale ? <p className="text-sm text-amber-900" role="alert">La previsión ha cambiado. Cierra esta corrección y vuelve a abrirla para revisar los datos actuales.</p> : null}
      {save.isError ? <p className="text-sm text-red-700" role="alert">{save.error.message} Cierra y vuelve a abrir la corrección si necesitas actualizar la vista previa.</p> : null}
      <div className="flex flex-col gap-2 sm:flex-row">
        <button className="min-h-12 rounded-xl bg-brand px-4 py-2 text-sm font-bold text-on-brand disabled:opacity-60" disabled={pending || stale || reason.trim().length < 3 || (action.type === 'REVISION' && !preview.data)} type="submit">{save.isPending ? 'Guardando corrección…' : action.type === 'REVISION' ? 'Guardar nueva revisión' : 'Deshacer confirmación'}</button>
        <button className={secondary} disabled={save.isPending} onClick={() => { setAction(null); setReason(''); }} type="button">Cancelar corrección</button>
      </div>
    </form>}
    <PlanningHistory planning={planning} currency={currency} />
  </section>;
}

function PlanningHistory({ planning, currency }) {
  const date = (value) => value ? new Date(value).toLocaleString('es-ES') : 'Fecha no disponible';
  return <details className="mt-5 border-t border-border pt-3">
    <summary className="min-h-11 cursor-pointer py-2 text-sm font-bold text-brand-strong">Historial de previsión y confirmaciones</summary>
    <ol className="mt-3 space-y-3">{(planning.revisionHistory ?? []).map((item) => <li className="rounded-xl bg-surface-muted p-3" key={item.revision}>
      <p className="text-sm font-bold">{item.revision === 0 ? 'Previsión original' : `Revisión ${item.revision}`} · {date(item.at)}</p>
      {item.reason ? <p className="mt-1 break-words text-sm">{item.reason}</p> : null}
      <p className="mt-1 text-sm text-text-muted">Presupuesto común: {formatCents(item.householdBudgetCents, currency)}</p>
      <ul className="mt-2 space-y-1 text-sm">{item.contributions.map((person) => <li className="break-words" key={person.householdPersonId}>{person.personName}: {formatCents(person.totalRecommendedCents, currency)}{person.personalAmountsHidden ? ' · Solo parte conjunta; personales privados' : ''}</li>)}</ul>
    </li>)}</ol>
    <ul className="mt-3 space-y-2 text-sm">{(planning.fundingHistory ?? []).map((event, index) => <li className="break-words" key={index}>
      {event.action === 'REVOKE' ? 'Confirmación deshecha' : 'Aportación confirmada'} · {event.scope === 'PERSONAL' ? 'Personal' : event.scope === 'HOUSEHOLD' ? 'Conjunta' : 'Conjunta y personales'} · {date(event.at)}{Number.isInteger(event.revision) ? ` · ${event.revision === 0 ? 'Previsión original' : `Revisión ${event.revision}`}` : ''}{event.reason ? ` · ${event.reason}` : ''}
    </li>)}</ul>
  </details>;
}
