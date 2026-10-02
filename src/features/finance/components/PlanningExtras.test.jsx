import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ previewPlanningExtra: vi.fn(), createPlanningExtra: vi.fn(), changePlanningExtra: vi.fn() }));
vi.mock('../financeService', () => ({ financeService: mocks }));
import { PlanningExtras } from './PlanningExtras';

const shares = [{ personId: 'pablo', personName: 'Pablo', amountCents: 4000, confirmedAt: null }, { personId: 'natalia', personName: 'Natalia', amountCents: 4000, confirmedAt: null }];
const extra = { id: 'extra', amountCents: 8000, reason: 'Reparación de la nevera', at: '2026-10-01T12:00:00Z', shares, events: [] };
const planning = { id: 'plan', stateVersion: 0, extras: [], extraFunding: { agreedCents: 0, pendingCents: 0 } };
function setup(overrides = {}) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const onSaved = vi.fn();
  const onStale = vi.fn();
  const tree = (changes = {}) => <QueryClientProvider client={client}><PlanningExtras currency="EUR" householdId="home" planning={{ ...planning, ...overrides, ...changes }} onSaved={onSaved} onStale={onStale} /></QueryClientProvider>;
  const result = render(tree());
  return { ...result, onSaved, onStale, update: (changes) => result.rerender(tree(changes)) };
}

describe('PlanningExtras', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.previewPlanningExtra.mockResolvedValue({ expectedVersion: 0, amountCents: 8000, shares });
    mocks.createPlanningExtra.mockResolvedValue({});
    mocks.changePlanningExtra.mockResolvedValue({});
  });

  it('does not automatically create a transfer from a forecast deviation, and requires preview then agreement', async () => {
    const user = userEvent.setup();
    const { onSaved } = setup({ budgetComparison: { householdDifferenceCents: 8000 } });
    expect(mocks.createPlanningExtra).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Acordar un extra conjunto' }));
    expect(screen.getByLabelText(/Importe extra total/)).toHaveValue('');
    await user.type(screen.getByLabelText(/Importe extra total/), '80,00');
    await user.type(screen.getByLabelText('Motivo del extra'), extra.reason);
    await user.click(screen.getByRole('button', { name: 'Revisar reparto del extra' }));
    expect(mocks.previewPlanningExtra).toHaveBeenCalledWith({ householdId: 'home', planningId: 'plan', body: { expectedVersion: 0, amountCents: 8000 } });
    expect(await screen.findByText(/Reparto con los porcentajes guardados/)).toBeVisible();
    expect(screen.getAllByText(/40,00/)).toHaveLength(2);
    expect(mocks.createPlanningExtra).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Guardar extra pendiente de aportar' }));
    await waitFor(() => expect(mocks.createPlanningExtra).toHaveBeenCalledWith({ householdId: 'home', planningId: 'plan', body: { id: expect.any(String), expectedVersion: 0, amountCents: 8000, reason: extra.reason } }));
    expect(mocks.changePlanningExtra).not.toHaveBeenCalled();
    expect(onSaved).toHaveBeenCalledOnce();
    expect(await screen.findByRole('status')).toHaveTextContent('Queda pendiente de aportar');
  });

  it('confirms a selected person only after explicit review', async () => {
    const user = userEvent.setup();
    setup({ extras: [extra], extraFunding: { agreedCents: 8000, pendingCents: 8000 } });
    await user.click(screen.getByRole('button', { name: 'Confirmar extra de Pablo' }));
    expect(mocks.changePlanningExtra).not.toHaveBeenCalled();
    expect(screen.getByText(/Pablo: 40,00/, { selector: 'form p' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Confirmar aportación realizada' }));
    await waitFor(() => expect(mocks.changePlanningExtra).toHaveBeenCalledWith({ householdId: 'home', planningId: 'plan', extraId: 'extra', body: { expectedVersion: 0, action: 'CONFIRM', personId: 'pablo' } }));
  });

  it('requires a reason to undo an incorrect confirmation and prevents cancelling paid extras', async () => {
    const user = userEvent.setup();
    setup({ extras: [{ ...extra, shares: [{ ...shares[0], confirmedAt: extra.at }, shares[1]] }] });
    expect(screen.queryByRole('button', { name: 'Anular extra pendiente' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Corregir confirmación de Pablo' }));
    expect(screen.getByRole('button', { name: 'Deshacer confirmación errónea' })).toBeDisabled();
    await user.type(screen.getByLabelText('Motivo de la corrección'), 'Fue un error');
    await user.click(screen.getByRole('button', { name: 'Deshacer confirmación errónea' }));
    await waitFor(() => expect(mocks.changePlanningExtra).toHaveBeenCalledWith(expect.objectContaining({ body: { expectedVersion: 0, action: 'REVOKE', personId: 'pablo', reason: 'Fue un error' } })));
  });

  it('allows closing without writing, and cancels a pending extra with a retained reason', async () => {
    const user = userEvent.setup();
    setup({ extras: [extra] });
    await user.click(screen.getByRole('button', { name: 'Anular extra pendiente' }));
    await user.click(screen.getByRole('button', { name: 'Cerrar sin guardar' }));
    expect(mocks.changePlanningExtra).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Anular extra pendiente' }));
    await user.type(screen.getByLabelText('Motivo de la corrección'), 'Lo cubre el colchón');
    await user.click(screen.getByRole('button', { name: 'Anular extra' }));
    await waitFor(() => expect(mocks.changePlanningExtra).toHaveBeenCalledWith(expect.objectContaining({ body: { expectedVersion: 0, action: 'CANCEL', reason: 'Lo cubre el colchón' } })));
  });

  it('retains inputs after a server failure and blocks an action against changed state', async () => {
    const user = userEvent.setup();
    mocks.changePlanningExtra.mockRejectedValue(Object.assign(new Error('Recarga el mes'), { status: 409 }));
    const { update, onStale, onSaved } = setup({ extras: [extra] });
    await user.click(screen.getByRole('button', { name: 'Anular extra pendiente' }));
    await user.type(screen.getByLabelText('Motivo de la corrección'), 'Lo cubre el colchón');
    await user.click(screen.getByRole('button', { name: 'Anular extra' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Recarga el mes');
    expect(screen.getByLabelText('Motivo de la corrección')).toHaveValue('Lo cubre el colchón');
    expect(onStale).toHaveBeenCalledOnce();
    expect(onSaved).not.toHaveBeenCalled();
    update({ stateVersion: 1 });
    expect(screen.getByRole('button', { name: 'Anular extra' })).toBeDisabled();
  });

  it('rejects zero and prevents duplicate submissions or late state changes after leaving', async () => {
    const user = userEvent.setup();
    let resolve;
    mocks.createPlanningExtra.mockReturnValue(new Promise((done) => { resolve = done; }));
    const { unmount, onSaved } = setup();
    await user.click(screen.getByRole('button', { name: 'Acordar un extra conjunto' }));
    await user.type(screen.getByLabelText(/Importe extra total/), '0');
    await user.type(screen.getByLabelText('Motivo del extra'), 'Nevera');
    await user.click(screen.getByRole('button', { name: 'Revisar reparto del extra' }));
    expect(screen.getByRole('alert')).toHaveTextContent('mayor que cero');
    expect(mocks.previewPlanningExtra).not.toHaveBeenCalled();
    await user.clear(screen.getByLabelText(/Importe extra total/));
    await user.type(screen.getByLabelText(/Importe extra total/), '80');
    await user.click(screen.getByRole('button', { name: 'Revisar reparto del extra' }));
    await user.click(await screen.findByRole('button', { name: 'Guardar extra pendiente de aportar' }));
    expect(screen.getByRole('button', { name: 'Guardando…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cerrar sin guardar' })).toBeDisabled();
    unmount();
    await act(async () => resolve({}));
    expect(mocks.createPlanningExtra).toHaveBeenCalledOnce();
    expect(onSaved).toHaveBeenCalledOnce();
  });
});
