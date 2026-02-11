import React from 'react';
import {useClubPlayers, useClubs, useDeleteClub, useImportClubs, useImportLeagueTeams} from '../hooks/useClubs';
import PlayerCard from '../components/PlayerCard';
import ClubLogo from '../components/ClubLogo';

function DeleteClubButton({slug, clubs, onDeleted}: {
  slug: string;
  clubs: Array<{ slug: string }>;
  onDeleted: (nextSlug: string | '') => void
}) {
  const del = useDeleteClub();
  const [busy, setBusy] = React.useState(false);
  return (
    <button
      aria-label="Verwijder club"
      title="Verwijder club"
      className="px-3 py-1 border rounded bg-red-600 text-white disabled:opacity-60 disabled:cursor-not-allowed"
      onClick={async () => {
        if (!slug) return;
        const ok = window.confirm('Weet je zeker dat je deze club wilt verwijderen? Dit verwijdert ook alle spelers van deze club.');
        if (!ok) return;
        setBusy(true);
        try {
          await del.mutateAsync(slug);
          // pick next slug
          const idx = clubs.findIndex((c) => c.slug === slug);
          const next = clubs.filter((c) => c.slug !== slug);
          const nextSlug = next.length > 0 ? (next[idx] || next[next.length - 1]).slug : '';
          onDeleted(nextSlug);
        } catch (e) {

          alert((e as any)?.message || 'Verwijderen mislukt');
        } finally {
          setBusy(false);
        }
      }}
      disabled={busy || del.isPending}
      aria-busy={busy || del.isPending}
    >
      {busy || del.isPending ? 'Verwijderen…' : 'Verwijder club'}
    </button>
  );
}

export default function ClubsPage() {
  const {data: clubs, isLoading, error} = useClubs();
  const [slug, setSlug] = React.useState<string | ''>('');
  const players = useClubPlayers(slug || null);

  const importClubs = useImportClubs();
  const importLeague = useImportLeagueTeams();
  const [apiUrl, setApiUrl] = React.useState('');
  const [teamId, setTeamId] = React.useState('');
  const [poolId, setPoolId] = React.useState('');
  const [msg, setMsg] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!slug && clubs && clubs.length > 0) {
      setSlug(clubs[0].slug);
    }
  }, [clubs, slug]);

  async function onImport(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    try {
      if (apiUrl.trim()) {
        await importClubs.mutateAsync({apiUrl: apiUrl.trim()});
      } else if (teamId.trim() && poolId.trim()) {
        await importClubs.mutateAsync({teamId: teamId.trim(), poolId: poolId.trim()});
      } else {
        setMsg('Vul een API URL in of zowel teamId als poolId.');
        return;
      }
      setMsg('Import voltooid. Gegevens bijgewerkt.');
    } catch (err: any) {
      setMsg(err?.message || 'Import mislukt');
    }
  }

  return (
    <div className="container py-6 text-gray-800 dark:text-gray-100">
      <h1 className="text-xl font-semibold mb-4">Clubs & spelers</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left: club selector and players table */}
        <div className="md:col-span-2">
          <div className="mb-3">
            <label className="text-sm">
              <div className="mb-1">Kies club</div>
              <select
                aria-label="Kies club"
                className="border rounded px-2 py-1 min-w-[16rem]"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
              >
                {(clubs || []).map((c) => (
                  <option key={c.id} value={c.slug}>{c.shortName || c.name}</option>
                ))}
              </select>
            </label>
          </div>

          {isLoading && <div>Laden…</div>}
          {error && <div className="text-red-600">Fout bij laden clubs</div>}

          <div>
            {(() => {
              const club = (clubs || []).find((c) => c.slug === slug);
              if (!club) return null;
              const title = club.shortName || club.name;

              // Sort players: coaches first, then women, then men
              const sortedPlayers = [...(players.data || [])].sort((a, b) => {
                // Check if player is a coach (function contains 'coach' or 'trainer')
                const aIsCoach = a.function?.toLowerCase().includes('coach') || a.function?.toLowerCase().includes('trainer');
                const bIsCoach = b.function?.toLowerCase().includes('coach') || b.function?.toLowerCase().includes('trainer');

                if (aIsCoach && !bIsCoach) return -1;
                if (!aIsCoach && bIsCoach) return 1;

                // If both are coaches or both are not coaches, sort by gender
                if (a.gender === 'female' && b.gender === 'male') return -1;
                if (a.gender === 'male' && b.gender === 'female') return 1;

                return 0;
              });

              return (
                <>
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <ClubLogo logoUrl={club.logoUrl} alt={`${title} logo`} size="large" />
                      <div className="text-lg font-medium">{title}</div>
                    </div>
                    <DeleteClubButton slug={club.slug} onDeleted={(nextSlug) => setSlug(nextSlug)} clubs={clubs || []}/>
                  </div>

                  {sortedPlayers.length === 0 ? (
                    <div className="p-6 text-center text-gray-500">Geen spelers gevonden voor deze club.</div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                      {sortedPlayers.map((player) => (
                        <PlayerCard
                          key={player.id}
                          name={player.name}
                          photoUrl={player.photoUrl}
                          shirtNo={player.shirtNo}
                          function={player.function}
                        />
                      ))}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </div>

        {/* Right: Import form */}
        <div>
          <div className="border rounded p-3">
            <h2 className="font-semibold mb-2">Importeer clubs & spelers</h2>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">Met één klik alle teams uit de Korfbal League
              importeren. Je kunt de import herhalen; bestaande data wordt bijgewerkt.</p>

            {msg && (
              <div role="alert"
                   className="mb-3 rounded-md border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 px-3 py-2">
                {msg}
              </div>
            )}

            <div className="flex items-center justify-between gap-2 mb-4">
              <button
                type="button"
                className="px-3 py-1 border rounded bg-blue-600 text-white disabled:opacity-60 disabled:cursor-not-allowed"
                onClick={async () => {
                  setMsg(null);
                  try {
                    const res = await importLeague.mutateAsync();
                    const probs = res?.problems?.length || 0;
                    setMsg(`Import voltooid: clubs +${res.clubsCreated} / ${res.clubsUpdated} bijgewerkt, spelers +${res.playersCreated} / ${res.playersUpdated} bijgewerkt${probs ? `, problemen: ${probs}` : ''}.`);
                  } catch (e: any) {
                    setMsg(e?.message || 'Import mislukt');
                  }
                }}
                disabled={importLeague.isPending}
                aria-busy={importLeague.isPending}
                aria-label="Importeer alle teams vanaf league.korfbal.nl"
                title="Importeer alle teams (League)"
              >
                {importLeague.isPending ? 'Importeren…' : 'Importeer alle teams'}
              </button>
              <span className="text-xs text-gray-600 dark:text-gray-400">Bron: league.korfbal.nl/teams</span>
            </div>

            <details>
              <summary className="cursor-pointer text-sm mb-2">Handmatige import (optioneel)</summary>
              <p className="text-xs text-gray-600 dark:text-gray-300 mb-3">Voer een Korfbal League team API URL in, of
                geef teamId + poolId op voor een specifieke club.</p>
              <form className="space-y-3" onSubmit={onImport}>
                <div>
                  <label className="block text-sm mb-1">Team API URL</label>
                  <input
                    type="url"
                    placeholder="https://api-saas-site.../team?..."
                    className="w-full px-2 py-1 border rounded bg-white dark:bg-gray-950"
                    value={apiUrl}
                    onChange={(e) => setApiUrl(e.target.value)}
                  />
                </div>

                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="block text-sm mb-1">teamId</label>
                    <input
                      type="text"
                      className="w-full px-2 py-1 border rounded bg-white dark:bg-gray-950"
                      value={teamId}
                      onChange={(e) => setTeamId(e.target.value)}
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm mb-1">poolId</label>
                    <input
                      type="text"
                      className="w-full px-2 py-1 border rounded bg-white dark:bg-gray-950"
                      value={poolId}
                      onChange={(e) => setPoolId(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="submit"
                    className="px-3 py-1 border rounded bg-blue-600 text-white disabled:opacity-60 disabled:cursor-not-allowed"
                    disabled={importClubs.isPending}
                    aria-busy={importClubs.isPending}
                  >
                    {importClubs.isPending ? 'Importeren…' : 'Importeren'}
                  </button>
                </div>
              </form>
            </details>
          </div>
        </div>
      </div>
    </div>
  );
}
