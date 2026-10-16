import type {StandardSegmentTemplate} from './types';

/** Segment templates of the standard set (formerly prisma/seed-data/segments/*.json). */
export const standardSegmentTemplates: StandardSegmentTemplate[] = [
  {
    name: "KorfbalLeague (Standaard)",
    isDefault: true,
    items: [
      {
        naam: "Voorbeschouwing",
        volgorde: 1,
        duurInMinuten: 20,
        isTimeAnchor: false
      },
      {
        naam: "Oplopen",
        volgorde: 2,
        duurInMinuten: 10,
        isTimeAnchor: false
      },
      {
        naam: "Eerste helft",
        volgorde: 3,
        duurInMinuten: 35,
        isTimeAnchor: true
      },
      {
        naam: "Rust",
        volgorde: 4,
        duurInMinuten: 10,
        isTimeAnchor: false
      },
      {
        naam: "Tweede helft",
        volgorde: 5,
        duurInMinuten: 35,
        isTimeAnchor: false
      },
      {
        naam: "Nabeschouwing",
        volgorde: 6,
        duurInMinuten: 20,
        isTimeAnchor: false
      }
    ]
  },
  {
    name: "Oploopwedstrijd",
    isDefault: false,
    items: [
      {
        naam: "Oplopen",
        volgorde: 1,
        duurInMinuten: 10,
        isTimeAnchor: false
      },
      {
        naam: "Eerste helft",
        volgorde: 2,
        duurInMinuten: 35,
        isTimeAnchor: true
      },
      {
        naam: "Rust",
        volgorde: 3,
        duurInMinuten: 10,
        isTimeAnchor: false
      },
      {
        naam: "Tweede helft",
        volgorde: 4,
        duurInMinuten: 35,
        isTimeAnchor: false
      }
    ]
  },
  {
    name: "Reserve KorfbalLeague",
    isDefault: false,
    items: [
      {
        naam: "Eerste helft",
        volgorde: 1,
        duurInMinuten: 35,
        isTimeAnchor: true
      },
      {
        naam: "Rust",
        volgorde: 2,
        duurInMinuten: 5,
        isTimeAnchor: false
      },
      {
        naam: "Tweede helft",
        volgorde: 3,
        duurInMinuten: 35,
        isTimeAnchor: false
      }
    ]
  }
];
