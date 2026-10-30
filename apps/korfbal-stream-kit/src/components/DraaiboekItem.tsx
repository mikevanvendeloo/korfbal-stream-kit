import React from 'react';
import {Anchor, CornerDownRight, FastForward, FilePenLine, GripVertical, Trash2} from 'lucide-react';
import type {DragHandle} from './ChapterBoard';
import PositionPicker, {PickerPosition} from './PositionPicker';
import {formatTime} from '../lib/time';
import {formatRelative} from '../lib/chapterStructure';

/** One item of a draaiboek (template or production), as the editor shows and changes it. */
export type DraaiboekItemData = {
  id: string;
  cue: string;
  title: string;
  note: string | null;
  durationSec: number;
  isInVenue: boolean;
  isInLivestream: boolean;
  isTimeAnchor: boolean;
  anchorType: string | null;
  autoAdvance: boolean;
  parentId: string | null;
  positionIds: number[];
  /** A production's calculated start (templates have none) */
  timeStart?: string | null;
  /** A template's planned start in seconds from the kickoff (from the API; null without an anchor) */
  startOffsetSec?: number | null;
};

export type DraaiboekItemChange = Omit<DraaiboekItemData, 'id' | 'timeStart' | 'startOffsetSec'>;

const MAX_CHIPS = 3;
const duration = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
const label = 'text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-white/40';
const field = 'w-full rounded border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-900 outline-none focus:border-blue-500 dark:border-white/10 dark:bg-black/40 dark:text-white';

/**
 * A quiet line per item: time, cue, title, labels, its positions as chips and the duration. A click
 * opens it as a form; the order changes by dragging the handle (ChapterBoard).
 */
export default function DraaiboekItem({item, handle, positions, fixedPositionIds = [], parentOptions, open, onOpen, onClose, onSave, onDelete, lane}: {
  item: DraaiboekItemData;
  handle: DragHandle;
  positions: PickerPosition[];
  /** Always on (Showcaller): not shown as a chip */
  fixedPositionIds?: number[];
  /** The other items this one can be linked to */
  parentOptions: Array<{ id: string; label: string }>;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onSave: (change: DraaiboekItemChange) => Promise<void>;
  onDelete: () => void;
  /** In a block where Zaal and Stream run in parallel: the lane of this item (green / blue edge, as in the Show Caller) */
  lane?: 'ZAAL' | 'STREAM';
}) {
  const byId = new Map(positions.map((p) => [p.id, p]));
  const chips = item.positionIds.filter((id) => !fixedPositionIds.includes(id)).map((id) => byId.get(id)?.name).filter((n): n is string => !!n);

  if (open) {
    return <DraaiboekItemForm item={item} positions={positions} fixedPositionIds={fixedPositionIds} parentOptions={parentOptions} onClose={onClose} onSave={onSave}/>;
  }

  return (
    <div data-lane={lane} title={lane ? `Baan: ${lane === 'ZAAL' ? 'Zaal' : 'Stream'} (loopt parallel)` : undefined}
         className={`group flex items-center gap-2 rounded-md border border-gray-200 bg-white px-2 py-1.5 text-sm dark:border-white/10 dark:bg-white/5 min-w-0 ${item.parentId ? 'ml-6' : ''} ${lane === 'ZAAL' ? 'border-l-4 border-l-emerald-500' : lane === 'STREAM' ? 'border-l-4 border-l-blue-500' : ''}`}>
      {lane && <span className="sr-only">{lane === 'ZAAL' ? 'Baan Zaal' : 'Baan Stream'}</span>}
      <span {...handle} title="Slepen om te verplaatsen" aria-label={`${item.title} slepen`}
            className="cursor-grab text-gray-300 hover:text-gray-600 dark:text-white/20 dark:hover:text-white/60"><GripVertical className="w-4 h-4"/></span>
      <button type="button" onClick={onOpen} aria-label={`${item.title} openen`} className="flex min-w-0 flex-1 items-center gap-2 text-left">
        {item.parentId && <CornerDownRight className="w-3.5 h-3.5 shrink-0 text-gray-400" aria-label="gekoppeld"/>}
        {item.timeStart !== undefined && <span className="w-11 shrink-0 font-mono text-xs text-gray-500 dark:text-white/50">{formatTime(item.timeStart, {fallback: '--:--'})}</span>}
        {item.startOffsetSec !== undefined && <span title="t.o.v. de aftrap" className="w-12 shrink-0 font-mono text-xs text-gray-500 dark:text-white/50">{item.startOffsetSec == null ? '--:--' : formatRelative(item.startOffsetSec)}</span>}
        {item.cue && <span title="Cue" className="shrink-0 rounded border border-gray-300 bg-gray-50 px-1 font-mono text-[10px] uppercase text-gray-600 dark:border-white/10 dark:bg-black/40 dark:text-white/60">{item.cue}</span>}
        <span className="truncate font-medium text-gray-900 dark:text-white">{item.title}</span>
        {item.isTimeAnchor && <Anchor className="w-3.5 h-3.5 shrink-0 text-amber-600" aria-label={item.anchorType === 'LIVESTREAM_START' ? 'Anker: livestream start' : 'Anker: wedstrijd start'}/>}
        {item.autoAdvance && <FastForward className="w-3.5 h-3.5 shrink-0 text-purple-600" aria-label="Auto"/>}
        {item.isInVenue && <span className="shrink-0 rounded bg-emerald-100 px-1 text-[10px] font-semibold uppercase text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400">Zaal</span>}
        {!item.isInLivestream && <span className="shrink-0 rounded bg-gray-100 px-1 text-[10px] font-semibold uppercase text-gray-500 dark:bg-white/10 dark:text-white/50">Geen stream</span>}
        <span className="ml-auto hidden min-w-0 items-center gap-1 truncate sm:flex">
          {chips.slice(0, MAX_CHIPS).map((name) => (
            <span key={name} className="truncate rounded-full bg-gray-100 px-1.5 text-[11px] text-gray-600 dark:bg-white/10 dark:text-white/60">{name}</span>
          ))}
          {chips.length > MAX_CHIPS && <span title={chips.slice(MAX_CHIPS).join(', ')} className="shrink-0 text-[11px] text-gray-500">+{chips.length - MAX_CHIPS}</span>}
        </span>
        <span className="w-10 shrink-0 text-right font-mono text-xs text-gray-500 dark:text-white/50">{duration(item.durationSec)}</span>
      </button>
      <span className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
        <button type="button" onClick={onOpen} aria-label={`${item.title} wijzigen`} className="rounded p-1 text-gray-400 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-white/10"><FilePenLine className="w-4 h-4"/></button>
        <button type="button" onClick={onDelete} aria-label={`${item.title} verwijderen`} className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"><Trash2 className="w-4 h-4"/></button>
      </span>
    </div>
  );
}

function DraaiboekItemForm({item, positions, fixedPositionIds, parentOptions, onClose, onSave}: {
  item: DraaiboekItemData;
  positions: PickerPosition[];
  fixedPositionIds: number[];
  parentOptions: Array<{ id: string; label: string }>;
  onClose: () => void;
  onSave: (change: DraaiboekItemChange) => Promise<void>;
}) {
  const [data, setData] = React.useState<DraaiboekItemChange>(() => ({
    cue: item.cue, title: item.title, note: item.note, durationSec: item.durationSec, isInVenue: item.isInVenue,
    isInLivestream: item.isInLivestream, isTimeAnchor: item.isTimeAnchor, anchorType: item.anchorType,
    autoAdvance: item.autoAdvance, parentId: item.parentId, positionIds: item.positionIds,
  }));
  const [saving, setSaving] = React.useState(false);
  const set = <K extends keyof DraaiboekItemChange>(key: K, value: DraaiboekItemChange[K]) => setData((d) => ({...d, [key]: value}));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({...data, positionIds: [...new Set([...fixedPositionIds, ...data.positionIds])]});
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }} aria-label={`${item.title} wijzigen`}
          className="space-y-3 rounded-md border border-blue-300 bg-blue-50/60 p-3 dark:border-blue-500/40 dark:bg-blue-900/10">
      <div className="grid gap-3 sm:grid-cols-[8rem_1fr_7rem]">
        <label className="space-y-1"><span className={label}>Cue</span>
          <input value={data.cue} maxLength={50} onChange={(e) => set('cue', e.target.value.toUpperCase())} placeholder="Bv. INTRO" className={`${field} font-mono uppercase`}/>
        </label>
        <label className="space-y-1"><span className={label}>Titel</span>
          <input autoFocus required value={data.title} onChange={(e) => set('title', e.target.value)} className={field}/>
        </label>
        <label className="space-y-1"><span className={label}>Duur (sec)</span>
          <input type="number" min={0} value={data.durationSec} onChange={(e) => set('durationSec', Number(e.target.value) || 0)} className={field}/>
        </label>
      </div>
      <label className="block space-y-1"><span className={label}>Notitie</span>
        <input value={data.note ?? ''} onChange={(e) => set('note', e.target.value || null)} className={field}/>
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <span className={label}>Weergave</span>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-700 dark:text-white/80">
            <label className="flex items-center gap-1.5"><input type="checkbox" checked={data.isInVenue} onChange={(e) => set('isInVenue', e.target.checked)}/>Zaal</label>
            <label className="flex items-center gap-1.5"><input type="checkbox" checked={data.isInLivestream} onChange={(e) => set('isInLivestream', e.target.checked)}/>Stream</label>
            <label className="flex items-center gap-1.5"><input type="checkbox" checked={data.autoAdvance} onChange={(e) => set('autoAdvance', e.target.checked)}/>Auto</label>
          </div>
        </div>
        <div className="space-y-1">
          <span className={label}>Tijdanker</span>
          <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-white/80">
            <label className="flex items-center gap-1.5"><input type="checkbox" checked={data.isTimeAnchor} onChange={(e) => set('isTimeAnchor', e.target.checked)}/>Anker</label>
            {data.isTimeAnchor && (
              <select value={data.anchorType ?? ''} onChange={(e) => set('anchorType', e.target.value || null)} aria-label="Soort anker" className={`${field} w-auto py-1`}>
                <option value="">Kies…</option>
                <option value="MATCH_START">Wedstrijd start</option>
                <option value="LIVESTREAM_START">Livestream start</option>
              </select>
            )}
          </div>
        </div>
      </div>
      <label className="block space-y-1"><span className={label}>Koppel aan item</span>
        <select value={data.parentId ?? ''} onChange={(e) => set('parentId', e.target.value || null)} className={field}>
          <option value="">Geen (hoofdlijn)</option>
          {parentOptions.filter((o) => o.id !== item.id).map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      </label>
      <div className="space-y-1">
        <span className={label}>Posities</span>
        <PositionPicker positions={positions} selected={data.positionIds} fixedIds={fixedPositionIds} onChange={(ids) => set('positionIds', ids)}/>
      </div>
      <div className="flex justify-end gap-2 border-t border-blue-200 pt-2 dark:border-white/10">
        <button type="button" onClick={onClose} className="rounded px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 dark:text-white/60 dark:hover:bg-white/10">Annuleren</button>
        <button type="submit" disabled={saving} className="rounded bg-green-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50">Opslaan</button>
      </div>
    </form>
  );
}
