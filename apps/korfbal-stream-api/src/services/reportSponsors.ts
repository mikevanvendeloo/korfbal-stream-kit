import fs from 'node:fs';
import path from 'node:path';
import {getAssetsRoot} from './config';

type SponsorLike = { name: string; displayName?: string | null; logoUrl: string | null };

const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * The sponsor a report field refers to. The field holds a name (chosen from the list or typed),
 * so a typed name only gets a logo when it matches a sponsor's name or display name.
 */
export function findSponsorByName<T extends SponsorLike>(name: string | null | undefined, sponsors: T[]): T | undefined {
  if (!name?.trim()) return undefined;
  const wanted = normalize(name);
  return sponsors.find((s) => normalize(s.name) === wanted)
    ?? sponsors.find((s) => s.displayName && normalize(s.displayName) === wanted);
}

/**
 * Path of a sponsor logo below the assets root (served under /uploads), or null without a logo.
 * Works for both forms of `logoUrl`: `<organizationId>/<file>` and a legacy plain file name.
 */
export function sponsorLogoPath(sponsor: SponsorLike | undefined): string | null {
  const file = sponsor?.logoUrl?.trim();
  return file ? `sponsors/${file}` : null;
}

export type ImageFormat = 'png' | 'jpeg' | 'gif' | 'webp';

/** The image format by the file's first bytes (not its name), or null when it is none of the upload formats. */
export function imageFormatOf(head: Buffer): ImageFormat | null {
  if (head.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return 'jpeg';
  if (['GIF87a', 'GIF89a'].includes(head.subarray(0, 6).toString('latin1'))) return 'gif';
  if (head.subarray(0, 4).toString('latin1') === 'RIFF' && head.subarray(8, 12).toString('latin1') === 'WEBP') return 'webp';
  return null;
}

/**
 * An image for PDFKit, which only draws PNG and JPEG:
 * - `ok`: an existing PNG/JPEG file (by content, whatever its extension) inside the assets dir;
 * - `unsupported`: the file exists but is another format (webp, gif, or not an image at all), so the
 *   report prints a note instead. No conversion: that needs a native dependency such as sharp, which
 *   the hardened runtime image can't build;
 * - `missing`: no file there, or a path outside the assets dir.
 */
export type PdfImage = {status: 'ok'; file: string} | {status: 'unsupported'; format: string} | {status: 'missing'};

export function pdfImage(relativePath: string | null | undefined): PdfImage | null {
  if (!relativePath?.trim()) return null;
  const root = path.resolve(getAssetsRoot());
  // Relative to the assets dir, also with a leading slash (like path.join)
  const full = path.resolve(root, relativePath.replace(/^[/\\]+/, ''));
  // The path comes from the database (logoUrl, import), but never read outside the assets dir
  if (!full.startsWith(root + path.sep)) return {status: 'missing'};
  let head: Buffer;
  try {
    const fd = fs.openSync(full, 'r');
    try {
      const buffer = Buffer.alloc(12);
      head = buffer.subarray(0, fs.readSync(fd, buffer, 0, buffer.length, 0));
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    return {status: 'missing'}; // no such file, a directory, or unreadable
  }
  const format = imageFormatOf(head);
  if (format === 'png' || format === 'jpeg') return {status: 'ok', file: full};
  return {status: 'unsupported', format: format ?? 'onbekend formaat'};
}

/** The file on disk when PDFKit can draw it (PNG or JPEG by content, inside the assets dir), else null. */
export function sponsorLogoFile(logoPath: string | null): string | null {
  const image = pdfImage(logoPath);
  return image?.status === 'ok' ? image.file : null;
}
