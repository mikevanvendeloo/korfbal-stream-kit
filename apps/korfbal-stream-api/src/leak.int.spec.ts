import request from 'supertest';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';
import app from './main';
import {listRoutes} from './test-support/routes';
import {ensureOrganization, testDb as prisma} from '../test-helpers';
import {createTenantScenario, TenantScenario} from '../test-scenarios';
import {runWithOrganization} from './services/organizationContext';
import {setSetting} from './services/appSettings';

/**
 * Leak test suite (design D4): organization A has one of everything, organization B looks at it.
 * Every mounted route has an entry in ROUTES below; a new route without one fails the last test.
 *
 * - read:   as B, the route answers 404 or shows nothing of A (A's marker isn't in the response);
 *           as A (control) it does show A's data, so the probe really points at A's rows.
 * - write:  as B, a change to A's resource answers 404, and A's data is unchanged afterwards.
 * - own:    only works on the caller's own organization (creates, settings, imports); foreign ids in
 *           the body are covered by security.int.spec.ts.
 * - global: global data (D3) or no data at all.
 * - live:   the in-memory live state, still one for the installation until phase 2.
 * - device: talks to an external device or service (vMix, scoreboard, match source): not called here.
 */
type Ids = TenantScenario;
type Read = {read: (a: Ids) => string; method?: 'GET' | 'POST'; body?: (a: Ids) => object; control?: boolean; binary?: boolean};
type Write = {write: (a: Ids) => string; body?: (a: Ids) => object};
type Probe = Read | Write | {own: string} | {global: string} | {live: string} | {device: string};

const GLOBAL = {global: 'global data (D3)'};
const OWN = {own: 'creates or changes only in the own organization'};
const LIVE = {live: 'live state is one per installation until phase 2'};
const NAME = {name: 'Overgenomen', naam: 'Overgenomen', title: 'Overgenomen'};

const ROUTES: Record<string, Probe> = {
  'DELETE /api/admin/vmix/title-templates/:id': {write: (a) => `/api/admin/vmix/title-templates/${a.titleTemplateId}`},
  'DELETE /api/callsheets/templates/:id': {write: (a) => `/api/callsheets/templates/${a.callSheetTemplateId}`},
  'DELETE /api/callsheets/templates/items/:itemId': {write: (a) => `/api/callsheets/templates/items/${a.callSheetTemplateItemId}`},
  'DELETE /api/clubs/:slug': GLOBAL,
  'DELETE /api/manual-matches/:id': {write: (a) => `/api/manual-matches/${a.manualMatchId}`},
  'DELETE /api/organizations/:id/logo': GLOBAL,
  'DELETE /api/persons/:id': {write: (a) => `/api/persons/${a.personId}`},
  'DELETE /api/persons/:id/skills/:skillId': {write: (a) => `/api/persons/${a.personId}/skills/${a.skillId}`},
  'DELETE /api/persons/matches/:matchId/assignments/:assignmentId': {write: (a) => `/api/persons/matches/${a.matchId}/assignments/${a.matchAssignmentId}`},
  'DELETE /api/players/:id': GLOBAL,
  'DELETE /api/players/images/:id': GLOBAL,
  'DELETE /api/production/:id': {write: (a) => `/api/production/${a.productionId}`},
  'DELETE /api/production/:id/events/:eventId': {write: (a) => `/api/production/${a.productionId}/events/${a.eventId}`},
  'DELETE /api/production/:id/person-positions/:personPositionId': {write: (a) => `/api/production/${a.productionId}/person-positions/${a.personPositionId}`},
  'DELETE /api/production/:id/persons/:productionPersonId': {write: (a) => `/api/production/${a.productionId}/persons/${a.productionPersonId}`},
  'DELETE /api/production/:id/report': {write: (a) => `/api/production/${a.productionId}/report`},
  'DELETE /api/production/:id/titles/:titleId': {write: (a) => `/api/production/${a.productionId}/titles/${a.titleId}`},
  'DELETE /api/production/callsheet-items/:itemId': {write: (a) => `/api/production/callsheet-items/${a.callSheetItemId}`},
  'DELETE /api/production/callsheets/:callSheetId': {write: (a) => `/api/production/callsheets/${a.callSheetId}`},
  'DELETE /api/production/positions/:id': {write: (a) => `/api/production/positions/${a.linkedPositionId}`},
  'DELETE /api/production/segment-templates/:id': {write: (a) => `/api/production/segment-templates/${a.segmentTemplateId}`},
  'DELETE /api/production/segment-templates/items/:itemId': {write: (a) => `/api/production/segment-templates/items/${a.segmentTemplateItemId}`},
  'DELETE /api/production/segments/:segmentId': {write: (a) => `/api/production/segments/${a.segmentId}`},
  'DELETE /api/production/segments/:segmentId/assignments/:assignmentId': {write: (a) => `/api/production/segments/${a.segmentId}/assignments/${a.segmentAssignmentId}`},
  'DELETE /api/production/skills/:id': {write: (a) => `/api/production/skills/${a.skillId}`},
  'DELETE /api/seasons/:id': GLOBAL,
  'DELETE /api/skills/:id': {write: (a) => `/api/skills/${a.skillId}`},
  'DELETE /api/sponsors/:id': {write: (a) => `/api/sponsors/${a.sponsorId}`},

  'GET /api/admin/vmix/title-templates': {read: () => '/api/admin/vmix/title-templates'},
  'GET /api/backup/clubs/export': GLOBAL,
  'GET /api/backup/matches/export': {read: () => '/api/backup/matches/export'},
  'GET /api/backup/persons/export': {read: () => '/api/backup/persons/export'},
  'GET /api/backup/positions/export': {read: () => '/api/backup/positions/export'},
  'GET /api/backup/producties/export': {read: () => '/api/backup/producties/export'},
  'GET /api/backup/segment-templates/export': {read: () => '/api/backup/segment-templates/export'},
  'GET /api/backup/settings/export': {read: () => '/api/backup/settings/export'},
  'GET /api/backup/skills/export': {read: () => '/api/backup/skills/export'},
  'GET /api/backup/sponsors/export': {read: () => '/api/backup/sponsors/export'},
  'GET /api/callsheets/templates': {read: () => '/api/callsheets/templates'},
  'GET /api/callsheets/templates/:id': {read: (a) => `/api/callsheets/templates/${a.callSheetTemplateId}`},
  'GET /api/callsheets/templates/:id/export': {read: (a) => `/api/callsheets/templates/${a.callSheetTemplateId}/export`, binary: true},
  'GET /api/callsheets/templates/:id/export-json': {read: (a) => `/api/callsheets/templates/${a.callSheetTemplateId}/export-json`},
  'GET /api/clubs': GLOBAL,
  'GET /api/clubs/:id/teams': {read: (a) => `/api/clubs/${a.clubId}/teams`, control: false},
  'GET /api/clubs/:slug/players': GLOBAL,
  'GET /api/health': GLOBAL,
  'GET /api/manual-matches': {read: () => '/api/manual-matches'},
  'GET /api/match-source': {read: () => '/api/match-source'},
  'GET /api/match/matches/schedule': {read: () => '/api/match/matches/schedule?location=ALL'},
  'GET /api/openapi.json': GLOBAL,
  'GET /api/organizations': GLOBAL,
  'GET /api/organizations/:id': GLOBAL,
  'GET /api/persons': {read: () => '/api/persons'},
  'GET /api/persons/:id': {read: (a) => `/api/persons/${a.personId}`},
  'GET /api/persons/:id/skills': {read: (a) => `/api/persons/${a.personId}/skills`},
  'GET /api/persons/export-json': {read: () => '/api/persons/export-json'},
  'GET /api/persons/functions': {read: () => '/api/persons/functions', control: false},
  'GET /api/persons/matches/:matchId/assignments': {read: (a) => `/api/persons/matches/${a.matchId}/assignments`},
  'GET /api/players/images': GLOBAL,
  'GET /api/production': {read: () => '/api/production'},
  'GET /api/production/:id': {read: (a) => `/api/production/${a.productionId}`},
  'GET /api/production/:id/callsheets': {read: (a) => `/api/production/${a.productionId}/callsheets`},
  'GET /api/production/:id/clocks': {read: (a) => `/api/production/${a.productionId}/clocks`, control: false},
  'GET /api/production/:id/crew': {read: (a) => `/api/production/${a.productionId}/crew`},
  'GET /api/production/:id/crew-report': {read: (a) => `/api/production/${a.productionId}/crew-report`},
  'GET /api/production/:id/events': {read: (a) => `/api/production/${a.productionId}/events`},
  'GET /api/production/:id/events/:eventId': {read: (a) => `/api/production/${a.productionId}/events/${a.eventId}`},
  'GET /api/production/:id/events/positions': {read: (a) => `/api/production/${a.productionId}/events/positions`},
  'GET /api/production/:id/export': {read: (a) => `/api/production/${a.productionId}/export`},
  'GET /api/production/:id/interview-names': {read: (a) => `/api/production/${a.productionId}/interview-names`},
  'GET /api/production/:id/interviews': {read: (a) => `/api/production/${a.productionId}/interviews`},
  'GET /api/production/:id/interviews/options': {read: (a) => `/api/production/${a.productionId}/interviews/options`, control: false},
  'GET /api/production/:id/person-positions': {read: (a) => `/api/production/${a.productionId}/person-positions`},
  'GET /api/production/:id/persons': {read: (a) => `/api/production/${a.productionId}/persons`},
  'GET /api/production/:id/report': {read: (a) => `/api/production/${a.productionId}/report`},
  'GET /api/production/:id/report/markdown': {read: (a) => `/api/production/${a.productionId}/report/markdown`},
  'GET /api/production/:id/report/pdf': {read: (a) => `/api/production/${a.productionId}/report/pdf`, binary: true},
  'GET /api/production/:id/report/whatsapp': {read: (a) => `/api/production/${a.productionId}/report/whatsapp`},
  'GET /api/production/:id/segments': {read: (a) => `/api/production/${a.productionId}/segments`},
  'GET /api/production/:id/timing': {read: (a) => `/api/production/${a.productionId}/timing`, control: false},
  'GET /api/production/:id/titles': {read: (a) => `/api/production/${a.productionId}/titles`},
  'GET /api/production/active': {read: () => '/api/production/active', control: false},
  'GET /api/production/callsheets/:callSheetId': {read: (a) => `/api/production/callsheets/${a.callSheetId}`},
  'GET /api/production/dates': {read: () => '/api/production/dates', control: false},
  'GET /api/production/export/positions': {read: () => '/api/production/export/positions'},
  'GET /api/production/matches': {read: () => '/api/production/matches', control: false},
  'GET /api/production/next-date': {read: () => '/api/production/next-date', control: false},
  'GET /api/production/positions': {read: () => '/api/production/positions'},
  'GET /api/production/segment-default-positions': {read: (a) => `/api/production/segment-default-positions?segmentName=${encodeURIComponent(`${a.marker} Wedstrijd`)}`},
  'GET /api/production/segment-default-positions/names': {read: () => '/api/production/segment-default-positions/names'},
  'GET /api/production/segment-templates': {read: () => '/api/production/segment-templates'},
  'GET /api/production/segment-templates/:id': {read: (a) => `/api/production/segment-templates/${a.segmentTemplateId}`},
  'GET /api/production/segment-templates/:id/export-json': {read: (a) => `/api/production/segment-templates/${a.segmentTemplateId}/export-json`},
  'GET /api/production/segments/:segmentId': {read: (a) => `/api/production/segments/${a.segmentId}`},
  'GET /api/production/segments/:segmentId/assignments': {read: (a) => `/api/production/segments/${a.segmentId}/assignments`},
  'GET /api/production/segments/:segmentId/persons': {read: (a) => `/api/production/segments/${a.segmentId}/persons`},
  'GET /api/production/segments/:segmentId/positions': {read: (a) => `/api/production/segments/${a.segmentId}/positions`},
  'GET /api/production/skills': {read: () => '/api/production/skills'},
  'GET /api/production/skills/:id': {read: (a) => `/api/production/skills/${a.skillId}`},
  'GET /api/production/skills/export-json': {read: () => '/api/production/skills/export-json'},
  'GET /api/reports/crew-roles': {read: () => '/api/reports/crew-roles', control: false},
  'GET /api/reports/daily-occupancy': {read: () => `/api/reports/daily-occupancy?date=${today()}`, control: false},
  'GET /api/reports/daily-occupancy-by-position': {read: () => `/api/reports/daily-occupancy-by-position?date=${today()}`, control: false},
  'GET /api/reports/interviews': {read: () => '/api/reports/interviews', control: false},
  'GET /api/reports/next-production-date': {read: () => '/api/reports/next-production-date', control: false},
  'GET /api/reports/production-dates': {read: () => '/api/reports/production-dates', control: false},
  'GET /api/scoreboard': {device: 'scoreboard proxy (API keys in phase 2)'},
  'GET /api/scoreboard/clock': {device: 'scoreboard proxy (API keys in phase 2)'},
  'GET /api/scoreboard/shotclock': {device: 'shot clock proxy (API keys in phase 2)'},
  'GET /api/seasons': GLOBAL,
  'GET /api/seasons/active': GLOBAL,
  'GET /api/seasons/suggest-next': GLOBAL,
  'GET /api/settings/club-config': {read: () => '/api/settings/club-config'},
  'GET /api/settings/scoreboard-config': {read: () => '/api/settings/scoreboard-config'},
  'GET /api/settings/sponsor-config': {read: () => '/api/settings/sponsor-config', control: false},
  'GET /api/settings/version': GLOBAL,
  'GET /api/settings/vmix-callsheet-push': {read: () => '/api/settings/vmix-callsheet-push'},
  'GET /api/settings/vmix-instances': {read: () => '/api/settings/vmix-instances'},
  'GET /api/settings/vmix-url': {read: () => '/api/settings/vmix-url'},
  'GET /api/skills': {read: () => '/api/skills'},
  'GET /api/skills/:id': {read: (a) => `/api/skills/${a.skillId}`},
  'GET /api/skills/export-json': {read: () => '/api/skills/export-json'},
  'GET /api/sponsors': {read: () => '/api/sponsors'},
  'GET /api/sponsors/:id': {read: (a) => `/api/sponsors/${a.sponsorId}`},
  'GET /api/sponsors/export-excel': {own: 'xlsx of the own sponsors: same query as GET /api/sponsors'},
  'GET /api/vmix/active-production/match': {read: () => '/api/vmix/active-production/match', control: false},
  'GET /api/vmix/active-production/staff': {read: () => '/api/vmix/active-production/staff', control: false},
  'GET /api/vmix/callsheet/timing': {read: () => '/api/vmix/callsheet/timing', control: false},
  'GET /api/vmix/endpoints': GLOBAL,
  'GET /api/vmix/production/:id/titles': {read: (a) => `/api/vmix/production/${a.productionId}/titles`},
  'GET /api/vmix/production/active/titles': {read: () => '/api/vmix/production/active/titles', control: false},
  'GET /api/vmix/sponsor-carrousel': {read: () => '/api/vmix/sponsor-carrousel'},
  'GET /api/vmix/sponsor-names': {read: () => '/api/vmix/sponsor-names'},
  'GET /api/vmix/sponsor-slides': {read: () => '/api/vmix/sponsor-slides', control: false},
  'GET /api/vmix/sync/activate-event': {write: (a) => `/api/vmix/sync/activate-event?inputName=${a.marker}`},

  'PATCH /api/admin/vmix/title-templates:reorder': {write: () => '/api/admin/vmix/title-templates:reorder', body: (a) => ({ids: [a.titleTemplateId]})},
  'PATCH /api/persons/matches/:matchId/assignments/:assignmentId': {write: (a) => `/api/persons/matches/${a.matchId}/assignments/${a.matchAssignmentId}`, body: (a) => ({skillId: a.skillId})},
  'PATCH /api/production/:id/titles:reorder': {write: (a) => `/api/production/${a.productionId}/titles:reorder`, body: (a) => ({ids: [a.titleId]})},

  'POST /api/admin/vmix/production/:id/titles/use-default': {write: (a) => `/api/admin/vmix/production/${a.productionId}/titles/use-default`},
  'POST /api/admin/vmix/title-templates': OWN,
  'POST /api/backup/clubs/import': GLOBAL,
  'POST /api/backup/matches/import': OWN,
  'POST /api/backup/persons/import': OWN,
  'POST /api/backup/positions/import': OWN,
  'POST /api/backup/producties/import': OWN,
  'POST /api/backup/segment-templates/import': OWN,
  'POST /api/backup/settings/import': OWN,
  'POST /api/backup/skills/import': OWN,
  'POST /api/backup/sponsors/import': OWN,
  'POST /api/callsheets/templates': OWN,
  'POST /api/callsheets/templates/:id/apply/:productionId': {write: (a) => `/api/callsheets/templates/${a.callSheetTemplateId}/apply/${a.productionId}`, body: () => ({mode: 'replace'})},
  'POST /api/callsheets/templates/:id/items': {write: (a) => `/api/callsheets/templates/${a.callSheetTemplateId}/items`, body: () => ({title: 'Overgenomen', durationSec: 10})},
  'POST /api/callsheets/templates/import': OWN,
  'POST /api/callsheets/templates/import-json': OWN,
  'POST /api/clubs': GLOBAL,
  'POST /api/clubs/import': GLOBAL,
  'POST /api/clubs/import/league-teams': GLOBAL,
  'POST /api/manual-matches': OWN,
  'POST /api/match-source/test': {device: 'calls the external match source'},
  'POST /api/match/matches/schedule/import': {device: 'calls the external match source'},
  'POST /api/organizations': GLOBAL,
  'POST /api/organizations/:id/logo': GLOBAL,
  'POST /api/persons': OWN,
  'POST /api/persons/:id/skills': {write: (a) => `/api/persons/${a.personId}/skills`, body: (a) => ({skillId: a.skillId})},
  'POST /api/persons/import-json': OWN,
  'POST /api/persons/matches/:matchId/assignments': {write: (a) => `/api/persons/matches/${a.matchId}/assignments`, body: (a) => ({personId: a.personId, skillId: a.skillId})},
  'POST /api/players': GLOBAL,
  'POST /api/players/images': GLOBAL,
  'POST /api/production': OWN,
  'POST /api/production/:id/activate': {write: (a) => `/api/production/${a.productionId}/activate`},
  'POST /api/production/:id/callsheets': {write: (a) => `/api/production/${a.productionId}/callsheets`, body: () => ({name: 'Overgenomen'})},
  'POST /api/production/:id/callsheets/import-excel': {write: (a) => `/api/production/${a.productionId}/callsheets/import-excel`},
  'POST /api/production/:id/events': {write: (a) => `/api/production/${a.productionId}/events`, body: () => ({title: 'Overgenomen', order: 9})},
  'POST /api/production/:id/person-positions': {write: (a) => `/api/production/${a.productionId}/person-positions`, body: (a) => ({personId: a.personId, positionId: a.positionId})},
  'POST /api/production/:id/persons': {write: (a) => `/api/production/${a.productionId}/persons`, body: (a) => ({personId: a.personId})},
  'POST /api/production/:id/report': {write: (a) => `/api/production/${a.productionId}/report`, body: () => ({remarks: 'Overgenomen'})},
  'POST /api/production/:id/segments': {write: (a) => `/api/production/${a.productionId}/segments`, body: () => ({naam: 'Overgenomen', duurInMinuten: 5})},
  'POST /api/production/:id/titles': {write: (a) => `/api/production/${a.productionId}/titles`, body: () => ({name: 'Overgenomen', parts: [{sourceType: 'COMMENTARY'}]})},
  'POST /api/production/callsheet/next': LIVE,
  'POST /api/production/callsheet/previous': LIVE,
  'POST /api/production/callsheet/set-active/:id': {write: (a) => `/api/production/callsheet/set-active/${a.eventId}`, body: (a) => ({productionId: a.productionId})},
  'POST /api/production/callsheet/update-scoreboard-time': LIVE,
  'POST /api/production/callsheets/:callSheetId/calculate-times': {write: (a) => `/api/production/callsheets/${a.callSheetId}/calculate-times`},
  'POST /api/production/callsheets/:callSheetId/items': {write: (a) => `/api/production/callsheets/${a.callSheetId}/items`, body: () => ({id: 'leak-b-item', cue: 'X', title: 'Overgenomen', durationSec: 10, orderIndex: 9})},
  'POST /api/production/callsheets/:callSheetId/sync-to-events': {write: (a) => `/api/production/callsheets/${a.callSheetId}/sync-to-events`},
  'POST /api/production/import': OWN,
  'POST /api/production/import/positions': OWN,
  'POST /api/production/positions': OWN,
  'POST /api/production/segment-templates': OWN,
  'POST /api/production/segment-templates/:id/items': {write: (a) => `/api/production/segment-templates/${a.segmentTemplateId}/items`, body: () => ({naam: 'Overgenomen', duurInMinuten: 5})},
  'POST /api/production/segment-templates/apply/:templateId/to/:productionId': {write: (a) => `/api/production/segment-templates/apply/${a.segmentTemplateId}/to/${a.productionId}`},
  'POST /api/production/segment-templates/from-production/:productionId': {write: (a) => `/api/production/segment-templates/from-production/${a.productionId}`, body: () => ({name: 'Overgenomen'})},
  'POST /api/production/segment-templates/import-json': OWN,
  'POST /api/production/segments/:segmentId/assignments': {write: (a) => `/api/production/segments/${a.segmentId}/assignments`, body: (a) => ({personId: a.personId, positionId: a.positionId})},
  'POST /api/production/segments/:segmentId/assignments/copy': {write: (a) => `/api/production/segments/${a.segmentId}/assignments/copy`, body: (a) => ({targetSegmentIds: [a.segmentId]})},
  'POST /api/production/skills': OWN,
  'POST /api/production/skills/import-json': OWN,
  'POST /api/seasons': GLOBAL,
  'POST /api/show/clock': LIVE,
  'POST /api/show/next': LIVE,
  'POST /api/show/previous': LIVE,
  'POST /api/show/recalculate/:productionId': {write: (a) => `/api/show/recalculate/${a.productionId}`},
  'POST /api/show/remaining': LIVE,
  'POST /api/show/reset/:productionId': {write: (a) => `/api/show/reset/${a.productionId}`},
  'POST /api/show/start/:productionId': {write: (a) => `/api/show/start/${a.productionId}`},
  'POST /api/show/stop/:productionId': {write: (a) => `/api/show/stop/${a.productionId}`},
  'POST /api/skills': OWN,
  'POST /api/skills/import-json': OWN,
  'POST /api/sponsors': OWN,
  'POST /api/sponsors/:id/logo': {write: (a) => `/api/sponsors/${a.sponsorId}/logo`},
  'POST /api/sponsors/upload-excel': OWN,
  'POST /api/time/countdown': LIVE,
  'POST /api/time/start': LIVE,
  'POST /api/time/stop': LIVE,
  'POST /api/time/venue-clock': LIVE,
  'POST /api/upload': {own: 'stores a file, no tenant data'},
  'POST /api/vmix/callsheet/push': {device: 'sends to vMix'},
  'POST /api/vmix/production/trigger-manual': {write: () => '/api/vmix/production/trigger-manual', body: (a) => ({eventId: a.eventId})},
  'POST /api/vmix/set-timer': {device: 'sends to vMix'},
  'POST /api/vmix/sponsor-rows': {read: () => '/api/vmix/sponsor-rows', method: 'POST', control: false},

  'PUT /api/admin/vmix/title-templates/:id': {write: (a) => `/api/admin/vmix/title-templates/${a.titleTemplateId}`, body: () => ({name: 'Overgenomen'})},
  'PUT /api/callsheets/templates/:id': {write: (a) => `/api/callsheets/templates/${a.callSheetTemplateId}`, body: () => NAME},
  'PUT /api/callsheets/templates/:id/reorder': {write: (a) => `/api/callsheets/templates/${a.callSheetTemplateId}/reorder`, body: (a) => ({itemIds: [a.callSheetTemplateItemId]})},
  'PUT /api/callsheets/templates/items/:itemId': {write: (a) => `/api/callsheets/templates/items/${a.callSheetTemplateItemId}`, body: () => NAME},
  'PUT /api/manual-matches/:id': {write: (a) => `/api/manual-matches/${a.manualMatchId}`, body: () => ({homeTeamName: 'Overgenomen', awayTeamName: 'Overgenomen', date: new Date().toISOString()})},
  'PUT /api/match-source': OWN,
  'PUT /api/organizations/:id': GLOBAL,
  'PUT /api/persons/:id': {write: (a) => `/api/persons/${a.personId}`, body: () => NAME},
  'PUT /api/players/:id': GLOBAL,
  'PUT /api/production/:id': {write: (a) => `/api/production/${a.productionId}`, body: () => ({liveTime: new Date().toISOString()})},
  'PUT /api/production/:id/interviews': {write: (a) => `/api/production/${a.productionId}/interviews`, body: () => ({home: {players: [], coach: []}, away: {players: [], coach: []}})},
  'PUT /api/production/:id/person-positions': {write: (a) => `/api/production/${a.productionId}/person-positions`, body: (a) => ({personId: a.personId, positionIds: []})},
  'PUT /api/production/:id/titles/:titleId': {write: (a) => `/api/production/${a.productionId}/titles/${a.titleId}`, body: () => ({name: 'Overgenomen'})},
  'PUT /api/production/callsheet-items/:itemId': {write: (a) => `/api/production/callsheet-items/${a.callSheetItemId}`, body: () => NAME},
  'PUT /api/production/callsheets/:callSheetId': {write: (a) => `/api/production/callsheets/${a.callSheetId}`, body: () => NAME},
  'PUT /api/production/positions/:id': {write: (a) => `/api/production/positions/${a.positionId}`, body: () => NAME},
  'PUT /api/production/segment-default-positions': OWN,
  'PUT /api/production/segment-templates/:id': {write: (a) => `/api/production/segment-templates/${a.segmentTemplateId}`, body: () => NAME},
  'PUT /api/production/segment-templates/:id/set-default': {write: (a) => `/api/production/segment-templates/${a.segmentTemplateId}/set-default`},
  'PUT /api/production/segment-templates/items/:itemId': {write: (a) => `/api/production/segment-templates/items/${a.segmentTemplateItemId}`, body: () => NAME},
  'PUT /api/production/segments/:segmentId': {write: (a) => `/api/production/segments/${a.segmentId}`, body: () => NAME},
  'PUT /api/production/skills/:id': {write: (a) => `/api/production/skills/${a.skillId}`, body: () => NAME},
  'PUT /api/seasons/active': GLOBAL,
  'PUT /api/settings/club-config': OWN,
  'PUT /api/settings/scoreboard-config': OWN,
  'PUT /api/settings/sponsor-config': OWN,
  'PUT /api/settings/vmix-callsheet-push': OWN,
  'PUT /api/settings/vmix-instances': OWN,
  'PUT /api/settings/vmix-url': OWN,
  'PUT /api/skills/:id': {write: (a) => `/api/skills/${a.skillId}`, body: () => NAME},
  'PUT /api/sponsors/:id': {write: (a) => `/api/sponsors/${a.sponsorId}`, body: () => NAME},
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

const runDb = process.env.REQUIRE_DB === 'true';
const MARKER = 'LeakAlpha';

function call(method: string, path: string, slug: string, body?: object) {
  const agent = request(app) as unknown as Record<string, (path: string) => request.Test>;
  const req = agent[method.toLowerCase()](path).set('X-Organization', slug);
  return body ? req.send(body) : req;
}

/** Response as text, also for binary bodies (pdf/xlsx), to look for the marker. */
function text(res: request.Response): string {
  if (Buffer.isBuffer(res.body)) return res.body.toString('latin1');
  return res.text || JSON.stringify(res.body ?? '');
}

const showsMarker = (res: request.Response) => text(res).toLowerCase().includes(MARKER.toLowerCase());

describe('leak test suite: route table', () => {
  it('has an entry for every mounted route (add new routes to ROUTES)', () => {
    expect(listRoutes(app).filter((route) => !(route in ROUTES))).toEqual([]);
    expect(Object.keys(ROUTES).filter((route) => !listRoutes(app).includes(route))).toEqual([]);
  });
});

describe.runIf(runDb)('leak test suite: organization B never sees or changes organization A (integration)', () => {
  let a: TenantScenario;
  const A = 'leak-alpha';
  const B = 'leak-beta';

  beforeAll(async () => {
    const organizationA = await ensureOrganization(prisma, A, 'Leak Alpha');
    await ensureOrganization(prisma, B, 'Leak Beta');
    a = await createTenantScenario(prisma, organizationA, MARKER);
    await runWithOrganization(organizationA, async () => {
      await prisma.productionEvent.update({where: {id: a.eventId}, data: {vMixInputName: MARKER}});
      await prisma.matchSource.create({data: {baseUrl: `https://${MARKER.toLowerCase()}.example/v1`, apiToken: 'secret-token-a'}});
      await setSetting('productionTeamNames', [`${MARKER} Thuis`]);
      await setSetting('vmixWebUrl', `http://${MARKER.toLowerCase()}.example:8088`);
      await setSetting('vmixInstances', {instances: [{id: 'a', name: `${MARKER} PC`, url: `http://${MARKER.toLowerCase()}.example:8088`}], targets: {}});
      await setSetting('vmixCallsheetPush', {enabled: false, input: MARKER});
      await setSetting('scoreboardUrl', `http://${MARKER.toLowerCase()}.example/scoreboard`);
    });
  });

  afterAll(async () => {
    await a?.cleanup();
    await prisma.organization.deleteMany({where: {slug: B}});
  });

  const reads = Object.entries(ROUTES).filter((e): e is [string, Read] => 'read' in e[1]);
  const writes = Object.entries(ROUTES).filter((e): e is [string, Write] => 'write' in e[1]);

  it.each(reads)('%s: B gets 404 or nothing of A', async (_route, probe) => {
    const method = probe.method ?? 'GET';
    const asB = await call(method, probe.read(a), B, probe.body?.(a));
    expect(asB.status, text(asB)).toBeLessThan(500);
    if (probe.binary) expect(asB.status).toBe(404);
    else if (asB.status !== 404) expect(showsMarker(asB), text(asB)).toBe(false);

    if (probe.control === false) return;
    const asA = await call(method, probe.read(a), A, probe.body?.(a));
    expect(asA.status, text(asA)).toBe(200);
    if (!probe.binary) expect(showsMarker(asA), `the probe must point at A's data: ${text(asA).slice(0, 300)}`).toBe(true);
  });

  it.each(writes)('%s: B gets 404 on A\'s resource', async (route, probe) => {
    const method = route.split(' ')[0];
    const res = await call(method, probe.write(a), B, probe.body?.(a));
    expect(res.status, text(res)).toBe(404);
  });

  it('left all of A\'s data in place', async () => {
    await runWithOrganization(a.organizationId, async () => {
      expect((await prisma.production.findUnique({where: {id: a.productionId}}))?.isActive).toBe(false);
      expect((await prisma.sponsor.findUnique({where: {id: a.sponsorId}}))?.name).toBe(`${MARKER} Sponsor`);
      expect((await prisma.person.findUnique({where: {id: a.personId}}))?.name).toBe(`${MARKER} Persoon`);
      expect((await prisma.skill.findUnique({where: {id: a.skillId}}))?.name).toBe(`${MARKER} skill`);
      expect((await prisma.position.findUnique({where: {id: a.positionId}}))?.name).toBe(`${MARKER} Regie`);
      expect((await prisma.position.findUnique({where: {id: a.linkedPositionId}}))?.name).toBe(`${MARKER} Camera`);
      expect((await prisma.productionEvent.findUnique({where: {id: a.eventId}}))?.status).toBe('WAITING');
      expect((await prisma.productionSegment.findUnique({where: {id: a.segmentId}}))?.naam).toBe(`${MARKER} Wedstrijd`);
      expect((await prisma.callSheet.findUnique({where: {id: a.callSheetId}}))?.name).toBe(`${MARKER} Callsheet`);
      expect((await prisma.callSheetItem.findUnique({where: {id: a.callSheetItemId}}))?.title).toBe(`${MARKER} item`);
      expect((await prisma.callSheetTemplate.findUnique({where: {id: a.callSheetTemplateId}}))?.name).toBe(`${MARKER} Draaiboek`);
      expect((await prisma.callSheetTemplateItem.findUnique({where: {id: a.callSheetTemplateItemId}}))?.title).toBe(`${MARKER} sjabloonitem`);
      expect((await prisma.segmentTemplate.findUnique({where: {id: a.segmentTemplateId}}))?.name).toBe(`${MARKER} Segmenten`);
      expect((await prisma.segmentTemplateItem.findUnique({where: {id: a.segmentTemplateItemId}}))?.naam).toBe(`${MARKER} Segment`);
      expect((await prisma.titleDefinition.findUnique({where: {id: a.titleId}}))?.name).toBe(`${MARKER} titel`);
      expect((await prisma.titleDefinition.findUnique({where: {id: a.titleTemplateId}}))?.name).toBe(`${MARKER} titelsjabloon`);
      expect((await prisma.matchSchedule.findUnique({where: {id: a.manualMatchId}}))?.homeTeamName).toBe(`${MARKER} Handmatig`);
      expect(await prisma.matchRoleAssignment.count({where: {id: a.matchAssignmentId}})).toBe(1);
      expect(await prisma.productionPerson.count({where: {id: a.productionPersonId}})).toBe(1);
      expect(await prisma.productionPersonPosition.count({where: {id: a.personPositionId}})).toBe(1);
      expect(await prisma.segmentRoleAssignment.count({where: {id: a.segmentAssignmentId}})).toBe(1);
      expect(await prisma.personSkill.count({where: {personId: a.personId}})).toBe(1);
      expect(await prisma.productionReport.count({where: {productionId: a.productionId}})).toBe(1);
      expect(await prisma.interviewSubject.count({where: {productionId: a.productionId}})).toBe(1);
      expect(await prisma.callSheet.count({where: {productionId: a.productionId}})).toBe(1);
      expect(await prisma.productionEvent.count({where: {productionId: a.productionId}})).toBe(1);
      expect(await prisma.callSheetTemplateItem.count({where: {templateId: a.callSheetTemplateId}})).toBe(1);
    });
    // Nothing of B's attempts ended up in B either
    const b = await ensureOrganization(prisma, B);
    await runWithOrganization(b, async () => {
      expect(await prisma.production.count()).toBe(0);
      expect(await prisma.callSheet.count()).toBe(0);
      expect(await prisma.productionSegment.count()).toBe(0);
      expect(await prisma.productionPerson.count()).toBe(0);
    });
  });
});
