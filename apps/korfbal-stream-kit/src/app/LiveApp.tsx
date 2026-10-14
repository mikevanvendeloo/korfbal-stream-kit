import {Link, NavLink, Route, Routes} from 'react-router-dom';
import {MdInfo, MdPlayCircleFilled, MdRecordVoiceOver, MdSettings, MdTableChart, MdVideocam, MdViewList} from 'react-icons/md';
import ActiveProductionPage from '../pages/ActiveProductionPage';
import ScoreboardPage from '../pages/ScoreboardPage';
import LiveVmixPage from '../pages/LiveVmixPage';
import AboutPage from '../pages/AboutPage';
import ManualView from '../handleiding/ManualView';
import HelpButton from '../handleiding/HelpButton';
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
  {to: '/vmix', label: 'vMix', icon: MdVideocam, end: false},
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
        <div className="flex items-center gap-4">
          <Link to="/admin" className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 hover:underline">
            <MdSettings/>
            <span>Beheer</span>
          </Link>
          <HelpButton/>
          <Link to="/over" className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200" title="Over deze app" aria-label="Over deze app">
            <MdInfo className="w-5 h-5"/>
          </Link>
          <ThemeToggle/>
        </div>
      </div>
    </header>
  );
}

/**
 * LIVE: what the crew uses during a production, served from the root. Everything is read-only
 * except the interview selection and operating vMix; preparing and configuring productions happens in /admin (linked in the nav).
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
            <Route path="vmix" element={<LiveVmixPage/>}/>
            <Route path="over" element={<AboutPage/>}/>
            <Route path="handleiding" element={<ManualView part="live"/>}/>
            <Route path="handleiding/:chapter" element={<ManualView part="live"/>}/>
            <Route path="*" element={<NotFound/>}/>
          </Routes>
        </ErrorBoundary>
      </main>
    </>
  );
}
