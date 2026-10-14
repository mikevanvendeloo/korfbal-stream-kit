import {fireEvent, render, screen} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import TimeInput24, {parseTime24} from './TimeInput24';

describe('parseTime24', () => {
  it('reads common ways of typing a time on the 24-hour clock', () => {
    expect(parseTime24('21:30')).toBe('21:30');
    expect(parseTime24('21.30')).toBe('21:30');
    expect(parseTime24('2130')).toBe('21:30');
    expect(parseTime24('930')).toBe('09:30');
    expect(parseTime24('9')).toBe('09:00');
    expect(parseTime24('0:5')).toBe('00:05');
    expect(parseTime24('  ')).toBe('');
  });

  it('rejects what is not a time', () => {
    expect(parseTime24('24:00')).toBeNull();
    expect(parseTime24('12:60')).toBeNull();
    expect(parseTime24('9 PM')).toBeNull();
    expect(parseTime24('abc')).toBeNull();
  });
});

describe('TimeInput24', () => {
  it('saves the time once the field is left, in 24-hour notation', () => {
    const onCommit = vi.fn();
    render(<TimeInput24 aria-label="Start" value="19:45" onCommit={onCommit}/>);
    const input = screen.getByLabelText('Start') as HTMLInputElement;
    expect(input.value).toBe('19:45');

    fireEvent.change(input, {target: {value: '2015'}});
    expect(onCommit).not.toHaveBeenCalled();
    fireEvent.blur(input);
    expect(onCommit).toHaveBeenCalledWith('20:15');
    expect(input.value).toBe('20:15');
  });

  it('keeps an invalid time out and marks the field', () => {
    const onCommit = vi.fn();
    render(<TimeInput24 aria-label="Start" value="19:45" onCommit={onCommit}/>);
    const input = screen.getByLabelText('Start');
    fireEvent.change(input, {target: {value: '25:00'}});
    fireEvent.keyDown(input, {key: 'Enter'});
    expect(onCommit).not.toHaveBeenCalled();
    expect(input.getAttribute('aria-invalid')).toBe('true');

    fireEvent.keyDown(input, {key: 'Escape'});
    expect((input as HTMLInputElement).value).toBe('19:45');
  });

  it('does not save when nothing changed', () => {
    const onCommit = vi.fn();
    render(<TimeInput24 aria-label="Start" value="19:45" onCommit={onCommit}/>);
    fireEvent.blur(screen.getByLabelText('Start'));
    expect(onCommit).not.toHaveBeenCalled();
  });
});
