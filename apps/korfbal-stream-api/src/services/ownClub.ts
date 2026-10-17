import {prisma} from './prisma';
import {requireOrganizationId} from './organizationContext';
import {clearOrganizationLookupCache} from '../middleware/organizationContext';

/**
 * The own club of the organization in the context: `Organization.clubId`, the one source for it
 * (Beheer → Organisaties and Instellingen → Club both read and write it). It decides {eigen} /
 * {tegenstander} in interview placeholders and the home/away side.
 */
export async function getOwnClubId(): Promise<number | null> {
  const organization = await prisma.organization.findUnique({where: {id: requireOrganizationId('The own club')}, select: {clubId: true}});
  return organization?.clubId ?? null;
}

/** Sets (or with null clears) the own club; false when the club doesn't exist. */
export async function setOwnClubId(clubId: number | null): Promise<boolean> {
  if (clubId !== null && !(await prisma.club.findUnique({where: {id: clubId}, select: {id: true}}))) return false;
  await prisma.organization.update({where: {id: requireOrganizationId('The own club')}, data: {clubId}});
  clearOrganizationLookupCache();
  return true;
}
