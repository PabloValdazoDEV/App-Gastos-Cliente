import { createRef } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { FormField } from './FormField';

describe('FormField: fecha y mes dentro de su columna', () => {
  it.each([
    ['date', '2026-09-17', '2026-09-01', '2026-09-30'],
    ['month', '2026-09', '2026-01', '2026-12'],
  ])('%s permite contraer input y contenedor, conservando valor, ayuda y límites', (type, value, min, max) => {
    const ref = createRef();
    render(<div className="grid grid-cols-3"><FormField defaultValue={value} help="Selecciona una fecha dentro del periodo." label="Fecha" max={max} min={min} name="date" ref={ref} required type={type} /></div>);
    const input = screen.getByLabelText('Fecha');
    expect(input).toHaveClass('w-full', 'min-w-0', 'max-w-full', 'box-border', 'min-h-12');
    expect(input.parentElement).toHaveClass('min-w-0', 'max-w-full');
    expect(input).toHaveAttribute('type', type);
    expect(input).toHaveAttribute('min', min);
    expect(input).toHaveAttribute('max', max);
    expect(input).toBeRequired();
    expect(input).toHaveValue(value);
    expect(input).toHaveAccessibleDescription('Selecciona una fecha dentro del periodo.');
    expect(ref.current).toBe(input);
  });

  it('conserva la interacción nativa y los errores accesibles', () => {
    const onChange = vi.fn();
    render(<FormField error="Revisa la fecha." label="Fecha" name="date" onChange={onChange} type="date" />);
    const input = screen.getByLabelText('Fecha');
    fireEvent.change(input, { target: { value: '2026-10-15' } });
    expect(onChange).toHaveBeenCalledOnce();
    expect(input).toHaveValue('2026-10-15');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Revisa la fecha.');
    expect(screen.getByRole('alert')).toHaveTextContent('Revisa la fecha.');
  });

  it.each(['date', 'month'])('%s vacío conserva altura táctil y puede rellenarse y vaciarse', (type) => {
    render(<FormField label="Fecha opcional" name="optionalDate" type={type} />);
    const input = screen.getByLabelText('Fecha opcional');
    const value = type === 'date' ? '2026-09-17' : '2026-09';

    expect(input).toHaveValue('');
    expect(input).not.toBeRequired();
    expect(input).toHaveClass('min-h-12');
    fireEvent.change(input, { target: { value } });
    expect(input).toHaveValue(value);
    fireEvent.change(input, { target: { value: '' } });
    expect(input).toHaveValue('');
    expect(input).toHaveAttribute('type', type);
  });
});
