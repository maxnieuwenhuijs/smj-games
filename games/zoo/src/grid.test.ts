import { describe, expect, it } from 'vitest';
import { LEVELS, unlockedSpecies } from './data';
import { Grid, H, W, edgeAlong, nearestEdge, tileIndex, type Edge } from './grid';
import { emptyStats, goalProgress, levelDone } from './levels';

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
    const g = new Grid();
    expect(g.regions).toHaveLength(1);
    expect(g.enclosures()).toHaveLength(0);
  });

  it('een dicht hek van 2 bij 2 is een verblijf', () => {
    const g = new Grid();
    fenceBox(g, 3, 3, 4, 4);
    expect(g.enclosures()).toHaveLength(1);
    expect(g.enclosureAt(3, 3)?.tiles).toHaveLength(4);
    expect(g.enclosureAt(0, 0)).toBeNull();
  });

  it('een gat in het hek maakt het verblijf open', () => {
    const g = new Grid();
    const edges = fenceBox(g, 3, 3, 4, 4);
    g.setEdge(edges[0], 0);
    expect(g.enclosures()).toHaveLength(0);
  });

  it('een poort telt als dicht', () => {
    const g = new Grid();
    const edges = fenceBox(g, 3, 3, 4, 4);
    g.setEdge(edges[0], 2);
    expect(g.enclosures()).toHaveLength(1);
  });

  it('te klein telt niet', () => {
    const g = new Grid();
    fenceBox(g, 5, 5, 5, 5);
    expect(g.enclosures()).toHaveLength(0);
  });

  it('werkt ook tegen de rand van de kaart', () => {
    const g = new Grid();
    fenceBox(g, 0, 0, 1, 1);
    fenceBox(g, W - 2, H - 2, W - 1, H - 1);
    expect(g.enclosures()).toHaveLength(2);
  });

  it('een houten hek is niet sterk genoeg, een stenen muur wel', () => {
    const g = new Grid();
    const edges = fenceBox(g, 3, 3, 4, 4);
    expect(g.penStrength(g.enclosureAt(3, 3)!)).toBe(1);
    for (const e of edges) g.setEdge(e, 3);
    expect(g.penStrength(g.enclosureAt(3, 3)!)).toBe(2);
    g.setEdge(edges[0], 2);
    expect(g.penStrength(g.enclosureAt(3, 3)!)).toBe(2);
  });

  it('een route gaat niet door een hek', () => {
    const g = new Grid();
    fenceBox(g, 3, 3, 5, 4);
    expect(g.path(tileIndex(3, 3), tileIndex(5, 4))).toHaveLength(4);
    expect(g.path(tileIndex(3, 3), tileIndex(8, 8))).toBeNull();
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
