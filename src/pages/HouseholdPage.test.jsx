import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { householdService } from '../features/households/householdService';
import { useHousehold } from '../features/households/useHousehold';
import { HouseholdPage } from './HouseholdPage';

vi.mock('../features/households/useHousehold', () => ({
  useHousehold: vi.fn(),
}));

vi.mock('../features/households/householdService', () => ({
  householdService: {
    create: vi.fn(),
    createPerson: vi.fn(),
    get: vi.fn(),
    invite: vi.fn(),
    list: vi.fn(),
    listInvitations: vi.fn(),
    listPeople: vi.fn(),
    update: vi.fn(),
    updateDistribution: vi.fn(),
  },
}));

const householdId = '10000000-0000-4000-8000-000000000001';
const people = [
  {
    id: '10000000-0000-4000-8000-000000000002',
    name: 'Ana',
    email: 'ana@example.com',
    linkedUserId: null,
    contributionBps: 5000,
    fixedContributionCents: null,
    isActive: true,
  },
  {
    id: '10000000-0000-4000-8000-000000000003',
    name: 'Bruno',
    email: null,
    linkedUserId: null,
    contributionBps: 5000,
    fixedContributionCents: null,
    isActive: true,
  },
];

const household = {
  id: householdId,
  name: 'Casa compartida',
  currency: 'EUR',
  safetyMarginBps: 1000,
  contributionDay: 5,
  contributionMode: 'PERCENTAGE',
  access: { role: 'OWNER' },
};

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });

  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <HouseholdPage />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe('HouseholdPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('crea un hogar listo con una primera persona al 100 %', async () => {
    const user = userEvent.setup();
    const selectHousehold = vi.fn();
    const refetch = vi.fn().mockResolvedValue({ data: [] });
    useHousehold.mockReturnValue({
      currentHousehold: null,
      households: [],
      isPending: false,
      isError: false,
      refetch,
      selectHousehold,
    });
    householdService.create.mockResolvedValue({ id: householdId });

    renderPage();
    await user.type(screen.getByLabelText('Nombre del hogar'), 'Casa nueva');
    await user.type(screen.getByLabelText('Tu nombre dentro del reparto'), 'Alex');
    await user.click(screen.getByRole('button', { name: 'Crear hogar y empezar' }));

    await waitFor(() =>
      expect(householdService.create).toHaveBeenCalledWith({
        name: 'Casa nueva',
        contributionMode: 'PERCENTAGE',
        people: [
          {
            name: 'Alex',
            contributionBps: 10000,
            isActive: true,
            linkCurrentUser: true,
          },
        ],
      }),
    );
    expect(selectHousehold).toHaveBeenCalledWith(householdId);
    expect(refetch).toHaveBeenCalled();
  });

  it('guarda el reparto de todas las personas en una sola mutación', async () => {
    const user = userEvent.setup();
    useHousehold.mockReturnValue({
      currentHousehold: household,
      households: [household],
      isPending: false,
      isError: false,
      refetch: vi.fn(),
      selectHousehold: vi.fn(),
    });
    householdService.get.mockResolvedValue(household);
    householdService.listPeople.mockResolvedValue({
      contributionMode: 'PERCENTAGE',
      people,
    });
    householdService.listInvitations.mockResolvedValue([]);
    householdService.updateDistribution.mockResolvedValue({
      contributionMode: 'PERCENTAGE',
      people: [
        { ...people[0], contributionBps: 6000 },
        { ...people[1], contributionBps: 4000 },
      ],
      totals: { totalContributionBps: 10000 },
    });

    renderPage();
    const anaInput = await screen.findByRole('textbox', {
      name: /Porcentaje.*Ana/i,
    });
    const brunoInput = screen.getByRole('textbox', {
      name: /Porcentaje.*Bruno/i,
    });
    await user.clear(anaInput);
    await user.type(anaInput, '60');
    await user.clear(brunoInput);
    await user.type(brunoInput, '40');
    await user.click(screen.getByRole('button', { name: 'Guardar reparto completo' }));

    await waitFor(() =>
      expect(householdService.updateDistribution).toHaveBeenCalledWith({
        householdId,
        body: {
          contributionMode: 'PERCENTAGE',
          people: [
            {
              personId: people[0].id,
              isActive: true,
              contributionBps: 6000,
            },
            {
              personId: people[1].id,
              isActive: true,
              contributionBps: 4000,
            },
          ],
        },
      }),
    );
  });

  it('añade una persona inactiva sin romper el reparto existente', async () => {
    const user = userEvent.setup();
    useHousehold.mockReturnValue({
      currentHousehold: household,
      households: [household],
      isPending: false,
      isError: false,
      refetch: vi.fn(),
      selectHousehold: vi.fn(),
    });
    householdService.get.mockResolvedValue(household);
    householdService.listPeople.mockResolvedValue({
      contributionMode: 'PERCENTAGE',
      people,
    });
    householdService.listInvitations.mockResolvedValue([]);
    householdService.createPerson.mockResolvedValue({ id: crypto.randomUUID() });

    renderPage();
    await user.type(await screen.findByLabelText('Nombre', { selector: 'input' }), 'Carla');
    await user.type(screen.getByLabelText('Correo electrónico'), 'carla@example.com');
    await user.click(screen.getByRole('button', { name: 'Añadir persona inactiva' }));

    await waitFor(() =>
      expect(householdService.createPerson).toHaveBeenCalledWith({
        householdId,
        body: {
          name: 'Carla',
          email: 'carla@example.com',
          isActive: false,
          contributionBps: 0,
        },
      }),
    );
  });

  it('mantiene las invitaciones opcionales y vinculadas a una persona elegida', async () => {
    const user = userEvent.setup();
    useHousehold.mockReturnValue({
      currentHousehold: household,
      households: [household],
      isPending: false,
      isError: false,
      refetch: vi.fn(),
      selectHousehold: vi.fn(),
    });
    householdService.get.mockResolvedValue(household);
    householdService.listPeople.mockResolvedValue({
      contributionMode: 'PERCENTAGE',
      people,
    });
    householdService.listInvitations.mockResolvedValue([]);
    householdService.invite.mockResolvedValue({
      invitation: { id: crypto.randomUUID() },
      token: 'secure-invitation-token',
    });

    renderPage();
    await user.click(
      await screen.findByRole('button', {
        name: 'Crear una invitación opcional',
      }),
    );
    await user.selectOptions(screen.getByLabelText('Persona del hogar'), people[1].id);
    await user.click(screen.getByRole('button', { name: 'Crear enlace seguro' }));

    await waitFor(() =>
      expect(householdService.invite).toHaveBeenCalledWith({
        householdId,
        body: {
          householdPersonId: people[1].id,
          role: 'MEMBER',
        },
      }),
    );
    expect(
      (await screen.findByLabelText('Enlace de invitación')).value,
    ).toContain('#token=secure-invitation-token');
  });

  it('permite a owner configurar el día habitual de aportación', async () => {
    const user = userEvent.setup();
    useHousehold.mockReturnValue({
      currentHousehold: household,
      households: [household],
      isPending: false,
      isError: false,
      refetch: vi.fn(),
      selectHousehold: vi.fn(),
    });
    householdService.get.mockResolvedValue(household);
    householdService.listPeople.mockResolvedValue({
      contributionMode: 'PERCENTAGE',
      people,
    });
    householdService.listInvitations.mockResolvedValue([]);
    householdService.update.mockResolvedValue({ ...household, contributionDay: 15 });

    renderPage();
    const contributionDay = await screen.findByLabelText(
      'Día habitual de aportación',
    );
    await user.clear(contributionDay);
    await user.type(contributionDay, '15');
    await user.click(
      screen.getByRole('button', { name: 'Guardar configuración' }),
    );

    await waitFor(() =>
      expect(householdService.update).toHaveBeenCalledWith({
        householdId,
        body: {
          contributionDay: 15,
          name: household.name,
          safetyMarginBps: 1000,
        },
      }),
    );
  });

  it('muestra el día pero no permite editarlo a un miembro', async () => {
    const memberHousehold = {
      ...household,
      contributionDay: 12,
      access: { role: 'MEMBER' },
    };
    useHousehold.mockReturnValue({
      currentHousehold: memberHousehold,
      households: [memberHousehold],
      isPending: false,
      isError: false,
      refetch: vi.fn(),
      selectHousehold: vi.fn(),
    });
    householdService.get.mockResolvedValue(memberHousehold);
    householdService.listPeople.mockResolvedValue({
      contributionMode: 'PERCENTAGE',
      people,
    });

    renderPage();

    expect(await screen.findByText('Día 12')).toBeInTheDocument();
    expect(
      screen.queryByLabelText('Día habitual de aportación'),
    ).not.toBeInTheDocument();
    expect(householdService.listInvitations).not.toHaveBeenCalled();
  });
});
