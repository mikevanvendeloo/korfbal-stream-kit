import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import type {RequestHandler} from 'express';
import {keepOrganizationContext} from '../middleware/organizationContext';

/**
 * Logo uploads (organizations, sponsors): only png/jpeg/gif/webp, checked on the file's content, not
 * on its name or the type the browser claims. No SVG: it can carry scripts and is served same-origin.
 */
const IMAGE_TYPES: Array<{extension: string; mimeTypes: string[]; matches: (b: Buffer) => boolean}> = [
  {extension: '.png', mimeTypes: ['image/png'], matches: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))},
  {extension: '.jpg', mimeTypes: ['image/jpeg', 'image/jpg'], matches: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff},
  {extension: '.gif', mimeTypes: ['image/gif'], matches: (b) => ['GIF87a', 'GIF89a'].includes(b.subarray(0, 6).toString('latin1'))},
  {extension: '.webp', mimeTypes: ['image/webp'], matches: (b) => b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP'},
];
export const IMAGE_EXTENSIONS = IMAGE_TYPES.map((t) => t.extension);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export class ImageUploadError extends Error {
  readonly status = 400;
}

const NOT_AN_IMAGE = 'Alleen afbeeldingen (png, jpg, gif of webp)';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {fileSize: MAX_IMAGE_BYTES, files: 1},
  fileFilter: (_req, file, cb) => {
    if (IMAGE_TYPES.some((t) => t.mimeTypes.includes(file.mimetype))) return cb(null, true);
    return cb(new ImageUploadError(NOT_AN_IMAGE));
  },
});

/** Multer for one image in field `field`, kept in memory; errors become 400 and the organization stays. */
export function singleImage(field = 'file'): RequestHandler {
  const handler = keepOrganizationContext(upload.single(field));
  return (req, res, next) => handler(req, res, (err?: unknown) => {
    if (err instanceof multer.MulterError) return next(new ImageUploadError(err.code === 'LIMIT_FILE_SIZE' ? 'Afbeelding is te groot (max. 5 MB)' : err.message));
    return next(err);
  });
}

/** The extension for the image's actual content, or an ImageUploadError when it isn't one we accept. */
export function imageExtension(file: Express.Multer.File): string {
  const type = IMAGE_TYPES.find((t) => t.matches(file.buffer));
  if (!type) throw new ImageUploadError(NOT_AN_IMAGE);
  return type.extension;
}

/** `[a-z0-9-]` only, so a name can never leave its directory. */
export function safeFileBase(input: string): string {
  const base = String(input || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!base) throw new ImageUploadError('Ongeldige bestandsnaam');
  return base;
}

/**
 * Writes the image as `<dir>/<base><ext>` (other extensions of the same base are removed) and returns
 * the file name. Refuses anything that would resolve outside `dir`.
 */
export function saveImage(dir: string, base: string, file: Express.Multer.File): string {
  const fileName = `${safeFileBase(base)}${imageExtension(file)}`;
  const root = path.resolve(dir);
  const target = path.resolve(root, fileName);
  if (path.dirname(target) !== root) throw new ImageUploadError('Ongeldige bestandsnaam');
  fs.mkdirSync(root, {recursive: true});
  for (const ext of IMAGE_EXTENSIONS) {
    const other = path.join(root, `${safeFileBase(base)}${ext}`);
    if (other !== target && fs.existsSync(other)) fs.unlinkSync(other);
  }
  fs.writeFileSync(target, file.buffer);
  return fileName;
}
