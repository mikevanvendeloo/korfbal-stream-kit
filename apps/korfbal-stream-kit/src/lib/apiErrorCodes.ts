/**
 * The stable `code` the API sends next to `error` when it refuses a request for its organization, key
 * or origin (and in `connect_error` `data.code` of a refused socket handshake). Match on these, never on
 * the message text: the text may change.
 *
 * Keep in sync with apps/korfbal-stream-api/src/services/apiErrorCodes.ts.
 */
export const API_ERROR_CODES = {
  /** 401: no organization chosen */
  ORGANIZATION_REQUIRED: 'ORGANIZATION_REQUIRED',
  /** 403: unknown or inactive organization */
  ORGANIZATION_UNKNOWN: 'ORGANIZATION_UNKNOWN',
  /** 401: a feed without API key or organization */
  API_KEY_MISSING: 'API_KEY_MISSING',
  /** 401: an unknown or revoked key */
  API_KEY_INVALID: 'API_KEY_INVALID',
  /** 403: a write from a page on another site */
  CROSS_SITE_REFUSED: 'CROSS_SITE_REFUSED',
  // Match import: the API answers `{ok: false, error, code, hint}` with one of these
  /** 409: no (enabled) match source for this organization */
  SOURCE_NOT_CONFIGURED: 'SOURCE_NOT_CONFIGURED',
  /** 400: not DD-MM-YYYY, YYYY-MM-DD or N-weeks, or a date that does not exist */
  INVALID_DATE: 'INVALID_DATE',
  /** 502: the source refused the token (invalid or expired) */
  SOURCE_UNAUTHORIZED: 'SOURCE_UNAUTHORIZED',
  /** 502: the URL is wrong */
  SOURCE_NOT_FOUND: 'SOURCE_NOT_FOUND',
  /** 502: the source refused the request otherwise */
  SOURCE_REJECTED: 'SOURCE_REJECTED',
  /** 502: the source had a server error */
  SOURCE_SERVER_ERROR: 'SOURCE_SERVER_ERROR',
  /** 504: no answer in time */
  SOURCE_TIMEOUT: 'SOURCE_TIMEOUT',
  /** 502: DNS, connection refused or TLS */
  SOURCE_UNREACHABLE: 'SOURCE_UNREACHABLE',
  /** 502: not JSON or an unexpected shape */
  SOURCE_INVALID_RESPONSE: 'SOURCE_INVALID_RESPONSE',
} as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[keyof typeof API_ERROR_CODES];
