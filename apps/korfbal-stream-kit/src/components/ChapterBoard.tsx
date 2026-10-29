import React from 'react';
import {
  closestCorners,
  DndContext,
  DragEndEvent,
  DragOverEvent,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy} from '@dnd-kit/sortable';
import {CSS} from '@dnd-kit/utilities';
import {ChevronDown, ChevronRight, FilePenLine, GripVertical, Plus, Save, Trash2, X} from 'lucide-react';
import {ChapterId, chapterOfItem, keepLinkedTogether, linkedMoveNotice, moveChapter, moveItem, removeChapter, Structure} from '../lib/chapterStructure';

/**
 * The hoofdstukken of a draaiboek as blocks (openspec/changes/chapters D4): drag items within and
 * between hoofdstukken, and a whole hoofdstuk by its handle. The page renders the items (template items
 * and callsheet items differ); the board keeps the structure and sends it whole after every change.
 */

export type DragHandle = React.HTMLAttributes<HTMLElement>;

export type BoardChapter<C extends ChapterId> = {
  id: C;
  name: string;
  /** Under the name: e.g. the calculated times and duration */
  subtitle?: React.ReactNode;
  /** Below the header: e.g. the standard positions of a template hoofdstuk */
  extra?: React.ReactNode;
};

type Props<C extends ChapterId, T extends { id: string; parentId?: string | null }> = {
  chapters: BoardChapter<C>[];
  items: T[];
  structure: Structure<C>;
  onStructureChange: (structure: Structure<C>) => Promise<void> | void;
  renderItem: (item: T, handle: DragHandle) => React.ReactNode;
  /** The name of an item in messages (e.g. its title) */
  itemLabel?: (item: T) => string;
  onAddItem?: (chapterId: C) => void;
  onAddChapter: (name: string) => Promise<void> | void;
  onRenameChapter: (chapterId: C, name: string) => Promise<void> | void;
  /** Deletes a hoofdstuk; a non-empty one only after its items moved (moveItemsTo) */
  onDeleteChapter: (chapterId: C, structureWithout: Structure<C>) => Promise<void> | void;
};

const ITEM = 'item:';
const CHAPTER = 'chapter:';
const DROP = 'drop:';

export default function ChapterBoard<C extends ChapterId, T extends { id: string; parentId?: string | null }>(props: Props<C, T>) {
  const {chapters, items, structure, onStructureChange, renderItem, itemLabel = (item) => item.id, onAddItem, onAddChapter, onRenameChapter, onDeleteChapter} = props;
  // Why a drop didn't do what it seemed to (a linked item stays with its parent)
  const [notice, setNotice] = React.useState<string | null>(null);
  // The structure while dragging (an item may move between hoofdstukken before it is dropped)
  const [draft, setDraft] = React.useState<Structure<C> | null>(null);
  const shown = draft ?? structure;
  const [collapsed, setCollapsed] = React.useState<Set<string>>(new Set());
  const [newChapter, setNewChapter] = React.useState('');
  const sensors = useSensors(useSensor(PointerSensor, {activationConstraint: {distance: 4}}), useSensor(KeyboardSensor, {coordinateGetter: sortableKeyboardCoordinates}));

  const chapterKey = (id: C) => String(id);
  const chapterById = (key: string) => shown.find((c) => chapterKey(c.id) === key)?.id;
  const itemById = new Map(items.map((it) => [it.id, it]));

  /** The hoofdstuk an item or hoofdstuk drop target stands for */
  function targetChapter(overId: string): C | undefined {
    if (overId.startsWith(ITEM)) return chapterOfItem(shown, overId.slice(ITEM.length));
    if (overId.startsWith(DROP)) return chapterById(overId.slice(DROP.length));
    if (overId.startsWith(CHAPTER)) return chapterById(overId.slice(CHAPTER.length));
    return undefined;
  }

  function handleDragOver({active, over}: DragOverEvent) {
    const activeId = String(active.id);
    if (!over || !activeId.startsWith(ITEM)) return;
    const itemId = activeId.slice(ITEM.length);
    const from = chapterOfItem(shown, itemId);
    // A linked item stays in the hoofdstuk of its parent: it doesn't move to another one while dragging
    if (itemById.get(itemId)?.parentId) return;
    const to = targetChapter(String(over.id));
    if (to === undefined || from === undefined || to === from) return;
    // Into another hoofdstuk: at the place of the item it is over, or at the end
    const list = shown.find((c) => c.id === to)?.itemIds ?? [];
    const overId = String(over.id);
    const index = overId.startsWith(ITEM) ? list.indexOf(overId.slice(ITEM.length)) : list.length;
    setDraft(moveItem(shown, itemId, to, index < 0 ? list.length : index));
  }

  async function handleDragEnd({active, over}: DragEndEvent) {
    const activeId = String(active.id);
    setNotice(null);
    if (activeId.startsWith(ITEM) && over) {
      setNotice(linkedMoveNotice(shown, items, activeId.slice(ITEM.length), targetChapter(String(over.id)), itemLabel));
    }
    let next = shown;
    if (over) {
      const overId = String(over.id);
      if (activeId.startsWith(CHAPTER)) {
        const chapterId = chapterById(activeId.slice(CHAPTER.length));
        const to = targetChapter(overId);
        if (chapterId !== undefined && to !== undefined) next = moveChapter(shown, chapterId, shown.findIndex((c) => c.id === to));
      } else if (activeId.startsWith(ITEM) && overId.startsWith(ITEM)) {
        const itemId = activeId.slice(ITEM.length);
        const chapterId = chapterOfItem(shown, itemId);
        const list = shown.find((c) => c.id === chapterId)?.itemIds ?? [];
        if (chapterId !== undefined && chapterOfItem(shown, overId.slice(ITEM.length)) === chapterId) {
          next = moveItem(shown, itemId, chapterId, list.indexOf(overId.slice(ITEM.length)));
        }
      }
    }
    next = keepLinkedTogether(next, items);
    setDraft(null);
    if (JSON.stringify(next) !== JSON.stringify(structure)) await onStructureChange(next);
  }

  async function addChapter(e: React.FormEvent) {
    e.preventDefault();
    const name = newChapter.trim();
    if (!name) return;
    await onAddChapter(name);
    setNewChapter('');
  }

  return (
    <div className="space-y-4">
      {notice && (
        <div role="status" className="flex items-start gap-2 rounded-md border border-blue-300 bg-blue-50 px-3 py-2 text-sm text-blue-900 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-200">
          <span className="flex-1 min-w-0">{notice}</span>
          <button type="button" aria-label="Melding sluiten" onClick={() => setNotice(null)} className="shrink-0"><X className="w-4 h-4"/></button>
        </div>
      )}
      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragOver={handleDragOver} onDragEnd={handleDragEnd} onDragCancel={() => setDraft(null)}>
        <SortableContext items={shown.map((c) => CHAPTER + chapterKey(c.id))} strategy={verticalListSortingStrategy}>
          {shown.map((entry) => {
            const chapter = chapters.find((c) => c.id === entry.id);
            if (!chapter) return null;
            const key = chapterKey(entry.id);
            return (
              <ChapterBlock
                key={key}
                chapterKey={key}
                chapter={chapter}
                itemIds={entry.itemIds}
                others={chapters.filter((c) => c.id !== entry.id)}
                collapsed={collapsed.has(key)}
                onToggle={() => setCollapsed((s) => { const n = new Set(s); if (n.has(key)) n.delete(key); else n.add(key); return n; })}
                onAddItem={onAddItem ? () => onAddItem(entry.id) : undefined}
                onRename={(name) => onRenameChapter(entry.id, name)}
                onDelete={(moveTo) => onDeleteChapter(entry.id, removeChapter(structure, entry.id, moveTo))}
              >
                {entry.itemIds.map((itemId) => {
                  const item = itemById.get(itemId);
                  return item ? <SortableItem key={itemId} id={ITEM + itemId}>{(handle) => renderItem(item, handle)}</SortableItem> : null;
                })}
              </ChapterBlock>
            );
          })}
        </SortableContext>
      </DndContext>

      <form onSubmit={addChapter} className="flex flex-wrap items-center gap-2">
        <input value={newChapter} onChange={(e) => setNewChapter(e.target.value)} placeholder="Naam van het nieuwe hoofdstuk" aria-label="Naam van het nieuwe hoofdstuk"
               className="flex-1 min-w-0 rounded-md border border-gray-300 dark:border-white/10 bg-white dark:bg-black/40 px-3 py-2 text-sm text-gray-900 dark:text-white"/>
        <button type="submit" disabled={!newChapter.trim()}
                className="inline-flex items-center gap-1 rounded-md border border-dashed border-gray-300 dark:border-white/20 px-3 py-2 text-sm text-gray-700 dark:text-white/70 hover:bg-gray-50 dark:hover:bg-white/5 disabled:opacity-50">
          <Plus className="w-4 h-4"/> Hoofdstuk toevoegen
        </button>
      </form>
    </div>
  );
}

function ChapterBlock<C extends ChapterId>({chapterKey, chapter, itemIds, others, collapsed, onToggle, onAddItem, onRename, onDelete, children}: {
  chapterKey: string;
  chapter: BoardChapter<C>;
  itemIds: string[];
  others: BoardChapter<C>[];
  collapsed: boolean;
  onToggle: () => void;
  onAddItem?: () => void;
  onRename: (name: string) => Promise<void> | void;
  onDelete: (moveItemsTo: C | null) => Promise<void> | void;
  children: React.ReactNode;
}) {
  const sortable = useSortable({id: CHAPTER + chapterKey});
  const droppable = useDroppable({id: DROP + chapterKey});
  const [renaming, setRenaming] = React.useState<string | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [moveTo, setMoveTo] = React.useState<string>(others[0] ? String(others[0].id) : '');
  const style = {transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition, opacity: sortable.isDragging ? 0.6 : 1};

  async function remove() {
    if (itemIds.length === 0) {
      if (window.confirm(`Hoofdstuk "${chapter.name}" verwijderen?`)) await onDelete(null);
      return;
    }
    setDeleting(true);
  }

  return (
    <section ref={sortable.setNodeRef} style={style} aria-label={`Hoofdstuk ${chapter.name}`}
             className="rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.03]">
      <header className="flex items-center gap-2 px-3 py-2 border-b border-gray-200 dark:border-white/10 min-w-0">
        <span {...sortable.attributes} {...sortable.listeners} title="Hoofdstuk slepen" aria-label={`Hoofdstuk ${chapter.name} slepen`}
              className="cursor-grab text-gray-400 hover:text-gray-700 dark:text-white/30 dark:hover:text-white/70">
          <GripVertical className="w-5 h-5"/>
        </span>
        <button type="button" onClick={onToggle} aria-expanded={!collapsed} aria-label={collapsed ? 'Uitklappen' : 'Inklappen'}
                className="text-gray-500 dark:text-white/50">
          {collapsed ? <ChevronRight className="w-4 h-4"/> : <ChevronDown className="w-4 h-4"/>}
        </button>
        <div className="flex-1 min-w-0">
          {renaming !== null ? (
            <form className="flex items-center gap-1" onSubmit={async (e) => { e.preventDefault(); if (renaming.trim()) { await onRename(renaming.trim()); setRenaming(null); } }}>
              <input autoFocus value={renaming} onChange={(e) => setRenaming(e.target.value)} aria-label="Naam van het hoofdstuk"
                     className="min-w-0 flex-1 rounded border border-gray-300 dark:border-white/10 bg-white dark:bg-black/40 px-2 py-1 text-sm text-gray-900 dark:text-white"/>
              <button type="submit" aria-label="Naam opslaan" className="p-1 text-green-600"><Save className="w-4 h-4"/></button>
              <button type="button" aria-label="Annuleren" onClick={() => setRenaming(null)} className="p-1 text-gray-500"><X className="w-4 h-4"/></button>
            </form>
          ) : (
            <h3 className="font-semibold text-gray-900 dark:text-white truncate">
              {chapter.name} <span className="ml-1 text-xs font-normal text-gray-500 dark:text-white/40">({itemIds.length})</span>
            </h3>
          )}
          {chapter.subtitle && <div className="text-xs text-gray-500 dark:text-white/50 truncate">{chapter.subtitle}</div>}
        </div>
        {onAddItem && (
          <button type="button" onClick={onAddItem} title="Item toevoegen" aria-label={`Item toevoegen aan ${chapter.name}`}
                  className="p-1.5 rounded text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:text-white/50 dark:hover:bg-white/10"><Plus className="w-4 h-4"/></button>
        )}
        <button type="button" onClick={() => setRenaming(chapter.name)} title="Naam wijzigen" aria-label={`Naam van ${chapter.name} wijzigen`}
                className="p-1.5 rounded text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:text-white/50 dark:hover:bg-white/10"><FilePenLine className="w-4 h-4"/></button>
        <button type="button" onClick={remove} title="Hoofdstuk verwijderen" aria-label={`Hoofdstuk ${chapter.name} verwijderen`}
                className="p-1.5 rounded text-gray-500 hover:text-red-600 hover:bg-red-50 dark:text-white/50 dark:hover:bg-red-900/20"><Trash2 className="w-4 h-4"/></button>
      </header>

      {deleting && (
        <div role="alertdialog" aria-label="Hoofdstuk verwijderen" className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800">
          {others.length === 0 ? (
            <span>Het laatste hoofdstuk kan niet weg zolang er items in staan: elk item hoort in een hoofdstuk.</span>
          ) : (
            <>
              <label htmlFor={`move-${chapterKey}`}>Items verplaatsen naar</label>
              <select id={`move-${chapterKey}`} value={moveTo} onChange={(e) => setMoveTo(e.target.value)}
                      className="rounded border border-gray-300 dark:border-white/10 bg-white dark:bg-black/40 px-2 py-1">
                {others.map((c) => <option key={String(c.id)} value={String(c.id)}>{c.name}</option>)}
              </select>
              <button type="button" onClick={async () => { await onDelete(others.find((c) => String(c.id) === moveTo)?.id ?? null); setDeleting(false); }}
                      className="rounded bg-red-600 px-2 py-1 text-white">Verplaatsen en verwijderen</button>
            </>
          )}
          <button type="button" onClick={() => setDeleting(false)} className="rounded px-2 py-1 text-gray-600 dark:text-white/60">Annuleren</button>
        </div>
      )}

      {chapter.extra && !collapsed && <div className="px-3 py-2 border-b border-gray-200 dark:border-white/10">{chapter.extra}</div>}

      <div ref={droppable.setNodeRef} className={collapsed ? 'hidden' : 'p-2 space-y-2 min-h-[2.5rem]'}>
        <SortableContext items={itemIds.map((id) => ITEM + id)} strategy={verticalListSortingStrategy}>
          {children}
        </SortableContext>
        {itemIds.length === 0 && <p className="text-xs italic text-gray-400 dark:text-white/30 px-2 py-2">Nog geen items: sleep er een naartoe of voeg er een toe.</p>}
      </div>
    </section>
  );
}

function SortableItem({id, children}: { id: string; children: (handle: DragHandle) => React.ReactNode }) {
  const {attributes, listeners, setNodeRef, transform, transition, isDragging} = useSortable({id});
  const style = {transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1, position: 'relative' as const, zIndex: isDragging ? 50 : undefined};
  return <div ref={setNodeRef} style={style}>{children({...attributes, ...listeners} as DragHandle)}</div>;
}
