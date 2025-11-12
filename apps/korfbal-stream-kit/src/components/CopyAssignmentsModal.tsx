import React from 'react';
import IconButton from './IconButton';

export type CopyMode = 'merge' | 'overwrite';

export default function CopyAssignmentsModal({
  segments,
  sourceSegmentId,
  onCancel,
  onConfirm,
}: {
  segments: Array<{ id: number; naam: string; volgorde: number }>;
  sourceSegmentId: number;
  onCancel: () => void;
  onConfirm: (input: { targetSegmentIds: number[]; mode: CopyMode }) => void;
}) {
  const [selected, setSelected] = React.useState<number[]>([]);
  const [mode, setMode] = React.useState<CopyMode>('merge');

  function toggle(id: number) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  return (
    <div role="dialog" aria-modal className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-900 rounded shadow-lg w-full max-w-lg p-4 text-gray-900 dark:text-gray-100">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold">Kopieer toewijzingen</h3>
          <IconButton ariaLabel="Sluiten" title="Sluiten" onClick={onCancel}>
            <span className="w-5 h-5">×</span>
          </IconButton>
        </div>
        <div className="text-sm mb-3">Kopieer alle toewijzingen van het bronsegment naar geselecteerde segmenten.</div>
        <div className="mb-3">
          <div className="font-medium text-sm mb-1">Doelsegmenten</div>
          <div className="max-h-52 overflow-auto border rounded p-2">
            {segments.filter((s) => s.id !== sourceSegmentId).map((s) => (
              <label key={s.id} className="flex items-center gap-2 py-1">
                <input
                  type="checkbox"
                  checked={selected.includes(s.id)}
                  onChange={() => toggle(s.id)}
                />
                <span className="text-sm">{s.volgorde}. {s.naam}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="mb-4">
          <div className="font-medium text-sm mb-1">Mode</div>
          <label className="mr-4 text-sm inline-flex items-center gap-1">
            <input type="radio" name="mode" value="merge" checked={mode === 'merge'} onChange={() => setMode('merge')} /> Merge (voeg toe, behoud bestaande)
          </label>
          <label className="text-sm inline-flex items-center gap-1">
            <input type="radio" name="mode" value="overwrite" checked={mode === 'overwrite'} onChange={() => setMode('overwrite')} /> Overwrite (vervang bestaande)
          </label>
        </div>
        <div className="flex justify-end gap-2">
          <button className="px-3 py-1 border rounded" onClick={onCancel}>Annuleer</button>
          <button
            className="px-3 py-1 border rounded bg-blue-600 text-white disabled:opacity-60 disabled:cursor-not-allowed"
            disabled={selected.length === 0}
            onClick={() => onConfirm({ targetSegmentIds: selected, mode })}
          >
            Kopieer
          </button>
        </div>
      </div>
    </div>
  );
}
