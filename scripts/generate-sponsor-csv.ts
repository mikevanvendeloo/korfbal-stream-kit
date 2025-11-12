#!/usr/bin/env tsx
/*
Generates a CSV with columns:
- volgorde (1..N)
- speler (Jumbo-xxx or beer-geluk)
- sponsor_boven
- sponsor_midden
- sponsor_onder

All values are filenames without the .png extension. The three sponsors in a row are distinct,
and there is no overlap with the three sponsors in the row above or below by partitioning the
sponsor list into three disjoint cycles.
*/

import fs from 'node:fs';
import path from 'node:path';

// Input list from the issue
const files = [
  'active-health-center.png',
  'ah-vrij.png',
  'akb-financial-services.png',
  'amzo.png',
  'avopa.png',
  'centrum-vertrouwenspersonen-plus.png',
  'dc-beheer.png',
  'deal-consultancy.png',
  'dk-groep.png',
  'dlr-eurlicon.png',
  'dominos-pizza-delft.png',
  'erions-administratie-en-belastingadviseurs.png',
  'hampshire-delft-centre.png',
  'hangbelly-bbq.png',
  'kinderopvang-les-enfants.png',
  'm-sports.png',
  'mizuno.png',
  'needed-people.png',
  'oltshoorn-makelaars.png',
  'passa-korfbal.png',
  'ren4sport.png',
  'riskineering.png',
  'ruitenheer.png',
  'schouten-accountants.png',
  'spotler.png',
  'the-fitness-club-delft.png',
  'van-huuksloot-creditmanagement.png',
  'yellow-jersey.png',
  'beer-geluk.png',
  'Jumbo-099.png',
  'Jumbo-101.png',
  'Jumbo-123.png',
  'Jumbo-133.png',
  'Jumbo-137.png',
  'Jumbo-147.png',
  'Jumbo-154.png',
  'Jumbo-180.png',
  'Jumbo-196.png',
  'Jumbo-198.png',
  'Jumbo-307.png',
  'Jumbo-336.png',
  'Jumbo-343.png',
  'Jumbo-357.png',
  'Jumbo-368.png',
  'Jumbo-395.png',
  'Jumbo-417.png',
  'Jumbo-423.png',
  'Jumbo-439.png',
];

function stripExt(name: string) {
  return name.replace(/\.png$/i, '');
}

const isPlayer = (n: string) => /^Jumbo-\d+\.png$/i.test(n) || /^beer-geluk\.png$/i.test(n);

const players = files.filter(isPlayer).map(stripExt);
const sponsorsAll = files.filter((n) => !isPlayer(n)).map(stripExt);

if (players.length === 0) {
  console.error('No player images found.');
  process.exit(1);
}
if (sponsorsAll.length < 3) {
  console.error('Need at least 3 sponsor logos to fill boven/midden/onder.');
  process.exit(1);
}

// Partition sponsors into three disjoint cycles to avoid overlap across rows and columns
const sponsorsTop: string[] = [];
const sponsorsMid: string[] = [];
const sponsorsBot: string[] = [];
for (let i = 0; i < sponsorsAll.length; i++) {
  const s = sponsorsAll[i];
  if (i % 3 === 0) sponsorsTop.push(s);
  else if (i % 3 === 1) sponsorsMid.push(s);
  else sponsorsBot.push(s);
}

// Fallback if any partition ended up empty (e.g., exactly 3 sponsors will still be fine)
if (sponsorsTop.length === 0 || sponsorsMid.length === 0 || sponsorsBot.length === 0) {
  // Simple rotate-and-distribute to ensure non-empty partitions
  const arr = [...sponsorsAll];
  while (sponsorsTop.length === 0) sponsorsTop.push(arr.shift());
  while (sponsorsMid.length === 0) sponsorsMid.push(arr.shift());
  while (sponsorsBot.length === 0) sponsorsBot.push(arr.shift());
  // Put remaining back round-robin
  let idx = 0;
  for (const s of arr) {
    if (idx % 3 === 0) sponsorsTop.push(s);
    else if (idx % 3 === 1) sponsorsMid.push(s);
    else sponsorsBot.push(s);
    idx++;
  }
}

function assignRow(i: number) {
  const boven = sponsorsTop[i % sponsorsTop.length];
  const midden = sponsorsMid[i % sponsorsMid.length];
  const onder = sponsorsBot[i % sponsorsBot.length];
  // Safety checks to ensure uniqueness within row
  if (new Set([boven, midden, onder]).size !== 3) {
    // Extremely unlikely with disjoint partitions; if it happens, shift one step.
    const midden2 = sponsorsMid[(i + 1) % sponsorsMid.length];
    return { boven, midden: midden2, onder };
  }
  return { boven, midden, onder };
}

const rows: Array<{ volgorde: number; speler: string; sponsor_boven: string; sponsor_midden: string; sponsor_onder: string }> = [];
for (let i = 0; i < players.length; i++) {
  const speler = players[i];
  const { boven, midden, onder } = assignRow(i);
  rows.push({ volgorde: i + 1, speler, sponsor_boven: boven, sponsor_midden: midden, sponsor_onder: onder });
}

// Serialize CSV
function toCsvValue(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

const header = ['volgorde', 'speler', 'sponsor_boven', 'sponsor_midden', 'sponsor_onder'];
const csv = [header.join(',')]
  .concat(rows.map((r) => [r.volgorde, r.speler, r.sponsor_boven, r.sponsor_midden, r.sponsor_onder].map(toCsvValue).join(',')))
  .join('\n');

// Print to stdout
process.stdout.write(csv + '\n');

// Also write to tmp file
const outDir = path.join(process.cwd(), 'tmp');
const outFile = path.join(outDir, 'sponsors_opstelling.csv');
try {
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outFile, csv, 'utf8');
  console.error(`Written CSV to: ${outFile}`);
} catch (e) {
  console.error('Failed to write CSV file:', e);
}
