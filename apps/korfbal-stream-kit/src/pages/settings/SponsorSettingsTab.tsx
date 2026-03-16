import React, { useEffect, useState } from 'react';
import { getSponsorConfig, setSponsorConfig } from '../../lib/api';
import { ALL_SPONSOR_TYPES, SponsorType } from '../SponsorsPage';

export default function SponsorSettingsTab() {
  const [namesTypes, setNamesTypes] = useState<SponsorType[]>([]);
  const [rowsTypes, setRowsTypes] = useState<SponsorType[]>([]);
  const [slidesTypes, setSlidesTypes] = useState<SponsorType[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      setLoading(true);
      const sponsor = await getSponsorConfig();
      setNamesTypes(sponsor.namesTypes as SponsorType[]);
      setRowsTypes(sponsor.rowsTypes as SponsorType[]);
      setSlidesTypes(sponsor.slidesTypes as SponsorType[] || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);
      await setSponsorConfig({ namesTypes, rowsTypes, slidesTypes });
      setSuccess('Sponsorinstellingen opgeslagen');
    } catch (err: any) {
      setError(err.message || 'Opslaan mislukt');
    } finally {
      setSaving(false);
    }
  }

  const toggleType = (list: SponsorType[], setList: (l: SponsorType[]) => void, type: SponsorType) => {
    if (list.includes(type)) {
      setList(list.filter(t => t !== type));
    } else {
      setList([...list, type]);
    }
  };

  if (loading) return <div className="p-6 text-gray-600 dark:text-gray-300">Laden...</div>;

  return (
    <form onSubmit={handleSave} className="space-y-8">
      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded dark:bg-red-900/30 dark:border-red-800 dark:text-red-300">{error}</div>}
      {success && <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded dark:bg-green-900/30 dark:border-green-800 dark:text-green-300">{success}</div>}

      <section className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4 border-b border-gray-100 dark:border-gray-700 pb-2">Sponsor Configuratie</h2>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">Sponsor Namen (Ticker & Carrousel)</h3>
            <div className="space-y-2">
              {ALL_SPONSOR_TYPES.map(type => (
                <label key={`names-${type}`} className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" checked={namesTypes.includes(type)} onChange={() => toggleType(namesTypes, setNamesTypes, type)} />
                  <span className="capitalize text-gray-700 dark:text-gray-300">{type}</span>
                </label>
              ))}
            </div>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Selecteer welke types worden getoond in de ticker.</p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">Sponsor Rows (Spelerfoto's)</h3>
            <div className="space-y-2">
              {ALL_SPONSOR_TYPES.map(type => (
                <label key={`rows-${type}`} className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" checked={rowsTypes.includes(type)} onChange={() => toggleType(rowsTypes, setRowsTypes, type)} />
                  <span className="capitalize text-gray-700 dark:text-gray-300">{type}</span>
                </label>
              ))}
            </div>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Selecteer welke types worden gebruikt voor de sponsor rows.</p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">Sponsor Slides (Pauze)</h3>
            <div className="space-y-2">
              {ALL_SPONSOR_TYPES.map(type => (
                <label key={`slides-${type}`} className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" checked={slidesTypes.includes(type)} onChange={() => toggleType(slidesTypes, setSlidesTypes, type)} />
                  <span className="capitalize text-gray-700 dark:text-gray-300">{type}</span>
                </label>
              ))}
            </div>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Selecteer welke types worden gebruikt voor de sponsor slides.</p>
          </div>
        </div>
      </section>

      <div className="flex justify-end">
        <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed">
          {saving ? 'Opslaan...' : 'Instellingen Opslaan'}
        </button>
      </div>
    </form>
  );
}
