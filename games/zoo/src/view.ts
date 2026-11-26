// Het beeld: isometrische camera, tegels, hekken, voerbakken en het voorbeeld van wat je gaat plaatsen.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  FENCE_COLORS, BEDS, SHOPS, SHOP_SIZE, SHOP_DEEP, onEdge, shopSpan, TERRAINS, type BedKind, type FoodId, type ShopKind, type WorldId, TOYS, type ToyKind, DECORS, type DecorKind, type TroughKind,
  RESTAURANT_TABLES, SHOW_ROWS, STALLS, STRING_HEIGHT, STRING_REACH, TOWER_TOP, TOY_LIFT, TOY_PIVOT, SWING, TRAIN, isPath, type Season, type Sky, PROP, PROPS, type PropKind,
} from './data';
import { BUMPER, CAROUSEL, CAROUSEL_SEATS, FERRIS, FOUNTAIN, carouselAt, carouselLift, ferrisAngle, ferrisSway, fountainJet, newRide, type RideState } from './rides';
import { BASE_LAND, Grid, H, SIDES, W, edgeKey, tileXY, type Edge, type Land, type Side } from './grid';
import { roadside } from './road';
import { CABLE, cableHeight } from './cable';
import { Ground, aroundTexture } from './ground';
import { partyHue } from './party';
import { WALK } from './walk';
import { SkyDome, useHaze } from './sky';
import { dayLook, newLook } from './daylight';

/**
 * Het licht: tone mapping laat felle plekken zacht aflopen in plaats van hard wit af te kappen. Neutral houdt de
 * gewone kleuren zoals ze zijn (ACES en AgX maken ze bleker en bruiner); de belichting houdt de helderheid gelijk.
 */
const TONE = { mapping: THREE.NeutralToneMapping, exposure: 1.1 };
/** De lucht bovenin bij regen en 's nachts (de horizon gebruikt RAIN_SKY en NIGHT_SKY), en de wolken 's nachts. */
const RAIN_TOP = new THREE.Color(0x8494a6);
const NIGHT_TOP = new THREE.Color(0x0a1233);
const NIGHT_CLOUD = new THREE.Color(0x34406e);
const WHITE = new THREE.Color(0xffffff);
/** Zoveel van de kleur van de horizon krijgen de wolken mee (roze 's ochtends, goud 's avonds). */
const CLOUD_TINT = 0.3;
/** Voor de nacht in het spel is het altijd dag: dan is het dit uur (mooi middaglicht). */
export const DAY_HOUR = 13;
import { THING_SHADE, shadeGroup, shadeGrey } from './shade';

const SQRT2 = Math.SQRT2;
const SQRT3 = Math.sqrt(3);
const OK_COLOR = 0x7dff7d;
const BAD_COLOR = 0xff5a4a;

function boxAt(w: number, h: number, d: number, x: number, y: number, z: number): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  return g;
}

const ball = (r: number, x: number, y: number, z: number): THREE.BufferGeometry => new THREE.IcosahedronGeometry(r, 1).translate(x, y, z);
const tube = (rTop: number, rBottom: number, h: number, x: number, y: number, z: number): THREE.BufferGeometry =>
  new THREE.CylinderGeometry(rTop, rBottom, h, 10).translate(x, y, z);
const cone = (r: number, h: number, x: number, y: number, z: number, sides = 8, down = false): THREE.BufferGeometry => {
  const g = new THREE.ConeGeometry(r, h, sides);
  if (down) g.rotateX(Math.PI);
  if (sides === 4) g.rotateY(Math.PI / 4);
  return g.translate(x, y, z);
};
/** Voegt vormen samen, ook als ronde (zonder index) en hoekige (met index) door elkaar staan. */
const merge = (geos: THREE.BufferGeometry[]): THREE.BufferGeometry =>
  mergeGeometries(geos.some(g => !g.index) ? geos.map(g => (g.index ? g.toNonIndexed() : g)) : geos)!;
/** Geeft een vorm een eigen kleur per hoekpunt (voor PAINT_MAT). */
const paint = (geo: THREE.BufferGeometry, hex: number): THREE.BufferGeometry => {
  const c = new THREE.Color(hex), n = geo.getAttribute('position').count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    a[i * 3] = c.r;
    a[i * 3 + 1] = c.g;
    a[i * 3 + 2] = c.b;
  }
  return geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
};
type P3 = [number, number, number];
const UP = new THREE.Vector3(0, 1, 0);
/** Een balk van punt a naar punt b, `t` dik. */
const beam = (t: number, a: P3, b: P3): THREE.BufferGeometry => {
  const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]), len = d.length();
  const q = new THREE.Quaternion().setFromUnitVectors(UP, d.normalize());
  return new THREE.BoxGeometry(t, len, t).applyQuaternion(q).translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
};
/** Een vast toevalsgetal tussen 0 en 1 bij een plek: dezelfde plek geeft altijd hetzelfde. */
const hash = (x: number, y: number, k = 0): number => {
  const s = Math.sin(x * 127.1 + y * 311.7 + k * 74.7) * 43758.5453;
  return s - Math.floor(s);
};

/** Een bol die je kunt uitrekken of platdrukken: een ei, een kruin, een pompoen. */
const blob = (r: number, sx: number, sy: number, sz: number, x: number, y: number, z: number, detail = 1): THREE.BufferGeometry =>
  new THREE.IcosahedronGeometry(r, detail).scale(sx, sy, sz).translate(x, y, z);
/** Een heel klein bolletje met weinig vlakjes: een oogje, een knoop, een besje, een lampje. */
const dot = (r: number, x: number, y: number, z: number): THREE.BufferGeometry => new THREE.IcosahedronGeometry(r, 0).translate(x, y, z);
/** Een hoekige kei van `w` bij `h` bij `d`, een stukje gedraaid; zijn onderkant ligt op hoogte `y`. */
const stone = (w: number, h: number, d: number, x: number, y: number, z: number, turn = 0): THREE.BufferGeometry =>
  new THREE.DodecahedronGeometry(0.535, 0).rotateY(turn).scale(w, h, d).translate(x, y + h / 2, z);
/** Een schijf of zuil met platte kanten (een rotsplaat, een stronk): `sides` kanten, het midden op hoogte `y`. */
const prism = (rTop: number, rBottom: number, h: number, x: number, y: number, z: number, sides = 7, turn = 0): THREE.BufferGeometry => {
  const g = new THREE.CylinderGeometry(rTop, rBottom, h, sides).rotateY(turn).toNonIndexed();
  g.computeVertexNormals();
  return g.translate(x, y, z);
};
/** Een ronde staaf van punt a naar punt b (een tak, een steel, een touw); `rEnd` is de dikte bij b. */
const rod = (r: number, a: P3, b: P3, sides = 6, rEnd = r): THREE.BufferGeometry => {
  const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]), len = d.length();
  const q = new THREE.Quaternion().setFromUnitVectors(UP, d.normalize());
  return new THREE.CylinderGeometry(rEnd, r, len, sides).applyQuaternion(q).translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
};
/**
 * Voegt vormen in verschillende kleuren samen tot één onderdeel (voor PAINT_MAT of MATTE_MAT): elk rijtje begint
 * met zijn kleur. Zo krijgt een model een tweede tint of een randje zonder dat er een onderdeel bij komt.
 */
const painted = (...groups: [number, ...THREE.BufferGeometry[]][]): THREE.BufferGeometry =>
  merge(groups.flatMap(([hex, ...geos]) => geos.map(g => paint(g, hex))));
/**
 * Kleurt een ronde vorm in banen rond het punt (cx, cz), zoals een parasol of een tentdak: elk vlakje krijgt de
 * kleur van zijn baan. Met evenveel banen als de vorm kanten heeft, vallen de banen precies op de kanten.
 */
const striped = (geo: THREE.BufferGeometry, colors: number[], bands: number, cx = 0, cz = 0): THREE.BufferGeometry => {
  const g = geo.index ? geo.toNonIndexed() : geo, pos = g.getAttribute('position'), a = new Float32Array(pos.count * 3), c = new THREE.Color();
  for (let i = 0; i < pos.count; i += 3) {
    const x = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3 - cx, z = (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3 - cz;
    const band = Math.floor(((Math.atan2(x, z) / (Math.PI * 2) + 1) % 1) * bands) % bands;
    c.setHex(colors[band % colors.length]);
    for (let k = 0; k < 3; k++) a.set([c.r, c.g, c.b], (i + k) * 3);
  }
  return g.setAttribute('color', new THREE.BufferAttribute(a, 3));
};
/**
 * Eén bloem op (x, y, z): vijf ronde blaadjes rond een hartje; r is hoe groot hij is. Hij kijkt omhoog, of met
 * tilt een kwartslag (een halve pi) naar voren.
 */
const bloom = (x: number, y: number, z: number, color: number, r = 0.075, tilt = 0): THREE.BufferGeometry[] => [
  ...[0, 1, 2, 3, 4].map(i => {
    const a = (i * Math.PI * 2) / 5 + x * 9;
    return paint(blob(r * 0.52, 1, 0.5, 1, Math.cos(a) * r * 0.62, 0, Math.sin(a) * r * 0.62, 0), color);
  }),
  paint(blob(r * 0.42, 1, 0.85, 1, 0, r * 0.2, 0, 0), color === 0xffd23f ? 0xf08a24 : 0xffd23f),
].map(g => g.rotateX(tilt).translate(x, y, z));
/** Een bos bloemen als één onderdeel (voor PAINT_MAT): per bloem de plek, de kleur en zo nodig de kanteling. */
const blooms = (spots: [number, number, number, number, number?][], r = 0.075): THREE.BufferGeometry =>
  merge(spots.flatMap(([x, y, z, color, tilt]) => bloom(x, y, z, color, r, tilt)));
// Een hekdeel loopt van (0,0,0) naar (1,0,0). Op elke paal zit een puntig kapje.
const postCap = (x: number, top: number): THREE.BufferGeometry => cone(0.1, 0.07, x, top + 0.035, 0, 4);
const FENCE_GEO = mergeGeometries([
  boxAt(0.13, 0.5, 0.13, 0, 0.25, 0),
  boxAt(0.13, 0.5, 0.13, 1, 0.25, 0),
  boxAt(1, 0.08, 0.06, 0.5, 0.17, 0),
  boxAt(1, 0.08, 0.06, 0.5, 0.37, 0),
  postCap(0, 0.5),
  postCap(1, 0.5),
])!;
// Een houten hek slijt in drie fases: de bovenste plank zakt scheef, dan hangt hij los, dan ligt het hek half plat.
// Bij elke fase is het hout donkerder.
const plank = (len: number, x: number, y: number, tilt: number): THREE.BufferGeometry => new THREE.BoxGeometry(len, 0.08, 0.06).rotateZ(tilt).translate(x, y, 0);
const WORN_GEOS = [
  FENCE_GEO,
  mergeGeometries([boxAt(0.13, 0.5, 0.13, 0, 0.25, 0), boxAt(0.13, 0.5, 0.13, 1, 0.25, 0), plank(1, 0.5, 0.17, 0), plank(1, 0.5, 0.35, 0.08), postCap(0, 0.5), postCap(1, 0.5)])!,
  mergeGeometries([boxAt(0.13, 0.5, 0.13, 0, 0.25, 0), boxAt(0.13, 0.46, 0.13, 1, 0.23, 0), plank(1, 0.5, 0.17, -0.04), plank(0.72, 0.33, 0.25, -0.36), postCap(0, 0.5), postCap(1, 0.46)])!,
  mergeGeometries([boxAt(0.13, 0.5, 0.13, 0, 0.25, 0), boxAt(0.13, 0.26, 0.13, 1, 0.13, 0), plank(0.95, 0.52, 0.05, 0.03), plank(0.6, 0.3, 0.17, -0.5), postCap(0, 0.5)])!,
];
// De twee planken van een hek dat een sterk dier omduwt: die vallen om (zie `topple`)
const FALL_GEO = mergeGeometries([plank(1, 0.5, 0.17, 0), plank(1, 0.5, 0.37, 0)])!;
// De poort is van hetzelfde hout, maar hoger en met een deurtje: drie spijlen, een schoor en een klink.
const GATE_GEO = mergeGeometries([
  boxAt(0.15, 0.72, 0.15, 0, 0.36, 0),
  boxAt(0.15, 0.72, 0.15, 1, 0.36, 0),
  boxAt(1.15, 0.1, 0.15, 0.5, 0.75, 0),
  boxAt(0.82, 0.07, 0.06, 0.5, 0.12, 0),
  boxAt(0.82, 0.07, 0.06, 0.5, 0.42, 0),
  boxAt(0.07, 0.36, 0.06, 0.2, 0.27, 0),
  boxAt(0.07, 0.36, 0.06, 0.5, 0.27, 0),
  boxAt(0.07, 0.36, 0.06, 0.8, 0.27, 0),
  beam(0.045, [0.12, 0.13, 0.035], [0.88, 0.41, 0.035]),
  boxAt(0.1, 0.05, 0.1, 0.86, 0.3, 0),
  boxAt(0.2, 0.05, 0.19, 0, 0.825, 0),
  boxAt(0.2, 0.05, 0.19, 1, 0.825, 0),
])!;
// Stenen muur voor sterke dieren: laag en smal genoeg om eroverheen het verblijf in te kijken.
const WALL_GEO = mergeGeometries([
  boxAt(1.06, 0.3, 0.13, 0.5, 0.15, 0),
  boxAt(0.2, 0.09, 0.16, 0.12, 0.345, 0),
  boxAt(0.2, 0.09, 0.16, 0.5, 0.345, 0),
  boxAt(0.2, 0.09, 0.16, 0.88, 0.345, 0),
  // een bredere voet en een paar stenen die net uitsteken
  boxAt(1.06, 0.06, 0.17, 0.5, 0.03, 0),
  boxAt(0.22, 0.08, 0.15, 0.2, 0.14, 0),
  boxAt(0.2, 0.08, 0.15, 0.62, 0.21, 0),
  boxAt(0.18, 0.08, 0.15, 0.86, 0.12, 0),
  boxAt(0.16, 0.07, 0.15, 0.4, 0.24, 0),
])!;
// Glazen wand van een aquarium: een lijst met een ruit erin. De ruit is een los, doorzichtig onderdeel.
const GLASS_FRAME_GEO = mergeGeometries([
  boxAt(0.08, 0.74, 0.08, 0, 0.37, 0),
  boxAt(0.08, 0.74, 0.08, 1, 0.37, 0),
  boxAt(1, 0.07, 0.08, 0.5, 0.035, 0),
  boxAt(1, 0.06, 0.07, 0.5, 0.71, 0),
])!;
const GLASS_PANE_GEO = boxAt(0.92, 0.62, 0.025, 0.5, 0.38, 0);
// Hoog net voor klimmers, vliegers en springers: hoge palen met gaas ertussen.
const NET_GEO = mergeGeometries([
  boxAt(0.1, 0.92, 0.1, 0, 0.46, 0),
  boxAt(0.1, 0.92, 0.1, 1, 0.46, 0),
  boxAt(1, 0.06, 0.06, 0.5, 0.89, 0),
  boxAt(1, 0.05, 0.05, 0.5, 0.06, 0),
  ...[0.34, 0.62].map(y => boxAt(1, 0.018, 0.018, 0.5, y, 0)),
  ...[0.25, 0.5, 0.75].map(x => boxAt(0.018, 0.82, 0.018, x, 0.47, 0)),
])!;
const TROUGH_GEO = mergeGeometries([
  boxAt(0.8, 0.06, 0.48, 0, 0.03, 0),
  boxAt(0.8, 0.2, 0.06, 0, 0.13, -0.21),
  boxAt(0.8, 0.2, 0.06, 0, 0.13, 0.21),
  boxAt(0.06, 0.2, 0.36, -0.37, 0.13, 0),
  boxAt(0.06, 0.2, 0.36, 0.37, 0.13, 0),
  // hoekpalen die net boven de rand uitsteken, en twee latten eronder
  ...[-1, 1].flatMap(x => [-1, 1].map(z => boxAt(0.075, 0.27, 0.075, x * 0.385, 0.135, z * 0.225))),
  boxAt(0.09, 0.03, 0.57, -0.24, 0.015, 0),
  boxAt(0.09, 0.03, 0.57, 0.24, 0.015, 0),
])!;
const STRAW_MAT = new THREE.MeshStandardMaterial({ color: 0xe9d05a, roughness: 1 });
const ROOF_MAT = new THREE.MeshStandardMaterial({ color: 0xc0523f, roughness: 0.9 });
const FENCE_MAT = new THREE.MeshStandardMaterial({ color: 0xc58a4b, roughness: 0.9 });
const WOOD_MAT = new THREE.MeshStandardMaterial({ color: 0xa8743f, roughness: 0.9 });
const WORN_MATS = [FENCE_MAT, ...[0xa9743d, 0x8a5a2e, 0x694120].map(color => new THREE.MeshStandardMaterial({ color, roughness: 1 }))];
const STONE_MAT = new THREE.MeshStandardMaterial({ color: 0xa9adb3, roughness: 1 });
const ROCK_MAT = new THREE.MeshStandardMaterial({ color: 0x8f949c, roughness: 1 });
const LEAF_MAT = new THREE.MeshStandardMaterial({ color: 0x5fa544, roughness: 1 });
const WHITE_MAT = new THREE.MeshStandardMaterial({ color: 0xf7f4ec, roughness: 0.9 });
/** De sterren van het park op het bord bij de ingang: goud als je ze hebt, anders grijs. */
const STAR_GOLD_MAT = new THREE.MeshStandardMaterial({ color: 0xffd23f, roughness: 0.5, emissive: 0x6b4a00, emissiveIntensity: 0.35 });
const STAR_GREY_MAT = new THREE.MeshStandardMaterial({ color: 0xc9ced4, roughness: 0.9 });
/** Steeltjes van bloemen: blijven groen, ook in de herfst en de winter. */
const STEM_MAT = new THREE.MeshStandardMaterial({ color: 0x5fa544, roughness: 1 });
/** Voor vormen met een eigen kleur per hoekpunt (zie `paint`): zo is een bont ding toch één onderdeel. */
const PAINT_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 });
/** Hetzelfde, maar dof: voor hout, steen, stro en alles wat niet glimt. */
const MATTE_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 });

const NET_MAT = new THREE.MeshStandardMaterial({ color: 0x3f7f6b, roughness: 0.7 });
const GLASS_FRAME_MAT = new THREE.MeshStandardMaterial({ color: 0xd9e6ee, roughness: 0.5 });
const GLASS_MAT = new THREE.MeshStandardMaterial({ color: 0xbfe6f7, roughness: 0.15, transparent: true, opacity: 0.32, depthWrite: false });
/**
 * Het water in een bak van glas: een doorzichtig blok per tegel. De kleur zit per tegel in het blok zelf (wit
 * materiaal keer de kleur van de tegel): helder blauw, en hoe viezer het water, hoe groener en grijzer.
 */
const TANK_MAT = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2, transparent: true, opacity: 0.42, depthWrite: false });
const TANK_CLEAR = new THREE.Color(0x4fb4e6), TANK_MURKY = new THREE.Color(0x7d8f63);
/** Vuiltjes die in vies water zweven: bruingroene vlokjes, hooguit SPECKS per tegel. */
const SPECK_MAT = new THREE.MeshStandardMaterial({ color: 0x5e5a32, roughness: 1 });
const SPECK_GEO = new THREE.IcosahedronGeometry(0.03, 0);
const SPECKS = 4;
const DARK_MAT = new THREE.MeshStandardMaterial({ color: 0x5a3d22, roughness: 1 });
const std = (color: number, roughness = 0.9): THREE.MeshStandardMaterial => new THREE.MeshStandardMaterial({ color, roughness });
/** Een tweede, donkerder tint blad; kleurt net als LEAF_MAT mee met de seizoenen. */
const LEAF2 = std(0x468f3e, 1);

/** Een onderdeel van een bouwsel: vorm, materiaal en of het een schaduw geeft. */
type Part = [THREE.BufferGeometry, THREE.Material, boolean?];

// Slaapplekken. Wanden staan alleen aan de achterkant, zodat je het slapende dier blijft zien.
// stro: een dikke laag met een bult in het midden en losse sprieten langs de rand
const strands = (n: number, k: number): THREE.BufferGeometry[] => Array.from({ length: n }, (_, i) => {
  const a = (i / n) * Math.PI * 2 + k, r = 0.26 + hash(i, k) * 0.1;
  return new THREE.BoxGeometry(0.18 + hash(i, k, 1) * 0.1, 0.022, 0.03).rotateY(hash(i, k, 2) * Math.PI).translate(Math.cos(a) * r, 0.071, Math.sin(a) * r);
});
const STRAW_GEO = painted(
  [0xdcbf48, boxAt(0.86, 0.06, 0.86, 0, 0.03, 0)],
  [0xe9d05a, prism(0.3, 0.38, 0.07, 0.02, 0.095, -0.01, 8, 0.3)],
  [0xf6e58a, ...strands(7, 0.4)],
  [0xc9a93a, ...strands(6, 2.1)],
);
// het stalletje: wanden van planken links en achter, palen op de hoeken en een afdakje boven de wanden
const wallPlanks = (back: boolean, tone: number): THREE.BufferGeometry[] => [0, 1, 2, 3].filter(i => i % 2 === tone).map(i =>
  back ? boxAt(0.94, 0.15, 0.06, 0, 0.08 + i * 0.155, -0.44) : boxAt(0.06, 0.15, 0.94, -0.44, 0.08 + i * 0.155, 0));
const SHED_WALL_GEO = painted(
  [0xa8743f, ...wallPlanks(true, 0), ...wallPlanks(false, 1)],
  [0x97673a, ...wallPlanks(true, 1), ...wallPlanks(false, 0)],
  [0x80552c, ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([x, z]) => boxAt(0.09, 0.64, 0.09, x * 0.44, 0.32, z * 0.44)), boxAt(0.9, 0.05, 0.05, 0, 0.615, 0.44), boxAt(0.05, 0.05, 0.9, 0.44, 0.615, 0)],
);
const SHED_ROOF_GEO = painted(
  [0xc0523f, boxAt(1.08, 0.07, 0.5, 0, 0.675, -0.3), boxAt(0.5, 0.07, 1.08, -0.3, 0.675, 0)],
  // een donkere nok langs de buitenrand en een lichte lijst langs de binnenrand
  [0x9c3f30, boxAt(1.1, 0.05, 0.08, 0, 0.72, -0.51), boxAt(0.08, 0.05, 1.1, -0.51, 0.72, 0)],
  [0xe8d2a8, boxAt(0.6, 0.06, 0.03, 0.245, 0.67, -0.04), boxAt(0.03, 0.06, 0.6, -0.04, 0.67, 0.245)],
);
// een platte rots in twee lagen: de bovenkant is vlak, zodat een dier erop kan liggen
const ROCK_GEO = painted(
  [0x8f949c, prism(0.44, 0.49, 0.12, 0, 0.06, 0, 7, 0.2).scale(1, 1, 0.92)],
  [0xa0a5ad, prism(0.36, 0.41, 0.1, 0.01, 0.17, -0.01, 7, 0.9).scale(1, 1, 0.9)],
  [0x7d828a, stone(0.2, 0.16, 0.18, 0.37, -0.03, 0.33, 0.4), stone(0.14, 0.11, 0.13, -0.39, -0.02, 0.35, 1.1), stone(0.13, 0.1, 0.12, 0.4, -0.02, -0.35, 2)],
  // een plukje mos
  [0x86b85c, blob(0.1, 1.3, 0.3, 1, -0.26, 0.215, -0.12, 0), blob(0.07, 1.2, 0.3, 1, -0.16, 0.218, 0.04, 0)],
);
// schaduwboom: de stam staat in de hoek, de kruin hangt hoog boven de tegel
const TRUNK_GEO = merge([
  new THREE.CylinderGeometry(0.05, 0.085, 1.1, 7).translate(-0.36, 0.55, -0.36),
  rod(0.035, [-0.36, 0.78, -0.36], [-0.12, 1.12, -0.14], 5, 0.025),
  rod(0.03, [-0.36, 0.9, -0.36], [-0.5, 1.12, -0.2], 5, 0.02),
  prism(0.09, 0.13, 0.08, -0.36, 0.04, -0.36, 6),
]);
const CANOPY_GEO = merge([blob(0.5, 1, 0.4, 1, -0.16, 1.24, -0.16), blob(0.3, 1, 0.5, 1, -0.3, 1.4, -0.26), blob(0.26, 1, 0.5, 1, 0.04, 1.36, -0.04)]);
const CANOPY_LOW_GEO = merge([blob(0.3, 1, 0.42, 1, -0.44, 1.16, 0.1), blob(0.28, 1, 0.42, 1, 0.1, 1.15, -0.44), blob(0.2, 1, 0.45, 1, 0.2, 1.2, 0.1)]);
// nest: een ronde krans van takjes met een bedje van stro en drie eieren
const NEST_GEO = painted(
  [0xb98a4a, new THREE.TorusGeometry(0.29, 0.1, 5, 11).rotateX(Math.PI / 2).scale(1, 0.85, 1).translate(0, 0.085, 0)],
  [0x9c7238, new THREE.TorusGeometry(0.3, 0.055, 4, 9).rotateX(Math.PI / 2).rotateY(0.3).translate(0, 0.15, 0)],
  [0xe2c766, tube(0.25, 0.25, 0.05, 0, 0.035, 0)],
  [0x7d5527, ...Array.from({ length: 7 }, (_, i): THREE.BufferGeometry => {
    const a = i * 0.9 + 0.2, b = a + 0.55;
    return rod(0.014, [Math.cos(a) * 0.3, 0.1, Math.sin(a) * 0.3], [Math.cos(b) * 0.46, 0.13 + (i % 3) * 0.03, Math.sin(b) * 0.46], 4);
  })],
);
const egg = (x: number, z: number, tilt: number): THREE.BufferGeometry => new THREE.IcosahedronGeometry(0.062, 1).scale(1, 1.32, 1).rotateZ(tilt).translate(x, 0.115, z);
const EGG_GEO = painted([0xfaf4e4, egg(-0.1, 0.04, 0.45), egg(0.08, -0.07, -0.35)], [0xe9cfa6, egg(0.03, 0.11, 0.9)]);
const CAVE_FLOOR_GEO = boxAt(0.84, 0.03, 0.84, 0, 0.015, 0);
// grot: wanden links en achter met een dak van platen, en ronde keien erop en ertegen
const CAVE_GEO = painted(
  [0x8f949c, boxAt(0.98, 0.62, 0.16, 0, 0.31, -0.41), boxAt(0.16, 0.62, 0.9, -0.41, 0.31, 0.04), boxAt(0.18, 0.62, 0.18, 0.4, 0.31, -0.4)],
  [0x9ca1a9, boxAt(1.06, 0.18, 0.62, -0.02, 0.7, -0.2), boxAt(0.6, 0.18, 0.5, -0.24, 0.7, 0.26)],
  [0xa9adb3, stone(0.6, 0.26, 0.46, -0.12, 0.76, -0.22, 0.3), stone(0.34, 0.2, 0.3, 0.3, 0.76, -0.3, 1.2), stone(0.3, 0.18, 0.3, -0.3, 0.76, 0.3, 2)],
  [0x7d828a, stone(0.2, 0.4, 0.2, -0.4, -0.05, 0.4, 0.5), stone(0.22, 0.36, 0.22, 0.39, -0.05, -0.36, 1.4), stone(0.16, 0.16, 0.14, 0.4, -0.03, -0.16, 0.2)],
  [0x86b85c, blob(0.15, 1.3, 0.28, 1, 0.16, 0.795, -0.02, 0), blob(0.1, 1.2, 0.3, 1, -0.36, 0.795, 0.42, 0)],
);
// klimboom: een stam met twee plankjes op schoren, een tak, een touw met een stokje en een pluk blad bovenop
const CLIMB_GEO = painted(
  [0xa8743f, prism(0.075, 0.105, 1.25, -0.3, 0.625, -0.3, 7), prism(0.11, 0.15, 0.07, -0.3, 0.035, -0.3, 7, 0.4), rod(0.04, [-0.3, 1.0, -0.3], [-0.52, 1.2, -0.12], 5, 0.025)],
  [0xc58a4b, boxAt(0.78, 0.06, 0.36, 0.02, 0.6, -0.3), boxAt(0.36, 0.06, 0.78, -0.3, 0.9, 0.02), rod(0.024, [0.2, 0.17, -0.3], [0.44, 0.17, -0.3], 6)],
  [0x80552c, beam(0.04, [-0.26, 0.36, -0.3], [0.2, 0.58, -0.3]), beam(0.04, [-0.3, 0.66, -0.26], [-0.3, 0.88, 0.2])],
  [0xe8dcc0, rod(0.016, [0.32, 0.58, -0.3], [0.32, 0.17, -0.3], 5), ball(0.03, 0.32, 0.2, -0.3)],
);
const CLIMB_LEAF_GEO = merge([blob(0.3, 1, 0.62, 1, -0.3, 1.38, -0.3), blob(0.2, 1, 0.7, 1, -0.14, 1.34, -0.42), blob(0.17, 1, 0.7, 1, -0.44, 1.5, -0.24), blob(0.15, 1, 0.7, 1, -0.54, 1.24, -0.1)]);
const starArm = (i: number): THREE.BufferGeometry =>
  new THREE.ConeGeometry(0.03, 0.1, 4).rotateZ(-Math.PI / 2).translate(0.05, 0, 0).scale(1, 0.4, 1).rotateY((i * Math.PI * 2) / 5).translate(-0.04, 0.09, 0.27);
const BED_PARTS: Record<BedKind, Part[]> = {
  straw: [[STRAW_GEO, MATTE_MAT, false]],
  shed: [[STRAW_GEO, MATTE_MAT, false], [SHED_WALL_GEO, MATTE_MAT], [SHED_ROOF_GEO, MATTE_MAT]],
  rock: [[ROCK_GEO, MATTE_MAT]],
  shade: [[TRUNK_GEO, WOOD_MAT], [CANOPY_GEO, LEAF_MAT], [CANOPY_LOW_GEO, LEAF2]],
  nest: [[NEST_GEO, MATTE_MAT], [EGG_GEO, PAINT_MAT]],
  cave: [[CAVE_FLOOR_GEO, DARK_MAT, false], [CAVE_GEO, MATTE_MAT]],
  climb: [[CLIMB_GEO, MATTE_MAT], [CLIMB_LEAF_GEO, LEAF_MAT]],
  // koraal: een platte steen met roze takken, oranje buizen, gele bollen en een zeester; laag genoeg om onder water te staan
  coral: [
    [merge([prism(0.4, 0.46, 0.08, 0, 0.04, 0, 8).scale(1, 1, 0.85), stone(0.2, 0.12, 0.16, 0.3, 0.02, 0.24, 0.6)]), ROCK_MAT],
    [merge([
      rod(0.035, [-0.22, 0.06, -0.12], [-0.22, 0.3, -0.12], 6, 0.028), rod(0.026, [-0.22, 0.2, -0.12], [-0.08, 0.36, -0.14], 5, 0.02), rod(0.024, [-0.22, 0.24, -0.12], [-0.33, 0.38, -0.06], 5, 0.02),
      ball(0.04, -0.22, 0.32, -0.12), ball(0.036, -0.08, 0.38, -0.14), ball(0.034, -0.33, 0.4, -0.06),
      rod(0.03, [0.26, 0.06, 0.1], [0.26, 0.24, 0.1], 6, 0.024), rod(0.022, [0.26, 0.16, 0.1], [0.34, 0.3, 0.16], 5, 0.018), ball(0.034, 0.26, 0.26, 0.1), ball(0.03, 0.34, 0.32, 0.16),
    ]), std(0xf06aa6, 0.8)],
    [merge([tube(0.055, 0.035, 0.24, 0.08, 0.2, -0.2), tube(0.045, 0.03, 0.17, 0.18, 0.165, -0.14), tube(0.04, 0.028, 0.13, 0, 0.145, -0.26), tube(0.045, 0.03, 0.16, -0.22, 0.16, 0.2), tube(0.035, 0.025, 0.1, -0.13, 0.13, 0.25)]), std(0xf08a24, 0.8)],
    [merge([blob(0.11, 1, 0.72, 1, 0.02, 0.13, 0.08), blob(0.065, 1, 0.75, 1, 0.14, 0.11, 0.2), ...[0, 1, 2, 3, 4].map(starArm)]), std(0xffd23f, 0.8)],
  ],
};

// Winkels: gebouwen van 2 bij 2 tegels, en losse dingen als een bankje, bloemen en een afvalbak.
const BENCH_GEO = mergeGeometries([
  // de zitting van drie latten (de bovenkant blijft op 0,27) en de leuning van twee
  boxAt(0.8, 0.04, 0.085, 0, 0.25, -0.075),
  boxAt(0.8, 0.04, 0.085, 0, 0.25, 0.02),
  boxAt(0.8, 0.04, 0.085, 0, 0.25, 0.115),
  boxAt(0.8, 0.09, 0.035, 0, 0.4, -0.125),
  boxAt(0.8, 0.09, 0.035, 0, 0.52, -0.135),
  ...[-0.33, 0.33].flatMap(x => [
    boxAt(0.06, 0.58, 0.06, x, 0.29, -0.1),
    boxAt(0.06, 0.24, 0.06, x, 0.12, 0.12),
    boxAt(0.05, 0.04, 0.24, x, 0.21, 0.01),
  ]),
  // de armleuningen
  ...[-0.385, 0.385].flatMap(x => [boxAt(0.055, 0.035, 0.3, x, 0.4, 0.01), boxAt(0.05, 0.16, 0.05, x, 0.31, 0.13)]),
])!;
/**
 * Een marktkraam van 2 tegels breed en 1 tegel diep; het midden is (0, 0). De lange kant aan de voorkant (+z) is
 * waar de gasten staan: daar staat de tafel met de spullen. Vier palen dragen een schuin zeil in banen, voor hoog
 * en achter laag, zodat je de verkoper van elke kant ziet staan. Achterlangs hangt een laag doek in de kleur van
 * de kraam en staan een paar kratten. Muren heeft hij niet. `sign`: of er een plankje op het dak ligt.
 */
function booth(cloth: number, roofA: number, roofB: number, counter: number, sign = true, floor = 0xd8c7ab): Part[] {
  // een baan van het zeil, met aan de voorkant een ronde flap
  const stripes = (from: number): THREE.BufferGeometry =>
    merge([0, 1, 2].flatMap(i => {
      const x = -0.82 + (from + i * 2) * 0.33;
      return [
        new THREE.BoxGeometry(0.33, 0.05, 1.1).rotateX(-0.36).translate(x, 1.42, 0),
        new THREE.CylinderGeometry(0.165, 0.165, 0.03, 10, 1, false, -Math.PI / 2, Math.PI).rotateX(Math.PI / 2).translate(x, 1.6, 0.52),
      ];
    }));
  return [
    [boxAt(1.84, 0.03, 0.9, 0, 0.015, 0), std(floor, 1), false],
    // achterlangs: het doek met een donkere zoom, en kratten met spullen
    [painted(
      [cloth, boxAt(1.7, 0.6, 0.03, 0, 0.36, -0.43)],
      [shade(cloth, 0.72), boxAt(1.7, 0.05, 0.036, 0, 0.66, -0.43), boxAt(1.7, 0.05, 0.036, 0, 0.08, -0.43)],
      [0xc58a4b, boxAt(0.3, 0.2, 0.24, -0.62, 0.13, -0.24), boxAt(0.3, 0.2, 0.24, 0.6, 0.13, -0.24), boxAt(0.26, 0.18, 0.22, 0.62, 0.32, -0.25)],
      [0x97673a, ...[-0.62, 0.6].flatMap(x => [boxAt(0.31, 0.03, 0.25, x, 0.09, -0.24), boxAt(0.31, 0.03, 0.25, x, 0.18, -0.24)])],
      [roofA, boxAt(0.24, 0.05, 0.18, -0.62, 0.25, -0.24)],
    ), MATTE_MAT],
    // de tafel: een kleed tot op de grond, met lichte banen en een donkere zoom
    [painted(
      [counter, boxAt(1.72, 0.34, 0.32, 0, 0.19, 0.3)],
      [shade(counter, 1.3), ...[-0.645, -0.215, 0.215, 0.645].map(x => boxAt(0.3, 0.22, 0.006, x, 0.2, 0.463)), boxAt(0.006, 0.22, 0.2, 0.863, 0.2, 0.3), boxAt(0.006, 0.22, 0.2, -0.863, 0.2, 0.3)],
      [shade(counter, 0.7), boxAt(1.74, 0.04, 0.34, 0, 0.04, 0.3)],
    ), MATTE_MAT],
    [boxAt(1.78, 0.05, 0.38, 0, 0.385, 0.3), WHITE_MAT],
    // het houten frame: vier palen, de latten waar het zeil op ligt, en een plankje op het dak voor het uithangbord
    [merge([
      ...[-0.88, 0.88].flatMap(x => [boxAt(0.07, 1.56, 0.07, x, 0.78, 0.42), boxAt(0.07, 1.25, 0.07, x, 0.625, -0.42), beam(0.05, [x, 1.25, -0.42], [x, 1.57, 0.42])]),
      boxAt(1.76, 0.05, 0.05, 0, 1.56, 0.42), boxAt(1.76, 0.05, 0.05, 0, 1.25, -0.42),
      ...(sign ? [boxAt(0.66, 0.16, 0.5, 0, 1.47, -0.05)] : []),
    ]), WOOD_MAT],
    [stripes(0), std(roofA)],
    [stripes(1), std(roofB)],
  ];
}
/**
 * Zet het grote uithangbord van een kraam op het plankje op het dak. De vormen zijn gemaakt rond z = -0.4 met
 * hun voet op hoogte base; k maakt ze kleiner.
 */
const onRoof = (parts: Part[], base = 1.39, k = 1): Part[] =>
  parts.map(([g, m, shadow]): Part => [g.translate(0, -base, 0.4).scale(k, k, k).translate(0, 1.55, -0.05), m, shadow]);
/** Een kleur een stuk donkerder (k onder 1) of lichter (k boven 1). */
function shade(hex: number, k: number): number {
  return new THREE.Color(hex).multiplyScalar(k).getHex();
}
/** De ballonnen van de ballonnenkraam zitten vast aan de paal rechtsvoor. */
const STALL_TIE: P3 = [0.88, 1.9, 0.42];
/** Een ballon met een knoopje, een glimlichtje en een touwtje naar de top van de paal. */
const balloon = (x: number, y: number, z: number, r: number, color: number): Part => [painted(
  [color, blob(r, 1, 1.18, 1, x, y, z), cone(r * 0.16, r * 0.22, x, y - r * 1.24, z, 5)],
  [0xffffff, blob(r * 0.22, 1, 1.5, 0.5, x + r * 0.42, y + r * 0.5, z + r * 0.62)],
  [0xf7f4ec, rod(0.008, STALL_TIE, [x, y - r * 1.3, z], 4)],
), PAINT_MAT];
/** Een petje op de tafel. */
const cap = (x: number, z: number): THREE.BufferGeometry[] =>
  [new THREE.SphereGeometry(0.1, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2).translate(x, 0.41, z), boxAt(0.13, 0.016, 0.09, x, 0.42, z + 0.12)];

const SHOP_PARTS: Record<ShopKind, Part[]> = {
  // eetkraam: een rood-wit zeil en een grote hamburger erop
  foodstall: [
    ...booth(0xe9c27a, 0xe0584f, 0xf7f4ec, 0xa8743f),
    // op de tafel: drie puntzakken friet, en een rode en een gele fles
    [painted(
      [0xd8362e, ...[-0.6, -0.3, 0].map(x => new THREE.CylinderGeometry(0.075, 0.045, 0.13, 4).rotateY(Math.PI / 4).translate(x, 0.475, 0.3)), tube(0.035, 0.04, 0.14, 0.5, 0.48, 0.3), cone(0.03, 0.06, 0.5, 0.58, 0.3)],
      [0xffd23f, ...[-0.6, -0.3, 0].flatMap(x => [boxAt(0.025, 0.09, 0.025, x - 0.03, 0.56, 0.3), boxAt(0.025, 0.12, 0.025, x, 0.57, 0.31), boxAt(0.025, 0.08, 0.025, x + 0.03, 0.555, 0.29)]), tube(0.035, 0.04, 0.14, 0.66, 0.48, 0.3), cone(0.03, 0.06, 0.66, 0.58, 0.3)],
    ), PAINT_MAT],
    // op het dak (wiegt, zie SHOP_BOB): de hamburger. Eerst het onderste broodje met vlees, kaas, tomaat en sla,
    // dan het bolle broodje met sesamzaadjes erbovenop.
    ...onRoof([
      [painted(
        [0xe2a85a, tube(0.3, 0.27, 0.1, 0, 1.44, -0.4)],
        [0x7a4a22, tube(0.33, 0.33, 0.09, 0, 1.535, -0.4)],
        [0xffd23f, new THREE.BoxGeometry(0.5, 0.02, 0.5).rotateY(Math.PI / 4).translate(0, 1.59, -0.4)],
        [0xe0453a, tube(0.29, 0.29, 0.04, 0, 1.62, -0.4)],
        [0x6cc04a, new THREE.CylinderGeometry(0.36, 0.33, 0.035, 9).translate(0, 1.657, -0.4)],
      ), PAINT_MAT],
      [painted(
        [0xe2a85a, new THREE.SphereGeometry(0.31, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.72, 1).translate(0, 1.675, -0.4)],
        [0xfff3d0, ...[[0, 0], [0.9, 0.5], [2.2, 0.55], [3.5, 0.5], [4.8, 0.55], [5.6, 0.95], [1.6, 1.0], [3.0, 1.05]].map(([turn, down]) =>
          blob(0.026, 1.5, 0.5, 0.8, 0, 0, 0, 0).rotateY(-turn).translate(Math.cos(turn) * Math.sin(down) * 0.3, 1.675 + Math.cos(down) * 0.31 * 0.72, -0.4 + Math.sin(turn) * Math.sin(down) * 0.3))],
      ), PAINT_MAT],
    ]),
  ],
  // drinkkraam: een blauw zeil en een grote gestreepte beker met rietje erop
  drinkstall: [
    ...booth(0xf4f1e8, 0x4a90e2, 0x9fd8f5, 0x4a90e2),
    // op de tafel: drie bekers met een gekleurd deksel en een rietje, en twee flessen
    [painted(
      [0xf7f4ec, ...[-0.6, -0.3, 0].map(x => tube(0.06, 0.045, 0.14, x, 0.48, 0.3))],
      [0xe0584f, tube(0.064, 0.064, 0.022, -0.6, 0.56, 0.3), boxAt(0.014, 0.1, 0.014, -0.28, 0.61, 0.3), boxAt(0.014, 0.1, 0.014, 0.02, 0.61, 0.3)],
      [0xf08a24, tube(0.064, 0.064, 0.022, -0.3, 0.56, 0.3), boxAt(0.014, 0.1, 0.014, -0.58, 0.61, 0.3), tube(0.045, 0.05, 0.16, 0.5, 0.49, 0.3), tube(0.02, 0.03, 0.06, 0.5, 0.6, 0.3)],
      [0x6cc04a, tube(0.064, 0.064, 0.022, 0, 0.56, 0.3), tube(0.045, 0.05, 0.16, 0.66, 0.49, 0.3), tube(0.02, 0.03, 0.06, 0.66, 0.6, 0.3)],
    ), PAINT_MAT],
    ...onRoof([
      [striped(new THREE.CylinderGeometry(0.24, 0.17, 0.5, 10), [0xf7f4ec, 0xe0584f], 10).translate(0, 1.64, -0.4), PAINT_MAT],
      [merge([tube(0.26, 0.26, 0.05, 0, 1.91, -0.4), tube(0.19, 0.24, 0.05, 0, 1.96, -0.4)]), std(0x4a90e2)],
      [mergeGeometries([boxAt(0.06, 0.4, 0.06, 0.07, 2.16, -0.4), new THREE.BoxGeometry(0.06, 0.2, 0.06).translate(0, 0.1, 0).rotateZ(-0.9).translate(0.07, 2.34, -0.4)])!, std(0xe0584f)],
    ]),
  ],
  // ijskraam: een roze zeil met een reuzenijsje op het dak: een wafelhoorn, twee bollen, saus en een kers
  icecream: [
    ...booth(0xffd9e6, 0xf48fb1, 0xf7f4ec, 0xf48fb1),
    // op de tafel: drie ijsjes in een rekje, en drie bakken ijs
    [painted(
      [0xe3b778, ...[-0.6, -0.3, 0].map(x => cone(0.05, 0.14, x, 0.5, 0.3, 6, true))],
      [0xf7f4ec, boxAt(0.8, 0.03, 0.14, -0.3, 0.455, 0.3), dot(0.055, -0.3, 0.6, 0.3), tube(0.07, 0.06, 0.06, 0.78, 0.44, 0.3)],
      [0xffc1d6, dot(0.055, -0.6, 0.6, 0.3), tube(0.07, 0.06, 0.06, 0.62, 0.44, 0.3)],
      [0x8a5a3c, dot(0.055, 0, 0.6, 0.3), tube(0.07, 0.06, 0.06, 0.46, 0.44, 0.3)],
    ), PAINT_MAT],
    ...onRoof([
      [striped(new THREE.ConeGeometry(0.26, 0.6, 8).rotateX(Math.PI), [0xe3b778, 0xd29f5e], 8).translate(0, 1.68, -0.4), PAINT_MAT],
      [merge([ball(0.3, 0, 2.1, -0.4), blob(0.33, 1, 0.3, 1, 0, 1.98, -0.4)]), std(0xffc1d6, 0.6)],
      [painted([0xfff0c9, ball(0.22, 0, 2.45, -0.4)], [0x8a5a3c, blob(0.17, 1, 0.5, 1, 0, 2.6, -0.4)], [0xe0453a, ball(0.065, 0, 2.72, -0.4)]), PAINT_MAT],
    ], 1.38, 0.9),
  ],
  // ballonnenkraam: een paars zeil met een tros ballonnen aan de paal rechtsvoor; elke ballon wiegt los (zie SHOP_BOB)
  balloon: [
    ...booth(0xc9a3e8, 0xb06ad9, 0xffd23f, 0xb06ad9, false),
    [boxAt(0.04, 0.36, 0.04, 0.88, 1.73, 0.42), WHITE_MAT],
    balloon(0.6, 2.36, 0.42, 0.27, 0xe0584f),
    balloon(1.1, 2.42, 0.28, 0.27, 0x4a90e2),
    balloon(0.88, 2.76, 0.48, 0.27, 0xffd23f),
    balloon(0.84, 2.3, 0.7, 0.22, 0x6cc04a),
    // op de tafel: drie ballonnen op een stokje en een fles gas
    [painted(
      [0xe0584f, blob(0.07, 1, 1.15, 1, -0.6, 0.63, 0.3)],
      [0x4a90e2, blob(0.07, 1, 1.15, 1, -0.3, 0.63, 0.3)],
      [0xffd23f, blob(0.07, 1, 1.15, 1, 0, 0.63, 0.3)],
      [0xf7f4ec, ...[-0.6, -0.3, 0].map(x => boxAt(0.012, 0.15, 0.012, x, 0.485, 0.3))],
      [0x8a8f98, tube(0.065, 0.065, 0.26, 0.6, 0.54, 0.3), dot(0.05, 0.6, 0.69, 0.3)],
    ), PAINT_MAT],
  ],
  // hoedjeskraam: een groen zeil met een grote strohoed op het dak en hoedjes op de tafel
  hats: [
    ...booth(0xbfe3a8, 0x6cc04a, 0xf7f4ec, 0x5fa544),
    ...onRoof([
      [merge([tube(0.5, 0.46, 0.05, 0, 1.44, -0.4), new THREE.TorusGeometry(0.5, 0.03, 5, 16).rotateX(Math.PI / 2).translate(0, 1.455, -0.4)]), std(0xe9d05a, 1)],
      [merge([tube(0.25, 0.28, 0.26, 0, 1.59, -0.4), blob(0.25, 1, 0.3, 1, 0, 1.72, -0.4)]), std(0xdcc24e, 1)],
      [merge([tube(0.285, 0.285, 0.08, 0, 1.52, -0.4), blob(0.08, 1.5, 0.8, 0.5, 0.2, 1.53, -0.18), dot(0.04, 0.22, 1.53, -0.15)]), std(0xe0584f)],
    ], 1.415, 0.8),
    // op de tafel: een rode en een blauwe pet, een kroontje en een feesthoedje
    [painted(
      [0xe0584f, ...cap(-0.6, 0.28)],
      [0x4a90e2, ...cap(0, 0.28)],
      [0xffd23f, tube(0.09, 0.09, 0.07, -0.3, 0.445, 0.3), ...[0, 1, 2, 3, 4].map(i => cone(0.03, 0.06, -0.3 + Math.sin(i * 1.257) * 0.075, 0.51, 0.3 + Math.cos(i * 1.257) * 0.075, 4)), dot(0.03, 0.56, 0.64, 0.3)],
      [0xf06aa6, cone(0.09, 0.22, 0.56, 0.52, 0.3)],
    ), PAINT_MAT],
  ],
  // schminktent: een groen-blauw zeil met een groot tijgergezicht op het dak, en potjes schmink en een spiegel op de tafel
  facepaint: [
    ...booth(0xd9f3ef, 0x2bb5a8, 0xf7f4ec, 0x2bb5a8),
    ...onRoof([
      [merge([
        new THREE.CylinderGeometry(0.34, 0.34, 0.07, 18).rotateX(Math.PI / 2).translate(0, 1.76, -0.4),
        ball(0.1, -0.25, 2.03, -0.4), ball(0.1, 0.25, 2.03, -0.4),
      ]), std(0xf3a23c)],
      [painted(
        [0xfff7e0, blob(0.15, 1.2, 0.85, 0.3, 0, 1.64, -0.36)],
        [0x2a1c16,
          boxAt(0.035, 0.11, 0.02, 0, 2.02, -0.36), boxAt(0.03, 0.09, 0.02, -0.12, 1.99, -0.36), boxAt(0.03, 0.09, 0.02, 0.12, 1.99, -0.36),
          ...[-1, 1].flatMap(side => [boxAt(0.11, 0.028, 0.02, side * 0.26, 1.78, -0.36), boxAt(0.1, 0.028, 0.02, side * 0.26, 1.68, -0.36)]),
          dot(0.04, -0.12, 1.84, -0.35), dot(0.04, 0.12, 1.84, -0.35)],
        [0xf06aa6, cone(0.04, 0.04, 0, 1.69, -0.33, 3, true)],
      ), PAINT_MAT],
    ], 1.39, 0.9),
    // op de tafel: vijf potjes schmink, een kwast en een spiegeltje
    [painted(
      [0xe0584f, tube(0.05, 0.05, 0.06, -0.68, 0.44, 0.3)],
      [0x4a90e2, tube(0.05, 0.05, 0.06, -0.54, 0.44, 0.3)],
      [0xffd23f, tube(0.05, 0.05, 0.06, -0.4, 0.44, 0.3)],
      [0x6cc04a, tube(0.05, 0.05, 0.06, -0.26, 0.44, 0.3)],
      [0xa06ad9, tube(0.05, 0.05, 0.06, -0.12, 0.44, 0.3)],
      [0xc58a4b, boxAt(0.02, 0.2, 0.02, 0.12, 0.5, 0.3), boxAt(0.02, 0.1, 0.02, 0.55, 0.47, 0.3)],
      [0xf06aa6, boxAt(0.03, 0.04, 0.03, 0.12, 0.62, 0.3)],
      [0xd8e6ee, new THREE.CylinderGeometry(0.11, 0.11, 0.02, 14).rotateX(Math.PI / 2).translate(0.55, 0.64, 0.3)],
      [0xffd23f, new THREE.TorusGeometry(0.115, 0.016, 5, 16).translate(0.55, 0.64, 0.3)],
    ), PAINT_MAT],
  ],
  // knuffelkraam: een paars zeil met een grote beer erop, met een strikje
  souvenir: [
    ...booth(0xffe08a, 0x7a5cc9, 0xb99be8, 0x7a5cc9),
    ...onRoof([
      [merge([
        ball(0.3, 0, 1.66, -0.4), ball(0.23, 0, 2.08, -0.4), ball(0.09, -0.2, 2.28, -0.4), ball(0.09, 0.2, 2.28, -0.4),
        blob(0.1, 1, 1.5, 1, -0.3, 1.74, -0.34), blob(0.1, 1, 1.5, 1, 0.3, 1.74, -0.34), blob(0.12, 1, 1, 1.3, -0.17, 1.47, -0.2), blob(0.12, 1, 1, 1.3, 0.17, 1.47, -0.2),
      ]), std(0xb07a4a)],
      [painted(
        [0xe3bf94, ball(0.1, 0, 2.03, -0.2), blob(0.2, 1, 1.1, 0.4, 0, 1.64, -0.14), dot(0.05, -0.2, 2.28, -0.34), dot(0.05, 0.2, 2.28, -0.34), blob(0.07, 1, 1, 0.4, -0.17, 1.47, -0.05), blob(0.07, 1, 1, 0.4, 0.17, 1.47, -0.05)],
        [0x3a2a1a, dot(0.035, 0, 2.06, -0.105), dot(0.028, -0.09, 2.14, -0.195), dot(0.028, 0.09, 2.14, -0.195)],
        [0xe0584f, blob(0.07, 1.3, 0.9, 0.6, -0.08, 1.9, -0.17), blob(0.07, 1.3, 0.9, 0.6, 0.08, 1.9, -0.17), dot(0.04, 0, 1.9, -0.15)],
      ), PAINT_MAT],
    ], 1.36, 0.85),
    // op de tafel: een roze varkentje, een geel eendje en een grijs olifantje
    [painted(
      [0xf3a6b8, ball(0.1, -0.55, 0.5, 0.3), dot(0.035, -0.62, 0.59, 0.3), dot(0.035, -0.48, 0.59, 0.3)],
      [0xe58aa0, new THREE.CylinderGeometry(0.04, 0.04, 0.03, 8).rotateX(Math.PI / 2).translate(-0.55, 0.49, 0.395)],
      [0xffd23f, ball(0.09, -0.1, 0.49, 0.3), ball(0.06, -0.1, 0.61, 0.33)],
      [0xf08a24, boxAt(0.05, 0.02, 0.05, -0.1, 0.6, 0.4)],
      [0x9aa0a6, ball(0.1, 0.4, 0.5, 0.3), new THREE.CylinderGeometry(0.07, 0.07, 0.02, 8).rotateX(Math.PI / 2).translate(0.3, 0.53, 0.3), new THREE.CylinderGeometry(0.07, 0.07, 0.02, 8).rotateX(Math.PI / 2).translate(0.5, 0.53, 0.3), boxAt(0.035, 0.1, 0.035, 0.4, 0.45, 0.41)],
      [0x22201c, dot(0.014, -0.59, 0.53, 0.39), dot(0.014, -0.51, 0.53, 0.39), dot(0.012, -0.13, 0.63, 0.38), dot(0.012, -0.07, 0.63, 0.38), dot(0.014, 0.36, 0.54, 0.39), dot(0.014, 0.44, 0.54, 0.39)],
    ), PAINT_MAT],
  ],
  // wc-gebouw met twee deuren; de deuren zelf zijn los en draaien om hun scharnier (zie buildShop)
  toilet: [
    [boxAt(1.84, 0.05, 1.84, 0, 0.025, 0), std(0xd8c7ab, 1), false],
    [boxAt(1.7, 1.2, 1.4, 0, 0.6, -0.15), WHITE_MAT],
    [boxAt(1.86, 0.12, 1.6, 0, 1.26, -0.12), std(0x4a90e2)],
    // de donkere deuropening achter elke deur
    [mergeGeometries([boxAt(0.46, 0.84, 0.012, -0.42, 0.44, 0.553), boxAt(0.46, 0.84, 0.012, 0.42, 0.44, 0.553)])!, DARK_MAT, false],
    [mergeGeometries([boxAt(0.2, 0.2, 0.04, -0.42, 1.04, 0.57), boxAt(0.2, 0.2, 0.04, 0.42, 1.04, 0.57)])!, std(0x9fd8f5, 0.4)],
    [boxAt(0.04, 0.5, 0.5, 0.86, 0.75, -0.2), std(0x9fd8f5, 0.4)],
  ],
  // de speeltuin als één gebouw bestaat niet meer (zie SHOPS in data.ts): je bouwt losse toestellen
  playground: [],
  bench: [[BENCH_GEO, FENCE_MAT]],
  // bloembak: elke bloem is een steel met een kop, zodat ze los van elkaar kunnen wiegen (zie SHOP_BOB)
  flowers: [
    [mergeGeometries([
      boxAt(0.74, 0.17, 0.36, 0, 0.115, 0), boxAt(0.8, 0.035, 0.05, 0, 0.2, -0.185), boxAt(0.8, 0.035, 0.05, 0, 0.2, 0.185), boxAt(0.05, 0.035, 0.36, -0.375, 0.2, 0), boxAt(0.05, 0.035, 0.36, 0.375, 0.2, 0),
      boxAt(0.08, 0.04, 0.32, -0.27, 0.02, 0), boxAt(0.08, 0.04, 0.32, 0.27, 0.02, 0),
    ])!, WOOD_MAT],
    [boxAt(0.66, 0.04, 0.28, 0, 0.2, 0), DARK_MAT, false],
    [merge([boxAt(0.03, 0.2, 0.03, -0.22, 0.32, 0), blob(0.05, 1.5, 0.3, 0.7, -0.17, 0.27, 0.01, 0)]), STEM_MAT],
    [merge(bloom(-0.22, 0.44, 0, 0xe0584f, 0.09)), PAINT_MAT],
    [merge([boxAt(0.03, 0.26, 0.03, 0, 0.35, 0.03), blob(0.05, 1.5, 0.3, 0.7, -0.05, 0.3, 0.03, 0)]), STEM_MAT],
    [merge(bloom(0, 0.5, 0.03, 0xffd23f, 0.09)), PAINT_MAT],
    [merge([boxAt(0.03, 0.2, 0.03, 0.22, 0.32, -0.02), blob(0.05, 1.5, 0.3, 0.7, 0.27, 0.27, -0.02, 0)]), STEM_MAT],
    [merge(bloom(0.22, 0.44, -0.02, 0xf06aa6, 0.09)), PAINT_MAT],
  ],
  // afvalbak: de deksel scharniert om zijn achterrand (zie buildShop)
  bin: [
    [painted([0x3d8b5a, boxAt(0.32, 0.42, 0.32, 0, 0.21, 0)], [0x2c6a43, boxAt(0.34, 0.05, 0.34, 0, 0.025, 0)], [0x58a874, boxAt(0.33, 0.035, 0.33, 0, 0.375, 0)]), PAINT_MAT],
    [mergeGeometries([boxAt(0.38, 0.06, 0.38, 0, 0.03, 0.19), boxAt(0.14, 0.03, 0.05, 0, 0.075, 0.19)])!, std(0x2c6a43)],
    // de voorkant: een donkere inwerpgleuf, een wit plaatje en een voetpedaal, zodat je ziet welke kant hij op staat
    [boxAt(0.24, 0.08, 0.03, 0, 0.31, 0.16), std(0x1f3d2b)],
    [boxAt(0.17, 0.14, 0.02, 0, 0.15, 0.162), WHITE_MAT],
    [boxAt(0.16, 0.03, 0.1, 0, 0.015, 0.21), std(0x8a8f98, 0.6)],
  ],
  // de grote attracties staan verderop, bij hun bewegende delen
  fountain: [],
  carousel: [],
  // de losse speeltoestellen ook
  slide: [],
  swing: [],
  seesaw: [],
  springer: [],
  trampoline: [],
  // en de nieuwere gebouwen: uitkijktoren, restaurant, reuzenrad, botsauto's, schuilhut, treinhalte, paraplu's
  tower: [],
  restaurant: [],
  ferris: [],
  bumper: [],
  shelter: [],
  station: [],
  umbrellas: [],
  // de tribune voor de dierenshow
  show: [],
  // een huisje van de kabelbaan
  cablecar: [],
};
// Iets leuks in een verblijf: een bal, een struik met bessen, een boomstam en een bloemperk.
const TOY_PARTS: Record<ToyKind, Part[]> = {
  // heuvel, rotsen, drinkvijver, waterval, warmtelamp, ijsblok, klimrek en tunnel staan verderop
  hill: [],
  rocks: [],
  drink: [],
  fall: [],
  lamp: [],
  icebox: [],
  filter: [],
  frame: [],
  tunnel: [],
  // en het speelgoed dat zelf beweegt ook
  tyre: [],
  rocker: [],
  tetherball: [],
  logarch: [],
  tyreswing: [],
  pole: [],
  // de ballen liggen los: die staan in TOY_LOOSE
  ball: [],
  bush: [
    // een bessenstruik in een houten kuip: daaraan zie je dat het speelgoed is en geen natuur
    [merge([ball(0.28, 0, 0.42, 0), ball(0.17, 0.08, 0.66, -0.04), ball(0.16, 0.2, 0.52, 0.12)]), LEAF_MAT],
    [merge([ball(0.2, 0.2, 0.36, 0.08), ball(0.19, -0.2, 0.36, -0.1), ball(0.15, -0.06, 0.32, 0.2)]), LEAF2],
    [painted(
      [0xe0584f, ...[[0.12, 0.58, 0.2], [-0.17, 0.52, 0.15], [0.02, 0.72, -0.12], [0.3, 0.46, 0], [-0.04, 0.44, 0.28], [0.28, 0.4, 0.22], [-0.3, 0.44, -0.02]].map(([x, y, z]) => dot(0.065, x, y, z))],
      [0xa8743f, tube(0.29, 0.25, 0.18, 0, 0.09, 0)],
      [0x80552c, tube(0.305, 0.305, 0.035, 0, 0.165, 0), tube(0.275, 0.275, 0.03, 0, 0.06, 0)],
    ), PAINT_MAT],
  ],
  // de stronk staat vast in de hoek; de liggende stam ligt los (zie TOY_LOOSE) en rolt er net langs
  log: [
    [tube(0.11, 0.125, 0.3, -0.37, 0.15, -0.3), WOOD_MAT],
    [tube(0.095, 0.095, 0.02, -0.37, 0.31, -0.3), std(0xe3c08a, 1)],
  ],
  // hoepel: een rode ring op een paal; een dolfijn springt erdoorheen
  hoop: [
    [mergeGeometries([tube(0.035, 0.045, 0.7, 0, 0.35, 0), tube(0.14, 0.17, 0.05, 0, 0.025, 0), tube(0.07, 0.1, 0.05, 0, 0.075, 0), tube(0.055, 0.055, 0.05, 0, 0.7, 0)])!, std(0x8a8f98, 0.6)],
    [new THREE.TorusGeometry(0.4, 0.045, 8, 22).translate(0, 1.12, 0), std(0xe0584f, 0.5)],
    // witte banden om de ring
    [mergeGeometries([0, 1, 2, 3].map(i => new THREE.TorusGeometry(0.4, 0.051, 6, 5, Math.PI / 7).rotateZ((i * Math.PI) / 2 + 0.56).translate(0, 1.12, 0)))!, WHITE_MAT],
  ],
  flowerbed: [
    // aarde met een houten randje eromheen
    [painted(
      [0x5a3d22, boxAt(0.8, 0.05, 0.8, 0, 0.025, 0)],
      [0xa8743f, boxAt(0.88, 0.08, 0.05, 0, 0.04, -0.415), boxAt(0.88, 0.08, 0.05, 0, 0.04, 0.415), boxAt(0.05, 0.08, 0.78, -0.415, 0.04, 0), boxAt(0.05, 0.08, 0.78, 0.415, 0.04, 0)],
    ), MATTE_MAT, false],
    [merge([[-0.24, 0.2, -0.2], [0.2, 0.26, -0.16], [-0.1, 0.18, 0.22], [0.24, 0.24, 0.22], [0, 0.2, 0]].flatMap(([x, h, z]) => [
      boxAt(0.03, h, 0.03, x, 0.05 + h / 2, z), blob(0.05, 1.5, 0.3, 0.7, x + 0.05, 0.1, z + 0.01, 0), blob(0.045, 0.7, 0.3, 1.5, x - 0.01, 0.12, z - 0.05, 0),
    ])), STEM_MAT],
    [blooms([[-0.24, 0.27, -0.2, 0xe0584f], [0.2, 0.33, -0.16, 0xffd23f], [-0.1, 0.25, 0.22, 0xf06aa6], [0.24, 0.31, 0.22, 0xf7f4ec], [0, 0.27, 0, 0xb06ad9]], 0.085), PAINT_MAT],
  ],
};
/**
 * Een autoband rond zijn eigen midden, met de as langs x (voor `painted`): `r` is de buitenste straal, `thick` de
 * dikte van het rubber. De blokjes op het loopvlak en de witte streep op de zijkant laten zien dat hij rolt.
 */
const tyreGeo = (r: number, thick: number): [number, ...THREE.BufferGeometry[]][] => [
  [0x3d4148, new THREE.TorusGeometry(r - thick, thick, 7, 14).rotateY(Math.PI / 2)],
  [0x5b616a, ...Array.from({ length: 7 }, (_, i) => new THREE.BoxGeometry(thick * 1.5, 0.03, 0.06).translate(0, r - 0.008, 0).rotateX((i / 7) * Math.PI * 2))],
  [0xf7f4ec, ...[-1, 1].map(side => new THREE.TorusGeometry(r - thick, thick * 0.3, 4, 5, Math.PI * 0.6).rotateY(Math.PI / 2).translate(side * thick * 0.82, 0, 0))],
];
/**
 * De losse stukken van speelgoed: de twee ballen, de liggende stam en de autoband. Elk stuk is rond zijn eigen
 * midden gemaakt, zodat het echt kan rollen. `x`, `z`: de eigen plek op de tegel. `r`: de straal, zo hoog ligt het
 * midden. `turn`: zo ligt een stam gedraaid; die rolt alleen dwars op zijn lengte. `wheel`: een band, die rolt
 * rechtop en draait mee met de kant waar hij heen gaat.
 */
const TOY_LOOSE: Partial<Record<ToyKind, { x: number; z: number; r: number; turn?: number; wheel?: boolean; parts: Part[] }[]>> = {
  // de band staat rechtop, met de as langs x
  tyre: [{ x: 0.12, z: 0.1, r: 0.22, wheel: true, parts: [[painted(...tyreGeo(0.22, 0.07)), MATTE_MAT]] }],
  // de band om elke bal laat zien dat hij rolt
  ball: [
    { x: -0.08, z: 0, r: 0.2, parts: [[ball(0.2, 0, 0, 0), std(0xe0584f, 0.5)], [tube(0.203, 0.203, 0.07, 0, 0, 0), WHITE_MAT]] },
    { x: 0.24, z: 0.18, r: 0.12, parts: [[ball(0.12, 0, 0, 0), std(0x4a90e2, 0.5)], [tube(0.122, 0.122, 0.04, 0, 0, 0), std(0xffd23f, 0.5)]] },
  ],
  // de stam ligt langs x; de lichte kopse kanten, een takje en een plukje mos laten zien dat hij rolt
  log: [
    {
      x: 0.08, z: 0, r: 0.14, turn: -0.12,
      parts: [
        [new THREE.CylinderGeometry(0.14, 0.14, 0.6, 10).rotateZ(Math.PI / 2), WOOD_MAT],
        [mergeGeometries([-0.3, 0.3].map(x => new THREE.CylinderGeometry(0.115, 0.115, 0.02, 10).rotateZ(Math.PI / 2).translate(x, 0, 0)))!, std(0xe3c08a, 1)],
        [tube(0.03, 0.04, 0.1, -0.12, 0.17, 0).rotateX(-0.7), WOOD_MAT],
        [new THREE.IcosahedronGeometry(0.08, 1).scale(1.5, 0.45, 1).translate(0.1, 0.125, 0).rotateX(2.1), LEAF_MAT],
      ],
    },
  ],
};

// De grote attracties. Wat stilstaat zit in SHOP_PARTS; wat beweegt staat hier los, zodat het kan draaien
// (de draaimolen) of op en neer kan gaan (de waterstraal van de fontein). `y`: vanaf welke hoogte.
const STONE = std(0xb9c2c9, 0.9);
const WATER_MAT = std(0x6ec3e8, 0.25);
const SPRAY_MAT = std(0xd6f1ff, 0.3);
const GOLD_MAT = std(0xffd23f, 0.5);
const around = <T>(n: number, r: number, make: (x: number, z: number, i: number) => T): T[] =>
  Array.from({ length: n }, (_, i) => make(Math.sin((i / n) * Math.PI * 2) * r, Math.cos((i / n) * Math.PI * 2) * r, i));
const SHOP_MOVING: Partial<Record<ShopKind, { y: number; parts: Part[] }>> = {
};
// De voersilo: een ronde toren met banden, een ladder en een rood dak, een schuif naar voren en een bakje ervoor
// waar de dieren uit eten.
const SILO_GEO = painted(
  [0xd9dde2, tube(0.24, 0.24, 0.8, 0, 0.5, -0.2)],
  [0xb4bcc5, tube(0.25, 0.25, 0.035, 0, 0.32, -0.2), tube(0.25, 0.25, 0.035, 0, 0.6, -0.2), tube(0.255, 0.255, 0.04, 0, 0.885, -0.2)],
  [0x8a8f98, tube(0.2, 0.23, 0.1, 0, 0.05, -0.2), beam(0.08, [0, 0.4, -0.02], [0, 0.17, 0.2])],
  [0x6b7480, boxAt(0.016, 0.72, 0.016, 0.25, 0.5, -0.26), boxAt(0.016, 0.72, 0.016, 0.25, 0.5, -0.14), ...[0.2, 0.32, 0.44, 0.56, 0.68, 0.8].map(y => boxAt(0.016, 0.016, 0.12, 0.25, y, -0.2))],
);
const SILO_ROOF_GEO = merge([cone(0.3, 0.24, 0, 1.02, -0.2), ball(0.04, 0, 1.15, -0.2)]);
const SILO_TRAY_GEO = TROUGH_GEO.clone().scale(0.75, 0.8, 0.55).translate(0, 0, 0.26);
const SILO_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5 });
// Losse speeltoestellen van 2 bij 2 tegels. Wat beweegt (de zitjes van de schommel, de plank van de wipwap,
// de wipkippen) staat in SHOP_MOVING en draait om het midden op hoogte `y`.
const PLAY_FLOOR: Part = [painted(
  [0xe9b66b, boxAt(1.84, 0.04, 1.84, 0, 0.02, 0)],
  [0xd39b4e, boxAt(1.84, 0.05, 0.06, 0, 0.025, -0.89), boxAt(1.84, 0.05, 0.06, 0, 0.025, 0.89), boxAt(0.06, 0.05, 1.72, -0.89, 0.025, 0), boxAt(0.06, 0.05, 1.72, 0.89, 0.025, 0)],
), MATTE_MAT, false];
const METAL = std(0x8a8f98, 0.6);
const P_RED = std(0xe0584f), P_BLUE = std(0x4a90e2), P_YELLOW = std(0xffd23f, 0.6);
SHOP_PARTS.slide = [
  PLAY_FLOOR,
  [mergeGeometries([
    boxAt(0.07, 1.5, 0.07, -0.25, 0.75, -0.75), boxAt(0.07, 1.5, 0.07, 0.25, 0.75, -0.75), boxAt(0.07, 1.5, 0.07, -0.25, 0.75, -0.25), boxAt(0.07, 1.5, 0.07, 0.25, 0.75, -0.25),
    ...[0.25, 0.5, 0.75, 1.0].map(y => boxAt(0.5, 0.045, 0.045, 0, y, -0.79)),
  ])!, WOOD_MAT],
  [boxAt(0.58, 0.06, 0.58, 0, 1.15, -0.5), P_BLUE],
  [merge([cone(0.48, 0.3, 0, 1.66, -0.5, 4), ball(0.045, 0, 1.83, -0.5)]), P_RED],
  [new THREE.BoxGeometry(0.42, 0.05, 1.58).rotateX(0.727).translate(0, 0.62, 0.31), P_YELLOW],
  // de randen van de glijbaan en een leuning om het torentje
  [mergeGeometries([
    new THREE.BoxGeometry(0.04, 0.13, 1.58).rotateX(0.727).translate(-0.22, 0.68, 0.31), new THREE.BoxGeometry(0.04, 0.13, 1.58).rotateX(0.727).translate(0.22, 0.68, 0.31),
    boxAt(0.04, 0.04, 0.5, -0.25, 1.4, -0.5), boxAt(0.04, 0.04, 0.5, 0.25, 1.4, -0.5), boxAt(0.5, 0.04, 0.04, 0, 1.4, -0.75),
  ])!, P_RED],
];
SHOP_PARTS.swing = [
  PLAY_FLOOR,
  [mergeGeometries([-0.84, 0.84].flatMap(x => [
    new THREE.BoxGeometry(0.07, 1.57, 0.07).rotateX(-0.285).translate(x, 0.75, 0.22),
    new THREE.BoxGeometry(0.07, 1.57, 0.07).rotateX(0.285).translate(x, 0.75, -0.22),
  ]))!, P_RED],
  [merge([boxAt(1.78, 0.07, 0.07, 0, 1.5, 0), ball(0.065, -0.86, 1.5, 0), ball(0.065, 0.86, 1.5, 0)]), P_RED],
];
SHOP_MOVING.swing = {
  y: 1.5,
  parts: [
    [mergeGeometries([-0.36, 0.36].flatMap(x => [boxAt(0.02, 1.13, 0.02, x - 0.14, -0.565, 0), boxAt(0.02, 1.13, 0.02, x + 0.14, -0.565, 0)]))!, METAL],
    [boxAt(0.34, 0.04, 0.16, -0.36, -1.15, 0), P_BLUE],
    [boxAt(0.34, 0.04, 0.16, 0.36, -1.15, 0), P_YELLOW],
  ],
};
SHOP_PARTS.seesaw = [PLAY_FLOOR, [mergeGeometries([boxAt(0.16, 0.4, 0.34, 0, 0.2, 0), boxAt(0.3, 0.06, 0.4, 0, 0.03, 0), new THREE.CylinderGeometry(0.05, 0.05, 0.4, 8).rotateX(Math.PI / 2).translate(0, 0.4, 0)])!, P_RED]];
SHOP_MOVING.seesaw = {
  y: 0.42,
  parts: [
    [boxAt(1.62, 0.06, 0.24, 0, 0, 0), P_YELLOW],
    [mergeGeometries([-0.44, 0.44].flatMap(x => [boxAt(0.035, 0.22, 0.035, x, 0.13, 0), boxAt(0.035, 0.035, 0.24, x, 0.24, 0)]))!, P_RED],
    [mergeGeometries([boxAt(0.26, 0.03, 0.24, -0.67, 0.045, 0), boxAt(0.26, 0.03, 0.24, 0.67, 0.045, 0)])!, P_BLUE],
  ],
};
// een wipkip: een rond diertje met oren, een lichte snuit, oogjes en een zadeltje
const rider = (x: number, coat: number, light: number): THREE.BufferGeometry => painted(
  [coat, blob(0.14, 0.75, 0.75, 1.9, x, 0.14, 0), blob(0.1, 0.9, 1.25, 0.95, x, 0.36, 0.2), blob(0.045, 0.7, 1.6, 0.7, x, 0.3, -0.27), cone(0.03, 0.08, x - 0.05, 0.5, 0.18, 4), cone(0.03, 0.08, x + 0.05, 0.5, 0.18, 4)],
  [light, blob(0.065, 1, 0.8, 1.3, x, 0.33, 0.32), boxAt(0.17, 0.03, 0.2, x, 0.245, -0.04)],
  [0x22201c, dot(0.018, x - 0.07, 0.4, 0.25), dot(0.018, x + 0.07, 0.4, 0.25)],
);
SHOP_PARTS.springer = [
  PLAY_FLOOR,
  // de veren: een dunne staaf met ringen eromheen
  [mergeGeometries([-0.42, 0.42].flatMap(x => [tube(0.035, 0.035, 0.3, x, 0.17, 0), tube(0.16, 0.16, 0.03, x, 0.045, 0), ...[0.09, 0.15, 0.21, 0.27].map(y => tube(0.075, 0.075, 0.028, x, y, 0))]))!, METAL],
];
SHOP_MOVING.springer = {
  y: 0.3,
  parts: [
    [rider(-0.42, 0xe0584f, 0xf9c9b4), PAINT_MAT],
    [rider(0.42, 0x4a90e2, 0xc9e2f8), PAINT_MAT],
    [mergeGeometries([-0.42, 0.42].flatMap(x => [boxAt(0.32, 0.03, 0.03, x, 0.44, 0.1), boxAt(0.05, 0.045, 0.045, x - 0.16, 0.44, 0.1), boxAt(0.05, 0.045, 0.045, x + 0.16, 0.44, 0.1)]))!, P_YELLOW],
  ],
};
SHOP_PARTS.trampoline = [
  PLAY_FLOOR,
  [mergeGeometries(around(6, 0.7, (x, z) => boxAt(0.05, 0.34, 0.05, x, 0.17, z)))!, METAL],
  // de rand: om en om blauw en geel
  [striped(new THREE.CylinderGeometry(0.8, 0.8, 0.07, 10), [0x4a90e2, 0xffd23f], 10).translate(0, 0.36, 0), PAINT_MAT],
  [tube(0.64, 0.64, 0.02, 0, 0.4, 0), std(0x3d4f5a, 0.8), false],
];
/** Het licht van een lantaarn: overdag een zacht geel, 's nachts fel. */
const LAMP_MAT = new THREE.MeshStandardMaterial({ color: 0xfff1a8, emissive: 0xffd23f, emissiveIntensity: 0.6, roughness: 0.4 });
const FLAME_MAT = new THREE.MeshStandardMaterial({ color: 0xf08a24, emissive: 0xf06a10, emissiveIntensity: 0.9, roughness: 0.6 });
const FLAME2_MAT = new THREE.MeshStandardMaterial({ color: 0xffd23f, emissive: 0xffc21f, emissiveIntensity: 0.9, roughness: 0.6 });
/** Een lamp die je 's nachts hebt uitgetikt: grijs glas zonder licht. */
const LAMP_OFF_MAT = new THREE.MeshStandardMaterial({ color: 0x7d8794, roughness: 0.5 });
/** De lampjes van het lichtfeestje: per kleur een fel gloeiend materiaal. */
const LAMP_FLASH = new Map<number, THREE.MeshStandardMaterial>();
function flashMat(color: number): THREE.MeshStandardMaterial {
  let m = LAMP_FLASH.get(color);
  if (!m) LAMP_FLASH.set(color, (m = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.6, roughness: 0.4 })));
  return m;
}
// Versieringen: één tegel groot, het midden is (0, 0).

// ------------------------------------------------------------ seizoenen
/** Het seizoen van nu; een nieuw gemaakte tint blad neemt het meteen over. */
let seasonNow: Season = 'summer';
/** Blad dat met de seizoenen meekleurt: het materiaal, zijn zomerkleur en of het bloesem is (dat blijft roze in de lente). */
const SEASON_LEAVES: { mat: THREE.MeshStandardMaterial; summer: number; pink: boolean }[] = [];
const leafy = (mat: THREE.MeshStandardMaterial, pink = false): THREE.MeshStandardMaterial => {
  SEASON_LEAVES.push({ mat, summer: mat.color.getHex(), pink });
  return mat;
};
leafy(LEAF_MAT);
leafy(LEAF2);
const CHERRY_A = leafy(std(0xf7b6cf, 1), true), CHERRY_B = leafy(std(0xf48fb1, 1), true);
// een palm en een cactus blijven het hele jaar groen
const PALM_MAT = std(0x5fa544, 1), CACTUS_MAT = std(0x468f3e, 1);
/** Bloesem op sommige bomen: alleen in de lente te zien. */
const BLOSSOM_MAT = std(0xfbd3e2, 1);
BLOSSOM_MAT.visible = false;
const AUTUMN = [0xe08a2c, 0xe6b83a, 0xb5562b, 0xd9742a];
const MIX = new THREE.Color();
/** De kleur van blad in dit seizoen: frisgroen in de lente, oranje, geel of roodbruin in de herfst, berijpt in de winter. */
function leafColor(out: THREE.Color, summer: number, season: Season, n: number, pink = false): THREE.Color {
  out.setHex(summer);
  if (season === 'spring') return pink ? out : out.lerp(MIX.setHex(0x9be05e), 0.3);
  if (season === 'autumn') return out.lerp(MIX.setHex(AUTUMN[n % AUTUMN.length]), 0.78);
  if (season === 'winter') return out.lerp(MIX.setHex(0xe9f2f5), 0.62);
  return out;
}
/**
 * De kleur van het grasland rond het park in dit seizoen: geel in de herfst, bijna wit in de winter. `out` heeft de
 * zomerkleur al. De tegels in het park kleuren op dezelfde manier mee (zie SEASON_TINT in ground.ts).
 */
function groundColor(out: THREE.Color, season: Season): THREE.Color {
  if (season === 'spring') return out.lerp(MIX.setHex(0x92dc5e), 0.22);
  if (season === 'autumn') return out.lerp(MIX.setHex(0xd9b84a), 0.45);
  if (season === 'winter') return out.lerp(MIX.setHex(0xf4f8fc), 0.82);
  return out;
}
/**
 * Vier tinten van hetzelfde blad: gewoon, iets lichter, iets donkerder en iets geler. Eén keer gemaakt en door
 * alle bomen gedeeld, zodat er niet per boom een materiaal bij komt.
 */
const LEAF_TONES = new Map<THREE.Material, THREE.MeshStandardMaterial[]>();
function leafTone(mat: THREE.MeshStandardMaterial, i: number): THREE.MeshStandardMaterial {
  let list = LEAF_TONES.get(mat);
  if (!list) {
    const entry = SEASON_LEAVES.find(l => l.mat === mat);
    const base = new THREE.Color(entry ? entry.summer : mat.color.getHex());
    list = [mat, ...[[1.1, 1.1, 1.06], [0.86, 0.9, 0.88], [1.14, 1.04, 0.78]].map(([r, g, b]) => {
      const tone = mat.clone();
      tone.color.setRGB(Math.min(1, base.r * r), Math.min(1, base.g * g), Math.min(1, base.b * b));
      if (entry) {
        const summer = tone.color.getHex();
        SEASON_LEAVES.push({ mat: tone, summer, pink: entry.pink });
        leafColor(tone.color, summer, seasonNow, SEASON_LEAVES.length - 1, entry.pink);
      }
      return tone;
    })];
    LEAF_TONES.set(mat, list);
  }
  return list[i % list.length];
}
// Kruinen van de loofboom en de den in drie vormen; elke boom kiest er een (zie View.varyTree). De loofboom
// heeft licht blad bovenop en een paar donkere bollen eronder.
type Blob = [number, number, number, number];
const TREE_BLOBS: Blob[][] = [
  [[0.38, 0, 0.94, 0], [0.27, 0.2, 1.22, 0.08], [0.22, -0.16, 1.2, -0.12]],
  [[0.32, 0, 0.92, 0], [0.28, 0.02, 1.24, 0.02], [0.19, 0, 1.52, 0]],
  [[0.34, -0.14, 0.9, 0.06], [0.32, 0.18, 0.94, -0.08], [0.25, 0.02, 1.16, 0]],
];
const TREE_SHADE_BLOBS: Blob[][] = [
  [[0.3, -0.2, 0.84, 0.12], [0.26, 0.22, 0.82, -0.14]],
  [[0.3, 0.08, 0.78, -0.1], [0.2, -0.16, 1.06, 0.14]],
  [[0.26, -0.3, 0.76, -0.1], [0.26, 0.28, 0.78, 0.14], [0.2, 0, 0.74, 0.26]],
];
const TREE_CROWNS = TREE_BLOBS.map(blobs => merge(blobs.map(b => ball(...b))));
const TREE_SHADES = TREE_SHADE_BLOBS.map(blobs => merge(blobs.map(b => ball(...b))));
// bloesem: kleine roze bolletjes boven op elke bol van de kruin
const TREE_BLOSSOMS = TREE_BLOBS.map(blobs => merge(blobs.flatMap(([r, x, y, z], i) => [0, 1, 2, 3].map(k => {
  const a = k * 1.7 + i * 0.9, lift = 0.3 + 0.35 * (k % 2), out = r * Math.cos(lift);
  return ball(0.06, x + Math.cos(a) * out, y + r * Math.sin(lift), z + Math.sin(a) * out);
}))));
const PINE_CROWNS = [
  merge([cone(0.42, 0.55, 0, 0.52, 0), cone(0.33, 0.5, 0, 0.88, 0), cone(0.22, 0.42, 0, 1.2, 0)]),
  merge([cone(0.34, 0.6, 0, 0.56, 0), cone(0.27, 0.55, 0, 0.94, 0), cone(0.2, 0.5, 0, 1.3, 0), cone(0.12, 0.36, 0, 1.6, 0)]),
  merge([cone(0.46, 0.7, 0, 0.6, 0), cone(0.32, 0.62, 0, 1.06, 0)]),
];
/** Welke onderdelen van een boom blad zijn (die krijgen een eigen tint) en welke de kruin (die krijgt een eigen vorm). */
const TREE_LOOK: Partial<Record<DecorKind, { leaf: number[]; crown: number[] }>> = {
  tree: { leaf: [1, 2], crown: [1, 2] },
  pine: { leaf: [1], crown: [1] },
  palm: { leaf: [1], crown: [] },
  cherry: { leaf: [1, 2], crown: [1, 2] },
  bamboogrove: { leaf: [0, 1], crown: [] },
  topiary: { leaf: [2], crown: [2] },
  cactus: { leaf: [0, 1], crown: [] },
};

// ------------------------------------------------------------ de nieuwere gebouwen
/** De vloer onder een gebouw van `wide` bij `deep` tegels: net iets kleiner dan zijn tegels. */
const floorOf = (color = 0xd8c7ab, wide = 2, deep = wide): Part => [boxAt(wide - 0.16, 0.05, deep - 0.16, 0, 0.025, 0), std(color, 1), false];
const CORNERS: [number, number][] = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
const P_GREEN = std(0x6cc04a);
// Uitkijktoren: vier palen, een vloer op TOWER_TOP waar gasten op staan, een hek eromheen, een ladder aan de
// voorkant en een dakje met een vlag.
const TOWER_ROOF = TOWER_TOP + 1;
SHOP_PARTS.tower = [
  floorOf(),
  [merge([
    ...CORNERS.map(([x, z]) => boxAt(0.1, TOWER_ROOF, 0.1, x * 0.6, TOWER_ROOF / 2, z * 0.6)),
    // schoren links en achter
    beam(0.05, [-0.6, 0.1, -0.6], [0.6, TOWER_TOP - 0.15, -0.6]), beam(0.05, [0.6, 0.1, -0.6], [-0.6, TOWER_TOP - 0.15, -0.6]),
    beam(0.05, [-0.6, 0.1, -0.6], [-0.6, TOWER_TOP - 0.15, 0.6]), beam(0.05, [-0.6, 0.1, 0.6], [-0.6, TOWER_TOP - 0.15, -0.6]),
    // de ladder
    boxAt(0.04, TOWER_TOP, 0.04, -0.16, TOWER_TOP / 2, 0.69), boxAt(0.04, TOWER_TOP, 0.04, 0.16, TOWER_TOP / 2, 0.69),
    ...[1, 2, 3, 4, 5, 6].map(i => boxAt(0.32, 0.035, 0.035, 0, (i * TOWER_TOP) / 7, 0.69)),
  ]), WOOD_MAT],
  [boxAt(1.32, 0.08, 1.32, 0, TOWER_TOP - 0.04, 0), std(0xe3c08a, 1)],
  // het hek: aan de voorkant een opening bij de ladder
  [merge([0.2, 0.42].flatMap(h => [
    boxAt(1.2, 0.04, 0.04, 0, TOWER_TOP + h, -0.6), boxAt(0.04, 0.04, 1.2, -0.6, TOWER_TOP + h, 0), boxAt(0.04, 0.04, 1.2, 0.6, TOWER_TOP + h, 0),
    boxAt(0.36, 0.04, 0.04, -0.4, TOWER_TOP + h, 0.6), boxAt(0.36, 0.04, 0.04, 0.4, TOWER_TOP + h, 0.6),
  ]).concat([-0.3, 0, 0.3].flatMap(a => [boxAt(0.03, 0.42, 0.03, a, TOWER_TOP + 0.21, -0.6), boxAt(0.03, 0.42, 0.03, -0.6, TOWER_TOP + 0.21, a), boxAt(0.03, 0.42, 0.03, 0.6, TOWER_TOP + 0.21, a)]))), WHITE_MAT],
  [merge([cone(0.98, 0.45, 0, TOWER_ROOF + 0.225, 0, 4), boxAt(1.42, 0.04, 1.42, 0, TOWER_ROOF + 0.01, 0)]), P_RED],
  [merge([boxAt(0.03, 0.46, 0.03, 0, TOWER_ROOF + 0.62, 0), boxAt(0.07, 0.07, 0.07, 0, TOWER_ROOF + 0.88, 0)]), WHITE_MAT],
  // de vlag: los, zodat hij kan wapperen (zie SHOP_BOB)
  [boxAt(0.3, 0.18, 0.02, 0.165, TOWER_ROOF + 0.72, 0), P_YELLOW],
];
// Restaurant: een keukentje linksachter met een luik en een gestreepte luifel, en drie ronde tafels met elk
// twee krukken en een parasol.
const awning = (from: number): THREE.BufferGeometry =>
  merge([0, 1, 2].slice(0, from ? 2 : 3).flatMap(i => {
    const x = -0.85 + (from + i * 2) * 0.2;
    return [boxAt(0.2, 0.07, 1.02, x, 1.2, -0.44), new THREE.BoxGeometry(0.2, 0.04, 0.3).rotateX(0.55).translate(x, 1.1, 0.19)];
  }));
SHOP_PARTS.restaurant = [
  floorOf(0xe9d9b8),
  [merge([boxAt(0.86, 1.15, 0.08, -0.47, 0.575, -0.86), boxAt(0.08, 1.15, 0.78, -0.86, 0.575, -0.45), boxAt(0.08, 1.15, 0.08, -0.08, 0.575, -0.1)]), std(0xf3ead6)],
  [merge([boxAt(0.74, 0.42, 0.1, -0.47, 0.21, -0.1), boxAt(0.1, 0.42, 0.7, -0.08, 0.21, -0.47)]), std(0xc9553f)],
  [merge([boxAt(0.8, 0.04, 0.16, -0.47, 0.44, -0.1), boxAt(0.16, 0.04, 0.76, -0.08, 0.44, -0.47)]), WHITE_MAT],
  [awning(0), P_RED],
  [awning(1), WHITE_MAT],
  // een schoorsteen en een pan op de toonbank
  [merge([boxAt(0.14, 0.3, 0.14, -0.62, 1.38, -0.62), tube(0.09, 0.08, 0.07, -0.5, 0.495, -0.1), boxAt(0.14, 0.02, 0.03, -0.36, 0.5, -0.1)]), METAL],
  [merge(RESTAURANT_TABLES.flatMap(([x, z]) => [tube(0.2, 0.2, 0.04, x, 0.4, z), tube(0.03, 0.07, 0.38, x, 0.19, z)])), WHITE_MAT],
  [merge(RESTAURANT_TABLES.flatMap(([x, z]) => [-0.27, 0.27].flatMap(d => [tube(0.085, 0.085, 0.05, x + d, 0.215, z), tube(0.025, 0.05, 0.19, x + d, 0.095, z)]))), P_RED],
  [merge(RESTAURANT_TABLES.map(([x, z]) => tube(0.014, 0.014, 0.92, x, 0.88, z))), METAL],
  // de parasols: los, zodat ze kunnen wiegen
  ...RESTAURANT_TABLES.map(([x, z], i): Part => [striped(new THREE.ConeGeometry(0.36, 0.2, 8), [[0xe0584f, 0xffd23f, 0x4a90e2][i % 3], 0xf7f4ec], 8).translate(x, 1.42, z), PAINT_MAT]),
  // op elke tafel een bord eten, een beker en een bakje sla, en voor de deur een bord met het menu
  [painted(
    [0xe0584f, ...RESTAURANT_TABLES.map(([x, z]) => tube(0.055, 0.055, 0.016, x - 0.07, 0.428, z + 0.03))],
    [0xffd23f, ...RESTAURANT_TABLES.map(([x, z]) => tube(0.026, 0.02, 0.05, x + 0.08, 0.445, z - 0.05))],
    [0x6cc04a, ...RESTAURANT_TABLES.map(([x, z]) => blob(0.04, 1, 0.6, 1, x + 0.04, 0.44, z + 0.09, 0))],
    [0x3d4f5a, new THREE.BoxGeometry(0.26, 0.4, 0.02).rotateX(-0.22).translate(-0.74, 0.2, 0.84), new THREE.BoxGeometry(0.26, 0.4, 0.02).rotateX(0.22).translate(-0.74, 0.2, 0.75)],
    [0xf7f4ec, ...[0.1, 0.02, -0.06].map((y, i) => new THREE.BoxGeometry(0.18 - i * 0.03, 0.022, 0.024).translate(-i * 0.015, y, 0).rotateX(-0.22).translate(-0.74, 0.2, 0.84))],
  ), PAINT_MAT],
];
// ------------------------------------------------------------ attracties in allerlei maten (de getallen staan in rides.ts)
/**
 * Wat aan een attractie los beweegt en niet met één draaiing te vangen is (de bakjes van het reuzenrad, de paarden
 * van de draaimolen, de botsauto's): per soort een functie die de losse stukken in het gebouw hangt en ze in
 * `userData` zet. `poseRide` zet ze daarna elk beeldje op hun plek.
 */
const RIDE_BUILD: Partial<Record<ShopKind, (group: THREE.Group, mat?: THREE.Material) => void>> = {};
/** Een los stuk van één vorm (een bakje, een paard, een straal water). */
const piece = (geo: THREE.BufferGeometry, m: THREE.Material, mat?: THREE.Material, shadow = true): THREE.Mesh => {
  const mesh = new THREE.Mesh(geo, mat ?? m);
  mesh.castShadow = !mat && shadow;
  return mesh;
};
const RIDE_COLORS = [0xe0584f, 0xffd23f, 0x4a90e2, 0x6cc04a, 0xf48fb1, 0xf08a24];
/**
 * Looplicht: de lampjes langs het rad, de draaimolen en de botsauto's zitten om de beurt in drie groepen die na
 * elkaar opgloeien, zodat het licht lijkt rond te lopen. Ze volgen LAMP_MAT: overdag zacht, 's nachts fel en op het
 * feest in kleur.
 */
const CHASE_MATS = [0, 1, 2].map(() => LAMP_MAT.clone());
function chaseLamps(t: number): void {
  for (let i = 0; i < CHASE_MATS.length; i++) {
    const m = CHASE_MATS[i], glow = Math.max(0, Math.sin(t * 4.5 - (i * Math.PI * 2) / 3));
    m.color.copy(LAMP_MAT.color);
    m.emissive.copy(LAMP_MAT.emissive);
    m.emissiveIntensity = LAMP_MAT.emissiveIntensity * (0.3 + 0.9 * glow * glow);
  }
}
/** Een lantaarn op een paal van `h` hoog: [de paal, het lampje]. */
const lampPost = (x: number, z: number, h: number): [THREE.BufferGeometry, THREE.BufferGeometry] =>
  [merge([tube(0.022, 0.03, h, x, h / 2, z), tube(0.06, 0.045, 0.05, x, 0.025, z), tube(0.05, 0.03, 0.04, x, h + 0.01, z)]), ball(0.075, x, h + 0.09, z)];

// Reuzenrad (8 bij 2 tegels): voor en achter het rad staat een poot in de vorm van een A, met de as ertussen. Het rad
// zelf draait om die as: twee velgen met spaken en lampjes. De twaalf bakjes hangen elk aan een eigen asje en
// blijven dus rechtop (ze slingeren alleen een beetje). Onder het rad ligt het perron met een trapje en een hek;
// rechts staat het kaartjeshuisje en op de hoeken staan lantaarns.
const F = FERRIS;
const FERRIS_BLUE = 0x4a90e2, FERRIS_DARK = 0x356fb5;
/** Een poot op plek z: twee schuine balken tot de as, twee dwarsbalken en twee voeten. */
const ferrisLeg = (z: number): THREE.BufferGeometry[] => {
  const at = (h: number): number => F.legX * (1 - h / F.hub);
  return [
    beam(0.17, [-F.legX, 0, z], [0, F.hub + 0.06, z]), beam(0.17, [F.legX, 0, z], [0, F.hub + 0.06, z]),
    boxAt(at(1.7) * 2, 0.11, 0.11, 0, 1.7, z), boxAt(at(3.2) * 2, 0.1, 0.1, 0, 3.2, z),
  ];
};
/** Een stuk hek op het perron, van x0 tot x1 op plek z: paaltjes met twee leuningen. */
const deckRail = (x0: number, x1: number, z: number): THREE.BufferGeometry[] => {
  const n = Math.max(1, Math.round((x1 - x0) / 0.42)), top = F.deck + 0.42;
  return [
    boxAt(x1 - x0, 0.035, 0.035, (x0 + x1) / 2, top, z), boxAt(x1 - x0, 0.03, 0.03, (x0 + x1) / 2, F.deck + 0.22, z),
    ...Array.from({ length: n + 1 }, (_, i) => boxAt(0.04, 0.44, 0.04, x0 + ((x1 - x0) * i) / n, F.deck + 0.22, z)),
  ];
};
const BOOTH_X = 3.02, BOOTH_Z = 0.42;
SHOP_PARTS.ferris = [
  floorOf(0xd8c7ab, 8, 2),
  // het perron met twee treden ervoor: plat, zodat de schaduw van het rad erop valt
  [painted(
    [0xe3c08a, boxAt(F.deckX * 2, F.deck, F.deckFront - F.deckBack, 0, F.deck / 2, (F.deckFront + F.deckBack) / 2)],
    [0xd3a868, boxAt(1.5, (F.deck * 2) / 3, F.step, 0, F.deck / 3, F.deckFront + F.step / 2), boxAt(1.5, F.deck / 3, F.step, 0, F.deck / 6, F.deckFront + F.step * 1.5)],
    [0xc79a63, boxAt(F.deckX * 2 + 0.04, 0.03, 0.05, 0, F.deck - 0.012, F.deckFront + 0.005), boxAt(F.deckX * 2 + 0.04, 0.03, 0.05, 0, F.deck - 0.012, F.deckBack - 0.005)],
  ), MATTE_MAT, false],
  // de poten, de voeten en de lagers van de as
  [painted(
    [FERRIS_BLUE, ...ferrisLeg(F.legZ), ...ferrisLeg(-F.legZ)],
    [FERRIS_DARK, ...[-1, 1].flatMap(z => [-1, 1].map(x => boxAt(0.52, 0.14, 0.4, x * F.legX, 0.07, z * F.legZ)))],
    [0xffd23f, ...[-1, 1].map(z => boxAt(0.4, 0.4, 0.2, 0, F.hub, z * F.legZ))],
    [0x8a8f98, new THREE.CylinderGeometry(0.09, 0.09, F.legZ * 2 + 0.3, 10).rotateX(Math.PI / 2).translate(0, F.hub, 0)],
  ), PAINT_MAT],
  // het hek om het perron (voor blijft de trap vrij), het kaartjeshuisje en de palen van de lantaarns
  [painted(
    [0xf7f4ec, ...deckRail(-F.deckX, -0.75, F.deckFront - 0.04), ...deckRail(0.75, F.deckX, F.deckFront - 0.04), ...deckRail(-F.deckX, F.deckX, F.deckBack + 0.04)],
    [0xe0584f, boxAt(0.8, 0.5, 0.8, BOOTH_X, 0.3, BOOTH_Z), boxAt(0.8, 0.26, 0.8, BOOTH_X, 1.0, BOOTH_Z), ...CORNERS.map(([x, z]) => boxAt(0.1, 0.4, 0.1, BOOTH_X + x * 0.35, 0.72, BOOTH_Z + z * 0.35))],
    [0xf7f4ec, boxAt(0.84, 0.06, 0.84, BOOTH_X, 0.56, BOOTH_Z), boxAt(0.86, 0.05, 0.3, BOOTH_X, 0.56, BOOTH_Z + 0.34), boxAt(0.84, 0.05, 0.84, BOOTH_X, 0.89, BOOTH_Z)],
    [0x3d4f5a, boxAt(0.6, 0.3, 0.6, BOOTH_X, 0.73, BOOTH_Z)],
    [0x8a8f98, ...[[-3.72, 0.74], [3.72, -0.74], [-3.72, -0.74], [1.72, 0.84], [-1.72, 0.84]].map(([x, z]) => lampPost(x, z, 1.5)[0])],
  ), PAINT_MAT],
  // het dak van het huisje, met een bord erop: een geel rad
  [merge([
    striped(new THREE.ConeGeometry(0.72, 0.42, 8), [0xffd23f, 0xe0584f], 8).rotateY(Math.PI / 8).translate(BOOTH_X, 1.34, BOOTH_Z),
    paint(ball(0.07, BOOTH_X, 1.58, BOOTH_Z), 0xf7f4ec),
    paint(new THREE.TorusGeometry(0.15, 0.03, 5, 14).translate(BOOTH_X, 1.02, BOOTH_Z + 0.41), 0xffd23f),
    ...[0, 1, 2].map(i => paint(new THREE.BoxGeometry(0.3, 0.025, 0.02).rotateZ((i * Math.PI) / 3).translate(BOOTH_X, 1.02, BOOTH_Z + 0.41), 0xffd23f)),
  ]), PAINT_MAT],
  // de lantaarns op de hoeken en naast de trap: ze gloeien in het donker
  [merge([[-3.72, 0.74], [3.72, -0.74], [-3.72, -0.74], [1.72, 0.84], [-1.72, 0.84]].map(([x, z]) => lampPost(x, z, 1.5)[1])), LAMP_MAT, false],
];
/** Het draaiende rad, om zijn as: twee velgen, een kleinere ring, spaken, de asjes van de bakjes, de naaf en de lampjes. */
const spokeEnd = (i: number, r: number, z: number): P3 => [Math.cos((i * Math.PI * 2) / F.cabins) * r, Math.sin((i * Math.PI * 2) / F.cabins) * r, z];
const FERRIS_WHEEL: Part[] = [
  [painted(
    [0xf7f4ec, ...[-F.rimZ, F.rimZ].flatMap(z => [
      new THREE.TorusGeometry(F.radius, 0.05, 6, 48).translate(0, 0, z),
      new THREE.TorusGeometry(F.radius * 0.56, 0.032, 5, 36).translate(0, 0, z),
      ...Array.from({ length: F.cabins }, (_, i) => beam(0.05, spokeEnd(i, 0.25, z), spokeEnd(i, F.radius, z))),
    ])],
    // een ster van dunne stangen tussen de spaken, van de kleine ring naar de velg
    [0xcfd8dd, ...[-F.rimZ, F.rimZ].flatMap(z => Array.from({ length: F.cabins }, (_, i) => beam(0.026, spokeEnd(i + 0.5, F.radius * 0.56, z), spokeEnd(i, F.radius, z))))],
    [0x8a8f98, ...Array.from({ length: F.cabins }, (_, i) => new THREE.CylinderGeometry(0.028, 0.028, F.rimZ * 2, 6).rotateX(Math.PI / 2).translate(...spokeEnd(i, F.radius, 0)))],
    [0xe0584f, new THREE.CylinderGeometry(0.34, 0.34, F.rimZ * 2 + 0.16, 16).rotateX(Math.PI / 2)],
    [0xffd23f, ...[-1, 1].map(z => new THREE.CylinderGeometry(0.2, 0.2, 0.05, 12).rotateX(Math.PI / 2).translate(0, 0, z * (F.rimZ + 0.1)))],
  ), PAINT_MAT],
  // lampjes op de kleine ring en om de naaf: ze gloeien in het donker
  [merge([-1, 1].flatMap(z => [
    ...Array.from({ length: F.cabins }, (_, i) => dot(0.05, ...spokeEnd(i, F.radius * 0.56, z * (F.rimZ + 0.04)))),
    ...Array.from({ length: 6 }, (_, i) => dot(0.045, Math.cos((i * Math.PI) / 3) * 0.27, Math.sin((i * Math.PI) / 3) * 0.27, z * (F.rimZ + 0.1))),
  ])), LAMP_MAT, false],
  // en de lampjes langs de velg, in drie groepen: het licht loopt het rad rond
  ...CHASE_MATS.map((m, k): Part => [merge([-1, 1].flatMap(z => Array.from({ length: 12 }, (_, i) => {
    const a = ((i * 3 + k + 0.5) * Math.PI) / 18;
    return dot(0.065, Math.cos(a) * F.radius, Math.sin(a) * F.radius, z * (F.rimZ + 0.06));
  }))), m, false]),
];
/**
 * Een bakje, met zijn asje op (0, 0, 0): een open kuip met een bankje voor twee, die met een beugel aan het asje
 * hangt. De voorkant is laag en het parasolletje bovenop is klein, zodat je de gasten van boven goed ziet zitten.
 */
const cabinGeo = (color: number): THREE.BufferGeometry => {
  const floor = -F.floor, wide = 0.74, deep = 0.5, rim = floor + 0.31;
  return painted(
    [color,
      boxAt(wide, 0.04, deep, 0, floor + 0.02, 0), boxAt(wide, 0.36, 0.035, 0, floor + 0.18, -deep / 2 + 0.018), boxAt(wide, 0.25, 0.035, 0, floor + 0.125, deep / 2 - 0.018),
      boxAt(0.035, 0.31, deep, -wide / 2 + 0.018, floor + 0.155, 0), boxAt(0.035, 0.31, deep, wide / 2 - 0.018, floor + 0.155, 0)],
    [shade(color, 0.72), boxAt(wide + 0.03, 0.045, deep + 0.03, 0, floor + 0.02, 0)],
    [0xf7f4ec, boxAt(wide + 0.02, 0.035, 0.05, 0, floor + 0.265, deep / 2 - 0.018), boxAt(wide + 0.02, 0.035, 0.05, 0, floor + 0.375, -deep / 2 + 0.018),
      // de beugel: aan weerszijden een stijl van de rand van de kuip naar het asje, met een dwarsstang bovenlangs
      ...[-1, 1].map(x => boxAt(0.04, -rim - 0.02, 0.05, x * (wide / 2 - 0.02), (rim - 0.02) / 2, 0)), boxAt(wide, 0.04, 0.05, 0, -0.02, 0)],
    [0xc58a4b, boxAt(wide - 0.08, 0.045, 0.21, 0, -F.seat - 0.0225, -0.1)],
    [0x8a8f98, new THREE.CylinderGeometry(0.05, 0.05, F.rimZ * 2 - 0.12, 8).rotateX(Math.PI / 2)],
  );
};
const cabinRoof = (color: number): THREE.BufferGeometry =>
  merge([
    striped(new THREE.ConeGeometry(0.36, 0.15, 8), [color, 0xf7f4ec], 8).rotateY(Math.PI / 8).scale(1, 1, 0.8).translate(0, 0.085, 0),
    paint(dot(0.035, 0, 0.175, 0), 0xf7f4ec),
  ]);
const CABIN_GEOS = RIDE_COLORS.map(color => merge([cabinGeo(color), cabinRoof(color)]));
RIDE_BUILD.ferris = (group, mat) => {
  const wheel = build(FERRIS_WHEEL, mat);
  wheel.position.y = F.hub;
  // (het rad draait: de schaduw in de kleuren zou mee omhoog draaien)
  wheel.userData.noShade = true;
  group.add(wheel);
  group.userData.wheel = wheel;
  group.userData.cabins = Array.from({ length: F.cabins }, (_, i) => {
    const cabin = piece(CABIN_GEOS[i % CABIN_GEOS.length], PAINT_MAT, mat);
    group.add(cabin);
    return cabin;
  });
};
// Draaimolen (3 bij 3 tegels): een vaste voet met een trommel in het midden. De vloer, de stangen, het dak en de
// paarden draaien samen rond; de negen paarden staan in twee ringen en gaan elk aan hun eigen stang op en neer.
const C = CAROUSEL;
/**
 * Een paard in galop, met het zadel op (0, 0, 0) en de neus naar +z: zo zit een gast er precies op. Manen, staart en
 * hoeven in een eigen kleur, een wit dekje onder het zadel en een hoofdstel.
 */
const carouselHorse = (coat: number, mane: number, saddle: number): THREE.BufferGeometry => painted(
  [coat,
    blob(0.11, 0.8, 0.85, 2, 0, -0.11, 0), rod(0.06, [0, -0.08, 0.15], [0, 0.13, 0.27], 6, 0.045), blob(0.06, 0.85, 0.9, 1.5, 0, 0.17, 0.33),
    cone(0.018, 0.05, -0.03, 0.235, 0.29, 4), cone(0.018, 0.05, 0.03, 0.235, 0.29, 4),
    // de voorbenen naar voren gestrekt, de achterbenen naar achteren
    ...[-1, 1].flatMap(x => [beam(0.042, [x * 0.055, -0.16, 0.15], [x * 0.055, -0.36, 0.24]), beam(0.042, [x * 0.055, -0.16, -0.15], [x * 0.055, -0.36, -0.25])])],
  [mane,
    new THREE.BoxGeometry(0.03, 0.2, 0.05).rotateX(0.5).translate(0, 0.07, 0.17), blob(0.035, 0.8, 2.2, 0.9, 0, -0.14, -0.25), dot(0.03, 0, 0.225, 0.3),
    ...[-1, 1].flatMap(x => [boxAt(0.048, 0.035, 0.05, x * 0.055, -0.375, 0.25), boxAt(0.048, 0.035, 0.05, x * 0.055, -0.375, -0.26)])],
  [saddle, boxAt(0.15, 0.03, 0.17, 0, -0.015, -0.01), boxAt(0.15, 0.06, 0.025, 0, 0.012, -0.095), boxAt(0.1, 0.014, 0.014, 0, 0.155, 0.345)],
  [0xf7f4ec, boxAt(0.2, 0.012, 0.24, 0, -0.03, -0.01)],
  [0x22201c, dot(0.012, -0.05, 0.19, 0.35), dot(0.012, 0.05, 0.19, 0.35)],
);
/** De vacht, de manen en het zadel van elk paard: wit, bruin, zwart, vos en grijs door elkaar, elk met een ander zadel. */
const HORSE_LOOKS: [number, number, number][] = [
  [0xf7f4ec, 0xe9d05a, 0xe0584f], [0xb07a4a, 0x5a3d22, 0x4a90e2], [0x4a4640, 0x22201c, 0xffd23f], [0xd9a05b, 0xf7f4ec, 0x6cc04a], [0xf7f4ec, 0x8a8f98, 0xb06ad9],
  [0x9aa0a6, 0x4a4640, 0xf08a24], [0xb07a4a, 0x22201c, 0xf48fb1], [0xf3e2c0, 0xb07a4a, 0x2bb5a8], [0x7a5234, 0xf7f4ec, 0xe0584f],
];
const HORSE_GEOS = HORSE_LOOKS.map(look => carouselHorse(...look));
/** Waar de stang van paard `i` staat: door zijn schoft, een stukje voor het zadel. Geeft (x, z). */
const horsePole = (i: number): [number, number] => {
  const [a, r] = carouselAt(i, 0);
  return [Math.sin(a) * r + Math.cos(a) * 0.13, Math.cos(a) * r - Math.sin(a) * 0.13];
};
const CANOPY = 2.3;
SHOP_PARTS.carousel = [
  floorOf(0xd8c7ab, 3, 3),
  // de voet: een lage rode rand met een gouden bies; de vloer draait erbovenop
  [painted(
    [0xc9453c, new THREE.CylinderGeometry(C.r + 0.07, C.r + 0.1, C.deck - 0.07, 24).translate(0, (C.deck - 0.07) / 2, 0)],
    [0xffd23f, new THREE.CylinderGeometry(C.r + 0.085, C.r + 0.085, 0.03, 24).translate(0, C.deck - 0.09, 0)],
  ), PAINT_MAT],
  // de trommel in het midden: om en om roze en roomwit, met gouden randen en spiegeltjes
  [merge([
    striped(new THREE.CylinderGeometry(0.27, 0.27, CANOPY - C.deck, 12), [0xf48fb1, 0xf7f4ec], 12).translate(0, (CANOPY + C.deck) / 2, 0),
    paint(tube(0.31, 0.31, 0.07, 0, C.deck + 0.035, 0), 0xffd23f), paint(tube(0.31, 0.31, 0.07, 0, CANOPY - 0.06, 0), 0xffd23f), paint(tube(0.29, 0.29, 0.04, 0, 1.15, 0), 0xffd23f),
    ...around(6, 0.275, (x, z, i) => paint(new THREE.BoxGeometry(0.13, 0.34, 0.02).rotateY((i / 6) * Math.PI * 2).translate(x, 1.62, z), 0x9fd8f5)),
    ...around(6, 0.275, (x, z, i) => paint(new THREE.BoxGeometry(0.13, 0.34, 0.02).rotateY((i / 6) * Math.PI * 2).translate(x, 0.72, z), 0xffe9a8)),
  ]), PAINT_MAT],
];
/** Wat ronddraait: de vloer in taartpunten, de stangen, het plafond, de gestreepte rand en het puntdak met een gouden bol. */
const CAROUSEL_SPIN: Part[] = [
  [merge([
    striped(new THREE.CylinderGeometry(C.r, C.r, 0.07, 24), [0xffd23f, 0xf7b733], 12).translate(0, C.deck - 0.035, 0),
    paint(new THREE.TorusGeometry(C.r, 0.03, 5, 28).rotateX(Math.PI / 2).translate(0, C.deck - 0.02, 0), 0xe0584f),
    ...Array.from({ length: CAROUSEL_SEATS }, (_, i) => paint(tube(0.02, 0.02, CANOPY - C.deck, horsePole(i)[0], (CANOPY + C.deck) / 2, horsePole(i)[1]), 0xf2c94c)),
    paint(new THREE.CylinderGeometry(C.r + 0.08, C.r + 0.08, 0.04, 24).translate(0, CANOPY, 0), 0xfff4d6),
    striped(new THREE.CylinderGeometry(C.r + 0.12, C.r + 0.1, 0.24, 24), [0xe0584f, 0xf7f4ec], 24).translate(0, CANOPY + 0.1, 0),
    striped(new THREE.ConeGeometry(C.r + 0.14, 0.66, 12), [0xe0584f, 0xf7f4ec], 12).translate(0, CANOPY + 0.55, 0),
    paint(tube(0.16, 0.26, 0.12, 0, CANOPY + 0.86, 0), 0xffd23f), paint(ball(0.11, 0, CANOPY + 1.0, 0), 0xffd23f),
  ]), PAINT_MAT],
  // lampjes rond het dak: het licht loopt rond
  ...CHASE_MATS.map((m, k): Part => [merge(Array.from({ length: 8 }, (_, i) => {
    const a = ((i * 3 + k) * Math.PI * 2) / 24;
    return dot(0.06, Math.sin(a) * (C.r + 0.13), CANOPY + 0.1, Math.cos(a) * (C.r + 0.13));
  })), m, false]),
];
RIDE_BUILD.carousel = (group, mat) => {
  const spinner = build(CAROUSEL_SPIN, mat);
  group.add(spinner);
  group.userData.spinner = spinner;
  group.userData.horses = Array.from({ length: CAROUSEL_SEATS }, (_, i) => {
    const [a, r] = carouselAt(i, 0), horse = piece(HORSE_GEOS[i % HORSE_GEOS.length], PAINT_MAT, mat);
    horse.position.set(Math.sin(a) * r, carouselLift(i, 0), Math.cos(a) * r);
    horse.rotation.y = a + Math.PI / 2;
    spinner.add(horse);
    return horse;
  });
};

// Botsauto's (4 bij 3 tegels): een hal met een gladde vloer en een rubberen rand eromheen, zeven palen en een dak
// van glas met een gestreepte rand vol lampjes. Onder het dak hangt het gaas waar de sprieten van de auto's langs
// strijken. Vooraan is de opening waar je de vloer op stapt, met het kastje van de baas ernaast. De zes auto's zijn
// los (zie RIDE_BUILD): het spel laat ze rijden en botsen.
const B = BUMPER;
/** De hal: zo ver staan de palen uit het midden, waar de rand om de vloer ligt (achter en voor), en hoe hoog de dakrand en de nok zijn. */
const HALL = { x: B.ax + 0.16, back: B.z0 - 0.14, front: B.z1 + 0.1, eave: 1.92, ridge: 2.34, mesh: 1.86 };
const HALL_MID = (HALL.back + HALL.front) / 2, HALL_DEEP = HALL.front - HALL.back;
/** Een strook om en om rode en gele vlakken, van `from` tot `to` langs x (of langs z met `turn`), op hoogte y. */
const stripes = (from: number, to: number, y: number, at: number, turn = false): [number, ...THREE.BufferGeometry[]][] => {
  const n = Math.round((to - from) / 0.33), len = (to - from) / n;
  return [0xe0584f, 0xffd23f].map((color, tone): [number, ...THREE.BufferGeometry[]] => [color, ...Array.from({ length: n }, (_, i) => i).filter(i => i % 2 === tone).map(i => {
    const mid = from + (i + 0.5) * len;
    return turn ? boxAt(0.05, 0.2, len, at, y, mid) : boxAt(len, 0.2, 0.05, mid, y, at);
  })]);
};
const HALL_POSTS: [number, number][] = [[-HALL.x, HALL.back], [0, HALL.back], [HALL.x, HALL.back], [-HALL.x, HALL.front], [-0.5, HALL.front], [0.5, HALL.front], [HALL.x, HALL.front]];
/** Een helft van het glazen dak (`side` is -1 achter of 1 voor): een schuin vlak van de dakrand naar de nok. */
const hallRoof = (side: number, thick: number, wide: number): THREE.BufferGeometry => {
  const run = HALL_DEEP / 2 + 0.08, rise = HALL.ridge - HALL.eave, len = Math.hypot(run, rise);
  return new THREE.BoxGeometry(wide, thick, len).rotateX(side * Math.atan2(rise, run)).translate(0, (HALL.eave + HALL.ridge) / 2 + 0.04, HALL_MID + (side * run) / 2);
};
SHOP_PARTS.bumper = [
  floorOf(0xd8c7ab, 4, 3),
  // de gladde vloer en het opstapje voor de opening: plat, zodat de schaduw van de auto's erop valt
  [painted(
    [0x6f7b88, boxAt((B.ax + 0.1) * 2, B.floor, B.z1 - B.z0 + 0.2, 0, B.floor / 2, (B.z0 + B.z1) / 2)],
    [0x8794a2, ...[-1.05, 0, 1.05].map(x => boxAt(0.05, 0.004, B.z1 - B.z0 - 0.3, x, B.floor + 0.002, (B.z0 + B.z1) / 2))],
    [0xd3a868, boxAt(0.9, B.floor, 0.32, 0, B.floor / 2, HALL.front + 0.2)],
  ), MATTE_MAT, false],
  // de rubberen rand om de vloer (vooraan met een opening), met een gele bies bovenop
  [painted(
    [0x2b2f36, boxAt(HALL.x * 2, 0.2, 0.1, 0, 0.1, B.z0 - 0.05), boxAt(0.1, 0.2, HALL_DEEP, -B.ax - 0.05, 0.1, HALL_MID), boxAt(0.1, 0.2, HALL_DEEP, B.ax + 0.05, 0.1, HALL_MID),
      ...[-1, 1].map(s => boxAt(B.ax - 0.4, 0.2, 0.1, s * (B.ax + 0.4) / 2 + s * 0.05, 0.1, B.z1 + 0.05))],
    [0xffd23f, boxAt(HALL.x * 2, 0.03, 0.1, 0, 0.215, B.z0 - 0.05), boxAt(0.1, 0.03, HALL_DEEP, -B.ax - 0.05, 0.215, HALL_MID), boxAt(0.1, 0.03, HALL_DEEP, B.ax + 0.05, 0.215, HALL_MID),
      ...[-1, 1].map(s => boxAt(B.ax - 0.4, 0.03, 0.1, s * (B.ax + 0.4) / 2 + s * 0.05, 0.215, B.z1 + 0.05))],
    // het kastje van de baas, met een groene en een rode knop
    [0x4a90e2, boxAt(0.5, 0.52, 0.26, -1.45, 0.26, HALL.front + 0.22)],
    [0xf7f4ec, boxAt(0.56, 0.04, 0.3, -1.45, 0.54, HALL.front + 0.22)],
    [0x6cc04a, tube(0.045, 0.045, 0.03, -1.56, 0.575, HALL.front + 0.22)],
    [0xe0584f, tube(0.045, 0.045, 0.03, -1.36, 0.575, HALL.front + 0.22), ...HALL_POSTS.map(([x, z]) => boxAt(0.1, HALL.eave, 0.1, x, HALL.eave / 2, z))],
    [0xf7f4ec, ...HALL_POSTS.map(([x, z]) => boxAt(0.12, 0.1, 0.12, x, 0.62, z))],
  ), PAINT_MAT],
  // het dak: balken langs de rand en de nok, sporen eroverheen en de gestreepte rand
  [painted(
    [0xf7f4ec, boxAt(HALL.x * 2 + 0.2, 0.07, 0.07, 0, HALL.ridge + 0.06, HALL_MID), ...[-1, 1].flatMap(s => [-HALL.x, -HALL.x / 2, 0, HALL.x / 2, HALL.x].map(x => hallRoof(s, 0.05, 0.05).translate(x, 0.01, 0)))],
    ...stripes(-HALL.x - 0.05, HALL.x + 0.05, HALL.eave, HALL.back - 0.03), ...stripes(-HALL.x - 0.05, HALL.x + 0.05, HALL.eave, HALL.front + 0.03),
    ...stripes(HALL.back, HALL.front, HALL.eave, -HALL.x - 0.03, true), ...stripes(HALL.back, HALL.front, HALL.eave, HALL.x + 0.03, true),
    // het gaas onder het dak
    [0x4a525c, ...[-1.5, -1, -0.5, 0, 0.5, 1, 1.5].map(x => boxAt(0.016, 0.016, HALL_DEEP, x, HALL.mesh, HALL_MID)), ...[-0.9, -0.45, 0, 0.45, 0.9].map(z => boxAt(HALL.x * 2, 0.016, 0.016, 0, HALL.mesh, HALL_MID + (z * HALL_DEEP) / 2))],
  ), PAINT_MAT],
  // het glas: je kijkt er dwars doorheen naar de auto's
  [merge([hallRoof(-1, 0.02, HALL.x * 2 + 0.16), hallRoof(1, 0.02, HALL.x * 2 + 0.16)]), GLASS_MAT, false],
  // lampjes langs de dakrand: het licht loopt rond
  ...CHASE_MATS.map((m, k): Part => [merge([HALL.back - 0.07, HALL.front + 0.07].flatMap(z => Array.from({ length: 4 }, (_, i) => dot(0.055, -HALL.x + 0.12 + ((i * 3 + k) * (HALL.x * 2 - 0.24)) / 11, HALL.eave - 0.02, z)))), m, false]),
];
/**
 * Een botsauto, met zijn midden op de vloer en de neus naar +z: een rubberen rand, een gekleurde kuip met een
 * rugleuning, een stuur, twee koplampen en achterop de spriet tot aan het gaas onder het dak.
 */
const bumperCarGeo = (color: number): THREE.BufferGeometry => painted(
  [0x2b2f36, new THREE.CylinderGeometry(0.2, 0.2, 0.075, 14).scale(1, 1, 1.22).translate(0, 0.05, 0)],
  [color, new THREE.CylinderGeometry(0.13, 0.185, 0.14, 14).scale(1, 1, 1.22).translate(0, 0.155, 0), boxAt(0.25, 0.2, 0.05, 0, 0.31, -0.18)],
  [0xf7f4ec, new THREE.CylinderGeometry(0.188, 0.188, 0.022, 14).scale(1, 1, 1.22).translate(0, 0.105, 0)],
  [0xffe58a, dot(0.032, -0.08, 0.15, 0.21), dot(0.032, 0.08, 0.15, 0.21)],
  [0x8a8f98, beam(0.02, [0, 0.2, 0.13], [0, 0.34, 0.08]), new THREE.TorusGeometry(0.05, 0.013, 4, 10).rotateX(-1.2).translate(0, 0.35, 0.075),
    boxAt(0.016, HALL.mesh - B.floor - 0.24, 0.016, 0, (HALL.mesh - B.floor + 0.2) / 2, -0.2), boxAt(0.12, 0.02, 0.03, 0, HALL.mesh - B.floor - 0.03, -0.2)],
);
const BUMPER_CAR_GEOS = RIDE_COLORS.map(bumperCarGeo);
/** De vonk boven aan de spriet: je ziet hem alleen even bij een botsing. */
const SPARK_GEO = merge([0, 1, 2].map(i => new THREE.BoxGeometry(0.2, 0.03, 0.03).rotateY((i * Math.PI) / 3)));
RIDE_BUILD.bumper = (group, mat) => {
  const sparks: THREE.Object3D[] = [];
  group.userData.cars = Array.from({ length: B.cars }, (_, i) => {
    const car = piece(BUMPER_CAR_GEOS[i % BUMPER_CAR_GEOS.length], PAINT_MAT, mat), spark = piece(SPARK_GEO, LAMP_MAT, mat, false);
    spark.position.set(0, HALL.mesh - B.floor - 0.02, -0.2);
    spark.visible = false;
    car.add(spark);
    sparks.push(spark);
    group.add(car);
    return car;
  });
  group.userData.sparks = sparks;
};

// Fontein (3 bij 3 tegels): een groot rond bassin met in het midden een zuil met twee schalen boven elkaar. Acht
// stralen staan in een kring en spuiten in een boog naar de onderste schaal; boven uit de bovenste schaal komt de
// grote straal. Ze gaan om de beurt op en neer in een waterballet (zie fountainJet in rides.ts). Onder elke straal
// zit een lampje dat gloeit in het donker.
const FN = FOUNTAIN;
/** Het water van de stralen: bijna wit en een klein beetje doorzichtig; het licht zelf wat op, zodat het ook in het donker te zien is. */
const JET_MAT = new THREE.MeshStandardMaterial({ color: 0xeaf8ff, roughness: 0.2, transparent: true, opacity: 0.82, emissive: 0x8fd0f2, emissiveIntensity: 0.35 });
/** Hoe hoog het water staat: in het bassin, in de onderste schaal en in de bovenste. */
const FOUNTAIN_AT = { water: 0.36, bowl: 1.03, top: 1.53 };
const round = (rTop: number, rBottom: number, h: number, y: number, sides = 24): THREE.BufferGeometry => new THREE.CylinderGeometry(rTop, rBottom, h, sides).translate(0, y, 0);
SHOP_PARTS.fountain = [
  floorOf(0xd8c7ab, 3, 3),
  // het bassin: een brede voet, de wand en een lichte rand bovenop; de zuil met de twee schalen
  [painted(
    [0xa3adb5, round(FN.wall + 0.07, FN.wall + 0.1, 0.07, 0.085)],
    [0xb9c2c9, round(FN.wall - 0.03, FN.wall, 0.26, 0.21), round(0.17, 0.24, 0.72, 0.64, 12), round(0.12, 0.15, 0.44, FOUNTAIN_AT.bowl + 0.2, 12),
      round(0.56, 0.2, 0.17, FOUNTAIN_AT.bowl - 0.105), round(0.3, 0.12, 0.13, FOUNTAIN_AT.top - 0.085, 16)],
    [0xd6dde2, new THREE.TorusGeometry(FN.wall - 0.07, 0.07, 6, 28).rotateX(Math.PI / 2).translate(0, 0.35, 0),
      new THREE.TorusGeometry(0.54, 0.035, 5, 20).rotateX(Math.PI / 2).translate(0, FOUNTAIN_AT.bowl, 0), new THREE.TorusGeometry(0.29, 0.03, 5, 16).rotateX(Math.PI / 2).translate(0, FOUNTAIN_AT.top, 0),
      round(0.27, 0.3, 0.07, 0.33, 12)],
    // de spuitmonden in de kring
    [0x8a8f98, ...around(FN.jets, FN.ring, (x, z) => tube(0.05, 0.065, 0.1, x, FOUNTAIN_AT.water + 0.02, z))],
  ), MATTE_MAT],
  // het water: net boven de bodem van het bassin en van elke schaal
  [merge([round(FN.water, FN.water, 0.02, FOUNTAIN_AT.water - 0.01), round(0.5, 0.5, 0.02, FOUNTAIN_AT.bowl - 0.01, 20), round(0.26, 0.26, 0.02, FOUNTAIN_AT.top - 0.01, 16)]), WATER_MAT, false],
  // dunne gordijntjes water die van de rand van de schalen naar beneden vallen
  [merge([
    ...around(6, 0.56, (x, z, i) => new THREE.BoxGeometry(0.13, FOUNTAIN_AT.bowl - FOUNTAIN_AT.water, 0.014).rotateY((i / 6) * Math.PI * 2).translate(x, (FOUNTAIN_AT.bowl + FOUNTAIN_AT.water) / 2, z)),
    ...around(4, 0.3, (x, z, i) => new THREE.BoxGeometry(0.09, FOUNTAIN_AT.top - FOUNTAIN_AT.bowl, 0.012).rotateY((i / 4) * Math.PI * 2).translate(x, (FOUNTAIN_AT.top + FOUNTAIN_AT.bowl) / 2, z)),
  ]), JET_MAT, false],
  // een lampje onder elke straal en vier op de rand van het bassin
  [merge([...around(FN.jets, FN.ring - 0.13, (x, z) => dot(0.05, x, FOUNTAIN_AT.water + 0.02, z)), ...around(4, FN.wall - 0.07, (x, z) => dot(0.06, x, 0.43, z)).map(g => g.rotateY(Math.PI / 4))]), LAMP_MAT, false],
];
/**
 * Een straal uit de kring, op zijn hoogst: van de spuitmond op (0, 0, 0) in een boog naar het midden (-z), tot in de
 * onderste schaal, met druppels aan het eind. Het beeld maakt hem groter en kleiner vanuit de spuitmond.
 */
const JET_GEO = ((): THREE.BufferGeometry => {
  const reach = FN.ring - 0.3, at = (t: number): P3 => [0, 3.1 * t * (1 - t) + (FOUNTAIN_AT.bowl - FOUNTAIN_AT.water) * t, -reach * t];
  return merge([
    ...Array.from({ length: 7 }, (_, i) => rod(0.046 - i * 0.002, at(i / 7), at((i + 1) / 7), 6, 0.044 - i * 0.002)),
    ball(0.07, ...at(1)), ball(0.05, 0.07, at(0.93)[1], at(0.93)[2] + 0.03), ball(0.045, -0.06, at(0.86)[1] - 0.02, at(0.86)[2]),
  ]);
})();
/** De grote straal in het midden, op zijn hoogst: recht omhoog uit de bovenste schaal, met een pluim van druppels. */
const GEYSER_GEO = merge([tube(0.05, 0.1, 1.05, 0, 0.525, 0), ball(0.1, 0, 1.08, 0), ball(0.06, 0.12, 0.93, 0.04), ball(0.06, -0.1, 0.88, -0.08), ball(0.05, 0.03, 0.82, 0.13), ball(0.045, -0.06, 0.98, 0.1)]);
RIDE_BUILD.fountain = (group, mat) => {
  const jets = Array.from({ length: FN.jets }, (_, i) => {
    const a = (i / FN.jets) * Math.PI * 2, jet = piece(JET_GEO, JET_MAT, mat, false);
    jet.position.set(Math.sin(a) * FN.ring, FOUNTAIN_AT.water + 0.05, Math.cos(a) * FN.ring);
    jet.rotation.y = a;
    group.add(jet);
    return jet;
  });
  const geyser = piece(GEYSER_GEO, JET_MAT, mat, false);
  geyser.position.y = FOUNTAIN_AT.top;
  group.add(geyser);
  group.userData.jets = [...jets, geyser];
};

// Schuilhut: vier palen, een schuin dak, wanden links en achter en een bank langs de achterwand.
SHOP_PARTS.shelter = [
  floorOf(),
  [mergeGeometries([
    ...CORNERS.map(([x, z]) => boxAt(0.1, 1.36, 0.1, x * 0.82, 0.68, z * 0.82)),
    boxAt(1.56, 0.8, 0.05, 0, 0.45, -0.84), boxAt(0.05, 0.8, 1.56, -0.84, 0.45, 0),
    boxAt(1.74, 0.07, 0.07, 0, 1.33, -0.82), boxAt(1.74, 0.07, 0.07, 0, 1.33, 0.82), boxAt(0.07, 0.07, 1.74, -0.82, 1.33, 0), boxAt(0.07, 0.07, 1.74, 0.82, 1.33, 0),
  ])!, WOOD_MAT],
  [mergeGeometries([
    new THREE.BoxGeometry(2, 0.06, 1.08).rotateX(0.3805).translate(0, 1.6, 0.5),
    new THREE.BoxGeometry(2, 0.06, 1.08).rotateX(-0.3805).translate(0, 1.6, -0.5),
  ])!, std(0x3d8b5a)],
  [boxAt(2.04, 0.07, 0.12, 0, 1.82, 0), std(0x2c6a43)],
  [mergeGeometries([boxAt(1.4, 0.06, 0.3, 0, 0.24, -0.62), boxAt(1.4, 0.2, 0.05, 0, 0.42, -0.76), boxAt(0.07, 0.21, 0.26, -0.6, 0.105, -0.62), boxAt(0.07, 0.21, 0.26, 0.6, 0.105, -0.62)])!, FENCE_MAT],
];
// Treinhalte: een perron achter, een afdakje met een bankje, een rond bord met een treintje en een stuk spoor voor.
const SIGN_AT: P3 = [0.7, 1.5, 0];
SHOP_PARTS.station = [
  [boxAt(1.84, 0.12, 1, 0, 0.06, -0.42), std(0xd8c7ab, 1), false],
  [boxAt(1.84, 0.02, 0.06, 0, 0.125, 0.03), P_YELLOW, false],
  [mergeGeometries([
    boxAt(0.08, 1.2, 0.08, -0.6, 0.72, -0.72), boxAt(0.08, 1.2, 0.08, 0.6, 0.72, -0.72),
    boxAt(0.8, 0.05, 0.24, 0, 0.34, -0.7), boxAt(0.06, 0.2, 0.2, -0.34, 0.22, -0.7), boxAt(0.06, 0.2, 0.2, 0.34, 0.22, -0.7),
  ])!, WOOD_MAT],
  [new THREE.BoxGeometry(1.6, 0.07, 0.8).rotateX(0.12).translate(0, 1.37, -0.55), P_RED],
  [boxAt(1.84, 0.02, 0.5, 0, 0.01, 0.6), std(0x9a8f80, 1), false],
  [mergeGeometries([-0.8, -0.6, -0.4, -0.2, 0, 0.2, 0.4, 0.6, 0.8].map(x => boxAt(0.08, 0.03, 0.4, x, 0.03, 0.6)))!, DARK_MAT],
  [mergeGeometries([boxAt(1.84, 0.03, 0.035, 0, 0.06, 0.5), boxAt(1.84, 0.03, 0.035, 0, 0.06, 0.7)])!, METAL],
  [tube(0.025, 0.03, 1.2, SIGN_AT[0], 0.72, SIGN_AT[2]), METAL],
  // het bord en het treintje erop: los, zodat het kan wiebelen
  [new THREE.CylinderGeometry(0.2, 0.2, 0.04, 16).rotateX(Math.PI / 2).translate(...SIGN_AT), P_BLUE],
  [mergeGeometries([
    boxAt(0.2, 0.08, 0.07, SIGN_AT[0], SIGN_AT[1], SIGN_AT[2]), boxAt(0.08, 0.08, 0.07, SIGN_AT[0] - 0.06, SIGN_AT[1] + 0.07, SIGN_AT[2]),
    boxAt(0.035, 0.06, 0.07, SIGN_AT[0] + 0.06, SIGN_AT[1] + 0.07, SIGN_AT[2]),
    boxAt(0.05, 0.05, 0.07, SIGN_AT[0] - 0.06, SIGN_AT[1] - 0.06, SIGN_AT[2]), boxAt(0.05, 0.05, 0.07, SIGN_AT[0] + 0.06, SIGN_AT[1] - 0.06, SIGN_AT[2]),
  ])!, WHITE_MAT],
];
// Bak met paraplu's: een emmer met drie dichte paraplu's die er schuin uit steken.
const brolly = (parts: THREE.BufferGeometry[], x: number, z: number, tiltX: number, tiltZ: number): THREE.BufferGeometry =>
  merge(parts).rotateZ(tiltZ).rotateX(tiltX).translate(x, 0.12, z);
const BROLLY_SPOTS: [number, number, number, number][] = [[-0.06, -0.03, -0.12, 0.2], [0.06, -0.04, -0.16, -0.22], [0, 0.06, 0.24, 0.02]];
const brollyCloth = (): THREE.BufferGeometry[] => [new THREE.ConeGeometry(0.055, 0.5, 6).rotateX(Math.PI).translate(0, 0.25, 0)];
const brollyGrip = (): THREE.BufferGeometry[] => [boxAt(0.02, 0.16, 0.02, 0, 0.58, 0), boxAt(0.07, 0.02, 0.02, 0.025, 0.66, 0)];
SHOP_PARTS.umbrellas = [
  [mergeGeometries([tube(0.17, 0.14, 0.34, 0, 0.17, 0), tube(0.19, 0.19, 0.03, 0, 0.34, 0)])!, std(0x3d4f5a, 0.7)],
  [tube(0.165, 0.155, 0.06, 0, 0.2, 0), P_YELLOW],
  ...BROLLY_SPOTS.map(([x, z, tx, tz], i): Part => [brolly(brollyCloth(), x, z, tx, tz), [P_RED, P_YELLOW, P_GREEN][i]]),
  [merge(BROLLY_SPOTS.map(([x, z, tx, tz]) => brolly(brollyGrip(), x, z, tx, tz))), DARK_MAT],
];

// Tribune voor de dierenshow: drie treden met elk een bankje in rood, geel en blauw. De gasten zitten met hun rug
// naar het pad (de voorkant) en kijken naar het water erachter. Aan het pad staat een rond bord met een dolfijn
// die een bal op zijn neus houdt, en bij het water wapperen twee vlaggetjes.
const SHOW_SIGN: P3 = [0.64, 1.3, 0.86];
const SHOW_BENCH = [0xe0584f, 0xffd23f, 0x4a90e2];
const showDolphin = (): THREE.BufferGeometry =>
  painted(
    [0x7fa9cc, blob(0.07, 2, 0.72, 0.42, 0, 0, 0), blob(0.03, 1.7, 0.7, 0.7, 0.15, -0.01, 0), cone(0.032, 0.07, -0.01, 0.07, 0, 3), beam(0.024, [-0.12, 0, 0], [-0.19, 0.05, 0]), beam(0.024, [-0.12, 0, 0], [-0.19, -0.05, 0])],
    [0xf7f4ec, blob(0.05, 1.8, 0.4, 0.4, 0.02, -0.026, 0.012)],
    [0x22201c, dot(0.012, 0.09, 0.016, 0.03)],
    [0xe0584f, ball(0.035, 0.2, 0.08, 0)],
  ).rotateZ(0.42).translate(SHOW_SIGN[0], SHOW_SIGN[1], SHOW_SIGN[2] + 0.04);
SHOP_PARTS.show = [
  floorOf(),
  // de treden, en een witte rand langs de voorkant van elke trede
  [merge(SHOW_ROWS.map(r => boxAt(1.76, r.h - 0.1, 0.55, 0, (r.h - 0.1) / 2, r.z))), std(0x9fb4c4, 0.9)],
  [merge(SHOW_ROWS.map(r => boxAt(1.78, 0.02, 0.04, 0, r.h - 0.09, r.z - 0.26))), WHITE_MAT],
  // de bankjes: een zitting, een leuning en twee pootjes
  [painted(...SHOW_ROWS.map((r, i): [number, ...THREE.BufferGeometry[]] => [
    SHOW_BENCH[i], boxAt(1.6, 0.05, 0.2, 0, r.h - 0.025, r.z + 0.02), boxAt(1.6, 0.14, 0.04, 0, r.h + 0.1, r.z + 0.14),
  ]), [0x6c7078, ...SHOW_ROWS.flatMap(r => [-0.72, 0.72].flatMap(x => [boxAt(0.05, 0.06, 0.16, x, r.h - 0.08, r.z + 0.02), boxAt(0.04, 0.2, 0.04, x, r.h + 0.03, r.z + 0.14)]))]), PAINT_MAT],
  // de zijkanten: blauw, trapsgewijs omhoog
  [merge(SHOW_ROWS.flatMap(r => [-0.89, 0.89].map(x => boxAt(0.04, r.h - 0.04, 0.55, x, (r.h - 0.04) / 2, r.z)))), P_BLUE],
  // het bord: een paal, een rond bord met een gele rand en de dolfijn erop (los, zodat het kan wiebelen)
  [tube(0.025, 0.03, SHOW_SIGN[1], SHOW_SIGN[0], SHOW_SIGN[1] / 2, SHOW_SIGN[2]), METAL],
  [painted(
    [0x9fd8f5, new THREE.CylinderGeometry(0.26, 0.26, 0.04, 18).rotateX(Math.PI / 2).translate(...SHOW_SIGN)],
    [0xffd23f, new THREE.TorusGeometry(0.26, 0.025, 6, 20).translate(...SHOW_SIGN)],
  ), PAINT_MAT],
  [showDolphin(), PAINT_MAT],
  // twee vlaggetjes aan de kant van het water
  [merge([-0.84, 0.84].map(x => tube(0.016, 0.02, 1.1, x, 0.55, -0.84))), METAL],
  [painted(
    [0xe0584f, new THREE.BoxGeometry(0.26, 0.15, 0.02).translate(-0.84 + 0.13, 1.0, -0.84)],
    [0xffd23f, new THREE.BoxGeometry(0.26, 0.15, 0.02).translate(0.84 - 0.13, 1.0, -0.84)],
  ), PAINT_MAT],
];

// Huisje van de kabelbaan: een houten perron met vier palen en een rood puntdak. Onder het dak hangt aan een as het
// grote wiel; dat wiel, de kabel en de stoeltjes komen pas als er twee huisjes zijn (zie makeCable). De gasten
// wachten in de hoekjes. Voor staat een rond bord met een stoeltje, en in de winter ligt er sneeuw op het dak.
const CABLE_SIGN: P3 = [0.4, 1.3, 0.93];
/** Sneeuw op de kabelbaan: alleen in de winter te zien (zie applySeason). */
const CABLE_SNOW_MAT = std(0xf7fbff, 1);
CABLE_SNOW_MAT.visible = false;
const cableRoof = (lift: number, thick: number, deep: number): THREE.BufferGeometry =>
  merge([-1, 1].map(s => new THREE.BoxGeometry(2.04 - lift, thick, deep).rotateX(s * 0.5).translate(0, 1.92 + lift, s * 0.5)));
SHOP_PARTS.cablecar = [
  floorOf(0xcfc6b6),
  [boxAt(1.72, 0.1, 1.72, 0, 0.07, 0), std(0xd9b98c), false],
  [merge([
    ...CORNERS.map(([x, z]) => boxAt(0.1, 1.55, 0.1, x * 0.8, 0.895, z * 0.8)),
    boxAt(1.7, 0.07, 0.07, 0, 1.64, 0.8), boxAt(1.7, 0.07, 0.07, 0, 1.64, -0.8), boxAt(0.07, 0.07, 1.7, 0.8, 1.64, 0), boxAt(0.07, 0.07, 1.7, -0.8, 1.64, 0),
  ]), WOOD_MAT],
  [cableRoof(0, 0.07, 1.16), P_RED],
  [boxAt(2.1, 0.08, 0.12, 0, 2.2, 0), std(0xb8433b)],
  [cableRoof(0.05, 0.05, 1.08), CABLE_SNOW_MAT, false],
  // de as van het wiel en de motor erboven, onder de nok
  [tube(0.045, 0.045, 0.8, 0, 1.46, 0), METAL],
  [merge([boxAt(0.34, 0.2, 0.3, 0, 1.94, 0), tube(0.1, 0.1, 0.06, 0, 1.82, 0)]), P_YELLOW],
  // het bord: een paal, en een blauw rond bord met een wit stoeltje aan de kabel (los, zodat het kan wiebelen)
  [tube(0.025, 0.03, CABLE_SIGN[1], CABLE_SIGN[0], CABLE_SIGN[1] / 2, CABLE_SIGN[2]), METAL],
  [new THREE.CylinderGeometry(0.2, 0.2, 0.04, 16).rotateX(Math.PI / 2).translate(...CABLE_SIGN), P_BLUE],
  [merge([
    new THREE.BoxGeometry(0.32, 0.025, 0.07).rotateZ(-0.15).translate(CABLE_SIGN[0], CABLE_SIGN[1] + 0.1, CABLE_SIGN[2]),
    boxAt(0.02, 0.12, 0.07, CABLE_SIGN[0], CABLE_SIGN[1] + 0.04, CABLE_SIGN[2]),
    boxAt(0.15, 0.03, 0.07, CABLE_SIGN[0] + 0.01, CABLE_SIGN[1] - 0.03, CABLE_SIGN[2]),
    boxAt(0.03, 0.1, 0.07, CABLE_SIGN[0] - 0.055, CABLE_SIGN[1] + 0.005, CABLE_SIGN[2]),
  ]), WHITE_MAT],
];
/** De kleuren van de stoeltjes, om de beurt. */
const CHAIR_COLORS = [0xe0584f, 0xffd23f, 0x4a90e2, 0x6cc04a, 0xf08a24, 0xa06ad9, 0xf06aa6, 0x2bb5a8];
const CABLE_MAT = std(0x3d4f5a, 0.6);
/**
 * Een stoeltje voor twee, met zijn draaipunt aan de kabel en zijn voorkant naar +z: een klem, een stang naar de
 * rugleuning, een zitting en een rug in een vrolijke kleur, armleuningen en een beugel voor.
 */
const chairGeo = (color: number): THREE.BufferGeometry => {
  const y = -CABLE.hang;
  return painted(
    [color, boxAt(0.5, 0.05, 0.26, 0, y, -0.02), boxAt(0.5, 0.26, 0.04, 0, y + 0.16, -0.15)],
    [0x8a8f98,
      boxAt(0.08, 0.08, 0.14, 0, -0.02, 0), beam(0.035, [0, -0.04, 0], [0, y + 0.33, -0.16]), boxAt(0.52, 0.03, 0.03, 0, y + 0.32, -0.16),
      ...[-1, 1].flatMap(s => [boxAt(0.03, 0.3, 0.03, s * 0.25, y + 0.17, -0.16), boxAt(0.03, 0.03, 0.3, s * 0.25, y + 0.2, 0.01)]),
      boxAt(0.52, 0.025, 0.025, 0, y + 0.2, 0.16)],
  );
};

// Bij het wc-gebouw: een bordje met een mannetje en een vrouwtje tussen de deuren, twee deurmatten, een rand
// onder het dak en een luchtpijp erop. Achteraan in de lijst, zodat de nummers van de andere onderdelen blijven.
SHOP_PARTS.toilet.push([painted(
  [0xf7f4ec, boxAt(0.26, 0.3, 0.02, 0, 0.62, 0.56)],
  [0x4a90e2, ball(0.03, -0.06, 0.71, 0.575), boxAt(0.06, 0.13, 0.016, -0.06, 0.59, 0.572)],
  [0xf06aa6, ball(0.03, 0.06, 0.71, 0.575), new THREE.ConeGeometry(0.055, 0.14, 4).scale(1, 1, 0.2).translate(0.06, 0.6, 0.572)],
  [0x3a78c2, boxAt(1.9, 0.04, 1.64, 0, 1.19, -0.12)],
  [0x8a6a4a, boxAt(0.4, 0.012, 0.2, -0.42, 0.056, 0.72), boxAt(0.4, 0.012, 0.2, 0.42, 0.056, 0.72)],
  [0x9aa0a6, tube(0.05, 0.05, 0.22, 0.55, 1.43, -0.5), tube(0.08, 0.08, 0.03, 0.55, 1.55, -0.5)],
), PAINT_MAT]);

/**
 * Wat op of aan een gebouw zachtjes wiegt: de onderdelen (hun nummer in SHOP_PARTS) komen samen in een eigen
 * groepje dat om het punt `at` draait. `amp`: hoe ver het op en neer gaat, `sway`: hoe ver het heen en weer
 * zwaait, `yaw`: hoe ver het om zijn as draait (een vlag).
 */
interface Bob {
  parts: number[];
  at: P3;
  amp?: number;
  sway?: number;
  yaw?: number;
}
const SHOP_BOB: Partial<Record<ShopKind, Bob[]>> = {
  foodstall: [{ parts: [8, 9], at: [0, 1.55, -0.05] }],
  drinkstall: [{ parts: [8, 9, 10], at: [0, 1.55, -0.05] }],
  icecream: [{ parts: [8, 9, 10], at: [0, 1.55, -0.05] }],
  balloon: [8, 9, 10, 11].map((i): Bob => ({ parts: [i], at: STALL_TIE, amp: 0.03, sway: 0.09 })),
  hats: [{ parts: [7, 8, 9], at: [0, 1.55, -0.05] }],
  souvenir: [{ parts: [7, 8], at: [0, 1.55, -0.05] }],
  facepaint: [{ parts: [7, 8], at: [0, 1.55, -0.05] }],
  flowers: [0, 1, 2].map((i): Bob => ({ parts: [2 + i * 2, 3 + i * 2], at: [-0.22 + i * 0.22, 0.22, 0], amp: 0, sway: 0.1 })),
  tower: [{ parts: [6], at: [0, TOWER_ROOF + 0.72, 0], amp: 0, sway: 0, yaw: 0.5 }],
  restaurant: RESTAURANT_TABLES.map(([x, z], i): Bob => ({ parts: [10 + i], at: [x, 1.32, z], amp: 0.012, sway: 0.05 })),
  station: [{ parts: [8, 9], at: [SIGN_AT[0], 1.3, SIGN_AT[2]], amp: 0, sway: 0.07 }],
  umbrellas: [{ parts: [2, 3, 4, 5], at: [0, 0.3, 0], amp: 0, sway: 0.06 }],
  show: [{ parts: [6, 7], at: [SHOW_SIGN[0], 1.05, SHOW_SIGN[2]], amp: 0, sway: 0.07 }],
  cablecar: [{ parts: [9, 10], at: [CABLE_SIGN[0], 1.1, CABLE_SIGN[2]], amp: 0, sway: 0.07 }],
};
// De wc-deuren: elk om zijn buitenste rand, met de klink aan de binnenkant.
const DOOR_GEOS = [-1, 1].map(side => boxAt(0.5, 0.86, 0.05, -side * 0.25, 0.45, 0));
const KNOB_GEOS = [-1, 1].map(side => boxAt(0.07, 0.07, 0.05, -side * 0.41, 0.45, 0.04));

// ------------------------------------------------------------ meer voor in een verblijf
const HILL = TOY_LIFT.hill ?? 0.34, ROCKS = TOY_LIFT.rocks ?? 0.3, FRAME = TOY_LIFT.frame ?? 0.8;
// heuvel: een ronde bult gras met plukjes gras, bloemen en een kei
const HILL_SHAPE = [[0.48, 0], [0.45, 0.1], [0.37, 0.21], [0.25, 0.29], [0.12, 0.33], [0, 0.34]].map(([r, y]) => new THREE.Vector2(r, (y * HILL) / 0.34));
TOY_PARTS.hill = [
  [new THREE.LatheGeometry(HILL_SHAPE, 11), std(0x7cc053, 1)],
  [merge([[0.34, 0.14, 0.12], [-0.3, 0.14, -0.2], [-0.1, 0.13, 0.36], [0.22, 0.26, -0.16], [-0.26, 0.2, 0.16], [0.08, 0.17, -0.38]].map(([x, y, z], i) => cone(0.035, 0.12, x, y + 0.04, z, 4).rotateY(i))), LEAF2],
  [merge([blooms([[-0.36, 0.17, 0.14, 0xffd23f], [0.14, 0.18, -0.34, 0xf7f4ec], [0.3, 0.21, 0.2, 0xf06aa6]], 0.065), paint(stone(0.14, 0.1, 0.12, -0.16, 0.14, 0.38, 0.5), 0xa9adb3)]), PAINT_MAT],
];
// rotsen: platte keien op elkaar, de bovenste is vlak
TOY_PARTS.rocks = [
  [merge([prism(0.42, 0.47, 0.14, 0, 0.07, 0, 7, 0.3).scale(1, 1, 0.86), stone(0.3, 0.24, 0.26, 0.3, -0.03, 0.29, 0.5), stone(0.13, 0.1, 0.12, 0.36, -0.02, -0.3, 2)]), ROCK_MAT],
  [merge([prism(0.28, 0.33, ROCKS - 0.14, -0.06, (ROCKS + 0.14) / 2, -0.04, 6, 0.8), stone(0.22, 0.18, 0.2, -0.34, -0.03, 0.31, 1.3)]), STONE_MAT],
];
// drinkvijver: een rand van ronde keien met water erin, en wat riet erbij
TOY_PARTS.drink = [
  [merge([tube(0.38, 0.42, 0.1, 0, 0.05, 0), ...around(8, 0.37, (x, z, i) => stone(0.18 + (i % 3) * 0.02, 0.12 + (i % 2) * 0.03, 0.16, x, 0.02, z, i * 1.3))]), STONE],
  [merge([rod(0.012, [-0.3, 0.1, -0.22], [-0.33, 0.46, -0.24], 4), rod(0.012, [-0.24, 0.1, -0.28], [-0.22, 0.38, -0.3], 4), rod(0.012, [-0.34, 0.1, -0.14], [-0.4, 0.34, -0.12], 4), tube(0.07, 0.07, 0.012, 0.1, 0.118, 0.08)]), STEM_MAT],
  [tube(0.3, 0.3, 0.02, 0, 0.105, 0), WATER_MAT, false],
];
// waterval: een rots met keien ertegen en een bakje ervoor; het vallende water als laatste
TOY_PARTS.fall = [
  [merge([
    boxAt(0.7, 0.4, 0.3, 0, 0.2, -0.3), boxAt(0.5, 0.3, 0.26, -0.04, 0.55, -0.32), boxAt(0.24, 0.14, 0.2, 0.22, 0.47, -0.3),
    stone(0.3, 0.34, 0.28, 0.34, -0.04, -0.26, 0.6), stone(0.28, 0.28, 0.26, -0.36, -0.04, -0.24, 1.2), stone(0.3, 0.2, 0.24, 0.16, 0.56, -0.36, 0.4), stone(0.22, 0.18, 0.2, -0.3, 0.36, -0.34, 2),
  ]), ROCK_MAT],
  [merge([tube(0.32, 0.34, 0.08, 0, 0.04, 0.12), ...around(5, 0.31, (x, z, i) => stone(0.15, 0.1 + (i % 2) * 0.03, 0.13, x * 0.9 + 0.02, 0.02, 0.14 + Math.abs(z) * 0.9, i * 1.1))]), STONE],
  [tube(0.27, 0.27, 0.02, 0, 0.085, 0.12), WATER_MAT, false],
  [boxAt(0.18, 0.03, 0.2, -0.04, 0.715, -0.26), WATER_MAT, false],
  [boxAt(0.18, 0.64, 0.04, -0.04, 0.4, -0.165), SPRAY_MAT, false],
];
// warmtelamp: een paal met een hangende lamp die oranjerood gloeit, en een warme gloed op de grond
const HEAT_MAT = new THREE.MeshStandardMaterial({ color: 0xff6a3a, emissive: 0xff3a10, emissiveIntensity: 1.3, roughness: 0.4 });
const GLOW_MAT = new THREE.MeshBasicMaterial({ color: 0xff8a3a, transparent: true, opacity: 0.28, depthWrite: false });
TOY_PARTS.lamp = [
  [merge([tube(0.03, 0.04, 1.05, -0.34, 0.525, -0.2), tube(0.1, 0.12, 0.05, -0.34, 0.025, -0.2), beam(0.04, [-0.34, 1.03, -0.2], [0.02, 1.03, 0.01]), boxAt(0.02, 0.12, 0.02, 0, 0.97, 0)]), std(0x3d4f5a, 0.7)],
  [merge([cone(0.17, 0.14, 0, 0.86, 0), tube(0.175, 0.175, 0.02, 0, 0.795, 0), ball(0.03, 0, 0.94, 0)]), std(0xc9553f, 0.6)],
  [ball(0.075, 0, 0.78, 0), HEAT_MAT, false],
  [new THREE.CircleGeometry(0.4, 18).rotateX(-Math.PI / 2).translate(0, 0.012, 0), GLOW_MAT, false],
];
// ijsblok: doorzichtige blauwe blokken ijs met wat sneeuw erop
const ICE_MAT = new THREE.MeshStandardMaterial({ color: 0xa9dcf5, roughness: 0.15, transparent: true, opacity: 0.8 });
TOY_PARTS.icebox = [
  [mergeGeometries([
    boxAt(0.46, 0.4, 0.42, -0.12, 0.2, -0.08),
    new THREE.BoxGeometry(0.3, 0.26, 0.3).rotateY(0.5).translate(0.24, 0.13, 0.2),
    new THREE.BoxGeometry(0.22, 0.18, 0.2).rotateY(-0.3).translate(-0.22, 0.09, 0.3),
  ])!, ICE_MAT],
  [merge([
    blob(0.25, 1, 0.2, 0.9, -0.12, 0.41, -0.08), blob(0.15, 1, 0.25, 1, 0.24, 0.265, 0.2), blob(0.11, 1, 0.25, 1, -0.22, 0.185, 0.3),
    tube(0.44, 0.47, 0.02, 0, 0.01, 0), blob(0.07, 1, 0.8, 1, 0.34, 0.04, -0.2), blob(0.05, 1, 0.8, 1, -0.38, 0.03, 0.08),
  ]), WHITE_MAT, false],
];
// waterfilter: een blauw kastje met een ruitje, twee lampjes en een rooster waar het water in gaat, een pijp die boven
// het water uitkomt, en als laatste onderdeel de bellen (het spel laat ze omhoog borrelen, zie animateToys in game.ts)
const BUBBLE_MAT = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.1, transparent: true, opacity: 0.8 });
TOY_PARTS.filter = [
  [painted(
    [0x4a90e2, boxAt(0.42, 0.48, 0.32, 0, 0.29, 0)],
    [0x2f6fb8, boxAt(0.46, 0.06, 0.36, 0, 0.55, 0), boxAt(0.46, 0.05, 0.36, 0, 0.025, 0)],
    [0x9fd8f5, boxAt(0.26, 0.1, 0.02, 0, 0.4, 0.165)],
    [0xffd23f, dot(0.032, -0.08, 0.22, 0.17)],
    [0x6cc04a, dot(0.032, 0.08, 0.22, 0.17)],
    [0x24558f, ...[0.16, 0.26, 0.36].map(y => boxAt(0.02, 0.04, 0.22, -0.215, y, 0))],
  ), PAINT_MAT],
  [merge([tube(0.045, 0.045, 0.34, 0.12, 0.74, -0.06), tube(0.065, 0.065, 0.04, 0.12, 0.91, -0.06)]), std(0x8a8f98, 0.5)],
  [merge([[0.12, 0.98, -0.06, 0.05], [0.16, 1.08, -0.03, 0.036], [0.09, 1.16, -0.08, 0.028], [-0.12, 0.64, 0.06, 0.04], [-0.05, 0.72, -0.08, 0.03]].map(([x, y, z, r]) => ball(r, x, y, z))), BUBBLE_MAT, false],
];
// klimrek: een vlonder op vier palen (bovenop is het vrij: daar staat een dier), een ladder, sporten en een touw
TOY_PARTS.frame = [
  [merge([
    ...CORNERS.map(([x, z]) => boxAt(0.08, FRAME - 0.06, 0.08, x * 0.37, (FRAME - 0.06) / 2, z * 0.37)),
    ...[0.25, 0.5].flatMap(y => [boxAt(0.74, 0.04, 0.04, 0, y, -0.37), boxAt(0.04, 0.04, 0.74, -0.37, y, 0)]),
    beam(0.04, [-0.14, 0, 0.48], [-0.14, FRAME - 0.03, 0.45]), beam(0.04, [0.14, 0, 0.48], [0.14, FRAME - 0.03, 0.45]),
    ...[0.16, 0.32, 0.48, 0.64].map(y => boxAt(0.3, 0.035, 0.035, 0, y, 0.475)),
  ]), WOOD_MAT],
  [painted(
    [0xe3c08a, ...[-2, 0, 2].map(i => boxAt(0.166, 0.06, 0.86, i * 0.172, FRAME - 0.03, 0))],
    [0xd3ad74, ...[-1, 1].map(i => boxAt(0.166, 0.06, 0.86, i * 0.172, FRAME - 0.03, 0))],
  ), MATTE_MAT],
  [merge([rod(0.014, [0.45, FRAME - 0.02, 0.1], [0.45, FRAME - 0.56, 0.1], 5), dot(0.04, 0.45, FRAME - 0.58, 0.1), dot(0.026, 0.45, FRAME - 0.36, 0.1), boxAt(0.08, 0.03, 0.03, 0.43, FRAME - 0.015, 0.1)]), std(0xe8dcc0, 1)],
];
// tunnel: een boog van planken, open aan de twee korte kanten (hij ligt langs x)
const tunnelArch = (odd: number): THREE.BufferGeometry =>
  mergeGeometries([-75, -50, -25, 0, 25, 50, 75].filter((_, i) => i % 2 === odd).map(deg =>
    new THREE.BoxGeometry(0.9, 0.07, 0.19).translate(0, 0.38, 0).rotateX((deg * Math.PI) / 180).translate(0, 0.04, 0)))!;
TOY_PARTS.tunnel = [
  [tunnelArch(0), WOOD_MAT],
  [tunnelArch(1), FENCE_MAT],
  [mergeGeometries([
    boxAt(0.9, 0.08, 0.1, 0, 0.04, -0.39), boxAt(0.9, 0.08, 0.1, 0, 0.04, 0.39),
    ...[-0.44, 0.44].flatMap(x => [-75, -50, -25, 0, 25, 50, 75].map(deg => new THREE.BoxGeometry(0.05, 0.03, 0.2).translate(x, 0.43, 0).rotateX((deg * Math.PI) / 180).translate(0, 0.04, 0))),
  ])!, DARK_MAT],
];

// ------------------------------------------------------------ speelgoed dat zelf beweegt
// Bij de wipplank, de slingerbal, de kruipboog, de bandenschommel en de klimpaal is het LAATSTE onderdeel het losse
// stuk: het spel laat het bewegen om het punt uit TOY_PIVOT (zie `swayToy` in game.ts en `swingPart` hieronder).
// Komt er een onderdeel bij, zet het dan vóór het losse stuk.
const ROPE = 0xe8dcc0;
const pivotOf = (kind: ToyKind): [number, number, number] => TOY_PIVOT[kind] ?? [0, 0, 0];
// autoband: 0 = een band die plat in de hoek ligt; de band die rechtop staat ligt los en rolt (zie TOY_LOOSE)
TOY_PARTS.tyre = [
  [painted(...tyreGeo(0.2, 0.065)).rotateZ(Math.PI / 2).translate(-0.25, 0.065, -0.25), MATTE_MAT],
];
// wipplank: 0 = de liggende stam waar hij op rust, 1 = de plank (los: hij wipt om de bovenkant van de stam, langs x)
const ROCK_Y = pivotOf('rocker')[1];
TOY_PARTS.rocker = [
  [painted(
    [0xa8743f, new THREE.CylinderGeometry(0.09, 0.09, 0.56, 9).rotateX(Math.PI / 2).translate(0, ROCK_Y - 0.09, 0)],
    [0xe3c08a, ...[-0.285, 0.285].map(z => new THREE.CylinderGeometry(0.07, 0.07, 0.012, 9).rotateX(Math.PI / 2).translate(0, ROCK_Y - 0.09, z))],
    [0x80552c, ...CORNERS.map(([x, z]) => boxAt(0.05, 0.1, 0.05, x * 0.1, 0.05, z * 0.22))],
  ), MATTE_MAT],
  [painted(
    [0xe3c08a, boxAt(0.8, 0.045, 0.4, 0, ROCK_Y + 0.0225, 0)],
    [0xc58a4b, ...[-0.3, -0.15, 0.15, 0.3].map(x => boxAt(0.035, 0.018, 0.4, x, ROCK_Y + 0.054, 0))],
    // een rood en een blauw uiteinde
    [0xe0584f, boxAt(0.075, 0.05, 0.41, -0.435, ROCK_Y + 0.0225, 0)],
    [0x4a90e2, boxAt(0.075, 0.05, 0.41, 0.435, ROCK_Y + 0.0225, 0)],
  ), MATTE_MAT],
];
// slingerbal: 0 = de paal op zijn voet, 1 = het touw met de bal (los: hij draait om de paal en zwaait naar buiten)
const TETHER_Y = pivotOf('tetherball')[1];
TOY_PARTS.tetherball = [
  [painted(
    [0xa8743f, tube(0.035, 0.045, TETHER_Y + 0.03, 0, (TETHER_Y + 0.03) / 2, 0)],
    [0x8a8f98, tube(0.15, 0.18, 0.05, 0, 0.025, 0), tube(0.07, 0.1, 0.05, 0, 0.075, 0)],
    [0x4a90e2, tube(0.05, 0.05, 0.06, 0, 0.62, 0), tube(0.048, 0.048, 0.06, 0, 0.8, 0)],
    [0xe0584f, ball(0.06, 0, TETHER_Y + 0.06, 0)],
  ), PAINT_MAT],
  [painted(
    [ROPE, rod(0.013, [0.03, TETHER_Y, 0], [0.17, 0.53, 0], 5)],
    [0xffd23f, ball(0.13, 0.17, 0.42, 0)],
    [0xe0584f, tube(0.133, 0.133, 0.05, 0.17, 0.42, 0)],
  ), PAINT_MAT],
];
// kruipboog: 0 = twee palen met een dwarsbalk, 1 = de slierten met kralen (los: ze zwaaien om de dwarsbalk, langs z)
const ARCH_Y = pivotOf('logarch')[1];
const STRIPS: [number, number, number][] = [[-0.27, 0.4, 0xe0584f], [-0.135, 0.5, 0xffd23f], [0, 0.42, 0x4a90e2], [0.135, 0.52, 0xf06aa6], [0.27, 0.38, 0x6cc04a]];
TOY_PARTS.logarch = [
  [painted(
    [0xa8743f, ...[-0.42, 0.42].map(x => tube(0.065, 0.075, ARCH_Y + 0.04, x, (ARCH_Y + 0.04) / 2, 0)), new THREE.CylinderGeometry(0.06, 0.06, 0.98, 8).rotateZ(Math.PI / 2).translate(0, ARCH_Y + 0.05, 0)],
    [0xe3c08a, ...[-0.494, 0.494].map(x => new THREE.CylinderGeometry(0.046, 0.046, 0.012, 8).rotateZ(Math.PI / 2).translate(x, ARCH_Y + 0.05, 0))],
    [0x80552c, ...[-0.42, 0.42].map(x => prism(0.1, 0.12, 0.06, x, 0.03, 0, 6))],
    // een paar blaadjes boven op de balk
    [0x5fa544, blob(0.07, 1.5, 0.4, 1, -0.2, ARCH_Y + 0.12, 0.02, 0), blob(0.06, 1.3, 0.4, 1, 0.14, ARCH_Y + 0.12, -0.02, 0)],
  ), MATTE_MAT],
  [painted(
    [ROPE, ...STRIPS.map(([x, len]) => boxAt(0.022, len, 0.022, x, ARCH_Y - len / 2, 0))],
    ...STRIPS.map(([x, len, color]): [number, THREE.BufferGeometry] => [color, dot(0.045, x, ARCH_Y - len - 0.02, 0)]),
  ), PAINT_MAT],
];
// bandenschommel: 0 = het houten rek, 1 = de band aan twee touwen (los: hij schommelt om de bovenbalk, langs z)
const SWING_Y = pivotOf('tyreswing')[1], SEAT_Y = SWING.seat - 0.07;
TOY_PARTS.tyreswing = [
  [merge([
    ...[-0.43, 0.43].flatMap(x => [-0.3, 0.3].map(z => beam(0.065, [x, 0, z], [x, SWING_Y + 0.02, 0]))),
    ...[-0.43, 0.43].map(x => boxAt(0.045, 0.045, 0.36, x, 0.5, 0)),
    boxAt(0.98, 0.08, 0.08, 0, SWING_Y + 0.02, 0),
  ]), WOOD_MAT],
  [merge([
    painted(...tyreGeo(0.26, 0.07)).rotateZ(Math.PI / 2).translate(0, SEAT_Y, 0),
    painted([ROPE, ...[-0.19, 0.19].map(x => boxAt(0.025, SWING_Y - SEAT_Y - 0.04, 0.025, x, (SWING_Y + SEAT_Y + 0.04) / 2, 0))]),
  ]), MATTE_MAT],
];
// klimpaal: 0 = de paal met touw eromheen, drie sporten en een vlonder bovenop (daar zit een dier), 1 = een touw met
// een knoop aan de rand van de vlonder (los: het bungelt)
const POLE = TOY_LIFT.pole ?? 1, [POLE_X, POLE_Y, POLE_Z] = pivotOf('pole');
TOY_PARTS.pole = [
  [painted(
    [0xa8743f, tube(0.08, 0.1, POLE - 0.06, 0, (POLE - 0.06) / 2, 0), prism(0.15, 0.19, 0.06, 0, 0.03, 0, 7)],
    [ROPE, ...[0.3, 0.38, 0.46].map(y => tube(0.099, 0.101, 0.07, 0, y, 0))],
    [0x80552c, ...[[0.18, 0.4], [0.6, 2.5], [0.76, 4.6]].map(([y, a]) => rod(0.025, [0, y, 0], [Math.cos(a) * 0.2, y + 0.02, Math.sin(a) * 0.2], 5))],
    [0xd3ad74, prism(0.2, 0.11, 0.08, 0, POLE - 0.1, 0, 8)],
    [0xe3c08a, prism(0.33, 0.33, 0.06, 0, POLE - 0.03, 0, 8)],
  ), MATTE_MAT],
  [merge([rod(0.014, [POLE_X, POLE_Y, POLE_Z], [POLE_X, POLE_Y - 0.42, POLE_Z], 5), dot(0.04, POLE_X, POLE_Y - 0.44, POLE_Z), dot(0.026, POLE_X, POLE_Y - 0.24, POLE_Z)]), std(ROPE, 1)],
];
// De stam van een boom: onderaan breder, met een voet en twee takken die de kruin in gaan.
const trunk = (h: number, r: number): THREE.BufferGeometry => merge([
  new THREE.CylinderGeometry(r * 0.62, r, h, 7).translate(0, h / 2, 0),
  prism(r * 1.15, r * 1.6, 0.07, 0, 0.035, 0, 6),
  rod(r * 0.36, [0, h * 0.62, 0], [r * 1.7, h + 0.06, r * 0.6], 5, r * 0.26),
  rod(r * 0.32, [0, h * 0.7, 0], [-r * 1.5, h + 0.04, -r * 0.8], 5, r * 0.22),
]);
// een palmblad: eerst schuin omhoog, dan naar beneden gebogen, met een smalle punt
const palmFrond = (i: number): THREE.BufferGeometry => {
  const k = i % 2 ? 0.82 : 1;
  return merge([
    new THREE.BoxGeometry(0.34, 0.035, 0.17).translate(0.17, 0, 0).rotateZ(0.35),
    new THREE.BoxGeometry(0.3, 0.03, 0.13).translate(0.15, 0, 0).rotateZ(-0.45).translate(0.319, 0.117, 0),
    new THREE.BoxGeometry(0.17, 0.025, 0.07).translate(0.085, 0, 0).rotateZ(-0.95).translate(0.589, -0.014, 0),
  ]).scale(k, k, k).rotateZ(i % 2 ? -0.22 : 0).rotateY((i * Math.PI) / 3 + 0.2).translate(0, 1.1, 0);
};
const PALM_TRUNK: [P3, number][] = [[[0, 0, 0], 0.085], [[0.035, 0.3, 0], 0.078], [[0.05, 0.6, 0], 0.07], [[0.035, 0.88, 0], 0.062], [[0, 1.1, 0], 0.055]];
// een roos: een knop met een donker hartje
const rose = (x: number, y: number, z: number, color: number, heart: number): THREE.BufferGeometry[] =>
  [paint(blob(0.062, 1, 0.85, 1, x, y, z, 0), color), paint(blob(0.03, 1, 1, 1, x, y + 0.042, z, 0), heart)];
// een tulp: een kelkje op een steel
const tulip = (x: number, y: number, z: number, color: number, inside: number): THREE.BufferGeometry[] =>
  [paint(new THREE.CylinderGeometry(0.06, 0.03, 0.11, 6).translate(x, y, z), color), paint(tube(0.044, 0.044, 0.012, x, y + 0.052, z), inside)];
const TULIPS: [number, number, number, number, number][] = [-0.3, -0.15, 0, 0.15, 0.3].flatMap((x, i): [number, number, number, number, number][] => [
  [x, 0.34, -0.08, [0xe0584f, 0xffd23f][i % 2], [0xb8403a, 0xe0a92a][i % 2]],
  [x, 0.32, 0.08, [0xffd23f, 0xb06ad9][i % 2], [0xe0a92a, 0x8a4cb5][i % 2]],
]);
// paddenstoelen: een steel, een bolle hoed en witte stippen. [x, z, hoe hoog de steel is, hoe breed de hoed is]
const SHROOMS: [number, number, number, number][] = [[-0.16, 0.06, 0.2, 0.17], [0.14, -0.1, 0.14, 0.13], [0.1, 0.2, 0.1, 0.1]];
const shroomDots = ([x, z, h, r]: [number, number, number, number], n: number): THREE.BufferGeometry[] => [0, 1, 2, 3, 4].map(k => {
  const up = k === 4 ? 0 : 0.75, turn = k * 1.57 + n;
  return blob(r * 0.15, 1, 0.5, 1, x + Math.sin(up) * Math.cos(turn) * r, h + 0.01 + Math.cos(up) * r * 0.75, z + Math.sin(up) * Math.sin(turn) * r, 0);
});
// een zonnebloem kijkt naar voren: een krans van blaadjes rond een bruin hart
const sunPetals = (x: number, y: number): THREE.BufferGeometry[] => Array.from({ length: 9 }, (_, k) =>
  blob(0.05, 0.62, 1.3, 0.35, 0, 0.115, 0, 0).rotateZ((k * Math.PI * 2) / 9).translate(x, y, 0.03));
const SUNS: [number, number][] = [[-0.26, 0.7], [0, 0.78], [0.26, 0.86]];
// een pompoen: een platte bol met banen
const pumpkin = (r: number, x: number, z: number): THREE.BufferGeometry =>
  striped(new THREE.SphereGeometry(r, 10, 6).scale(1, 0.78, 1), [0xf08a24, 0xe27a1c], 10).translate(x, r * 0.74, z);
// de boog van de bloemenboog: een halve cirkel van zes stukken op twee palen
const ARCH: P3[] = Array.from({ length: 7 }, (_, i): P3 => [-Math.cos((i * Math.PI) / 6) * 0.4, 0.92 + Math.sin((i * Math.PI) / 6) * 0.4, 0]);
// een wiek: een lat met een licht zeil van latjes ernaast
const sail = (i: number): THREE.BufferGeometry[][] => [
  [boxAt(0.47, 0.035, 0.025, 0.235, 0, 0), boxAt(0.02, 0.13, 0.02, 0.17, 0.065, 0), boxAt(0.02, 0.13, 0.02, 0.3, 0.065, 0), boxAt(0.02, 0.13, 0.02, 0.44, 0.065, 0)],
  [boxAt(0.3, 0.1, 0.012, 0.3, 0.075, 0)],
].map(list => list.map(g => g.rotateZ((i * Math.PI) / 2)));
const SAILS = [0, 1, 2, 3].map(sail);
// een baan van de vlag: om en om een stukje naar voren en naar achteren gedraaid, zodat het doek golft
const flagStrip = (i: number, y: number, thick: number): THREE.BufferGeometry =>
  new THREE.BoxGeometry(0.128, 0.1, thick).rotateY(i % 2 ? 0.32 : -0.32).translate(0.03 + 0.0608 + i * 0.1216, y, 0.02);
// wat op het open gastenboek ligt, ligt net zo schuin als het boek
const onBook = (g: THREE.BufferGeometry): THREE.BufferGeometry => g.rotateX(0.45).translate(0, 0.736, 0.037);
const totemEyes = (y: number): THREE.BufferGeometry[][] => [
  [boxAt(0.1, 0.1, 0.02, -0.08, y, 0.185), boxAt(0.1, 0.1, 0.02, 0.08, y, 0.185)],
  [boxAt(0.045, 0.045, 0.02, -0.08, y - 0.01, 0.195), boxAt(0.045, 0.045, 0.02, 0.08, y - 0.01, 0.195)],
];
const DECOR_PARTS: Record<DecorKind, Part[]> = {
  tree: [
    [trunk(0.62, 0.1), WOOD_MAT],
    [TREE_CROWNS[0], LEAF_MAT],
    [TREE_SHADES[0], LEAF2],
  ],
  pine: [
    [merge([new THREE.CylinderGeometry(0.05, 0.07, 0.32, 6).translate(0, 0.16, 0), prism(0.08, 0.11, 0.05, 0, 0.025, 0, 6)]), WOOD_MAT],
    [PINE_CROWNS[0], LEAF2],
  ],
  // palm: een gebogen stam, zes bladeren die naar beneden hangen en kokosnoten
  palm: [
    [merge(PALM_TRUNK.slice(1).map(([p, r], i) => rod(PALM_TRUNK[i][1], PALM_TRUNK[i][0], p, 7, r))), std(0xb88a52, 1)],
    [merge([0, 1, 2, 3, 4, 5].map(palmFrond)), PALM_MAT],
    [merge([ball(0.065, 0.07, 1.04, 0.03), ball(0.065, -0.05, 1.02, -0.05), ball(0.06, 0.0, 1.0, 0.08)]), std(0x6b4a2a)],
  ],
  // lang en smal: een heg is precies een tegel lang, zodat een rij heggen één geheel wordt
  hedge: [
    [boxAt(1, 0.4, 0.3, 0, 0.2, 0), LEAF2],
    [merge([-0.375, -0.125, 0.125, 0.375].map((x, i) => blob(0.17, 1, 0.6 + (i % 2) * 0.14, 0.95, x, 0.4, 0))), LEAF_MAT],
  ],
  roses: [
    [boxAt(0.94, 0.05, 0.34, 0, 0.025, 0), DARK_MAT, false],
    [merge([ball(0.15, -0.32, 0.19, -0.02), ball(0.17, -0.1, 0.21, 0.03), ball(0.16, 0.12, 0.2, -0.03), ball(0.15, 0.33, 0.19, 0.02)]), LEAF2],
    [merge([blob(0.08, 1, 0.7, 1, -0.22, 0.31, -0.06), blob(0.08, 1, 0.7, 1, 0.02, 0.33, 0.08), blob(0.07, 1, 0.7, 1, 0.26, 0.31, -0.08)]), LEAF_MAT],
    [merge([
      ...rose(-0.32, 0.36, -0.05, 0xd8362e, 0xa82a24), ...rose(0.12, 0.38, -0.08, 0xd8362e, 0xa82a24), ...rose(0.36, 0.35, 0.05, 0xd8362e, 0xa82a24),
      ...rose(-0.1, 0.4, 0.07, 0xf06aa6, 0xd04a86), ...rose(0.24, 0.37, 0.09, 0xf06aa6, 0xd04a86),
      ...rose(-0.22, 0.36, 0.1, 0xf7f4ec, 0xf3d9a8), ...rose(0.02, 0.38, -0.1, 0xf7f4ec, 0xf3d9a8),
    ]), PAINT_MAT],
  ],
  tulips: [
    [boxAt(0.94, 0.05, 0.36, 0, 0.025, 0), DARK_MAT, false],
    [merge(TULIPS.flatMap(([x, y, z], i) => [
      boxAt(0.025, y - 0.06, 0.025, x, y / 2 - 0.005, z),
      new THREE.ConeGeometry(0.035, 0.2, 4).scale(1, 1, 0.35).rotateZ(i % 2 ? 0.4 : -0.4).translate(x + (i % 2 ? -0.035 : 0.035), 0.14, z),
    ])), STEM_MAT],
    [merge(TULIPS.flatMap(([x, y, z, color, inside]) => tulip(x, y, z, color, inside))), PAINT_MAT],
  ],
  mushrooms: [
    [merge(SHROOMS.flatMap(([x, z, h, r], n) => [tube(r * 0.3, r * 0.36, h, x, h / 2, z), tube(r * 0.9, r * 0.5, 0.02, x, h, z), ...shroomDots([x, z, h, r], n)])), WHITE_MAT],
    [merge(SHROOMS.map(([x, z, h, r]) => new THREE.SphereGeometry(r, 9, 4, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.75, 1).translate(x, h + 0.01, z))), std(0xd8362e, 0.6)],
  ],
  // vijver: een rand van keien met riet erachter; het water, de bladeren en de waterlelie (met een kikker) bewegen los
  pond: [
    [painted(
      [0x9aa3ab, tube(0.43, 0.45, 0.08, 0, 0.04, 0)],
      [0xb9c2c9, ...around(10, 0.41, (x, z, i) => stone(0.16, 0.1 + (i % 3) * 0.025, 0.13, x, 0.03, z, i * 0.9)).filter((_, i) => i % 2 === 0)],
      [0x8f949c, ...around(10, 0.41, (x, z, i) => stone(0.16, 0.1 + (i % 3) * 0.025, 0.13, x, 0.03, z, i * 0.9)).filter((_, i) => i % 2 === 1)],
      [0x5fa544, rod(0.012, [-0.3, 0.1, -0.3], [-0.34, 0.5, -0.32], 4), rod(0.012, [-0.36, 0.1, -0.22], [-0.42, 0.42, -0.2], 4), rod(0.012, [-0.24, 0.1, -0.36], [-0.2, 0.4, -0.4], 4)],
      [0x6b4a2a, rod(0.026, [-0.335, 0.4, -0.318], [-0.342, 0.52, -0.322], 6), rod(0.024, [-0.41, 0.34, -0.203], [-0.425, 0.44, -0.198], 6)],
    ), MATTE_MAT],
    [tube(0.37, 0.37, 0.03, 0, 0.085, 0), WATER_MAT, false],
    [mergeGeometries([tube(0.1, 0.1, 0.012, -0.14, 0.106, 0.1), tube(0.08, 0.08, 0.012, 0.16, 0.106, -0.08), tube(0.06, 0.06, 0.012, 0.04, 0.106, 0.22)])!, STEM_MAT, false],
    [painted(
      [0xf48fb1, ...[0, 1, 2, 3, 4, 5].map(i => new THREE.ConeGeometry(0.022, 0.07, 4).translate(0, 0.035, 0).rotateZ(0.6).rotateY(i * 1.05).translate(-0.14, 0.11, 0.1))],
      [0xffd23f, dot(0.02, -0.14, 0.135, 0.1)],
      [0x6cc04a, blob(0.036, 1, 0.8, 1.2, 0.16, 0.135, -0.08), dot(0.016, 0.146, 0.165, -0.055), dot(0.016, 0.174, 0.165, -0.055)],
    ), PAINT_MAT],
  ],
  // waterval: een steile rots met keien ertegen, mos erop en een bakje ervoor
  waterfall: [
    [painted(
      [0x8f949c, boxAt(0.8, 0.5, 0.4, 0, 0.25, -0.22), boxAt(0.6, 0.4, 0.36, -0.06, 0.7, -0.24), boxAt(0.34, 0.26, 0.3, 0.06, 1.02, -0.26)],
      [0x7d828a, stone(0.32, 0.5, 0.32, 0.33, -0.05, -0.2, 0.5), stone(0.26, 0.3, 0.26, -0.33, 0.42, -0.3, 2.1), stone(0.3, 0.22, 0.26, -0.12, 1.0, -0.34, 0.3)],
      [0xa0a5ad, stone(0.3, 0.42, 0.3, -0.35, -0.05, -0.2, 1.3), stone(0.3, 0.34, 0.3, 0.28, 0.44, -0.28, 0.9), stone(0.2, 0.18, 0.2, 0.22, 1.0, -0.3, 1.7)],
      [0x86b85c, blob(0.12, 1.2, 0.4, 1, 0.3, 0.8, -0.26, 0), blob(0.1, 1.2, 0.4, 1, -0.34, 0.74, -0.28, 0), blob(0.09, 1.2, 0.4, 1, 0.06, 1.16, -0.26, 0)],
    ), MATTE_MAT],
    [merge([boxAt(0.2, 0.74, 0.05, 0.02, 0.66, -0.03), boxAt(0.24, 0.26, 0.05, 0.02, 0.16, 0.0), ball(0.07, -0.08, 0.1, 0.06), ball(0.06, 0.12, 0.09, 0.05)]), SPRAY_MAT, false],
    [merge([tube(0.4, 0.42, 0.07, 0, 0.035, 0.18), ...around(5, 0.38, (x, z, i) => stone(0.15, 0.1 + (i % 2) * 0.03, 0.13, x * 0.95, 0.01, 0.2 + Math.abs(z) * 0.72, i * 1.1))]), STONE],
    [tube(0.34, 0.34, 0.03, 0, 0.07, 0.18), WATER_MAT, false],
  ],
  // waterput: een ronde muur van stenen, een dakje op twee palen met een zwengel, en een emmer aan een touw
  well: [
    [painted(
      [0xb9c2c9, tube(0.3, 0.32, 0.34, 0, 0.17, 0)],
      [0xcfd6dc, tube(0.335, 0.335, 0.05, 0, 0.345, 0)],
      [0x9aa3ab, ...around(7, 0.3, (x, z, i) => stone(0.13, 0.09, 0.1, x, 0.03, z, i)), ...around(7, 0.3, (x, z, i) => stone(0.12, 0.09, 0.1, x, 0.17, z, i + 0.6)).map(g => g.rotateY(0.45))],
    ), MATTE_MAT],
    [tube(0.22, 0.22, 0.03, 0, 0.36, 0), WATER_MAT, false],
    [mergeGeometries([
      boxAt(0.06, 0.7, 0.06, -0.3, 0.55, 0), boxAt(0.06, 0.7, 0.06, 0.3, 0.55, 0), boxAt(0.76, 0.045, 0.045, 0, 0.74, 0),
      boxAt(0.03, 0.13, 0.03, 0.39, 0.69, 0), boxAt(0.09, 0.03, 0.03, 0.42, 0.63, 0),
    ])!, WOOD_MAT],
    [painted([0xc9553f, cone(0.5, 0.3, 0, 1.05, 0, 4)], [0xa8432f, boxAt(0.74, 0.035, 0.74, 0, 0.9, 0), ball(0.04, 0, 1.21, 0)]), MATTE_MAT],
    [painted([0xa8743f, tube(0.075, 0.06, 0.1, 0, 0.6, 0)], [0x5a3d22, tube(0.078, 0.078, 0.022, 0, 0.63, 0)], [0xe8dcc0, rod(0.01, [0, 0.64, 0], [0, 0.74, 0], 4)]), MATTE_MAT],
  ],
  // standbeeld: een gouden leeuw die rechtop zit, op een stenen sokkel met een plaatje
  statue: [
    [painted(
      [0xb9c2c9, boxAt(0.6, 0.1, 0.6, 0, 0.05, 0)],
      [0xa7b1b9, boxAt(0.44, 0.3, 0.44, 0, 0.25, 0)],
      [0xc8cfd5, boxAt(0.52, 0.06, 0.52, 0, 0.43, 0)],
      [0xd9b24a, boxAt(0.24, 0.12, 0.02, 0, 0.26, 0.225)],
    ), MATTE_MAT],
    [merge([
      blob(0.15, 0.95, 1.15, 1.05, 0, 0.63, -0.04), blob(0.1, 1, 0.8, 1.2, -0.11, 0.53, -0.06), blob(0.1, 1, 0.8, 1.2, 0.11, 0.53, -0.06),
      tube(0.035, 0.04, 0.26, -0.07, 0.59, 0.1), tube(0.035, 0.04, 0.26, 0.07, 0.59, 0.1), blob(0.045, 1, 0.6, 1.4, -0.07, 0.485, 0.13), blob(0.045, 1, 0.6, 1.4, 0.07, 0.485, 0.13),
      blob(0.16, 1, 1, 0.72, 0, 0.87, 0, 0), ball(0.105, 0, 0.89, 0.07), blob(0.055, 1, 0.8, 1, 0, 0.86, 0.16), ball(0.036, -0.085, 0.99, 0.05), ball(0.036, 0.085, 0.99, 0.05),
      rod(0.018, [0, 0.5, -0.18], [0.17, 0.5, -0.2], 5), ball(0.036, 0.19, 0.52, -0.2),
    ]), GOLD_MAT],
  ],
  topiary: [
    [painted([0xc9553f, tube(0.18, 0.13, 0.2, 0, 0.1, 0)], [0xb5472f, tube(0.2, 0.2, 0.045, 0, 0.19, 0)], [0x5a3d22, tube(0.165, 0.165, 0.012, 0, 0.214, 0)]), MATTE_MAT],
    [boxAt(0.07, 0.4, 0.07, 0, 0.36, 0), WOOD_MAT],
    [mergeGeometries([ball(0.3, 0, 0.7, 0), ball(0.2, 0, 1.08, 0), ball(0.12, 0, 1.34, 0)])!, LEAF2],
  ],
  lantern: [
    [mergeGeometries([tube(0.035, 0.05, 1.0, 0, 0.5, 0), tube(0.1, 0.12, 0.06, 0, 0.03, 0), tube(0.065, 0.085, 0.05, 0, 0.085, 0), tube(0.05, 0.05, 0.03, 0, 0.62, 0), tube(0.1, 0.045, 0.05, 0, 1.02, 0)])!, std(0x3d4f5a, 0.7)],
    // het licht: om zijn eigen midden, zodat het kan flakkeren (zie buildDecor)
    [new THREE.CylinderGeometry(0.115, 0.085, 0.2, 4).rotateY(Math.PI / 4), LAMP_MAT],
    // het kapje, met vier dunne stijlen om het licht
    [merge([
      cone(0.17, 0.12, 0, 1.31, 0, 4), ball(0.03, 0, 1.385, 0), boxAt(0.2, 0.02, 0.2, 0, 1.045, 0),
      ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([x, z]) => boxAt(0.016, 0.21, 0.016, x * 0.078, 1.15, z * 0.078)),
    ]), std(0x3d4f5a, 0.7)],
  ],
  // De lampen hieronder: onderdeel 1 is steeds het licht zelf, om zijn eigen midden, zodat het kan flakkeren en
  // 's nachts fel brandt (zie buildDecor en animateDecor).
  // tuinlampje: een lage paal met een lichtende bol onder een kapje
  gardenlight: [
    [merge([tube(0.03, 0.04, 0.22, 0, 0.11, 0), tube(0.08, 0.1, 0.04, 0, 0.02, 0), cone(0.15, 0.09, 0, 0.42, 0, 8), ball(0.022, 0, 0.475, 0)]), std(0x3d4f5a, 0.7)],
    [new THREE.IcosahedronGeometry(0.1, 1), LAMP_MAT, false],
  ],
  // lampion: een stok met een haak, en een papieren lampion met een rood dopje boven en onder en een kwastje
  lampion: [
    [merge([tube(0.028, 0.036, 1.25, -0.1, 0.625, 0), tube(0.08, 0.1, 0.04, -0.1, 0.02, 0), rod(0.022, [-0.1, 1.24, 0], [0.12, 1.3, 0], 6), rod(0.012, [0.12, 1.3, 0], [0.12, 1.16, 0], 5)]), std(0x7a5230, 0.9)],
    [new THREE.IcosahedronGeometry(0.15, 1).scale(1, 1.15, 1), LAMP_MAT, false],
    [merge([tube(0.07, 0.085, 0.045, 0.12, 1.155, 0), tube(0.085, 0.07, 0.045, 0.12, 0.825, 0), tube(0.012, 0.012, 0.1, 0.12, 0.76, 0), ball(0.028, 0.12, 0.7, 0)]), std(0xe0584f, 0.7)],
  ],
  // fakkel: een bamboe stok met een schaal, en een vlam
  torch: [
    [painted(
      [0xb98a55, tube(0.03, 0.04, 0.92, 0, 0.46, 0), tube(0.045, 0.045, 0.03, 0, 0.35, 0), tube(0.045, 0.045, 0.03, 0, 0.65, 0)],
      [0x3d4f5a, tube(0.1, 0.05, 0.1, 0, 0.96, 0)],
    ), PAINT_MAT],
    [merge([cone(0.075, 0.24, 0, 0.07, 0, 6), ball(0.07, 0, -0.03, 0)]), FLAME_MAT, false],
  ],
  // straatlamp: een hoge paal met een boog en aan elke kant een lamp
  streetlamp: [
    [merge([
      tube(0.04, 0.055, 1.5, 0, 0.75, 0), tube(0.11, 0.13, 0.06, 0, 0.03, 0), tube(0.07, 0.09, 0.05, 0, 0.085, 0),
      rod(0.026, [0, 1.48, 0], [-0.24, 1.56, 0], 6), rod(0.026, [0, 1.48, 0], [0.24, 1.56, 0], 6),
      cone(0.13, 0.08, -0.24, 1.52, 0, 8), cone(0.13, 0.08, 0.24, 1.52, 0, 8), ball(0.04, 0, 1.52, 0),
    ]), std(0x3d4f5a, 0.7)],
    [merge([new THREE.IcosahedronGeometry(0.095, 1).translate(-0.24, 0, 0), new THREE.IcosahedronGeometry(0.095, 1).translate(0.24, 0, 0)]), LAMP_MAT, false],
  ],
  // vlag: het doek golft in vier banen, rood met een gele streep
  flag: [
    [mergeGeometries([tube(0.03, 0.035, 1.5, 0, 0.75, 0), tube(0.1, 0.12, 0.05, 0, 0.025, 0)])!, WHITE_MAT],
    [painted(
      [0xe0584f, ...[0, 1, 2, 3].flatMap(i => [1.4, 1.2].map(y => flagStrip(i, y, 0.02)))],
      [0xffd23f, ...[0, 1, 2, 3].map(i => flagStrip(i, 1.3, 0.022))],
    ), PAINT_MAT],
    [ball(0.05, 0, 1.52, 0), GOLD_MAT],
  ],
  // wegwijzer: twee borden met een punt, elk een andere kant op
  signpost: [
    [merge([boxAt(0.08, 0.95, 0.08, 0, 0.475, 0), cone(0.07, 0.07, 0, 0.985, 0, 4)]), WOOD_MAT],
    [painted(
      [0xf7f4ec, boxAt(0.42, 0.14, 0.04, 0.16, 0.82, 0.05), new THREE.CylinderGeometry(0.081, 0.081, 0.04, 3).rotateX(Math.PI / 2).rotateZ(Math.PI / 2).translate(0.41, 0.82, 0.05)],
      [0x9fd8f5, boxAt(0.42, 0.14, 0.04, -0.16, 0.6, 0.05), new THREE.CylinderGeometry(0.081, 0.081, 0.04, 3).rotateX(Math.PI / 2).rotateZ(-Math.PI / 2).translate(-0.41, 0.6, 0.05)],
      [0x3d4f5a, boxAt(0.26, 0.022, 0.05, 0.16, 0.845, 0.05), boxAt(0.18, 0.022, 0.05, 0.12, 0.795, 0.05)],
      [0xf7f4ec, boxAt(0.26, 0.022, 0.05, -0.16, 0.625, 0.05), boxAt(0.18, 0.022, 0.05, -0.12, 0.575, 0.05)],
    ), PAINT_MAT],
  ],
  // kei: een paar ronde stenen met mos en een plukje gras
  boulder: [
    [painted(
      [0x8f949c, stone(0.52, 0.38, 0.44, -0.06, -0.05, 0, 0.3)],
      [0xa0a5ad, stone(0.3, 0.26, 0.3, 0.24, -0.04, 0.14, 1.1), stone(0.14, 0.1, 0.12, -0.3, -0.02, 0.26, 0.4)],
      [0x7d828a, stone(0.26, 0.2, 0.24, -0.12, 0.22, -0.02, 2)],
      [0x86b85c, blob(0.11, 1.2, 0.35, 1, 0.02, 0.3, 0.06, 0)],
      [0x6fb44c, cone(0.03, 0.14, 0.32, 0.07, -0.12, 4), cone(0.03, 0.11, 0.38, 0.055, -0.06, 4), cone(0.03, 0.12, -0.36, 0.06, -0.14, 4)],
    ), MATTE_MAT],
  ],
  // cactus: een ronde stam met twee armen, stekels en bloemen
  cactus: [
    [merge([
      tube(0.12, 0.13, 0.66, 0, 0.33, 0), blob(0.12, 1, 0.8, 1, 0, 0.66, 0),
      tube(0.06, 0.06, 0.24, -0.27, 0.5, 0), blob(0.06, 1, 0.9, 1, -0.27, 0.62, 0), tube(0.06, 0.06, 0.18, 0.27, 0.62, 0), blob(0.06, 1, 0.9, 1, 0.27, 0.71, 0),
    ]), CACTUS_MAT],
    [merge([rod(0.055, [-0.1, 0.38, 0], [-0.27, 0.38, 0], 7), ball(0.062, -0.27, 0.38, 0), rod(0.055, [0.1, 0.53, 0], [0.27, 0.53, 0], 7), ball(0.062, 0.27, 0.53, 0)]), CACTUS_MAT],
    [merge([
      ...bloom(0, 0.765, 0, 0xf06aa6, 0.07), ...bloom(-0.27, 0.68, 0, 0xffd23f, 0.045),
      ...[[0.2, 0.3], [1.5, 0.5], [2.9, 0.22], [4.2, 0.44], [5.4, 0.12], [0.9, 0.14], [3.6, 0.58], [2.1, 0.36]].map(([a, y]) => paint(boxAt(0.022, 0.022, 0.022, Math.cos(a) * 0.13, y, Math.sin(a) * 0.13), 0xf3ead6)),
    ]), PAINT_MAT],
  ],
  // bamboe: stengels met knopen en spitse blaadjes
  bamboogrove: [
    [merge([[-0.24, 1.2, -0.1], [-0.08, 1.4, 0.12], [0.1, 1.1, -0.14], [0.24, 1.3, 0.06], [0, 0.9, 0.24]].flatMap(([x, h, z]) => [
      tube(0.03, 0.036, h, x, h / 2, z), ...[0.3, 0.6, 0.9, 1.2].filter(y => y < h - 0.05).map(y => tube(0.041, 0.041, 0.025, x, y, z)),
    ])), std(0x8cc152, 0.7)],
    [merge([[-0.24, 1.2, -0.1], [-0.08, 1.4, 0.12], [0.1, 1.1, -0.14], [0.24, 1.3, 0.06], [0, 0.9, 0.24]].flatMap(([x, h, z], i) => [0, 1, 2].map(k =>
      blob(0.12, 1, 0.14, 0.36, 0.11, 0, 0, 0).rotateZ(-0.35 - k * 0.12).rotateY(i * 1.3 + k * 2.2).translate(x, h - 0.05 - k * 0.16, z)))), LEAF_MAT],
  ],
  // zonnebloemen: de stelen, de gele blaadjes en de bruine harten knikken samen (zie animateDecor)
  sunflowers: [
    [boxAt(0.94, 0.05, 0.3, 0, 0.025, 0), DARK_MAT, false],
    [merge(SUNS.flatMap(([x, y]) => [
      boxAt(0.035, y - 0.04, 0.035, x, y / 2, 0),
      blob(0.09, 1, 0.2, 0.55, 0.09, 0, 0, 0).rotateZ(0.5).translate(x, y * 0.42, 0), blob(0.09, 1, 0.2, 0.55, -0.09, 0, 0, 0).rotateZ(-0.5).translate(x, y * 0.58, 0),
    ])), STEM_MAT],
    [merge(SUNS.flatMap(([x, y]) => sunPetals(x, y))), std(0xffd23f)],
    [mergeGeometries(SUNS.map(([x, y]) => new THREE.CylinderGeometry(0.085, 0.085, 0.06, 9).rotateX(Math.PI / 2).translate(x, y, 0.035)))!, std(0x6b4a2a)],
  ],
  cherry: [
    [trunk(0.6, 0.095), std(0x7a4f2c, 1)],
    [merge([ball(0.38, 0, 0.9, 0), ball(0.26, 0.22, 1.16, 0.06), ball(0.18, -0.06, 1.24, 0.2)]), CHERRY_A],
    [merge([ball(0.26, -0.22, 1.08, -0.1), ball(0.16, 0.05, 1.36, -0.05), ball(0.2, 0.26, 0.86, -0.16)]), CHERRY_B],
  ],
  // pompoenen: platte bollen met banen en een steeltje, op een paar grote bladeren
  pumpkins: [
    [merge([
      pumpkin(0.21, -0.12, 0), pumpkin(0.14, 0.2, 0.14), pumpkin(0.11, 0.14, -0.2),
      ...[[-0.12, 0.32, 0, 0.05], [0.2, 0.21, 0.14, 0.04], [0.14, 0.165, -0.2, 0.035]].map(([x, y, z, h]) => paint(rod(0.022, [x, y - 0.02, z], [x + 0.02, y + h, z], 5, 0.014), 0x6b8f3a)),
    ]), PAINT_MAT],
    [merge([blob(0.14, 1, 0.12, 0.8, 0.14, 0.03, -0.02, 0), blob(0.12, 0.8, 0.12, 1, -0.3, 0.03, 0.2, 0), blob(0.1, 1, 0.12, 0.8, -0.02, 0.03, -0.3, 0)]), LEAF2],
  ],
  // vogelbadje: een schaal op een voet; het vogeltje hipt (zie animateDecor)
  birdbath: [
    [merge([
      tube(0.2, 0.22, 0.05, 0, 0.025, 0), tube(0.13, 0.17, 0.06, 0, 0.08, 0), tube(0.055, 0.075, 0.46, 0, 0.34, 0), tube(0.1, 0.06, 0.05, 0, 0.575, 0), tube(0.32, 0.14, 0.1, 0, 0.63, 0),
      new THREE.TorusGeometry(0.31, 0.024, 5, 14).rotateX(Math.PI / 2).translate(0, 0.682, 0),
    ]), STONE],
    [tube(0.27, 0.27, 0.02, 0, 0.685, 0), WATER_MAT, false],
    [painted(
      [0x4a90e2, blob(0.06, 0.85, 0.85, 1.25, 0.14, 0.76, 0.04), ball(0.042, 0.14, 0.82, 0.11)],
      [0xcfe6f7, blob(0.045, 0.8, 0.6, 1, 0.14, 0.735, 0.07)],
      [0x2f6fb5, boxAt(0.035, 0.012, 0.08, 0.14, 0.775, -0.06), blob(0.04, 0.35, 0.6, 1, 0.09, 0.768, 0.03), blob(0.04, 0.35, 0.6, 1, 0.19, 0.768, 0.03)],
      [0x22201c, dot(0.01, 0.112, 0.835, 0.135), dot(0.01, 0.168, 0.835, 0.135)],
    ), PAINT_MAT],
    [new THREE.ConeGeometry(0.014, 0.045, 4).rotateX(Math.PI / 2).translate(0.14, 0.815, 0.168), std(0xffd23f)],
  ],
  // pomp: een ronde groene pomp met een tuit op een steen, en een emmertje eronder
  pump: [
    [boxAt(0.56, 0.07, 0.56, 0, 0.035, 0), STONE],
    [merge([
      tube(0.07, 0.085, 0.66, -0.08, 0.4, 0), tube(0.11, 0.12, 0.05, -0.08, 0.095, 0), tube(0.088, 0.088, 0.03, -0.08, 0.5, 0), blob(0.08, 1, 0.7, 1, -0.08, 0.74, 0),
      rod(0.035, [-0.04, 0.6, 0], [0.17, 0.6, 0], 7), tube(0.036, 0.036, 0.08, 0.17, 0.575, 0), boxAt(0.03, 0.1, 0.03, -0.08, 0.81, 0.02),
    ]), std(0x2f6e4f, 0.6)],
    // de zwengel: los en om zijn scharnier, zodat hij op en neer kan (zie buildDecor)
    [merge([new THREE.BoxGeometry(0.045, 0.045, 0.44).translate(0, 0, -0.2), ball(0.04, 0, 0, -0.42)]), std(0x3d4f5a, 0.6)],
    [painted([0xa8743f, tube(0.11, 0.09, 0.15, 0.2, 0.145, 0)], [0x6b7480, tube(0.107, 0.107, 0.02, 0.2, 0.19, 0), tube(0.097, 0.097, 0.02, 0.2, 0.1, 0)]), MATTE_MAT],
    [tube(0.09, 0.09, 0.02, 0.2, 0.215, 0), WATER_MAT, false],
  ],
  // bloemenboog: twee palen met een ronde boog, begroeid met blad en bloemen aan twee kanten
  arch: [
    [merge([boxAt(0.07, 0.94, 0.07, -0.4, 0.47, 0), boxAt(0.07, 0.94, 0.07, 0.4, 0.47, 0), ...ARCH.slice(1).map((p, i) => beam(0.07, ARCH[i], p))]), WHITE_MAT],
    [merge([
      ...[1, 2, 3, 4, 5].map(i => ball(0.13 + (i % 2) * 0.02, ARCH[i][0], ARCH[i][1] + 0.02, 0)),
      ball(0.12, -0.4, 0.9, 0), ball(0.12, 0.4, 0.9, 0), ball(0.1, -0.4, 0.6, 0.02), ball(0.1, 0.4, 0.52, -0.02), ball(0.09, -0.4, 0.3, -0.02), ball(0.08, 0.4, 0.24, 0.02),
    ]), LEAF_MAT],
    [blooms([
      [-0.4, 1.02, 0.11, 0xf06aa6, Math.PI / 2], [0.12, 1.37, 0.12, 0xf06aa6, Math.PI / 2], [0.4, 0.74, 0.1, 0xf7f4ec, Math.PI / 2], [-0.22, 1.3, 0.12, 0xe0584f, Math.PI / 2], [0.33, 1.2, 0.12, 0xe0584f, Math.PI / 2],
      [-0.33, 1.18, -0.12, 0xf06aa6, -Math.PI / 2], [0.1, 1.37, -0.12, 0xe0584f, -Math.PI / 2], [0.4, 0.86, -0.1, 0xf06aa6, -Math.PI / 2],
    ], 0.08), PAINT_MAT],
  ],
  // molen: een witte toren op een stenen voet, met raampjes, een rode kap en vier wieken met zeilen
  windmill: [
    [painted(
      [0xeedfc0, tube(0.17, 0.3, 0.9, 0, 0.45, 0)],
      [0xb9c2c9, tube(0.305, 0.32, 0.14, 0, 0.07, 0)],
      [0xa8743f, tube(0.27, 0.27, 0.03, 0, 0.5, 0)],
      [0x4a5a6a, boxAt(0.09, 0.11, 0.04, 0.13, 0.66, 0.16), boxAt(0.04, 0.11, 0.09, 0.225, 0.36, 0.12), boxAt(0.09, 0.11, 0.04, -0.12, 0.3, 0.235)],
    ), MATTE_MAT],
    [merge([cone(0.22, 0.24, 0, 1.02, 0), ball(0.035, 0, 1.15, 0), rod(0.035, [0, 0.92, 0.08], [0, 0.92, 0.23], 7)]), std(0xc9553f)],
    // de deur leunt mee met de schuine wand, met een stoepje ervoor
    [mergeGeometries([new THREE.BoxGeometry(0.14, 0.25, 0.03).rotateX(-0.143).translate(0, 0.125, 0.315), boxAt(0.2, 0.025, 0.07, 0, 0.0125, 0.36)])!, WOOD_MAT],
    // de wieken: los en om hun eigen midden, zodat ze kunnen draaien (zie buildDecor)
    [painted(
      [0x8a5a2e, ...SAILS.flatMap(s => s[0]), new THREE.CylinderGeometry(0.045, 0.045, 0.05, 8).rotateX(Math.PI / 2)],
      [0xfffaf0, ...SAILS.flatMap(s => s[1])],
    ), MATTE_MAT],
  ],
  // vogelverschrikker: een hemd met een lap erop, strohanden, een gezicht, een hoed en een kraai op zijn arm
  scarecrow: [
    [mergeGeometries([boxAt(0.06, 1.0, 0.06, 0, 0.5, 0), boxAt(0.82, 0.06, 0.06, 0, 0.74, 0)])!, WOOD_MAT],
    [painted(
      [0xc9553f, boxAt(0.34, 0.36, 0.16, 0, 0.64, 0), boxAt(0.2, 0.13, 0.13, -0.27, 0.74, 0), boxAt(0.2, 0.13, 0.13, 0.27, 0.74, 0)],
      [0x4a90e2, boxAt(0.1, 0.1, 0.012, -0.08, 0.57, 0.082)],
      [0xffd23f, boxAt(0.035, 0.035, 0.012, 0.05, 0.7, 0.082), boxAt(0.035, 0.035, 0.012, 0.05, 0.6, 0.082)],
      [0xe9d05a, boxAt(0.1, 0.08, 0.08, -0.41, 0.74, 0), boxAt(0.1, 0.08, 0.08, 0.41, 0.74, 0), boxAt(0.3, 0.07, 0.14, 0, 0.44, 0), boxAt(0.2, 0.04, 0.14, 0, 0.84, 0)],
    ), MATTE_MAT],
    [painted(
      [0xe8c66a, ball(0.15, 0, 0.98, 0)],
      [0x3a2a1a, dot(0.022, -0.055, 1.0, 0.138), dot(0.022, 0.055, 1.0, 0.138), boxAt(0.09, 0.014, 0.012, 0, 0.92, 0.136)],
      [0xf08a24, new THREE.ConeGeometry(0.026, 0.08, 5).rotateX(Math.PI / 2).translate(0, 0.965, 0.175)],
    ), MATTE_MAT],
    [painted(
      [0x8a5a2c, tube(0.25, 0.25, 0.03, 0, 1.08, 0), tube(0.1, 0.14, 0.16, 0, 1.17, 0)],
      [0xc9553f, tube(0.144, 0.144, 0.035, 0, 1.115, 0)],
      [0x2b2f36, blob(0.05, 0.9, 0.9, 1.3, -0.33, 0.83, 0), ball(0.036, -0.33, 0.885, 0.05), boxAt(0.03, 0.012, 0.07, -0.33, 0.83, -0.08)],
      [0xffd23f, new THREE.ConeGeometry(0.014, 0.04, 4).rotateX(Math.PI / 2).translate(-0.33, 0.88, 0.1)],
    ), MATTE_MAT],
  ],
  // sneeuwpop: kooltjes als ogen en knopen, een wortelneus, takken als armen, een hoed en een sjaal
  snowman: [
    [mergeGeometries([ball(0.27, 0, 0.25, 0), ball(0.2, 0, 0.62, 0), ball(0.15, 0, 0.9, 0)])!, WHITE_MAT],
    [merge([
      tube(0.17, 0.17, 0.025, 0, 1.02, 0), tube(0.11, 0.11, 0.15, 0, 1.1, 0),
      dot(0.019, -0.05, 0.935, 0.138), dot(0.019, 0.05, 0.935, 0.138), dot(0.022, 0, 0.7, 0.185), dot(0.022, 0, 0.6, 0.2), dot(0.024, 0, 0.36, 0.25),
    ]), std(0x3d4f5a, 0.7)],
    [painted(
      [0xf08a24, new THREE.ConeGeometry(0.03, 0.14, 6).rotateX(Math.PI / 2).translate(0, 0.895, 0.2)],
      [0x6b4a2a, rod(0.014, [0.17, 0.66, 0], [0.42, 0.82, 0.04], 4), rod(0.01, [0.36, 0.78, 0.03], [0.44, 0.74, 0.08], 4), rod(0.014, [-0.17, 0.66, 0], [-0.42, 0.8, 0.04], 4), rod(0.01, [-0.36, 0.77, 0.03], [-0.4, 0.86, 0.02], 4)],
    ), PAINT_MAT],
    [mergeGeometries([tube(0.165, 0.165, 0.05, 0, 0.77, 0), boxAt(0.07, 0.17, 0.03, 0.09, 0.68, 0.15), tube(0.113, 0.113, 0.03, 0, 1.045, 0)])!, std(0xe0584f)],
  ],
  // totempaal: drie gezichten boven elkaar, met vleugels en veren bovenop
  totem: [
    [painted(
      [0xe0584f, boxAt(0.36, 0.34, 0.36, 0, 0.17, 0), boxAt(0.2, 0.12, 0.06, -0.38, 0.96, -0.02), new THREE.ConeGeometry(0.05, 0.2, 4).translate(-0.1, 1.16, 0)],
      [0xffd23f, boxAt(0.36, 0.34, 0.36, 0, 0.53, 0), boxAt(0.2, 0.12, 0.06, 0.38, 0.96, -0.02), new THREE.ConeGeometry(0.055, 0.26, 4).translate(0, 1.19, 0)],
      [0x4a90e2, boxAt(0.36, 0.34, 0.36, 0, 0.89, 0)],
      [0x6cc04a, new THREE.ConeGeometry(0.05, 0.2, 4).translate(0.1, 1.16, 0)],
      [0x8a5a2e, boxAt(0.38, 0.03, 0.38, 0, 0.35, 0), boxAt(0.38, 0.03, 0.38, 0, 0.71, 0), boxAt(0.4, 0.04, 0.4, 0, 0.02, 0), boxAt(0.5, 0.12, 0.05, 0, 0.96, -0.02)],
      [0xf7f4ec, ...totemEyes(0.24)[0], ...totemEyes(0.6)[0], ...totemEyes(0.96)[0], ...[-0.075, -0.025, 0.025, 0.075].map(x => boxAt(0.04, 0.06, 0.02, x, 0.09, 0.185))],
      [0x2b2f36, ...totemEyes(0.24)[1], ...totemEyes(0.6)[1], ...totemEyes(0.96)[1], boxAt(0.22, 0.02, 0.02, 0, 0.13, 0.185)],
      [0xf08a24, new THREE.ConeGeometry(0.06, 0.16, 4).rotateX(Math.PI / 2).translate(0, 0.48, 0.25), boxAt(0.07, 0.12, 0.05, 0, 0.84, 0.19)],
    ), PAINT_MAT],
  ],
  // kampvuur: een kring van keien, houtblokken tegen elkaar en twee vlammen
  campfire: [
    [merge(around(7, 0.27, (x, z, i) => stone(0.15, 0.1 + (i % 3) * 0.02, 0.13, x, -0.01, z, i * 1.4))), ROCK_MAT],
    [merge([
      rod(0.04, [-0.2, 0.05, -0.1], [0.2, 0.05, 0.1], 6), rod(0.04, [-0.12, 0.05, 0.18], [0.12, 0.06, -0.18], 6),
      ...[0, 1, 2].map(i => rod(0.032, [Math.sin(i * 2.1) * 0.17, 0.02, Math.cos(i * 2.1) * 0.17], [Math.sin(i * 2.1) * -0.03, 0.26, Math.cos(i * 2.1) * -0.03], 6)),
    ]), WOOD_MAT],
    // de vlammen: los, met hun voet op nul, zodat ze kunnen flakkeren (zie buildDecor)
    [cone(0.13, 0.36, 0, 0.18, 0, 6), FLAME_MAT, false],
    [cone(0.07, 0.24, 0.02, 0.12, 0.02, 6), FLAME2_MAT, false],
  ],
  // klok: een groen huisje met een gouden rand om de wijzerplaat, op een paal met een voet
  clocktower: [
    [mergeGeometries([tube(0.05, 0.065, 1.0, 0, 0.56, 0), boxAt(0.3, 0.06, 0.3, 0, 0.03, 0), boxAt(0.2, 0.06, 0.2, 0, 0.09, 0), tube(0.1, 0.06, 0.07, 0, 1.04, 0)])!, std(0x3d4f5a, 0.7)],
    [painted(
      [0x2f6e4f, boxAt(0.46, 0.46, 0.18, 0, 1.3, 0)],
      [0xd9b24a, new THREE.CylinderGeometry(0.205, 0.205, 0.19, 16).rotateX(Math.PI / 2).translate(0, 1.3, 0), boxAt(0.5, 0.04, 0.2, 0, 1.08, 0)],
    ), PAINT_MAT],
    [new THREE.CylinderGeometry(0.18, 0.18, 0.2, 16).rotateX(Math.PI / 2).translate(0, 1.3, 0), WHITE_MAT],
    [mergeGeometries([
      boxAt(0.03, 0.14, 0.22, 0, 1.36, 0), boxAt(0.1, 0.03, 0.22, 0.04, 1.3, 0),
      boxAt(0.022, 0.04, 0.21, 0, 1.445, 0), boxAt(0.022, 0.04, 0.21, 0, 1.155, 0), boxAt(0.04, 0.022, 0.21, 0.145, 1.3, 0), boxAt(0.04, 0.022, 0.21, -0.145, 1.3, 0),
    ])!, std(0x3a2a1a)],
    [painted([0xc9553f, cone(0.3, 0.16, 0, 1.61, 0, 4)], [0xd9b24a, ball(0.035, 0, 1.71, 0)]), PAINT_MAT],
  ],
  // picknicktafel: planken op schuine poten, met een geruit kleed, een mandje, een appel en een beker
  picnic: [
    [painted(
      [0xc58a4b, ...[-0.135, 0, 0.135].map(z => boxAt(0.8, 0.04, 0.125, 0, 0.36, z)), boxAt(0.8, 0.04, 0.15, 0, 0.2, 0.34), boxAt(0.8, 0.04, 0.15, 0, 0.2, -0.34)],
      [0x97673a, ...[-0.3, 0.3].flatMap(x => [beam(0.05, [x, 0, -0.36], [x, 0.35, -0.1]), beam(0.05, [x, 0, 0.36], [x, 0.35, 0.1]), boxAt(0.05, 0.045, 0.76, x, 0.165, 0)])],
    ), MATTE_MAT],
    [painted(
      [0xe0584f, ...[[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]].map(([i, k]) => boxAt(0.1, 0.012, 0.1, 0.08 + i * 0.1, 0.387, k * 0.1)), dot(0.032, -0.08, 0.412, 0.1)],
      [0xf7f4ec, ...[[0, -1], [-1, 0], [1, 0], [0, 1]].map(([i, k]) => boxAt(0.1, 0.012, 0.1, 0.08 + i * 0.1, 0.387, k * 0.1))],
      [0xb98a4a, tube(0.075, 0.06, 0.08, -0.26, 0.42, -0.06), new THREE.TorusGeometry(0.065, 0.012, 4, 8, Math.PI).translate(-0.26, 0.46, -0.06)],
      [0x4a90e2, tube(0.03, 0.024, 0.06, -0.12, 0.41, -0.12)],
    ), PAINT_MAT],
  ],
  // gastenboek: een lessenaar met een open boek; één blad is los en kan omslaan (zie buildDecor)
  guestbook: [
    [mergeGeometries([boxAt(0.34, 0.05, 0.34, 0, 0.025, 0), boxAt(0.22, 0.04, 0.22, 0, 0.07, 0), boxAt(0.09, 0.6, 0.09, 0, 0.37, 0), new THREE.BoxGeometry(0.5, 0.05, 0.36).rotateX(0.45).translate(0, 0.7, 0.02)])!, WOOD_MAT],
    [new THREE.BoxGeometry(0.4, 0.03, 0.27).rotateX(0.45).translate(0, 0.736, 0.037), WHITE_MAT],
    [new THREE.BoxGeometry(0.18, 0.006, 0.25).translate(0.09, 0, 0), WHITE_MAT, false],
    // het leeslint, de regels op de bladzijden en een pen
    [painted(
      [0xe0584f, onBook(new THREE.BoxGeometry(0.02, 0.034, 0.27))],
      [0x9aa0a6, ...[-0.11, 0.11].flatMap(x => [-0.08, -0.04, 0, 0.04].map(z => onBook(boxAt(0.12, 0.004, 0.012, x, 0.017, z))))],
      [0x4a90e2, onBook(boxAt(0.2, 0.02, 0.02, -0.04, 0.03, 0.162))],
    ), PAINT_MAT],
  ],
  // plattegrond: een bord op twee palen met een dakje, gekleurde vlakken en een rode stip: hier ben jij
  mapboard: [
    [mergeGeometries([
      boxAt(0.07, 1, 0.07, -0.36, 0.5, 0), boxAt(0.07, 1, 0.07, 0.36, 0.5, 0),
      new THREE.BoxGeometry(0.52, 0.045, 0.2).rotateZ(0.26).translate(-0.235, 1.06, 0), new THREE.BoxGeometry(0.52, 0.045, 0.2).rotateZ(-0.26).translate(0.235, 1.06, 0),
    ])!, WOOD_MAT],
    [boxAt(0.68, 0.5, 0.05, 0, 0.7, 0), std(0xf3ead6)],
    [mergeGeometries([boxAt(0.26, 0.2, 0.06, -0.16, 0.78, 0), boxAt(0.2, 0.14, 0.06, 0.18, 0.58, 0)])!, std(0x86c95c)],
    [mergeGeometries([boxAt(0.18, 0.12, 0.06, 0.2, 0.82, 0), boxAt(0.1, 0.1, 0.06, -0.24, 0.56, 0)])!, std(0x6ec3e8)],
    [mergeGeometries([boxAt(0.34, 0.035, 0.06, -0.02, 0.66, 0), boxAt(0.035, 0.18, 0.06, 0.04, 0.57, 0)])!, std(0xe3ca82)],
    [new THREE.CylinderGeometry(0.045, 0.045, 0.08, 10).rotateX(Math.PI / 2).translate(0.04, 0.66, 0), std(0xe0241f, 0.6)],
  ],
  // slingerpaal: precies STRING_HEIGHT hoog, met een wimpel die los kan wapperen
  bunting: [
    [mergeGeometries([tube(0.028, 0.038, STRING_HEIGHT, 0, STRING_HEIGHT / 2, 0), tube(0.1, 0.12, 0.05, 0, 0.025, 0), tube(0.06, 0.08, 0.04, 0, 0.07, 0)])!, WHITE_MAT],
    [new THREE.ConeGeometry(0.075, 0.22, 4).rotateZ(-Math.PI / 2).scale(1, 1, 0.14).translate(0.13, STRING_HEIGHT - 0.1, 0), P_RED],
  ],
  // lichtjespaal: net zo hoog, met een lampje erop (om zijn eigen midden, zie buildDecor)
  lightstring: [
    [mergeGeometries([tube(0.028, 0.038, STRING_HEIGHT, 0, STRING_HEIGHT / 2, 0), tube(0.1, 0.12, 0.05, 0, 0.025, 0), tube(0.06, 0.08, 0.04, 0, 0.07, 0), tube(0.06, 0.03, 0.04, 0, STRING_HEIGHT - 0.01, 0)])!, std(0x3d4f5a, 0.7)],
    [new THREE.IcosahedronGeometry(0.075, 1), LAMP_MAT, false],
  ],
};

/** Zo ver schuift een versiering op als er een hek op zijn rand staat: net naast het hek. */
export const EDGE_SHIFT = 0.22;
/** Hoe iets op een rand staat: langs welke rand, en aan welke kant het pad ligt (1, -1 of 0 = geen van beide). */
export interface EdgePose {
  o: 'h' | 'v';
  face: number;
}

// Kijkvenster (soort 6): stenen palen, een lage stenen rand, een dunne bovenlat en een grote ruit ertussen.
const WINDOW_GEO = mergeGeometries([
  boxAt(0.13, 0.64, 0.13, 0, 0.32, 0),
  boxAt(0.13, 0.64, 0.13, 1, 0.32, 0),
  boxAt(0.9, 0.16, 0.12, 0.5, 0.08, 0),
  boxAt(0.9, 0.05, 0.08, 0.5, 0.615, 0),
])!;
const WINDOW_PANE_GEO = boxAt(0.88, 0.44, 0.025, 0.5, 0.375, 0);
// Het witte hekje van de kinderboerderij (soort 7): laag, met puntige latjes en twee dunne liggers.
const picket = (x: number, w = 0.08, h = 0.27): THREE.BufferGeometry[] => [
  boxAt(w, h, 0.035, x, 0.02 + h / 2, 0),
  new THREE.ConeGeometry(w * 0.71, 0.07, 4).rotateY(Math.PI / 4).scale(1, 1, 0.035 / w).translate(x, 0.055 + h, 0),
];
const PICKET_GEO = mergeGeometries([
  ...[0, 1].flatMap(x => [boxAt(0.1, 0.4, 0.1, x, 0.2, 0), new THREE.ConeGeometry(0.075, 0.07, 4).rotateY(Math.PI / 4).translate(x, 0.435, 0)]),
  boxAt(0.9, 0.035, 0.06, 0.5, 0.1, 0),
  boxAt(0.9, 0.035, 0.06, 0.5, 0.23, 0),
  ...[0.2, 0.35, 0.5, 0.65, 0.8].flatMap(x => picket(x)),
])!;
// Het poortje waar gasten de kinderboerderij in lopen (soort 8): twee hoge witte palen met een boog, twee lage
// klapdeurtjes die half open staan, en bovenop een rond geel bord met een rood hart.
const petLeaf = (): THREE.BufferGeometry =>
  mergeGeometries([boxAt(0.4, 0.035, 0.05, 0.22, 0.12, 0), boxAt(0.4, 0.035, 0.05, 0.22, 0.26, 0), ...[0.08, 0.22, 0.36].flatMap(x => picket(x, 0.08, 0.3))])!;
const PETGATE_GEO = mergeGeometries([
  boxAt(0.11, 0.9, 0.11, 0, 0.45, 0),
  boxAt(0.11, 0.9, 0.11, 1, 0.45, 0),
  beam(0.07, [0, 0.88, 0], [0.22, 1.04, 0]),
  beam(0.07, [0.2, 1.04, 0], [0.8, 1.04, 0]),
  beam(0.07, [0.78, 1.04, 0], [1, 0.88, 0]),
  petLeaf().rotateY(-1.05).translate(0.06, 0, 0),
  petLeaf().rotateY(Math.PI + 1.05).translate(0.94, 0, 0),
  boxAt(0.05, 0.08, 0.05, 0.5, 1.1, 0),
])!;
const PETSIGN_GEO = mergeGeometries([
  paint(new THREE.CylinderGeometry(0.17, 0.17, 0.04, 18).rotateX(Math.PI / 2).translate(0.5, 1.28, 0), 0xffd23f),
  ...[boxAt(0.07, 0.07, 0.07, 0.455, 1.325, 0), boxAt(0.07, 0.07, 0.07, 0.545, 1.325, 0), boxAt(0.18, 0.06, 0.07, 0.5, 1.275, 0), boxAt(0.11, 0.05, 0.07, 0.5, 1.225, 0), boxAt(0.045, 0.045, 0.07, 0.5, 1.18, 0)]
    .map(g => paint(g, 0xe0241f)),
])!;

/** Een versiering; wat los moet kunnen bewegen (wieken, vlammen, een zwengel, een blad) krijgt hier zijn plek. */
const PENDULUM_GEO = mergeGeometries([boxAt(0.025, 0.3, 0.02, 0, -0.15, 0), new THREE.CylinderGeometry(0.06, 0.06, 0.025, 12).rotateX(Math.PI / 2).translate(0, -0.32, 0)])!;
const PAGE_TILT = 0.45;
// ------------------------------------------------------------ natuur op een kwart tegel
const blade = (x: number, z: number, h: number, lean: number, turn: number): THREE.BufferGeometry =>
  new THREE.ConeGeometry(0.036, h, 4).translate(0, h / 2, 0).rotateZ(lean).rotateY(turn).translate(x, 0, z);
const frond = (turn: number, len: number, lift: number): THREE.BufferGeometry =>
  new THREE.BoxGeometry(len, 0.016, 0.085).translate(len / 2, 0, 0).rotateZ(lift).rotateY(turn).translate(0, 0.03, 0);
const lump = (r: number, x: number, z: number, flat = 0.62): THREE.BufferGeometry => new THREE.IcosahedronGeometry(r, 0).scale(1, flat, 1).translate(x, r * flat * 0.8, z);
const DAISY_SPOTS: [number, number, number][] = [[-0.08, 0.2, -0.05], [0.07, 0.26, 0.04], [0, 0.17, 0.1], [0.1, 0.15, -0.1]];
/**
 * Natuur voor in de verblijven. De kleine dingen passen op een kwart tegel (een vakje van een halve tegel breed);
 * boom, den, palm en rots vullen een hele tegel en gebruiken de vormen van de versieringen uit het park.
 */
const PROP_PARTS: Record<PropKind, Part[]> = {
  tuft: [
    [mergeGeometries([blade(-0.07, -0.03, 0.26, 0.22, 0), blade(0.06, 0.05, 0.3, -0.2, 1), blade(0, -0.08, 0.22, 0.3, 2.2), blade(0.09, -0.05, 0.2, -0.35, 3)])!, LEAF_MAT],
    [mergeGeometries([blade(-0.02, 0.06, 0.32, 0.1, 4), blade(0.03, 0, 0.36, -0.06, 5), blade(-0.1, 0.05, 0.18, 0.4, 0.6)])!, LEAF2],
  ],
  daisies: [
    [mergeGeometries(DAISY_SPOTS.map(([x, h, z]) => boxAt(0.022, h, 0.022, x, h / 2, z)))!, STEM_MAT],
    [mergeGeometries([frond(0.4, 0.14, 0.3), frond(2.6, 0.13, 0.25), frond(4.4, 0.14, 0.3)])!, LEAF2],
    [mergeGeometries(DAISY_SPOTS.map(([x, h, z]) => new THREE.CylinderGeometry(0.058, 0.04, 0.026, 7).translate(x, h + 0.013, z)))!, WHITE_MAT],
    [merge(DAISY_SPOTS.map(([x, h, z]) => dot(0.027, x, h + 0.03, z))), std(0xffd23f)],
  ],
  fern: [
    [mergeGeometries([0, 1.26, 2.5, 3.77, 5.03].map((a, i) => frond(a, 0.24 - (i % 2) * 0.04, 0.55 + (i % 2) * 0.15)))!, LEAF2],
    [mergeGeometries([0.6, 2.7, 4.6].map(a => frond(a, 0.15, 1)))!, LEAF_MAT],
  ],
  shrub: [
    // een laag, stekelig heidestruikje met paarse bloemetjes (de bessenstruik in zijn kuip is het speelgoed)
    [merge([
      blob(0.12, 1.15, 0.6, 1, -0.04, 0.07, 0.01, 0), blob(0.09, 1, 0.6, 1.1, 0.1, 0.06, 0.06, 0),
      ...[[-0.1, 0.02, 0.24, -0.35], [0, -0.06, 0.3, 0.1], [0.09, 0.03, 0.26, 0.3], [-0.02, 0.09, 0.22, -0.1], [0.14, -0.05, 0.2, 0.45]].map(([x, z, h, lean], i) => blade(x, z, h, lean, i * 1.3)),
    ]), LEAF2],
    [merge([[-0.12, 0.2, 0.05], [0, 0.27, -0.06], [0.12, 0.23, 0.06], [-0.02, 0.19, 0.11], [0.17, 0.17, -0.02], [0.05, 0.14, 0.13]].map(([x, y, z]) => dot(0.026, x, y, z))), std(0xb06ad9)],
  ],
  pebbles: [
    [mergeGeometries([lump(0.075, -0.09, 0.04), lump(0.055, 0.07, -0.07), lump(0.045, 0.1, 0.09)])!, STONE],
    [mergeGeometries([lump(0.06, 0, 0), lump(0.04, -0.12, -0.09)])!, ROCK_MAT],
  ],
  stone: [
    [mergeGeometries([new THREE.IcosahedronGeometry(0.17, 0).scale(1.1, 0.8, 0.9).translate(0, 0.11, 0), lump(0.08, 0.15, 0.1)])!, ROCK_MAT],
    [lump(0.06, -0.15, 0.1), STONE],
  ],
  oak: DECOR_PARTS.tree,
  fir: DECOR_PARTS.pine,
  coco: DECOR_PARTS.palm,
  crag: [
    [merge([stone(0.62, 0.58, 0.52, -0.06, -0.06, 0, 0.3), stone(0.4, 0.4, 0.4, 0.26, -0.05, 0.14, 1.1), stone(0.36, 0.38, 0.34, -0.1, 0.44, -0.04, 2), stone(0.24, 0.24, 0.24, -0.3, -0.04, 0.24, 0.6)]), ROCK_MAT],
    [merge([stone(0.24, 0.14, 0.22, -0.1, 0.76, -0.04, 0.8), stone(0.2, 0.14, 0.18, 0.3, 0.3, 0.14, 1.7), stone(0.14, 0.1, 0.12, 0.1, -0.02, 0.36, 0.2)]), STONE],
  ],
  // ---- klein spul voor het park: elk één onderdeel in een paar felle kleuren, de voorkant naar +z
  // bloempot: een pot van aardewerk met een grote rode bloem en een kleine gele
  pot: [
    [merge([
      painted(
        [0xc9653f, tube(0.115, 0.08, 0.15, 0, 0.075, 0)],
        [0xdc7a4e, tube(0.132, 0.132, 0.04, 0, 0.16, 0)],
        [0x5a3d22, tube(0.108, 0.108, 0.012, 0, 0.184, 0)],
        [0x4f9e45, rod(0.016, [0, 0.18, 0], [0.01, 0.4, 0.03], 5), rod(0.012, [0, 0.18, 0], [-0.09, 0.3, 0.05], 5), blob(0.075, 1.2, 0.3, 0.7, 0.085, 0.25, -0.02, 0), blob(0.065, 0.7, 0.3, 1.2, -0.03, 0.24, -0.08, 0)],
      ),
      ...bloom(0.01, 0.42, 0.04, 0xe0584f, 0.1, 0.5),
      ...bloom(-0.095, 0.31, 0.06, 0xffd23f, 0.06, 0.4),
    ]), PAINT_MAT],
  ],
  // kabouter: blauw jasje, witte baard, een roze neus en een hoge rode puntmuts
  gnome: [
    [painted(
      [0x4a90e2, tube(0.075, 0.115, 0.19, 0, 0.095, 0)],
      [0x3a2a1a, tube(0.108, 0.108, 0.028, 0, 0.07, 0), dot(0.013, -0.035, 0.265, 0.076), dot(0.013, 0.035, 0.265, 0.076)],
      [0x8a5a2c, blob(0.04, 1, 0.6, 1.25, -0.05, 0.02, 0.088, 0), blob(0.04, 1, 0.6, 1.25, 0.05, 0.02, 0.088, 0)],
      [0xffd23f, boxAt(0.04, 0.036, 0.012, 0, 0.07, 0.108)],
      [0xf6cfa6, ball(0.088, 0, 0.245, 0)],
      [0xffffff, blob(0.08, 1, 1.25, 0.6, 0, 0.16, 0.062)],
      [0xf3a6b8, dot(0.026, 0, 0.238, 0.092)],
      [0xe0241f, cone(0.105, 0.27, 0, 0.43, 0, 9)],
    ), PAINT_MAT],
  ],
  // windmolentje: vier wiekjes in vier kleuren op een stokje, een beetje achterover zodat je het van boven ziet
  pinwheel: [
    [merge([
      paint(rod(0.014, [0, 0, 0], [0, 0.44, 0], 5), 0xf7f4ec),
      merge([
        ...[0xe0584f, 0xffd23f, 0x4a90e2, 0x6cc04a].map((hex, i) => paint(boxAt(0.14, 0.078, 0.014, 0.07, 0.039, 0).rotateZ((i * Math.PI) / 2), hex)),
        paint(dot(0.028, 0, 0, 0.016), 0xffffff),
      ]).rotateX(-0.45).translate(0, 0.44, 0.02),
    ]), PAINT_MAT],
  ],
  // badeend: geel, met een oranje snavel en een opgewipt staartje
  ducky: [
    [painted(
      [0xffd23f, blob(0.11, 1, 0.75, 1.3, 0, 0.085, -0.02), ball(0.078, 0, 0.2, 0.07), new THREE.ConeGeometry(0.045, 0.1, 5).rotateX(-0.6).translate(0, 0.15, -0.14)],
      [0xf2b01d, blob(0.06, 0.45, 0.7, 1.3, -0.1, 0.1, -0.03, 0), blob(0.06, 0.45, 0.7, 1.3, 0.1, 0.1, -0.03, 0)],
      [0xf08a24, blob(0.04, 1.1, 0.5, 1.3, 0, 0.188, 0.155, 0)],
      [0x3a2a1a, dot(0.014, -0.036, 0.225, 0.133), dot(0.014, 0.036, 0.225, 0.133)],
    ), PAINT_MAT],
  ],
  // vogelhuisje: een licht huisje met een rood puntdak op een paal, met een rond gat en een stokje ervoor
  birdhouse: [
    [painted(
      [0xa8743f, boxAt(0.045, 0.25, 0.045, 0, 0.125, 0), boxAt(0.25, 0.025, 0.22, 0, 0.245, 0), rod(0.011, [0, 0.285, 0.08], [0, 0.285, 0.15], 5)],
      [0xfff1c9, boxAt(0.2, 0.17, 0.17, 0, 0.34, 0)],
      [0x3a2a1a, new THREE.CylinderGeometry(0.036, 0.036, 0.012, 8).rotateX(Math.PI / 2).translate(0, 0.355, 0.087)],
      [0xd8362e, cone(0.18, 0.13, 0, 0.485, 0, 4)],
    ), MATTE_MAT],
  ],
  // gieter: blauw, met water erin, een oor aan de ene kant en een tuit met een gele broes aan de andere
  can: [
    [painted(
      [0x4aa8e8, tube(0.1, 0.1, 0.18, -0.02, 0.09, 0), rod(0.024, [0.06, 0.06, 0], [0.165, 0.2, 0], 6, 0.018)],
      [0x2f7fc0, tube(0.106, 0.106, 0.025, -0.02, 0.17, 0), tube(0.106, 0.106, 0.025, -0.02, 0.015, 0), new THREE.TorusGeometry(0.07, 0.016, 5, 8, Math.PI).rotateZ(Math.PI / 2).translate(-0.115, 0.095, 0)],
      [0xbfe6f7, tube(0.088, 0.088, 0.01, -0.02, 0.182, 0)],
      [0xffd23f, blob(0.04, 1, 1, 1, 0.175, 0.212, 0, 0)],
    ), PAINT_MAT],
  ],
  // emmertje: rood met een gele rand, vol zand, met een hengsel en een blauw schepje erin
  bucket: [
    [painted(
      [0xe0584f, tube(0.112, 0.08, 0.16, 0, 0.08, 0)],
      [0xffd23f, tube(0.122, 0.122, 0.024, 0, 0.158, 0)],
      [0xf0d9a0, blob(0.104, 1, 0.4, 1, 0, 0.168, 0, 0)],
      [0xf7f4ec, new THREE.TorusGeometry(0.112, 0.012, 4, 10, Math.PI).rotateX(0.35).translate(0, 0.165, 0)],
      [0x4a90e2, rod(0.015, [-0.02, 0.17, -0.02], [-0.07, 0.4, -0.06], 5), rod(0.017, [-0.105, 0.39, -0.06], [-0.035, 0.41, -0.06], 5)],
    ), PAINT_MAT],
  ],
  // slak: een oranje huisje met een krul op de zij, en twee oogjes op steeltjes
  snail: [
    [painted(
      [0xf3c9a0, blob(0.055, 1, 0.7, 3, 0, 0.04, 0), ball(0.052, 0, 0.1, 0.15), rod(0.009, [-0.02, 0.13, 0.16], [-0.04, 0.21, 0.185], 4), rod(0.009, [0.02, 0.13, 0.16], [0.04, 0.21, 0.185], 4)],
      [0x3a2a1a, dot(0.017, -0.04, 0.215, 0.187), dot(0.017, 0.04, 0.215, 0.187)],
      [0xf08a24, blob(0.115, 0.6, 1, 1, 0, 0.155, -0.03), new THREE.CylinderGeometry(0.028, 0.028, 0.17, 8).rotateZ(Math.PI / 2).translate(0, 0.155, -0.03)],
      [0xffd23f, new THREE.CylinderGeometry(0.062, 0.062, 0.152, 10).rotateZ(Math.PI / 2).translate(0, 0.155, -0.03)],
    ), PAINT_MAT],
  ],
  // kistje appels: een houten kistje met rode appels en één groene
  crate: [
    [painted(
      [0xc58a4b, boxAt(0.3, 0.13, 0.22, 0, 0.065, 0)],
      [0xa8743f, boxAt(0.31, 0.03, 0.23, 0, 0.07, 0)],
      [0x8a5a2c, ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([x, z]) => boxAt(0.04, 0.15, 0.04, x * 0.14, 0.075, z * 0.1))],
      [0xd8362e, ball(0.052, -0.09, 0.145, -0.045), ball(0.052, 0.09, 0.145, -0.045), ball(0.052, -0.05, 0.145, 0.05), ball(0.052, 0, 0.145, -0.05), ball(0.05, -0.01, 0.2, -0.005)],
      [0x8fcf4a, ball(0.054, 0.06, 0.148, 0.05)],
    ), MATTE_MAT],
  ],
};

function buildDecor(kind: DecorKind, mat?: THREE.Material): THREE.Group {
  const group = build(DECOR_PARTS[kind], mat);
  const kids = group.children;
  if (kind === 'windmill') {
    kids[3].position.set(0, 0.92, 0.2);
    // de wieken draaien rond: geen schaduw in hun kleuren (zie shadeGroup)
    kids[3].userData.noShade = true;
  }
  if (kind === 'campfire') kids[2].position.y = kids[3].position.y = 0.1;
  if (kind === 'lantern') kids[1].position.y = 1.15;
  if (kind === 'gardenlight') kids[1].position.y = 0.3;
  if (kind === 'lampion') kids[1].position.set(0.12, 0.99, 0);
  if (kind === 'torch') kids[1].position.y = 1.04;
  if (kind === 'streetlamp') kids[1].position.y = 1.42;
  if (kind === 'lightstring') kids[1].position.y = STRING_HEIGHT + 0.05;
  if (kind === 'guestbook') {
    kids[2].position.set(0, 0.754, 0.045);
    kids[2].rotation.set(PAGE_TILT, 0, 0.3);
  }
  if (kind === 'pump') {
    kids[2].position.set(-0.08, 0.84, 0.02);
    kids[2].rotation.x = -0.5;
  }
  if (kind === 'clocktower') {
    // de slinger onder de klok: het zesde onderdeel
    const pendulum = new THREE.Mesh(PENDULUM_GEO, mat ?? GOLD_MAT);
    pendulum.position.set(0, 1.08, 0.085);
    pendulum.castShadow = !mat;
    group.add(pendulum);
  }
  // een beetje schaduw onderaan en onder daken en planken (zie shade.ts); niet voor het doorzichtige voorbeeld
  if (!mat) shadeGroup(group);
  return group;
}

// Vijvers die naast elkaar liggen, lopen in elkaar over (zie View.syncPonds): twee naast elkaar worden een ovaal,
// vier in een blok een grote vijver met ronde hoeken. Per tegel hangt de vorm af van welke buren ook vijver zijn.
// In `mask` telt noord 1, oost 2, zuid 4 en west 8; schuin telt noordoost 16, zuidoost 32, zuidwest 64 en
// noordwest 128 (alleen als de twee kanten ernaast ook vijver zijn). Een vijver zonder buren houdt het gewone model.
const POND_WATER = 0.37, POND_STONES = 0.41, POND_BASE = 0.44;
/** Naar een buur toe loopt de vijver een haartje over de tegelrand heen, zodat er geen kier tussen twee tegels valt. */
const POND_EDGE = 0.502;
// De tegel in vier kwarten, de klok rond: zuidoost, zuidwest, noordwest, noordoost. Elk kwart loopt van zijn
// eerste kant (POND_SIDE) naar de kant van het volgende kwart; POND_DIAG is de buur schuin in die hoek.
const POND_SIDE = [2, 4, 8, 1], POND_DIAG = [32, 64, 128, 16];
/** Draait een punt uit het eerste kwart (zuidoost) naar kwart `k`. */
const pondTurn = (u: number, v: number, k: number): [number, number] => (k === 0 ? [u, v] : k === 1 ? [-v, u] : k === 2 ? [-u, -v] : [v, -u]);
/**
 * De omtrek van één vijvertegel. Aan een open kant ligt hij `r` van het midden; naar een buur toe loopt hij recht
 * door tot de tegelrand. Een hoek is rond als beide kanten open zijn. Zijn beide kanten vijver maar de tegel
 * schuin ertussen niet, dan komt daar een klein rond inhammetje.
 */
function pondOutline(mask: number, r: number): THREE.Vector2[] {
  const pts: THREE.Vector2[] = [];
  const add = (u: number, v: number, k: number): void => {
    const [x, z] = pondTurn(u, v, k), last = pts[pts.length - 1];
    if (!last || Math.abs(last.x - x) + Math.abs(last.y - z) > 1e-6) pts.push(new THREE.Vector2(x, z));
  };
  for (let k = 0; k < 4; k++) {
    const a = !!(mask & POND_SIDE[k]), b = !!(mask & POND_SIDE[(k + 1) % 4]);
    if (!a && !b) for (let i = 0; i <= 4; i++) add(Math.cos((i * Math.PI) / 8) * r, Math.sin((i * Math.PI) / 8) * r, k);
    else if (a && !b) [[POND_EDGE, 0], [POND_EDGE, r], [0, r]].forEach(([u, v]) => add(u, v, k));
    else if (!a && b) [[r, 0], [r, POND_EDGE], [0, POND_EDGE]].forEach(([u, v]) => add(u, v, k));
    else if (mask & POND_DIAG[k]) [[POND_EDGE, 0], [POND_EDGE, POND_EDGE], [0, POND_EDGE]].forEach(([u, v]) => add(u, v, k));
    else {
      // het inhammetje: een kwart rondje om de hoek van de tegel
      const rho = 0.5 - r;
      add(POND_EDGE, 0, k);
      add(POND_EDGE, r, k);
      for (let i = 0; i <= 2; i++) add(0.5 - Math.sin((i * Math.PI) / 4) * rho, 0.5 - Math.cos((i * Math.PI) / 4) * rho, k);
      add(r, POND_EDGE, k);
      add(0, POND_EDGE, k);
    }
  }
  if (pts.length > 1 && pts[0].distanceTo(pts[pts.length - 1]) < 1e-6) pts.pop();
  return pts;
}
/** Een platte plak in de vorm van de vijvertegel, van hoogte `bottom` tot `top`. */
const pondSlab = (mask: number, r: number, bottom: number, top: number): THREE.BufferGeometry => {
  const g = new THREE.ExtrudeGeometry(new THREE.Shape(pondOutline(mask, r)), { depth: top - bottom, bevelEnabled: false });
  g.clearGroups();
  return g.rotateX(Math.PI / 2).translate(0, top, 0);
};
/**
 * De rand van een vijvertegel met buren: de voet, keien langs de open kanten en riet in de ronde hoeken die in
 * `reeds` aan staan (1 voor het eerste kwart, 2, 4 en 8 voor de volgende).
 */
function pondRim(mask: number, reeds: number): THREE.BufferGeometry {
  const light: THREE.BufferGeometry[] = [], dark: THREE.BufferGeometry[] = [], stalks: THREE.BufferGeometry[] = [], heads: THREE.BufferGeometry[] = [];
  let n = 0;
  const put = (u: number, v: number, k: number, w = 0.16, d = 0.13): void => {
    const [x, z] = pondTurn(u, v, k);
    (n % 2 ? dark : light).push(stone(w, 0.1 + (n % 3) * 0.025, d, x, 0.03, z, n * 0.9 + k));
    n++;
  };
  for (let k = 0; k < 4; k++) {
    const a = !!(mask & POND_SIDE[k]), b = !!(mask & POND_SIDE[(k + 1) % 4]), odd = k % 2 === 1;
    if (!a && !b) {
      for (const deg of [15, 45, 75]) put(Math.cos((deg * Math.PI) / 180) * POND_STONES, Math.sin((deg * Math.PI) / 180) * POND_STONES, k);
      if (reeds & (1 << k)) {
        // hetzelfde plukje riet als bij de losse vijver (dat staat noordwest), gedraaid naar deze hoek
        const turn = ((2 - k) * Math.PI) / 2;
        stalks.push(...[rod(0.012, [-0.3, 0.1, -0.3], [-0.34, 0.5, -0.32], 4), rod(0.012, [-0.36, 0.1, -0.22], [-0.42, 0.42, -0.2], 4), rod(0.012, [-0.24, 0.1, -0.36], [-0.2, 0.4, -0.4], 4)].map(g => g.rotateY(turn)));
        heads.push(...[rod(0.026, [-0.335, 0.4, -0.318], [-0.342, 0.52, -0.322], 6), rod(0.024, [-0.41, 0.34, -0.203], [-0.425, 0.44, -0.198], 6)].map(g => g.rotateY(turn)));
      }
    }
    // langs een rechte kant ligt een kei met zijn lange kant langs het water
    else if (a && !b) for (const u of [0.375, 0.125]) put(u, POND_STONES, k, odd ? 0.13 : 0.17, odd ? 0.17 : 0.13);
    else if (!a && b) for (const v of [0.125, 0.375]) put(POND_STONES, v, k, odd ? 0.17 : 0.13, odd ? 0.13 : 0.17);
    else if (!(mask & POND_DIAG[k])) put(0.435, 0.435, k, 0.15, 0.15);
  }
  return painted([0x9aa3ab, pondSlab(mask, POND_BASE, 0, 0.08)], [0xb9c2c9, ...light], [0x8f949c, ...dark], [0x5fa544, ...stalks], [0x6b4a2a, ...heads]);
}
/** De randen en het water die al eens gemaakt zijn: tegels met dezelfde buren delen hun vorm. */
const POND_RIMS = new Map<number, THREE.BufferGeometry>(), POND_WATERS = new Map<number, THREE.BufferGeometry>();
// Wat er drijft op een vijver met buren, per tegel iets anders: de lelie met de kikker (zoals de losse vijver),
// alleen de lelie, alleen de kikker, een paar losse bladeren of niets. Alles blijft dicht bij het midden van de
// tegel, dus nooit op een naad.
const POND_LILY = painted(
  [0xf48fb1, ...[0, 1, 2, 3, 4, 5].map(i => new THREE.ConeGeometry(0.022, 0.07, 4).translate(0, 0.035, 0).rotateZ(0.6).rotateY(i * 1.05).translate(-0.14, 0.11, 0.1))],
  [0xffd23f, dot(0.02, -0.14, 0.135, 0.1)],
);
const POND_FROG = painted([0x6cc04a, blob(0.036, 1, 0.8, 1.2, 0.16, 0.135, -0.08), dot(0.016, 0.146, 0.165, -0.055), dot(0.016, 0.174, 0.165, -0.055)]);
const POND_LEAVES = mergeGeometries([tube(0.075, 0.075, 0.012, -0.1, 0.106, -0.12), tube(0.055, 0.055, 0.012, 0.13, 0.106, 0.1)])!;
/**
 * Geeft één vijver de vorm die bij zijn buren past. De vier onderdelen blijven op hun plek in de groep (rand,
 * water, bladeren, lelie en kikker), zodat animateDecor ze blijft vinden.
 */
function shapePond(group: THREE.Object3D, mask: number, x: number, y: number, rot: number): void {
  const [rim, water, pads, top] = group.children as THREE.Mesh[], parts = DECOR_PARTS.pond;
  // een losse vijver ligt zoals hij gezet is; een vijver met buren ligt recht, anders past hij niet op zijn buren
  group.rotation.y = mask ? 0 : (rot * Math.PI) / 2;
  if (!mask) {
    [rim, water, pads, top].forEach((mesh, i) => {
      mesh.geometry = parts[i][0];
      mesh.visible = true;
      mesh.rotation.y = 0;
    });
    return;
  }
  // riet in een ronde hoek: achteraan (noordwest) altijd, opzij soms, vooraan nooit (daar staat het in de weg)
  let reeds = 4 | (hash(x, y, 9) < 0.35 ? 2 : 0) | (hash(x, y, 10) < 0.35 ? 8 : 0);
  for (let k = 0; k < 4; k++) if (mask & (POND_SIDE[k] | POND_SIDE[(k + 1) % 4])) reeds &= ~(1 << k);
  const key = mask | (reeds << 8);
  if (!POND_RIMS.has(key)) POND_RIMS.set(key, pondRim(mask, reeds));
  if (!POND_WATERS.has(mask)) POND_WATERS.set(mask, pondSlab(mask, POND_WATER, 0.07, 0.1));
  rim.geometry = POND_RIMS.get(key)!;
  water.geometry = POND_WATERS.get(mask)!;
  // om en om: de ene tegel een lelie of een kikker, de andere een paar losse bladeren of alleen water
  const pick = hash(x, y, 11), even = (x + y) % 2 === 0;
  const leaves = even ? parts[2][0] : pick < 0.5 ? POND_LEAVES : null;
  const guest = !even ? null : pick < 0.4 ? parts[3][0] : pick < 0.75 ? POND_LILY : POND_FROG;
  pads.visible = !!leaves;
  top.visible = !!guest;
  if (leaves) pads.geometry = leaves;
  if (guest) top.geometry = guest;
  pads.rotation.y = top.rotation.y = (Math.floor(hash(x, y, 12) * 4) * Math.PI) / 2;
}

/**
 * Een winkel met alles erop en eraan. In `userData`: `moving` (het deel dat het spel laat draaien), `cars` (de
 * botsauto's), `bob` (wat zachtjes wiegt), `door` (de wc-deuren), `lid` (de deksel van de afvalbak), `mat` (het
 * doek van de trampoline) en `seat` (het bankje).
 */
function buildShop(kind: ShopKind, mat?: THREE.Material): THREE.Group {
  const group = build(SHOP_PARTS[kind], mat);
  const kids = [...group.children];
  group.userData.kind = kind;
  const extra = SHOP_MOVING[kind];
  if (extra) {
    const moving = build(extra.parts, mat);
    moving.position.y = extra.y;
    // wat kantelt of rondgaat, krijgt geen schaduw in de kleuren (die zou mee omhoog draaien); de draaimolen draait alleen rond
    moving.userData.noShade = kind !== 'carousel';
    group.add(moving);
    group.userData.moving = moving;
  }
  if (kind === 'bin') {
    kids[1].position.set(0, 0.42, -0.19);
    group.userData.lid = kids[1];
  }
  if (kind === 'trampoline') group.userData.mat = kids[3];
  if (kind === 'bench') group.userData.seat = kids[0];
  if (kind === 'toilet')
    group.userData.door = [-1, 1].map((side, i) => {
      const door = build([[DOOR_GEOS[i], P_BLUE], [KNOB_GEOS[i], P_YELLOW]], mat);
      door.position.set(side * 0.67, 0, 0.57);
      // zo ver draait hij open, naar buiten toe: bijna haaks, zodat een gast er net langs kan
      door.userData.open = side * 1.45;
      group.add(door);
      return door;
    });
  const bobs = SHOP_BOB[kind];
  if (bobs)
    group.userData.bob = bobs.map(b => {
      const pivot = new THREE.Group();
      pivot.position.set(...b.at);
      for (const i of b.parts) {
        kids[i].position.set(-b.at[0], -b.at[1], -b.at[2]);
        pivot.add(kids[i]);
      }
      Object.assign(pivot.userData, { y0: b.at[1], amp: b.amp ?? 0.02, sway: b.sway ?? 0.04, yaw: b.yaw ?? 0 });
      group.add(pivot);
      return pivot;
    });
  // de losse stukken van een attractie (zie RIDE_BUILD), in rust: zo staat ook het voorbeeld bij het neerzetten
  const ride = RIDE_BUILD[kind];
  if (ride) {
    ride(group, mat);
    poseRide(group, kind, newRide(kind));
  }
  if (!mat) shadeGroup(group);
  return group;
}

/**
 * Zet alles wat aan een attractie beweegt in de stand van dit moment (zie RideState in rides.ts): het rad en de
 * bakjes van het reuzenrad, de draaimolen met zijn paarden, de botsauto's, de zitjes van de speeltoestellen en de
 * stralen van de fontein. De gasten rekenen met dezelfde stand en dezelfde getallen, dus ze zitten er precies op.
 */
function poseRide(group: THREE.Object3D, kind: ShopKind, s: RideState): void {
  const u = group.userData;
  if (kind === 'ferris') {
    (u.wheel as THREE.Object3D).rotation.z = s.spin;
    const cabins = u.cabins as THREE.Object3D[];
    for (let i = 0; i < cabins.length; i++) {
      const a = ferrisAngle(i, s.spin);
      cabins[i].position.set(Math.cos(a) * FERRIS.radius, FERRIS.hub + Math.sin(a) * FERRIS.radius, 0);
      cabins[i].rotation.z = ferrisSway(i, s);
    }
  } else if (kind === 'carousel') {
    (u.spinner as THREE.Object3D).rotation.y = s.spin;
    const horses = u.horses as THREE.Object3D[];
    for (let i = 0; i < horses.length; i++) horses[i].position.y = carouselLift(i, s.spin);
  } else if (kind === 'bumper') {
    const cars = u.cars as THREE.Object3D[], sparks = u.sparks as THREE.Object3D[];
    for (let i = 0; i < cars.length && i < s.cars.length; i++) {
      const c = s.cars[i];
      cars[i].position.set(c.x, BUMPER.floor, c.z);
      // bij een botsing schudt de auto even en springt er een vonk van de spriet
      cars[i].rotation.set(0, c.dir, c.bump * 0.1 * Math.sin(s.clock * 38 + i));
      sparks[i].visible = c.bump > 0.45;
      if (sparks[i].visible) {
        sparks[i].scale.setScalar(0.5 + c.bump);
        sparks[i].rotation.y = s.clock * 20 + i;
      }
    }
  } else if (kind === 'fountain') {
    // het waterballet: elke straal groeit en krimpt vanuit zijn spuitmond, en trilt een beetje; met gasten erbij spuit het wat hoger
    const jets = u.jets as THREE.Object3D[], lively = 0.86 + 0.14 * s.amp;
    for (let i = 0; i < jets.length; i++) {
      const level = fountainJet(i, s.clock) * lively * (1 + 0.035 * Math.sin(s.clock * 21 + i * 1.7));
      if (i < FOUNTAIN.jets) jets[i].scale.setScalar(level);
      else jets[i].scale.set(0.8 + 0.3 * level, level, 0.8 + 0.3 * level);
    }
  }
}

// Een slinger van a naar b die een beetje doorhangt: het touw, en de vlaggetjes of lampjes die eraan hangen.
const PENNANTS = [0xe0584f, 0xffd23f, 0x4a90e2, 0x6cc04a, 0xf06aa6];
function garland(a: THREE.Vector3, b: THREE.Vector3, kind: 'bunting' | 'lightstring', rope: THREE.BufferGeometry[], hang: THREE.BufferGeometry[]): void {
  const dist = a.distanceTo(b), sag = 0.05 + dist * 0.05, steps = Math.max(4, Math.round(dist * 4));
  const at = (s: number): P3 => [a.x + (b.x - a.x) * s, a.y + (b.y - a.y) * s - sag * 4 * s * (1 - s), a.z + (b.z - a.z) * s];
  for (let i = 0; i < steps; i++) rope.push(beam(0.014, at(i / steps), at((i + 1) / steps)));
  const n = Math.max(2, Math.round(dist * 3)), turn = Math.atan2(-(b.z - a.z), b.x - a.x);
  for (let i = 0; i < n; i++) {
    const [x, y, z] = at((i + 0.5) / n);
    hang.push(kind === 'bunting'
      ? paint(new THREE.ConeGeometry(0.06, 0.14, 4).rotateX(Math.PI).scale(1, 1, 0.14).rotateY(turn).translate(x, y - 0.075, z), PENNANTS[i % PENNANTS.length])
      : new THREE.IcosahedronGeometry(0.04, 0).translate(x, y - 0.04, z));
  }
}
const ROPE_MAT = std(0x5a4a3a, 1);

// Verjaardag bij een gebouw: vier dunne palen met slingers ertussen, ballonnen aan de paal rechtsvoor en een taart
// op een tafeltje. Eén keer gemaakt per maat (breed bij diep), door alle gebouwen van die maat gedeeld. Waar het
// gebouw maar één tegel meet, staan de palen net buiten die tegel (bij een marktkraam: voor en achter het zeil);
// is het smaller dan 2 bij 2, dan is er geen plek voor de taart.
const partyGeos = new Map<string, { white: THREE.BufferGeometry; colors: THREE.BufferGeometry; balloons: THREE.BufferGeometry; at: P3 }>();
const PARTY_POLE = 1.7;
function partyParts(wide: number, deep: number, cakeAt?: [number, number]): { white: THREE.BufferGeometry; colors: THREE.BufferGeometry; balloons: THREE.BufferGeometry; at: P3 } {
  const key = `${wide}x${deep}`, made = partyGeos.get(key);
  if (made) return made;
  const out = (n: number): number => (n === 1 ? 0.56 : n / 2 - 0.1);
  const side = out(wide), far = out(deep), cake = wide > 1 && deep > 1;
  // de taart staat rechtsvoor, tenzij het toestel daar zelf iets heeft staan (`cakeAt`)
  const [cx, cz] = cakeAt ?? [side - 0.16, far - 0.16];
  const rope: THREE.BufferGeometry[] = [], flags: THREE.BufferGeometry[] = [];
  const top = (i: number): THREE.Vector3 => new THREE.Vector3(CORNERS[i][0] * side, PARTY_POLE, CORNERS[i][1] * far);
  for (const [i, j] of [[0, 1], [1, 3], [3, 2], [2, 0]]) garland(top(i), top(j), 'bunting', rope, flags);
  const white = merge([
    ...CORNERS.map(([x, z]) => tube(0.022, 0.028, PARTY_POLE, x * side, PARTY_POLE / 2, z * far)),
    ...rope,
    // het tafeltje en het glazuur van de taart
    ...(cake ? [boxAt(0.3, 0.04, 0.3, cx, 0.5, cz), ...CORNERS.map(([x, z]) => boxAt(0.035, 0.48, 0.035, cx + x * 0.12, 0.24, cz + z * 0.12)), tube(0.115, 0.115, 0.03, cx, 0.625, cz)] : []),
  ]);
  const colors = merge([
    ...flags,
    ...(cake ? [
      paint(tube(0.11, 0.11, 0.1, cx, 0.57, cz), 0xf48fb1),
      ...[[-0.05, 0.03], [0.05, 0.02], [0, -0.05]].flatMap(([x, z], i) => [
        paint(boxAt(0.018, 0.07, 0.018, cx + x, 0.675, cz + z), PENNANTS[i]),
        paint(boxAt(0.024, 0.03, 0.024, cx + x, 0.725, cz + z), 0xffc21f),
      ]),
    ] : []),
  ]);
  // de ballonnen: om de top van de paal, zodat ze kunnen wiegen
  const spots: P3[] = [[0.02, 0.36, 0], [-0.17, 0.26, 0.05], [0.14, 0.24, -0.1]];
  const balloons = merge(spots.flatMap((p, i) => [paint(ball(0.13, ...p), PENNANTS[i]), paint(beam(0.008, [0, 0, 0], [p[0], p[1] - 0.12, p[2]]), 0xf7f4ec)]));
  const geos = { white, colors, balloons, at: [side, PARTY_POLE, far] as P3 };
  partyGeos.set(key, geos);
  return geos;
}
// Een vieze kraam: bruine vlekken op de vloer (en bij een kraam ook op de toonbank), en twee vliegen.
const GRIME_MAT = std(0x6b4a2a, 1);
const FLY_MAT = std(0x22201c, 0.6);
const FLY_GEO = mergeGeometries([boxAt(0.035, 0.03, 0.05, 0, 0, 0), boxAt(0.07, 0.006, 0.03, 0, 0.018, 0)])!;
const grime = (w: number, d: number, x: number, z: number, turn: number): THREE.BufferGeometry =>
  new THREE.CylinderGeometry(0.5, 0.5, 0.008, 9).scale(w, 1, d).rotateY(turn).translate(x, 0.056, z);
const GRIME_FLOOR_GEO = mergeGeometries([grime(0.34, 0.22, -0.3, 0.2, 0.4), grime(0.24, 0.16, 0.26, -0.3, -0.6), grime(0.2, 0.14, -0.52, -0.5, 1.1), grime(0.16, 0.12, 0.1, 0.36, 0.2)])!;
const GRIME_FRONT_GEO = mergeGeometries([boxAt(0.26, 0.15, 0.012, -0.3, 0.2, 0.468), boxAt(0.14, 0.2, 0.012, 0.42, 0.14, 0.468), boxAt(0.2, 0.01, 0.12, 0.3, 0.413, 0.3)])!;

// Het weer: één stel deeltjes voor regen, sneeuw, bladeren en bloesem.
const WEATHER_MAX = 500;
const WEATHER_COUNT: Record<Sky, number> = { clear: 0, rain: 500, snow: 360, leaves: 60, petals: 70 };
const WEATHER_TOP = 8;
const WEATHER_TINTS: Record<Sky, number[]> = {
  clear: [0xffffff],
  rain: [0xbcd6ea, 0xa9c8e2],
  snow: [0xffffff],
  leaves: [0xe08a2c, 0xb5562b, 0xd9a03a, 0x8a5a2c],
  petals: [0xf9bcd3, 0xfbd3e2, 0xf7a8c6],
};
const RAIN_SKY = new THREE.Color(0x9aa7b4);
// De regenboog: zes banen in het vlak van x en y.
const RAINBOW = [0xe0584f, 0xf08a24, 0xffd23f, 0x6cc04a, 0x4a90e2, 0xa06ad9];
/** Zo lang reageert een versiering nadat je erop tikt. */
const POKE_SECONDS = 1.2;
/** Hoeveel de wieken van de molen extra gedraaid zijn sinds het aantikken: eerst snel, dan uitlopend. */
const pokeSpin = (since: number): number => {
  const s = Math.max(0, Math.min(POKE_SECONDS, since));
  return 9 * (s - (s * s) / (2 * POKE_SECONDS));
};
const PATH_FLOWERS = [0xe0584f, 0xffd23f, 0xf06aa6, 0xf7f4ec, 0xb06ad9, 0xf08a24];
// Een brug over één tegel, langs x: planken met aan weerszijden een lage leuning.
const BRIDGE_GEO = mergeGeometries([
  ...[-0.4, -0.2, 0, 0.2, 0.4].map((x, i) => paint(boxAt(0.19, 0.03, 0.86, x, 0.016, 0), i % 2 ? 0xb98a55 : 0xc79a63)),
  ...[-0.42, 0.42].flatMap(z => [
    paint(boxAt(1, 0.045, 0.05, 0, 0.27, z), 0x8a5a2e),
    paint(boxAt(1, 0.035, 0.04, 0, 0.14, z), 0x8a5a2e),
    ...[-0.45, 0, 0.45].map(x => paint(boxAt(0.07, 0.3, 0.07, x, 0.15, z), 0x7a4f2c)),
  ]),
])!;
const FLOWER_EDGE_GEO = boxAt(1, 0.03, 0.11, 0, 0.015, 0);
const FLOWER_HEAD_GEO = blob(0.046, 1, 0.75, 1, 0, 0.06, 0, 0);
const FLOWER_EDGE_MAT = std(0x6fb44c, 1);
const PUDDLE_GEO = new THREE.CircleGeometry(1, 16).rotateX(-Math.PI / 2);
// Afval in vier soorten, groot en fel genoeg om tussen de gasten op te vallen: een omgevallen beker met een
// rietje en een plasje, een frietbakje met frietjes en een prop papier, een bananenschil, en een blikje met een
// servet en een klokhuis. Elke soort is één onderdeel.
const sideways = (g: THREE.BufferGeometry, x: number, y: number, z: number): THREE.BufferGeometry => g.rotateZ(Math.PI / 2 - 0.12).translate(x, y, z);
const LITTER_KINDS: Part[][] = [
  [[painted(
    [0xf7f4ec, sideways(new THREE.CylinderGeometry(0.085, 0.065, 0.2, 9), 0, 0.078, 0)],
    [0xe0584f, sideways(new THREE.CylinderGeometry(0.092, 0.092, 0.028, 9), -0.105, 0.09, 0)],
    [0x4a90e2, rod(0.012, [-0.1, 0.09, 0], [-0.27, 0.13, 0.06], 5)],
    [0xf5b44a, tube(0.1, 0.1, 0.006, -0.2, 0.004, 0.08)],
  ), PAINT_MAT]],
  [[painted(
    [0xd8362e, new THREE.CylinderGeometry(0.115, 0.08, 0.16, 4).rotateY(Math.PI / 4).scale(1, 1, 0.55).rotateX(1.25).translate(0, 0.06, 0)],
    [0xffd23f, boxAt(0.03, 0.03, 0.14, -0.03, 0.045, 0.14), new THREE.BoxGeometry(0.03, 0.03, 0.13).rotateY(0.6).translate(0.07, 0.02, 0.2), new THREE.BoxGeometry(0.03, 0.03, 0.12).rotateY(-0.5).translate(-0.11, 0.02, 0.14)],
    [0xf7f4ec, blob(0.06, 1, 0.8, 1, 0.15, 0.045, -0.1, 0)],
  ), PAINT_MAT]],
  [[painted(
    [0xffd23f, ...[0, 1, 2, 3].map(i => new THREE.BoxGeometry(0.17, 0.02, 0.065).translate(0.085, 0, 0).rotateZ(-0.28).rotateY((i * Math.PI) / 2 + 0.3).translate(0, 0.055, 0))],
    [0xfbeeb0, ...[0, 1, 2, 3].map(i => new THREE.BoxGeometry(0.13, 0.012, 0.04).translate(0.085, 0.014, 0).rotateZ(-0.28).rotateY((i * Math.PI) / 2 + 0.3).translate(0, 0.055, 0))],
    [0x6b4a2a, boxAt(0.035, 0.05, 0.035, 0, 0.075, 0)],
  ), PAINT_MAT]],
  [[painted(
    [0x4a90e2, new THREE.CylinderGeometry(0.055, 0.055, 0.17, 9).rotateX(Math.PI / 2).translate(0, 0.055, 0)],
    [0xcfd6dc, new THREE.CylinderGeometry(0.047, 0.047, 0.178, 9).rotateX(Math.PI / 2).translate(0, 0.055, 0)],
    [0xf7f4ec, new THREE.BoxGeometry(0.18, 0.012, 0.16).rotateY(0.4).translate(0.15, 0.008, 0.1), blob(0.03, 1, 1.5, 1, 0, 0, 0, 0).rotateZ(1.2).translate(-0.15, 0.03, -0.08)],
    [0xe0453a, dot(0.03, -0.2, 0.035, -0.08), dot(0.03, -0.1, 0.03, -0.08)],
  ), PAINT_MAT]],
];

// Een gevallen ijsje: een roze plasje gesmolten ijs met spetters, en het hoorntje dat er omgevallen naast ligt.
const SPLAT: Part[] = [[painted(
  [0xffc1d6, blob(0.15, 1, 0.16, 0.8, 0, 0.012, 0), blob(0.055, 1, 0.3, 1, 0.17, 0.008, 0.08, 0), blob(0.045, 1, 0.3, 1, -0.14, 0.006, 0.11, 0), blob(0.035, 1, 0.3, 1, 0.02, 0.006, -0.15, 0)],
  [0xffe3ec, blob(0.06, 1, 0.3, 1, -0.03, 0.03, -0.02, 0)],
  [0xe3b06a, new THREE.ConeGeometry(0.055, 0.19, 8).rotateZ(-1.75).translate(0.13, 0.045, -0.05)],
), PAINT_MAT]];

function build(parts: Part[], mat?: THREE.Material): THREE.Group {
  const group = new THREE.Group();
  for (const [geo, m, shadow = true] of parts) {
    const mesh = new THREE.Mesh(geo, mat ?? m);
    mesh.castShadow = !mat && shadow;
    mesh.receiveShadow = !mat && !shadow;
    group.add(mesh);
  }
  return group;
}

/**
 * Speelgoed, met zijn losse stukken elk in een eigen groepje op hun eigen plek. Het spel vindt ze in
 * `userData.loose` en laat ze rollen; bij elk stuk staat in `userData` waar het hoort (`x`, `z`), de straal en `turn`.
 */
function buildToy(kind: ToyKind, mat?: THREE.Material): THREE.Group {
  const group = build(TOY_PARTS[kind], mat);
  const loose: THREE.Object3D[] = [];
  for (const { x, z, r, turn, wheel, parts } of TOY_LOOSE[kind] ?? []) {
    const piece = build(parts, mat);
    piece.position.set(x, r, z);
    // eerst rollen om de eigen lengte, dan pas draaien: zo rolt een stam altijd dwars op hoe hij ligt
    piece.rotation.order = 'YXZ';
    piece.rotation.y = turn ?? 0;
    // (een los stuk rolt rond: geen schaduw in zijn kleuren, zie shadeGroup)
    piece.userData = { x, z, r, turn, wheel, noShade: true };
    group.add(piece);
    loose.push(piece);
  }
  if (loose.length) group.userData.loose = loose;
  if (!mat) shadeGroup(group);
  return group;
}
/** De as waar een los stuk omheen rolt: één keer gemaakt, elke keer opnieuw gebruikt. */
const ROLL_AXIS = new THREE.Vector3();
/** Voor het draaien van een los onderdeel om zijn paal (zie `swingPart`). */
const SPIN = new THREE.Quaternion();

const NIGHT_SKY = new THREE.Color(0x16224a);
/** De omgeving kleurt mee met de wereld waarin je speelt. */
const WORLD_LOOK: Record<WorldId, { sky: number; ground: number; leaves: [number, number, number] }> = {
  farm: { sky: 0xbfe6ff, ground: 0x6fb44c, leaves: [0x4f9e45, 0x5bab4c, 0x468f3e] },
  savanna: { sky: 0xffe6bd, ground: 0xcdb96a, leaves: [0x8f9a44, 0xa3a84f, 0x7d8a3a] },
  jungle: { sky: 0xbfeccd, ground: 0x3f8f45, leaves: [0x2f7f3a, 0x3a9146, 0x276f33] },
  ice: { sky: 0xdcefff, ground: 0xe9f1f8, leaves: [0xcfe3dc, 0xe6f1ee, 0xb9d6cc] },
  far: { sky: 0xc5ecf5, ground: 0x74bf8f, leaves: [0x3f9f78, 0x4fb088, 0x358c6a] },
};

// Losse stukjes voer: een bak met vier porties toont vier stukjes. Elk stukje is één onderdeel met zijn eigen
// kleuren; het ligt langs z, met het midden op nul.
const along = (g: THREE.BufferGeometry, x: number, y: number, z: number): THREE.BufferGeometry => g.rotateX(Math.PI / 2).translate(x, y, z);
const leaflet = (x: number, z: number, turn: number): THREE.BufferGeometry => blob(0.055, 0.75, 0.25, 1.35, 0, 0, 0, 0).rotateY(turn).translate(x, 0.012, z);
const FOOD_GEOS: Record<FoodId, THREE.BufferGeometry> = {
  // een wortel met loof
  veg: painted(
    [0xf08a2c, along(new THREE.ConeGeometry(0.06, 0.28, 7), 0, 0, 0)],
    [0x5fa544, ...[-0.5, 0, 0.5].map(a => new THREE.ConeGeometry(0.024, 0.12, 4).rotateX(-Math.PI / 2).translate(0, 0, -0.05).rotateY(a).translate(0, 0, -0.13))],
  ),
  // een baal hooi met twee touwtjes erom
  hay: painted(
    [0xe9d05a, new THREE.BoxGeometry(0.14, 0.12, 0.3)],
    [0xb8923a, boxAt(0.148, 0.128, 0.022, 0, 0, -0.08), boxAt(0.148, 0.128, 0.022, 0, 0, 0.08)],
    [0xf6e58a, boxAt(0.03, 0.02, 0.1, 0.03, 0.062, 0), boxAt(0.03, 0.02, 0.08, -0.035, 0.062, 0.1), boxAt(0.03, 0.02, 0.07, -0.03, 0.062, -0.11)],
  ),
  // een appel met een steeltje en een blaadje
  fruit: painted(
    [0xe0453a, blob(0.078, 1, 0.9, 1, 0, 0.02, 0)],
    [0x6b4a2a, boxAt(0.02, 0.05, 0.02, 0, 0.105, 0)],
    [0x5fa544, blob(0.03, 1.4, 0.3, 0.8, 0.035, 0.115, 0, 0)],
  ),
  // een schoof graan: een bosje halmen met dikke aren en een touwtje erom
  grain: painted(
    [0xe3c88f, along(new THREE.CylinderGeometry(0.05, 0.03, 0.2, 6), 0, 0, -0.04)],
    [0xd9a441, blob(0.035, 0.9, 0.9, 1.9, -0.04, 0.005, 0.1, 0), blob(0.035, 0.9, 0.9, 1.9, 0.04, 0.005, 0.1, 0), blob(0.035, 0.9, 0.9, 1.9, 0, 0.03, 0.12, 0)],
    [0xb5562b, along(new THREE.CylinderGeometry(0.043, 0.043, 0.03, 6), 0, 0, -0.07)],
  ),
  // een lap vlees met een vetrandje en een rond botje (net als het plaatje)
  meat: painted(
    [0xf4d9c6, blob(0.085, 1, 0.42, 1.5, 0, -0.012, 0)],
    [0xc9553f, blob(0.074, 1, 0.5, 1.5, 0, 0, 0)],
    [0xf4ead8, blob(0.026, 1, 0.5, 1, -0.012, 0.03, -0.045, 0)],
  ),
  // een takje met blaadjes
  leaves: painted(
    [0x7a5a34, rod(0.012, [0, 0, -0.15], [0, 0.01, 0.14], 4)],
    [0x5fa544, leaflet(-0.045, -0.08, 0.5), leaflet(0.045, 0, -0.5), leaflet(0, 0.13, 0)],
    [0x7cc053, leaflet(0.045, -0.1, -0.6), leaflet(-0.045, 0.04, 0.6)],
  ),
  // een vis met een staart, een rugvin en oogjes
  fish: painted(
    [0x7fa7c9, blob(0.06, 0.62, 1, 2, 0, 0, -0.02)],
    [0xdfeaf2, blob(0.05, 0.6, 0.5, 1.7, 0, -0.028, -0.02, 0)],
    [0x5f87ab, new THREE.ConeGeometry(0.065, 0.1, 4).rotateX(-Math.PI / 2).scale(0.3, 1, 1).translate(0, 0, 0.15), boxAt(0.012, 0.04, 0.08, 0, 0.06, -0.01)],
    [0x22201c, dot(0.013, -0.03, 0.018, -0.1), dot(0.013, 0.03, 0.018, -0.1)],
  ),
  // twee stengels bamboe met knopen en een paar blaadjes
  bamboo: painted(
    [0x9bd05a, rod(0.026, [-0.035, 0, -0.15], [-0.035, 0, 0.15], 6), rod(0.026, [0.035, 0.012, -0.14], [0.035, 0.012, 0.16], 6)],
    [0x6fa53a, ...[[-0.035, 0, -0.05], [-0.035, 0, 0.06], [0.035, 0.012, -0.02], [0.035, 0.012, 0.09]].map(([x, y, z]) => along(new THREE.CylinderGeometry(0.032, 0.032, 0.018, 6), x, y, z))],
    [0x5fa544, leaflet(0.07, -0.1, -0.7).translate(0, 0.03, 0), leaflet(-0.07, 0.1, 0.7).translate(0, 0.03, 0)],
  ),
};

/** Eén stukje voer, zoals in de voerbak (ook voor een snoepje dat je gooit). */
export function foodPiece(food: FoodId): THREE.Object3D {
  return new THREE.Mesh(FOOD_GEOS[food], PAINT_MAT);
}

export const toWorldX = (gx: number): number => gx - W / 2;
export const toWorldZ = (gy: number): number => gy - H / 2;

export interface TroughMesh {
  group: THREE.Group;
  food: THREE.Group;
  kind: TroughKind;
}

/**
 * Een licht in het donker: het midden op het raster en hoe ver het reikt, in tegels. Met `h` hangt het licht zo
 * hoog boven de grond (de lampjes van het reuzenrad, het dak van de toren): dan is het een ronde gloed in de lucht
 * in plaats van een platte kring op de grond.
 */
export interface ParkLight {
  gx: number;
  gy: number;
  r: number;
  h?: number;
}

export class View {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
  /** Het punt op de grond waar de camera naar kijkt. */
  readonly target = new THREE.Vector3(0, 0, H / 2 - 9);
  /** Hoeveel tegels er verticaal in beeld passen. */
  zoom = 11;
  /**
   * De loopstand (zie walk.ts): een tweede camera op ooghoogte van een kind. `walkK` loopt van 0 (het gewone beeld
   * van boven) naar 1 (beneden, tussen de dieren); daartussen vliegt de camera rustig omlaag of weer omhoog.
   */
  readonly eyeCam = new THREE.PerspectiveCamera(WALK.fov, 1, 0.05, 160);
  private walkK = 0;
  private walkWant = 0;
  /** Waar je ogen zijn in de loopstand: op het raster, de hoogte, en de kant waar je naar kijkt. */
  private eyeAt = { gx: 0, gy: 0, h: WALK.eye, yaw: 0, pitch: 0 };
  private eyeLook = new THREE.Vector3();
  private eyeFrom = new THREE.Vector3();

  /** De tegels van het park, elk met het plaatje van zijn ondergrond (zie ground.ts). */
  private ground: Ground;
  private fences = new Map<string, THREE.Object3D>();
  /** Het water in de bakken van glas. */
  private tank: THREE.InstancedMesh | null = null;
  private tankKey = '';
  /** De vuiltjes in vies water, en per vuiltje waar het zweeft (x, hoogte, z, en een eigen tel om op en neer te gaan). */
  private specks: THREE.InstancedMesh | null = null;
  private speckAt: [number, number, number, number][] = [];
  private speckTime = 0;
  private raycaster = new THREE.Raycaster();
  private plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private tmp = new THREE.Vector3();

  // voorbeeld van wat je gaat plaatsen
  private ghostMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.6, depthWrite: false });
  private ghostFenceMesh = new THREE.Mesh(FENCE_GEO, this.ghostMat);
  private ghostGateMesh = new THREE.Mesh(GATE_GEO, this.ghostMat);
  private ghostTroughMesh = new THREE.Mesh(TROUGH_GEO, this.ghostMat);
  private ghostWallMesh = new THREE.Mesh(WALL_GEO, this.ghostMat);
  private ghostNetMesh = new THREE.Mesh(NET_GEO, this.ghostMat);
  private ghostGlassMesh = new THREE.Mesh(GLASS_FRAME_GEO, this.ghostMat);
  private ghostWindowMesh = new THREE.Mesh(WINDOW_GEO, this.ghostMat);
  private ghostPicketMesh = new THREE.Mesh(PICKET_GEO, this.ghostMat);
  private ghostPetgateMesh = new THREE.Mesh(PETGATE_GEO, this.ghostMat);
  private ghostBeds = Object.fromEntries(BEDS.map(k => [k, build(BED_PARTS[k], this.ghostMat)])) as Record<BedKind, THREE.Group>;
  private ghostToys = Object.fromEntries(TOYS.map(k => [k, buildToy(k, this.ghostMat)])) as Record<ToyKind, THREE.Group>;
  private ghostDecors = Object.fromEntries(DECORS.map(k => [k, buildDecor(k, this.ghostMat)])) as Record<DecorKind, THREE.Group>;
  private ghostProps = Object.fromEntries(PROPS.map(k => [k, build(PROP_PARTS[k], this.ghostMat)])) as Record<PropKind, THREE.Group>;
  private ghostShops = Object.fromEntries(SHOPS.map(k => [k, buildShop(k, this.ghostMat)])) as Record<ShopKind, THREE.Group>;
  private ghostTileMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.75, depthWrite: false });
  private ghostTileMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.94, 0.94).rotateX(-Math.PI / 2), this.ghostTileMat);
  private ghostRingMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.85, depthWrite: false });
  private ghostRing = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.44, 28).rotateX(-Math.PI / 2), this.ghostRingMat);
  /** De lijn waar de kabel van de kabelbaan komt (zie ghostCable). */
  private ghostCableMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 0.07, 0.07), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.75, depthWrite: false }));
  private ghostAnimals = new Map<string, THREE.Object3D>();
  private ghosts: THREE.Object3D[] = [];

  private flashes: { meshes: THREE.Mesh[]; mat: THREE.MeshBasicMaterial; life: number }[] = [];
  /** Ringen op de grond die iets laten oplichten: de poepjes onder de veger, het dier dat hulp nodig heeft. */
  private marks: THREE.Mesh[] = [];
  private markGeo = new THREE.RingGeometry(0.2, 0.3, 28).rotateX(-Math.PI / 2);
  private markMat = new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.9, depthWrite: false });
  private hotMat = new THREE.MeshBasicMaterial({ color: 0xff7a3d, transparent: true, opacity: 0.95, depthWrite: false, depthTest: false });
  /** Spatters: kleine druppels die opspringen en weer vallen. */
  private drops: { mesh: THREE.Mesh; vx: number; vy: number; vz: number; life: number }[] = [];
  /** Planken van een omgeduwd hek die omvallen: `tip` is de kant waarheen, `t` hoe lang het al duurt. */
  private falls: { obj: THREE.Group; plank: THREE.Mesh; mat: THREE.MeshStandardMaterial; tip: number; t: number }[] = [];
  private dropGeo = new THREE.BoxGeometry(0.05, 0.05, 0.05);
  private dropMat = new THREE.MeshBasicMaterial({ color: 0xe6f6ff });
  /** Waar het beeld rustig naartoe schuift (de knop 'dier in nood'). */
  private fly: { x: number; z: number } | null = null;
  /** Het beeld draaien: zoveel kwartslagen is het gedraaid, en de hoek waar de camera nu staat (die loopt er rustig heen). */
  private turn = 0;
  private angle = 0;
  private flashGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  private sun = new THREE.DirectionalLight(0xfff4dd, 2.2);
  /** 2 = alles aan, 1 = minder scherp, 0 = ook zonder schaduwen. */
  private quality = 2;
  private slowFor = 0;
  private outerMat = new THREE.MeshStandardMaterial({ color: 0x6fb44c, roughness: 1 });
  private hemi = new THREE.HemisphereLight(0xffffff, 0x9ad07a, 1.6);
  private nightCanvas = document.createElement('canvas');
  private skyDay = new THREE.Color(0xbfe6ff);
  /** De lucht met verloop en wolken, het uur van de dag, en wat dat uur met licht en lucht doet (zie daylight.ts). */
  private skyDome: SkyDome;
  private hour = DAY_HOUR;
  private look = newLook();
  private skyTop = new THREE.Color();
  private skyCloud = new THREE.Color();
  /** Het nieuwe licht en de nieuwe lucht (false = het oude platte beeld, om te vergelijken: `__zoo.view.setLook(false)`). */
  private fancy = true;
  private dark = 0;
  /** Hoe nat het is (0 = droog, 1 = volop regen): dan is het licht wat zwakker en de lucht grijzer. */
  private wet = 0;
  /**
   * De bomen rond het park: één vorm per onderdeel, voor alle bomen samen. Elke boom heeft zijn eigen hoogte
   * (`tall`) en breedte (`wide`); ongeveer een derde is een spar (`fir`) en sommige loofbomen bloeien in de lente.
   */
  private treeSpots: { gx: number; gy: number; s: number; rot: number; tall: number; wide: number; fir: boolean; bloom: boolean }[] = [];
  /** Stam, twee bollen blad van de loofboom, de spar en de bloesem. */
  private treeParts: THREE.InstancedMesh[] = [];
  /** De kleuren van de wereld in de zomer; het seizoen kleurt ze bij (zie applySeason). */
  private worldLeaves = [0x4f9e45, 0x5bab4c, 0x468f3e];
  private worldGround = 0x6fb44c;
  /** Het raster van de laatste keer tekenen, zodat een nieuw seizoen de tegels opnieuw kan kleuren. */
  private grid: Grid | null = null;
  // bruggen en bloemenranden op de paden: alleen opnieuw gebouwd als er een tegel bij komt of weggaat
  private pathKey = '';
  private pathExtras: THREE.InstancedMesh[] = [];
  // het weer: één stel deeltjes dat rond het midden van het beeld valt
  private weather: THREE.InstancedMesh | null = null;
  private sky: Sky = 'clear';
  /** Per deeltje: x, y, z (elk van 0 tot 1 in de doos) en een eigen getal voor de afwisseling. */
  private flakes = new Float32Array(WEATHER_MAX * 4);
  private weatherClock = 0;
  private wm = new THREE.Matrix4();
  private wq = new THREE.Quaternion();
  private we = new THREE.Euler();
  private wp = new THREE.Vector3();
  private ws = new THREE.Vector3();
  private rainbow: THREE.Mesh | null = null;
  private burstMats = new Map<number, THREE.MeshBasicMaterial>();
  private train: { loco: THREE.Group; wagons: THREE.Group[] } | null = null;
  // slingers tussen de palen
  private strings: THREE.Group | null = null;
  private stringKey = '';
  /** Per strook die te koop is: een licht vlak over de grond en een bordje. */
  private plots = new Map<Side, { plane: THREE.Mesh; sign: THREE.Group }>();
  /** Alleen voor de bomen rond het park: die hebben grijze kleuren per hoekpunt voor de schaduw (zie addTrees). */
  private leafMats = [0x4f9e45, 0x5bab4c, 0x468f3e].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 1, vertexColors: true }));

  constructor(parent: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = TONE.mapping;
    this.renderer.toneMappingExposure = TONE.exposure;
    parent.prepend(this.renderer.domElement);
    this.scene.background = new THREE.Color(0xbfe6ff);
    // mist, alleen in de loopstand dichtbij genoeg om te zien: van boven ligt hij ver achter het park
    // (van boven is er wel het waas buiten het park, zie sky.ts)
    this.scene.fog = new THREE.Fog(0xbfe6ff, 900, 1000);
    this.skyDome = new SkyDome(this.scene);

    this.scene.add(this.hemi);
    // de nacht: een donker vlak over het beeld, met gaten waar licht is
    this.nightCanvas.id = 'night';
    this.nightCanvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;display:none';
    this.renderer.domElement.after(this.nightCanvas);
    const sun = this.sun;
    sun.position.set(-8, 20, 11);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const reach = W / 2 + 6;
    Object.assign(sun.shadow.camera, { left: -reach, right: reach, top: reach, bottom: -reach, near: 1, far: 70 });
    this.scene.add(sun);

    // omgeving rond het park
    const outer = new THREE.Mesh(new THREE.PlaneGeometry(120, 120).rotateX(-Math.PI / 2), this.outerMat);
    outer.position.y = -0.02;
    outer.receiveShadow = true;
    this.scene.add(outer);
    this.addTrees();
    this.addEntrance();

    // tegels: elk met het plaatje van zijn ondergrond; het land eromheen (120 breed) krijgt pollen in de kleur van de wereld
    const sharp = this.renderer.capabilities.getMaxAnisotropy();
    this.outerMat.map = aroundTexture(120, sharp);
    this.ground = new Ground(sharp);
    this.scene.add(this.ground.mesh);
    this.addPlots();
    this.setLand(BASE_LAND, SIDES);

    this.ghostTileMesh.position.y = 0.012;
    this.ghostRing.position.y = 0.014;
    this.ghosts = [this.ghostFenceMesh, this.ghostGateMesh, this.ghostWallMesh, this.ghostNetMesh, this.ghostGlassMesh, this.ghostWindowMesh, this.ghostPicketMesh, this.ghostPetgateMesh, this.ghostTroughMesh, ...Object.values(this.ghostBeds), ...Object.values(this.ghostToys), ...Object.values(this.ghostDecors), ...Object.values(this.ghostProps), ...Object.values(this.ghostShops), this.ghostTileMesh, this.ghostRing, this.ghostCableMesh];
    for (const g of this.ghosts) {
      g.visible = false;
      g.traverse(o => { o.renderOrder = 5; });
      this.scene.add(g);
    }

    addEventListener('resize', () => this.resize());
    this.resize();
    this.relight();
  }

  /** De ingang van het park: hier komen de gasten binnen. */
  private addEntrance(): void {
    const x = toWorldX(Math.floor(W / 2)), z = toWorldZ(H) + 0.12;
    const gate = new THREE.Group();
    for (const dx of [-0.12, 1.12]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.5, 0.22), WOOD_MAT);
      post.position.set(x + dx, 0.75, z);
      gate.add(post);
    }
    const sign = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.44, 0.14), ROOF_MAT);
    sign.position.set(x + 0.5, 1.6, z);
    const star = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 0.18), STRAW_MAT);
    star.position.set(x + 0.5, 1.6, z);
    star.rotation.z = Math.PI / 4;
    gate.add(sign, star);
    gate.traverse(o => { o.castShadow = true; });
    this.scene.add(gate);
    this.entrance = { gate, star, x: x + 0.5, z };
  }

  /** De ingang: het bord met de ster in het midden, waar later de sterren van het park op komen. */
  private entrance!: { gate: THREE.Group; star: THREE.Mesh; x: number; z: number };
  private entranceStars: THREE.Mesh[] = [];

  /**
   * De sterren van het park op het bord boven de ingang: `n` goud, de rest grijs. Ze steken aan beide kanten door
   * het bord, zodat je ze ook ziet als je het beeld draait. Bij null staat er weer één ster op het bord.
   */
  setEntranceStars(n: number | null): void {
    const { gate, star, x, z } = this.entrance;
    if (n !== null && !this.entranceStars.length) {
      const shape = new THREE.Shape();
      for (let i = 0; i < 10; i++) {
        const r = i % 2 ? 0.065 : 0.15, a = Math.PI / 2 + (i * Math.PI) / 5;
        if (i) shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        else shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.2, bevelEnabled: false }).translate(0, 0, -0.1);
      for (let i = 0; i < 5; i++) {
        const m = new THREE.Mesh(geo, STAR_GREY_MAT);
        m.position.set(x + (i - 2) * 0.33, 1.6, z);
        this.entranceStars.push(m);
        gate.add(m);
      }
    }
    star.visible = n === null;
    this.entranceStars.forEach((m, i) => {
      m.visible = n !== null;
      m.material = n !== null && i < n ? STAR_GOLD_MAT : STAR_GREY_MAT;
    });
  }

  // ------------------------------------------------------------ het avondfeest
  /** De grote gong naast de poort (alleen op een feestavond): het rek, de schijf die kan zwaaien, en hoe ver hij is. */
  private gong: { group: THREE.Group; disc: THREE.Group; mat: THREE.MeshStandardMaterial; swing: number; grow: number; on: boolean } | null = null;
  /** Tijdens het feest: hoe lang het al bezig is, voor de kleuren van de lampen (null = geen feest). */
  private partyT: number | null = null;
  private partyWhite = new THREE.Color(0xffffff);

  /** Waar de gong staat, in tegels: op het pleintje voor de poort, rechts van de gasten die binnenkomen. */
  gongSpot(): [number, number] {
    return [Math.floor(W / 2) + 0.5 + 1.3, H + 0.5];
  }

  /** De gong zetten of weghalen. Hij groeit even op als hij komt. Wordt pas gemaakt als hij nodig is. */
  showGong(on: boolean): void {
    if (!this.gong) {
      if (!on) return;
      const red = ROOF_MAT, mat = new THREE.MeshStandardMaterial({ color: 0xf2b632, metalness: 0.45, roughness: 0.35, emissive: 0x7a4a00, emissiveIntensity: 0.35 });
      const group = new THREE.Group(), disc = new THREE.Group();
      // het rek: twee rode palen op voetjes, met een balk erover die aan de uiteinden iets omhoog krult
      group.add(new THREE.Mesh(merge([
        boxAt(0.08, 1.05, 0.08, -0.34, 0.525, 0), boxAt(0.08, 1.05, 0.08, 0.34, 0.525, 0),
        boxAt(0.86, 0.09, 0.1, 0, 1.07, 0), boxAt(0.1, 0.1, 0.1, -0.46, 1.12, 0), boxAt(0.1, 0.1, 0.1, 0.46, 1.12, 0),
      ]), red));
      group.add(new THREE.Mesh(merge([boxAt(0.26, 0.06, 0.3, -0.34, 0.03, 0), boxAt(0.26, 0.06, 0.3, 0.34, 0.03, 0)]), WOOD_MAT));
      // de schijf hangt aan twee touwtjes onder de balk en zwaait om die balk
      disc.position.set(0, 1.02, 0);
      disc.add(new THREE.Mesh(merge([boxAt(0.02, 0.22, 0.02, -0.12, -0.11, 0), boxAt(0.02, 0.22, 0.02, 0.12, -0.11, 0)]), ROPE_MAT));
      disc.add(new THREE.Mesh(merge([new THREE.CylinderGeometry(0.28, 0.28, 0.05, 28).rotateX(Math.PI / 2).translate(0, -0.47, 0), ball(0.07, 0, -0.47, 0.03)]), mat));
      group.add(disc);
      // de stok met de zachte bol leunt tegen de paal
      const stick = new THREE.Mesh(merge([new THREE.CylinderGeometry(0.018, 0.018, 0.6, 6).translate(0, 0.3, 0), ball(0.06, 0, 0.62, 0)]), WOOD_MAT);
      stick.position.set(0.44, 0, 0.12);
      stick.rotation.z = 0.25;
      group.add(stick);
      group.traverse(o => { o.castShadow = true; });
      const [gx, gy] = this.gongSpot();
      group.position.set(toWorldX(gx), 0, toWorldZ(gy));
      this.scene.add(group);
      this.gong = { group, disc, mat, swing: 0, grow: 0, on };
    }
    if (on && !this.gong.on) this.gong.grow = 0;
    this.gong.on = on;
    this.gong.group.visible = on;
  }

  /** Bong! De schijf zwaait en glanst even. */
  hitGong(): void {
    if (this.gong) this.gong.swing = 1;
  }

  /** De gong bewegen: opgroeien als hij net staat, en uitzwaaien na een klap. */
  private stepGong(dt: number): void {
    const g = this.gong;
    if (!g?.on) return;
    g.grow = Math.min(1, g.grow + dt * 2.5);
    g.group.scale.setScalar(0.2 + 0.8 * (1 - (1 - g.grow) ** 3));
    g.swing = Math.max(0, g.swing - dt * 0.45);
    g.disc.rotation.x = Math.sin(this.speckTime * 9) * 0.35 * g.swing;
    g.mat.emissiveIntensity = 0.35 + 1.4 * g.swing;
  }

  /**
   * Het feest in de lampen: alle lampjes (lantaarns, lichtjes in de slingers) gaan langzaam door alle kleuren en
   * branden fel; ook de gloed bij elk licht in de nacht krijgt een kleur. Met null is alles weer gewoon.
   */
  setParty(t: number | null): void {
    this.partyT = t;
    if (t === null) {
      LAMP_MAT.emissive.setHex(0xffd23f);
      LAMP_MAT.color.setHex(0xfff1a8);
      this.relight();
      return;
    }
    LAMP_MAT.emissive.setHSL(partyHue(t) / 360, 0.9, 0.55);
    LAMP_MAT.color.copy(LAMP_MAT.emissive).lerp(this.partyWhite, 0.5);
    LAMP_MAT.emissiveIntensity = 2.2;
  }

  /**
   * Bomen rond het park en op de grond die je nog niet hebt. Ze staan verspreid over het hele gebied; een boom
   * verdwijnt zodra het park er komt (zie setLand).
   */
  private addTrees(): void {
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const mid = Math.floor(W / 2) + 0.5;
    while (this.treeSpots.length < 190) {
      const gx = -8 + rnd() * (W + 16), gy = -8 + rnd() * (H + 15);
      const s = 0.8 + rnd() * 0.7, rot = rnd() * Math.PI;
      // niet in het park waar je mee begint, en niet op de weg naar de ingang
      const inBase = gx > BASE_LAND.x0 - 1.2 && gx < BASE_LAND.x1 + 1.2 && gy > BASE_LAND.y0 - 1.2 && gy < BASE_LAND.y1 + 1.2;
      // en niet voor het park: daar ligt de weg met het verkeer
      if (inBase || (Math.abs(gx - mid) < 2.6 && gy > H - 2) || roadside(gy)) continue;
      // elke boom is anders: hoger of breder, een loofboom of een spar, en soms met bloesem in de lente
      const fir = hash(gx, gy, 1) < 0.34;
      this.treeSpots.push({ gx, gy, s, rot, tall: 0.82 + hash(gx, gy, 2) * 0.5, wide: 0.85 + hash(gx, gy, 3) * 0.35, fir, bloom: !fir && hash(gx, gy, 4) < 0.3 });
    }
    const n = this.treeSpots.length;
    const trunk = new THREE.MeshStandardMaterial({ color: 0x8a5a33, roughness: 1, vertexColors: true });
    // een beetje schaduw in de boom (zie shade.ts): de voet van de stam en de onderkant van het blad iets donkerder;
    // de bladkleur zelf komt uit het materiaal (die verandert met de seizoenen), de schaduw uit de grijze hoekpunten
    const tree = (geo: THREE.BufferGeometry, top: number): THREE.BufferGeometry => shadeGrey(geo, 0, top, THING_SHADE);
    this.treeParts = [
      new THREE.InstancedMesh(tree(new THREE.CylinderGeometry(0.09, 0.14, 0.66, 6).translate(0, 0.33, 0), 1.9), trunk, n),
      // de loofboom: een brede bol blad met een kleinere erbovenop
      new THREE.InstancedMesh(tree(blob(0.5, 1.1, 0.84, 1.1, 0, 0.97, 0), 1.9), this.leafMats[0], n),
      new THREE.InstancedMesh(tree(blob(0.34, 1.05, 0.85, 1.05, 0.04, 1.52, 0.03), 1.9), this.leafMats[1], n),
      // de spar: drie kegels op elkaar
      new THREE.InstancedMesh(tree(mergeGeometries([cone(0.62, 0.9, 0, 0.85, 0, 6), cone(0.48, 0.8, 0, 1.4, 0, 6), cone(0.32, 0.7, 0, 1.92, 0, 6)])!, 2.27), this.leafMats[2], n),
      // bloesem: roze bolletjes op het blad, alleen in de lente te zien
      new THREE.InstancedMesh(merge([
        ...[0, 1, 2, 3, 4].map(k => blob(0.085, 1, 1, 1, Math.cos(0.35 + 0.3 * (k % 2)) * Math.cos(k * 1.26) * 0.55, 0.97 + Math.sin(0.35 + 0.3 * (k % 2)) * 0.42, Math.cos(0.35 + 0.3 * (k % 2)) * Math.sin(k * 1.26) * 0.55, 0)),
        ...[0, 1, 2].map(k => blob(0.075, 1, 1, 1, 0.04 + Math.cos(0.5) * Math.cos(k * 2.1 + 0.6) * 0.357, 1.52 + Math.sin(0.5) * 0.29, 0.03 + Math.cos(0.5) * Math.sin(k * 2.1 + 0.6) * 0.357, 0)),
      ]), BLOSSOM_MAT, n),
    ];
    // elke boom een tikje lichter of donkerder
    const tint = new THREE.Color();
    for (let i = 0; i < n; i++) {
      this.treeParts[1].setColorAt(i, tint.setScalar(0.86 + rnd() * 0.24));
      this.treeParts[2].setColorAt(i, tint.setScalar(0.86 + rnd() * 0.24));
      this.treeParts[3].setColorAt(i, tint.setScalar(0.84 + hash(i, 5) * 0.28));
    }
    for (const part of this.treeParts) {
      part.castShadow = true;
      part.frustumCulled = false;
      this.scene.add(part);
    }
  }

  /** Voor elke strook: een licht vlak dat laat zien welk stuk je koopt, en een bordje met een vlag. */
  private addPlots(): void {
    const flat = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    for (const side of SIDES) {
      const plane = new THREE.Mesh(flat, new THREE.MeshBasicMaterial({ color: 0xfff6c8, transparent: true, opacity: 0.22, depthWrite: false }));
      plane.position.y = 0.012;
      plane.renderOrder = 1;
      const sign = new THREE.Group();
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.5, 0.14).translate(0, 0.75, 0), WOOD_MAT);
      const board = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.7, 0.1).translate(0, 1.35, 0.06), WHITE_MAT);
      const flag = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.32, 0.04).translate(0.3, 1.95, 0), ROOF_MAT);
      const pole = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.5, 0.05).translate(0.04, 1.85, 0), WOOD_MAT);
      sign.add(post, board, flag, pole);
      sign.traverse(o => { o.castShadow = true; });
      sign.rotation.y = Math.PI / 4;
      this.scene.add(plane, sign);
      this.plots.set(side, { plane, sign });
    }
  }

  /** Waar het bordje van een strook staat (in rastercoördinaten): midden op de strook. */
  plotCenter(plot: Land): [number, number] {
    return [(plot.x0 + plot.x1) / 2, (plot.y0 + plot.y1) / 2];
  }

  /**
   * De grond van het park is veranderd: alleen die tegels worden getekend, de bomen die er stonden gaan weg en
   * op elke strook die nog te koop is (`plots`) ligt een licht vlak met een bordje.
   */
  setLand(land: Land, forSale: Side[], plotOf: (side: Side) => Land = side => new Grid(land).plot(side)): void {
    const m = new THREE.Matrix4();
    const none = new THREE.Matrix4().makeScale(0, 0, 0);
    this.ground.setLand(land);
    const q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), at = new THREE.Vector3(), size = new THREE.Vector3();
    this.treeSpots.forEach((spot, i) => {
      const inside = spot.gx > land.x0 - 0.9 && spot.gx < land.x1 + 0.9 && spot.gy > land.y0 - 0.9 && spot.gy < land.y1 + 0.9;
      const k = inside ? 0 : spot.s;
      m.compose(at.set(toWorldX(spot.gx), 0, toWorldZ(spot.gy)), q.setFromAxisAngle(up, spot.rot), size.set(k * spot.wide, k * spot.tall, k * spot.wide));
      this.treeParts[0].setMatrixAt(i, m);
      this.treeParts[1].setMatrixAt(i, spot.fir ? none : m);
      this.treeParts[2].setMatrixAt(i, spot.fir ? none : m);
      this.treeParts[3].setMatrixAt(i, spot.fir ? m : none);
      this.treeParts[4].setMatrixAt(i, spot.bloom ? m : none);
    });
    for (const part of this.treeParts) part.instanceMatrix.needsUpdate = true;
    for (const [side, { plane, sign }] of this.plots) {
      const open = forSale.includes(side);
      plane.visible = sign.visible = open;
      if (!open) continue;
      const plot = plotOf(side);
      const [cx, cy] = this.plotCenter(plot);
      plane.position.set(toWorldX(cx), 0.012, toWorldZ(cy));
      plane.scale.set(plot.x1 - plot.x0 - 0.3, 1, plot.y1 - plot.y0 - 0.3);
      sign.position.set(toWorldX(cx), 0, toWorldZ(cy));
    }
  }

  /** Lucht, grasland en bomen rond het park passen bij de wereld. */
  setWorld(world: WorldId): void {
    const look = WORLD_LOOK[world];
    this.skyDay.setHex(look.sky);
    this.relight();
    this.worldGround = look.ground;
    this.worldLeaves = [...look.leaves];
    this.applySeason(false);
  }

  /** Hoe donker het is (0 = dag, 1 = nacht): de zon dimt, de lucht wordt donkerblauw en de lantaarns gaan fel aan. */
  setNight(dark: number): void {
    this.dark = dark;
    this.relight();
  }

  /**
   * Het uur van de dag (0 tot 24, zoals de klok): kleurt de zon, het licht van de lucht en de lucht zelf. Elk beeldje
   * aanroepen mag: pas als het uur echt verschoven is, wordt er iets gerekend.
   */
  setDayTime(hour: number): void {
    if (Math.abs(hour - this.hour) < 0.02) return;
    this.hour = hour;
    this.relight();
  }

  /** Het nieuwe licht en de lucht aan of uit, om te vergelijken in de browser: `__zoo.view.setLook(false)`. */
  setLook(on: boolean): void {
    this.fancy = on;
    useHaze(on);
    // een andere tone mapping laat Three.js alle shaders opnieuw maken, nu met (of zonder) het waas;
    // Linear met 1 is precies het oude beeld (alleen afkappen boven wit)
    this.renderer.toneMapping = on ? TONE.mapping : THREE.LinearToneMapping;
    this.renderer.toneMappingExposure = on ? TONE.exposure : 1;
    this.skyDome.visible = on;
    this.relight();
  }

  /** Het licht van nu: het uur, de nacht en de regen samen. Bij regen is de zon wat zwakker en de lucht grijzer. */
  private relight(): void {
    const dark = this.dark, wet = this.wet;
    const look = this.fancy ? dayLook(this.hour, this.skyDay.getHex(), seasonNow, this.look) : null;
    const horizon = this.scene.background as THREE.Color;
    // 's nachts blijft er maar weinig licht over: wat niet bij een lamp staat, is echt donker
    this.sun.intensity = 2.2 * (look ? look.sunK : 1) * (1 - 0.8 * dark) * (1 - 0.3 * wet);
    this.hemi.intensity = 1.6 * (look ? look.hemiK : 1) * (1 - 0.6 * dark) * (1 - 0.12 * wet);
    if (look) {
      this.sun.color.setRGB(look.sun[0], look.sun[1], look.sun[2], THREE.SRGBColorSpace);
      this.hemi.color.setRGB(look.hemi[0], look.hemi[1], look.hemi[2], THREE.SRGBColorSpace);
      horizon.setRGB(look.horizon[0], look.horizon[1], look.horizon[2], THREE.SRGBColorSpace);
      this.skyTop.setRGB(look.top[0], look.top[1], look.top[2], THREE.SRGBColorSpace).lerp(RAIN_TOP, 0.65 * wet).lerp(NIGHT_TOP, dark);
    } else {
      this.sun.color.setHex(0xfff4dd);
      this.hemi.color.setHex(0xffffff);
      horizon.copy(this.skyDay);
    }
    horizon.lerp(RAIN_SKY, 0.65 * wet).lerp(NIGHT_SKY, dark);
    this.skyCloud.copy(WHITE).lerp(horizon, CLOUD_TINT).lerp(NIGHT_CLOUD, dark);
    this.skyDome.setColors(this.skyTop, horizon, this.skyCloud);
    LAMP_MAT.emissiveIntensity = 0.6 + 1.8 * dark;
  }

  /**
   * Het seizoen: de zomer is het gewone beeld. In de lente is het groen frisser en bloeien sommige bomen, in de
   * herfst kleurt het blad oranje, geel en roodbruin en wordt het gras geel, in de winter is alles berijpt en wit.
   */
  setSeason(season: Season): void {
    if (season === seasonNow) return;
    seasonNow = season;
    this.applySeason(true);
    // het licht kleurt een heel klein beetje mee (zie SEASON_TINT in daylight.ts)
    this.relight();
  }

  /** Kleurt alles wat met het seizoen meegaat: het blad van bomen en struiken, de grond rond het park en de tegels. */
  private applySeason(tiles: boolean): void {
    const season = seasonNow;
    this.leafMats.forEach((m, i) => leafColor(m.color, this.worldLeaves[i], season, i));
    groundColor(this.outerMat.color.setHex(this.worldGround), season);
    SEASON_LEAVES.forEach((l, i) => leafColor(l.mat.color, l.summer, season, i, l.pink));
    BLOSSOM_MAT.visible = season === 'spring';
    CABLE_SNOW_MAT.visible = season === 'winter';
    if (tiles && this.grid) this.paintTerrain(this.grid);
  }

  /**
   * Tekent de nacht: een donkerblauw vlak over het hele beeld, met een zacht rond gat bij elk licht (een
   * lantaarn, een kampvuur, een winkel, de ingang). Zo zie je alleen goed wat verlicht is.
   */
  drawNight(dark: number, lights: ParkLight[]): void {
    const c = this.nightCanvas;
    if (dark <= 0.01) {
      if (c.style.display !== 'none') c.style.display = 'none';
      return;
    }
    if (c.style.display === 'none') c.style.display = 'block';
    // op halve grootte: scheelt werk en het licht mag zacht zijn
    const k = 0.5, w = Math.ceil(innerWidth * k), h = Math.ceil(innerHeight * k);
    if (c.width !== w || c.height !== h) {
      c.width = w;
      c.height = h;
    }
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'copy';
    // zonder lampen is het bijna zwart: alleen bij een lantaarn, een kampvuur, een winkel of de ingang zie je iets
    // van dichtbij (de loopstand) is de nacht iets minder donker: dan zie je nog waar je loopt
    ctx.fillStyle = `rgba(6, 9, 30, ${0.95 * dark * (1 - (1 - WALK.night) * this.walkK)})`;
    ctx.fillRect(0, 0, w, h);
    const spots = lights
      .map(l => ({ s: this.project(l.gx, l.gy, l.h ?? 0.3, false), r: l.r * this.pxPerTile(l.gx, l.gy, l.h ?? 0.3) * k * 1.25, high: !!l.h }))
      .filter(p => p.s.x > -p.r / k && p.s.x < innerWidth + p.r / k && p.s.y > -p.r / k && p.s.y < innerHeight + p.r / k);
    // een cirkel op de grond is op het scherm een platte ovaal; van dichtbij is het licht meer een bol om de lamp.
    // Een licht hoog in de lucht (het reuzenrad) is altijd een ronde gloed
    const flat = 0.62 + (0.8 - 0.62) * this.walkK;
    for (const pass of ['destination-out', 'source-over'] as const) {
      ctx.globalCompositeOperation = pass;
      for (const [i, { s, r, high }] of spots.entries()) {
        ctx.setTransform(1, 0, 0, high ? 1 : flat, s.x * k, s.y * k);
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
        if (pass === 'destination-out') {
          g.addColorStop(0, 'rgba(0,0,0,1)');
          g.addColorStop(0.55, 'rgba(0,0,0,0.9)');
          g.addColorStop(1, 'rgba(0,0,0,0)');
        } else if (this.partyT !== null) {
          // feest: elk licht gloeit in een eigen kleur, en die kleuren schuiven langzaam op
          const hue = partyHue(this.partyT, i);
          g.addColorStop(0, `hsla(${hue}, 95%, 62%, ${0.3 * dark})`);
          g.addColorStop(0.9, `hsla(${hue}, 95%, 62%, 0)`);
        } else {
          // een warme gloed in het licht
          g.addColorStop(0, `rgba(255, 196, 96, ${0.16 * dark})`);
          g.addColorStop(0.9, 'rgba(255, 196, 96, 0)');
        }
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  resize(): void {
    const w = innerWidth, h = innerHeight, a = w / h;
    this.camera.left = (-this.zoom * a) / 2;
    this.camera.right = (this.zoom * a) / 2;
    this.camera.top = this.zoom / 2;
    this.camera.bottom = -this.zoom / 2;
    // de camera staat schuin boven het park; bij elke kwartslag een hoek verder
    const phi = this.angle + Math.PI / 4, far = 30 * SQRT2;
    this.camera.position.copy(this.target).add(this.tmp.set(Math.sin(phi) * far, 30, Math.cos(phi) * far));
    this.camera.lookAt(this.target);
    this.camera.updateProjectionMatrix();
    this.eyeCam.aspect = a;
    this.eyeCam.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  // ------------------------------------------------------------ de loopstand
  /** Naar beneden vliegen en rondlopen (true), of weer omhoog naar het gewone beeld (false). */
  setWalk(on: boolean): void {
    this.walkWant = on ? 1 : 0;
    this.fly = null;
  }

  /** Is de camera (een beetje) beneden? Dan kijk je door de ogen van de loper. */
  get walking(): boolean {
    return this.walkK > 0;
  }

  /** Helemaal beneden aangekomen. */
  get walkDown(): boolean {
    return this.walkK >= 1;
  }

  /** Waar de loper is en waar hij naar kijkt (rastercoördinaten, hoogte in tegels, richting in radialen). */
  setEye(gx: number, gy: number, h: number, yaw: number, pitch: number): void {
    Object.assign(this.eyeAt, { gx, gy, h, yaw, pitch });
  }

  /** Het midden van het beeld van boven, op het raster. */
  center(): [number, number] {
    return [this.target.x + W / 2, this.target.z + H / 2];
  }

  /** De kant waar je van boven naar kijkt, als richting op het raster (zoals in walk.ts: 0 is naar het zuiden). */
  get viewYaw(): number {
    return this.angle + Math.PI / 4 + Math.PI;
  }

  /** De camera die nu tekent. */
  private get eye(): THREE.Camera {
    return this.walkK > 0 ? this.eyeCam : this.camera;
  }

  /**
   * Zet de loopcamera neer. Van boven begint hij precies waar het gewone beeld is (zo ver weg dat er net zoveel in
   * beeld past), beneden staat hij op de ogen van de loper; daartussen gaat hij er zacht naartoe.
   */
  private placeEye(dt: number): void {
    const was = this.walkK;
    if (this.walkK !== this.walkWant) {
      const step = dt / WALK.fly;
      this.walkK = this.walkWant > this.walkK ? Math.min(1, this.walkK + step) : Math.max(0, this.walkK - step);
    }
    const fog = this.scene.fog as THREE.Fog;
    fog.color.copy(this.scene.background as THREE.Color);
    if (this.walkK <= 0) {
      if (was > 0) {
        fog.near = 900;
        fog.far = 1000;
        this.resize();
      }
      return;
    }
    const k = this.walkK, e = k * k * (3 - 2 * k);
    // van boven: dezelfde kant op als het gewone beeld
    const phi = this.angle + Math.PI / 4, far = 30 * SQRT2;
    const back = this.zoom / (2 * Math.tan(THREE.MathUtils.degToRad(WALK.fov) / 2));
    this.eyeFrom.set(Math.sin(phi) * far, 30, Math.cos(phi) * far).normalize().multiplyScalar(back).add(this.target);
    // beneden: op de ogen van de loper
    const { gx, gy, h, yaw, pitch } = this.eyeAt;
    const ex = toWorldX(gx), ez = toWorldZ(gy), cp = Math.cos(pitch);
    const cam = this.eyeCam;
    cam.position.lerpVectors(this.eyeFrom, this.tmp.set(ex, h, ez), e);
    this.eyeLook.copy(this.target).lerp(this.tmp.set(ex + Math.sin(yaw) * cp * 3, h + Math.sin(pitch) * 3, ez + Math.cos(yaw) * cp * 3), e);
    cam.lookAt(this.eyeLook);
    cam.updateMatrixWorld();
    // hoog boven het park mag het voorste vlak verder weg liggen: dan flikkert de grond niet
    const near = 0.05 + (1 - e) * 0.5;
    if (Math.abs(cam.near - near) > 1e-4) {
      cam.near = near;
      cam.updateProjectionMatrix();
    }
    fog.near = 900 + (WALK.fogNear - 900) * e;
    fog.far = 1000 + (WALK.fogFar - 1000) * e;
  }

  /** Laat ringen zien op deze plekken; `hot` is feller en `r` maakt de ring groter. `pulse` laat ze ademen. */
  private brownMat = new THREE.MeshBasicMaterial({ color: 0x8a5a2e, transparent: true, opacity: 0.8, depthWrite: false });

  // een dunne, zachte ring die precies `r` tegels groot is: zo ver reikt een wegwijzer of plattegrond
  private softGeo = new THREE.RingGeometry(0.965, 1, 72).rotateX(-Math.PI / 2);
  private softMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false });
  private softHotMat = new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.8, depthWrite: false });

  /** `brown`: een bruine ring (om een poepje, zodat je het goed ziet liggen). `soft`: een dunne ring van `r` tegels groot. */
  showMarks(spots: { gx: number; gy: number; r?: number; hot?: boolean; brown?: boolean; soft?: boolean }[], pulse: number): void {
    while (this.marks.length < spots.length) {
      const m = new THREE.Mesh(this.markGeo, this.markMat);
      m.renderOrder = 2;
      this.scene.add(m);
      this.marks.push(m);
    }
    this.marks.forEach((m, i) => {
      const s = spots[i];
      m.visible = !!s;
      if (!s) return;
      m.geometry = s.soft ? this.softGeo : this.markGeo;
      m.material = s.soft ? (s.hot ? this.softHotMat : this.softMat) : s.hot ? this.hotMat : s.brown ? this.brownMat : this.markMat;
      m.position.set(toWorldX(s.gx), 0.03, toWorldZ(s.gy));
      const k = (s.r ?? 1) * (s.soft ? 1 : 1 + 0.12 * Math.sin(pulse + i));
      m.scale.set(k, 1, k);
    });
  }

  /** Een paar druppels die opspatten uit het water op deze plek. */
  splash(gx: number, gy: number): void {
    if (this.drops.length > 60) return;
    for (let i = 0; i < 4; i++) {
      const mesh = new THREE.Mesh(this.dropGeo, this.dropMat);
      mesh.position.set(toWorldX(gx) + (Math.random() - 0.5) * 0.3, 0.05, toWorldZ(gy) + (Math.random() - 0.5) * 0.3);
      this.scene.add(mesh);
      this.drops.push({ mesh, vx: (Math.random() - 0.5) * 0.9, vy: 1.3 + Math.random() * 0.9, vz: (Math.random() - 0.5) * 0.9, life: 0.6 });
    }
  }

  /**
   * Een sterk dier duwt een houten hek om: de planken kantelen naar buiten (`out`: 1 naar hoger x of y, -1 naar
   * lager), stuiteren even op de grond en verdwijnen dan langzaam. Wat er blijft staan, is het kapotte hek.
   */
  topple(e: Edge, out: 1 | -1): void {
    const mat = (WORN_MATS[0] as THREE.MeshStandardMaterial).clone();
    mat.transparent = true;
    const plank = new THREE.Mesh(FALL_GEO, mat);
    plank.castShadow = true;
    const obj = new THREE.Group().add(plank);
    this.placeEdge(obj, e);
    this.scene.add(obj);
    // bij een staand hek ('v') wijst de eigen z-as de andere kant op
    this.falls.push({ obj, plank, mat, tip: e.o === 'h' ? out : -out, t: 0 });
  }

  /** Een paar gekleurde spetters die vanaf hoogte `height` opspringen en weer vallen (confetti, kruimels, vonken). */
  burst(gx: number, gy: number, height: number, color: number, n = 6): void {
    if (this.drops.length > 90) return;
    let mat = this.burstMats.get(color);
    if (!mat) {
      mat = new THREE.MeshBasicMaterial({ color });
      this.burstMats.set(color, mat);
    }
    for (let i = 0; i < n; i++) {
      const mesh = new THREE.Mesh(this.dropGeo, mat);
      mesh.position.set(toWorldX(gx) + (Math.random() - 0.5) * 0.25, height, toWorldZ(gy) + (Math.random() - 0.5) * 0.25);
      this.scene.add(mesh);
      this.drops.push({ mesh, vx: (Math.random() - 0.5) * 1.3, vy: 1.2 + Math.random() * 1.1, vz: (Math.random() - 0.5) * 1.3, life: 0.8 });
    }
  }

  /**
   * Een regenplas op de grond. Hij heeft een eigen materiaal: wie hem maakt laat `opacity` zakken en haalt hem
   * daarna zelf uit `scene`.
   */
  makeWetPuddle(gx: number, gy: number, r = 0.3): THREE.Mesh {
    const mesh = new THREE.Mesh(PUDDLE_GEO, new THREE.MeshStandardMaterial({ color: 0x7f9fb8, roughness: 0.15, transparent: true, opacity: 0.7, depthWrite: false }));
    mesh.position.set(toWorldX(gx), 0.007, toWorldZ(gy));
    mesh.scale.set(r, 1, r * (0.65 + hash(gx, gy) * 0.3));
    mesh.rotation.y = hash(gx, gy, 1) * Math.PI;
    mesh.renderOrder = 1;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    return mesh;
  }

  /**
   * Het weer: deeltjes die rond het midden van het beeld vallen. `rain` = dunne schuine strepen, `snow` = trage
   * witte vlokken, `leaves` = een paar dwarrelende herfstbladeren, `petals` = roze bloesem. `amount` (0 tot 1)
   * is hoeveel; bij 'clear' of 0 valt er niets. Bij regen wordt het licht wat zwakker en de lucht grijzer.
   */
  setWeather(sky: Sky, amount: number): void {
    amount = Math.max(0, Math.min(1, amount));
    if (amount <= 0) sky = 'clear';
    const wet = sky === 'rain' ? amount : 0;
    if (wet !== this.wet) {
      this.wet = wet;
      this.relight();
    }
    if (sky === 'clear') {
      this.sky = sky;
      if (this.weather) this.weather.visible = false;
      return;
    }
    if (!this.weather) {
      const mat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.8, depthWrite: false });
      this.weather = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat, WEATHER_MAX);
      this.weather.frustumCulled = false;
      this.weather.renderOrder = 6;
      for (let i = 0; i < this.flakes.length; i++) this.flakes[i] = Math.random();
      this.scene.add(this.weather);
    }
    if (sky !== this.sky) {
      this.sky = sky;
      const tints = WEATHER_TINTS[sky];
      for (let i = 0; i < WEATHER_MAX; i++) this.weather.setColorAt(i, MIX.setHex(tints[i % tints.length]));
      this.weather.instanceColor!.needsUpdate = true;
      (this.weather.material as THREE.MeshBasicMaterial).opacity = sky === 'rain' ? 0.5 : 0.92;
    }
    this.weather.visible = true;
    this.weather.count = Math.max(1, Math.round(WEATHER_COUNT[sky] * amount * (this.quality < 2 ? 0.5 : 1)));
  }

  /** Laat de deeltjes van het weer vallen; de doos waarin ze vallen schuift met het beeld mee. */
  private stepWeather(dt: number): void {
    const mesh = this.weather;
    if (!mesh || !mesh.visible) return;
    this.weatherClock += dt;
    const f = this.flakes, sky = this.sky, t = this.weatherClock;
    // de doos is zo groot als wat er in beeld is
    // in de loopstand valt het om de loper heen
    const walk = this.walkK >= 0.5;
    const size = walk ? 22 : Math.max(20, Math.min(52, this.zoom * 2.6));
    const cx = walk ? toWorldX(this.eyeAt.gx) : this.target.x, cz = walk ? toWorldZ(this.eyeAt.gy) : this.target.z;
    const x0 = cx - size / 2, z0 = cz - size / 2;
    const m = this.wm, q = this.wq, p = this.wp, s = this.ws;
    if (sky === 'rain') {
      q.setFromEuler(this.we.set(0.07, 0, 0.16));
      s.set(0.014, 0.4, 0.014);
    } else if (sky === 'snow') q.identity();
    for (let i = 0; i < mesh.count; i++) {
      const k = i * 4, own = f[k + 3], a = t + own * 40;
      if (sky === 'rain') {
        f[k + 1] -= (dt * (10 + own * 3)) / WEATHER_TOP;
        f[k] += (dt * 1.7) / size;
        f[k + 2] -= (dt * 0.7) / size;
      } else if (sky === 'snow') {
        f[k + 1] -= (dt * (0.7 + own * 0.5)) / WEATHER_TOP;
        f[k] += (dt * Math.sin(a * 0.9) * 0.5) / size;
        f[k + 2] += (dt * Math.cos(a * 0.7) * 0.4) / size;
        s.setScalar(0.04 + own * 0.035);
      } else {
        // bladeren en bloesem dwarrelen: ze tollen en zwenken
        f[k + 1] -= (dt * (sky === 'leaves' ? 1.1 + own * 0.6 : 0.6 + own * 0.4)) / WEATHER_TOP;
        f[k] += (dt * (0.6 + Math.sin(a * 1.3) * 0.9)) / size;
        f[k + 2] += (dt * Math.cos(a * 1.1) * 0.7) / size;
        q.setFromEuler(this.we.set(a * 2.1, a * 1.3, a * 1.7));
        if (sky === 'leaves') s.set(0.1, 0.012, 0.07);
        else s.set(0.065, 0.01, 0.05);
      }
      if (f[k + 1] < 0) {
        // beneden: opnieuw van boven, op een andere plek
        f[k + 1] += 1;
        f[k] = Math.random();
        f[k + 2] = Math.random();
      }
      // de plek in de wereld, rondgevouwen in de doos om het midden van het beeld
      const wx = f[k] * size - x0, wz = f[k + 2] * size - z0;
      p.set(x0 + wx - Math.floor(wx / size) * size, f[k + 1] * WEATHER_TOP, z0 + wz - Math.floor(wz / size) * size);
      mesh.setMatrixAt(i, m.compose(p, q, s));
    }
    mesh.instanceMatrix.needsUpdate = true;
  }

  /**
   * Een grote regenboog achter wat je ziet (aan de kant van -x en -z, van de camera af). `amount` is hoe goed
   * je hem ziet; bij 0 is hij weg. Hij schuift met het beeld mee, zodat je hem altijd kunt zien.
   */
  showRainbow(amount: number): void {
    if (!this.rainbow) {
      if (amount <= 0) return;
      const geo = mergeGeometries(RAINBOW.map((hex, i) => paint(new THREE.RingGeometry(5.2 - (i + 1) * 0.28, 5.2 - i * 0.28, 48, 1, 0, Math.PI), hex)))!;
      this.rainbow = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
      this.rainbow.rotation.y = Math.PI / 4;
      this.rainbow.renderOrder = 4;
      this.rainbow.frustumCulled = false;
      this.scene.add(this.rainbow);
    }
    this.rainbow.visible = amount > 0.005;
    (this.rainbow.material as THREE.MeshBasicMaterial).opacity = Math.min(1, amount) * 0.55;
    this.placeRainbow();
  }

  /**
   * De regenboog staat een stuk achter het midden van het beeld en loopt van de linkerrand tot de rechterrand van het
   * scherm, hoe ver je ook bent in- of uitgezoomd. Op een breed scherm wordt hij niet hoger dan het beeld: dan is het
   * een platte boog.
   */
  private placeRainbow(): void {
    const bow = this.rainbow;
    if (!bow || !bow.visible) return;
    if (this.walkK >= 0.5) {
      // in de loopstand: ver voor je, boven de bomen uit
      const { gx, gy, yaw } = this.eyeAt;
      bow.scale.setScalar(2.6);
      bow.rotation.y = yaw;
      bow.position.set(toWorldX(gx) + Math.sin(yaw) * 34, -2, toWorldZ(gy) + Math.cos(yaw) * 34);
      return;
    }
    // de boog is 10,4 breed; het beeld is zoom keer de verhouding breed
    const wide = (this.zoom * (innerWidth / innerHeight) * 1.04) / 10.4, tall = Math.min(wide, (this.zoom * 0.62) / (5.2 * 0.816));
    bow.scale.set(wide, tall, wide);
    // altijd achter het midden van het beeld, ook als het gedraaid is
    const phi = this.angle + Math.PI / 4, back = 1.2 * SQRT2 * tall;
    bow.rotation.y = phi;
    bow.position.set(this.target.x - Math.sin(phi) * back, -0.4 * tall, this.target.z - Math.cos(phi) * back);
  }

  /**
   * Waar de speler naar kijkt, voor het geluid: het midden van het beeld (in tegels), hoeveel tegels er verticaal in
   * beeld zijn, en welke kant op het raster op het scherm naar rechts wijst.
   */
  hearing(): [x: number, y: number, zoom: number, rx: number, ry: number] {
    // in de loopstand: je hoort wat om je heen is, en rechts is rechts van waar je naar kijkt
    if (this.walkK >= 0.5) return [this.eyeAt.gx, this.eyeAt.gy, WALK.hear, -Math.cos(this.eyeAt.yaw), Math.sin(this.eyeAt.yaw)];
    const phi = this.angle + Math.PI / 4;
    return [this.target.x + W / 2, this.target.z + H / 2, this.zoom, Math.cos(phi), -Math.sin(phi)];
  }

  /** Schuif het beeld rustig naar deze plek op het raster. */
  flyTo(gx: number, gy: number): void {
    this.fly = { x: toWorldX(gx), z: toWorldZ(gy) };
  }

  /** Schuif het beeld: de grond volgt de vinger. */
  pan(dxPx: number, dyPx: number): void {
    this.fly = null;
    const upp = this.zoom / innerHeight;
    // naar rechts en naar beneden op het scherm, omgerekend naar de grond (het beeld kan gedraaid zijn)
    const phi = this.angle + Math.PI / 4, sin = Math.sin(phi), cos = Math.cos(phi);
    this.target.x += -dxPx * upp * cos - dyPx * upp * SQRT3 * sin;
    this.target.z += dxPx * upp * sin - dyPx * upp * SQRT3 * cos;
    const lim = W / 2 + 2;
    this.target.x = Math.max(-lim, Math.min(lim, this.target.x));
    this.target.z = Math.max(-lim, Math.min(lim, this.target.z));
    this.resize();
  }

  /** Draai het beeld een kwartslag: 1 = naar rechts, -1 = naar links. */
  rotate(dir: 1 | -1): void {
    this.turn += dir;
  }

  zoomBy(factor: number): void {
    this.zoom = Math.max(5, Math.min(42, this.zoom * factor));
    this.resize();
  }

  /** Schermpunt naar rastercoördinaten op de grond. */
  groundPoint(clientX: number, clientY: number): { gx: number; gy: number } | null {
    const ndc = new THREE.Vector2((clientX / innerWidth) * 2 - 1, -(clientY / innerHeight) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.eye);
    const hit = this.raycaster.ray.intersectPlane(this.plane, this.tmp);
    return hit ? { gx: hit.x + W / 2, gy: hit.z + H / 2 } : null;
  }

  /** Rasterpunt (met hoogte) naar schermpixels. */
  toScreen(gx: number, gy: number, height = 0): { x: number; y: number } {
    return this.project(gx, gy, height, true);
  }

  /**
   * Rasterpunt naar schermpixels. In de loopstand ligt wat achter je ver buiten beeld, en met `near` ook wat heel
   * ver weg is: dan staat de horizon niet vol wolkjes.
   */
  private project(gx: number, gy: number, height: number, near: boolean): { x: number; y: number } {
    if (this.walkK > 0) {
      const cam = this.eyeCam;
      this.tmp.set(toWorldX(gx), height, toWorldZ(gy)).applyMatrix4(cam.matrixWorldInverse);
      const tooFar = near && this.walkK > 0.5 && Math.hypot(gx - this.eyeAt.gx, gy - this.eyeAt.gy) > WALK.tagRange;
      if (this.tmp.z > -cam.near || tooFar) return { x: -9999, y: -9999 };
      this.tmp.applyMatrix4(cam.projectionMatrix);
    } else this.tmp.set(toWorldX(gx), height, toWorldZ(gy)).project(this.camera);
    return { x: ((this.tmp.x + 1) / 2) * innerWidth, y: ((1 - this.tmp.y) / 2) * innerHeight };
  }

  /** Hoeveel pixels een tegel op deze plek groot is op het scherm (van dichtbij groter dan ver weg). */
  private pxPerTile(gx: number, gy: number, height: number): number {
    if (this.walkK <= 0) return innerHeight / this.zoom;
    const d = Math.max(0.4, this.eyeCam.position.distanceTo(this.tmp.set(toWorldX(gx), height, toWorldZ(gy))));
    return innerHeight / (2 * Math.tan(THREE.MathUtils.degToRad(this.eyeCam.fov) / 2) * d);
  }

  /**
   * Geeft elke tegel het plaatje van zijn ondergrond: gras, bos, wei en steppe kleuren mee met het seizoen (zie
   * ground.ts). Op een brug komen planken met een leuning en langs een bloemenpad een rand met bloemetjes; die
   * worden alleen opnieuw gebouwd als er zo'n tegel bij is gekomen of weg is.
   */
  paintTerrain(grid: Grid): void {
    this.grid = grid;
    this.ground.paint(grid.terrain, seasonNow);
    const bridges: number[] = [], flowers: number[] = [];
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const kind = TERRAINS[grid.terrain[x + y * W]];
        // onthoud de tegel en zijn richting: langs y als daar het pad verder loopt, anders langs x
        if (kind === 'bridge') bridges.push((x + y * W) * 2 + (this.pathAlongY(grid, x, y) ? 1 : 0));
        else if (kind === 'flowerpath') flowers.push((x + y * W) * 2 + (this.pathAlongY(grid, x, y) ? 1 : 0));
      }
    const key = `${bridges.join(',')};${flowers.join(',')}`;
    if (key === this.pathKey) return;
    this.pathKey = key;
    this.buildPathExtras(bridges, flowers);
  }

  /** Loopt het pad hier van noord naar zuid? Alleen als daar een pad aansluit en links en rechts niet. */
  private pathAlongY(grid: Grid, x: number, y: number): boolean {
    const path = (nx: number, ny: number): boolean => nx >= 0 && nx < W && ny >= 0 && ny < H && isPath(grid.terrain[nx + ny * W]);
    return (path(x, y - 1) || path(x, y + 1)) && !(path(x - 1, y) || path(x + 1, y));
  }

  /** De planken op de bruggen en de bloemenranden langs de bloemenpaden, voor alle tegels samen. */
  private buildPathExtras(bridges: number[], flowers: number[]): void {
    for (const mesh of this.pathExtras) {
      this.scene.remove(mesh);
      mesh.dispose();
    }
    this.pathExtras = [];
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), at = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), c = new THREE.Color();
    const pose = (code: number): number => {
      const [x, y] = tileXY(code >> 1);
      at.set(toWorldX(x + 0.5), 0, toWorldZ(y + 0.5));
      q.setFromAxisAngle(UP, code & 1 ? Math.PI / 2 : 0);
      return x * 7 + y * 13;
    };
    if (bridges.length) {
      const deck = new THREE.InstancedMesh(BRIDGE_GEO, PAINT_MAT, bridges.length);
      bridges.forEach((code, i) => {
        pose(code);
        deck.setMatrixAt(i, m.compose(at, q, one));
      });
      deck.castShadow = true;
      deck.receiveShadow = true;
      this.pathExtras.push(deck);
    }
    if (flowers.length) {
      // per tegel twee groene randen met elk drie bloemetjes
      const edges = new THREE.InstancedMesh(FLOWER_EDGE_GEO, FLOWER_EDGE_MAT, flowers.length * 2);
      const heads = new THREE.InstancedMesh(FLOWER_HEAD_GEO, WHITE_MAT, flowers.length * 6);
      const off = new THREE.Vector3(), spot = new THREE.Vector3();
      flowers.forEach((code, i) => {
        const seed = pose(code);
        for (let side = 0; side < 2; side++) {
          off.set(0, 0, side ? 0.445 : -0.445).applyQuaternion(q);
          edges.setMatrixAt(i * 2 + side, m.compose(spot.copy(at).add(off), q, one));
          for (let k = 0; k < 3; k++) {
            const n = i * 6 + side * 3 + k, r = hash(seed, n);
            off.set(-0.32 + k * 0.32 + (r - 0.5) * 0.14, 0, (side ? 0.445 : -0.445) + (hash(n, seed) - 0.5) * 0.04).applyQuaternion(q);
            heads.setMatrixAt(n, m.compose(spot.copy(at).add(off), q, one));
            heads.setColorAt(n, c.setHex(PATH_FLOWERS[Math.floor(r * 97) % PATH_FLOWERS.length]));
          }
        }
      });
      edges.receiveShadow = true;
      heads.castShadow = true;
      this.pathExtras.push(edges, heads);
    }
    for (const mesh of this.pathExtras) {
      mesh.frustumCulled = false;
      this.scene.add(mesh);
    }
  }

  private placeEdge(mesh: THREE.Object3D, e: Edge): void {
    mesh.position.set(toWorldX(e.x), 0, toWorldZ(e.y));
    mesh.rotation.y = e.o === 'v' ? -Math.PI / 2 : 0;
  }

  /** Een poort heeft de kleur van het hek waar hij in zit: hout, steen of net. */
  private gateStyle(grid: Grid, e: Edge): number {
    const beside: Edge[] = e.o === 'h' ? [{ o: 'h', x: e.x - 1, y: e.y }, { o: 'h', x: e.x + 1, y: e.y }] : [{ o: 'v', x: e.x, y: e.y - 1 }, { o: 'v', x: e.x, y: e.y + 1 }];
    const around: Edge[] = e.o === 'h'
      ? [{ o: 'v', x: e.x, y: e.y - 1 }, { o: 'v', x: e.x, y: e.y }, { o: 'v', x: e.x + 1, y: e.y - 1 }, { o: 'v', x: e.x + 1, y: e.y }]
      : [{ o: 'h', x: e.x - 1, y: e.y }, { o: 'h', x: e.x, y: e.y }, { o: 'h', x: e.x - 1, y: e.y + 1 }, { o: 'h', x: e.x, y: e.y + 1 }];
    const kinds = [...beside, ...around].map(n => grid.getEdge(n));
    return kinds.includes(3) ? 3 : kinds.includes(4) ? 4 : kinds.includes(5) ? 5 : kinds.includes(7) ? 7 : 1;
  }

  /** Een hek in een eigen kleur; versleten hout wordt per fase donkerder. */
  private tintMats = new Map<string, THREE.Material>();
  private tintMat(style: number, tint: number, worn: number): THREE.Material {
    const key = `${style}:${tint}:${worn}`;
    let mat = this.tintMats.get(key);
    if (!mat) {
      const color = new THREE.Color((FENCE_COLORS as Record<number, number[]>)[style]?.[tint] ?? 0xffffff).multiplyScalar([1, 0.86, 0.7, 0.54][worn]);
      mat = new THREE.MeshStandardMaterial({ color, roughness: style === 4 ? 0.7 : 0.95 });
      this.tintMats.set(key, mat);
    }
    return mat;
  }

  /** `wear`: per rand hoe versleten het houten hek is (1, 2 of 3). `tints`: per rand de gekozen kleur (zie FENCE_COLORS). */
  syncFences(grid: Grid, wear?: Map<string, number>, tints?: Map<string, number>): void {
    const wanted = new Map<string, { e: Edge; kind: number; style: number; worn: number; tint: number }>();
    for (const item of grid.edges()) {
      // een kijkvenster is van steen, het poortje van de kinderboerderij hoort bij het witte hekje
      const style = item.kind === 2 ? this.gateStyle(grid, item.e) : item.kind === 6 ? 3 : item.kind === 8 ? 7 : item.kind;
      const worn = item.kind === 1 ? wear?.get(edgeKey(item.e)) ?? 0 : 0;
      const tint = tints?.get(edgeKey(item.e)) ?? 0;
      wanted.set(`${edgeKey(item.e)}:${item.kind}:${style}:${worn}:${tint}`, { ...item, style, worn, tint });
    }
    for (const [key, mesh] of this.fences)
      if (!wanted.has(key)) {
        this.scene.remove(mesh);
        this.fences.delete(key);
      }
    for (const [key, { e, kind, style, worn, tint }] of wanted) {
      if (this.fences.has(key)) continue;
      const geo = kind === 8 ? PETGATE_GEO : kind === 7 ? PICKET_GEO : kind === 6 ? WINDOW_GEO : kind === 5 ? GLASS_FRAME_GEO : kind === 4 ? NET_GEO : kind === 3 ? WALL_GEO : kind === 2 ? GATE_GEO : WORN_GEOS[worn];
      const frame = new THREE.Mesh(geo, tint ? this.tintMat(style, tint, worn) : style === 5 ? GLASS_FRAME_MAT : style === 3 ? STONE_MAT : style === 4 ? NET_MAT : style === 7 ? WHITE_MAT : WORN_MATS[worn]);
      frame.castShadow = true;
      let mesh: THREE.Object3D = frame;
      if (kind === 5 || kind === 6) {
        // glas en kijkvenster: de lijst met een doorzichtige ruit erin
        const pane = new THREE.Mesh(kind === 5 ? GLASS_PANE_GEO : WINDOW_PANE_GEO, GLASS_MAT);
        pane.renderOrder = 3;
        mesh = new THREE.Group().add(frame, pane);
      } else if (kind === 8) {
        // het poortje van de kinderboerderij: het bord met het hart houdt zijn eigen kleuren
        const sign = new THREE.Mesh(PETSIGN_GEO, PAINT_MAT);
        sign.castShadow = true;
        mesh = new THREE.Group().add(frame, sign);
      }
      this.placeEdge(mesh, e);
      this.scene.add(mesh);
      this.fences.set(key, mesh);
    }
  }

  /**
   * Het water in de bakken van glas: op elke watertegel in zo'n bak staat een doorzichtig blok water, zodat
   * je de dieren erin ziet zwemmen. `tiles`: de tegels (x, y) waar water in een glazen bak ligt.
   */
  syncTanks(tiles: [number, number][], height: number, murk: number[] = []): void {
    const key = tiles.map(t => t.join(',')).join(';');
    if (key !== this.tankKey) {
      this.tankKey = key;
      if (this.tank) {
        this.scene.remove(this.tank);
        this.tank.dispose();
        this.tank = null;
      }
      if (this.specks) {
        this.scene.remove(this.specks);
        this.specks.dispose();
        this.specks = null;
      }
      if (!tiles.length) return;
      this.tank = new THREE.InstancedMesh(new THREE.BoxGeometry(1, height, 1).translate(0, height / 2 + 0.005, 0), TANK_MAT, tiles.length);
      const m = new THREE.Matrix4();
      tiles.forEach(([x, y], i) => this.tank!.setMatrixAt(i, m.makeTranslation(toWorldX(x + 0.5), 0, toWorldZ(y + 0.5))));
      this.tank.renderOrder = 2;
      this.tank.frustumCulled = false;
      this.scene.add(this.tank);
      // de vuiltjes: elke tegel heeft er een paar op een vaste plek, zodat ze niet verspringen als het water viezer wordt
      this.specks = new THREE.InstancedMesh(SPECK_GEO, SPECK_MAT, tiles.length * SPECKS);
      this.specks.frustumCulled = false;
      this.specks.count = 0;
      this.speckAt = [];
      tiles.forEach(([x, y]) => {
        for (let k = 0; k < SPECKS; k++) {
          const r = (n: number): number => (Math.sin((x * 12.9898 + y * 78.233 + k * 37.719 + n * 4.13) * 43758.5453) % 1 + 1) % 1;
          this.speckAt.push([toWorldX(x + 0.15 + r(1) * 0.7), height * (0.25 + r(2) * 0.6), toWorldZ(y + 0.15 + r(3) * 0.7), r(4) * 6]);
        }
      });
      this.scene.add(this.specks);
    }
    if (!this.tank) return;
    // de kleur van het water op elke tegel, en zoveel vuiltjes als het vies is (pas vanaf een beetje troebel)
    const color = new THREE.Color();
    this.speckShown = [];
    tiles.forEach((_, i) => {
      const dirt = Math.max(0, Math.min(1, murk[i] ?? 0));
      this.tank!.setColorAt(i, color.copy(TANK_CLEAR).lerp(TANK_MURKY, dirt));
      const n = Math.min(SPECKS, Math.round(Math.max(0, dirt - 0.2) * 1.25 * SPECKS));
      for (let k = 0; k < n; k++) this.speckShown.push(i * SPECKS + k);
    });
    if (this.tank.instanceColor) this.tank.instanceColor.needsUpdate = true;
    if (this.specks) {
      this.specks.count = this.speckShown.length;
      this.placeSpecks();
    }
  }

  /** Welke vuiltjes er nu te zien zijn (hun plek in `speckAt`). */
  private speckShown: number[] = [];

  /** De vuiltjes zweven langzaam op en neer en draaien een beetje. */
  private placeSpecks(): void {
    if (!this.specks || !this.speckShown.length) return;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
    this.speckShown.forEach((at, i) => {
      const [x, h, zz, seed] = this.speckAt[at];
      const t = this.speckTime * 0.6 + seed;
      p.set(x + Math.sin(t * 0.7) * 0.04, h + Math.sin(t) * 0.035, zz + Math.cos(t * 0.5) * 0.04);
      q.setFromEuler(e.set(t, t * 0.7, 0));
      this.specks!.setMatrixAt(i, m.compose(p, q, one));
    });
    this.specks.instanceMatrix.needsUpdate = true;
  }

  // ------------------------------------------------------------ voerbak
  makeTrough(x: number, y: number, kind: TroughKind = 'wood', rot = 0): TroughMesh {
    const group = new THREE.Group();
    const food = new THREE.Group();
    if (kind === 'silo') {
      const parts = [new THREE.Mesh(SILO_GEO, SILO_MAT), new THREE.Mesh(SILO_ROOF_GEO, ROOF_MAT), new THREE.Mesh(SILO_TRAY_GEO, WOOD_MAT)];
      for (const m of parts) m.castShadow = true;
      shadeGroup(new THREE.Group().add(...parts));
      // het voer ligt in het bakje voor de toren
      food.position.set(0, -0.02, 0.26);
      food.scale.setScalar(0.75);
      group.add(...parts, food);
    } else {
      const box = new THREE.Mesh(TROUGH_GEO, kind === 'big' ? STONE_MAT : WOOD_MAT);
      const bottom = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.02, 0.36), DARK_MAT);
      bottom.position.y = 0.07;
      if (kind === 'big') {
        // de grote bak: van steen, breder, dieper en hoger
        box.scale.set(1.15, 1.4, 1.6);
        bottom.scale.set(1.15, 1, 1.6);
        bottom.position.y = 0.1;
        food.scale.set(1.12, 1.15, 1);
        food.position.y = 0.04;
      }
      group.add(box, bottom, food);
      box.castShadow = true;
    }
    group.position.set(toWorldX(x + 0.5), 0, toWorldZ(y + 0.5));
    group.rotation.y = (rot * Math.PI) / 2;
    this.scene.add(group);
    return { group, food, kind };
  }

  /**
   * Toont het voer in de bak: in de houten bak een stukje per portie, in de grote bak twee rijen, en in het
   * bakje van de silo een stukje per vier porties.
   */
  fillTrough(mesh: TroughMesh, food: FoodId | null, amount: number): void {
    mesh.food.clear();
    if (!food) return;
    const pieces = mesh.kind === 'silo' ? Math.ceil(amount / 4) : amount;
    for (let i = 0; i < pieces; i++) {
      const piece = foodPiece(food);
      piece.position.set(-0.255 + (i % 4) * 0.17, food === 'hay' ? 0.14 : 0.13, mesh.kind === 'big' ? (i < 4 ? -0.1 : 0.1) : 0);
      piece.rotation.y = food === 'veg' || food === 'meat' ? (i % 2 ? 0.25 : -0.25) : 0;
      piece.traverse(o => { o.castShadow = true; });
      mesh.food.add(piece);
    }
  }

  /**
   * Midden op tegel (x, y), `rot` kwartslagen gedraaid (0 = voorkant naar het zuiden, 1 = oosten, 2 = noorden,
   * 3 = westen). Eerst draaien en dan pas wiegen: zo blijft het wiegen van een ding hetzelfde, hoe het ook staat.
   */
  private at<T extends THREE.Object3D>(obj: T, x: number, y: number, rot = 0): T {
    obj.position.set(toWorldX(x + 0.5), 0, toWorldZ(y + 0.5));
    return this.turned(obj, rot);
  }

  private turned<T extends THREE.Object3D>(obj: T, rot: number): T {
    obj.rotation.order = 'YXZ';
    obj.rotation.y = obj.userData.turn = (rot * Math.PI) / 2;
    return obj;
  }

  makeBed(x: number, y: number, kind: BedKind, rot = 0): THREE.Group {
    const group = this.at(build(BED_PARTS[kind]), x, y, rot);
    shadeGroup(group);
    this.scene.add(group);
    return group;
  }

  ghostBed(x: number, y: number, kind: BedKind, ok: boolean, rot = 0): void {
    this.ghostMat.color.setHex(ok ? OK_COLOR : BAD_COLOR);
    this.at(this.ghostBeds[kind], x, y, rot).visible = true;
  }

  /** Op een rand ('h' = de noordrand van tegel (x, y), 'v' = de westrand) staat het ding midden op die rand. */
  private atSpot<T extends THREE.Object3D>(obj: T, x: number, y: number, edge?: 'h' | 'v', rot = 0, shift = 0): T {
    // `shift`: staat er een hek op die rand, dan schuift het ding een stukje op naar die kant (1 = zuid of oost,
    // -1 = noord of west), zodat het naast het hek staat en nog binnen de tegel valt
    obj.position.set(toWorldX(x + (edge === 'v' ? shift * EDGE_SHIFT : 0.5)), 0, toWorldZ(y + (edge === 'h' ? shift * EDGE_SHIFT : 0.5)));
    return this.turned(obj, rot);
  }

  /** Zet een versiering die er al staat op een andere plek (er is een hek bij gekomen of weggehaald). */
  poseDecor(group: THREE.Object3D, x: number, y: number, edge: 'h' | 'v' | undefined, shift: number): void {
    group.position.set(toWorldX(x + (edge === 'v' ? shift * EDGE_SHIFT : 0.5)), 0, toWorldZ(y + (edge === 'h' ? shift * EDGE_SHIFT : 0.5)));
  }

  makeDecor(x: number, y: number, kind: DecorKind, edge?: 'h' | 'v', rot = 0, shift = 0): THREE.Group {
    const group = this.atSpot(buildDecor(kind), x, y, edge, rot, shift);
    this.varyTree(group, x, y, kind);
    this.scene.add(group);
    return group;
  }

  /** Een sneeuwpop die een kind zelf heeft gebouwd: dezelfde als die uit de winkel, met een sjaal in deze kleur. */
  snowmanModel(scarf: number): THREE.Group {
    const group = buildDecor('snowman');
    (group.children[3] as THREE.Mesh).material = std(scarf);
    this.scene.add(group);
    return group;
  }

  /**
   * Een lamp aan, uit of in een kleur van het lichtfeestje. Onderdeel 1 van elke lamp is het licht zelf (zie
   * buildDecor); het eigen materiaal wordt bewaard, zodat 'on' het weer terugzet. Een uitgetikte fakkel heeft geen vlam.
   */
  setLamp(group: THREE.Object3D, look: 'on' | 'off' | number): void {
    const light = group.children[1] as THREE.Mesh | undefined;
    if (!light) return;
    const own = (group.userData.lampMat ??= light.material) as THREE.Material;
    light.visible = !(look === 'off' && own === FLAME_MAT);
    light.material = look === 'on' ? own : look === 'off' ? LAMP_OFF_MAT : flashMat(look);
  }

  private gateLamp: THREE.Mesh | null = null;

  /** Waar de grote lamp boven de ingang hangt: in tegels, en hoe hoog. */
  get gateLampAt(): [number, number, number] {
    return [Math.floor(W / 2) + 0.5, H + 0.12, 2.02];
  }

  /** De grote lamp boven het bord van de ingang (pas vanaf de nacht): gewoon aan, of in een kleur van het lichtfeestje. */
  setGateLamp(look: 'on' | number): void {
    if (!this.gateLamp) {
      const [gx, gy, h] = this.gateLampAt;
      const cap = new THREE.Mesh(merge([cone(0.17, 0.1, 0, 0.13, 0, 8), tube(0.02, 0.02, 0.1, 0, -0.14, 0)]), std(0x3d4f5a, 0.7));
      this.gateLamp = new THREE.Mesh(new THREE.IcosahedronGeometry(0.13, 1), LAMP_MAT);
      this.gateLamp.add(cap);
      this.gateLamp.position.set(toWorldX(gx), h, toWorldZ(gy));
      this.scene.add(this.gateLamp);
    }
    this.gateLamp.material = look === 'on' ? LAMP_MAT : flashMat(look);
  }

  /**
   * Vijvers die naast elkaar liggen, worden samen één vijver: elke vijvertegel krijgt de rand en het water die bij
   * zijn buren passen (zie shapePond). Geef alle vijvers mee, telkens als er een bij komt of weggaat.
   */
  syncPonds(ponds: { x: number; y: number; rot?: number; mesh: THREE.Object3D }[]): void {
    const spots = new Set(ponds.map(p => p.y * W + p.x));
    const at = (x: number, y: number): boolean => x >= 0 && x < W && spots.has(y * W + x);
    for (const p of ponds) {
      const { x, y } = p, n = at(x, y - 1), e = at(x + 1, y), s = at(x, y + 1), w = at(x - 1, y);
      let mask = (n ? 1 : 0) | (e ? 2 : 0) | (s ? 4 : 0) | (w ? 8 : 0);
      if (n && e && at(x + 1, y - 1)) mask |= 16;
      if (s && e && at(x + 1, y + 1)) mask |= 32;
      if (s && w && at(x - 1, y + 1)) mask |= 64;
      if (n && w && at(x - 1, y - 1)) mask |= 128;
      shapePond(p.mesh, mask, x, y, p.rot ?? 0);
    }
  }

  /**
   * Geen twee bomen zijn gelijk: bij elke plek hoort een eigen draaiing, grootte, hoogte, vorm van de kruin en
   * tint van het blad. Alles staat op de onderdelen zelf, zodat het spel de groep vrij kan laten wiegen en veren.
   */
  private varyTree(group: THREE.Group, x: number, y: number, kind: DecorKind): void {
    const look = TREE_LOOK[kind];
    if (!look) return;
    const size = 0.85 + hash(x, y, 1) * 0.4, tall = 0.92 + hash(x, y, 2) * 0.2, turn = hash(x, y, 3) * Math.PI * 2;
    const wide = 0.9 + hash(x, y, 4) * 0.26, crownTall = 0.92 + hash(x, y, 5) * 0.22;
    const shape = Math.floor(hash(x, y, 6) * 3) % 3, tone = Math.floor(hash(x, y, 7) * 4);
    group.children.forEach((child, i) => {
      const mesh = child as THREE.Mesh, crown = look.crown.includes(i);
      mesh.rotation.y = turn;
      mesh.scale.set(size * (crown ? wide : 1), size * tall * (crown ? crownTall : 1), size * (crown ? wide : 1));
      if (look.leaf.includes(i)) mesh.material = leafTone(mesh.material as THREE.MeshStandardMaterial, tone);
    });
    const crown = group.children[1] as THREE.Mesh;
    if (kind === 'tree') {
      crown.geometry = TREE_CROWNS[shape];
      (group.children[2] as THREE.Mesh).geometry = TREE_SHADES[shape];
    }
    if (kind === 'pine') crown.geometry = PINE_CROWNS[shape];
    if (kind === 'tree' && hash(x, y, 8) < 0.4) {
      // sommige loofbomen bloeien in de lente
      const blossom = new THREE.Mesh(TREE_BLOSSOMS[shape], BLOSSOM_MAT);
      blossom.rotation.copy(crown.rotation);
      blossom.scale.copy(crown.scale);
      group.add(blossom);
    }
  }

  ghostDecor(x: number, y: number, kind: DecorKind, ok: boolean, edge?: 'h' | 'v', rot = 0, shift = 0): void {
    this.ghostMat.color.setHex(ok ? OK_COLOR : BAD_COLOR);
    this.atSpot(this.ghostDecors[kind], x, y, edge, rot, shift).visible = true;
  }

  private runPool: THREE.Object3D[] = [];
  private runKind = -1;

  /**
   * Het voorbeeld van een heel stuk hek tegelijk (het hok dat je sleept): op elke rand een doorzichtig hekdeel.
   * Een lege lijst haalt het voorbeeld weg.
   */
  ghostRun(edges: Edge[], kind: number, ok: boolean): void {
    if (kind !== this.runKind) {
      for (const old of this.runPool) this.scene.remove(old);
      this.runPool = [];
      this.runKind = kind;
    }
    const model = kind === 8 ? this.ghostPetgateMesh : kind === 7 ? this.ghostPicketMesh : kind === 6 ? this.ghostWindowMesh : kind === 5 ? this.ghostGlassMesh : kind === 4 ? this.ghostNetMesh : kind === 3 ? this.ghostWallMesh : kind === 2 ? this.ghostGateMesh : this.ghostFenceMesh;
    while (this.runPool.length < edges.length) {
      const piece = model.clone();
      this.scene.add(piece);
      this.runPool.push(piece);
    }
    if (edges.length) this.ghostMat.color.setHex(ok ? OK_COLOR : BAD_COLOR);
    this.runPool.forEach((piece, i) => {
      piece.visible = i < edges.length;
      if (piece.visible) this.placeEdge(piece, edges[i]);
    });
  }

  private propMeshes = new Map<PropKind, THREE.InstancedMesh[]>();

  /**
   * Alle natuurdingen in het park (`gx`, `gy`: het midden, in tegels). Per soort wordt alles in één keer getekend:
   * dat scheelt veel tekenwerk als er honderden graspollen staan. Geen twee zijn precies gelijk: elk krijgt bij zijn
   * plek een eigen grootte en een eigen kleine draaiing bovenop de kwartslagen van de draaiknop.
   */
  syncProps(list: { kind: PropKind; gx: number; gy: number; rot: number }[]): void {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), pos = new THREE.Vector3(), scale = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    for (const kind of PROPS) {
      const items = list.filter(p => p.kind === kind);
      let meshes = this.propMeshes.get(kind);
      if (!meshes || items.length > meshes[0].instanceMatrix.count) {
        for (const old of meshes ?? []) {
          this.scene.remove(old);
          old.dispose();
        }
        const room = Math.max(32, Math.ceil(items.length * 1.5));
        // de schaduw in de kleuren: één keer, met alle onderdelen op hun plek
        shadeGroup(build(PROP_PARTS[kind]));
        meshes = PROP_PARTS[kind].map(([geo, mat, shadow = true]) => {
          const mesh = new THREE.InstancedMesh(geo, mat, room);
          mesh.castShadow = shadow;
          mesh.receiveShadow = !shadow;
          mesh.frustumCulled = false;
          this.scene.add(mesh);
          return mesh;
        });
        this.propMeshes.set(kind, meshes);
      }
      const big = PROP[kind].size === 2;
      items.forEach((p, i) => {
        const a = Math.round(p.gx * 4), b = Math.round(p.gy * 4);
        const s = 0.85 + hash(a, b, 1) * 0.3;
        pos.set(toWorldX(p.gx), 0, toWorldZ(p.gy));
        q.setFromAxisAngle(up, (p.rot * Math.PI) / 2 + (hash(a, b, 2) - 0.5) * 0.7);
        scale.set(s, s * (big ? 0.9 + hash(a, b, 3) * 0.25 : 1), s);
        m.compose(pos, q, scale);
        for (const mesh of meshes!) mesh.setMatrixAt(i, m);
      });
      for (const mesh of meshes) {
        mesh.count = items.length;
        mesh.instanceMatrix.needsUpdate = true;
      }
    }
  }

  ghostProp(kind: PropKind, gx: number, gy: number, rot: number, ok: boolean): void {
    this.ghostMat.color.setHex(ok ? OK_COLOR : BAD_COLOR);
    const ghost = this.ghostProps[kind];
    ghost.position.set(toWorldX(gx), 0, toWorldZ(gy));
    ghost.rotation.y = (rot * Math.PI) / 2;
    ghost.visible = true;
  }

  makeToy(x: number, y: number, kind: ToyKind, rot = 0): THREE.Group {
    const group = this.at(buildToy(kind), x, y, rot);
    this.scene.add(group);
    return group;
  }

  /** Een losse bal rolt een stukje: `angle` om een as die plat op de grond ligt (`ax`, `az`: in het speelgoed zelf gemeten, lengte 1). */
  rollLoose(piece: THREE.Object3D, ax: number, az: number, angle: number): void {
    piece.rotateOnWorldAxis(ROLL_AXIS.set(ax, 0, az), angle);
  }

  /**
   * Zet het losse onderdeel van speelgoed scheef: `angle` om een as die plat ligt (`ax`, `az`: lengte 1) door het punt
   * `pivot`, en daarna `yaw` om de as recht omhoog door dat punt. Zo schommelt de band aan zijn balk, wipt de plank
   * en draait de slingerbal om zijn paal. Met `angle` en `yaw` op nul staat het onderdeel weer gewoon.
   */
  swingPart(part: THREE.Object3D | undefined, pivot: [number, number, number], ax: number, az: number, angle: number, yaw = 0): void {
    if (!part) return;
    part.quaternion.setFromAxisAngle(ROLL_AXIS.set(ax, 0, az), angle);
    if (yaw) part.quaternion.premultiply(SPIN.setFromAxisAngle(UP, yaw));
    // draaien om het punt: het punt zelf blijft waar het is
    part.position.set(pivot[0], pivot[1], pivot[2]).sub(ROLL_AXIS.set(pivot[0], pivot[1], pivot[2]).applyQuaternion(part.quaternion));
  }

  ghostToy(x: number, y: number, kind: ToyKind, ok: boolean, rot = 0): void {
    this.ghostMat.color.setHex(ok ? OK_COLOR : BAD_COLOR);
    this.at(this.ghostToys[kind], x, y, rot).visible = true;
  }

  /** Een winkel met zijn linkerbovenhoek op tegel (x, y); hoeveel tegels hij beslaat, hangt af van het soort (zie shopSpan). */
  makeShop(x: number, y: number, kind: ShopKind, edge?: EdgePose, rot = 0): THREE.Group {
    const group = buildShop(kind);
    this.poseShop(group, x, y, kind, edge, rot);
    this.scene.add(group);
    return group;
  }

  /**
   * Zet een winkel op zijn plek. Een bankje, bloembak of afvalbak staat op een rand: langs die rand, een
   * stukje van het pad af en met het gezicht naar het pad (`face`: 1 = het pad ligt aan de zuid- of oostkant).
   */
  poseShop(group: THREE.Object3D, x: number, y: number, kind: ShopKind, edge?: EdgePose, rot = 0): void {
    if (!edge) {
      // een gebouw draait in kwartslagen: 0 = voorkant naar het zuiden, 1 = oosten, 2 = noorden, 3 = westen
      const [w, h] = shopSpan(kind, rot);
      group.position.set(toWorldX(x + w / 2), 0, toWorldZ(y + h / 2));
      group.rotation.y = (rot * Math.PI) / 2;
      return;
    }
    const off = -0.2 * edge.face;
    if (edge.o === 'h') {
      group.position.set(toWorldX(x + 0.5), 0, toWorldZ(y + off));
      group.rotation.y = edge.face < 0 ? Math.PI : 0;
    } else {
      group.position.set(toWorldX(x + off), 0, toWorldZ(y + 0.5));
      group.rotation.y = edge.face < 0 ? -Math.PI / 2 : Math.PI / 2;
    }
  }

  ghostShop(x: number, y: number, kind: ShopKind, ok: boolean, edge?: EdgePose, rot = 0): void {
    this.ghostMat.color.setHex(ok ? OK_COLOR : BAD_COLOR);
    const ghost = this.ghostShops[kind];
    this.poseShop(ghost, x, y, kind, edge, rot);
    ghost.visible = true;
  }

  /** Afval dat een gast op het pad heeft laten vallen. `splat`: een gevallen ijsje. */
  makeLitter(gx: number, gy: number, splat = false): THREE.Group {
    const group = build(splat ? SPLAT : LITTER_KINDS[Math.floor(Math.random() * LITTER_KINDS.length)]);
    group.scale.setScalar(1.25);
    group.position.set(toWorldX(gx), 0, toWorldZ(gy));
    group.rotation.y = Math.random() * Math.PI * 2;
    this.scene.add(group);
    return group;
  }

  makePuddle(gx: number, gy: number): THREE.Mesh {
    const mesh = new THREE.Mesh(
      new THREE.CircleGeometry(0.14, 14).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0xf1e05a, roughness: 0.3, transparent: true }),
    );
    mesh.position.set(toWorldX(gx), 0.006, toWorldZ(gy));
    this.scene.add(mesh);
    return mesh;
  }

  // ------------------------------------------------------------ voorbeeld
  hideGhost(): void {
    for (const g of this.ghosts) g.visible = false;
    for (const g of this.ghostAnimals.values()) g.visible = false;
  }

  ghostFence(e: Edge, kind: number, ok: boolean): void {
    const mesh = kind === 8 ? this.ghostPetgateMesh : kind === 7 ? this.ghostPicketMesh : kind === 6 ? this.ghostWindowMesh : kind === 5 ? this.ghostGlassMesh : kind === 4 ? this.ghostNetMesh : kind === 3 ? this.ghostWallMesh : kind === 2 ? this.ghostGateMesh : this.ghostFenceMesh;
    this.ghostMat.color.setHex(ok ? OK_COLOR : BAD_COLOR);
    this.placeEdge(mesh, e);
    mesh.visible = true;
  }

  ghostTile(x: number, y: number, color: number): void {
    this.ghostTileMat.color.setHex(color);
    this.ghostTileMesh.position.set(toWorldX(x + 0.5), 0.012, toWorldZ(y + 0.5));
    this.ghostTileMesh.visible = true;
  }

  ghostTrough(x: number, y: number, ok: boolean, rot = 0): void {
    this.ghostMat.color.setHex(ok ? OK_COLOR : BAD_COLOR);
    this.ghostTroughMesh.position.set(toWorldX(x + 0.5), 0, toWorldZ(y + 0.5));
    this.ghostTroughMesh.rotation.y = (rot * Math.PI) / 2;
    this.ghostTroughMesh.visible = true;
  }

  /** Doorzichtig dier op de tegel, met een ring in de kleur van jongen of meisje. */
  ghostAnimal(key: string, make: () => THREE.Object3D, x: number, y: number, ok: boolean, ringColor: number): void {
    let ghost = this.ghostAnimals.get(key);
    if (!ghost) {
      ghost = make();
      ghost.traverse(o => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        const mat = (mesh.material as THREE.MeshStandardMaterial).clone();
        mat.transparent = true;
        mat.opacity = 0.6;
        mesh.material = mat;
        mesh.castShadow = false;
      });
      this.ghostAnimals.set(key, ghost);
      this.scene.add(ghost);
    }
    ghost.traverse(o => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) (mesh.material as THREE.MeshStandardMaterial).color.setHex(ok ? 0xffffff : 0xff7a6a);
    });
    ghost.position.set(toWorldX(x + 0.5), 0, toWorldZ(y + 0.5));
    ghost.rotation.y = Math.PI / 4;
    ghost.visible = true;
    this.ghostRingMat.color.setHex(ok ? ringColor : BAD_COLOR);
    this.ghostRing.position.set(toWorldX(x + 0.5), 0.014, toWorldZ(y + 0.5));
    this.ghostRing.visible = true;
  }

  // ------------------------------------------------------------ effecten
  /** Witte gloed over een stel tegels, bijvoorbeeld als een hek een verblijf is geworden. */
  private glow: THREE.InstancedMesh | null = null;
  private glowLine: THREE.InstancedMesh | null = null;
  private glowKey = '';
  private glowMat = new THREE.MeshBasicMaterial({ color: 0xfff6c8, transparent: true, opacity: 0, depthWrite: false });
  private glowLineMat = new THREE.MeshBasicMaterial({ color: 0xfffbe6, transparent: true, opacity: 0, depthWrite: false });
  private glowLineGeo = new THREE.BoxGeometry(1.1, 0.01, 0.2).translate(0.5, 0, 0);

  /**
   * Het verblijf dat je aanwijst of gekozen hebt licht heel zacht op: een licht waasje over de tegels en een dun
   * lichtrandje onder het hek (`edges`). `strength` is hoe goed je het ziet (0 tot 1); het ademt een klein beetje
   * mee met `t`. Zonder tegels is het weg.
   */
  highlight(tiles: number[] | null, edges: Edge[] = [], strength = 1, t = 0): void {
    const key = tiles ? `${tiles.length}:${tiles[0]}:${tiles[tiles.length - 1]}:${edges.length}` : '';
    if (key !== this.glowKey) {
      this.glowKey = key;
      for (const old of [this.glow, this.glowLine])
        if (old) {
          this.scene.remove(old);
          old.dispose();
        }
      this.glow = this.glowLine = null;
      if (tiles?.length) {
        const m = new THREE.Matrix4();
        this.glow = new THREE.InstancedMesh(this.flashGeo, this.glowMat, tiles.length);
        tiles.forEach((i, k) => {
          const [x, y] = tileXY(i);
          this.glow!.setMatrixAt(k, m.makeTranslation(toWorldX(x + 0.5), 0.016, toWorldZ(y + 0.5)));
        });
        const line = (this.glowLine = new THREE.InstancedMesh(this.glowLineGeo, this.glowLineMat, Math.max(1, edges.length)));
        const turn = new THREE.Matrix4();
        edges.forEach((e, k) => {
          // dezelfde plek en draaiing als het hek zelf (zie placeEdge)
          turn.makeRotationY(e.o === 'v' ? -Math.PI / 2 : 0);
          line.setMatrixAt(k, m.makeTranslation(toWorldX(e.x), 0.02, toWorldZ(e.y)).multiply(turn));
        });
        line.count = edges.length;
        for (const mesh of [this.glow, line]) {
          mesh.renderOrder = 3;
          mesh.frustumCulled = false;
          this.scene.add(mesh);
        }
      }
    }
    if (!this.glow) return;
    const breath = 1 + 0.12 * Math.sin(t * 2.4);
    this.glowMat.opacity = strength * 0.13 * breath;
    this.glowLineMat.opacity = strength * 0.6 * breath;
  }

  flash(tiles: number[]): void {
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false });
    const meshes = tiles.map(i => {
      const [x, y] = tileXY(i);
      const mesh = new THREE.Mesh(this.flashGeo, mat);
      mesh.position.set(toWorldX(x + 0.5), 0.02, toWorldZ(y + 0.5));
      mesh.renderOrder = 4;
      this.scene.add(mesh);
      return mesh;
    });
    this.flashes.push({ meshes, mat, life: 1 });
  }

  // ------------------------------------------------------------ leven in het park
  /**
   * Het leven in en om een winkel, elk beeldje opnieuw: wat op het dak staat wiegt, de wc-deuren zwaaien elk apart
   * open als er een gast in of uit stapt (`userData.ajar`, zie de gasten) en daarna weer dicht, het doek van de
   * trampoline veert, het bankje zakt een haartje in, de deksel van de afvalbak klapt (zie flapLid) en om een
   * vieze kraam cirkelen vliegen. Wat het spel zelf laat bewegen (`userData.moving` en `userData.cars`) blijft
   * hier met rust.
   */
  animateShop(group: THREE.Object3D, kind: ShopKind, t: number, busy: number, seed: number): void {
    const u = group.userData;
    const dt = Math.min(0.1, Math.max(0, t - (u.at ?? t)));
    u.at = t;
    // hoe druk het is, schuift rustig mee
    let use: number = u.use ?? 0;
    use += ((busy > 0 ? 1 : 0) - use) * Math.min(1, dt * 5);
    u.use = use;
    const bob: THREE.Object3D[] | undefined = u.bob;
    if (bob)
      for (let i = 0; i < bob.length; i++) {
        const b = bob[i], d = b.userData, own = seed + i * 1.9;
        b.position.y = d.y0 + Math.sin(t * 2.1 + own) * d.amp * (1 + use);
        b.rotation.z = Math.sin(t * 1.4 + own) * d.sway;
        if (d.yaw) b.rotation.y = Math.sin(t * 2.6 + own) * d.yaw + Math.sin(t * 6.3 + own) * d.yaw * 0.25;
      }
    const doors: THREE.Object3D[] | undefined = u.door;
    if (doors) {
      // elke deur gaat apart open en dicht: de gasten zetten in `ajar` welke open moet (een bit per deur)
      const ajar: number = u.ajar ?? 0;
      for (let i = 0; i < doors.length; i++) {
        const d = doors[i].userData;
        const swing: number = Math.max(0, Math.min(1, (d.swing ?? 0) + ((ajar >> i) & 1 ? dt : -dt) / 0.32));
        d.swing = swing;
        doors[i].rotation.y = d.open * swing * swing * (3 - 2 * swing);
      }
    }
    if (kind === 'trampoline' && u.mat) (u.mat as THREE.Object3D).position.y = -use * (0.05 + 0.035 * Math.sin(t * 11 + seed));
    if (kind === 'bench' && u.seat) (u.seat as THREE.Object3D).scale.y = 1 - 0.04 * use;
    const lid: THREE.Object3D | undefined = u.lid;
    if (lid) {
      if (u.flap === -1) u.flap = t;
      const k = u.flap === undefined ? 1 : (t - u.flap) / 0.6;
      // af en toe rammelt de deksel vanzelf even
      const rattle = Math.max(0, Math.sin(t * 0.8 + seed));
      lid.rotation.x = k >= 0 && k < 1 ? -1.25 * Math.sin(Math.PI * Math.pow(k, 0.6)) : -0.1 * Math.pow(rattle, 12) * Math.abs(Math.sin(t * 17));
    }
    const dirt: THREE.Object3D | undefined = u.dirt;
    if (dirt && dirt.visible) {
      const flies: THREE.Object3D[] = u.flies;
      for (let i = 0; i < flies.length; i++) {
        const f = flies[i], d = f.userData, a = t * (3.1 + i * 0.9) + seed + i * 2;
        f.position.set(d.x + Math.cos(a) * 0.22, d.y + Math.sin(a * 1.7) * 0.08, d.z + Math.sin(a) * 0.22);
        f.rotation.y = -a;
      }
    }
    const party: THREE.Object3D | undefined = u.party;
    if (party && party.visible) (party.userData.balloons as THREE.Object3D).rotation.z = Math.sin(t * 1.6 + seed) * 0.09;
  }

  /** Elk beeldje: alles wat aan een attractie beweegt in de stand van dit moment (zie poseRide en rides.ts). */
  animateRide(group: THREE.Object3D, kind: ShopKind, state: RideState): void {
    poseRide(group, kind, state);
  }

  /** De deksel van de afvalbak klapt open en valt weer dicht (ruim een halve tel); animateShop speelt het af. */
  flapLid(group: THREE.Object3D): void {
    group.userData.flap = -1;
  }

  /**
   * Alles wat aan een versiering uit zichzelf beweegt, elk beeldje opnieuw: bomen en bloemen wiegen, de vlag
   * wappert, de wieken draaien, het vuur flakkert, water rimpelt, lampjes flikkeren. Is de versiering net
   * aangetikt (zie pokeDecor), dan komt daar een paar tellen een flinke reactie bovenop.
   */
  animateDecor(group: THREE.Object3D, kind: DecorKind, t: number, seed: number): void {
    const c = group.children, u = group.userData;
    // `p` loopt na het aantikken van 1 terug naar 0
    const since: number = u.poke === undefined ? POKE_SECONDS : t - u.poke;
    const p = since >= 0 && since < POKE_SECONDS ? 1 - since / POKE_SECONDS : 0;
    const shake = p * Math.sin(since * 24);
    switch (kind) {
      case 'flag':
        group.rotation.y = (u.turn ?? 0) + Math.sin(t * 1.8 + seed) * 0.3 + p * Math.sin(since * 15) * 0.9;
        break;
      case 'tree':
      case 'pine':
      case 'palm':
      case 'topiary':
      case 'cherry':
      case 'bamboogrove':
        group.rotation.z = Math.sin(t * 1.2 + seed) * 0.025 + shake * 0.13;
        group.rotation.x = p * Math.sin(since * 19) * 0.07;
        break;
      case 'roses':
      case 'tulips':
        group.rotation.z = Math.sin(t * 2 + seed) * 0.03 + shake * 0.1;
        break;
      case 'sunflowers':
        // de bloemen knikken: stelen en koppen samen om de grond
        c[1].rotation.x = c[2].rotation.x = c[3].rotation.x = Math.sin(t * 1.1 + seed) * 0.07 + shake * 0.2;
        break;
      case 'windmill':
        c[3].rotation.z = t * 1.4 + seed + (u.spun ?? 0) + pokeSpin(since);
        break;
      case 'campfire':
        c[2].scale.set(1 + p * 0.5, 1 + Math.sin(t * 11 + seed) * 0.18 + p * 1.1, 1 + p * 0.5);
        c[3].scale.set(1 + p * 0.5, 1 + Math.sin(t * 14 + seed * 1.7) * 0.25 + p * 1.3, 1 + p * 0.5);
        break;
      case 'waterfall':
        c[1].scale.set(1 + shake * 0.3, 1 + Math.sin(t * 7) * 0.04, 1);
        c[3].scale.x = 1 + shake * 0.08;
        break;
      case 'pond':
        c[2].position.y = c[3].position.y = Math.sin(t * 2 + seed) * 0.012 + p * Math.abs(Math.sin(since * 9)) * 0.05;
        c[1].scale.x = c[1].scale.z = 1 + shake * 0.07;
        break;
      case 'well':
        // het emmertje gaat op en neer
        c[4].position.y = Math.sin(t * 1.6 + seed) * 0.03 + p * Math.sin(since * 10) * 0.09;
        c[1].scale.x = c[1].scale.z = 1 + shake * 0.12;
        break;
      case 'birdbath': {
        c[1].scale.x = c[1].scale.z = 1 + Math.sin(t * 3 + seed) * 0.025 + shake * 0.1;
        // het vogeltje hipt af en toe
        const hop = Math.max(0, Math.sin(t * 1.7 + seed));
        c[2].position.y = c[3].position.y = hop * hop * hop * hop * 0.03 + p * Math.abs(Math.sin(since * 11)) * 0.1;
        break;
      }
      case 'pump':
        c[2].rotation.x = -0.5 + Math.sin(t * 2.4 + seed) * 0.2 * (1 + p * 1.5);
        break;
      case 'lantern':
      case 'gardenlight':
      case 'lampion':
      case 'torch':
      case 'streetlamp':
      case 'lightstring':
        // het licht flikkert een beetje; aangetikt licht het fel op
        c[1].scale.setScalar(1 + Math.sin(t * 9 + seed) * 0.03 + Math.sin(t * 23 + seed * 2) * 0.02 + p * 0.7);
        break;
      case 'scarecrow':
        group.rotation.z = Math.sin(t * 1.5 + seed) * 0.035 + shake * 0.16;
        break;
      case 'snowman':
        group.rotation.z = Math.sin(t * 2.2 + seed) * 0.015 + shake * 0.13;
        break;
      case 'clocktower':
        // de slinger
        c[5].rotation.z = Math.sin(t * 3) * 0.45;
        this.squash(group, p, since);
        break;
      case 'mushrooms': {
        const k = Math.sin(t * 2.5 + seed) * 0.04 + shake * 0.2;
        c[0].scale.set(1 - k * 0.5, 1 + k, 1 - k * 0.5);
        c[1].scale.copy(c[0].scale);
        break;
      }
      case 'bunting':
        c[1].rotation.y = Math.sin(t * 5 + seed) * 0.35 + Math.sin(t * 11 + seed) * 0.1 + shake * 1.2;
        break;
      case 'guestbook':
        // het losse blad wappert; aangetikt slaat het om en weer terug
        c[2].rotation.z = 0.25 + Math.sin(t * 3.1 + seed) * 0.16 + (p > 0 ? Math.sin((since / POKE_SECONDS) * Math.PI) * 2.4 : 0);
        break;
      default:
        // de rest staat stil, maar veert even als je erop tikt
        this.squash(group, p, since);
    }
  }

  /** Even indeuken en uitrekken na het aantikken; daarna weer precies de gewone maat. */
  private squash(o: THREE.Object3D, p: number, since: number): void {
    if (p > 0) {
      const k = Math.sin(since * 16) * 0.16 * p;
      o.scale.set(1 - k * 0.6, 1 + k, 1 - k * 0.6);
      o.userData.squashed = true;
    } else if (o.userData.squashed) {
      o.scale.set(1, 1, 1);
      o.userData.squashed = false;
    }
  }

  /** De speler tikt op een versiering: animateDecor laat hem daarna een paar tellen flink reageren. */
  pokeDecor(group: THREE.Object3D, kind: DecorKind, t: number): void {
    const u = group.userData;
    // de wieken draaien door vanaf waar ze waren
    if (kind === 'windmill') u.spun = (u.spun ?? 0) + pokeSpin(u.poke === undefined ? POKE_SECONDS : t - u.poke);
    u.poke = t;
  }

  /**
   * Feest bij een gebouw: slingers tussen vier dunne palen op de hoeken van zijn tegels, ballonnen en (als er plek
   * is) een taart op een tafeltje rechtsvoor. Wordt pas gemaakt als het voor het eerst nodig is.
   */
  setShopParty(group: THREE.Object3D, on: boolean): void {
    let party: THREE.Group | undefined = group.userData.party;
    if (!party) {
      if (!on) return;
      const kind: ShopKind = group.userData.kind;
      const geos = partyParts(SHOP_SIZE[kind], SHOP_DEEP[kind] ?? SHOP_SIZE[kind]);
      party = new THREE.Group();
      const balloons = new THREE.Mesh(geos.balloons, PAINT_MAT);
      balloons.position.set(...geos.at);
      party.add(new THREE.Mesh(geos.white, WHITE_MAT), new THREE.Mesh(geos.colors, PAINT_MAT), balloons);
      party.traverse(o => { o.castShadow = true; });
      party.userData.balloons = balloons;
      group.add(party);
      group.userData.party = party;
    }
    party.visible = on;
  }

  /**
   * Een vieze kraam: bruine vlekken op de vloer (en bij een kraam op de toonbank) en twee vliegen die er rondjes
   * om vliegen (animateShop). Wordt pas gemaakt als het voor het eerst nodig is.
   */
  setShopDirt(group: THREE.Object3D, dirty: boolean): void {
    let dirt: THREE.Group | undefined = group.userData.dirt;
    if (!dirt) {
      if (!dirty) return;
      const made = new THREE.Group();
      const kind: ShopKind = group.userData.kind;
      const floor = new THREE.Mesh(GRIME_FLOOR_GEO, GRIME_MAT);
      if (STALLS.includes(kind)) {
        // een marktkraam is maar één tegel diep en heeft een dun matje
        floor.scale.z = 0.42;
        floor.position.y = -0.024;
      } else floor.scale.set(SHOP_SIZE[kind] / 2, 1, (SHOP_DEEP[kind] ?? SHOP_SIZE[kind]) / 2); // de vlekken liggen over de hele vloer
      made.add(floor);
      if (STALLS.includes(kind)) made.add(new THREE.Mesh(GRIME_FRONT_GEO, GRIME_MAT));
      group.userData.flies = [[0.25, 0.8, 0.55], [-0.3, 1, 0.2]].map(([x, y, z]) => {
        const fly = new THREE.Mesh(FLY_GEO, FLY_MAT);
        fly.position.set(x, y, z);
        Object.assign(fly.userData, { x, y, z });
        made.add(fly);
        return fly;
      });
      // een bankje of een bak is maar klein
      if (onEdge(kind)) made.scale.setScalar(0.45);
      group.add(made);
      group.userData.dirt = dirt = made;
    }
    dirt.visible = dirty;
  }

  /**
   * Het treintje: een rood-groene locomotief en TRAIN.wagons open wagons met elk TRAIN.seats bankjes achter
   * elkaar. Eén keer gemaakt en onzichtbaar in het beeld gezet; het spel zet zelf `position` en `rotation.y`.
   * Elk deel heeft zijn midden op de grond en zijn neus naar +z.
   */
  makeTrain(): { loco: THREE.Group; wagons: THREE.Group[] } {
    if (this.train) return this.train;
    const dark = std(0x3d4f5a, 0.7);
    const wheels = (zs: number[], r: number): THREE.BufferGeometry =>
      mergeGeometries(zs.flatMap(z => [-0.2, 0.2].map(x => new THREE.CylinderGeometry(r, r, 0.05, 12).rotateZ(Math.PI / 2).translate(x, r, z))))!;
    const loco = build([
      [mergeGeometries([boxAt(0.4, 0.07, 0.8, 0, 0.145, 0), boxAt(0.36, 0.06, 0.04, 0, 0.15, 0.41)])!, dark],
      // de ketel, de cabine met een geel dak, de schoorsteen en de wielen
      [new THREE.CylinderGeometry(0.15, 0.15, 0.48, 12).rotateX(Math.PI / 2).translate(0, 0.33, 0.15), P_GREEN],
      [boxAt(0.38, 0.4, 0.3, 0, 0.38, -0.24), P_RED],
      [boxAt(0.44, 0.04, 0.36, 0, 0.6, -0.24), P_YELLOW],
      [mergeGeometries([tube(0.045, 0.04, 0.14, 0, 0.55, 0.27), tube(0.07, 0.045, 0.05, 0, 0.645, 0.27), tube(0.05, 0.06, 0.06, 0, 0.5, 0.05)])!, dark],
      [wheels([-0.24, 0.2], 0.09), P_RED],
      [boxAt(0.4, 0.13, 0.16, 0, 0.45, -0.24), std(0x9fd8f5, 0.4)],
      [ball(0.045, 0, 0.33, 0.39), LAMP_MAT],
    ]);
    const seats = Array.from({ length: TRAIN.seats }, (_, i) => (i - (TRAIN.seats - 1) / 2) * 0.26);
    const body = mergeGeometries([
      boxAt(0.42, 0.06, 0.8, 0, 0.15, 0),
      boxAt(0.03, 0.1, 0.8, -0.195, 0.23, 0), boxAt(0.03, 0.1, 0.8, 0.195, 0.23, 0), boxAt(0.42, 0.1, 0.03, 0, 0.23, -0.385), boxAt(0.42, 0.1, 0.03, 0, 0.23, 0.385),
    ])!;
    const benches = mergeGeometries(seats.map(z => boxAt(0.32, 0.04, 0.13, 0, 0.2, z)))!;
    const under = mergeGeometries([wheels([-0.24, 0.24], 0.08), boxAt(0.05, 0.04, 0.18, 0, 0.14, 0.47)])!;
    const wagons = Array.from({ length: TRAIN.wagons }, (_, i) => build([[body, [P_BLUE, P_YELLOW, P_GREEN][i % 3]], [benches, FENCE_MAT], [under, dark]]));
    for (const part of [loco, ...wagons]) {
      part.visible = false;
      this.scene.add(part);
    }
    return (this.train = { loco, wagons });
  }

  /**
   * Een kabelbaan van `len` tegels, van het midden van het eerste huisje (ax, ay) in richting (ux, uy): twee kabels
   * (heen en terug) die bij de huisjes laag om een groot wiel gaan en daartussen hoog over het park hangen, palen op
   * `poles` tegels, en `chairs` stoeltjes. In de groep loopt +x van het eerste naar het tweede huisje. Het spel
   * zet de stoeltjes zelf op hun plek en draait de wielen.
   */
  makeCable(len: number, poles: number[], chairs: number, ax: number, ay: number, ux: number, uy: number): { group: THREE.Group; chairs: THREE.Object3D[]; wheels: THREE.Object3D[] } {
    const group = new THREE.Group();
    group.position.set(toWorldX(ax), 0, toWorldZ(ay));
    group.rotation.y = Math.atan2(-uy, ux);
    const r = CABLE.r, rope: THREE.BufferGeometry[] = [];
    const steps = Math.max(2, Math.ceil(len / 0.25));
    for (const side of [-r, r])
      for (let i = 0; i < steps; i++) {
        const t0 = (len * i) / steps, t1 = (len * (i + 1)) / steps;
        rope.push(beam(0.03, [t0, cableHeight(t0, len), side], [t1, cableHeight(t1, len), side]));
      }
    for (const end of [0, len]) rope.push(new THREE.TorusGeometry(r, 0.016, 4, 24).rotateX(Math.PI / 2).translate(end, CABLE.low, 0));
    const ropeMesh = new THREE.Mesh(merge(rope), CABLE_MAT);
    ropeMesh.castShadow = true;
    group.add(ropeMesh);
    // de palen: een voet van steen, een blauwe paal, een gele dwarsbalk met rode wieltjes onder de kabel en sneeuw erop
    if (poles.length) {
      const stand: [number, ...THREE.BufferGeometry[]][] = [[0xb9b2a6], [0x5b7c99], [0xffd23f], [0xe0584f]];
      const snow: THREE.BufferGeometry[] = [];
      for (const t of poles) {
        const h = cableHeight(t, len);
        stand[0].push(boxAt(0.32, 0.08, 0.32, t, 0.04, 0));
        stand[1].push(tube(0.06, 0.09, h + 0.06, t, (h + 0.06) / 2, 0));
        stand[2].push(boxAt(0.09, 0.07, 2 * r + 0.3, t, h + 0.07, 0));
        for (const side of [-r, r]) stand[3].push(new THREE.CylinderGeometry(0.055, 0.055, 0.05, 10).rotateX(Math.PI / 2).translate(t, h + 0.01, side));
        snow.push(boxAt(0.1, 0.035, 2 * r + 0.3, t, h + 0.122, 0), ball(0.07, t, h + 0.11, 0));
      }
      const pole = new THREE.Mesh(painted(...stand), PAINT_MAT);
      pole.castShadow = true;
      group.add(pole, new THREE.Mesh(merge(snow), CABLE_SNOW_MAT));
    }
    // de grote wielen in de huisjes: een rode rand met spaken en een gele naaf
    const wheelGeo = painted(
      [0xe0584f, new THREE.TorusGeometry(r, 0.035, 6, 24).rotateX(Math.PI / 2)],
      [0x8a8f98, ...[0, 1, 2].map(k => boxAt(2 * r, 0.025, 0.035, 0, 0, 0).rotateY((k * Math.PI) / 3))],
      [0xffd23f, tube(0.07, 0.07, 0.07, 0, 0, 0)],
    );
    const wheels = [0, len].map(end => {
      const wheel = new THREE.Mesh(wheelGeo, PAINT_MAT);
      wheel.position.set(end, CABLE.low, 0);
      group.add(wheel);
      return wheel;
    });
    const seats = Array.from({ length: chairs }, (_, i) => {
      const chair = new THREE.Mesh(chairGeo(CHAIR_COLORS[i % CHAIR_COLORS.length]), PAINT_MAT);
      chair.castShadow = true;
      group.add(chair);
      return chair;
    });
    this.scene.add(group);
    return { group, chairs: seats, wheels };
  }

  /** Het voorbeeld van de kabel: een lijn hoog boven het park van het ene huisje naar het andere, groen of rood. */
  ghostCable(ax: number, ay: number, bx: number, by: number, ok: boolean): void {
    const m = this.ghostCableMesh, dx = bx - ax, dy = by - ay;
    (m.material as THREE.MeshBasicMaterial).color.setHex(ok ? OK_COLOR : BAD_COLOR);
    m.position.set(toWorldX((ax + bx) / 2), CABLE.high, toWorldZ((ay + by) / 2));
    m.rotation.set(0, Math.atan2(-dy, dx), 0);
    m.scale.set(Math.max(0.1, Math.hypot(dx, dy)), 1, 1);
    m.visible = true;
  }

  /**
   * Slingers tussen de palen. Elke paal kijkt naar het oosten en naar het zuiden: staat daar binnen STRING_REACH
   * tegels een paal van dezelfde soort, dan hangt er een slinger tussen, met vlaggetjes ('bunting') of lampjes
   * ('lightstring', ze gloeien 's nachts vanzelf). Verandert er niets aan de palen, dan gebeurt er niets.
   */
  syncStrings(poles: { x: number; y: number; kind: 'bunting' | 'lightstring'; off?: boolean }[]): void {
    const key = poles.map(p => `${p.x},${p.y}${p.kind[0]}${p.off ? '-' : ''}`).join(';');
    if (key === this.stringKey) return;
    this.stringKey = key;
    if (this.strings) {
      this.scene.remove(this.strings);
      for (const child of this.strings.children) (child as THREE.Mesh).geometry.dispose();
      this.strings = null;
    }
    const at = new Map<string, 'bunting' | 'lightstring'>();
    for (const p of poles) at.set(`${p.x},${p.y}`, p.kind);
    const rope: THREE.BufferGeometry[] = [], flags: THREE.BufferGeometry[] = [], bulbs: THREE.BufferGeometry[] = [], dim: THREE.BufferGeometry[] = [];
    const top = (x: number, y: number): THREE.Vector3 => new THREE.Vector3(toWorldX(x + 0.5), STRING_HEIGHT, toWorldZ(y + 0.5));
    // de slinger hoort bij de paal waar hij begint: is die lamp uitgetikt, dan zijn de lampjes erin ook uit
    for (const p of poles)
      for (const [dx, dy] of [[1, 0], [0, 1]])
        for (let d = 1; d <= STRING_REACH; d++) {
          if (at.get(`${p.x + dx * d},${p.y + dy * d}`) !== p.kind) continue;
          garland(top(p.x, p.y), top(p.x + dx * d, p.y + dy * d), p.kind, rope, p.kind === 'bunting' ? flags : p.off ? dim : bulbs);
          break;
        }
    if (!rope.length) return;
    const group = new THREE.Group();
    if (rope.length) group.add(new THREE.Mesh(merge(rope), ROPE_MAT));
    if (flags.length) group.add(new THREE.Mesh(merge(flags), PAINT_MAT));
    if (bulbs.length) group.add(new THREE.Mesh(merge(bulbs), LAMP_MAT));
    if (dim.length) group.add(new THREE.Mesh(merge(dim), LAMP_OFF_MAT));
    this.scene.add(group);
    this.strings = group;
  }

  update(dt: number): void {
    const want = (this.turn * Math.PI) / 2;
    if (this.angle !== want) {
      const d = want - this.angle;
      this.angle = Math.abs(d) < 0.004 ? want : this.angle + d * Math.min(1, dt * 7);
      this.resize();
    }
    this.ground.update(dt);
    this.speckTime += dt;
    this.placeSpecks();
    this.stepWeather(dt);
    this.placeRainbow();
    this.stepGong(dt);
    chaseLamps(this.speckTime);
    for (const d of this.drops) {
      d.life -= dt;
      d.vy -= 5 * dt;
      d.mesh.position.x += d.vx * dt;
      d.mesh.position.y += d.vy * dt;
      d.mesh.position.z += d.vz * dt;
      if (d.life <= 0 || d.mesh.position.y < 0) this.scene.remove(d.mesh);
    }
    if (this.drops.length) this.drops = this.drops.filter(d => d.life > 0 && d.mesh.position.y >= 0);
    for (const f of this.falls) {
      // eerst steeds sneller omvallen, dan een klein stuitertje, dan langzaam weg
      f.t += dt;
      const fall = Math.min(1, f.t / 0.45), bounce = f.t > 0.45 ? Math.abs(Math.sin(Math.min(1, (f.t - 0.45) / 0.3) * Math.PI)) * 0.12 : 0;
      f.plank.rotation.x = f.tip * (fall * fall * 1.45 - bounce);
      f.mat.opacity = Math.max(0, Math.min(1, (2.2 - f.t) / 0.6));
      if (f.t > 2.2) {
        this.scene.remove(f.obj);
        f.mat.dispose();
      }
    }
    if (this.falls.length) this.falls = this.falls.filter(f => f.t <= 2.2);
    if (this.fly) {
      const k = Math.min(1, dt * 5);
      this.target.x += (this.fly.x - this.target.x) * k;
      this.target.z += (this.fly.z - this.target.z) * k;
      if (Math.hypot(this.fly.x - this.target.x, this.fly.z - this.target.z) < 0.03) this.fly = null;
      this.resize();
    }
    this.placeEye(dt);
    this.skyDome.step(dt, this.eye.position);
    for (const f of this.flashes) {
      f.life -= dt / 1.1;
      f.mat.opacity = Math.max(0, f.life) * 0.85;
      if (f.life <= 0) {
        for (const m of f.meshes) this.scene.remove(m);
        f.mat.dispose();
      }
    }
    this.flashes = this.flashes.filter(f => f.life > 0);
  }

  /**
   * Houdt het beeld vloeiend op een traag apparaat: blijft het een paar tellen haperen, dan wordt het
   * beeld eerst minder scherp en daarna gaan de schaduwen uit. `dt` is de echte tijd van het vorige beeldje.
   */
  /** Hoe goed het apparaat het bijhoudt: 2 = prima, 1 = wat traag, 0 = traag. */
  get speed(): number {
    return this.quality;
  }

  adapt(dt: number): void {
    if (dt > 0.5 || this.quality === 0) return; // het tabblad was even weg, of er valt niets meer te winnen
    this.slowFor = dt > 1 / 26 ? this.slowFor + dt : Math.max(0, this.slowFor - dt * 2);
    if (this.slowFor < 3) return;
    this.slowFor = 0;
    this.quality--;
    if (this.quality === 1 && this.renderer.getPixelRatio() > 1) this.renderer.setPixelRatio(1);
    else {
      this.quality = 0;
      this.sun.castShadow = false;
    }
  }

  render(): void {
    this.renderer.render(this.scene, this.eye);
  }

  private shot: { target: THREE.WebGLRenderTarget; cam: THREE.OrthographicCamera; px: Uint8Array; lut: Uint8ClampedArray; img: ImageData } | null = null;

  /**
   * Een levend plaatje van één ding in het park (het dier in het menu): het park wordt van dichtbij nog een keer
   * getekend, met `obj` in het midden en `size` tegels in beeld, en op het kleine doek gezet. Zo zie je het dier
   * bewegen zoals het op dat moment doet.
   */
  portrait(obj: THREE.Object3D, canvas: HTMLCanvasElement, size: number): void {
    const n = canvas.width;
    const ctx = canvas.getContext('2d');
    if (!ctx || !n) return;
    if (!this.shot || this.shot.target.width !== n) {
      // het beeld komt lineair terug; dit tabelletje maakt er de gewone schermkleuren van
      const lut = new Uint8ClampedArray(256);
      for (let i = 0; i < 256; i++) {
        const c = i / 255;
        lut[i] = Math.round((c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055) * 255);
      }
      this.shot = { target: new THREE.WebGLRenderTarget(n, n), cam: new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200), px: new Uint8Array(n * n * 4), lut, img: ctx.createImageData(n, n) };
    }
    const { target, cam, px, lut, img } = this.shot;
    const half = size / 2, p = obj.position;
    cam.left = -half;
    cam.right = half;
    cam.top = half;
    cam.bottom = -half;
    // van dezelfde kant als het grote beeld, maar lager: je kijkt het dier bijna aan
    cam.position.set(p.x + 20, p.y + size * 0.3 + 12, p.z + 20);
    cam.lookAt(p.x, p.y + size * 0.3, p.z);
    cam.updateProjectionMatrix();
    const r = this.renderer, auto = r.shadowMap.autoUpdate;
    r.shadowMap.autoUpdate = false;
    r.setRenderTarget(target);
    r.render(this.scene, cam);
    r.readRenderTargetPixels(target, 0, 0, n, n, px);
    r.setRenderTarget(null);
    r.shadowMap.autoUpdate = auto;
    // de rijen staan op hun kop
    const d = img.data, row = n * 4;
    for (let y = 0; y < n; y++) {
      const src = (n - 1 - y) * row, dst = y * row;
      for (let x = 0; x < row; x += 4) {
        d[dst + x] = lut[px[src + x]];
        d[dst + x + 1] = lut[px[src + x + 1]];
        d[dst + x + 2] = lut[px[src + x + 2]];
        d[dst + x + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }
}
