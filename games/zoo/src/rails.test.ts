import { describe, expect, it } from 'vitest';
import { CROSSING, RAILS, TERRAINS, TRAIN } from './data';
import { H, W, tileIndex } from './grid';
import { RAIL_END, RAIL_HERE, planRails, railAt, railClaim, railLinks, railNear, railNext, railPieces, railSpeed, trainWagons, type RailGround, type RailRoute, type RailStation } from './rails';

const PATH = TERRAINS.indexOf('path');

/**
 * Een stukje park uit een tekening: R = rails, X = overweg, P = pad, een punt = gras. De linkerbovenhoek van de
 * tekening ligt op tegel (10, 10). `fences`: randen waar een hek op staat, als 'x,y>x,y' (van tegel naar buurtegel).
 */
function park(rows: string[], fences: string[] = []): RailGround & { terrain: Uint8Array } {
  const terrain = new Uint8Array(W * H);
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    terrain[tileIndex(10 + x, 10 + y)] = ch === 'R' ? RAILS : ch === 'X' ? CROSSING : ch === 'P' ? PATH : 0;
  }));
  const shut = new Set(fences.flatMap(f => {
    const [a, b] = f.split('>');
    return [`${a}>${b}`, `${b}>${a}`];
  }));
  return {
    terrain,
    canStep: (x, y, dx, dy) => x + dx >= 0 && y + dy >= 0 && x + dx < W && y + dy < H && !shut.has(`${x},${y}>${x + dx},${y + dy}`),
  };
}
/** De tegel op plek (x, y) van de tekening. */
const at = (x: number, y: number): number => tileIndex(10 + x, 10 + y);
/** Een halte van 2 bij 2 met zijn linkerbovenhoek op plek (x, y) van de tekening. */
const station = (x: number, y: number): RailStation => ({ x: 10 + x, y: 10 + y, w: 2, h: 2 });
/** De routes van de treinen in deze tekening, met deze haltes (en hekken). */
const plan = (rows: string[], stations: RailStation[], fences: string[] = []) => {
  const grid = park(rows, fences);
  return planRails(grid, railLinks(grid), stations);
};
/** Het punt op de route op afstand `d`: [x, y, richting x, richting y]. */
const point = (route: RailRoute, d: number): number[] => {
  const p = [0, 0, 0, 0];
  railAt(route, d, p);
  return p;
};

// een rondje van 6 bij 4 tegels, met een pad dat er twee keer overheen gaat
const LOOP = [
  'RRXRRR',
  'R.P..R',
  'R.P..R',
  'RRXRRR',
];

describe('spoor: welke tegels aan elkaar vastzitten', () => {
  it('rails en overwegen sluiten op elkaar aan, pad en gras niet', () => {
    const links = railLinks(park(['RRXR', '..P.', '..R.']));
    expect(links[at(0, 0)]).toBe(RAIL_HERE | 2);
    expect(links[at(1, 0)]).toBe(RAIL_HERE | 2 | 8);
    // de overweg: links en rechts spoor; het pad eronder telt niet
    expect(links[at(2, 0)]).toBe(RAIL_HERE | 2 | 8);
    expect(links[at(3, 0)]).toBe(RAIL_HERE | 8);
    expect(links[at(2, 1)]).toBe(0);
    // een los stukje: er ligt spoor, maar het zit nergens aan vast
    expect(links[at(2, 2)]).toBe(RAIL_HERE);
  });

  it('een hek op de rand tussen twee tegels breekt het spoor', () => {
    const links = railLinks(park(['RRRR'], ['11,10>12,10']));
    expect(links[at(1, 0)]).toBe(RAIL_HERE | 8);
    expect(links[at(2, 0)]).toBe(RAIL_HERE | 2);
  });

  it('per tegel de goede stukken: recht, bocht, wissel, kruising en stootblok', () => {
    expect(railPieces(0)).toEqual([{ kind: 'stub', turn: 0 }]);
    expect(railPieces(1 | 4)).toEqual([{ kind: 'straight', turn: 0 }]);
    expect(railPieces(2 | 8)).toEqual([{ kind: 'straight', turn: 1 }]);
    // de vier bochten: noord-oost, oost-zuid, zuid-west en west-noord
    expect(railPieces(1 | 2)).toEqual([{ kind: 'curve', turn: 0 }]);
    expect(railPieces(2 | 4)).toEqual([{ kind: 'curve', turn: 1 }]);
    expect(railPieces(4 | 8)).toEqual([{ kind: 'curve', turn: 2 }]);
    expect(railPieces(8 | 1)).toEqual([{ kind: 'curve', turn: 3 }]);
    // een eindje: het stootblok staat tegenover de kant waar het spoor vandaan komt
    for (let s = 0; s < 4; s++) expect(railPieces(1 << s)).toEqual([{ kind: 'end', turn: s }]);
    // een wissel: oost-west rechtdoor, met een zijtak naar het zuiden (twee bochten)
    expect(railPieces(2 | 4 | 8)).toEqual([{ kind: 'straight', turn: 1 }, { kind: 'curve', turn: 1 }, { kind: 'curve', turn: 2 }]);
    expect(railPieces(1 | 2 | 4)).toEqual([{ kind: 'straight', turn: 0 }, { kind: 'curve', turn: 0 }, { kind: 'curve', turn: 1 }]);
    // een kruising: twee rechte stukken, geen bochten
    expect(railPieces(15)).toEqual([{ kind: 'straight', turn: 0 }, { kind: 'straight', turn: 1 }]);
  });
});

describe('spoor: de route van de trein', () => {
  it('een rondje wordt steeds rondgereden, langs alle haltes', () => {
    const { routes, served } = plan(LOOP, [station(1, -2), station(3, 4)]);
    expect(routes).toHaveLength(1);
    const route = routes[0];
    expect(route.loop).toBe(true);
    expect(route.tiles).toHaveLength(16);
    expect(new Set(route.tiles).size).toBe(16);
    // twaalf rechte tegels en vier bochten
    expect(route.length).toBeCloseTo(12 + Math.PI);
    expect(served).toEqual([0, 0]);
    expect(route.stops.map(s => s.stations)).toEqual([[0], [1]]);
    expect(route.wagons).toBe(TRAIN.wagons);
  });

  it('een halte zonder spoor ernaast, of met een hek ertussen, krijgt geen trein', () => {
    expect(plan(LOOP, [station(1, -2), station(8, 0)]).served).toEqual([0, -1]);
    // een hek langs de hele halte: de tegels (1,0) en (2,0) liggen er niet meer naast
    expect(plan(LOOP, [station(1, -2)], ['11,9>11,10', '12,9>12,10']).served).toEqual([-1]);
    expect(plan(LOOP, []).routes).toEqual([]);
  });

  it('een lijn wordt heen en weer gereden; te kort spoor krijgt geen trein', () => {
    const { routes, served } = plan(['RRRRRRRRRR'], [station(4, 1)]);
    expect(routes).toHaveLength(1);
    expect(routes[0].loop).toBe(false);
    expect(routes[0].tiles).toEqual(Array.from({ length: 10 }, (_, i) => at(i, 0)));
    // aan beide eindjes staat een stootblok
    expect(routes[0].length).toBeCloseTo(8 + 2 * RAIL_END);
    expect(served).toEqual([0]);
    // de trein past ertussen, met ruimte om te rijden
    expect(routes[0].length - routes[0].front - routes[0].back).toBeGreaterThan(1.4);
    expect(plan(['RRRR'], [station(1, 1)]).routes).toEqual([]);
    expect(plan(['RRRR'], [station(1, 1)]).served).toEqual([-1]);
    expect(plan(['RRRRR'], [station(1, 1)]).routes[0].wagons).toBe(1);
  });

  it('bij een wissel kiest hij de route langs de meeste haltes, en anders de langste', () => {
    const rows = [
      'RRRRRRRRRR',
      '....R.....',
      '....R.....',
      '....R.....',
      '....R.....',
    ];
    // zonder halte aan de zijtak: rechtdoor, de zijtak blijft liggen
    const flat = plan(rows, [station(0, -2), station(8, -2)]).routes[0];
    expect(flat.tiles).toEqual(Array.from({ length: 10 }, (_, i) => at(i, 0)));
    // met een halte aan de zijtak en één aan de linkerkant: de bocht om
    const turn = plan(rows, [station(0, -2), station(5, 3)]);
    expect(turn.served).toEqual([0, 0]);
    expect(turn.routes[0].tiles).toContain(at(4, 4));
    expect(turn.routes[0].tiles).not.toContain(at(9, 0));
    // drie haltes: twee krijgen de trein, bij de derde komt hij niet
    const three = plan(rows, [station(0, -2), station(8, -2), station(5, 3)]);
    expect(three.served.filter(r => r === 0)).toHaveLength(2);
  });

  it('een rondje met een zijspoor: de trein blijft op het rondje als daar de haltes staan', () => {
    const rows = [
      'RRRRR....',
      'R...R....',
      'R...RRRRR',
      'R...R....',
      'RRRRR....',
    ];
    const round = plan(rows, [station(1, -2)]).routes[0];
    expect(round.loop).toBe(true);
    expect(round.tiles).not.toContain(at(8, 2));
    // staat de halte aan het zijspoor, dan rijdt hij daar ook langs (en dus heen en weer)
    const spur = plan(rows, [station(1, -2), station(6, 3)]).routes[0];
    expect(spur.loop).toBe(false);
    expect(spur.tiles).toContain(at(8, 2));
    expect(spur.stops).toHaveLength(2);
  });

  it('een acht rijdt over zijn eigen kruising: daar gaat de trein rechtdoor', () => {
    const rows = [
      'RRR..',
      'R.R..',
      'RRRRR',
      '..R.R',
      '..RRR',
    ];
    const { routes } = plan(rows, [station(0, -2)]);
    expect(routes).toHaveLength(1);
    const route = routes[0];
    expect(route.loop).toBe(true);
    // vijftien tegels spoor, en de kruising komt er twee keer in voor
    expect(route.tiles).toHaveLength(16);
    expect(route.tiles.filter(tile => tile === at(2, 2))).toHaveLength(2);
    // op de kruising is het spoor recht (geen bocht)
    for (const leg of route.legs) if (leg.tile === at(2, 2)) expect(leg.turn).toBe(0);
  });

  it('twee lijnen die elkaar kruisen zijn één spoor met één trein', () => {
    const rows = [
      '...R...',
      '...R...',
      '...R...',
      'RRRRRRR',
      '...R...',
      '...R...',
      '...R...',
    ];
    const { routes, served } = plan(rows, [station(0, 4), station(4, 0)]);
    expect(routes).toHaveLength(1);
    expect(served.filter(r => r === 0)).toHaveLength(1);
    expect(routes[0].tiles).toHaveLength(7);
  });

  it('een hek dwars over het spoor maakt er twee sporen van, elk met een eigen trein; hooguit drie treinen', () => {
    const two = plan(['RRRRRRRRRRRRRR'], [station(1, 1), station(10, 1)], ['16,10>17,10']);
    expect(two.routes).toHaveLength(2);
    expect(two.served).toEqual([0, 1]);
    const gap = ['.......', '.......', '.......'];
    const rows = ['RRRRRRR', ...gap, 'RRRRRRR', ...gap, 'RRRRRRR', ...gap, 'RRRRRRR'];
    const many = plan(rows, [station(1, 1), station(1, 5), station(1, 9), station(1, 13)]);
    expect(many.routes).toHaveLength(TRAIN.most);
    expect(many.served.filter(r => r >= 0)).toHaveLength(TRAIN.most);
  });

  it('dezelfde route blijft dezelfde als er ergens anders spoor bij komt', () => {
    const before = plan(LOOP, [station(1, -2)]).routes[0];
    const after = plan([...LOOP, '......', '......', 'RRRRRR'], [station(1, -2)]).routes[0];
    expect(after.tiles).toEqual(before.tiles);
    expect(after.stops).toEqual(before.stops);
  });
});

describe('spoor: de trein volgt de rails', () => {
  it('de route loopt vloeiend door: geen sprongen, ronde bochten, en een rondje sluit', () => {
    for (const route of [plan(LOOP, [station(1, -2)]).routes[0], plan(['RRRRR.', '....R.', '....RR', '.....R', '.....R', '.....R'], [station(0, 1)]).routes[0]]) {
      let prev = point(route, 0);
      for (let d = 0.02; d <= route.length; d += 0.02) {
        const p = point(route, d);
        expect(Math.hypot(p[0] - prev[0], p[1] - prev[1])).toBeLessThan(0.021);
        expect(Math.hypot(p[2], p[3])).toBeCloseTo(1);
        // de richting draait nooit met een ruk
        expect(p[2] * prev[2] + p[3] * prev[3]).toBeGreaterThan(0.99);
        prev = p;
      }
      if (!route.loop) continue;
      const start = point(route, 0), end = point(route, route.length - 1e-9);
      expect(Math.hypot(end[0] - start[0], end[1] - start[1])).toBeLessThan(1e-6);
      expect(point(route, route.length + 2.5)).toEqual(point(route, 2.5));
    }
  });

  it('de rails liggen op het midden van de tegel en gaan door het midden van de rand', () => {
    const route = plan(LOOP, [station(1, -2)]).routes[0];
    for (const leg of route.legs) {
      const a = point(route, leg.at + 1e-9), tx = (leg.tile % W) + 0.5, ty = Math.floor(leg.tile / W) + 0.5;
      // het begin van elk stuk: midden op een rand van zijn tegel
      expect(Math.abs(a[0] - tx) + Math.abs(a[1] - ty)).toBeCloseTo(0.5);
      const mid = point(route, leg.at + leg.len / 2);
      expect(Math.hypot(mid[0] - tx, mid[1] - ty)).toBeLessThan(0.21);
    }
  });

  it('op een lijn begint en eindigt de route vlak voor het stootblok', () => {
    const route = plan(['RRRRRRRR'], [station(3, 1)]).routes[0];
    expect(point(route, 0).slice(0, 2)).toEqual([10 + 1 - RAIL_END, 10.5]);
    expect(point(route, route.length)[0]).toBeCloseTo(17 + RAIL_END);
    // verder dan het eind gaat hij niet
    expect(point(route, route.length + 3)).toEqual(point(route, route.length));
    expect(point(route, -3)).toEqual(point(route, 0));
  });

  it('de plek op de route bij een punt in het park', () => {
    const route = plan(['RRRRRRRR'], [station(3, 1)]).routes[0];
    expect(railNear(route, 13.5, 10.5)).toBeCloseTo(RAIL_END + 2.5);
    expect(railNear(route, 13.5, 12.5)).toBe(-1);
  });
});

describe('spoor: haltes en overwegen', () => {
  it('de trein stopt met zijn wagons voor de halte', () => {
    const route = plan(['RRRRRR', 'R....R', 'R....R', 'RRRRRR'], [station(3, 4)]).routes[0];
    const p = point(route, route.stops[0].at);
    // de halte staat onder de tegels (3,3) en (4,3): daartussen is 14 breed, op de rij van 13,5
    expect(p[0]).toBeCloseTo(14);
    expect(p[1]).toBeCloseTo(13.5);
  });

  it('ook op een rondje met overwegen staat de trein bij elke halte vrij van de overweg', () => {
    const route = plan(LOOP, [station(1, -2), station(3, 4)]).routes[0];
    for (const stop of route.stops)
      for (const leg of route.legs) {
        if (!leg.cross) continue;
        // het stuk van de trein [stop - back, stop + front] raakt het stuk van de overweg niet (ook niet over het begin heen)
        const from = (((leg.at - (stop.at - route.back)) % route.length) + route.length) % route.length;
        expect(from).toBeGreaterThan(route.back + route.front);
        expect(from + leg.len).toBeLessThan(route.length);
      }
  });

  it('bij een halte blijft de trein van de overweg af', () => {
    // de halte staat vlak naast de overweg op (2,0): de stopplek schuift op tot de hele trein ervan af is
    const route = plan(['RRXRRRRRRRRRRRRR'], [station(2, 1)]).routes[0];
    const stop = route.stops[0].at;
    const cross = route.legs.find(leg => leg.cross)!;
    expect(stop - route.back).toBeGreaterThan(cross.at + cross.len);
    // zonder overweg stopt hij gewoon midden voor de halte
    const plain = plan(['RRRRRRRRRRRRRRRR'], [station(2, 1)]).routes[0];
    expect(plain.stops[0].at).toBeLessThan(stop);
  });

  it('twee haltes aan weerskanten van hetzelfde stuk spoor delen één stop', () => {
    const route = plan(['RRRRRRRRRR'], [station(4, 1), station(4, -2)]).routes[0];
    expect(route.stops).toHaveLength(1);
    expect(route.stops[0].stations).toEqual([0, 1]);
  });

  it('de trein eist het spoor onder zich en een stuk voor zijn neus op', () => {
    const route = plan(['RRXRRRRRRRRRRRRR'], [station(10, 1)]).routes[0];
    const shut = new Uint8Array(W * H), marked: number[] = [];
    // stil bij tegel 9: alleen wat onder de trein ligt
    railClaim(route, 9, route.front, route.back, shut, marked);
    expect(marked).toContain(at(9, 0));
    expect(marked).not.toContain(at(2, 0));
    expect(marked.every(tile => shut[tile] === 1)).toBe(true);
    // rijdend naar links: ook de tegels voor zijn neus, tot en met de overweg
    for (const tile of marked) shut[tile] = 0;
    marked.length = 0;
    railClaim(route, 7.5, route.front, route.back + TRAIN.warn, shut, marked);
    expect(marked).toContain(at(2, 0));
    expect(marked).not.toContain(at(0, 0));
    expect(new Set(marked).size).toBe(marked.length);
  });

  it('op een rondje loopt het opgeëiste stuk door over het begin van de route', () => {
    const route = plan(LOOP, [station(1, -2)]).routes[0];
    const shut = new Uint8Array(W * H), marked: number[] = [];
    railClaim(route, route.length - 0.5, 2, 1, shut, marked);
    expect(marked).toContain(route.tiles[0]);
    expect(marked).toContain(route.tiles[route.tiles.length - 1]);
    expect(marked.length).toBeLessThan(route.tiles.length);
  });
});

describe('spoor: rijden, stoppen en keren', () => {
  it('de volgende halte op een rondje; met één halte is dat een heel rondje verder', () => {
    const two = plan(LOOP, [station(1, -2), station(3, 4)]).routes[0];
    const [a, b] = two.stops;
    expect(railNext(two, a.at, 1, 0, 0)).toEqual({ stop: 1, dist: b.at - a.at });
    expect(railNext(two, b.at, 1, 0, 0).stop).toBe(0);
    expect(railNext(two, b.at, 1, 0, 0).dist).toBeCloseTo(two.length - (b.at - a.at));
    // achteruit het rondje rond kan ook (na een verbouwing rijdt de trein door in de richting waarin hij reed)
    expect(railNext(two, b.at, -1, 0, 0)).toEqual({ stop: 0, dist: b.at - a.at });
    const one = plan(LOOP, [station(1, -2)]).routes[0];
    expect(railNext(one, one.stops[0].at, 1, 0, 0)).toEqual({ stop: 0, dist: one.length });
    expect(railNext(one, one.stops[0].at + 1, 1, 0, 0).dist).toBeCloseTo(one.length - 1);
  });

  it('op een lijn: naar de volgende halte, en daarna naar het eind van de lijn', () => {
    const route = plan(['RRRRRRRRRRRRRRRR'], [station(2, 1), station(11, 1)]).routes[0];
    const lo = route.back, hi = route.length - route.front, [a, b] = route.stops;
    expect(railNext(route, a.at, 1, lo, hi)).toEqual({ stop: 1, dist: b.at - a.at });
    expect(railNext(route, b.at, 1, lo, hi)).toEqual({ stop: -1, dist: hi - b.at });
    expect(railNext(route, b.at, -1, lo, hi)).toEqual({ stop: 0, dist: b.at - a.at });
    expect(railNext(route, a.at, -1, lo, hi)).toEqual({ stop: -1, dist: a.at - lo });
  });

  it('de trein trekt rustig op, rijdt nooit te hard en staat precies op zijn plek stil', () => {
    let v = 0, left = 9, t = 0, fastest = 0;
    const dt = 1 / 60;
    while (left > 1e-4 && t < 60) {
      const was = v;
      v = railSpeed(v, left, dt);
      // nooit harder optrekken of remmen dan TRAIN.accel (met een klein beetje speling aan het eind)
      expect(Math.abs(v - was)).toBeLessThanOrEqual(TRAIN.accel * dt + 0.031);
      left -= Math.min(left, v * dt);
      fastest = Math.max(fastest, v);
      t += dt;
    }
    expect(left).toBeLessThanOrEqual(1e-4);
    expect(fastest).toBeCloseTo(TRAIN.speed);
    // negen tegels: optrekken, rijden en afremmen kost een tel of acht
    expect(t).toBeGreaterThan(6);
    expect(t).toBeLessThan(10);
  });

  it('op een kort spoor rijdt een kortere trein', () => {
    expect(trainWagons(2, true)).toBe(0);
    expect(trainWagons(Math.PI, true)).toBe(1);
    expect(trainWagons(8 + Math.PI, true)).toBe(TRAIN.wagons);
    expect(trainWagons(3.4, false)).toBe(0);
    expect(trainWagons(4.4, false)).toBe(1);
    expect(trainWagons(30, false)).toBe(TRAIN.wagons);
    // meer wagons naarmate het spoor langer is
    for (let len = 3; len < 20; len += 0.5) expect(trainWagons(len + 0.5, true)).toBeGreaterThanOrEqual(trainWagons(len, true));
  });
});
