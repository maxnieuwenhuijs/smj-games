// De knoppen, balken, menu's en het praatvenster bovenop het spelbeeld. Alles is gewone HTML.
import { t } from '@smj/shared';
import { portrait, type FigureId, type Mood, type Mouth } from './figures';
import { icon } from './icons';

/** Een knop: `icon` is kant-en-klare HTML (een plaatje uit icons.ts). */
export interface ToolOption {
  id: string;
  icon: string;
  label: string;
  /** Extra kleur, bijvoorbeeld blauw voor jongen en roze voor meisje. */
  tone?: 'boy' | 'girl';
  /** Prijs in munten, en of je die nu kunt betalen. */
  price?: number;
  cant?: boolean;
}
export interface ToolDef extends ToolOption {
  /** Rijen met keuzes die boven de knop verschijnen als hij aan staat. */
  rows?: { key: string; active: string; options: ToolOption[] }[];
}
export interface GoalView {
  icon: string;
  label: string;
  n: number;
  who: FigureId;
}

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, html = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = cls;
  node.innerHTML = html;
  return node;
}

function button(opt: ToolOption, cls: string): HTMLButtonElement {
  const price = opt.price ? `<i class="price${opt.cant ? ' cant' : ''}">${opt.price}</i>` : '';
  const b = el('button', `tool ${cls} ${opt.tone ?? ''}`, `${opt.icon}<b>${opt.label}</b>${price}`);
  b.dataset.id = opt.id;
  return b;
}

export class Hud {
  private toolbar = $('toolbar');
  private options = $('options');
  private goals = $('goals');
  private layer = $('bubbles');
  private menu = $('menu');
  private overlay = $('overlay');
  private speech = $('speech');
  private wallet = $('wallet');
  private walletKey = '';
  private canvasHost = $('app');
  private goalRows: { fill: HTMLElement; count: HTMLElement; row: HTMLElement; n: number }[] = [];
  private speechTimer = 0;
  private mouthTimer = 0;

  constructor(private on: { tool(id: string, row?: string, option?: string): void; home(): void; goal(index: number): void }) {
    const home = $('home');
    home.innerHTML = icon('home');
    home.setAttribute('aria-label', t('home'));
    home.addEventListener('click', () => this.on.home());
    this.speech.addEventListener('click', () => this.hush());
  }

  // ------------------------------------------------------------ knoppen
  setTools(defs: ToolDef[], active: string, hint: string | null): void {
    document.getElementById('ui')!.dataset.tool = active;
    this.toolbar.replaceChildren();
    this.options.replaceChildren();
    for (const def of defs) {
      const b = button(def, '');
      b.dataset.tool = def.id;
      b.classList.toggle('on', def.id === active);
      b.classList.toggle('hint', def.id === hint && def.id !== active);
      b.addEventListener('click', () => this.on.tool(def.id));
      this.toolbar.append(b);
      if (def.id !== active) continue;
      for (const row of def.rows ?? []) {
        const line = el('div', 'row');
        for (const opt of row.options) {
          const o = button(opt, 'small');
          o.dataset.option = opt.id;
          o.classList.toggle('on', opt.id === row.active);
          o.addEventListener('click', () => this.on.tool(def.id, row.key, opt.id));
          line.append(o);
        }
        this.options.append(line);
      }
    }
  }

  setCursor(css: string): void {
    this.canvasHost.style.cursor = css;
  }

  /** De kas (munten) en het aantal gasten in het park. */
  setWallet(coins: number, cap: number, guests: number | null): void {
    const key = `${coins}/${guests}`;
    if (key === this.walletKey) return;
    this.walletKey = key;
    this.wallet.innerHTML =
      `<span class="pill${coins >= cap ? ' full' : ''}" title="${t('wallet.coins')}">${icon('coin')}<b>${coins}</b></span>` +
      (guests === null ? '' : `<span class="pill" title="${t('wallet.guests')}">${icon('guest')}<b>${guests}</b></span>`);
  }

  // ------------------------------------------------------------ doelen
  setGoals(levelNumber: number | null, goals: GoalView[]): void {
    this.goals.replaceChildren();
    this.goalRows = [];
    this.goals.append(el('div', 'level', levelNumber === null ? icon('trophy') : `${icon('star')}<b>${levelNumber}</b>`));
    goals.forEach((g, i) => {
      const row = el('button', 'goal');
      row.title = g.label;
      row.setAttribute('aria-label', g.label);
      row.addEventListener('click', () => this.on.goal(i));
      const fill = el('div', 'fill');
      const bar = el('div', 'bar');
      bar.append(fill);
      const count = el('div', 'count', `0/${g.n}`);
      row.append(el('div', 'who', portrait(g.who)), el('div', 'what', g.icon), bar, count);
      this.goals.append(row);
      this.goalRows.push({ fill, count, row, n: g.n });
    });
  }

  updateGoals(values: number[]): void {
    this.goalRows.forEach((r, i) => {
      const v = values[i] ?? 0;
      r.fill.style.width = `${(v / r.n) * 100}%`;
      r.count.textContent = `${v}/${r.n}`;
      r.row.classList.toggle('done', v >= r.n);
    });
  }

  // ------------------------------------------------------------ in het park
  makeBubble(): HTMLElement {
    const b = el('div', 'bubble');
    b.hidden = true;
    this.layer.append(b);
    return b;
  }

  /** Naambordje van een verblijf. */
  makeLabel(text: string, click: () => void): HTMLElement {
    const b = el('button', 'penname', `${icon('pen')}<b></b>`);
    b.querySelector('b')!.textContent = text;
    b.addEventListener('click', click);
    this.layer.append(b);
    return b;
  }

  /** Plaatje of woord dat even omhoog zweeft. */
  float(html: string, x: number, y: number, cls = ''): void {
    const f = el('div', `float ${cls}`, html);
    f.style.left = `${x}px`;
    f.style.top = `${y}px`;
    this.layer.append(f);
    setTimeout(() => f.remove(), 1200);
  }

  // ------------------------------------------------------------ menu
  get menuOpen(): boolean {
    return !this.menu.hidden;
  }

  showMenu(x: number, y: number, title: string, items: ToolOption[], choose: (id: string) => void, header = ''): void {
    this.menu.replaceChildren();
    const head = el('div', 'title');
    head.textContent = title;
    this.menu.append(head);
    if (header) this.menu.append(el('div', 'header', header));
    const row = el('div', 'row');
    for (const item of items) {
      const b = button(item, 'small');
      b.dataset.item = item.id;
      b.addEventListener('click', () => {
        this.hideMenu();
        choose(item.id);
      });
      row.append(b);
    }
    this.menu.append(row);
    this.menu.hidden = false;
    const w = this.menu.offsetWidth, h = this.menu.offsetHeight;
    this.menu.style.left = `${Math.max(8, Math.min(innerWidth - w - 8, x - w / 2))}px`;
    this.menu.style.top = `${Math.max(8, Math.min(innerHeight - h - 8, y - h - 26))}px`;
  }

  hideMenu(): void {
    this.menu.hidden = true;
  }

  // ------------------------------------------------------------ praten
  get speaking(): boolean {
    return !this.speech.hidden;
  }

  /** Een figuur zegt iets. Het mondje beweegt zolang het praat. */
  say(who: FigureId, mood: Mood, text: string): void {
    this.hush();
    const face = this.speech.querySelector<HTMLElement>('.portrait')!;
    this.speech.querySelector('.name')!.textContent = t(`figure.${who}`);
    this.speech.querySelector('.text')!.textContent = text;
    this.speech.dataset.mood = mood;
    this.speech.hidden = false;
    face.innerHTML = portrait(who, mood, 0);
    const talkMs = Math.max(1200, Math.min(4500, text.length * 60));
    const frames: Mouth[] = [1, 2, 1, 0];
    const start = performance.now();
    let i = 0;
    this.mouthTimer = window.setInterval(() => {
      const talking = performance.now() - start < talkMs;
      face.innerHTML = portrait(who, mood, talking ? frames[i++ % frames.length] : 0);
      if (!talking) clearInterval(this.mouthTimer);
    }, 130);
    this.speechTimer = window.setTimeout(() => this.hush(), talkMs + 3000);
  }

  hush(): void {
    clearTimeout(this.speechTimer);
    clearInterval(this.mouthTimer);
    this.speech.hidden = true;
  }

  // ------------------------------------------------------------ level gehaald
  showLevelDone(levelNumber: number, rewardIcon: string, rewardName: string, text: string, next: () => void): void {
    this.hush();
    this.overlay.replaceChildren();
    const card = el('div', 'card');
    card.append(
      el('div', 'stars', icon('star')),
      el('div', 'boss', `<div class="portrait">${portrait('director', 'happy', 1)}</div><div class="big"></div>`),
      el('div', 'sub', t('level', { n: levelNumber })),
      el('div', 'reward', `${rewardIcon}<span>${t('level.new')}</span><b>${rewardName}</b>`),
    );
    card.querySelector('.big')!.textContent = text;
    const go = el('button', 'tool go', `${icon('next')}<b>${t('level.next')}</b>`);
    go.addEventListener('click', () => {
      this.overlay.hidden = true;
      next();
    });
    card.append(go);
    this.overlay.append(card);
    this.overlay.hidden = false;
  }
}
