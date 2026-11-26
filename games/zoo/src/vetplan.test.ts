import { describe, expect, it } from 'vitest';
import en from './en.json';
import { ICON_IDS } from './icons';
import { VET_SAYS, allLines, fill, type Tr } from './lines';
import nl from './nl.json';
import { VET, VET_GAMES, VISIT, heartBeat, pickSpots, pickVisit, sickAfter, thornOut, warmUp, wipe, type VetGame } from './vetplan';

/** Een vast rijtje toevalsgetallen, zodat een test elke keer hetzelfde doet. */
function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

describe('een bezoek aan de dokter', () => {
  it('er zijn minstens vijf spelletjes, en een bezoek krijgt er twee of drie verschillende', () => {
    expect(VET_GAMES.length).toBeGreaterThanOrEqual(5);
    expect(new Set(VET_GAMES).size).toBe(VET_GAMES.length);
    const rnd = seeded(1);
    const sizes = new Set<number>(), seen = new Set<VetGame>();
    for (let i = 0; i < 300; i++) {
      const visit = pickVisit([], rnd);
      expect(visit.length).toBeGreaterThanOrEqual(VISIT[0]);
      expect(visit.length).toBeLessThanOrEqual(VISIT[1]);
      expect(new Set(visit).size).toBe(visit.length);
      for (const game of visit) expect(VET_GAMES).toContain(game);
      sizes.add(visit.length);
      for (const game of visit) seen.add(game);
    }
    // soms twee, soms drie; en elk spelletje komt aan de beurt
    expect([...sizes].sort()).toEqual([2, 3]);
    expect(seen.size).toBe(VET_GAMES.length);
  });

  it('elk bezoek is anders dan het vorige', () => {
    const rnd = seeded(2);
    let last: VetGame[] = [];
    for (let i = 0; i < 300; i++) {
      const visit = pickVisit(last, rnd);
      if (last.length) {
        // het begint met een ander spelletje, en met zeven spelletjes zit er niets van de vorige keer bij
        expect(visit[0]).not.toBe(last[0]);
        for (const game of visit) expect(last).not.toContain(game);
      }
      last = visit;
    }
    // met maar twee spelletjes om uit te kiezen komen ze allebei, in een andere volgorde dan de vorige keer
    for (let i = 0; i < 20; i++) expect(pickVisit(['thermo', 'plaster'], rnd, ['thermo', 'plaster'])).toEqual(['plaster', 'thermo']);
    expect(pickVisit([], rnd, ['thermo'])).toEqual(['thermo']);
  });

  it('het dier krijgt per spelletje meer kleur en is aan het eind helemaal op kleur', () => {
    expect(sickAfter(0, 3)).toBe(1);
    expect(sickAfter(1, 3)).toBeCloseTo(2 / 3, 6);
    expect(sickAfter(3, 3)).toBe(0);
    expect(sickAfter(5, 3)).toBe(0);
    expect(sickAfter(0, 0)).toBe(1);
  });
});

describe('de spelletjes van de dokter', () => {
  it('de thermometer loopt vol door vast te houden, en zakt nooit terug', () => {
    let level = 0, seconds = 0;
    while (level < 1 && seconds < 10) {
      const next = warmUp(level, 0.05);
      expect(next).toBeGreaterThan(level);
      level = next;
      seconds += 0.05;
    }
    // vol na ongeveer VET.thermo.seconds tellen: kort genoeg voor een kleuter
    expect(seconds).toBeGreaterThan(VET.thermo.seconds - 0.1);
    expect(seconds).toBeLessThan(VET.thermo.seconds + 0.1);
    expect(VET.thermo.seconds).toBeLessThanOrEqual(3);
    expect(warmUp(1, 1)).toBe(1);
    // alleen tikken lukt ook, in hooguit tien tikjes
    expect(Math.ceil(1 / VET.thermo.tap)).toBeLessThanOrEqual(10);
  });

  it('het hart klinkt het hardst van dichtbij en is ver weg niet te horen', () => {
    expect(heartBeat(0)).toBe(1);
    expect(heartBeat(VET.stetho.near)).toBe(1);
    expect(heartBeat(VET.stetho.far)).toBe(0);
    expect(heartBeat(2)).toBe(0);
    let last = 1;
    for (let d = VET.stetho.near; d <= VET.stetho.far; d += 0.02) {
      const loud = heartBeat(d);
      expect(loud).toBeLessThanOrEqual(last);
      last = loud;
    }
    // de goede plek is ruim: een derde van het plaatje breed
    expect(VET.stetho.near * 2).toBeGreaterThanOrEqual(0.3);
    expect(VET.stetho.help).toBeLessThanOrEqual(8);
  });

  it('de doorn komt er alleen uit als je in zijn richting trekt', () => {
    expect(thornOut(VET.thorn.pull, 0, 1, 0)).toBe(1);
    expect(thornOut(VET.thorn.pull / 2, 0, 1, 0)).toBeCloseTo(0.5, 6);
    // duwen of opzij schuiven doet niets
    expect(thornOut(-0.3, 0, 1, 0)).toBe(0);
    expect(thornOut(0, 0.3, 1, 0)).toBe(0);
    // schuin trekken telt voor het stuk in de goede richting; de richting hoeft geen lengte één te hebben
    expect(thornOut(0.2, 0.2, 3, 3)).toBeCloseTo(Math.min(1, Math.hypot(0.2, 0.2) / VET.thorn.pull), 6);
    expect(thornOut(5, 5, 1, 1)).toBe(1);
    expect(VET.thorn.taps).toBeLessThanOrEqual(5);
  });

  it('vegen maakt een plekje stap voor stap schoon', () => {
    let dirt = 1, strokes = 0;
    while (dirt > 0 && strokes < 50) {
      const next = wipe(dirt, 0.05, VET.cotton.rub);
      expect(next).toBeLessThan(dirt);
      dirt = next;
      strokes++;
    }
    expect(dirt).toBe(0);
    expect(strokes).toBe(Math.ceil(VET.cotton.rub / 0.05));
    expect(wipe(0, 1, 1)).toBe(0);
    expect(wipe(1, 0, 1)).toBe(1);
    // het watje raakt een plekje ruim: een kleine vinger hoeft niet precies te mikken
    expect(VET.cotton.reach).toBeGreaterThanOrEqual(0.12);
    expect(VET.teeth.teeth % 2).toBe(0);
  });

  it('de plekken liggen op het dier, uit elkaar, en het zijn er altijd genoeg', () => {
    const rnd = seeded(3);
    // een rond dier
    const round = (x: number, y: number): boolean => Math.hypot(x - 0.5, y - 0.5) < 0.38;
    for (let i = 0; i < 50; i++) {
      const spots = pickSpots(round, 3, 0.3, rnd);
      expect(spots).toHaveLength(3);
      for (const p of spots) expect(Math.hypot(p.x - 0.5, p.y - 0.5)).toBeLessThan(0.38 - 0.06);
      for (let a = 0; a < 3; a++) for (let b = a + 1; b < 3; b++) expect(Math.hypot(spots[a].x - spots[b].x, spots[a].y - spots[b].y)).toBeGreaterThanOrEqual(0.3 - 1e-9);
    }
    // een heel smal dier (een flamingo): de plekken liggen op het dier, al is het dan dichter bij elkaar
    const thin = (x: number, y: number): boolean => Math.abs(x - 0.5) < 0.09 && y > 0.1 && y < 0.9;
    for (let i = 0; i < 50; i++) {
      const spots = pickSpots(thin, 3, 0.3, rnd);
      expect(spots).toHaveLength(3);
      for (const p of spots) expect(thin(p.x, p.y)).toBe(true);
      expect(new Set(spots.map(p => `${p.x},${p.y}`)).size).toBe(3);
    }
    // geen dier te vinden (een leeg plaatje): toch drie plekken, rond het midden
    const none = pickSpots(() => false, 3, 0.3, rnd);
    expect(none).toHaveLength(3);
    for (const p of none) expect(Math.hypot(p.x - 0.5, p.y - 0.52)).toBeLessThan(0.2);
    expect(pickSpots(round, 1, 0, rnd)).toHaveLength(1);
  });
});

describe('teksten en plaatjes van de dokter', () => {
  it('elk spelletje heeft een uitleg in beide talen, en de verzorger leest hem voor', () => {
    expect(VET_SAYS).toHaveLength(VET_GAMES.length);
    for (const table of [nl, en] as Record<string, string>[]) {
      for (const key of [...VET_SAYS, 'vet.title']) expect(table[key], key).toBeTruthy();
      const tr: Tr = (key, vars) => fill(table[key] ?? `?${key}?`, vars);
      const spoken = allLines(tr).filter(l => l.who === 'keeper').map(l => l.text);
      for (const key of VET_SAYS) expect(spoken).toContain(table[key]);
    }
  });

  it('de plaatjes van het gereedschap bestaan', () => {
    for (const id of ['thermo', 'plaster', 'stetho', 'tweezers', 'syrup', 'cotton', 'toothbrush', 'vet']) expect(ICON_IDS, id).toContain(id);
  });
});
