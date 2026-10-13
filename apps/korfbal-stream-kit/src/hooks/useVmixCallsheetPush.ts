import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {createUrl, extractError} from '../lib/api';

export type TimingState = 'normal' | 'warning' | 'overtime';
export type StateColors = { background: string; text: string };
export type CallsheetColors = Record<TimingState, StateColors>;

type ColorFields = { backgroundField: string; textColorFields: string[]; colors: CallsheetColors };

export type VmixCallsheetPushConfig = {
  enabled: boolean;
  input: string;
  positions: string[];
  warningSeconds: number;
  current: ColorFields & { titleField: string; timerField: string; startTimeField: string };
  next: ColorFields & { titleField: string; durationField: string; startsInField: string; startTimeField: string };
};

export type CallsheetTiming = {
  productionId: number | null;
  positions: string;
  currentTitle: string;
  currentDuration: string;
  currentRemaining: string;
  currentTimerVmix: string;
  currentStartTime: string;
  currentState: TimingState;
  nextTitle: string;
  nextDuration: string;
  nextStartsIn: string;
  nextStartTime: string;
  nextState: TimingState;
};

export type PushResult = { sent: number; skipped: number; errors: string[] };

const CONFIG_KEY = ['vmix-callsheet-push'];

export function useVmixCallsheetPushConfig() {
  return useQuery({
    queryKey: CONFIG_KEY,
    queryFn: async (): Promise<VmixCallsheetPushConfig> => {
      const res = await fetch(createUrl('/api/settings/vmix-callsheet-push'));
      if (!res.ok) throw new Error(await extractError(res));
      return res.json();
    },
  });
}

export function useSaveVmixCallsheetPushConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (config: VmixCallsheetPushConfig): Promise<VmixCallsheetPushConfig> => {
      const res = await fetch(createUrl('/api/settings/vmix-callsheet-push'), {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(config),
      });
      if (!res.ok) throw new Error(await extractError(res));
      return res.json();
    },
    onSuccess: (data) => {
      qc.setQueryData(CONFIG_KEY, data);
      qc.invalidateQueries({queryKey: ['vmix-callsheet-timing']});
    },
  });
}

/** What vMix gets right now, refreshed every second. */
export function useCallsheetTiming() {
  return useQuery({
    queryKey: ['vmix-callsheet-timing'],
    queryFn: async (): Promise<CallsheetTiming> => {
      const res = await fetch(createUrl('/api/vmix/callsheet/timing'));
      if (!res.ok) throw new Error(await extractError(res));
      const [timing] = await res.json();
      return timing;
    },
    refetchInterval: 1000,
  });
}

export function usePushCallsheetToVmix() {
  return useMutation({
    mutationFn: async (): Promise<PushResult> => {
      const res = await fetch(createUrl('/api/vmix/callsheet/push'), {method: 'POST'});
      const body = await res.json().catch(() => null);
      if (!body) throw new Error(`Push mislukt: ${res.status}`);
      return body;
    },
  });
}
