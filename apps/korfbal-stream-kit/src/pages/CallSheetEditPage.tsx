import React from 'react';
import {Link, useParams} from 'react-router-dom';
import {
  CallSheetItem,
  useCalculateCallSheetTimes,
  useCallSheet,
  useCreateCallSheetItem,
  useDeleteCallSheetItem,
  useSyncCallSheetToEvents,
  useUpdateCallSheet,
  useUpdateCallSheetItem
} from '../hooks/useCallsheet';
import {useProduction, useProductionSegments, useProductionTiming} from '../hooks/useProductions';
import {useQueryClient} from '@tanstack/react-query';
import ChapterBoard from '../components/ChapterBoard';
import DraaiboekItem, {DraaiboekItemData} from '../components/DraaiboekItem';
import {appendItem, buildStructure} from '../lib/chapterStructure';
import {addProductionChapter, deleteProductionChapter, renameProductionChapter, saveCallSheetStructure} from '../lib/chaptersApi';
import {usePositionsCatalog} from '../hooks/usePositions';
import {adminPaths} from '../lib/adminPaths';
import {formatTime} from '../lib/time';

const asItem = (it: CallSheetItem): DraaiboekItemData => ({
  id: it.id, cue: it.cue ?? '', title: it.title, note: it.note ?? null, durationSec: it.durationSec,
  isInVenue: !!it.isInVenue, isInLivestream: it.isInLivestream !== false, isTimeAnchor: !!it.isTimeAnchor,
  anchorType: it.anchorType ?? null, autoAdvance: !!it.autoAdvance, parentId: it.parentId ?? null,
  positionIds: (it.positions ?? []).map((p) => p.positionId), timeStart: it.timeStart ?? null,
});

/** A production's draaiboek (callsheet) in hoofdstukken (openspec/changes/chapters D4). */
export default function CallSheetEditPage() {
  const params = useParams<{ id: string; callSheetId: string }>();
  const productionId = Number(params.id);
  const callSheetId = Number(params.callSheetId);
  const { data, isLoading, error } = useCallSheet(callSheetId);
  const segments = useProductionSegments(productionId);
  const { data: positions = [] } = usePositionsCatalog();
  const showcallerId = positions.find((p) => p.name === 'Showcaller')?.id;

  const updateCS = useUpdateCallSheet();
  const createItem = useCreateCallSheetItem(callSheetId);
  const updateItem = useUpdateCallSheetItem(callSheetId);
  const deleteItem = useDeleteCallSheetItem(callSheetId);
  const calculateTimes = useCalculateCallSheetTimes(callSheetId);
  const syncToEvents = useSyncCallSheetToEvents(callSheetId);

  const [err, setErr] = React.useState<string | null>(null);
  const [openItem, setOpenItem] = React.useState<string | null>(null);

  // Hoofdstukken: the production's, with this callsheet's items in them
  const qc = useQueryClient();
  const production = useProduction(productionId);
  const timing = useProductionTiming(productionId);
  const structure = React.useMemo(
    () => buildStructure((segments.data ?? []).map((s) => ({id: s.id})), (data?.items ?? []).map((it) => ({id: it.id, chapterId: it.productionSegmentId}))),
    [segments.data, data],
  );
  const items = React.useMemo(() => (data?.items ?? []).map(asItem), [data]);
  const parentOptions = items.map((it) => ({id: it.id, label: it.cue ? `${it.cue}: ${it.title}` : it.title}));
  const chapterSubtitle = (chapterId: number) => {
    const t = timing.data?.find((c) => c.id === chapterId);
    return t?.start ? `${formatTime(t.start)} – ${formatTime(t.end)} · ${t.duurInMinuten} min` : undefined;
  };
  /** A change of the draaiboek; a refusal (e.g. "Hoofdstuk is niet leeg") is shown above the board */
  async function run(action: () => Promise<unknown>) {
    setErr(null);
    try {
      await action();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Opslaan mislukt');
    }
    await qc.invalidateQueries({queryKey: ['production']});
  }

  /** A new item at the end of a hoofdstuk, opened right away */
  const handleAddItem = (chapterId: number) => run(async () => {
    const created = await createItem.mutateAsync({
      title: 'Nieuw item', cue: '', durationSec: 60, productionSegmentId: chapterId, isInLivestream: true,
      positionIds: showcallerId ? [showcallerId] : [],
    } as Omit<CallSheetItem, 'id' | 'callSheetId'>);
    await saveCallSheetStructure(callSheetId, appendItem(structure, chapterId, created.id));
    setOpenItem(created.id);
  });

  const handleItemDelete = (id: string) => {
    if (confirm('Item verwijderen?')) void run(() => deleteItem.mutateAsync(id));
  };

  async function handleHeaderUpdate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    try {
      const fd = new FormData(e.currentTarget);
      const name = String(fd.get('name') || '').trim();
      const color = String(fd.get('color') || '').trim();
      await updateCS.mutateAsync({ id: callSheetId, name, color: color || null });
    } catch (e: any) {
      setErr(e?.message || 'Opslaan mislukt');
    }
  }


  if (isNaN(productionId) || isNaN(callSheetId)) return <div className="container py-6">Ongeldige parameters in URL</div>;
  if (isLoading) return <div className="container py-6">Laden…</div>;
  if (error) return <div className="container py-6 text-red-700">{String((error as any)?.message || error)}</div>;
  if (!data) return <div className="container py-6">Niet gevonden</div>;

  return (
    <div className="container py-6 text-gray-800 dark:text-gray-100 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Callsheet: {data.name}</h1>
          <div className="flex gap-4">
            <Link className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1" to={adminPaths.callSheets(productionId)}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
              Terug naar overzicht
            </Link>
            <Link className="text-sm text-purple-400 hover:text-purple-300 flex items-center gap-1" to={adminPaths.crewReport(productionId)}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              Callsheet-rapport
            </Link>
          </div>
        </div>
        <div className="flex gap-2">
           <button
             onClick={() => calculateTimes.mutateAsync()}
             disabled={calculateTimes.isPending}
             className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-md text-sm font-bold transition-colors flex items-center gap-2"
             title="Herbereken alle tijden op basis van ankers en duur"
           >
             <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 14a8 8 0 1 0 2.1-5.9L2 12"/><path d="M2 6v6h6"/><path d="M20 10a8 8 0 1 0-2.1 5.9L22 12"/><path d="M22 18v-6h-6"/></svg>
             {calculateTimes.isPending ? 'Berekenen...' : 'Tijden herberekenen'}
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2">
          <form onSubmit={handleHeaderUpdate} className="bg-white/5 p-4 rounded-lg border border-white/5 flex items-end gap-4 h-full">
            <label className="flex-grow text-xs flex flex-col gap-1.5">
              <span className="font-bold text-white/40 uppercase">Naam</span>
              <input name="name" defaultValue={data.name} className="bg-black/40 border border-white/10 rounded px-3 py-2 text-white focus:border-blue-500/50 outline-none" />
            </label>
            <label className="text-xs flex flex-col gap-1.5">
              <span className="font-bold text-white/40 uppercase">Kleur</span>
              <input name="color" type="color" defaultValue={(data as any).color || '#3b82f6'} className="w-10 h-10 bg-black/40 border border-white/10 rounded p-1 cursor-pointer" />
            </label>
            <button type="submit" className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-md text-sm font-bold transition-colors h-[38px]" disabled={updateCS.isPending}>
              Opslaan
            </button>
          </form>
        </div>
        <div className="flex items-end">
          <button
            onClick={() => { if(confirm('Dit overschrijft de huidige live-events. Weet je het zeker?')) syncToEvents.mutateAsync() }}
            disabled={syncToEvents.isPending}
            className="w-full px-4 py-4 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-bold transition-colors flex items-center justify-center gap-2 shadow-lg h-full min-h-[70px]"
            title="Pas deze callsheet toe op de live view (overschrijft bestaande events)"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v8"/><path d="m16 6-4 4-4-4"/><rect width="20" height="8" x="2" y="14" rx="2"/><path d="M6 18h.01"/><path d="M10 18h.01"/></svg>
            {syncToEvents.isPending ? 'Toepassen...' : 'PAS TOE OP LIVE VIEW'}
          </button>
        </div>
      </div>

      {err && <div className="mb-4 text-red-700">{err}</div>}

      <h2 className="font-semibold mb-4 text-white/60 uppercase tracking-widest text-sm">Hoofdstukken en items</h2>
      {production.data?.chaptersAutoPlaced && (
        <div role="status" className="mb-4 flex flex-wrap items-center gap-3 rounded-md border border-amber-700 bg-amber-900/20 px-3 py-2 text-sm text-amber-200">
          <span className="flex-1 min-w-0">Hoofdstukken automatisch ingedeeld — controleer de indeling. Sleep een item naar het juiste hoofdstuk als het verkeerd staat.</span>
          <button type="button" onClick={() => run(() => saveCallSheetStructure(callSheetId, structure))} className="rounded bg-amber-600 px-3 py-1 font-semibold text-white hover:bg-amber-700">Indeling klopt</button>
        </div>
      )}
      <ChapterBoard
        chapters={(segments.data ?? []).map((s) => ({id: s.id, name: s.naam, subtitle: chapterSubtitle(s.id)}))}
        items={items}
        structure={structure}
        itemLabel={(it) => it.title}
        onStructureChange={(next) => run(() => saveCallSheetStructure(callSheetId, next))}
        onAddItem={handleAddItem}
        onAddChapter={(name) => run(() => addProductionChapter(productionId, name))}
        onRenameChapter={(chapterId, name) => run(() => renameProductionChapter(chapterId, name))}
        onDeleteChapter={(chapterId, without) => run(async () => {
          // Items first to their new hoofdstuk (the structure lists every hoofdstuk), then the empty one away
          await saveCallSheetStructure(callSheetId, [...without, {id: chapterId, itemIds: []}]);
          await deleteProductionChapter(chapterId);
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
              await updateItem.mutateAsync({id: item.id, ...change} as Partial<CallSheetItem> & { id: string });
              setOpenItem(null);
            })}
            onDelete={() => handleItemDelete(item.id)}
          />
        )}
      />
    </div>
  );
}
