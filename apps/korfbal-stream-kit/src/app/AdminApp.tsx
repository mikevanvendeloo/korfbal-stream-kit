import React from 'react';
import {Link, Navigate, Route, Routes, useLocation} from 'react-router-dom';
import type {IconType} from 'react-icons';
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
  MdAssignmentInd,
  MdBuild,
  MdDataObject,
  MdEditCalendar,
  MdGroups,
  MdInfo,
  MdList,
  MdPeople,
  MdPlayCircleFilled,
  MdQrCode,
  MdSchedule,
  MdSettings,
  MdSlideshow,
  MdStorefront,
  MdTextFields,
  MdVideocam,
  MdViewAgenda,
  MdViewList,
  MdWork,
} from 'react-icons/md';
import VmixTemplatesPage from '../pages/VmixTemplatesPage';
import VmixConnectionPage from '../pages/VmixConnectionPage';
import ProductionStaffingPage from '../pages/ProductionStaffingPage';
import ProductionLayout from '../components/ProductionLayout';
import {useActiveProduction} from '../hooks/useProductions';
import {adminPaths, REPORT_TABS} from '../lib/adminPaths';
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
import ManualView from '../handleiding/ManualView';
import HelpButton from '../handleiding/HelpButton';

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
    <Link to={adminPaths.settings}
          title="Actief seizoen wijzigen"
          className="text-xs px-2 py-1 rounded-full border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50 whitespace-nowrap">
      Seizoen {season.name}
    </Link>
  );
}

type MenuItem = { to: string; label: string; icon: IconType };
type Menu = { label: string; groups: Array<{ heading?: string; items: MenuItem[] }> };

/**
 * The Beheer menu, ordered by when you need it: per production (operational), the reusable
 * draaiboeken, stamgegevens you set up once or per season, the reports, and loose tools.
 */
const MENUS: Menu[] = [
  {
    label: 'Draaiboeken',
    groups: [{
      items: [
        {to: adminPaths.callSheetTemplates, label: 'Draaiboek-templates', icon: MdViewList},
        {to: adminPaths.segmentTemplates, label: 'Segment-templates', icon: MdViewAgenda},
        {to: adminPaths.segmentDefaults, label: 'Standaardbezetting per segment', icon: MdAssignmentInd},
      ],
    }],
  },
  {
    label: 'Stamgegevens',
    groups: [
      {
        heading: 'Crew',
        items: [
          {to: adminPaths.persons, label: 'Personen', icon: MdPeople},
          {to: adminPaths.positions, label: 'Posities', icon: MdWork},
          {to: adminPaths.skills, label: 'Skills', icon: MdBuild},
        ],
      },
      {
        heading: 'Competitie',
        items: [
          {to: adminPaths.matchSchedule, label: 'Wedstrijdprogramma', icon: MdSchedule},
          {to: adminPaths.manualMatches, label: 'Handmatige wedstrijden', icon: MdEditCalendar},
          {to: adminPaths.clubs, label: 'Clubs & spelers', icon: MdGroups},
        ],
      },
      {
        heading: 'Sponsors',
        items: [
          {to: adminPaths.sponsors, label: 'Sponsors', icon: MdStorefront},
          {to: adminPaths.sponsorSlides, label: 'Sponsor-slides', icon: MdSlideshow},
        ],
      },
      {
        heading: 'vMix',
        items: [
          {to: adminPaths.vmixConnection, label: 'vMix-koppeling', icon: MdVideocam},
          {to: adminPaths.vmixTitleTemplates, label: 'Titel-templates', icon: MdTextFields},
          {to: adminPaths.vmixDatasources, label: 'Datasources', icon: MdDataObject},
        ],
      },
    ],
  },
  {
    label: 'Rapportages',
    groups: [{items: REPORT_TABS.map(({tab, label}) => ({to: adminPaths.report(tab), label, icon: MdAssessment}))}],
  },
  {
    label: 'Overig',
    groups: [{items: [{to: adminPaths.qr, label: 'QR-generator', icon: MdQrCode}]}],
  },
];

const itemClass = 'flex px-3 py-1.5 rounded text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 items-center gap-2';
const headingClass = 'px-3 py-1 text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 font-semibold';

function DropdownMenu({menu, open, onToggle}: { menu: Menu; open: boolean; onToggle: (open: boolean) => void }) {
  return (
    <details open={open} onToggle={(e) => onToggle((e.currentTarget as HTMLDetailsElement).open)} className="relative group">
      <summary className="list-none cursor-pointer text-gray-800 dark:text-gray-200 hover:underline">{menu.label}</summary>
      <div className="absolute left-0 mt-2 min-w-64 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg p-2 z-50">
        <ul className="text-sm">
          {menu.groups.map((group, i) => (
            <React.Fragment key={group.heading ?? i}>
              {group.heading && <li className={`${headingClass} ${i > 0 ? 'mt-3' : ''}`}>{group.heading}</li>}
              {group.items.map(({to, label, icon: Icon}) => (
                <li key={to}>
                  <Link to={to} className={itemClass}><Icon/><span>{label}</span></Link>
                </li>
              ))}
            </React.Fragment>
          ))}
        </ul>
      </div>
    </details>
  );
}

function Nav() {
  const location = useLocation();
  const [openMenu, setOpenMenu] = React.useState<string | null>(null);
  const {data: active} = useActiveProduction();

  // Close any open menu on route change
  React.useEffect(() => setOpenMenu(null), [location.pathname]);

  const productionMenu: Menu = {
    label: 'Producties',
    groups: [{
      items: [
        {to: adminPaths.productions, label: 'Productieoverzicht', icon: MdList},
        ...(active ? [{to: adminPaths.production(active.id), label: 'Actieve productie', icon: MdPlayCircleFilled}] : []),
      ],
    }],
  };

  return (
    <header className="border-b border-gray-200 dark:border-gray-800">
      <div className="container flex items-center justify-between py-3">
        <nav className="flex items-center gap-6 text-sm">
          <Link to={adminPaths.home} className="font-semibold text-gray-900 dark:text-gray-100"><AppIcon className={"w-16 h-16 mr-2"}/>Korfbal Streamz Kit</Link>

          <Link to="/" className="text-gray-800 dark:text-gray-200 hover:underline font-semibold">🎬 LIVE</Link>

          {[productionMenu, ...MENUS].map((menu) => (
            <DropdownMenu key={menu.label} menu={menu} open={openMenu === menu.label}
                          onToggle={(open) => setOpenMenu((current) => open ? menu.label : (current === menu.label ? null : current))}/>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <ActiveSeasonBadge/>
          <Link to={adminPaths.settings} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200" title="Instellingen" aria-label="Instellingen">
            <MdSettings className="w-5 h-5" />
          </Link>
          <HelpButton/>
          <Link to={adminPaths.about} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200" title="Over deze app">
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

            <Route path="producties" element={<ProductionsAdminPage/>}/>
            <Route path="producties/:id" element={<ProductionLayout/>}>
              <Route index element={<ProductionDetailPage/>}/>
              <Route path="callsheets" element={<CallSheetsPage/>}/>
              <Route path="callsheets/:callSheetId" element={<CallSheetEditPage/>}/>
              <Route path="beschikbaarheid" element={<ProductionAttendancePage/>}/>
              <Route path="bezetting" element={<ProductionStaffingPage/>}/>
              <Route path="vmix-titels" element={<ProductionTitlesPage/>}/>
              <Route path="rapport" element={<ProductionReportPage/>}/>
              <Route path="rapport/crew" element={<CrewReportPage/>}/>
              <Route path="rapport/tijdsanalyse" element={<ProductionTimingReportPage/>}/>
            </Route>

            <Route path="draaiboeken/templates" element={<CallSheetTemplatesPage />} />
            <Route path="draaiboeken/templates/:id" element={<CallSheetTemplateDetailsPage />} />
            <Route path="draaiboeken/segment-templates" element={<SegmentTemplatesPage />} />
            <Route path="draaiboeken/standaardbezetting" element={<SegmentDefaultsAdminPage/>}/>

            <Route path="stamgegevens/personen" element={<PersonsAdminPage/>}/>
            <Route path="stamgegevens/posities" element={<PositionsAdminPage/>}/>
            <Route path="stamgegevens/skills" element={<SkillsAdminPage/>}/>
            <Route path="stamgegevens/wedstrijdprogramma" element={<MatchSchedulePage/>}/>
            <Route path="stamgegevens/handmatige-wedstrijden" element={<ManualMatchesAdminPage />} />
            <Route path="stamgegevens/clubs" element={<ClubsPage/>}/>
            <Route path="stamgegevens/sponsors" element={<SponsorsPage/>}/>
            <Route path="stamgegevens/sponsor-slides" element={<SponsorSlidesPage/>}/>
            <Route path="stamgegevens/vmix-koppeling" element={<VmixConnectionPage/>}/>
            <Route path="stamgegevens/vmix-titel-templates" element={<VmixTemplatesPage/>}/>
            <Route path="stamgegevens/vmix-datasources" element={<VmixDatasourcesPage/>}/>

            <Route path="rapportages" element={<Navigate to={adminPaths.report('dagbezetting')} replace/>}/>
            <Route path="rapportages/:tab" element={<ReportsPage/>}/>

            <Route path="overig/qr" element={<QRAdminPage/>}/>

            <Route path="instellingen" element={<SettingsPage/>}/>
            <Route path="over" element={<AboutPage/>}/>
            <Route path="handleiding" element={<ManualView part="beheer"/>}/>
            <Route path="handleiding/:chapter" element={<ManualView part="beheer"/>}/>
            <Route path="*" element={<NotFound/>}/>
          </Routes>
        </ErrorBoundary>
      </main>
    </>
  );
}
