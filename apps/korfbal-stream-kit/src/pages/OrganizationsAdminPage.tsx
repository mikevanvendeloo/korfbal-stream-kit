import React from 'react';
import {Link} from 'react-router-dom';
import {MdAdd, MdEdit} from 'react-icons/md';
import OrganizationLogo from '../components/OrganizationLogo';
import {useCurrentOrganization} from '../components/OrganizationGate';
import {useClubs} from '../hooks/useClubs';
import {
  Organization,
  useAllOrganizations,
  useCreateOrganization,
  useDeleteOrganizationLogo,
  useUpdateOrganization,
  useUploadOrganizationLogo,
} from '../hooks/useOrganizations';
import {adminPaths} from '../lib/adminPaths';
import {ORGANIZATION_SLUG_PATTERN} from '../lib/organization';

/** "Fortuna/Ruitenheer" → "fortuna-ruitenheer": the slug rule of the API (lowercase, digits, dashes). */
export function suggestSlug(name: string): string {
  return name
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

const inputClass = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-blue-500 focus:border-blue-500';
const labelClass = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';
const secondaryButton = 'px-3 py-1.5 rounded-md border border-gray-300 dark:border-gray-700 text-sm text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50';
const primaryButton = 'px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed';

export function ErrorBox({children}: { children: React.ReactNode }) {
  return <div role="alert" className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded dark:bg-red-900/30 dark:border-red-800 dark:text-red-300">{children}</div>;
}

export function SuccessBox({children}: { children: React.ReactNode }) {
  return <div role="status" className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded dark:bg-green-900/30 dark:border-green-800 dark:text-green-300">{children}</div>;
}

/** Logo upload and remove for one organization; used in the form and on the Organisatie page. */
export function OrganizationLogoField({organization}: { organization: Organization }) {
  const upload = useUploadOrganizationLogo();
  const remove = useDeleteOrganizationLogo();
  const [error, setError] = React.useState<string | null>(null);
  const inputId = `organization-logo-${organization.id}`;

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    try {
      await upload.mutateAsync({id: organization.id, file});
    } catch (err) {
      setError((err as Error).message || 'Uploaden mislukt');
    }
  }

  return (
    <div>
      <div className={labelClass}>Logo</div>
      <div className="flex flex-wrap items-center gap-3">
        <OrganizationLogo organization={organization} size="large"/>
        <label htmlFor={inputId} className={`${secondaryButton} cursor-pointer`}>
          {upload.isPending ? 'Uploaden…' : 'Logo uploaden'}
        </label>
        <input id={inputId} type="file" accept="image/png,image/jpeg,image/gif,image/webp" className="sr-only"
               onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ''; }}/>
        {organization.logoUrl && (
          <button type="button" className={secondaryButton} disabled={remove.isPending}
                  onClick={() => remove.mutate(organization.id, {onError: (err) => setError(err.message)})}>
            Logo verwijderen
          </button>
        )}
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
        PNG, JPG, GIF of WebP. Zonder eigen logo zie je het logo van de gekoppelde club, en anders de initialen.
      </p>
      {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400 mt-1">{error}</p>}
    </div>
  );
}

function OrganizationFormModal({initial, onClose}: { initial?: Organization; onClose: () => void }) {
  const {data: clubs = []} = useClubs();
  const create = useCreateOrganization();
  const update = useUpdateOrganization();
  const [name, setName] = React.useState(initial?.name ?? '');
  const [slug, setSlug] = React.useState(initial?.slug ?? '');
  const [slugTouched, setSlugTouched] = React.useState(!!initial);
  const [clubId, setClubId] = React.useState<number | null>(initial?.clubId ?? null);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState<Organization | null>(initial ?? null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError('Naam is verplicht');
    if (!ORGANIZATION_SLUG_PATTERN.test(slug)) return setError('De slug mag alleen kleine letters, cijfers en streepjes bevatten');
    try {
      const result = saved
        ? await update.mutateAsync({id: saved.id, name: name.trim(), slug, clubId})
        : await create.mutateAsync({name: name.trim(), slug, clubId});
      if (saved) onClose(); // a renamed slug of the chosen organization is followed by useUpdateOrganization
      else setSaved(result); // stay open for the logo
    } catch (err) {
      setError((err as Error).message || 'Opslaan mislukt');
    }
  }

  const busy = create.isPending || update.isPending;
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="organization-form-title"
           className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-5 rounded-lg shadow w-[520px] max-w-full max-h-full overflow-y-auto">
        <h2 id="organization-form-title" className="text-lg font-semibold mb-4">{initial ? 'Organisatie wijzigen' : 'Nieuwe organisatie'}</h2>
        {error && <ErrorBox>{error}</ErrorBox>}
        {saved && !initial && <SuccessBox>Organisatie aangemaakt, met de standaardset. Voeg eventueel nog een logo toe.</SuccessBox>}
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label htmlFor="organization-name" className={labelClass}>Naam</label>
            <input id="organization-name" className={inputClass} value={name} autoFocus
                   onChange={(e) => { setName(e.target.value); if (!slugTouched) setSlug(suggestSlug(e.target.value)); }}/>
          </div>
          <div>
            <label htmlFor="organization-slug" className={labelClass}>Slug</label>
            <input id="organization-slug" className={`${inputClass} font-mono`} value={slug}
                   onChange={(e) => { setSlugTouched(true); setSlug(e.target.value.toLowerCase()); }}/>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Korte naam voor de app, met kleine letters, cijfers en streepjes (bijvoorbeeld <code>fortuna</code>).
              {initial && ' Wijzig je de slug, dan kiest iedereen die deze organisatie gebruikt opnieuw op het startscherm.'}
            </p>
          </div>
          <div>
            <label htmlFor="organization-club" className={labelClass}>Club</label>
            <select id="organization-club" className={inputClass} value={clubId ?? ''}
                    onChange={(e) => setClubId(e.target.value ? Number(e.target.value) : null)}>
              <option value="">Geen club</option>
              {clubs.map((club) => <option key={club.id} value={club.id}>{club.name}</option>)}
            </select>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Optioneel: de eigen club. Het clublogo wordt gebruikt zolang er geen eigen logo is.</p>
          </div>
          {saved && <OrganizationLogoField organization={saved}/>}
          {!initial && !saved && (
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Een nieuwe organisatie krijgt de standaardset: skills, posities, titel-templates en draaiboek-templates met hoofdstukken.
            </p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className={secondaryButton} onClick={onClose}>{saved && !initial ? 'Sluiten' : 'Annuleren'}</button>
            {!(saved && !initial) && (
              <button type="submit" className={primaryButton} disabled={busy}>{busy ? 'Opslaan…' : initial ? 'Opslaan' : 'Aanmaken'}</button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

/** Beheer → tandwiel → Organisaties (design D10): list, create, edit, (de)activate. */
export default function OrganizationsAdminPage() {
  const {data: organizations, isLoading, error} = useAllOrganizations();
  const {organization: current} = useCurrentOrganization();
  const {data: clubs = []} = useClubs();
  const update = useUpdateOrganization();
  const [editing, setEditing] = React.useState<Organization | 'new' | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);

  const activeCount = organizations?.filter((o) => o.isActive).length ?? 0;
  const clubName = (id: number | null) => clubs.find((c) => c.id === id)?.name ?? '—';

  function toggleActive(organization: Organization) {
    setActionError(null);
    if (organization.isActive && !window.confirm(`${organization.name} deactiveren? De organisatie verdwijnt van het startscherm, en wie haar gebruikt moet opnieuw kiezen.`)) return;
    update.mutate({id: organization.id, isActive: !organization.isActive}, {onError: (err) => setActionError(err.message)});
  }

  return (
    <div className="container py-6 max-w-5xl text-gray-800 dark:text-gray-100">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Organisaties</h1>
        <button type="button" onClick={() => setEditing('new')} className={`${primaryButton} inline-flex items-center gap-2`}>
          <MdAdd/> Nieuwe organisatie
        </button>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
        Elke organisatie heeft haar eigen producties, crew, sponsors, instellingen en wedstrijden. Alleen actieve organisaties
        staan op het startscherm. De instellingen van de gekozen organisatie (wedstrijdimport, API-sleutels) staan op{' '}
        <Link to={adminPaths.organization} className="text-blue-600 dark:text-blue-400 underline">Organisatie</Link>.
      </p>
      {actionError && <ErrorBox>{actionError}</ErrorBox>}
      {isLoading && <div>Laden…</div>}
      {error && <ErrorBox>Fout bij laden: {(error as Error).message}</ErrorBox>}
      {organizations && (
        <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
          <table className="min-w-full text-sm">
            <thead className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-4 py-2 font-medium">Organisatie</th>
                <th className="px-4 py-2 font-medium">Slug</th>
                <th className="px-4 py-2 font-medium">Club</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium sr-only">Acties</th>
              </tr>
            </thead>
            <tbody>
              {organizations.map((organization) => {
                const isLastActive = organization.isActive && activeCount <= 1;
                return (
                  <tr key={organization.id} className="border-b last:border-0 border-gray-100 dark:border-gray-700">
                    <td className="px-4 py-2">
                      <span className="flex items-center gap-3">
                        <OrganizationLogo organization={organization}/>
                        <span className="font-medium">{organization.name}</span>
                        {current?.id === organization.id && <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">Gekozen</span>}
                      </span>
                    </td>
                    <td className="px-4 py-2 font-mono">{organization.slug}</td>
                    <td className="px-4 py-2">{clubName(organization.clubId)}</td>
                    <td className="px-4 py-2">
                      <span className={organization.isActive ? 'text-green-700 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}>
                        {organization.isActive ? 'Actief' : 'Inactief'}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <span className="flex justify-end gap-2">
                        <button type="button" className={`${secondaryButton} inline-flex items-center gap-1`} onClick={() => setEditing(organization)}
                                aria-label={`${organization.name} wijzigen`}>
                          <MdEdit/> Wijzigen
                        </button>
                        <button type="button" className={secondaryButton} onClick={() => toggleActive(organization)} disabled={isLastActive || update.isPending}
                                title={isLastActive ? 'De laatste actieve organisatie kun je niet deactiveren' : undefined}
                                aria-label={`${organization.name} ${organization.isActive ? 'deactiveren' : 'activeren'}`}>
                          {organization.isActive ? 'Deactiveren' : 'Activeren'}
                        </button>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {editing && <OrganizationFormModal initial={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)}/>}
    </div>
  );
}
