import {Prisma} from '@prisma/client';
import {getSetting, setSetting, VMIX_URL_KEY} from './appSettings';
import {
  VMIX_FUNCTIONS,
  VmixFunction,
  VmixInstance,
  VmixInstancesConfig,
  VmixInstancesConfigSchema,
  VmixTargetsSchema
} from '../schemas/vmixInstances';

export const VMIX_INSTANCES_KEY = 'vmixInstances';

function slug(name: string): string {
  return name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30) || 'vmix';
}

/** Gives instances without an id one derived from their name, unique within the list. */
export function assignIds(instances: Array<{ id?: string; name: string; url: string }>): VmixInstance[] {
  const taken = new Set(instances.map((i) => i.id).filter(Boolean) as string[]);
  return instances.map((instance) => {
    if (instance.id) return {...instance, id: instance.id};
    const base = slug(instance.name);
    let id = base;
    for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
    taken.add(id);
    return {...instance, id};
  });
}

/**
 * The vMix instances and which one each function uses. Before there were several instances only
 * the single vMix URL existed; that one becomes the first instance.
 */
export async function getVmixInstancesConfig(): Promise<VmixInstancesConfig> {
  const stored = await getSetting<unknown>(VMIX_INSTANCES_KEY);
  if (stored) {
    const parsed = VmixInstancesConfigSchema.safeParse(stored);
    if (parsed.success) return {instances: assignIds(parsed.data.instances), targets: parsed.data.targets};
  }
  const legacyUrl = await getSetting<string>(VMIX_URL_KEY);
  return {
    instances: legacyUrl ? [{id: 'vmix', name: 'vMix', url: legacyUrl}] : [],
    targets: VmixTargetsSchema.parse({}),
  };
}

export async function setVmixInstancesConfig(input: unknown): Promise<VmixInstancesConfig> {
  const parsed = VmixInstancesConfigSchema.parse(input);
  const config: VmixInstancesConfig = {instances: assignIds(parsed.instances), targets: parsed.targets};
  await setSetting(VMIX_INSTANCES_KEY, config as unknown as Prisma.JsonObject);
  // Keep the single URL in step with the first instance, for clients of /api/settings/vmix-url
  await setSetting(VMIX_URL_KEY, config.instances[0]?.url ?? null);
  return config;
}

export type ResolvedVmix = { instance: VmixInstance } | { error: string };

/** The instance a function sends to: the one chosen for it, else the first one. */
export async function resolveVmixInstance(fn: VmixFunction, override?: string | null): Promise<ResolvedVmix> {
  const {instances, targets} = await getVmixInstancesConfig();
  const wanted = override || targets[fn];
  if (wanted) {
    const instance = instances.find((i) => i.id === wanted);
    return instance ? {instance} : {error: `vMix instance "${wanted}" is not configured`};
  }
  return instances[0] ? {instance: instances[0]} : {error: 'vMix Web URL is not configured'};
}

/** For the single URL endpoint: change the first instance, or create it. */
export async function setFirstVmixUrl(url: string): Promise<void> {
  const config = await getVmixInstancesConfig();
  const [first, ...rest] = config.instances;
  await setVmixInstancesConfig({
    instances: [first ? {...first, url} : {name: 'vMix', url}, ...rest],
    targets: config.targets,
  });
}

export {VMIX_FUNCTIONS};
