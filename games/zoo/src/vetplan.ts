// De dokter (vetgame.ts), zonder scherm: welke spelletjes een bezoek krijgt, en de getallen en rekenregels van elk
// spelletje. Alles hier is zonder beeld en krijgt zijn toeval van buiten (`rnd`), zodat het te testen is.

/** De spelletjes van de dokter: koorts meten, pleisters plakken, het hart zoeken, een doorn eruit, een drankje, een wondje schoonmaken en tanden poetsen. */
export type VetGame = 'thermo' | 'plaster' | 'stetho' | 'thorn' | 'syrup' | 'cotton' | 'teeth';
export const VET_GAMES: VetGame[] = ['thermo', 'plaster', 'stetho', 'thorn', 'syrup', 'cotton', 'teeth'];
/** Een bezoek aan de dokter heeft minstens en hooguit zoveel spelletjes. */
export const VISIT: [number, number] = [2, 3];

/**
 * De getallen van de spelletjes. Afstanden zijn in breedtes van het plaatje van het dier (1 is van rand tot rand).
 *   thermo: zo lang (in tellen) moet je vasthouden tot de thermometer vol is; zoveel komt erbij met één los tikje.
 *   plaster: zoveel zere plekken.
 *   stetho: binnen `near` van het hart klopt het het hardst, vanaf `far` hoor je niets; zo lang (in tellen) moet je daar
 *           blijven; na `help` tellen zoeken licht de plek zachtjes op, zodat niemand blijft steken.
 *   thorn: zo ver moet je de doorn eruit trekken; of zoveel losse tikjes.
 *   syrup: zoveel lepels om uit te kiezen.
 *   cotton: zoveel vieze plekjes; `reach`: zo dichtbij raakt het watje een plekje; `rub`: zo ver moet je eroverheen vegen.
 *   teeth: zoveel tanden; verder net als het watje.
 */
export const VET = {
  thermo: { seconds: 1.7, tap: 0.15 },
  plaster: { spots: 3 },
  stetho: { near: 0.17, far: 0.7, seconds: 0.6, help: 6 },
  thorn: { pull: 0.26, taps: 4 },
  syrup: { spoons: 3 },
  cotton: { spots: 3, reach: 0.15, rub: 0.3 },
  teeth: { teeth: 6, reach: 0.11, rub: 0.22 },
};

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));
function shuffled<T>(list: readonly T[], rnd: () => number): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * De spelletjes van dit bezoek: twee of drie verschillende, door elkaar. `last`: die van het vorige bezoek; het eerste
 * spelletje is nu een ander dan toen, en het zijn nooit precies dezelfde. Zo is elk bezoek anders.
 */
export function pickVisit(last: readonly VetGame[] = [], rnd: () => number = Math.random, games: readonly VetGame[] = VET_GAMES): VetGame[] {
  const n = Math.min(games.length, VISIT[0] + Math.floor(rnd() * (VISIT[1] - VISIT[0] + 1)));
  // wat er de vorige keer niet bij was, komt het eerst aan de beurt
  const order = [...shuffled(games.filter(g => !last.includes(g)), rnd), ...shuffled(games.filter(g => last.includes(g)), rnd)];
  const visit = order.slice(0, n);
  return visit[0] === last[0] && visit.length > 1 ? [visit[1], visit[0], ...visit.slice(2)] : visit;
}

/** Hoe ziek het dier er nog uitziet (1 grijs en sip, 0 weer helemaal op kleur) na `done` van de `total` spelletjes. */
export const sickAfter = (done: number, total: number): number => clamp01(1 - done / Math.max(1, total));

/** De thermometer: hoe vol hij is (0 tot 1) na `dt` tellen vasthouden. */
export const warmUp = (level: number, dt: number): number => clamp01(level + dt / VET.thermo.seconds);

/** Het hart zoeken: hoe hard je het hoort kloppen (0 tot 1) op afstand `d` van het hart. */
export const heartBeat = (d: number): number => clamp01(1 - (d - VET.stetho.near) / (VET.stetho.far - VET.stetho.near));

/**
 * De doorn eruit trekken: hoe ver hij eruit is (0 tot 1) als de vinger (dx, dy) van zijn beginpunt af is. Alleen
 * trekken in de richting (ux, uy) waar de doorn naartoe wijst telt; duwen of opzij schuiven doet niets.
 */
export function thornOut(dx: number, dy: number, ux: number, uy: number): number {
  const len = Math.hypot(ux, uy) || 1;
  return clamp01((dx * ux + dy * uy) / len / VET.thorn.pull);
}

/** Vegen met het watje of de tandenborstel: hoe vies een plekje nog is (1 tot 0) na een veeg van `len` lang eroverheen. */
export const wipe = (dirt: number, len: number, rub: number): number => clamp01(dirt - len / rub);

/**
 * Kiest `n` plekken op het plaatje van het dier, voor pleisters, vieze plekjes of het hart. `solid(x, y)`: zit daar
 * dier (en geen lucht eromheen)? Een plek ligt met een randje eromheen helemaal op het dier, en twee plekken liggen
 * minstens `gap` uit elkaar. Lukt dat niet (een heel smal dier), dan mogen ze dichter bij elkaar; zijn er dan nog te
 * weinig, dan komen er plekken rond het midden bij. Er komen er altijd precies `n` terug.
 */
export function pickSpots(solid: (x: number, y: number) => boolean, n: number, gap: number, rnd: () => number = Math.random): { x: number; y: number }[] {
  const edge = 0.07, grid = 11;
  const inside: { x: number; y: number }[] = [];
  for (let i = 0; i < grid; i++)
    for (let j = 0; j < grid; j++) {
      const x = 0.18 + (i / (grid - 1)) * 0.64, y = 0.2 + (j / (grid - 1)) * 0.62;
      if (solid(x, y) && solid(x - edge, y) && solid(x + edge, y) && solid(x, y - edge) && solid(x, y + edge)) inside.push({ x, y });
    }
  const order = shuffled(inside, rnd);
  let picked: { x: number; y: number }[] = [];
  for (let need = gap; need > 0.05 && picked.length < n; need *= 0.75) {
    picked = [];
    for (const p of order) {
      if (picked.length >= n) break;
      if (picked.every(q => Math.hypot(p.x - q.x, p.y - q.y) >= need)) picked.push(p);
    }
  }
  // nog te weinig: een kringetje rond het midden
  for (let k = 0; picked.length < n; k++) {
    const a = (k / n) * Math.PI * 2 + 0.6;
    picked.push({ x: 0.5 + Math.cos(a) * 0.16, y: 0.52 + Math.sin(a) * 0.16 });
  }
  return picked.slice(0, n);
}
