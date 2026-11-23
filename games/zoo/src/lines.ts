// Alles wat de figuren kunnen zeggen. Het spel bouwt zijn zinnen hier, en het stemmenscript
// (tools/voice) vraagt hier de volledige lijst op, zodat elke zin ook ingesproken kan worden.
// Geen DOM en geen Three.js in dit bestand: het draait ook buiten de browser.
import { ALSO, CLIMATE, GOAL_OWNER, LEVELS, PREY_OF, SEASONS, SPECIES, type FenceNeed, type Goal, type Season, type SpeciesId, type WishId, TOY_OF, SPACE, herdOf, SERVES } from './data';
import { STAFF, TEACHERS, type FigureId, type Mood, type TeacherId } from './figures';
import { STAR_FACTORS, type StarFactor } from './stars';

export type Vars = Record<string, string | number>;
export type Tr = (key: string, vars?: Vars) => string;

/** Eén zin van een figuur. */
export interface Line {
  who: FigureId;
  mood: Mood;
  key: string;
  vars?: Vars;
  /** Voor de wachttijd tussen twee dezelfde meldingen. */
  id?: string;
  /**
   * Waar de melding over gaat, in rastercoördinaten: tik je op de melding, dan gaat het beeld daarheen. Het is een
   * functie, zodat het klopt als het dier of de gast intussen verder gelopen is; null als het er niet meer is.
   */
  at?: () => [number, number] | null;
}

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/** Invullen van {zo} in een tekst. */
export function fill(text: string, vars?: Vars): string {
  let s = text;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}

export function speciesVars(tr: Tr, sp: SpeciesId): Vars {
  const the = tr(`species.${sp}.the`);
  const info = SPECIES[sp];
  return {
    the,
    The: cap(the),
    many: tr(`species.${sp}.many`),
    food: tr(`food.${info.food}`).toLowerCase(),
    // met de mix erbij: 'zand met een stukje droog gras en rotsgrond'
    terrain: ALSO[sp]?.length
      ? tr('terrain.mix', { main: tr(`terrain.${info.terrain}.want`), also: ALSO[sp]!.map(k => tr(`terrain.${k}.want`)).join(tr('list.and')) })
      : tr(`terrain.${info.terrain}.want`),
    bed: tr(`bed.${info.bed}.a`),
    toy: TOY_OF[sp] ? tr(`toy.${TOY_OF[sp]}.a`) : '',
    climate: CLIMATE[sp] ? tr(`toy.${CLIMATE[sp]}.a`) : '',
    herd: String(herdOf(sp)),
  };
}

export function goalKey(g: Goal): string {
  if (g.type === 'sold') return g.product ? `goal.sold.${g.product}` : g.shop ? `goal.sold.shop.${g.shop}` : 'goal.sold';
  if (g.type === 'shop') return `goal.shop.${g.shop}${g.n > 1 ? '.n' : ''}`;
  return g.n === 1 && (g.type === 'fed' || g.type === 'born' || g.type === 'healed' || g.type === 'caught' || g.type === 'keeper') ? `goal.${g.type}.1` : `goal.${g.type}`;
}

export function goalVars(tr: Tr, g: Goal): Vars {
  return { n: g.n, many: g.species ? tr(`species.${g.species}.many`) : '' };
}

export function goalLine(tr: Tr, g: Goal): Line {
  return { who: GOAL_OWNER[g.type], mood: 'happy', key: goalKey(g), vars: goalVars(tr, g) };
}

/** Een dier wacht al een poos op iets. */
export function wishLine(tr: Tr, wish: WishId, sp: SpeciesId, need: FenceNeed | null, urgent: boolean, ask?: string): Line {
  // groen en steen: voor alle dieren dezelfde zin (`ask`: 'green.more', 'green.less', 'stone.more' of 'stone.less')
  if (wish === 'wild') return { who: 'keeper', mood: 'worried', key: `alert.wild.${ask ?? 'green.more'}` };
  const fence = wish === 'enclosure' && need;
  return {
    who: wish === 'enclosure' || wish === 'space' ? 'builder' : 'keeper',
    mood: urgent ? 'urgent' : 'worried',
    key: fence ? `alert.${need}` : wish === 'friend' && herdOf(sp) > 2 ? 'alert.herd' : `alert.${wish}`,
    vars: speciesVars(tr, sp),
    id: `alert.${wish}.${sp}`,
  };
}

/** Complimenten bij een gehaald level, elk van een ander figuur en in een andere stijl: praise.1, praise.2, ... */
export const PRAISE: FigureId[] = ['director', 'director', 'keeper', 'builder', 'host', 'cashier', 'director', 'keeper'];
/** Zinnen waarin de naam van de speler voorkomt. Die klinken alleen bij leuke dingen (level gehaald) en bij nood. */
export const NAMED: Record<string, FigureId> = {
  'name.hello': 'director',
  'name.done.1': 'director',
  'name.done.2': 'director',
  'name.done.3': 'keeper',
  'name.done.4': 'builder',
  'name.done.5': 'host',
  'name.help.1': 'keeper',
  'name.help.2': 'keeper',
};

/** De drie soorten zinnen bij een evenement: de vraag om hulp, goed afgelopen en niet gelukt. */
export type EventPart = 'ask' | 'good' | 'bad';
/**
 * Wie er bij een evenement praat, en hoeveel verschillende zinnen er zijn voor de vraag (ask), voor goed afgelopen
 * (good) en voor niet gelukt (bad). Het spel kiest er elke keer een andere uit. Staat er geen `who`, dan praat de juf
 * of de meester van de klas. De teksten heten say.event.<id>.1, say.event.<id>.good.1, say.event.<id>.bad.1, ...
 *   class.sum, class.count, class.draw, class.line, class.guide: wat de klas kan vragen
 *   class.go: de klas laat zien welk dier ze zoekt; class: hoe het puzzeltje afliep; class.bye: de klas gaat naar huis
 */
export const EVENT_SAYS: Record<string, { who?: FigureId; ask: number; good: number; bad: number }> = {
  'class.sum': { ask: 2, good: 0, bad: 0 },
  'class.count': { ask: 2, good: 0, bad: 0 },
  'class.draw': { ask: 2, good: 0, bad: 0 },
  'class.line': { ask: 2, good: 0, bad: 0 },
  'class.guide': { ask: 2, good: 2, bad: 0 },
  'class.go': { ask: 1, good: 0, bad: 0 },
  class: { ask: 0, good: 3, bad: 2 },
  'class.bye': { ask: 0, good: 3, bad: 2 },
  party: { who: 'host', ask: 2, good: 2, bad: 2 },
  celeb: { who: 'host', ask: 2, good: 2, bad: 2 },
  delivery: { who: 'host', ask: 2, good: 2, bad: 2 },
  photo: { who: 'host', ask: 2, good: 2, bad: 2 },
  build: { who: 'builder', ask: 2, good: 2, bad: 2 },
  bedtime: { who: 'keeper', ask: 2, good: 2, bad: 2 },
  crates: { who: 'keeper', ask: 2, good: 2, bad: 2 },
  till: { who: 'cashier', ask: 2, good: 2, bad: 2 },
  mayor: { who: 'director', ask: 2, good: 2, bad: 2 },
};

export const say = {
  praise: (i: number): Line => ({ who: PRAISE[i % PRAISE.length], mood: 'happy', key: `praise.${(i % PRAISE.length) + 1}` }),
  named: (key: string, name: string): Line => ({ who: NAMED[key], mood: key.includes('help') ? 'urgent' : 'happy', key, vars: { name } }),
  welcome: (): Line => ({ who: 'director', mood: 'happy', key: 'say.welcome' }),
  level: (n: number): Line => ({ who: 'director', mood: 'happy', key: `say.level.${n}` }),
  free: (): Line => ({ who: 'director', mood: 'happy', key: 'say.free' }),
  soon: (): Line => ({ who: 'director', mood: 'happy', key: 'say.soon' }),
  done: (): Line => ({ who: 'director', mood: 'happy', key: 'say.done' }),
  pen: (name: string): Line => ({ who: 'builder', mood: 'happy', key: 'say.pen', vars: { name } }),
  penColor: (): Line => ({ who: 'builder', mood: 'happy', key: 'say.pen.color' }),
  bigger: (): Line => ({ who: 'builder', mood: 'happy', key: 'say.bigger' }),
  night: (): Line => ({ who: 'director', mood: 'happy', key: 'say.night' }),
  nightNew: (): Line => ({ who: 'director', mood: 'happy', key: 'say.night.new' }),
  aquaNew: (): Line => ({ who: 'director', mood: 'happy', key: 'say.aqua.new' }),
  reopen: (name: string): Line => ({ who: 'builder', mood: 'happy', key: 'say.reopen', vars: { name } }),
  wrongFood: (tr: Tr, sp: SpeciesId): Line => ({ who: 'keeper', mood: 'worried', key: 'alert.wrongfood', vars: speciesVars(tr, sp) }),
  taken: (tr: Tr, sp: SpeciesId): Line => ({ who: 'keeper', mood: 'urgent', key: 'say.taken', vars: speciesVars(tr, sp) }),
  born: (name: string): Line => ({ who: 'keeper', mood: 'happy', key: 'say.born', vars: { name } }),
  grown: (name: string): Line => ({ who: 'keeper', mood: 'happy', key: 'say.grown', vars: { name } }),
  moved: (name: string): Line => ({ who: 'keeper', mood: 'happy', key: 'say.moved', vars: { name } }),
  sick: (tr: Tr, sp: SpeciesId): Line => wishLine(tr, 'health', sp, null, false),
  healed: (): Line => ({ who: 'keeper', mood: 'happy', key: 'say.healed' }),
  escaped: (tr: Tr, sp: SpeciesId): Line => ({ who: 'keeper', mood: 'urgent', key: 'say.escaped', vars: speciesVars(tr, sp), id: `say.escaped.${sp}` }),
  caught: (): Line => ({ who: 'keeper', mood: 'happy', key: 'say.caught' }),
  hired: (): Line => ({ who: 'keeper', mood: 'happy', key: 'say.hired' }),
  tipKeeper: (): Line => ({ who: 'keeper', mood: 'happy', key: 'say.tip.keeper' }),
  cheer: (i: number): Line => ({ who: CHEERS[i].who, mood: 'happy', key: `cheer.${i + 1}` }),
  decorNew: (): Line => ({ who: 'builder', mood: 'happy', key: 'say.decor.new' }),
  noGate: (): Line => ({ who: 'builder', mood: 'worried', key: 'say.nogate' }),
  staffHow: (): Line => ({ who: 'keeper', mood: 'happy', key: 'say.staff.how' }),
  broken: (): Line => ({ who: 'builder', mood: 'worried', key: 'alert.broken' }),
  funNew: (): Line => ({ who: 'keeper', mood: 'happy', key: 'say.fun.new' }),
  host: (key: 'first' | 'food' | 'drink' | 'toilet' | 'sad' | 'litter' | 'product' | 'new' | 'accident' | 'nopath' | 'dark' | 'astray' | 'rain' | 'wide', mood: Mood = 'worried'): Line => ({ who: 'host', mood, key: `host.${key}` }),
  busy: (kind: string): Line => ({ who: 'host', mood: 'worried', key: `host.busy.${kind}` }),
  cash: (key: 'short' | 'full' | 'wage'): Line => ({ who: 'cashier', mood: key === 'full' ? 'happy' : 'worried', key: `cash.${key}` }),
  hiredAs: (role: 'feed' | 'clean' | 'fix' | 'vet' | 'guide' | 'photo'): Line => ({ who: 'keeper', mood: 'happy', key: `say.hired.${role}` }),
  /** Het weetje van een diersoort, verteld door de verzorger. */
  fact: (sp: SpeciesId): Line => ({ who: 'keeper', mood: 'happy', key: `fact.${sp}` }),
  climateNew: (): Line => ({ who: 'keeper', mood: 'happy', key: 'say.climate.new' }),
  wildNew: (): Line => ({ who: 'keeper', mood: 'happy', key: 'say.wild.new' }),
  /** Vanaf FEATURE.safe: sommige dieren zijn bang voor elkaar. */
  safeNew: (): Line => ({ who: 'keeper', mood: 'happy', key: 'say.safe.new' }),
  /** `prey` is bang voor `hunter` in hetzelfde verblijf: "De zebra's zijn bang voor de leeuw!" */
  scared: (tr: Tr, prey: SpeciesId, hunter: SpeciesId): Line => ({
    who: 'keeper',
    mood: 'worried',
    key: 'alert.safe',
    vars: { many: tr(`species.${prey}.many`), hunter: tr(`species.${hunter}.the`) },
    id: `alert.safe.${prey}`,
  }),
  tapAnimal: (): Line => ({ who: 'keeper', mood: 'happy', key: 'say.tap.animal' }),
  rare: (): Line => ({ who: 'keeper', mood: 'happy', key: 'say.rare' }),
  pals: (): Line => ({ who: 'keeper', mood: 'happy', key: 'say.pals' }),
  season: (season: Season): Line => ({ who: 'director', mood: 'happy', key: `say.season.${season}` }),
  rain: (): Line => ({ who: 'host', mood: 'worried', key: 'say.rain' }),
  rainbow: (): Line => ({ who: 'director', mood: 'happy', key: 'say.rainbow' }),
  celebHappy: (): Line => ({ who: 'host', mood: 'happy', key: 'say.celeb.happy' }),
  lost: (): Line => ({ who: 'host', mood: 'urgent', key: 'say.lost' }),
  // evenementen: de uitleg bij het eerste kaartje, en per evenement de vraag om hulp en hoe het afliep (goed of niet)
  eventNew: (): Line => ({ who: 'host', mood: 'happy', key: 'say.event.new' }),
  /** Zin nummer `n` (vanaf 0) van een evenement uit EVENT_SAYS. `teacher`: wie er praat als het de klas is. */
  event: (id: string, part: EventPart, n: number, teacher: TeacherId = 'teacher'): Line => ({
    who: EVENT_SAYS[id].who ?? teacher,
    mood: part === 'bad' ? 'worried' : 'happy',
    key: `say.event.${id}${part === 'ask' ? '' : `.${part}`}.${n + 1}`,
  }),
  found: (): Line => ({ who: 'host', mood: 'happy', key: 'say.found' }),
  trainOne: (): Line => ({ who: 'builder', mood: 'happy', key: 'say.train.one' }),
  trainGo: (): Line => ({ who: 'builder', mood: 'happy', key: 'say.train.go' }),
  /** De tribune past hier niet: die moet tegen de bak van de dolfijnen staan. En de eerste show begint. */
  showWhere: (): Line => ({ who: 'builder', mood: 'worried', key: 'say.show.where' }),
  showFirst: (): Line => ({ who: 'host', mood: 'happy', key: 'say.show.first' }),
  dirty: (): Line => ({ who: 'host', mood: 'worried', key: 'say.dirty' }),
  vetHow: (): Line => ({ who: 'keeper', mood: 'worried', key: 'say.vet.how' }),
  pettingNew: (): Line => ({ who: 'builder', mood: 'happy', key: 'say.petting.new' }),
  pettingOpen: (): Line => ({ who: 'host', mood: 'happy', key: 'say.petting.open' }),
  pettingSmall: (): Line => ({ who: 'builder', mood: 'worried', key: 'say.petting.small' }),
  pettingGate: (): Line => ({ who: 'builder', mood: 'worried', key: 'say.petting.gate' }),
  /** De sterren van het park: de uitleg, een ster erbij (2 tot 5) en een tip als er een ster af ging. */
  starsNew: (): Line => ({ who: 'director', mood: 'happy', key: 'say.stars.new' }),
  stars: (n: number): Line => ({ who: 'director', mood: 'happy', key: `say.stars.${n}` }),
  starsTip: (about: StarFactor): Line => ({ who: 'host', mood: 'happy', key: `say.stars.tip.${about}`, id: 'say.stars.tip' }),
  /** Het water in een bak van glas is vies, en de tip daarna: een waterfilter. */
  murky: (): Line => ({ who: 'keeper', mood: 'worried', key: 'alert.murky' }),
  filterTip: (): Line => ({ who: 'keeper', mood: 'happy', key: 'say.filter.tip' }),
};

/** De tekst van een zin, zoals hij op het scherm komt en wordt uitgesproken. */
export const textOf = (tr: Tr, line: Line): string => tr(line.key, line.vars);

/**
 * Sleutel van het geluidsbestand bij een zin: een korte vingerafdruk van wie het zegt en wat er gezegd
 * wordt. Het spel en het stemmenscript rekenen hem allebei zo uit.
 */
export function voiceId(who: string, text: string): string {
  let h1 = 0x811c9dc5, h2 = 0x1b873593;
  const s = `${who}|${text}`;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193);
    h2 = Math.imul(h2 ^ c, 0x85ebca6b) ^ (h2 >>> 13);
  }
  return (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
}

/** De zinnen met de naam van één speler erin. */
export function namedLines(tr: Tr, name: string): { who: FigureId; text: string }[] {
  const lines = Object.keys(NAMED).map(key => {
    const line = say.named(key, name);
    return { who: line.who, text: textOf(tr, line) };
  });
  // elk figuur kan de speler ook alleen bij zijn naam roepen, vlak voor een gewone melding: "Senna, ..."
  return [...lines, ...STAFF.map(who => ({ who, text: callText(tr, name) }))];
}

/** De aanroep vóór een melding: alleen de naam. */
export const callText = (tr: Tr, name: string): string => tr('name.call', { name });

/** Elke zin die in het spel kan klinken, één keer. */
/**
 * Complimentjes tussendoor, als het goed gaat. `about`: waar het over gaat, zodat het klopt met wat je ziet
 * (blije dieren, blije gasten, een mooi park, een goed gevulde kas).
 */
export const CHEERS: { who: FigureId; about: 'animals' | 'guests' | 'park' | 'coins' }[] = [
  { who: 'keeper', about: 'animals' },
  { who: 'keeper', about: 'animals' },
  { who: 'host', about: 'guests' },
  { who: 'host', about: 'guests' },
  { who: 'director', about: 'park' },
  { who: 'director', about: 'park' },
  { who: 'builder', about: 'park' },
  { who: 'cashier', about: 'coins' },
];

export function allLines(tr: Tr): { who: FigureId; text: string }[] {
  const out = new Map<string, { who: FigureId; text: string }>();
  const add = (line: Line): void => {
    const text = textOf(tr, line);
    out.set(voiceId(line.who, text), { who: line.who, text });
  };
  add(say.welcome());
  PRAISE.forEach((_, i) => add(say.praise(i)));
  add(say.free());
  add(say.soon());
  add(say.done());
  LEVELS.forEach((level, i) => {
    add(say.level(i + 1));
    for (const g of level.goals) add(goalLine(tr, g));
  });
  add(say.penColor());
  add(say.bigger());
  for (const name of tr('names.pens').split(',')) {
    add(say.pen(name));
    add(say.reopen(name));
  }
  for (const name of [...tr('names.boys').split(','), ...tr('names.girls').split(',')]) {
    add(say.born(name));
    add(say.grown(name));
    add(say.moved(name));
  }
  const wishes: WishId[] = ['health', 'enclosure', 'food', 'bed', 'terrain', 'friend', 'clean', 'space', 'fun', 'climate'];
  for (const sp of Object.keys(SPECIES) as SpeciesId[]) {
    for (const wish of wishes) {
      // alleen wat dit dier ook echt kan willen
      if ((wish === 'fun' && !TOY_OF[sp]) || (wish === 'space' && !SPACE[sp]) || (wish === 'climate' && !CLIMATE[sp])) continue;
      add(wishLine(tr, wish, sp, null, false));
    }
    const need = SPECIES[sp].need;
    if (need) add(wishLine(tr, 'enclosure', sp, need, false));
    add(say.wrongFood(tr, sp));
    add(say.taken(tr, sp));
    add(say.escaped(tr, sp));
    add(say.fact(sp));
    // bang voor een roofdier: één zin per roofdier en dier dat bang voor hem is
    for (const prey of PREY_OF[sp] ?? []) add(say.scared(tr, prey, sp));
  }
  add(say.safeNew());
  add(say.healed());
  add(say.caught());
  add(say.hired());
  add(say.funNew());
  add(say.broken());
  add(say.noGate());
  add(say.staffHow());
  add(say.decorNew());
  CHEERS.forEach((_, i) => add(say.cheer(i)));
  add(say.tipKeeper());
  add(say.tapAnimal());
  for (const key of ['first', 'food', 'drink', 'toilet', 'sad', 'litter', 'product', 'new', 'accident', 'nopath', 'dark', 'astray', 'rain', 'wide'] as const) add(say.host(key));
  for (const season of SEASONS) add(say.season(season));
  for (const ask of ['green.more', 'green.less', 'stone.more', 'stone.less']) add(wishLine(tr, 'wild', 'pig', null, false, ask));
  for (const line of [say.climateNew(), say.wildNew(), say.rare(), say.pals(), say.rain(), say.rainbow(), say.celebHappy(), say.lost(), say.found(), say.trainOne(), say.trainGo(),
    say.dirty(), say.vetHow(), say.pettingNew(), say.pettingOpen(), say.pettingSmall(), say.pettingGate(), say.murky(), say.filterTip(), say.showWhere(), say.showFirst()]) add(line);
  add(say.eventNew());
  add(say.starsNew());
  for (let n = 2; n <= 5; n++) add(say.stars(n));
  for (const about of STAR_FACTORS) add(say.starsTip(about));
  // elke variant van elk evenement; wat de klas zegt, is er in de stem van de juf en in die van de meester
  for (const [id, e] of Object.entries(EVENT_SAYS))
    for (const who of e.who ? [undefined] : TEACHERS)
      for (const part of ['ask', 'good', 'bad'] as const)
        for (let n = 0; n < e[part]; n++) add(say.event(id, part, n, who));
  // de uitleg bij een puzzeltje, in de stem van wie om hulp vroeg
  for (const who of ['host', 'keeper', 'builder', 'cashier', 'director', 'teacher', 'master'] as const)
    for (const key of ['mini.sum.plus', 'mini.sum.minus', 'mini.spell', 'mini.order.size', 'mini.order.count', 'mini.done.good', 'mini.done.try']) add({ who, mood: 'happy', key });
  // het park gaat om middernacht dicht en om zeven uur weer open
  add({ who: 'director', mood: 'happy', key: 'say.park.closed' });
  add({ who: 'director', mood: 'happy', key: 'say.park.open' });
  add(say.night());
  add(say.nightNew());
  add(say.aquaNew());
  for (const kind of Object.keys(SERVES)) add(say.busy(kind));
  add(say.cash('short'));
  add(say.cash('full'));
  add(say.cash('wage'));
  add(say.hiredAs('feed'));
  add(say.hiredAs('clean'));
  add(say.hiredAs('fix'));
  add(say.hiredAs('vet'));
  add(say.hiredAs('guide'));
  add(say.hiredAs('photo'));
  return [...out.values()];
}
