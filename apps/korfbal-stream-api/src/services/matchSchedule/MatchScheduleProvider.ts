// Contract for any external system that can supply match schedule data.
// Implement this interface to add a new source (e.g. Sportlink) alongside
// the existing vrijwilligers-system adapter, without touching the route layer.

export interface MatchScheduleFetchParams {
  // Passed through to the provider as-is (e.g. an ISO date or a relative
  // range like '20-weeks', depending on what the provider supports).
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
