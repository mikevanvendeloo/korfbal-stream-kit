/** A refusal the stats routes answer with a Dutch message and status (no internals). */
export class StatsError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const NOT_CONFIGURED_PAGE = new StatsError(409, 'Statistieken zijn niet ingesteld: vul de statistiekenpagina in bij Instellingen');
