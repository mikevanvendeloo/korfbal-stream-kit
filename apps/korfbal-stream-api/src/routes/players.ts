import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { prisma } from '../services/prisma';
import { logger } from '../utils/logger';

export const playersRouter: Router = Router();

// Ensure uploads/players exists
const uploadsRoot = path.join(process.cwd(), 'uploads');
const playersDir = path.join(uploadsRoot, 'players');
if (!fs.existsSync(playersDir)) fs.mkdirSync(playersDir, { recursive: true });

function normalizeBaseName(input: string): string {
  let s = String(input || '').normalize('NFD').replace(/\p{Diacritic}/gu, '');
  // keep dots (for extension), dashes and underscores in base
  s = s.replace(/[^a-zA-Z0-9._-]+/g, '-');
  // collapse multiple dashes
  s = s.replace(/-+/g, '-');
  // trim leading/trailing dashes and dots
  s = s.replace(/^[.-]+|[.-]+$/g, '');
  return s || 'player.png';
}

function ensureUniqueFilename(dir: string, desired: string): string {
  const ext = path.extname(desired) || '.png';
  const base = path.basename(desired, ext);
  let candidate = `${base}${ext}`;
  let i = 1;
  while (fs.existsSync(path.join(dir, candidate))) {
    candidate = `${base}-${i++}${ext}`;
  }
  return candidate;
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, playersDir),
  filename: (_req, file, cb) => {
    const orig = file.originalname || 'player.png';
    const desired = normalizeBaseName(orig);
    const finalName = ensureUniqueFilename(playersDir, desired);
    cb(null, finalName);
  },
});
const upload = multer({ storage });

// List player images
playersRouter.get('/images', async (_req, res, next) => {
  try {
    const items = await (prisma as any).playerImage.findMany({ orderBy: { id: 'asc' } });
    return res.json({ items });
  } catch (err) {
    logger.error('GET /players/images failed', err as any);
    return next(err);
  }
});

// Upload a new player image with subject (optional: derives from filename)
playersRouter.post('/images', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'file is required' });

    // Derive subject when not provided: use saved filename without extension
    const providedSubject = String(req.body?.subject || '').trim();
    let subject = providedSubject;
    if (!subject) {
      const saved = path.basename(req.file.filename);
      const subjectFromName = saved.replace(/\.[^.]+$/i, '');
      subject = subjectFromName.trim();
    }
    if (!subject) {
      // Clean up uploaded file if we somehow still lack a subject
      if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'subject is required' });
    }

    const relPath = path.join('players', path.basename(req.file.filename));
    const created = await (prisma as any).playerImage.create({ data: { subject, filename: relPath } });
    return res.status(201).json(created);
  } catch (err) {
    logger.error('POST /players/images failed', err as any);
    return next(err);
  }
});

// Delete player image by id (also remove file)
playersRouter.delete('/images/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'invalid id' });
    const existing = await (prisma as any).playerImage.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Not found' });

    // Remove db row
    await (prisma as any).playerImage.delete({ where: { id } });

    // Remove file best-effort
    try {
      const full = path.join(uploadsRoot, existing.filename);
      if (fs.existsSync(full)) fs.unlinkSync(full);
    } catch {
      // ignore
    }

    return res.status(204).send();
  } catch (err) {
    logger.error('DELETE /players/images/:id failed', err as any);
    return next(err);
  }
});

export default playersRouter;
