import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { PurchaseDocumentAnalysisReview } from './PurchaseDocumentAnalysisReview';
import { analysisPurchaseFixture as purchase, receiptAnalysisFixture as analysis } from './purchaseAnalysisFixtures';

function setup(props = {}) {
  const onSubmit = vi.fn().mockResolvedValue({}); const onCancel = vi.fn(); const onDirtyChange = vi.fn();
  return { ...render(<PurchaseDocumentAnalysisReview analysis={analysis} onCancel={onCancel} onDirtyChange={onDirtyChange} onSubmit={onSubmit} purchase={purchase} {...props} />), onSubmit, onCancel, onDirtyChange };
}

describe('PurchaseDocumentAnalysisReview', () => {
  it('shows editable preview, disclaimer, uncertainty and readonly auxiliary metadata without saving', () => {
    const { onSubmit } = setup();
    expect(screen.getByRole('heading', { name: 'Revisar datos detectados' })).toBeVisible();
    expect(screen.getByText('Comprueba la información antes de guardarla. La IA puede cometer errores.')).toBeVisible();
    expect(screen.getByLabelText('Comercio')).toHaveValue('Mercadona');
    expect(screen.getByLabelText('Comercio')).toHaveFocus();
    expect(screen.getByLabelText('Fecha de compra')).toHaveValue('2026-09-17');
    expect(screen.getByLabelText('Total (€)')).toHaveValue('8.70');
    expect(screen.getByText('Revisar')).toBeVisible();
    expect(screen.getByLabelText('Fecha de compra')).toHaveAccessibleDescription(/Revisar/);
    const metadata = screen.getByRole('region', { name: 'Información detectada' });
    expect(within(metadata).getAllByText('No detectado')).toHaveLength(4);
    expect(within(metadata).queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Añadir estos productos a la compra')).not.toBeChecked();
    expect(onSubmit).not.toHaveBeenCalled();
  });
  it('submits corrected merchant, date, total and product values only after explicit confirmation', async () => {
    const user = userEvent.setup(); const { onSubmit } = setup();
    for (const [label, value] of [['Comercio', 'Tienda revisada'], ['Fecha de compra', '2026-09-15'], ['Total (€)', '9.70'], ['Nombre del producto 1', 'Producto corregido'], ['Total de la línea 1 (€)', '6.50']]) {
      await user.clear(screen.getByLabelText(label)); await user.type(screen.getByLabelText(label), value);
    }
    await user.click(screen.getByLabelText('Añadir estos productos a la compra'));
    expect(onSubmit).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Confirmar datos' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ purchaseVersion: 'version-1', apply: { items: 'ADD' }, reviewedData: { merchant: 'Tienda revisada', purchaseDate: '2026-09-15', totalCents: 970, items: [{ name: 'Producto corregido', totalPriceCents: 650 }, { name: 'Producto B', totalPriceCents: 320 }] } });
  });
  it('allows adding and removing detected products while preserving existing purchase products', async () => {
    const user = userEvent.setup(); const { onSubmit } = setup();
    await user.click(screen.getByRole('button', { name: 'Eliminar producto detectado 2' }));
    expect(screen.queryByLabelText('Nombre del producto 2')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Añadir producto a la revisión' }));
    expect(screen.getByLabelText('Nombre del producto 2')).toHaveFocus();
    expect(screen.getByLabelText('Cantidad del producto 2')).toHaveValue('');
    await user.type(screen.getByLabelText('Nombre del producto 2'), 'Nuevo producto');
    await user.type(screen.getByLabelText('Cantidad del producto 2'), '2');
    await user.type(screen.getByLabelText('Total de la línea 2 (€)'), '3.20');
    await user.click(screen.getByLabelText('Añadir estos productos a la compra'));
    await user.click(screen.getByRole('button', { name: 'Confirmar datos' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    expect(onSubmit.mock.calls[0][0].reviewedData.items).toHaveLength(2);
    expect(onSubmit.mock.calls[0][0].reviewedData.items[1]).toMatchObject({ name: 'Nuevo producto', quantity: 2 });
    expect(purchase.items[0]).toMatchObject({ id: 'existing', warrantyDurationMonths: 24 });
  });
  it('requires conscious discrepancy acknowledgement and resets it when amounts change', async () => {
    const user = userEvent.setup(); const { onSubmit } = setup();
    await user.clear(screen.getByLabelText('Total (€)')); await user.type(screen.getByLabelText('Total (€)'), '10');
    expect(screen.getByRole('status')).toHaveTextContent('El total detectado no coincide con la suma de los productos. Revísalo antes de guardar.');
    await user.click(screen.getByRole('button', { name: 'Confirmar datos' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Confirma que has revisado');
    const acknowledgement = screen.getByLabelText('He revisado la diferencia y quiero guardar estos datos');
    await waitFor(() => expect(acknowledgement).toHaveFocus());
    expect(onSubmit).not.toHaveBeenCalled();
    await user.click(acknowledgement);
    await user.clear(screen.getByLabelText('Total (€)')); await user.type(screen.getByLabelText('Total (€)'), '11');
    const updatedAcknowledgement = screen.getByLabelText('He revisado la diferencia y quiero guardar estos datos');
    expect(updatedAcknowledgement).not.toBeChecked();
    await user.click(updatedAcknowledgement); await user.click(screen.getByRole('button', { name: 'Confirmar datos' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ acknowledgeTotalMismatch: true })));
  });
  it('shows missing-field fallback and uncertainty together without inventing quantity', () => {
    setup({ analysis: { ...analysis, extractedData: { ...analysis.extractedData, merchant: { name: null, confidence: 'LOW' }, purchaseDate: { value: null, confidence: 'LOW' }, items: [{ name: null, quantity: null, totalPriceCents: null, unitPriceCents: null, confidence: 'LOW' }] } } });
    expect(screen.getByLabelText('Comercio')).toHaveAccessibleDescription(/Revisar.*No detectado/);
    expect(screen.getByLabelText('Fecha de compra')).toHaveAccessibleDescription(/Revisar.*No detectada/);
    expect(screen.getByLabelText('Cantidad del producto 1')).toHaveValue('');
    expect(screen.getByLabelText('Total de la línea 1 (€)')).toHaveValue('');
  });
  it('never applies a protected financing total or modifies financial and ownership decisions', async () => {
    const user = userEvent.setup();
    const { onSubmit } = setup({ purchase: { ...purchase, paymentMethod: 'FINANCED', financing: { installments: [{ status: 'PAID' }] } } });
    expect(screen.getByLabelText('Total detectado (no se aplicará)')).toHaveAttribute('readonly');
    expect(screen.queryByLabelText('Aplicar el total revisado como precio de compra')).not.toBeInTheDocument();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Confirmar datos' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    expect(onSubmit.mock.calls[0][0].apply.total).toBe(false);
  });
  it('cancelling only discards the review and never confirms data', async () => {
    const user = userEvent.setup(); const { onSubmit, onCancel } = setup();
    await user.type(screen.getByLabelText('Comercio'), ' cambiado');
    await user.click(screen.getByRole('button', { name: 'Cancelar revisión' }));
    expect(onCancel).toHaveBeenCalledOnce(); expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/Cancelar descarta solo/)).toHaveTextContent('análisis guardado y el documento original se conservan');
  });
  it('prevents duplicate confirmations and retains edited fields on failure', async () => {
    let reject; const pending = new Promise((_, fail) => { reject = fail; });
    const submit = vi.fn(() => pending); const user = userEvent.setup();
    setup({ onSubmit: submit });
    await user.type(screen.getByLabelText('Comercio'), ' corregido');
    await user.dblClick(screen.getByRole('button', { name: 'Confirmar datos' }));
    expect(submit).toHaveBeenCalledOnce(); expect(screen.getByRole('button', { name: 'Confirmando datos…' })).toBeDisabled();
    await act(async () => reject(new Error('Network')));
    expect(screen.getByLabelText('Comercio')).toHaveValue('Mercadona corregido');
  });
  it('blocks stale or externally disabled submission and keeps mobile date controls constrained', () => {
    setup({ isStale: true });
    expect(screen.getByRole('button', { name: 'Confirmar datos' })).toBeDisabled();
    expect(screen.getByLabelText('Fecha de compra')).toHaveClass('min-w-0', 'max-w-full', 'box-border');
    expect(screen.getByLabelText('Fecha de compra').parentElement.parentElement).toHaveClass('date-fields-grid', 'min-w-0');
    expect(screen.getByRole('form')).toHaveClass('min-w-0', '[overflow-wrap:anywhere]');
    expect(screen.getByRole('button', { name: 'Añadir producto a la revisión' })).toHaveClass('min-h-11');
  });
});
