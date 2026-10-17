import {AsyncLocalStorage} from 'node:async_hooks';

/**
 * The organization a piece of work runs for. Requests get it from the `organizationContext`
 * middleware (X-Organization header); code outside a request (seed, startup, background services,
 * timers) sets it with `runWithOrganization`. The Prisma extension in services/prisma.ts reads it to
 * scope every query on a tenant table, and throws when it is missing.
 */
// One instance per process, also when this module is loaded twice (test-scenarios.ts, shared with
// the e2e tests, reaches it through the same global key instead of importing it)
const STORAGE_KEY = Symbol.for('korfbal-stream.organization-context');
const holder = globalThis as unknown as Record<symbol, AsyncLocalStorage<{organizationId: number}> | undefined>;
const storage = (holder[STORAGE_KEY] ??= new AsyncLocalStorage<{organizationId: number}>());

export class MissingOrganizationContextError extends Error {
  constructor(what = 'This query') {
    super(`${what} needs an organization: run it inside runWithOrganization() or a request with X-Organization`);
    this.name = 'MissingOrganizationContextError';
  }
}

export function runWithOrganization<T>(organizationId: number, fn: () => T): T {
  if (!Number.isInteger(organizationId) || organizationId <= 0) {
    throw new Error(`Invalid organization id: ${organizationId}`);
  }
  return storage.run({organizationId}, () => {
    const result = fn();
    // Prisma queries are lazy: they run when `.then` is called. Call it here, inside the context, so
    // `await runWithOrganization(id, () => prisma.x.findMany())` doesn't run the query outside it.
    return isThenable(result) ? (result.then((value) => value) as T) : result;
  });
}

function isThenable(value: unknown): value is PromiseLike<unknown> {
  return !!value && typeof (value as PromiseLike<unknown>).then === 'function';
}

/** Leaves the organization context, for work on global data only (seasons, clubs, organizations). */
export function runWithoutOrganization<T>(fn: () => T): T {
  return storage.exit(fn);
}

export function getOrganizationId(): number | undefined {
  return storage.getStore()?.organizationId;
}

export function requireOrganizationId(what?: string): number {
  const organizationId = getOrganizationId();
  if (organizationId === undefined) throw new MissingOrganizationContextError(what);
  return organizationId;
}

/**
 * `fn` bound to the organization of the current context, for timers and callbacks that may fire
 * elsewhere (fake timers, event emitters). Without a context it is returned unchanged.
 */
export function bindOrganization<A extends unknown[], R>(fn: (...args: A) => R): (...args: A) => R {
  const organizationId = getOrganizationId();
  if (organizationId === undefined) return fn;
  return (...args: A) => runWithOrganization(organizationId, () => fn(...args));
}
