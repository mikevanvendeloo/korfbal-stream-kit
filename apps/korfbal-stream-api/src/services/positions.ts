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

/**
 * findOrCreatePosition for many names in one go (imports): reads the positions once and remembers what
 * it found or created, instead of reading the whole position table for every name.
 */
export function positionResolver(db: Db): (name: string, data?: Omit<Prisma.PositionUncheckedCreateInput, 'name'>) => Promise<Position> {
  let positions: Position[] | null = null;
  const byName = new Map<string, Position>();
  return async (name, data = {}) => {
    const key = name.trim().toLowerCase();
    const known = byName.get(key);
    if (known) return known;
    positions ??= await db.position.findMany();
    let position = findPositionByName(positions, name);
    if (!position) {
      position = await db.position.create({data: {...data, name: name.trim()}});
      positions.push(position);
    }
    byName.set(key, position);
    return position;
  };
}
