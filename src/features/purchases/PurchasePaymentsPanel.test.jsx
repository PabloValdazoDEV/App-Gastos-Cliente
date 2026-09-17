import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ pay: vi.fn(), correct: vi.fn(), revert: vi.fn() }));
vi.mock('./purchasePaymentsService', async (original) => ({ ...await original(), purchasePaymentsService: mocks }));
import { queryKeys } from '../../api/queryKeys';
import { PurchasePaymentsPanel } from './PurchasePaymentsPanel';
import { purchasePaymentToday } from './purchaseInstallmentFormState';

const installment = { id: 'i1', sequence: 1, dueDate: '2026-10-15', expectedAmountCents: 5500, actualAmountCents: null, paidAt: null, status: 'PLANNED', canRegisterPayment: true, notes: null };
const paidInstallment = { ...installment, status: 'PAID', actualAmountCents: 5600, paidAt: '2026-09-16', notes: 'Pago anticipado' };
const purchase = { id: 'purchase', totalCents: 120000, paymentMethod: 'FINANCED', financing: { id: 'f', provider: 'Tienda', downPaymentCents: 20000, downPaymentPaidAt: '2026-09-15', financedPrincipalCents: 100000, financingTotalCents: 110000, installmentCount: 20, installmentAmountCents: 5500, firstInstallmentDate: '2026-10-15', installments: [installment, { ...installment, id: 'i2', sequence: 2, dueDate: '2026-11-15', canRegisterPayment: false }], progress: { paidCents: 20000, pendingCents: 110000, paidInstallmentCount: 0, installmentCount: 20, nextInstallment: installment, costOfFinancingCents: 10000, totalCostCents: 130000 } } };

function fixture(initialPurchase = purchase, initialProps = {}) {
  let current = initialPurchase;
  let props = initialProps;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } } });
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  const onBusyChange = vi.fn();
  function Content() {
    const query = useQuery({ queryKey: queryKeys.purchases.detail(props.householdId ?? 'home', current.id), queryFn: async () => current, initialData: current });
    return <PurchasePaymentsPanel householdId="home" onBusyChange={onBusyChange} purchase={query.data} timezone="Europe/Madrid" {...props} />;
  }
  const tree = () => <QueryClientProvider client={client}><Content /></QueryClientProvider>;
  const result = render(tree());
  return { ...result, client, invalidate, onBusyChange, setServer: (value) => { current = value; }, rerenderProps: (value) => { props = value; result.rerender(tree()); } };
}

async function publishPurchase(ctx, updated) {
  ctx.setServer(updated);
  await act(async () => ctx.client.setQueryData(queryKeys.purchases.detail('home', updated.id), updated));
}

describe('PurchasePaymentsPanel', () => {
  beforeEach(() => vi.clearAllMocks());
  it('distingue precio, entrada, principal, cuotas y costes sin sumar dos veces', () => {
    fixture();
    expect(screen.getByRole('heading', { name: 'Forma de pago · Financiado' })).toBeVisible();
    expect(screen.getByText('Principal financiado').parentElement).toHaveTextContent('1000,00');
    expect(screen.getByText('Coste de financiación').parentElement).toHaveTextContent('100,00');
    expect(screen.getByText('Coste total previsto').parentElement).toHaveTextContent('1300,00');
    expect(screen.getByText('0 / 20 cuotas pagadas')).toBeVisible();
    expect(screen.getByRole('progressbar', { name: 'Cuotas pagadas' })).toHaveAttribute('value', '0');
    expect(screen.getByRole('heading', { name: 'Próxima cuota' }).parentElement).toHaveTextContent('15 oct 2026');
    expect(screen.getByText(/presupuesto/)).toHaveTextContent('pago');
  });
  it('muestra pago al contado confirmado sin inventar una cuota', () => {
    fixture({ id: 'p', paymentMethod: 'UPFRONT', totalCents: 99900, paymentDate: '2026-09-17', paidAmountCents: 99900 });
    expect(screen.getByRole('heading', { name: 'Forma de pago · Al contado' })).toBeVisible();
    expect(screen.getByText('Importe pagado').parentElement).toHaveTextContent('999,00');
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });
  it('no supone pagadas las compras históricas sin datos de pago', () => {
    fixture({ id: 'old', totalCents: 99900 });
    expect(screen.getByText(/Pago sin confirmar/)).toBeVisible();
    expect(screen.queryByText('Importe pagado')).not.toBeInTheDocument();
  });
  it('muestra entrada no confirmada por separado', () => {
    fixture({ ...purchase, financing: { ...purchase.financing, downPaymentPaidAt: null, progress: { ...purchase.financing.progress, paidCents: 0, pendingCents: 130000 } } });
    expect(screen.getByText('Pendiente de confirmar el pago')).toBeVisible();
    expect(screen.getByText('Pagado registrado').parentElement).toHaveTextContent('0,00');
    expect(screen.getByText('Pendiente previsto').parentElement).toHaveTextContent('1300,00');
  });
  it('sin entrada y sin cuotas pendientes presenta estados explícitos', () => {
    fixture({ ...purchase, financing: { ...purchase.financing, downPaymentCents: 0, progress: { ...purchase.financing.progress, nextInstallment: null, paidInstallmentCount: 20 }, installments: [] } });
    expect(screen.getByText('Sin entrada')).toBeVisible();
    expect(screen.getByText('No hay cuotas pendientes.')).toBeVisible();
    expect(screen.getByText('No hay cuotas en este plan.')).toBeVisible();
  });
  it('presenta error si falta el plan sin fabricar importes', () => {
    fixture({ ...purchase, financing: null });
    expect(screen.getByRole('alert')).toHaveTextContent('No se ha podido mostrar la financiación');
  });
  it('anuladas no tienen acciones pagar u omitir', () => {
    fixture({ ...purchase, financing: { ...purchase.financing, installments: [{ ...installment, status: 'CANCELLED' }] } });
    expect(screen.getByText('Anulada')).toBeVisible();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
  it('abre formulario con importe esperado y hoy, y permite pago anticipado', async () => {
    const user = userEvent.setup(); const ctx = fixture();
    const updated = { ...purchase, financing: { ...purchase.financing, installments: [paidInstallment], progress: { ...purchase.financing.progress, paidInstallmentCount: 1, paidCents: 25600 } } };
    mocks.pay.mockImplementation(async () => { ctx.setServer(updated); return updated; });
    await user.click(screen.getByRole('button', { name: 'Marcar cuota 1 como pagada' }));
    const form = screen.getByRole('form', { name: 'Pagar de cuota 1' });
    expect(within(form).getByLabelText('Importe real (€)')).toHaveFocus();
    expect(within(form).getByLabelText('Importe real (€)')).toHaveValue('55.00');
    expect(within(form).getByLabelText('Fecha de pago')).toHaveValue(purchasePaymentToday('Europe/Madrid'));
    await user.clear(within(form).getByLabelText('Importe real (€)'));
    await user.type(within(form).getByLabelText('Importe real (€)'), '56');
    await user.clear(within(form).getByLabelText('Fecha de pago'));
    await user.type(within(form).getByLabelText('Fecha de pago'), '2026-09-16');
    await user.click(within(form).getByRole('button', { name: 'Guardar pago de cuota' }));
    await waitFor(() => expect(mocks.pay).toHaveBeenCalledWith({ householdId: 'home', purchaseId: 'purchase', installmentId: 'i1', body: { actualAmountCents: 5600, paidAt: '2026-09-16', notes: null } }));
    expect(await screen.findByText('Cuota registrada como pagada.')).toBeVisible();
    expect(screen.getByText('1 / 20 cuotas pagadas')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Editar pago de cuota 1' })).toHaveFocus();
    expect(ctx.invalidate.mock.calls.map(([options]) => options.queryKey[0])).toEqual(expect.arrayContaining(['purchases', 'budget', 'dashboard', 'calendar', 'simulation', 'plannings', 'monthlyPlanning']));
    expect(ctx.invalidate.mock.calls.some(([options]) => options.queryKey.includes('documents'))).toBe(false);
    expect(ctx.onBusyChange).toHaveBeenLastCalledWith(false);
  });
  it('cancelar devuelve foco y libera edición de compra', async () => {
    const user = userEvent.setup(); const { onBusyChange } = fixture();
    const button = screen.getByRole('button', { name: 'Marcar cuota 1 como pagada' });
    await user.click(button); await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(button).toHaveFocus(); expect(onBusyChange).toHaveBeenLastCalledWith(false); expect(mocks.pay).not.toHaveBeenCalled();
  });

  it('cierra el borrador de pago si otra sesión paga la cuota, sin convertirlo en corrección', async () => {
    const user = userEvent.setup(); const ctx = fixture();
    await user.click(screen.getByRole('button', { name: 'Marcar cuota 1 como pagada' }));
    await user.type(screen.getByLabelText('Notas del pago (opcional)'), 'Borrador local');
    await publishPurchase(ctx, { ...purchase, financing: { ...purchase.financing, installments: [paidInstallment] } });
    await waitFor(() => expect(screen.queryByRole('form')).not.toBeInTheDocument());
    expect(screen.getByRole('status')).toHaveTextContent('La cuota ha cambiado');
    expect(screen.getByRole('status')).toHaveTextContent('sin guardar');
    expect(screen.getByRole('button', { name: 'Editar pago de cuota 1' })).toHaveFocus();
    expect(screen.queryByText('Cuota registrada como pagada.')).not.toBeInTheDocument();
    expect(mocks.pay).not.toHaveBeenCalled(); expect(mocks.correct).not.toHaveBeenCalled();
    expect(ctx.onBusyChange).toHaveBeenLastCalledWith(false);
  });

  it('cierra el borrador si la cuota deja de ser la primera pendiente y enfoca el encabezado', async () => {
    const user = userEvent.setup(); const ctx = fixture();
    await user.click(screen.getByRole('button', { name: 'Marcar cuota 1 como pagada' }));
    await publishPurchase(ctx, { ...purchase, financing: { ...purchase.financing, installments: [{ ...installment, canRegisterPayment: false }] } });
    await waitFor(() => expect(screen.queryByRole('form')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Marcar cuota 1 como pagada' })).toBeDisabled();
    expect(screen.getByRole('heading', { name: 'Forma de pago · Financiado' })).toHaveFocus();
    expect(screen.getByRole('status')).toHaveTextContent('La cuota ha cambiado');
    expect(mocks.pay).not.toHaveBeenCalled();
  });

  it('descarta la corrección si otra sesión devuelve la cuota a pendiente', async () => {
    const user = userEvent.setup();
    const ctx = fixture({ ...purchase, financing: { ...purchase.financing, installments: [paidInstallment] } });
    await user.click(screen.getByRole('button', { name: 'Editar pago de cuota 1' }));
    await publishPurchase(ctx, purchase);
    await waitFor(() => expect(screen.queryByRole('form')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Marcar cuota 1 como pagada' })).toHaveFocus();
    expect(screen.getByRole('status')).toHaveTextContent('sin guardar');
    expect(mocks.correct).not.toHaveBeenCalled(); expect(mocks.pay).not.toHaveBeenCalled();
  });

  it('cierra la edición si desaparece el plan al cambiar la forma de pago', async () => {
    const user = userEvent.setup(); const ctx = fixture();
    await user.click(screen.getByRole('button', { name: 'Marcar cuota 1 como pagada' }));
    await publishPurchase(ctx, { ...purchase, paymentMethod: 'UPFRONT', financing: null });
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Forma de pago · Al contado' })).toHaveFocus());
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('La cuota ha cambiado');
    expect(ctx.onBusyChange).toHaveBeenLastCalledWith(false);
  });

  it('cierra la confirmación de revertir cuando cambia el importe o fecha reales', async () => {
    const user = userEvent.setup();
    const ctx = fixture({ ...purchase, financing: { ...purchase.financing, installments: [paidInstallment] } });
    await user.click(screen.getByRole('button', { name: 'Volver cuota 1 a pendiente' }));
    await publishPurchase(ctx, { ...purchase, financing: { ...purchase.financing, installments: [{ ...paidInstallment, actualAmountCents: 5700, paidAt: '2026-09-15' }] } });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Volver cuota 1 a pendiente' })).toHaveFocus();
    expect(screen.getByRole('status')).toHaveTextContent('sin guardar');
    expect(mocks.revert).not.toHaveBeenCalled();
  });

  it('conserva el borrador ante una actualización ajena a los datos de la cuota', async () => {
    const user = userEvent.setup(); const ctx = fixture();
    await user.click(screen.getByRole('button', { name: 'Marcar cuota 1 como pagada' }));
    await user.type(screen.getByLabelText('Notas del pago (opcional)'), 'No perder esta nota');
    await publishPurchase(ctx, { ...purchase, financing: { ...purchase.financing, provider: 'Otra entidad' } });
    await waitFor(() => expect(screen.getByText('Otra entidad')).toBeVisible());
    expect(screen.getByLabelText('Notas del pago (opcional)')).toHaveValue('No perder esta nota');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(ctx.onBusyChange).toHaveBeenLastCalledWith(true);
  });

  it('no interrumpe su propio pago pendiente y conserva el éxito y el foco al terminar', async () => {
    const user = userEvent.setup(); const ctx = fixture(); let resolve;
    mocks.pay.mockReturnValue(new Promise((done) => { resolve = done; }));
    await user.click(screen.getByRole('button', { name: 'Marcar cuota 1 como pagada' }));
    await user.click(screen.getByRole('button', { name: 'Guardar pago de cuota' }));
    const updated = { ...purchase, financing: { ...purchase.financing, installments: [paidInstallment] } };
    await publishPurchase(ctx, updated);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Editar pago de cuota 1' })).toBeDisabled());
    expect(screen.getByRole('form', { name: 'Pagar de cuota 1' })).toBeVisible();
    expect(screen.queryByText(/La cuota ha cambiado/)).not.toBeInTheDocument();
    await act(async () => resolve(updated));
    expect(await screen.findByText('Cuota registrada como pagada.')).toBeVisible();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Editar pago de cuota 1' })).toHaveFocus());
    expect(screen.queryByText(/La cuota ha cambiado/)).not.toBeInTheDocument();
  });

  it.each([
    ['pay', 'Marcar cuota 1 como pagada', 'Guardar pago de cuota'],
    ['correct', 'Editar pago de cuota 1', 'Guardar corrección del pago'],
    ['revert', 'Volver cuota 1 a pendiente', 'Confirmar vuelta a pendiente'],
  ])('un conflicto de %s refresca compra y finanzas, cierra la acción y no muestra éxito', async (action, trigger, submit) => {
    const user = userEvent.setup();
    const paid = { ...purchase, financing: { ...purchase.financing, installments: [paidInstallment] } };
    const ctx = fixture(action === 'pay' ? purchase : paid);
    mocks[action].mockImplementation(async () => {
      ctx.setServer(action === 'pay' ? paid : purchase);
      throw Object.assign(new Error('La cuota ha cambiado'), { status: 409 });
    });
    await user.click(screen.getByRole('button', { name: trigger }));
    await user.click(screen.getByRole('button', { name: submit }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('no se ha guardado tu solicitud'));
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByText(/Cuota registrada como pagada|Pago corregido\.|Cuota devuelta a pendiente\./)).not.toBeInTheDocument();
    expect(ctx.invalidate.mock.calls.map(([options]) => options.queryKey[0])).toEqual(expect.arrayContaining(['purchases', 'budget', 'dashboard', 'calendar', 'simulation', 'plannings', 'monthlyPlanning']));
    expect(ctx.invalidate.mock.calls.every(([options]) => options.refetchType !== 'none')).toBe(true);
    const focusTarget = action === 'revert'
      ? screen.getByRole('heading', { name: 'Forma de pago · Financiado' })
      : screen.getByRole('button', { name: action === 'pay' ? 'Editar pago de cuota 1' : 'Marcar cuota 1 como pagada' });
    await waitFor(() => expect(focusTarget).toHaveFocus());
    expect(ctx.onBusyChange).toHaveBeenLastCalledWith(false);
    expect(mocks[action]).toHaveBeenCalledTimes(1);
  });

  it('un 409 tardío tras cambiar de hogar solo invalida sin reconsultar ni mostrar avisos', async () => {
    const user = userEvent.setup(); const ctx = fixture(); let reject;
    mocks.pay.mockReturnValue(new Promise((_done, fail) => { reject = fail; }));
    await user.click(screen.getByRole('button', { name: 'Marcar cuota 1 como pagada' }));
    await user.click(screen.getByRole('button', { name: 'Guardar pago de cuota' }));
    ctx.rerenderProps({ householdId: 'other' });
    const newHouseholdPurchase = ctx.client.getQueryData(queryKeys.purchases.detail('other', 'purchase'));
    await act(async () => reject(Object.assign(new Error('Cuota ya pagada'), { status: 409 })));
    await waitFor(() => expect(ctx.invalidate).toHaveBeenCalled());
    expect(ctx.invalidate.mock.calls.every(([options]) => options.refetchType === 'none')).toBe(true);
    expect(ctx.client.getQueryData(queryKeys.purchases.detail('other', 'purchase'))).toBe(newHouseholdPurchase);
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('respeta el orden indicado por backend y habilita la siguiente cuota tras guardar', async () => {
    const user = userEvent.setup(); const ctx = fixture();
    expect(screen.getByRole('button', { name: 'Marcar cuota 1 como pagada' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Marcar cuota 2 como pagada' })).toBeDisabled();
    expect(screen.getByText(/Solo se puede anticipar la primera cuota pendiente/)).toBeVisible();
    const updated = { ...purchase, financing: { ...purchase.financing, installments: [paidInstallment, { ...purchase.financing.installments[1], canRegisterPayment: true }] } };
    mocks.pay.mockImplementation(async () => { ctx.setServer(updated); return updated; });
    await user.click(screen.getByRole('button', { name: 'Marcar cuota 1 como pagada' }));
    await user.click(screen.getByRole('button', { name: 'Guardar pago de cuota' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Marcar cuota 2 como pagada' })).toBeEnabled());
    expect(screen.queryByRole('button', { name: /omitir/i })).not.toBeInTheDocument();
  });

  it('no adivina permisos cuando falta canRegisterPayment', () => {
    fixture({ ...purchase, financing: { ...purchase.financing, installments: [{ ...installment, canRegisterPayment: undefined }] } });
    expect(screen.getByRole('button', { name: 'Marcar cuota 1 como pagada' })).toBeDisabled();
  });
  it('error conserva datos introducidos y permite reintentar', async () => {
    const user = userEvent.setup(); fixture(); mocks.pay.mockRejectedValue(new Error('No se puede registrar ahora'));
    await user.click(screen.getByRole('button', { name: 'Marcar cuota 1 como pagada' }));
    await user.type(screen.getByLabelText('Notas del pago (opcional)'), 'Conservar nota');
    await user.click(screen.getByRole('button', { name: 'Guardar pago de cuota' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No se puede registrar ahora');
    expect(screen.getByLabelText('Notas del pago (opcional)')).toHaveValue('Conservar nota');
  });
  it('errores de entrada enfocan campo y no llaman API', async () => {
    const user = userEvent.setup(); fixture();
    await user.click(screen.getByRole('button', { name: 'Marcar cuota 1 como pagada' }));
    await user.clear(screen.getByLabelText('Importe real (€)'));
    await user.click(screen.getByRole('button', { name: 'Guardar pago de cuota' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('mayor que cero');
    await waitFor(() => expect(screen.getByLabelText('Importe real (€)')).toHaveFocus());
    expect(mocks.pay).not.toHaveBeenCalled();
  });
  it('corrige importe, fecha y notas de una cuota ya pagada', async () => {
    const user = userEvent.setup(); const paid = { ...purchase, financing: { ...purchase.financing, installments: [paidInstallment] } };
    const ctx = fixture(paid); mocks.correct.mockResolvedValue(paid);
    await user.click(screen.getByRole('button', { name: 'Editar pago de cuota 1' }));
    expect(screen.getByLabelText('Importe real (€)')).toHaveValue('56.00');
    expect(screen.getByLabelText('Fecha de pago')).toHaveValue('2026-09-16');
    expect(screen.getByLabelText('Notas del pago (opcional)')).toHaveValue('Pago anticipado');
    await user.click(screen.getByRole('button', { name: 'Guardar corrección del pago' }));
    expect(await screen.findByText('Pago corregido. Se conserva la auditoría del cambio.')).toBeVisible();
    expect(mocks.correct).toHaveBeenCalledTimes(1); expect(mocks.pay).not.toHaveBeenCalled(); expect(ctx.onBusyChange).toHaveBeenLastCalledWith(false);
  });
  it('volver a pendiente requiere confirmación y conserva foco accesible', async () => {
    const user = userEvent.setup(); const paid = { ...purchase, financing: { ...purchase.financing, installments: [paidInstallment] } };
    const ctx = fixture(paid); mocks.revert.mockImplementation(async () => { ctx.setServer(purchase); return purchase; });
    const button = screen.getByRole('button', { name: 'Volver cuota 1 a pendiente' });
    await user.click(button);
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('button', { name: 'Cancelar' })).toHaveFocus();
    expect(dialog).toHaveTextContent('corregir un registro erróneo'); expect(mocks.revert).not.toHaveBeenCalled();
    await user.tab({ shift: true }); expect(within(dialog).getByRole('button', { name: 'Confirmar vuelta a pendiente' })).toHaveFocus();
    await user.keyboard('{Escape}'); expect(screen.queryByRole('dialog')).not.toBeInTheDocument(); expect(button).toHaveFocus();
    await user.click(button);
    const discardedFocus = vi.spyOn(button, 'focus');
    await user.click(screen.getByRole('button', { name: 'Confirmar vuelta a pendiente' }));
    expect(await screen.findByText('Cuota devuelta a pendiente. La corrección queda auditada.')).toBeVisible();
    expect(mocks.revert).toHaveBeenCalledWith({ householdId: 'home', purchaseId: 'purchase', installmentId: 'i1' });
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Forma de pago · Financiado' })).toHaveFocus());
    expect(discardedFocus).not.toHaveBeenCalled();
    discardedFocus.mockRestore();
  });
  it('aplaza restaurar el foco si las acciones están bloqueadas externamente', async () => {
    const user = userEvent.setup(); const ctx = fixture();
    await user.click(screen.getByRole('button', { name: 'Marcar cuota 1 como pagada' }));
    ctx.rerenderProps({ disabled: true });
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.getByRole('button', { name: 'Marcar cuota 1 como pagada' })).toBeDisabled();
    expect(screen.getByRole('heading', { name: 'Forma de pago · Financiado' })).not.toHaveFocus();
    ctx.rerenderProps({ disabled: false });
    expect(screen.getByRole('button', { name: 'Marcar cuota 1 como pagada' })).toHaveFocus();
  });
  it('rechazo de corrección conserva confirmación con mensaje', async () => {
    const user = userEvent.setup(); fixture({ ...purchase, financing: { ...purchase.financing, installments: [paidInstallment] } });
    mocks.revert.mockRejectedValue(new Error('No se puede corregir ahora'));
    await user.click(screen.getByRole('button', { name: 'Volver cuota 1 a pendiente' })); await user.click(screen.getByRole('button', { name: 'Confirmar vuelta a pendiente' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No se puede corregir ahora'); expect(screen.getByRole('dialog')).toBeVisible();
  });
  it('impide envíos duplicados y cierra acciones durante guardado', async () => {
    const user = userEvent.setup(); fixture(); let resolve;
    mocks.pay.mockReturnValue(new Promise((done) => { resolve = done; }));
    await user.click(screen.getByRole('button', { name: 'Marcar cuota 1 como pagada' }));
    await user.dblClick(screen.getByRole('button', { name: 'Guardar pago de cuota' }));
    expect(mocks.pay).toHaveBeenCalledTimes(1); expect(screen.getByRole('button', { name: 'Guardando pago…' })).toBeDisabled(); expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    await act(async () => resolve(purchase));
  });
  it('no publica respuesta tardía después de desmontar', async () => {
    const user = userEvent.setup(); const ctx = fixture(); let resolve;
    mocks.pay.mockReturnValue(new Promise((done) => { resolve = done; }));
    await user.click(screen.getByRole('button', { name: 'Marcar cuota 1 como pagada' })); await user.click(screen.getByRole('button', { name: 'Guardar pago de cuota' }));
    ctx.unmount(); ctx.client.removeQueries();
    await act(async () => resolve(purchase));
    expect(ctx.client.getQueryData(queryKeys.purchases.detail('home', 'purchase'))).toBeUndefined();
    expect(ctx.invalidate).toHaveBeenCalledWith(expect.objectContaining({ refetchType: 'none' }));
  });
  it('cambiar hogar descarta formulario y errores anteriores', async () => {
    const user = userEvent.setup(); const ctx = fixture();
    await user.click(screen.getByRole('button', { name: 'Marcar cuota 1 como pagada' }));
    ctx.rerenderProps({ householdId: 'other' });
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
  });
  it('pérdida de acceso oculta datos y formulario inmediatamente', async () => {
    const user = userEvent.setup(); fixture(); mocks.pay.mockRejectedValue(Object.assign(new Error('Compra no disponible'), { status: 404 }));
    await user.click(screen.getByRole('button', { name: 'Marcar cuota 1 como pagada' })); await user.click(screen.getByRole('button', { name: 'Guardar pago de cuota' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pueden consultar los pagos');
    expect(screen.queryByRole('list')).not.toBeInTheDocument(); expect(screen.queryByRole('form')).not.toBeInTheDocument();
  });
  it('no deja modificar cuotas mientras se edita la compra', () => {
    fixture(purchase, { disabled: true });
    expect(screen.getByRole('button', { name: 'Marcar cuota 1 como pagada' })).toBeDisabled();
  });
  it('conserva nombres y notas largos sin truncar información', () => {
    const long = 'Entidad'.repeat(28);
    fixture({ ...purchase, financing: { ...purchase.financing, provider: long, installments: [{ ...installment, notes: 'Nota'.repeat(500) }] } });
    expect(screen.getByText(long)).toBeVisible();
    expect(screen.getByText('Nota'.repeat(500))).toBeVisible();
  });
});
