import { useMemo } from 'react';
import { useScoreboard, useShotclock, useMatchClock } from '../hooks/useMatch';
import { labels } from '../config/scoreboardLabels';

function fmt(n: number | undefined) {
  if (typeof n !== 'number' || isNaN(n)) return '';
  return String(n);
}

function fmtClockParts(totalSeconds?: number): { m: string; ss: string } | null {
  if (typeof totalSeconds !== 'number' || isNaN(totalSeconds)) return null;
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  const ss = String(s).padStart(2, '0');
  return { m: String(m), ss };
}

function useMatchData() {
  const { data: sb, isLoading: sbLoading, isError: sbErr } = useScoreboard(1000);
  const { data: sc, isLoading: scLoading, isError: scErr } = useShotclock(500);
  const { data: mc, isLoading: mcLoading, isError: mcErr } = useMatchClock(1000);

  const { home, guest } = useMemo(() => {
    const item = sb?.[0];
    return { home: item?.home ?? 0, guest: item?.guest ?? 0 };
  }, [sb]);

  const shot = useMemo(() => sc?.[0], [sc]);
  const matchClock = useMemo(() => {
    const item = mc?.[0];
    if (!item) return undefined;
    const m = parseInt(item.minute, 10);
    const s = parseInt(item.second, 10);
    if (!Number.isFinite(m) || !Number.isFinite(s)) return undefined;
    return { total: m * 60 + s, period: item.period } as const;
  }, [mc]);

  return { home, guest, shot, matchClock, loading: sbLoading || scLoading || mcLoading, error: sbErr || scErr || mcErr };
}

export default function ScoreboardPage() {
  const { home, guest, shot, matchClock, loading, error } = useMatchData();

  const shotColorClass = shot?.color === 'red' ? 'text-red-500' : shot?.color === 'orange' ? 'text-orange-400' : 'text-green-500';

  const parts = fmtClockParts(matchClock?.total);
  const periodLabel = matchClock?.period === 1 ? labels.firstHalf : matchClock?.period === 2 ? labels.secondHalf : '';

  return (
    <div className="min-h-[calc(100vh-57px)] bg-black text-white flex items-center justify-center p-4">
      <div className="w-full max-w-5xl grid grid-cols-3 gap-4 items-stretch">
        {/* Match clock */}
        <div className="col-span-3 flex flex-col items-center">
          <div className="relative">
            {/* Time header centered above colon */}
            <div className="absolute left-1/2 -translate-x-1/2 -top-6 text-gray-300 text-center text-base sm:text-lg">{labels.time}</div>
            <div aria-label="match-clock" className="font-mono tabular-nums text-center text-[14vw] sm:text-[6rem] leading-none">
              {parts ? (
                <>
                  <span>{parts.m}</span>
                  <span className="inline-block px-2">:</span>
                  <span>{parts.ss}</span>
                </>
              ) : (
                '--:--'
              )}
            </div>
            {/* Period tagline */}
            {periodLabel ? (
              <div className="text-gray-300 text-center text-sm sm:text-base mt-1">{periodLabel}</div>
            ) : null}
          </div>
        </div>

        {/* Home */}
        <div className="col-span-1 flex flex-col justify-center">
          <div className="text-gray-300 text-center text-lg sm:text-xl mb-2">{labels.home}</div>
          <div aria-label="home-score" className="font-mono tabular-nums text-right text-[20vw] sm:text-[12rem] leading-none">
            {fmt(home)}
          </div>
        </div>

        {/* Shotclock */}
        <div className="col-span-1 flex flex-col items-center justify-center">
          <div className="text-gray-300 text-center text-lg sm:text-xl mb-2">Shotclock</div>
          <div aria-label="shotclock" className={`font-mono tabular-nums ${shotColorClass} text-center text-[18vw] sm:text-[10rem] leading-none`}>
            {typeof shot?.time === 'number' ? shot.time : '--'}
          </div>
        </div>

        {/* Away */}
        <div className="col-span-1 flex flex-col justify-center">
          <div className="text-gray-300 text-center text-lg sm:text-xl mb-2">{labels.away}</div>
          <div aria-label="guest-score" className="font-mono tabular-nums text-right text-[20vw] sm:text-[12rem] leading-none">
            {fmt(guest)}
          </div>
        </div>

        {/* Status */}
        <div className="col-span-3 text-center text-sm text-gray-400 mt-4">
          {loading ? 'Laden…' : error ? 'Fout bij laden.' : ''}
        </div>
      </div>
    </div>
  );
}
