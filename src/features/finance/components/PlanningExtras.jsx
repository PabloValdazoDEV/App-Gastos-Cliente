import { useMutation } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

import { useHouseholdDraftGuard } from '../../households/useHouseholdDraftGuard';
import { financeService } from '../financeService';
import { eurosInputToCents, formatCents } from '../money';

const secondary = 'min-h-12 min-w-0 max-w-full break-words rounded-xl border border-border-strong px-4 py-2 text-sm font-bold text-brand-strong disabled:opacity-60';
const primary = 'min-h-12 min-w-0 max-w-full break-words rounded-xl bg-brand px-4 py-2 text-sm font-bold text-on-brand hover:bg-brand-hover disabled:opacity-60';
const eventLabel = { CONFIRM: 'Aportación confirmada', REVOKE: 'Confirmación corregida', CANCEL: 'Extra anulado' };

export function PlanningExtras({ householdId, planning, currency, onSaved, onStale, onOpenChange, disabled = false }) {
  const [action, setAction] = useState(null);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const mounted = useRef(true);
  const title = useRef(null);
  const section = useRef(null);
  const previouslyOpen = useRef(false);
  const isOpen = Boolean(action);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    onOpenChange?.(isOpen);
    if (isOpen) title.current?.focus();
    else if (previouslyOpen.current) section.current?.querySelector('button')?.focus();
    previouslyOpen.current = isOpen;
  }, [isOpen, onOpenChange]);
  const onError = (failure) => { if (failure.status === 409) onStale?.(); };
  const preview = useMutation({ mutationFn: financeService.previewPlanningExtra, onError });
  const save = useMutation({
    mutationFn: (input) => input.extraId ? financeService.changePlanningExtra(input) : financeService.createPlanningExtra(input),
    onError,
    onSuccess: async (_, input) => {
      await onSaved();
      if (mounted.current) {
        setAction(null);
        setSuccess(!input.extraId ? 'Extra acordado. Queda pendiente de aportar.' : input.body.action === 'CONFIRM'
          ? 'Aportación extra confirmada.' : input.body.action === 'CANCEL' ? 'Extra anulado; el historial se conserva.' : 'Confirmación corregida; el importe vuelve a estar pendiente.');
      }
    },
  });
  useHouseholdDraftGuard({ dirty: isOpen, pending: save.isPending });
  const busy = disabled || save.isPending || preview.isPending;
  const stale = action && action.expectedVersion !== planning.stateVersion;
  function open(type, extra, share) {
    setAction({ type, extra, share, expectedVersion: planning.stateVersion, id: crypto.randomUUID() });
    setAmount(''); setReason(''); setError(''); setSuccess(''); preview.reset(); save.reset();
  }
  function submit(event) {
    event.preventDefault();
    if (busy || stale) return;
    const base = { householdId, planningId: planning.id };
    if (action.type === 'CREATE') {
      if (!preview.data) {
        try {
          const amountCents = eurosInputToCents(amount);
          if (!Number.isSafeInteger(amountCents) || amountCents <= 0 || amountCents > 2_147_483_647) throw new Error('Indica un importe mayor que cero, con hasta dos decimales y dentro del límite admitido.');
          setError('');
          preview.mutate({ ...base, body: { amountCents, expectedVersion: action.expectedVersion } });
        } catch (failure) { setError(failure.message); }
      } else if (reason.trim().length >= 3) save.mutate({ ...base, body: { id: action.id, amountCents: preview.data.amountCents,
        expectedVersion: action.expectedVersion, reason: reason.trim() } });
    } else if (action.type === 'CONFIRM' || reason.trim().length >= 3) save.mutate({ ...base, extraId: action.extra.id,
      body: { action: action.type, expectedVersion: action.expectedVersion,
        ...(action.share ? { personId: action.share.personId } : {}), ...(action.type === 'CONFIRM' ? {} : { reason: reason.trim() }) } });
  }
  if (!Array.isArray(planning.extras)) return null;
  return <section aria-labelledby="planning-extras" className="mt-5 min-w-0 rounded-2xl border border-border bg-surface p-4 sm:p-5" ref={section}>
    <h3 className="font-bold" id="planning-extras">Aportaciones extra conjuntas</h3>
    <p className="mt-2 text-sm leading-6 text-text-muted">Una desviación no obliga a ingresar más: puede estar cubierta por el presupuesto o el colchón. Si acordáis un extra, quedará separado de la aportación inicial. Después podréis confirmar lo aportado por cada persona.</p>
    {planning.extraFunding?.agreedCents > 0 ? <p className="mt-3 text-sm font-bold">Extras acordados: {formatCents(planning.extraFunding.agreedCents, currency)} · Pendientes: {formatCents(planning.extraFunding.pendingCents, currency)}</p> : <p className="mt-3 text-sm text-text-muted">No hay aportaciones extra acordadas.</p>}
    {success ? <p className="mt-3 text-sm font-bold text-brand-strong" role="status">{success}</p> : null}
    {!action ? <button className={`${secondary} mt-3`} disabled={busy} onClick={() => open('CREATE')} type="button">Acordar un extra conjunto</button> : <form className="mt-4 space-y-4" onSubmit={submit}>
      <h4 className="font-bold focus-visible:outline-2 focus-visible:outline-focus" ref={title} tabIndex={-1}>{action.type === 'CREATE' ? 'Acordar una nueva aportación extra' : action.type === 'CONFIRM' ? '¿Se ha aportado este extra?' : action.type === 'REVOKE' ? 'Corregir una confirmación errónea' : 'Anular el extra pendiente'}</h4>
      {action.type === 'CREATE' ? <>
        <div><label className="block text-sm font-bold" htmlFor="extra-amount">Importe extra total del hogar ({currency})</label>
          <input className="mt-2 min-h-12 w-full rounded-xl border border-border-strong px-3" disabled={busy || Boolean(preview.data)} id="extra-amount" inputMode="decimal" maxLength={15} onChange={(event) => setAmount(event.target.value)} required value={amount} />
          <p className="mt-1 text-xs text-text-muted">Solo lo adicional que queréis aportar. No vuelvas a incluir extras ya acordados.</p></div>
        {preview.data ? <div className="rounded-xl bg-surface-muted p-4">
          <p className="text-sm font-bold">Reparto con los porcentajes guardados para este mes</p>
          <ul className="mt-2 space-y-2 text-sm">{preview.data.shares.map((share) => <li className="flex flex-wrap justify-between gap-2 break-words" key={share.personId}><span>{share.personName}</span><strong>{formatCents(share.amountCents, currency)}</strong></li>)}</ul>
          <button className={`${secondary} mt-3`} disabled={busy} onClick={() => preview.reset()} type="button">Modificar importe</button>
        </div> : null}
      </> : <p className="break-words text-sm leading-6">{action.extra.reason} · {action.share ? `${action.share.personName}: ${formatCents(action.share.amountCents, currency)}` : formatCents(action.extra.amountCents, currency)}</p>}
      {action.type !== 'CONFIRM' ? <div>
        <label className="block text-sm font-bold" htmlFor="extra-reason">{action.type === 'CREATE' ? 'Motivo del extra' : 'Motivo de la corrección'}</label>
        <input aria-describedby="extra-reason-help" className="mt-2 min-h-12 w-full rounded-xl border border-border-strong px-3" disabled={busy} id="extra-reason" maxLength={300} minLength={3} onChange={(event) => setReason(event.target.value)} required value={reason} />
        <p className="mt-1 text-xs text-text-muted" id="extra-reason-help">Visible para todo el hogar. No incluyas información personal privada.</p>
      </div> : null}
      <p className="text-sm leading-6 text-text-muted">{action.type === 'CREATE' ? 'Guardar el acuerdo no confirma una transferencia. No se modifica la previsión inicial.' : action.type === 'REVOKE' ? 'Solo si se confirmó por error: volverá a estar pendiente. No se devuelve dinero.' : action.type === 'CANCEL' ? 'Se retirará de los importes pendientes y se conservará en el historial.' : 'Confirma solo si esta persona ya ha realizado la aportación indicada.'} No se mueve dinero ni se actualizan los saldos de Cuentas.</p>
      {stale ? <p className="text-sm text-amber-950" role="alert">Las aportaciones han cambiado. Cierra esta acción y vuelve a abrirla para revisar los datos actuales.</p> : null}
      {error || preview.isError || save.isError ? <p className="text-sm text-red-700" role="alert">{error || save.error?.message || preview.error?.message}</p> : null}
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <button className={primary} disabled={busy || stale || (action.type !== 'CONFIRM' && reason.trim().length < 3)} type="submit">{save.isPending ? 'Guardando…' : preview.isPending ? 'Calculando reparto…' : action.type === 'CREATE' ? preview.data ? 'Guardar extra pendiente de aportar' : 'Revisar reparto del extra' : action.type === 'CONFIRM' ? 'Confirmar aportación realizada' : action.type === 'REVOKE' ? 'Deshacer confirmación errónea' : 'Anular extra'}</button>
        <button className={secondary} disabled={save.isPending} onClick={() => setAction(null)} type="button">Cerrar sin guardar</button>
      </div>
    </form>}
    <div className="mt-4 space-y-3">{planning.extras.filter((extra) => !extra.cancelledAt).map((extra) => <article className="min-w-0 rounded-xl border border-border p-4" key={extra.id}>
      <h4 className="break-words font-bold">{extra.reason} · {formatCents(extra.amountCents, currency)}</h4>
      <p className="mt-1 text-xs text-text-muted">Acordado el {new Date(extra.at).toLocaleDateString('es-ES')}</p>
      <ul className="mt-3 space-y-3">{extra.shares.map((share) => <li className="min-w-0 border-t border-border pt-3" key={share.personId}>
        <p className="break-words text-sm"><strong>{share.personName}: {formatCents(share.amountCents, currency)}</strong> · {share.amountCents === 0 ? 'Sin aportación' : share.confirmedAt ? 'Aportado' : 'Pendiente'}</p>
        {share.amountCents > 0 ? <button className={`${secondary} mt-2 w-full sm:w-auto`} disabled={busy || isOpen} onClick={() => open(share.confirmedAt ? 'REVOKE' : 'CONFIRM', extra, share)} type="button">{share.confirmedAt ? `Corregir confirmación de ${share.personName}` : `Confirmar extra de ${share.personName}`}</button> : null}
      </li>)}</ul>
      {!extra.shares.some((share) => share.confirmedAt) ? <button className={`${secondary} mt-3`} disabled={busy || isOpen} onClick={() => open('CANCEL', extra)} type="button">Anular extra pendiente</button> : null}
    </article>)}</div>
    {planning.extras.length > 0 ? <details className="mt-4 text-sm"><summary className="flex min-h-12 cursor-pointer items-center font-bold">Historial de extras</summary>
      <ul className="mt-2 space-y-3">{planning.extras.map((extra) => <li className="break-words" key={extra.id}>
        <p className="font-bold">{extra.reason} · {formatCents(extra.amountCents, currency)}{extra.cancelledAt ? ' · Anulado' : ''}</p>
        <p>Acordado: {new Date(extra.at).toLocaleString('es-ES')}</p>
        {extra.events.map((entry, index) => <p className="mt-1 text-text-muted" key={index}>{eventLabel[entry.action]}{entry.personId ? ` · ${extra.shares.find((share) => share.personId === entry.personId)?.personName ?? 'Persona'}` : ''} · {new Date(entry.at).toLocaleString('es-ES')}{entry.reason ? ` · ${entry.reason}` : ''}</p>)}
      </li>)}</ul>
    </details> : null}
  </section>;
}
