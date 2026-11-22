// Puzzeltjes die over het park heen komen als een schoolklas of een gast om hulp vraagt:
// een som onder de tien, een woord van drie letters leggen, of dingen op volgorde zetten.
// Het spel roept playMini aan en hoort via onDone hoe het ging. Wegklikken met het kruisje mag altijd.
import './minigame.css';
import { t } from '@smj/shared';
import { sfx } from './audio';
import { ICON_IDS, icon, type IconId } from './icons';
import { speciesIcon } from './models';

export type MiniKind = 'sum' | 'spell' | 'order';
export interface MiniResult { won: boolean; right: number; rounds: number; skipped: boolean }
export interface MiniOptions {
  kind: MiniKind;
  /** Hoeveel vragen achter elkaar; gewoon drie. */
  rounds?: number;
  /** Klein plaatje bovenaan (al HTML, bijvoorbeeld een svg van icon()); mag ontbreken. */
  picture?: string;
  /** Woord: alleen woorden van dieren (koe, aap, kip), als er daar genoeg van zijn. */
  animals?: boolean;
  /** Volgorde: waarmee het begint, plaatjes van klein naar groot ('size') of getallen ('count'). Anders is dat een gok. */
  first?: 'size' | 'count';
  /** Volgorde: deze plaatjes van klein naar groot, in plaats van de gewone. */
  sizeIcons?: IconId[];
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
/** Plaatjes die klein en groot goed te herkennen zijn, voor van klein naar groot. */
const SIZE_ICONS: IconId[] = ['star', 'heart', 'ball', 'balloon_red', 'sun', 'fish', 'tree', 'mushrooms'];

/** Het spel zet de taal op de pagina (main.ts); daar kijken we naar voor de woordenlijst. */
const dutch = (): boolean => document.documentElement.lang.toLowerCase().startsWith('nl');

/** Het plaatje bij een woord, of null als dat plaatje er niet is (dan doet het woord niet mee). */
function wordPicture(w: Word): string | null {
  if (w.icon) return icon(w.icon);
  if (!w.species) return null;
  const html = speciesIcon(w.species);
  // zonder eigen plaatje geeft speciesIcon een pootje, en dat past niet bij het woord
  return html.startsWith('<img') || (ICON_IDS as string[]).includes(w.species) ? html : null;
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

/** Stippen om te tellen. De laatste `gone` stippen zijn doorgestreept: die gaan eraf. */
function dots(n: number, cls: string, gone = 0): string {
  let html = '';
  for (let i = 0; i < n; i++) html += `<span class="mg-dot${i >= n - gone ? ' gone' : ''}"></span>`;
  return `<span class="mg-dots ${cls}">${html}</span>`;
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
  /** Wat al geweest is, zodat dezelfde som of hetzelfde woord niet twee keer komt. */
  seen: Set<string>;
  /** Volgorde: om en om plaatjes en getallen. */
  sizes: boolean;
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
  if (s.opts.kind === 'sum') sumRound(s);
  else if (s.opts.kind === 'spell') spellRound(s);
  else orderRound(s);
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

// ------------------------------------------------------------ som
function sumRound(s: Session): void {
  let a = 1, b = 1, minus = false;
  // een paar keer proberen, tot er een som komt die nog niet geweest is
  for (let i = 0; i < 20; i++) {
    minus = Math.random() < 0.4;
    if (minus) {
      // a − b: uitkomst 0 tot en met 8
      a = 1 + rnd(9);
      b = 1 + rnd(a);
    } else {
      // a + b: uitkomst 2 tot en met 9
      const sum = 2 + rnd(8);
      a = 1 + rnd(sum - 1);
      b = sum - a;
    }
    if (!s.seen.has(`${a}${minus ? '-' : '+'}${b}`)) break;
  }
  s.seen.add(`${a}${minus ? '-' : '+'}${b}`);
  const answer = minus ? a - b : a + b;
  // twee foute antwoorden vlak bij het goede
  const wrong = shuffle([answer - 2, answer - 1, answer + 1, answer + 2].filter(n => n >= 0 && n <= 9)).slice(0, 2);
  const options = shuffle([answer, ...wrong]);

  show(
    t(minus ? 'mini.sum.minus' : 'mini.sum.plus'),
    '<div class="mg-sum">' +
      // bij min zijn de stippen die eraf gaan doorgestreept: wat overblijft kun je tellen
      `<span class="mg-term"><b>${a}</b>${dots(a, 'a', minus ? b : 0)}</span><b class="mg-op">${minus ? '−' : '+'}</b>` +
      `<span class="mg-term"><b>${b}</b>${dots(b, 'b', minus ? b : 0)}</span><b class="mg-op">=</b>` +
      '<span class="mg-term mg-ask"><b>?</b></span></div>' +
      `<div class="mg-row">${options.map(n => `<button class="mg-btn mg-answer" type="button" data-v="${n}"><b>${n}</b>${dots(n, 's')}</button>`).join('')}</div>`,
  );
  for (const btn of buttons())
    btn.addEventListener('click', () => {
      if (s.busy) return;
      if (Number(btn.dataset.v) === answer) {
        btn.classList.add('ok');
        const ask = part('mg-ask');
        ask.classList.add('ok');
        ask.querySelector('b')!.textContent = String(answer);
        roundDone(s);
      } else {
        // dit antwoord kan niet nog een keer: zo blijft er steeds minder over
        btn.disabled = true;
        miss(s, btn, 'no');
      }
    });
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
function orderRound(s: Session): void {
  const sizes = s.sizes;
  s.sizes = !sizes;
  /** Wat op een tegel staat en de hoeveelste hij is van klein naar groot. */
  let items: { rank: number; html: string }[];
  if (sizes) {
    // hetzelfde plaatje in drie maten
    const pool = s.opts.sizeIcons?.length ? s.opts.sizeIcons : SIZE_ICONS;
    const fresh = pool.filter(id => !s.seen.has(id));
    const id = pick(fresh.length ? fresh : pool);
    s.seen.add(id);
    items = [0, 1, 2].map(rank => ({ rank, html: `<span class="mg-size s${rank}">${icon(id)}</span>` }));
  } else {
    // drie of vier getallen, met stippen eronder om te tellen
    const numbers = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]).slice(0, Math.random() < 0.4 ? 4 : 3);
    items = numbers.map(n => ({ rank: n, html: `<b>${n}</b>${dots(n, 's')}` }));
  }
  const sorted = [...items].sort((p, q) => p.rank - q.rank);
  // ze mogen er niet al goed staan
  let tiles = shuffle(items);
  for (let i = 0; i < 10 && tiles.every((it, k) => it === sorted[k]); i++) tiles = shuffle(items);
  let pos = 0;

  show(
    t(sizes ? 'mini.order.size' : 'mini.order.count'),
    `<div class="mg-hint">${sizes ? HINT_SIZE : HINT_COUNT}</div>` +
      `<div class="mg-row">${items.map(() => '<span class="mg-slot"></span>').join('')}</div>` +
      `<div class="mg-row">${tiles.map(it => `<button class="mg-btn" type="button" data-v="${it.rank}">${it.html}</button>`).join('')}</div>`,
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

// ------------------------------------------------------------ voor het spel
/** Opent het puzzeltje over het spel heen. Staat er al een open, dan gaat die eerst dicht (zijn onDone krijgt skipped: true). */
export function playMini(opts: MiniOptions): void {
  speak = opts.say ?? null;
  spoken = '';
  stop();
  const el = ensureRoot();
  const s: Session = {
    opts,
    rounds: Math.max(1, Math.round(opts.rounds ?? 3)),
    round: 0,
    marks: [],
    clean: true,
    busy: false,
    result: false,
    since: 0,
    timer: 0,
    seen: new Set(),
    sizes: opts.first ? opts.first === 'size' : Math.random() < 0.5,
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
