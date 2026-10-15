import {useCallback, useRef, useState} from 'react';
import {createUrl} from '../lib/api';

/** One press sets the current item's remaining time to this many seconds (Show Caller, wide and phone). */
export const REMAINING_PRESETS = [15, 30, 60];

const MESSAGES: Record<string, string> = {
  'End of show reached.': 'Dit is het laatste item.',
  'Start of show reached.': 'Dit is het eerste item.',
  'No time anchor found in callsheet': 'Het draaiboek heeft geen tijdanker.',
  'No active item.': 'Er loopt nu geen item.',
};

/**
 * The Show Caller's actions on the one live show. A failed action keeps its message in `error`, so the
 * screen can show it instead of failing silently.
 */
export function useShowControls(productionId: string | undefined) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);

  const call = useCallback(async (endpoint: string, body?: unknown) => {
    if (busy.current) return;
    busy.current = true;
    setIsProcessing(true);
    setError(null);
    try {
      const response = await fetch(createUrl(`/api/show/${endpoint}`), {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const message = body?.error || body?.message || `Mislukt (${response.status})`;
        setError(MESSAGES[message] ?? message);
      }
    } catch {
      setError('Geen verbinding met de server.');
    } finally {
      busy.current = false;
      setIsProcessing(false);
    }
  }, []);

  return {
    isProcessing,
    error,
    clearError: () => setError(null),
    start: () => call(`start/${productionId}`),
    next: () => call('next'),
    previous: () => call('previous'),
    recalculate: () => call(`recalculate/${productionId}`),
    reset: () => call(`reset/${productionId}`),
    stop: () => call(`stop/${productionId}`),
    /** Sets the remaining time of the current item to this many seconds from now. */
    setRemaining: (seconds: number) => call('remaining', {seconds}),
  };
}

export type ShowControls = ReturnType<typeof useShowControls>;
