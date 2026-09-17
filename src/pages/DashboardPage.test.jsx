import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { queryKeys } from '../api/queryKeys';
import { financeService } from '../features/finance/financeService';
import { invalidateBudgetQueries } from '../features/finance/invalidateBudgetQueries';
import { invalidatePaymentQueries } from '../features/finance/paymentOccurrence';
import { HouseholdContext } from '../features/households/householdStateContext';
import { invalidatePurchasePaymentQueries } from '../features/purchases/purchasePaymentsService';
import { invalidatePurchaseQueries } from '../features/purchases/invalidatePurchaseQueries';
import { DashboardPage } from './DashboardPage';

vi.mock('../features/finance/financeService', () => ({ financeService: { dashboard: vi.fn() } }));

const household = { contributionDay: 10, currency: 'EUR', id: 'household-1', name: 'Casa' };
const commonTitle = 'Presupuesto común del mes';
const coverageTitle = '¿El saldo conjunto cubre lo que queda?';

function progress(overrides = {}) {
  return { budgetCents: 50_000, usedCents: 0, remainingCents: 50_000, overBudgetCents: 0, progressBps: 0, status: 'WITHIN_BUDGET', ...overrides };
}

function coverage(overrides = {}) {
  return { balanceCents: 145_000, remainingBudgetCents: 50_000, cushionCents: 95_000, shortfallCents: 0, status: 'COVERED', balanceSource: 'ACCOUNTS', ...overrides };
}

function dashboardData(overrides = {}) {
  return {
    activeRecoveryPlan: null,
    accountSummary: { hasAccounts: true },
    // Legacy planning figures must not determine the progress or coverage UI.
    balanceCents: 10_000,
    deficitCents: 40_000,
    financialStatus: 'DEFICIT',
    theoreticalReserveCents: 50_000,
    budget: {
      contributions: [{ personId: 'person-1', personName: 'Pablo', personalExpenseCents: 0, standardHouseholdCents: 50_000, totalStandardCents: 50_000 }],
      householdBudgetCents: 50_000,
      readiness: { ready: true },
      recommendedBudgetCents: 50_000,
      sourceCoverage: { invoiceCategoryCount: 0, recurringCount: 1, variableCategoryCount: 0 },
    },
    calculationDate: '2026-09-05',
    household: { currency: 'EUR', id: household.id, name: household.name, safetyMarginBps: 1000 },
    monthlyProgress: { common: progress(), personal: null },
    cashCoverage: { common: coverage(), personal: null },
    nextPayment: null,
    planning: null,
    ...overrides,
  };
}

function renderWithHousehold(householdOverrides = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const result = render(
    <QueryClientProvider client={client}>
      <HouseholdContext.Provider value={{ currentHousehold: household, households: [household], isPending: false, isError: false, ...householdOverrides }}>
        <MemoryRouter><DashboardPage /></MemoryRouter>
      </HouseholdContext.Provider>
    </QueryClientProvider>,
  );
  return { ...result, client };
}

function amount(region, label) {
  return within(region).getByText(label, { exact: true }).parentElement.querySelector('dd');
}

function exampleData(overrides = {}) {
  return dashboardData({
    monthlyProgress: { common: progress({ budgetCents: 120_000, usedCents: 58_000, remainingCents: 62_000, progressBps: 4833 }), personal: null },
    cashCoverage: { common: coverage({ remainingBudgetCents: 62_000, cushionCents: 83_000 }), personal: null },
    ...overrides,
  });
}

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    financeService.dashboard.mockResolvedValue(dashboardData());
  });

  it('explica el estado vacío sin inventar importes ni consultar sin hogar', () => {
    renderWithHousehold({ currentHousehold: null, households: [] });
    expect(screen.getByRole('heading', { name: '¿Cómo vais este mes?' })).toBeInTheDocument();
    expect(screen.queryByText(/\d+[,.]\d{2}\s?€/)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Crear mi hogar' })).toHaveAttribute('href', '/hogar');
    expect(financeService.dashboard).not.toHaveBeenCalled();
  });

  it('mantiene el mes como pendiente antes del día habitual sin falsa alerta', async () => {
    renderWithHousehold();
    expect(await screen.findByRole('heading', { name: 'Pendiente de confirmar saldos' })).toBeInTheDocument();
    expect(screen.getByText(/prevista para el día 10/i)).toBeInTheDocument();
    expect(screen.queryByText('Déficit detectado')).not.toBeInTheDocument();
    expect(screen.queryByText(/Faltan/)).not.toBeInTheDocument();
    expect(screen.queryByText('Reserva teórica')).not.toBeInTheDocument();
    const contribution = screen.getByRole('article', { name: 'Aportación de Pablo' });
    for (const label of ['Aportación conjunta', 'Gastos personales', 'Ajuste conjunto', 'Total a aportar']) expect(within(contribution).getByText(label)).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: commonTitle })).getByText('En presupuesto')).toBeInTheDocument();
  });

  it('pide confirmar los saldos después del día habitual sin convertirlo en alarma', async () => {
    financeService.dashboard.mockResolvedValue(dashboardData({ calculationDate: '2026-09-12' }));
    renderWithHousehold();
    expect(await screen.findByRole('heading', { name: 'Confirma los saldos de septiembre de 2026' })).toBeInTheDocument();
    expect(screen.getByText(/Introduce el saldo conjunto/i)).toBeInTheDocument();
    expect(screen.queryByText('Déficit detectado')).not.toBeInTheDocument();
  });

  it('ofrece registrar directamente el próximo vencimiento y abrir el calendario', async () => {
    financeService.dashboard.mockResolvedValue(dashboardData({ nextPayment: { amountCents: 75_000, dueDate: '2026-09-15', expenseId: 'expense-rent', name: 'Alquiler' } }));
    renderWithHousehold();
    expect(await screen.findByRole('link', { name: 'Registrar pago de Alquiler' })).toHaveAttribute('href', '/gastos/recurrentes/expense-rent?action=register-payment');
    expect(screen.getByRole('link', { name: 'Ver calendario' })).toHaveAttribute('href', '/calendario');
  });

  it('desglosa aportaciones del mes preparado después del restante sin sumar el ajuste al presupuesto', async () => {
    financeService.dashboard.mockResolvedValue(dashboardData({
      calculationDate: '2026-09-12',
      planning: {
        contributions: [{ householdPersonId: 'person-1', personName: 'Pablo', personalExpenseCents: 10_000, standardHouseholdCents: 40_000, temporaryAdjustmentCents: 2_000, totalRecommendedCents: 52_000 }],
        fundingStatus: 'PREPARED', recommendedBudgetCents: 50_000,
      },
    }));
    renderWithHousehold();
    const contribution = await screen.findByRole('article', { name: 'Aportación de Pablo' });
    for (const value of [/400,00/, /100,00/, /^20,00/, /^520,00/]) expect(within(contribution).getByText(value)).toBeInTheDocument();
    const common = screen.getByRole('region', { name: commonTitle });
    expect(amount(common, 'Presupuesto del mes')).toHaveTextContent('500,00');
    expect(amount(common, 'Presupuesto restante')).toHaveTextContent('500,00');
    expect(common.compareDocumentPosition(contribution) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Aportaciones del mes preparado' })).toBeInTheDocument();
    expect(screen.queryByText(/Presupuesto estimado/)).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Confirmar saldos del mes' })).not.toBeInTheDocument();
  });

  it.each([
    ['PURCHASE_INSTALLMENT', 'Cuota de compra'],
    ['PURCHASE_DOWN_PAYMENT', 'Entrada de compra'],
  ])('enlaza %s a su compra sin inventar un gasto recurrente', async (sourceType, label) => {
    financeService.dashboard.mockResolvedValue(dashboardData({ nextPayment: { sourceType, purchaseId: 'mobile', name: 'Móvil · Cuota 1/20', amountCents: 5000, dueDate: '2026-09-17' } }));
    renderWithHousehold();
    expect(await screen.findByRole('link', { name: 'Ver pagos de Móvil · Cuota 1/20' })).toHaveAttribute('href', '/compras/mobile');
    expect(screen.getByText(label)).toBeVisible();
    expect(screen.queryByRole('link', { name: /Registrar pago de/ })).not.toBeInTheDocument();
  });

  it('explica la actualización de aportaciones conservando la preparación y los saldos', async () => {
    financeService.dashboard.mockResolvedValue(dashboardData({ planning: { budgetChangedSincePreparation: true, fundingStatus: 'PREPARED', contributions: [] } }));
    renderWithHousehold();
    const notice = await screen.findByText(/El presupuesto ha cambiado desde que preparaste el mes/);
    expect(notice).toHaveTextContent('El presupuesto ha cambiado');
    expect(notice).toHaveTextContent('Los saldos confirmados y el registro de preparación se conservan');
  });

  it('identifica el importe propio de una próxima cuota repartida', async () => {
    financeService.dashboard.mockResolvedValue(dashboardData({ nextPayment: { sourceType: 'PURCHASE_INSTALLMENT', purchaseId: 'split', ownershipType: 'SPLIT', name: 'Ordenador · Cuota 2/10', amountCents: 6000, dueDate: '2026-09-17' } }));
    renderWithHousehold();
    expect(await screen.findByText(/Tu parte: 60,00/)).toBeVisible();
  });

  it('explica por qué no reutiliza saldos privados de una preparación antigua sin identidad verificable', async () => {
    financeService.dashboard.mockResolvedValue(dashboardData({ planning: { personalHistoryRequiresConfirmation: true, fundingStatus: 'PREPARED', contributions: [] } }));
    renderWithHousehold();
    expect(await screen.findByText(/Por privacidad no usamos esos saldos/)).toBeVisible();
    expect(screen.getByRole('link', { name: 'Actualiza tu saldo en Cuentas' })).toHaveAttribute('href', '/cuentas');
  });

  it('comprueba el saldo personal solo contra el presupuesto personal restante, no contra la aportación común', async () => {
    financeService.dashboard.mockResolvedValue(dashboardData({
      monthlyProgress: { common: progress(), personal: progress({ budgetCents: 52_788, usedCents: 10_000, remainingCents: 42_788, progressBps: 1894 }) },
      cashCoverage: { common: coverage(), personal: coverage({ balanceCents: 80_000, remainingBudgetCents: 42_788, cushionCents: 37_212 }) },
    }));
    renderWithHousehold();
    const personal = await screen.findByRole('region', { name: 'Tu saldo personal' });
    expect(amount(personal, 'Saldo actual')).toHaveTextContent('800,00');
    expect(amount(personal, 'Presupuesto restante')).toHaveTextContent('427,88');
    expect(amount(personal, 'Colchón')).toHaveTextContent('372,12');
    expect(within(personal).getByText('Cubierto')).toBeInTheDocument();
    expect(screen.getByText(/los saldos de ambas cuentas no se suman/)).toBeInTheDocument();
    expect(amount(screen.getByRole('region', { name: coverageTitle }), 'Saldo actual')).toHaveTextContent('1450,00');
    expect(screen.queryByText(/2250,00/)).not.toBeInTheDocument();
  });

  it('prioriza los 620 euros restantes del ejemplo y muestra utilizado, presupuesto y cobertura separados', async () => {
    financeService.dashboard.mockResolvedValue(exampleData());
    renderWithHousehold();
    const common = await screen.findByRole('region', { name: commonTitle });
    expect(within(common).getByText('Te quedan', { exact: false }).closest('p')).toHaveTextContent(/Te quedan620,00/);
    expect(amount(common, 'Presupuesto del mes')).toHaveTextContent('1200,00');
    expect(amount(common, 'Utilizado')).toHaveTextContent('580,00');
    expect(amount(common, 'Presupuesto restante')).toHaveTextContent('620,00');
    const cash = screen.getByRole('region', { name: coverageTitle });
    expect(amount(cash, 'Saldo actual')).toHaveTextContent('1450,00');
    expect(amount(cash, 'Presupuesto restante')).toHaveTextContent('620,00');
    expect(amount(cash, 'Colchón')).toHaveTextContent('830,00');
    expect(common.compareDocumentPosition(cash) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(cash).getByText('Según los saldos registrados')).toBeInTheDocument();
    expect(within(cash).getByText(/No incluye gastos que aún no hayas registrado/)).toBeInTheDocument();
  });

  it('expone una barra accesible con valor, límites, importe y descripción textual', async () => {
    financeService.dashboard.mockResolvedValue(exampleData());
    renderWithHousehold();
    const bar = await screen.findByRole('progressbar', { name: `Utilización: ${commonTitle}` });
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '100');
    expect(bar).toHaveAttribute('aria-valuenow', '48.33');
    expect(bar).toHaveAttribute('aria-valuetext', expect.stringMatching(/48,33 % utilizado: 580,00.*de 1200,00/));
    expect(bar).toHaveAccessibleDescription('48,33 % utilizado');
    expect(bar.firstElementChild).toHaveStyle({ width: '48.33%' });
  });

  it('señala cerca del límite desde el 80 por ciento mediante texto, no solo color', async () => {
    financeService.dashboard.mockResolvedValue(dashboardData({ monthlyProgress: { common: progress({ usedCents: 40_000, remainingCents: 10_000, progressBps: 8000, status: 'NEAR_LIMIT' }), personal: null } }));
    renderWithHousehold();
    const common = await screen.findByRole('region', { name: commonTitle });
    expect(within(common).getByText('Cerca del límite')).toBeInTheDocument();
    expect(within(common).getByText('80 % utilizado')).toBeInTheDocument();
    expect(amount(common, 'Presupuesto restante')).toHaveTextContent('100,00');
  });

  it('explica el 112 por ciento y el exceso aunque el saldo sea suficiente, limitando solo la barra visual', async () => {
    financeService.dashboard.mockResolvedValue(dashboardData({
      monthlyProgress: { common: progress({ usedCents: 56_000, remainingCents: 0, overBudgetCents: 6000, progressBps: 11_200, status: 'OVER_BUDGET' }), personal: null },
      cashCoverage: { common: coverage({ balanceCents: 200_000, remainingBudgetCents: 0, cushionCents: 200_000 }), personal: null },
    }));
    renderWithHousehold();
    const common = await screen.findByRole('region', { name: commonTitle });
    expect(within(common).getByText('Has superado el presupuesto en', { exact: false })).toHaveTextContent('60,00');
    expect(within(common).queryByText('Te quedan', { exact: false })).not.toBeInTheDocument();
    expect(within(common).getByText('Presupuesto superado')).toBeInTheDocument();
    expect(within(common).getByText('112 % utilizado')).toBeInTheDocument();
    const bar = within(common).getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '100');
    expect(bar).toHaveAttribute('aria-valuetext', expect.stringMatching(/112 % utilizado.*superado en 60,00/));
    expect(bar.firstElementChild).toHaveStyle({ width: '100%' });
    expect(within(screen.getByRole('region', { name: coverageTitle })).getByText('Cubierto')).toBeInTheDocument();
    expect(screen.queryByText(/en números rojos/i)).not.toBeInTheDocument();
  });

  it('muestra falta de saldo en positivo e independiente de estar dentro del presupuesto', async () => {
    financeService.dashboard.mockResolvedValue(dashboardData({
      monthlyProgress: { common: progress({ budgetCents: 120_000, usedCents: 50_000, remainingCents: 70_000, progressBps: 4166 }), personal: null },
      cashCoverage: { common: coverage({ balanceCents: 45_000, remainingBudgetCents: 70_000, cushionCents: -25_000, shortfallCents: 25_000, status: 'SHORTFALL' }), personal: null },
    }));
    renderWithHousehold();
    const cash = await screen.findByRole('region', { name: coverageTitle });
    expect(within(cash).getByText('Falta saldo')).toBeInTheDocument();
    expect(within(cash).getByText(/Faltan 250,00.*para cubrir el presupuesto restante/)).toBeInTheDocument();
    expect(amount(cash, 'Pendiente por cubrir')).toHaveTextContent('250,00');
    expect(within(cash).queryByText(/-250/)).not.toBeInTheDocument();
    expect(within(cash).queryByText('Colchón')).not.toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: commonTitle })).getByText('En presupuesto')).toBeInTheDocument();
  });

  it('no confunde saldo, presupuesto ni los antiguos indicadores de planificación', async () => {
    renderWithHousehold();
    const cash = await screen.findByRole('region', { name: coverageTitle });
    expect(amount(cash, 'Saldo actual')).toHaveTextContent('1450,00');
    expect(screen.queryByText(/disponible/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/puedes gastar|te sobran|tu banco tiene|déficit detectado/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Las aportaciones financian el mes; no son el presupuesto que queda/)).toBeInTheDocument();
  });

  it('sin planificación conserva los gastos reales y avisa de que presupuesto y saldos no están confirmados', async () => {
    financeService.dashboard.mockResolvedValue(exampleData());
    renderWithHousehold();
    const common = await screen.findByRole('region', { name: commonTitle });
    expect(within(common).getByText(/Presupuesto estimado/)).toBeInTheDocument();
    expect(amount(common, 'Utilizado')).toHaveTextContent('580,00');
    expect(screen.getByText(/Los saldos del mes todavía no están confirmados/)).toHaveTextContent('El progreso utiliza los gastos reales registrados');
    expect(screen.getByRole('heading', { name: 'Aportaciones estimadas' })).toBeInTheDocument();
  });

  it('con planificación financiada mantiene el progreso y presenta las aportaciones como sección secundaria', async () => {
    financeService.dashboard.mockResolvedValue(exampleData({ planning: { contributions: [], fundingStatus: 'FUNDED' } }));
    renderWithHousehold();
    const common = await screen.findByRole('region', { name: commonTitle });
    expect(amount(common, 'Utilizado')).toHaveTextContent('580,00');
    expect(screen.getByText('Fondos confirmados')).toBeInTheDocument();
    expect(screen.queryByText(/Los saldos del mes todavía no están confirmados/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Presupuesto estimado/)).not.toBeInTheDocument();
    const contributions = screen.getByRole('region', { name: 'Aportaciones del mes preparado' });
    expect(common.compareDocumentPosition(contributions) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('muestra carga accesible sin cifras provisionales', () => {
    financeService.dashboard.mockReturnValue(new Promise(() => {}));
    renderWithHousehold();
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText('Calculando presupuesto')).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.queryByText(/Te quedan/)).not.toBeInTheDocument();
  });

  it('explica el error y permite reintentar sin inventar un presupuesto cero', async () => {
    const user = userEvent.setup();
    financeService.dashboard.mockRejectedValueOnce(new Error('No se pudo cargar el resumen.'));
    renderWithHousehold();
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo cargar el resumen.');
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Volver a intentarlo' }));
    expect(await screen.findByRole('region', { name: commonTitle })).toBeInTheDocument();
    expect(financeService.dashboard).toHaveBeenCalledTimes(2);
  });

  it('con presupuesto y utilizado cero presenta cero por ciento sin NaN ni división por cero', async () => {
    financeService.dashboard.mockResolvedValue(dashboardData({ monthlyProgress: { common: progress({ budgetCents: 0, remainingCents: 0 }), personal: null } }));
    renderWithHousehold();
    const common = await screen.findByRole('region', { name: commonTitle });
    for (const label of ['Presupuesto del mes', 'Utilizado', 'Presupuesto restante']) expect(amount(common, label)).toHaveTextContent('0,00');
    expect(within(common).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
    expect(within(common).getByText('0 % utilizado')).toBeInTheDocument();
    expect(common).not.toHaveTextContent(/NaN|Infinity/);
  });

  it('con gasto sin presupuesto reconoce el exceso y explica por qué no calcula un porcentaje', async () => {
    financeService.dashboard.mockResolvedValue(dashboardData({ monthlyProgress: { common: progress({ budgetCents: 0, usedCents: 2500, remainingCents: 0, overBudgetCents: 2500, progressBps: null, status: 'OVER_BUDGET' }), personal: null } }));
    renderWithHousehold();
    const common = await screen.findByRole('region', { name: commonTitle });
    expect(within(common).getByText('Has superado el presupuesto en', { exact: false })).toHaveTextContent('25,00');
    expect(within(common).getByText(/no se puede calcular un porcentaje/)).toBeInTheDocument();
    expect(within(common).queryByRole('progressbar')).not.toBeInTheDocument();
    expect(common).not.toHaveTextContent(/NaN|Infinity/);
  });

  it('si el reparto no está listo solicita completarlo sin presentar un presupuesto fiable', async () => {
    const data = dashboardData();
    financeService.dashboard.mockResolvedValue({ ...data, budget: { ...data.budget, readiness: { ready: false } } });
    renderWithHousehold();
    expect(await screen.findByRole('heading', { name: 'El presupuesto aún no se puede calcular' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Completar reparto' })).toHaveAttribute('href', '/hogar');
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.queryByText(/Te quedan/)).not.toBeInTheDocument();
  });

  it('una API sin monthlyProgress muestra error explícito, nunca resta el presupuesto completo al saldo', async () => {
    financeService.dashboard.mockResolvedValue(dashboardData({ monthlyProgress: undefined }));
    renderWithHousehold();
    expect(await screen.findByRole('alert', { name: 'Resumen mensual no disponible' })).toHaveTextContent('No se ha recibido el resumen mensual');
    expect(screen.getByRole('button', { name: 'Volver a intentarlo' })).toBeInTheDocument();
    expect(screen.queryByText(/Te quedan/)).not.toBeInTheDocument();
  });

  it('no reconstruye datos personales desde resúmenes antiguos cuando la API no devuelve un scope personal visible', async () => {
    financeService.dashboard.mockResolvedValue(dashboardData({
      accountSummary: { hasAccounts: true, personal: [{ personId: 'another-person', personName: 'Persona ajena', balanceCents: 987_654 }] },
    }));
    renderWithHousehold();
    await screen.findByRole('region', { name: commonTitle });
    expect(screen.queryByRole('region', { name: 'Tu presupuesto personal' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Tu saldo personal' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Persona ajena|9876,54/)).not.toBeInTheDocument();
  });

  it('un presupuesto personal visible sin saldo registrado no inventa cobertura', async () => {
    financeService.dashboard.mockResolvedValue(dashboardData({ monthlyProgress: { common: progress(), personal: progress({ budgetCents: 8000, usedCents: 3000, remainingCents: 5000, progressBps: 3750 }) } }));
    renderWithHousehold();
    const personal = await screen.findByRole('region', { name: 'Tu saldo personal' });
    expect(within(personal).getByText(/Saldo personal sin registrar/)).toBeInTheDocument();
    expect(within(personal).queryByText('Cubierto')).not.toBeInTheDocument();
    expect(within(personal).queryByText('Falta saldo')).not.toBeInTheDocument();
    expect(within(personal).queryByText('Saldo actual')).not.toBeInTheDocument();
    expect(amount(screen.getByRole('region', { name: 'Tu presupuesto personal' }), 'Utilizado')).toHaveTextContent('30,00');
  });

  it('avisa cuando el saldo personal procede de la confirmación mensual y no de cuentas actualizadas', async () => {
    financeService.dashboard.mockResolvedValue(dashboardData({
      monthlyProgress: { common: progress(), personal: progress() },
      cashCoverage: { common: coverage(), personal: coverage({ balanceSource: 'MONTHLY_PLANNING' }) },
    }));
    renderWithHousehold();
    const personal = await screen.findByRole('region', { name: 'Tu saldo personal' });
    expect(within(personal).getByText(/saldo confirmado al preparar el mes; revísalo si ha cambiado/)).toBeInTheDocument();
    expect(within(personal).getByText('Según los saldos registrados')).toBeInTheDocument();
  });

  it('permite envolver importes grandes y apila las métricas antes de sm sin mínimos rígidos', async () => {
    financeService.dashboard.mockResolvedValue(dashboardData({
      monthlyProgress: { common: progress({ budgetCents: 123_456_789_012, remainingCents: 123_456_789_012 }), personal: null },
      cashCoverage: { common: coverage({ balanceCents: 223_456_789_012, remainingBudgetCents: 123_456_789_012, cushionCents: 100_000_000_000 }), personal: null },
    }));
    const { container } = renderWithHousehold();
    const common = await screen.findByRole('region', { name: commonTitle });
    expect(common).toHaveClass('min-w-0');
    expect(common.querySelector('dl')).toHaveClass('grid', 'min-w-0', 'sm:grid-cols-3');
    expect(common.querySelector('dl')).not.toHaveClass('grid-cols-3');
    expect(amount(common, 'Presupuesto restante')).toHaveTextContent('1.234.567.890,12');
    for (const region of [common, screen.getByRole('region', { name: coverageTitle })]) {
      expect(region).toHaveClass('min-w-0');
      for (const value of region.querySelectorAll('dd')) expect(value).toHaveClass('break-words');
    }
    expect(container.firstElementChild).toHaveClass('min-w-0');
    for (const link of screen.getAllByRole('link')) expect(link).toHaveClass('min-h-11');
  });

  it.each([
    ['pago o corrección', (client) => invalidatePaymentQueries(client, household.id, 'expense-1')],
    ['variable, factura o puntual', (client) => invalidateBudgetQueries(client, household.id)],
    ['crear o editar compra', (client) => invalidatePurchaseQueries(client, household.id, 'purchase-1')],
    ['pagar, corregir o revertir cuota', (client) => invalidatePurchasePaymentQueries(client, household.id, 'purchase-1')],
  ])('refresca cifras renderizadas al invalidar por %s, sin cálculos duplicados en UI', async (_change, invalidate) => {
    const { client } = renderWithHousehold();
    const common = await screen.findByRole('region', { name: commonTitle });
    expect(amount(common, 'Utilizado')).toHaveTextContent('0,00');
    financeService.dashboard.mockResolvedValue(exampleData());
    await act(async () => { await invalidate(client); });
    await waitFor(() => expect(amount(common, 'Utilizado')).toHaveTextContent('580,00'));
    expect(amount(common, 'Presupuesto restante')).toHaveTextContent('620,00');
    expect(amount(screen.getByRole('region', { name: coverageTitle }), 'Colchón')).toHaveTextContent('830,00');
    expect(client.getQueryData(queryKeys.dashboard(household.id, 'current')).monthlyProgress.common.usedCents).toBe(58_000);
    expect(financeService.dashboard).toHaveBeenCalledTimes(2);
  });

  it('una cuota real de 52 € mantiene presupuesto de 50 € y muestra exceso de 2 €, sin mover saldos', async () => {
    financeService.dashboard.mockResolvedValue(dashboardData({ monthlyProgress: { common: progress({ budgetCents: 5000, remainingCents: 5000 }), personal: null } }));
    const { client } = renderWithHousehold();
    const common = await screen.findByRole('region', { name: commonTitle });
    financeService.dashboard.mockResolvedValue(dashboardData({
      monthlyProgress: { common: progress({ budgetCents: 5000, usedCents: 5200, remainingCents: 0, overBudgetCents: 200, progressBps: 10400, status: 'OVER_BUDGET' }), personal: null },
      cashCoverage: { common: coverage({ remainingBudgetCents: 0, cushionCents: 145000 }), personal: null },
    }));
    await act(async () => { await invalidatePurchasePaymentQueries(client, household.id, 'mobile'); });
    await waitFor(() => expect(amount(common, 'Utilizado')).toHaveTextContent('52,00'));
    expect(amount(common, 'Presupuesto del mes')).toHaveTextContent('50,00');
    expect(amount(common, 'Presupuesto restante')).toHaveTextContent('0,00');
    expect(within(common).getByText('Has superado el presupuesto en').closest('p')).toHaveTextContent('2,00');
    expect(amount(screen.getByRole('region', { name: coverageTitle }), 'Saldo actual')).toHaveTextContent('1450,00');
  });

  it('muestra solo 60 € personales de una cuota SPLIT 60/40, sin añadirlos al presupuesto común', async () => {
    financeService.dashboard.mockResolvedValue(dashboardData({ monthlyProgress: { common: progress(), personal: progress({ budgetCents: 6000, usedCents: 6000, remainingCents: 0, progressBps: 10000 }) } }));
    renderWithHousehold();
    const personal = await screen.findByRole('region', { name: 'Tu presupuesto personal' });
    expect(amount(personal, 'Utilizado')).toHaveTextContent('60,00');
    expect(amount(personal, 'Presupuesto del mes')).toHaveTextContent('60,00');
    expect(amount(screen.getByRole('region', { name: commonTitle }), 'Presupuesto del mes')).toHaveTextContent('500,00');
    expect(screen.queryByText(/^40,00/)).not.toBeInTheDocument();
  });

  it('ofrece las reglas temporales y la limitación de puntuales en un detalle secundario', async () => {
    renderWithHousehold();
    const disclosure = await screen.findByText('Cómo se ha calculado');
    expect(disclosure.tagName).toBe('SUMMARY');
    expect(disclosure.parentElement).not.toHaveAttribute('open');
    expect(disclosure.parentElement).toHaveTextContent('pagos recurrentes por su vencimiento');
    expect(disclosure.parentElement).toHaveTextContent('facturas por fecha de cobro (o emisión si no hay fecha de cobro)');
    expect(disclosure.parentElement).toHaveTextContent('Los omitidos no suman');
    expect(disclosure.parentElement).toHaveTextContent('no se descuentan como utilizados');
    expect(disclosure.parentElement).toHaveTextContent('El margen no gastado sigue dentro del presupuesto restante');
  });
});
