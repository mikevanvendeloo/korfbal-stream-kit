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
 * Global models (Season, Club, Player, Organization, ...) are not scoped themselves, but their relations
 * into tenant tables are: `include`/`select` of such a relation and `_count` of it only see the
 * organization in the context (`where: {organizationId}`), and nested writes into it (connect, set,
 * update, delete, ...) only reach rows of that organization. Touching such a relation without a context
 * throws. A to-one relation from a global model into a tenant table (Organization.matchSource) can't be
 * filtered, and nested writes into the Organization's own relations would move rows between
 * organizations: both throw (query the tenant model itself instead).
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
/** The organization in the context, read only when a query needs it (global models mostly don't). */
type OrganizationRef = () => number;
type Field = DmmfModel['fields'][number];

/** A relation the scope can't confine to one organization. */
export class UnscopableRelationError extends Error {
  constructor(relation: string) {
    super(`${relation} can't be scoped to the organization in the context: query the tenant model itself`);
    this.name = 'UnscopableRelationError';
  }
}
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

function scopeWhere(model: string, where: Data | undefined, organization: OrganizationRef): Data | undefined {
  if (!isTenant(model)) return where;
  return {...(where ?? {}), [ORGANIZATION_FIELD]: organization()};
}

/** A relation from a global model into a tenant table (Season.matches, Player.interviewSubjects, Organization.*). */
function isGlobalToTenant(model: string, field: Field): boolean {
  return !isTenant(model) && isTenant(field.type);
}

/** Organization.sponsors etc.: the other side is the tenant row's own `organization`. */
function isOwnOrganizationRelation(field: Field): boolean {
  return models.get(field.type)?.fields.some((f) => f.name === 'organization' && f.relationName === field.relationName) ?? false;
}

/**
 * Create data in either Prisma form: "checked" (relations as `{connect}`) needs the organization as a
 * relation, "unchecked" (foreign keys as scalars) as `organizationId`. A create is checked when it sets
 * a relation whose foreign key lives on this model.
 */
function scopeCreate(model: string, data: Data, organization: OrganizationRef): Data {
  if (!isObject(data)) return data;
  let scoped = scopeNestedWrites(model, data, organization);
  if (isTenant(model)) {
    scoped = withoutOrganization(scoped);
    const checked = relationFields(model).some((f) => (f.relationFromFields?.length ?? 0) > 0 && scoped[f.name] !== undefined);
    scoped = checked
      ? {...scoped, organization: {connect: {id: organization()}}}
      : {...scoped, [ORGANIZATION_FIELD]: organization()};
  }
  return scoped;
}

function scopeCreateMany(model: string, data: Data | Data[], organization: OrganizationRef) {
  return mapOneOrMany(data, (item: Data) =>
    isTenant(model) ? {...withoutOrganization(item), [ORGANIZATION_FIELD]: organization()} : item);
}

function scopeUpdate(model: string, data: Data, organization: OrganizationRef): Data {
  if (!isObject(data)) return data;
  const scoped = scopeNestedWrites(model, data, organization);
  return isTenant(model) ? withoutOrganization(scoped) : scoped;
}

/** Nested writes on relations of `model` inside create/update data. */
function scopeNestedWrites(model: string, data: Data, organization: OrganizationRef): Data {
  let result = data;
  for (const field of relationFields(model)) {
    const ops = data[field.name];
    if (!isObject(ops)) continue;
    const target = field.type;
    // From a tenant row its children are in the same organization (database trigger); from a global row
    // every nested write into a tenant table has to be confined here.
    const fromGlobal = isGlobalToTenant(model, field);
    if (fromGlobal && (!field.isList || isOwnOrganizationRelation(field))) throw new UnscopableRelationError(`${model}.${field.name}`);
    if (fromGlobal) organization(); // fails without a context, whatever the operation
    const where = (w: Data) => scopeWhere(target, w, organization);
    const scoped: Data = {...ops};
    if (ops.create !== undefined) scoped.create = mapOneOrMany(ops.create, (d: Data) => scopeCreate(target, d, organization));
    if (isObject(ops.createMany)) {
      scoped.createMany = {...ops.createMany, data: scopeCreateMany(target, ops.createMany.data, organization)};
    }
    if (ops.connectOrCreate !== undefined) {
      scoped.connectOrCreate = mapOneOrMany(ops.connectOrCreate, (c: Data) => ({
        ...c,
        where: where(c.where),
        create: scopeCreate(target, c.create, organization),
      }));
    }
    if (ops.connect !== undefined) scoped.connect = mapOneOrMany(ops.connect, where);
    if (ops.set !== undefined && isTenant(target)) scoped.set = mapOneOrMany(ops.set, where);
    if (ops.upsert !== undefined) {
      scoped.upsert = mapOneOrMany(ops.upsert, (u: Data) => ({
        ...u,
        ...(fromGlobal ? {where: where(u.where)} : {}),
        create: scopeCreate(target, u.create, organization),
        update: scopeUpdate(target, u.update, organization),
      }));
    }
    if (ops.update !== undefined) {
      scoped.update = mapOneOrMany(ops.update, (u: Data) => (isNestedUpdateWithWhere(u)
        ? {...u, ...(fromGlobal ? {where: where(u.where)} : {}), data: scopeUpdate(target, u.data, organization)}
        : scopeUpdate(target, u, organization)));
    }
    if (ops.updateMany !== undefined) {
      scoped.updateMany = mapOneOrMany(ops.updateMany, (u: Data) => ({
        ...u,
        ...(fromGlobal ? {where: where(u.where)} : {}),
        data: scopeUpdate(target, u.data, organization),
      }));
    }
    if (fromGlobal) {
      for (const op of ['disconnect', 'delete', 'deleteMany'] as const) {
        if (ops[op] !== undefined) scoped[op] = mapOneOrMany(ops[op], where);
      }
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

/**
 * `include`/`select` (at any depth): relations from a global model into a tenant table get
 * `where: {organizationId}`, and so do their counts in `_count`. Relations between tenant rows need
 * nothing (same organization), but the walk goes on, since a tenant row can lead to a global one again
 * (match -> season -> matches).
 */
function scopeSelection(model: string, selection: unknown, organization: OrganizationRef): unknown {
  if (!isObject(selection)) return selection;
  let result = selection;
  const set = (key: string, value: unknown) => {
    if (result === selection) result = {...selection};
    result[key] = value;
  };
  for (const field of relationFields(model)) {
    const value = selection[field.name];
    if (value === undefined || value === false) continue;
    let next: unknown = value;
    if (isGlobalToTenant(model, field)) {
      if (!field.isList) throw new UnscopableRelationError(`${model}.${field.name}`);
      const relationArgs = isObject(value) ? value : {};
      next = {...relationArgs, where: scopeWhere(field.type, relationArgs.where, organization)};
    }
    if (isObject(next)) next = scopeRelationArgs(field.type, next, organization);
    if (next !== value) set(field.name, next);
  }
  if (selection._count !== undefined && selection._count !== false) {
    const count = scopeCount(model, selection._count, organization);
    if (count !== selection._count) set('_count', count);
  }
  return result;
}

/** The `include`/`select` inside one relation's arguments. */
function scopeRelationArgs(model: string, args: Data, organization: OrganizationRef): Data {
  let result = args;
  for (const key of ['include', 'select']) {
    if (!isObject(args[key])) continue;
    const scoped = scopeSelection(model, args[key], organization);
    if (scoped === args[key]) continue;
    if (result === args) result = {...args};
    result[key] = scoped;
  }
  return result;
}

/** `_count: true` or `_count: {select: {...}}`: counts of relations into tenant tables only see the organization. */
function scopeCount(model: string, count: unknown, organization: OrganizationRef): unknown {
  const tenantLists = relationFields(model).filter((f) => f.isList && isGlobalToTenant(model, f));
  if (tenantLists.length === 0) return count;
  let select: Data;
  if (count === true) {
    select = Object.fromEntries(relationFields(model).filter((f) => f.isList).map((f) => [f.name, true]));
  } else if (isObject(count) && isObject(count.select)) {
    select = count.select;
  } else {
    return count;
  }
  const scoped: Data = {...select};
  for (const field of tenantLists) {
    const value = select[field.name];
    if (value === undefined || value === false) continue;
    const countArgs = isObject(value) ? value : {};
    scoped[field.name] = {...countArgs, where: scopeWhere(field.type, countArgs.where, organization)};
  }
  return {...(isObject(count) ? count : {}), select: scoped};
}

/** Operations whose `select` names fields of the result, not relations (count: `{_all: true}`). */
const NO_RELATION_SELECTION = new Set(['count', 'aggregate', 'groupBy']);

/**
 * Scopes a query's arguments. `organization` is the organization id, or a function that returns it
 * (and throws without a context): global models only read it when they touch a tenant relation.
 */
export function scopeArgs(model: string, operation: string, args: Data | undefined, organization: number | OrganizationRef): Data {
  const ref: OrganizationRef = typeof organization === 'number' ? () => organization : organization;
  const scoped: Data = {...(args ?? {})};
  if (WHERE_OPERATIONS.has(operation) && isTenant(model)) scoped.where = scopeWhere(model, scoped.where, ref);
  switch (operation) {
    case 'create':
      scoped.data = scopeCreate(model, scoped.data, ref);
      break;
    case 'createMany':
    case 'createManyAndReturn':
      scoped.data = scopeCreateMany(model, scoped.data, ref);
      break;
    case 'update':
    case 'updateMany':
    case 'updateManyAndReturn':
      scoped.data = scopeUpdate(model, scoped.data, ref);
      break;
    case 'upsert':
      scoped.create = scopeCreate(model, scoped.create, ref);
      scoped.update = scopeUpdate(model, scoped.update, ref);
      break;
  }
  if (!NO_RELATION_SELECTION.has(operation)) {
    for (const key of ['include', 'select']) {
      if (scoped[key] !== undefined) scoped[key] = scopeSelection(model, scoped[key], ref);
    }
  }
  return scoped;
}

export const tenantScope = Prisma.defineExtension({
  name: 'tenantScope',
  query: {
    $allModels: {
      $allOperations({model, operation, args, query}) {
        const what = `${model}.${operation}`;
        // Global models only need the organization for their relations into tenant tables
        const organization = isTenant(model) ? requireOrganizationId(what) : () => requireOrganizationId(what);
        return query(scopeArgs(model, operation, args as Data, organization) as typeof args);
      },
    },
  },
});
