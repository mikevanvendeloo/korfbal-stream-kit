import {Router} from 'express';
import path from 'node:path';
import {Club, Organization, Prisma} from '@prisma/client';
import {prisma} from '../services/prisma';
import {getAssetsRoot} from '../services/config';
import {applyStandardSet} from '../services/standardSet';
import {saveImage, singleImage} from '../services/imageUpload';
import {OrganizationCreateSchema, OrganizationUpdateSchema} from '../schemas/organization';
import {logger} from '../utils/logger';

/**
 * Organizations are global (no X-Organization needed): the start screen lists the active ones, and
 * without login anyone may manage them in this step (design D10).
 */
export const organizationsRouter: Router = Router();

export const ORGANIZATION_LOGO_DIR = 'organizations';

type OrganizationWithClub = Organization & {club: Pick<Club, 'logoUrl'> | null};

export function initials(name: string): string {
  const words = name.trim().split(/[\s/-]+/).filter(Boolean);
  return (words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? '?').slice(0, 2)).toUpperCase();
}

/** The organization as the API shows it. `displayLogoUrl` (relative to /storage, or http): own logo, else the club's. */
export function toOrganizationDto(organization: OrganizationWithClub) {
  const {club, ...rest} = organization;
  return {
    ...rest,
    displayLogoUrl: organization.logoUrl ?? club?.logoUrl ?? null,
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
    const created = await prisma.organization.create({data: parsed.data});
    const standardSet = await applyStandardSet(created.id);
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
    const updated = await prisma.organization.update({where: {id: existing.id}, data: parsed.data, include: withClub});
    return res.json(toOrganizationDto(updated));
  } catch (err) {
    if (isUniqueViolation(err)) return res.status(409).json({error: 'Deze slug is al in gebruik'});
    return next(err);
  }
});

// POST /api/organizations/:id/logo (multipart, field "file") -> storage/organizations/<id>.<ext>
// Keyed on the id, not the slug: a slug can be renamed and then taken by a new organization.
organizationsRouter.post('/:id/logo', singleImage('file'), async (req, res, next) => {
  try {
    const organization = await findOrganization(Number(req.params.id));
    if (!organization) return res.status(404).json({error: 'Organisatie niet gevonden'});
    if (!req.file) return res.status(400).json({error: 'Geen bestand ontvangen'});
    const fileName = saveImage(path.join(getAssetsRoot(), ORGANIZATION_LOGO_DIR), String(organization.id), req.file);
    const updated = await prisma.organization.update({
      where: {id: organization.id},
      data: {logoUrl: `${ORGANIZATION_LOGO_DIR}/${fileName}`},
      include: withClub,
    });
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
    return res.json(toOrganizationDto(updated));
  } catch (err) {
    return next(err);
  }
});
