import {Link, useNavigate} from 'react-router-dom';
import {
  useProductionInterviews,
  useProductionPersonPositions,
  useProductions,
  useProductionTiming
} from '../hooks/useProductions';
import ProductionHeader from '../components/ProductionHeader';
import {MdEdit} from 'react-icons/md';
import {createUrl} from "../lib/api";
import React from "react";

export default function ActiveProductionPage() {
  const { data, isLoading, error } = useProductions();
  const navigate = useNavigate();

  const active = data?.items.find((p) => p.isActive);
  const timing = useProductionTiming(active?.id || 0);
  const positions = useProductionPersonPositions(active?.id || 0);
  const interviews = useProductionInterviews(active?.id || 0);

  if (isLoading) return <div className="container py-6 text-gray-800 dark:text-gray-100">Laden…</div>;
  if (error) return <div className="container py-6 text-red-700">{String((error as any)?.message || error)}</div>;
  if (!active) return <div className="container py-6 text-gray-800 dark:text-gray-100">Geen actieve productie. Ga naar <Link className="underline" to="/admin/productions">Productions</Link>.</div>;

  // Group positions by person
  const groupedPositions = positions.data?.reduce((acc, curr) => {
    const personId = curr.personId;
    if (!acc[personId]) {
      acc[personId] = {
        person: curr.person,
        positions: []
      };
    }
    acc[personId].positions.push(curr.position);
    return acc;
  }, {} as Record<number, { person: any, positions: any[] }>) || {};

  const allCrew = Object.values(groupedPositions).sort((a, b) => a.person.name.localeCompare(b.person.name));

  // Split into Studio (on_stream) and Crew (others)
  const studioCrew: typeof allCrew = [];
  const otherCrew: typeof allCrew = [];

  allCrew.forEach(item => {
    // Check if ANY of the assigned positions has skill type 'on_stream'
    const isStudio = item.positions.some((pos: any) => pos.skill?.type === 'on_stream');
    if (isStudio) {
      studioCrew.push(item);
    } else {
      otherCrew.push(item);
    }
  });

  // Calculate start time and gathering time
  const startTime = active.liveTime ? new Date(active.liveTime) : null;
  const gatheringTime = startTime ? new Date(startTime.getTime() - 30 * 60000) : null;

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

      {/* Match header with logos and start time (reused component) */}
      <ProductionHeader productionId={active.id} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        {/* Left Column: Timings & Crew */}
        <div className="space-y-6">
          {/* Timings */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 font-semibold">
              Tijdschema
            </div>
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {/* Gathering Time */}
              {gatheringTime && (
                <div className="p-3 flex items-center justify-between bg-yellow-50 dark:bg-yellow-900/10">
                  <div className="font-medium text-yellow-800 dark:text-yellow-200">Verzamelen</div>
                  <div className="text-sm font-semibold text-yellow-800 dark:text-yellow-200">
                    {gatheringTime.toLocaleTimeString('nl-NL', {hour: '2-digit', minute:'2-digit', hour12: false})}
                  </div>
                </div>
              )}

              {/* Start Time */}
              {startTime && (
                <div className="p-3 flex items-center justify-between bg-green-50 dark:bg-green-900/10">
                  <div className="font-medium text-green-800 dark:text-green-200">Start Productie</div>
                  <div className="text-sm font-semibold text-green-800 dark:text-green-200">
                    {startTime.toLocaleTimeString('nl-NL', {hour: '2-digit', minute:'2-digit', hour12: false})}
                  </div>
                </div>
              )}

              {timing.data?.map((s) => (
                <div key={s.id} className="p-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <div>
                    <div className="font-medium">{s.volgorde}. {s.naam}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {s.start ? new Date(s.start).toLocaleTimeString('nl-NL', {hour: '2-digit', minute:'2-digit', hour12: false}) : '--:--'} - {s.end ? new Date(s.end).toLocaleTimeString('nl-NL', {hour: '2-digit', minute:'2-digit', hour12: false}) : '--:--'}
                      <span className="ml-2 text-xs bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-gray-600 dark:text-gray-300">{s.duurInMinuten} min</span>
                    </div>
                  </div>
                  {s.isTimeAnchor && (
                    <span className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 px-2 py-1 rounded-full font-medium">
                      Anchor
                    </span>
                  )}
                </div>
              ))}
              {!timing.data?.length && (
                <div className="p-4 text-gray-500 text-center italic">Geen segmenten gevonden</div>
              )}
            </div>
          </div>

          {/* Studio Bezetting (On Stream) */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 font-semibold">
              Studio Bezetting
            </div>
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {studioCrew.map((item: any) => (
                <div key={item.person.id} className="p-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <div className="font-medium">{item.person.name}</div>
                  <div className="flex flex-wrap gap-1 justify-end max-w-[60%]">
                    {item.positions.map((pos: any) => (
                      <span key={pos.id} className="text-xs bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300 border border-purple-100 dark:border-purple-800 px-2 py-0.5 rounded">
                        {pos.name}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
              {studioCrew.length === 0 && (
                <div className="p-4 text-gray-500 text-center italic">Geen studio crew toegewezen</div>
              )}
            </div>
          </div>

          {/* Crew Bezetting (Overig) */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 font-semibold">
              Crew Bezetting
            </div>
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {otherCrew.map((item: any) => (
                <div key={item.person.id} className="p-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <div className="font-medium">{item.person.name}</div>
                  <div className="flex flex-wrap gap-1 justify-end max-w-[60%]">
                    {item.positions.map((pos: any) => (
                      <span key={pos.id} className="text-xs bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300 border border-blue-100 dark:border-blue-800 px-2 py-0.5 rounded">
                        {pos.name}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
              {otherCrew.length === 0 && (
                <div className="p-4 text-gray-500 text-center italic">Geen overige crew toegewezen</div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Interviews */}
        <div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 font-semibold">
              Interviews
            </div>
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {interviews.data?.map((interview) => (
                <div key={interview.id} className="p-2 flex items-center gap-4 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  {/* Player Photo Placeholder or Image if available */}
                  <div className="w-32 h-32 overflow-hidden rounded-full mb-3 bg-gray-100 dark:bg-gray-700 relative">
                    {interview.player?.photoUrl ? (
                      <img
                        src={createUrl(`/uploads/${interview.player?.photoUrl}`).toString()}
                        alt={interview.player?.name}
                        className="w-full h-full object-cover scale-150 origin-top" onError={(e) => ((e.currentTarget.style.display = 'none'))}
                        style={{objectPosition: 'center top', aspectRatio: '1'}}
                      />
                    ) : (
                      <span className="text-xl font-bold text-gray-400 dark:text-gray-500">
                         {interview.player?.name?.charAt(0) || '?'}
                       </span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-lg truncate">{interview.player?.name || 'Onbekend'}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        interview.side === 'HOME'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                          : interview.side === 'AWAY'
                          ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                      }`}>
                        {interview.side === 'HOME' ? 'THUIS' : interview.side === 'AWAY' ? 'UIT' : '-'}
                      </span>
                      <span>{interview.role === 'PLAYER' ? 'Speler' : 'Coach'}</span>
                      {interview.role === 'PLAYER' && (
                         <span className="text-gray-400">• rugnummer: {interview.player.shirtNo}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {!interviews.data?.length && (
                <div className="p-4 text-gray-500 text-center italic">Geen interviews gepland</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
