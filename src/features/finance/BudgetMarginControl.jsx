import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';

import { financeService } from './financeService';
import { invalidateBudgetQueries } from './invalidateBudgetQueries';
import { SafetyMarginCheckbox } from './SafetyMarginCheckbox';

export function BudgetMarginControl({ householdId, expenseType, group, preference, isLoading = false, error, onRetry }) {
  const queryClient = useQueryClient();
  const save = useMutation({
    mutationFn: financeService.setBudgetMarginPreference,
    onSuccess: async () => {
      await invalidateBudgetQueries(queryClient, householdId);
      toast.success('Margen de seguridad actualizado.');
    },
  });
  const groupName = `${group.category?.name ?? group.categoryName ?? 'Categoría'} · ${group.scope === 'PERSONAL' ? group.personalPerson?.name ?? 'Personal' : 'Común'}`;
  const enabled = preference?.applySafetyMargin === true;
  const available = preference?.availableMarginBps;
  const source = preference?.availableMarginSource === 'CATEGORY'
    ? `de ${group.category?.name ?? group.categoryName ?? 'su categoría'}`
    : preference?.availableMarginSource === 'HOUSEHOLD' ? 'general' : '(sin margen configurado)';
  const unavailable = !preference || Boolean(error);

  return (
    <SafetyMarginCheckbox
      checked={enabled}
      disabled={save.isPending || isLoading || unavailable}
      groupName={groupName}
      help={expenseType === 'INVOICE'
        ? 'El margen solo afecta a la cantidad recomendada del presupuesto. No modifica las facturas guardadas.'
        : 'El margen solo afecta al presupuesto recomendado. No modifica el total registrado del mes ni las medias históricas.'}
      label="Aplicar margen al presupuesto recomendado"
      onChange={(event) => save.mutate({
        householdId,
        body: {
          expenseType,
          categoryId: group.categoryId,
          scope: group.scope ?? 'HOUSEHOLD',
          personalPersonId: group.scope === 'PERSONAL' ? group.personalPersonId : null,
          applySafetyMargin: event.target.checked,
        },
      })}
    >
      <p aria-live="polite" className="mt-2 break-words text-sm font-bold text-brand-strong" role="status">
        {save.isPending ? 'Guardando margen…' : isLoading ? 'Cargando margen…' : unavailable ? 'Margen no disponible' : enabled
          ? `Margen activado · ${(preference.effectiveMarginBps ?? 0) / 100} % ${source}`
          : 'Sin margen'}
      </p>
      {!enabled && !unavailable && available != null ? <p className="mt-1 break-words text-xs text-text-muted">Al activarlo: {available / 100} % {source}.</p> : null}
      {save.isSuccess && !save.isPending ? <p className="mt-1 text-xs text-text-muted" role="status">Preferencia guardada.</p> : null}
      {save.isError || error ? <p className="mt-2 text-sm text-red-700" role="alert">{save.error?.message ?? error?.message ?? 'No se pudo guardar el margen. Inténtalo de nuevo.'}</p> : null}
      {unavailable && !isLoading && onRetry ? <button className="mt-2 min-h-11 rounded-lg px-3 text-sm font-bold text-brand-strong hover:bg-surface focus-visible:outline-2 focus-visible:outline-focus" onClick={onRetry} type="button">Reintentar cargar margen</button> : null}
    </SafetyMarginCheckbox>
  );
}
