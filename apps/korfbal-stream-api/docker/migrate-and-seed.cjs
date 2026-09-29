// One-off container job: apply Prisma migrations, then run the seed.
// The hardened runtime image has no shell, so this replaces the former `sh -c "..."` command.
const {execFileSync} = require('node:child_process');

const SCHEMA = '/app/apps/korfbal-stream-api/prisma/schema.prisma';

function run(label, args) {
  console.log(`=== Starting ${label} ===`);
  execFileSync(process.execPath, args, {stdio: 'inherit'});
  console.log(`=== ${label} completed successfully ===`);
}

try {
  const prismaCli = require.resolve('prisma/build/index.js', {paths: ['/app']});
  run('Prisma migration', [prismaCli, 'migrate', 'deploy', `--schema=${SCHEMA}`]);
  // SKIP_SEED=true: only migrate, e.g. on a database restored from a backup whose data the seed
  // (which updates persons, sponsors and templates) must not touch.
  if (process.env.SKIP_SEED === 'true') console.log('=== Seed skipped (SKIP_SEED=true) ===');
  else run('seed', ['/app/seed/prisma/seed.js']);
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
