import { describe, expect, it } from 'vitest';
import { CLIMATE, FEATURE, LEVELS, MAX_GUESTS, PALS, PATH_KINDS, PRODUCTS, SHOPS, SHOP_SIZE, SPECIES, TERRAINS, crowdLoad, guestsAt, isPath, migrateLevel, productsFor, unlockedSpecies, worldOf, type SpeciesId } from './data';
import en from './en.json';
import { BASE_LAND, FULL_LAND, Grid, H, PLOT, W, edgeAlong, nearestEdge, tileIndex, type Edge } from './grid';
import { emptyStats, goalProgress, levelDone } from './levels';
import { allLines, fill, goalLine, textOf, voiceId, type Tr } from './lines';
import nl from './nl.json';
import { AQUATIC, PROP, PROPS, WILD_KINDS, WILD_WANT, propPoints, wildRange, wildWant } from './data';

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
});
