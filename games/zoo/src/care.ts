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
 * Stof op een dier (vanaf FEATURE.hose): van 0 (schoon) tot 1. Gewoon wordt het in `full` tellen helemaal stoffig;
 * een modderliefhebber `mud` keer zo snel, en bij het rollen in de modder komt er per tel `roll` bij. Zwemmen
 * spoelt het meteen af. Vanaf `shows` zie je het: stofjes op de vacht, en vanaf `puffs` af en toe een wolkje.
 */
export const DUST = { full: 600, mud: 1.6, roll: 0.35, shows: 0.3, puffs: 0.85 };

/** Mag dit dier weer een snoepje? `last` is wanneer het zijn vorige kreeg (op de klok van het spel). */
export const treatReady = (last: number | undefined, now: number): boolean => last === undefined || now - last >= TREAT.every;

/** Welk snoepje bij dit dier past: een stukje van zijn eigen voer (een wortel, een vis, een appel, ...). */
export const treatFor = (species: SpeciesId): FoodId => SPECIES[species].food;

/** Zo stoffig is een dier na `dt` tellen. `swimming`: in het water, dan is het meteen schoon. */
export function dustAfter(dust: number, dt: number, o: { species: SpeciesId; aquatic: boolean; swimming: boolean; rolling: boolean }): number {
  if (o.aquatic || o.swimming) return 0;
  const mud = MUD_LOVERS.includes(o.species);
  const rate = (mud ? DUST.mud : 1) / DUST.full + (o.rolling && mud ? DUST.roll : 0);
  return Math.min(1, Math.max(0, dust + rate * dt));
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
