import {Position, Prisma, PrismaClient} from '@prisma/client';
import {findPositionByName} from '../domain/positionSkill';

type Db = PrismaClient | Prisma.TransactionClient;

/** The existing position with this name (ignoring case, spacing and known aliases), if any. */
export async function findExistingPosition(db: Db, name: string): Promise<Position | undefined> {
  return findPositionByName(await db.position.findMany(), name);
}

/**
 * The position meant by `name`, created only when no position matches it. Imports must use this
 * instead of an exact name lookup, or "regie" ends up next to "Regie livestream".
 */
export async function findOrCreatePosition(
  db: Db,
  name: string,
  data: Omit<Prisma.PositionUncheckedCreateInput, 'name'> = {},
): Promise<Position> {
  return (await findExistingPosition(db, name)) ?? db.position.create({data: {...data, name: name.trim()}});
}
