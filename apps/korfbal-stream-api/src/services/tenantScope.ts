import {Prisma} from '@prisma/client';
import {requireOrganizationId} from './organizationContext';

/**
 * Prisma client extension that confines every query on a tenant table (a model with
 * `organizationId`) to the organization in the context (services/organizationContext.ts):
 *
 * - `organizationId` is added to `where` of reads, counts, aggregates, updates and deletes, so rows of
 *   another organization are invisible (a single resource answers 404, lists leave it out);
 * - creates (also nested ones, createMany, connectOrCreate, upsert) get the organization set;
 * - `organizationId`/`organization` in update data is dropped, so a row can't be moved (mass assignment);
 * - without an organization in the context the query throws instead of reading everything.
 *
 * Raw SQL ($queryRaw/$executeRaw) is NOT scoped: filter on "organizationId" by hand. A database trigger
 * (migration 20261015200000_organizations) refuses foreign keys to rows of another organization.
 */
export const ORGANIZATION_FIELD = 'organizationId';

type DmmfModel = (typeof Prisma.dmmf.datamodel.models)[number];
// Prisma's argument objects, walked generically
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Data = Record<string, any>;

const models = new Map<string, DmmfModel>(Prisma.dmmf.datamodel.models.map((m) => [m.name, m]));

export const TENANT_MODELS: ReadonlySet<string> = new Set(
  [...models.values()].filter((m) => m.fields.some((f) => f.name === ORGANIZATION_FIELD)).map((m) => m.name),
);

const WHERE_OPERATIONS = new Set([
  'findUnique', 'findUniqueOrThrow', 'findFirst', 'findFirstOrThrow', 'findMany', 'count', 'aggregate', 'groupBy',
  'update', 'updateMany', 'updateManyAndReturn', 'delete', 'deleteMany', 'upsert',
]);

const isTenant = (model: string) => TENANT_MODELS.has(model);
const mapOneOrMany = (value: unknown, fn: (item: Data) => unknown) => (Array.isArray(value) ? value.map(fn) : fn(value as Data));
const isObject = (value: unknown): value is Data => !!value && typeof value === 'object' && !Array.isArray(value);

function relationFields(model: string) {
  return models.get(model)?.fields.filter((f) => f.kind === 'object') ?? [];
}

function withoutOrganization(data: Data): Data {
  const rest = {...data};
  delete rest[ORGANIZATION_FIELD];
  delete rest.organization;
  return rest;
}

function scopeWhere(model: string, where: Data | undefined, organizationId: number): Data | undefined {
  if (!isTenant(model)) return where;
  return {...(where ?? {}), [ORGANIZATION_FIELD]: organizationId};
}

/**
 * Create data in either Prisma form: "checked" (relations as `{connect}`) needs the organization as a
 * relation, "unchecked" (foreign keys as scalars) as `organizationId`. A create is checked when it sets
 * a relation whose foreign key lives on this model.
 */
function scopeCreate(model: string, data: Data, organizationId: number): Data {
  if (!isObject(data)) return data;
  let scoped = scopeNestedWrites(model, data, organizationId);
  if (isTenant(model)) {
    scoped = withoutOrganization(scoped);
    const checked = relationFields(model).some((f) => (f.relationFromFields?.length ?? 0) > 0 && scoped[f.name] !== undefined);
    scoped = checked
      ? {...scoped, organization: {connect: {id: organizationId}}}
      : {...scoped, [ORGANIZATION_FIELD]: organizationId};
  }
  return scoped;
}

function scopeCreateMany(model: string, data: Data | Data[], organizationId: number) {
  return mapOneOrMany(data, (item: Data) =>
    isTenant(model) ? {...withoutOrganization(item), [ORGANIZATION_FIELD]: organizationId} : item);
}

function scopeUpdate(model: string, data: Data, organizationId: number): Data {
  if (!isObject(data)) return data;
  const scoped = scopeNestedWrites(model, data, organizationId);
  return isTenant(model) ? withoutOrganization(scoped) : scoped;
}

/** Nested writes on relations of `model` inside create/update data. */
function scopeNestedWrites(model: string, data: Data, organizationId: number): Data {
  let result = data;
  for (const field of relationFields(model)) {
    const ops = data[field.name];
    if (!isObject(ops)) continue;
    const target = field.type;
    const scoped: Data = {...ops};
    if (ops.create !== undefined) scoped.create = mapOneOrMany(ops.create, (d: Data) => scopeCreate(target, d, organizationId));
    if (isObject(ops.createMany)) {
      scoped.createMany = {...ops.createMany, data: scopeCreateMany(target, ops.createMany.data, organizationId)};
    }
    if (ops.connectOrCreate !== undefined) {
      scoped.connectOrCreate = mapOneOrMany(ops.connectOrCreate, (c: Data) => ({
        ...c,
        where: scopeWhere(target, c.where, organizationId),
        create: scopeCreate(target, c.create, organizationId),
      }));
    }
    if (ops.connect !== undefined) {
      scoped.connect = mapOneOrMany(ops.connect, (w: Data) => scopeWhere(target, w, organizationId));
    }
    if (ops.upsert !== undefined) {
      scoped.upsert = mapOneOrMany(ops.upsert, (u: Data) => ({
        ...u,
        create: scopeCreate(target, u.create, organizationId),
        update: scopeUpdate(target, u.update, organizationId),
      }));
    }
    if (ops.update !== undefined) {
      scoped.update = mapOneOrMany(ops.update, (u: Data) => (isNestedUpdateWithWhere(u)
        ? {...u, data: scopeUpdate(target, u.data, organizationId)}
        : scopeUpdate(target, u, organizationId)));
    }
    if (ops.updateMany !== undefined) {
      scoped.updateMany = mapOneOrMany(ops.updateMany, (u: Data) => ({...u, data: scopeUpdate(target, u.data, organizationId)}));
    }
    if (result === data) result = {...data};
    result[field.name] = scoped;
  }
  return result;
}

/** `{where, data}` (to-many, or to-one with a filter) versus the update data itself (to-one). */
function isNestedUpdateWithWhere(update: Data): boolean {
  return isObject(update) && 'data' in update && Object.keys(update).every((k) => k === 'data' || k === 'where');
}

export function scopeArgs(model: string, operation: string, args: Data | undefined, organizationId: number): Data {
  const scoped: Data = {...(args ?? {})};
  if (WHERE_OPERATIONS.has(operation)) scoped.where = scopeWhere(model, scoped.where, organizationId);
  switch (operation) {
    case 'create':
      scoped.data = scopeCreate(model, scoped.data, organizationId);
      break;
    case 'createMany':
    case 'createManyAndReturn':
      scoped.data = scopeCreateMany(model, scoped.data, organizationId);
      break;
    case 'update':
    case 'updateMany':
    case 'updateManyAndReturn':
      scoped.data = scopeUpdate(model, scoped.data, organizationId);
      break;
    case 'upsert':
      scoped.create = scopeCreate(model, scoped.create, organizationId);
      scoped.update = scopeUpdate(model, scoped.update, organizationId);
      break;
  }
  return scoped;
}

export const tenantScope = Prisma.defineExtension({
  name: 'tenantScope',
  query: {
    $allModels: {
      $allOperations({model, operation, args, query}) {
        if (!isTenant(model)) return query(args);
        const organizationId = requireOrganizationId(`${model}.${operation}`);
        return query(scopeArgs(model, operation, args as Data, organizationId) as typeof args);
      },
    },
  },
});
