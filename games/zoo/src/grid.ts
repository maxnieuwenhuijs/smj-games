// Het raster: tegels van 1 bij 1, hekken op de randen van tegels.
// Geen Three.js hier, zodat dit los te testen is.
export const W = 28;
export const H = 28;
export const MIN_ENCLOSURE = 4;

/** 0 = niets, 1 = houten hek, 2 = poort, 3 = stenen muur, 4 = hoog net. */
export type EdgeKind = 0 | 1 | 2 | 3 | 4;

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

  constructor() {
    this.recompute();
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && x < W && y >= 0 && y < H;
  }

  validEdge(e: Edge): boolean {
    return e.o === 'h' ? e.x >= 0 && e.x < W && e.y >= 0 && e.y <= H : e.x >= 0 && e.x <= W && e.y >= 0 && e.y < H;
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
  canStep(x: number, y: number, dx: number, dy: number): boolean {
    if (!this.inBounds(x + dx, y + dy)) return false;
    if (dy === -1) return this.h[x + y * W] === 0;
    if (dy === 1) return this.h[x + (y + 1) * W] === 0;
    if (dx === -1) return this.v[x + y * (W + 1)] === 0;
    return this.v[x + 1 + y * (W + 1)] === 0;
  }

  /** Ligt de tegel aan de rand van de kaart zonder hek ertussen? */
  private leaks(x: number, y: number): boolean {
    return (
      (y === 0 && this.h[x] === 0) ||
      (y === H - 1 && this.h[x + H * W] === 0) ||
      (x === 0 && this.v[y * (W + 1)] === 0) ||
      (x === W - 1 && this.v[W + y * (W + 1)] === 0)
    );
  }

  recompute(): void {
    this.regionOf.fill(-1);
    this.regions = [];
    for (let start = 0; start < W * H; start++) {
      if (this.regionOf[start] !== -1) continue;
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
        if (!out || kind === 2) continue;
        if (kind === 1 || (found && found !== kind)) return 1;
        found = kind as EdgeKind;
      }
    }
    return found || 1;
  }

  /** De randen (geen poorten) aan de buitenkant van een verblijf. */
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

  neighbors(i: number): number[] {
    const [x, y] = tileXY(i);
    const out: number[] = [];
    for (const [dx, dy] of DIRS) if (this.canStep(x, y, dx, dy)) out.push(tileIndex(x + dx, y + dy));
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
