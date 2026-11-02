/** The part of an item matchParts needs: the live item's status and whether it is a match part */
export type MatchPartItem = {
  status: string;
  isMatchPart?: boolean | null;
};

export type MatchPartState = {
  /** The match part the match is in: how many have started (ACTIVE or COMPLETED), at least 1 (a match always starts in part 1) */
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
    matchPart: Math.max(1, parts.filter((item) => item.status === 'ACTIVE' || item.status === 'COMPLETED').length),
    matchPartRunning: parts.some((item) => item.status === 'ACTIVE'),
  };
}
