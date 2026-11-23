// Het raster: tegels van 1 bij 1, hekken op de randen van tegels.
// Geen Three.js hier, zodat dit los te testen is.
// Het raster is zo groot als het park ooit kan worden. Je begint met het middelste stuk tegen de voorkant
// (BASE_W bij BASE_H); links, rechts en achter ligt een strook van PLOT tegels die je erbij kunt kopen.
export const BASE_W = 28;
export const BASE_H = 28;
export const PLOT = 8;
export const W = BASE_W + 2 * PLOT;
export const H = BASE_H + PLOT;

/** Het stuk van het raster dat van het park is: van (x0, y0) tot (x1, y1), die laatste niet meer. */
export interface Land {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}
export type Side = 'left' | 'right' | 'back';
export const SIDES: Side[] = ['left', 'right', 'back'];
export const BASE_LAND: Land = { x0: PLOT, y0: PLOT, x1: PLOT + BASE_W, y1: H };
export const FULL_LAND: Land = { x0: 0, y0: 0, x1: W, y1: H };
export const MIN_ENCLOSURE = 4;

/**
 * 0 = niets, 1 = houten hek, 2 = poort, 3 = stenen muur, 4 = hoog net, 5 = glas (aquarium), 6 = kijkvenster (past in
 * elk hek), 7 = het witte hekje van de kinderboerderij, 8 = het poortje waar gasten door naar binnen gaan.
 */
export type EdgeKind = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

/** 'h' ligt aan de noordkant van tegel (x,y); 'v' aan de westkant. */
export interface Edge {
  o: 'h' | 'v';
  x: number;
  y: number;
}

export interface Region {
  id: number;
  tiles: number[];
  /** Rondom dicht: je kunt er niet uit lopen. */
  enclosed: boolean;
}

export const tileIndex = (x: number, y: number): number => x + y * W;
export const tileXY = (i: number): [number, number] => [i % W, Math.floor(i / W)];
export const edgeKey = (e: Edge): string => `${e.o}${e.x},${e.y}`;

const DIRS: [number, number][] = [[0, -1], [1, 0], [0, 1], [-1, 0]];

export class Grid {
  terrain = new Uint8Array(W * H);
  h = new Uint8Array(W * (H + 1));
  v = new Uint8Array((W + 1) * H);
  regionOf = new Int16Array(W * H);
  regions: Region[] = [];
  /** De grond van het park. Daarbuiten kun je niets bouwen en loopt er niemand. */
  land: Land;

  constructor(land: Land = BASE_LAND) {
    this.land = { ...land };
    this.recompute();
  }

  /** Ligt de tegel op de grond van het park? */
  inBounds(x: number, y: number): boolean {
    return x >= this.land.x0 && x < this.land.x1 && y >= this.land.y0 && y < this.land.y1;
  }

  /** Heeft het park deze strook er al bij? */
  owns(side: Side): boolean {
    return side === 'left' ? this.land.x0 === 0 : side === 'right' ? this.land.x1 === W : this.land.y0 === 0;
  }

  /** De strook die je aan deze kant kunt kopen (zolang je hem nog niet hebt). */
  plot(side: Side): Land {
    const { x0, y0, x1, y1 } = this.land;
    return side === 'left' ? { x0: x0 - PLOT, y0, x1: x0, y1 } : side === 'right' ? { x0: x1, y0, x1: x1 + PLOT, y1 } : { x0, y0: y0 - PLOT, x1, y1: y0 };
  }

  /** Het park krijgt er aan deze kant een strook bij. Wat er al staat, blijft staan. */
  expand(side: Side): boolean {
    if (this.owns(side)) return false;
    if (side === 'left') this.land.x0 = 0;
    else if (side === 'right') this.land.x1 = W;
    else this.land.y0 = 0;
    this.recompute();
    return true;
  }

  validEdge(e: Edge): boolean {
    const { x0, y0, x1, y1 } = this.land;
    return e.o === 'h' ? e.x >= x0 && e.x < x1 && e.y >= y0 && e.y <= y1 : e.x >= x0 && e.x <= x1 && e.y >= y0 && e.y < y1;
  }

  getEdge(e: Edge): EdgeKind {
    if (!this.validEdge(e)) return 0;
    return (e.o === 'h' ? this.h[e.x + e.y * W] : this.v[e.x + e.y * (W + 1)]) as EdgeKind;
  }

  /** Geeft true als er iets veranderd is. */
  setEdge(e: Edge, kind: EdgeKind): boolean {
    if (!this.validEdge(e) || this.getEdge(e) === kind) return false;
    if (e.o === 'h') this.h[e.x + e.y * W] = kind;
    else this.v[e.x + e.y * (W + 1)] = kind;
    this.recompute();
    return true;
  }

  setTerrain(x: number, y: number, t: number): boolean {
    if (!this.inBounds(x, y) || this.terrain[tileIndex(x, y)] === t) return false;
    this.terrain[tileIndex(x, y)] = t;
    return true;
  }

  /** Kun je van tegel (x,y) een stap (dx,dy) zetten zonder door een hek te gaan? */
  /** `gates`: personeel kan door een poort (hekje 2); dieren en gasten niet. */
  canStep(x: number, y: number, dx: number, dy: number, gates = false): boolean {
    if (!this.inBounds(x + dx, y + dy)) return false;
    const edge = dy === -1 ? this.h[x + y * W] : dy === 1 ? this.h[x + (y + 1) * W] : dx === -1 ? this.v[x + y * (W + 1)] : this.v[x + 1 + y * (W + 1)];
    return edge === 0 || (gates && (edge === 2 || edge === 8));
  }

  /** Ligt de tegel aan de rand van het park zonder hek ertussen? */
  private leaks(x: number, y: number): boolean {
    const { x0, y0, x1, y1 } = this.land;
    return (
      (y === y0 && this.h[x + y * W] === 0) ||
      (y === y1 - 1 && this.h[x + (y + 1) * W] === 0) ||
      (x === x0 && this.v[x + y * (W + 1)] === 0) ||
      (x === x1 - 1 && this.v[x + 1 + y * (W + 1)] === 0)
    );
  }

  recompute(): void {
    this.regionOf.fill(-1);
    this.regions = [];
    for (let start = 0; start < W * H; start++) {
      // alleen de grond van het park doet mee
      if (this.regionOf[start] !== -1 || !this.inBounds(start % W, Math.floor(start / W))) continue;
      const region: Region = { id: this.regions.length, tiles: [], enclosed: true };
      const queue = [start];
      this.regionOf[start] = region.id;
      while (queue.length) {
        const i = queue.pop()!;
        region.tiles.push(i);
        const [x, y] = tileXY(i);
        if (this.leaks(x, y)) region.enclosed = false;
        for (const [dx, dy] of DIRS) {
          if (!this.canStep(x, y, dx, dy)) continue;
          const j = tileIndex(x + dx, y + dy);
          if (this.regionOf[j] === -1) {
            this.regionOf[j] = region.id;
            queue.push(j);
          }
        }
      }
      this.regions.push(region);
    }
  }

  /** Het verblijf waar de tegel in ligt, of null als de tegel niet in een dicht verblijf ligt. */
  enclosureAt(x: number, y: number): Region | null {
    if (!this.inBounds(x, y)) return null;
    const region = this.regions[this.regionOf[tileIndex(x, y)]];
    return region.enclosed && region.tiles.length >= MIN_ENCLOSURE ? region : null;
  }

  enclosures(): Region[] {
    return this.regions.filter(r => r.enclosed && r.tiles.length >= MIN_ENCLOSURE);
  }

  /**
   * Waar is de rand van het verblijf van gemaakt? Geeft 3 als alles steen is, 4 als alles hoog net is
   * en anders 1. Poorten tellen niet mee: die passen bij elk hek.
   */
  penKind(region: Region): EdgeKind {
    const inside = new Set(region.tiles);
    let found: EdgeKind = 0;
    for (const i of region.tiles) {
      const [x, y] = tileXY(i);
      const sides: [number, number, number][] = [
        [0, -1, this.h[x + y * W]],
        [0, 1, this.h[x + (y + 1) * W]],
        [-1, 0, this.v[x + y * (W + 1)]],
        [1, 0, this.v[x + 1 + y * (W + 1)]],
      ];
      for (const [dx, dy, kind] of sides) {
        const out = !this.inBounds(x + dx, y + dy) || !inside.has(tileIndex(x + dx, y + dy));
        // een poort en een kijkvenster passen bij elk soort hek
        if (!out || kind === 2 || kind === 6 || kind === 8) continue;
        if (kind === 1 || (found && found !== kind)) return 1;
        found = kind as EdgeKind;
      }
    }
    return found || 1;
  }

  /** De randen aan de buitenkant van een verblijf (ook de poorten: vraag met getEdge wat er staat). */
  borderEdges(region: Region): Edge[] {
    const inside = new Set(region.tiles);
    const out: Edge[] = [];
    for (const i of region.tiles) {
      const [x, y] = tileXY(i);
      const sides: [number, number, Edge][] = [
        [0, -1, { o: 'h', x, y }],
        [0, 1, { o: 'h', x, y: y + 1 }],
        [-1, 0, { o: 'v', x, y }],
        [1, 0, { o: 'v', x: x + 1, y }],
      ];
      for (const [dx, dy, e] of sides)
        if (!this.inBounds(x + dx, y + dy) || !inside.has(tileIndex(x + dx, y + dy))) out.push(e);
    }
    return out;
  }

  neighbors(i: number, gates = false): number[] {
    const [x, y] = tileXY(i);
    const out: number[] = [];
    for (const [dx, dy] of DIRS) if (this.canStep(x, y, dx, dy, gates)) out.push(tileIndex(x + dx, y + dy));
    return out;
  }

  /** Kortste route over tegels, zonder door hekken te gaan. Inclusief begin en eind. */
  path(from: number, to: number, blocked: (i: number) => boolean = () => false): number[] | null {
    if (from === to) return [from];
    const prev = new Map<number, number>([[from, -1]]);
    const queue = [from];
    for (let head = 0; head < queue.length; head++) {
      const i = queue[head];
      for (const j of this.neighbors(i)) {
        if (prev.has(j) || (j !== to && blocked(j))) continue;
        prev.set(j, i);
        if (j === to) {
          const route = [to];
          for (let k = i; k !== -1; k = prev.get(k)!) route.push(k);
          return route.reverse();
        }
        queue.push(j);
      }
    }
    return null;
  }

  edges(): { e: Edge; kind: EdgeKind }[] {
    const out: { e: Edge; kind: EdgeKind }[] = [];
    for (let y = 0; y <= H; y++)
      for (let x = 0; x < W; x++) if (this.h[x + y * W]) out.push({ e: { o: 'h', x, y }, kind: this.h[x + y * W] as EdgeKind });
    for (let y = 0; y < H; y++)
      for (let x = 0; x <= W; x++)
        if (this.v[x + y * (W + 1)]) out.push({ e: { o: 'v', x, y }, kind: this.v[x + y * (W + 1)] as EdgeKind });
    return out;
  }
}

/**
 * De verblijven die met glas (of een kijkruit) tegen dit blok van `w` bij `h` tegels aan liggen, en aan welke kant
 * van het blok: 0 = zuid, 1 = oost, 2 = noord, 3 = west (zoals de draaiing van een gebouw). Voor de tribune: die
 * staat met haar rug tegen de bak van de dolfijnen.
 */
export function glassSides(grid: Grid, x: number, y: number, w: number, h: number): { side: number; region: Region }[] {
  const out: { side: number; region: Region }[] = [];
  const look = (side: number, e: Edge, tx: number, ty: number): void => {
    const kind = grid.getEdge(e);
    if (kind !== 5 && kind !== 6) return;
    const region = grid.enclosureAt(tx, ty);
    if (region && !out.some(o => o.region === region && o.side === side)) out.push({ side, region });
  };
  for (let i = 0; i < w; i++) {
    look(0, { o: 'h', x: x + i, y: y + h }, x + i, y + h);
    look(2, { o: 'h', x: x + i, y }, x + i, y - 1);
  }
  for (let i = 0; i < h; i++) {
    look(1, { o: 'v', x: x + w, y: y + i }, x + w, y + i);
    look(3, { o: 'v', x, y: y + i }, x - 1, y + i);
  }
  return out;
}

/**
 * De rand in één richting waar een punt langs loopt. Bij slepen kijken we alleen naar randen in de
 * sleeprichting, zodat er op de hoeken geen losse dwarshekjes bijkomen.
 */
export function edgeAlong(gx: number, gy: number, o: 'h' | 'v', maxDist = 0.35): Edge | null {
  if (o === 'h') {
    const y = Math.round(gy), x = Math.floor(gx);
    return Math.abs(gy - y) <= maxDist && x >= 0 && x < W && y >= 0 && y <= H ? { o, x, y } : null;
  }
  const x = Math.round(gx), y = Math.floor(gy);
  return Math.abs(gx - x) <= maxDist && y >= 0 && y < H && x >= 0 && x <= W ? { o, x, y } : null;
}

/** De tegelrand die het dichtst bij een punt ligt (in rastercoördinaten), of null als die te ver weg is. */
export function nearestEdge(gx: number, gy: number, maxDist = 1): Edge | null {
  if (gx < -0.4 || gy < -0.4 || gx > W + 0.4 || gy > H + 0.4) return null;
  const tx = Math.max(0, Math.min(W - 1, Math.floor(gx)));
  const ty = Math.max(0, Math.min(H - 1, Math.floor(gy)));
  const fx = gx - tx;
  const fy = gy - ty;
  const options: [number, Edge][] = [
    [fy, { o: 'h', x: tx, y: ty }],
    [1 - fy, { o: 'h', x: tx, y: ty + 1 }],
    [fx, { o: 'v', x: tx, y: ty }],
    [1 - fx, { o: 'v', x: tx + 1, y: ty }],
  ];
  options.sort((a, b) => a[0] - b[0]);
  return options[0][0] <= maxDist ? options[0][1] : null;
}
