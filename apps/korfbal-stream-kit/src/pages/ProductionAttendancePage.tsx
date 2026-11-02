import React from 'react';
import {useNavigate, useParams} from 'react-router-dom';
import {
  AttendancePerson,
  Staffing,
  StaffingRole,
  useAddProductionPerson,
  useDeleteProductionPerson,
  useProduction,
  useProductionAttendance,
} from '../hooks/useProductions';
import {MdCheck, MdSave} from 'react-icons/md';
import {adminPaths} from '../lib/adminPaths';
import {groupAttendance, shortfallText} from '../lib/attendance';

function RoleLine({role}: { role: StaffingRole }) {
  const mark = role.met ? '✓' : role.optional ? '–' : '✗';
  const color = role.met
    ? 'text-green-700 dark:text-green-400'
    : role.optional ? 'text-gray-500 dark:text-gray-400' : 'text-red-700 dark:text-red-400';
  return (
    <li data-testid={`staffing-role-${role.key}`} className="min-w-0">
      <div className="flex items-center gap-2 min-w-0">
        <span aria-hidden className={`w-4 text-center font-semibold ${color}`}>{mark}</span>
        <span className="truncate">
          {role.label} {role.filled}/{role.required}
          {role.optional && <span className="text-gray-500 dark:text-gray-400"> (optioneel)</span>}
        </span>
        <span className="sr-only">{role.met ? 'gehaald' : role.optional ? 'niet ingevuld' : 'niet gehaald'}</span>
      </div>
      {role.unknownSkillCodes.length > 0 && (
        <p className="ml-6 text-xs text-amber-700 dark:text-amber-300">
          Vaardigheid {role.unknownSkillCodes.join(', ')} bestaat niet in deze organisatie (Stamgegevens → Skills)
        </p>
      )}
    </li>
  );
}

function StaffingChecklist({staffing}: { staffing: Staffing }) {
  return (
    <section aria-labelledby="minimum-staffing" className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4 mb-6">
      <h2 id="minimum-staffing" className="font-semibold mb-2">Minimale bezetting</h2>
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm mb-3">
        {staffing.roles.map((role) => <RoleLine key={role.key} role={role}/>)}
      </ul>
      <p
        data-testid="staffing-summary"
        role="status"
        className={`rounded-md border px-3 py-2 text-sm font-medium ${
          staffing.met
            ? 'border-green-300 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-900/30 dark:text-green-300'
            : 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
        }`}
      >
        {staffing.met ? 'Minimale bezetting gehaald' : `Minimale bezetting nog niet gehaald: ${shortfallText(staffing.shortfall)}`}
      </p>
    </section>
  );
}

export default function ProductionAttendancePage() {
  const {id} = useParams<{ id: string }>();
  const productionId = Number(id);
  const navigate = useNavigate();

  const {data: production, isLoading: prodLoading} = useProduction(productionId);
  const attendance = useProductionAttendance(productionId);
  const addPerson = useAddProductionPerson(productionId);
  const delPerson = useDeleteProductionPerson(productionId);
  // Presence as just clicked, until the server's answer (and the new minimum staffing) is in
  const [pending, setPending] = React.useState<Map<number, boolean>>(new Map());
  // People unchecked but not yet saved: marking someone absent also removes their positions in this
  // production, so that only happens on Opslaan (Annuleren keeps them present)
  const [toRemove, setToRemove] = React.useState<Set<number>>(new Set());
  const [saving, setSaving] = React.useState(false);
  const isPresent = (p: AttendancePerson) => pending.get(p.id) ?? (p.productionPersonId !== null && !toRemove.has(p.id));

  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [successMsg, setSuccessMsg] = React.useState<string | null>(null);

  const isLoading = prodLoading || attendance.isLoading;
  const persons = attendance.data?.persons ?? [];
  const removals = persons.filter((p) => p.productionPersonId !== null && toRemove.has(p.id));

  async function onTogglePersonPresence(person: AttendancePerson) {
    setErrorMsg(null);
    setSuccessMsg(null);
    if (person.productionPersonId) {
      setToRemove((s) => {
        const next = new Set(s);
        if (!next.delete(person.id)) next.add(person.id);
        return next;
      });
      return;
    }
    setPending((p) => new Map(p).set(person.id, true));
    try {
      await addPerson.mutateAsync({personId: person.id});
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : 'Wijziging mislukt');
    } finally {
      setPending((p) => {
        const next = new Map(p);
        next.delete(person.id);
        return next;
      });
    }
  }

  async function onSave() {
    setErrorMsg(null);
    setSuccessMsg(null);
    setSaving(true);
    try {
      for (const person of removals) {
        await delPerson.mutateAsync(person.productionPersonId as number);
        setToRemove((s) => {
          const next = new Set(s);
          next.delete(person.id);
          return next;
        });
      }
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : 'Opslaan mislukt');
      setSaving(false);
      return;
    }
    setSuccessMsg('Aanwezigheid opgeslagen!');
    setTimeout(() => {
      navigate(adminPaths.production(productionId));
    }, 1000);
  }

  const presentCount = persons.filter(isPresent).length;

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
            {attendance.error && <div className="text-red-600 mb-4">Fout bij laden</div>}
            {attendance.data && <StaffingChecklist staffing={attendance.data.staffing}/>}

            <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6 mb-6">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Vink de personen aan die aanwezig zijn bij deze productie:
              </p>

              {persons.length === 0 && attendance.data && (
                <p className="text-sm text-gray-500">Geen personen beschikbaar</p>
              )}

              {persons.length > 0 && groupAttendance(persons).map(({group, label, persons: members}) => (
                <section key={group} aria-labelledby={`attendance-${group}`} data-testid={`attendance-group-${group}`} className="mb-5 last:mb-0">
                  <h2 id={`attendance-${group}`} className="text-sm font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300 mb-2">
                    {label}{' '}
                    <span className="font-normal normal-case text-gray-500 dark:text-gray-400">
                      ({members.filter(isPresent).length}/{members.length})
                    </span>
                  </h2>
                  {members.length === 0 ? (
                    <p className="text-sm text-gray-500">Geen personen</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {members.map((p) => {
                        const present = isPresent(p);
                        return (
                          <label
                            key={p.id}
                            className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all min-w-0 ${
                              present
                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={present}
                              disabled={pending.has(p.id)}
                              onChange={() => onTogglePersonPresence(p)}
                              className="w-5 h-5 cursor-pointer shrink-0"
                            />
                            <span className={`flex-1 min-w-0 truncate ${present ? 'font-medium' : ''}`}>
                              {p.name}
                            </span>
                            {p.productionPersonId !== null && toRemove.has(p.id) && (
                              <span className="shrink-0 text-xs text-amber-700 dark:text-amber-300">afmelden</span>
                            )}
                          </label>
                        );
                      })}
                    </div>
                  )}
                </section>
              ))}
            </div>

            {removals.length > 0 && (
              <p
                data-testid="attendance-pending-removals"
                className="mb-3 rounded-md border border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300 px-3 py-2 text-sm"
              >
                {removals.length === 1 ? '1 persoon wordt' : `${removals.length} personen worden`} bij <strong>Opslaan</strong> afgemeld;
                hun posities in deze productie worden dan ook weggehaald.
              </p>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={onSave}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 inline-flex items-center gap-2 font-medium"
              >
                <MdSave className="w-5 h-5" />
                Opslaan
              </button>
              <button
                onClick={() => navigate(adminPaths.production(productionId))}
                className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                Annuleren
              </button>
              <div className="flex-1" />
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {presentCount} van {persons.length} aanwezig
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
