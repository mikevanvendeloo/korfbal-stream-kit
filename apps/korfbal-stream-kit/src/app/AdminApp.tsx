import React from 'react';
import {Link, Route, Routes, useLocation} from 'react-router-dom';
import SponsorsPage from '../pages/SponsorsPage';
import MatchSchedulePage from '../pages/MatchSchedulePage';
import ManualMatchesAdminPage from '../pages/ManualMatchesAdminPage';
import SponsorSlidesPage from '../pages/SponsorSlidesPage';
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
import CallSheetTemplatesPage from '../pages/CallSheetTemplatesPage';
import CallSheetTemplateDetailsPage from '../pages/CallSheetTemplateDetailsPage';
import CallSheetEditPage from '../pages/CallSheetEditPage';
import {
  MdAssessment,
  MdBuild,
  MdEditCalendar,
  MdGroups,
  MdInfo,
  MdList,
  MdPeople,
  MdQrCode,
  MdSchedule,
  MdSettings,
  MdTextFields,
  MdVideocam,
  MdViewList,
  MdWork,
} from 'react-icons/md';
import VmixTemplatesPage from '../pages/VmixTemplatesPage';
import VmixControlPage from '../pages/VmixControlPage';
import SegmentAssignmentsPage from '../pages/SegmentAssignmentsPage';
import VmixDatasourcesPage from '../pages/VmixDatasourcesPage';
import AppLogo from '../components/AppLogo';
import AppIcon from "../components/AppIcon";
import ReportsPage from '../pages/ReportsPage';
import AboutPage from '../pages/AboutPage';
import SettingsPage from '../pages/SettingsPage';
import {ErrorBoundary} from "../components/ErrorBoundary";
import SegmentTemplatesPage from "../pages/SegmentTemplatesPage";
import ProductionTimingReportPage from "../pages/ProductionTimingReportPage";
import {useActiveSeason, useSeasonChangedSync} from "../hooks/useSeasons";
import ThemeToggle from "../components/ThemeToggle";
import NotFound from "../components/NotFound";

function AdminHome() {
  return (
    <div className="container py-6 text-gray-800 dark:text-gray-100 flex flex-col items-center">
      <AppLogo className="w-aut h-40 mb-6" />
      <h1 className="text-2xl font-bold mb-4">Welkom!</h1>
      <p className="text-center max-w-lg">
        Deze applicatie helpt met ondersteunen van planning van livestreams en het voorzien van data aan livestream software zoals vMix.
      </p>
    </div>
  );
}

function ActiveSeasonBadge() {
  // Mounted once in the nav: refetch everything when another browser switches the active season.
  useSeasonChangedSync();
  const {data: season} = useActiveSeason();
  if (!season) return null;
  return (
    <Link to="/admin/settings"
          title="Actief seizoen wijzigen"
          className="text-xs px-2 py-1 rounded-full border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50 whitespace-nowrap">
      Seizoen {season.name}
    </Link>
  );
}

function Nav() {
  const location = useLocation();
  const beheerRef = React.useRef<HTMLDetailsElement>(null);
  const configRef = React.useRef<HTMLDetailsElement>(null);
  const toolsRef = React.useRef<HTMLDetailsElement>(null);
  const vMixRef = React.useRef<HTMLDetailsElement>(null);
  const productiesRef = React.useRef<HTMLDetailsElement>(null);

  function closeAll() {
    for (const ref of [beheerRef, configRef, toolsRef, vMixRef, productiesRef]) {
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
      for (const other of [beheerRef, configRef, toolsRef, vMixRef, productiesRef]) {
        if (other !== ref && other.current) other.current.open = false;
      }
    }
  }

  return (
    <header className="border-b border-gray-200 dark:border-gray-800">
      <div className="container flex items-center justify-between py-3">
        <nav className="flex items-center gap-6 text-sm">
          <Link to="/admin" className="font-semibold text-gray-900 dark:text-gray-100"><AppIcon className={"w-16 h-16 mr-2"}/>Korfbal Streamz Kit</Link>

          <Link to="/" className="text-gray-800 dark:text-gray-200 hover:underline font-semibold">🎬 LIVE</Link>

          <details ref={productiesRef} onToggle={() => onToggle(productiesRef)} className="relative group">
            <summary className="list-none cursor-pointer text-gray-800 dark:text-gray-200 hover:underline">
              Producties
            </summary>
            <div
              className="absolute left-0 mt-2 min-w-64 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg p-2 z-50">
              <ul className="text-sm">

                <li
                  className="px-3 py-1 text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 font-semibold">Producties
                </li>
                <li>
                  <Link to="/admin/productions"
                        className="block px-3 py-1.5 rounded text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 inline-flex items-center gap-2">
                    <MdList/>
                    <span>Productie overzicht</span>
                  </Link>
                </li>
                <li>
                  <Link to="/admin/persons"
                        className="block px-3 py-1.5 rounded text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 inline-flex items-center gap-2">
                    <MdPeople/>
                    <span>Personen</span>
                  </Link>
                </li>
                <li>
                  <Link to="/admin/callsheets/templates"
                        className="block px-3 py-1.5 rounded text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 inline-flex items-center gap-2">
                    <MdViewList/>
                    <span>Draaiboek Templates</span>
                  </Link>
                </li>
                <li>
                  <Link to="/admin/segment-templates"
                        className="block px-3 py-1.5 rounded text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 inline-flex items-center gap-2">
                    <MdViewList/>
                    <span>Segment Templates</span>
                  </Link>
                </li>

                <li>
                  <Link to="/admin/reports"
                        className="block px-3 py-1.5 rounded text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 inline-flex items-center gap-2">
                    <MdAssessment/>
                    <span>Rapportages</span>
                  </Link>
                </li>
                <li>
                  <Link to="/admin/reports?tab=timing"
                        className="block px-3 py-1.5 rounded text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 inline-flex items-center gap-2">
                    <MdSchedule/>
                    <span>Tijdsanalyse</span>
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
            <div
              className="absolute left-0 mt-2 min-w-64 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg p-2 z-50">
              <ul className="text-sm">

                <li
                  className="mt-3 px-3 py-1 text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 font-semibold">Basis
                  data
                </li>

                <li>
                  <Link to="/admin/sponsors"
                        className="block px-3 py-1.5 rounded text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 inline-flex items-center gap-2">
                    <MdPeople/>
                    <span>Sponsors</span>
                  </Link>
                </li>
                <li>
                  <Link to="/admin/sponsor-slides"
                        className="block px-3 py-1.5 rounded text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 inline-flex items-center gap-2">
                    <MdPeople/>
                    <span>Sponsor Slides</span>
                  </Link>
                </li>



                <li
                  className="mt-3 px-3 py-1 text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 font-semibold">Competition
                  data
                </li>
                <li>
                  <Link to="/admin/matches/schedule"
                        className="block px-3 py-1.5 rounded text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 inline-flex items-center gap-2">
                    <MdSchedule/>
                    <span>Wedstrijd programma</span>
                  </Link>
                </li>
                <li>
                  <Link to="/admin/manual-matches"
                        className="block px-3 py-1.5 rounded text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 inline-flex items-center gap-2">
                    <MdEditCalendar/>
                    <span>Handmatige wedstrijden</span>
                  </Link>
                </li>
                <li>
                  <Link to="/admin/clubs"
                        className="block px-3 py-1.5 rounded text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 inline-flex items-center gap-2">
                    <MdGroups/>
                    <span>Clubs & Spelers</span>
                  </Link>
                </li>

              </ul>
            </div>
          </details>
          <details ref={configRef} onToggle={() => onToggle(configRef)} className="relative group">
            <summary className="list-none cursor-pointer text-gray-800 dark:text-gray-200 hover:underline">
              Configuration
            </summary>
            <div
              className="absolute left-0 mt-2 min-w-64 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg p-2 z-50">
              <ul className="text-sm">
                <li>
                  <Link to="/admin/settings"
                        className="block px-3 py-1.5 rounded text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 inline-flex items-center gap-2">
                    <MdSettings/>
                    <span>Instellingen</span>
                  </Link>
                </li>
                <li>
                  <Link to="/admin/skills"
                        className="block px-3 py-1.5 rounded text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 inline-flex items-center gap-2">
                    <MdBuild/>
                    <span>Skills</span>
                  </Link>
                </li>
                <li>
                  <Link to="/admin/positions"
                        className="block px-3 py-1.5 rounded text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 inline-flex items-center gap-2">
                    <MdWork/>
                    <span>Posities</span>
                  </Link>
                </li>
                <li>
                  <Link to="/admin/segment-defaults"
                        className="block px-3 py-1.5 rounded text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 inline-flex items-center gap-2">
                    <MdViewList/>
                    <span>Segment posities</span>
                  </Link>
                </li>

              </ul>
            </div>
          </details>
          <details ref={toolsRef} onToggle={() => onToggle(toolsRef)} className="relative group">
            <summary className="list-none cursor-pointer text-gray-800 dark:text-gray-200 hover:underline">
              Tools
            </summary>
            <div
              className="absolute left-0 mt-2 min-w-64 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg p-2 z-50">
              <ul className="text-sm">
                <li
                  className="mt-3 px-3 py-1 text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 font-semibold">Tools
                </li>
                <li>
                  <Link to="/admin/qr"
                        className="block px-3 py-1.5 rounded text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 inline-flex items-center gap-2">
                    <MdQrCode/>
                    <span>QR generator</span>
                  </Link>
                </li>
              </ul>
            </div>
          </details>
          <details ref={vMixRef} onToggle={() => onToggle(vMixRef)} className="relative group">
            <summary className="list-none cursor-pointer text-gray-800 dark:text-gray-200 hover:underline">
              vMix
            </summary>
            <div
              className="absolute left-0 mt-2 min-w-64 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg p-2 z-50">
              <ul className="text-sm">
                <li>
                  <Link to="/admin/vmix/title-templates"
                        className="block px-3 py-1.5 rounded text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 inline-flex items-center gap-2">
                    <MdTextFields/>
                    <span>vMix titel templates</span>
                  </Link>
                </li>
                <li
                  className="mt-3 px-3 py-1 text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 font-semibold">Tools
                </li>
                <li>
                  <Link to="/admin/vmix/datasources"
                        className="block px-3 py-1.5 rounded text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 inline-flex items-center gap-2">
                    <span>Datasources</span>
                  </Link>
                </li>
                <li>
                  <Link to="/admin/vmix/control"
                        className="block px-3 py-1.5 rounded text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 inline-flex items-center gap-2">
                    <MdVideocam/>
                    <span>vMix control</span>
                  </Link>
                </li>
              </ul>
            </div>
          </details>
        </nav>
        <div className="flex items-center gap-2">
          <ActiveSeasonBadge/>
          <Link to="/admin/about" className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200" title="Over deze app">
            <MdInfo className="w-5 h-5" />
          </Link>
          <ThemeToggle/>
        </div>
      </div>
    </header>
  );
}

/** Beheer: everything to prepare and configure productions, served under /admin. */
export default function AdminApp() {
  return (
    <>
      <Nav/>
      <main>
        <ErrorBoundary>
          <Routes>
            <Route index element={<AdminHome/>}/>
            <Route path="sponsors" element={<SponsorsPage/>}/>
            <Route path="matches/schedule" element={<MatchSchedulePage/>}/>
            <Route path="manual-matches" element={<ManualMatchesAdminPage />} />
            <Route path="persons" element={<PersonsAdminPage/>}/>
            <Route path="callsheets/templates" element={<CallSheetTemplatesPage />} />
            <Route path="callsheets/templates/:id" element={<CallSheetTemplateDetailsPage />} />
            <Route path="segment-templates" element={<SegmentTemplatesPage />} />
            <Route path="skills" element={<SkillsAdminPage/>}/>
            <Route path="positions" element={<PositionsAdminPage/>}/>
            <Route path="segment-defaults" element={<SegmentDefaultsAdminPage/>}/>
            <Route path="clubs" element={<ClubsPage/>}/>
            <Route path="qr" element={<QRAdminPage/>}/>
            <Route path="productions" element={<ProductionsAdminPage/>}/>
            <Route path="productions/:id" element={<ProductionDetailPage/>}/>
            <Route path="productions/:id/attendance" element={<ProductionAttendancePage/>}/>
            <Route path="productions/:id/titles" element={<ProductionTitlesPage/>}/>
            <Route path="productions/:id/crew-report" element={<CrewReportPage/>}/>
            <Route path="productions/:id/timing-report" element={<ProductionTimingReportPage/>}/>
            <Route path="productions/:id/production-report" element={<ProductionReportPage/>}/>
            <Route path="productions/:id/callsheets" element={<CallSheetsPage/>}/>
            <Route path="productions/:id/callsheets/:callSheetId" element={<CallSheetEditPage/>}/>
            <Route path="productions/:id/segment-assignments"
                   element={<SegmentAssignmentsPage/>}/>
            <Route path="sponsor-slides" element={<SponsorSlidesPage/>}/>
            <Route path="vmix/title-templates" element={<VmixTemplatesPage/>}/>
            <Route path="vmix/control" element={<VmixControlPage/>}/>
            <Route path="vmix/datasources" element={<VmixDatasourcesPage/>}/>
            <Route path="reports" element={<ReportsPage/>}/>
            <Route path="about" element={<AboutPage/>}/>
            <Route path="settings" element={<SettingsPage/>}/>
            <Route path="*" element={<NotFound/>}/>
          </Routes>
        </ErrorBoundary>
      </main>
    </>
  );
}
