import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';

vi.mock('./view', () => ({ toWorldX: (g: number) => g - 15, toWorldZ: (g: number) => g - 15 }));
vi.mock('./audio', () => ({ sfx: () => {} }));

import { ParkPlay, type ParkHost } from './parkplay';
import { LEAF } from './parkfun';

function setup() {
  const scene = new THREE.Scene();
  let clock = 0, season: 'autumn' | 'winter' | 'summer' = 'autumn', dark = 0;
  const told: string[] = [], earned: number[] = [], lampLooks: unknown[] = [];
  const lamps = [0, 1, 2].map(i => ({ ref: { i }, kind: 'lantern' as const, mesh: new THREE.Group(), gx: 3 + i * 2, gy: 3 }));
  const view = {
    scene,
    toScreen: (gx: number, gy: number, h = 0) => ({ x: gx * 40, y: gy * 30 - h * 40 }),
    burst: () => {}, splash: () => {}, pokeDecor: () => {}, animateDecor: () => {},
    snowmanModel: () => { const g = new THREE.Group(); for (let i = 0; i < 4; i++) g.add(new THREE.Mesh()); scene.add(g); return g; },
    setLamp: (_m: unknown, look: unknown) => lampLooks.push(look),
    setGateLamp: () => {},
    gateLampAt: [15.5, 30.12, 2.02] as [number, number, number],
  };
  const host: ParkHost = {
    view: view as never,
    clock: () => clock, season: () => season, seasons: () => true, nights: () => true, dark: () => dark,
    trees: () => [[5.5, 5.5]],
    ground: (gx, gy) => (gx > 0 && gy > 0 && gx < 30 && gy < 30 ? (Math.floor(gy) === 8 ? 'path' : 'grass') : null),
    tilesNear: () => [1, 2],
    lamps: () => lamps,
    guests: () => [],
    sightOf: () => null,
    callKid: () => null,
    earn: n => earned.push(n),
    float: () => {},
    once: id => { if (!told.includes(id)) told.push(id); },
    pointTo: () => {},
    tools: () => {},
    strings: () => {},
  };
  const park = new ParkPlay(host);
  return { park, scene, told, earned, lampLooks, lamps, set: { clock: (t: number) => (clock = t), season: (s: typeof season) => (season = s), dark: (d: number) => (dark = d) }, get clock() { return clock; } };
}

describe('spelen in het park: herfst, winter en nacht', () => {
  it('herfst: blaadjes vallen, harken, hoop, wegharken, en weg na de herfst', () => {
    const s = setup();
    for (let i = 0; i < 400; i++) { s.set.clock(i * 0.5); s.park.update(0.5); }
    const patches = (s.park as never as { patches: { gx: number; gy: number }[] }).patches;
    expect(patches.length).toBeGreaterThan(10);
    expect(patches.length).toBeLessThanOrEqual(LEAF.max);
    expect(s.told).toContain('park.leaves');
    // veeg over alles heen in één beweging
    expect(s.park.target('rake', 0, 0, { gx: patches[0].gx, gy: patches[0].gy })).toBe(true);
    s.park.release();
    for (const p of [...patches]) s.park.paint('rake', 0, 0, { gx: p.gx, gy: p.gy }, false);
    s.park.release();
    const piles = (s.park as never as { piles: { n: number; gx: number; gy: number }[] }).piles;
    expect(piles.length).toBe(1);
    expect(piles[0].n).toBeGreaterThanOrEqual(LEAF.big);
    s.park.update(0.5);
    // tik erop: weg, een munt
    s.park.paint('rake', 0, 0, { gx: piles[0].gx, gy: piles[0].gy }, true);
    s.park.release();
    expect((s.park as never as { piles: unknown[] }).piles.length).toBe(0);
    expect(s.earned).toEqual([1]);
    // nieuwe blaadjes, dan winter: alles krimpt weg
    for (let i = 0; i < 40; i++) { s.set.clock(300 + i); s.park.update(1); }
    s.set.season('winter');
    for (let i = 0; i < 10; i++) { s.set.clock(400 + i); s.park.update(1); }
    expect((s.park as never as { patches: unknown[] }).patches.length).toBe(0);
    expect(s.park.actions()).toEqual(['snowball']);
  });

  it('winter: rollen, drie tikken, sneeuwpop, bewaren en smelten', () => {
    const s = setup();
    s.set.season('winter');
    s.park.update(0.1);
    expect(s.told).toContain('park.snow');
    s.park.release();
    s.park.paint('snowball', 0, 0, { gx: 10, gy: 10 }, false);
    for (let i = 1; i <= 20; i++) s.park.paint('snowball', 0, 0, { gx: 10 + i * 0.2, gy: 10 }, false);
    s.park.release();
    const balls = (s.park as never as { balls: { gx: number; r: number; stage: number }[] }).balls;
    expect(balls.length).toBe(1);
    expect(balls[0].r).toBeGreaterThan(0.25);
    expect(balls[0].gx).toBeCloseTo(14);
    // tikken (op de grond vlak bij de bal; het scherm ligt ver weg)
    for (let i = 0; i < 3; i++) s.park.paint('snowball', -999, -999, { gx: 14, gy: 10 }, true);
    expect(balls[0].stage).toBe(3);
    expect(s.told).toContain('park.snowman');
    const saved = s.park.save()!;
    expect(saved.length).toBe(1);
    const again = setup();
    again.set.season('winter');
    again.park.restore(saved);
    expect((again.park as never as { balls: { stage: number }[] }).balls[0].stage).toBe(3);
    // niet op het pad rollen
    s.park.paint('snowball', -999, -999, { gx: 20, gy: 8.5 }, true);
    expect(balls.length).toBe(1);
    s.set.season('summer');
    for (let i = 0; i < 10; i++) { s.set.clock(100 + i); s.park.update(1); }
    expect((s.park as never as { balls: unknown[] }).balls.length).toBe(0);
  });

  it('nacht: lampen uit en aan, en een golfje als ze allemaal snel weer aan zijn', () => {
    const s = setup();
    s.park.update(0.1);
    // overdag doet een tik niets
    expect(s.park.tapLamp(s.lamps[0])).toBe(false);
    s.set.dark(1);
    s.set.clock(10);
    s.park.update(0.1);
    for (const l of s.lamps) expect(s.park.tapLamp(l)).toBe(true);
    for (const l of s.lamps) expect(s.park.lit(l.ref)).toBe(false);
    expect(s.lampLooks).toEqual(['off', 'off', 'off']);
    s.set.clock(12);
    for (const l of s.lamps) s.park.tapLamp(l);
    for (const l of s.lamps) expect(s.park.lit(l.ref)).toBe(true);
    expect(s.told).toContain('park.lampwave');
    // het golfje kleurt de lampen en zet ze daarna weer gewoon aan
    for (let i = 0; i < 40; i++) { s.set.clock(12 + i * 0.1); s.park.update(0.1); }
    expect(s.lampLooks.some(l => typeof l === 'number')).toBe(true);
    expect(s.lampLooks[s.lampLooks.length - 1]).toBe('on');
    // uit, en de volgende ochtend vanzelf weer aan
    s.park.tapLamp(s.lamps[1]);
    expect(s.park.lit(s.lamps[1].ref)).toBe(false);
    s.set.dark(0);
    s.park.update(0.1);
    expect(s.park.lit(s.lamps[1].ref)).toBe(true);
  });
});
