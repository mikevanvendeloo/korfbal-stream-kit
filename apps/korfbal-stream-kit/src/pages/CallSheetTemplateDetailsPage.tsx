import {useCallback, useEffect, useMemo, useState} from 'react';
import {useNavigate, useParams} from 'react-router-dom';
import {CallSheetTemplateChapter, CallSheetTemplateItem, FullCallSheetTemplate, useCallSheetTemplates} from '../hooks/useCallSheetTemplates';
import {Card, CardContent} from '../components/ui/card';
import {Button} from '../components/ui/button';
import {Anchor, FastForward, FilePenLine, GripVertical, Link2, Save, Trash2} from 'lucide-react';
import {Input} from '../components/ui/input';
import {usePositionsCatalog} from "../hooks/usePositions";
import {MdArrowBack} from "react-icons/md";
import {adminPaths} from '../lib/adminPaths';
import ChapterBoard, {DragHandle} from '../components/ChapterBoard';
import {appendItem, buildStructure, formatRelative, relativeChapterTimes, Structure} from '../lib/chapterStructure';
import {addTemplateChapter, deleteTemplateChapter, saveTemplateStructure, updateTemplateChapter} from '../lib/chaptersApi';

type Position = { id: number; name: string };

/** A draaiboek template: its hoofdstukken with their items and standard positions (openspec/changes/chapters D4). */
export default function CallSheetTemplateDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { fetchTemplate, updateTemplate, addTemplateItem, updateTemplateItem, deleteTemplateItem, loading } = useCallSheetTemplates();
  const { data: positions = [], isLoading: positionsLoading, error: positionsError } = usePositionsCatalog();
  const sortedPositions = [...positions].sort((a, b) => a.name.localeCompare(b.name));
  const [template, setTemplate] = useState<FullCallSheetTemplate | null>(null);
  const [isEditingItem, setIsEditingItem] = useState<string | null>(null);
  const [editData, setEditData] = useState<any>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (id) setTemplate(await fetchTemplate(Number(id)));
  }, [id, fetchTemplate]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const structure = useMemo<Structure<string>>(
    () => template ? buildStructure(template.chapters, template.items) : [],
    [template],
  );
  const times = useMemo(() => relativeChapterTimes(structure, template?.items ?? []), [structure, template]);

  /** Runs a change and reloads; a refusal (e.g. "Hoofdstuk is niet leeg") is shown above the board. */
  async function run(action: () => Promise<unknown>) {
    setErr(null);
    try {
      await action();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Opslaan mislukt');
    }
    await loadData();
  }

  const handleUpdateName = async () => {
    if (!id || !newName) return;
    const ok = await updateTemplate(Number(id), newName);
    if (ok) {
      setIsEditingName(false);
      void loadData();
    }
  };

  /** A new item at the end of a hoofdstuk */
  const handleAddItem = (chapterId: string) => run(async () => {
    if (!template) return;
    const showcaller = positions.find(p => p.name === 'Showcaller');
    const newItem = await addTemplateItem(template.id, {
      title: 'Nieuw item',
      durationSec: 60,
      chapterId,
      isInLivestream: true,
      isInVenue: false,
      positionIds: showcaller ? [showcaller.id] : []
    });
    if (!newItem) throw new Error('Item toevoegen mislukt');
    await saveTemplateStructure(template.id, appendItem(structure, chapterId, newItem.id));
    handleStartEdit({...newItem, positions: newItem.positions ?? []});
  });

  const handleStartEdit = (item: CallSheetTemplateItem) => {
    setIsEditingItem(item.id);
    setEditData({
      ...item,
      positionIds: item.positions.map((p) => p.positionId)
    });
  };

  const handleSaveEdit = async () => {
    if (!isEditingItem) return;
    // The order changes only by dragging (one flat show order over the hoofdstukken)
    const data = {...editData};
    delete data.orderIndex;
    const ok = await updateTemplateItem(isEditingItem, data);
    if (ok) {
      setIsEditingItem(null);
      void loadData();
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (window.confirm('Item verwijderen?')) {
      const ok = await deleteTemplateItem(itemId);
      if (ok) void loadData();
    }
  };

  const togglePosition = (posId: number) => {
    const current = editData.positionIds || [];
    const showcaller = positions.find(p => p.name === 'Showcaller');

    if (showcaller && posId === showcaller.id) return; // Kan showcaller niet uitvinken

    if (current.includes(posId)) {
      setEditData({ ...editData, positionIds: current.filter((p: number) => Number(p) !== Number(posId)) });
    } else {
      setEditData({ ...editData, positionIds: [...current, Number(posId)] });
    }
  };

  if (!template && !loading) return <div className="p-10 text-gray-900 dark:text-white">Template niet gevonden</div>;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" size="icon" onClick={() => navigate(adminPaths.callSheetTemplates)} className="text-gray-600 dark:text-white">
          <MdArrowBack />
        </Button>
        {isEditingName ? (
          <div className="flex items-center gap-2">
            <Input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              className="bg-white dark:bg-black/40 border-gray-200 dark:border-white/10 text-gray-900 dark:text-white text-3xl font-bold h-12 w-96"
              autoFocus
            />
            <Button size="icon" onClick={handleUpdateName} className="bg-green-600 hover:bg-green-700 text-white shadow-sm">
              <Save className="w-5 h-5" />
            </Button>
            <Button size="icon" variant="ghost" onClick={() => setIsEditingName(false)} className="text-gray-500">
              <Trash2 className="w-5 h-5" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-4 group">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{template?.name}</h1>
            <Button
              variant="ghost"
              size="icon"
              className="opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => {
                setNewName(template?.name || '');
                setIsEditingName(true);
              }}
            >
              <FilePenLine className="w-4 h-4 text-gray-400 dark:text-white/40" />
            </Button>
          </div>
        )}
      </div>

      {template?.chaptersAutoPlaced && (
        <div role="status" className="mb-4 flex flex-wrap items-center gap-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200">
          <span className="flex-1 min-w-0">Hoofdstukken automatisch ingedeeld — controleer de indeling. Sleep een item naar het juiste hoofdstuk als het verkeerd staat.</span>
          <Button size="sm" onClick={() => run(() => saveTemplateStructure(template.id, structure))} className="bg-amber-600 hover:bg-amber-700 text-white">Indeling klopt</Button>
        </div>
      )}
      {err && <div role="alert" className="mb-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300">{err}</div>}

      {template && (
        <ChapterBoard
          chapters={template.chapters.map((chapter) => {
            const time = times.get(chapter.id);
            return {
              id: chapter.id,
              name: chapter.name,
              subtitle: time ? `${formatRelative(time.start)} tot ${formatRelative(time.end)} t.o.v. de aftrap · ${formatRelative(time.end - time.start).replace(/^\+/, '')} min` : 'Geen items',
              extra: <ChapterPositions chapter={chapter} positions={sortedPositions} onSave={(positionIds) => run(() => updateTemplateChapter(chapter.id, {positionIds}))}/>,
            };
          })}
          items={template.items}
          structure={structure}
          itemLabel={(item) => item.title}
          onStructureChange={(next) => run(() => saveTemplateStructure(template.id, next))}
          onAddItem={handleAddItem}
          onAddChapter={(name) => run(() => addTemplateChapter(template.id, name))}
          onRenameChapter={(chapterId, name) => run(() => updateTemplateChapter(chapterId, {name}))}
          onDeleteChapter={(chapterId, without) => run(async () => {
            // Items first to their new hoofdstuk (the structure lists every hoofdstuk), then the empty one away
            await saveTemplateStructure(template.id, [...without, {id: chapterId, itemIds: []}]);
            await deleteTemplateChapter(chapterId);
          })}
          renderItem={(item, handle) => (
            <TemplateItem
              item={item}
              handle={handle}
              isEditingItem={isEditingItem}
              editData={editData}
              setEditData={setEditData}
              setIsEditingItem={setIsEditingItem}
              handleSaveEdit={handleSaveEdit}
              togglePosition={togglePosition}
              handleStartEdit={handleStartEdit}
              handleDeleteItem={handleDeleteItem}
              positionsLoading={positionsLoading}
              positionsError={positionsError}
              sortedPositions={sortedPositions}
              templateItems={template.items}
            />
          )}
        />
      )}
    </div>
  );
}

/** The standard positions of a hoofdstuk (who is on it by default in a production), in order. */
function ChapterPositions({chapter, positions, onSave}: { chapter: CallSheetTemplateChapter; positions: Position[]; onSave: (positionIds: number[]) => Promise<void> }) {
  const [editing, setEditing] = useState<number[] | null>(null);
  const current = chapter.positions.map((p) => p.positionId);
  const names = chapter.positions.map((p) => p.position.name);

  if (editing === null) {
    return (
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <span className="font-semibold uppercase text-gray-500 dark:text-white/40">Standaardbezetting</span>
        {names.length === 0 && <span className="italic text-gray-400 dark:text-white/30">geen</span>}
        {names.map((name) => <span key={name} className="rounded border border-gray-200 bg-white px-1.5 py-0.5 dark:border-white/10 dark:bg-white/5">{name}</span>)}
        <button type="button" onClick={() => setEditing(current)} className="ml-1 text-blue-600 hover:underline dark:text-blue-400">Wijzigen</button>
      </div>
    );
  }
  const toggle = (id: number) => setEditing((list) => (list ?? []).includes(id) ? (list ?? []).filter((p) => p !== id) : [...(list ?? []), id]);
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5">
        {positions.map((pos) => (
          <label key={pos.id} className="flex items-center gap-2 rounded border border-gray-200 bg-white px-2 py-1 text-xs dark:border-white/10 dark:bg-white/5">
            <input type="checkbox" checked={editing.includes(pos.id)} onChange={() => toggle(pos.id)}/>
            <span className="truncate">{pos.name}</span>
          </label>
        ))}
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={async () => { await onSave(editing); setEditing(null); }} className="bg-green-600 hover:bg-green-700 text-white">Opslaan</Button>
        <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Annuleren</Button>
      </div>
    </div>
  );
}

function TemplateItem({
  item,
  handle,
  isEditingItem,
  editData,
  setEditData,
  setIsEditingItem,
  handleSaveEdit,
  togglePosition,
  handleStartEdit,
  handleDeleteItem,
  positionsLoading,
  positionsError,
  sortedPositions,
  templateItems
}: any & { handle: DragHandle }) {
  const parentItem = item.parentId ? templateItems.find((it: any) => it.id === item.parentId) : null;

  return (
      <Card className="bg-white dark:bg-white/5 border-gray-200 dark:border-white/10 overflow-hidden shadow-sm">
        <CardContent className="p-0">
          {isEditingItem === item.id ? (
            <div className="p-6 space-y-4 bg-blue-50 dark:bg-blue-900/10 transition-colors">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs text-gray-500 dark:text-white/40 uppercase font-semibold">Titel</label>
                  <Input
                    value={editData.title}
                    onChange={e => setEditData({...editData, title: (e.target as HTMLInputElement).value})}
                    className="bg-white dark:bg-black/40 border-gray-200 dark:border-white/10 text-gray-900 dark:text-white"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-gray-500 dark:text-white/40 uppercase font-semibold">Duur (seconden)</label>
                  <Input
                    type="number"
                    value={editData.durationSec}
                    onChange={e => setEditData({...editData, durationSec: Number((e.target as HTMLInputElement).value)})}
                    className="bg-white dark:bg-black/40 border-gray-200 dark:border-white/10 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs text-gray-500 dark:text-white/40 uppercase font-semibold">Notitie</label>
                <Input
                  value={editData.note || ''}
                  onChange={e => setEditData({...editData, note: e.target.value})}
                  className="bg-white dark:bg-black/40 border-gray-200 dark:border-white/10 text-gray-900 dark:text-white"
                />
              </div>

              <div className="flex flex-wrap gap-6 py-2">
                <label className="flex items-center gap-2 text-gray-700 dark:text-white cursor-pointer select-none">
                  <input type="checkbox" checked={editData.isInVenue} onChange={e => setEditData({...editData, isInVenue: e.target.checked})} className="rounded border-gray-300 dark:border-white/10 bg-white dark:bg-black/40" />
                  Zaal
                </label>
                <label className="flex items-center gap-2 text-gray-700 dark:text-white cursor-pointer select-none">
                  <input type="checkbox" checked={editData.isInLivestream} onChange={e => setEditData({...editData, isInLivestream: e.target.checked})} className="rounded border-gray-300 dark:border-white/10 bg-white dark:bg-black/40" />
                  Stream
                </label>
                <label className="flex items-center gap-2 text-gray-700 dark:text-white cursor-pointer select-none">
                  <input type="checkbox" checked={editData.isTimeAnchor} onChange={e => setEditData({...editData, isTimeAnchor: e.target.checked})} className="rounded border-gray-300 dark:border-white/10 bg-white dark:bg-black/40" />
                  Tijd Anchor
                </label>
                {editData.isTimeAnchor && (
                  <select
                    value={editData.anchorType || ''}
                    onChange={e => setEditData({...editData, anchorType: e.target.value})}
                    className="bg-white dark:bg-black/40 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white text-xs rounded px-2 py-1 outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="" className="bg-white dark:bg-gray-900">Kies type...</option>
                    <option value="MATCH_START" className="bg-white dark:bg-gray-900">Wedstrijd starttijd</option>
                    <option value="LIVESTREAM_START" className="bg-white dark:bg-gray-900">Livestream start</option>
                  </select>
                )}
                <label className="flex items-center gap-2 text-gray-700 dark:text-white cursor-pointer select-none">
                  <input type="checkbox" checked={editData.autoAdvance} onChange={e => setEditData({...editData, autoAdvance: e.target.checked})} className="rounded border-gray-300 dark:border-white/10 bg-white dark:bg-black/40" />
                  Auto Advance
                </label>

                <div className="flex flex-col gap-1 min-w-[200px]">
                  <label className="text-xs text-gray-500 dark:text-white/40 uppercase font-semibold">Koppel aan item (Parent)</label>
                  <select
                    value={editData.parentId || ''}
                    onChange={e => setEditData({...editData, parentId: e.target.value || null})}
                    className="bg-white dark:bg-black/40 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white text-xs rounded px-2 py-1 outline-none focus:border-blue-500/50"
                  >
                    <option value="" className="bg-white dark:bg-gray-900">Geen (Hoofdlijn)</option>
                    {templateItems
                      ?.filter((it: any) => it.id !== editData.id)
                      ?.map((it: any) => (
                        <option key={it.id} value={it.id} className="bg-white dark:bg-gray-900">
                          {it.title}
                        </option>
                      ))
                    }
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs text-gray-500 dark:text-white/40 uppercase font-bold">Posities (vink aan om toe te wijzen)</label>
                {positionsLoading ? (
                  <div className="text-gray-400 dark:text-white/40 text-xs italic">Posities laden...</div>
                ) : positionsError ? (
                  <div className="text-red-500 dark:text-red-400 text-xs italic">Fout bij laden posities: {(positionsError as Error).message}</div>
                ) : sortedPositions.length === 0 ? (
                  <div className="text-orange-500 dark:text-orange-400 text-xs italic">Geen posities gevonden in de catalogus.</div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 bg-gray-50 dark:bg-black/20 p-3 rounded-lg border border-gray-200 dark:border-white/5 shadow-inner">
                    {sortedPositions.map((pos: any) => {
                      const isShowcaller = pos.name === 'Showcaller';
                      const isSelected = (editData.positionIds || []).some((id: number) => Number(id) === Number(pos.id)) || isShowcaller;
                      return (
                        <label
                          key={pos.id}
                          className={`flex items-center gap-2 px-3 py-2 rounded-md transition-all cursor-pointer shadow-sm border ${
                            isSelected
                              ? 'bg-blue-600 dark:bg-blue-600/20 border-blue-600 dark:border-blue-500/50 text-white'
                              : 'bg-white dark:bg-white/5 border-gray-200 dark:border-transparent text-gray-600 dark:text-white/40 hover:bg-gray-100 dark:hover:bg-white/10'
                          } ${isShowcaller ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            disabled={isShowcaller}
                            onChange={() => togglePosition(pos.id)}
                            className="w-4 h-4 rounded border-gray-300 dark:border-white/20 bg-white dark:bg-black/40 text-blue-600 focus:ring-blue-500/50"
                          />
                          <span className="text-xs font-medium truncate">{pos.name}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-gray-200 dark:border-white/10">
                <Button variant="ghost" onClick={() => setIsEditingItem(null)} className="text-gray-500 hover:text-gray-700 dark:text-white/60">Annuleren</Button>
                <Button onClick={handleSaveEdit} className="bg-green-600 hover:bg-green-700 text-white shadow-sm">
                  <Save className="w-4 h-4 mr-2" /> Opslaan
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center p-4 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors group">
              <div
                {...handle}
                className="mr-4 p-1 rounded hover:bg-gray-100 dark:hover:bg-white/10 cursor-grab active:cursor-grabbing text-gray-300 dark:text-white/10 hover:text-gray-600 dark:hover:text-white/60 transition-colors"
                title="Slepen om te verplaatsen"
              >
                <GripVertical className="w-5 h-5" />
              </div>

              <div className="w-16 font-mono text-gray-400 dark:text-white/40 text-sm font-medium">{item.durationSec}s</div>
              <div className="flex-grow min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-gray-900 dark:text-white">{item.title}</span>
                  {item.isTimeAnchor && (
                    <div className="flex items-center gap-1 bg-amber-50 dark:bg-orange-500/20 text-amber-700 dark:text-orange-400 px-1.5 py-0.5 rounded text-[10px] border border-amber-200 dark:border-orange-500/30 font-bold uppercase tracking-wide">
                      <Anchor className="w-3 h-3" />
                      {item.anchorType === 'MATCH_START' ? 'Wedstrijd Start' : item.anchorType === 'LIVESTREAM_START' ? 'Stream Start' : 'Anchor'}
                    </div>
                  )}
                  {item.autoAdvance && <FastForward className="w-3 h-3 text-purple-600 dark:text-purple-400" />}
                  {parentItem && (
                    <div className="flex items-center gap-1 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 px-1.5 py-0.5 rounded text-[10px] border border-blue-200 dark:border-blue-500/20 font-semibold italic">
                      <Link2 className="w-3 h-3" />
                      Gekoppeld aan: {parentItem.title}
                    </div>
                  )}
                </div>
                {item.note && <div className="text-xs text-gray-500 dark:text-white/40 italic font-medium">{item.note}</div>}
                <div className="flex flex-wrap gap-2 mt-2">
                  {item.isInVenue && <span className="text-[10px] bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded uppercase border border-emerald-200 dark:border-emerald-500/30 font-bold tracking-wider">Zaal</span>}
                  {item.isInLivestream && <span className="text-[10px] bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400 px-1.5 py-0.5 rounded uppercase border border-blue-200 dark:border-blue-500/30 font-bold tracking-wider">Stream</span>}
                  {item.positions?.map((p: any) => (
                    <span key={p.positionId} className="text-[10px] bg-gray-100 dark:bg-blue-500/10 text-gray-600 dark:text-blue-400 px-1.5 py-0.5 rounded border border-gray-200 dark:border-blue-500/20 font-semibold shadow-sm">
                      {p.position.name}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`${item.title} wijzigen`}
                  onClick={() => handleStartEdit(item)}
                  className="text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                >
                  <FilePenLine className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`${item.title} verwijderen`}
                  onClick={() => handleDeleteItem(item.id)}
                  className="text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
  );
}
