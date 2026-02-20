import React from 'react';
import {Link, useParams} from 'react-router-dom';
import {useCrewReport} from '../hooks/useCallsheet';
import {useProductionInterviews, useProduction} from '../hooks/useProductions';
import PlayerCard from '../components/PlayerCard';
import html2canvas from 'html2canvas';
import {MdDownload} from 'react-icons/md';

export default function CrewReportPage() {
  const params = useParams<{ id: string }>();
  const productionId = Number(params.id);
  const { data, isLoading, error } = useCrewReport(productionId);
  const interviews = useProductionInterviews(productionId);
  const production = useProduction(productionId);

  const reportRef = React.useRef<HTMLDivElement>(null);

  if (!productionId) return <div className="container py-6">Invalid production id</div>;
  if (isLoading || interviews.isLoading || production.isLoading) return <div className="container py-6">Laden…</div>;
  if (error) return <div className="container py-6 text-red-700">{String((error as any)?.message || error)}</div>;
  if (!data) return <div className="container py-6">Geen data</div>;

  const handleDownloadPng = async () => {
    if (!reportRef.current) return;
    try {
      const canvas = await html2canvas(reportRef.current, {
        scale: 2, // Higher resolution
        backgroundColor: '#ffffff', // Ensure white background
        useCORS: true, // Allow loading images from other domains (if configured)
      });
      const link = document.createElement('a');
      link.download = `crew-report-${productionId}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('Failed to generate PNG', err);
      alert('Kon PNG niet genereren');
    }
  };

  // Group interviews by side and role
  const homeInterviews = interviews.data?.filter(i => i.side === 'HOME') || [];
  const awayInterviews = interviews.data?.filter(i => i.side === 'AWAY') || [];

  const homePlayers = homeInterviews.filter(i => i.role === 'PLAYER');
  const homeCoaches = homeInterviews.filter(i => i.role === 'COACH');
  const awayPlayers = awayInterviews.filter(i => i.role === 'PLAYER');
  const awayCoaches = awayInterviews.filter(i => i.role === 'COACH');

  const homeTeamName = production.data?.matchSchedule?.homeTeamName || 'Thuis';
  const awayTeamName = production.data?.matchSchedule?.awayTeamName || 'Uit';

  return (
    <div className="container py-6 text-gray-800 dark:text-gray-100">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Crew report</h1>
        <div className="flex gap-2">
          <button
            onClick={handleDownloadPng}
            className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2"
          >
            <MdDownload className="text-lg" />
            <span>Download PNG</span>
          </button>
          <Link className="px-3 py-2 border rounded" to={`/admin/productions/${productionId}`}>Terug naar productie</Link>
        </div>
      </div>

      <div ref={reportRef} className="bg-white dark:bg-gray-900 p-4 rounded-md border border-gray-200 dark:border-gray-800">
        <h2 className="text-lg font-bold mb-4 text-center">Dagbezetting</h2>

        <div className="overflow-auto border rounded-md mb-8">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800">
                <th className="p-2 text-left sticky left-0 bg-gray-50 dark:bg-gray-800 border-b dark:border-gray-700">Segment</th>
                {data.positions.map((pos) => (
                  <th key={pos.id} className="p-2 text-left whitespace-nowrap border-b dark:border-gray-700">{pos.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.segments.map((seg) => (
                <tr key={seg.id} className="border-b dark:border-gray-700">
                  <th className="p-2 text-left sticky left-0 bg-white dark:bg-gray-900 border-r dark:border-gray-700">{seg.volgorde}. {seg.naam}</th>
                  {data.positions.map((pos) => {
                    const names = data.cells
                      .filter((c) => c.segmentId === seg.id && c.positionId === pos.id)
                      .map((c) => c.personName);
                    return (
                      <td key={pos.id} className="p-2 align-top border-r dark:border-gray-700 last:border-r-0">
                        {names.length ? names.join(', ') : <span className="text-gray-400">—</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Interviews Section */}
        {(homeInterviews.length > 0 || awayInterviews.length > 0) && (
          <div className="mt-8">
            <h2 className="text-lg font-bold mb-4 border-b pb-2 dark:border-gray-700">Interviews</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Away Team (First, as requested) */}
              {(awayPlayers.length > 0 || awayCoaches.length > 0) && (
                <div>
                  <h3 className="font-semibold text-md mb-3 text-red-700 dark:text-red-400">{awayTeamName} (UIT)</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Coaches */}
                    <div className="space-y-4">
                      {awayCoaches.map((i) => (
                        <PlayerCard
                          key={i.id}
                          name={i.player?.name || 'Onbekend'}
                          photoUrl={i.player?.image ? `/uploads/players/${i.player.image}` : undefined}
                          function={i.player?.function || 'Coach'}
                        />
                      ))}
                    </div>
                    {/* Players */}
                    <div className="space-y-4">
                      {awayPlayers.map((i) => (
                        <PlayerCard
                          key={i.id}
                          name={i.player?.name || 'Onbekend'}
                          photoUrl={i.player?.image ? `/uploads/players/${i.player.image}` : undefined}
                          // Assuming shirtNo isn't directly on interview object but might be on player object if extended,
                          // currently using function as fallback or empty if not available in this context without extra fetch
                          function={i.player?.function || 'Speler'}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Home Team */}
              {(homePlayers.length > 0 || homeCoaches.length > 0) && (
                <div>
                  <h3 className="font-semibold text-md mb-3 text-green-700 dark:text-green-400">{homeTeamName} (THUIS)</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Coaches */}
                    <div className="space-y-4">
                      {homeCoaches.map((i) => (
                        <PlayerCard
                          key={i.id}
                          name={i.player?.name || 'Onbekend'}
                          photoUrl={i.player?.image ? `/uploads/players/${i.player.image}` : undefined}
                          function={i.player?.function || 'Coach'}
                        />
                      ))}
                    </div>
                    {/* Players */}
                    <div className="space-y-4">
                      {homePlayers.map((i) => (
                        <PlayerCard
                          key={i.id}
                          name={i.player?.name || 'Onbekend'}
                          photoUrl={i.player?.image ? `/uploads/players/${i.player.image}` : undefined}
                          function={i.player?.function || 'Speler'}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
