import React from 'react';
import {useNavigate, useParams} from 'react-router-dom';
import {
  useAddProductionPerson,
  useDeleteProductionPerson,
  useProduction,
  useProductionPersons,
} from '../hooks/useProductions';
import {usePersons} from '../hooks/usePersons';
import {MdCheck, MdSave} from 'react-icons/md';

export default function ProductionAttendancePage() {
  const {id} = useParams<{ id: string }>();
  const productionId = Number(id);
  const navigate = useNavigate();

  const {data: production, isLoading: prodLoading} = useProduction(productionId);
  const productionPersons = useProductionPersons(productionId);
  const addPerson = useAddProductionPerson(productionId);
  const delPerson = useDeleteProductionPerson(productionId);
  const persons = usePersons({page: 1, limit: 100});

  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [successMsg, setSuccessMsg] = React.useState<string | null>(null);

  async function onTogglePersonPresence(personId: number) {
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const existing = (productionPersons.data || []).find((pp) => pp.personId === personId);
      if (existing) {
        await delPerson.mutateAsync(existing.id);
      } else {
        await addPerson.mutateAsync({personId});
      }
    } catch (e: any) {
      setErrorMsg(e?.message || 'Wijziging mislukt');
    }
  }

  function onSave() {
    setSuccessMsg('Aanwezigheid opgeslagen!');
    setTimeout(() => {
      navigate(`/admin/productions/${productionId}`);
    }, 1000);
  }

  const isLoading = prodLoading || persons.isLoading || productionPersons.isLoading;

  return (
    <div className="container py-6 text-gray-800 dark:text-gray-100">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold mb-2">Aanwezigheid crew</h1>
          {production && (
            <p className="text-gray-600 dark:text-gray-400">
              {production.matchSchedule?.homeTeamName} vs {production.matchSchedule?.awayTeamName}
            </p>
          )}
        </div>

        {errorMsg && (
          <div
            role="alert"
            className="mb-4 rounded-md border border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300 px-4 py-3"
          >
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div
            role="alert"
            className="mb-4 rounded-md border border-green-300 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-900/30 dark:text-green-300 px-4 py-3 flex items-center gap-2"
          >
            <MdCheck className="w-5 h-5" />
            {successMsg}
          </div>
        )}

        {isLoading && <div>Laden…</div>}

        {!isLoading && (
          <>
            <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6 mb-6">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Vink de personen aan die aanwezig zijn bij deze productie:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {(persons.data?.items || []).map((p) => {
                  const isPresent = (productionPersons.data || []).some(
                    (pp) => pp.personId === p.id
                  );
                  return (
                    <label
                      key={p.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                        isPresent
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isPresent}
                        onChange={() => onTogglePersonPresence(p.id)}
                        className="w-5 h-5 cursor-pointer"
                      />
                      <span className={`flex-1 ${isPresent ? 'font-medium' : ''}`}>
                        {p.name}
                      </span>
                    </label>
                  );
                })}
              </div>

              {persons.data && persons.data.items.length === 0 && (
                <p className="text-sm text-gray-500">Geen personen beschikbaar</p>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={onSave}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 inline-flex items-center gap-2 font-medium"
              >
                <MdSave className="w-5 h-5" />
                Opslaan
              </button>
              <button
                onClick={() => navigate(`/admin/productions/${productionId}`)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                Annuleren
              </button>
              <div className="flex-1" />
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {(productionPersons.data || []).length} van {(persons.data?.items || []).length} aanwezig
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
