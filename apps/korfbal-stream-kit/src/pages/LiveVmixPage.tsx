import {useMutation} from '@tanstack/react-query';
import {vmixSetTimer} from '../lib/api';
import {useVmixCallsheetPushConfig} from '../hooks/useVmixCallsheetPush';
import {CallsheetPushPreview} from '../components/VmixCallsheetPushSettings';
import {targetInstance, useVmixInstances} from '../hooks/useVmixInstances';

function SendsTo({name}: { name?: string }) {
  return (
    <span className="ml-2 text-xs font-normal px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
      {name ? `naar ${name}` : 'geen vMix ingesteld'}
    </span>
  );
}

const TIMERS = [{seconds: 10, label: '10s'}, {seconds: 30, label: '30s'}, {seconds: 60, label: '1m'}];

/** LIVE: operating vMix during the broadcast. How the kit connects to vMix is set up in Beheer. */
export default function LiveVmixPage() {
  const config = useVmixCallsheetPushConfig(5000);
  const timer = useMutation({mutationFn: vmixSetTimer});
  const instances = useVmixInstances();

  return (
    <div className="container py-6 space-y-8 text-gray-800 dark:text-gray-100">
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">vMix</h1>

      <section>
        <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">Countdown timer<SendsTo name={targetInstance(instances.data, 'countdown')?.name}/></h2>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {TIMERS.map(({seconds, label}) => (
            <button key={seconds} type="button" disabled={timer.isPending} onClick={() => timer.mutate(seconds)}
                    className="px-4 py-2 rounded-md border border-gray-300 dark:border-gray-700 text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800">
              {label}
            </button>
          ))}
          {timer.isSuccess && <span role="status" className="text-sm text-green-700 dark:text-green-400">Timer op {timer.data.seconds} seconden gezet in {timer.data.instance}</span>}
          {timer.isError && <span role="alert" className="text-sm text-red-600">{(timer.error as Error).message}</span>}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">Callsheet naar vMix (presentator & analist)<SendsTo name={targetInstance(instances.data, 'callsheet')?.name}/></h2>
        {config.data && (
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Automatisch pushen staat <strong>{config.data.enabled ? 'aan' : 'uit'}</strong>
            {config.data.input && <> naar title <code>{config.data.input}</code></>}.
          </p>
        )}
        {config.isError && <div role="alert" className="mt-2 text-sm text-red-600">Instellingen laden mislukt</div>}
        {config.data && <div className="mt-3"><CallsheetPushPreview colors={config.data}/></div>}
      </section>
    </div>
  );
}
