import {Link} from 'react-router-dom';
import {adminPaths} from '../lib/adminPaths';
import {useVenueBridgeStatus} from '../hooks/useVenueBridgeStatus';

/** Beheer's top bar: is the organization's venue-bridge connected (live). At 360 px only the dot, with the text for screen readers. */
export default function VenueBridgeIndicator() {
  const {data} = useVenueBridgeStatus();
  if (!data) return null;
  const text = data.connected ? 'Bridge verbonden' : 'Bridge offline';
  return (
    <Link to={adminPaths.venueSettings} title={`${text}: naar Instellingen, Venue`}
          className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-2 py-1 text-xs text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800 whitespace-nowrap">
      <span aria-hidden className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${data.connected ? 'bg-green-500' : 'bg-red-500'}`}/>
      <span className="sr-only sm:not-sr-only">{text}</span>
    </Link>
  );
}
