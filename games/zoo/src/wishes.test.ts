import { describe, expect, it } from 'vitest';
import {
  AQUATIC, BONUS, FEATURE, LEVELS, PALS, SPECIES, TOYS, TOY_FROM, TOY_KEY, TOY_LIKES, TOY_OF, WILD_KINDS, WILD_LEVEL, WISH_FIRST, WISH_ORDER,
  likedToys, likesToy, seeded, toyGap, toyNeed, wildRange, wildTaste, wishOrder, type SpeciesId, type ToyKind,
} from './data';

const ALL = Object.keys(SPECIES) as SpeciesId[];
/** Na hoeveel gehaalde levels je een soort hebt. */
const from = (sp: SpeciesId): number => (BONUS[sp] !== undefined ? BONUS[sp]! : LEVELS.findIndex(l => l.reward === sp) + 1);

describe('de speelgoedsleutel: welk dier wat leuk vindt', () => {
  it('elke soort heeft een lijstje met echt speelgoed, zonder dubbelen, en het lievelingsding staat vooraan', () => {
    for (const sp of ALL) {
      const list = TOY_LIKES[sp];
      expect(new Set(list).size, sp).toBe(list.length);
      for (const kind of list) {
        expect(TOYS, `${sp}: ${kind}`).toContain(kind);
        // de warmtelamp, het ijsblok en het waterfilter zijn geen speelgoed
        expect(['lamp', 'icebox', 'filter'], `${sp}: ${kind}`).not.toContain(kind);
      }
      if (TOY_OF[sp]) expect(list[0], sp).toBe(TOY_OF[sp]);
      if (sp !== 'ray') expect(list.length, sp).toBeGreaterThanOrEqual(1);
    }
    expect(likesToy('monkey', 'tyreswing')).toBe(true);
    expect(likesToy('monkey', 'tunnel')).toBe(false);
  });

  it('een zeedier houdt alleen van speelgoed voor in het water', () => {
    for (const sp of AQUATIC) for (const kind of TOY_LIKES[sp]) expect(['ball', 'hoop'], `${sp}: ${kind}`).toContain(kind);
  });

  it('zodra een soort er is en dieren iets leuks willen, is er iets uit zijn lijstje te koop', () => {
    for (const sp of ALL) {
      if (!TOY_LIKES[sp].length) continue;
      const done = Math.max(from(sp), FEATURE.fun);
      expect(likedToys(sp, done).length, `${sp} na ${done} levels`).toBeGreaterThanOrEqual(1);
      expect(toyNeed(sp, done, 9, 2), sp).toBeGreaterThanOrEqual(1);
    }
    // voor het speelgoed er is, vraagt niemand erom
    expect(toyNeed('pig', 0, 9, 2)).toBe(0);
  });

  it('elk stuk speelgoed heeft dieren die erom vragen', () => {
    for (const kind of TOYS) {
      if (kind === 'lamp' || kind === 'icebox' || kind === 'filter') continue;
      // de hoepel is alleen voor de dolfijn en de orka: die springen erdoor
      expect(ALL.filter(sp => likesToy(sp, kind)).length, kind).toBeGreaterThanOrEqual(kind === 'hoop' ? 2 : 3);
    }
  });

  it('in een klein verblijf is één ding genoeg; een groot verblijf en een grote groep willen meer afwisseling', () => {
    // een aap, als alles vrijgespeeld is: vijf dingen in zijn lijstje
    expect(likedToys('monkey', 50)).toHaveLength(5);
    expect(toyNeed('monkey', 50, 6, 2)).toBe(1);
    expect(toyNeed('monkey', 50, 10, 2)).toBe(2);
    expect(toyNeed('monkey', 50, 16, 2)).toBe(3);
    expect(toyNeed('monkey', 50, 20, 2)).toBe(3);
    expect(toyNeed('monkey', 50, 20, TOY_KEY.group)).toBe(4);
    expect(toyNeed('monkey', 50, 40, 12)).toBe(TOY_KEY.most);
    // er past nooit meer dan één ding per vijf tegels
    for (const sp of ALL) for (const tiles of [4, 6, 9, 12, 16, 25, 40]) expect(toyNeed(sp, 50, tiles, 6), `${sp} ${tiles}`).toBeLessThanOrEqual(Math.max(1, Math.floor(tiles / TOY_KEY.room)));
  });

  it('hoe meer speelgoed je vrijspeelt, hoe meer een dier in een groot verblijf wil: nooit minder', () => {
    for (const sp of ALL) {
      let before = 0;
      for (let done = 0; done <= 50; done++) {
        const need = toyNeed(sp, done, 20, 3);
        expect(need, `${sp} level ${done}`).toBeGreaterThanOrEqual(before);
        expect(need).toBeLessThanOrEqual(likedToys(sp, done).length);
        before = need;
      }
    }
    // het varken begint met de bal (level 10) en wil er in een groot hok later de autoband bij
    expect(toyNeed('pig', 9, 20, 2)).toBe(1);
    expect(toyNeed('pig', 13, 20, 2)).toBe(2);
  });

  it('weet wat er nog ontbreekt: het liefste ding eerst', () => {
    const gap = toyGap('monkey', 50, 16, 2, ['frame', 'drink']);
    expect(gap.need).toBe(3);
    expect(gap.got).toEqual(['frame']);
    expect(gap.short).toBe(2);
    expect(gap.missing[0]).toBe('ball');
    // genoeg: niets meer nodig, ook al staat niet alles er
    expect(toyGap('monkey', 50, 16, 2, ['ball', 'pole', 'frame']).short).toBe(0);
    // speelgoed dat het dier niet kent, telt niet mee
    expect(toyGap('pig', 50, 9, 2, ['hoop', 'frame']).short).toBe(1);
  });
});

describe('de natuursleutel: elke soort zijn eigen smaak', () => {
  it('elk landdier heeft een smaak in vier standen, en een zeedier niet', () => {
    for (const sp of ALL) {
      const taste = wildTaste(sp);
      if (AQUATIC.includes(sp)) {
        expect(taste, sp).toBeNull();
        continue;
      }
      for (const kind of WILD_KINDS) expect([0, 1, 2, 3], `${sp} ${kind}`).toContain(taste![kind]);
    }
    expect(wildTaste('giraffe')!.tree).toBe(3);
    expect(wildTaste('rabbit')!.plant).toBe(3);
    expect(wildTaste('camel')!.stone).toBe(3);
  });

  it('de soorten verschillen echt van elkaar: er zijn veel verschillende smaken', () => {
    const kinds = new Set(ALL.map(sp => JSON.stringify(wildTaste(sp))));
    expect(kinds.size).toBeGreaterThanOrEqual(15);
    // en twee dieren van dezelfde grond willen niet meer vanzelf hetzelfde
    expect(wildTaste('zebra')).not.toEqual(wildTaste('giraffe'));
    expect(wildTaste('cow')).not.toEqual(wildTaste('horse'));
  });

  it('een hogere stand vraagt om meer, en de standen naast elkaar overlappen', () => {
    for (const kind of WILD_KINDS) {
      const levels = WILD_LEVEL[kind];
      expect(levels).toHaveLength(4);
      for (let i = 0; i < 4; i++) expect(levels[i][0]).toBeLessThan(levels[i][1]);
      for (let i = 1; i < 4; i++) {
        expect(levels[i][0], `${kind} ${i}`).toBeGreaterThan(levels[i - 1][0]);
        expect(levels[i][1], `${kind} ${i}`).toBeGreaterThan(levels[i - 1][1]);
        // wat de ene stand hooguit wil, is meer dan wat de volgende minstens wil
        expect(levels[i - 1][1], `${kind} ${i}`).toBeGreaterThan(levels[i][0]);
      }
    }
  });

  it('vriendjes die samen in een verblijf wonen, kunnen het allebei naar hun zin hebben', () => {
    for (const [a, b] of PALS) {
      if (AQUATIC.includes(a) || AQUATIC.includes(b)) continue;
      for (let land = 4; land <= 48; land++) {
        const ra = wildRange(a, land)!, rb = wildRange(b, land)!;
        for (const kind of WILD_KINDS) {
          const lo = Math.max(ra[kind][0], rb[kind][0]), hi = Math.min(ra[kind][1], rb[kind][1]);
          expect(hi, `${a} en ${b}, ${kind}, ${land} tegels`).toBeGreaterThanOrEqual(lo);
        }
      }
    }
  });

  it('wat een dier minstens wil, past in zijn verblijf naast een voerbak, een slaapplek en speelgoed', () => {
    for (const sp of ALL) {
      for (const land of [4, 6, 9, 12, 16, 25]) {
        const range = wildRange(sp, land);
        if (!range) continue;
        // een boom neemt een hele tegel, net als de voerbak, de slaapplek en elk stuk speelgoed: er blijft een tegel
        // vrij om te staan, en de planten en stenen (elk een kwart tegel) passen op wat er over is
        const solid = range.tree[0] + 2 + toyNeed(sp, 50, land, 2);
        expect(solid, `${sp} ${land}`).toBeLessThanOrEqual(land - 1);
        expect(range.plant[0] + range.stone[0], `${sp} ${land}`).toBeLessThanOrEqual((land - solid) * 4);
      }
    }
  });
});

describe('wat een dier vandaag het belangrijkst vindt', () => {
  it('op de boerderij is de volgorde vast: eerst eten, dan de slaapplek, dan de grond', () => {
    expect(wishOrder(12345, null)).toEqual(WISH_ORDER);
  });

  it('ziek, een open hek en bang zijn gaan altijd voor; de rest staat er precies één keer in', () => {
    for (let seed = 1; seed < 200; seed += 7) {
      const order = wishOrder(seed, seed % 9);
      expect(order.slice(0, WISH_FIRST.length)).toEqual(WISH_FIRST);
      expect([...order].sort()).toEqual([...WISH_ORDER].sort());
    }
  });

  it('hetzelfde dier kiest op dezelfde dag steeds hetzelfde, en op een andere dag iets anders', () => {
    expect(wishOrder(777, 3)).toEqual(wishOrder(777, 3));
    const days = new Set(Array.from({ length: 12 }, (_, day) => wishOrder(777, day).join()));
    expect(days.size).toBeGreaterThan(6);
  });

  it('dieren in hetzelfde verblijf vinden niet allemaal hetzelfde het belangrijkst', () => {
    const first = new Map<string, number>();
    for (let seed = 0; seed < 600; seed++) {
      const top = wishOrder(seed * 7919 + 13, 2)[WISH_FIRST.length];
      first.set(top, (first.get(top) ?? 0) + 1);
    }
    // elk van de negen andere wensen staat bij sommige dieren bovenaan, en geen enkele bij bijna iedereen
    expect(first.size).toBe(WISH_ORDER.length - WISH_FIRST.length);
    for (const n of first.values()) expect(n).toBeLessThan(150);
  });

  it('de gokken zijn herhaalbaar en netjes verdeeld', () => {
    const a = seeded(42), b = seeded(42);
    const xs = Array.from({ length: 1000 }, () => a());
    expect(xs.slice(0, 5)).toEqual(Array.from({ length: 5 }, () => b()));
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...xs)).toBeLessThan(1);
    const mean = xs.reduce((s, x) => s + x, 0) / xs.length;
    expect(mean).toBeGreaterThan(0.45);
    expect(mean).toBeLessThan(0.55);
  });
});

/** Het speelgoed dat geen enkele soort in zijn lijstje heeft: dat zou je voor niets vrijspelen. */
describe('alles wat je vrijspeelt, wordt gebruikt', () => {
  it('na elk nieuw stuk speelgoed is er een soort in het park die het wil', () => {
    const fun = (Object.keys(TOY_FROM) as ToyKind[]).filter(k => k !== 'lamp' && k !== 'icebox' && k !== 'filter');
    for (const kind of fun) {
      const done = TOY_FROM[kind];
      const owned = ALL.filter(sp => from(sp) <= done);
      expect(owned.some(sp => likesToy(sp, kind)), `${kind} (na ${done} levels)`).toBe(true);
    }
  });
});
