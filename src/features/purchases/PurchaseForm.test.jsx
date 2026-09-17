import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { PurchaseForm } from './PurchaseForm';
import { PurchaseItemForm } from './PurchaseItemForm';

const people = [{ id: 'pablo', name: 'Pablo' }, { id: 'natalia', name: 'Natalia' }, { id: 'ana', name: 'Ana' }];
const item = { id: 'item-1', name: 'iPhone 17', brand: 'Apple', model: '17', quantity: 1, priceCents: 99900, warrantySource: 'DURATION', warrantyDurationMonths: 36, warrantyEndsAt: '2029-09-17' };
const purchase = { id: 'purchase-1', merchant: 'Apple Store', purchaseDate: '2026-09-17', totalCents: 99900, ownershipType: 'PERSONAL', personalPersonId: 'pablo', shares: [], items: [item] };

function setup(props = {}) {
  const onSubmit = vi.fn().mockResolvedValue({});
  const onCancel = vi.fn();
  const view = render(<PurchaseForm people={people} onSubmit={onSubmit} onCancel={onCancel} {...props} />);
  return { ...view, onSubmit, onCancel, user: userEvent.setup() };
}

async function fillBasic(user) {
  await user.type(screen.getByLabelText('Total de la compra (€)'), '999');
  await user.type(screen.getByLabelText('Nombre del producto'), 'iPhone 17');
  fireEvent.change(screen.getByLabelText('Fecha de compra'), { target: { value: '2026-09-17' } });
}

describe('PurchaseForm', () => {
  it('starts with one product and household ownership, allowing zero total without inventing warranty', async () => {
    const { user, onSubmit } = setup();
    expect(screen.getByRole('radio', { name: 'Del hogar' })).toBeChecked();
    expect(screen.getByRole('button', { name: 'Quitar producto 1' })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: 'Tiene garantía' })).not.toBeChecked();
    expect(screen.queryByLabelText('Duración de la garantía')).not.toBeInTheDocument();
    await fillBasic(user);
    await user.click(screen.getByRole('button', { name: 'Guardar compra' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ totalCents: 99900, ownershipType: 'HOUSEHOLD', personalPersonId: null, shares: [], items: [{ name: 'iPhone 17', quantity: 1, priceCents: null, warrantyEndsAt: null, warrantyDurationMonths: null }] });
    expect(screen.getByText(/Los pagos se incorporan al presupuesto de su mes/)).toHaveTextContent('los saldos de tus cuentas no se modifican automáticamente');
  });

  it('uses a personal owner selector and associates its required error', async () => {
    const { user, onSubmit } = setup();
    await fillBasic(user);
    await user.click(screen.getByRole('radio', { name: 'Personal' }));
    expect(screen.getByText('Solo podrá verla la persona propietaria. Si la asignas a otra persona, dejarás de verla.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Guardar compra' }));
    expect(await screen.findByText('Selecciona a quién pertenece la compra.')).toBeInTheDocument();
    expect(screen.getByLabelText('Persona propietaria')).toHaveAccessibleDescription('Selecciona a quién pertenece la compra.');
    expect(onSubmit).not.toHaveBeenCalled();
    await user.selectOptions(screen.getByLabelText('Persona propietaria'), 'pablo');
    await user.click(screen.getByRole('button', { name: 'Guardar compra' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ ownershipType: 'PERSONAL', personalPersonId: 'pablo', shares: [] })));
  });

  it('shows split total and missing/excess amounts, blocking submit until exact valid 60/40', async () => {
    const { user, onSubmit } = setup();
    await fillBasic(user);
    await user.click(screen.getByRole('radio', { name: 'Repartida' }));
    expect(screen.getByText('Solo podrán verla las personas del reparto. Si no participas, dejarás de verla.')).toBeInTheDocument();
    const submit = screen.getByRole('button', { name: 'Guardar compra' });
    expect(submit).toBeDisabled();
    await user.selectOptions(screen.getByLabelText('Persona 1'), 'pablo');
    await user.selectOptions(screen.getByLabelText('Persona 2'), 'natalia');
    await user.type(screen.getByLabelText('Porcentaje de la persona 1 (%)'), '60');
    await user.type(screen.getByLabelText('Porcentaje de la persona 2 (%)'), '30');
    expect(screen.getByText('Total: 90 %')).toBeInTheDocument();
    expect(screen.getByText('Falta 10 % para completar el reparto.')).toBeInTheDocument();
    expect(submit).toBeDisabled();
    await user.clear(screen.getByLabelText('Porcentaje de la persona 2 (%)'));
    await user.type(screen.getByLabelText('Porcentaje de la persona 2 (%)'), '50');
    expect(screen.getByText('Sobra 10 %. Reduce los porcentajes.')).toBeInTheDocument();
    await user.clear(screen.getByLabelText('Porcentaje de la persona 2 (%)'));
    await user.type(screen.getByLabelText('Porcentaje de la persona 2 (%)'), '40');
    expect(screen.getByText('Total: 100 %')).toBeInTheDocument();
    expect(submit).toBeEnabled();
    await user.click(submit);
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ ownershipType: 'SPLIT', shares: [{ householdPersonId: 'pablo', shareBps: 6000 }, { householdPersonId: 'natalia', shareBps: 4000 }] })));
  });

  it('does not allow duplicated participants even if the total is 100 percent', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('radio', { name: 'Repartida' }));
    await user.selectOptions(screen.getByLabelText('Persona 1'), 'pablo');
    await user.selectOptions(screen.getByLabelText('Persona 2'), 'pablo');
    await user.type(screen.getByLabelText('Porcentaje de la persona 1 (%)'), '50');
    await user.type(screen.getByLabelText('Porcentaje de la persona 2 (%)'), '50');
    expect(screen.getByRole('button', { name: 'Guardar compra' })).toBeDisabled();
    expect(await screen.findByText('Esta persona ya participa en el reparto.')).toBeInTheDocument();
  });

  it('focuses added product name and restores focus after removal, retaining the first product', async () => {
    const { user } = setup();
    await user.type(screen.getByLabelText('Nombre del producto'), 'Monitor');
    await user.click(screen.getByRole('button', { name: 'Añadir otro producto' }));
    const names = screen.getAllByLabelText('Nombre del producto');
    expect(names).toHaveLength(2);
    await waitFor(() => expect(names[1]).toHaveFocus());
    await user.type(names[1], 'Cable');
    await user.click(screen.getByRole('button', { name: 'Quitar producto 2' }));
    await waitFor(() => expect(screen.getByLabelText('Nombre del producto')).toHaveFocus());
    expect(screen.getByLabelText('Nombre del producto')).toHaveValue('Monitor');
    expect(screen.getByRole('button', { name: 'Quitar producto 1' })).toBeDisabled();
  });

  it('focuses participant added and a remaining participant on removal', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('radio', { name: 'Repartida' }));
    await user.click(screen.getByRole('button', { name: 'Añadir persona al reparto' }));
    await waitFor(() => expect(screen.getByLabelText('Persona 3')).toHaveFocus());
    await user.click(screen.getByRole('button', { name: 'Quitar participante 3' }));
    await waitFor(() => expect(screen.getByLabelText('Persona 2')).toHaveFocus());
  });

  it('previews three calendar years, updates with purchase date and sends duration to backend', async () => {
    const { user, onSubmit } = setup();
    await fillBasic(user);
    await user.click(screen.getByRole('checkbox', { name: 'Tiene garantía' }));
    await user.type(screen.getByLabelText('Duración de la garantía'), '3');
    await user.selectOptions(screen.getByLabelText('Unidad de duración'), 'YEARS');
    expect(screen.getByText('Hasta el 17 sept 2029')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Fecha de compra'), { target: { value: '2024-02-29' } });
    expect(screen.getByText('Hasta el 28 feb 2027')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Guardar compra' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    expect(onSubmit.mock.calls[0][0].items[0]).toMatchObject({ warrantyEndsAt: null, warrantyDurationMonths: 36 });
  });

  it('keeps explicit warranty date unchanged when purchase date changes', async () => {
    const { user, onSubmit } = setup();
    await fillBasic(user);
    await user.click(screen.getByRole('checkbox', { name: 'Tiene garantía' }));
    await user.click(screen.getByRole('radio', { name: 'Fecha fin', exact: true }));
    fireEvent.change(screen.getByLabelText('Fecha fin de garantía'), { target: { value: '2029-09-17' } });
    fireEvent.change(screen.getByLabelText('Fecha de compra'), { target: { value: '2027-02-28' } });
    fireEvent.change(screen.getByLabelText('Fecha de pago'), { target: { value: '2026-09-17' } });
    expect(screen.getByLabelText('Fecha fin de garantía')).toHaveValue('2029-09-17');
    await user.click(screen.getByRole('button', { name: 'Guardar compra' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    expect(onSubmit.mock.calls[0][0].items[0]).toMatchObject({ warrantyEndsAt: '2029-09-17', warrantyDurationMonths: null });
  });

  it('does not validate hidden warranty values after disabling it', async () => {
    const { user, onSubmit } = setup();
    await fillBasic(user);
    await user.click(screen.getByRole('checkbox', { name: 'Tiene garantía' }));
    await user.type(screen.getByLabelText('Duración de la garantía'), '0');
    await user.click(screen.getByRole('checkbox', { name: 'Tiene garantía' }));
    await user.click(screen.getByRole('button', { name: 'Guardar compra' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    expect(onSubmit.mock.calls[0][0].items[0]).toMatchObject({ warrantyEndsAt: null, warrantyDurationMonths: null });
  });

  it('edits purchase metadata only and explains date changes', async () => {
    const { user, onSubmit } = setup({ initialPurchase: purchase });
    expect(screen.queryByLabelText('Nombre del producto')).not.toBeInTheDocument();
    expect(screen.getByText(/Las fechas fin introducidas manualmente se conservan/)).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'Del hogar' }));
    await user.click(screen.getByRole('button', { name: 'Guardar cambios de la compra' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ ownershipType: 'HOUSEHOLD', personalPersonId: null, shares: [] });
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty('items');
  });

  it('retains an inactive personal owner while editing only the merchant', async () => {
    const { user, onSubmit } = setup({
      people: people.filter((person) => person.id !== 'pablo'),
      initialPurchase: { ...purchase, personalPerson: { id: 'pablo', name: 'Pablo' } },
    });
    expect(screen.getByLabelText('Persona propietaria')).toHaveValue('pablo');
    expect(screen.getByRole('option', { name: 'Pablo (inactiva)' })).toBeInTheDocument();
    await user.clear(screen.getByLabelText('Tienda (opcional)'));
    await user.type(screen.getByLabelText('Tienda (opcional)'), 'Otra tienda');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios de la compra' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ merchant: 'Otra tienda', ownershipType: 'PERSONAL', personalPersonId: 'pablo' })));
  });

  it('retains inactive historical split participants while editing only the merchant', async () => {
    const shares = [
      { householdPersonId: 'pablo', shareBps: 6000, householdPerson: { id: 'pablo', name: 'Pablo' } },
      { householdPersonId: 'natalia', shareBps: 4000, householdPerson: { id: 'natalia', name: 'Natalia' } },
    ];
    const { user, onSubmit } = setup({
      people: people.filter((person) => person.id !== 'pablo'),
      initialPurchase: { ...purchase, ownershipType: 'SPLIT', personalPersonId: null, shares },
    });
    expect(screen.getByLabelText('Persona 1')).toHaveValue('pablo');
    expect(screen.getByLabelText('Persona 2')).toHaveValue('natalia');
    expect(screen.getByText('Total: 100 %')).toBeInTheDocument();
    await user.clear(screen.getByLabelText('Tienda (opcional)'));
    await user.type(screen.getByLabelText('Tienda (opcional)'), 'Otra tienda');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios de la compra' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ merchant: 'Otra tienda', ownershipType: 'SPLIT', personalPersonId: null, shares: shares.map(({ householdPersonId, shareBps }) => ({ householdPersonId, shareBps })) })));
  });

  it('does not offer historical inactive owners when switching to another ownership type', async () => {
    const { user } = setup({
      people: people.filter((person) => person.id !== 'pablo'),
      initialPurchase: { ...purchase, personalPerson: { id: 'pablo', name: 'Pablo' } },
    });
    expect(screen.getByRole('option', { name: 'Pablo (inactiva)' })).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'Repartida' }));
    expect(screen.queryByRole('option', { name: /Pablo/ })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Persona 1')).toHaveValue('');
  });

  it('associates field errors and focuses the first invalid control', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Guardar compra' }));
    const total = screen.getByLabelText('Total de la compra (€)');
    expect(await screen.findByText('Escribe el nombre del producto.')).toBeInTheDocument();
    expect(total).toHaveAttribute('aria-invalid', 'true');
    expect(total).toHaveAccessibleDescription(/Introduce un importe entre 0/);
    await waitFor(() => expect(total).toHaveFocus());
  });

  it('opens optional details and focuses an invalid quantity when saving', async () => {
    const { user } = setup();
    await fillBasic(user);
    const summary = screen.getByText('Más datos: cantidad, serie, IMEI y notas');
    await user.click(summary);
    await user.clear(screen.getByLabelText('Cantidad'));
    await user.type(screen.getByLabelText('Cantidad'), '0');
    await user.click(summary);
    await user.click(screen.getByRole('button', { name: 'Guardar compra' }));
    await waitFor(() => expect(screen.getByLabelText('Cantidad')).toHaveFocus());
    expect(summary.closest('details')).toHaveAttribute('open');
  });

  it('supports keyboard ownership selection and cancellation', async () => {
    const { user, onCancel } = setup();
    screen.getByRole('radio', { name: 'Del hogar' }).focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', { name: 'Personal' })).toBeChecked();
    expect(screen.getByLabelText('Persona propietaria')).toBeInTheDocument();
    screen.getByRole('button', { name: 'Cancelar' }).focus();
    await user.keyboard('{Enter}');
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('disables all mutation controls while pending and exposes normalized API errors', () => {
    setup({ isPending: true, error: { message: 'No tienes permiso para esta compra.' } });
    expect(screen.getByRole('form', { name: 'Añadir compra' })).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByLabelText('Nombre del producto')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Guardando compra…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    expect(within(screen.getByRole('alert')).getByText('No tienes permiso para esta compra.')).toBeInTheDocument();
  });
});

describe('PurchaseItemForm', () => {
  it('edits the product without leaking id or warranty source into write payload', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<PurchaseItemForm initialItem={item} purchaseDate="2026-09-17" onSubmit={onSubmit} onCancel={vi.fn()} />);
    expect(screen.getByLabelText('Duración de la garantía')).toHaveValue('3');
    expect(screen.getByLabelText('Unidad de duración')).toHaveValue('YEARS');
    expect(screen.getByText('Hasta el 17 sept 2029')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Guardar cambios del producto' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ name: 'iPhone 17', priceCents: 99900, warrantyDurationMonths: 36, warrantyEndsAt: null });
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty('id');
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty('warrantySource');
  });

  it('preserves manually set warranty while editing and permits removing it', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<PurchaseItemForm initialItem={{ ...item, warrantySource: 'EXPLICIT_DATE', warrantyDurationMonths: null }} purchaseDate="2028-01-01" onSubmit={onSubmit} onCancel={vi.fn()} />);
    expect(screen.getByLabelText('Fecha fin de garantía')).toHaveValue('2029-09-17');
    await user.click(screen.getByRole('checkbox', { name: 'Tiene garantía' }));
    await user.click(screen.getByRole('button', { name: 'Guardar cambios del producto' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ warrantyDurationMonths: null, warrantyEndsAt: null });
  });

  it('adds an item independently with optional identifiers and quantity', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<PurchaseItemForm purchaseDate="2026-09-17" onSubmit={onSubmit} onCancel={vi.fn()} />);
    await user.type(screen.getByLabelText('Nombre del producto'), 'Cable');
    await user.click(screen.getByText('Más datos: cantidad, serie, IMEI y notas'));
    await user.clear(screen.getByLabelText('Cantidad'));
    await user.type(screen.getByLabelText('Cantidad'), '2');
    await user.type(screen.getByLabelText('Número de serie (opcional)'), ' ABC123 ');
    await user.type(screen.getByLabelText('IMEI (opcional)'), '123456789012345');
    await user.click(screen.getByRole('button', { name: 'Guardar producto' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ name: 'Cable', quantity: 2, serialNumber: 'ABC123', imei: '123456789012345' })));
  });
});
