import type {Response} from 'express';

/**
 * Stable codes the API sends next to `error` when it refuses a request for its organization, key or
 * origin. Clients (the kit) act on the code, never on the text, so a message can change freely.
 * The socket handshake sends the same code in `connect_error` `data.code`.
 *
 * Keep in sync with apps/korfbal-stream-kit/src/lib/apiErrorCodes.ts.
 */
export const API_ERRORS = {
  /** No organization chosen (no X-Organization header) */
  ORGANIZATION_REQUIRED: {status: 401, error: 'Kies een organisatie'},
  /** Unknown, inactive or malformed organization */
  ORGANIZATION_UNKNOWN: {status: 403, error: 'Onbekende of inactieve organisatie'},
  /** A feed without an API key or organization */
  API_KEY_MISSING: {status: 401, error: 'API-sleutel ontbreekt'},
  /** An unknown or revoked key, or one of an inactive organization */
  API_KEY_INVALID: {status: 401, error: 'Ongeldige API-sleutel'},
  /** A state-changing request from a page on another site (CSRF guard) */
  CROSS_SITE_REFUSED: {status: 403, error: 'Verzoek van een andere website geweigerd'},
} as const;

export type ApiErrorCode = keyof typeof API_ERRORS;

/** The response body for a refusal: `{error, code}`. */
export function apiErrorBody(code: ApiErrorCode): {error: string; code: ApiErrorCode} {
  return {error: API_ERRORS[code].error, code};
}

/** Answers the request with the refusal's status and `{error, code}`. */
export function sendApiError(res: Response, code: ApiErrorCode) {
  return res.status(API_ERRORS[code].status).json(apiErrorBody(code));
}
