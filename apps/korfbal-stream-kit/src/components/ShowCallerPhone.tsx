import React from 'react';
import {useNavigate} from 'react-router-dom';
import {ChevronLeft, ChevronRight, FastForward, MoreVertical, Play, Square} from 'lucide-react';
import type {ProductionEvent} from '../hooks/useLiveState';
import {REMAINING_PRESETS, type ShowControls} from '../hooks/useShowControls';
import {InterviewText} from './InterviewText';

type TimedEvent = ProductionEvent & { calculatedTime: Date | null };
type Remaining = { minutes: string; seconds: string; isNegative: boolean; rawSeconds: number } | null;

export type ShowCallerPhoneProps = {
  productionId: string;
  positionSlug: string;
  /** Name of the chosen position, or null for all items */
  positionName: string | null;
  /** All items with their expected start, in show order (Next/Previous follow this order) */
  items: TimedEvent[];
  activeEventId: string | null;
  remaining: Remaining;
  autoAdvanceEventId: string | null;
  isConnected: boolean;
  systemTime: string;
  isRelevant: (event: ProductionEvent) => boolean;
  controls: ShowControls;
};

const hhmm = (d: Date | null) => (d ? d.toLocaleTimeString('nl-NL', {hour: '2-digit', minute: '2-digit', hour12: false}) : '--:--');
const duration = (sec: number | null) => (sec == null ? '' : `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`);

function remainingStyle(remaining: Remaining) {
  if (!remaining) return 'bg-gray-700 text-white';
  if (remaining.isNegative) return 'bg-red-600 text-white animate-pulse';
  if (remaining.rawSeconds <= 10) return 'bg-orange-500 text-white';
  return 'bg-green-600 text-white';
}

function Tags({event, autoTimer}: { event: ProductionEvent; autoTimer: boolean }) {
  return (
    <div className="flex flex-wrap gap-1.5 text-[11px] font-semibold uppercase tracking-wide">
      {event.isInVenue && <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">Zaal</span>}
      {event.isInLivestream && <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">Stream</span>}
      {event.autoAdvance && (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 ${autoTimer ? 'animate-pulse' : ''}`}>
          <FastForward className="w-3 h-3"/>{autoTimer ? 'Auto timer' : 'Auto'}
        </span>
      )}
    </div>
  );
}

/**
 * The Show Caller on a phone: what is on now and what comes next, readable at arm's length, with the
 * buttons at the bottom under your thumb. Same data and actions as the wide Show Caller.
 */
export function ShowCallerPhone(props: ShowCallerPhoneProps) {
  const {productionId, positionSlug, positionName, items, activeEventId, remaining, autoAdvanceEventId, isConnected, systemTime, isRelevant, controls} = props;
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [onlyMine, setOnlyMine] = React.useState(true);

  const activeIndex = items.findIndex((e) => e.id === activeEventId);
  const active = activeIndex >= 0 ? items[activeIndex] : null;
  // Before the start the first item is what "Start show" begins with
  const next = active ? items[activeIndex + 1] ?? null : items[0] ?? null;
  const later = items
    .slice((active ? activeIndex + 1 : 0) + 1)
    .filter((e) => e.status !== 'COMPLETED')
    .filter((e) => !positionName || !onlyMine || isRelevant(e));

  const confirmThen = (question: string, action: () => void) => () => {
    setMenuOpen(false);
    if (window.confirm(question)) action();
  };

  return (
    <div className="min-h-[calc(100dvh-57px)] bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white pb-28">
      {/* Position, time and connection; the menu holds everything you rarely need */}
      <div className="sticky top-0 z-20 flex items-center gap-2 px-3 py-2 bg-white/95 dark:bg-gray-900/95 backdrop-blur border-b border-gray-200 dark:border-gray-800">
        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${isConnected ? 'bg-green-500' : 'bg-red-500 animate-pulse'}`}
              title={isConnected ? 'Verbonden' : 'Verbinding verbroken'} aria-label={isConnected ? 'Verbonden' : 'Verbinding verbroken'}/>
        <span className="text-sm font-semibold truncate">{positionName ?? 'Alle items'}</span>
        <span className="ml-auto font-mono text-sm tabular-nums text-gray-600 dark:text-gray-300">{systemTime}</span>
        <button type="button" onClick={() => setMenuOpen((o) => !o)} aria-label="Show Caller menu" aria-expanded={menuOpen}
                className="p-2 -mr-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800">
          <MoreVertical className="w-5 h-5"/>
        </button>
      </div>

      {menuOpen && (
        <div role="menu" className="mx-3 mt-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-lg divide-y divide-gray-100 dark:divide-gray-800 text-sm">
          {positionName && (
            <button role="menuitemcheckbox" aria-checked={onlyMine} className="w-full text-left px-4 py-3" onClick={() => { setOnlyMine(!onlyMine); setMenuOpen(false); }}>
              Daarna: {onlyMine ? 'alleen mijn positie' : 'alle items'} <span className="text-gray-500">(wissel)</span>
            </button>
          )}
          <button role="menuitem" className="w-full text-left px-4 py-3" onClick={() => navigate(`/show-caller/${productionId}`)}>Wissel positie</button>
          <button role="menuitem" className="w-full text-left px-4 py-3"
                  onClick={() => navigate(positionSlug !== 'all' ? `/callsheet/${productionId}/${positionSlug}` : `/callsheet/${productionId}`)}>
            Callsheet view
          </button>
          <button role="menuitem" className="w-full text-left px-4 py-3 text-amber-700 dark:text-amber-400" onClick={() => { setMenuOpen(false); controls.recalculate(); }}>
            Tijden herberekenen
          </button>
          {active && (
            <button role="menuitem" className="w-full text-left px-4 py-3 text-orange-700 dark:text-orange-400"
                    onClick={confirmThen('De show opnieuw beginnen bij het eerste item?', controls.start)}>
              Herstart show
            </button>
          )}
          <button role="menuitem" className="w-full text-left px-4 py-3 text-red-700 dark:text-red-400"
                  onClick={confirmThen('Weet je zeker dat je het draaiboek wilt resetten naar de originele tijden?', controls.reset)}>
            Draaiboek resetten
          </button>
        </div>
      )}

      {controls.error && (
        <button type="button" role="alert" onClick={controls.clearError}
                className="mx-3 mt-2 w-[calc(100%-1.5rem)] text-left rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 px-3 py-2 text-sm">
          {controls.error}
        </button>
      )}

      {/* Now */}
      <section aria-label="Nu" className="mx-3 mt-3 rounded-2xl bg-white dark:bg-gray-900 border-2 border-gray-900 dark:border-white shadow-sm overflow-hidden">
        {active ? (
          <>
            <div className={`flex items-baseline justify-between px-4 py-3 ${remainingStyle(remaining)}`}>
              <span className="text-xs font-bold uppercase tracking-widest opacity-90">Nu</span>
              <span className="font-mono font-bold tabular-nums text-5xl leading-none" aria-label="Resterend">
                {remaining ? `${remaining.isNegative ? '-' : ''}${remaining.minutes}:${remaining.seconds}` : '--:--'}
              </span>
            </div>
            <div className="px-4 py-3 space-y-2">
              <h2 className={`text-2xl font-bold leading-tight ${isRelevant(active) ? '' : 'text-gray-500 dark:text-gray-400'}`}>
                <InterviewText text={active.title}/>
              </h2>
              {active.note && <p className="text-base text-gray-600 dark:text-gray-300 italic"><InterviewText text={active.note}/></p>}
              <div className="flex items-center justify-between gap-2 text-sm text-gray-500 dark:text-gray-400">
                <span>Duur {duration(active.durationSec)}</span>
                {positionName && !isRelevant(active) && <span>niet voor jouw positie</span>}
              </div>
              <Tags event={active} autoTimer={autoAdvanceEventId === active.id}/>
              {/* Set the remaining time of this item in one press */}
              <div role="group" aria-label="Resterend instellen" className="flex items-center gap-2 pt-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Nog</span>
                {REMAINING_PRESETS.map((sec) => (
                  <button key={sec} type="button" onClick={() => controls.setRemaining(sec)} disabled={controls.isProcessing}
                          aria-label={`Resterend ${sec} seconden`}
                          className="flex-1 h-11 rounded-xl bg-gray-100 dark:bg-gray-800 font-mono font-bold tabular-nums active:scale-95 disabled:opacity-50">
                    {sec}s
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="px-4 py-6 text-center">
            <div className="text-xs font-bold uppercase tracking-widest text-gray-500">Nu</div>
            <p className="mt-1 text-lg font-semibold">De show is nog niet gestart</p>
          </div>
        )}
      </section>

      {/* Next: what the Next button (or Start show) makes active */}
      <section aria-label="Volgende" className="mx-3 mt-3 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 px-4 py-3">
        <div className="flex items-baseline justify-between text-xs font-bold uppercase tracking-widest text-gray-500">
          <span>{active ? 'Volgende' : 'Eerste item'}</span>
          {next && <span className="font-mono normal-case tracking-normal text-sm">om {hhmm(next.calculatedTime)} · {duration(next.durationSec)}</span>}
        </div>
        {next ? (
          <>
            <h3 className={`mt-1 text-xl font-semibold leading-snug ${isRelevant(next) ? '' : 'text-gray-500 dark:text-gray-400'}`}>
              <InterviewText text={next.title}/>
            </h3>
            {positionName && !isRelevant(next) && <p className="text-sm text-gray-500">niet voor jouw positie</p>}
            <div className="mt-2"><Tags event={next} autoTimer={false}/></div>
          </>
        ) : (
          <p className="mt-1 text-gray-500">Geen items meer</p>
        )}
      </section>

      {/* Later */}
      {later.length > 0 && (
        <section aria-label="Daarna" className="mx-3 mt-4">
          <h3 className="px-1 mb-1 text-xs font-bold uppercase tracking-widest text-gray-500">
            Daarna{positionName && onlyMine ? ' voor jou' : ''}
          </h3>
          <ol className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800">
            {later.map((e) => (
              <li key={e.id} className={`flex items-baseline gap-3 px-4 py-2.5 ${isRelevant(e) ? '' : 'opacity-50'}`}>
                <span className="font-mono text-sm tabular-nums text-gray-500 shrink-0">{hhmm(e.calculatedTime)}</span>
                <span className="flex-1 min-w-0 text-base leading-snug"><InterviewText text={e.title}/></span>
                <span className="font-mono text-xs tabular-nums text-gray-400 shrink-0">{duration(e.durationSec)}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* Controls under the thumb; Restart lives in the menu, behind a confirmation */}
      <nav aria-label="Show bediening"
           className="fixed bottom-0 inset-x-0 z-30 grid grid-cols-4 gap-2 px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-white/95 dark:bg-gray-900/95 backdrop-blur border-t border-gray-200 dark:border-gray-800">
        {active ? (
          <>
            <button type="button" onClick={confirmThen('Weet je zeker dat je de show wilt stoppen?', controls.stop)} disabled={controls.isProcessing}
                    aria-label="Einde show"
                    className="h-16 rounded-2xl flex flex-col items-center justify-center bg-red-600 text-white text-xs font-bold active:scale-95 disabled:opacity-50">
              <Square className="w-5 h-5 fill-current"/>Stop
            </button>
            <button type="button" onClick={controls.previous} disabled={controls.isProcessing} aria-label="Vorig item"
                    className="h-16 rounded-2xl flex items-center justify-center gap-1 bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-white font-semibold active:scale-95 disabled:opacity-50">
              <ChevronLeft className="w-6 h-6"/>Vorig
            </button>
            <button type="button" onClick={controls.next} disabled={controls.isProcessing || !next} aria-label="Volgend item"
                    className="col-span-2 h-16 rounded-2xl flex items-center justify-center gap-1 bg-blue-600 text-white text-xl font-bold active:scale-95 disabled:opacity-50">
              Volgend<ChevronRight className="w-7 h-7"/>
            </button>
          </>
        ) : (
          <button type="button" onClick={controls.start} disabled={controls.isProcessing || !items.length} aria-label="Start show"
                  className="col-span-4 h-16 rounded-2xl flex items-center justify-center gap-2 bg-green-600 text-white text-xl font-bold active:scale-95 disabled:opacity-50">
            <Play className="w-6 h-6"/>Start show
          </button>
        )}
      </nav>
    </div>
  );
}
