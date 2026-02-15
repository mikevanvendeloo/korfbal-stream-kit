import {Router} from 'express';
import path from 'node:path';
import fs from 'node:fs';
import PDFDocument from 'pdfkit';
import {z} from 'zod';
import {prisma} from '../../services/prisma';
import {logger} from '../../utils/logger';

export const productionReportsRouter: Router = Router();

// -------- Production Report (Livestream Productie Rapport) --------

// Schema's voor validatie
const CreateUpdateProductionReportSchema = z.object({
  matchSponsor: z.string().max(200).optional().nullable(),
  interviewRationale: z.string().max(5000).optional().nullable(),
  remarks: z.string().max(5000).optional().nullable(),
});

// Helper functie om segment naam te mappen naar rapport sectie
function mapSegmentToSection(segmentName: string): string {
  const lower = segmentName.toLowerCase();
  if (lower.includes('oplopen') || lower.includes('oploop')) return 'OPLOPEN';
  if (lower.includes('wedstrijd')) return 'WEDSTRIJD';
  if (lower.includes('studio')) return 'STUDIO';
  if (lower.includes('commentaar')) return 'COMMENTAAR';
  if (lower.includes('speaker')) return 'SPEAKER';
  return 'OVERIG';
}

// Helper functie om timing te berekenen
function calculateTiming(segments: any[], matchDate: Date, liveTime?: Date | null) {
  let timing: Array<{ id: number; naam: string; start: string; end: string; duurInMinuten: number }> = [];

  if (segments.length > 0) {
    const anchorIdx = segments.findIndex((s) => s.isTimeAnchor);
    if (anchorIdx !== -1) {
      const anchorStart = matchDate.getTime();
      const result = segments.map((s) => ({ id: s.id, naam: s.naam, start: '', end: '', duurInMinuten: s.duurInMinuten }));

      // forward from anchor
      let t = anchorStart;
      for (let i = anchorIdx; i < result.length; i++) {
        result[i].start = new Date(t).toISOString();
        t += result[i].duurInMinuten * 60 * 1000;
        result[i].end = new Date(t).toISOString();
      }

      // backward from anchor
      t = anchorStart;
      for (let i = anchorIdx - 1; i >= 0; i--) {
        t -= result[i].duurInMinuten * 60 * 1000;
        result[i].start = new Date(t).toISOString();
        result[i].end = new Date(t + result[i].duurInMinuten * 60 * 1000).toISOString();
      }

      timing = result;
    }
  }

  // Voeg Livestream start toe als liveTime is ingesteld
  if (liveTime) {
    timing.unshift({
      id: -1,
      naam: 'LIVESTREAM START',
      start: liveTime.toISOString(),
      end: liveTime.toISOString(),
      duurInMinuten: 0
    });
    // Sorteer op starttijd
    timing.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  }

  return timing;
}

// GET /api/production/:id/report - Haal het productie rapport op (enriched met productie data)
productionReportsRouter.get('/:id/report', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid production id' });

    const production = await prisma.production.findUnique({
      where: { id },
      include: {
        matchSchedule: true,
        productionReport: true,
        productionPersons: { // Add this include
          include: {
            person: true,
          },
        },
        productionPositions: { // Production-wide position assignments
          include: {
            person: true,
            position: true,
          },
        },
        segments: {
          include: {
            bezetting: {
              include: {
                person: true,
                position: true,
              },
            },
          },
          orderBy: { volgorde: 'asc' },
        },
        interviewSubjects: {
          include: {
            player: {
              include: {
                club: true,
              },
            },
          },
        },
      },
    });

    if (!production) return res.status(404).json({ error: 'Production not found' });

    // --- NEW ATTENDEES LOGIC ---
    const assignedPersonIds = new Set<number>();
    production.segments.forEach((seg) => {
      seg.bezetting.forEach((b) => assignedPersonIds.add(b.person.id));
    });
    // Also consider production-wide assignments as "assigned"
    production.productionPositions.forEach((pp) => assignedPersonIds.add(pp.personId));

    const attendees: { name: string; isAssigned: boolean }[] = production.productionPersons
      .map((pp) => ({
        name: pp.person.name,
        isAssigned: assignedPersonIds.has(pp.person.id),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    // --- END NEW ATTENDEES LOGIC ---

    // Groepeer rollen per sectie (met isStudio info)
    const rolesBySection: Record<string, Array<{ positionName: string; personNames: string[]; isStudio: boolean }>> = {};

    // First, add production-wide assignments (these apply to all segments)
    const productionWidePositionMap = new Map<string, { names: Set<string>; isStudio: boolean }>();
    production.productionPositions.forEach((pp) => {
      if (!productionWidePositionMap.has(pp.position.name)) {
        productionWidePositionMap.set(pp.position.name, { names: new Set(), isStudio: pp.position.isStudio });
      }
      productionWidePositionMap.get(pp.position.name)!.names.add(pp.person.name);
    });

    // Then, add segment-specific assignments
    production.segments.forEach((segment) => {
      const section = mapSegmentToSection(segment.naam);
      if (!rolesBySection[section]) rolesBySection[section] = [];

      const positionMap = new Map<string, { names: Set<string>; isStudio: boolean }>();
      segment.bezetting.forEach((b) => {
        if (!positionMap.has(b.position.name)) {
          positionMap.set(b.position.name, { names: new Set(), isStudio: b.position.isStudio });
        }
        positionMap.get(b.position.name)!.names.add(b.person.name);
      });

      positionMap.forEach((data, posName) => {
        const existing = rolesBySection[section].find((r) => r.positionName === posName);
        if (existing) {
          data.names.forEach((n) => {
            if (!existing.personNames.includes(n)) existing.personNames.push(n);
          });
        } else {
          rolesBySection[section].push({
            positionName: posName,
            personNames: Array.from(data.names),
            isStudio: data.isStudio,
          });
        }
      });
    });

    // Add production-wide assignments to all sections (they apply globally)
    productionWidePositionMap.forEach((data, posName) => {
      Object.keys(rolesBySection).forEach((section) => {
        const existing = rolesBySection[section].find((r) => r.positionName === posName);
        if (existing) {
          data.names.forEach((n) => {
            if (!existing.personNames.includes(n)) existing.personNames.push(n);
          });
        } else {
          rolesBySection[section].push({
            positionName: posName,
            personNames: Array.from(data.names),
            isStudio: data.isStudio,
          });
        }
      });
    });

    // Sorteer en maak leesbaar
    Object.keys(rolesBySection).forEach((section) => {
      rolesBySection[section].sort((a, b) => a.positionName.localeCompare(b.positionName));
    });

    // Interview subjects (met foto's en rugnummer)
    const interviews = {
      home: {
        players: production.interviewSubjects
          .filter((s) => s.side === 'HOME' && s.role === 'PLAYER')
          .map((s) => ({
            id: s.player.id,
            name: s.player.name,
            shirtNo: s.player.shirtNo,
            function: s.player.function,
            photoUrl: s.player.photoUrl,
          })),
        coaches: production.interviewSubjects
          .filter((s) => s.side === 'HOME' && s.role === 'COACH')
          .map((s) => ({
            id: s.player.id,
            name: s.player.name,
            shirtNo: s.player.shirtNo,
            function: s.player.function,
            photoUrl: s.player.photoUrl,
          })),
      },
      away: {
        players: production.interviewSubjects
          .filter((s) => s.side === 'AWAY' && s.role === 'PLAYER')
          .map((s) => ({
            id: s.player.id,
            name: s.player.name,
            shirtNo: s.player.shirtNo,
            function: s.player.function,
            photoUrl: s.player.photoUrl,
          })),
        coaches: production.interviewSubjects
          .filter((s) => s.side === 'AWAY' && s.role === 'COACH')
          .map((s) => ({
            id: s.player.id,
            name: s.player.name,
            shirtNo: s.player.shirtNo,
            function: s.player.function,
            photoUrl: s.player.photoUrl,
          })),
      },
    };

    // Haal alle sponsors op voor de dropdown
    const sponsors = await prisma.sponsor.findMany({ orderBy: { name: 'asc' } });

    return res.json({
      production: {
        id: production.id,
        matchScheduleId: production.matchScheduleId,
        homeTeam: production.matchSchedule.homeTeamName,
        awayTeam: production.matchSchedule.awayTeamName,
        date: production.matchSchedule.date,
        liveTime: production.liveTime,
      },
      report: production.productionReport || null,
      enriched: {
        attendees, // This will now be an array of { name: string, isAssigned: boolean }
        rolesBySection,
        interviews,
      },
      sponsors,
    });
  } catch (err) {
    return next(err);
  }
});

// POST /api/production/:id/report - Maak of update het productie rapport
productionReportsRouter.post('/:id/report', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid production id' });

    const parsed = CreateUpdateProductionReportSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid payload' });
    }

    const { matchSponsor, interviewRationale, remarks } = parsed.data;

    // Check if production exists
    const production = await prisma.production.findUnique({ where: { id } });
    if (!production) return res.status(404).json({ error: 'Production not found' });

    // Upsert het rapport
    const report = await prisma.productionReport.upsert({
      where: { productionId: id },
      create: {
        productionId: id,
        matchSponsor,
        interviewRationale,
        remarks,
      },
      update: {
        matchSponsor,
        interviewRationale,
        remarks,
      },
    });

    return res.json(report);
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.issues?.[0]?.message || 'Invalid payload' });
    return next(err);
  }
});

// DELETE /api/production/:id/report - Verwijder het productie rapport
productionReportsRouter.delete('/:id/report', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid production id' });

    const existing = await prisma.productionReport.findUnique({ where: { productionId: id } });
    if (!existing) return res.status(404).json({ error: 'Report not found' });

    await prisma.productionReport.delete({ where: { id: existing.id } });

    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
});

// GET /api/production/:id/report/pdf - Download het productie rapport als PDF
productionReportsRouter.get('/:id/report/pdf', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid production id' });

    const production = await prisma.production.findUnique({
      where: { id },
      include: {
        matchSchedule: true,
        productionReport: true,
        productionPersons: { // Add this include
          include: {
            person: true,
          },
        },
        productionPositions: { // Production-wide position assignments
          include: {
            person: true,
            position: true,
          },
        },
        segments: {
          include: {
            bezetting: {
              include: {
                person: true,
                position: true,
              },
            },
          },
          orderBy: { volgorde: 'asc' },
        },
        interviewSubjects: {
          include: {
            player: {
              include: {
                club: true,
              },
            },
          },
        },
      },
    });

    if (!production) return res.status(404).json({ error: 'Production not found' });

    const report = production.productionReport;
    const match = production.matchSchedule;

    // Debug: log segment names
    logger.info('Production segments:', production.segments.map(s => ({ name: s.naam, bezettingCount: s.bezetting.length })));

    // --- NEW ATTENDEES LOGIC ---
    const assignedPersonIds = new Set<number>();
    production.segments.forEach((seg) => {
      seg.bezetting.forEach((b) => assignedPersonIds.add(b.person.id));
    });
    // Also consider production-wide assignments as "assigned"
    production.productionPositions.forEach((pp) => assignedPersonIds.add(pp.personId));

    const attendees: { name: string; isAssigned: boolean }[] = production.productionPersons
      .map((pp) => ({
        name: pp.person.name,
        isAssigned: assignedPersonIds.has(pp.person.id),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    // --- END NEW ATTENDEES LOGIC ---

    // Groepeer rollen per sectie (met isStudio info)
    const rolesBySection: Record<string, Array<{ positionName: string; personNames: string[]; isStudio: boolean }>> = {};

    // First, add production-wide assignments (these apply to all segments)
    const productionWidePositionMap = new Map<string, { names: Set<string>; isStudio: boolean }>();
    production.productionPositions.forEach((pp) => {
      if (!productionWidePositionMap.has(pp.position.name)) {
        productionWidePositionMap.set(pp.position.name, { names: new Set(), isStudio: pp.position.isStudio });
      }
      productionWidePositionMap.get(pp.position.name)!.names.add(pp.person.name);
    });

    // Then, add segment-specific assignments
    production.segments.forEach((segment) => {
      const section = mapSegmentToSection(segment.naam);
      if (!rolesBySection[section]) rolesBySection[section] = [];

      const positionMap = new Map<string, { names: Set<string>; isStudio: boolean }>();
      segment.bezetting.forEach((b) => {
        if (!positionMap.has(b.position.name)) {
          positionMap.set(b.position.name, { names: new Set(), isStudio: b.position.isStudio });
        }
        positionMap.get(b.position.name)!.names.add(b.person.name);
      });

      positionMap.forEach((data, posName) => {
        const existing = rolesBySection[section].find((r) => r.positionName === posName);
        if (existing) {
          data.names.forEach((n) => {
            if (!existing.personNames.includes(n)) existing.personNames.push(n);
          });
        } else {
          rolesBySection[section].push({
            positionName: posName,
            personNames: Array.from(data.names),
            isStudio: data.isStudio,
          });
        }
      });
    });

    // Add production-wide assignments to all sections (they apply globally)
    productionWidePositionMap.forEach((data, posName) => {
      Object.keys(rolesBySection).forEach((section) => {
        const existing = rolesBySection[section].find((r) => r.positionName === posName);
        if (existing) {
          data.names.forEach((n) => {
            if (!existing.personNames.includes(n)) existing.personNames.push(n);
          });
        } else {
          rolesBySection[section].push({
            positionName: posName,
            personNames: Array.from(data.names),
            isStudio: data.isStudio,
          });
        }
      });
    });

    // Sorteer
    Object.keys(rolesBySection).forEach((section) => {
      rolesBySection[section].sort((a, b) => a.positionName.localeCompare(b.positionName));
    });

    // Debug: log final rolesBySection
    logger.info('Final rolesBySection after processing:', JSON.stringify(rolesBySection, null, 2));

    // Interview subjects
    const interviews = {
      home: {
        players: production.interviewSubjects.filter((s) => s.side === 'HOME' && s.role === 'PLAYER').map((s) => s.player),
        coaches: production.interviewSubjects.filter((s) => s.side === 'HOME' && s.role === 'COACH').map((s) => s.player),
      },
      away: {
        players: production.interviewSubjects.filter((s) => s.side === 'AWAY' && s.role === 'PLAYER').map((s) => s.player),
        coaches: production.interviewSubjects.filter((s) => s.side === 'AWAY' && s.role === 'COACH').map((s) => s.player),
      },
    };

    // Format datum en tijd
    const matchDate = new Date(match.date);
    const timeStr = matchDate.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
    const matchTitle = `${match.homeTeamName} - ${match.awayTeamName}: ${timeStr} uur`;

    // Maak PDF document
    const doc = new PDFDocument({ margin: 50, size: 'A4' });

    // Set response headers
    const filename = `Productie_Positie_Overzicht_${match.homeTeamName.replace(/[^a-z0-9]/gi, '_')}_${matchDate.toISOString().split('T')[0]}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Pipe PDF naar response
    doc.pipe(res);

    // Titel
    doc.fontSize(18).font('Helvetica-Bold').text('Livestream bezetting', { align: 'center' });
    doc.moveDown(0.5);

    // Match titel met club logos
    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const logoSize = 40;

    // Helper functie om club logo te vinden en renderen
    const renderClubLogo = async (teamName: string, xPos: number, yPos: number) => {
      try {
        // Vind club door team naam
        const normalized = teamName.trim().replace(/\s+\d+$/g, '').split('/')[0]?.trim().toLowerCase();
        const club = await prisma.club.findFirst({
          where: {
            OR: [
              { shortName: { contains: normalized, mode: 'insensitive' } },
              { name: { contains: normalized, mode: 'insensitive' } },
            ],
          },
        });

        if (club?.logoUrl) {
          const logoPath = path.join(process.cwd(), 'assets', club.logoUrl);
          if (fs.existsSync(logoPath)) {
            // renderClubLogo verwacht xPos als het midden van het logo, dus trek logoSize / 2 af voor de linkerrand
            doc.image(logoPath, xPos - logoSize / 2, yPos, { width: logoSize, height: logoSize, fit: [logoSize, logoSize] });
          }
        }
      } catch (e) {
        logger.warn(`Could not add logo for team ${teamName}: ${e}`);
      }
    };

    // Render home logo, match title, away logo in één lijn
    const titleY = doc.y;
    // Voor het thuislogo: de linkerrand van het logo moet op doc.page.margins.left liggen.
    // Aangezien renderClubLogo xPos als het midden van het logo ziet, is de xPos:
    const homeLogoCenterX = doc.page.margins.left + logoSize / 2;
    // Voor het uitlogo: de rechterrand van het logo moet op doc.page.width - doc.page.margins.right liggen.
    // Aangezien renderClubLogo xPos als het midden van het logo ziet, is de xPos:
    const awayLogoCenterX = (doc.page.width - doc.page.margins.right) - logoSize / 2;

    await renderClubLogo(match.homeTeamName, homeLogoCenterX, titleY);
    await renderClubLogo(match.awayTeamName, awayLogoCenterX, titleY);

    // Match titel in het midden
    doc.fontSize(14).font('Helvetica').text(matchTitle, doc.page.margins.left, titleY + (logoSize / 2) - 7, {
      width: pageWidth,
      align: 'center',
    });

    // Move down na logos en titel
    doc.y = titleY + logoSize + 10;
    doc.moveDown(0.5);

    // Aanwezigen
    doc.fontSize(12).font('Helvetica-Bold').text('Aanwezig:', { continued: false });
    doc.moveDown(0.3); // Voeg wat ruimte toe na het label "Aanwezig:"

    if (attendees.length === 0) {
      doc.font('Helvetica').text('Geen aanwezigen');
    } else {
      doc.fontSize(11); // Stel de basis lettergrootte in voor namen
      attendees.forEach((p, index) => {
        if (!p.isAssigned) {
          doc.font('Helvetica-Oblique').text(p.name, { continued: true }); // Cursief
        } else {
          doc.font('Helvetica').text(p.name, { continued: true }); // Normaal
        }

        // Voeg een komma en spatie toe, behalve na de laatste naam
        if (index < attendees.length - 1) {
          doc.font('Helvetica').text(', ', { continued: true });
        }
      });
      doc.text('', { continued: false }); // Beëindig de doorlopende tekstregel
    }
    doc.moveDown(2);
    doc.x = doc.page.margins.left;


    // Tijdschema - bereken timing inline
    const segments = await prisma.productionSegment.findMany({ where: { productionId: id }, orderBy: { volgorde: 'asc' } });
    const timing = calculateTiming(segments, new Date(match.date), production.liveTime);

    if (timing.length > 0) {
      doc.fontSize(12).font('Helvetica-Bold').text('Tijdschema:', { continued: false });
      doc.moveDown(0.3);

      // Tabel headers
      const tableStartX = doc.page.margins.left;
      const col1Width = 200;
      const col2Width = 80;
      const col3Width = 80;
      const col4Width = 80;

      let tableY = doc.y;
      doc.fontSize(10).font('Helvetica-Bold');
      doc.text('Segment', tableStartX, tableY, { width: col1Width, continued: false });
      doc.text('Start', tableStartX + col1Width, tableY, { width: col2Width, continued: false });
      doc.text('Einde', tableStartX + col1Width + col2Width, tableY, { width: col3Width, continued: false });
      doc.text('Duur', tableStartX + col1Width + col2Width + col3Width, tableY, { width: col4Width, continued: false });
      tableY += 15;

      // Tabel rijen
      doc.fontSize(9).font('Helvetica');
      timing.forEach((segment) => {
        const startTime = new Date(segment.start).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
        const endTime = new Date(segment.end).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });

        doc.text(segment.naam, tableStartX, tableY, { width: col1Width, continued: false });
        doc.text(startTime, tableStartX + col1Width, tableY, { width: col2Width, continued: false });
        doc.text(endTime, tableStartX + col1Width + col2Width, tableY, { width: col3Width, continued: false });
        doc.text(`${segment.duurInMinuten} min`, tableStartX + col1Width + col2Width + col3Width, tableY, { width: col4Width, continued: false });
        tableY += 12;
      });

      doc.y = tableY;
      doc.moveDown(0.5);
    }

    doc.moveDown(1);
    doc.x = doc.page.margins.left;
    // Positie bezetting header
    doc.fontSize(14).font('Helvetica-Bold').text('Positie bezetting', { underline: true });
    doc.moveDown(0.5);

    // Debug: log rolesBySection
    logger.info('rolesBySection keys:', Object.keys(rolesBySection));
    Object.keys(rolesBySection).forEach(key => {
      logger.info(`Section ${key}:`, rolesBySection[key]);
    });

    // Verzamel alle posities uit alle secties
    const allRoles: Array<{ positionName: string; personNames: string[]; isStudio: boolean }> = [];
    Object.values(rolesBySection).forEach((roles) => {
      roles.forEach((role) => {
        const existing = allRoles.find((r) => r.positionName === role.positionName);
        if (existing) {
          role.personNames.forEach((n) => {
            if (!existing.personNames.includes(n)) {
              existing.personNames.push(n);
            }
          });
        } else {
          allRoles.push({ positionName: role.positionName, personNames: [...role.personNames], isStudio: role.isStudio });
        }
      });
    });

    // Splits in Studio en Productie posities op basis van isStudio veld
    const studioRoles = allRoles.filter((r) => r.isStudio);
    const productieRoles = allRoles.filter((r) => !r.isStudio);

    // Render twee kolommen met tabellen
    const columnWidth = pageWidth / 2 - 10;
    const leftColumnX = doc.page.margins.left;
    const rightColumnX = doc.page.margins.left + columnWidth + 20;
    let currentY = doc.y;
    const positionColumnY = doc.y;

    // Linker kolom: Studio posities
    doc.fontSize(12).font('Helvetica-Bold').text('Studio posities', leftColumnX, currentY);
    currentY += 20;

    // Tabel headers
    doc.fontSize(10).font('Helvetica-Bold');
    doc.text('Positie', leftColumnX, currentY, { width: columnWidth * 0.4, continued: false });
    doc.text('Naam', leftColumnX + columnWidth * 0.4, currentY, { width: columnWidth * 0.6, continued: false });
    currentY += 15;

    // Tabel rijen
    doc.fontSize(9).font('Helvetica');
    if (studioRoles.length === 0) {
      doc.fillColor('gray').text('Geen posities toegewezen', leftColumnX, currentY, { width: columnWidth, continued: false });
      doc.fillColor('black');
      currentY += 12;
    } else {
      studioRoles.forEach((role) => {
        const rowHeight = Math.max(12, Math.ceil(role.personNames.join(', ').length / 30) * 12);
        doc.text(role.positionName, leftColumnX, currentY, { width: columnWidth * 0.4, continued: false });
        doc.text(role.personNames.join(', '), leftColumnX + columnWidth * 0.4, currentY, { width: columnWidth * 0.6, continued: false });
        currentY += rowHeight;
      });
    }

    // Rechter kolom: Productie posities (start vanaf boven)
    const startY = positionColumnY;

    doc.fontSize(12).font('Helvetica-Bold').text('Productie posities', rightColumnX, startY);
    let rightCurrentY = startY + 20;

    // Tabel headers
    doc.fontSize(10).font('Helvetica-Bold');
    doc.text('Positie', rightColumnX, rightCurrentY, { width: columnWidth * 0.4, continued: false });
    doc.text('Naam', rightColumnX + columnWidth * 0.4, rightCurrentY, { width: columnWidth * 0.6, continued: false });
    rightCurrentY += 15;

    // Tabel rijen
    doc.fontSize(9).font('Helvetica');
    if (productieRoles.length === 0) {
      doc.fillColor('gray').text('Geen posities toegewezen', rightColumnX, rightCurrentY, { width: columnWidth, continued: false });
      doc.fillColor('black');
      rightCurrentY += 12;
    } else {
      productieRoles.forEach((role) => {
        const rowHeight = Math.max(12, Math.ceil(role.personNames.join(', ').length / 30) * 12);
        doc.text(role.positionName, rightColumnX, rightCurrentY, { width: columnWidth * 0.4, continued: false });
        doc.text(role.personNames.join(', '), rightColumnX + columnWidth * 0.4, rightCurrentY, { width: columnWidth * 0.6, continued: false });
        rightCurrentY += rowHeight;
      });
    }

    // Zet cursor naar de laagste punt van beide kolommen
    doc.y = Math.max(currentY, rightCurrentY);
    doc.moveDown(1);
    doc.x = doc.page.margins.left;

    // Wedstrijdsponsor
    if (report?.matchSponsor) {
      doc.fontSize(12).font('Helvetica-Bold').text('Wedstrijdsponsor:', { continued: false });
      doc.font('Helvetica').text(report.matchSponsor);
      doc.moveDown(1);
    } else {
      doc.moveDown(0.5);
    }
    doc.moveDown(1);

    // Interview sectie met foto's in 2 kolommen (coach links, speler rechts)
    const allInterviewees = [...interviews.home.players, ...interviews.home.coaches, ...interviews.away.players, ...interviews.away.coaches];
    if (allInterviewees.length > 0) {
      // Page break voor interviews sectie
      doc.addPage();

      const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const columnWidth = pageWidth / 2 - 10;
      const leftColumnX = doc.page.margins.left;
      const rightColumnX = doc.page.margins.left + columnWidth + 20;
      doc.x = leftColumnX;
      doc.fontSize(13).font('Helvetica-Bold').text('Spelers voor interviews:', { underline: true });
      doc.moveDown(0.5);
      // Helper functie om persoon te renderen
      const renderPerson = (person: any, xPos: number, yPos: number) => {
        const imageWidth = 120;
        const imageHeight = 120;
        let currentY = yPos;

        // Naam en rugnummer eerst
        const shirtNo = (person.shirtNo != null && person.shirtNo > 0) ? ` (#${person.shirtNo})` : '';
        doc.fontSize(11).font('Helvetica-Bold').text(`${person.name}${shirtNo}`, xPos, currentY);
        currentY = doc.y;
        if (person.function) {
          doc.fontSize(10).font('Helvetica').text(person.function, xPos, currentY);
          currentY = doc.y;
        }
        currentY += 1;

        // Foto eronder
        if (person.photoUrl) {
          const imagePath = path.join(process.cwd(), 'uploads', person.photoUrl);

          if (fs.existsSync(imagePath)) {
            try {
              // 1. Sla de huidige staat van het document op
              doc.save();

              // 1. Teken het kader waar de foto in MOET komen
              doc.rect(xPos, currentY, imageWidth, imageHeight).clip();

              // 2. Plaats de afbeelding
              // We gebruiken 'cover' met exact dezelfde dimensies als de clip-rect.
              // 'valign: top' zorgt dat we het hoofd zien.
              doc.image(imagePath, xPos, currentY, {
                width: imageWidth
              });

              doc.restore(); // Herstel clip-staat zodat tekst weer zichtbaar is

              // 3. Update currentY voor de rest van de content
              // We voegen extra ruimte toe (bijv. 15px) na de afbeelding
              currentY += imageHeight + 1;

            } catch (e) {
              logger.warn(`Could not add image for ${person.name}: ${e}`);
            }
          }
        }

        return currentY;
      };



      // Away team - 2 kolommen layout
      if (interviews.away.players.length > 0 || interviews.away.coaches.length > 0) {
        doc.fontSize(12).font('Helvetica-Bold').text(`${match.awayTeamName}:`);
        doc.moveDown(0.3);

        const rowStartY = doc.y;
        let leftY = rowStartY;
        let rightY = rowStartY;

        // Coach links
        if (interviews.away.coaches.length > 0) {
          const coach = interviews.away.coaches[0];
          leftY = renderPerson(coach, leftColumnX, leftY);
        }

        // Spelers rechts
        if (interviews.away.players.length > 0) {
          for (const player of interviews.away.players) {
            rightY = renderPerson(player, rightColumnX, rightY);
            rightY += 5; // Spacing tussen spelers
          }
        }

        // Zet cursor onder de hoogste kolom
        doc.y = Math.max(leftY, rightY) + 2;
        doc.x = leftColumnX;
      }

      // Home team - 2 kolommen layout
      if (interviews.home.players.length > 0 || interviews.home.coaches.length > 0) {
        doc.fontSize(12).font('Helvetica-Bold').text(`${match.homeTeamName}:`);
        doc.moveDown(0.3);

        const rowStartY = doc.y;
        let leftY = rowStartY;
        let rightY = rowStartY;

        // Coach links
        if (interviews.home.coaches.length > 0) {
          const coach = interviews.home.coaches[0];
          leftY = renderPerson(coach, leftColumnX, leftY);
        }

        // Spelers rechts
        if (interviews.home.players.length > 0) {
          for (const player of interviews.home.players) {
            rightY = renderPerson(player, rightColumnX, rightY);
            rightY += 20; // Spacing tussen spelers
          }
        }

        // Zet cursor onder de hoogste kolom
        doc.y = Math.max(leftY, rightY) + 2;
        doc.x = leftColumnX;
      }
      doc.moveDown(0.5);
    }

    // Interview rationale
    if (report?.interviewRationale) {
      doc.fontSize(13).font('Helvetica-Bold').text('Argumentatie voor spelerkeuze:', { underline: true });
      doc.moveDown(0.3);
      doc.fontSize(11).font('Helvetica').text(report.interviewRationale);
      doc.moveDown(0.5);
    }

    // Opmerkingen
    if (report?.remarks) {
      doc.fontSize(13).font('Helvetica-Bold').text('Opmerkingen:', { underline: true });
      doc.moveDown(0.3);
      doc.fontSize(11).font('Helvetica').text(report.remarks);
      doc.moveDown(0.5);
    }

    // Finalize PDF
    doc.end();
  } catch (err) {
    return next(err);
  }
});

// GET /api/production/:id/report/markdown - Download het productie rapport als Markdown
productionReportsRouter.get('/:id/report/markdown', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid production id' });

    const production = await prisma.production.findUnique({
      where: { id },
      include: {
        matchSchedule: true,
        productionReport: true,
        productionPersons: {
          include: {
            person: true,
          },
        },
        productionPositions: { // Production-wide position assignments
          include: {
            person: true,
            position: true,
          },
        },
        segments: {
          include: {
            bezetting: {
              include: {
                person: true,
                position: true,
              },
            },
          },
          orderBy: { volgorde: 'asc' },
        },
        interviewSubjects: {
          include: {
            player: {
              include: {
                club: true,
              },
            },
          },
        },
      },
    });

    if (!production) return res.status(404).json({ error: 'Production not found' });

    const report = production.productionReport;
    const match = production.matchSchedule;

    // --- NEW ATTENDEES LOGIC ---
    const assignedPersonIds = new Set<number>();
    production.segments.forEach((seg) => {
      seg.bezetting.forEach((b) => assignedPersonIds.add(b.person.id));
    });
    // Also consider production-wide assignments as "assigned"
    production.productionPositions.forEach((pp) => assignedPersonIds.add(pp.personId));

    const attendees: { name: string; isAssigned: boolean }[] = production.productionPersons
      .map((pp) => ({
        name: pp.person.name,
        isAssigned: assignedPersonIds.has(pp.person.id),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    // --- END NEW ATTENDEES LOGIC ---

    // Groepeer rollen per sectie (met isStudio info)
    const rolesBySection: Record<string, Array<{ positionName: string; personNames: string[]; isStudio: boolean }>> = {};

    // First, add production-wide assignments (these apply to all segments)
    const productionWidePositionMap = new Map<string, { names: Set<string>; isStudio: boolean }>();
    production.productionPositions.forEach((pp) => {
      if (!productionWidePositionMap.has(pp.position.name)) {
        productionWidePositionMap.set(pp.position.name, { names: new Set(), isStudio: pp.position.isStudio });
      }
      productionWidePositionMap.get(pp.position.name)!.names.add(pp.person.name);
    });

    // Then, add segment-specific assignments
    production.segments.forEach((segment) => {
      const section = mapSegmentToSection(segment.naam);
      if (!rolesBySection[section]) rolesBySection[section] = [];

      const positionMap = new Map<string, { names: Set<string>; isStudio: boolean }>();
      segment.bezetting.forEach((b) => {
        if (!positionMap.has(b.position.name)) {
          positionMap.set(b.position.name, { names: new Set(), isStudio: b.position.isStudio });
        }
        positionMap.get(b.position.name)!.names.add(b.person.name);
      });

      positionMap.forEach((data, posName) => {
        const existing = rolesBySection[section].find((r) => r.positionName === posName);
        if (existing) {
          data.names.forEach((n) => {
            if (!existing.personNames.includes(n)) existing.personNames.push(n);
          });
        } else {
          rolesBySection[section].push({
            positionName: posName,
            personNames: Array.from(data.names),
            isStudio: data.isStudio,
          });
        }
      });
    });

    // Add production-wide assignments to all sections (they apply globally)
    productionWidePositionMap.forEach((data, posName) => {
      Object.keys(rolesBySection).forEach((section) => {
        const existing = rolesBySection[section].find((r) => r.positionName === posName);
        if (existing) {
          data.names.forEach((n) => {
            if (!existing.personNames.includes(n)) existing.personNames.push(n);
          });
        } else {
          rolesBySection[section].push({
            positionName: posName,
            personNames: Array.from(data.names),
            isStudio: data.isStudio,
          });
        }
      });
    });

    // Sorteer
    Object.keys(rolesBySection).forEach((section) => {
      rolesBySection[section].sort((a, b) => a.positionName.localeCompare(b.positionName));
    });

    // Interview subjects
    const interviews = {
      home: {
        players: production.interviewSubjects.filter((s) => s.side === 'HOME' && s.role === 'PLAYER').map((s) => s.player),
        coaches: production.interviewSubjects.filter((s) => s.side === 'HOME' && s.role === 'COACH').map((s) => s.player),
      },
      away: {
        players: production.interviewSubjects.filter((s) => s.side === 'AWAY' && s.role === 'PLAYER').map((s) => s.player),
        coaches: production.interviewSubjects.filter((s) => s.side === 'AWAY' && s.role === 'COACH').map((s) => s.player),
      },
    };

    // Format datum en tijd
    const matchDate = new Date(match.date);
    const timeStr = matchDate.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
    const matchTitle = `${match.homeTeamName} - ${match.awayTeamName}: ${timeStr} uur`;

    // Bouw Markdown content
    let markdown = `# Livestream bezetting\n\n`;
    markdown += `${matchTitle}\n\n`;

    // Aanwezigen
    markdown += `## Aanwezig\n\n`;
    const attendeeNamesForMarkdown = attendees.map(p => {
      if (!p.isAssigned) {
        return `*(${p.name})*`;
      }
      return p.name;
    });
    markdown += `${attendeeNamesForMarkdown.join(', ') || 'Geen aanwezigen'}\n\n`;

    // Tijdschema
    const timing = calculateTiming(production.segments, matchDate, production.liveTime);
    if (timing.length > 0) {
      markdown += `## Tijdschema\n\n`;
      markdown += `| Segment | Start | Einde | Duur |\n`;
      markdown += `|---------|-------|-------|------|\n`;
      timing.forEach((segment) => {
        const startTime = new Date(segment.start).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
        const endTime = new Date(segment.end).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
        markdown += `| ${segment.naam} | ${startTime} | ${endTime} | ${segment.duurInMinuten} min |\n`;
      });
      markdown += `\n`;
    }

    // Wedstrijdsponsor
    if (report?.matchSponsor) {
      markdown += `## Wedstrijdsponsor\n\n`;
      markdown += `${report.matchSponsor}\n\n`;
    }

    // Positie bezetting
    markdown += `## Positie bezetting\n\n`;

    // Verzamel alle posities uit alle secties
    const allRoles: Array<{ positionName: string; personNames: string[]; isStudio: boolean }> = [];
    Object.values(rolesBySection).forEach((roles) => {
      roles.forEach((role) => {
        const existing = allRoles.find((r) => r.positionName === role.positionName);
        if (existing) {
          role.personNames.forEach((n) => {
            if (!existing.personNames.includes(n)) {
              existing.personNames.push(n);
            }
          });
        } else {
          allRoles.push({ positionName: role.positionName, personNames: [...role.personNames], isStudio: role.isStudio });
        }
      });
    });

    // Splits in Studio en Productie posities op basis van isStudio veld
    const studioRoles = allRoles.filter((r) => r.isStudio);
    const productieRoles = allRoles.filter((r) => !r.isStudio);

    // Studio posities
    markdown += `### Studio posities\n\n`;
    if (studioRoles.length === 0) {
      markdown += `*Geen posities toegewezen*\n\n`;
    } else {
      markdown += `| Positie | Naam |\n`;
      markdown += `|---------|------|\n`;
      studioRoles.forEach((role) => {
        markdown += `| ${role.positionName} | ${role.personNames.join(', ')} |\n`;
      });
      markdown += `\n`;
    }

    // Productie posities
    markdown += `### Productie posities\n\n`;
    if (productieRoles.length === 0) {
      markdown += `*Geen posities toegewezen*\n\n`;
    } else {
      markdown += `| Positie | Naam |\n`;
      markdown += `|---------|------|\n`;
      productieRoles.forEach((role) => {
        markdown += `| ${role.positionName} | ${role.personNames.join(', ')} |\n`;
      });
      markdown += `\n`;
    }

    // Interview sectie
    const allInterviewees = [...interviews.home.players, ...interviews.home.coaches, ...interviews.away.players, ...interviews.away.coaches];
    if (allInterviewees.length > 0) {
      markdown += `## Spelers voor interviews\n\n`;

      // Home team
      if (interviews.home.players.length > 0 || interviews.home.coaches.length > 0) {
        markdown += `### ${match.homeTeamName}\n\n`;

        if (interviews.home.coaches.length > 0) {
          const coach = interviews.home.coaches[0];
          markdown += `**${coach.name}**`;
          if (coach.function) markdown += ` - ${coach.function}`;
          markdown += `\n\n`;
        }

        interviews.home.players.forEach((player) => {
          markdown += `**${player.name}**`;
          if (player.shirtNo != null && player.shirtNo > 0) markdown += ` (#${player.shirtNo})`;
          if (player.function) markdown += ` - ${player.function}`;
          markdown += `\n\n`;
        });
      }

      // Away team
      if (interviews.away.players.length > 0 || interviews.away.coaches.length > 0) {
        markdown += `### ${match.awayTeamName}\n\n`;

        if (interviews.away.coaches.length > 0) {
          const coach = interviews.away.coaches[0];
          markdown += `**${coach.name}**`;
          if (coach.function) markdown += ` - ${coach.function}`;
          markdown += `\n\n`;
        }

        interviews.away.players.forEach((player) => {
          markdown += `**${player.name}**`;
          if (player.shirtNo != null && player.shirtNo > 0) markdown += ` (#${player.shirtNo})`;
          if (player.function) markdown += ` - ${player.function}`;
          markdown += `\n\n`;
        });
      }
    }

    // Interview rationale
    if (report?.interviewRationale) {
      markdown += `## Argumentatie voor spelerkeuze\n\n`;
      markdown += `${report.interviewRationale}\n\n`;
    }

    // Opmerkingen
    if (report?.remarks) {
      markdown += `## Opmerkingen\n\n`;
      markdown += `${report.remarks}\n\n`;
    }

    // Set response headers
    const filename = `Productie_Positie_Overzicht_${match.homeTeamName.replace(/[^a-z0-9]/gi, '_')}_${matchDate.toISOString().split('T')[0]}.md`;
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    return res.send(markdown);
  } catch (err) {
    return next(err);
  }
});

// GET /api/production/:id/report/whatsapp - Download het productie rapport als WhatsApp tekst
productionReportsRouter.get('/:id/report/whatsapp', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid production id' });

    const production = await prisma.production.findUnique({
      where: { id },
      include: {
        matchSchedule: true,
        productionReport: true,
        productionPersons: {
          include: {
            person: true,
          },
        },
        productionPositions: { // Production-wide position assignments
          include: {
            person: true,
            position: true,
          },
        },
        segments: {
          include: {
            bezetting: {
              include: {
                person: true,
                position: true,
              },
            },
          },
          orderBy: { volgorde: 'asc' },
        },
        interviewSubjects: {
          include: {
            player: {
              include: {
                club: true,
              },
            },
          },
        },
      },
    });

    if (!production) return res.status(404).json({ error: 'Production not found' });

    const report = production.productionReport;
    const match = production.matchSchedule;

    // --- NEW ATTENDEES LOGIC ---
    const assignedPersonIds = new Set<number>();
    production.segments.forEach((seg) => {
      seg.bezetting.forEach((b) => assignedPersonIds.add(b.person.id));
    });
    // Also consider production-wide assignments as "assigned"
    production.productionPositions.forEach((pp) => assignedPersonIds.add(pp.personId));

    const attendees: { name: string; isAssigned: boolean }[] = production.productionPersons
      .map((pp) => ({
        name: pp.person.name,
        isAssigned: assignedPersonIds.has(pp.person.id),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    // --- END NEW ATTENDEES LOGIC ---

    // Groepeer rollen per sectie (met isStudio info)
    const rolesBySection: Record<string, Array<{ positionName: string; personNames: string[]; isStudio: boolean }>> = {};

    // First, add production-wide assignments (these apply to all segments)
    const productionWidePositionMap = new Map<string, { names: Set<string>; isStudio: boolean }>();
    production.productionPositions.forEach((pp) => {
      if (!productionWidePositionMap.has(pp.position.name)) {
        productionWidePositionMap.set(pp.position.name, { names: new Set(), isStudio: pp.position.isStudio });
      }
      productionWidePositionMap.get(pp.position.name)!.names.add(pp.person.name);
    });

    // Then, add segment-specific assignments
    production.segments.forEach((segment) => {
      const section = mapSegmentToSection(segment.naam);
      if (!rolesBySection[section]) rolesBySection[section] = [];

      const positionMap = new Map<string, { names: Set<string>; isStudio: boolean }>();
      segment.bezetting.forEach((b) => {
        if (!positionMap.has(b.position.name)) {
          positionMap.set(b.position.name, { names: new Set(), isStudio: b.position.isStudio });
        }
        positionMap.get(b.position.name)!.names.add(b.person.name);
      });

      positionMap.forEach((data, posName) => {
        const existing = rolesBySection[section].find((r) => r.positionName === posName);
        if (existing) {
          data.names.forEach((n) => {
            if (!existing.personNames.includes(n)) existing.personNames.push(n);
          });
        } else {
          rolesBySection[section].push({
            positionName: posName,
            personNames: Array.from(data.names),
            isStudio: data.isStudio,
          });
        }
      });
    });

    // Add production-wide assignments to all sections (they apply globally)
    productionWidePositionMap.forEach((data, posName) => {
      Object.keys(rolesBySection).forEach((section) => {
        const existing = rolesBySection[section].find((r) => r.positionName === posName);
        if (existing) {
          data.names.forEach((n) => {
            if (!existing.personNames.includes(n)) existing.personNames.push(n);
          });
        } else {
          rolesBySection[section].push({
            positionName: posName,
            personNames: Array.from(data.names),
            isStudio: data.isStudio,
          });
        }
      });
    });

    // Sorteer
    Object.keys(rolesBySection).forEach((section) => {
      rolesBySection[section].sort((a, b) => a.positionName.localeCompare(b.positionName));
    });

    // Interview subjects
    const interviews = {
      home: {
        players: production.interviewSubjects.filter((s) => s.side === 'HOME' && s.role === 'PLAYER').map((s) => s.player),
        coaches: production.interviewSubjects.filter((s) => s.side === 'HOME' && s.role === 'COACH').map((s) => s.player),
      },
      away: {
        players: production.interviewSubjects.filter((s) => s.side === 'AWAY' && s.role === 'PLAYER').map((s) => s.player),
        coaches: production.interviewSubjects.filter((s) => s.side === 'AWAY' && s.role === 'COACH').map((s) => s.player),
      },
    };

    // Format datum en tijd
    const matchDate = new Date(match.date);
    const timeStr = matchDate.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
    const matchTitle = `${match.homeTeamName} - ${match.awayTeamName}: ${timeStr} uur`;

    // Bouw WhatsApp tekst (met emoji's voor opmaak)
    let text = `*🎬 Livestream bezetting*\n\n`;
    text += `${matchTitle}\n\n`;

    // Aanwezigen
    text += `*👥 Aanwezig*\n`;
    const whatsappAttendeeNames = attendees.map(p => {
      if (!p.isAssigned) {
        return `_(${p.name})_`;
      }
      return p.name;
    });
    text += `${whatsappAttendeeNames.join(', ') || 'Geen aanwezigen'}\n\n`;

    // Tijdschema
    const timing = calculateTiming(production.segments, matchDate, production.liveTime);
    if (timing.length > 0) {
      text += `*🕒 Tijdschema*\n`;
      timing.forEach((segment) => {
        const startTime = new Date(segment.start).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
        text += `• ${startTime} - ${segment.naam}\n`;
      });
      text += `\n`;
    }

    // Wedstrijdsponsor
    if (report?.matchSponsor) {
      text += `*🤝 Wedstrijdsponsor*\n`;
      text += `${report.matchSponsor}\n\n`;
    }

    // Positie bezetting
    text += `*📍 Positie bezetting*\n\n`;

    // Verzamel alle posities uit alle secties
    const allRoles: Array<{ positionName: string; personNames: string[]; isStudio: boolean }> = [];
    Object.values(rolesBySection).forEach((roles) => {
      roles.forEach((role) => {
        const existing = allRoles.find((r) => r.positionName === role.positionName);
        if (existing) {
          role.personNames.forEach((n) => {
            if (!existing.personNames.includes(n)) {
              existing.personNames.push(n);
            }
          });
        } else {
          allRoles.push({ positionName: role.positionName, personNames: [...role.personNames], isStudio: role.isStudio });
        }
      });
    });

    // Splits in Studio en Productie posities op basis van isStudio veld
    const studioRoles = allRoles.filter((r) => r.isStudio);
    const productieRoles = allRoles.filter((r) => !r.isStudio);

    // Studio posities
    text += `_Studio posities_\n`;
    if (studioRoles.length === 0) {
      text += `Geen posities toegewezen\n`;
    } else {
      studioRoles.forEach((role) => {
        text += `• ${role.positionName}: ${role.personNames.join(', ')}\n`;
      });
    }
    text += `\n`;

    // Productie posities
    text += `_Productie posities_\n`;
    if (productieRoles.length === 0) {
      text += `Geen posities toegewezen\n`;
    } else {
      productieRoles.forEach((role) => {
        text += `• ${role.positionName}: ${role.personNames.join(', ')}\n`;
      });
    }
    text += `\n`;

    // Interview sectie
    const allInterviewees = [...interviews.home.players, ...interviews.home.coaches, ...interviews.away.players, ...interviews.away.coaches];
    if (allInterviewees.length > 0) {
      text += `*🎤 Spelers voor interviews*\n\n`;

      // Away team
      if (interviews.away.players.length > 0 || interviews.away.coaches.length > 0) {
        text += `_${match.awayTeamName}_\n`;

        if (interviews.away.coaches.length > 0) {
          const coach = interviews.away.coaches[0];
          text += `• ${coach.name}`;
          if (coach.function) text += ` - ${coach.function}`;
          text += `\n`;
        }

        interviews.away.players.forEach((player) => {
          text += `• ${player.name}`;
          if (player.shirtNo != null && player.shirtNo > 0) text += ` (#${player.shirtNo})`;
          if (player.function) text += ` - ${player.function}`;
          text += `\n`;
        });
        text += `\n`;
      }

      // Home team
      if (interviews.home.players.length > 0 || interviews.home.coaches.length > 0) {
        text += `_${match.homeTeamName}_\n`;

        if (interviews.home.coaches.length > 0) {
          const coach = interviews.home.coaches[0];
          text += `• ${coach.name}`;
          if (coach.function) text += ` - ${coach.function}`;
          text += `\n`;
        }

        interviews.home.players.forEach((player) => {
          text += `• ${player.name}`;
          if (player.shirtNo != null && player.shirtNo > 0) text += ` (#${player.shirtNo})`;
          if (player.function) text += ` - ${player.function}`;
          text += `\n`;
        });
        text += `\n`;
      }
    }

    // Interview rationale
    if (report?.interviewRationale) {
      text += `*💭 Argumentatie voor spelerkeuze*\n`;
      text += `${report.interviewRationale}\n`;
    }

    // Opmerkingen
    if (report?.remarks) {
      text += `*📝 Opmerkingen*\n`;
      text += `${report.remarks}\n`;
    }

    // Set response headers
    const filename = `Productie_Positie_Overzicht_${match.homeTeamName.replace(/[^a-z0-9]/gi, '_')}_${matchDate.toISOString().split('T')[0]}.txt`;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    return res.send(text);
  } catch (err) {
    return next(err);
  }
});
