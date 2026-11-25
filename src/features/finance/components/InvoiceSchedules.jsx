import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, Pencil, Plus, Repeat } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';

import { ConfirmationDialog, FormCard } from '../../../pages/expensePageShared';
import { formatCivilDate, todayIso } from '../../../pages/expensePageUtils';
import { financeService } from '../financeService';
import { invoiceScheduleKey } from '../invoiceScheduleKey';
import { formatCents, isoDate } from '../money';
import { formatFrequency, frequencyOptions } from '../recurringFrequency';

const inputClass = 'mt-2 min-h-12 w-full rounded-xl border border-border-strong bg-surface px-3';
const primaryButton = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-bold text-on-brand hover:bg-brand-hover disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus';
const secondaryButton = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border-strong px-4 py-2 text-sm font-bold text-text hover:bg-surface-muted disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus';
// A bill always repeats: no one-off option here.
const FREQUENCIES = Object.entries(frequencyOptions).filter(([value]) => value !== 'ONE_TIME');

function ScheduleForm({ categories, householdId, initial, onClose, onDelete, people }) {
  const queryClient = useQueryClient();
  const [values, setValues] = useState(() => ({
    name: initial?.name ?? '',
    categoryId: initial?.categoryId ?? categories[0]?.id ?? '',
    scope: initial?.scope ?? 'HOUSEHOLD',
    personalPersonId: initial?.personalPersonId ?? '',
    frequency: initial?.frequency ?? 'BIMONTHLY',
    intervalMonths: initial?.intervalMonths ?? 4,
    intervalWeeks: initial?.intervalWeeks ?? 4,
    nextExpectedDate: isoDate(initial?.nextExpectedDate) || todayIso(),
    endDate: isoDate(initial?.endDate),
  }));
  const set = (field) => (event) => setValues((current) => ({ ...current, [field]: event.target.value }));
  const save = useMutation({
    mutationFn: (body) => initial
      ? financeService.updateInvoiceSchedule({ householdId, scheduleId: initial.id, body })
      : financeService.createInvoiceSchedule({ householdId, body }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: invoiceScheduleKey(householdId) });
      await queryClient.invalidateQueries({ queryKey: ['calendar', householdId] });
      toast.success(initial ? 'Factura periódica actualizada.' : 'Factura periódica creada. Aparecerá en el calendario.');
      onClose();
    },
  });

  function submit(event) {
    event.preventDefault();
    save.mutate({
      name: values.name.trim(),
      categoryId: values.categoryId,
      scope: values.scope,
      personalPersonId: values.scope === 'PERSONAL' ? values.personalPersonId : null,
      frequency: values.frequency,
      intervalMonths: values.frequency === 'CUSTOM_MONTHS' ? Number(values.intervalMonths) : null,
      intervalWeeks: values.frequency === 'CUSTOM_WEEKS' ? Number(values.intervalWeeks) : null,
      nextExpectedDate: values.nextExpectedDate,
      endDate: values.endDate || null,
    });
  }

  return (
    <FormCard compact onClose={onClose} title={initial ? `Editar ${initial.name}` : 'Nueva factura periódica'}>
      <form className="grid gap-4 sm:grid-cols-2" onSubmit={submit}>
        <div>
          <label className="text-sm font-bold" htmlFor="schedule-name">Nombre</label>
          <input className={inputClass} id="schedule-name" maxLength={120} onChange={set('name')} placeholder="Luz" required value={values.name} />
        </div>
        <div>
          <label className="text-sm font-bold" htmlFor="schedule-category">Categoría</label>
          <select className={inputClass} id="schedule-category" onChange={set('categoryId')} required value={values.categoryId}>
            {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-sm font-bold" htmlFor="schedule-frequency">Cada cuánto llega</label>
          <select className={inputClass} id="schedule-frequency" onChange={set('frequency')} value={values.frequency}>
            {FREQUENCIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
        {values.frequency === 'CUSTOM_MONTHS' ? (
          <div>
            <label className="text-sm font-bold" htmlFor="schedule-months">Cada (meses)</label>
            <input className={inputClass} id="schedule-months" max={120} min={1} onChange={set('intervalMonths')} required type="number" value={values.intervalMonths} />
          </div>
        ) : null}
        {values.frequency === 'CUSTOM_WEEKS' ? (
          <div>
            <label className="text-sm font-bold" htmlFor="schedule-weeks">Cada (semanas)</label>
            <input className={inputClass} id="schedule-weeks" max={520} min={2} onChange={set('intervalWeeks')} required type="number" value={values.intervalWeeks} />
          </div>
        ) : null}
        <div>
          <label className="text-sm font-bold" htmlFor="schedule-next">Próxima factura (aprox.)</label>
          <input className={inputClass} id="schedule-next" onChange={set('nextExpectedDate')} required type="date" value={values.nextExpectedDate} />
        </div>
        <div>
          <label className="text-sm font-bold" htmlFor="schedule-end">Hasta (opcional)</label>
          <input className={inputClass} id="schedule-end" min={values.nextExpectedDate} onChange={set('endDate')} type="date" value={values.endDate} />
        </div>
        <fieldset className="sm:col-span-2">
          <legend className="text-sm font-bold">A quién corresponde</legend>
          <div className="mt-2 flex flex-wrap gap-4">
            {[['HOUSEHOLD', 'Común'], ['PERSONAL', 'Personal']].map(([value, label]) => (
              <label className="inline-flex min-h-11 items-center gap-2" key={value}>
                <input checked={values.scope === value} className="size-4 accent-brand" name="schedule-scope" onChange={() => setValues((current) => ({ ...current, scope: value }))} type="radio" />
                {label}
              </label>
            ))}
          </div>
          {values.scope === 'PERSONAL' ? (
            <div className="mt-2">
              <label className="text-sm font-bold" htmlFor="schedule-person">Persona</label>
              <select className={inputClass} id="schedule-person" onChange={set('personalPersonId')} required value={values.personalPersonId}>
                <option value="">Elige una persona</option>
                {people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
              </select>
            </div>
          ) : null}
        </fieldset>
        {save.isError ? <p className="text-sm text-red-700 sm:col-span-2" role="alert">{save.error.message}</p> : null}
        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <button className={primaryButton} disabled={save.isPending} type="submit">
            {save.isPending ? 'Guardando…' : initial ? 'Guardar cambios' : 'Crear factura periódica'}
          </button>
          {initial ? <button className="inline-flex min-h-11 items-center px-3 text-sm font-bold text-red-800 underline-offset-2 hover:underline" onClick={onDelete} type="button">Eliminar</button> : null}
        </div>
      </form>
    </FormCard>
  );
}

/*
 * "Facturas que se repiten": each one shows its next expected bill with an
 * estimated amount; "Apuntar factura" opens the real-bill form prefilled.
 */
export function InvoiceSchedules({ categories, currency, householdId, onRegister, people, schedules }) {
  const queryClient = useQueryClient();
  const [formFor, setFormFor] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const remove = useMutation({
    mutationFn: financeService.deleteInvoiceSchedule,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: invoiceScheduleKey(householdId) });
      await queryClient.invalidateQueries({ queryKey: ['calendar', householdId] });
      setDeleting(null);
      setFormFor(null);
      toast.success('Factura periódica eliminada. Las facturas apuntadas se conservan.');
    },
  });

  return (
    <section aria-labelledby="invoice-schedules-heading" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-xl font-extrabold tracking-tight" id="invoice-schedules-heading">
          <Repeat aria-hidden="true" className="size-5 text-brand-strong" />Facturas que se repiten
        </h2>
        {formFor === null ? (
          <button className={secondaryButton} onClick={() => setFormFor('new')} type="button">
            <Plus aria-hidden="true" className="size-4" />Nueva factura periódica
          </button>
        ) : null}
      </div>
      {deleting ? (
        <ConfirmationDialog
          confirmLabel="Eliminar factura periódica"
          description="Dejará de aparecer en el calendario. Las facturas que ya apuntaste se conservan."
          isPending={remove.isPending}
          onCancel={() => setDeleting(null)}
          onConfirm={() => remove.mutate({ householdId, scheduleId: deleting.id })}
          pendingLabel="Eliminando…"
          title={`¿Eliminar ${deleting.name}?`}
        />
      ) : null}
      {formFor === 'new' ? <ScheduleForm categories={categories} householdId={householdId} onClose={() => setFormFor(null)} people={people} /> : null}
      {!schedules.length && formFor === null ? (
        <p className="rounded-2xl border border-dashed border-border-strong p-4 text-sm text-text-muted">
          Añade la luz, el gas o el teléfono una vez y la app esperará la siguiente factura con un importe estimado.
        </p>
      ) : null}
      <ul className="space-y-2">
        {schedules.map((schedule) => (
          <li className="rounded-2xl border border-border bg-surface p-4" key={schedule.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-40 flex-1">
                <h3 className="break-words font-extrabold">{schedule.name}</h3>
                <p className="text-sm text-text-muted">
                  {formatFrequency(schedule)} · {schedule.category?.name ?? 'Sin categoría'} · {schedule.scope === 'PERSONAL' ? schedule.personalPerson?.name ?? 'Personal' : 'Común'}
                </p>
                <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold">
                  <CalendarClock aria-hidden="true" className="size-4 text-brand-strong" />
                  {schedule.isActive === false ? 'Pausada' : `Próxima hacia el ${formatCivilDate(isoDate(schedule.nextExpectedDate))}`}
                </p>
              </div>
              <p className="text-right">
                <span className="block text-xs text-text-muted">Estimado</span>
                <span className="text-lg font-extrabold tabular-nums">
                  {schedule.estimate?.amountCents == null ? 'Sin datos' : `≈ ${formatCents(schedule.estimate.amountCents, currency)}`}
                </span>
              </p>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button className={primaryButton} onClick={() => onRegister(schedule)} type="button">
                <Plus aria-hidden="true" className="size-4" />Apuntar factura
              </button>
              <button aria-label={`Editar ${schedule.name}`} className={secondaryButton} onClick={() => setFormFor(formFor === schedule.id ? null : schedule.id)} type="button">
                <Pencil aria-hidden="true" className="size-4" />Editar
              </button>
            </div>
            {formFor === schedule.id ? (
              <div className="mt-3">
                <ScheduleForm categories={categories} householdId={householdId} initial={schedule} onClose={() => setFormFor(null)} onDelete={() => setDeleting(schedule)} people={people} />
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
