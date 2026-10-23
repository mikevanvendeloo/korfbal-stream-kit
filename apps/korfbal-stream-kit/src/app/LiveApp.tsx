import React from 'react';
import {Link, NavLink, Route, Routes, useLocation} from 'react-router-dom';
import {MdClose, MdInfo, MdMenu, MdMic, MdPlayCircleFilled, MdRecordVoiceOver, MdSettings, MdTableChart, MdVideocam, MdViewList} from 'react-icons/md';
import ActiveProductionPage from '../pages/ActiveProductionPage';
import ScoreboardPage from '../pages/ScoreboardPage';
import LiveVmixPage from '../pages/LiveVmixPage';
import AboutPage from '../pages/AboutPage';
import InterviewsPage from '../pages/InterviewsPage';
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
import {OrganizationSwitcher} from '../components/OrganizationGate';

const links = [
  {to: '/', label: 'Actieve productie', icon: MdPlayCircleFilled, end: true},
  {to: '/scoreboard', label: 'Scoreboard', icon: MdTableChart, end: false},
  {to: '/callsheet', label: 'Callsheet', icon: MdViewList, end: false},
  {to: '/show-caller', label: 'Show Caller', icon: MdRecordVoiceOver, end: false},
  {to: '/interviews', label: 'Interviews', icon: MdMic, end: false},
  {to: '/vmix', label: 'vMix', icon: MdVideocam, end: false},
];

const navLinkClass = ({isActive}: { isActive: boolean }) =>
  `inline-flex items-center gap-2 hover:underline ${isActive ? 'font-semibold text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'}`;

/** The current screen's name, for the compact bar on phones. */
function currentLabel(pathname: string): string {
  if (pathname.startsWith('/handleiding')) return 'Handleiding';
  if (pathname.startsWith('/over')) return 'Over';
  return links.find(({to, end}) => (end ? pathname === to : pathname.startsWith(to)))?.label ?? '';
}

function LiveNav() {
  const {pathname} = useLocation();
  const [menuOpen, setMenuOpen] = React.useState(false);
  React.useEffect(() => setMenuOpen(false), [pathname]);

  return (
    <header className="border-b border-gray-200 dark:border-gray-800">
      {/* Wide screens: everything in one bar */}
      <div className="hidden lg:flex container items-center justify-between py-3">
        <nav className="flex items-center gap-6 text-sm">
          <span className="font-semibold text-gray-900 dark:text-gray-100 inline-flex items-center">
            <AppIcon className={"w-16 h-16 mr-2"}/>Korfbal Streamz Kit
            <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-red-600 text-white tracking-wide">LIVE</span>
          </span>
          {links.map(({to, label, icon: Icon, end}) => (
            <NavLink key={to} to={to} end={end} className={navLinkClass}>
              <Icon/>
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center gap-4">
          <OrganizationSwitcher className="max-w-48"/>
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

      {/* Phones and tablets: a compact bar, the rest behind the menu button. A bar wider than the
          screen would make the whole page wider, and the Show Caller's sticky controls would scroll away. */}
      <div className="lg:hidden flex items-center justify-between gap-2 px-3 py-2">
        <Link to="/" className="flex items-center gap-2 min-w-0" aria-label="Actieve productie">
          <AppIcon className="w-9 h-9 shrink-0"/>
          <span className="text-xs px-2 py-0.5 rounded-full bg-red-600 text-white tracking-wide shrink-0">LIVE</span>
          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{currentLabel(pathname)}</span>
        </Link>
        <div className="flex items-center gap-1 shrink-0">
          <span className="p-2"><HelpButton/></span>
          <button type="button" onClick={() => setMenuOpen((open) => !open)} aria-expanded={menuOpen} aria-controls="live-menu"
                  aria-label={menuOpen ? 'Menu sluiten' : 'Menu openen'}
                  className="p-2 rounded-md text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800">
            {menuOpen ? <MdClose className="w-6 h-6"/> : <MdMenu className="w-6 h-6"/>}
          </button>
        </div>
      </div>
      {menuOpen && (
        <nav id="live-menu" aria-label="LIVE" className="lg:hidden border-t border-gray-200 dark:border-gray-800 px-3 py-2">
          <ul className="flex flex-col">
            {links.map(({to, label, icon: Icon, end}) => (
              <li key={to}>
                <NavLink to={to} end={end}
                         className={({isActive}) => `flex items-center gap-3 px-2 py-3 rounded-md text-base ${isActive ? 'font-semibold text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-800' : 'text-gray-700 dark:text-gray-300'}`}>
                  <Icon className="w-5 h-5"/>{label}
                </NavLink>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center gap-2 border-t border-gray-200 dark:border-gray-800 mt-2 pt-3 pb-1">
            <OrganizationSwitcher className="max-w-full"/>
            <Link to="/admin" className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-300">
              <MdSettings/> Beheer
            </Link>
            <Link to="/over" className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-300">
              <MdInfo/> Over deze app
            </Link>
            <ThemeToggle/>
          </div>
        </nav>
      )}
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
            <Route path="interviews" element={<InterviewsPage/>}/>
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
