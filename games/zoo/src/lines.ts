// Alles wat de figuren kunnen zeggen. Het spel bouwt zijn zinnen hier, en het stemmenscript
// (tools/voice) vraagt hier de volledige lijst op, zodat elke zin ook ingesproken kan worden.
// Geen DOM en geen Three.js in dit bestand: het draait ook buiten de browser.
import { ALSO, GOAL_OWNER, LEVELS, SPECIES, type FenceNeed, type Goal, type SpeciesId, type WishId, TOY_OF, SPACE, herdOf, SERVES } from './data';
import { FIGURES, type FigureId, type Mood } from './figures';

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
    herd: String(herdOf(sp)),
  };
}

export function goalKey(g: Goal): string {
  if (g.type === 'sold') return g.product ? `goal.sold.${g.product}` : g.shop ? `goal.sold.shop.${g.shop}` : 'goal.sold';
  if (g.type === 'shop') return `goal.shop.${g.shop}${g.n > 1 ? '.n' : ''}`;
  return g.n === 1 && (g.type === 'born' || g.type === 'healed' || g.type === 'caught' || g.type === 'keeper') ? `goal.${g.type}.1` : `goal.${g.type}`;
}

export function goalVars(tr: Tr, g: Goal): Vars {
  return { n: g.n, many: g.species ? tr(`species.${g.species}.many`) : '' };
}

export function goalLine(tr: Tr, g: Goal): Line {
  return { who: GOAL_OWNER[g.type], mood: 'happy', key: goalKey(g), vars: goalVars(tr, g) };
}

/** Een dier wacht al een poos op iets. */
export function wishLine(tr: Tr, wish: WishId, sp: SpeciesId, need: FenceNeed | null, urgent: boolean): Line {
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
  host: (key: 'first' | 'food' | 'drink' | 'toilet' | 'sad' | 'litter' | 'product' | 'new' | 'accident' | 'nopath' | 'dark', mood: Mood = 'worried'): Line => ({ who: 'host', mood, key: `host.${key}` }),
  busy: (kind: string): Line => ({ who: 'host', mood: 'worried', key: `host.busy.${kind}` }),
  cash: (key: 'short' | 'full' | 'wage'): Line => ({ who: 'cashier', mood: key === 'full' ? 'happy' : 'worried', key: `cash.${key}` }),
  hiredAs: (role: 'feed' | 'clean' | 'fix'): Line => ({ who: 'keeper', mood: 'happy', key: `say.hired.${role}` }),
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
  return [...lines, ...FIGURES.map(who => ({ who, text: callText(tr, name) }))];
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
  const wishes: WishId[] = ['health', 'enclosure', 'food', 'bed', 'terrain', 'friend', 'clean', 'space', 'fun'];
  for (const sp of Object.keys(SPECIES) as SpeciesId[]) {
    for (const wish of wishes) {
      // alleen wat dit dier ook echt kan willen
      if ((wish === 'fun' && !TOY_OF[sp]) || (wish === 'space' && !SPACE[sp])) continue;
      add(wishLine(tr, wish, sp, null, false));
    }
    const need = SPECIES[sp].need;
    if (need) add(wishLine(tr, 'enclosure', sp, need, false));
    add(say.wrongFood(tr, sp));
    add(say.taken(tr, sp));
    add(say.escaped(tr, sp));
  }
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
  for (const key of ['first', 'food', 'drink', 'toilet', 'sad', 'litter', 'product', 'new', 'accident', 'nopath', 'dark'] as const) add(say.host(key));
  add(say.night());
  add(say.aquaNew());
  for (const kind of Object.keys(SERVES)) add(say.busy(kind));
  add(say.cash('short'));
  add(say.cash('full'));
  add(say.cash('wage'));
  add(say.hiredAs('feed'));
  add(say.hiredAs('clean'));
  add(say.hiredAs('fix'));
  return [...out.values()];
}
