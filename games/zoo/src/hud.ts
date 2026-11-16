// De knoppen en balken bovenop het spelbeeld. Alles is gewone HTML.
import { t } from '@smj/shared';

export interface ToolOption {
  id: string;
  icon: string;
  label: string;
}
export interface ToolDef {
  id: string;
  icon: string;
  label: string;
  options?: ToolOption[];
}
export interface GoalView {
  icon: string;
  label: string;
  n: number;
}

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, html = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = cls;
  node.innerHTML = html;
  return node;
}

export class Hud {
  private toolbar = $('toolbar');
  private options = $('options');
  private goals = $('goals');
  private bubbles = $('bubbles');
  private picker = $('picker');
  private overlay = $('overlay');
  private goalRows: { fill: HTMLElement; count: HTMLElement; row: HTMLElement; n: number }[] = [];

  constructor(private on: { tool(id: string, option?: string): void; home(): void }) {
    $('home').addEventListener('click', () => this.on.home());
    $('home').setAttribute('aria-label', t('home'));
  }

  setTools(defs: ToolDef[], active: string, activeOption: string | undefined, hint: string | null): void {
    this.toolbar.replaceChildren();
    this.options.replaceChildren();
    for (const def of defs) {
      const b = el('button', 'tool', `<span>${def.icon}</span>${def.label}`);
      b.dataset.tool = def.id;
      b.classList.toggle('on', def.id === active);
      b.classList.toggle('hint', def.id === hint && def.id !== active);
      b.addEventListener('click', () => this.on.tool(def.id));
      this.toolbar.append(b);
      if (def.id === active && def.options)
        for (const opt of def.options) {
          const o = el('button', 'tool small', `<span>${opt.icon}</span>${opt.label}`);
          o.dataset.option = opt.id;
          o.classList.toggle('on', opt.id === activeOption);
          o.addEventListener('click', () => this.on.tool(def.id, opt.id));
          this.options.append(o);
        }
    }
  }

  setGoals(levelNumber: number | null, goals: GoalView[]): void {
    this.goals.replaceChildren();
    this.goalRows = [];
    this.goals.append(el('div', 'level', levelNumber === null ? '🏆' : `⭐ ${levelNumber}`));
    for (const g of goals) {
      const row = el('div', 'goal');
      row.title = g.label;
      row.setAttribute('aria-label', g.label);
      const fill = el('div', 'fill');
      const bar = el('div', 'bar');
      bar.append(fill);
      const count = el('div', 'count', `0/${g.n}`);
      row.append(el('div', 'icon', g.icon), bar, count);
      this.goals.append(row);
      this.goalRows.push({ fill, count, row, n: g.n });
    }
  }

  updateGoals(values: number[]): void {
    this.goalRows.forEach((r, i) => {
      const v = values[i] ?? 0;
      r.fill.style.width = `${(v / r.n) * 100}%`;
      r.count.textContent = `${v}/${r.n}`;
      r.row.classList.toggle('done', v >= r.n);
    });
  }

  makeBubble(): HTMLElement {
    const b = el('div', 'bubble');
    b.hidden = true;
    this.bubbles.append(b);
    return b;
  }

  /** Icoontje dat even omhoog zweeft. */
  float(icon: string, x: number, y: number): void {
    const f = el('div', 'float', icon);
    f.style.left = `${x}px`;
    f.style.top = `${y}px`;
    this.bubbles.append(f);
    setTimeout(() => f.remove(), 1100);
  }

  showPicker(x: number, y: number, items: ToolOption[], choose: (id: string) => void): void {
    this.picker.replaceChildren();
    for (const item of items) {
      const b = el('button', 'tool', `<span>${item.icon}</span>${item.label}`);
      b.dataset.food = item.id;
      b.addEventListener('click', () => {
        this.hidePicker();
        choose(item.id);
      });
      this.picker.append(b);
    }
    this.picker.hidden = false;
    const w = items.length * 104;
    this.picker.style.left = `${Math.max(8, Math.min(innerWidth - w - 8, x - w / 2))}px`;
    this.picker.style.top = `${Math.max(8, y - 150)}px`;
  }

  hidePicker(): void {
    this.picker.hidden = true;
  }

  showLevelDone(levelNumber: number, rewardIcon: string, rewardName: string, next: () => void): void {
    this.overlay.replaceChildren();
    const card = el('div', 'card');
    card.append(
      el('div', 'stars', '⭐'),
      el('div', 'big', t('level.done')),
      el('div', 'sub', t('level', { n: levelNumber })),
      el('div', 'reward', `<span>${rewardIcon}</span>${t('level.new')}<b>${rewardName}</b>`),
    );
    const go = el('button', 'tool go', `<span>▶️</span>${t('level.next')}`);
    go.addEventListener('click', () => {
      this.overlay.hidden = true;
      next();
    });
    card.append(go);
    this.overlay.append(card);
    this.overlay.hidden = false;
  }
}
