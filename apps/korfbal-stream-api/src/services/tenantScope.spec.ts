import {describe, expect, it} from 'vitest';
import {scopeArgs, TENANT_MODELS, UnscopableRelationError} from './tenantScope';
import {MissingOrganizationContextError} from './organizationContext';

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
    expect(scopeArgs('ProductionChapter', 'create', {data: {productionId: 1, naam: 'x', organizationId: 99}}, ORG).data)
      .toEqual({productionId: 1, naam: 'x', organizationId: ORG});
  });

  it('connects the organization on checked creates (relations via connect)', () => {
    const data = scopeArgs('ProductionChapter', 'create', {data: {production: {connect: {id: 1}}, naam: 'x', organizationId: 99}}, ORG).data;
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

  describe('relations of global models into tenant tables', () => {
    const own = {organizationId: ORG};
    const noContext = () => {
      throw new MissingOrganizationContextError('test');
    };

    it('scopes include and select of a to-many relation, keeping its own arguments', () => {
      expect(scopeArgs('Season', 'findMany', {include: {matches: true, players: true}}, ORG).include)
        .toEqual({matches: {where: own}, players: true});
      expect(scopeArgs('Season', 'findUnique', {where: {id: 1}, select: {id: true, matches: {where: {isManual: true}, take: 5}}}, ORG).select)
        .toEqual({id: true, matches: {where: {isManual: true, organizationId: ORG}, take: 5}});
      expect(scopeArgs('Player', 'findFirst', {include: {interviewSubjects: {select: {id: true}}}}, ORG).include)
        .toEqual({interviewSubjects: {select: {id: true}, where: own}});
      expect(scopeArgs('Organization', 'findMany', {include: {sponsors: true, club: true}}, ORG).include)
        .toEqual({sponsors: {where: own}, club: true});
    });

    it('scopes them at any depth, also behind a tenant model', () => {
      const include = scopeArgs('MatchSchedule', 'findMany', {include: {season: {include: {matches: true}}, productions: true}}, ORG).include;
      expect(include).toEqual({season: {include: {matches: {where: own}}}, productions: true});
      const nested = scopeArgs('Club', 'findMany', {include: {players: {include: {interviewSubjects: true}}}}, ORG).include;
      expect(nested).toEqual({players: {include: {interviewSubjects: {where: own}}}});
    });

    it('scopes _count of a tenant relation, in include, select and as _count: true', () => {
      expect(scopeArgs('Season', 'findMany', {include: {_count: {select: {matches: true, players: true}}}}, ORG).include)
        .toEqual({_count: {select: {matches: {where: own}, players: true}}});
      expect(scopeArgs('Season', 'findMany', {select: {_count: {select: {matches: {where: {isManual: true}}}}}}, ORG).select)
        .toEqual({_count: {select: {matches: {where: {isManual: true, organizationId: ORG}}}}});
      expect(scopeArgs('Season', 'findMany', {include: {_count: true}}, ORG).include)
        .toEqual({_count: {select: {matches: {where: own}, players: true}}});
      expect(scopeArgs('Club', 'findMany', {include: {_count: true}}, ORG).include).toEqual({_count: true});
    });

    it('leaves relations between tenant rows and the select of count alone', () => {
      expect(scopeArgs('Production', 'findMany', {include: {segments: true, _count: true}}, ORG).include).toEqual({segments: true, _count: true});
      expect(scopeArgs('Season', 'count', {select: {_all: true}}, ORG).select).toEqual({_all: true});
    });

    it('refuses a to-one relation into a tenant table, which can\'t be filtered', () => {
      expect(() => scopeArgs('Organization', 'findUnique', {where: {id: 1}, include: {matchSource: true}}, ORG)).toThrow(UnscopableRelationError);
      expect(() => scopeArgs('Organization', 'findMany', {select: {matchSource: {select: {apiToken: true}}}}, ORG)).toThrow(UnscopableRelationError);
    });

    it('needs a context only when a tenant relation is touched', () => {
      expect(scopeArgs('Season', 'findMany', {include: {players: true, _count: {select: {players: true}}}}, noContext).include)
        .toEqual({players: true, _count: {select: {players: true}}});
      expect(scopeArgs('Organization', 'update', {where: {id: 1}, data: {name: 'x'}, include: {club: true}}, noContext).data).toEqual({name: 'x'});
      expect(() => scopeArgs('Season', 'findMany', {include: {matches: true}}, noContext)).toThrow(MissingOrganizationContextError);
      expect(() => scopeArgs('Season', 'findMany', {include: {_count: {select: {matches: true}}}}, noContext)).toThrow(MissingOrganizationContextError);
      expect(() => scopeArgs('Season', 'update', {where: {id: 1}, data: {matches: {disconnect: {id: 2}}}}, noContext)).toThrow(MissingOrganizationContextError);
    });

    it('scopes every nested write into a tenant relation', () => {
      const data = scopeArgs('Season', 'update', {
        where: {id: 1},
        data: {
          matches: {
            connect: {id: 1},
            set: [{id: 2}],
            disconnect: [{id: 3}],
            delete: {id: 4},
            deleteMany: {isManual: true},
            update: {where: {id: 5}, data: {homeTeamName: 'x', organizationId: 99}},
            updateMany: [{where: {isManual: true}, data: {awayTeamName: 'y'}}],
            upsert: {where: {id: 6}, create: {date: 'd', homeTeamName: 'h', awayTeamName: 'a'}, update: {homeTeamName: 'h'}},
            create: {date: 'd', homeTeamName: 'h', awayTeamName: 'a'},
          },
        },
      }, ORG).data;
      expect(data.matches).toEqual({
        connect: {id: 1, ...own},
        set: [{id: 2, ...own}],
        disconnect: [{id: 3, ...own}],
        delete: {id: 4, ...own},
        deleteMany: {isManual: true, ...own},
        update: {where: {id: 5, ...own}, data: {homeTeamName: 'x'}},
        updateMany: [{where: {isManual: true, ...own}, data: {awayTeamName: 'y'}}],
        upsert: {where: {id: 6, ...own}, create: {date: 'd', homeTeamName: 'h', awayTeamName: 'a', ...own}, update: {homeTeamName: 'h'}},
        create: {date: 'd', homeTeamName: 'h', awayTeamName: 'a', ...own},
      });
      expect(scopeArgs('Player', 'update', {where: {id: 1}, data: {interviewSubjects: {set: []}}}, ORG).data).toEqual({interviewSubjects: {set: []}});
    });

    it('refuses nested writes into the Organization\'s own relations (they would move rows) and into to-one tenant relations', () => {
      expect(() => scopeArgs('Organization', 'update', {where: {id: 2}, data: {sponsors: {connect: {id: 1}}}}, ORG)).toThrow(UnscopableRelationError);
      expect(() => scopeArgs('Organization', 'create', {data: {slug: 's', name: 'n', persons: {create: {name: 'p'}}}}, ORG)).toThrow(UnscopableRelationError);
      expect(() => scopeArgs('Organization', 'update', {where: {id: 2}, data: {matchSource: {delete: true}}}, ORG)).toThrow(UnscopableRelationError);
    });

    it('also scopes set on relations of tenant rows (it connects)', () => {
      expect(scopeArgs('Production', 'update', {where: {id: 1}, data: {productionPersons: {set: [{id: 2}]}}}, ORG).data.productionPersons)
        .toEqual({set: [{id: 2, ...own}]});
    });
  });
});
