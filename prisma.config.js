module.exports = {
  // Keep only schema here to avoid module resolution issues
  schema: 'apps/korfbal-stream-api/prisma/schema.prisma',
  migrations: {
    // With a prisma config file, `prisma db seed` only reads the seed command from here
    // (package.json's "prisma.seed" is ignored), so without it seeding silently does nothing.
    seed: 'tsx apps/korfbal-stream-api/prisma/seed.ts',
  },
};
