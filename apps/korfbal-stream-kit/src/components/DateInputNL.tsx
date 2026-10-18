import React from 'react';

/**
 * Reads a day as the crew types it: "07-11-2026", "7-11-2026", "7/11/2026" or "7.11.2026" (DD-MM-JJJJ).
 * Returns ISO "YYYY-MM-DD", '' for an empty field, or null when it is not an existing day.
 */
export function parseDateNL(input: string): string | null {
  const text = input.trim();
  if (!text) return '';
  const m = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (!m) return null;
  const [day, month, year] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(Date.UTC(year, month - 1, day));
  if (month < 1 || month > 12 || d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** "2026-11-07" → "07-11-2026" ('' stays ''). */
export function formatDateNL(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : iso;
}

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & {
  /** ISO "YYYY-MM-DD" or '' */
  value: string;
  /** Called with ISO "YYYY-MM-DD" (or '' when cleared) once the field is left or Enter is pressed, and only when it changed. */
  onCommit: (value: string) => void;
};

/**
 * Date field that always shows DD-MM-JJJJ, like TimeInput24 for times: a native date input follows
 * the browser's language and may show the American order.
 */
export default function DateInputNL({value, onCommit, className = '', ...rest}: Props) {
  const [draft, setDraft] = React.useState(formatDateNL(value));
  const [invalid, setInvalid] = React.useState(false);

  React.useEffect(() => {
    setDraft(formatDateNL(value));
    setInvalid(false);
  }, [value]);

  function commit() {
    const parsed = parseDateNL(draft);
    if (parsed === null) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    setDraft(formatDateNL(parsed));
    if (parsed !== value) onCommit(parsed);
  }

  return (
    <input
      {...rest}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      placeholder="DD-MM-JJJJ"
      maxLength={10}
      value={draft}
      aria-invalid={invalid || undefined}
      title={invalid ? 'Gebruik DD-MM-JJJJ, bijvoorbeeld 07-11-2026' : rest.title}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          commit();
        } else if (e.key === 'Escape') {
          setDraft(formatDateNL(value));
          setInvalid(false);
        }
      }}
      className={`w-32 font-mono tabular-nums ${invalid ? 'border-red-500 dark:border-red-500' : ''} ${className}`}
    />
  );
}
