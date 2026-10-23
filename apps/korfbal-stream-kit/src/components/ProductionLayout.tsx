import {Link, NavLink, Outlet, useLocation, useParams} from 'react-router-dom';
import {MdArrowBack, MdLiveTv} from 'react-icons/md';
import {MatchHeader} from './MatchHeader';
import {adminPaths} from '../lib/adminPaths';

const tabClass = ({isActive}: { isActive: boolean }) =>
  `px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${isActive
    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`;

const subTabClass = ({isActive}: { isActive: boolean }) =>
  `px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${isActive
    ? 'bg-blue-600 text-white'
    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'}`;

/**
 * Frame around every page of one production: the match, and tabs from preparing the draaiboek
 * to the operational crew work (beschikbaarheid, bezetting) and the reports afterwards.
 */
export default function ProductionLayout() {
  const id = Number(useParams<{ id: string }>().id);
  const {pathname} = useLocation();
  if (!Number.isInteger(id) || id <= 0) {
    return (
      <div className="container py-6 text-gray-800 dark:text-gray-100">
        <div>Ongeldige productie id</div>
        <Link to={adminPaths.productions} className="mt-3 inline-block px-3 py-1 border rounded">Terug</Link>
      </div>
    );
  }

  const rapport = adminPaths.production(id, 'rapport');

  return (
    <>
      <div className="container pt-6 text-gray-800 dark:text-gray-100 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-4">
            <Link to={adminPaths.productions} title="Terug naar productieoverzicht"
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
              <MdArrowBack className="w-6 h-6"/>
            </Link>
            <MatchHeader productionId={id} showLogos={true}/>
          </div>
          <Link to={`/callsheet/${id}`}
                className="px-3 py-1 border rounded inline-flex items-center gap-2 bg-green-600 text-white hover:bg-green-700 transition-colors">
            <MdLiveTv className="w-5 h-5"/>
            <span>Open in LIVE</span>
          </Link>
        </div>

        <nav aria-label="Productie" className="flex border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
          {/* The callsheet editor belongs to the draaiboek, so that tab also covers /callsheets. */}
          <NavLink to={adminPaths.production(id)} end className={({isActive}) =>
            tabClass({isActive: isActive || pathname.startsWith(adminPaths.callSheets(id))})}>Draaiboek</NavLink>
          <NavLink to={adminPaths.production(id, 'beschikbaarheid')} className={tabClass}>Beschikbaarheid</NavLink>
          <NavLink to={adminPaths.production(id, 'bezetting')} className={tabClass}>Bezetting</NavLink>
          <NavLink to={adminPaths.production(id, 'vmix-titels')} className={tabClass}>vMix-titels</NavLink>
          <NavLink to={rapport} className={tabClass}>Rapport</NavLink>
        </nav>

        {pathname.startsWith(rapport) && <ReportSubTabs id={id} rapport={rapport}/>}
      </div>
      <Outlet/>
    </>
  );
}

function ReportSubTabs({id, rapport}: { id: number; rapport: string }) {
  return (
    <nav aria-label="Rapport" className="flex gap-2 mt-3">
      <NavLink to={rapport} end className={subTabClass}>Productierapport</NavLink>
      <NavLink to={adminPaths.crewReport(id)} className={subTabClass}>Crewrapport</NavLink>
      <NavLink to={adminPaths.timingReport(id)} className={subTabClass}>Tijdsanalyse</NavLink>
    </nav>
  );
}
