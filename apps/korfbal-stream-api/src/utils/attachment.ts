/**
 * `Content-Disposition: attachment` with a safe file name. Names come from user data (team names,
 * template names): quotes, semicolons or non-ASCII characters could change the header's parameters
 * (e.g. inject `filename*=`) or make Node refuse the header. Only letters, digits, `.`, `_` and `-`
 * remain; accents are dropped to their base letter.
 */
export function attachmentFileName(name: string): string {
  const safe = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^[-.]+|-+$/g, '')
    .slice(0, 150);
  return safe || 'download';
}

export function contentDisposition(name: string): string {
  return `attachment; filename="${attachmentFileName(name)}"`;
}
