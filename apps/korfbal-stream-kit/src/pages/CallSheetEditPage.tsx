import React from 'react';
import {Link, useParams} from 'react-router-dom';
import {useCallSheet, useCreateCallSheetItem, useDeleteCallSheetItem, useUpdateCallSheet, useUpdateCallSheetItem} from '../hooks/useCallsheet';
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
      setForm({ id: uuid8(), productionSegmentId: segments.data?.[0]?.id || 0, cue: '', title: '', note: '', color: '', durationSec: 0, timeStart: '', timeEnd: '', orderIndex: 0, positionIds: []});
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

  if (!productionId || !callSheetId) return <div className="container py-6">Invalid ids</div>;
  if (isLoading) return <div className="container py-6">Laden…</div>;
  if (error) return <div className="container py-6 text-red-700">{String((error as any)?.message || error)}</div>;
  if (!data) return <div className="container py-6">Niet gevonden</div>;

  return (
    <div className="container py-6 text-gray-800 dark:text-gray-100">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Callsheet: {data.name}</h1>
        <div className="flex gap-3">
          <Link className="underline" to={`/admin/productions/${productionId}/callsheets`}>Terug</Link>
          <Link className="underline" to={`/admin/productions/${productionId}/crew-report`}>Crew report</Link>
        </div>
      </div>

      <form onSubmit={handleHeaderUpdate} className="mb-6 flex gap-2 items-end">
        <label className="text-sm">
          <div className="mb-1">Naam</div>
          <input name="name" defaultValue={data.name} className="border rounded px-2 py-1" />
        </label>
        <label className="text-sm">
          <div className="mb-1">Kleur</div>
          <input name="color" defaultValue={(data as any).color || ''} className="border rounded px-2 py-1" />
        </label>
        <button type="submit" className="px-3 py-2 rounded bg-blue-600 text-white" disabled={updateCS.isPending}>Opslaan</button>
      </form>

      {err && <div className="mb-4 text-red-700">{err}</div>}

      <h2 className="font-semibold mb-2">Items</h2>
      <div className="border rounded divide-y mb-6">
        {data.items?.map((it) => (
          <div key={it.id} className="p-3 grid grid-cols-1 md:grid-cols-6 gap-2 items-start">
            <div className="text-sm">
              <div className="text-gray-500">ID</div>
              <div className="font-mono">{it.id}</div>
            </div>
            <label className="text-sm">
              <div className="text-gray-500 mb-1">Cue</div>
              <input defaultValue={it.cue} onBlur={(e) => handleItemChange(it.id, { cue: e.target.value })} className="border rounded px-2 py-1 w-full" />
            </label>
            <label className="text-sm md:col-span-2">
              <div className="text-gray-500 mb-1">Titel</div>
              <input defaultValue={it.title} onBlur={(e) => handleItemChange(it.id, { title: e.target.value })} className="border rounded px-2 py-1 w-full" />
            </label>
            <label className="text-sm">
              <div className="text-gray-500 mb-1">Duur (sec)</div>
              <input type="number" defaultValue={it.durationSec} onBlur={(e) => handleItemChange(it.id, { durationSec: Number(e.target.value||0) })} className="border rounded px-2 py-1 w-full" />
            </label>
            <div className="text-right">
              <button className="text-red-700 underline" onClick={() => handleItemDelete(it.id)}>Verwijder</button>
            </div>
            <label className="text-sm md:col-span-2">
              <div className="text-gray-500 mb-1">Notitie</div>
              <textarea defaultValue={(it as any).note || ''} onBlur={(e) => handleItemChange(it.id, { note: e.target.value })} className="border rounded px-2 py-1 w-full" />
            </label>
            <label className="text-sm">
              <div className="text-gray-500 mb-1">Kleur</div>
              <input defaultValue={(it as any).color || ''} onBlur={(e) => handleItemChange(it.id, { color: e.target.value })} className="border rounded px-2 py-1 w-full" />
            </label>
            <label className="text-sm">
              <div className="text-gray-500 mb-1">Segment</div>
              <select defaultValue={it.productionSegmentId} onChange={(e) => handleItemChange(it.id, { productionSegmentId: Number(e.target.value) })} className="border rounded px-2 py-1 w-full">
                {segments.data?.map((s) => <option key={s.id} value={s.id}>{s.volgorde}. {s.naam}</option>)}
              </select>
            </label>
            <label className="text-sm">
              <div className="text-gray-500 mb-1">Posities</div>
              <select multiple defaultValue={(it as any).positionIds || []} onChange={(e) => {
                const vals = Array.from(e.currentTarget.selectedOptions).map((o) => Number(o.value));
                handleItemChange(it.id, { positionIds: vals });
              }} className="border rounded px-2 py-1 w-full min-h-[2.5rem]">
                {positions.data?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
          </div>
        ))}
        {!data.items?.length && (
          <div className="p-3 text-gray-600">Nog geen items</div>
        )}
      </div>

      <h3 className="font-semibold mb-2">Nieuw item</h3>
      <form onSubmit={handleCreateItem} className="grid grid-cols-1 md:grid-cols-6 gap-2 items-end">
        <label className="text-sm">
          <div className="mb-1">ID</div>
          <input value={form.id} onChange={(e) => setForm((f) => ({ ...f, id: e.target.value }))} className="border rounded px-2 py-1" placeholder="0ba22378" />
        </label>
        <label className="text-sm">
          <div className="mb-1">Cue</div>
          <input value={form.cue} onChange={(e) => setForm((f) => ({ ...f, cue: e.target.value.toUpperCase() }))} className="border rounded px-2 py-1" placeholder="FIRST_HALF" />
        </label>
        <label className="text-sm md:col-span-2">
          <div className="mb-1">Titel</div>
          <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} className="border rounded px-2 py-1" />
        </label>
        <label className="text-sm">
          <div className="mb-1">Duur (sec)</div>
          <input type="number" value={form.durationSec} onChange={(e) => setForm((f) => ({ ...f, durationSec: Number(e.target.value||0) }))} className="border rounded px-2 py-1" />
        </label>
        <label className="text-sm">
          <div className="mb-1">Segment</div>
          <select value={form.productionSegmentId} onChange={(e) => setForm((f) => ({ ...f, productionSegmentId: Number(e.target.value) }))} className="border rounded px-2 py-1">
            {segments.data?.map((s) => <option key={s.id} value={s.id}>{s.volgorde}. {s.naam}</option>)}
          </select>
        </label>
        <label className="text-sm md:col-span-2">
          <div className="mb-1">Notitie</div>
          <input value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} className="border rounded px-2 py-1" />
        </label>
        <label className="text-sm">
          <div className="mb-1">Kleur</div>
          <input value={form.color} onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))} className="border rounded px-2 py-1" placeholder="#00ccff" />
        </label>
        <label className="text-sm">
          <div className="mb-1">Begin (optioneel)</div>
          <input type="datetime-local" value={form.timeStart} onChange={(e) => setForm((f) => ({ ...f, timeStart: e.target.value }))} className="border rounded px-2 py-1" />
        </label>
        <label className="text-sm">
          <div className="mb-1">Einde (optioneel)</div>
          <input type="datetime-local" value={form.timeEnd} onChange={(e) => setForm((f) => ({ ...f, timeEnd: e.target.value }))} className="border rounded px-2 py-1" />
        </label>
        <label className="text-sm">
          <div className="mb-1">Volgorde</div>
          <input type="number" value={form.orderIndex} onChange={(e) => setForm((f) => ({ ...f, orderIndex: Number(e.target.value||0) }))} className="border rounded px-2 py-1" />
        </label>
        <label className="text-sm md:col-span-2">
          <div className="mb-1">Posities</div>
          <select multiple value={form.positionIds} onChange={(e) => {
            const vals = Array.from(e.currentTarget.selectedOptions).map((o) => Number(o.value));
            setForm((f) => ({ ...f, positionIds: vals }));
          }} className="border rounded px-2 py-1 min-h-[2.5rem]">
            {positions.data?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <div className="md:col-span-6">
          <button type="submit" className="px-3 py-2 rounded bg-green-600 text-white" disabled={createItem.isPending}>Toevoegen</button>
        </div>
      </form>
    </div>
  );
}
