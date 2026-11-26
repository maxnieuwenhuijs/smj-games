// Rondlopen in je eigen park, als bezoeker (de loopstand). Hier staan alleen de sommen: lopen, botsen en kijken.
// Geen Three.js en geen DOM, zodat dit los te testen is. De camera zit in view.ts, de knoppen in walkmode.ts.

export const WALK = {
  /** Zo hoog zijn je ogen, in tegels: een kind dat net over het hek kan kijken (een grote gast is 0,66 hoog). */
  eye: 0.58,
  /** Zo hard loop je vooruit en achteruit (tegels per tel), en zo snel draai je (radialen per tel). Rustig, voor kleine handen. */
  speed: 1.3,
  back: 0.8,
  turn: 1.8,
  /** Zo dik ben je: zo dicht kom je bij een hek, muur of boom. */
  radius: 0.2,
  /** Zo lang duurt het naar beneden of weer omhoog vliegen, in tellen. */
  fly: 1.3,
  /** De kijkhoek van de camera, van boven naar beneden, in graden. */
  fov: 66,
  /** Een stap is zo lang (tegels); bij elke stap gaat je hoofd zo ver op en neer (tegels). */
  stride: 0.5,
  bob: 0.016,
  /** Zo ver weg zie je een dier of gast nog aan (tegels), en zo breed is het mikvenster om het midden (radialen). */
  lookRange: 5,
  lookCone: 0.12,
  /** Zo ver kun je omhoog en omlaag kijken (radialen); en zo kijk je als je begint. */
  pitchUp: 0.55,
  pitchDown: 0.75,
  pitch: -0.1,
  /** Een dier of gast doet hooguit eens per zoveel tellen iets voor jou. */
  again: 3,
  /** Wolkjes boven dingen die verder weg zijn dan dit (tegels), zie je niet: anders staat de horizon vol. */
  tagRange: 11,
  /** De mist: vanaf hier begint hij, en hier zie je niets meer (tegels). */
  fogNear: 16,
  fogFar: 60,
  /** Zo ver hoor je om je heen, net als ingezoomd op zoveel tegels. */
  hear: 10,
  /** Slepen om rond te kijken: zoveel radialen per pixel. */
  drag: 0.005,
  /** De grote ronde knop op een tablet: zo ver kun je hem uit het midden duwen (pixels), en zo veel doet nog niets. */
  stick: 56,
  dead: 0.12,
  /** Zo veel donkerder is de nacht van dichtbij (op de grond zie je de lampen beter dan van boven). */
  night: 0.85,
};

/** Een blok dat in de weg staat, in rastercoördinaten: van (x0, y0) tot (x1, y1). */
export type Box = readonly [x0: number, y0: number, x1: number, y1: number];

/** Wat de loper van het park moet weten: waar hij niet door kan. */
export interface WalkGround {
  /** Wat er op tegel (x, y) in de weg staat: een hele tegel (buiten het park, een verblijf, een gebouw) of een stukje ervan. */
  boxes(x: number, y: number): readonly Box[];
  /** Staat er iets op deze rand (een hek, muur, bankje of paal)? 'h' is de noordrand van tegel (x, y), 'v' de westrand. */
  wall(o: 'h' | 'v', x: number, y: number): boolean;
}

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

/** Het verschil tussen twee richtingen, van -pi tot pi. */
export function angleDiff(a: number, b: number): number {
  let d = (a - b) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** Vooruit en naar rechts op het raster, als je deze kant op kijkt. Richting 0 is naar het zuiden (+y). */
export const ahead = (yaw: number): [number, number] => [Math.sin(yaw), Math.cos(yaw)];
export const rightOf = (yaw: number): [number, number] => [-Math.cos(yaw), Math.sin(yaw)];

/** Duwt het rondje (p, met straal r) uit het blok. Geeft terug of het blok in de weg zat. */
function pushOut(p: { x: number; y: number }, x0: number, y0: number, x1: number, y1: number, r: number): boolean {
  const cx = clamp(p.x, x0, x1), cy = clamp(p.y, y0, y1);
  const dx = p.x - cx, dy = p.y - cy, d2 = dx * dx + dy * dy;
  if (d2 >= r * r) return false;
  if (d2 > 1e-12) {
    const d = Math.sqrt(d2), k = (r - d) / d;
    p.x += dx * k;
    p.y += dy * k;
    return true;
  }
  // midden in het blok: de kortste weg eruit
  const l = p.x - x0, rt = x1 - p.x, u = p.y - y0, dn = y1 - p.y, m = Math.min(l, rt, u, dn);
  if (m === l) p.x = x0 - r;
  else if (m === rt) p.x = x1 + r;
  else if (m === u) p.y = y0 - r;
  else p.y = y1 + r;
  return true;
}

/** Duwt de loper uit alles wat in de weg staat: blokken op de tegels om hem heen en hekken op de randen. */
function resolve(p: { x: number; y: number }, g: WalkGround, r: number): void {
  for (let pass = 0; pass < 3; pass++) {
    let hit = false;
    const tx0 = Math.floor(p.x - r), tx1 = Math.floor(p.x + r), ty0 = Math.floor(p.y - r), ty1 = Math.floor(p.y + r);
    for (let ty = ty0; ty <= ty1; ty++)
      for (let tx = tx0; tx <= tx1; tx++) for (const b of g.boxes(tx, ty)) if (pushOut(p, b[0], b[1], b[2], b[3], r)) hit = true;
    // een hek is een dunne lijn op de rand van een tegel
    for (let ey = Math.ceil(p.y - r); ey <= Math.floor(p.y + r); ey++)
      for (let ex = tx0; ex <= tx1; ex++) if (g.wall('h', ex, ey) && pushOut(p, ex, ey, ex + 1, ey, r)) hit = true;
    for (let ex = Math.ceil(p.x - r); ex <= Math.floor(p.x + r); ex++)
      for (let ey = ty0; ey <= ty1; ey++) if (g.wall('v', ex, ey) && pushOut(p, ex, ey, ex, ey + 1, r)) hit = true;
    if (!hit) return;
  }
}

/**
 * Eén stukje lopen: van (x, y) zo ver als (dx, dy), in kleine stapjes, zodat je nooit door een dun hek glipt. Loop je
 * schuin tegen een hek of muur, dan glijd je er langs in plaats van vast te zitten. Geeft de nieuwe plek.
 */
export function stepWalker(x: number, y: number, dx: number, dy: number, g: WalkGround, r = WALK.radius): [number, number] {
  const p = { x, y };
  const n = Math.max(1, Math.ceil(Math.hypot(dx, dy) / (r * 0.5)));
  for (let i = 0; i < n; i++) {
    p.x += dx / n;
    p.y += dy / n;
    resolve(p, g, r);
  }
  return [p.x, p.y];
}

/** Kan de loper hier staan, zonder iets te raken? */
export function standsFree(x: number, y: number, g: WalkGround, r = WALK.radius): boolean {
  const p = { x, y };
  resolve(p, g, r);
  return Math.abs(p.x - x) < 1e-9 && Math.abs(p.y - y) < 1e-9;
}

/** Iets waar je naar kunt kijken: een dier of gast op (gx, gy), het midden op hoogte `h`, en `r` tegels breed. */
export interface LookTarget {
  gx: number;
  gy: number;
  h: number;
  r: number;
}

/**
 * Waar kijk je naar? Vanaf (x, y) op ooghoogte `eye`, de kant op van `yaw` en `pitch` (omhoog is plus). Het ding dat
 * het dichtst bij het midden van je blik staat en niet te ver weg is (door een hek heen mag). Groter is makkelijker
 * te raken. Geeft het nummer in de lijst, of -1 als je nergens naar kijkt.
 */
export function pickLook(x: number, y: number, eye: number, yaw: number, pitch: number, targets: readonly LookTarget[], range = WALK.lookRange, cone = WALK.lookCone): number {
  let best = -1, bestScore = Infinity;
  for (let i = 0; i < targets.length; i++) {
    const t = targets[i], dx = t.gx - x, dy = t.gy - y, d = Math.hypot(dx, dy);
    if (d < 0.05 || d > range + t.r) continue;
    const size = Math.atan2(t.r, d), wide = cone + size;
    const off = Math.abs(angleDiff(Math.atan2(dx, dy), yaw));
    if (off > wide) continue;
    // ook omhoog en omlaag moet het ongeveer kloppen
    if (Math.abs(Math.atan2(t.h - eye, d) - pitch) > 0.45 + size) continue;
    const score = off / wide + (d / range) * 0.5;
    if (score < bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return best;
}

/**
 * De grote ronde knop: hoe ver je vinger (dx, dy pixels) uit het midden is, als vooruit (plus) en draaien (plus is
 * naar rechts), elk van -1 tot 1. Verder dan de rand telt als de rand, en een heel klein beetje telt niet.
 */
export function stickInput(dx: number, dy: number, reach = WALK.stick, dead = WALK.dead): { forward: number; turn: number } {
  let x = dx / reach, y = dy / reach;
  const len = Math.hypot(x, y);
  if (len < dead) return { forward: 0, turn: 0 };
  if (len > 1) {
    x /= len;
    y /= len;
  }
  return { forward: -y, turn: x };
}

/** Ooghoogte terwijl je loopt: bij elke stap een klein knikje. `phase` loopt op met de afgelegde weg. */
export function bobHeight(phase: number, moving: number): number {
  return WALK.eye + Math.abs(Math.sin(phase)) * WALK.bob * clamp(moving, 0, 1);
}

/** Kijk je niet te ver omhoog of omlaag? */
export const clampPitch = (pitch: number): number => clamp(pitch, -WALK.pitchDown, WALK.pitchUp);
