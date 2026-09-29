// Build-time helper (runs in the -dev build stage, after `pnpm install --prod` + `prisma generate`).
// Copies the Prisma engines of the installed @prisma/client and their OpenSSL libraries to a fixed
// directory, so the shell-less hardened runtime image needs no Prisma platform detection:
// the Dockerfile points PRISMA_QUERY_ENGINE_LIBRARY / PRISMA_SCHEMA_ENGINE_BINARY / LD_LIBRARY_PATH at it.
const fs = require('node:fs');
const path = require('node:path');

const APP = '/app';
const OUT = process.argv[2] || '/prisma-runtime';

const clientDir = fs.realpathSync(path.dirname(require.resolve('@prisma/client/package.json', {paths: [APP]})));
const generatedDir = path.join(clientDir, '..', '..', '.prisma', 'client');
const prismaDir = fs.realpathSync(path.dirname(require.resolve('prisma/package.json', {paths: [APP]})));
const enginesDir = fs.realpathSync(path.dirname(require.resolve('@prisma/engines/package.json', {paths: [prismaDir]})));

function findOne(dir, re) {
  const matches = fs.readdirSync(dir).filter((f) => re.test(f));
  if (matches.length !== 1) throw new Error(`Expected exactly one ${re} in ${dir}, found: ${matches.join(', ') || 'none'}`);
  return path.join(dir, matches[0]);
}

const queryEngine = findOne(generatedDir, /^libquery_engine-linux-musl.*openssl-3\.0\.x\.so\.node$/);
const schemaEngine = findOne(enginesDir, /^schema-engine-linux-musl.*openssl-3\.0\.x$/);

fs.mkdirSync(path.join(OUT, 'lib'), {recursive: true});
fs.copyFileSync(queryEngine, path.join(OUT, 'libquery_engine.so.node'));
fs.copyFileSync(schemaEngine, path.join(OUT, 'schema-engine'));
fs.chmodSync(path.join(OUT, 'schema-engine'), 0o755);

// OpenSSL 3 libraries the *-openssl-3.0.x engines link against; the minimal runtime image may not
// ship them. (No ldd here: the hardened -dev image has no musl-utils.)
const LIB_DIRS = ['/usr/lib', '/lib'];
const libs = ['libssl.so.3', 'libcrypto.so.3'].map((name) => {
  const dir = LIB_DIRS.find((d) => fs.existsSync(path.join(d, name)));
  if (!dir) throw new Error(`${name} not found in ${LIB_DIRS.join(', ')} (is the openssl package installed?)`);
  return path.join(dir, name);
});
for (const lib of libs) fs.copyFileSync(fs.realpathSync(lib), path.join(OUT, 'lib', path.basename(lib)));

console.log('Prisma runtime collected:', {queryEngine, schemaEngine, libs});
