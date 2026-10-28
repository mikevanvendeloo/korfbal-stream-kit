import React from 'react';

/**
 * Reads what was typed as a 24-hour time: "21:30", "21.30", "2130", "930" or "9" (→ 09:00).
 * Returns "HH:mm", '' for an empty field, or null when it is not a valid time.
 */
export function parseTime24(input: string): string | null {
  const text = input.trim();
  if (!text) return '';
  let hours: number;
  let minutes: number;
  const separated = text.match(/^(\d{1,2})[:.,](\d{1,2})$/);
  if (separated) {
    hours = Number(separated[1]);
    minutes = Number(separated[2]);
  } else if (/^\d{1,4}$/.test(text)) {
    // Up to two digits is the hour; three or four digits end in the minutes
    hours = Number(text.length <= 2 ? text : text.slice(0, -2));
    minutes = text.length <= 2 ? 0 : Number(text.slice(-2));
  } else {
    return null;
  }
  if (hours > 23 || minutes > 59) return null;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & {
  /** "HH:mm" or '' */
  value: string;
  /** Called with "HH:mm" (or '' when cleared) once the field is left or Enter is pressed, and only when it changed. */
  onCommit: (value: string) => void;
  /** Called on every commit and on Escape: false when what was typed isn't a valid time (the field turns red), true otherwise. */
  onValidityChange?: (valid: boolean) => void;
};

/**
 * Time field that always uses the 24-hour clock. A native time input follows the browser's
 * language and may show AM/PM, which the crew doesn't use.
 */
export default function TimeInput24({value, onCommit, onValidityChange, className = '', ...rest}: Props) {
  const [draft, setDraft] = React.useState(value);
  const [invalid, setInvalid] = React.useState(false);

  React.useEffect(() => {
    setDraft(value);
    setInvalid(false);
  }, [value]);

  function commit() {
    const parsed = parseTime24(draft);
    if (parsed === null) {
      setInvalid(true);
      onValidityChange?.(false);
      return;
    }
    setInvalid(false);
    onValidityChange?.(true);
    setDraft(parsed);
    if (parsed !== value) onCommit(parsed);
  }

  return (
    <input
      {...rest}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      placeholder={rest.placeholder || 'uu:mm'}
      maxLength={5}
      value={draft}
      aria-invalid={invalid || undefined}
      title={invalid ? 'Gebruik uu:mm, bijvoorbeeld 19:45' : rest.title}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          commit();
        } else if (e.key === 'Escape') {
          setDraft(value);
          setInvalid(false);
          onValidityChange?.(true);
        }
      }}
      className={`w-20 font-mono tabular-nums ${invalid ? 'border-red-500 dark:border-red-500' : ''} ${className}`}
    />
  );
}
