import React from 'react';
import {Link, useNavigate, useParams} from 'react-router-dom';
import {
  ProductionSegment,
  useCreateSegment,
  useDeleteSegment,
  useProduction,
  useProductionPersonPositions,
  useProductionPersons,
  useProductionSegments,
  useProductionTiming,
  usePositions,
  useUpdateProductionPersonPositions,
  useUpdateSegment,
  useUpdateProduction,
} from '../hooks/useProductions';
import SegmentFormModal, {SegmentFormValues} from '../components/SegmentFormModal';
import IconButton from '../components/IconButton';
import {MdAdd, MdAnchor, MdArrowDownward, MdArrowUpward, MdDelete, MdEdit, MdGroups} from 'react-icons/md';
import SegmentOverridesManager from '../components/SegmentOverridesManager';
import ProductionHeader from '../components/ProductionHeader';
import MultiSelect from '../components/MultiSelect';

function timeLocal(iso: string) {
  const d = new Date(iso);
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

// Component voor productie-brede toewijzingen
function ProductionWideAssignmentsCard({ productionId }: { productionId: number }) {
  const { data: productionPersons } = useProductionPersons(productionId);
  const { data: allPositions } = usePositions();
  const { data: productionPersonPositions } = useProductionPersonPositions(productionId);
  const updateProductionPersonPositions = useUpdateProductionPersonPositions(productionId);

  const [error, setError] = React.useState<string | null>(null);
  const [personSkills, setPersonSkills] = React.useState<Record<number, number[]>>({});

  // Fetch skills for all production persons
  React.useEffect(() => {
    if (!productionPersons) return;

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
              if (!pos.skillId) return true;
              // Otherwise, check if person has the required skill
              return personSkillIds.includes(pos.skillId);
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


export default function ProductionDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const navigate = useNavigate();

  const { data: prod, isError, error } = useProduction(id);
  const segments = useProductionSegments(id);
  const createSeg = useCreateSegment(id);
  const updateSeg = useUpdateSegment();
  const deleteSeg = useDeleteSegment();
  const timing = useProductionTiming(id);
  const updateProduction = useUpdateProduction();
  const [modal, setModal] = React.useState<null | { mode: 'create' | 'edit'; seg?: ProductionSegment }>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const { data: productionPersonPositions } = useProductionPersonPositions(id);
  const { data: productionPersons } = useProductionPersons(id);
  const { data: allPositions } = usePositions();

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

  async function handleLiveTimeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setErr(null);
    try {
      // Combine date from match with new time
      if (!prod?.matchSchedule?.date) return;

      let newLiveTime: string | null = null;
      if (value) {
        const matchDate = new Date(prod.matchSchedule.date);
        const [hours, minutes] = value.split(':').map(Number);
        const newDate = new Date(matchDate);
        newDate.setHours(hours, minutes, 0, 0);
        newLiveTime = newDate.toISOString();
      }

      await updateProduction.mutateAsync({ id, liveTime: newLiveTime });
    } catch (e: any) {
      setErr(e?.message || 'Opslaan live tijd mislukt');
    }
  }

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
      <ProductionHeader productionId={id} showLogos={false} />
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold">Productiedetails</h1>
        <div className="flex items-center gap-2">
          <Link to={`/admin/productions/${id}/attendance`} className="px-3 py-1 border rounded inline-flex items-center gap-2">
            <MdGroups className="w-5 h-5" />
            <span>Aanwezigheid</span>
          </Link>
          <Link to={`/admin/productions/${id}/titles`} className="px-3 py-1 border rounded" aria-label="vmix-titles-link">vMix titels</Link>
        </div>
      </div>
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-xl font-semibold">Production #{id}</h1>
        <div className="flex items-center gap-2">
          <Link to={`/admin/productions/${id}/crew-report`} className="px-3 py-1 border rounded">Crew report</Link>
          <Link to={`/admin/productions/${id}/production-report`} className="px-3 py-1 border rounded">Productie rapport</Link>
          <Link to={`/admin/productions/${id}/callsheets`} className="px-3 py-1 border rounded">Callsheets</Link>
          <Link to={`/admin/productions/${id}/segment-assignments`} className="px-3 py-1 border rounded">Segment Toewijzingen</Link>
          <Link to="/admin/productions" className="px-3 py-1 border rounded">Terug naar overzicht</Link>
        </div>
      </div>

      {isError && <div role="alert" className="text-red-600">Fout: {(error as any)?.message}</div>}
      {err && (
        <div role="alert" className="mb-3 rounded-md border border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300 px-3 py-2">{err}</div>
      )}

      {/* Match header */}
      {prod && (
        <div className="mb-4 p-3 border rounded border-gray-200 dark:border-gray-800 flex justify-between items-center">
          <div>
            <div className="font-medium">{prod.matchSchedule?.homeTeamName} vs {prod.matchSchedule?.awayTeamName}</div>
            <div className="text-sm text-gray-500">{new Date(prod.matchSchedule?.date).toLocaleString()}</div>
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="liveTime" className="text-sm font-medium">Livestream start:</label>
            <input
              type="time"
              id="liveTime"
              className="px-2 py-1 border rounded dark:bg-gray-800 dark:border-gray-700"
              value={prod.liveTime ? new Date(prod.liveTime).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }) : ''}
              onChange={handleLiveTimeChange}
            />
          </div>
        </div>
      )}

      {/* Productie-brede Positietoewijzingen */}
      <div className="mb-8">
        <ProductionWideAssignmentsCard productionId={id} />
      </div>


      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Segments column */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold">Segments</h2>
            <button className="px-3 py-1 border rounded inline-flex items-center gap-1" onClick={() => setModal({ mode: 'create' })}>
              <MdAdd /> Nieuw segment
            </button>
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

      {/* Segment Overrides Manager */}
      <div className="mt-8">
        <SegmentOverridesManager
          productionId={id}
          segments={segments.data || []}
          productionPersons={productionPersons || []}
          allPositions={allPositions || []}
          productionPersonPositions={productionPersonPositions || []}
        />
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
