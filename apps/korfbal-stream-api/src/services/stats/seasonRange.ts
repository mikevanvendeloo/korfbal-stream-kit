/** The first day of a season for the statistics: the indoor start, else 1 July of the start year (ISO date). */
export function seasonStart(season: {startYear: number; indoorStartDate: Date | null}): string {
  return season.indoorStartDate ? season.indoorStartDate.toISOString().slice(0, 10) : `${season.startYear}-07-01`;
}
