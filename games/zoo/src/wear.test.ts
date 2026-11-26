import { describe, expect, it } from 'vitest';
import en from './en.json';
import { ICON_IDS } from './icons';
import { FIX_SAYS, allLines, fill, say, textOf, type Tr } from './lines';
import nl from './nl.json';
import { FIX, MEND, MENDS, MEND_ICON, MEND_SOUND, WEAR, fixCount, hammerIn, needsGame, pullUp, pushable, smudgeCount, wearGap, wearStep, wears } from './wear';

/** Een vast rijtje toevalsgetallen, zodat een test elke keer hetzelfde doet. */
function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

describe('welke hekken slijten', () => {
  it('hout, het witte hekje, steen, net en glas slijten; poorten en de kijkruit niet', () => {
    for (const kind of [1, 3, 4, 5, 7]) expect(wears(kind), String(kind)).toBe(true);
    for (const kind of [0, 2, 6, 8, 9]) expect(wears(kind), String(kind)).toBe(false);
    expect(MEND[1]).toBe('wood');
    expect(MEND[7]).toBe('wood');
    expect(MEND[3]).toBe('stone');
    expect(MEND[4]).toBe('net');
    expect(MEND[5]).toBe('glass');
    // elke manier van maken komt voor, met een eigen plaatje en een geluid
    expect(new Set(Object.values(MEND))).toEqual(new Set(MENDS));
    for (const mend of MENDS) {
      expect(ICON_IDS, mend).toContain(MEND_ICON[mend]);
      expect(MEND_SOUND[mend]).toBeTruthy();
    }
  });

  it('een sterk dier duwt alles kapot behalve een stenen muur, een poort of een kijkruit', () => {
    for (const kind of [1, 4, 5, 7]) expect(pushable(kind), String(kind)).toBe(true);
    for (const kind of [0, 2, 3, 6, 8]) expect(pushable(kind), String(kind)).toBe(false);
  });
});

describe('het tempo van het slijten', () => {
  it('ongeveer één stap per minuut', () => {
    const rnd = seeded(1);
    for (let i = 0; i < 100; i++) {
      const gap = wearGap(rnd);
      expect(gap).toBeGreaterThanOrEqual(WEAR.every[0]);
      expect(gap).toBeLessThanOrEqual(WEAR.every[1]);
    }
    expect((WEAR.every[0] + WEAR.every[1]) / 2).toBeGreaterThanOrEqual(60);
    expect(WEAR.first).toBeGreaterThanOrEqual(60);
  });

  it('nooit meer dan vier versleten hekken, en geen hek voorbij kapot', () => {
    const rnd = seeded(2);
    const worn = new Map<string, number>();
    const all = Array.from({ length: 30 }, (_, i) => `h${i},0`);
    for (let i = 0; i < 400; i++) {
      const step = wearStep(worn, all.filter(key => !worn.has(key)), rnd);
      if (!step) continue;
      // een nieuw hek begint in fase 1; een versleten hek gaat precies één fase verder
      expect(step.phase).toBe((worn.get(step.key) ?? 0) + 1);
      worn.set(step.key, step.phase);
      expect(worn.size).toBeLessThanOrEqual(WEAR.max);
      for (const phase of worn.values()) expect(phase).toBeLessThanOrEqual(WEAR.broken);
    }
    // uiteindelijk zijn ze alle vier kapot, en dan slijt er niets meer bij
    expect(worn.size).toBe(WEAR.max);
    expect([...worn.values()]).toEqual([WEAR.broken, WEAR.broken, WEAR.broken, WEAR.broken]);
    expect(wearStep(worn, all, rnd)).toBeNull();
  });

  it('meestal slijt een hek dat al versleten is verder, soms begint er een nieuw', () => {
    const rnd = seeded(3);
    let deeper = 0, fresh = 0;
    for (let i = 0; i < 1000; i++) {
      const step = wearStep(new Map([['h1,1', 1]]), ['h2,2', 'h3,3'], rnd)!;
      if (step.key === 'h1,1') deeper++;
      else fresh++;
    }
    expect(deeper / 1000).toBeGreaterThan(WEAR.deepen - 0.06);
    expect(deeper / 1000).toBeLessThan(WEAR.deepen + 0.06);
    expect(fresh).toBeGreaterThan(300);
    // niets om te slijten: er gebeurt niets; alleen kapotte hekken: er begint een nieuw
    expect(wearStep(new Map(), [], rnd)).toBeNull();
    expect(wearStep(new Map([['h1,1', WEAR.broken]]), ['h2,2'], rnd)).toEqual({ key: 'h2,2', phase: 1 });
    expect(wearStep(new Map([['h1,1', WEAR.broken]]), [], rnd)).toBeNull();
  });
});

describe('een hek maken', () => {
  it('licht versleten is één tik; los en kapot is een spelletje', () => {
    expect(needsGame(1)).toBe(false);
    expect(needsGame(2)).toBe(true);
    expect(needsGame(3)).toBe(true);
    expect(WEAR.broken).toBe(3);
  });

  it('hoe erger versleten, hoe meer er te doen is, maar nooit veel', () => {
    for (const mend of MENDS) {
      expect(fixCount(mend, 2)).toBeGreaterThanOrEqual(2);
      expect(fixCount(mend, 3)).toBeGreaterThan(fixCount(mend, 2));
      expect(fixCount(mend, 3)).toBeLessThanOrEqual(5);
      expect(fixCount(mend, 1)).toBeGreaterThanOrEqual(1);
      // een rare fase (uit een oud of kapot opgeslagen spel) geeft toch een spelletje dat te spelen is
      expect(fixCount(mend, 0)).toBe(fixCount(mend, 1));
      expect(fixCount(mend, 9)).toBe(fixCount(mend, 3));
    }
    expect(smudgeCount(3)).toBeGreaterThan(smudgeCount(2));
    expect(smudgeCount(2)).toBeGreaterThanOrEqual(1);
  });

  it('een spijker zit er na een paar tikken in', () => {
    let depth = 0, hits = 0;
    while (depth < 1 && hits < 20) {
      depth = hammerIn(depth);
      hits++;
    }
    expect(hits).toBe(FIX.wood.hits);
    expect(hammerIn(1)).toBe(1);
    expect(FIX.wood.hits).toBeLessThanOrEqual(4);
  });

  it('het net gaat alleen omhoog, met tikjes of door te slepen', () => {
    let sag = 1, taps = 0;
    while (sag > 0 && taps < 20) {
      sag = pullUp(sag);
      taps++;
    }
    expect(taps).toBe(FIX.net.pulls);
    // slepen: de ring volgt de vinger omhoog, maar zakt niet terug als de vinger weer naar beneden gaat
    expect(pullUp(1, 0.4)).toBeCloseTo(0.4, 6);
    expect(pullUp(0.4, 0.9)).toBeCloseTo(0.4, 6);
    expect(pullUp(0.4, -0.5)).toBe(0);
    expect(pullUp(0.4, 2)).toBeCloseTo(0.4, 6);
  });
});

describe('teksten bij het maken van een hek', () => {
  it('de bouwer zegt bij elk soort kapot hek hoe je het maakt, en leest de uitleg voor', () => {
    for (const table of [nl, en] as Record<string, string>[]) {
      const tr: Tr = (key, vars) => fill(table[key] ?? `?${key}?`, vars);
      const spoken = allLines(tr).filter(l => l.who === 'builder').map(l => l.text);
      const alerts = MENDS.map(mend => textOf(tr, say.broken(mend)));
      // vier verschillende zinnen, en hout houdt de zin die er al was
      expect(new Set(alerts).size).toBe(MENDS.length);
      expect(alerts[0]).toBe(table['alert.broken']);
      for (const text of alerts) expect(spoken).toContain(text);
      for (const key of [...FIX_SAYS, 'fix.title']) expect(table[key], key).toBeTruthy();
      for (const key of FIX_SAYS) expect(spoken).toContain(table[key]);
    }
    expect(say.broken().key).toBe('alert.broken');
  });
});
