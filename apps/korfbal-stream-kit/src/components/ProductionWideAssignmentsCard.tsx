import React from 'react';
import {
  usePositions,
  useProductionPersonPositions,
  useProductionPersons,
  useUpdateProductionPersonPositions,
} from '../hooks/useProductions';
import MultiSelect from './MultiSelect';

// Component voor productie-brede toewijzingen
export default function ProductionWideAssignmentsCard({ productionId }: { productionId: number }) {
  const { data: productionPersons } = useProductionPersons(productionId);
  const { data: allPositions } = usePositions();
  const { data: productionPersonPositions } = useProductionPersonPositions(productionId);
  const updateProductionPersonPositions = useUpdateProductionPersonPositions(productionId);

  const [error, setError] = React.useState<string | null>(null);
  const [personSkills, setPersonSkills] = React.useState<Record<number, number[]>>({});

  // Fetch skills for all production persons
  React.useEffect(() => {
    if (!productionPersons || productionPersons.length === 0) return;

    const fetchSkills = async () => {
      const skillsMap: Record<number, number[]> = {};
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

  const handlePositionChange = async (personId: number, selectedPositionIds: number[]) => {
    setError(null);
    try {
      await updateProductionPersonPositions.mutateAsync({ personId, positionIds: selectedPositionIds });
    } catch (e: any) {
      setError(e?.message || 'Opslaan mislukt');
    }
  };

  if (!productionPersons || !allPositions || !productionPersonPositions) {
    return <div>Laden productie-brede toewijzingen...</div>;
  }

  return (
    <div className="border rounded p-4 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
      <h2 className="text-lg font-semibold mb-3">Productie-brede Positietoewijzingen</h2>
      {error && (
        <div role="alert" className="mb-3 rounded-md border border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300 px-3 py-2">{error}</div>
      )}
      {productionPersons.length === 0 ? (
        <p className="text-sm text-gray-500">Geen personen aanwezig voor deze productie.</p>
      ) : (
        <ul className="divide-y divide-gray-200 dark:divide-gray-800">
          {productionPersons.map(pp => {
            const assignedPositions = productionPersonPositions.filter(ppp => ppp.personId === pp.person.id);
            const currentSelectedPositionIds = assignedPositions.map(p => p.positionId);

            // Filter positions based on person's skills
            const personSkillIds = personSkills[pp.person.id] || [];
            const availablePositions = allPositions.filter(pos => {
              // If position has no skill requirement, include it
              if (!pos.skill) return true;
              // Otherwise, check if person has the required skill
              return personSkillIds.includes(pos.skill.id);
            });

            const positionOptions = availablePositions.map(pos => ({ label: pos.name, value: pos.id }));

            return (
              <li key={pp.person.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="font-medium w-48">{pp.person.name}</div>
                <div className="flex-grow">
                  <MultiSelect
                    options={positionOptions}
                    value={currentSelectedPositionIds}
                    onChange={(selected: number[]) => handlePositionChange(pp.person.id, selected)}
                    placeholder="Selecteer posities"
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
