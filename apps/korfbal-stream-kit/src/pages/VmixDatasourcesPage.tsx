import React from 'react';
import {Link} from 'react-router-dom';
import {ApiKeyCreatedDialog, CopyButton, CreateApiKeyForm} from '../components/ApiKeys';
import {CreatedApiKey, useVmixEndpoints, withApiKey} from '../hooks/useOrganizations';
import {useCurrentOrganization} from '../components/OrganizationGate';
import {adminPaths} from '../lib/adminPaths';

export default function VmixDatasourcesPage() {
  const {data, isLoading, error} = useVmixEndpoints();
  const {organization} = useCurrentOrganization();
  // The key just made on this page: only in memory, gone after leaving the page
  const [created, setCreated] = React.useState<CreatedApiKey | null>(null);
  const [showDialog, setShowDialog] = React.useState(false);

  const urlFor = (url: string) => (created && data ? withApiKey(url, data.keyPlaceholder, created.key) : url);

  return (
    <div className="container py-6 text-gray-800 dark:text-gray-100">
      <h1 className="text-xl font-semibold mb-4">vMix Datasources</h1>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        Hieronder vind je de beschikbare GET endpoints die je als datasource in vMix kunt gebruiken.
        Deze URLs gebruiken het IP-adres van de host machine ({data?.hostIp || 'loading...'}), zodat ze bereikbaar zijn vanaf andere apparaten in het netwerk (zoals de vMix PC).
      </p>

      <section className="mb-6 p-4 rounded border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20" aria-labelledby="datasource-key-heading">
        <h2 id="datasource-key-heading" className="font-medium mb-1">API-sleutel</h2>
        <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
          Elk adres heeft een API-sleutel van {organization ? <strong>{organization.name}</strong> : 'de organisatie'} nodig: vervang{' '}
          <code>{data?.keyPlaceholder ?? '<jouw-sleutel>'}</code> door de sleutel. Zonder geldige sleutel geeft vMix een fout (401).
          Sleutels beheer je bij <Link to={adminPaths.organization} className="text-blue-600 dark:text-blue-400 underline">Setup → Organisatie</Link>;
          maak je hier een nieuwe, dan staat hij meteen in de adressen hieronder.
        </p>
        {created ? (
          <p role="status" className="text-sm text-green-700 dark:text-green-400">
            De adressen hieronder bevatten de nieuwe sleutel <strong>{created.name}</strong>. Kopieer ze nu: na het verlaten van deze pagina zie je de sleutel niet meer.
          </p>
        ) : (
          <CreateApiKeyForm onCreated={(key) => { setCreated(key); setShowDialog(true); }}/>
        )}
      </section>

      {isLoading && <div>Laden...</div>}
      {error && <div className="text-red-600">Fout bij laden endpoints: {(error as Error).message}</div>}

      {data && (
        <div className="grid gap-4">
          {data.endpoints.map((endpoint) => {
            const url = urlFor(endpoint.url);
            return (
              <div key={endpoint.url} className="border rounded p-4 bg-white dark:bg-gray-900 dark:border-gray-700 shadow-sm">
                <div className="flex justify-between items-start gap-2 mb-2">
                  <h3 className="font-medium text-lg">{endpoint.name}</h3>
                  <CopyButton text={url} label={`Kopieer URL ${endpoint.name}`}/>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{endpoint.description}</p>
                <div data-testid="datasource-url" className="bg-gray-100 dark:bg-gray-800 p-2 rounded text-xs font-mono break-all border border-gray-200 dark:border-gray-700">
                  {url}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {created && showDialog && <ApiKeyCreatedDialog created={created} onClose={() => setShowDialog(false)}/>}
    </div>
  );
}
