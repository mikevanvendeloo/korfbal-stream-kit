import {useState} from "react";
import {createUrl} from "../../lib/api";
import {useCurrentOrganization} from "../../components/OrganizationGate";
import {todayAmsterdam} from '../../lib/time';
import {downloadFromApi} from '../../lib/download';

type Entity = {
  id: string;
  label: string;
  endpoint: string;
};

const ENTITIES: Entity[] = [
  { id: 'persons', label: 'Personen', endpoint: 'persons' },
  { id: 'skills', label: 'Vaardigheden (skills)', endpoint: 'skills' },
  { id: 'positions', label: 'Posities', endpoint: 'positions' },
  { id: 'matches', label: 'Wedstrijden', endpoint: 'matches' },
  { id: 'producties', label: 'Producties', endpoint: 'producties' },
  { id: 'clubs', label: 'Clubs', endpoint: 'clubs' },
  { id: 'sponsors', label: 'Sponsors', endpoint: 'sponsors' },
  { id: 'settings', label: 'Instellingen', endpoint: 'settings' },
  { id: 'segment-templates', label: 'Segment templates', endpoint: 'segment-templates' },
];

export default function BackupPage() {
  const [loading, setLoading] = useState<string | null>(null);
  const [status, setStatus] = useState<Record<string, string>>({});
  const {organization} = useCurrentOrganization();
  const organizationName = organization?.name ?? 'de gekozen organisatie';

  const handleExport = async (entity: Entity) => {
    try {
      setLoading(`export-${entity.id}`);
      const res = await fetch(createUrl(`/api/backup/${entity.endpoint}/export`));
      if (!res.ok) throw new Error('Export mislukt');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${entity.id}-backup-${todayAmsterdam()}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setStatus(prev => ({ ...prev, [entity.id]: 'Backup gedownload' }));
    } catch (err: any) {
      setStatus(prev => ({ ...prev, [entity.id]: `Fout bij export: ${err.message}` }));
    } finally {
      setLoading(null);
    }
  };

  const handleImages = async () => {
    try {
      setLoading('images');
      await downloadFromApi(createUrl('/api/backup/images').toString(), `afbeeldingen-${todayAmsterdam()}.zip`);
      setStatus(prev => ({ ...prev, images: 'Afbeeldingen gedownload' }));
    } catch (err: any) {
      setStatus(prev => ({ ...prev, images: `Fout bij downloaden: ${err.message}` }));
    } finally {
      setLoading(null);
    }
  };

  const handleImport = async (entity: Entity, file: File) => {
    try {
      setLoading(`import-${entity.id}`);
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const content = e.target?.result as string;
          const data = JSON.parse(content);

          const res = await fetch(createUrl(`/api/backup/${entity.endpoint}/import`), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
          });

          if (!res.ok) throw new Error('Herstel mislukt');
          const result = await res.json();
          setStatus(prev => ({
            ...prev,
            [entity.id]: `Herstel voltooid: ${result.created} nieuw, ${result.updated} bijgewerkt`
          }));
        } catch (err: any) {
          setStatus(prev => ({ ...prev, [entity.id]: `Fout bij verwerken bestand: ${err.message}` }));
        } finally {
          setLoading(null);
        }
      };
      reader.readAsText(file);
    } catch (err: any) {
      setStatus(prev => ({ ...prev, [entity.id]: `Fout bij herstel: ${err.message}` }));
      setLoading(null);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
      <h2 className="text-xl font-medium text-gray-900 dark:text-gray-100 mb-6">Backup & Herstel (Restore)</h2>
      <p className="text-gray-500 dark:text-gray-400 mb-3">
        Maak een backup van je gegevens of herstel deze vanuit een eerder opgeslagen bestand.
      </p>
      <p className="text-gray-700 dark:text-gray-300 mb-8" data-testid="backup-organization">
        Een backup bevat de gegevens van <strong>{organizationName}</strong>, en een restore zet ze terug in{' '}
        <strong>{organizationName}</strong>: de gegevens van andere organisaties blijven ongemoeid. Ook een oude backup (van
        voor de organisaties) komt in {organizationName}. Uitzondering: <em>Clubs</em> (met spelers) zijn gedeeld door alle
        organisaties. API-sleutels en de wedstrijdimport (adres en token) zitten niet in de backup. Afbeeldingen download je apart.
      </p>

      <div className="space-y-6">
        {ENTITIES.map(entity => (
          <div key={entity.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
            <div className="mb-4 sm:mb-0">
              <h3 className="font-medium text-gray-900 dark:text-gray-100">{entity.label}</h3>
              {status[entity.id] && (
                <p className={`text-sm mt-1 ${status[entity.id].includes('Fout') ? 'text-red-500' : 'text-green-500'}`}>
                  {status[entity.id]}
                </p>
              )}
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => handleExport(entity)}
                disabled={!!loading}
                className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {loading === `export-${entity.id}` ? 'Exporteren...' : 'Backup'}
              </button>

              <label className={`inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 text-xs font-medium rounded-md shadow-sm text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 cursor-pointer focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500 ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                <span>{loading === `import-${entity.id}` ? 'Herstellen...' : 'Restore'}</span>
                <input
                  type="file"
                  className="sr-only"
                  accept=".json"
                  disabled={!!loading}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImport(entity, file);
                    e.target.value = ''; // Reset for same file selection
                  }}
                />
              </label>
            </div>
          </div>
        ))}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
          <div className="mb-4 sm:mb-0 min-w-0">
            <h3 className="font-medium text-gray-900 dark:text-gray-100">Afbeeldingen</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Sponsorlogo's, het logo van {organizationName} en de clublogo's en spelersfoto's die de gegevens gebruiken, als zip:
              pak uit in de map storage/.
            </p>
            {status.images && (
              <p className={`text-sm mt-1 ${status.images.includes('Fout') ? 'text-red-500' : 'text-green-500'}`}>{status.images}</p>
            )}
          </div>
          <button
            onClick={handleImages}
            disabled={!!loading}
            className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {loading === 'images' ? 'Downloaden...' : 'Afbeeldingen downloaden'}
          </button>
        </div>
      </div>
    </div>
  );
}
