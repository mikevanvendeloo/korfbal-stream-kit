/**
 * Seed-script om een volledige callsheet en de bijbehorende live events voor een specifieke productie te vullen.
 * Gebruik: tsx scripts/seed-callsheet.ts
 */
import {Position, PrismaClient, TriggerSource} from '@prisma/client';
import {logger} from '../apps/korfbal-stream-api/src/utils/logger';
import {v4 as uuidv4} from 'uuid';

const prisma = new PrismaClient();

// --- CONFIGURATIE ---
const PRODUCTION_ID = 9; // De ID van de productie die je wilt vullen

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
  // Nieuwe livestream regie volgorde
  { time: '17:00:00', duration: '00:15.0', title: 'Thumbnail neerzetten', positions: ['Regie livestream'], isInLivestream: true, isInVenue: false },
  { time: '17:00:15', duration: '00:00.0', title: 'Livestream starten', positions: ['Regie livestream'], isInLivestream: true, isInVenue: false },
  { time: '17:00:15', duration: '00:48.0', title: 'Intro filmpje starten', positions: ['Regie livestream'], isInLivestream: true, isInVenue: false },
  { time: '17:01:03', duration: '00:00.0', title: 'Regisseur zet microfoon presentator open', positions: ['Regie livestream'], isInLivestream: true, isInVenue: false },
  { time: '17:01:03', duration: '00:15.0', title: 'Presentator heet publiek welkom', positions: ['Regie livestream'], isInLivestream: true, isInVenue: false },
  { time: '17:01:18', duration: '00:53.0', title: 'KL promo afspelen', positions: ['Regie livestream'], isInLivestream: true, isInVenue: false },
  { time: '17:02:11', duration: '02:30.0', title: 'Presentator & Analist gesprek', positions: ['Regie livestream'], isInLivestream: true, isInVenue: false },
  { time: '17:04:41', duration: '00:35.0', title: 'Reclame', positions: ['Regie livestream'], isInLivestream: true, isInVenue: false },
  { time: '17:05:16', duration: '03:00.0', title: 'Interview met uit coach', positions: ['Regie livestream'], isInLivestream: true, isInVenue: false },
  { time: '17:08:16', duration: '03:00.0', title: 'Interview met thuis coach', positions: ['Regie livestream'], isInLivestream: true, isInVenue: false },
  { time: '17:11:16', duration: '01:45.0', title: 'Nabeschouwing en voorspelling', positions: ['Regie livestream'], isInLivestream: true, isInVenue: false },
  { time: '17:13:01', duration: '00:35.0', title: 'Reclame', positions: ['Regie livestream'], isInLivestream: true, isInVenue: false },
  { time: '17:13:36', duration: '00:00.0', title: 'Licht uit', positions: ['Regie livestream', 'Muziek'], isInLivestream: true, isInVenue: true },
  { time: '17:13:36', duration: '02:00.0', title: 'Commentatoren praten over wedstrijd (opstellingen)', positions: ['Regie livestream'], isInLivestream: true, isInVenue: false },
  { time: '17:13:36', duration: '03:00.0', title: 'Speaker prietpraat', positions: ['Muziek'], isInLivestream: false, isInVenue: true },
  { time: '17:16:36', duration: '00:42.0', title: 'Start oploopfilm', positions: ['Regie livestream', 'Muziek'], trigger: TriggerSource.VMIX, vmixInput: 'OploopFilm', isInLivestream: true, isInVenue: true },
  { time: '17:17:36',  duration: '00:00.0',title: 'Check geluid speaker (unmute en schuif open)', positions: ['Muziek'], isInLivestream: true, isInVenue: true },
  { time: '17:17:36',  duration: '00:00.0',title: 'Na oploopfilm, "Opstellen teams" muziek weer aan', positions: ['Muziek'], isInLivestream: false, isInVenue: true },
  { time: '17:17:36', duration: '03:00.0', title: 'Geef signaal aan speaker voor prietpraat na 15s', positions: ['Muziek'], isInLivestream: false, isInVenue: true },
  { time: '17:17:36',  duration: '00:00.0',title: 'Regisseur geeft commentatoren aan dat ze kunnen beginnen', positions: ['Regie livestream'], isInLivestream: true, isInVenue: false },
  { time: '17:17:36',  duration: '00:00.0',title: 'Regisseur toont opstellingen', positions: ['Regie livestream'], isInLivestream: true, isInVenue: false },
  { time: '17:20:36',  duration: '00:00.0',title: 'Check audio licht-PC unmuted', positions: ['Muziek'], isInLivestream: false, isInVenue: true },
  { time: '17:20:36', duration: '00:30.0',title: 'Regisseur stopt commentatoren', positions: ['Regie livestream'], isInLivestream: true, isInVenue: false },
  { time: '17:20:36', duration: '00:15.0', title: 'Start oploop muziek tegenstander', positions: ['Muziek'], isInLivestream: false, isInVenue: true },
  { time: '17:20:36', duration: '00:03.0',title: 'Regisseur telt af start oplopen', positions: ['Regie livestream'], isInLivestream: true, isInVenue: true },
  { time: '17:20:51', duration: '00:15.0',title: 'Signaal aan speaker (lamp op deuropening)', positions: ['Muziek'], isInLivestream: false, isInVenue: true },
  { time: '17:20:51', duration: '02:00.0', title: 'Oplopen tegenstander door speaker', positions: ['Muziek'], note: 'Volume op 100%, terug naar 70% als speaker praat.', isInLivestream: true, isInVenue: true },
  { time: '17:22:51', duration: '00:15.0',title: 'Start oploop muziek Fortuna', positions: ['Muziek'], isInLivestream: false, isInVenue: true },
  { time: '17:22:51', duration: '02:00.0', title: 'Oplopen Fortuna door speaker', positions: ['Muziek'], isInLivestream: true, isInVenue: true },
  { time: '17:24:51', duration: '00:30.0', title: 'Oplopen scheidsrechters (Fortuna muziek loopt door)', positions: ['Muziek'], isInLivestream: true, isInVenue: true },
  { time: '17:25:21', duration: '00:00.0', title: 'Scheidsrechters in midden, zaallampen aan', positions: ['Muziek'], isInLivestream: true, isInVenue: true },
  { time: '17:25:51', duration: '00:00.0', title: 'Muziek "na oplopen" aan', positions: ['Muziek'], isInLivestream: true, isInVenue: true },
  { time: '17:25:51', duration: '00:30.0', title: 'Tonen en melden wedstrijdsponsor', positions: ['Regie livestream'], isInLivestream: true, isInVenue: false },
  { time: '17:26:21', duration: '00:00.0', title: 'Zaallicht op wedstrijd niveau', positions: ['Muziek'], isInLivestream: true, isInVenue: true },
  { time: '17:26:21', duration: '00:30.0', title: 'Teams geven elkaar hand', positions: ['Regie livestream'], isInLivestream: true, isInVenue: true },
  { time: '17:30:00', duration: '00:00.0', title: 'Muziek uitfaden naar influiten', positions: ['Muziek'], isInLivestream: false, isInVenue: true },
  { time: '17:30:00', duration: '00:00.0', title: 'Start wedstrijd', positions: ['Regie livestream'], vmixInput: "START", isInLivestream: true, isInVenue: true },
];

async function main() {
  logger.info('--- Starting Call Sheet Seeder ---');

  // 1. Vind of creëer de benodigde posities
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

  // --- AANMAKEN VAN CALLSHEET (PLANNING) ---

  // 2. Vind of creëer een callsheet voor deze productie
  let callSheet = await prisma.callSheet.findFirst({
    where: { productionId: PRODUCTION_ID, name: 'Standaard Callsheet' },
  });
  if (!callSheet) {
    callSheet = await prisma.callSheet.create({
      data: { productionId: PRODUCTION_ID, name: 'Standaard Callsheet' },
    });
    logger.info(`Created CallSheet: "Standaard Callsheet" for Production ID: ${PRODUCTION_ID}`);
  }

  // 3. Verwijder oude callsheet items voor deze callsheet
  await prisma.callSheetItem.deleteMany({ where: { callSheetId: callSheet.id } });
  logger.info(`Cleared old CallSheetItems for CallSheet ID: ${callSheet.id}`);

  // 4. Zorg dat er minstens één ProductionSegment bestaat
  let productionSegment = await prisma.productionSegment.findFirst({
    where: { productionId: PRODUCTION_ID },
    orderBy: { volgorde: 'asc' },
  });
  if (!productionSegment) {
    productionSegment = await prisma.productionSegment.create({
      data: {
        productionId: PRODUCTION_ID,
        naam: 'Algemeen Segment',
        volgorde: 1,
        duurInMinuten: 60,
      },
    });
    logger.info(`Created default ProductionSegment for Production ID: ${PRODUCTION_ID}`);
  }

  // --- AANMAKEN VAN LIVE EVENTS (EXECUTIE) ---

  // 5. Verwijder oude live events voor deze productie
  await prisma.productionEvent.deleteMany({ where: { productionId: PRODUCTION_ID } });
  logger.info(`Cleared old ProductionEvents for Production ID: ${PRODUCTION_ID}`);


  // 6. Creëer de nieuwe items voor zowel CallSheet als ProductionEvent
  let orderIndex = 0;
  for (const item of unifiedCallSheetData) {
    const durationSec = item.duration ? durationToSeconds(item.duration) : null;
    const timeStart = new Date(`1970-01-01T${item.time}Z`);
    const timeEnd = durationSec ? new Date(timeStart.getTime() + durationSec * 1000) : undefined;

    // Maak CallSheetItem (voor de planning)
    await prisma.callSheetItem.create({
      data: {
        id: uuidv4(),
        callSheetId: callSheet.id,
        productionSegmentId: productionSegment.id,
        cue: item.title,
        title: item.title,
        note: (item as any).note,
        durationSec: durationSec ?? 0,
        orderIndex: orderIndex++,
        timeStart: timeStart,
        timeEnd: timeEnd,
        isInLivestream: (item as any).isInLivestream !== undefined ? (item as any).isInLivestream : true,
        isInVenue: (item as any).isInVenue !== undefined ? (item as any).isInVenue : true,
        positions: {
          create: item.positions.map(posName => ({
            positionId: positions[posName].id
          })),
        },
      },
    });

    // Maak ProductionEvent (voor de live executie)
    await prisma.productionEvent.create({
      data: {
        productionId: PRODUCTION_ID,
        title: item.title,
        note: (item as any).note,
        order: timeToOrder(item.time),
        durationSec: durationSec,
        triggerSource: (item as any).trigger || TriggerSource.MANUAL,
        vMixInputName: (item as any).vmixInput,
        positions: {
          create: item.positions.map(posName => ({
            positionId: positions[posName].id
          })),
        },
      },
    });
  }

  logger.info('--- Seeding complete for both CallSheetItems and ProductionEvents! ---');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
