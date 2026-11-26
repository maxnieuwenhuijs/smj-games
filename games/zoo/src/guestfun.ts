// Vier dingen om met de gasten te doen: de weg wijzen met je vinger, de schminktent, raad het lievelingsdier en de
// optocht met de clown. Hier staan de getallen en de rekenregels; het spel (game.ts) en de gasten (people.ts)
// gebruiken ze. Alles hier is zonder beeld, zodat het te testen is.
import type { SpeciesId } from './data';

const pickOf = <T>(list: readonly T[], rnd: () => number): T => list[Math.floor(rnd() * list.length)];
function shuffled<T>(list: readonly T[], rnd: () => number): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ------------------------------------------------------------ de weg wijzen
/**
 * De weg wijzen: sleep van een gast die de weg kwijt is naar een plek. `grab`: zo ver (in tegels, zoals bij een tik)
 * mag je naast de gast beginnen; `near`: zo ver van de plek waar je loslaat zoekt hij nog een pad; `fun`: zoveel
 * blijer wordt hij ervan; `line`: zo lang (in tellen) blijft de stippellijn nog staan na het loslaten.
 */
export const WAY = { grab: 0.7, near: 3, fun: 0.15, line: 0.6 };

/** De tegel uit `tiles` die het dichtst bij (gx, gy) ligt, hooguit `near` tegels ver. Null: er is er geen. */
export function nearestTile(tiles: Iterable<number>, gx: number, gy: number, near: number, xy: (tile: number) => [number, number]): number | null {
  let best: number | null = null, bestD = near;
  for (const tile of tiles) {
    const [x, y] = xy(tile);
    const d = Math.hypot(x + 0.5 - gx, y + 0.5 - gy);
    if (d <= bestD) {
      bestD = d;
      best = tile;
    }
  }
  return best;
}

// ------------------------------------------------------------ de schminktent
/** De gezichten die de schminktent kan schilderen. */
export type FacePaint = 'tiger' | 'cat' | 'butterfly' | 'panda';
export const FACE_PAINTS: FacePaint[] = ['tiger', 'cat', 'butterfly', 'panda'];
/** Zo heet een gezicht als keuze bij de tent (en als plaatje). */
export const paintId = (face: FacePaint): `paint_${FacePaint}` => `paint_${face}`;
/** Welk gezicht er nu geschilderd wordt: wat er bij de tent gekozen is, en anders een gok. */
export function paintNext(chosen: readonly string[], rnd: () => number = Math.random): FacePaint {
  return FACE_PAINTS.find(f => chosen.includes(paintId(f))) ?? pickOf(FACE_PAINTS, rnd);
}
/** Zo snel krijgt een kind zin in schmink (hoe hoger, hoe langzamer) en zoveel blijer wordt het ervan. */
export const PAINT = { want: 80, fun: 0.25 };

// ------------------------------------------------------------ raad het lievelingsdier
/** Wat je van een dier kunt raden: zijn kleuren (de eerste is de grootste) en hoeveel poten het heeft. */
export interface Clue {
  colors: string[];
  legs: number;
}
const WHITE = '#f7f4ec', BLACK = '#2a2a2a', GREY = '#9aa0a6', BROWN = '#8a5a3c';
const c = (legs: number, ...colors: string[]): Clue => ({ colors, legs });
/** De hints per dier. Vogels, apen en de kangoeroe lopen op twee benen; zeedieren hebben vinnen en dus geen poten. */
export const CLUES: Record<SpeciesId, Clue> = {
  pig: c(4, '#f3a6b8'), cow: c(4, WHITE, BLACK), sheep: c(4, WHITE), horse: c(4, BROWN), donkey: c(4, GREY), goat: c(4, '#e8dcc8', BROWN),
  alpaca: c(4, '#e9d8b4'), chicken: c(2, WHITE, '#e0584f'), duck: c(2, WHITE, '#f08a24'), rabbit: c(4, '#c9b29a'),
  zebra: c(4, WHITE, BLACK), giraffe: c(4, '#f2c14e', BROWN), lion: c(4, '#e0a84a'), camel: c(4, '#c9a36b'), rhino: c(4, GREY), hippo: c(4, '#8f8aa0'),
  elephant: c(4, GREY), ostrich: c(2, BLACK, WHITE), cheetah: c(4, '#f2c14e', BLACK), gazelle: c(4, '#d9a066', WHITE),
  monkey: c(2, BROWN), parrot: c(2, '#e0584f', '#4a90e2', '#ffd23f'), tiger: c(4, '#f08a24', BLACK), gorilla: c(2, '#3a3a3a'), crocodile: c(4, '#5f8a3a'),
  panda: c(4, WHITE, BLACK), peacock: c(2, '#2b7bd6', '#3aa66a'), toucan: c(2, BLACK, '#f5a623'), sloth: c(4, '#a08a6a'), panther: c(4, BLACK),
  penguin: c(2, BLACK, WHITE), seal: c(0, GREY), polarbear: c(4, WHITE), reindeer: c(4, BROWN), wolf: c(4, GREY), arcticfox: c(4, WHITE),
  bear: c(4, '#6b4a2a'), yak: c(4, '#4a3a2a'), owl: c(2, WHITE, BLACK), walrus: c(0, '#a8745a'),
  flamingo: c(2, '#f48fb1'), turtle: c(4, '#6c9a4a'), otter: c(4, '#6b4a2a'), beaver: c(4, BROWN), pelican: c(2, WHITE, '#f5a623'), koala: c(4, GREY),
  redpanda: c(4, '#d9532b', BLACK), lemur: c(4, GREY, BLACK), bison: c(4, '#5a3a22'), kangaroo: c(2, '#c9875a'),
  dolphin: c(0, '#7fa8c9'), orca: c(0, BLACK, WHITE), ray: c(0, '#7a8a9a'), shark: c(0, '#8a9aa8'),
};
/**
 * De drie plaatjes om uit te kiezen: het goede dier en twee andere die in het park wonen, door elkaar. Liefst twee
 * die er anders uitzien (een andere kleur of een ander aantal poten), zodat je het met de hints kunt raden. Null:
 * er wonen te weinig soorten in het park.
 */
export function guessChoices(answer: string, park: readonly string[], rnd: () => number = Math.random): string[] | null {
  const clue = CLUES[answer as SpeciesId];
  const others = shuffled([...new Set(park)].filter(sp => sp !== answer && CLUES[sp as SpeciesId]), rnd);
  if (!clue || others.length < 2) return null;
  const differs = (sp: string): boolean => CLUES[sp as SpeciesId].legs !== clue.legs || CLUES[sp as SpeciesId].colors[0] !== clue.colors[0];
  const picked = [...others.filter(differs), ...others.filter(sp => !differs(sp))].slice(0, 2);
  return shuffled([answer, ...picked], rnd);
}

// ------------------------------------------------------------ de optocht
/**
 * De optocht met de clown. `seconds`: zo lang duurt hij hooguit; `rest`: zo lang moet je daarna wachten tot de
 * volgende; `reach`: kinderen tot zoveel tegels ver lopen mee; `kids`: zoveel kinderen hooguit; `steps`: zoveel
 * tegels loopt de clown heen (en daarna weer terug naar waar hij begon); `speed`: tegels per tel; `clap`: grote
 * mensen tot zoveel tegels ver klappen mee; `beat`: om de zoveel tellen klinkt de trommel.
 */
export const PARADE = { seconds: 40, rest: 150, reach: 6, kids: 10, steps: 14, speed: 0.95, clap: 4.5, beat: 0.5 };

/**
 * Het rondje van de clown: vanaf `start` steeds een buurtegel (`next`), het liefst een waar hij nog niet was, en
 * niet meteen terug (alleen in een doodlopend stuk keert hij om). Geeft de tegels in volgorde, `start` eerst.
 */
export function paradeLoop(start: number, next: (tile: number) => number[], steps: number, rnd: () => number = Math.random): number[] {
  const route = [start], seen = new Set([start]);
  let at = start, prev = -1;
  for (let i = 0; i < steps; i++) {
    const around = next(at);
    const ahead = around.filter(t => t !== prev);
    const options = ahead.length ? ahead : around;
    if (!options.length) break;
    const fresh = options.filter(t => !seen.has(t));
    const step = pickOf(fresh.length ? fresh : options, rnd);
    prev = at;
    at = step;
    seen.add(step);
    route.push(step);
  }
  return route;
}

/** Hoeveel tellen het nog duurt voor er weer een optocht kan (0: nu meteen). `ended`: wanneer de vorige ophield. */
export const paradeWait = (clock: number, ended: number): number => Math.max(0, ended + PARADE.rest - clock);
