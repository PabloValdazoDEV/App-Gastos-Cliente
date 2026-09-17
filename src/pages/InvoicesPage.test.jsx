import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createInvoice: vi.fn(),
  deleteInvoice: vi.fn(),
  deleteInvoiceDocument: vi.fn(),
  invoiceDocumentContent: vi.fn(),
  invoiceDocuments: vi.fn(),
  invoiceStatistics: vi.fn(),
  setBudgetMarginPreference: vi.fn(),
  invoices: vi.fn(),
  listCategories: vi.fn(),
  listPeople: vi.fn(),
  updateInvoice: vi.fn(),
  uploadInvoiceDocument: vi.fn(),
}));

vi.mock('../features/finance/financeService', () => ({
  financeService: {
    createInvoice: mocks.createInvoice,
    deleteInvoice: mocks.deleteInvoice,
    deleteInvoiceDocument: mocks.deleteInvoiceDocument,
    invoiceDocumentContent: mocks.invoiceDocumentContent,
    invoiceDocuments: mocks.invoiceDocuments,
    invoiceStatistics: mocks.invoiceStatistics,
    setBudgetMarginPreference: mocks.setBudgetMarginPreference,
    invoices: mocks.invoices,
    updateInvoice: mocks.updateInvoice,
    uploadInvoiceDocument: mocks.uploadInvoiceDocument,
  },
}));

vi.mock('../features/households/householdService', () => ({
  householdService: { listCategories: mocks.listCategories, listPeople: mocks.listPeople },
}));

vi.mock('../features/households/useHousehold', () => ({
  useHousehold: () => ({
    currentHousehold: { currency: 'EUR', id: 'household-1', name: 'Casa' },
    isError: false,
    isPending: false,
  }),
}));

import { InvoicesPage } from './InvoicesPage';

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  const result = render(
    <QueryClientProvider client={client}>
      <InvoicesPage />
    </QueryClientProvider>,
  );
  return { ...result, client, invalidate };
}

describe('InvoicesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listPeople.mockResolvedValue({ people: [{ id: 'ana', name: 'Ana', isActive: true }] });
    mocks.listCategories.mockResolvedValue({
      categories: [{ id: 'category-1', name: 'Luz' }],
    });
    mocks.invoices.mockResolvedValue([
      {
        amountCents: 7_200,
        categoryId: 'category-1',
        category: { name: 'Luz' },
        documentCount: 0,
        id: 'invoice-1',
        invoiceDate: '2026-08-20T00:00:00.000Z',
        periodEnd: '2026-08-15T00:00:00.000Z',
        periodStart: '2026-07-16T00:00:00.000Z',
      },
    ]);
    mocks.invoiceStatistics.mockResolvedValue([
      {
        averages: { months12: 6_900, months3: 7_100, months6: 7_000 },
        category: { name: 'Luz' },
        categoryId: 'category-1',
        effectiveMarginBps: 1_000,
        historicalAverageCents: 7_000,
        invoiceCount: 4,
        recommendedCents: 7_700,
      },
    ]);
    mocks.createInvoice.mockResolvedValue({ id: 'invoice-created' });
    mocks.deleteInvoice.mockResolvedValue({ deleted: true, id: 'invoice-1' });
    mocks.updateInvoice.mockResolvedValue({ id: 'invoice-1' });
    mocks.deleteInvoiceDocument.mockResolvedValue({ deleted: true, id: 'document-1' });
    mocks.invoiceDocumentContent.mockResolvedValue(
      new Blob(['documento'], { type: 'application/pdf' }),
    );
    mocks.invoiceDocuments.mockResolvedValue([]);
    mocks.uploadInvoiceDocument.mockResolvedValue({ id: 'document-created' });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete window.URL.createObjectURL;
    delete window.URL.revokeObjectURL;
  });

  it('muestra histórico y estadísticas reales por categoría', async () => {
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Medias por categoría' })).toBeInTheDocument();
    expect(screen.getByText(/77,00/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Histórico' })).toBeInTheDocument();
    expect(screen.getByText(/72,00/)).toBeInTheDocument();
  });

  it('guarda el margen del grupo sin cerrar el acordeón ni modificar facturas', async () => {
    const user = userEvent.setup();
    const statistics = (enabled) => [{ categoryId: 'category-1', category: { name: 'Luz' }, scope: 'HOUSEHOLD', applySafetyMargin: enabled, effectiveMarginBps: enabled ? 1000 : 0, availableMarginBps: 1000, availableMarginSource: 'HOUSEHOLD', historicalAverageCents: 7000, recommendedCents: enabled ? 7700 : 7000, averages: { months3: 7000 }, invoiceCount: 1 }];
    mocks.invoiceStatistics.mockResolvedValue(statistics(false));
    mocks.setBudgetMarginPreference.mockImplementation(async ({ body }) => {
      mocks.invoiceStatistics.mockResolvedValue(statistics(body.applySafetyMargin));
      return statistics(body.applySafetyMargin)[0];
    });
    renderPage();
    const control = await screen.findByRole('checkbox', { name: /Aplicar margen al presupuesto recomendado/ });
    expect(control).not.toBeChecked();
    expect(screen.getAllByRole('checkbox')).toHaveLength(1);
    const accordion = screen.getByRole('button', { name: /Última:/ });
    await user.click(control);
    await waitFor(() => expect(control).toBeChecked());
    expect(accordion).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(/77,00/)).toBeInTheDocument();
    await user.click(control);
    await waitFor(() => expect(control).not.toBeChecked());
    expect(accordion).toHaveAttribute('aria-expanded', 'true');
    expect(mocks.updateInvoice).not.toHaveBeenCalled();
    expect(mocks.invoiceStatistics).toHaveBeenCalledTimes(3);
  });

  it('agrupa el histórico en acordeones y prioriza la categoría con la factura más reciente', async () => {
    const user = userEvent.setup();
    mocks.invoices.mockResolvedValue([
      {
        amountCents: 4_200,
        categoryId: 'category-water',
        category: { name: 'Agua' },
        documentCount: 0,
        id: 'invoice-water-old',
        invoiceDate: '2026-06-10T00:00:00.000Z',
        periodEnd: '2026-06-09T00:00:00.000Z',
        periodStart: '2026-05-11T00:00:00.000Z',
      },
      {
        amountCents: 7_200,
        categoryId: 'category-light',
        category: { name: 'Luz' },
        documentCount: 0,
        id: 'invoice-light-new',
        invoiceDate: '2026-08-20T00:00:00.000Z',
        periodEnd: '2026-08-15T00:00:00.000Z',
        periodStart: '2026-07-16T00:00:00.000Z',
      },
      {
        amountCents: 4_700,
        categoryId: 'category-water',
        category: { name: 'Agua' },
        documentCount: 0,
        id: 'invoice-water-new',
        invoiceDate: '2026-08-25T00:00:00.000Z',
        periodEnd: '2026-08-24T00:00:00.000Z',
        periodStart: '2026-07-25T00:00:00.000Z',
      },
    ]);

    renderPage();

    const groups = await screen.findAllByRole('button', { name: /Última:/i });
    expect(groups).toHaveLength(2);
    expect(groups[0]).toHaveTextContent('Agua');
    expect(groups[0]).toHaveTextContent('25 ago 2026');
    expect(groups[0]).toHaveAttribute('aria-expanded', 'true');
    expect(groups[1]).toHaveTextContent('Luz');
    expect(groups[1]).toHaveTextContent('20 ago 2026');
    expect(groups[1]).toHaveAttribute('aria-expanded', 'false');
    expect(document.getElementById(groups[1].getAttribute('aria-controls'))).not.toBeVisible();
    expect(screen.getAllByText(/Emitida:/)[0]).toHaveTextContent('25 ago 2026');

    await user.click(groups[1]);
    expect(groups[0]).toHaveAttribute('aria-expanded', 'false');
    expect(groups[1]).toHaveAttribute('aria-expanded', 'true');
    expect(await screen.findByText(/72,00/)).toBeInTheDocument();
  });

  it('crea una factura con el periodo completo', async () => {
    const user = userEvent.setup();
    const { invalidate } = renderPage();

    await user.click(await screen.findByRole('button', { name: 'Añadir factura' }));
    await user.type(screen.getByLabelText('Importe de la factura (€)'), '81,35');
    await user.click(screen.getByRole('button', { name: 'Guardar factura' }));

    expect(mocks.createInvoice).toHaveBeenCalledWith(
      expect.objectContaining({
        householdId: 'household-1',
        body: expect.objectContaining({
          amountCents: 8_135,
          categoryId: 'category-1',
          periodEnd: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
          periodStart: expect.stringMatching(/^\d{4}-\d{2}-01$/),
        }),
      }),
    );
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['dashboard', 'household-1'] }));
  });

  it.each(['HOUSEHOLD', 'PERSONAL'])('crea en el acordeón con categoría y propietario %s preseleccionados', async (scope) => {
    const user = userEvent.setup();
    const categoryName = 'Electricidad de la vivienda habitual y suministros compartidos';
    mocks.listCategories.mockResolvedValue({ categories: [
      { id: 'water', name: 'Agua' }, { id: 'light', name: categoryName },
    ] });
    mocks.invoices.mockResolvedValue([{
      id: 'old', categoryId: 'light', category: { id: 'light', name: categoryName },
      scope, personalPersonId: scope === 'PERSONAL' ? 'ana' : null,
      personalPerson: scope === 'PERSONAL' ? { id: 'ana', name: 'Ana' } : null,
      amountCents: 7_200, notes: 'No copiar esta nota histórica', documentCount: 0,
      invoiceDate: '2025-01-20', periodStart: '2025-01-01', periodEnd: '2025-01-20',
    }]);
    renderPage();
    const trigger = await screen.findByRole('button', { name: `Añadir factura de ${categoryName}` });
    const accordion = document.getElementById(screen.getByRole('button', { name: /Última:/ }).getAttribute('aria-controls'));
    expect(accordion).toContainElement(trigger);
    await user.click(trigger);
    const form = within(accordion).getByRole('region', { name: `Añadir factura de ${categoryName}` });
    const fields = within(form);
    expect(fields.getByRole('combobox', { name: 'Categoría' })).toHaveValue('light');
    expect(fields.getByLabelText(scope === 'PERSONAL' ? 'Factura personal' : 'Factura común')).toBeChecked();
    if (scope === 'PERSONAL') expect(fields.getByRole('combobox', { name: 'Persona' })).toHaveValue('ana');
    else expect(fields.queryByRole('combobox', { name: 'Persona' })).not.toBeInTheDocument();
    expect(fields.getByLabelText('Importe de la factura (€)')).toHaveValue('');
    expect(fields.getByLabelText('Importe de la factura (€)')).toHaveFocus();
    expect(fields.getByLabelText('Notas (opcional)')).toHaveValue('');
    expect(fields.getByLabelText('Inicio del periodo')).not.toHaveValue('2025-01-01');
    await user.type(fields.getByLabelText('Importe de la factura (€)'), '45,25');
    await user.click(fields.getByRole('button', { name: 'Guardar factura' }));
    await waitFor(() => expect(mocks.createInvoice).toHaveBeenCalledWith({
      householdId: 'household-1',
      body: expect.objectContaining({ amountCents: 4_525, categoryId: 'light', scope, personalPersonId: scope === 'PERSONAL' ? 'ana' : null }),
    }));
    await waitFor(() => expect(screen.queryByRole('region', { name: `Añadir factura de ${categoryName}` })).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
    expect(mocks.invoices).toHaveBeenCalledTimes(2);
    expect(mocks.invoiceStatistics).toHaveBeenCalledTimes(2);
    expect(mocks.updateInvoice).not.toHaveBeenCalled();
    expect(mocks.invoiceDocuments).not.toHaveBeenCalled();
  });

  it('cierra la creación contextual al cambiar de grupo y mantiene la creación global independiente', async () => {
    const user = userEvent.setup();
    mocks.listCategories.mockResolvedValue({ categories: [{ id: 'category-1', name: 'Luz' }, { id: 'water', name: 'Agua' }] });
    mocks.invoices.mockResolvedValue([
      { id: 'light', categoryId: 'category-1', category: { name: 'Luz' }, scope: 'PERSONAL', personalPersonId: 'ana', personalPerson: { name: 'Ana' }, amountCents: 5_000, invoiceDate: '2026-09-01' },
      { id: 'water', categoryId: 'water', category: { name: 'Agua' }, scope: 'HOUSEHOLD', amountCents: 4_000, invoiceDate: '2026-08-01' },
    ]);
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Añadir factura de Luz' }));
    await user.type(screen.getByLabelText('Importe de la factura (€)'), '12');
    await user.click(screen.getByRole('button', { name: /Agua.*Última:/ }));
    expect(screen.queryByRole('button', { name: 'Guardar factura' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Añadir factura de Agua' }));
    expect(screen.getAllByRole('button', { name: 'Guardar factura' })).toHaveLength(1);
    expect(within(screen.getByRole('region', { name: 'Añadir factura de Agua' })).getByRole('combobox', { name: 'Categoría' })).toHaveValue('water');
    expect(screen.getByLabelText('Importe de la factura (€)')).toHaveValue('');
    await user.click(screen.getByRole('button', { name: 'Añadir factura' }));
    expect(screen.queryByRole('region', { name: 'Añadir factura de Agua' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Guardar factura' })).toHaveLength(1);
    const globalForm = within(screen.getByRole('region', { name: 'Añadir factura' }));
    expect(globalForm.getByRole('combobox', { name: 'Categoría' })).toHaveValue('category-1');
    expect(globalForm.getByLabelText('Factura común')).toBeChecked();
    await user.type(globalForm.getByLabelText('Importe de la factura (€)'), '33');
    await user.click(globalForm.getByRole('button', { name: 'Guardar factura' }));
    await waitFor(() => expect(mocks.createInvoice).toHaveBeenCalledWith(expect.objectContaining({ body: expect.objectContaining({ amountCents: 3_300, categoryId: 'category-1' }) })));
  });

  it('permite modificar los valores preseleccionados y conserva el formulario si falla el guardado', async () => {
    const user = userEvent.setup();
    mocks.listCategories.mockResolvedValue({ categories: [{ id: 'category-1', name: 'Luz' }, { id: 'water', name: 'Agua' }] });
    mocks.createInvoice.mockRejectedValueOnce(new Error('No se ha podido guardar. Inténtalo de nuevo.'));
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Añadir factura de Luz' }));
    const fields = within(screen.getByRole('region', { name: 'Añadir factura de Luz' }));
    await user.selectOptions(fields.getByRole('combobox', { name: 'Categoría' }), 'water');
    await user.click(fields.getByLabelText('Factura personal'));
    await user.selectOptions(fields.getByRole('combobox', { name: 'Persona' }), 'ana');
    await user.type(fields.getByLabelText('Importe de la factura (€)'), '15');
    await user.click(fields.getByRole('button', { name: 'Guardar factura' }));
    expect(await fields.findByRole('alert')).toHaveTextContent('No se ha podido guardar');
    expect(fields.getByLabelText('Importe de la factura (€)')).toHaveValue('15');
    expect(mocks.createInvoice).toHaveBeenCalledWith(expect.objectContaining({ body: expect.objectContaining({ categoryId: 'water', scope: 'PERSONAL', personalPersonId: 'ana' }) }));
    await user.click(fields.getByRole('button', { name: 'Cerrar formulario' }));
    expect(screen.getByRole('button', { name: 'Añadir factura de Luz' })).toHaveFocus();
  });

  it('no roba el foco al buscar mientras está abierto el formulario contextual', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Añadir factura de Luz' }));
    const search = screen.getByRole('searchbox');
    await user.type(search, 'Luz');
    expect(search).toHaveFocus();
    expect(search).toHaveValue('Luz');
    expect(screen.getByRole('region', { name: 'Añadir factura de Luz' })).toBeInTheDocument();
  });

  it('pide selecciones válidas si el grupo histórico tiene categoría o persona inactivas', async () => {
    const user = userEvent.setup();
    mocks.invoices.mockResolvedValue([{
      id: 'archived', categoryId: 'archived', category: { name: 'Categoría archivada' },
      scope: 'PERSONAL', personalPersonId: 'inactive', personalPerson: { name: 'Persona inactiva' },
      amountCents: 5_000, invoiceDate: '2026-09-01',
    }]);
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Añadir factura de Categoría archivada' }));
    const fields = within(screen.getByRole('region', { name: 'Añadir factura de Categoría archivada' }));
    expect(fields.getByRole('status')).toHaveTextContent('Selecciona una categoría activa');
    expect(fields.getByRole('status')).toHaveTextContent('La persona de este grupo ya no está activa');
    expect(fields.getByRole('combobox', { name: 'Categoría' })).toHaveValue('');
    expect(fields.getByRole('combobox', { name: 'Persona' })).toHaveValue('');
    await user.type(fields.getByLabelText('Importe de la factura (€)'), '40');
    await user.click(fields.getByRole('button', { name: 'Guardar factura' }));
    expect(mocks.createInvoice).not.toHaveBeenCalled();
    expect(await fields.findByText('Selecciona una categoría.')).toBeVisible();
    expect(fields.getByText('Selecciona la persona responsable.')).toBeVisible();
  });

  it('edita una factura histórica sin tocar sus adjuntos', async () => {
    const user = userEvent.setup();
    const { invalidate } = renderPage();

    await user.click(await screen.findByRole('button', { name: 'Editar factura de Luz' }));
    expect(await screen.findByRole('heading', { name: 'Editar factura' })).toBeInTheDocument();
    expect(screen.getByLabelText('Importe de la factura (€)')).toHaveValue('72.00');
    expect(screen.getByDisplayValue('2026-07-16')).toBeInTheDocument();
    expect(screen.getByDisplayValue('2026-08-15')).toBeInTheDocument();

    await user.clear(screen.getByLabelText('Importe de la factura (€)'));
    await user.type(screen.getByLabelText('Importe de la factura (€)'), '80,50');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => {
      expect(mocks.updateInvoice).toHaveBeenCalledWith({
        householdId: 'household-1',
        invoiceId: 'invoice-1',
        body: {
          amountCents: 8_050,
          categoryId: 'category-1',
          chargeDate: null,
          invoiceDate: '2026-08-20',
          notes: null,
          periodEnd: '2026-08-15',
          periodStart: '2026-07-16',
        },
      });
    });
    expect(mocks.invoiceDocuments).not.toHaveBeenCalled();
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['dashboard', 'household-1'] }));
  });

  it('confirma antes de eliminar una factura', async () => {
    const user = userEvent.setup();
    const { invalidate } = renderPage();

    await user.click(await screen.findByRole('button', { name: 'Eliminar factura de Luz' }));
    expect(mocks.deleteInvoice).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toHaveTextContent('¿Eliminar esta factura?');
    await user.click(screen.getByRole('button', { name: 'Eliminar factura' }));

    await waitFor(() => {
      expect(mocks.deleteInvoice).toHaveBeenCalledWith({
        householdId: 'household-1',
        invoiceId: 'invoice-1',
      });
    });
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['dashboard', 'household-1'] }));
  });

  it('carga metadatos solo al expandir y explica alcance y límites', async () => {
    const user = userEvent.setup();
    mocks.invoices.mockResolvedValue([
      {
        amountCents: 7_200,
        category: { name: 'Luz' },
        documentCount: 1,
        id: 'invoice-1',
        invoiceDate: '2026-08-20T00:00:00.000Z',
        periodEnd: '2026-08-15T00:00:00.000Z',
        periodStart: '2026-07-16T00:00:00.000Z',
      },
    ]);
    mocks.invoiceDocuments.mockResolvedValue([
      {
        contentType: 'application/pdf',
        createdAt: '2026-08-26T10:30:00.000Z',
        filename: 'factura-agosto.pdf',
        id: 'document-1',
        sizeBytes: 2_048,
        uploadedBy: { name: 'Pablo' },
      },
    ]);

    renderPage();

    const toggle = await screen.findByRole('button', { name: /Gestionar adjuntos.*1\/5/i });
    expect(mocks.invoiceDocuments).not.toHaveBeenCalled();
    await user.click(toggle);

    expect(await screen.findByText('factura-agosto.pdf')).toBeInTheDocument();
    expect(mocks.invoiceDocuments).toHaveBeenCalledWith({
      householdId: 'household-1',
      invoiceId: 'invoice-1',
    });
    expect(screen.getByText(/Los adjuntos son opcionales/i)).toBeInTheDocument();
    expect(screen.getByText(/cada miembro activo/i)).toBeInTheDocument();
    expect(screen.getByText(/máximo 10 MiB por archivo/i)).toBeInTheDocument();
    expect(screen.getByText(/2 KiB/)).toBeInTheDocument();
  });

  it('muestra un error de metadatos y permite reintentar', async () => {
    const user = userEvent.setup();
    mocks.invoiceDocuments
      .mockRejectedValueOnce(new Error('No hay conexión con documentos.'))
      .mockResolvedValueOnce([]);
    renderPage();

    await user.click(await screen.findByRole('button', { name: /Gestionar adjuntos/ }));
    expect(
      await screen.findByText('No se han podido cargar los documentos'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reintentar carga' }));

    expect(await screen.findByText('Todavía no hay documentos')).toBeInTheDocument();
    expect(mocks.invoiceDocuments).toHaveBeenCalledTimes(2);
  });

  it('sube varios documentos y reinicia el selector al terminar', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: /Gestionar adjuntos/ }));
    const input = await screen.findByLabelText('Añadir documentos (opcional)');
    const pdf = new File(['pdf'], 'luz.pdf', { type: 'application/pdf' });
    const image = new File(['png'], 'contador.png', { type: 'image/png' });

    await user.upload(input, [pdf, image]);
    expect(screen.getByText('2 documentos seleccionados')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Subir documentos' }));

    await waitFor(() => expect(mocks.uploadInvoiceDocument).toHaveBeenCalledTimes(2));
    expect(mocks.uploadInvoiceDocument).toHaveBeenNthCalledWith(1, {
      file: pdf,
      householdId: 'household-1',
      invoiceId: 'invoice-1',
    });
    expect(input).toHaveValue('');
    expect(
      await screen.findByText('2 documentos subidos correctamente.'),
    ).toBeInTheDocument();
  });

  it('confirma antes de eliminar un documento', async () => {
    const user = userEvent.setup();
    mocks.invoiceDocuments.mockResolvedValue([
      {
        contentType: 'application/pdf',
        createdAt: '2026-08-26T10:30:00.000Z',
        filename: 'luz.pdf',
        id: 'document-1',
        sizeBytes: 1_024,
      },
    ]);
    renderPage();
    await user.click(await screen.findByRole('button', { name: /Gestionar adjuntos/ }));
    await user.click(await screen.findByRole('button', { name: 'Eliminar luz.pdf' }));

    expect(screen.getByText('¿Eliminar luz.pdf?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Conservar documento' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Eliminar documento' }));

    await waitFor(() => {
      expect(mocks.deleteInvoiceDocument).toHaveBeenCalledWith({
        documentId: 'document-1',
        householdId: 'household-1',
        invoiceId: 'invoice-1',
      });
    });
  });

  it('explica una subida parcial y refresca después del fallo', async () => {
    const user = userEvent.setup();
    mocks.uploadInvoiceDocument
      .mockResolvedValueOnce({ id: 'document-1' })
      .mockRejectedValueOnce({
        code: 'INVOICE_DOCUMENT_SIGNATURE_INVALID',
        message: 'El contenido del archivo no coincide con su tipo.',
      });
    renderPage();
    await user.click(await screen.findByRole('button', { name: /Gestionar adjuntos/ }));
    const input = await screen.findByLabelText('Añadir documentos (opcional)');
    await user.upload(input, [
      new File(['pdf'], 'valida.pdf', { type: 'application/pdf' }),
      new File(['otro'], 'invalida.pdf', { type: 'application/pdf' }),
    ]);
    await user.click(screen.getByRole('button', { name: 'Subir documentos' }));

    expect(
      await screen.findByText(/Se subió 1 documento; los restantes no se subieron/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText('El contenido del archivo no coincide con su tipo.'),
    ).toBeInTheDocument();
    expect(mocks.uploadInvoiceDocument).toHaveBeenCalledTimes(2);
    expect(mocks.invoiceDocuments).toHaveBeenCalledTimes(2);
    expect(input).toHaveValue('');
  });

  it('descarga mediante una URL temporal y la revoca', async () => {
    const user = userEvent.setup();
    let revokeCallback;
    const nativeSetTimeout = window.setTimeout.bind(window);
    const createObjectURL = vi.fn(() => 'blob:documento-seguro');
    const revokeObjectURL = vi.fn();
    Object.defineProperty(window.URL, 'createObjectURL', {
      configurable: true,
      value: createObjectURL,
    });
    Object.defineProperty(window.URL, 'revokeObjectURL', {
      configurable: true,
      value: revokeObjectURL,
    });
    vi.spyOn(window, 'setTimeout').mockImplementation((callback, delay, ...args) => {
      if (delay === 60_000) {
        revokeCallback = callback;
        return 1;
      }
      return nativeSetTimeout(callback, delay, ...args);
    });
    vi.spyOn(window.HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    mocks.invoiceDocuments.mockResolvedValue([
      {
        contentType: 'application/pdf',
        createdAt: '2026-08-26T10:30:00.000Z',
        filename: 'luz.pdf',
        id: 'document-1',
        sizeBytes: 1_024,
      },
    ]);
    renderPage();
    await user.click(await screen.findByRole('button', { name: /Gestionar adjuntos/ }));
    await user.click(await screen.findByRole('button', { name: 'Descargar luz.pdf' }));

    await waitFor(() => expect(createObjectURL).toHaveBeenCalled());
    expect(mocks.invoiceDocumentContent).toHaveBeenCalledWith({
      documentId: 'document-1',
      householdId: 'household-1',
      invoiceId: 'invoice-1',
    });
    expect(revokeObjectURL).not.toHaveBeenCalled();
    revokeCallback();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:documento-seguro');
    expect(await screen.findByText(/se ha descargado para que puedas revisarlo/i)).toBeInTheDocument();
  });
});
