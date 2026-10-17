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
} as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[keyof typeof API_ERROR_CODES];
