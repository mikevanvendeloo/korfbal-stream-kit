import React, { useState } from 'react';
import ClubSettingsTab from './settings/ClubSettingsTab';
import ConnectionSettingsTab from './settings/ConnectionSettingsTab';
import SponsorSettingsTab from './settings/SponsorSettingsTab';

type Tab = 'club' | 'connections' | 'sponsors';

const TABS: { id: Tab; label: string }[] = [
  { id: 'club', label: 'Club & Teams' },
  { id: 'connections', label: 'Koppelingen' },
  { id: 'sponsors', label: 'Sponsors' },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('club');

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'club':
        return <ClubSettingsTab />;
      case 'connections':
        return <ConnectionSettingsTab />;
      case 'sponsors':
        return <SponsorSettingsTab />;
      default:
        return null;
    }
  };

  return (
    <div className="container py-6 max-w-4xl">
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Instellingen</h1>

      <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-6 py-3 font-medium text-sm transition-colors whitespace-nowrap ${
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
