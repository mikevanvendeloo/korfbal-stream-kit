// Contract for any external system that can supply match schedule data.
// Implement this interface to add a new source (e.g. Sportlink) alongside
// the existing vrijwilligers-system adapter, without touching the route layer.

export interface MatchScheduleFetchParams {
  // An ISO day (YYYY-MM-DD) or a range in weeks like '30-weeks'. The provider converts it to the
  // format its source accepts.
  date: string;
  location?: string;
}

// Shape a provider must return - matches the persisted MatchSchedule fields
// (Prisma model) so routes can upsert it without any further mapping.
export interface NormalizedMatchItem {
  externalId: string;
  date: Date;
  homeTeamName: string;
  awayTeamName: string;
  accommodationName: string | null;
  accommodationRoute: string | null;
  attendanceTime: Date | null;
  isPracticeMatch: boolean;
  isHomeMatch: boolean;
  isCompetitiveMatch: boolean;
  fieldName: string | null;
  refereeName: string | null;
  reserveRefereeName: string | null;
  color: string | null;
}

export interface MatchScheduleProvider {
  fetchMatches(params: MatchScheduleFetchParams): Promise<NormalizedMatchItem[]>;
}

// Thrown when the upstream answers, but not with data the provider understands
// (e.g. an HTML error page from a proxy). Lets the route report it distinctly
// from network errors.
export class InvalidMatchScheduleResponseError extends Error {
  constructor(message = 'Invalid response format from program API', /** The answer, for the server log only */ readonly body?: unknown) {
    super(message);
    this.name = 'InvalidMatchScheduleResponseError';
  }
}
