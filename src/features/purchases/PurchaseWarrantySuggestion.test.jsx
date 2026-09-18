import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PurchaseWarrantySuggestion } from './PurchaseWarrantySuggestion';
import { PurchaseItemForm } from './PurchaseItemForm';

describe('reviewable legal warranty preset', () => {
  it('requires explicit Spain/new goods/consumer/delivery confirmation before applying', async () => {
    const user = userEvent.setup(); const apply = vi.fn();
    render(<PurchaseWarrantySuggestion purchaseDate="2026-09-17" onApply={apply} />);
    await user.click(screen.getByText('Sugerir garantía legal según la compra'));
    const action = screen.getByRole('button', { name: 'Aplicar garantía legal de 3 años' });
    expect(action).toBeDisabled(); expect(apply).not.toHaveBeenCalled();
    await user.click(screen.getByRole('checkbox')); await user.click(action);
    expect(apply).toHaveBeenCalledOnce();
    expect(screen.getByRole('link', { name: 'Consultar la garantía legal en el BOE' })).toHaveAttribute('href', 'https://www.boe.es/buscar/act.php?id=BOE-A-2007-20555#a120');
  });
  it.each(['', '2021-12-31', '2026-02-30'])('does not suggest a three-year date for %s', async (date) => {
    const user = userEvent.setup(); render(<PurchaseWarrantySuggestion purchaseDate={date} onApply={vi.fn()} />);
    await user.click(screen.getByText('Sugerir garantía legal según la compra'));
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
  it('invalidates confirmation when the reference date changes', async () => {
    const user = userEvent.setup(); const apply = vi.fn();
    const view = render(<PurchaseWarrantySuggestion purchaseDate="2026-09-17" onApply={apply} />);
    await user.click(screen.getByText('Sugerir garantía legal según la compra')); await user.click(screen.getByRole('checkbox'));
    view.rerender(<PurchaseWarrantySuggestion purchaseDate="2026-09-18" onApply={apply} />);
    expect(screen.getByRole('checkbox')).not.toBeChecked();
    expect(screen.getByRole('button')).toBeDisabled();
  });
  it('applies an editable three-year duration with correct leap-date expiry and payload', async () => {
    const user = userEvent.setup(); const submit = vi.fn();
    render(<PurchaseItemForm initialItem={{ name: 'Portátil', quantity: 2 }} purchaseDate="2024-02-29" onSubmit={submit} onCancel={vi.fn()} singleProduct />);
    expect(screen.getByLabelText('Cantidad')).toBeVisible();
    await user.click(screen.getByText('Sugerir garantía legal según la compra'));
    await user.click(screen.getByRole('checkbox', { name: /Confirmo que es un bien nuevo/ }));
    await user.click(screen.getByRole('button', { name: 'Aplicar garantía legal de 3 años' }));
    expect(screen.getByLabelText('Duración de la garantía')).toHaveValue('3');
    expect(screen.getByText('Hasta el 28 feb 2027')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Guardar cambios del producto' }));
    await waitFor(() => expect(submit).toHaveBeenCalledOnce());
    expect(submit.mock.calls[0][0]).toMatchObject({ quantity: 2, warrantyDurationMonths: 36, warrantyEndsAt: null });
  });
});
