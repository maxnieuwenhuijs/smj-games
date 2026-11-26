// De kaart waarop de spelletjes van de dokter (vetgame.ts) en van het hek maken (fixgame.ts) staan: een wit vel over
// het park heen met een kruisje, een plaatje, een bolletje per stap, de uitleg en een vak om in te spelen.
// Wat hier staat hebben die spelletjes allebei nodig: de kaart open en dicht, dingen die even later gebeuren, een
// vinger volgen, het handje dat voordoet wat je moet doen, en een wolkje sterretjes als iets gelukt is.
// Er is hooguit één kaart tegelijk open; het spel vraagt met cardOpen() of het park even stil moet staan.
import './playcard.css';
import { t } from '@smj/shared';
import { icon, type IconId } from './icons';

/** Een plek in het vak waarin gespeeld wordt: van 0 tot 1, van links naar rechts en van boven naar beneden. */
export interface Point {
  x: number;
  y: number;
}
/** Wat het handje voordoet: tikken, vasthouden, heen en weer vegen of slepen naar een andere plek. */
export type Gesture = 'tap' | 'hold' | 'rub' | 'drag';
/** Zo lang (in tellen) doet de speler niets voordat het handje het opnieuw voordoet. */
const HINT_AFTER = 5;

export interface PlayCard {
  /** Het vak waarin gespeeld wordt; het spelletje zet er zelf zijn tekening in. */
  readonly stage: HTMLElement;
  /** Is deze kaart nog open? */
  readonly open: boolean;
  /** De uitleg boven het vak. Hij wordt ook voorgelezen, behalve met `quiet`. */
  title(text: string, quiet?: boolean): void;
  /** De bolletjes bovenaan: een plaatje per stap (HTML), en hoeveel er al klaar zijn. */
  steps(icons: string[], done: number): void;
  /** Doet iets een poosje later, maar alleen als deze kaart dan nog open is. */
  later(ms: number, fn: () => void): void;
  /** Roept `fn` elk beeldje aan (met de tijd sinds het vorige, in tellen) tot de kaart dichtgaat of tot je de teruggegeven functie aanroept. */
  frame(fn: (dt: number) => void): () => void;
  /**
   * Het handje doet voor wat je moet doen, op deze plek in `el` (van 0 tot 1). Bij slepen en vegen is `to` de plek waar
   * het naartoe gaat. Na de eerste tik gaat het weg; doet de speler een poos niets, dan komt het terug. Zonder `how`: weg.
   */
  hint(el?: HTMLElement, how?: Gesture, at?: Point, to?: Point): void;
  /** Klaar: de kaart gaat dicht en `onClose` hoort dat het spelletje af is. */
  finish(): void;
}

interface Live extends PlayCard {
  open: boolean;
  onClose: (finished: boolean) => void;
  say: ((text: string) => void) | null;
  timers: Set<number>;
  frames: Set<(dt: number) => void>;
  raf: number;
  last: number;
  /** Het handje van nu, en hoe lang de speler al niets doet. */
  hand: { el: HTMLElement; how: Gesture; at: Point; to: Point } | null;
  idle: number;
}

const CLOSE_SVG = '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M12 12 L36 36 M36 12 L12 36" fill="none" stroke="#3a2a1a" stroke-width="7" stroke-linecap="round"/></svg>';

let root: HTMLDivElement | null = null;
let live: Live | null = null;

const part = (cls: string): HTMLElement => root!.querySelector<HTMLElement>(`.${cls}`)!;

function ensureRoot(): HTMLDivElement {
  if (root) return root;
  root = document.createElement('div');
  root.id = 'playcard';
  root.hidden = true;
  root.innerHTML =
    '<div class="pc-card" role="dialog" aria-modal="true">' +
    `<button class="pc-close" type="button"><span>${CLOSE_SVG}</span></button>` +
    '<div class="pc-head"><span class="pc-pic"></span><span class="pc-steps"></span></div>' +
    '<div class="pc-title"></div><div class="pc-stage"></div></div>';
  document.body.append(root);
  root.addEventListener('click', e => {
    if ((e.target as Element).closest('.pc-close')) close(false);
  });
  // elke tik: het handje gaat weg en de speler is weer bezig
  root.addEventListener('pointerdown', () => {
    if (!live) return;
    live.idle = 0;
    root!.querySelector('.pc-hand')?.remove();
  }, true);
  root.addEventListener('contextmenu', e => e.preventDefault());
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape') close(false);
  });
  return root;
}

/** De kaart gaat dicht. `finished`: het spelletje is af; anders is hij weggeklikt en verandert er niets in het park. */
function close(finished: boolean): void {
  const card = live;
  if (!card || !root) return;
  live = null;
  card.open = false;
  for (const id of card.timers) clearTimeout(id);
  cancelAnimationFrame(card.raf);
  root.hidden = true;
  part('pc-stage').innerHTML = '';
  card.onClose(finished);
}

/** Zet het handje neer (zie PlayCard.hint). */
function showHand(card: Live): void {
  const h = card.hand;
  root!.querySelector('.pc-hand')?.remove();
  if (!h || !h.el.isConnected) return;
  const hand = document.createElement('span');
  // onderin het vak (ook als het daar pas naartoe sleept) komt het handje van boven: zo steekt het nooit onder de kaart uit
  hand.className = `pc-hand ${h.how}${Math.max(h.at.y, h.to.y) > 0.66 ? ' down' : ''}`;
  hand.innerHTML = `<span class="pc-arm">${icon('hand')}</span>`;
  hand.style.left = `${(h.at.x * 100).toFixed(1)}%`;
  hand.style.top = `${(h.at.y * 100).toFixed(1)}%`;
  // hoe ver het handje sleept of veegt, in procenten van het vak waar het in staat
  const box = h.el.getBoundingClientRect();
  hand.style.setProperty('--dx', `${((h.to.x - h.at.x) * box.width).toFixed(0)}px`);
  hand.style.setProperty('--dy', `${((h.to.y - h.at.y) * box.height).toFixed(0)}px`);
  h.el.append(hand);
}

/**
 * Opent een kaart. `kind`: 'vet' (de dokter) of 'fix' (een hek maken), voor de opmaak. `picture`: het plaatje
 * bovenaan (HTML). `say`: leest de uitleg voor. `onClose`: één keer aangeroepen als de kaart dichtgaat, met of het
 * spelletje af was. Staat er al een kaart open, dan gaat die eerst dicht (niet af).
 */
export function openCard(opts: { kind: 'vet' | 'fix'; label: string; picture?: string; say?: (text: string) => void; onClose: (finished: boolean) => void }): PlayCard {
  close(false);
  const el = ensureRoot();
  const stage = part('pc-stage');
  let spoken = '';
  const card: Live = {
    stage,
    open: true,
    onClose: opts.onClose,
    say: opts.say ?? null,
    timers: new Set(),
    frames: new Set(),
    raf: 0,
    last: performance.now(),
    hand: null,
    idle: 0,
    title(text, quiet = false) {
      part('pc-title').textContent = text;
      // dezelfde zin klinkt niet twee keer achter elkaar
      if (!quiet && text !== spoken) card.say?.(text);
      spoken = text;
    },
    steps(icons, done) {
      part('pc-steps').innerHTML = icons.map((html, i) => `<span class="pc-step${i < done ? ' ok' : i === done ? ' now' : ''}">${html}</span>`).join('');
    },
    later(ms, fn) {
      const id = window.setTimeout(() => {
        card.timers.delete(id);
        if (card.open) fn();
      }, ms);
      card.timers.add(id);
    },
    frame(fn) {
      card.frames.add(fn);
      return () => void card.frames.delete(fn);
    },
    hint(target, how, at = { x: 0.5, y: 0.5 }, to = at) {
      card.hand = target && how ? { el: target, how, at, to } : null;
      card.idle = 0;
      showHand(card);
    },
    finish() {
      if (card.open) close(true);
    },
  };
  live = card;
  // één klok voor alles wat vloeiend beweegt, en voor het handje dat terugkomt als de speler niets doet
  const tick = (now: number): void => {
    if (!card.open) return;
    const dt = Math.min(0.05, (now - card.last) / 1000);
    card.last = now;
    for (const fn of card.frames) fn(dt);
    if (card.hand) {
      card.idle += dt;
      if (card.idle > HINT_AFTER && !root!.querySelector('.pc-hand')) showHand(card);
    }
    card.raf = requestAnimationFrame(tick);
  };
  card.raf = requestAnimationFrame(tick);
  el.dataset.kind = opts.kind;
  part('pc-card').setAttribute('aria-label', opts.label);
  part('pc-close').setAttribute('aria-label', t('mini.close'));
  part('pc-pic').innerHTML = opts.picture ?? '';
  part('pc-title').textContent = '';
  part('pc-steps').innerHTML = '';
  stage.innerHTML = '';
  el.hidden = false;
  // de kaart springt elke keer opnieuw in beeld
  const box = part('pc-card');
  box.style.animation = 'none';
  void box.offsetWidth;
  box.style.animation = '';
  box.scrollTop = 0;
  return card;
}

/** Staat er nu een kaart van de dokter of van het hek maken in beeld? */
export function cardOpen(): boolean {
  return live !== null;
}

/** Sluit de kaart zonder het spelletje af te maken (onClose krijgt false). */
export function closeCard(): void {
  close(false);
}

/**
 * Volgt één vinger of de muis op `el`. `down`: neergezet; `move`: bewogen (`pressed`: met de vinger erop of de
 * muisknop in; een muis die alleen beweegt geeft false); `up`: losgelaten. De plek is steeds van 0 tot 1 binnen `el`,
 * ook als de vinger er intussen buiten is.
 */
export function track(el: HTMLElement, on: { down?: (p: Point) => void; move?: (p: Point, pressed: boolean) => void; up?: (p: Point) => void }): void {
  let finger = -1;
  const at = (e: PointerEvent): Point => {
    const r = el.getBoundingClientRect();
    return { x: (e.clientX - r.left) / Math.max(1, r.width), y: (e.clientY - r.top) / Math.max(1, r.height) };
  };
  el.classList.add('pc-touch');
  el.addEventListener('pointerdown', e => {
    if (finger !== -1 || e.button > 0) return;
    finger = e.pointerId;
    try {
      el.setPointerCapture(finger);
    } catch {
      /* niet erg: dan volgt hij de vinger alleen binnen het vak */
    }
    on.down?.(at(e));
  });
  el.addEventListener('pointermove', e => {
    if (finger !== -1 && e.pointerId !== finger) return;
    on.move?.(at(e), finger !== -1);
  });
  const end = (e: PointerEvent): void => {
    if (e.pointerId !== finger) return;
    finger = -1;
    on.up?.(at(e));
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
}

/** Een wolkje plaatjes dat vanaf een plek in `el` naar buiten spat (sterretjes, hartjes) en vanzelf weer weg is. */
export function burst(el: HTMLElement, at: Point, icons: IconId[] = ['sparkle'], n = 6): void {
  // onderaan de kaart vliegen ze minder ver naar beneden: zo steekt er niets onder de kaart uit
  const box = el.getBoundingClientRect(), card = root?.querySelector('.pc-card')?.getBoundingClientRect();
  const room = card ? Math.max(0, card.bottom - (box.top + at.y * box.height) - 22) : 70;
  for (let i = 0; i < n; i++) {
    const spark = document.createElement('i');
    spark.className = 'pc-spark';
    spark.innerHTML = icon(icons[i % icons.length]);
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    spark.style.left = `${(at.x * 100).toFixed(1)}%`;
    spark.style.top = `${(at.y * 100).toFixed(1)}%`;
    spark.style.setProperty('--x', `${Math.round(Math.cos(a) * 70)}px`);
    spark.style.setProperty('--y', `${Math.round(Math.min(room, Math.sin(a) * 70))}px`);
    spark.style.setProperty('--d', `${(i * 0.04).toFixed(2)}s`);
    el.append(spark);
    setTimeout(() => spark.remove(), 1100);
  }
}
