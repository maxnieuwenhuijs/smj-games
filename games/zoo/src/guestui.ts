// Twee kleine dingen op het scherm bij de gasten: de stippellijn als je met je vinger de weg wijst, en de knop met de
// trommel voor de optocht. Het spel (game.ts) zet ze neer en houdt ze bij.
import { t } from '@smj/shared';
import { icon } from './icons';

const SVG = 'http://www.w3.org/2000/svg';
const HEART = 'M0 9 C-10 2 -10 -8 -4 -9 C-1 -9.5 0 -7 0 -5 C0 -7 1 -9.5 4 -9 C10 -8 10 2 0 9Z';
const layer = (): HTMLElement => document.getElementById('ui') ?? document.body;

/**
 * De stippellijn van een gast die de weg kwijt is naar je vinger. Aan het eind een ringetje: roze met een hartje
 * boven een verblijf met het lievelingsdier van de gast, wit boven een pad, en gestippeld als de gast er niet kan komen.
 */
export class WayLine {
  /** Loopt er nu een lijn? */
  active = false;
  private svg = document.createElementNS(SVG, 'svg');
  private under = document.createElementNS(SVG, 'polyline');
  private dots = document.createElementNS(SVG, 'polyline');
  private ring = document.createElementNS(SVG, 'circle');
  private heart = document.createElementNS(SVG, 'path');
  /** Waar je vinger langs ging (de eerste is de gast), en waar hij nu is. */
  private pts: [number, number][] = [];
  private at: [number, number] = [0, 0];
  private timer = 0;

  constructor() {
    this.svg.id = 'wayline';
    this.svg.setAttribute('aria-hidden', 'true');
    this.under.setAttribute('class', 'under');
    this.dots.setAttribute('class', 'dots');
    this.ring.setAttribute('class', 'ring');
    this.ring.setAttribute('r', '22');
    this.heart.setAttribute('class', 'heart');
    this.heart.setAttribute('d', HEART);
    this.svg.append(this.under, this.dots, this.ring, this.heart);
    this.svg.style.display = 'none';
    layer().append(this.svg);
  }

  /** Begin bij de gast (x, y in beeldpunten). */
  start(x: number, y: number): void {
    clearTimeout(this.timer);
    this.active = true;
    this.pts = [[x, y]];
    this.at = [x, y];
    this.svg.classList.remove('fade');
    this.svg.style.display = '';
    this.draw();
  }

  /** De gast zette een stapje: de lijn begint weer bij hem. */
  from(x: number, y: number): void {
    if (!this.pts.length) return;
    this.pts[0] = [x, y];
    this.draw();
  }

  /** De vinger is nu hier. `goal`: wat er onder de vinger is ('fav', 'ok' of 'no', zie hierboven). */
  to(x: number, y: number, goal: 'fav' | 'ok' | 'no'): void {
    const last = this.pts[this.pts.length - 1];
    if (Math.hypot(x - last[0], y - last[1]) > 14 && this.pts.length < 200) this.pts.push([x, y]);
    this.at = [x, y];
    this.svg.setAttribute('class', goal);
    this.draw();
  }

  /** Weg met de lijn: meteen, of na `after` tellen (dan vervaagt hij). */
  hide(after = 0): void {
    this.active = false;
    clearTimeout(this.timer);
    if (!after) {
      this.svg.style.display = 'none';
      return;
    }
    this.svg.classList.add('fade');
    this.timer = window.setTimeout(() => (this.svg.style.display = 'none'), after * 1000);
  }

  private draw(): void {
    const points = [...this.pts, this.at].map(([x, y]) => `${Math.round(x)},${Math.round(y)}`).join(' ');
    this.under.setAttribute('points', points);
    this.dots.setAttribute('points', points);
    this.ring.setAttribute('cx', String(Math.round(this.at[0])));
    this.ring.setAttribute('cy', String(Math.round(this.at[1])));
    this.heart.setAttribute('transform', `translate(${Math.round(this.at[0])} ${Math.round(this.at[1])}) scale(1.2)`);
  }
}

/**
 * De knop met de trommel: een tik begint de optocht. Moet je nog even wachten, dan is hij grijs en loopt er een
 * schaduw rond die steeds kleiner wordt; tijdens de optocht wipt hij op de maat mee.
 */
export class DrumButton {
  private el = document.createElement('button');
  private key = '';

  constructor(onTap: () => void) {
    this.el.type = 'button';
    this.el.id = 'drum';
    this.el.className = 'tool small';
    this.el.innerHTML = `${icon('drum')}<i class="wait"></i>`;
    this.el.setAttribute('aria-label', t('parade.drum'));
    this.el.hidden = true;
    this.el.addEventListener('click', onTap);
    // in het rijtje onder de kas, als eerste (daarna het snoepje en de slang)
    const quick = document.getElementById('quick');
    if (quick) quick.prepend(this.el);
    else layer().append(this.el);
  }

  /** `show`: de knop staat er. `rest`: zoveel van de wachttijd is er nog (1 tot 0). `on`: de optocht is bezig. */
  set(show: boolean, rest: number, on: boolean): void {
    const key = `${show}/${Math.ceil(rest * 40)}/${on}`;
    if (key === this.key) return;
    this.key = key;
    this.el.hidden = !show;
    this.el.classList.toggle('rest', rest > 0);
    this.el.classList.toggle('on', on);
    this.el.style.setProperty('--rest', rest.toFixed(3));
  }
}
