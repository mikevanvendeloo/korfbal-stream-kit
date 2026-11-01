import {Link} from 'react-router-dom';
import {useActiveProduction} from '../hooks/useProductions';
import {InterviewCard, InterviewMoment, InterviewRole, InterviewSide, useInterviewCards} from '../hooks/useInterviews';
import {InterviewAvatar, shownShirtNo} from '../components/InterviewAvatar';
import {formatTime} from '../lib/time';

/** "Speler thuis", "Coach uit"; without a side just "Speler" or "Coach". */
export function interviewRoleLabel(role: InterviewRole, side: InterviewSide): string {
  const who = role === 'COACH' ? 'Coach' : 'Speler';
  return side === 'HOME' ? `${who} thuis` : side === 'AWAY' ? `${who} uit` : who;
}

/** The numbers of the moments a chosen person is interviewed in (draaiboek order) */
const momentsOf = (card: InterviewCard, moments: InterviewMoment[]) =>
  moments.filter((m) => m.people.some((p) => p.side === card.side && p.role === card.role)).map((m) => m.position);

function Card({card, order}: { card: InterviewCard; order: number[] }) {
  const shirtNo = shownShirtNo(card, card.role);
  return (
    <li aria-label={card.name}
        className="flex items-center gap-4 p-4 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm min-w-0">
      <InterviewAvatar person={card} role={card.role} size="card"/>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 truncate">
          {interviewRoleLabel(card.role, card.side)}
          {order.length > 0 && <span className="ml-2 normal-case tracking-normal text-blue-700 dark:text-blue-400">Interview {order.join(' en ')}</span>}
        </div>
        <h2 className="text-2xl font-bold leading-tight break-words">{card.name}</h2>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1 min-w-0">
          {shirtNo != null && <span className="text-xl font-black tabular-nums text-blue-700 dark:text-blue-400">#{shirtNo}</span>}
          {card.teamName && <span className="text-base text-gray-700 dark:text-gray-300 min-w-0 truncate">{card.teamName}</span>}
        </div>
        {card.title && <div className="mt-1 text-sm text-gray-500 dark:text-gray-400 truncate">Titel: {card.title}</div>}
      </div>
    </li>
  );
}

/** The interviews in the order of the draaiboek, with their hoofdstuk and planned time */
function Order({moments}: { moments: InterviewMoment[] }) {
  return (
    <section aria-labelledby="interview-order" className="mb-6">
      <h2 id="interview-order" className="text-lg font-semibold mb-2">Volgorde</h2>
      <ol aria-label="Volgorde van de interviews" className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800">
        {moments.map((m) => (
          <li key={m.itemId} className="flex items-center gap-3 px-4 py-2.5 min-w-0">
            <span className="w-7 h-7 shrink-0 rounded-full bg-blue-600 text-white text-sm font-bold flex items-center justify-center tabular-nums">{m.position}</span>
            <div className="min-w-0">
              <div className="text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-400 truncate">
                {[m.chapter, m.plannedStartTime ? formatTime(m.plannedStartTime) : null].filter(Boolean).join(' · ') || 'Zonder hoofdstuk'}
              </div>
              <div className="font-semibold leading-snug break-words">{m.title}</div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

/**
 * LIVE: the people chosen for the interviews of the active production, one large card each, so the
 * presenter and the camera can see who to fetch, and above them the order of the interviews in the draaiboek.
 * Read-only; the choice is made on Actieve productie.
 */
export default function InterviewsPage() {
  const {data: active, isLoading, error} = useActiveProduction();
  const cards = useInterviewCards(active?.id);
  const moments = cards.data?.moments ?? [];
  const items = cards.data?.items;

  if (isLoading) return <div className="container py-6 text-gray-800 dark:text-gray-100">Laden…</div>;
  if (error) return <div className="container py-6 text-red-700">{String((error as Error)?.message || error)}</div>;
  if (!active) return <div className="container py-6 text-gray-800 dark:text-gray-100">Geen actieve productie.</div>;

  return (
    <div className="container py-4 sm:py-6 text-gray-800 dark:text-gray-100">
      <h1 className="text-xl font-semibold mb-4">Interviews</h1>
      {cards.isLoading && <p>Laden…</p>}
      {cards.error && <p className="text-red-700">{String((cards.error as Error).message || cards.error)}</p>}
      {moments.length > 0 && <Order moments={moments}/>}
      {items && items.length === 0 && (
        <p className="text-gray-600 dark:text-gray-300">
          Er zijn nog geen interviews gekozen. Kies ze op <Link to="/" className="underline">Productie</Link>.
        </p>
      )}
      {items && items.length > 0 && (
        <ul aria-label="Gekozen interviews" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
          {items.map((card) => <Card key={card.id} card={card} order={momentsOf(card, moments)}/>)}
        </ul>
      )}
    </div>
  );
}
