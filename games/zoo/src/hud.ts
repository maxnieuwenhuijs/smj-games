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
  /** Wat er gebeurt als je op de melding tikt (naast dichtgaan): naar de plek gaan waar hij over gaat. */
  private speechTap: (() => void) | null = null;
  private wallet = $('wallet');
  private walletKey = '';
  private canvasHost = $('app');
  private goalRows: { fill: HTMLElement; count: HTMLElement; row: HTMLElement; n: number }[] = [];
  private mouthTimer = 0;
  private voice: Voice | null = null;

  private need = el('div', '');
  private needKey = '';
  /** Het kaartje van een evenement (een gast vraagt om hulp). */
  private offer = el('div', '');
  /** Het handje dat wijst waar je kunt tikken. */
  private hand = el('div', '', `<i class="ring"></i><span class="arm">${icon('hand')}</span>`);
  /** Wat er gebeurt als je naast de kaart tikt (alleen bij de dierenarts). */
  private overlayTap: (() => void) | null = null;

  constructor(private on: { tool(id: string, row?: string, option?: string): void; home(): void; goal(index: number): void; need(index: number): void; turn(dir: 1 | -1): void; spin(): void }) {
    this.need.id = 'needs';
    this.need.hidden = true;
    this.need.setAttribute('aria-label', t('need'));
    // links in het midden van het scherm, los van de knoppenbalk
    document.getElementById('ui')!.append(this.need);
    this.offer.id = 'offer';
    this.offer.hidden = true;
    document.getElementById('ui')!.append(this.offer);
    // het handje ligt boven de knoppen, maar onder een kaart
    this.hand.id = 'pointer';
    this.hand.hidden = true;
    this.overlay.before(this.hand);
    this.overlay.addEventListener('click', e => {
      if (e.target === this.overlay) this.overlayTap?.();
    });
    const home = $('home');
    home.innerHTML = icon('home');
    home.setAttribute('aria-label', t('home'));
    home.addEventListener('click', () => this.on.home());
    this.speech.querySelector('.goto')!.innerHTML = icon('goto');
    this.speech.addEventListener('click', () => {
      // eerst dicht, dan pas erheen: de melding zelf zit anders in de weg
      const go = this.speechTap;
      this.hush();
      go?.();
    });
    // twee pijlen rechtsboven: het beeld een kwartslag naar links of naar rechts draaien
    for (const dir of [-1, 1] as const) {
      const b = el('button', 'tool small', icon('camturn'));
      b.id = dir < 0 ? 'turnL' : 'turnR';
      b.setAttribute('aria-label', t(dir < 0 ? 'turn.left' : 'turn.right'));
      b.addEventListener('click', () => this.on.turn(dir));
      document.getElementById('ui')!.append(b);
    }
    // de draaiknop: staat er alleen als je iets gaat neerzetten wat je kunt draaien
    this.spinBtn.id = 'spin';
    this.spinBtn.hidden = true;
    this.spinBtn.setAttribute('aria-label', t('spin'));
    this.spinBtn.addEventListener('click', () => this.on.spin());
    document.getElementById('ui')!.append(this.spinBtn);
    this.pick.id = 'pick';
    this.pick.hidden = true;
    document.getElementById('ui')!.append(this.pick);
    // schuift de keuzerij of verandert het scherm, dan schuift de draaiknop mee
    this.options.addEventListener('scroll', () => this.placeSpin(), true);
    addEventListener('resize', () => this.placeSpin());
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
   * Dieren die hulp nodig hebben: per diersoort één knop met dat dier en wat het mist, onder elkaar links in het
   * midden van het scherm. Er passen er vijf in beeld; zijn het er meer, dan kun je in het lijstje scrollen. Een tik
   * brengt je naar dat dier.
   */
  setNeeds(needs: { icon: string; badge: string }[]): void {
    const key = needs.map(n => `${n.icon}|${n.badge}`).join('/');
    if (key === this.needKey) return;
    this.needKey = key;
    this.need.hidden = !needs.length;
    const top = this.need.scrollTop;
    this.need.replaceChildren();
    needs.forEach((n, i) => {
      const b = el('button', 'tool small', `${n.icon}<i class="what">${n.badge}</i>`);
      b.addEventListener('click', () => this.on.need(i));
      this.need.append(b);
    });
    this.need.scrollTop = top;
  }

  /** Een kaart met uitleg in stappen (plaatje en zin per stap) en een knop om verder te gaan. */
  /**
   * Het kaartje van een evenement: een plaatje, een paar woorden en een groene speelknop. Tik je erop, dan gebeurt
   * `onYes` (het puzzeltje begint); met het rode kruisje doe je het weg. Zonder `onYes` is het alleen een
   * briefje met een opdracht (bijvoorbeeld: tik op het verblijf van dit dier), dat je wel kunt wegklikken.
   */
  showOffer(picture: string, label: string, onYes: (() => void) | null, onNo: () => void): void {
    const go = el('button', onYes ? 'go' : 'go still', `<span class="pic">${picture}</span><span class="label">${label}</span>${onYes ? `<span class="play">${icon('play')}</span>` : ''}`);
    go.type = 'button';
    if (onYes) go.addEventListener('click', onYes);
    const no = el('button', 'no', '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M10 10 L38 38 M38 10 L10 38" fill="none" stroke="#fff" stroke-width="9" stroke-linecap="round"/></svg>');
    no.type = 'button';
    no.setAttribute('aria-label', t('event.no'));
    no.addEventListener('click', onNo);
    this.offer.replaceChildren(go, no);
    this.offer.hidden = false;
  }

  hideOffer(): void {
    this.offer.hidden = true;
    this.offer.replaceChildren();
  }

  showGuide(title: string, steps: { icon: string; text: string }[], ok: string): void {
    this.overlayTap = null;
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

  private spinBtn = el('button', 'tool small', `${icon('turn')}<b>${t('spin')}</b>`);
  /** Een paar keuzeknoppen die boven het gekozen ding hangen, net als de draaiknop (bij een hek: hok slepen of los). */
  private pick = el('div', '');
  private pickAt = '';

  /**
   * Keuzeknoppen boven het gekozen ding in de balk tonen (`anchor`: die keuze), of weghalen (`options` leeg).
   * Een tik op een knop geeft zijn id door aan `choose`.
   */
  setPick(options: { id: string; icon: string; label: string; on: boolean }[] | null, anchor = '', choose: (id: string) => void = () => undefined): void {
    this.pick.replaceChildren();
    this.pick.hidden = !options?.length;
    this.pickAt = anchor;
    for (const o of options ?? []) {
      const b = el('button', `tool small${o.on ? ' on' : ''}`, `${o.icon}<b>${o.label}</b>`);
      b.type = 'button';
      b.addEventListener('click', () => choose(o.id));
      this.pick.append(b);
    }
    this.placePick();
  }

  /** Zet de keuzeknoppen recht boven het gekozen ding, boven de bovenste rij. */
  private placePick(): void {
    if (this.pick.hidden) return;
    const at = this.options.querySelector<HTMLElement>(`[data-option="${this.pickAt}"].on`) ?? this.toolbar.querySelector<HTMLElement>('.tool.on');
    if (!at) return;
    const b = this.pick.getBoundingClientRect(), r = at.getBoundingClientRect();
    const tops = [...this.options.querySelectorAll<HTMLElement>('.tool')].map(k => k.getBoundingClientRect()).filter(k => k.width > 0).map(k => k.top);
    const top = tops.length ? Math.min(...tops) : r.top;
    this.pick.style.left = `${Math.max(6, Math.min(innerWidth - b.width - 6, r.left + r.width / 2 - b.width / 2))}px`;
    this.pick.style.top = `${Math.max(6, top - b.height - 10)}px`;
  }
  /** Het ding in de balk onderaan waar de draaiknop boven hangt. */
  private spinAt: HTMLElement | null = null;

  /**
   * De draaiknop tonen of verbergen. Hij hangt in de balk onderaan, recht boven het ding dat je gekozen hebt
   * (`anchor`: die keuze; zonder keuzerij boven de knop zelf). `quarters`: hoe vaak er al gedraaid is, zodat het
   * pijltje mee draait.
   */
  setSpin(show: boolean, quarters = 0, anchor = ''): void {
    this.spinBtn.hidden = !show;
    this.spinBtn.style.setProperty('--q', String(quarters));
    this.spinAt = show ? (anchor && this.options.querySelector<HTMLElement>(`[data-option="${anchor}"].on`)) || this.toolbar.querySelector<HTMLElement>('.tool.on') : null;
    this.placeSpin();
  }

  /**
   * Zet de draaiknop op zijn plek. Zijn er keuzerijen, dan staat hij in de bovenste rij, links naast de eerste
   * knop (of rechts naast de laatste als daar geen plek is): zo hoort hij bij de balk en zweeft hij niet los boven
   * het park. Zonder keuzerijen staat hij recht boven de gekozen knop.
   */
  private placeSpin(): void {
    this.placePick();
    const at = this.spinAt;
    if (!at || !at.isConnected || this.spinBtn.hidden) return;
    const b = this.spinBtn.getBoundingClientRect();
    const boxes = [...this.options.querySelectorAll<HTMLElement>('.tool')].map(k => k.getBoundingClientRect()).filter(k => k.width > 0);
    if (boxes.length) {
      // de knop Draai staat helemaal bovenaan: boven de bovenste rij, links, recht boven de eerste knop van die rij.
      // Zo is de volgorde van onder naar boven steeds: de grote knop, de groep, de dingen zelf, en dan draaien.
      const top = Math.min(...boxes.map(k => k.top)), row = boxes.filter(k => k.top < top + 8);
      // recht boven het gekozen ding in die rij (staat het gekozen ding niet in de bovenste rij, dan boven het midden)
      const r = at.getBoundingClientRect(), chosen = r.width > 0 && r.top < top + 8;
      const mid = chosen ? r.left + r.width / 2 : (Math.min(...row.map(k => k.left)) + Math.max(...row.map(k => k.right))) / 2;
      this.spinBtn.style.left = `${Math.max(6, Math.min(innerWidth - b.width - 6, mid - b.width / 2))}px`;
      this.spinBtn.style.top = `${Math.max(6, top - b.height - 10)}px`;
      return;
    }
    const r = at.getBoundingClientRect();
    this.spinBtn.style.left = `${Math.max(6, Math.min(innerWidth - b.width - 6, r.left + r.width / 2 - b.width / 2))}px`;
    this.spinBtn.style.top = `${r.top - b.height - 12}px`;
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
  /** `extra`: kant-en-klaar plaatje (het seizoen, het weer) dat als laatste vakje onder het uur komt. */
  setWallet(coins: number, cap: number, guests: number | null, hour: number | string | null = null, sky: 'sun' | 'moon' | null = null, extra = ''): void {
    const key = `${coins}/${guests}/${hour}/${sky}/${extra}`;
    if (key === this.walletKey) return;
    this.walletKey = key;
    this.wallet.innerHTML =
      `<span class="pill${coins >= cap ? ' full' : ''}" title="${t('wallet.coins')}">${icon('coin')}<b>${coins}</b></span>` +
      (guests === null ? '' : `<span class="pill" title="${t('wallet.guests')}">${icon('guest')}<b>${guests}</b></span>`) +
      (hour === null ? '' : `<span class="pill" title="${t('wallet.hour')}">${icon(sky ?? 'clock')}<b>${hour}</b></span>`) +
      (extra ? `<span class="pill extra">${extra}</span>` : '');
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

  /**
   * Een rond bordje met een plaatje (vieze stal, jarig, kind kwijt). Het spel zet het zelf op zijn plek met
   * `style.transform`. Met de klas `tap` erbij kun je erop tikken.
   */
  makeBadge(html: string, cls = ''): HTMLElement {
    const b = el('div', `bubble badge ${cls}`, html);
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

  // ------------------------------------------------------------ het wijzende handje
  get pointing(): boolean {
    return !this.hand.hidden;
  }

  /** Het handje wijst met zijn vingertop naar dit punt op het scherm en tikt rustig, tot `hidePointer`. */
  pointAt(x: number, y: number): void {
    // onderin komt het handje van boven, helemaal rechts leunt het naar links: zo blijft het in beeld
    this.hand.classList.toggle('down', y > innerHeight - 190);
    this.hand.classList.toggle('left', x > innerWidth - 70);
    this.hand.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    this.hand.hidden = false;
  }

  /** Het handje wijst naar een knop in de balk, of naar een keuze in de rij erboven als die er staat. */
  pointAtTool(toolId: string, option?: string): void {
    let target = this.toolbar.querySelector<HTMLElement>(`[data-tool="${CSS.escape(toolId)}"]`);
    if (option) target = this.options.querySelector<HTMLElement>(`[data-option="${CSS.escape(option)}"]`) ?? target;
    const r = target?.getBoundingClientRect();
    if (!r || !r.width) {
      this.hidePointer();
      return;
    }
    // een keuze die buiten beeld geschoven is: het handje blijft aan de rand staan
    const x = Math.max(24, Math.min(innerWidth - 24, r.left + r.width / 2));
    this.pointAt(x, r.top + r.height * 0.55);
  }

  hidePointer(): void {
    this.hand.hidden = true;
  }

  // ------------------------------------------------------------ kaarten
  private openCard(card: HTMLElement, outside: (() => void) | null = null): void {
    this.overlayTap = outside;
    this.overlay.replaceChildren(card);
    this.overlay.hidden = false;
  }

  /** De grote groene knop met een vinkje onderaan een kaart. */
  private okButton(card: HTMLElement, ok: string, then?: () => void): HTMLButtonElement {
    const go = el('button', 'tool go', `${icon('check')}<b></b>`);
    go.querySelector('b')!.textContent = ok;
    go.addEventListener('click', () => {
      if (card.isConnected) this.overlay.hidden = true;
      then?.();
    });
    return go;
  }

  /**
   * De dierenarts: het zieke dier in het midden en eronder de stappen op volgorde. Alleen de stap die aan de beurt is
   * licht op. Een tik op een andere knop schudt alleen even; fout gaan kan niet. Na de laatste stap is het dier weer
   * blij, gaat de kaart dicht en volgt `done`. Naast de kaart tikken sluit hem zonder `done`.
   */
  showVet(title: string, animalIcon: string, steps: { id: string; icon: string; label: string }[], done: () => void): void {
    const card = el('div', 'card vet');
    const head = el('div', 'big');
    head.textContent = title;
    const patient = el('div', 'patient sick', `<span class="pic">${animalIcon}</span>`);
    const pic = patient.firstElementChild as HTMLElement;
    const row = el('div', 'steps');
    let at = 0;
    const cured = (): void => {
      // vanaf nu is het dier beter: naast de kaart tikken breekt niets meer af
      this.overlayTap = null;
      setTimeout(() => {
        patient.classList.replace('sick', 'well');
        for (let i = 0; i < 6; i++) {
          const spark = el('i', 'spark', icon(i % 2 ? 'sparkle' : 'heart'));
          const a = (i * 60 - 90) * (Math.PI / 180);
          spark.style.setProperty('--x', `${Math.round(Math.cos(a) * 96)}px`);
          spark.style.setProperty('--y', `${Math.round(Math.sin(a) * 96)}px`);
          spark.style.setProperty('--d', `${i * 0.05}s`);
          patient.append(spark);
        }
      }, 350);
      setTimeout(() => {
        // staat er intussen een andere kaart, dan blijft die open
        if (card.isConnected) this.overlay.hidden = true;
        done();
      }, 1250);
    };
    const buttons = steps.map((step, i) => {
      const b = el('button', 'tool vetstep', `${step.icon}<b></b><i class="tick">${icon('check')}</i>`);
      b.querySelector('b')!.textContent = step.label;
      b.setAttribute('aria-label', step.label);
      b.dataset.step = step.id;
      b.classList.toggle('now', i === 0);
      b.addEventListener('animationend', e => {
        if (e.target === b) b.classList.remove('no');
      });
      b.addEventListener('click', () => {
        if (i < at) return;
        if (i > at) {
          // nog niet aan de beurt: even schudden
          b.classList.remove('no');
          void b.offsetWidth;
          b.classList.add('no');
          return;
        }
        at++;
        sfx('place');
        b.classList.replace('now', 'done');
        // het ding vliegt van de knop naar het dier
        const from = b.getBoundingClientRect(), to = patient.getBoundingClientRect();
        const fly = el('i', 'fly', step.icon);
        fly.style.setProperty('--dx', `${Math.round(from.left + from.width / 2 - to.left - to.width / 2)}px`);
        fly.style.setProperty('--dy', `${Math.round(from.top + from.height / 2 - to.top - to.height / 2)}px`);
        patient.append(fly);
        setTimeout(() => fly.remove(), 700);
        // bij elke stap krijgt het dier wat meer kleur
        pic.style.setProperty('--sick', String(1 - at / steps.length));
        if (at < steps.length) buttons[at].classList.add('now');
        else cured();
      });
      row.append(b);
      return b;
    });
    card.append(head, patient, row);
    this.openCard(card, () => {
      this.overlay.hidden = true;
    });
    if (!steps.length) cured();
  }

  /**
   * Het gastenboek: een prikbord met tekeningen van het dier dat gasten het leukst vonden, met hartjes erbij
   * (hooguit vijf, daarna het getal). Er passen twaalf tekeningen op.
   */
  showBook(title: string, entries: { icon: string; n: number }[], empty: string, ok: string): void {
    const card = el('div', 'card book');
    const head = el('div', 'big');
    head.textContent = title;
    const board = el('div', 'board');
    if (!entries.length) {
      const none = el('div', 'none');
      none.textContent = empty;
      board.append(none);
    }
    const tilt = [-5, 3, -2, 6, -4, 2, 5, -3];
    entries.slice(0, 12).forEach((entry, i) => {
      const n = Math.max(0, Math.floor(entry.n));
      const note = el('div', 'note', `<span class="draw">${entry.icon}</span><span class="likes">${icon('heart').repeat(Math.min(5, n))}${n > 5 ? `<b>${n}</b>` : ''}</span>`);
      note.style.setProperty('--r', `${tilt[i % tilt.length]}deg`);
      note.style.setProperty('--d', `${i * 0.05}s`);
      board.append(note);
    });
    card.append(head, board, this.okButton(card, ok));
    this.openCard(card);
  }

  /** Wist je dat? Een groot plaatje van het dier, zijn naam, één weetje en een knop om verder te gaan. */
  showFact(pic: string, name: string, text: string, ok: string, onOk?: () => void): void {
    const card = el('div', 'card fact');
    card.append(el('div', 'reward', `<span class="pic">${pic}</span><b></b><i class="deco">${icon('sparkle')}</i>`), el('div', 'say'));
    card.querySelector('.reward b')!.textContent = name;
    card.querySelector('.say')!.textContent = text;
    card.append(this.okButton(card, ok, onOk));
    this.openCard(card);
  }

  // ------------------------------------------------------------ menu
  get menuOpen(): boolean {
    return !this.menu.hidden;
  }

  showMenu(x: number, y: number, title: string, items: ToolOption[], choose: (id: string) => void, header = '', kind = ''): void {
    this.menu.replaceChildren();
    // `kind`: het soort menu, voor een eigen opmaak (het menu van een dier heeft kleine knoppen)
    this.menu.dataset.kind = kind;
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
  say(who: FigureId, mood: Mood, text: string, voice: Voice | null = null, onTap: (() => void) | null = null): void {
    this.hush();
    // `onTap`: de melding gaat over een plek in het park; tik erop en het beeld gaat erheen
    this.speechTap = onTap;
    this.speech.querySelector<HTMLElement>('.goto')!.hidden = !onTap;
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
    this.speechTap = null;
  }

  // ------------------------------------------------------------ level gehaald
  /** `extras`: plaatjes van wat er naast het dier nog vrijkomt (iets voor het park, een speeltoestel). */
  showLevelDone(levelNumber: number, rewardIcon: string, rewardName: string, text: string, next: () => void, who: FigureId = 'director', extras: string[] = []): void {
    this.hush();
    this.overlayTap = null;
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
