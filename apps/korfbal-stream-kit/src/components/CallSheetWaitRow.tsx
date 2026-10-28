import {MdPauseCircleOutline} from 'react-icons/md';
import {useFontSize} from '../hooks/useFontSize';
import {CallsheetWait, GET_READY_SECONDS} from '../lib/callsheetWait';
import {formatTime} from '../lib/time';
import {InterviewText} from './InterviewText';

const SIZES = {
  s: {pad: 'p-2', head: 'text-base', sub: 'text-xs'},
  m: {pad: 'p-3', head: 'text-lg', sub: 'text-sm'},
  l: {pad: 'p-5', head: 'text-3xl', sub: 'text-xl'},
  xl: {pad: 'p-7', head: 'text-5xl', sub: 'text-2xl'},
} as const;

const minutesSeconds = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

/**
 * The gap in a position's callsheet: the show runs an item that isn't for this position. Shows how long
 * until the position's next item, orange from GET_READY_SECONDS before it ("Maak je klaar").
 */
export function CallSheetWaitRow({wait, chapterName = null}: { wait: CallsheetWait; /** The hoofdstuk of the next item */ chapterName?: string | null }) {
  const {fontSize} = useFontSize();
  const size = SIZES[fontSize as keyof typeof SIZES] ?? SIZES.m;
  const secondsLeft = wait.kind === 'waiting' ? wait.secondsLeft : null;
  const getReady = secondsLeft !== null && secondsLeft <= GET_READY_SECONDS;
  const tone = getReady
    ? 'border-orange-500 bg-orange-50 text-orange-900 dark:bg-orange-900/30 dark:text-orange-100'
    : 'border-gray-400 bg-white/60 text-gray-700 dark:border-white/30 dark:bg-white/5 dark:text-gray-200';

  return (
    <div data-callsheet-wait role="status"
         className={`${size.pad} rounded-lg border-2 border-dashed ${tone} min-w-0 transition-colors`}>
      <div className="flex items-center justify-between gap-3 min-w-0">
        <span className={`flex items-center gap-2 font-bold ${size.head} min-w-0`}>
          <MdPauseCircleOutline className="shrink-0" aria-hidden/>
          <span className="truncate">
            {wait.kind === 'done' ? 'Klaar — geen items meer voor jou' : getReady ? 'Maak je klaar' : 'Even niets voor jou'}
          </span>
        </span>
        {secondsLeft !== null && secondsLeft > 0 && (
          <span className={`font-mono font-bold whitespace-nowrap ${size.head}`}>nog {minutesSeconds(secondsLeft)}</span>
        )}
      </div>
      {wait.kind === 'waiting' && (
        <p className={`mt-1 ${size.sub} truncate`}>
          Volgende: <InterviewText text={wait.next.title}/>
          {wait.next.calculatedTime && ` (${formatTime(wait.next.calculatedTime)})`}
          {chapterName && ` · ${chapterName}`}
        </p>
      )}
    </div>
  );
}
