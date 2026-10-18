import type {Response} from 'express';
import {API_ERRORS, apiErrorBody, type ApiErrorCode} from '../apiErrorCodes';
import {prisma} from '../prisma';
import {requireOrganizationId} from '../organizationContext';
import {logger} from '../../utils/logger';
import {InvalidMatchScheduleResponseError, type MatchScheduleFetchParams, type NormalizedMatchItem} from './MatchScheduleProvider';
import {getMatchScheduleProvider, getMatchSource, MatchSourceNotConfiguredError} from './matchSource';

/** The categories a failing match source is reported as (API_ERRORS in services/apiErrorCodes.ts). */
export type MatchSourceErrorCode = Extract<ApiErrorCode,
  'SOURCE_NOT_CONFIGURED' | 'SOURCE_UNAUTHORIZED' | 'SOURCE_NOT_FOUND' | 'SOURCE_REJECTED' | 'SOURCE_SERVER_ERROR'
  | 'SOURCE_TIMEOUT' | 'SOURCE_UNREACHABLE' | 'SOURCE_INVALID_RESPONSE'>;

/** A failed call to the match source, as a category only: the details stay in the server log. */
export class MatchSourceError extends Error {
  constructor(readonly code: MatchSourceErrorCode) {
    super(`Match source failed: ${code}`);
    this.name = 'MatchSourceError';
  }
}

type UpstreamError = {
  isAxiosError?: boolean;
  code?: string;
  response?: {status?: number; data?: unknown};
};

const TIMEOUT_CODES = new Set(['ECONNABORTED', 'ETIMEDOUT', 'ESOCKETTIMEDOUT']);

/** Maps a failure of the provider call to its category; null when it is not a match source failure. */
export function classifyMatchSourceError(err: unknown): MatchSourceErrorCode | null {
  if (err instanceof MatchSourceNotConfiguredError) return 'SOURCE_NOT_CONFIGURED';
  if (err instanceof InvalidMatchScheduleResponseError) return 'SOURCE_INVALID_RESPONSE';
  const e = err as UpstreamError | null;
  if (!e?.isAxiosError) return null;
  const status = e.response?.status;
  if (status !== undefined) {
    if (status === 401 || status === 403) return 'SOURCE_UNAUTHORIZED';
    if (status === 404) return 'SOURCE_NOT_FOUND';
    if (status >= 500) return 'SOURCE_SERVER_ERROR';
    if (status >= 400) return 'SOURCE_REJECTED';
    return 'SOURCE_INVALID_RESPONSE';
  }
  if (e.code && TIMEOUT_CODES.has(e.code)) return 'SOURCE_TIMEOUT';
  // No answer at all: DNS, connection refused or reset, TLS
  return 'SOURCE_UNREACHABLE';
}

const BODY_LOG_LIMIT = 500;
const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * The upstream body for the server log: at most ~500 characters, without the token or anything that
 * looks like an Authorization value (an upstream may echo the request headers).
 */
export function redactUpstreamBody(body: unknown, token?: string | null): string | undefined {
  if (body === undefined || body === null || body === '') return undefined;
  let text: string;
  if (typeof body === 'string') text = body;
  else if (Buffer.isBuffer(body)) text = body.toString('utf8');
  else {
    try {
      text = JSON.stringify(body);
    } catch {
      text = String(body);
    }
  }
  // Redact before cutting, so a token on the cut can't leave a piece behind
  if (token) {
    // Also as it appears JSON-escaped or URL-encoded in an echo, in any case
    const forms = new Set([token, JSON.stringify(token).slice(1, -1), encodeURIComponent(token)]);
    for (const form of forms) text = text.replace(new RegExp(escapeRegExp(form), 'gi'), '[token]');
  }
  text = text
    .replace(/(authorization["']?\s*[:=]\s*["']?)(?:bearer\s+)?[^\s"',;}]+/gi, '$1[verwijderd]')
    .replace(/\bbearer\s+[^\s"',;}]+/gi, 'Bearer [verwijderd]');
  return text.length > BODY_LOG_LIMIT ? `${text.slice(0, BODY_LOG_LIMIT)}…` : text;
}

async function organizationSlug(): Promise<string | undefined> {
  try {
    return (await prisma.organization.findUnique({where: {id: requireOrganizationId()}, select: {slug: true}}))?.slug;
  } catch {
    return undefined;
  }
}

/**
 * Fetches matches from the organization's match source. A failure is logged (warn) with the details
 * and thrown as a MatchSourceError with only its category; other errors are thrown as they are.
 */
export async function fetchFromMatchSource(params: MatchScheduleFetchParams): Promise<NormalizedMatchItem[]> {
  const started = Date.now();
  let source: Awaited<ReturnType<typeof getMatchSource>> = null;
  try {
    source = await getMatchSource();
    const provider = await getMatchScheduleProvider();
    return await provider.fetchMatches(params);
  } catch (err) {
    const code = classifyMatchSourceError(err);
    if (!code) throw err;
    if (code === 'SOURCE_NOT_CONFIGURED') throw new MatchSourceError(code);
    const e = err as UpstreamError & {body?: unknown};
    logger.warn('Match source request failed', {
      organization: await organizationSlug(),
      provider: source?.provider,
      category: code,
      upstreamStatus: e.response?.status ?? null,
      axiosCode: e.code ?? null,
      durationMs: Date.now() - started,
      body: redactUpstreamBody(e.response?.data ?? e.body, source?.apiToken),
    });
    throw new MatchSourceError(code);
  }
}

/** Answers with the category's status and `{ok: false, error, code, hint}`; `error` can be made more specific. */
export function sendMatchImportError(res: Response, code: MatchSourceErrorCode | 'INVALID_DATE', error?: string) {
  const body = apiErrorBody(code);
  return res.status(API_ERRORS[code].status).json({ok: false, ...body, ...(error ? {error} : {})});
}
