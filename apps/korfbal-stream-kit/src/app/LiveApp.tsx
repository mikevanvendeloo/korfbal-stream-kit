import React from 'react';
import {Link, Route, Routes, useLocation} from 'react-router-dom';
import {MdClose, MdInfo, MdMenu, MdMic, MdPlayCircleFilled, MdSettings, MdTableChart, MdVideocam, MdViewList} from 'react-icons/md';
import {NavDropdown, navMenuItemClass} from '../components/NavDropdown';
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
import {useCurrentOrganization} from '../components/OrganizationGate';
import {OrganizationMenu, OrganizationMenuItems} from '../components/OrganizationMenu';
import OrganizationLogo from '../components/OrganizationLogo';

/**
 * The LIVE screens. The Show Caller has no entry of its own: it is a tile on the Callsheet's position
 * choice, so the Callsheet entry is also current on /show-caller.
 */
const links = [
  {to: '/', label: 'Productie', icon: MdPlayCircleFilled, also: null},
  {to: '/scoreboard', label: 'Scoreboard', icon: MdTableChart, also: null},
  {to: '/callsheet', label: 'Callsheet', icon: MdViewList, also: '/show-caller'},
  {to: '/interviews', label: 'Interviews', icon: MdMic, also: null},
  {to: '/vmix', label: 'vMix', icon: MdVideocam, also: null},
];

const isCurrent = (pathname: string, {to, also}: typeof links[number]) =>
  to === '/' ? pathname === '/' : pathname.startsWith(to) || (!!also && pathname.startsWith(also));

/** The current screen's name, for the compact bar on phones. */
function currentLabel(pathname: string): string {
  if (pathname.startsWith('/handleiding')) return 'Handleiding';
  if (pathname.startsWith('/over')) return 'Over';
  if (pathname.startsWith('/show-caller')) return 'Show Caller';
  return links.find((link) => isCurrent(pathname, link))?.label ?? '';
}

/** In the phone menu: the chosen organization with its two choices, as in OrganizationMenu. */
function PhoneOrganizationSection() {
  const {organization} = useCurrentOrganization();
  if (!organization) return null;
  return (
    <section aria-label="Organisatie" className="border-t border-gray-200 dark:border-gray-800 mt-2 pt-3">
      <div className="flex items-center gap-2 px-2 min-w-0 text-sm font-semibold text-gray-900 dark:text-gray-100">
        <OrganizationLogo organization={organization} size="small"/>
        <span className="truncate">{organization.name}</span>
      </div>
      <ul className="flex flex-col mt-1">
        <OrganizationMenuItems itemClassName="flex items-center gap-3 px-2 py-3 rounded-md text-base text-gray-700 dark:text-gray-300"/>
      </ul>
    </section>
  );
}

function LiveNav() {
  const {pathname} = useLocation();
  const [menuOpen, setMenuOpen] = React.useState(false);
  // The organization and gear menus on wide screens: one open at a time
  const [openMenu, setOpenMenu] = React.useState<'organization' | 'gear' | null>(null);
  const toggleMenu = (menu: 'organization' | 'gear') => (open: boolean) =>
    setOpenMenu((current) => open ? menu : (current === menu ? null : current));
  React.useEffect(() => {
    setMenuOpen(false);
    setOpenMenu(null);
  }, [pathname]);

  return (
    <header className="border-b border-gray-200 dark:border-gray-800">
      {/* Wide screens: the screens in one bar; organization, help and the gear menu on the right */}
      <div className="hidden lg:flex container items-center justify-between gap-4 py-2">
        <nav className="flex items-center gap-5 text-sm min-w-0">
          <Link to="/" className="font-semibold text-gray-900 dark:text-gray-100 inline-flex items-center shrink-0" aria-label="Korfbal Streamz Kit LIVE">
            <AppIcon className="w-10 h-10 mr-2"/>
            <span className="hidden 2xl:inline mr-2">Korfbal Streamz Kit</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-red-600 text-white tracking-wide">LIVE</span>
          </Link>
          {links.map((link) => {
            const {to, label, icon: Icon} = link;
            const current = isCurrent(pathname, link);
            return (
              <Link key={to} to={to} aria-current={current ? 'page' : undefined}
                    className={`inline-flex items-center gap-1.5 whitespace-nowrap py-1 border-b-2 ${current ? 'border-red-600 font-semibold text-gray-900 dark:text-white' : 'border-transparent text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'}`}>
                <Icon/><span>{label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-3 shrink-0">
          <OrganizationMenu open={openMenu === 'organization'} onToggle={toggleMenu('organization')}/>
          <HelpButton/>
          <NavDropdown open={openMenu === 'gear'} onToggle={toggleMenu('gear')} label="Beheer en instellingen" summary={<MdSettings className="w-5 h-5"/>}>
            <li><Link to="/admin" className={navMenuItemClass}><MdSettings/><span>Beheer</span></Link></li>
            <li><ThemeToggle className={`${navMenuItemClass} w-full text-left`}/></li>
            <li><Link to="/over" className={navMenuItemClass}><MdInfo/><span>Over deze app</span></Link></li>
          </NavDropdown>
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
            {links.map((link) => {
              const {to, label, icon: Icon} = link;
              const current = isCurrent(pathname, link);
              return (
                <li key={to}>
                  <Link to={to} aria-current={current ? 'page' : undefined}
                        className={`flex items-center gap-3 px-2 py-3 rounded-md text-base ${current ? 'font-semibold text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-800' : 'text-gray-700 dark:text-gray-300'}`}>
                    <Icon className="w-5 h-5"/>{label}
                  </Link>
                </li>
              );
            })}
          </ul>
          <PhoneOrganizationSection/>
          <div className="flex flex-wrap items-center gap-2 border-t border-gray-200 dark:border-gray-800 mt-2 pt-3 pb-1">
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
