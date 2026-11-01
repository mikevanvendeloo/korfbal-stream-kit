/** The part of an item matchParts needs: the live item's status and whether it is a match part */
export type MatchPartItem = {
  status: string;
  isMatchPart?: boolean | null;
};

export type MatchPartState = {
  /** How many match parts have started (ACTIVE or COMPLETED); 0 before the first */
  matchPart: number;
  /** One of the match parts is ACTIVE */
  matchPartRunning: boolean;
};

/**
 * The current match part, from the live items in draaiboek order (`order`). No state of its own:
 * it follows Volgend/Vorig and survives a restart of the API.
 */
export function matchPartState(items: MatchPartItem[]): MatchPartState {
  const parts = items.filter((item) => item.isMatchPart);
  return {
    matchPart: parts.filter((item) => item.status === 'ACTIVE' || item.status === 'COMPLETED').length,
    matchPartRunning: parts.some((item) => item.status === 'ACTIVE'),
  };
}
