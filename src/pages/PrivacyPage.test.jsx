import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const policyState = vi.hoisted(() => ({
  current: {},
}));

vi.mock('../features/legal/privacyPolicyQueries', () => ({
  usePrivacyPolicyQuery: () => policyState.current,
}));

import { PrivacyPage } from './PrivacyPage';

const configuredPolicy = {
  configured: true,
  controller: {
    address: 'Calle Ejemplo 1, Madrid',
    contactEmail: 'privacidad@example.com',
    dpoEmail: 'dpd@example.com',
    name: 'Responsable Demo',
  },
  effectiveDate: '2026-08-26',
  version: '2026-08-26',
};

function renderPage() {
  return render(
    <MemoryRouter>
      <PrivacyPage />
    </MemoryRouter>,
  );
}

describe('PrivacyPage', () => {
  beforeEach(() => {
    policyState.current = {
      data: configuredPolicy,
      isError: false,
      isPending: false,
      refetch: vi.fn(),
    };
  });

  it('muestra metadatos dinámicos y las dos capas de información', () => {
    renderPage();

    expect(
      screen.getByRole('heading', { name: 'Política de privacidad', level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getAllByText('Responsable Demo').length).toBeGreaterThan(0);
    expect(screen.getAllByText('2026-08-26').length).toBeGreaterThan(0);
    expect(
      screen.getAllByText('26 de agosto de 2026').length,
    ).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: 'Resumen esencial' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Finalidades del tratamiento' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Conservación de los datos' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Menores' })).toBeInTheDocument();
    expect(screen.getByText(/resultados son orientativos/i)).toBeInTheDocument();
    expect(screen.getByText(/no ofrece una función autoservicio/i)).toBeInTheDocument();
    expect(screen.getByText(/no solicita la edad/i)).toBeInTheDocument();
    expect(screen.getByText(/adjuntar opcionalmente documentos PDF/i)).toBeInTheDocument();
    expect(screen.getByText(/metadatos EXIF/i)).toBeInTheDocument();
    expect(screen.getByText(/no aplica OCR/i)).toBeInTheDocument();
    expect(screen.getByText(/retira del almacenamiento activo/i)).toBeInTheDocument();

    expect(
      screen.getAllByRole('link', { name: 'privacidad@example.com' })[0],
    ).toHaveAttribute('href', 'mailto:privacidad@example.com');
    expect(
      screen.getByRole('link', { name: /Agencia Española de Protección de Datos/ }),
    ).toHaveAttribute(
      'href',
      'https://www.aepd.es/derechos-y-deberes/ejerce-tus-derechos',
    );
  });

  it('señala que el registro permanece bloqueado si falta configuración', () => {
    policyState.current.data = {
      configured: false,
      controller: {
        address: null,
        contactEmail: null,
        dpoEmail: null,
        name: null,
      },
      effectiveDate: null,
      version: null,
    };

    renderPage();

    expect(
      screen.getByRole('heading', { name: 'Política todavía no publicada' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/registro permanecerá bloqueado/i)).toBeInTheDocument();
    expect(screen.getAllByText('No configurado').length).toBeGreaterThan(0);
  });

  it('ofrece reintentar cuando fallan los metadatos públicos', async () => {
    const user = userEvent.setup();
    const refetch = vi.fn();
    policyState.current = {
      error: new Error('Sin conexión'),
      isError: true,
      isPending: false,
      refetch,
    };

    renderPage();
    await user.click(screen.getByRole('button', { name: 'Volver a intentarlo' }));

    expect(refetch).toHaveBeenCalled();
  });

  it('omite dirección y DPD cuando esos metadatos opcionales no existen', () => {
    policyState.current.data = {
      ...configuredPolicy,
      controller: {
        address: null,
        contactEmail: 'privacidad@example.com',
        dpoEmail: null,
        name: 'Responsable Demo',
      },
    };

    renderPage();

    expect(screen.queryByText('Dirección:')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Delegado de protección de datos:'),
    ).not.toBeInTheDocument();
  });
});
