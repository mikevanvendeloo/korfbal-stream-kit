import React from 'react';
import {Link, useParams} from 'react-router-dom';
import {
  useCalculateCallSheetTimes,
  useCallSheet,
  useCreateCallSheetItem,
  useDeleteCallSheetItem,
  useSyncCallSheetToEvents,
  useUpdateCallSheet,
  useUpdateCallSheetItem
} from '../hooks/useCallsheet';
import {useProductionSegments} from '../hooks/useProductions';
import {usePositionsCatalog} from '../hooks/usePositions';

function uuid8() {
  // not cryptographically secure, but sufficient for UI id suggestion
  return Math.random().toString(16).slice(2, 10);
}

export default function CallSheetEditPage() {
  const params = useParams<{ id: string; callSheetId: string }>();
  const productionId = Number(params.id);
  const callSheetId = Number(params.callSheetId);
  const { data, isLoading, error } = useCallSheet(callSheetId);
  const segments = useProductionSegments(productionId);
  const positions = usePositionsCatalog();

  const updateCS = useUpdateCallSheet();
  const createItem = useCreateCallSheetItem(callSheetId);
  const updateItem = useUpdateCallSheetItem(callSheetId);
  const deleteItem = useDeleteCallSheetItem(callSheetId);
  const calculateTimes = useCalculateCallSheetTimes(callSheetId);
  const syncToEvents = useSyncCallSheetToEvents(callSheetId);

  const [err, setErr] = React.useState<string | null>(null);

  const [form, setForm] = React.useState({
    id: uuid8(),
    productionSegmentId: 0,
    cue: '',
    title: '',
    note: '',
    color: '',
    durationSec: 0,
    timeStart: '',
    timeEnd: '',
    orderIndex: 0,
    isInVenue: false,
    isInLivestream: true,
    isTimeAnchor: false,
    autoAdvance: false,
    anchorType: '',
    parentId: '',
    positionIds: [] as number[],
  });

  React.useEffect(() => {
    if (segments.data?.length && !form.productionSegmentId) {
      setForm((f) => ({ ...f, productionSegmentId: segments.data![0].id }));
    }
  }, [segments.data?.length]);

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

  function togglePositionInForm(posId: number) {
    setForm(f => {
      const isSelected = f.positionIds.includes(posId);
      if (isSelected) {
        return { ...f, positionIds: f.positionIds.filter(id => id !== posId) };
      } else {
        return { ...f, positionIds: [...f.positionIds, posId] };
      }
    });
  }

  async function handleItemTogglePosition(it: any, posId: number) {
    const currentIds = (it.positions || []).map((p: any) => p.positionId);
    const isSelected = currentIds.includes(posId);
    let nextIds: number[];
    if (isSelected) {
      nextIds = currentIds.filter((id: number) => id !== posId);
    } else {
      nextIds = [...currentIds, posId];
    }
    await handleItemChange(it.id, { positionIds: nextIds });
  }

  async function handleCreateItem(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      const payload: any = { ...form };
      if (!payload.id) payload.id = uuid8();
      if (!payload.cue) throw new Error('Cue is verplicht');
      if (!payload.title) throw new Error('Titel is verplicht');
      payload.timeStart = payload.timeStart ? new Date(payload.timeStart).toISOString() : undefined;
      payload.timeEnd = payload.timeEnd ? new Date(payload.timeEnd).toISOString() : undefined;
      await createItem.mutateAsync(payload as any);
      setForm({ id: uuid8(), productionSegmentId: segments.data?.[0]?.id || 0, cue: '', title: '', note: '', color: '', durationSec: 0, timeStart: '', timeEnd: '', orderIndex: 0, isInVenue: false, isInLivestream: true, isTimeAnchor: false, autoAdvance: false, anchorType: '', parentId: '', positionIds: []});
    } catch (e: any) {
      setErr(e?.message || 'Toevoegen mislukt');
    }
  }

  async function handleItemChange(id: string, patch: any) {
    setErr(null);
    try {
      await updateItem.mutateAsync({ id, ...patch });
    } catch (e: any) {
      setErr(e?.message || 'Wijzigen mislukt');
    }
  }

  async function handleItemDelete(id: string) {
    if (!confirm('Item verwijderen?')) return;
    setErr(null);
    try {
      await deleteItem.mutateAsync(id);
    } catch (e: any) {
      setErr(e?.message || 'Verwijderen mislukt');
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
            <Link className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1" to={`/admin/productions/${productionId}/callsheets`}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
              Terug naar overzicht
            </Link>
            <Link className="text-sm text-purple-400 hover:text-purple-300 flex items-center gap-1" to={`/admin/productions/${productionId}/crew-report`}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              Crew report
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

      <h2 className="font-semibold mb-4 text-white/60 uppercase tracking-widest text-sm">Callsheet Items</h2>
      <div className="space-y-4 mb-8">
        {data.items?.map((it) => (
          <div key={it.id} className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-white/5 p-4 rounded-lg border border-white/5 mb-4 shadow-sm">
            <div className="md:col-span-3 flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] text-white/40 bg-black/40 px-1.5 py-0.5 rounded border border-white/5 uppercase tracking-wider">{it.cue}</span>
                <input
                  defaultValue={it.title}
                  onBlur={(e) => handleItemChange(it.id, { title: e.target.value })}
                  className="font-bold bg-transparent border-none p-0 focus:ring-0 text-lg w-full text-white placeholder-white/20"
                />
              </div>
              <input
                defaultValue={(it as any).note || ''}
                placeholder="Voeg notitie toe..."
                onBlur={(e) => handleItemChange(it.id, { note: e.target.value })}
                className="text-sm text-gray-400 bg-transparent border-none p-0 focus:ring-0 italic w-full"
              />
            </div>
            <div className="flex items-start justify-end gap-2">
              <button
                onClick={() => handleItemDelete(it.id)}
                className="p-2 text-white/20 hover:text-red-500 transition-colors bg-white/5 hover:bg-red-500/10 rounded-md"
                title="Verwijderen"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
              </button>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-white/30 uppercase font-bold tracking-tight">Duur</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  defaultValue={it.durationSec}
                  onBlur={(e) => handleItemChange(it.id, { durationSec: Number(e.target.value || 0) })}
                  className="border border-white/10 rounded px-2 py-1 w-20 text-sm bg-black/40 text-white focus:border-blue-500/50 outline-none"
                />
                <span className="text-xs text-white/40">sec</span>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-white/30 uppercase font-bold tracking-tight">Status</label>
              <div className="flex items-center gap-3 py-1">
                <label className="text-xs flex items-center gap-1.5 cursor-pointer select-none">
                  <input type="checkbox" defaultChecked={it.isInVenue} onChange={(e) => handleItemChange(it.id, { isInVenue: e.target.checked })} className="rounded border-white/20 bg-black/40 text-blue-600 w-3.5 h-3.5" />
                  <span className="text-white/60">Zaal</span>
                </label>
                <label className="text-xs flex items-center gap-1.5 cursor-pointer select-none">
                  <input type="checkbox" defaultChecked={(it as any).isInLivestream !== false} onChange={(e) => handleItemChange(it.id, { isInLivestream: e.target.checked })} className="rounded border-white/20 bg-black/40 text-blue-600 w-3.5 h-3.5" />
                  <span className="text-white/60">Stream</span>
                </label>
                <label className="text-xs flex items-center gap-1.5 cursor-pointer select-none">
                  <input type="checkbox" defaultChecked={(it as any).autoAdvance === true} onChange={(e) => handleItemChange(it.id, { autoAdvance: e.target.checked })} className="rounded border-white/20 bg-black/40 text-orange-600 w-3.5 h-3.5" />
                  <span className="text-orange-400 font-bold">Auto</span>
                </label>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-white/30 uppercase font-bold tracking-tight">Tijd Anker</label>
              <div className="flex items-center gap-2">
                <input type="checkbox" defaultChecked={it.isTimeAnchor} onChange={(e) => handleItemChange(it.id, { isTimeAnchor: e.target.checked })} className="rounded border-white/20 bg-black/40 text-purple-600 w-3.5 h-3.5" />
                {it.isTimeAnchor && (
                  <select
                    defaultValue={it.anchorType || ''}
                    onChange={(e) => handleItemChange(it.id, { anchorType: e.target.value })}
                    className="border border-white/10 rounded px-1.5 py-0.5 text-[10px] bg-black/40 text-white w-full outline-none focus:border-purple-500/50"
                  >
                    <option value="">Kies type...</option>
                    <option value="MATCH_START">Start wedstrijd</option>
                    <option value="LIVESTREAM_START">Start livestream</option>
                  </select>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-white/30 uppercase font-bold tracking-tight">Koppel aan item (Parent)</label>
              <select
                value={it.parentId || ''}
                onChange={(e) => handleItemChange(it.id, { parentId: e.target.value || null })}
                className="border border-white/10 rounded px-1.5 py-0.5 text-[10px] bg-black/40 text-white w-full outline-none focus:border-blue-500/50"
              >
                <option value="">Geen (Hoofdlijn)</option>
                {data.items
                  ?.filter(other => other.id !== it.id)
                  ?.map(other => (
                    <option key={other.id} value={other.id}>
                      {other.cue}: {other.title}
                    </option>
                  ))
                }
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-white/30 uppercase font-bold tracking-tight">Segment</label>
              <select
                defaultValue={it.productionSegmentId}
                onChange={(e) => handleItemChange(it.id, { productionSegmentId: Number(e.target.value) })}
                className="border border-white/10 rounded px-1.5 py-0.5 text-xs bg-black/40 text-white outline-none focus:border-white/30"
              >
                {segments.data?.map((s) => <option key={s.id} value={s.id}>{s.volgorde}. {s.naam}</option>)}
              </select>
            </div>

            <div className="md:col-span-4 mt-2">
              <label className="text-[10px] text-white/30 uppercase font-bold block mb-2">Posities</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
                {positions.data?.sort((a: any, b: any) => a.name.localeCompare(b.name)).map((pos: any) => {
                  const isSelected = (it.positions || []).some((p: any) => p.positionId === pos.id);
                  return (
                    <label
                      key={pos.id}
                      className={`flex items-center gap-2 px-2 py-1.5 rounded transition-all cursor-pointer border ${
                        isSelected
                          ? 'bg-blue-600/20 border-blue-500/40 text-white'
                          : 'bg-white/5 border-transparent text-white/40 hover:bg-white/10'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleItemTogglePosition(it, pos.id)}
                        className="w-3.5 h-3.5 rounded-sm border-white/20 bg-black/40 text-blue-600"
                      />
                      <span className="text-[10px] font-medium truncate">{pos.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="md:col-span-4 flex justify-between items-center mt-3 pt-3 border-t border-white/5">
              <div className="flex gap-4 items-center">
                <div className="text-[10px] font-mono text-white/30 flex items-center gap-1.5">
                  <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  {it.timeStart ? new Date(it.timeStart).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '--:--:--'}
                  {' ➔ '}
                  {it.timeEnd ? new Date(it.timeEnd).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '--:--:--'}
                </div>
                <div className="text-[10px] text-white/20 flex items-center gap-1.5">
                   <div className="w-2 h-2 rounded-full" style={{backgroundColor: (it as any).color || '#333'}}></div>
                   {(it as any).color || 'Geen kleur'}
                </div>
              </div>
              <div className="text-[10px] font-mono text-white/10 uppercase tracking-widest">ID: {it.id}</div>
            </div>
          </div>
        ))}
        {!data.items?.length && (
          <div className="p-3 text-gray-600">Nog geen items</div>
        )}
      </div>

      <h3 className="font-semibold mb-4 text-white/60 uppercase tracking-widest text-sm">Nieuw item toevoegen</h3>
      <form onSubmit={handleCreateItem} className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end bg-white/5 p-6 rounded-lg border border-white/5 shadow-lg relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1 h-full bg-blue-600"></div>
        <label className="text-xs flex flex-col gap-1.5">
          <div className="font-bold text-white/40 uppercase">Cue</div>
          <input value={form.cue} onChange={(e) => setForm((f) => ({ ...f, cue: e.target.value.toUpperCase() }))} className="bg-black/40 border border-white/10 rounded px-3 py-2 text-white focus:border-blue-500/50 outline-none" placeholder="Bv. PRE_MATCH" />
        </label>
        <label className="text-xs flex flex-col gap-1.5 md:col-span-2">
          <div className="font-bold text-white/40 uppercase">Titel</div>
          <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} className="bg-black/40 border border-white/10 rounded px-3 py-2 text-white focus:border-blue-500/50 outline-none" placeholder="Titel van het item" />
        </label>
        <label className="text-xs flex flex-col gap-1.5">
          <div className="font-bold text-white/40 uppercase">Duur (sec)</div>
          <input type="number" value={form.durationSec} onChange={(e) => setForm((f) => ({ ...f, durationSec: Number(e.target.value||0) }))} className="bg-black/40 border border-white/10 rounded px-3 py-2 text-white focus:border-blue-500/50 outline-none" />
        </label>
        <label className="text-xs flex flex-col gap-1.5 md:col-span-2">
          <div className="font-bold text-white/40 uppercase">Segment</div>
          <select value={form.productionSegmentId} onChange={(e) => setForm((f) => ({ ...f, productionSegmentId: Number(e.target.value) }))} className="bg-black/40 border border-white/10 rounded px-3 py-2 text-white focus:border-blue-500/50 outline-none">
            {segments.data?.map((s) => <option key={s.id} value={s.id}>{s.volgorde}. {s.naam}</option>)}
          </select>
        </label>
        <label className="text-xs flex flex-col gap-1.5 md:col-span-3">
          <div className="font-bold text-white/40 uppercase">Notitie</div>
          <input value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} className="bg-black/40 border border-white/10 rounded px-3 py-2 text-white focus:border-blue-500/50 outline-none" placeholder="Optionele toelichting..." />
        </label>
        <label className="text-xs flex flex-col gap-1.5">
          <div className="font-bold text-white/40 uppercase">Kleur</div>
          <div className="flex gap-2">
            <input type="color" value={form.color || '#3b82f6'} onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))} className="w-10 h-10 bg-black/40 border border-white/10 rounded p-1 cursor-pointer" />
            <input value={form.color} onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))} className="bg-black/40 border border-white/10 rounded px-3 py-2 text-white text-xs flex-grow font-mono" placeholder="#3b82f6" />
          </div>
        </label>
        <label className="text-xs flex flex-col gap-1.5">
          <div className="font-bold text-white/40 uppercase">Volgorde</div>
          <input type="number" value={form.orderIndex} onChange={(e) => setForm((f) => ({ ...f, orderIndex: Number(e.target.value||0) }))} className="bg-black/40 border border-white/10 rounded px-3 py-2 text-white focus:border-blue-500/50 outline-none" />
        </label>
        <div className="md:col-span-1 flex flex-col gap-1.5">
          <div className="font-bold text-white/40 uppercase text-xs">ID</div>
          <input value={form.id} readOnly className="bg-black/20 border border-white/5 rounded px-3 py-2 text-white/30 text-[10px] font-mono outline-none" />
        </div>

        <label className="text-xs flex flex-col gap-1.5">
          <div className="font-bold text-white/40 uppercase">Begin (optioneel)</div>
          <input type="datetime-local" value={form.timeStart} onChange={(e) => setForm((f) => ({ ...f, timeStart: e.target.value }))} className="bg-black/40 border border-white/10 rounded px-2 py-2 text-white text-[10px] outline-none" />
        </label>
        <label className="text-xs flex flex-col gap-1.5">
          <div className="font-bold text-white/40 uppercase">Einde (optioneel)</div>
          <input type="datetime-local" value={form.timeEnd} onChange={(e) => setForm((f) => ({ ...f, timeEnd: e.target.value }))} className="bg-black/40 border border-white/10 rounded px-2 py-2 text-white text-[10px] outline-none" />
        </label>

        <div className="md:col-span-2 flex items-center gap-4 h-full py-2">
          <label className="text-sm flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={form.isInVenue} onChange={(e) => setForm((f) => ({ ...f, isInVenue: e.target.checked }))} className="rounded border-white/20 bg-black/40 text-blue-600 focus:ring-blue-500/50" />
            <div className="text-white/60 font-medium">Zaal</div>
          </label>
          <label className="text-sm flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={form.isInLivestream} onChange={(e) => setForm((f) => ({ ...f, isInLivestream: e.target.checked }))} className="rounded border-white/20 bg-black/40 text-blue-600 focus:ring-blue-500/50" />
            <div className="text-white/60 font-medium">Stream</div>
          </label>
          <label className="text-sm flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={form.autoAdvance} onChange={(e) => setForm((f) => ({ ...f, autoAdvance: e.target.checked }))} className="rounded border-white/20 bg-black/40 text-orange-600 focus:ring-orange-500/50" />
            <div className="text-orange-400 font-bold">Auto</div>
          </label>
        </div>

        <div className="md:col-span-2 flex flex-col gap-1.5">
          <div className="font-bold text-white/40 uppercase text-xs">Koppel aan item (Parent)</div>
          <select
            value={form.parentId}
            onChange={(e) => setForm((f) => ({ ...f, parentId: e.target.value }))}
            className="bg-black/40 border border-white/10 rounded px-3 py-2 text-white text-xs outline-none focus:border-blue-500/50"
          >
            <option value="">Geen (Hoofdlijn)</option>
            {data.items?.map(it => (
              <option key={it.id} value={it.id}>
                {it.cue}: {it.title}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2 flex flex-col gap-1.5">
           <label className="text-xs flex items-center gap-2 cursor-pointer select-none">
             <input type="checkbox" checked={form.isTimeAnchor} onChange={(e) => setForm((f) => ({ ...f, isTimeAnchor: e.target.checked }))} className="rounded border-white/20 bg-black/40 text-purple-600 focus:ring-purple-500/50" />
             <div className="font-bold text-purple-400 uppercase">Tijd anker?</div>
           </label>
           {form.isTimeAnchor && (
             <select
                value={form.anchorType}
                onChange={(e) => setForm((f) => ({ ...f, anchorType: e.target.value }))}
                className="bg-black/40 border border-white/10 rounded px-3 py-2 text-white text-xs outline-none focus:border-purple-500/50"
             >
               <option value="">Kies type...</option>
               <option value="MATCH_START">Start wedstrijd</option>
               <option value="LIVESTREAM_START">Start livestream</option>
             </select>
           )}
        </div>
        <div className="md:col-span-6 space-y-2 mt-2">
          <label className="text-xs text-white/40 uppercase font-bold">Posities (vink aan om toe te wijzen)</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 bg-black/20 p-3 rounded-lg border border-white/5">
            {positions.data?.sort((a: any, b: any) => a.name.localeCompare(b.name)).map((pos: any) => {
              const isSelected = form.positionIds.includes(pos.id);
              return (
                <label
                  key={pos.id}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-blue-600/20 border border-blue-500/50 text-white'
                      : 'bg-white/5 border border-transparent text-white/40 hover:bg-white/10'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => togglePositionInForm(pos.id)}
                    className="w-4 h-4 rounded border-white/20 bg-black/40 text-blue-600 focus:ring-blue-500/50"
                  />
                  <span className="text-xs font-medium truncate">{pos.name}</span>
                </label>
              );
            })}
          </div>
        </div>
        <div className="md:col-span-6 pt-2">
          <button type="submit" className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold transition-colors" disabled={createItem.isPending}>
            + Item toevoegen aan callsheet
          </button>
        </div>
      </form>
    </div>
  );
}
