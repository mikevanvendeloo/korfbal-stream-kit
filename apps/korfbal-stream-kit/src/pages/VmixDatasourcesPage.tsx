import React from 'react';
import {useQuery} from '@tanstack/react-query';
import {createUrl, extractError} from '../lib/api';
import {MdContentCopy} from 'react-icons/md';

type VmixEndpoint = {
  name: string;
  url: string;
  description: string;
};

type VmixEndpointsResponse = {
  hostIp: string;
  endpoints: VmixEndpoint[];
};

function useVmixEndpoints() {
  return useQuery({
    queryKey: ['vmix-endpoints'],
    queryFn: async (): Promise<VmixEndpointsResponse> => {
      const res = await fetch(createUrl('/api/vmix/endpoints'));
      if (!res.ok) throw new Error(await extractError(res));
      return res.json();
    },
  });
}

export default function VmixDatasourcesPage() {
  const {data, isLoading, error} = useVmixEndpoints();
  const [copiedUrl, setCopiedUrl] = React.useState<string | null>(null);

  const handleCopy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedUrl(url);
      setTimeout(() => setCopiedUrl(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="container py-6 text-gray-800 dark:text-gray-100">
      <h1 className="text-xl font-semibold mb-4">vMix Datasources</h1>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
        Hieronder vind je de beschikbare GET endpoints die je als datasource in vMix kunt gebruiken.
        Deze URLs gebruiken het IP-adres van de host machine ({data?.hostIp || 'loading...'}), zodat ze bereikbaar zijn vanaf andere apparaten in het netwerk (zoals de vMix PC).
      </p>

      {isLoading && <div>Laden...</div>}
      {error && <div className="text-red-600">Fout bij laden endpoints: {(error as any).message}</div>}

      {data && (
        <div className="grid gap-4">
          {data.endpoints.map((endpoint) => (
            <div key={endpoint.url} className="border rounded p-4 bg-white dark:bg-gray-900 dark:border-gray-700 shadow-sm">
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-medium text-lg">{endpoint.name}</h3>
                <button
                  onClick={() => handleCopy(endpoint.url)}
                  className="text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 transition-colors"
                  title="Kopieer URL"
                >
                  {copiedUrl === endpoint.url ? (
                    <span className="text-green-600 text-xs font-medium">Gekopieerd!</span>
                  ) : (
                    <MdContentCopy className="w-5 h-5" />
                  )}
                </button>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{endpoint.description}</p>
              <div className="bg-gray-100 dark:bg-gray-800 p-2 rounded text-xs font-mono break-all border border-gray-200 dark:border-gray-700">
                {endpoint.url}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
