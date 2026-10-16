import type {NextFunction, Request, RequestHandler, Response} from 'express';
import type {Organization} from '@prisma/client';
import {prisma} from '../services/prisma';
import {getOrganizationId, runWithOrganization} from '../services/organizationContext';
import {findOrganizationByApiKey} from '../services/apiKeys';
import {isFeedApiPath, requestApiKey} from './apiKey';

export const ORGANIZATION_HEADER = 'X-Organization';

/** Lowercase letters, digits and single dashes; nothing that could reach a path or a query. */
export const ORGANIZATION_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const MAX_SLUG_LENGTH = 64;

/**
 * Routes on global data (D3): they work without an organization. With a valid X-Organization header
 * they still get the context, for the odd tenant lookup (e.g. a club's teams from the match schedule).
 * Paths are relative to the /api mount.
 */
export const GLOBAL_API_PATHS = ['/health', '/organizations', '/seasons', '/clubs', '/players', '/docs', '/openapi.json'];

export function isGlobalApiPath(path: string): boolean {
  return GLOBAL_API_PATHS.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

export function isValidOrganizationSlug(slug: string): boolean {
  return slug.length <= MAX_SLUG_LENGTH && ORGANIZATION_SLUG_PATTERN.test(slug);
}

export async function findActiveOrganization(slug: string): Promise<Organization | null> {
  if (!isValidOrganizationSlug(slug)) return null;
  const organization = await prisma.organization.findUnique({where: {slug}});
  return organization?.isActive ? organization : null;
}

/**
 * Resolves the X-Organization header (slug) to an active organization and runs the rest of the request
 * in its context: 401 without a header, 403 for an unknown or inactive organization. Global routes pass.
 */
export async function organizationContext(req: Request, res: Response, next: NextFunction) {
  if (isFeedApiPath(req.path)) {
    const apiKey = requestApiKey(req);
    if (apiKey !== undefined) return withApiKeyOrganization(apiKey, res, next);
    if (!req.get(ORGANIZATION_HEADER)?.trim()) return res.status(401).json({error: 'API-sleutel ontbreekt'});
  }
  // Elsewhere a key counts for nothing: without X-Organization the request gets 401 "Kies een organisatie"
  const global = isGlobalApiPath(req.path);
  const slug = (req.get(ORGANIZATION_HEADER) ?? '').trim();
  if (!slug) {
    if (global) return next();
    return res.status(401).json({error: 'Kies een organisatie'});
  }
  try {
    const organization = await findActiveOrganization(slug);
    if (!organization) {
      if (global) return next();
      return res.status(403).json({error: 'Onbekende of inactieve organisatie'});
    }
    res.locals.organization = organization;
    return runWithOrganization(organization.id, () => next());
  } catch (err) {
    return next(err);
  }
}

/** A feed request with an API key runs as the key's organization; the key wins over X-Organization. */
async function withApiKeyOrganization(apiKey: string | null, res: Response, next: NextFunction) {
  try {
    const organization = apiKey ? await findOrganizationByApiKey(apiKey) : null;
    // Unknown, revoked, or of an organization that was switched off: the key opens nothing
    if (!organization?.isActive) return res.status(401).json({error: 'Ongeldige API-sleutel'});
    res.locals.organization = organization;
    return runWithOrganization(organization.id, () => next());
  } catch (err) {
    return next(err);
  }
}

/**
 * Multer (and other stream-based middleware) calls `next` from a stream event, outside the request's
 * async context. Wrap it so the handlers after it run in the organization again.
 */
export function keepOrganizationContext(middleware: RequestHandler): RequestHandler {
  return (req, res, next) => {
    const organizationId = getOrganizationId();
    middleware(req, res, (err?: unknown) => {
      if (organizationId === undefined) return next(err);
      return runWithOrganization(organizationId, () => next(err));
    });
  };
}

/** The organization of this request (set by `organizationContext`). */
export function currentOrganization(res: Response): Organization | undefined {
  return res.locals.organization as Organization | undefined;
}
