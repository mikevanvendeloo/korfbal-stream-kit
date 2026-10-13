import {NavLink, Route, Routes} from 'react-router-dom';
import {MdPlayCircleFilled, MdRecordVoiceOver, MdTableChart, MdViewList} from 'react-icons/md';
import ActiveProductionPage from '../pages/ActiveProductionPage';
import ScoreboardPage from '../pages/ScoreboardPage';
import LiveCallsheetEntry from '../pages/LiveCallsheetEntry';
import {PositionSelector} from '../components/PositionSelector';
import {CallSheetView} from '../components/CallSheetView';
import {ShowCallerView} from '../components/ShowCallerView';
import AppIcon from '../components/AppIcon';
import ThemeToggle from '../components/ThemeToggle';
import NotFound from '../components/NotFound';
import {InterviewNamesProvider} from '../components/InterviewText';
import {ErrorBoundary} from '../components/ErrorBoundary';

const links = [
  {to: '/', label: 'Actieve productie', icon: MdPlayCircleFilled, end: true},
  {to: '/scoreboard', label: 'Scoreboard', icon: MdTableChart, end: false},
  {to: '/callsheet', label: 'Callsheet', icon: MdViewList, end: false},
  {to: '/show-caller', label: 'Show Caller', icon: MdRecordVoiceOver, end: false},
];

function LiveNav() {
  return (
    <header className="border-b border-gray-200 dark:border-gray-800">
      <div className="container flex items-center justify-between py-3">
        <nav className="flex items-center gap-6 text-sm">
          <span className="font-semibold text-gray-900 dark:text-gray-100 inline-flex items-center">
            <AppIcon className={"w-16 h-16 mr-2"}/>Korfbal Streamz Kit
            <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-red-600 text-white tracking-wide">LIVE</span>
          </span>
          {links.map(({to, label, icon: Icon, end}) => (
            <NavLink key={to} to={to} end={end}
                     className={({isActive}) =>
                       `inline-flex items-center gap-2 hover:underline ${isActive ? 'font-semibold text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'}`}>
              <Icon/>
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <ThemeToggle/>
      </div>
    </header>
  );
}

/**
 * LIVE: what the crew uses during a production, served from the root. Everything is read-only
 * except the interview selection; preparing and configuring productions happens in /admin.
 */
export default function LiveApp() {
  return (
    <>
      <LiveNav/>
      <main>
        <ErrorBoundary>
          <Routes>
            <Route index element={<ActiveProductionPage/>}/>
            <Route path="scoreboard" element={<ScoreboardPage/>}/>
            <Route path="callsheet" element={<LiveCallsheetEntry viewType="standard"/>}/>
            <Route path="callsheet/:productionId" element={<PositionSelector viewType="callsheet"/>}/>
            <Route path="callsheet/:productionId/:positionSlug" element={<InterviewNamesProvider><CallSheetView/></InterviewNamesProvider>}/>
            <Route path="show-caller" element={<LiveCallsheetEntry viewType="show-caller"/>}/>
            <Route path="show-caller/:productionId" element={<PositionSelector viewType="show-caller"/>}/>
            <Route path="show-caller/:productionId/:positionSlug" element={<InterviewNamesProvider><ShowCallerView/></InterviewNamesProvider>}/>
            <Route path="*" element={<NotFound/>}/>
          </Routes>
        </ErrorBoundary>
      </main>
    </>
  );
}
