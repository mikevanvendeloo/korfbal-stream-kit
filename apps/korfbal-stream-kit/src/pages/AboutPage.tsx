import {useBackendVersion} from '../hooks/useSettings';
import AppLogo from '../components/AppLogo';

// This will be replaced by the build process if configured, otherwise fallback
const FRONTEND_VERSION = import.meta.env.VITE_APP_VERSION || '0.0.0-dev';

export default function AboutPage() {
  const {data: backend, isLoading, error} = useBackendVersion();

  return (
    <div className="container py-6 text-gray-800 dark:text-gray-100 flex flex-col items-center">
      <AppLogo className="w-32 h-32 mb-6" />
      <h1 className="text-2xl font-bold mb-6">Over Korfbal Stream Kit</h1>

      <div className="bg-white dark:bg-gray-900 p-6 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 w-full max-w-md">
        <div className="space-y-4">
          <div className="flex justify-between items-center border-b border-gray-100 dark:border-gray-800 pb-3">
            <span className="font-medium text-gray-600 dark:text-gray-400">Frontend Versie</span>
            <span className="font-mono font-bold">{FRONTEND_VERSION}</span>
          </div>

          <div className="flex justify-between items-center pt-1">
            <span className="font-medium text-gray-600 dark:text-gray-400">Backend Versie</span>
            {isLoading ? (
              <span className="text-gray-400 text-sm animate-pulse">Laden...</span>
            ) : <span />}
            {error ? (
              <span className="text-red-500 text-sm">Niet beschikbaar</span>
            ) : (
              <span className="font-mono font-bold">{backend?.version}</span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400 max-w-lg">
        <p>
          Deze applicatie is ontwikkeld om korfbal livestreams te ondersteunen met data, graphics en planning.
        </p>
        <p className="mt-2">
          &copy; {new Date().getFullYear()} Korfbal Stream Kit
        </p>
      </div>
    </div>
  );
}
