// Het spoor van het treintje. Rails leg je met de knop Grond; tegels met spoor die met een kant tegen elkaar liggen
// (zonder hek ertussen) horen bij elkaar. Hier staat alleen het rekenwerk: welke stukken spoor er op een tegel
// liggen, over welke route de trein rijdt, waar hij stopt en welk stuk spoor hij voor zich opeist (daar gaan de
// spoorbomen dicht). Het beeld staat in view.ts, de trein zelf in people.ts.
import { CROSSING, TRAIN, isRail } from './data';
import { H, W, tileIndex } from './grid';

/** Wat het spoor van het raster moet weten: de grond, en of je van een tegel een stap opzij kunt (geen hek, binnen het park). */
export interface RailGround {
  terrain: ArrayLike<number>;
  canStep(x: number, y: number, dx: number, dy: number): boolean;
}

/** De vier kanten van een tegel: 0 = noord, 1 = oost, 2 = zuid, 3 = west. In een masker is elke kant een bit: 1 << kant. */
export const SIDE_DX = [0, 1, 0, -1], SIDE_DY = [-1, 0, 1, 0];
/** In het masker van een tegel: hier ligt spoor, ook als het nergens aan vastzit. */
export const RAIL_HERE = 16;
/** Zo ver loopt het spoor een tegel in waar het ophoudt (daarachter staat het stootblok), en zo lang is een bocht. */
export const RAIL_END = 0.7;
const BEND = Math.PI / 4;
/** Zoveel stappen mag het zoeken naar de beste route in één spoor kosten: bij een grote kluwen is het dan de beste tot dan toe. */
const SEARCH_STEPS = 60000;
/** Zo ver houdt de trein de tegels voor en achter zich nog bezet, en zo ver van een overweg blijft hij weg als hij bij een halte staat. */
const MARGIN = 0.15;

/**
 * Per tegel aan welke kanten het spoor doorloopt: een bit per kant, en RAIL_HERE als er spoor ligt. Spoor en overweg
 * tellen allebei; een hek op de rand tussen twee tegels breekt de verbinding.
 */
export function railLinks(grid: RailGround): Uint8Array {
  const links = new Uint8Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = tileIndex(x, y);
      if (!isRail(grid.terrain[i])) continue;
      let mask = RAIL_HERE;
      for (let s = 0; s < 4; s++) {
        const nx = x + SIDE_DX[s], ny = y + SIDE_DY[s];
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        if (isRail(grid.terrain[tileIndex(nx, ny)]) && grid.canStep(x, y, SIDE_DX[s], SIDE_DY[s])) mask |= 1 << s;
      }
      links[i] = mask;
    }
  return links;
}

/**
 * Een stuk spoor op een tegel. `turn`: zoveel kwartslagen is het gedraaid (met de klok mee, van boven gezien).
 * 'straight' loopt van noord naar zuid; 'curve' van noord naar oost; 'end' komt van het noorden en houdt midden op
 * de tegel op bij een stootblok; 'stub' is een los stukje van west naar oost met aan beide kanten een stootblok.
 */
export interface RailPiece {
  kind: 'straight' | 'curve' | 'end' | 'stub';
  turn: number;
}

/**
 * De stukken spoor op een tegel waar het spoor aan deze kanten doorloopt (`mask`, een bit per kant). Twee kanten:
 * recht of een bocht. Drie: een wissel (rechtdoor en twee bochten naar de zijtak). Vier: een kruising, twee rechte
 * stukken over elkaar (afslaan kan daar niet). Eén kant: een eindje met een stootblok.
 */
export function railPieces(mask: number): RailPiece[] {
  const sides = [0, 1, 2, 3].filter(s => mask & (1 << s));
  if (!sides.length) return [{ kind: 'stub', turn: 0 }];
  if (sides.length === 1) return [{ kind: 'end', turn: sides[0] }];
  if (sides.length === 4) return [{ kind: 'straight', turn: 0 }, { kind: 'straight', turn: 1 }];
  if (sides.length === 2) {
    const [a, b] = sides;
    if (b - a === 2) return [{ kind: 'straight', turn: a }];
    // twee kanten naast elkaar: de bocht begint bij de eerste van de twee (met de klok mee)
    return [{ kind: 'curve', turn: b - a === 1 ? a : b }];
  }
  // drie kanten: `none` ontbreekt; rechtdoor loopt het langs de twee kanten ernaast, de zijtak zit ertegenover
  const none = [0, 1, 2, 3].find(s => !(mask & (1 << s)))!;
  return [{ kind: 'straight', turn: (none + 1) % 2 }, { kind: 'curve', turn: (none + 1) % 4 }, { kind: 'curve', turn: (none + 2) % 4 }];
}

/** Een halte zoals het spoor hem ziet: het blok tegels waar hij op staat. */
export interface RailStation {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Het stuk spoor dat de trein op één tegel van zijn route aflegt. */
export interface RailLeg {
  tile: number;
  /** Waar dit stuk begint (de afstand vanaf het begin van de route) en hoe lang het is. */
  at: number;
  len: number;
  /** Ligt hier een overweg? */
  cross: boolean;
  /** Recht (`turn` 0): het begint in (x, y) en gaat richting (ux, uy). Een bocht: hij draait om (x, y), vanaf hoek `a`, de kant `turn` op (1 of -1). */
  x: number;
  y: number;
  ux: number;
  uy: number;
  a: number;
  turn: number;
  /** Zoveel van het stuk is aan het begin overgeslagen: een route kan midden op een tegel beginnen. */
  skip: number;
}

/** Waar de trein stopt: op afstand `at` langs de route staat het midden van de wagons voor deze haltes (nummers in de lijst van haltes). */
export interface RailStop {
  at: number;
  stations: number[];
}

/**
 * De route van één trein: de tegels achter elkaar. Een rondje (`loop`) rijdt hij steeds rond; een lijn rijdt hij
 * heen en weer. `wagons`: zoveel wagons passen er hier; `front` en `back`: zo ver steekt de trein voor en achter het
 * midden van de wagons uit.
 */
export interface RailRoute {
  tiles: number[];
  loop: boolean;
  length: number;
  legs: RailLeg[];
  stops: RailStop[];
  wagons: number;
  front: number;
  back: number;
}

/** Alle routes in het park, en per halte over welke route de trein er stopt (-1: daar komt geen trein). */
export interface RailPlan {
  routes: RailRoute[];
  served: number[];
}

/** Zo ver steekt een trein met zoveel wagons uit vanaf het midden van zijn wagons, aan de kant met een locomotief (`loco`) of zonder. */
const reach = (wagons: number, loco: boolean): number => ((wagons + (loco ? 1 : -1)) / 2) * TRAIN.gap + TRAIN.half;

/**
 * Hoeveel wagons er op een route van deze lengte passen (0: het spoor is te kort voor een trein). Op een lijn heeft
 * de trein aan beide kanten een locomotief, zodat hij terug kan rijden: die is dus langer. De trein vult hooguit de
 * helft van het spoor, behalve op een heel klein baantje: daar rijdt de locomotief met één wagon.
 */
export function trainWagons(length: number, loop: boolean): number {
  const long = (wagons: number): number => reach(wagons, true) + reach(wagons, !loop);
  for (let wagons = TRAIN.wagons; wagons >= 1; wagons--) if (length >= long(wagons) * (loop ? 2 : 1.8)) return wagons;
  return length >= long(1) + (loop ? 1 : 1.5) ? 1 : 0;
}

/** De kant van tegel `a` waar buurtegel `b` tegenaan ligt. */
const sideTo = (a: number, b: number): number => (b === a - W ? 0 : b === a + 1 ? 1 : b === a + W ? 2 : 3);
const stepTo = (tile: number, side: number): number => tile + SIDE_DX[side] + SIDE_DY[side] * W;
/**
 * Voor het zoeken is elke tegel één knoop, behalve een kruising: die is er twee (noord-zuid en oost-west), want
 * afslaan kan daar niet. Zo kan een acht over zijn eigen kruising heen. Een knoop is tegel * 2, of + 1 voor oost-west.
 */
const nodeAt = (links: Uint8Array, tile: number, side: number): number => tile * 2 + ((links[tile] & 15) === 15 ? side & 1 : 0);
/** De kanten waar het spoor van deze knoop verdergaat (een bit per kant). */
const sidesOf = (links: Uint8Array, node: number): number => {
  const mask = links[node >> 1] & 15;
  return mask === 15 ? (node & 1 ? 10 : 5) : mask;
};

/**
 * De beste route door één spoor (`tiles`): de route langs de meeste haltes; bij gelijk spel liever een rondje (tenzij
 * een lijn ruim twee keer zo lang is), en anders de langste. Bij een wissel kiest de trein dus steeds dezelfde kant en
 * laat hij de zijtak liggen. Geeft de knopen achter elkaar.
 */
function bestRoute(links: Uint8Array, tiles: number[], beside: Map<number, number[]>, stations: number): { nodes: number[]; loop: boolean } {
  const mark = new Uint8Array(W * H * 2), seen = new Uint8Array(W * H * 2), count = new Uint16Array(stations);
  const path: number[] = [];
  let best: number[] = [], bestLoop = false, bestScore = -1, budget = SEARCH_STEPS, served = 0;
  const consider = (loop: boolean): void => {
    const score = served * 1e6 + path.length * (loop ? 2 : 1);
    if (score <= bestScore) return;
    bestScore = score;
    best = path.slice();
    bestLoop = loop;
  };
  const visit = (node: number, start: number): void => {
    budget--;
    mark[node] = seen[node] = 1;
    path.push(node);
    const at = beside.get(node >> 1);
    if (at) for (const k of at) if (count[k]++ === 0) served++;
    const sides = sidesOf(links, node);
    let more = false;
    for (let s = 0; s < 4; s++) {
      if (!(sides & (1 << s))) continue;
      const next = nodeAt(links, stepTo(node >> 1, s), (s + 2) & 3);
      // terug bij het begin: een rondje (op een raster heeft dat minstens vier tegels)
      if (next === start && path.length >= 4) consider(true);
      if (mark[next] || budget <= 0) continue;
      more = true;
      visit(next, start);
    }
    if (!more) consider(false);
    if (at) for (const k of at) if (--count[k] === 0) served--;
    path.pop();
    mark[node] = 0;
  };
  const nodes: number[] = [];
  for (const tile of tiles) {
    nodes.push(tile * 2);
    if ((links[tile] & 15) === 15) nodes.push(tile * 2 + 1);
  }
  const ways = (node: number): number => {
    const sides = sidesOf(links, node);
    return (sides & 1) + ((sides >> 1) & 1) + ((sides >> 2) & 1) + ((sides >> 3) & 1);
  };
  // de langste route begint bij een eind of bij een wissel; een rondje zonder wissel begint waar dan ook
  for (const node of nodes) if (ways(node) !== 2 && budget > 0) visit(node, node);
  for (const node of nodes) if (!seen[node] && budget > 0) visit(node, node);
  return { nodes: canonical(best, bestLoop), loop: bestLoop };
}

/**
 * Dezelfde route altijd op dezelfde manier opgeschreven: een rondje begint bij zijn laagste tegel en een lijn bij
 * zijn laagste eind. Zo blijft een trein gewoon doorrijden als er ergens anders in het park iets verandert.
 */
function canonical(nodes: number[], loop: boolean): number[] {
  if (nodes.length < 2) return nodes;
  if (!loop) return nodes[0] <= nodes[nodes.length - 1] ? nodes : [...nodes].reverse();
  const first = nodes.indexOf(Math.min(...nodes));
  const turned = [...nodes.slice(first), ...nodes.slice(0, first)];
  return turned[1] <= turned[turned.length - 1] ? turned : [turned[0], ...turned.slice(1).reverse()];
}

/** Het stuk spoor op een tegel van kant `from` naar kant `to`: recht door of een bocht om de hoek tussen die kanten. */
function legOf(tile: number, from: number, to: number, cross: boolean): RailLeg {
  const cx = (tile % W) + 0.5, cy = Math.floor(tile / W) + 0.5;
  const leg: RailLeg = { tile, at: 0, len: 1, cross, x: cx + 0.5 * SIDE_DX[from], y: cy + 0.5 * SIDE_DY[from], ux: SIDE_DX[to], uy: SIDE_DY[to], a: 0, turn: 0, skip: 0 };
  if ((from + 2) % 4 === to) return leg;
  leg.x = cx + 0.5 * (SIDE_DX[from] + SIDE_DX[to]);
  leg.y = cy + 0.5 * (SIDE_DY[from] + SIDE_DY[to]);
  leg.a = Math.atan2(-SIDE_DY[to], -SIDE_DX[to]);
  leg.turn = Math.sign(SIDE_DX[to] * SIDE_DY[from] - SIDE_DY[to] * SIDE_DX[from]);
  leg.len = BEND;
  return leg;
}

/** De stukken spoor van een route, tegel voor tegel, met bij elk stuk waar het begint. */
function legsOf(links: Uint8Array, terrain: ArrayLike<number>, nodes: number[], loop: boolean): RailLeg[] {
  const n = nodes.length, legs: RailLeg[] = [];
  // waar een lijn ophoudt op een tegel die nog verder loopt (bij een wissel): die kant op, tot het midden van de tegel
  const onward = (node: number, not: number): number => {
    const sides = sidesOf(links, node), straight = (not + 2) % 4;
    if (sides & (1 << straight)) return straight;
    return [0, 1, 2, 3].find(s => s !== not && sides & (1 << s)) ?? -1;
  };
  for (let i = 0; i < n; i++) {
    const tile = nodes[i] >> 1, cross = terrain[tile] === CROSSING;
    const from = i > 0 || loop ? sideTo(tile, nodes[(i + n - 1) % n] >> 1) : -1;
    const to = i < n - 1 || loop ? sideTo(tile, nodes[(i + 1) % n] >> 1) : -1;
    let leg: RailLeg;
    if (from >= 0 && to >= 0) leg = legOf(tile, from, to, cross);
    else if (to >= 0) {
      // het begin van een lijn: vanaf het stootblok, of vanaf het midden van de tegel
      const back = onward(nodes[i], to);
      if (back >= 0) {
        leg = legOf(tile, back, to, cross);
        leg.skip = leg.len / 2;
        leg.len /= 2;
      } else {
        leg = legOf(tile, (to + 2) % 4, to, cross);
        leg.skip = 1 - RAIL_END;
        leg.len = RAIL_END;
      }
    } else {
      const on = from >= 0 ? onward(nodes[i], from) : -1;
      leg = legOf(tile, Math.max(0, from), on >= 0 ? on : (Math.max(0, from) + 2) % 4, cross);
      leg.len = on >= 0 ? leg.len / 2 : RAIL_END;
    }
    legs.push(leg);
  }
  let at = 0;
  for (const leg of legs) {
    leg.at = at;
    at += leg.len;
  }
  return legs;
}

/** Het nummer van het stuk van de route waar afstand `d` in valt. */
function legAt(route: RailRoute, d: number): number {
  const legs = route.legs;
  let lo = 0, hi = legs.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (legs[mid].at <= d) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/**
 * Waar de route op afstand `d` vanaf het begin is: schrijft [x, y, richting x, richting y] in `out` (in tegels; de
 * richting is één lang). Een rondje loopt door; op een lijn blijft het bij het begin of het eind.
 */
export function railAt(route: RailRoute, d: number, out: number[]): void {
  const L = route.length;
  d = route.loop ? ((d % L) + L) % L : Math.max(0, Math.min(L, d));
  const leg = route.legs[legAt(route, d)], s = leg.skip + Math.min(leg.len, d - leg.at);
  if (!leg.turn) {
    out[0] = leg.x + leg.ux * s;
    out[1] = leg.y + leg.uy * s;
    out[2] = leg.ux;
    out[3] = leg.uy;
    return;
  }
  const angle = leg.a + leg.turn * s * 2;
  out[0] = leg.x + 0.5 * Math.cos(angle);
  out[1] = leg.y + 0.5 * Math.sin(angle);
  out[2] = -leg.turn * Math.sin(angle);
  out[3] = leg.turn * Math.cos(angle);
}

/** De plek op de route het dichtst bij het punt (x, y), als de route over die tegel loopt; anders -1. */
export function railNear(route: RailRoute, x: number, y: number): number {
  const tile = tileIndex(Math.floor(x), Math.floor(y)), p = [0, 0, 0, 0];
  let best = -1, bestD = Infinity;
  for (const leg of route.legs) {
    if (leg.tile !== tile) continue;
    for (let k = 0; k <= 4; k++) {
      const d = leg.at + (leg.len * k) / 4;
      railAt(route, Math.min(d, route.length - 1e-6), p);
      const far = Math.hypot(p[0] - x, p[1] - y);
      if (far < bestD) [best, bestD] = [d, far];
    }
  }
  return best;
}

/** Loopt over de stukken van de route tussen de afstanden `lo` en `hi`; een rondje loopt door over het begin heen. */
function eachLeg(route: RailRoute, lo: number, hi: number, each: (leg: RailLeg) => void): void {
  const L = route.length, legs = route.legs;
  const span = (from: number, to: number): void => {
    for (let i = legAt(route, Math.max(0, from)); i < legs.length && legs[i].at < to; i++) if (legs[i].at + legs[i].len > from) each(legs[i]);
  };
  if (!route.loop) return span(lo, Math.min(hi, L));
  if (hi - lo >= L) return span(0, L);
  const shift = Math.floor(lo / L) * L;
  span(lo - shift, Math.min(hi - shift, L));
  if (hi - shift > L) span(0, hi - shift - L);
}

/**
 * Het stuk spoor dat een trein voor zich opeist. Hij staat met het midden van zijn wagons op `c` en steekt `ahead`
 * tegels verder en `behind` tegels terug (zijn eigen lengte, plus het stuk voor zijn neus als hij rijdt). Elke tegel
 * daarvan krijgt een 1 in `shut` en komt in `marked`: daar steekt nu niemand over, en op een overweg gaan de bomen dicht.
 */
export function railClaim(route: RailRoute, c: number, ahead: number, behind: number, shut: Uint8Array, marked: number[]): void {
  eachLeg(route, c - behind - MARGIN, c + ahead + MARGIN, leg => {
    if (shut[leg.tile]) return;
    shut[leg.tile] = 1;
    marked.push(leg.tile);
  });
}

/** Staat een trein met het midden van zijn wagons op `c` (en zo ver naar voren en naar achteren) op geen enkele overweg? */
function clearAt(route: RailRoute, c: number, ahead: number, behind: number): boolean {
  let clear = true;
  eachLeg(route, c - behind - MARGIN, c + ahead + MARGIN, leg => {
    if (leg.cross) clear = false;
  });
  return clear;
}

/**
 * Hoe hard de trein nu rijdt: hij trekt rustig op tot zijn gewone snelheid en remt zo af dat hij na `dist` tegels
 * precies stilstaat. `v`: hoe hard hij reed.
 */
export const railSpeed = (v: number, dist: number, dt: number): number =>
  Math.min(TRAIN.speed, v + TRAIN.accel * dt, Math.sqrt(2 * TRAIN.accel * Math.max(0, dist)) + 0.03);

/**
 * Waar de trein naartoe rijdt vanaf plek `c` in richting `dir` (1 of -1): de volgende halte (`stop`, het nummer in
 * `stops`) of, op een lijn zonder halte meer in die richting, het eind van de lijn (`stop` -1). `dist`: zo ver is het.
 * Op een lijn mag het midden van de wagons van `lo` tot `hi` komen. Op een rondje met één halte is het een heel rondje.
 */
export function railNext(route: RailRoute, c: number, dir: number, lo: number, hi: number): { stop: number; dist: number } {
  const L = route.length, near = 0.05;
  let stop = -1, dist = Infinity;
  route.stops.forEach((s, i) => {
    let d = (s.at - c) * dir;
    if (route.loop) d = ((d % L) + L) % L;
    // de halte waar hij nu staat telt niet (op een rondje komt hij er een rondje later weer langs)
    if (d <= near || (route.loop && L - d <= near)) d = route.loop ? L : Infinity;
    if (d < dist) [stop, dist] = [i, d];
  });
  if (dist < Infinity) return { stop, dist };
  return { stop: -1, dist: route.loop ? L : Math.max(0, dir > 0 ? hi - c : c - lo) };
}

/**
 * De routes van alle treinen. Elk spoor (alle tegels die aan elkaar vastzitten) met minstens één halte ernaast
 * krijgt één trein, tot `most` treinen: de sporen met de meeste haltes eerst. Een halte hoort bij een spoor als er
 * langs een van zijn vier kanten een tegel van dat spoor ligt (zonder hek ertussen).
 */
export function planRails(grid: RailGround, links: Uint8Array, stations: RailStation[], most = TRAIN.most): RailPlan {
  // per tegel met spoor: de haltes die ernaast staan
  const beside = new Map<number, number[]>();
  stations.forEach((st, k) => {
    const look = (fx: number, fy: number, dx: number, dy: number): void => {
      const x = fx + dx, y = fy + dy;
      if (x < 0 || y < 0 || x >= W || y >= H || !(links[tileIndex(x, y)] & RAIL_HERE) || !grid.canStep(fx, fy, dx, dy)) return;
      const list = beside.get(tileIndex(x, y));
      if (!list) beside.set(tileIndex(x, y), [k]);
      else if (!list.includes(k)) list.push(k);
    };
    for (let i = 0; i < st.w; i++) {
      look(st.x + i, st.y, 0, -1);
      look(st.x + i, st.y + st.h - 1, 0, 1);
    }
    for (let j = 0; j < st.h; j++) {
      look(st.x, st.y + j, -1, 0);
      look(st.x + st.w - 1, st.y + j, 1, 0);
    }
  });
  // de sporen: tegels die aan elkaar vastzitten
  const done = new Uint8Array(W * H), routes: RailRoute[] = [];
  for (let first = 0; first < W * H; first++) {
    if (!(links[first] & RAIL_HERE) || done[first]) continue;
    const tiles = [first];
    done[first] = 1;
    for (let head = 0; head < tiles.length; head++)
      for (let s = 0; s < 4; s++) {
        const next = stepTo(tiles[head], s);
        if (!(links[tiles[head]] & (1 << s)) || done[next]) continue;
        done[next] = 1;
        tiles.push(next);
      }
    if (!tiles.some(tile => beside.has(tile))) continue;
    const found = bestRoute(links, tiles, beside, stations.length);
    const route = routeOf(links, grid.terrain, found.nodes, found.loop, beside);
    if (route) routes.push(route);
  }
  // te veel sporen: die met de meeste haltes krijgen een trein, bij gelijk spel het langste
  const calls = (r: RailRoute): number => r.stops.reduce((n, s) => n + s.stations.length, 0);
  if (routes.length > most) routes.sort((p, q) => calls(q) - calls(p) || q.length - p.length || p.tiles[0] - q.tiles[0]).length = most;
  routes.sort((p, q) => p.tiles[0] - q.tiles[0]);
  const served = stations.map(() => -1);
  routes.forEach((route, r) => {
    for (const stop of route.stops) for (const k of stop.stations) served[k] = r;
  });
  return { routes, served };
}

/** Maakt van een rij knopen een route: de stukken spoor, de trein die erop past en de haltes. Null: het spoor is te kort, of er ligt geen halte langs. */
function routeOf(links: Uint8Array, terrain: ArrayLike<number>, nodes: number[], loop: boolean, beside: Map<number, number[]>): RailRoute | null {
  if (nodes.length < 2) return null;
  const legs = legsOf(links, terrain, nodes, loop);
  const last = legs[legs.length - 1], length = last.at + last.len;
  const wagons = trainWagons(length, loop);
  if (!wagons) return null;
  const route: RailRoute = { tiles: nodes.map(node => node >> 1), loop, length, legs, stops: [], wagons, front: reach(wagons, true), back: reach(wagons, !loop) };
  // per halte: het langste rijtje tegels van de route dat ernaast ligt; midden daarvoor stopt de trein
  const n = legs.length, at = new Map<number, number>();
  const near = (i: number, k: number): boolean => !!beside.get(legs[i].tile)?.includes(k);
  for (const k of new Set(legs.flatMap(leg => beside.get(leg.tile) ?? []))) {
    let best = -1, bestLen = -1, bestN = 0;
    for (let i = 0; i < n; i++) {
      if (!near(i, k) || (i > 0 ? near(i - 1, k) : loop && near(n - 1, k) && !legs.every((_, j) => near(j, k)))) continue;
      let count = 0, len = 0;
      for (let j = i; count < n && (loop || j < n) && near(j % n, k); j++, count++) len += legs[j % n].len;
      if (count > bestN) [best, bestLen, bestN] = [i, len, count];
    }
    if (best < 0) continue;
    let c = legs[best].at + bestLen / 2;
    c = loop ? c % length : Math.max(route.back, Math.min(length - route.front, c));
    at.set(k, clearSpot(route, c));
  }
  // haltes die bijna op dezelfde plek liggen (aan weerskanten van het spoor) delen één stop
  for (const [k, c] of [...at].sort((p, q) => p[1] - q[1] || p[0] - q[0])) {
    const prev = route.stops[route.stops.length - 1];
    if (prev && c - prev.at < 1) prev.stations.push(k);
    else route.stops.push({ at: c, stations: [k] });
  }
  return route.stops.length ? route : null;
}

/**
 * Een trein die bij een halte stilstaat, mag geen overweg dichthouden. Staat hij op plek `c` op een overweg, dan
 * schuift de stopplek een stukje op (hooguit drie tegels), naar de dichtstbijzijnde plek waar hij vrij staat.
 */
function clearSpot(route: RailRoute, c: number): number {
  const fits = (at: number): boolean => route.loop || (at >= route.back - 1e-9 && at <= route.length - route.front + 1e-9);
  if (clearAt(route, c, route.front, route.back)) return c;
  for (let k = 1; k <= 12; k++)
    for (const d of [k * 0.25, -k * 0.25]) {
      const at = route.loop ? (((c + d) % route.length) + route.length) % route.length : c + d;
      if (fits(at) && clearAt(route, at, route.front, route.back)) return at;
    }
  return c;
}
