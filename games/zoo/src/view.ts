// Het beeld: isometrische camera, tegels, hekken, voerbakken en het voorbeeld van wat je gaat plaatsen.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { BEDS, SHOPS, SHOP_SIZE, TERRAINS, TERRAIN_INFO, type BedKind, type FoodId, type ShopKind, type WorldId } from './data';
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
const LITTER_PARTS: Part[] = [
  [boxAt(0.13, 0.03, 0.1, 0.03, 0.02, 0), WHITE_MAT],
  [boxAt(0.07, 0.11, 0.07, -0.09, 0.055, 0.05), std(0xe0584f)],
  [boxAt(0.09, 0.04, 0.09, 0.06, 0.03, -0.11), std(0xd8a14a)],
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
    this.ghosts = [this.ghostFenceMesh, this.ghostGateMesh, this.ghostWallMesh, this.ghostNetMesh, this.ghostTroughMesh, ...Object.values(this.ghostBeds), ...Object.values(this.ghostShops), this.ghostTileMesh, this.ghostRing];
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

  syncFences(grid: Grid): void {
    const wanted = new Map<string, { e: Edge; kind: number; style: number }>();
    for (const item of grid.edges()) {
      const style = item.kind === 2 ? this.gateStyle(grid, item.e) : item.kind;
      wanted.set(`${edgeKey(item.e)}:${item.kind}:${style}`, { ...item, style });
    }
    for (const [key, mesh] of this.fences)
      if (!wanted.has(key)) {
        this.scene.remove(mesh);
        this.fences.delete(key);
      }
    for (const [key, { e, kind, style }] of wanted) {
      if (this.fences.has(key)) continue;
      const geo = kind === 4 ? NET_GEO : kind === 3 ? WALL_GEO : kind === 2 ? GATE_GEO : FENCE_GEO;
      const mesh = new THREE.Mesh(geo, style === 3 ? STONE_MAT : style === 4 ? NET_MAT : FENCE_MAT);
      this.placeEdge(mesh, e);
      mesh.castShadow = true;
      this.scene.add(mesh);
      this.fences.set(key, mesh);
    }
  }

  // ------------------------------------------------------------ voerbak
  makeTrough(x: number, y: number): TroughMesh {
    const group = new THREE.Group();
    const box = new THREE.Mesh(TROUGH_GEO, WOOD_MAT);
    const bottom = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.02, 0.36), DARK_MAT);
    bottom.position.y = 0.07;
    const food = new THREE.Group();
    group.add(box, bottom, food);
    box.castShadow = true;
    group.position.set(toWorldX(x + 0.5), 0, toWorldZ(y + 0.5));
    this.scene.add(group);
    return { group, food };
  }

  /** Toont net zoveel stukjes voer als er porties in de bak zitten. */
  fillTrough(mesh: TroughMesh, food: FoodId | null, amount: number): void {
    mesh.food.clear();
    if (!food) return;
    for (let i = 0; i < amount; i++) {
      const piece = foodPiece(food);
      piece.position.set(-0.255 + i * 0.17, food === 'hay' ? 0.14 : 0.13, 0);
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

  /** Een winkel met zijn linkerbovenhoek op tegel (x, y); een gebouw beslaat 2 bij 2 tegels. */
  makeShop(x: number, y: number, kind: ShopKind): THREE.Group {
    const group = buildShop(kind);
    group.position.set(toWorldX(x + SHOP_SIZE[kind] / 2), 0, toWorldZ(y + SHOP_SIZE[kind] / 2));
    this.scene.add(group);
    return group;
  }

  ghostShop(x: number, y: number, kind: ShopKind, ok: boolean): void {
    this.ghostMat.color.setHex(ok ? OK_COLOR : BAD_COLOR);
    const ghost = this.ghostShops[kind];
    ghost.position.set(toWorldX(x + SHOP_SIZE[kind] / 2), 0, toWorldZ(y + SHOP_SIZE[kind] / 2));
    ghost.visible = true;
  }

  /** Afval dat een gast op het pad heeft laten vallen. */
  makeLitter(gx: number, gy: number): THREE.Group {
    const group = build(LITTER_PARTS);
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
