export type SponsorRow = { subject: string; image1: string; image2: string; image3: string };

function stripExt(name: string) {
  return name.replace(/\.(png|jpg|jpeg|webp|svg)$/i, '');
}

export function generateSponsorRows(subjects: string[], sponsorLogos: string[]): SponsorRow[] {
  if (!Array.isArray(subjects) || subjects.length === 0) throw new Error('No subjects');
  const logos = (sponsorLogos || []).map((s) => stripExt(String(s))).filter(Boolean);
  if (logos.length < 3) throw new Error('Need at least 3 sponsors');

  const sponsorsTop: string[] = [];
  const sponsorsMid: string[] = [];
  const sponsorsBot: string[] = [];
  for (let i = 0; i < logos.length; i++) {
    const s = logos[i];
    if (i % 3 === 0) sponsorsTop.push(s);
    else if (i % 3 === 1) sponsorsMid.push(s);
    else sponsorsBot.push(s);
  }
  if (sponsorsTop.length === 0 || sponsorsMid.length === 0 || sponsorsBot.length === 0) {
    const arr = [...logos];
    while (sponsorsTop.length === 0 && arr.length) sponsorsTop.push(arr.shift()!);
    while (sponsorsMid.length === 0 && arr.length) sponsorsMid.push(arr.shift()!);
    while (sponsorsBot.length === 0 && arr.length) sponsorsBot.push(arr.shift()!);
    let idx = 0;
    for (const s of arr) {
      if (idx % 3 === 0) sponsorsTop.push(s);
      else if (idx % 3 === 1) sponsorsMid.push(s);
      else sponsorsBot.push(s);
      idx++;
    }
  }

  function assignRow(i: number) {
    const image1 = sponsorsTop[i % sponsorsTop.length];
    const image2 = sponsorsMid[i % sponsorsMid.length];
    const image3 = sponsorsBot[i % sponsorsBot.length];
    if (new Set([image1, image2, image3]).size !== 3) {
      const alt2 = sponsorsMid[(i + 1) % sponsorsMid.length];
      return { image1, image2: alt2, image3 };
    }
    return { image1, image2, image3 };
  }

  return subjects.map((subject, i) => ({ subject, ...assignRow(i) }));
}
