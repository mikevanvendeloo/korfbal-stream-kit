import { execSync } from 'node:child_process';
import { logger } from './utils/logger';
import app from './main';
import { config } from './services/config';

function run(cmd: string) {
  logger.info({ msg: 'exec', cmd });
  execSync(cmd, { stdio: 'inherit' });
}

async function main() {
  try {
    // Apply migrations and seed before starting the server (idempotent)
    run('npx prisma migrate deploy --schema=apps/korfbal-stream-api/prisma/schema.prisma');
    run('npx prisma db seed --schema=apps/korfbal-stream-api/prisma/schema.prisma');
  } catch (e) {
    logger.error('Startup DB prepare failed', e as any);
  }

  const port = config.port;
  app.listen(port, () => {
    logger.info({ msg: `API listening on http://0.0.0.0:${port}` });
  });
}

main();
