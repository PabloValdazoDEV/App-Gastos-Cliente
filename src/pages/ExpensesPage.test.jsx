import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { ExpensesPage } from './ExpensesPage';

describe('ExpensesPage: ¿qué quieres apuntar?', () => {
  it('muestra los cinco tipos con ejemplos y un acceso directo para añadir y otro para ver la lista', () => {
    render(<MemoryRouter><ExpensesPage /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: '¿Qué quieres apuntar?' })).toBeInTheDocument();

    const expected = [
      ['Variable', /Súper/, '/gastos/variables'],
      ['Recurrente', /Alquiler/, '/gastos/recurrentes'],
      ['Factura', /Luz/, '/facturas'],
      ['Puntual', /Dentista/, '/gastos/puntuales'],
      ['Compra', /Electrodoméstico/, '/compras'],
    ];
    const items = within(screen.getByRole('list', { name: 'Tipos de gasto' })).getAllByRole('listitem');
    expect(items).toHaveLength(expected.length);

    expected.forEach(([title, example, path], index) => {
      const item = within(items[index]);
      expect(item.getByRole('heading', { name: title })).toBeInTheDocument();
      expect(item.getByText(example)).toBeVisible();
      expect(item.getByRole('link', { name: `Añadir ${title.toLowerCase()}` })).toHaveAttribute('href', `${path}?nuevo=1`);
      expect(item.getByRole('link', { name: /^Ver / })).toHaveAttribute('href', path);
    });
  });
});
