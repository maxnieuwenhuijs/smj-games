// Een hek maken: een tik met de hamer op een los of kapot hek opent een klein spelletje, voor elk soort hek een ander.
//   hout (ook het witte hekje): tik op de spijkers en timmer ze erin; de plank zwaait terug op zijn plek.
//   steen: leg de gevallen stenen terug in de gaten en smeer de voegen dicht met de troffel.
//   net: trek het doorgezakte net strak omhoog en knoop de losse eindjes vast.
//   glas: lijm de barst dicht en veeg het glas schoon met een doekje.
// Elk spelletje duurt een paar tellen en heeft een eigen tekening. Hoe erger het hek versleten is, hoe meer er te doen
// is (zie FIX in wear.ts). Fout gaan kan niet; een handje doet voor wat je moet doen. Wegklikken mag altijd: dan
// blijft het hek zoals het was. Het spel roept playFix aan en hoort via onDone of het hek gemaakt is.
import './fixgame.css';
import { t } from '@smj/shared';
import { sfx } from './audio';
import { icon, type IconId } from './icons';
import { burst, openCard, track, type PlayCard, type Point } from './playcard';
import { FIX, MEND_ICON, fixCount, hammerIn, pullUp, smudgeCount, type Mend } from './wear';

export interface FixOptions {
  /** Hoe dit hek gemaakt wordt: timmeren, metselen, knopen of lijmen. */
  mend: Mend;
  /** Hoe versleten het is (1, 2 of 3): daar hangt van af hoeveel er te doen is. */
  phase: number;
  /** Hout: het is het witte hekje. */
  white?: boolean;
  /** Glas: er staat water achter (een bak): dan zie je water en een vis achter de ruit. */
  tank?: boolean;
  /** De kleur die dit hek in het park heeft (zoals '#c58a4b'); zonder: de gewone kleur van dat soort hek. */
  color?: string;
  /** De uitleg wordt hiermee voorgelezen (de tekst zelf staat er ook); mag ontbreken. */
  say?: (text: string) => void;
  /** Eén keer aangeroepen als de kaart dichtgaat: is het hek gemaakt, of is de kaart weggeklikt? */
  onDone: (fixed: boolean) => void;
}

/** De tekening is 320 breed en 220 hoog; alles hieronder is in die maten. */
const W = 320, H = 220;
/** De gewone kleur van elk soort hek, als het verblijf geen eigen kleur heeft. */
const COLOR: Record<Mend, string> = { wood: '#c58a4b', stone: '#a9adb3', net: '#3f7f6b', glass: '#d9e6ee' };
/** De bolletjes bovenaan: per stap het plaatje van wat je doet. */
const STEPS: Record<Mend, IconId[]> = { wood: ['nail'], stone: ['wallbrick', 'trowel'], net: ['net', 'knot'], glass: ['glue', 'cloth'] };

/** Eén klus. */
interface Job {
  card: PlayCard;
  opts: FixOptions;
  /** Het vak met de tekening (daar volgt het spelletje de vinger) en de tekening zelf. */
  scene: HTMLElement;
  svg: SVGSVGElement;
  /** De kleur van het hek. */
  color: string;
}

const rnd = (n: number): number => Math.floor(Math.random() * n);
function shuffle<T>(list: T[]): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = rnd(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
/** Een kleur lichter (k boven 1) of donkerder (k onder 1) maken. */
function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const part = (v: number): number => Math.max(0, Math.min(255, Math.round(k > 1 ? v + (255 - v) * (k - 1) : v * k)));
  return `rgb(${part(n >> 16)}, ${part((n >> 8) & 255)}, ${part(n & 255)})`;
}
/** Een plek in de tekening als plek in het vak (van 0 tot 1), en andersom. */
const toPoint = (x: number, y: number): Point => ({ x: x / W, y: y / H });
const near = (p: Point, x: number, y: number): number => Math.hypot(p.x * W - x, p.y * H - y);
const q = <T extends SVGElement = SVGElement>(job: Job, sel: string): T => job.svg.querySelector<T>(sel)!;
const all = (job: Job, sel: string): SVGElement[] => [...job.svg.querySelectorAll<SVGElement>(sel)];
/** Het gras onderaan elke tekening. */
const GRASS =
  '<rect x="0" y="192" width="320" height="28" rx="10" fill="#bfe3a2"/><path d="M22 194 l4 -9 l4 9 M96 195 l4 -8 l4 8 M210 194 l4 -9 l4 9 M286 195 l4 -8 l4 8" fill="none" stroke="#86c95c" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>';

/** Zet de tekening in het vak en begint met het eerste stapje. */
function draw(job: Job, inner: string): void {
  job.scene.innerHTML = `<svg class="fx-svg" viewBox="0 0 ${W} ${H}" aria-hidden="true">${inner}</svg>`;
  job.svg = job.scene.querySelector('svg')!;
}

/** Iets wat de vinger volgt (de hamer, de troffel, de lijm, het doekje): een plaatje boven de tekening. */
function tool(job: Job, id: IconId, cls = ''): { el: HTMLElement; to: (p: Point) => void } {
  const el = document.createElement('span');
  el.className = `fx-tool ${cls}`;
  el.innerHTML = icon(id);
  job.scene.append(el);
  return {
    el,
    to: p => {
      el.style.left = `${(p.x * 100).toFixed(1)}%`;
      el.style.top = `${(p.y * 100).toFixed(1)}%`;
      el.classList.add('on');
    },
  };
}

/** De stap van nu in de bolletjes bovenaan. */
function showSteps(job: Job, icons: IconId[], done: number): void {
  job.card.steps(icons.map(id => icon(id)), done);
}

/** Het hek is weer heel: sterretjes, een vrolijk geluid, en de kaart gaat vanzelf dicht. */
function finale(job: Job, icons: IconId[]): void {
  job.card.hint();
  showSteps(job, icons, icons.length);
  job.scene.classList.add('fixed');
  job.card.title(t('fix.done'));
  sfx('chime');
  for (const at of [toPoint(70, 80), toPoint(160, 60), toPoint(250, 90)]) burst(job.scene, at, ['sparkle', 'star'], 5);
  job.card.later(1400, () => job.card.finish());
}

// ------------------------------------------------------------ hout: spijkers erin timmeren
/**
 * Een houten hek met twee planken tussen twee palen. De bovenste plank hangt aan één kant los (bij een kapot hek de
 * onderste ook), en er steken spijkers uit. Tik op een spijker: de hamer slaat, de spijker gaat een stukje verder
 * het hout in en de plank zwaait een stukje terug. Na een paar tikken zit hij vast. Naast een spijker tikken geeft
 * alleen een tikje op het hout.
 */
function woodGame(job: Job): void {
  const n = fixCount('wood', job.opts.phase);
  const droop = [0, 7, 14, 26][Math.max(1, Math.min(3, job.opts.phase))];
  const wood = job.opts.white && !job.opts.color ? '#f7f4ec' : job.color, edge = shade(wood, 0.78), post = shade(wood, 0.88);
  // de spijkers: waar hij zit, welke plank hij optilt (en hoeveel graden die nu hangt) en hoe ver hij er al in zit
  const nails = [
    { x: 274, y: 89, plank: 'top', hang: droop, depth: 0 },
    { x: 274, y: 145, plank: '', hang: 0, depth: 0 },
    { x: 46, y: 89, plank: '', hang: 0, depth: 1 / FIX.wood.hits },
  ].slice(0, n);
  // kapot: ook de onderste plank hangt los, aan de andere kant
  if (n >= 3) Object.assign(nails[1], { x: 46, y: 145, plank: 'low', hang: -10 });
  const plank = (id: string, y: number): string =>
    `<g class="fx-plank" data-plank="${id}"><rect x="26" y="${y - 11}" width="268" height="22" rx="5" fill="${wood}" stroke="${edge}" stroke-width="3"/>` +
    `<path d="M70 ${y - 3} h60 M150 ${y + 4} h44 M214 ${y - 2} h36" stroke="${edge}" stroke-width="2" stroke-linecap="round" opacity=".55"/></g>`;
  const pole = (x: number): string =>
    `<path d="M${x - 12} 196 V62 L${x} 48 L${x + 12} 62 V196Z" fill="${post}" stroke="${edge}" stroke-width="3" stroke-linejoin="round"/>`;
  // de spijkers die er al in zitten (op de plekken waar niet getimmerd hoeft te worden)
  const fixed = [[46, 89], [274, 89], [46, 145], [274, 145]].filter(([x, y]) => !nails.some(k => k.x === x && k.y === y));
  draw(
    job,
    GRASS + pole(46) + pole(274) + plank('low', 145) + plank('top', 89) +
      fixed.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="5" fill="#8a8f98" stroke="#3a2a1a" stroke-width="2"/>`).join('') +
      nails.map((_, i) => `<g class="fx-nail" data-i="${i}"><circle class="fx-ring" r="20"/><path class="fx-shaft" stroke="#8a8f98" stroke-width="6" stroke-linecap="round"/><ellipse class="fx-head" rx="9" ry="6.5" fill="#c8cdd4" stroke="#3a2a1a" stroke-width="2.5"/></g>`).join(''),
  );
  const hammer = tool(job, 'hammer', 'fx-hammer');
  /** De kop van een spijker: hij steekt schuin naar linksboven uit het hout; hoe verder erin, hoe korter. */
  const head = (k: { x: number; y: number; depth: number }): [number, number] => [k.x - 28 * (1 - k.depth) * 0.45, k.y - 28 * (1 - k.depth) * 0.9];
  /** Tekent de spijkers en de planken zoals ze er nu bij hangen. */
  const show = (): void => {
    for (const [i, k] of nails.entries()) {
      const [hx, hy] = head(k);
      const g = q(job, `.fx-nail[data-i="${i}"]`);
      g.classList.toggle('in', k.depth >= 1);
      g.querySelector('.fx-ring')!.setAttribute('cx', String(k.x - 4));
      g.querySelector('.fx-ring')!.setAttribute('cy', String(k.y - 8));
      g.querySelector('.fx-shaft')!.setAttribute('d', `M${k.x} ${k.y} L${hx.toFixed(1)} ${hy.toFixed(1)}`);
      g.querySelector('.fx-head')!.setAttribute('transform', `translate(${hx.toFixed(1)} ${hy.toFixed(1)}) rotate(-26)`);
      if (!k.plank) continue;
      // de plank draait om de spijker aan de andere kant, en hangt minder naarmate deze spijker er verder in zit
      const board = q(job, `.fx-plank[data-plank="${k.plank}"]`);
      board.style.transformOrigin = `${k.x > 160 ? 46 : 274}px ${k.y}px`;
      board.style.transform = `rotate(${(k.hang * (1 - k.depth)).toFixed(1)}deg)`;
    }
  };
  show();
  let busy = false;
  track(job.scene, {
    down: p => {
      if (busy) return;
      const open = nails.map(k => ({ k, d: near(p, k.x - 6, k.y - 12) })).filter(o => o.k.depth < 1).sort((a, b) => a.d - b.d)[0];
      if (!open) return;
      // naast alle spijkers: een tikje op het hout, verder niets
      if (open.d > 64) {
        hammer.to(p);
        hammer.el.classList.remove('hit');
        void hammer.el.offsetWidth;
        hammer.el.classList.add('hit');
        return sfx('tap', { volume: 0.5 });
      }
      const k = open.k;
      hammer.to(toPoint(...head(k)));
      hammer.el.classList.remove('hit');
      void hammer.el.offsetWidth;
      hammer.el.classList.add('hit');
      k.depth = hammerIn(k.depth);
      // de klap valt als de hamer beneden is
      job.card.later(110, () => {
        sfx('fence', { volume: 0.9, rate: 0.9 + k.depth * 0.3 });
        show();
        job.scene.classList.remove('thud');
        void job.scene.offsetWidth;
        job.scene.classList.add('thud');
        if (k.depth < 1) return;
        burst(job.scene, toPoint(k.x, k.y), ['sparkle'], 4);
        const left = nails.filter(m => m.depth < 1);
        showSteps(job, nails.map(() => 'nail'), nails.length - left.length);
        if (left.length) return job.card.hint(job.scene, 'tap', toPoint(left[0].x - 8, left[0].y - 16));
        busy = true;
        job.card.later(350, () => {
          hammer.el.classList.remove('on');
          finale(job, nails.map(() => 'nail'));
        });
      });
    },
  });
  showSteps(job, nails.map(() => 'nail'), 0);
  job.card.title(t('fix.wood.how'));
  job.card.hint(job.scene, 'tap', toPoint(nails[0].x - 8, nails[0].y - 16));
}

// ------------------------------------------------------------ steen: metselen
/**
 * Een stenen muur waar een paar stenen uit gevallen zijn; ze liggen ervoor op de grond. Eerst leg je ze terug: tik op
 * een steen (hij vliegt naar een gat) of sleep hem zelf naar een gat. Liggen ze er allemaal in, dan smeer je met de
 * troffel de voegen dicht: veeg of tik op elke teruggelegde steen.
 */
function stoneGame(job: Job): void {
  const n = fixCount('stone', job.opts.phase);
  const bw = 54, bh = 32, gap = 4, x0 = 22, y0 = 42;
  const stone = job.color, edge = shade(stone, 0.7), mortar = '#e9e5db';
  // de muur: vier rijen stenen in halfsteens verband; in de oneven rijen staat aan elk eind een halve steen
  const bricks: { x: number; y: number; w: number; row: number }[] = [];
  for (let row = 0; row < 4; row++) {
    const y = y0 + row * (bh + gap);
    if (row % 2 === 0) for (let c = 0; c < 5; c++) bricks.push({ x: x0 + c * (bw + gap), y, w: bw, row });
    else {
      const half = (bw - gap) / 2;
      bricks.push({ x: x0, y, w: half, row });
      for (let c = 0; c < 4; c++) bricks.push({ x: x0 + half + gap + c * (bw + gap), y, w: bw, row });
      bricks.push({ x: x0 + half + gap + 4 * (bw + gap), y, w: half, row });
    }
  }
  // de gaten: hele stenen, niet aan de rand, en niet twee naast elkaar in dezelfde rij
  const holes: typeof bricks = [];
  for (const b of shuffle(bricks.filter(b => b.w === bw && b.x > x0 + 10 && b.x + b.w < x0 + 5 * (bw + gap) - 14 && b.row < 3))) {
    if (holes.length < n && !holes.some(h => h.row === b.row && Math.abs(h.x - b.x) < bw * 1.5)) holes.push(b);
  }
  const tone = (i: number): string => shade(stone, [1, 0.93, 1.12, 0.97, 1.06][i % 5]);
  const rect = (b: { x: number; y: number; w: number }, fill: string): string => `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${bh}" rx="5" fill="${fill}" stroke="${edge}" stroke-width="2.5"/>`;
  // de losse stenen liggen op het gras, elk een beetje scheef: één in het midden, of verdeeld van links naar rechts
  const loose = holes.map((_, i) => ({ hole: -1, x: holes.length === 1 ? 160 : 70 + (i * 180) / (holes.length - 1), y: 190, turn: [-9, 7, -5][i % 3], tone: tone(i + 2), mortar: 0 }));
  draw(
    job,
    GRASS + `<rect x="${x0 - 6}" y="${y0 - 6}" width="${5 * (bw + gap) + 8}" height="${4 * (bh + gap) + 8}" rx="9" fill="${mortar}"/>` +
      bricks.map((b, i) => (holes.includes(b) ? `<rect class="fx-hole" x="${b.x}" y="${b.y}" width="${b.w}" height="${bh}" rx="5"/>` : rect(b, tone(i)))).join('') +
      loose.map((s, i) => `<g class="fx-brick" data-i="${i}">${rect({ x: -bw / 2, y: -bh / 2, w: bw }, s.tone)}<rect class="fx-gapline" x="${-bw / 2 - 2}" y="${-bh / 2 - 2}" width="${bw + 4}" height="${bh + 4}" rx="6"/><rect class="fx-joint" x="${-bw / 2 - 2}" y="${-bh / 2 - 2}" width="${bw + 4}" height="${bh + 4}" rx="6" pathLength="100"/></g>`).join(''),
  );
  const place = (i: number, x: number, y: number, turn: number): void => {
    q(job, `.fx-brick[data-i="${i}"]`).style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) rotate(${turn}deg)`;
  };
  loose.forEach((s, i) => place(i, s.x, s.y, s.turn));
  const center = (h: { x: number; y: number; w: number }): [number, number] => [h.x + h.w / 2, h.y + bh / 2];
  const trowel = tool(job, 'trowel', 'fx-trowel');
  let held = -1, from: Point | null = null, laying = true, last: Point | null = null, busy = false;
  /** Legt steen `i` in gat `k`. Is het de laatste, dan komt de troffel. */
  const lay = (i: number, k: number): void => {
    const s = loose[i], [cx, cy] = center(holes[k]);
    s.hole = k;
    q(job, `.fx-brick[data-i="${i}"]`).classList.add('laid');
    place(i, cx, cy, 0);
    sfx('stone', { volume: 0.9 });
    if (loose.some(o => o.hole < 0)) return hintLay();
    laying = false;
    showSteps(job, STEPS.stone, 1);
    job.card.later(350, () => {
      job.card.title(t('fix.stone.how2'));
      job.scene.classList.add('smear');
      const [x, y] = center(holes[loose[0].hole]);
      job.card.hint(job.scene, 'rub', toPoint(x - 24, y), toPoint(x + 24, y));
    });
  };
  const free = (): number => holes.findIndex((_, k) => !loose.some(s => s.hole === k));
  function hintLay(): void {
    const i = loose.findIndex(s => s.hole < 0), k = free();
    if (i < 0 || k < 0) return;
    const [cx, cy] = center(holes[k]);
    job.card.hint(job.scene, 'drag', toPoint(loose[i].x, loose[i].y), toPoint(cx, cy));
  }
  /** Smeert een stukje voeg om de stenen onder de troffel. */
  const smear = (p: Point, amount: number): void => {
    for (const [i, s] of loose.entries()) {
      if (s.mortar >= 1) continue;
      const [cx, cy] = center(holes[s.hole]);
      if (Math.abs(p.x * W - cx) > bw / 2 + 16 || Math.abs(p.y * H - cy) > bh / 2 + 16) continue;
      s.mortar = Math.min(1, s.mortar + amount);
      const g = q(job, `.fx-brick[data-i="${i}"]`);
      g.style.setProperty('--mortar', s.mortar.toFixed(2));
      if (s.mortar < 1) continue;
      g.classList.add('done');
      burst(job.scene, toPoint(cx, cy), ['sparkle'], 4);
      sfx('place', { volume: 0.6 });
      if (loose.some(o => o.mortar < 1)) continue;
      busy = true;
      job.card.later(300, () => {
        trowel.el.classList.remove('on');
        finale(job, STEPS.stone);
      });
    }
  };
  track(job.scene, {
    down: p => {
      if (busy) return;
      if (!laying) {
        last = p;
        trowel.to(p);
        // een los tikje smeert ook: drie tikjes en de voeg is dicht
        return smear(p, 0.34);
      }
      // de dichtstbijzijnde steen die nog op de grond ligt
      const pick = loose.map((s, i) => ({ i, s, d: near(p, s.x, s.y) })).filter(o => o.s.hole < 0).sort((a, b) => a.d - b.d)[0];
      if (!pick || pick.d > 70) return;
      held = pick.i;
      from = p;
      q(job, `.fx-brick[data-i="${held}"]`).classList.add('held');
    },
    move: (p, pressed) => {
      if (!pressed || busy) return;
      if (!laying) {
        if (!last) return;
        trowel.to(p);
        smear(p, Math.hypot((p.x - last.x) * W, (p.y - last.y) * H) / 70);
        last = p;
        return void sfx('paint', { volume: 0.3, every: 0.3 });
      }
      if (held >= 0) place(held, p.x * W, p.y * H, 0);
    },
    up: p => {
      last = null;
      if (held < 0 || !from) return;
      const i = held, s = loose[i];
      held = -1;
      q(job, `.fx-brick[data-i="${i}"]`).classList.remove('held');
      // een tik (niet gesleept): de steen vliegt naar het eerste lege gat; gesleept: naar het gat waar je hem loslaat
      const tapped = Math.hypot((p.x - from.x) * W, (p.y - from.y) * H) < 12;
      const target = tapped ? free() : holes.map((h, k) => ({ k, d: near(p, ...center(h)) })).filter(o => !loose.some(m => m.hole === o.k) && o.d < 60).sort((a, b) => a.d - b.d)[0]?.k ?? -1;
      if (target >= 0) return lay(i, target);
      // naast de muur losgelaten: de steen valt terug op het gras
      place(i, s.x, s.y, s.turn);
      sfx('tap', { volume: 0.5 });
    },
  });
  showSteps(job, STEPS.stone, 0);
  job.card.title(t('fix.stone.how'));
  hintLay();
}

// ------------------------------------------------------------ net: strak trekken en knopen
/**
 * Een net tussen twee palen dat in het midden doorhangt, met een paar geknapte draden. Eerst trek je het strak: sleep
 * de ring in het midden van de bovenrand omhoog (of tik een paar keer: bij elke tik gaat hij een stuk omhoog). Daarna
 * knoop je de losse eindjes vast: tik op elke plek waar een draad geknapt is.
 */
function netGame(job: Job): void {
  const n = fixCount('net', job.opts.phase);
  const net = job.color, rope = shade(net, 0.75);
  const left = 34, right = 286, top = 46, bottom = 188, span = right - left;
  const start = [0, 30, 48, 70][Math.max(1, Math.min(3, job.opts.phase))];
  // de dwarsdraden: hoe hoog ze hangen als het net strak is, en hoeveel ze meezakken
  const rows = [{ y: 84, f: 0.7 }, { y: 120, f: 0.45 }, { y: 156, f: 0.2 }];
  const cols = [1, 2, 3, 4, 5].map(k => left + (k * span) / 6);
  /** Hoe ver een draad op plek x doorhangt, als het midden `sag` zakt. */
  const dip = (x: number, sag: number): number => {
    const u = (x - left) / span;
    return sag * 4 * u * (1 - u);
  };
  // de geknapte draden: op een kruispunt van een dwarsdraad en een staande draad
  const tears = shuffle([[0, 1], [1, 3], [0, 3], [1, 1], [2, 2]]).slice(0, n).map(([r, c]) => ({ r, c, tied: false }));
  let sag = 1, tight = false, busy = false;
  draw(
    job,
    GRASS + `<rect x="${left - 9}" y="${top - 16}" width="18" height="${bottom - top + 24}" rx="6" fill="${rope}"/><rect x="${right - 9}" y="${top - 16}" width="18" height="${bottom - top + 24}" rx="6" fill="${rope}"/>` +
      `<path class="fx-net" fill="none" stroke="${net}" stroke-width="3.5" stroke-linecap="round"/><path class="fx-rope" fill="none" stroke="${rope}" stroke-width="8" stroke-linecap="round"/>` +
      `<path d="M${left} ${bottom} H${right}" stroke="${rope}" stroke-width="7" stroke-linecap="round"/>` +
      tears.map((_, i) => `<g class="fx-tear" data-i="${i}"><circle class="fx-ring" r="20"/><g class="fx-knot"><circle r="9" fill="${net}" stroke="${rope}" stroke-width="3"/><path d="M-5 -2 Q0 3 5 -2" fill="none" stroke="${rope}" stroke-width="2.5" stroke-linecap="round"/></g></g>`).join('') +
      `<g class="fx-pull"><circle r="15" fill="#ffd95a" stroke="#d9a520" stroke-width="4"/><path d="M-6 3 L0 -5 L6 3" fill="none" stroke="#3a2a1a" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></g>`,
  );
  /** Tekent het net zoals het nu hangt. */
  const show = (): void => {
    const s = sag * start;
    q(job, '.fx-rope').setAttribute('d', `M${left} ${top} Q${(left + right) / 2} ${top + s * 2} ${right} ${top}`);
    let d = '';
    for (const x of cols) d += `M${x} ${(top + dip(x, s)).toFixed(1)} V${bottom}`;
    rows.forEach((row, r) => {
      // een dwarsdraad loopt in stukjes van staande draad naar staande draad; op een geknapte plek hangen de eindjes los
      const xs = [left, ...cols, right];
      for (let k = 0; k + 1 < xs.length; k++) {
        const a = xs[k], b = xs[k + 1], ya = row.y + dip(a, s) * row.f, yb = row.y + dip(b, s) * row.f;
        const tornA = tears.some(tr => !tr.tied && tr.r === r && cols[tr.c] === a), tornB = tears.some(tr => !tr.tied && tr.r === r && cols[tr.c] === b);
        const ax = tornA ? a + 13 : a, bx = tornB ? b - 13 : b;
        d += `M${ax} ${(tornA ? ya + 11 : ya).toFixed(1)} L${bx} ${(tornB ? yb + 11 : yb).toFixed(1)}`;
      }
    });
    q(job, '.fx-net').setAttribute('d', d);
    q(job, '.fx-pull').setAttribute('transform', `translate(${(left + right) / 2} ${(top + s).toFixed(1)})`);
    tears.forEach((tr, i) => q(job, `.fx-tear[data-i="${i}"]`).setAttribute('transform', `translate(${cols[tr.c]} ${(rows[tr.r].y + dip(cols[tr.c], s) * rows[tr.r].f).toFixed(1)})`));
  };
  show();
  /** Het net is strak: de ring gaat weg en de knopen zijn aan de beurt. */
  const tighten = (): void => {
    if (sag > 0 || tight) return;
    tight = true;
    show();
    sfx('net', { volume: 0.9 });
    job.scene.classList.add('tight');
    showSteps(job, STEPS.net, 1);
    job.card.later(350, () => {
      job.card.title(t('fix.net.how2'));
      job.card.hint(job.scene, 'tap', toPoint(cols[tears[0].c], rows[tears[0].r].y));
    });
  };
  let dragged = false, from: Point | null = null;
  track(job.scene, {
    down: p => {
      from = p;
      dragged = false;
      if (busy || !tight) return;
      // de dichtstbijzijnde geknapte draad
      const pick = tears.map((tr, i) => ({ tr, i, d: near(p, cols[tr.c], rows[tr.r].y) })).filter(o => !o.tr.tied).sort((a, b) => a.d - b.d)[0];
      if (!pick || pick.d > 56) return;
      pick.tr.tied = true;
      q(job, `.fx-tear[data-i="${pick.i}"]`).classList.add('tied');
      show();
      sfx('net', { volume: 0.7, rate: 1.2 });
      burst(job.scene, toPoint(cols[pick.tr.c], rows[pick.tr.r].y), ['sparkle'], 4);
      const open = tears.filter(tr => !tr.tied);
      if (open.length) return job.card.hint(job.scene, 'tap', toPoint(cols[open[0].c], rows[open[0].r].y));
      busy = true;
      job.card.later(350, () => finale(job, STEPS.net));
    },
    move: (p, pressed) => {
      if (!pressed || tight || !from) return;
      if (Math.hypot((p.x - from.x) * W, (p.y - from.y) * H) > 8) dragged = true;
      if (!dragged) return;
      // de ring volgt de vinger omhoog; terugzakken doet het net niet
      const before = sag;
      sag = pullUp(sag, (p.y * H - top) / start);
      if (sag < before) sfx('net', { volume: 0.3, every: 0.25 });
      show();
      tighten();
    },
    up: () => {
      // een los tikje: het net gaat een stuk omhoog
      if (!tight && !dragged && from) {
        sag = pullUp(sag);
        sfx('net', { volume: 0.5 });
        show();
        tighten();
      }
      from = null;
    },
  });
  showSteps(job, STEPS.net, 0);
  job.card.title(t('fix.net.how'));
  job.card.hint(job.scene, 'drag', toPoint((left + right) / 2, top + start), toPoint((left + right) / 2, top));
}

// ------------------------------------------------------------ glas: lijmen en schoonvegen
/**
 * Een ruit in een lijst, met een barst van boven naar beneden (bij een bak staat er water achter en zwemt er een vis).
 * Eerst lijm je de barst dicht: ga er met de lijm overheen (slepen), of tik op elk stuk. Daarna liggen er nog een paar
 * vlekken lijm op het glas: veeg ze weg met het doekje. Dan glimt de ruit weer.
 */
function glassGame(job: Job): void {
  const n = fixCount('glass', job.opts.phase), spots = smudgeCount(job.opts.phase);
  const frame = job.color, edge = shade(frame, 0.72);
  // de barst: een zigzag van de bovenrand naar beneden, met net zoveel stukken als er te lijmen zijn
  const x = 150 + rnd(50), points: [number, number][] = [[x, 36]];
  for (let i = 1; i <= n; i++) points.push([x + (i % 2 ? -1 : 1) * (18 + rnd(16)) + (i - n / 2) * 6, 36 + (i * 140) / n]);
  const parts = points.slice(1).map((p, i) => ({ a: points[i], b: p, sealed: false }));
  // de vlekken: naast de barst, om en om links en rechts
  const smudges = Array.from({ length: spots }, (_, i) => ({ x: x + (i % 2 ? 62 : -66) + rnd(14), y: spots === 1 ? 110 : 70 + (i * 90) / (spots - 1), dirt: 1 }));
  draw(
    job,
    GRASS + `<rect x="22" y="22" width="276" height="176" rx="12" fill="${frame}" stroke="${edge}" stroke-width="3"/><rect x="36" y="36" width="248" height="148" rx="6" fill="#d8f0fb"/>` +
      (job.opts.tank ? '<path class="fx-water" d="M36 66 q16 -8 31 0 t31 0 t31 0 t31 0 t31 0 t31 0 t31 0 t31 0 V184 H36Z" fill="#8fd0ee"/><g class="fx-fish" transform="translate(70 128)"><path d="M0 0 Q14 -12 30 0 Q14 12 0 0Z M30 0 L42 -9 V9Z" fill="#f08a24"/><circle cx="9" cy="-2" r="2" fill="#3a2a1a"/></g>' : '') +
      '<path d="M52 150 L96 52 M74 160 L104 92" stroke="#fff" stroke-width="7" stroke-linecap="round" opacity=".6"/>' +
      parts.map((s, i) => `<g class="fx-part" data-i="${i}"><path class="fx-crack" d="M${s.a[0]} ${s.a[1]} L${s.b[0]} ${s.b[1]}"/><path class="fx-glue" d="M${s.a[0]} ${s.a[1]} L${s.b[0]} ${s.b[1]}"/><circle class="fx-ring" cx="${(s.a[0] + s.b[0]) / 2}" cy="${(s.a[1] + s.b[1]) / 2}" r="15"/></g>`).join('') +
      (job.opts.tank ? parts.filter((_, i) => i % 2 === 0).map(s => `<path class="fx-drip" d="M${s.b[0]} ${s.b[1]} v14" />`).join('') : '') +
      smudges.map((s, i) => `<ellipse class="fx-smudge" data-i="${i}" cx="${s.x}" cy="${s.y}" rx="19" ry="13" transform="rotate(${i * 50 - 20} ${s.x} ${s.y})"/>`).join('') +
      '<clipPath id="fx-pane"><rect x="36" y="36" width="248" height="148" rx="6"/></clipPath><g clip-path="url(#fx-pane)"><path class="fx-shine" d="M-60 190 L0 30 H44 L-16 190Z" fill="#fff"/></g>',
  );
  const glue = tool(job, 'glue', 'fx-glue-tool'), cloth = tool(job, 'cloth', 'fx-cloth');
  let wiping = false, busy = false, last: Point | null = null;
  /** Lijmt de stukken barst vlak bij de vinger dicht. */
  const seal = (p: Point): void => {
    for (const [i, s] of parts.entries()) {
      if (s.sealed || near(p, (s.a[0] + s.b[0]) / 2, (s.a[1] + s.b[1]) / 2) > 34) continue;
      s.sealed = true;
      q(job, `.fx-part[data-i="${i}"]`).classList.add('sealed');
      sfx('place', { volume: 0.5, rate: 1.2 + i * 0.05, every: 0.02 });
    }
    const open = parts.filter(s => !s.sealed);
    if (open.length) return job.card.hint(job.scene, 'drag', toPoint(...open[0].a), toPoint(...open[0].b));
    if (wiping) return;
    // de barst is dicht: nu het doekje
    wiping = true;
    last = null;
    for (const drip of all(job, '.fx-drip')) drip.classList.add('dry');
    showSteps(job, STEPS.glass, 1);
    job.card.hint();
    job.card.later(350, () => {
      glue.el.classList.remove('on');
      job.scene.classList.add('wipe');
      job.card.title(t('fix.glass.how2'));
      job.card.hint(job.scene, 'rub', toPoint(smudges[0].x - 22, smudges[0].y), toPoint(smudges[0].x + 22, smudges[0].y));
    });
  };
  /** Veegt de vlekken onder het doekje een stukje weg. */
  const wipe = (p: Point, amount: number): void => {
    for (const [i, s] of smudges.entries()) {
      if (s.dirt <= 0 || near(p, s.x, s.y) > 36) continue;
      s.dirt = Math.max(0, s.dirt - amount);
      const el = q(job, `.fx-smudge[data-i="${i}"]`);
      el.style.setProperty('--dirt', s.dirt.toFixed(2));
      if (s.dirt > 0) continue;
      el.classList.add('clean');
      burst(job.scene, toPoint(s.x, s.y), ['sparkle'], 4);
      sfx('place', { volume: 0.5, rate: 1.4 });
      if (smudges.some(o => o.dirt > 0)) continue;
      busy = true;
      job.card.later(300, () => {
        cloth.el.classList.remove('on');
        finale(job, STEPS.glass);
      });
    }
  };
  track(job.scene, {
    down: p => {
      if (busy) return;
      last = p;
      if (!wiping) {
        glue.to(p);
        return seal(p);
      }
      if (!job.scene.classList.contains('wipe')) return;
      cloth.to(p);
      // drie losse tikjes op een vlek vegen hem ook weg
      wipe(p, 0.34);
    },
    move: (p, pressed) => {
      if (!pressed || busy || !last) return;
      if (!wiping) {
        glue.to(p);
        return seal(p);
      }
      if (!job.scene.classList.contains('wipe')) return;
      cloth.to(p);
      wipe(p, Math.hypot((p.x - last.x) * W, (p.y - last.y) * H) / 60);
      last = p;
      sfx('paint', { volume: 0.3, every: 0.3 });
    },
    up: () => {
      last = null;
    },
  });
  showSteps(job, STEPS.glass, 0);
  job.card.title(t('fix.glass.how'));
  job.card.hint(job.scene, 'drag', toPoint(...parts[0].a), toPoint(...parts[0].b));
}

const GAMES: Record<Mend, (job: Job) => void> = { wood: woodGame, stone: stoneGame, net: netGame, glass: glassGame };

// ------------------------------------------------------------ voor het spel
/** Opent het spelletje om een hek te maken over het spel heen. Staat er al een kaart open, dan gaat die eerst dicht. */
export function playFix(opts: FixOptions): void {
  const card = openCard({ kind: 'fix', label: t('fix.title'), picture: icon(MEND_ICON[opts.mend]), say: opts.say, onClose: opts.onDone });
  card.stage.innerHTML = '<div class="fx-scene"></div>';
  const job: Job = { card, opts, scene: card.stage.querySelector<HTMLElement>('.fx-scene')!, svg: null as unknown as SVGSVGElement, color: opts.color ?? COLOR[opts.mend] };
  job.scene.addEventListener('animationend', e => {
    if (e.target === job.scene) job.scene.classList.remove('thud');
  });
  GAMES[opts.mend](job);
}
