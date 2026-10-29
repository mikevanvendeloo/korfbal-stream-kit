import type {StandardCallSheetTemplate} from './types';

/** Callsheet templates of the standard set (formerly prisma/seed-data/callsheets/*.json). */
export const standardCallSheetTemplates: StandardCallSheetTemplate[] = [
  {
    name: "Alleen wedstrijd",
    chapters: [{name: "Eerste helft"}, {name: "Rust"}, {name: "Tweede helft"}],
    items: [
      {
        title: "Wedstrijd (1e helft)",
        durationSec: 1500,
        orderIndex: 0,
        chapter: "Eerste helft",
        isInVenue: true,
        isInLivestream: true,
        positions: [
          "Regie livestream",
          "Camera links",
          "Camera rechts",
          "Camera overzicht",
          "Commentaar",
          "Herhalingen"
        ]
      },
      {
        title: "Rust",
        durationSec: 600,
        orderIndex: 1,
        chapter: "Rust",
        isInVenue: true,
        isInLivestream: true,
        positions: [
          "Regie livestream",
          "Muziek"
        ]
      },
      {
        title: "Wedstrijd (2e helft)",
        durationSec: 1500,
        orderIndex: 2,
        chapter: "Tweede helft",
        isInVenue: true,
        isInLivestream: true,
        positions: [
          "Regie livestream",
          "Camera links",
          "Camera rechts",
          "Camera overzicht",
          "Commentaar",
          "Herhalingen"
        ]
      }
    ]
  },
  {
    name: "Draaiboek Korfbal League wedstrijd",
    chapters: [
      {name: "Voorbereiding"},
      {name: "Voorbeschouwing"},
      {name: "Oplopen"},
      {name: "Eerste helft"},
      {name: "Rust"},
      {name: "Tweede helft"},
      {name: "Nabeschouwing"},
    ],
    items: [
      {
        key: "cmnk0x8hb0001byxttepl0gv0",
        title: "Thumbnail neerzetten",
        durationSec: 15,
        orderIndex: 1,
        chapter: "Voorbereiding",
        isInVenue: false,
        isInLivestream: true,
        positions: [
          "Showcaller",
          "Regie livestream"
        ]
      },
      {
        key: "cmnk0x8hh0003byxta2dfu1v3",
        title: "Livestream starten",
        durationSec: 0,
        orderIndex: 2,
        chapter: "Voorbeschouwing",
        isInVenue: false,
        isInLivestream: true,
        isTimeAnchor: true,
        anchorType: "LIVESTREAM_START",
        positions: [
          "Showcaller",
          "Regie livestream"
        ]
      },
      {
        key: "cmnk0x8hk0005byxtjoof280y",
        title: "Intro filmpje starten",
        durationSec: 48,
        orderIndex: 3,
        chapter: "Voorbeschouwing",
        isInVenue: false,
        isInLivestream: true,
        autoAdvance: true,
        positions: [
          "Showcaller",
          "Regie livestream"
        ]
      },
      {
        key: "cmnk0x8hn0007byxt6tbxqex0",
        title: "Regisseur zet microfoon presentator open",
        durationSec: 0,
        orderIndex: 4,
        chapter: "Voorbeschouwing",
        isInVenue: false,
        isInLivestream: true,
        autoAdvance: true,
        positions: [
          "Showcaller",
          "Presentatie",
          "Regie livestream"
        ]
      },
      {
        key: "cmnk0x8ht0009byxtv6qgq0yt",
        title: "Presentator heet publiek welkom",
        durationSec: 15,
        orderIndex: 5,
        chapter: "Voorbeschouwing",
        isInVenue: false,
        isInLivestream: true,
        positions: [
          "Regie livestream",
          "Presentatie",
          "Showcaller"
        ]
      },
      {
        key: "cmnk0x8hz000bbyxt7a2x6565",
        title: "KL promo afspelen",
        durationSec: 53,
        orderIndex: 6,
        chapter: "Voorbeschouwing",
        isInVenue: false,
        isInLivestream: true,
        autoAdvance: true,
        positions: [
          "Showcaller",
          "Regie livestream"
        ]
      },
      {
        key: "cmnk0x8i3000dbyxtt9ohnh4m",
        title: "Presentator & Analist gesprek",
        durationSec: 150,
        orderIndex: 7,
        chapter: "Voorbeschouwing",
        isInVenue: false,
        isInLivestream: true,
        positions: [
          "Regie livestream",
          "Showcaller"
        ]
      },
      {
        key: "cmnk0x8i7000fbyxt02p6npv1",
        title: "Reclame",
        durationSec: 35,
        orderIndex: 8,
        chapter: "Voorbeschouwing",
        isInVenue: false,
        isInLivestream: true,
        autoAdvance: true,
        positions: [
          "Regie livestream",
          "Presentatie",
          "Showcaller"
        ]
      },
      {
        key: "cmnk0x8id000hbyxthwte6587",
        title: "Interview met uit coach",
        durationSec: 180,
        orderIndex: 9,
        chapter: "Voorbeschouwing",
        isInVenue: false,
        isInLivestream: true,
        positions: [
          "Regie livestream",
          "Presentatie",
          "Showcaller"
        ]
      },
      {
        key: "cmnk0x8ih000jbyxtq53qozbh",
        title: "Interview met thuis coach",
        durationSec: 180,
        orderIndex: 10,
        chapter: "Voorbeschouwing",
        isInVenue: false,
        isInLivestream: true,
        positions: [
          "Regie livestream",
          "Presentatie",
          "Camera rechts",
          "Showcaller"
        ]
      },
      {
        key: "cmnk0x8io000lbyxtkj0h8qxr",
        title: "Nabeschouwing en voorspelling",
        durationSec: 105,
        orderIndex: 11,
        chapter: "Voorbeschouwing",
        isInVenue: false,
        isInLivestream: true,
        positions: [
          "Regie livestream",
          "Presentatie",
          "Camera rechts",
          "Showcaller"
        ]
      },
      {
        key: "cmnk0x8iv000nbyxtg76mlqgj",
        title: "Reclame",
        durationSec: 35,
        orderIndex: 12,
        chapter: "Voorbeschouwing",
        isInVenue: false,
        isInLivestream: true,
        autoAdvance: true,
        positions: [
          "Regie livestream",
          "Presentatie",
          "Camera rechts",
          "Showcaller"
        ]
      },
      {
        key: "cmnk0x8kh0017byxtu8qahlk2",
        title: "Check audio licht-PC & LED PC unmuted",
        durationSec: 0,
        orderIndex: 13,
        chapter: "Oplopen",
        isInVenue: true,
        isInLivestream: false,
        positions: [
          "Regie LEDscherm",
          "Showcaller",
          "Muziek"
        ]
      },
      {
        key: "cmnk0x8j3000pbyxtiqpf2ce7",
        title: "Licht uit",
        durationSec: 0,
        orderIndex: 14,
        chapter: "Oplopen",
        isInVenue: true,
        isInLivestream: true,
        positions: [
          "Muziek",
          "Regie livestream",
          "Regie LEDscherm",
          "Oplopen volgspot",
          "Showcaller"
        ]
      },
      {
        key: "cmnk0x8jo000vbyxtdguv2vhd",
        title: "Start oploopfilm",
        durationSec: 42,
        orderIndex: 15,
        chapter: "Oplopen",
        isInVenue: true,
        isInLivestream: true,
        autoAdvance: true,
        parentKey: "cmnk0x8j3000pbyxtiqpf2ce7",
        positions: [
          "Showcaller",
          "Regie LEDscherm",
          "Regie livestream",
          "Muziek"
        ]
      },
      {
        key: "cmnk0x8jv000xbyxt0n7phuau",
        title: "Check geluid speaker (unmute en schuif open)",
        durationSec: 0,
        orderIndex: 16,
        chapter: "Oplopen",
        isInVenue: true,
        isInLivestream: true,
        parentKey: "cmnk0x8jo000vbyxtdguv2vhd",
        positions: [
          "Showcaller",
          "Muziek"
        ]
      },
      {
        key: "cmnk32xul0000by8129j4353m",
        title: "Regisseur checkt geluid commentatoren & zaal",
        durationSec: 0,
        orderIndex: 17,
        chapter: "Oplopen",
        isInVenue: false,
        isInLivestream: true,
        positions: [
          "Showcaller",
          "Regie livestream"
        ]
      },
      {
        key: "cmnk0x8k0000zbyxtm8f51msu",
        title: "Na oploopfilm, \"Opstellen teams\" muziek weer aan",
        durationSec: 0,
        orderIndex: 18,
        chapter: "Oplopen",
        isInVenue: true,
        isInLivestream: false,
        positions: [
          "Oplopen volgspot",
          "Oplopen geluid",
          "Showcaller",
          "Muziek"
        ]
      },
      {
        key: "cmnk0x8k90013byxtrw1kj8l4",
        title: "Regisseur geeft commentatoren aan dat ze kunnen beginnen",
        durationSec: 0,
        orderIndex: 19,
        chapter: "Oplopen",
        isInVenue: false,
        isInLivestream: true,
        positions: [
          "Regie livestream",
          "Showcaller"
        ]
      },
      {
        key: "cmnk0x8jb000rbyxtl1jy67qj",
        title: "Commentatoren praten over wedstrijd (opstellingen)",
        durationSec: 120,
        orderIndex: 20,
        chapter: "Oplopen",
        isInVenue: false,
        isInLivestream: true,
        parentKey: "cmnk0x8k90013byxtrw1kj8l4",
        positions: [
          "Showcaller",
          "Commentaar",
          "Regie livestream",
          "Camera links",
          "Camera rechts"
        ]
      },
      {
        key: "cmnk0x8k40011byxtoyb13kof",
        title: "Speaker introduceert wedstrijd",
        durationSec: 180,
        orderIndex: 21,
        chapter: "Oplopen",
        note: "'Prietpraat' over de wedstrijd en andere achtergrond informatie",
        isInVenue: true,
        isInLivestream: false,
        parentKey: "cmnk0x8k90013byxtrw1kj8l4",
        positions: [
          "Muziek",
          "Showcaller",
          "Regie livestream",
          "Oplopen volgspot",
          "Oplopen geluid",
          "Camera links",
          "Camera rechts",
          "Speaker"
        ]
      },
      {
        key: "cmnk0x8kc0015byxtnmjr9p93",
        title: "Regisseur toont opstellingen",
        durationSec: 0,
        orderIndex: 22,
        chapter: "Oplopen",
        isInVenue: false,
        isInLivestream: true,
        positions: [
          "Regie livestream",
          "Showcaller"
        ]
      },
      {
        key: "cmnk0x8kk0019byxtljuifer3",
        title: "Regisseur stopt commentatoren",
        durationSec: 30,
        orderIndex: 23,
        chapter: "Oplopen",
        isInVenue: false,
        isInLivestream: true,
        positions: [
          "Regie livestream",
          "Showcaller"
        ]
      },
      {
        key: "cmnk0x8ko001bbyxtpu33plyc",
        title: "Start oploop muziek tegenstander",
        durationSec: 15,
        orderIndex: 24,
        chapter: "Oplopen",
        isInVenue: true,
        isInLivestream: false,
        positions: [
          "Muziek",
          "Showcaller"
        ]
      },
      {
        key: "cmnk0x8ks001dbyxtytrd1zng",
        title: "Regisseur telt af start oplopen",
        durationSec: 3,
        orderIndex: 25,
        chapter: "Oplopen",
        isInVenue: true,
        isInLivestream: true,
        positions: [
          "Oplopen volgspot",
          "Oplopen geluid",
          "Muziek",
          "Speaker",
          "Regie LEDscherm",
          "Showcaller",
          "Regie livestream"
        ]
      },
      {
        key: "cmnk0x8kw001fbyxtivbxjt5c",
        title: "Signaal aan speaker (lamp op deuropening)",
        durationSec: 15,
        orderIndex: 26,
        chapter: "Oplopen",
        isInVenue: true,
        isInLivestream: false,
        positions: [
          "Muziek",
          "Showcaller"
        ]
      },
      {
        key: "cmnk0x8l0001hbyxt8de4su4q",
        title: "Oplopen tegenstander door speaker",
        durationSec: 120,
        orderIndex: 27,
        chapter: "Oplopen",
        isInVenue: true,
        isInLivestream: true,
        positions: [
          "Muziek",
          "Showcaller"
        ]
      },
      {
        key: "cmnk0x8l5001jbyxtx611y69d",
        title: "Start oploop muziek eigen ploeg",
        durationSec: 15,
        orderIndex: 28,
        chapter: "Oplopen",
        isInVenue: true,
        isInLivestream: false,
        positions: [
          "Muziek",
          "Showcaller"
        ]
      },
      {
        key: "cmnk0x8l9001lbyxttyv2iqlr",
        title: "Oplopen eigen ploeg door speaker",
        durationSec: 120,
        orderIndex: 29,
        chapter: "Oplopen",
        isInVenue: true,
        isInLivestream: true,
        positions: [
          "Muziek",
          "Showcaller"
        ]
      },
      {
        key: "cmnk0x8le001nbyxtjox4p5i7",
        title: "Oplopen scheidsrechters (muziek eigen ploeg loopt door)",
        durationSec: 30,
        orderIndex: 30,
        chapter: "Oplopen",
        isInVenue: true,
        isInLivestream: true,
        positions: [
          "Muziek",
          "Showcaller"
        ]
      },
      {
        key: "cmnk0x8li001pbyxtnsmzx1n2",
        title: "Scheidsrechters in midden, zaallampen aan",
        durationSec: 0,
        orderIndex: 31,
        chapter: "Oplopen",
        isInVenue: true,
        isInLivestream: true,
        positions: [
          "Muziek",
          "Showcaller"
        ]
      },
      {
        key: "cmnk0x8ln001rbyxtakqx52dp",
        title: "Muziek \"na oplopen\" aan",
        durationSec: 0,
        orderIndex: 32,
        chapter: "Oplopen",
        isInVenue: true,
        isInLivestream: true,
        positions: [
          "Muziek",
          "Showcaller"
        ]
      },
      {
        key: "cmnk0x8lr001tbyxtuwgxr5mb",
        title: "Tonen en melden wedstrijdsponsor",
        durationSec: 30,
        orderIndex: 33,
        chapter: "Oplopen",
        isInVenue: false,
        isInLivestream: true,
        positions: [
          "Regie livestream",
          "Showcaller"
        ]
      },
      {
        key: "cmnk0x8lw001vbyxtxzz83ulc",
        title: "Zaallicht op wedstrijd niveau",
        durationSec: 0,
        orderIndex: 34,
        chapter: "Oplopen",
        isInVenue: true,
        isInLivestream: true,
        positions: [
          "Muziek",
          "Showcaller"
        ]
      },
      {
        key: "cmnk0x8m1001xbyxts2fddeyj",
        title: "Teams geven elkaar hand",
        durationSec: 30,
        orderIndex: 35,
        chapter: "Oplopen",
        isInVenue: true,
        isInLivestream: true,
        positions: [
          "Regie livestream",
          "Showcaller"
        ]
      },
      {
        key: "cmnk0x8m6001zbyxt4sk4s5x4",
        title: "Muziek uitfaden naar influiten",
        durationSec: 0,
        orderIndex: 36,
        chapter: "Oplopen",
        isInVenue: true,
        isInLivestream: false,
        positions: [
          "Muziek",
          "Showcaller"
        ]
      },
      {
        key: "cmnk0x8mb0021byxt4dl96nwh",
        title: "Start wedstrijd",
        durationSec: 0,
        orderIndex: 37,
        chapter: "Eerste helft",
        isInVenue: true,
        isInLivestream: true,
        isTimeAnchor: true,
        anchorType: "MATCH_START",
        positions: [
          "Regie livestream",
          "Showcaller"
        ]
      },
      {
        key: "cmnk0x8mh0023byxtis41e3o6",
        title: "Eerste helft",
        durationSec: 2100,
        orderIndex: 38,
        chapter: "Eerste helft",
        note: "Eerste helft zuivere speeltijd. Bij timeout's statistieken tonen en bij dode spelmomenten eventueel de wedstrijd sponsor.",
        isInVenue: false,
        isInLivestream: true,
        positions: [
          "Showcaller"
        ]
      },
      {
        key: "cmnk0x8mm0025byxtx7ntelgr",
        title: "Speaker kondigt rust aan",
        durationSec: 30,
        orderIndex: 39,
        chapter: "Eerste helft",
        isInVenue: true,
        isInLivestream: false,
        autoAdvance: true,
        parentKey: "cmnk0x8mh0023byxtis41e3o6",
        positions: [
          "Regie livestream",
          "Regie LEDscherm",
          "Muziek",
          "Showcaller"
        ]
      },
      {
        key: "cmnk0x8mt0027byxtpxe7flun",
        title: "Commentatoren kondigen rust aan",
        durationSec: 30,
        orderIndex: 40,
        chapter: "Eerste helft",
        isInVenue: false,
        isInLivestream: true,
        autoAdvance: true,
        parentKey: "cmnk0x8mh0023byxtis41e3o6",
        positions: [
          "Regie livestream",
          "Commentaar",
          "Showcaller"
        ]
      },
      {
        key: "standard-rust",
        title: "Rust",
        durationSec: 600,
        orderIndex: 40,
        chapter: "Rust",
        isInVenue: true,
        isInLivestream: true,
        positions: [
          "Regie livestream",
          "Showcaller"
        ]
      },
      {
        key: "cmnk0x8n00029byxtah2pb4yl",
        title: "Toon statistieken",
        durationSec: 30,
        orderIndex: 41,
        chapter: "Rust",
        isInVenue: false,
        isInLivestream: true,
        parentKey: "standard-rust",
        positions: [
          "Regie livestream",
          "Regie LEDscherm",
          "Showcaller"
        ]
      },
      {
        key: "cmnk0x8n5002bbyxtvo6wdsc5",
        title: "Speel reclame af op LEDScherm",
        durationSec: 180,
        orderIndex: 42,
        chapter: "Rust",
        isInVenue: true,
        isInLivestream: false,
        parentKey: "cmnk0x8n00029byxtah2pb4yl",
        positions: [
          "Muziek",
          "Showcaller",
          "Regie LEDscherm"
        ]
      },
      {
        key: "cmnk0x8nd002dbyxtyconhfcc",
        title: "Reclame",
        durationSec: 180,
        orderIndex: 43,
        chapter: "Rust",
        isInVenue: false,
        isInLivestream: true,
        autoAdvance: true,
        parentKey: "cmnk0x8n00029byxtah2pb4yl",
        positions: [
          "Showcaller",
          "Regie livestream",
          "Presentatie"
        ]
      },
      {
        key: "cmnk0x8nk002fbyxtek3p8epi",
        title: "Analyse eerste heflt",
        durationSec: 300,
        orderIndex: 44,
        chapter: "Rust",
        isInVenue: false,
        isInLivestream: true,
        autoAdvance: true,
        parentKey: "cmnk0x8nd002dbyxtyconhfcc",
        positions: [
          "Presentatie",
          "Regie livestream",
          "Showcaller"
        ]
      },
      {
        key: "cmnk0x8nr002hbyxtwecm4wpv",
        title: "Reclame",
        durationSec: 180,
        orderIndex: 45,
        chapter: "Rust",
        isInVenue: false,
        isInLivestream: true,
        autoAdvance: true,
        parentKey: "cmnk0x8nk002fbyxtek3p8epi",
        positions: [
          "Showcaller"
        ]
      },
      {
        key: "cmnk0x8nv002jbyxtpjf37pnc",
        title: "Commentatoren open zetten",
        durationSec: 0,
        orderIndex: 46,
        chapter: "Rust",
        isInVenue: false,
        isInLivestream: true,
        positions: [
          "Showcaller",
          "Regie livestream",
          "Commentaar"
        ]
      },
      {
        key: "cmnk0x8o2002lbyxt5jxzjb1v",
        title: "Speaker openzetten",
        durationSec: 0,
        orderIndex: 47,
        chapter: "Rust",
        isInVenue: true,
        isInLivestream: false,
        positions: [
          "Muziek",
          "Showcaller"
        ]
      },
      {
        key: "cmnk0x8o7002nbyxty1usplls",
        title: "Tweede helft",
        durationSec: 2100,
        orderIndex: 48,
        chapter: "Tweede helft",
        isInVenue: false,
        isInLivestream: true,
        positions: [
          "Commentaar",
          "Muziek",
          "Regie livestream",
          "Regie LEDscherm",
          "Showcaller"
        ]
      },
      {
        key: "cmnk0x8of002pbyxtgoys8f1u",
        title: "Statistieken tonen",
        durationSec: 20,
        orderIndex: 49,
        chapter: "Nabeschouwing",
        isInVenue: true,
        isInLivestream: true,
        positions: [
          "Regie livestream",
          "Regie LEDscherm",
          "Showcaller"
        ]
      },
      {
        key: "cmnk0x8ok002rbyxtese53pp9",
        title: "Reclame",
        durationSec: 180,
        orderIndex: 50,
        chapter: "Nabeschouwing",
        isInVenue: true,
        isInLivestream: true,
        positions: [
          "Regie livestream",
          "Regie LEDscherm",
          "Showcaller"
        ]
      },
      {
        key: "cmnk0x8or002tbyxtplyuymf8",
        title: "Analyse en statistieken",
        durationSec: 120,
        orderIndex: 51,
        chapter: "Nabeschouwing",
        isInVenue: false,
        isInLivestream: true,
        positions: [
          "Analist",
          "Presentatie",
          "Regie livestream",
          "Showcaller"
        ]
      },
      {
        key: "cmnk0x8p1002vbyxtopqs9jgu",
        title: "Interview coach tegenstander",
        durationSec: 180,
        orderIndex: 52,
        chapter: "Nabeschouwing",
        isInVenue: false,
        isInLivestream: true,
        positions: [
          "Interview coordinator",
          "Showcaller",
          "Regie livestream",
          "Presentatie",
          "Analist"
        ]
      },
      {
        key: "cmnk0x8pc002xbyxtkco3dyx9",
        title: "Interview speler tegenstander",
        durationSec: 180,
        orderIndex: 53,
        chapter: "Nabeschouwing",
        isInVenue: false,
        isInLivestream: true,
        positions: [
          "Analist",
          "Regie livestream",
          "Presentatie",
          "Interview coordinator",
          "Showcaller"
        ]
      },
      {
        key: "cmnk0x8ph002zbyxt93sfp635",
        title: "Reclame",
        durationSec: 35,
        orderIndex: 54,
        chapter: "Nabeschouwing",
        isInVenue: false,
        isInLivestream: true,
        autoAdvance: true,
        positions: [
          "Regie livestream",
          "Analist",
          "Interview coordinator",
          "Presentatie",
          "Showcaller"
        ]
      },
      {
        key: "cmnk0x8pm0031byxtnkq2zt92",
        title: "Interview coach eigen ploeg",
        durationSec: 180,
        orderIndex: 55,
        chapter: "Nabeschouwing",
        isInVenue: false,
        isInLivestream: true,
        positions: [
          "Analist",
          "Interview coordinator",
          "Presentatie",
          "Regie livestream",
          "Showcaller"
        ]
      },
      {
        key: "cmnk0x8q70033byxt1vkybf3m",
        title: "Interview speler eigen ploeg",
        durationSec: 180,
        orderIndex: 56,
        chapter: "Nabeschouwing",
        isInVenue: false,
        isInLivestream: true,
        positions: [
          "Analist",
          "Interview coordinator",
          "Presentatie",
          "Regie livestream",
          "Showcaller"
        ]
      },
      {
        key: "cmnk0x8qa0035byxt089kc7kw",
        title: "Reacties op interviews, standen, volgende wedstrijd",
        durationSec: 60,
        orderIndex: 57,
        chapter: "Nabeschouwing",
        isInVenue: false,
        isInLivestream: true,
        positions: [
          "Analist",
          "Regie livestream",
          "Presentatie",
          "Showcaller"
        ]
      },
      {
        key: "cmnk0x8qc0037byxt4qkreq1v",
        title: "Reclame",
        durationSec: 35,
        orderIndex: 58,
        chapter: "Nabeschouwing",
        isInVenue: false,
        isInLivestream: true,
        autoAdvance: true,
        positions: [
          "Interview coordinator",
          "Analist",
          "Regie livestream",
          "Presentatie",
          "Showcaller"
        ]
      },
      {
        key: "cmnk0x8qe0039byxt9lqr52ca",
        title: "Korfballeague promo kort",
        durationSec: 60,
        orderIndex: 59,
        chapter: "Nabeschouwing",
        isInVenue: false,
        isInLivestream: true,
        autoAdvance: true,
        positions: [
          "Regie livestream",
          "Showcaller"
        ]
      },
      {
        key: "cmnk0x8qg003bbyxterqk3euh",
        title: "Highlights wedstrijd",
        durationSec: 180,
        orderIndex: 60,
        chapter: "Nabeschouwing",
        isInVenue: false,
        isInLivestream: true,
        positions: [
          "Regie livestream",
          "Showcaller"
        ]
      },
      {
        key: "cmnk0x8qh003dbyxtjszx6g58",
        title: "Credits",
        durationSec: 60,
        orderIndex: 61,
        chapter: "Nabeschouwing",
        isInVenue: false,
        isInLivestream: true,
        positions: [
          "Regie livestream",
          "Showcaller"
        ]
      }
    ]
  }
];
