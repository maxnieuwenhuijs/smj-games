import { describe, expect, it } from 'vitest';
import { BASE_LAND, Grid, cornerEdges, cornerTiles, nearestSpot, spotEdges, spotKey, spotPos, spotTiles } from './grid';

describe('plekken voor palen: de hoeken van een tegel en het midden van elke rand', () => {
  it('een plek ligt op een hoek of midden op een rand', () => {
    expect(spotPos({ o: 'c', x: 10, y: 12 })).toEqual([10, 12]);
    expect(spotPos({ o: 'h', x: 10, y: 12 })).toEqual([10.5, 12]);
    expect(spotPos({ o: 'v', x: 10, y: 12 })).toEqual([10, 12.5]);
    expect(spotKey({ o: 'c', x: 3, y: 4 })).toBe('c3,4');
  });

  it('kiest de dichtstbijzijnde van de acht plekken rond de tegel', () => {
    // vlak bij de vier hoeken
    expect(nearestSpot(10.1, 12.1)).toEqual({ o: 'c', x: 10, y: 12 });
    expect(nearestSpot(10.9, 12.1)).toEqual({ o: 'c', x: 11, y: 12 });
    expect(nearestSpot(10.1, 12.9)).toEqual({ o: 'c', x: 10, y: 13 });
    expect(nearestSpot(10.9, 12.9)).toEqual({ o: 'c', x: 11, y: 13 });
    // vlak bij het midden van elke rand
    expect(nearestSpot(10.5, 12.1)).toEqual({ o: 'h', x: 10, y: 12 });
    expect(nearestSpot(10.5, 12.9)).toEqual({ o: 'h', x: 10, y: 13 });
    expect(nearestSpot(10.1, 12.5)).toEqual({ o: 'v', x: 10, y: 12 });
    expect(nearestSpot(10.9, 12.5)).toEqual({ o: 'v', x: 11, y: 12 });
    // midden op de tegel staat nooit een paal: daar kiest hij een rand
    expect(nearestSpot(10.5, 12.45)?.o).toBe('h');
    expect(nearestSpot(-5, 3)).toBeNull();
  });

  it('elke plek van elke tegel wordt gedeeld met de buren', () => {
    // de zuidoosthoek van tegel (4, 4) is de noordwesthoek van tegel (5, 5)
    expect(nearestSpot(4.95, 4.95)).toEqual(nearestSpot(5.05, 5.05));
    // de oostrand van tegel (4, 4) is de westrand van tegel (5, 4)
    expect(nearestSpot(4.95, 4.5)).toEqual(nearestSpot(5.05, 4.5));
  });

  it('weet welke randen en tegels er in een hoek samenkomen', () => {
    const [x, y] = [20, 20];
    // de vier randen raken allemaal het hoekpunt
    for (const e of cornerEdges(x, y)) {
      const ends = e.o === 'h' ? [[e.x, e.y], [e.x + 1, e.y]] : [[e.x, e.y], [e.x, e.y + 1]];
      expect(ends.some(([ex, ey]) => ex === x && ey === y)).toBe(true);
    }
    expect(new Set(cornerEdges(x, y).map(e => `${e.o}${e.x},${e.y}`)).size).toBe(4);
    expect(cornerTiles(x, y)).toEqual([[19, 19], [20, 19], [19, 20], [20, 20]]);
    expect(spotTiles({ o: 'h', x, y })).toEqual([[20, 19], [20, 20]]);
    expect(spotTiles({ o: 'v', x, y })).toEqual([[19, 20], [20, 20]]);
    expect(spotEdges({ o: 'v', x, y })).toEqual([{ o: 'v', x, y }]);
    expect(spotEdges({ o: 'c', x, y })).toHaveLength(4);
  });

  it('een plek moet op de grond van het park liggen', () => {
    const grid = new Grid(BASE_LAND);
    const { x0, y0, x1, y1 } = BASE_LAND;
    expect(grid.validSpot({ o: 'c', x: x0, y: y0 })).toBe(true);
    expect(grid.validSpot({ o: 'c', x: x1, y: y1 })).toBe(true);
    expect(grid.validSpot({ o: 'c', x: x0 - 1, y: y0 })).toBe(false);
    expect(grid.validSpot({ o: 'c', x: x1 + 1, y: y1 })).toBe(false);
    expect(grid.validSpot({ o: 'h', x: x0, y: y0 })).toBe(true);
    expect(grid.validSpot({ o: 'h', x: x1, y: y0 })).toBe(false);
  });
});
