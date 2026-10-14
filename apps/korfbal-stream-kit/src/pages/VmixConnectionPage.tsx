import VmixCallsheetPushSettings from '../components/VmixCallsheetPushSettings';
import VmixInstancesSettings from '../components/VmixInstancesSettings';

/** Beheer: how the kit reaches vMix. Operating it during the broadcast happens in LIVE (/vmix). */
export default function VmixConnectionPage() {
  return (
    <div className="container py-6">
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">vMix-koppeling</h1>

      <div className="mt-6">
        <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">vMix-pc's</h2>
        <VmixInstancesSettings/>
      </div>

      <div className="mt-10">
        <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">Callsheet naar vMix (presentator & analist)</h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Huidig en volgend callsheet item met resterende tijd naar een vMix title, met oranje/rode achtergrond als de tijd (bijna) op is.</p>
        <VmixCallsheetPushSettings/>
      </div>
    </div>
  );
}
