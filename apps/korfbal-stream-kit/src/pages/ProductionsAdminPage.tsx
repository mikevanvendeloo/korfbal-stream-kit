import React from 'react';

import {
  useActivateProduction,
  useCreateProduction,
  useDeleteProduction,
  useImportProduction,
  useProductionMatches,
  useProductions,
  useUpdateProduction,
} from '../hooks/useProductions';
import IconButton from '../components/IconButton';
import {MdAdd, MdDelete, MdEdit, MdGroups, MdInfo, MdPlayCircle, MdDownload, MdUpload} from 'react-icons/md';
import {createUrl} from '../lib/api';

export default function ProductionsAdminPage() {
  const { data: prods, isLoading, error } = useProductions();
  const matches = useProductionMatches();
  const create = useCreateProduction();
  const update = useUpdateProduction();
  const del = useDeleteProduction();
  const activate = useActivateProduction();
  const importProd = useImportProduction();
  const [selectedProdId, setSelectedProdId] = React.useState<number | null>(null);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState<{ id?: number; matchScheduleId: number } | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  async function onSaveProduction() {
    if (!editing) return;
    setErrorMsg(null);
    try {
      if (editing.id) {
        await update.mutateAsync({ id: editing.id, matchScheduleId: editing.matchScheduleId });
      } else {
        await create.mutateAsync({ matchScheduleId: editing.matchScheduleId });
      }
      setEditing(null);
    } catch (e: any) {
      setErrorMsg(e?.message || 'Opslaan mislukt');
    }
  }

  const handleExport = (id: number) => {
    window.open(createUrl(`/api/production/${id}/export`).toString(), '_blank');
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        await importProd.mutateAsync(json);
        setErrorMsg(null);
        alert('Productie succesvol geïmporteerd!');
      } catch (err: any) {
        setErrorMsg('Import mislukt: ' + (err?.message || 'Ongeldig bestand'));
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="container py-6 text-gray-800 dark:text-gray-100">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-xl font-semibold">Productions</h1>
        <div className="flex gap-2">
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            accept=".json"
            onChange={handleFileChange}
          />
          <button className="px-3 py-1 border rounded inline-flex items-center gap-1" onClick={handleImportClick}>
            <MdUpload /> Importeer
          </button>
          <button className="px-3 py-1 border rounded inline-flex items-center gap-1" onClick={() => setEditing({ matchScheduleId: 0 })}>
            <MdAdd /> Nieuw
          </button>
        </div>
      </div>

      {isLoading && <div>Laden…</div>}
      {error && <div className="text-red-600">Fout bij laden</div>}
      {errorMsg && (
        <div role="alert" className="mt-2 rounded-md border border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300 px-3 py-2">
          {errorMsg}
        </div>
      )}

      <table className="min-w-full border border-gray-200 dark:border-gray-800 text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="text-left p-2 border-b border-gray-200 dark:border-gray-800">ID</th>
                <th className="text-left p-2 border-b border-gray-200 dark:border-gray-800">Match</th>
                <th className="text-left p-2 border-b border-gray-200 dark:border-gray-800">Acties</th>
              </tr>
            </thead>
            <tbody>
              {(prods?.items || []).map((p) => (
                <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-900">
                  <td className="p-2 border-b border-gray-200 dark:border-gray-800">{p.id}</td>
                  <td className="p-2 border-b border-gray-200 dark:border-gray-800">
                    <div className="flex items-center gap-2">
                      {p.isActive ? (
                        <span aria-label="active-badge" className="inline-flex items-center text-xs px-2 py-0.5 rounded bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300">Active</span>
                      ) : null}
                      <a href={`/admin/productions/${p.id}`} className="underline">
                        {p.matchSchedule?.homeTeamName || ''} vs {p.matchSchedule?.awayTeamName || ''}
                      </a>
                    </div>
                  </td>
                  <td className="p-2 border-b border-gray-200 dark:border-gray-800">
                    <div className="flex items-center gap-2">
                      <IconButton ariaLabel="Edit production" title="Wijzig" onClick={() => setEditing({ id: p.id, matchScheduleId: p.matchScheduleId })}>
                        <MdEdit className="w-5 h-5" />
                      </IconButton>
                      <IconButton ariaLabel="Delete production" title="Verwijder" onClick={async () => { setErrorMsg(null); try { await del.mutateAsync(p.id); if (selectedProdId === p.id) setSelectedProdId(null); } catch (e: any) { setErrorMsg(e?.message || 'Verwijderen mislukt'); } }}>
                        <MdDelete className="w-5 h-5 text-red-600" />
                      </IconButton>
                      <IconButton
                        ariaLabel={p.isActive ? 'Production is active' : 'Activeer production'}
                        title={p.isActive ? 'Actief' : 'Activeren'}
                        disabled={!!p.isActive}
                        onClick={async () => {
                          setErrorMsg(null);
                          try {
                            await activate.mutateAsync(p.id);
                          } catch (e: any) {
                            setErrorMsg(e?.message || 'Activeren mislukt');
                          }
                        }}
                      >
                        <MdPlayCircle className="w-6 h-6" />
                      </IconButton>
                      <IconButton
                        ariaLabel="Toon details"
                        title="Details"
                        onClick={() => window.location.href = `/admin/productions/${p.id}`}
                      >
                        <MdInfo className="w-5 h-5" />
                      </IconButton>
                      <IconButton
                        ariaLabel="Aanwezigheid beheren"
                        title="Aanwezigheid"
                        onClick={() => window.location.href = `/admin/productions/${p.id}/attendance`}
                      >
                        <MdGroups className="w-5 h-5" />
                      </IconButton>
                      <IconButton
                        ariaLabel="Exporteer productie"
                        title="Exporteer"
                        onClick={() => handleExport(p.id)}
                      >
                        <MdDownload className="w-5 h-5" />
                      </IconButton>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

      {editing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center">
          <div className="bg-white dark:bg-gray-900 p-4 rounded shadow w-[520px]">
            <h2 className="font-semibold mb-2">{editing.id ? 'Production wijzigen' : 'Nieuwe production'}</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs mb-1">Kies match</label>
                <select autoFocus aria-label="Select match" className="px-2 py-1 border rounded w-full bg-white dark:bg-gray-950" value={editing.matchScheduleId} onChange={(e) => setEditing({ ...editing, matchScheduleId: Number(e.target.value) })}>
                  <option value={0}>Selecteer…</option>
                  {(matches.data?.items || []).map((m) => (
                    <option key={m.id} value={m.id}>{new Date(m.date).toLocaleString()} — {m.homeTeamName} vs {m.awayTeamName}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button className="px-3 py-1 border rounded" onClick={() => setEditing(null)}>Annuleren</button>
              <button className="px-3 py-1 border rounded bg-blue-600 text-white" onClick={onSaveProduction} disabled={!editing.matchScheduleId}>Opslaan</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
