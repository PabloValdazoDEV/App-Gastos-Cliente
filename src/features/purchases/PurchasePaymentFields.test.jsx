import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { PurchaseForm } from './PurchaseForm';

const purchase = { id: 'purchase', totalCents: 120000, purchaseDate: '2026-09-17', ownershipType: 'HOUSEHOLD', shares: [], items: [{ id: 'phone', name: 'Móvil', quantity: 1 }], paymentMethod: 'FINANCED', financing: { provider: 'Banco', downPaymentCents: 20000, downPaymentPaidAt: null, financedPrincipalCents: 100000, installmentCount: 20, installmentAmountCents: 5500, firstInstallmentDate: '2026-10-15', financingTotalCents: 110000, installments: [{ status: 'PLANNED' }], progress: { paidInstallmentCount: 0 } } };

function setup(props = {}) {
  const onSubmit = vi.fn().mockResolvedValue({});
  const onCancel = vi.fn();
  const view = render(<PurchaseForm people={[]} onSubmit={onSubmit} onCancel={onCancel} {...props} />);
  return { ...view, onSubmit, onCancel, user: userEvent.setup() };
}

async function fillBasic(user) {
  await user.type(screen.getByLabelText('Total de la compra (€)'), '1200');
  await user.type(screen.getByLabelText('Nombre del producto'), 'Móvil');
  fireEvent.change(screen.getByLabelText('Fecha de compra'), { target: { value: '2026-09-17' } });
}

async function fillFinancing(user) {
  await user.click(screen.getByRole('radio', { name: 'Financiado' }));
  await user.clear(screen.getByLabelText('Entrada (€)'));
  await user.type(screen.getByLabelText('Entrada (€)'), '200');
  await user.type(screen.getByLabelText('Entidad o tienda financiera (opcional)'), 'Banco');
  await user.type(screen.getByLabelText('Número de cuotas'), '20');
  await user.type(screen.getByLabelText('Importe habitual de cuota (€)'), '55');
  fireEvent.change(screen.getByLabelText('Primera cuota'), { target: { value: '2026-10-15' } });
  await user.type(screen.getByLabelText('Total a pagar en cuotas (€)'), '1100');
}

describe('purchase payment fields', () => {
  it('has two visible keyboard-accessible payment methods and shows only upfront fields initially', async () => {
    const { user } = setup();
    expect(screen.getByRole('group', { name: 'Forma de pago' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Al contado' })).toBeChecked();
    expect(screen.getByLabelText('Fecha de pago')).toHaveAttribute('type', 'date');
    expect(screen.queryByLabelText('Número de cuotas')).not.toBeInTheDocument();
    expect(screen.getByText(/quedarán registrados como un pago realizado/)).toBeInTheDocument();
    screen.getByRole('radio', { name: 'Al contado' }).focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', { name: 'Financiado' })).toBeChecked();
    expect(screen.queryByLabelText('Fecha de pago')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Primera cuota')).toBeInTheDocument();
  });

  it('defaults upfront date and amount to purchase inputs until they are explicitly edited', async () => {
    const { user, onSubmit } = setup();
    await fillBasic(user);
    expect(screen.getByLabelText('Fecha de pago')).toHaveValue('2026-09-17');
    expect(screen.getByLabelText('Importe pagado (€)')).toHaveValue('1200');
    fireEvent.change(screen.getByLabelText('Fecha de pago'), { target: { value: '2026-09-16' } });
    await user.clear(screen.getByLabelText('Importe pagado (€)'));
    await user.type(screen.getByLabelText('Importe pagado (€)'), '1190,50');
    fireEvent.change(screen.getByLabelText('Fecha de compra'), { target: { value: '2026-09-18' } });
    await user.clear(screen.getByLabelText('Total de la compra (€)'));
    await user.type(screen.getByLabelText('Total de la compra (€)'), '1250');
    expect(screen.getByLabelText('Fecha de pago')).toHaveValue('2026-09-16');
    expect(screen.getByLabelText('Importe pagado (€)')).toHaveValue('1190,50');
    await user.click(screen.getByRole('button', { name: 'Guardar compra' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ totalCents: 125000, paymentMethod: 'UPFRONT', paymentDate: '2026-09-16', paidAmountCents: 119050 });
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty('financing');
  });

  it('shows the complete financing summary and saves an unconfirmed entry separately from installments', async () => {
    const { user, onSubmit } = setup();
    await fillBasic(user);
    await fillFinancing(user);
    const summary = screen.getByRole('region', { name: 'Resumen de financiación' });
    for (const [label, amount] of [['Precio de compra', '1200,00'], ['Entrada', '200,00'], ['Principal financiado', '1000,00'], ['Total de cuotas', '1100,00'], ['Coste de financiación', '100,00'], ['Coste total final', '1300,00']]) {
      expect(within(summary).getByText(label).parentElement).toHaveTextContent(amount);
    }
    expect(screen.getByRole('checkbox', { name: 'La entrada ya está pagada' })).not.toBeChecked();
    expect(screen.queryByLabelText('Fecha de pago de la entrada')).not.toBeInTheDocument();
    expect(screen.getByText(/La entrada quedará pendiente/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Guardar compra' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    expect(onSubmit.mock.calls[0][0].financing).toEqual({ provider: 'Banco', downPaymentCents: 20000, downPaymentPaidAt: null, installmentCount: 20, installmentAmountCents: 5500, firstInstallmentDate: '2026-10-15', financingTotalCents: 110000 });
  });

  it('records an entry only after selecting its checkbox and date', async () => {
    const { user, onSubmit } = setup();
    await fillBasic(user);
    await fillFinancing(user);
    await user.click(screen.getByRole('checkbox', { name: 'La entrada ya está pagada' }));
    expect(screen.getByLabelText('Fecha de pago de la entrada')).toHaveValue('2026-09-17');
    fireEvent.change(screen.getByLabelText('Fecha de pago de la entrada'), { target: { value: '2026-09-16' } });
    await user.click(screen.getByRole('button', { name: 'Guardar compra' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    expect(onSubmit.mock.calls[0][0].financing.downPaymentPaidAt).toBe('2026-09-16');
  });

  it('explains cent adjustment in the last installment', async () => {
    const { user } = setup();
    await user.type(screen.getByLabelText('Total de la compra (€)'), '100');
    await user.click(screen.getByRole('radio', { name: 'Financiado' }));
    await user.type(screen.getByLabelText('Número de cuotas'), '3');
    await user.type(screen.getByLabelText('Importe habitual de cuota (€)'), '33,33');
    await user.type(screen.getByLabelText('Total a pagar en cuotas (€)'), '100');
    expect(screen.getByText(/Última cuota ajustada/)).toHaveTextContent('33,34');
    expect(screen.getByLabelText('Primera cuota')).toHaveAccessibleDescription(/meses naturales/);
  });

  it('associates financing errors and focuses the first invalid field', async () => {
    const { user, onSubmit } = setup();
    await fillBasic(user);
    await fillFinancing(user);
    await user.clear(screen.getByLabelText('Entrada (€)'));
    await user.type(screen.getByLabelText('Entrada (€)'), '1201');
    await user.click(screen.getByRole('button', { name: 'Guardar compra' }));
    expect(await screen.findByText('La entrada no puede superar el precio de compra.')).toBeInTheDocument();
    expect(screen.getByLabelText('Entrada (€)')).toHaveAccessibleDescription('La entrada no puede superar el precio de compra.');
    await waitFor(() => expect(screen.getByLabelText('Entrada (€)')).toHaveFocus());
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('ignores hidden incomplete financing after returning to upfront', async () => {
    const { user, onSubmit } = setup();
    await fillBasic(user);
    await user.click(screen.getByRole('radio', { name: 'Financiado' }));
    await user.type(screen.getByLabelText('Número de cuotas'), '0');
    await user.click(screen.getByRole('radio', { name: 'Al contado' }));
    await user.click(screen.getByRole('button', { name: 'Guardar compra' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ paymentMethod: 'UPFRONT', paidAmountCents: 120000 });
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty('financing');
  });

  it('does not silently confirm cash payment when editing a legacy purchase', async () => {
    const legacy = { ...purchase, paymentMethod: 'UPFRONT', financing: null, paymentDate: null, paidAmountCents: null };
    const { user, onSubmit } = setup({ initialPurchase: legacy });
    expect(screen.getByRole('checkbox', { name: 'Confirmo que la compra está pagada' })).not.toBeChecked();
    expect(screen.queryByLabelText('Fecha de pago')).not.toBeInTheDocument();
    expect(screen.getByText(/Editar sus otros datos no registra ningún pago/)).toBeInTheDocument();
    await user.type(screen.getByLabelText('Tienda (opcional)'), 'Otra tienda');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios de la compra' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty('paymentMethod');
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty('paymentDate');
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty('paidAmountCents');
  });

  it('allows explicit confirmation of legacy cash payment without inventing a financing', async () => {
    const legacy = { ...purchase, paymentMethod: 'UPFRONT', financing: null, paymentDate: null, paidAmountCents: null };
    const { user, onSubmit } = setup({ initialPurchase: legacy });
    await user.click(screen.getByRole('checkbox', { name: 'Confirmo que la compra está pagada' }));
    expect(screen.getByLabelText('Fecha de pago')).toHaveValue('2026-09-17');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios de la compra' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ paymentMethod: 'UPFRONT', paymentDate: '2026-09-17', paidAmountCents: 120000 });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('edits provider only with paid installments and keeps structural fields read-only', async () => {
    const paid = { ...purchase, financing: { ...purchase.financing, installments: [{ status: 'PAID' }], progress: { paidInstallmentCount: 1 } } };
    const { user, onSubmit } = setup({ initialPurchase: paid });
    expect(screen.getByText(/Ya existen cuotas registradas como pagadas/)).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Al contado' })).toBeDisabled();
    expect(screen.getByRole('radio', { name: 'Financiado' })).toBeDisabled();
    for (const label of ['Total de la compra (€)', 'Entrada (€)', 'Número de cuotas', 'Importe habitual de cuota (€)', 'Primera cuota', 'Total a pagar en cuotas (€)']) expect(screen.getByLabelText(label)).toHaveAttribute('readonly');
    await user.clear(screen.getByLabelText('Entidad o tienda financiera (opcional)'));
    await user.type(screen.getByLabelText('Entidad o tienda financiera (opcional)'), 'Nueva entidad');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios de la compra' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    expect(onSubmit.mock.calls[0][0].financing).toEqual({ provider: 'Nueva entidad' });
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty('paymentMethod');
  });

  it('allows regenerating unpaid installments and changing financed to upfront without paid history', async () => {
    const { user, onSubmit } = setup({ initialPurchase: purchase });
    expect(screen.getByLabelText('Número de cuotas')).not.toHaveAttribute('readonly');
    await user.click(screen.getByRole('radio', { name: 'Al contado' }));
    await user.click(screen.getByRole('button', { name: 'Guardar cambios de la compra' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ paymentMethod: 'UPFRONT', paymentDate: '2026-09-17', paidAmountCents: 120000 });
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty('financing');
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty('confirmPaymentReset');
  });

  it('requires confirmation before replacing a recorded upfront payment by financing', async () => {
    const upfront = { ...purchase, paymentMethod: 'UPFRONT', financing: null, paymentDate: '2026-09-17', paidAmountCents: 120000 };
    const { user, onSubmit } = setup({ initialPurchase: upfront });
    await fillFinancing(user);
    await user.click(screen.getByRole('button', { name: 'Guardar cambios de la compra' }));
    const dialog = await screen.findByRole('dialog', { name: '¿Modificar el pago registrado?' });
    expect(onSubmit).not.toHaveBeenCalled();
    expect(within(dialog).getByRole('button', { name: 'Cancelar' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guardar cambios de la compra' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Guardar cambios de la compra' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Confirmar cambio de pago' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ paymentMethod: 'FINANCED', confirmPaymentReset: true });
  });

  it('confirms clearing an entry payment and changing financed to upfront', async () => {
    const withEntry = { ...purchase, financing: { ...purchase.financing, downPaymentPaidAt: '2026-09-17' } };
    const { user, onSubmit } = setup({ initialPurchase: withEntry });
    await user.click(screen.getByRole('radio', { name: 'Al contado' }));
    await user.click(screen.getByRole('button', { name: 'Guardar cambios de la compra' }));
    expect(onSubmit).not.toHaveBeenCalled();
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Confirmar cambio de pago' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ paymentMethod: 'UPFRONT', confirmPaymentReset: true });
  });

  it('protects removing a recorded entry payment with confirmation and preserves financing metadata', async () => {
    const withEntry = { ...purchase, financing: { ...purchase.financing, downPaymentPaidAt: '2026-09-17' } };
    const { user, onSubmit } = setup({ initialPurchase: withEntry });
    await user.click(screen.getByRole('checkbox', { name: 'La entrada ya está pagada' }));
    await user.click(screen.getByRole('button', { name: 'Guardar cambios de la compra' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Confirmar cambio de pago' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ financing: { downPaymentPaidAt: null }, confirmPaymentReset: true });
  });

  it('blocks duplicate submission of payment confirmation while pending', async () => {
    let resolve;
    const waiting = new Promise((done) => { resolve = done; });
    const withEntry = { ...purchase, financing: { ...purchase.financing, downPaymentPaidAt: '2026-09-17' } };
    const { user, onSubmit } = setup({ initialPurchase: withEntry });
    onSubmit.mockReturnValue(waiting);
    await user.click(screen.getByRole('radio', { name: 'Al contado' }));
    await user.click(screen.getByRole('button', { name: 'Guardar cambios de la compra' }));
    const confirm = within(await screen.findByRole('dialog')).getByRole('button', { name: 'Confirmar cambio de pago' });
    await user.dblClick(confirm);
    expect(onSubmit).toHaveBeenCalledOnce();
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Guardando…' })).toBeDisabled();
    await act(async () => { resolve({}); await waiting; });
  });

  it('uses bounded native dates, responsive grids and minimum 44px option targets', async () => {
    const { user } = setup({ initialPurchase: purchase });
    await user.click(screen.getByRole('checkbox', { name: 'La entrada ya está pagada' }));
    for (const label of ['Primera cuota', 'Fecha de pago de la entrada']) {
      const input = screen.getByLabelText(label);
      expect(input).toHaveClass('box-border', 'min-w-0', 'max-w-full');
      expect(input.closest('.date-fields-grid')).toHaveClass('min-w-0');
    }
    for (const label of ['Al contado', 'Financiado']) expect(screen.getByRole('radio', { name: label }).closest('label')).toHaveClass('min-h-12');
    expect(screen.getByRole('checkbox', { name: 'La entrada ya está pagada' }).closest('label')).toHaveClass('min-h-12');
  });
});
