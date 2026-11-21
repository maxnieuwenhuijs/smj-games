// Het beeld: isometrische camera, tegels, hekken, voerbakken en het voorbeeld van wat je gaat plaatsen.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { FENCE_COLORS, BEDS, SHOPS, SHOP_SIZE, TERRAINS, TERRAIN_INFO, type BedKind, type FoodId, type ShopKind, type WorldId, TOYS, type ToyKind, DECORS, type DecorKind, type TroughKind } from './data';
import { Grid, H, W, edgeKey, tileXY, type Edge } from './grid';

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
// Stenen muur voor sterke dieren.
const WALL_GEO = mergeGeometries([
  boxAt(1.1, 0.46, 0.2, 0.5, 0.23, 0),
  boxAt(0.22, 0.12, 0.24, 0.12, 0.52, 0),
  boxAt(0.22, 0.12, 0.24, 0.5, 0.52, 0),
  boxAt(0.22, 0.12, 0.24, 0.88, 0.52, 0),
])!;
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

const NET_MAT = new THREE.MeshStandardMaterial({ color: 0x3f7f6b, roughness: 0.7 });
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
  // wc-gebouw met twee deuren
  toilet: [
    [boxAt(1.84, 0.05, 1.84, 0, 0.025, 0), std(0xd8c7ab, 1), false],
    [boxAt(1.7, 1.2, 1.4, 0, 0.6, -0.15), WHITE_MAT],
    [boxAt(1.86, 0.12, 1.6, 0, 1.26, -0.12), std(0x4a90e2)],
    [mergeGeometries([boxAt(0.5, 0.86, 0.05, -0.42, 0.45, 0.57), boxAt(0.5, 0.86, 0.05, 0.42, 0.45, 0.57)])!, std(0x4a90e2)],
    [mergeGeometries([boxAt(0.07, 0.07, 0.05, -0.26, 0.45, 0.61), boxAt(0.07, 0.07, 0.05, 0.58, 0.45, 0.61)])!, std(0xffd23f)],
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
  flowers: [
    [boxAt(0.74, 0.2, 0.36, 0, 0.1, 0), WOOD_MAT],
    [boxAt(0.66, 0.04, 0.28, 0, 0.21, 0), DARK_MAT, false],
    [mergeGeometries([boxAt(0.03, 0.2, 0.03, -0.22, 0.32, 0), boxAt(0.03, 0.26, 0.03, 0, 0.35, 0.03), boxAt(0.03, 0.2, 0.03, 0.22, 0.32, -0.02)])!, LEAF_MAT],
    [boxAt(0.14, 0.1, 0.14, -0.22, 0.45, 0), std(0xe0584f)],
    [boxAt(0.14, 0.1, 0.14, 0, 0.51, 0.03), std(0xffd23f)],
    [boxAt(0.14, 0.1, 0.14, 0.22, 0.45, -0.02), std(0xf06aa6)],
  ],
  bin: [
    [boxAt(0.32, 0.42, 0.32, 0, 0.21, 0), std(0x3d8b5a)],
    [boxAt(0.38, 0.06, 0.38, 0, 0.45, 0), std(0x2c6a43)],
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
};
// Iets leuks in een verblijf: een bal, een struik met bessen, een boomstam en een bloemperk.
const TOY_PARTS: Record<ToyKind, Part[]> = {
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
  flowerbed: [
    [boxAt(0.82, 0.05, 0.82, 0, 0.025, 0), DARK_MAT, false],
    [mergeGeometries([boxAt(0.03, 0.2, 0.03, -0.24, 0.15, -0.2), boxAt(0.03, 0.26, 0.03, 0.2, 0.18, -0.16), boxAt(0.03, 0.18, 0.03, -0.1, 0.14, 0.22), boxAt(0.03, 0.24, 0.03, 0.24, 0.17, 0.22), boxAt(0.03, 0.2, 0.03, 0, 0.15, 0)])!, LEAF_MAT],
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
const FLAME_MAT = new THREE.MeshStandardMaterial({ color: 0xf08a24, emissive: 0xf06a10, emissiveIntensity: 0.9, roughness: 0.6 });
const FLAME2_MAT = new THREE.MeshStandardMaterial({ color: 0xffd23f, emissive: 0xffc21f, emissiveIntensity: 0.9, roughness: 0.6 });
// Versieringen: één tegel groot, het midden is (0, 0).
const LEAF2 = std(0x468f3e, 1);
const flowersOn = (spots: [number, number, number][], color: number): Part =>
  [mergeGeometries(spots.map(([x, y, z]) => boxAt(0.13, 0.1, 0.13, x, y, z)))!, std(color)];
const DECOR_PARTS: Record<DecorKind, Part[]> = {
  tree: [
    [boxAt(0.16, 0.6, 0.16, 0, 0.3, 0), WOOD_MAT],
    [mergeGeometries([ball(0.4, 0, 0.9, 0), ball(0.28, 0.2, 1.2, 0.08), ball(0.26, -0.22, 1.12, -0.1)])!, LEAF_MAT],
  ],
  pine: [
    [boxAt(0.12, 0.3, 0.12, 0, 0.15, 0), WOOD_MAT],
    [mergeGeometries([cone(0.42, 0.55, 0, 0.52, 0), cone(0.33, 0.5, 0, 0.88, 0), cone(0.22, 0.42, 0, 1.2, 0)])!, LEAF2],
  ],
  palm: [
    [tube(0.055, 0.085, 1.1, 0, 0.55, 0), std(0xb88a52, 1)],
    [mergeGeometries([0, 1, 2, 3, 4, 5].map(i => new THREE.BoxGeometry(0.56, 0.04, 0.16).translate(0.3, 0, 0).rotateZ(-0.35).rotateY((i * Math.PI) / 3).translate(0, 1.12, 0)))!, LEAF_MAT],
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
    [mergeGeometries([-0.3, -0.15, 0, 0.15, 0.3].flatMap(x => [boxAt(0.025, 0.24, 0.025, x, 0.17, -0.12), boxAt(0.025, 0.22, 0.025, x, 0.16, 0.12)]))!, LEAF_MAT],
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
    [mergeGeometries([tube(0.1, 0.1, 0.012, -0.14, 0.106, 0.1), tube(0.08, 0.08, 0.012, 0.16, 0.106, -0.08), tube(0.06, 0.06, 0.012, 0.04, 0.106, 0.22)])!, LEAF_MAT, false],
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
    [boxAt(0.17, 0.2, 0.17, 0, 1.15, 0), new THREE.MeshStandardMaterial({ color: 0xfff1a8, emissive: 0xffd23f, emissiveIntensity: 0.6, roughness: 0.4 })],
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
    [mergeGeometries([tube(0.12, 0.13, 0.72, 0, 0.36, 0), tube(0.06, 0.06, 0.28, -0.27, 0.5, 0), tube(0.06, 0.06, 0.22, 0.27, 0.62, 0)])!, LEAF2],
    [mergeGeometries([boxAt(0.2, 0.09, 0.09, -0.19, 0.38, 0), boxAt(0.2, 0.09, 0.09, 0.19, 0.52, 0)])!, LEAF2],
    [ball(0.07, 0, 0.76, 0), std(0xf06aa6)],
  ],
  bamboogrove: [
    [mergeGeometries([[-0.24, 1.2, -0.1], [-0.08, 1.4, 0.12], [0.1, 1.1, -0.14], [0.24, 1.3, 0.06], [0, 0.9, 0.24]].map(([x, h, z]) => tube(0.03, 0.036, h, x, h / 2, z)))!, std(0x8cc152, 0.7)],
    [mergeGeometries([[-0.24, 1.2, -0.1], [-0.08, 1.4, 0.12], [0.1, 1.1, -0.14], [0.24, 1.3, 0.06]].flatMap(([x, h, z]) => [boxAt(0.22, 0.03, 0.08, x + 0.1, h - 0.1, z), boxAt(0.08, 0.03, 0.2, x, h - 0.25, z + 0.1)]))!, LEAF_MAT],
  ],
  sunflowers: [
    [boxAt(0.8, 0.05, 0.4, 0, 0.025, 0), DARK_MAT, false],
    [mergeGeometries([-0.26, 0, 0.26].map((x, i) => boxAt(0.035, 0.62 + i * 0.08, 0.035, x, 0.33 + i * 0.04, 0)))!, LEAF_MAT],
    [mergeGeometries([-0.26, 0, 0.26].map((x, i) => new THREE.CylinderGeometry(0.14, 0.14, 0.04, 10).rotateX(Math.PI / 2).translate(x, 0.7 + i * 0.08, 0.03)))!, std(0xffd23f)],
    [mergeGeometries([-0.26, 0, 0.26].map((x, i) => new THREE.CylinderGeometry(0.065, 0.065, 0.05, 8).rotateX(Math.PI / 2).translate(x, 0.7 + i * 0.08, 0.04)))!, std(0x6b4a2a)],
  ],
  cherry: [
    [boxAt(0.15, 0.6, 0.15, 0, 0.3, 0), std(0x7a4f2c, 1)],
    [mergeGeometries([ball(0.38, 0, 0.9, 0), ball(0.26, 0.22, 1.16, 0.06)])!, std(0xf7b6cf, 1)],
    [mergeGeometries([ball(0.26, -0.22, 1.08, -0.1), ball(0.16, 0.05, 1.36, -0.05)])!, std(0xf48fb1, 1)],
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
    [new THREE.BoxGeometry(0.05, 0.05, 0.44).rotateX(-0.5).translate(-0.08, 0.86, -0.16), std(0x3d4f5a, 0.6)],
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
};

/** Hoe iets op een rand staat: langs welke rand, en aan welke kant het pad ligt (1, -1 of 0 = geen van beide). */
export interface EdgePose {
  o: 'h' | 'v';
  face: number;
}

/** Een versiering; wat los moet kunnen bewegen (wieken, vlammen) krijgt hier zijn plek. */
function buildDecor(kind: DecorKind, mat?: THREE.Material): THREE.Group {
  const group = build(DECOR_PARTS[kind], mat);
  if (kind === 'windmill') group.children[3].position.set(0, 0.92, 0.2);
  if (kind === 'campfire') group.children[2].position.y = group.children[3].position.y = 0.1;
  return group;
}

/** Een winkel met alles erop en eraan; het bewegende deel staat in `userData.moving`. */
function buildShop(kind: ShopKind, mat?: THREE.Material): THREE.Group {
  const group = build(SHOP_PARTS[kind], mat);
  const extra = SHOP_MOVING[kind];
  if (extra) {
    const moving = build(extra.parts, mat);
    moving.position.y = extra.y;
    group.add(moving);
    group.userData.moving = moving;
  }
  return group;
}
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
  leaf: LEAF_MAT,
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
  private fences = new Map<string, THREE.Mesh>();
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
  private leafMats = [0x4f9e45, 0x5bab4c, 0x468f3e].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 1 }));

  constructor(parent: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    parent.prepend(this.renderer.domElement);
    this.scene.background = new THREE.Color(0xbfe6ff);

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x9ad07a, 1.6));
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

    this.ghostTileMesh.position.y = 0.012;
    this.ghostRing.position.y = 0.014;
    this.ghosts = [this.ghostFenceMesh, this.ghostGateMesh, this.ghostWallMesh, this.ghostNetMesh, this.ghostTroughMesh, ...Object.values(this.ghostBeds), ...Object.values(this.ghostToys), ...Object.values(this.ghostDecors), ...Object.values(this.ghostShops), this.ghostTileMesh, this.ghostRing];
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

  private addTrees(): void {
    const trunk = new THREE.MeshStandardMaterial({ color: 0x8a5a33, roughness: 1 });
    const leaves = this.leafMats;
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 64; i++) {
      const side = i % 4;
      const along = rnd() * (W + 8) - (W + 8) / 2;
      const out = W / 2 + 1.2 + rnd() * 5;
      const x = side === 0 ? along : side === 1 ? out : side === 2 ? along : -out;
      const z = side === 0 ? -out : side === 1 ? along : side === 2 ? out : along;
      const s = 0.8 + rnd() * 0.7;
      const tree = new THREE.Group();
      const t = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.6, 0.22), trunk);
      t.position.y = 0.3;
      const a = new THREE.Mesh(new THREE.BoxGeometry(1, 0.8, 1), leaves[i % 3]);
      a.position.y = 0.95;
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.55, 0.65), leaves[(i + 1) % 3]);
      b.position.y = 1.55;
      tree.add(t, a, b);
      tree.traverse(o => { o.castShadow = true; });
      tree.position.set(x, 0, z);
      tree.scale.setScalar(s);
      tree.rotation.y = rnd() * Math.PI;
      this.scene.add(tree);
    }
  }

  /** Lucht, grasland en bomen rond het park passen bij de wereld. */
  setWorld(world: WorldId): void {
    const look = WORLD_LOOK[world];
    (this.scene.background as THREE.Color).setHex(look.sky);
    this.outerMat.color.setHex(look.ground);
    this.leafMats.forEach((m, i) => m.color.setHex(look.leaves[i]));
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

  paintTerrain(grid: Grid): void {
    const c = new THREE.Color();
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const info = TERRAIN_INFO[TERRAINS[grid.terrain[x + y * W]]];
        this.ground.setColorAt(x + y * W, c.setHex(info.colors[(x + y) % 2]));
      }
    this.ground.instanceColor!.needsUpdate = true;
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
    return kinds.includes(3) ? 3 : kinds.includes(4) ? 4 : 1;
  }

  /** Een hek in een eigen kleur; versleten hout wordt per fase donkerder. */
  private tintMats = new Map<string, THREE.Material>();
  private tintMat(style: number, tint: number, worn: number): THREE.Material {
    const key = `${style}:${tint}:${worn}`;
    let mat = this.tintMats.get(key);
    if (!mat) {
      const color = new THREE.Color(FENCE_COLORS[style as 1 | 3 | 4][tint]).multiplyScalar([1, 0.86, 0.7, 0.54][worn]);
      mat = new THREE.MeshStandardMaterial({ color, roughness: style === 4 ? 0.7 : 0.95 });
      this.tintMats.set(key, mat);
    }
    return mat;
  }

  /** `wear`: per rand hoe versleten het houten hek is (1, 2 of 3). `tints`: per rand de gekozen kleur (zie FENCE_COLORS). */
  syncFences(grid: Grid, wear?: Map<string, number>, tints?: Map<string, number>): void {
    const wanted = new Map<string, { e: Edge; kind: number; style: number; worn: number; tint: number }>();
    for (const item of grid.edges()) {
      const style = item.kind === 2 ? this.gateStyle(grid, item.e) : item.kind;
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
      const geo = kind === 4 ? NET_GEO : kind === 3 ? WALL_GEO : kind === 2 ? GATE_GEO : WORN_GEOS[worn];
      const mesh = new THREE.Mesh(geo, tint ? this.tintMat(style, tint, worn) : style === 3 ? STONE_MAT : style === 4 ? NET_MAT : WORN_MATS[worn]);
      this.placeEdge(mesh, e);
      mesh.castShadow = true;
      this.scene.add(mesh);
      this.fences.set(key, mesh);
    }
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
    this.scene.add(group);
    return group;
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
    const mesh = kind === 4 ? this.ghostNetMesh : kind === 3 ? this.ghostWallMesh : kind === 2 ? this.ghostGateMesh : this.ghostFenceMesh;
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

  update(dt: number): void {
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
}
