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

const SECTION_LABELS: Record<string, string> = {
  OPLOPEN: 'Oplopen',
  WEDSTRIJD: 'Wedstrijd',
  STUDIO: 'Studio',
  COMMENTAAR: 'Commentaar',
  SPEAKER: 'Speaker',
  OVERIG: 'Overig',
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

  // Initialiseer form data wanneer data is geladen
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

  return (
    <div className="container py-6 text-gray-800 dark:text-gray-100">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Livestream Productie Positie Overzicht</h1>
        <div className="flex items-center gap-2">
          <a
            href={getProductionReportPdfUrl(productionId)}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700 flex items-center gap-2"
          >
            <MdPictureAsPdf className="text-lg" />
            <span>PDF</span>
          </a>
          <a
            href={getProductionReportMarkdownUrl(productionId)}
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
        {/* Aanwezigen (read-only, vanuit productie) */}
        {/* Aanwezigen (read-only, vanuit productie) */}
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

        {/* Tijdschema */}
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
                {/* Show Livestream Start if set */}
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
                    <td className="py-2 pr-4">{timeLocal(segment.start)}</td>
                    <td className="py-2 pr-4">{timeLocal(segment.end)}</td>
                    <td className="py-2">{segment.duurInMinuten} min</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="text-sm text-gray-500">Geen tijdschema beschikbaar</div>
          )}
        </div>

        {/* Positie bezetting (read-only, vanuit productie) */}
        <div className="border rounded p-4 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <h2 className="text-lg font-semibold mb-2">Positie bezetting</h2>

          {(() => {
            // Verzamel alle posities uit alle secties
            const allRoles: Array<{ positionName: string; personNames: string[]; isStudio: boolean }> = [];
            Object.values(data.enriched.rolesBySection).forEach((roles) => {
              roles.forEach((role) => {
                const existing = allRoles.find((r) => r.positionName === role.positionName);
                if (existing) {
                  role.personNames.forEach((name) => {
                    if (!existing.personNames.includes(name)) {
                      existing.personNames.push(name);
                    }
                  });
                } else {
                  allRoles.push({ ...role });
                }
              });
            });

            // Splits in Studio en Productie posities op basis van isStudio veld
            const studioRoles = allRoles.filter((r) => r.isStudio);
            const productieRoles = allRoles.filter((r) => !r.isStudio);

            return (
              <div className="grid grid-cols-2 gap-6">
                {/* Studio posities */}
                <div>
                  <h3 className="font-medium text-md mb-3">Studio posities</h3>
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="border-b dark:border-gray-600">
                        <th className="text-left py-2 pr-4 font-medium">Positie</th>
                        <th className="text-left py-2 font-medium">Naam</th>
                      </tr>
                    </thead>
                    <tbody>
                      {studioRoles.length === 0 ? (
                        <tr>
                          <td colSpan={2} className="py-2 text-gray-500 italic">Geen posities toegewezen</td>
                        </tr>
                      ) : (
                        studioRoles.map((role, idx) => (
                          <tr key={idx} className="border-b dark:border-gray-700">
                            <td className="py-2 pr-4">{role.positionName}</td>
                            <td className="py-2">{role.personNames.join(', ')}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Productie posities */}
                <div>
                  <h3 className="font-medium text-md mb-3">Productie posities</h3>
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="border-b dark:border-gray-600">
                        <th className="text-left py-2 pr-4 font-medium">Positie</th>
                        <th className="text-left py-2 font-medium">Naam</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productieRoles.length === 0 ? (
                        <tr>
                          <td colSpan={2} className="py-2 text-gray-500 italic">Geen posities toegewezen</td>
                        </tr>
                      ) : (
                        productieRoles.map((role, idx) => (
                          <tr key={idx} className="border-b dark:border-gray-700">
                            <td className="py-2 pr-4">{role.positionName}</td>
                            <td className="py-2">{role.personNames.join(', ')}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Interview personen (read-only, vanuit productie) - 2 kolommen */}
        <div className="border rounded p-4 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <h2 className="text-lg font-semibold mb-2">Spelers voor interviews</h2>

          {/* Away team - 2 kolommen */}
          {(data.enriched.interviews.away.players.length > 0 || data.enriched.interviews.away.coaches.length > 0) && (
            <div className="mb-4">
              <h3 className="font-medium text-md mb-3">{data.production.awayTeam}:</h3>
              <div className="grid grid-cols-2 gap-6">
                {/* Coach kolom */}
                <div>
                  {data.enriched.interviews.away.coaches.length > 0 && (
                    <PlayerCard
                      name={data.enriched.interviews.away.coaches[0].name}
                      photoUrl={data.enriched.interviews.away.coaches[0].photoUrl}
                      function={data.enriched.interviews.away.coaches[0].function}
                    />
                  )}
                </div>

                {/* Spelers kolom */}
                <div className="space-y-4">
                  {data.enriched.interviews.away.players.length > 0 && (
                    <>
                      {data.enriched.interviews.away.players.map((player) => (
                        <PlayerCard
                          key={player.id}
                          name={player.name}
                          photoUrl={player.photoUrl}
                          shirtNo={player.shirtNo}
                          function={player.function}
                        />
                      ))}
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Home team - 2 kolommen */}
          {(data.enriched.interviews.home.players.length > 0 || data.enriched.interviews.home.coaches.length > 0) && (
            <div className="mb-6">
              <h3 className="font-medium text-md mb-3">{data.production.homeTeam}:</h3>
              <div className="grid grid-cols-2 gap-6">
                {/* Coach kolom */}
                <div>
                  {data.enriched.interviews.home.coaches.length > 0 && (
                    <PlayerCard
                      name={data.enriched.interviews.home.coaches[0].name}
                      photoUrl={data.enriched.interviews.home.coaches[0].photoUrl}
                      function={data.enriched.interviews.home.coaches[0].function}
                    />
                  )}
                </div>

                {/* Spelers kolom */}
                <div className="space-y-4">
                  {data.enriched.interviews.home.players.length > 0 && (
                    <>
                      {data.enriched.interviews.home.players.map((player) => (
                        <PlayerCard
                          key={player.id}
                          name={player.name}
                          photoUrl={player.photoUrl}
                          shirtNo={player.shirtNo}
                          function={player.function}
                        />
                      ))}
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
          {data.enriched.interviews.home.players.length === 0 &&
            data.enriched.interviews.home.coaches.length === 0 &&
            data.enriched.interviews.away.players.length === 0 &&
            data.enriched.interviews.away.coaches.length === 0 && (
              <p className="text-sm text-gray-500">Geen interview personen geselecteerd</p>
            )}
        </div>

        {/* Wedstrijdsponsor (editable, met dropdown) */}
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

        {/* Interview rationale (editable) */}
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

        {/* Remarks (editable) */}
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

        {/* Save button */}
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
