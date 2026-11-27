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
 * elk hek), 7 = het witte hekje van de kinderboerderij, 8 = het poortje waar gasten door naar binnen gaan,
 * 9 = de safaripoort: een dubbele poort tussen twee verblijven waar alleen de jeep van de safaritrein doorheen kan.
 */
export type EdgeKind = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

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

/**
 * Een plek op de lijnen van het raster waar een paal (lamp, vlag) kan staan: midden op een rand ('h' of 'v', net als
 * bij Edge) of op een hoek van een tegel ('c': de noordwesthoek van tegel (x, y)).
 */
export interface Spot {
  o: 'h' | 'v' | 'c';
  x: number;
  y: number;
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

  /** Ligt deze plek (een hoek of het midden van een rand) op de grond van het park? */
  validSpot(s: Spot): boolean {
    if (s.o !== 'c') return this.validEdge({ o: s.o, x: s.x, y: s.y });
    const { x0, y0, x1, y1 } = this.land;
    return s.x >= x0 && s.x <= x1 && s.y >= y0 && s.y <= y1;
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

  /**
   * De glazen tunnel (zie TUBE in data.ts): het nummer van die grond, en welke grond een pad is. Het spel vult ze in;
   * zonder is er geen tunnel. Een tunnel ligt verzonken in een bak van glas en hoort bij dat verblijf: het water
   * staat erboven. Waar hij tegen het glas van de bak aan komt en daarbuiten een pad (of nog een stuk tunnel) ligt, is
   * de ingang: daar loop je met een trap onder het glas door.
   */
  tube = -1;
  walk: (terrain: number) => boolean = () => false;

  /** Het hek op de rand waar je overheen stapt van tegel (x, y) naar (x + dx, y + dy). */
  private edgeTo(x: number, y: number, dx: number, dy: number): number {
    return dy === -1 ? this.h[x + y * W] : dy === 1 ? this.h[x + (y + 1) * W] : dx === -1 ? this.v[x + y * (W + 1)] : this.v[x + 1 + y * (W + 1)];
  }

  /** Is deze stap de ingang van een tunnel: door het glas van de bak, van een pad de tunnel in (of andersom)? */
  private mouthStep(x: number, y: number, dx: number, dy: number): boolean {
    if (this.tube < 0 || this.edgeTo(x, y, dx, dy) !== 5) return false;
    const a = this.terrain[tileIndex(x, y)], b = this.terrain[tileIndex(x + dx, y + dy)];
    return (a === this.tube || b === this.tube) && (a === this.tube || this.walk(a)) && (b === this.tube || this.walk(b));
  }

  /** Kan de jeep van de safaritrein deze stap zetten? Hij rijdt waar geen hek staat, en door een safaripoort (hekje 9). */
  jeepStep(x: number, y: number, dx: number, dy: number): boolean {
    if (!this.inBounds(x + dx, y + dy)) return false;
    const edge = this.edgeTo(x, y, dx, dy);
    return edge === 0 || edge === 9;
  }

  /** Ligt tussen deze twee tegels (naast elkaar) de ingang van een tunnel? */
  mouthBetween(a: number, b: number): boolean {
    const [ax, ay] = tileXY(a), [bx, by] = tileXY(b);
    return Math.abs(ax - bx) + Math.abs(ay - by) === 1 && this.mouthStep(ax, ay, bx - ax, by - ay);
  }

  /** Is deze rand de ingang van een tunnel? Daar gaat de tunnel onder het glas van de bak door. */
  mouth(e: Edge): boolean {
    const [x, y, dx, dy] = e.o === 'h' ? [e.x, e.y, 0, -1] : [e.x, e.y, -1, 0];
    return this.inBounds(x, y) && this.inBounds(x + dx, y + dy) && this.mouthStep(x, y, dx, dy);
  }

  /** Kun je van tegel (x,y) een stap (dx,dy) zetten zonder door een hek te gaan? */
  /** `gates`: personeel kan door een poort (hekje 2); dieren en gasten niet. */
  canStep(x: number, y: number, dx: number, dy: number, gates = false): boolean {
    if (!this.inBounds(x + dx, y + dy)) return false;
    const edge = this.edgeTo(x, y, dx, dy);
    return edge === 0 || (gates && (edge === 2 || edge === 8)) || (edge === 5 && this.mouthStep(x, y, dx, dy));
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
          // (de ingang van een tunnel telt hier als dicht: het verblijf blijft een verblijf)
          if (!this.inBounds(x + dx, y + dy) || this.edgeTo(x, y, dx, dy) !== 0) continue;
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
   * en anders 1. Poorten tellen niet mee: die passen bij elk hek. Ook een hek tussen twee verblijven telt niet mee:
   * daar heeft elk verblijf zijn eigen kant (een dubbel hek), dus het gaat om het hek aan de buitenkant.
   */
  penKind(region: Region): EdgeKind {
    const inside = new Set(region.tiles);
    let found: EdgeKind = 0, shared: EdgeKind = 0;
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
        if (!out || kind === 2 || kind === 6 || kind === 8 || kind === 9) continue;
        // een hek dat dit verblijf deelt met een ander verblijf telt niet mee: daar staat vanzelf een dubbel hek, aan
        // elke kant het hek van dat verblijf (zie sharedSide en View.syncFences)
        if (this.inBounds(x + dx, y + dy) && this.enclosureAt(x + dx, y + dy)) {
          shared ||= kind as EdgeKind;
          continue;
        }
        if (kind === 1 || (found && found !== kind)) return 1;
        found = kind as EdgeKind;
      }
    }
    // (een verblijf dat helemaal tussen andere verblijven in ligt, heeft geen eigen buitenhek: dan telt wat er staat)
    return found || shared || 1;
  }

  /**
   * Een hek tussen twee verblijven: welk soort hek er aan elke kant staat, [de kant van de tegel erboven of links, de
   * kant van de tegel eronder of rechts]. Een verblijf met een bijzonder hek (steen, net, glas, wit hekje) heeft dat
   * ook aan zijn kant van het gedeelde hek; een verblijf met een gewoon houten hek neemt wat er staat. Zijn de twee
   * kanten verschillend, dan staat er een dubbel hek. Null: dit is geen hek tussen twee verblijven (of het is een
   * poort, venster of safaripoort: die blijven enkel). `kinds`: een kladje om het soort hek per verblijf te onthouden.
   */
  sharedSide(e: Edge, kinds = new Map<number, EdgeKind>()): [EdgeKind, EdgeKind] | null {
    const kind = this.getEdge(e);
    if (kind !== 1 && kind !== 3 && kind !== 4 && kind !== 5 && kind !== 7) return null;
    const of = (x: number, y: number): EdgeKind => {
      const region = this.enclosureAt(x, y);
      if (!region) return 0;
      if (!kinds.has(region.id)) kinds.set(region.id, this.penKind(region));
      return kinds.get(region.id)!;
    };
    const a = e.o === 'h' ? of(e.x, e.y - 1) : of(e.x - 1, e.y), b = of(e.x, e.y);
    if (!a || !b) return null;
    return [a !== 1 ? a : kind, b !== 1 ? b : kind];
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
export function glassSides(grid: Grid, x: number, y: number, w: number, h: number, kinds: readonly number[] = [5, 6]): { side: number; region: Region }[] {
  const out: { side: number; region: Region }[] = [];
  const look = (side: number, e: Edge, tx: number, ty: number): void => {
    const kind = grid.getEdge(e);
    if (!kinds.includes(kind)) return;
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

/** Waar een plek precies ligt, in rastercoördinaten. */
export const spotPos = (s: Spot): [number, number] => (s.o === 'h' ? [s.x + 0.5, s.y] : s.o === 'v' ? [s.x, s.y + 0.5] : [s.x, s.y]);
export const spotKey = (s: Spot): string => `${s.o}${s.x},${s.y}`;

/**
 * De plek voor een paal die het dichtst bij een punt ligt: een van de vier hoeken of het midden van een van de vier
 * randen van de tegel onder dat punt. Null als het punt buiten het raster ligt.
 */
export function nearestSpot(gx: number, gy: number): Spot | null {
  if (gx < -0.4 || gy < -0.4 || gx > W + 0.4 || gy > H + 0.4) return null;
  const tx = Math.max(0, Math.min(W - 1, Math.floor(gx))), ty = Math.max(0, Math.min(H - 1, Math.floor(gy)));
  const options: Spot[] = [
    { o: 'c', x: tx, y: ty }, { o: 'c', x: tx + 1, y: ty }, { o: 'c', x: tx, y: ty + 1 }, { o: 'c', x: tx + 1, y: ty + 1 },
    { o: 'h', x: tx, y: ty }, { o: 'h', x: tx, y: ty + 1 }, { o: 'v', x: tx, y: ty }, { o: 'v', x: tx + 1, y: ty },
  ];
  let best = options[0], bestD = Infinity;
  for (const s of options) {
    const [sx, sy] = spotPos(s), d = Math.hypot(sx - gx, sy - gy);
    if (d < bestD) [best, bestD] = [s, d];
  }
  return best;
}

/** De randen die in een hoek samenkomen: naar het noorden, oosten, zuiden en westen van het hoekpunt (x, y). */
export const cornerEdges = (x: number, y: number): Edge[] => [{ o: 'v', x, y: y - 1 }, { o: 'h', x, y }, { o: 'v', x, y }, { o: 'h', x: x - 1, y }];

/** De vier tegels rond een hoekpunt (ze kunnen buiten het park liggen). */
export const cornerTiles = (x: number, y: number): [number, number][] => [[x - 1, y - 1], [x, y - 1], [x - 1, y], [x, y]];

/** De tegels die aan een plek grenzen: twee bij een rand, vier bij een hoek. */
export const spotTiles = (s: Spot): [number, number][] =>
  s.o === 'c' ? cornerTiles(s.x, s.y) : s.o === 'h' ? [[s.x, s.y - 1], [s.x, s.y]] : [[s.x - 1, s.y], [s.x, s.y]];

/** De randen waar een plek op ligt: de rand zelf, of de vier randen die in de hoek samenkomen. */
export const spotEdges = (s: Spot): Edge[] => (s.o === 'c' ? cornerEdges(s.x, s.y) : [{ o: s.o, x: s.x, y: s.y }]);
