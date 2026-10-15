import {useProduction} from '../hooks/useProductions';
import {Club, useClubs} from '../hooks/useClubs';
import ClubLogo from './ClubLogo';

interface MatchHeaderProps {
  productionId: number;
  showLogos?: boolean;
  size?: 'small' | 'medium';
  className?: string;
}

export const MatchHeader = ({
  productionId,
  showLogos = true,
  size = 'medium',
  className = ''
}: MatchHeaderProps) => {
  const { data: production, isLoading } = useProduction(productionId);

  if (isLoading) {
    return <div className={`animate-pulse bg-gray-200 dark:bg-gray-700/50 rounded h-12 w-48 ${className}`} />;
  }

  const ms = production?.matchSchedule;
  if (!ms) return null;

  const homeTeamName = ms.homeTeamName;
  const awayTeamName = ms.awayTeamName;

  const startTime = ms.date ? new Date(ms.date).toLocaleTimeString('nl-NL', {
    hour: '2-digit',
    minute: '2-digit'
  }) : '';

  const logoSize = size === 'small' ? 'small' : 'medium';
  // Smaller on phones, and long team names are cut off instead of making the page wider than the screen
  const fontSize = size === 'small' ? 'text-sm sm:text-lg' : 'text-base sm:text-xl';

  return (
    <div className={`flex items-center gap-2 sm:gap-4 min-w-0 max-w-full ${className}`}>
      <div className="flex items-center gap-2 min-w-0">
        {showLogos && (
          <TeamLogo teamName={homeTeamName} size={logoSize} />
        )}
        <span className={`${fontSize} font-bold whitespace-nowrap truncate`} title={homeTeamName}>
          {homeTeamName}
        </span>
      </div>

      <div className="shrink-0 flex flex-col items-center px-2 sm:px-3 py-1 bg-gray-100 dark:bg-black/40 rounded border border-gray-300 dark:border-gray-700">
        <span className="text-xs uppercase text-gray-500 dark:text-gray-400 font-bold">Aanvang</span>
        <span className="font-mono font-bold text-amber-600 dark:text-orange-500">{startTime}</span>
      </div>

      <div className="flex items-center gap-2 min-w-0">
        <span className={`${fontSize} font-bold whitespace-nowrap truncate`} title={awayTeamName}>
          {awayTeamName}
        </span>
        {showLogos && (
          <TeamLogo teamName={awayTeamName} size={logoSize} />
        )}
      </div>
    </div>
  );
};

function TeamLogo({ teamName, size }: { teamName?: string; size: 'small' | 'medium' }) {
  const { data: clubs } = useClubs();

  function normalizeTeamForLookup(name?: string): string | undefined {
    if (!name) return undefined;
    const trimmed = String(name).trim();
    const noNumber = trimmed.replace(/\s+\d+$/g, '');
    const base = noNumber.split('/')[0]?.trim() || noNumber;
    return base.toLowerCase();
  }

  function matchClub(teamName?: string, list?: Club[]): Club | undefined {
    if (!teamName || !list?.length) return undefined;
    const key = normalizeTeamForLookup(teamName);
    if (!key) return undefined;
    const exactShort = list.find((c) => c.shortName?.toLowerCase() === key);
    if (exactShort) return exactShort;
    const exactName = list.find((c) => c.name?.toLowerCase() === key);
    if (exactName) return exactName;
    const starts = list.find((c) => key && (c.shortName?.toLowerCase().startsWith(key) || c.name?.toLowerCase().startsWith(key)));
    if (starts) return starts;
    return list.find((c) => key && (c.shortName?.toLowerCase().includes(key) || c.name?.toLowerCase().includes(key)));
  }

  const club = matchClub(teamName, clubs);

  if (!club?.logoUrl) {
    return <div className={`${size === 'small' ? 'w-8 h-8' : 'w-12 h-12'} bg-gray-100 dark:bg-gray-800 rounded flex items-center justify-center text-[10px] text-gray-400 dark:text-gray-500`}>?</div>;
  }

  return (
    <ClubLogo
      logoUrl={club.logoUrl}
      alt={club.shortName || club.name || ''}
      size={size}
    />
  );
}
