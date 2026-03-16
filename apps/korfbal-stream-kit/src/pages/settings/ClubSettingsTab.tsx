import React, {useEffect, useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {useClubs} from '../../hooks/useClubs';

// API functions for club config
async function getClubConfig() {
  const res = await fetch('/api/settings/club-config');
  if (!res.ok) throw new Error('Failed to fetch club config');
  return res.json();
}

async function setClubConfig(config: { ownClubId: number | null; productionTeamNames: string[] }) {
  const res = await fetch('/api/settings/club-config', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  if (!res.ok) throw new Error('Failed to save club config');
}

export default function ClubSettingsTab() {
  const [ownClubId, setOwnClubId] = useState<number | null>(null);
  const [productionTeamNames, setProductionTeamNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const { data: clubsData } = useClubs();
  const { data: teamsData } = useQuery({
    queryKey: ['teams', ownClubId],
    queryFn: async () => {
      if (!ownClubId) return [];
      const res = await fetch(`/api/clubs/${ownClubId}/teams`);
      if (!res.ok) throw new Error('Failed to fetch teams');
      return res.json();
    },
    enabled: !!ownClubId,
  });

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      setLoading(true);
      const club = await getClubConfig();
      setOwnClubId(club.ownClubId);
      setProductionTeamNames(club.productionTeamNames);
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
      await setClubConfig({ ownClubId, productionTeamNames });
      setSuccess('Clubinstellingen opgeslagen');
    } catch (err: any) {
      setError(err.message || 'Opslaan mislukt');
    } finally {
      setSaving(false);
    }
  }

  const toggleTeam = (teamName: string) => {
    setProductionTeamNames(prev =>
      prev.includes(teamName) ? prev.filter(t => t !== teamName) : [...prev, teamName]
    );
  };

  if (loading) return <div className="p-6 text-gray-600 dark:text-gray-300">Laden...</div>;

  return (
    <form onSubmit={handleSave} className="space-y-8">
      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded dark:bg-red-900/30 dark:border-red-800 dark:text-red-300">{error}</div>}
      {success && <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded dark:bg-green-900/30 dark:border-green-800 dark:text-green-300">{success}</div>}

      <section className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4 border-b border-gray-100 dark:border-gray-700 pb-2">Club & Teams</h2>
        <div className="space-y-4">
          <div>
            <label htmlFor="ownClubId" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Eigen Club</label>
            <select
              id="ownClubId"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
              value={ownClubId || ''}
              onChange={(e) => setOwnClubId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">Geen (voor generieke evenementen)</option>
              {clubsData?.map(club => <option key={club.id} value={club.id}>{club.name}</option>)}
            </select>
          </div>
          {ownClubId && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Productie Teams</label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {(teamsData || []).map((team: { name: string }) => (
                  <label key={team.name} className="flex items-center gap-2 cursor-pointer p-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700">
                    <input
                      type="checkbox"
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      checked={productionTeamNames.includes(team.name)}
                      onChange={() => toggleTeam(team.name)}
                    />
                    <span className="text-gray-700 dark:text-gray-300">{team.name}</span>
                  </label>
                ))}
              </div>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Selecteer welke teams zichtbaar zijn bij het aanmaken van een productie.</p>
            </div>
          )}
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
