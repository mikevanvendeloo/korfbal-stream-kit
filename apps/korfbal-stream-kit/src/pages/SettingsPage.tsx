import {useSearchParams} from 'react-router-dom';
import SeasonSettingsTab from './settings/SeasonSettingsTab';
import ClubSettingsTab from './settings/ClubSettingsTab';
import VenueSettingsTab from './settings/VenueSettingsTab';
import SponsorSettingsTab from './settings/SponsorSettingsTab';
import BackupSettingsTab from './settings/BackupSettingsTab';

type Tab = 'season' | 'club' | 'venue' | 'sponsors' | 'backup';

const TABS: { id: Tab; label: string }[] = [
  { id: 'season', label: 'Seizoen' },
  { id: 'club', label: 'Club & Teams' },
  { id: 'venue', label: 'Venue' },
  { id: 'sponsors', label: 'Sponsors' },
  { id: 'backup', label: 'Backup' },
];

export default function SettingsPage() {
  // ?tab=venue opens a tab directly (the bridge indicator in the top bar links to it)
  const [params, setParams] = useSearchParams();
  const requested = params.get('tab');
  const activeTab: Tab = TABS.some((t) => t.id === requested) ? (requested as Tab) : 'season';
  const setActiveTab = (tab: Tab) => setParams(tab === 'season' ? {} : {tab}, {replace: true});

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'season':
        return <SeasonSettingsTab />;
      case 'club':
        return <ClubSettingsTab />;
      case 'venue':
        return <VenueSettingsTab />;
      case 'sponsors':
        return <SponsorSettingsTab />;
      case 'backup':
        return <BackupSettingsTab />;
      default:
        return null;
    }
  };

  return (
    <div className="container py-6 max-w-4xl">
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Instellingen</h1>

      <div className="flex overflow-x-auto border-b border-gray-200 dark:border-gray-700 mb-6">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 sm:px-6 py-3 font-medium text-sm transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? 'border-b-2 border-blue-600 text-blue-600 dark:text-blue-400'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div>
        {renderActiveTab()}
      </div>
    </div>
  );
}
