import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ContributionBreakdown } from './ContributionBreakdown';

describe('ContributionBreakdown privacy', () => {
  it('identifies hidden personal data and the partial total, not a false zero', () => {
    render(<ContributionBreakdown currency="EUR" householdCents={40000} personalCents={0} personalAmountsHidden totalCents={40000} />);
    expect(screen.getByText('Gastos personales').nextElementSibling).toHaveTextContent('Privado / no disponible');
    expect(screen.getByText('Subtotal conjunto').nextElementSibling).toHaveTextContent('400,00');
    expect(screen.queryByText('Total a aportar')).not.toBeInTheDocument();
  });

  it('still displays a genuine visible zero', () => {
    render(<ContributionBreakdown currency="EUR" householdCents={40000} personalCents={0} totalCents={40000} />);
    expect(screen.getByText('Gastos personales').nextElementSibling).toHaveTextContent('0,00');
    expect(screen.getByText('Total a aportar')).toBeVisible();
  });
});
