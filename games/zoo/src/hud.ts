// De knoppen, balken, menu's en het praatvenster bovenop het spelbeeld. Alles is gewone HTML.
import { t } from '@smj/shared';
import { isMuted, setMuted, sfx, type Voice } from './audio';
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
  /** De prijs is loon per uur, niet eenmalig. */
  per?: boolean;
  /** Net vrijgespeeld: er staat een sterretje op tot je het gekozen hebt. */
  fresh?: boolean;
  /** Geen knop maar een kopje in de rij (bijvoorbeeld de wereld waar de dieren erna bij horen). */
  divider?: boolean;
  /** Munten die je ervoor terugkrijgt. */
  gain?: number;
  /** In een menu: deze keuze staat aan. */
  on?: boolean;
}
export interface ToolDef extends ToolOption {
  /** Het groepje in de balk waar de knop bij hoort; knoppen van één groep staan samen in een gekleurd vak. */
  group?: string;
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
  const price = opt.gain ? `<i class="price gain">+${opt.gain}</i>` : opt.price ? `<i class="price${opt.cant ? ' cant' : ''}">${opt.price}${opt.per ? t('per.hour') : ''}</i>` : '';
  const b = el('button', `tool ${cls} ${opt.tone ?? ''}`, `${opt.icon}<b>${opt.label}</b>${price}${opt.fresh ? `<i class="new">${icon('star')}</i>` : ''}`);
  b.dataset.id = opt.id;
  if (opt.price) b.dataset.price = String(opt.price);
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
  private mouthTimer = 0;
  private voice: Voice | null = null;

  private need = el('div', '');
  private carry = el('div', 'pill');
  private needKey = '';

  constructor(private on: { tool(id: string, row?: string, option?: string): void; home(): void; goal(index: number): void; need(index: number): void }) {
    this.need.id = 'needs';
    this.need.hidden = true;
    this.need.setAttribute('aria-label', t('need'));
    // onderin het midden, boven de keuzerijen en de knoppenbalk
    document.getElementById('bottom')!.prepend(this.need);
    this.carry.id = 'carry';
    this.carry.hidden = true;
    document.getElementById('ui')!.append(this.carry);
    const home = $('home');
    home.innerHTML = icon('home');
    home.setAttribute('aria-label', t('home'));
    home.addEventListener('click', () => this.on.home());
    this.speech.addEventListener('click', () => this.hush());
    const sound = $('sound');
    const showSound = (): void => {
      sound.innerHTML = icon(isMuted() ? 'sound_off' : 'sound_on');
    };
    sound.setAttribute('aria-label', t('sound'));
    sound.addEventListener('click', () => {
      setMuted(!isMuted());
      if (isMuted()) this.hush();
      showSound();
    });
    showSound();
    // elke knop geeft een tikje
    document.addEventListener('click', e => {
      if ((e.target as HTMLElement).closest?.('button')) sfx('tap', { volume: 0.7 });
    }, true);
  }

  // ------------------------------------------------------------ knoppen
  /**
   * Dieren die hulp nodig hebben: per diersoort één knop met dat dier en wat het mist, naast elkaar onderin het
   * midden, boven de knoppen. Er passen er vijf in beeld; zijn het er meer, dan kun je in het lijstje scrollen. Een tik
   * brengt je naar dat dier.
   */
  setNeeds(needs: { icon: string; badge: string }[]): void {
    const key = needs.map(n => `${n.icon}|${n.badge}`).join('/');
    if (key === this.needKey) return;
    this.needKey = key;
    this.need.hidden = !needs.length;
    const left = this.need.scrollLeft;
    this.need.replaceChildren();
    needs.forEach((n, i) => {
      const b = el('button', 'tool small', `${n.icon}<i class="what">${n.badge}</i>`);
      b.addEventListener('click', () => this.on.need(i));
      this.need.append(b);
    });
    this.need.scrollLeft = left;
  }

  /** Een kaart met uitleg in stappen (plaatje en zin per stap) en een knop om verder te gaan. */
  showGuide(title: string, steps: { icon: string; text: string }[], ok: string): void {
    this.overlay.replaceChildren();
    const card = el('div', 'card guide');
    const head = el('div', 'big');
    head.textContent = title;
    card.append(head);
    steps.forEach((step, i) => {
      const row = el('div', 'step', `<i class="nr">${i + 1}</i>${step.icon}<span></span>`);
      row.querySelector('span')!.textContent = step.text;
      card.append(row);
    });
    const go = el('button', 'tool go', `${icon('check')}<b></b>`);
    go.querySelector('b')!.textContent = ok;
    go.addEventListener('click', () => {
      this.overlay.hidden = true;
    });
    card.append(go);
    this.overlay.append(card);
    this.overlay.hidden = false;
  }

  /** Het afval dat je in je handen hebt: zoveel stuks, op weg naar een afvalbak. */
  setCarry(n: number): void {
    this.carry.hidden = !n;
    if (n) this.carry.innerHTML = `${icon('litter')}<b>${n}</b>${icon('bin')}`;
  }

  /** `open`: de knop waarvan de keuzerij open blijft staan terwijl het handje aan staat (net iets neergezet). */
  setTools(defs: ToolDef[], active: string, hint: string | null, open: string | null = null): void {
    document.getElementById('ui')!.dataset.tool = active;
    // waar de rijen stonden (bij veel dieren scrol je opzij): dat blijft zo als de rij opnieuw wordt opgebouwd
    const scrolled = new Map([...this.options.children].map(row => [(row as HTMLElement).dataset.sig, row.scrollLeft]));
    this.toolbar.replaceChildren();
    this.options.replaceChildren();
    // hoe meer knoppen, hoe smaller ze worden, zodat alles naast elkaar past
    this.toolbar.classList.toggle('some', defs.length >= 8);
    this.toolbar.classList.toggle('many', defs.length >= 10);
    this.toolbar.classList.toggle('full', defs.length >= 12);
    let box: HTMLElement | null = null;
    for (const def of defs) {
      const b = button(def, '');
      b.dataset.tool = def.id;
      b.classList.toggle('on', def.id === active);
      b.classList.toggle('open', def.id === open);
      b.classList.toggle('hint', def.id === hint && def.id !== active);
      b.addEventListener('click', () => this.on.tool(def.id));
      // een nieuw vak zodra de groep wisselt
      if (!box || box.dataset.group !== (def.group ?? '')) {
        box = el('div', 'grp');
        box.dataset.group = def.group ?? '';
        this.toolbar.append(box);
      }
      box.append(b);
      if (def.id !== (open ?? active)) continue;
      for (const row of def.rows ?? []) {
        const line = el('div', 'row');
        line.dataset.sig = `${def.id}/${row.key}/${row.options.map(o => o.id).join(',')}`;
        for (const opt of row.options) {
          if (opt.divider) {
            line.append(el('div', 'sep', `${opt.icon}<b>${opt.label}</b>`));
            continue;
          }
          const o = button(opt, 'small');
          o.dataset.option = opt.id;
          o.classList.toggle(def.id === active ? 'on' : 'last', opt.id === row.active);
          o.addEventListener('click', () => this.on.tool(def.id, row.key, opt.id));
          line.append(o);
        }
        this.options.append(line);
      }
    }
    // dezelfde rij als net: weer op dezelfde plek; een nieuwe rij: de gekozen knop in beeld
    [...this.options.children].forEach(row => {
      const was = scrolled.get((row as HTMLElement).dataset.sig);
      if (was !== undefined) row.scrollLeft = was;
      else (row.querySelector('.tool.on, .tool.last') as HTMLElement | null)?.scrollIntoView({ inline: 'center', block: 'nearest' });
    });
  }

  /** Kleurt de prijskaartjes: grijs als er niet genoeg munten zijn. De knoppen zelf blijven staan. */
  setAfford(coins: number): void {
    for (const b of document.querySelectorAll<HTMLElement>('#bottom [data-price]'))
      b.querySelector('.price')?.classList.toggle('cant', Number(b.dataset.price) > coins);
  }

  setCursor(css: string): void {
    this.canvasHost.style.cursor = css;
  }

  /** De kas (munten) en het aantal gasten in het park. */
  /** `sky`: zon of maan naast het uur (vanaf het level waarin het ook nacht wordt); anders een klokje. */
  setWallet(coins: number, cap: number, guests: number | null, hour: number | null = null, sky: 'sun' | 'moon' | null = null): void {
    const key = `${coins}/${guests}/${hour}/${sky}`;
    if (key === this.walletKey) return;
    this.walletKey = key;
    this.wallet.innerHTML =
      `<span class="pill${coins >= cap ? ' full' : ''}" title="${t('wallet.coins')}">${icon('coin')}<b>${coins}</b></span>` +
      (guests === null ? '' : `<span class="pill" title="${t('wallet.guests')}">${icon('guest')}<b>${guests}</b></span>`) +
      (hour === null ? '' : `<span class="pill" title="${t('wallet.hour')}">${icon(sky ?? 'clock')}<b>${hour}</b></span>`);
  }

  // ------------------------------------------------------------ doelen
  setGoals(levelNumber: number | null, goals: GoalView[], world = ''): void {
    this.goals.replaceChildren();
    this.goalRows = [];
    const head = el('div', 'level', levelNumber === null ? icon('trophy') : `${icon('star')}<b>${levelNumber}</b>`);
    const where = el('span', 'world');
    where.textContent = world;
    head.append(where);
    this.goals.append(head);
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

  /** Bordje boven een verblijf dat even dicht is. De naam van een verblijf zie je pas als je erop tikt. */
  /** Een bordje boven iets wat niet aan het pad staat: gasten kunnen er niet bij. */
  makeNoPath(): HTMLElement {
    const b = el('div', 'bubble nopath', `${icon('path')}${icon('cross', 'badge')}`);
    b.hidden = true;
    this.layer.append(b);
    return b;
  }

  /** Het prijskaartje boven een strook grond die te koop is; een tik erop opent het koopmenu. */
  makeForSale(price: number, tap: () => void): HTMLElement {
    const b = el('div', 'bubble forsale', `${icon('land')}<b>${price}</b>${icon('coin')}`);
    b.hidden = true;
    b.addEventListener('click', tap);
    this.layer.append(b);
    return b;
  }

  makeSign(text: string): HTMLElement {
    const b = el('div', 'penname closed', `${icon('pen')}<b></b>`);
    b.querySelector('b')!.textContent = text;
    b.hidden = true;
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
      b.classList.toggle('on', !!item.on);
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

  /**
   * Een figuur zegt iets. Met een ingesproken zin beweegt het mondje mee met het geluid en gaat het
   * venster dicht als de zin uit is; zonder stem praat het figuur op een klokje.
   */
  say(who: FigureId, mood: Mood, text: string, voice: Voice | null = null): void {
    this.hush();
    const face = this.speech.querySelector<HTMLElement>('.portrait')!;
    this.speech.querySelector('.name')!.textContent = t(`figure.${who}`);
    this.speech.querySelector('.text')!.textContent = text;
    this.speech.dataset.mood = mood;
    this.speech.hidden = false;
    face.innerHTML = portrait(who, mood, 0);
    this.voice = voice;
    const talkMs = Math.max(1200, Math.min(4500, text.length * 60));
    const frames: Mouth[] = [1, 2, 1, 0];
    const start = performance.now();
    let shown: Mouth = 0, quiet = 0, tick = 0, peak = 0.03;
    const show = (m: Mouth): void => {
      if (m === shown) return;
      shown = m;
      face.innerHTML = portrait(who, mood, m);
    };
    this.mouthTimer = window.setInterval(() => {
      const ms = performance.now() - start;
      tick++;
      if (voice && !voice.done && (voice.started || ms < 2500)) {
        // hoe hard er nu gepraat wordt, afgezet tegen het hardste stukje van deze zin
        const level = voice.level();
        peak = Math.max(peak * 0.99, level, 0.03);
        show(level > peak * 0.5 ? 2 : level > peak * 0.18 ? 1 : 0);
      } else if (voice?.started) {
        // de zin is uit: nog even laten staan
        show(0);
        quiet += 65;
        if (quiet > 1100) this.hush();
      } else {
        if (tick % 2 === 0) show(ms < talkMs ? frames[(tick / 2) % frames.length] : 0);
        if (ms > talkMs + 3000) this.hush();
      }
    }, 65);
  }

  hush(): void {
    clearInterval(this.mouthTimer);
    this.voice?.stop();
    this.voice = null;
    this.speech.hidden = true;
  }

  // ------------------------------------------------------------ level gehaald
  /** `extras`: plaatjes van wat er naast het dier nog vrijkomt (iets voor het park, een speeltoestel). */
  showLevelDone(levelNumber: number, rewardIcon: string, rewardName: string, text: string, next: () => void, who: FigureId = 'director', extras: string[] = []): void {
    this.hush();
    this.overlay.replaceChildren();
    const card = el('div', 'card');
    card.append(
      el('div', 'stars', icon('star')),
      el('div', 'boss', `<div class="portrait">${portrait(who, 'happy', 1)}</div><div class="big"></div>`),
      el('div', 'sub', t('level', { n: levelNumber })),
      el('div', 'reward', `${rewardIcon}<span>${t('level.new')}</span><b>${rewardName}</b>`),
    );
    card.querySelector('.big')!.textContent = text;
    if (extras.length) card.append(el('div', 'also', `<span>+</span>${extras.join('')}`));
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
