import express, {Express} from 'express';
import {createServer} from 'http';
import fs from 'node:fs';
import swaggerUi from 'swagger-ui-express';
import {logger} from './utils/logger';
import {sponsorsRouter} from './routes/sponsors';
import {matchRouter} from './routes/match';
import {scoreboardRouter} from './routes/scoreboard';
import {adminVmixRouter, vmixRouter} from './routes/vmix';
import {settingsRouter} from './routes/settings';
import {personsRouter} from './routes/persons';
import {skillsRouter} from './routes/skills';
import {productionRouter} from './routes/production';
import {clubsRouter} from './routes/clubs';
import {playersRouter} from './routes/players';
import {reportsRouter} from './routes/reports'; // Import reports router
import {manualMatchesRouter} from "./routes/manual-matches";
import {backupRouter} from './routes/backup';
import {seasonsRouter} from './routes/seasons';
import {migrateLegacySeasonAssets} from './services/seasonAssetMigration';
import {prisma} from './services/prisma';
import {config, getAssetsRoot, logConfig, requireConfig} from './services/config';
import {errorHandler} from './middleware/error';
import {initSocket} from './services/socket';
import {showControlRouter} from "./routes/show-control";
import {timeRouter} from './routes/time';
import {initializeProductionState} from './services/productionState';
import {callSheetTemplateRouter} from './routes/production/callsheet-templates'
import {venueClockSyncService} from "./services/venueClockSyncService";
import {vmixCallsheetPushService} from './services/vmixCallsheetPush';
import {organizationContext} from './middleware/organizationContext';
import {extractApiKey, feedCors, withoutApiKey} from './middleware/apiKey';
import {apiKeysRouter} from './routes/apiKeys';
import {organizationsRouter} from './routes/organizations';
import {matchSourceRouter} from './routes/matchSource';
import {applyStandardSetWhereMissing} from './services/standardSet';
import {copyMatchSourceFromEnv} from './services/matchSchedule';

const app: Express = express();
/** The HTTP server with Socket.io; tests listen on it to connect socket clients. */
export const httpServer = createServer(app);

// Initialize Socket.io
initSocket(httpServer);

// Initialize Production State from DB. Not under Vitest: every spec file imports this module, and
// restoring an active production there starts clocks and auto-advance timers in the background of
// unrelated tests. Specs that need the live state initialize it themselves.
if (!process.env.VITEST) {
  initializeProductionState().then(() => {
    // Start venue clock sync after production state is initialized
    venueClockSyncService.start();
    vmixCallsheetPushService.start();
  }).catch(err => {
    logger.error('Failed to initialize production state:', err);
  });
}

// First: take the API key off the request, so no log line or route after this sees it (D7)
app.use(extractApiKey);

// Middlewares
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// CORS only for the feeds and static files; the frontend is same-origin (Vite proxy, nginx)
app.use(feedCors);

const methodEmojis: Record<string, string> = {
  GET: '📖',
  POST: '✍️',
  PUT: '✏️',
  PATCH: '🔧',
  DELETE: '🗑️',
  OPTIONS: '🔍',
  HEAD: '👁️',
};

const statusEmojis = (status: number): string => {
  if (status >= 500) return '💥'; // Server error
  if (status >= 400) return '⚠️'; // Client error
  if (status >= 300) return '↪️'; // Redirect
  if (status >= 200) return '✅'; // Success
  return '📡'; // Info
};
// Simple request logging
app.use((req, res, next) => {
  const start = Date.now();

  // Log when response finishes
  res.on('finish', () => {
    const duration = Date.now() - start;
    const methodEmoji = methodEmojis[req.method] || '📡';
    const statusEmoji = statusEmojis(res.statusCode);

    // The key is already off the URL (extractApiKey); this keeps it out if the order ever changes
    logger.info(`${methodEmoji} ${req.method} ${withoutApiKey(req.originalUrl)} ${statusEmoji}  ${res.statusCode}`, {
      query: Object.keys(req.query).length > 0 ? req.query : undefined,
      duration: `${duration}ms`,
      ip: req.ip,
    });
  });
  next();
});


// Assets (logos, player photos) are written by their own routes, which accept only images
// (services/imageUpload.ts); there is no generic upload endpoint
const assetsRoot = getAssetsRoot();
if (!fs.existsSync(assetsRoot)) fs.mkdirSync(assetsRoot, { recursive: true });

// Serve assets statically. Keep backward-compatible /uploads route.
app.use('/assets', express.static(assetsRoot));
app.use('/uploads', express.static(assetsRoot));
app.use('/storage', express.static(assetsRoot)); // New route for storage

// Every /api route runs for one organization (X-Organization), except the global ones (D3)
app.use('/api', organizationContext);

// Organizations (global: start screen and management)
app.use('/api/organizations', organizationsRouter);

// Match import settings of the chosen organization
app.use('/api/match-source', matchSourceRouter);

// API keys of the chosen organization (for the feed routes)
app.use('/api/organization/api-keys', apiKeysRouter);

// Sponsors endpoints
app.use('/api/sponsors', sponsorsRouter);

// Clubs endpoints
app.use('/api/clubs', clubsRouter);

// Backup endpoints
app.use('/api/backup', backupRouter);

// Persons endpoints
app.use('/api/persons', personsRouter);

// Skills endpoints (legacy path for backward-compat)
app.use('/api/skills', skillsRouter);


// Production namespace (new structured URLs)
app.use('/api/callsheets/templates', callSheetTemplateRouter);
app.use('/api/production', productionRouter);

// Players (images) endpoints
app.use('/api/players', playersRouter);

// Settings endpoints
app.use('/api/settings', settingsRouter);

// Season endpoints
app.use('/api/seasons', seasonsRouter);

// Match endpoints
app.use('/api/match', matchRouter);
app.use('/api/manual-matches', manualMatchesRouter);

// Scoreboard endpoints
app.use('/api/scoreboard', scoreboardRouter);

// vMix endpoints
app.use('/api/vmix', vmixRouter);
// vMix admin (templates) endpoints
app.use('/api/admin/vmix', adminVmixRouter);

// Reports endpoints
app.use('/api/reports', reportsRouter);

app.use('/api/show',  showControlRouter);

app.use('/api/time', timeRouter);

// OpenAPI JSON
const openapi = {
  openapi: '3.0.3',
  info: { title: 'Korfbal Stream API', version: '1.0.0' },
  servers: [{ url: 'http://localhost:3333' }],
  paths: {
    '/api/health': {
      get: { summary: 'Health check', responses: { '200': { description: 'OK' } } },
    },
    '/api/sponsors': {
      get: {
        summary: 'List sponsors',
        parameters: [
          { name: 'type', in: 'query', schema: { type: 'string', enum: ['premium', 'goud', 'zilver', 'brons'] } },
          { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 25 } },
        ],
        responses: {
          '200': {
            description: 'Paginated sponsors',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    items: { type: 'array', items: { $ref: '#/components/schemas/Sponsor' } },
                    page: { type: 'integer' },
                    limit: { type: 'integer' },
                    total: { type: 'integer' },
                    pages: { type: 'integer' },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        summary: 'Create sponsor',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/SponsorInput' } } },
        },
        responses: {
          '201': {
            description: 'Created',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Sponsor' } } },
          },
        },
      },
    },
    '/api/sponsors/{id}': {
      get: {
        summary: 'Get sponsor by id',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          '200': {
            description: 'OK',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Sponsor' } } },
          },
          '404': { description: 'Not found' },
        },
      },
      put: {
        summary: 'Update sponsor',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/SponsorUpdate' } } } },
        responses: {
          '200': {
            description: 'Updated',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Sponsor' } } },
          },
          '404': { description: 'Not found' },
        },
      },
      delete: {
        summary: 'Delete sponsor',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { '204': { description: 'Deleted' }, '404': { description: 'Not found' } },
      },
    },
  },
  components: {
    schemas: {
      Sponsor: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          name: { type: 'string' },
          type: { type: 'string', enum: ['premium', 'goud', 'zilver', 'brons'] },
          websiteUrl: { type: 'string' },
          logoUrl: {type: 'string', nullable: true, description: 'Set by POST /api/sponsors/{id}/logo: <organizationId>/<file> (older logos: a plain file name)'},
          createdAt: {type: 'string', format: 'date-time'},
        },
      },
      SponsorInput: {
        type: 'object',
        required: ['name', 'type', 'websiteUrl'],
        properties: {
          name: {type: 'string'},
          type: {type: 'string', enum: ['premium', 'goud', 'zilver', 'brons']},
          websiteUrl: {type: 'string'},
          logoUrl: {type: 'string', nullable: true, description: 'Only a logo in the organization\'s own directory (<organizationId>/<file>); null removes it'},
        },
      },
      SponsorUpdate: {
        type: 'object',
        properties: {
          name: {type: 'string'},
          type: {type: 'string', enum: ['premium', 'goud', 'zilver', 'brons']},
          websiteUrl: {type: 'string'},
          logoUrl: {type: 'string', nullable: true, description: 'Only a logo in the organization\'s own directory (<organizationId>/<file>); null removes it'},
        },
      },
    },
  },
} as const;

app.get('/api/openapi.json', (_req, res) => res.json(openapi));
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openapi));

// Health with DB check
app.get('/api/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ok: true, db: 'up'});
  } catch (e) {
    logger.error('Health check failed', e as any);
    res.status(503).json({ok: false, db: 'down'});
  }
});

// Error handler should be last
app.use(errorHandler);

// Start server automatically in non-test environments (works with Nx serve/dev)
if (process.env.NODE_ENV !== 'test') {
  const port = config.port;

  // Surface unhandled errors so Nx dev shows them instead of silent restarts
  process.on('uncaughtException', (err) => {
    logger.error('Uncaught exception', err as any);
  });
  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled rejection', reason as any);
  });

  requireConfig();

  // Finish moving legacy KNKV assets before serving requests, so no client sees a half-migrated photoUrl.
  const startServer = async () => {
    await migrateLegacySeasonAssets().catch((err) => {
      logger.error('Season asset migration failed', err as any);
    });
    await copyMatchSourceFromEnv().catch((err) => {
      logger.error('Copying MATCH_SCHEDULE_* into Fortuna\'s match source failed', err as any);
    });
    await applyStandardSetWhereMissing().catch((err) => {
      logger.error('Adding the standard set to new organizations failed', err as any);
    });
    httpServer.listen(port, () => {
      logger.info(`🚀 API Server running on http://localhost:${port}`);
      logger.info(`📊 Health check: http://localhost:${port}/api/health`);
      logger.info(`📚 Sponsors API: http://localhost:${port}/api/sponsors`);
      logger.info(`📚 MatchSchedule API: http://localhost:${port}/api/matches`);
      logger.info(`📚 Scoreboard API: http://localhost:${port}/api/scoreboard`);
      logger.info(`Database URL: ${config.databaseUrl}`)
      logConfig();
    });
  };
  void startServer();

  httpServer.on('error', (err) => {
    logger.error('Server listen error', err as any);
    process.exitCode = 1;
  });
}

export default app;
