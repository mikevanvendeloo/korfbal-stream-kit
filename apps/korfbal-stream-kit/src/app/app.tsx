import {lazy, Suspense} from 'react';
import {Route, Routes} from 'react-router-dom';
import {ThemeProvider} from '../theme/ThemeProvider';
import {FontSizeProvider} from '../hooks/useFontSize';
import LiveApp from './LiveApp';
import {OrganizationGate} from '../components/OrganizationGate';

// Beheer is loaded on demand, so the LIVE app doesn't download the admin pages
const AdminApp = lazy(() => import('./AdminApp'));

/** Two apps in one build: LIVE on the root, Beheer under /admin, both for the chosen organization. */
export function App() {
  return (
    <ThemeProvider>
      <FontSizeProvider>
        <div className="min-h-screen bg-white dark:bg-gray-950">
          {/* Nothing without a chosen organization: the start screen comes first (same URLs) */}
          <OrganizationGate>
            <Routes>
              <Route path="/admin/*" element={
                <Suspense fallback={<div className="container py-6 text-gray-800 dark:text-gray-100">Laden…</div>}>
                  <AdminApp/>
                </Suspense>
              }/>
              <Route path="/*" element={<LiveApp/>}/>
            </Routes>
          </OrganizationGate>
        </div>
      </FontSizeProvider>
    </ThemeProvider>
  );
}

export default App;
