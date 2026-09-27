import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {migrateLegacySeasonAssets} from './seasonAssetMigration';

type PlayerRow = { id: number; photoUrl: string | null; seasonId: number };

const SEASONS: Record<number, number> = {1: 2025, 2: 2026};

function createDb(players: PlayerRow[], playerImageFiles: string[] = []) {
  return {
    player: {
      findMany: vi.fn(async ({where}: any) =>
        players
          .filter((p) => p.photoUrl?.startsWith(where.photoUrl.startsWith))
          .map((p) => ({...p, season: {startYear: SEASONS[p.seasonId]}})),
      ),
      updateMany: vi.fn(async ({where, data}: any) => {
        const matching = players.filter((p) => p.photoUrl === where.photoUrl && p.seasonId === where.seasonId);
        matching.forEach((p) => (p.photoUrl = data.photoUrl));
        return {count: matching.length};
      }),
    },
    playerImage: {
      findMany: vi.fn(async () => playerImageFiles.map((filename) => ({filename}))),
    },
  } as any;
}

describe('migrateLegacySeasonAssets', () => {
  let root: string;
  const write = (rel: string, content = 'x') => {
    const full = path.join(root, rel);
    fs.mkdirSync(path.dirname(full), {recursive: true});
    fs.writeFileSync(full, content);
  };
  const exists = (rel: string) => fs.existsSync(path.join(root, rel));
  const read = (rel: string) => fs.readFileSync(path.join(root, rel), 'utf8');

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'season-assets-'));
  });

  afterEach(() => {
    fs.rmSync(root, {recursive: true, force: true});
  });

  it('moves KNKV player photos into the season dir of their player and rewrites photoUrl', async () => {
    write('players/ldodk-jan.jpg', 'jan');
    const players: PlayerRow[] = [
      {id: 1, photoUrl: 'players/ldodk-jan.jpg', seasonId: 1},
      {id: 2, photoUrl: 'https://remote/photo.jpg', seasonId: 1},
      {id: 3, photoUrl: null, seasonId: 1},
    ];

    const summary = await migrateLegacySeasonAssets({db: createDb(players), assetsRoot: root});

    expect(players[0].photoUrl).toBe('seasons/2025-2026/players/ldodk-jan.jpg');
    expect(read('seasons/2025-2026/players/ldodk-jan.jpg')).toBe('jan');
    expect(exists('players/ldodk-jan.jpg')).toBe(false);
    expect(players[1].photoUrl).toBe('https://remote/photo.jpg');
    expect(summary).toMatchObject({photosMoved: 1, photoUrlsUpdated: 1, photosMissing: 0});
  });

  it('copies a shared legacy file into every season that references it before removing the source', async () => {
    write('players/shared.jpg');
    const players: PlayerRow[] = [
      {id: 1, photoUrl: 'players/shared.jpg', seasonId: 1},
      {id: 2, photoUrl: 'players/shared.jpg', seasonId: 2},
    ];

    await migrateLegacySeasonAssets({db: createDb(players), assetsRoot: root});

    expect(players.map((p) => p.photoUrl)).toEqual([
      'seasons/2025-2026/players/shared.jpg',
      'seasons/2026-2027/players/shared.jpg',
    ]);
    expect(exists('seasons/2025-2026/players/shared.jpg')).toBe(true);
    expect(exists('seasons/2026-2027/players/shared.jpg')).toBe(true);
    expect(exists('players/shared.jpg')).toBe(false);
  });

  it('leaves manual PlayerImage uploads and the players referencing them untouched', async () => {
    write('players/manual.png');
    const players: PlayerRow[] = [{id: 1, photoUrl: 'players/manual.png', seasonId: 1}];

    const summary = await migrateLegacySeasonAssets({db: createDb(players, ['players/manual.png']), assetsRoot: root});

    expect(players[0].photoUrl).toBe('players/manual.png');
    expect(exists('players/manual.png')).toBe(true);
    expect(exists('seasons')).toBe(false);
    expect(summary.sharedWithPlayerImage).toBe(1);
  });

  it('does not rewrite photoUrl when the source file is missing', async () => {
    const players: PlayerRow[] = [{id: 1, photoUrl: 'players/gone.jpg', seasonId: 1}];

    const summary = await migrateLegacySeasonAssets({db: createDb(players), assetsRoot: root});

    expect(players[0].photoUrl).toBe('players/gone.jpg');
    expect(summary.photosMissing).toBe(1);
  });

  it('never overwrites a different existing target and keeps the legacy file, but still updates the URL', async () => {
    write('players/p.jpg', 'legacy');
    write('seasons/2025-2026/players/p.jpg', 'already-there');
    const players: PlayerRow[] = [{id: 1, photoUrl: 'players/p.jpg', seasonId: 1}];

    const summary = await migrateLegacySeasonAssets({db: createDb(players), assetsRoot: root});

    expect(read('seasons/2025-2026/players/p.jpg')).toBe('already-there');
    expect(read('players/p.jpg')).toBe('legacy');
    expect(players[0].photoUrl).toBe('seasons/2025-2026/players/p.jpg');
    expect(summary).toMatchObject({photosMoved: 0, photoUrlsUpdated: 1, legacyPhotosKept: 1});
  });

  it('removes the legacy file when the existing target is byte-identical', async () => {
    write('players/same.jpg', 'same-bytes');
    write('seasons/2025-2026/players/same.jpg', 'same-bytes');
    const players: PlayerRow[] = [{id: 1, photoUrl: 'players/same.jpg', seasonId: 1}];

    const summary = await migrateLegacySeasonAssets({db: createDb(players), assetsRoot: root});

    expect(exists('players/same.jpg')).toBe(false);
    expect(players[0].photoUrl).toBe('seasons/2025-2026/players/same.jpg');
    expect(summary).toMatchObject({photosMoved: 0, photoUrlsUpdated: 1, legacyPhotosKept: 0});
  });

  it('keeps the legacy file when only one of several seasons already has a different copy', async () => {
    write('players/mixed.jpg', 'legacy');
    write('seasons/2026-2027/players/mixed.jpg', 'other');
    const players: PlayerRow[] = [
      {id: 1, photoUrl: 'players/mixed.jpg', seasonId: 1},
      {id: 2, photoUrl: 'players/mixed.jpg', seasonId: 2},
    ];

    await migrateLegacySeasonAssets({db: createDb(players), assetsRoot: root});

    expect(read('seasons/2025-2026/players/mixed.jpg')).toBe('legacy');
    expect(read('players/mixed.jpg')).toBe('legacy');
  });

  it('relinks a missing legacy file to a copy found in a season players dir', async () => {
    write('seasons/2024-2025/players/moved.jpg', 'moved');
    const players: PlayerRow[] = [{id: 1, photoUrl: 'players/moved.jpg', seasonId: 1}];

    const summary = await migrateLegacySeasonAssets({db: createDb(players), assetsRoot: root});

    expect(players[0].photoUrl).toBe('seasons/2024-2025/players/moved.jpg');
    expect(summary).toMatchObject({photosRelinked: 1, photosMissing: 0, photoUrlsUpdated: 1});
  });

  it('prefers the own season dir when relinking a missing legacy file', async () => {
    write('seasons/2024-2025/players/both.jpg');
    write('seasons/2025-2026/players/both.jpg');
    const players: PlayerRow[] = [{id: 1, photoUrl: 'players/both.jpg', seasonId: 1}];

    await migrateLegacySeasonAssets({db: createDb(players), assetsRoot: root});

    expect(players[0].photoUrl).toBe('seasons/2025-2026/players/both.jpg');
  });

  it('skips the PlayerImage query when no player has a legacy photoUrl', async () => {
    const db = createDb([{id: 1, photoUrl: 'seasons/2025-2026/players/x.jpg', seasonId: 1}]);

    await migrateLegacySeasonAssets({db, assetsRoot: root});

    expect(db.playerImage.findMany).not.toHaveBeenCalled();
  });

  it('skips photo URLs that try to escape the players directory', async () => {
    write('secret.txt');
    const players: PlayerRow[] = [{id: 1, photoUrl: 'players/../secret.txt', seasonId: 1}];

    await migrateLegacySeasonAssets({db: createDb(players), assetsRoot: root});

    expect(players[0].photoUrl).toBe('players/../secret.txt');
    expect(exists('secret.txt')).toBe(true);
  });

  it('moves legacy team responses into the 2025/2026 season dir', async () => {
    write('team-responses/team-9-1.json', '{"a":1}');
    write('team-responses/team-12-1.json', '{"new":true}');
    write('team-responses/notes.txt');
    write('seasons/2025-2026/team-responses/team-12-1.json', '{"old":true}');

    const summary = await migrateLegacySeasonAssets({db: createDb([]), assetsRoot: root});

    expect(read('seasons/2025-2026/team-responses/team-9-1.json')).toBe('{"a":1}');
    expect(exists('team-responses/team-9-1.json')).toBe(false);
    expect(read('seasons/2025-2026/team-responses/team-12-1.json')).toBe('{"old":true}');
    expect(exists('team-responses/notes.txt')).toBe(true);
    expect(summary).toMatchObject({teamResponsesMoved: 1, teamResponsesSkipped: 1});
  });

  it('is idempotent', async () => {
    write('players/a.jpg');
    write('team-responses/t.json');
    const players: PlayerRow[] = [{id: 1, photoUrl: 'players/a.jpg', seasonId: 2}];
    const db = createDb(players);

    await migrateLegacySeasonAssets({db, assetsRoot: root});
    const second = await migrateLegacySeasonAssets({db, assetsRoot: root});

    expect(players[0].photoUrl).toBe('seasons/2026-2027/players/a.jpg');
    expect(second).toEqual({
      photosMoved: 0,
      photoUrlsUpdated: 0,
      photosMissing: 0,
      photosRelinked: 0,
      legacyPhotosKept: 0,
      sharedWithPlayerImage: 0,
      teamResponsesMoved: 0,
      teamResponsesSkipped: 0,
    });
  });
});
