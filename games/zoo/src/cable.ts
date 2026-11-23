// De kabelbaan: twee huisjes in een rechte lijn, met hoog boven het park een kabel waar stoeltjes aan hangen.
// Hier staan alleen de vaste getallen en de rekensommen; het beeld staat in view.ts, de ritjes in people.ts.

/**
 * `min` en `max`: zoveel tegels liggen de middens van de twee huisjes hooguit en minstens uit elkaar. `r`: de straal
 * van het grote wiel in het huisje; de heenweg en de terugweg liggen zo ver links en rechts van het midden. `low`: zo
 * hoog loopt de kabel in het huisje, `high`: zo hoog boven het park. `ramp`: over zoveel tegels gaat hij omhoog.
 * `hang`: zo ver hangt het stoeltje onder de kabel. `speed`: tegels per tel. `poleGap`: hooguit zo ver tussen twee
 * palen. `price`: munten per ritje. `back`: zo'n deel van de gasten blijft zitten en rijdt weer terug.
 */
export const CABLE = { min: 5, max: 14, r: 0.34, low: 1.05, high: 2.9, ramp: 2.2, hang: 0.62, speed: 0.75, poleGap: 3.5, price: 2, back: 0.3 };

/** Een huisje van de kabelbaan: de linkerbovenhoek, en waar zijn maatje staat (ten opzichte van hemzelf). */
export interface CableEnd {
  x: number;
  y: number;
  link?: [number, number];
}

/** Past de kabel tussen deze twee huisjes? 'line': niet in een rechte lijn, 'near': te dichtbij, 'far': te ver weg. */
export type CableFit = 'ok' | 'line' | 'near' | 'far';

export function cableFit(a: { x: number; y: number }, b: { x: number; y: number }): CableFit {
  if (a.x !== b.x && a.y !== b.y) return 'line';
  const d = cableLength(a, b);
  return d < CABLE.min ? 'near' : d > CABLE.max ? 'far' : 'ok';
}

/** Zoveel tegels liggen de twee huisjes uit elkaar (van midden tot midden). */
export const cableLength = (a: { x: number; y: number }, b: { x: number; y: number }): number => Math.abs(b.x - a.x) + Math.abs(b.y - a.y);

/** Over zoveel tegels gaat de kabel omhoog, vlak buiten het huisje. Bij een korte kabel wat minder. */
const rampOf = (len: number): number => Math.max(0.5, Math.min(CABLE.ramp, len / 2 - 1));

/**
 * Hoe hoog de kabel hangt op `t` tegels van het eerste huisje (bij een kabel van `len` tegels). In de huisjes loopt
 * hij laag langs het wiel, zodat je kunt instappen; daarbuiten gaat hij rustig omhoog en blijft hij hoog.
 */
export function cableHeight(t: number, len: number): number {
  const e = Math.max(0, Math.min(t, len - t) - 1), u = Math.min(1, e / rampOf(len));
  return CABLE.low + (CABLE.high - CABLE.low) * u * u * (3 - 2 * u);
}

/**
 * Waar de palen staan, in tegels vanaf het eerste huisje: waar de kabel boven is, en daartussen zo veel dat ze
 * hooguit `poleGap` uit elkaar staan. Bij een korte kabel staat er één paal in het midden.
 */
export function cablePoles(len: number): number[] {
  const first = 1 + rampOf(len), last = len - first;
  if (last - first < 2) return [len / 2];
  const n = Math.ceil((last - first) / CABLE.poleGap);
  return Array.from({ length: n + 1 }, (_, i) => first + ((last - first) * i) / n);
}

/** Hoe lang de hele lus is: heen, om het wiel, terug en om het andere wiel. */
export const cableLoop = (len: number): number => 2 * len + 2 * Math.PI * CABLE.r;

/** Hoeveel stoeltjes er aan de kabel hangen: 4 bij een korte, hooguit 8 bij een lange. */
export const cableChairs = (len: number): number => Math.max(4, Math.min(8, Math.round(cableLoop(len) / 3.2)));

/**
 * Waar een stoeltje is op afstand `s` langs de lus (bij een kabel van `len` tegels), gezien vanaf het eerste huisje:
 * `a` tegels langs de lijn naar het tweede huisje, `side` opzij (heen aan de + kant, terug aan de - kant), `h` de
 * hoogte van de kabel, en (`mx`, `mz`) de richting waarin het rijdt.
 */
export function cableAt(len: number, s: number): { a: number; side: number; h: number; mx: number; mz: number } {
  const r = CABLE.r, half = Math.PI * r, L = cableLoop(len);
  const u = ((s % L) + L) % L;
  let a: number, side: number, mx: number, mz: number;
  if (u < len) {
    // heen
    [a, side, mx, mz] = [u, r, 1, 0];
  } else if (u < len + half) {
    // om het wiel in het tweede huisje
    const q = (u - len) / r;
    [a, side, mx, mz] = [len + r * Math.sin(q), r * Math.cos(q), Math.cos(q), -Math.sin(q)];
  } else if (u < 2 * len + half) {
    // terug
    [a, side, mx, mz] = [len - (u - len - half), -r, -1, 0];
  } else {
    // om het wiel in het eerste huisje
    const q = (u - 2 * len - half) / r;
    [a, side, mx, mz] = [-r * Math.sin(q), -r * Math.cos(q), -Math.cos(q), Math.sin(q)];
  }
  return { a, side, h: cableHeight(Math.max(0, Math.min(len, a)), len), mx, mz };
}

/** Waar op de lus de stoeltjes bij een huisje langs het wiel gaan: daar stap je uit en in (0 = het eerste huisje). */
export const cableStop = (len: number, end: 0 | 1): number => (end ? len + (Math.PI * CABLE.r) / 2 : cableLoop(len) - (Math.PI * CABLE.r) / 2);

/** Ging een stoeltje van `from` naar `to` (vooruit langs de lus van lengte `L`) langs punt `p`? */
export function cablePassed(from: number, to: number, p: number, L: number): boolean {
  const f = ((from % L) + L) % L, t = ((to % L) + L) % L;
  return f <= t ? f < p && p <= t : p > f || p <= t;
}

/** Hoort `b` bij `a`? Dan wijzen ze naar elkaar. */
const linked = (a: CableEnd, b: CableEnd): boolean =>
  !!a.link && !!b.link && a.x + a.link[0] === b.x && a.y + a.link[1] === b.y && b.x + b.link[0] === a.x && b.y + b.link[1] === a.y;

/** De paren huisjes die samen een kabelbaan zijn: ze wijzen naar elkaar en de kabel past ertussen. */
export function cablePairs<T extends CableEnd>(ends: T[]): [T, T][] {
  const out: [T, T][] = [];
  ends.forEach((a, i) => {
    for (let j = i + 1; j < ends.length; j++) if (linked(a, ends[j]) && cableFit(a, ends[j]) === 'ok') out.push([a, ends[j]]);
  });
  return out;
}

/** Het huisje dat nog op zijn maatje wacht (het laatst gebouwde), of null: dan begin je een nieuwe kabelbaan. */
export function cableOpen<T extends CableEnd>(ends: T[]): T | null {
  const paired = new Set(cablePairs(ends).flat());
  for (let i = ends.length - 1; i >= 0; i--) if (!paired.has(ends[i])) return ends[i];
  return null;
}
