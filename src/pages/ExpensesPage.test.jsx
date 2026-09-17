import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { ExpensesPage } from './ExpensesPage';

describe('ExpensesPage', () => {
  it('conserva las cuatro tarjetas completas como enlaces en orden y accesibles por teclado', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><ExpensesPage /></MemoryRouter>);
    const links = screen.getAllByRole('link');
    const expected = [
      ['Recurrentes', '/gastos/recurrentes'], ['Facturas', '/facturas'],
      ['Variables', '/gastos/variables'], ['Puntuales', '/gastos/puntuales'],
    ];
    expect(links).toHaveLength(4);
    for (const [index, [label, path]] of expected.entries()) {
      expect(links[index]).toHaveTextContent(label);
      expect(links[index]).toHaveAttribute('href', path);
      await user.tab();
      expect(links[index]).toHaveFocus();
    }
  });
});
