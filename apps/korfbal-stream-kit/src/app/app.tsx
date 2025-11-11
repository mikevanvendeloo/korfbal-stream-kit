import { Route, Routes, Link } from 'react-router-dom';
import SponsorsPage from '../pages/SponsorsPage';
import ScoreboardPage from '../pages/ScoreboardPage';
import MatchSchedulePage from '../pages/MatchSchedulePage';
import SponsorRowsPage from '../pages/SponsorRowsPage';
import PersonsAdminPage from '../pages/PersonsAdminPage';
import CapabilitiesAdminPage from '../pages/CapabilitiesAdminPage';
import QRAdminPage from '../pages/QRAdminPage';
import ProductionsAdminPage from '../pages/ProductionsAdminPage';
import ProductionDetailPage from '../pages/ProductionDetailPage';
import ClubsPage from '../pages/ClubsPage';
import { ThemeProvider, useTheme } from '../theme/ThemeProvider';

function Nav() {
  const { theme, toggle } = useTheme();
  return (
    <header className="border-b border-gray-200 dark:border-gray-800">
      <div className="container flex items-center justify-between py-3">
        <nav className="flex items-center gap-4 text-sm">
          <Link to="/" className="font-semibold text-gray-900 dark:text-gray-100">Korfbal Stream Kit</Link>
          <Link to="/sponsors" className="text-gray-700 dark:text-gray-300 hover:underline">Sponsors</Link>
          <Link to="/scoreboard" className="text-gray-700 dark:text-gray-300 hover:underline">Scoreboard</Link>
          <Link to="/matches/schedule" className="text-gray-700 dark:text-gray-300 hover:underline">Match schedule</Link>
          <Link to="/admin/persons" className="text-gray-700 dark:text-gray-300 hover:underline">Persons</Link>
          <Link to="/admin/capabilities" className="text-gray-700 dark:text-gray-300 hover:underline">Capabilities</Link>
          <Link to="/admin/clubs" className="text-gray-700 dark:text-gray-300 hover:underline">Clubs</Link>
          <Link to="/admin/qr" className="text-gray-700 dark:text-gray-300 hover:underline">QR Generator</Link>
          <Link to="/admin/productions" className="text-gray-700 dark:text-gray-300 hover:underline">Productions</Link>
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
            <Route path="/admin/clubs" element={<ClubsPage />} />
            <Route path="/admin/qr" element={<QRAdminPage />} />
            <Route path="/admin/productions" element={<ProductionsAdminPage />} />
            <Route path="/admin/productions/:id" element={<ProductionDetailPage />} />
            <Route path="/vmix/sponsor-rows" element={<SponsorRowsPage />} />
          </Routes>
        </main>
      </div>
    </ThemeProvider>
  );
}

export default App;
