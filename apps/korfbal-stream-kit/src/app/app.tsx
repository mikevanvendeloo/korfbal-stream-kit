import {lazy, Suspense} from 'react';
import {Route, Routes} from 'react-router-dom';
import {ThemeProvider} from '../theme/ThemeProvider';
import {FontSizeProvider} from '../hooks/useFontSize';
import LiveApp from './LiveApp';

// Beheer is loaded on demand, so the LIVE app doesn't download the admin pages
const AdminApp = lazy(() => import('./AdminApp'));

/** Two apps in one build: LIVE on the root, Beheer under /admin. */
export function App() {
  return (
    <ThemeProvider>
      <FontSizeProvider>
        <div className="min-h-screen bg-white dark:bg-gray-950">
          <Routes>
            <Route path="/admin/*" element={
              <Suspense fallback={<div className="container py-6 text-gray-800 dark:text-gray-100">Laden…</div>}>
                <AdminApp/>
              </Suspense>
            }/>
            <Route path="/*" element={<LiveApp/>}/>
          </Routes>
        </div>
      </FontSizeProvider>
    </ThemeProvider>
  );
}

export default App;
