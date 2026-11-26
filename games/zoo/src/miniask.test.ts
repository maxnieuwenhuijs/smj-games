import { describe, expect, it } from 'vitest';
import { FOODS, SPECIES, type SpeciesId } from './data';
import en from './en.json';
import { EVENT_SAYS, MINI_SAYS } from './lines';
import {
  COUNT_MAX, EAT_CLEAR, MEMORY, MORE_GRID, MORE_MAX, PATTERNS, PATTERN_SHOWN, SHADOW_CLEAR, SOUND_CLEAR, answersNear, askPool, bedChoices, dealPairs, eatChoices, freshOf, makeCount,
  makeMore, makeOdd, makePattern, makeSum, memoryClean, memoryPairs, pickOther, pickSetup, scatter, shadowChoices, soundChoices, sumKey, unseen,
} from './miniask';
import nl from './nl.json';

/** Een vast rijtje toevalsgetallen, zodat een test elke keer hetzelfde doet. */
function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

describe('sommen en tellen', () => {
  it('een som blijft onder de tien en klopt', () => {
    const rnd = seeded(1);
    let plus = 0, minus = 0;
    for (let i = 0; i < 500; i++) {
      const q = makeSum(rnd);
      expect(q.a).toBeGreaterThanOrEqual(1);
      expect(q.b).toBeGreaterThanOrEqual(1);
      expect(q.answer).toBe(q.minus ? q.a - q.b : q.a + q.b);
      expect(q.answer).toBeGreaterThanOrEqual(q.minus ? 0 : 2);
      expect(q.answer).toBeLessThanOrEqual(COUNT_MAX);
      expect(q.a).toBeLessThanOrEqual(COUNT_MAX);
      if (q.minus) minus++;
      else plus++;
    }
    // meer plus dan min, maar allebei komen voor
    expect(plus).toBeGreaterThan(minus);
    expect(minus).toBeGreaterThan(100);
  });

  it('dezelfde som komt niet twee keer achter elkaar', () => {
    const rnd = seeded(2), seen = new Set<string>();
    const keys = Array.from({ length: 6 }, () => sumKey(unseen(() => makeSum(rnd), sumKey, seen)));
    expect(new Set(keys).size).toBe(6);
  });

  it('drie antwoorden: het goede en twee vlak ernaast, nooit buiten de grenzen', () => {
    const rnd = seeded(3);
    for (let answer = 0; answer <= COUNT_MAX; answer++)
      for (let i = 0; i < 20; i++) {
        const options = answersNear(answer, 0, COUNT_MAX, rnd);
        expect(options).toHaveLength(3);
        expect(new Set(options).size).toBe(3);
        expect(options).toContain(answer);
        for (const n of options) {
          expect(n).toBeGreaterThanOrEqual(0);
          expect(n).toBeLessThanOrEqual(COUNT_MAX);
          expect(Math.abs(n - answer)).toBeLessThanOrEqual(2);
        }
      }
    // tellen begint bij één: nul dingen kun je niet tellen
    for (let i = 0; i < 20; i++) expect(Math.min(...answersNear(1, 1, COUNT_MAX, rnd))).toBe(1);
  });

  it('tellen begint klein en wordt per vraag groter, tot hooguit negen', () => {
    const rnd = seeded(4);
    for (let i = 0; i < 100; i++) {
      expect(makeCount(0, rnd)).toBeGreaterThanOrEqual(1);
      expect(makeCount(0, rnd)).toBeLessThanOrEqual(4);
      expect(makeCount(1, rnd)).toBeGreaterThanOrEqual(3);
      expect(makeCount(1, rnd)).toBeLessThanOrEqual(6);
      for (const round of [2, 3, 9]) {
        expect(makeCount(round, rnd)).toBeGreaterThanOrEqual(5);
        expect(makeCount(round, rnd)).toBeLessThanOrEqual(COUNT_MAX);
      }
    }
  });

  it('de dingen in een vak liggen binnen het vak en raken elkaar niet', () => {
    const rnd = seeded(5);
    for (let n = 1; n <= 12; n++)
      for (let i = 0; i < 20; i++) {
        const { cols, rows, spots } = scatter(n, rnd);
        expect(spots).toHaveLength(n);
        expect(cols * rows).toBeGreaterThanOrEqual(n);
        for (const p of spots) {
          // een ding is vier vijfde hokje groot: het hele ding blijft binnen het vak
          expect(p.x * cols).toBeGreaterThanOrEqual(0.4);
          expect(p.x * cols).toBeLessThanOrEqual(cols - 0.4);
          expect(p.y * rows).toBeGreaterThanOrEqual(0.4);
          expect(p.y * rows).toBeLessThanOrEqual(rows - 0.4);
        }
        for (let a = 0; a < n; a++)
          for (let b = a + 1; b < n; b++) {
            const dx = Math.abs(spots[a].x - spots[b].x) * cols, dy = Math.abs(spots[a].y - spots[b].y) * rows;
            expect(Math.max(dx, dy)).toBeGreaterThanOrEqual(0.8 - 1e-9);
          }
      }
    // met een vast rooster (waar zijn de meeste) is elk groepje even groot getekend
    expect(scatter(3, rnd, MORE_GRID)).toMatchObject(MORE_GRID);
    expect(MORE_GRID.cols * MORE_GRID.rows).toBeGreaterThanOrEqual(MORE_MAX);
  });

  it('waar zijn de meeste: er is precies één grootste groepje, met genoeg verschil', () => {
    const rnd = seeded(6);
    for (const groups of [2, 3])
      for (const gap of [1, 2])
        for (let i = 0; i < 200; i++) {
          const counts = makeMore(groups, gap, rnd);
          expect(counts).toHaveLength(groups);
          expect(new Set(counts).size).toBe(groups);
          const sorted = [...counts].sort((a, b) => b - a);
          expect(sorted[0]).toBeLessThanOrEqual(MORE_MAX);
          expect(sorted[groups - 1]).toBeGreaterThanOrEqual(1);
          expect(sorted[0] - sorted[1]).toBeGreaterThanOrEqual(gap);
        }
  });
});

describe('rijtje, wat hoort er niet bij en memory', () => {
  it('het rijtje herhaalt zich en het antwoord is het volgende plaatje', () => {
    const rnd = seeded(7);
    expect(makePattern(0, rnd)).toEqual({ shown: [0, 1, 0, 1, 0], answer: 1 });
    const units = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const q = makePattern(1 + (i % 3), rnd);
      expect(q.shown).toHaveLength(PATTERN_SHOWN);
      const unit = PATTERNS.find(u => q.shown.every((k, at) => k === u[at % u.length]) && q.answer === u[PATTERN_SHOWN % u.length]);
      expect(unit, q.shown.join('')).toBeTruthy();
      units.add(unit!.join(''));
      // elk plaatje van het antwoord is al in het rijtje te zien
      expect(q.shown).toContain(q.answer);
    }
    // na de eerste vraag komen alle langere rijtjes voor, en nooit meer het makkelijkste
    expect([...units].sort()).toEqual(PATTERNS.slice(1).map(u => u.join('')).sort());
  });

  it('wat hoort er niet bij: drie uit één groep en één uit een heel andere familie', () => {
    const rnd = seeded(8);
    const families = [[['appel', 'peer', 'banaan', 'kers'], ['melk', 'sap', 'thee']], [['hoed', 'pet', 'muts']], [['bal']]];
    const familyOf = (item: string): number => families.findIndex(f => f.flat().includes(item));
    for (let i = 0; i < 300; i++) {
      const same = i % 2 === 0;
      const q = makeOdd(families, same, rnd)!;
      expect(q.items).toHaveLength(4);
      const three = q.items.filter((_, at) => at !== q.odd);
      // de drie komen uit dezelfde groep (eten of drinken, niet door elkaar)
      const group = families.flat().find(g => g.includes(three[0]))!;
      for (const item of three) expect(group).toContain(item);
      expect(new Set(three).size).toBe(same ? 1 : 3);
      expect(familyOf(q.items[q.odd])).not.toBe(familyOf(three[0]));
    }
    // een groep van één kan alleen als de drie hetzelfde plaatje mogen zijn
    expect(makeOdd([[['bal']], [['hoed']]], false, rnd)).toBeNull();
    expect(makeOdd([[['bal']], [['hoed']]], true, rnd)).not.toBeNull();
    expect(makeOdd([[['appel', 'peer', 'kers']]], false, rnd)).toBeNull();
  });

  it('memory: elk plaatje ligt er twee keer, en missen hoort erbij', () => {
    const rnd = seeded(9);
    expect(MEMORY.pairs.map((_, i) => memoryPairs(i))).toEqual(MEMORY.pairs);
    expect(memoryPairs(99)).toBe(MEMORY.pairs[MEMORY.pairs.length - 1]);
    for (const pairs of MEMORY.pairs) {
      const deal = dealPairs(pairs, rnd);
      expect(deal).toHaveLength(pairs * 2);
      for (let v = 0; v < pairs; v++) expect(deal.filter(x => x === v)).toHaveLength(2);
      // twee keer zoveel missers als er paren zijn telt nog als in één keer goed; daarna niet meer
      expect(memoryClean(0, pairs)).toBe(true);
      expect(memoryClean(pairs * MEMORY.grace, pairs)).toBe(true);
      expect(memoryClean(pairs * MEMORY.grace + 1, pairs)).toBe(false);
    }
  });
});

describe('vragen over dieren', () => {
  const all = Object.keys(SPECIES) as SpeciesId[];

  it('de lijstjes noemen alleen dieren die bestaan', () => {
    for (const list of [EAT_CLEAR, SOUND_CLEAR, SHADOW_CLEAR]) {
      expect(new Set(list).size).toBe(list.length);
      for (const sp of list) expect(all, sp).toContain(sp);
      expect(list.length).toBeGreaterThanOrEqual(12);
    }
  });

  it('de dieren van een vraag komen het liefst uit je eigen park', () => {
    const rnd = seeded(10);
    const pool = askPool(['lion', 'cow', 'gorilla', 'lion'], EAT_CLEAR, 5, rnd);
    // de gorilla staat niet in het lijstje van wat een kind weet; de leeuw en de koe wel, en die staan vooraan
    expect(pool.slice(0, 2)).toEqual(['lion', 'cow']);
    expect(pool).toHaveLength(5);
    expect(new Set(pool).size).toBe(5);
    for (const sp of pool) expect(EAT_CLEAR).toContain(sp);
    // genoeg eigen dieren: dan komt er niets bij
    expect(askPool(['lion', 'cow', 'pig'], EAT_CLEAR, 2, rnd)).toEqual(['lion', 'cow', 'pig']);
    expect(askPool([], EAT_CLEAR, 3, rnd)).toHaveLength(3);
  });

  it('wat eet dit dier: het goede voer staat erbij, en de andere twee lijken er niet op', () => {
    const rnd = seeded(11);
    const plants = ['hay', 'grain', 'leaves', 'bamboo', 'veg', 'fruit'];
    for (const sp of EAT_CLEAR)
      for (let i = 0; i < 20; i++) {
        const options = eatChoices(sp, rnd), right = SPECIES[sp].food;
        expect(options).toHaveLength(3);
        expect(new Set(options).size).toBe(3);
        expect(options).toContain(right);
        for (const food of options) expect(FOODS).toContain(food);
        const wrong = options.filter(f => f !== right);
        // een vleeseter of viseter kiest nooit tussen vlees en vis; een planteneter nooit tussen hooi en blaadjes
        if (right === 'meat' || right === 'fish') for (const f of wrong) expect(plants).toContain(f);
        if (right === 'hay' || right === 'leaves' || right === 'bamboo' || right === 'grain') for (const f of wrong) expect(['hay', 'grain', 'leaves', 'bamboo']).not.toContain(f);
        if (right === 'veg' || right === 'fruit') for (const f of wrong) expect(['veg', 'fruit']).not.toContain(f);
      }
    expect(eatChoices('lion', rnd)).toContain('meat');
    expect(eatChoices('penguin', rnd)).toContain('fish');
    expect(eatChoices('panda', rnd)).toContain('bamboo');
  });

  it('wie slaapt hier: de andere twee dieren slapen ergens heel anders', () => {
    const rnd = seeded(12);
    const near: Record<string, string[]> = { straw: ['shed'], shed: ['straw'], rock: ['cave'], cave: ['rock'], shade: ['climb'], climb: ['shade'], nest: [], coral: [] };
    for (const sp of all)
      for (const park of [[], ['pig', 'cow', 'chicken', 'lion', 'monkey', 'dolphin'], [sp]]) {
        const options = bedChoices(sp, park, rnd);
        expect(options).toHaveLength(3);
        expect(new Set(options).size).toBe(3);
        expect(options).toContain(sp);
        const bed = SPECIES[sp].bed;
        for (const other of options.filter(o => o !== sp)) {
          expect(SPECIES[other].bed).not.toBe(bed);
          expect(near[bed]).not.toContain(SPECIES[other].bed);
        }
      }
    // de andere dieren komen uit het park als daar genoeg keus is
    const park = ['pig', 'chicken', 'lion', 'monkey', 'dolphin'];
    for (let i = 0; i < 30; i++) for (const other of bedChoices('chicken', park, rnd)) expect(park).toContain(other);
  });

  it('geluid en schaduw: drie verschillende dieren die niet op elkaar lijken', () => {
    const rnd = seeded(13);
    for (const [clear, choices, alike] of [
      [SOUND_CLEAR, soundChoices, [['sheep', 'goat'], ['lion', 'tiger']]],
      [SHADOW_CLEAR, shadowChoices, [['rabbit', 'kangaroo'], ['horse', 'zebra', 'donkey'], ['dolphin', 'shark', 'orca'], ['yak', 'bison', 'cow'], ['wolf', 'arcticfox'], ['toucan', 'pelican', 'duck']]],
    ] as const)
      for (const sp of clear)
        for (const park of [[], ['pig', 'cow', 'sheep', 'goat', 'horse', 'zebra', 'dolphin', 'shark', 'lion', 'tiger']]) {
          const options = choices(sp, park, rnd);
          expect(options).toHaveLength(3);
          expect(new Set(options).size).toBe(3);
          expect(options).toContain(sp);
          for (const o of options) expect(clear).toContain(o);
          // nooit twee uit hetzelfde groepje samen (een schaap en een geit, een dolfijn en een haai)
          for (const group of alike) expect(options.filter(o => (group as readonly string[]).includes(o)).length).toBeLessThanOrEqual(1);
        }
  });
});

describe('afwisseling', () => {
  it('eerst komen alle puzzeltjes van een kaartje aan de beurt, en nooit twee keer dezelfde achter elkaar', () => {
    const rnd = seeded(14);
    const sum = { kind: 'sum' }, count = { kind: 'count' }, more = { kind: 'more' }, sound = { kind: 'sound' };
    const list = [sum, count, more];
    let used: { kind: string }[] = [];
    const picks: { kind: string }[] = [];
    for (let i = 0; i < 99; i++) {
      const pick = pickSetup(list, used, used[used.length - 1]?.kind ?? '', undefined, rnd);
      expect(pick).not.toBe(picks[picks.length - 1]);
      picks.push(pick);
      used = list.every(m => m === pick || used.includes(m)) ? [pick] : [...used, pick];
    }
    // de eerste drie keer komen ze alle drie aan de beurt; daarna blijft geen van de drie lang weg
    expect(new Set(picks.slice(0, 3)).size).toBe(3);
    for (let i = 0; i + 5 <= picks.length; i++) expect(new Set(picks.slice(i, i + 5)).size).toBe(3);
    // het vorige puzzeltje (bij een ander kaartje) was een som: dan hier liever geen som
    for (let i = 0; i < 50; i++) expect(pickSetup(list, [], 'sum', undefined, rnd)).not.toBe(sum);
    // is er maar één, dan komt die gewoon weer
    expect(pickSetup([sum], [sum], 'sum', undefined, rnd)).toBe(sum);
    // zonder geluid geen geluidspuzzel, behalve als er niets anders is
    for (let i = 0; i < 50; i++) expect(pickSetup([sum, sound], [], '', m => m.kind !== 'sound', rnd)).toBe(sum);
    expect(pickSetup([sound], [], '', m => m.kind !== 'sound', rnd)).toBe(sound);
    expect(pickOther(['a', 'b'], 'a', rnd)).toBe('b');
    expect(pickOther(['a'], 'a', rnd)).toBe('a');
  });

  it('een plaatje dat al geweest is, komt pas terug als alles geweest is', () => {
    const rnd = seeded(15), seen = new Set<string>();
    const first = [freshOf(['a', 'b', 'c'], seen, rnd), freshOf(['a', 'b', 'c'], seen, rnd), freshOf(['a', 'b', 'c'], seen, rnd)];
    expect([...first].sort()).toEqual(['a', 'b', 'c']);
    expect(['a', 'b', 'c']).toContain(freshOf(['a', 'b', 'c'], seen, rnd));
  });
});

describe('teksten bij de puzzeltjes', () => {
  const tables: Record<string, Record<string, string>> = { nl, en };

  it('elke uitleg en elke zin van een evenement staat in beide talen', () => {
    for (const table of Object.values(tables)) {
      for (const key of MINI_SAYS) expect(table[key], key).toBeTruthy();
      for (const [id, says] of Object.entries(EVENT_SAYS)) {
        for (let n = 1; n <= says.ask; n++) expect(table[`say.event.${id}.${n}`], `${id} ${n}`).toBeTruthy();
        for (const part of ['good', 'bad'] as const) for (let n = 1; n <= says[part]; n++) expect(table[`say.event.${id}.${part}.${n}`], `${id} ${part} ${n}`).toBeTruthy();
      }
    }
  });

  it('een eigen vraag bij een puzzeltje hoort bij een evenement dat de rest zegt', () => {
    for (const id of Object.keys(EVENT_SAYS)) {
      const [event, variant] = id.split('.');
      if (!variant || event === 'class') continue;
      // 'party.count' leent goed en fout van 'party': die moet er dus zijn, met dezelfde spreker
      expect(EVENT_SAYS[event], id).toBeTruthy();
      expect(EVENT_SAYS[id].who).toBe(EVENT_SAYS[event].who);
      expect(EVENT_SAYS[id].ask).toBeGreaterThanOrEqual(1);
      expect(EVENT_SAYS[event].good).toBeGreaterThanOrEqual(1);
      expect(EVENT_SAYS[event].bad).toBeGreaterThanOrEqual(1);
    }
  });
});
