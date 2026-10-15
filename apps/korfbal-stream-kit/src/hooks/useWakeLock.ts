import {useEffect} from 'react';

type WakeLockSentinel = { release: () => Promise<void> };
type WakeLockApi = { request: (type: 'screen') => Promise<WakeLockSentinel> };

/**
 * Keeps the screen on while `enabled`, so a phone doesn't go to sleep during the show. The browser
 * drops the lock when the page is hidden, so it is requested again when the page comes back.
 * Does nothing where the Wake Lock API is missing (or the page isn't served securely).
 */
export function useWakeLock(enabled: boolean) {
  useEffect(() => {
    const wakeLock = (navigator as unknown as { wakeLock?: WakeLockApi }).wakeLock;
    if (!enabled || !wakeLock) return;
    let sentinel: WakeLockSentinel | null = null;
    let stopped = false;

    const acquire = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const lock = await wakeLock.request('screen');
        if (stopped) lock.release().catch(() => undefined);
        else sentinel = lock;
      } catch {
        // Not allowed (e.g. battery saver): the screen may still go off
      }
    };

    acquire();
    document.addEventListener('visibilitychange', acquire);
    return () => {
      stopped = true;
      document.removeEventListener('visibilitychange', acquire);
      sentinel?.release().catch(() => undefined);
    };
  }, [enabled]);
}
