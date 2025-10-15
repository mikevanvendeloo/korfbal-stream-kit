import { Route, Routes, Link } from 'react-router-dom';
import SponsorsPage from '../pages/SponsorsPage';
import { ThemeProvider, useTheme } from '../theme/ThemeProvider';

function Nav() {
  const { theme, toggle } = useTheme();
  return (
    <header className="border-b border-gray-200 dark:border-gray-800">
      <div className="container flex items-center justify-between py-3">
        <nav className="flex items-center gap-4 text-sm">
          <Link to="/" className="font-semibold text-gray-900 dark:text-gray-100">Korfbal Stream Kit</Link>
          <Link to="/sponsors" className="text-gray-700 dark:text-gray-300 hover:underline">Sponsors</Link>
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
            <Route path="/" element={<div className="container py-6 text-gray-800 dark:text-gray-100">Welkom! Ga naar <Link className="underline" to="/sponsors">Sponsors</Link>.</div>} />
            <Route path="/sponsors" element={<SponsorsPage />} />
          </Routes>
        </main>
      </div>
    </ThemeProvider>
  );
}

export default App;
