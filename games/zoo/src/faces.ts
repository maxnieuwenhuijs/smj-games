// De gezichtjes van de poppetjes (gasten, kinderen, werkers, verkopers en de mensen op de weg).
//
// Elk hoofd krijgt een vlakje op zijn voorkant. Alle gezichten staan samen op één plaat, die bij de start één keer
// getekend wordt: per gezicht een rij, met daarin zeven soorten ogen (open, dicht, lachend, boos, sip, huilend, groot)
// en negen monden (lach, grote lach, streep, sip, huilen, o, kauwen links en rechts, gapen). Het vlakje bestaat uit
// twee stukken (ogen boven, mond onder), en elk stuk kiest zijn eigen vakje op de plaat. Zo kan elk gezicht knipperen
// en kauwen bij elke stemming, en kost het maar één plaat en, voor alle gasten samen, één tekenopdracht.
import * as THREE from 'three';

type Ctx = CanvasRenderingContext2D;

/** De soorten ogen en monden: de kolommen op de plaat. */
export const EYE = { open: 0, shut: 1, glad: 2, cross: 3, sad: 4, cry: 5, wide: 6 };
export const MOUTH = { smile: 0, grin: 1, flat: 2, frown: 3, wail: 4, oh: 5, chewA: 6, chewB: 7, yawn: 8 };
const EYES = 7, MOUTHS = 9, COLS = EYES + MOUTHS;
/** Zoveel verschillende gezichten: eerst de grote mensen, dan de kinderen. */
const ADULTS = 40, KIDS = 24;
export const FACES = ADULTS + KIDS;
/** Eén vakje op de plaat, in beeldpunten, en de rand eromheen die niet getoond wordt (zie paintAtlas). */
const CW = 64, CH = 32, PAD = 2;
/** Waar de naad tussen ogen en mond ligt: het gezicht loopt van -1 (boven) tot 1 (onder). */
const SEAM = 0.25;
/** Het halve hoofd (zie HEAD_GEO in people.ts) en hoe ver het vlakje voor het hoofd zit. */
const HALF = 0.085, OUT = 0.0012;

const INK = '#2a1c16', WHITE = '#ffffff', LIP = '#c23b4a', INSIDE = '#6b1d26', TONGUE = '#f0767a', TEAR = '#58b7ee';
const NOSE = 'rgba(96,48,28,0.62)', BLUSH = 'rgba(240,84,104,0.5)', FRECKLE = 'rgba(140,72,36,0.78)', LENS = 'rgba(235,245,255,0.3)';
const HAIRS = ['#2a1c16', '#5a3a22', '#8d5524', '#9aa0a6', '#d8dce0'];
const FRAMES = ['#2a1c16', '#b8433b', '#2f5d8a', '#e5b520', '#2a1c16'];
const TAU = Math.PI * 2;

// ------------------------------------------------------------ wie hoe eruitziet
/** Eén gezicht: uit welke onderdelen het bestaat. */
interface Traits {
  child: boolean;
  /** Ogen: 0 stip, 1 ovaal, 2 groot en rond met een glimlichtje, 3 slaperig, 4 met wimpers, 5 met oogwit. */
  eye: number;
  /** Hoe groot de ogen zijn, hoe ver ze van het midden staan en hoe hoog. */
  r: number;
  gap: number;
  y: number;
  /** Wenkbrauwen: 0 geen, 1 recht, 2 boogje, 3 dik, 4 dun, 5 schuin en lief. */
  brow: number;
  browCol: string;
  /** Neus: 0 geen, 1 stip, 2 driehoekje, 3 knoopje, 4 boogje. */
  nose: number;
  /** Mond: 0 lach, 1 brede lach, 2 klein lachje, 3 kattenmondje, 4 open met een spleetje, 5 scheef lachje, 6 rode lippen. */
  mouth: number;
  w: number;
  my: number;
  /** Bril: 0 geen, 1 rond, 2 hoekig. */
  glasses: number;
  frame: string;
  tache: boolean;
  /** Baard: 0 geen, 1 sikje, 2 een volle baard langs de kaak. */
  beard: number;
  hair: string;
  cheeks: boolean;
  freckles: boolean;
  mole: boolean;
}

/** Een vaste rij gokgetallen: zo zijn de gezichten elke keer dezelfde. */
function seeded(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Kies een plek uit een rijtje gewichten: hoe zwaarder, hoe vaker. */
function weigh(rnd: () => number, weights: number[]): number {
  let v = rnd() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < weights.length; i++) if ((v -= weights[i]) < 0) return i;
  return weights.length - 1;
}

function roll(rnd: () => number, child: boolean): Traits {
  const eye = weigh(rnd, child ? [2, 3, 4, 1, 2, 3] : [3, 3, 3, 2, 3, 3]);
  const glasses = rnd() < (child ? 0.14 : 0.24) ? 1 + Math.floor(rnd() * 2) : 0;
  const mouth = weigh(rnd, child ? [3, 2, 2, 2, 4, 1, 0] : [4, 2, 2, 1, 0, 2, 3]);
  const hairy = !child && mouth !== 6 && eye !== 4;
  // bij een volle baard hoort een snor
  const beard = hairy && rnd() < 0.2 ? 1 + Math.floor(rnd() * 2) : 0, tache = hairy && (beard === 2 || rnd() < 0.2);
  const hair = HAIRS[Math.floor(rnd() * HAIRS.length)], grey = hair === HAIRS[3] || hair === HAIRS[4];
  return {
    child, eye, glasses, mouth, tache, beard, hair,
    // kinderen hebben wat grotere ogen
    r: (0.142 + rnd() * 0.035) * (child ? 1.22 : 1) * (glasses ? 0.88 : 1),
    gap: 0.35 + rnd() * 0.09,
    y: -0.1 + rnd() * 0.07,
    brow: weigh(rnd, child ? [4, 2, 2, 1, 2, 2] : [2, 3, 3, 2, 2, 2]),
    browCol: !child && grey && (tache || beard || rnd() < 0.5) ? '#7d838a' : rnd() < 0.3 ? '#4a2f1c' : INK,
    nose: weigh(rnd, child ? [2, 3, 1, 3, 1] : [2, 3, 2, 2, 2]),
    w: mouth === 1 ? 0.4 : mouth === 2 ? 0.17 : 0.25 + rnd() * 0.08,
    my: tache ? 0.62 : 0.55 + rnd() * 0.04,
    frame: FRAMES[Math.floor(rnd() * FRAMES.length)],
    cheeks: rnd() < (child ? 0.45 : 0.22),
    freckles: rnd() < (child ? 0.3 : 0.08),
    mole: !child && rnd() < 0.07,
  };
}

/** In hoeveel grote dingen twee gezichten van elkaar verschillen. */
const differ = (a: Traits, b: Traits): number =>
  +(a.eye !== b.eye) + +(a.brow !== b.brow) + +(a.nose !== b.nose) + +(a.mouth !== b.mouth) + +(a.glasses !== b.glasses) +
  +(a.tache !== b.tache || a.beard !== b.beard) + +(a.cheeks !== b.cheeks || a.freckles !== b.freckles);

let traits: Traits[] | null = null;
/** Alle gezichten. Een nieuw gezicht moet in minstens drie dingen anders zijn dan elk gezicht dat er al is. */
function allTraits(): Traits[] {
  if (traits) return traits;
  const rnd = seeded(20261122), list: Traits[] = [];
  for (let id = 0; id < FACES; id++) {
    const child = id >= ADULTS;
    for (let tries = 0; ; tries++) {
      const t = roll(rnd, child), need = tries < 80 ? 3 : 2;
      if (tries > 200 || list.every(o => o.child !== child || differ(o, t) >= need)) {
        list.push(t);
        break;
      }
    }
  }
  return (traits = list);
}

/** De kleur van de baard of snor van gezicht `id`, of null als het er geen heeft: zo krijgt het haar op het hoofd dezelfde kleur. */
export function beardColor(id: number): number | null {
  const f = allTraits()[id];
  return f && (f.tache || f.beard) ? parseInt(f.hair.slice(1), 16) : null;
}

/** Een gezicht voor een nieuw poppetje. */
export const randomFace = (child: boolean): number => (child ? ADULTS + Math.floor(Math.random() * KIDS) : Math.floor(Math.random() * ADULTS));

// ------------------------------------------------------------ tekenen (het gezicht loopt van -1 tot 1, y naar beneden)
const blob = (c: Ctx, x: number, y: number, rx: number, ry = rx): void => {
  c.beginPath();
  c.ellipse(x, y, rx, ry, 0, 0, TAU);
  c.fill();
};
const curve = (c: Ctx, x0: number, y0: number, cx: number, cy: number, x1: number, y1: number): void => {
  c.beginPath();
  c.moveTo(x0, y0);
  c.quadraticCurveTo(cx, cy, x1, y1);
  c.stroke();
};
const line = (c: Ctx, x0: number, y0: number, x1: number, y1: number): void => {
  c.beginPath();
  c.moveTo(x0, y0);
  c.lineTo(x1, y1);
  c.stroke();
};
/** Een rechthoek met ronde hoeken, als pad. */
const box = (c: Ctx, x: number, y: number, w: number, h: number, r: number): void => {
  c.beginPath();
  c.moveTo(x + r, y);
  c.lineTo(x + w - r, y);
  c.quadraticCurveTo(x + w, y, x + w, y + r);
  c.lineTo(x + w, y + h - r);
  c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  c.lineTo(x + r, y + h);
  c.quadraticCurveTo(x, y + h, x, y + h - r);
  c.lineTo(x, y + r);
  c.quadraticCurveTo(x, y, x + r, y);
  c.closePath();
};

function eye(c: Ctx, f: Traits, s: number, state: number): void {
  const x = s * f.gap, y = f.y, r = f.r;
  c.fillStyle = c.strokeStyle = INK;
  if (state === EYE.shut || state === EYE.glad || state === EYE.cry) {
    // een boogje: dicht hangt het naar beneden, bij lachen staat het bol omhoog
    const up = state === EYE.glad ? -1 : 1, w = r * 1.45 + 0.02;
    c.lineWidth = 0.095;
    curve(c, x - w, y - up * r * 0.3, x, y + up * r * 1.15, x + w, y - up * r * 0.3);
    if (f.eye === 4 && up > 0) {
      c.lineWidth = 0.05;
      line(c, x + s * w, y - r * 0.3, x + s * (w + 0.09), y - r * 0.3 + 0.08);
    }
    return;
  }
  if (state === EYE.wide) {
    // grote ogen: veel wit en een kleine pupil
    c.fillStyle = WHITE;
    c.lineWidth = 0.05;
    c.beginPath();
    c.ellipse(x, y, r * 1.5, r * 1.65, 0, 0, TAU);
    c.fill();
    c.stroke();
    c.fillStyle = INK;
    blob(c, x, y, r * 0.8);
    return;
  }
  if (f.eye === 0) blob(c, x, y, r);
  else if (f.eye === 1) blob(c, x, y, r * 0.82, r * 1.4);
  else if (f.eye === 2) {
    blob(c, x, y, r * 1.32);
    c.fillStyle = WHITE;
    blob(c, x - r * 0.42, y - r * 0.48, r * 0.44);
  } else if (f.eye === 3) {
    // slaperig: het ooglid hangt half over het oog
    const big = r * 1.2;
    c.beginPath();
    c.arc(x, y, big, -0.25, Math.PI + 0.25);
    c.closePath();
    c.fill();
    c.lineWidth = 0.06;
    line(c, x - big * 1.15, y - big * 0.25, x + big * 1.15, y - big * 0.25);
  } else if (f.eye === 4) {
    blob(c, x, y, r * 0.92, r * 1.3);
    c.lineWidth = 0.055;
    line(c, x + s * r * 0.6, y - r * 1.0, x + s * r * 1.45, y - r * 1.75);
    line(c, x + s * r * 0.9, y - r * 0.45, x + s * r * 1.95, y - r * 0.95);
  } else {
    c.fillStyle = WHITE;
    c.lineWidth = 0.045;
    c.beginPath();
    c.ellipse(x, y, r * 1.45, r * 1.6, 0, 0, TAU);
    c.fill();
    c.stroke();
    c.fillStyle = INK;
    blob(c, x - s * r * 0.25, y + r * 0.2, r * 0.9);
  }
}

function brows(c: Ctx, f: Traits, state: number): void {
  const mood = state === EYE.cross || state === EYE.sad || state === EYE.cry || state === EYE.wide;
  // wie geen wenkbrauwen heeft, krijgt ze toch als hij boos, sip of verbaasd kijkt: daar zie je het aan
  if (!f.brow && !mood) return;
  const wide = [0.085, 0.085, 0.075, 0.135, 0.055, 0.075][f.brow], len = f.brow === 3 ? 0.16 : f.brow === 4 ? 0.2 : 0.18;
  let tilt = f.brow === 5 ? -0.07 : 0, lift = 0, arch = f.brow === 2 || f.brow === 4 ? 0.08 : 0.02;
  if (state === EYE.cross) {
    tilt = 0.2;
    lift = 0.07;
    arch = 0;
  } else if (state === EYE.sad || state === EYE.cry) {
    tilt = -0.18;
    lift = -0.02;
    arch = 0.03;
  } else if (state === EYE.wide) {
    lift = -0.1;
    arch = 0.09;
  } else if (state === EYE.glad) lift = -0.04;
  const by = Math.max(-0.64, f.y - f.r * 1.35 - 0.17) + lift;
  c.strokeStyle = f.browCol;
  c.lineWidth = mood ? Math.max(wide, 0.085) : wide;
  for (const s of [-1, 1]) {
    const x = s * f.gap;
    // (de binnenkant zit bij de neus: boos is die laag, sip is die hoog)
    curve(c, x - s * len, by + tilt / 2, x, by - arch, x + s * len, by - tilt / 2);
  }
}

/** De bril. `frame`: het montuur (dat komt over de ogen heen); anders alleen het glas (dat ligt eronder). */
function glasses(c: Ctx, f: Traits, frame: boolean): void {
  const gy = Math.min(f.y, -0.06), R = 0.265;
  c.strokeStyle = f.frame;
  c.fillStyle = LENS;
  c.lineWidth = 0.065;
  for (const s of [-1, 1]) {
    const x = s * f.gap;
    if (f.glasses === 1) {
      c.beginPath();
      c.ellipse(x, gy, R, R, 0, 0, TAU);
    } else box(c, x - R, gy - R * 0.8, R * 2, R * 1.6, 0.08);
    if (!frame) c.fill();
    else {
      c.stroke();
      // de poot naar het oor
      line(c, x + s * R, gy - 0.03, s * 0.99, gy - 0.09);
    }
  }
  if (frame) curve(c, -(f.gap - R), gy - 0.02, 0, gy - 0.09, f.gap - R, gy - 0.02);
}

/** Het bovenste stuk: ogen, wenkbrauwen, neus en bril. `state`: een van EYE. */
function paintTop(c: Ctx, f: Traits, state: number): void {
  c.lineCap = c.lineJoin = 'round';
  if (state === EYE.cry) {
    // tranen: een straaltje onder elk oog (het loopt door in de mond van 'huilen')
    c.strokeStyle = TEAR;
    c.lineWidth = 0.12;
    for (const s of [-1, 1]) line(c, s * (f.gap + 0.03), f.y + 0.12, s * (f.gap + 0.03), 0.5);
  }
  if (f.beard === 2) {
    // de bakkebaarden: zo loopt de volle baard door tot onder het haar
    c.fillStyle = f.hair;
    for (const s of [-1, 1]) {
      c.beginPath();
      c.moveTo(s * 1.1, -0.6);
      c.lineTo(s * 0.93, -0.6);
      c.lineTo(s * 0.655, 0.3);
      c.lineTo(s * 0.655, 0.4);
      c.lineTo(s * 1.1, 0.4);
      c.closePath();
      c.fill();
    }
  }
  if (f.glasses) glasses(c, f, false);
  eye(c, f, -1, state);
  eye(c, f, 1, state);
  brows(c, f, state);
  c.fillStyle = c.strokeStyle = NOSE;
  if (f.nose === 1) blob(c, 0, 0.11, 0.055);
  else if (f.nose === 2) {
    c.beginPath();
    c.moveTo(0, 0.02);
    c.lineTo(0.085, 0.17);
    c.lineTo(-0.085, 0.17);
    c.closePath();
    c.fill();
  } else if (f.nose === 3) {
    c.fillStyle = 'rgba(226,92,84,0.62)';
    blob(c, 0, 0.1, 0.09);
  } else if (f.nose === 4) {
    c.lineWidth = 0.055;
    curve(c, -0.08, 0.08, 0, 0.21, 0.08, 0.08);
  }
  if (f.glasses) glasses(c, f, true);
}

/** Een open lachende mond: boven recht, onder rond, met tanden en een tong. `gap`: er mist een tand. */
function openMouth(c: Ctx, my: number, W: number, deep: number, gap: boolean): void {
  const top = my - deep * 0.3;
  const shape = (): void => {
    c.beginPath();
    c.moveTo(-W, top);
    c.quadraticCurveTo(0, top + 0.05, W, top);
    c.bezierCurveTo(W, top + deep * 1.3, -W, top + deep * 1.3, -W, top);
    c.closePath();
  };
  shape();
  c.fillStyle = INSIDE;
  c.fill();
  c.fillStyle = TONGUE;
  blob(c, 0, top + deep * 0.72, W * 0.42, deep * 0.17);
  // de tanden: een witte strook bovenin
  c.fillStyle = WHITE;
  c.beginPath();
  c.moveTo(-W * 0.84, top + 0.03);
  c.quadraticCurveTo(0, top + 0.075, W * 0.84, top + 0.03);
  c.lineTo(W * 0.74, top + deep * 0.33);
  c.quadraticCurveTo(0, top + deep * 0.33 + 0.045, -W * 0.74, top + deep * 0.33);
  c.closePath();
  c.fill();
  if (gap) {
    c.fillStyle = INSIDE;
    c.fillRect(-0.055, top + 0.035, 0.11, deep * 0.4);
  }
  shape();
  c.strokeStyle = INK;
  c.lineWidth = 0.06;
  c.stroke();
}

/** Het onderste stuk: mond, wangen, snor en baard. `state`: een van MOUTH. */
function paintBottom(c: Ctx, f: Traits, state: number): void {
  c.lineCap = c.lineJoin = 'round';
  const my = f.my, w = f.w;
  if (f.beard === 2) {
    // een volle baard: de hele kaak en kin, met een rond stuk huid om de mond
    c.fillStyle = f.hair;
    c.beginPath();
    c.moveTo(-1.1, 0.1);
    c.lineTo(-1.1, 1.1);
    c.lineTo(1.1, 1.1);
    c.lineTo(1.1, 0.1);
    c.lineTo(0.66, 0.1);
    c.bezierCurveTo(0.66, 1.02, -0.66, 1.02, -0.66, 0.1);
    c.closePath();
    c.fill();
  } else if (f.beard === 1) {
    // een sikje onder de mond
    c.fillStyle = f.hair;
    c.beginPath();
    c.moveTo(-0.19, 0.8);
    c.quadraticCurveTo(0, 0.74, 0.19, 0.8);
    c.quadraticCurveTo(0.17, 1.08, 0, 1.1);
    c.quadraticCurveTo(-0.17, 1.08, -0.19, 0.8);
    c.closePath();
    c.fill();
  }
  if (f.cheeks) {
    c.fillStyle = BLUSH;
    blob(c, -0.62, 0.43, 0.165, 0.115);
    blob(c, 0.62, 0.43, 0.165, 0.115);
  }
  if (f.freckles) {
    c.fillStyle = FRECKLE;
    for (const s of [-1, 1]) {
      blob(c, s * 0.5, 0.34, 0.034);
      blob(c, s * 0.66, 0.39, 0.034);
      blob(c, s * 0.54, 0.47, 0.034);
    }
  }
  if (f.mole) {
    c.fillStyle = INK;
    blob(c, 0.5, 0.72, 0.045);
  }
  if (state === MOUTH.wail) {
    // de tranen lopen over de wangen en eindigen in een druppel
    c.strokeStyle = c.fillStyle = TEAR;
    c.lineWidth = 0.12;
    for (const s of [-1, 1]) {
      line(c, s * (f.gap + 0.03), 0.1, s * (f.gap + 0.03), 0.5);
      blob(c, s * (f.gap + 0.03), 0.56, 0.085);
    }
  }
  const lips = f.mouth === 6;
  c.strokeStyle = lips ? LIP : INK;
  c.lineWidth = lips ? 0.135 : 0.11;
  if (state === MOUTH.smile) {
    if (f.mouth === 4) openMouth(c, my, 0.27, 0.3, true);
    else if (f.mouth === 3) {
      // het kattenmondje: twee boogjes naast elkaar
      c.beginPath();
      c.moveTo(-w, my - 0.04);
      c.quadraticCurveTo(-w / 2, my + 0.17, 0, my - 0.02);
      c.quadraticCurveTo(w / 2, my + 0.17, w, my - 0.04);
      c.stroke();
    } else if (f.mouth === 5) curve(c, -w, my + 0.02, w * 0.3, my + 0.14, w, my - 0.1);
    else {
      const deep = f.mouth === 1 ? 0.27 : f.mouth === 2 ? 0.13 : 0.2;
      curve(c, -w, my - 0.05, 0, my + deep, w, my - 0.05);
      // bij een brede lach: kuiltjes in de mondhoeken
      if (f.mouth === 1) {
        c.lineWidth = 0.06;
        line(c, -w - 0.04, my - 0.11, -w + 0.02, my - 0.03);
        line(c, w + 0.04, my - 0.11, w - 0.02, my - 0.03);
      }
    }
  } else if (state === MOUTH.grin) openMouth(c, my, Math.min(0.44, Math.max(w, 0.28) + 0.09), 0.42, f.mouth === 4);
  else if (state === MOUTH.flat) curve(c, -0.19, my + 0.02, 0, my + 0.035, 0.19, my + 0.02);
  else if (state === MOUTH.frown) curve(c, -0.25, my + 0.13, 0, my - 0.1, 0.25, my + 0.13);
  else if (state === MOUTH.wail || state === MOUTH.yawn) {
    // wijd open: bij huilen breed van onderen, bij gapen een hoog ovaal
    const cry = state === MOUTH.wail;
    c.beginPath();
    if (cry) {
      c.moveTo(-0.31, my + 0.24);
      c.bezierCurveTo(-0.36, my - 0.2, 0.36, my - 0.2, 0.31, my + 0.24);
      c.quadraticCurveTo(0, my + 0.33, -0.31, my + 0.24);
      c.closePath();
    } else c.ellipse(0, my + 0.05, 0.23, 0.29, 0, 0, TAU);
    c.fillStyle = INSIDE;
    c.fill();
    c.fillStyle = TONGUE;
    blob(c, 0, my + (cry ? 0.19 : 0.23), cry ? 0.17 : 0.13, 0.075);
    c.strokeStyle = INK;
    c.lineWidth = 0.06;
    c.beginPath();
    if (cry) {
      c.moveTo(-0.31, my + 0.24);
      c.bezierCurveTo(-0.36, my - 0.2, 0.36, my - 0.2, 0.31, my + 0.24);
      c.quadraticCurveTo(0, my + 0.33, -0.31, my + 0.24);
      c.closePath();
    } else c.ellipse(0, my + 0.05, 0.23, 0.29, 0, 0, TAU);
    c.stroke();
  } else if (state === MOUTH.oh) {
    c.fillStyle = INSIDE;
    c.strokeStyle = INK;
    c.lineWidth = 0.06;
    c.beginPath();
    c.ellipse(0, my + 0.03, 0.125, 0.155, 0, 0, TAU);
    c.fill();
    c.stroke();
  } else {
    // kauwen: de mond dicht en scheef, met een bolle wang; om en om links en rechts
    const s = state === MOUTH.chewA ? 1 : -1;
    curve(c, -0.17 + s * 0.06, my - s * 0.03, s * 0.04, my + 0.11, 0.17 + s * 0.06, my + s * 0.03);
    c.lineWidth = 0.06;
    c.strokeStyle = INK;
    curve(c, s * 0.42, my - 0.1, s * 0.52, my + 0.02, s * 0.42, my + 0.14);
  }
  if (f.tache) {
    c.fillStyle = f.hair;
    c.beginPath();
    c.moveTo(0, 0.31);
    c.bezierCurveTo(-0.12, 0.25, -0.34, 0.3, -0.45, 0.47);
    c.bezierCurveTo(-0.3, 0.51, -0.12, 0.47, 0, 0.41);
    c.bezierCurveTo(0.12, 0.47, 0.3, 0.51, 0.45, 0.47);
    c.bezierCurveTo(0.34, 0.3, 0.12, 0.25, 0, 0.31);
    c.closePath();
    c.fill();
  }
}

/**
 * Tekent één vakje van gezicht `id` in de rechthoek (x, y, w, h): kolom 0 tot 6 is een stel ogen (het stuk boven de
 * naad), daarna komen de monden (het stuk eronder). Wat buiten het vakje valt, wordt afgeknipt.
 */
export function paintCell(c: Ctx, id: number, col: number, x: number, y: number, w: number, h: number, pad = 0): void {
  const f = allTraits()[id], top = col < EYES;
  c.save();
  c.beginPath();
  c.rect(x, y, w, h);
  c.clip();
  // (met een rand: het gezicht staat iets kleiner in het vakje en de tekening loopt door tot in de rand)
  x += pad;
  y += pad;
  w -= pad * 2;
  h -= pad * 2;
  const sy = h / (top ? SEAM + 1 : 1 - SEAM);
  c.translate(x + w / 2, top ? y + sy : y - SEAM * sy);
  c.scale(w / 2, sy);
  if (top) paintTop(c, f, col);
  else paintBottom(c, f, col - EYES);
  c.restore();
}

/**
 * De hele plaat: per gezicht een rij, per soort ogen of mond een kolom. Om elk vakje zit een rand van een paar
 * beeldpunten waarin de tekening doorloopt: van ver weg lopen de vakjes dan niet in elkaar over.
 */
export function paintAtlas(c: Ctx): void {
  for (let id = 0; id < FACES; id++) for (let col = 0; col < COLS; col++) paintCell(c, id, col, col * CW, id * CH, CW, CH, PAD);
}

// ------------------------------------------------------------ de plaat, het materiaal en het vlakje
let sheet: THREE.CanvasTexture | null | undefined;
/** De plaat met alle gezichten; wordt pas getekend als hij nodig is. Zonder beeld (in de tests) is er geen. */
function atlas(): THREE.CanvasTexture | null {
  if (sheet !== undefined) return sheet;
  sheet = null;
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = COLS * CW;
  canvas.height = FACES * CH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  paintAtlas(ctx);
  sheet = new THREE.CanvasTexture(canvas);
  // de kleuren staan al met hun dekking vermenigvuldigd op de plaat: zo blijven randen en wangen ook van ver schoon
  sheet.colorSpace = THREE.NoColorSpace;
  sheet.premultiplyAlpha = true;
  sheet.anisotropy = 4;
  return sheet;
}

/**
 * Het materiaal van een gezicht: de kleur van de huid, met de plaat eroverheen. Het licht valt erop zoals op het
 * hoofd zelf, dus 's nachts wordt het vanzelf donker. Elk hoekpunt weet in `faceCell` welk gezicht, welke ogen en
 * welke mond het laat zien, en in `facePart` of het bij het stuk met de ogen (0) of dat met de mond (1) hoort.
 */
class FaceMaterial extends THREE.MeshStandardMaterial {
  constructor() {
    super();
    this.roughness = 0.9;
    this.polygonOffset = true;
    this.polygonOffsetFactor = this.polygonOffsetUnits = -1;
  }

  override onBeforeCompile(shader: THREE.WebGLProgramParametersWithUniforms): void {
    // waar het hoekpunt in zijn vakje zit (binnen de rand), en daarmee waar op de plaat
    const u = `${(PAD / CW).toFixed(5)} + uv.x * ${(1 - (2 * PAD) / CW).toFixed(5)}`, v = `${(PAD / CH).toFixed(5)} + uv.y * ${(1 - (2 * PAD) / CH).toFixed(5)}`;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 faceCell;\nattribute float facePart;')
      .replace('#include <uv_vertex>', `#include <uv_vertex>\nvMapUv = vec2( ( mix( faceCell.y, faceCell.z, facePart ) + ${u} ) / ${COLS}.0, 1.0 - ( faceCell.x + 1.0 - ( ${v} ) ) / ${FACES}.0 );`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <map_fragment>', 'vec4 faceTexel = texture2D( map, vMapUv );')
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = mix( diffuseColor.rgb, pow( faceTexel.rgb / max( faceTexel.a, 0.004 ), vec3( 2.2 ) ), faceTexel.a );');
  }
}

const mats = new Map<number, FaceMaterial>();
function faceMat(skin: number, map: THREE.Texture): FaceMaterial {
  let m = mats.get(skin);
  if (!m) {
    m = new FaceMaterial();
    m.color.setHex(skin);
    m.map = map;
    mats.set(skin, m);
  }
  return m;
}

let base: THREE.BufferGeometry | null = null;
/** Het vlakje voor het hoofd: twee stukken boven elkaar. `cells`: welk vakje van de plaat elk hoekpunt (of elk poppetje) laat zien. */
function faceGeo(cells: THREE.BufferAttribute): THREE.BufferGeometry {
  if (!base) {
    const h = HALF, z = HALF + OUT, seam = -SEAM * HALF;
    base = new THREE.BufferGeometry();
    base.setAttribute('position', new THREE.Float32BufferAttribute([-h, seam, z, h, seam, z, h, h, z, -h, h, z, -h, -h, z, h, -h, z, h, seam, z, -h, seam, z], 3));
    base.setAttribute('normal', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1], 3));
    base.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1], 2));
    base.setAttribute('facePart', new THREE.Float32BufferAttribute([0, 0, 0, 0, 1, 1, 1, 1], 1));
    base.setIndex([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7]);
    base.computeBoundingSphere();
  }
  const geo = new THREE.BufferGeometry();
  for (const name of ['position', 'normal', 'uv', 'facePart']) geo.setAttribute(name, base.getAttribute(name));
  geo.setIndex(base.getIndex());
  geo.setAttribute('faceCell', cells);
  geo.boundingSphere = base.boundingSphere;
  return geo;
}

/** Schrijf op plek `i` welk gezicht en welke uitdrukking (ogen * 16 + mond) er te zien is. */
function writeCell(to: ArrayLike<number> & { [n: number]: number }, i: number, id: number, look: number): void {
  to[i * 3] = id;
  to[i * 3 + 1] = look >> 4;
  to[i * 3 + 2] = EYES + (look & 15);
}

// ------------------------------------------------------------ losse gezichten (werkers, verkopers, de weg)
/** Een los gezicht voor een hoofd dat zelf getekend wordt: het vlakje hoort op het midden van het hoofd, als kind ervan. */
export function soloFace(skin: number, id: number, look = 0): THREE.Mesh | null {
  const map = atlas();
  if (!map) return null;
  const mesh = new THREE.Mesh(faceGeo(new THREE.BufferAttribute(new Float32Array(24), 3)), faceMat(skin, map));
  mesh.userData.face = id;
  paintSolo(mesh, look);
  return mesh;
}

/** Geef een los gezicht een andere uitdrukking. */
export function paintSolo(mesh: THREE.Mesh, look: number): void {
  const cells = mesh.geometry.getAttribute('faceCell') as THREE.BufferAttribute;
  for (let i = 0; i < 8; i++) writeCell(cells.array, i, mesh.userData.face as number, look);
  cells.needsUpdate = true;
}

/**
 * Geeft een hoofd een gezicht: het nummer staat in `userData.face`, de uitdrukking in `userData.look`.
 * `solo`: het hoofd wordt los getekend en krijgt zijn eigen vlakje; anders tekent FaceCrowd het.
 */
export function giveFace(head: THREE.Mesh, child: boolean, solo = false): void {
  head.userData.face = randomFace(child);
  head.userData.look = 0;
  if (!solo) return;
  const mesh = soloFace((head.material as THREE.MeshStandardMaterial).color.getHex(), head.userData.face as number);
  if (!mesh) return;
  head.add(mesh);
  head.userData.faceMesh = mesh;
}

/** Zet de uitdrukking van een hoofd (zie `faceFor`). Kost niets als er niets verandert. */
export function setFace(head: THREE.Object3D, look: number): void {
  const data = head.userData;
  if (data.look === look) return;
  data.look = look;
  if (data.faceMesh) paintSolo(data.faceMesh as THREE.Mesh, look);
}

// ------------------------------------------------------------ alle gezichten van de gasten in één tekenopdracht
/** Hoort bij Crowd in people.ts: elk hoofd dat daar voorbijkomt, krijgt hier zijn gezicht ervoor. */
export class FaceCrowd {
  private scene: THREE.Scene;
  private mesh: THREE.InstancedMesh | null = null;
  private cells: THREE.InstancedBufferAttribute | null = null;
  private n = 0;
  private cap = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  begin(): void {
    this.n = 0;
  }

  add(head: THREE.Mesh): void {
    const id = head.userData.face as number | undefined;
    if (id === undefined || (this.n >= this.cap && !this.grow())) return;
    const mesh = this.mesh!, i = this.n++;
    head.matrixWorld.toArray(mesh.instanceMatrix.array, i * 16);
    (head.material as THREE.MeshStandardMaterial).color.toArray(mesh.instanceColor!.array, i * 3);
    writeCell(this.cells!.array, i, id, (head.userData.look as number | undefined) ?? 0);
  }

  /** Meer plek: twee keer zoveel als eerst. Wat er dit beeldje al in stond, gaat mee. */
  private grow(): boolean {
    const map = atlas();
    if (!map) return false;
    const cap = this.cap ? this.cap * 2 : 128, old = this.mesh, oldCells = this.cells;
    const cells = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
    const mesh = new THREE.InstancedMesh(faceGeo(cells), faceMat(0xffffff, map), cap);
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
    mesh.frustumCulled = false;
    mesh.count = 0;
    if (old && oldCells) {
      (mesh.instanceMatrix.array as Float32Array).set(old.instanceMatrix.array);
      (mesh.instanceColor.array as Float32Array).set(old.instanceColor!.array);
      (cells.array as Float32Array).set(oldCells.array);
      this.scene.remove(old);
      old.geometry.dispose();
      old.dispose();
    }
    this.scene.add(mesh);
    this.mesh = mesh;
    this.cells = cells;
    this.cap = cap;
    return true;
  }

  end(): void {
    const mesh = this.mesh;
    if (!mesh) return;
    mesh.count = this.n;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor!.needsUpdate = true;
    this.cells!.needsUpdate = true;
  }
}

// ------------------------------------------------------------ welke uitdrukking bij wat iemand doet
const look = (eyes: number, mouth: number): number => eyes * 16 + mouth;
/**
 * Het gezicht bij een stemming, een gebaar of iets wat een gast doet (de namen komen uit people.ts). Wat hier niet
 * in staat, krijgt het gezicht van de stemming.
 */
const LOOKS: Record<string, number> = {
  // de stemming
  fine: look(EYE.open, MOUTH.smile), plain: look(EYE.open, MOUTH.flat), glum: look(EYE.sad, MOUTH.frown), cry: look(EYE.cry, MOUTH.wail),
  joy: look(EYE.glad, MOUTH.grin), moan: look(EYE.cross, MOUTH.frown), oops: look(EYE.sad, MOUTH.oh), worry: look(EYE.sad, MOUTH.flat),
  nap: look(EYE.shut, MOUTH.flat), ride: look(EYE.open, MOUTH.grin), cross: look(EYE.cross, MOUTH.flat),
  // korte gebaren
  startle: look(EYE.wide, MOUTH.oh), alarm: look(EYE.wide, MOUTH.yawn), lookup: look(EYE.wide, MOUTH.oh), fan: look(EYE.wide, MOUTH.grin),
  slump: look(EYE.sad, MOUTH.frown), yuck: look(EYE.cross, MOUTH.frown), stomp: look(EYE.cross, MOUTH.frown), dizzy: look(EYE.shut, MOUTH.oh),
  relief: look(EYE.shut, MOUTH.smile), rub: look(EYE.glad, MOUTH.smile), hug: look(EYE.glad, MOUTH.smile), don: look(EYE.open, MOUTH.grin), five: look(EYE.glad, MOUTH.grin),
  // bij de dieren
  laugh: look(EYE.glad, MOUTH.grin), clap: look(EYE.open, MOUTH.grin), jump: look(EYE.open, MOUTH.grin), wave: look(EYE.open, MOUTH.grin), join: look(EYE.open, MOUTH.grin),
  point: look(EYE.open, MOUTH.grin), call: look(EYE.open, MOUTH.oh), hush: look(EYE.open, MOUTH.oh), pity: look(EYE.sad, MOUTH.flat), stink: look(EYE.cross, MOUTH.frown), gloom: look(EYE.sad, MOUTH.frown),
  // kleine dingen tussendoor
  yawn: look(EYE.shut, MOUTH.yawn), sigh: look(EYE.sad, MOUTH.flat), shiver: look(EYE.sad, MOUTH.frown), dance: look(EYE.glad, MOUTH.grin), selfie: look(EYE.open, MOUTH.grin),
  rainbow: look(EYE.wide, MOUTH.grin), stretch: look(EYE.shut, MOUTH.smile), tap: look(EYE.open, MOUTH.flat), watch: look(EYE.open, MOUTH.flat),
  // bij een ding in het park
  giggle: look(EYE.glad, MOUTH.grin), mimic: look(EYE.open, MOUTH.grin), show: look(EYE.open, MOUTH.grin), sniff: look(EYE.shut, MOUTH.smile), warm: look(EYE.shut, MOUTH.smile),
};

/**
 * De uitdrukking van nu. `doing`: wat iemand doet (een gebaar, 'joy', 'bite', ...) of niets; `mood`: 'fine', 'plain',
 * 'glum' of 'cry'; `t`: een klok in tellen (voor kauwen, praten en knipperen); `seed`: een vast getal van 0 tot 1 per
 * poppetje, zodat niet iedereen tegelijk knippert.
 */
export function faceFor(doing: string | null | undefined, mood: string, t: number, seed: number): number {
  let now = doing ? LOOKS[doing] : undefined;
  if (now === undefined) now = LOOKS[mood] ?? 0;
  // eten is kauwen, om en om links en rechts; drinken en likken is een tuitmondje; praten is open en dicht
  if (doing === 'bite') now = look(EYE.open, (t * 3.4) % 1 < 0.5 ? MOUTH.chewA : MOUTH.chewB);
  else if (doing === 'sip' || doing === 'lick') now = look(EYE.open, (t * 0.9) % 1 < 0.6 ? MOUTH.oh : MOUTH.smile);
  else if (doing === 'talk') now = look(EYE.open, (t * 3.1) % 1 < 0.5 ? MOUTH.oh : MOUTH.smile);
  // knipperen: om de paar tellen gaan de ogen heel even dicht
  const eyes = now >> 4;
  if ((eyes === EYE.open || eyes === EYE.sad || eyes === EYE.cross) && (t + seed * 9) % (2.7 + seed * 2.3) < 0.13) now = look(EYE.shut, now & 15);
  return now;
}

// ------------------------------------------------------------ voor de modellenpagina
const SKINS = [0xf6cfa6, 0xe8b48a, 0xc98d5e, 0xa86b42, 0x8a5637];
const SAMPLE_HAIR = [0x2b1b14, 0x7a4a22, 0xd9a520, 0xd9532b, 0x9aa0a6];
const SAMPLE_LOOKS = ['fine', 'joy', 'plain', 'glum', 'moan', 'cry', 'startle', 'nap', 'oops', 'yawn', 'chew', 'ride'];

/** Een groot los hoofd met gezicht `n`, om alle gezichten naast elkaar te bekijken (modellen.html, groep 'gezichten'). */
export function sampleHead(n: number): THREE.Group {
  const group = new THREE.Group(), skin = SKINS[n % SKINS.length];
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.17, 0.17), new THREE.MeshStandardMaterial({ color: skin, roughness: 0.9 }));
  head.position.y = 0.085;
  const hair = new THREE.Mesh(new THREE.BoxGeometry(0.185, 0.07, 0.185), new THREE.MeshStandardMaterial({ color: SAMPLE_HAIR[(n * 3) % SAMPLE_HAIR.length], roughness: 0.9 }));
  hair.position.y = 0.18;
  group.add(head, hair);
  const face = soloFace(skin, n % FACES);
  if (face) {
    head.add(face);
    group.userData.face = face;
  }
  // naar de camera gedraaid, en drie keer zo groot als in het spel
  group.rotation.y = Math.PI / 4;
  group.scale.setScalar(3);
  return group;
}

/** Laat het losse hoofd uitdrukking nummer `k` zien (ze komen om de beurt langs). */
export function showSample(group: THREE.Group, k: number): void {
  const face = group.userData.face as THREE.Mesh | undefined, name = SAMPLE_LOOKS[k % SAMPLE_LOOKS.length];
  if (face) paintSolo(face, name === 'chew' ? look(EYE.open, MOUTH.chewA) : LOOKS[name]);
}
