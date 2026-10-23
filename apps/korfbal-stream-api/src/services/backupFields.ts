import {Prisma} from '@prisma/client';

type TitlePartBackup = {
  sourceType: string;
  teamSide?: string | null;
  limit?: number | null;
  filters?: unknown;
  customFunction?: string | null;
  customName?: string | null;
};

/**
 * Title parts from a backup, ready for `parts: {create}`. Only the known fields; an exported `filters:
 * null` (a NULL in the database) must become Prisma.DbNull, a literal null is refused for a Json column
 * and would fail the whole production restore.
 */
export function titlePartsForCreate(parts: unknown): Prisma.TitlePartCreateWithoutDefinitionInput[] {
  if (!Array.isArray(parts)) return [];
  return (parts as TitlePartBackup[]).map((part) => ({
    sourceType: part.sourceType as any,
    teamSide: (part.teamSide ?? undefined) as any,
    limit: part.limit ?? null,
    filters: part.filters == null ? Prisma.DbNull : (part.filters as Prisma.InputJsonValue),
    customFunction: part.customFunction ?? null,
    customName: part.customName ?? null,
  }));
}
