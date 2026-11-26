// De vragen van de puzzeltjes (minigame.ts), zonder scherm: welke som, hoeveel dingen, welk rijtje, welke dieren.
// Hier staan de getallen en de rekenregels. Alles krijgt zijn toeval van buiten (`rnd`), zodat het te testen is.
import { SPECIES, type BedKind, type FoodId, type SpeciesId } from './data';

export type Rnd = () => number;

const int = (n: number, rnd: Rnd): number => Math.floor(rnd() * n);
export const pickOf = <T>(list: readonly T[], rnd: Rnd = Math.random): T => list[int(list.length, rnd)];
export function shuffled<T>(list: readonly T[], rnd: Rnd = Math.random): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = int(i + 1, rnd);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Eentje uit de lijst die nog niet geweest is (`seen`); zijn ze allemaal geweest, dan gewoon een. Onthoudt de keuze. */
export function freshOf<T extends string>(list: readonly T[], seen: Set<string>, rnd: Rnd = Math.random): T {
  const fresh = list.filter(item => !seen.has(item));
  const item = pickOf(fresh.length ? fresh : list, rnd);
  seen.add(item);
  return item;
}

/** Maakt een paar keer een vraag, tot er een komt die nog niet geweest is, en onthoudt hem. */
export function unseen<T>(make: () => T, key: (q: T) => string, seen: Set<string>): T {
  let q = make();
  for (let i = 0; i < 20 && seen.has(key(q)); i++) q = make();
  seen.add(key(q));
  return q;
}

/** Iets anders dan de vorige keer: een gok uit de lijst zonder `last` (als er dan nog iets over is). */
export function pickOther<T>(list: readonly T[], last: T | undefined, rnd: Rnd = Math.random): T {
  const other = list.filter(item => item !== last);
  return pickOf(other.length ? other : list, rnd);
}

/**
 * Kiest het puzzeltje bij een kaartje uit de lijst van dat kaartje. `used`: wat er bij dit kaartje al geweest is, het
 * laatste achteraan: eerst komen ze allemaal een keer aan de beurt, daarna alles behalve het laatste. Liefst ook een
 * andere soort dan het puzzeltje dat het laatst gespeeld is (`lastKind`), zodat er niet twee keer achter elkaar een som
 * komt. `can`: welke nu kunnen (zonder geluid geen 'welk dier maakt dit geluid').
 */
export function pickSetup<T extends { kind: string }>(list: readonly T[], used: readonly T[], lastKind: string, can: (item: T) => boolean = () => true, rnd: Rnd = Math.random): T {
  const able = list.filter(can);
  const pool = able.length ? able : [...list];
  const unused = pool.filter(item => !used.includes(item));
  const fresh = unused.length ? unused : pool.filter(item => item !== used[used.length - 1]);
  const other = fresh.filter(item => item.kind !== lastKind);
  return pickOf(other.length ? other : fresh.length ? fresh : pool, rnd);
}

// ------------------------------------------------------------ som en tellen
/** Het grootste getal in een som of om te tellen: alles blijft onder de tien. */
export const COUNT_MAX = 9;

export interface Sum {
  a: number;
  b: number;
  minus: boolean;
  answer: number;
}
/** Een som onder de tien: a + b (uitkomst 2 tot en met 9) of, vier op de tien keer, a − b (uitkomst 0 tot en met 8). */
export function makeSum(rnd: Rnd = Math.random): Sum {
  if (rnd() < 0.4) {
    const a = 1 + int(COUNT_MAX, rnd), b = 1 + int(a, rnd);
    return { a, b, minus: true, answer: a - b };
  }
  const sum = 2 + int(COUNT_MAX - 1, rnd), a = 1 + int(sum - 1, rnd);
  return { a, b: sum - a, minus: false, answer: sum };
}
export const sumKey = (q: Sum): string => `${q.a}${q.minus ? '-' : '+'}${q.b}`;

/** Drie antwoorden om uit te kiezen, door elkaar: het goede en twee vlak ernaast (van `lo` tot en met `hi`). */
export function answersNear(answer: number, lo: number, hi: number, rnd: Rnd = Math.random): number[] {
  const wrong = shuffled([answer - 2, answer - 1, answer + 1, answer + 2].filter(n => n >= lo && n <= hi), rnd).slice(0, 2);
  return shuffled([answer, ...wrong], rnd);
}

/** Hoeveel dingen er liggen om te tellen: de eerste vraag weinig (1 tot 4), daarna steeds wat meer (tot 9). */
export function makeCount(round: number, rnd: Rnd = Math.random): number {
  const lo = Math.min(1 + round * 2, 5), hi = Math.min(4 + round * 2, COUNT_MAX);
  return lo + int(hi - lo + 1, rnd);
}

/**
 * Waar `n` dingen in een vak liggen: op een rooster van `cols` bij `rows`, elk een klein stukje van het midden van
 * zijn hokje af (hooguit een tiende hokje), zodat het er los uitziet en ze elkaar toch nooit raken. De plekken zijn
 * van 0 tot 1, van links naar rechts en van boven naar beneden.
 */
export function scatter(n: number, rnd: Rnd = Math.random, grid?: { cols: number; rows: number }): { cols: number; rows: number; spots: { x: number; y: number }[] } {
  // zonder vast rooster: ongeveer twee keer zo breed als hoog, net groot genoeg
  const cols = grid?.cols ?? Math.max(2, Math.ceil(Math.sqrt(n * 2))), rows = grid?.rows ?? Math.max(1, Math.ceil(n / cols));
  const cells = shuffled(Array.from({ length: cols * rows }, (_, i) => i), rnd).slice(0, n).sort((a, b) => a - b);
  const spots = cells.map(i => ({
    x: ((i % cols) + 0.5 + (rnd() - 0.5) * 0.2) / cols,
    y: (Math.floor(i / cols) + 0.5 + (rnd() - 0.5) * 0.2) / rows,
  }));
  return { cols, rows, spots };
}

/** Het grootste groepje bij 'waar zijn de meeste', en het rooster waarop elk groepje ligt (overal even groot). */
export const MORE_MAX = 8;
export const MORE_GRID = { cols: 4, rows: 2 };
/**
 * Waar zijn de meeste: `groups` groepjes met elk een ander aantal. Het grootste groepje heeft minstens `gap` meer dan
 * elk ander: met een groot verschil zie je het in één oogopslag, met een klein verschil moet je tellen.
 */
export function makeMore(groups: number, gap: number, rnd: Rnd = Math.random): number[] {
  const lo = groups - 1 + gap;
  const most = lo + int(MORE_MAX - lo + 1, rnd);
  const smaller = shuffled(Array.from({ length: most - gap }, (_, i) => i + 1), rnd).slice(0, groups - 1);
  return shuffled([most, ...smaller], rnd);
}

// ------------------------------------------------------------ rijtje, wat hoort er niet bij, memory
/** De rijtjes die steeds herhalen: per plek welk plaatje (0, 1 of 2). Het eerste (om en om) is het makkelijkst. */
export const PATTERNS: number[][] = [[0, 1], [0, 0, 1], [0, 1, 1], [0, 1, 2]];
/** Zoveel plaatjes van het rijtje zie je; het volgende is de vraag. */
export const PATTERN_SHOWN = 5;
export interface Pattern {
  shown: number[];
  answer: number;
}
/** Een rijtje dat steeds herhaalt, met het volgende plaatje als vraag. De eerste vraag is om en om, daarna een van de langere. */
export function makePattern(round: number, rnd: Rnd = Math.random): Pattern {
  const unit = round <= 0 ? PATTERNS[0] : pickOf(PATTERNS.slice(1), rnd);
  return { shown: Array.from({ length: PATTERN_SHOWN }, (_, i) => unit[i % unit.length]), answer: unit[PATTERN_SHOWN % unit.length] };
}

/**
 * Wat hoort er niet bij: drie uit één groep en één vreemde eend, door elkaar. `families`: groepen die bij elkaar horen
 * staan samen in een familie (eten en drinken, bomen en bloemen); de vreemde eend komt altijd uit een andere familie,
 * zodat er geen twijfel is. `same`: de drie zijn drie keer hetzelfde plaatje (het makkelijkst). Null: er valt niets te kiezen.
 */
export function makeOdd<T>(families: readonly (readonly (readonly T[])[])[], same: boolean, rnd: Rnd = Math.random): { items: T[]; odd: number } | null {
  const homes = families.flatMap((family, f) => family.filter(g => g.length >= (same ? 1 : 3)).map(group => ({ group, f })));
  if (!homes.length) return null;
  const home = pickOf(homes, rnd);
  const three = same ? Array<T>(3).fill(pickOf(home.group, rnd)) : shuffled(home.group, rnd).slice(0, 3);
  const strangers = families.filter((_, f) => f !== home.f).flat(2) as T[];
  if (!strangers.length) return null;
  const odd = int(4, rnd);
  const items = [...three];
  items.splice(odd, 0, pickOf(strangers, rnd));
  return { items, odd };
}

/**
 * Memory. `pairs`: hoeveel paren er in de eerste, tweede en derde ronde liggen. `slack`: missen hoort bij memory;
 * pas met meer missers dan het aantal paren plus dit telt een ronde niet meer als in één keer goed.
 */
export const MEMORY = { pairs: [2, 3, 4], slack: 1 };
export const memoryPairs = (round: number): number => MEMORY.pairs[Math.max(0, Math.min(round, MEMORY.pairs.length - 1))];
/** De kaartjes door elkaar: elk getal van 0 tot `pairs` ligt er twee keer. */
export const dealPairs = (pairs: number, rnd: Rnd = Math.random): number[] => shuffled(Array.from({ length: pairs * 2 }, (_, i) => i >> 1), rnd);
export const memoryClean = (misses: number, pairs: number): boolean => misses <= pairs + MEMORY.slack;

// ------------------------------------------------------------ vragen over dieren
const isSpecies = (sp: string): sp is SpeciesId => sp in SPECIES;

/**
 * De dieren voor een vraag: wat er in het park woont en in `clear` staat (dieren waarbij het antwoord duidelijk is),
 * aangevuld met andere dieren uit `clear` tot er minstens `min` zijn. Zo gaat een vraag het liefst over je eigen dieren.
 */
export function askPool(park: readonly string[], clear: readonly SpeciesId[], min: number, rnd: Rnd = Math.random): SpeciesId[] {
  const own = [...new Set(park)].filter((sp): sp is SpeciesId => clear.includes(sp as SpeciesId));
  const rest = shuffled(clear.filter(sp => !own.includes(sp)), rnd);
  return [...own, ...rest.slice(0, Math.max(0, min - own.length))];
}

/** Voer dat op elkaar lijkt, staat in dezelfde groep: daar kies je nooit tussen (hooi of blaadjes, vlees of vis). */
const FOOD_GROUP: Record<FoodId, number> = { hay: 0, grain: 0, leaves: 0, bamboo: 0, veg: 1, fruit: 1, meat: 2, fish: 2 };
/** Dieren waarvan een kind weet wat ze eten: een leeuw vlees, een pinguïn vis, een panda bamboe, een konijn een wortel. */
export const EAT_CLEAR: SpeciesId[] = [
  'lion', 'tiger', 'cheetah', 'panther', 'wolf', 'crocodile', 'shark',
  'penguin', 'seal', 'dolphin', 'orca', 'pelican', 'otter', 'walrus',
  'panda', 'redpanda', 'giraffe', 'koala', 'sloth',
  'monkey', 'parrot', 'toucan', 'lemur',
  'cow', 'sheep', 'zebra', 'bison', 'reindeer',
  'rabbit', 'pig', 'turtle', 'chicken', 'duck',
];
/** Wat eet dit dier: het goede voer (uit SPECIES) en twee soorten voer die er niet op lijken, door elkaar. */
export function eatChoices(sp: SpeciesId, rnd: Rnd = Math.random): FoodId[] {
  const right = SPECIES[sp].food;
  const wrong = shuffled((Object.keys(FOOD_GROUP) as FoodId[]).filter(f => FOOD_GROUP[f] !== FOOD_GROUP[right]), rnd).slice(0, 2);
  return shuffled([right, ...wrong], rnd);
}

/** Slaapplekken die op elkaar lijken (stro of stal, rots of grot, boom of klimboom): daar kies je nooit tussen. */
const BED_GROUP: Record<BedKind, number> = { straw: 0, shed: 0, rock: 1, cave: 1, shade: 2, climb: 2, nest: 3, coral: 4 };
/**
 * Wie slaapt hier: het dier `answer` en twee dieren die ergens heel anders slapen, door elkaar. Het liefst dieren uit
 * `park`; wonen daar te weinig andere slapers, dan komen er andere dieren bij.
 */
export function bedChoices(answer: SpeciesId, park: readonly string[], rnd: Rnd = Math.random): SpeciesId[] {
  const group = BED_GROUP[SPECIES[answer].bed];
  const far = (sp: string): sp is SpeciesId => isSpecies(sp) && sp !== answer && BED_GROUP[SPECIES[sp].bed] !== group;
  const own = shuffled([...new Set(park)].filter(far), rnd);
  const rest = shuffled((Object.keys(SPECIES) as SpeciesId[]).filter(sp => far(sp) && !own.includes(sp)), rnd);
  return shuffled([answer, ...[...own, ...rest].slice(0, 2)], rnd);
}

/** Dieren met een geluid dat een kind kent. Wie hetzelfde getal heeft, klinkt te veel als de ander (schaap en geit). */
const SOUND_GROUP: Partial<Record<SpeciesId, number>> = {
  cow: 0, pig: 1, sheep: 2, goat: 2, horse: 3, donkey: 4, chicken: 5, duck: 6, lion: 7, tiger: 7, elephant: 8, monkey: 9, owl: 10, wolf: 11, parrot: 12, seal: 13, dolphin: 14,
};
export const SOUND_CLEAR = Object.keys(SOUND_GROUP) as SpeciesId[];
/** Schaduwen die je aan hun vorm herkent (oren, hoorns, een slurf, een snavel). Wie dezelfde naam heeft, lijkt te veel op de ander. */
const SHADOW_GROUP: Partial<Record<SpeciesId, string>> = {
  rabbit: 'ears', kangaroo: 'ears', horse: 'horse', zebra: 'horse', donkey: 'horse', giraffe: 'giraffe', goat: 'horns', gazelle: 'horns', reindeer: 'antlers',
  elephant: 'trunk', crocodile: 'croc', flamingo: 'flamingo', toucan: 'beak', pelican: 'beak', duck: 'beak', ostrich: 'ostrich', peacock: 'peacock', chicken: 'chicken',
  dolphin: 'fish', shark: 'fish', orca: 'fish', ray: 'ray', turtle: 'turtle', rhino: 'rhino', hippo: 'hippo', yak: 'bull', bison: 'bull', cow: 'bull', pig: 'pig',
  wolf: 'wolf', arcticfox: 'wolf', walrus: 'walrus', camel: 'camel', seal: 'seal',
};
export const SHADOW_CLEAR = Object.keys(SHADOW_GROUP) as SpeciesId[];

/**
 * Drie dieren om uit te kiezen, door elkaar: `answer` en twee andere uit `clear` die er volgens `group` niet op lijken
 * (en ook niet op elkaar). Het liefst dieren uit `park`.
 */
function unlikeChoices(answer: SpeciesId, park: readonly string[], group: Partial<Record<SpeciesId, number | string>>, rnd: Rnd): SpeciesId[] {
  const clear = Object.keys(group) as SpeciesId[];
  const order = [...shuffled(clear.filter(sp => park.includes(sp)), rnd), ...shuffled(clear.filter(sp => !park.includes(sp)), rnd)];
  const picked = [answer];
  for (const sp of order) {
    if (picked.length >= 3) break;
    if (!picked.some(p => p === sp || group[p] === group[sp])) picked.push(sp);
  }
  return shuffled(picked, rnd);
}
/** Welk dier maakt dit geluid: het goede dier en twee die heel anders klinken. */
export const soundChoices = (answer: SpeciesId, park: readonly string[], rnd: Rnd = Math.random): SpeciesId[] => unlikeChoices(answer, park, SOUND_GROUP, rnd);
/** Van welk dier is deze schaduw: het goede dier en twee met een heel andere vorm. */
export const shadowChoices = (answer: SpeciesId, park: readonly string[], rnd: Rnd = Math.random): SpeciesId[] => unlikeChoices(answer, park, SHADOW_GROUP, rnd);
