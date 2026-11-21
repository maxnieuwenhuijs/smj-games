// Het beeld: isometrische camera, tegels, hekken, voerbakken en het voorbeeld van wat je gaat plaatsen.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  FENCE_COLORS, BEDS, SHOPS, SHOP_SIZE, TERRAINS, TERRAIN_INFO, type BedKind, type FoodId, type ShopKind, type WorldId, TOYS, type ToyKind, DECORS, type DecorKind, type TroughKind,
  BUMPER_CARS, FERRIS, RESTAURANT_TABLES, SEASONAL, STALLS, STRING_HEIGHT, STRING_REACH, TOWER_TOP, TOY_LIFT, TRAIN, bumperCar, isPath, type Season, type Sky,
} from './data';
import { BASE_LAND, Grid, H, SIDES, W, edgeKey, tileXY, type Edge, type Land, type Side } from './grid';

const SQRT2 = Math.SQRT2;
const SQRT3 = Math.sqrt(3);
const OK_COLOR = 0x7dff7d;
const BAD_COLOR = 0xff5a4a;

function boxAt(w: number, h: number, d: number, x: number, y: number, z: number): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  return g;
}

// Een hekdeel loopt van (0,0,0) naar (1,0,0).
const FENCE_GEO = mergeGeometries([
  boxAt(0.13, 0.5, 0.13, 0, 0.25, 0),
  boxAt(0.13, 0.5, 0.13, 1, 0.25, 0),
  boxAt(1, 0.08, 0.06, 0.5, 0.17, 0),
  boxAt(1, 0.08, 0.06, 0.5, 0.37, 0),
])!;
// Een houten hek slijt in drie fases: de bovenste plank zakt scheef, dan hangt hij los, dan ligt het hek half plat.
// Bij elke fase is het hout donkerder.
const plank = (len: number, x: number, y: number, tilt: number): THREE.BufferGeometry => new THREE.BoxGeometry(len, 0.08, 0.06).rotateZ(tilt).translate(x, y, 0);
const WORN_GEOS = [
  FENCE_GEO,
  mergeGeometries([boxAt(0.13, 0.5, 0.13, 0, 0.25, 0), boxAt(0.13, 0.5, 0.13, 1, 0.25, 0), plank(1, 0.5, 0.17, 0), plank(1, 0.5, 0.35, 0.08)])!,
  mergeGeometries([boxAt(0.13, 0.5, 0.13, 0, 0.25, 0), boxAt(0.13, 0.46, 0.13, 1, 0.23, 0), plank(1, 0.5, 0.17, -0.04), plank(0.72, 0.33, 0.25, -0.36)])!,
  mergeGeometries([boxAt(0.13, 0.5, 0.13, 0, 0.25, 0), boxAt(0.13, 0.26, 0.13, 1, 0.13, 0), plank(0.95, 0.52, 0.05, 0.03), plank(0.6, 0.3, 0.17, -0.5)])!,
];
// De poort is van hetzelfde hout, maar hoger en met een deurtje.
const GATE_GEO = mergeGeometries([
  boxAt(0.15, 0.72, 0.15, 0, 0.36, 0),
  boxAt(0.15, 0.72, 0.15, 1, 0.36, 0),
  boxAt(1.15, 0.1, 0.15, 0.5, 0.75, 0),
  boxAt(0.82, 0.07, 0.06, 0.5, 0.12, 0),
  boxAt(0.82, 0.07, 0.06, 0.5, 0.42, 0),
  boxAt(0.07, 0.36, 0.06, 0.2, 0.27, 0),
  boxAt(0.07, 0.36, 0.06, 0.5, 0.27, 0),
  boxAt(0.07, 0.36, 0.06, 0.8, 0.27, 0),
])!;
// Stenen muur voor sterke dieren: laag en smal genoeg om eroverheen het verblijf in te kijken.
const WALL_GEO = mergeGeometries([
  boxAt(1.06, 0.3, 0.13, 0.5, 0.15, 0),
  boxAt(0.2, 0.09, 0.16, 0.12, 0.345, 0),
  boxAt(0.2, 0.09, 0.16, 0.5, 0.345, 0),
  boxAt(0.2, 0.09, 0.16, 0.88, 0.345, 0),
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
])!;
// Slaapplekken. Het stalletje heeft alleen achterwanden en een afdakje, zodat je het slapende dier blijft zien.
const STRAW_GEO = mergeGeometries([
  boxAt(0.86, 0.07, 0.86, 0, 0.035, 0),
  boxAt(0.6, 0.06, 0.6, 0.03, 0.1, -0.02),
])!;
const SHED_WALL_GEO = mergeGeometries([
  boxAt(0.94, 0.62, 0.06, 0, 0.31, -0.44),
  boxAt(0.06, 0.62, 0.94, -0.44, 0.31, 0),
  boxAt(0.08, 0.62, 0.08, 0.44, 0.31, 0.44),
])!;
const SHED_ROOF_GEO = mergeGeometries([
  boxAt(1.08, 0.07, 0.5, 0, 0.66, -0.3),
  boxAt(0.5, 0.07, 1.08, -0.3, 0.66, 0),
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
/** Steeltjes van bloemen: blijven groen, ook in de herfst en de winter. */
const STEM_MAT = new THREE.MeshStandardMaterial({ color: 0x5fa544, roughness: 1 });
/** Voor vormen met een eigen kleur per hoekpunt (zie `paint`): zo is een bont ding toch één onderdeel. */
const PAINT_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 });

const NET_MAT = new THREE.MeshStandardMaterial({ color: 0x3f7f6b, roughness: 0.7 });
const GLASS_FRAME_MAT = new THREE.MeshStandardMaterial({ color: 0xd9e6ee, roughness: 0.5 });
const GLASS_MAT = new THREE.MeshStandardMaterial({ color: 0xbfe6f7, roughness: 0.15, transparent: true, opacity: 0.32, depthWrite: false });
/** Het water in een bak van glas: een doorzichtig blok per tegel. */
const TANK_MAT = new THREE.MeshStandardMaterial({ color: 0x4fb4e6, roughness: 0.2, transparent: true, opacity: 0.42, depthWrite: false });
const DARK_MAT = new THREE.MeshStandardMaterial({ color: 0x5a3d22, roughness: 1 });
const std = (color: number, roughness = 0.9): THREE.MeshStandardMaterial => new THREE.MeshStandardMaterial({ color, roughness });

/** Een onderdeel van een bouwsel: vorm, materiaal en of het een schaduw geeft. */
type Part = [THREE.BufferGeometry, THREE.Material, boolean?];

// Slaapplekken. Wanden staan alleen aan de achterkant, zodat je het slapende dier blijft zien.
// een platte rots in twee lagen: de bovenkant is vlak, zodat een dier erop kan liggen
const ROCK_GEO = mergeGeometries([boxAt(0.96, 0.12, 0.88, 0, 0.06, 0), boxAt(0.82, 0.1, 0.74, 0, 0.17, 0)])!;
const TRUNK_GEO = boxAt(0.13, 1.05, 0.13, -0.36, 0.525, -0.36);
const CANOPY_GEO = mergeGeometries([boxAt(0.95, 0.2, 0.95, -0.18, 1.14, -0.18), boxAt(0.6, 0.16, 0.6, -0.2, 1.32, -0.2)])!;
const NEST_GEO = mergeGeometries([
  boxAt(0.66, 0.05, 0.66, 0, 0.025, 0),
  boxAt(0.8, 0.13, 0.13, 0, 0.065, -0.34),
  boxAt(0.8, 0.13, 0.13, 0, 0.065, 0.34),
  boxAt(0.13, 0.13, 0.58, -0.34, 0.065, 0),
  boxAt(0.13, 0.13, 0.58, 0.34, 0.065, 0),
])!;
const EGG_GEO = mergeGeometries([boxAt(0.1, 0.1, 0.1, -0.1, 0.1, 0.05), boxAt(0.1, 0.1, 0.1, 0.08, 0.1, -0.06)])!;
const CAVE_FLOOR_GEO = boxAt(0.84, 0.03, 0.84, 0, 0.015, 0);
const CAVE_GEO = mergeGeometries([
  boxAt(0.98, 0.62, 0.16, 0, 0.31, -0.41),
  boxAt(0.16, 0.62, 0.9, -0.41, 0.31, 0.04),
  boxAt(0.18, 0.62, 0.18, 0.4, 0.31, -0.4),
  boxAt(1.06, 0.18, 0.62, -0.02, 0.7, -0.2),
  boxAt(0.6, 0.18, 0.5, -0.24, 0.7, 0.26),
  boxAt(0.56, 0.14, 0.4, -0.12, 0.86, -0.2),
])!;
const CLIMB_GEO = mergeGeometries([
  boxAt(0.17, 1.25, 0.17, -0.3, 0.625, -0.3),
  boxAt(0.78, 0.07, 0.36, 0.02, 0.6, -0.3),
  boxAt(0.36, 0.07, 0.78, -0.3, 0.9, 0.02),
  boxAt(0.035, 0.42, 0.035, 0.32, 0.38, -0.3),
  boxAt(0.2, 0.05, 0.12, 0.32, 0.17, -0.3),
])!;
const CLIMB_LEAF_GEO = mergeGeometries([boxAt(0.56, 0.2, 0.56, -0.3, 1.34, -0.3), boxAt(0.34, 0.14, 0.34, -0.3, 1.5, -0.3)])!;
const BED_PARTS: Record<BedKind, Part[]> = {
  straw: [[STRAW_GEO, STRAW_MAT, false]],
  shed: [[STRAW_GEO, STRAW_MAT, false], [SHED_WALL_GEO, WOOD_MAT], [SHED_ROOF_GEO, ROOF_MAT]],
  rock: [[ROCK_GEO, ROCK_MAT]],
  shade: [[TRUNK_GEO, WOOD_MAT], [CANOPY_GEO, LEAF_MAT]],
  nest: [[NEST_GEO, std(0xb98a4a, 1)], [EGG_GEO, WHITE_MAT]],
  cave: [[CAVE_FLOOR_GEO, DARK_MAT, false], [CAVE_GEO, ROCK_MAT]],
  climb: [[CLIMB_GEO, WOOD_MAT], [CLIMB_LEAF_GEO, LEAF_MAT]],
  // koraal: een platte steen met roze en oranje takken, laag genoeg om onder water te staan
  coral: [
    [boxAt(0.8, 0.08, 0.7, 0, 0.04, 0), ROCK_MAT],
    [mergeGeometries([boxAt(0.07, 0.3, 0.07, -0.22, 0.2, -0.12), boxAt(0.18, 0.06, 0.06, -0.15, 0.3, -0.12), boxAt(0.06, 0.16, 0.06, -0.08, 0.36, -0.12), boxAt(0.07, 0.24, 0.07, 0.24, 0.17, 0.14), boxAt(0.06, 0.06, 0.16, 0.24, 0.26, 0.2)])!, std(0xf06aa6, 0.8)],
    [mergeGeometries([boxAt(0.08, 0.26, 0.08, 0.08, 0.18, -0.18), boxAt(0.2, 0.06, 0.06, 0.16, 0.28, -0.18), boxAt(0.06, 0.14, 0.06, 0.24, 0.33, -0.18), boxAt(0.07, 0.18, 0.07, -0.2, 0.14, 0.2)])!, std(0xf08a24, 0.8)],
    [mergeGeometries([boxAt(0.14, 0.1, 0.14, 0, 0.12, 0.08), boxAt(0.1, 0.08, 0.1, -0.02, 0.2, 0.1)])!, std(0xffd23f, 0.8)],
  ],
};

// Winkels: gebouwen van 2 bij 2 tegels, en losse dingen als een bankje, bloemen en een afvalbak.
const BENCH_GEO = mergeGeometries([
  boxAt(0.8, 0.06, 0.28, 0, 0.24, 0.02),
  boxAt(0.8, 0.26, 0.05, 0, 0.42, -0.12),
  boxAt(0.07, 0.24, 0.07, -0.33, 0.12, -0.08),
  boxAt(0.07, 0.24, 0.07, 0.33, 0.12, -0.08),
  boxAt(0.07, 0.24, 0.07, -0.33, 0.12, 0.12),
  boxAt(0.07, 0.24, 0.07, 0.33, 0.12, 0.12),
])!;
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

/**
 * Een winkelgebouw van 2 bij 2 tegels. De camera kijkt van rechtsvoor: daarom staan de wanden links en
 * achter, de toonbank rechts en voor, en ligt het dak alleen boven de achterste helft. Zo zie je de
 * verkoper achter de toonbank staan. Het midden van het gebouw is (0, 0).
 */
function booth(wall: number, roofA: number, roofB: number, counter: number, floor = 0xd8c7ab): Part[] {
  const stripes = (from: number): THREE.BufferGeometry =>
    mergeGeometries([0, 1, 2].map(i => boxAt(0.33, 0.09, 1.25, -0.82 + (from + i * 2) * 0.33, 1.34, -0.36)))!;
  return [
    [boxAt(1.84, 0.05, 1.84, 0, 0.025, 0), std(floor, 1), false],
    [mergeGeometries([boxAt(1.84, 1.3, 0.1, 0, 0.65, -0.87), boxAt(0.1, 1.3, 1.74, -0.87, 0.65, 0.05)])!, std(wall)],
    [mergeGeometries([boxAt(1.5, 0.36, 0.26, 0.12, 0.18, 0.74), boxAt(0.26, 0.36, 1.36, 0.74, 0.18, -0.07)])!, std(counter)],
    [mergeGeometries([boxAt(1.56, 0.05, 0.32, 0.12, 0.385, 0.74), boxAt(0.32, 0.05, 1.42, 0.74, 0.385, -0.07)])!, WHITE_MAT],
    [mergeGeometries([boxAt(0.09, 1.3, 0.09, 0.84, 0.65, -0.87), boxAt(0.09, 1.3, 0.09, -0.87, 0.65, 0.84)])!, std(wall)],
    [stripes(0), std(roofA)],
    [mergeGeometries([0, 1, 2].map(i => boxAt(0.33, 0.09, 1.25, -0.82 + (1 + i * 2) * 0.33, 1.34, -0.36)))!, std(roofB)],
  ];
}
/** Spulletjes op de toonbank aan de voorkant. */
const wares = (color: number, h = 0.16): Part =>
  [mergeGeometries([boxAt(0.18, h, 0.16, -0.3, 0.41 + h / 2, 0.74), boxAt(0.18, h * 1.3, 0.16, 0.0, 0.41 + h * 0.65, 0.74), boxAt(0.18, h, 0.16, 0.3, 0.41 + h / 2, 0.74)])!, std(color, 0.7)];
/** Een bestaand bouwsel groter maken (de speeltuin). */
const scaled = (parts: Part[], k: number): Part[] => parts.map(([g, m, shadow]) => [g.clone().scale(k, k, k), m, shadow] as Part);

const SHOP_PARTS: Record<ShopKind, Part[]> = {
  // eetkraam: houten kraam met rood-wit dak en een grote zak friet erop
  foodstall: [
    ...booth(0xc58a4b, 0xe0584f, 0xf7f4ec, 0xa8743f),
    wares(0xf5a623),
    [boxAt(0.56, 0.42, 0.24, 0, 1.6, -0.4), std(0xd8362e)],
    [mergeGeometries([boxAt(0.08, 0.5, 0.08, -0.19, 1.98, -0.4), boxAt(0.08, 0.6, 0.08, -0.065, 2.03, -0.4), boxAt(0.08, 0.54, 0.08, 0.065, 2.0, -0.4), boxAt(0.08, 0.46, 0.08, 0.19, 1.96, -0.4)])!, std(0xffd23f, 0.7)],
  ],
  // drinkkraam: wit met blauw dak en een grote beker met rietje erop
  drinkstall: [
    ...booth(0xf4f1e8, 0x4a90e2, 0x9fd8f5, 0x4a90e2),
    wares(0x9fd8f5, 0.2),
    [tube(0.24, 0.17, 0.5, 0, 1.64, -0.4), std(0xfff7e0, 0.5)],
    [tube(0.26, 0.26, 0.05, 0, 1.91, -0.4), std(0x4a90e2)],
    [boxAt(0.06, 0.46, 0.06, 0.07, 2.13, -0.4), std(0xe0584f)],
  ],
  // ijskraam: roze met een reuzenijsje op het dak
  icecream: [
    ...booth(0xffd9e6, 0xf48fb1, 0xf7f4ec, 0xf48fb1),
    wares(0xfff0c9, 0.14),
    [cone(0.26, 0.6, 0, 1.68, -0.4, 8, true), std(0xe3b778)],
    [ball(0.3, 0, 2.1, -0.4), std(0xffc1d6, 0.6)],
    [ball(0.22, 0, 2.45, -0.4), std(0xfff0c9, 0.6)],
  ],
  // ballonnenkraam: paars met een tros ballonnen aan de hoek
  balloon: [
    ...booth(0xc9a3e8, 0xb06ad9, 0xffd23f, 0xb06ad9),
    [boxAt(0.05, 1.5, 0.05, 0.84, 1.55, 0.84), WHITE_MAT],
    [ball(0.27, 0.6, 2.25, 0.84), std(0xe0584f, 0.4)],
    [ball(0.27, 1.02, 2.3, 0.72), std(0x4a90e2, 0.4)],
    [ball(0.27, 0.84, 2.62, 0.9), std(0xffd23f, 0.4)],
    [ball(0.22, 0.8, 2.1, 1.05), std(0x6cc04a, 0.4)],
  ],
  // hoedjeskraam: groen met een grote strohoed op het dak en hoedjes op de toonbank
  hats: [
    ...booth(0xbfe3a8, 0x6cc04a, 0xf7f4ec, 0x5fa544),
    [tube(0.5, 0.5, 0.06, 0, 1.44, -0.4), std(0xe9d05a, 1)],
    [tube(0.25, 0.28, 0.3, 0, 1.62, -0.4), std(0xe9d05a, 1)],
    [tube(0.285, 0.285, 0.08, 0, 1.52, -0.4), std(0xe0584f)],
    [mergeGeometries([boxAt(0.2, 0.1, 0.2, -0.3, 0.46, 0.74), boxAt(0.2, 0.1, 0.2, 0.3, 0.46, 0.74)])!, std(0xe0584f)],
    [boxAt(0.2, 0.1, 0.2, 0.0, 0.46, 0.74), std(0x4a90e2)],
    [cone(0.09, 0.22, 0.74, 0.52, -0.3), std(0xf06aa6)],
  ],
  // knuffelkraam: geel met paars dak en een grote beer erop
  souvenir: [
    ...booth(0xffe08a, 0x7a5cc9, 0xb99be8, 0x7a5cc9),
    [ball(0.3, 0, 1.66, -0.4), std(0xb07a4a)],
    [ball(0.23, 0, 2.08, -0.4), std(0xb07a4a)],
    [ball(0.09, -0.2, 2.28, -0.4), std(0x8a5a33)],
    [ball(0.09, 0.2, 2.28, -0.4), std(0x8a5a33)],
    [ball(0.1, 0, 2.03, -0.2), std(0xe3bf94)],
    [ball(0.1, -0.3, 0.5, 0.74), std(0xf3a6b8)],
    [ball(0.1, 0.3, 0.5, 0.74), std(0x9aa0a6)],
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
  // speeltuin: zandbak met een torentje, een laddertje en een gele glijbaan
  playground: scaled([
    [boxAt(0.94, 0.03, 0.94, 0, 0.015, 0), std(0xecd591, 1), false],
    [mergeGeometries([boxAt(0.06, 0.92, 0.06, -0.38, 0.46, -0.34), boxAt(0.06, 0.92, 0.06, -0.02, 0.46, -0.34), boxAt(0.06, 0.92, 0.06, -0.38, 0.46, 0.02), boxAt(0.06, 0.92, 0.06, -0.02, 0.46, 0.02), boxAt(0.3, 0.04, 0.04, -0.2, 0.2, -0.36), boxAt(0.3, 0.04, 0.04, -0.2, 0.4, -0.36)])!, WOOD_MAT],
    [boxAt(0.42, 0.06, 0.42, -0.2, 0.58, -0.16), std(0x4a90e2)],
    [cone(0.36, 0.24, -0.2, 1.04, -0.16, 4), std(0xe0584f)],
    [new THREE.BoxGeometry(0.24, 0.04, 0.78).rotateX(0.74).translate(-0.2, 0.31, 0.3), std(0xffd23f, 0.5)],
    [mergeGeometries([boxAt(0.05, 0.4, 0.05, 0.3, 0.2, -0.3), boxAt(0.05, 0.4, 0.05, 0.3, 0.2, 0.1), boxAt(0.05, 0.05, 0.45, 0.3, 0.41, -0.1)])!, std(0xe0584f)],
    [boxAt(0.16, 0.03, 0.1, 0.3, 0.16, -0.1), std(0x4a90e2)],
  ], 1.95),
  bench: [[BENCH_GEO, FENCE_MAT]],
  // bloembak: elke bloem is een steel met een kop, zodat ze los van elkaar kunnen wiegen (zie SHOP_BOB)
  flowers: [
    [boxAt(0.74, 0.2, 0.36, 0, 0.1, 0), WOOD_MAT],
    [boxAt(0.66, 0.04, 0.28, 0, 0.21, 0), DARK_MAT, false],
    [boxAt(0.03, 0.2, 0.03, -0.22, 0.32, 0), STEM_MAT],
    [boxAt(0.14, 0.1, 0.14, -0.22, 0.45, 0), std(0xe0584f)],
    [boxAt(0.03, 0.26, 0.03, 0, 0.35, 0.03), STEM_MAT],
    [boxAt(0.14, 0.1, 0.14, 0, 0.51, 0.03), std(0xffd23f)],
    [boxAt(0.03, 0.2, 0.03, 0.22, 0.32, -0.02), STEM_MAT],
    [boxAt(0.14, 0.1, 0.14, 0.22, 0.45, -0.02), std(0xf06aa6)],
  ],
  // afvalbak: de deksel scharniert om zijn achterrand (zie buildShop)
  bin: [
    [boxAt(0.32, 0.42, 0.32, 0, 0.21, 0), std(0x3d8b5a)],
    [boxAt(0.38, 0.06, 0.38, 0, 0.03, 0.19), std(0x2c6a43)],
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
  frame: [],
  tunnel: [],
  ball: [
    [ball(0.2, -0.08, 0.2, 0), std(0xe0584f, 0.5)],
    [tube(0.203, 0.203, 0.07, -0.08, 0.2, 0), WHITE_MAT],
    [ball(0.12, 0.24, 0.12, 0.18), std(0x4a90e2, 0.5)],
  ],
  bush: [
    [mergeGeometries([ball(0.3, 0, 0.27, 0), ball(0.22, 0.24, 0.2, 0.1), ball(0.2, -0.22, 0.19, -0.12)])!, LEAF_MAT],
    [mergeGeometries([ball(0.05, 0.12, 0.42, 0.2), ball(0.05, -0.16, 0.36, 0.14), ball(0.05, 0.02, 0.5, -0.12), ball(0.05, 0.3, 0.3, -0.02)])!, std(0xe0584f, 0.5)],
  ],
  log: [
    [new THREE.CylinderGeometry(0.15, 0.15, 0.82, 10).rotateZ(Math.PI / 2).rotateY(0.5).translate(0, 0.15, 0.08), WOOD_MAT],
    [tube(0.13, 0.15, 0.3, -0.22, 0.15, -0.28), WOOD_MAT],
    [tube(0.115, 0.115, 0.02, -0.22, 0.31, -0.28), std(0xe3c08a, 1)],
  ],
  // hoepel: een rode ring op een paal; een dolfijn springt erdoorheen
  hoop: [
    [mergeGeometries([tube(0.035, 0.045, 0.7, 0, 0.35, 0), tube(0.14, 0.16, 0.05, 0, 0.025, 0)])!, std(0x8a8f98, 0.6)],
    [new THREE.TorusGeometry(0.4, 0.045, 8, 22).translate(0, 1.12, 0), std(0xe0584f, 0.5)],
    [new THREE.TorusGeometry(0.4, 0.05, 6, 22, Math.PI / 5).translate(0, 1.12, 0), WHITE_MAT],
  ],
  flowerbed: [
    [boxAt(0.82, 0.05, 0.82, 0, 0.025, 0), DARK_MAT, false],
    [mergeGeometries([boxAt(0.03, 0.2, 0.03, -0.24, 0.15, -0.2), boxAt(0.03, 0.26, 0.03, 0.2, 0.18, -0.16), boxAt(0.03, 0.18, 0.03, -0.1, 0.14, 0.22), boxAt(0.03, 0.24, 0.03, 0.24, 0.17, 0.22), boxAt(0.03, 0.2, 0.03, 0, 0.15, 0)])!, STEM_MAT],
    [mergeGeometries([boxAt(0.14, 0.1, 0.14, -0.24, 0.3, -0.2), boxAt(0.14, 0.1, 0.14, 0.24, 0.34, 0.22)])!, std(0xe0584f)],
    [mergeGeometries([boxAt(0.14, 0.1, 0.14, 0.2, 0.36, -0.16), boxAt(0.14, 0.1, 0.14, 0, 0.3, 0)])!, std(0xffd23f)],
    [boxAt(0.14, 0.1, 0.14, -0.1, 0.28, 0.22), std(0xf06aa6)],
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
const horse = (x: number, z: number): THREE.BufferGeometry =>
  mergeGeometries([
    boxAt(0.3, 0.15, 0.13, 0, 0.47, 0), boxAt(0.1, 0.2, 0.11, 0.17, 0.6, 0), boxAt(0.14, 0.09, 0.1, 0.24, 0.66, 0),
    boxAt(0.05, 0.2, 0.05, -0.1, 0.3, 0), boxAt(0.05, 0.2, 0.05, 0.1, 0.3, 0), boxAt(0.05, 0.16, 0.05, -0.17, 0.5, 0),
  ])!.scale(1.3, 1.3, 1.3).rotateY(Math.atan2(-z, x) + Math.PI / 2).translate(x, -0.08, z);
SHOP_PARTS.fountain = [
  [boxAt(1.84, 0.05, 1.84, 0, 0.025, 0), std(0xd8c7ab, 1), false],
  [tube(0.86, 0.9, 0.24, 0, 0.17, 0), STONE],
  [tube(0.74, 0.74, 0.05, 0, 0.28, 0), WATER_MAT, false],
  [tube(0.11, 0.15, 0.56, 0, 0.56, 0), STONE],
  [tube(0.42, 0.16, 0.14, 0, 0.9, 0), STONE],
  [tube(0.36, 0.36, 0.04, 0, 0.97, 0), WATER_MAT, false],
  // vier straaltjes die van de bovenste schaal in het bassin vallen
  [mergeGeometries(around(4, 0.4, (x, z) => boxAt(0.06, 0.62, 0.06, x, 0.62, z)))!, SPRAY_MAT, false],
];
SHOP_PARTS.carousel = [
  [boxAt(1.84, 0.05, 1.84, 0, 0.025, 0), std(0xd8c7ab, 1), false],
  [tube(0.9, 0.92, 0.12, 0, 0.11, 0), std(0xe0584f)],
  [tube(0.09, 0.09, 1.9, 0, 1.1, 0), WHITE_MAT],
];
const SHOP_MOVING: Partial<Record<ShopKind, { y: number; parts: Part[] }>> = {
  fountain: {
    y: 0.97,
    parts: [
      [tube(0.05, 0.08, 0.6, 0, 0.3, 0), SPRAY_MAT, false],
      [mergeGeometries([ball(0.07, 0, 0.64, 0), ball(0.05, 0.12, 0.5, 0.04), ball(0.05, -0.1, 0.46, -0.08), ball(0.04, 0.03, 0.42, 0.13)])!, SPRAY_MAT, false],
    ],
  },
  carousel: {
    y: 0,
    parts: [
      [tube(0.84, 0.84, 0.06, 0, 0.2, 0), GOLD_MAT],
      [mergeGeometries(around(4, 0.56, (x, z) => tube(0.022, 0.022, 1.75, x, 1.08, z)))!, GOLD_MAT],
      [tube(0.92, 0.92, 0.14, 0, 1.98, 0), WHITE_MAT],
      [cone(0.95, 0.46, 0, 2.28, 0, 10), std(0xe0584f)],
      [ball(0.1, 0, 2.55, 0), GOLD_MAT],
      [mergeGeometries([horse(0, 0.56), horse(0, -0.56)])!, std(0xb07a4a)],
      [mergeGeometries([horse(0.56, 0), horse(-0.56, 0)])!, WHITE_MAT],
    ],
  },
};
// De voersilo: een ronde toren met een rood dak en een bakje ervoor waar de dieren uit eten.
const SILO_GEO = tube(0.24, 0.24, 0.85, 0, 0.475, -0.2);
const SILO_ROOF_GEO = cone(0.3, 0.24, 0, 1.02, -0.2);
const SILO_TRAY_GEO = TROUGH_GEO.clone().scale(0.75, 0.8, 0.55).translate(0, 0, 0.26);
const SILO_MAT = std(0xd9dde2, 0.5);
// Losse speeltoestellen van 2 bij 2 tegels. Wat beweegt (de zitjes van de schommel, de plank van de wipwap,
// de wipkippen) staat in SHOP_MOVING en draait om het midden op hoogte `y`.
const PLAY_FLOOR: Part = [boxAt(1.84, 0.04, 1.84, 0, 0.02, 0), std(0xe9b66b, 1), false];
const METAL = std(0x8a8f98, 0.6);
const P_RED = std(0xe0584f), P_BLUE = std(0x4a90e2), P_YELLOW = std(0xffd23f, 0.6);
SHOP_PARTS.slide = [
  PLAY_FLOOR,
  [mergeGeometries([
    boxAt(0.07, 1.5, 0.07, -0.25, 0.75, -0.75), boxAt(0.07, 1.5, 0.07, 0.25, 0.75, -0.75), boxAt(0.07, 1.5, 0.07, -0.25, 0.75, -0.25), boxAt(0.07, 1.5, 0.07, 0.25, 0.75, -0.25),
    ...[0.25, 0.5, 0.75, 1.0].map(y => boxAt(0.5, 0.045, 0.045, 0, y, -0.79)),
  ])!, WOOD_MAT],
  [boxAt(0.58, 0.06, 0.58, 0, 1.15, -0.5), P_BLUE],
  [cone(0.48, 0.3, 0, 1.66, -0.5, 4), P_RED],
  [new THREE.BoxGeometry(0.42, 0.05, 1.58).rotateX(0.727).translate(0, 0.62, 0.31), P_YELLOW],
  [mergeGeometries([new THREE.BoxGeometry(0.04, 0.13, 1.58).rotateX(0.727).translate(-0.22, 0.68, 0.31), new THREE.BoxGeometry(0.04, 0.13, 1.58).rotateX(0.727).translate(0.22, 0.68, 0.31)])!, P_RED],
];
SHOP_PARTS.swing = [
  PLAY_FLOOR,
  [mergeGeometries([-0.84, 0.84].flatMap(x => [
    new THREE.BoxGeometry(0.07, 1.57, 0.07).rotateX(-0.285).translate(x, 0.75, 0.22),
    new THREE.BoxGeometry(0.07, 1.57, 0.07).rotateX(0.285).translate(x, 0.75, -0.22),
  ]))!, P_RED],
  [boxAt(1.78, 0.07, 0.07, 0, 1.5, 0), P_RED],
];
SHOP_MOVING.swing = {
  y: 1.5,
  parts: [
    [mergeGeometries([-0.36, 0.36].flatMap(x => [boxAt(0.02, 1.13, 0.02, x - 0.14, -0.565, 0), boxAt(0.02, 1.13, 0.02, x + 0.14, -0.565, 0)]))!, METAL],
    [boxAt(0.34, 0.04, 0.16, -0.36, -1.15, 0), P_BLUE],
    [boxAt(0.34, 0.04, 0.16, 0.36, -1.15, 0), P_YELLOW],
  ],
};
SHOP_PARTS.seesaw = [PLAY_FLOOR, [mergeGeometries([boxAt(0.16, 0.4, 0.34, 0, 0.2, 0), boxAt(0.3, 0.06, 0.4, 0, 0.03, 0)])!, P_RED]];
SHOP_MOVING.seesaw = {
  y: 0.42,
  parts: [
    [boxAt(1.62, 0.06, 0.24, 0, 0, 0), P_YELLOW],
    [mergeGeometries([-0.44, 0.44].flatMap(x => [boxAt(0.035, 0.22, 0.035, x, 0.13, 0), boxAt(0.035, 0.035, 0.24, x, 0.24, 0)]))!, P_RED],
    [mergeGeometries([boxAt(0.26, 0.03, 0.24, -0.67, 0.045, 0), boxAt(0.26, 0.03, 0.24, 0.67, 0.045, 0)])!, P_BLUE],
  ],
};
const rider = (x: number): THREE.BufferGeometry[] => [boxAt(0.2, 0.2, 0.52, x, 0.14, 0), boxAt(0.17, 0.24, 0.17, x, 0.36, 0.22), boxAt(0.07, 0.18, 0.06, x, 0.3, -0.28)];
SHOP_PARTS.springer = [
  PLAY_FLOOR,
  [mergeGeometries([tube(0.07, 0.07, 0.3, -0.42, 0.17, 0), tube(0.07, 0.07, 0.3, 0.42, 0.17, 0), tube(0.16, 0.16, 0.03, -0.42, 0.045, 0), tube(0.16, 0.16, 0.03, 0.42, 0.045, 0)])!, METAL],
];
SHOP_MOVING.springer = {
  y: 0.3,
  parts: [
    [mergeGeometries(rider(-0.42))!, P_RED],
    [mergeGeometries(rider(0.42))!, P_BLUE],
    [mergeGeometries([-0.42, 0.42].flatMap(x => [boxAt(0.08, 0.06, 0.1, x, 0.34, 0.35), boxAt(0.32, 0.03, 0.03, x, 0.44, 0.1)]))!, P_YELLOW],
  ],
};
SHOP_PARTS.trampoline = [
  PLAY_FLOOR,
  [mergeGeometries(around(6, 0.7, (x, z) => boxAt(0.05, 0.34, 0.05, x, 0.17, z)))!, METAL],
  [tube(0.8, 0.8, 0.07, 0, 0.36, 0), P_BLUE],
  [tube(0.64, 0.64, 0.02, 0, 0.4, 0), std(0x3d4f5a, 0.8), false],
];
/** Het licht van een lantaarn: overdag een zacht geel, 's nachts fel. */
const LAMP_MAT = new THREE.MeshStandardMaterial({ color: 0xfff1a8, emissive: 0xffd23f, emissiveIntensity: 0.6, roughness: 0.4 });
const FLAME_MAT = new THREE.MeshStandardMaterial({ color: 0xf08a24, emissive: 0xf06a10, emissiveIntensity: 0.9, roughness: 0.6 });
const FLAME2_MAT = new THREE.MeshStandardMaterial({ color: 0xffd23f, emissive: 0xffc21f, emissiveIntensity: 0.9, roughness: 0.6 });
// Versieringen: één tegel groot, het midden is (0, 0).
const LEAF2 = std(0x468f3e, 1);
const flowersOn = (spots: [number, number, number][], color: number): Part =>
  [mergeGeometries(spots.map(([x, y, z]) => boxAt(0.13, 0.1, 0.13, x, y, z)))!, std(color)];

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
/** De kleur van gras en bosgrond in dit seizoen: geel in de herfst, bijna wit in de winter. `out` heeft de zomerkleur al. */
function groundColor(out: THREE.Color, season: Season): THREE.Color {
  if (season === 'spring') return out.lerp(MIX.setHex(0x92dc5e), 0.22);
  if (season === 'autumn') return out.lerp(MIX.setHex(0xd9b84a), 0.45);
  if (season === 'winter') return out.lerp(MIX.setHex(0xf4f8fc), 0.82);
  return out;
}
const SEASONAL_IDS = new Set(SEASONAL.map(k => TERRAINS.indexOf(k)));
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
// Kruinen van de loofboom en de den in drie vormen; elke boom kiest er een (zie View.varyTree).
type Blob = [number, number, number, number];
const TREE_BLOBS: Blob[][] = [
  [[0.4, 0, 0.9, 0], [0.28, 0.2, 1.2, 0.08], [0.26, -0.22, 1.12, -0.1]],
  [[0.34, 0, 0.88, 0], [0.3, 0.02, 1.22, 0.02], [0.2, 0, 1.5, 0]],
  [[0.36, -0.14, 0.86, 0.06], [0.34, 0.18, 0.9, -0.08], [0.26, 0.02, 1.14, 0]],
];
const TREE_CROWNS = TREE_BLOBS.map(blobs => merge(blobs.map(b => ball(...b))));
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
  tree: { leaf: [1], crown: [1] },
  pine: { leaf: [1], crown: [1] },
  palm: { leaf: [1], crown: [] },
  cherry: { leaf: [1, 2], crown: [1, 2] },
  bamboogrove: { leaf: [0, 1], crown: [] },
  topiary: { leaf: [2], crown: [2] },
  cactus: { leaf: [0, 1], crown: [] },
};

// ------------------------------------------------------------ de nieuwere gebouwen
const floorOf = (color = 0xd8c7ab): Part => [boxAt(1.84, 0.05, 1.84, 0, 0.025, 0), std(color, 1), false];
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
  ])), WHITE_MAT],
  [cone(0.98, 0.45, 0, TOWER_ROOF + 0.225, 0, 4), P_RED],
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
  ...RESTAURANT_TABLES.map(([x, z], i): Part => [cone(0.36, 0.2, x, 1.42, z), [P_RED, P_YELLOW, P_BLUE][i % 3]]),
];
// Reuzenrad: twee steunen tot aan de as; het rad zelf draait (SHOP_MOVING) en ligt in het vlak van x en y.
const CABIN_COLORS = [0xe0584f, 0xffd23f, 0x4a90e2, 0x6cc04a, 0xf48fb1, 0xf08a24];
const cabinAt = (i: number): [number, number] => {
  const a = (i * Math.PI * 2) / FERRIS.cabins;
  return [Math.cos(a) * FERRIS.radius, Math.sin(a) * FERRIS.radius];
};
const CABINS = Array.from({ length: FERRIS.cabins }, (_, i) => cabinAt(i));
SHOP_PARTS.ferris = [
  floorOf(),
  [merge([-0.36, 0.36].flatMap(z => [
    beam(0.1, [-0.75, 0, z], [0, FERRIS.hub + 0.05, z]), beam(0.1, [0.75, 0, z], [0, FERRIS.hub + 0.05, z]),
    boxAt(1.06, 0.07, 0.07, 0, FERRIS.hub * 0.3, z),
  ])), P_BLUE],
  [new THREE.CylinderGeometry(0.06, 0.06, 0.86, 10).rotateX(Math.PI / 2).translate(0, FERRIS.hub, 0), METAL],
  // het opstapje
  [mergeGeometries([boxAt(0.7, 0.14, 0.4, 0, 0.12, 0.66), boxAt(0.5, 0.07, 0.2, 0, 0.085, 0.84)])!, std(0xe3c08a, 1)],
];
SHOP_MOVING.ferris = {
  y: FERRIS.hub,
  parts: [
    [merge([-0.22, 0.22].flatMap(z => [
      new THREE.TorusGeometry(FERRIS.radius, 0.035, 6, 40).translate(0, 0, z),
      new THREE.TorusGeometry(FERRIS.radius * 0.5, 0.025, 6, 28).translate(0, 0, z),
      ...CABINS.map(([x, y]) => beam(0.035, [0, 0, z], [x, y, z])),
    ])), WHITE_MAT],
    [new THREE.CylinderGeometry(0.16, 0.16, 0.56, 12).rotateX(Math.PI / 2), P_RED],
    // het stangetje waar elk bakje aan hangt
    [merge(CABINS.map(([x, y]) => new THREE.CylinderGeometry(0.02, 0.02, 0.46, 6).rotateX(Math.PI / 2).translate(x, y, 0))), METAL],
    // de bakjes: rond, dus het geeft niet dat ze meedraaien
    [merge(CABINS.map(([x, y], i) => paint(new THREE.SphereGeometry(0.2, 12, 8).translate(x, y, 0), CABIN_COLORS[i % CABIN_COLORS.length]))), PAINT_MAT],
  ],
};
// Botsauto's: een gladde vloer met een rubberen rand en een licht dak op vier palen. De auto's zelf zijn los
// (zie buildShop): het spel laat ze rijden.
SHOP_PARTS.bumper = [
  [boxAt(1.84, 0.05, 1.84, 0, 0.025, 0), std(0x6a7480, 0.5), false],
  [mergeGeometries([boxAt(1.84, 0.12, 0.08, 0, 0.11, -0.88), boxAt(1.84, 0.12, 0.08, 0, 0.11, 0.88), boxAt(0.08, 0.12, 1.68, -0.88, 0.11, 0), boxAt(0.08, 0.12, 1.68, 0.88, 0.11, 0)])!, std(0x2b2f36, 0.8)],
  [mergeGeometries([boxAt(1.84, 0.025, 0.08, 0, 0.18, -0.88), boxAt(1.84, 0.025, 0.08, 0, 0.18, 0.88), boxAt(0.08, 0.025, 1.68, -0.88, 0.18, 0), boxAt(0.08, 0.025, 1.68, 0.88, 0.18, 0)])!, P_YELLOW],
  [mergeGeometries(CORNERS.map(([x, z]) => boxAt(0.08, 1.4, 0.08, x * 0.86, 0.7, z * 0.86)))!, P_RED],
  [merge([
    boxAt(1.8, 0.05, 0.05, 0, 1.42, -0.86), boxAt(1.8, 0.05, 0.05, 0, 1.42, 0.86), boxAt(0.05, 0.05, 1.8, -0.86, 1.42, 0), boxAt(0.05, 0.05, 1.8, 0.86, 1.42, 0),
    beam(0.035, [-0.86, 1.42, -0.86], [0.86, 1.42, 0.86]), beam(0.035, [0.86, 1.42, -0.86], [-0.86, 1.42, 0.86]),
  ]), METAL],
  [merge([...CORNERS.map(([x, z]) => ball(0.07, x * 0.86, 1.5, z * 0.86)), ball(0.08, 0, 1.4, 0)]), LAMP_MAT, false],
];
const CAR_PARTS = (color: THREE.Material): Part[] => [
  [CAR_RUBBER_GEO, CAR_RUBBER_MAT],
  [CAR_BODY_GEO, color],
  [CAR_TRIM_GEO, METAL],
];
const CAR_RUBBER_MAT = std(0x2b2f36, 0.8);
const CAR_RUBBER_GEO = new THREE.CylinderGeometry(0.16, 0.16, 0.05, 12).scale(1, 1, 1.32).translate(0, 0.035, 0);
const CAR_BODY_GEO = mergeGeometries([
  new THREE.CylinderGeometry(0.115, 0.145, 0.1, 12).scale(1, 1, 1.32).translate(0, 0.1, 0),
  boxAt(0.2, 0.12, 0.04, 0, 0.2, -0.15),
])!;
// het stuur, een sprietje met een bolletje en een koplamp
const CAR_TRIM_GEO = merge([
  beam(0.018, [0, 0.14, 0.08], [0, 0.27, 0.03]), boxAt(0.1, 0.022, 0.022, 0, 0.275, 0.03),
  boxAt(0.014, 0.4, 0.014, 0, 0.42, -0.17), ball(0.03, 0, 0.63, -0.17), ball(0.03, 0, 0.11, 0.2),
]);
const CAR_COLORS = [P_RED, P_BLUE, P_YELLOW, P_GREEN];
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
  foodstall: [{ parts: [8, 9], at: [0, 1.39, -0.4] }],
  drinkstall: [{ parts: [8, 9, 10], at: [0, 1.39, -0.4] }],
  icecream: [{ parts: [8, 9, 10], at: [0, 1.39, -0.4] }],
  balloon: [8, 9, 10, 11].map((i): Bob => ({ parts: [i], at: [0.84, 1.9, 0.84], amp: 0.03, sway: 0.09 })),
  hats: [{ parts: [7, 8, 9], at: [0, 1.41, -0.4] }],
  souvenir: [{ parts: [7, 8, 9, 10, 11], at: [0, 1.39, -0.4] }],
  flowers: [0, 1, 2].map((i): Bob => ({ parts: [2 + i * 2, 3 + i * 2], at: [-0.22 + i * 0.22, 0.22, 0], amp: 0, sway: 0.1 })),
  playground: [{ parts: [3], at: [-0.39, 1.79, -0.31], amp: 0.02, sway: 0.03 }],
  tower: [{ parts: [6], at: [0, TOWER_ROOF + 0.72, 0], amp: 0, sway: 0, yaw: 0.5 }],
  restaurant: RESTAURANT_TABLES.map(([x, z], i): Bob => ({ parts: [10 + i], at: [x, 1.32, z], amp: 0.012, sway: 0.05 })),
  station: [{ parts: [8, 9], at: [SIGN_AT[0], 1.3, SIGN_AT[2]], amp: 0, sway: 0.07 }],
  umbrellas: [{ parts: [2, 3, 4, 5], at: [0, 0.3, 0], amp: 0, sway: 0.06 }],
};
// De wc-deuren: elk om zijn buitenste rand, met de klink aan de binnenkant.
const DOOR_GEOS = [-1, 1].map(side => boxAt(0.5, 0.86, 0.05, -side * 0.25, 0.45, 0));
const KNOB_GEOS = [-1, 1].map(side => boxAt(0.07, 0.07, 0.05, -side * 0.41, 0.45, 0.04));

// ------------------------------------------------------------ meer voor in een verblijf
const HILL = TOY_LIFT.hill ?? 0.34, ROCKS = TOY_LIFT.rocks ?? 0.3, FRAME = TOY_LIFT.frame ?? 0.8;
// heuvel: een bult gras met een vlak plekje bovenop
TOY_PARTS.hill = [
  [mergeGeometries([tube(0.36, 0.48, 0.14, 0, 0.07, 0), tube(0.26, 0.36, 0.12, 0, 0.2, 0), tube(0.2, 0.26, 0.08, 0, 0.3, 0)])!.scale(1, HILL / 0.34, 1), std(0x7cc053, 1)],
  [mergeGeometries([boxAt(0.05, 0.1, 0.05, 0.34, 0.18, 0.12), boxAt(0.05, 0.08, 0.05, -0.3, 0.17, -0.2), boxAt(0.05, 0.09, 0.05, -0.1, 0.17, 0.36), boxAt(0.05, 0.08, 0.05, 0.22, 0.29, -0.16)])!, LEAF2],
  flowersOn([[-0.36, 0.17, 0.14], [0.14, 0.17, -0.38]], 0xffd23f),
];
// rotsen: platte keien op elkaar, de bovenste is vlak
TOY_PARTS.rocks = [
  [mergeGeometries([boxAt(0.84, 0.14, 0.72, 0, 0.07, 0), boxAt(0.3, 0.2, 0.26, 0.3, 0.1, 0.3)])!, ROCK_MAT],
  [mergeGeometries([boxAt(0.58, ROCKS - 0.14, 0.52, -0.06, (ROCKS + 0.14) / 2, -0.04), boxAt(0.22, 0.16, 0.2, -0.34, 0.08, 0.32)])!, STONE_MAT],
];
// drinkvijver: een rand van keien met water erin (het water als laatste, dat kan rimpelen)
TOY_PARTS.drink = [
  [mergeGeometries([tube(0.38, 0.42, 0.1, 0, 0.05, 0), ...around(7, 0.36, (x, z) => boxAt(0.14, 0.07, 0.14, x, 0.11, z))])!, STONE],
  [tube(0.3, 0.3, 0.02, 0, 0.105, 0), WATER_MAT, false],
];
// waterval: een rots met een bakje ervoor; het vallende water als laatste
TOY_PARTS.fall = [
  [mergeGeometries([boxAt(0.7, 0.4, 0.3, 0, 0.2, -0.3), boxAt(0.5, 0.3, 0.26, -0.04, 0.55, -0.32), boxAt(0.24, 0.14, 0.2, 0.22, 0.47, -0.3)])!, ROCK_MAT],
  [tube(0.32, 0.34, 0.08, 0, 0.04, 0.12), STONE],
  [tube(0.27, 0.27, 0.02, 0, 0.085, 0.12), WATER_MAT, false],
  [boxAt(0.18, 0.03, 0.2, -0.04, 0.715, -0.26), WATER_MAT, false],
  [boxAt(0.18, 0.64, 0.04, -0.04, 0.4, -0.165), SPRAY_MAT, false],
];
// warmtelamp: een paal met een hangende lamp die oranjerood gloeit, en een warme gloed op de grond
const HEAT_MAT = new THREE.MeshStandardMaterial({ color: 0xff6a3a, emissive: 0xff3a10, emissiveIntensity: 1.3, roughness: 0.4 });
const GLOW_MAT = new THREE.MeshBasicMaterial({ color: 0xff8a3a, transparent: true, opacity: 0.28, depthWrite: false });
TOY_PARTS.lamp = [
  [merge([tube(0.03, 0.04, 1.05, -0.34, 0.525, -0.2), tube(0.1, 0.12, 0.05, -0.34, 0.025, -0.2), beam(0.04, [-0.34, 1.03, -0.2], [0.02, 1.03, 0.01]), boxAt(0.02, 0.12, 0.02, 0, 0.97, 0)]), std(0x3d4f5a, 0.7)],
  [cone(0.17, 0.14, 0, 0.86, 0), std(0xc9553f, 0.6)],
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
  [mergeGeometries([
    boxAt(0.4, 0.05, 0.36, -0.12, 0.425, -0.08),
    new THREE.BoxGeometry(0.22, 0.04, 0.22).rotateY(0.5).translate(0.24, 0.28, 0.2),
    tube(0.44, 0.47, 0.02, 0, 0.01, 0),
  ])!, WHITE_MAT, false],
];
// klimrek: een vlonder op vier palen (bovenop is het vrij: daar staat een dier), een ladder, sporten en een touw
TOY_PARTS.frame = [
  [merge([
    ...CORNERS.map(([x, z]) => boxAt(0.08, FRAME - 0.06, 0.08, x * 0.37, (FRAME - 0.06) / 2, z * 0.37)),
    ...[0.25, 0.5].flatMap(y => [boxAt(0.74, 0.04, 0.04, 0, y, -0.37), boxAt(0.04, 0.04, 0.74, -0.37, y, 0)]),
    beam(0.04, [-0.14, 0, 0.48], [-0.14, FRAME - 0.03, 0.45]), beam(0.04, [0.14, 0, 0.48], [0.14, FRAME - 0.03, 0.45]),
    ...[0.16, 0.32, 0.48, 0.64].map(y => boxAt(0.3, 0.035, 0.035, 0, y, 0.475)),
  ]), WOOD_MAT],
  [boxAt(0.86, 0.06, 0.86, 0, FRAME - 0.03, 0), std(0xe3c08a, 1)],
  [mergeGeometries([boxAt(0.025, 0.56, 0.025, 0.45, FRAME - 0.3, 0.1), boxAt(0.06, 0.06, 0.06, 0.45, FRAME - 0.58, 0.1), boxAt(0.08, 0.03, 0.03, 0.43, FRAME - 0.015, 0.1)])!, std(0xe8dcc0, 1)],
];
// tunnel: een boog van planken, open aan de twee korte kanten (hij ligt langs x)
const tunnelArch = (odd: number): THREE.BufferGeometry =>
  mergeGeometries([-75, -50, -25, 0, 25, 50, 75].filter((_, i) => i % 2 === odd).map(deg =>
    new THREE.BoxGeometry(0.9, 0.07, 0.19).translate(0, 0.38, 0).rotateX((deg * Math.PI) / 180).translate(0, 0.04, 0)))!;
TOY_PARTS.tunnel = [
  [tunnelArch(0), WOOD_MAT],
  [tunnelArch(1), FENCE_MAT],
  [mergeGeometries([boxAt(0.9, 0.08, 0.1, 0, 0.04, -0.39), boxAt(0.9, 0.08, 0.1, 0, 0.04, 0.39)])!, DARK_MAT],
];
const DECOR_PARTS: Record<DecorKind, Part[]> = {
  tree: [
    [boxAt(0.16, 0.6, 0.16, 0, 0.3, 0), WOOD_MAT],
    [TREE_CROWNS[0], LEAF_MAT],
  ],
  pine: [
    [boxAt(0.12, 0.3, 0.12, 0, 0.15, 0), WOOD_MAT],
    [PINE_CROWNS[0], LEAF2],
  ],
  palm: [
    [tube(0.055, 0.085, 1.1, 0, 0.55, 0), std(0xb88a52, 1)],
    [mergeGeometries([0, 1, 2, 3, 4, 5].map(i => new THREE.BoxGeometry(0.56, 0.04, 0.16).translate(0.3, 0, 0).rotateZ(-0.35).rotateY((i * Math.PI) / 3).translate(0, 1.12, 0)))!, PALM_MAT],
    [mergeGeometries([ball(0.07, 0.07, 1.04, 0.03), ball(0.07, -0.05, 1.02, -0.05)])!, std(0x6b4a2a)],
  ],
  hedge: [
    [boxAt(0.92, 0.42, 0.4, 0, 0.21, 0), LEAF2],
    [boxAt(0.86, 0.1, 0.34, 0, 0.45, 0), LEAF_MAT],
  ],
  roses: [
    [boxAt(0.8, 0.05, 0.8, 0, 0.025, 0), DARK_MAT, false],
    [mergeGeometries([ball(0.16, -0.2, 0.2, -0.18), ball(0.18, 0.2, 0.22, 0.14), ball(0.15, -0.14, 0.19, 0.24), ball(0.15, 0.22, 0.19, -0.22)])!, LEAF2],
    flowersOn([[-0.2, 0.38, -0.18], [0.2, 0.42, 0.14], [0.26, 0.36, -0.22]], 0xd8362e),
    flowersOn([[-0.14, 0.36, 0.24], [0.1, 0.4, 0.2]], 0xf06aa6),
    flowersOn([[-0.26, 0.34, -0.1]], 0xf7f4ec),
  ],
  tulips: [
    [boxAt(0.8, 0.05, 0.5, 0, 0.025, 0), DARK_MAT, false],
    [mergeGeometries([-0.3, -0.15, 0, 0.15, 0.3].flatMap(x => [boxAt(0.025, 0.24, 0.025, x, 0.17, -0.12), boxAt(0.025, 0.22, 0.025, x, 0.16, 0.12)]))!, STEM_MAT],
    flowersOn([[-0.3, 0.33, -0.12], [0, 0.33, -0.12], [0.3, 0.33, -0.12]], 0xe0584f),
    flowersOn([[-0.15, 0.33, -0.12], [0.15, 0.33, -0.12], [-0.3, 0.31, 0.12], [0.3, 0.31, 0.12]], 0xffd23f),
    flowersOn([[-0.15, 0.31, 0.12], [0, 0.31, 0.12], [0.15, 0.31, 0.12]], 0xb06ad9),
  ],
  mushrooms: [
    [mergeGeometries([tube(0.05, 0.06, 0.2, -0.16, 0.1, 0.06), tube(0.04, 0.05, 0.14, 0.14, 0.07, -0.1), tube(0.035, 0.04, 0.1, 0.1, 0.05, 0.2)])!, WHITE_MAT],
    [mergeGeometries([tube(0.03, 0.17, 0.1, -0.16, 0.25, 0.06), tube(0.025, 0.13, 0.08, 0.14, 0.18, -0.1), tube(0.02, 0.1, 0.07, 0.1, 0.135, 0.2)])!, std(0xd8362e, 0.6)],
  ],
  pond: [
    [tube(0.46, 0.48, 0.09, 0, 0.045, 0), STONE],
    [tube(0.4, 0.4, 0.03, 0, 0.085, 0), WATER_MAT, false],
    [mergeGeometries([tube(0.1, 0.1, 0.012, -0.14, 0.106, 0.1), tube(0.08, 0.08, 0.012, 0.16, 0.106, -0.08), tube(0.06, 0.06, 0.012, 0.04, 0.106, 0.22)])!, STEM_MAT, false],
    [boxAt(0.07, 0.06, 0.07, -0.14, 0.14, 0.1), std(0xf48fb1)],
  ],
  waterfall: [
    [mergeGeometries([boxAt(0.8, 0.5, 0.4, 0, 0.25, -0.22), boxAt(0.6, 0.4, 0.36, -0.06, 0.7, -0.24), boxAt(0.34, 0.26, 0.3, 0.06, 1.02, -0.26)])!, ROCK_MAT],
    [mergeGeometries([boxAt(0.2, 0.74, 0.05, 0.02, 0.66, -0.03), boxAt(0.24, 0.26, 0.05, 0.02, 0.16, 0.0)])!, SPRAY_MAT, false],
    [tube(0.4, 0.42, 0.07, 0, 0.035, 0.18), STONE],
    [tube(0.34, 0.34, 0.03, 0, 0.07, 0.18), WATER_MAT, false],
  ],
  well: [
    [tube(0.3, 0.32, 0.36, 0, 0.18, 0), STONE],
    [tube(0.22, 0.22, 0.03, 0, 0.35, 0), WATER_MAT, false],
    [mergeGeometries([boxAt(0.06, 0.7, 0.06, -0.3, 0.55, 0), boxAt(0.06, 0.7, 0.06, 0.3, 0.55, 0), boxAt(0.66, 0.05, 0.05, 0, 0.78, 0)])!, WOOD_MAT],
    [cone(0.5, 0.3, 0, 1.03, 0, 4), std(0xc9553f)],
    [tube(0.07, 0.06, 0.1, 0, 0.6, 0), std(0x8a857a)],
  ],
  statue: [
    [mergeGeometries([boxAt(0.6, 0.12, 0.6, 0, 0.06, 0), boxAt(0.46, 0.3, 0.46, 0, 0.27, 0)])!, STONE],
    [mergeGeometries([
      boxAt(0.34, 0.2, 0.18, 0, 0.66, 0), boxAt(0.16, 0.18, 0.16, 0.2, 0.82, 0), boxAt(0.2, 0.2, 0.2, 0.2, 0.84, 0).scale(1, 0.5, 1).translate(0, 0.42, 0),
      boxAt(0.06, 0.16, 0.06, -0.12, 0.5, 0.05), boxAt(0.06, 0.16, 0.06, -0.12, 0.5, -0.05), boxAt(0.06, 0.16, 0.06, 0.12, 0.5, 0.05), boxAt(0.06, 0.16, 0.06, 0.12, 0.5, -0.05),
      boxAt(0.05, 0.05, 0.16, -0.2, 0.72, 0).rotateZ(0.3),
    ])!, GOLD_MAT],
  ],
  topiary: [
    [tube(0.18, 0.14, 0.2, 0, 0.1, 0), std(0xc9553f)],
    [boxAt(0.07, 0.4, 0.07, 0, 0.36, 0), WOOD_MAT],
    [mergeGeometries([ball(0.3, 0, 0.7, 0), ball(0.2, 0, 1.08, 0), ball(0.12, 0, 1.34, 0)])!, LEAF2],
  ],
  lantern: [
    [mergeGeometries([tube(0.035, 0.05, 1.05, 0, 0.525, 0), tube(0.1, 0.12, 0.06, 0, 0.03, 0)])!, std(0x3d4f5a, 0.7)],
    // het licht: om zijn eigen midden, zodat het kan flakkeren (zie buildDecor)
    [boxAt(0.17, 0.2, 0.17, 0, 0, 0), LAMP_MAT],
    [cone(0.16, 0.12, 0, 1.31, 0, 4), std(0x3d4f5a, 0.7)],
  ],
  flag: [
    [tube(0.03, 0.035, 1.5, 0, 0.75, 0), WHITE_MAT],
    [boxAt(0.5, 0.3, 0.02, 0.27, 1.3, 0), std(0xe0584f, 0.8)],
    [boxAt(0.5, 0.1, 0.022, 0.27, 1.3, 0), std(0xffd23f, 0.8)],
    [ball(0.05, 0, 1.52, 0), GOLD_MAT],
  ],
  signpost: [
    [boxAt(0.08, 0.95, 0.08, 0, 0.475, 0), WOOD_MAT],
    [boxAt(0.5, 0.14, 0.04, 0.2, 0.82, 0.05), std(0xf7f4ec)],
    [boxAt(0.5, 0.14, 0.04, -0.2, 0.6, 0.05), std(0x9fd8f5)],
  ],
  boulder: [
    [mergeGeometries([boxAt(0.5, 0.32, 0.42, -0.06, 0.16, 0), boxAt(0.3, 0.22, 0.3, 0.24, 0.11, 0.14), boxAt(0.26, 0.16, 0.24, -0.1, 0.38, -0.02)])!, ROCK_MAT],
  ],
  cactus: [
    [mergeGeometries([tube(0.12, 0.13, 0.72, 0, 0.36, 0), tube(0.06, 0.06, 0.28, -0.27, 0.5, 0), tube(0.06, 0.06, 0.22, 0.27, 0.62, 0)])!, CACTUS_MAT],
    [mergeGeometries([boxAt(0.2, 0.09, 0.09, -0.19, 0.38, 0), boxAt(0.2, 0.09, 0.09, 0.19, 0.52, 0)])!, CACTUS_MAT],
    [ball(0.07, 0, 0.76, 0), std(0xf06aa6)],
  ],
  bamboogrove: [
    [mergeGeometries([[-0.24, 1.2, -0.1], [-0.08, 1.4, 0.12], [0.1, 1.1, -0.14], [0.24, 1.3, 0.06], [0, 0.9, 0.24]].map(([x, h, z]) => tube(0.03, 0.036, h, x, h / 2, z)))!, std(0x8cc152, 0.7)],
    [mergeGeometries([[-0.24, 1.2, -0.1], [-0.08, 1.4, 0.12], [0.1, 1.1, -0.14], [0.24, 1.3, 0.06]].flatMap(([x, h, z]) => [boxAt(0.22, 0.03, 0.08, x + 0.1, h - 0.1, z), boxAt(0.08, 0.03, 0.2, x, h - 0.25, z + 0.1)]))!, LEAF_MAT],
  ],
  sunflowers: [
    [boxAt(0.8, 0.05, 0.4, 0, 0.025, 0), DARK_MAT, false],
    [mergeGeometries([-0.26, 0, 0.26].map((x, i) => boxAt(0.035, 0.62 + i * 0.08, 0.035, x, 0.33 + i * 0.04, 0)))!, STEM_MAT],
    [mergeGeometries([-0.26, 0, 0.26].map((x, i) => new THREE.CylinderGeometry(0.14, 0.14, 0.04, 10).rotateX(Math.PI / 2).translate(x, 0.7 + i * 0.08, 0.03)))!, std(0xffd23f)],
    [mergeGeometries([-0.26, 0, 0.26].map((x, i) => new THREE.CylinderGeometry(0.065, 0.065, 0.05, 8).rotateX(Math.PI / 2).translate(x, 0.7 + i * 0.08, 0.04)))!, std(0x6b4a2a)],
  ],
  cherry: [
    [boxAt(0.15, 0.6, 0.15, 0, 0.3, 0), std(0x7a4f2c, 1)],
    [mergeGeometries([ball(0.38, 0, 0.9, 0), ball(0.26, 0.22, 1.16, 0.06)])!, CHERRY_A],
    [mergeGeometries([ball(0.26, -0.22, 1.08, -0.1), ball(0.16, 0.05, 1.36, -0.05)])!, CHERRY_B],
  ],
  pumpkins: [
    [mergeGeometries([ball(0.2, -0.12, 0.17, 0), ball(0.13, 0.2, 0.11, 0.14), ball(0.1, 0.14, 0.085, -0.2)])!, std(0xf08a24, 0.7)],
    [mergeGeometries([boxAt(0.04, 0.08, 0.04, -0.12, 0.38, 0), boxAt(0.03, 0.06, 0.03, 0.2, 0.25, 0.14), boxAt(0.03, 0.05, 0.03, 0.14, 0.19, -0.2)])!, LEAF2],
  ],
  birdbath: [
    [mergeGeometries([tube(0.16, 0.2, 0.08, 0, 0.04, 0), tube(0.06, 0.08, 0.5, 0, 0.33, 0), tube(0.32, 0.14, 0.1, 0, 0.63, 0)])!, STONE],
    [tube(0.27, 0.27, 0.02, 0, 0.685, 0), WATER_MAT, false],
    [mergeGeometries([boxAt(0.1, 0.09, 0.15, 0.14, 0.74, 0.04), boxAt(0.07, 0.07, 0.07, 0.14, 0.81, 0.11)])!, std(0x4a90e2)],
    [boxAt(0.03, 0.03, 0.05, 0.14, 0.8, 0.17), std(0xffd23f)],
  ],
  pump: [
    [boxAt(0.56, 0.07, 0.56, 0, 0.035, 0), STONE],
    [mergeGeometries([boxAt(0.14, 0.72, 0.14, -0.08, 0.43, 0), boxAt(0.24, 0.07, 0.07, 0.08, 0.6, 0), boxAt(0.07, 0.1, 0.07, 0.17, 0.53, 0)])!, std(0x2f6e4f, 0.6)],
    // de zwengel: los en om zijn scharnier, zodat hij op en neer kan (zie buildDecor)
    [new THREE.BoxGeometry(0.05, 0.05, 0.44).translate(0, 0, -0.2), std(0x3d4f5a, 0.6)],
    [tube(0.11, 0.09, 0.15, 0.2, 0.145, 0), WOOD_MAT],
    [tube(0.09, 0.09, 0.02, 0.2, 0.215, 0), WATER_MAT, false],
  ],
  arch: [
    [mergeGeometries([boxAt(0.08, 1.2, 0.08, -0.4, 0.6, 0), boxAt(0.08, 1.2, 0.08, 0.4, 0.6, 0), boxAt(0.96, 0.08, 0.14, 0, 1.22, 0)])!, WHITE_MAT],
    [mergeGeometries([ball(0.13, -0.4, 0.95, 0), ball(0.14, -0.3, 1.26, 0), ball(0.15, 0, 1.32, 0), ball(0.14, 0.3, 1.26, 0), ball(0.13, 0.4, 0.95, 0), ball(0.1, -0.4, 0.6, 0.02), ball(0.1, 0.4, 0.55, 0.02)])!, LEAF_MAT],
    flowersOn([[-0.4, 1.06, 0.08], [0.1, 1.42, 0.06], [0.4, 0.82, 0.08]], 0xf06aa6),
    flowersOn([[-0.2, 1.38, 0.08], [0.34, 1.34, 0.06], [-0.42, 0.72, 0.08]], 0xe0584f),
  ],
  windmill: [
    [tube(0.17, 0.3, 0.9, 0, 0.45, 0), std(0xf3ead6, 0.9)],
    [cone(0.22, 0.24, 0, 1.02, 0), std(0xc9553f)],
    [boxAt(0.14, 0.24, 0.03, 0, 0.12, 0.29), WOOD_MAT],
    // de wieken: los en om hun eigen midden, zodat ze kunnen draaien (zie buildDecor)
    [mergeGeometries([boxAt(0.95, 0.1, 0.02, 0, 0, 0), boxAt(0.1, 0.95, 0.02, 0, 0, 0)])!, WOOD_MAT],
  ],
  scarecrow: [
    [mergeGeometries([boxAt(0.06, 1.0, 0.06, 0, 0.5, 0), boxAt(0.82, 0.06, 0.06, 0, 0.74, 0)])!, WOOD_MAT],
    [boxAt(0.34, 0.36, 0.16, 0, 0.64, 0), std(0xc9553f)],
    [ball(0.15, 0, 0.98, 0), std(0xe8c66a, 1)],
    [mergeGeometries([tube(0.25, 0.25, 0.03, 0, 1.08, 0), tube(0.1, 0.14, 0.16, 0, 1.17, 0)])!, std(0x8a5a2c, 1)],
  ],
  snowman: [
    [mergeGeometries([ball(0.27, 0, 0.25, 0), ball(0.2, 0, 0.62, 0), ball(0.15, 0, 0.9, 0)])!, WHITE_MAT],
    [mergeGeometries([tube(0.17, 0.17, 0.025, 0, 1.02, 0), tube(0.11, 0.11, 0.15, 0, 1.1, 0)])!, std(0x3d4f5a, 0.7)],
    [boxAt(0.05, 0.05, 0.16, 0, 0.9, 0.18), std(0xf08a24)],
    [tube(0.17, 0.17, 0.05, 0, 0.77, 0), std(0xe0584f)],
  ],
  totem: [
    [boxAt(0.36, 0.36, 0.36, 0, 0.18, 0), std(0xe0584f)],
    [boxAt(0.36, 0.36, 0.36, 0, 0.54, 0), std(0xffd23f)],
    [boxAt(0.36, 0.36, 0.36, 0, 0.9, 0), std(0x4a90e2)],
    [boxAt(0.86, 0.12, 0.06, 0, 0.96, -0.02), WOOD_MAT],
    [mergeGeometries([0.2, 0.56, 0.92].flatMap(y => [boxAt(0.08, 0.08, 0.02, -0.08, y, 0.185), boxAt(0.08, 0.08, 0.02, 0.08, y, 0.185)]))!, WHITE_MAT],
  ],
  campfire: [
    [mergeGeometries(around(6, 0.27, (x, z) => boxAt(0.13, 0.09, 0.13, x, 0.045, z)))!, ROCK_MAT],
    [mergeGeometries([new THREE.BoxGeometry(0.44, 0.07, 0.07).rotateY(0.6).translate(0, 0.06, 0), new THREE.BoxGeometry(0.44, 0.07, 0.07).rotateY(-0.6).translate(0, 0.1, 0)])!, WOOD_MAT],
    // de vlammen: los, met hun voet op nul, zodat ze kunnen flakkeren (zie buildDecor)
    [cone(0.13, 0.36, 0, 0.18, 0, 6), FLAME_MAT, false],
    [cone(0.07, 0.24, 0.02, 0.12, 0.02, 6), FLAME2_MAT, false],
  ],
  clocktower: [
    [mergeGeometries([boxAt(0.12, 1.1, 0.12, 0, 0.55, 0), boxAt(0.3, 0.06, 0.3, 0, 0.03, 0)])!, std(0x3d4f5a, 0.7)],
    [boxAt(0.46, 0.46, 0.18, 0, 1.3, 0), std(0x2f6e4f, 0.7)],
    [new THREE.CylinderGeometry(0.18, 0.18, 0.2, 16).rotateX(Math.PI / 2).translate(0, 1.3, 0), WHITE_MAT],
    [mergeGeometries([boxAt(0.03, 0.14, 0.22, 0, 1.36, 0), boxAt(0.1, 0.03, 0.22, 0.04, 1.3, 0)])!, std(0x3a2a1a)],
    [cone(0.3, 0.16, 0, 1.61, 0, 4), std(0xc9553f)],
  ],
  picnic: [
    [mergeGeometries([
      boxAt(0.8, 0.05, 0.4, 0, 0.36, 0), boxAt(0.8, 0.04, 0.16, 0, 0.2, 0.34), boxAt(0.8, 0.04, 0.16, 0, 0.2, -0.34),
      boxAt(0.06, 0.36, 0.7, -0.3, 0.18, 0), boxAt(0.06, 0.36, 0.7, 0.3, 0.18, 0),
    ])!, WOOD_MAT],
    [boxAt(0.3, 0.012, 0.3, 0.05, 0.392, 0), std(0xe0584f)],
  ],
  // gastenboek: een lessenaar met een open boek; één blad is los en kan omslaan (zie buildDecor)
  guestbook: [
    [mergeGeometries([boxAt(0.34, 0.05, 0.34, 0, 0.025, 0), boxAt(0.09, 0.62, 0.09, 0, 0.36, 0), new THREE.BoxGeometry(0.5, 0.05, 0.36).rotateX(0.45).translate(0, 0.7, 0.02)])!, WOOD_MAT],
    [new THREE.BoxGeometry(0.4, 0.03, 0.27).rotateX(0.45).translate(0, 0.736, 0.037), WHITE_MAT],
    [new THREE.BoxGeometry(0.18, 0.006, 0.25).translate(0.09, 0, 0), WHITE_MAT, false],
    [new THREE.BoxGeometry(0.02, 0.034, 0.27).rotateX(0.45).translate(0, 0.737, 0.038), P_RED],
  ],
  // plattegrond: een bord op twee palen met gekleurde vlakken en een rode stip: hier ben jij
  mapboard: [
    [mergeGeometries([boxAt(0.07, 1, 0.07, -0.36, 0.5, 0), boxAt(0.07, 1, 0.07, 0.36, 0.5, 0), boxAt(0.9, 0.06, 0.16, 0, 1.03, 0)])!, WOOD_MAT],
    [boxAt(0.68, 0.5, 0.05, 0, 0.7, 0), std(0xf3ead6)],
    [mergeGeometries([boxAt(0.26, 0.2, 0.06, -0.16, 0.78, 0), boxAt(0.2, 0.14, 0.06, 0.18, 0.58, 0)])!, std(0x86c95c)],
    [mergeGeometries([boxAt(0.18, 0.12, 0.06, 0.2, 0.82, 0), boxAt(0.1, 0.1, 0.06, -0.24, 0.56, 0)])!, std(0x6ec3e8)],
    [mergeGeometries([boxAt(0.34, 0.035, 0.06, -0.02, 0.66, 0), boxAt(0.035, 0.18, 0.06, 0.04, 0.57, 0)])!, std(0xe3ca82)],
    [boxAt(0.07, 0.07, 0.08, 0.04, 0.66, 0), std(0xe0241f, 0.6)],
  ],
  // slingerpaal: precies STRING_HEIGHT hoog, met een wimpel die los kan wapperen
  bunting: [
    [mergeGeometries([tube(0.028, 0.038, STRING_HEIGHT, 0, STRING_HEIGHT / 2, 0), tube(0.1, 0.12, 0.05, 0, 0.025, 0)])!, WHITE_MAT],
    [new THREE.ConeGeometry(0.075, 0.22, 4).rotateZ(-Math.PI / 2).scale(1, 1, 0.14).translate(0.13, STRING_HEIGHT - 0.1, 0), P_RED],
  ],
  // lichtjespaal: net zo hoog, met een lampje erop (om zijn eigen midden, zie buildDecor)
  lightstring: [
    [mergeGeometries([tube(0.028, 0.038, STRING_HEIGHT, 0, STRING_HEIGHT / 2, 0), tube(0.1, 0.12, 0.05, 0, 0.025, 0)])!, std(0x3d4f5a, 0.7)],
    [new THREE.IcosahedronGeometry(0.075, 1), LAMP_MAT, false],
  ],
};

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
function buildDecor(kind: DecorKind, mat?: THREE.Material): THREE.Group {
  const group = build(DECOR_PARTS[kind], mat);
  const kids = group.children;
  if (kind === 'windmill') kids[3].position.set(0, 0.92, 0.2);
  if (kind === 'campfire') kids[2].position.y = kids[3].position.y = 0.1;
  if (kind === 'lantern') kids[1].position.y = 1.15;
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
  return group;
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
      // zo ver draait hij open, naar buiten toe
      door.userData.open = side * 1.25;
      group.add(door);
      return door;
    });
  if (kind === 'bumper') {
    const cars: THREE.Object3D[] = [];
    for (let i = 0; i < BUMPER_CARS; i++) {
      const car = build(CAR_PARTS(CAR_COLORS[i % CAR_COLORS.length]), mat);
      const [x, z, turn] = bumperCar(i, 0);
      car.position.set(x, 0.05, z);
      car.rotation.y = turn;
      group.add(car);
      cars.push(car);
    }
    group.userData.cars = cars;
  }
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
  return group;
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
// op een tafeltje. Eén keer gemaakt, door alle gebouwen gedeeld.
let partyGeos: { white: THREE.BufferGeometry; colors: THREE.BufferGeometry; balloons: THREE.BufferGeometry } | null = null;
const PARTY_POLE = 1.7, PARTY_AT: P3 = [0.9, PARTY_POLE, 0.9];
function partyParts(): NonNullable<typeof partyGeos> {
  if (partyGeos) return partyGeos;
  const rope: THREE.BufferGeometry[] = [], flags: THREE.BufferGeometry[] = [];
  const top = (i: number): THREE.Vector3 => new THREE.Vector3(CORNERS[i][0] * 0.9, PARTY_POLE, CORNERS[i][1] * 0.9);
  for (const [i, j] of [[0, 1], [1, 3], [3, 2], [2, 0]]) garland(top(i), top(j), 'bunting', rope, flags);
  const white = merge([
    ...CORNERS.map(([x, z]) => tube(0.022, 0.028, PARTY_POLE, x * 0.9, PARTY_POLE / 2, z * 0.9)),
    ...rope,
    // het tafeltje en het glazuur van de taart
    boxAt(0.3, 0.04, 0.3, 0.74, 0.5, 0.74), ...CORNERS.map(([x, z]) => boxAt(0.035, 0.48, 0.035, 0.74 + x * 0.12, 0.24, 0.74 + z * 0.12)),
    tube(0.115, 0.115, 0.03, 0.74, 0.625, 0.74),
  ]);
  const colors = merge([
    ...flags,
    paint(tube(0.11, 0.11, 0.1, 0.74, 0.57, 0.74), 0xf48fb1),
    ...[[-0.05, 0.03], [0.05, 0.02], [0, -0.05]].flatMap(([x, z], i) => [
      paint(boxAt(0.018, 0.07, 0.018, 0.74 + x, 0.675, 0.74 + z), PENNANTS[i]),
      paint(boxAt(0.024, 0.03, 0.024, 0.74 + x, 0.725, 0.74 + z), 0xffc21f),
    ]),
  ]);
  // de ballonnen: om de top van de paal, zodat ze kunnen wiegen
  const spots: P3[] = [[0.02, 0.36, 0], [-0.17, 0.26, 0.05], [0.14, 0.24, -0.1]];
  const balloons = merge(spots.flatMap((p, i) => [paint(ball(0.13, ...p), PENNANTS[i]), paint(beam(0.008, [0, 0, 0], [p[0], p[1] - 0.12, p[2]]), 0xf7f4ec)]));
  return (partyGeos = { white, colors, balloons });
}
// Een vieze kraam: bruine vlekken op de vloer (en bij een kraam ook op de toonbank), en twee vliegen.
const GRIME_MAT = std(0x6b4a2a, 1);
const FLY_MAT = std(0x22201c, 0.6);
const FLY_GEO = mergeGeometries([boxAt(0.035, 0.03, 0.05, 0, 0, 0), boxAt(0.07, 0.006, 0.03, 0, 0.018, 0)])!;
const grime = (w: number, d: number, x: number, z: number, turn: number): THREE.BufferGeometry =>
  new THREE.CylinderGeometry(0.5, 0.5, 0.008, 9).scale(w, 1, d).rotateY(turn).translate(x, 0.056, z);
const GRIME_FLOOR_GEO = mergeGeometries([grime(0.34, 0.22, -0.3, 0.2, 0.4), grime(0.24, 0.16, 0.26, -0.3, -0.6), grime(0.2, 0.14, -0.52, -0.5, 1.1), grime(0.16, 0.12, 0.1, 0.36, 0.2)])!;
const GRIME_FRONT_GEO = mergeGeometries([
  boxAt(0.26, 0.15, 0.012, -0.22, 0.2, 0.874), boxAt(0.14, 0.2, 0.012, 0.32, 0.14, 0.874), boxAt(0.012, 0.14, 0.24, 0.874, 0.2, -0.3),
  boxAt(0.2, 0.01, 0.12, 0.5, 0.413, 0.74),
])!;

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
const FLOWER_HEAD_GEO = boxAt(0.075, 0.055, 0.075, 0, 0.058, 0);
const FLOWER_EDGE_MAT = std(0x6fb44c, 1);
const PUDDLE_GEO = new THREE.CircleGeometry(1, 16).rotateX(-Math.PI / 2);
// Afval in vier soorten, groot en fel genoeg om tussen de gasten op te vallen: een beker met rietje, een
// frietzak met een verfrommeld papiertje, een bananenschil en een blikje met een servet.
const LITTER_KINDS: Part[][] = [
  [
    [tube(0.09, 0.07, 0.2, 0, 0.07, 0).rotateZ(1.35), WHITE_MAT],
    [tube(0.095, 0.095, 0.03, 0.1, 0.09, 0).rotateZ(1.35), std(0xe0584f)],
    [boxAt(0.02, 0.02, 0.2, 0.2, 0.06, 0.04), std(0x4a90e2)],
  ],
  [
    [boxAt(0.2, 0.05, 0.16, 0, 0.03, 0), std(0xd8362e)],
    [boxAt(0.12, 0.09, 0.12, -0.14, 0.05, 0.1), std(0xffd23f)],
    [boxAt(0.1, 0.07, 0.09, 0.12, 0.04, -0.12), WHITE_MAT],
  ],
  [
    [mergeGeometries([boxAt(0.06, 0.03, 0.2, 0, 0.02, 0.06), boxAt(0.2, 0.03, 0.06, 0.06, 0.02, 0), boxAt(0.06, 0.03, 0.18, -0.02, 0.02, -0.1)])!, std(0xffd23f, 0.6)],
    [boxAt(0.07, 0.05, 0.07, 0, 0.045, 0), std(0xc9a93a)],
  ],
  [
    [tube(0.055, 0.055, 0.17, 0, 0.055, 0).rotateX(Math.PI / 2), std(0x4a90e2, 0.4)],
    [boxAt(0.18, 0.02, 0.16, 0.14, 0.015, 0.1), WHITE_MAT],
    [boxAt(0.1, 0.06, 0.1, -0.14, 0.035, -0.08), std(0xd8a14a)],
  ],
];

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

const NIGHT_SKY = new THREE.Color(0x16224a);
/** De omgeving kleurt mee met de wereld waarin je speelt. */
const WORLD_LOOK: Record<WorldId, { sky: number; ground: number; leaves: [number, number, number] }> = {
  farm: { sky: 0xbfe6ff, ground: 0x6fb44c, leaves: [0x4f9e45, 0x5bab4c, 0x468f3e] },
  savanna: { sky: 0xffe6bd, ground: 0xcdb96a, leaves: [0x8f9a44, 0xa3a84f, 0x7d8a3a] },
  jungle: { sky: 0xbfeccd, ground: 0x3f8f45, leaves: [0x2f7f3a, 0x3a9146, 0x276f33] },
  ice: { sky: 0xdcefff, ground: 0xe9f1f8, leaves: [0xcfe3dc, 0xe6f1ee, 0xb9d6cc] },
  far: { sky: 0xc5ecf5, ground: 0x74bf8f, leaves: [0x3f9f78, 0x4fb088, 0x358c6a] },
};

// Losse stukjes voer: een bak met vier porties toont vier stukjes.
const FOOD_MATS = {
  carrot: new THREE.MeshStandardMaterial({ color: 0xf08a2c, roughness: 0.8 }),
  leaf: STEM_MAT,
  hay: new THREE.MeshStandardMaterial({ color: 0xe9d05a, roughness: 1 }),
  apple: new THREE.MeshStandardMaterial({ color: 0xe0453a, roughness: 0.6 }),
  grain: new THREE.MeshStandardMaterial({ color: 0xe3c88f, roughness: 1 }),
  meat: new THREE.MeshStandardMaterial({ color: 0xc9553f, roughness: 0.8 }),
  bone: WHITE_MAT,
  fish: new THREE.MeshStandardMaterial({ color: 0x7fa7c9, roughness: 0.5 }),
  bamboo: new THREE.MeshStandardMaterial({ color: 0x9bd05a, roughness: 0.8 }),
};
const CARROT_GEO = new THREE.ConeGeometry(0.06, 0.28, 6).rotateX(Math.PI / 2);
const LEAF_GEO = new THREE.BoxGeometry(0.05, 0.05, 0.08).translate(0, 0, -0.17);
const BALE_GEO = new THREE.BoxGeometry(0.14, 0.12, 0.3);
const APPLE_GEO = new THREE.IcosahedronGeometry(0.075, 0).translate(0, 0.02, 0);
const STALK_GEO = new THREE.BoxGeometry(0.03, 0.05, 0.03).translate(0, 0.1, 0);
const GRAIN_GEO = new THREE.BoxGeometry(0.14, 0.09, 0.28);
const MEAT_GEO = new THREE.BoxGeometry(0.13, 0.1, 0.2).translate(0, 0, -0.03);
const BONE_GEO = new THREE.BoxGeometry(0.04, 0.04, 0.12).translate(0, 0, 0.12);
const FISH_GEO = mergeGeometries([boxAt(0.09, 0.08, 0.22, 0, 0, -0.02), boxAt(0.03, 0.12, 0.09, 0, 0, 0.13)])!;
const FISH_EYE_GEO = boxAt(0.1, 0.03, 0.03, 0, 0.015, -0.09);
const BAMBOO_GEO = mergeGeometries([boxAt(0.05, 0.05, 0.3, -0.035, 0, 0), boxAt(0.05, 0.05, 0.3, 0.035, 0.01, 0.01)])!;
const BAMBOO_LEAF_GEO = boxAt(0.1, 0.02, 0.07, 0.04, 0.045, -0.12);
const LEAVES_GEO = mergeGeometries([boxAt(0.13, 0.05, 0.3, 0, 0, 0), boxAt(0.1, 0.05, 0.2, 0.02, 0.05, 0.02)])!;

function foodPiece(food: FoodId): THREE.Object3D {
  const pair = (a: THREE.BufferGeometry, am: THREE.Material, b: THREE.BufferGeometry, bm: THREE.Material): THREE.Group => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(a, am), new THREE.Mesh(b, bm));
    return g;
  };
  switch (food) {
    case 'hay': return new THREE.Mesh(BALE_GEO, FOOD_MATS.hay);
    case 'grain': return new THREE.Mesh(GRAIN_GEO, FOOD_MATS.grain);
    case 'leaves': return new THREE.Mesh(LEAVES_GEO, FOOD_MATS.leaf);
    case 'fruit': return pair(APPLE_GEO, FOOD_MATS.apple, STALK_GEO, FOOD_MATS.leaf);
    case 'meat': return pair(MEAT_GEO, FOOD_MATS.meat, BONE_GEO, FOOD_MATS.bone);
    case 'fish': return pair(FISH_GEO, FOOD_MATS.fish, FISH_EYE_GEO, DARK_MAT);
    case 'bamboo': return pair(BAMBOO_GEO, FOOD_MATS.bamboo, BAMBOO_LEAF_GEO, FOOD_MATS.leaf);
    default: return pair(CARROT_GEO, FOOD_MATS.carrot, LEAF_GEO, FOOD_MATS.leaf);
  }
}

export const toWorldX = (gx: number): number => gx - W / 2;
export const toWorldZ = (gy: number): number => gy - H / 2;

export interface TroughMesh {
  group: THREE.Group;
  food: THREE.Group;
  kind: TroughKind;
}

export class View {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
  /** Het punt op de grond waar de camera naar kijkt. */
  readonly target = new THREE.Vector3(0, 0, H / 2 - 9);
  /** Hoeveel tegels er verticaal in beeld passen. */
  zoom = 11;

  private ground: THREE.InstancedMesh;
  private fences = new Map<string, THREE.Object3D>();
  /** Het water in de bakken van glas. */
  private tank: THREE.InstancedMesh | null = null;
  private tankKey = '';
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
  private ghostToys = Object.fromEntries(TOYS.map(k => [k, build(TOY_PARTS[k], this.ghostMat)])) as Record<ToyKind, THREE.Group>;
  private ghostDecors = Object.fromEntries(DECORS.map(k => [k, buildDecor(k, this.ghostMat)])) as Record<DecorKind, THREE.Group>;
  private ghostShops = Object.fromEntries(SHOPS.map(k => [k, buildShop(k, this.ghostMat)])) as Record<ShopKind, THREE.Group>;
  private ghostTileMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.75, depthWrite: false });
  private ghostTileMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.94, 0.94).rotateX(-Math.PI / 2), this.ghostTileMat);
  private ghostRingMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.85, depthWrite: false });
  private ghostRing = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.44, 28).rotateX(-Math.PI / 2), this.ghostRingMat);
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
  private dropGeo = new THREE.BoxGeometry(0.05, 0.05, 0.05);
  private dropMat = new THREE.MeshBasicMaterial({ color: 0xe6f6ff });
  /** Waar het beeld rustig naartoe schuift (de knop 'dier in nood'). */
  private fly: { x: number; z: number } | null = null;
  private flashGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  private sun = new THREE.DirectionalLight(0xfff4dd, 2.2);
  /** 2 = alles aan, 1 = minder scherp, 0 = ook zonder schaduwen. */
  private quality = 2;
  private slowFor = 0;
  private outerMat = new THREE.MeshStandardMaterial({ color: 0x6fb44c, roughness: 1 });
  private hemi = new THREE.HemisphereLight(0xffffff, 0x9ad07a, 1.6);
  private nightCanvas = document.createElement('canvas');
  private skyDay = new THREE.Color(0xbfe6ff);
  private dark = 0;
  /** Hoe nat het is (0 = droog, 1 = volop regen): dan is het licht wat zwakker en de lucht grijzer. */
  private wet = 0;
  /**
   * De bomen rond het park: één vorm per onderdeel, voor alle bomen samen. Elke boom heeft zijn eigen hoogte
   * (`tall`) en breedte (`wide`); ongeveer een derde is een spar (`fir`) en sommige loofbomen bloeien in de lente.
   */
  private treeSpots: { gx: number; gy: number; s: number; rot: number; tall: number; wide: number; fir: boolean; bloom: boolean }[] = [];
  /** Stam, twee blokken blad van de loofboom, de spar en de bloesem. */
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
  private leafMats = [0x4f9e45, 0x5bab4c, 0x468f3e].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 1 }));

  constructor(parent: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    parent.prepend(this.renderer.domElement);
    this.scene.background = new THREE.Color(0xbfe6ff);

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

    // tegels
    const tileGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    this.ground = new THREE.InstancedMesh(tileGeo, new THREE.MeshStandardMaterial({ roughness: 1 }), W * H);
    this.ground.receiveShadow = true;
    const m = new THREE.Matrix4();
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        m.makeTranslation(toWorldX(x + 0.5), 0, toWorldZ(y + 0.5));
        this.ground.setMatrixAt(x + y * W, m);
      }
    this.scene.add(this.ground);
    this.addPlots();
    this.setLand(BASE_LAND, SIDES);

    this.ghostTileMesh.position.y = 0.012;
    this.ghostRing.position.y = 0.014;
    this.ghosts = [this.ghostFenceMesh, this.ghostGateMesh, this.ghostWallMesh, this.ghostNetMesh, this.ghostGlassMesh, this.ghostWindowMesh, this.ghostPicketMesh, this.ghostPetgateMesh, this.ghostTroughMesh, ...Object.values(this.ghostBeds), ...Object.values(this.ghostToys), ...Object.values(this.ghostDecors), ...Object.values(this.ghostShops), this.ghostTileMesh, this.ghostRing];
    for (const g of this.ghosts) {
      g.visible = false;
      g.traverse(o => { o.renderOrder = 5; });
      this.scene.add(g);
    }

    addEventListener('resize', () => this.resize());
    this.resize();
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
      if (inBase || (Math.abs(gx - mid) < 2.6 && gy > H - 2)) continue;
      // elke boom is anders: hoger of breder, een loofboom of een spar, en soms met bloesem in de lente
      const fir = hash(gx, gy, 1) < 0.34;
      this.treeSpots.push({ gx, gy, s, rot, tall: 0.82 + hash(gx, gy, 2) * 0.5, wide: 0.85 + hash(gx, gy, 3) * 0.35, fir, bloom: !fir && hash(gx, gy, 4) < 0.3 });
    }
    const n = this.treeSpots.length;
    const trunk = new THREE.MeshStandardMaterial({ color: 0x8a5a33, roughness: 1 });
    this.treeParts = [
      new THREE.InstancedMesh(new THREE.BoxGeometry(0.22, 0.6, 0.22).translate(0, 0.3, 0), trunk, n),
      new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.8, 1).translate(0, 0.95, 0), this.leafMats[0], n),
      new THREE.InstancedMesh(new THREE.BoxGeometry(0.65, 0.55, 0.65).translate(0, 1.55, 0), this.leafMats[1], n),
      // de spar: drie kegels op elkaar
      new THREE.InstancedMesh(mergeGeometries([cone(0.62, 0.9, 0, 0.85, 0, 6), cone(0.48, 0.8, 0, 1.4, 0, 6), cone(0.32, 0.7, 0, 1.92, 0, 6)])!, this.leafMats[2], n),
      // bloesem: roze blokjes op het blad, alleen in de lente te zien
      new THREE.InstancedMesh(mergeGeometries([[0.42, 1.2, 0.42], [-0.3, 1.38, 0.2], [0.2, 1.84, -0.1], [0.33, 1.62, 0.3], [-0.46, 1.02, 0.48], [0.5, 1.06, -0.2], [-0.2, 1.72, 0.33], [0.1, 1.38, -0.44]]
        .map(([x, y, z]) => boxAt(0.17, 0.17, 0.17, x, y, z)))!, BLOSSOM_MAT, n),
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
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const mine = x >= land.x0 && x < land.x1 && y >= land.y0 && y < land.y1;
        this.ground.setMatrixAt(x + y * W, mine ? m.makeTranslation(toWorldX(x + 0.5), 0, toWorldZ(y + 0.5)) : none);
      }
    this.ground.instanceMatrix.needsUpdate = true;
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

  /** Het licht van nu: de nacht en de regen samen. Bij regen is de zon wat zwakker en de lucht grijzer. */
  private relight(): void {
    const dark = this.dark, wet = this.wet;
    this.sun.intensity = 2.2 * (1 - 0.6 * dark) * (1 - 0.3 * wet);
    this.hemi.intensity = 1.6 * (1 - 0.4 * dark) * (1 - 0.12 * wet);
    (this.scene.background as THREE.Color).copy(this.skyDay).lerp(RAIN_SKY, 0.65 * wet).lerp(NIGHT_SKY, dark);
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
  }

  /** Kleurt alles wat met het seizoen meegaat: het blad van bomen en struiken, de grond rond het park en de tegels. */
  private applySeason(tiles: boolean): void {
    const season = seasonNow;
    this.leafMats.forEach((m, i) => leafColor(m.color, this.worldLeaves[i], season, i));
    groundColor(this.outerMat.color.setHex(this.worldGround), season);
    SEASON_LEAVES.forEach((l, i) => leafColor(l.mat.color, l.summer, season, i, l.pink));
    BLOSSOM_MAT.visible = season === 'spring';
    if (tiles && this.grid) this.paintTerrain(this.grid);
  }

  /**
   * Tekent de nacht: een donkerblauw vlak over het hele beeld, met een zacht rond gat bij elk licht (een
   * lantaarn, een kampvuur, een winkel, de ingang). Zo zie je alleen goed wat verlicht is.
   */
  drawNight(dark: number, lights: { gx: number; gy: number; r: number }[]): void {
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
    ctx.fillStyle = `rgba(10, 16, 48, ${0.78 * dark})`;
    ctx.fillRect(0, 0, w, h);
    const perTile = (innerHeight / this.zoom) * k;
    const spots = lights
      .map(l => ({ s: this.toScreen(l.gx, l.gy, 0.3), r: l.r * perTile * 1.25 }))
      .filter(p => p.s.x > -p.r / k && p.s.x < innerWidth + p.r / k && p.s.y > -p.r / k && p.s.y < innerHeight + p.r / k);
    // een cirkel op de grond is op het scherm een platte ovaal
    for (const pass of ['destination-out', 'source-over'] as const) {
      ctx.globalCompositeOperation = pass;
      for (const { s, r } of spots) {
        ctx.setTransform(1, 0, 0, 0.62, s.x * k, s.y * k);
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
        if (pass === 'destination-out') {
          g.addColorStop(0, 'rgba(0,0,0,1)');
          g.addColorStop(0.55, 'rgba(0,0,0,0.9)');
          g.addColorStop(1, 'rgba(0,0,0,0)');
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
    this.camera.position.copy(this.target).add(this.tmp.set(30, 30, 30));
    this.camera.lookAt(this.target);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  /** Laat ringen zien op deze plekken; `hot` is feller en `r` maakt de ring groter. `pulse` laat ze ademen. */
  showMarks(spots: { gx: number; gy: number; r?: number; hot?: boolean }[], pulse: number): void {
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
      m.material = s.hot ? this.hotMat : this.markMat;
      m.position.set(toWorldX(s.gx), 0.03, toWorldZ(s.gy));
      const k = (s.r ?? 1) * (1 + 0.12 * Math.sin(pulse + i));
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
    const size = Math.max(20, Math.min(52, this.zoom * 2.6));
    const x0 = this.target.x - size / 2, z0 = this.target.z - size / 2;
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

  /** De regenboog staat een stuk achter het midden van het beeld en is zo groot als past bij hoe ver je bent uitgezoomd. */
  private placeRainbow(): void {
    const bow = this.rainbow;
    if (!bow || !bow.visible) return;
    // op een smal scherm kleiner, zodat de hele boog erop past
    const k = (this.zoom / 11) * Math.min(1, (innerWidth / innerHeight) * 0.75);
    bow.scale.setScalar(k);
    bow.position.set(this.target.x - 1.2 * k, -0.4 * k, this.target.z - 1.2 * k);
  }

  /** Schuif het beeld rustig naar deze plek op het raster. */
  flyTo(gx: number, gy: number): void {
    this.fly = { x: toWorldX(gx), z: toWorldZ(gy) };
  }

  /** Schuif het beeld: de grond volgt de vinger. */
  pan(dxPx: number, dyPx: number): void {
    this.fly = null;
    const upp = this.zoom / innerHeight;
    this.target.x += (-dxPx * upp) / SQRT2 - (dyPx * upp * SQRT3) / SQRT2;
    this.target.z += (dxPx * upp) / SQRT2 - (dyPx * upp * SQRT3) / SQRT2;
    const lim = W / 2 + 2;
    this.target.x = Math.max(-lim, Math.min(lim, this.target.x));
    this.target.z = Math.max(-lim, Math.min(lim, this.target.z));
    this.resize();
  }

  zoomBy(factor: number): void {
    this.zoom = Math.max(5, Math.min(42, this.zoom * factor));
    this.resize();
  }

  /** Schermpunt naar rastercoördinaten op de grond. */
  groundPoint(clientX: number, clientY: number): { gx: number; gy: number } | null {
    const ndc = new THREE.Vector2((clientX / innerWidth) * 2 - 1, -(clientY / innerHeight) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hit = this.raycaster.ray.intersectPlane(this.plane, this.tmp);
    return hit ? { gx: hit.x + W / 2, gy: hit.z + H / 2 } : null;
  }

  /** Rasterpunt (met hoogte) naar schermpixels. */
  toScreen(gx: number, gy: number, height = 0): { x: number; y: number } {
    this.tmp.set(toWorldX(gx), height, toWorldZ(gy)).project(this.camera);
    return { x: ((this.tmp.x + 1) / 2) * innerWidth, y: ((1 - this.tmp.y) / 2) * innerHeight };
  }

  /**
   * Kleurt de tegels: gras, bos, wei en steppe kleuren mee met het seizoen. Op een brug komen planken met een
   * leuning en langs een bloemenpad een rand met bloemetjes; die worden alleen opnieuw gebouwd als er zo'n
   * tegel bij is gekomen of weg is.
   */
  paintTerrain(grid: Grid): void {
    this.grid = grid;
    const c = new THREE.Color();
    const bridges: number[] = [], flowers: number[] = [];
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const id = grid.terrain[x + y * W], kind = TERRAINS[id];
        c.setHex(TERRAIN_INFO[kind].colors[(x + y) % 2]);
        if (SEASONAL_IDS.has(id)) groundColor(c, seasonNow);
        this.ground.setColorAt(x + y * W, c);
        // onthoud de tegel en zijn richting: langs y als daar het pad verder loopt, anders langs x
        if (kind === 'bridge') bridges.push((x + y * W) * 2 + (this.pathAlongY(grid, x, y) ? 1 : 0));
        else if (kind === 'flowerpath') flowers.push((x + y * W) * 2 + (this.pathAlongY(grid, x, y) ? 1 : 0));
      }
    this.ground.instanceColor!.needsUpdate = true;
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
  syncTanks(tiles: [number, number][], height: number): void {
    const key = tiles.map(t => t.join(',')).join(';');
    if (key === this.tankKey) return;
    this.tankKey = key;
    if (this.tank) {
      this.scene.remove(this.tank);
      this.tank.dispose();
      this.tank = null;
    }
    if (!tiles.length) return;
    this.tank = new THREE.InstancedMesh(new THREE.BoxGeometry(1, height, 1).translate(0, height / 2 + 0.005, 0), TANK_MAT, tiles.length);
    const m = new THREE.Matrix4();
    tiles.forEach(([x, y], i) => this.tank!.setMatrixAt(i, m.makeTranslation(toWorldX(x + 0.5), 0, toWorldZ(y + 0.5))));
    this.tank.renderOrder = 2;
    this.tank.frustumCulled = false;
    this.scene.add(this.tank);
  }

  // ------------------------------------------------------------ voerbak
  makeTrough(x: number, y: number, kind: TroughKind = 'wood'): TroughMesh {
    const group = new THREE.Group();
    const food = new THREE.Group();
    if (kind === 'silo') {
      const parts = [new THREE.Mesh(SILO_GEO, SILO_MAT), new THREE.Mesh(SILO_ROOF_GEO, ROOF_MAT), new THREE.Mesh(SILO_TRAY_GEO, WOOD_MAT)];
      for (const m of parts) m.castShadow = true;
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

  private at<T extends THREE.Object3D>(obj: T, x: number, y: number): T {
    obj.position.set(toWorldX(x + 0.5), 0, toWorldZ(y + 0.5));
    return obj;
  }

  makeBed(x: number, y: number, kind: BedKind): THREE.Group {
    const group = this.at(build(BED_PARTS[kind]), x, y);
    this.scene.add(group);
    return group;
  }

  ghostBed(x: number, y: number, kind: BedKind, ok: boolean): void {
    this.ghostMat.color.setHex(ok ? OK_COLOR : BAD_COLOR);
    this.at(this.ghostBeds[kind], x, y).visible = true;
  }

  makeDecor(x: number, y: number, kind: DecorKind): THREE.Group {
    const group = this.at(buildDecor(kind), x, y);
    this.varyTree(group, x, y, kind);
    this.scene.add(group);
    return group;
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
    if (kind === 'tree') crown.geometry = TREE_CROWNS[shape];
    if (kind === 'pine') crown.geometry = PINE_CROWNS[shape];
    if (kind === 'tree' && hash(x, y, 8) < 0.4) {
      // sommige loofbomen bloeien in de lente
      const blossom = new THREE.Mesh(TREE_BLOSSOMS[shape], BLOSSOM_MAT);
      blossom.rotation.copy(crown.rotation);
      blossom.scale.copy(crown.scale);
      group.add(blossom);
    }
  }

  ghostDecor(x: number, y: number, kind: DecorKind, ok: boolean): void {
    this.ghostMat.color.setHex(ok ? OK_COLOR : BAD_COLOR);
    this.at(this.ghostDecors[kind], x, y).visible = true;
  }

  makeToy(x: number, y: number, kind: ToyKind): THREE.Group {
    const group = this.at(build(TOY_PARTS[kind]), x, y);
    this.scene.add(group);
    return group;
  }

  ghostToy(x: number, y: number, kind: ToyKind, ok: boolean): void {
    this.ghostMat.color.setHex(ok ? OK_COLOR : BAD_COLOR);
    this.at(this.ghostToys[kind], x, y).visible = true;
  }

  /** Een winkel met zijn linkerbovenhoek op tegel (x, y); een gebouw beslaat 2 bij 2 tegels. */
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
      group.position.set(toWorldX(x + SHOP_SIZE[kind] / 2), 0, toWorldZ(y + SHOP_SIZE[kind] / 2));
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

  /** Afval dat een gast op het pad heeft laten vallen. */
  makeLitter(gx: number, gy: number): THREE.Group {
    const group = build(LITTER_KINDS[Math.floor(Math.random() * LITTER_KINDS.length)]);
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

  ghostTrough(x: number, y: number, ok: boolean): void {
    this.ghostMat.color.setHex(ok ? OK_COLOR : BAD_COLOR);
    this.ghostTroughMesh.position.set(toWorldX(x + 0.5), 0, toWorldZ(y + 0.5));
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
   * Het leven in en om een winkel, elk beeldje opnieuw: wat op het dak staat wiegt, de wc-deuren zwaaien open
   * zolang er iemand is (`busy` > 0) en daarna weer dicht, het doek van de trampoline veert, het bankje zakt een
   * haartje in, de deksel van de afvalbak klapt (zie flapLid) en om een vieze kraam cirkelen vliegen. Wat het
   * spel zelf laat bewegen (`userData.moving` en `userData.cars`) blijft hier met rust.
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
      const open = use * use * (3 - 2 * use);
      for (let i = 0; i < doors.length; i++) doors[i].rotation.y = doors[i].userData.open * open;
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
        group.rotation.y = Math.sin(t * 1.8 + seed) * 0.3 + p * Math.sin(since * 15) * 0.9;
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
   * Feest bij een gebouw van 2 bij 2: slingers tussen vier dunne palen op de hoeken, ballonnen en een taart op
   * een tafeltje rechtsvoor. Wordt pas gemaakt als het voor het eerst nodig is.
   */
  setShopParty(group: THREE.Object3D, on: boolean): void {
    let party: THREE.Group | undefined = group.userData.party;
    if (!party) {
      if (!on) return;
      const geos = partyParts();
      party = new THREE.Group();
      const balloons = new THREE.Mesh(geos.balloons, PAINT_MAT);
      balloons.position.set(...PARTY_AT);
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
      made.add(new THREE.Mesh(GRIME_FLOOR_GEO, GRIME_MAT));
      if (STALLS.includes(kind)) made.add(new THREE.Mesh(GRIME_FRONT_GEO, GRIME_MAT));
      group.userData.flies = [[0.25, 0.8, 0.55], [-0.3, 1, 0.2]].map(([x, y, z]) => {
        const fly = new THREE.Mesh(FLY_GEO, FLY_MAT);
        fly.position.set(x, y, z);
        Object.assign(fly.userData, { x, y, z });
        made.add(fly);
        return fly;
      });
      // een bankje of een bak is maar klein
      if (SHOP_SIZE[kind] === 1) made.scale.setScalar(0.45);
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
   * Slingers tussen de palen. Elke paal kijkt naar het oosten en naar het zuiden: staat daar binnen STRING_REACH
   * tegels een paal van dezelfde soort, dan hangt er een slinger tussen, met vlaggetjes ('bunting') of lampjes
   * ('lightstring', ze gloeien 's nachts vanzelf). Verandert er niets aan de palen, dan gebeurt er niets.
   */
  syncStrings(poles: { x: number; y: number; kind: 'bunting' | 'lightstring' }[]): void {
    const key = poles.map(p => `${p.x},${p.y}${p.kind[0]}`).join(';');
    if (key === this.stringKey) return;
    this.stringKey = key;
    if (this.strings) {
      this.scene.remove(this.strings);
      for (const child of this.strings.children) (child as THREE.Mesh).geometry.dispose();
      this.strings = null;
    }
    const at = new Map<string, 'bunting' | 'lightstring'>();
    for (const p of poles) at.set(`${p.x},${p.y}`, p.kind);
    const rope: THREE.BufferGeometry[] = [], flags: THREE.BufferGeometry[] = [], bulbs: THREE.BufferGeometry[] = [];
    const top = (x: number, y: number): THREE.Vector3 => new THREE.Vector3(toWorldX(x + 0.5), STRING_HEIGHT, toWorldZ(y + 0.5));
    for (const p of poles)
      for (const [dx, dy] of [[1, 0], [0, 1]])
        for (let d = 1; d <= STRING_REACH; d++) {
          if (at.get(`${p.x + dx * d},${p.y + dy * d}`) !== p.kind) continue;
          garland(top(p.x, p.y), top(p.x + dx * d, p.y + dy * d), p.kind, rope, p.kind === 'bunting' ? flags : bulbs);
          break;
        }
    if (!rope.length) return;
    const group = new THREE.Group();
    if (rope.length) group.add(new THREE.Mesh(merge(rope), ROPE_MAT));
    if (flags.length) group.add(new THREE.Mesh(merge(flags), PAINT_MAT));
    if (bulbs.length) group.add(new THREE.Mesh(merge(bulbs), LAMP_MAT));
    this.scene.add(group);
    this.strings = group;
  }

  update(dt: number): void {
    this.stepWeather(dt);
    this.placeRainbow();
    for (const d of this.drops) {
      d.life -= dt;
      d.vy -= 5 * dt;
      d.mesh.position.x += d.vx * dt;
      d.mesh.position.y += d.vy * dt;
      d.mesh.position.z += d.vz * dt;
      if (d.life <= 0 || d.mesh.position.y < 0) this.scene.remove(d.mesh);
    }
    if (this.drops.length) this.drops = this.drops.filter(d => d.life > 0 && d.mesh.position.y >= 0);
    if (this.fly) {
      const k = Math.min(1, dt * 5);
      this.target.x += (this.fly.x - this.target.x) * k;
      this.target.z += (this.fly.z - this.target.z) * k;
      if (Math.hypot(this.fly.x - this.target.x, this.fly.z - this.target.z) < 0.03) this.fly = null;
      this.resize();
    }
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
    this.renderer.render(this.scene, this.camera);
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
