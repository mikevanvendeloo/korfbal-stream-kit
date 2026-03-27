/**
 * Seed-script om een volledige callsheet voor een specifieke productie te vullen.
 * Gebruik: tsx scripts/seed-callsheet.ts
 */
import {Position, PrismaClient, TriggerSource} from '@prisma/client';
import {logger} from '../apps/korfbal-stream-api/src/utils/logger';

const prisma = new PrismaClient();

// --- CONFIGURATIE ---
const PRODUCTION_ID = 2; // De ID van de productie die je wilt vullen

// Helper om tijd (HH:MM:SS) om te zetten naar een numerieke order
const timeToOrder = (time: string) => {
  const [h, m, s] = time.split(':').map(Number);
  return h * 3600 + m * 60 + s;
};

// Helper om duur (MM:SS.ms) om te zetten naar seconden
const durationToSeconds = (duration: string) => {
  const [minutes, seconds] = duration.split(':').map(parseFloat);
  return (minutes * 60) + seconds;
};

// De gecombineerde en gestructureerde data uit jouw lijsten
const unifiedCallSheetData = [
  { time: '17:13:00', duration: '01:17.0', title: 'Meekijken met klok voor start muziek', positions: ['Muziek'] },
  { time: '17:14:17', duration: '05:43.0', title: 'Opwarm muziek', positions: ['Muziek'] },
  { time: '17:14:17', title: 'Regisseur geeft aan: afronden voorspelling op 3 min', positions: ['Regie livestream'], note: 'Tijd voor commentatoren om naar een conclusie te werken.' },
  { time: '17:18:30', title: 'Afronden en start commercials op 1:30', positions: ['Regie livestream'] },
  { time: '17:19:30', title: 'Zaallampen aftellen (10s, 5s, 0)', positions: ['Muziek'] },
  { time: '17:19:30', title: 'Opstellen teams muziek aan', positions: ['Muziek'], note: 'Dit is opvulmuziek tot de oploopfilm start.' },
  { time: '17:20:00', duration: '01:00.0', title: 'Start oploopfilm', positions: ['Regie livestream', 'Muziek'], trigger: TriggerSource.VMIX, vmixInput: 'OploopFilm' },
  { time: '17:21:00', title: 'Check geluid speaker (unmute en schuif open)', positions: ['Muziek'] },
  { time: '17:21:00', title: 'Na oploopfilm, "Opstellen teams" muziek weer aan', positions: ['Muziek'] },
  { time: '17:21:00', duration: '03:00.0', title: 'Geef signaal aan speaker voor prietpraat na 15s', positions: ['Muziek'] },
  { time: '17:21:00', title: 'Regisseur geeft commentatoren aan dat ze kunnen beginnen', positions: ['Regie livestream'] },
  { time: '17:21:00', title: 'Regisseur toont opstellingen', positions: ['Regie livestream'] },
  { time: '17:24:00', title: 'Check audio licht-PC unmuted', positions: ['Muziek'] },
  { time: '17:24:00', duration: '00:15.0', title: 'Start oploop muziek tegenstander', positions: ['Muziek'] },
  { time: '17:24:00', title: 'Regisseur stopt commentatoren', positions: ['Regie livestream'] },
  { time: '17:24:00', title: 'Regisseur telt af start oplopen', positions: ['Regie livestream'] },
  { time: '17:24:15', title: 'Signaal aan speaker (lamp op deuropening)', positions: ['Muziek'] },
  { time: '17:24:15', duration: '02:00.0', title: 'Oplopen tegenstander door speaker', positions: ['Muziek'], note: 'Volume op 100%, terug naar 70% als speaker praat.' },
  { time: '17:26:15', title: 'Start oploop muziek Fortuna', positions: ['Muziek'] },
  { time: '17:26:15', duration: '02:00.0', title: 'Oplopen Fortuna door speaker', positions: ['Muziek'] },
  { time: '17:28:15', duration: '00:30.0', title: 'Oplopen scheidsrechters (Fortuna muziek loopt door)', positions: ['Muziek'] },
  { time: '17:28:45', title: 'Scheidsrechters in midden, zaallampen aan', positions: ['Muziek'] },
  { time: '17:29:15', duration: '00:30.0', title: 'Muziek "na oplopen" aan', positions: ['Muziek'] },
  { time: '17:29:15', title: 'Tonen en melden wedstrijdsponsor', positions: ['Regie livestream'] },
  { time: '17:29:45', duration: '01:00.0', title: 'Zaallicht op wedstrijd niveau', positions: ['Muziek'] },
  { time: '17:29:45', title: 'Teams geven elkaar hand', positions: ['Regie livestream'] },
  { time: '17:30:00', title: 'Muziek uitfaden naar influiten', positions: ['Muziek'] },
  { time: '17:30:00', title: 'Start wedstrijd', positions: ['Regie livestream'], vmixInput: "START" },

];

async function main() {
  logger.info('--- Starting Call Sheet Seeder ---');

  // 1. Vind of creëer de benodigde posities
  // Gebruik hier de exacte namen van de posities die in uw database bestaan of die u wilt aanmaken
  const positionNames = ['Muziek', 'Regie livestream'];
  const positions: Record<string, Position> = {};
  for (const name of positionNames) {
    let pos = await prisma.position.findUnique({ where: { name } });
    if (!pos) {
      pos = await prisma.position.create({ data: { name } });
      logger.info(`Created position: ${name}`);
    }
    positions[name] = pos;
  }

  // 2. Verwijder oude events voor deze productie om duplicaten te voorkomen
  await prisma.productionEvent.deleteMany({ where: { productionId: PRODUCTION_ID } });
  logger.info(`Cleared old events for Production ID: ${PRODUCTION_ID}`);

  // 3. Creëer de nieuwe events
  for (const item of unifiedCallSheetData) {
    // Zorg ervoor dat alle posities die in item.positions staan, ook daadwerkelijk bestaan in de 'positions' map
    const connectedPositions = item.positions.map(posName => {
      const pos = positions[posName];
      if (!pos) {
        throw new Error(`Position "${posName}" not found or created. Please check positionNames array.`);
      }
      return { position: { connect: { id: pos.id } } };
    });

    const event = await prisma.productionEvent.create({
      data: {
        productionId: PRODUCTION_ID,
        title: item.title,
        note: item.note,
        order: timeToOrder(item.time),
        durationSec: item.duration ? durationToSeconds(item.duration) : 0,
        triggerSource: item.trigger || TriggerSource.MANUAL,
        vMixInputName: item.vmixInput,
        positions: {
          create: connectedPositions,
        },
      },
    });
    logger.info(`Created event: "${event.title}" at order ${event.order}`);
  }

  logger.info('--- Seeding complete! ---');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
