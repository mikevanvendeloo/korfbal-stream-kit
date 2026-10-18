import {fireEvent, render, screen} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import DateInputNL, {parseDateNL} from './DateInputNL';
import DateTimeInputNL from './DateTimeInputNL';

function type(field: HTMLElement, text: string) {
  fireEvent.change(field, {target: {value: text}});
  fireEvent.blur(field);
}

describe('DateInputNL', () => {
  it('reads DD-MM-JJJJ and rejects days that do not exist', () => {
    expect(parseDateNL('7-11-2026')).toBe('2026-11-07');
    expect(parseDateNL('31-02-2026')).toBeNull();
    expect(parseDateNL('2026-11-07')).toBeNull();
  });

  it('reports whether what was typed is a day', () => {
    const onValidityChange = vi.fn();
    render(<DateInputNL aria-label="Dag" value="2026-11-07" onCommit={vi.fn()} onValidityChange={onValidityChange}/>);
    type(screen.getByLabelText('Dag'), '31-02-2026');
    expect(onValidityChange).toHaveBeenLastCalledWith(false);
    fireEvent.keyDown(screen.getByLabelText('Dag'), {key: 'Escape'});
    expect(onValidityChange).toHaveBeenLastCalledWith(true);
  });
});

// Runs in TZ=UTC (vite.config.ts): the fields still show and mean Amsterdam time
describe('DateTimeInputNL', () => {
  const renderField = (value: string | null, onChange = vi.fn()) => {
    const view = render(<DateTimeInputNL id="t" value={value} onChange={onChange} dateLabel="Datum" timeLabel="Tijd"/>);
    return {onChange, ...view};
  };

  it('shows an instant as its Amsterdam day and time, with linked labels', () => {
    renderField('2026-06-13T17:30:00.000Z');
    expect(screen.getByLabelText('Datum')).toHaveValue('13-06-2026');
    expect(screen.getByLabelText('Datum')).toHaveAttribute('id', 't-date');
    expect(screen.getByLabelText('Tijd')).toHaveValue('19:30');
  });

  it('gives the instant once both are filled in, null while incomplete or invalid', () => {
    const {onChange} = renderField('');
    type(screen.getByLabelText('Datum'), '07-11-2026');
    expect(onChange).toHaveBeenLastCalledWith(null);
    type(screen.getByLabelText('Tijd'), '19:30');
    expect(onChange).toHaveBeenLastCalledWith('2026-11-07T18:30:00.000Z');
    type(screen.getByLabelText('Tijd'), '25:00');
    expect(onChange).toHaveBeenLastCalledWith(null);
    expect(screen.getByLabelText('Tijd')).toHaveValue('25:00');
    type(screen.getByLabelText('Tijd'), '19:30');
    expect(onChange).toHaveBeenLastCalledWith('2026-11-07T18:30:00.000Z');
  });

  it('gives an empty string when both are cleared, and follows a new value from outside', () => {
    const {onChange, rerender} = renderField('2026-11-07T18:30:00.000Z');
    type(screen.getByLabelText('Datum'), '');
    type(screen.getByLabelText('Tijd'), '');
    expect(onChange).toHaveBeenLastCalledWith('');
    rerender(<DateTimeInputNL id="t" value="2026-06-13T17:30:00.000Z" onChange={onChange} dateLabel="Datum" timeLabel="Tijd"/>);
    expect(screen.getByLabelText('Datum')).toHaveValue('13-06-2026');
    expect(screen.getByLabelText('Tijd')).toHaveValue('19:30');
  });
});
