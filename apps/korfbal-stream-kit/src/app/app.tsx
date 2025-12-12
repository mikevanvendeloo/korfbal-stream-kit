import React from 'react';
import { Route, Routes, Link, useLocation } from 'react-router-dom';
import SponsorsPage from '../pages/SponsorsPage';
import ScoreboardPage from '../pages/ScoreboardPage';
import MatchSchedulePage from '../pages/MatchSchedulePage';
import SponsorRowsPage from '../pages/SponsorRowsPage';
import PersonsAdminPage from '../pages/PersonsAdminPage';
import CapabilitiesAdminPage from '../pages/CapabilitiesAdminPage';
import PositionsAdminPage from '../pages/PositionsAdminPage';
import SegmentDefaultsAdminPage from '../pages/SegmentDefaultsAdminPage';
import QRAdminPage from '../pages/QRAdminPage';
import ProductionsAdminPage from '../pages/ProductionsAdminPage';
import ProductionDetailPage from '../pages/ProductionDetailPage';
import ProductionTitlesPage from '../pages/ProductionTitlesPage';
import ClubsPage from '../pages/ClubsPage';
import CrewReportPage from '../pages/CrewReportPage';
import CallSheetsPage from '../pages/CallSheetsPage';
import CallSheetEditPage from '../pages/CallSheetEditPage';
import ActiveProductionPage from '../pages/ActiveProductionPage';
import { ThemeProvider, useTheme } from '../theme/ThemeProvider';
import {
  MdPeople,
  MdTableChart,
  MdSchedule,
  MdList,
  MdPlayCircleFilled,
  MdViewCarousel,
  MdTextFields,
  MdVideocam,
  MdBuild,
  MdWork,
  MdViewList,
  MdGroups,
  MdQrCode,
} from 'react-icons/md';
import VmixTemplatesPage from '../pages/VmixTemplatesPage';
import VmixControlPage from '../pages/VmixControlPage';

function Nav() {
  const { theme, toggle } = useTheme();
  const location = useLocation();
  const liveRef = React.useRef<HTMLDetailsElement>(null);
  const prodRef = React.useRef<HTMLDetailsElement>(null);
  const confRef = React.useRef<HTMLDetailsElement>(null);

  function closeAll() {
    for (const ref of [liveRef, prodRef, confRef]) {
      if (ref.current) ref.current.open = false;
    }
  }

  // Close any open menus on route change
  React.useEffect(() => {
    closeAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  function onToggle(ref: React.RefObject<HTMLDetailsElement>) {
    const el = ref.current;
    if (!el) return;
    // When this menu opens, close others
    if (el.open) {
      for (const other of [liveRef, prodRef, confRef]) {
        if (other !== ref && other.current) other.current.open = false;
      }
    }
  }
  return (
    <header className="border-b border-gray-200 dark:border-gray-800">
      <div className="container flex items-center justify-between py-3">
        <nav className="flex items-center gap-6 text-sm">
          <Link to="/" className="font-semibold text-gray-900 dark:text-gray-100">Korfbal Stream Kit</Link>

          {/* Live */}
          <details ref={liveRef} onToggle={() => onToggle(liveRef)} className="relative group">
            <summary className="list-none cursor-pointer text-gray-800 dark:text-gray-200 hover:underline">
              Live
            </summary>
            <div className="absolute left-0 mt-2 min-w-48 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg p-2 z-20">
              <ul className="text-sm">
                <li>
                  <Link to="/sponsors" className="block px-3 py-1.5 rounded text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 inline-flex items-center gap-2">
                    <MdPeople />
                    <span>Sponsors</span>
                  </Link>
                </li>
                <li>
                  <Link to="/scoreboard" className="block px-3 py-1.5 rounded text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 inline-flex items-center gap-2">
                    <MdTableChart />
                    <span>Scoreboard</span>
                  </Link>
                </li>
                <li>
                  <Link to="/matches/schedule" className="block px-3 py-1.5 rounded text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 inline-flex items-center gap-2">
                    <MdSchedule />
                    <span>Match schedule</span>
                  </Link>
                </li>
              </ul>
            </div>
          </details>

          {/* Producties */}
          <details ref={prodRef} onToggle={() => onToggle(prodRef)} className="relative group">
            <summary className="list-none cursor-pointer text-gray-800 dark:text-gray-200 hover:underline">
              Producties
            </summary>
            <div className="absolute left-0 mt-2 min-w-56 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg p-2 z-20">
              <ul className="text-sm">
                <li>
                  <Link to="/admin/productions" className="block px-3 py-1.5 rounded text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 inline-flex items-center gap-2">
                    <MdList />
                    <span>Overzicht</span>
                  </Link>
                </li>
                <li>
                  <Link to="/active" className="block px-3 py-1.5 rounded text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 inline-flex items-center gap-2">
                    <MdPlayCircleFilled />
                    <span>Actieve productie</span>
                  </Link>
                </li>
                <li className="mt-1 px-3 py-1 text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">vMix</li>
                <li>
                  <Link to="/vmix/sponsor-rows" className="block px-3 py-1.5 rounded text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 inline-flex items-center gap-2">
                    <MdViewCarousel />
                    <span>Sponsor rows</span>
                  </Link>
                </li>
                <li>
                  <Link to="/admin/vmix/title-templates" className="block px-3 py-1.5 rounded text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 inline-flex items-center gap-2">
                    <MdTextFields />
                    <span>Titel templates</span>
                  </Link>
                </li>
                <li>
                  <Link to="/admin/vmix/control" className="block px-3 py-1.5 rounded text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 inline-flex items-center gap-2">
                    <MdVideocam />
                    <span>vMix control</span>
                  </Link>
                </li>
              </ul>
            </div>
          </details>

          {/* Configuratie */}
          <details ref={confRef} onToggle={() => onToggle(confRef)} className="relative group">
            <summary className="list-none cursor-pointer text-gray-800 dark:text-gray-200 hover:underline">
              Configuratie
            </summary>
            <div className="absolute left-0 mt-2 min-w-56 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg p-2 z-20">
              <ul className="text-sm">
                <li>
                  <Link to="/admin/persons" className="block px-3 py-1.5 rounded text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 inline-flex items-center gap-2">
                    <MdPeople />
                    <span>Personen</span>
                  </Link>
                </li>
                <li>
                  <Link to="/admin/capabilities" className="block px-3 py-1.5 rounded text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 inline-flex items-center gap-2">
                    <MdBuild />
                    <span>Capabilities</span>
                  </Link>
                </li>
                <li>
                  <Link to="/admin/positions" className="block px-3 py-1.5 rounded text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 inline-flex items-center gap-2">
                    <MdWork />
                    <span>Posities</span>
                  </Link>
                </li>
                <li>
                  <Link to="/admin/segment-defaults" className="block px-3 py-1.5 rounded text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 inline-flex items-center gap-2">
                    <MdViewList />
                    <span>Segment posities</span>
                  </Link>
                </li>
                <li>
                  <Link to="/admin/clubs" className="block px-3 py-1.5 rounded text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 inline-flex items-center gap-2">
                    <MdGroups />
                    <span>Clubs</span>
                  </Link>
                </li>
                <li>
                  <Link to="/admin/qr" className="block px-3 py-1.5 rounded text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 inline-flex items-center gap-2">
                    <MdQrCode />
                    <span>QR generator</span>
                  </Link>
                </li>
              </ul>
            </div>
          </details>
        </nav>
        <button onClick={toggle} className="text-sm px-3 py-1 rounded-md border border-gray-300 dark:border-gray-700 text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800">
          {theme === 'dark' ? 'Light' : 'Dark'} mode
        </button>
      </div>
    </header>
  );
}

export function App() {
  return (
    <ThemeProvider>
      <div className="min-h-screen bg-white dark:bg-gray-950">
        <Nav />
        <main>
          <Routes>
            <Route path="/" element={<div className="container py-6 text-gray-800 dark:text-gray-100">Welkom! Ga naar <><Link className="underline" to="/sponsors">Sponsors</Link>, <Link className="underline" to="/scoreboard">Scoreboard</Link> of <Link className="underline" to="/matches/schedule">Match schedule</Link></>.</div>} />
            <Route path="/sponsors" element={<SponsorsPage />} />
            <Route path="/scoreboard" element={<ScoreboardPage />} />
            <Route path="/matches/schedule" element={<MatchSchedulePage />} />
            <Route path="/admin/persons" element={<PersonsAdminPage />} />
            <Route path="/admin/capabilities" element={<CapabilitiesAdminPage />} />
            <Route path="/admin/positions" element={<PositionsAdminPage />} />
            <Route path="/admin/segment-defaults" element={<SegmentDefaultsAdminPage />} />
            <Route path="/admin/clubs" element={<ClubsPage />} />
            <Route path="/admin/qr" element={<QRAdminPage />} />
            <Route path="/admin/productions" element={<ProductionsAdminPage />} />
            <Route path="/admin/productions/:id" element={<ProductionDetailPage />} />
            <Route path="/admin/productions/:id/titles" element={<ProductionTitlesPage />} />
            <Route path="/admin/productions/:id/crew-report" element={<CrewReportPage />} />
            <Route path="/admin/productions/:id/callsheets" element={<CallSheetsPage />} />
            <Route path="/admin/productions/:id/callsheets/:callSheetId" element={<CallSheetEditPage />} />
            <Route path="/active" element={<ActiveProductionPage />} />
            <Route path="/vmix/sponsor-rows" element={<SponsorRowsPage />} />
            <Route path="/admin/vmix/title-templates" element={<VmixTemplatesPage />} />
            <Route path="/admin/vmix/control" element={<VmixControlPage />} />
          </Routes>
        </main>
      </div>
    </ThemeProvider>
  );
}

export default App;
