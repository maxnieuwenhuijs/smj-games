import { describe, expect, it } from 'vitest';
import { CLIMATE, FEATURE, LEVELS, MAX_GUESTS, PALS, PATH_KINDS, PRODUCTS, SHOPS, SHOP_SIZE, SPECIES, TERRAINS, crowdLoad, guestsAt, isPath, migrateLevel, productsFor, unlockedSpecies, worldOf, type SpeciesId } from './data';
import en from './en.json';
import { BASE_LAND, FULL_LAND, Grid, H, PLOT, W, edgeAlong, nearestEdge, tileIndex, type Edge } from './grid';
import { emptyStats, goalProgress, levelDone } from './levels';
import { allLines, fill, goalLine, speciesVars, textOf, voiceId, type Tr } from './lines';
import { ESCAPE_WAY, escapeChance, escapeWay, pickEscaper } from './data';
import nl from './nl.json';
import { AQUATIC, PROP, PROPS, WILD_KINDS, WILD_WANT, propPoints, wildRange, wildWant } from './data';
import { DECOR, WAYFIND, WAYFIND_PATHS, canStray, wayfound } from './data';
import { BONUS, TOY_FROM, TOY_OF, likesToy, type ToyKind } from './data';
import { guestCard, guestFacts, guestNames } from './traits';

/** Zet een hek om het blok tegels van (x0,y0) tot en met (x1,y1). */
function fenceBox(g: Grid, x0: number, y0: number, x1: number, y1: number): Edge[] {
  const edges: Edge[] = [];
  for (let x = x0; x <= x1; x++) edges.push({ o: 'h', x, y: y0 }, { o: 'h', x, y: y1 + 1 });
  for (let y = y0; y <= y1; y++) edges.push({ o: 'v', x: x0, y }, { o: 'v', x: x1 + 1, y });
  for (const e of edges) g.setEdge(e, 1);
  return edges;
}

describe('verblijven', () => {
  it('een leeg park heeft geen verblijf', () => {
    const g = new Grid(FULL_LAND);
    expect(g.regions).toHaveLength(1);
    expect(g.enclosures()).toHaveLength(0);
  });

  it('een dicht hek van 2 bij 2 is een verblijf', () => {
    const g = new Grid(FULL_LAND);
    fenceBox(g, 3, 3, 4, 4);
    expect(g.enclosures()).toHaveLength(1);
    expect(g.enclosureAt(3, 3)?.tiles).toHaveLength(4);
    expect(g.enclosureAt(0, 0)).toBeNull();
  });

  it('een gat in het hek maakt het verblijf open', () => {
    const g = new Grid(FULL_LAND);
    const edges = fenceBox(g, 3, 3, 4, 4);
    g.setEdge(edges[0], 0);
    expect(g.enclosures()).toHaveLength(0);
  });

  it('een poort telt als dicht', () => {
    const g = new Grid(FULL_LAND);
    const edges = fenceBox(g, 3, 3, 4, 4);
    g.setEdge(edges[0], 2);
    expect(g.enclosures()).toHaveLength(1);
  });

  it('te klein telt niet', () => {
    const g = new Grid(FULL_LAND);
    fenceBox(g, 5, 5, 5, 5);
    expect(g.enclosures()).toHaveLength(0);
  });

  it('werkt ook tegen de rand van de kaart', () => {
    const g = new Grid(FULL_LAND);
    fenceBox(g, 0, 0, 1, 1);
    fenceBox(g, W - 2, H - 2, W - 1, H - 1);
    expect(g.enclosures()).toHaveLength(2);
  });

  it('een verblijf is van hout, van steen of van net; een poort past overal bij', () => {
    const g = new Grid(FULL_LAND);
    const edges = fenceBox(g, 3, 3, 4, 4);
    expect(g.penKind(g.enclosureAt(3, 3)!)).toBe(1);
    for (const e of edges) g.setEdge(e, 3);
    expect(g.penKind(g.enclosureAt(3, 3)!)).toBe(3);
    g.setEdge(edges[0], 2);
    expect(g.penKind(g.enclosureAt(3, 3)!)).toBe(3);
    for (const e of edges.slice(1)) g.setEdge(e, 4);
    expect(g.penKind(g.enclosureAt(3, 3)!)).toBe(4);
    // één stukje steen in een net: niet meer helemaal van net
    g.setEdge(edges[1], 3);
    expect(g.penKind(g.enclosureAt(3, 3)!)).toBe(1);
  });

  it('kent de buitenrand van een verblijf', () => {
    const g = new Grid(FULL_LAND);
    fenceBox(g, 3, 3, 4, 4);
    expect(g.borderEdges(g.enclosureAt(3, 3)!)).toHaveLength(8);
  });

  it('een route gaat niet door een hek', () => {
    const g = new Grid(FULL_LAND);
    fenceBox(g, 3, 3, 5, 4);
    expect(g.path(tileIndex(3, 3), tileIndex(5, 4))).toHaveLength(4);
    expect(g.path(tileIndex(3, 3), tileIndex(8, 8))).toBeNull();
  });
});

describe('grond van het park', () => {
  it('je begint met het middelste stuk tegen de voorkant', () => {
    const g = new Grid();
    expect(g.inBounds(BASE_LAND.x0, BASE_LAND.y0)).toBe(true);
    expect(g.inBounds(BASE_LAND.x0 - 1, BASE_LAND.y0)).toBe(false);
    expect(g.inBounds(BASE_LAND.x0, BASE_LAND.y0 - 1)).toBe(false);
    expect(g.inBounds(Math.floor(W / 2), H - 1)).toBe(true);
    // buiten het park kun je geen hek zetten
    expect(g.setEdge({ o: 'h', x: 0, y: 0 }, 1)).toBe(false);
  });

  it('een verblijf tegen de rand blijft een verblijf als het park groter wordt', () => {
    const g = new Grid();
    const { x0, y0 } = BASE_LAND;
    fenceBox(g, x0, y0, x0 + 1, y0 + 1);
    expect(g.enclosures()).toHaveLength(1);
    expect(g.expand('left')).toBe(true);
    expect(g.expand('left')).toBe(false);
    expect(g.inBounds(0, y0)).toBe(true);
    expect(g.enclosures()).toHaveLength(1);
    expect(g.enclosureAt(x0, y0)?.tiles).toHaveLength(4);
    // op de nieuwe grond kun je bouwen
    fenceBox(g, 1, y0, 2, y0 + 1);
    expect(g.enclosures()).toHaveLength(2);
  });

  it('drie stroken: links, rechts en achter', () => {
    const g = new Grid();
    expect(g.plot('back')).toEqual({ x0: PLOT, y0: 0, x1: W - PLOT, y1: PLOT });
    for (const side of ['left', 'right', 'back'] as const) g.expand(side);
    expect(g.land).toEqual(FULL_LAND);
    expect(g.owns('back')).toBe(true);
  });
});

describe('dichtstbijzijnde rand', () => {
  it('kiest de rand waar je het dichtst bij tikt', () => {
    expect(nearestEdge(2.5, 2.1)).toEqual({ o: 'h', x: 2, y: 2 });
    expect(nearestEdge(2.5, 2.9)).toEqual({ o: 'h', x: 2, y: 3 });
    expect(nearestEdge(2.1, 2.5)).toEqual({ o: 'v', x: 2, y: 2 });
    expect(nearestEdge(2.9, 2.5)).toEqual({ o: 'v', x: 3, y: 2 });
  });

  it('geeft niets midden op een tegel als je sleept', () => {
    expect(nearestEdge(2.5, 2.5, 0.3)).toBeNull();
  });

  it('geeft niets buiten de kaart', () => {
    expect(nearestEdge(-3, 2)).toBeNull();
  });

  it('slepen langs een rand geeft op de hoeken geen dwarshekje', () => {
    // vlak bij een hoekpunt, slepend van links naar rechts
    expect(edgeAlong(6.02, 4.99, 'h')).toEqual({ o: 'h', x: 6, y: 5 });
    expect(edgeAlong(5.98, 5.01, 'h')).toEqual({ o: 'h', x: 5, y: 5 });
    expect(edgeAlong(5.01, 6.4, 'v')).toEqual({ o: 'v', x: 5, y: 6 });
    expect(edgeAlong(6.5, 5.5, 'h')).toBeNull();
  });
});

describe('levels', () => {
  it('elk level speelt een dier vrij', () => {
    expect(unlockedSpecies(0)).toEqual([]);
    expect(unlockedSpecies(1)).toEqual(['pig']);
    expect(unlockedSpecies(3)).toEqual(['pig', 'cow', 'sheep']);
    expect(new Set(unlockedSpecies(LEVELS.length)).size).toBe(LEVELS.length);
  });

  it('voortgang loopt niet over het doel heen', () => {
    const s = emptyStats();
    s.animals.pig = 5;
    expect(goalProgress({ type: 'animals', species: 'pig', n: 2 }, s)).toBe(2);
    expect(goalProgress({ type: 'animals', species: 'cow', n: 2 }, s)).toBe(0);
  });

  it('een level is pas af als alle doelen af zijn', () => {
    const s = emptyStats();
    s.enclosures = 1;
    expect(levelDone(LEVELS[0], s)).toBe(false);
    s.troughs = 1;
    expect(levelDone(LEVELS[0], s)).toBe(true);
  });
});

describe('vijftig levels', () => {
  const species = Object.keys(SPECIES) as SpeciesId[];

  it('er zijn vijftig levels en vijftig dieren, elk dier één keer', () => {
    expect(LEVELS).toHaveLength(50);
    // vijftig beloningen en twee zeedieren voor het aquarium
    expect(species).toHaveLength(54);
    expect(new Set(LEVELS.map(l => l.reward)).size).toBe(50);
    expect(worldOf(0)).toBe('farm');
    expect(worldOf(10)).toBe('savanna');
    expect(worldOf(49)).toBe('far');
  });

  it('elk level vraagt om het dier dat je net kreeg', () => {
    LEVELS.forEach((level, i) => {
      if (i < 2) return;
      const happy = level.goals.find(g => g.type === 'happy');
      expect(happy?.species, `level ${i + 1}`).toBe(LEVELS[i - 1].reward);
    });
  });

  it('een doel vraagt nooit om iets wat nog niet vrij is', () => {
    LEVELS.forEach((level, i) => {
      for (const g of level.goals) {
        if (g.type === 'shop') expect(FEATURE[g.shop!], `level ${i + 1} ${g.shop}`).toBeLessThanOrEqual(i);
        if (g.type === 'guests' || g.type === 'path') expect(FEATURE.paths).toBeLessThanOrEqual(i);
        if (g.type === 'healed') expect(FEATURE.sick).toBeLessThanOrEqual(i);
        if (g.type === 'caught') expect(FEATURE.escape).toBeLessThanOrEqual(i);
        if (g.type === 'keeper') expect(FEATURE.keeper).toBeLessThanOrEqual(i);
        if (g.type === 'tidy') expect(FEATURE.bin).toBeLessThanOrEqual(i);
        if (g.type === 'sold' && g.product) expect(productsFor(PRODUCTS.find(p => p.id === g.product)!.shop, i), `level ${i + 1} ${g.product}`).toContain(g.product);
        if (g.type === 'sold' && g.shop) expect(FEATURE[g.shop], `level ${i + 1} ${g.shop}`).toBeLessThanOrEqual(i);
        if (g.type === 'kinds') expect(g.n).toBeLessThanOrEqual(i);
        if (g.species) expect(unlockedSpecies(i)).toContain(g.species);
      }
    });
    for (const kind of SHOPS) {
      expect(FEATURE[kind]).toBeGreaterThan(0);
      expect(SHOP_SIZE[kind]).toBeGreaterThan(0);
    }
    // gasten vragen pas om iets als de kraam waar het te koop is er ook is
    for (const p of PRODUCTS) expect(p.from, p.id).toBeGreaterThanOrEqual(FEATURE[p.shop]);
  });

  it('de doelen worden per wereld zwaarder', () => {
    const most = (type: string, from: number, to: number): number =>
      Math.max(0, ...LEVELS.slice(from, to).flatMap(l => l.goals.filter(g => g.type === type).map(g => g.n)));
    for (const type of ['guests', 'kinds', 'happyany'])
      for (let w = 1; w < 5; w++) expect(most(type, w * 10, w * 10 + 10), `${type} wereld ${w + 1}`).toBeGreaterThanOrEqual(most(type, (w - 1) * 10, w * 10));
  });

  it('een oud opgeslagen spel gaat verder waar het was', () => {
    expect(migrateLevel(5, 1)).toBe(5);
    expect(migrateLevel(7, 1)).toBe(7);
    expect(migrateLevel(9, 1)).toBe(12);
    expect(migrateLevel(9, 2)).toBe(9);
    // wie de zebra al had (acht levels klaar), heeft hem na het verhuizen nog steeds
    expect(unlockedSpecies(migrateLevel(8, 1))).toContain('zebra');
  });
});

describe('teksten en stemmen', () => {
  const tables: Record<string, Record<string, string>> = { nl, en };

  it('Nederlands en Engels hebben dezelfde teksten', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(nl).sort());
  });

  for (const [lang, table] of Object.entries(tables)) {
    const tr: Tr = (key, vars) => fill(table[key] ?? `?${key}?`, vars);

    it(`${lang}: elke zin die kan klinken is compleet`, () => {
      const lines = allLines(tr);
      expect(lines.length).toBeGreaterThan(500);
      for (const line of lines) {
        expect(line.text, line.text).not.toMatch(/[{}?]\w*[{}?]|\{|\}|\?\w+\?/);
        expect(line.text.length).toBeGreaterThan(3);
      }
      // geen twee zinnen met dezelfde vingerafdruk
      expect(new Set(lines.map(l => voiceId(l.who, l.text))).size).toBe(lines.length);
    });

    it(`${lang}: elk dier, elke grond, elk voer en elke winkel heeft een naam`, () => {
      for (const sp of Object.keys(SPECIES)) for (const suffix of ['', '.the', '.many']) expect(table[`species.${sp}${suffix}`], sp).toBeTruthy();
      for (const info of Object.values(SPECIES)) {
        expect(table[`terrain.${info.terrain}`]).toBeTruthy();
        expect(table[`terrain.${info.terrain}.want`]).toBeTruthy();
        expect(table[`food.${info.food}`]).toBeTruthy();
        expect(table[`bed.${info.bed}`]).toBeTruthy();
        expect(table[`bed.${info.bed}.a`]).toBeTruthy();
      }
      for (const kind of SHOPS) expect(table[`shop.${kind}`]).toBeTruthy();
      for (const p of PRODUCTS) expect(table[`product.${p.id}`], p.id).toBeTruthy();
      LEVELS.forEach((level, i) => {
        expect(table[`say.level.${i + 1}`]).toBeTruthy();
        for (const g of level.goals) expect(textOf(tr, goalLine(tr, g))).not.toContain('?');
      });
    });
  }

  it('de vingerafdruk van een zin is altijd dezelfde', () => {
    expect(voiceId('director', 'Goed gedaan!')).toBe(voiceId('director', 'Goed gedaan!'));
    expect(voiceId('director', 'Goed gedaan!')).not.toBe(voiceId('keeper', 'Goed gedaan!'));
    expect(voiceId('director', 'Goed gedaan!')).toMatch(/^[0-9a-f]{16}$/);
  });
});

describe('paden, kinderboerderij en drukte', () => {
  it('alle soorten pad tellen als pad, gras en water niet', () => {
    for (const kind of PATH_KINDS) expect(isPath(TERRAINS.indexOf(kind)), kind).toBe(true);
    expect(isPath(TERRAINS.indexOf('grass'))).toBe(false);
    expect(isPath(TERRAINS.indexOf('water'))).toBe(false);
  });

  it('een verblijf met het witte hekje en een poortje voor gasten is een kinderboerderij', () => {
    const g = new Grid(FULL_LAND);
    const edges = fenceBox(g, 3, 3, 6, 5);
    for (const e of edges) g.setEdge(e, 7);
    g.setEdge(edges[0], 8);
    expect(g.enclosures()).toHaveLength(1);
    expect(g.penKind(g.enclosureAt(3, 3)!)).toBe(7);
    // dieren en gasten lopen er niet zomaar door; personeel wel
    expect(g.canStep(3, 3, 0, -1)).toBe(false);
    expect(g.canStep(3, 3, 0, -1, true)).toBe(true);
  });

  it('een kijkruit past in elk soort hek', () => {
    const g = new Grid(FULL_LAND);
    const edges = fenceBox(g, 3, 3, 4, 4);
    for (const e of edges) g.setEdge(e, 3);
    g.setEdge(edges[2], 6);
    expect(g.penKind(g.enclosureAt(3, 3)!)).toBe(3);
  });

  it('het park groeit mee tot veel meer gasten, maar de drukte bij de kramen loopt minder hard op', () => {
    expect(guestsAt(0)).toBe(14);
    expect(guestsAt(49)).toBe(MAX_GUESTS);
    expect(guestsAt(49, 0)).toBeLessThan(guestsAt(49, 1));
    expect(crowdLoad(20)).toBe(20);
    expect(crowdLoad(160)).toBeLessThan(70);
  });

  it('elk dier dat warmte of kou wil en elk vriendje bestaat ook echt', () => {
    for (const sp of Object.keys(CLIMATE)) expect(SPECIES[sp as SpeciesId], sp).toBeTruthy();
    for (const [a, b] of PALS) {
      expect(SPECIES[a], a).toBeTruthy();
      expect(SPECIES[b], b).toBeTruthy();
    }
  });

  it('een wegwijzer wijst de weg binnen zijn bereik, een plattegrond verder; daarbuiten kun je verdwalen', () => {
    const signs = [{ gx: 10.5, gy: 10.5, r: WAYFIND.signpost }];
    expect(wayfound(signs, 10.5 + WAYFIND.signpost, 10.5)).toBe(true);
    expect(wayfound(signs, 10.5 + WAYFIND.signpost + 0.5, 10.5)).toBe(false);
    expect(wayfound([...signs, { gx: 30.5, gy: 10.5, r: WAYFIND.mapboard }], 20.5, 10.5)).toBe(true);
    expect(wayfound([], 3, 3)).toBe(false);
    expect(WAYFIND.mapboard).toBeGreaterThan(WAYFIND.signpost);
  });

  it('in een klein park of voordat de wegwijzer te koop is, raakt niemand de weg kwijt', () => {
    expect(canStray(DECOR.signpost.from - 1, 500)).toBe(false);
    expect(canStray(DECOR.signpost.from, WAYFIND_PATHS)).toBe(false);
    expect(canStray(DECOR.signpost.from, WAYFIND_PATHS + 1)).toBe(true);
  });
});

describe('natuur in de verblijven', () => {
  it('elk landdier weet hoeveel bomen, planten en stenen het wil, en dat kan ook', () => {
    for (const sp of Object.keys(SPECIES) as SpeciesId[]) {
      const want = wildWant(sp);
      if (AQUATIC.includes(sp)) {
        expect(want).toBeNull();
        continue;
      }
      expect(want, sp).not.toBeNull();
      for (const kind of WILD_KINDS) expect(want![kind][0]).toBeLessThan(want![kind][1]);
    }
    expect(Object.keys(WILD_WANT).length).toBeGreaterThan(3);
  });

  it('in het kleinste verblijf vraagt geen dier om een boom, en het minimum past er altijd in', () => {
    for (const sp of Object.keys(SPECIES) as SpeciesId[]) {
      const small = wildRange(sp, 4);
      if (!small) continue;
      // een boom neemt een hele tegel: in vier tegels is daar geen plek voor
      expect(small.tree[0], sp).toBe(0);
      expect(small.plant[0] + small.stone[0], sp).toBeLessThanOrEqual(2);
    }
  });

  it('hoe groter het verblijf, hoe meer het dier wil; er is altijd ruimte tussen minstens en hooguit', () => {
    for (const sp of Object.keys(SPECIES) as SpeciesId[]) {
      for (const land of [4, 9, 16, 36, 64]) {
        const range = wildRange(sp, land);
        if (!range) continue;
        for (const kind of WILD_KINDS) {
          const [min, max] = range[kind];
          expect(max, `${sp} ${kind} ${land}`).toBeGreaterThan(min);
          // alles wat het dier minstens wil, past samen in het verblijf (een boom neemt een tegel, de rest een kwart)
          expect(range.tree[0] + (range.plant[0] + range.stone[0]) / 4).toBeLessThan(land / 2);
          const bigger = wildRange(sp, land * 2)!;
          expect(bigger[kind][0]).toBeGreaterThanOrEqual(min);
          expect(bigger[kind][1]).toBeGreaterThanOrEqual(max);
        }
      }
    }
    // een giraf (zand) in een verblijf van zestien tegels: minstens één boom, hooguit drie
    expect(wildRange('giraffe', 16)!.tree).toEqual([1, 3]);
  });

  it('iets kleins telt voor één vakje, een boom of rots voor vier', () => {
    for (const kind of PROPS) expect(propPoints(kind)).toBe(PROP[kind].size === 2 ? 4 : 1);
  });

  it('wat voor het park is telt voor geen dier mee, is klein en komt na de natuur', () => {
    for (const kind of PROPS) {
      const park = PROP[kind].group === 'park';
      // natuur telt altijd ergens voor mee; het spul voor het park nooit
      expect(!!PROP[kind].wild, kind).toBe(!park);
      if (!park) continue;
      expect(PROP[kind].size, kind).toBe(1);
      expect(PROP[kind].from, kind).toBeGreaterThan(FEATURE.wild);
      expect(nl[`prop.${kind}` as keyof typeof nl], kind).toBeTruthy();
    }
    // nieuwe soorten komen achteraan, zodat de natuur zijn plek in het rijtje houdt
    expect(PROPS.findIndex(k => PROP[k].group === 'park')).toBe(PROPS.filter(k => PROP[k].group !== 'park').length);
  });
});

describe('de weetjes van een gast', () => {
  it('er zijn in elke taal meer dan 500 verschillende weetjes en genoeg namen', () => {
    for (const lang of ['nl', 'en']) {
      const facts = guestFacts(lang);
      expect(new Set(facts).size, lang).toBeGreaterThan(500);
      // geen weetje staat er twee keer in, en elk weetje is kort genoeg voor het menu
      expect(new Set(facts).size, lang).toBe(facts.length);
      for (const f of facts) expect(f.length, f).toBeLessThanOrEqual(40);
      expect(new Set(guestNames(lang)).size, lang).toBeGreaterThanOrEqual(80);
    }
    // de twee talen hebben even veel weetjes: bij elk rijtje hoort een vertaling
    expect(guestFacts('nl').length).toBe(guestFacts('en').length);
  });

  it('dezelfde gast houdt hetzelfde kaartje, met drie verschillende weetjes', () => {
    for (const lang of ['nl', 'en']) {
      const names = guestNames(lang);
      for (let seed = 1; seed < 400; seed++) {
        const child = seed % 3 === 0, card = guestCard(seed * 7919, child, lang);
        expect(guestCard(seed * 7919, child, lang)).toEqual(card);
        expect(names).toContain(card.name);
        expect(new Set(card.facts).size).toBe(3);
      }
    }
  });

  it('een weetje voor kinderen komt nooit bij een groot mens, en andersom', () => {
    for (const lang of ['nl', 'en']) {
      const kid = new Set(guestFacts(lang, 'kid')), adult = new Set(guestFacts(lang, 'adult'));
      for (let seed = 1; seed < 1500; seed++) {
        for (const f of guestCard(seed, false, lang).facts) expect(kid.has(f), f).toBe(false);
        for (const f of guestCard(seed, true, lang).facts) expect(adult.has(f), f).toBe(false);
      }
    }
  });

  it('een gast in een rolstoel krijgt rustige weetjes, de juf geen ander werk', () => {
    for (let seed = 1; seed < 600; seed++) {
      const card = guestCard(seed, false, 'nl', { skip: ['job'], count: 2, sex: 'f' });
      expect(card.facts).toHaveLength(2);
      for (const f of card.facts) expect(f.startsWith('Werkt '), f).toBe(false);
      const calm = guestCard(seed, false, 'nl', { calm: true }).facts;
      expect(calm).toHaveLength(3);
      for (const f of calm) expect(/^(Klimt|Rent|Springt|Loopt|Huppelt|Fietst|Kan op|Kan heel snel) /.test(f), f).toBe(false);
    }
  });
});

describe('wensen per level: alles wat iemand vraagt, kun je in dat level ook neerzetten', () => {
  const levels = Array.from({ length: LEVELS.length + 1 }, (_, i) => i);
  const feature = (k: string): number => (FEATURE as Record<string, number>)[k] ?? 0;

  it('een gast vraagt alleen om een kraam als die er al is, en die kraam heeft dan meteen iets te koop', () => {
    // wat een gast kan vragen, en bij welke kraam dat hoort (zie NEED_SHOP in people.ts)
    const needs: Record<string, string> = {
      food: 'foodstall', drink: 'drinkstall', toilet: 'toilet', icecream: 'icecream', balloon: 'balloon', hat: 'hats', souvenir: 'souvenir',
      play: 'playground', sit: 'bench', look: 'fountain', ride: 'carousel', umbrella: 'umbrellas', shelter: 'shelter',
    };
    for (const [need, shop] of Object.entries(needs)) {
      expect(feature(shop), `${need}: ${shop} heeft geen level in FEATURE`).toBeGreaterThan(0);
      const first = Math.min(...PRODUCTS.filter(p => p.shop === shop).map(p => p.from));
      if (Number.isFinite(first)) expect(first, `${shop}: het eerste product komt later dan de kraam`).toBeLessThanOrEqual(feature(shop));
    }
    // regen en schuilen komen tegelijk met de paraplukraam en de schuilhut
    expect(feature('shelter')).toBeLessThanOrEqual(feature('weather'));
    // de weg kwijt kan pas als er wegwijzers zijn, en het donker pas als er lantaarns zijn
    expect(canStray(DECOR.signpost.from - 1, WAYFIND_PATHS + 100)).toBe(false);
    expect(DECOR.lantern.from).toBeLessThanOrEqual(feature('night'));
  });

  it('een dier wil alleen speelgoed, warmte of kou die in dat level al te koop is', () => {
    for (const done of levels) {
      const here = [...unlockedSpecies(done), ...(Object.keys(BONUS) as SpeciesId[]).filter(sp => BONUS[sp]! <= done)];
      for (const sp of here) {
        if (done >= FEATURE.fun && TOY_OF[sp]) {
          const liked = (Object.keys(TOY_FROM) as ToyKind[]).filter(k => likesToy(sp, k));
          expect(liked.some(k => TOY_FROM[k] <= done), `level ${done}: ${sp} wil speelgoed dat nog niet te koop is`).toBe(true);
        }
        const need = CLIMATE[sp];
        if (done >= FEATURE.climate && need) expect(TOY_FROM[need], `level ${done}: ${sp} wil een ${need}`).toBeLessThanOrEqual(done);
      }
    }
  });
});

describe('ontsnappen', () => {
  it('elk landdier ontsnapt op zijn eigen manier, een zeedier nooit', () => {
    for (const sp of Object.keys(SPECIES) as SpeciesId[]) {
      if (AQUATIC.includes(sp)) expect(ESCAPE_WAY[sp], sp).toBeNull();
      else expect(['jump', 'climb', 'fly', 'push', 'slip'], sp).toContain(ESCAPE_WAY[sp]);
    }
  });

  it('wie het hek omduwt, heeft een stenen muur nodig', () => {
    for (const sp of Object.keys(SPECIES) as SpeciesId[]) if (ESCAPE_WAY[sp] === 'push') expect(SPECIES[sp].need, sp).toBe('wall');
  });

  it('het goede hek houdt de eigen manier tegen: dan glipt een dier hooguit door een kier', () => {
    expect(escapeWay('lion', true)).toBe('push');
    expect(escapeWay('monkey', true)).toBe('climb');
    expect(escapeWay('parrot', true)).toBe('fly');
    expect(escapeWay('lion', false)).toBe('slip');
    expect(escapeWay('monkey', false)).toBe('slip');
    // zonder eigen hek is elk hek goed
    expect(escapeWay('goat', false)).toBe('jump');
    expect(escapeWay('dolphin', true)).toBeNull();
  });

  it('achter het verkeerde hek ontsnapt een dier het vaakst, blij achter het goede hek bijna nooit', () => {
    for (const sp of Object.keys(SPECIES) as SpeciesId[]) {
      if (AQUATIC.includes(sp)) {
        expect(escapeChance(sp, true, false)).toBe(0);
        continue;
      }
      expect(escapeChance(sp, true, true)).toBe(1);
      expect(escapeChance(sp, false, false)).toBeLessThan(1);
      expect(escapeChance(sp, false, true)).toBeLessThan(0.05);
      expect(escapeChance(sp, false, true)).toBeGreaterThan(0);
    }
  });

  it('wie ontsnapt: het verkeerde hek gaat voor, en vraagt het level erom dan ontsnapt er altijd een', () => {
    const happy = { item: 'blij', chance: escapeChance('monkey', false, true) };
    const wrong = { item: 'verkeerd', chance: escapeChance('monkey', true, false) };
    const sea = { item: 'zee', chance: escapeChance('shark', true, false) };
    // zonder doel: een blij dier achter het goede hek lukt het (bijna) nooit
    let n = 0;
    for (let i = 0; i < 1000; i++) if (pickEscaper([happy, sea], false)) n++;
    expect(n).toBeLessThan(100);
    // met een doel wel, maar nooit een zeedier
    for (let i = 0; i < 50; i++) expect(pickEscaper([happy, sea], true)).toBe('blij');
    expect(pickEscaper([sea], true)).toBeNull();
    // het verkeerde hek wint bijna altijd
    let w = 0;
    for (let i = 0; i < 1000; i++) if (pickEscaper([happy, happy, wrong], false) === 'verkeerd') w++;
    expect(w).toBeGreaterThan(900);
  });

  it('de melding noemt het hek dat helpt, en de bewaker heeft een naam en een zin', () => {
    const tr: Tr = (key, vars) => fill((nl as Record<string, string>)[key] ?? key, vars);
    for (const need of ['wall', 'net'] as const) {
      expect((nl as Record<string, string>)[`say.escaped.${need}`]).toBeTruthy();
      expect((en as Record<string, string>)[`say.escaped.${need}`]).toBeTruthy();
    }
    expect(textOf(tr, { who: 'keeper', mood: 'happy', key: 'say.guard.back' })).not.toBe('say.guard.back');
    for (const key of ['staff.guard', 'say.hired.guard', 'say.guard.back', 'say.guard.new']) expect((en as Record<string, string>)[key], key).toBeTruthy();
    expect(FEATURE.guard).toBeGreaterThanOrEqual(FEATURE.escape);
    const texts = allLines(tr).map(l => l.text);
    expect(texts).toContain(tr('say.escaped.net', speciesVars(tr, 'monkey')));
  });
});
