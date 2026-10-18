import React from 'react';
import DateInputNL from './DateInputNL';
import TimeInput24 from './TimeInput24';
import {amsterdamDay, atAmsterdamTime, formatTime} from '../lib/time';

/** The message a form shows when the fields hold something that isn't a date and time (onChange gave null). */
export const INVALID_DATE_TIME_MESSAGE = 'Vul een geldige datum (DD-MM-JJJJ) en tijd (uu:mm) in.';

type Parts = { day: string; time: string; dayValid: boolean; timeValid: boolean };

function partsOf(value: string | null): Parts {
  return {day: amsterdamDay(value), time: formatTime(value), dayValid: true, timeValid: true};
}

function combine(p: Parts): string | null {
  if (!p.dayValid || !p.timeValid) return null;
  if (!p.day && !p.time) return '';
  if (!p.day || !p.time) return null;
  return atAmsterdamTime(p.day, p.time);
}

type Props = {
  /** The date field gets id `${id}-date`, the time field `${id}-time`. */
  id: string;
  /** An instant (UTC ISO), '' for none, or null while the fields hold something invalid. */
  value: string | null;
  /**
   * Called when the fields change: the Amsterdam date and time as UTC ISO ("…Z"), '' when both are
   * empty, or null when one is invalid or only one is filled in.
   */
  onChange: (value: string | null) => void;
  dateLabel: React.ReactNode;
  timeLabel: React.ReactNode;
  labelClassName?: string;
  inputClassName?: string;
  className?: string;
  required?: boolean;
  /** The id of the form's error message, linked to both fields. */
  describedBy?: string;
};

/**
 * A date (DD-MM-JJJJ) and a 24-hour time (uu:mm) side by side, for one instant in Europe/Amsterdam
 * time, whatever the device's zone or language. Replaces a native datetime-local input, which may
 * show AM/PM or the American date order.
 */
export default function DateTimeInputNL({
  id,
  value,
  onChange,
  dateLabel,
  timeLabel,
  labelClassName = '',
  inputClassName = '',
  className = '',
  required,
  describedBy,
}: Props) {
  const [parts, setParts] = React.useState<Parts>(() => partsOf(value));
  const partsRef = React.useRef(parts);
  const lastEmitted = React.useRef<string | null>(value);

  // A new value from outside (another record, a reset form): show it. Our own null stays as typed.
  React.useEffect(() => {
    if (value === lastEmitted.current) return;
    lastEmitted.current = value;
    if (value === null) return;
    partsRef.current = partsOf(value);
    setParts(partsRef.current);
  }, [value]);

  function update(patch: Partial<Parts>) {
    const next = {...partsRef.current, ...patch};
    partsRef.current = next;
    setParts(next);
    const combined = combine(next);
    if (combined !== lastEmitted.current) {
      lastEmitted.current = combined;
      onChange(combined);
    }
  }

  const fieldProps = {
    'aria-describedby': describedBy,
    'aria-required': required || undefined,
  };

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      <div className="flex flex-col gap-1 min-w-0">
        <label htmlFor={`${id}-date`} className={labelClassName}>{dateLabel}</label>
        <DateInputNL
          id={`${id}-date`}
          value={parts.day}
          onCommit={(day) => update({day})}
          onValidityChange={(dayValid) => update({dayValid})}
          className={inputClassName}
          {...fieldProps}
        />
      </div>
      <div className="flex flex-col gap-1 min-w-0">
        <label htmlFor={`${id}-time`} className={labelClassName}>{timeLabel}</label>
        <TimeInput24
          id={`${id}-time`}
          value={parts.time}
          onCommit={(time) => update({time})}
          onValidityChange={(timeValid) => update({timeValid})}
          className={inputClassName}
          {...fieldProps}
        />
      </div>
    </div>
  );
}
