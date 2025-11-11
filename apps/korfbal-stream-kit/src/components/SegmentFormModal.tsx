import React from 'react';

export type SegmentFormValues = {
  naam: string;
  duurInMinuten: number;
  volgorde?: number;
  isTimeAnchor?: boolean;
};

export type SegmentFormModalProps = {
  title?: string;
  initial?: Partial<SegmentFormValues>;
  onCancel: () => void;
  onSubmit: (values: SegmentFormValues) => Promise<void> | void;
};

export default function SegmentFormModal({ title, initial, onCancel, onSubmit }: SegmentFormModalProps) {
  const [naam, setNaam] = React.useState(initial?.naam || '');
  const [duur, setDuur] = React.useState<number>(initial?.duurInMinuten ?? 0);
  const [volgorde, setVolgorde] = React.useState<number | ''>(initial?.volgorde ?? '');
  const [isTimeAnchor, setIsTimeAnchor] = React.useState<boolean>(!!initial?.isTimeAnchor);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const firstRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    firstRef.current?.focus();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const d = Number(duur);
    if (!naam.trim()) return setError('Naam is verplicht');
    if (!Number.isInteger(d) || d < 0) return setError('Duur (minuten) moet een niet-negatief geheel getal zijn');

    const payload: SegmentFormValues = { naam: naam.trim(), duurInMinuten: d };
    if (volgorde !== '') payload.volgorde = Number(volgorde);
    if (isTimeAnchor) payload.isTimeAnchor = true;

    try {
      setBusy(true);
      await onSubmit(payload);
    } catch (err: any) {
      setError(err?.message || 'Opslaan mislukt');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center">
      <div className="bg-white dark:bg-gray-900 p-4 rounded shadow w-[520px] max-w-[95vw] text-gray-800 dark:text-gray-100">
        <h2 className="font-semibold mb-2">{title || (initial?.naam ? 'Segment wijzigen' : 'Nieuw segment')}</h2>
        {error && (
          <div role="alert" className="mb-3 rounded-md border border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300 px-3 py-2">{error}</div>
        )}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label htmlFor="seg-naam" className="block text-xs mb-1">Naam</label>
            <input id="seg-naam" ref={firstRef} value={naam} onChange={(e) => setNaam(e.target.value)} className="w-full px-2 py-1 border rounded bg-white dark:bg-gray-950" />
          </div>
          <div>
            <label htmlFor="seg-duur" className="block text-xs mb-1">Duur (minuten)</label>
            <input id="seg-duur" type="number" min={0} step={1} value={duur} onChange={(e) => setDuur(parseInt(e.target.value, 10))} className="w-full px-2 py-1 border rounded bg-white dark:bg-gray-950" />
          </div>
          <div>
            <label htmlFor="seg-volgorde" className="block text-xs mb-1">Volgorde (optioneel)</label>
            <input id="seg-volgorde" type="number" min={1} step={1} value={volgorde} onChange={(e) => setVolgorde(e.target.value === '' ? '' : parseInt(e.target.value, 10))} className="w-full px-2 py-1 border rounded bg-white dark:bg-gray-950" />
            <div className="text-xs text-gray-500 mt-1">Leeg laten om automatisch onderaan toe te voegen.</div>
          </div>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={isTimeAnchor} onChange={(e) => setIsTimeAnchor(e.target.checked)} />
            <span>Dit segment is het tijdanker</span>
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onCancel} className="px-3 py-1 border rounded">Annuleren</button>
            <button disabled={busy} type="submit" className="px-3 py-1 border rounded bg-blue-600 text-white disabled:opacity-60">
              {busy ? 'Opslaan…' : 'Opslaan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
