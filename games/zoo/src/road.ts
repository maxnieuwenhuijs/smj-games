// De weg voor de poort: asfalt met een stoep en een fietspad, auto's die voorbijrijden, de schoolbus en de
// vrachtwagen die bij de poort stoppen, en mensen die te voet, op de fiets of op de step voorbijkomen.
// Alles is alleen om naar te kijken: je kunt er niets bouwen en er niet op tikken. De echte gasten (zie people.ts)
// lopen hier over de stoep naar de poort en na hun bezoek weer weg: hun routes staan onderaan `waar alles ligt`.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { sfx } from './audio';
import { H, W } from './grid';
import { randomFace, soloFace } from './faces';

type Geo = THREE.BufferGeometry;
type Light = { gx: number; gy: number; r: number };
/** Een rijtje vormen met hun kleur voorop. */
type Tinted = [number, ...Geo[]];

// ------------------------------------------------------------ waar alles ligt (in de wereld: x opzij, z naar voren)
/** Het midden van de poort, en de voorkant van het park. Het park groeit alleen opzij en naar achter: de weg blijft dus vrij. */
const GATE_X = Math.floor(W / 2) + 0.5 - W / 2;
const FRONT_Z = H / 2;
/** De weg loopt van -END tot END: helemaal door tot de rand van de wereld, zo ver als het gras reikt. Wat daar voorbij rijdt, is weg. */
const END = 60;
const PAVE_Z = FRONT_Z + 1.65, PAVE_W = 0.9;
const WALK_Z = FRONT_Z + 1.5, STEP_Z = FRONT_Z + 1.9;
const BIKE_Z = FRONT_Z + 2.5, BIKE_W = 0.8;
const KERB_Z = FRONT_Z + 3;
const ROAD_Z = FRONT_Z + 4.5, ROAD_W = 2.8;
/** De rijbaan aan de kant van het park (naar links, -x) en die aan de overkant (naar rechts, +x). */
const LANE_NEAR = FRONT_Z + 3.8, LANE_FAR = FRONT_Z + 5.2;
const FAR_Z = FRONT_Z + 6.35, FAR_W = 0.7;
/** Hier staat de neus van de bus of de vrachtwagen als hij stopt: net voor het zebrapad. */
const STOP_NOSE = GATE_X + 1.2;
const RACK_X = GATE_X - 1.9;
/** Zo ver voor de poort (in tegels) belt een fietser. */
const BELL_AT = 3.5;
/** Hoe lang de bus is, en hoe ver zijn deur achter zijn midden zit (hij rijdt naar links, de deur zit aan de kant van het park). */
const BUS_LEN = 2.75, BUS_DOOR = 0.72;

// ------------------------------------------------------------ de looproutes van de echte gasten (in tegels van het raster)
type Spot = [number, number];
const spot = (x: number, z: number): Spot => [x + W / 2, z + H / 2];

/**
 * De route van een gast die aankomt. Het eerste punt is waar hij begint: op de stoep, `far` tegels links (-1) of
 * rechts (1) van de poort. Dan naar het pleintje, de bocht om en door de poort tot op de tegel van de ingang.
 * `lane` (-0,5 tot 0,5) is zijn eigen plekje in de breedte, zodat niet iedereen precies achter elkaar loopt.
 */
export function arrivalPath(side: number, far: number, lane = 0): Spot[] {
  const x = GATE_X + lane * 0.4, z = WALK_Z - 0.05 + lane * 0.3;
  return [spot(GATE_X + side * far, z), spot(x + side * 0.55, z), spot(x, z - 0.55), spot(x, FRONT_Z - 0.5)];
}

/** De route naar huis, vanaf de tegel van de ingang: door de poort, de bocht om en `far` tegels de stoep af. */
export function exitPath(side: number, far: number, lane = 0): Spot[] {
  const x = GATE_X + lane * 0.4, z = WALK_Z + 0.25 + lane * 0.3;
  return [spot(x, z - 0.55), spot(x + side * 0.55, z), spot(GATE_X + side * far, z)];
}

/** De route van de schoolklas: van de deur van de bus (die staat dan bij de halte) schuin over de stoep en door de poort. */
export function busPath(): Spot[] {
  const x = GATE_X + 0.1;
  return [spot(STOP_NOSE + BUS_LEN / 2 - BUS_DOOR, LANE_NEAR - 0.55), spot(x + 0.5, WALK_Z + 0.4), spot(x, WALK_Z - 0.4), spot(x, FRONT_Z - 0.5)];
}

/** Het stuk stoep waar een gast die al op het pleintje was weer op terug moet (als het park ineens dicht is). */
export const pavementY = (): number => WALK_Z + 0.25 + H / 2;

/** Voor de bomen rond het park (zie view.ts): voor het park staat er geen een, daar ligt de weg. */
export const roadside = (gy: number): boolean => gy > H + 0.3;

// ------------------------------------------------------------ kleine hulpjes om vormen te maken
const box = (w: number, h: number, d: number, x: number, y: number, z: number): Geo => new THREE.BoxGeometry(w, h, d).translate(x, y, z);
/** Een plat vlak op de grond: `w` breed (langs x) en `d` diep (langs z). */
const flat = (w: number, d: number, x: number, y: number, z: number): Geo => new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2).translate(x, y, z);
/** Een schijf die rechtop staat, met zijn as langs x: een wiel. */
const disc = (r: number, wide: number, sides: number, x = 0): Geo => new THREE.CylinderGeometry(r, r, wide, sides).rotateZ(Math.PI / 2).translate(x, 0, 0);
const paint = (geo: Geo, hex: number): Geo => {
  const c = new THREE.Color(hex), n = geo.getAttribute('position').count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    a[i * 3] = c.r;
    a[i * 3 + 1] = c.g;
    a[i * 3 + 2] = c.b;
  }
  return geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
};
const merge = (geos: Geo[]): Geo => mergeGeometries(geos.some(g => !g.index) ? geos.map(g => (g.index ? g.toNonIndexed() : g)) : geos)!;
/** Vormen in verschillende kleuren als één onderdeel: elk rijtje begint met zijn kleur. */
const painted = (...groups: Tinted[]): Geo => merge(groups.flatMap(([hex, ...geos]) => geos.map(g => paint(g, hex))));

const PAINT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 });
const MATTE = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 });
/** Koplampen en achterlichten in het donker: die geven zelf licht. */
const GLOW = new THREE.MeshBasicMaterial({ vertexColors: true });
/** De lantaarns langs de weg: gloeien feller naarmate het donkerder is. */
const LAMP = new THREE.MeshStandardMaterial({ color: 0xfff1c4, emissive: 0xffc860, emissiveIntensity: 0.25, roughness: 0.6 });

const SKIN = [0xf6cfa6, 0xe8b48a, 0xc98d5e, 0xa86b42, 0x8a5637];
const SHIRT = [0xe0584f, 0x4a90e2, 0xf5a623, 0x6cc04a, 0xb06ad9, 0x2bb5a8, 0xf06aa6, 0xf4f1e8];
const PANTS = [0x3d4f7a, 0x5a4636, 0x38343c, 0x6b7a4a];
const HAIR = [0x2b1b14, 0x7a4a22, 0xd9a520, 0xd9532b, 0x9aa0a6];
const GLASS = 0xbfe3f5, TYRE = 0x3d4f5a, HUB = 0xb9c2c9, HEAD = 0xfff3b0, TAIL = 0xe0453a, STEEL = 0x8f98a0;

// ------------------------------------------------------------ auto, bus en vrachtwagen (neus naar +z)
/** Twee wielen op één as (de as ligt langs x). Het streepje over de naaf laat zien dat ze draaien. */
const axleGeo = (r: number, wide: number, half: number): Geo =>
  painted(
    [TYRE, disc(r, wide, 12, -half), disc(r, wide, 12, half)],
    [HUB, disc(r * 0.52, wide + 0.02, 8, -half), disc(r * 0.52, wide + 0.02, 8, half)],
    [0x6f7b85, box(wide + 0.035, r * 0.22, r * 0.9, -half, 0, 0), box(wide + 0.035, r * 0.22, r * 0.9, half, 0, 0)],
  );
const CAR_AXLE = axleGeo(0.15, 0.11, 0.3);
const BIG_AXLE = axleGeo(0.19, 0.14, 0.37);

/** Koplampen (geel) en achterlichten (rood) als los onderdeel dat in het donker oplicht. */
const glowGeo = (half: number, y: number, front: number, back: number): Geo =>
  painted(
    [0xfff6c9, box(0.17, 0.11, 0.04, -half, y, front), box(0.17, 0.11, 0.04, half, y, front)],
    [0xff5a4a, box(0.14, 0.08, 0.04, -half, y, back), box(0.14, 0.08, 0.04, half, y, back)],
  );

/** Een kleine auto in één kleur; `long`: met een langere kap, zoals een stationwagen. */
function carBody(color: number, long: boolean): Geo {
  const cz = long ? -0.16 : -0.06, cl = long ? 0.88 : 0.66;
  return painted(
    [color,
      box(0.66, 0.25, 1.36, 0, 0.275, 0),
      box(0.6, 0.05, cl + 0.04, 0, 0.665, cz),
      ...[-1, 1].flatMap(x => [-1, 1].map(z => box(0.05, 0.24, 0.05, x * 0.265, 0.52, cz + z * (cl / 2 - 0.015)))),
    ],
    [GLASS, box(0.56, 0.24, cl, 0, 0.52, cz)],
    [0xdfe5ea, box(0.68, 0.07, 0.07, 0, 0.2, 0.67), box(0.68, 0.07, 0.07, 0, 0.2, -0.67)],
    [HEAD, box(0.14, 0.08, 0.03, -0.2, 0.31, 0.682), box(0.14, 0.08, 0.03, 0.2, 0.31, 0.682)],
    [TAIL, box(0.14, 0.07, 0.03, -0.2, 0.31, -0.682), box(0.14, 0.07, 0.03, 0.2, 0.31, -0.682)],
    [TYRE, box(0.5, 0.06, 1.2, 0, 0.14, 0)],
  );
}

/** De gele schoolbus: open ramen met in elk raam een kinderhoofd, voorin de chauffeur. De deur zit rechts (-x). */
function busBody(): Geo {
  const yellow = 0xf7c531;
  const heads: Tinted[] = [];
  [-1.08, -0.62, -0.16, 0.3].forEach((z, i) => [-0.2, 0.2].forEach((x, j) => {
    const k = i * 2 + j;
    heads.push(
      [SKIN[(k * 2 + 1) % SKIN.length], box(0.15, 0.15, 0.15, x, 0.76, z)],
      [HAIR[(k * 3 + 1) % HAIR.length], box(0.165, 0.06, 0.165, x, 0.855, z)],
      [SHIRT[(k * 5 + 2) % SHIRT.length], box(0.2, 0.13, 0.12, x, 0.62, z)],
    );
  }));
  return painted(
    [yellow,
      box(0.84, 0.38, 2.7, 0, 0.37, 0),
      // het dak, de stijlen tussen de ramen en de achterwand
      box(0.86, 0.08, 2.34, 0, 0.99, -0.2),
      ...[-1.32, -0.85, -0.39, 0.07, 0.53, 0.92].flatMap(z => [box(0.06, 0.4, 0.06, -0.39, 0.76, z), box(0.06, 0.4, 0.06, 0.39, 0.76, z)]),
      box(0.84, 0.4, 0.06, 0, 0.76, -1.32),
    ],
    // de zwarte streep van een schoolbus, de grille en de bumpers
    [0x3a3f45, box(0.855, 0.045, 2.71, 0, 0.43, 0), box(0.3, 0.12, 0.02, 0, 0.42, 1.352)],
    [TYRE, box(0.88, 0.1, 0.08, 0, 0.23, 1.36), box(0.88, 0.1, 0.08, 0, 0.23, -1.36), box(0.7, 0.06, 2.5, 0, 0.17, 0)],
    [0xe0a81e, box(0.02, 0.3, 0.3, -0.425, 0.36, 0.72)],
    [GLASS, box(0.72, 0.36, 0.04, 0, 0.76, 0.94), box(0.5, 0.22, 0.02, 0, 0.78, -1.355)],
    [HEAD, box(0.15, 0.1, 0.03, -0.27, 0.42, 1.352), box(0.15, 0.1, 0.03, 0.27, 0.42, 1.352)],
    [TAIL, box(0.13, 0.08, 0.03, -0.29, 0.42, -1.352), box(0.13, 0.08, 0.03, 0.29, 0.42, -1.352)],
    // oranje lampjes boven de voorruit
    [0xf08a24, box(0.1, 0.05, 0.04, -0.25, 1.0, 0.975), box(0.1, 0.05, 0.04, 0.25, 1.0, 0.975)],
    // de chauffeur zit links, met een pet op
    [SKIN[1], box(0.17, 0.17, 0.17, 0.2, 0.78, 0.7)],
    [0x3d4f7a, box(0.2, 0.14, 0.13, 0.2, 0.63, 0.7), box(0.19, 0.05, 0.22, 0.2, 0.885, 0.72)],
    ...heads,
  );
}

/** De vrachtwagen van het plaatje: een oranje laadbak met twee donkere strepen en een blauwe cabine. */
function truckBody(): Geo {
  return painted(
    [0x5a6670, box(0.72, 0.1, 2.5, 0, 0.23, 0.02)],
    [0xf08a24, box(0.86, 0.84, 1.62, 0, 0.7, -0.42)],
    [0xc96f14, box(0.875, 0.06, 1.3, 0, 0.84, -0.42), box(0.875, 0.06, 1.3, 0, 0.6, -0.42), box(0.03, 0.7, 0.015, 0, 0.7, -1.236)],
    // de cabine en de korte neus
    [0x4a90e2, box(0.8, 0.62, 0.52, 0, 0.59, 0.72), box(0.8, 0.3, 0.26, 0, 0.43, 1.1)],
    [0xd6ecfb, box(0.68, 0.24, 0.03, 0, 0.74, 0.985), box(0.815, 0.22, 0.3, 0, 0.74, 0.76)],
    [HUB, box(0.84, 0.09, 0.06, 0, 0.25, 1.25)],
    [HEAD, box(0.14, 0.09, 0.03, -0.26, 0.44, 1.235), box(0.14, 0.09, 0.03, 0.26, 0.44, 1.235)],
    [TAIL, box(0.12, 0.07, 0.03, -0.26, 0.44, -1.24), box(0.12, 0.07, 0.03, 0.26, 0.44, -1.24)],
  );
}

interface Vehicle {
  group: THREE.Group;
  axles: THREE.Mesh[];
  /** De lampen die in het donker aan gaan. */
  glow: THREE.Mesh;
  /** Hoe groot de wielen zijn, en hoe lang hij is. */
  r: number;
  len: number;
  active: boolean;
  lane: number;
  dir: number;
  x: number;
  v: number;
  cruise: number;
  /** 0 = rijdt door, 1 = moet nog stoppen bij de poort, 2 = staat stil, 3 = is weer op weg. */
  halt: number;
  wait: number;
  /** Zo lang blijft hij bij de poort staan. */
  stay: number;
  /** De plek van zijn koplampen, voor het donkere vlak van de nacht. */
  light: Light;
}

function makeVehicle(scene: THREE.Scene, body: Geo, glow: Geo, axle: Geo, r: number, axleZ: number[], len: number, stay = 0): Vehicle {
  const group = new THREE.Group();
  const shell = new THREE.Mesh(body, PAINT);
  shell.castShadow = true;
  const lamps = new THREE.Mesh(glow, GLOW);
  lamps.visible = false;
  const axles = axleZ.map(z => {
    const mesh = new THREE.Mesh(axle, PAINT);
    mesh.position.set(0, r, z);
    return mesh;
  });
  group.add(shell, lamps, ...axles);
  group.visible = false;
  scene.add(group);
  return { group, axles, glow: lamps, r, len, active: false, lane: 0, dir: 1, x: 0, v: 0, cruise: 0, halt: 0, wait: 0, stay, light: { gx: 0, gy: 0, r: 1.9 } };
}

// ------------------------------------------------------------ wandelaars, fietsers en kinderen op een step (neus naar +z)
const WALKER = 0, KID = 1, CYCLIST = 2, STEPPER = 3;
const LEG_GEOS = PANTS.map(c => paint(box(0.075, 0.2, 0.08, 0, -0.1, 0), c));
const PEDAL_GEOS = PANTS.map(c => paint(box(0.075, 0.26, 0.08, 0, -0.13, 0), c));
const BIKE_WHEEL = painted([0x38343c, disc(0.17, 0.035, 12)], [0xcfd6dc, disc(0.125, 0.04, 10)], [0x7a858f, box(0.045, 0.03, 0.22, 0, 0, 0)]);

/** Het frame van een fiets, zonder wielen: de naven zitten op z = -0.27 en z = 0.27, het zadel op 0,44 hoog. */
const bikeFrame = (color: number): Tinted[] => [
  [color,
    box(0.03, 0.03, 0.36, 0, 0.38, 0.03),
    box(0.03, 0.26, 0.03, 0, 0.29, -0.13),
    new THREE.BoxGeometry(0.03, 0.03, 0.36).rotateX(-0.55).translate(0, 0.275, 0.05),
    new THREE.BoxGeometry(0.03, 0.27, 0.03).rotateX(-0.3).translate(0, 0.29, 0.235),
    box(0.03, 0.03, 0.2, 0, 0.17, -0.19),
    box(0.03, 0.1, 0.03, 0, 0.45, 0.19),
  ],
  [0x38343c, box(0.09, 0.035, 0.15, 0, 0.435, -0.14), box(0.26, 0.03, 0.03, 0, 0.5, 0.19)],
];
/** Een fiets die stilstaat in het rek, met zijn voorwiel naar het park. */
const parkedBike = (color: number, x: number, z: number): Geo =>
  merge([painted(...bikeFrame(color)), BIKE_WHEEL.clone().translate(0, 0.17, 0.27), BIKE_WHEEL.clone().translate(0, 0.17, -0.27)]).rotateY(Math.PI).translate(x, 0, z);

interface Figure {
  group: THREE.Group;
  kind: number;
  /** Benen die heen en weer gaan, en wielen die draaien. */
  swing: THREE.Mesh[];
  wheels: THREE.Mesh[];
  size: number;
  active: boolean;
  x: number;
  z: number;
  speed: number;
  phase: number;
  /** De route: hooguit drie punten (x, z), hoeveel het er zijn en bij welk punt hij nu is. Aan het eind is hij uit beeld. */
  route: Float32Array;
  steps: number;
  step: number;
  fresh: boolean;
}

function makeFigure(scene: THREE.Scene, kind: number, n: number): Figure {
  const group = new THREE.Group();
  const skin = SKIN[n % SKIN.length], shirt = SHIRT[(n * 3 + kind) % SHIRT.length], pants = (n + kind) % PANTS.length, hair = HAIR[(n * 2 + kind) % HAIR.length];
  const swing: THREE.Mesh[] = [], wheels: THREE.Mesh[] = [];
  const limb = (geo: Geo, x: number, y: number, z: number, list: THREE.Mesh[]): void => {
    const mesh = new THREE.Mesh(geo, PAINT);
    mesh.position.set(x, y, z);
    list.push(mesh);
    group.add(mesh);
  };
  let body: Geo, size = 1;
  if (kind === CYCLIST) {
    const helmet = n % 2 === 0;
    body = painted(
      ...bikeFrame(SHIRT[(n * 5 + 1) % SHIRT.length]),
      [shirt, new THREE.BoxGeometry(0.2, 0.22, 0.13).rotateX(0.3).translate(0, 0.56, -0.07), box(0.055, 0.055, 0.26, -0.13, 0.57, 0.08), box(0.055, 0.055, 0.26, 0.13, 0.57, 0.08)],
      [skin, box(0.17, 0.17, 0.17, 0, 0.76, 0)],
      [helmet ? 0xf4f1e8 : hair, box(0.185, helmet ? 0.09 : 0.07, 0.185, 0, helmet ? 0.865 : 0.855, 0)],
    );
    limb(BIKE_WHEEL, 0, 0.17, 0.27, wheels);
    limb(BIKE_WHEEL, 0, 0.17, -0.27, wheels);
    limb(PEDAL_GEOS[pants], 0.07, 0.44, -0.1, swing);
    limb(PEDAL_GEOS[pants], -0.07, 0.44, -0.1, swing);
    size = 1 + (n % 3) * 0.04;
  } else if (kind === STEPPER) {
    body = painted(
      // de step: een plank op twee wieltjes met een stuur
      [SHIRT[(n * 3 + 5) % SHIRT.length], box(0.1, 0.03, 0.46, 0, 0.075, 0), box(0.025, 0.46, 0.025, 0, 0.3, 0.22)],
      [0x38343c, disc(0.055, 0.03, 8).translate(0, 0.055, 0.24), disc(0.055, 0.03, 8).translate(0, 0.055, -0.24), box(0.24, 0.025, 0.025, 0, 0.53, 0.22)],
      // het kind: één been op de plank, een helm op
      [PANTS[pants], box(0.075, 0.2, 0.08, 0.035, 0.19, 0)],
      [shirt, box(0.2, 0.22, 0.13, 0, 0.4, 0), box(0.055, 0.055, 0.22, -0.125, 0.47, 0.11), box(0.055, 0.055, 0.22, 0.125, 0.47, 0.11)],
      [skin, box(0.17, 0.17, 0.17, 0, 0.595, 0)],
      [SHIRT[(n * 3 + 2) % SHIRT.length], box(0.19, 0.08, 0.19, 0, 0.7, 0)],
    );
    limb(LEG_GEOS[pants], -0.045, 0.29, 0, swing);
    size = 0.8;
  } else {
    const child = kind === KID;
    const parts: Tinted[] = [
      [shirt, box(0.2, 0.22, 0.13, 0, 0.31, 0), box(0.055, 0.18, 0.07, -0.13, 0.32, 0), box(0.055, 0.18, 0.07, 0.13, 0.32, 0)],
      [skin, box(0.17, 0.17, 0.17, 0, 0.505, 0)],
      [hair, box(0.185, 0.07, 0.185, 0, 0.6, 0)],
    ];
    // een kind draagt een rugzak
    if (child) parts.push([SHIRT[(n * 3 + 4) % SHIRT.length], box(0.15, 0.17, 0.07, 0, 0.32, -0.1)]);
    body = painted(...parts);
    limb(LEG_GEOS[pants], 0.052, 0.2, 0, swing);
    limb(LEG_GEOS[pants], -0.052, 0.2, 0, swing);
    size = child ? 0.72 : 1 + (n % 4) * 0.035;
  }
  const mesh = new THREE.Mesh(body, PAINT);
  mesh.castShadow = true;
  group.add(mesh);
  // een gezichtje voor het hoofd (zie faces.ts); wie loopt of stept als kind, krijgt een kindergezicht
  const face = soloFace(skin, randomFace(kind === KID || kind === STEPPER));
  if (face) {
    face.position.y = kind === CYCLIST ? 0.76 : kind === STEPPER ? 0.595 : 0.505;
    group.add(face);
  }
  group.visible = false;
  scene.add(group);
  return { group, kind, swing, wheels, size, active: false, x: 0, z: 0, speed: 1, phase: n, route: new Float32Array(6), steps: 0, step: 0, fresh: false };
}

// ------------------------------------------------------------ wat er stilstaat: de weg zelf, de halte en het rek
/** Alles wat plat op de grond ligt: asfalt, stoep, fietspad, het pleintje voor de poort, de strepen en het zebrapad. */
function groundGeo(): Geo {
  const asphalt: Geo[][] = [[], []], bike: Geo[][] = [[], []], slabs: Geo[][] = [[], []], court: Geo[][] = [[], []];
  for (let i = 0; i < END; i++) {
    const x = -END + 1 + i * 2;
    asphalt[i % 2].push(flat(2, ROAD_W, x, 0.012, ROAD_Z));
    bike[i % 2].push(flat(2, BIKE_W, x, 0.013, BIKE_Z));
  }
  for (let i = 0; i < END * 2; i++) {
    const x = -END + 0.5 + i;
    slabs[i % 2].push(flat(1, PAVE_W, x, 0.014, PAVE_Z));
    slabs[(i + 1) % 2].push(flat(1, FAR_W, x, 0.014, FAR_Z));
  }
  // het pleintje van de poort naar de stoep, in de kleur van een pad; ernaast een stukje stoep voor de halte en het rek
  for (let i = -1; i <= 1; i++) court[(i + 1) % 2].push(flat(1, 1.2, GATE_X + i, 0.014, FRONT_Z + 0.6));
  slabs[0].push(flat(2.2, 0.85, GATE_X + 3, 0.014, FRONT_Z + 0.775), flat(2.2, 0.85, GATE_X - 2.6, 0.014, FRONT_Z + 0.775));
  const lines: Geo[] = [];
  // de streepjes in het midden (niet over het zebrapad) en de balken van het zebrapad
  for (let x = -END + 0.8; x < END; x += 1.6) if (Math.abs(x - GATE_X) > 1.3) lines.push(flat(0.7, 0.07, x, 0.02, ROAD_Z));
  for (let k = 0; k < 6; k++) lines.push(flat(1.5, 0.25, GATE_X, 0.022, ROAD_Z - ROAD_W / 2 + (k + 0.5) * (ROAD_W / 6)));
  // de stoeprand langs de rijbaan, met een opening bij het zebrapad
  const side = END - GATE_X - 0.9, other = END + GATE_X - 0.9;
  return painted(
    [0x666d77, ...asphalt[0]], [0x5f6670, ...asphalt[1]],
    [0xc9604a, ...bike[0]], [0xbf5843, ...bike[1]],
    [0xd9d6cd, ...slabs[0]], [0xcdc9be, ...slabs[1]],
    [0xd8c7ab, ...court[0]], [0xcdbb9d, ...court[1]],
    [0xf4f1e8, ...lines],
    [0xbfc4c9,
      box(side, 0.05, 0.2, GATE_X + 0.9 + side / 2, 0.025, KERB_Z), box(other, 0.05, 0.2, GATE_X - 0.9 - other / 2, 0.025, KERB_Z),
      box(END * 2, 0.05, 0.1, 0, 0.025, ROAD_Z + ROAD_W / 2 + 0.05),
    ],
  );
}

/** Alles wat rechtop staat: het bord van de bushalte, het wachthuisje, het fietsenrek en de palen van de lantaarns. */
function solidGeo(lampX: number[]): Geo {
  const sx = GATE_X + 3, sz = FRONT_Z + 0.5, signX = STOP_NOSE - 0.2;
  return merge([
    painted(
      // het haltebord: een blauw bord met een geel busje
      [STEEL, box(0.06, 1.3, 0.06, signX, 0.65, KERB_Z), ...lampX.flatMap(x => [box(0.08, 1.9, 0.08, x, 0.95, KERB_Z), box(0.06, 0.06, 0.5, x, 1.9, KERB_Z + 0.22)])],
      [0x4a90e2, box(0.5, 0.38, 0.05, signX, 1.4, KERB_Z)],
      [0xf7c531, box(0.3, 0.15, 0.07, signX, 1.42, KERB_Z)],
      [TYRE, box(0.07, 0.07, 0.08, signX - 0.08, 1.33, KERB_Z), box(0.07, 0.07, 0.08, signX + 0.08, 1.33, KERB_Z)],
      // het wachthuisje: een wand van glas, vier palen, een rood dak en een bankje
      [GLASS, box(1.8, 0.75, 0.04, sx, 0.62, sz)],
      [0x5a6670, ...[-0.88, 0.88].flatMap(x => [box(0.06, 1.08, 0.06, sx + x, 0.54, sz), box(0.06, 1.08, 0.06, sx + x, 0.54, sz + 0.6)])],
      [0xc0523f, box(2, 0.07, 0.85, sx, 1.11, sz + 0.3)],
      [0xc58a4b, box(1.3, 0.05, 0.24, sx, 0.3, sz + 0.2), box(0.06, 0.28, 0.2, sx - 0.5, 0.14, sz + 0.2), box(0.06, 0.28, 0.2, sx + 0.5, 0.14, sz + 0.2)],
      // het fietsenrek: een stang op drie pootjes
      [STEEL, box(1.7, 0.04, 0.04, RACK_X - 0.5, 0.34, FRONT_Z + 0.5), ...[-1.3, -0.25, 0.3].map(x => box(0.04, 0.34, 0.04, RACK_X + x, 0.17, FRONT_Z + 0.5))],
    ),
    parkedBike(0xe0584f, RACK_X - 1, FRONT_Z + 0.78),
    parkedBike(0x2bb5a8, RACK_X - 0.5, FRONT_Z + 0.78),
  ]);
}

// ------------------------------------------------------------ de weg
export class Road {
  private vehicles: Vehicle[] = [];
  private cars: Vehicle[] = [];
  private bus: Vehicle;
  private truck: Vehicle;
  private figures: Figure[] = [];
  /** Per rijbaan: over hoeveel seconden de volgende auto komt. */
  private laneIn = [4, 9];
  private figureIn = 3;
  private busDue = false;
  private truckDue = false;
  private clock = 0;
  private night = 0;
  private lampLights: Light[];

  constructor(scene: THREE.Scene) {
    const lampX = [GATE_X - 3.5, GATE_X + 5.2];
    const ground = new THREE.Mesh(groundGeo(), MATTE);
    ground.receiveShadow = true;
    const solid = new THREE.Mesh(solidGeo(lampX), MATTE);
    solid.castShadow = true;
    solid.receiveShadow = true;
    const lamps = new THREE.Mesh(mergeGeometries(lampX.map(x => box(0.18, 0.08, 0.28, x, 1.85, KERB_Z + 0.42)))!, LAMP);
    scene.add(ground, solid, lamps);
    this.lampLights = lampX.map(x => ({ gx: x + W / 2, gy: LANE_NEAR + H / 2, r: 3.6 }));

    const carGlow = glowGeo(0.2, 0.31, 0.69, -0.69);
    [0xe0584f, 0x4a90e2, 0xf5c33b, 0x6cc04a, 0xf06aa6, 0xf4f1e8].forEach((color, i) => {
      this.cars.push(makeVehicle(scene, carBody(color, i % 2 === 1), carGlow, CAR_AXLE, 0.15, [0.42, -0.42], 1.4));
    });
    this.bus = makeVehicle(scene, busBody(), glowGeo(0.27, 0.42, 1.36, -1.36), BIG_AXLE, 0.19, [0.82, -0.82], BUS_LEN, 12);
    this.truck = makeVehicle(scene, truckBody(), glowGeo(0.26, 0.44, 1.245, -1.245), BIG_AXLE, 0.19, [0.95, -0.8], 2.6, 15);
    this.vehicles = [...this.cars, this.bus, this.truck];

    for (let n = 0; n < 6; n++) this.figures.push(makeFigure(scene, WALKER, n), makeFigure(scene, KID, n));
    for (let n = 0; n < 3; n++) this.figures.push(makeFigure(scene, CYCLIST, n));
    for (let n = 0; n < 2; n++) this.figures.push(makeFigure(scene, STEPPER, n));

    // bij het begin rijdt er al een auto op elke baan
    for (let lane = 0; lane < 2; lane++) {
      const car = this.cars[lane * 3];
      if (this.enter(car, lane, 3.2)) car.x = (Math.random() - 0.5) * END;
    }
  }

  /**
   * De schoolbus komt: hij stopt een poosje bij de poort en rijdt dan weer weg. Zodra hij stilstaat (`busStopped`)
   * stapt de echte klas uit: dat regelt het spel (zie GuestManager.spawnClass en `busPath`).
   */
  callBus(): void {
    if (!this.bus.active) this.busDue = true;
  }

  /** De vrachtwagen komt: hij staat een poosje stil bij de poort en rijdt dan weer weg. */
  callTruck(): void {
    if (!this.truck.active) this.truckDue = true;
  }

  busStopped(): boolean {
    return this.bus.active && this.bus.halt === 2;
  }

  truckStopped(): boolean {
    return this.truck.active && this.truck.halt === 2;
  }

  /** Zet de lichten van de weg bij de andere lichten van de nacht: de lantaarns en de koplampen. */
  lights(list: Light[]): void {
    for (const l of this.lampLights) list.push(l);
    for (const v of this.vehicles) if (v.active && Math.abs(v.x) < END) list.push(v.light);
  }

  /** Elk beeldje; `night`: 0 = dag, 1 = nacht. 's Nachts is het stil op de weg en branden de lampen. */
  update(dt: number, night: number): void {
    if (dt > 0.1) dt = 0.1;
    this.clock += dt;
    if (night !== this.night) {
      this.night = night;
      LAMP.emissiveIntensity = 0.25 + 2.2 * night;
    }
    const calm = 1 + 2.5 * night;
    for (let lane = 0; lane < 2; lane++) {
      this.laneIn[lane] -= dt;
      // de bus en de vrachtwagen komen over de baan langs het park, en gaan voor
      if (lane === 0 && (this.busDue || this.truckDue)) {
        const v = this.busDue ? this.bus : this.truck;
        if (this.enter(v, 0, v === this.bus ? 4 : 3.7)) {
          v.halt = 1;
          if (v === this.bus) this.busDue = false;
          else this.truckDue = false;
        }
        continue;
      }
      if (this.laneIn[lane] > 0) continue;
      const car = this.freeCar();
      this.laneIn[lane] = car && this.enter(car, lane, 3 + Math.random() * 0.8) ? (12 + Math.random() * 18) * calm : 1.5;
    }
    this.figureIn -= dt;
    if (this.figureIn <= 0) {
      this.figureIn = (7 + Math.random() * 8) * (1 + 3 * night);
      // midden in de nacht komt er niemand meer aan
      if (night < 0.75) this.arrive();
    }
    for (const v of this.vehicles) if (v.active) this.drive(v, dt);
    for (const f of this.figures) if (f.active) this.walk(f, dt);
  }

  private freeCar(): Vehicle | null {
    const n = this.cars.length, from = Math.floor(Math.random() * n);
    for (let i = 0; i < n; i++) if (!this.cars[(from + i) % n].active) return this.cars[(from + i) % n];
    return null;
  }

  /** Zet een voertuig aan het begin van zijn baan, voorbij de rand van de wereld. Lukt niet als daar nog iemand rijdt. */
  private enter(v: Vehicle, lane: number, cruise: number): boolean {
    const dir = lane === 0 ? -1 : 1, x = -dir * (END + v.len / 2 + 0.3);
    for (const o of this.vehicles) if (o.active && o.lane === lane && (o.x - x) * dir - (o.len + v.len) / 2 < 1.2) return false;
    v.active = true;
    v.lane = lane;
    v.dir = dir;
    v.x = x;
    v.v = v.cruise = cruise;
    v.halt = 0;
    v.wait = 0;
    v.group.visible = true;
    v.group.position.set(x, 0, lane === 0 ? LANE_NEAR : LANE_FAR);
    v.group.rotation.y = (dir * Math.PI) / 2;
    return true;
  }

  private drive(v: Vehicle, dt: number): void {
    let want = v.cruise;
    // niet tegen de voorganger aan: wie achter een stilstaande bus rijdt, wacht
    for (const o of this.vehicles) {
      if (o === v || !o.active || o.lane !== v.lane) continue;
      const ahead = (o.x - v.x) * v.dir;
      if (ahead > 0) want = Math.min(want, Math.max(0, (ahead - (o.len + v.len) / 2 - 0.45) * 1.6));
    }
    if (v.halt === 1) {
      const d = (STOP_NOSE + v.len / 2 - v.x) * v.dir;
      if (d <= 0.04) {
        v.halt = 2;
        v.wait = v.stay;
        // de deur van de bus gaat sissend open
        if (v === this.bus) sfx('road.busdoor', { volume: 0.3, at: [v.x - BUS_DOOR + W / 2, LANE_NEAR + H / 2] });
      } else want = Math.min(want, Math.max(0.5, d * 1.6));
    }
    if (v.halt === 2) {
      want = 0;
      v.v = 0;
      v.wait -= dt;
      if (v.wait <= 0) v.halt = 3;
    }
    v.v = want > v.v ? Math.min(want, v.v + 1.8 * dt) : Math.max(want, v.v - 7 * dt);
    // een auto die de poort nadert, hoor je zachtjes voorbijkomen (niet elke: het blijft rustig bij de poort)
    const near = GATE_X - v.dir * 3, was = v.x;
    v.x += v.v * v.dir * dt;
    if (v.halt === 0 && (was - near) * (v.x - near) < 0) sfx('road.car', { volume: 0.15, every: 20, at: [v.x + W / 2, v.group.position.z + H / 2] });
    if (v.x * v.dir > END + v.len / 2 + 0.3) {
      v.active = false;
      v.group.visible = false;
      return;
    }
    v.group.position.x = v.x;
    // de motor loopt: wie stilstaat, trilt een heel klein beetje
    v.group.position.y = v.halt === 2 ? Math.sin(this.clock * 28) * 0.004 : 0;
    const roll = (v.v * dt) / v.r;
    for (const axle of v.axles) axle.rotation.x += roll;
    v.glow.visible = this.night > 0.2;
    v.light.gx = v.x + v.dir + W / 2;
    v.light.gy = v.group.position.z + H / 2;
  }

  private free(kind: number): Figure | null {
    const n = this.figures.length, from = Math.floor(Math.random() * n);
    for (let i = 0; i < n; i++) {
      const f = this.figures[(from + i) % n];
      if (!f.active && f.kind === kind) return f;
    }
    return null;
  }

  /** Zet een figuur neer aan het eind van de weg; daarna krijgt hij met `to` zijn route. */
  private start(f: Figure, x: number, z: number, speed: number): void {
    f.active = f.fresh = true;
    f.x = x;
    f.z = z;
    f.speed = speed;
    f.steps = f.step = 0;
    f.group.visible = true;
    f.group.scale.setScalar(f.size);
    f.group.position.set(x, 0, z);
  }

  private to(f: Figure, x: number, z: number): void {
    f.route[f.steps * 2] = x;
    f.route[f.steps * 2 + 1] = z;
    f.steps++;
  }

  /**
   * Er komt iemand voorbij, van de ene kant van de weg naar de andere: te voet (soms met een kind), op de fiets of op
   * de step. Niemand van hen gaat naar de poort: wie naar het park komt, is een echte gast (zie people.ts).
   */
  private arrive(): void {
    const s = Math.random() < 0.5 ? 1 : -1, from = s * (END + 0.6), pick = Math.random();
    if (pick < 0.4) {
      const f = this.free(WALKER);
      if (!f) return;
      // aan de kant van de straat lopen: de kant van het park is voor de gasten die naar de poort gaan
      const speed = 0.85 + Math.random() * 0.2, z = WALK_Z + 0.3 + Math.random() * 0.15;
      this.start(f, from, z, speed);
      this.to(f, -from, z);
      const kid = Math.random() < 0.4 ? this.free(KID) : null;
      if (!kid) return;
      this.start(kid, from + s * 0.35, z - 0.3, speed);
      this.to(kid, -from - s * 0.35, z - 0.3);
    } else if (pick < 0.78) {
      const f = this.free(CYCLIST);
      if (!f) return;
      // rechts houden op het fietspad
      const z = BIKE_Z - s * 0.18;
      this.start(f, from, z, 2 + Math.random() * 0.5);
      this.to(f, -from, z);
    } else {
      const f = this.free(STEPPER);
      if (!f) return;
      this.start(f, from, STEP_Z, 1.5 + Math.random() * 0.3);
      this.to(f, -from, STEP_Z);
    }
  }

  private walk(f: Figure, dt: number): void {
    const g = f.group;
    const dx = f.route[f.step * 2] - f.x, dz = f.route[f.step * 2 + 1] - f.z, d = Math.hypot(dx, dz), go = f.speed * dt;
    const was = f.x;
    if (d <= go) {
      f.x += dx;
      f.z += dz;
      if (++f.step >= f.steps) {
        // voorbij de rand van de wereld: uit beeld
        f.active = false;
        g.visible = false;
        f.step = f.steps - 1;
      }
    } else {
      f.x += (dx / d) * go;
      f.z += (dz / d) * go;
      const want = Math.atan2(dx, dz);
      if (f.fresh) g.rotation.y = want;
      else {
        // rustig de bocht om, langs de kortste kant
        const turn = Math.atan2(Math.sin(want - g.rotation.y), Math.cos(want - g.rotation.y)), max = 7 * dt;
        g.rotation.y += turn > max ? max : turn < -max ? -max : turn;
      }
      f.fresh = false;
    }
    g.position.x = f.x;
    g.position.z = f.z;
    if (f.kind === CYCLIST) {
      // een fietser die bij de poort aankomt, belt af en toe even (één keer, een paar tegels ervoor)
      if (Math.abs(was - GATE_X) > BELL_AT && Math.abs(f.x - GATE_X) <= BELL_AT && Math.random() < 0.6) sfx('road.bell', { volume: 0.25, every: 15, at: [f.x + W / 2, f.z + H / 2] });
      // de wielen draaien en de benen trappen om de beurt
      f.phase += dt * f.speed * 3.2;
      const roll = (f.speed * dt) / (0.17 * f.size), push = Math.sin(f.phase) * 0.4;
      f.wheels[0].rotation.x += roll;
      f.wheels[1].rotation.x += roll;
      f.swing[0].rotation.x = -0.55 + push;
      f.swing[1].rotation.x = -0.55 - push;
    } else if (f.kind === STEPPER) {
      // één been stept
      f.phase += dt * 6.5;
      f.swing[0].rotation.x = 0.25 + Math.sin(f.phase) * 0.5;
    } else {
      f.phase += dt * f.speed * 9;
      const stride = Math.sin(f.phase) * 0.55;
      f.swing[0].rotation.x = stride;
      f.swing[1].rotation.x = -stride;
      g.position.y = Math.abs(stride) * 0.02;
    }
  }
}
