import React from 'react';
import {Link} from 'react-router-dom';
import OrganizationLogo from '../components/OrganizationLogo';
import {useCurrentOrganization} from '../components/OrganizationGate';
import {ApiKeysSection} from '../components/ApiKeys';
import {MATCH_SOURCE_PROVIDERS, MatchSource, MatchSourceInput, MatchSourceProvider, useMatchSource, useSaveMatchSource, useTestMatchSource} from '../hooks/useOrganizations';
import {adminPaths} from '../lib/adminPaths';
import {ErrorBox, OrganizationLogoField, SuccessBox} from './OrganizationsAdminPage';

const sectionClass = 'bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700';
const headingClass = 'text-lg font-medium text-gray-900 dark:text-gray-100 mb-4 border-b border-gray-100 dark:border-gray-700 pb-2';
const inputClass = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-blue-500 focus:border-blue-500';
const labelClass = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';
const primaryButton = 'px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed';
const secondaryButton = 'px-4 py-2 rounded-md border border-gray-300 dark:border-gray-700 text-sm text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50';

/** Wedstrijdimport (design D8): provider, URL and token; the token is never shown, only whether it is set. */
export function MatchSourceForm({source}: { source: MatchSource }) {
  const save = useSaveMatchSource();
  const test = useTestMatchSource();
  const [provider, setProvider] = React.useState<MatchSourceProvider>(source.provider);
  const [baseUrl, setBaseUrl] = React.useState(source.baseUrl);
  const [isEnabled, setIsEnabled] = React.useState(source.isEnabled);
  const [token, setToken] = React.useState('');
  const [message, setMessage] = React.useState<{ ok: boolean; text: string } | null>(null);

  const dirty = provider !== source.provider || baseUrl !== source.baseUrl || isEnabled !== source.isEnabled || token !== '';

  async function submit(input: MatchSourceInput, done: string) {
    setMessage(null);
    try {
      const saved = await save.mutateAsync(input);
      setToken('');
      setProvider(saved.provider);
      setBaseUrl(saved.baseUrl);
      setIsEnabled(saved.isEnabled);
      const tokenCleared = source.hasApiToken && !saved.hasApiToken && input.apiToken !== null;
      setMessage({ok: true, text: tokenCleared ? `${done} Het token is gewist omdat de bron of het adres is gewijzigd; vul het opnieuw in.` : done});
    } catch (err) {
      setMessage({ok: false, text: (err as Error).message || 'Opslaan mislukt'});
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    void submit({provider, baseUrl: baseUrl.trim(), isEnabled, ...(token.trim() ? {apiToken: token.trim()} : {})}, 'Wedstrijdimport opgeslagen.');
  }

  async function onTest() {
    setMessage(null);
    try {
      await test.mutateAsync();
      setMessage({ok: true, text: 'Verbinding gelukt.'});
    } catch (err) {
      setMessage({ok: false, text: (err as Error).message || 'Geen verbinding met de wedstrijdbron'});
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {message && (message.ok ? <SuccessBox>{message.text}</SuccessBox> : <ErrorBox>{message.text}</ErrorBox>)}
      <div>
        <label htmlFor="match-source-provider" className={labelClass}>Bron</label>
        <select id="match-source-provider" className={inputClass} value={provider} onChange={(e) => setProvider(e.target.value as MatchSourceProvider)}>
          {MATCH_SOURCE_PROVIDERS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="match-source-url" className={labelClass}>Adres (URL)</label>
        <input id="match-source-url" type="url" className={inputClass} value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://…"/>
      </div>
      <div>
        <label htmlFor="match-source-token" className={labelClass}>Token</label>
        <input id="match-source-token" type="password" autoComplete="off" className={inputClass} value={token} onChange={(e) => setToken(e.target.value)}
               placeholder={source.hasApiToken ? 'Laat leeg om het huidige token te houden' : 'Vul het token in'}/>
        <p className="text-sm mt-1" data-testid="match-source-token-status">
          Token: <strong>{source.hasApiToken ? 'ingesteld' : 'niet ingesteld'}</strong>
          {source.hasApiToken && (
            <button type="button" className="ml-3 text-red-600 dark:text-red-400 underline disabled:opacity-50" disabled={save.isPending}
                    onClick={() => window.confirm('Het token verwijderen?') && void submit({provider: source.provider, baseUrl: source.baseUrl, isEnabled: source.isEnabled, apiToken: null}, 'Token verwijderd.')}>
              Token verwijderen
            </button>
          )}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Het token wordt nooit getoond. Wijzig je de bron of het adres, dan wordt het opgeslagen token gewist; vul het dan opnieuw in.
        </p>
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
        <input type="checkbox" checked={isEnabled} onChange={(e) => setIsEnabled(e.target.checked)} className="rounded"/>
        Wedstrijdimport aan
      </label>
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" className={secondaryButton} onClick={onTest} disabled={test.isPending || dirty || !source.configured}
                title={dirty ? 'Sla eerst op: de test gebruikt de opgeslagen instellingen' : undefined}>
          {test.isPending ? 'Testen…' : 'Test verbinding'}
        </button>
        <button type="submit" className={primaryButton} disabled={save.isPending}>{save.isPending ? 'Opslaan…' : 'Opslaan'}</button>
      </div>
      {dirty && <p className="text-xs text-gray-500 dark:text-gray-400 text-right">Test verbinding gebruikt de opgeslagen instellingen: sla eerst op.</p>}
    </form>
  );
}

/** Beheer → Overig → Organisatie: the chosen organization's logo, match import and API keys (design D10). */
export default function OrganizationAdminPage() {
  const {organization} = useCurrentOrganization();
  const {data: source, isLoading, error} = useMatchSource();

  return (
    <div className="container py-6 max-w-4xl text-gray-800 dark:text-gray-100 space-y-8">
      <div className="flex items-center gap-4 min-w-0">
        {organization && <OrganizationLogo organization={organization} size="large"/>}
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 truncate">Organisatie{organization ? `: ${organization.name}` : ''}</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Naam, slug en club wijzig je bij <Link to={adminPaths.organizations} className="text-blue-600 dark:text-blue-400 underline">Organisaties</Link>.
          </p>
        </div>
      </div>

      {organization && (
        <section className={sectionClass} aria-labelledby="organization-logo-heading">
          <h2 id="organization-logo-heading" className={headingClass}>Logo</h2>
          <OrganizationLogoField organization={organization}/>
        </section>
      )}

      <section className={sectionClass} aria-labelledby="match-source-heading">
        <h2 id="match-source-heading" className={headingClass}>Wedstrijdimport</h2>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
          Waar het <Link to={adminPaths.matchSchedule} className="text-blue-600 dark:text-blue-400 underline">wedstrijdprogramma</Link> van deze organisatie vandaan komt.
        </p>
        {isLoading && <div>Laden…</div>}
        {error && <ErrorBox>Fout bij laden: {(error as Error).message}</ErrorBox>}
        {source && <MatchSourceForm source={source}/>}
      </section>

      <section className={sectionClass} aria-labelledby="api-keys-heading">
        <h2 id="api-keys-heading" className={headingClass}>API-sleutels</h2>
        <ApiKeysSection/>
      </section>
    </div>
  );
}
