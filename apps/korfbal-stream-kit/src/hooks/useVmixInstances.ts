import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {createUrl, extractError} from '../lib/api';

/** The functions that send to vMix; mirrors VMIX_FUNCTIONS in the API. */
export const VMIX_FUNCTIONS = [
  {key: 'countdown', label: 'Countdown timer'},
  {key: 'callsheet', label: 'Callsheet naar vMix (presentator & analist)'},
] as const;
export type VmixFunction = typeof VMIX_FUNCTIONS[number]['key'];

export type VmixInstance = { id: string; name: string; url: string };
/** Instance id per function; empty means the first instance. */
export type VmixTargets = Record<VmixFunction, string>;
export type VmixInstancesConfig = { instances: VmixInstance[]; targets: VmixTargets };

const KEY = ['vmix-instances'];

export function useVmixInstances() {
  return useQuery({
    queryKey: KEY,
    queryFn: async (): Promise<VmixInstancesConfig> => {
      const res = await fetch(createUrl('/api/settings/vmix-instances'));
      if (!res.ok) throw new Error(await extractError(res));
      return res.json();
    },
  });
}

export function useSaveVmixInstances() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (config: VmixInstancesConfig): Promise<VmixInstancesConfig> => {
      const res = await fetch(createUrl('/api/settings/vmix-instances'), {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(config),
      });
      if (!res.ok) throw new Error(await extractError(res));
      return res.json();
    },
    onSuccess: (data) => qc.setQueryData(KEY, data),
  });
}

/** The instance a function sends to: the one chosen for it, else the first one. */
export function targetInstance(config: VmixInstancesConfig | undefined, fn: VmixFunction): VmixInstance | undefined {
  if (!config) return undefined;
  const id = config.targets[fn];
  return id ? config.instances.find((i) => i.id === id) : config.instances[0];
}
