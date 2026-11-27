// Het beeld: isometrische camera, tegels, hekken, voerbakken en het voorbeeld van wat je gaat plaatsen.
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  SAFARI, FENCE_COLORS, BEDS, SHOPS, SHOP_SIZE, SHOP_DEEP, onEdge, shopSpan, TERRAINS, type BedKind, type FoodId, type ShopKind, type WorldId, TOYS, type ToyKind, DECORS, type DecorKind, type TroughKind,
  RESTAURANT_TABLES, SHOW_ROWS, STALLS, STRING_HEIGHT, STRING_REACH, TOY_LIFT, TOY_PIVOT, SWING, TRAIN, isPath, type Season, type Sky, PROP, PROPS, type PropKind,
  CROSSING, isRail,
} from './data';
import {
  BUMPER, CAROUSEL, CAROUSEL_SEATS, FERRIS, FOUNTAIN, SEESAW, SLIDE, SPRINGER, SWINGSET, TOWER, TRAMPOLINE, carouselAt, carouselLift, ferrisAngle, ferrisSway, fountainJet,
  AIRBALLOON, COASTER, FLUME, SHIP, SWINGER, balloonAt, lapTime, newSpot, shipAngle, swingerLean, swingerTop, trackAt, trackDist, trackOf, trainCar, type Track, type TrackSpot,
  newRide, seesawTilt, springerTilt, swingAngle, trampolineDip, type RideState,
} from './rides';
import { BASE_LAND, Grid, H, SIDES, W, edgeKey, tileXY, type Edge, type EdgeKind, type Land, type Side } from './grid';
import { SIDE_DX, SIDE_DY, railLinks, railPieces, type RailPiece } from './rails';
import { roadside } from './road';
import { CABLE, CABLE_CORNERS, CABLE_DECK, cableAt, cableClear, cablePath, type CableMast, type CablePath, type CablePole, type CableSeat, type P2 } from './cable';
import { GROUND_HOLE, Ground, aroundTexture } from './ground';
import { partyHue } from './party';
import { WALK } from './walk';
import { SkyDome, useHaze } from './sky';
import { dayLook, newLook } from './daylight';
import { wears } from './wear';

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
/** Een stofwolkje (bolletje met facetjes) en een veertje (smal plaatje), voor het ontsnappen. */
const PUFF_GEO = new THREE.IcosahedronGeometry(1, 0);
const PLUME_GEO = new THREE.PlaneGeometry(0.1, 0.035);
/** Zo lang blijft een veertje: dwarrelen en dan op de grond wegkrimpen. */
const PLUME_SECONDS = 2.4;
/** Hoe een hek meebeweegt met een dier dat ontsnapt (zie wobbleFence), en hoe lang dat duurt. */
export type FenceWobble = 'rattle' | 'lean' | 'bend';
const WOBBLE_SECONDS: Record<FenceWobble, number> = { rattle: 0.4, lean: 1.2, bend: 1.7 };
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
// De poort van een bak van glas: het glas blijft dicht (anders loopt het water eruit), en aan de buitenkant staat een
// houten trapje naar de rand, met gele leuningen. Aan de binnenkant gaat een laddertje het water in. Getekend met de
// buitenkant naar +z; STAIR_BACK_GEO is hetzelfde trapje aan de andere kant van het glas.
const STAIR = { top: 0.74, steps: 4, wide: 0.5, deep: 0.1 };
const stairStep = (i: number): THREE.BufferGeometry => {
  const h = STAIR.top * (1 - i / STAIR.steps);
  return boxAt(STAIR.wide, h, STAIR.deep, 0.5, h / 2, 0.09 + i * STAIR.deep);
};
const STAIR_GEO = painted(
  [0xc58a4b, ...[0, 2].map(stairStep)],
  [0xb07a3f, ...[1, 3].map(stairStep)],
  // de leuningen: aan elke kant twee paaltjes en een schuine stang
  [0x8a8f98, ...[0.27, 0.73].flatMap(x => [boxAt(0.035, 0.32, 0.035, x, STAIR.top + 0.16, 0.07), boxAt(0.035, 0.32, 0.035, x, STAIR.top / STAIR.steps + 0.16, 0.41)])],
  [0xffd23f, ...[0.27, 0.73].map(x => beam(0.04, [x, STAIR.top + 0.32, 0.05], [x, STAIR.top / STAIR.steps + 0.32, 0.43]))],
  // het laddertje aan de binnenkant: over de rand heen en het water in
  [0xd0d6dc, ...[0.38, 0.62].flatMap(x => [beam(0.03, [x, STAIR.top + 0.2, 0.04], [x, STAIR.top + 0.2, -0.1]), boxAt(0.03, STAIR.top + 0.08, 0.03, x, (STAIR.top + 0.32) / 2 - 0.04, -0.1)]),
    ...[0.2, 0.4, 0.6].map(y => boxAt(0.24, 0.03, 0.03, 0.5, y, -0.1))],
);
const STAIR_BACK_GEO = STAIR_GEO.clone().rotateY(Math.PI).translate(1, 0, 0);
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
const BENCH_GEO = painted(
  // de zitting van drie latten (de bovenkant blijft op 0,27), de leuning van drie, en de armleuningen
  [0xc58a4b, boxAt(0.8, 0.04, 0.085, 0, 0.25, -0.075), boxAt(0.8, 0.04, 0.085, 0, 0.25, 0.02), boxAt(0.8, 0.04, 0.085, 0, 0.25, 0.115),
    boxAt(0.8, 0.075, 0.035, 0, 0.38, -0.122), boxAt(0.8, 0.075, 0.035, 0, 0.47, -0.13), boxAt(0.8, 0.075, 0.035, 0, 0.56, -0.138)],
  [0xa8743f, ...[-0.385, 0.385].map(x => boxAt(0.06, 0.035, 0.3, x, 0.4, 0.01))],
  // het onderstel van donker ijzer: poten, een steun onder de zitting, een krul onder elke armleuning en een dwarsstang
  [0x3d4f5a, ...[-0.36, 0.36].flatMap(x => [
    beam(0.05, [x, 0, -0.14], [x, 0.6, -0.15]), boxAt(0.05, 0.24, 0.05, x, 0.12, 0.13), boxAt(0.045, 0.04, 0.26, x, 0.21, 0.01), boxAt(0.07, 0.025, 0.08, x, 0.0125, -0.14), boxAt(0.07, 0.025, 0.08, x, 0.0125, 0.13),
    boxAt(0.045, 0.14, 0.045, x * 1.07, 0.32, 0.13),
    new THREE.TorusGeometry(0.055, 0.014, 4, 10, Math.PI * 1.5).rotateY(Math.PI / 2).translate(x * 1.07, 0.33, 0.03),
  ]), boxAt(0.72, 0.03, 0.03, 0, 0.1, 0.0)],
);
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
  // suikerspinkraam: een lichtblauw zeil met een reuzensuikerspin op het dak; op de tafel de ketel waar de draden
  // in rondgaan, en drie suikerspinnen in een rekje
  candy: [
    ...booth(0xd9f0ff, 0xf9a8c9, 0xf7f4ec, 0x9fd8f5),
    [painted(
      [0xc9ced4, tube(0.2, 0.16, 0.1, -0.5, 0.48, 0.3)],
      [0xfcc4dc, blob(0.15, 1, 0.45, 1, -0.5, 0.56, 0.3)],
      [0xf3e7cf, ...[0.1, 0.42, 0.74].map(x => boxAt(0.016, 0.26, 0.016, x, 0.56, 0.3)), boxAt(0.8, 0.03, 0.12, 0.42, 0.455, 0.3)],
      [0xf9a8c9, blob(0.085, 1, 1.2, 1, 0.1, 0.72, 0.3), blob(0.085, 1, 1.2, 1, 0.74, 0.72, 0.3)],
      [0x9fd8f5, blob(0.085, 1, 1.2, 1, 0.42, 0.72, 0.3)],
    ), PAINT_MAT],
    ...onRoof([
      [tube(0.022, 0.03, 0.62, 0, 1.68, -0.4), std(0xf3e7cf)],
      [merge([ball(0.33, 0, 2.2, -0.4), ball(0.26, -0.2, 2.02, -0.36), ball(0.26, 0.2, 2.04, -0.44), ball(0.24, 0.02, 2.48, -0.4), ball(0.2, -0.16, 2.36, -0.46), ball(0.2, 0.17, 2.34, -0.34)]), std(0xf9a8c9, 1)],
      [merge([ball(0.16, -0.1, 2.56, -0.36), ball(0.15, 0.14, 2.14, -0.2), ball(0.14, -0.24, 2.2, -0.24)]), std(0xfcc4dc, 1)],
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
    // het dak: een rand met daarop een laag schilddak
    [merge([boxAt(1.86, 0.1, 1.6, 0, 1.25, -0.12), new THREE.ConeGeometry(1, 0.42, 4).rotateY(Math.PI / 4).scale(1.24, 1, 1.06).translate(0, 1.51, -0.12)]), std(0x4a90e2)],
    // de donkere deuropening achter elke deur
    [mergeGeometries([boxAt(0.46, 0.84, 0.012, -0.42, 0.44, 0.553), boxAt(0.46, 0.84, 0.012, 0.42, 0.44, 0.553)])!, DARK_MAT, false],
    [mergeGeometries([boxAt(0.2, 0.2, 0.04, -0.42, 1.04, 0.57), boxAt(0.2, 0.2, 0.04, 0.42, 1.04, 0.57)])!, std(0x9fd8f5, 0.4)],
    [boxAt(0.04, 0.5, 0.5, 0.86, 0.75, -0.2), std(0x9fd8f5, 0.4)],
  ],
  // de speeltuin als één gebouw bestaat niet meer (zie SHOPS in data.ts): je bouwt losse toestellen
  playground: [],
  bench: [[BENCH_GEO, MATTE_MAT]],
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
    // groen dat over de rand hangt, en kleine bloemetjes tussen de grote
    [merge([
      painted(
        [0x5fa544, blob(0.07, 1.4, 0.7, 0.8, -0.3, 0.24, 0.12, 0), blob(0.06, 1.4, 0.7, 0.8, 0.12, 0.24, 0.13, 0), blob(0.07, 1.4, 0.7, 0.8, 0.3, 0.24, -0.11, 0), blob(0.06, 1.4, 0.7, 0.8, -0.1, 0.24, -0.12, 0)],
        [0x468f3e, blob(0.045, 1, 1.5, 0.6, -0.33, 0.17, 0.19, 0), blob(0.04, 1, 1.5, 0.6, 0.16, 0.17, 0.19, 0), blob(0.04, 1, 1.5, 0.6, 0.33, 0.17, -0.19, 0)],
      ),
      ...bloom(-0.1, 0.3, 0.1, 0xf7f4ec, 0.04), ...bloom(0.12, 0.31, 0.12, 0xb06ad9, 0.04), ...bloom(0.32, 0.3, -0.08, 0xf7f4ec, 0.04), ...bloom(-0.3, 0.3, -0.06, 0xb06ad9, 0.04),
    ]), PAINT_MAT],
  ],
  // afvalbak: de deksel scharniert om zijn achterrand (zie buildShop)
  bin: [
    [painted(
      [0x3d8b5a, boxAt(0.32, 0.42, 0.32, 0, 0.21, 0)], [0x2c6a43, boxAt(0.34, 0.05, 0.34, 0, 0.025, 0), ...[-1, 1].flatMap(kx => [-1, 1].map(kz => boxAt(0.035, 0.42, 0.035, kx * 0.155, 0.21, kz * 0.155)))],
      [0x58a874, boxAt(0.33, 0.035, 0.33, 0, 0.375, 0)], [0xffd23f, boxAt(0.326, 0.03, 0.326, 0, 0.27, 0)],
    ), PAINT_MAT],
    [mergeGeometries([boxAt(0.38, 0.06, 0.38, 0, 0.03, 0.19), boxAt(0.14, 0.03, 0.05, 0, 0.075, 0.19)])!, std(0x2c6a43)],
    // de voorkant: een donkere inwerpgleuf, een wit plaatje en een voetpedaal, zodat je ziet welke kant hij op staat
    [boxAt(0.24, 0.08, 0.03, 0, 0.31, 0.16), std(0x1f3d2b)],
    [boxAt(0.17, 0.14, 0.02, 0, 0.15, 0.162), WHITE_MAT],
    [boxAt(0.16, 0.03, 0.1, 0, 0.015, 0.21), std(0x8a8f98, 0.6)],
  ],
  // de grote attracties staan verderop, bij hun bewegende delen
  fountain: [],
  carousel: [],
  swinger: [],
  ship: [],
  airballoon: [],
  flume: [],
  coaster: [],
  safari: [],
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

// Steen, water en goud voor de fontein, de vijver en andere dingen. De attracties en speeltoestellen zelf staan
// verderop, bij RIDE_BUILD.
const STONE = std(0xb9c2c9, 0.9);
const WATER_MAT = std(0x6ec3e8, 0.25);
const SPRAY_MAT = std(0xd6f1ff, 0.3);
const GOLD_MAT = std(0xffd23f, 0.5);
const around = <T>(n: number, r: number, make: (x: number, z: number, i: number) => T): T[] =>
  Array.from({ length: n }, (_, i) => make(Math.sin((i / n) * Math.PI * 2) * r, Math.cos((i / n) * Math.PI * 2) * r, i));
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
/**
 * De voeremmer van het aquarium. Hij hangt aan de binnenkant van het glas (het glas ligt op z = -0.5, de bovenkant op
 * 0,74): twee haken over de rand, een blauwe emmer met een witte rand en een hengsel net boven het water (0,42), en een
 * glijgootje naar het water waar het voer in glijdt. De voerder schept er van buiten het voer in.
 */
const BUCKET_Z = -0.3;
const BUCKET_GEO = painted(
  // de haken: over de rand van het glas, aan de buitenkant een stukje omlaag en binnen naar de emmer
  [0x8a8f98, ...[-0.12, 0.12].flatMap(x => [boxAt(0.035, 0.03, 0.2, x, 0.775, -0.5), boxAt(0.035, 0.1, 0.03, x, 0.73, -0.6), boxAt(0.035, 0.03, 0.12, x, 0.775, -0.38)])],
  [0x3f8fd0, tube(0.17, 0.13, 0.26, 0, 0.6, BUCKET_Z)],
  [0xf7f4ec, tube(0.185, 0.185, 0.035, 0, 0.735, BUCKET_Z), tube(0.135, 0.135, 0.03, 0, 0.48, BUCKET_Z)],
  // twee lichte banden: zo zie je dat het een emmer is
  [0x7fbde8, tube(0.158, 0.158, 0.025, 0, 0.64, BUCKET_Z)],
  // het hengsel, rechtop boven de emmer
  [0x6b7480, new THREE.TorusGeometry(0.17, 0.012, 4, 12, Math.PI).translate(0, 0.74, BUCKET_Z)],
  // het glijgootje: van de voorkant van de emmer schuin omlaag naar het water
  [0xffd23f, beam(0.05, [0, 0.62, BUCKET_Z + 0.16], [0, 0.46, BUCKET_Z + 0.38]), beam(0.016, [-0.045, 0.64, BUCKET_Z + 0.16], [-0.045, 0.48, BUCKET_Z + 0.38]), beam(0.016, [0.045, 0.64, BUCKET_Z + 0.16], [0.045, 0.48, BUCKET_Z + 0.38])],
);
/** Het donkere binnenkant van de emmer, waar het voer op ligt. */
const BUCKET_INSIDE_GEO = new THREE.CylinderGeometry(0.16, 0.16, 0.01, 10).translate(0, 0.665, BUCKET_Z);
const BUCKET_INSIDE_MAT = std(0x24557f, 0.8);
const METAL = std(0x8a8f98, 0.6);
const P_RED = std(0xe0584f), P_BLUE = std(0x4a90e2), P_YELLOW = std(0xffd23f, 0.6);
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
const CHERRY_B = leafy(std(0xf48fb1, 1), true), CHERRY_C = leafy(std(0xfdeaf2, 1), true);
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
// ------------------------------------------------------------ zacht, grillig blad
// Kruinen, struiken, de heg en de bloemenboog zijn geen losse bollen meer maar één zachte vorm met bobbels van
// blad, en het licht en donker zit in de vorm zelf (de kleur per hoekpunt, maal de kleur van het materiaal).
/** Bobbels van blad: een getal tussen -1 en 1 dat rustig verandert met de plek; `k` geeft een ander patroon. */
const leafLump = (x: number, y: number, z: number, k = 0): number =>
  Math.sin(x + k * 1.3) * Math.sin(y + k * 2.1) * Math.sin(z + k * 0.7) * 0.65 + Math.sin(x * 0.53 + y * 0.71 + k) * Math.sin(z * 0.61 - y * 0.47 + k * 1.9) * 0.35;
/**
 * De kleur van een hoekpunt van blad, als deel van de kleur van het materiaal: `h` is 0 onderin en 1 bovenop, `b`
 * de bobbel (-1 in een dal, 1 op een bult). Onderin en in de dalen donker, bovenop licht en iets geler.
 */
const leafShade = (out: number[], h: number, b: number, dark = 0.4): void => {
  const k = Math.min(1, Math.max(0, h)), m = Math.min(1, Math.max(0.42, 1 - dark * Math.pow(1 - k, 1.4) + b * 0.17 - 0.08));
  out.push(m * (0.88 + 0.12 * k), m, m * (1 - 0.2 * k));
};
/** Blad met licht en donker in de vorm zelf; kleurt net als het andere blad mee met de seizoenen. */
const leafMat = (hex: number, pink = false): THREE.MeshStandardMaterial => leafy(new THREE.MeshStandardMaterial({ color: hex, roughness: 1, vertexColors: true }), pink);
const CROWN_MAT = leafMat(0x72c152), BUSH_MAT = leafMat(0x5fb048), PINE_MAT = leafMat(0x4fa04a), CHERRY_MAT = leafMat(0xfab5ce, true);
interface LeafLook { detail?: number; bumps?: number; grain?: number; soft?: number; seed?: number; dark?: number }
/**
 * De vorm van een kruin of struik: de bollen in `blobs` smelten in elkaar over tot één zachte vorm. `at` geeft voor
 * een richting vanuit het midden `c` het punt op het oppervlak en de bobbel daar; `low` en `high`: onder- en bovenkant.
 */
function canopyShape(blobs: Blob[], look: LeafLook = {}): { at: (dx: number, dy: number, dz: number) => [number, number, number, number]; c: P3; low: number; high: number } {
  const { bumps = 0.09, grain = 9, soft = 3.2, seed = 0 } = look;
  let cx = 0, cy = 0, cz = 0, w = 0, far = 0, low = Infinity, high = -Infinity;
  for (const [r, x, y, z] of blobs) {
    const m = r * r * r;
    cx += x * m;
    cy += y * m;
    cz += z * m;
    w += m;
    low = Math.min(low, y - r);
    high = Math.max(high, y + r);
  }
  cx /= w;
  cy /= w;
  cz /= w;
  for (const [r, x, y, z] of blobs) far = Math.max(far, Math.hypot(x - cx, y - cy, z - cz) + r * 1.4);
  const field = (px: number, py: number, pz: number): number => {
    let f = 0;
    for (const [r, x, y, z] of blobs) f += Math.exp(-soft * (((px - x) ** 2 + (py - y) ** 2 + (pz - z) ** 2) / (r * r) - 1));
    return f;
  };
  const at = (dx: number, dy: number, dz: number): [number, number, number, number] => {
    // van buiten naar binnen tot we de vorm raken, en dan precies zoeken
    const step = far / 48;
    let t = far;
    while (t > step && field(cx + dx * t, cy + dy * t, cz + dz * t) < 1) t -= step;
    let a = t, b = t + step;
    for (let i = 0; i < 7; i++) {
      const m = (a + b) / 2;
      if (field(cx + dx * m, cy + dy * m, cz + dz * m) >= 1) a = m;
      else b = m;
    }
    // grote bobbels met kleinere eroverheen
    const bump = leafLump(dx * grain, dy * grain, dz * grain, seed) * 0.7 + leafLump(dx * grain * 2.3, dy * grain * 2.3, dz * grain * 2.3, seed + 5) * 0.3, out = a * (1 + bumps * bump);
    return [cx + dx * out, cy + dy * out, cz + dz * out, bump];
  };
  return { at, c: [cx, cy, cz], low, high };
}
/** Een kruin of struik als één zachte vorm (zie canopyShape), met licht en donker in de kleur per hoekpunt. */
function canopy(blobs: Blob[], look: LeafLook = {}): THREE.BufferGeometry {
  const ico = new THREE.IcosahedronGeometry(1, look.detail ?? 5);
  ico.deleteAttribute('uv');
  ico.deleteAttribute('normal');
  const geo = mergeVertices(ico, 1e-4), pos = geo.getAttribute('position'), shape = canopyShape(blobs, look), colors: number[] = [];
  for (let i = 0; i < pos.count; i++) {
    const [x, y, z, b] = shape.at(pos.getX(i), pos.getY(i), pos.getZ(i));
    pos.setXYZ(i, x, y, z);
    leafShade(colors, (y - shape.low) / (shape.high - shape.low), b, look.dark);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return geo;
}
/**
 * Een omwentelingsvorm rond de y-as met bobbels: `at(v, a)` geeft op deel v (0 tot 1) en hoek a de straal, de
 * hoogte, de bobbel en hoe licht het daar is (0 donker tot 1 licht).
 */
function lathe(rows: number, cols: number, at: (v: number, a: number) => [number, number, number, number], dark = 0.4): THREE.BufferGeometry {
  const pos: number[] = [], colors: number[] = [], idx: number[] = [];
  for (let i = 0; i <= rows; i++)
    for (let j = 0; j < cols; j++) {
      const a = (j / cols) * Math.PI * 2, [r, y, b, h] = at(i / rows, a);
      pos.push(Math.sin(a) * r, y, Math.cos(a) * r);
      leafShade(colors, h, b, dark);
    }
  for (let i = 0; i < rows; i++)
    for (let j = 0; j < cols; j++) {
      const j2 = (j + 1) % cols, a = i * cols + j, b = (i + 1) * cols + j, c = (i + 1) * cols + j2, d = i * cols + j2;
      idx.push(a, d, b, d, c, b);
    }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}
/**
 * Een slinger van blad langs een rij punten: om elk punt een ring van `ring` hoekpunten. `side` staat overal dwars
 * op de lijn; `radius(s, a)` geeft op deel s van de lijn en hoek a de dikte en de bobbel. Geeft ook `at(i, a)`: het
 * punt op de slinger bij punt i en hoek a, en de richting naar buiten (om er een bloem op te zetten).
 */
function leafVine(pts: P3[], closed: boolean, side: P3, ring: number, radius: (s: number, a: number) => [number, number], dark = 0.4): { geo: THREE.BufferGeometry; at: (i: number, a: number) => [P3, P3] } {
  const n = pts.length, S = new THREE.Vector3(...side), pos: number[] = [], bumps: number[] = [], colors: number[] = [], idx: number[] = [];
  const at = (i: number, a: number): [P3, P3] => {
    const p0 = pts[closed ? (i - 1 + n) % n : Math.max(0, i - 1)], p1 = pts[closed ? (i + 1) % n : Math.min(n - 1, i + 1)];
    const t = new THREE.Vector3(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]).normalize(), n1 = new THREE.Vector3().crossVectors(S, t).normalize();
    const [rad, bump] = radius(i / (closed ? n : n - 1), a), c = Math.cos(a), d = Math.sin(a), out: P3 = [n1.x * c + S.x * d, n1.y * c + S.y * d, n1.z * c + S.z * d];
    bumps.push(bump);
    return [[pts[i][0] + out[0] * rad, pts[i][1] + out[1] * rad, pts[i][2] + out[2] * rad], out];
  };
  for (let i = 0; i < n; i++) for (let j = 0; j < ring; j++) pos.push(...at(i, (j / ring) * Math.PI * 2)[0]);
  let low = Infinity, high = -Infinity;
  for (let i = 1; i < pos.length; i += 3) {
    low = Math.min(low, pos[i]);
    high = Math.max(high, pos[i]);
  }
  for (let i = 0; i < pos.length / 3; i++) leafShade(colors, high > low + 0.1 ? (pos[i * 3 + 1] - low) / (high - low) : 0.75, bumps[i], dark);
  for (let i = 0; i < (closed ? n : n - 1); i++)
    for (let j = 0; j < ring; j++) {
      const i2 = (i + 1) % n, j2 = (j + 1) % ring, a = i * ring + j, b = i2 * ring + j, c = i2 * ring + j2, d = i * ring + j2;
      idx.push(a, d, b, d, c, b);
    }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return { geo, at };
}
/** `n` richtingen netjes verdeeld over een bol, van hoogte `from` (1 = recht omhoog) tot `to` (-1 = recht omlaag). */
const spiral = (n: number, from = 1, to = 0): P3[] => Array.from({ length: n }, (_, i): P3 => {
  const y = from + ((i + 0.5) / n) * (to - from), r = Math.sqrt(Math.max(0, 1 - y * y)), a = i * 2.39996;
  return [Math.cos(a) * r, y, Math.sin(a) * r];
});

// De kruin van een loofboom: drie vormen, elk een paar bollen die in elkaar overlopen.
const TREE_BLOBS: Blob[][] = [
  [[0.36, 0, 0.95, 0], [0.27, 0.22, 1.2, 0.08], [0.23, -0.18, 1.2, -0.12], [0.2, 0.02, 1.43, -0.02], [0.2, -0.06, 1.0, 0.27], [0.19, 0.1, 1.02, -0.27], [0.3, -0.2, 0.84, 0.12], [0.26, 0.22, 0.82, -0.14]],
  [[0.32, 0, 0.92, 0], [0.28, 0.02, 1.24, 0.02], [0.19, 0, 1.52, 0], [0.2, 0.2, 1.06, 0.14], [0.19, -0.2, 1.1, -0.12], [0.3, 0.08, 0.78, -0.1], [0.2, -0.16, 1.06, 0.14]],
  [[0.34, -0.14, 0.9, 0.06], [0.32, 0.18, 0.94, -0.08], [0.25, 0.02, 1.16, 0], [0.2, -0.02, 0.96, 0.28], [0.19, 0.04, 1.0, -0.28], [0.26, -0.3, 0.76, -0.1], [0.26, 0.28, 0.78, 0.14]],
];
const treeLook = (i: number): LeafLook => ({ detail: 6, bumps: 0.17, grain: 8, seed: 1 + i * 3, dark: 0.48 });
const TREE_SHAPES = TREE_BLOBS.map((blobs, i) => canopyShape(blobs, treeLook(i)));
const TREE_CROWNS = TREE_BLOBS.map((blobs, i) => canopy(blobs, treeLook(i)));
/** Kleine ronde dingen op een kruin (appels, bloesem): op het oppervlak, in de gegeven richtingen. */
const onCrown = (shape: { at: (dx: number, dy: number, dz: number) => [number, number, number, number] }, dirs: P3[], r: number): THREE.BufferGeometry =>
  merge(dirs.map(d => {
    const [x, y, z] = shape.at(...d);
    return new THREE.SphereGeometry(r, 6, 4).translate(x, y, z);
  }));
// appels rondom, halverwege de kruin: de helft van de loofbomen draagt ze (zie varyTree)
const TREE_APPLES = TREE_SHAPES.map(shape => onCrown(shape, spiral(10, 0.4, -0.5), 0.045));
const APPLE_MAT = std(0xd8362e, 0.5);
// bloesem: kleine roze bolletjes over de bovenkant van de kruin (alleen in de lente te zien)
const TREE_BLOSSOMS = TREE_SHAPES.map(shape => onCrown(shape, spiral(26, 0.96, -0.25), 0.05));
// De den: per vorm de lagen, [breedte, hoogte, midden, draaiing]. Elke laag is een rok met een golvende rand,
// bovenaan licht en naar de rand toe donker.
const PINE_TIERS: [number, number, number, number][][] = [
  [[0.42, 0.5, 0.5, 0], [0.34, 0.46, 0.8, 0.5], [0.25, 0.42, 1.08, 1], [0.15, 0.36, 1.34, 1.5]],
  [[0.34, 0.55, 0.56, 0], [0.28, 0.5, 0.9, 0.5], [0.21, 0.46, 1.22, 1], [0.14, 0.4, 1.5, 1.5], [0.08, 0.3, 1.72, 2]],
  [[0.46, 0.6, 0.56, 0], [0.36, 0.55, 0.94, 0.5], [0.24, 0.48, 1.28, 1]],
];
const pineTier = ([r, h, y, turn]: [number, number, number, number]): THREE.BufferGeometry => {
  const base = y - h / 2;
  return lathe(8, 14, (v, a) => {
    // eerst de onderkant van de rok (donker), dan van de golvende rand omhoog naar de punt
    if (v < 0.2) return [r * 0.96 * (v / 0.2), base + 0.07 * (1 - v / 0.2), -0.8, 0];
    const u = (v - 0.2) / 0.8, wave = Math.cos(7 * a + turn * 3), edge = (1 - u) * (1 - u);
    return [r * Math.pow(1 - u, 1.1) * (1 + 0.14 * edge * wave) + 0.004, base + h * Math.pow(u, 0.85) - 0.03 * edge * (1 - wave), wave * edge * 0.7, 0.2 + 0.8 * u];
  }, 0.5);
};
const PINE_CROWNS = PINE_TIERS.map(tiers => merge(tiers.map(pineTier)));
// De kersenboom: één zachte roze kruin.
const CHERRY_BLOBS: Blob[] = [
  [0.38, 0, 0.9, 0], [0.26, -0.22, 1.08, -0.1], [0.26, 0.22, 1.16, 0.06], [0.16, 0.05, 1.36, -0.05], [0.18, -0.06, 1.24, 0.2],
  [0.2, 0.26, 0.86, -0.16], [0.2, 0.05, 0.98, 0.3], [0.2, -0.3, 0.84, 0.12], [0.17, 0.28, 0.95, 0.2], [0.17, -0.02, 1.02, -0.3],
];
const CHERRY_LOOK: LeafLook = { detail: 6, bumps: 0.16, grain: 8.5, seed: 5, dark: 0.32 };
const CHERRY_SHAPE = canopyShape(CHERRY_BLOBS, CHERRY_LOOK);
// De heg: een lange bolle rug met bobbels, precies een tegel lang; de bobbels sluiten aan op de heg ernaast.
const HEDGE_W = 0.17, HEDGE_H = 0.5;
/** Het punt op de heg op plek x (-0,5 tot 0,5) en deel p van de dwarsdoorsnede (0 = voor onderaan, 1 = achter onderaan). */
const hedgeAt = (x: number, p: number): [number, number, number, number] => {
  const phi = p * Math.PI, c = Math.cos(phi), w = Math.PI * 2 * x;
  const b = 0.45 * Math.sin(w * 2 + 3 * phi) * Math.sin(4 * phi + w) + 0.33 * Math.sin(w * 5 - 5 * phi + 1) + 0.24 * Math.sin(w * 3 + 7 * phi + 2) + 0.2 * Math.sin(w * 8 + 9 * phi), k = 1 + 0.12 * b;
  // (een geknipte heg: bijna recht aan de zijkanten en vlak bovenop, met ronde hoeken)
  return [x, Math.pow(Math.sin(phi), 0.36) * HEDGE_H * k, Math.sign(c) * Math.pow(Math.abs(c), 0.36) * HEDGE_W * k, b];
};
function hedgeGeo(): THREE.BufferGeometry {
  const nx = 24, np = 14, pos: number[] = [], colors: number[] = [], idx: number[] = [];
  for (let i = 0; i <= nx; i++)
    for (let j = 0; j <= np; j++) {
      const [x, y, z, b] = hedgeAt(i / nx - 0.5, j / np);
      pos.push(x, y, z);
      leafShade(colors, y / HEDGE_H, b, 0.45);
    }
  for (let i = 0; i < nx; i++)
    for (let j = 0; j < np; j++) {
      const a = i * (np + 1) + j, b = a + np + 1, c = b + 1, d = a + 1;
      idx.push(a, b, d, b, c, d);
    }
  // de twee kopse kanten: vlak, zodat een rij heggen netjes aansluit
  for (const end of [-0.5, 0.5]) {
    const first = pos.length / 3;
    pos.push(end, 0.2, 0);
    colors.push(0.6, 0.62, 0.55);
    for (let j = 0; j <= np; j++) {
      const [x, y, z] = hedgeAt(end, j / np);
      pos.push(x, y, z);
      colors.push(0.62, 0.66, 0.56);
    }
    for (let j = 0; j < np; j++) idx.push(first, end < 0 ? first + 1 + j : first + 2 + j, end < 0 ? first + 2 + j : first + 1 + j);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}
// De buxus: een geknipte kegel met een spiraal erin, boven een kort stammetje.
const topiaryGeo = (): THREE.BufferGeometry => lathe(30, 18, (v, a) => {
  const y = 0.42 + 1.02 * v, groove = Math.cos(a - v * 19), close = Math.min(1, v / 0.05);
  const r = (0.29 * Math.pow(1 - v, 0.85) + 0.012) * (0.87 + 0.13 * groove) * close * (1 + 0.03 * leafLump(a * 5, v * 40, 0, 2));
  return [r, y, groove * 0.9, 0.15 + 0.85 * v];
}, 0.42);
/** Welke onderdelen van een boom blad zijn (die krijgen een eigen tint) en welke de kruin (die krijgt een eigen vorm). */
const TREE_LOOK: Partial<Record<DecorKind, { leaf: number[]; crown: number[] }>> = {
  tree: { leaf: [1], crown: [1, 2] },
  pine: { leaf: [1], crown: [1] },
  palm: { leaf: [1], crown: [] },
  cherry: { leaf: [1, 3], crown: [1, 3] },
  bamboogrove: { leaf: [0, 1], crown: [] },
  topiary: { leaf: [2], crown: [2] },
  cactus: { leaf: [0, 1], crown: [] },
};

// ------------------------------------------------------------ de nieuwere gebouwen
/** De vloer onder een gebouw van `wide` bij `deep` tegels: net iets kleiner dan zijn tegels. */
const floorOf = (color = 0xd8c7ab, wide = 2, deep = wide): Part => [boxAt(wide - 0.16, 0.05, deep - 0.16, 0, 0.025, 0), std(color, 1), false];
const CORNERS: [number, number][] = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
const P_GREEN = std(0x6cc04a);
/** Een lantaarn op een paal van `h` hoog: [de paal, het lampje]. */
const lampPost = (x: number, z: number, h: number): [THREE.BufferGeometry, THREE.BufferGeometry] =>
  [merge([tube(0.022, 0.03, h, x, h / 2, z), tube(0.06, 0.045, 0.05, x, 0.025, z), tube(0.05, 0.03, 0.04, x, h + 0.01, z)]), ball(0.075, x, h + 0.09, z)];
// Restaurant (3 bij 2 tegels): linksachter de keuken, met een doorgeefluik, een toonbank, een gestreepte rand
// erboven en de kok achter het luik. (Geen luifel die uitsteekt: van schuin boven zou die de kok verstoppen.) Op het
// terras ervoor en ernaast staan vier ronde tafels met elk twee krukken en een parasol (de tafels staan in
// rides.ts: daar zitten de gasten). Op het dak staat een bord met een bord, een vork en een mes; op de hoeken van
// het terras staan lantaarns en achteraan een bloembak.
const KITCHEN = { x0: -1.4, x1: 0.26, z0: -0.92, z1: -0.16, h: 1.3 };
const KX = (KITCHEN.x0 + KITCHEN.x1) / 2, KZ = (KITCHEN.z0 + KITCHEN.z1) / 2, KW = KITCHEN.x1 - KITCHEN.x0;
/** Het luik in de voorgevel: van x tot x, en van hoog tot hoog. */
const HATCH = [-1.12, -0.08, 0.5, 1.1];
/** Waar de kok staat (x, z): links achter het luik, vlak bij de toonbank. Daar zie je hem tussen de parasols door. */
const CHEF: [number, number] = [-0.94, KITCHEN.z1 - 0.13];
const RESTAURANT_LAMPS: [number, number][] = [[-1.4, 0.92], [1.4, 0.92], [1.4, -0.9]];
const PARASOLS = [0xe0584f, 0xffd23f, 0x4a90e2, 0x6cc04a];
/** Eén baan van de gestreepte rand boven het luik, `i` banen van links (er zijn er acht). */
const fasciaStripe = (i: number): THREE.BufferGeometry =>
  boxAt(KW / 8, KITCHEN.h - HATCH[3], 0.014, KITCHEN.x0 + (i + 0.5) * (KW / 8), (KITCHEN.h + HATCH[3]) / 2, KITCHEN.z1 + 0.006);
SHOP_PARTS.restaurant = [
  floorOf(0xe9d9b8, 3, 2),
  // de parasols: los, zodat ze kunnen wiegen (zie SHOP_BOB)
  ...RESTAURANT_TABLES.map(([x, z], i): Part => [striped(new THREE.ConeGeometry(0.36, 0.2, 8), [PARASOLS[i % PARASOLS.length], 0xf7f4ec], 8).translate(x, 1.42, z), PAINT_MAT]),
  // de kok achter het luik, met zijn armen op de toonbank: ook los, hij wiebelt een beetje (zie SHOP_BOB)
  [painted(
    [0xf7f4ec, boxAt(0.22, 0.3, 0.14, CHEF[0], 0.64, CHEF[1]), boxAt(0.17, 0.06, 0.15, CHEF[0], 0.96, CHEF[1]), boxAt(0.21, 0.07, 0.19, CHEF[0], 1.02, CHEF[1]),
      boxAt(0.06, 0.06, 0.2, CHEF[0] - 0.14, 0.72, CHEF[1] + 0.08), boxAt(0.06, 0.06, 0.2, CHEF[0] + 0.14, 0.72, CHEF[1] + 0.08)],
    [0xe8b48a, boxAt(0.15, 0.14, 0.14, CHEF[0], 0.86, CHEF[1])],
    [0x22201c, dot(0.014, CHEF[0] - 0.035, 0.875, CHEF[1] + 0.07), dot(0.014, CHEF[0] + 0.035, 0.875, CHEF[1] + 0.07)],
    [0xe0584f, boxAt(0.1, 0.03, 0.02, CHEF[0], 0.78, CHEF[1] + 0.071)],
  ), PAINT_MAT],
  // de keuken: de muren om het luik heen, de rode onderkant, het dak en binnen een donkere wand
  [painted(
    [0xf3ead6, boxAt(KW, KITCHEN.h, 0.07, KX, KITCHEN.h / 2, KITCHEN.z0 + 0.035), boxAt(0.07, KITCHEN.h, KITCHEN.z1 - KITCHEN.z0, KITCHEN.x0 + 0.035, KITCHEN.h / 2, KZ),
      boxAt(0.07, KITCHEN.h, KITCHEN.z1 - KITCHEN.z0, KITCHEN.x1 - 0.035, KITCHEN.h / 2, KZ), boxAt(KW, KITCHEN.h - HATCH[3], 0.07, KX, (KITCHEN.h + HATCH[3]) / 2, KITCHEN.z1 - 0.035),
      boxAt(HATCH[0] - KITCHEN.x0, HATCH[3] - HATCH[2], 0.07, (HATCH[0] + KITCHEN.x0) / 2, (HATCH[2] + HATCH[3]) / 2, KITCHEN.z1 - 0.035),
      boxAt(KITCHEN.x1 - HATCH[1], HATCH[3] - HATCH[2], 0.07, (HATCH[1] + KITCHEN.x1) / 2, (HATCH[2] + HATCH[3]) / 2, KITCHEN.z1 - 0.035)],
    [0xc9553f, boxAt(KW + 0.02, HATCH[2], 0.08, KX, HATCH[2] / 2, KITCHEN.z1 - 0.035), boxAt(KW + 0.14, 0.07, KITCHEN.z1 - KITCHEN.z0 + 0.12, KX, KITCHEN.h + 0.035, KZ)],
    [0xa8432f, boxAt(KW + 0.18, 0.04, KITCHEN.z1 - KITCHEN.z0 + 0.16, KX, KITCHEN.h + 0.005, KZ),
      // de achterdeur
      boxAt(0.3, 0.72, 0.012, KX + 0.3, 0.36, KITCHEN.z0 - 0.003)],
    [0x3a332e, boxAt(KW - 0.14, KITCHEN.h - 0.1, 0.03, KX, KITCHEN.h / 2, KITCHEN.z1 - 0.42)],
    // een raampje rechts van het luik, en een in de zijmuur en de achtermuur
    [0x9fd8f5, boxAt(0.2, 0.26, 0.012, (HATCH[1] + KITCHEN.x1) / 2, 0.82, KITCHEN.z1 + 0.003), boxAt(0.012, 0.26, 0.3, KITCHEN.x0 - 0.003, 0.82, KZ), boxAt(0.34, 0.26, 0.012, KX - 0.42, 0.82, KITCHEN.z0 - 0.003)],
  ), MATTE_MAT],
  // de toonbank, de witte banen van de rand boven het luik, de tafels en de bloembak
  [painted(
    [0xf7f4ec, boxAt(HATCH[1] - HATCH[0] + 0.1, 0.04, 0.22, (HATCH[0] + HATCH[1]) / 2, HATCH[2], KITCHEN.z1 + 0.03), ...[1, 3, 5, 7].map(fasciaStripe),
      ...RESTAURANT_TABLES.flatMap(([x, z]) => [tube(0.2, 0.2, 0.04, x, 0.4, z), tube(0.03, 0.07, 0.38, x, 0.19, z)])],
    [0xe0584f, ...[0, 2, 4, 6].map(fasciaStripe), ...RESTAURANT_TABLES.flatMap(([x, z]) => [-0.27, 0.27].flatMap(d => [tube(0.085, 0.085, 0.05, x + d, 0.215, z), tube(0.025, 0.05, 0.19, x + d, 0.095, z)]))],
    // op elke tafel een bord eten, een beker en een bakje sla
    [0xf08a24, ...RESTAURANT_TABLES.map(([x, z]) => tube(0.055, 0.055, 0.016, x - 0.07, 0.428, z + 0.03))],
    [0xffd23f, ...RESTAURANT_TABLES.map(([x, z]) => tube(0.026, 0.02, 0.05, x + 0.08, 0.445, z - 0.05))],
    [0x6cc04a, ...RESTAURANT_TABLES.map(([x, z]) => blob(0.04, 1, 0.6, 1, x + 0.04, 0.44, z + 0.09, 0)),
      // de struikjes in de bloembak
      ...[0.5, 0.74, 0.98, 1.22].map((x, i) => blob(0.1, 1, 0.8 + (i % 2) * 0.2, 0.8, x, 0.27, -0.9))],
    [0xa8743f, boxAt(1, 0.16, 0.16, 0.86, 0.13, -0.9)],
    // het bord op het dak: een bord met een vork en een mes
    [0x4a90e2, boxAt(0.74, 0.34, 0.05, KX, KITCHEN.h + 0.3, KITCHEN.z1 - 0.12), boxAt(0.05, 0.14, 0.05, KX - 0.28, KITCHEN.h + 0.11, KITCHEN.z1 - 0.12), boxAt(0.05, 0.14, 0.05, KX + 0.28, KITCHEN.h + 0.11, KITCHEN.z1 - 0.12)],
    [0xf7f4ec, new THREE.CylinderGeometry(0.1, 0.1, 0.02, 12).rotateX(Math.PI / 2).translate(KX, KITCHEN.h + 0.3, KITCHEN.z1 - 0.09),
      boxAt(0.022, 0.22, 0.02, KX - 0.2, KITCHEN.h + 0.3, KITCHEN.z1 - 0.09), boxAt(0.07, 0.022, 0.02, KX - 0.2, KITCHEN.h + 0.36, KITCHEN.z1 - 0.09),
      ...[-0.03, 0.03].map(d => boxAt(0.016, 0.06, 0.02, KX - 0.2 + d, KITCHEN.h + 0.39, KITCHEN.z1 - 0.09)),
      boxAt(0.022, 0.12, 0.02, KX + 0.2, KITCHEN.h + 0.25, KITCHEN.z1 - 0.09), boxAt(0.04, 0.12, 0.02, KX + 0.205, KITCHEN.h + 0.36, KITCHEN.z1 - 0.09)],
    [0xe9d9b8, new THREE.CylinderGeometry(0.065, 0.065, 0.024, 12).rotateX(Math.PI / 2).translate(KX, KITCHEN.h + 0.3, KITCHEN.z1 - 0.085)],
    // het menubord, tegen de gevel naast het luik
    [0x3d4f5a, new THREE.BoxGeometry(0.24, 0.4, 0.02).rotateX(-0.2).translate((HATCH[1] + KITCHEN.x1) / 2, 0.2, KITCHEN.z1 + 0.09)],
    [0xf7f4ec, ...[0.1, 0.02, -0.06].map((y, i) => new THREE.BoxGeometry(0.16 - i * 0.03, 0.022, 0.024).translate(-i * 0.015, y, 0).rotateX(-0.2).translate((HATCH[1] + KITCHEN.x1) / 2, 0.2, KITCHEN.z1 + 0.09))],
  ), PAINT_MAT],
  // de schoorsteen, een pan op de toonbank, de stokken van de parasols en de palen van de lantaarns
  [merge([
    boxAt(0.14, 0.3, 0.14, KITCHEN.x0 + 0.3, KITCHEN.h + 0.2, KITCHEN.z0 + 0.22), boxAt(0.2, 0.03, 0.2, KITCHEN.x0 + 0.3, KITCHEN.h + 0.38, KITCHEN.z0 + 0.22),
    tube(0.09, 0.08, 0.07, HATCH[1] - 0.3, HATCH[2] + 0.055, KITCHEN.z1 + 0.04), boxAt(0.14, 0.02, 0.03, HATCH[1] - 0.16, HATCH[2] + 0.06, KITCHEN.z1 + 0.04),
    ...RESTAURANT_TABLES.map(([x, z]) => tube(0.014, 0.014, 0.92, x, 0.88, z)),
    ...RESTAURANT_LAMPS.map(([x, z]) => lampPost(x, z, 1.4)[0]),
  ]), METAL],
  [merge(RESTAURANT_LAMPS.map(([x, z]) => lampPost(x, z, 1.4)[1])), LAMP_MAT, false],
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
    // het kastje van de baas, met een groene en een rode knop: smal en op een paaltje tegen de rand, want wie van
    // opzij komt, loopt er vooromlangs naar de opening
    [0x4a90e2, boxAt(0.46, 0.3, 0.14, -1.45, 0.62, HALL.front + 0.07), boxAt(0.07, 0.48, 0.07, -1.45, 0.24, HALL.front + 0.07)],
    [0xf7f4ec, boxAt(0.5, 0.03, 0.18, -1.45, 0.785, HALL.front + 0.07)],
    [0x6cc04a, tube(0.04, 0.04, 0.03, -1.55, 0.815, HALL.front + 0.07)],
    [0xe0584f, tube(0.04, 0.04, 0.03, -1.35, 0.815, HALL.front + 0.07), ...HALL_POSTS.map(([x, z]) => boxAt(0.1, HALL.eave, 0.1, x, HALL.eave / 2, z))],
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

// Uitkijktoren (2 bij 2 tegels, en hoog): vier palen met een trap ertussen die in vier stukken omhoog loopt, langs
// elke kant één stuk, met een bordesje op elke hoek. Boven ligt de vloer met een hek eromheen (en een gat waar de
// trap bovenkomt), een verrekijker op een paal, en een puntdak met een lantaarn eronder en een vlag erop.
const TW = TOWER;
const TOWER_POST = 0.8, TOWER_DECK = 0.86, TOWER_ROOF = TW.top + 1.02;
/** De hoeken van de trap, van onder naar boven (zie towerWay in rides.ts): (x, hoogte, z). */
const TOWER_STEPS: P3[] = [[1, 0, 1], [1, 0.25, -1], [-1, 0.5, -1], [-1, 0.75, 1], [1, 1, 1]].map(([x, h, z]): P3 => [x * TW.stair, h * TW.top, z * TW.stair]);
/** Eén stuk trap van a naar b (recht langs x of langs z): de treden, of (met `frame`) de twee bomen en de leuning aan de buitenkant. */
const towerFlight = (a: P3, b: P3, frame: boolean): THREE.BufferGeometry[] => {
  const alongX = Math.abs(b[0] - a[0]) > Math.abs(b[2] - a[2]), n = 6, wide = 0.36, run = (alongX ? Math.abs(b[0] - a[0]) : Math.abs(b[2] - a[2])) / n;
  // de buitenkant: de kant van het midden van de toren af
  const out = alongX ? Math.sign(a[2]) : Math.sign(a[0]);
  const side = (p: P3, off: number, lift: number): P3 => (alongX ? [p[0], p[1] + lift, p[2] + off] : [p[0] + off, p[1] + lift, p[2]]);
  if (frame)
    return [
      beam(0.045, side(a, -wide / 2, -0.05), side(b, -wide / 2, -0.05)), beam(0.045, side(a, wide / 2, -0.05), side(b, wide / 2, -0.05)),
      beam(0.035, side(a, (out * wide) / 2, 0.36), side(b, (out * wide) / 2, 0.36)),
      ...[0.1, 0.5, 0.9].map(t => {
        const p: P3 = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
        return beam(0.03, side(p, (out * wide) / 2, -0.04), side(p, (out * wide) / 2, 0.36));
      }),
    ];
  return Array.from({ length: n }, (_, i) => {
    // (de bovenkant van elke trede ligt op de lijn waarlangs de gasten lopen)
    const t = (i + 0.5) / n, x = a[0] + (b[0] - a[0]) * t, z = a[2] + (b[2] - a[2]) * t, y = a[1] + (b[1] - a[1]) * t - 0.015;
    return alongX ? boxAt(run + 0.02, 0.03, wide, x, y, z) : boxAt(wide, 0.03, run + 0.02, x, y, z);
  });
};
/** Een stuk hek boven op de toren, van (x0, z0) naar (x1, z1): twee leuningen en paaltjes. */
const towerRail = (x0: number, z0: number, x1: number, z1: number): THREE.BufferGeometry[] => {
  const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(len / 0.3));
  return [
    beam(0.04, [x0, TW.top + 0.42, z0], [x1, TW.top + 0.42, z1]), beam(0.03, [x0, TW.top + 0.22, z0], [x1, TW.top + 0.22, z1]),
    ...Array.from({ length: n + 1 }, (_, i) => boxAt(0.035, 0.42, 0.035, x0 + ((x1 - x0) * i) / n, TW.top + 0.21, z0 + ((z1 - z0) * i) / n)),
  ];
};
// het gat in de vloer waar de trap bovenkomt: van links tot `x1`, tussen z0 en z1
const TOWER_HOLE = { x0: -0.62, x1: 0.3, z0: 0.22, z1: 0.62 };
SHOP_PARTS.tower = [
  floorOf(),
  [painted(
    // de vier palen, met schoren achter en links, en dwarsbalken op de hoogte van elk bordes
    [0x97673a,
      ...CORNERS.map(([x, z]) => boxAt(0.11, TOWER_ROOF, 0.11, x * TOWER_POST, TOWER_ROOF / 2, z * TOWER_POST)),
      ...[0, 1].flatMap(i => {
        const lo = 0.12 + i * (TW.top / 2), hi = lo + TW.top / 2 - 0.2;
        return [
          beam(0.05, [-TOWER_POST, lo, -TOWER_POST], [TOWER_POST, hi, -TOWER_POST]), beam(0.05, [TOWER_POST, lo, -TOWER_POST], [-TOWER_POST, hi, -TOWER_POST]),
          beam(0.05, [-TOWER_POST, lo, -TOWER_POST], [-TOWER_POST, hi, TOWER_POST]), beam(0.05, [-TOWER_POST, lo, TOWER_POST], [-TOWER_POST, hi, -TOWER_POST]),
        ];
      }),
      ...[0.5, 1].flatMap(k => [boxAt(TOWER_POST * 2, 0.06, 0.06, 0, TW.top * k - 0.11, TOWER_POST), boxAt(0.06, 0.06, TOWER_POST * 2, TOWER_POST, TW.top * k - 0.11, 0)]),
      ...TOWER_STEPS.slice(0, 4).flatMap((a, i) => towerFlight(a, TOWER_STEPS[i + 1], true)),
    ],
    // de treden, de bordesjes op de hoeken en de vloer boven (met het trapgat)
    [0xe3c08a,
      ...TOWER_STEPS.slice(0, 4).flatMap((a, i) => towerFlight(a, TOWER_STEPS[i + 1], false)),
      ...TOWER_STEPS.slice(1, 4).map(([x, y, z]) => boxAt(0.5, 0.04, 0.5, x * 1.2, y - 0.02, z * 1.2)),
      boxAt(TOWER_DECK * 2, 0.07, TOWER_HOLE.z0 + TOWER_DECK, 0, TW.top - 0.035, (TOWER_HOLE.z0 - TOWER_DECK) / 2),
      boxAt(TOWER_DECK * 2, 0.07, TOWER_DECK - TOWER_HOLE.z1, 0, TW.top - 0.035, (TOWER_DECK + TOWER_HOLE.z1) / 2),
      boxAt(TOWER_HOLE.x0 + TOWER_DECK, 0.07, TOWER_HOLE.z1 - TOWER_HOLE.z0, (TOWER_HOLE.x0 - TOWER_DECK) / 2, TW.top - 0.035, (TOWER_HOLE.z0 + TOWER_HOLE.z1) / 2),
      boxAt(TOWER_DECK - TOWER_HOLE.x1, 0.07, TOWER_HOLE.z1 - TOWER_HOLE.z0, (TOWER_DECK + TOWER_HOLE.x1) / 2, TW.top - 0.035, (TOWER_HOLE.z0 + TOWER_HOLE.z1) / 2)],
    // het hek om de vloer en om het trapgat
    [0xf7f4ec,
      ...towerRail(-TOWER_DECK, -TOWER_DECK, TOWER_DECK, -TOWER_DECK), ...towerRail(-TOWER_DECK, -TOWER_DECK, -TOWER_DECK, TOWER_DECK),
      ...towerRail(TOWER_DECK, -TOWER_DECK, TOWER_DECK, TOWER_DECK), ...towerRail(-TOWER_DECK, TOWER_DECK, TOWER_DECK, TOWER_DECK),
      ...towerRail(TOWER_HOLE.x0, TOWER_HOLE.z0, TOWER_HOLE.x1 - 0.1, TOWER_HOLE.z0)],
    // de verrekijker op zijn paal, linksvoor
    [0x4a90e2, tube(0.025, 0.035, 0.42, -0.68, TW.top + 0.21, 0.74), new THREE.CylinderGeometry(0.06, 0.05, 0.2, 8).rotateX(Math.PI / 2 - 0.25).rotateY(-0.6).translate(-0.68, TW.top + 0.47, 0.74)],
  ), MATTE_MAT],
  // het puntdak met een rand eronder en de vlaggenstok
  [painted(
    [0xe0584f, cone(1.3, 0.62, 0, TOWER_ROOF + 0.31, 0, 4)],
    [0xb8433b, boxAt(1.86, 0.06, 1.86, 0, TOWER_ROOF + 0.01, 0)],
    [0xf7f4ec, boxAt(0.035, 0.6, 0.035, 0, TOWER_ROOF + 0.9, 0), boxAt(0.08, 0.08, 0.08, 0, TOWER_ROOF + 1.22, 0)],
  ), PAINT_MAT],
  // de lantaarn onder het dak en een lampje op elke hoek van het dak
  [merge([ball(0.1, 0, TOWER_ROOF - 0.16, 0), tube(0.012, 0.012, 0.14, 0, TOWER_ROOF - 0.04, 0), ...CORNERS.map(([x, z]) => dot(0.055, x * 0.9, TOWER_ROOF - 0.04, z * 0.9))]), LAMP_MAT, false],
  // de vlag: los, zodat hij kan wapperen (zie SHOP_BOB)
  [boxAt(0.34, 0.2, 0.02, 0.19, TOWER_ROOF + 1.06, 0), P_YELLOW],
];

// ------------------------------------------------------------ de speeltoestellen, elk in zijn eigen maat
/** De zachte vloer onder een speeltoestel van `wide` bij `deep` tegels: een oranje mat met een donkere rand. */
const playFloor = (wide: number, deep: number): Part => {
  const w = wide - 0.16, d = deep - 0.16;
  return [painted(
    [0xe9b66b, boxAt(w, 0.04, d, 0, 0.02, 0)],
    [0xd39b4e, boxAt(w, 0.05, 0.06, 0, 0.025, -d / 2 + 0.03), boxAt(w, 0.05, 0.06, 0, 0.025, d / 2 - 0.03), boxAt(0.06, 0.05, d - 0.12, -w / 2 + 0.03, 0.025, 0), boxAt(0.06, 0.05, d - 0.12, w / 2 - 0.03, 0.025, 0)],
  ), MATTE_MAT, false];
};

// Glijbaan (2 bij 3 tegels): achteraan een torentje met een dak, rechts de trap ernaartoe en links de lange gele
// glijbaan, die onderaan bijna vlak uitloopt. De kinderen lopen in een rondje: de trap op, over het torentje, de
// glijbaan af en vooromlangs terug naar de trap.
const SL = SLIDE;
const SLIDE_ROOF = SL.top + 0.95;
/** Een schuin stuk van de glijbaan, van (z0, h0) naar (z1, h1): `wide` breed en `thick` dik, `lift` boven de baan zelf en `x` opzij. */
const chutePiece = (z0: number, h0: number, z1: number, h1: number, wide: number, thick: number, lift: number, x: number): THREE.BufferGeometry =>
  new THREE.BoxGeometry(wide, thick, Math.hypot(z1 - z0, h1 - h0)).rotateX(Math.atan2(h0 - h1, z1 - z0)).translate(SL.chuteX + x, (h0 + h1) / 2 + lift, (z0 + z1) / 2);
const chute = (wide: number, thick: number, lift: number, x = 0): THREE.BufferGeometry[] => [
  chutePiece(SL.chuteTop - 0.04, SL.top, SL.chuteBend, SL.bendH, wide, thick, lift, x), chutePiece(SL.chuteBend - 0.02, SL.bendH, SL.chuteEnd + 0.03, SL.endH, wide, thick, lift, x),
];
const SLIDE_POSTS: [number, number][] = [[-0.84, SL.back - 0.36], [0.84, SL.back - 0.36], [-0.84, SL.chuteTop + 0.02], [0.84, SL.chuteTop + 0.02]];
SHOP_PARTS.slide = [
  playFloor(2, 3),
  [painted(
    // het torentje: vier palen en de vloer, met een hek achter en opzij
    [0xa8743f, ...SLIDE_POSTS.map(([x, z]) => boxAt(0.09, SLIDE_ROOF, 0.09, x, SLIDE_ROOF / 2, z)),
      // de bomen van de trap en de poten onder de glijbaan
      ...[-0.21, 0.21].map(x => beam(0.05, [SL.stairX + x, 0, SL.stairFoot - 0.08], [SL.stairX + x, SL.top - 0.04, SL.stairTop])),
      ...[-0.2, 0.2].flatMap(x => [boxAt(0.05, SL.bendH, 0.05, SL.chuteX + x, SL.bendH / 2 - 0.02, SL.chuteBend), boxAt(0.05, SL.endH, 0.05, SL.chuteX + x, SL.endH / 2 - 0.02, SL.chuteEnd - 0.06)])],
    [0x4a90e2, boxAt(1.76, 0.07, SL.chuteTop - SL.back + 0.44, 0, SL.top - 0.035, (SL.chuteTop + SL.back - 0.36) / 2 + 0.01)],
    // de treden
    [0xe3c08a, ...Array.from({ length: 9 }, (_, i) => boxAt(0.42, 0.03, 0.17, SL.stairX, (SL.top * (i + 0.5)) / 9 - 0.015, SL.stairFoot + ((SL.stairTop - SL.stairFoot) * (i + 0.5)) / 9))],
    // de leuningen van de trap en het hek om het torentje
    [0xe0584f,
      ...[-0.21, 0.21].flatMap(x => [
        beam(0.035, [SL.stairX + x, 0.42, SL.stairFoot - 0.08], [SL.stairX + x, SL.top + 0.4, SL.stairTop]),
        boxAt(0.035, 0.44, 0.035, SL.stairX + x, 0.21, SL.stairFoot - 0.08), beam(0.03, [SL.stairX + x, SL.top / 2 - 0.05, (SL.stairFoot + SL.stairTop) / 2], [SL.stairX + x, SL.top / 2 + 0.4, (SL.stairFoot + SL.stairTop) / 2])]),
      boxAt(1.68, 0.04, 0.04, 0, SL.top + 0.4, SL.back - 0.36), boxAt(1.68, 0.03, 0.03, 0, SL.top + 0.2, SL.back - 0.36),
      ...[-0.84, 0.84].flatMap(x => [boxAt(0.04, 0.04, SL.chuteTop - SL.back + 0.38, x, SL.top + 0.4, (SL.chuteTop + SL.back - 0.36) / 2), boxAt(0.03, 0.03, SL.chuteTop - SL.back + 0.38, x, SL.top + 0.2, (SL.chuteTop + SL.back - 0.36) / 2)]),
      boxAt(0.52, 0.04, 0.04, 0.03, SL.top + 0.4, SL.chuteTop + 0.02), boxAt(0.04, 0.4, 0.04, 0.03, SL.top + 0.2, SL.chuteTop + 0.02),
      // de boog boven aan de glijbaan, op twee korte paaltjes
      new THREE.TorusGeometry(0.27, 0.035, 5, 10, Math.PI).translate(SL.chuteX, SL.top + 0.32, SL.chuteTop + 0.02),
      ...[-0.27, 0.27].map(x => boxAt(0.05, 0.34, 0.05, SL.chuteX + x, SL.top + 0.17, SL.chuteTop + 0.02))],
  ), MATTE_MAT],
  // de glijbaan zelf: een gele baan met blauwe randen
  [painted([0xffd23f, ...chute(0.46, 0.04, -0.02)], [0x4a90e2, ...chute(0.045, 0.15, 0.04, -0.235), ...chute(0.045, 0.15, 0.04, 0.235)]), PAINT_MAT],
  // het dak met een bol en een vlaggetje
  [painted(
    [0xe0584f, new THREE.ConeGeometry(0.74, 0.52, 4).rotateY(Math.PI / 4).scale(1.75, 1, 0.98).translate(0, SLIDE_ROOF + 0.26, (SL.chuteTop + SL.back - 0.36) / 2 + 0.01)],
    [0xb8433b, boxAt(1.9, 0.05, 1.08, 0, SLIDE_ROOF + 0.01, (SL.chuteTop + SL.back - 0.36) / 2 + 0.01)],
    [0xffd23f, ball(0.06, 0, SLIDE_ROOF + 0.55, (SL.chuteTop + SL.back - 0.36) / 2 + 0.01)],
  ), PAINT_MAT],
];

// Schommel (2 bij 1 tegel): twee schuine poten aan elke kant, een balk erbovenop en twee zitjes aan kettingen, die
// los van elkaar heen en weer gaan (zie RIDE_BUILD).
const SW = SWINGSET;
SHOP_PARTS.swing = [
  playFloor(2, 1),
  [merge([
    ...[-0.9, 0.9].flatMap(x => [beam(0.075, [x, 0, 0.4], [x, SW.top + 0.02, 0]), beam(0.075, [x, 0, -0.4], [x, SW.top + 0.02, 0]), boxAt(0.05, 0.05, 0.42, x, SW.top * 0.48, 0)]),
    new THREE.CylinderGeometry(0.045, 0.045, 1.9, 8).rotateZ(Math.PI / 2).translate(0, SW.top, 0), ball(0.075, -0.95, SW.top, 0), ball(0.075, 0.95, SW.top, 0),
  ]), P_RED],
];
/** Eén zitje met zijn twee kettingen, hangend aan (0, 0, 0). */
const swingSeatGeo = (color: number): THREE.BufferGeometry => painted(
  [0x8a8f98, ...[-0.15, 0.15].map(x => boxAt(0.022, SW.rope, 0.022, x, -SW.rope / 2, 0)), ...[-0.15, 0.15].map(x => boxAt(0.05, 0.05, 0.05, x, -0.01, 0))],
  [color, boxAt(0.38, 0.04, 0.18, 0, -SW.rope - 0.02, 0)],
);
const SWING_SEATS = [0x4a90e2, 0xffd23f].map(swingSeatGeo);
RIDE_BUILD.swing = (group, mat) => {
  group.userData.seats = Array.from({ length: SW.seats }, (_, i) => {
    const seat = piece(SWING_SEATS[i % SWING_SEATS.length], PAINT_MAT, mat);
    seat.position.set((i % 2 ? 1 : -1) * SW.side, SW.top, 0);
    // (het zitje zwaait: de schaduw in de kleuren zou mee omhoog draaien)
    seat.userData.noShade = true;
    group.add(seat);
    return seat;
  });
};

// Wipwap (2 bij 1 tegel): een rode bok in het midden met een gele plank erop, aan elk eind een zitje met een
// handvat; onder elk eind ligt een halve autoband waar de plank op neerkomt.
const SS = SEESAW;
SHOP_PARTS.seesaw = [
  playFloor(2, 1),
  [painted(
    [0xe0584f, new THREE.CylinderGeometry(0.06, 0.2, SS.pivot, 4).rotateY(Math.PI / 4).scale(1, 1, 1.5).translate(0, SS.pivot / 2, 0), boxAt(0.34, 0.05, 0.42, 0, 0.03, 0)],
    [0x8a8f98, new THREE.CylinderGeometry(0.045, 0.045, 0.34, 8).rotateX(Math.PI / 2).translate(0, SS.pivot - 0.03, 0)],
    // de halve banden
    [0x3d4148, ...[-0.8, 0.8].map(x => new THREE.TorusGeometry(0.13, 0.05, 6, 10, Math.PI).rotateY(Math.PI / 2).translate(x, 0.03, 0))],
  ), MATTE_MAT],
];
const SEESAW_PLANK = painted(
  [0xffd23f, boxAt(1.74, 0.05, 0.22, 0, 0, 0)],
  [0x4a90e2, ...[-1, 1].flatMap(s => [boxAt(0.3, 0.03, 0.25, s * SS.side, SS.lift - 0.015, 0), boxAt(0.04, 0.16, 0.25, s * (SS.side + 0.17), 0.1, 0)])],
  [0xe0584f, ...[-1, 1].flatMap(s => [boxAt(0.035, 0.24, 0.035, s * (SS.side - 0.24), 0.14, 0), boxAt(0.035, 0.035, 0.26, s * (SS.side - 0.24), 0.26, 0)])],
);
RIDE_BUILD.seesaw = (group, mat) => {
  const plank = piece(SEESAW_PLANK, PAINT_MAT, mat);
  plank.position.y = SS.pivot;
  plank.userData.noShade = true;
  group.add(plank);
  group.userData.plank = plank;
};

// Wipkip (1 bij 1 tegel): een dier op een dikke veer, met een zadel, een handvat en voetsteunen. Er zijn er drie:
// een kip, een paardje en een kikker; welke het wordt, hangt af van de plek waar hij staat (zie View.makeShop).
const SP = SPRINGER;
SHOP_PARTS.springer = [
  playFloor(1, 1),
  // de veer: een dunne staaf met ringen eromheen, op een voetplaat
  [mergeGeometries([tube(0.035, 0.035, 0.3, 0, 0.17, 0), tube(0.17, 0.17, 0.03, 0, 0.045, 0), ...[0.09, 0.15, 0.21, 0.27].map(y => tube(0.08, 0.08, 0.028, 0, y, 0))])!, METAL],
];
/** Wat elk dier heeft: het zadel (de bovenkant ligt `seat` hoog), het handvat en de voetsteunen. Alles gemeten vanaf het punt waar de veer wipt. */
const springerGear = (): [number, ...THREE.BufferGeometry[]][] => {
  const y = SP.seat - SP.pivot;
  return [
    [0xf7f4ec, boxAt(0.17, 0.03, 0.2, 0, y - 0.015, -0.02)],
    [0xffd23f, boxAt(0.03, 0.16, 0.03, 0, y + 0.09, 0.15), boxAt(0.3, 0.035, 0.035, 0, y + 0.17, 0.15), boxAt(0.36, 0.03, 0.06, 0, y - 0.24, 0.04)],
  ];
};
const SPRINGER_GEOS = ((): THREE.BufferGeometry[] => {
  const y = SP.seat - SP.pivot;
  return [
    // de kip: rood, met een kam, een gele snavel en een staart
    painted(
      [0xe0584f, blob(0.15, 0.8, 0.8, 1.7, 0, y - 0.12, 0), blob(0.095, 0.95, 1.2, 0.95, 0, y + 0.12, 0.2), blob(0.06, 0.6, 1.5, 1, 0, y + 0.05, -0.27), blob(0.05, 0.5, 1.3, 1, 0, y - 0.02, -0.31)],
      [0xb8433b, ...[0.14, 0.2, 0.26].map(z => dot(0.035, 0, y + 0.25, z)), blob(0.09, 0.3, 0.7, 1.1, -0.125, y - 0.1, 0), blob(0.09, 0.3, 0.7, 1.1, 0.125, y - 0.1, 0)],
      [0xf5a623, new THREE.ConeGeometry(0.04, 0.1, 4).rotateX(Math.PI / 2).translate(0, y + 0.1, 0.32)],
      [0x22201c, dot(0.018, -0.075, y + 0.16, 0.25), dot(0.018, 0.075, y + 0.16, 0.25)],
      ...springerGear(),
    ),
    // het paardje: blauw, met witte manen en een staart
    painted(
      [0x4a90e2, blob(0.14, 0.8, 0.8, 1.8, 0, y - 0.12, 0), rod(0.07, [0, y - 0.06, 0.16], [0, y + 0.12, 0.25], 6, 0.055), blob(0.075, 0.9, 0.95, 1.5, 0, y + 0.16, 0.31), cone(0.022, 0.06, -0.04, y + 0.25, 0.26, 4), cone(0.022, 0.06, 0.04, y + 0.25, 0.26, 4)],
      [0xf7f4ec, new THREE.BoxGeometry(0.035, 0.2, 0.05).rotateX(0.45).translate(0, y + 0.08, 0.17), blob(0.045, 0.8, 2, 0.9, 0, y - 0.1, -0.27)],
      [0x22201c, dot(0.016, -0.06, y + 0.19, 0.34), dot(0.016, 0.06, y + 0.19, 0.34)],
      ...springerGear(),
    ),
    // de kikker: groen en breed, met grote ogen bovenop en een lichte buik
    painted(
      [0x6cc04a, blob(0.16, 1, 0.7, 1.5, 0, y - 0.11, 0), blob(0.12, 1.15, 0.8, 0.9, 0, y + 0.04, 0.22), dot(0.055, -0.08, y + 0.14, 0.22), dot(0.055, 0.08, y + 0.14, 0.22),
        blob(0.07, 0.7, 0.6, 1.4, -0.16, y - 0.16, 0.12), blob(0.07, 0.7, 0.6, 1.4, 0.16, y - 0.16, 0.12)],
      [0xd9f0b8, blob(0.1, 1, 0.5, 0.6, 0, y - 0.02, 0.3)],
      [0xf7f4ec, dot(0.03, -0.08, y + 0.16, 0.26), dot(0.03, 0.08, y + 0.16, 0.26)],
      [0x22201c, dot(0.016, -0.08, y + 0.165, 0.285), dot(0.016, 0.08, y + 0.165, 0.285)],
      ...springerGear(),
    ),
  ];
})();
RIDE_BUILD.springer = (group, mat) => {
  const rocker = piece(SPRINGER_GEOS[0], PAINT_MAT, mat);
  rocker.position.y = SP.pivot;
  rocker.userData.noShade = true;
  group.add(rocker);
  group.userData.rocker = rocker;
};

// Trampoline (2 bij 2 tegels): een ronde rand van blauwe en gele kussens op zes poten, met het zwarte doek erin
// (los, zodat het kan veren) en een trapje ervoor.
const TR = TRAMPOLINE;
SHOP_PARTS.trampoline = [
  playFloor(2, 2),
  [painted(
    [0x8a8f98, ...around(6, TR.frame - 0.06, (x, z) => boxAt(0.05, TR.mat - 0.06, 0.05, x, (TR.mat - 0.06) / 2, z)), new THREE.TorusGeometry(TR.frame - 0.06, 0.025, 5, 24).rotateX(Math.PI / 2).translate(0, 0.14, 0),
      // het trapje, aan de voorkant
      ...[-0.13, 0.13].map(x => beam(0.03, [x, 0, TR.frame + TR.step], [x, TR.mat - 0.02, TR.frame - 0.02])),
      ...[0.33, 0.67].map(k => boxAt(0.26, 0.025, 0.07, 0, TR.mat * k, TR.frame + TR.step * (1 - k)))],
  ), MATTE_MAT],
  // de rand: om en om blauwe en gele kussens
  [striped(new THREE.LatheGeometry([[TR.r - 0.02, TR.mat - 0.07], [TR.frame, TR.mat - 0.07], [TR.frame, TR.mat + 0.02], [TR.r - 0.02, TR.mat + 0.02], [TR.r - 0.02, TR.mat - 0.07]].map(([r, y]) => new THREE.Vector2(r, y)), 12), [0x4a90e2, 0xffd23f], 12), PAINT_MAT],
];
/** Het doek: de bovenkant ligt op hoogte 0, zodat het precies onder de voeten van de springers veert. */
const TRAMPOLINE_MAT_GEO = painted(
  [0x39424c, new THREE.CylinderGeometry(TR.r, TR.r, 0.02, 24).translate(0, -0.01, 0)],
  [0xf7f4ec, new THREE.TorusGeometry(0.14, 0.012, 4, 16).rotateX(Math.PI / 2).translate(0, 0.002, 0)],
);
RIDE_BUILD.trampoline = (group, mat) => {
  const cloth = piece(TRAMPOLINE_MAT_GEO, MATTE_MAT, mat, false);
  cloth.receiveShadow = !mat;
  group.add(cloth);
  group.userData.cloth = cloth;
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
  // schoren onder de dakbalken, een lantaarn aan de nok en een bloembak op de achterwand
  [merge([
    painted(
      [0x8a5a2c, ...CORNERS.flatMap(([x, z]) => [beam(0.05, [x * 0.82, 1.04, z * 0.82], [x * 0.56, 1.31, z * 0.82]), beam(0.05, [x * 0.82, 1.04, z * 0.82], [x * 0.82, 1.31, z * 0.56])])],
      [0x3d4f5a, boxAt(0.02, 0.18, 0.02, 0, 1.7, 0), tube(0.07, 0.04, 0.035, 0, 1.6, 0), tube(0.04, 0.06, 0.02, 0, 1.47, 0)],
      [0xffe08a, tube(0.045, 0.045, 0.1, 0, 1.53, 0)],
      [0xa8743f, boxAt(0.8, 0.1, 0.14, 0, 0.9, -0.84)],
      [0x4f9e45, blob(0.08, 1.6, 0.7, 0.8, -0.24, 0.97, -0.84, 0), blob(0.08, 1.6, 0.7, 0.8, 0, 0.98, -0.84, 0), blob(0.08, 1.6, 0.7, 0.8, 0.24, 0.97, -0.84, 0)],
    ),
    ...bloom(-0.26, 1.04, -0.82, 0xe0584f, 0.055), ...bloom(-0.02, 1.06, -0.82, 0xffd23f, 0.055), ...bloom(0.24, 1.04, -0.82, 0xf06aa6, 0.055),
  ]), PAINT_MAT],
];
// Treinhalte: een perron over het hele blok, tot aan het spoor dat langs de voorkant ligt (met een witte rand en een
// gele streep waar je achter blijft), achterop een afdakje met een bankje en een lamp, en een rond bord met een
// treintje. De gasten wachten voor het afdak (zie de houding 'station' bij de gasten).
const SIGN_AT: P3 = [0.78, 1.5, 0.36];
SHOP_PARTS.station = [
  [boxAt(1.9, 0.12, 1.84, 0, 0.06, 0.02), std(0xd8c7ab, 1), false],
  [boxAt(1.9, 0.02, 0.07, 0, 0.125, 0.74), P_YELLOW, false],
  [mergeGeometries([
    ...[-0.72, 0.72].flatMap(x => [boxAt(0.08, 1.24, 0.08, x, 0.74, -0.8), boxAt(0.08, 1.35, 0.08, x, 0.795, -0.12)]),
    boxAt(1.0, 0.05, 0.26, 0, 0.36, -0.66), boxAt(1.0, 0.2, 0.04, 0, 0.5, -0.78), boxAt(0.06, 0.24, 0.22, -0.42, 0.24, -0.66), boxAt(0.06, 0.24, 0.22, 0.42, 0.24, -0.66),
  ])!, WOOD_MAT],
  [new THREE.BoxGeometry(1.8, 0.07, 0.98).rotateX(-0.16).translate(0, 1.45, -0.46), P_RED],
  [boxAt(1.9, 0.124, 0.06, 0, 0.062, 0.97), WHITE_MAT, false],
  [mergeGeometries([boxAt(1.84, 0.05, 0.07, 0, 1.54, 0.02), boxAt(0.03, 0.14, 0.03, 0, 1.33, -0.46)])!, DARK_MAT],
  [ball(0.07, 0, 1.24, -0.46), LAMP_MAT, false],
  [tube(0.025, 0.03, 1.2, SIGN_AT[0], 0.72, SIGN_AT[2]), METAL],
  // het bord en het treintje erop: los, zodat het kan wiebelen
  [new THREE.CylinderGeometry(0.2, 0.2, 0.04, 16).rotateX(Math.PI / 2).translate(...SIGN_AT), P_BLUE],
  [mergeGeometries([
    boxAt(0.2, 0.08, 0.07, SIGN_AT[0], SIGN_AT[1], SIGN_AT[2]), boxAt(0.08, 0.08, 0.07, SIGN_AT[0] - 0.06, SIGN_AT[1] + 0.07, SIGN_AT[2]),
    boxAt(0.035, 0.06, 0.07, SIGN_AT[0] + 0.06, SIGN_AT[1] + 0.07, SIGN_AT[2]),
    boxAt(0.05, 0.05, 0.07, SIGN_AT[0] - 0.06, SIGN_AT[1] - 0.06, SIGN_AT[2]), boxAt(0.05, 0.05, 0.07, SIGN_AT[0] + 0.06, SIGN_AT[1] - 0.06, SIGN_AT[2]),
  ])!, WHITE_MAT],
  // de aankleding (achteraan in de lijst, zodat de nummers hierboven blijven): een stationsklok op een paal links
  // voor, een bak met bloemen ernaast en een koffer met een tas onder het afdak
  [painted(
    [0x8a8f98, tube(0.022, 0.028, 1.0, -0.8, 0.62, 0.42)],
    [0x3d4f5a, new THREE.CylinderGeometry(0.16, 0.16, 0.07, 14).rotateX(Math.PI / 2).translate(-0.8, 1.22, 0.42), boxAt(0.016, 0.1, 0.086, -0.8, 1.26, 0.42), boxAt(0.07, 0.016, 0.086, -0.77, 1.22, 0.42)],
    [0xf7f4ec, new THREE.CylinderGeometry(0.13, 0.13, 0.08, 14).rotateX(Math.PI / 2).translate(-0.8, 1.22, 0.42)],
    [0xa8743f, boxAt(0.26, 0.14, 0.2, -0.8, 0.19, 0.06)],
    [0x5fa544, blob(0.1, 1.2, 0.7, 0.9, -0.8, 0.3, 0.06, 0)],
    [0xe0584f, dot(0.04, -0.87, 0.36, 0.08), dot(0.04, -0.74, 0.37, 0.02)],
    [0xffd23f, dot(0.04, -0.8, 0.38, 0.1)],
    [0x4a90e2, boxAt(0.22, 0.26, 0.12, 0.66, 0.25, -0.62), boxAt(0.1, 0.03, 0.03, 0.66, 0.395, -0.62)],
    [0xf08a24, boxAt(0.16, 0.14, 0.1, 0.44, 0.19, -0.5)],
  ), PAINT_MAT],
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
// die een bal op zijn neus houdt; bij het water wapperen twee vlaggetjes en staat het podium van de trainer.
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
  // het podium van de trainer, aan de kant van het water: een rond trapje in rood met een witte rand (zie showtime.ts)
  [painted(
    [0xe0584f, new THREE.CylinderGeometry(0.2, 0.22, 0.1, 16).translate(0, 0.07, -0.87)],
    [0xf7f4ec, new THREE.CylinderGeometry(0.21, 0.21, 0.025, 16).translate(0, 0.118, -0.87)],
  ), PAINT_MAT],
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
// De kabel mag alle kanten op: een hoekpaal waar de stoeltjes langs moeten gaat weg en het bord schuift dan naar een
// vrije hoek (zie fitCableHouse). Daarom zijn de vier palen losse onderdelen, achteraan in de lijst.
const CABLE_SIGN: P3 = [0.4, 1.3, 0.93];
/** Waar het bord mag staan, de eerste plek die vrij is van de stoeltjes: voor, in een hoek, en anders achter. */
const CABLE_SIGN_SPOTS: P2[] = [[0.4, 0.93], [-0.4, 0.93], [0.93, 0.93], [-0.93, 0.93], [0.93, -0.93], [-0.93, -0.93], [0.4, -0.93], [-0.4, -0.93]];
/** Zo ver moet de paal van het bord naast het midden van de kabel staan: het bord zelf steekt nog een stuk uit. */
const CABLE_SIGN_ROOM = 0.8;
/** Sneeuw op de kabelbaan: alleen in de winter te zien (zie applySeason). */
const CABLE_SNOW_MAT = std(0xf7fbff, 1);
CABLE_SNOW_MAT.visible = false;
const cableRoof = (lift: number, thick: number, deep: number): THREE.BufferGeometry =>
  merge([-1, 1].map(s => new THREE.BoxGeometry(2.04 - lift, thick, deep).rotateX(s * 0.5).translate(0, 1.92 + lift, s * 0.5)));
SHOP_PARTS.cablecar = [
  floorOf(0xcfc6b6),
  [boxAt(1.72, 0.1, 1.72, 0, 0.07, 0), std(0xd9b98c), false],
  [merge([boxAt(1.7, 0.07, 0.07, 0, 1.64, 0.8), boxAt(1.7, 0.07, 0.07, 0, 1.64, -0.8), boxAt(0.07, 0.07, 1.7, 0.8, 1.64, 0), boxAt(0.07, 0.07, 1.7, -0.8, 1.64, 0)]), WOOD_MAT],
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
  // de vier hoekpalen, in de volgorde van CABLE_CORNERS
  ...CABLE_CORNERS.map(([x, z]): Part => [boxAt(0.1, 1.55, 0.1, x * CABLE_DECK.post, 0.895, z * CABLE_DECK.post), WOOD_MAT]),
];
/** Het nummer van de eerste hoekpaal in de onderdelen van het huisje, en van de paal van het bord. */
const CABLE_POSTS_AT = 11, CABLE_SIGN_AT = 8;

/**
 * Past het huisje van de kabelbaan aan zijn kabels aan (`userData.dirs`: de richtingen waarin ze vertrekken, op de
 * kaart): alleen de hoekpalen waar geen stoeltje langs hoeft blijven staan, en het bord staat op de eerste plek
 * waar het niet in de weg staat. Het huisje zelf draait in kwartslagen; de kabels draaien niet mee.
 */
function fitCableHouse(group: THREE.Object3D): void {
  const u = group.userData, posts: THREE.Object3D[] | undefined = u.posts;
  if (!posts) return;
  const cos = Math.cos(group.rotation.y), sin = Math.sin(group.rotation.y);
  // de richtingen zoals het huisje ze ziet
  const dirs = ((u.dirs as P2[] | undefined) ?? []).map(([x, y]): P2 => [x * cos - y * sin, x * sin + y * cos]);
  posts.forEach((post, i) => {
    post.visible = cableClear([CABLE_CORNERS[i][0] * CABLE_DECK.post, CABLE_CORNERS[i][1] * CABLE_DECK.post], dirs, CABLE_DECK.postRoom);
  });
  const sign: THREE.Object3D[] = u.sign, spot = CABLE_SIGN_SPOTS.find(p => cableClear(p, dirs, CABLE_SIGN_ROOM));
  for (const part of sign) part.visible = !!spot;
  if (!spot) return;
  // de paal is een vorm op zijn eigen plek; het bord zit in een groepje dat om zijn ophangpunt wiegt
  sign[0].position.set(spot[0] - CABLE_SIGN[0], 0, spot[1] - CABLE_SIGN[2]);
  sign[1].position.x = spot[0];
  sign[1].position.z = spot[1];
}
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
/** De kleuren van de palen van de kabelbaan: de voet van steen, de blauwe paal, het geel, het rood en het grijze ijzer. */
const POLE_COLORS = [0xb9b2a6, 0x5b7c99, 0xffd23f, 0xe0584f, 0x8a8f98];
/** Onder deze bocht (in radialen) gaat de kabel bij een tussenpaal rechtdoor: dan is er geen arm met een tweede wiel. */
const MAST_STRAIGHT = 0.03;
/**
 * Een groot liggend wiel waar de kabel omheen gaat: een rode rand met spaken en een gele naaf. In het huisje hangt
 * het aan een as (`hub`: een smalle naaf); op een tussenpaal draait het om de paal zelf (een brede naaf).
 */
const cableWheelGeo = (hub: number): THREE.BufferGeometry => painted(
  [POLE_COLORS[3], new THREE.TorusGeometry(CABLE.r, 0.035, 6, 24).rotateX(Math.PI / 2)],
  [POLE_COLORS[4], ...[0, 1, 2].map(k => boxAt(2 * CABLE.r, 0.025, 0.035, 0, 0, 0).rotateY((k * Math.PI) / 3))],
  [POLE_COLORS[2], tube(hub, hub, 0.07, 0, 0, 0)],
);
/** De onderdelen van een paal, per kleur van POLE_COLORS; de sneeuw erop komt apart. */
type PoleParts = { stand: THREE.BufferGeometry[][]; snow: THREE.BufferGeometry[] };
const poleParts = (): PoleParts => ({ stand: POLE_COLORS.map(() => []), snow: [] });
/**
 * Een paal die vanzelf onder de kabel staat (zie cablePoles): een voet van steen, een blauwe paal, een gele dwarsbalk
 * dwars op de kabel met rode wieltjes eronder, en sneeuw erop.
 */
function addCablePole(p: CablePole, into: PoleParts): void {
  const r = CABLE.r, h = p.h, yaw = Math.atan2(p.ax, p.ay), x = toWorldX(p.gx), z = toWorldZ(p.gy);
  const put = (geo: THREE.BufferGeometry): THREE.BufferGeometry => geo.rotateY(yaw).translate(x, 0, z);
  into.stand[0].push(put(boxAt(0.32, 0.08, 0.32, 0, 0.04, 0)));
  into.stand[1].push(put(tube(0.06, 0.09, h + 0.06, 0, (h + 0.06) / 2, 0)));
  into.stand[2].push(put(boxAt(0.09, 0.07, 2 * r + 0.3, 0, h + 0.07, 0)));
  for (const side of [-r, r]) into.stand[3].push(put(new THREE.CylinderGeometry(0.055, 0.055, 0.05, 10).rotateX(Math.PI / 2).translate(0, h + 0.01, side)));
  into.snow.push(put(boxAt(0.1, 0.035, 2 * r + 0.3, 0, h + 0.122, 0)), put(ball(0.07, 0, h + 0.11, 0)));
}
/**
 * Een tussenpaal van de speler: steviger dan de palen die vanzelf komen, met een rode knop bovenop. Om de paal draait
 * een liggend wiel; in een bocht gaat daar de kabel van de buitenbocht omheen, en steekt er een gele arm naar de
 * binnenbocht met een tweede wiel voor de andere kabel. De wielen zelf draaien mee: waar ze komen en welke kant ze
 * op draaien, komt in `wheels` ([x, z, richting]).
 */
function addCableMast(m: CableMast, into: PoleParts, wheels: [number, number, number][]): void {
  const h = CABLE.high, yaw = Math.atan2(-m.ay, m.ax), x = toWorldX(m.x), z = toWorldZ(m.y);
  const put = (geo: THREE.BufferGeometry): THREE.BufferGeometry => geo.rotateY(yaw).translate(x, 0, z);
  into.stand[0].push(put(boxAt(0.42, 0.08, 0.42, 0, 0.04, 0)), put(boxAt(0.3, 0.08, 0.3, 0, 0.12, 0)));
  // (bovenaan slank: daar draaien de stoeltjes vlak langs de paal)
  into.stand[1].push(put(tube(0.055, 0.11, h + 0.3, 0, (h + 0.3) / 2, 0)));
  into.stand[3].push(put(ball(0.085, 0, h + 0.33, 0)));
  into.snow.push(put(blob(0.075, 1, 0.6, 1, 0, h + 0.4, 0)));
  wheels.push([x, z, 1]);
  if (Math.abs(m.bend) < MAST_STRAIGHT) return;
  // de arm naar de binnenbocht (in de eigen stand van de paal langs +x), met een as voor het tweede wiel en een trekstang
  const reach = Math.hypot(m.wx - m.x, m.wy - m.y);
  into.stand[2].push(put(boxAt(reach + 0.18, 0.07, 0.1, reach / 2, h + 0.15, 0)));
  into.stand[4].push(put(tube(0.03, 0.03, 0.12, reach, h + 0.07, 0)), put(rod(0.016, [0, h + 0.3, 0], [reach * 0.85, h + 0.18, 0])));
  into.snow.push(put(boxAt(reach + 0.16, 0.035, 0.11, reach / 2, h + 0.202, 0)));
  wheels.push([toWorldX(m.wx), toWorldZ(m.wy), -1]);
}
/** Het doorzichtige voorbeeld van een tussenpaal: de paal, zijn voet, het wiel en de knop als één vorm. */
const mastGhostGeo = (): THREE.BufferGeometry => merge([
  boxAt(0.42, 0.08, 0.42, 0, 0.04, 0), tube(0.055, 0.11, CABLE.high + 0.3, 0, (CABLE.high + 0.3) / 2, 0), ball(0.085, 0, CABLE.high + 0.33, 0),
  new THREE.TorusGeometry(CABLE.r, 0.035, 6, 24).rotateX(Math.PI / 2).translate(0, CABLE.high, 0),
]);

// ====================================================================== de grote attracties van het eind
// Zweefmolen, schommelschip, luchtballon, wildwaterbaan en achtbaan. De maten en de beweging staan in rides.ts; hier
// staat alleen hoe ze eruitzien. Net als bij het reuzenrad: een vaste voet in SHOP_PARTS en de losse, bewegende
// stukken in RIDE_BUILD, die `poseRide` elk beeldje op hun plek zet.

// ---- Zweefmolen (4 bij 4 tegels): een gestreepte mast met een kap die omhoog schuift en ronddraait. Aan de kap
// hangen acht stoeltjes aan kettingen; hoe harder hij draait, hoe verder ze naar buiten zwaaien.
const ZM = SWINGER;
const SW_MAST = ZM.top + ZM.rise + 0.3, SW_RIM = ZM.r0 + 0.22;
const SWINGER_LAMPS: [number, number][] = [[-1.78, 1.78], [1.78, 1.78], [-1.78, -1.78], [1.78, -1.78]];
SHOP_PARTS.swinger = [
  floorOf(0xd8c7ab, 4, 4),
  // de voet, de mast en de vlag bovenop
  [merge([
    paint(new THREE.CylinderGeometry(0.5, 0.62, 0.16, 16).translate(0, 0.08, 0), 0xc9453c),
    paint(new THREE.CylinderGeometry(0.52, 0.52, 0.03, 16).translate(0, 0.165, 0), 0xffd23f),
    striped(new THREE.CylinderGeometry(0.16, 0.2, SW_MAST - 0.16, 12), [0x2bb5a8, 0xf7f4ec], 12).translate(0, 0.16 + (SW_MAST - 0.16) / 2, 0),
    paint(tube(0.24, 0.24, 0.06, 0, 0.52, 0), 0xffd23f), paint(tube(0.22, 0.22, 0.05, 0, 1.3, 0), 0xffd23f),
    paint(ball(0.15, 0, SW_MAST + 0.08, 0), 0xffd23f),
    paint(tube(0.015, 0.015, 0.5, 0, SW_MAST + 0.45, 0), 0xf7f4ec),
    paint(new THREE.ConeGeometry(0.13, 0.3, 3).rotateZ(-Math.PI / 2).scale(1, 1, 0.12).translate(0.16, SW_MAST + 0.58, 0), 0xe0584f),
    // lage paaltjes om de hele molen, met een rood dopje
    ...around(16, 1.9, (x, z) => paint(tube(0.03, 0.035, 0.3, x, 0.15, z), 0xf7f4ec)),
    ...around(16, 1.9, (x, z) => paint(dot(0.045, x, 0.32, z), 0xe0584f)),
    ...SWINGER_LAMPS.map(([x, z]) => paint(lampPost(x, z, 1.4)[0], 0x8a8f98)),
  ]), PAINT_MAT],
  [merge(SWINGER_LAMPS.map(([x, z]) => lampPost(x, z, 1.4)[1])), LAMP_MAT, false],
];
/** De kap, met zijn onderkant op (0, 0, 0): een gouden bus om de mast, een plafond, een gestreepte rand en een open puntdak. */
const SWINGER_CROWN: Part[] = [
  [merge([
    paint(tube(0.27, 0.27, 0.34, 0, 0.17, 0), 0xffd23f),
    paint(new THREE.CylinderGeometry(SW_RIM, SW_RIM, 0.04, 24).translate(0, 0.02, 0), 0xfff4d6),
    striped(new THREE.CylinderGeometry(SW_RIM + 0.05, SW_RIM + 0.02, 0.22, 24), [0xe0584f, 0xf7f4ec], 24).translate(0, 0.15, 0),
    striped(new THREE.CylinderGeometry(0.26, SW_RIM + 0.08, 0.5, 16), [0x2bb5a8, 0xffd23f], 16).translate(0, 0.51, 0),
    paint(tube(0.3, 0.3, 0.05, 0, 0.78, 0), 0xffd23f),
    // de armen waar de kettingen aan hangen
    ...Array.from({ length: ZM.seats }, (_, i) => {
      const a = (i * Math.PI * 2) / ZM.seats;
      return paint(beam(0.05, [Math.sin(a) * 0.25, 0.02, Math.cos(a) * 0.25], [Math.sin(a) * (ZM.r0 + 0.02), 0.02, Math.cos(a) * (ZM.r0 + 0.02)]), 0x8a8f98);
    }),
  ]), PAINT_MAT],
  // lampjes rond de rand: het licht loopt rond
  ...CHASE_MATS.map((m, k): Part => [merge(Array.from({ length: 8 }, (_, i) => {
    const a = ((i * 3 + k) * Math.PI * 2) / 24;
    return dot(0.055, Math.sin(a) * (SW_RIM + 0.06), 0.06, Math.cos(a) * (SW_RIM + 0.06));
  })), m, false]),
];
/** Een stoeltje, met het ophangpunt op (0, 0, 0) en de neus naar +z: twee kettingen, een zitting met een rug en een beugel. */
const swingChair = (color: number): THREE.BufferGeometry => painted(
  [0x9aa0a6, beam(0.014, [-0.05, 0, 0], [-0.12, -ZM.chain + 0.24, -0.06]), beam(0.014, [0.05, 0, 0], [0.12, -ZM.chain + 0.24, -0.06]),
    beam(0.012, [-0.12, -ZM.chain + 0.24, -0.06], [-0.12, -ZM.chain + 0.02, 0.1]), beam(0.012, [0.12, -ZM.chain + 0.24, -0.06], [0.12, -ZM.chain + 0.02, 0.1])],
  [color, boxAt(0.27, 0.035, 0.25, 0, -ZM.chain - 0.018, 0), boxAt(0.27, 0.27, 0.035, 0, -ZM.chain + 0.115, -0.115)],
  [shade(color, 0.72), boxAt(0.03, 0.12, 0.25, -0.135, -ZM.chain + 0.05, 0), boxAt(0.03, 0.12, 0.25, 0.135, -ZM.chain + 0.05, 0)],
  [0xf7f4ec, boxAt(0.3, 0.022, 0.022, 0, -ZM.chain + 0.13, 0.12)],
);
const SWING_CHAIRS = RIDE_COLORS.map(swingChair);
RIDE_BUILD.swinger = (group, mat) => {
  const crown = build(SWINGER_CROWN, mat);
  crown.userData.noShade = true;
  group.add(crown);
  group.userData.crown = crown;
  group.userData.chairs = Array.from({ length: ZM.seats }, (_, i) => {
    const a = (i * Math.PI * 2) / ZM.seats, chair = piece(SWING_CHAIRS[i % SWING_CHAIRS.length], PAINT_MAT, mat);
    chair.position.set(Math.sin(a) * ZM.r0, 0, Math.cos(a) * ZM.r0);
    chair.rotation.order = 'YXZ';
    chair.rotation.y = a + Math.PI / 2;
    crown.add(chair);
    return chair;
  });
};

// ---- Schommelschip (6 bij 2 tegels): een houten schip met een drakenkop dat tussen twee hoge poten heen en weer
// zwaait. Vooraan ligt het perron met een brede trap; de vier banken kijken naar het midden.
const SH = SHIP;
const SHIP_FRAME_Z = 0.6, SHIP_LEG_X = 1.95, SHIP_HULL = 0x8f5632, SHIP_DARK = 0x6e3f22;
const shipLeg = (z: number): THREE.BufferGeometry[] => {
  const at = (h: number): number => SHIP_LEG_X * (1 - h / (SH.pivot + 0.08));
  return [
    beam(0.15, [-SHIP_LEG_X, 0, z], [0, SH.pivot + 0.08, z]), beam(0.15, [SHIP_LEG_X, 0, z], [0, SH.pivot + 0.08, z]),
    boxAt(at(2.1) * 2, 0.09, 0.09, 0, 2.1, z),
  ];
};
const SHIP_LAMPS: [number, number][] = [[-2.75, 0.8], [2.75, 0.8], [-2.75, -0.8], [2.75, -0.8]];
SHOP_PARTS.ship = [
  floorOf(0xd8c7ab, 6, 2),
  // het perron, met twee treden over de hele voorkant
  [painted(
    [0xe3c08a, boxAt(3.1, SH.deck, 0.36, 0, SH.deck / 2, 0.68)],
    [0xd3a868, boxAt(3.1, (SH.deck * 2) / 3, 0.06, 0, SH.deck / 3, 0.89), boxAt(3.1, SH.deck / 3, 0.06, 0, SH.deck / 6, 0.95)],
    [0xc79a63, boxAt(3.14, 0.03, 0.05, 0, SH.deck - 0.012, 0.505)],
  ), MATTE_MAT, false],
  // de twee poten, de as en de lantaarns
  [painted(
    [0x4a90e2, ...shipLeg(SHIP_FRAME_Z), ...shipLeg(-SHIP_FRAME_Z)],
    [0x356fb5, ...[-1, 1].flatMap(z => [-1, 1].map(x => boxAt(0.46, 0.12, 0.3, x * SHIP_LEG_X, 0.06, z * SHIP_FRAME_Z)))],
    [0xffd23f, ...[-1, 1].map(z => boxAt(0.36, 0.36, 0.16, 0, SH.pivot, z * SHIP_FRAME_Z))],
    [0x8a8f98, new THREE.CylinderGeometry(0.08, 0.08, SHIP_FRAME_Z * 2 + 0.24, 10).rotateX(Math.PI / 2).translate(0, SH.pivot, 0), ...SHIP_LAMPS.map(([x, z]) => lampPost(x, z, 1.4)[0])],
    // de paaltjes aan de einden van het perron
    [0xf7f4ec, ...[-1.52, 1.52].flatMap(x => [boxAt(0.05, 0.42, 0.05, x, SH.deck + 0.21, 0.54), boxAt(0.05, 0.42, 0.05, x, SH.deck + 0.21, 0.82), boxAt(0.035, 0.035, 0.32, x, SH.deck + 0.4, 0.68)])],
  ), PAINT_MAT],
  // een zwarte vlag bovenop, en de lampjes
  [painted(
    [0xf7f4ec, tube(0.014, 0.014, 0.6, 0, SH.pivot + 0.5, 0)],
    [0x2c2f36, boxAt(0.36, 0.22, 0.012, 0.19, SH.pivot + 0.66, 0)],
    [0xf7f4ec, dot(0.045, 0.19, SH.pivot + 0.68, 0.01), boxAt(0.1, 0.02, 0.014, 0.19, SH.pivot + 0.61, 0.01)],
  ), PAINT_MAT],
  [merge(SHIP_LAMPS.map(([x, z]) => lampPost(x, z, 1.4)[1])), LAMP_MAT, false],
];
/** Het schip, met de as op (0, 0, 0): de romp met een boeg en een hek die omhoog krullen, de banken en de vier armen naar de as. */
const SHIP_BODY: Part[] = [
  [painted(
    [SHIP_HULL,
      boxAt(2.7, 0.1, 0.6, 0, -SH.hullR + 0.05, 0), boxAt(2.86, 0.36, 0.05, 0, -SH.seatR - 0.02, 0.35), boxAt(2.86, 0.36, 0.05, 0, -SH.seatR - 0.02, -0.35),
      // boeg en hek: schuin omhoog
      new THREE.BoxGeometry(0.72, 0.36, 0.7).rotateZ(0.55).translate(1.62, -SH.seatR + 0.1, 0), new THREE.BoxGeometry(0.72, 0.36, 0.7).rotateZ(-0.55).translate(-1.62, -SH.seatR + 0.1, 0),
      beam(0.14, [1.8, -SH.seatR + 0.2, 0], [2.02, -SH.seatR + 0.82, 0]), beam(0.14, [-1.8, -SH.seatR + 0.2, 0], [-2.0, -SH.seatR + 0.7, 0])],
    [SHIP_DARK,
      boxAt(2.9, 0.05, 0.74, 0, -SH.hullR + 0.01, 0),
      // de banken: een zitting en een rug aan de buitenkant
      ...SH.rows.flatMap(x => [boxAt(0.2, 0.05, 0.62, x, -SH.seatR - 0.025, 0), boxAt(0.045, 0.26, 0.62, x + Math.sign(x) * 0.12, -SH.seatR + 0.11, 0)])],
    [0xffd23f, boxAt(2.9, 0.05, 0.06, 0, -SH.seatR + 0.15, 0.36), boxAt(2.9, 0.05, 0.06, 0, -SH.seatR + 0.15, -0.36)],
    // de beugels voor elke bank
    [0xf7f4ec, ...SH.rows.map(x => boxAt(0.03, 0.03, 0.66, x - Math.sign(x) * 0.16, -SH.seatR + 0.2, 0))],
    // de drakenkop voorop en de krul achterop
    [0x3d8b5a, blob(0.2, 1.5, 1, 1, 2.12, -SH.seatR + 0.94, 0), cone(0.05, 0.16, 2.02, -SH.seatR + 1.16, -0.1, 5), cone(0.05, 0.16, 2.02, -SH.seatR + 1.16, 0.1, 5),
      new THREE.TorusGeometry(0.16, 0.06, 5, 12, Math.PI * 1.4).rotateZ(1.2).translate(-2.06, -SH.seatR + 0.82, 0)],
    [0xf7f4ec, dot(0.045, 2.24, -SH.seatR + 1.0, 0.15), dot(0.045, 2.24, -SH.seatR + 1.0, -0.15)],
    [0x22201c, dot(0.022, 2.27, -SH.seatR + 1.0, 0.17), dot(0.022, 2.27, -SH.seatR + 1.0, -0.17)],
    [0xe0584f, new THREE.ConeGeometry(0.05, 0.2, 4).rotateZ(-Math.PI / 2).translate(2.48, -SH.seatR + 0.9, 0)],
    // gekleurde schilden langs de zijkant
    ...RIDE_COLORS.slice(0, 5).map((color, i): [number, ...THREE.BufferGeometry[]] => [color,
      ...[-1, 1].map(z => new THREE.CylinderGeometry(0.12, 0.12, 0.025, 10).rotateX(Math.PI / 2).translate(-1.1 + i * 0.55, -SH.seatR - 0.06, z * 0.385))]),
    // de armen naar de as
    [0x8a8f98, ...[-1, 1].flatMap(z => [-1, 1].map(x => beam(0.08, [0, 0, z * 0.41], [x * 1.3, -SH.seatR + 0.22, z * 0.41])))],
    [0xffd23f, new THREE.CylinderGeometry(0.16, 0.16, 0.96, 10).rotateX(Math.PI / 2)],
  ), PAINT_MAT],
];
RIDE_BUILD.ship = (group, mat) => {
  const ship = build(SHIP_BODY, mat);
  ship.position.y = SH.pivot;
  ship.userData.noShade = true;
  group.add(ship);
  group.userData.ship = ship;
};

// ---- Luchtballon (3 bij 3 tegels): een rieten mand op een houten vlonder, onder een grote gestreepte ballon. Hij
// stijgt aan een touw dat van een lier afrolt, blijft boven even hangen en zakt dan weer.
const AB = AIRBALLOON;
const BALLOON_MID = 2.85, BALLOON_R = 1.22, BASKET_W = 0.74, BASKET_H = 0.38;
const BALLOON_GORES = [0xe0584f, 0xffd23f, 0x4a90e2, 0xf7f4ec, 0x6cc04a, 0xf08a24];
SHOP_PARTS.airballoon = [
  floorOf(0xbfe0a8, 3, 3),
  // de vlonder met een opstap, de lier en vier zandzakken op de hoeken
  [painted(
    [0xc79a63, boxAt(0.96, AB.floor - 0.02, 0.9, 0, (AB.floor - 0.02) / 2, 0), boxAt(0.6, AB.floor / 2, 0.17, 0, AB.floor / 4, 0.535)],
    [0xa8743f, boxAt(1.0, 0.03, 0.94, 0, AB.floor - 0.03, 0)],
    [0x8a8f98, new THREE.CylinderGeometry(0.13, 0.13, 0.3, 10).rotateZ(Math.PI / 2).translate(-0.98, 0.2, -0.75), boxAt(0.05, 0.3, 0.26, -1.15, 0.15, -0.75), boxAt(0.05, 0.3, 0.26, -0.81, 0.15, -0.75)],
    [0xe0584f, boxAt(0.03, 0.03, 0.16, -1.2, 0.3, -0.75)],
    [0xd9c08a, ...CORNERS.map(([x, z]) => blob(0.13, 1, 0.75, 1, x * 1.15, 0.09, z * 1.15))],
    [0x8a8f98, ...CORNERS.map(([x, z]) => lampPost(x * 1.3, z * 1.3, 1.0)[0])],
  ), PAINT_MAT],
  [merge(CORNERS.map(([x, z]) => lampPost(x * 1.3, z * 1.3, 1.0)[1])), LAMP_MAT, false],
];
/** De ballon met zijn mand, met de vloer van de mand op (0, 0, 0). */
const BALLOON_BODY: Part[] = [
  // de mand van riet: een vloer, vier wanden (vooraan een opening) en een dikke rand
  [painted(
    [0xc9944f,
      boxAt(BASKET_W, 0.04, BASKET_W, 0, 0.02, 0), boxAt(BASKET_W, BASKET_H, 0.04, 0, BASKET_H / 2, -BASKET_W / 2 + 0.02),
      boxAt(0.04, BASKET_H, BASKET_W, -BASKET_W / 2 + 0.02, BASKET_H / 2, 0), boxAt(0.04, BASKET_H, BASKET_W, BASKET_W / 2 - 0.02, BASKET_H / 2, 0),
      boxAt(0.22, BASKET_H, 0.04, -0.26, BASKET_H / 2, BASKET_W / 2 - 0.02), boxAt(0.22, BASKET_H, 0.04, 0.26, BASKET_H / 2, BASKET_W / 2 - 0.02)],
    [0xa8743f,
      boxAt(BASKET_W + 0.04, 0.05, 0.07, 0, BASKET_H, -BASKET_W / 2 + 0.02), boxAt(0.07, 0.05, BASKET_W + 0.04, -BASKET_W / 2 + 0.02, BASKET_H, 0), boxAt(0.07, 0.05, BASKET_W + 0.04, BASKET_W / 2 - 0.02, BASKET_H, 0),
      boxAt(0.26, 0.05, 0.07, -0.26, BASKET_H, BASKET_W / 2 - 0.02), boxAt(0.26, 0.05, 0.07, 0.26, BASKET_H, BASKET_W / 2 - 0.02),
      boxAt(BASKET_W + 0.02, 0.03, BASKET_W + 0.02, 0, 0.14, 0)],
    // de stangen naar de brander, en de touwen naar de ballon
    [0x8a8f98, ...CORNERS.map(([x, z]) => beam(0.022, [x * 0.33, BASKET_H, z * 0.33], [x * 0.12, 1.02, z * 0.12])), boxAt(0.3, 0.03, 0.3, 0, 1.02, 0), tube(0.07, 0.09, 0.13, 0, 1.1, 0)],
    [0xf7f4ec, ...around(8, 0.46, (x, z) => beam(0.012, [x * 0.26, 1.02, z * 0.26], [x, 1.72, z]))],
  ), PAINT_MAT],
  // de ballon zelf: een bol met een taps toelopende onderkant, in banen van zes kleuren
  [merge([
    striped(new THREE.SphereGeometry(BALLOON_R, 24, 14).scale(1, 1.12, 1), BALLOON_GORES, 12).translate(0, BALLOON_MID, 0),
    striped(new THREE.CylinderGeometry(BALLOON_R * 0.86, 0.44, 1.05, 24, 1, true), BALLOON_GORES, 12).translate(0, BALLOON_MID - 0.95, 0),
    paint(new THREE.TorusGeometry(0.45, 0.04, 5, 20).rotateX(Math.PI / 2).translate(0, BALLOON_MID - 1.47, 0), 0xe0584f),
    paint(ball(0.1, 0, BALLOON_MID + BALLOON_R * 1.12, 0), 0xffd23f),
  ]), PAINT_MAT],
];
const BALLOON_FLAME = new THREE.ConeGeometry(0.09, 0.42, 7).translate(0, 0.21, 0);
const BALLOON_ROPE = new THREE.CylinderGeometry(0.014, 0.014, 1, 5).translate(0, 0.5, 0);
RIDE_BUILD.airballoon = (group, mat) => {
  const balloon = build(BALLOON_BODY, mat), flame = piece(BALLOON_FLAME, FLAME_MAT, mat, false), rope = piece(BALLOON_ROPE, ROPE_MAT, mat, false);
  balloon.userData.noShade = true;
  flame.position.y = 1.16;
  balloon.add(flame);
  rope.position.set(0, AB.floor - 0.02, 0);
  group.add(balloon, rope);
  Object.assign(group.userData, { balloon, flame, rope });
};

// ---- Het station van de safaritrein (2 bij 2 tegels): een houten perron met achterin een hut met een rieten dak,
// een bord met zebrastrepen en twee fakkels. De jeep zelf is los (zie makeJeep): die rijdt door het verblijf.
const THATCH = 0xd9b45f, THATCH_D = 0xb98f3f;
SHOP_PARTS.safari = [
  [painted(
    [0xb98a55, boxAt(1.84, 0.12, 1.84, 0, 0.06, 0)],
    [0xa8743f, ...[-0.69, -0.23, 0.23, 0.69].map(x => boxAt(0.02, 0.125, 1.84, x, 0.0625, 0)), boxAt(1.86, 0.04, 0.06, 0, 0.1, 0.9)],
    // de hut achterin: vier palen, een lage wand en een balie
    [0x8a5a34, ...[[-0.8, -0.8], [0.8, -0.8], [-0.8, -0.25], [0.8, -0.25]].map(([x, z]) => tube(0.04, 0.05, 1.25, x, 0.74, z)), boxAt(1.56, 0.5, 0.05, 0, 0.37, -0.8)],
    [0xc79a63, boxAt(1.1, 0.06, 0.3, 0, 0.62, -0.62), boxAt(1.0, 0.5, 0.05, 0, 0.37, -0.5)],
    // het bord op het dak: zwart-wit gestreept, met een gele rand
    [0xffd23f, boxAt(0.94, 0.38, 0.05, 0, 1.92, -0.52)],
    [0xf7f4ec, boxAt(0.86, 0.3, 0.06, 0, 1.92, -0.52)],
    [0x2c2f36, ...[-0.3, -0.1, 0.1, 0.3].map((x, i) => new THREE.BoxGeometry(0.07, 0.3, 0.065).rotateZ(i % 2 ? 0.35 : -0.3).translate(x, 1.92, -0.52))],
    [0x8a5a34, tube(0.025, 0.03, 0.3, -0.3, 1.68, -0.52), tube(0.025, 0.03, 0.3, 0.3, 1.68, -0.52)],
    // twee fakkels vooraan
    [0x6e4a2a, tube(0.03, 0.04, 0.9, -0.82, 0.57, 0.82), tube(0.03, 0.04, 0.9, 0.82, 0.57, 0.82)],
  ), MATTE_MAT],
  // het rieten dak: schuin, in twee lagen
  [painted(
    [THATCH, new THREE.ConeGeometry(1.25, 0.6, 4).rotateY(Math.PI / 4).scale(1, 1, 0.5).translate(0, 1.6, -0.52)],
    [THATCH_D, new THREE.ConeGeometry(1.32, 0.16, 4).rotateY(Math.PI / 4).scale(1, 1, 0.52).translate(0, 1.36, -0.52)],
  ), MATTE_MAT],
  [merge([ball(0.07, -0.82, 1.08, 0.82), ball(0.07, 0.82, 1.08, 0.82)]), LAMP_MAT, false],
];
/** De jeep van de safaritrein, met de neus naar +z: een open bak met zebrastrepen, een beugel, een reservewiel en de ranger aan het stuur. */
const JEEP_GREEN = 0x7a9a4a, JEEP_DARK = 0x5a7a34;
const JEEP_BODY = painted(
  [JEEP_GREEN,
    boxAt(0.5, 0.16, 0.92, 0, 0.21, 0), boxAt(0.48, 0.1, 0.28, 0, 0.34, 0.3),
    boxAt(0.035, 0.12, 0.6, -0.235, 0.35, -0.14), boxAt(0.035, 0.12, 0.6, 0.235, 0.35, -0.14), boxAt(0.5, 0.12, 0.035, 0, 0.35, -0.44)],
  [JEEP_DARK, boxAt(0.54, 0.05, 0.96, 0, 0.14, 0), boxAt(0.5, 0.03, 0.06, 0, 0.3, 0.47), ...[-1, 1].flatMap(x => [boxAt(0.07, 0.03, 0.26, x * 0.26, 0.24, 0.27), boxAt(0.07, 0.03, 0.26, x * 0.26, 0.24, -0.27)])],
  // zebrastrepen op de motorkap en de zijkanten
  [0xf7f4ec, ...[0.2, 0.3, 0.4].map(z => boxAt(0.3, 0.012, 0.04, 0, 0.392, z)), ...[-1, 1].flatMap(x => [-0.3, -0.14, 0.02].map(z => new THREE.BoxGeometry(0.012, 0.11, 0.05).rotateX(0.4).translate(x * 0.255, 0.34, z)))],
  // de banken
  [0xc58a4b, boxAt(0.42, 0.05, 0.16, 0, SAFARI.bench - 0.03, 0.04), boxAt(0.42, 0.18, 0.04, 0, SAFARI.bench + 0.06, -0.06), boxAt(0.42, 0.05, 0.16, 0, SAFARI.bench - 0.03, -0.24), boxAt(0.42, 0.18, 0.04, 0, SAFARI.bench + 0.06, -0.34)],
  // de voorruit (alleen de lijst), de beugel en het stuur
  [0x3d4f5a, boxAt(0.46, 0.03, 0.03, 0, 0.6, 0.17), boxAt(0.03, 0.22, 0.03, -0.215, 0.5, 0.17), boxAt(0.03, 0.22, 0.03, 0.215, 0.5, 0.17),
    boxAt(0.03, 0.42, 0.03, -0.225, 0.6, -0.42), boxAt(0.03, 0.42, 0.03, 0.225, 0.6, -0.42), boxAt(0.48, 0.03, 0.03, 0, 0.81, -0.42),
    new THREE.TorusGeometry(0.055, 0.012, 4, 10).rotateX(-0.9).translate(0.13, 0.5, 0.16)],
  // het reservewiel achterop en de bumpers
  [0x2c2f36, new THREE.CylinderGeometry(0.1, 0.1, 0.06, 10).rotateX(Math.PI / 2).translate(0, 0.36, -0.49), boxAt(0.54, 0.05, 0.04, 0, 0.16, 0.48), boxAt(0.54, 0.05, 0.04, 0, 0.16, -0.48)],
  [0xc9ced4, new THREE.CylinderGeometry(0.045, 0.045, 0.065, 8).rotateX(Math.PI / 2).translate(0, 0.36, -0.49)],
  // de ranger: een groen hemd, een hoofd en een hoed met een brede rand
  [0x6b8f3e, boxAt(0.17, 0.2, 0.11, 0.13, SAFARI.bench + 0.1, 0.03)],
  [0xe8b98a, boxAt(0.13, 0.13, 0.12, 0.13, SAFARI.bench + 0.27, 0.035)],
  [0xc9a86a, new THREE.CylinderGeometry(0.13, 0.13, 0.02, 10).translate(0.13, SAFARI.bench + 0.345, 0.035), new THREE.CylinderGeometry(0.07, 0.08, 0.07, 8).translate(0.13, SAFARI.bench + 0.385, 0.035)],
  [0x22201c, dot(0.012, 0.1, SAFARI.bench + 0.28, 0.097), dot(0.012, 0.16, SAFARI.bench + 0.28, 0.097)],
);
const JEEP_ARMS = painted([0x6b8f3e, boxAt(0.045, 0.045, 0.15, 0.055, 0, 0.07), boxAt(0.045, 0.045, 0.15, -0.055, 0, 0.07)], [0xe8b98a, boxAt(0.04, 0.04, 0.04, 0.05, 0, 0.14), boxAt(0.04, 0.04, 0.04, -0.05, 0, 0.14)]);
const JEEP_WHEEL = painted([0x2c2f36, new THREE.CylinderGeometry(0.11, 0.11, 0.08, 12).rotateZ(Math.PI / 2)], [0xc9ced4, new THREE.CylinderGeometry(0.045, 0.045, 0.09, 6).rotateZ(Math.PI / 2), boxAt(0.085, 0.16, 0.025, 0, 0, 0)]);
const JEEP_LAMPS = merge([dot(0.04, -0.17, 0.3, 0.475), dot(0.04, 0.17, 0.3, 0.475)]);

// ---- Een baan uit rides.ts in beeld: stukjes die de baan volgen
const TRACK_Q = new THREE.Quaternion(), TRACK_E = new THREE.Euler(0, 0, 0, 'YXZ');
const TRACK_V = new THREE.Vector3();
const TRACK_SPOT = newSpot();
/** Draait en verschuift een vorm naar een plek op een baan: de vorm ligt met +z langs de baan en +y omhoog. */
const onTrack = (geo: THREE.BufferGeometry, p: TrackSpot): THREE.BufferGeometry =>
  geo.applyQuaternion(TRACK_Q.setFromEuler(TRACK_E.set(-Math.asin(Math.max(-1, Math.min(1, p.dh))), Math.atan2(p.dx, p.dz), p.bank))).translate(p.x, p.h, p.z);
/** Voor elk stukje baan van ongeveer `step` lang: `make` krijgt het midden en de lengte en geeft de vormen die daar liggen (langs +z). */
function alongTrack(tr: Track, step: number, make: (p: TrackSpot, len: number, d: number) => THREE.BufferGeometry[]): THREE.BufferGeometry[] {
  const n = Math.max(8, Math.round(tr.total / step)), len = tr.total / n, out: THREE.BufferGeometry[] = [];
  for (let i = 0; i < n; i++) {
    const d = (i + 0.5) * len, p = trackAt(TRACK_SPOT, tr, d);
    for (const g of make(p, len, d)) out.push(onTrack(g, p));
  }
  return out;
}
/** Zet een los stuk (een wagen, een boomstam) op een plek van de baan. */
function placeOnTrack(o: THREE.Object3D, p: TrackSpot, lift = 0): void {
  o.position.set(p.x, p.h + lift, p.z);
  o.rotation.set(-Math.asin(Math.max(-1, Math.min(1, p.dh))), Math.atan2(p.dx, p.dz), p.bank, 'YXZ');
}

// ---- Wildwaterbaan (8 bij 3 tegels): een houten goot met water. Vooraan het station, achterlangs gaat het aan een
// band omhoog, en rechts gaat het steil naar beneden het water in: daar spat het hoog op.
const FL = FLUME, FLUME_TR = trackOf('flume');
const FLUME_WOOD = 0xa9743f, FLUME_DARK = 0x7a5230;
/** Waar de stammen het water in duiken: zo ver langs de baan. */
const FLUME_SPLASH = ((): number => {
  for (let i = Math.floor(FLUME_TR.n * 0.6); i < FLUME_TR.n; i++) if (FLUME_TR.pts[i * 3] <= FL.splash) return FLUME_TR.len[i];
  return FLUME_TR.total * 0.8;
})();
SHOP_PARTS.flume = [
  floorOf(0xbfe0a8, 8, 3),
  // de goot: een bodem en twee wanden, met stutten eronder waar hij boven de grond ligt
  [painted(
    [FLUME_WOOD, ...alongTrack(FLUME_TR, 0.2, (_p, len) => [boxAt(0.5, 0.04, len + 0.03, 0, -0.02, 0), boxAt(0.045, 0.2, len + 0.03, -0.25, 0.07, 0), boxAt(0.045, 0.2, len + 0.03, 0.25, 0.07, 0)])],
    [FLUME_DARK,
      ...alongTrack(FLUME_TR, 0.2, (_p, len) => [boxAt(0.06, 0.03, len + 0.03, -0.25, 0.185, 0), boxAt(0.06, 0.03, len + 0.03, 0.25, 0.185, 0)]),
      // (stutten staan recht: die worden niet met de goot mee gekanteld, dus hier apart)
    ],
  ), MATTE_MAT],
  [painted(
    [FLUME_DARK, ...((): THREE.BufferGeometry[] => {
      const out: THREE.BufferGeometry[] = [], n = Math.round(FLUME_TR.total / 0.7);
      for (let i = 0; i < n; i++) {
        const p = trackAt(TRACK_SPOT, FLUME_TR, ((i + 0.5) * FLUME_TR.total) / n);
        if (p.h < 0.4) continue;
        const flat = Math.hypot(p.dx, p.dz) || 1, sx = (p.dz / flat) * 0.24, sz = (-p.dx / flat) * 0.24;
        out.push(boxAt(0.07, p.h - 0.04, 0.07, p.x + sx, (p.h - 0.04) / 2, p.z + sz), boxAt(0.07, p.h - 0.04, 0.07, p.x - sx, (p.h - 0.04) / 2, p.z - sz));
        out.push(beam(0.045, [p.x + sx, 0.08, p.z + sz], [p.x - sx, p.h - 0.12, p.z - sz]));
      }
      return out;
    })()],
    // het perron, het huisje van de baas en de poort met het bord
    [0xe3c08a, boxAt(3.2, FL.deck, 0.38, -1.45, FL.deck / 2, 1.29)],
    [0xc79a63, boxAt(3.24, 0.03, 0.05, -1.45, FL.deck - 0.012, 1.105)],
    [0x9a5a34, boxAt(0.6, 0.9, 0.5, -3.45, 0.45, 1.2)],
    [0x6cc04a, new THREE.ConeGeometry(0.5, 0.36, 4).rotateY(Math.PI / 4).translate(-3.45, 1.08, 1.2)],
    [0x3d4f5a, boxAt(0.36, 0.26, 0.02, -3.45, 0.62, 1.455)],
    [0x8a8f98, ...[[3.75, 1.3], [-3.75, -1.3], [3.75, -1.3], [0.3, 1.38]].map(([x, z]) => lampPost(x, z, 1.4)[0])],
    // rotsen en dennen om de afdaling
    [0x9aa0a6, stone(0.9, 0.7, 0.7, 2.2, 0, 0.1, 0.4), stone(0.7, 1.1, 0.6, 3.0, 0, -0.1, 1.1), stone(0.6, 0.45, 0.5, 1.4, 0, 0.15, 2.0), stone(0.5, 0.35, 0.45, -3.1, 0, -0.1, 0.7)],
    [0x3d8b5a, cone(0.3, 0.8, 2.55, 1.15, 0.05, 7), cone(0.24, 0.6, 2.55, 1.6, 0.05, 7), cone(0.26, 0.7, -2.9, 0.75, 0.05, 7), cone(0.2, 0.5, -2.9, 1.15, 0.05, 7)],
    [0x6e4a2a, tube(0.05, 0.06, 0.5, 2.55, 0.5, 0.05), tube(0.045, 0.055, 0.4, -2.9, 0.2, 0.05)],
  ), MATTE_MAT],
  // het water in de goot, en de plas onderaan de afdaling
  [merge([
    ...alongTrack(FLUME_TR, 0.2, (_p, len) => [boxAt(0.455, 0.02, len + 0.03, 0, FL.water - 0.01, 0)]),
    boxAt(1.5, 0.03, 0.62, FL.splash - 0.55, 0.13 + FL.water, FL.stationZ),
  ]), WATER_MAT, false],
  [merge([[3.75, 1.3], [-3.75, -1.3], [3.75, -1.3], [0.3, 1.38]].map(([x, z]) => lampPost(x, z, 1.4)[1])), LAMP_MAT, false],
];
/** Een uitgeholde boomstam, met de bodem van de goot op (0, 0, 0) en de neus naar +z. */
const FLUME_LOG = painted(
  [0x8a5a34, new THREE.CylinderGeometry(0.19, 0.19, 0.72, 10).rotateX(Math.PI / 2).translate(0, 0.15, 0), blob(0.19, 1, 1, 0.7, 0, 0.15, 0.36)],
  [0xd9a05b, new THREE.CylinderGeometry(0.15, 0.15, 0.02, 10).rotateX(Math.PI / 2).translate(0, 0.15, -0.365)],
  [0x5a3d22, boxAt(0.25, 0.1, 0.58, 0, 0.3, -0.02)],
  [0xc58a4b, boxAt(0.23, 0.14, 0.03, 0, 0.36, -0.3), boxAt(0.23, 0.1, 0.03, 0, 0.34, 0.0)],
  [0xffd23f, boxAt(0.03, 0.03, 0.2, -0.14, 0.33, 0.18), boxAt(0.03, 0.03, 0.2, 0.14, 0.33, 0.18)],
);
/** Het opspattende water: twee waaiers opzij en een pluim naar voren, met de voet op (0, 0, 0). */
const FLUME_SPRAY = merge([
  new THREE.ConeGeometry(0.34, 1.1, 7).scale(1.5, 1, 0.3).rotateX(0.55).translate(0, 0.5, 0.42),
  new THREE.ConeGeometry(0.34, 1.1, 7).scale(1.5, 1, 0.3).rotateX(-0.55).translate(0, 0.5, -0.42),
  new THREE.ConeGeometry(0.3, 0.9, 7).scale(0.5, 1, 1.4).rotateZ(0.6).translate(-0.5, 0.4, 0),
  ...[[0.3, 0.9, 0.5], [-0.2, 1.1, -0.55], [-0.6, 0.8, 0.3], [0.1, 1.25, -0.2], [-0.35, 1.0, 0.6]].map(([x, y, z]) => dot(0.06, x, y, z)),
]);
RIDE_BUILD.flume = (group, mat) => {
  group.userData.logs = Array.from({ length: FL.cars }, () => {
    const log = piece(FLUME_LOG, PAINT_MAT, mat);
    log.userData.noShade = true;
    group.add(log);
    return log;
  });
  const spray = piece(FLUME_SPRAY, JET_MAT, mat, false);
  spray.position.set(FL.splash - 0.35, 0.16, FL.stationZ);
  group.add(spray);
  group.userData.spray = spray;
};

// ---- Achtbaan (8 bij 4 tegels): rode rails op witte palen. Vooraan het station, achterlangs de ketting omhoog,
// dan de grote afdaling, een hoge heuvel, een krappe bocht en drie hupjes terug naar het station.
const CO = COASTER, COASTER_TR = trackOf('coaster');
const COASTER_RAIL = 0xe0584f, COASTER_STEEL = 0xf7f4ec;
SHOP_PARTS.coaster = [
  floorOf(0xd8c7ab, 8, 4),
  [painted(
    // twee rails en een dikke buis eronder, met dwarsliggers ertussen
    [COASTER_RAIL, ...alongTrack(COASTER_TR, 0.16, (_p, len) => [boxAt(0.035, 0.035, len + 0.02, -0.12, -0.018, 0), boxAt(0.035, 0.035, len + 0.02, 0.12, -0.018, 0)])],
    [COASTER_STEEL,
      ...alongTrack(COASTER_TR, 0.16, (_p, len) => [boxAt(0.07, 0.07, len + 0.02, 0, -0.12, 0)]),
      ...alongTrack(COASTER_TR, 0.32, () => [boxAt(0.27, 0.025, 0.04, 0, -0.045, 0), boxAt(0.03, 0.08, 0.03, -0.1, -0.075, 0), boxAt(0.03, 0.08, 0.03, 0.1, -0.075, 0)])],
    // de ketting op de helling
    [0x3d4f5a, ...alongTrack(COASTER_TR, 0.16, (p, len) => (p.dh > 0.3 && p.z < -1.4 ? [boxAt(0.05, 0.02, len + 0.02, 0, -0.03, 0)] : []))],
  ), PAINT_MAT],
  [painted(
    // de palen: recht omhoog tot onder de buis
    [COASTER_STEEL, ...((): THREE.BufferGeometry[] => {
      const out: THREE.BufferGeometry[] = [], n = Math.round(COASTER_TR.total / 0.62);
      for (let i = 0; i < n; i++) {
        const p = trackAt(TRACK_SPOT, COASTER_TR, ((i + 0.5) * COASTER_TR.total) / n), top = p.h - 0.16;
        if (top < 0.06) continue;
        out.push(tube(0.035, 0.045, top, p.x, top / 2, p.z));
        if (top > 1.2) out.push(tube(0.07, 0.07, 0.05, p.x, 0.025, p.z));
      }
      return out;
    })()],
    // het perron met een trede ervoor, het huisje van de baas en twee poorten over de rails
    [0xe3c08a, boxAt(2.4, CO.deck, 0.38, -0.3, CO.deck / 2, 1.71)],
    [0xd3a868, boxAt(2.4, CO.deck / 2, 0.08, -0.3, CO.deck / 4, 1.94)],
    [0xc79a63, boxAt(2.44, 0.03, 0.05, -0.3, CO.deck - 0.012, 1.525)],
    [0x4a90e2, boxAt(0.6, 0.9, 0.5, 1.35, 0.45, 1.68), ...[-1.75, 0.95].flatMap(x => [boxAt(0.08, 1.5, 0.08, x, 0.75, 0.98), boxAt(0.08, 1.5, 0.08, x, 0.75, 1.62), boxAt(0.1, 0.16, 0.8, x, 1.5, 1.3)])],
    [0xffd23f, new THREE.ConeGeometry(0.5, 0.36, 4).rotateY(Math.PI / 4).translate(1.35, 1.08, 1.68), ...[-1.75, 0.95].map(x => boxAt(0.11, 0.05, 0.84, x, 1.6, 1.3))],
    [0x3d4f5a, boxAt(0.36, 0.26, 0.02, 1.35, 0.62, 1.935)],
    // een vlag op het hoogste punt
    [COASTER_STEEL, tube(0.014, 0.014, 0.7, 3.5, CO.top + 0.25, -1.75)],
    [0xffd23f, new THREE.ConeGeometry(0.13, 0.3, 3).rotateZ(-Math.PI / 2).scale(1, 1, 0.12).translate(3.66, CO.top + 0.48, -1.75)],
    [0x8a8f98, ...[[-3.75, 1.75], [3.75, 1.75], [-3.75, -1.75], [2.2, 1.85]].map(([x, z]) => lampPost(x, z, 1.4)[0])],
  ), PAINT_MAT],
  [merge([[-3.75, 1.75], [3.75, 1.75], [-3.75, -1.75], [2.2, 1.85]].map(([x, z]) => lampPost(x, z, 1.4)[1])), LAMP_MAT, false],
  // lampjes op de poorten: het licht loopt
  ...CHASE_MATS.map((m, k): Part => [merge([-1.75, 0.95].flatMap(x => [0, 1].map(i => dot(0.05, x, 1.66, 1.02 + ((i * 3 + k) * 0.56) / 5)))), m, false]),
];
/** Een karretje, met de bovenkant van de rails op (0, 0, 0) en de neus naar +z; het voorste heeft een ronde neus. */
const coasterCar = (color: number, nose: boolean): THREE.BufferGeometry => painted(
  [color, boxAt(0.38, 0.13, 0.5, 0, 0.115, 0), boxAt(0.035, 0.14, 0.44, -0.18, 0.24, -0.01), boxAt(0.035, 0.14, 0.44, 0.18, 0.24, -0.01), boxAt(0.36, 0.26, 0.04, 0, 0.3, -0.22),
    ...(nose ? [blob(0.19, 1, 0.62, 1.1, 0, 0.16, 0.27)] : [boxAt(0.38, 0.16, 0.04, 0, 0.21, 0.23)])],
  [0xffd23f, boxAt(0.39, 0.035, 0.52, 0, 0.19, 0), ...(nose ? [dot(0.045, -0.09, 0.2, 0.44), dot(0.045, 0.09, 0.2, 0.44)] : [])],
  [0x3d4f5a, boxAt(0.3, 0.04, 0.3, 0, 0.165, -0.04), ...[-1, 1].flatMap(x => [-1, 1].map(z => new THREE.CylinderGeometry(0.05, 0.05, 0.04, 8).rotateZ(Math.PI / 2).translate(x * 0.15, 0.03, z * 0.17)))],
  // de beugel
  [0xf7f4ec, boxAt(0.34, 0.03, 0.03, 0, 0.36, 0.13), boxAt(0.03, 0.14, 0.03, -0.16, 0.3, 0.13), boxAt(0.03, 0.14, 0.03, 0.16, 0.3, 0.13)],
);
const COASTER_CARS = [coasterCar(0xe0584f, true), coasterCar(0x4a90e2, false), coasterCar(0x6cc04a, false)];
RIDE_BUILD.coaster = (group, mat) => {
  group.userData.cars = Array.from({ length: CO.cars }, (_, i) => {
    const car = piece(COASTER_CARS[i % COASTER_CARS.length], PAINT_MAT, mat);
    car.userData.noShade = true;
    group.add(car);
    return car;
  });
};

// Bij het wc-gebouw: een bordje met een mannetje en een vrouwtje tussen de deuren, twee deurmatten, een rand
// onder het dak en een luchtpijp erop. Achteraan in de lijst, zodat de nummers van de andere onderdelen blijven.
SHOP_PARTS.toilet.push([painted(
  [0xf7f4ec, boxAt(0.26, 0.3, 0.02, 0, 0.62, 0.56)],
  [0x4a90e2, ball(0.03, -0.06, 0.71, 0.575), boxAt(0.06, 0.13, 0.016, -0.06, 0.59, 0.572)],
  [0xf06aa6, ball(0.03, 0.06, 0.71, 0.575), new THREE.ConeGeometry(0.055, 0.14, 4).scale(1, 1, 0.2).translate(0.06, 0.6, 0.572)],
  [0x3a78c2, boxAt(1.9, 0.04, 1.64, 0, 1.19, -0.12)],
  [0x8a6a4a, boxAt(0.4, 0.012, 0.2, -0.42, 0.056, 0.72), boxAt(0.4, 0.012, 0.2, 0.42, 0.056, 0.72)],
  [0x9aa0a6, tube(0.05, 0.05, 0.3, 0.55, 1.47, -0.5), tube(0.08, 0.08, 0.03, 0.55, 1.63, -0.5)],
  // een bol op de nok, witte kozijnen om de raampjes, een lamp boven het bordje en twee potten met een struikje
  [0x3a78c2, ball(0.055, 0, 1.74, -0.12)],
  [0xf7f4ec, boxAt(0.26, 0.26, 0.03, -0.42, 1.04, 0.562), boxAt(0.26, 0.26, 0.03, 0.42, 1.04, 0.562)],
  [0x3d4f5a, boxAt(0.03, 0.03, 0.07, 0, 0.95, 0.59), tube(0.06, 0.035, 0.03, 0, 0.94, 0.63)],
  [0xffe08a, ball(0.042, 0, 0.9, 0.63)],
  [0xc9653f, tube(0.1, 0.075, 0.15, -0.8, 0.125, 0.74), tube(0.1, 0.075, 0.15, 0.8, 0.125, 0.74)],
  [0x4f9e45, ball(0.12, -0.8, 0.3, 0.74), ball(0.12, 0.8, 0.3, 0.74), ball(0.08, -0.8, 0.43, 0.74), ball(0.08, 0.8, 0.43, 0.74)],
  [0xf06aa6, dot(0.03, -0.74, 0.38, 0.82), dot(0.03, -0.86, 0.3, 0.83), dot(0.03, 0.74, 0.34, 0.83), dot(0.03, 0.86, 0.4, 0.8)],
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
  tower: [{ parts: [4], at: [0, TOWER_ROOF + 1.06, 0], amp: 0, sway: 0, yaw: 0.5 }],
  // de parasols en de kok
  restaurant: [...RESTAURANT_TABLES.map(([x, z], i): Bob => ({ parts: [1 + i], at: [x, 1.32, z], amp: 0.012, sway: 0.05 })), { parts: [1 + RESTAURANT_TABLES.length], at: [CHEF[0], 0.5, CHEF[1]], amp: 0.012, sway: 0.03 }],
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
  new THREE.CylinderGeometry(r * 0.62, r, h, 8).translate(0, h / 2, 0),
  prism(r * 1.15, r * 1.6, 0.07, 0, 0.035, 0, 6),
  // drie wortels die de grond in gaan, en een derde tak
  ...[0.4, 2.5, 4.6].map(a => rod(r * 0.5, [Math.cos(a) * r * 0.5, 0.17, Math.sin(a) * r * 0.5], [Math.cos(a) * r * 2.4, 0.01, Math.sin(a) * r * 2.4], 5, r * 0.2)),
  rod(r * 0.36, [0, h * 0.62, 0], [r * 1.7, h + 0.06, r * 0.6], 5, r * 0.26),
  rod(r * 0.32, [0, h * 0.7, 0], [-r * 1.5, h + 0.04, -r * 0.8], 5, r * 0.22),
  rod(r * 0.26, [0, h * 0.52, 0], [-r * 0.5, h * 0.82, r * 1.7], 5, r * 0.16),
]);
// een palmblad: eerst schuin omhoog, dan naar beneden gebogen, met een smalle punt
const palmFrond = (i: number): THREE.BufferGeometry => {
  // vijf stukjes achter elkaar, elk een dakje van twee blaadjes: eerst schuin omhoog, dan steeds verder naar beneden
  const k = i % 2 ? 0.8 : 1, geos: THREE.BufferGeometry[] = [], wide = [0.1, 0.13, 0.12, 0.09, 0.05];
  let x = 0, y = 0, a = 0.55;
  for (let n = 0; n < 5; n++) {
    const len = 0.17 - n * 0.012, w = wide[n];
    for (const side of [-1, 1]) geos.push(new THREE.BoxGeometry(len * 1.1, 0.016, w).translate(len / 2, 0, side * w * 0.46).rotateX(side * 0.42).rotateZ(a).translate(x, y, 0));
    x += Math.cos(a) * len;
    y += Math.sin(a) * len;
    a -= 0.36;
  }
  return merge(geos).scale(k, k, k).rotateZ(i % 2 ? -0.2 : 0).rotateY((i * Math.PI) / 4 + 0.2).translate(0, 1.1, 0);
};
const PALM_TRUNK: [P3, number][] = [[[0, 0, 0], 0.085], [[0.035, 0.3, 0], 0.078], [[0.05, 0.6, 0], 0.07], [[0.035, 0.88, 0], 0.062], [[0, 1.1, 0], 0.055]];
// een roos: een knop met een donker hartje
const petal = (r: number, sx: number, sy: number, sz: number): THREE.BufferGeometry => new THREE.SphereGeometry(r, 6, 4).scale(sx, sy, sz);
/** Een open bloem die omhoog kijkt, het midden op nul: `n` ronde blaadjes om een hart. */
const flower = (r: number, color: number, heart: number, n = 5): THREE.BufferGeometry => merge([
  ...Array.from({ length: n }, (_, k) => paint(petal(r * 0.58, 1, 0.38, 0.78).translate(r * 0.62, 0, 0).rotateY((k * Math.PI * 2) / n), color)),
  paint(petal(r * 0.4, 1, 0.7, 1).translate(0, r * 0.14, 0), heart),
]);
/** Een roos die omhoog kijkt: vijf open blaadjes, drie rechtop daarbinnen en een knop in het midden. */
const rose = (r: number, color: number, heart: number): THREE.BufferGeometry => merge([
  ...[0, 1, 2, 3, 4].map(k => paint(petal(r * 0.6, 1, 0.42, 0.8).translate(r * 0.6, 0, 0).rotateZ(0.25).rotateY(k * 1.257), color)),
  ...[0, 1, 2].map(k => paint(petal(r * 0.45, 1, 0.75, 0.7).translate(r * 0.26, r * 0.28, 0).rotateY(k * 2.094 + 0.5), heart)),
  paint(petal(r * 0.3, 1, 1.1, 1).translate(0, r * 0.45, 0), color),
]);
/** Zet een vorm die omhoog kijkt op punt `p`, gekanteld naar richting `d`. */
const aim = (g: THREE.BufferGeometry, p: P3, d: P3): THREE.BufferGeometry =>
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, new THREE.Vector3(d[0], d[1], d[2]).normalize())).translate(p[0], p[1], p[2]);
// een perkje: een ovaal bergje aarde; de rand van laag groen eromheen komt er als laatste onderdeel bij (bedRim)
const flowerBed = (w: number, d: number): Part => [painted(
  [0x4f3823, blob(0.5, w, 0.11, d, 0, 0.01, 0, 2)],
  [0x3f2c1b, blob(0.5, w * 1.05, 0.05, d * 1.1, 0, 0, 0, 2)],
), MATTE_MAT, false];
const bedRim = (w: number, d: number, seed: number): Part => [leafVine(
  Array.from({ length: 30 }, (_, i): P3 => [Math.cos((i / 30) * Math.PI * 2) * w * 0.5, 0.035, Math.sin((i / 30) * Math.PI * 2) * d * 0.5]), true, [0, 1, 0], 6,
  (t, a) => {
    const b = Math.sin(Math.PI * 2 * 6 * t + a + seed) * 0.6 + Math.sin(Math.PI * 2 * 11 * t - 2 * a + seed * 2) * 0.4;
    return [0.04 * (1 + 0.3 * b), b];
  }, 0.25).geo, BUSH_MAT, false];
// de rozenstruik: een lage zachte struik, met de rozen op het oppervlak
const ROSE_BLOBS: Blob[] = [[0.17, -0.3, 0.2, -0.02], [0.19, -0.09, 0.23, 0.03], [0.18, 0.13, 0.22, -0.03], [0.16, 0.33, 0.2, 0.02]];
const ROSE_LOOK: LeafLook = { detail: 5, bumps: 0.17, grain: 10, seed: 3, dark: 0.45 };
const ROSE_SHAPE = canopyShape(ROSE_BLOBS, ROSE_LOOK);
const ROSES: [number, number, number, number, number][] = [
  [-0.32, 0.4, -0.05, 0xd8362e, 0xa82a24], [0.12, 0.43, -0.08, 0xd8362e, 0xa82a24], [0.36, 0.38, 0.05, 0xd8362e, 0xa82a24], [-0.02, 0.37, 0.17, 0xd8362e, 0xa82a24],
  [-0.1, 0.45, 0.07, 0xf06aa6, 0xd04a86], [0.24, 0.42, 0.1, 0xf06aa6, 0xd04a86], [-0.4, 0.34, 0.1, 0xf06aa6, 0xd04a86],
  [-0.22, 0.41, 0.11, 0xf7f4ec, 0xf3d9a8], [0.02, 0.44, -0.1, 0xf7f4ec, 0xf3d9a8], [0.3, 0.38, -0.12, 0xf7f4ec, 0xf3d9a8],
];
// een tulp: een gladde kelk met een donkerder hartje bovenin
const tulip = (x: number, y: number, z: number, color: number, inside: number): THREE.BufferGeometry[] => [
  paint(new THREE.SphereGeometry(0.047, 7, 5).scale(0.85, 1.4, 0.85).translate(x, y, z), color),
  paint(petal(0.026, 1, 0.6, 1).translate(x, y + 0.052, z), inside),
];
const TULIPS: [number, number, number, number, number][] = [
  ...[-0.3, -0.15, 0, 0.15, 0.3].flatMap((x, i): [number, number, number, number, number][] => [
    [x, 0.34, -0.115, [0xe0584f, 0xffd23f][i % 2], [0xb8403a, 0xe0a92a][i % 2]],
    [x, 0.32, 0.115, [0xffd23f, 0xb06ad9][i % 2], [0xe0a92a, 0x8a4cb5][i % 2]],
  ]),
  // de middelste rij staat er net tussenin en is iets hoger: roze en wit
  ...[-0.225, -0.075, 0.075, 0.225].map((x, i): [number, number, number, number, number] => [x, 0.39, 0, [0xf06aa6, 0xf7f4ec][i % 2], [0xd04a86, 0xf3d9a8][i % 2]]),
];
// paddenstoelen: een steel, een bolle hoed en witte stippen. [x, z, hoe hoog de steel is, hoe breed de hoed is]
const SHROOMS: [number, number, number, number][] = [[-0.16, 0.06, 0.2, 0.17], [0.14, -0.1, 0.14, 0.13], [0.1, 0.2, 0.1, 0.1], [-0.07, -0.22, 0.07, 0.075]];
const shroomDots = ([x, z, h, r]: [number, number, number, number], n: number): THREE.BufferGeometry[] => [0, 1, 2, 3, 4].map(k => {
  const up = k === 4 ? 0 : 0.75, turn = k * 1.57 + n;
  return blob(r * 0.15, 1, 0.5, 1, x + Math.sin(up) * Math.cos(turn) * r, h + 0.01 + Math.cos(up) * r * 0.75, z + Math.sin(up) * Math.sin(turn) * r, 0);
});
// een zonnebloem kijkt naar voren: een krans van blaadjes rond een bruin hart
const sunPetals = (x: number, y: number): THREE.BufferGeometry[] => [
  // twee kransen: lange gele blaadjes en daartussen kortere, iets donkerder
  ...Array.from({ length: 12 }, (_, k) => paint(petal(0.05, 0.55, 1.35, 0.3).translate(0, 0.125, 0).rotateZ((k * Math.PI * 2) / 12).translate(x, y, 0.03), 0xffd23f)),
  ...Array.from({ length: 12 }, (_, k) => paint(petal(0.045, 0.5, 1.2, 0.3).translate(0, 0.1, 0).rotateZ(((k + 0.5) * Math.PI * 2) / 12).translate(x, y, 0.022), 0xf2a71d)),
];
const SUNS: [number, number][] = [[-0.26, 0.7], [0, 0.78], [0.26, 0.86]];
// een pompoen: een platte bol met banen
const pumpkin = (r: number, x: number, z: number): THREE.BufferGeometry =>
  striped(new THREE.SphereGeometry(r, 10, 6).scale(1, 0.78, 1), [0xf08a24, 0xe27a1c], 10).translate(x, r * 0.74, z);
// bamboe: [x, hoogte, z] van elke stengel
const BAMBOO: [number, number, number][] = [[-0.24, 1.2, -0.1], [-0.08, 1.4, 0.12], [0.1, 1.1, -0.14], [0.24, 1.3, 0.06], [0, 0.9, 0.24], [-0.22, 0.72, 0.2], [0.2, 0.66, -0.26]];
// een blad aan een steel: lang, plat en rond, schuin omhoog vanaf de grond
const longLeaf = (x: number, z: number, len: number, lean: number, turn = 0): THREE.BufferGeometry =>
  petal(len / 2, 0.3, 1, 0.1).translate(0, len / 2, 0).rotateZ(lean).rotateY(turn).translate(x, 0.04, z);
// de boog van de bloemenboog: een halve cirkel van zes stukken op twee palen
const ARCH: P3[] = Array.from({ length: 7 }, (_, i): P3 => [-Math.cos((i * Math.PI) / 6) * 0.4, 0.92 + Math.sin((i * Math.PI) / 6) * 0.4, 0]);
// de slinger van blad over de bloemenboog: langs de linkerpaal omhoog, over de boog en langs de rechterpaal omlaag
const ARCH_PATH: P3[] = [
  ...[0.04, 0.2, 0.38, 0.56, 0.74].map((y): P3 => [-0.4, y, 0]),
  ...Array.from({ length: 13 }, (_, i): P3 => [-Math.cos((i * Math.PI) / 12) * 0.4, 0.92 + Math.sin((i * Math.PI) / 12) * 0.4, 0]),
  ...[0.74, 0.56, 0.38, 0.2, 0.04].map((y): P3 => [0.4, y, 0]),
];
const ARCH_VINE = leafVine(ARCH_PATH, false, [0, 0, 1], 9, (t, a) => {
  const b = Math.sin(Math.PI * 2 * 7 * t + 2 * a) * 0.5 + Math.sin(Math.PI * 2 * 11 * t - 3 * a + 1) * 0.5, ends = Math.min(1, t / 0.05, (1 - t) / 0.05);
  return [0.115 * (1 + 0.24 * b) * (0.35 + 0.65 * ends), b];
}, 0.42);
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
// een trede van de waterval: een achtkantige rots met een vlakke voorkant, `k` keer zo diep als breed
const fallRock = (rBottom: number, rTop: number, h: number, x: number, y: number, z: number, k: number): THREE.BufferGeometry =>
  prism(rTop, rBottom, h, 0, y, 0, 8, Math.PI / 8).scale(1, 1, k).translate(x, 0, z);
const totemEyes = (y: number): THREE.BufferGeometry[][] => [
  [boxAt(0.1, 0.1, 0.02, -0.08, y, 0.185), boxAt(0.1, 0.1, 0.02, 0.08, y, 0.185)],
  [boxAt(0.045, 0.045, 0.02, -0.08, y - 0.01, 0.195), boxAt(0.045, 0.045, 0.02, 0.08, y - 0.01, 0.195)],
];
const DECOR_PARTS: Record<DecorKind, Part[]> = {
  tree: [
    [trunk(0.62, 0.1), WOOD_MAT],
    [TREE_CROWNS[0], CROWN_MAT],
    [TREE_APPLES[0], APPLE_MAT],
  ],
  pine: [
    [merge([new THREE.CylinderGeometry(0.05, 0.07, 0.32, 7).translate(0, 0.16, 0), prism(0.08, 0.12, 0.05, 0, 0.025, 0, 6),
      ...[0.6, 2.7, 4.8].map(a => rod(0.03, [Math.cos(a) * 0.03, 0.1, Math.sin(a) * 0.03], [Math.cos(a) * 0.15, 0.005, Math.sin(a) * 0.15], 5, 0.014))]), WOOD_MAT],
    [PINE_CROWNS[0], PINE_MAT],
  ],
  // palm: een gebogen stam, zes bladeren die naar beneden hangen en kokosnoten
  palm: [
    [painted(
      [0xb88a52, ...PALM_TRUNK.slice(1).map(([p, r], i) => rod(PALM_TRUNK[i][1], PALM_TRUNK[i][0], p, 8, r)), prism(0.1, 0.14, 0.06, 0, 0.03, 0, 7)],
      // de ringen van de stam, en de kraag waar de bladeren uit komen
      [0x9c7242, ...PALM_TRUNK.slice(1, 4).flatMap(([p, r]) => [tube(r + 0.012, r + 0.012, 0.03, p[0], p[1], p[2]), tube(r + 0.014, r + 0.014, 0.026, p[0], p[1] - 0.15, p[2])]), blob(0.085, 1, 0.7, 1, 0, 1.09, 0, 0)],
    ), MATTE_MAT],
    [merge([0, 1, 2, 3, 4, 5, 6, 7].map(palmFrond)), PALM_MAT],
    [merge([ball(0.065, 0.07, 1.02, 0.03), ball(0.065, -0.05, 1.0, -0.05), ball(0.06, 0.0, 0.98, 0.08)]), std(0x6b4a2a)],
  ],
  // lang en smal: een heg is precies een tegel lang, zodat een rij heggen één geheel wordt
  hedge: [
    [hedgeGeo(), BUSH_MAT],
    // witte bloemetjes tussen het blad
    [merge([[-0.38, 0.5, 0xf7f4ec], [-0.2, 0.38, 0xf7f4ec], [-0.04, 0.56, 0xf06aa6], [0.14, 0.42, 0xf7f4ec], [0.3, 0.6, 0xf7f4ec], [0.42, 0.34, 0xf06aa6], [-0.3, 0.22, 0xf06aa6], [0.04, 0.2, 0xf7f4ec], [0.24, 0.78, 0xf7f4ec], [-0.14, 0.8, 0xf06aa6]].map(([x, p, color]) => {
      const [, y, z] = hedgeAt(x, p), phi = p * Math.PI;
      return aim(flower(0.04, color, 0xffd23f), [x, y, z], [0, Math.sin(phi), Math.cos(phi)]);
    })), PAINT_MAT, false],
  ],
  roses: [
    flowerBed(0.94, 0.36),
    [canopy(ROSE_BLOBS, ROSE_LOOK), BUSH_MAT],
    [merge(ROSES.map(([x, y, z, color, heart]) => {
      const c = ROSE_SHAPE.c, d: P3 = [x - c[0], y - c[1], z - c[2]], len = Math.hypot(...d), [px, py, pz] = ROSE_SHAPE.at(d[0] / len, d[1] / len, d[2] / len);
      return aim(rose(0.07, color, heart), [px, py, pz], [d[0] / len, d[1] / len + 0.7, d[2] / len]);
    })), PAINT_MAT],
    // witte bloemetjes langs de rand
    [merge([[-0.38, 0.11], [-0.16, 0.14], [0.08, 0.14], [0.3, 0.12], [-0.28, -0.13], [0.0, -0.15], [0.26, -0.13]].map(([x, z]) => flower(0.035, 0xf7f4ec, 0xffd23f).translate(x, 0.09, z))), PAINT_MAT, false],
    bedRim(0.94, 0.36, 1),
  ],
  tulips: [
    flowerBed(0.94, 0.38),
    [merge(TULIPS.flatMap(([x, y, z], i) => [
      rod(0.012, [x, 0.03, z], [x, y - 0.03, z], 5),
      longLeaf(x + (i % 2 ? -0.012 : 0.012), z, 0.24, i % 2 ? 0.4 : -0.4, i * 0.7), longLeaf(x + (i % 2 ? 0.012 : -0.012), z + 0.01, 0.17, i % 2 ? -0.5 : 0.5, i * 0.7),
    ])), STEM_MAT],
    [merge(TULIPS.flatMap(([x, y, z, color, inside]) => tulip(x, y, z, color, inside))), PAINT_MAT],
    // blauwe druifjes langs de rand
    [painted(
      [0x5fa544, ...[-0.36, -0.22, -0.08, 0.08, 0.22, 0.36].map((x, i) => rod(0.008, [x, 0.04, i % 2 ? -0.15 : 0.15], [x, 0.15, i % 2 ? -0.15 : 0.15], 4))],
      [0x6a7be0, ...[-0.36, -0.22, -0.08, 0.08, 0.22, 0.36].map((x, i) => petal(0.03, 1, 2, 1).translate(x, 0.19, i % 2 ? -0.15 : 0.15))],
    ), PAINT_MAT],
    bedRim(0.94, 0.38, 2),
  ],
  mushrooms: [
    [merge(SHROOMS.flatMap(([x, z, h, r], n) => [tube(r * 0.28, r * 0.4, h, x, h / 2, z), tube(r * 0.9, r * 0.5, 0.02, x, h, z), tube(r * 0.44, r * 0.36, 0.018, x, h * 0.7, z), ...shroomDots([x, z, h, r], n)])), WHITE_MAT],
    [merge(SHROOMS.map(([x, z, h, r]) => new THREE.SphereGeometry(r, 9, 4, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.75, 1).translate(x, h + 0.01, z))), std(0xd8362e, 0.6)],
    // een paar sprietjes gras eromheen
    [merge([[-0.3, 0.16, 0.14, 0.3], [-0.26, 0.2, 0.1, -0.2], [0.28, -0.02, 0.13, -0.3], [0.24, 0.06, 0.09, 0.25], [0.02, 0.3, 0.11, 0.2], [-0.18, -0.16, 0.1, -0.3]].map(([x, z, h, lean], i) =>
      new THREE.ConeGeometry(0.03, h, 4).translate(0, h / 2, 0).rotateZ(lean).rotateY(i * 1.3).translate(x, 0, z))), LEAF_MAT, false],
    // een paar madeliefjes ertussen
    [merge([...bloom(0.3, 0.07, 0.16, 0xf7f4ec, 0.035), ...bloom(-0.3, 0.06, -0.08, 0xf7f4ec, 0.03), ...bloom(0.0, 0.06, 0.34, 0xf7f4ec, 0.03)]), PAINT_MAT, false],
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
      // drie treden van rots, elk een stukje verder naar achteren, zodat het water er in drie stappen af valt
      [0x8f949c, fallRock(0.46, 0.42, 0.5, 0, 0.25, -0.233, 0.6)],
      [0x9aa0a8, fallRock(0.38, 0.34, 0.4, -0.04, 0.7, -0.288, 0.6)],
      [0x858a92, fallRock(0.26, 0.2, 0.28, 0.04, 1.04, -0.3, 0.65)],
      [0x7d828a, stone(0.3, 0.5, 0.3, 0.38, -0.05, -0.16, 0.5), stone(0.26, 0.3, 0.26, -0.36, 0.42, -0.3, 2.1), stone(0.26, 0.2, 0.24, -0.16, 0.98, -0.36, 0.3)],
      [0xa0a5ad, stone(0.3, 0.42, 0.3, -0.4, -0.05, -0.16, 1.3), stone(0.28, 0.32, 0.28, 0.32, 0.44, -0.3, 0.9), stone(0.2, 0.18, 0.2, 0.24, 0.98, -0.32, 1.7)],
      [0x86b85c, blob(0.12, 1.2, 0.4, 1, 0.26, 0.52, -0.1, 0), blob(0.1, 1.2, 0.4, 1, -0.28, 0.52, -0.08, 0), blob(0.09, 1.2, 0.4, 1, -0.24, 0.92, -0.2, 0), blob(0.08, 1.2, 0.4, 1, 0.12, 1.2, -0.34, 0)],
      // een varentje en een paar bloemetjes op de rots
      [0x5fa544, ...[-0.4, 0, 0.4].map(a => new THREE.ConeGeometry(0.03, 0.18, 4).translate(0, 0.09, 0).rotateZ(a).translate(0.3, 0.54, -0.1)), ...[-0.4, 0.1, 0.5].map(a => new THREE.ConeGeometry(0.025, 0.14, 4).translate(0, 0.07, 0).rotateZ(a).translate(-0.24, 0.94, -0.2))],
      [0xf06aa6, dot(0.03, -0.3, 0.57, -0.06), dot(0.026, 0.2, 0.57, -0.12)],
      [0xffd23f, dot(0.026, 0.1, 1.24, -0.34), dot(0.024, -0.22, 0.57, -0.1)],
    ), MATTE_MAT],
    [merge([
      boxAt(0.18, 0.03, 0.14, 0.04, 1.185, -0.21), boxAt(0.18, 0.3, 0.04, 0.04, 1.04, -0.14),
      boxAt(0.2, 0.03, 0.1, 0.03, 0.905, -0.11), boxAt(0.2, 0.42, 0.04, 0.03, 0.7, -0.065),
      boxAt(0.24, 0.03, 0.1, 0.02, 0.505, -0.02), boxAt(0.24, 0.44, 0.04, 0.02, 0.29, 0.035),
      ball(0.07, -0.08, 0.1, 0.08), ball(0.06, 0.12, 0.09, 0.07), ball(0.045, 0.02, 0.1, 0.13),
    ]), SPRAY_MAT, false],
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
      [0xc8cfd5, boxAt(0.52, 0.06, 0.52, 0, 0.43, 0), boxAt(0.48, 0.03, 0.48, 0, 0.115, 0), ...[-1, 1].flatMap(kx => [-1, 1].map(kz => ball(0.035, kx * 0.25, 0.135, kz * 0.25)))],
      [0xd9b24a, boxAt(0.24, 0.12, 0.02, 0, 0.26, 0.225)],
      // klimop tegen de sokkel
      [0x5fa544, blob(0.07, 1, 0.8, 0.6, -0.2, 0.14, 0.23, 0), blob(0.06, 1, 0.8, 0.6, -0.16, 0.24, 0.23, 0), blob(0.05, 1, 0.8, 0.6, -0.2, 0.33, 0.23, 0), blob(0.06, 0.6, 0.8, 1, 0.23, 0.15, -0.14, 0)],
    ), MATTE_MAT],
    [merge([
      blob(0.15, 0.95, 1.15, 1.05, 0, 0.63, -0.04), blob(0.1, 1, 0.8, 1.2, -0.11, 0.53, -0.06), blob(0.1, 1, 0.8, 1.2, 0.11, 0.53, -0.06),
      tube(0.035, 0.04, 0.26, -0.07, 0.59, 0.1), tube(0.035, 0.04, 0.26, 0.07, 0.59, 0.1), blob(0.045, 1, 0.6, 1.4, -0.07, 0.485, 0.13), blob(0.045, 1, 0.6, 1.4, 0.07, 0.485, 0.13),
      blob(0.16, 1, 1, 0.72, 0, 0.87, 0, 0), ball(0.105, 0, 0.89, 0.07), blob(0.055, 1, 0.8, 1, 0, 0.86, 0.16), ball(0.036, -0.085, 0.99, 0.05), ball(0.036, 0.085, 0.99, 0.05),
      // de manen: een krans van bolletjes om zijn kop
      ...around(9, 0.16, (x, y) => ball(0.052, x, 0.87 + y, -0.04)),
      rod(0.018, [0, 0.5, -0.18], [0.17, 0.5, -0.2], 5), ball(0.036, 0.19, 0.52, -0.2),
    ]), GOLD_MAT],
  ],
  topiary: [
    [painted(
      [0xc9553f, new THREE.CylinderGeometry(0.18, 0.13, 0.2, 20).translate(0, 0.1, 0)],
      [0xb5472f, new THREE.CylinderGeometry(0.2, 0.2, 0.045, 20).translate(0, 0.19, 0), new THREE.CylinderGeometry(0.15, 0.15, 0.025, 20).translate(0, 0.012, 0)],
      [0xe0876a, new THREE.CylinderGeometry(0.166, 0.152, 0.02, 20).translate(0, 0.1, 0)],
      [0x5a3d22, new THREE.CylinderGeometry(0.165, 0.165, 0.012, 20).translate(0, 0.214, 0)],
    ), MATTE_MAT],
    [new THREE.CylinderGeometry(0.03, 0.04, 0.3, 8).translate(0, 0.33, 0), WOOD_MAT],
    [topiaryGeo(), BUSH_MAT],
  ],
  lantern: [
    [mergeGeometries([
      tube(0.035, 0.05, 1.0, 0, 0.5, 0), tube(0.1, 0.12, 0.06, 0, 0.03, 0), tube(0.065, 0.085, 0.05, 0, 0.085, 0), tube(0.05, 0.05, 0.03, 0, 0.62, 0), tube(0.1, 0.045, 0.05, 0, 1.02, 0),
      // een ring en een dwarsstang met een bolletje aan elke kant, zoals bij een oude straatlantaarn
      tube(0.052, 0.052, 0.03, 0, 0.32, 0), boxAt(0.24, 0.02, 0.02, 0, 0.9, 0), boxAt(0.035, 0.035, 0.035, -0.12, 0.9, 0), boxAt(0.035, 0.035, 0.035, 0.12, 0.9, 0),
    ])!, std(0x3d4f5a, 0.7)],
    // het licht: om zijn eigen midden, zodat het kan flakkeren (zie buildDecor)
    [new THREE.CylinderGeometry(0.115, 0.085, 0.2, 4).rotateY(Math.PI / 4), LAMP_MAT],
    // het kapje, met vier dunne stijlen om het licht
    [merge([
      cone(0.17, 0.12, 0, 1.31, 0, 4), ball(0.03, 0, 1.385, 0), boxAt(0.2, 0.02, 0.2, 0, 1.045, 0), boxAt(0.25, 0.02, 0.25, 0, 1.255, 0),
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
    [merge([tube(0.028, 0.036, 1.25, -0.1, 0.625, 0), tube(0.08, 0.1, 0.04, -0.1, 0.02, 0), tube(0.045, 0.045, 0.03, -0.1, 0.4, 0), rod(0.022, [-0.1, 1.24, 0], [0.12, 1.3, 0], 6), rod(0.012, [0.12, 1.3, 0], [0.12, 1.16, 0], 5), ball(0.035, -0.1, 1.27, 0)]), std(0x7a5230, 0.9)],
    [new THREE.IcosahedronGeometry(0.15, 1).scale(1, 1.15, 1), LAMP_MAT, false],
    // de rode dopjes, de ribbels om de lampion en het kwastje
    [merge([
      tube(0.07, 0.085, 0.045, 0.12, 1.155, 0), tube(0.085, 0.07, 0.045, 0.12, 0.825, 0), tube(0.012, 0.012, 0.1, 0.12, 0.76, 0), ball(0.028, 0.12, 0.7, 0), cone(0.03, 0.07, 0.12, 0.655, 0, 6, true),
      ...[[-0.09, 0.132], [0, 0.156], [0.09, 0.132]].map(([y, r]) => new THREE.TorusGeometry(r, 0.007, 4, 14).rotateX(Math.PI / 2).translate(0.12, 0.99 + y, 0)),
    ]), std(0xe0584f, 0.7)],
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
      tube(0.04, 0.055, 1.5, 0, 0.75, 0), tube(0.11, 0.13, 0.06, 0, 0.03, 0), tube(0.07, 0.09, 0.05, 0, 0.085, 0), tube(0.085, 0.085, 0.04, 0, 0.14, 0),
      tube(0.058, 0.058, 0.03, 0, 0.5, 0), tube(0.052, 0.052, 0.03, 0, 1.05, 0),
      rod(0.026, [0, 1.48, 0], [-0.24, 1.56, 0], 6), rod(0.026, [0, 1.48, 0], [0.24, 1.56, 0], 6),
      // een krul onder elke arm
      new THREE.TorusGeometry(0.075, 0.012, 4, 10, Math.PI * 1.4).rotateZ(0.2).translate(-0.12, 1.4, 0), new THREE.TorusGeometry(0.075, 0.012, 4, 10, Math.PI * 1.4).rotateZ(0.2).rotateY(Math.PI).translate(0.12, 1.4, 0),
      cone(0.13, 0.08, -0.24, 1.52, 0, 8), cone(0.13, 0.08, 0.24, 1.52, 0, 8), ball(0.04, 0, 1.52, 0), cone(0.03, 0.1, 0, 1.6, 0, 6),
    ]), std(0x3d4f5a, 0.7)],
    [merge([new THREE.IcosahedronGeometry(0.095, 1).translate(-0.24, 0, 0), new THREE.IcosahedronGeometry(0.095, 1).translate(0.24, 0, 0)]), LAMP_MAT, false],
  ],
  // vlag: het doek golft in vier banen, rood met een gele streep
  flag: [
    [mergeGeometries([tube(0.03, 0.035, 1.5, 0, 0.75, 0), tube(0.1, 0.12, 0.05, 0, 0.025, 0), tube(0.07, 0.09, 0.04, 0, 0.07, 0), tube(0.045, 0.045, 0.03, 0, 0.32, 0), tube(0.04, 0.04, 0.025, 0, 1.46, 0)])!, WHITE_MAT],
    [painted(
      [0xe0584f, ...[0, 1, 2, 3].flatMap(i => [1.4, 1.2].map(y => flagStrip(i, y, 0.02)))],
      [0xffd23f, ...[0, 1, 2, 3].map(i => flagStrip(i, 1.3, 0.022))],
    ), PAINT_MAT],
    [ball(0.05, 0, 1.52, 0), GOLD_MAT],
  ],
  // wegwijzer: twee borden met een punt, elk een andere kant op
  signpost: [
    [merge([boxAt(0.08, 0.95, 0.08, 0, 0.475, 0), cone(0.07, 0.07, 0, 0.985, 0, 4), prism(0.1, 0.13, 0.06, 0, 0.03, 0, 6)]), WOOD_MAT],
    [painted(
      [0xf7f4ec, boxAt(0.42, 0.14, 0.04, 0.16, 0.82, 0.05), new THREE.CylinderGeometry(0.081, 0.081, 0.04, 3).rotateX(Math.PI / 2).rotateZ(Math.PI / 2).translate(0.41, 0.82, 0.05)],
      [0x9fd8f5, boxAt(0.42, 0.14, 0.04, -0.16, 0.6, 0.05), new THREE.CylinderGeometry(0.081, 0.081, 0.04, 3).rotateX(Math.PI / 2).rotateZ(-Math.PI / 2).translate(-0.41, 0.6, 0.05)],
      // een derde bord: geel, laag en naar rechts
      [0xffd23f, boxAt(0.34, 0.12, 0.04, 0.13, 0.4, 0.05), new THREE.CylinderGeometry(0.069, 0.069, 0.04, 3).rotateX(Math.PI / 2).rotateZ(Math.PI / 2).translate(0.334, 0.4, 0.05)],
      [0x3d4f5a, boxAt(0.26, 0.022, 0.05, 0.16, 0.845, 0.05), boxAt(0.18, 0.022, 0.05, 0.12, 0.795, 0.05), boxAt(0.2, 0.022, 0.05, 0.13, 0.4, 0.05)],
      [0xf7f4ec, boxAt(0.26, 0.022, 0.05, -0.16, 0.625, 0.05), boxAt(0.18, 0.022, 0.05, -0.12, 0.575, 0.05)],
      // een paar keien en wat gras aan de voet
      [0x9aa3ab, stone(0.13, 0.08, 0.11, 0.12, -0.01, 0.1, 0.6), stone(0.1, 0.06, 0.09, -0.13, -0.01, 0.06, 1.7)],
      [0x6fb44c, cone(0.03, 0.14, -0.1, 0.07, -0.1, 4), cone(0.03, 0.11, 0.14, 0.055, -0.08, 4), cone(0.03, 0.12, -0.02, 0.06, 0.16, 4)],
    ), PAINT_MAT],
  ],
  // kei: een paar ronde stenen met mos en een plukje gras
  boulder: [
    [merge([
      painted(
        [0x8f949c, stone(0.52, 0.38, 0.44, -0.06, -0.05, 0, 0.3)],
        [0xa0a5ad, stone(0.3, 0.26, 0.3, 0.24, -0.04, 0.14, 1.1), stone(0.14, 0.1, 0.12, -0.3, -0.02, 0.26, 0.4)],
        [0x7d828a, stone(0.26, 0.2, 0.24, -0.12, 0.22, -0.02, 2), stone(0.12, 0.08, 0.1, 0.36, -0.02, -0.14, 1.6)],
        [0x86b85c, blob(0.11, 1.2, 0.35, 1, 0.02, 0.3, 0.06, 0), blob(0.07, 1.2, 0.35, 1, 0.26, 0.2, 0.14, 0)],
        [0x6fb44c, cone(0.03, 0.14, 0.32, 0.07, -0.12, 4), cone(0.03, 0.11, 0.38, 0.055, -0.06, 4), cone(0.03, 0.12, -0.36, 0.06, -0.14, 4), cone(0.03, 0.13, -0.2, 0.065, 0.3, 4)],
      ),
      // twee madeliefjes ertussen
      ...bloom(-0.34, 0.1, 0.12, 0xf7f4ec, 0.04), ...bloom(0.12, 0.09, 0.32, 0xf7f4ec, 0.035),
    ]), MATTE_MAT],
  ],
  // cactus: een ronde stam met twee armen, stekels en bloemen
  cactus: [
    [merge([
      tube(0.12, 0.13, 0.66, 0, 0.33, 0), blob(0.12, 1, 0.8, 1, 0, 0.66, 0),
      // ribbels over de stam
      ...around(8, 0.118, (x, z) => boxAt(0.034, 0.64, 0.034, x, 0.33, z)),
      tube(0.06, 0.06, 0.24, -0.27, 0.5, 0), blob(0.06, 1, 0.9, 1, -0.27, 0.62, 0), tube(0.06, 0.06, 0.18, 0.27, 0.62, 0), blob(0.06, 1, 0.9, 1, 0.27, 0.71, 0),
    ]), CACTUS_MAT],
    [merge([rod(0.055, [-0.1, 0.38, 0], [-0.27, 0.38, 0], 7), ball(0.062, -0.27, 0.38, 0), rod(0.055, [0.1, 0.53, 0], [0.27, 0.53, 0], 7), ball(0.062, 0.27, 0.53, 0)]), CACTUS_MAT],
    [merge([
      ...bloom(0, 0.765, 0, 0xf06aa6, 0.07), ...bloom(-0.27, 0.68, 0, 0xffd23f, 0.045), ...bloom(0.27, 0.76, 0, 0xf06aa6, 0.04),
      ...[[0.2, 0.3], [1.5, 0.5], [2.9, 0.22], [4.2, 0.44], [5.4, 0.12], [0.9, 0.14], [3.6, 0.58], [2.1, 0.36], [4.9, 0.3], [0.5, 0.52], [3.1, 0.42], [5.9, 0.4]].map(([a, y]) => paint(boxAt(0.022, 0.022, 0.022, Math.cos(a) * 0.142, y, Math.sin(a) * 0.142), 0xf3ead6)),
    ]), PAINT_MAT],
    // een bergje zand met een paar steentjes
    [painted(
      [0xe6cf9a, blob(0.26, 1, 0.16, 1, 0, 0.005, 0, 1)],
      [0xb9c2c9, stone(0.1, 0.06, 0.08, 0.17, 0.015, 0.12, 0.5), stone(0.07, 0.05, 0.07, -0.18, 0.015, -0.1, 1.4), stone(0.06, 0.04, 0.05, -0.12, 0.02, 0.17, 2.2)],
    ), MATTE_MAT, false],
  ],
  // bamboe: stengels met knopen en spitse blaadjes
  bamboogrove: [
    [merge(BAMBOO.flatMap(([x, h, z]) => [
      tube(0.028, 0.038, h, x, h / 2, z), ...[0.15, 0.3, 0.45, 0.6, 0.75, 0.9, 1.05, 1.2].filter(y => y < h - 0.05).map(y => tube(0.043, 0.043, 0.022, x, y, z)), cone(0.03, 0.1, x, h + 0.05, z, 6),
    ])), std(0x8cc152, 0.7)],
    [merge(BAMBOO.flatMap(([x, h, z], i) => [0, 1, 2, 3].map(k =>
      blob(0.13, 1, 0.14, 0.36, 0.12, 0, 0, 0).rotateZ(-0.35 - k * 0.12).rotateY(i * 1.3 + k * 2.2).translate(x, h - 0.05 - k * 0.17, z)))), LEAF_MAT],
    // een paar keien aan de voet
    [merge([stone(0.16, 0.09, 0.13, -0.3, -0.01, 0.3, 0.4), stone(0.13, 0.08, 0.11, 0.32, -0.01, 0.26, 1.2), stone(0.1, 0.06, 0.09, 0.08, -0.01, 0.38, 2.1), stone(0.12, 0.07, 0.1, -0.36, -0.01, -0.2, 0.9)]), ROCK_MAT],
  ],
  // zonnebloemen: de stelen, de gele blaadjes en de bruine harten knikken samen (zie animateDecor)
  sunflowers: [
    flowerBed(0.94, 0.32),
    [merge(SUNS.flatMap(([x, y]) => [
      rod(0.018, [x, 0.03, 0], [x, y, 0], 6),
      petal(0.11, 1, 0.16, 0.6).translate(0.1, 0, 0).rotateZ(0.5).translate(x, y * 0.4, 0), petal(0.11, 1, 0.16, 0.6).translate(-0.1, 0, 0).rotateZ(-0.5).translate(x, y * 0.56, 0),
      petal(0.07, 1, 0.16, 0.6).translate(0.06, 0, 0).rotateZ(0.7).translate(x, y * 0.74, 0.01),
      // de kelk achter de bloem
      new THREE.CylinderGeometry(0.07, 0.03, 0.05, 10).rotateX(Math.PI / 2).translate(x, y, -0.01),
    ])), STEM_MAT],
    [merge(SUNS.flatMap(([x, y]) => sunPetals(x, y))), PAINT_MAT],
    [painted(
      [0x6b4a2a, ...SUNS.map(([x, y]) => new THREE.SphereGeometry(0.095, 10, 6).scale(1, 1, 0.42).translate(x, y, 0.04))],
      [0x4a3320, ...SUNS.map(([x, y]) => new THREE.SphereGeometry(0.055, 8, 5).scale(1, 1, 0.5).translate(x, y, 0.062))],
    ), MATTE_MAT],
    // lage goudsbloemen aan de voet van de zonnebloemen
    [merge([-0.36, -0.13, 0.13, 0.36].flatMap((x, i) => [
      paint(petal(0.07, 1.3, 0.6, 1).translate(x, 0.09, i % 2 ? -0.06 : 0.07), 0x5fa544),
      flower(0.05, i % 2 ? 0xffd23f : 0xf08a24, i % 2 ? 0xf08a24 : 0xffd23f, 7).translate(x - 0.03, 0.15, i % 2 ? -0.06 : 0.08),
      flower(0.04, i % 2 ? 0xf08a24 : 0xffd23f, i % 2 ? 0xffd23f : 0xf08a24, 7).translate(x + 0.05, 0.14, i % 2 ? -0.09 : 0.05),
    ])), PAINT_MAT],
    bedRim(0.94, 0.32, 3),
  ],
  cherry: [
    [trunk(0.6, 0.095), std(0x7a4f2c, 1)],
    [canopy(CHERRY_BLOBS, CHERRY_LOOK), CHERRY_MAT],
    // blaadjes die op de grond gevallen zijn
    [merge([[-0.34, 0.2], [-0.2, 0.36], [0.1, 0.4], [0.34, 0.22], [0.4, -0.1], [0.2, -0.34], [-0.12, -0.38], [-0.4, -0.12], [0.06, 0.24], [-0.24, -0.2]].map(([x, z], i) =>
      petal(0.035, 1.3, 0.25, 0.8).rotateY(i * 1.1).translate(x, 0.012, z))), CHERRY_B, false],
    // losse bloesems over de hele kruin, bijna wit
    [onCrown(CHERRY_SHAPE, spiral(34, 0.97, -0.55), 0.036), CHERRY_C],
  ],
  // pompoenen: platte bollen met banen en een steeltje, op een paar grote bladeren
  pumpkins: [
    [merge([
      pumpkin(0.21, -0.12, 0), pumpkin(0.14, 0.2, 0.14), pumpkin(0.11, 0.14, -0.2), pumpkin(0.085, -0.3, -0.24),
      ...[[-0.12, 0.32, 0, 0.05], [0.2, 0.21, 0.14, 0.04], [0.14, 0.165, -0.2, 0.035], [-0.3, 0.128, -0.24, 0.03]].map(([x, y, z, h]) => paint(rod(0.022, [x, y - 0.02, z], [x + 0.02, y + h, z], 5, 0.014), 0x6b8f3a)),
      // een rank met een krul
      paint(rod(0.012, [-0.02, 0.04, 0.12], [0.1, 0.07, 0.3], 4), 0x6b8f3a), paint(rod(0.012, [0.1, 0.07, 0.3], [-0.06, 0.04, 0.38], 4), 0x6b8f3a),
      paint(new THREE.TorusGeometry(0.035, 0.009, 4, 9, 4.6).rotateX(Math.PI / 2).translate(-0.09, 0.04, 0.36), 0x6b8f3a),
    ]), PAINT_MAT],
    [merge([
      blob(0.14, 1, 0.12, 0.8, 0.14, 0.03, -0.02, 0), blob(0.12, 0.8, 0.12, 1, -0.3, 0.03, 0.2, 0), blob(0.1, 1, 0.12, 0.8, -0.02, 0.03, -0.3, 0),
      blob(0.09, 1, 0.12, 0.8, 0.14, 0.06, 0.32, 0), blob(0.08, 0.8, 0.12, 1, 0.36, 0.03, -0.1, 0),
    ]), LEAF2],
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
    [merge([boxAt(0.06, 0.94, 0.06, -0.4, 0.47, 0), boxAt(0.06, 0.94, 0.06, 0.4, 0.47, 0), ...ARCH.slice(1).map((p, i) => beam(0.06, ARCH[i], p))]), WHITE_MAT],
    [ARCH_VINE.geo, BUSH_MAT],
    // bloemen op de slinger: aan de voorkant, de achterkant en de buitenkant
    [merge(([
      [1, 1.5, 0xf06aa6], [3, 1.2, 0xf7f4ec], [5, 1.7, 0xe0584f], [7, 1.3, 0xf06aa6], [9, 1.8, 0xffd23f], [11, 1.4, 0xf7f4ec], [13, 1.6, 0xe0584f], [15, 1.2, 0xf06aa6], [17, 1.7, 0xf7f4ec], [19, 1.4, 0xe0584f], [21, 1.6, 0xffd23f],
      [2, 4.6, 0xe0584f], [6, 4.9, 0xf7f4ec], [10, 4.5, 0xf06aa6], [12, 4.8, 0xffd23f], [16, 4.6, 0xf06aa6], [20, 4.9, 0xe0584f],
      [4, 0.2, 0xffd23f], [8, 0, 0xf06aa6], [11, 0.3, 0xe0584f], [14, -0.2, 0xf7f4ec], [18, 0.1, 0xffd23f],
    ] as [number, number, number][]).map(([i, a, color]) => {
      const [at, out] = ARCH_VINE.at(i, a);
      return aim(flower(0.06, color, color === 0xffd23f ? 0xf08a24 : 0xffd23f), at, out);
    })), PAINT_MAT],
  ],
  // molen: een witte toren op een stenen voet, met raampjes, een rode kap en vier wieken met zeilen
  windmill: [
    [painted(
      [0xeedfc0, tube(0.17, 0.3, 0.9, 0, 0.45, 0)],
      [0xb9c2c9, tube(0.305, 0.32, 0.14, 0, 0.07, 0)],
      // losse stenen in de voet, en een omloop met een leuning halverwege
      [0x9aa3ab, ...around(9, 0.318, (x, z, i) => stone(0.11, 0.07, 0.07, x, 0.02 + (i % 2) * 0.05, z, i * 0.7))],
      [0xa8743f, tube(0.29, 0.27, 0.03, 0, 0.5, 0)],
      [0x8a5a2e, ...around(10, 0.275, (x, z) => boxAt(0.02, 0.09, 0.02, x, 0.56, z)), new THREE.TorusGeometry(0.275, 0.012, 4, 20).rotateX(Math.PI / 2).translate(0, 0.61, 0)],
      [0xfffaf0, boxAt(0.12, 0.14, 0.03, 0.13, 0.66, 0.16), boxAt(0.03, 0.14, 0.12, 0.225, 0.36, 0.12), boxAt(0.12, 0.14, 0.03, -0.12, 0.3, 0.235)],
      [0x4a5a6a, boxAt(0.09, 0.11, 0.04, 0.13, 0.66, 0.16), boxAt(0.04, 0.11, 0.09, 0.225, 0.36, 0.12), boxAt(0.09, 0.11, 0.04, -0.12, 0.3, 0.235)],
      // bloemen bij de deur
      [0x5fa544, blob(0.06, 1.2, 0.7, 1, 0.2, 0.05, 0.3, 0), blob(0.06, 1.2, 0.7, 1, -0.2, 0.05, 0.3, 0)],
      [0xe0584f, dot(0.026, 0.18, 0.1, 0.32), dot(0.026, -0.22, 0.1, 0.31)],
      [0xffd23f, dot(0.024, 0.23, 0.09, 0.29), dot(0.024, -0.17, 0.09, 0.33)],
    ), MATTE_MAT],
    [merge([cone(0.22, 0.24, 0, 1.02, 0), tube(0.2, 0.2, 0.03, 0, 0.905, 0), ball(0.035, 0, 1.15, 0), rod(0.035, [0, 0.92, 0.08], [0, 0.92, 0.23], 7), boxAt(0.02, 0.12, 0.16, 0, 0.98, -0.24)]), std(0xc9553f)],
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
      [0xc9553f, boxAt(0.34, 0.36, 0.16, 0, 0.64, 0), blob(0.13, 1.3, 0.5, 0.75, 0, 0.81, 0, 0), boxAt(0.2, 0.13, 0.13, -0.27, 0.74, 0), boxAt(0.2, 0.13, 0.13, 0.27, 0.74, 0)],
      [0x4a90e2, boxAt(0.1, 0.1, 0.012, -0.08, 0.57, 0.082), boxAt(0.07, 0.06, 0.012, 0.28, 0.75, 0.067)],
      [0xffd23f, boxAt(0.035, 0.035, 0.012, 0.05, 0.7, 0.082), boxAt(0.035, 0.035, 0.012, 0.05, 0.6, 0.082), boxAt(0.035, 0.035, 0.012, 0.05, 0.52, 0.082)],
      // een touw om zijn middel
      [0x8a6a3a, boxAt(0.35, 0.03, 0.17, 0, 0.5, 0), boxAt(0.03, 0.1, 0.02, -0.06, 0.45, 0.086)],
      // stro: bosjes bij de handen, onder het hemd en in de kraag
      [0xe9d05a,
        ...[-1, 1].flatMap(k => [-0.4, 0, 0.4].map(a => new THREE.ConeGeometry(0.035, 0.17, 4).rotateZ((-k * Math.PI) / 2 + a).translate(k * (0.37 + Math.cos(a) * 0.08), 0.74 + k * Math.sin(a) * 0.08, 0))),
        ...[-0.13, -0.065, 0, 0.065, 0.13].map((x, i) => cone(0.035, 0.15 + (i % 2) * 0.03, x, 0.39, 0, 4, true)),
        boxAt(0.2, 0.04, 0.14, 0, 0.84, 0)],
    ), MATTE_MAT],
    [painted(
      [0xe8c66a, ball(0.15, 0, 0.98, 0)],
      // knoopogen, een gestikte lach en rode wangen
      [0x3a2a1a, dot(0.022, -0.055, 1.0, 0.138), dot(0.022, 0.055, 1.0, 0.138), boxAt(0.03, 0.012, 0.012, -0.045, 0.925, 0.132), boxAt(0.03, 0.012, 0.012, 0, 0.915, 0.14), boxAt(0.03, 0.012, 0.012, 0.045, 0.925, 0.132)],
      [0xf3a6b8, dot(0.02, -0.09, 0.95, 0.112), dot(0.02, 0.09, 0.95, 0.112)],
      [0xf08a24, new THREE.ConeGeometry(0.026, 0.08, 5).rotateX(Math.PI / 2).translate(0, 0.965, 0.175)],
      [0xe9d05a, ...[-0.13, -0.09, 0.1, 0.14].map((x, i) => cone(0.03, 0.12, x, 1.01, i % 2 ? 0.04 : -0.03, 4, true))],
    ), MATTE_MAT],
    [merge([
      painted(
        [0x8a5a2c, tube(0.25, 0.25, 0.03, 0, 1.08, 0), tube(0.1, 0.14, 0.16, 0, 1.17, 0)],
        [0xc9553f, tube(0.144, 0.144, 0.035, 0, 1.115, 0)],
        [0x2b2f36, blob(0.05, 0.9, 0.9, 1.3, -0.33, 0.83, 0), ball(0.036, -0.33, 0.885, 0.05), boxAt(0.03, 0.012, 0.07, -0.33, 0.83, -0.08)],
        [0xffd23f, new THREE.ConeGeometry(0.014, 0.04, 4).rotateX(Math.PI / 2).translate(-0.33, 0.88, 0.1)],
      ),
      // een bloem op zijn hoed
      ...bloom(0.1, 1.14, 0.15, 0xffd23f, 0.045, 1.1),
    ]), MATTE_MAT],
  ],
  // sneeuwpop: kooltjes als ogen en knopen, een wortelneus, takken als armen, een hoed en een sjaal
  snowman: [
    [mergeGeometries([blob(0.36, 1, 0.16, 1, 0, 0.02, 0), ball(0.27, 0, 0.25, 0), ball(0.2, 0, 0.62, 0), ball(0.15, 0, 0.9, 0)])!, WHITE_MAT],
    [merge([
      tube(0.17, 0.17, 0.025, 0, 1.02, 0), tube(0.11, 0.11, 0.15, 0, 1.1, 0),
      dot(0.019, -0.05, 0.935, 0.138), dot(0.019, 0.05, 0.935, 0.138), dot(0.022, 0, 0.7, 0.185), dot(0.022, 0, 0.6, 0.2), dot(0.024, 0, 0.36, 0.25),
      // een lach van kooltjes
      ...[-0.06, -0.03, 0, 0.03, 0.06].map(x => dot(0.012, x, 0.85 + Math.abs(x) * 0.25, 0.14 - Math.abs(x) * 0.12)),
    ]), std(0x3d4f5a, 0.7)],
    [painted(
      [0xf08a24, new THREE.ConeGeometry(0.03, 0.14, 6).rotateX(Math.PI / 2).translate(0, 0.895, 0.2)],
      [0x6b4a2a, rod(0.014, [0.17, 0.66, 0], [0.42, 0.82, 0.04], 4), rod(0.01, [0.36, 0.78, 0.03], [0.44, 0.74, 0.08], 4), rod(0.014, [-0.17, 0.66, 0], [-0.42, 0.8, 0.04], 4), rod(0.01, [-0.36, 0.77, 0.03], [-0.4, 0.86, 0.02], 4)],
      // een bezem in zijn hand
      [0x8a5a2c, rod(0.014, [0.47, 0.02, 0.1], [0.4, 1.0, 0.02], 5)],
      [0xe9d05a, new THREE.ConeGeometry(0.07, 0.2, 6).translate(0, -0.1, 0).rotateZ(-0.07).translate(0.4, 1.2, 0.02), tube(0.03, 0.03, 0.03, 0.4, 1.0, 0.02)],
    ), PAINT_MAT],
    [mergeGeometries([tube(0.165, 0.165, 0.05, 0, 0.77, 0), boxAt(0.07, 0.17, 0.03, 0.09, 0.68, 0.15), boxAt(0.06, 0.13, 0.03, 0.02, 0.69, 0.17), tube(0.113, 0.113, 0.03, 0, 1.045, 0)])!, std(0xe0584f)],
  ],
  // totempaal: drie gezichten boven elkaar, met vleugels en veren bovenop
  totem: [
    [painted(
      [0xe0584f, boxAt(0.36, 0.34, 0.36, 0, 0.17, 0), boxAt(0.2, 0.12, 0.06, -0.38, 0.96, -0.02), new THREE.ConeGeometry(0.05, 0.2, 4).translate(-0.1, 1.16, 0), boxAt(0.05, 0.1, 0.05, 0.3, 0.86, -0.02), boxAt(0.05, 0.08, 0.05, 0.46, 0.87, -0.02)],
      [0xffd23f, boxAt(0.36, 0.34, 0.36, 0, 0.53, 0), boxAt(0.2, 0.12, 0.06, 0.38, 0.96, -0.02), new THREE.ConeGeometry(0.055, 0.26, 4).translate(0, 1.19, 0), boxAt(0.05, 0.1, 0.05, -0.3, 0.86, -0.02), boxAt(0.05, 0.08, 0.05, -0.46, 0.87, -0.02)],
      [0x4a90e2, boxAt(0.36, 0.34, 0.36, 0, 0.89, 0), boxAt(0.05, 0.12, 0.05, -0.38, 0.85, -0.02), boxAt(0.05, 0.12, 0.05, 0.38, 0.85, -0.02)],
      [0x6cc04a, new THREE.ConeGeometry(0.05, 0.2, 4).translate(0.1, 1.16, 0), boxAt(0.07, 0.07, 0.02, -0.12, 0.44, 0.185), boxAt(0.07, 0.07, 0.02, 0.12, 0.44, 0.185)],
      [0x8a5a2e, boxAt(0.38, 0.03, 0.38, 0, 0.35, 0), boxAt(0.38, 0.03, 0.38, 0, 0.71, 0), boxAt(0.4, 0.04, 0.4, 0, 0.02, 0), boxAt(0.5, 0.12, 0.05, 0, 0.96, -0.02)],
      [0xf7f4ec, ...totemEyes(0.24)[0], ...totemEyes(0.6)[0], ...totemEyes(0.96)[0], ...[-0.075, -0.025, 0.025, 0.075].map(x => boxAt(0.04, 0.06, 0.02, x, 0.09, 0.185))],
      // de pupillen, de mond en boze wenkbrauwen boven elk paar ogen
      [0x2b2f36, ...totemEyes(0.24)[1], ...totemEyes(0.6)[1], ...totemEyes(0.96)[1], boxAt(0.22, 0.02, 0.02, 0, 0.13, 0.185),
        ...[0.315, 0.675, 1.035].flatMap(y => [-1, 1].map(k => new THREE.BoxGeometry(0.13, 0.026, 0.024).rotateZ(k * -0.28).translate(k * 0.08, y, 0.19)))],
      [0xf08a24, new THREE.ConeGeometry(0.06, 0.16, 4).rotateX(Math.PI / 2).translate(0, 0.48, 0.25), boxAt(0.07, 0.12, 0.05, 0, 0.84, 0.19)],
      // een krans van keien om de voet
      [0xb9c2c9, ...around(6, 0.25, (x, z, i) => stone(0.13, 0.07, 0.11, x, -0.01, z, i * 1.3))],
    ), PAINT_MAT],
  ],
  // kampvuur: een kring van keien, houtblokken tegen elkaar en twee vlammen
  campfire: [
    [painted(
      [0x8f949c, ...around(8, 0.28, (x, z, i) => stone(0.15, 0.1 + (i % 3) * 0.02, 0.13, x, -0.01, z, i * 1.4)).filter((_, i) => i % 2 === 0)],
      [0xaab0b8, ...around(8, 0.28, (x, z, i) => stone(0.15, 0.1 + (i % 3) * 0.02, 0.13, x, -0.01, z, i * 1.4)).filter((_, i) => i % 2 === 1)],
      // as in het midden
      [0x3a3632, tube(0.2, 0.22, 0.03, 0, 0.015, 0)],
    ), MATTE_MAT],
    [painted(
      [0x7a5230, rod(0.04, [-0.2, 0.05, -0.1], [0.2, 0.05, 0.1], 6), rod(0.04, [-0.12, 0.05, 0.18], [0.12, 0.06, -0.18], 6),
        ...[0, 1, 2, 3].map(i => rod(0.032, [Math.sin(i * 1.57 + 0.4) * 0.18, 0.02, Math.cos(i * 1.57 + 0.4) * 0.18], [Math.sin(i * 1.57 + 0.4) * -0.03, 0.27, Math.cos(i * 1.57 + 0.4) * -0.03], 6))],
      // de lichte kopse kanten van de blokken, en zwartgeblakerde punten
      [0xe3c08a, dot(0.036, -0.2, 0.05, -0.1), dot(0.036, 0.2, 0.05, 0.1), dot(0.036, -0.12, 0.05, 0.18), dot(0.036, 0.12, 0.06, -0.18)],
      [0x2e2a26, ...[0, 1, 2, 3].map(i => dot(0.036, Math.sin(i * 1.57 + 0.4) * -0.03, 0.27, Math.cos(i * 1.57 + 0.4) * -0.03))],
    ), MATTE_MAT],
    // de vlammen: los, met hun voet op nul, zodat ze kunnen flakkeren (zie buildDecor)
    [merge([cone(0.13, 0.36, 0, 0.18, 0, 6), cone(0.07, 0.24, -0.09, 0.12, 0.03, 5), cone(0.06, 0.2, 0.08, 0.1, -0.06, 5)]), FLAME_MAT, false],
    [merge([cone(0.07, 0.24, 0.02, 0.12, 0.02, 6), cone(0.04, 0.14, -0.06, 0.07, 0.04, 5)]), FLAME2_MAT, false],
  ],
  // klok: een groen huisje met een gouden rand om de wijzerplaat, op een paal met een voet
  clocktower: [
    [mergeGeometries([
      tube(0.05, 0.065, 1.0, 0, 0.56, 0), boxAt(0.3, 0.06, 0.3, 0, 0.03, 0), boxAt(0.2, 0.06, 0.2, 0, 0.09, 0), tube(0.1, 0.06, 0.07, 0, 1.04, 0),
      tube(0.075, 0.075, 0.03, 0, 0.3, 0), tube(0.07, 0.07, 0.03, 0, 0.62, 0), tube(0.085, 0.085, 0.04, 0, 0.14, 0),
    ])!, std(0x3d4f5a, 0.7)],
    [painted(
      [0x2f6e4f, boxAt(0.46, 0.46, 0.18, 0, 1.3, 0)],
      [0xd9b24a, new THREE.CylinderGeometry(0.205, 0.205, 0.19, 16).rotateX(Math.PI / 2).translate(0, 1.3, 0), boxAt(0.5, 0.04, 0.2, 0, 1.08, 0),
        // gouden krullen onder het huisje en een rand onder het dak
        new THREE.TorusGeometry(0.06, 0.013, 4, 10, Math.PI).rotateZ(Math.PI).translate(-0.14, 1.06, 0), new THREE.TorusGeometry(0.06, 0.013, 4, 10, Math.PI).rotateZ(Math.PI).translate(0.14, 1.06, 0),
        boxAt(0.5, 0.03, 0.2, 0, 1.53, 0)],
    ), PAINT_MAT],
    [new THREE.CylinderGeometry(0.18, 0.18, 0.2, 16).rotateX(Math.PI / 2).translate(0, 1.3, 0), WHITE_MAT],
    [mergeGeometries([
      boxAt(0.03, 0.14, 0.22, 0, 1.36, 0), boxAt(0.1, 0.03, 0.22, 0.04, 1.3, 0),
      boxAt(0.022, 0.04, 0.21, 0, 1.445, 0), boxAt(0.022, 0.04, 0.21, 0, 1.155, 0), boxAt(0.04, 0.022, 0.21, 0.145, 1.3, 0), boxAt(0.04, 0.022, 0.21, -0.145, 1.3, 0),
    ])!, std(0x3a2a1a)],
    [painted([0xc9553f, cone(0.3, 0.16, 0, 1.61, 0, 4)], [0xa8432f, boxAt(0.46, 0.025, 0.22, 0, 1.55, 0)], [0xd9b24a, ball(0.035, 0, 1.71, 0), tube(0.012, 0.012, 0.05, 0, 1.69, 0)]), PAINT_MAT],
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
      // een lijst om het bord, een nokbalkje en een blokje onder elke paal
      boxAt(0.72, 0.035, 0.07, 0, 0.965, 0), boxAt(0.72, 0.035, 0.07, 0, 0.435, 0), boxAt(0.06, 0.06, 0.24, 0, 1.13, 0), boxAt(0.13, 0.05, 0.13, -0.36, 0.025, 0), boxAt(0.13, 0.05, 0.13, 0.36, 0.025, 0),
    ])!, WOOD_MAT],
    [boxAt(0.68, 0.5, 0.05, 0, 0.7, 0), std(0xf3ead6)],
    [mergeGeometries([boxAt(0.26, 0.2, 0.06, -0.16, 0.78, 0), boxAt(0.2, 0.14, 0.06, 0.18, 0.58, 0)])!, std(0x86c95c)],
    [mergeGeometries([boxAt(0.18, 0.12, 0.06, 0.2, 0.82, 0), boxAt(0.1, 0.1, 0.06, -0.24, 0.56, 0)])!, std(0x6ec3e8)],
    [mergeGeometries([boxAt(0.34, 0.035, 0.06, -0.02, 0.66, 0), boxAt(0.035, 0.18, 0.06, 0.04, 0.57, 0)])!, std(0xe3ca82)],
    [new THREE.CylinderGeometry(0.045, 0.045, 0.08, 10).rotateX(Math.PI / 2).translate(0.04, 0.66, 0), std(0xe0241f, 0.6)],
  ],
  // slingerpaal: precies STRING_HEIGHT hoog, met een wimpel die los kan wapperen
  bunting: [
    // een feestelijke paal: wit met rode banden en een gouden bol
    [painted(
      [0xf7f4ec, tube(0.028, 0.038, STRING_HEIGHT, 0, STRING_HEIGHT / 2, 0), tube(0.1, 0.12, 0.05, 0, 0.025, 0), tube(0.06, 0.08, 0.04, 0, 0.07, 0)],
      [0xe0584f, ...[0.25, 0.5, 0.75, 1.0].map(y => tube(0.034, 0.037, 0.07, 0, y, 0))],
      [0xffd23f, ball(0.045, 0, STRING_HEIGHT + 0.03, 0)],
    ), PAINT_MAT],
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
/**
 * Hoe hoog elk soort hek is (zie EdgeKind): [bovenop de paal, bovenop de bovenste lat]. Een lage lamp die op het
 * hek staat, komt daar bovenop.
 */
export const FENCE_TOP: Record<number, [number, number]> = { 1: [0.5, 0.41], 2: [0.85, 0.8], 3: [0.39, 0.39], 4: [0.92, 0.92], 5: [0.74, 0.74], 6: [0.64, 0.64], 7: [0.4, 0.36], 8: [0.9, 0.9] };
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
// De safaripoort (soort 9): twee stevige palen met een dwarsbalk waar de jeep onderdoor past, en een bord met
// zebrastrepen. De twee deuren zijn los (SAFARI_LEAF_GEO): ze zwaaien open, van de jeep af. Op elke paal staat een
// oranje zwaailicht (SAFARI_BEACON_GEO) dat gaat draaien en knipperen zodra de poort opengaat.
const SAFARIGATE_GEO = mergeGeometries([
  paint(boxAt(0.13, 1.34, 0.13, 0.02, 0.67, 0), 0x8a5a34), paint(boxAt(0.13, 1.34, 0.13, 0.98, 0.67, 0), 0x8a5a34),
  paint(boxAt(1.18, 0.1, 0.12, 0.5, 1.36, 0), 0x6e4a2a),
  paint(boxAt(0.2, 0.08, 0.2, 0.02, 0.04, 0), 0x6e4a2a), paint(boxAt(0.2, 0.08, 0.2, 0.98, 0.04, 0), 0x6e4a2a),
  // het bord: geel, met zwarte en witte strepen
  paint(boxAt(0.6, 0.24, 0.05, 0.5, 1.56, 0), 0xffd23f), paint(boxAt(0.54, 0.18, 0.06, 0.5, 1.56, 0), 0xf7f4ec),
  ...[0.3, 0.43, 0.56, 0.69].map((x, i) => paint(new THREE.BoxGeometry(0.05, 0.18, 0.065).rotateZ(i % 2 ? 0.35 : -0.3).translate(x, 1.56, 0), 0x2c2f36)),
  // de voetjes van de zwaailichten, boven op de palen
  paint(tube(0.06, 0.07, 0.05, 0.02, 1.44, 0), 0x3d4f5a), paint(tube(0.06, 0.07, 0.05, 0.98, 1.44, 0), 0x3d4f5a),
].map(g => (g.index ? g.toNonIndexed() : g)))!;
/**
 * Een deur van de poort, met het scharnier op (0, 0, 0) en de deur langs +x: een houten raam met een schoor, drie
 * planken en bovenlangs een band in geel en zwart.
 */
const SAFARI_LEAF_GEO = mergeGeometries([
  paint(boxAt(0.42, 0.07, 0.05, 0.21, 0.16, 0), 0xa8743f), paint(boxAt(0.42, 0.07, 0.05, 0.21, 0.52, 0), 0xa8743f), paint(boxAt(0.42, 0.07, 0.05, 0.21, 0.86, 0), 0xa8743f),
  paint(boxAt(0.06, 0.78, 0.055, 0.03, 0.51, 0), 0x8a5a34), paint(boxAt(0.06, 0.78, 0.055, 0.39, 0.51, 0), 0x8a5a34),
  paint(beam(0.05, [0.04, 0.2, 0], [0.38, 0.82, 0]), 0x8a5a34),
  ...[0, 1, 2, 3, 4].map(i => paint(boxAt(0.084, 0.09, 0.06, 0.042 + i * 0.084, 0.97, 0), i % 2 ? 0x2c2f36 : 0xffd23f)),
].map(g => (g.index ? g.toNonIndexed() : g)))!;
/** Een zwaailicht, met de voet op (0, 0, 0): een oranje koepel. Het spiegeltje erin (SAFARI_BEAM_GEO) draait rond. */
const SAFARI_BEACON_GEO = new THREE.SphereGeometry(0.075, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 1.25, 1);
const SAFARI_BEAM_GEO = mergeGeometries([new THREE.ConeGeometry(0.11, 0.42, 6, 1, true).rotateZ(Math.PI / 2).translate(0.21, 0.05, 0), new THREE.ConeGeometry(0.11, 0.42, 6, 1, true).rotateZ(-Math.PI / 2).translate(-0.21, 0.05, 0)])!;
const SAFARI_BEACON_MAT = new THREE.MeshStandardMaterial({ color: 0xff9a1f, emissive: 0xff7a00, emissiveIntensity: 0.15, roughness: 0.35 });
/** De lichtbundel van een zwaailicht: twee zachte oranje kegels die ronddraaien (alleen te zien als het licht aan is). */
const SAFARI_BEAM_MAT = new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false, fog: false });
/** Het doorzichtige voorbeeld: de poort met de deuren dicht. */
const SAFARIGATE_GHOST_GEO = mergeGeometries([SAFARIGATE_GEO, SAFARI_LEAF_GEO.clone().translate(0.08, 0, 0), SAFARI_LEAF_GEO.clone().rotateY(Math.PI).translate(0.92, 0, 0)])!;
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

// ------------------------------------------------------------ versleten hekken per soort
// Elk soort hek slijt in drie fases (zie wear.ts). Het houten hek staat bovenaan (WORN_GEOS); hier staan het witte
// hekje, de stenen muur, het hoge net en het glas. Op plek 0 staat steeds het hele hek.

// Het witte hekje: eerst staat er een latje scheef, dan ligt er een op de grond en hangt de ligger los, dan ligt het
// hekje half plat. De verf wordt per fase grauwer.
const lath = (x: number, tilt: number): THREE.BufferGeometry => mergeGeometries(picket(0))!.rotateZ(tilt).translate(x, 0, 0);
const lathDown = (x: number, z: number, turn: number): THREE.BufferGeometry => mergeGeometries(picket(0))!.rotateZ(Math.PI / 2).rotateY(turn).translate(x, 0.03, z);
const picketPost = (x: number, h = 0.4): THREE.BufferGeometry[] => [boxAt(0.1, h, 0.1, x, h / 2, 0), new THREE.ConeGeometry(0.075, 0.07, 4).rotateY(Math.PI / 4).translate(x, h + 0.035, 0)];
const picketRail = (len: number, x: number, y: number, tilt: number): THREE.BufferGeometry => new THREE.BoxGeometry(len, 0.035, 0.06).rotateZ(tilt).translate(x, y, 0);
const PICKET_WORN = [
  PICKET_GEO,
  merge([...picketPost(0), ...picketPost(1), picketRail(0.9, 0.5, 0.1, 0), picketRail(0.9, 0.5, 0.215, 0.05), lath(0.2, 0), lath(0.35, 0.06), lath(0.5, -0.38), lath(0.65, 0), lath(0.8, 0.24)]),
  merge([...picketPost(0), ...picketPost(1, 0.37), picketRail(0.9, 0.5, 0.1, -0.02), picketRail(0.62, 0.34, 0.2, -0.17), lath(0.2, 0), lath(0.35, 0.12), lathDown(0.6, 0.17, 0.5), lath(0.65, -0.32), lath(0.8, 0.14)]),
  merge([...picketPost(0), ...picketPost(1, 0.2), picketRail(0.86, 0.5, 0.045, 0.03), picketRail(0.5, 0.27, 0.13, -0.42), lath(0.2, 0.12), lath(0.34, -0.55), lathDown(0.62, 0.18, 0.4), lathDown(0.8, -0.16, -0.7), lathDown(0.9, 0.14, 2.6)]),
];
const PICKET_WORN_MATS = [WHITE_MAT, ...[0xe9e3d3, 0xd6cdb8, 0xbfb49c].map(color => std(color, 0.95))];

// De stenen muur: eerst scheuren en een deksteen die scheef ligt, dan een hap uit de bovenrand met de steen ervoor
// op de grond, dan een gat tot bijna op de grond met de stenen aan weerskanten. De scheuren zijn een los onderdeel
// (donker), zodat de muur zelf zijn eigen kleur houdt.
const WALL_FOOT = boxAt(1.06, 0.06, 0.17, 0.5, 0.03, 0);
const WALL_STONES = [boxAt(0.22, 0.08, 0.15, 0.2, 0.14, 0), boxAt(0.2, 0.08, 0.15, 0.62, 0.21, 0), boxAt(0.18, 0.08, 0.15, 0.86, 0.12, 0), boxAt(0.16, 0.07, 0.15, 0.4, 0.24, 0)];
const capStone = (x: number, tilt = 0, y = 0.345): THREE.BufferGeometry => new THREE.BoxGeometry(0.2, 0.09, 0.16).rotateZ(tilt).translate(x, y, 0);
const looseStone = (x: number, z: number, turn: number, w = 0.18): THREE.BufferGeometry => new THREE.BoxGeometry(w, 0.08, 0.12).rotateY(turn).translate(x, 0.04, z);
const WALL_WORN = [
  WALL_GEO,
  merge([boxAt(1.06, 0.3, 0.13, 0.5, 0.15, 0), capStone(0.12), capStone(0.5, 0.17, 0.357), capStone(0.88), WALL_FOOT, ...WALL_STONES]),
  merge([boxAt(0.4, 0.3, 0.13, 0.17, 0.15, 0), boxAt(0.28, 0.19, 0.13, 0.51, 0.095, 0), boxAt(0.41, 0.3, 0.13, 0.855, 0.15, 0), capStone(0.12), capStone(0.88, -0.1, 0.35), WALL_FOOT, WALL_STONES[0], WALL_STONES[2], looseStone(0.5, 0.21, 0.5), looseStone(0.36, -0.2, -0.3, 0.14)]),
  merge([
    boxAt(0.3, 0.3, 0.13, 0.12, 0.15, 0), boxAt(0.14, 0.18, 0.13, 0.34, 0.09, 0), boxAt(0.3, 0.07, 0.13, 0.56, 0.035, 0), boxAt(0.12, 0.2, 0.13, 0.77, 0.1, 0), boxAt(0.2, 0.3, 0.13, 0.93, 0.15, 0),
    capStone(0.12, 0.08, 0.35), WALL_FOOT, WALL_STONES[2], looseStone(0.45, 0.22, 0.6), looseStone(0.62, -0.2, -0.4, 0.2), looseStone(0.72, 0.27, 1.2, 0.14), looseStone(0.3, -0.25, 0.2, 0.16),
  ]),
];
/** Een scheur: een zigzaglijn van punt naar punt (x, hoogte) op allebei de kanten van een wand die `half` dik is. */
const crackLine = (points: [number, number][], half: number, t: number): THREE.BufferGeometry[] =>
  [half, -half].flatMap(z => points.slice(1).map((p, i) => beam(t, [points[i][0], points[i][1], z], [p[0], p[1], z])));
const CRACK_MAT = std(0x4a4f57, 1);
const WALL_CRACKS = [
  null,
  merge(crackLine([[0.56, 0.3], [0.61, 0.22], [0.55, 0.15], [0.6, 0.07]], 0.062, 0.03)),
  merge([...crackLine([[0.3, 0.3], [0.34, 0.2], [0.27, 0.12], [0.31, 0.04]], 0.062, 0.03), ...crackLine([[0.76, 0.3], [0.71, 0.2], [0.77, 0.1]], 0.062, 0.03)]),
  merge([...crackLine([[0.2, 0.3], [0.24, 0.2], [0.18, 0.1], [0.22, 0.02]], 0.062, 0.03), ...crackLine([[0.94, 0.3], [0.9, 0.18], [0.95, 0.06]], 0.062, 0.03)]),
];

// Het hoge net: eerst hangt het door in het midden, dan hangt het verder door en is er een draad geknapt (de eindjes
// hangen naar beneden), dan is de bovenrand door en zit er een groot gat in.
const netStrand = (a: [number, number], b: [number, number]): THREE.BufferGeometry => beam(0.018, [a[0], a[1], 0], [b[0], b[1], 0]);
const netRope = (a: [number, number], b: [number, number]): THREE.BufferGeometry => beam(0.06, [a[0], a[1], 0], [b[0], b[1], 0]);
const NET_FRAME = [boxAt(0.1, 0.92, 0.1, 0, 0.46, 0), boxAt(0.1, 0.92, 0.1, 1, 0.46, 0), boxAt(1, 0.05, 0.05, 0.5, 0.06, 0)];
const NET_WORN = [
  NET_GEO,
  merge([
    ...NET_FRAME, netRope([0, 0.89], [0.5, 0.79]), netRope([0.5, 0.79], [1, 0.89]),
    ...[0.34, 0.62].flatMap(y => [netStrand([0, y], [0.5, y - 0.06]), netStrand([0.5, y - 0.06], [1, y])]),
    netStrand([0.25, 0.06], [0.25, 0.84]), netStrand([0.5, 0.06], [0.5, 0.79]), netStrand([0.75, 0.06], [0.75, 0.84]),
  ]),
  merge([
    ...NET_FRAME, netRope([0, 0.89], [0.5, 0.7]), netRope([0.5, 0.7], [1, 0.89]),
    netStrand([0, 0.62], [0.3, 0.55]), netStrand([0.3, 0.55], [0.36, 0.4]), netStrand([1, 0.62], [0.72, 0.56]), netStrand([0.72, 0.56], [0.66, 0.43]),
    netStrand([0, 0.34], [0.5, 0.26]), netStrand([0.5, 0.26], [1, 0.34]), netStrand([0.25, 0.06], [0.25, 0.79]), netStrand([0.75, 0.06], [0.75, 0.79]), netStrand([0.5, 0.06], [0.5, 0.28]),
  ]),
  merge([
    ...NET_FRAME, netRope([0, 0.89], [0.34, 0.6]), netRope([1, 0.89], [0.7, 0.66]),
    netStrand([0, 0.62], [0.22, 0.52]), netStrand([0.22, 0.52], [0.26, 0.38]), netStrand([1, 0.62], [0.8, 0.54]), netStrand([0.8, 0.54], [0.78, 0.4]),
    netStrand([0, 0.34], [0.2, 0.28]), netStrand([1, 0.34], [0.82, 0.3]), netStrand([0.2, 0.06], [0.2, 0.5]), netStrand([0.82, 0.06], [0.82, 0.52]),
    netStrand([0.34, 0.6], [0.4, 0.42]), netStrand([0.7, 0.66], [0.64, 0.5]),
    // een paar losse draadjes op de grond
    beam(0.018, [0.4, 0.02, 0.13], [0.62, 0.02, 0.2]), beam(0.018, [0.5, 0.02, -0.17], [0.7, 0.02, -0.11]),
  ]),
];

// Het glas: een barst die groeit (witte lijnen op de ruit, een los onderdeel), en in de laatste fase een gat in de
// ruit met een ster van barsten eromheen en scherven op de grond.
const GLASS_CRACK_MAT = std(0xffffff, 0.35);
const GLASS_HOLE: [number, number][] = [[0.44, 0.3], [0.58, 0.24], [0.72, 0.34], [0.7, 0.5], [0.56, 0.58], [0.42, 0.48]];
const GLASS_RAYS: [number, number][] = [[0.2, 0.14], [0.6, 0.08], [0.94, 0.26], [0.92, 0.62], [0.52, 0.69], [0.12, 0.6]];
const shard = (x: number, z: number, turn: number, r = 0.06): THREE.BufferGeometry => new THREE.CylinderGeometry(r, r, 0.012, 3).rotateY(turn).translate(x, 0.008, z);
const GLASS_CRACKS = [
  null,
  merge(crackLine([[0.82, 0.69], [0.72, 0.57], [0.77, 0.49], [0.66, 0.4]], 0.016, 0.024)),
  merge([
    ...crackLine([[0.84, 0.69], [0.72, 0.56], [0.77, 0.46], [0.58, 0.36], [0.61, 0.26], [0.46, 0.15]], 0.016, 0.024),
    ...crackLine([[0.72, 0.56], [0.55, 0.58]], 0.016, 0.024), ...crackLine([[0.58, 0.36], [0.76, 0.3]], 0.016, 0.024),
  ]),
  merge([
    ...crackLine([...GLASS_HOLE, GLASS_HOLE[0]], 0.016, 0.024), ...GLASS_HOLE.flatMap((p, i) => crackLine([p, GLASS_RAYS[i]], 0.016, 0.024)),
    shard(0.45, 0.16, 0.4), shard(0.62, 0.22, 1.5, 0.045), shard(0.55, -0.17, 2.3), shard(0.7, -0.13, 0.9, 0.04),
  ]),
];
/** De ruit met een gat erin (even groot als de gewone ruit, GLASS_PANE_GEO). */
const GLASS_BROKEN_PANE = ((): THREE.BufferGeometry => {
  const shape = new THREE.Shape([[0.04, 0.07], [0.96, 0.07], [0.96, 0.69], [0.04, 0.69]].map(([x, y]) => new THREE.Vector2(x, y)));
  shape.holes.push(new THREE.Path(GLASS_HOLE.map(([x, y]) => new THREE.Vector2(x, y))));
  return new THREE.ExtrudeGeometry(shape, { depth: 0.025, bevelEnabled: false }).translate(0, 0, -0.0125);
})();

/**
 * Hoe een versleten muur, net, glas of wit hekje eruitziet, per fase. `geo`: de vorm van het hek zelf; `mats`: een
 * eigen materiaal per fase (zonder: dat van het hele hek); `extra`: een los onderdeel erbij in een eigen kleur (de
 * scheuren); `pane`: een andere ruit (met een gat erin).
 */
interface WornLook {
  geo: THREE.BufferGeometry[];
  mats?: THREE.Material[];
  extra?: (Part | null)[];
  pane?: (THREE.BufferGeometry | null)[];
}
const WORN_LOOK: Partial<Record<number, WornLook>> = {
  3: { geo: WALL_WORN, extra: WALL_CRACKS.map((g): Part | null => (g ? [g, CRACK_MAT] : null)) },
  4: { geo: NET_WORN },
  5: { geo: [GLASS_FRAME_GEO, GLASS_FRAME_GEO, GLASS_FRAME_GEO, GLASS_FRAME_GEO], extra: GLASS_CRACKS.map((g): Part | null => (g ? [g, GLASS_CRACK_MAT] : null)), pane: [null, null, null, GLASS_BROKEN_PANE] },
  7: { geo: PICKET_WORN, mats: PICKET_WORN_MATS },
};

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
      [0xf3a6b8, dot(0.026, 0, 0.238, 0.092), dot(0.017, -0.052, 0.228, 0.072), dot(0.017, 0.052, 0.228, 0.072)],
      // armpjes met handjes
      [0x3f7fcf, blob(0.034, 0.8, 1.7, 0.8, -0.105, 0.125, 0.02, 0), blob(0.034, 0.8, 1.7, 0.8, 0.105, 0.125, 0.02, 0)],
      [0xf6cfa6, dot(0.024, -0.108, 0.07, 0.035), dot(0.024, 0.108, 0.07, 0.035)],
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
      // een blauw vogeltje op het stokje
      [0x4a90e2, blob(0.03, 0.9, 0.9, 1.3, 0, 0.318, 0.14, 0), dot(0.022, 0, 0.345, 0.165)],
      [0xffd23f, new THREE.ConeGeometry(0.009, 0.026, 4).rotateX(Math.PI / 2).translate(0, 0.343, 0.19)],
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
 * Een winkel met alles erop en eraan. In `userData`: `bob` (wat zachtjes wiegt), `door` (de wc-deuren), `lid` (de
 * deksel van de afvalbak) en `seat` (het bankje); en bij een attractie of speeltoestel de losse stukken die
 * `poseRide` beweegt (zie RIDE_BUILD).
 */
function buildShop(kind: ShopKind, mat?: THREE.Material): THREE.Group {
  const group = build(SHOP_PARTS[kind], mat);
  const kids = [...group.children];
  group.userData.kind = kind;
  if (kind === 'bin') {
    kids[1].position.set(0, 0.42, -0.19);
    group.userData.lid = kids[1];
  }
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
  if (kind === 'cablecar') {
    group.userData.posts = kids.slice(CABLE_POSTS_AT, CABLE_POSTS_AT + CABLE_CORNERS.length);
    group.userData.sign = [kids[CABLE_SIGN_AT], group.userData.bob[0]];
  }
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
  } else if (kind === 'swinger') {
    // de kap schuift omhoog en draait; elk stoeltje zwaait om zijn ophangpunt naar buiten
    const crown = u.crown as THREE.Object3D, chairs = u.chairs as THREE.Object3D[];
    crown.position.y = swingerTop(s);
    crown.rotation.y = s.spin;
    for (let i = 0; i < chairs.length; i++) chairs[i].rotation.z = -swingerLean(i, s);
  } else if (kind === 'ship') (u.ship as THREE.Object3D).rotation.z = shipAngle(s);
  else if (kind === 'airballoon') {
    // de ballon stijgt aan het touw, drijft en draait een beetje, en wiegt zachtjes; de vlam flakkert als de brander aan staat
    const [bx, bh, bz, turn, burn] = balloonAt(s), balloon = u.balloon as THREE.Object3D, flame = u.flame as THREE.Object3D, rope = u.rope as THREE.Object3D;
    const high = Math.min(1, (bh - AIRBALLOON.floor) / 0.6);
    balloon.position.set(bx, bh, bz);
    balloon.rotation.set(Math.sin(s.clock * 0.9) * 0.025 * high, turn, Math.sin(s.clock * 0.7 + 1) * 0.03 * high);
    flame.visible = burn > 0.03;
    flame.scale.set(0.7 + burn * 0.5, burn * (0.85 + 0.25 * Math.sin(s.clock * 31)), 0.7 + burn * 0.5);
    // het touw: van de vlonder naar de bodem van de mand
    const rx = bx, ry = bh - (AIRBALLOON.floor - 0.02), rz = bz, len = Math.hypot(rx, ry, rz);
    rope.visible = len > 0.03;
    rope.scale.y = Math.max(0.001, len);
    if (len > 0.03) rope.quaternion.setFromUnitVectors(UP, TRACK_V.set(rx / len, ry / len, rz / len));
  } else if (kind === 'flume') {
    const logs = u.logs as THREE.Object3D[], t = lapTime('flume', s), far = trackDist(FLUME_TR, t);
    let splash = 0;
    for (let i = 0; i < logs.length; i++) {
      const p = trainCar(TRACK_SPOT, 'flume', i, s), moving = t > 0 ? Math.min(1, p.speed) : 0;
      // de stam dobbert en wiebelt een beetje in het water
      placeOnTrack(logs[i], p, Math.sin(s.clock * 3.1 + i * 2) * 0.012 * moving);
      logs[i].rotation.z += Math.sin(s.clock * 2.3 + i * 1.7) * 0.05 * moving;
      // onderaan de afdaling: hoe dichter bij het water, hoe hoger het spat
      const k = (far - i * FLUME.gap - FLUME_SPLASH + 0.25) / 1.5;
      if (t > 0 && k > 0 && k < 1) splash = Math.max(splash, Math.sin(Math.PI * k) ** 0.6);
    }
    const spray = u.spray as THREE.Object3D;
    spray.visible = splash > 0.02;
    spray.scale.set(0.6 + 0.5 * splash, Math.max(0.001, splash * 1.35), 0.6 + 0.5 * splash);
  } else if (kind === 'coaster') {
    const cars = u.cars as THREE.Object3D[];
    for (let i = 0; i < cars.length; i++) placeOnTrack(cars[i], trainCar(TRACK_SPOT, 'coaster', i, s));
  } else if (kind === 'fountain') {
    // het waterballet: elke straal groeit en krimpt vanuit zijn spuitmond, en trilt een beetje; met gasten erbij spuit het wat hoger
    // 's nachts (s.wake naar 0) zakken alle stralen in en staat het water stil
    const jets = u.jets as THREE.Object3D[], lively = (0.86 + 0.14 * s.amp) * (s.wake ?? 1);
    for (let i = 0; i < jets.length; i++) {
      jets[i].visible = lively > 0.02;
      const level = Math.max(0.001, fountainJet(i, s.clock) * lively * (1 + 0.035 * Math.sin(s.clock * 21 + i * 1.7)));
      if (i < FOUNTAIN.jets) jets[i].scale.setScalar(level);
      else jets[i].scale.set(0.8 + 0.3 * level, level, 0.8 + 0.3 * level);
    }
  } else if (kind === 'swing') {
    const seats = u.seats as THREE.Object3D[];
    for (let i = 0; i < seats.length; i++) seats[i].rotation.x = swingAngle(i, s);
  } else if (kind === 'seesaw') (u.plank as THREE.Object3D).rotation.z = seesawTilt(s);
  else if (kind === 'springer') {
    const [pitch, roll] = springerTilt(s);
    (u.rocker as THREE.Object3D).rotation.set(pitch, 0, roll);
  } else if (kind === 'trampoline') (u.cloth as THREE.Object3D).position.y = TRAMPOLINE.mat - trampolineDip(s);
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
/** Waar de taart staat (x, z) bij een toestel dat rechtsvoor zelf iets heeft staan: bij de glijbaan tussen de trap en de glijbaan in. */
const PARTY_CAKE: Partial<Record<ShopKind, [number, number]>> = { slide: [0.02, 0.45] };
function partyParts(wide: number, deep: number, cakeAt?: [number, number]): { white: THREE.BufferGeometry; colors: THREE.BufferGeometry; balloons: THREE.BufferGeometry; at: P3 } {
  const key = `${wide}x${deep}${cakeAt ? `@${cakeAt[0]},${cakeAt[1]}` : ''}`, made = partyGeos.get(key);
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
/**
 * De glazen tunnel ligt verzonken: `TUBE_DEEP` onder de grond, zodat het water van de bak erboven staat en de vissen
 * eroverheen zwemmen. Per tegel een vloer en een dak van glas in een wit raam; een wand aan elke kant waar de tunnel
 * niet doorloopt; en buiten de bak een trap naar beneden. Alles is gemaakt voor de kant +z en wordt gedraaid.
 */
export const TUBE_DEEP = 0.8;
const TUBE_FLOOR_GEO = mergeGeometries([
  ...[-0.375, -0.125, 0.125, 0.375].flatMap((x, i) => [-0.25, 0.25].map((z, j) => paint(boxAt(0.25, 0.04, 0.5, x, -TUBE_DEEP - 0.02, z), (i + j) % 2 ? 0xe6eef3 : 0xd2dfe8))),
])!;
const TUBE_ROOF_FRAME_GEO = mergeGeometries([
  paint(boxAt(1, 0.035, 0.05, 0, -0.03, -0.475), 0xf7fbff), paint(boxAt(1, 0.035, 0.05, 0, -0.03, 0.475), 0xf7fbff),
  paint(boxAt(0.05, 0.035, 0.9, -0.475, -0.03, 0), 0xf7fbff), paint(boxAt(0.05, 0.035, 0.9, 0.475, -0.03, 0), 0xf7fbff),
])!;
const TUBE_ROOF_GEO = boxAt(0.92, 0.015, 0.92, 0, -0.03, 0);
/** Een wand aan de kant +z: blauw als het water erachter, met een lichte band bovenlangs en een plint. */
const TUBE_WALL_GEO = mergeGeometries([
  paint(boxAt(1, TUBE_DEEP - 0.04, 0.04, 0, -TUBE_DEEP / 2 - 0.02, 0.48), 0xc9ecfa),
  paint(boxAt(1, 0.06, 0.05, 0, -0.07, 0.475), 0xf2fbff), paint(boxAt(1, 0.08, 0.06, 0, -TUBE_DEEP + 0.04, 0.47), 0x7fc0e0),
  // een paar visjes en een plantje op de wand, als sier
  paint(new THREE.ConeGeometry(0.035, 0.11, 4).rotateZ(Math.PI / 2).scale(1, 1, 0.3).translate(-0.22, -0.34, 0.455), 0xf08a24), paint(new THREE.ConeGeometry(0.03, 0.09, 4).rotateZ(-Math.PI / 2).scale(1, 1, 0.3).translate(0.2, -0.5, 0.455), 0xffd23f),
  paint(boxAt(0.02, 0.2, 0.012, 0.36, -TUBE_DEEP + 0.16, 0.455), 0x3d8b5a), paint(boxAt(0.02, 0.14, 0.012, 0.4, -TUBE_DEEP + 0.13, 0.455), 0x3d8b5a),
])!;
const STAIR_STEPS = 6;
/** De trap naar beneden, dalend naar +z: treden, een bodem, twee zijwanden en de wand onder het begin van de trap. */
const TUBE_STAIR_GEO = mergeGeometries([
  ...Array.from({ length: STAIR_STEPS }, (_, i) => {
    const top = -(TUBE_DEEP * (i + 1)) / (STAIR_STEPS + 1), z0 = -0.42 + (i * 0.84) / STAIR_STEPS, deep = 0.84 / STAIR_STEPS;
    return paint(boxAt(0.9, TUBE_DEEP + top, deep + 0.004, 0, (top - TUBE_DEEP) / 2, z0 + deep / 2), i % 2 ? 0xd9cdb6 : 0xcbbd9f);
  }),
  paint(boxAt(0.9, 0.04, 0.1, 0, -TUBE_DEEP - 0.02, 0.46), 0xd2dfe8), paint(boxAt(0.9, TUBE_DEEP, 0.08, 0, -TUBE_DEEP / 2, -0.46), 0xcbbd9f),
  paint(boxAt(0.05, TUBE_DEEP, 1, -0.475, -TUBE_DEEP / 2, 0), 0xb9a98a), paint(boxAt(0.05, TUBE_DEEP, 1, 0.475, -TUBE_DEEP / 2, 0), 0xb9a98a),
  // een leuning aan weerskanten, schuin mee naar beneden
  paint(beam(0.03, [-0.42, 0.3, -0.45], [-0.42, 0.3 - TUBE_DEEP, 0.45]), 0xf7fbff), paint(beam(0.03, [0.42, 0.3, -0.45], [0.42, 0.3 - TUBE_DEEP, 0.45]), 0xf7fbff),
  paint(boxAt(0.035, 0.32, 0.035, -0.42, 0.14, -0.45), 0xf7fbff), paint(boxAt(0.035, 0.32, 0.035, 0.42, 0.14, -0.45), 0xf7fbff),
].map(g => (g.index ? g.toNonIndexed() : g)))!;
const TUBE_GLASS_MAT = new THREE.MeshStandardMaterial({ color: 0xcdeffc, roughness: 0.1, transparent: true, opacity: 0.16, depthWrite: false });
/** De tunnel is van binnen verlicht: ook onder water en 's nachts zie je de gasten goed. */
const TUBE_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, emissive: 0xffffff, emissiveIntensity: 0.22 });
const TANK_OVER_MAT = new THREE.MeshStandardMaterial({ color: 0xbfe6f7, roughness: 0.2, transparent: true, opacity: 0.2, depthWrite: false });
/** Hoe ver een stuk voor de kant +z gedraaid moet worden om bij richting 0 (noord), 1 (oost), 2 (zuid) of 3 (west) te horen. */
const TUBE_TURN = [Math.PI, Math.PI / 2, 0, -Math.PI / 2];
const TUBE_DIRS: [number, number][] = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const FLOWER_EDGE_GEO = boxAt(1, 0.03, 0.11, 0, 0.015, 0);
/** Zo ver staat elke helft van een dubbel hek (tussen twee verblijven met een ander soort hek) uit het midden. */
const DOUBLE_FENCE = 0.085;
/** Vuurwerk: hooguit zoveel vonken tegelijk, en zoveel getallen per vonk (zie View.fireData). */
const FIRE_MAX = 1600, FIRE_STRIDE = 14;
const FIRE_COLORS = [0xff5a4f, 0xffd23f, 0x5fd0ff, 0x7dff8a, 0xff8ad1, 0xffa23f, 0xc79bff, 0xffffff];
const FIRE_COLOR = new THREE.Color();
/** Een zacht rond lichtpuntje, zodat een vonk geen vierkantje is. */
const fireDot = (): THREE.Texture => {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const ctx = c.getContext('2d')!, g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.85)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
};
const FIRE_MAT = new THREE.PointsMaterial({ size: 6, map: typeof document === 'undefined' ? null : fireDot(), vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, sizeAttenuation: false, toneMapped: false, fog: false });
const FLOWER_HEAD_GEO = blob(0.046, 1, 0.75, 1, 0, 0.06, 0, 0);
const FLOWER_EDGE_MAT = std(0x6fb44c, 1);

// ------------------------------------------------------------ het spoor
// Elk stuk spoor is voor één tegel gemaakt, met het midden van de tegel op (0, 0): een bedding van grind (RAIL_BED
// breed en BED_TOP hoog: een plat vlak vlak boven de grond flikkert weg), houten bielzen en twee rails. De bovenkant
// van de rails ligt op TRAIN.top; de rails liggen RAIL_GAUGE uit het midden. Welke stukken er op een tegel komen en
// hoe ze gedraaid zijn, staat in rails.ts (railPieces).
const RAIL_GAUGE = 0.17, RAIL_BED = 0.6, BED_TOP = 0.03, RAIL_HIGH = 0.03;
/** De kleuren van het grind, de bielzen en het staal van de rails. */
const BALLAST = 0xb3a892, SLEEPER = 0x7a5a3a, STEEL = 0x8f959e;
/** De bedding: een lage plaat grind, `w` breed en `d` diep, met zijn midden op (x, z). */
const bedding = (w: number, d: number, x = 0, z = 0): THREE.BufferGeometry => boxAt(w, BED_TOP, d, x, BED_TOP / 2, z);
/** Een biels dwars onder de rails, op z. */
const sleeper = (z: number): THREE.BufferGeometry => boxAt(0.5, 0.028, 0.1, 0, BED_TOP + 0.014, z);
/** Twee rails langs z, `len` lang, met hun midden op z; `high`: hoe hoog de rail zelf is. */
const railPair = (len: number, z = 0, high = RAIL_HIGH): THREE.BufferGeometry[] => [-RAIL_GAUGE, RAIL_GAUGE].map(x => boxAt(0.035, high, len, x, TRAIN.top - high / 2, z));
/** Een stootblok dwars over het spoor op z: twee paaltjes met een rood-witte balk. */
const bufferStop = (z: number): [number, ...THREE.BufferGeometry[]][] => [
  [SLEEPER, boxAt(0.06, 0.2, 0.06, -RAIL_GAUGE, BED_TOP + 0.1, z), boxAt(0.06, 0.2, 0.06, RAIL_GAUGE, BED_TOP + 0.1, z)],
  [0xe0584f, boxAt(0.5, 0.09, 0.05, 0, BED_TOP + 0.17, z)],
  [0xf7f4ec, boxAt(0.14, 0.094, 0.054, 0, BED_TOP + 0.17, z)],
];
// recht: van noord naar zuid
const RAIL_STRAIGHT_GEO = painted(
  [BALLAST, bedding(RAIL_BED, 1)],
  [SLEEPER, ...[-0.375, -0.125, 0.125, 0.375].map(sleeper)],
  [STEEL, ...railPair(1)],
);
// een bocht van noord naar oost: een kwart cirkel om de hoek rechtsboven, in korte rechte stukjes
const RAIL_CURVE_GEO = (() => {
  const cx = 0.5, cz = -0.5, n = 7, steel: THREE.BufferGeometry[] = [];
  const on = (r: number, a: number): [number, number] => [cx + r * Math.cos(a), cz + r * Math.sin(a)];
  for (const r of [0.5 - RAIL_GAUGE, 0.5 + RAIL_GAUGE])
    for (let i = 0; i < n; i++) {
      const [x0, z0] = on(r, Math.PI - (i / n) * (Math.PI / 2)), [x1, z1] = on(r, Math.PI - ((i + 1) / n) * (Math.PI / 2));
      steel.push(new THREE.BoxGeometry(0.035, RAIL_HIGH, Math.hypot(x1 - x0, z1 - z0) + 0.006).rotateY(Math.atan2(x1 - x0, z1 - z0)).translate((x0 + x1) / 2, TRAIN.top - RAIL_HIGH / 2, (z0 + z1) / 2));
    }
  const ties = [1, 3, 5].map(k => {
    const a = Math.PI - (k / 6) * (Math.PI / 2), [x, z] = on(0.5, a);
    return new THREE.BoxGeometry(0.5, 0.028, 0.1).rotateY(-a).translate(x, BED_TOP + 0.014, z);
  });
  // de bedding: een kwart ring met dikte (de vorm ligt plat getekend en wordt dan overeind gezet)
  const bed = new THREE.Shape();
  bed.absarc(cx, -cz, 0.5 + RAIL_BED / 2, Math.PI, 1.5 * Math.PI, false);
  bed.absarc(cx, -cz, 0.5 - RAIL_BED / 2, 1.5 * Math.PI, Math.PI, true);
  return painted(
    [BALLAST, new THREE.ExtrudeGeometry(bed, { depth: BED_TOP, bevelEnabled: false, curveSegments: 8 }).rotateX(-Math.PI / 2)],
    [SLEEPER, ...ties],
    [STEEL, ...steel],
  );
})();
// een eindje: het spoor komt van het noorden en houdt voorbij het midden op bij een stootblok
const RAIL_END_GEO = painted(
  [BALLAST, bedding(RAIL_BED, 0.84, 0, -0.08)],
  [SLEEPER, ...[-0.375, -0.125, 0.125].map(sleeper)],
  [STEEL, ...railPair(0.75, -0.125)],
  ...bufferStop(0.27),
);
// een los stukje (het ligt nog nergens aan vast): kort, van west naar oost, met aan beide kanten een stootblok
const RAIL_STUB_GEO = painted(
  [BALLAST, bedding(RAIL_BED, 0.7)],
  [SLEEPER, sleeper(-0.125), sleeper(0.125)],
  [STEEL, ...railPair(0.52)],
  ...bufferStop(0.27),
  ...bufferStop(-0.27),
).rotateY(Math.PI / 2);
// op een overweg: geen grind, maar planken tussen en naast de rails, zodat je er zo overheen loopt
const RAIL_XING_GEO = painted(
  [0xa98558, boxAt(0.145, 0.036, 1, -0.076, 0.022, 0), boxAt(0.14, 0.036, 1, 0.262, 0.022, 0)],
  [0x97744a, boxAt(0.145, 0.036, 1, 0.076, 0.022, 0), boxAt(0.14, 0.036, 1, -0.262, 0.022, 0)],
  [STEEL, ...railPair(1, 0, TRAIN.top - 0.02)],
);
/**
 * De spoorboom aan de noordkant van een overweg (waar het pad de tegel op komt), gezien vanuit het midden van de
 * tegel: een paal rechts van wie aan komt lopen, met een andreaskruis en een kastje voor twee rode lampen. De boom
 * zelf en de lampen zijn los: die bewegen (zie View.stepCrossings).
 */
const GATE_POST: P3 = [-0.4, 0, -0.44];
/** Waar de boom om draait, en waar de twee lampen zitten (zo hoog, en zo ver links en rechts van de paal). */
const GATE_PIVOT: P3 = [GATE_POST[0], 0.3, GATE_POST[2] + 0.055];
const GATE_LAMP_Y = 0.52, GATE_LAMP_X = 0.065;
/** Een balk van het andreaskruis: wit met rode punten, zo schuin (`tilt`). */
const crossBar = (tilt: number): [number, ...THREE.BufferGeometry[]][] => {
  const put = (g: THREE.BufferGeometry): THREE.BufferGeometry => g.rotateZ(tilt).translate(GATE_POST[0], 0.74, GATE_POST[2]);
  return [
    [0xf7f4ec, put(boxAt(0.3, 0.06, 0.022, 0, 0, 0))],
    [0xe0584f, put(boxAt(0.07, 0.062, 0.024, -0.165, 0, 0)), put(boxAt(0.07, 0.062, 0.024, 0.165, 0, 0))],
  ];
};
const GATE_POST_GEO = painted(
  [0xf7f4ec, boxAt(0.055, 0.6, 0.055, GATE_POST[0], 0.3, GATE_POST[2])],
  [0xe0584f, boxAt(0.059, 0.1, 0.059, GATE_POST[0], 0.13, GATE_POST[2])],
  [0x5a6470, boxAt(0.13, 0.04, 0.13, GATE_POST[0], 0.02, GATE_POST[2]), boxAt(0.07, 0.09, 0.09, GATE_PIVOT[0], GATE_PIVOT[1], GATE_PIVOT[2] - 0.02)],
  [0x2b2f36, boxAt(0.24, 0.1, 0.03, GATE_POST[0], GATE_LAMP_Y, GATE_POST[2])],
  ...crossBar(Math.PI / 4),
  ...crossBar(-Math.PI / 4),
);
/** De boom: het draaipunt is (0, 0, 0), hij steekt naar +x uit over het pad, in rode en witte stukken; achter het draaipunt zit een gewicht. */
const GATE_ARM_GEO = painted(
  [0xe0584f, ...[0, 2, 4].map(i => boxAt(0.165, 0.045, 0.03, 0.0825 + i * 0.165, 0, 0))],
  [0xf7f4ec, ...[1, 3].map(i => boxAt(0.165, 0.045, 0.03, 0.0825 + i * 0.165, 0, 0))],
  [0x5a6470, boxAt(0.13, 0.08, 0.045, -0.085, 0, 0)],
);
/** Een lamp van de overweg: een bolletje. */
const GATE_LAMP_GEO = new THREE.IcosahedronGeometry(0.036, 1);
/** De lampen van een overweg krijgen hun kleur per lamp: fel rood als hij aan is, donkerrood als hij uit is. */
const GATE_LAMP_MAT = new THREE.MeshBasicMaterial({ color: 0xffffff });
const GATE_LAMP_ON = new THREE.Color(0xff3b2f), GATE_LAMP_OFF = new THREE.Color(0x5a1512);
/** Zo ver staat een open spoorboom omhoog (in radialen), en zo lang doet hij erover om te zakken of omhoog te gaan. */
const GATE_OPEN = 1.36, GATE_SECONDS = 0.9;
/** De stoomwolkjes van alle treinen samen: zoveel tegelijk, en zo lang blijft er een hangen. */
const STEAM_MAX = 24, STEAM_SECONDS = 1.3;
const STEAM_GEO = new THREE.IcosahedronGeometry(1, 1);
const STEAM_MAT = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, emissive: 0x9aa3ad, emissiveIntensity: 0.25 });

// Het treintje (zie View.makeTrain). Elke wagen heeft zijn midden op de rails en zijn neus naar +z. De wielen zijn
// een los onderdeel (één per trein, voor alle assen samen), zodat ze kunnen draaien.
/** De kleuren van de locomotief (ketel en cabine) en van de wagons; elke trein heeft zijn eigen kleuren. */
const TRAIN_LOOKS: { boiler: number; cab: number; wagons: number[] }[] = [
  { boiler: 0x6cc04a, cab: 0xe0584f, wagons: [0x4a90e2, 0xffd23f, 0x6cc04a] },
  { boiler: 0x4a90e2, cab: 0xf08a24, wagons: [0xe0584f, 0x6cc04a, 0xffd23f] },
  { boiler: 0xa06ad9, cab: 0x2bb5a8, wagons: [0xf06aa6, 0x4a90e2, 0xf08a24] },
];
/** Het donkere onderstel, de schoorsteen en de koppelingen. */
const TRAIN_DARK = 0x3d4f5a;
/** Waar de assen onder een locomotief en een wagon zitten (z), hoe groot hun wielen zijn, en waar de schoorsteen uitkomt. */
const LOCO_AXLES = [0.22, -0.24], WAGON_AXLES = [0.25, -0.25], LOCO_WHEEL = 0.09, WAGON_WHEEL = 0.082;
const CHIMNEY: P3 = [0, 0.72, 0.27];
/** Een vorm van de trein wordt één keer gemaakt en door alle treinen met die kleuren gedeeld. */
const trainGeos = new Map<string, THREE.BufferGeometry>();
const trainGeo = (key: string, make: () => THREE.BufferGeometry): THREE.BufferGeometry => {
  let geo = trainGeos.get(key);
  if (!geo) trainGeos.set(key, (geo = make()));
  return geo;
};
/** De locomotief: een onderstel met bufferbalken, een ketel met een gele band en een koepel, een schoorsteen en een cabine met ramen en een geel dak. */
const locoGeo = (boiler: number, cab: number): THREE.BufferGeometry => trainGeo(`loco${boiler}.${cab}`, () => painted(
  [TRAIN_DARK, boxAt(0.4, 0.06, 0.82, 0, 0.15, 0), boxAt(0.05, 0.04, 0.14, 0, 0.14, -0.46), tube(0.045, 0.04, 0.17, CHIMNEY[0], 0.565, CHIMNEY[2]), tube(0.078, 0.045, 0.05, CHIMNEY[0], 0.675, CHIMNEY[2])],
  [0xe0584f, boxAt(0.4, 0.07, 0.04, 0, 0.15, 0.42), boxAt(0.4, 0.07, 0.04, 0, 0.15, -0.42)],
  [boiler, new THREE.CylinderGeometry(0.15, 0.15, 0.5, 12).rotateX(Math.PI / 2).translate(0, 0.33, 0.14), boxAt(0.28, 0.1, 0.5, 0, 0.22, 0.14)],
  [cab, boxAt(0.38, 0.4, 0.3, 0, 0.38, -0.25)],
  [0xffd23f, boxAt(0.44, 0.04, 0.38, 0, 0.6, -0.25), tube(0.05, 0.06, 0.07, 0, 0.5, 0.04), new THREE.CylinderGeometry(0.156, 0.156, 0.04, 12).rotateX(Math.PI / 2).translate(0, 0.33, 0.37)],
  [0x9fd8f5, boxAt(0.386, 0.13, 0.16, 0, 0.45, -0.25), boxAt(0.2, 0.13, 0.306, 0, 0.45, -0.25)],
));
/** De koplamp voor op de ketel: die geeft licht (LAMP_MAT). */
const LOCO_LAMP_GEO = ball(0.05, 0, 0.33, 0.405);
/** Een open wagon in een vrolijke kleur, met een lichte rand, TRAIN.seats houten bankjes achter elkaar en een koppeling voor en achter. */
const wagonGeo = (color: number): THREE.BufferGeometry => trainGeo(`wagon${color}`, () => painted(
  [color, boxAt(0.42, 0.06, 0.8, 0, 0.15, 0), boxAt(0.03, 0.11, 0.8, -0.195, 0.235, 0), boxAt(0.03, 0.11, 0.8, 0.195, 0.235, 0), boxAt(0.42, 0.11, 0.03, 0, 0.235, -0.385), boxAt(0.42, 0.11, 0.03, 0, 0.235, 0.385)],
  [0xf7f4ec, boxAt(0.04, 0.02, 0.82, -0.195, 0.3, 0), boxAt(0.04, 0.02, 0.82, 0.195, 0.3, 0), boxAt(0.43, 0.02, 0.04, 0, 0.3, -0.39), boxAt(0.43, 0.02, 0.04, 0, 0.3, 0.39)],
  [0xc58a4b, ...Array.from({ length: TRAIN.seats }, (_, i) => boxAt(0.32, 0.04, 0.13, 0, 0.2, (i - (TRAIN.seats - 1) / 2) * 0.26))],
  [TRAIN_DARK, boxAt(0.05, 0.04, 0.16, 0, 0.14, 0.46), boxAt(0.05, 0.04, 0.16, 0, 0.14, -0.46)],
));
/** Eén as: twee rode wielen op de rails, met een geel kruis erop zodat je ze ziet draaien. Het midden van de as is (0, 0, 0). */
const AXLE_GEO = painted(
  [0xe0584f, ...[-RAIL_GAUGE, RAIL_GAUGE].map(x => new THREE.CylinderGeometry(LOCO_WHEEL, LOCO_WHEEL, 0.045, 12).rotateZ(Math.PI / 2).translate(x, 0, 0))],
  [0xffd23f, ...[-1, 1].flatMap(s => [boxAt(0.012, LOCO_WHEEL * 1.7, 0.03, s * (RAIL_GAUGE + 0.026), 0, 0), boxAt(0.012, 0.03, LOCO_WHEEL * 1.7, s * (RAIL_GAUGE + 0.026), 0, 0)])],
  [TRAIN_DARK, boxAt(2 * RAIL_GAUGE, 0.025, 0.025, 0, 0, 0)],
);
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
  /** Het water boven de verzonken tunnel: helderder dan de rest van de bak. */
  private tankOver: THREE.InstancedMesh | null = null;
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
  private ghostBucketMesh = new THREE.Mesh(BUCKET_GEO, this.ghostMat);
  private ghostWallMesh = new THREE.Mesh(WALL_GEO, this.ghostMat);
  private ghostNetMesh = new THREE.Mesh(NET_GEO, this.ghostMat);
  private ghostGlassMesh = new THREE.Mesh(GLASS_FRAME_GEO, this.ghostMat);
  private ghostWindowMesh = new THREE.Mesh(WINDOW_GEO, this.ghostMat);
  private ghostPicketMesh = new THREE.Mesh(PICKET_GEO, this.ghostMat);
  private ghostPetgateMesh = new THREE.Mesh(PETGATE_GEO, this.ghostMat);
  private ghostSafariGateMesh = new THREE.Mesh(SAFARIGATE_GHOST_GEO, this.ghostMat);
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
  /** Een tussenpaal van de kabelbaan die je gaat neerzetten of weghalen (zie ghostPylon). */
  private ghostPylonMesh = new THREE.Mesh(mastGhostGeo(), this.ghostMat);
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
  /** Bij het ontsnappen: stofwolkjes, veertjes en hekken die even meebewegen (zie dust, feathers, wobbleFence). */
  private puffs: { mesh: THREE.Mesh; vx: number; vy: number; vz: number; t: number; life: number; size: number }[] = [];
  private puffMats = new Map<number, THREE.Material>();
  private plumes: { mesh: THREE.Mesh; vx: number; vy: number; vz: number; t: number; phase: number; spin: number }[] = [];
  private plumeMats = new Map<number, THREE.Material>();
  private wobbles: { obj: THREE.Object3D; kind: FenceWobble; tip: number; amount: number; t: number }[] = [];
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
  // het spoor en de overwegen (zie paintRails): alleen opnieuw gebouwd als het spoor verandert
  private railKey = '';
  private railMeshes: THREE.InstancedMesh[] = [];
  /**
   * De spoorbomen: bij welke tegel en aan welke kant (`code`: tegel * 4 + kant), waar het draaipunt staat, hoe ver de
   * boom dicht is (`k`, 0 tot 1) en welke van de twee lampen brandt (`lit`: 0 = geen).
   */
  private gates: { tile: number; code: number; base: THREE.Matrix4; k: number; lit: number }[] = [];
  private gateArms: THREE.InstancedMesh | null = null;
  private gateLamps: THREE.InstancedMesh | null = null;
  /** Van het spel: welk soort pad er onder elke overweg ligt (tegel -> het nummer in TERRAINS). */
  crossLooks: Map<number, number> | null = null;
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
  /** De stoomwolkjes van de treinen: één onderdeel voor allemaal. Per wolkje: x, y, z en hoe oud het is (in tellen). */
  private steam: THREE.InstancedMesh | null = null;
  private steamAt = new Float32Array(STEAM_MAX * 4).fill(STEAM_SECONDS);
  private steamNext = 0;
  private steamLive = false;
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
    // (als allereerste getekend en zonder diepte: zo zie je wat onder de grond ligt, de verzonken tunnel, er gewoon doorheen)
    outer.renderOrder = -10;
    this.outerMat.depthWrite = false;
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
    this.ghosts = [this.ghostFenceMesh, this.ghostGateMesh, this.ghostWallMesh, this.ghostNetMesh, this.ghostGlassMesh, this.ghostWindowMesh, this.ghostPicketMesh, this.ghostPetgateMesh, this.ghostSafariGateMesh, this.ghostTroughMesh, this.ghostBucketMesh, ...Object.values(this.ghostBeds), ...Object.values(this.ghostToys), ...Object.values(this.ghostDecors), ...Object.values(this.ghostProps), ...Object.values(this.ghostShops), this.ghostTileMesh, this.ghostRing, this.ghostCableMesh];
    this.ghosts.push(this.ghostPylonMesh);
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
    // (tijdens het vuurwerk wordt het even avond, ook midden op de dag: zo knallen de kleuren eruit)
    const dark = Math.max(this.dark, this.fireDark), wet = this.wet;
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

  /** Een knikje van het hoofd van de loper, boven op waar hij naar kijkt (radialen; min is omlaag): bij het eten en kauwen (zie walkhand.ts). */
  eyeNod = 0;

  /** Waar de loper is en waar hij naar kijkt (rastercoördinaten, hoogte in tegels, richting in radialen). */
  setEye(gx: number, gy: number, h: number, yaw: number, pitch: number): void {
    // (in de glazen tunnel loop je lager: dan kijk je onder water door het glas omhoog)
    Object.assign(this.eyeAt, { gx, gy, h: h - this.sink(gx, gy), yaw, pitch });
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
    const { gx, gy, h, yaw } = this.eyeAt, pitch = this.eyeAt.pitch + this.eyeNod;
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
   * `white`: het is het witte hekje.
   */
  topple(e: Edge, out: 1 | -1, white = false): void {
    const mat = ((white ? WHITE_MAT : WORN_MATS[0]) as THREE.MeshStandardMaterial).clone();
    mat.transparent = true;
    const plank = new THREE.Mesh(FALL_GEO, mat);
    plank.castShadow = true;
    const obj = new THREE.Group().add(plank);
    this.placeEdge(obj, e);
    this.scene.add(obj);
    // bij een staand hek ('v') wijst de eigen z-as de andere kant op
    this.falls.push({ obj, plank, mat, tip: e.o === 'h' ? out : -out, t: 0 });
  }

  // ------------------------------------------------------------ vuurwerk
  /** De vonken van het vuurwerk: één wolk van lichtpuntjes, die samen in één keer getekend worden. */
  private fire: THREE.Points | null = null;
  private fireN = 0;
  /** Per vonk: plek (3), vaart (3), hoe lang hij nog leeft, hoe lang hij in totaal leeft, kleur (3), remmen, vallen en flikkeren. */
  private fireData = new Float32Array(FIRE_MAX * FIRE_STRIDE);
  private fireRockets: { x: number; y: number; z: number; vx: number; vy: number; vz: number; top: number; color: number; kind: number }[] = [];
  private fireLeft = 0;
  private fireNext = 0;
  private fireDark = 0;
  private fireLit = 0;
  /** Het spel hoort hier wat er gebeurt (een pijl gaat de lucht in, een knal), voor het geluid. */
  onFirework: ((what: 'launch' | 'bang', gx: number, gy: number, big: boolean) => void) | null = null;

  /** Is er nu vuurwerk (of dooft het nog uit)? */
  get fireworksOn(): boolean {
    return this.fireLeft > 0 || this.fireN > 0 || this.fireRockets.length > 0;
  }

  /**
   * Een vuurwerkshow van `seconds` tellen boven het midden van het beeld: pijlen stijgen op met een gouden staart en
   * spatten uit elkaar in bollen, ringen, treurwilgen en dubbele bollen. Het wordt er even avond bij. Aan het eind
   * komt een slotakkoord van een paar pijlen tegelijk.
   */
  fireworks(seconds: number): void {
    if (!this.fire) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(FIRE_MAX * 3), 3));
      geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(FIRE_MAX * 3), 3));
      this.fire = new THREE.Points(geo, FIRE_MAT);
      this.fire.frustumCulled = false;
      this.fire.renderOrder = 20;
      this.scene.add(this.fire);
    }
    FIRE_MAT.size = 10.5 * this.renderer.getPixelRatio();
    this.fireLeft = Math.max(this.fireLeft, seconds);
    this.fireNext = Math.min(this.fireNext, 0.4);
  }

  private fireSpark(x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, color: number, drag: number, fall: number, flicker = 0): void {
    if (this.fireN >= FIRE_MAX) return;
    const d = this.fireData, k = this.fireN++ * FIRE_STRIDE;
    FIRE_COLOR.setHex(color);
    d[k] = x; d[k + 1] = y; d[k + 2] = z;
    d[k + 3] = vx; d[k + 4] = vy; d[k + 5] = vz;
    d[k + 6] = d[k + 7] = life;
    d[k + 8] = FIRE_COLOR.r; d[k + 9] = FIRE_COLOR.g; d[k + 10] = FIRE_COLOR.b;
    d[k + 11] = drag; d[k + 12] = fall; d[k + 13] = flicker;
  }

  /** Een pijl spat uit elkaar: 0 = een bol, 1 = een ring, 2 = een treurwilg, 3 = een bol in een bol. */
  private fireBurst(x: number, y: number, z: number, color: number, kind: number): void {
    const other = FIRE_COLORS[(FIRE_COLORS.indexOf(color) + 2 + Math.floor(Math.random() * 3)) % FIRE_COLORS.length];
    const n = kind === 1 ? 56 : kind === 2 ? 80 : 110, tilt = Math.random() * 1.2 - 0.6, turn = Math.random() * Math.PI;
    for (let i = 0; i < n; i++) {
      let dx: number, dy: number, dz: number;
      if (kind === 1) {
        // een ring, een beetje gekanteld
        const a = (i / n) * Math.PI * 2, rx = Math.cos(a), rz = Math.sin(a);
        dx = rx * Math.cos(turn) - rz * Math.sin(turn) * Math.cos(tilt);
        dz = rx * Math.sin(turn) + rz * Math.cos(turn) * Math.cos(tilt);
        dy = rz * Math.sin(tilt) + 0.15;
      } else {
        // gelijk verdeeld over een bol
        const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, r = Math.sqrt(1 - u * u);
        dx = r * Math.cos(a); dy = u; dz = r * Math.sin(a);
      }
      const inner = kind === 3 && i % 3 === 0, speed = (kind === 2 ? 2.9 : inner ? 1.9 : 4.1) * (0.88 + Math.random() * 0.24);
      this.fireSpark(x, y, z, dx * speed, dy * speed + (kind === 2 ? 0.8 : 0), dz * speed, (kind === 2 ? 2.7 : 1.7) * (0.8 + Math.random() * 0.4),
        kind === 2 ? 0xffd27a : inner ? other : color, kind === 2 ? 0.9 : 1.7, kind === 2 ? 2.1 : 1.1, kind === 2 || i % 5 === 0 ? 1 : 0);
    }
    // een witte flits in het midden
    for (let i = 0; i < 14; i++) this.fireSpark(x, y, z, (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.6, 0.28, 0xffffff, 1, 0);
    this.fireLit = 1;
    this.onFirework?.('bang', x + W / 2, z + H / 2, kind === 3);
  }

  private fireLaunch(): void {
    const cx = this.walkK > 0.5 ? toWorldX(this.eyeAt.gx) : this.target.x, cz = this.walkK > 0.5 ? toWorldZ(this.eyeAt.gy) : this.target.z;
    const x = cx + (Math.random() - 0.5) * this.zoom * 1.1, z = cz + (Math.random() - 0.5) * this.zoom * 0.9 + 1;
    this.fireRockets.push({ x, y: 0.2, z, vx: (Math.random() - 0.5) * 0.7, vy: 8.4 + Math.random() * 1.8, vz: (Math.random() - 0.5) * 0.7, top: 4.6 + Math.random() * 3,
      color: FIRE_COLORS[Math.floor(Math.random() * FIRE_COLORS.length)], kind: Math.floor(Math.random() * 4) });
    this.onFirework?.('launch', x + W / 2, z + H / 2, false);
  }

  private stepFireworks(dt: number): void {
    // het wordt donker zolang de show duurt, en daarna weer licht
    const want = this.fireLeft > 0 || this.fireRockets.length ? 0.94 : 0;
    if (this.fireDark !== want) {
      const next = Math.abs(want - this.fireDark) < 0.02 ? want : this.fireDark + (want - this.fireDark) * Math.min(1, dt * 1.6);
      if (Math.abs(next - this.fireShown) > 0.03 || next === want) {
        this.fireShown = next;
        this.fireDark = next;
        this.relight();
      } else this.fireDark = next;
    }
    if (!this.fire) return;
    if (this.fireLeft > 0) {
      const before = this.fireLeft;
      this.fireLeft -= dt;
      this.fireNext -= dt;
      if (this.fireNext <= 0) {
        this.fireNext = 0.35 + Math.random() * 0.75;
        this.fireLaunch();
        if (Math.random() < 0.3) this.fireLaunch();
      }
      // het slot: vijf pijlen vlak na elkaar
      if (before > 1.6 && this.fireLeft <= 1.6) for (let i = 0; i < 5; i++) this.fireLaunch();
    }
    for (const r of this.fireRockets) {
      r.vy -= 4.2 * dt;
      r.x += r.vx * dt; r.y += r.vy * dt; r.z += r.vz * dt;
      // de gouden staart
      if (Math.random() < dt * 60) this.fireSpark(r.x, r.y, r.z, (Math.random() - 0.5) * 0.3, -0.6, (Math.random() - 0.5) * 0.3, 0.35 + Math.random() * 0.2, 0xffc46b, 2, 1.5);
      if (r.y >= r.top || r.vy < 0.8) {
        this.fireBurst(r.x, r.y, r.z, r.color, r.kind);
        r.top = -1;
      }
    }
    if (this.fireRockets.some(r => r.top < 0)) this.fireRockets = this.fireRockets.filter(r => r.top >= 0);
    const d = this.fireData, pos = this.fire.geometry.getAttribute('position') as THREE.BufferAttribute, col = this.fire.geometry.getAttribute('color') as THREE.BufferAttribute;
    let n = 0;
    for (let i = 0; i < this.fireN; i++) {
      const k = i * FIRE_STRIDE;
      d[k + 6] -= dt;
      if (d[k + 6] <= 0) continue;
      const slow = Math.exp(-d[k + 11] * dt);
      d[k + 3] *= slow; d[k + 4] = d[k + 4] * slow - d[k + 12] * dt; d[k + 5] *= slow;
      d[k] += d[k + 3] * dt; d[k + 1] += d[k + 4] * dt; d[k + 2] += d[k + 5] * dt;
      // (levende vonken schuiven naar voren in het lijstje: zo blijft het vol met alleen wat er nog is)
      if (n !== i) d.copyWithin(n * FIRE_STRIDE, k, k + FIRE_STRIDE);
      const o = n * FIRE_STRIDE, left = d[o + 6] / d[o + 7], glow = Math.pow(left, 0.6) * (d[o + 13] ? 0.55 + 0.45 * Math.sin(d[o + 6] * 38 + i) : 1);
      pos.setXYZ(n, d[o], d[o + 1], d[o + 2]);
      col.setXYZ(n, d[o + 8] * glow, d[o + 9] * glow, d[o + 10] * glow);
      n++;
    }
    this.fireN = n;
    this.fire.geometry.setDrawRange(0, n);
    pos.needsUpdate = col.needsUpdate = true;
    this.fire.visible = n > 0;
    this.fireLit = Math.max(0, this.fireLit - dt * 3);
  }
  private fireShown = 0;

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
   * Een stofwolkje op de grond (een dier zet af, landt of rent ergens tegenaan): een paar bolletjes die opzij
   * wegrollen, groter worden en weer wegkrimpen. `size`: hoe groot (een olifant maakt meer stof dan een konijn).
   * `color`: op sneeuw en ijs stuift het wit.
   */
  dust(gx: number, gy: number, n = 5, size = 1, color = 0xd9c9a8): void {
    if (this.puffs.length > 60) return;
    let mat = this.puffMats.get(color);
    if (!mat) {
      mat = new THREE.MeshStandardMaterial({ color, roughness: 1, flatShading: true, transparent: true, opacity: 0.8, depthWrite: false });
      this.puffMats.set(color, mat);
    }
    for (let i = 0; i < n; i++) {
      const mesh = new THREE.Mesh(PUFF_GEO, mat), a = (i / n) * Math.PI * 2 + Math.random() * 0.8, v = (0.35 + Math.random() * 0.4) * size;
      mesh.position.set(toWorldX(gx) + Math.sin(a) * 0.06, 0.04 + Math.random() * 0.04, toWorldZ(gy) + Math.cos(a) * 0.06);
      mesh.rotation.set(Math.random() * 3, Math.random() * 3, 0);
      mesh.scale.setScalar(0.001);
      mesh.renderOrder = 4;
      this.scene.add(mesh);
      this.puffs.push({ mesh, vx: Math.sin(a) * v, vy: 0.12 + Math.random() * 0.12, vz: Math.cos(a) * v, t: 0, life: 0.65 + Math.random() * 0.3, size: (0.05 + Math.random() * 0.03) * (0.6 + size * 0.6) });
    }
  }

  /** Een paar veertjes die van een vogel afwaaien en zacht heen en weer dwarrelend naar de grond zweven. */
  feathers(gx: number, gy: number, height: number, color: number, n = 3): void {
    if (this.plumes.length > 40) return;
    let mat = this.plumeMats.get(color);
    if (!mat) {
      mat = new THREE.MeshStandardMaterial({ color, roughness: 0.9, side: THREE.DoubleSide });
      this.plumeMats.set(color, mat);
    }
    for (let i = 0; i < n; i++) {
      const mesh = new THREE.Mesh(PLUME_GEO, mat);
      mesh.position.set(toWorldX(gx) + (Math.random() - 0.5) * 0.2, height, toWorldZ(gy) + (Math.random() - 0.5) * 0.2);
      mesh.castShadow = true;
      this.scene.add(mesh);
      this.plumes.push({ mesh, vx: (Math.random() - 0.5) * 0.5, vy: 0.3 + Math.random() * 0.4, vz: (Math.random() - 0.5) * 0.5, t: 0, phase: Math.random() * 6, spin: (Math.random() - 0.5) * 6 });
    }
  }

  /**
   * Het hek op deze rand beweegt even mee met een dier dat ontsnapt. `rattle`: kort trillen (een dier klimt erin of
   * schuurt erlangs); `lean`: ver naar buiten en terugveren (een dier ramt ertegenaan); `bend`: een poosje scheef
   * openduwen en dan terugveren (een dier wringt zich erdoor). `out`: de kant naar buiten (1 naar hoger x of y, -1 naar
   * lager), `amount`: hoe hard (een konijn duwt minder dan een neushoorn).
   */
  wobbleFence(e: Edge, kind: FenceWobble, out: 1 | -1, amount = 1): void {
    const prefix = `${edgeKey(e)}:`;
    // bij een staand hek ('v') wijst de eigen z-as de andere kant op (net als bij topple)
    const tip = e.o === 'h' ? out : -out;
    for (const [key, obj] of this.fences) {
      if (!key.startsWith(prefix)) continue;
      // eerst om de eigen as draaien (de kant van het hek), dan pas kantelen: zo kantelt het hek om zijn voet
      obj.rotation.order = 'YXZ';
      const old = this.wobbles.find(w => w.obj === obj);
      if (old && !(old.kind === 'bend' && kind === 'rattle')) Object.assign(old, { kind, tip, amount, t: 0 });
      else if (!old) this.wobbles.push({ obj, kind, tip, amount, t: 0 });
    }
  }

  /** Stofwolkjes, veertjes en hekken die meebewegen, elk beeldje. */
  private stepEscapeFx(dt: number): void {
    for (const p of this.puffs) {
      p.t += dt;
      const u = Math.min(1, p.t / p.life), drag = Math.max(0, 1 - dt * 3);
      p.vx *= drag;
      p.vz *= drag;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      p.mesh.scale.setScalar(p.size * (0.5 + u * 1.4) * Math.min(1, (1 - u) * 3.5));
      if (u >= 1) this.scene.remove(p.mesh);
    }
    if (this.puffs.length) this.puffs = this.puffs.filter(p => p.t < p.life);
    for (const f of this.plumes) {
      // eerst een stukje omhoog, dan langzaam vallen en heen en weer wiegen als een blaadje
      f.t += dt;
      f.vy = Math.max(-0.32, f.vy - dt * 1.4);
      const sway = Math.sin(f.t * 4.5 + f.phase);
      f.mesh.position.x += (f.vx + sway * 0.35) * dt;
      f.mesh.position.y = Math.max(0.01, f.mesh.position.y + f.vy * dt);
      f.mesh.position.z += f.vz * dt;
      f.mesh.rotation.set(sway * 0.7, f.t * f.spin, Math.PI / 2 + sway * 0.4);
      // op de grond blijven ze nog even liggen en krimpen ze weg
      const left = PLUME_SECONDS - f.t;
      if (left < 0.4) f.mesh.scale.setScalar(Math.max(0.001, left / 0.4));
      if (left <= 0) this.scene.remove(f.mesh);
    }
    if (this.plumes.length) this.plumes = this.plumes.filter(f => f.t < PLUME_SECONDS);
    for (const w of this.wobbles) {
      w.t += dt;
      const len = WOBBLE_SECONDS[w.kind], t = w.t;
      let angle = 0;
      if (w.kind === 'rattle') angle = Math.sin(t * 46) * 0.06 * (1 - t / len);
      else if (w.kind === 'lean') {
        // in een flits naar buiten, dan heen en weer terugveren
        angle = t < 0.1 ? 0.3 * Math.sin((t / 0.1) * Math.PI / 2) : 0.3 * Math.exp(-(t - 0.1) * 4.2) * Math.cos((t - 0.1) * 15);
      } else {
        // openwringen, even zo houden (met een klein trillen), en dan terugveren
        const open = Math.min(1, t / 0.25), back = Math.max(0, t - 1);
        angle = back ? 0.4 * Math.exp(-back * 5) * Math.cos(back * 16) : 0.4 * open * open * (3 - 2 * open) + Math.sin(t * 31) * 0.02;
      }
      w.obj.rotation.x = w.tip * angle * w.amount;
      if (t >= len) w.obj.rotation.x = 0;
    }
    // een hek dat intussen vervangen is (omgeduwd, gerepareerd) hoeft niet meer te bewegen
    if (this.wobbles.length) this.wobbles = this.wobbles.filter(w => w.t < WOBBLE_SECONDS[w.kind] && w.obj.parent);
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

  private pickBox = new THREE.Box3();
  private pickAt = new THREE.Vector2();

  /**
   * Gaat de kijklijn door dit punt van het scherm door een blok van `w` bij `h` tegels op tegel (x, y) en `top`
   * hoog? Zo kun je op een hoog toestel tikken, ook op het stuk dat ver boven zijn tegels uitsteekt (het rad van het
   * reuzenrad). Geeft hoe ver het blok van de camera af ligt (het kleinste getal ligt vooraan), of -1 bij mis.
   */
  boxUnder(clientX: number, clientY: number, x: number, y: number, w: number, h: number, top: number): number {
    this.raycaster.setFromCamera(this.pickAt.set((clientX / innerWidth) * 2 - 1, -(clientY / innerHeight) * 2 + 1), this.eye);
    this.pickBox.min.set(toWorldX(x), 0, toWorldZ(y));
    this.pickBox.max.set(toWorldX(x + w), top, toWorldZ(y + h));
    const hit = this.raycaster.ray.intersectBox(this.pickBox, this.tmp);
    return hit ? this.raycaster.ray.origin.distanceTo(hit) : -1;
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
    this.findTubes(grid);
    this.ground.paint(this.shownGround(grid), seasonNow);
    this.paintRails(grid);
    const bridges: number[] = [], flowers: number[] = [];
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const kind = TERRAINS[grid.terrain[x + y * W]];
        // onthoud de tegel en zijn richting: langs y als daar het pad verder loopt, anders langs x
        if (kind === 'bridge') bridges.push((x + y * W) * 2 + (this.pathAlongY(grid, x, y) ? 1 : 0));
        else if (kind === 'flowerpath') flowers.push((x + y * W) * 2 + (this.pathAlongY(grid, x, y) ? 1 : 0));
      }
    this.buildTubes();
    const key = `${bridges.join(',')};${flowers.join(',')}`;
    if (key === this.pathKey) return;
    this.pathKey = key;
    this.buildPathExtras(bridges, flowers);
  }

  /**
   * Waar de glazen tunnels liggen: per tegel 16 (een stuk tunnel; de kanten waar hij doorloopt staan in de bits 1, 2,
   * 4 en 8: noord, oost, zuid, west) of 32 plus de richting waarin de trap daalt (0 tot 3). Een trap is de padtegel
   * buiten de bak, voor de ingang.
   */
  private tubeAt = new Map<number, number>();
  private tubeKey = '';
  private tubeMeshes: THREE.InstancedMesh[] = [];

  private findTubes(grid: Grid): void {
    this.tubeAt.clear();
    if (grid.tube < 0) return;
    const edgeOf = (x: number, y: number, d: number): Edge => (d === 0 ? { o: 'h', x, y } : d === 2 ? { o: 'h', x, y: y + 1 } : d === 3 ? { o: 'v', x, y } : { o: 'v', x: x + 1, y });
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        if (grid.terrain[x + y * W] !== grid.tube) continue;
        let open = 0;
        TUBE_DIRS.forEach(([dx, dy], d) => {
          const nx = x + dx, ny = y + dy;
          if (!grid.inBounds(nx, ny)) return;
          const n = nx + ny * W, mouth = grid.mouth(edgeOf(x, y, d));
          if (grid.terrain[n] === grid.tube ? grid.canStep(x, y, dx, dy) : mouth) open |= 1 << d;
          // de padtegel voor de ingang wordt een trap, die naar deze tegel toe daalt
          if (mouth && grid.terrain[n] !== grid.tube && !this.tubeAt.has(n)) this.tubeAt.set(n, 32 + ((d + 2) % 4));
        });
        this.tubeAt.set(x + y * W, 16 | open);
      }
  }

  /** Zo diep ligt de grond hier onder het gewone pad: in de tunnel helemaal, op de trap steeds een trede dieper. */
  sink(gx: number, gy: number): number {
    if (!this.tubeAt.size) return 0;
    const x = Math.floor(gx), y = Math.floor(gy), k = this.tubeAt.get(x + y * W);
    if (k === undefined) return 0;
    if (k < 32) return TUBE_DEEP;
    const fx = gx - x, fy = gy - y, d = k - 32, far = d === 0 ? 1 - fy : d === 1 ? fx : d === 2 ? fy : 1 - fx;
    return (TUBE_DEEP * Math.min(STAIR_STEPS + 1, Math.max(0, Math.floor(((far - 0.08) / 0.84) * STAIR_STEPS) + 1))) / (STAIR_STEPS + 1);
  }

  /** De verzonken tunnels: vloeren, wanden, daken van glas en trappen, voor alle tegels samen. */
  private buildTubes(): void {
    const key = [...this.tubeAt].map(([tile, k]) => `${tile}:${k}`).join(',');
    if (key === this.tubeKey) return;
    this.tubeKey = key;
    for (const mesh of this.tubeMeshes) {
      this.scene.remove(mesh);
      mesh.dispose();
    }
    this.tubeMeshes = [];
    if (!this.tubeAt.size) return;
    const tubes = [...this.tubeAt].filter(([, k]) => k < 32), stairs = [...this.tubeAt].filter(([, k]) => k >= 32);
    const walls = tubes.flatMap(([tile, k]) => [0, 1, 2, 3].filter(d => !(k & (1 << d))).map(d => [tile, d]));
    // (de zijkanten van een trap zitten al in de trap zelf)
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), at = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
    const put = (mesh: THREE.InstancedMesh, i: number, tile: number, d = 2): void => {
      const [x, y] = tileXY(tile);
      mesh.setMatrixAt(i, m.compose(at.set(toWorldX(x + 0.5), 0, toWorldZ(y + 0.5)), q.setFromAxisAngle(UP, TUBE_TURN[d]), one));
    };
    const add = (geo: THREE.BufferGeometry, mat: THREE.Material, n: number, fill: (mesh: THREE.InstancedMesh) => void, glass = false): void => {
      if (!n) return;
      const mesh = new THREE.InstancedMesh(geo, mat, n);
      fill(mesh);
      mesh.receiveShadow = !glass;
      mesh.frustumCulled = false;
      if (glass) mesh.renderOrder = 1;
      this.scene.add(mesh);
      this.tubeMeshes.push(mesh);
    };
    add(TUBE_FLOOR_GEO, TUBE_MAT, tubes.length, mesh => tubes.forEach(([tile], i) => put(mesh, i, tile)));
    add(TUBE_ROOF_FRAME_GEO, PAINT_MAT, tubes.length, mesh => tubes.forEach(([tile], i) => put(mesh, i, tile)));
    add(TUBE_ROOF_GEO, TUBE_GLASS_MAT, tubes.length, mesh => tubes.forEach(([tile], i) => put(mesh, i, tile)), true);
    add(TUBE_WALL_GEO, TUBE_MAT, walls.length, mesh => walls.forEach(([tile, d], i) => put(mesh, i, tile, d)));
    add(TUBE_STAIR_GEO, TUBE_MAT, stairs.length, mesh => stairs.forEach(([tile, k], i) => put(mesh, i, tile, k - 32)));
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

  /**
   * Onder een overweg ligt het pad dat er lag toen het spoor erover kwam (`crossLooks`, van het spel): voor de grond
   * is het dus gewoon die soort pad.
   */
  private shownGround(grid: Grid): ArrayLike<number> {
    const looks = this.crossLooks;
    if (!looks?.size && !this.tubeAt.size) return grid.terrain;
    const shown = Uint8Array.from(grid.terrain);
    for (const [tile, look] of looks ?? []) if (shown[tile] === CROSSING) shown[tile] = look;
    // waar de tunnel en zijn trappen liggen, zit een gat in de grond
    for (const tile of this.tubeAt.keys()) shown[tile] = GROUND_HOLE;
    return shown;
  }

  /**
   * Het spoor: op elke tegel met rails de goede stukken (recht, bocht, wissel, kruising of een eindje met een
   * stootblok), en bij elke overweg de planken en de spoorbomen. Er wordt alleen opnieuw gebouwd als er spoor bij
   * komt, weggaat of anders aansluit (ook door een hek dat erdwars overheen komt). paintTerrain doet dit vanzelf; het
   * spel roept het ook los aan, want een hek verandert de grond niet.
   */
  paintRails(grid: Grid): void {
    const links = railLinks(grid), found: number[] = [];
    let key = '';
    for (let i = 0; i < links.length; i++) {
      if (!links[i]) continue;
      // bij een overweg: aan welke kanten het pad erop komt (een bit per kant): daar staat een spoorboom
      let gates = 0;
      if (grid.terrain[i] === CROSSING) {
        const [x, y] = tileXY(i);
        gates = 16;
        for (let s = 0; s < 4; s++) {
          const nx = x + SIDE_DX[s], ny = y + SIDE_DY[s], next = nx + ny * W;
          if (links[i] & (1 << s) || nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          if (isPath(grid.terrain[next]) && !isRail(grid.terrain[next]) && grid.canStep(x, y, SIDE_DX[s], SIDE_DY[s])) gates |= 1 << s;
        }
      }
      found.push(i, links[i] & 15, gates);
      key += `${i}.${links[i] & 15}.${gates},`;
    }
    if (key === this.railKey) return;
    this.railKey = key;
    this.buildRails(found);
  }

  /** Bouwt alle stukken spoor en de overwegen; `found`: per tegel met spoor de tegel, de kanten waar het doorloopt en de kanten met een spoorboom. */
  private buildRails(found: number[]): void {
    for (const mesh of this.railMeshes) {
      this.scene.remove(mesh);
      mesh.dispose();
    }
    this.railMeshes = [];
    // een boom die al dicht was, blijft dicht als het spoor ernaast verandert
    const was = new Map(this.gates.map(g => [g.code, g.k]));
    this.gates = [];
    this.gateArms = this.gateLamps = null;
    // per soort stuk: waar het ligt en hoe het gedraaid is (tegel * 4 + kwartslagen)
    const spots: Record<RailPiece['kind'] | 'xing', number[]> = { straight: [], curve: [], end: [], stub: [], xing: [] };
    const posts: number[] = [];
    for (let k = 0; k < found.length; k += 3) {
      const tile = found[k], gates = found[k + 2];
      for (const piece of railPieces(found[k + 1])) {
        // een los stukje op een overweg ligt dwars op het pad; een recht stuk op een overweg krijgt planken
        const turn = piece.kind === 'stub' && gates & 10 && !(gates & 5) ? 1 : piece.turn;
        spots[gates && piece.kind === 'straight' ? 'xing' : piece.kind].push(tile * 4 + turn);
      }
      for (let s = 0; s < 4; s++) if (gates & (1 << s)) posts.push(tile * 4 + s);
    }
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), at = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
    const pose = (code: number): THREE.Matrix4 => {
      const [x, y] = tileXY(code >> 2);
      return m.compose(at.set(toWorldX(x + 0.5), 0, toWorldZ(y + 0.5)), q.setFromAxisAngle(UP, (-(code & 3) * Math.PI) / 2), one);
    };
    const add = (mesh: THREE.InstancedMesh, shadow: boolean): THREE.InstancedMesh => {
      mesh.castShadow = shadow;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      this.scene.add(mesh);
      this.railMeshes.push(mesh);
      return mesh;
    };
    const lay = (geo: THREE.BufferGeometry, codes: number[], shadow = false): void => {
      if (!codes.length) return;
      const mesh = add(new THREE.InstancedMesh(geo, PAINT_MAT, codes.length), shadow);
      codes.forEach((code, i) => mesh.setMatrixAt(i, pose(code)));
    };
    lay(RAIL_STRAIGHT_GEO, spots.straight);
    lay(RAIL_CURVE_GEO, spots.curve);
    lay(RAIL_END_GEO, spots.end, true);
    lay(RAIL_STUB_GEO, spots.stub, true);
    lay(RAIL_XING_GEO, spots.xing);
    if (!posts.length) return;
    lay(GATE_POST_GEO, posts, true);
    const arms = add(new THREE.InstancedMesh(GATE_ARM_GEO, PAINT_MAT, posts.length), true);
    const lamps = add(new THREE.InstancedMesh(GATE_LAMP_GEO, GATE_LAMP_MAT, posts.length * 2), false);
    const shift = new THREE.Matrix4();
    posts.forEach((code, i) => {
      const base = pose(code).clone().multiply(shift.makeTranslation(GATE_PIVOT[0], GATE_PIVOT[1], GATE_PIVOT[2]));
      this.gates.push({ tile: code >> 2, code, base, k: was.get(code) ?? 0, lit: 0 });
      for (const side of [0, 1]) {
        lamps.setMatrixAt(i * 2 + side, shift.makeTranslation(GATE_POST[0] + (side ? GATE_LAMP_X : -GATE_LAMP_X), GATE_LAMP_Y, GATE_POST[2]).premultiply(pose(code)));
        lamps.setColorAt(i * 2 + side, GATE_LAMP_OFF);
      }
    });
    this.gateArms = arms;
    this.gateLamps = lamps;
    for (let i = 0; i < this.gates.length; i++) this.poseGate(i);
  }

  /** Zet één spoorboom in zijn stand: omhoog (0) of plat over het pad (1), met een rustig begin en eind. */
  private poseGate(i: number): void {
    const g = this.gates[i], k = g.k * g.k * (3 - 2 * g.k);
    this.gateArms!.setMatrixAt(i, this.wm.makeRotationZ(GATE_OPEN * (1 - k)).premultiply(g.base));
  }

  /**
   * De overwegen, elk beeldje. `shut` zegt per tegel of er een trein aankomt of overheen rijdt: dan zakken de bomen
   * en knipperen de twee rode lampen om de beurt; is de trein voorbij, dan gaan de bomen weer omhoog.
   */
  stepCrossings(shut: ArrayLike<number>, dt: number): void {
    const arms = this.gateArms, lamps = this.gateLamps;
    if (!arms || !lamps) return;
    const blink = Math.floor(this.speckTime * 2.6) & 1;
    let moved = false, lit = false;
    for (let i = 0; i < this.gates.length; i++) {
      const g = this.gates[i], want = shut[g.tile] ? 1 : 0;
      if (g.k !== want) {
        g.k = Math.max(0, Math.min(1, g.k + (want ? dt : -dt) / GATE_SECONDS));
        this.poseGate(i);
        moved = true;
      }
      const show = want || g.k > 0 ? 1 + blink : 0;
      if (show === g.lit) continue;
      g.lit = show;
      lamps.setColorAt(i * 2, show === 1 ? GATE_LAMP_ON : GATE_LAMP_OFF);
      lamps.setColorAt(i * 2 + 1, show === 2 ? GATE_LAMP_ON : GATE_LAMP_OFF);
      lit = true;
    }
    if (moved) arms.instanceMatrix.needsUpdate = true;
    if (lit && lamps.instanceColor) lamps.instanceColor.needsUpdate = true;
  }

  private placeEdge(mesh: THREE.Object3D, e: Edge): void {
    mesh.position.set(toWorldX(e.x), 0, toWorldZ(e.y));
    mesh.rotation.y = e.o === 'v' ? -Math.PI / 2 : 0;
  }

  /**
   * Een poort hoort bij het hek waar hij in zit: hout, steen, net, glas of het witte hekje. Dat is het soort hek dat
   * er het meest tegenaan staat; de stukken in dezelfde lijn tellen dubbel. Zo blijft een poort in een bak van glas
   * van glas, ook als er om de hoek een stenen muur staat. Staat er niets naast, dan telt het verblijf erachter.
   */
  private gateStyle(grid: Grid, e: Edge): number {
    const beside: Edge[] = e.o === 'h' ? [{ o: 'h', x: e.x - 1, y: e.y }, { o: 'h', x: e.x + 1, y: e.y }] : [{ o: 'v', x: e.x, y: e.y - 1 }, { o: 'v', x: e.x, y: e.y + 1 }];
    const around: Edge[] = e.o === 'h'
      ? [{ o: 'v', x: e.x, y: e.y - 1 }, { o: 'v', x: e.x, y: e.y }, { o: 'v', x: e.x + 1, y: e.y - 1 }, { o: 'v', x: e.x + 1, y: e.y }]
      : [{ o: 'h', x: e.x - 1, y: e.y }, { o: 'h', x: e.x, y: e.y }, { o: 'h', x: e.x - 1, y: e.y + 1 }, { o: 'h', x: e.x, y: e.y + 1 }];
    const score = new Map<number, number>();
    const count = (list: Edge[], weight: number): void => {
      for (const n of list) {
        const kind = grid.getEdge(n);
        if (kind === 1 || kind === 3 || kind === 4 || kind === 5 || kind === 7) score.set(kind, (score.get(kind) ?? 0) + weight);
      }
    };
    count(beside, 2);
    count(around, 1);
    let best = 0, top = 0;
    for (const [kind, n] of score) if (n > top) [best, top] = [kind, n];
    if (best) return best;
    // een poort tussen twee andere poorten of ruiten: het hek van het verblijf waar hij in zit
    for (const [tx, ty] of e.o === 'h' ? [[e.x, e.y], [e.x, e.y - 1]] : [[e.x, e.y], [e.x - 1, e.y]]) {
      const region = grid.enclosureAt(tx, ty);
      if (region) return grid.penKind(region);
    }
    return 1;
  }

  /**
   * Aan welke kant van een poort in een bak van glas het trapje staat: buiten de bak. 1 = de kant waar het hek in
   * het beeld zijn +z heeft (bij een rand 'h' de tegel ten zuiden, bij 'v' de tegel ten westen), -1 = de andere kant.
   */
  private stairSide(grid: Grid, e: Edge): 1 | -1 {
    const tank = ([x, y]: number[]): boolean => {
      const region = grid.enclosureAt(x, y);
      return !!region && grid.penKind(region) === 5;
    };
    const [plus, minus] = e.o === 'h' ? [[e.x, e.y], [e.x, e.y - 1]] : [[e.x - 1, e.y], [e.x, e.y]];
    return tank(plus) && !tank(minus) ? -1 : 1;
  }

  /** Een hek in een eigen kleur; versleten hout (ook het witte hekje) wordt per fase donkerder, steen, net en glas niet. */
  private tintMats = new Map<string, THREE.Material>();
  private tintMat(style: number, tint: number, worn: number): THREE.Material {
    const key = `${style}:${tint}:${worn}`;
    let mat = this.tintMats.get(key);
    if (!mat) {
      const color = new THREE.Color((FENCE_COLORS as Record<number, number[]>)[style]?.[tint] ?? 0xffffff).multiplyScalar(style === 1 || style === 7 ? [1, 0.86, 0.7, 0.54][worn] : 1);
      mat = new THREE.MeshStandardMaterial({ color, roughness: style === 4 ? 0.7 : 0.95 });
      this.tintMats.set(key, mat);
    }
    return mat;
  }

  /** `wear`: per rand hoe versleten het hek is (1, 2 of 3; zie wear.ts). `tints`: per rand de gekozen kleur (zie FENCE_COLORS). */
  syncFences(grid: Grid, wear?: Map<string, number>, tints?: Map<string, number>): void {
    const wanted = new Map<string, { e: Edge; kind: number; style: number; worn: number; tint: number; stair: number; off: number }>();
    const penKinds = new Map<number, EdgeKind>();
    for (const edge of grid.edges()) {
      // een hek tussen twee verblijven: aan elke kant het hek van dat verblijf. Zijn die verschillend (steen naast
      // hout, steen naast net), dan staat er een dubbel hek: elk een stukje naar zijn eigen kant geschoven
      const sides = grid.sharedSide(edge.e, penKinds);
      const parts: [number, number][] = !sides ? [[edge.kind, 0]] : sides[0] === sides[1] ? [[sides[0], 0]] : [[sides[0], -1], [sides[1], 1]];
      for (const [kind, off] of parts) {
        const item = { e: edge.e, kind };
        // een kijkvenster is van steen, het poortje van de kinderboerderij hoort bij het witte hekje
        const style = item.kind === 2 ? this.gateStyle(grid, item.e) : item.kind === 6 ? 3 : item.kind === 8 ? 7 : item.kind;
        // (slijtage hoort bij het hek dat er echt gezet is)
        const worn = wears(item.kind) && item.kind === edge.kind ? wear?.get(edgeKey(item.e)) ?? 0 : 0;
        const tint = tints?.get(edgeKey(item.e)) ?? 0;
        // een poort in een bak van glas is een trapje aan de buitenkant: aan welke kant dat is
        const stair = item.kind === 2 && style === 5 ? this.stairSide(grid, item.e) : 0;
        wanted.set(`${edgeKey(item.e)}:${item.kind}:${style}:${worn}:${tint}:${stair}:${off}`, { ...item, style, worn, tint, stair, off });
      }
    }
    for (const [key, mesh] of this.fences)
      if (!wanted.has(key)) {
        this.scene.remove(mesh);
        this.fences.delete(key);
      }
    for (const [key, { e, kind, style, worn, tint, stair, off }] of wanted) {
      if (this.fences.has(key)) continue;
      if (kind === 9) {
        // de safaripoort: de palen met het bord, twee deuren die los openzwaaien en twee zwaailichten
        const posts = new THREE.Mesh(SAFARIGATE_GEO, PAINT_MAT), gate = new THREE.Group().add(posts);
        posts.castShadow = true;
        const leaves = [0, 1].map(i => {
          const leaf = new THREE.Mesh(SAFARI_LEAF_GEO, PAINT_MAT), hinge = new THREE.Group().add(leaf);
          leaf.castShadow = true;
          // (de rechterdeur is dezelfde deur, een halve slag gedraaid)
          if (i) leaf.rotation.y = Math.PI;
          hinge.position.set(i ? 0.92 : 0.08, 0, 0);
          gate.add(hinge);
          return hinge;
        });
        // elk zwaailicht heeft zijn eigen licht en bundel: zo knipperen ze om de beurt
        const beacons = [0.02, 0.98].map(x => {
          const lamp = new THREE.Mesh(SAFARI_BEACON_GEO, SAFARI_BEACON_MAT.clone()), beam = new THREE.Mesh(SAFARI_BEAM_GEO, SAFARI_BEAM_MAT.clone());
          lamp.position.set(x, 1.465, 0);
          beam.position.set(x, 1.47, 0);
          beam.renderOrder = 4;
          gate.add(lamp, beam);
          return { lamp, beam };
        });
        Object.assign(gate.userData, { leaves, beacons, open: 0, dir: 1, o: e.o, at: e.o === 'h' ? [e.x + 0.5, e.y] : [e.x, e.y + 0.5] });
        this.placeEdge(gate, e);
        this.scene.add(gate);
        this.fences.set(key, gate);
        continue;
      }
      const geo = kind === 8 ? PETGATE_GEO : kind === 7 ? PICKET_GEO : kind === 6 ? WINDOW_GEO : kind === 5 || stair ? GLASS_FRAME_GEO : kind === 4 ? NET_GEO : kind === 3 ? WALL_GEO : kind === 2 ? GATE_GEO : WORN_GEOS[worn];
      const frame = new THREE.Mesh(geo, tint ? this.tintMat(style, tint, worn) : style === 5 ? GLASS_FRAME_MAT : style === 3 ? STONE_MAT : style === 4 ? NET_MAT : style === 7 ? WHITE_MAT : WORN_MATS[worn]);
      frame.castShadow = true;
      let mesh: THREE.Object3D = frame;
      if (kind === 5 || kind === 6 || stair) {
        // glas en kijkvenster: de lijst met een doorzichtige ruit erin
        const pane = new THREE.Mesh(kind === 6 ? WINDOW_PANE_GEO : GLASS_PANE_GEO, GLASS_MAT);
        pane.renderOrder = 3;
        mesh = new THREE.Group().add(frame, pane);
        if (stair) {
          // de poort van een bak van glas: het trapje aan de buitenkant en het laddertje het water in
          const steps = new THREE.Mesh(stair > 0 ? STAIR_GEO : STAIR_BACK_GEO, PAINT_MAT);
          steps.castShadow = true;
          mesh.add(steps);
        }
      } else if (kind === 8) {
        // het poortje van de kinderboerderij: het bord met het hart houdt zijn eigen kleuren
        const sign = new THREE.Mesh(PETSIGN_GEO, PAINT_MAT);
        sign.castShadow = true;
        mesh = new THREE.Group().add(frame, sign);
      }
      // een versleten muur, net, glas of wit hekje (zie WORN_LOOK): een eigen vorm per fase, zo nodig met de scheuren erbij
      const look = worn ? WORN_LOOK[kind] : undefined;
      if (look) {
        frame.geometry = look.geo[worn];
        if (!tint && look.mats) frame.material = look.mats[worn];
        const extra = look.extra?.[worn], pane = look.pane?.[worn];
        if (pane && mesh !== frame) (mesh.children[1] as THREE.Mesh).geometry = pane;
        if (extra) mesh = (mesh === frame ? new THREE.Group().add(frame) : mesh).add(new THREE.Mesh(extra[0], extra[1]));
      }
      this.placeEdge(mesh, e);
      // de helft van een dubbel hek: een stukje naar zijn eigen verblijf toe
      if (off) {
        if (e.o === 'h') mesh.position.z += off * DOUBLE_FENCE;
        else mesh.position.x += off * DOUBLE_FENCE;
      }
      this.scene.add(mesh);
      this.fences.set(key, mesh);
    }
  }

  /**
   * De safaripoorten: de deuren zwaaien open als er een jeep vlakbij is (`jeeps`: gx, gy om en om), van de jeep af, en
   * weer dicht als hij voorbij is. Zolang de poort open is of beweegt, draaien en knipperen de oranje zwaailichten
   * om de beurt. Geeft de plek terug van elke poort die net begint open te gaan (voor het geluid).
   */
  liftSafariGates(jeeps: number[], dt: number): [number, number][] {
    const opened: [number, number][] = [];
    for (const gate of this.fences.values()) {
      const u = gate.userData, leaves = u.leaves as THREE.Object3D[] | undefined;
      if (!leaves) continue;
      const [gx, gy] = u.at as [number, number];
      let near = false, side = 0;
      for (let i = 0; i < jeeps.length; i += 2) {
        if (Math.hypot(jeeps[i] - gx, jeeps[i + 1] - gy) >= 1.9) continue;
        near = true;
        // aan welke kant van de poort de jeep is (in de eigen maat van de poort: een staand hek kijkt de andere kant op)
        side = u.o === 'h' ? Math.sign(jeeps[i + 1] - gy) : -Math.sign(jeeps[i] - gx);
      }
      const was = u.open as number;
      // de deuren zwaaien van de jeep af; die kant staat vast zolang ze open zijn
      if (near && was < 0.05) {
        u.dir = side > 0 ? -1 : 1;
        if (!u.busy) opened.push([gx, gy]);
      }
      u.busy = near;
      // rustig open (met een klein veertje aan het eind) en rustig weer dicht
      const open = was + ((near ? 1 : 0) - was) * Math.min(1, dt * (near ? 3.2 : 2));
      u.open = open;
      const swing = (open * open * (3 - 2 * open) + Math.sin(open * Math.PI) * 0.06) * 1.7 * (u.dir as number);
      leaves[0].rotation.y = -swing;
      leaves[1].rotation.y = swing;
      // de zwaailichten: om de beurt fel, en de bundels draaien rond
      const lit = Math.min(1, open * 4);
      (u.beacons as { lamp: THREE.Mesh; beam: THREE.Mesh }[]).forEach(({ lamp, beam }, i) => {
        const pulse = lit * Math.max(0, Math.sin(this.speckTime * 9 + i * Math.PI));
        (lamp.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.15 + 2.4 * pulse;
        (beam.material as THREE.MeshBasicMaterial).opacity = 0.34 * lit * (0.45 + 0.55 * pulse);
        beam.visible = lit > 0.02;
        if (lit > 0.02) beam.rotation.y = this.speckTime * (i ? -7 : 7);
      });
    }
    return opened;
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
      if (this.tankOver) {
        this.scene.remove(this.tankOver);
        this.tankOver.dispose();
        this.tankOver = null;
      }
      if (!tiles.length) return;
      const box = new THREE.BoxGeometry(1, height, 1).translate(0, height / 2 + 0.005, 0);
      this.tank = new THREE.InstancedMesh(box, TANK_MAT, tiles.length);
      const m = new THREE.Matrix4();
      // boven de verzonken tunnel is het water helderder (een eigen, dunner laagje): zo zie je de gasten eronder lopen
      const over = tiles.filter(([x, y]) => this.tubeAt.has(x + y * W));
      tiles.forEach(([x, y], i) => this.tank!.setMatrixAt(i, this.tubeAt.has(x + y * W) ? m.makeScale(0, 0, 0) : m.makeTranslation(toWorldX(x + 0.5), 0, toWorldZ(y + 0.5))));
      this.tank.renderOrder = 2;
      this.tank.frustumCulled = false;
      this.scene.add(this.tank);
      if (over.length) {
        this.tankOver = new THREE.InstancedMesh(box, TANK_OVER_MAT, over.length);
        over.forEach(([x, y], i) => this.tankOver!.setMatrixAt(i, m.makeTranslation(toWorldX(x + 0.5), 0, toWorldZ(y + 0.5))));
        this.tankOver.renderOrder = 2;
        this.tankOver.frustumCulled = false;
        this.scene.add(this.tankOver);
      }
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
    if (kind === 'bucket') {
      const parts = [new THREE.Mesh(BUCKET_GEO, SILO_MAT), new THREE.Mesh(BUCKET_INSIDE_GEO, BUCKET_INSIDE_MAT)];
      parts[0].castShadow = true;
      // het voer ligt boven in de emmer: kleiner, en net boven de rand te zien
      food.position.set(0, 0.6, BUCKET_Z);
      food.scale.setScalar(0.62);
      group.add(...parts, food);
    } else if (kind === 'silo') {
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
    // in de emmer past een stukje per twee porties, in twee rijtjes van twee
    const pieces = mesh.kind === 'silo' ? Math.ceil(amount / 4) : mesh.kind === 'bucket' ? Math.ceil(amount / 2) : amount;
    for (let i = 0; i < pieces; i++) {
      const piece = foodPiece(food);
      if (mesh.kind === 'bucket') piece.position.set(-0.1 + (i % 2) * 0.2, 0.13 + Math.floor(i / 2) * 0.04, i < 2 ? -0.09 : 0.09);
      else piece.position.set(-0.255 + (i % 4) * 0.17, food === 'hay' ? 0.14 : 0.13, mesh.kind === 'big' ? (i < 4 ? -0.1 : 0.1) : 0);
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
  private atSpot<T extends THREE.Object3D>(obj: T, x: number, y: number, edge?: 'h' | 'v' | 'c', rot = 0, shift = 0, lift = 0): T {
    this.poseDecor(obj, x, y, edge, shift, lift);
    return this.turned(obj, rot);
  }

  /** Zet een versiering die er al staat op een andere plek (er is een hek bij gekomen of weggehaald). */
  /**
   * Zet een versiering op zijn plek: midden op tegel (x, y), op een rand van die tegel ('h' de noordrand, 'v' de
   * westrand) of op zijn noordwesthoek ('c'). `shift`: staat er een hek op die rand, dan schuift het ding een stukje
   * op naar die kant (1 = zuid of oost, -1 = noord of west), zodat het naast het hek staat en nog binnen de tegel
   * valt. `lift`: zo hoog staat het boven de grond (een lage lamp bovenop een hek).
   */
  poseDecor(group: THREE.Object3D, x: number, y: number, edge: 'h' | 'v' | 'c' | undefined, shift: number, lift = 0): void {
    const gx = edge === 'c' ? x : x + (edge === 'v' ? shift * EDGE_SHIFT : 0.5), gy = edge === 'c' ? y : y + (edge === 'h' ? shift * EDGE_SHIFT : 0.5);
    group.position.set(toWorldX(gx), lift, toWorldZ(gy));
  }

  makeDecor(x: number, y: number, kind: DecorKind, edge?: 'h' | 'v' | 'c', rot = 0, shift = 0, lift = 0): THREE.Group {
    const group = this.atSpot(buildDecor(kind), x, y, edge, rot, shift, lift);
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
      // de helft van de bomen draagt appels
      const apples = group.children[2] as THREE.Mesh;
      apples.geometry = TREE_APPLES[shape];
      apples.visible = hash(x, y, 9) < 0.5;
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

  ghostDecor(x: number, y: number, kind: DecorKind, ok: boolean, edge?: 'h' | 'v' | 'c', rot = 0, shift = 0, lift = 0): void {
    this.ghostMat.color.setHex(ok ? OK_COLOR : BAD_COLOR);
    this.atSpot(this.ghostDecors[kind], x, y, edge, rot, shift, lift).visible = true;
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
    const model = kind === 9 ? this.ghostSafariGateMesh : kind === 8 ? this.ghostPetgateMesh : kind === 7 ? this.ghostPicketMesh : kind === 6 ? this.ghostWindowMesh : kind === 5 ? this.ghostGlassMesh : kind === 4 ? this.ghostNetMesh : kind === 3 ? this.ghostWallMesh : kind === 2 ? this.ghostGateMesh : this.ghostFenceMesh;
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
    // elke wipkip is een ander dier: welk dier, hangt af van de plek waar hij staat
    if (kind === 'springer') (group.userData.rocker as THREE.Mesh).geometry = SPRINGER_GEOS[Math.floor(hash(x, y, 31) * SPRINGER_GEOS.length)];
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
      // het huisje van de kabelbaan: de kabels draaien niet mee, dus de palen en het bord opnieuw passen
      fitCableHouse(group);
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
    const mesh = kind === 9 ? this.ghostSafariGateMesh : kind === 8 ? this.ghostPetgateMesh : kind === 7 ? this.ghostPicketMesh : kind === 6 ? this.ghostWindowMesh : kind === 5 ? this.ghostGlassMesh : kind === 4 ? this.ghostNetMesh : kind === 3 ? this.ghostWallMesh : kind === 2 ? this.ghostGateMesh : this.ghostFenceMesh;
    this.ghostMat.color.setHex(ok ? OK_COLOR : BAD_COLOR);
    this.placeEdge(mesh, e);
    mesh.visible = true;
  }

  ghostTile(x: number, y: number, color: number): void {
    this.ghostTileMat.color.setHex(color);
    this.ghostTileMesh.position.set(toWorldX(x + 0.5), 0.012, toWorldZ(y + 0.5));
    this.ghostTileMesh.visible = true;
  }

  /** `bucket`: het voorbeeld is de voeremmer aan het glas (in een aquarium). */
  ghostTrough(x: number, y: number, ok: boolean, rot = 0, bucket = false): void {
    this.ghostMat.color.setHex(ok ? OK_COLOR : BAD_COLOR);
    const mesh = bucket ? this.ghostBucketMesh : this.ghostTroughMesh;
    mesh.position.set(toWorldX(x + 0.5), 0, toWorldZ(y + 0.5));
    mesh.rotation.y = (rot * Math.PI) / 2;
    mesh.visible = true;
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
   * open als er een gast in of uit stapt (`userData.ajar`, zie de gasten) en daarna weer dicht, het bankje zakt een
   * haartje in, de deksel van de afvalbak klapt (zie flapLid) en om een vieze kraam cirkelen vliegen. Wat aan een
   * attractie of speeltoestel beweegt, doet animateRide.
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
      const geos = partyParts(SHOP_SIZE[kind], SHOP_DEEP[kind] ?? SHOP_SIZE[kind], PARTY_CAKE[kind]);
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
   * Een treintje: een locomotief, TRAIN.wagons open wagons met elk TRAIN.seats bankjes achter elkaar, en een tweede
   * locomotief voor achteraan (die rijdt alleen mee op een lijn, waar de trein heen en weer moet). Alles staat
   * onzichtbaar in het beeld; de trein zet zelf `position`, `rotation.y` en `visible`. Elk deel heeft zijn midden op
   * de rails en zijn neus naar +z. `n`: de hoeveelste trein het is; elke trein heeft zijn eigen kleuren.
   * `roll` laat de wielen draaien (zo ver is de trein gereden, in tegels), `puff` blaast een wolkje stoom uit de
   * schoorsteen van die locomotief.
   */
  /** De jeep van de safaritrein: de bak met de ranger, vier wielen die los draaien en de armen aan het stuur. */
  makeJeep(): THREE.Group {
    const jeep = build([[JEEP_BODY, PAINT_MAT], [JEEP_LAMPS, LAMP_MAT, false]]);
    const wheels = [[-0.27, 0.27], [0.27, 0.27], [-0.27, -0.27], [0.27, -0.27]].map(([x, z]) => {
      const wheel = piece(JEEP_WHEEL, PAINT_MAT);
      wheel.position.set(x, 0.11, z);
      jeep.add(wheel);
      return wheel;
    });
    const arms = piece(JEEP_ARMS, PAINT_MAT);
    arms.position.set(0.13, SAFARI.bench + 0.16, 0.06);
    jeep.add(arms);
    Object.assign(jeep.userData, { wheels, arms });
    shadeGroup(jeep);
    this.scene.add(jeep);
    return jeep;
  }

  makeTrain(n = 0): { loco: THREE.Group; wagons: THREE.Group[]; tail: THREE.Group; roll: (dist: number) => void; puff: (from: THREE.Object3D) => void } {
    const look = TRAIN_LOOKS[n % TRAIN_LOOKS.length];
    const engine = (): THREE.Group => build([[locoGeo(look.boiler, look.cab), PAINT_MAT], [LOCO_LAMP_GEO, LAMP_MAT, false]]);
    const loco = engine(), tail = engine();
    const wagons = Array.from({ length: TRAIN.wagons }, (_, i) => build([[wagonGeo(look.wagons[i % look.wagons.length]), PAINT_MAT]]));
    const cars = [loco, ...wagons, tail];
    // alle assen van deze trein samen: twee per wagen
    const wheels = new THREE.InstancedMesh(AXLE_GEO, PAINT_MAT, cars.length * 2);
    wheels.castShadow = true;
    wheels.frustumCulled = false;
    for (const car of cars) {
      car.visible = false;
      this.scene.add(car);
    }
    this.scene.add(wheels);
    const m = new THREE.Matrix4(), spin = new THREE.Matrix4(), size = new THREE.Vector3();
    const roll = (dist: number): void => {
      for (let k = 0; k < cars.length; k++) {
        const car = cars[k], big = car === loco || car === tail, r = big ? LOCO_WHEEL : WAGON_WHEEL, axles = big ? LOCO_AXLES : WAGON_AXLES;
        // de tweede locomotief staat andersom: zijn wielen draaien de andere kant op. Een wagen die niet meerijdt, heeft geen wielen
        const angle = (car === tail ? -dist : dist) / r, s = car.visible ? r / LOCO_WHEEL : 0;
        size.set(car.visible ? 1 : 0, s, s);
        for (let a = 0; a < 2; a++) {
          m.makeRotationY(car.rotation.y).setPosition(car.position.x, car.position.y, car.position.z);
          wheels.setMatrixAt(k * 2 + a, m.multiply(spin.makeRotationX(angle).scale(size).setPosition(0, r, axles[a])));
        }
      }
      wheels.instanceMatrix.needsUpdate = true;
    };
    const puff = (from: THREE.Object3D): void => {
      const h = from.rotation.y;
      this.puffSteam(from.position.x + Math.sin(h) * CHIMNEY[2], from.position.y + CHIMNEY[1], from.position.z + Math.cos(h) * CHIMNEY[2]);
    };
    roll(0);
    return { loco, wagons, tail, roll, puff };
  }

  /** Een wolkje stoom op deze plek: het stijgt op, wordt groter en lost dan op. */
  puffSteam(x: number, y: number, z: number): void {
    if (!this.steam) {
      this.steam = new THREE.InstancedMesh(STEAM_GEO, STEAM_MAT, STEAM_MAX);
      this.steam.frustumCulled = false;
      for (let i = 0; i < STEAM_MAX; i++) this.steam.setMatrixAt(i, this.wm.makeScale(0, 0, 0));
      this.scene.add(this.steam);
    }
    const i = this.steamNext * 4, at = this.steamAt;
    this.steamNext = (this.steamNext + 1) % STEAM_MAX;
    at[i] = x;
    at[i + 1] = y;
    at[i + 2] = z;
    at[i + 3] = 0;
    this.steamLive = true;
  }

  /** De stoomwolkjes, elk beeldje: omhoog, een beetje opzij en groter; aan het eind krimpen ze weg. */
  private stepSteam(dt: number): void {
    const steam = this.steam, at = this.steamAt;
    if (!steam || !this.steamLive) return;
    this.steamLive = false;
    for (let i = 0; i < STEAM_MAX; i++) {
      if (at[i * 4 + 3] >= STEAM_SECONDS) continue;
      const age = (at[i * 4 + 3] += dt), u = Math.min(1, age / STEAM_SECONDS);
      const size = (0.045 + 0.1 * u) * Math.min(1, (1 - u) * 3.5);
      steam.setMatrixAt(i, this.wm.makeScale(size, size, size).setPosition(at[i * 4] + u * 0.1, at[i * 4 + 1] + u * 0.55, at[i * 4 + 2] - u * 0.06));
      if (age < STEAM_SECONDS) this.steamLive = true;
    }
    steam.instanceMatrix.needsUpdate = true;
  }

  /**
   * Een kabelbaan langs dit pad (zie cablePath): twee kabels (heen en terug) die bij de huisjes laag om een groot
   * wiel gaan en daartussen hoog over het park hangen, gewone palen eronder (`poles`: het spel geeft er geen, daar staan
   * alleen de tussenpalen van de speler; het modellenblad laat ze nog wel zien), de tussenpalen
   * van de speler met hun wielen, en `chairs` stoeltjes. Alles staat op zijn plek in het park. Het spel zet de
   * stoeltjes zelf op hun plek en draait de wielen (`userData.dir`: de kant waar een wiel heen draait).
   */
  makeCable(path: CablePath, poles: CablePole[], chairs: number): { group: THREE.Group; chairs: THREE.Object3D[]; wheels: THREE.Object3D[] } {
    const group = new THREE.Group();
    const r = CABLE.r, half = Math.PI * r, rope: THREE.BufferGeometry[] = [], seat: CableSeat = { gx: 0, gy: 0, h: 0, mx: 0, my: 0, turn: 0 };
    const at = (s: number): P3 => {
      cableAt(path, s, seat);
      return [toWorldX(seat.gx), seat.h, toWorldZ(seat.gy)];
    };
    // de kabel: recht waar hij recht en vlak loopt, in korte stukjes waar hij klimt en om een wiel gaat
    for (const [from, len] of [[0, path.out], [path.out + half, path.back]])
      for (const p of path.pieces) {
        const t0 = p.at - from, t1 = t0 + p.len;
        if (t0 < -1e-6 || t1 > len + 1e-6) continue;
        const stops = [t0, ...(p.r ? [] : [1, 1 + path.ramp, len - 1 - path.ramp, len - 1].filter(t => t > t0 + 1e-6 && t < t1 - 1e-6)), t1].sort((a, b) => a - b);
        for (let k = 0; k + 1 < stops.length; k++) {
          const a = stops[k], b = stops[k + 1], far = Math.min((a + b) / 2, len - (a + b) / 2);
          const n = p.r ? Math.max(1, Math.ceil(Math.abs(p.sweep) / (Math.PI / 15))) : far > 1 && far < 1 + path.ramp ? Math.ceil((b - a) / 0.2) : 1;
          for (let j = 0; j < n; j++) rope.push(beam(0.03, at(from + a + ((b - a) * j) / n), at(from + a + ((b - a) * (j + 1)) / n)));
        }
      }
    const ends = [path.pts[0], path.pts[path.pts.length - 1]];
    for (const [gx, gy] of ends) rope.push(new THREE.TorusGeometry(r, 0.016, 4, 24).rotateX(Math.PI / 2).translate(toWorldX(gx), CABLE.low, toWorldZ(gy)));
    const ropeMesh = new THREE.Mesh(merge(rope), CABLE_MAT);
    ropeMesh.castShadow = true;
    group.add(ropeMesh);
    // de gewone palen (als die er zijn) en de tussenpalen van de speler, samen één vorm; de sneeuw erop apart
    const parts = poleParts(), turning: [number, number, number][] = [];
    for (const p of poles) addCablePole(p, parts);
    for (const m of path.masts) addCableMast(m, parts, turning);
    if (parts.snow.length) {
      const pole = new THREE.Mesh(painted(...parts.stand.map((geos, i): [number, ...THREE.BufferGeometry[]] => [POLE_COLORS[i], ...geos])), PAINT_MAT);
      pole.castShadow = true;
      group.add(pole, new THREE.Mesh(merge(parts.snow), CABLE_SNOW_MAT));
    }
    // de grote wielen: in de huisjes laag aan hun as, op de tussenpalen hoog om de paal
    const wheelGeo = cableWheelGeo(0.07), mastWheelGeo = cableWheelGeo(0.11);
    const wheel = (geo: THREE.BufferGeometry, x: number, y: number, z: number, dir: number): THREE.Mesh => {
      const mesh = new THREE.Mesh(geo, PAINT_MAT);
      mesh.position.set(x, y, z);
      mesh.userData.dir = dir;
      // (in het huisje hangt het wiel onder het dak; op een paal geeft het een schaduw op het gras)
      mesh.castShadow = geo === mastWheelGeo;
      group.add(mesh);
      return mesh;
    };
    const wheels = [...ends.map(([gx, gy]) => wheel(wheelGeo, toWorldX(gx), CABLE.low, toWorldZ(gy), 1)), ...turning.map(([x, z, dir]) => wheel(mastWheelGeo, x, CABLE.high, z, dir))];
    const chairGeos = CHAIR_COLORS.slice(0, chairs).map(chairGeo);
    const seats = Array.from({ length: chairs }, (_, i) => {
      const chair = new THREE.Mesh(chairGeos[i % chairGeos.length], PAINT_MAT);
      chair.castShadow = true;
      group.add(chair);
      return chair;
    });
    this.scene.add(group);
    return { group, chairs: seats, wheels };
  }

  /**
   * De stukken kabelbaan die nog in aanbouw zijn (`lines`: per stuk het huisje en de tussenpalen die er al staan): de
   * palen zelf, en van het huisje langs de palen een geel stippellijntje, zodat je ziet hoe de kabel gaat lopen. De
   * echte kabel komt als het eindhuisje er staat (zie makeCable).
   */
  makeCableDraft(lines: P2[][]): THREE.Group {
    const group = new THREE.Group(), parts = poleParts(), turning: [number, number, number][] = [], dashes: THREE.BufferGeometry[] = [];
    for (const pts of lines) {
      const last = pts[pts.length - 1];
      // de palen ertussen weten hun bocht al; de laatste nog niet
      if (pts.length > 2) for (const m of cablePath(pts).masts) addCableMast(m, parts, turning);
      addCableMast({ x: last[0], y: last[1], bend: 0, ax: 1, ay: 0, wx: last[0], wy: last[1] }, parts, turning);
      for (let i = 0; i + 1 < pts.length; i++) {
        const a: P3 = [toWorldX(pts[i][0]), i ? CABLE.high : CABLE.low, toWorldZ(pts[i][1])], b: P3 = [toWorldX(pts[i + 1][0]), CABLE.high, toWorldZ(pts[i + 1][1])];
        const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]), n = Math.max(1, Math.round(len / 0.4));
        const on = (t: number): P3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
        for (let k = 0; k < n; k++) dashes.push(beam(0.035, on((k + 0.2) / n), on((k + 0.8) / n)));
      }
    }
    if (!lines.length) return group;
    // (in aanbouw draaien de wielen nog niet: ze zitten gewoon aan de paal vast)
    const wheelGeo = cableWheelGeo(0.11);
    const pole = new THREE.Mesh(merge([
      painted(...parts.stand.map((geos, i): [number, ...THREE.BufferGeometry[]] => [POLE_COLORS[i], ...geos])),
      ...turning.map(([x, z]) => wheelGeo.clone().translate(x, CABLE.high, z)),
    ]), PAINT_MAT);
    pole.castShadow = true;
    group.add(pole, new THREE.Mesh(merge(parts.snow), CABLE_SNOW_MAT), new THREE.Mesh(merge(dashes), P_YELLOW));
    this.scene.add(group);
    return group;
  }

  /**
   * Het huisje van de kabelbaan weet waar zijn kabels heen gaan (`dirs`: de richtingen op de kaart, lengte 1): de
   * hoekpalen waar de stoeltjes langs moeten gaan weg en het bord gaat opzij (zie fitCableHouse).
   */
  cableHouse(group: THREE.Object3D, dirs: P2[]): void {
    group.userData.dirs = dirs;
    fitCableHouse(group);
  }

  /**
   * Het voorbeeld van de kabel: een lijn hoog boven het park van het laatste punt (een huisje of een tussenpaal) naar
   * de plek onder je vinger, groen of rood.
   */
  ghostCable(ax: number, ay: number, bx: number, by: number, ok: boolean): void {
    const m = this.ghostCableMesh, dx = bx - ax, dy = by - ay;
    (m.material as THREE.MeshBasicMaterial).color.setHex(ok ? OK_COLOR : BAD_COLOR);
    m.position.set(toWorldX((ax + bx) / 2), CABLE.high, toWorldZ((ay + by) / 2));
    m.rotation.set(0, Math.atan2(-dy, dx), 0);
    m.scale.set(Math.max(0.1, Math.hypot(dx, dy)), 1, 1);
    m.visible = true;
  }

  /** Het voorbeeld van een tussenpaal op tegel (x, y): groen als hij daar kan staan, rood als niet (of als hij weggaat). */
  ghostPylon(x: number, y: number, ok: boolean): void {
    this.ghostMat.color.setHex(ok ? OK_COLOR : BAD_COLOR);
    this.ghostPylonMesh.position.set(toWorldX(x + 0.5), 0, toWorldZ(y + 0.5));
    this.ghostPylonMesh.visible = true;
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
    // palen staan op hoeken en midden op randen: tussen twee palen in één lijn zit dus een heel of een half aantal tegels
    for (const p of poles)
      for (const [dx, dy] of [[1, 0], [0, 1]])
        for (let d = 0.5; d <= STRING_REACH; d += 0.5) {
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
    this.stepSteam(dt);
    this.stepFireworks(dt);
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
    this.stepEscapeFx(dt);
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
