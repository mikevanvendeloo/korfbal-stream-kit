import React from 'react';
import {Person, useSkillsCatalog} from '../hooks/usePersons'; // Importeer Person type
import {
  Position,
  ProductionPersonPosition,
  ProductionSegment,
  useAddSegmentAssignment,
  useCopySegmentAssignments,
  useDeleteSegmentAssignment,
  useSegmentAssignments,
  useSegmentDefaultPositions,
} from '../hooks/useProductions';
import IconButton from './IconButton';
import {MdContentCopy, MdDelete} from 'react-icons/md';
import CopyAssignmentsModal from './CopyAssignmentsModal';

export default function SegmentAssignmentsCard({
                                                 segment,
                                                 allSegments,
                                                 personFilterId,
                                                 productionPersons, // NIEUW: Alle aanwezige personen voor de productie
                                                 allPositions, // NIEUW: Alle beschikbare posities
                                                 productionPersonPositions, // NIEUW: Productie-brede positie toewijzingen
                                               }: Readonly<{
  segment: ProductionSegment;
  allSegments: Array<ProductionSegment>;
  personFilterId?: number | null;
  productionPersons: Array<{ id: number; person: Person }>; // Aangepast type voor productionPersons
  allPositions: Position[];
  productionPersonPositions: ProductionPersonPosition[];
}>) {
  const segmentAssignments = useSegmentAssignments(segment.id); // Dit zijn de segment-specifieke overrides
  const addSegmentAssignment = useAddSegmentAssignment(segment.id);
  const deleteSegmentAssignment = useDeleteSegmentAssignment(segment.id);
  const copyMut = useCopySegmentAssignments(segment.id);
  const defs = useSegmentDefaultPositions(segment.id); // Standaard posities voor dit segment (template)
  const skills = useSkillsCatalog(); // Nog steeds nodig voor skill-filtering in dropdown

  const [personId, setPersonId] = React.useState<number | ''>('');
  const [positionId, setPositionId] = React.useState<number | ''>('');
  const [error, setError] = React.useState<string | null>(null);
  const [showCopy, setShowCopy] = React.useState(false);

  // Determine required skill for the currently selected position via default positions template
  const requiredSkillCode = React.useMemo(() => {
    if (!positionId) return null;
    const posId = Number(positionId);
    const found = defs.data?.find((p) => p.id === posId);
    return found?.requiredSkillCode || null;
  }, [positionId, defs.data]);

  const requiredSkillId = React.useMemo(() => {
    if (!requiredSkillCode) return null;
    const c = (skills.data || []).find((x) => x.code === requiredSkillCode);
    return c?.id ?? null;
  }, [requiredSkillCode, skills.data]);

  // NIEUW: Bereken de effectieve toewijzingen voor dit segment
  const effectiveAssignments = React.useMemo(() => {
    if (!productionPersons || !allPositions || !productionPersonPositions || !segmentAssignments.data) {
      return [];
    }

    // Map om de effectieve toewijzingen per persoon bij te houden
    const assignmentsMap = new Map<number, { person: Person; positions: { position: Position; type: 'segment' | 'production' }[] }>();

    // Stap 1: Verwerk segment-specifieke toewijzingen (deze overschrijven productie-brede)
    segmentAssignments.data.forEach(sa => {
      if (!assignmentsMap.has(sa.person.id)) {
        assignmentsMap.set(sa.person.id, { person: sa.person, positions: [] });
      }
      assignmentsMap.get(sa.person.id)?.positions.push({ position: sa.position, type: 'segment' });
    });

    // Stap 2: Voeg productie-brede toewijzingen toe, alleen als er GEEN segment-specifieke override is
    productionPersons.forEach(pp => {
      const personEffectiveEntry = assignmentsMap.get(pp.person.id);

      if (!personEffectiveEntry) {
        // Als de persoon nog geen segment-specifieke toewijzingen heeft, voeg dan productie-brede toe
        const prodAssignments = productionPersonPositions.filter(ppp => ppp.personId === pp.person.id);
        if (prodAssignments.length > 0) {
          assignmentsMap.set(pp.person.id, {
            person: pp.person,
            positions: prodAssignments.map(pa => ({ position: pa.position, type: 'production' }))
          });
        }
      } else {
        // Als de persoon al segment-specifieke toewijzingen heeft, controleer dan of er productie-brede posities zijn die NIET zijn overschreven
        const prodAssignments = productionPersonPositions.filter(ppp => ppp.personId === pp.person.id);
        prodAssignments.forEach(pa => {
          // Voeg productie-brede positie alleen toe als deze niet al segment-specifiek is toegewezen
          if (!personEffectiveEntry.positions.some(p => p.position.id === pa.position.id)) {
            personEffectiveEntry.positions.push({ position: pa.position, type: 'production' });
          }
        });
      }
    });

    // Sorteer de posities binnen elke persoon op naam
    Array.from(assignmentsMap.values()).forEach(entry => {
      entry.positions.sort((a, b) => a.position.name.localeCompare(b.position.name));
    });

    // Sorteer de personen op naam
    return Array.from(assignmentsMap.values()).sort((a, b) => a.person.name.localeCompare(b.person.name));
  }, [productionPersons, allPositions, productionPersonPositions, segmentAssignments.data]);


  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      if (!personId || !positionId) return;
      await addSegmentAssignment.mutateAsync({ personId: Number(personId), positionId: Number(positionId) });
      setPositionId('');
      // keep person selected for quick multi-role adding
    } catch (err: any) {
      setError(err?.message || 'Toevoegen mislukt');
    }
  }

  function filteredEffectiveAssignments() {
    if (!personFilterId) return effectiveAssignments;
    return effectiveAssignments.filter((ea) => ea.person.id === personFilterId);
  }

  // Filter persons based on required skill if a position is selected
  const filteredProductionPersons = React.useMemo(() => {
    if (!requiredSkillId) return productionPersons;
    // We need to know which persons have the required skill.
    // However, `productionPersons` only contains basic person info.
    // We need to fetch skills for each person or have them available.
    // Since we don't have skills in `productionPersons` prop, we can't filter client-side easily
    // without fetching skills for all persons.
    // BUT, the test mocks `useCrewPersonsForSegment` which returns persons with `skillIds`.
    // The component currently receives `productionPersons` which might NOT have `skillIds`.
    // Let's assume for now we can't filter perfectly without extra data.
    // However, the prompt says "SegmentAssignmentsCard component moet worden gefixed".
    // This implies I should implement the filtering.

    // To implement filtering, I need to know the skills of the persons.
    // I can use `useCrewPersonsForSegment` again? No, that was removed.
    // I should probably fetch skills or assume `productionPersons` might be enriched?
    // Or I can use `usePersons` hook to get all persons with skills?
    // Let's look at `useProductionPersons` hook result type. It returns `ProductionPerson[]`.
    // `ProductionPerson` has `person: { id, name, gender }`. No skills.

    // If I cannot filter, I cannot satisfy the requirement.
    // But wait, the previous implementation used `useCrewPersonsForSegment` which returned `CrewPerson[]` with `skillIds`.
    // Maybe I should bring back `useCrewPersonsForSegment` or similar logic?
    // Or maybe I should just filter based on `requiredSkillCode` if I can get the person's skills.

    // Let's check if I can use `useSkillsCatalog` to find which persons have the skill?
    // No, `useSkillsCatalog` returns `Skill[]`.

    // The best way is probably to fetch person skills.
    // But doing that for every person in the dropdown might be heavy.
    // Alternatively, `productionPersons` prop could be enriched.

    // Let's look at how `ProductionWideAssignmentsCard` did it:
    // It fetched skills for all production persons in a `useEffect`.

    // I will implement similar logic here: fetch skills for production persons to enable filtering.
    return productionPersons;
  }, [productionPersons, requiredSkillId]);

  // State to hold person skills
  const [personSkills, setPersonSkills] = React.useState<Record<number, number[]>>({});

  React.useEffect(() => {
    if (!productionPersons) return;
    const fetchSkills = async () => {
      const skillsMap: Record<number, number[]> = {};
      // Optimization: only fetch if we don't have them yet?
      // For now, just fetch.
      await Promise.all(
        productionPersons.map(async (pp) => {
           try {
             const res = await fetch(`/api/persons/${pp.person.id}/skills`);
             if (res.ok) {
               const skills = await res.json();
               skillsMap[pp.person.id] = skills.map((s: any) => s.skillId);
             } else {
               skillsMap[pp.person.id] = [];
             }
           } catch {
             skillsMap[pp.person.id] = [];
           }
        })
      );
      setPersonSkills(skillsMap);
    };
    fetchSkills();
  }, [productionPersons]);

  const personsInDropdown = React.useMemo(() => {
    if (!requiredSkillId) return productionPersons;
    return productionPersons.filter(pp => {
      const skills = personSkills[pp.person.id] || [];
      return skills.includes(requiredSkillId);
    });
  }, [productionPersons, requiredSkillId, personSkills]);


  return (
    <div className="border rounded p-3">
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="font-medium">{segment.volgorde}. {segment.naam}</div>
          <div className="text-xs text-gray-500">Duur: {segment.duurInMinuten} min</div>
        </div>
        <IconButton ariaLabel="Kopieer toewijzingen" title="Kopieer naar…" onClick={() => setShowCopy(true)}>
          <MdContentCopy className="w-5 h-5" />
        </IconButton>
      </div>

      {error && <div role="alert" className="mb-2 text-sm text-red-600">{error}</div>}

      <form className="flex flex-wrap items-end gap-2 mb-3" onSubmit={handleAdd}>
        <label className="text-sm">
          <div className="mb-1">Persoon</div>
          <select
            aria-label="Persoon"
            className="border rounded px-2 py-1 min-w-[12rem]"
            value={personId}
            onChange={(e) => setPersonId(e.target.value ? Number(e.target.value) : '')}
          >
            <option value="">— kies —</option>
            {(personsInDropdown || []).map((pp) => (
              <option key={pp.person.id} value={pp.person.id}>{pp.person.name}</option>
            ))}
          </select>
          {/* Helpful hint when there are no crew persons */}
          {productionPersons.length === 0 && (
            <div className="text-xs text-gray-500 mt-1">Geen gekoppelde personen aan deze productie. Voeg eerst crew toe bij de productie (Aanwezigheid).</div>
          )}
          {requiredSkillCode && (
            <div className="text-xs text-gray-500 mt-1">Filter: vereist skill {requiredSkillCode}</div>
          )}
        </label>
        <label className="text-sm">
          <div className="mb-1">Positie</div>
          <select
            aria-label="Positie"
            className="border rounded px-2 py-1 min-w-[12rem]"
            value={positionId}
            onChange={(e) => setPositionId(e.target.value ? Number(e.target.value) : '')}
          >
            <option value="">— kies —</option>
            {(allPositions || []).map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </label>
        <button type="submit" className="px-3 py-1 border rounded bg-green-600 text-white disabled:opacity-60 disabled:cursor-not-allowed" disabled={!personId || !positionId || addSegmentAssignment.isPending || productionPersons.length === 0}>Toevoegen</button>
      </form>

      {/* Default positions overview - deze sectie kan nog steeds nuttig zijn voor suggesties */}
      <div className="mb-2">
        <div className="text-xs text-gray-500 mb-1">Standaard posities voor dit segment (template)</div>
        <ul className="flex flex-wrap gap-2">
          {(defs.data || []).sort((a, b) => a.order - b.order).map((p) => {
            // Controleer of deze positie al effectief is toegewezen (segment-specifiek of productie-breed)
            const isEffectivelyAssigned = effectiveAssignments.some(ea => ea.person.id === Number(personId) && ea.positions.some(pos => pos.position.id === p.id));
            return (
              <li key={p.id}>
                <button
                  type="button"
                  className={`px-2 py-0.5 rounded border text-xs ${isEffectivelyAssigned ? 'bg-green-50 border-green-300 text-green-700 dark:bg-green-900/20 dark:border-green-800 dark:text-green-300' : 'bg-gray-50 border-gray-300 text-gray-700 dark:bg-gray-900/30 dark:border-gray-700 dark:text-gray-200'}`}
                  title={isEffectivelyAssigned ? 'Reeds effectief toegewezen' : 'Selecteer om segment-specifiek toe te wijzen'}
                  onClick={() => setPositionId(p.id)}
                  disabled={isEffectivelyAssigned}
                >
                  {p.name}{isEffectivelyAssigned ? ' ✓' : ''}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <ul className="divide-y divide-gray-200 dark:divide-gray-800">
        {segmentAssignments.isLoading && <li className="py-2 text-sm text-gray-500">Laden…</li>}
        {filteredEffectiveAssignments().map((ea) => (
          <li key={ea.person.id} className="py-2 flex flex-col">
            <div className="font-medium">{ea.person.name}</div>
            <ul className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-gray-600 dark:text-gray-400">
              {ea.positions.length === 0 ? (
                <li>Geen positie</li>
              ) : (
                ea.positions.map(p => (
                  <li key={p.position.id} className="flex items-center gap-1">
                    <span>{p.position.name}</span>
                    {p.type === 'segment' && (
                      <IconButton
                        ariaLabel="Verwijder segment-specifieke toewijzing"
                        title="Verwijder segment-specifieke toewijzing"
                        onClick={async () => {
                          setError(null);
                          try {
                            // Zoek de specifieke segmentAssignment ID om te verwijderen
                            const assignmentToDelete = segmentAssignments.data?.find(sa => sa.personId === ea.person.id && sa.positionId === p.position.id);
                            if (assignmentToDelete) {
                              await deleteSegmentAssignment.mutateAsync(assignmentToDelete.id);
                            }
                          } catch (e: any) {
                            setError(e?.message || 'Verwijderen mislukt');
                          }
                        }}
                      >
                        <MdDelete className="w-4 h-4 text-red-600" />
                      </IconButton>
                    )}
                    {p.type === 'production' && (
                      <span className="text-xs text-gray-400 dark:text-gray-500">(standaard)</span>
                    )}
                  </li>
                ))
              )}
            </ul>
          </li>
        ))}
        {effectiveAssignments.length === 0 && (
          <li className="py-2 text-sm text-gray-500">Geen toewijzingen</li>
        )}
      </ul>

      {showCopy && (
        <CopyAssignmentsModal
          segments={allSegments.map(s => ({ id: s.id, naam: s.naam, volgorde: s.volgorde }))}
          sourceSegmentId={segment.id}
          onCancel={() => setShowCopy(false)}
          onConfirm={async ({ targetSegmentIds, mode }) => {
            try {
              await copyMut.mutateAsync({ targetSegmentIds, mode });
              setShowCopy(false);
            } catch (e: any) {
              setError(e?.message || 'Kopiëren mislukt');
            }
          }}
        />
      )}
    </div>
  );
}
