/** The item LIVE shows a clock for: the running stream item and the running hall item */
type ClockItem = {showVenueClock?: boolean | null} | null | undefined;

/**
 * LIVE shows the Zaal clock only while the running stream item or the running hall item has Zaalklok tonen
 * (openspec/changes/match-parts D4).
 */
export function showsVenueClock(activeEvent: ClockItem, activeVenueEvent: ClockItem): boolean {
  return !!activeEvent?.showVenueClock || !!activeVenueEvent?.showVenueClock;
}
