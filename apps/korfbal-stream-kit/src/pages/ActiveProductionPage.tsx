import {Link} from 'react-router-dom';
import {useProductionCrew, useProductionInterviews, useProductions, useProductionTiming} from '../hooks/useProductions';
import ProductionHeader from '../components/ProductionHeader';
import {MdAnchor, MdEdit} from 'react-icons/md';
import {PositionCategory} from "../hooks/usePositions";
import PlayerCard from "../components/PlayerCard";

const categoryLabels: Record<PositionCategory, string> = {
  [PositionCategory.GENERAL]: 'Algemeen',
  [PositionCategory.TECHNICAL]: 'Techniek',
  [PositionCategory.ENTERTAINMENT]: 'Entertainment',
};

export default function ActiveProductionPage() {
  const { data, isLoading, error } = useProductions();

  const active = data?.items.find((p) => p.isActive);
  const timing = useProductionTiming(active?.id || 0);
  const crew = useProductionCrew(active?.id || 0);
  const interviews = useProductionInterviews(active?.id || 0);

  if (isLoading) return <div className="container py-6 text-gray-800 dark:text-gray-100">Laden…</div>;
  if (error) return <div className="container py-6 text-red-700">{String((error as any)?.message || error)}</div>;
  if (!active) return <div className="container py-6 text-gray-800 dark:text-gray-100">Geen actieve productie. Ga naar <Link className="underline" to="/admin/productions">Productions</Link>.</div>;

  const gatheringTime = active.liveTime ? new Date(new Date(active.liveTime).getTime() - 30 * 60000) : null;
  const totalDuration = (timing.data || []).reduce((sum, s) => sum + s.duurInMinuten, 0);
  const endLiveTime = active.liveTime ? new Date(new Date(active.liveTime).getTime() + totalDuration * 60000) : null;

  return (
    <div className="container py-6 text-gray-800 dark:text-gray-100">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Actieve productie #{active.id}</h1>
        <div className="flex gap-2">
          <Link
            to={`/admin/productions/${active.id}`}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 text-sm font-medium"
          >
            <MdEdit className="w-4 h-4" />
            Bewerken
          </Link>
          <Link className="underline" to={`/admin/productions/${active.id}/callsheets`}>Callsheet</Link>
        </div>
      </div>

      <ProductionHeader productionId={active.id} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <div className="space-y-6">
          {/* Timings */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 font-semibold">
              Tijdschema
            </div>
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {gatheringTime && (
                <div className="p-3 flex items-center justify-between bg-yellow-50 dark:bg-yellow-900/10">
                  <div className="font-medium text-yellow-800 dark:text-yellow-200">Verzamelen</div>
                  <div className="text-sm font-semibold text-yellow-800 dark:text-yellow-200">
                    {gatheringTime.toLocaleTimeString('nl-NL', {hour: '2-digit', minute:'2-digit', hour12: false})}
                  </div>
                </div>
              )}
              {timing.data?.map((s) => (
                <div key={s.id} className="p-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <div>
                    <div className="font-medium flex items-center gap-2">
                      {s.volgorde}. {s.naam}
                      {s.isTimeAnchor && <MdAnchor className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">{s.duurInMinuten} min</div>
                  </div>
                  <div className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                    {s.start ? new Date(s.start).toLocaleTimeString('nl-NL', {hour: '2-digit', minute:'2-digit', hour12: false}) : '--:--'}
                  </div>
                </div>
              ))}
              {endLiveTime && (
                <div className="p-3 flex items-center justify-between bg-blue-50 dark:bg-blue-900/10 border-t border-blue-100 dark:border-blue-900/30">
                  <div className="font-bold text-blue-800 dark:text-blue-200 uppercase text-xs tracking-wider">Einde Livestream</div>
                  <div className="text-sm font-black text-blue-800 dark:text-blue-200">
                    {endLiveTime.toLocaleTimeString('nl-NL', {hour: '2-digit', minute:'2-digit', hour12: false})}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Crew Sections */}
          {Object.entries(crew.data || {}).map(([category, members]) => (
            <div key={category} className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 font-semibold">
                {categoryLabels[category as PositionCategory] || 'Crew'}
              </div>
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {members.map((item) => (
                  <div key={item.person.id} className="p-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <div className="font-medium">{item.person.name}</div>
                    <div className="flex flex-wrap gap-1 justify-end max-w-[60%]">
                      {item.positions.map((pos) => (
                        <span key={pos.id} className="text-xs bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300 border border-blue-100 dark:border-blue-800 px-2 py-0.5 rounded">
                          {pos.name}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
                {members.length === 0 && <div className="p-4 text-gray-500 text-center italic">Geen crew toegewezen</div>}
              </div>
            </div>
          ))}
        </div>

        {/* Right Column: Interviews */}
        <div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 font-semibold">
              Interviews
            </div>
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {interviews.data?.map((interview) => (
                <PlayerCard
                  key={interview.id}
                  name={interview.player?.name || 'Onbekend'}
                  photoUrl={interview.player?.photoUrl}
                  shirtNo={interview.player?.shirtNo}
                  function={interview.role === 'PLAYER' ? 'Speler' : 'Coach'}
                  horizontal
                />
              ))}
              {!interviews.data?.length && <div className="p-8 text-gray-500 text-center italic">Geen interviews gepland</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
