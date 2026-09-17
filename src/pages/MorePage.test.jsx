import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { MorePage } from './MorePage';

describe('Más: compras', () => {
  it('integra Compras en la navegación existente sin prometer documentos o IA', () => {
    render(<MemoryRouter><MorePage /></MemoryRouter>);
    expect(screen.getByRole('link', { name: /Compras Tus compras importantes, productos y garantías/ })).toHaveAttribute('href', '/compras');
    expect(screen.getByRole('link', { name: /Cuentas y saldos/ })).toHaveAttribute('href', '/cuentas');
    expect(screen.queryByText(/inteligencia|documentos|financiación/i)).not.toBeInTheDocument();
  });
});
