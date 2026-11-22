// Gasten en verzorgers. Gasten komen binnen bij de ingang, lopen over de paden, kijken bij de dieren,
// kopen iets als ze het naar hun zin hebben en laten met een wolkje zien wat ze willen.
import * as THREE from 'three';
import { PLUSH, PRODUCTS, STALLS, type FoodId, type ShopKind } from './data';
import { Grid, H, W, tileIndex, tileXY } from './grid';
import { BUMPER_CARS, DARK_FUN, FERRIS, LOOKS, PETTING_GUESTS, PLAY, RESTAURANT_TABLES, RIDES, SUIT_COLORS, TOWER_TOP, TRAIN, bumperCar, isPath } from './data';
import { toWorldX, toWorldZ } from './view';

/** De tegel waar gasten binnenkomen en weer weggaan: midden aan de voorkant. */
export const ENTRANCE = tileIndex(Math.floor(W / 2), H - 1);

export interface ShopSpot {
  /** De linkerbovenhoek; een gebouw beslaat `size` bij `size` tegels. */
  x: number;
  y: number;
  kind: ShopKind;
  size: number;
  /**
   * Zoveel tegels beslaat het echt, van west naar oost en van noord naar zuid. Alleen bij een marktkraam is dat
   * anders dan `size`: die is 2 bij 1, of 1 bij 2 als hij een kwartslag gedraaid staat.
   */
  w?: number;
  h?: number;
  /** Wat deze kraam verkoopt (zie PRODUCTS; knuffels heten 'plush_' + soort). */
  sells: string[];
  /** De stand van de draaimolen, in radialen: wie erin zit, draait mee. */
  spin?: number;
  /** Hoe hard een speeltoestel heen en weer gaat (0 tot 1): zachtjes als er niemand op zit. */
  amp?: number;
  /** Welke plekken bezet zijn (een bit per plek): zo zitten er geen twee gasten op hetzelfde zitje. */
  used?: number;
  /**
   * Een bankje, bloembak of afvalbak staat op de rand van tegel (x, y), net als een hek, en neemt geen
   * tegel in: 'h' is de noordrand, 'v' de westrand.
   */
  edge?: 'h' | 'v';
  /** Naar welke kant het kijkt: 1 = zuid of oost, -1 = noord of west. Het spel houdt dit bij. */
  face?: number;
  /** Uit oudere spellen: de speler had het omgedraaid, het kijkt van het pad af. */
  turned?: boolean;
  /** De kant die de speler bij het neerzetten heeft gekozen (1 of -1). Staat dit er, dan draait het niet meer vanzelf. */
  set?: number;
  /** Een gebouw draait in kwartslagen: 0 = voorkant naar het zuiden, 1 = oosten, 2 = noorden, 3 = westen. */
  rot?: number;
  /** De speler heeft het gebouw zelf gedraaid: dan draait het niet meer vanzelf naar het pad. */
  manual?: boolean;
  /** Hoeveel gasten er nu geholpen worden en hoeveel er in de rij staan (het spel houdt dit elk beeldje bij). */
  busyNow?: number;
  line?: number;
  /**
   * Het gebouw in het beeld, als het er is. Bij de wc zetten de gasten in `userData.ajar` welke deur open
   * moet (een bit per deur); het beeld laat de deuren daarop open- en dichtzwaaien (zie animateShop).
   */
  mesh?: THREE.Object3D;
}

/** Waar een bankje op een rand precies staat en hoe het gedraaid is: [x, y, draaiing]. Zelfde regels als in het beeld. */
export function edgePose(shop: ShopSpot): [number, number, number] {
  const face = shop.face ?? 1;
  return shop.edge === 'h'
    ? [shop.x + 0.5, shop.y - 0.2 * face, face < 0 ? Math.PI : 0]
    : [shop.x - 0.2 * face, shop.y + 0.5, face < 0 ? -Math.PI / 2 : Math.PI / 2];
}

/** Hoeveel tegels een winkel beslaat: [van west naar oost, van noord naar zuid]. */
export const shopTiles = (shop: ShopSpot): [number, number] => [shop.w ?? shop.size, shop.h ?? shop.size];

/** Het midden van een winkel, in rastercoördinaten. */
export const shopCenter = (shop: ShopSpot): [number, number] =>
  shop.edge === 'h' ? [shop.x + 0.5, shop.y] : shop.edge === 'v' ? [shop.x, shop.y + 0.5] : [shop.x + shopTiles(shop)[0] / 2, shop.y + shopTiles(shop)[1] / 2];

/** De twee tegels aan weerszijden van iets wat op een rand staat (alleen wat binnen het park ligt). */
export function edgeSides(shop: { x: number; y: number; edge?: 'h' | 'v' }): number[] {
  const sides: [number, number][] = shop.edge === 'h' ? [[shop.x, shop.y - 1], [shop.x, shop.y]] : [[shop.x - 1, shop.y], [shop.x, shop.y]];
  return sides.filter(([x, y]) => x >= 0 && y >= 0 && x < W && y < H).map(([x, y]) => tileIndex(x, y));
}

/** Waar een gast voor naar een winkel gaat. */
export type Need = 'food' | 'drink' | 'toilet' | 'icecream' | 'balloon' | 'hat' | 'souvenir' | 'play' | 'sit' | 'look' | 'ride' | 'umbrella' | 'shelter' | 'pet';

/** Een kinderboerderij waar gasten naar binnen mogen: het pad voor het poortje, de tegel erachter en alle tegels binnen. */
export interface PetSpot {
  out: number;
  inn: number;
  region: number;
  tiles: number[];
  /** Hoeveel gasten er nu binnen zijn (de gasten houden dit bij). */
  count: number;
}

/** Iemand waar een groepje achteraan loopt: een juf met haar klas, een jarige met vriendjes, of de gids. */
export interface Leader {
  gx: number;
  gy: number;
  /** Waar de leider net liep, het nieuwste achteraan: daar lopen de volgers overheen. */
  trail: [number, number][];
  gone: boolean;
  /** Staat de leider ergens naar te kijken? Dan kijkt het groepje mee naar `face`. */
  watching: boolean;
  face: [number, number] | null;
}

/** Wat een gast wil, voor het wolkje boven zijn hoofd. `lacking`: het is er niet in het park. `product`: het ding waar hij om vraagt. */
/** Een gast zoals hij bewaard wordt: waar hij loopt, hoe het met hem gaat en wat hij draagt. */
export interface GuestSave {
  gx: number;
  gy: number;
  child: boolean;
  fun: number;
  age: number;
  stay: number;
  hunger: number;
  thirst: number;
  bladder: number;
  hat?: string;
  /** De ballon die hij vasthoudt ('' als de kleur niet vastligt). */
  balloon?: string;
}

/** `busy`: het is er wel, maar te druk: er zijn te weinig van voor zoveel gasten. */
export type GuestWish = { kind: Need | 'bored' | 'fav' | 'dark' | 'wide'; lacking: boolean; product?: string; busy?: boolean };

export interface GuestWorld {
  grid: Grid;
  shops: ShopSpot[];
  /** Is er vanaf deze padtegel iets te zien? Zo ja: hoe leuk, waar kijk je naar en welke soorten staan er. */
  viewScore(tile: number): { score: number; x: number; y: number; species: string[] } | null;
  /** Een gast staat bij de kraam. Geeft terug of hij iets koopt. `exact`: het is precies waar hij om vroeg. */
  buy(shop: ShopSpot, guest: Guest, product: string | undefined, exact: boolean): boolean;
  /** Waar gasten bij dit soort kraam nu om kunnen vragen. Leeg: er valt niets te kiezen. */
  products(kind: ShopKind): string[];
  /** Een gast kon het niet meer ophouden en deed het op het pad. */
  accident(guest: Guest, mess: 'poop' | 'pee'): void;
  /** Hoe snel gasten trek krijgen; hoger als het park net veel heeft uitgegeven. */
  demand(): number;
  /** Hoeveel gasten het park nu trekt. */
  capacity(): number;
  /** Bestaat dit soort kraam al in het spel? Zo niet, dan krijgen gasten er ook geen trek in. */
  sells(kind: ShopKind): boolean;
  /** De soorten die nu in het park wonen; een gast kiest er één als lievelingsdier. */
  parkSpecies(): string[];
  /** De gast heeft zijn lievelingsdier gezien. */
  cheer(guest: Guest): void;
  /** De gast laat afval vallen. */
  dropLitter(gx: number, gy: number): void;
  /** Ligt er afval op deze tegel? */
  litterOn(tile: number): boolean;
  /** Geluidje bij iets wat een gast doet. */
  guestSound(kind: 'flush' | 'guest.laugh' | 'toilet.pee' | 'toilet.poop' | 'guest.grumble'): void;
  /** Vraagt het level om afval op te ruimen? Dan laten gasten ook naast een afvalbak weleens iets vallen. */
  messy(): boolean;
  /** Welk deel van de gasten bij dit soort kraam geen plek vindt, omdat er te weinig van zijn (0 = genoeg). */
  busy(kind: ShopKind): number;
  /** Hoeveel blijer een gast op deze tegel wordt van versieringen in de buurt. */
  charm(tile: number): number;
  /** Is het hier nacht en staat er geen licht in de buurt? Dan ziet een gast bijna niets. */
  dark(tile: number): boolean;
  /** Hoeveel sneller gasten zin krijgen in iets van dit soort kraam: meer als een level erom vraagt. */
  craving(kind: ShopKind): number;
  /** Een gast gooit zijn afval in deze bak: de klep klappert even. */
  binned(bin: ShopSpot): void;
  /** Regent het? Wie geen paraplu heeft, wordt nat en zoekt een schuilhut. */
  raining(): boolean;
  /** Doet dit al mee in het spel ('wheels', 'petting', 'weather', ...)? */
  feature(name: string): boolean;
  /** Is het pad hier twee tegels breed? Een rolstoel of kinderwagen heeft die ruimte nodig. */
  wide(tile: number): boolean;
  /** Staat er een plattegrond vlakbij? Wie die gezien heeft, vindt zijn lievelingsdier meteen. */
  mapNear(gx: number, gy: number): boolean;
  /** Een blije gast gaat naar huis en laat een tekening achter in het gastenboek. */
  signBook(guest: Guest): void;
  /** Een gast heeft net bij de dieren gekeken (de fotograaf verkoopt hem misschien een foto). */
  watched(guest: Guest): void;
  /** Hoeveel er vanaf deze uitkijktoren te zien is: meer soorten in de buurt is leuker (0 tot 0,3). */
  towerView(shop: ShopSpot): number;
  /** Rijdt het treintje? Daarvoor zijn twee haltes aan hetzelfde pad nodig. */
  trainRuns(): boolean;
  /** De kinderboerderijen waar gasten nu naar binnen mogen. Steeds dezelfde objecten zolang er niets verandert. */
  pettingSpots(): PetSpot[];
  /** Een gast staat in de kinderboerderij: er komt een dier naar hem toe. Geeft terug waar dat dier staat. */
  petAt(spot: PetSpot, guest: Guest): [number, number] | null;
  /** Het verjaardagsgroepje is bij het speeltoestel: tijd voor slingers en taart. */
  partyAt(shop: ShopSpot, guest: Guest): void;
  /** Het verdwaalde kind is terug bij zijn papa of mama. `helped`: de speler heeft erop getikt. */
  reunited(child: Guest, parent: Guest, helped: boolean): void;
  /** De beroemde gast gaat naar huis; was hij blij, dan komen er meer gasten. */
  starLeft(guest: Guest, happy: boolean): void;
  /** Bij een heel vol park krijgt elke gast wat minder snel trek, zodat de kramen het aankunnen (1 = gewoon). */
  ease(): number;
}

// ------------------------------------------------------------ poppetje
const SKIN = [0xf6cfa6, 0xe8b48a, 0xc98d5e, 0xa86b42, 0x8a5637];
const SHIRT = [0xe0584f, 0x4a90e2, 0xf5a623, 0x6cc04a, 0xb06ad9, 0x2bb5a8, 0xf06aa6, 0xf4f1e8];
const PANTS = [0x3d4f7a, 0x5a4636, 0x38343c, 0x6b7a4a];
const HAIR = [0x2b1b14, 0x7a4a22, 0xd9a520, 0xd9532b, 0x9aa0a6];
const BODY_GEO = new THREE.BoxGeometry(0.2, 0.22, 0.13);
const HEAD_GEO = new THREE.BoxGeometry(0.17, 0.17, 0.17);
const HAIR_GEO = new THREE.BoxGeometry(0.185, 0.07, 0.185);
const CAP_GEO = new THREE.BoxGeometry(0.2, 0.06, 0.26).translate(0, 0, 0.035);
const APRON_GEO = new THREE.BoxGeometry(0.16, 0.17, 0.02);
const BALLOON_GEO = new THREE.IcosahedronGeometry(0.11, 1);
const BRIM_GEO = new THREE.CylinderGeometry(0.17, 0.17, 0.02, 10);
const CROWN_GEO = new THREE.CylinderGeometry(0.095, 0.1, 0.08, 10);
const PARTY_GEO = new THREE.ConeGeometry(0.075, 0.2, 8);
const POM_GEO = new THREE.IcosahedronGeometry(0.03, 0);
const SPIKE_GEO = new THREE.BoxGeometry(0.035, 0.05, 0.035);
const STRING_GEO = new THREE.BoxGeometry(0.012, 0.34, 0.012);
const LEG_GEO = new THREE.BoxGeometry(0.075, 0.2, 0.08).translate(0, -0.1, 0);
const ARM_GEO = new THREE.BoxGeometry(0.055, 0.18, 0.07).translate(0, -0.09, 0);
const mats = new Map<number, THREE.MeshStandardMaterial>();
const mat = (color: number): THREE.MeshStandardMaterial => {
  let m = mats.get(color);
  if (!m) mats.set(color, (m = new THREE.MeshStandardMaterial({ color, roughness: 0.9 })));
  return m;
};
const pick = <T>(list: T[]): T => list[Math.floor(Math.random() * list.length)];

interface Person {
  group: THREE.Group;
  limbs: THREE.Mesh[];
  height: number;
  child: boolean;
  /** Alles wat de kleur van het shirt heeft (armen en romp), om het pak een andere kleur te geven. */
  shirts: THREE.Mesh[];
  head: THREE.Mesh;
}

/** Een poppetje van blokjes. Een verzorger draagt groen met een pet; een verkoper de kleur van zijn kraam, een pet en een wit schort. */
function makePerson(keeper = false, outfit?: { shirt: number; hat: number }, force: { child?: boolean; shirt?: number } = {}): Person {
  const skin = mat(pick(SKIN)), shirt = mat(force.shirt ?? (outfit ? outfit.shirt : keeper ? 0x4fa35a : pick(SHIRT))), pants = mat(keeper ? 0x5a4636 : pick(PANTS));
  const part = (geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number): THREE.Mesh => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, 0);
    mesh.castShadow = true;
    return mesh;
  };
  const limbs = [part(LEG_GEO, pants, 0.052, 0.2), part(LEG_GEO, pants, -0.052, 0.2), part(ARM_GEO, shirt, 0.13, 0.41), part(ARM_GEO, shirt, -0.13, 0.41)];
  const group = new THREE.Group();
  const body = part(BODY_GEO, shirt, 0, 0.31), head = part(HEAD_GEO, skin, 0, 0.505);
  group.add(...limbs, body, head);
  group.add(keeper || outfit ? part(CAP_GEO, mat(outfit ? outfit.hat : 0x2f6e39), 0, 0.615) : part(HAIR_GEO, mat(pick(HAIR)), 0, 0.6));
  if (outfit) {
    const apron = part(APRON_GEO, mat(0xf7f4ec), 0, 0.29);
    apron.position.z = 0.07;
    group.add(apron);
  }
  const child = force.child ?? (!keeper && !outfit && Math.random() < 0.35);
  const scale = child ? 0.72 : outfit ? 1 : 1 + Math.random() * 0.12;
  group.scale.setScalar(scale);
  return { group, limbs, height: 0.66 * scale, child, shirts: [limbs[2], limbs[3], body], head };
}

// ------------------------------------------------------------ alle gasten in een paar tekenopdrachten
/**
 * Elke gast bestaat uit een stuk of acht blokjes. Los getekend kost dat per gast acht tekenopdrachten (en nog eens
 * acht voor de schaduw); bij honderd gasten hapert het spel daarvan. Daarom tekent dit alle blokjes van dezelfde
 * vorm in één keer: de poppetjes zelf staan niet in het beeld, hun plek en kleur worden elk beeldje overgenomen.
 */
class Crowd {
  private pools = new Map<THREE.BufferGeometry, { mesh: THREE.InstancedMesh; n: number; cap: number }>();
  private mat = new THREE.MeshStandardMaterial({ roughness: 0.9 });
  private m = new THREE.Matrix4();
  private c = new THREE.Color();

  constructor(private scene: THREE.Scene) {}

  begin(): void {
    for (const p of this.pools.values()) p.n = 0;
  }

  add(root: THREE.Object3D): void {
    if (!root.visible) return;
    root.updateMatrixWorld(true);
    this.walk(root);
  }

  private walk(o: THREE.Object3D): void {
    if (!o.visible) return;
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh) {
      let p = this.pools.get(mesh.geometry);
      if (!p || p.n >= p.cap) p = this.grow(mesh.geometry, p);
      p.mesh.setMatrixAt(p.n, mesh.matrixWorld);
      p.mesh.setColorAt(p.n, (mesh.material as THREE.MeshStandardMaterial).color);
      p.n++;
    }
    for (const child of o.children) this.walk(child);
  }

  /** Meer plek voor deze vorm: twee keer zoveel als eerst. */
  private grow(geo: THREE.BufferGeometry, old?: { mesh: THREE.InstancedMesh; n: number; cap: number }): { mesh: THREE.InstancedMesh; n: number; cap: number } {
    const cap = old ? old.cap * 2 : 64;
    const mesh = new THREE.InstancedMesh(geo, this.mat, cap);
    mesh.castShadow = true;
    mesh.frustumCulled = false;
    mesh.count = 0;
    if (old) {
      for (let i = 0; i < old.n; i++) {
        old.mesh.getMatrixAt(i, this.m);
        mesh.setMatrixAt(i, this.m);
        old.mesh.getColorAt(i, this.c);
        mesh.setColorAt(i, this.c);
      }
      this.scene.remove(old.mesh);
      old.mesh.dispose();
    }
    this.scene.add(mesh);
    const pool = { mesh, n: old?.n ?? 0, cap };
    this.pools.set(geo, pool);
    return pool;
  }

  end(): void {
    for (const p of this.pools.values()) {
      p.mesh.count = p.n;
      p.mesh.instanceMatrix.needsUpdate = true;
      if (p.mesh.instanceColor) p.mesh.instanceColor.needsUpdate = true;
    }
  }
}

function swing(limbs: THREE.Mesh[], amount: number): void {
  limbs[0].rotation.x = amount;
  limbs[1].rotation.x = -amount;
  limbs[2].rotation.x = -amount * 0.8;
  limbs[3].rotation.x = amount * 0.8;
}

// ------------------------------------------------------------ gast
type GuestState = 'idle' | 'walk' | 'watch' | 'buy' | 'sit' | 'accident' | 'queue';
/** Wat een gast doet terwijl hij ergens staat. */
type Act = 'wave' | 'point' | 'photo' | 'clap' | 'pet' | 'jump' | 'peer' | 'kneel' | 'call' | 'laugh';
/** Kleine dingen tussendoor: om je heen kijken, op je horloge kijken, je uitrekken, kletsen, een dansje. */
type Idle = 'look' | 'scratch' | 'watch' | 'stretch' | 'talk' | 'selfie' | 'dance' | 'tap' | 'nod' | 'shiver' | 'sway';
/** Zoveel gasten kan één kraam, wc, bankje of attractie tegelijk helpen; de rest staat in de rij. */
const AT_ONCE: Partial<Record<ShopKind, number>> = {
  toilet: 2, bench: 2, playground: 3, carousel: 4, fountain: 6, slide: 2, swing: 2, seesaw: 2, springer: 2, trampoline: 2,
  tower: 4, restaurant: 6, ferris: FERRIS.cabins, bumper: BUMPER_CARS, shelter: 6, station: 8, umbrellas: 2,
};
/** Zo lang duurt het voor een gast geholpen is. */
const SERVE_TIME: Partial<Record<ShopKind, number>> = {
  foodstall: 6, drinkstall: 6, icecream: 6, balloon: 4, hats: 4, souvenir: 4, toilet: 9, bench: 8, playground: 6, carousel: 8, fountain: 4, slide: 6, swing: 7, seesaw: 7, springer: 6, trampoline: 6,
  tower: 9, restaurant: 11, ferris: 14, bumper: 10, shelter: 4, station: 4, umbrellas: 2,
};
const WC_TIME = SERVE_TIME.toilet ?? 9, BENCH_TIME = SERVE_TIME.bench ?? 8;
/**
 * Het bezoek aan de wc. `walk`: zo lang loopt de gast naar zijn deur; `step`: zo lang duurt de stap naar binnen
 * of naar buiten; `back`: zo lang loopt hij daarna terug naar het pad. `door`: zo ver zit een deur uit het
 * midden van het gebouw; `front`: zo ver voor het midden staat de gast voor de deur; `deep`: zo ver binnen.
 */
const WC = { walk: 1.1, step: 0.9, back: 1.1, door: 0.42, front: 1.18, deep: 0.15 };
/** Zo ver (in tegels) loopt een gast hooguit om voor een bankje om even uit te rusten. */
const REST_NEAR = 8;
/** Wie dit wil, gaat niet eerst nog even op een bankje zitten. */
const PRESSING: Need[] = ['toilet', 'food', 'drink', 'umbrella', 'shelter', 'sit'];
/** Waar een gast op de wc nu staat, welke kant hij op gaat en de plek voor zijn deur; elke keer opnieuw ingevuld door `wcPose`. */
const WC_AT = { x: 0, y: 0, dx: 0, dy: 0, fx: 0, fy: 0, hidden: false, moving: false };
/** Waar een gast op of in gaat zitten of staan (in plaats van iets te kopen aan een toonbank). */
const SEATED: ShopKind[] = ['bench', ...PLAY, ...LOOKS, ...RIDES, 'restaurant', 'shelter'];
/**
 * Wie wil spelen, vindt elk speeltoestel goed; wie een ritje wil, elke attractie; wie iets moois wil zien de
 * fontein of de uitkijktoren; en in het restaurant kun je eten én drinken.
 */
const sameUse = (have: ShopKind, want: ShopKind): boolean =>
  have === want || (want === 'playground' && PLAY.includes(have)) || (want === 'carousel' && RIDES.includes(have)) || (want === 'fountain' && LOOKS.includes(have)) ||
  ((want === 'foodstall' || want === 'drinkstall') && have === 'restaurant');
/** Langer is de rij nooit; wie er dan bij wil, loopt mopperend door. Zo lang wacht een gast hooguit. */
const MAX_QUEUE = 6;
const PATIENCE = 32;
const MAX_PURCHASES = 4;
const NEED_SHOP: Record<Need, ShopKind> = {
  food: 'foodstall', drink: 'drinkstall', toilet: 'toilet', icecream: 'icecream', balloon: 'balloon', hat: 'hats', souvenir: 'souvenir', play: 'playground', sit: 'bench', look: 'fountain', ride: 'carousel',
  umbrella: 'umbrellas', shelter: 'shelter', pet: 'bench',
};
// rolstoel, kinderwagen, paraplu en zonnebril: van blokjes, net als de gasten zelf
const WHEEL_GEO = new THREE.CylinderGeometry(0.15, 0.15, 0.03, 12).rotateZ(Math.PI / 2);
const SMALL_WHEEL_GEO = new THREE.CylinderGeometry(0.05, 0.05, 0.03, 8).rotateZ(Math.PI / 2);
const CHAIR_BACK_GEO = new THREE.BoxGeometry(0.26, 0.3, 0.04);
const CHAIR_SEAT_GEO = new THREE.BoxGeometry(0.26, 0.04, 0.24);
const PRAM_GEO = new THREE.BoxGeometry(0.22, 0.14, 0.32);
const PRAM_HOOD_GEO = new THREE.BoxGeometry(0.22, 0.16, 0.14);
const PRAM_BAR_GEO = new THREE.BoxGeometry(0.2, 0.025, 0.025);
const BROLLY_GEO = new THREE.ConeGeometry(0.34, 0.14, 8);
const BROLLY_STICK_GEO = new THREE.BoxGeometry(0.02, 0.42, 0.02);
const SHADES_GEO = new THREE.BoxGeometry(0.19, 0.05, 0.03);
const BROLLY_COLORS = [0xe0584f, 0x4a90e2, 0xffd23f, 0x6cc04a, 0xa06ad9, 0xf06aa6];
const COLOR_OF = Object.fromEntries(PRODUCTS.filter(p => p.color !== undefined).map(p => [p.id, p.color as number]));
const SNACK_GEO = new THREE.BoxGeometry(0.06, 0.08, 0.06).translate(0, -0.2, 0.04);
/**
 * De tegel op het pad waar je bij een gebouw geholpen wordt: de bereikbare tegel het dichtst bij de voorkant.
 * Alle gasten gaan naar dezelfde plek, zodat er één rij ontstaat.
 */
function doorOf(w: GuestWorld, reach: Set<number>, shop: ShopSpot): number | null {
  const turn = ((shop.rot ?? 0) * Math.PI) / 2;
  const [cx, cy] = shopCenter(shop);
  // zo diep is het gebouw gezien vanaf zijn voorkant: een marktkraam is maar één tegel diep
  const deep = shopTiles(shop)[(shop.rot ?? 0) % 2 ? 0 : 1];
  const fx = cx + Math.sin(turn) * (deep / 2 + 0.5), fy = cy + Math.cos(turn) * (deep / 2 + 0.5);
  let best: number | null = null, bestD = Infinity;
  const own = footprint(shop);
  for (const t of own)
    for (const n of w.grid.neighbors(t)) {
      if (!reach.has(n) || own.includes(n)) continue;
      const [x, y] = tileXY(n);
      const d = Math.hypot(x + 0.5 - fx, y + 0.5 - fy);
      if (d < bestD) {
        bestD = d;
        best = n;
      }
    }
  return best;
}

const footprint = (shop: ShopSpot): number[] => {
  const tiles: number[] = [];
  const [wide, tall] = shopTiles(shop);
  for (let y = shop.y; y < shop.y + tall; y++) for (let x = shop.x; x < shop.x + wide; x++) tiles.push(tileIndex(x, y));
  return tiles;
};

/** Hoe een gast eruitziet als hij binnenkomt. */
export interface GuestOptions {
  child?: boolean;
  shirt?: number;
  /** In een rolstoel, of met een kinderwagen: die hebben een breed pad nodig. */
  wheels?: 'chair' | 'pram';
  /** De beroemde gast: gouden shirt en een zonnebril. */
  star?: boolean;
}

export class Guest implements Leader {
  readonly mesh: THREE.Group;
  readonly height: number;
  readonly child: boolean;
  readonly wheels: 'chair' | 'pram' | null;
  readonly star: boolean;
  gx: number;
  gy: number;
  hunger = Math.random() * 0.3;
  thirst = Math.random() * 0.3;
  /** Moet de gast naar de wc? Bij 1 is de nood hoog; duurt dat te lang, dan doet hij het op het pad. */
  bladder = Math.random() * 0.3;
  /** Zoveel seconden is de nood al hoog. */
  private urgent = 0;
  /** Zin in een ijsje. */
  treat = Math.random() * 0.4;
  /** Zin in een ballon (vooral kinderen). */
  balloon = 0;
  /** Zin in een hoedje. */
  hat = Math.random() * 0.4;
  tired = Math.random() * 0.2;
  /** Zin in een knuffel uit de knuffelkraam. */
  gift = Math.random() * 0.6;
  /** Zin om te spelen in de speeltuin (alleen kinderen). */
  playful = Math.random() * 0.4;
  /** Zin om bij de fontein te gaan kijken. */
  curious = Math.random() * 0.5;
  /** Zin in een rondje draaimolen (kinderen het meest). */
  rideWish = Math.random() * 0.5;
  /** Zin om dieren te aaien in de kinderboerderij (kinderen het meest). */
  petWish = Math.random() * 0.5;
  /** Op welk paardje, zitje of plekje de gast zit. */
  seat = Math.floor(Math.random() * 4);
  /** Plezier van 0 tot 1. Een gast koopt alleen iets als hij het naar zijn zin heeft. */
  fun = 0.5;
  /** Het dier dat deze gast het liefst wil zien. */
  fav: string | null = null;
  favSeen = false;
  /** Wat de gast nu wil, voor het wolkje boven zijn hoofd. */
  wish: GuestWish | null = null;
  /** Een vast plaatje boven een bijzondere gast: 'celeb', 'lost', 'seek', 'cake' of 'schoolclass'. */
  badge: string | null = null;
  gone = false;
  /** Heeft de speler al naar deze gast gezwaaid? */
  waved = false;
  /** Heeft de gast een paraplu? Die gaat open als het regent. */
  umbrella = false;
  /** Heeft de gast op de plattegrond gekeken? Dan vindt hij zijn lievelingsdier meteen. */
  knows = false;
  /** Achter wie de gast aan loopt (de juf, de jarige, de gids of papa en mama), en op welke plek in de rij. */
  leader: Leader | null = null;
  rank = 0;
  trail: [number, number][] = [];
  private leading = false;
  /** Een rondje langs de dieren (de juf met haar klas, de jarige): nog zoveel keer stoppen, en eerst naar het feest. */
  tour: { stops: number; party?: boolean } | null = null;
  private partyShop: ShopSpot | null = null;
  /** Een verdwaald kind staat te huilen tot de speler erop tikt; dan rent het naar `seeker`. */
  lost = false;
  private seeker: Guest | null = null;
  private found = false;
  private helped = false;
  private lostFor = 0;
  /** In het treintje. */
  riding: Train | null = null;
  private rode = false;
  private waitT = 0;
  /** In de kinderboerderij: 1 = op weg naar het poortje, 2 = naar binnen, 3 = aan het aaien, 4 = weer naar buiten. */
  private pen: PetSpot | null = null;
  private penPhase = 0;
  inside = false;
  private rainAsk = 0;
  private rainAlt = false;
  private bought: Partial<Record<ShopKind, number>> = {};
  /** Waar de gast precies om vraagt, per behoefte: 'lolly', 'cap_red', 'plush_pig', ... */
  private wanted: Partial<Record<Need, string>> = {};
  /** Behoeftes waarvoor de gast al tevergeefs heeft gezocht: dan neemt hij ook iets anders. */
  private settled = new Set<Need>();
  /** De boodschap waarvoor de gast nu onderweg is. */
  private errand: Need | null = null;

  private limbs: THREE.Mesh[];
  private head: THREE.Mesh;
  private state: GuestState = 'idle';
  private timer = 0.3;
  private age = 0;
  private stay = 90 + Math.random() * 80;
  private route: number[] = [];
  private heading = Math.PI;
  private phase = Math.random() * 6;
  private shop: ShopSpot | null = null;
  private gain = 0;
  private sees: string[] = [];
  face: [number, number] | null = null;
  private seen: number[] = [];
  private leaving = false;
  /** Zoveel seconden loopt de gast nog met afval in zijn hand. */
  private trash = 0;
  /** Deze gast let niet op en laat zijn afval vallen, ook als er een bak staat. */
  private sloppy = false;
  /** Een gast koopt per bezoek hooguit zoveel dingen; zo stroomt de kas niet over. */
  private purchases = 0;
  private wantsBalloon: boolean;
  private wantsHat: boolean;
  private headwear: THREE.Object3D | null = null;
  private brolly: THREE.Group | null = null;
  /** Wat de gast doet terwijl hij kijkt: zwaaien, wijzen, een foto maken, klappen, aaien, springen. */
  private act: Act | null = null;
  private actT = 0;
  /** Iets kleins tussendoor (om je heen kijken, je uitrekken, een dansje), en hoe lang het duurt tot het volgende. */
  private idle: { kind: Idle; t: number; dur: number } | null = null;
  private idleIn = 1.5 + Math.random() * 4;
  /** Zoveel tellen eet of drinkt de gast nog van wat hij net kocht; het zit in zijn hand. */
  private eating = 0;
  private snack: THREE.Mesh | null = null;
  /** Zoveel tellen springt de gast nog van blijdschap. */
  joy = 0;
  /** Zoveel tellen zwaait de gast nog (naar de speler, of bij het weggaan). */
  hello = 0;
  /** Zoveel tellen moppert de gast nog: armen in de zij en hoofdschudden. */
  private moan = 0;
  private hop = 0;
  /** Zoveel tellen rent een blij kind nog. */
  private dash = 0;
  /** Hoe de gast voorover leunt, opzij helt en om zijn as draait (bovenop het lopen). */
  private lean = 0;
  private tilt = 0;
  private twist = 0;
  /** In de rij: hoe lang de gast al wacht, wanneer hij aansloot en waar zijn plek in de rij is. */
  waited = 0;
  joined = 0;
  slot: [number, number] | null = null;
  /** De tegel voor de kraam waar de gast in de rij ging staan (-1: hij staat niet in de rij). Daar begint de rij. */
  gate = -1;
  /** Zet de gast nu een paar passen (opschuiven in de rij, naar de wc-deur)? Dan bewegen zijn benen mee. */
  private stepping = false;
  /** Op de wc: 0 = nog buiten, 1 = binnen, 2 = het geluidje is geweest, 3 = doorgetrokken. */
  private wc = 0;
  /** Op de wc: zoveel tellen heeft de gast aan het eind nog over als hij weer voor de deur staat. */
  private wcTail = 0;
  /** De gast gaat alleen even zitten als er plek is; is het bankje vol, dan loopt hij gewoon door. */
  private easy = false;
  /** Wat de gast draagt, om te kunnen bewaren. */
  private wornHat: string | null = null;
  private wornBalloon: string | null = null;
  private mess: 'poop' | 'pee' = 'pee';
  private ox = (Math.random() - 0.5) * 0.4;
  private oy = (Math.random() - 0.5) * 0.4;

  constructor(tile: number, species: string[], opts: GuestOptions = {}) {
    const person = makePerson(false, undefined, { child: opts.wheels || opts.star ? false : opts.child, shirt: opts.star ? 0xffd23f : opts.shirt });
    this.mesh = person.group;
    this.limbs = person.limbs;
    this.head = person.head;
    this.height = person.height;
    this.child = person.child;
    this.wheels = opts.wheels ?? null;
    this.star = !!opts.star;
    this.wantsBalloon = person.child || Math.random() < 0.2;
    this.wantsHat = Math.random() < 0.65;
    // wie een hoedje of ballon wil, heeft daar meteen al zin in: dan loopt hij er het hele bezoek mee rond
    if (this.wantsBalloon) this.balloon = 0.3 + Math.random() * 0.5;
    this.hat = this.wantsHat ? 0.4 + Math.random() * 0.5 : 0;
    this.fav = species.length ? pick(species) : null;
    const add = (geo: THREE.BufferGeometry, color: number, x: number, y: number, z: number): void => {
      const mesh = new THREE.Mesh(geo, mat(color));
      mesh.position.set(x, y, z);
      this.mesh.add(mesh);
    };
    if (this.wheels === 'chair') {
      // de rolstoel: een zitting met een rugleuning en twee grote wielen
      add(CHAIR_BACK_GEO, 0x3d4f7a, 0, 0.34, -0.1);
      add(CHAIR_SEAT_GEO, 0x3d4f7a, 0, 0.17, 0.02);
      add(WHEEL_GEO, 0x38343c, 0.16, 0.15, -0.02);
      add(WHEEL_GEO, 0x38343c, -0.16, 0.15, -0.02);
      add(SMALL_WHEEL_GEO, 0x8a8f98, 0.1, 0.05, 0.2);
      add(SMALL_WHEEL_GEO, 0x8a8f98, -0.1, 0.05, 0.2);
    } else if (this.wheels === 'pram') {
      // de kinderwagen rijdt voor de gast uit
      const color = pick([0xe0584f, 0x4a90e2, 0x6cc04a, 0xf06aa6]);
      add(PRAM_GEO, color, 0, 0.3, 0.42);
      add(PRAM_HOOD_GEO, color, 0, 0.42, 0.33);
      add(PRAM_BAR_GEO, 0x8a8f98, 0, 0.42, 0.2);
      for (const [x, z] of [[0.11, 0.3], [-0.11, 0.3], [0.11, 0.54], [-0.11, 0.54]]) add(SMALL_WHEEL_GEO, 0x38343c, x, 0.07, z);
    }
    if (this.star) {
      add(SHADES_GEO, 0x1d1d24, 0, 0.52, 0.09);
      this.badge = 'celeb';
      this.stay = 150;
      this.fun = 0.6;
    }
    const [x, y] = tileXY(tile);
    this.gx = x + 0.5;
    this.gy = y + 0.5;
    this.place();
  }

  get tile(): number {
    return tileIndex(Math.floor(this.gx), Math.floor(this.gy));
  }

  /** Een bijzondere gast (in een groepje, verdwaald, beroemd): die doet niet mee met een rondleiding en wordt niet bewaard. */
  get special(): boolean {
    return !!(this.leader || this.tour || this.lost || this.star || this.badge || this.leading);
  }

  get watching(): boolean {
    return this.state === 'watch';
  }

  /** Kan deze gast nu mee met de gids? */
  get free(): boolean {
    return !this.special && !this.leaving && !this.inside && !this.riding && !this.wheels && (this.state === 'idle' || this.state === 'walk' || this.state === 'watch') && !this.errand;
  }

  /** Wacht de gast bij deze halte op het treintje? */
  get waitingAt(): ShopSpot | null {
    return this.state === 'sit' && !this.riding && this.shop?.kind === 'station' ? this.shop : null;
  }

  snapshot(): GuestSave {
    return {
      gx: this.gx, gy: this.gy, child: this.child, fun: this.fun, age: this.age, stay: this.stay,
      hunger: this.hunger, thirst: this.thirst, bladder: this.bladder,
      hat: this.wornHat ?? undefined, balloon: this.wornBalloon ?? undefined,
    };
  }

  /** Zet een bewaarde gast terug op zijn plek, met zijn hoedje en ballon. */
  restore(s: GuestSave, dx = 0, dy = 0): void {
    this.gx = s.gx + dx;
    this.gy = s.gy + dy;
    this.fun = s.fun;
    this.age = s.age;
    this.stay = s.stay;
    this.hunger = s.hunger;
    this.thirst = s.thirst;
    this.bladder = Math.min(0.9, s.bladder);
    if (s.hat) {
      this.addHat(s.hat);
      this.bought.hats = 1;
      this.hat = 0;
    }
    if (s.balloon !== undefined) {
      this.addBalloon(s.balloon || undefined);
      this.bought.balloon = 1;
      this.balloon = 0;
    }
    this.place();
  }

  /** De kraam waar de gast nu geholpen wordt of voor in de rij staat. */
  get using(): ShopSpot | null {
    return this.state === 'buy' || this.state === 'sit' || this.state === 'queue' ? this.shop : null;
  }

  get queueing(): boolean {
    return this.state === 'queue';
  }

  /** Moet de wc-deur van deze gast nu open staan? Vlak voor hij naar binnen stapt, en als hij weer naar buiten komt. */
  get doorOpen(): boolean {
    if (this.state !== 'buy' || this.shop?.kind !== 'toilet') return false;
    const e = WC_TIME - this.timer, out = WC_TIME - this.wcTail;
    return (e > WC.walk - 0.45 && e < WC.walk + WC.step - 0.15) || (e > out - WC.step - 0.45 && e < out + 0.1);
  }

  /**
   * Waar de gast op de wc nu is: naar zijn deur lopen, naar binnen stappen, binnen zitten (dan zie je hem niet),
   * naar buiten stappen en terug naar het pad. Vult WC_AT in: de plek, de kant die hij op gaat en of hij loopt.
   */
  private wcPose(): void {
    const shop = this.shop!, p = WC_AT;
    const e = WC_TIME - this.timer, out = WC_TIME - this.wcTail;
    // de deur draait mee met het gebouw: links of rechts van het midden, aan de voorkant
    const turn = ((shop.rot ?? 0) * Math.PI) / 2, cos = Math.cos(turn), sin = Math.sin(turn);
    const cx = shop.x + shop.size / 2, cy = shop.y + shop.size / 2, lx = this.seat % 2 ? WC.door : -WC.door;
    const fx = cx + lx * cos + WC.front * sin, fy = cy - lx * sin + WC.front * cos;
    const ix = cx + lx * cos + WC.deep * sin, iy = cy - lx * sin + WC.deep * cos;
    let ax = ix, ay = iy, bx = ix, by = iy, k = 0;
    p.fx = fx;
    p.fy = fy;
    p.hidden = false;
    if (e < WC.walk) {
      // van het pad naar de deur
      ax = this.gx;
      ay = this.gy;
      bx = fx;
      by = fy;
      k = e / WC.walk;
    } else if (e < WC.walk + WC.step) {
      ax = fx;
      ay = fy;
      k = (e - WC.walk) / WC.step;
    } else if (e < out - WC.step) p.hidden = true;
    else if (e < out) {
      bx = fx;
      by = fy;
      k = (e - (out - WC.step)) / WC.step;
    } else {
      // weer buiten: terug naar waar de gast op het pad stond
      ax = fx;
      ay = fy;
      bx = this.gx;
      by = this.gy;
      k = Math.min(1, (e - out) / WC.back);
    }
    p.x = ax + (bx - ax) * k;
    p.y = ay + (by - ay) * k;
    p.dx = bx - ax;
    p.dy = by - ay;
    p.moving = k < 1 && Math.hypot(p.dx, p.dy) > 0.05;
    // wie er al is, kijkt van de wc af
    if (!p.moving) {
      p.dx = sin;
      p.dy = cos;
    }
  }

  /** Het bezoek aan de wc, stap voor stap: de gast verdwijnt achter de deur, je hoort een geluidje en daarna de spoelbak. */
  private toiletStep(dt: number, w: GuestWorld, reach: Set<number>): void {
    const shop = this.shop!;
    if (!w.shops.includes(shop)) {
      this.timer = 0; // de wc is weggehaald: de gast staat meteen weer buiten
      return;
    }
    const e = WC_TIME - this.timer;
    if (this.wc === 0 && e >= WC.walk + WC.step) {
      this.wc = 1;
      this.wish = null;
      // ligt er pad voor de deur, dan loopt de gast daar straks verder; anders terug naar waar hij stond
      this.wcPose();
      const tx = Math.floor(WC_AT.fx), ty = Math.floor(WC_AT.fy);
      if (tx >= 0 && ty >= 0 && tx < W && ty < H && reach.has(tileIndex(tx, ty))) {
        this.gx = WC_AT.fx;
        this.gy = WC_AT.fy;
        this.wcTail = 0.35;
      }
    } else if (this.wc === 1 && e >= WC.walk + WC.step + 0.5) {
      this.wc = 2;
      w.guestSound(Math.random() < 0.55 ? 'toilet.pee' : 'toilet.poop');
    } else if (this.wc === 2 && e >= WC_TIME - this.wcTail - WC.step - 2.05) {
      this.wc = 3;
      w.guestSound('flush');
    }
    this.wcPose();
    this.stepping = WC_AT.moving;
    if (!WC_AT.hidden) this.turnTo(WC_AT.dx, WC_AT.dy, dt);
  }

  /** Een paar passen naar je plek in de rij of aan de toonbank. Geeft true zolang de gast nog loopt. */
  private shuffle(dt: number, reach: Set<number>): boolean {
    if (!this.slot) return false;
    const dx = this.slot[0] - this.gx, dy = this.slot[1] - this.gy, dist = Math.hypot(dx, dy);
    if (dist <= 0.03 || !reach.has(tileIndex(Math.floor(this.slot[0]), Math.floor(this.slot[1])))) return false;
    const step = Math.min(0.8 * dt, dist);
    this.gx += (dx / dist) * step;
    this.gy += (dy / dist) * step;
    this.turnTo(dx, dy, dt);
    this.stepping = true;
    return true;
  }

  get happy(): boolean {
    return this.fun >= 0.55 && this.hunger < 0.9 && this.thirst < 0.9 && this.bladder < 0.9;
  }

  // ------------------------------------------------------------ groepjes
  /** Er loopt vanaf nu iemand achter deze gast aan: hij onthoudt waar hij liep. */
  lead(): void {
    this.leading = true;
    if (!this.trail.length) this.trail.push([this.gx, this.gy]);
  }

  /** Achter iemand aan gaan lopen, op plek `rank` in de rij. */
  join(leader: Leader, rank: number): void {
    this.leader = leader;
    this.rank = rank;
    this.route = [];
    this.shop = null;
    this.errand = null;
    this.wish = null;
    this.slot = null;
    this.state = 'idle';
  }

  /** De rondleiding is klaar: de gast gaat weer zijn eigen gang. */
  release(): void {
    this.leader = null;
    this.act = null;
    this.state = 'idle';
    this.timer = 0.3 + Math.random();
  }

  /** Dit kind is verdwaald: het staat te huilen tot het terug is bij `parent`. */
  loseTo(parent: Guest): void {
    this.lost = true;
    this.seeker = parent;
    this.badge = 'lost';
    parent.badge = 'seek';
    parent.stay += 240;
    parent.lead();
  }

  /** De speler tikt op het verdwaalde kind: het rent naar papa of mama. */
  bringBack(): void {
    if (!this.lost || this.found) return;
    this.found = true;
    this.helped = true;
  }

  /** Zwaaien (naar de speler). */
  greet(): void {
    this.hello = 1.8;
  }

  /** Instappen in het treintje, op plek `seat`. */
  board(train: Train, seat: number): void {
    this.riding = train;
    this.seat = seat;
    this.timer = 5;
  }

  /** Uitstappen bij de volgende halte. */
  alight(tile: number): void {
    const [x, y] = tileXY(tile);
    this.riding = null;
    this.rode = true;
    this.gx = x + 0.5;
    this.gy = y + 0.5;
    this.timer = 0.05;
  }

  /** Kletsen met de gast die naast je staat: naar elkaar toe draaien en praten. */
  chat(other: Guest): void {
    if (this.state !== 'idle' && this.state !== 'watch') return;
    this.idle = { kind: 'talk', t: 0, dur: 2.5 + Math.random() * 1.5 };
    this.chatAt = [other.gx, other.gy];
  }

  private chatAt: [number, number] | null = null;

  /** Kan de gast nu een praatje maken? */
  get chatty(): boolean {
    return !this.special && !this.idle && !this.act && this.moan <= 0 && (this.state === 'idle' || this.state === 'queue');
  }

  /** Hoe ver de gast is met gaan zitten (0 = staat nog op het pad, 1 = zit); aan het eind staat hij weer op. */
  private settle(total: number): number {
    return Math.max(0, Math.min(1, (total - this.timer) / 0.45, this.timer / 0.35));
  }

  private place(): void {
    const m = this.mesh;
    m.visible = true;
    if (this.state === 'buy' && this.shop?.kind === 'toilet') {
      // op de wc: naar de deur, naar binnen (achter de deur zie je de gast niet) en weer naar buiten
      this.wcPose();
      m.visible = !WC_AT.hidden;
      m.position.set(toWorldX(WC_AT.x), this.hop, toWorldZ(WC_AT.y));
      m.rotation.set(0, this.heading, 0);
      return;
    }
    if (this.riding) {
      // in het treintje: op het bankje van de wagon, met het gezicht in de rijrichting
      const [x, y, h] = this.riding.seatPos(this.seat);
      m.position.set(toWorldX(x), 0.24 - 0.2 * m.scale.y, toWorldZ(y));
      m.rotation.set(0, h, 0);
      this.limbs[0].rotation.x = this.limbs[1].rotation.x = -1.4;
      return;
    }
    const kind = this.state === 'sit' ? this.shop?.kind : undefined;
    if (kind === 'bench' && this.shop?.edge) {
      // op het bankje: naast elkaar, met het gezicht dezelfde kant op als het bankje
      const [bx, by, rot] = edgePose(this.shop);
      const k = this.settle(BENCH_TIME), lx = this.seat % 2 ? 0.2 : -0.2, lz = -0.02;
      const sx = bx + lx * Math.cos(rot) + lz * Math.sin(rot), sy = by - lx * Math.sin(rot) + lz * Math.cos(rot);
      m.position.set(toWorldX(this.gx + (sx - this.gx) * k), (0.3 - 0.2 * m.scale.y) * k, toWorldZ(this.gy + (sy - this.gy) * k));
      m.rotation.set(0, this.heading + Math.atan2(Math.sin(rot - this.heading), Math.cos(rot - this.heading)) * k, 0);
      // een kind op het bankje zwaait met zijn benen
      const dangle = this.child ? Math.sin(this.phase * 0.45) * 0.35 * k : 0;
      this.limbs[0].rotation.x = (-Math.PI / 2) * k + dangle;
      this.limbs[1].rotation.x = (-Math.PI / 2) * k - dangle;
      return;
    }
    if (kind && this.shop && !this.shop.edge && kind !== 'fountain') {
      const shop = this.shop;
      const cx = shop.x + 1, cy = shop.y + 1;
      // het toestel draait mee met het gebouw
      const turn = ((shop.rot ?? 0) * Math.PI) / 2, cos = Math.cos(turn), sin = Math.sin(turn);
      const at = (lx: number, h: number, lz: number): [number, number, number] => [cx + lx * cos + lz * sin, h, cy - lx * sin + lz * cos];
      const here: [number, number, number] = [this.gx, 0, this.gy];
      const mix = (a: number[], b: number[], t: number): number[] => a.map((v, i) => v + (b[i] - v) * t);
      const put = (p: number[], facing: number): void => {
        m.position.set(toWorldX(p[0]), p[1], toWorldZ(p[2]));
        m.rotation.set(0, facing, 0);
      };
      const legs = (a: number): void => {
        this.limbs[0].rotation.x = this.limbs[1].rotation.x = a;
      };
      const arms = (a: number): void => {
        this.limbs[2].rotation.x = this.limbs[3].rotation.x = a;
      };
      if (kind === 'playground' || kind === 'slide') {
        // de trap op, van de glijbaan af en weer terug: twee keer per bezoek (op de losse glijbaan om de beurt)
        const u = ((6 - this.timer + (kind === 'slide' ? this.seat * 1.5 : 0)) % 3) / 3;
        const top = kind === 'slide' ? at(0, 1.18, -0.5) : at(-0.39, 1.0, 0.1), low = kind === 'slide' ? at(0, 0.12, 0.95) : at(-0.39, 0.1, 1.1);
        const sliding = u >= 0.45 && u < 0.8;
        put(u < 0.45 ? mix(here, top, u / 0.45) : sliding ? mix(top, low, (u - 0.45) / 0.35) : mix(low, here, (u - 0.8) / 0.2), sliding ? turn : this.heading);
        if (sliding) {
          legs(-1.3);
          arms(-2.8); // armen in de lucht: joehoe
        }
        return;
      }
      const total = SERVE_TIME[kind] ?? 6, k = this.settle(total), spin = shop.spin ?? 0, side = this.seat % 2 ? 1 : -1;
      const sit = m.scale.y * 0.2;
      if (PLAY.includes(kind)) {
        // schommel, wipwap, wipkip en trampoline bewegen mee met het toestel (dezelfde stand en uitslag)
        const amp = shop.amp ?? 1;
        let seat: [number, number, number], facing = turn, leg = -1.2, arm = -1.2;
        if (kind === 'swing') {
          const a = Math.sin(spin) * 0.55 * amp;
          seat = at(side * 0.36, 1.54 - 1.15 * Math.cos(a) - sit, -1.15 * Math.sin(a));
          leg = -1.2 + a * 0.9;
          arm = -1.5;
        } else if (kind === 'seesaw') {
          const b = Math.sin(spin) * 0.3 * amp;
          seat = at(side * 0.67, 0.5 + side * 0.67 * Math.sin(b) - sit, 0);
          facing = turn - side * (Math.PI / 2);
          arm = -1.0;
        } else if (kind === 'springer') {
          const c = Math.sin(spin) * 0.3 * amp;
          seat = at(side * 0.42, 0.36 + 0.2 * Math.cos(c) - sit, 0.2 * Math.sin(c));
          arm = -1.1;
        } else {
          // trampoline: springen met de armen omhoog
          const jump = Math.abs(Math.sin(spin + this.seat * 1.3));
          seat = at(side * 0.28, 0.41 + jump * 0.55, side * 0.1);
          facing = this.heading + spin * 0.5;
          leg = 0.5 * (1 - jump);
          arm = -2.7 * jump;
        }
        put(mix(here, seat, k), k > 0.5 ? facing : this.heading);
        legs(leg * k);
        arms(arm * k);
        return;
      }
      if (kind === 'carousel') {
        // in de draaimolen zit de gast op een paardje en draait mee
        const a = spin + (this.seat * Math.PI) / 2;
        m.position.set(toWorldX(cx) + Math.sin(a) * 0.56, 0.3, toWorldZ(cy) + Math.cos(a) * 0.56);
        m.rotation.set(0, a + Math.PI / 2, 0);
        legs(-1.1);
        return;
      }
      if (kind === 'ferris') {
        // in een bakje van het reuzenrad: mee omhoog en weer omlaag
        const a = (this.seat * Math.PI * 2) / FERRIS.cabins + spin;
        put(mix(here, at(Math.cos(a) * FERRIS.radius, FERRIS.hub + Math.sin(a) * FERRIS.radius - 0.12 - sit, 0), k), k > 0.5 ? turn : this.heading);
        legs(-1.3 * k);
        // bovenin gaan de armen omhoog
        if (Math.sin(a) > 0.55) arms(-2.7);
        return;
      }
      if (kind === 'bumper') {
        // in een botsauto: de auto rijdt, de gast zit erin en stuurt
        const [x, z, h] = bumperCar(this.seat % BUMPER_CARS, spin);
        put(mix(here, at(x, 0.16 - sit, z), k), k > 0.5 ? turn + h : this.heading);
        legs(-1.4 * k);
        arms(-1.2 * k);
        return;
      }
      if (kind === 'tower') {
        // boven op de uitkijktoren: rondkijken en wijzen
        const look = turn + Math.sin(this.phase * 0.07 + this.seat * 1.7) * 1.4;
        put(mix(here, at(side * 0.3, TOWER_TOP, this.seat > 1 ? 0.3 : -0.25), k), k > 0.5 ? look : this.heading);
        if (k > 0.9) this.limbs[2].rotation.x = -1.5;
        return;
      }
      if (kind === 'restaurant') {
        // aan tafel: op een kruk, met het gezicht naar de tafel
        const [tx, tz] = RESTAURANT_TABLES[(this.seat >> 1) % RESTAURANT_TABLES.length];
        put(mix(here, at(tx + side * 0.27, 0.25 - sit, tz), k), k > 0.5 ? turn - side * (Math.PI / 2) : this.heading);
        legs(-1.4 * k);
        // een hap of een slok
        if (k > 0.9) this.limbs[3].rotation.x = -1.75 + Math.sin(this.phase * 0.45 + this.seat) * 0.5;
        return;
      }
      if (kind === 'shelter') {
        // in de schuilhut: de eerste drie zitten op de bank achterin, de rest staat ervoor en kijkt naar de regen
        if (this.seat < 3) {
          put(mix(here, at(((this.seat % 3) - 1) * 0.45, 0.25 - sit, -0.6), k), k > 0.5 ? turn : this.heading);
          legs(-1.4 * k);
        } else {
          put(mix(here, at(((this.seat % 3) - 1) * 0.45, 0, 0.3), k), k > 0.5 ? turn + Math.sin(this.phase * 0.05 + this.seat) * 0.5 : this.heading);
          // af en toe een hand uitsteken om te voelen of het nog regent
          if (k > 0.9 && Math.sin(this.phase * 0.03 + this.seat * 2) > 0.8) this.limbs[2].rotation.x = -1.4;
        }
        return;
      }
      if (kind === 'station') {
        // op het perron wachten tot het treintje komt
        put(mix(here, at(((this.seat % 4) - 1.5) * 0.36, 0.12, this.seat < 4 ? -0.45 : -0.15), k), k > 0.5 ? turn : this.heading);
        return;
      }
    }
    const kneel = this.act === 'kneel' && this.state === 'watch' ? -0.07 : 0;
    m.position.set(toWorldX(this.gx), (this.state === 'accident' ? -0.07 : kneel) + this.hop, toWorldZ(this.gy));
    // een moe gastje loopt een beetje voorovergebogen
    m.rotation.set((this.tired > 0.7 && this.state === 'walk' ? 0.12 : 0) + this.lean, this.heading + this.twist, this.tilt);
  }

  private turnTo(dx: number, dy: number, dt: number): void {
    let d = Math.atan2(dx, dy) - this.heading;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.heading += d * Math.min(1, dt * 10);
  }

  private go(w: GuestWorld, reach: Set<number>, to: number): boolean {
    const route = w.grid.path(this.tile, to, i => !reach.has(i));
    if (!route) return false;
    this.route = route.slice(1);
    this.state = 'walk';
    return true;
  }

  /** Een stap langs de route. Geeft true als de gast er is. */
  private stride(dt: number, speed: number): boolean {
    const next = this.route[0];
    if (next === undefined) return true;
    const [tx, ty] = tileXY(next);
    const dx = tx + 0.5 + this.ox - this.gx, dy = ty + 0.5 + this.oy - this.gy;
    const dist = Math.hypot(dx, dy), step = speed * dt;
    if (dist <= step) {
      this.gx += dx;
      this.gy += dy;
      this.route.shift();
    } else {
      this.gx += (dx / dist) * step;
      this.gy += (dy / dist) * step;
      this.turnTo(dx, dy, dt);
    }
    if (this.leading) this.mark();
    return false;
  }

  /** Onthoud waar je liep, voor wie achter je aan komt. */
  private mark(): void {
    const last = this.trail[this.trail.length - 1];
    if (last && Math.hypot(last[0] - this.gx, last[1] - this.gy) < 0.15) return;
    this.trail.push([this.gx, this.gy]);
    if (this.trail.length > 90) this.trail.shift();
  }

  /** Een padtegel naast een winkel van dit soort waar een gast kan staan. Met `product`: alleen winkels die dat verkopen. */
  private spotBeside(w: GuestWorld, reach: Set<number>, kind: ShopKind, product?: string): { shop: ShopSpot; tile: number } | null {
    const options: { shop: ShopSpot; tile: number }[] = [];
    for (const shop of w.shops) {
      if (!sameUse(shop.kind, kind) || (product && shop.kind === kind && !shop.sells.includes(product))) continue;
      // het treintje rijdt pas als er twee haltes zijn
      if (shop.kind === 'station' && !w.trainRuns()) continue;
      if (shop.edge) {
        // wat op een rand staat, gebruik je vanaf het pad ernaast
        for (const n of edgeSides(shop)) if (reach.has(n)) options.push({ shop, tile: n });
        continue;
      }
      const door = doorOf(w, reach, shop);
      if (door !== null) options.push({ shop, tile: door });
    }
    if (!options.length) return null;
    // de kortste rij is het aantrekkelijkst
    const load = (o: { shop: ShopSpot }): number => (o.shop.busyNow ?? 0) + (o.shop.line ?? 0) + Math.random() * 0.6;
    return options.reduce((best, o) => (load(o) < load(best) ? o : best));
  }

  /** Wat wil de gast nu het liefst? Het dringendste eerst. */
  private want(w: GuestWorld): Need | null {
    if (this.bladder > 0.6) return 'toilet';
    if (this.hunger > 0.6 && this.hunger >= this.thirst) return 'food';
    if (this.thirst > 0.6) return 'drink';
    if (this.hunger > 0.6) return 'food';
    // het regent: een paraplu halen of gaan schuilen
    if (w.raining() && !this.umbrella && this.age >= this.rainAsk && w.feature('weather'))
      return w.shops.some(s => s.kind === 'umbrellas') && !this.rainAlt ? 'umbrella' : 'shelter';
    // in een rolstoel of met een kinderwagen ga je niet op een bankje of in de draaimolen
    if (!this.wheels) {
      if (this.tired > 0.75) return 'sit';
      if (this.child && this.playful > 0.7) return 'play';
      if (this.petWish > 0.7 && w.pettingSpots().length) return 'pet';
      if (this.rideWish > 0.7) return 'ride';
    }
    if (this.curious > 0.7) return 'look';
    if (this.purchases >= MAX_PURCHASES || this.fun < 0.5) return null;
    // iets lekkers of leuks: waar de gast de meeste zin in heeft
    const treats: [Need, number][] = [['icecream', this.treat], ['balloon', this.balloon], ['hat', this.hat], ['souvenir', this.gift]];
    const [need, zin] = treats.sort((a, b) => b[1] - a[1])[0];
    return zin > 0.7 ? need : null;
  }

  /** De gast heeft niet gevonden wat hij zocht: de zin zakt wat, zodat hij het later nog eens probeert. */
  private postpone(want: Need): void {
    if (want === 'sit') this.tired = 0.5;
    if (want === 'icecream') this.treat = 0.3;
    if (want === 'balloon') this.balloon = 0.3;
    if (want === 'hat') this.hat = 0.3;
    if (want === 'souvenir') this.gift = 0.3;
    if (want === 'play') this.playful = 0.4;
    if (want === 'look') this.curious = 0.3;
    if (want === 'ride') this.rideWish = 0.3;
    if (want === 'pet') this.petWish = 0.4;
    if (want === 'umbrella' || want === 'shelter') {
      // even later nog eens proberen, en dan het andere
      this.rainAsk = this.age + 12;
      this.rainAlt = !this.rainAlt;
    }
  }

  /**
   * Even uitrusten als het zo uitkomt: wie iets lekkers in zijn hand heeft of al een beetje moe is, gaat zitten
   * als er vlakbij een bankje met een vrij plekje staat. Is er geen, dan loopt hij gewoon door: geen wolkje en
   * niet minder blij. Geeft terug of de gast nu op weg is naar een bankje.
   */
  private rest(w: GuestWorld, reach: Set<number>): boolean {
    if (this.wheels || (w.raining() && !this.umbrella && w.feature('weather'))) return false;
    if (Math.random() > (this.snack ? 0.8 : this.tired > 0.3 ? this.tired * 2 : 0)) return false;
    let best: ShopSpot | null = null, tile = -1, near = REST_NEAR;
    for (const shop of w.shops) {
      if (shop.kind !== 'bench' || !shop.edge || (shop.busyNow ?? 0) >= (AT_ONCE.bench ?? 1)) continue;
      for (const n of edgeSides(shop)) {
        if (!reach.has(n)) continue;
        const [x, y] = tileXY(n);
        const d = Math.abs(x + 0.5 - this.gx) + Math.abs(y + 0.5 - this.gy);
        if (d < near) {
          near = d;
          best = shop;
          tile = n;
        }
      }
    }
    if (!best || (tile !== this.tile && !this.go(w, reach, tile))) return false;
    if (this.route.length > REST_NEAR * 2) {
      // het bankje is dichtbij, maar de weg erheen is een heel eind om
      this.route = [];
      this.state = 'idle';
      return false;
    }
    this.shop = best;
    this.errand = 'sit';
    this.easy = true;
    // wat lekkers gaat mee naar het bankje
    if (this.snack) this.eating = Math.max(this.eating, this.route.length / 0.8 + 4);
    if (tile === this.tile) this.arrive(w);
    return true;
  }

  /** Naar huis: door de poort naar buiten. Een blije gast laat een tekening achter in het gastenboek. */
  private leave(w: GuestWorld): void {
    if (this.gone) return;
    this.gone = true;
    if (this.star) w.starLeft(this, this.happy);
    else if (this.happy && !this.leader) w.signBook(this);
  }

  /** Naar de kinderboerderij: eerst naar het poortje lopen. Lukt dat? */
  private visitPen(w: GuestWorld, reach: Set<number>): boolean {
    const spots = w.pettingSpots().filter(sp => reach.has(sp.out) && sp.count < PETTING_GUESTS);
    if (!spots.length) return false;
    const spot = pick(spots);
    if (spot.out !== this.tile && !this.go(w, reach, spot.out)) return false;
    this.pen = spot;
    this.penPhase = 1;
    spot.count++;
    this.wish = { kind: 'pet', lacking: false };
    if (spot.out === this.tile) this.arrive(w);
    return true;
  }

  /** Een rondje met een groepje: eerst naar het feest (bij een verjaardag), dan een paar keer bij de dieren kijken, dan naar huis. */
  private tourStep(w: GuestWorld, list: number[], reach: Set<number>): void {
    const t = this.tour!;
    this.wish = null;
    if (t.party) {
      t.party = false;
      const spot = this.spotBeside(w, reach, 'playground');
      if (spot && (spot.tile === this.tile || this.go(w, reach, spot.tile))) {
        this.partyShop = spot.shop;
        if (spot.tile === this.tile) this.arrive(w);
        return;
      }
    }
    if (t.stops <= 0) {
      this.leaving = true;
      if (this.tile === ENTRANCE || !this.go(w, reach, ENTRANCE)) this.leave(w);
      return;
    }
    t.stops--;
    for (let tries = 0; tries < 30; tries++) {
      const tile = pick(list);
      if (tile === this.tile || this.seen.includes(tile)) continue;
      const view = w.viewScore(tile);
      if (!view || !this.go(w, reach, tile)) continue;
      this.gain = view.score;
      this.sees = view.species;
      this.face = [view.x, view.y];
      this.seen = [...this.seen.slice(-6), tile];
      return;
    }
    // niets te zien: een stukje wandelen
    if (!this.go(w, reach, pick(list))) {
      this.state = 'idle';
      this.timer = 1.5;
    }
  }

  private decide(w: GuestWorld, list: number[], reach: Set<number>): void {
    this.shop = null;
    this.face = null;
    this.errand = null;
    this.sees = [];
    this.act = null;
    this.gate = -1;
    this.easy = false;
    if (this.tour && !this.leaving) return this.tourStep(w, list, reach);
    if (this.age > this.stay || this.fun < 0.08) this.leaving = true;
    if (this.leaving) {
      this.wish = null;
      if (this.tile === ENTRANCE || !this.go(w, reach, ENTRANCE)) this.leave(w);
      return;
    }
    if (w.litterOn(this.tile)) this.fun = Math.max(0, this.fun - 0.04);
    this.fun = Math.min(1, this.fun + w.charm(this.tile));
    this.wish = this.fun < 0.2 ? { kind: 'bored', lacking: true } : null;
    // (een rolstoel of kinderwagen vroeg eerst om een pad van twee tegels breed; dat is eruit: het was vooral lastig)
    // op de plattegrond gekeken: nu weet de gast de weg
    if (!this.knows && w.mapNear(this.gx, this.gy)) {
      this.knows = true;
      this.fun = Math.min(1, this.fun + 0.05);
      this.idle = { kind: 'nod', t: 0, dur: 1.2 };
    }
    const want = this.want(w);
    // niets dringends, of net iets lekkers gekocht: even gaan zitten als er vlakbij een bankje vrij is
    const calm = !want || !PRESSING.includes(want) || (!!this.snack && (want === 'food' || want === 'drink'));
    if (calm && this.rest(w, reach)) return;
    if (want === 'pet') {
      if (this.visitPen(w, reach)) return;
      this.postpone(want);
    } else if (want) {
      const kind = NEED_SHOP[want];
      // waar vraagt de gast precies om? Bij de knuffelkraam het liefst zijn lievelingsdier.
      const options = w.products(kind);
      let product = this.wanted[want];
      if (options.length && (!product || !options.includes(product))) {
        product = want === 'souvenir' && this.fav && options.includes(PLUSH + this.fav) ? PLUSH + this.fav : pick(options);
        this.wanted[want] = product;
      }
      if (!options.length) product = undefined;
      let spot = this.spotBeside(w, reach, kind, product);
      // nergens te koop: de tweede keer neemt de gast ook iets anders van dezelfde kraam
      if (!spot && product && this.settled.has(want)) spot = this.spotBeside(w, reach, kind);
      // de rij is al te lang: dan loopt de gast mopperend door en komt hij later terug
      const full = !!spot && (spot.shop.line ?? 0) >= MAX_QUEUE;
      if (spot && !full && (spot.tile === this.tile || this.go(w, reach, spot.tile))) {
        this.shop = spot.shop;
        this.errand = want;
        this.wish = { kind: want, lacking: false, product };
        if (spot.tile === this.tile) this.arrive(w);
        return;
      }
      // het is er niet: de gast laat zien wat hij mist en heeft het wat minder naar zijn zin
      this.wish = { kind: want, lacking: true, product, busy: full || undefined };
      if (full) this.grumble(w);
      else if (product && w.shops.some(sh => sameUse(sh.kind, kind))) {
        this.settled.add(want);
        this.fun = Math.max(0, this.fun - 0.03);
      } else {
        const miss = want === 'look' || want === 'ride' ? 0 : want === 'toilet' ? 0.07 : want === 'food' || want === 'drink' ? 0.05 : 0.02;
        this.fun = Math.max(0, this.fun - miss);
        this.postpone(want);
      }
    }
    // naar een plek lopen waar iets te zien is; het lievelingsdier eerst
    let fallback: { tile: number; view: NonNullable<ReturnType<GuestWorld['viewScore']>> } | null = null;
    if (this.knows && this.fav && !this.favSeen) {
      // wie de plattegrond kent, loopt recht naar zijn lievelingsdier
      for (let i = 0, n = Math.min(list.length, 160), from = Math.floor(Math.random() * list.length); i < n && !fallback; i++) {
        const tile = list[(from + i) % list.length];
        const view = w.viewScore(tile);
        if (view?.species.includes(this.fav)) fallback = { tile, view };
      }
    }
    for (let tries = 0; tries < 16 && !(fallback && this.knows); tries++) {
      const tile = pick(list);
      if (tile === this.tile || this.seen.includes(tile)) continue;
      const view = w.viewScore(tile);
      if (!view) continue;
      if (this.fav && !this.favSeen && view.species.includes(this.fav)) {
        fallback = { tile, view };
        break;
      }
      fallback ??= { tile, view };
    }
    if (fallback && this.go(w, reach, fallback.tile)) {
      this.gain = fallback.view.score;
      this.sees = fallback.view.species;
      this.face = [fallback.view.x, fallback.view.y];
      this.seen = [...this.seen.slice(-4), fallback.tile];
      if (!this.wish && this.fav && !this.favSeen && this.age < 30) this.wish = { kind: 'fav', lacking: false };
      return;
    }
    // niets te zien: een stukje wandelen
    if (!this.go(w, reach, pick(list))) {
      this.state = 'idle';
      this.timer = 1.5;
    }
    this.fun = Math.max(0, this.fun - 0.03);
  }

  /** Bij het kijken doet de gast iets: zwaaien, wijzen, een foto maken, klappen, door zijn handen turen, roepen, lachen. */
  private pickAct(): Act | null {
    const p = Math.random();
    if (this.child && p < 0.22) return 'jump';
    return p < 0.36 ? 'wave' : p < 0.5 ? 'point' : p < 0.64 ? 'photo' : p < 0.73 ? 'clap' : p < 0.8 ? 'peer' : p < 0.86 ? 'kneel' : p < 0.91 ? 'call' : p < 0.96 ? 'laugh' : null;
  }

  private arrive(w: GuestWorld): void {
    if (this.pen) return this.penArrive(w);
    if (this.partyShop) {
      // het feest: slingers, taart en iedereen klapt
      const shop = this.partyShop;
      this.partyShop = null;
      this.face = shopCenter(shop);
      this.state = 'watch';
      this.timer = 14;
      this.act = 'clap';
      this.actT = 0;
      this.joy = 3;
      w.partyAt(shop, this);
      return;
    }
    if (this.leaving && this.tile === ENTRANCE) {
      this.leave(w);
    } else if (this.shop) {
      this.face = shopCenter(this.shop);
      if (!w.shops.includes(this.shop)) {
        this.state = 'idle'; // de kraam is intussen weggehaald
        this.timer = 0.2;
      } else if ((this.shop.busyNow ?? 0) < (AT_ONCE[this.shop.kind] ?? 1)) this.serve();
      else if (this.shop.kind === 'bench') {
        // het bankje is vol: voor een bankje ga je niet in de rij staan. Wie echt moe is, moppert en loopt door;
        // wie alleen even wilde uitrusten, loopt gewoon verder
        if (this.easy) this.timer = 0.3;
        else {
          this.wish = { kind: 'sit', lacking: true, busy: true };
          this.grumble(w);
          this.tired = 0.6;
          this.timer = 1.6;
        }
        this.state = 'idle';
        this.shop = null;
        this.errand = null;
      } else {
        // bezet: achteraan aansluiten; de rij begint op de tegel waar de gast nu staat
        this.state = 'queue';
        this.waited = 0;
        this.joined = this.age;
        this.slot = null;
        this.gate = this.tile;
      }
    } else if (this.face) {
      this.state = 'watch';
      this.timer = this.tour ? 6 + Math.random() * 2 : 4 + Math.random() * 3;
      // te donker om iets te zien: het wolkje vraagt om een lantaarn
      if (w.dark(this.tile)) this.wish = { kind: 'dark', lacking: true };
      this.act = this.tour ? 'point' : this.pickAct();
      this.actT = 0;
    } else {
      this.state = 'idle';
      this.timer = 0.6 + Math.random();
    }
  }

  /** De stappen van een bezoek aan de kinderboerderij: door het poortje, naar een dier, aaien en weer terug. */
  private penArrive(w: GuestWorld): void {
    const pen = this.pen!;
    if (!w.pettingSpots().includes(pen)) {
      // het hek is intussen veranderd: de gast gaat er gewoon weer uit
      // stond de gast al binnen, dan is hij meteen weg
      if (this.inside) this.gone = true;
      this.endPen();
      return;
    }
    if (this.penPhase === 1) {
      const goal = pick(pen.tiles);
      this.route = w.grid.path(pen.inn, goal) ?? [pen.inn];
      this.inside = true;
      this.penPhase = 2;
      this.state = 'walk';
    } else if (this.penPhase === 2) {
      this.penPhase = 3;
      this.state = 'watch';
      this.timer = 6 + Math.random() * 3;
      this.act = 'pet';
      this.actT = 0;
      this.face = w.petAt(pen, this);
    } else {
      this.endPen();
      this.state = 'idle';
      this.timer = 0.4;
    }
  }

  private endPen(): void {
    if (this.pen) this.pen.count = Math.max(0, this.pen.count - 1);
    this.pen = null;
    this.penPhase = 0;
    this.inside = false;
  }

  /** Aan de beurt: bestellen, naar de wc, gaan zitten of instappen. */
  serve(): void {
    if (!this.shop) return;
    const kind = this.shop.kind;
    this.state = SEATED.includes(kind) ? 'sit' : 'buy';
    // de eerste vrije plek: zo zitten er geen twee op hetzelfde zitje
    const places = AT_ONCE[kind] ?? 1, used = this.shop.used ?? 0;
    let seat = 0;
    while (seat < places - 1 && used & (1 << seat)) seat++;
    this.seat = seat;
    this.shop.used = used | (1 << seat);
    this.timer = SERVE_TIME[kind] ?? 3;
    this.waitT = 0;
    this.rode = false;
    this.shop.busyNow = (this.shop.busyNow ?? 0) + 1;
    this.slot = null;
    if (this.gate >= 0 && this.state === 'buy' && kind !== 'toilet') {
      // uit de rij aan de beurt: de gast stapt naar de toonbank, waar de rij begint
      const [x, y] = tileXY(this.gate);
      this.slot = [x + 0.5 + this.ox, y + 0.5 + this.oy];
    }
    this.gate = -1;
    if (this.wish) this.wish = { ...this.wish, lacking: false, busy: undefined };
    if (kind === 'toilet') {
      // het bezoek begint buiten, op het pad (zie toiletStep)
      this.wc = 0;
      this.wcTail = WC.back + 0.1;
    }
    // wie met iets lekkers op het bankje gaat zitten, eet het daar rustig op
    if (kind === 'bench' && this.snack) this.eating = Math.max(this.eating, this.timer - 1.5);
  }

  /** Te lang gewacht of nergens plek: de gast moppert, wordt minder blij en laat zien waar het te druk is. */
  private grumble(w: GuestWorld): void {
    this.fun = Math.max(0, this.fun - 0.06);
    if (this.wish) this.wish = { ...this.wish, lacking: true, busy: true };
    this.moan = 1.4;
    w.guestSound('guest.grumble');
  }

  /** Klaar met kijken, kopen of zitten. Geeft true als de gast zelf al weet wat hij hierna doet. */
  private finish(w: GuestWorld): boolean {
    const kind = this.shop?.kind;
    if (this.state === 'watch' && this.pen && this.penPhase === 3) {
      // genoeg geaaid: door het poortje weer naar buiten
      this.fun = Math.min(1, this.fun + 0.3);
      this.petWish = 0;
      this.playful = Math.max(0, this.playful - 0.3);
      const back = w.grid.path(this.tile, this.pen.inn) ?? [this.pen.inn];
      this.route = [...back.slice(1), this.pen.out];
      this.penPhase = 4;
      this.state = 'walk';
      this.wish = null;
      this.act = null;
      this.face = null;
      this.inside = true;
      return true;
    }
    if (this.state === 'watch') {
      // in het donker valt er weinig te zien
      const dark = w.dark(this.tile);
      this.fun = Math.min(1, this.fun + this.gain * (dark ? DARK_FUN : 1));
      if (!dark) w.watched(this);
      if (!dark && this.fav && !this.favSeen && this.sees.includes(this.fav)) {
        this.favSeen = true;
        this.fun = Math.min(1, this.fun + 0.25);
        w.cheer(this);
        this.joy = 1.6;
      }
    } else if (this.state === 'sit' && kind && PLAY.includes(kind)) {
      w.guestSound('guest.laugh');
      this.playful = 0;
      this.fun = Math.min(1, this.fun + 0.25);
    } else if (this.state === 'sit' && kind === 'station') {
      // uitgestapt bij de volgende halte, of het treintje kwam niet
      if (this.rode) {
        this.rideWish = 0;
        this.tired = 0;
        this.fun = Math.min(1, this.fun + 0.3);
        this.joy = 1;
      } else this.postpone('ride');
    } else if (this.state === 'sit' && kind && RIDES.includes(kind)) {
      w.guestSound('guest.laugh');
      this.rideWish = 0;
      this.fun = Math.min(1, this.fun + (kind === 'ferris' ? 0.4 : 0.35));
    } else if (this.state === 'sit' && kind === 'tower' && this.shop) {
      this.curious = 0;
      this.fun = Math.min(1, this.fun + 0.1 + w.towerView(this.shop));
    } else if (this.state === 'sit' && kind === 'fountain') {
      this.curious = 0;
      this.fun = Math.min(1, this.fun + 0.2);
    } else if (this.state === 'sit' && kind === 'restaurant' && this.shop && w.shops.includes(this.shop)) {
      // samen eten aan tafel: eten én drinken, twee munten
      this.hunger = 0;
      this.thirst = 0;
      this.tired = Math.max(0, this.tired - 0.4);
      this.bought.foodstall = this.bought.drinkstall = 1;
      if (w.buy(this.shop, this, undefined, true)) w.buy(this.shop, this, undefined, true);
      this.fun = Math.min(1, this.fun + 0.2);
    } else if (this.state === 'sit' && kind === 'shelter') {
      this.fun = Math.min(1, this.fun + 0.05);
    } else if (this.state === 'sit') {
      // op het bankje: hoe moeier de gast was, hoe meer hij ervan opknapt
      this.fun = Math.min(1, this.fun + 0.05 + 0.1 * Math.min(1, this.tired / 0.75));
      this.tired = 0;
    } else if (this.state === 'buy' && this.shop && kind && w.shops.includes(this.shop)) {
      const asked = this.errand ? this.wanted[this.errand] : undefined;
      const exact = !asked || this.shop.sells.includes(asked);
      const got = exact ? asked : this.shop.sells.length ? pick(this.shop.sells) : undefined;
      if (kind === 'toilet') {
        // het doortrekken was al te horen toen de gast nog binnen zat (zie toiletStep)
        this.bladder = 0;
        this.fun = Math.min(1, this.fun + 0.08);
      } else if ((exact || got) && w.buy(this.shop, this, got, exact)) {
        this.bought[kind] = (this.bought[kind] ?? 0) + 1;
        this.purchases++;
        // wat lekkers gaat mee in de hand: de gast eet of drinkt er nog even van
        if (kind === 'foodstall' || kind === 'drinkstall' || kind === 'icecream') {
          if (this.snack) this.limbs[3].remove(this.snack);
          this.snack = new THREE.Mesh(SNACK_GEO, mat(kind === 'foodstall' ? 0xffd23f : kind === 'drinkstall' ? 0x9fd8f5 : 0xffc1d6));
          this.limbs[3].add(this.snack);
          this.eating = 7;
        }
        if (kind === 'foodstall') this.hunger = 0;
        else if (kind === 'drinkstall') {
          this.thirst = 0;
          this.bladder = Math.min(0.85, this.bladder + 0.15);
        } else if (kind === 'icecream') this.treat = 0;
        else if (kind === 'balloon') {
          this.balloon = 0;
          this.addBalloon(got);
        } else if (kind === 'hats') {
          this.hat = 0;
          this.addHat(got);
        } else if (kind === 'souvenir') this.gift = 0;
        else if (kind === 'umbrellas') this.takeUmbrella();
        // precies wat de gast vroeg maakt hem blijer dan iets anders
        const joy = kind === 'foodstall' || kind === 'drinkstall' ? 0.1 : 0.2;
        this.fun = Math.min(1, this.fun + (exact ? joy : joy * 0.3));
        // een kind dat net iets leuks kreeg, springt even
        if (this.child && (kind === 'icecream' || kind === 'balloon' || kind === 'souvenir')) this.joy = 0.9;
        if (this.errand) {
          delete this.wanted[this.errand];
          this.settled.delete(this.errand);
        }
        if (kind === 'foodstall' || kind === 'drinkstall' || kind === 'icecream') {
          this.trash = 10 + Math.random() * 10;
          this.sloppy = w.messy() && Math.random() < 0.45;
        }
      } else this.fun = Math.max(0, this.fun - 0.1);
    }
    this.wish = null;
    this.errand = null;
    return false;
  }

  /** De gast loopt verder met de ballon die hij kocht. */
  private addBalloon(product?: string): void {
    this.wornBalloon = product ?? '';
    const colors = [0xe0584f, 0x4a90e2, 0xffd23f, 0x6cc04a, 0xf06aa6];
    const color = (product && COLOR_OF[product]) || pick(colors);
    const balloon = new THREE.Mesh(BALLOON_GEO, mat(color));
    balloon.position.set(0.17, 0.95, 0);
    if (product === 'balloon_heart') balloon.scale.set(1.5, 1.25, 0.8);
    const string = new THREE.Mesh(STRING_GEO, mat(0xf4f1e8));
    string.position.set(0.17, 0.68, 0);
    this.mesh.add(balloon, string);
  }

  /** De gast zet het hoedje op dat hij kocht: een petje, een strohoed, een feestmuts of een kroon. */
  addHat(product = 'cap_red'): void {
    this.wornHat = product;
    if (this.headwear) this.mesh.remove(this.headwear);
    const color = mat(COLOR_OF[product] ?? 0xe0584f);
    const hat = new THREE.Group();
    const add = (geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z = 0): void => {
      const mesh = new THREE.Mesh(geo, m);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      hat.add(mesh);
    };
    if (product === 'hat_straw') {
      add(BRIM_GEO, color, 0, 0.65);
      add(CROWN_GEO, color, 0, 0.7);
    } else if (product === 'hat_party') {
      add(PARTY_GEO, color, 0, 0.74);
      add(POM_GEO, mat(0xffd23f), 0, 0.85);
    } else if (product === 'hat_crown') {
      add(CROWN_GEO, color, 0, 0.68);
      for (const [x, z] of [[0.07, 0], [-0.07, 0], [0, 0.07], [0, -0.07]]) add(SPIKE_GEO, color, x, 0.74, z);
    } else add(CAP_GEO, color, 0, 0.65);
    this.headwear = hat;
    this.mesh.add(hat);
  }

  /** Een paraplu uit de bak: die gaat open zodra het regent. */
  private takeUmbrella(): void {
    this.umbrella = true;
    if (this.brolly) return;
    const brolly = new THREE.Group();
    const top = new THREE.Mesh(BROLLY_GEO, mat(pick(BROLLY_COLORS)));
    top.position.set(-0.1, 0.98, 0.02);
    const stick = new THREE.Mesh(BROLLY_STICK_GEO, mat(0x5a4636));
    stick.position.set(-0.1, 0.74, 0.02);
    brolly.add(top, stick);
    this.brolly = brolly;
    this.mesh.add(brolly);
  }

  /** Achter de leider aan: over het spoor dat hij achterlaat, elk op zijn eigen plek in de rij. */
  private follow(dt: number): void {
    const L = this.leader!;
    if (L.gone) {
      this.gone = true;
      return;
    }
    const trail = L.trail, idx = trail.length - 1 - this.rank * 3;
    const target = idx >= 0 ? trail[idx] : trail[0] ?? [L.gx, L.gy];
    const dx = target[0] + this.ox * 0.5 - this.gx, dy = target[1] + this.oy * 0.5 - this.gy, dist = Math.hypot(dx, dy);
    const moving = dist > 0.1;
    if (moving) {
      // wie achterop raakt, zet er even de pas in
      const step = Math.min(dist, (dist > 1.2 ? 1.6 : 0.95) * dt);
      this.gx += (dx / dist) * step;
      this.gy += (dy / dist) * step;
      this.turnTo(dx, dy, dt);
      this.act = null;
    } else if (L.face) this.turnTo(L.face[0] - this.gx, L.face[1] - this.gy, dt);
    this.state = moving ? 'walk' : L.watching ? 'watch' : 'idle';
    if (this.state === 'watch' && !this.act) {
      this.act = this.pickAct();
      this.actT = Math.random() * 2;
    }
    if (this.leading) this.mark();
    this.fun = Math.min(1, this.fun + dt * 0.004);
    this.phase += dt * 11;
    swing(this.limbs, moving ? Math.sin(this.phase) * 0.7 : 0);
    this.gesture(dt, false);
    this.place();
  }

  /** Verdwaald: staan huilen tot er iemand helpt; daarna rennen naar papa of mama. */
  private cry(dt: number, w: GuestWorld, reach: Set<number>): void {
    const P = this.seeker;
    if (!P || P.gone || !reach.has(this.tile)) {
      this.gone = true;
      return;
    }
    this.lostFor += dt;
    // komt er niemand helpen, dan vinden ze elkaar na een poos vanzelf
    if (this.lostFor > 160) this.found = true;
    this.phase += dt * 11;
    if (this.found) {
      if (Math.hypot(P.gx - this.gx, P.gy - this.gy) < 0.9) {
        this.lost = false;
        this.badge = null;
        P.badge = null;
        this.joy = 2;
        P.joy = 2;
        this.join(P, 1);
        w.reunited(this, P, this.helped);
        return;
      }
      if (!this.route.length && !this.go(w, reach, P.tile)) {
        this.gx = P.gx;
        this.gy = P.gy;
      }
      this.stride(dt, 1.5);
      this.state = 'walk';
      swing(this.limbs, Math.sin(this.phase * 1.4) * 0.9);
      this.limbs[2].rotation.x = this.limbs[3].rotation.x = -2.6;
    } else {
      // handen voor de ogen en schokkende schouders
      this.state = 'idle';
      swing(this.limbs, 0);
      this.limbs[2].rotation.x = this.limbs[3].rotation.x = -2.35;
      this.limbs[2].rotation.z = 0.35;
      this.limbs[3].rotation.z = -0.35;
      this.head.rotation.x = 0.3;
      this.tilt = Math.sin(this.phase * 0.9) * 0.05;
    }
    this.place();
  }

  update(dt: number, w: GuestWorld, list: number[], reach: Set<number>): void {
    this.age += dt;
    this.stepping = false;
    const rain = w.raining();
    if (this.brolly) this.brolly.visible = rain;
    if (this.leader) return this.follow(dt);
    if (this.lost) return this.cry(dt, w, reach);
    const ease = w.ease(), demand = w.demand() * ease;
    if (w.sells('foodstall') && !this.bought.foodstall) this.hunger = Math.min(1, this.hunger + (dt / 160) * demand * w.craving('foodstall'));
    if (w.sells('drinkstall') && !this.bought.drinkstall) this.thirst = Math.min(1, this.thirst + (dt / 130) * demand * w.craving('drinkstall'));
    if (w.sells('toilet')) this.bladder = Math.min(1, this.bladder + (dt / 170) * ease);
    if (w.sells('icecream') && !this.bought.icecream) this.treat = Math.min(1, this.treat + (dt / 190) * demand * w.craving('icecream'));
    if (w.sells('balloon') && this.wantsBalloon && !this.bought.balloon) this.balloon = Math.min(1, this.balloon + (dt / 85) * demand * w.craving('balloon'));
    if (w.sells('hats') && this.wantsHat && !this.bought.hats) this.hat = Math.min(1, this.hat + (dt / 75) * demand * w.craving('hats'));
    if (w.sells('bench')) this.tired = Math.min(1, this.tired + (dt / 180) * ease);
    if (w.sells('souvenir') && !this.bought.souvenir) this.gift = Math.min(1, this.gift + (dt / 120) * demand * w.craving('souvenir'));
    if (w.sells('playground') && this.child) this.playful = Math.min(1, this.playful + (dt / 90) * ease);
    if (w.sells('fountain')) this.curious = Math.min(1, this.curious + (dt / 120) * ease);
    if (w.sells('carousel')) this.rideWish = Math.min(1, this.rideWish + (dt / (this.child ? 70 : 170)) * ease);
    if (w.feature('petting')) this.petWish = Math.min(1, this.petWish + dt / (this.child ? 60 : 170));
    // in een vol park koopt een gast minder vaak iets leuks; zijn plezier zakt dan ook wat langzamer
    this.fun = Math.max(0, this.fun - (dt / 240) * (0.5 + 0.5 * ease));
    // in de regen zonder paraplu is het minder leuk, en wie nat wordt gaat eerder naar huis
    const dry = this.umbrella || (this.state === 'sit' && (this.shop?.kind === 'shelter' || this.shop?.kind === 'restaurant'));
    if (rain && !dry && w.feature('weather')) {
      this.fun = Math.max(0, this.fun - dt / 90);
      this.stay -= dt * 0.5;
    }
    if (this.tour) this.fun = Math.max(this.fun, 0.5);
    if (!this.inside && !this.riding && !reach.has(this.tile)) {
      this.gone = true; // het pad onder de gast is weggehaald
      return;
    }
    // hoge nood: de gast houdt het niet meer en doet het ter plekke op het pad
    if (this.state === 'accident') {
      this.timer -= dt;
      this.limbs[0].rotation.x = this.limbs[1].rotation.x = -1.2;
      this.limbs[2].rotation.x = this.limbs[3].rotation.x = -0.5;
      if (this.timer <= 0) {
        w.accident(this, this.mess);
        this.bladder = 0;
        this.fun = Math.max(0, this.fun - 0.25);
        this.state = 'idle';
        this.decide(w, list, reach);
      }
      this.place();
      return;
    }
    // hoge nood: de gast heeft nog een halve minuut om een wc te halen
    this.urgent = this.bladder >= 1 ? this.urgent + dt : 0;
    if (this.urgent > 30 && !(this.state === 'buy' && this.shop?.kind === 'toilet') && !this.inside && !this.riding && !this.tour) {
      this.urgent = 0;
      this.state = 'accident';
      this.timer = 2.4;
      this.route = [];
      this.shop = null;
      this.errand = null;
      this.mess = Math.random() < 0.35 ? 'poop' : 'pee';
      this.wish = { kind: 'toilet', lacking: true };
      this.place();
      return;
    }
    // afval: in de bak als er een vlakbij staat, anders valt het na een poosje op het pad
    if (this.trash > 0) {
      const bin = w.shops.find(sh => sh.kind === 'bin' && Math.abs(shopCenter(sh)[0] - this.gx) < 1.6 && Math.abs(shopCenter(sh)[1] - this.gy) < 1.6);
      if (bin && !this.sloppy) {
        this.trash = 0;
        w.binned(bin);
      } else {
        this.trash -= dt;
        if (this.trash <= 0 && w.sells('bin')) w.dropLitter(this.gx, this.gy);
      }
    }
    if (this.state === 'walk') {
      // een blij kind zet het af en toe op een rennen
      if (this.dash > 0) this.dash -= dt;
      else if (this.child && this.fun > 0.7 && !this.inside && Math.random() < dt * 0.04) this.dash = 2 + Math.random() * 1.5;
      // het regent en de gast heeft geen paraplu: op een holletje naar de schuilhut of de paraplubak
      const speed = this.wheels ? 0.62 : this.dash > 0 || this.hurrying(w) ? 1.35 : 0.8;
      if (this.stride(dt, speed)) this.arrive(w);
    } else if (this.state === 'queue') {
      // in de rij: opschuiven naar je plek en wachten; wie te lang wacht, loopt mopperend weg
      this.waited += dt;
      this.fun = Math.max(0, this.fun - dt / 150);
      if (this.slot && !this.shuffle(dt, reach) && this.face) this.turnTo(this.face[0] - this.gx, this.face[1] - this.gy, dt);
      if (this.waited > PATIENCE / 2 && this.wish && !this.wish.busy) this.wish = { ...this.wish, lacking: true, busy: true };
      if (this.waited > PATIENCE || !this.shop || !w.shops.includes(this.shop)) {
        if (this.shop && w.shops.includes(this.shop)) this.grumble(w);
        if (this.errand) this.postpone(this.errand);
        this.state = 'idle';
        this.shop = null;
        this.errand = null;
        this.slot = null;
        this.gate = -1;
        this.timer = 1.2;
      }
    } else {
      const talk = this.idle?.kind === 'talk' ? this.chatAt : null;
      const face = talk ?? this.face;
      if (this.state === 'buy' && this.shop?.kind === 'toilet') this.toiletStep(dt, w, reach);
      // wie uit de rij aan de beurt is, stapt eerst naar de toonbank
      else if (!(this.state === 'buy' && this.shuffle(dt, reach)) && face) this.turnTo(face[0] - this.gx, face[1] - this.gy, dt);
      if (this.state === 'sit' && this.shop) {
        // in het treintje blijf je zitten tot de volgende halte; op het perron wacht je tot het komt
        if (this.riding) this.timer = Math.max(this.timer, 1);
        else if (this.shop.kind === 'station' && !this.rode) {
          this.waitT += dt;
          this.timer = this.waitT > 75 || !w.trainRuns() ? Math.min(this.timer, 0.2) : Math.max(this.timer, 1);
        } else if (this.shop.kind === 'shelter' && rain) this.timer = Math.max(this.timer, 1.5); // schuilen tot het droog is
      }
      this.timer -= dt;
      if (this.timer <= 0 && !this.finish(w)) {
        this.state = 'idle';
        this.decide(w, list, reach);
      }
    }
    // benen en armen zwaaien tijdens het lopen
    this.phase += dt * 11;
    swing(this.limbs, this.state === 'walk' || this.stepping ? Math.sin(this.phase * (this.dash > 0 ? 1.5 : 1)) * (this.wheels === 'chair' ? 0 : this.stepping ? 0.5 : 0.7) : 0);
    this.gesture(dt, rain && !this.umbrella && w.feature('weather'));
    this.place();
  }

  /** Rent de gast door de regen naar een droge plek? */
  private hurrying(w: GuestWorld): boolean {
    return !this.umbrella && (this.errand === 'shelter' || this.errand === 'umbrella') && w.raining() && w.feature('weather');
  }

  /**
   * Alles wat een gast met zijn armen, hoofd en lijf doet boven op het lopen of staan: zwaaien, wijzen, een foto
   * maken, klappen, aaien, turen, lachen, eten, juichen, mopperen, en kleine dingen tussendoor.
   */
  private gesture(dt: number, wet: boolean): void {
    const right = this.limbs[2], left = this.limbs[3], head = this.head;
    right.rotation.z = left.rotation.z = 0;
    head.rotation.set(0, 0, 0);
    this.hop = 0;
    this.lean = this.tilt = this.twist = 0;
    const standing = this.state === 'idle' || this.state === 'queue' || this.state === 'watch';
    // in de rolstoel liggen de handen op de wielen; de kinderwagen duw je voor je uit
    if (this.wheels === 'chair') {
      this.limbs[0].rotation.x = this.limbs[1].rotation.x = -1.45;
      right.rotation.x = left.rotation.x = this.state === 'walk' ? -0.5 + Math.sin(this.phase * 0.5) * 0.35 : -0.4;
    } else if (this.wheels === 'pram') right.rotation.x = left.rotation.x = -1.25;
    // door de regen naar de schuilhut: de handen boven het hoofd
    else if (wet && this.state === 'walk' && (this.errand === 'shelter' || this.errand === 'umbrella')) {
      right.rotation.x = left.rotation.x = -2.7;
      right.rotation.z = -0.35;
      left.rotation.z = 0.35;
      this.lean = 0.14;
    }
    if (this.state === 'watch' && this.act) {
      this.actT += dt;
      const t = this.actT;
      if (this.act === 'wave') {
        right.rotation.x = -2.7;
        right.rotation.z = Math.sin(t * 9) * 0.45;
      } else if (this.act === 'point') {
        right.rotation.x = -1.45 + Math.sin(t * 3) * 0.06;
        head.rotation.x = -0.1;
      } else if (this.act === 'photo') {
        // de camera voor de ogen, en af en toe klik
        right.rotation.x = left.rotation.x = -1.95;
        this.lean = Math.sin(t * 2) > 0.9 ? -0.06 : 0;
      } else if (this.act === 'clap') {
        const clap = Math.abs(Math.sin(t * 10)) * 0.5;
        right.rotation.x = left.rotation.x = -1.25;
        right.rotation.z = -clap;
        left.rotation.z = clap;
      } else if (this.act === 'pet') {
        // vooroverbuigen en aaien
        this.lean = 0.42;
        right.rotation.x = -1.0 + Math.sin(t * 5) * 0.28;
        head.rotation.x = 0.2;
      } else if (this.act === 'jump') {
        this.hop = Math.abs(Math.sin(t * 7)) * 0.12;
        right.rotation.x = left.rotation.x = -2.8;
      } else if (this.act === 'peer') {
        // door je handen turen als door een verrekijker
        right.rotation.x = left.rotation.x = -2.3;
        right.rotation.z = 0.35;
        left.rotation.z = -0.35;
        head.rotation.y = Math.sin(t * 1.5) * 0.4;
      } else if (this.act === 'kneel') {
        // door de knieën om het beter te zien
        this.lean = 0.28;
        this.limbs[0].rotation.x = -0.9;
        this.limbs[1].rotation.x = 0.5;
        right.rotation.x = -0.7;
      } else if (this.act === 'call') {
        right.rotation.x = -2.4;
        right.rotation.z = 0.6;
        head.rotation.x = -0.2;
      } else {
        // lachen: schuddende schouders, handen op de buik
        this.hop = Math.abs(Math.sin(t * 12)) * 0.025;
        head.rotation.x = -0.2 + Math.sin(t * 12) * 0.1;
        right.rotation.x = left.rotation.x = -0.9;
        right.rotation.z = 0.5;
        left.rotation.z = -0.5;
      }
    } else if (standing && !this.wheels) {
      // iets kleins tussendoor
      this.idleIn -= dt;
      if (!this.idle && this.idleIn <= 0) {
        const kinds: Idle[] = wet ? ['shiver'] : this.state === 'queue' ? ['tap', 'watch', 'look', 'sway'] : this.child ? ['look', 'dance', 'scratch', 'sway', 'stretch'] : ['look', 'scratch', 'watch', 'stretch', 'selfie', 'nod', 'sway'];
        this.idle = { kind: pick(kinds), t: 0, dur: 1.4 + Math.random() * 1.6 };
      }
      const a = this.idle;
      if (a) {
        a.t += dt;
        const t = a.t, u = Math.min(1, t / a.dur);
        if (a.kind === 'look') head.rotation.y = Math.sin(t * 2.2) * 0.9;
        else if (a.kind === 'scratch') {
          right.rotation.x = -2.6;
          right.rotation.z = 0.5 + Math.sin(t * 14) * 0.12;
          head.rotation.z = 0.12;
        } else if (a.kind === 'watch') {
          // op het horloge kijken
          left.rotation.x = -1.3;
          left.rotation.z = -0.7;
          head.rotation.x = 0.35;
        } else if (a.kind === 'stretch') {
          const s = Math.sin(u * Math.PI);
          right.rotation.x = left.rotation.x = -3.0 * s;
          right.rotation.z = -0.4 * s;
          left.rotation.z = 0.4 * s;
          this.lean = -0.12 * s;
        } else if (a.kind === 'selfie') {
          right.rotation.x = -1.9;
          right.rotation.z = -0.5;
          head.rotation.z = 0.15;
          this.twist = 0.25;
        } else if (a.kind === 'dance') {
          this.hop = Math.abs(Math.sin(t * 8)) * 0.07;
          this.twist = Math.sin(t * 8) * 0.4;
          right.rotation.x = -1.2 + Math.sin(t * 8) * 0.6;
          left.rotation.x = -1.2 - Math.sin(t * 8) * 0.6;
        } else if (a.kind === 'tap') this.limbs[0].rotation.x = -Math.abs(Math.sin(t * 9)) * 0.35;
        else if (a.kind === 'nod') head.rotation.x = Math.sin(t * 7) * 0.25;
        else if (a.kind === 'shiver') {
          // koud en nat: armen over elkaar en bibberen
          right.rotation.x = left.rotation.x = -1.1;
          right.rotation.z = 0.9;
          left.rotation.z = -0.9;
          this.twist = Math.sin(t * 38) * 0.05;
        } else if (a.kind === 'talk') {
          // kletsen: om de beurt een handgebaar en knikken
          right.rotation.x = -0.9 + Math.sin(t * 6) * 0.45;
          left.rotation.x = -0.5 + Math.cos(t * 5) * 0.3;
          head.rotation.x = Math.sin(t * 4) * 0.15;
        } else this.tilt = Math.sin(t * 2) * 0.07;
        if (t >= a.dur) {
          this.idle = null;
          this.chatAt = null;
          this.idleIn = 2.5 + Math.random() * 5;
        }
      }
    } else if (this.state === 'walk') this.idle = null;
    if (this.state === 'buy' && this.shop?.kind !== 'toilet') right.rotation.x = -1.3; // de hand uitsteken naar de toonbank
    if (this.eating > 0) {
      // een hap of een slok: de hand gaat naar de mond en weer terug
      this.eating -= dt;
      left.rotation.x = -1.75 + Math.sin(this.phase * 0.45) * 0.5;
      if (this.eating <= 0 && this.snack) {
        left.remove(this.snack);
        this.snack = null;
      }
    }
    // de paraplu omhoog houden als het regent
    if (this.brolly?.visible) left.rotation.x = -2.5;
    // bij het weggaan nog even zwaaien
    if (this.leaving && this.fun > 0.6 && this.state === 'walk' && this.route.length < 3 && !this.wheels) this.hello = Math.max(this.hello, 0.3);
    if (this.hello > 0) {
      this.hello -= dt;
      right.rotation.x = -2.7;
      right.rotation.z = Math.sin(this.phase * 0.85) * 0.5;
    }
    if (this.moan > 0) {
      // mopperen: handen in de zij en heen en weer draaien
      this.moan -= dt;
      right.rotation.x = left.rotation.x = -0.5;
      right.rotation.z = -0.5;
      left.rotation.z = 0.5;
      this.tilt = Math.sin(this.moan * 14) * 0.08;
      head.rotation.y = Math.sin(this.moan * 9) * 0.5;
    }
    if (this.joy > 0) {
      // juichen: armen omhoog en springen
      this.joy -= dt;
      right.rotation.x = left.rotation.x = -2.9;
      this.hop = Math.abs(Math.sin(this.joy * 9)) * 0.13;
    } else if (this.child && this.state === 'walk' && this.fun > 0.6) this.hop = Math.abs(Math.sin(this.phase * 0.5)) * 0.05; // een blij kind huppelt
  }
}

// ------------------------------------------------------------ het treintje
/**
 * Het treintje rijdt over het pad van halte naar halte en weer terug naar de eerste. Bij elke halte stopt het
 * even: wie erin zat stapt uit, wie stond te wachten stapt in. Met minder dan twee haltes staat het stil.
 */
export class Train {
  running = false;
  private points: [number, number][] = [];
  private dist: number[] = [];
  private total = 0;
  private stops: { shop: ShopSpot; at: number; tile: number }[] = [];
  private s = 0;
  private next = 0;
  private wait = 0;
  private key = '';
  private checkIn = 0;
  private riders: (Guest | null)[] = new Array(TRAIN.wagons * TRAIN.seats).fill(null);
  /** Net gestopt bij een halte (voor het belletje). */
  arrived = false;

  /** `cars`: de locomotief en de wagons uit het beeld, in die volgorde. */
  constructor(private cars: THREE.Object3D[]) {}

  /** De route opnieuw uitzoeken: langs alle haltes die aan het pad staan, in de volgorde waarin ze gebouwd zijn. */
  private plan(w: GuestWorld, reach: Set<number>): void {
    const stations = w.shops.filter(sh => sh.kind === 'station').map(shop => ({ shop, tile: doorOf(w, reach, shop) })).filter((x): x is { shop: ShopSpot; tile: number } => x.tile !== null);
    const key = stations.map(x => `${x.shop.x},${x.shop.y},${x.tile}`).join(';') + `/${reach.size}`;
    if (key === this.key) return;
    this.key = key;
    this.points = [];
    this.dist = [];
    this.stops = [];
    this.total = 0;
    this.drop();
    let ok = stations.length >= 2;
    for (let i = 0; ok && i < stations.length; i++) {
      const leg = w.grid.path(stations[i].tile, stations[(i + 1) % stations.length].tile, t => !reach.has(t));
      if (!leg) {
        ok = false;
        break;
      }
      this.stops.push({ shop: stations[i].shop, at: this.total, tile: stations[i].tile });
      for (let k = 0; k < leg.length - 1; k++) {
        const [x, y] = tileXY(leg[k]);
        this.points.push([x + 0.5, y + 0.5]);
        this.dist.push(this.total);
        this.total += 1;
      }
    }
    this.running = ok && this.total > 1;
    this.s = 0;
    this.next = 1 % Math.max(1, this.stops.length);
    this.wait = TRAIN.stop;
    for (const car of this.cars) car.visible = this.running;
  }

  /** Iedereen eruit (de route is veranderd). */
  private drop(): void {
    const tile = this.stops[0]?.tile ?? ENTRANCE;
    this.riders.forEach((g, i) => {
      if (g?.riding === this) g.alight(tile);
      this.riders[i] = null;
    });
  }

  /** Het punt op de route op afstand `d` vanaf het begin: [x, y, richting]. */
  private point(d: number): [number, number, number] {
    const n = this.points.length;
    if (!n) return [0, 0, 0];
    const u = ((d % this.total) + this.total) % this.total;
    const i = Math.min(n - 1, Math.floor(u)), a = this.points[i], b = this.points[(i + 1) % n], f = u - i;
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, Math.atan2(b[0] - a[0], b[1] - a[1])];
  }

  /** Waar plek `seat` nu is: de wagon en het bankje daarin. */
  seatPos(seat: number): [number, number, number] {
    const wagon = Math.floor(seat / TRAIN.seats) + 1, j = seat % TRAIN.seats;
    return this.point(this.s - wagon * TRAIN.gap - (j - (TRAIN.seats - 1) / 2) * 0.26);
  }

  update(dt: number, w: GuestWorld, reach: Set<number>, guests: Guest[]): void {
    this.arrived = false;
    this.checkIn -= dt;
    if (this.checkIn <= 0) {
      this.checkIn = 1.5;
      this.plan(w, reach);
    }
    if (!this.running) return;
    if (this.wait > 0) {
      this.wait -= dt;
    } else {
      const goal = this.next === 0 ? this.total : this.stops[this.next].at;
      this.s += TRAIN.speed * dt;
      if (this.s >= goal) {
        // bij de halte: uitstappen, instappen, even wachten
        const stop = this.stops[this.next];
        this.s = stop.at;
        this.wait = TRAIN.stop;
        this.arrived = true;
        this.riders.forEach((g, i) => {
          if (g && g.riding === this && !g.gone) g.alight(stop.tile);
          this.riders[i] = null;
        });
        let seat = 0;
        for (const g of guests) {
          if (seat >= this.riders.length) break;
          if (g.waitingAt !== stop.shop) continue;
          this.riders[seat] = g;
          g.board(this, seat++);
        }
        this.next = (this.next + 1) % this.stops.length;
      }
    }
    this.cars.forEach((car, k) => {
      const [x, y, h] = this.point(this.s - k * TRAIN.gap);
      car.position.set(toWorldX(x), 0, toWorldZ(y));
      car.rotation.y = h;
    });
  }
}

// ------------------------------------------------------------ alle gasten samen
export class GuestManager {
  guests: Guest[] = [];
  /** Het treintje, zodra het beeld er een heeft gemaakt. */
  train: Train | null = null;
  private spawnIn = 2;
  private list: number[] = [];
  private reach = new Set<number>();
  private reachIn = 0;
  private chatIn = 3;
  private crowd: Crowd;

  constructor(scene: THREE.Scene, private world: GuestWorld) {
    this.crowd = new Crowd(scene);
  }

  snapshot(): GuestSave[] {
    return this.guests.filter(g => !g.gone && !g.special && !g.inside && !g.riding).map(g => g.snapshot());
  }

  /** De gasten uit een bewaard spel lopen weer rond waar ze waren. Kind blijft kind; kleren zijn nieuw. */
  restore(list: GuestSave[], dx = 0, dy = 0): void {
    const species = this.world.parkSpecies();
    for (const s of list) {
      const guest = new Guest(ENTRANCE, species, { child: s.child });
      guest.restore(s, dx, dy);
      this.guests.push(guest);
    }
  }

  /** Kunnen gasten deze tegel bereiken (pad dat aan de ingang vastzit)? */
  reaches(tile: number): boolean {
    return this.reach.has(tile);
  }

  /** Is de ingang met een pad verbonden? Zonder pad komen er geen gasten. */
  get open(): boolean {
    return this.reach.size > 0;
  }

  /** Alle padtegels waar gasten kunnen komen. */
  get paths(): Set<number> {
    return this.reach;
  }

  /** Alle padtegels die vanaf de ingang te bereiken zijn. */
  private refresh(): void {
    const grid = this.world.grid;
    this.reach = new Set();
    if (isPath(grid.terrain[ENTRANCE])) {
      const queue = [ENTRANCE];
      this.reach.add(ENTRANCE);
      for (let head = 0; head < queue.length; head++)
        for (const n of grid.neighbors(queue[head]))
          if (isPath(grid.terrain[n]) && !this.reach.has(n)) {
            this.reach.add(n);
            queue.push(n);
          }
    }
    this.list = [...this.reach];
  }

  private make(opts: GuestOptions = {}, tile = ENTRANCE): Guest {
    const guest = new Guest(tile, this.world.parkSpecies(), opts);
    this.guests.push(guest);
    return guest;
  }

  /** Een schoolklas: een juf of meester met een rij kinderen in dezelfde kleur shirt erachteraan. */
  spawnClass(n = 6): Guest | null {
    if (!this.open) return null;
    const teacher = this.make({ child: false, shirt: 0xf08a24 });
    teacher.tour = { stops: 5 };
    teacher.badge = 'schoolclass';
    teacher.lead();
    for (let i = 0; i < n; i++) this.make({ child: true, shirt: 0xffd23f }).join(teacher, i + 1);
    return teacher;
  }

  /** Een verjaardag: de jarige en zijn vriendjes, allemaal met een feestmuts, eerst naar de speeltuin. */
  spawnParty(n = 4): Guest | null {
    if (!this.open) return null;
    const parent = this.make({ child: false });
    parent.tour = { stops: 2, party: true };
    parent.badge = 'cake';
    parent.lead();
    for (let i = 0; i < n; i++) {
      const kid = this.make({ child: true });
      kid.addHat('hat_party');
      kid.join(parent, i + 1);
    }
    return parent;
  }

  /** De beroemde gast: gouden shirt, zonnebril en een ster boven zijn hoofd. */
  spawnStar(): Guest | null {
    return this.open ? this.make({ star: true }) : null;
  }

  /** Een kind raakt zijn papa of mama kwijt: het staat ergens op het pad te huilen. */
  spawnLost(): { child: Guest; parent: Guest } | null {
    const parents = this.guests.filter(g => !g.child && g.free);
    const parent = parents[Math.floor(Math.random() * parents.length)];
    if (!parent || this.list.length < 8) return null;
    // een plek een eind bij papa of mama vandaan
    const far = this.list.filter(t => Math.hypot(tileXY(t)[0] - parent.gx, tileXY(t)[1] - parent.gy) > 5);
    const tile = far[Math.floor(Math.random() * far.length)];
    if (tile === undefined) return null;
    const child = this.make({ child: true }, tile);
    child.loseTo(parent);
    return { child, parent };
  }

  update(dt: number): void {
    this.reachIn -= dt;
    if (this.reachIn <= 0) {
      this.reachIn = 1;
      this.refresh();
    }
    const capacity = this.world.capacity();
    if (this.open && this.guests.length < capacity) {
      this.spawnIn -= dt;
      if (this.spawnIn <= 0) {
        // hoe meer gasten het park trekt, hoe sneller ze na elkaar binnenkomen
        this.spawnIn = Math.max(0.8, 110 / capacity) * (0.7 + Math.random() * 0.6);
        const wheels = this.world.feature('wheels') && Math.random() < 0.06 ? (Math.random() < 0.5 ? 'chair' : 'pram') : undefined;
        this.make({ wheels });
      }
    }
    this.lines();
    for (const g of this.guests) g.update(dt, this.world, this.list, this.reach);
    if (this.guests.some(g => g.gone)) this.guests = this.guests.filter(g => !g.gone);
    this.train?.update(dt, this.world, this.reach, this.guests);
    // af en toe maken twee gasten die naast elkaar staan een praatje
    this.chatIn -= dt;
    if (this.chatIn <= 0 && this.guests.length > 1) {
      this.chatIn = 1.2 + Math.random() * 2;
      const a = this.guests[Math.floor(Math.random() * this.guests.length)];
      const b = a.chatty ? this.guests.find(g => g !== a && g.chatty && Math.hypot(g.gx - a.gx, g.gy - a.gy) < 1.1) : undefined;
      if (b) {
        a.chat(b);
        b.chat(a);
      }
    }
    this.crowd.begin();
    for (const g of this.guests) this.crowd.add(g.mesh);
    this.crowd.end();
  }

  /**
   * De rijen: per kraam tellen wie er geholpen wordt en wie er wacht, de wachtenden een plek in de rij
   * geven (achter elkaar langs het pad) en de voorste laten doorlopen zodra er plek is. Hier wordt ook
   * bijgehouden welke wc-deur open moet.
   */
  private lines(): void {
    const waiting = new Map<ShopSpot, Guest[]>();
    for (const shop of this.world.shops) {
      shop.busyNow = 0;
      shop.line = 0;
      shop.used = 0;
      if (shop.kind === 'toilet' && shop.mesh) shop.mesh.userData.ajar = 0;
    }
    for (const g of this.guests) {
      const shop = g.using;
      if (!shop) continue;
      if (g.queueing) waiting.set(shop, [...(waiting.get(shop) ?? []), g]);
      else {
        shop.busyNow = (shop.busyNow ?? 0) + 1;
        shop.used = (shop.used ?? 0) | (1 << g.seat);
        if (shop.mesh && g.doorOpen) shop.mesh.userData.ajar |= 1 << g.seat;
      }
    }
    for (const [shop, line] of waiting) {
      line.sort((p, q) => p.joined - q.joined);
      while (line.length && (shop.busyNow ?? 0) < (AT_ONCE[shop.kind] ?? 1)) line.shift()!.serve();
      shop.line = line.length;
      if (!line.length) continue;
      // de rij begint op de tegel voor de kraam waar de gasten aankwamen. Die plek blijft vast: zo schuift de
      // rij niet steeds verder het pad op als de voorste aan de beurt is.
      const head = line[0].gate >= 0 ? line[0].gate : line[0].tile;
      const [hx, hy] = tileXY(head);
      const [cx, cy] = shopCenter(shop);
      const ox = hx + 0.5 - cx, oy = hy + 0.5 - cy;
      const away: [number, number] = Math.abs(ox) > Math.abs(oy) ? [Math.sign(ox), 0] : [0, Math.sign(oy)];
      // de rij loopt langs het pad: de kant op waar het meeste pad ligt. Bij gelijke stand eerst langs de gevel
      // naar het midden van het gebouw toe, zodat de rij voor de deur staat en niet ernaast.
      const turn = ox * away[1] + oy * away[0] > 0 ? -1 : 1;
      const sides: [number, number][] = [[away[1] * turn, away[0] * turn], [-away[1] * turn, -away[0] * turn], away];
      const run = (d: [number, number]): number => {
        let n = 0;
        while (n < 4 && this.reach.has(tileIndex(hx + d[0] * (n + 1), hy + d[1] * (n + 1))) && hx + d[0] * (n + 1) >= 0 && hx + d[0] * (n + 1) < W) n++;
        return n;
      };
      const dir = sides.reduce((best, d) => (run(d) > run(best) ? d : best));
      // op de wc is de gast die aan de beurt is binnen: daar begint de rij vooraan. Bij een toonbank staat hij
      // op de eerste plek en sluit de rij achter hem aan.
      const first = shop.kind === 'toilet' ? 0 : 1;
      // niet verder dan het pad reikt; is het pad kort, dan gaat de rij dichter op elkaar staan
      const room = run(dir) + 0.35, last = first + line.length - 1;
      const gap = last > 0 ? Math.min(0.5, Math.max(0.3, room / last)) : 0.5;
      for (let i = 0; i < line.length; i++) {
        const g = line[i], at = Math.min((first + i) * gap, room);
        const sx = hx + 0.5 + dir[0] * at, sy = hy + 0.5 + dir[1] * at;
        if (g.slot) {
          g.slot[0] = sx;
          g.slot[1] = sy;
        } else g.slot = [sx, sy];
      }
    }
  }

  /** Feest: alle gasten juichen even (als een level gehaald is). */
  cheer(): void {
    for (const g of this.guests) g.joy = 1.4 + Math.random() * 1.2;
  }

  /** De gasten in de buurt van dit punt juichen (bij het feest, of als het verdwaalde kind terug is). */
  cheerNear(gx: number, gy: number, r: number): void {
    for (const g of this.guests) if (Math.hypot(g.gx - gx, g.gy - gy) < r) g.joy = Math.max(g.joy, 1 + Math.random());
  }

  stats(): { total: number; happy: number; lacking: Record<string, number> } {
    const lacking: Record<string, number> = {};
    for (const g of this.guests) if (g.wish?.lacking) lacking[g.wish.kind] = (lacking[g.wish.kind] ?? 0) + 1;
    return { total: this.guests.length, happy: this.guests.filter(g => g.happy).length, lacking };
  }
}

/** Kramen waar een gast iets koopt (voor de kas). */
export const sellsForCoin = (kind: ShopKind): boolean => STALLS.includes(kind);

// ------------------------------------------------------------ personeel
export interface KeeperPoop {
  gx: number;
  gy: number;
}
export interface KeeperTrough {
  x: number;
  y: number;
  food: string | null;
  amount: number;
}
export type WorkerRole = 'feed' | 'clean' | 'fix' | 'vet' | 'guide' | 'photo';
/** Een ziek dier dat de dierenarts beter moet maken. */
export interface VetJob {
  animal: object;
  gx: number;
  gy: number;
}
/** Een versleten hek dat gemaakt moet worden. */
export interface FixJob {
  e: { o: 'h' | 'v'; x: number; y: number };
  gx: number;
  gy: number;
}
export interface WorkerWorld {
  grid: Grid;
  /** Voerbakken die bijgevuld moeten worden, met het voer dat erin hoort. */
  feedJobs(): { trough: KeeperTrough; food: FoodId }[];
  /** Poep (in de verblijven en op het pad) en afval dat opgeruimd moet worden. */
  cleanJobs(): KeeperPoop[];
  /** Versleten hekken die gemaakt moeten worden. */
  fixJobs(): FixJob[];
  workerFix(job: FixJob): void;
  /** Mag een werker over deze tegel lopen? Niet door een gebouw, voerbak of versiering. */
  walkable(tile: number): boolean;
  workerFill(trough: KeeperTrough, food: FoodId): void;
  workerClean(mess: KeeperPoop): void;
  /** Deze klus is niet te bereiken: er zit geen poort in het hek. */
  noGate(gx: number, gy: number): void;
  /** Zieke dieren, voor de dierenarts. */
  vetJobs(): VetJob[];
  workerHeal(job: VetJob): void;
  /** De padtegels waar gasten kunnen komen: daar lopen de gids en de fotograaf. */
  pathTiles(): Set<number>;
  /** Padtegels waar iets te zien is, en waar je dan naar kijkt. */
  tourSpots(): number[];
  viewOf(tile: number): [number, number] | null;
  /** Gasten in de buurt die mee kunnen met een rondleiding (hooguit `n`). */
  tourGuests(gx: number, gy: number, n: number): Guest[];
  /** De gids staat met zijn groepje bij de dieren en vertelt erover. */
  tourStop(group: Guest[], tile: number): void;
}

// Al het personeel draagt hetzelfde groene pak; de rol zie je aan de streep, de pet en wat ze dragen.
const ROLE_COLOR: Record<WorkerRole, number> = { feed: 0xf5a623, clean: 0x4a90e2, fix: 0xe0584f, vet: 0xf7f4ec, guide: 0xffd23f, photo: 0x7a5cc9 };
const BAG_GEO = new THREE.BoxGeometry(0.15, 0.12, 0.09).translate(0, -0.2, 0.05);
const CROSS_GEO = new THREE.BoxGeometry(0.07, 0.025, 0.012).translate(0, -0.2, 0.1);
const CROSS2_GEO = new THREE.BoxGeometry(0.025, 0.07, 0.012).translate(0, -0.2, 0.1);
const POLE_GEO = new THREE.BoxGeometry(0.02, 0.5, 0.02).translate(0, -0.3, 0.05);
const PENNANT_GEO = new THREE.BoxGeometry(0.16, 0.1, 0.015).translate(0.08, -0.5, 0.05);
const CAMERA_GEO = new THREE.BoxGeometry(0.13, 0.09, 0.08).translate(0, -0.19, 0.07);
const LENS_GEO = new THREE.CylinderGeometry(0.03, 0.03, 0.05, 8).rotateX(Math.PI / 2).translate(0, -0.19, 0.13);
const CART_GEO = new THREE.BoxGeometry(0.3, 0.16, 0.34);
const CART_WHEEL_GEO = new THREE.CylinderGeometry(0.07, 0.07, 0.03, 10).rotateZ(Math.PI / 2);
const CART_BAR_GEO = new THREE.BoxGeometry(0.26, 0.025, 0.025);
const HAMMER_GEO = new THREE.BoxGeometry(0.03, 0.3, 0.03).translate(0, -0.14, 0.06);
const HAMMERHEAD_GEO = new THREE.BoxGeometry(0.13, 0.07, 0.07).translate(0, -0.3, 0.06);
const STRIPE_GEO = new THREE.BoxGeometry(0.21, 0.05, 0.14);
const BROOM_GEO = new THREE.BoxGeometry(0.025, 0.46, 0.025).translate(0, -0.1, 0.06);
const BRISTLE_GEO = new THREE.BoxGeometry(0.13, 0.07, 0.05).translate(0, -0.34, 0.06);
const SACK_GEO = new THREE.BoxGeometry(0.13, 0.16, 0.1).translate(0, -0.2, 0.05);
const PATCH_GEO = new THREE.BoxGeometry(0.07, 0.07, 0.01).translate(0, -0.2, 0.105);

/**
 * Een werker loopt door het hele park. Een voerder vult lege voerbakken, een schoonmaker veegt poep en raapt
 * afval op, een klusser timmert versleten hekken vast en de dierenarts maakt zieke dieren beter. Naar binnen
 * kunnen ze alleen door een poort. De gids neemt een groepje gasten mee langs de dieren en de fotograaf staat
 * bij een verblijf foto's te maken: die twee blijven op het pad.
 */
export class Worker implements Leader {
  readonly mesh: THREE.Group;
  readonly height: number;
  gx: number;
  gy: number;
  /** Heeft de werker dit uur loon gekregen? Zo niet, dan wacht hij. */
  paid = true;
  private limbs: THREE.Mesh[];
  private route: number[] = [];
  private job: { key: object; trough?: KeeperTrough; food?: FoodId; mess?: KeeperPoop; fix?: FixJob; heal?: VetJob } | null = null;
  private timer = 0.5;
  private working = 0;
  private heading = 0;
  private phase = 0;
  private shirts: THREE.Mesh[];
  private cartMesh: THREE.Group | null = null;
  /** De kleur van het pak (een plek in SUIT_COLORS) en of de werker een karretje heeft: daarmee werkt hij sneller. */
  suit = 0;
  cart = false;
  // de gids: het spoor waar zijn groepje overheen loopt, wie er meeloopt en hoeveel keer hij nog stopt
  trail: [number, number][] = [];
  gone = false;
  watching = false;
  face: [number, number] | null = null;
  private group: Guest[] = [];
  private stops = 0;
  private standFor = 0;
  private stopTile = -1;
  /** Zoveel tellen houdt de fotograaf zijn camera nog omhoog (klik!). */
  private flash = 0;

  constructor(gx: number, gy: number, readonly role: WorkerRole) {
    const person = makePerson(true, { shirt: 0x4fa35a, hat: ROLE_COLOR[role] });
    this.mesh = person.group;
    this.limbs = person.limbs;
    this.shirts = person.shirts;
    this.height = person.height;
    // het schort van een verkoper hoort hier niet bij: dat laatste onderdeel gaat eraf
    this.mesh.remove(this.mesh.children[this.mesh.children.length - 1]);
    const accent = mat(ROLE_COLOR[role]);
    const stripe = new THREE.Mesh(STRIPE_GEO, accent);
    stripe.position.set(0, 0.33, 0);
    this.mesh.add(stripe);
    // wat hij draagt, zit aan zijn arm en beweegt dus mee
    if (role === 'clean') this.limbs[2].add(new THREE.Mesh(BROOM_GEO, mat(0xa8743f)), new THREE.Mesh(BRISTLE_GEO, mat(0xffd23f)));
    else if (role === 'fix') this.limbs[2].add(new THREE.Mesh(HAMMER_GEO, mat(0xa8743f)), new THREE.Mesh(HAMMERHEAD_GEO, mat(0x8a857a)));
    else if (role === 'vet') this.limbs[2].add(new THREE.Mesh(BAG_GEO, mat(0xf7f4ec)), new THREE.Mesh(CROSS_GEO, mat(0xe0584f)), new THREE.Mesh(CROSS2_GEO, mat(0xe0584f)));
    else if (role === 'guide') this.limbs[2].add(new THREE.Mesh(POLE_GEO, mat(0xa8743f)), new THREE.Mesh(PENNANT_GEO, mat(0xe0584f)));
    else if (role === 'photo') this.limbs[2].add(new THREE.Mesh(CAMERA_GEO, mat(0x38343c)), new THREE.Mesh(LENS_GEO, mat(0x9fd8f5)));
    else this.limbs[2].add(new THREE.Mesh(SACK_GEO, mat(0xb88a52)), new THREE.Mesh(PATCH_GEO, accent));
    this.gx = gx;
    this.gy = gy;
    this.place();
  }

  get tile(): number {
    return tileIndex(Math.floor(this.gx), Math.floor(this.gy));
  }

  private place(): void {
    this.mesh.position.set(toWorldX(this.gx), 0, toWorldZ(this.gy));
    this.mesh.rotation.y = this.heading;
  }

  /** Het pak een andere kleur geven. */
  setSuit(index: number): void {
    this.suit = index;
    const m = mat(SUIT_COLORS[index] ?? SUIT_COLORS[0]);
    for (const mesh of this.shirts) mesh.material = m;
  }

  /** Een karretje erbij: de werker duwt het voor zich uit, loopt sneller en is sneller klaar. */
  setCart(on: boolean): void {
    this.cart = on;
    if (on && !this.cartMesh) {
      const cart = new THREE.Group();
      const box = new THREE.Mesh(CART_GEO, mat(0xc58a4b));
      box.position.set(0, 0.2, 0.36);
      const bar = new THREE.Mesh(CART_BAR_GEO, mat(0x8a8f98));
      bar.position.set(0, 0.34, 0.17);
      cart.add(box, bar);
      for (const x of [0.17, -0.17]) {
        const wheel = new THREE.Mesh(CART_WHEEL_GEO, mat(0x38343c));
        wheel.position.set(x, 0.07, 0.36);
        cart.add(wheel);
      }
      cart.traverse(o => { o.castShadow = true; });
      this.cartMesh = cart;
      this.mesh.add(cart);
    }
    if (this.cartMesh) this.cartMesh.visible = on;
  }

  /** De fotograaf maakt een foto: camera omhoog. */
  snap(): void {
    this.flash = 0.7;
  }

  /** De rondleiding is afgelopen: het groepje gaat weer zijn eigen gang. */
  private dismiss(): void {
    for (const g of this.group) if (g.leader === this) g.release();
    this.group = [];
    this.stops = 0;
  }

  /** Laat de klus los (als de werker weggaat of de klus er niet meer is). */
  drop(claimed: Set<object>): void {
    if (this.job) claimed.delete(this.job.key);
    this.job = null;
    this.route = [];
    this.working = 0;
    this.dismiss();
  }

  /** De gids en de fotograaf lopen over het pad van de ene kijkplek naar de andere. */
  private stroll(w: WorkerWorld): void {
    const paths = w.pathTiles();
    this.timer = 2;
    if (!paths.size) return;
    if (!paths.has(this.tile)) {
      // eerst naar het pad lopen
      const route = this.routeTo(w, paths);
      if (route) this.route = route.slice(1);
      return;
    }
    const spots = w.tourSpots().filter(t => t !== this.stopTile);
    const goal = spots[Math.floor(Math.random() * spots.length)];
    const route = goal === undefined ? null : w.grid.path(this.tile, goal, i => !paths.has(i));
    if (!route) return;
    // de gids verzamelt eerst een groepje gasten
    if (this.role === 'guide' && !this.group.length) {
      this.group = w.tourGuests(this.gx, this.gy, 5);
      this.group.forEach((g, i) => g.join(this, i + 1));
      this.stops = this.group.length ? 3 : 0;
      this.trail = [[this.gx, this.gy]];
    }
    this.route = route.slice(1);
    this.stopTile = goal;
    if (!this.route.length) this.halt(w);
  }

  /** Aangekomen bij een kijkplek: naar de dieren kijken en vertellen, of foto's maken. */
  private halt(w: WorkerWorld): void {
    this.face = w.viewOf(this.tile);
    if (this.face) this.heading = Math.atan2(this.face[0] - this.gx, this.face[1] - this.gy);
    this.watching = true;
    this.standFor = this.role === 'guide' ? (this.group.length ? 7 : 2) : 20 + Math.random() * 15;
  }

  /** De kortste weg naar een van deze tegels: over vrije tegels en door poorten. */
  private routeTo(w: WorkerWorld, goals: Set<number>): number[] | null {
    if (goals.has(this.tile)) return [this.tile];
    const prev = new Map<number, number>([[this.tile, -1]]);
    const queue = [this.tile];
    for (let head = 0; head < queue.length; head++) {
      const i = queue[head];
      for (const j of w.grid.neighbors(i, true)) {
        if (prev.has(j) || !(goals.has(j) || w.walkable(j))) continue;
        prev.set(j, i);
        if (goals.has(j)) {
          const route = [j];
          for (let k = i; k !== -1; k = prev.get(k)!) route.push(k);
          return route.reverse();
        }
        queue.push(j);
      }
    }
    return null;
  }

  /** Zoekt de dichtstbijzijnde klus die nog niemand doet en waar hij bij kan. */
  private plan(w: WorkerWorld, claimed: Set<object>): void {
    const near = <T extends { at: [number, number] }>(list: T[]): T[] =>
      list.sort((p, q) => Math.hypot(p.at[0] - this.gx, p.at[1] - this.gy) - Math.hypot(q.at[0] - this.gx, q.at[1] - this.gy)).slice(0, 6);
    if (this.role === 'feed') {
      const jobs = w.feedJobs().filter(j => !claimed.has(j.trough)).map(j => ({ ...j, at: [j.trough.x + 0.5, j.trough.y + 0.5] as [number, number] }));
      for (const j of near(jobs)) {
        // naast de voerbak gaan staan, in het verblijf
        const beside = new Set(w.grid.neighbors(tileIndex(j.trough.x, j.trough.y)).filter(i => w.walkable(i)));
        const route = beside.size ? this.routeTo(w, beside) : null;
        if (!route) {
          w.noGate(j.at[0], j.at[1]);
          continue;
        }
        this.job = { key: j.trough, trough: j.trough, food: j.food };
        claimed.add(j.trough);
        this.route = route.slice(1);
        return;
      }
    } else if (this.role === 'guide' || this.role === 'photo') {
      return this.stroll(w);
    } else if (this.role === 'vet') {
      const jobs = w.vetJobs().filter(j => !claimed.has(j.animal)).map(j => ({ heal: j, at: [j.gx, j.gy] as [number, number] }));
      for (const j of near(jobs)) {
        // naast het zieke dier gaan staan, in het verblijf
        const here = tileIndex(Math.floor(j.heal.gx), Math.floor(j.heal.gy));
        const beside = new Set([here, ...w.grid.neighbors(here)].filter(i => w.walkable(i)));
        const route = beside.size ? this.routeTo(w, beside) : null;
        if (!route) {
          w.noGate(j.at[0], j.at[1]);
          continue;
        }
        this.job = { key: j.heal.animal, heal: j.heal };
        claimed.add(j.heal.animal);
        this.route = route.slice(1);
        return;
      }
    } else if (this.role === 'fix') {
      const jobs = w.fixJobs().filter(j => !claimed.has(j)).map(j => ({ fix: j, at: [j.gx, j.gy] as [number, number] }));
      for (const j of near(jobs)) {
        // naast het hek gaan staan: aan de kant waar hij bij kan
        const { o, x, y } = j.fix.e;
        const sides = (o === 'h' ? [[x, y - 1], [x, y]] : [[x - 1, y], [x, y]]).filter(([sx, sy]) => w.grid.inBounds(sx, sy)).map(([sx, sy]) => tileIndex(sx, sy)).filter(i => w.walkable(i));
        const route = sides.length ? this.routeTo(w, new Set(sides)) : null;
        if (!route) continue;
        this.job = { key: j.fix, fix: j.fix };
        claimed.add(j.fix);
        this.route = route.slice(1);
        return;
      }
    } else {
      const jobs = w.cleanJobs().filter(p => !claimed.has(p)).map(p => ({ mess: p, at: [p.gx, p.gy] as [number, number] }));
      for (const j of near(jobs)) {
        const route = this.routeTo(w, new Set([tileIndex(Math.floor(j.mess.gx), Math.floor(j.mess.gy))]));
        if (!route) {
          w.noGate(j.at[0], j.at[1]);
          continue;
        }
        this.job = { key: j.mess, mess: j.mess };
        claimed.add(j.mess);
        this.route = route.slice(1);
        return;
      }
    }
    // niets te doen: een stapje wandelen
    const options = w.grid.neighbors(this.tile).filter(i => w.walkable(i));
    if (options.length && Math.random() < 0.5) this.route = [pick(options)];
    this.timer = 2 + Math.random() * 2;
  }

  /** Maakt van dit poppetje een doorzichtig voorbeeld (voor onder de muis, voordat je het neerzet). */
  ghost(): this {
    this.mesh.traverse(o => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const own = (m.material as THREE.MeshStandardMaterial).clone();
      own.transparent = true;
      own.opacity = 0.6;
      own.depthWrite = false;
      m.material = own;
      m.castShadow = false;
    });
    return this;
  }

  /** Het voorbeeld hangt in de lucht boven deze plek en spartelt, tot je het neerzet. `ok`: mag het hier staan? */
  dangle(gx: number, gy: number, t: number, ok: boolean): void {
    this.mesh.position.set(toWorldX(gx), 0.5 + Math.sin(t * 4) * 0.07, toWorldZ(gy));
    this.mesh.rotation.set(Math.sin(t * 7) * 0.14, Math.PI / 4 + Math.sin(t * 2.5) * 0.5, Math.sin(t * 9) * 0.16);
    // spartelen: benen trappelen, armen zwaaien boven het hoofd
    this.limbs[0].rotation.x = Math.sin(t * 14) * 0.9;
    this.limbs[1].rotation.x = -Math.sin(t * 14) * 0.9;
    this.limbs[2].rotation.x = -2.5 + Math.sin(t * 11) * 0.55;
    this.limbs[3].rotation.x = -2.5 + Math.cos(t * 12) * 0.55;
    this.mesh.traverse(o => {
      const m = o as THREE.Mesh;
      if (m.isMesh) (m.material as THREE.MeshStandardMaterial).opacity = ok ? 0.6 : 0.28;
    });
  }

  /** Neerploffen: de werker valt het laatste stukje, veert in en begint dan pas. */
  plop(): void {
    this.dropT = 0.55;
  }

  private dropT = 0;

  update(dt: number, w: WorkerWorld, claimed: Set<object>): void {
    if (this.dropT > 0) {
      // eerst vallen (0,3 tel), dan inveren (0,25 tel)
      this.dropT -= dt;
      const fall = Math.max(0, (this.dropT - 0.25) / 0.3);
      const squash = this.dropT < 0.25 ? Math.sin((Math.max(0, this.dropT) / 0.25) * Math.PI) * 0.28 : 0;
      this.place();
      this.mesh.position.y = fall * fall * 0.5;
      const size = this.height / 0.66;
      this.mesh.scale.set(size * (1 + squash * 0.5), size * (1 - squash), size * (1 + squash * 0.5));
      this.limbs[2].rotation.x = this.limbs[3].rotation.x = -2.5 * fall;
      return;
    }
    if (!this.paid) {
      // geen loon: even wachten (en de rondleiding is afgelopen)
      if (this.group.length) this.dismiss();
      swing(this.limbs, 0);
      return this.place();
    }
    this.phase += dt * 11;
    if (this.standFor > 0) {
      // bij de dieren: de gids vertelt en wijst, de fotograaf maakt foto's
      this.standFor -= dt;
      this.flash = Math.max(0, this.flash - dt);
      swing(this.limbs, 0);
      if (this.role === 'guide') {
        this.limbs[2].rotation.x = -2.2 + Math.sin(this.phase * 0.35) * 0.2;
        this.limbs[3].rotation.x = -0.6 + Math.sin(this.phase * 0.5) * 0.4;
      } else this.limbs[2].rotation.x = this.limbs[3].rotation.x = this.flash > 0 || Math.sin(this.phase * 0.12) > 0.6 ? -1.9 : -0.3;
      if (this.standFor <= 0) {
        this.watching = false;
        this.group = this.group.filter(g => !g.gone && g.leader === this);
        if (this.role === 'guide' && this.group.length) {
          w.tourStop(this.group, this.tile);
          if (--this.stops <= 0) this.dismiss();
        }
        this.timer = 0.3;
      }
      return this.place();
    }
    if (this.working > 0) {
      // aan het werk: vegen of voer in de bak scheppen
      this.working -= dt;
      swing(this.limbs, Math.sin(this.phase) * 0.3);
      this.limbs[2].rotation.x = -0.9 + Math.sin(this.phase * 1.3) * 0.5;
      if (this.working <= 0 && this.job) {
        if (this.job.trough && this.job.food) w.workerFill(this.job.trough, this.job.food);
        if (this.job.mess) w.workerClean(this.job.mess);
        if (this.job.fix) w.workerFix(this.job.fix);
        if (this.job.heal) w.workerHeal(this.job.heal);
        if (this.job) claimed.delete(this.job.key);
        this.job = null;
        this.route = [];
        this.working = 0;
        this.timer = 0.4;
      }
      return this.place();
    }
    const next = this.route[0];
    if (next !== undefined) {
      const [tx, ty] = tileXY(next);
      const dx = tx + 0.5 - this.gx, dy = ty + 0.5 - this.gy;
      // met een groepje achter je aan loop je rustig; met een karretje ben je sneller
      const dist = Math.hypot(dx, dy), step = (this.group.length ? 0.8 : this.cart ? 1.5 : 1.05) * dt;
      if (this.group.length) {
        const last = this.trail[this.trail.length - 1];
        if (!last || Math.hypot(last[0] - this.gx, last[1] - this.gy) >= 0.15) {
          this.trail.push([this.gx, this.gy]);
          if (this.trail.length > 90) this.trail.shift();
        }
      }
      if (dist <= step) {
        this.gx += dx;
        this.gy += dy;
        this.route.shift();
        // de gids of de fotograaf is bij zijn kijkplek
        if (!this.route.length && (this.role === 'guide' || this.role === 'photo') && this.tile === this.stopTile) this.halt(w);
      } else {
        this.gx += (dx / dist) * step;
        this.gy += (dy / dist) * step;
        let d = Math.atan2(dx, dy) - this.heading;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        this.heading += d * Math.min(1, dt * 10);
      }
      swing(this.limbs, Math.sin(this.phase) * 0.7);
      // het karretje duw je met twee handen; de gids houdt zijn vlaggetje hoog
      if (this.cart) this.limbs[2].rotation.x = this.limbs[3].rotation.x = -1.2;
      else if (this.group.length) this.limbs[2].rotation.x = -2.6;
      return this.place();
    }
    swing(this.limbs, 0);
    if (!this.job && this.timer > 1.4 && this.timer < 2.4) this.limbs[3].rotation.x = -2.5 + Math.sin(this.phase * 0.6) * 0.15;
    if (this.job) {
      // aangekomen: naar het werk kijken en beginnen
      const [ax, ay] = this.job.trough ? [this.job.trough.x + 0.5, this.job.trough.y + 0.5] : this.job.fix ? [this.job.fix.gx, this.job.fix.gy] : this.job.heal ? [this.job.heal.gx, this.job.heal.gy] : [this.job.mess!.gx, this.job.mess!.gy];
      if (Math.hypot(ax - this.gx, ay - this.gy) > 0.05) this.heading = Math.atan2(ax - this.gx, ay - this.gy);
      this.working = this.job.heal ? 3 : this.cart ? 0.8 : 1.4;
    } else {
      this.timer -= dt;
      if (this.timer <= 0) this.plan(w, claimed);
    }
    this.place();
  }
}

// ------------------------------------------------------------ verkoper
/** Wat de verkoper draagt. Hij staat in het gebouw achter de toonbank, schuin naar voren gekeerd. */
const VENDORS: Partial<Record<ShopKind, { shirt: number; hat: number }>> = {
  foodstall: { shirt: 0xe0584f, hat: 0xffffff },
  drinkstall: { shirt: 0x4a90e2, hat: 0xffffff },
  icecream: { shirt: 0xf48fb1, hat: 0xffffff },
  balloon: { shirt: 0xb06ad9, hat: 0xffd23f },
  hats: { shirt: 0x6cc04a, hat: 0xe0584f },
  souvenir: { shirt: 0x7a5cc9, hat: 0xffe08a },
};

/** Het poppetje dat in een kraam werkt. Het wiegt een beetje en zwaait als het iets verkoopt. */
export class Vendor {
  readonly mesh: THREE.Group;
  private limbs: THREE.Mesh[];
  private phase = Math.random() * 6;
  private wave = 0;

  private constructor(outfit: { shirt: number; hat: number }) {
    const person = makePerson(false, outfit);
    this.mesh = person.group;
    this.limbs = person.limbs;
    // achter de tafel van de marktkraam, met het gezicht naar de gasten
    this.mesh.position.set(0, 0.03, -0.12);
    this.mesh.scale.setScalar(1.15);
  }

  /** De verkoper voor dit soort winkel, of null als er niemand werkt (bankje, wc, bloemen, ...). */
  static of(kind: ShopKind): Vendor | null {
    const spot = VENDORS[kind];
    return spot ? new Vendor(spot) : null;
  }

  sold(): void {
    this.wave = 1.3;
  }

  update(dt: number): void {
    this.phase += dt * 2;
    this.wave = Math.max(0, this.wave - dt);
    const sway = Math.sin(this.phase) * 0.14;
    // bij een verkoop gaat één arm omhoog en zwaait
    this.limbs[2].rotation.x = this.wave > 0 ? -2.5 + Math.sin(this.phase * 7) * 0.35 : sway;
    this.limbs[3].rotation.x = -sway;
  }
}
