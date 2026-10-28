import React from 'react';
import {Plus, Search, X} from 'lucide-react';

export type PickerPosition = { id: number; name: string; category?: string; sortOrder?: number };

const CATEGORY_LABEL: Record<string, string> = {TECHNICAL: 'Techniek', ENTERTAINMENT: 'Entertainment', GENERAL: 'Algemeen'};
const CATEGORY_ORDER = ['TECHNICAL', 'ENTERTAINMENT', 'GENERAL'];

/**
 * The positions of a draaiboek item: the chosen ones as chips (× removes one), and "+ Positie" opens a
 * searchable list grouped by category. `fixedIds` (Showcaller) are always on and not shown.
 */
export default function PositionPicker({positions, selected, onChange, fixedIds = []}: {
  positions: PickerPosition[];
  selected: number[];
  onChange: (ids: number[]) => void;
  fixedIds?: number[];
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const ref = React.useRef<HTMLDivElement>(null);
  const byId = new Map(positions.map((p) => [p.id, p]));
  const chosen = selected.filter((id) => !fixedIds.includes(id)).map((id) => byId.get(id)).filter((p): p is PickerPosition => !!p);

  React.useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const toggle = (id: number) => onChange(selected.includes(id) ? selected.filter((p) => p !== id) : [...selected, id]);
  const q = query.trim().toLowerCase();
  const groups = CATEGORY_ORDER
    .map((category) => ({
      category,
      items: positions
        .filter((p) => (p.category ?? 'GENERAL') === category && !fixedIds.includes(p.id) && (!q || p.name.toLowerCase().includes(q)))
        .sort((a, b) => (a.sortOrder ?? 99) - (b.sortOrder ?? 99) || a.name.localeCompare(b.name)),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <div ref={ref} className="relative">
      <div className="flex flex-wrap items-center gap-1.5">
        {chosen.map((p) => (
          <span key={p.id} className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs text-blue-800 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300">
            {p.name}
            <button type="button" aria-label={`${p.name} weghalen`} onClick={() => toggle(p.id)} className="hover:text-red-600"><X className="w-3 h-3"/></button>
          </span>
        ))}
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
                className="inline-flex items-center gap-1 rounded-full border border-dashed border-gray-300 px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-50 dark:border-white/20 dark:text-white/60 dark:hover:bg-white/5">
          <Plus className="w-3 h-3"/> Positie
        </button>
      </div>
      {open && (
        <div role="dialog" aria-label="Posities kiezen"
             onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }}
             className="absolute z-20 mt-1 w-72 max-w-[calc(100vw-2rem)] rounded-md border border-gray-200 bg-white p-2 shadow-lg dark:border-white/10 dark:bg-gray-900">
          <label className="flex items-center gap-2 rounded border border-gray-200 px-2 py-1 dark:border-white/10">
            <Search className="w-3.5 h-3.5 text-gray-400"/>
            <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Zoek een positie" aria-label="Zoek een positie"
                   className="min-w-0 flex-1 bg-transparent text-sm outline-none text-gray-900 dark:text-white"/>
          </label>
          <div className="mt-2 max-h-64 overflow-y-auto">
            {groups.length === 0 && <p className="px-1 py-2 text-xs italic text-gray-400">Geen positie gevonden</p>}
            {groups.map((g) => (
              <div key={g.category} className="mb-2">
                <div className="px-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-white/40">{CATEGORY_LABEL[g.category] ?? g.category}</div>
                {g.items.map((p) => (
                  <label key={p.id} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-gray-50 dark:hover:bg-white/5">
                    <input type="checkbox" checked={selected.includes(p.id)} onChange={() => toggle(p.id)}/>
                    <span className="truncate text-gray-800 dark:text-white/80">{p.name}</span>
                  </label>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
