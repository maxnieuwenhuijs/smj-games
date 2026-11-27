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
//
// Wie een toestel wil gebruiken (een gast, of later de speler die zelf meerijdt): `newRide` maakt de stand van een
// toestel en `rideStep` zet hem elk beeldje een stukje verder. `planVisit` kiest een vrij zitje en rekent een heel
// bezoek uit; `visitPose` zegt waar je op elk moment van dat bezoek bent, van het pad tot en met weer op het pad.
// `seatPose` geeft alleen het zitje zelf (zonder het lopen), en `rideRunning` of het ritje nu bezig is.
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
/**
 * Twee getallen tegelijk teruggeven zonder iets nieuws aan te maken: altijd hetzelfde lijstje, opnieuw gevuld. Wie
 * zo'n gedeeld paar krijgt, leest het dus meteen uit (`const [a, b] = ...`) en bewaart het lijstje zelf niet.
 */
const PAIR: [number, number] = [0, 0];
const pair = (a: number, b: number): [number, number] => {
  PAIR[0] = a;
  PAIR[1] = b;
  return PAIR;
};
/** Een vast toevalsgetal tussen 0 en 1 bij twee getallen: dezelfde getallen geven altijd hetzelfde. */
const hash = (a: number, b: number): number => {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

// ------------------------------------------------------------ wat een toestel en een gast bijhouden
/** De toestellen en attracties met een eigen bezoek (zie planVisit). De rest koopt aan een toonbank of heeft eigen regels. */
export type RideKind = 'slide' | 'swing' | 'seesaw' | 'springer' | 'trampoline' | 'climber' | 'fountain' | 'tower' | 'carousel' | 'bumper' | 'ferris' | 'restaurant'
  // de grote speeltuin: zandbak, waterspeeltuin, tokkelbaan, springkussen, piratenschip, draaimolentje, nestschommel, ballenbak en kruipheuvel
  | 'sandbox' | 'splash' | 'zipline' | 'bouncy' | 'pirate' | 'roundabout' | 'nestswing' | 'ballpit' | 'crawlhill'
  // de grote attracties van het eind: zweefmolen, schommelschip, luchtballon, wildwaterbaan en achtbaan
  | 'swinger' | 'ship' | 'airballoon' | 'flume' | 'coaster';
/**
 * Voor zoveel tegels is elk toestel gemaakt: [breed (langs de voorkant), diep]. SHOP_SIZE en SHOP_DEEP in data.ts
 * zeggen hetzelfde (rides.test.ts let daarop).
 */
export const RIDE_SPAN: Record<RideKind, [number, number]> = {
  slide: [2, 3], swing: [2, 1], seesaw: [2, 1], springer: [1, 1], trampoline: [2, 2], climber: [10, 3], fountain: [3, 3],
  sandbox: [2, 2], splash: [3, 2], zipline: [6, 2], bouncy: [3, 3], pirate: [4, 3], roundabout: [2, 2], nestswing: [2, 2], ballpit: [2, 2], crawlhill: [3, 3], tower: [2, 2], carousel: [3, 3], bumper: [4, 3], ferris: [8, 2], restaurant: [3, 2],
  swinger: [4, 4], ship: [6, 2], airballoon: [3, 3], flume: [8, 3], coaster: [8, 4],
};
export const RIDE_KINDS = Object.keys(RIDE_SPAN) as RideKind[];
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
  /** Zoveel tellen rijdt hij nog weg van de laatste botsing, voor hij weer naar zijn doel stuurt. */
  away: number;
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
  /**
   * Is het toestel wakker, van 0 tot 1? 's Nachts, als het park dicht is en iedereen slaapt, zakt dit langzaam naar 0:
   * het rad en de draaimolen draaien uit, de botsauto's staan stil, de fontein zakt in en de schommels hangen stil.
   */
  wake: number;
  /** Bij een ritje met een eigen ronde (zie lapStep): de klok van het toestel toen deze ronde begon. */
  zero: number;
  /**
   * Bij de tokkelbaan: waar het kind op elk zitje nu aan de kabel hangt (x), of NaN als het zitje leeg is. De
   * kinderen zetten het (people.ts), het beeld laat het zitje daar hangen.
   */
  at?: number[];
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
  /** Op het klimkasteel: zo ver rechts van de ladder staat het kind in de rij als het aankomt (zie climberPlan). */
  q?: number;
}

/** Zo lang duurt het hele bezoek hooguit; `visitPose` zet `done` zodra de gast weer op het pad staat. */
export const visitTime = (v: Visit): number => v.walk + v.wait + v.ride + v.back;
/** Zo lang is het bezoek al bezig. */
export const visitAge = (v: Visit, s: RideState): number => s.clock - v.t0;
/**
 * Is de gast al van zijn zitje af en op de terugweg naar het pad? Dan is zijn plek weer vrij voor de volgende: zo
 * kan de rij al instappen terwijl de vorigen nog van de draaimolen af lopen.
 */
export const visitOff = (v: Visit, s: RideState): boolean => s.clock - v.t0 >= v.walk + v.wait + v.ride + 0.4;

/**
 * Een punt in het park omgerekend naar de maat van het gebouw: `cx`, `cy` is het midden van het gebouw op het
 * raster en `rot` hoeveel kwartslagen het gedraaid staat (0 = voorkant naar het zuiden). Geeft [x, z], als gedeeld
 * paar.
 */
export function rideLocal(gx: number, gy: number, cx: number, cy: number, rot: number): [number, number] {
  const turn = (rot * Math.PI) / 2, cos = Math.cos(turn), sin = Math.sin(turn), dx = gx - cx, dy = gy - cy;
  return pair(dx * cos - dy * sin, dx * sin + dy * cos);
}

/** En terug: een plek in het gebouw (x, z) als punt op het raster. Geeft [gx, gy], als gedeeld paar. */
export function rideWorld(x: number, z: number, cx: number, cy: number, rot: number): [number, number] {
  const turn = (rot * Math.PI) / 2, cos = Math.cos(turn), sin = Math.sin(turn);
  return pair(cx + x * cos + z * sin, cy - x * sin + z * cos);
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

/** Zo ver binnen de rand van zijn tegels loopt een gast die om een toestel heen moet. */
const LANE = 0.07;
/** Langs welke kant een gast om een toestel van `w` breed heen loopt als het pad er niet voor ligt: 1 = rechts, -1 = links. */
const roundSide = (v: Visit, w: number, tx: number): number => (Math.abs(v.fx) > w / 2 ? Math.sign(v.fx) : tx >= 0 ? 1 : -1);

/**
 * Het begin van een route: van het pad naar het punt (`tx`, `tz`) vooraan op een toestel van `w` bij `d` tegels.
 * Ligt het pad opzij of achter het toestel, dan loopt de gast eerst buitenom, vlak langs de rand van de tegels,
 * naar de voorkant: zo loopt hij nergens dwars doorheen.
 */
function wayIn(v: Visit, w: number, d: number, tx: number, tz: number): void {
  wayFrom(v.fx, 0, v.fz);
  if (v.fz < d / 2 - 0.25) {
    const lane = roundSide(v, w, tx) * (w / 2 - LANE);
    if (Math.abs(v.fx) <= w / 2) wayTo(lane, 0, -d / 2 + LANE);
    wayTo(lane, 0, d / 2 - LANE);
  }
  wayTo(tx, 0, tz);
}

/** Het eind van een route: van een punt vooraan op het toestel (daar staat de route al, `tx` is zijn x) terug naar het pad, zo nodig buitenom. */
function wayOut(v: Visit, w: number, d: number, tx: number): void {
  if (v.fz < d / 2 - 0.25) {
    const lane = roundSide(v, w, tx) * (w / 2 - LANE);
    wayTo(lane, 0, d / 2 - LANE);
    if (Math.abs(v.fx) <= w / 2) wayTo(lane, 0, -d / 2 + LANE);
  }
  wayTo(v.fx, 0, v.fz);
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
  wayIn(v, RIDE_SPAN.ferris[0], RIDE_SPAN.ferris[1], x, FERRIS.deckFront + 2 * FERRIS.step + 0.08);
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
    if (till < least) {
      best = seat;
      least = till;
    }
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
 * `speed`: radialen per tel op volle snelheid; zonder gasten staat hij stil. Een ritje: `stop` tellen
 * stilstaan (uit- en instappen), in `up` tellen op gang komen, `run` tellen draaien en in `down` tellen uitlopen.
 */
export const CAROUSEL = {
  r: 1.36, deck: 0.2, rings: [{ r: 1.05, n: 6, turn: 0 }, { r: 0.52, n: 3, turn: 0.52 }], aisle: 0.79, saddle: 0.8, bob: 0.1, bobs: 3,
  speed: 1.15, stop: 5, up: 1.5, run: 8, down: 2,
};
export const CAROUSEL_SEATS = CAROUSEL.rings.reduce((n, ring) => n + ring.n, 0);
const CAROUSEL_CYCLE = CAROUSEL.stop + CAROUSEL.up + CAROUSEL.run + CAROUSEL.down;

/** De hoek van paard `seat` om het midden (0 = vooraan, oplopend naar rechts), en zijn straal: een gedeeld paar. */
export function carouselAt(seat: number, spin: number): [number, number] {
  // in welke ring het paard staat (k) en het hoeveelste het daar is (i)
  let i = seat % CAROUSEL_SEATS, k = 0;
  while (k + 1 < CAROUSEL.rings.length && i >= CAROUSEL.rings[k].n) i -= CAROUSEL.rings[k++].n;
  const ring = CAROUSEL.rings[k];
  return pair(ring.turn + (i * TAU) / ring.n + spin, ring.r);
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

/** Wie ver moet lopen naar een ritje dat zo begint, zet er de pas in: hooguit zoveel keer zo snel als gewoon. */
const HURRY = 2;
/**
 * Na een ritje stappen de gasten niet allemaal tegelijk af: elk zitje wacht zoveel tellen langer dan het vorige (in
 * groepjes van `OFF_TURNS`). Zo lopen ze achter elkaar aan naar het pad en niet als één kluitje.
 */
const OFF_GAP = 0.28, OFF_TURNS = 5;
const offDelay = (seat: number): number => OFF_GAP * (seat % OFF_TURNS);

/**
 * Hoe lang een gast doet over `len` tegels lopen en gaan zitten als het ritje over `room` tellen begint: gewoon
 * wandelen als dat op tijd is, anders vlugger (tot HURRY keer zo snel). Geeft -1 als hij het ook dan niet haalt: dan
 * wacht hij op het volgende ritje.
 */
function walkInTime(len: number, room: number): number {
  const easy = len / RIDE_WALK + SIT_TIME;
  if (easy <= room) return easy;
  return len / (RIDE_WALK * HURRY) + SIT_TIME <= room ? room : -1;
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
    if (len < least) {
      best = seat;
      least = len;
    }
  }
  if (best < 0) return false;
  v.seat = best;
  // te laat om nog op tijd te zitten: dan het volgende ritje
  v.walk = walkInTime(least, CAROUSEL.stop - c - 0.2);
  if (v.walk < 0) return false;
  v.wait = CAROUSEL.stop - c - v.walk;
  v.ride = CAROUSEL.up + CAROUSEL.run + CAROUSEL.down + offDelay(best);
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
    wayAt(out, (e / (v.walk - SIT_TIME)) * wayLength());
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
 * tegels per tel met een gast erin; zonder gasten kruipen ze op `idle` daarvan. `hit`: vanaf die vaart schudt een
 * klap de auto door elkaar. Een ritje: `stop` tellen stilstaan (uit- en instappen), `run` tellen rijden en `down`
 * tellen uitrollen. `gate`: daar (z) stap je de vloer op.
 */
export const BUMPER = { cars: 6, ax: 1.74, z0: -1.3, z1: 1.02, floor: 0.06, r: 0.24, seat: 0.15, speed: 1.3, idle: 0.28, hit: 0.4, stop: 5.5, run: 11, down: 1.5, gate: 1.16 };
const BUMPER_CYCLE = BUMPER.stop + BUMPER.run + BUMPER.down;

/** De auto's zoals ze er de eerste keer bij staan: in een rij tegen de achterwand. */
export const newCars = (): BumperCar[] =>
  Array.from({ length: BUMPER.cars }, (_, i) => ({ x: ((i + 0.5) / BUMPER.cars - 0.5) * 2 * (BUMPER.ax - 0.3), z: BUMPER.z0 + BUMPER.r + 0.06, dir: 0, vx: 0, vz: 0, bump: 0, turn: 0, away: 0 }));

/**
 * De auto's een stukje verder. `power`: 1 = er staat stroom op, 0 = ze rollen uit. `drivers`: in welke auto's een
 * gast zit (een bit per auto): alleen die rijden echt. Zit er nergens iemand in, dan kruipen ze allemaal rustig rond.
 * Een auto stuurt naar een doel dat om de paar tellen verspringt (soms een andere auto, om tegenaan te botsen);
 * tegen de rand en tegen elkaar stuiteren ze terug, en `bump` springt dan op 1.
 */
export function stepCars(cars: BumperCar[], dt: number, clock: number, power: number, drivers: number): void {
  const idle = drivers === 0, top = BUMPER.speed * (idle ? BUMPER.idle : 1), xr = BUMPER.ax - BUMPER.r, zr0 = BUMPER.z0 + BUMPER.r, zr1 = BUMPER.z1 - BUMPER.r;
  for (let i = 0; i < cars.length; i++) {
    // alleen een auto met een bestuurder rijdt; de lege auto's staan stil (of rollen uit na een botsing)
    const car = cars[i], driven = power > 0 && !idle && (drivers >> i) & 1;
    if (driven) {
      // een nieuw doel om de paar tellen, en meteen na een botsing: meestal ergens op de vloer, soms een andere auto
      const slot = Math.floor(clock / (2.1 + (i % 3) * 0.5) + i * 0.37) + car.turn * 7, pick = hash(i + 1, slot);
      let tx = (hash(slot, i + 11) * 2 - 1) * xr, tz = lerp(zr0, zr1, hash(slot, i + 23));
      if (pick > 0.72 && !idle) {
        const other = cars[(i + 1 + Math.floor(pick * 97) % (cars.length - 1)) % cars.length];
        tx = other.x;
        tz = other.z;
      }
      // vlak na een botsing stuurt hij eerst mee met de terugstuit: zo rijdt hij weg in plaats van er meteen weer tegenaan
      const want = car.away > 0 && Math.hypot(car.vx, car.vz) > 0.1 ? Math.atan2(car.vx, car.vz) : Math.atan2(tx - car.x, tz - car.z);
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
    car.away = Math.max(0, car.away - dt);
    // de rand: terugstuiteren
    if (car.x > xr || car.x < -xr) {
      knock(car, Math.abs(car.vx));
      car.x = Math.max(-xr, Math.min(xr, car.x));
      car.vx *= -0.55;
    }
    if (car.z > zr1 || car.z < zr0) {
      knock(car, Math.abs(car.vz));
      car.z = Math.max(zr0, Math.min(zr1, car.z));
      car.vz *= -0.55;
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
      knock(a, closing);
      knock(b, closing);
    }
  // (een auto die door een ander is weggeduwd, blijft ook binnen de rand)
  for (const car of cars) {
    car.x = Math.max(-xr, Math.min(xr, car.x));
    car.z = Math.max(zr0, Math.min(zr1, car.z));
  }
}

/**
 * Een klap met vaart `speed`: de bestuurder kiest een nieuw doel en rijdt eerst even weg. Is de klap hard genoeg,
 * dan worden auto en bestuurder door elkaar geschud: hoe harder, hoe meer.
 */
function knock(car: BumperCar, speed: number): void {
  if (speed < 0.06) return;
  car.turn++;
  car.away = 0.55;
  // (alleen twee auto's die recht op elkaar af reden, halen de volle klap)
  if (speed > BUMPER.hit) car.bump = Math.max(car.bump, Math.min(1, (speed - BUMPER.hit) / (BUMPER.speed * 1.7 - BUMPER.hit) + 0.15));
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
  wayIn(v, RIDE_SPAN.bumper[0], RIDE_SPAN.bumper[1], 0, BUMPER.gate + 0.3);
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
    if (len < least) {
      best = seat;
      least = len;
    }
  }
  if (best < 0) return false;
  v.seat = best;
  v.walk = walkInTime(least, BUMPER.stop - c - 0.2);
  if (v.walk < 0) return false;
  v.wait = BUMPER.stop - c - v.walk;
  v.ride = BUMPER.run + BUMPER.down + offDelay(best);
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
    wayAt(out, Math.min((e / (v.walk - SIT_TIME)) * wayLength(), beside));
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
/** Zo hoog is de vloer van de uitkijktoren (ook onder deze naam, voor wie hem zo al gebruikte). */
export const TOWER_TOP = TOWER.top;
/** De hoeken van de trap, van onder naar boven: (x, h, z) als deel van `stair` en van `top`. */
const TOWER_TURNS = [[1, 0, 1], [1, 0.25, -1], [-1, 0.5, -1], [-1, 0.75, 1], [1, 1, 1]];

/**
 * De route van het pad naar plek `seat` boven: naar de voet van de trap, vier stukken trap omhoog en over de vloer
 * naar het hek. `lane`: 1 = aan de buitenkant van de trap (omhoog), -1 = aan de binnenkant (omlaag), zodat wie
 * omhoog gaat en wie omlaag komt langs elkaar kunnen.
 */
function towerWay(v: Visit, lane: number): void {
  const s = TOWER.stair * (1 + 0.19 * lane), [sx, sz] = TOWER.spots[v.seat % TOWER.spots.length];
  wayIn(v, RIDE_SPAN.tower[0], RIDE_SPAN.tower[1], s, TOWER.foot + 0.2);
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

/** De route van het pad naar de voet van de trap. */
function slideIn(v: Visit): void {
  wayIn(v, RIDE_SPAN.slide[0], RIDE_SPAN.slide[1], SLIDE.stairX, SLIDE.stairFoot);
}

/** De route van het eind van de glijbaan terug naar het pad. */
function slideOut(v: Visit): void {
  wayFrom(SLIDE.chuteX, 0, SLIDE.chuteEnd + 0.16);
  wayOut(v, RIDE_SPAN.slide[0], RIDE_SPAN.slide[1], SLIDE.chuteX);
}

function slidePlan(v: Visit, s: RideState, used: number): boolean {
  slideIn(v);
  const walk = Math.max(0.3, wayLength() / RIDE_WALK);
  // de vrije beurt die het eerst weer onderaan de trap begint
  let best = -1, least = Infinity;
  for (let slot = 0; slot < SLIDE.slots; slot++) {
    if (used & (1 << slot)) continue;
    const wait = (SLIDE_LAP - slidePhase(slot, s.clock + walk)) % SLIDE_LAP;
    if (wait < least) {
      best = slot;
      least = wait;
    }
  }
  if (best < 0) return false;
  v.seat = best;
  v.walk = walk;
  v.wait = least;
  // het laatste rondje houdt op als het kind van de glijbaan af stapt
  v.ride = SLIDE.laps * SLIDE_LAP - SLIDE.lap[5];
  slideOut(v);
  v.back = Math.max(0.3, wayLength() / RIDE_WALK);
  return true;
}

function slidePose(out: RidePose, v: Visit, e: number): RidePose {
  const start = v.walk + v.wait, leave = start + v.ride;
  if (e < v.walk) {
    slideIn(v);
    wayAt(out, (e / v.walk) * wayLength());
    return out;
  }
  // wachten op je beurt, onderaan de trap
  if (e < start) return put(out, SLIDE.stairX, 0, SLIDE.stairFoot, Math.PI, 'stand');
  if (e < leave) return slideLap(out, (e - start) % SLIDE_LAP);
  slideOut(v);
  out.done = wayAt(out, ((e - leave) / v.back) * wayLength());
  return out;
}

// ------------------------------------------------------------ schommel, wipwap, wipkip en trampoline
/**
 * De schommel (2 bij 1): twee zitjes, `side` links en rechts van het midden, aan touwen van `rope` lang onder een
 * balk op hoogte `top`. `max`: zo ver zwaait een zitje hooguit uit (radialen; het zitje blijft dan net boven zijn
 * eigen tegel en zwaait niet door een hek erachter), `speed`: hoe snel het heen en weer gaat. Een leeg zitje wiegt op
 * `calm` daarvan. `stay`: zo lang schommelt een kind.
 */
export const SWINGSET = { seats: 2, side: 0.42, top: 1.62, rope: 1.18, max: 0.44, speed: 2.5, calm: 0.1, stay: 7 };
/** De wipwap (2 bij 1): een plank om een as op hoogte `pivot`, met een zitje op `side` van het midden; hij kantelt hooguit `max` radialen. */
export const SEESAW = { seats: 2, pivot: 0.46, side: 0.68, lift: 0.07, max: 0.28, speed: 3, calm: 0.12, stay: 7 };
/** De wipkip (1 bij 1): een dier op een veer. Het wipt om het punt `pivot` hoog, het zadel zit op `seat`; `max` is hoe ver het wipt. */
export const SPRINGER = { seats: 1, pivot: 0.14, seat: 0.5, max: 0.3, speed: 6, calm: 0.12, stay: 6 };
/**
 * De trampoline (2 bij 2): het doek ligt op hoogte `mat` en is `r` groot, met een rand eromheen tot `frame`; de
 * springers staan op `ring` van het midden. `jump`: zo hoog springen ze, `speed`: hoe snel (een sprong duurt pi
 * gedeeld door `speed` tellen). Vooraan staat een trapje, `step` voor de rand: daarlangs klim je erop en eraf.
 * `land`: zoveel tellen voor het eind springt een kind steeds lager, zodat het netjes op het doek staat als het gaat.
 */
export const TRAMPOLINE = { seats: 3, mat: 0.44, r: 0.66, frame: 0.82, ring: 0.28, jump: 0.55, speed: 4.4, stay: 6.5, step: 0.16, land: 0.5 };

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

/** Hoe ver de wipkip nu voorover (+) of achterover wipt, en hoe ver opzij: [voorover, opzij] in radialen, als gedeeld paar. */
export function springerTilt(s: RideState): [number, number] {
  const a = s.amps[0] ?? SPRINGER.calm;
  return pair(SPRINGER.max * a * Math.sin(s.spin), SPRINGER.max * 0.35 * a * Math.sin(s.spin * 0.5 + 1));
}

export function springerSeat(out: RidePose, s: RideState): RidePose {
  const [pitch, roll] = springerTilt(s), d = SPRINGER.seat - SPRINGER.pivot;
  put(out, -d * Math.sin(roll), SPRINGER.pivot + d * Math.cos(pitch) * Math.cos(roll), d * Math.sin(pitch), 0, 'sit');
  out.pitch = pitch;
  out.roll = roll;
  out.on = true;
  return out;
}

/** Hoe hoog springer `seat` nu boven het doek is (0 = op het doek, 1 = bovenin), en de hoeveelste sprong het is: een gedeeld paar. */
export function trampolineJump(seat: number, s: RideState): [number, number] {
  const f = (s.spin + seat * 2.1) / Math.PI;
  return pair(Math.abs(Math.sin(f * Math.PI)) * (s.amps[seat] ?? 0), Math.floor(f));
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

/** De route van het pad naar de plek van springer `seat`: het trapje op en over het doek. */
function trampolineWay(v: Visit): void {
  const a = (v.seat * TAU) / TRAMPOLINE.seats + 0.5;
  wayIn(v, RIDE_SPAN.trampoline[0], RIDE_SPAN.trampoline[1], 0, TRAMPOLINE.frame + TRAMPOLINE.step);
  wayTo(0, TRAMPOLINE.mat, TRAMPOLINE.frame - 0.1);
  wayTo(Math.sin(a) * TRAMPOLINE.ring, TRAMPOLINE.mat, Math.cos(a) * TRAMPOLINE.ring);
}

function trampolinePlan(v: Visit, used: number): boolean {
  if (!freeSeat(v, used, TRAMPOLINE.seats)) return false;
  trampolineWay(v);
  v.walk = v.back = wayLength() / RIDE_WALK;
  v.wait = 0;
  v.ride = TRAMPOLINE.stay;
  return true;
}

function trampolinePose(out: RidePose, v: Visit, s: RideState, e: number): RidePose {
  const leave = v.walk + v.ride;
  if (e >= v.walk && e < leave) {
    trampolineSeat(out, v.seat, s);
    // het begin en het eind: van de looprichting naar het springen draaien, en aan het eind steeds lager springen
    const k = ease(Math.min((e - v.walk) / TRAMPOLINE.land, (leave - e) / TRAMPOLINE.land));
    if (k < 1) {
      const a = (v.seat * TAU) / TRAMPOLINE.seats + 0.5, came = Math.atan2(Math.sin(a) * TRAMPOLINE.ring, Math.cos(a) * TRAMPOLINE.ring - TRAMPOLINE.frame + 0.1);
      const walk = e - v.walk < TRAMPOLINE.land ? came : came + Math.PI, rest = TRAMPOLINE.mat - trampolineDip(s);
      out.face = walk + turnTo(walk, out.face) * k;
      out.h = rest + (out.h - rest) * k;
      out.u *= k;
      out.w *= k;
    }
    return out;
  }
  trampolineWay(v);
  if (e < v.walk) {
    wayAt(out, e * RIDE_WALK);
    return out;
  }
  out.done = wayAt(out, (e - leave) * RIDE_WALK, true);
  return out;
}

/** Waar een kind op zo'n toestel zit of springt. */
function playSeat(out: RidePose, kind: RideKind, seat: number, s: RideState): RidePose {
  if (kind === 'swing') return swingSeat(out, seat, s);
  if (kind === 'seesaw') return seesawSeat(out, seat, s);
  if (kind === 'springer') return springerSeat(out, s);
  return trampolineSeat(out, seat, s);
}

const PLAY_SEATS = { swing: SWINGSET.seats, seesaw: SEESAW.seats, springer: SPRINGER.seats };
const PLAY_STAY = { swing: SWINGSET.stay, seesaw: SEESAW.stay, springer: SPRINGER.stay };

/** Naast het zitje: daar staat het kind voor het erop klimt (het zitje in rust, een stapje naar voren). */
function playSide(out: RidePose, kind: RideKind, seat: number): void {
  const side = seat % 2 ? 1 : -1;
  if (kind === 'swing') put(out, side * SWINGSET.side, 0, 0.3, Math.PI, 'stand');
  else if (kind === 'seesaw') put(out, side * SEESAW.side, 0, 0.3, Math.PI, 'stand');
  else put(out, 0.28, 0, 0.12, -Math.PI / 2, 'stand');
}

function playPlan(v: Visit, used: number): boolean {
  const kind = v.kind as keyof typeof PLAY_SEATS;
  if (!freeSeat(v, used, PLAY_SEATS[kind])) return false;
  playSide(SCRATCH, kind, v.seat);
  v.walk = v.back = Math.max(0.3, Math.hypot(SCRATCH.x - v.fx, SCRATCH.z - v.fz) / RIDE_WALK) + SIT_TIME;
  v.wait = 0;
  v.ride = PLAY_STAY[kind];
  return true;
}

/** Een bezoek aan de schommel, de wipwap of de wipkip: naar het zitje lopen, erop, en na een poosje er weer af en terug. */
function playPose(out: RidePose, v: Visit, s: RideState, e: number): RidePose {
  const leave = v.walk + v.ride, span = v.walk - SIT_TIME;
  if (e >= v.walk && e < leave) return playSeat(out, v.kind, v.seat, s);
  playSide(out, v.kind, v.seat);
  const sx = out.x, sz = out.z, sf = out.face;
  if (e >= span && e < leave + SIT_TIME) {
    // erop klimmen of er weer af: van naast het zitje erop, of andersom
    playSeat(out, v.kind, v.seat, s);
    hopOn(out, sx, 0, sz, sf, e < v.walk ? (e - span) / SIT_TIME : 1 - (e - leave) / SIT_TIME);
    out.on = false;
    return out;
  }
  // van het pad naar het zitje lopen, of terug
  const t = e < span ? e / span : 1 - (e - leave - SIT_TIME) / span;
  put(out, lerp(v.fx, sx, clamp01(t)), 0, lerp(v.fz, sz, clamp01(t)), e < span ? Math.atan2(sx - v.fx, sz - v.fz) : Math.atan2(v.fx - sx, v.fz - sz), 'walk');
  out.done = e >= leave && t <= 0;
  return out;
}

// ------------------------------------------------------------ het klimkasteel (10 bij 3)
/**
 * Het klimkasteel: een groot klimtoestel voor de kleintjes, een parcours van links naar rechts over vier torentjes
 * (`towers`: midden x, hoogte van de vloer en halve breedte; ze staan allemaal op `z` iets achter het midden). Een
 * kind klimt de ladder op (vooraan bij toren 1, voet op `ladderFoot`), loopt over de wiebelbrug (die `sag` doorhangt)
 * naar toren 2, kruipt door de tunnel naar de grote toren 3, kijkt daar `stay` tellen rond of draait aan het stuurwiel
 * (`spots`), loopt over de evenwichtsbalk naar toren 4 en gaat de glijbaan af (van `slideTop` tot `slideEnd`, onderaan
 * `endH` hoog). Daarna loopt het vooraan terug naar het pad. `seats`: zoveel kinderen tegelijk. `climb`, `crawl`,
 * `beam`, `bridge`: zo snel gaat het op de ladder, in de tunnel, op de balk en op de brug (tegels per tel); `sit`,
 * `glide` en `rise` zijn de tellen voor gaan zitten, glijden en opstaan. `speed`: zo snel wiegen de brug en de vlag.
 * `gap`: zoveel tellen na elkaar beginnen twee kinderen aan de ladder; wie moet wachten staat in de rij, `queue`
 * tegels achter de vorige (hooguit `queueMax` van de ladder).
 */
export const CLIMBER = {
  seats: 10, z: -0.1,
  towers: [[-3.9, 0.8, 0.4], [-1.6, 1.1, 0.4], [0.9, 1.3, 0.48], [3.0, 1.0, 0.4]] as [number, number, number][],
  ladderFoot: 0.95, sag: 0.12, tube: 0.24,
  spots: [[0.68, 0.22], [1.12, 0.22], [0.62, -0.38], [1.18, -0.38], [0.9, -0.08]] as [number, number][],
  slideTop: 3.42, slideBend: 4.35, slideEnd: 4.78, bendH: 0.3, endH: 0.2,
  stay: 3.5, climb: 0.7, crawl: 0.55, beam: 0.6, bridge: 0.85, sit: 0.3, glide: 1.1, rise: 0.45, speed: 1.6,
  gap: 1.6, queue: 0.34, queueMax: 3.2,
};
/** Wat een kind op het klimkasteel doet, als `w` in zijn houding (people.ts kijkt ernaar): op de balk, in de tunnel of op de brug. */
export const CLIMB_DO = { beam: 1, crawl: 2, bridge: 3 } as const;

/** Hoe hoog de glijbaan van het klimkasteel is op plek `x`: schuin van toren 4 tot de knik, en dan bijna vlak tot het eind. */
export function climberChute(x: number): number {
  const C = CLIMBER, top = C.towers[3][1];
  if (x <= C.slideTop) return top;
  if (x <= C.slideBend) return lerp(top, C.bendH, (x - C.slideTop) / (C.slideBend - C.slideTop));
  return lerp(C.bendH, C.endH, clamp01((x - C.slideBend) / (C.slideEnd - C.slideBend)));
}

/** Hoe hoog de wiebelbrug is op deel `t` (0 = bij toren 1, 1 = bij toren 2): hij loopt iets op en hangt in het midden door. */
export const climberBridge = (t: number): number => lerp(CLIMBER.towers[0][1], CLIMBER.towers[1][1], t) - CLIMBER.sag * Math.sin(Math.PI * t);

// Het parcours als rijtje stukken, net als WAY steeds opnieuw gevuld (er wordt tijdens het spelen niets aangemaakt).
// Per stuk: waar het naartoe gaat (x, h, z), de houding (een nummer in CLIMB_ACTS), hoe lang het duurt, wat het
// kind erbij doet (CLIMB_DO, of 0) en de kijkrichting (NaN: de looprichting). Het eerste stuk heeft alleen een beginpunt.
const CLIMB_ACTS: RideAct[] = ['walk', 'climb', 'sit', 'slide', 'stand'];
const LEG = 7;
/** Als `what` bij een stuk glijden: een rechte glijbaan (de hoogte loopt gewoon mee), niet die van het klimkasteel. */
const SLIDE_FREE = 9;
const LEGS: number[] = [];
let legN = 0;

function legFrom(x: number, h: number, z: number): void {
  legN = 0;
  legTo(x, h, z, 0, 0, 0);
}

/** Een stuk erbij naar (x, h, z): `speed` tegels per tel, of met een negatieve `speed` precies zoveel tellen. */
function legTo(x: number, h: number, z: number, act: number, speed: number, act2: number, face = NaN): void {
  const i = legN * LEG;
  let secs = 0;
  if (legN > 0) {
    const len = Math.hypot(x - LEGS[i - LEG], h - LEGS[i - LEG + 1], z - LEGS[i - LEG + 2]);
    secs = speed < 0 ? -speed : len / speed;
  }
  LEGS[i] = x;
  LEGS[i + 1] = h;
  LEGS[i + 2] = z;
  LEGS[i + 3] = act;
  LEGS[i + 4] = secs;
  LEGS[i + 5] = act2;
  LEGS[i + 6] = face;
  legN++;
}

/** De punten van de route in WAY als gewone stukken lopen (het eerste punt slaat hij over: daar staat het kind al). */
function legsFromWay(): void {
  for (let k = 1; k < wayN; k++) legTo(WAY[k * 3], WAY[k * 3 + 1], WAY[k * 3 + 2], 0, RIDE_WALK, 0);
}

/** Hoe lang alle stukken samen duren. */
function legsTime(): number {
  let t = 0;
  for (let k = 1; k < legN; k++) t += LEGS[k * LEG + 4];
  return t;
}

/** Zet `out` op `t` tellen langs de stukken. Geeft true als het eind bereikt is. */
function legsAt(out: RidePose, t: number): boolean {
  let left = Math.max(0, t);
  for (let k = 1; k < legN; k++) {
    const i = k * LEG, secs = LEGS[i + 4];
    if (left > secs && k + 1 < legN) {
      left -= secs;
      continue;
    }
    const u = secs > 1e-6 ? Math.min(1, left / secs) : 1, act = CLIMB_ACTS[LEGS[i + 3]], what = LEGS[i + 5];
    const x0 = LEGS[i - LEG], h0 = LEGS[i - LEG + 1], z0 = LEGS[i - LEG + 2], dx = LEGS[i] - x0, dz = LEGS[i + 2] - z0;
    const set = LEGS[i + 6], face = !Number.isNaN(set) ? set : Math.hypot(dx, dz) > 1e-6 ? Math.atan2(dx, dz) : out.face;
    if (act === 'slide' && what !== SLIDE_FREE) {
      // de glijbaan af: steeds sneller, achterover en de armen in de lucht
      const x = lerp(x0, LEGS[i], Math.pow(u, 1.6));
      put(out, x, climberChute(x) + 0.03, LEGS[i + 2], Math.PI / 2, 'slide');
      out.pitch = x < CLIMBER.slideBend ? -0.3 : -0.3 * (1 - (x - CLIMBER.slideBend) / (CLIMBER.slideEnd - CLIMBER.slideBend));
      out.u = u;
    } else {
      put(out, lerp(x0, LEGS[i], u), lerp(h0, LEGS[i + 1], u), lerp(z0, LEGS[i + 2], u), face, act);
      if (act === 'slide') out.pitch = -0.3 * (1 - u * u);
      // gaan zitten boven aan de glijbaan, en onderaan weer opstaan
      // (ging het vorige stuk al zittend, zoals aan de kabel van de tokkelbaan, dan blijft het kind gewoon zitten)
      if (act === 'sit') out.sit = k > 1 && CLIMB_ACTS[LEGS[i - LEG + 3]] === 'sit' ? 1 : ease(u);
      if (act === 'stand') out.sit = 1 - ease(u / 0.7);
      // in de tunnel kruipt het kind voorover op handen en knieën
      if (what === CLIMB_DO.crawl) out.pitch = 1.15;
    }
    out.w = what === SLIDE_FREE ? 0 : what;
    return left >= secs;
  }
  put(out, LEGS[0], LEGS[1], LEGS[2], out.face, 'stand');
  return true;
}

/** Het plekje van kind `seat` boven op de grote toren: er zijn er vijf, en wie later komt staat een stapje opzij. */
function climbSpot(seat: number): [number, number] {
  const [sx, sz] = CLIMBER.spots[seat % CLIMBER.spots.length];
  return pair(sx + (seat >= CLIMBER.spots.length ? 0.1 : 0), sz);
}

/** Een eigen baantje per kind, een klein stukje opzij: zo lopen ze niet precies door elkaar heen. */
const climbLane = (seat: number): number => ((seat % 3) - 1) * 0.06;

/** Van het pad naar zijn plek in de rij vooraan: `v.q` tegels rechts van de voet van de ladder (0 = meteen bij de ladder). */
function climberWalk(v: Visit): void {
  wayIn(v, RIDE_SPAN.climber[0], RIDE_SPAN.climber[1], CLIMBER.towers[0][0] + (v.q ?? 0), CLIMBER.ladderFoot);
  legFrom(v.fx, 0, v.fz);
  legsFromWay();
}

/** Het parcours tot de grote toren: de ladder op, over de brug, door de tunnel en naar zijn plekje op toren 3. */
function climberUp(v: Visit): void {
  const C = CLIMBER, [t1, t2, t3] = C.towers, z = C.z + climbLane(v.seat), [sx, sz] = climbSpot(v.seat);
  legFrom(t1[0], 0, C.ladderFoot);
  // de ladder op en de vloer van toren 1 over
  legTo(t1[0], t1[1], t1[2] * 0.75, 1, C.climb, 0);
  legTo(t1[0], t1[1], z, 0, RIDE_WALK, 0);
  legTo(t1[0] + t1[2], t1[1], z, 0, RIDE_WALK, 0);
  // de wiebelbrug: in stukjes, want hij hangt door
  const x0 = t1[0] + t1[2], x1 = t2[0] - t2[2];
  for (let k = 1; k <= 6; k++) legTo(lerp(x0, x1, k / 6), climberBridge(k / 6), z, 0, C.bridge, CLIMB_DO.bridge);
  legTo(t2[0] + t2[2] * 0.6, t2[1], z, 0, RIDE_WALK, 0);
  // door de tunnel kruipen, licht omhoog naar de grote toren
  legTo(t3[0] - t3[2] + 0.05, t3[1], C.z, 1, C.crawl, CLIMB_DO.crawl);
  legTo(sx, t3[1], sz, 0, RIDE_WALK, 0);
}

/** Het tweede stuk: van zijn plekje over de balk naar toren 4, de glijbaan af en vooraan terug naar het pad. */
function climberOut(v: Visit): void {
  const C = CLIMBER, [, , t3, t4] = C.towers, z = C.z + climbLane(v.seat) * 0.5, [sx, sz] = climbSpot(v.seat);
  legFrom(sx, t3[1], sz);
  legTo(t3[0] + t3[2] - 0.05, t3[1], z, 0, RIDE_WALK, 0);
  // de evenwichtsbalk: voorzichtig, met de armen opzij
  legTo(t4[0] - t4[2], t4[1], z, 0, C.beam, CLIMB_DO.beam);
  legTo(C.slideTop - 0.04, t4[1], C.z, 0, RIDE_WALK, 0);
  legTo(C.slideTop, t4[1] + 0.03, C.z, 2, -C.sit, 0, Math.PI / 2);
  legTo(C.slideEnd - 0.06, C.endH + 0.03, C.z, 3, -C.glide, 0);
  legTo(C.slideEnd + 0.06, 0, C.z, 4, -C.rise, 0, Math.PI / 2);
  // vooraan terug, en zo nodig buitenom naar het pad
  const fx = C.slideEnd - 0.2, fz = RIDE_SPAN.climber[1] / 2 - 0.3;
  legTo(fx, 0, fz, 0, RIDE_WALK, 0);
  wayFrom(fx, 0, fz);
  wayOut(v, RIDE_SPAN.climber[0], RIDE_SPAN.climber[1], fx);
  legsFromWay();
}

/**
 * Een kind wil op het klimkasteel. De kinderen beginnen om de beurt aan de ladder, `gap` tellen na elkaar
 * (`s.zero` is wanneer de volgende mag): wie moet wachten, gaat vooraan in de rij staan, rechts van de ladder, en
 * schuift op tot het aan de beurt is. Zo staan er nooit twee op dezelfde sport en lopen ze netjes achter elkaar het
 * parcours af. In het bezoek: `walk` is naar de rij lopen, `wait` het opschuiven plus het parcours tot de grote
 * toren, `ride` het rondkijken boven en `back` de rest, met de glijbaan, tot op het pad.
 */
function climberPlan(v: Visit, s: RideState, used: number): boolean {
  const C = CLIMBER;
  if (!freeSeat(v, used, C.seats)) return false;
  v.q = 0;
  climberWalk(v);
  const need = Math.max(0, s.zero - (s.clock + legsTime()));
  v.q = Math.min(C.queueMax, (C.queue * need) / C.gap);
  climberWalk(v);
  v.walk = legsTime();
  const line = Math.max(0, s.zero - (s.clock + v.walk), v.q / RIDE_WALK);
  climberUp(v);
  v.wait = line + legsTime();
  v.ride = C.stay;
  climberOut(v);
  v.back = legsTime();
  s.zero = s.clock + v.walk + line + C.gap;
  return true;
}

/** Waar kind `seat` staat als het boven op de grote toren rondkijkt. */
function climberSpot(out: RidePose, seat: number): RidePose {
  const [sx, sz] = climbSpot(seat);
  // naar voren kijken, naar het pad: daar staan de mensen naar wie je zwaait
  put(out, sx, CLIMBER.towers[2][1], sz, Math.atan2(sx - CLIMBER.towers[2][0], sz - CLIMBER.z + 1.2), 'stand');
  out.on = true;
  return out;
}

function climberPose(out: RidePose, v: Visit, e: number): RidePose {
  const C = CLIMBER, top = v.walk + v.wait, leave = top + v.ride;
  if (e >= top && e < leave) return climberSpot(out, v.seat);
  if (e < v.walk) {
    climberWalk(v);
    legsAt(out, e);
    return out;
  }
  if (e < top) {
    climberUp(v);
    const line = v.wait - legsTime(), q = v.q ?? 0;
    if (e < v.walk + line) {
      // in de rij: langzaam opschuiven naar de ladder, met het gezicht ernaartoe
      const k = (e - v.walk) / line;
      put(out, C.towers[0][0] + q * (1 - k), 0, C.ladderFoot, -Math.PI / 2, q / line > 0.12 ? 'walk' : 'stand');
      return out;
    }
    legsAt(out, e - v.walk - line);
    out.on = true;
    return out;
  }
  climberOut(v);
  out.done = legsAt(out, e - leave);
  // tot het opstaan onderaan de glijbaan is het kind op het toestel; daarna loopt het terug naar het pad
  out.on = out.h > 0.02 || out.act !== 'walk';
  return out;
}

// ------------------------------------------------------------ de grote speeltuin: negen toestellen met een plekje
// Zandbak, waterspeeltuin, tokkelbaan, springkussen, piratenschip, draaimolentje, nestschommel, ballenbak en
// kruipheuvel. Ze werken allemaal hetzelfde (zie PLAYS): het kind loopt naar zijn plekje (`to`, een rijtje stukken
// zoals bij het klimkasteel), speelt daar een poosje (`spot`, dat beweegt met de stand van het toestel), en loopt
// daarna terug naar het pad (`from`). Op en van zijn plekje gaat het met een hupje (hopOn), omdat het plekje zelf
// kan bewegen (het draaimolentje draait, de nestschommel zwaait).

/** Hoe lang het hupje op en van het plekje duurt. */
const PLAY_HOP = 0.55;

/**
 * Eén speeltoestel met plekjes. `seats`: zoveel kinderen tegelijk; `stay`: zo lang speelt elk kind op zijn plekje.
 * `gap`: alleen bij de tokkelbaan: zoveel tellen na elkaar mogen kinderen beginnen (er hangt er maar één aan de kabel).
 */
interface PlayKit {
  seats: number;
  stay: number;
  gap?: number;
  to(v: Visit): void;
  from(v: Visit): void;
  spot(out: RidePose, seat: number, s: RideState): RidePose;
}

/** Van het pad naar (x, 0, z) vooraan op het toestel, en de stukken daarna beginnen daar. */
function playWalkIn(v: Visit, x: number, z: number): void {
  const [w, d] = RIDE_SPAN[v.kind];
  wayIn(v, w, d, x, z);
  legFrom(v.fx, 0, v.fz);
  legsFromWay();
}

/** Van (x, 0, z) vooraan op het toestel terug naar het pad (de stukken lopen al tot daar). */
function playWalkOut(v: Visit, x: number, z: number): void {
  const [w, d] = RIDE_SPAN[v.kind];
  wayFrom(x, 0, z);
  wayOut(v, w, d, x);
  legsFromWay();
}

/** Een golfje van 0 naar 1 en terug, `n` keer per tel, voor zitje `seat` een eigen stukje verschoven. */
const wave01 = (t: number, n: number, seat: number): number => 0.5 - 0.5 * Math.cos((t * n + seat * 0.37) * TAU);

// --- de zandbak (2 bij 2): een houten rand, zand, en een kleine graafmachine waar een kind op zit
/**
 * `rim`: zo ver uit het midden ligt de rand (en `edge` zo hoog), `sand`: zo hoog ligt het zand. `spots`: waar de
 * kinderen in het zand zitten te scheppen (het laatste zitje is de graafmachine op `digger`, zitting `seatH` hoog).
 */
export const SANDBOX = {
  rim: 0.82, edge: 0.16, sand: 0.07, seatH: 0.3, stay: 8, speed: 2.2,
  spots: [[-0.42, -0.38], [0.36, -0.44], [-0.46, 0.3]] as [number, number][], digger: [0.4, 0.28] as [number, number],
};
const sandSpot = (seat: number): [number, number] => (seat < SANDBOX.spots.length ? SANDBOX.spots[seat] : SANDBOX.digger);
const SANDBOX_KIT: PlayKit = {
  seats: SANDBOX.spots.length + 1,
  stay: SANDBOX.stay,
  to(v) {
    const [sx, sz] = sandSpot(v.seat);
    playWalkIn(v, sx * 0.6, SANDBOX.rim + 0.2);
    legTo(sx * 0.6, SANDBOX.edge, SANDBOX.rim, 0, RIDE_WALK, 0);
    legTo(sx * 0.6, SANDBOX.sand, SANDBOX.rim - 0.18, 0, RIDE_WALK, 0);
    legTo(sx, SANDBOX.sand, sz + 0.12, 0, RIDE_WALK, 0);
  },
  from(v) {
    const [sx, sz] = sandSpot(v.seat);
    legFrom(sx, SANDBOX.sand, sz + 0.12);
    legTo(sx * 0.6, SANDBOX.sand, SANDBOX.rim - 0.18, 0, RIDE_WALK, 0);
    legTo(sx * 0.6, SANDBOX.edge, SANDBOX.rim, 0, RIDE_WALK, 0);
    legTo(sx * 0.6, 0, SANDBOX.rim + 0.2, 0, RIDE_WALK, 0);
    playWalkOut(v, sx * 0.6, SANDBOX.rim + 0.2);
  },
  spot(out, seat, s) {
    const [sx, sz] = sandSpot(seat);
    if (seat >= SANDBOX.spots.length) {
      // op de graafmachine: met het gezicht naar de schep, de handen aan de hendels
      put(out, sx, SANDBOX.seatH, sz, -Math.PI / 2, 'sit');
      out.u = s.amp * wave01(s.clock, 0.35, 0);
    } else {
      // in het zand: zitten, met het gezicht naar het midden, en scheppen
      put(out, sx, SANDBOX.sand + 0.02, sz, Math.atan2(-sx, -sz), 'sit');
      out.u = wave01(s.clock, 0.8, seat);
    }
    out.on = true;
    return out;
  },
};

// --- de waterspeeltuin (3 bij 2): een pomp, een goot en fonteintjes uit de grond waar de kinderen doorheen springen
/**
 * `pump`: waar de pomp staat (x, z) en `pumper` waar het kind staat dat pompt. `jets`: de fonteintjes in de grond,
 * waar de andere kinderen van de een naar de ander springen: elke `hop` tellen een sprong van `leap` hoog.
 */
export const SPLASH = {
  pump: [-1.1, -0.55] as [number, number], pumper: [-0.82, -0.3] as [number, number], stay: 9, hop: 1.5, leap: 0.24, speed: 3,
  jets: [[-0.25, 0.15], [0.35, -0.3], [0.95, 0.25], [0.3, 0.55], [1.05, -0.45], [-0.45, 0.6]] as [number, number][],
};
/** Waar kind `seat` in de waterspeeltuin is: bij de pomp, of springend van fonteintje naar fonteintje. */
function splashAt(out: RidePose, seat: number, s: RideState): RidePose {
  if (seat === 0) {
    const [px, pz] = SPLASH.pump, [sx, sz] = SPLASH.pumper;
    put(out, sx, 0.02, sz, Math.atan2(px - sx, pz - sz), 'stand');
    out.u = wave01(s.clock, 0.9, 0);
    out.on = true;
    return out;
  }
  const J = SPLASH.jets, t = s.clock / SPLASH.hop + seat * 1.7, i = Math.floor(t), k = t - i;
  const [ax, az] = J[(i + seat) % J.length], [bx, bz] = J[(i + seat + 1) % J.length];
  // het grootste deel van de tijd staat het kind in het water te spetteren; daarna springt het naar het volgende fonteintje
  const jump = clamp01((k - 0.55) / 0.45);
  put(out, lerp(ax, bx, ease(jump)), 0.02 + SPLASH.leap * Math.sin(Math.PI * jump), lerp(az, bz, ease(jump)), Math.atan2(bx - ax, bz - az), jump > 0 ? 'jump' : 'stand');
  out.u = jump > 0 ? Math.sin(Math.PI * jump) : 0;
  out.w = jump > 0 ? 0 : 1;
  out.on = true;
  return out;
}
const SPLASH_KIT: PlayKit = {
  seats: SPLASH.jets.length,
  stay: SPLASH.stay,
  to(v) {
    playWalkIn(v, -0.2, 0.92);
    legTo(-0.2, 0.02, 0.72, 0, RIDE_WALK, 0);
  },
  from(v) {
    legFrom(-0.2, 0.02, 0.72);
    legTo(-0.2, 0, 0.92, 0, RIDE_WALK, 0);
    playWalkOut(v, -0.2, 0.92);
  },
  spot: splashAt,
};

// --- de tokkelbaan (6 bij 2): een torentje met een ladder, een kabel en een zachte mat aan het eind
/**
 * Het torentje staat op `x0` (vloer `deck` hoog), de kabel loopt van `top0` daarboven naar `top1` bij de paal op
 * `x1` en hangt `sag` door. Het zitje hangt `rope` onder de kabel. Een kind zit eerst klaar op het zitje (`stay`),
 * zoeft dan in `zip` tellen naar `end` en laat zich op de mat vallen. Er hangt er maar één tegelijk aan (`gap`).
 */
export const ZIPLINE = { x0: -2.35, x1: 2.75, z: -0.35, deck: 1.1, top0: 2.05, top1: 1.75, sag: 0.4, rope: 0.95, ladderFoot: 0.7, end: 2.15, stay: 2.4, zip: 2.6, speed: 2 };
/** Hoe hoog de kabel is op plek `x`. */
export function zipCable(x: number): number {
  const Z = ZIPLINE, t = clamp01((x - Z.x0) / (Z.x1 - Z.x0));
  return lerp(Z.top0, Z.top1, t) - Z.sag * Math.sin(Math.PI * t);
}
/** Waar het zitje klaar hangt, bij het torentje. */
export const ZIP_START = ZIPLINE.x0 + 0.3;
const ZIPLINE_KIT: PlayKit = {
  seats: 2,
  stay: ZIPLINE.stay,
  gap: ZIPLINE.stay + 0.4,
  to(v) {
    const Z = ZIPLINE;
    playWalkIn(v, Z.x0, Z.ladderFoot);
    legTo(Z.x0, Z.deck, Z.z + 0.32, 1, 0.7, 0);
    // wie moet wachten, wacht achter op het torentje
    legTo(Z.x0 - 0.15, Z.deck, Z.z - 0.05, 0, RIDE_WALK, 0);
  },
  from(v) {
    const Z = ZIPLINE, n = 8;
    legFrom(ZIP_START, Z.deck, Z.z);
    // zoeven: eerst rustig, dan steeds harder, en aan het eind remt het zitje af tegen de veer
    for (let i = 1; i <= n; i++) {
      const k = i / n, x = lerp(ZIP_START, Z.end, k * k * (3 - 2 * k) * 0.35 + k * 0.65);
      legTo(x, zipCable(x) - Z.rope, Z.z, 2, -Z.zip / n, 0, Math.PI / 2);
    }
    // loslaten en op de mat landen, en weer opstaan
    legTo(Z.end + 0.12, 0, Z.z, 4, -0.5, 0, Math.PI / 2);
    legTo(Z.end, 0, 0.75, 0, RIDE_WALK, 0);
    playWalkOut(v, Z.end, 0.75);
  },
  spot(out, seat, s) {
    // klaar op het zitje, met de handen aan het touw en bungelende benen
    put(out, ZIP_START, ZIPLINE.deck, ZIPLINE.z, Math.PI / 2, 'sit');
    out.u = wave01(s.clock, 1.2, seat);
    out.on = true;
    return out;
  },
};

// --- het springkussen (3 bij 3): een opgeblazen kasteel met torens, waar vijf kinderen op springen
/** `floor`: zo hoog is de bovenkant van het kussen; `front` (z): daar stap je erop; `jump`: zo hoog springen ze, `speed` hoe snel. */
export const BOUNCY = {
  floor: 0.3, front: 1.0, jump: 0.42, speed: 4.2, stay: 7,
  spots: [[-0.6, -0.45], [0.55, -0.5], [0, -0.05], [-0.55, 0.42], [0.6, 0.38]] as [number, number][],
};
/** Hoe hoog kind `seat` nu boven het kussen springt (0 tot 1). Een gedeeld getal: elk kind springt in zijn eigen tempo. */
export const bouncyJump = (seat: number, s: RideState): number => Math.abs(Math.sin(s.clock * BOUNCY.speed * (0.9 + 0.05 * seat) + seat * 1.3));
/** Hoe ver het kussen nu inveert, door de kinderen erop. */
export const bouncyDip = (s: RideState): number => 0.04 * s.amp * (0.6 + 0.4 * Math.sin(s.spin * 2));
const BOUNCY_KIT: PlayKit = {
  seats: BOUNCY.spots.length,
  stay: BOUNCY.stay,
  to(v) {
    const [sx, sz] = BOUNCY.spots[v.seat];
    playWalkIn(v, sx * 0.4, BOUNCY.front + 0.35);
    legTo(sx * 0.4, BOUNCY.floor, BOUNCY.front, 0, RIDE_WALK, 0);
    legTo(sx, BOUNCY.floor, sz, 0, RIDE_WALK * 0.8, 0);
  },
  from(v) {
    const [sx, sz] = BOUNCY.spots[v.seat];
    legFrom(sx, BOUNCY.floor, sz);
    legTo(sx * 0.4, BOUNCY.floor, BOUNCY.front, 0, RIDE_WALK * 0.8, 0);
    legTo(sx * 0.4, 0, BOUNCY.front + 0.35, 0, RIDE_WALK, 0);
    playWalkOut(v, sx * 0.4, BOUNCY.front + 0.35);
  },
  spot(out, seat, s) {
    const [sx, sz] = BOUNCY.spots[seat], j = bouncyJump(seat, s);
    put(out, sx, BOUNCY.floor - bouncyDip(s) + BOUNCY.jump * j * s.amp, sz, Math.atan2(-sx, 1.5 - sz) + Math.sin(s.clock * 0.7 + seat) * 0.6, 'jump');
    out.u = j * s.amp;
    out.on = true;
    return out;
  },
};

// --- het piratenschip (4 bij 3): een schip om in te klimmen, met een mast, een kraaiennest en een glijbaan
/**
 * Het dek ligt `deck` hoog; de loopplank loopt vooraan van `plank` (x) omhoog. De mast staat op `mast` (x, z) met
 * het kraaiennest op `nest` hoogte. De plekjes (`spots`, x, z, kijkrichting): het stuurwiel, het kraaiennest (hoog),
 * de boeg met de verrekijker, de reling vooraan en een kanon. Van het dek glij je vooraan naar beneden (`slideX`).
 */
export const PIRATE = {
  deck: 0.6, plank: -0.75, mast: [0.15, -0.25] as [number, number], nest: 1.65, slideX: 1.2, slideEnd: 1.2, stay: 8, speed: 1.4,
  spots: [[-1.35, -0.25, Math.PI / 2], [0.15, -0.25, Math.PI / 2], [1.05, -0.25, Math.PI / 2], [-0.2, 0.32, 0], [0.75, 0.3, 0.2], [-0.6, -0.62, Math.PI]] as [number, number, number][],
};
/** Het kraaiennest is plekje 1: daar klim je langs de mast naartoe. */
const PIRATE_NEST = 1;
const pirateH = (seat: number): number => (seat === PIRATE_NEST ? PIRATE.nest : PIRATE.deck);
const PIRATE_KIT: PlayKit = {
  seats: PIRATE.spots.length,
  stay: PIRATE.stay,
  to(v) {
    const P = PIRATE, [sx, sz] = P.spots[v.seat];
    playWalkIn(v, P.plank, 1.35);
    legTo(P.plank, P.deck, 0.45, 0, RIDE_WALK * 0.8, 0);
    if (v.seat === PIRATE_NEST) {
      // de touwladder langs de mast op
      legTo(P.mast[0], P.deck, P.mast[1] + 0.32, 0, RIDE_WALK, 0);
      legTo(P.mast[0], P.nest, P.mast[1] + 0.12, 1, 0.65, 0);
    }
    legTo(sx, pirateH(v.seat), sz, 0, RIDE_WALK, 0);
  },
  from(v) {
    const P = PIRATE, [sx, sz] = P.spots[v.seat];
    legFrom(sx, pirateH(v.seat), sz);
    if (v.seat === PIRATE_NEST) {
      legTo(P.mast[0], P.nest, P.mast[1] + 0.12, 0, RIDE_WALK, 0);
      legTo(P.mast[0], P.deck, P.mast[1] + 0.32, 1, 0.75, 0);
    }
    // naar de glijbaan vooraan, gaan zitten en naar beneden
    legTo(P.slideX, P.deck, 0.3, 0, RIDE_WALK, 0);
    legTo(P.slideX, P.deck + 0.03, 0.42, 2, -0.3, 0, 0);
    legTo(P.slideX, 0.17, P.slideEnd, 3, -0.85, SLIDE_FREE, 0);
    legTo(P.slideX, 0, P.slideEnd + 0.16, 4, -0.45, 0, 0);
    playWalkOut(v, P.slideX, P.slideEnd + 0.16);
  },
  spot(out, seat, s) {
    const [sx, sz, face] = PIRATE.spots[seat];
    put(out, sx, pirateH(seat), sz, face, 'stand');
    out.u = wave01(s.clock, 0.4, seat);
    out.on = true;
    return out;
  },
};

// --- het draaimolentje (2 bij 2): een rond plateau met stangen dat ronddraait als er kinderen op staan
/** `floor`: zo hoog is het plateau; de kinderen staan op `r` van het midden, elk aan een stang. `speed`: zo snel draait het (radialen per tel). */
export const ROUNDABOUT = { floor: 0.14, r: 0.5, plate: 0.78, speed: 1.7, stay: 7, seats: 4 };
/** Waar kind `seat` op het draaiende plateau staat. */
export const roundaboutAngle = (seat: number, s: RideState): number => s.spin + (seat * TAU) / ROUNDABOUT.seats + Math.PI / 4;
const ROUNDABOUT_KIT: PlayKit = {
  seats: ROUNDABOUT.seats,
  stay: ROUNDABOUT.stay,
  to(v) {
    playWalkIn(v, 0, 1.0);
    legTo(0, 0, ROUNDABOUT.plate + 0.08, 0, RIDE_WALK, 0);
  },
  from(v) {
    legFrom(0, 0, ROUNDABOUT.plate + 0.08);
    legTo(0, 0, 1.0, 0, RIDE_WALK, 0);
    playWalkOut(v, 0, 1.0);
  },
  spot(out, seat, s) {
    const a = roundaboutAngle(seat, s);
    // met het gezicht naar de stang (naar het midden), en een beetje achterover hangend als het hard gaat
    put(out, Math.sin(a) * ROUNDABOUT.r, ROUNDABOUT.floor, Math.cos(a) * ROUNDABOUT.r, a + Math.PI, 'stand');
    out.pitch = -0.25 * s.amp;
    out.u = s.amp;
    out.on = true;
    return out;
  },
};

// --- de nestschommel (2 bij 2): een grote ronde schommel aan vier touwen, waar drie kinderen in liggen
/** De balk ligt `top` hoog; het nest hangt `rope` eronder (de kinderen zitten `seat` boven de bodem) en zwaait hooguit `max` radialen uit. */
export const NEST = { seat: 0.07, top: 1.6, rope: 1.12, max: 0.42, speed: 2.1, stay: 8, spots: [[-0.2, -0.08], [0.2, -0.08], [0, 0.17]] as [number, number][] };
/** Hoe ver het nest nu uitzwaait (radialen). */
export const nestAngle = (s: RideState): number => NEST.max * s.amp * Math.sin(s.spin);
const NEST_KIT: PlayKit = {
  seats: NEST.spots.length,
  stay: NEST.stay,
  to(v) {
    const [sx] = NEST.spots[v.seat];
    playWalkIn(v, sx, 0.95);
    legTo(sx, 0, 0.62, 0, RIDE_WALK, 0);
  },
  from(v) {
    const [sx] = NEST.spots[v.seat];
    legFrom(sx, 0, 0.62);
    legTo(sx, 0, 0.95, 0, RIDE_WALK, 0);
    playWalkOut(v, sx, 0.95);
  },
  spot(out, seat, s) {
    const [sx, sz] = NEST.spots[seat], a = nestAngle(s);
    // het nest zwaait om de balk: een plek in het nest gaat mee naar voren en naar achteren, en omhoog aan het eind
    put(out, sx, NEST.top - Math.cos(a) * NEST.rope + NEST.seat + sz * Math.sin(a), Math.sin(a) * NEST.rope + sz * Math.cos(a), 0, 'sit');
    // half liggend in het nest, en met het nest mee kantelend
    out.pitch = -0.35 - a;
    out.u = s.amp;
    out.on = true;
    return out;
  },
};

// --- de ballenbak (2 bij 2): een rond bad vol gekleurde ballen onder een tentje
/** De rand ligt op `r` en is `rim` hoog; de ballen liggen tot `balls`. De kinderen zitten op `sit` en duiken af en toe onder (`dive`). */
export const BALLPIT = { r: 0.74, rim: 0.3, balls: 0.24, sit: 0.06, stay: 8, speed: 2.4, spots: [[-0.32, -0.25], [0.3, -0.28], [-0.3, 0.2], [0.28, 0.18]] as [number, number][] };
/** Duikt kind `seat` nu onder de ballen? (0 tot 1: hoe diep.) */
export const ballDive = (seat: number, s: RideState): number => {
  const t = (s.clock * 0.22 + seat * 0.29) % 1;
  return t < 0.18 ? Math.sin((Math.PI * t) / 0.18) : 0;
};
const BALLPIT_KIT: PlayKit = {
  seats: BALLPIT.spots.length,
  stay: BALLPIT.stay,
  to(v) {
    const [sx, sz] = BALLPIT.spots[v.seat], B = BALLPIT;
    playWalkIn(v, sx * 0.5, B.r + 0.24);
    legTo(sx * 0.5, B.rim, B.r, 0, RIDE_WALK, 0);
    legTo(sx * 0.5, B.sit, B.r - 0.2, 0, RIDE_WALK, 0);
    legTo(sx, B.sit, sz + 0.1, 0, RIDE_WALK * 0.7, 0);
  },
  from(v) {
    const [sx, sz] = BALLPIT.spots[v.seat], B = BALLPIT;
    legFrom(sx, B.sit, sz + 0.1);
    legTo(sx * 0.5, B.sit, B.r - 0.2, 0, RIDE_WALK * 0.7, 0);
    legTo(sx * 0.5, B.rim, B.r, 0, RIDE_WALK, 0);
    legTo(sx * 0.5, 0, B.r + 0.24, 0, RIDE_WALK, 0);
    playWalkOut(v, sx * 0.5, B.r + 0.24);
  },
  spot(out, seat, s) {
    const [sx, sz] = BALLPIT.spots[seat], dive = ballDive(seat, s);
    put(out, sx, BALLPIT.sit + 0.015 * Math.sin(s.clock * 3 + seat) * (1 - dive), sz, Math.atan2(-sx, -sz) + Math.PI, 'sit');
    // onderduiken: voorover tussen de ballen
    out.pitch = 0.9 * dive;
    out.h -= 0.05 * dive;
    out.u = wave01(s.clock, 0.5, seat);
    out.w = dive;
    out.on = true;
    return out;
  },
};

// --- de kruipheuvel (3 bij 3): een grasheuvel met stapstenen omhoog, een glijbaan eraf en een tunnel erdoorheen
/** De heuvel is `top` hoog en `rx` bij `rz` breed (midden op `cz`). De glijbaan loopt van `slide0` naar `slide1`, de tunnel op `tunnelZ` dwars erdoor. */
export const HILL = {
  top: 1.0, rx: 1.32, rz: 1.18, cz: -0.12, tunnelZ: -0.15, stay: 6, speed: 1.2,
  steps: [[-0.95, 1.1], [-0.82, 0.78], [-0.62, 0.5], [-0.4, 0.26], [-0.2, 0.08]] as [number, number][],
  slide0: [0.32, 0.12] as [number, number], slide1: [1.2, 1.12] as [number, number],
  spots: [[-0.22, -0.28], [0.22, -0.32], [0.02, -0.02], [-0.3, 0.05], [0.3, -0.05]] as [number, number][],
};
/** Hoe hoog de heuvel is op plek (x, z). */
export function hillH(x: number, z: number): number {
  const u = x / HILL.rx, w = (z - HILL.cz) / HILL.rz, r = u * u + w * w;
  return r >= 1 ? 0 : HILL.top * Math.sqrt(1 - r);
}
const HILL_KIT: PlayKit = {
  seats: HILL.spots.length,
  stay: HILL.stay,
  to(v) {
    const H = HILL, [sx, sz] = H.spots[v.seat];
    playWalkIn(v, H.steps[0][0], H.steps[0][1] + 0.25);
    // de stapstenen omhoog: klimmen, want het is steil
    for (const [x, z] of H.steps) legTo(x, hillH(x, z) + 0.03, z, 1, 0.75, 0);
    legTo(sx, hillH(sx, sz), sz, 0, RIDE_WALK * 0.8, 0);
  },
  from(v) {
    const H = HILL, [sx, sz] = H.spots[v.seat], [ax, az] = H.slide0, [bx, bz] = H.slide1;
    legFrom(sx, hillH(sx, sz), sz);
    legTo(ax, hillH(ax, az), az, 0, RIDE_WALK * 0.8, 0);
    const face = Math.atan2(bx - ax, bz - az);
    legTo(ax, hillH(ax, az) + 0.03, az, 2, -0.3, 0, face);
    legTo(bx, 0.17, bz, 3, -1.1, SLIDE_FREE, face);
    legTo(bx + 0.08, 0, bz + 0.12, 4, -0.45, 0, face);
    // de helft van de kinderen kruipt daarna nog door de tunnel, van rechts naar links
    if (v.seat % 2 === 0) {
      legTo(H.rx + 0.12, 0, H.tunnelZ, 0, RIDE_WALK, 0);
      legTo(-H.rx - 0.12, 0, H.tunnelZ, 1, 0.75, CLIMB_DO.crawl);
      legTo(-H.rx + 0.05, 0, 1.2, 0, RIDE_WALK, 0);
      playWalkOut(v, -H.rx + 0.05, 1.2);
    } else playWalkOut(v, bx + 0.08, bz + 0.12);
  },
  spot(out, seat, s) {
    const [sx, sz] = HILL.spots[seat];
    put(out, sx, hillH(sx, sz), sz, Math.atan2(sx, sz - HILL.cz) + Math.sin(s.clock * 0.4 + seat) * 0.5, 'stand');
    out.u = wave01(s.clock, 0.3, seat);
    out.on = true;
    return out;
  },
};

/** Alle toestellen van de grote speeltuin. */
const PLAYS: Partial<Record<RideKind, PlayKit>> = {
  sandbox: SANDBOX_KIT, splash: SPLASH_KIT, zipline: ZIPLINE_KIT, bouncy: BOUNCY_KIT, pirate: PIRATE_KIT,
  roundabout: ROUNDABOUT_KIT, nestswing: NEST_KIT, ballpit: BALLPIT_KIT, crawlhill: HILL_KIT,
};
/** Hoe snel elk toestel van de grote speeltuin beweegt (voor rideStep): het zand, het water, het kussen, de vlag. */
const PLAYS_SPEED: Partial<Record<RideKind, number>> = {
  sandbox: SANDBOX.speed, splash: SPLASH.speed, zipline: ZIPLINE.speed, bouncy: BOUNCY.speed, pirate: PIRATE.speed, nestswing: NEST.speed, ballpit: BALLPIT.speed, crawlhill: HILL.speed,
};

function playsPlan(v: Visit, s: RideState, used: number): boolean {
  const kit = PLAYS[v.kind]!;
  if (!freeSeat(v, used, kit.seats)) return false;
  kit.to(v);
  v.walk = legsTime();
  v.wait = 0;
  if (kit.gap) {
    // om de beurt: wie te vroeg is, wacht op zijn plek aan het eind van de heenweg
    const start = s.clock + v.walk;
    v.wait = Math.max(0, s.zero - start);
    s.zero = start + v.wait + kit.gap;
  }
  v.ride = kit.stay;
  kit.from(v);
  v.back = legsTime();
  return true;
}

/**
 * Het laatste punt van de stukken (of met `first` het eerste): daar komt het kind van de heenweg, of daar begint
 * de terugweg. Geeft (x, h, z, kijkrichting langs dat stuk) in een gedeeld lijstje; `face` als het stuk geen richting heeft.
 */
const SPOT4: [number, number, number, number] = [0, 0, 0, 0];
function legEnd(first: boolean, face: number): [number, number, number, number] {
  const i = first ? 0 : (legN - 1) * LEG, j = first ? LEG : (legN - 2) * LEG;
  SPOT4[0] = LEGS[i];
  SPOT4[1] = LEGS[i + 1];
  SPOT4[2] = LEGS[i + 2];
  const dx = first ? LEGS[j] - LEGS[i] : LEGS[i] - LEGS[j], dz = first ? LEGS[j + 2] - LEGS[i + 2] : LEGS[i + 2] - LEGS[j + 2];
  SPOT4[3] = legN > 1 && Math.hypot(dx, dz) > 1e-6 ? Math.atan2(dx, dz) : face;
  return SPOT4;
}

function playsPose(out: RidePose, v: Visit, s: RideState, e: number): RidePose {
  const kit = PLAYS[v.kind]!, top = v.walk + v.wait, leave = top + v.ride;
  if (e < v.walk) {
    kit.to(v);
    legsAt(out, e);
    out.on = out.h > 0.02 || out.act === 'climb';
    return out;
  }
  if (e < top) {
    // wachten op je beurt, op het eind van de heenweg
    kit.to(v);
    legsAt(out, v.walk + 1);
    out.act = 'stand';
    out.on = true;
    return out;
  }
  if (e < leave) {
    // het plekje; het eerste en laatste stukje met een hupje vanaf de heenweg en naar de terugweg
    if (e - top < PLAY_HOP) kit.to(v);
    else if (leave - e < PLAY_HOP) kit.from(v);
    kit.spot(out, v.seat, s);
    if (e - top < PLAY_HOP || leave - e < PLAY_HOP) {
      const first = e - top >= PLAY_HOP, [x, h, z, f] = legEnd(first, out.face);
      hopOn(out, x, h, z, f, first ? (leave - e) / PLAY_HOP : (e - top) / PLAY_HOP);
    }
    out.on = true;
    return out;
  }
  kit.from(v);
  out.done = legsAt(out, e - leave);
  out.on = out.h > 0.02 || out.act !== 'walk';
  return out;
}

// ------------------------------------------------------------ het restaurant (3 bij 2)
/**
 * Het restaurant: de keuken staat linksachter, de tafels op het terras. `tables`: de tafels (x, z), met aan
 * weerszijden (`stool` naar links en naar rechts) een kruk van `seat` hoog. `front` (z): daar stap je het terras
 * op. `aisle` (x): het gangpad tussen de voorste tafels door naar de tafel achteraan. `stay`: zo lang zit een gast
 * te eten.
 */
export const RESTAURANT = { tables: [[-1.04, 0.45], [-0.08, 0.45], [0.95, 0.45], [0.95, -0.5]] as [number, number][], stool: 0.27, seat: 0.25, front: 0.92, aisle: 0.42, stay: 9 };
export const RESTAURANT_TABLES = RESTAURANT.tables;

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
  wayIn(v, RIDE_SPAN.restaurant[0], RIDE_SPAN.restaurant[1], back ? RESTAURANT.aisle : p.x, RESTAURANT.front);
  // de tafel achteraan: tussen de voorste tafels door
  if (back) wayTo(RESTAURANT.aisle, 0, p.z + 0.3);
  wayTo(p.x, 0, p.z + 0.3);
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

// ------------------------------------------------------------ ritjes met een eigen ronde
// De zweefmolen, het schommelschip, de luchtballon, de wildwaterbaan en de achtbaan werken allemaal zo: het toestel
// staat stil met de deur open tot er iemand komt. Dan is er `stop` tellen om in te stappen, daarna duurt het ritje
// `run` tellen, en dan staat alles weer precies in rust. Zonder gasten begint er geen ritje.
export type LapKind = 'swinger' | 'ship' | 'airballoon' | 'flume' | 'coaster';
export const LAP_KINDS: LapKind[] = ['swinger', 'ship', 'airballoon', 'flume', 'coaster'];
export const isLap = (kind: ShopKind): kind is LapKind => (LAP_KINDS as ShopKind[]).includes(kind);

/**
 * De zweefmolen (4 bij 4). `seats` stoeltjes hangen aan kettingen van `chain` lang aan een kap; in rust hangen ze op
 * `r0` van de mast en zit de kap `top` hoog. Draait hij, dan gaat de kap `rise` omhoog en zwaaien de stoeltjes tot
 * `lean` radialen naar buiten. `speed`: radialen per tel op volle snelheid. Een ritje: in `up` tellen op gang komen,
 * `run` tellen draaien en in `down` tellen uitlopen. `walk`: op die straal loop je om de stoeltjes heen.
 */
export const SWINGER = { seats: 8, r0: 0.74, top: 2.15, rise: 0.75, chain: 1.55, lean: 0.8, speed: 1.9, stop: 7, up: 3.5, run: 9, down: 4, walk: 1.3 };
/**
 * Het schommelschip (6 bij 2). Het schip hangt aan een as op `pivot` hoogte: de zittingen `seatR` eronder, de kiel
 * `hullR`. De banken staan op `rows` (x, in rust) en kijken naar het midden, met op elke bank twee plekken (`side`
 * voor en achter het midden). Het zwaait tot `max` radialen, een keer heen en weer in `period` tellen: in `up`
 * tellen steeds hoger, `run` tellen voluit en in `down` tellen weer tot stilstand. Het perron is `deck` hoog en
 * ligt op `deckZ`.
 */
export const SHIP = { pivot: 3.05, seatR: 2.3, hullR: 2.55, rows: [-1.05, -0.45, 0.45, 1.05], side: 0.2, max: 0.9, period: 3.3, stop: 8, up: 7, run: 6.2, down: 6.6, deck: 0.5, deckZ: 0.74 };
export const SHIP_SEATS = SHIP.rows.length * 2;
/**
 * De luchtballon (3 bij 3). In de mand staan vier gasten (`spots`, ten opzichte van het midden van de mand); de vloer
 * van de mand is in rust `floor` hoog en stijgt aan het touw tot `high` daarboven. Boven drijft hij `drift` tegels
 * heen en weer. Een ritje: `up` tellen stijgen, `run` tellen hangen en `down` tellen dalen. `step`: daar (z) stap je in.
 */
export const AIRBALLOON = { spots: [[-0.17, 0.17], [0.17, 0.17], [-0.17, -0.17], [0.17, -0.17]], floor: 0.3, high: 4.6, drift: 0.3, stop: 7, up: 6, run: 9, down: 6, step: 0.62 };

/** Hoe lang je kunt instappen en hoe lang een ritje duurt; van de wildwaterbaan en de achtbaan staat `run` verderop (het volgt uit de baan). */
export const LAP: Record<LapKind, { stop: number; run: number }> = {
  swinger: { stop: SWINGER.stop, run: SWINGER.up + SWINGER.run + SWINGER.down },
  ship: { stop: SHIP.stop, run: SHIP.up + SHIP.run + SHIP.down },
  airballoon: { stop: AIRBALLOON.stop, run: AIRBALLOON.up + AIRBALLOON.run + AIRBALLOON.down },
  flume: { stop: 9, run: 0 },
  coaster: { stop: 9, run: 0 },
};

/** Zoveel tellen is het ritje bezig; 0 zolang het toestel stilstaat (instappen, of er is niemand). */
export const lapTime = (kind: LapKind, s: RideState): number => (s.amp > 0 ? Math.max(0, Math.min(LAP[kind].run, s.clock - s.zero - LAP[kind].stop)) : 0);

/** Van 0 naar 1 in `up` tellen, `run` tellen 1, en in `down` tellen terug naar 0; daarbuiten 0. */
const hill = (t: number, up: number, run: number, down: number): number => (t <= 0 ? 0 : t < up ? ease(t / up) : t < up + run ? 1 : 1 - ease((t - up - run) / down));

/** Een ronde verder: de klok van de ronde bijhouden en vertrekken zodra de instaptijd om is en er iemand meegaat. */
function lapStep(kind: LapKind, s: RideState, dt: number, taken: boolean): void {
  const lap = LAP[kind], total = lap.stop + lap.run;
  if (s.clock - s.zero >= total) {
    // het ritje is voorbij: alles staat weer in rust en de deur gaat open
    s.zero += total;
    s.amp = 0;
  }
  if (!s.amp) {
    // niemand: het toestel wacht, en de instaptijd begint pas als de eerste gast komt
    if (!taken) s.zero = s.clock;
    else if (s.clock - s.zero >= lap.stop) s.amp = 1;
  }
  if (kind === 'swinger') s.spin = (s.spin + dt * SWINGER.speed * swingerGo(s)) % TAU;
}

// ---- de zweefmolen
/** Hoe hard de zweefmolen draait, van 0 tot 1. */
export const swingerGo = (s: RideState): number => hill(lapTime('swinger', s), SWINGER.up, SWINGER.run, SWINGER.down);
/** Hoe ver stoeltje `seat` naar buiten zwaait (radialen): hoe harder hij draait, hoe verder, met een klein eigen wiebeltje. */
export function swingerLean(seat: number, s: RideState): number {
  const go = swingerGo(s);
  return SWINGER.lean * Math.pow(go, 1.3) * (1 + 0.05 * Math.sin(s.clock * 1.9 + seat * 2.3));
}
/** Zo hoog zit de kap nu. */
export const swingerTop = (s: RideState): number => SWINGER.top + SWINGER.rise * swingerGo(s);
/** De hoek van stoeltje `seat` om de mast (0 = vooraan, oplopend naar rechts). */
export const swingerAngle = (seat: number, spin: number): number => spin + ((seat % SWINGER.seats) * TAU) / SWINGER.seats;

export function swingerSeat(out: RidePose, seat: number, s: RideState): RidePose {
  const a = swingerAngle(seat, s.spin), lean = swingerLean(seat, s), r = SWINGER.r0 + SWINGER.chain * Math.sin(lean);
  put(out, Math.sin(a) * r, swingerTop(s) - SWINGER.chain * Math.cos(lean), Math.cos(a) * r, a + Math.PI / 2, 'sit');
  // het stoeltje hangt schuin: het hoofd naar de mast toe
  out.roll = -lean;
  out.on = true;
  out.u = swingerGo(s);
  out.w = (Math.cos(a) + 1) / 2;
  return out;
}

/** De route van het pad naar stoeltje `seat`: om de stoeltjes heen en dan naar binnen, tot vlak naast het stoeltje. */
function swingerWay(v: Visit, s: RideState): void {
  const from = Math.atan2(v.fx, v.fz), a = swingerAngle(v.seat, s.spin), near = SWINGER.r0 + 0.26;
  wayFrom(v.fx, 0, v.fz);
  wayTo(Math.sin(from) * SWINGER.walk, 0, Math.cos(from) * SWINGER.walk);
  wayArc(from, a, SWINGER.walk, 0);
  wayTo(Math.sin(a) * near, 0, Math.cos(a) * near);
}

// ---- het schommelschip
/** De hoek van het schip (radialen): plus is de rechterkant (+x) omhoog. */
export function shipAngle(s: RideState): number {
  const t = lapTime('ship', s);
  return SHIP.max * hill(t, SHIP.up, SHIP.run, SHIP.down) * Math.sin((t * TAU) / SHIP.period);
}

export function shipSeat(out: RidePose, seat: number, s: RideState): RidePose {
  const sx = SHIP.rows[Math.floor(seat / 2) % SHIP.rows.length], a = shipAngle(s), cos = Math.cos(a), sin = Math.sin(a);
  put(out, sx * cos + SHIP.seatR * sin, SHIP.pivot + sx * sin - SHIP.seatR * cos, seat % 2 ? -SHIP.side : SHIP.side, sx < 0 ? Math.PI / 2 : -Math.PI / 2, 'sit');
  // wie naar het midden kijkt, helt achterover als zijn kant omhoog gaat
  out.pitch = sx < 0 ? a : -a;
  out.on = true;
  // hoe hoog deze bank nu is: 1 = helemaal bovenin
  out.u = clamp01((Math.sign(sx) * a) / SHIP.max);
  out.w = Math.abs(a) / SHIP.max;
  return out;
}

/** De route van het pad naar bank `seat`: de trap op, over het perron tot voor de bank. */
function shipWay(v: Visit): void {
  const sx = SHIP.rows[Math.floor(v.seat / 2) % SHIP.rows.length];
  wayIn(v, RIDE_SPAN.ship[0], RIDE_SPAN.ship[1], sx * 0.5, RIDE_SPAN.ship[1] / 2 + 0.04);
  wayTo(sx * 0.5, SHIP.deck, SHIP.deckZ + 0.16);
  wayTo(sx, SHIP.deck, SHIP.deckZ);
}

// ---- de luchtballon
/** Waar de mand nu is: x, de hoogte van zijn vloer, z, hoe ver hij gedraaid is, en hoe hard de brander brandt (0 tot 1). Een gedeeld lijstje. */
const BASKET = [0, 0, 0, 0, 0];
export function balloonAt(s: RideState): number[] {
  const t = lapTime('airballoon', s), B = AIRBALLOON, g = hill(t, B.up, B.run, B.down);
  BASKET[0] = B.drift * g * Math.sin(t * 0.45);
  BASKET[1] = B.floor + B.high * g + 0.06 * g * Math.sin(t * 1.3);
  BASKET[2] = B.drift * g * Math.sin(t * 0.33 + 1);
  BASKET[3] = 0.5 * g * Math.sin(t * 0.21);
  // de brander: voluit bij het stijgen, af en toe een stoot terwijl hij hangt, uit bij het dalen
  BASKET[4] = t <= 0 ? 0 : t < B.up ? 0.75 + 0.25 * Math.sin(t * 9) : t < B.up + B.run ? Math.max(0, Math.sin(t * 1.6)) ** 6 : 0;
  return BASKET;
}

export function balloonSeat(out: RidePose, seat: number, s: RideState): RidePose {
  const [sx, sz] = AIRBALLOON.spots[seat % AIRBALLOON.spots.length], [bx, bh, bz, turn] = balloonAt(s), cos = Math.cos(turn), sin = Math.sin(turn);
  put(out, bx + sx * cos + sz * sin, bh, bz - sx * sin + sz * cos, Math.atan2(sx, sz) + turn, 'stand');
  out.on = true;
  out.u = clamp01((bh - AIRBALLOON.floor) / AIRBALLOON.high);
  return out;
}

/** De route van het pad de mand in: naar het deurtje vooraan, de opstap op en naar je hoek. */
function balloonWay(v: Visit): void {
  const [sx, sz] = AIRBALLOON.spots[v.seat % AIRBALLOON.spots.length];
  wayIn(v, RIDE_SPAN.airballoon[0], RIDE_SPAN.airballoon[1], 0, RIDE_SPAN.airballoon[1] / 2 - 0.1);
  wayTo(0, 0, AIRBALLOON.step);
  wayTo(0, AIRBALLOON.floor, 0.3);
  wayTo(sx, AIRBALLOON.floor, sz);
}

// ---- een baan met een treintje (de wildwaterbaan en de achtbaan)
/**
 * Een gesloten baan: `n` punten (x, hoogte, z) op een rij, met bij elk punt hoe ver het van het begin is (`len`), na
 * hoeveel tellen het treintje er is (`time`), hoe hard het daar gaat (`speed`) en hoe scheef het daar in de bocht
 * hangt (`bank`, radialen). Het begin is de plek in het station waar de voorste wagen stilstaat.
 */
export interface Track {
  n: number;
  pts: Float32Array;
  len: Float32Array;
  time: Float32Array;
  speed: Float32Array;
  bank: Float32Array;
  total: number;
  run: number;
}

/**
 * Maakt een baan door de punten van `ctrl` (x, hoogte, z en de snelheid daar), met vloeiende bochten ertussen.
 * `per`: zoveel stukjes tussen twee punten. Het treintje trekt op uit stilstand en remt aan het eind weer af tot
 * stilstand (`accel`). `lean`: hoe scheef het in de bochten hangt (0 = nooit).
 */
function makeTrack(ctrl: number[][], lean: number, per = 10, accel = 1.1): Track {
  const m = ctrl.length, n = m * per, pts = new Float32Array((n + 1) * 3), raw = new Float32Array(n + 1);
  const at = (i: number): number[] => ctrl[((i % m) + m) % m];
  for (let i = 0; i < m; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    for (let j = 0; j < per; j++) {
      const t = j / per, k = (i * per + j) * 3;
      for (let c = 0; c < 3; c++) pts[k + c] = 0.5 * (2 * p1[c] + (p2[c] - p0[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t * t + (3 * p1[c] - p0[c] - 3 * p2[c] + p3[c]) * t * t * t);
      raw[i * per + j] = p1[3] + (p2[3] - p1[3]) * t;
    }
  }
  for (let c = 0; c < 3; c++) pts[n * 3 + c] = pts[c];
  raw[n] = raw[0];
  const len = new Float32Array(n + 1);
  for (let i = 0; i < n; i++) len[i + 1] = len[i] + Math.hypot(pts[i * 3 + 3] - pts[i * 3], pts[i * 3 + 4] - pts[i * 3 + 1], pts[i * 3 + 5] - pts[i * 3 + 2]);
  const total = len[n], speed = new Float32Array(n + 1), time = new Float32Array(n + 1), bank = new Float32Array(n + 1);
  for (let i = 0; i <= n; i++) speed[i] = Math.min(raw[i], Math.sqrt(0.05 + 2 * accel * len[i]), Math.sqrt(0.05 + 2 * accel * (total - len[i])));
  for (let i = 0; i < n; i++) time[i + 1] = time[i] + (len[i + 1] - len[i]) / ((speed[i] + speed[i + 1]) / 2);
  // in een bocht hangt het treintje naar binnen: hoe scherper de bocht en hoe harder het gaat, hoe schever
  const turnAt = (i: number): number => {
    const a = ((i - 2 + n) % n) * 3, b = (i % n) * 3, c = ((i + 2) % n) * 3;
    const h1 = Math.atan2(pts[b] - pts[a], pts[b + 2] - pts[a + 2]), h2 = Math.atan2(pts[c] - pts[b], pts[c + 2] - pts[b + 2]);
    const far = Math.hypot(pts[c] - pts[a], pts[c + 2] - pts[a + 2]) / 2;
    return far > 1e-4 ? turnTo(h1, h2) / far : 0;
  };
  const rough = new Float32Array(n + 1);
  for (let i = 0; i <= n; i++) rough[i] = Math.max(-0.75, Math.min(0.75, -lean * turnAt(i) * speed[i % n] * speed[i % n]));
  for (let i = 0; i <= n; i++) {
    let sum = 0;
    for (let k = -3; k <= 3; k++) sum += rough[(((i + k) % n) + n) % n];
    bank[i] = sum / 7;
  }
  return { n, pts, len, time, speed, bank, total, run: time[n] };
}

/** Een punt op een baan: waar het is, welke kant de baan op gaat (een pijl van lengte 1), hoe scheef en hoe hard. */
export interface TrackSpot {
  x: number;
  h: number;
  z: number;
  dx: number;
  dh: number;
  dz: number;
  bank: number;
  speed: number;
}
export const newSpot = (): TrackSpot => ({ x: 0, h: 0, z: 0, dx: 0, dh: 0, dz: 1, bank: 0, speed: 0 });

/** Het hoeveelste punt van `list` het laatste is dat niet voorbij `value` ligt. */
function lookup(list: Float32Array, n: number, value: number): number {
  let lo = 0, hi = n;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (list[mid] <= value) lo = mid;
    else hi = mid;
  }
  return lo;
}

/** Zet `out` op `d` tegels langs de baan (voorbij het eind begint hij weer vooraan, en voor het begin telt hij terug). */
export function trackAt(out: TrackSpot, tr: Track, d: number): TrackSpot {
  const at = ((d % tr.total) + tr.total) % tr.total, i = lookup(tr.len, tr.n, at), seg = tr.len[i + 1] - tr.len[i], t = seg > 1e-9 ? (at - tr.len[i]) / seg : 0;
  const a = i * 3, b = a + 3, p = tr.pts;
  out.x = lerp(p[a], p[b], t);
  out.h = lerp(p[a + 1], p[b + 1], t);
  out.z = lerp(p[a + 2], p[b + 2], t);
  const k = 1 / (seg || 1);
  out.dx = (p[b] - p[a]) * k;
  out.dh = (p[b + 1] - p[a + 1]) * k;
  out.dz = (p[b + 2] - p[a + 2]) * k;
  out.bank = lerp(tr.bank[i], tr.bank[i + 1], t);
  out.speed = lerp(tr.speed[i], tr.speed[i + 1], t);
  return out;
}

/** Hoe ver de voorste wagen is, `t` tellen na het vertrek. */
export function trackDist(tr: Track, t: number): number {
  if (t <= 0) return 0;
  if (t >= tr.run) return tr.total;
  const i = lookup(tr.time, tr.n, t), seg = tr.time[i + 1] - tr.time[i];
  return lerp(tr.len[i], tr.len[i + 1], seg > 1e-9 ? (t - tr.time[i]) / seg : 0);
}

/**
 * De wildwaterbaan (8 bij 3). Drie boomstammen (`cars`) varen achter elkaar, `gap` uit elkaar, met in elke stam twee
 * gasten achter elkaar (`tandem` voor en achter het midden). `seat`: zo hoog boven de bodem van de goot zit je.
 * Het perron is `deck` hoog en ligt op `deckZ`; de goot in het station ligt op `stationZ`. `splash`: daar (x) komt
 * de stam beneden in het water. `water`: zo diep staat het water in de goot. `top`: zo hoog is de goot bovenin.
 */
export const FLUME = { cars: 3, per: 2, gap: 0.82, seat: 0.1, tandem: 0.16, deck: 0.2, deckZ: 1.27, stationZ: 0.85, splash: 1.0, water: 0.09, top: 2.9 };
/**
 * De achtbaan (8 bij 4). Drie karretjes (`cars`), `gap` uit elkaar, met in elk karretje twee gasten naast elkaar
 * (`side` uit het midden). `seat`: zo hoog boven de rails zit je. Het perron is `deck` hoog en ligt op `deckZ`; het
 * station ligt op `stationZ`. `top`: het hoogste punt van de baan.
 */
export const COASTER = { cars: 3, per: 2, gap: 0.6, seat: 0.17, side: 0.12, deck: 0.3, deckZ: 1.72, stationZ: 1.3, top: 3.72 };

// de goot: het station vooraan (naar links), de bocht om, achterlangs de lift op, bovenlangs de bocht om, en dan de
// glijbaan af het water in en uitdrijven tot het station
const FLUME_TRACK = makeTrack([
  [-2.3, 0.16, 0.85, 1.0], [-2.9, 0.16, 0.85, 1.1],
  [-3.6, 0.16, 0.6, 1.1], [-3.85, 0.16, 0, 1.1], [-3.6, 0.16, -0.6, 1.1], [-3.0, 0.18, -0.85, 1.0],
  [-2.0, 0.5, -0.85, 0.85], [-0.7, 1.25, -0.85, 0.85], [0.6, 2.0, -0.85, 0.85], [1.9, 2.7, -0.85, 0.85], [2.7, FLUME.top, -0.85, 0.9],
  [3.6, FLUME.top, -0.6, 1.0], [3.85, FLUME.top, 0, 1.0], [3.6, FLUME.top, 0.6, 1.1], [3.0, 2.85, 0.85, 1.4],
  [2.3, 1.9, 0.85, 3.0], [1.6, 0.8, 0.85, 4.2], [FLUME.splash, 0.2, 0.85, 4.4], [0.3, 0.14, 0.85, 2.4], [-0.5, 0.16, 0.85, 1.4], [-1.4, 0.16, 0.85, 1.1],
], 0);
// de rails: het station vooraan (naar links), de grote bocht om, achterlangs de ketting op, bovenin de bocht om, de
// grote afdaling en een hoge heuvel, een krappe bocht, drie hupjes terug, de laatste bocht en remmen tot het station
const COASTER_TRACK = makeTrack([
  [-0.9, 0.35, 1.3, 1.2], [-1.7, 0.35, 1.3, 1.6],
  [-3.125, 0.4, 0.875, 1.8], [-3.55, 0.5, -0.15, 1.8], [-3.125, 0.6, -1.175, 1.6], [-2.1, 0.7, -1.6, 1.2],
  [-0.9, 1.45, -1.6, 1.0], [0.4, 2.3, -1.6, 1.0], [1.7, 3.15, -1.6, 1.0], [2.6, 3.65, -1.6, 1.1],
  [3.236, COASTER.top, -1.461, 1.3], [3.375, 3.7, -1.125, 1.4], [3.236, 3.62, -0.789, 1.6], [2.8, 3.4, -0.65, 2.0],
  [2.0, 2.1, -0.65, 3.6], [1.2, 0.75, -0.65, 4.6], [0.5, 0.45, -0.65, 4.8],
  [-0.5, 1.5, -0.65, 3.6], [-1.2, 1.9, -0.65, 3.0], [-1.8, 1.4, -0.65, 3.6], [-2.3, 1.0, -0.65, 3.9],
  [-2.654, 0.9, -0.504, 3.6], [-2.8, 0.85, -0.15, 3.4], [-2.654, 0.82, 0.204, 3.4], [-2.3, 0.8, 0.35, 3.4],
  [-1.5, 1.35, 0.35, 2.9], [-0.7, 0.7, 0.35, 3.3], [0.1, 1.25, 0.35, 2.8], [0.9, 0.65, 0.35, 3.1], [1.7, 1.0, 0.35, 2.7], [2.5, 0.6, 0.35, 2.6],
  [3.236, 0.52, 0.489, 2.4], [3.375, 0.45, 0.825, 2.2], [3.236, 0.4, 1.161, 2.0], [2.9, 0.36, 1.3, 1.8],
  [2.0, 0.35, 1.3, 1.5], [1.0, 0.35, 1.3, 1.2], [0.0, 0.35, 1.3, 1.0],
], 0.055);
LAP.flume.run = FLUME_TRACK.run;
/** Zo ver langs de goot duiken de boomstammen het water in (voor de plons en het geluid). */
export const FLUME_SPLASH_AT = ((): number => {
  for (let i = Math.floor(FLUME_TRACK.n * 0.6); i < FLUME_TRACK.n; i++) if (FLUME_TRACK.pts[i * 3] <= FLUME.splash) return FLUME_TRACK.len[i];
  return FLUME_TRACK.total * 0.8;
})();
LAP.coaster.run = COASTER_TRACK.run;
export const trackOf = (kind: 'flume' | 'coaster'): Track => (kind === 'flume' ? FLUME_TRACK : COASTER_TRACK);

/** Waar wagen (of boomstam) `car` nu is: de voorste op de plek van het treintje, de volgende steeds `gap` erachter. */
export function trainCar(out: TrackSpot, kind: 'flume' | 'coaster', car: number, s: RideState, shift = 0): TrackSpot {
  const tr = trackOf(kind);
  return trackAt(out, tr, trackDist(tr, lapTime(kind, s)) - car * (kind === 'flume' ? FLUME.gap : COASTER.gap) + shift);
}

const SPOT = newSpot();
/** Waar een gast op plek `seat` zit: in de boomstam achter elkaar, in het karretje naast elkaar. */
export function trainSeat(out: RidePose, kind: 'flume' | 'coaster', seat: number, s: RideState): RidePose {
  const flume = kind === 'flume', car = Math.floor(seat / 2) % (flume ? FLUME.cars : COASTER.cars), second = seat % 2 === 1;
  const p = trainCar(SPOT, kind, car, s, flume ? (second ? -FLUME.tandem : FLUME.tandem) : 0), flat = Math.hypot(p.dx, p.dz) || 1;
  const face = Math.atan2(p.dx, p.dz), side = flume ? 0 : (second ? -1 : 1) * COASTER.side, up = flume ? FLUME.seat : COASTER.seat;
  // (opzij is dwars op de baan; in een scheve bocht zit de ene gast wat hoger dan de andere)
  put(out, p.x + (p.dz / flat) * side * Math.cos(p.bank), p.h + up * flat + side * Math.sin(p.bank), p.z - (p.dx / flat) * side * Math.cos(p.bank), face, 'sit');
  out.pitch = -Math.asin(Math.max(-1, Math.min(1, p.dh)));
  out.roll = p.bank;
  out.on = true;
  // hoe spannend het nu is: steil naar beneden en hard
  out.u = clamp01(-p.dh * 1.5 + (p.speed - 3) * 0.3);
  out.w = clamp01(p.speed / 4.8);
  return out;
}

const SCRATCH_SEAT = newPose();
/** De route van het pad naar je plek op het perron, naast je zitje. */
function trainWay(v: Visit, kind: 'flume' | 'coaster', s: RideState): void {
  const flume = kind === 'flume', [w, d] = RIDE_SPAN[kind], deck = flume ? FLUME.deck : COASTER.deck, z = flume ? FLUME.deckZ : COASTER.deckZ;
  const x = trainSeat(SCRATCH_SEAT, kind, v.seat, s).x;
  wayIn(v, w, d, x, d / 2 + 0.03);
  wayTo(x, deck, z + 0.12);
  wayTo(x, deck, z);
}

// ---- instappen, meerijden en uitstappen: voor alle vijf hetzelfde
/** Het zitje zelf. */
function lapSeat(out: RidePose, kind: LapKind, seat: number, s: RideState): RidePose {
  return kind === 'swinger' ? swingerSeat(out, seat, s) : kind === 'ship' ? shipSeat(out, seat, s) : kind === 'airballoon' ? balloonSeat(out, seat, s) : trainSeat(out, kind, seat, s);
}
/** De route van het pad tot naast het zitje (in de ballon: tot op je plek). */
function lapWay(v: Visit, s: RideState): void {
  const kind = v.kind as LapKind;
  if (kind === 'swinger') swingerWay(v, s);
  else if (kind === 'ship') shipWay(v);
  else if (kind === 'airballoon') balloonWay(v);
  else trainWay(v, kind, s);
}
export const LAP_SEATS: Record<LapKind, number> = { swinger: SWINGER.seats, ship: SHIP_SEATS, airballoon: AIRBALLOON.spots.length, flume: FLUME.cars * FLUME.per, coaster: COASTER.cars * COASTER.per };

function lapPlan(v: Visit, s: RideState, used: number): boolean {
  const kind = v.kind as LapKind, lap = LAP[kind], c = s.clock - s.zero;
  // het ritje is bezig, of het vertrekt zo: dan wacht je in de rij op het volgende
  if (s.amp > 0 || c >= lap.stop) return false;
  // het vrije zitje waar je het kortst voor loopt
  let best = -1, least = Infinity;
  for (let seat = 0; seat < LAP_SEATS[kind]; seat++) {
    if (used & (1 << seat)) continue;
    v.seat = seat;
    lapWay(v, s);
    const len = wayLength();
    if (len < least) {
      best = seat;
      least = len;
    }
  }
  if (best < 0) return false;
  v.seat = best;
  v.walk = walkInTime(least, lap.stop - c - 0.2);
  if (v.walk < 0) return false;
  v.wait = lap.stop - c - v.walk;
  v.ride = lap.run + offDelay(best);
  // (de zweefmolen staat straks ergens anders stil: reken daar op het langste eind lopen)
  v.back = SIT_TIME + (kind === 'swinger' ? Math.hypot(v.fx, v.fz) + Math.PI * SWINGER.walk + 0.6 : least) / RIDE_WALK + 0.4;
  return true;
}

const LAP_SIDE = newPose();
function lapPose(out: RidePose, v: Visit, s: RideState, e: number): RidePose {
  const kind = v.kind as LapKind, leave = v.walk + v.wait + v.ride;
  if (e >= v.walk && e < leave) return lapSeat(out, kind, v.seat, s);
  if (e < v.walk - SIT_TIME) {
    lapWay(v, s);
    wayAt(out, (e / (v.walk - SIT_TIME)) * wayLength());
    return out;
  }
  if (e < v.walk || e < leave + SIT_TIME) {
    // instappen of uitstappen: van naast het zitje erop, of andersom
    lapWay(v, s);
    wayAt(LAP_SIDE, 1e9);
    const sx = LAP_SIDE.x, sh = LAP_SIDE.h, sz = LAP_SIDE.z, sf = LAP_SIDE.face;
    lapSeat(out, kind, v.seat, s);
    hopOn(out, sx, sh, sz, sf, e < v.walk ? (e - (v.walk - SIT_TIME)) / SIT_TIME : 1 - (e - leave) / SIT_TIME);
    out.on = false;
    return out;
  }
  lapWay(v, s);
  out.done = wayAt(out, (e - leave - SIT_TIME) * RIDE_WALK, true);
  return out;
}

// ------------------------------------------------------------ alles bij elkaar
/** Hoeveel gasten er tegelijk op of in kunnen. */
export const RIDE_SEATS: Record<RideKind, number> = {
  slide: SLIDE.slots, swing: SWINGSET.seats, seesaw: SEESAW.seats, springer: SPRINGER.seats, trampoline: TRAMPOLINE.seats, climber: CLIMBER.seats, fountain: FOUNTAIN.spread.length,
  sandbox: SANDBOX_KIT.seats, splash: SPLASH_KIT.seats, zipline: ZIPLINE_KIT.seats, bouncy: BOUNCY_KIT.seats, pirate: PIRATE_KIT.seats,
  roundabout: ROUNDABOUT_KIT.seats, nestswing: NEST_KIT.seats, ballpit: BALLPIT_KIT.seats, crawlhill: HILL_KIT.seats,
  tower: TOWER.spots.length, carousel: CAROUSEL_SEATS, bumper: BUMPER.cars, ferris: FERRIS.cabins * FERRIS.per, restaurant: RESTAURANT.tables.length * 2,
  ...LAP_SEATS,
};

const SCRATCH = newPose();
/** Het kladje waarop planVisit een bezoek uitrekent. */
const PLAN: Visit = { kind: 'slide', seat: 0, fx: 0, fz: 0, t0: 0, walk: 0, wait: 0, ride: 0, back: 0 };

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
  // (eerst op een kladje: een gast vooraan in de rij vraagt het elk beeldje opnieuw, en pas als het lukt komt er een bezoek bij)
  const v = PLAN;
  v.kind = kind;
  v.seat = 0;
  v.fx = fx;
  v.fz = fz;
  v.t0 = s.clock;
  v.walk = v.wait = v.ride = v.back = 0;
  v.q = undefined;
  const ok = isLap(kind) ? lapPlan(v, s, used)
    : kind === 'ferris' ? ferrisPlan(v, s, used)
    : kind === 'carousel' ? carouselPlan(v, s, used)
    : kind === 'bumper' ? bumperPlan(v, s, used)
    : kind === 'fountain' ? fountainPlan(v, used)
    : kind === 'tower' ? towerPlan(v, used)
    : kind === 'slide' ? slidePlan(v, s, used)
    : kind === 'restaurant' ? restaurantPlan(v, used)
    : kind === 'trampoline' ? trampolinePlan(v, used)
    : kind === 'climber' ? climberPlan(v, s, used)
    : PLAYS[kind] ? playsPlan(v, s, used)
    : playPlan(v, used);
  return ok ? { ...v } : null;
}

/**
 * Waar de gast van dit bezoek nu is en hoe hij erbij staat of zit. Leest de klok van het toestel: het bezoek loopt
 * dus precies gelijk met het toestel zelf. `out.done` is true zodra hij weer op het pad staat.
 */
export function visitPose(out: RidePose, v: Visit, s: RideState): RidePose {
  const e = Math.max(0, s.clock - v.t0), kind = v.kind;
  if (isLap(kind)) lapPose(out, v, s, e);
  else if (kind === 'ferris') ferrisPose(out, v, s, e);
  else if (kind === 'carousel') carouselPose(out, v, s, e);
  else if (kind === 'bumper') bumperPose(out, v, s, e);
  else if (kind === 'fountain') fountainPose(out, v, e);
  else if (kind === 'tower') towerPose(out, v, e);
  else if (kind === 'slide') slidePose(out, v, e);
  else if (kind === 'restaurant') restaurantPose(out, v, e);
  else if (kind === 'trampoline') trampolinePose(out, v, s, e);
  else if (kind === 'climber') climberPose(out, v, e);
  else if (PLAYS[kind]) playsPose(out, v, s, e);
  else playPose(out, v, s, e);
  if (e >= visitTime(v)) out.done = true;
  return out;
}

/** Alleen het zitje zelf, zonder het lopen ernaartoe: waar iemand op zitje `seat` nu zit. Voor wie zelf meerijdt. */
export function seatPose(out: RidePose, kind: RideKind, seat: number, s: RideState): RidePose {
  if (isLap(kind)) return lapSeat(out, kind, seat, s);
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
  if (kind === 'climber') return climberSpot(out, seat);
  if (PLAYS[kind]) return PLAYS[kind]!.spot(out, seat, s);
  return playSeat(out, kind, seat, s);
}

/** Een nieuw toestel: de klok op nul, alles in rust. */
export function newRide(kind: ShopKind): RideState {
  return { clock: 0, spin: 0, amp: 0, amps: [], cars: kind === 'bumper' ? newCars() : [], wake: 1, zero: 0 };
}

/** Zoveel tellen duurt het voor een toestel 's nachts stil valt, of 's ochtends weer helemaal op gang is. */
export const RIDE_WAKE = 8;

/** Hoe snel de speeltoestellen heen en weer gaan (radialen per tel). */
const PLAY_SPEED: Partial<Record<ShopKind, number>> = { swing: SWINGSET.speed, seesaw: SEESAW.speed, springer: SPRINGER.speed, trampoline: TRAMPOLINE.speed, climber: CLIMBER.speed, ...PLAYS_SPEED };

/** Schuift `amps[i]` een stukje naar `to`. */
function nudge(s: RideState, i: number, to: number, rate: number, from = 0): void {
  const now = s.amps[i] ?? from;
  s.amps[i] = now + (to - now) * Math.min(1, rate);
}

/**
 * Het toestel een beeldje verder: `dt` tellen. `aboard`: op welke zitjes nu echt iemand zit (een bit per zitje);
 * daarmee gaat een bezet zitje flink heen en weer en wiegt een leeg zitje alleen wat, draait de draaimolen op
 * volle snelheid en rijden de botsauto's echt. De klok loopt altijd gewoon door.
 * `rest`: het park is dicht en iedereen slaapt. Zit er niemand meer op, dan valt het toestel langzaam stil (zie
 * `wake`); 's ochtends komt het net zo rustig weer op gang. Een toestel waar niemand op zit, staat stil: het beweegt
 * alleen met gasten erop. `used`: de zitjes die bezet zijn of waar een gast naartoe loopt (het reuzenrad draait al
 * zodra er iemand op weg is, want de gast stapt in als zijn bakje langs het perron komt).
 */
export function rideStep(kind: ShopKind, s: RideState, dt: number, aboard: number, rest = false, used = aboard): void {
  s.clock += dt;
  const busy = aboard !== 0;
  // in zo'n acht tellen uit of aan
  s.wake = Math.max(0, Math.min(1, (s.wake ?? 1) + (rest && !busy ? -dt : dt) / RIDE_WAKE));
  if (isLap(kind)) lapStep(kind, s, dt, (aboard | used) !== 0);
  else if (kind === 'ferris') {
    // het reuzenrad draait rustig rond zodra er iemand op of naartoe gaat (meteen op snelheid: de gast rekent erop),
    // en draait leeg in een paar tellen uit; een bakje met gasten slingert wat meer
    s.amp = (used | aboard) !== 0 ? 1 : Math.max(0, s.amp - dt / 2.5);
    s.spin = (s.spin + dt * FERRIS.speed * s.amp) % TAU;
    for (let c = 0; c < FERRIS.cabins; c++) nudge(s, c, (aboard >> (c * FERRIS.per)) & 3 ? 1 : 0, dt * 1.5);
  } else if (kind === 'carousel') {
    s.amp += ((busy ? 1 : 0) - s.amp) * Math.min(1, dt * 1.2);
    s.spin = (s.spin + dt * CAROUSEL.speed * s.amp * cycleSpeed(s.clock % CAROUSEL_CYCLE, CAROUSEL.stop, CAROUSEL.up, CAROUSEL.run, CAROUSEL.down)) % TAU;
  } else if (kind === 'bumper') {
    const c = s.clock % BUMPER_CYCLE;
    stepCars(s.cars, dt, s.clock, c >= BUMPER.stop && c < BUMPER.stop + BUMPER.run ? 1 : 0, aboard);
  } else if (kind === 'fountain') {
    // met kijkers aan de rand spuit het water wat hoger
    s.amp += ((busy ? 1 : 0) - s.amp) * Math.min(1, dt);
  } else if (kind === 'roundabout') {
    // het draaimolentje draait alleen met kinderen erop: het komt rustig op gang en draait leeg langzaam uit
    s.amp += ((busy ? 1 : 0) - s.amp) * Math.min(1, dt * 0.8);
    s.spin = (s.spin + dt * ROUNDABOUT.speed * s.amp) % TAU;
  } else if (PLAY_SPEED[kind]) {
    // speeltoestellen wiegen zachtjes als er niemand op zit en gaan flink heen en weer met een kind erop
    // (de hoek loopt door tot dertig rondjes: dan passen ook de halve en de driedubbele slagen precies)
    s.spin = (s.spin + dt * PLAY_SPEED[kind]!) % (TAU * 30);
    s.amp += ((busy ? 1 : 0) - s.amp) * Math.min(1, dt * 2.5);
    const seats = RIDE_SEATS[kind as RideKind], calm = 0;
    for (let i = 0; i < seats; i++) nudge(s, i, (aboard >> i) & 1 ? 1 : calm, dt * 2.5, calm);
  }
}

/** Is het ritje nu bezig? (De draaimolen draait op snelheid, de botsauto's hebben stroom.) Dan wacht de rij op het pad. */
export function rideRunning(kind: ShopKind, s: RideState): boolean {
  if (kind === 'carousel') return s.clock % CAROUSEL_CYCLE >= CAROUSEL.stop;
  if (kind === 'bumper') return s.clock % BUMPER_CYCLE >= BUMPER.stop;
  if (isLap(kind)) return s.amp > 0;
  return false;
}

/** Hoe hoog een toestel ongeveer is, in tegels: zo kun je er ook op tikken waar het boven zijn tegels uitsteekt (zie tallShopUnder in game.ts). */
export const RIDE_TOP: Partial<Record<ShopKind, number>> = {
  ferris: FERRIS.hub + FERRIS.radius + 0.2, tower: TOWER.top + 1.9, carousel: 3.1, climber: 2.6,
  zipline: ZIPLINE.top0 + 0.3, pirate: PIRATE.nest + 1.2, crawlhill: HILL.top + 0.6, bouncy: 1.7, nestswing: NEST.top + 0.1, ballpit: 1.6, splash: 1.3, bumper: 2.4, slide: 3, fountain: 2.2, swing: 1.7, restaurant: 1.7,
  swinger: SWINGER.top + 1.3, ship: SHIP.pivot + 0.5, airballoon: 3.2, flume: FLUME.top + 0.5, coaster: COASTER.top + 0.4,
};

/**
 * Lichten hoog in de lucht bij een toestel dat ver boven de grond uitsteekt: per licht de plek in het gebouw
 * (x, h, z) en hoe ver het reikt. Het licht om de voet komt van het gebouw zelf (zie shopLights in game.ts).
 */
export const RIDE_GLOW: Partial<Record<ShopKind, [number, number, number, number][]>> = {
  ferris: [[0, FERRIS.hub, 0, 2.75]],
  tower: [[0, TOWER.top + 0.5, 0, 1.3]],
  carousel: [[0, 1.9, 0, 1.5]],
  swinger: [[0, 2.6, 0, 1.9]],
  ship: [[0, SHIP.pivot, 0, 1.8]],
  flume: [[2.9, FLUME.top + 0.3, 0, 1.4], [-2.6, 1, 0, 1.3]],
  coaster: [[2.9, COASTER.top, -1.1, 1.5], [-2.6, 1.2, 0, 1.6], [0.5, 1.2, 0, 1.6]],
};
