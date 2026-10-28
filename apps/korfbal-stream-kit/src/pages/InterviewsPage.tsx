import {Link} from 'react-router-dom';
import {useActiveProduction} from '../hooks/useProductions';
import {InterviewCard, InterviewRole, InterviewSide, useInterviewCards} from '../hooks/useInterviews';
import {InterviewAvatar, shownShirtNo} from '../components/InterviewAvatar';

/** "Speler thuis", "Coach uit"; without a side just "Speler" or "Coach". */
export function interviewRoleLabel(role: InterviewRole, side: InterviewSide): string {
  const who = role === 'COACH' ? 'Coach' : 'Speler';
  return side === 'HOME' ? `${who} thuis` : side === 'AWAY' ? `${who} uit` : who;
}

function Card({card}: { card: InterviewCard }) {
  const shirtNo = shownShirtNo(card, card.role);
  return (
    <li aria-label={card.name}
        className="flex items-center gap-4 p-4 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm min-w-0">
      <InterviewAvatar person={card} role={card.role} size="card"/>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 truncate">
          {interviewRoleLabel(card.role, card.side)}
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

/**
 * LIVE: the people chosen for the interviews of the active production, one large card each, so the
 * presenter and the camera can see who to fetch. Read-only; the choice is made on Actieve productie.
 */
export default function InterviewsPage() {
  const {data: active, isLoading, error} = useActiveProduction();
  const cards = useInterviewCards(active?.id);

  if (isLoading) return <div className="container py-6 text-gray-800 dark:text-gray-100">Laden…</div>;
  if (error) return <div className="container py-6 text-red-700">{String((error as Error)?.message || error)}</div>;
  if (!active) return <div className="container py-6 text-gray-800 dark:text-gray-100">Geen actieve productie.</div>;

  return (
    <div className="container py-4 sm:py-6 text-gray-800 dark:text-gray-100">
      <h1 className="text-xl font-semibold mb-4">Interviews</h1>
      {cards.isLoading && <p>Laden…</p>}
      {cards.error && <p className="text-red-700">{String((cards.error as Error).message || cards.error)}</p>}
      {cards.data && cards.data.length === 0 && (
        <p className="text-gray-600 dark:text-gray-300">
          Er zijn nog geen interviews gekozen. Kies ze op <Link to="/" className="underline">Productie</Link>.
        </p>
      )}
      {cards.data && cards.data.length > 0 && (
        <ul aria-label="Gekozen interviews" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
          {cards.data.map((card) => <Card key={card.id} card={card}/>)}
        </ul>
      )}
    </div>
  );
}
