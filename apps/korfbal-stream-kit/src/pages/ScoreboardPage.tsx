import {useMemo} from 'react';
import {useMatchClock, useScoreboard, useShotclock} from '../hooks/useMatch';
import {labels} from '../config/scoreboardLabels';
import {useProductions} from '../hooks/useProductions';
import {Club, useClubs} from '../hooks/useClubs';
import ClubLogo from '../components/ClubLogo';

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
  const { data: sc, isLoading: scLoading } = useShotclock(500);
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

  // Ignore shotclock errors to prevent "Fout bij laden" when shotclock is offline
  return { home, guest, shot, matchClock, loading: sbLoading || scLoading || mcLoading, error: sbErr || mcErr };
}
export default function ScoreboardPage() {
  const { home, guest, shot, matchClock, loading, error } = useMatchData();
  const { data: productions } = useProductions();
  const { data: clubs } = useClubs();

  const active = productions?.items.find((p) => p.isActive);
  const homeTeamName: string | undefined = (active as any)?.matchSchedule?.homeTeamName || undefined;
  const awayTeamName: string | undefined = (active as any)?.matchSchedule?.awayTeamName || undefined;

  function normalizeTeamForLookup(name?: string): string | undefined {
    if (!name) return undefined;
    const trimmed = String(name).trim();
    // Drop trailing team number (e.g., " 2")
    const noNumber = trimmed.replace(/\s+\d+$/g, '');
    // Take first part before '/' to remove sponsor additions like "Fortuna/Ruitenheer"
    const base = noNumber.split('/')[0]?.trim() || noNumber;
    return base.toLowerCase();
  }

  function matchClub(teamName?: string, list?: Club[]): Club | undefined {
    if (!teamName || !list?.length) return undefined;
    const key = normalizeTeamForLookup(teamName);
    if (!key) return undefined;
    // Prefer exact shortName match, else name startsWith/contains, case-insensitive
    const exactShort = list.find((c) => c.shortName?.toLowerCase() === key);
    if (exactShort) return exactShort;
    const exactName = list.find((c) => c.name?.toLowerCase() === key);
    if (exactName) return exactName;
    const starts = list.find((c) => key && (c.shortName?.toLowerCase().startsWith(key) || c.name?.toLowerCase().startsWith(key)));
    if (starts) return starts;
    return list.find((c) => key && (c.shortName?.toLowerCase().includes(key) || c.name?.toLowerCase().includes(key)));
  }

  const homeClub = matchClub(homeTeamName, clubs);
  const awayClub = matchClub(awayTeamName, clubs);

  const shotColorClass = shot?.color === 'red' ? 'text-red-500' : shot?.color === 'orange' ? 'text-orange-400' : 'text-green-500';

  const parts = fmtClockParts(matchClock?.total);
  const periodLabel = matchClock?.period === 1 ? labels.firstHalf : matchClock?.period === 2 ? labels.secondHalf : '';

  return (
    <div className="min-h-[calc(100vh-57px)] bg-black text-white flex items-center justify-center p-4">
      <div className="w-full max-w-5xl grid grid-cols-3 gap-4 items-stretch">
        {/* Active production teams header */}
        {(homeTeamName || awayTeamName) && (
          <div className="col-span-3 flex items-center justify-center gap-6 mb-4">
            {/* Home side */}
            <div className="flex items-center gap-2 min-w-0">
              <ClubLogo
                logoUrl={homeClub?.logoUrl}
                alt={homeClub?.shortName || homeClub?.name || homeTeamName || labels.home}
                size="large"
              />
              <div className="text-lg sm:text-xl font-semibold truncate max-w-[40vw] text-white/90">
                {homeTeamName || labels.home}
              </div>
            </div>
            <div className="text-white/70">-</div>
            {/* Away side */}
            <div className="flex items-center gap-2 min-w-0">
              <div className="text-lg sm:text-xl font-semibold truncate max-w-[40vw] text-white/90 text-right order-1 sm:order-none">
                {awayTeamName || labels.away}
              </div>
              <ClubLogo
                logoUrl={awayClub?.logoUrl}
                alt={awayClub?.shortName || awayClub?.name || awayTeamName || labels.away}
                size="large"
              />
            </div>
          </div>
        )}
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
            {typeof shot?.time === 'number' ? shot.time : ''}
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
