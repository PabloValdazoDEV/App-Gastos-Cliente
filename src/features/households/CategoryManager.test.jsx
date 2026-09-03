import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  archiveCategory: vi.fn(),
  createCategory: vi.fn(),
  deleteCategory: vi.fn(),
  listCategories: vi.fn(),
  updateCategory: vi.fn(),
}));

vi.mock('./householdService', () => ({
  householdService: mocks,
}));

import { CategoryManager } from './CategoryManager';

const household = {
  access: { role: 'OWNER' },
  id: 'household-1',
  safetyMarginBps: 1_000,
};
const categories = [
  {
    archivedAt: null,
    color: '#4F6F62',
    icon: 'House',
    id: 'category-1',
    isDefault: true,
    name: 'Vivienda',
    safetyMarginBps: null,
  },
  {
    archivedAt: '2026-08-01T00:00:00.000Z',
    color: '#66706B',
    icon: 'Shapes',
    id: 'category-2',
    isDefault: false,
    name: 'Antigua',
    safetyMarginBps: 500,
  },
];

function renderManager(role = 'OWNER') {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <CategoryManager household={{ ...household, access: { role } }} />
    </QueryClientProvider>,
  );
}

describe('CategoryManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listCategories.mockResolvedValue({
      categories,
      householdSafetyMarginBps: 1_000,
    });
    mocks.createCategory.mockResolvedValue({ id: 'category-created' });
    mocks.updateCategory.mockResolvedValue({ id: 'category-1' });
    mocks.archiveCategory.mockResolvedValue({ id: 'category-1' });
    mocks.deleteCategory.mockResolvedValue({ deleted: true, id: 'category-2' });
  });

  it('crea una categoría con icono, color y margen específico', async () => {
    const user = userEvent.setup();
    renderManager();

    await user.click(await screen.findByRole('button', { name: 'Nueva categoría' }));
    await user.type(screen.getByLabelText('Nombre de la categoría'), 'Viajes');
    await user.selectOptions(screen.getByLabelText('Icono'), 'Car');
    const color = screen.getByLabelText('Color');
    await user.clear(color);
    await user.type(color, '#123456');
    await user.click(screen.getByRole('checkbox', { name: 'Usar margen específico' }));
    await user.type(screen.getByLabelText('Margen específico de la categoría'), '12,5');
    await user.click(screen.getByRole('button', { name: 'Crear categoría' }));

    expect(mocks.createCategory).toHaveBeenCalledWith({
      householdId: 'household-1',
      body: {
        color: '#123456',
        icon: 'Car',
        name: 'Viajes',
        safetyMarginBps: 1_250,
      },
    });
  });

  it('edita de forma explícita los atributos de una categoría activa', async () => {
    const user = userEvent.setup();
    renderManager();

    await user.click(await screen.findByRole('button', { name: 'Editar' }));
    const name = screen.getByLabelText('Nombre de la categoría');
    await user.clear(name);
    await user.type(name, 'Hogar');
    await user.selectOptions(screen.getByLabelText('Icono'), 'Building2');
    await user.click(screen.getByRole('checkbox', { name: 'Usar margen específico' }));
    await user.type(screen.getByLabelText('Margen específico de la categoría'), '3,25');
    await user.click(screen.getByRole('button', { name: 'Guardar categoría' }));

    expect(mocks.updateCategory).toHaveBeenCalledWith({
      householdId: 'household-1',
      categoryId: 'category-1',
      body: expect.objectContaining({
        icon: 'Building2',
        name: 'Hogar',
        safetyMarginBps: 325,
      }),
    });
  });

  it('confirma archivo y eliminación antes de ejecutar acciones destructivas', async () => {
    const user = userEvent.setup();
    renderManager();

    await user.click(await screen.findByRole('button', { name: 'Archivar' }));
    expect(mocks.archiveCategory).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Confirmar archivo' }));
    await waitFor(() =>
      expect(mocks.archiveCategory).toHaveBeenCalledWith({
        householdId: 'household-1',
        categoryId: 'category-1',
      }),
    );

    await user.click(screen.getByRole('button', { name: 'Eliminar definitivamente' }));
    expect(mocks.deleteCategory).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Confirmar eliminación' }));
    await waitFor(() =>
      expect(mocks.deleteCategory).toHaveBeenCalledWith({
        householdId: 'household-1',
        categoryId: 'category-2',
      }),
    );
  });

  it('mantiene la gestión en solo lectura para miembros', async () => {
    const { container } = renderManager('MEMBER');

    expect(await screen.findByText('Vivienda')).toBeInTheDocument();
    expect(container.querySelector('.lucide-house')).toBeInTheDocument();
    expect(
      screen.getByText(/Solo administradores y propietarios pueden cambiarlas/i),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Nueva categoría' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Eliminar definitivamente' }),
    ).not.toBeInTheDocument();
  });
});
