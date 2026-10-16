import {describe, expect, it} from 'vitest';
import {scopeArgs, TENANT_MODELS} from './tenantScope';

const ORG = 7;

describe('tenantScope', () => {
  it('treats every model with organizationId as a tenant model, and the global ones not', () => {
    for (const model of ['Production', 'ProductionEvent', 'CallSheetItemPosition', 'PersonSkill', 'Sponsor', 'OrganizationSetting', 'MatchSource']) {
      expect(TENANT_MODELS.has(model), model).toBe(true);
    }
    for (const model of ['Season', 'Club', 'Player', 'PlayerImage', 'Organization', 'Setting']) {
      expect(TENANT_MODELS.has(model), model).toBe(false);
    }
  });

  it('adds the organization to where of reads, counts, updates and deletes', () => {
    for (const operation of ['findUnique', 'findFirst', 'findMany', 'count', 'aggregate', 'groupBy', 'update', 'updateMany', 'delete', 'deleteMany']) {
      expect(scopeArgs('Sponsor', operation, {where: {id: 1}}, ORG).where, operation).toEqual({id: 1, organizationId: ORG});
    }
    expect(scopeArgs('Sponsor', 'findMany', undefined, ORG).where).toEqual({organizationId: ORG});
  });

  it('overrides an organizationId in where (no reading another organization by asking for it)', () => {
    expect(scopeArgs('Sponsor', 'findMany', {where: {organizationId: 99}}, ORG).where).toEqual({organizationId: ORG});
  });

  it('leaves global models alone', () => {
    expect(scopeArgs('Season', 'findMany', {where: {id: 1}}, ORG)).toEqual({where: {id: 1}});
    expect(scopeArgs('Club', 'create', {data: {name: 'x'}}, ORG)).toEqual({data: {name: 'x'}});
  });

  it('sets the organization on unchecked creates and replaces one in the data', () => {
    expect(scopeArgs('ProductionSegment', 'create', {data: {productionId: 1, naam: 'x', organizationId: 99}}, ORG).data)
      .toEqual({productionId: 1, naam: 'x', organizationId: ORG});
  });

  it('connects the organization on checked creates (relations via connect)', () => {
    const data = scopeArgs('ProductionSegment', 'create', {data: {production: {connect: {id: 1}}, naam: 'x', organizationId: 99}}, ORG).data;
    expect(data).toEqual({production: {connect: {id: 1, organizationId: ORG}}, naam: 'x', organization: {connect: {id: ORG}}});
  });

  it('scopes nested creates, createMany, connectOrCreate and connect', () => {
    const data = scopeArgs('Production', 'create', {
      data: {
        matchScheduleId: 1,
        segments: {create: [{naam: 'a', volgorde: 1, duurInMinuten: 1}]},
        productionReport: {create: {remarks: 'r'}},
        callSheets: {createMany: {data: [{name: 'c', organizationId: 99}]}},
        productionPersons: {connectOrCreate: {where: {id: 5}, create: {personId: 2}}},
        TitleDefinition: {connect: [{id: 3}]},
      },
    }, ORG).data;
    expect(data.organizationId).toBe(ORG);
    expect(data.segments.create[0].organizationId).toBe(ORG);
    expect(data.productionReport.create.organizationId).toBe(ORG);
    expect(data.callSheets.createMany.data).toEqual([{name: 'c', organizationId: ORG}]);
    expect(data.productionPersons.connectOrCreate).toEqual({where: {id: 5, organizationId: ORG}, create: {personId: 2, organizationId: ORG}});
    expect(data.TitleDefinition.connect).toEqual([{id: 3, organizationId: ORG}]);
  });

  it('scopes creates nested two levels deep', () => {
    const data = scopeArgs('ProductionEvent', 'create', {
      data: {productionId: 1, title: 't', order: 1, positions: {create: [{positionId: 4}]}},
    }, ORG).data;
    expect(data.positions.create).toEqual([{positionId: 4, organizationId: ORG}]);
  });

  it('drops organizationId and organization from update data (mass assignment)', () => {
    expect(scopeArgs('Sponsor', 'update', {where: {id: 1}, data: {name: 'x', organizationId: 99}}, ORG).data).toEqual({name: 'x'});
    expect(scopeArgs('Sponsor', 'updateMany', {data: {organization: {connect: {id: 99}}}}, ORG).data).toEqual({});
  });

  it('scopes nested writes inside update data', () => {
    const data = scopeArgs('Production', 'update', {
      where: {id: 1},
      data: {
        segments: {create: {naam: 'n', volgorde: 2, duurInMinuten: 1}, update: [{where: {id: 2}, data: {organizationId: 99, naam: 'm'}}]},
        productionReport: {upsert: {create: {remarks: 'c'}, update: {remarks: 'u', organizationId: 99}}},
      },
    }, ORG).data;
    expect(data.segments.create.organizationId).toBe(ORG);
    expect(data.segments.update).toEqual([{where: {id: 2}, data: {naam: 'm'}}]);
    expect(data.productionReport.upsert).toEqual({create: {remarks: 'c', organizationId: ORG}, update: {remarks: 'u'}});
  });

  it('scopes upsert: where, create and update', () => {
    const args = scopeArgs('Skill', 'upsert', {where: {id: 1}, create: {code: 'A', name: 'a', nameMale: 'a', nameFemale: 'a', organizationId: 99}, update: {organizationId: 99}}, ORG);
    expect(args.where).toEqual({id: 1, organizationId: ORG});
    expect(args.create.organizationId).toBe(ORG);
    expect(args.update).toEqual({});
  });

  it('sets the organization on createMany rows', () => {
    expect(scopeArgs('PersonSkill', 'createMany', {data: [{personId: 1, skillId: 2}, {personId: 1, skillId: 3, organizationId: 99}]}, ORG).data)
      .toEqual([{personId: 1, skillId: 2, organizationId: ORG}, {personId: 1, skillId: 3, organizationId: ORG}]);
  });

  it('does not change the caller\'s objects', () => {
    const data = {name: 'x', organizationId: 99};
    scopeArgs('Sponsor', 'update', {where: {id: 1}, data}, ORG);
    expect(data).toEqual({name: 'x', organizationId: 99});
  });
});
