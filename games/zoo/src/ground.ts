// De grond van het park: voor elke soort ondergrond een getekend plaatje (gras met pollen, water met golfjes,
// klinkers, kiezels ...) en het vlak met alle tegels waar die plaatjes op liggen.
// De plaatjes worden hier zelf getekend, met vaste 'toevallige' getallen: ze zijn dus elke keer hetzelfde. Een
// plaatje wordt pas gemaakt als de soort grond voor het eerst in het park ligt.
import * as THREE from 'three';
import { SEASONAL, TERRAINS, TERRAIN_INFO, type Season, type Terrain } from './data';
import { H, W, type Land } from './grid';

/** Eén plaatje ligt over zoveel tegels (in beide richtingen): zo is niet elke tegel hetzelfde. */
export const GROUND_SPAN = 4;
/** Zo groot is een plaatje (in puntjes), en zoveel puntjes is één tegel. */
const S = 512;
const T = S / GROUND_SPAN;
const TAU = Math.PI * 2;

/**
 * De brug ligt over water: daar ligt dus gewoon het plaatje van water onder. Het spoor ligt in het gras en een
 * overweg is een stuk pad; de bedding, de bielzen en de rails zelf tekent het beeld (zie View.buildRails).
 */
type Drawn = Exclude<Terrain, 'bridge' | 'rails' | 'crossing' | 'seatunnel'>;
type Surface = Drawn | 'around';
const surfaceOf = (kind: Terrain): Drawn => (kind === 'bridge' || kind === 'seatunnel' ? 'water' : kind === 'rails' ? 'grass' : kind === 'crossing' ? 'path' : kind);

// ------------------------------------------------------------ kleine hulpjes
/** Vaste 'toevallige' getallen van 0 tot 1: met hetzelfde begin komt er altijd hetzelfde rijtje uit. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const css = (c: number): string => `#${c.toString(16).padStart(6, '0')}`;
/** De kleur tussen a en b: t = 0 is a, t = 1 is b. */
function mix(a: number, b: number, t: number): number {
  const ch = (s: number): number => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}
const lighter = (c: number, t: number): number => mix(c, 0xffffff, t);
const darker = (c: number, t: number): number => mix(c, 0x000000, t);

/**
 * De kwast: tekent vormen op het plaatje. Wat over de rand valt, komt er aan de andere kant weer in, zodat het
 * plaatje naadloos naast zichzelf past.
 */
class Pen {
  private ox = 0;
  private oy = 0;

  constructor(private c: CanvasRenderingContext2D, readonly rnd: () => number) {
    c.lineCap = 'round';
    c.lineJoin = 'round';
  }

  /** Een toevallig getal tussen a en b. */
  r(a: number, b: number): number {
    return a + this.rnd() * (b - a);
  }

  pick<V>(list: V[]): V {
    return list[Math.floor(this.rnd() * list.length) % list.length];
  }

  /** Het hele plaatje in één kleur (of een waas van die kleur eroverheen). */
  fill(color: number, alpha = 1): void {
    this.c.globalAlpha = alpha;
    this.c.fillStyle = css(color);
    this.c.fillRect(0, 0, S, S);
  }

  /** Tekent iets (dat binnen het gegeven vak past) op elke plek waar het in beeld valt. */
  private tile(x0: number, y0: number, x1: number, y1: number, draw: () => void): void {
    const sx = -Math.floor((x0 + x1) / 2 / S) * S, sy = -Math.floor((y0 + y1) / 2 / S) * S;
    for (let dx = -S; dx <= S; dx += S) {
      if (x1 + sx + dx < 0 || x0 + sx + dx > S) continue;
      for (let dy = -S; dy <= S; dy += S) {
        if (y1 + sy + dy < 0 || y0 + sy + dy > S) continue;
        this.ox = sx + dx;
        this.oy = sy + dy;
        draw();
      }
    }
  }

  /** Een ovaal vlekje: `rx` bij `ry` groot, `rot` gedraaid. */
  blob(x: number, y: number, rx: number, ry: number, rot: number, color: number, alpha = 1): void {
    const c = this.c, r = Math.max(rx, ry);
    c.globalAlpha = alpha;
    c.fillStyle = css(color);
    this.tile(x - r, y - r, x + r, y + r, () => {
      c.beginPath();
      c.ellipse(x + this.ox, y + this.oy, rx, ry, rot, 0, TAU);
      c.fill();
    });
  }

  dot(x: number, y: number, r: number, color: number, alpha = 1): void {
    this.blob(x, y, r, r, 0, color, alpha);
  }

  /** Een lijn door de punten (x, y, x, y, ...), met ronde uiteinden. */
  line(pts: number[], width: number, color: number, alpha = 1): void {
    const c = this.c;
    let x0 = pts[0], x1 = pts[0], y0 = pts[1], y1 = pts[1];
    for (let i = 2; i < pts.length; i += 2) {
      x0 = Math.min(x0, pts[i]);
      x1 = Math.max(x1, pts[i]);
      y0 = Math.min(y0, pts[i + 1]);
      y1 = Math.max(y1, pts[i + 1]);
    }
    c.globalAlpha = alpha;
    c.strokeStyle = css(color);
    c.lineWidth = width;
    this.tile(x0 - width, y0 - width, x1 + width, y1 + width, () => {
      c.beginPath();
      c.moveTo(pts[0] + this.ox, pts[1] + this.oy);
      for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i] + this.ox, pts[i + 1] + this.oy);
      c.stroke();
    });
  }

  /** Een dichte vorm door de punten (x, y, x, y, ...); de hoeken zijn `rad` puntjes afgerond. */
  shape(pts: number[], rad: number, color: number, alpha = 1): void {
    const c = this.c, n = pts.length / 2;
    let x0 = pts[0], x1 = pts[0], y0 = pts[1], y1 = pts[1];
    for (let i = 2; i < pts.length; i += 2) {
      x0 = Math.min(x0, pts[i]);
      x1 = Math.max(x1, pts[i]);
      y0 = Math.min(y0, pts[i + 1]);
      y1 = Math.max(y1, pts[i + 1]);
    }
    // per hoek: het punt vlak ervoor en vlak erna, daartussen loopt de bocht
    const near = (i: number, j: number): [number, number] => {
      const dx = pts[j * 2] - pts[i * 2], dy = pts[j * 2 + 1] - pts[i * 2 + 1], d = Math.hypot(dx, dy) || 1, k = Math.min(rad, d / 2) / d;
      return [pts[i * 2] + dx * k, pts[i * 2 + 1] + dy * k];
    };
    c.globalAlpha = alpha;
    c.fillStyle = css(color);
    this.tile(x0, y0, x1, y1, () => {
      const ox = this.ox, oy = this.oy;
      c.beginPath();
      for (let i = 0; i < n; i++) {
        const [ax, ay] = near(i, (i + n - 1) % n), [bx, by] = near(i, (i + 1) % n);
        if (i === 0) c.moveTo(ax + ox, ay + oy);
        else c.lineTo(ax + ox, ay + oy);
        c.quadraticCurveTo(pts[i * 2] + ox, pts[i * 2 + 1] + oy, bx + ox, by + oy);
      }
      c.closePath();
      c.fill();
    });
  }

  /** Een rechthoek met afgeronde hoeken. */
  box(x: number, y: number, w: number, h: number, rad: number, color: number, alpha = 1): void {
    this.shape([x, y, x + w, y, x + w, y + h, x, y + h], rad, color, alpha);
  }
}

/** Netjes verdeeld over het hele plaatje: één plek in elk vakje van een raster van n bij n. */
function scatter(p: Pen, n: number, put: (x: number, y: number) => void): void {
  const d = S / n;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) put((i + p.rnd()) * d, (j + p.rnd()) * d);
}

/** Grote zachte vlekken in net een andere tint, zodat de grond niet overal even egaal is. */
function mottle(p: Pen, colors: number[], n: number, rMin: number, rMax: number, alpha: number): void {
  for (let i = 0; i < n; i++) {
    const x = p.r(0, S), y = p.r(0, S), r = p.r(rMin, rMax), flat = p.r(0.55, 1), rot = p.r(0, Math.PI), color = p.pick(colors);
    // vier lagen over elkaar, steeds kleiner: zo loopt de rand zacht weg
    for (let k = 0; k < 4; k++) p.blob(x, y, r * (1 - k * 0.2), r * flat * (1 - k * 0.2), rot, color, alpha / 2);
  }
}

/** Een pol van bovenaf: een paar sprieten die als een waaier uit één punt komen. */
function tuft(p: Pen, x: number, y: number, size: number, color: number, blades: number, alpha = 1): void {
  const dir = p.r(0, TAU), gap = p.r(0.3, 0.5), mid = (blades - 1) / 2;
  for (let b = 0; b < blades; b++) {
    // de middelste spriet is het langst; de buitenste buigen een beetje naar buiten
    const a = dir + (b - mid) * gap, len = size * p.r(0.7, 1) * (1 - Math.abs(b - mid) * 0.14), bend = (b - mid) * 0.16 + p.r(-0.2, 0.2);
    p.line([x, y, x + Math.cos(a) * len * 0.55, y + Math.sin(a) * len * 0.55, x + Math.cos(a + bend) * len, y + Math.sin(a + bend) * len], size * 0.17, color, alpha);
  }
}

/** Losse korte sprietjes tussen de pollen. */
function sprigs(p: Pen, n: number, colors: number[], alpha: number): void {
  for (let i = 0; i < n; i++) {
    const x = p.r(0, S), y = p.r(0, S), a = p.r(0, TAU), len = p.r(3.5, 6.5);
    p.line([x, y, x + Math.cos(a) * len, y + Math.sin(a) * len], 1.6, p.pick(colors), alpha);
  }
}

/** Een bloemetje: vijf blaadjes om een hartje. */
function flower(p: Pen, x: number, y: number, r: number, petal: number, heart: number): void {
  const turn = p.r(0, TAU);
  for (let k = 0; k < 5; k++) p.dot(x + Math.cos(turn + k * 1.2566) * r, y + Math.sin(turn + k * 1.2566) * r, r * 0.68, petal);
  p.dot(x, y, r * 0.6, heart);
}

/** Een steentje met een schaduwrandje eronder en een lichtje erop. */
function pebble(p: Pen, x: number, y: number, rx: number, ry: number, color: number): void {
  const rot = p.r(0, Math.PI);
  p.blob(x + 1, y + 1.3, rx, ry, rot, darker(color, 0.3), 0.7);
  p.blob(x, y, rx, ry, rot, color);
  p.dot(x - rx * 0.3, y - ry * 0.35, Math.min(rx, ry) * 0.3, lighter(color, 0.5), 0.6);
}

/** Heel kleine spikkels, overal. */
function speckle(p: Pen, n: number, colors: number[], rMin: number, rMax: number, alpha: number): void {
  for (let i = 0; i < n; i++) p.dot(p.r(0, S), p.r(0, S), p.r(rMin, rMax), p.pick(colors), alpha);
}

/** Houdt van de veelhoek het stuk over dat aan de goede kant ligt van de lijn door (mx, my) dwars op (dx, dy). */
function clip(poly: number[], mx: number, my: number, dx: number, dy: number): number[] {
  const out: number[] = [];
  for (let k = 0; k < poly.length; k += 2) {
    const ax = poly[k], ay = poly[k + 1], bx = poly[(k + 2) % poly.length], by = poly[(k + 3) % poly.length];
    const da = (ax - mx) * dx + (ay - my) * dy, db = (bx - mx) * dx + (by - my) * dy;
    if (da <= 0) out.push(ax, ay);
    if ((da < 0 && db > 0) || (da > 0 && db < 0)) {
      const t = da / (da - db);
      out.push(ax + (bx - ax) * t, ay + (by - ay) * t);
    }
  }
  return out;
}

/**
 * Grillige vakken die precies tegen elkaar aan liggen (zoals keien of platen rots), `n` per kant. Aan de randen
 * lopen ze door in de vakken van de overkant. `jitter`: 0 = een strak raster, 1 = heel grillig.
 */
function cells(rnd: () => number, n: number, jitter: number): { x: number; y: number; pts: number[] }[] {
  const size = S / n, px: number[] = [], py: number[] = [];
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      px.push((i + 0.5 + (rnd() - 0.5) * jitter) * size);
      py.push((j + 0.5 + (rnd() - 0.5) * jitter) * size);
    }
  const out: { x: number; y: number; pts: number[] }[] = [];
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      const x = px[i + j * n], y = py[i + j * n], far = size * 2;
      // begin met een ruim vierkant en snijd er bij elke buur de helft naar die buur toe af
      let pts = [x - far, y - far, x + far, y - far, x + far, y + far, x - far, y + far];
      for (let dj = -2; dj <= 2; dj++)
        for (let di = -2; di <= 2; di++) {
          if (!di && !dj) continue;
          const ii = (i + di + n * 2) % n, jj = (j + dj + n * 2) % n;
          const nx = px[ii + jj * n] + (i + di - ii) * size, ny = py[ii + jj * n] + (j + dj - jj) * size;
          pts = clip(pts, (x + nx) / 2, (y + ny) / 2, nx - x, ny - y);
        }
      out.push({ x, y, pts });
    }
  return out;
}

/** Dezelfde vorm, kleiner (om het punt x, y) en een stukje verschoven. */
const shrink = (pts: number[], x: number, y: number, k: number, dx = 0, dy = 0): number[] =>
  pts.map((v, i) => (i % 2 ? y + (v - y) * k + dy : x + (v - x) * k + dx));

/** Een kronkelende lijn: begint bij (x, y) en loopt in `steps` stukjes ongeveer de kant `dir` op. */
function wander(p: Pen, x: number, y: number, dir: number, steps: number, stepMin: number, stepMax: number, wobble: number): number[] {
  const pts = [x, y];
  for (let i = 0; i < steps; i++) {
    dir += p.r(-wobble, wobble);
    const d = p.r(stepMin, stepMax);
    x += Math.cos(dir) * d;
    y += Math.sin(dir) * d;
    pts.push(x, y);
  }
  return pts;
}

// ------------------------------------------------------------ de plaatjes zelf
const FLOWERS: [number, number][] = [[0xf7a8cc, 0xffe07a], [0xffffff, 0xffd84d], [0xffd84d, 0xf2a93b], [0xc9b0f2, 0xfff1a8], [0xf48a7a, 0xffe07a]];

/** Gras: zachte vlekken, pollen in donker en licht groen, en hier en daar klaver of een bloemetje. */
function grassLike(p: Pen, base: number, tufts: number, dark: number, light: number): void {
  p.fill(base);
  mottle(p, [lighter(base, 0.12), darker(base, 0.08), mix(base, 0xd9e36a, 0.2)], 46, 26, 62, 0.22);
  sprigs(p, 420, [dark, light], 0.55);
  scatter(p, tufts, (x, y) => tuft(p, x, y, p.r(8, 13), p.rnd() < 0.6 ? dark : light, 3 + Math.floor(p.rnd() * 3)));
}

const PAINT: Record<Surface, (p: Pen, base: number) => void> = {
  grass(p, base) {
    grassLike(p, base, 18, darker(mix(base, 0x3f9a4a, 0.4), 0.06), mix(base, 0xd6f08a, 0.55));
    // klaver: drie ronde blaadjes
    for (let i = 0; i < 12; i++) {
      const x = p.r(0, S), y = p.r(0, S), turn = p.r(0, TAU);
      for (let k = 0; k < 3; k++) p.dot(x + Math.cos(turn + k * 2.094) * 2.7, y + Math.sin(turn + k * 2.094) * 2.7, 2.5, 0x4f9f4a);
    }
    for (let i = 0; i < 9; i++) flower(p, p.r(0, S), p.r(0, S), 2.6, 0xffffff, 0xffd84d);
    for (let i = 0; i < 5; i++) flower(p, p.r(0, S), p.r(0, S), 2.3, 0xffe36a, 0xf2a93b);
  },

  /** Bosgrond: donker, met mos, gevallen blad en takjes. */
  forest(p, base) {
    p.fill(base);
    mottle(p, [darker(base, 0.16), mix(base, 0x7fae4a, 0.4), darker(base, 0.08)], 50, 24, 58, 0.24);
    // plukjes mos
    scatter(p, 7, (x, y) => {
      for (let k = 0, n = 4 + Math.floor(p.rnd() * 5); k < n; k++) p.dot(x + p.r(-11, 11), y + p.r(-11, 11), p.r(2.5, 5.5), 0x84b651, 0.5);
    });
    scatter(p, 12, (x, y) => tuft(p, x, y, p.r(8, 12), darker(base, 0.2), 3 + Math.floor(p.rnd() * 3)));
    // takjes en gevallen blad
    for (let i = 0; i < 34; i++) {
      const x = p.r(0, S), y = p.r(0, S), a = p.r(0, TAU), len = p.r(9, 17);
      p.line([x, y, x + Math.cos(a) * len, y + Math.sin(a) * len], 1.7, 0x5f4426, 0.85);
    }
    scatter(p, 15, (x, y) => p.blob(x, y, p.r(3.6, 5.6), p.r(1.9, 2.7), p.r(0, Math.PI), p.pick([0x9a6b35, 0xb5843f, 0x7a5a30, 0xc99443, 0x8f4f2c]), 0.9));
  },

  /** Bloemenwei: gras met heel veel kleine bloemen. */
  meadow(p) {
    const base = TERRAIN_INFO.meadow.colors[0];
    grassLike(p, base, 14, darker(mix(base, 0x3f9a4a, 0.4), 0.05), mix(base, 0xd6f08a, 0.55));
    scatter(p, 15, (x, y) => {
      if (p.rnd() < 0.2) return;
      const [petal, heart] = p.pick(FLOWERS);
      flower(p, x, y, p.r(2.4, 3.4), petal, heart);
    });
  },

  /** Steppe: droog geel gras, met kale plekken zand. */
  steppe(p, base) {
    p.fill(base);
    mottle(p, [lighter(base, 0.16), mix(base, 0xc2a25a, 0.5), mix(base, 0xe9da94, 0.6)], 46, 26, 62, 0.24);
    speckle(p, 260, [0xb9a252, 0xe9dc9c], 0.8, 1.4, 0.7);
    sprigs(p, 380, [0xb49d4a, 0xeadd9c], 0.6);
    scatter(p, 16, (x, y) => {
      const sort = p.rnd();
      tuft(p, x, y, p.r(9, 14), sort < 0.5 ? 0xb09a47 : sort < 0.88 ? 0xece09f : 0x9aa655, 4 + Math.floor(p.rnd() * 2));
    });
    for (let i = 0; i < 12; i++) pebble(p, p.r(0, S), p.r(0, S), p.r(2.4, 4), p.r(2, 3), p.pick([0xb7a98c, 0xc9c1b0, 0x9c8f78]));
  },

  /** Moeras: donker nat groen, met plassen, kroos en riet. */
  swamp(p, base) {
    p.fill(base);
    mottle(p, [darker(base, 0.14), mix(base, 0x6f8f4a, 0.45), mix(base, 0x4a6a5a, 0.5)], 46, 24, 58, 0.24);
    scatter(p, 13, (x, y) => tuft(p, x, y, p.r(8, 12), p.rnd() < 0.6 ? darker(base, 0.22) : 0x86a65a, 3 + Math.floor(p.rnd() * 3)));
    // plassen: een paar ovalen over elkaar, met een lichter midden, een glimlichtje en kroos
    scatter(p, 4, (x, y) => {
      if (p.rnd() < 0.15) return;
      const r = p.r(16, 27), rot = p.r(0, Math.PI);
      const ex = x + Math.cos(rot) * r * 0.6, ey = y + Math.sin(rot) * r * 0.6;
      p.blob(x, y, r + 2, r * 0.72 + 2, rot, darker(base, 0.25));
      p.blob(ex, ey, r * 0.75 + 2, r * 0.55 + 2, rot + 0.6, darker(base, 0.25));
      p.blob(x, y, r, r * 0.72, rot, 0x3f6f6c);
      p.blob(ex, ey, r * 0.75, r * 0.55, rot + 0.6, 0x3f6f6c);
      p.blob(x - 1, y - 1, r * 0.6, r * 0.4, rot, 0x518683, 0.7);
      p.line([x - r * 0.45, y - r * 0.2, x - r * 0.15, y - r * 0.36, x + r * 0.2, y - r * 0.3], 1.8, 0xcfe8e0, 0.5);
      for (let k = 0, n = 5 + Math.floor(p.rnd() * 6); k < n; k++) {
        const a = p.r(0, TAU), d = p.r(0.2, 0.85) * r * 0.7;
        p.dot(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.7, p.r(1.3, 2), 0x9fd15c);
      }
    });
    // riet: lichte sprieten met bruine sigaren
    scatter(p, 8, (x, y) => {
      if (p.rnd() < 0.45) return;
      tuft(p, x, y, p.r(9, 12), 0x9bb866, 4);
      for (let k = 0; k < 3; k++) p.blob(x + p.r(-5, 5), y + p.r(-5, 5), 1.9, 3.3, p.r(0, Math.PI), 0x6b4a2a);
    });
  },

  /** Water: blauw, met donkere en lichte golfjes en hier en daar een glinstering. */
  water(p, base) {
    p.fill(base);
    mottle(p, [0x58aedb, 0x80cff0, 0x61b4e0], 30, 40, 90, 0.22);
    scatter(p, 9, (x, y) => {
      const len = p.r(22, 40), high = p.r(2.2, 3.6), pts: number[] = [], under: number[] = [];
      for (let k = 0; k <= 8; k++) {
        const wx = x + (k / 8 - 0.5) * len, wy = y - Math.sin((k / 8) * Math.PI) * high + Math.sin((k / 8) * TAU) * 1.2;
        pts.push(wx, wy);
        under.push(wx, wy + 3.2);
      }
      p.line(under, 2.6, 0x4a9bd0, 0.4);
      p.line(pts, 2.4, 0xe4f6ff, 0.75);
    });
    for (let i = 0; i < 46; i++) p.dot(p.r(0, S), p.r(0, S), p.r(1.2, 2), 0xffffff, 0.75);
  },

  /** IJs: lichtblauw, met barsten en glans. */
  ice(p, base) {
    p.fill(base);
    mottle(p, [0xe8f6fd, 0xb2d8ee, 0xdaf0fa], 32, 40, 90, 0.3);
    // plukjes sneeuw op het ijs
    mottle(p, [0xffffff], 22, 6, 13, 0.6);
    // barsten: een donker lijntje met een wit randje ernaast, soms met een zijtak
    for (let i = 0; i < 13; i++) {
      const crack = wander(p, p.r(0, S), p.r(0, S), p.r(0, TAU), 3 + Math.floor(p.rnd() * 4), 13, 26, 0.6);
      const twigs = [crack];
      if (p.rnd() < 0.6) {
        const k = 2 * (1 + Math.floor(p.rnd() * (crack.length / 2 - 2)));
        twigs.push(wander(p, crack[k], crack[k + 1], p.r(0, TAU), 2, 10, 18, 0.5));
      }
      for (const pts of twigs) {
        p.line(pts.map(v => v + 1.4), 1.3, 0xffffff, 0.8);
        p.line(pts, 1.6, 0x84b9d6, 0.9);
      }
    }
    // glans: een paar schuine witte streepjes naast elkaar
    for (let i = 0; i < 15; i++) {
      const x = p.r(0, S), y = p.r(0, S);
      [[0, 17], [7, 11], [13, 6]].forEach(([shift, len]) => p.line([x + shift, y, x + shift + len * 0.7, y - len * 0.7], 2.6, 0xffffff, 0.7));
    }
  },

  /** Sneeuw: wit, met zachte blauwe schaduwen en glinsters. */
  snow(p) {
    p.fill(0xf3f7fc);
    mottle(p, [0xd3e2f4, 0xdce8f6, 0xffffff, 0xffffff], 44, 26, 64, 0.5);
    // ruggetjes van opgewaaide sneeuw: een blauw boogje met een wit randje erlangs
    for (let i = 0; i < 18; i++) {
      const ridge = wander(p, p.r(0, S), p.r(0, S), p.r(0, TAU), 5, 7, 12, 0.3);
      p.line(ridge, 2.8, 0xc3d7ef, 0.5);
      p.line(ridge.map((v, k) => v - (k % 2 ? 2.2 : 1.2)), 2.4, 0xffffff, 0.9);
    }
    for (let i = 0; i < 46; i++) {
      const x = p.r(0, S), y = p.r(0, S), d = p.r(2, 3.2);
      p.line([x - d, y, x + d, y], 1.2, 0xa5c9ee, 0.9);
      p.line([x, y - d, x, y + d], 1.2, 0xa5c9ee, 0.9);
    }
    speckle(p, 130, [0xb7d4f1, 0xc9def4], 0.9, 1.4, 0.9);
  },

  /** Modder: bruin, met natte plekken en afdrukken van hoeven. */
  mud(p, base) {
    p.fill(base);
    mottle(p, [0xab7a50, darker(base, 0.12), 0x8a5a36], 46, 24, 58, 0.26);
    speckle(p, 220, [darker(base, 0.2), lighter(base, 0.14)], 0.9, 1.6, 0.6);
    // natte plekken: donker en glimmend
    scatter(p, 3, (x, y) => {
      const r = p.r(20, 32), rot = p.r(0, Math.PI), ex = x + Math.cos(rot) * r * 0.6, ey = y + Math.sin(rot) * r * 0.6;
      p.blob(x, y, r, r * 0.6, rot, 0x7c5031, 0.55);
      p.blob(ex, ey, r * 0.7, r * 0.46, rot + 0.5, 0x7c5031, 0.55);
      p.blob(x, y, r * 0.72, r * 0.4, rot, 0x8b6a52, 0.6);
      p.line([x - r * 0.42, y - r * 0.14, x - r * 0.12, y - r * 0.24, x + r * 0.22, y - r * 0.18], 2.2, 0xe6cdb2, 0.7);
      p.line([x + r * 0.05, y + r * 0.12, x + r * 0.3, y + r * 0.1], 1.6, 0xe6cdb2, 0.5);
    });
    // hoefafdrukken: twee teentjes naast elkaar, een paar achter elkaar
    for (let i = 0; i < 11; i++) {
      const a = p.r(0, TAU), ca = Math.cos(a), sa = Math.sin(a);
      let x = p.r(0, S), y = p.r(0, S);
      for (let k = 0, n = 2 + Math.floor(p.rnd() * 2); k < n; k++) {
        const side = k % 2 ? 3.5 : -3.5, hx = x - sa * side, hy = y + ca * side;
        for (const toe of [-2.5, 2.5]) {
          const tx = hx - sa * toe, ty = hy + ca * toe;
          p.blob(tx + 1.1, ty + 1.2, 2.3, 4.3, a + Math.PI / 2, 0xb98a62, 0.6);
          p.blob(tx, ty, 2.3, 4.3, a + Math.PI / 2, 0x6a4124, 0.9);
        }
        x += ca * p.r(15, 19);
        y += sa * p.r(15, 19);
      }
    }
    for (let i = 0; i < 12; i++) pebble(p, p.r(0, S), p.r(0, S), p.r(2.2, 3.6), p.r(1.8, 2.8), p.pick([0xa48868, 0xb9a488, 0x8a6f52]));
  },

  /** Zand: warm geel, met ribbels van de wind, spikkels, schelpen en steentjes. */
  sand(p, base) {
    p.fill(base);
    mottle(p, [lighter(base, 0.14), 0xdfc278, 0xf2dfa2], 38, 30, 70, 0.22);
    speckle(p, 360, [0xcfb268, 0xf8ebbd], 0.8, 1.3, 0.75);
    // ribbels: golvende lijntjes, elk een stuk lang
    for (let row = 0; row < 18; row++) {
      const y0 = (row + p.r(0.2, 0.8)) * (S / 18), waves = 2 + Math.floor(p.rnd() * 2), phase = p.r(0, TAU);
      for (let part = 0; part < 2; part++) {
        const from = p.r(0, S), len = p.r(110, 220), dark: number[] = [], light: number[] = [];
        for (let x = from; x <= from + len; x += 10) {
          const y = y0 + Math.sin((x / S) * TAU * waves + phase) * 3.4 + part * 4;
          dark.push(x, y);
          light.push(x, y - 2.5);
        }
        p.line(light, 1.9, 0xf9ecbc, 0.7);
        p.line(dark, 2.1, 0xd3b76c, 0.65);
      }
    }
    for (let i = 0; i < 13; i++) pebble(p, p.r(0, S), p.r(0, S), p.r(2.4, 3.8), p.r(2, 3), p.pick([0xb7a58c, 0xc9c1b4, 0x9c8f7c, 0xd8cdbb]));
    // schelpen: een wit waaiertje met roze streepjes
    for (let i = 0; i < 8; i++) {
      const x = p.r(0, S), y = p.r(0, S), a = p.r(0, TAU);
      p.blob(x + 0.8, y + 1, 4.6, 3.9, a, 0xc9a965, 0.7);
      p.blob(x, y, 4.6, 3.9, a, 0xfff6ec);
      for (const turn of [-0.6, 0, 0.6]) p.line([x - Math.cos(a) * 3, y - Math.sin(a) * 3, x + Math.cos(a + turn) * 3.2, y + Math.sin(a + turn) * 3.2], 0.9, 0xf0b39c, 0.9);
    }
  },

  /** Rotsgrond: grote grijze platen met barsten en een beetje korstmos. */
  stones(p, base) {
    p.fill(0x6c727a);
    for (const cell of cells(p.rnd, 5, 0.85)) {
      const color = mix(base, p.pick([0xa9afb6, 0x8c9299, 0x9b9fa3, 0xa5a299, 0x8f98a6]), 0.8);
      p.shape(shrink(cell.pts, cell.x, cell.y, 0.955, 1.4, 1.6), 7, darker(color, 0.18));
      p.shape(shrink(cell.pts, cell.x, cell.y, 0.955, -0.6, -0.6), 7, color);
      p.blob(cell.x + p.r(-10, 10), cell.y + p.r(-10, 10), p.r(16, 26), p.r(10, 18), p.r(0, Math.PI), lighter(color, 0.3), 0.22);
      for (let k = 0; k < 7; k++) p.dot(cell.x + p.r(-30, 30), cell.y + p.r(-30, 30), p.r(1.2, 2.6), k % 2 ? lighter(color, 0.25) : darker(color, 0.2), 0.45);
      if (p.rnd() < 0.6) p.line(wander(p, cell.x + p.r(-18, 18), cell.y + p.r(-18, 18), p.r(0, TAU), 3, 8, 15, 0.7), 1.4, 0x6c727a, 0.7);
    }
    for (let i = 0; i < 9; i++) {
      const x = p.r(0, S), y = p.r(0, S);
      for (let k = 0; k < 6; k++) p.dot(x + p.r(-7, 7), y + p.r(-7, 7), p.r(1.6, 3.4), 0xbcc78c, 0.5);
    }
  },

  /** Het gewone pad: aangestampt zand met steentjes. */
  path(p, base) {
    p.fill(base);
    mottle(p, [lighter(base, 0.1), darker(base, 0.07), 0xc8b28f], 42, 26, 60, 0.24);
    speckle(p, 520, [0xb9a685, 0xeadec6, 0xa99679], 0.8, 1.5, 0.8);
    scatter(p, 11, (x, y) => {
      if (p.rnd() < 0.15) return;
      pebble(p, x, y, p.r(2.2, 4.2), p.r(1.8, 3.2), p.pick([0xb3a58f, 0xe6dcc8, 0x9f9484, 0xc7b79c, 0xd9d2c4]));
    });
  },

  /** Kiezelpad: alles ligt vol met kleine grijze en witte kiezels. */
  gravel(p) {
    p.fill(0xb2ada3);
    scatter(p, 54, (x, y) => pebble(p, x, y, p.r(3.2, 5.8), p.r(2.6, 4.4), p.pick([0xd9d5cd, 0xc9c5bd, 0xe2dfd9, 0xbfbbb3, 0xc6c0b5, 0xd4c8b6, 0xe6e3dd, 0xc6cace])));
  },

  /** Plankenpad: houten planken met naden, nerven, een kwast hier en daar en spijkers aan de uiteinden. */
  planks(p, base) {
    p.fill(0x76522f);
    const wide = T / 4, rows = S / wide;
    for (let row = 0; row < rows; row++) {
      const y = row * wide, first = p.r(0, S), second = first + p.r(190, 320);
      for (const [x0, x1] of [[first, second], [second, first + S]]) {
        const color = mix(base, p.pick([0xc79a63, 0xb98a55, 0xd0a670, 0xb08050, 0xc4925a]), 0.9);
        p.box(x0 + 1, y + 1.2, x1 - x0 - 2, wide - 2.4, 2.5, color);
        p.line([x0 + 4, y + 3, x1 - 4, y + 3], 1.3, lighter(color, 0.3), 0.55);
        p.line([x0 + 4, y + wide - 3, x1 - 4, y + wide - 3], 1.3, darker(color, 0.2), 0.45);
        // nerven: lange lijntjes die een beetje golven
        for (let k = 0, n = 3 + Math.floor(p.rnd() * 2); k < n; k++) {
          const gy = y + 6 + ((k + p.r(0.2, 0.8)) * (wide - 12)) / n, from = x0 + p.r(5, 40), to = x1 - p.r(5, 40), grain: number[] = [];
          for (let x = from; x <= to; x += 14) grain.push(x, gy + p.r(-1, 1));
          if (grain.length >= 4) p.line(grain, 1.1, darker(color, 0.2), 0.5);
        }
        if (p.rnd() < 0.35) {
          const kx = p.r(x0 + 20, x1 - 20), ky = y + p.r(9, wide - 9);
          p.blob(kx, ky, 4.4, 2.8, 0, darker(color, 0.3), 0.9);
          p.blob(kx, ky, 2, 1.2, 0, darker(color, 0.45), 0.9);
        }
        for (const nx of [x0 + 6, x1 - 6])
          for (const ny of [y + 8, y + wide - 8]) {
            p.dot(nx, ny, 1.8, 0x5a4636);
            p.dot(nx - 0.5, ny - 0.5, 0.7, 0xdcd3c4, 0.85);
          }
      }
    }
  },

  /** Bloemenpad: licht zand met kleine steentjes en gevallen bloemblaadjes. */
  flowerpath(p, base) {
    p.fill(base);
    mottle(p, [lighter(base, 0.14), darker(base, 0.06), 0xdcc7a2], 40, 26, 60, 0.24);
    speckle(p, 380, [0xcbb692, 0xf3e8d3], 0.8, 1.4, 0.8);
    scatter(p, 8, (x, y) => pebble(p, x, y, p.r(2, 3.4), p.r(1.7, 2.6), p.pick([0xc9bba2, 0xefe6d5, 0xb8aa92])));
    for (let i = 0; i < 64; i++) p.blob(p.r(0, S), p.r(0, S), 2.6, 1.6, p.r(0, Math.PI), p.pick([0xf7a8cc, 0xffffff, 0xffd84d, 0xc9b0f2, 0xf48a7a]), 0.95);
  },

  /** Klinkers: rode stenen in visgraat. */
  brick(p, base) {
    p.fill(0x8a5846);
    const u = T / 8, n = S / u;
    for (let j = 0; j < n; j++)
      for (let i = 0; i < n; i++) {
        const turn = (((i - j) % 4) + 4) % 4;
        if (turn !== 0 && turn !== 3) continue;
        // 0: een liggende steen van twee vakjes breed; 3: een staande van twee vakjes hoog
        const x = i * u + 1, y = j * u + 1, w = (turn === 0 ? 2 : 1) * u - 2, h = (turn === 0 ? 1 : 2) * u - 2;
        const color = mix(base, p.pick([0xc9795a, 0xb9694b, 0xd28a6c, 0xb25f49, 0xc47458, 0xa85a4c, 0xbf6a4e]), 0.85);
        p.box(x, y, w, h, 2.4, color);
        p.line([x + 2.5, y + 1.6, x + w - 2.5, y + 1.6], 1.2, lighter(color, 0.35), 0.5);
        p.line([x + 2.5, y + h - 1.4, x + w - 2.5, y + h - 1.4], 1.2, darker(color, 0.25), 0.45);
        if (p.rnd() < 0.5) p.dot(x + p.r(3, w - 3), y + p.r(3, h - 3), p.r(0.8, 1.4), darker(color, 0.25), 0.5);
      }
  },

  /** Keien: ronde grijze stenen dicht tegen elkaar. */
  cobble(p, base) {
    p.fill(0x646a72);
    for (const cell of cells(p.rnd, 26, 0.55)) {
      const color = mix(base, p.pick([0xa7aeb6, 0x969da5, 0x8b9199, 0xb5babf, 0x9f9c95, 0x8790a0]), 0.85);
      p.shape(shrink(cell.pts, cell.x, cell.y, 0.84, 0.9, 1.1), 9, darker(color, 0.22));
      p.shape(shrink(cell.pts, cell.x, cell.y, 0.84, -0.3, -0.3), 9, color);
      p.blob(cell.x - 1.8, cell.y - 2.2, 4, 2.6, -0.6, lighter(color, 0.4), 0.5);
    }
  },

  /** Marmer: witte platen met grijze aders. */
  marble(p) {
    const slab = T / 2, n = S / slab;
    p.fill(0xeef1f4);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) p.box(i * slab, j * slab, slab, slab, 0, (i + j) % 2 ? 0xf5f7f9 : 0xeff2f5);
    mottle(p, [0xffffff, 0xe1e7ec], 26, 28, 66, 0.26);
    // aders: een brede lichte baan met een dun grijs lijntje erin, soms met een zijtak
    for (let i = 0; i < 10; i++) {
      const vein = wander(p, p.r(0, S), p.r(0, S), p.r(0, TAU), 6 + Math.floor(p.rnd() * 6), 13, 22, 0.45);
      p.line(vein, 6.5, 0xcfd6dd, 0.45);
      p.line(vein, 1.4, 0xaab4bf, 0.8);
      if (p.rnd() < 0.5) {
        const k = 2 * (1 + Math.floor(p.rnd() * (vein.length / 2 - 2)));
        p.line(wander(p, vein[k], vein[k + 1], p.r(0, TAU), 4, 10, 18, 0.5), 1.1, 0xb1bbc5, 0.8);
      }
    }
    // de voegen tussen de platen
    for (let k = 0; k < n; k++) {
      p.line([0, k * slab, S, k * slab], 1.8, 0xbfc7cf);
      p.line([k * slab, 0, k * slab, S], 1.8, 0xbfc7cf);
    }
  },

  /**
   * Het land buiten het park: alleen licht en donker, zonder eigen kleur. Het materiaal kleurt het in de kleur
   * van de wereld en het seizoen.
   */
  around(p) {
    p.fill(0xf4f4f4);
    mottle(p, [0xffffff, 0xdcdcdc, 0xe6e6e6], 46, 26, 62, 0.3);
    scatter(p, 18, (x, y) => tuft(p, x, y, p.r(8, 13), p.rnd() < 0.6 ? 0xc6c6c6 : 0xffffff, 3 + Math.floor(p.rnd() * 3)));
  },
};
const SURFACES = Object.keys(PAINT) as Surface[];

/** Hoe het seizoen over gras, bos, wei en steppe heen kleurt: de kleur en hoe sterk. De zomer is het plaatje zelf. */
const SEASON_TINT: Record<Season, [number, number]> = {
  spring: [0x92dc5e, 0.22],
  summer: [0xffffff, 0],
  autumn: [0xd9b84a, 0.45],
  winter: [0xf4f8fc, 0.82],
};

function paint(canvas: HTMLCanvasElement, kind: Surface, season: Season): boolean {
  const ctx = canvas.getContext('2d');
  if (!ctx) return false;
  const p = new Pen(ctx, seeded(1234 + SURFACES.indexOf(kind) * 977));
  const colors = kind === 'around' ? [0xffffff, 0xffffff] : TERRAIN_INFO[kind].colors;
  PAINT[kind](p, mix(colors[0], colors[1], 0.5));
  const [tint, strength] = SEASON_TINT[season];
  if (strength > 0) p.fill(tint, strength);
  if (season === 'winter') {
    // rijp en sneeuw: zachte witte plekken, berijpte pollen en een paar glinsters
    mottle(p, [0xffffff, 0xffffff, 0xdce8f6], 34, 20, 46, 0.36);
    sprigs(p, 260, [0xffffff, 0xcbdcee], 0.75);
    scatter(p, 15, (x, y) => tuft(p, x, y, p.r(8, 12), p.rnd() < 0.7 ? 0xffffff : 0xcbdcee, 3 + Math.floor(p.rnd() * 3), 0.9));
    speckle(p, 90, [0xb7d4f1], 0.9, 1.4, 0.8);
  }
  ctx.globalAlpha = 1;
  return true;
}

interface Made {
  canvas: HTMLCanvasElement;
  tex: THREE.CanvasTexture;
  season: Season;
}
const made = new Map<Surface, Made>();

function texture(kind: Surface, season: Season, sharp: number): THREE.Texture | null {
  let m = made.get(kind);
  if (m) {
    // een nieuw seizoen: hetzelfde plaatje opnieuw getekend, met de kleur van het seizoen eroverheen
    if (m.season !== season && paint(m.canvas, kind, season)) {
      m.season = season;
      m.tex.needsUpdate = true;
    }
    return m.tex;
  }
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = S;
  if (!paint(canvas, kind, season)) return null;
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.max(1, Math.min(4, sharp));
  m = { canvas, tex, season };
  made.set(kind, m);
  return tex;
}

/**
 * Het plaatje van een soort grond. Gras, bos, wei en steppe kleuren mee met het seizoen; de rest is het hele
 * jaar hetzelfde. `sharp`: hoe scherp het plaatje schuin van boven mag blijven (zie de mogelijkheden van het beeld).
 * Geeft niets terug als er niet getekend kan worden: dan blijft de grond een effen kleur.
 */
export function groundTexture(kind: Terrain, season: Season = 'summer', sharp = 1): THREE.Texture | null {
  const surface = surfaceOf(kind);
  return texture(surface, SEASONAL.includes(surface) ? season : 'summer', sharp);
}

/**
 * Het plaatje voor het land rond het park: een vlak van `size` bij `size`. Het heeft zelf geen kleur; die komt
 * van het materiaal (de wereld en het seizoen).
 */
export function aroundTexture(size: number, sharp = 1): THREE.Texture | null {
  const tex = texture('around', 'summer', sharp);
  tex?.repeat.set(size / GROUND_SPAN, size / GROUND_SPAN);
  return tex;
}

// ------------------------------------------------------------ het vlak met alle tegels
/** Een tegel zonder grond (in het lijstje dat `paint` krijgt): daar zit een gat in het vlak. */
export const GROUND_HOLE = 255;
/** Welk materiaal bij een soort grond hoort (het nummer in TERRAINS): de brug deelt dat van water. */
const SLOT = TERRAINS.map(kind => TERRAINS.indexOf(surfaceOf(kind)));

/**
 * Alle tegels van het park als één vlak. Elke soort grond is een eigen stuk van dat vlak met zijn eigen plaatje;
 * de plaatjes lopen over de tegels heen door, zodat je geen ruitjes ziet. Tegels buiten het park doen niet mee.
 */
export class Ground {
  readonly mesh: THREE.Mesh;
  private geo = new THREE.BufferGeometry();
  /** De driehoeken van alle tegels, op soort grond gesorteerd. */
  private order = new Uint16Array(W * H * 6);
  private mats = TERRAINS.map(() => new THREE.MeshStandardMaterial({ roughness: 1 }));
  private land: Land = { x0: 0, y0: 0, x1: W, y1: H };
  private terrain: ArrayLike<number> | null = null;
  private season: Season = 'summer';
  private water: THREE.Texture | null = null;
  private flowX = 0;
  private flowY = 0;

  constructor(private sharp = 1) {
    // de hoekpunten van het raster; de plek in het plaatje volgt de plek in de wereld
    const n = (W + 1) * (H + 1), pos = new Float32Array(n * 3), normal = new Float32Array(n * 3), uv = new Float32Array(n * 2);
    for (let y = 0; y <= H; y++)
      for (let x = 0; x <= W; x++) {
        const i = x + y * (W + 1);
        pos[i * 3] = x - W / 2;
        pos[i * 3 + 2] = y - H / 2;
        normal[i * 3 + 1] = 1;
        uv[i * 2] = x / GROUND_SPAN;
        uv[i * 2 + 1] = y / GROUND_SPAN;
      }
    this.geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.geo.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
    this.geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    this.geo.setIndex(new THREE.BufferAttribute(this.order, 1));
    this.mesh = new THREE.Mesh(this.geo, this.mats);
    this.mesh.receiveShadow = true;
    this.rebuild();
  }

  /** Welk stuk van het raster van het park is: alleen die tegels worden getekend. */
  setLand(land: Land): void {
    this.land = land;
    this.rebuild();
  }

  /** De ondergrond van elke tegel (zie Grid.terrain) en het seizoen van nu. */
  paint(terrain: ArrayLike<number>, season: Season): void {
    this.terrain = terrain;
    this.season = season;
    this.rebuild();
  }

  /** Elk beeldje: het water stroomt heel rustig (alleen het plaatje schuift, er wordt niets opnieuw getekend). */
  update(dt: number): void {
    if (!this.water) return;
    this.flowX = (this.flowX + dt * 0.016) % 1;
    this.flowY = (this.flowY + dt * 0.009) % 1;
    this.water.offset.set(this.flowX, this.flowY);
  }

  /** Zet de tegels op soort bij elkaar: per soort grond één stuk met zijn eigen materiaal. */
  private rebuild(): void {
    const { x0, y0, x1, y1 } = this.land, terrain = this.terrain;
    // (GROUND_HOLE: hier ligt geen grond, je kijkt in de verzonken tunnel)
    const slot = (x: number, y: number): number => (terrain ? (terrain[x + y * W] === GROUND_HOLE ? -1 : SLOT[terrain[x + y * W]] ?? 0) : 0);
    const count = new Int32Array(TERRAINS.length), next = new Int32Array(TERRAINS.length);
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (slot(x, y) >= 0) count[slot(x, y)]++;
    this.geo.clearGroups();
    let at = 0;
    for (let k = 0; k < count.length; k++) {
      if (!count[k]) continue;
      this.geo.addGroup(at, count[k] * 6, k);
      this.dress(k);
      next[k] = at;
      at += count[k] * 6;
    }
    const order = this.order, row = W + 1;
    for (let y = y0; y < y1; y++)
      for (let x = x0; x < x1; x++) {
        const k = slot(x, y);
        if (k < 0) continue;
        const o = next[k], a = x + y * row, c = a + row;
        order[o] = a;
        order[o + 1] = c;
        order[o + 2] = a + 1;
        order[o + 3] = a + 1;
        order[o + 4] = c;
        order[o + 5] = c + 1;
        next[k] = o + 6;
      }
    this.geo.index!.needsUpdate = true;
  }

  /** Geeft het materiaal van een soort grond zijn plaatje, in het seizoen van nu. */
  private dress(k: number): void {
    const kind = TERRAINS[k], mat = this.mats[k], tex = groundTexture(kind, this.season, this.sharp);
    if (kind === 'water') this.water = tex;
    if (mat.map === tex && tex) return;
    mat.map = tex;
    // zonder plaatje: de effen kleur van vroeger
    mat.color.setHex(tex ? 0xffffff : TERRAIN_INFO[kind].colors[0]);
    mat.needsUpdate = true;
  }
}
