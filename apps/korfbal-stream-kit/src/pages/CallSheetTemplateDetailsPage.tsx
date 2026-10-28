import {useCallback, useEffect, useMemo, useState} from 'react';
import {useNavigate, useParams} from 'react-router-dom';
import {CallSheetTemplateChapter, CallSheetTemplateItem, FullCallSheetTemplate, useCallSheetTemplates} from '../hooks/useCallSheetTemplates';
import {Button} from '../components/ui/button';
import {FilePenLine, Save, Trash2} from 'lucide-react';
import {Input} from '../components/ui/input';
import {usePositionsCatalog} from "../hooks/usePositions";
import {MdArrowBack} from "react-icons/md";
import {adminPaths} from '../lib/adminPaths';
import ChapterBoard from '../components/ChapterBoard';
import DraaiboekItem, {DraaiboekItemData} from '../components/DraaiboekItem';
import PositionPicker, {PickerPosition} from '../components/PositionPicker';
import {appendItem, buildStructure, formatRelative, relativeChapterTimes, Structure} from '../lib/chapterStructure';
import {addTemplateChapter, deleteTemplateChapter, saveTemplateStructure, updateTemplateChapter} from '../lib/chaptersApi';

const asItem = (item: CallSheetTemplateItem): DraaiboekItemData => ({
  id: item.id, cue: item.cue ?? '', title: item.title, note: item.note, durationSec: item.durationSec,
  isInVenue: item.isInVenue, isInLivestream: item.isInLivestream, isTimeAnchor: item.isTimeAnchor,
  anchorType: item.anchorType, autoAdvance: item.autoAdvance, parentId: item.parentId,
  positionIds: item.positions.map((p) => p.positionId),
});

/** A draaiboek template: its hoofdstukken with their items and standard positions (openspec/changes/chapters D4). */
export default function CallSheetTemplateDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { fetchTemplate, updateTemplate, addTemplateItem, updateTemplateItem, deleteTemplateItem, loading } = useCallSheetTemplates();
  const { data: positions = [] } = usePositionsCatalog();
  const showcallerId = positions.find((p) => p.name === 'Showcaller')?.id;
  const [template, setTemplate] = useState<FullCallSheetTemplate | null>(null);
  const [openItem, setOpenItem] = useState<string | null>(null);
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
  const items = useMemo(() => (template?.items ?? []).map(asItem), [template]);
  const parentOptions = items.map((it) => ({id: it.id, label: it.cue ? `${it.cue}: ${it.title}` : it.title}));

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

  /** A new item at the end of a hoofdstuk, opened right away */
  const handleAddItem = (chapterId: string) => run(async () => {
    if (!template) return;
    const newItem = await addTemplateItem(template.id, {
      title: 'Nieuw item',
      durationSec: 60,
      chapterId,
      isInLivestream: true,
      isInVenue: false,
      positionIds: showcallerId ? [showcallerId] : []
    });
    if (!newItem) throw new Error('Item toevoegen mislukt');
    await saveTemplateStructure(template.id, appendItem(structure, chapterId, newItem.id));
    setOpenItem(newItem.id);
  });

  const handleDeleteItem = (itemId: string) => {
    if (window.confirm('Item verwijderen?')) void run(async () => {
      if (!(await deleteTemplateItem(itemId))) throw new Error('Verwijderen mislukt');
    });
  };

  if (!template && !loading) return <div className="p-10 text-gray-900 dark:text-white">Template niet gevonden</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto">
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
              extra: <ChapterPositions chapter={chapter} positions={positions} onSave={(positionIds) => run(() => updateTemplateChapter(chapter.id, {positionIds}))}/>,
            };
          })}
          items={items}
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
            <DraaiboekItem
              item={item}
              handle={handle}
              positions={positions}
              fixedPositionIds={showcallerId ? [showcallerId] : []}
              parentOptions={parentOptions}
              open={openItem === item.id}
              onOpen={() => setOpenItem(item.id)}
              onClose={() => setOpenItem(null)}
              onSave={(change) => run(async () => {
                if (!(await updateTemplateItem(item.id, change))) throw new Error('Opslaan mislukt');
                setOpenItem(null);
              })}
              onDelete={() => handleDeleteItem(item.id)}
            />
          )}
        />
      )}
    </div>
  );
}

/** The standard positions of a hoofdstuk (who is on it by default in a production), saved on every change. */
function ChapterPositions({chapter, positions, onSave}: { chapter: CallSheetTemplateChapter; positions: PickerPosition[]; onSave: (positionIds: number[]) => Promise<void> }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="font-semibold uppercase text-gray-500 dark:text-white/40">Standaardbezetting</span>
      <PositionPicker positions={positions} selected={chapter.positions.map((p) => p.positionId)} onChange={(ids) => void onSave(ids)}/>
    </div>
  );
}
