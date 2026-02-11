import React from 'react';
import {Link, Route, Routes, useLocation} from 'react-router-dom';
import SponsorsPage from '../pages/SponsorsPage';
import ScoreboardPage from '../pages/ScoreboardPage';
import MatchSchedulePage from '../pages/MatchSchedulePage';
import SponsorRowsPage from '../pages/SponsorRowsPage';
import PersonsAdminPage from '../pages/PersonsAdminPage';
import SkillsAdminPage from '../pages/SkillsAdminPage';
import PositionsAdminPage from '../pages/PositionsAdminPage';
import SegmentDefaultsAdminPage from '../pages/SegmentDefaultsAdminPage';
import QRAdminPage from '../pages/QRAdminPage';
import ProductionsAdminPage from '../pages/ProductionsAdminPage';
import ProductionDetailPage from '../pages/ProductionDetailPage';
import ProductionTitlesPage from '../pages/ProductionTitlesPage';
import ProductionAttendancePage from '../pages/ProductionAttendancePage';
import ClubsPage from '../pages/ClubsPage';
import CrewReportPage from '../pages/CrewReportPage';
import ProductionReportPage from '../pages/ProductionReportPage';
import CallSheetsPage from '../pages/CallSheetsPage';
import CallSheetEditPage from '../pages/CallSheetEditPage';
import ActiveProductionPage from '../pages/ActiveProductionPage';
import {ThemeProvider, useTheme} from '../theme/ThemeProvider';
import {
  MdBuild,
  MdGroups,
  MdList,
  MdPeople,
  MdPlayCircleFilled,
  MdQrCode,
  MdSchedule,
  MdTableChart,
  MdTextFields,
  MdVideocam,
  MdViewList,
  MdWork,
} from 'react-icons/md';
import VmixTemplatesPage from '../pages/VmixTemplatesPage';
import VmixControlPage from '../pages/VmixControlPage';

function Nav() {
  const { theme, toggle } = useTheme();
  const location = useLocation();
  const liveRef = React.useRef<HTMLDetailsElement>(null);
  const beheerRef = React.useRef<HTMLDetailsElement>(null);

  function closeAll() {
    for (const ref of [liveRef, beheerRef]) {
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
      for (const other of [liveRef, beheerRef]) {
        if (other !== ref && other.current) other.current.open = false;
      }
    }
  }
  return (
    <header className="border-b border-gray-200 dark:border-gray-800">
      <div className="container flex items-center justify-between py-3">
        <nav className="flex items-center gap-6 text-sm">
          <Link to="/" className="font-semibold text-gray-900 dark:text-gray-100">Korfbal Stream Kit</Link>

          {/* LIVE - Tijdens productie */}
          <details ref={liveRef} onToggle={() => onToggle(liveRef)} className="relative group">
            <summary className="list-none cursor-pointer text-gray-800 dark:text-gray-200 hover:underline font-semibold">
              🎬 LIVE
            </summary>
            <div className="absolute left-0 mt-2 min-w-64 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg p-2 z-20">
              <ul className="text-sm">
                <li>
                  <Link to="/active" className="block px-3 py-1.5 rounded text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 inline-flex items-center gap-2">
                    <MdPlayCircleFilled />
                    <span>Actieve productie</span>
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
                    <span>Wedstrijd programma</span>
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

          {/* BEHEER */}
          <details ref={beheerRef} onToggle={() => onToggle(beheerRef)} className="relative group">
            <summary className="list-none cursor-pointer text-gray-800 dark:text-gray-200 hover:underline">
              Beheer
            </summary>
            <div className="absolute left-0 mt-2 min-w-64 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg p-2 z-20">
              <ul className="text-sm">
                <li className="px-3 py-1 text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 font-semibold">Producties</li>
                <li>
                  <Link to="/admin/productions" className="block px-3 py-1.5 rounded text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 inline-flex items-center gap-2">
                    <MdList />
                    <span>Productie overzicht</span>
                  </Link>
                </li>
                <li>
                  <Link to="/admin/vmix/title-templates" className="block px-3 py-1.5 rounded text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 inline-flex items-center gap-2">
                    <MdTextFields />
                    <span>vMix titel templates</span>
                  </Link>
                </li>

                <li className="mt-3 px-3 py-1 text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 font-semibold">Basis data</li>
                <li>
                  <Link to="/admin/vmix/control" className="block px-3 py-1.5 rounded text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 inline-flex items-center gap-2">
                    <MdVideocam />
                    <span>vMix control</span>
                  </Link>
                </li>

                <li className="mt-3 px-3 py-1 text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 font-semibold">Basis data</li>
                <li>
                  <Link to="/sponsors" className="block px-3 py-1.5 rounded text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 inline-flex items-center gap-2">
                    <MdPeople />
                    <span>Sponsors</span>
                  </Link>
                </li>
                <li>
                  <Link to="/admin/clubs" className="block px-3 py-1.5 rounded text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 inline-flex items-center gap-2">
                    <MdGroups />
                    <span>Clubs & Spelers</span>
                  </Link>
                </li>

                <li className="mt-3 px-3 py-1 text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 font-semibold">Team</li>
                <li>
                  <Link to="/admin/persons" className="block px-3 py-1.5 rounded text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 inline-flex items-center gap-2">
                    <MdPeople />
                    <span>Personen</span>
                  </Link>
                </li>
                <li>
                  <Link to="/admin/skills" className="block px-3 py-1.5 rounded text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 inline-flex items-center gap-2">
                    <MdBuild />
                    <span>Skills</span>
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

                <li className="mt-3 px-3 py-1 text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 font-semibold">Tools</li>
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
            <Route path="/" element={<div className="container py-6 text-gray-800 dark:text-gray-100">Welkom! <p>Deze applicatie helpt met ondersteunen van planning van livestreams en het voorzien van data aan livestream software zoals vMix.</p></div>} />
            <Route path="/sponsors" element={<SponsorsPage />} />
            <Route path="/scoreboard" element={<ScoreboardPage />} />
            <Route path="/matches/schedule" element={<MatchSchedulePage />} />
            <Route path="/admin/persons" element={<PersonsAdminPage />} />
            <Route path="/admin/skills" element={<SkillsAdminPage />} />
            <Route path="/admin/positions" element={<PositionsAdminPage />} />
            <Route path="/admin/segment-defaults" element={<SegmentDefaultsAdminPage />} />
            <Route path="/admin/clubs" element={<ClubsPage />} />
            <Route path="/admin/qr" element={<QRAdminPage />} />
            <Route path="/admin/productions" element={<ProductionsAdminPage />} />
            <Route path="/admin/productions/:id" element={<ProductionDetailPage />} />
            <Route path="/admin/productions/:id/attendance" element={<ProductionAttendancePage />} />
            <Route path="/admin/productions/:id/titles" element={<ProductionTitlesPage />} />
            <Route path="/admin/productions/:id/crew-report" element={<CrewReportPage />} />
            <Route path="/admin/productions/:id/production-report" element={<ProductionReportPage />} />
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
