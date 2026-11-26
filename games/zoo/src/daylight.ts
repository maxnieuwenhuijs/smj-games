// Het licht en de lucht per uur van de dag: 's ochtends warm oranje, 's middags helder wit, laat in de middag
// goudgeel en 's nachts koel blauw. Geen Three.js hier, zodat dit los te testen is; view.ts zet het om in licht.
import type { Season } from './data';

/** Een kleur als drie getallen van 0 tot 1, in gewone schermkleuren (sRGB). */
export type RGB = [number, number, number];

/** Wat het uur met het beeld doet. `sunK` en `hemiK` zijn keer het gewone licht van de middag. */
export interface DayLook {
  sun: RGB;
  sunK: number;
  hemi: RGB;
  hemiK: number;
  /** De lucht bovenin, en bij de horizon (daar heeft ook de mist deze kleur). */
  top: RGB;
  horizon: RGB;
}

/**
 * De tabel: per uur de kleur van de zon en van het licht van de lucht, hoe fel (`k`, 1 = de middag), de kleuren
 * van de lucht, en `w`: hoeveel die luchtkleuren het overnemen van de lucht van de wereld (0 = gewoon die van de
 * wereld, zoals 's middags). Tussen twee rijen loopt het zacht over.
 */
const NIGHT = { sun: 0xb4c4ff, sk: 0.95, hemi: 0xc8d4ff, hk: 1, top: 0x0a1233, horizon: 0x283a78, w: 1 };
const NOON = { sun: 0xfff4dd, sk: 1, hemi: 0xffffff, hk: 1, top: 0x6fb0f0, horizon: 0xbfe6ff, w: 0 };
export const DAY_TABLE: { h: number; sun: number; sk: number; hemi: number; hk: number; top: number; horizon: number; w: number }[] = [
  { h: 0, ...NIGHT },
  { h: 5.2, ...NIGHT },
  // de dageraad: roze bij de horizon
  { h: 6.5, sun: 0xffb8a0, sk: 0.8, hemi: 0xe8d4f0, hk: 0.92, top: 0x6d8fd6, horizon: 0xf8bca8, w: 0.9 },
  // de ochtend: zacht warm oranje
  { h: 7.6, sun: 0xffcb98, sk: 0.86, hemi: 0xffeadb, hk: 0.95, top: 0x7cb0ec, horizon: 0xffd8b4, w: 0.75 },
  { h: 9.5, sun: 0xffecd2, sk: 0.96, hemi: 0xfff8f0, hk: 1, top: 0x74b0ee, horizon: 0xffecd8, w: 0.22 },
  { h: 11, ...NOON },
  { h: 15.5, ...NOON },
  // laat in de middag wordt het goudgeel
  { h: 17.3, sun: 0xffe2ae, sk: 0.97, hemi: 0xfff3e2, hk: 1, top: 0x74abea, horizon: 0xffe8bc, w: 0.3 },
  { h: 19, sun: 0xffc677, sk: 0.92, hemi: 0xffe8c8, hk: 0.97, top: 0x6a9ce0, horizon: 0xffd08c, w: 0.65 },
  // de zon gaat onder: oranje bij de horizon, de lucht erboven al wat paars
  { h: 20.5, sun: 0xffa874, sk: 0.84, hemi: 0xead0e0, hk: 0.94, top: 0x4a6cc0, horizon: 0xf7a880, w: 0.88 },
  { h: 21.4, ...NIGHT },
  { h: 24, ...NIGHT },
];

/** Een heel klein beetje warmer in de herfst en koeler in de winter (keer de kleur van het licht). */
export const SEASON_TINT: Record<Season, number> = { spring: 0xfffcf4, summer: 0xffffff, autumn: 0xfff0dc, winter: 0xecf2ff };

/** Zo diep blauw wordt de lucht bovenin, vanuit de lucht van de wereld (bij `w` = 0). */
const DEEP = 0x6fb0f0, DEEP_MIX = 0.55;

const ch = (hex: number, i: number): number => ((hex >> (16 - 8 * i)) & 255) / 255;
const toLin = (c: number): number => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
/** Hoe licht een kleur is voor het oog (in lineair licht). */
export const luma = (c: RGB): number => 0.2126 * toLin(c[0]) + 0.7152 * toLin(c[1]) + 0.0722 * toLin(c[2]);
const NOON_SUN: RGB = [0, 1, 2].map(i => ch(NOON.sun, i)) as RGB;
const NOON_HEMI: RGB = [0, 1, 2].map(i => ch(NOON.hemi, i)) as RGB;

/** Zacht beginnen en zacht eindigen. */
const ease = (t: number): number => t * t * (3 - 2 * t);

function mixHex(out: RGB, a: number, b: number, t: number): RGB {
  for (let i = 0; i < 3; i++) out[i] = ch(a, i) + (ch(b, i) - ch(a, i)) * t;
  return out;
}

function mixInto(out: RGB, to: RGB, t: number): RGB {
  for (let i = 0; i < 3; i++) out[i] += (to[i] - out[i]) * t;
  return out;
}

/** De kleur van een licht (met het seizoen erover) in `rgb`; geeft terug hoe fel het moet om `k` keer de middag te zijn. */
function light(rgb: RGB, from: number, to: number, t: number, tint: number, k: number, noon: RGB): number {
  mixHex(rgb, from, to, t);
  for (let c = 0; c < 3; c++) rgb[c] *= ch(tint, c);
  return (k * luma(noon)) / Math.max(0.05, luma(rgb));
}

export const newLook =(): DayLook => ({ sun: [1, 1, 1], sunK: 1, hemi: [1, 1, 1], hemiK: 1, top: [1, 1, 1], horizon: [1, 1, 1] });

const tmp: RGB = [0, 0, 0];

/**
 * Het licht en de lucht om `hour` uur (0 tot 24) in een wereld met lucht `worldSky` (hex) in seizoen `season`.
 * Schrijft in `out` (geen nieuwe dingen per beeldje). De felheid is zo gerekend dat de kleur het licht niet donkerder
 * maakt: een oranje zon met `sunK` 0,9 is ongeveer 0,9 keer zo licht als de witte zon van de middag.
 */
export function dayLook(hour: number, worldSky: number, season: Season, out: DayLook): DayLook {
  const h = ((hour % 24) + 24) % 24;
  let i = 0;
  while (i < DAY_TABLE.length - 2 && DAY_TABLE[i + 1].h <= h) i++;
  const a = DAY_TABLE[i], b = DAY_TABLE[i + 1];
  const t = ease(Math.min(1, Math.max(0, (h - a.h) / (b.h - a.h))));
  const tint = SEASON_TINT[season];
  out.sunK = light(out.sun, a.sun, b.sun, t, tint, a.sk + (b.sk - a.sk) * t, NOON_SUN);
  out.hemiK = light(out.hemi, a.hemi, b.hemi, t, tint, a.hk + (b.hk - a.hk) * t, NOON_HEMI);
  // de lucht: die van de wereld, en hoe verder van de middag, hoe meer de kleur van het uur
  const w = a.w + (b.w - a.w) * t;
  mixHex(out.horizon, worldSky, worldSky, 0);
  mixInto(out.horizon, mixHex(tmp, a.horizon, b.horizon, t), w);
  mixHex(out.top, worldSky, DEEP, DEEP_MIX);
  mixInto(out.top, mixHex(tmp, a.top, b.top, t), w);
  return out;
}
