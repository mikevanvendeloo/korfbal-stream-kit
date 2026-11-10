import {logger} from './logger';
import {createApp} from './server';
import {ApiConnection} from './services/apiConnection';
import {ConfigCache} from './services/configCache';
import {DeviceReaders} from './services/deviceReaders';
import {installMdbReader} from './services/mdbReader';
import {handleStatsRequest, teamOfPath} from './services/statsHandler';
import {VmixClient} from './services/vmixClient';
import {loadStartSettings, StartSettingsError, type StartSettings} from './startSettings';

function startSettingsOrExit(): StartSettings {
  try {
    return loadStartSettings();
  } catch (err) {
    // Only the messages of the missing settings, never their values (the key stays out of the log)
    logger.error(err instanceof StartSettingsError ? err.message : 'Ongeldige start-instellingen');
    return process.exit(1);
  }
}

const settings = startSettingsOrExit();
const version = process.env.APP_VERSION || '0.0.0-dev';

// The Access adapter (mdb-reader in a worker thread); without a database it is simply never used
installMdbReader();

// The cached configuration (if valid) applies at once; else nothing is read until the API sends one
const cache = new ConfigCache(settings.configFile);
cache.loadFromFile();
const vmix = new VmixClient(() => cache.config?.vmix);

const connection: ApiConnection = new ApiConnection(settings, version, {
  applyConfig: (raw) => cache.apply(raw),
  statsRequest: (path) => {
    const team = teamOfPath(path);
    if (team) cache.rememberTeam(team);
    return handleStatsRequest(path);
  },
  vmixCall: (request) => vmix.call(request),
  vmixInputs: (request) => vmix.inputs(request),
  onConnected: () => readers.resendAll(),
});
const readers = new DeviceReaders({getConfig: () => cache.config, onReading: (reading) => connection.sendReading(reading)});

const app = createApp({
  name: settings.name, version, apiKey: settings.apiKey, cache, readers, vmix,
  getApi: () => connection.state, getConfigState: () => cache.state, getConfig: () => cache.config,
});
app.listen(settings.port, settings.host, () => {
  logger.info(`Venue-bridge listening on ${settings.host}:${settings.port}`, {name: settings.name, version, configuration: cache.state.state});
});
readers.start();
connection.start();
