import React from 'react';
import {
  useClubPlayers,
  useClubs,
  useCreateClub,
  useCreatePlayer,
  useDeleteClub,
  useDeletePlayer,
  useImportClubs,
  useImportLeagueTeams,
  useUpdatePlayer,
  useUploadPlayerImage
} from '../hooks/useClubs';
import PlayerCard, {PhotoCard} from '../components/PlayerCard';
import ClubLogo from '../components/ClubLogo';
import {MdAdd} from 'react-icons/md';

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
  const createClub = useCreateClub();
  const createPlayer = useCreatePlayer();
  const updatePlayer = useUpdatePlayer();
  const deletePlayer = useDeletePlayer();
  const uploadImage = useUploadPlayerImage();

  const [apiUrl, setApiUrl] = React.useState('');
  const [teamId, setTeamId] = React.useState('');
  const [poolId, setPoolId] = React.useState('');
  const [msg, setMsg] = React.useState<string | null>(null);

  // New Club Form State
  const [newClubName, setNewClubName] = React.useState('');
  const [newClubShortName, setNewClubShortName] = React.useState('');
  const [showNewClubForm, setShowNewClubForm] = React.useState(false);

  // Player Form State (Create/Edit)
  const [playerFormMode, setPlayerFormMode] = React.useState<'create' | 'edit' | null>(null);
  const [editingPlayerId, setEditingPlayerId] = React.useState<number | null>(null);
  const [playerName, setPlayerName] = React.useState('');
  const [playerShirtNo, setPlayerShirtNo] = React.useState('');
  const [playerGender, setPlayerGender] = React.useState('male');
  const [playerType, setPlayerType] = React.useState('player');
  const [playerFunction, setPlayerFunction] = React.useState('');
  const [playerPhotoUrl, setPlayerPhotoUrl] = React.useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = React.useState(false);


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

  async function handleCreateClub(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    try {
      const club = await createClub.mutateAsync({ name: newClubName, shortName: newClubShortName });
      setNewClubName('');
      setNewClubShortName('');
      setShowNewClubForm(false);
      setSlug(club.slug); // Select the new club
      setMsg('Club aangemaakt.');
    } catch (err: any) {
      setMsg(err?.message || 'Club aanmaken mislukt');
    }
  }

  function resetPlayerForm() {
    setPlayerFormMode(null);
    setEditingPlayerId(null);
    setPlayerName('');
    setPlayerShirtNo('');
    setPlayerGender('male');
    setPlayerType('player');
    setPlayerFunction('');
    setPlayerPhotoUrl(null);
  }

  function openCreatePlayerForm() {
    resetPlayerForm();
    setPlayerFormMode('create');
  }

  function openEditPlayerForm(player: any) {
    setPlayerFormMode('edit');
    setEditingPlayerId(player.id);
    setPlayerName(player.name);
    setPlayerShirtNo(player.shirtNo?.toString() || '');
    setPlayerGender(player.gender || 'male');
    setPlayerType(player.personType || 'player');
    setPlayerFunction(player.function || '');
    setPlayerPhotoUrl(player.photoUrl || null);
  }

  async function handlePlayerSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const club = (clubs || []).find((c) => c.slug === slug);
    if (!club) return;

    try {
      if (playerFormMode === 'create') {
        await createPlayer.mutateAsync({
          clubId: club.id,
          name: playerName,
          shirtNo: playerShirtNo ? Number(playerShirtNo) : undefined,
          gender: playerGender,
          personType: playerType,
          function: playerFunction,
          photoUrl: playerPhotoUrl || undefined
        });
        setMsg('Speler aangemaakt.');
      } else if (playerFormMode === 'edit' && editingPlayerId) {
        await updatePlayer.mutateAsync({
          id: editingPlayerId,
          name: playerName,
          shirtNo: playerShirtNo ? Number(playerShirtNo) : undefined,
          gender: playerGender,
          personType: playerType,
          function: playerFunction,
          photoUrl: playerPhotoUrl || undefined
        });
        setMsg('Speler bijgewerkt.');
      }
      resetPlayerForm();
    } catch (err: any) {
      setMsg(err?.message || 'Opslaan mislukt');
    }
  }

  async function handleDeletePlayer(player: any) {
    if (!confirm(`Weet je zeker dat je ${player.name} wilt verwijderen?`)) return;
    setMsg(null);
    try {
      await deletePlayer.mutateAsync(player.id);
      setMsg('Speler verwijderd.');
    } catch (err: any) {
      setMsg(err?.message || 'Verwijderen mislukt');
    }
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    setUploadingPhoto(true);
    try {
      const result = await uploadImage.mutateAsync(file);
      setPlayerPhotoUrl(result.filename);
    } catch (err: any) {
      alert('Foto uploaden mislukt: ' + (err?.message || 'Unknown error'));
    } finally {
      setUploadingPhoto(false);
    }
  }

  return (
    <div className="container py-6 text-gray-800 dark:text-gray-100">
      <h1 className="text-xl font-semibold mb-4">Clubs & spelers</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left: club selector and players table */}
        <div className="md:col-span-2">
          <div className="mb-3 flex items-end gap-2">
            <label className="text-sm flex-grow">
              <div className="mb-1">Kies club</div>
              <select
                aria-label="Kies club"
                className="border rounded px-2 py-1 w-full"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
              >
                {(clubs || []).map((c) => (
                  <option key={c.id} value={c.slug}>{c.shortName || c.name}</option>
                ))}
              </select>
            </label>
            <button
              className="px-3 py-1 border rounded bg-green-600 text-white flex items-center gap-1 h-[34px]"
              onClick={() => setShowNewClubForm(!showNewClubForm)}
            >
              <MdAdd /> Nieuwe club
            </button>
          </div>

          {showNewClubForm && (
            <div className="mb-4 p-3 border rounded bg-gray-50 dark:bg-gray-900 dark:border-gray-700">
              <h3 className="font-medium mb-2">Nieuwe club toevoegen</h3>
              <form onSubmit={handleCreateClub} className="flex flex-col gap-3">
                <div>
                  <label className="block text-sm mb-1">Naam</label>
                  <input
                    type="text"
                    required
                    className="w-full px-2 py-1 border rounded dark:bg-gray-800 dark:border-gray-600"
                    value={newClubName}
                    onChange={(e) => setNewClubName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1">Korte naam (optioneel)</label>
                  <input
                    type="text"
                    className="w-full px-2 py-1 border rounded dark:bg-gray-800 dark:border-gray-600"
                    value={newClubShortName}
                    onChange={(e) => setNewClubShortName(e.target.value)}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setShowNewClubForm(false)} className="px-3 py-1 border rounded">Annuleren</button>
                  <button type="submit" className="px-3 py-1 border rounded bg-blue-600 text-white" disabled={createClub.isPending}>Opslaan</button>
                </div>
              </form>
            </div>
          )}

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
                    <div className="flex gap-2">
                      <button
                        className="px-3 py-1 border rounded bg-green-600 text-white flex items-center gap-1"
                        onClick={openCreatePlayerForm}
                      >
                        <MdAdd /> Nieuwe speler
                      </button>
                      <DeleteClubButton slug={club.slug} onDeleted={(nextSlug) => setSlug(nextSlug)} clubs={clubs || []}/>
                    </div>
                  </div>

                  {playerFormMode && (
                    <div className="mb-6 p-3 border rounded bg-gray-50 dark:bg-gray-900 dark:border-gray-700">
                      <h3 className="font-medium mb-2">{playerFormMode === 'create' ? `Nieuwe speler toevoegen aan ${title}` : 'Speler bewerken'}</h3>
                      <form onSubmit={handlePlayerSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="md:col-span-2">
                          <label className="block text-sm mb-1">Naam</label>
                          <input
                            type="text"
                            required
                            className="w-full px-2 py-1 border rounded dark:bg-gray-800 dark:border-gray-600"
                            value={playerName}
                            onChange={(e) => setPlayerName(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="block text-sm mb-1">Rugnummer</label>
                          <input
                            type="number"
                            className="w-full px-2 py-1 border rounded dark:bg-gray-800 dark:border-gray-600"
                            value={playerShirtNo}
                            onChange={(e) => setPlayerShirtNo(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="block text-sm mb-1">Geslacht</label>
                          <select
                            className="w-full px-2 py-1 border rounded dark:bg-gray-800 dark:border-gray-600"
                            value={playerGender}
                            onChange={(e) => setPlayerGender(e.target.value)}
                          >
                            <option value="male">Man</option>
                            <option value="female">Vrouw</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm mb-1">Type</label>
                          <select
                            className="w-full px-2 py-1 border rounded dark:bg-gray-800 dark:border-gray-600"
                            value={playerType}
                            onChange={(e) => {
                              setPlayerType(e.target.value);
                              // Clear function if type is player
                              if (e.target.value === 'player') {
                                setPlayerFunction('');
                              }
                            }}
                          >
                            <option value="player">Speler</option>
                            <option value="coach">Coach</option>
                            <option value="staff">Staf</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm mb-1">Functie (optioneel)</label>
                          <input
                            type="text"
                            placeholder="bv. Hoofdcoach"
                            className="w-full px-2 py-1 border rounded dark:bg-gray-800 dark:border-gray-600 disabled:opacity-50 disabled:bg-gray-100 dark:disabled:bg-gray-800"
                            value={playerFunction}
                            onChange={(e) => setPlayerFunction(e.target.value)}
                            disabled={playerType === 'player'}
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-sm mb-1">Foto</label>
                          <div className="flex items-center gap-3">
                            {playerPhotoUrl && (
                              <PhotoCard name={playerName} photoUrl={playerPhotoUrl} />
                            )}
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handlePhotoUpload}
                              className="text-sm"
                              disabled={uploadingPhoto}
                            />
                            {uploadingPhoto && <span className="text-xs text-gray-500">Uploaden...</span>}
                          </div>
                        </div>
                        <div className="md:col-span-2 flex justify-end gap-2 mt-2">
                          <button type="button" onClick={resetPlayerForm} className="px-3 py-1 border rounded">Annuleren</button>
                          <button type="submit" className="px-3 py-1 border rounded bg-blue-600 text-white" disabled={createPlayer.isPending || updatePlayer.isPending || uploadingPhoto}>Opslaan</button>
                        </div>
                      </form>
                    </div>
                  )}

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
                          onEdit={() => openEditPlayerForm(player)}
                          onDelete={() => handleDeletePlayer(player)}
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
