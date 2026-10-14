import React from 'react';
import {MdAdd, MdDelete} from 'react-icons/md';
import {
  useSaveVmixInstances,
  useVmixInstances,
  VMIX_FUNCTIONS,
  VmixInstancesConfig,
} from '../hooks/useVmixInstances';

const inputClass = 'mt-1 w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100';
const labelClass = 'block text-sm font-medium text-gray-700 dark:text-gray-300';

// Ids are fixed once created, so a function keeps its vMix when the instance is renamed
const newId = () => `vmix-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** The vMix PCs (e.g. a stream PC and a screen PC) and which one each function sends to. */
export default function VmixInstancesSettings() {
  const query = useVmixInstances();
  const save = useSaveVmixInstances();
  const [config, setConfig] = React.useState<VmixInstancesConfig | null>(null);

  React.useEffect(() => {
    if (query.data) setConfig(query.data);
  }, [query.data]);

  if (!config) {
    return <div className="mt-4 text-gray-700 dark:text-gray-300">{query.isError ? 'vMix-instanties laden mislukt' : 'Laden…'}</div>;
  }

  const update = (index: number, patch: Partial<VmixInstancesConfig['instances'][number]>) =>
    setConfig({...config, instances: config.instances.map((instance, i) => i === index ? {...instance, ...patch} : instance)});

  function remove(index: number) {
    if (!config) return;
    const removed = config.instances[index];
    // A function pointing at the removed vMix falls back to the first one
    const targets = Object.fromEntries(Object.entries(config.targets)
      .map(([fn, id]) => [fn, id === removed.id ? '' : id])) as VmixInstancesConfig['targets'];
    setConfig({instances: config.instances.filter((_, i) => i !== index), targets});
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (config) save.mutate(config);
  }

  const firstName = config.instances[0]?.name;

  return (
    <form onSubmit={handleSave} className="mt-4 space-y-6 max-w-3xl">
      <section className="space-y-3">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Eén regel per vMix-pc, bijvoorbeeld een stream-pc en een scherm-pc. De URL is die van de vMix Web Controller, zoals http://192.168.1.50:8088.
        </p>
        {config.instances.length === 0 && (
          <div className="text-sm text-gray-500 dark:text-gray-400">Nog geen vMix ingesteld.</div>
        )}
        {config.instances.map((instance, index) => (
          <div key={instance.id} className="grid grid-cols-1 sm:grid-cols-[12rem_1fr_auto] gap-3 items-end">
            <div>
              <label htmlFor={`vmix-name-${index}`} className={labelClass}>Naam</label>
              <input id={`vmix-name-${index}`} required maxLength={40} value={instance.name} placeholder="Stream-PC"
                     onChange={(e) => update(index, {name: e.target.value})} className={inputClass}/>
            </div>
            <div>
              <label htmlFor={`vmix-url-${index}`} className={labelClass}>Web Controller URL</label>
              <input id={`vmix-url-${index}`} type="url" required value={instance.url} placeholder="http://192.168.1.50:8088"
                     onChange={(e) => update(index, {url: e.target.value})} className={inputClass}/>
            </div>
            <button type="button" onClick={() => remove(index)} aria-label={`${instance.name || 'vMix'} verwijderen`}
                    className="p-2 mb-0.5 rounded-md border border-gray-300 dark:border-gray-700 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20">
              <MdDelete className="w-5 h-5"/>
            </button>
          </div>
        ))}
        <button type="button" disabled={config.instances.length >= 10}
                onClick={() => setConfig({...config, instances: [...config.instances, {id: newId(), name: '', url: ''}]})}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700 text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800">
          <MdAdd/> vMix toevoegen
        </button>
      </section>

      {config.instances.length > 0 && (
        <section className="space-y-3">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">Welke vMix voor welke functie</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {VMIX_FUNCTIONS.map(({key, label}) => (
              <div key={key}>
                <label htmlFor={`vmix-target-${key}`} className={labelClass}>{label}</label>
                <select id={`vmix-target-${key}`} value={config.targets[key] ?? ''} className={inputClass}
                        onChange={(e) => setConfig({...config, targets: {...config.targets, [key]: e.target.value}})}>
                  <option value="">Eerste vMix{firstName ? ` (${firstName})` : ''}</option>
                  {config.instances.map((instance) => (
                    <option key={instance.id} value={instance.id}>{instance.name || '(naamloos)'}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="flex items-center gap-3">
        <button type="submit" disabled={save.isPending}
                className="px-3 py-2 rounded-md border border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20">
          {save.isPending ? 'Opslaan…' : 'Opslaan'}
        </button>
        {save.isSuccess && <span role="status" className="text-sm text-green-700 dark:text-green-400">vMix-instanties opgeslagen</span>}
        {save.isError && <span role="alert" className="text-sm text-red-600">{(save.error as Error).message}</span>}
      </div>
    </form>
  );
}
