// Zorgen met de hand: een snoepje gooien en een dier wassen met de tuinslang. Hier staan de regels en de getallen;
// het tekenen staat in carefx.ts en het spelen in game.ts.
import { MUD_LOVERS, SPECIES, type FoodId, type SpeciesId } from './data';

/** De twee dingen bij de actieknop om voor een dier te zorgen: het zakje met snoepjes en de tuinslang. */
export type CareAction = 'treat' | 'hose';
export const CARE_ACTIONS: CareAction[] = ['treat', 'hose'];
export const isCare = (action: string): action is CareAction => (CARE_ACTIONS as string[]).includes(action);

/**
 * Een snoepje: gratis, maar elk dier krijgt er hooguit één per `every` tellen. Het dier heeft daarna wat minder
 * honger (`hunger` eraf), is `glee` tellen extra blij en het verwaarlozen loopt `neglect` terug.
 */
export const TREAT = { every: 60, hunger: 0.3, glee: 45, neglect: 40 };

/** Het vangen: zo lang duurt de sprong (in het midden is het snoepje er), en daarna het smullen. */
export const CATCH = { up: 0.6, munch: 1.6 };

/**
 * De tuinslang: na `soak` tellen water is een dier schoon. Het blijft `keep` tellen nat (zo lang hoef je niet
 * opnieuw te beginnen als je even loslaat). Daarna is het `glee` tellen extra blij en loopt het verwaarlozen terug.
 * Een modderliefhebber gaat na `mudBack` tellen (van ... tot) weer lekker in de modder rollen.
 */
export const HOSE = { soak: 1.2, keep: 3, glee: 40, neglect: 25, mudBack: [20, 40] as [number, number] };

/**
 * Stof op een dier (vanaf FEATURE.hose): van 0 (schoon) tot 1. Een gewoon dier is gemiddeld in `full` tellen helemaal
 * stoffig, maar elk dier heeft zijn eigen tempo (`pace`: van ... tot ... keer zo snel, zie dustPace): zo is het niet
 * steeds hetzelfde dier dat vies wordt. Zwemmen spoelt het meteen af. Vanaf `shows` zie je het: stofjes op de vacht,
 * en vanaf `puffs` af en toe een wolkje. Vanaf `dirty` wil het dier gewassen worden; een dier dat nog niet aan de
 * beurt is om vies te worden (zie DIRTY) blijft op `held` hangen. Regen spoelt er per bui een beetje af: in `rain`
 * tellen regen zou een dier helemaal schoon zijn.
 */
export const DUST = { full: 900, pace: [0.55, 1.6] as [number, number], shows: 0.3, puffs: 0.85, dirty: 0.9, held: 0.88, rain: 300 };
/**
 * Modder op de vacht van een modderliefhebber die net gerold heeft: per tel rollen komt er `roll` bij (tot `top`), en
 * in `fade` tellen is het er weer af. Je ziet het als bruine vlekjes, maar gewassen hoeft het dier daar niet voor te
 * worden: anders zijn het steeds de varkens die vies zijn.
 */
export const MUDDY = { roll: 0.3, top: 0.8, fade: 240 };
/**
 * Hoeveel dieren er tegelijk vies mogen zijn: `base`, en één erbij per `per` dieren in het park, hooguit `max`. En
 * tussen twee dieren die vies worden zit minstens `gap` tellen: zo is het bij te houden, ook in een groot park.
 */
export const DIRTY = { base: 2, per: 12, max: 6, gap: 120 };
/** Zo stoffig wil een dier gewassen worden: dan is de wens 'schoon' niet vervuld (zie animal.ts). */
export const dusty = (dust: number): boolean => dust >= DUST.dirty;
/** Het eigen tempo van een dier, uit een gok tussen 0 en 1: de een wordt bijna drie keer zo snel vies als de ander. */
export const dustPace = (roll: number): number => DUST.pace[0] + (DUST.pace[1] - DUST.pace[0]) * Math.min(1, Math.max(0, roll));
/** Zoveel dieren mogen er in een park met `animals` dieren tegelijk vies zijn. */
export const dirtyMost = (animals: number): number => Math.min(DIRTY.max, DIRTY.base + Math.floor(animals / DIRTY.per));

/** Mag dit dier weer een snoepje? `last` is wanneer het zijn vorige kreeg (op de klok van het spel). */
export const treatReady = (last: number | undefined, now: number): boolean => last === undefined || now - last >= TREAT.every;

/** Welk snoepje bij dit dier past: een stukje van zijn eigen voer (een wortel, een vis, een appel, ...). */
export const treatFor = (species: SpeciesId): FoodId => SPECIES[species].food;

/**
 * Zo stoffig is een dier na `dt` tellen. `swimming`: in het water, dan is het meteen schoon. `pace`: het eigen tempo
 * van dit dier (zie dustPace). `room`: mag dit dier nu vies worden? Zo niet, dan blijft het vlak onder de grens hangen
 * tot het aan de beurt is. Een dier dat al vies is, blijft vies tot het gewassen wordt.
 */
export function dustAfter(dust: number, dt: number, o: { aquatic: boolean; swimming: boolean; pace?: number; room?: boolean }): number {
  if (o.aquatic || o.swimming) return 0;
  let next = dust + ((o.pace ?? 1) / DUST.full) * dt;
  if (o.room === false && dust < DUST.dirty) next = Math.min(next, DUST.held);
  return Math.min(1, Math.max(0, next));
}

/** Hoeveel modder er na `dt` tellen op de vacht zit: het komt erbij als een modderliefhebber rolt, en slijt er langzaam weer af. */
export function muddyAfter(muddy: number, dt: number, o: { species: SpeciesId; swimming: boolean; rolling: boolean }): number {
  if (o.swimming) return 0;
  if (o.rolling && MUD_LOVERS.includes(o.species)) return Math.min(MUDDY.top, muddy + MUDDY.roll * dt);
  return Math.max(0, muddy - dt / MUDDY.fade);
}

/** Hoeveel stofjes je op het dier ziet: geen onder DUST.shows, en zes als het helemaal stoffig is. */
export const dustSpecks = (dust: number): number => (dust < DUST.shows ? 0 : Math.min(6, 2 + Math.floor(((dust - DUST.shows) / (1 - DUST.shows)) * 5)));

/** Hoe lang het snoepje onderweg is, voor zoveel tegels: dichtbij kort, ver weg iets langer. */
export const flightTime = (dist: number): number => Math.min(1.3, Math.max(0.7, 0.55 + dist * 0.08));

/**
 * Waar het snoepje is op deel `p` (0 tot 1) van zijn vlucht: in een boog van `from` naar `to` (gx, gy, hoogte),
 * met de top `rise` boven het hoogste van de twee.
 */
export function arcAt(from: [number, number, number], to: [number, number, number], p: number, rise: number): [number, number, number] {
  const q = Math.min(1, Math.max(0, p));
  const top = Math.max(from[2], to[2]) + rise;
  // een parabool door begin, top en eind: h(q) = a + b q + c q², met h(0) = from, h(1) = to en het hoogste punt `top`
  const a = from[2], d = to[2] - from[2];
  // c en b uit: b + c = d, en het hoogste punt van de boog is top: a - b² / (4c) = top
  const k = top - a;
  // b = 2k + 2√(k² - k d) is de oplossing met de top tussen begin en eind
  const b = 2 * k + 2 * Math.sqrt(Math.max(0, k * k - k * d)), c = d - b;
  return [from[0] + (to[0] - from[0]) * q, from[1] + (to[1] - from[1]) * q, a + b * q + c * q * q];
}
