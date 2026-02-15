import React from 'react';
import { useCreatePerson, useDeletePerson, usePersons, useUpdatePerson, Gender, useSkills, useAddSkill, useRemoveSkill, useSkillsCatalog, useAddSkillsBulk } from '../hooks/usePersons';
import PersonsTable from '../components/PersonsTable';
import IconButton from '../components/IconButton';
import { MdDelete, MdEdit, MdAdd, MdDownload, MdUploadFile } from 'react-icons/md';
import { createUrl, extractError } from '../lib/api';
import { useQueryClient } from '@tanstack/react-query';

export default function PersonsAdminPage() {
  const [q, setQ] = React.useState('');
  const [gender, setGender] = React.useState<Gender | undefined>();
  const { data, isLoading, error } = usePersons({ q, gender, page: 1, limit: 50 });
  const create = useCreatePerson();
  const update = useUpdatePerson();
  const del = useDeletePerson();
  const qc = useQueryClient();
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [successMsg, setSuccessMsg] = React.useState<string | null>(null);
  const fileRef = React.useRef<HTMLInputElement | null>(null);

  const [editing, setEditing] = React.useState<{ id?: number; name: string; gender: Gender } | null>(null);
  const [skillsFor, setSkillsFor] = React.useState<number | null>(null);

  const { data: catalog } = useSkillsCatalog();
  // Skills modal (separate)
  const { data: skills } = useSkills(skillsFor || 0);
  const addSkill = useAddSkill(skillsFor || 0);
  const rmSkill = useRemoveSkill(skillsFor || 0);
  const [editingSkill, setEditingSkill] = React.useState<number | null>(null);
  const [selectedSkillId, setSelectedSkillId] = React.useState<number>(0);

  // Inline skills inside the edit/create modal
  const { data: editSkills } = useSkills(editing?.id || 0);
  const addSkillEdit = useAddSkill(editing?.id || 0);
  const rmSkillEdit = useRemoveSkill(editing?.id || 0);
  const bulkAddSkills = useAddSkillsBulk();
  const [newSelectedSkillId, setNewSelectedSkillId] = React.useState<number>(0);
  const [newPendingSkillIds, setNewPendingSkillIds] = React.useState<number[]>([]);

  const selectedPerson = React.useMemo(() => data?.items.find(p => p.id === skillsFor) || null, [data, skillsFor]);
  const displayNameForSkill = React.useCallback((skill: { name: string }) => {
    return skill.name;
  }, []);

  async function onSave() {
    if (!editing) return;
    setErrorMsg(null);
    try {
      if (editing.id) {
        // Update existing person basic fields
        await update.mutateAsync({ id: editing.id, name: editing.name, gender: editing.gender });
      } else {
        // Create new person, then apply any staged skills via React Query hook
        const created = await create.mutateAsync({ name: editing.name, gender: editing.gender });
        if (newPendingSkillIds.length > 0) {
          try {
            await bulkAddSkills.mutateAsync({ personId: created.id, skillIds: newPendingSkillIds });
          } catch (e: any) {
            // Surface error but do not block person creation
            setErrorMsg(e?.message || 'Skill toevoegen mislukt');
          } finally {
            setNewPendingSkillIds([]);
          }
        }
      }
      setEditing(null);
    } catch (e: any) {
      setErrorMsg(e?.message || 'Opslaan mislukt');
    }
  }

  async function onImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const res = await fetch(createUrl('/api/persons/import-json'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(await extractError(res));
      const result = await res.json();
      setSuccessMsg(`Geïmporteerd: ${result.created} nieuw, ${result.updated} bijgewerkt`);
      await qc.invalidateQueries({ queryKey: ['persons'] });
    } catch (e: any) {
      setErrorMsg(e?.message || 'Import mislukt');
    } finally {
      e.target.value = '';
    }
  }

  return (
    <div className="container py-6 text-gray-800 dark:text-gray-100">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Persons</h1>
        <div className="flex items-center gap-2">
          <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={onImport} />
          <button className="px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700 text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800 inline-flex items-center justify-center" title="Import JSON" onClick={() => fileRef.current?.click()}>
            <MdUploadFile className="w-5 h-5" />
            <span className="sr-only">Import</span>
          </button>
          <a href="/api/persons/export-json" download className="px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700 text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800 inline-flex items-center justify-center" title="Export JSON">
            <MdDownload className="w-5 h-5" />
            <span className="sr-only">Export</span>
          </a>
        </div>
      </div>

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
      {successMsg && (
        <div role="status" className="mt-2 rounded-md border border-green-300 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-900/30 dark:text-green-300 px-3 py-2">
          {successMsg}
        </div>
      )}
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
          onManageSkills={(p) => setSkillsFor(p.id)}
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

              {/* Skills inline area */}
              <div className="pt-2 border-t border-gray-200 dark:border-gray-800">
                <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">Skills (optioneel)</div>
                {editing.id ? (
                  // Existing person: operate directly on API
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <select
                        aria-label="Add skill inline"
                        className="px-2 py-1 border rounded bg-white dark:bg-gray-950"
                        value={newSelectedSkillId}
                        onChange={(e) => setNewSelectedSkillId(Number(e.target.value))}
                      >
                        <option value={0}>Kies rol...</option>
                        {catalog?.map((f) => (
                          <option key={f.id} value={f.id}>{f.name}</option>
                        ))}
                      </select>
                      <IconButton
                        ariaLabel="Add skill inline"
                        title="Toevoegen"
                        onClick={async () => {
                          if (editing.id && newSelectedSkillId > 0) {
                            setErrorMsg(null);
                            try {
                              await addSkillEdit.mutateAsync(newSelectedSkillId);
                              setNewSelectedSkillId(0);
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
                      {editSkills?.map((c) => (
                        <li key={c.skillId} className="flex items-center justify-between py-1.5">
                          <div>{c.skill.name}</div>
                          <IconButton ariaLabel="Remove skill inline" title="Verwijder" onClick={async () => {
                            setErrorMsg(null);
                            try { await rmSkillEdit.mutateAsync(c.skillId); } catch (e: any) { setErrorMsg(e?.message || 'Verwijderen mislukt'); }
                          }}>
                            <MdDelete className="w-5 h-5 text-red-600" />
                          </IconButton>
                        </li>
                      ))}
                      {!editSkills || editSkills.length === 0 ? (
                        <li className="text-xs text-gray-500 py-1.5">Geen skills</li>
                      ) : null}
                    </ul>
                  </div>
                ) : (
                  // New person: stage pending skills locally and apply after create
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <select
                        aria-label="Add skill inline"
                        className="px-2 py-1 border rounded bg-white dark:bg-gray-950"
                        value={newSelectedSkillId}
                        onChange={(e) => setNewSelectedSkillId(Number(e.target.value))}
                      >
                        <option value={0}>Kies rol...</option>
                        {catalog?.map((f) => (
                          <option key={f.id} value={f.id}>{f.name}</option>
                        ))}
                      </select>
                      <IconButton
                        ariaLabel="Add skill inline"
                        title="Toevoegen"
                        onClick={() => {
                          if (newSelectedSkillId > 0 && !newPendingSkillIds.includes(newSelectedSkillId)) {
                            setNewPendingSkillIds((prev) => [...prev, newSelectedSkillId]);
                            setNewSelectedSkillId(0);
                          }
                        }}
                      >
                        <MdAdd className="w-5 h-5 text-green-600" />
                      </IconButton>
                    </div>
                    <ul className="divide-y divide-gray-200 dark:divide-gray-800">
                      {newPendingSkillIds.map((id) => {
                        const skill = catalog?.find((c) => c.id === id);
                        if (!skill) return null;
                        return (
                          <li key={id} className="flex items-center justify-between py-1.5">
                            <div>{skill.name}</div>
                            <IconButton ariaLabel="Remove skill inline" title="Verwijder" onClick={() => setNewPendingSkillIds((prev) => prev.filter((x) => x !== id))}>
                              <MdDelete className="w-5 h-5 text-red-600" />
                            </IconButton>
                          </li>
                        );
                      })}
                      {newPendingSkillIds.length === 0 ? (
                        <li className="text-xs text-gray-500 py-1.5">Nog geen skills geselecteerd</li>
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

      {skillsFor && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center" onClick={() => setSkillsFor(null)}>
          <div className="bg-white dark:bg-gray-900 p-4 rounded shadow w-[520px]" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-semibold mb-2">Skills</h2>
            <div className="flex items-center gap-2 mb-3">
              <select
                aria-label="Add skill select"
                autoFocus
                className="px-2 py-1 border rounded bg-white dark:bg-gray-950"
                value={selectedSkillId}
                onChange={(e) => setSelectedSkillId(Number(e.target.value))}
              >
                <option value={0}>Kies rol...</option>
                {catalog?.map((f) => (
                  <option key={f.id} value={f.id}>{displayNameForSkill(f)}</option>
                ))}
              </select>
              <IconButton
                ariaLabel="Add skill"
                title="Toevoegen"
                onClick={async () => {
                  if (selectedSkillId > 0) {
                    try {
                      await addSkill.mutateAsync(selectedSkillId);
                      setSelectedSkillId(0);
                    } catch (e: any) {
                      setErrorMsg(e?.message || 'Toevoegen mislukt');
                    }
                  }
                }}
              >
                <MdAdd className="w-5 h-5 text-green-600" />
              </IconButton>
              <button className="px-3 py-1 border rounded" onClick={() => setSkillsFor(null)}>Sluiten</button>
            </div>
            <ul className="divide-y divide-gray-200 dark:divide-gray-800">
              {skills?.map((c) => (
                <li key={c.skillId} className="flex items-center justify-between py-2 gap-2">
                  <div className="flex items-center gap-2">
                    {editingSkill === c.skillId ? (
                      <select
                        aria-label="Edit skill select"
                        className="px-2 py-1 border rounded bg-white dark:bg-gray-950"
                        defaultValue={c.skillId}
                        onChange={async (e) => {
                          const newId = Number(e.target.value);
                          if (!newId || newId === c.skillId) { setEditingSkill(null); return; }
                          // Replace: add new then remove old
                          try {
                            await addSkill.mutateAsync(newId);
                            await rmSkill.mutateAsync(c.skillId);
                          } catch (e: any) {
                            setErrorMsg(e?.message || 'Wijzigen mislukt');
                          } finally {
                            setEditingSkill(null);
                          }
                        }}
                      >
                        {catalog?.map((f) => (
                          <option key={f.id} value={f.id}>{displayNameForSkill(f)}</option>
                        ))}
                      </select>
                    ) : (
                      <div>{displayNameForSkill(c.skill)}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {editingSkill !== c.skillId && (
                      <IconButton ariaLabel="Edit skill" title="Wijzig" onClick={() => setEditingSkill(c.skillId)}>
                        <MdEdit className="w-5 h-5" />
                      </IconButton>
                    )}
                    <IconButton ariaLabel="Remove skill" title="Verwijder" onClick={async () => {
                      setErrorMsg(null);
                      try {
                        await rmSkill.mutateAsync(c.skillId);
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
