// Attracties en speeltoestellen: de vaste maten (zitjes, stralen, hoogtes, snelheden) en de rekensommen. Voor elk
// toestel staat hier waar zitje `i` op een bepaald moment is, en hoe een heel bezoek van een gast verloopt: lopen,
// wachten, instappen, het ritje, uitstappen en terug naar het pad. Het beeld (view.ts) bouwt en beweegt de modellen
// met deze getallen en de gasten (people.ts) zitten er met dezelfde getallen op: zo zit een gast altijd precies op
// zijn zitje. Geen Three.js en geen DOM in dit bestand.
//
// Alles staat in de maat van het gebouw zelf: het midden van het gebouw is (0, 0), `x` loopt naar rechts, `z` naar
// voren (de voorkant, waar het pad hoort te liggen) en `h` is de hoogte boven de grond, alles in tegels. Een
// kijkrichting van 0 is naar voren (+z), een halve pi naar rechts (+x). Hoe het gebouw in het park gedraaid staat,
// rekent de gebruiker er zelf bij (zie `rideLocal` en `rideWorld`).
import type { ShopKind } from './data';

const TAU = Math.PI * 2;
const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
/** Zacht van 0 naar 1: langzaam beginnen en langzaam eindigen. */
const ease = (v: number): number => {
  const t = clamp01(v);
  return t * t * (3 - 2 * t);
};
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
/** Een hoek teruggebracht tot 0 t/m 2 pi. */
const wrap = (a: number): number => ((a % TAU) + TAU) % TAU;
/** Het kleinste verschil tussen twee hoeken, van -pi tot pi. */
const turnTo = (from: number, to: number): number => Math.atan2(Math.sin(to - from), Math.cos(to - from));
/** Een vast toevalsgetal tussen 0 en 1 bij twee getallen: dezelfde getallen geven altijd hetzelfde. */
const hash = (a: number, b: number): number => {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

// ------------------------------------------------------------ wat een toestel en een gast bijhouden
/** De toestellen en attracties met een eigen bezoek (zie planVisit). De rest koopt aan een toonbank of heeft eigen regels. */
export type RideKind = 'slide' | 'swing' | 'seesaw' | 'springer' | 'trampoline' | 'fountain' | 'tower' | 'carousel' | 'bumper' | 'ferris' | 'restaurant';
/**
 * Voor zoveel tegels is elk toestel gemaakt: [breed (langs de voorkant), diep]. SHOP_SIZE en SHOP_DEEP in data.ts
 * zeggen hetzelfde (rides.test.ts let daarop).
 */
export const RIDE_SPAN: Record<RideKind, [number, number]> = {
  slide: [2, 3], swing: [2, 1], seesaw: [2, 1], springer: [1, 1], trampoline: [2, 2], fountain: [3, 3], tower: [2, 2], carousel: [3, 3], bumper: [4, 3], ferris: [8, 2], restaurant: [3, 2],
};
export const RIDE_KINDS: RideKind[] = ['carousel', 'ferris'];
export const isRide = (kind: ShopKind): kind is RideKind => (RIDE_KINDS as ShopKind[]).includes(kind);

/** Zo snel loopt een gast over een toestel, in tegels per tel: iets vlotter dan op het pad, want hij heeft er zin in. */
export const RIDE_WALK = 1.05;
/** Zo lang duurt gaan zitten of weer opstaan: de stap van naast het zitje erop, of andersom. */
export const SIT_TIME = 0.32;

/** Eén botsauto: waar hij is, waar hij heen kijkt, hoe snel hij gaat en hoe hard hij net gebotst is (1 = net, 0 = niet). */
export interface BumperCar {
  x: number;
  z: number;
  dir: number;
  vx: number;
  vz: number;
  bump: number;
  /** Elke botsing geeft de bestuurder een nieuw doel: dit telt mee in het toeval. */
  turn: number;
}

/**
 * De stand van een toestel op dit moment. Het spel houdt hem elk beeldje bij (rideStep); het beeld en de gasten
 * lezen hem alleen.
 */
export interface RideState {
  /** De klok van het toestel: tellen sinds het er staat. Een bezoek rekent hiermee, niet met een eigen klok. */
  clock: number;
  /** De hoek van wat draait of heen en weer gaat, in radialen. */
  spin: number;
  /** Hoe hard het gaat, van 0 tot 1: zachtjes als er niemand op zit, voluit met gasten. */
  amp: number;
  /** Per zitje (of per bakje van het reuzenrad) hoe hard het gaat: een leeg zitje wiegt alleen wat. */
  amps: number[];
  /** De botsauto's (alleen bij de botsauto's). */
  cars: BumperCar[];
}

/** Wat het lijf van een gast op een toestel doet. Armen, benen en hoofd maakt people.ts erbij. */
export type RideAct = 'walk' | 'stand' | 'sit' | 'climb' | 'slide' | 'jump' | 'drive';

/** Waar een gast is en hoe hij erbij staat of zit, in de maat van het gebouw. */
export interface RidePose {
  x: number;
  /** De hoogte van zijn voeten (staand, lopend, springend) of van de zitting waar hij op zit. */
  h: number;
  z: number;
  /** Kijkrichting: 0 = naar voren (+z), een halve pi = naar rechts (+x). */
  face: number;
  /** Voorover (+) of achterover (-) hellen, en opzij hellen (+ = de +x-kant omhoog), in radialen, gezien vanuit de gast zelf. */
  pitch: number;
  roll: number;
  act: RideAct;
  /** Hoe ver hij zit: 0 = hij staat (dan is `h` de hoogte van zijn voeten), 1 = hij zit (dan is `h` de hoogte van de zitting). */
  sit: number;
  /** Zit of staat hij nu echt op het toestel? (Niet meer onderweg ernaartoe, en nog niet onderweg terug.) */
  on: boolean;
  /** Een getal bij de houding: hoe hoog in de sprong, hoe ver op de glijbaan, hoe hoog in het rad (0 tot 1), of hoe hard de botsing net was. */
  u: number;
  /** Nog een getal: op de trampoline hoe ver de springer op zijn billen landt (0 tot 1). */
  w: number;
  /** Het bezoek is voorbij: de gast staat weer op het pad. */
  done: boolean;
}

export const newPose = (): RidePose => ({ x: 0, h: 0, z: 0, face: 0, pitch: 0, roll: 0, act: 'stand', sit: 0, on: false, u: 0, w: 0, done: false });

/** Zet een houding in `out`; hellen, `on`, `u`, `w` en `done` staan daarna op nul. */
function put(out: RidePose, x: number, h: number, z: number, face: number, act: RideAct): RidePose {
  out.x = x;
  out.h = h;
  out.z = z;
  out.face = face;
  out.act = act;
  out.sit = act === 'sit' || act === 'drive' || act === 'slide' ? 1 : 0;
  out.pitch = out.roll = out.u = out.w = 0;
  out.on = out.done = false;
  return out;
}

/**
 * Eén bezoek van een gast aan een toestel: op welk zitje, waar hij vandaan kwam, en hoe lang elk stuk duurt. De
 * tijden zijn in tellen op de klok van het toestel, vanaf `t0`.
 */
export interface Visit {
  kind: RideKind;
  seat: number;
  /** Waar de gast op het pad stond, in de maat van het gebouw: daar begint en eindigt het bezoek. */
  fx: number;
  fz: number;
  /** De klok van het toestel toen het bezoek begon. */
  t0: number;
  /** Naar zijn plek lopen; daar wachten (op zijn beurt, op het bakje, tot het ritje begint); het ritje zelf; en teruglopen (hooguit zo lang). */
  walk: number;
  wait: number;
  ride: number;
  back: number;
}

/** Zo lang duurt het hele bezoek hooguit; `visitPose` zet `done` zodra de gast weer op het pad staat. */
export const visitTime = (v: Visit): number => v.walk + v.wait + v.ride + v.back;
/** Zo lang is het bezoek al bezig. */
export const visitAge = (v: Visit, s: RideState): number => s.clock - v.t0;

/**
 * Een punt in het park omgerekend naar de maat van het gebouw: `cx`, `cy` is het midden van het gebouw op het
 * raster en `rot` hoeveel kwartslagen het gedraaid staat (0 = voorkant naar het zuiden). Geeft [x, z].
 */
export function rideLocal(gx: number, gy: number, cx: number, cy: number, rot: number): [number, number] {
  const turn = (rot * Math.PI) / 2, cos = Math.cos(turn), sin = Math.sin(turn), dx = gx - cx, dy = gy - cy;
  return [dx * cos - dy * sin, dx * sin + dy * cos];
}

/** En terug: een plek in het gebouw (x, z) als punt op het raster. Geeft [gx, gy]. */
export function rideWorld(x: number, z: number, cx: number, cy: number, rot: number): [number, number] {
  const turn = (rot * Math.PI) / 2, cos = Math.cos(turn), sin = Math.sin(turn);
  return [cx + x * cos + z * sin, cy - x * sin + z * cos];
}

// ------------------------------------------------------------ lopen over een route
// Een route is een rijtje punten (x, h, z). Er is er altijd maar één tegelijk in gebruik: hij wordt opnieuw gevuld
// bij elke vraag, zodat er tijdens het spelen niets nieuws aangemaakt wordt.
const WAY: number[] = [];
let wayN = 0;

function wayFrom(x: number, h: number, z: number): void {
  wayN = 0;
  wayTo(x, h, z);
}

function wayTo(x: number, h: number, z: number): void {
  WAY[wayN * 3] = x;
  WAY[wayN * 3 + 1] = h;
  WAY[wayN * 3 + 2] = z;
  wayN++;
}

/** Een boog om het midden: van hoek `a` naar hoek `b` (de korte kant om) op straal `r` en hoogte `h`, in stukjes. */
function wayArc(a: number, b: number, r: number, h: number): void {
  const d = turnTo(a, b), n = Math.max(1, Math.ceil(Math.abs(d) / 0.5));
  for (let i = 1; i <= n; i++) wayTo(Math.sin(a + (d * i) / n) * r, h, Math.cos(a + (d * i) / n) * r);
}

const stretch = (i: number): number => Math.hypot(WAY[i * 3 + 3] - WAY[i * 3], WAY[i * 3 + 4] - WAY[i * 3 + 1], WAY[i * 3 + 5] - WAY[i * 3 + 2]);

/** Hoe lang de route is, in tegels (hoogteverschil telt mee: een trap op duurt langer). */
function wayLength(): number {
  let len = 0;
  for (let i = 0; i + 1 < wayN; i++) len += stretch(i);
  return len;
}

/**
 * Zet `out` op `d` tegels langs de route, lopend en met het gezicht in de looprichting. Met `back` wordt de route
 * andersom gelopen, vanaf het eind. Geeft true als het eind bereikt is.
 */
function wayAt(out: RidePose, d: number, back = false): boolean {
  let left = Math.max(0, d);
  for (let k = 0; k + 1 < wayN; k++) {
    const i = back ? wayN - 2 - k : k, len = stretch(i);
    if (left > len && k + 2 < wayN) {
      left -= len;
      continue;
    }
    const t = len > 1e-6 ? Math.min(1, left / len) : 1, u = back ? 1 - t : t;
    const dx = (WAY[i * 3 + 3] - WAY[i * 3]) * (back ? -1 : 1), dz = (WAY[i * 3 + 5] - WAY[i * 3 + 2]) * (back ? -1 : 1);
    put(out, lerp(WAY[i * 3], WAY[i * 3 + 3], u), lerp(WAY[i * 3 + 1], WAY[i * 3 + 4], u), lerp(WAY[i * 3 + 2], WAY[i * 3 + 5], u), Math.hypot(dx, dz) > 1e-6 ? Math.atan2(dx, dz) : out.face, 'walk');
    // op een trap: klimmen
    if (Math.abs(WAY[i * 3 + 4] - WAY[i * 3 + 1]) > 0.3 * Math.hypot(dx, dz)) out.act = 'climb';
    return left >= len;
  }
  put(out, WAY[0], WAY[1], WAY[2], out.face, 'stand');
  return true;
}

/**
 * Van naast het zitje erop (of eraf): schuift `out` van de plek ernaast (`sx`, `sh`, `sz`, kijkrichting `sf`) naar
 * de houding die er al in staat (`k` van 0 naar 1), met een hupje halverwege.
 */
function hopOn(out: RidePose, sx: number, sh: number, sz: number, sf: number, k: number): void {
  const t = ease(k);
  out.x = lerp(sx, out.x, t);
  out.z = lerp(sz, out.z, t);
  out.h = lerp(sh, out.h, t) + 0.07 * Math.sin(Math.PI * clamp01(k));
  out.face = sf + turnTo(sf, out.face) * t;
  out.pitch *= t;
  out.roll *= t;
  out.sit *= t;
  out.on = k >= 1;
}

// ------------------------------------------------------------ het reuzenrad (8 bij 2)
/**
 * Het reuzenrad. `hub`: zo hoog zit de as; `radius`: van de as tot de asjes waar de bakjes aan hangen; `cabins`
 * bakjes met elk `per` plekken naast elkaar (`side` uit het midden, `back` naar achteren); `speed`: radialen per
 * tel (een rondje duurt ruim 23 tellen). `seat` en `floor`: zo ver onder zijn asje hangen de zitting en de vloer
 * van een bakje; `sway`: zo ver slingert het hooguit (radialen). Het perron is `deck` hoog en loopt van `deckBack`
 * tot `deckFront`, met `deckX` naar links en naar rechts; ervoor liggen twee treden van elk `step` diep. `stand`:
 * daar (z) wacht je op je bakje. `rimZ`: zo ver liggen de twee velgen uit het midden, `legX` en `legZ`: daar staan
 * de poten.
 */
export const FERRIS = {
  hub: 4.55, radius: 3.4, cabins: 12, per: 2, speed: 0.27, seat: 0.66, floor: 0.86, side: 0.17, back: -0.04, sway: 0.09,
  deck: 0.24, deckX: 1.45, deckBack: -0.62, deckFront: 0.7, step: 0.15, stand: 0.5, rimZ: 0.36, legX: 2.05, legZ: 0.68,
};
const FERRIS_ROUND = TAU / FERRIS.speed;

/** De hoek van bakje `cabin`: 0 = rechts, een halve pi = bovenin, min een halve pi = onderin (bij het perron). */
export const ferrisAngle = (cabin: number, spin: number): number => spin + (cabin * TAU) / FERRIS.cabins;

/** Hoe ver bakje `cabin` nu om zijn asje slingert (radialen): een beetje als het leeg is, meer met gasten erin. */
export const ferrisSway = (cabin: number, s: RideState): number =>
  FERRIS.sway * (0.35 + 0.65 * (s.amps[cabin] ?? 0)) * Math.sin(s.clock * 2.3 + cabin * 2.4);

/** Waar een gast op plek `seat` zit (twee plekken per bakje, naast elkaar met het gezicht naar voren). */
export function ferrisSeat(out: RidePose, seat: number, s: RideState): RidePose {
  const cabin = Math.floor(seat / FERRIS.per) % FERRIS.cabins, side = seat % FERRIS.per ? 1 : -1;
  const a = ferrisAngle(cabin, s.spin), sway = ferrisSway(cabin, s), cos = Math.cos(sway), sin = Math.sin(sway);
  const ox = side * FERRIS.side, oy = -FERRIS.seat;
  put(out, Math.cos(a) * FERRIS.radius + ox * cos - oy * sin, FERRIS.hub + Math.sin(a) * FERRIS.radius + ox * sin + oy * cos, FERRIS.back, 0, 'sit');
  out.roll = sway;
  out.on = true;
  out.u = (Math.sin(a) + 1) / 2;
  return out;
}

/** De route van het pad naar de plek op het perron waar je op je bakje wacht: de treden op en naar je kant. */
function ferrisWay(v: Visit): void {
  const side = v.seat % FERRIS.per ? 1 : -1, x = side * (FERRIS.side + 0.02);
  wayFrom(v.fx, 0, v.fz);
  wayTo(x, 0, FERRIS.deckFront + 2 * FERRIS.step + 0.08);
  wayTo(x, FERRIS.deck, FERRIS.deckFront - 0.04);
  wayTo(x, FERRIS.deck, FERRIS.stand);
}

function ferrisPlan(v: Visit, s: RideState, used: number): boolean {
  // eerst voor de linkerplek: het verschil met de rechter is te klein om toe te doen
  v.seat = 0;
  ferrisWay(v);
  const walk = wayLength() / RIDE_WALK;
  let best = -1, least = Infinity;
  for (let c = 0; c < FERRIS.cabins; c++) {
    const seat = !(used & (1 << (c * 2))) ? c * 2 : !(used & (1 << (c * 2 + 1))) ? c * 2 + 1 : -1;
    if (seat < 0) continue;
    // zo lang duurt het tot dit bakje onderin is; komt het te vroeg, dan pas het rondje erna
    let till = wrap(-Math.PI / 2 - ferrisAngle(c, s.spin)) / FERRIS.speed;
    if (till < walk + 0.4) till += FERRIS_ROUND;
    if (till < least) [best, least] = [seat, till];
  }
  if (best < 0) return false;
  v.seat = best;
  v.walk = walk;
  v.wait = least - walk;
  v.ride = FERRIS_ROUND;
  v.back = walk + 0.4;
  return true;
}

function ferrisPose(out: RidePose, v: Visit, s: RideState, e: number): RidePose {
  const board = v.walk + v.wait, leave = board + v.ride, side = v.seat % FERRIS.per ? 1 : -1, sx = side * (FERRIS.side + 0.02);
  if (e < v.walk) {
    ferrisWay(v);
    wayAt(out, e * RIDE_WALK);
    return out;
  }
  // instappen: het bakje komt langs, de gast stapt erin en draait zich om
  if (e < board - 0.35) return put(out, sx, FERRIS.deck, FERRIS.stand, Math.PI, 'stand');
  if (e < leave - 0.2) {
    ferrisSeat(out, v.seat, s);
    if (e < board + 0.2) hopOn(out, sx, FERRIS.deck, FERRIS.stand, Math.PI, (e - (board - 0.35)) / 0.55);
    return out;
  }
  if (e < leave + 0.35) {
    ferrisSeat(out, v.seat, s);
    hopOn(out, sx, FERRIS.deck, FERRIS.stand, 0, 1 - (e - (leave - 0.2)) / 0.55);
    out.on = false;
    return out;
  }
  ferrisWay(v);
  out.done = wayAt(out, (e - leave - 0.35) * RIDE_WALK, true);
  return out;
}

// ------------------------------------------------------------ de draaimolen (3 bij 3)
/**
 * De draaimolen. De vloer draait: `r` is zijn straal en `deck` zijn hoogte. De paarden staan in ringen (`rings`:
 * straal, aantal en hoeveel de ring verdraaid staat); `aisle`: op die straal loop je tussen de ringen door.
 * `saddle`: de hoogte van het zadel midden in de slag; een paard gaat `bob` op en neer, `bobs` keer per rondje.
 * `speed`: radialen per tel op volle snelheid; zonder gasten draait hij op `idle` daarvan. Een ritje: `stop` tellen
 * stilstaan (uit- en instappen), in `up` tellen op gang komen, `run` tellen draaien en in `down` tellen uitlopen.
 */
export const CAROUSEL = {
  r: 1.36, deck: 0.2, rings: [{ r: 1.05, n: 6, turn: 0 }, { r: 0.52, n: 3, turn: 0.52 }], aisle: 0.79, saddle: 0.8, bob: 0.1, bobs: 3,
  speed: 1.15, idle: 0.3, stop: 5, up: 1.5, run: 8, down: 2,
};
export const CAROUSEL_SEATS = CAROUSEL.rings.reduce((n, ring) => n + ring.n, 0);
const CAROUSEL_CYCLE = CAROUSEL.stop + CAROUSEL.up + CAROUSEL.run + CAROUSEL.down;

/** In welke ring paard `seat` staat en het hoeveelste het daar is: [ring, nummer]. */
function carouselSpot(seat: number): [number, number] {
  let i = seat % CAROUSEL_SEATS;
  for (let k = 0; k < CAROUSEL.rings.length; k++) {
    if (i < CAROUSEL.rings[k].n) return [k, i];
    i -= CAROUSEL.rings[k].n;
  }
  return [0, 0];
}

/** De hoek van paard `seat` om het midden (0 = vooraan, oplopend naar rechts), en zijn straal. */
export function carouselAt(seat: number, spin: number): [number, number] {
  const [k, i] = carouselSpot(seat), ring = CAROUSEL.rings[k];
  return [ring.turn + (i * TAU) / ring.n + spin, ring.r];
}

/** Hoe hoog het zadel van paard `seat` nu is: het gaat op en neer terwijl de molen draait, en staat stil als de molen stilstaat. */
export const carouselLift = (seat: number, spin: number): number => CAROUSEL.saddle + CAROUSEL.bob * Math.sin(CAROUSEL.bobs * spin + seat * 2.1);

/** Waar een gast op paard `seat` zit: schrijlings, met het gezicht in de draairichting. */
export function carouselSeat(out: RidePose, seat: number, s: RideState): RidePose {
  const [a, r] = carouselAt(seat, s.spin);
  put(out, Math.sin(a) * r, carouselLift(seat, s.spin), Math.cos(a) * r, a + Math.PI / 2, 'sit');
  out.on = true;
  // (voor wie zwaait: 1 = vooraan, bij het pad)
  out.u = (Math.cos(a) + 1) / 2;
  return out;
}

/** Hoe hard een ritje nu gaat (0 = staat stil, 1 = volle snelheid), `c` tellen na het begin van de ronde. */
function cycleSpeed(c: number, stop: number, up: number, run: number, down: number): number {
  if (c < stop) return 0;
  if (c < stop + up) return ease((c - stop) / up);
  if (c < stop + up + run) return 1;
  return 1 - ease((c - stop - up - run) / down);
}

/** De route van het pad naar paard `seat`: de vloer op, tussen de ringen door eromheen, en naar het paard. */
function carouselWay(v: Visit, s: RideState): void {
  const from = Math.atan2(v.fx, v.fz), [a, r] = carouselAt(v.seat, s.spin);
  wayFrom(v.fx, 0, v.fz);
  wayTo(Math.sin(from) * (CAROUSEL.r + 0.1), 0, Math.cos(from) * (CAROUSEL.r + 0.1));
  wayTo(Math.sin(from) * (CAROUSEL.r - 0.14), CAROUSEL.deck, Math.cos(from) * (CAROUSEL.r - 0.14));
  wayTo(Math.sin(from) * CAROUSEL.aisle, CAROUSEL.deck, Math.cos(from) * CAROUSEL.aisle);
  wayArc(from, a, CAROUSEL.aisle, CAROUSEL.deck);
  wayTo(Math.sin(a) * r, CAROUSEL.deck, Math.cos(a) * r);
}

function carouselPlan(v: Visit, s: RideState, used: number): boolean {
  const c = s.clock % CAROUSEL_CYCLE;
  if (c >= CAROUSEL.stop) return false;
  // het vrije paard waar je het kortst voor loopt
  let best = -1, least = Infinity;
  for (let seat = 0; seat < CAROUSEL_SEATS; seat++) {
    if (used & (1 << seat)) continue;
    v.seat = seat;
    carouselWay(v, s);
    const len = wayLength();
    if (len < least) [best, least] = [seat, len];
  }
  if (best < 0) return false;
  v.seat = best;
  v.walk = least / RIDE_WALK + SIT_TIME;
  // te laat om nog op tijd te zitten: dan het volgende ritje
  if (c + v.walk + 0.2 > CAROUSEL.stop) return false;
  v.wait = CAROUSEL.stop - c - v.walk;
  v.ride = CAROUSEL.up + CAROUSEL.run + CAROUSEL.down;
  // (de molen staat straks ergens anders stil: reken op het langste eind lopen)
  v.back = SIT_TIME + (Math.hypot(v.fx, v.fz) + 0.6 + Math.PI * CAROUSEL.aisle) / RIDE_WALK;
  return true;
}

function carouselPose(out: RidePose, v: Visit, s: RideState, e: number): RidePose {
  const leave = v.walk + v.wait + v.ride;
  if (e >= v.walk && e < leave) return carouselSeat(out, v.seat, s);
  const [a, r] = carouselAt(v.seat, s.spin);
  if (e < v.walk - SIT_TIME) {
    carouselWay(v, s);
    wayAt(out, e * RIDE_WALK);
    return out;
  }
  if (e < v.walk || e < leave + SIT_TIME) {
    // opstappen of afstappen: van naast het paard in het zadel, of andersom
    carouselSeat(out, v.seat, s);
    hopOn(out, Math.sin(a) * r, CAROUSEL.deck, Math.cos(a) * r, a + Math.PI / 2, e < v.walk ? (e - (v.walk - SIT_TIME)) / SIT_TIME : 1 - (e - leave) / SIT_TIME);
    out.on = false;
    return out;
  }
  carouselWay(v, s);
  out.done = wayAt(out, (e - leave - SIT_TIME) * RIDE_WALK, true);
  return out;
}

// ------------------------------------------------------------ de botsauto's (4 bij 3)
/**
 * De botsauto's. `cars` auto's rijden over een vloer van -`ax` tot `ax` breed en van `z0` (achter) tot `z1` (voor),
 * `floor` hoog. Een auto is voor het botsen een rondje met straal `r`; de bestuurder zit op `seat` hoogte. `speed`:
 * tegels per tel met een gast erin; zonder gasten kruipen ze op `idle` daarvan. Een ritje: `stop` tellen stilstaan
 * (uit- en instappen), `run` tellen rijden en `down` tellen uitrollen. `gate`: daar (z) stap je de vloer op.
 */
export const BUMPER = { cars: 6, ax: 1.74, z0: -1.3, z1: 1.02, floor: 0.06, r: 0.24, seat: 0.21, speed: 1.45, idle: 0.28, stop: 5.5, run: 11, down: 1.5, gate: 1.16 };
const BUMPER_CYCLE = BUMPER.stop + BUMPER.run + BUMPER.down;

/** De auto's zoals ze er de eerste keer bij staan: in een rij tegen de achterwand. */
export const newCars = (): BumperCar[] =>
  Array.from({ length: BUMPER.cars }, (_, i) => ({ x: ((i + 0.5) / BUMPER.cars - 0.5) * 2 * (BUMPER.ax - 0.3), z: BUMPER.z0 + BUMPER.r + 0.06, dir: 0, vx: 0, vz: 0, bump: 0, turn: 0 }));

/**
 * De auto's een stukje verder. `power`: 1 = er staat stroom op, 0 = ze rollen uit. `drivers`: in welke auto's een
 * gast zit (een bit per auto): alleen die rijden echt. Zit er nergens iemand in, dan kruipen ze allemaal rustig rond.
 * Een auto stuurt naar een doel dat om de paar tellen verspringt (soms een andere auto, om tegenaan te botsen);
 * tegen de rand en tegen elkaar stuiteren ze terug, en `bump` springt dan op 1.
 */
export function stepCars(cars: BumperCar[], dt: number, clock: number, power: number, drivers: number): void {
  const idle = drivers === 0, top = BUMPER.speed * (idle ? BUMPER.idle : 1), xr = BUMPER.ax - BUMPER.r, zr0 = BUMPER.z0 + BUMPER.r, zr1 = BUMPER.z1 - BUMPER.r;
  for (let i = 0; i < cars.length; i++) {
    const car = cars[i], driven = power > 0 && (idle || (drivers >> i) & 1);
    if (driven) {
      // een nieuw doel om de paar tellen, en meteen na een botsing
      const slot = Math.floor(clock / (1.5 + (i % 3) * 0.4) + i * 0.37) + car.turn * 7, pick = hash(i + 1, slot);
      let tx = (hash(slot, i + 11) * 2 - 1) * xr, tz = lerp(zr0, zr1, hash(slot, i + 23));
      if (pick > 0.55 && !idle) {
        const other = cars[(i + 1 + Math.floor(pick * 97) % (cars.length - 1)) % cars.length];
        tx = other.x;
        tz = other.z;
      }
      const want = Math.atan2(tx - car.x, tz - car.z);
      car.dir += Math.max(-3.4 * dt, Math.min(3.4 * dt, turnTo(car.dir, want)));
      const pull = Math.min(1, dt * 2.6);
      car.vx += (Math.sin(car.dir) * top - car.vx) * pull;
      car.vz += (Math.cos(car.dir) * top - car.vz) * pull;
    } else {
      const slow = Math.exp(-dt * (power > 0 ? 1.2 : 3));
      car.vx *= slow;
      car.vz *= slow;
    }
    car.x += car.vx * dt;
    car.z += car.vz * dt;
    car.bump = Math.max(0, car.bump - dt * 2.2);
    // de rand: terugstuiteren
    if (car.x > xr || car.x < -xr) {
      const hit = Math.abs(car.vx);
      car.x = Math.max(-xr, Math.min(xr, car.x));
      car.vx *= -0.55;
      if (hit > 0.45) [car.bump, car.turn] = [1, car.turn + 1];
    }
    if (car.z > zr1 || car.z < zr0) {
      const hit = Math.abs(car.vz);
      car.z = Math.max(zr0, Math.min(zr1, car.z));
      car.vz *= -0.55;
      if (hit > 0.45) [car.bump, car.turn] = [1, car.turn + 1];
    }
  }
  // tegen elkaar: uit elkaar duwen en de vaart langs de botsrichting omwisselen
  for (let i = 0; i < cars.length; i++)
    for (let j = i + 1; j < cars.length; j++) {
      const a = cars[i], b = cars[j], dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
      if (d >= BUMPER.r * 2 || d < 1e-6) continue;
      const nx = dx / d, nz = dz / d, push = (BUMPER.r * 2 - d) / 2;
      a.x -= nx * push;
      a.z -= nz * push;
      b.x += nx * push;
      b.z += nz * push;
      const closing = (a.vx - b.vx) * nx + (a.vz - b.vz) * nz;
      if (closing <= 0) continue;
      const kick = closing * 0.85;
      a.vx -= nx * kick;
      a.vz -= nz * kick;
      b.vx += nx * kick;
      b.vz += nz * kick;
      if (closing > 0.45) {
        [a.bump, a.turn] = [1, a.turn + 1];
        [b.bump, b.turn] = [1, b.turn + 1];
      }
    }
  // (een auto die door een ander is weggeduwd, blijft ook binnen de rand)
  for (const car of cars) {
    car.x = Math.max(-xr, Math.min(xr, car.x));
    car.z = Math.max(zr0, Math.min(zr1, car.z));
  }
}

/** Waar de gast in auto `seat` zit: hij rijdt mee en schudt bij een botsing. */
export function bumperSeat(out: RidePose, seat: number, s: RideState): RidePose {
  const car = s.cars[seat % BUMPER.cars];
  put(out, car.x, BUMPER.floor + BUMPER.seat, car.z, car.dir, 'drive');
  out.on = true;
  out.u = car.bump;
  return out;
}

/** De route van het pad naar auto `seat`: door de opening in de rand de vloer op, en naar de auto toe. */
function bumperWay(v: Visit, s: RideState): void {
  const car = s.cars[v.seat % BUMPER.cars];
  wayFrom(v.fx, 0, v.fz);
  wayTo(0, 0, BUMPER.gate + 0.3);
  wayTo(0, BUMPER.floor, BUMPER.gate - 0.25);
  wayTo(car.x, BUMPER.floor, car.z);
}

function bumperPlan(v: Visit, s: RideState, used: number): boolean {
  const c = s.clock % BUMPER_CYCLE;
  if (c >= BUMPER.stop || !s.cars.length) return false;
  let best = -1, least = Infinity;
  for (let seat = 0; seat < BUMPER.cars; seat++) {
    if (used & (1 << seat)) continue;
    v.seat = seat;
    bumperWay(v, s);
    const len = wayLength();
    if (len < least) [best, least] = [seat, len];
  }
  if (best < 0) return false;
  v.seat = best;
  v.walk = least / RIDE_WALK + SIT_TIME;
  if (c + v.walk + 0.2 > BUMPER.stop) return false;
  v.wait = BUMPER.stop - c - v.walk;
  v.ride = BUMPER.run + BUMPER.down;
  v.back = SIT_TIME + (Math.hypot(v.fx, v.fz - BUMPER.gate) + 0.6 + Math.hypot(BUMPER.ax * 2, BUMPER.z1 - BUMPER.z0)) / RIDE_WALK;
  return true;
}

function bumperPose(out: RidePose, v: Visit, s: RideState, e: number): RidePose {
  const leave = v.walk + v.wait + v.ride;
  if (e >= v.walk && e < leave) return bumperSeat(out, v.seat, s);
  bumperWay(v, s);
  // (hij loopt tot naast de auto, niet erin)
  const beside = wayLength() - BUMPER.r;
  if (e < v.walk - SIT_TIME) {
    wayAt(out, Math.min(e * RIDE_WALK, beside));
    return out;
  }
  if (e < v.walk || e < leave + SIT_TIME) {
    // in- of uitstappen: van naast de auto erin, of andersom
    wayAt(out, beside);
    const sx = out.x, sz = out.z, sf = out.face;
    bumperSeat(out, v.seat, s);
    hopOn(out, sx, BUMPER.floor, sz, sf, e < v.walk ? (e - (v.walk - SIT_TIME)) / SIT_TIME : 1 - (e - leave) / SIT_TIME);
    out.on = false;
    out.u = 0;
    return out;
  }
  out.done = wayAt(out, BUMPER.r + (e - leave - SIT_TIME) * RIDE_WALK, true);
  return out;
}

// ------------------------------------------------------------ de fontein (3 bij 3)
/**
 * De fontein. `wall`: de buitenkant van het bassin, `water`: de rand van het water, `rim`: daar staan de gasten,
 * elk op een eigen plekje (`spread`: zoveel radialen naast de plek recht voor het pad). `jets`: zoveel stralen in
 * een kring op straal `ring`, die in een boog naar het midden spuiten; daarbij komt de grote straal in het midden.
 * `stay`: zo lang blijft een gast staan kijken. `round`: zo lang duurt één heel waterballet.
 */
export const FOUNTAIN = {
  wall: 1.24, water: 1.1, rim: 1.44, spread: [0, 0.4, -0.4, 0.8, -0.8, 1.2, -1.2, 1.6], jets: 8, ring: 0.86, stay: 4.4, round: 24,
};

/**
 * Hoe hoog straal `i` nu spuit, van 0 tot 1. De stralen 0 t/m `jets` - 1 staan in de kring, straal `jets` is de
 * grote in het midden. Het waterballet heeft vier stukken van elk een kwart ronde: een golf die rondloopt, om en
 * om hoog en laag, allemaal samen omhoog, en dan de grote straal in het midden met de kring er zacht omheen.
 */
export function fountainJet(i: number, clock: number): number {
  const part = FOUNTAIN.round / 4, t = ((clock % FOUNTAIN.round) + FOUNTAIN.round) % FOUNTAIN.round, k = Math.floor(t / part), u = (t - k * part) / part;
  const centre = i >= FOUNTAIN.jets;
  const level = (kind: number, q: number): number => {
    if (kind === 0) return centre ? 0.45 : 0.3 + 0.7 * Math.pow(Math.max(0, Math.cos((i * TAU) / FOUNTAIN.jets - q * TAU * 2)), 2);
    if (kind === 1) return centre ? 0.5 : 0.25 + 0.75 * ease(0.5 + 0.5 * Math.sin(q * TAU * 3) * (i % 2 ? 1 : -1) * 1.6);
    if (kind === 2) return centre ? 0.3 + 0.3 * ease(q * 2) : 0.2 + 0.8 * ease(q * 1.6) * (1 - ease((q - 0.8) / 0.2));
    return centre ? 0.5 + 0.5 * ease(q * 4) * (1 - ease((q - 0.85) / 0.15)) : 0.28 + 0.1 * Math.sin(q * TAU * 4 + i);
  };
  // de overgang naar het volgende stuk gaat zacht
  const blend = ease((u - 0.9) / 0.1);
  return clamp01(lerp(level(k, u), level((k + 1) % 4, 0), blend));
}

/** Waar gast `seat` aan de rand staat: zo dicht mogelijk bij waar hij vandaan kwam, elk op een eigen plekje, met het gezicht naar het water. */
export function fountainSpot(out: RidePose, seat: number, fx: number, fz: number): RidePose {
  const a = Math.atan2(fx, fz) + FOUNTAIN.spread[seat % FOUNTAIN.spread.length];
  put(out, Math.sin(a) * FOUNTAIN.rim, 0, Math.cos(a) * FOUNTAIN.rim, a + Math.PI, 'stand');
  out.on = true;
  return out;
}

function fountainPlan(v: Visit, used: number): boolean {
  if (!freeSeat(v, used, FOUNTAIN.spread.length)) return false;
  const p = fountainSpot(SCRATCH, v.seat, v.fx, v.fz);
  v.walk = v.back = Math.max(0.45, Math.hypot(p.x - v.fx, p.z - v.fz) / RIDE_WALK);
  v.wait = 0;
  v.ride = FOUNTAIN.stay;
  return true;
}

function fountainPose(out: RidePose, v: Visit, e: number): RidePose {
  fountainSpot(out, v.seat, v.fx, v.fz);
  const leave = v.walk + v.ride;
  if (e >= v.walk && e < leave) return out;
  const k = e < v.walk ? e / v.walk : 1 - (e - leave) / v.back, x = out.x, z = out.z, f = out.face;
  out.x = lerp(v.fx, x, ease(k));
  out.z = lerp(v.fz, z, ease(k));
  out.face = e < v.walk ? Math.atan2(x - v.fx, z - v.fz) : Math.atan2(v.fx - x, v.fz - z);
  // de laatste stap draait hij zich naar het water
  if (e < v.walk && k > 0.75) out.face += turnTo(out.face, f) * ((k - 0.75) / 0.25);
  out.act = 'walk';
  out.on = false;
  out.done = e >= leave && k <= 0;
  return out;
}

// ------------------------------------------------------------ de uitkijktoren (2 bij 2)
/**
 * De uitkijktoren. `top`: zo hoog is de vloer waar je staat. De trap loopt binnen de vier palen in vier stukken
 * omhoog, langs de vier kanten: `stair` is hoe ver het midden van de trap uit het midden van de toren ligt, `foot`
 * (z) waar je voor de eerste trede staat. `spots`: de plekken (x, z) langs het hek; `mid`: daar loop je boven
 * langs het trapgat. `look`: zo lang kijk je boven rond. `climb`: zo snel ga je de trap op en af (tegels per tel).
 */
export const TOWER = {
  top: 2.7, stair: 0.42, foot: 0.74, look: 6.5, climb: 1.15, mid: [0.5, 0.02],
  spots: [[0, -0.62], [-0.52, -0.6], [0.52, -0.6], [-0.66, -0.08], [0.66, -0.22]],
};
/** De hoeken van de trap, van onder naar boven: (x, h, z) als deel van `stair` en van `top`. */
const TOWER_TURNS = [[1, 0, 1], [1, 0.25, -1], [-1, 0.5, -1], [-1, 0.75, 1], [1, 1, 1]];

/**
 * De route van het pad naar plek `seat` boven: naar de voet van de trap, vier stukken trap omhoog en over de vloer
 * naar het hek. `lane`: 1 = aan de buitenkant van de trap (omhoog), -1 = aan de binnenkant (omlaag), zodat wie
 * omhoog gaat en wie omlaag komt langs elkaar kunnen.
 */
function towerWay(v: Visit, lane: number): void {
  const s = TOWER.stair * (1 + 0.19 * lane), [sx, sz] = TOWER.spots[v.seat % TOWER.spots.length];
  wayFrom(v.fx, 0, v.fz);
  wayTo(s, 0, TOWER.foot + 0.2);
  for (const [x, h, z] of TOWER_TURNS) wayTo(x * s, h * TOWER.top, z * s);
  wayTo(TOWER.mid[0], TOWER.top, TOWER.mid[1]);
  wayTo(sx, TOWER.top, sz);
}

function towerPlan(v: Visit, used: number): boolean {
  if (!freeSeat(v, used, TOWER.spots.length)) return false;
  towerWay(v, 1);
  v.walk = v.back = wayLength() / TOWER.climb;
  v.wait = 0;
  v.ride = TOWER.look;
  return true;
}

function towerPose(out: RidePose, v: Visit, e: number): RidePose {
  const leave = v.walk + v.ride;
  if (e >= v.walk && e < leave) {
    const [sx, sz] = TOWER.spots[v.seat % TOWER.spots.length];
    put(out, sx, TOWER.top, sz, Math.atan2(sx, sz), 'stand');
    out.on = true;
    return out;
  }
  towerWay(v, e < v.walk ? 1 : -1);
  if (e < v.walk) wayAt(out, e * TOWER.climb);
  else out.done = wayAt(out, (e - leave) * TOWER.climb, true);
  return out;
}

// ------------------------------------------------------------ de glijbaan (2 bij 3)
/**
 * De glijbaan. `top`: zo hoog is het torentje. De trap staat rechts (`stairX`), van `stairFoot` (z, vooraan) tot
 * `stairTop` (z, bij het torentje); de glijbaan ligt links (`chuteX`), van `chuteTop` (z) schuin naar beneden tot
 * `chuteBend` (z, dan is hij nog `bendH` hoog) en loopt daarna bijna vlak uit tot `chuteEnd` (z, `endH` hoog).
 * `back`: zo ver naar achteren (z) loop je over het torentje. `slots`: zoveel kinderen tegelijk, die precies een
 * derde ronde na elkaar lopen; elk kind maakt `laps` rondjes. `lap`: hoe lang elk stuk van een rondje duurt: de
 * trap op, over het torentje, gaan zitten, glijden, opstaan, en om de glijbaan heen terug naar de trap.
 */
export const SLIDE = {
  top: 1.5, stairX: 0.52, stairFoot: 1.2, stairTop: -0.6, chuteX: -0.5, chuteTop: -0.62, chuteBend: 0.72, bendH: 0.44, chuteEnd: 1.24, endH: 0.26, back: -1,
  slots: 3, laps: 2, lap: [2.2, 1.6, 0.3, 1.25, 0.45, 1.15],
};
export const SLIDE_LAP = SLIDE.lap.reduce((a, b) => a + b, 0);

/** Hoe hoog de glijbaan is op plek `z`: schuin van het torentje tot de knik, en dan bijna vlak tot het eind. */
export function chuteHeight(z: number): number {
  if (z <= SLIDE.chuteTop) return SLIDE.top;
  if (z <= SLIDE.chuteBend) return lerp(SLIDE.top, SLIDE.bendH, (z - SLIDE.chuteTop) / (SLIDE.chuteBend - SLIDE.chuteTop));
  return lerp(SLIDE.bendH, SLIDE.endH, clamp01((z - SLIDE.chuteBend) / (SLIDE.chuteEnd - SLIDE.chuteBend)));
}

/** Hoe ver kind `slot` nu is in zijn rondje (tellen vanaf de voet van de trap). */
const slidePhase = (slot: number, clock: number): number => (((clock - (slot * SLIDE_LAP) / SLIDE.slots) % SLIDE_LAP) + SLIDE_LAP) % SLIDE_LAP;

/** Waar een kind is dat `p` tellen bezig is met een rondje: de trap op, over het torentje, glijden, en terug naar de trap. */
export function slideLap(out: RidePose, p: number): RidePose {
  const [climb, cross, sit, glide, rise] = SLIDE.lap;
  let t = p;
  if (t < climb) {
    put(out, SLIDE.stairX, lerp(0, SLIDE.top, t / climb), lerp(SLIDE.stairFoot, SLIDE.stairTop, t / climb), Math.PI, 'climb');
    out.on = true;
    return out;
  }
  t -= climb;
  if (t < cross) {
    // over het torentje: naar achteren, oversteken en naar de glijbaan toe
    wayFrom(SLIDE.stairX, SLIDE.top, SLIDE.stairTop);
    wayTo(SLIDE.stairX, SLIDE.top, SLIDE.back);
    wayTo(SLIDE.chuteX, SLIDE.top, SLIDE.back);
    wayTo(SLIDE.chuteX, SLIDE.top, SLIDE.chuteTop - 0.1);
    wayAt(out, (t / cross) * wayLength());
    out.on = true;
    return out;
  }
  t -= cross;
  if (t < sit) {
    put(out, SLIDE.chuteX, SLIDE.top + 0.03, SLIDE.chuteTop - 0.1, 0, 'sit');
    out.sit = ease(t / sit);
    out.on = true;
    return out;
  }
  t -= sit;
  if (t < glide) {
    // glijden: steeds sneller, achterover en met de armen in de lucht
    const u = Math.pow(t / glide, 1.7), z = lerp(SLIDE.chuteTop - 0.1, SLIDE.chuteEnd - 0.08, u);
    put(out, SLIDE.chuteX, chuteHeight(z) + 0.03, z, 0, 'slide');
    out.pitch = z < SLIDE.chuteBend ? -0.3 : -0.3 * (1 - (z - SLIDE.chuteBend) / (SLIDE.chuteEnd - SLIDE.chuteBend));
    out.u = t / glide;
    out.on = true;
    return out;
  }
  t -= glide;
  if (t < rise) {
    // opstaan aan het eind en van de glijbaan af stappen
    const k = t / rise;
    put(out, SLIDE.chuteX, lerp(SLIDE.endH + 0.03, 0, ease(k)), lerp(SLIDE.chuteEnd - 0.08, SLIDE.chuteEnd + 0.16, ease(k)), 0, 'stand');
    out.sit = 1 - ease(k / 0.6);
    out.u = k;
    out.on = true;
    return out;
  }
  t -= rise;
  slideReturn();
  wayAt(out, (t / SLIDE.lap[5]) * wayLength());
  out.on = true;
  return out;
}

/** Van het eind van de glijbaan vooromlangs terug naar de voet van de trap. */
function slideReturn(): void {
  wayFrom(SLIDE.chuteX, 0, SLIDE.chuteEnd + 0.16);
  wayTo(SLIDE.stairX, 0, SLIDE.chuteEnd + 0.16);
  wayTo(SLIDE.stairX, 0, SLIDE.stairFoot);
}

function slidePlan(v: Visit, s: RideState, used: number): boolean {
  const walk = Math.max(0.3, Math.hypot(v.fx - SLIDE.stairX, v.fz - SLIDE.stairFoot) / RIDE_WALK);
  // de vrije beurt die het eerst weer onderaan de trap begint
  let best = -1, least = Infinity;
  for (let slot = 0; slot < SLIDE.slots; slot++) {
    if (used & (1 << slot)) continue;
    const wait = (SLIDE_LAP - slidePhase(slot, s.clock + walk)) % SLIDE_LAP;
    if (wait < least) [best, least] = [slot, wait];
  }
  if (best < 0) return false;
  v.seat = best;
  v.walk = walk;
  v.wait = least;
  // het laatste rondje houdt op als het kind van de glijbaan af stapt
  v.ride = SLIDE.laps * SLIDE_LAP - SLIDE.lap[5];
  v.back = Math.max(0.3, Math.hypot(v.fx - SLIDE.chuteX, v.fz - SLIDE.chuteEnd - 0.16) / RIDE_WALK);
  return true;
}

function slidePose(out: RidePose, v: Visit, e: number): RidePose {
  const start = v.walk + v.wait, leave = start + v.ride;
  if (e < v.walk) {
    wayFrom(v.fx, 0, v.fz);
    wayTo(SLIDE.stairX, 0, SLIDE.stairFoot);
    wayAt(out, (e / v.walk) * wayLength());
    return out;
  }
  // wachten op je beurt, onderaan de trap
  if (e < start) return put(out, SLIDE.stairX, 0, SLIDE.stairFoot, Math.PI, 'stand');
  if (e < leave) return slideLap(out, (e - start) % SLIDE_LAP);
  wayFrom(SLIDE.chuteX, 0, SLIDE.chuteEnd + 0.16);
  wayTo(v.fx, 0, v.fz);
  out.done = wayAt(out, ((e - leave) / v.back) * wayLength());
  return out;
}

// ------------------------------------------------------------ schommel, wipwap, wipkip en trampoline
/**
 * De schommel (2 bij 1): twee zitjes, `side` links en rechts van het midden, aan touwen van `rope` lang onder een
 * balk op hoogte `top`. `max`: zo ver zwaait een zitje hooguit uit (radialen), `speed`: hoe snel het heen en weer
 * gaat. Een leeg zitje wiegt op `calm` daarvan. `stay`: zo lang schommelt een kind.
 */
export const SWINGSET = { seats: 2, side: 0.42, top: 1.62, rope: 1.18, max: 0.5, speed: 2.5, calm: 0.1, stay: 7 };
/** De wipwap (2 bij 1): een plank om een as op hoogte `pivot`, met een zitje op `side` van het midden; hij kantelt hooguit `max` radialen. */
export const SEESAW = { seats: 2, pivot: 0.46, side: 0.68, lift: 0.07, max: 0.28, speed: 3, calm: 0.12, stay: 7 };
/** De wipkip (1 bij 1): een dier op een veer. Het wipt om het punt `pivot` hoog, het zadel zit op `seat`; `max` is hoe ver het wipt. */
export const SPRINGER = { seats: 1, pivot: 0.14, seat: 0.5, max: 0.3, speed: 6, calm: 0.12, stay: 6 };
/**
 * De trampoline (2 bij 2): het doek ligt op hoogte `mat` en is `r` groot; de springers staan op `ring` van het
 * midden. `jump`: zo hoog springen ze, `speed`: hoe snel (een sprong duurt pi gedeeld door `speed` tellen).
 */
export const TRAMPOLINE = { seats: 3, mat: 0.44, r: 0.72, frame: 0.9, ring: 0.3, jump: 0.55, speed: 4.4, stay: 6.5 };

/** Hoe ver zitje `seat` van de schommel nu uitzwaait (radialen): de twee zitjes gaan niet gelijk. */
export const swingAngle = (seat: number, s: RideState): number => SWINGSET.max * (s.amps[seat] ?? SWINGSET.calm) * Math.sin(s.spin + seat * 2.2);

export function swingSeat(out: RidePose, seat: number, s: RideState): RidePose {
  const a = swingAngle(seat, s);
  put(out, (seat % 2 ? 1 : -1) * SWINGSET.side, SWINGSET.top - SWINGSET.rope * Math.cos(a), -SWINGSET.rope * Math.sin(a), 0, 'sit');
  out.pitch = a;
  out.on = true;
  // (voor de benen: 1 = helemaal naar voren, 0 = helemaal naar achteren)
  out.u = 0.5 - Math.sin(a) / (2 * Math.sin(SWINGSET.max));
  return out;
}

/** Hoe ver de wipwap nu gekanteld is (radialen): bij een plus gaat de rechterkant omhoog. */
export const seesawTilt = (s: RideState): number => SEESAW.max * s.amp * Math.sin(s.spin);

export function seesawSeat(out: RidePose, seat: number, s: RideState): RidePose {
  const side = seat % 2 ? 1 : -1, b = seesawTilt(s), x = side * SEESAW.side, y = SEESAW.lift;
  put(out, x * Math.cos(b) - y * Math.sin(b), SEESAW.pivot + x * Math.sin(b) + y * Math.cos(b), 0, -side * (Math.PI / 2), 'sit');
  out.pitch = side * b;
  out.on = true;
  // (1 = helemaal boven, 0 = helemaal beneden)
  out.u = 0.5 + (side * Math.sin(b)) / (2 * Math.sin(SEESAW.max));
  return out;
}

/** Hoe ver de wipkip nu voorover (+) of achterover wipt, en hoe ver opzij: [voorover, opzij] in radialen. */
export function springerTilt(s: RideState): [number, number] {
  const a = s.amps[0] ?? SPRINGER.calm;
  return [SPRINGER.max * a * Math.sin(s.spin), SPRINGER.max * 0.35 * a * Math.sin(s.spin * 0.5 + 1)];
}

export function springerSeat(out: RidePose, s: RideState): RidePose {
  const [pitch, roll] = springerTilt(s), d = SPRINGER.seat - SPRINGER.pivot;
  put(out, -d * Math.sin(roll), SPRINGER.pivot + d * Math.cos(pitch) * Math.cos(roll), d * Math.sin(pitch), 0, 'sit');
  out.pitch = pitch;
  out.roll = roll;
  out.on = true;
  return out;
}

/** Hoe hoog springer `seat` nu boven het doek is (0 = op het doek, 1 = bovenin), en de hoeveelste sprong het is. */
export function trampolineJump(seat: number, s: RideState): [number, number] {
  const f = (s.spin + seat * 2.1) / Math.PI;
  return [Math.abs(Math.sin(f * Math.PI)) * (s.amps[seat] ?? 0), Math.floor(f)];
}

/** Hoe ver het doek nu doorzakt: het veert in waar iemand neerkomt. */
export function trampolineDip(s: RideState): number {
  let dip = 0;
  for (let seat = 0; seat < TRAMPOLINE.seats; seat++) {
    const amp = s.amps[seat] ?? 0;
    if (amp > 0.05) dip += Math.max(0, 1 - trampolineJump(seat, s)[0] / (0.35 * amp)) * 0.045 * amp;
  }
  return dip;
}

export function trampolineSeat(out: RidePose, seat: number, s: RideState): RidePose {
  const a = (seat * TAU) / TRAMPOLINE.seats + 0.5, [jump, n] = trampolineJump(seat, s);
  // elke derde sprong landt hij op zijn billen en veert weer op
  const bum = n % 3 === 2 ? Math.max(0, 1 - jump / 0.45) : 0;
  put(out, Math.sin(a) * TRAMPOLINE.ring, TRAMPOLINE.mat + jump * TRAMPOLINE.jump - trampolineDip(s), Math.cos(a) * TRAMPOLINE.ring, a + Math.PI + s.spin * 0.4, 'jump');
  out.u = jump;
  out.w = bum;
  out.on = true;
  return out;
}

/** Waar een kind op zo'n toestel zit of springt. */
function playSeat(out: RidePose, kind: RideKind, seat: number, s: RideState): RidePose {
  if (kind === 'swing') return swingSeat(out, seat, s);
  if (kind === 'seesaw') return seesawSeat(out, seat, s);
  if (kind === 'springer') return springerSeat(out, s);
  return trampolineSeat(out, seat, s);
}

const PLAY_SEATS = { swing: SWINGSET.seats, seesaw: SEESAW.seats, springer: SPRINGER.seats, trampoline: TRAMPOLINE.seats };
const PLAY_STAY = { swing: SWINGSET.stay, seesaw: SEESAW.stay, springer: SPRINGER.stay, trampoline: TRAMPOLINE.stay };

/** Naast het zitje: daar staat het kind voor het erop klimt (het zitje in rust, een stapje naar voren). */
function playSide(out: RidePose, kind: RideKind, seat: number): void {
  const side = seat % 2 ? 1 : -1;
  if (kind === 'swing') put(out, side * SWINGSET.side, 0, 0.3, Math.PI, 'stand');
  else if (kind === 'seesaw') put(out, side * SEESAW.side, 0, 0.3, Math.PI, 'stand');
  else if (kind === 'springer') put(out, 0.28, 0, 0.12, -Math.PI / 2, 'stand');
  else {
    const a = (seat * TAU) / TRAMPOLINE.seats + 0.5;
    put(out, Math.sin(a) * (TRAMPOLINE.frame + 0.08), 0, Math.cos(a) * (TRAMPOLINE.frame + 0.08), a + Math.PI, 'stand');
  }
}

/** Zo lang duurt erop klimmen of eraf stappen: op de trampoline is dat een hele stap omhoog. */
const playHop = (kind: RideKind): number => (kind === 'trampoline' ? 0.55 : SIT_TIME);

function playPlan(v: Visit, used: number): boolean {
  const kind = v.kind as keyof typeof PLAY_SEATS;
  if (!freeSeat(v, used, PLAY_SEATS[kind])) return false;
  playSide(SCRATCH, kind, v.seat);
  v.walk = v.back = Math.max(0.3, Math.hypot(SCRATCH.x - v.fx, SCRATCH.z - v.fz) / RIDE_WALK) + playHop(kind);
  v.wait = 0;
  v.ride = PLAY_STAY[kind];
  return true;
}

function playPose(out: RidePose, v: Visit, s: RideState, e: number): RidePose {
  const hop = playHop(v.kind), leave = v.walk + v.ride, span = v.walk - hop;
  if (e >= v.walk && e < leave) return playSeat(out, v.kind, v.seat, s);
  playSide(out, v.kind, v.seat);
  const sx = out.x, sz = out.z, sf = out.face;
  if (e >= span && e < leave + hop) {
    // erop klimmen of er weer af: van naast het zitje erop, of andersom
    playSeat(out, v.kind, v.seat, s);
    hopOn(out, sx, 0, sz, sf, e < v.walk ? (e - span) / hop : 1 - (e - leave) / hop);
    out.on = false;
    return out;
  }
  // van het pad naar het zitje lopen, of terug
  const t = e < span ? e / span : 1 - (e - leave - hop) / span;
  put(out, lerp(v.fx, sx, clamp01(t)), 0, lerp(v.fz, sz, clamp01(t)), e < span ? Math.atan2(sx - v.fx, sz - v.fz) : Math.atan2(v.fx - sx, v.fz - sz), 'walk');
  out.done = e >= leave && t <= 0;
  return out;
}

// ------------------------------------------------------------ het restaurant (3 bij 2)
/**
 * Het restaurant: de keuken staat linksachter, de tafels op het terras. `tables`: de tafels (x, z), met aan
 * weerszijden (`stool` naar links en naar rechts) een kruk van `seat` hoog. `front` (z): daar stap je het terras
 * op. `stay`: zo lang zit een gast te eten.
 */
export const RESTAURANT = { tables: [[-0.98, 0.42], [0, 0.42], [0.98, 0.42], [0.9, -0.56]] as [number, number][], stool: 0.27, seat: 0.25, front: 0.92, stay: 9 };

/** Waar een gast op kruk `seat` zit: twee krukken per tafel, met het gezicht naar de tafel. */
export function restaurantSeat(out: RidePose, seat: number): RidePose {
  const [tx, tz] = RESTAURANT.tables[Math.floor(seat / 2) % RESTAURANT.tables.length], side = seat % 2 ? 1 : -1;
  put(out, tx + side * RESTAURANT.stool, RESTAURANT.seat, tz, -side * (Math.PI / 2), 'sit');
  out.on = true;
  return out;
}

/** De route van het pad naar kruk `seat`: het terras op en om de tafel heen naar de kruk. */
function restaurantWay(v: Visit): void {
  const p = restaurantSeat(SCRATCH, v.seat), back = p.z < 0;
  wayFrom(v.fx, 0, v.fz);
  wayTo(Math.max(-1.3, Math.min(1.3, back ? 0.49 : p.x)), 0, RESTAURANT.front);
  // de tafel achteraan: tussen de voorste tafels door
  if (back) wayTo(0.49, 0, -0.08);
  wayTo(p.x, 0, p.z + (back ? 0.26 : 0.3));
}

function restaurantPlan(v: Visit, used: number): boolean {
  if (!freeSeat(v, used, RESTAURANT.tables.length * 2)) return false;
  restaurantWay(v);
  v.walk = v.back = wayLength() / RIDE_WALK + SIT_TIME;
  v.wait = 0;
  v.ride = RESTAURANT.stay;
  return true;
}

function restaurantPose(out: RidePose, v: Visit, e: number): RidePose {
  const leave = v.walk + v.ride;
  if (e >= v.walk && e < leave) return restaurantSeat(out, v.seat);
  restaurantWay(v);
  if (e < v.walk - SIT_TIME) {
    wayAt(out, e * RIDE_WALK);
    return out;
  }
  if (e < leave + SIT_TIME) {
    // gaan zitten of opstaan: van naast de kruk erop, of andersom
    wayAt(out, 99);
    const sx = out.x, sz = out.z, sf = out.face;
    restaurantSeat(out, v.seat);
    hopOn(out, sx, 0, sz, sf, e < v.walk ? (e - (v.walk - SIT_TIME)) / SIT_TIME : 1 - (e - leave) / SIT_TIME);
    out.on = false;
    return out;
  }
  out.done = wayAt(out, (e - leave - SIT_TIME) * RIDE_WALK, true);
  return out;
}

// ------------------------------------------------------------ alles bij elkaar
/** Hoeveel gasten er tegelijk op of in kunnen. */
export const RIDE_SEATS: Record<RideKind, number> = {
  slide: SLIDE.slots, swing: SWINGSET.seats, seesaw: SEESAW.seats, springer: SPRINGER.seats, trampoline: TRAMPOLINE.seats, fountain: FOUNTAIN.spread.length,
  tower: TOWER.spots.length, carousel: CAROUSEL_SEATS, bumper: BUMPER.cars, ferris: FERRIS.cabins * FERRIS.per, restaurant: RESTAURANT.tables.length * 2,
};

const SCRATCH = newPose();

/** Het eerste vrije zitje van de `n`; zo zitten er nooit twee gasten op hetzelfde. Geeft false als alles bezet is. */
function freeSeat(v: Visit, used: number, n: number): boolean {
  for (let seat = 0; seat < n; seat++)
    if (!(used & (1 << seat))) {
      v.seat = seat;
      return true;
    }
  return false;
}

/**
 * Een gast wil op dit toestel: kiest een zitje en rekent uit hoe lang elk stuk van het bezoek duurt. `used`: welke
 * zitjes bezet zijn (een bit per zitje); (`fx`, `fz`): waar de gast op het pad staat, in de maat van het gebouw.
 * Geeft null als er nu geen plek is, of als het ritje al bezig is (de draaimolen en de botsauto's): dan wacht de
 * gast in de rij tot het weer stilstaat.
 */
export function planVisit(kind: RideKind, s: RideState, used: number, fx: number, fz: number): Visit | null {
  const v: Visit = { kind, seat: 0, fx, fz, t0: s.clock, walk: 0, wait: 0, ride: 0, back: 0 };
  const ok = kind === 'ferris' ? ferrisPlan(v, s, used)
    : kind === 'carousel' ? carouselPlan(v, s, used)
    : kind === 'bumper' ? bumperPlan(v, s, used)
    : kind === 'fountain' ? fountainPlan(v, used)
    : kind === 'tower' ? towerPlan(v, used)
    : kind === 'slide' ? slidePlan(v, s, used)
    : kind === 'restaurant' ? restaurantPlan(v, used)
    : playPlan(v, used);
  return ok ? v : null;
}

/**
 * Waar de gast van dit bezoek nu is en hoe hij erbij staat of zit. Leest de klok van het toestel: het bezoek loopt
 * dus precies gelijk met het toestel zelf. `out.done` is true zodra hij weer op het pad staat.
 */
export function visitPose(out: RidePose, v: Visit, s: RideState): RidePose {
  const e = Math.max(0, s.clock - v.t0), kind = v.kind;
  if (kind === 'ferris') ferrisPose(out, v, s, e);
  else if (kind === 'carousel') carouselPose(out, v, s, e);
  else if (kind === 'bumper') bumperPose(out, v, s, e);
  else if (kind === 'fountain') fountainPose(out, v, e);
  else if (kind === 'tower') towerPose(out, v, e);
  else if (kind === 'slide') slidePose(out, v, e);
  else if (kind === 'restaurant') restaurantPose(out, v, e);
  else playPose(out, v, s, e);
  if (e >= visitTime(v)) out.done = true;
  return out;
}

/** Alleen het zitje zelf, zonder het lopen ernaartoe: waar iemand op zitje `seat` nu zit. Voor wie zelf meerijdt. */
export function seatPose(out: RidePose, kind: RideKind, seat: number, s: RideState): RidePose {
  if (kind === 'ferris') return ferrisSeat(out, seat, s);
  if (kind === 'carousel') return carouselSeat(out, seat, s);
  if (kind === 'bumper') return bumperSeat(out, seat, s);
  if (kind === 'fountain') return fountainSpot(out, seat, 0, 1);
  if (kind === 'tower') {
    const [sx, sz] = TOWER.spots[seat % TOWER.spots.length];
    put(out, sx, TOWER.top, sz, Math.atan2(sx, sz), 'stand');
    out.on = true;
    return out;
  }
  if (kind === 'slide') return slideLap(out, slidePhase(seat, s.clock));
  if (kind === 'restaurant') return restaurantSeat(out, seat);
  return playSeat(out, kind, seat, s);
}

/** Een nieuw toestel: de klok op nul, alles in rust. */
export function newRide(kind: ShopKind): RideState {
  return { clock: 0, spin: 0, amp: 0, amps: [], cars: kind === 'bumper' ? newCars() : [] };
}

/** Hoe snel de speeltoestellen heen en weer gaan (radialen per tel). */
const PLAY_SPEED: Partial<Record<ShopKind, number>> = { swing: SWINGSET.speed, seesaw: SEESAW.speed, springer: SPRINGER.speed, trampoline: TRAMPOLINE.speed };

/** Schuift `amps[i]` een stukje naar `to`. */
function nudge(s: RideState, i: number, to: number, rate: number, from = 0): void {
  const now = s.amps[i] ?? from;
  s.amps[i] = now + (to - now) * Math.min(1, rate);
}

/**
 * Het toestel een beeldje verder: `dt` tellen. `aboard`: op welke zitjes nu echt iemand zit (een bit per zitje);
 * daarmee gaat een bezet zitje flink heen en weer en wiegt een leeg zitje alleen wat, draait de draaimolen op
 * volle snelheid en rijden de botsauto's echt. De klok loopt altijd gewoon door.
 */
export function rideStep(kind: ShopKind, s: RideState, dt: number, aboard: number): void {
  s.clock += dt;
  const busy = aboard !== 0;
  if (kind === 'ferris') {
    // het reuzenrad draait altijd rustig rond; een bakje met gasten slingert wat meer
    s.spin = (s.spin + dt * FERRIS.speed) % TAU;
    for (let c = 0; c < FERRIS.cabins; c++) nudge(s, c, (aboard >> (c * FERRIS.per)) & 3 ? 1 : 0, dt * 1.5);
  } else if (kind === 'carousel') {
    s.amp += ((busy ? 1 : CAROUSEL.idle) - s.amp) * Math.min(1, dt * 1.2);
    s.spin = (s.spin + dt * CAROUSEL.speed * s.amp * cycleSpeed(s.clock % CAROUSEL_CYCLE, CAROUSEL.stop, CAROUSEL.up, CAROUSEL.run, CAROUSEL.down)) % TAU;
  } else if (kind === 'bumper') {
    const c = s.clock % BUMPER_CYCLE;
    stepCars(s.cars, dt, s.clock, c >= BUMPER.stop && c < BUMPER.stop + BUMPER.run ? 1 : 0, aboard);
  } else if (PLAY_SPEED[kind]) {
    // speeltoestellen wiegen zachtjes als er niemand op zit en gaan flink heen en weer met een kind erop
    // (de hoek loopt door tot dertig rondjes: dan passen ook de halve en de driedubbele slagen precies)
    s.spin = (s.spin + dt * PLAY_SPEED[kind]!) % (TAU * 30);
    s.amp += ((busy ? 1 : 0.12) - s.amp) * Math.min(1, dt * 2.5);
    const seats = RIDE_SEATS[kind as RideKind], calm = kind === 'trampoline' ? 0 : 0.12;
    for (let i = 0; i < seats; i++) nudge(s, i, (aboard >> i) & 1 ? 1 : calm, dt * 2.5, calm);
  }
}

/** Is het ritje nu bezig? (De draaimolen draait op snelheid, de botsauto's hebben stroom.) Dan wacht de rij op het pad. */
export function rideRunning(kind: ShopKind, s: RideState): boolean {
  if (kind === 'carousel') return s.clock % CAROUSEL_CYCLE >= CAROUSEL.stop;
  if (kind === 'bumper') return s.clock % BUMPER_CYCLE >= BUMPER.stop;
  return false;
}

/** Hoe hoog een toestel ongeveer is, in tegels: voor het bordje erboven en om erop te kunnen tikken. */
export const RIDE_TOP: Partial<Record<ShopKind, number>> = {
  ferris: FERRIS.hub + FERRIS.radius + 0.2, tower: TOWER.top + 1.9, carousel: 3.1, bumper: 2.4, slide: 3, fountain: 2.2, swing: 1.7, restaurant: 1.7,
};

/**
 * Lichten hoog in de lucht bij een toestel dat ver boven de grond uitsteekt: per licht de plek in het gebouw
 * (x, h, z) en hoe ver het reikt. Het licht om de voet komt van het gebouw zelf (zie shopLights in game.ts).
 */
export const RIDE_GLOW: Partial<Record<ShopKind, [number, number, number, number][]>> = {
  ferris: [[0, FERRIS.hub, 0, 2.75]],
  tower: [[0, TOWER.top + 0.5, 0, 1.3]],
  carousel: [[0, 1.9, 0, 1.5]],
};
