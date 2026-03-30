/**
 * Seed-script om een volledige callsheet en de bijbehorende live events voor een specifieke productie te vullen.
 * Gebruik: tsx scripts/seed-callsheet.ts
 */
import {Position, PrismaClient} from '@prisma/client';
import {logger} from '../apps/korfbal-stream-api/src/utils/logger';
import {v4 as uuidv4} from 'uuid';

const prisma = new PrismaClient();

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
  {
    "title": "Thumbnail neerzetten",
    "durationSec": 15,
    "orderIndex": 0,
    "isInVenue": false,
    "isInLivestream": true,
    "isTimeAnchor": false,
    "anchorType": null,
    "autoAdvance": true,
    "type": "MANUAL",
    "positions": [
      "Regie livestream",
      "Showcaller"
    ]
  },
  {
    "title": "Livestream starten",
    "durationSec": 0,
    "orderIndex": 1,
    "isInVenue": false,
    "isInLivestream": true,
    "isTimeAnchor": true,
    "anchorType": "LIVESTREAM_START",
    "autoAdvance": true,
    "type": "MANUAL",
    "positions": [
      "Regie livestream",
      "Showcaller"
    ]
  },
  {
    "title": "Intro filmpje starten",
    "durationSec": 48,
    "orderIndex": 2,
    "isInVenue": false,
    "isInLivestream": true,
    "isTimeAnchor": false,
    "anchorType": null,
    "autoAdvance": true,
    "type": "MANUAL",
    "positions": [
      "Regie livestream",
      "Showcaller"
    ]
  },
  {
    "title": "Regisseur zet microfoon presentator open",
    "durationSec": 0,
    "orderIndex": 3,
    "isInVenue": false,
    "isInLivestream": true,
    "isTimeAnchor": false,
    "anchorType": null,
    "autoAdvance": true,
    "type": "MANUAL",
    "positions": [
      "Regie livestream",
      "Presentatie",
      "Showcaller"
    ]
  },
  {
    "title": "Presentator heet publiek welkom",
    "durationSec": 15,
    "orderIndex": 4,
    "isInVenue": false,
    "isInLivestream": true,
    "isTimeAnchor": false,
    "anchorType": null,
    "autoAdvance": false,
    "type": "MANUAL",
    "positions": [
      "Regie livestream",
      "Presentatie",
      "Showcaller"
    ]
  },
  {
    "title": "KL promo afspelen",
    "durationSec": 53,
    "orderIndex": 5,
    "isInVenue": false,
    "isInLivestream": true,
    "isTimeAnchor": false,
    "anchorType": null,
    "autoAdvance": true,
    "type": "MANUAL",
    "positions": [
      "Regie livestream",
      "Showcaller"
    ]
  },
  {
    "title": "Presentator & Analist gesprek",
    "durationSec": 150,
    "orderIndex": 6,
    "isInVenue": false,
    "isInLivestream": true,
    "isTimeAnchor": false,
    "anchorType": null,
    "autoAdvance": false,
    "type": "MANUAL",
    "positions": [
      "Regie livestream",
      "Showcaller"
    ]
  },
  {
    "title": "Reclame",
    "durationSec": 35,
    "orderIndex": 7,
    "isInVenue": false,
    "isInLivestream": true,
    "isTimeAnchor": false,
    "anchorType": null,
    "autoAdvance": true,
    "type": "MANUAL",
    "positions": [
      "Regie livestream",
      "Presentatie",
      "Showcaller"
    ]
  },
  {
    "title": "Interview met uit coach",
    "durationSec": 180,
    "orderIndex": 8,
    "isInVenue": false,
    "isInLivestream": true,
    "isTimeAnchor": false,
    "anchorType": null,
    "autoAdvance": false,
    "type": "MANUAL",
    "positions": [
      "Regie livestream",
      "Presentatie",
      "Showcaller"
    ]
  },
  {
    "title": "Interview met thuis coach",
    "durationSec": 180,
    "orderIndex": 9,
    "isInVenue": false,
    "isInLivestream": true,
    "isTimeAnchor": false,
    "anchorType": null,
    "autoAdvance": false,
    "type": "MANUAL",
    "positions": [
      "Regie livestream",
      "Presentatie",
      "Camera rechts",
      "Showcaller"
    ]
  },
  {
    "title": "Nabeschouwing en voorspelling",
    "durationSec": 105,
    "orderIndex": 10,
    "isInVenue": false,
    "isInLivestream": true,
    "isTimeAnchor": false,
    "anchorType": null,
    "autoAdvance": false,
    "type": "MANUAL",
    "positions": [
      "Regie livestream",
      "Presentatie",
      "Camera rechts",
      "Showcaller"
    ]
  },
  {
    "title": "Reclame",
    "durationSec": 35,
    "orderIndex": 11,
    "isInVenue": false,
    "isInLivestream": true,
    "isTimeAnchor": false,
    "anchorType": null,
    "autoAdvance": true,
    "type": "MANUAL",
    "positions": [
      "Regie livestream",
      "Presentatie",
      "Camera rechts",
      "Showcaller"
    ]
  },
  {
    "title": "Licht uit",
    "durationSec": 0,
    "orderIndex": 12,
    "isInVenue": true,
    "isInLivestream": true,
    "isTimeAnchor": false,
    "anchorType": null,
    "autoAdvance": false,
    "type": "MANUAL",
    "positions": [
      "Muziek",
      "Regie livestream",
      "Regie LEDscherm",
      "Oplopen volgspot",
      "Showcaller"
    ]
  },
  {
    "title": "Commentatoren praten over wedstrijd (opstellingen)",
    "durationSec": 120,
    "orderIndex": 13,
    "isInVenue": false,
    "isInLivestream": true,
    "isTimeAnchor": false,
    "anchorType": null,
    "autoAdvance": false,
    "type": "MANUAL",
    "positions": [
      "Regie livestream",
      "Commentaar",
      "Showcaller"
    ]
  },
  {
    "title": "Speaker prietpraat",
    "durationSec": 180,
    "orderIndex": 14,
    "isInVenue": true,
    "isInLivestream": false,
    "isTimeAnchor": false,
    "anchorType": null,
    "autoAdvance": false,
    "type": "MANUAL",
    "positions": [
      "Muziek",
      "Oplopen geluid",
      "Speaker",
      "Showcaller"
    ]
  },
  {
    "title": "Start oploopfilm",
    "durationSec": 42,
    "orderIndex": 15,
    "isInVenue": true,
    "isInLivestream": true,
    "isTimeAnchor": false,
    "anchorType": null,
    "autoAdvance": true,
    "type": "MANUAL",
    "positions": [
      "Muziek",
      "Regie livestream",
      "Regie LEDscherm",
      "Showcaller"
    ]
  },
  {
    "title": "Check geluid speaker (unmute en schuif open)",
    "durationSec": 0,
    "orderIndex": 16,
    "isInVenue": true,
    "isInLivestream": true,
    "isTimeAnchor": false,
    "anchorType": null,
    "autoAdvance": false,
    "type": "MANUAL",
    "positions": [
      "Muziek",
      "Showcaller"
    ]
  },
  {
    "title": "Na oploopfilm, \"Opstellen teams\" muziek weer aan",
    "durationSec": 0,
    "orderIndex": 17,
    "isInVenue": true,
    "isInLivestream": false,
    "isTimeAnchor": false,
    "anchorType": null,
    "autoAdvance": false,
    "type": "MANUAL",
    "positions": [
      "Muziek",
      "Showcaller"
    ]
  },
  {
    "title": "Geef signaal aan speaker voor prietpraat na 15s",
    "durationSec": 180,
    "orderIndex": 18,
    "isInVenue": true,
    "isInLivestream": false,
    "isTimeAnchor": false,
    "anchorType": null,
    "autoAdvance": false,
    "type": "MANUAL",
    "positions": [
      "Muziek",
      "Showcaller"
    ]
  },
  {
    "title": "Regisseur geeft commentatoren aan dat ze kunnen beginnen",
    "durationSec": 0,
    "orderIndex": 19,
    "isInVenue": false,
    "isInLivestream": true,
    "isTimeAnchor": false,
    "anchorType": null,
    "autoAdvance": false,
    "type": "MANUAL",
    "positions": [
      "Regie livestream",
      "Showcaller"
    ]
  },
  {
    "title": "Regisseur toont opstellingen",
    "durationSec": 0,
    "orderIndex": 20,
    "isInVenue": false,
    "isInLivestream": true,
    "isTimeAnchor": false,
    "anchorType": null,
    "autoAdvance": false,
    "type": "MANUAL",
    "positions": [
      "Regie livestream",
      "Showcaller"
    ]
  },
  {
    "title": "Check audio licht-PC unmuted",
    "durationSec": 0,
    "orderIndex": 21,
    "isInVenue": true,
    "isInLivestream": false,
    "isTimeAnchor": false,
    "anchorType": null,
    "autoAdvance": false,
    "type": "MANUAL",
    "positions": [
      "Muziek",
      "Showcaller"
    ]
  },
  {
    "title": "Regisseur stopt commentatoren",
    "durationSec": 30,
    "orderIndex": 22,
    "isInVenue": false,
    "isInLivestream": true,
    "isTimeAnchor": false,
    "anchorType": null,
    "autoAdvance": false,
    "type": "MANUAL",
    "positions": [
      "Regie livestream",
      "Showcaller"
    ]
  },
  {
    "title": "Start oploop muziek tegenstander",
    "durationSec": 15,
    "orderIndex": 23,
    "isInVenue": true,
    "isInLivestream": false,
    "isTimeAnchor": false,
    "anchorType": null,
    "autoAdvance": false,
    "type": "MANUAL",
    "positions": [
      "Muziek",
      "Showcaller"
    ]
  },
  {
    "title": "Regisseur telt af start oplopen",
    "durationSec": 3,
    "orderIndex": 24,
    "isInVenue": true,
    "isInLivestream": true,
    "isTimeAnchor": false,
    "anchorType": null,
    "autoAdvance": false,
    "type": "MANUAL",
    "positions": [
      "Regie livestream",
      "Showcaller"
    ]
  },
  {
    "title": "Signaal aan speaker (lamp op deuropening)",
    "durationSec": 15,
    "orderIndex": 25,
    "isInVenue": true,
    "isInLivestream": false,
    "isTimeAnchor": false,
    "anchorType": null,
    "autoAdvance": false,
    "type": "MANUAL",
    "positions": [
      "Muziek",
      "Showcaller"
    ]
  },
  {
    "title": "Oplopen tegenstander door speaker",
    "durationSec": 120,
    "orderIndex": 26,
    "isInVenue": true,
    "isInLivestream": true,
    "isTimeAnchor": false,
    "anchorType": null,
    "autoAdvance": false,
    "type": "MANUAL",
    "positions": [
      "Muziek",
      "Showcaller"
    ]
  },
  {
    "title": "Start oploop muziek Fortuna",
    "durationSec": 15,
    "orderIndex": 27,
    "isInVenue": true,
    "isInLivestream": false,
    "isTimeAnchor": false,
    "anchorType": null,
    "autoAdvance": false,
    "type": "MANUAL",
    "positions": [
      "Muziek",
      "Showcaller"
    ]
  },
  {
    "title": "Oplopen Fortuna door speaker",
    "durationSec": 120,
    "orderIndex": 28,
    "isInVenue": true,
    "isInLivestream": true,
    "isTimeAnchor": false,
    "anchorType": null,
    "autoAdvance": false,
    "type": "MANUAL",
    "positions": [
      "Muziek",
      "Showcaller"
    ]
  },
  {
    "title": "Oplopen scheidsrechters (Fortuna muziek loopt door)",
    "durationSec": 30,
    "orderIndex": 29,
    "isInVenue": true,
    "isInLivestream": true,
    "isTimeAnchor": false,
    "anchorType": null,
    "autoAdvance": false,
    "type": "MANUAL",
    "positions": [
      "Muziek",
      "Showcaller"
    ]
  },
  {
    "title": "Scheidsrechters in midden, zaallampen aan",
    "durationSec": 0,
    "orderIndex": 30,
    "isInVenue": true,
    "isInLivestream": true,
    "isTimeAnchor": false,
    "anchorType": null,
    "autoAdvance": false,
    "type": "MANUAL",
    "positions": [
      "Muziek",
      "Showcaller"
    ]
  },
  {
    "title": "Muziek \"na oplopen\" aan",
    "durationSec": 0,
    "orderIndex": 31,
    "isInVenue": true,
    "isInLivestream": true,
    "isTimeAnchor": false,
    "anchorType": null,
    "autoAdvance": false,
    "type": "MANUAL",
    "positions": [
      "Muziek",
      "Showcaller"
    ]
  },
  {
    "title": "Tonen en melden wedstrijdsponsor",
    "durationSec": 30,
    "orderIndex": 32,
    "isInVenue": false,
    "isInLivestream": true,
    "isTimeAnchor": false,
    "anchorType": null,
    "autoAdvance": false,
    "type": "MANUAL",
    "positions": [
      "Regie livestream",
      "Showcaller"
    ]
  },
  {
    "title": "Zaallicht op wedstrijd niveau",
    "durationSec": 0,
    "orderIndex": 33,
    "isInVenue": true,
    "isInLivestream": true,
    "isTimeAnchor": false,
    "anchorType": null,
    "autoAdvance": false,
    "type": "MANUAL",
    "positions": [
      "Muziek",
      "Showcaller"
    ]
  },
  {
    "title": "Teams geven elkaar hand",
    "durationSec": 30,
    "orderIndex": 34,
    "isInVenue": true,
    "isInLivestream": true,
    "isTimeAnchor": false,
    "anchorType": null,
    "autoAdvance": false,
    "type": "MANUAL",
    "positions": [
      "Regie livestream",
      "Showcaller"
    ]
  },
  {
    "title": "Muziek uitfaden naar influiten",
    "durationSec": 0,
    "orderIndex": 35,
    "isInVenue": true,
    "isInLivestream": false,
    "isTimeAnchor": false,
    "anchorType": null,
    "autoAdvance": false,
    "type": "MANUAL",
    "positions": [
      "Muziek",
      "Showcaller"
    ]
  },
  {
    "title": "Start wedstrijd",
    "durationSec": 0,
    "orderIndex": 36,
    "isInVenue": true,
    "isInLivestream": true,
    "isTimeAnchor": true,
    "anchorType": "MATCH_START",
    "autoAdvance": false,
    "type": "MANUAL",
    "positions": [
      "Regie livestream",
      "Showcaller"
    ]
  }
];

async function main() {
  logger.info('--- Starting Call Sheet Template Seeder ---');

  // 1. Vind of creëer de benodigde posities
  const allPositionNames = new Set<string>();
  unifiedCallSheetData.forEach(item => {
    item.positions.forEach(pos => allPositionNames.add(pos));
  });

  const positions: Record<string, Position> = {};
  for (const name of Array.from(allPositionNames)) {
    let pos = await prisma.position.findUnique({ where: { name } });
    if (!pos) {
      pos = await prisma.position.create({ data: { name } });
      logger.info(`Created position: ${name}`);
    }
    positions[name] = pos;
  }

  // --- AANMAKEN VAN CALLSHEET TEMPLATE ---

  // 2. Vind of creëer een template
  const TEMPLATE_NAME = 'Standaard Korfbal Draaiboek';
  let template = await prisma.callSheetTemplate.findFirst({
    where: { name: TEMPLATE_NAME },
  });

  if (!template) {
    template = await prisma.callSheetTemplate.create({
      data: { name: TEMPLATE_NAME },
    });
    logger.info(`Created CallSheetTemplate: "${TEMPLATE_NAME}"`);
  } else {
    // Verwijder oude items als de template al bestaat voor een schone seed
    await prisma.callSheetTemplateItem.deleteMany({ where: { templateId: template.id } });
    logger.info(`Cleared old items for template: "${TEMPLATE_NAME}"`);
  }

  // 3. Creëer de items voor de template
  for (const item of unifiedCallSheetData) {
    await prisma.callSheetTemplateItem.create({
      data: {
        id: uuidv4(),
        templateId: template.id,
        title: item.title,
        note: (item as any).note,
        durationSec: item.durationSec || 0,
        orderIndex: item.orderIndex,
        isInLivestream: item.isInLivestream,
        isInVenue: item.isInVenue,
        autoAdvance: item.autoAdvance,
        isTimeAnchor: item.isTimeAnchor,
        anchorType: item.anchorType as any,
        positions: {
          create: item.positions.map(posName => ({
            positionId: positions[posName].id
          })),
        },
      },
    });
  }

  logger.info(`--- Seeding complete for CallSheetTemplate: "${TEMPLATE_NAME}" ---`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
