import {z} from 'zod';

/** The functions that send commands to vMix; each one goes to the instance chosen for it. */
export const VMIX_FUNCTIONS = ['countdown', 'callsheet'] as const;
export type VmixFunction = typeof VMIX_FUNCTIONS[number];

export const VmixInstanceSchema = z.object({
  /** Stable id that targets refer to; assigned by the server when missing, kept when renaming. */
  id: z.string().trim().regex(/^[a-z0-9-]{1,40}$/, 'Use lowercase letters, digits and dashes').optional(),
  name: z.string().trim().min(1).max(40),
  url: z.string().trim().url(),
});

/** Instance id per function; empty means the first instance. */
export const VmixTargetsSchema = z.object(
  Object.fromEntries(VMIX_FUNCTIONS.map((f) => [f, z.string().trim().max(40).default('')])) as Record<VmixFunction, z.ZodDefault<z.ZodString>>
);

export const VmixInstancesConfigSchema = z.object({
  instances: z.array(VmixInstanceSchema).max(10).default([]),
  targets: VmixTargetsSchema.default({}),
}).superRefine((value, ctx) => {
  const names = value.instances.map((i) => i.name.toLowerCase());
  names.forEach((name, index) => {
    if (names.indexOf(name) !== index) ctx.addIssue({code: 'custom', path: ['instances', index, 'name'], message: 'Name must be unique'});
  });
  const ids = value.instances.map((i) => i.id).filter(Boolean);
  ids.forEach((id, index) => {
    if (ids.indexOf(id) !== index) ctx.addIssue({code: 'custom', path: ['instances'], message: `Duplicate id ${id}`});
  });
  for (const fn of VMIX_FUNCTIONS) {
    const target = value.targets[fn];
    if (target && !value.instances.some((i) => i.id === target)) {
      ctx.addIssue({code: 'custom', path: ['targets', fn], message: `Unknown vMix instance ${target}`});
    }
  }
});

export type VmixInstance = Required<z.infer<typeof VmixInstanceSchema>>;
export type VmixTargets = z.infer<typeof VmixTargetsSchema>;
export type VmixInstancesConfig = { instances: VmixInstance[]; targets: VmixTargets };
