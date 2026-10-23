import fs from 'node:fs';
import path from 'node:path';
import {getAssetsRoot} from './config';
import {unsafeImageReason} from './imageSafety';

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

export type ImageFormat = 'png' | 'jpeg' | 'gif' | 'webp';

/** The image format by the file's first bytes (not its name), or null when it is none of the upload formats. */
export function imageFormatOf(head: Buffer): ImageFormat | null {
  if (head.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return 'jpeg';
  if (['GIF87a', 'GIF89a'].includes(head.subarray(0, 6).toString('latin1'))) return 'gif';
  if (head.subarray(0, 4).toString('latin1') === 'RIFF' && head.subarray(8, 12).toString('latin1') === 'WEBP') return 'webp';
  return null;
}

/** O_NOFOLLOW: never open through a symlink; O_NONBLOCK: opening a FIFO can't block the event loop. */
const OPEN_FLAGS = fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0) | (fs.constants.O_NONBLOCK ?? 0);

/**
 * The real path of `relativePath` below the assets root, or null when it isn't a regular file that
 * really is there: outside the root (also through `..`), reached through a symlink (none are followed,
 * file or directory), missing, a directory, FIFO or device. The root itself may be a symlink (e.g.
 * /tmp on macOS). Shared by the PDF reports and the image download.
 */
export function assetFilePath(relativePath: string, root = getAssetsRoot()): string | null {
  let realRoot: string;
  try {
    realRoot = fs.realpathSync(root);
  } catch {
    return null;
  }
  // Relative to the assets dir, also with a leading slash (like path.join)
  const full = path.resolve(realRoot, relativePath.replace(/^[/\\]+/, ''));
  if (!full.startsWith(realRoot + path.sep)) return null;
  let real: string;
  try {
    real = fs.realpathSync(full);
    if (!fs.statSync(real).isFile()) return null;
  } catch {
    return null; // no such file
  }
  // No symlinks at all below the root (one may point anywhere): the real path must be the path itself
  return real === full ? real : null;
}

/**
 * The bytes of a regular file below the assets root (see assetFilePath), read once with a size limit,
 * or null (`'too-large'` above `maxBytes`).
 */
export function readAssetFile(relativePath: string, maxBytes: number, root = getAssetsRoot()): Buffer | 'too-large' | null {
  const real = assetFilePath(relativePath, root);
  if (!real) return null;
  let fd: number;
  try {
    fd = fs.openSync(real, OPEN_FLAGS);
  } catch {
    return null;
  }
  try {
    // Checked again on the open file: it may have been swapped since assetFilePath
    const stat = fs.fstatSync(fd);
    if (!stat.isFile()) return null;
    if (stat.size > maxBytes) return 'too-large';
    const buffer = Buffer.alloc(stat.size);
    let read = 0;
    while (read < buffer.length) {
      const n = fs.readSync(fd, buffer, read, buffer.length - read, read);
      if (n === 0) break;
      read += n;
    }
    return buffer.subarray(0, read);
  } catch {
    return null;
  } finally {
    fs.closeSync(fd);
  }
}

/**
 * An image for PDFKit, which only draws PNG and JPEG:
 * - `ok`: the file's bytes, read once (so nothing can swap the file between the check and PDFKit;
 *   pass `data` to `doc.image`): a regular file inside the assets dir, at most 10 MB, PNG/JPEG by
 *   content, within the pixel limit and, for a PNG, with sound data (services/imageSafety.ts);
 * - `unsupported`: the file exists but is another format (webp, gif, or not an image at all), too
 *   large or broken, so the report prints a note instead. No conversion: that needs a native
 *   dependency such as sharp, which the hardened runtime image can't build;
 * - `missing`: no regular file there, or a path outside the assets dir.
 */
export type PdfImage = {status: 'ok'; data: Buffer} | {status: 'unsupported'; format: string} | {status: 'missing'};

export const MAX_PDF_IMAGE_BYTES = 10 * 1024 * 1024;

export function pdfImage(relativePath: string | null | undefined): PdfImage | null {
  if (!relativePath?.trim()) return null;
  const data = readAssetFile(relativePath, MAX_PDF_IMAGE_BYTES);
  if (data === null) return {status: 'missing'};
  if (data === 'too-large') return {status: 'unsupported', format: 'bestand te groot'};
  const format = imageFormatOf(data);
  if (format !== 'png' && format !== 'jpeg') return {status: 'unsupported', format: format ?? 'onbekend formaat'};
  const unsafe = unsafeImageReason(data);
  if (unsafe) return {status: 'unsupported', format: unsafe};
  return {status: 'ok', data};
}

/** The image bytes when PDFKit can draw them (see pdfImage), else null. */
export function pdfImageData(relativePath: string | null | undefined): Buffer | null {
  const image = pdfImage(relativePath);
  return image?.status === 'ok' ? image.data : null;
}
