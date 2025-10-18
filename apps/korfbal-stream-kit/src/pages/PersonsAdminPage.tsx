import React from 'react';
import { useCreatePerson, useDeletePerson, usePersons, useUpdatePerson, Gender, useCapabilities, useAddCapability, useRemoveCapability, useCapabilitiesCatalog, useAddCapabilitiesBulk } from '../hooks/usePersons';
import PersonsTable from '../components/PersonsTable';
import IconButton from '../components/IconButton';
import { MdDelete, MdEdit, MdAdd } from 'react-icons/md';

export default function PersonsAdminPage() {
  const [q, setQ] = React.useState('');
  const [gender, setGender] = React.useState<Gender | undefined>();
  const { data, isLoading, error } = usePersons({ q, gender, page: 1, limit: 50 });
  const create = useCreatePerson();
  const update = useUpdatePerson();
  const del = useDeletePerson();
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const [editing, setEditing] = React.useState<{ id?: number; name: string; gender: Gender } | null>(null);
  const [capsFor, setCapsFor] = React.useState<number | null>(null);

  const { data: catalog } = useCapabilitiesCatalog();
  // Capabilities modal (separate)
  const { data: caps } = useCapabilities(capsFor || 0);
  const addCap = useAddCapability(capsFor || 0);
  const rmCap = useRemoveCapability(capsFor || 0);
  const [editingCap, setEditingCap] = React.useState<number | null>(null);
  const [selectedCapId, setSelectedCapId] = React.useState<number>(0);

  // Inline capabilities inside the edit/create modal
  const { data: editCaps } = useCapabilities(editing?.id || 0);
  const addCapEdit = useAddCapability(editing?.id || 0);
  const rmCapEdit = useRemoveCapability(editing?.id || 0);
  const bulkAddCaps = useAddCapabilitiesBulk();
  const [newSelectedCapId, setNewSelectedCapId] = React.useState<number>(0);
  const [newPendingCapIds, setNewPendingCapIds] = React.useState<number[]>([]);

  const selectedPerson = React.useMemo(() => data?.items.find(p => p.id === capsFor) || null, [data, capsFor]);
  const displayNameForCapability = React.useCallback((cap: { nameMale: string; nameFemale: string }) => {
    if (!selectedPerson) return `${cap.nameMale} / ${cap.nameFemale}`;
    return selectedPerson.gender === 'female' ? cap.nameFemale : cap.nameMale;
  }, [selectedPerson]);

  async function onSave() {
    if (!editing) return;
    setErrorMsg(null);
    try {
      if (editing.id) {
        // Update existing person basic fields
        await update.mutateAsync({ id: editing.id, name: editing.name, gender: editing.gender });
      } else {
        // Create new person, then apply any staged capabilities via React Query hook
        const created = await create.mutateAsync({ name: editing.name, gender: editing.gender });
        if (newPendingCapIds.length > 0) {
          try {
            await bulkAddCaps.mutateAsync({ personId: created.id, capabilityIds: newPendingCapIds });
          } catch (e: any) {
            // Surface error but do not block person creation
            setErrorMsg(e?.message || 'Capability toevoegen mislukt');
          } finally {
            setNewPendingCapIds([]);
          }
        }
      }
      setEditing(null);
    } catch (e: any) {
      setErrorMsg(e?.message || 'Opslaan mislukt');
    }
  }

  return (
    <div className="container py-6 text-gray-800 dark:text-gray-100">
      <h1 className="text-xl font-semibold mb-4">Persons</h1>

      <div className="flex items-end gap-2 mb-4">
        <div>
          <label className="block text-xs mb-1">Zoek</label>
          <input value={q} onChange={(e) => setQ(e.target.value)} className="px-2 py-1 border rounded w-64 bg-white dark:bg-gray-950" placeholder="Naam" />
        </div>
        <div>
          <label htmlFor="gender-filter" className="block text-xs mb-1">Geslacht</label>
          <select id="gender-filter" aria-label="Geslacht" value={gender || ''} onChange={(e) => setGender((e.target.value || undefined) as any)} className="px-2 py-1 border rounded bg-white dark:bg-gray-950">
            <option value="">Alle</option>
            <option value="male">Man</option>
            <option value="female">Vrouw</option>
          </select>
        </div>
        <button className="px-3 py-1 border rounded" onClick={() => setEditing({ name: '', gender: 'male' })}>Nieuw persoon</button>
      </div>

      {isLoading && <div>Laden...</div>}
      {error && <div className="text-red-600">Er ging iets mis.</div>}
      {errorMsg && (
        <div role="alert" className="mt-2 rounded-md border border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300 px-3 py-2">
          {errorMsg}
        </div>
      )}
      {data && (
        <PersonsTable
          data={data.items}
          onEdit={(p) => setEditing({ id: p.id, name: p.name, gender: p.gender })}
          onDelete={(p) => {
            setErrorMsg(null);
            del.mutateAsync(p.id).catch((e: any) => setErrorMsg(e?.message || 'Verwijderen mislukt'));
          }}
          onManageCapabilities={(p) => setCapsFor(p.id)}
        />
      )}

      {editing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center">
          <div className="bg-white dark:bg-gray-900 p-4 rounded shadow w-[420px]">
            <h2 className="font-semibold mb-2">{editing.id ? 'Persoon wijzigen' : 'Nieuwe persoon'}</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs mb-1">Naam</label>
                <input autoFocus aria-label="Naam" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="px-2 py-1 border rounded w-full bg-white dark:bg-gray-950" />
              </div>
              <div>
                <label className="block text-xs mb-1">Geslacht</label>
                <select value={editing.gender} onChange={(e) => setEditing({ ...editing, gender: e.target.value as Gender })} className="px-2 py-1 border rounded w-full bg-white dark:bg-gray-950">
                  <option value="male">Man</option>
                  <option value="female">Vrouw</option>
                </select>
              </div>

              {/* Capabilities inline area */}
              <div className="pt-2 border-t border-gray-200 dark:border-gray-800">
                <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">Capabilities (optioneel)</div>
                {editing.id ? (
                  // Existing person: operate directly on API
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <select
                        aria-label="Add capability inline"
                        className="px-2 py-1 border rounded bg-white dark:bg-gray-950"
                        value={newSelectedCapId}
                        onChange={(e) => setNewSelectedCapId(Number(e.target.value))}
                      >
                        <option value={0}>Kies rol...</option>
                        {catalog?.map((f) => (
                          <option key={f.id} value={f.id}>{editing.gender === 'female' ? f.nameFemale : f.nameMale} [{f.code}]</option>
                        ))}
                      </select>
                      <IconButton
                        ariaLabel="Add capability inline"
                        title="Toevoegen"
                        onClick={async () => {
                          if (editing.id && newSelectedCapId > 0) {
                            setErrorMsg(null);
                            try {
                              await addCapEdit.mutateAsync(newSelectedCapId);
                              setNewSelectedCapId(0);
                            } catch (e: any) {
                              setErrorMsg(e?.message || 'Toevoegen mislukt');
                            }
                          }
                        }}
                      >
                        <MdAdd className="w-5 h-5 text-green-600" />
                      </IconButton>
                    </div>
                    <ul className="divide-y divide-gray-200 dark:divide-gray-800">
                      {editCaps?.map((c) => (
                        <li key={c.capabilityId} className="flex items-center justify-between py-1.5">
                          <div>{editing.gender === 'female' ? c.capability.nameFemale : c.capability.nameMale} [{c.capability.code}]</div>
                          <IconButton ariaLabel="Remove capability inline" title="Verwijder" onClick={async () => {
                            setErrorMsg(null);
                            try { await rmCapEdit.mutateAsync(c.capabilityId); } catch (e: any) { setErrorMsg(e?.message || 'Verwijderen mislukt'); }
                          }}>
                            <MdDelete className="w-5 h-5 text-red-600" />
                          </IconButton>
                        </li>
                      ))}
                      {!editCaps || editCaps.length === 0 ? (
                        <li className="text-xs text-gray-500 py-1.5">Geen capabilities</li>
                      ) : null}
                    </ul>
                  </div>
                ) : (
                  // New person: stage pending capabilities locally and apply after create
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <select
                        aria-label="Add capability inline"
                        className="px-2 py-1 border rounded bg-white dark:bg-gray-950"
                        value={newSelectedCapId}
                        onChange={(e) => setNewSelectedCapId(Number(e.target.value))}
                      >
                        <option value={0}>Kies rol...</option>
                        {catalog?.map((f) => (
                          <option key={f.id} value={f.id}>{editing.gender === 'female' ? f.nameFemale : f.nameMale} [{f.code}]</option>
                        ))}
                      </select>
                      <IconButton
                        ariaLabel="Add capability inline"
                        title="Toevoegen"
                        onClick={() => {
                          if (newSelectedCapId > 0 && !newPendingCapIds.includes(newSelectedCapId)) {
                            setNewPendingCapIds((prev) => [...prev, newSelectedCapId]);
                            setNewSelectedCapId(0);
                          }
                        }}
                      >
                        <MdAdd className="w-5 h-5 text-green-600" />
                      </IconButton>
                    </div>
                    <ul className="divide-y divide-gray-200 dark:divide-gray-800">
                      {newPendingCapIds.map((id) => {
                        const cap = catalog?.find((c) => c.id === id);
                        if (!cap) return null;
                        const label = editing.gender === 'female' ? cap.nameFemale : cap.nameMale;
                        return (
                          <li key={id} className="flex items-center justify-between py-1.5">
                            <div>{label} [{cap.code}]</div>
                            <IconButton ariaLabel="Remove capability inline" title="Verwijder" onClick={() => setNewPendingCapIds((prev) => prev.filter((x) => x !== id))}>
                              <MdDelete className="w-5 h-5 text-red-600" />
                            </IconButton>
                          </li>
                        );
                      })}
                      {newPendingCapIds.length === 0 ? (
                        <li className="text-xs text-gray-500 py-1.5">Nog geen capabilities geselecteerd</li>
                      ) : null}
                    </ul>
                  </div>
                )}
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button className="px-3 py-1 border rounded" onClick={() => setEditing(null)}>Annuleren</button>
              <button className="px-3 py-1 border rounded bg-blue-600 text-white" onClick={onSave}>Opslaan</button>
            </div>
          </div>
        </div>
      )}

      {capsFor && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center" onClick={() => setCapsFor(null)}>
          <div className="bg-white dark:bg-gray-900 p-4 rounded shadow w-[520px]" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-semibold mb-2">Capabilities</h2>
            <div className="flex items-center gap-2 mb-3">
              <select
                aria-label="Add capability select"
                autoFocus
                className="px-2 py-1 border rounded bg-white dark:bg-gray-950"
                value={selectedCapId}
                onChange={(e) => setSelectedCapId(Number(e.target.value))}
              >
                <option value={0}>Kies rol...</option>
                {catalog?.map((f) => (
                  <option key={f.id} value={f.id}>{displayNameForCapability(f)} [{f.code}]</option>
                ))}
              </select>
              <IconButton
                ariaLabel="Add capability"
                title="Toevoegen"
                onClick={async () => {
                  if (selectedCapId > 0) {
                    try {
                      await addCap.mutateAsync(selectedCapId);
                      setSelectedCapId(0);
                    } catch (e: any) {
                      setErrorMsg(e?.message || 'Toevoegen mislukt');
                    }
                  }
                }}
              >
                <MdAdd className="w-5 h-5 text-green-600" />
              </IconButton>
              <button className="px-3 py-1 border rounded" onClick={() => setCapsFor(null)}>Sluiten</button>
            </div>
            <ul className="divide-y divide-gray-200 dark:divide-gray-800">
              {caps?.map((c) => (
                <li key={c.capabilityId} className="flex items-center justify-between py-2 gap-2">
                  <div className="flex items-center gap-2">
                    {editingCap === c.capabilityId ? (
                      <select
                        aria-label="Edit capability select"
                        className="px-2 py-1 border rounded bg-white dark:bg-gray-950"
                        defaultValue={c.capabilityId}
                        onChange={async (e) => {
                          const newId = Number(e.target.value);
                          if (!newId || newId === c.capabilityId) { setEditingCap(null); return; }
                          // Replace: add new then remove old
                          try {
                            await addCap.mutateAsync(newId);
                            await rmCap.mutateAsync(c.capabilityId);
                          } catch (e: any) {
                            setErrorMsg(e?.message || 'Wijzigen mislukt');
                          } finally {
                            setEditingCap(null);
                          }
                        }}
                      >
                        {catalog?.map((f) => (
                          <option key={f.id} value={f.id}>{displayNameForCapability(f)} [{f.code}]</option>
                        ))}
                      </select>
                    ) : (
                      <div>{displayNameForCapability(c.capability)} [{c.capability.code}]</div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {editingCap !== c.capabilityId && (
                      <IconButton ariaLabel="Edit capability" title="Wijzig" onClick={() => setEditingCap(c.capabilityId)}>
                        <MdEdit className="w-5 h-5" />
                      </IconButton>
                    )}
                    <IconButton ariaLabel="Remove capability" title="Verwijder" onClick={async () => {
                      setErrorMsg(null);
                      try {
                        await rmCap.mutateAsync(c.capabilityId);
                      } catch (e: any) {
                        setErrorMsg(e?.message || 'Verwijderen mislukt');
                      }
                    }}>
                      <MdDelete className="w-5 h-5 text-red-600" />
                    </IconButton>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
