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

  // Match import (POST /api/match-source/test and POST /api/match/matches/schedule/import). A failure
  // of the match source is reported as one of these categories, never with the upstream body, headers
  // or exact status: the address is chosen in Beheer, so details would make this a probe for other
  // servers (and could echo the token). The details go to the server log (services/matchSchedule/matchSourceFetch.ts).
  /** The organization has no (enabled) match source */
  SOURCE_NOT_CONFIGURED: {
    status: 409, error: 'Wedstrijdimport is niet ingesteld voor deze organisatie',
    hint: 'Stel bij Setup → Organisatie → Wedstrijdimport de bron, het adres en het token in, zet de wedstrijdimport aan en sla op.',
  },
  /** The date is not DD-MM-YYYY, YYYY-MM-DD or a range in weeks, or does not exist */
  INVALID_DATE: {
    status: 400, error: 'Ongeldige datum',
    hint: 'Gebruik een dag als DD-MM-JJJJ (bijvoorbeeld 08-02-2026) of een aantal weken vanaf deze week (bijvoorbeeld 30-weeks).',
  },
  /** Upstream 401/403 */
  SOURCE_UNAUTHORIZED: {
    status: 502, error: 'Token ongeldig of verlopen',
    hint: 'Vul bij Setup → Organisatie → Wedstrijdimport een nieuw token in en sla op.',
  },
  /** Upstream 404 */
  SOURCE_NOT_FOUND: {
    status: 502, error: 'URL klopt niet',
    hint: 'Controleer het Adres (URL) bij Setup → Organisatie → Wedstrijdimport, bijvoorbeeld https://api.sportclubvrijwilligersmanagement.nl/v1.',
  },
  /** Upstream 4xx other than 401/403/404 */
  SOURCE_REJECTED: {
    status: 502, error: 'De wedstrijdbron weigerde het verzoek',
    hint: 'Controleer de datum en het Adres (URL). Blijft het misgaan, neem dan contact op met de beheerder van de wedstrijdbron.',
  },
  /** Upstream 5xx */
  SOURCE_SERVER_ERROR: {
    status: 502, error: 'De wedstrijdbron gaf een serverfout',
    hint: 'Mogelijk klopt het datumformaat niet (gebruik DD-MM-JJJJ of bijvoorbeeld 30-weeks), of heeft de wedstrijdbron een storing. Probeer het later opnieuw.',
  },
  /** No answer within the time limit */
  SOURCE_TIMEOUT: {
    status: 504, error: 'De wedstrijdbron reageert niet op tijd',
    hint: 'Probeer het later opnieuw, of kies een kortere periode.',
  },
  /** DNS, connection refused, TLS */
  SOURCE_UNREACHABLE: {
    status: 502, error: 'De wedstrijdbron is niet bereikbaar',
    hint: 'Controleer het Adres (URL) en of de server van StreamKit internet heeft.',
  },
  /** An answer that is not JSON or not the expected shape */
  SOURCE_INVALID_RESPONSE: {
    status: 502, error: 'De wedstrijdbron gaf een onverwacht antwoord',
    hint: 'Controleer het Adres (URL): het moet naar de API van de bron wijzen (eindigt meestal op /v1), niet naar de website.',
  },
} as const;

export type ApiErrorCode = keyof typeof API_ERRORS;

/** The response body for a refusal: `{error, code}`, plus `hint` when the code has one. */
export function apiErrorBody(code: ApiErrorCode): {error: string; code: ApiErrorCode; hint?: string} {
  const entry: {error: string; hint?: string} = API_ERRORS[code];
  return entry.hint ? {error: entry.error, code, hint: entry.hint} : {error: entry.error, code};
}

/** Answers the request with the refusal's status and `{error, code}` (and `hint`). */
export function sendApiError(res: Response, code: ApiErrorCode) {
  return res.status(API_ERRORS[code].status).json(apiErrorBody(code));
}
