import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import swaggerUi from 'swagger-ui-express';
import {logger} from './utils/logger';
import {sponsorsRouter} from './routes/sponsors';
import {prisma} from './services/prisma';
import {config} from './services/config';
import {errorHandler} from './middleware/error';

const app = express();

// Middlewares
app.use(express.json());

// Simple request logging
app.use((req, res, next) => {
  logger.info({msg: 'request', method: req.method, url: req.url});
  next();
});

// File uploads (store under uploads/)
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, {recursive: true});
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname || '.bin'));
  },
});
const upload = multer({storage});

app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({error: 'No file uploaded'});
  }
  return res.status(201).json({filename: req.file.filename, path: req.file.path});
});

// Sponsors endpoints
app.use('/api/sponsors', sponsorsRouter);

// OpenAPI JSON
const openapi = {
  openapi: '3.0.3',
  info: {title: 'Korfbal Stream API', version: '1.0.0'},
  servers: [{url: 'http://localhost:3333'}],
  paths: {
    '/api/health': {
      get: {summary: 'Health check', responses: {'200': {description: 'OK'}}},
    },
    '/api/sponsors': {
      get: {
        summary: 'List sponsors',
        parameters: [
          {name: 'type', in: 'query', schema: {type: 'string', enum: ['premium', 'goud', 'zilver', 'brons']}},
          {name: 'page', in: 'query', schema: {type: 'integer', minimum: 1, default: 1}},
          {name: 'limit', in: 'query', schema: {type: 'integer', minimum: 1, maximum: 100, default: 25}},
        ],
        responses: {
          '200': {
            description: 'Paginated sponsors',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    items: {type: 'array', items: {$ref: '#/components/schemas/Sponsor'}},
                    page: {type: 'integer'},
                    limit: {type: 'integer'},
                    total: {type: 'integer'},
                    pages: {type: 'integer'},
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
          content: {'application/json': {schema: {$ref: '#/components/schemas/SponsorInput'}}},
        },
        responses: {
          '201': {
            description: 'Created',
            content: {'application/json': {schema: {$ref: '#/components/schemas/Sponsor'}}}
          }
        },
      },
    },
    '/api/sponsors/{id}': {
      get: {
        summary: 'Get sponsor by id',
        parameters: [{name: 'id', in: 'path', required: true, schema: {type: 'integer'}}],
        responses: {
          '200': {
            description: 'OK',
            content: {'application/json': {schema: {$ref: '#/components/schemas/Sponsor'}}}
          }, '404': {description: 'Not found'}
        },
      },
      put: {
        summary: 'Update sponsor',
        parameters: [{name: 'id', in: 'path', required: true, schema: {type: 'integer'}}],
        requestBody: {content: {'application/json': {schema: {$ref: '#/components/schemas/SponsorUpdate'}}}},
        responses: {
          '200': {
            description: 'Updated',
            content: {'application/json': {schema: {$ref: '#/components/schemas/Sponsor'}}}
          }, '404': {description: 'Not found'}
        },
      },
      delete: {
        summary: 'Delete sponsor',
        parameters: [{name: 'id', in: 'path', required: true, schema: {type: 'integer'}}],
        responses: {'204': {description: 'Deleted'}, '404': {description: 'Not found'}},
      },
    },
  },
  components: {
    schemas: {
      Sponsor: {
        type: 'object',
        properties: {
          id: {type: 'integer'},
          name: {type: 'string'},
          type: {type: 'string', enum: ['premium', 'goud', 'zilver', 'brons']},
          websiteUrl: {type: 'string'},
          logoUrl: {type: 'string'},
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
          logoUrl: {type: 'string'},
        },
      },
      SponsorUpdate: {
        type: 'object',
        properties: {
          name: {type: 'string'},
          type: {type: 'string', enum: ['premium', 'goud', 'zilver', 'brons']},
          websiteUrl: {type: 'string'},
          logoUrl: {type: 'string'},
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

// Start only if invoked directly
if (require.main === module) {
  const port = config.port;
  app.listen(port, () => {
    logger.info({msg: `API listening on http://localhost:${port}`});
  });
}

export default app;
