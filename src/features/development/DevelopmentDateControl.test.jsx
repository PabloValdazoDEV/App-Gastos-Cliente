import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DevelopmentDateControl } from './DevelopmentDateControl';
import { developmentDateForRequest, getDevelopmentDate, saveDevelopmentDate } from './developmentDate';
import { todayIso } from '../../pages/expensePageUtils';
import { purchasePaymentToday } from '../purchases/purchaseInstallmentFormState';

describe('development date selector', () => {
  beforeEach(() => { sessionStorage.clear(); vi.stubEnv('MODE', 'development'); });
  afterEach(() => { vi.unstubAllEnvs(); sessionStorage.clear(); });

  it('saves a date for this tab, reloads calculations and applies it to financial forms', async () => {
    const reload = vi.fn();
    render(<DevelopmentDateControl reload={reload} />);
    fireEvent.change(screen.getByLabelText('Simular hoy'), { target: { value: '2026-10-29' } });
    await userEvent.click(screen.getByRole('button', { name: 'Aplicar fecha' }));
    expect(reload).toHaveBeenCalledOnce();
    expect(getDevelopmentDate()).toBe('2026-10-29');
    expect(todayIso()).toBe('2026-10-29');
    expect(purchasePaymentToday('Pacific/Honolulu')).toBe('2026-10-29');
    expect(developmentDateForRequest('/households/home/calendar')).toBe('2026-10-29');
    expect(developmentDateForRequest('/auth/login')).toBeNull();
    expect(developmentDateForRequest('https://other.example/households/home')).toBeNull();
  });

  it('clears the simulated date and reloads when returning to real time', async () => {
    saveDevelopmentDate('2026-10-29');
    const reload = vi.fn();
    render(<DevelopmentDateControl reload={reload} />);
    expect(screen.getByText(/Fecha simulada: 29\/10\/2026/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Volver a fecha real' }));
    expect(getDevelopmentDate()).toBeNull();
    expect(reload).toHaveBeenCalledOnce();
  });

  it('cannot activate or send the override in production even if it is stored', () => {
    saveDevelopmentDate('2026-10-29');
    vi.stubEnv('MODE', 'production');
    const { container } = render(<DevelopmentDateControl />);
    expect(container).toBeEmptyDOMElement();
    expect(getDevelopmentDate()).toBeNull();
    expect(developmentDateForRequest('/households/home/dashboard')).toBeNull();
    expect(() => saveDevelopmentDate('2026-10-29')).toThrow(/solo está disponible en desarrollo/);
  });

  it('rejects impossible dates without changing the active date', () => {
    saveDevelopmentDate('2026-10-29');
    expect(() => saveDevelopmentDate('2026-02-30')).toThrow(/fecha válida/);
    expect(getDevelopmentDate()).toBe('2026-10-29');
  });
});
