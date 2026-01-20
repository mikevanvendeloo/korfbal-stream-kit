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

const SECTION_LABELS: Record<string, string> = {
  OPLOPEN: 'Oplopen',
  WEDSTRIJD: 'Wedstrijd',
  STUDIO: 'Studio',
  COMMENTAAR: 'Commentaar',
  SPEAKER: 'Speaker',
  OVERIG: 'Overig',
};

export default function ProductionReportPage() {
  const params = useParams<{ id: string }>();
  const productionId = Number(params.id);
  const {data, isLoading, error} = useProductionReport(productionId);
  const saveMutation = useSaveProductionReport(productionId);

  const [matchSponsor, setMatchSponsor] = useState('');
  const [interviewRationale, setInterviewRationale] = useState('');
  const [whatsappCopied, setWhatsappCopied] = useState(false);

  // Initialiseer form data wanneer data is geladen
  useEffect(() => {
    if (data?.report) {
      setMatchSponsor(data.report.matchSponsor || '');
      setInterviewRationale(data.report.interviewRationale || '');
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
        <div className="font-medium">{matchTitle}</div>
        <div className="text-sm text-gray-500">{matchDate.toLocaleString('nl-NL')}</div>
      </div>

      <div className="space-y-6">
        {/* Aanwezigen (read-only, vanuit productie) */}
        <div className="border rounded p-4 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <h2 className="text-lg font-semibold mb-2">Aanwezig</h2>
          <div className="text-sm">
            {data.enriched.attendees.length > 0 ? data.enriched.attendees.join(', ') : 'Geen aanwezigen'}
          </div>
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
                    <div className="space-y-2">
                      <div className="font-medium text-base">
                        {data.enriched.interviews.away.coaches[0].name}
                      </div>
                      {data.enriched.interviews.away.coaches[0].function && (
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {data.enriched.interviews.away.coaches[0].function}
                        </div>
                      )}
                      {data.enriched.interviews.away.coaches[0].photoUrl && (
                        <div className="w-64 h-64 overflow-hidden rounded">
                          <img
                            src={`/uploads/${data.enriched.interviews.away.coaches[0].photoUrl}`}
                            alt={data.enriched.interviews.away.coaches[0].name}
                            className="w-full h-full object-cover scale-125 origin-top"
                            style={{objectPosition: 'center top', aspectRatio: '1'}}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Spelers kolom */}
                <div>
                  {data.enriched.interviews.away.players.length > 0 && (
                    <div className="space-y-4">
                      {data.enriched.interviews.away.players.map((player) => (
                        <div key={player.id} className="space-y-2">
                          <div className="font-medium text-base">
                            {player.name}
                            {player.shirtNo != null && player.shirtNo > 0 && (
                              <span className="text-gray-500"> (#{player.shirtNo})</span>
                            )}
                          </div>
                          {player.function && (
                            <div className="text-sm text-gray-600 dark:text-gray-400">{player.function}</div>
                          )}
                          {player.photoUrl && (
                            <div className="w-64 h-64 overflow-hidden rounded">
                              <img
                                src={`/uploads/${player.photoUrl}`}
                                alt={player.name}
                                className="w-full h-full object-cover scale-125 origin-top"
                                style={{objectPosition: 'center top', aspectRatio: '1'}}
                              />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
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
                    <div className="space-y-2">
                      <div className="font-medium text-base">
                        {data.enriched.interviews.home.coaches[0].name}
                      </div>
                      {data.enriched.interviews.home.coaches[0].function && (
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {data.enriched.interviews.home.coaches[0].function}
                        </div>
                      )}
                      {data.enriched.interviews.home.coaches[0].photoUrl && (
                        <div className="w-64 h-64 overflow-hidden rounded">
                          <img
                            src={`/uploads/${data.enriched.interviews.home.coaches[0].photoUrl}`}
                            alt={data.enriched.interviews.home.coaches[0].name}
                            className="w-full h-full object-cover scale-125 origin-top"
                            style={{objectPosition: 'center top', aspectRatio: '1'}}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Spelers kolom */}
                <div>
                  {data.enriched.interviews.home.players.length > 0 && (
                    <div className="space-y-4">
                      {data.enriched.interviews.home.players.map((player) => (
                        <div key={player.id} className="space-y-2">
                          <div className="font-medium text-base">
                            {player.name}
                            {player.shirtNo != null && player.shirtNo > 0 && (
                              <span className="text-gray-500"> (#{player.shirtNo})</span>
                            )}
                          </div>
                          {player.function && (
                            <div className="text-sm text-gray-600 dark:text-gray-400">{player.function}</div>
                          )}
                          {player.photoUrl && (
                            <div className="w-64 h-64 overflow-hidden rounded">
                              <img
                                src={`/uploads/${player.photoUrl}`}
                                alt={player.name}
                                className="w-full h-full object-cover scale-125 origin-top"
                                style={{ objectPosition: 'center top', aspectRatio: '1'}}
                              />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
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
