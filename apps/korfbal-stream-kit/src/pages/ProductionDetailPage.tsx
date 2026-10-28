import React from 'react';
import {Link, useNavigate, useParams} from 'react-router-dom';
import {useProduction, useProductionTiming, useUpdateProduction} from '../hooks/useProductions';
import {useCallSheets} from '../hooks/useCallsheet';
import IconButton from '../components/IconButton';
import {MdDownload, MdEdit, MdSave} from 'react-icons/md';
import {CallSheetTemplateSelector} from '../components/CallSheetTemplateSelector';
import {adminPaths} from '../lib/adminPaths';
import TimeInput24 from '../components/TimeInput24';
import {downloadExport} from '../lib/download';
import {atAmsterdamTime, formatTime} from '../lib/time';
import {saveCallSheetAsTemplate} from '../lib/chaptersApi';

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
  const timing = useProductionTiming(id);
  const updateProduction = useUpdateProduction();
  const { data: callSheets, refetch: refetchCallSheets } = useCallSheets(id);
  const [err, setErr] = React.useState<string | null>(null);

  const refetch = async () => {
    await Promise.all([
      refetchProduction(),
      timing.refetch(),
      refetchCallSheets(),
    ]);
  };

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

  /** Opslaan als template: the (first) callsheet with its hoofdstukken as a new draaiboek template */
  const handleSaveAsTemplate = async () => {
    const callSheet = callSheets?.[0];
    if (!callSheet) return;
    const name = window.prompt('Naam voor de nieuwe draaiboek-template:');
    if (!name) return;
    setErr(null);
    try {
      await saveCallSheetAsTemplate(callSheet.id, name);
      alert('Draaiboek-template aangemaakt.');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Opslaan als template mislukt');
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

      {/* The hoofdstukken with their times from the items (openspec/changes/chapters); edited via Bewerk Draaiboek */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <h2 className="font-semibold">Hoofdstukken</h2>
          <div className="flex items-center gap-2">
            <IconButton ariaLabel="Sla het draaiboek op als template" title="Opslaan als template" onClick={handleSaveAsTemplate} disabled={!callSheets?.length}>
              <MdSave className="w-5 h-5 text-blue-600" />
            </IconButton>
          </div>
        </div>
        {timing.isError && (
          <div role="alert" className="mb-2 text-sm text-red-600">{(timing.error as Error)?.message || 'Timing ophalen mislukt'}</div>
        )}
        {timing.data && timing.data.length === 0 && (
          <div className="text-sm text-gray-500">Nog geen hoofdstukken: kies hierboven een draaiboek.</div>
        )}
        {timing.data && timing.data.length > 0 && (
          <table className="min-w-full border border-gray-200 dark:border-gray-800 dark:text-gray-100 text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="text-left p-2 border-b border-gray-200 dark:border-gray-800">Hoofdstuk</th>
                <th className="text-left p-2 border-b border-gray-200 dark:border-gray-800">Start</th>
                <th className="text-left p-2 border-b border-gray-200 dark:border-gray-800">Einde</th>
                <th className="text-left p-2 border-b border-gray-200 dark:border-gray-800">Duur</th>
              </tr>
            </thead>
            <tbody>
              {prod?.liveTime && (
                <tr className="bg-green-50 dark:bg-green-900/20">
                  <td className="p-2 border-b border-gray-200 dark:border-gray-800 font-medium">LIVESTREAM START</td>
                  <td className="p-2 border-b border-gray-200 dark:border-gray-800 font-mono">{timeLocal(prod.liveTime)}</td>
                  <td className="p-2 border-b border-gray-200 dark:border-gray-800 font-mono">{timeLocal(prod.liveTime)}</td>
                  <td className="p-2 border-b border-gray-200 dark:border-gray-800"></td>
                </tr>
              )}
              {timing.data.map((t) => (
                <tr key={t.id}>
                  <td className="p-2 border-b border-gray-200 dark:border-gray-800">{t.naam}</td>
                  <td className="p-2 border-b border-gray-200 dark:border-gray-800 font-mono">{timeLocal(t.start)}</td>
                  <td className="p-2 border-b border-gray-200 dark:border-gray-800 font-mono">{timeLocal(t.end)}</td>
                  <td className="p-2 border-b border-gray-200 dark:border-gray-800">{t.duurInMinuten} min</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
