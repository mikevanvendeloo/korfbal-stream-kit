import React from 'react';
import IconButton from './IconButton';

export type CopyMode = 'merge' | 'overwrite';

export default function CopyAssignmentsModal({
  chapters,
  sourceChapterId,
  onCancel,
  onConfirm,
}: {
  /** The production hoofdstukken, with their number in the draaiboek */
  chapters: Array<{ id: number; name: string; number: number }>;
  sourceChapterId: number;
  onCancel: () => void;
  onConfirm: (input: { targetChapterIds: number[]; mode: CopyMode }) => void;
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
        <div className="text-sm mb-3">Kopieer de afwijkingen van dit hoofdstuk naar de gekozen hoofdstukken.</div>
        <div className="mb-3">
          <div className="font-medium text-sm mb-1">Naar hoofdstukken</div>
          <div className="max-h-52 overflow-auto border rounded p-2">
            {chapters.filter((c) => c.id !== sourceChapterId).map((c) => (
              <label key={c.id} className="flex items-center gap-2 py-1">
                <input
                  type="checkbox"
                  checked={selected.includes(c.id)}
                  onChange={() => toggle(c.id)}
                />
                <span className="text-sm">{c.number}. {c.name}</span>
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
            onClick={() => onConfirm({ targetChapterIds: selected, mode })}
          >
            Kopieer
          </button>
        </div>
      </div>
    </div>
  );
}
