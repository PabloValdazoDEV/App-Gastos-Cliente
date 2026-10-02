import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ fundPlanning: vi.fn(), planningRevisionPreview: vi.fn(), revisePlanning: vi.fn() }));
vi.mock('../financeService', () => ({ financeService: mocks }));
import { PlanningCorrections } from './PlanningCorrections';

const contribution = { householdPersonId: 'pablo', personName: 'Pablo', standardHouseholdCents: 10000, personalExpenseCents: 5000, temporaryAdjustmentCents: 0, totalRecommendedCents: 15000, canConfirmPersonal: true, funding: { commonConfirmed: true, personalConfirmed: true } };
const planning = { id: 'plan', stateVersion: 1, canRevise: false, householdBudgetCents: 10000, contributions: [contribution], revisionHistory: [{ revision: 0, at: '2026-10-01T12:00:00Z', householdBudgetCents: 10000, contributions: [contribution] }], fundingHistory: [{ action: 'CONFIRM', scope: 'HOUSEHOLD', at: '2026-10-01T12:00:00Z' }] };
function setup(overrides = {}) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const onSaved = vi.fn();
  const tree = (extra = {}) => <QueryClientProvider client={client}><PlanningCorrections currency="EUR" householdId="home" planning={{ ...planning, ...overrides, ...extra }} onSaved={onSaved} /></QueryClientProvider>;
  const result = render(tree());
  return { ...result, onSaved, update: (extra) => result.rerender(tree(extra)) };
}
describe('PlanningCorrections', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.fundPlanning.mockResolvedValue({});
    mocks.revisePlanning.mockResolvedValue({});
    mocks.planningRevisionPreview.mockResolvedValue({ expectedVersion: 1, previewFingerprint: 'preview-hash', householdBudgetCents: 20000, contributions: [{ ...contribution, standardHouseholdCents: 20000, totalRecommendedCents: 25000 }] });
  });

  it.each([['conjunta', 'HOUSEHOLD'], ['personal', 'PERSONAL']])('requires review and a reason before undoing the %s confirmation', async (label, scope) => {
    const user = userEvent.setup();
    const { onSaved } = setup();
    await user.click(screen.getByRole('button', { name: label === 'personal' ? 'Corregir mi confirmación personal' : 'Corregir confirmación conjunta' }));
    expect(screen.getByText(/no se devolverá dinero/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Deshacer confirmación' })).toBeDisabled();
    expect(mocks.fundPlanning).not.toHaveBeenCalled();
    await user.type(screen.getByLabelText('Motivo de la corrección'), 'Confirmé por error');
    await user.click(screen.getByRole('button', { name: 'Deshacer confirmación' }));
    await waitFor(() => expect(mocks.fundPlanning).toHaveBeenCalledWith({ householdId: 'home', planningId: 'plan', action: 'REVOKE', scope, expectedVersion: 1, reason: 'Confirmé por error' }));
    expect(onSaved).toHaveBeenCalledOnce();
  });

  it('lets the user cancel without writing and keeps the original history readable', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole('button', { name: 'Corregir confirmación conjunta' }));
    await user.type(screen.getByLabelText('Motivo de la corrección'), 'Borrador');
    await user.click(screen.getByRole('button', { name: 'Cancelar corrección' }));
    expect(mocks.fundPlanning).not.toHaveBeenCalled();
    await user.click(screen.getByText('Historial de previsión y confirmaciones'));
    expect(screen.getByText(/Previsión original/)).toBeVisible();
  });

  it('shows the new amount before explicit revision and submits the server fingerprint, not client sums', async () => {
    const user = userEvent.setup();
    const { onSaved } = setup({ canRevise: true, contributions: [{ ...contribution, funding: { commonConfirmed: false, personalConfirmed: false } }] });
    await user.click(screen.getByRole('button', { name: 'Revisar importes antes de aportar' }));
    expect(mocks.planningRevisionPreview).toHaveBeenCalledWith({ householdId: 'home', planningId: 'plan' });
    expect(await screen.findByText(/Previsión común: 100,00.*200,00/)).toBeVisible();
    expect(screen.getByText(/Los personales de los demás y el ajuste temporal guardado se conservan/)).toBeVisible();
    expect(mocks.revisePlanning).not.toHaveBeenCalled();
    await user.type(screen.getByLabelText('Motivo de la corrección'), 'Faltaba un gasto');
    await user.click(screen.getByRole('button', { name: 'Guardar nueva revisión' }));
    await waitFor(() => expect(mocks.revisePlanning).toHaveBeenCalledWith({ householdId: 'home', planningId: 'plan', body: { expectedVersion: 1, previewFingerprint: 'preview-hash', reason: 'Faltaba un gasto' } }));
    expect(onSaved).toHaveBeenCalledOnce();
  });

  it('keeps the form and reason after a server conflict, without pretending success', async () => {
    const user = userEvent.setup();
    mocks.fundPlanning.mockRejectedValue(new Error('La previsión ha cambiado'));
    const { onSaved } = setup();
    await user.click(screen.getByRole('button', { name: 'Corregir confirmación conjunta' }));
    await user.type(screen.getByLabelText('Motivo de la corrección'), 'Error');
    await user.click(screen.getByRole('button', { name: 'Deshacer confirmación' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('La previsión ha cambiado');
    expect(screen.getByLabelText('Motivo de la corrección')).toHaveValue('Error');
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('blocks stale or in-flight corrections and does not offer another person’s personal action', async () => {
    const user = userEvent.setup();
    const { update } = setup({ contributions: [{ ...contribution, canConfirmPersonal: false, personalAmountsHidden: true }] });
    expect(screen.queryByRole('button', { name: 'Corregir mi confirmación personal' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Revisar importes antes de aportar' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Corregir confirmación conjunta' }));
    await user.type(screen.getByLabelText('Motivo de la corrección'), 'Error');
    update({ stateVersion: 2 });
    expect(screen.getByRole('button', { name: 'Deshacer confirmación' })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('La previsión ha cambiado');
  });

  it('disables duplicate submissions and handles late completion after leaving the month', async () => {
    const user = userEvent.setup();
    let finish;
    mocks.fundPlanning.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    const { unmount, onSaved } = setup();
    await user.click(screen.getByRole('button', { name: 'Corregir confirmación conjunta' }));
    await user.type(screen.getByLabelText('Motivo de la corrección'), 'Error');
    await user.click(screen.getByRole('button', { name: 'Deshacer confirmación' }));
    expect(screen.getByRole('button', { name: 'Guardando corrección…' })).toBeDisabled();
    unmount();
    await act(async () => finish({}));
    expect(mocks.fundPlanning).toHaveBeenCalledOnce();
    expect(onSaved).toHaveBeenCalledOnce();
  });
});
