// De kabelbaan: twee huisjes met hoog boven het park een kabel waar stoeltjes aan hangen. De kabel mag alle kanten
// op, en met tussenpalen die je zelf neerzet maakt hij bochten en komt hij zo ver als je wilt. Vanaf een eindhuisje
// kun je verder bouwen: dat wordt dan een tussenstation met een nieuw stuk kabel.
// Hier staan alleen de vaste getallen en de rekensommen; het beeld staat in view.ts, de ritjes in people.ts.

/**
 * `min` en `max`: zoveel tegels ligt een stuk kabel tussen twee huisjes minstens en hooguit (`max` geldt voor elk
 * stuk, ook van en naar een tussenpaal). `r`: de straal van het grote wiel in het huisje; de heenweg en de terugweg
 * liggen zo ver links en rechts van het midden, en om een wiel van die maat gaat de kabel ook bij een tussenpaal de
 * bocht om. `low`: zo hoog loopt de kabel in het huisje, `high`: zo hoog boven het park. `ramp`: over zoveel tegels
 * gaat hij omhoog. `hang`: zo ver hangt het stoeltje onder de kabel. `speed`: tegels per tel. `poleGap`: hooguit zo
 * ver tussen twee palen. `price`: munten per ritje. `back`: zo'n deel van de gasten blijft zitten en rijdt weer terug.
 * `span`: zo ver staan twee tussenpalen minstens uit elkaar. `near`: zo ver staat een tussenpaal minstens van een
 * huisje (de kabel moet eerst omhoog). `bend`: zoveel graden mag de kabel hooguit draaien bij een tussenpaal of een
 * tussenstation. `chairs`: meer stoeltjes dan dit hangen er nooit aan één kabel. `pylon`: munten voor een tussenpaal.
 */
export const CABLE = {
  min: 5, max: 14, r: 0.34, low: 1.05, high: 2.9, ramp: 2.2, hang: 0.62, speed: 0.75, poleGap: 3.5, price: 2, back: 0.3,
  span: 2, near: 4, bend: 100, chairs: 24, pylon: 3,
};

/** Een punt in het park, in tegels: [x, y]. */
export type P2 = [number, number];

/** De twee vakjes van een huisje waar een maatje in kan staan. */
export type CableSlot = 'link' | 'link2';

/**
 * Een huisje van de kabelbaan: de linkerbovenhoek, en waar zijn maatjes staan (ten opzichte van hemzelf). Een
 * tussenstation heeft er twee: `link` en `link2`. `via` en `via2`: de tussenpalen van de kabel naar dat maatje (de
 * tegel van elke paal ten opzichte van dit huisje, op volgorde vanaf dit huisje). Eén van de twee huisjes bewaart
 * ze. Staat er nog geen maatje, dan zijn het de palen van het stuk dat nog in aanbouw is.
 */
export interface CableEnd {
  x: number;
  y: number;
  link?: [number, number];
  link2?: [number, number];
  via?: [number, number][];
  via2?: [number, number][];
}

/** Een speling voor het rekenen met kommagetallen. */
const EPS = 1e-6;
const dist = (a: P2, b: P2): number => Math.hypot(b[0] - a[0], b[1] - a[1]);
/** In welk lijstje de tussenpalen van een vakje staan. */
const viaOf = (slot: CableSlot): 'via' | 'via2' => (slot === 'link' ? 'via' : 'via2');

/** Het midden van een huisje (2 bij 2 tegels) of van een tussenpaal (midden op zijn tegel). */
export const cableSpot = (at: { x: number; y: number }, pylon = false): P2 => (pylon ? [at.x + 0.5, at.y + 0.5] : [at.x + 1, at.y + 1]);

/** Hoeveel graden de kabel draait in punt `b`, op weg van `a` naar `c`: 0 is rechtdoor, 180 is terug. */
export function cableTurn(a: P2, b: P2, c: P2): number {
  const ux = b[0] - a[0], uy = b[1] - a[1], vx = c[0] - b[0], vy = c[1] - b[1];
  return (Math.abs(Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy)) * 180) / Math.PI;
}

/** Past het volgende punt aan de kabel? 'near': te dichtbij, 'far': te ver weg, 'bend': de bocht is te scherp. */
export type CableFit = 'ok' | 'near' | 'far' | 'bend';

/**
 * Past punt `next` achter de punten die er al zijn? `pts` begint bij een huisje, daarna de tussenpalen tot nu toe.
 * `house`: het nieuwe punt is een huisje (anders een tussenpaal). `before`: wordt het eerste huisje een
 * tussenstation, dan is dit het punt ervoor op de kabel die er al hangt: daar mag de nieuwe niet over terug.
 */
export function cableFit(pts: P2[], next: P2, house: boolean, before?: P2): CableFit {
  const last = pts[pts.length - 1], first = pts.length === 1, d = dist(last, next);
  const least = first && house ? CABLE.min : first || house ? CABLE.near : CABLE.span;
  if (d < least - EPS) return 'near';
  if (d > CABLE.max + EPS) return 'far';
  const prev = first ? before : pts[pts.length - 2];
  return prev && cableTurn(prev, last, next) > CABLE.bend + EPS ? 'bend' : 'ok';
}

/**
 * Klopt deze hele kabel? `open`: hij is nog in aanbouw, het laatste punt is een tussenpaal. `before` en `after`:
 * het punt voor het eerste en na het laatste huisje, als dat een tussenstation is (zie cableFit).
 */
export function cableValid(pts: P2[], open = false, before?: P2, after?: P2): boolean {
  const n = pts.length - 1;
  for (let i = 1; i <= n; i++) if (cableFit(pts.slice(0, i), pts[i], !open && i === n, before) !== 'ok') return false;
  return open || n < 1 || !after || cableTurn(pts[n - 1], pts[n], after) <= CABLE.bend + EPS;
}

/** Over zoveel tegels gaat de kabel omhoog, vlak buiten het huisje. Bij een korte kabel wat minder. */
const rampOf = (len: number): number => Math.max(0.5, Math.min(CABLE.ramp, len / 2 - 1));

/** Hoe hoog de kabel hangt op `far` tegels (langs de kabel) van het dichtstbijzijnde huisje. */
function heightAt(far: number, ramp: number): number {
  const u = Math.min(1, Math.max(0, far - 1) / ramp);
  return CABLE.low + (CABLE.high - CABLE.low) * u * u * (3 - 2 * u);
}

/**
 * Hoe hoog de kabel hangt op `t` tegels van het eerste huisje (bij een kabel van `len` tegels). In de huisjes loopt
 * hij laag langs het wiel, zodat je kunt instappen; daarbuiten gaat hij rustig omhoog en blijft hij hoog.
 */
export const cableHeight = (t: number, len: number): number => heightAt(Math.min(t, len - t), rampOf(len));

/** Hoe lang de hele lus is: heen, om het wiel, terug en om het andere wiel. */
export const cableLoop = (len: number): number => 2 * len + 2 * Math.PI * CABLE.r;

/**
 * Hoeveel stoeltjes er aan de kabel hangen: 4 bij een korte, 8 bij de langste kabel zonder tussenpalen, en bij een
 * nog langere steeds meer, tot `CABLE.chairs` (daarna hangen ze verder uit elkaar: zo blijft het tekenen licht).
 */
export function cableChairs(len: number): number {
  const loop = cableLoop(len);
  return Math.max(4, Math.min(CABLE.chairs, Math.round(loop / 3.2), Math.max(8, Math.round(loop / 3.75))));
}

/**
 * Een stukje van de lus: recht (`r` is 0: van (x, y) in richting (dx, dy)) of een boog om het punt (x, y) met straal
 * `r`, vanaf hoek `a0` over `sweep` radialen. `at`: waar het stukje begint langs de lus, `len`: hoe lang het is.
 */
export interface CablePiece {
  at: number;
  len: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
  r: number;
  a0: number;
  sweep: number;
}

/**
 * Een tussenpaal van de speler: waar hij staat, hoeveel de kabel er draait (in radialen, 0 = rechtdoor) en naar
 * welke kant de binnenbocht ligt (`ax`, `ay`: lengte 1). Om het wiel op de paal zelf gaat de kabel van de
 * buitenbocht; (`wx`, `wy`) is het midden van het tweede wiel, waar de kabel van de binnenbocht omheen gaat.
 */
export interface CableMast {
  x: number;
  y: number;
  bend: number;
  ax: number;
  ay: number;
  wx: number;
  wy: number;
}

/**
 * De hele kabel, uitgerekend: `pts` zijn de punten (huisje, tussenpalen, huisje), `len` de lengte (de helft van de
 * twee kabels samen; bij een rechte kabel de afstand tussen de huisjes), `loop` de lengte van de hele lus, `out` en
 * `back` de lengte van de heenweg en de terugweg, `ramp` over hoeveel tegels hij omhoog gaat en `masts` de
 * tussenpalen. Zie cablePath.
 */
export interface CablePath {
  pts: P2[];
  len: number;
  loop: number;
  out: number;
  back: number;
  ramp: number;
  masts: CableMast[];
  pieces: CablePiece[];
}

/**
 * Legt één kant van de kabel langs de punten: `CABLE.r` links van de lijn, recht tussen de punten en bij elke
 * tussenpaal met een boog om een wiel van straal `CABLE.r`. De stukjes komen achteraan in `pieces`.
 */
function addLane(pts: P2[], pieces: CablePiece[]): void {
  const r = CABLE.r, n = pts.length - 1;
  let at = pieces.length ? pieces[pieces.length - 1].at + pieces[pieces.length - 1].len : 0;
  const push = (p: Omit<CablePiece, 'at'>): void => {
    if (p.len < 1e-9) return;
    pieces.push({ ...p, at });
    at += p.len;
  };
  // waar dit stuk begint: naast het huisje, of waar de boog om de vorige paal ophield
  let sx = 0, sy = 0;
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[i + 1], l = dist(a, b), dx = (b[0] - a[0]) / l, dy = (b[1] - a[1]) / l;
    if (i === 0) [sx, sy] = [a[0] - dy * r, a[1] + dx * r];
    // de bocht bij het volgende punt (bij het laatste huisje is er geen)
    let turn = 0, ex = dx, ey = dy;
    if (i < n - 1) {
      const c = pts[i + 2], l2 = dist(b, c);
      [ex, ey] = [(c[0] - b[0]) / l2, (c[1] - b[1]) / l2];
      turn = Math.atan2(dx * ey - dy * ex, dx * ex + dy * ey);
    }
    // zo ver voor het punt begint de boog: in de binnenbocht eerder, in de buitenbocht precies naast de paal
    const k = Math.abs(turn) < 1e-4 ? 0 : Math.tan(turn / 2), early = r * (k + Math.abs(k));
    const qx = b[0] - dy * r - dx * early, qy = b[1] + dx * r - dy * early;
    push({ len: Math.max(0, (qx - sx) * dx + (qy - sy) * dy), x: sx, y: sy, dx, dy, r: 0, a0: 0, sweep: 0 });
    [sx, sy] = [qx, qy];
    if (!k) continue;
    // de boog: het wiel ligt aan de kant waar de kabel heen draait
    const side = turn > 0 ? 1 : -1, ox = qx - dy * r * side, oy = qy + dx * r * side;
    push({ len: r * Math.abs(turn), x: ox, y: oy, dx: 0, dy: 0, r, a0: Math.atan2(dy, dx) - (side * Math.PI) / 2, sweep: turn });
    [sx, sy] = [b[0] - ey * r + ex * early, b[1] + ex * r + ey * early];
  }
}

/** Een halve slag om het grote wiel in een huisje (`c`), aan het eind van een kabel die aankomt in richting (dx, dy). */
function addWheel(c: P2, dx: number, dy: number, pieces: CablePiece[]): void {
  const last = pieces[pieces.length - 1];
  pieces.push({ at: last.at + last.len, len: Math.PI * CABLE.r, x: c[0], y: c[1], dx: 0, dy: 0, r: CABLE.r, a0: Math.atan2(dy, dx) + Math.PI / 2, sweep: -Math.PI });
}

/**
 * Rekent de kabel langs deze punten uit: het eerste en het laatste punt zijn het midden van een huisje, daartussen
 * staan de tussenpalen. De lus loopt heen aan de ene kant van de lijn, om het wiel in het tweede huisje, terug aan de
 * andere kant en om het wiel in het eerste huisje. Bij een tussenpaal gaat elke kant met een boog om een eigen wiel.
 */
export function cablePath(pts: P2[]): CablePath {
  const n = pts.length - 1, pieces: CablePiece[] = [], masts: CableMast[] = [];
  const dir = (i: number): P2 => {
    const l = dist(pts[i], pts[i + 1]);
    return [(pts[i + 1][0] - pts[i][0]) / l, (pts[i + 1][1] - pts[i][1]) / l];
  };
  let total = 0;
  for (let i = 0; i < n; i++) total += dist(pts[i], pts[i + 1]);
  addLane(pts, pieces);
  const out = pieces[pieces.length - 1].at + pieces[pieces.length - 1].len;
  addWheel(pts[n], ...dir(n - 1), pieces);
  addLane([...pts].reverse(), pieces);
  const [hx, hy] = dir(0);
  addWheel(pts[0], -hx, -hy, pieces);
  const loop = pieces[pieces.length - 1].at + pieces[pieces.length - 1].len, half = Math.PI * CABLE.r;
  for (let i = 1; i < n; i++) {
    const [ux, uy] = dir(i - 1), [vx, vy] = dir(i), bend = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
    // de kant van de binnenbocht: het midden tussen de twee dwarsrichtingen (bij rechtdoor gewoon dwars op de kabel)
    const side = bend < 0 ? -1 : 1, mx = -(uy + vy) * side, my = (ux + vx) * side, m = Math.hypot(mx, my) || 1;
    const reach = (2 * CABLE.r) / Math.cos(bend / 2);
    masts.push({ x: pts[i][0], y: pts[i][1], bend, ax: mx / m, ay: my / m, wx: pts[i][0] + (mx / m) * reach, wy: pts[i][1] + (my / m) * reach });
  }
  return { pts, len: (loop - 2 * half) / 2, loop, out, back: loop - 2 * half - out, ramp: rampOf(total), masts, pieces };
}

/**
 * Waar een stoeltje is: de plek in het park (`gx`, `gy`), de hoogte van de kabel (`h`), de richting waarin het
 * rijdt (`mx`, `my`: lengte 1) en of het een bocht om gaat (`turn`: 0 = rechtuit, 1 of -1 = de kant van de bocht).
 */
export interface CableSeat {
  gx: number;
  gy: number;
  h: number;
  mx: number;
  my: number;
  turn: number;
}

/**
 * Waar een stoeltje is op afstand `s` langs de lus, geteld vanaf het eerste huisje in de richting van het tweede.
 * Met `into` komt het antwoord in dat ding te staan (dan wordt er niets nieuws gemaakt).
 */
export function cableAt(path: CablePath, s: number, into?: CableSeat): CableSeat {
  const seat = into ?? { gx: 0, gy: 0, h: 0, mx: 0, my: 0, turn: 0 };
  const L = path.loop, u = ((s % L) + L) % L, pieces = path.pieces;
  // het stukje van de lus waar dit punt op ligt
  let lo = 0, hi = pieces.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (pieces[mid].at <= u) lo = mid;
    else hi = mid - 1;
  }
  const p = pieces[lo], t = Math.min(p.len, u - p.at);
  if (p.r) {
    const a = p.a0 + (p.sweep * t) / p.len, side = p.sweep < 0 ? -1 : 1;
    seat.gx = p.x + p.r * Math.cos(a);
    seat.gy = p.y + p.r * Math.sin(a);
    seat.mx = -side * Math.sin(a);
    seat.my = side * Math.cos(a);
    seat.turn = side;
  } else {
    seat.gx = p.x + p.dx * t;
    seat.gy = p.y + p.dy * t;
    seat.mx = p.dx;
    seat.my = p.dy;
    seat.turn = 0;
  }
  // de hoogte: laag om de wielen in de huisjes, en verder naar hoe ver het dichtstbijzijnde huisje is
  const half = Math.PI * CABLE.r, v = u - path.out - half;
  const far = u < path.out ? Math.min(u, path.out - u) : v > 0 && v < path.back ? Math.min(v, path.back - v) : 0;
  seat.h = heightAt(far, path.ramp);
  return seat;
}

/** Waar op de lus de stoeltjes bij een huisje langs het wiel gaan: daar stap je uit en in (0 = het eerste huisje). */
export const cableStop = (path: CablePath, end: 0 | 1): number => (end ? path.out + (Math.PI * CABLE.r) / 2 : path.loop - (Math.PI * CABLE.r) / 2);

/** Ging een stoeltje van `from` naar `to` (vooruit langs de lus van lengte `L`) langs punt `p`? */
export function cablePassed(from: number, to: number, p: number, L: number): boolean {
  const f = ((from % L) + L) % L, t = ((to % L) + L) % L;
  return f <= t ? f < p && p <= t : p > f || p <= t;
}

/** Een paal die vanzelf onder een lang stuk kabel staat: de plek, de hoogte van de kabel en de richting van de dwarsbalk. */
export interface CablePole {
  gx: number;
  gy: number;
  h: number;
  ax: number;
  ay: number;
}

/**
 * Waar de palen vanzelf komen te staan, per stuk kabel: bij een huisje waar de kabel boven is, en daartussen zo
 * veel dat er hooguit `poleGap` tussen twee steunpunten zit (een tussenpaal is zelf ook een steunpunt). Bij een
 * korte kabel tussen twee huisjes staat er één paal in het midden.
 */
export function cablePoles(path: CablePath): CablePole[] {
  const pts = path.pts, n = pts.length - 1, up = 1 + path.ramp, poles: CablePole[] = [];
  let total = 0, done = 0;
  for (let i = 0; i < n; i++) total += dist(pts[i], pts[i + 1]);
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[i + 1], l = dist(a, b), dx = (b[0] - a[0]) / l, dy = (b[1] - a[1]) / l;
    const first = i === 0 ? up : 0, last = i === n - 1 ? l - up : l, spots: number[] = [];
    if (n === 1 && last - first < 2) spots.push(l / 2);
    else if (last - first >= 1.5) {
      const k = Math.ceil((last - first) / CABLE.poleGap);
      // (waar een tussenpaal staat, hoeft geen paal)
      for (let j = i > 0 ? 1 : 0; j <= (i < n - 1 ? k - 1 : k); j++) spots.push(first + ((last - first) * j) / k);
    }
    for (const t of spots) poles.push({ gx: a[0] + dx * t, gy: a[1] + dy * t, h: heightAt(Math.min(done + t, total - done - t), path.ramp), ax: -dy, ay: dx });
    done += l;
  }
  return poles;
}

/** In welk vakje van `a` staat `b` als maatje (of in geen van beide)? */
function slotTo(a: CableEnd, b: CableEnd): CableSlot | undefined {
  return (['link', 'link2'] as const).find(s => !!a[s] && a.x + a[s]![0] === b.x && a.y + a[s]![1] === b.y);
}

/** De tussenpalen van huisje `e` in dit lijstje, als punten in het park. */
const viaPoints = (e: CableEnd, key: 'via' | 'via2'): P2[] => (e[key] ?? []).map(([dx, dy]): P2 => [e.x + dx + 0.5, e.y + dy + 0.5]);

/**
 * De punten van de kabel tussen twee huisjes die naar elkaar wijzen: het midden van `a`, de tussenpalen op volgorde
 * en het midden van `b`. De palen staan bij een van de twee huisjes bewaard.
 */
export function cableRoute(a: CableEnd, b: CableEnd): P2[] {
  const sa = slotTo(a, b), sb = slotTo(b, a);
  const mine = sa ? viaPoints(a, viaOf(sa)) : [], theirs = sb ? viaPoints(b, viaOf(sb)).reverse() : [];
  return [cableSpot(a), ...(mine.length ? mine : theirs), cableSpot(b)];
}

/** De paren huisjes die samen een kabelbaan zijn: ze wijzen naar elkaar en de kabel ertussen klopt. */
export function cablePairs<T extends CableEnd>(ends: T[]): [T, T][] {
  const out: [T, T][] = [];
  ends.forEach((a, i) => {
    for (let j = i + 1; j < ends.length; j++) if (slotTo(a, ends[j]) && slotTo(ends[j], a) && cableValid(cableRoute(a, ends[j]))) out.push([a, ends[j]]);
  });
  return out;
}

/**
 * In welk vakje van `e` komt een nieuw maatje: het vakje dat niet bij een werkende kabelbaan hoort. Zijn ze allebei
 * vrij, dan het vakje waar al tussenpalen voor klaarstaan, en anders `link`.
 */
export function cableSlot<T extends CableEnd>(e: T, ends: T[]): CableSlot {
  const partners = cablePairs(ends).filter(p => p.includes(e)).map(([p, q]) => (p === e ? q : p));
  const busy = (slot: CableSlot): boolean => partners.some(o => slotTo(e, o) === slot);
  if (busy('link')) return 'link2';
  if (busy('link2')) return 'link';
  return e.via2?.length && !e.via?.length ? 'link2' : 'link';
}

/**
 * Een stuk kabelbaan waar je aan verder bouwt: vanaf welk huisje, in welk vakje het nieuwe maatje komt, de punten
 * tot nu toe (het huisje en de tussenpalen die er al staan) en, als dat huisje al een kabel heeft, het punt
 * daarvoor (zie cableFit).
 */
export interface CableDraft<T> {
  from: T;
  slot: CableSlot;
  pts: P2[];
  before?: P2;
}

/**
 * Waar hoort een nieuw huisje (of een nieuwe tussenpaal, met `pylon`) op tegel `at` bij? Eerst het huisje dat nog op
 * zijn maatje wacht (het laatst gebouwde), dan een eindhuisje waar al tussenpalen voor een volgend stuk staan. Wacht
 * er niets, dan mag de kabelbaan verder vanaf het dichtstbijzijnde eindhuisje (dat maar één maatje heeft) waar het
 * nieuwe punt achter past, niet terug over de kabel die er al hangt: dat eindhuisje wordt dan een tussenstation.
 * Anders null: een huisje begint dan een nieuwe kabelbaan.
 */
export function cableOpen<T extends CableEnd>(ends: T[], at?: { x: number; y: number }, pylon = false): CableDraft<T> | null {
  const pairs = cablePairs(ends);
  const mine = (e: T): [T, T][] => pairs.filter(p => p.includes(e));
  const draft = (e: T): CableDraft<T> => {
    const slot = cableSlot(e, ends), own = mine(e);
    let before: P2 | undefined;
    if (own.length === 1) {
      const route = cableRoute(...own[0]);
      before = own[0][0] === e ? route[1] : route[route.length - 2];
    }
    return { from: e, slot, pts: [cableSpot(e), ...viaPoints(e, viaOf(slot))], before };
  };
  for (let i = ends.length - 1; i >= 0; i--) if (!mine(ends[i]).length) return draft(ends[i]);
  for (let i = ends.length - 1; i >= 0; i--) if (mine(ends[i]).length === 1 && draft(ends[i]).pts.length > 1) return draft(ends[i]);
  if (!at) return null;
  const next = cableSpot(at, pylon);
  let best: CableDraft<T> | null = null;
  for (const e of ends) {
    if (mine(e).length !== 1) continue;
    const d = draft(e);
    if (cableFit(d.pts, next, !pylon, d.before) !== 'ok') continue;
    if (!best || dist(d.pts[0], next) < dist(best.pts[0], next)) best = d;
  }
  return best;
}

/**
 * De stukken die nog in aanbouw zijn: per stuk het huisje en de tussenpalen die er al staan. Dat zijn alle lijstjes
 * met palen die niet bij een werkende kabelbaan horen.
 */
export function cableDrafts<T extends CableEnd>(ends: T[]): P2[][] {
  const pairs = cablePairs(ends), out: P2[][] = [];
  for (const e of ends)
    for (const slot of ['link', 'link2'] as const) {
      const pts = viaPoints(e, viaOf(slot));
      const built = pairs.some(([p, q]) => (p === e || q === e) && slotTo(e, p === e ? q : p) === slot);
      if (pts.length && !built) out.push([cableSpot(e), ...pts]);
    }
  return out;
}

/**
 * Huisje `gone` gaat weg: zijn kabels verdwijnen, met hun tussenpalen. Bij de maatjes die blijven staan worden het
 * vakje en de palen van die kabel gewist. Geeft terug hoeveel tussenpalen er verdwijnen. `ends`: alle huisjes, ook
 * het huisje dat weggaat.
 */
export function cableCut<T extends CableEnd>(ends: T[], gone: T): number {
  let n = (gone.via?.length ?? 0) + (gone.via2?.length ?? 0);
  for (const [p, q] of cablePairs(ends)) {
    if (p !== gone && q !== gone) continue;
    const other = p === gone ? q : p, slot = slotTo(other, gone)!;
    n += other[viaOf(slot)]?.length ?? 0;
    delete other[viaOf(slot)];
    delete other[slot];
  }
  return n;
}

/**
 * Staat punt `p` (gezien vanaf het midden van een huisje) vrij van de stoeltjes? `dirs`: de richtingen waarin de
 * kabels het huisje verlaten (lengte 1). `room`: zo ver moet het punt minstens naast het midden van de kabel liggen.
 * Achter het huisje (waar de stoeltjes om het wiel draaien) is alles buiten het wiel vrij.
 */
export function cableClear(p: P2, dirs: P2[], room: number): boolean {
  return dirs.every(([dx, dy]) => p[0] * dx + p[1] * dy <= 0 || Math.abs(p[0] * dy - p[1] * dx) >= room - EPS);
}

/** De vier hoeken van het perron, als richting: linksachter, rechtsachter, linksvoor, rechtsvoor (gezien op de kaart). */
export const CABLE_CORNERS: P2[] = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
/**
 * Het perron: zo ver uit het midden staat een hoekpaal (`post`) en wacht een gast (`wait`), zo ver moet een paal en
 * een gast naast het midden van de kabel blijven (`postRoom`, `waitRoom`), en verder dan `edge` uit het midden is
 * het perron op. Is een hoek niet vrij, dan wacht er iemand langs de rand: op `rim` uit het midden, op een van de
 * plekken `along`, en minstens `apart` van wie er al staat.
 */
export const CABLE_DECK = { post: 0.8, wait: 0.6, postRoom: 0.7, waitRoom: 0.6, edge: 0.7, rim: 0.68, along: [0.28, 0.42, 0.56], apart: 0.32 };

/** Welke van de vier hoekpalen van het huisje kunnen blijven staan: een paal waar de stoeltjes langs moeten, gaat weg. */
export function cablePosts(dirs: P2[]): boolean[] {
  return CABLE_CORNERS.map(([sx, sy]) => cableClear([sx * CABLE_DECK.post, sy * CABLE_DECK.post], dirs, CABLE_DECK.postRoom));
}

/**
 * Waar de vier wachtende gasten op het perron staan (gezien vanaf het midden van het huisje): elk in een hoek, een
 * stukje opzij als daar een stoeltje langs komt. Een hoek waar de kabel doorheen gaat blijft leeg; wie daar zou
 * staan, wacht dan langs de rand, zo ver mogelijk van de anderen.
 */
export function cableWait(dirs: P2[]): P2[] {
  const { wait, waitRoom, edge, rim, along, apart } = CABLE_DECK;
  const out: P2[] = [];
  for (const [sx, sy] of CABLE_CORNERS) {
    const at: P2 = [sx * wait, sy * wait];
    for (const [dx, dy] of dirs) {
      if (at[0] * dx + at[1] * dy <= 0) continue;
      // te dicht naast de kabel: opzij, tot de stoeltjes er net langs kunnen
      const side = at[0] * dy - at[1] * dx, short = waitRoom - Math.abs(side), k = side < 0 ? -1 : 1;
      if (short <= EPS) continue;
      at[0] += dy * k * short;
      at[1] -= dx * k * short;
    }
    if (Math.max(Math.abs(at[0]), Math.abs(at[1])) <= edge + EPS && cableClear(at, dirs, waitRoom)) out.push(at);
  }
  if (out.length === 4) return out;
  const more: P2[] = [];
  for (const [sx, sy] of CABLE_CORNERS) for (const t of along) more.push([sx * rim, sy * t], [sx * t, sy * rim]);
  const clear = more.filter(p => cableClear(p, dirs, waitRoom));
  while (out.length < 4) {
    let best: P2 | null = null, bestD = 0;
    for (const p of clear) {
      // het dichtstbijzijnde hoofd telt; bij gelijk spel de plek die van iedereen het verst af is
      let near = 9, sum = 0;
      for (const q of out) {
        near = Math.min(near, dist(p, q));
        sum += dist(p, q);
      }
      if (near >= apart - EPS && near + sum / 100 > bestD) [best, bestD] = [p, near + sum / 100];
    }
    if (!best) break;
    out.push(best);
  }
  // (er is altijd plek voor vier; mocht het toch niet lukken, dan staan er twee op dezelfde plek)
  for (let i = 0; out.length < 4; i++) out.push(out.length ? out[i] : [CABLE_CORNERS[i][0] * wait, CABLE_CORNERS[i][1] * wait]);
  return out;
}
