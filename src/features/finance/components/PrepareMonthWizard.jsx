import { useState } from 'react';

import { ContributionBreakdown } from './ContributionBreakdown';
import { fundingShortfall, splitByContribution } from '../fundingCheck';
import { eurosInputToCents, formatCents } from '../money';

const primaryButton = 'inline-flex min-h-12 items-center justify-center rounded-xl bg-brand px-5 py-3 text-sm font-bold text-on-brand hover:bg-brand-hover disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus';
const secondaryButton = 'inline-flex min-h-12 items-center justify-center rounded-xl border border-border-strong px-5 py-3 text-sm font-bold text-text hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus';
const inputClass = 'mt-2 min-h-12 w-full rounded-xl border border-border-strong px-3';
const choiceClass = 'flex min-h-12 cursor-pointer items-start gap-3 rounded-xl border border-border bg-surface p-3 has-[:checked]:border-brand has-[:checked]:bg-brand-soft';

function Row({ label, cents, currency, strong = false, tone }) {
  return (
    <div className={`flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-1.5 ${strong ? 'font-extrabold' : ''} ${tone ?? ''}`}>
      <dt className="min-w-0">{label}</dt>
      <dd className="ml-auto text-right tabular-nums">{formatCents(cents, currency)}</dd>
    </div>
  );
}

/*
 * "Preparar el mes" in three steps:
 * 1. Has the contribution been made, and how much is in the joint account?
 * 2. What the month needs (payments, overdue, savings for big charges) vs.
 *    what the account will have.
 * 3. If something is missing: contribute it now (extra) or spread it over
 *    several months (recovery plan).
 */
export function PrepareMonthWizard({
  balance,
  basis,
  busy,
  currency,
  error,
  expectedTotalCents,
  fetchCheck,
  monthLabel,
  onBalanceChange,
  onPersonalBalanceChange,
  onSubmit,
  people,
  personalBalances,
  pendingAdjustment,
}) {
  const [step, setStep] = useState(1);
  const [contributionDone, setContributionDone] = useState(null);
  const [cover, setCover] = useState('NOW');
  const [months, setMonths] = useState(null);
  const [stepError, setStepError] = useState('');
  const [check, setCheck] = useState(null);
  const [checking, setChecking] = useState(false);

  let balanceCents = null;
  try { balanceCents = eurosInputToCents(balance); } catch { balanceCents = null; }
  const result = check;
  const shownBasis = check?.basis ?? basis;
  const shortfall = result?.shortfallCents ?? 0;
  const shares = check?.shares ?? [];
  const options = check?.options ?? [];
  const safeOptions = options.filter((option) => option.safe);
  const unsafeOptions = options.filter((option) => !option.safe);
  const chosen = options.find((option) => option.months === months);

  // The server answers what is missing, each share and which spreading options
  // keep every payment covered. An older server without that route: compute
  // locally and do not offer spreading, since its safety cannot be checked.
  async function loadCheck() {
    if (fetchCheck) {
      try {
        return await fetchCheck({ balanceCents, contributionDone });
      } catch (failure) {
        if (failure?.status !== 404) throw failure;
      }
    }
    const local = fundingShortfall(basis, { balanceCents, contributionDone });
    return { ...local, basis, shares: splitByContribution(local.shortfallCents, basis.contributions ?? []), options: [] };
  }

  async function goToResult(event) {
    event.preventDefault();
    if (contributionDone === null) return setStepError('Indica si ya has hecho la aportación de este mes.');
    if (balanceCents === null) return setStepError('Escribe el saldo de la cuenta conjunta, por ejemplo 900,00.');
    setStepError('');
    // An older server sends no funding data: just save the forecast.
    if (!basis) {
      onSubmit({ balanceCents, contributionDone, cover: 'NONE', shortfallCents: 0, months: null });
      return;
    }
    setChecking(true);
    try {
      const answer = await loadCheck();
      setCheck(answer);
      const firstSafe = (answer.options ?? []).find((option) => option.safe);
      setMonths(firstSafe?.months ?? null);
      setCover('NOW');
      setStep(2);
    } catch (failure) {
      setStepError(failure?.message || 'No se ha podido calcular. Inténtalo de nuevo.');
    } finally {
      setChecking(false);
    }
  }

  function save(event) {
    event.preventDefault();
    onSubmit({
      balanceCents,
      contributionDone,
      cover: shortfall > 0 ? cover : 'NONE',
      shortfallCents: shortfall,
      months,
    });
  }

  const riskText = (option) => option.risk?.dueDate
    ? `«${option.risk.name}» del ${new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${option.risk.dueDate}T00:00:00Z`))}`
    : 'los pagos de este mes';

  const saveLabel = busy
    ? 'Guardando…'
    : shortfall > 0 && cover === 'NOW'
      ? 'Guardar y añadir el extra'
      : shortfall > 0 && cover === 'MONTHS' && months
        ? `Guardar y repartir en ${months} meses`
        : 'Guardar previsión del mes';

  return (
    <section aria-labelledby="preparar-mes" className="min-w-0 rounded-3xl border border-border bg-surface p-5 shadow-card sm:p-7">
      <p className="text-xs font-bold uppercase tracking-wide text-brand-strong">Paso {step} de 3</p>
      <h2 className="mt-1 text-lg font-bold" id="preparar-mes">Preparar {monthLabel}</h2>

      {step === 1 ? (
        <form className="mt-5 space-y-5" noValidate onSubmit={goToResult}>
          <fieldset>
            <legend className="text-sm font-bold">¿Ya has hecho la aportación de {monthLabel} a la cuenta conjunta?</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <label className={choiceClass}>
                <input checked={contributionDone === true} className="mt-1 size-4 accent-brand" name="contribution-done" onChange={() => setContributionDone(true)} type="radio" />
                <span><span className="block font-bold">Sí, ya está ingresada</span><span className="text-sm text-text-muted">El saldo ya la incluye.</span></span>
              </label>
              <label className={choiceClass}>
                <input checked={contributionDone === false} className="mt-1 size-4 accent-brand" name="contribution-done" onChange={() => setContributionDone(false)} type="radio" />
                <span><span className="block font-bold">Todavía no</span><span className="text-sm text-text-muted">La sumamos al calcular.</span></span>
              </label>
            </div>
          </fieldset>
          <div>
            <label className="text-sm font-bold" htmlFor="planning-balance">Saldo de la cuenta conjunta</label>
            <p className="text-sm text-text-muted" id="planning-balance-help">Lo que hay ahora mismo en el banco.</p>
            <input aria-describedby="planning-balance-help" className={inputClass} id="planning-balance" inputMode="decimal" onChange={(event) => onBalanceChange(event.target.value)} value={balance} />
          </div>
          {people.length ? (
            <details className="rounded-2xl border border-border p-3">
              <summary className="flex min-h-11 cursor-pointer flex-wrap items-center gap-x-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
                <span className="font-bold">Saldos personales:</span>
                <span className="text-text-muted">{people.map((person) => `${person.personName} ${personalBalances[person.personId] || '0,00'} €`).join(' · ')}</span>
                <span className="font-bold text-brand-strong underline">Corregir</span>
              </summary>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                {people.map((person) => (
                  <div key={person.personId}>
                    <label className="text-sm font-bold" htmlFor={`planning-balance-${person.personId}`}>Saldo personal de {person.personName}</label>
                    <input className={inputClass} id={`planning-balance-${person.personId}`} inputMode="decimal" onChange={(event) => onPersonalBalanceChange(person.personId, event.target.value)} value={personalBalances[person.personId] ?? ''} />
                  </div>
                ))}
              </div>
            </details>
          ) : null}
          {stepError ? <p className="text-sm font-semibold text-red-700" role="alert">{stepError}</p> : null}
          <button className={primaryButton} disabled={checking} type="submit">{checking ? 'Calculando…' : 'Ver lo que necesitáis'}</button>
        </form>
      ) : null}

      {step === 2 && result ? (
        <div className="mt-5 space-y-5">
          <dl className="rounded-2xl bg-surface-muted p-4 text-sm">
            <Row cents={balanceCents} currency={currency} label="Hay en la cuenta" />
            {result.pendingContributionCents > 0 ? <Row cents={result.pendingContributionCents} currency={currency} label="+ Aportación a la conjunta que falta por hacer" /> : null}
            <div className="border-t border-border"><Row cents={result.availableCents} currency={currency} label="Tendréis disponible" strong /></div>
          </dl>
          <dl className="rounded-2xl bg-surface-muted p-4 text-sm">
            <Row cents={shownBasis.pendingThisMonthCents} currency={currency} label="Pagos que quedan este mes" />
            {shownBasis.overdueCents > 0 ? <Row cents={shownBasis.overdueCents} currency={currency} label="+ Pagos atrasados de meses anteriores" /> : null}
            {shownBasis.reserveForLaterCents > 0 ? <Row cents={shownBasis.reserveForLaterCents} currency={currency} label="+ Ahorro para seguros y pagos anuales" /> : null}
            <div className="border-t border-border"><Row cents={result.neededCents} currency={currency} label="Necesitáis" strong /></div>
            {shortfall > 0
              ? <Row cents={shortfall} currency={currency} label="Faltan" strong tone="text-red-700" />
              : <Row cents={result.surplusCents} currency={currency} label="Sobran" strong tone="text-brand-strong" />}
          </dl>
          {shownBasis.reserveForLaterLines?.length ? (
            <details className="rounded-2xl border border-border p-3 text-sm">
              <summary className="min-h-11 cursor-pointer content-center font-bold">Ver el ahorro para pagos grandes</summary>
              <ul className="mt-2 space-y-1">
                {shownBasis.reserveForLaterLines.map((line) => (
                  <li className="flex flex-wrap justify-between gap-2" key={line.expenseId}>
                    <span>{line.name} · {formatCents(line.targetAmountCents, currency)} el {new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${line.dueDate}T00:00:00Z`))}</span>
                    <span className="font-semibold tabular-nums">{formatCents(line.reserveCents, currency)} guardados</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-text-muted">Es lo que ya debería estar apartado a día de hoy, repartiendo cada pago entre los meses hasta que vence.</p>
            </details>
          ) : null}
          <details className="rounded-2xl border border-border p-3 text-sm">
            <summary className="min-h-11 cursor-pointer content-center font-bold">Aportación de cada persona, conjunta y personal · {formatCents(expectedTotalCents, currency)}</summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {people.map((person) => (
                <article className="min-w-0 rounded-2xl bg-surface-muted p-4" key={person.personId}>
                  <h3 className="break-words font-bold">{person.personName}</h3>
                  <ContributionBreakdown currency={currency} householdCents={person.standardHouseholdCents} personalCents={person.personalExpenseCents} personalAmountsHidden={person.personalAmountsHidden} totalCents={person.totalStandardCents} totalLabel="Previsión antes de guardar" pendingAdjustment={pendingAdjustment} />
                </article>
              ))}
            </div>
          </details>
          <div className="flex flex-wrap gap-2">
            <button className={secondaryButton} onClick={() => setStep(1)} type="button">Atrás</button>
            {shortfall > 0
              ? <button className={primaryButton} onClick={() => setStep(3)} type="button">Ver cómo cubrirlo</button>
              : <form onSubmit={save}><button className={primaryButton} disabled={busy} type="submit">{saveLabel}</button></form>}
          </div>
          {shortfall === 0 && error ? <p className="text-sm text-red-700" role="alert">{error}</p> : null}
        </div>
      ) : null}

      {step === 3 ? (
        <form className="mt-5 space-y-4" onSubmit={save}>
          <fieldset>
            <legend className="text-base font-bold">Faltan {formatCents(shortfall, currency)}. ¿Cómo lo cubrís?</legend>
            <div className="mt-3 grid gap-2">
              <label className={choiceClass}>
                <input checked={cover === 'NOW'} className="mt-1 size-4 accent-brand" name="cover" onChange={() => setCover('NOW')} type="radio" />
                <span>
                  <span className="block font-bold">Aportarlo ahora</span>
                  <span className="text-sm text-text-muted">{shares.map((share) => `${share.personName} ${formatCents(share.amountCents, currency)}`).join(' · ')}</span>
                </span>
              </label>
              <label className={`${choiceClass} ${safeOptions.length ? '' : 'cursor-not-allowed opacity-70'}`}>
                <input checked={cover === 'MONTHS'} className="mt-1 size-4 accent-brand" disabled={!safeOptions.length} name="cover" onChange={() => setCover('MONTHS')} type="radio" />
                <span className="min-w-0 flex-1">
                  <span className="block font-bold">Repartirlo en varios meses</span>
                  <span className="text-sm text-text-muted">
                    {safeOptions.length
                      ? `Solo los repartos que no dejan ningún pago sin cubrir.${chosen ? ` ${formatCents(chosen.monthlyCents, currency)} más al mes.` : ''}`
                      : options.length
                        ? `No es posible sin dejar sin cubrir ${riskText(options[0])}. Hay que aportarlo ahora.`
                        : 'No disponible: no se puede comprobar que ningún pago quede sin cubrir.'}
                  </span>
                </span>
              </label>
              {cover === 'MONTHS' ? (
                <fieldset className="pl-7">
                  <legend className="text-sm font-bold">¿En cuántos meses?</legend>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {options.map((option) => (
                      <label className={`inline-flex min-h-11 items-center gap-2 rounded-xl border px-3 text-sm font-bold ${option.safe ? 'cursor-pointer border-border-strong has-[:checked]:border-brand has-[:checked]:bg-brand-soft' : 'cursor-not-allowed border-border text-text-muted line-through'}`} key={option.months}>
                        <input checked={months === option.months} className="size-4 accent-brand" disabled={!option.safe} name="recovery-months" onChange={() => setMonths(option.months)} type="radio" />
                        {option.months} meses · {formatCents(option.monthlyCents, currency)}/mes
                      </label>
                    ))}
                  </div>
                  {unsafeOptions.length ? (
                    <ul className="mt-2 space-y-1 text-xs text-text-muted">
                      {unsafeOptions.map((option) => <li key={option.months}>{option.months} meses no: {riskText(option)} no llegaría a cubrirse.</li>)}
                    </ul>
                  ) : null}
                </fieldset>
              ) : null}
              <label className={choiceClass}>
                <input checked={cover === 'NONE'} className="mt-1 size-4 accent-brand" name="cover" onChange={() => setCover('NONE')} type="radio" />
                <span><span className="block font-bold">De momento, no</span><span className="text-sm text-text-muted">Solo guardar la previsión.</span></span>
              </label>
            </div>
          </fieldset>
          {error ? <p className="text-sm text-red-700" role="alert">{error}</p> : null}
          <div className="flex flex-wrap gap-2">
            <button className={secondaryButton} onClick={() => setStep(2)} type="button">Atrás</button>
            <button className={primaryButton} disabled={busy} type="submit">{saveLabel}</button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
