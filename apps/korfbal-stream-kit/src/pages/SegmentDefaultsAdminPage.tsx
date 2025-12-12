import React from 'react';
import { usePositionsCatalog, useSaveSegmentDefaultPositions, useSegmentDefaultPositions, useSegmentDefaultNames } from '../hooks/usePositions';
import IconButton from '../components/IconButton';
import { MdAdd, MdArrowDownward, MdArrowUpward, MdDelete, MdSave } from 'react-icons/md';

type Item = { positionId: number; name: string; order: number };

export default function SegmentDefaultsAdminPage() {
  const [segmentName, setSegmentName] = React.useState('Voorbeschouwing');
  const { data: catalog } = usePositionsCatalog();
  const names = useSegmentDefaultNames();
  const defaults = useSegmentDefaultPositions(segmentName);
  const save = useSaveSegmentDefaultPositions();
  const [items, setItems] = React.useState<Item[]>([]);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (defaults.data) {
      setItems(defaults.data.map((d, i) => ({ positionId: d.positionId, name: d.position.name, order: d.order ?? i })));
    } else {
      setItems([]);
    }
  }, [defaults.data]);

  function addPosition(positionId: number) {
    const pos = (catalog || []).find((p) => p.id === positionId);
    if (!pos) return;
    if (items.some((it) => it.positionId === positionId)) return;
    setItems((prev) => [...prev, { positionId, name: pos.name, order: prev.length }]);
  }

  function remove(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx).map((it, i) => ({ ...it, order: i })));
  }

  function move(idx: number, dir: -1 | 1) {
    const target = idx + dir;
    if (target < 0 || target >= items.length) return;
    const cp = items.slice();
    const [a, b] = [cp[idx], cp[target]];
    cp[idx] = { ...b, order: idx };
    cp[target] = { ...a, order: target };
    setItems(cp);
  }

  async function handleSave() {
    setErr(null);
    try {
      await save.mutateAsync({ segmentName, positions: items.map((it, i) => ({ positionId: it.positionId, order: i })) });
    } catch (e: any) {
      setErr(e?.message || 'Opslaan mislukt');
    }
  }

  return (
    <div className="container py-6 text-gray-800 dark:text-gray-100">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold">Segment posities (per segment)</h1>
        <button className="px-3 py-1 border rounded inline-flex items-center gap-1" onClick={handleSave} aria-label="save-defaults">
          <MdSave /> Opslaan
        </button>
      </div>

      {err && <div role="alert" className="mb-3 rounded-md border border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300 px-3 py-2">{err}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
            <label className="text-sm block">
              <div className="mb-1">Kies segment</div>
              <select
                aria-label="segment-select"
                className="border rounded px-2 py-1 w-full"
                value={segmentName}
                onChange={(e) => setSegmentName(e.target.value)}
              >
                {/* Always offer Algemeen as special option */}
                <option value="Algemeen">Algemeen</option>
                {(names.data?.items || []).filter((n) => n !== '__GLOBAL__').map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </label>
            <label className="text-sm block">
              <div className="mb-1">Of nieuw segment</div>
              <input aria-label="segment-name" placeholder="Nieuwe segmentnaam" className="border rounded px-2 py-1 w-full" value={segmentName} onChange={(e) => setSegmentName(e.target.value)} />
            </label>
          </div>

          <h2 className="font-semibold mb-2">Geselecteerde posities</h2>
          <ul className="divide-y divide-gray-200 dark:divide-gray-800">
            {items.map((it, i, arr) => (
              <li key={it.positionId} className="py-2 flex items-center justify-between">
                <div className="min-w-0">
                  <div className="font-medium truncate">{it.name}</div>
                  <div className="text-xs text-gray-500">volgorde: {i + 1}</div>
                </div>
                <div className="flex items-center gap-2">
                  <IconButton ariaLabel="Move up" title="Omhoog" onClick={() => move(i, -1)}>
                    <MdArrowUpward className={`w-5 h-5 ${i === 0 ? 'opacity-40' : ''}`} />
                  </IconButton>
                  <IconButton ariaLabel="Move down" title="Omlaag" onClick={() => move(i, +1)}>
                    <MdArrowDownward className={`w-5 h-5 ${i === arr.length - 1 ? 'opacity-40' : ''}`} />
                  </IconButton>
                  <IconButton ariaLabel="Remove" title="Verwijder" onClick={() => remove(i)}>
                    <MdDelete className="w-5 h-5 text-red-600" />
                  </IconButton>
                </div>
              </li>
            ))}
            {items.length === 0 && (
              <li className="py-2 text-sm text-gray-500">Nog geen posities</li>
            )}
          </ul>
        </div>

        <div>
          <h2 className="font-semibold mb-2">Catalogus</h2>
          <ul className="divide-y divide-gray-200 dark:divide-gray-800">
            {(catalog || []).map((p) => (
              <li key={p.id} className="py-2 flex items-center justify-between">
                <div className="min-w-0">
                  <div className="font-medium truncate">{p.name}</div>
                  <div className="text-xs text-gray-500">{p.capability ? `${p.capability.code} — ${p.capability.functionName}` : '—'}</div>
                </div>
                <button className="px-2 py-1 border rounded text-sm inline-flex items-center gap-1" onClick={() => addPosition(p.id)} aria-label={`add-${p.id}`}>
                  <MdAdd /> Voeg toe
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
