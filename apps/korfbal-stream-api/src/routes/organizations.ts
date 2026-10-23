import {Router} from 'express';
import path from 'node:path';
import {Club, Organization, Prisma} from '@prisma/client';
import {prisma} from '../services/prisma';
import {getAssetsRoot} from '../services/config';
import {createOrganizationWithStandardSet} from '../services/standardSet';
import {saveImage, singleImage} from '../services/imageUpload';
import {ORGANIZATION_LOGO_DIR, organizationLogoRelPath} from '../services/sponsorLogos';
import {renameOrganizationLogoFiles} from '../services/logoStorage';
import {OrganizationCreateSchema, OrganizationUpdateSchema} from '../schemas/organization';
import {logger} from '../utils/logger';
import {resumeOrganization, stopOrganization} from '../services/organizationLifecycle';
import {clearOrganizationLookupCache} from '../middleware/organizationContext';

/**
 * Organizations are global (no X-Organization needed): the start screen lists the active ones, and
 * without login anyone may manage them in this step (design D10).
 */
export const organizationsRouter: Router = Router();

type OrganizationWithClub = Organization & {club: Pick<Club, 'logoUrl'> | null};

export function initials(name: string): string {
  const words = name.trim().split(/[\s/-]+/).filter(Boolean);
  return (words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? '?').slice(0, 2)).toUpperCase();
}

/**
 * The organization as the API shows it. `logoUrl` is the stored file name (`<slug>.<ext>`);
 * `displayLogoUrl` (relative to /storage, or http): own logo (organizations/<slug>.<ext>), else the club's.
 */
export function toOrganizationDto(organization: OrganizationWithClub) {
  const {club, ...rest} = organization;
  return {
    ...rest,
    displayLogoUrl: organizationLogoRelPath(organization) ?? club?.logoUrl ?? null,
    initials: initials(organization.name),
  };
}

const withClub = {club: {select: {logoUrl: true}}} as const;

async function findOrganization(id: number) {
  return Number.isInteger(id) && id > 0 ? prisma.organization.findUnique({where: {id}, include: withClub}) : null;
}

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

async function clubExists(clubId: number | null | undefined): Promise<boolean> {
  return clubId == null || !!(await prisma.club.findUnique({where: {id: clubId}, select: {id: true}}));
}

// GET /api/organizations            -> active organizations (start screen)
// GET /api/organizations?all=true   -> also the inactive ones (Beheer)
organizationsRouter.get('/', async (req, res, next) => {
  try {
    const all = req.query.all === 'true';
    const items = await prisma.organization.findMany({
      where: all ? {} : {isActive: true},
      include: withClub,
      orderBy: {name: 'asc'},
    });
    return res.json(items.map(toOrganizationDto));
  } catch (err) {
    return next(err);
  }
});

organizationsRouter.get('/:id', async (req, res, next) => {
  try {
    const organization = await findOrganization(Number(req.params.id));
    if (!organization) return res.status(404).json({error: 'Organisatie niet gevonden'});
    return res.json(toOrganizationDto(organization));
  } catch (err) {
    return next(err);
  }
});

// POST /api/organizations {name, slug, clubId?} -> new organization with the standard set
organizationsRouter.post('/', async (req, res, next) => {
  try {
    const parsed = OrganizationCreateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({error: 'Ongeldige organisatie', issues: parsed.error.issues});
    if (!(await clubExists(parsed.data.clubId))) return res.status(400).json({error: 'Club bestaat niet'});
    // One transaction: a failing standard set leaves no half-made organization behind
    const {organization: created, standardSet} = await createOrganizationWithStandardSet(parsed.data);
    logger.info(`Organization ${created.slug} created with the standard set`, standardSet);
    return res.status(201).json(toOrganizationDto({...created, club: null, ...(await findOrganization(created.id))}));
  } catch (err) {
    if (isUniqueViolation(err)) return res.status(409).json({error: 'Deze slug is al in gebruik'});
    return next(err);
  }
});

// PUT /api/organizations/:id {name?, slug?, clubId?, isActive?}
organizationsRouter.put('/:id', async (req, res, next) => {
  try {
    const existing = await findOrganization(Number(req.params.id));
    if (!existing) return res.status(404).json({error: 'Organisatie niet gevonden'});
    const parsed = OrganizationUpdateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({error: 'Ongeldige organisatie', issues: parsed.error.issues});
    if (!(await clubExists(parsed.data.clubId))) return res.status(400).json({error: 'Club bestaat niet'});
    const renaming = !!parsed.data.slug && parsed.data.slug !== existing.slug;
    // The stored logo name follows the slug (organizations/<slug>.<ext>)
    const logo = renaming ? organizationLogoRelPath({slug: parsed.data.slug!, logoUrl: existing.logoUrl}) : null;
    const data = logo ? {...parsed.data, logoUrl: path.basename(logo)} : parsed.data;
    const update = () => prisma.organization.update({where: {id: existing.id}, data, include: withClub});
    // A new slug moves its logo files along: files first, moved back when the update fails; 409 when
    // something for the new slug is already on disk (services/logoStorage.ts)
    const updated = renaming ? await renameOrganizationLogoFiles(existing.slug, parsed.data.slug!, update) : await update();
    // A renamed slug or a switched-off organization takes effect on the next request, not after the cache
    clearOrganizationLookupCache();
    // Switched off: its live show, timers and sockets stop now, not at the next restart
    if (existing.isActive && !updated.isActive) stopOrganization(updated.id);
    if (!existing.isActive && updated.isActive) await resumeOrganization(updated.id);
    return res.json(toOrganizationDto(updated));
  } catch (err) {
    if (isUniqueViolation(err)) return res.status(409).json({error: 'Deze slug is al in gebruik'});
    return next(err);
  }
});

// POST /api/organizations/:id/logo (multipart, field "file") -> storage/organizations/<slug>.<ext>
// Only the file name is stored. A slug rename moves the file, so a new organization that later takes
// the old slug starts without a logo.
organizationsRouter.post('/:id/logo', singleImage('file'), async (req, res, next) => {
  try {
    const organization = await findOrganization(Number(req.params.id));
    if (!organization) return res.status(404).json({error: 'Organisatie niet gevonden'});
    if (!req.file) return res.status(400).json({error: 'Geen bestand ontvangen'});
    const fileName = saveImage(path.join(getAssetsRoot(), ORGANIZATION_LOGO_DIR), organization.slug, req.file);
    const updated = await prisma.organization.update({
      where: {id: organization.id},
      data: {logoUrl: fileName},
      include: withClub,
    });
    clearOrganizationLookupCache();
    return res.json(toOrganizationDto(updated));
  } catch (err) {
    return next(err);
  }
});

// DELETE /api/organizations/:id/logo -> back to the club logo / initials
organizationsRouter.delete('/:id/logo', async (req, res, next) => {
  try {
    const organization = await findOrganization(Number(req.params.id));
    if (!organization) return res.status(404).json({error: 'Organisatie niet gevonden'});
    const updated = await prisma.organization.update({where: {id: organization.id}, data: {logoUrl: null}, include: withClub});
    clearOrganizationLookupCache();
    return res.json(toOrganizationDto(updated));
  } catch (err) {
    return next(err);
  }
});
