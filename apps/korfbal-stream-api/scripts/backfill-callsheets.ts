import 'dotenv/config';
import { PrismaClient } from '@korfbal-stream-kit/prisma';
import { createPrismaAdapter } from '../src/services/prismaAdapter';

const prisma = new PrismaClient({adapter: createPrismaAdapter()});

async function main() {
  const prods = await prisma.production.findMany({ select: { id: true } });
  let created = 0;
  for (const p of prods) {
    const count = await prisma.callSheet.count({ where: { productionId: p.id } });
    if (count === 0) {
      await prisma.callSheet.create({ data: { productionId: p.id, name: 'Callsheet' } });
      created++;
      console.log(`Created default callsheet for production ${p.id}`);
    }
  }
  console.log(`Done. Created ${created} callsheet(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
