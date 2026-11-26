// Puzzeltjes die over het park heen komen als een schoolklas of een gast om hulp vraagt. Er zijn dertien soorten:
// een som onder de tien, tellen, waar zijn de meeste, een woord van drie letters leggen, dingen op volgorde zetten,
// memory, wat hoort er niet bij, wat komt er daarna, van welk dier is deze schaduw, wat eet dit dier, wie slaapt hier,
// welk dier maakt dit geluid, en het lievelingsdier van een gast raden aan de hand van een paar hints.
// Bijna alles gaat met plaatjes: de dingen van het evenement (kisten, munten, ballonnen) of de dieren uit het park.
// Het spel roept playMini aan en hoort via onDone hoe het ging. Wegklikken met het kruisje mag altijd.
// Welke som, welk rijtje en welke dieren er komen, staat in miniask.ts (zonder scherm, met tests).
import './minigame.css';
import { t } from '@smj/shared';
import { sfx } from './audio';
import { SPECIES, type SpeciesId } from './data';
import { ICON_IDS, icon, type IconId } from './icons';
import {
  COUNT_MAX, EAT_CLEAR, MORE_GRID, SHADOW_CLEAR, SOUND_CLEAR, answersNear, askPool, bedChoices, dealPairs, eatChoices, freshOf, makeCount, makeMore, makeOdd, makePattern, makeSum,
  memoryClean, memoryPairs, scatter, shadowChoices, soundChoices, sumKey, unseen,
} from './miniask';
import { speciesIcon } from './models';

export type MiniKind = 'sum' | 'count' | 'more' | 'spell' | 'order' | 'memory' | 'odd' | 'pattern' | 'shadow' | 'eat' | 'bed' | 'sound' | 'guess';
/** Alle soorten puzzeltjes op een rij (voor de proefpagina). */
export const MINI_KINDS: MiniKind[] = ['sum', 'count', 'more', 'spell', 'order', 'memory', 'odd', 'pattern', 'shadow', 'eat', 'bed', 'sound', 'guess'];
export interface MiniResult { won: boolean; right: number; rounds: number; skipped: boolean }
export interface MiniOptions {
  kind: MiniKind;
  /** Hoeveel vragen achter elkaar; gewoon drie (bij raden één, bij memory twee). */
  rounds?: number;
  /** Klein plaatje bovenaan (al HTML, bijvoorbeeld een svg van icon()); mag ontbreken. */
  picture?: string;
  /**
   * Waarmee geteld, gerekend en gelegd wordt: de plaatjes die bij het evenement horen (kisten, munten, ballonnen).
   * Zonder: een paar gewone dingen (een appel, een bal, een ster).
   */
  things?: IconId[];
  /** Het gaat over dieren: een woord van een dier (koe, aap, kip), of tellen, rekenen en leggen met de dieren zelf. */
  animals?: boolean;
  /** De diersoorten die in het park wonen: een vraag gaat het liefst over je eigen dieren. */
  park?: string[];
  /** Volgorde: waarmee het begint, plaatjes van klein naar groot ('size') of groepjes van weinig naar veel ('count'). Anders is dat een gok. */
  first?: 'size' | 'count';
  /**
   * Raden: het goede dier, de plaatjes om uit te kiezen (soorten) en de hints: de kleuren van het dier en hoeveel
   * poten het heeft. `sound`: speelt het geluid van het dier (de knop met de luidspreker).
   */
  guess?: { answer: string; options: string[]; colors: string[]; legs: number; sound?: () => void };
  /** Welk dier maakt dit geluid: speelt het geluid van deze diersoort. Zonder dit wordt die puzzel een schaduw raden. */
  sound?: (species: string) => void;
  /** De uitleg boven de vraag wordt hiermee voorgelezen (de tekst zelf staat er ook); mag ontbreken. */
  say?: (text: string) => void;
  /** Eén keer aangeroepen: als het puzzeltje klaar is of met het kruisje is weggeklikt. */
  onDone: (result: MiniResult) => void;
}

// ------------------------------------------------------------ woorden
/** Een woord met zijn plaatje: een getekend plaatje (icons.ts) of het kopplaatje van een diersoort. */
interface Word {
  word: string;
  icon?: IconId;
  species?: string;
}
const WORDS_NL: Word[] = [
  { word: 'koe', species: 'cow' },
  { word: 'aap', species: 'monkey' },
  { word: 'kip', species: 'chicken' },
  { word: 'uil', species: 'owl' },
  { word: 'jak', species: 'yak' },
  { word: 'rog', species: 'ray' },
  { word: 'vis', icon: 'fish' },
  { word: 'bal', icon: 'ball' },
  { word: 'hek', icon: 'fence' },
  { word: 'bos', icon: 'forest' },
  { word: 'zon', icon: 'sun' },
  { word: 'net', icon: 'net' },
  { word: 'pet', icon: 'cap_red' },
  { word: 'put', icon: 'well' },
  { word: 'wip', icon: 'seesaw' },
  { word: 'sap', icon: 'juice' },
];
const WORDS_EN: Word[] = [
  { word: 'cow', species: 'cow' },
  { word: 'pig', species: 'pig' },
  { word: 'owl', species: 'owl' },
  { word: 'hen', species: 'chicken' },
  { word: 'yak', species: 'yak' },
  { word: 'ray', species: 'ray' },
  { word: 'sun', icon: 'sun' },
  { word: 'net', icon: 'net' },
  { word: 'cap', icon: 'cap_red' },
  { word: 'hat', icon: 'hat_straw' },
  { word: 'log', icon: 'log' },
  { word: 'bin', icon: 'bin' },
  { word: 'hay', icon: 'hay' },
];
/** Letters voor de verkeerde tegels: gewone letters die een kind al vroeg leert. */
const LETTERS = 'abdeghklmnoprstuvz';

// ------------------------------------------------------------ plaatjes
/**
 * Een plaatje om mee te tellen, te rekenen of te leggen: zijn naam (zo weten we wat al geweest is) en de HTML.
 * `small`: wat er in een klein stapeltje op een antwoord ligt, als het plaatje zelf daar te klein voor is.
 */
interface Pic {
  id: string;
  html: string;
  small?: string;
}
/** Gewone dingen die klein en groot goed te herkennen zijn: voor een puzzel zonder eigen plaatjes. */
const THINGS: IconId[] = ['fruit', 'star', 'ball', 'fish', 'heart', 'balloon_red', 'sun', 'veg', 'ducky', 'cake', 'lolly', 'tree', 'balloon_blue', 'hat_party', 'moon', 'gift'];
/** Dieren die elk kind kent: voor een park waar nog te weinig soorten wonen. */
const BEASTS: SpeciesId[] = ['pig', 'cow', 'sheep', 'chicken', 'rabbit', 'duck', 'lion', 'giraffe', 'elephant', 'monkey', 'penguin', 'zebra'];
/**
 * Wat hoort er niet bij: groepen van dingen die bij elkaar horen. Groepen die op elkaar lijken staan samen in één rij
 * (eten en drinken, bomen en bloemen): de vreemde eend komt altijd uit een andere rij. De dieren komen er als rij bij.
 */
const ODD_FAMILIES: IconId[][][] = [
  [['fruit', 'veg', 'fries', 'pancake', 'hotdog', 'cake', 'scoop', 'lolly'], ['lemonade', 'milk', 'juice']],
  [['hat_straw', 'hat_party', 'hat_crown', 'cap_red', 'cap_blue']],
  [['balloon_red', 'balloon_blue', 'balloon_yellow', 'balloon_heart']],
  [['tree', 'pine', 'palm', 'cactus', 'oak', 'cherry'], ['tulips', 'roses', 'sunflowers', 'daisies']],
  [['slide', 'swing', 'seesaw', 'trampoline', 'springer']],
  [['hammer', 'broom', 'rake', 'bucket', 'can']],
];
/** Memory: zo lang (in milliseconden) blijven twee verschillende kaartjes open liggen om te onthouden. */
const MEMORY_PEEK = 1100;

/** Het spel zet de taal op de pagina (main.ts); daar kijken we naar voor de woordenlijst. */
const dutch = (): boolean => document.documentElement.lang.toLowerCase().startsWith('nl');

/** Heeft deze diersoort een eigen plaatje? Zonder geeft speciesIcon een pootje, en daar kun je niets mee raden. */
const hasPicture = (species: string): boolean => speciesIcon(species).startsWith('<img') || (ICON_IDS as string[]).includes(species);
const thingPic = (id: IconId): Pic => ({ id, html: icon(id) });
// een dierenkop is piepklein niet meer te herkennen: in een klein stapeltje ligt er een pootje voor elk dier
const beastPic = (species: string): Pic => ({ id: species, html: speciesIcon(species), small: icon('paw') });

/** Het plaatje bij een woord, of null als dat plaatje er niet is (dan doet het woord niet mee). */
function wordPicture(w: Word): string | null {
  if (w.icon) return icon(w.icon);
  return w.species && hasPicture(w.species) ? speciesIcon(w.species) : null;
}

// ------------------------------------------------------------ hulpjes
const rnd = (n: number): number => Math.floor(Math.random() * n);
const pick = <T>(list: T[]): T => list[rnd(list.length)];
function shuffle<T>(list: T[]): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = rnd(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Een stapeltje van `n` keer hetzelfde plaatje om te tellen, vijf op een rij. De laatste `gone` zijn doorgestreept:
 * die gaan eraf. `cls`: 'a' of 'b' voor de twee stapeltjes van een som, 's' voor het kleine stapeltje op een antwoord.
 */
function pile(pic: string, n: number, cls: string, gone = 0): string {
  let html = '';
  for (let i = 0; i < n; i++) html += `<i${i >= n - gone ? ' class="gone"' : ''}>${pic}</i>`;
  return `<span class="mg-pile ${cls}" style="--n:${Math.max(1, Math.min(5, n))}">${html}</span>`;
}

/** Een antwoord met een getal: het cijfer groot, met eronder zoveel plaatjes om na te tellen. */
const numberTile = (n: number, pic: string): string => `<b>${n}</b>${pile(pic, n, 's')}`;

/**
 * Een vak waarin dingen los door elkaar liggen (zie `scatter`). `pics`: per ding het plaatje. `tag`: 'button' als je
 * de dingen kunt aantikken om mee te tellen, anders 'i'.
 */
function scene(pics: string[], tag: 'button' | 'i', grid?: { cols: number; rows: number }): string {
  const { cols, rows, spots } = scatter(pics.length, Math.random, grid);
  const things = spots.map((p, i) => `<${tag} class="mg-thing"${tag === 'button' ? ' type="button"' : ''} style="left:${(p.x * 100).toFixed(1)}%;top:${(p.y * 100).toFixed(1)}%">${pics[i]}</${tag}>`);
  return `<span class="mg-scene" style="--cols:${cols};--rows:${rows}">${things.join('')}</span>`;
}

const CLOSE_SVG = '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M12 12 L36 36 M36 12 L12 36" fill="none" stroke="#3a2a1a" stroke-width="7" stroke-linecap="round"/></svg>';
const ARROW = '<path d="M46 22 H80 M70 12 L82 22 L70 32" fill="none" stroke="#3a2a1a" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" opacity=".55"/>';
/** Van klein naar groot: een klein rondje, een pijl, een groot rondje. */
const HINT_SIZE = `<svg viewBox="0 0 132 44" aria-hidden="true"><circle cx="22" cy="22" r="7" fill="#4a90e2"/>${ARROW}<circle cx="110" cy="22" r="19" fill="#4a90e2"/></svg>`;
/** Van weinig naar veel: één stip, een pijl, vijf stippen. */
const HINT_COUNT =
  `<svg viewBox="0 0 132 44" aria-hidden="true"><circle cx="22" cy="22" r="6" fill="#f08a2c"/>${ARROW}` +
  '<g fill="#f08a2c"><circle cx="98" cy="10" r="6"/><circle cx="122" cy="10" r="6"/><circle cx="110" cy="22" r="6"/><circle cx="98" cy="34" r="6"/><circle cx="122" cy="34" r="6"/></g></svg>';

// ------------------------------------------------------------ één puzzeltje
interface Session {
  opts: MiniOptions;
  rounds: number;
  /** De hoeveelste vraag (vanaf 0). */
  round: number;
  /** Per vraag die klaar is: in één keer goed? */
  marks: boolean[];
  /** Deze vraag nog zonder fout. */
  clean: boolean;
  /** Tussen twee vragen in: tikken doet even niets. */
  busy: boolean;
  /** De sterren staan er: een tik sluit het puzzeltje. */
  result: boolean;
  since: number;
  timer: number;
  /** Wat al geweest is, zodat dezelfde som, hetzelfde woord of hetzelfde plaatje niet twee keer komt. */
  seen: Set<string>;
  /** Volgorde: om en om plaatjes en getallen. */
  sizes: boolean;
  /** De plaatjes van dit puzzeltje: de dingen van het evenement of, als het over dieren gaat, de dieren uit het park. */
  pics: Pic[];
  /** De diersoorten uit het park die een eigen plaatje hebben (met te weinig soorten: een paar bekende dieren erbij). */
  park: string[];
}

let root: HTMLDivElement | null = null;
let session: Session | null = null;

const part = (cls: string): HTMLElement => root!.querySelector<HTMLElement>(`.${cls}`)!;
const buttons = (): HTMLButtonElement[] => [...root!.querySelectorAll<HTMLButtonElement>('.mg-body .mg-btn')];
const slots = (): HTMLElement[] => [...root!.querySelectorAll<HTMLElement>('.mg-slot')];

function ensureRoot(): HTMLDivElement {
  if (root) return root;
  root = document.createElement('div');
  root.id = 'minigame';
  root.hidden = true;
  root.innerHTML =
    '<div class="mg-card" role="dialog" aria-modal="true">' +
    `<button class="mg-close" type="button"><span>${CLOSE_SVG}</span></button>` +
    '<div class="mg-head"><span class="mg-pic"></span><span class="mg-pips"></span></div>' +
    '<div class="mg-title"></div><div class="mg-body"></div></div>';
  document.body.append(root);
  root.addEventListener('click', e => {
    const s = session;
    if (!s) return;
    if ((e.target as Element).closest('.mg-close')) stop();
    // niet meteen: anders tikt een kind de sterren weg voordat het ze gezien heeft
    else if (s.result && performance.now() - s.since > 350) finish(false);
  });
  root.addEventListener('contextmenu', e => e.preventDefault());
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape') stop();
  });
  return root;
}

/** Doet iets een poosje later, maar alleen als dit puzzeltje dan nog open is. */
function later(s: Session, ms: number, fn: () => void): void {
  clearTimeout(s.timer);
  s.timer = window.setTimeout(() => {
    if (session === s) fn();
  }, ms);
}

function finish(skipped: boolean): void {
  const s = session;
  if (!s || !root) return;
  session = null;
  clearTimeout(s.timer);
  root.hidden = true;
  part('mg-body').innerHTML = '';
  const right = s.marks.filter(Boolean).length;
  // gewonnen: minstens twee derde van de vragen in één keer goed
  s.opts.onDone({ won: !skipped && right * 3 >= s.rounds * 2, right, rounds: s.rounds, skipped });
}

/** Dicht voordat het klaar is: dat telt als overgeslagen. Staan de sterren er al, dan telt de uitslag gewoon. */
function stop(): void {
  finish(!session?.result);
}

/** De sterren bovenaan: goed gedaan is geel, de vraag van nu beweegt, de rest is grijs. */
function drawPips(s: Session): void {
  let html = '';
  for (let i = 0; i < s.rounds; i++) html += `<span class="mg-pip${s.marks[i] ? ' ok' : i === s.round && i >= s.marks.length ? ' now' : ''}">${icon('star')}</span>`;
  part('mg-pips').innerHTML = html;
}

/** Wie de uitleg voorleest, en wat er het laatst gezegd is: dezelfde zin klinkt niet bij elke vraag opnieuw. */
let speak: ((text: string) => void) | null = null;
let spoken = '';
function tell(text: string): void {
  if (text === spoken) return;
  spoken = text;
  speak?.(text);
}

function show(title: string, html: string): void {
  part('mg-title').textContent = title;
  tell(title);
  part('mg-body').innerHTML = `<div class="mg-round">${html}</div>`;
}

/** Fout getikt: de tegel schudt, en deze vraag telt niet meer als in één keer goed. */
function miss(s: Session, b: HTMLElement, cls: 'no' | 'oops'): void {
  s.clean = false;
  sfx('nope', { volume: 0.6, every: 0.2 });
  b.classList.remove(cls);
  void b.offsetWidth; // zo begint het schudden opnieuw bij een tweede fout
  b.classList.add(cls);
}

/** De vraag is opgelost: even laten zien, dan de volgende vraag of de sterren. */
function roundDone(s: Session): void {
  s.busy = true;
  s.marks.push(s.clean);
  drawPips(s);
  // wat tot nu toe verborgen was (de getallen bij de groepjes, de kleuren van een schaduw) mag nu gezien worden
  part('mg-body').firstElementChild?.classList.add('done');
  sfx('chime');
  later(s, 850, () => {
    s.round++;
    if (s.round < s.rounds) startRound(s);
    else showResult(s);
  });
}

function startRound(s: Session): void {
  s.clean = true;
  s.busy = false;
  drawPips(s);
  ROUNDS[s.opts.kind](s);
}

function showResult(s: Session): void {
  const right = s.marks.filter(Boolean).length;
  const won = right * 3 >= s.rounds * 2;
  s.result = true;
  s.since = performance.now();
  part('mg-card').classList.add('done');
  part('mg-title').textContent = t(won ? 'mini.done.good' : 'mini.done.try');
  tell(t(won ? 'mini.done.good' : 'mini.done.try'));
  // eerst de gele sterren, dan de grijze: zo tel je makkelijk hoeveel er goed waren
  const stars = [...s.marks].sort((a, b) => Number(b) - Number(a));
  part('mg-body').innerHTML =
    '<div class="mg-round mg-result">' +
    stars.map((ok, i) => `<span class="mg-star${ok ? ' ok' : ''}" style="animation-delay:${i * 0.12}s">${icon('star')}</span>`).join('') +
    '</div>';
  if (won) sfx('cheer', { volume: 0.3 });
  later(s, 1300, () => finish(false));
}

/** Een plaatje van dit puzzeltje dat nog niet geweest is. */
function freshPic(s: Session): Pic {
  const fresh = s.pics.filter(p => !s.seen.has(p.id));
  const p = pick(fresh.length ? fresh : s.pics);
  s.seen.add(p.id);
  return p;
}

/** `n` verschillende plaatjes van dit puzzeltje; heeft het er te weinig (alleen munten), dan komen er gewone dingen bij. */
function picsFor(s: Session, n: number): Pic[] {
  const own = shuffle(s.pics);
  const more = shuffle(THINGS.filter(id => !own.some(p => p.id === id))).map(thingPic);
  return [...own, ...more].slice(0, n);
}

/**
 * Een vraag met een paar tegels om uit te kiezen (zo gaan de meeste puzzeltjes): bovenaan `top`, daaronder de tegels.
 * Een foute tegel schudt, wordt rood en kan niet nog een keer: zo blijft er steeds minder over. De goede wordt groen
 * en dan is de vraag klaar. `rowCls`: een eigen opmaak voor de rij; `on.right` en `on.wrong`: iets extra's bij een tik.
 */
function choose(
  s: Session, title: string, top: string, options: { html: string; right: boolean; cls?: string }[], rowCls = '',
  on: { right?: (b: HTMLButtonElement) => void; wrong?: (i: number) => void } = {},
): void {
  show(title, `${top}<div class="mg-row ${rowCls}">${options.map((o, i) => `<button class="mg-btn ${o.cls ?? ''}" type="button" data-i="${i}">${o.html}</button>`).join('')}</div>`);
  for (const btn of buttons())
    btn.addEventListener('click', () => {
      if (s.busy) return;
      const i = Number(btn.dataset.i);
      if (options[i].right) {
        btn.classList.add('ok');
        on.right?.(btn);
        roundDone(s);
      } else {
        btn.disabled = true;
        miss(s, btn, 'no');
        on.wrong?.(i);
      }
    });
}

/** Drie dieren om uit te kiezen, als tegels. `dark`: als schaduw. */
const beastTiles = (options: string[], answer: string, dark = false): { html: string; right: boolean; cls: string }[] =>
  options.map(sp => ({ html: speciesIcon(sp), right: sp === answer, cls: `mg-animal${dark ? ' mg-dark' : ''}` }));

// ------------------------------------------------------------ som
/**
 * Een som met dingen die je kunt tellen. Plus: twee stapeltjes naast elkaar. Min: één stapeltje waarvan de laatste zijn
 * doorgestreept: wat overblijft kun je tellen. Eronder staat de som in cijfers, en op elk antwoord ligt het getal ook
 * als stapeltje.
 */
function sumRound(s: Session): void {
  const { a, b, minus, answer } = unseen(makeSum, sumKey, s.seen);
  const { html: pic, small } = freshPic(s);
  choose(
    s,
    t(minus ? 'mini.sum.minus' : 'mini.sum.plus'),
    '<div class="mg-sum">' +
      `<div class="mg-piles">${minus ? pile(pic, a, 'a', b) : `${pile(pic, a, 'a')}<b class="mg-op">+</b>${pile(pic, b, 'b')}`}</div>` +
      `<div class="mg-eq"><b>${a}</b><b class="mg-op">${minus ? '−' : '+'}</b><b>${b}</b><b class="mg-op">=</b><span class="mg-ask"><b>?</b></span></div></div>`,
    answersNear(answer, 0, COUNT_MAX).map(n => ({ html: numberTile(n, small ?? pic), right: n === answer, cls: 'mg-answer' })),
    '',
    {
      right: () => {
        const ask = part('mg-ask');
        ask.classList.add('ok');
        ask.querySelector('b')!.textContent = String(answer);
      },
    },
  );
}

// ------------------------------------------------------------ tellen
/**
 * Hoeveel zijn het er? Een vak met dingen (of dieren uit het park) die los door elkaar liggen, en drie getallen om uit
 * te kiezen. Tik je de dingen een voor een aan, dan komt op elk het volgende getal te staan: zo tel je mee.
 */
function countRound(s: Session): void {
  const n = unseen(() => makeCount(s.round), q => `n${q}`, s.seen);
  // dieren tellen: allerlei dieren door elkaar; dingen tellen: steeds hetzelfde ding
  const mixed = !!s.opts.animals;
  const one = freshPic(s);
  const pics = Array.from({ length: n }, () => (mixed ? pick(s.pics) : one).html);
  choose(s, t('mini.count'), scene(pics, 'button'), answersNear(n, 1, COUNT_MAX).map(v => ({ html: numberTile(v, one.small ?? one.html), right: v === n, cls: 'mg-answer' })));
  let counted = 0;
  for (const thing of root!.querySelectorAll<HTMLElement>('.mg-scene .mg-thing'))
    thing.addEventListener('click', () => {
      if (s.busy || thing.classList.contains('counted')) return;
      counted++;
      thing.classList.add('counted');
      thing.insertAdjacentHTML('beforeend', `<b>${counted}</b>`);
      sfx('place', { volume: 0.4, rate: 1 + counted * 0.06, every: 0.03 });
    });
}

// ------------------------------------------------------------ waar zijn de meeste
/** Twee of drie groepjes van hetzelfde ding: tik op het groepje met de meeste. Daarna zie je bij elk groepje het getal. */
function moreRound(s: Session): void {
  // drie groepjes pas bij de laatste vragen, en alleen als het scherm er breed genoeg voor is
  const groups = s.round >= 2 && window.innerWidth >= 560 ? 3 : 2;
  // de eerste vraag zie je in één oogopslag; daarna scheelt het soms maar één
  const counts = unseen(() => makeMore(groups, s.round === 0 ? 2 : 1), q => `m${q.join()}`, s.seen);
  const pic = freshPic(s).html, most = Math.max(...counts);
  choose(
    s, t('mini.more'), '',
    counts.map(n => ({ html: `${scene(Array<string>(n).fill(pic), 'i', MORE_GRID)}<b class="mg-n">${n}</b>`, right: n === most, cls: 'mg-group' })),
    'mg-groups',
  );
  // zo weet de opmaak hoe breed een groepje mag zijn
  part('mg-groups').style.setProperty('--k', String(groups));
}

// ------------------------------------------------------------ woord
function spellRound(s: Session): void {
  const known = (dutch() ? WORDS_NL : WORDS_EN).flatMap(w => {
    const pic = wordPicture(w);
    return pic ? [{ word: w.word, pic, animal: !!w.species || w.icon === 'fish' }] : [];
  });
  // alleen dieren, als daar genoeg plaatjes van zijn voor alle vragen
  const beasts = s.opts.animals ? known.filter(w => w.animal) : [];
  const all = beasts.length >= s.rounds ? beasts : known;
  const fresh = all.filter(w => !s.seen.has(w.word));
  const { word, pic } = pick(fresh.length ? fresh : all);
  s.seen.add(word);
  // op een smal scherm één foute letter erbij, anders twee
  const extra = shuffle([...LETTERS].filter(l => !word.includes(l))).slice(0, window.innerWidth < 440 ? 1 : 2);
  let tiles = shuffle([...word, ...extra]);
  // het woord mag er niet al kant-en-klaar staan
  for (let i = 0; i < 10 && tiles.join('').startsWith(word); i++) tiles = shuffle(tiles);
  let pos = 0;

  show(
    t('mini.spell'),
    `<div class="mg-word">${pic}</div>` +
      `<div class="mg-row">${[...word].map(() => '<span class="mg-slot"></span>').join('')}</div>` +
      `<div class="mg-row">${tiles.map(l => `<button class="mg-btn" type="button" data-v="${l}">${l}</button>`).join('')}</div>`,
  );
  const places = slots();
  for (const b of buttons())
    b.addEventListener('click', () => {
      if (s.busy) return;
      const slot = places[pos];
      if (b.dataset.v === word[pos]) {
        slot.textContent = word[pos];
        slot.classList.remove('hint');
        slot.classList.add('full');
        b.classList.add('used');
        b.disabled = true;
        pos++;
        if (pos < word.length) sfx('place', { volume: 0.6 });
        else {
          for (const p of places) p.classList.add('ok');
          roundDone(s);
        }
      } else {
        miss(s, b, 'oops');
        // na een fout staat de goede letter licht in het vakje, als hulpje
        slot.textContent = word[pos];
        slot.classList.add('hint');
      }
    });
}

// ------------------------------------------------------------ volgorde
/** Om en om: hetzelfde plaatje in drie maten van klein naar groot, en groepjes van weinig naar veel (met het getal erbij). */
function orderRound(s: Session): void {
  const sizes = s.sizes;
  s.sizes = !sizes;
  const { html: pic, small } = freshPic(s);
  /** Wat op een tegel staat en de hoeveelste hij is van klein naar groot. */
  let items: { rank: number; html: string }[];
  if (sizes) items = [0, 1, 2].map(rank => ({ rank, html: `<span class="mg-size s${rank}">${pic}</span>` }));
  else {
    // drie of vier getallen (op een smal scherm drie), elk met zoveel plaatjes om te tellen
    const numbers = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]).slice(0, Math.random() < 0.4 && window.innerWidth >= 480 ? 4 : 3);
    items = numbers.map(n => ({ rank: n, html: numberTile(n, small ?? pic) }));
  }
  const sorted = [...items].sort((p, q) => p.rank - q.rank);
  // ze mogen er niet al goed staan
  let tiles = shuffle(items);
  for (let i = 0; i < 10 && tiles.every((it, k) => it === sorted[k]); i++) tiles = shuffle(items);
  let pos = 0;
  const wide = sizes ? '' : ' mg-answer';

  show(
    t(sizes ? 'mini.order.size' : 'mini.order.count'),
    `<div class="mg-hint">${sizes ? HINT_SIZE : HINT_COUNT}</div>` +
      `<div class="mg-row">${items.map(() => `<span class="mg-slot${wide}"></span>`).join('')}</div>` +
      `<div class="mg-row">${tiles.map(it => `<button class="mg-btn${wide}" type="button" data-v="${it.rank}">${it.html}</button>`).join('')}</div>`,
  );
  const places = slots();
  for (const b of buttons())
    b.addEventListener('click', () => {
      if (s.busy) return;
      if (Number(b.dataset.v) === sorted[pos].rank) {
        places[pos].innerHTML = sorted[pos].html;
        places[pos].classList.add('full');
        b.classList.add('used');
        b.disabled = true;
        pos++;
        if (pos < sorted.length) sfx('place', { volume: 0.6 });
        else {
          for (const p of places) p.classList.add('ok');
          roundDone(s);
        }
      } else miss(s, b, 'oops');
    });
}

// ------------------------------------------------------------ memory
/**
 * Zoek twee dezelfde. De kaartjes liggen dicht; tik er twee om. Dezelfde blijven open liggen, verschillende gaan na
 * een tel weer dicht (of meteen, als je al een volgend kaartje omdraait). Missen hoort erbij en klinkt niet als fout;
 * alleen met heel veel missers is de ronde niet 'in één keer goed' (zie memoryClean).
 */
function memoryRound(s: Session): void {
  const pairs = memoryPairs(s.round);
  const pics = picsFor(s, pairs);
  show(
    t('mini.memory'),
    `<div class="mg-cards" style="--cols:${pairs <= 2 ? 2 : pairs === 3 ? 3 : 4}">` +
      dealPairs(pairs).map(v => `<button class="mg-btn mg-flip" type="button" data-v="${v}"><span class="mg-back">${icon('question')}</span><span class="mg-face">${pics[v].html}</span></button>`).join('') +
      '</div>',
  );
  let open: HTMLButtonElement[] = [], found = 0, misses = 0, closing = 0;
  const shut = (): void => {
    clearTimeout(closing);
    for (const b of open) b.classList.remove('open');
    open = [];
  };
  for (const b of buttons())
    b.addEventListener('click', () => {
      if (s.busy || b.classList.contains('open')) return;
      // er liggen nog twee verschillende open: die gaan eerst dicht
      if (open.length === 2) shut();
      b.classList.add('open');
      open.push(b);
      if (open.length < 2) return;
      const [first, second] = open;
      if (first.dataset.v !== second.dataset.v) {
        misses++;
        closing = window.setTimeout(() => {
          if (session === s) shut();
        }, MEMORY_PEEK);
        return;
      }
      for (const card of open) {
        card.classList.add('ok');
        card.disabled = true;
      }
      open = [];
      found++;
      if (found < pairs) return sfx('place', { volume: 0.6 });
      s.clean = memoryClean(misses, pairs);
      roundDone(s);
    });
}

// ------------------------------------------------------------ wat hoort er niet bij
/** Vier plaatjes: drie horen bij elkaar, één niet. De eerste vraag is drie keer precies hetzelfde plaatje. */
function oddRound(s: Session): void {
  const families: Pic[][][] = [...ODD_FAMILIES.map(family => family.map(group => group.map(thingPic))), [s.park.map(beastPic)]];
  const q = makeOdd(families, s.round === 0);
  if (!q) return sumRound(s);
  choose(s, t('mini.odd'), '', q.items.map((p, i) => ({ html: p.html, right: i === q.odd, cls: 'mg-one' })));
}

// ------------------------------------------------------------ wat komt er daarna
/** Een rijtje plaatjes dat steeds herhaalt, met een leeg vakje aan het eind: welk plaatje komt daar? */
function patternRound(s: Session): void {
  const q = makePattern(s.round);
  const pics = picsFor(s, 3);
  choose(
    s, t('mini.pattern'),
    `<div class="mg-beads">${q.shown.map(k => `<span class="mg-bead">${pics[k].html}</span>`).join('')}<span class="mg-bead mg-next"><b>?</b></span></div>`,
    shuffle([0, 1, 2]).map(k => ({ html: pics[k].html, right: k === q.answer, cls: 'mg-one' })),
    '',
    {
      right: () => {
        const next = part('mg-next');
        next.classList.add('ok');
        next.innerHTML = pics[q.answer].html;
      },
    },
  );
}

// ------------------------------------------------------------ vragen over dieren
/** Het dier waar deze vraag over gaat: uit het park als het kan, en niet een dier dat al geweest is. Null: er is geen plaatje. */
function askBeast(s: Session, clear: readonly SpeciesId[]): SpeciesId | null {
  const pool = askPool(s.park, clear, s.rounds).filter(hasPicture);
  return pool.length ? freshOf(pool, s.seen) : null;
}

/**
 * Van welk dier is deze schaduw? Om en om: een grote schaduw met drie dieren eronder, of een dier met drie schaduwen.
 * Alleen dieren met een vorm die je herkent (zie SHADOW_CLEAR). Na het goede antwoord krijgt de schaduw zijn kleur terug.
 */
function shadowRound(s: Session): void {
  const answer = askBeast(s, SHADOW_CLEAR);
  if (!answer) return sumRound(s);
  const turned = s.round % 2 === 1;
  choose(s, t(turned ? 'mini.shadow.pick' : 'mini.shadow'), `<div class="mg-word${turned ? '' : ' mg-dark'}">${speciesIcon(answer)}</div>`, beastTiles(shadowChoices(answer, s.park), answer, turned));
}

/** Wat eet dit dier? Het dier groot, met drie soorten voer eronder (het goede staat in SPECIES). */
function eatRound(s: Session): void {
  const answer = askBeast(s, EAT_CLEAR);
  if (!answer) return sumRound(s);
  choose(s, t('mini.eat'), `<div class="mg-word">${speciesIcon(answer)}</div>`, eatChoices(answer).map(food => ({ html: icon(food), right: food === SPECIES[answer].food, cls: 'mg-one' })));
}

/** Wie slaapt hier? Een slaapplek groot, met drie dieren eronder. Elke vraag een andere slaapplek. */
function bedRound(s: Session): void {
  const pool = askPool(s.park, Object.keys(SPECIES) as SpeciesId[], Math.max(6, s.rounds)).filter(hasPicture);
  if (!pool.length) return sumRound(s);
  const fresh = pool.filter(sp => !s.seen.has(SPECIES[sp].bed));
  const answer = pick(fresh.length ? fresh : pool), bed = SPECIES[answer].bed;
  s.seen.add(bed);
  choose(s, t('mini.bed'), `<div class="mg-word mg-night">${icon(bed)}</div>`, beastTiles(bedChoices(answer, s.park).filter(hasPicture), answer));
}

/**
 * Welk dier maakt dit geluid? Een grote knop met een luidspreker (het geluid klinkt ook vanzelf één keer) en drie
 * dieren. Tik je een verkeerd dier aan, dan hoor je hoe dat dier klinkt.
 */
function soundRound(s: Session): void {
  const play = s.opts.sound;
  const answer = play ? askBeast(s, SOUND_CLEAR) : null;
  if (!play || !answer) return shadowRound(s);
  const options = soundChoices(answer, s.park).filter(hasPicture);
  choose(
    s, t('mini.sound'), `<button class="mg-clue mg-sound mg-loud" type="button" aria-label="${t('mini.guess.sound')}">${icon('sound_on')}</button>`, beastTiles(options, answer), '',
    { wrong: i => play(options[i]) },
  );
  root!.querySelector('.mg-sound')?.addEventListener('click', () => play(answer));
  // het geluid klinkt meteen één keer, na de uitleg
  later(s, 1600, () => play(answer));
}

// ------------------------------------------------------------ raden
/** Een pootafdruk, om de poten te tellen. */
const PAW =
  '<svg class="mg-paw" viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="12" cy="16" rx="6.5" ry="5.5" fill="#8a5a3c"/>' +
  '<g fill="#8a5a3c"><circle cx="4.5" cy="9" r="2.6"/><circle cx="9.5" cy="5" r="2.6"/><circle cx="14.5" cy="5" r="2.6"/><circle cx="19.5" cy="9" r="2.6"/></g></svg>';

/**
 * Welk dier vindt deze gast het leukst? Bovenaan drie hints: de kleuren van het dier, hoeveel poten het heeft en een
 * knop met zijn geluid. Daaronder drie dieren uit het park. Fout: de tegel schudt en je hoort 'nee, probeer nog eens'.
 * Wie het goede dier vindt, heeft het geraden, ook na een fout.
 */
function guessRound(s: Session): void {
  const g = s.opts.guess;
  if (!g) return sumRound(s);
  const colors = `<span class="mg-clue mg-swatch">${g.colors.map(c => `<i style="background:${c}"></i>`).join('')}</span>`;
  const legs = `<span class="mg-clue mg-legs"><b>${g.legs}</b><span class="mg-feet">${g.legs ? PAW.repeat(g.legs) : icon('fish')}</span></span>`;
  const sound = g.sound ? `<button class="mg-clue mg-sound" type="button" aria-label="${t('mini.guess.sound')}">${icon('sound_on')}</button>` : '';
  show(
    t('mini.guess'),
    `<div class="mg-row mg-clues">${colors}${legs}${sound}</div>` +
      `<div class="mg-row">${g.options.map(sp => `<button class="mg-btn mg-animal" type="button" data-v="${sp}">${speciesIcon(sp)}</button>`).join('')}</div>`,
  );
  root!.querySelector('.mg-sound')?.addEventListener('click', () => g.sound?.());
  // het geluid klinkt meteen één keer, na de uitleg
  later(s, 1600, () => g.sound?.());
  for (const btn of buttons())
    btn.addEventListener('click', () => {
      if (s.busy) return;
      if (btn.dataset.v === g.answer) {
        btn.classList.add('ok');
        s.clean = true;
        roundDone(s);
      } else {
        btn.disabled = true;
        miss(s, btn, 'no');
        // een zachte 'nee': elke keer opnieuw te horen
        part('mg-title').textContent = t('mini.guess.no');
        spoken = '';
        tell(t('mini.guess.no'));
      }
    });
}

/** Bij elke soort puzzel: wat één vraag op het scherm zet. */
const ROUNDS: Record<MiniKind, (s: Session) => void> = {
  sum: sumRound, count: countRound, more: moreRound, spell: spellRound, order: orderRound, memory: memoryRound, odd: oddRound, pattern: patternRound,
  shadow: shadowRound, eat: eatRound, bed: bedRound, sound: soundRound, guess: guessRound,
};

// ------------------------------------------------------------ voor het spel
/** Opent het puzzeltje over het spel heen. Staat er al een open, dan gaat die eerst dicht (zijn onDone krijgt skipped: true). */
export function playMini(opts: MiniOptions): void {
  speak = opts.say ?? null;
  spoken = '';
  stop();
  const el = ensureRoot();
  // de dieren uit het park met een eigen plaatje; wonen er te weinig, dan doen een paar bekende dieren mee
  const own = [...new Set(opts.park ?? [])].filter(hasPicture);
  const park = own.length >= 3 ? own : [...own, ...BEASTS.filter(sp => !own.includes(sp) && hasPicture(sp))];
  const s: Session = {
    opts,
    // raden is één vraag (het lievelingsdier van één gast); een memory duurt langer, dus daarvan twee
    rounds: Math.max(1, Math.round(opts.rounds ?? (opts.kind === 'guess' ? 1 : opts.kind === 'memory' ? 2 : 3))),
    round: 0,
    marks: [],
    clean: true,
    busy: false,
    result: false,
    since: 0,
    timer: 0,
    seen: new Set(),
    sizes: opts.first ? opts.first === 'size' : Math.random() < 0.5,
    pics: opts.animals && park.length ? park.map(beastPic) : (opts.things?.length ? opts.things : THINGS).map(thingPic),
    park,
  };
  session = s;
  part('mg-close').setAttribute('aria-label', t('mini.close'));
  part('mg-pic').innerHTML = opts.picture ?? '';
  const card = part('mg-card');
  card.classList.remove('done');
  el.hidden = false;
  // de kaart springt bij elk nieuw puzzeltje opnieuw in beeld
  card.style.animation = 'none';
  void card.offsetWidth;
  card.style.animation = '';
  card.scrollTop = 0;
  startRound(s);
}

/** Staat er nu een puzzeltje in beeld? (Het spel wacht dan met zijn tips.) */
export function miniOpen(): boolean {
  return session !== null;
}

/** Sluit het puzzeltje zonder het af te maken (onDone krijgt skipped: true). Waren alle vragen al gedaan, dan telt de uitslag. */
export function closeMini(): void {
  stop();
}
