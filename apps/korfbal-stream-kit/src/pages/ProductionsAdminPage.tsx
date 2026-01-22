import React from 'react';

import {
  useActivateProduction,
  useAddProductionAssignment,
  useCreateProduction,
  useDeleteProduction,
  useDeleteProductionAssignment,
  useProductionAssignments,
  useProductionMatches,
  useProductions,
  useUpdateProduction,
} from '../hooks/useProductions';
import {usePersons, useSkillsCatalog} from '../hooks/usePersons';
import IconButton from '../components/IconButton';
import {MdAdd, MdDelete, MdEdit, MdGroups, MdInfo, MdPlayCircle} from 'react-icons/md';

export default function ProductionsAdminPage() {
  const { data: prods, isLoading, error } = useProductions();
  const matches = useProductionMatches();
  const create = useCreateProduction();
  const update = useUpdateProduction();
  const del = useDeleteProduction();
  const activate = useActivateProduction();

  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState<{ id?: number; matchScheduleId: number } | null>(null);
  const [selectedProdId, setSelectedProdId] = React.useState<number | null>(null);

  const assignments = useProductionAssignments(selectedProdId || 0);
  const addAssign = useAddProductionAssignment(selectedProdId || 0);
  const delAssign = useDeleteProductionAssignment(selectedProdId || 0);

  const persons = usePersons({ page: 1, limit: 100 });
  const skills = useSkillsCatalog();

  const [newPersonId, setNewPersonId] = React.useState<number>(0);
  const [newSkillId, setNewSkillId] = React.useState<number>(0);

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

  async function onAddAssignment() {
    if (!selectedProdId) return;
    setErrorMsg(null);
    try {
      if (newPersonId > 0 && newSkillId > 0) {
        await addAssign.mutateAsync({ personId: newPersonId, skillId: newSkillId });
        setNewPersonId(0);
        setNewSkillId(0);
      }
    } catch (e: any) {
      setErrorMsg(e?.message || 'Toevoegen mislukt');
    }
  }

  return (
    <div className="container py-6 text-gray-800 dark:text-gray-100">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-xl font-semibold">Productions</h1>
        <button className="px-3 py-1 border rounded inline-flex items-center gap-1" onClick={() => setEditing({ matchScheduleId: 0 })}>
          <MdAdd /> Nieuw
        </button>
      </div>

      {isLoading && <div>Laden…</div>}
      {error && <div className="text-red-600">Fout bij laden</div>}
      {errorMsg && (
        <div role="alert" className="mt-2 rounded-md border border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300 px-3 py-2">
          {errorMsg}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
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
                        onClick={() => navigate(`/admin/productions/${p.id}`)}
                      >
                        <MdInfo className="w-5 h-5" />
                      </IconButton>
                      <IconButton
                        ariaLabel="Selecteer crew-paneel"
                        title="Crew"
                        className={selectedProdId === p.id ? 'bg-blue-600 text-white' : ''}
                        onClick={() => setSelectedProdId(p.id)}
                      >
                        <MdGroups className="w-5 h-5" />
                        <span className="sr-only">Crew</span>
                      </IconButton>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Assignments panel */}
        <div>
          <h2 className="font-semibold mb-2">Crew assignments</h2>
          {!selectedProdId && <div className="text-sm text-gray-500">Selecteer een production om crew toe te wijzen</div>}
          {selectedProdId && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-500">Persoon</label>
                <select aria-label="assignment-person" className="px-2 py-1 border rounded bg-white dark:bg-gray-950" value={newPersonId} onChange={(e) => setNewPersonId(Number(e.target.value))}>
                  <option value={0}>Kies persoon…</option>
                  {(persons.data?.items || []).map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <label className="text-xs text-gray-500">Rol</label>
                <select aria-label="assignment-role" className="px-2 py-1 border rounded bg-white dark:bg-gray-950" value={newSkillId} onChange={(e) => setNewSkillId(Number(e.target.value))}>
                  <option value={0}>Kies rol…</option>
                  {(skills.data || []).map((c) => (
                    <option key={c.id} value={c.id}>{c.code}</option>
                  ))}
                </select>
                <button aria-label="add-assignment" className="px-3 py-1 border rounded inline-flex items-center gap-1" onClick={onAddAssignment}>
                  <MdAdd /> Voeg toe
                </button>
              </div>

              <ul className="divide-y divide-gray-200 dark:divide-gray-800">
                {(assignments.data || []).map((a) => (
                  <li key={a.id} className="flex items-center justify-between py-1.5">
                    <div>
                      <span className="font-medium">{a.person.name}</span>
                      <span className="text-gray-500 ml-2">[{a.skill.code}]</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <IconButton ariaLabel="Delete assignment" title="Verwijder" onClick={async () => { setErrorMsg(null); try { await delAssign.mutateAsync(a.id); } catch (e: any) { setErrorMsg(e?.message || 'Verwijderen mislukt'); } }}>
                        <MdDelete className="w-5 h-5 text-red-600" />
                      </IconButton>
                    </div>
                  </li>
                ))}
                {assignments.data && assignments.data.length === 0 ? (
                  <li className="text-xs text-gray-500 py-1.5">Geen toewijzingen</li>
                ) : null}
              </ul>
            </div>
          )}
        </div>
      </div>

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
