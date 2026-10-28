import {describe, expect, it, vi} from 'vitest';
import type {Position} from '@prisma/client';
import {positionResolver} from './positions';

const position = (id: number, name: string) => ({id, name}) as Position;

describe('positionResolver', () => {
  it('reads the positions once, matches names like findPositionByName and creates an unknown one once', async () => {
    const findMany = vi.fn(async () => [position(1, 'Regie livestream'), position(2, 'Camera links')]);
    const create = vi.fn(async ({data}: { data: { name: string } }) => position(3, data.name));
    const positionOf = positionResolver({position: {findMany, create}} as never);

    expect((await positionOf('regie')).id).toBe(1);
    expect((await positionOf('Camera links')).id).toBe(2);
    expect((await positionOf('Oplopen volgspot')).id).toBe(3);
    expect((await positionOf(' oplopen volgspot ')).id).toBe(3);
    expect((await positionOf('Camera links')).id).toBe(2);

    expect(findMany).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith({data: {name: 'Oplopen volgspot'}});
  });
});
