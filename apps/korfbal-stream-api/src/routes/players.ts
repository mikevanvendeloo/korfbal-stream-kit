import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { prisma } from '../services/prisma';
import { logger } from '../utils/logger';
import { getAssetsRoot } from '../services/config';

export const playersRouter: Router = Router();

// Ensure assets/players exists
const uploadsRoot = getAssetsRoot();
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

// Create a new player
playersRouter.post('/', async (req, res, next) => {
  try {
    const clubId = Number(req.body?.clubId);
    const name = String(req.body?.name || '').trim();
    const shirtNo = req.body?.shirtNo ? Number(req.body.shirtNo) : null;
    const gender = req.body?.gender === 'male' || req.body?.gender === 'female' ? req.body.gender : null;
    const personType = String(req.body?.personType || 'player').trim();
    const func = String(req.body?.function || '').trim();
    const photoUrl = req.body?.photoUrl ? String(req.body.photoUrl).trim() : null;

    if (!Number.isInteger(clubId) || clubId <= 0) return res.status(400).json({ error: 'Invalid clubId' });
    if (!name) return res.status(400).json({ error: 'Name is required' });

    const club = await prisma.club.findUnique({ where: { id: clubId } });
    if (!club) return res.status(404).json({ error: 'Club not found' });

    const player = await prisma.player.create({
      data: {
        clubId,
        name,
        shirtNo,
        gender,
        personType,
        function: func || null,
        photoUrl,
      },
    });
    return res.status(201).json(player);
  } catch (err) {
    return next(err);
  }
});

// Update a player
playersRouter.put('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });

    const existing = await prisma.player.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Not found' });

    const name = req.body.name !== undefined ? String(req.body.name).trim() : undefined;
    const shirtNo = req.body.shirtNo !== undefined ? (req.body.shirtNo ? Number(req.body.shirtNo) : null) : undefined;
    const gender = req.body.gender !== undefined ? (req.body.gender === 'male' || req.body.gender === 'female' ? req.body.gender : null) : undefined;
    const personType = req.body.personType !== undefined ? String(req.body.personType).trim() : undefined;
    const func = req.body.function !== undefined ? String(req.body.function).trim() : undefined;
    const photoUrl = req.body.photoUrl !== undefined ? (req.body.photoUrl ? String(req.body.photoUrl).trim() : null) : undefined;

    if (name !== undefined && !name) return res.status(400).json({ error: 'Name cannot be empty' });

    const updated = await prisma.player.update({
      where: { id },
      data: {
        name,
        shirtNo,
        gender,
        personType,
        function: func || null,
        photoUrl,
      },
    });
    return res.json(updated);
  } catch (err) {
    return next(err);
  }
});

// Delete a player
playersRouter.delete('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });

    const existing = await prisma.player.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Not found' });

    await prisma.player.delete({ where: { id } });
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
});

export default playersRouter;
