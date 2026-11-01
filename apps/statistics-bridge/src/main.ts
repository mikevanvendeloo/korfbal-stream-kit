import {createApp} from './app';
import {config} from './config';
import {logger} from './logger';
import {installMdbReader} from './services/mdbReader';

// The Access adapter (mdb-reader in a worker thread); without a database it is simply never used
installMdbReader();

const app = createApp();
app.listen(config.port, () => {
  logger.info(`Statistics bridge listening on port ${config.port}`, {
    database: config.mdbEnabled ? 'enabled' : 'disabled',
    page: config.pageUrl ? 'configured' : 'not set',
    token: config.bridgeToken ? 'required' : 'off',
  });
});
