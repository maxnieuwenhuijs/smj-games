import { describe, expect, it } from 'vitest';
import { FEATURE, SPECIES, type SpeciesId } from './data';
import { Grid, FULL_LAND, W, tileIndex, tileXY } from './grid';
import { CLUES, FACE_PAINTS, PARADE, guessChoices, nearestTile, paintId, paintNext, paradeLoop, paradeWait } from './guestfun';

/** Een vaste rij gokgetallen, zodat een test elke keer hetzelfde doet. */
function seeded(seed: number): () => number {
  return () => (seed = (seed * 16807) % 2147483647) / 2147483647;
}

describe('de weg wijzen', () => {
  it('de gast loopt naar het pad het dichtst bij je vinger, niet te ver weg', () => {
    const tiles = [tileIndex(2, 2), tileIndex(5, 2), tileIndex(9, 9)];
    expect(nearestTile(tiles, 5.4, 2.6, 3, tileXY)).toBe(tileIndex(5, 2));
    expect(nearestTile(tiles, 2.5, 3.9, 3, tileXY)).toBe(tileIndex(2, 2));
    // te ver van elk pad: daar kan de gast niet heen
    expect(nearestTile(tiles, 15, 15, 3, tileXY)).toBe(null);
    expect(nearestTile([], 1, 1, 3, tileXY)).toBe(null);
  });
});

describe('de schminktent', () => {
  it('schildert het gekozen gezicht, en anders een van de vier', () => {
    expect(paintNext([paintId('panda')])).toBe('panda');
    expect(paintNext(['paint_cat'])).toBe('cat');
    const rnd = seeded(7);
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) seen.add(paintNext([], rnd));
    expect([...seen].sort()).toEqual([...FACE_PAINTS].sort());
  });

  it('komt in een eigen level, na de paden', () => {
    expect(FEATURE.facepaint).toBeGreaterThan(FEATURE.paths);
  });
});

describe('raad het lievelingsdier', () => {
  it('elk dier heeft een kleur en een aantal poten', () => {
    for (const sp of Object.keys(SPECIES) as SpeciesId[]) {
      expect(CLUES[sp].colors.length, sp).toBeGreaterThan(0);
      for (const c of CLUES[sp].colors) expect(c, sp).toMatch(/^#[0-9a-f]{6}$/);
      expect([0, 2, 4], sp).toContain(CLUES[sp].legs);
    }
    expect(CLUES.chicken.legs).toBe(2);
    expect(CLUES.dolphin.legs).toBe(0);
  });

  it('drie plaatjes van dieren uit het park, met het goede dier erbij', () => {
    const rnd = seeded(3);
    for (let i = 0; i < 100; i++) {
      const park = ['pig', 'cow', 'sheep', 'horse', 'lion'];
      const options = guessChoices('cow', park, rnd)!;
      expect(options).toHaveLength(3);
      expect(options).toContain('cow');
      expect(new Set(options).size).toBe(3);
      for (const sp of options) expect(park).toContain(sp);
    }
    // te weinig soorten: dan valt er niets te raden
    expect(guessChoices('cow', ['cow', 'pig'])).toBe(null);
    expect(guessChoices('cow', ['pig', 'sheep'])).toEqual(expect.arrayContaining(['cow', 'pig', 'sheep']));
  });

  it('liefst dieren die er anders uitzien, zodat je het kunt raden', () => {
    const rnd = seeded(11);
    // de zebra is zwart-wit met vier poten, net als de koe; de kip en de leeuw zien er anders uit
    for (let i = 0; i < 50; i++) expect(guessChoices('cow', ['zebra', 'chicken', 'lion', 'cow'], rnd)!.sort()).toEqual(['chicken', 'cow', 'lion']);
  });
});

describe('de optocht', () => {
  it('de clown loopt over het pad, steeds naar een buurtegel', () => {
    const g = new Grid(FULL_LAND);
    // een pad in de vorm van een rondje: de rand van een blok van 6 bij 6
    const path = new Set<number>();
    for (let x = 4; x < 10; x++) for (const y of [4, 9]) path.add(tileIndex(x, y));
    for (let y = 4; y < 10; y++) for (const x of [4, 9]) path.add(tileIndex(x, y));
    const next = (t: number): number[] => g.neighbors(t).filter(n => path.has(n));
    const route = paradeLoop(tileIndex(4, 4), next, PARADE.steps, seeded(5));
    expect(route[0]).toBe(tileIndex(4, 4));
    expect(route).toHaveLength(PARADE.steps + 1);
    for (let i = 1; i < route.length; i++) {
      expect(path.has(route[i])).toBe(true);
      const [ax, ay] = tileXY(route[i - 1]), [bx, by] = tileXY(route[i]);
      expect(Math.abs(ax - bx) + Math.abs(ay - by)).toBe(1);
    }
    // op een rondje keert hij niet om: hij loopt steeds naar een nieuwe tegel
    expect(new Set(route).size).toBe(route.length);
  });

  it('in een doodlopend stuk keert hij om, en zonder pad blijft hij staan', () => {
    const line = [tileIndex(2, 2), tileIndex(3, 2), tileIndex(4, 2)];
    const next = (t: number): number[] => line.filter(n => Math.abs(n - t) === 1 && Math.floor(n / W) === Math.floor(t / W));
    const route = paradeLoop(line[0], next, 6, seeded(2));
    expect(route).toEqual([line[0], line[1], line[2], line[1], line[0], line[1], line[2]]);
    expect(paradeLoop(line[0], () => [], 6)).toEqual([line[0]]);
  });

  it('na een optocht rust de clown even uit', () => {
    expect(paradeWait(100, 100)).toBe(PARADE.rest);
    expect(paradeWait(100 + PARADE.rest, 100)).toBe(0);
    expect(paradeWait(5, -1e9)).toBe(0);
    expect(PARADE.rest).toBeGreaterThanOrEqual(120);
    expect(FEATURE.parade).toBeGreaterThan(FEATURE.paths);
  });
});
