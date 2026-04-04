import {beforeEach, describe, expect, it} from 'vitest';
import {prisma} from '../../services/prisma';
import {callSheetTemplateRouter} from './callsheet-templates';
import {productionRouter} from '../production';
import express from 'express';
import request from 'supertest';

const app = express();
app.use(express.json());
app.use('/api/callsheets/templates', callSheetTemplateRouter);
app.use('/api/production', productionRouter);

describe.runIf(process.env.REQUIRE_DB === 'true')('CallSheetTemplate Application and Timing', () => {
  let productionId: number;
  let templateId: number;
  const matchDate = new Date('2026-05-01T20:00:00Z');

  beforeEach(async () => {
    // 1. Create a match schedule
    const match = await prisma.matchSchedule.create({
      data: {
        date: matchDate,
        homeTeamName: 'Team A',
        awayTeamName: 'Team B',
        isHomeMatch: true,
      }
    });

    // 2. Create a production
    const production = await prisma.production.create({
      data: {
        matchScheduleId: match.id,
      }
    });
    productionId = production.id;

    // 3. Create a template with a time anchor
    const template = await prisma.callSheetTemplate.create({
      data: {
        name: 'Test Timing Template',
        items: {
          create: [
            {
              title: 'Match Start',
              durationSec: 0,
              orderIndex: 100,
              isInVenue: true,
              isInLivestream: true,
              isTimeAnchor: true,
              anchorType: 'MATCH_START'
            },
            {
              title: 'Pre-match Show',
              durationSec: 300,
              orderIndex: 50,
              isInVenue: true,
              isInLivestream: true,
              isTimeAnchor: false,
            }
          ]
        }
      }
    });
    templateId = template.id;
  });

  it('should apply template and recalculate times based on match start', async () => {
    // Apply template
    const res = await request(app)
      .post(`/api/callsheets/templates/${templateId}/apply/${productionId}`)
      .expect(200);

    expect(res.body.success).toBe(true);

    // Verify ProductionEvents
    const events = await prisma.productionEvent.findMany({
      where: { productionId },
      orderBy: { order: 'asc' }
    });

    expect(events).toHaveLength(2);

    const anchorEvent = events.find(e => e.title === 'Match Start');
    const preMatchEvent = events.find(e => e.title === 'Pre-match Show');

    expect(anchorEvent).toBeDefined();
    expect(preMatchEvent).toBeDefined();

    // The anchor event should be at the match date
    expect(new Date(anchorEvent!.plannedStartTime!).toISOString()).toBe(matchDate.toISOString());

    // Pre-match (order 50) has duration 300s. It is BEFORE anchor (order 100).
    // So its end should be at anchor start (20:00:00) and its start 5 mins earlier (19:55:00).
    const expectedStart = new Date(matchDate.getTime() - 300 * 1000);
    expect(new Date(preMatchEvent!.plannedStartTime!).toISOString()).toBe(expectedStart.toISOString());
    expect(new Date(preMatchEvent!.plannedEndTime!).toISOString()).toBe(matchDate.toISOString());

    // Verify CallSheetItem times are also synced
    const callSheetItems = await prisma.callSheetItem.findMany({
        where: { id: { in: [anchorEvent!.callSheetItemId!, preMatchEvent!.callSheetItemId!] } }
    });

    const preMatchItem = callSheetItems.find(i => i.id === preMatchEvent!.callSheetItemId);
    expect(new Date(preMatchItem!.timeStart!).toISOString()).toBe(expectedStart.toISOString());
  });
});
