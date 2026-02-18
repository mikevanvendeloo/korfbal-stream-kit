import request from 'supertest';
import app from '../../main';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import * as prismaSvc from '../../services/prisma';

const prisma = (prismaSvc as any).prisma as any;

describe('Production Export/Import API', () => {
  let productionData: any;

  beforeEach(() => {
    productionData = {
      matchSchedule: {
        externalId: 'MATCH-123',
        date: '2023-10-27T19:00:00.000Z',
        homeTeamName: 'Home Team',
        awayTeamName: 'Away Team',
      },
      production: {
        isActive: true,
        liveTime: '2023-10-27T18:55:00.000Z',
        report: {
          matchSponsor: 'Sponsor X',
          remarks: 'Test remarks'
        }
      },
      persons: [
        {
          name: 'Person A',
          gender: 'male',
          skills: [{ code: 'CAM', name: 'Camera', nameMale: 'Cameraman', nameFemale: 'Cameravrouw', type: 'crew' }]
        }
      ],
      positions: [
        { personName: 'Person A', positionName: 'Camera 1', isStudio: false }
      ],
      segments: [
        {
          naam: 'Segment 1',
          volgorde: 1,
          duurInMinuten: 10,
          isTimeAnchor: false,
          assignments: [{ personName: 'Person A', positionName: 'Camera 1', isStudio: false }]
        }
      ],
      interviews: [
        {
          side: 'HOME',
          role: 'PLAYER',
          playerName: 'Player 1',
          clubSlug: 'home-team',
          clubName: 'Home Team',
          clubShortName: 'Home'
        }
      ]
    };

    // Mock transaction
    prisma.$transaction = vi.fn(async (fn: any) => fn(prisma));

    // Mock upserts/creates/finds
    prisma.matchSchedule.upsert = vi.fn().mockResolvedValue({ id: 100 });
    prisma.production.findUnique = vi.fn().mockResolvedValue(null); // Not found initially
    prisma.production.create = vi.fn().mockResolvedValue({ id: 200 });
    prisma.production.update = vi.fn().mockResolvedValue({ id: 200 });
    prisma.productionReport.upsert = vi.fn();

    // Mock person finding: return null first (to trigger create), then return created person
    prisma.person.findFirst = vi.fn()
      .mockResolvedValueOnce(null) // For Person A creation check
      .mockResolvedValueOnce({ id: 300, name: 'Person A' }) // For position assignment
      .mockResolvedValueOnce({ id: 300, name: 'Person A' }); // For segment assignment

    prisma.person.create = vi.fn().mockResolvedValue({ id: 300 });
    prisma.skill.upsert = vi.fn().mockResolvedValue({ id: 400 });
    prisma.personSkill.upsert = vi.fn();
    prisma.productionPerson.upsert = vi.fn();
    prisma.position.findUnique = vi.fn().mockResolvedValue(null);
    prisma.position.create = vi.fn().mockResolvedValue({ id: 500 });
    prisma.productionPersonPosition.upsert = vi.fn();
    prisma.productionSegment.deleteMany = vi.fn();
    prisma.productionSegment.create = vi.fn().mockResolvedValue({ id: 600 });
    prisma.segmentRoleAssignment.create = vi.fn();
    prisma.interviewSubject.deleteMany = vi.fn();
    prisma.club.findUnique = vi.fn().mockResolvedValue(null);
    prisma.club.create = vi.fn().mockResolvedValue({ id: 700 });
    prisma.player.findFirst = vi.fn().mockResolvedValue(null);
    prisma.player.create = vi.fn().mockResolvedValue({ id: 800 });
    prisma.interviewSubject.create = vi.fn();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('imports a production from JSON payload', async () => {
    const res = await request(app)
      .post('/api/production/import')
      .send(productionData);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.id).toBe(200);

    // Verify calls
    expect(prisma.matchSchedule.upsert).toHaveBeenCalled();
    expect(prisma.production.create).toHaveBeenCalled();
    expect(prisma.productionReport.upsert).toHaveBeenCalled();
    expect(prisma.person.create).toHaveBeenCalledWith(expect.objectContaining({ data: { name: 'Person A', gender: 'male' } }));
    expect(prisma.skill.upsert).toHaveBeenCalled();
    expect(prisma.productionPerson.upsert).toHaveBeenCalled(); // Attendance
    expect(prisma.position.create).toHaveBeenCalledWith(expect.objectContaining({ data: { name: 'Camera 1', isStudio: false } }));
    expect(prisma.productionPersonPosition.upsert).toHaveBeenCalled();
    expect(prisma.productionSegment.create).toHaveBeenCalled();
    expect(prisma.segmentRoleAssignment.create).toHaveBeenCalled();
    expect(prisma.club.create).toHaveBeenCalled();
    expect(prisma.player.create).toHaveBeenCalled();
    expect(prisma.interviewSubject.create).toHaveBeenCalled();
  });

  it('returns 400 for invalid data', async () => {
    const res = await request(app)
      .post('/api/production/import')
      .send({});
    expect(res.status).toBe(400);
  });
});
