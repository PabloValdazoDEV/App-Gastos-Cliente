import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { MorePage } from './MorePage';

describe('Más: garantías', () => {
  it('ofrece Garantías fuera del presupuesto, sin prometer documentos o IA', () => {
    render(<MemoryRouter><MorePage /></MemoryRouter>);
    expect(screen.getByRole('link', { name: /Garantías Tickets y garantías de tus productos. No cuentan en el presupuesto/ })).toHaveAttribute('href', '/compras');
    expect(screen.getByRole('link', { name: /Cuentas y saldos/ })).toHaveAttribute('href', '/cuentas');
    expect(screen.queryByText(/inteligencia|documentos|financiación/i)).not.toBeInTheDocument();
  });
});
