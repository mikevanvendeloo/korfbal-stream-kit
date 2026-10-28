import React from 'react';
import {Link, useNavigate, useParams} from 'react-router-dom';
import {
  ProductionSegment,
  useCreateSegment,
  useDeleteSegment,
  useProduction,
  useProductionSegments,
  useProductionTiming,
  useUpdateProduction,
  useUpdateSegment,
} from '../hooks/useProductions';
import {useCallSheets} from '../hooks/useCallsheet';
import {useSegmentTemplates} from '../hooks/useSegmentTemplates';
import SegmentFormModal, {SegmentFormValues} from '../components/SegmentFormModal';
import IconButton from '../components/IconButton';
import {
  MdAdd,
  MdAnchor,
  MdArrowDownward,
  MdArrowUpward,
  MdDelete,
  MdDownload,
  MdEdit,
  MdSave
} from 'react-icons/md';
import {CallSheetTemplateSelector} from '../components/CallSheetTemplateSelector';
import {SegmentTemplateSelector} from "../components/SegmentTemplateSelector";
import {adminPaths} from '../lib/adminPaths';
import TimeInput24 from '../components/TimeInput24';
import {downloadExport} from '../lib/download';
import {atAmsterdamTime, formatTime} from '../lib/time';

// Amsterdam time, whatever the device's zone
const timeLocal = (iso?: string | null) => formatTime(iso);

/**
 * Opbouw or verzamelen: the production's own time, or empty with the organization's default (from the
 * day planning) as the grey placeholder. Clearing the field brings back the default.
 */
function PlannedTimeField({id, label, own, planned, onCommit}: {
  id: string; label: string; own?: string | null; planned?: string | null; onCommit: (value: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="text-sm font-medium">{label}:</label>
      <TimeInput24 id={id} className="px-2 py-1 border rounded dark:bg-gray-800 dark:border-gray-700 w-20"
                   value={own ? formatTime(own) : ''}
                   placeholder={planned ? formatTime(planned) : ''}
                   title={own ? 'Eigen tijd; maak leeg voor de standaard' : 'Standaard (Instellingen → Club & Teams); vul een tijd in om af te wijken'}
                   onCommit={onCommit}/>
    </div>
  );
}

export default function ProductionDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const navigate = useNavigate();

  const { data: prod, isError, error, refetch: refetchProduction } = useProduction(id);
  const segments = useProductionSegments(id);
  const createSeg = useCreateSegment(id);
  const updateSeg = useUpdateSegment();
  const deleteSeg = useDeleteSegment(id);
  const timing = useProductionTiming(id);
  const updateProduction = useUpdateProduction();
  const { data: callSheets, refetch: refetchCallSheets } = useCallSheets(id);
  const { createTemplateFromProduction } = useSegmentTemplates();
  const [modal, setModal] = React.useState<null | { mode: 'create' | 'edit'; seg?: ProductionSegment }>(null);
  const [err, setErr] = React.useState<string | null>(null);

  const refetch = async () => {
    await Promise.all([
      refetchProduction(),
      segments.refetch(),
      timing.refetch(),
      refetchCallSheets(),
    ]);
  };

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

  async function handleLiveTimeChange(value: string) {
    setErr(null);
    try {
      // The typed time (Amsterdam) on the match's day (in Amsterdam)
      if (!prod?.matchSchedule?.date) return;

      let newLiveTime: string | null = null;
      if (value) {
        newLiveTime = atAmsterdamTime(prod.matchSchedule.date, value);
      }

      await updateProduction.mutateAsync({ id, liveTime: newLiveTime });
    } catch (e: any) {
      setErr(e?.message || 'Opslaan live tijd mislukt');
    }
  }

  /** An own opbouw / verzamel time on the match's day; empty brings back the organization's default. */
  async function handlePlannedTimeChange(field: 'setupTime' | 'crewCallTime', value: string) {
    setErr(null);
    try {
      if (!prod?.matchSchedule?.date) return;
      await updateProduction.mutateAsync({ id, [field]: value ? atAmsterdamTime(prod.matchSchedule.date, value) : null });
    } catch (e: any) {
      setErr(e?.message || 'Opslaan tijd mislukt');
    }
  }

  const handleExport = () => {
    void downloadExport(`/api/production/${id}/export`, `productie-${id}.json`);
  };

  const handleSaveAsTemplate = async () => {
    const name = window.prompt('Naam voor de nieuwe segment template:');
    if (!name) return;
    setErr(null);
    try {
      await createTemplateFromProduction.mutateAsync({ productionId: id, name });
      alert('Segment template succesvol aangemaakt!');
    } catch (e: any) {
      setErr(e?.message || 'Opslaan als template mislukt');
    }
  };

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
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex flex-wrap items-center gap-2">
          {callSheets && callSheets.length > 0 ? (
            <Link
              to={adminPaths.callSheet(id, callSheets[callSheets.length - 1].id)}
              className="px-3 py-1 border rounded flex items-center gap-1 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <MdEdit /> Bewerk Draaiboek
            </Link>
          ) : (
            <span className="px-3 py-1 border rounded text-gray-400 cursor-not-allowed" title="Kies eerst een draaiboek-template hieronder">
              Geen draaiboek actief
            </span>
          )}
          <button onClick={handleExport} className="px-3 py-1 border rounded flex items-center gap-1 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors" title="Exporteer productie">
            <MdDownload /> Exporteer
          </button>
        </div>
      </div>

      {isError && <div role="alert" className="text-red-600">Fout: {(error as any)?.message}</div>}
      {err && (
        <div role="alert" className="mb-3 rounded-md border border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300 px-3 py-2">{err}</div>
      )}

      {/* Match header */}
      {prod && (
        <div className="mb-4 p-3 border rounded border-gray-200 dark:border-gray-800 flex flex-wrap items-center gap-x-6 gap-y-2">
          <div className="flex items-center gap-2">
            <label htmlFor="liveTime" className="text-sm font-medium">Livestream start:</label>
            <TimeInput24
              id="liveTime"
              className="px-2 py-1 border rounded dark:bg-gray-800 dark:border-gray-700"
              value={
                prod.liveTime
                  ? formatTime(prod.liveTime)
                  : (prod.matchSchedule?.date
                      ? formatTime(new Date(prod.matchSchedule.date).getTime() - 5 * 60 * 1000)
                      : '')
              }
              onCommit={handleLiveTimeChange}
            />
          </div>
          <PlannedTimeField id="crewCallTime" label="Verzamelen" own={prod.crewCallTime} planned={prod.planned?.crewCallTime}
                            onCommit={(value) => handlePlannedTimeChange('crewCallTime', value)}/>
          {/* Opbouw counts only for the day's first stream */}
          {(prod.planned?.isFirstOfDay || prod.setupTime) && (
            <PlannedTimeField id="setupTime" label="Opbouw" own={prod.setupTime} planned={prod.planned?.setupTime}
                              onCommit={(value) => handlePlannedTimeChange('setupTime', value)}/>
          )}
        </div>
      )}

      <div className="mb-8 max-w-xl">
        <CallSheetTemplateSelector
          productionId={id}
          currentTemplateId={prod?.callSheetTemplateId}
          onTemplateApplied={refetch}
        />
      </div>


      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Segments column */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold">Segmenten</h2>
            <div className="flex gap-2">
              <IconButton
                ariaLabel="Sla huidige segmenten op als template"
                onClick={handleSaveAsTemplate}
                disabled={createTemplateFromProduction.isPending}
              >
                <MdSave className="w-5 h-5 text-blue-600" />
              </IconButton>
              <SegmentTemplateSelector productionId={id} onTemplateApplied={refetch} />
              <IconButton ariaLabel="Nieuw segment" onClick={() => setModal({ mode: 'create' })}>
                <MdAdd className="w-5 h-5" />
              </IconButton>
            </div>
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
            <table className="min-w-full border border-gray-200 dark:border-gray-800 dark:text-gray-100 text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="text-left p-2 border-b border-gray-200 dark:border-gray-800">#</th>
                  <th className="text-left p-2 border-b border-gray-200 dark:border-gray-800">Naam</th>
                  <th className="text-left p-2 border-b border-gray-200 dark:border-gray-800">Start</th>
                  <th className="text-left p-2 border-b border-gray-200 dark:border-gray-800">Einde</th>
                </tr>
              </thead>
              <tbody>
                {/* Show Livestream Start if set */}
                {prod?.liveTime && (
                  <tr className="bg-green-50 dark:bg-green-900/20">
                    <td className="p-2 border-b border-gray-200 dark:border-gray-800">-</td>
                    <td className="p-2 border-b border-gray-200 dark:border-gray-800 font-medium">LIVESTREAM START</td>
                    <td className="p-2 border-b border-gray-200 dark:border-gray-800 font-mono">{timeLocal(prod.liveTime)}</td>
                    <td className="p-2 border-b border-gray-200 dark:border-gray-800 font-mono">{timeLocal(prod.liveTime)}</td>
                  </tr>
                )}
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
