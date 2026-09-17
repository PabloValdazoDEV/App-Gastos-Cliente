import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import { ExpenseFilters } from './expensePageShared';

function FiltersHarness({ extra = false }) {
  const [search, setSearch] = useState('');
  const [scope, setScope] = useState('ALL');
  const [category, setCategory] = useState('ALL');
  const [type, setType] = useState('ALL');

  return (
    <ExpenseFilters
      additionalFilters={extra ? [{
        id: 'type', label: 'Tipo de gasto', value: type, onChange: setType,
        options: [{ value: 'ALL', label: 'Todos' }, { value: 'INVOICE', label: 'Facturas' }],
      }] : []}
      categories={[{ id: 'light', name: 'Electricidad de la vivienda habitual y suministros compartidos' }]}
      categoryId={category}
      onCategoryChange={setCategory}
      onScopeChange={setScope}
      onSearchChange={setSearch}
      scope={scope}
      search={search}
    />
  );
}

describe('ExpenseFilters', () => {
  it('mantiene visible el buscador y oculta los filtros inicialmente', () => {
    render(<FiltersHarness />);

    expect(screen.getByRole('searchbox', { name: 'Buscar gastos' })).toBeVisible();
    const toggle = screen.getByRole('button', { name: 'Filtros' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(document.getElementById(toggle.getAttribute('aria-controls'))).not.toBeVisible();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Limpiar filtros' })).not.toBeInTheDocument();
  });

  it('abre y cierra con teclado y devuelve el foco al cerrar con Escape', async () => {
    const user = userEvent.setup();
    render(<FiltersHarness />);
    await user.tab();
    expect(screen.getByRole('searchbox')).toHaveFocus();
    await user.tab();
    const toggle = screen.getByRole('button', { name: 'Filtros' });
    expect(toggle).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await user.tab();
    expect(screen.getByRole('combobox', { name: 'Ámbito' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(toggle).toHaveFocus();
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await user.keyboard(' ');
    expect(screen.getByRole('combobox', { name: 'Categoría' })).toBeVisible();
    await user.click(toggle);
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('cuenta filtros adicionales y los conserva al contraer el panel', async () => {
    const user = userEvent.setup();
    render(<FiltersHarness extra />);
    await user.click(screen.getByRole('button', { name: 'Filtros' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Ámbito' }), 'PERSONAL');
    expect(screen.getByRole('button', { name: 'Filtros 1 activo' })).toBeInTheDocument();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Categoría' }), 'light');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Tipo de gasto' }), 'INVOICE');
    await user.click(screen.getByRole('button', { name: 'Filtros 3 activos' }));
    expect(screen.getByRole('button', { name: 'Filtros 3 activos' })).toHaveAttribute('aria-expanded', 'false');
    await user.click(screen.getByRole('button', { name: 'Filtros 3 activos' }));
    expect(screen.getByRole('combobox', { name: 'Categoría' })).toHaveValue('light');
  });

  it('limpia búsqueda y todos los filtros desde el panel cerrado y enfoca el buscador', async () => {
    const user = userEvent.setup();
    render(<FiltersHarness extra />);
    await user.type(screen.getByRole('searchbox'), 'Luz');
    await user.click(screen.getByRole('button', { name: 'Filtros' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Ámbito' }), 'PERSONAL');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Categoría' }), 'light');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Tipo de gasto' }), 'INVOICE');
    await user.click(screen.getByRole('button', { name: 'Filtros 3 activos' }));
    await user.click(screen.getByRole('button', { name: 'Limpiar filtros' }));
    expect(screen.getByRole('searchbox')).toHaveValue('');
    expect(screen.getByRole('searchbox')).toHaveFocus();
    expect(screen.queryByRole('button', { name: 'Limpiar filtros' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Filtros' }));
    screen.getAllByRole('combobox').forEach((select) => expect(select).toHaveValue('ALL'));
  });

  it('permite limpiar solo la búsqueda sin contarla como filtro oculto', async () => {
    const user = userEvent.setup();
    render(<FiltersHarness />);
    await user.type(screen.getByRole('searchbox'), 'Una nota');
    expect(screen.getByRole('button', { name: 'Filtros' })).toHaveAttribute('aria-expanded', 'false');
    await user.click(screen.getByRole('button', { name: 'Limpiar filtros' }));
    expect(screen.getByRole('searchbox')).toHaveValue('');
  });

  it('asocia cada instancia a un panel distinto', () => {
    render(<><FiltersHarness /><FiltersHarness /></>);
    const controls = screen.getAllByRole('button', { name: 'Filtros' }).map((button) => button.getAttribute('aria-controls'));
    expect(new Set(controls).size).toBe(2);
    controls.forEach((id) => expect(document.getElementById(id)).toBeInTheDocument());
  });
});
