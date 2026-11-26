import { describe, expect, it } from 'vitest';
import { Grid, type Edge } from './grid';
import { WALK, angleDiff, ahead, bobHeight, clampPitch, pickLook, rightOf, standsFree, stepWalker, stickInput, type Box, type WalkGround } from './walk';

/** Een stukje park om in te lopen: hekken uit het raster, en blokken op de tegels die je opgeeft. */
function ground(grid: Grid, solid: [number, number][] = []): WalkGround {
  const full = new Set(solid.map(([x, y]) => `${x},${y}`));
  return {
    boxes: (x, y): Box[] => (!grid.inBounds(x, y) || full.has(`${x},${y}`) ? [[x, y, x + 1, y + 1]] : []),
    wall: (o, x, y) => grid.getEdge({ o, x, y }) !== 0,
  };
}

/** Een hele tijd rechtdoor lopen, in beeldjes van 1/60 tel. */
function walk(g: WalkGround, x: number, y: number, vx: number, vy: number, seconds: number): [number, number] {
  let p: [number, number] = [x, y];
  for (let t = 0; t < seconds; t += 1 / 60) p = stepWalker(p[0], p[1], vx / 60, vy / 60, g);
  return p;
}

describe('rondlopen in het park', () => {
  const grid = new Grid();
  const { x0, y0, x1, y1 } = grid.land;
  const mx = Math.floor((x0 + x1) / 2), my = Math.floor((y0 + y1) / 2);

  it('in het open veld loop je gewoon door', () => {
    const [x, y] = stepWalker(mx + 0.5, my + 0.5, 0.3, -0.2, ground(grid));
    expect(x).toBeCloseTo(mx + 0.8);
    expect(y).toBeCloseTo(my + 0.3);
  });

  it('je loopt niet door een hek, ook niet als je hard gaat', () => {
    const g = new Grid();
    const e: Edge = { o: 'v', x: mx + 1, y: my };
    g.setEdge(e, 1);
    const [x] = walk(ground(g), mx + 0.5, my + 0.5, 3, 0, 2);
    expect(x).toBeLessThanOrEqual(mx + 1 - WALK.radius + 1e-6);
    expect(x).toBeGreaterThan(mx + 1 - WALK.radius - 0.01);
    // in één grote sprong ook niet
    const [x2] = stepWalker(mx + 0.5, my + 0.5, 2, 0, ground(g));
    expect(x2).toBeLessThan(mx + 1);
  });

  it('schuin tegen een hek glijd je er langs', () => {
    const g = new Grid();
    for (let y = my - 3; y <= my + 3; y++) g.setEdge({ o: 'v', x: mx + 1, y }, 1);
    const [x, y] = walk(ground(g), mx + 0.5, my + 0.5, 1, 1, 1);
    expect(x).toBeLessThan(mx + 1);
    // vooruit (naar het zuiden) ging gewoon door
    expect(y).toBeGreaterThan(my + 1.3);
  });

  it('door een gebouw, boom of verblijf (een hele tegel) kun je niet, en je glijdt om de hoek', () => {
    const g = ground(grid, [[mx + 1, my]]);
    const [x] = walk(g, mx + 0.5, my + 0.5, 1, 0, 2);
    expect(x).toBeCloseTo(mx + 1 - WALK.radius, 5);
    // net naast de tegel langs: dan kun je erlangs
    const [, y] = walk(g, mx + 0.5, my + 1.5, 1, 0, 2);
    expect(y).toBeCloseTo(my + 1.5, 5);
  });

  it('je loopt niet van het park af', () => {
    const [x, y] = walk(ground(grid), x0 + 0.5, y1 - 0.5, -1, 1, 4);
    expect(x).toBeGreaterThanOrEqual(x0 + WALK.radius - 1e-6);
    expect(y).toBeLessThanOrEqual(y1 - WALK.radius + 1e-6);
    expect(standsFree(x, y, ground(grid))).toBe(true);
  });

  it('in een hoekje blijf je staan, zonder te trillen', () => {
    const g = new Grid();
    g.setEdge({ o: 'v', x: mx + 1, y: my }, 1);
    g.setEdge({ o: 'h', x: mx, y: my }, 1);
    const a = walk(ground(g), mx + 0.5, my + 0.5, 1, -1, 2);
    const b = walk(ground(g), a[0], a[1], 1, -1, 0.5);
    expect(a[0]).toBeCloseTo(b[0], 6);
    expect(a[1]).toBeCloseTo(b[1], 6);
    expect(a[0]).toBeCloseTo(mx + 1 - WALK.radius, 5);
    expect(a[1]).toBeCloseTo(my + WALK.radius, 5);
  });

  it('kan je ergens staan?', () => {
    const g = ground(grid, [[mx, my]]);
    expect(standsFree(mx + 0.5, my + 0.5, g)).toBe(false);
    expect(standsFree(mx + 1.5, my + 0.5, g)).toBe(true);
    expect(standsFree(mx + 1.1, my + 0.5, g)).toBe(false);
  });

  it('vooruit, rechts en de richting', () => {
    // richting 0 is naar het zuiden; rechts is dan naar het westen (zo kijkt de camera in three.js)
    expect(ahead(0)[1]).toBeCloseTo(1);
    expect(rightOf(0)[0]).toBeCloseTo(-1);
    const [fx, fy] = ahead(1.1), [rx, ry] = rightOf(1.1);
    expect(fx * rx + fy * ry).toBeCloseTo(0);
    expect(angleDiff(0.1, Math.PI * 2 - 0.1)).toBeCloseTo(0.2);
    expect(angleDiff(-3, 3)).toBeCloseTo(Math.PI * 2 - 6);
  });
});

describe('kijken naar dieren en gasten', () => {
  const at = (gx: number, gy: number, r = 0.3, h = 0.4) => ({ gx, gy, h, r });

  it('je ziet wat recht voor je staat, niet wat naast of achter je staat', () => {
    // je staat op (10, 10) en kijkt naar het zuiden (+y)
    const list = [at(10, 7), at(13, 10), at(10.1, 13)];
    expect(pickLook(10, 10, WALK.eye, 0, 0, list)).toBe(2);
    expect(pickLook(10, 10, WALK.eye, Math.PI, 0, list)).toBe(0);
    expect(pickLook(10, 10, WALK.eye, -Math.PI / 2, 0, list)).toBe(-1);
    expect(pickLook(10, 10, WALK.eye, Math.PI / 2, 0, list)).toBe(1);
  });

  it('te ver weg telt niet', () => {
    expect(pickLook(10, 10, WALK.eye, 0, 0, [at(10, 10 + WALK.lookRange + 1)])).toBe(-1);
    expect(pickLook(10, 10, WALK.eye, 0, 0, [at(10, 10 + WALK.lookRange - 0.5)])).toBe(0);
  });

  it('het dichtst bij het midden wint; bij gelijk het dichtst bij jou', () => {
    expect(pickLook(10, 10, WALK.eye, 0, 0, [at(10.4, 13), at(10, 14)])).toBe(1);
    expect(pickLook(10, 10, WALK.eye, 0, 0, [at(10, 14), at(10, 12)])).toBe(1);
  });

  it('een groot dier raak je ook als je er een beetje naast kijkt', () => {
    const off = Math.atan2(0.8, 3);
    expect(pickLook(10, 10, WALK.eye, off, 0, [at(10, 13, 0.3)])).toBe(-1);
    expect(pickLook(10, 10, WALK.eye, off, 0, [at(10, 13, 1)])).toBe(0);
  });

  it('kijk je naar de lucht, dan zie je geen gast', () => {
    expect(pickLook(10, 10, WALK.eye, 0, WALK.pitchUp, [at(10, 11, 0.2, 0.4)])).toBe(-1);
    expect(pickLook(10, 10, WALK.eye, 0, -0.2, [at(10, 11, 0.2, 0.4)])).toBe(0);
  });
});

describe('de knoppen van de loopstand', () => {
  it('de grote ronde knop: omhoog is vooruit, opzij is draaien, het midden doet niets', () => {
    expect(stickInput(0, -WALK.stick)).toEqual({ forward: 1, turn: 0 });
    expect(stickInput(WALK.stick * 3, 0).turn).toBeCloseTo(1);
    const mid = stickInput(2, 2);
    expect(mid.forward).toBe(0);
    expect(mid.turn).toBe(0);
    const far = stickInput(200, -200);
    expect(Math.hypot(far.forward, far.turn)).toBeCloseTo(1);
  });

  it('niet te snel en niet te ver omhoog of omlaag', () => {
    expect(WALK.speed).toBeLessThanOrEqual(2);
    expect(WALK.back).toBeLessThan(WALK.speed);
    expect(clampPitch(3)).toBe(WALK.pitchUp);
    expect(clampPitch(-3)).toBe(-WALK.pitchDown);
    expect(bobHeight(Math.PI / 2, 0)).toBe(WALK.eye);
    expect(bobHeight(Math.PI / 2, 1)).toBeCloseTo(WALK.eye + WALK.bob);
    // je ogen zitten ongeveer zo hoog als die van een gast, net boven een hek
    expect(WALK.eye).toBeGreaterThan(0.45);
    expect(WALK.eye).toBeLessThan(0.7);
  });
});
