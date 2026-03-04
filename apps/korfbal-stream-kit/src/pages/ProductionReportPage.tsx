import {useEffect, useState} from 'react';
import {Link, useParams} from 'react-router-dom';
import {
  getProductionReportMarkdownUrl,
  getProductionReportPdfUrl,
  getProductionReportWhatsappUrl,
  useProductionReport,
  useSaveProductionReport,
} from '../hooks/useProductionReport';
import {MdPictureAsPdf} from 'react-icons/md';
import {FaCheck, FaMarkdown, FaWhatsapp} from 'react-icons/fa';
import PlayerCard from '../components/PlayerCard';
import {Club, useClubs} from '../hooks/useClubs';
import ClubLogo from '../components/ClubLogo';
import {useProductionTiming} from '../hooks/useProductions';
import {PositionCategory} from "../hooks/usePositions";

const categoryLabels: Record<PositionCategory, string> = {
  [PositionCategory.ENTERTAINMENT]: 'Entertainment',
  [PositionCategory.GENERAL]: 'Algemeen',
  [PositionCategory.TECHNICAL]: 'Techniek',
};

function normalizeTeamForLookup(name?: string): string | undefined {
  if (!name) return undefined;
  const trimmed = String(name).trim();
  const noNumber = trimmed.replace(/\s+\d+$/g, '');
  const base = noNumber.split('/')[0]?.trim() || noNumber;
  return base.toLowerCase();
}

function matchClub(teamName?: string, list?: Club[]): Club | undefined {
  if (!teamName || !list?.length) return undefined;
  const key = normalizeTeamForLookup(teamName);
  if (!key) return undefined;
  const exactShort = list.find((c) => c.shortName?.toLowerCase() === key);
  if (exactShort) return exactShort;
  const exactName = list.find((c) => c.name?.toLowerCase() === key);
  if (exactName) return exactName;
  const starts = list.find((c) => key && (c.shortName?.toLowerCase().startsWith(key) || c.name?.toLowerCase().startsWith(key)));
  if (starts) return starts;
  return list.find((c) => key && (c.shortName?.toLowerCase().includes(key) || c.name?.toLowerCase().includes(key)));
}

function timeLocal(iso: string) {
  const d = new Date(iso);
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

export default function ProductionReportPage() {
  const params = useParams<{ id: string }>();
  const productionId = Number(params.id);
  const {data, isLoading, error} = useProductionReport(productionId);
  const saveMutation = useSaveProductionReport(productionId);
  const {data: clubs} = useClubs();
  const timing = useProductionTiming(productionId);

  const [matchSponsor, setMatchSponsor] = useState('');
  const [interviewRationale, setInterviewRationale] = useState('');
  const [remarks, setRemarks] = useState('');
  const [whatsappCopied, setWhatsappCopied] = useState(false);

  useEffect(() => {
    if (data?.report) {
      setMatchSponsor(data.report.matchSponsor || '');
      setInterviewRationale(data.report.interviewRationale || '');
      setRemarks(data.report.remarks || '');
    }
  }, [data]);

  if (!productionId) return <div className="container py-6">Invalid production id</div>;
  if (isLoading) return <div className="container py-6">Laden…</div>;
  if (error) return <div className="container py-6 text-red-700">{String((error as any)?.message || error)}</div>;
  if (!data) return <div className="container py-6">Geen data</div>;

  const handleSave = async () => {
    try {
      await saveMutation.mutateAsync({
        matchSponsor: matchSponsor || null,
        interviewRationale: interviewRationale || null,
        remarks: remarks || null,
      });
      alert('Positie overzicht opgeslagen!');
    } catch (err: any) {
      alert('Fout bij opslaan: ' + (err?.message || String(err)));
    }
  };

  const handleCopyWhatsApp = async () => {
    try {
      const response = await fetch(getProductionReportWhatsappUrl(productionId));
      if (!response.ok) throw new Error('Fout bij ophalen WhatsApp tekst');
      const text = await response.text();
      await navigator.clipboard.writeText(text);
      setWhatsappCopied(true);
      setTimeout(() => setWhatsappCopied(false), 2000);
    } catch (err: any) {
      alert('Fout bij kopiëren: ' + (err?.message || String(err)));
    }
  };

  const matchTitle = `${data.production.homeTeam} - ${data.production.awayTeam}`;
  const matchDate = new Date(data.production.date);

  const homeClub = matchClub(data.production.homeTeam, clubs);
  const awayClub = matchClub(data.production.awayTeam, clubs);

  console.log(JSON.stringify(data, null,2));
  const entertainmentRoles = data.enriched?.crewByCategory[PositionCategory.ENTERTAINMENT] || [];
  const technicalRoles = data?.enriched?.crewByCategory[PositionCategory.TECHNICAL] || [];
  const generalRoles = data?.enriched?.crewByCategory[PositionCategory.GENERAL] || [];

  return (
    <div className="container py-6 text-gray-800 dark:text-gray-100">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Livestream Productie Positie Overzicht</h1>
        <div className="flex items-center gap-2">
          <a
            href={getProductionReportPdfUrl(productionId).toString()}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700 flex items-center gap-2"
          >
            <MdPictureAsPdf className="text-lg" />
            <span>PDF</span>
          </a>
          <a
            href={getProductionReportMarkdownUrl(productionId).toString()}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-2 bg-gray-700 text-white rounded hover:bg-gray-800 flex items-center gap-2"
          >
            <FaMarkdown className="text-lg" />
            <span>Markdown</span>
          </a>
          <button
            onClick={handleCopyWhatsApp}
            className="px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 flex items-center gap-2"
          >
            {whatsappCopied ? (
              <>
                <FaCheck className="text-lg" />
                <span>Gekopieerd!</span>
              </>
            ) : (
              <>
                <FaWhatsapp className="text-lg" />
                <span>WhatsApp</span>
              </>
            )}
          </button>
          <Link className="px-3 py-2 border rounded" to={`/admin/productions/${productionId}`}>
            Terug naar productie
          </Link>
        </div>
      </div>

      <div className="mb-4 p-3 border rounded border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-center gap-4 mb-2">
          <ClubLogo
            logoUrl={homeClub?.logoUrl}
            alt={homeClub?.shortName || homeClub?.name || data.production.homeTeam}
            size="medium"
          />
          <div className="font-medium">{matchTitle}</div>
          <ClubLogo
            logoUrl={awayClub?.logoUrl}
            alt={awayClub?.shortName || awayClub?.name || data.production.awayTeam}
            size="medium"
          />
        </div>
        <div className="text-sm text-gray-500 text-center">{matchDate.toLocaleString('nl-NL')}</div>
      </div>

      <div className="space-y-6">
        <div className="border rounded p-4 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <h2 className="text-lg font-semibold mb-2">Aanwezig</h2>
          <div className="text-sm">
            {data.enriched.attendees.length > 0 ? (
              data.enriched.attendees.map((person, index) => (
                <span key={person.name} className={person.isAssigned ? '' : 'italic'}>
                  {person.name}
                  {index < data.enriched.attendees.length - 1 ? ', ' : ''}
                </span>
              ))
            ) : (
              'Geen aanwezigen'
            )}
          </div>
        </div>

        <div className="border rounded p-4 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <h2 className="text-lg font-semibold mb-2">Tijdschema</h2>
          {timing.isLoading && <div className="text-sm text-gray-500">Laden…</div>}
          {timing.data && timing.data.length > 0 ? (
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b dark:border-gray-600">
                  <th className="text-left py-2 pr-4 font-medium">Segment</th>
                  <th className="text-left py-2 pr-4 font-medium">Start</th>
                  <th className="text-left py-2 pr-4 font-medium">Einde</th>
                  <th className="text-left py-2 font-medium">Duur</th>
                </tr>
              </thead>
              <tbody>
                {data.production.liveTime && (
                  <tr className="border-b dark:border-gray-700 bg-green-50 dark:bg-green-900/20">
                    <td className="py-2 pr-4 font-medium">LIVESTREAM START</td>
                    <td className="py-2 pr-4 font-mono">{timeLocal(data.production.liveTime)}</td>
                    <td className="py-2 pr-4 font-mono">{timeLocal(data.production.liveTime)}</td>
                    <td className="py-2">-</td>
                  </tr>
                )}
                {timing.data.map((segment) => (
                  <tr key={segment.id} className="border-b dark:border-gray-700">
                    <td className="py-2 pr-4">{segment.naam}</td>
                    <td className="py-2 pr-4">{timeLocal(segment.start!)}</td>
                    <td className="py-2 pr-4">{timeLocal(segment.end!)}</td>
                    <td className="py-2">{segment.duurInMinuten} min</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="text-sm text-gray-500">Geen tijdschema beschikbaar</div>
          )}
        </div>

        <div className="border rounded p-4 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <h2 className="text-lg font-semibold mb-2">Positie bezetting</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
            <div>
              <h3 className="font-medium text-md mb-2">{categoryLabels.ENTERTAINMENT}</h3>
              {entertainmentRoles.length > 0 ? (
                <ul className="space-y-1 text-sm">
                  {entertainmentRoles.map(role => (
                    <li key={role.positionName} className="flex justify-between">
                      <span>{role.positionName}</span>
                      <span className="font-semibold">{role.personNames.join(', ')}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-500 italic">Geen posities</p>
              )}
            </div>
            <div className="space-y-4">
              <div>
                <h3 className="font-medium text-md mb-2">{categoryLabels.TECHNICAL}</h3>
                {technicalRoles.length > 0 ? (
                  <ul className="space-y-1 text-sm">
                    {technicalRoles.map(role => (
                      <li key={role.positionName} className="flex justify-between">
                        <span>{role.positionName}</span>
                        <span className="font-semibold">{role.personNames.join(', ')}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-500 italic">Geen posities</p>
                )}
              </div>
              <div>
                <h3 className="font-medium text-md mb-2">{categoryLabels.GENERAL}</h3>
                {generalRoles.length > 0 ? (
                  <ul className="space-y-1 text-sm">
                    {generalRoles.map(role => (
                      <li key={role.positionName} className="flex justify-between">
                        <span>{role.positionName}</span>
                        <span className="font-semibold">{role.personNames.join(', ')}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-500 italic">Geen posities</p>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="border rounded p-4 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <h2 className="text-lg font-semibold mb-2">Spelers voor interviews</h2>
          {(data.enriched.interviews.away.players.length > 0 || data.enriched.interviews.away.coaches.length > 0) && (
            <div className="mb-4">
              <h3 className="font-medium text-md mb-3">{data.production.awayTeam}:</h3>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  {data.enriched.interviews.away.coaches.map((player) => (
                    <PlayerCard
                      key={player.id}
                      name={player.name}
                      photoUrl={player.photoUrl}
                      function={player.function}
                    />
                  ))}
                </div>
                <div className="space-y-4">
                  {data.enriched.interviews.away.players.map((player) => (
                    <PlayerCard
                      key={player.id}
                      name={player.name}
                      photoUrl={player.photoUrl}
                      shirtNo={player.shirtNo}
                      function={player.function}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
          {(data.enriched.interviews.home.players.length > 0 || data.enriched.interviews.home.coaches.length > 0) && (
            <div className="mb-6">
              <h3 className="font-medium text-md mb-3">{data.production.homeTeam}:</h3>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  {data.enriched.interviews.home.coaches.map((player) => (
                    <PlayerCard
                      key={player.id}
                      name={player.name}
                      photoUrl={player.photoUrl}
                      function={player.function}
                    />
                  ))}
                </div>
                <div className="space-y-4">
                  {data.enriched.interviews.home.players.map((player) => (
                    <PlayerCard
                      key={player.id}
                      name={player.name}
                      photoUrl={player.photoUrl}
                      shirtNo={player.shirtNo}
                      function={player.function}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="border rounded p-4 dark:border-gray-700">
          <label className="block text-sm font-medium mb-2">Wedstrijdsponsor:</label>
          <div className="flex gap-2">
            <select
              value={matchSponsor}
              onChange={(e) => setMatchSponsor(e.target.value)}
              className="flex-1 px-3 py-2 border rounded dark:bg-gray-900 dark:border-gray-700"
            >
              <option value="">-- Selecteer een sponsor of typ hieronder --</option>
              {data.sponsors.map((sponsor) => (
                <option key={sponsor.id} value={sponsor.name}>
                  {sponsor.name}
                </option>
              ))}
            </select>
          </div>
          <input
            type="text"
            value={matchSponsor}
            onChange={(e) => setMatchSponsor(e.target.value)}
            className="w-full mt-2 px-3 py-2 border rounded dark:bg-gray-900 dark:border-gray-700"
            placeholder="Of typ hier een vrije tekst sponsor naam"
          />
        </div>

        <div className="border rounded p-4 dark:border-gray-700">
          <label className="block text-sm font-medium mb-2">Argumentatie voor spelerkeuze:</label>
          <textarea
            value={interviewRationale}
            onChange={(e) => setInterviewRationale(e.target.value)}
            rows={5}
            className="w-full px-3 py-2 border rounded dark:bg-gray-900 dark:border-gray-700"
            placeholder="Bijv:&#10;• Laura van der Linden&#10;• Nikkie Boerhout, nieuw talent bij Oranje, ontwikkelt zich sterk. (vriendin Tim van Oosten, speler van de maand November)"
          />
        </div>

        <div className="border rounded p-4 dark:border-gray-700">
          <label className="block text-sm font-medium mb-2">Opmerkingen:</label>
          <textarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            rows={5}
            className="w-full px-3 py-2 border rounded dark:bg-gray-900 dark:border-gray-700"
            placeholder="Algemene opmerkingen voor de productie..."
          />
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={handleSave}
            disabled={saveMutation.isPending}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {saveMutation.isPending ? 'Opslaan...' : 'Opslaan'}
          </button>
        </div>

        {saveMutation.isError && (
          <div className="mt-2 text-red-600 text-sm">
            Fout: {(saveMutation.error as any)?.message || String(saveMutation.error)}
          </div>
        )}
      </div>
    </div>
  );
}
