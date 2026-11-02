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
  // SKIP_SEED=true: only migrate. The seed only adds (the current season and missing standard roles),
  // so it is safe on a restored backup too; the switch stays for a migration without any seed.
  if (process.env.SKIP_SEED === 'true') console.log('=== Seed skipped (SKIP_SEED=true) ===');
  else run('seed', ['/app/seed/prisma/seed.js']);
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
