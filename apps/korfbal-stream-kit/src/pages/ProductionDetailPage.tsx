import React from 'react';
import {Link, useNavigate, useParams} from 'react-router-dom';
import {
  ProductionSegment,
  useCreateSegment,
  useDeleteSegment,
  useProduction,
  useProductionSegments,
  useProductionTiming,
  useUpdateSegment,
} from '../hooks/useProductions';
import SegmentFormModal, {SegmentFormValues} from '../components/SegmentFormModal';
import IconButton from '../components/IconButton';
import {MdAdd, MdAnchor, MdArrowDownward, MdArrowUpward, MdDelete, MdEdit} from 'react-icons/md';
import SegmentAssignmentsCard from '../components/SegmentAssignmentsCard';
import {usePersons} from '../hooks/usePersons';

function timeLocal(iso: string) {
  const d = new Date(iso);
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

function PersonFilterControlInner({ value, onChange, persons }: { value: number | null; onChange: (v: number | null) => void; persons: Array<{ id: number; name: string }>; }) {
  return (
    <label className="text-sm">
      <div className="mb-1">Filter op persoon</div>
      <select
        aria-label="Filter op persoon"
        className="border rounded px-2 py-1 min-w-[12rem]"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
      >
        <option value="">— alle —</option>
        {persons.map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
    </label>
  );
}

export default function ProductionDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const navigate = useNavigate();

  const { data: prod, isError, error } = useProduction(id);
  const segments = useProductionSegments(id);
  const createSeg = useCreateSegment(id);
  const updateSeg = useUpdateSegment();
  const deleteSeg = useDeleteSegment();
  const timing = useProductionTiming(id);
  const [modal, setModal] = React.useState<null | { mode: 'create' | 'edit'; seg?: ProductionSegment }>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const [personFilterId, setPersonFilterId] = React.useState<number | null>(null);
  const personsList = usePersons({ page: 1, limit: 200 });

  async function handleCreate(values: SegmentFormValues) {
    setErr(null);
    try {
      await createSeg.mutateAsync(values);
      setModal(null);
    } catch (e: any) {
      setErr(e?.message || 'Aanmaken mislukt');
    }
  }

  async function handleUpdate(values: SegmentFormValues) {
    if (!modal?.seg) return;
    setErr(null);
    try {
      await updateSeg.mutateAsync({ id: modal.seg.id, ...values });
      setModal(null);
    } catch (e: any) {
      setErr(e?.message || 'Wijzigen mislukt');
    }
  }

  async function handleDelete(seg: ProductionSegment) {
    if (!confirm(`Segment "${seg.naam}" verwijderen?`)) return;
    setErr(null);
    try {
      await deleteSeg.mutateAsync(seg.id);
    } catch (e: any) {
      setErr(e?.message || 'Verwijderen mislukt');
    }
  }

  async function move(seg: ProductionSegment, dir: -1 | 1) {
    if (!segments.data) return;
    const idx = segments.data.findIndex((s) => s.id === seg.id);
    const other = segments.data[idx + dir];
    if (!other) return;
    setErr(null);
    try {
      // Move current segment to the other's position in a single update.
      // Backend will shift neighbors transactionally to maintain unique volgorde.
      await updateSeg.mutateAsync({ id: seg.id, volgorde: other.volgorde });
    } catch (e: any) {
      setErr(e?.message || 'Verplaatsen mislukt');
    }
  }

  async function toggleAnchor(seg: ProductionSegment) {
    setErr(null);
    try {
      await updateSeg.mutateAsync({ id: seg.id, isTimeAnchor: !seg.isTimeAnchor });
    } catch (e: any) {
      setErr(e?.message || 'Anchor wijzigen mislukt');
    }
  }

  if (!Number.isInteger(id) || id <= 0) {
    return (
      <div className="container py-6 text-gray-800 dark:text-gray-100">
        <div>Ongeldige productie id</div>
        <button className="mt-3 px-3 py-1 border rounded" onClick={() => navigate(-1)}>Terug</button>
      </div>
    );
  }

  return (
    <div className="container py-6 text-gray-800 dark:text-gray-100">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-xl font-semibold">Production #{id}</h1>
        <div className="flex items-center gap-2">
          <Link to={`/admin/productions/${id}/crew-report`} className="px-3 py-1 border rounded">Crew report</Link>
          <Link to={`/admin/productions/${id}/callsheets`} className="px-3 py-1 border rounded">Callsheets</Link>
          <Link to="/admin/productions" className="px-3 py-1 border rounded">Terug naar overzicht</Link>
        </div>
      </div>

      {isError && <div role="alert" className="text-red-600">Fout: {(error as any)?.message}</div>}
      {err && (
        <div role="alert" className="mb-3 rounded-md border border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300 px-3 py-2">{err}</div>
      )}

      {/* Match header */}
      {prod && (
        <div className="mb-4 p-3 border rounded border-gray-200 dark:border-gray-800">
          <div className="font-medium">{prod.matchSchedule?.homeTeamName} vs {prod.matchSchedule?.awayTeamName}</div>
          <div className="text-sm text-gray-500">{new Date(prod.matchSchedule?.date).toLocaleString()}</div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Segments column */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold">Segments</h2>
            <button className="px-3 py-1 border rounded inline-flex items-center gap-1" onClick={() => setModal({ mode: 'create' })}>
              <MdAdd /> Nieuw segment
            </button>
          </div>

          <ul className="divide-y divide-gray-200 dark:divide-gray-800">
            {(segments.data || []).map((s, i, arr) => (
              <li key={s.id} className="py-2 flex items-center justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex w-6 justify-center text-xs text-gray-500">{s.volgorde}</span>
                    <span className="font-medium truncate">{s.naam}</span>
                    {s.isTimeAnchor && (
                      <span className="inline-flex items-center text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"><MdAnchor className="w-4 h-4 mr-1"/>Anchor</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500">Duur: {s.duurInMinuten} min</div>
                </div>
                <div className="flex items-center gap-2">
                  <IconButton ariaLabel="Move up" title="Omhoog" onClick={() => move(s, -1)}>
                    <MdArrowUpward className={`w-5 h-5 ${i === 0 ? 'opacity-40' : ''}`} />
                  </IconButton>
                  <IconButton ariaLabel="Move down" title="Omlaag" onClick={() => move(s, +1)}>
                    <MdArrowDownward className={`w-5 h-5 ${i === arr.length - 1 ? 'opacity-40' : ''}`} />
                  </IconButton>
                  <IconButton ariaLabel="Toggle anchor" title="Zet als anchor" onClick={() => toggleAnchor(s)}>
                    <MdAnchor className={`w-5 h-5 ${s.isTimeAnchor ? 'text-blue-600' : ''}`} />
                  </IconButton>
                  <IconButton ariaLabel="Edit segment" title="Wijzig" onClick={() => setModal({ mode: 'edit', seg: s })}>
                    <MdEdit className="w-5 h-5" />
                  </IconButton>
                  <IconButton ariaLabel="Delete segment" title="Verwijder" onClick={() => handleDelete(s)}>
                    <MdDelete className="w-5 h-5 text-red-600" />
                  </IconButton>
                </div>
              </li>
            ))}
            {segments.data && segments.data.length === 0 && (
              <li className="py-2 text-sm text-gray-500">Geen segmenten</li>
            )}
          </ul>
        </div>

        {/* Timing preview */}
        <div>
          <h2 className="font-semibold mb-2">Timing</h2>
          {timing.isError && (
            <div role="alert" className="mb-2 text-sm text-red-600">{(timing.error as any)?.message || 'Timing ophalen mislukt'}</div>
          )}
          {timing.data && timing.data.length === 0 && (
            <div className="text-sm text-gray-500">Geen segmenten</div>
          )}
          {timing.data && timing.data.length > 0 && (
            <table className="min-w-full border border-gray-200 dark:border-gray-800 text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="text-left p-2 border-b border-gray-200 dark:border-gray-800">#</th>
                  <th className="text-left p-2 border-b border-gray-200 dark:border-gray-800">Naam</th>
                  <th className="text-left p-2 border-b border-gray-200 dark:border-gray-800">Start</th>
                  <th className="text-left p-2 border-b border-gray-200 dark:border-gray-800">Einde</th>
                </tr>
              </thead>
              <tbody>
                {timing.data.map((t) => (
                  <tr key={t.id} className={t.isTimeAnchor ? 'bg-blue-50 dark:bg-blue-900/20' : ''}>
                    <td className="p-2 border-b border-gray-200 dark:border-gray-800">{t.volgorde}</td>
                    <td className="p-2 border-b border-gray-200 dark:border-gray-800">{t.naam}{t.isTimeAnchor ? ' (anchor)' : ''}</td>
                    <td className="p-2 border-b border-gray-200 dark:border-gray-800 font-mono">{timeLocal(t.start)}</td>
                    <td className="p-2 border-b border-gray-200 dark:border-gray-800 font-mono">{timeLocal(t.end)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Assignments overview */}
      <div className="mt-8">
        <div className="flex items-end justify-between mb-3">
          <h2 className="font-semibold">Bezetting per segment</h2>
          <PersonFilterControlInner
            value={personFilterId}
            onChange={setPersonFilterId}
            persons={(personsList.data?.items || []).map((p) => ({ id: p.id, name: p.name }))}
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(segments.data || []).map((s) => (
            <SegmentAssignmentsCard key={s.id} segment={s} allSegments={segments.data || []} personFilterId={personFilterId} />
          ))}
          {segments.data && segments.data.length === 0 && (
            <div className="text-sm text-gray-500">Geen segmenten</div>
          )}
        </div>
      </div>

      {modal && (
        <SegmentFormModal
          initial={modal.mode === 'edit' ? { naam: modal.seg?.naam, duurInMinuten: modal.seg!.duurInMinuten, volgorde: modal.seg!.volgorde, isTimeAnchor: modal.seg!.isTimeAnchor } : undefined}
          onCancel={() => setModal(null)}
          onSubmit={modal.mode === 'create' ? handleCreate : handleUpdate}
        />
      )}
    </div>
  );
}
