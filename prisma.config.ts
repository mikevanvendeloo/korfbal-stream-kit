export default {
  schema: 'apps/korfbal-stream-api/prisma/schema.prisma',
  seed: 'node -r @swc-node/register apps/korfbal-stream-api/prisma/seed.ts',
};
