import {useState} from "react";
import {createUrl} from "../../lib/api";

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
];

export default function BackupPage() {
  const [loading, setLoading] = useState<string | null>(null);
  const [status, setStatus] = useState<Record<string, string>>({});

  const handleExport = async (entity: Entity) => {
    try {
      setLoading(`export-${entity.id}`);
      const res = await fetch(createUrl(`/api/backup/${entity.endpoint}/export`));
      if (!res.ok) throw new Error('Export mislukt');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${entity.id}-backup-${new Date().toISOString().split('T')[0]}.json`;
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
      <p className="text-gray-500 dark:text-gray-400 mb-8">
        Maak een backup van je gegevens of herstel deze vanuit een eerder opgeslagen bestand.
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
      </div>
    </div>
  );
}
