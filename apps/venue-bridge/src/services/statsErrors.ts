/** A refusal the routes answer with a Dutch message and status (no internals). */
export class StatsError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const NOT_CONFIGURED_PAGE = new StatsError(409, 'PAGE_URL is niet ingesteld op de bridge');
