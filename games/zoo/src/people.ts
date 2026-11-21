// Gasten en verzorgers. Gasten komen binnen bij de ingang, lopen over de paden, kijken bij de dieren,
// kopen iets als ze het naar hun zin hebben en laten met een wolkje zien wat ze willen.
import * as THREE from 'three';
import { PLUSH, PRODUCTS, STALLS, TERRAINS, type FoodId, type ShopKind } from './data';
import { Grid, H, W, tileIndex, tileXY } from './grid';
import { toWorldX, toWorldZ } from './view';

const PATH = TERRAINS.indexOf('path');

/** De tegel waar gasten binnenkomen en weer weggaan: midden aan de voorkant. */
export const ENTRANCE = tileIndex(Math.floor(W / 2), H - 1);

export interface ShopSpot {
  /** De linkerbovenhoek; een gebouw beslaat `size` bij `size` tegels. */
  x: number;
  y: number;
  kind: ShopKind;
  size: number;
  /** Wat deze kraam verkoopt (zie PRODUCTS; knuffels heten 'plush_' + soort). */
  sells: string[];
  /** De stand van de draaimolen, in radialen: wie erin zit, draait mee. */
  spin?: number;
  /**
   * Een bankje, bloembak of afvalbak staat op de rand van tegel (x, y), net als een hek, en neemt geen
   * tegel in: 'h' is de noordrand, 'v' de westrand.
   */
  edge?: 'h' | 'v';
  /** Naar welke kant het kijkt: 1 = zuid of oost, -1 = noord of west. Het spel houdt dit bij. */
  face?: number;
  /** De speler heeft het omgedraaid: het kijkt van het pad af. */
  turned?: boolean;
}

/** Waar een bankje op een rand precies staat en hoe het gedraaid is: [x, y, draaiing]. Zelfde regels als in het beeld. */
export function edgePose(shop: ShopSpot): [number, number, number] {
  const face = shop.face ?? 1;
  return shop.edge === 'h'
    ? [shop.x + 0.5, shop.y - 0.2 * face, face < 0 ? Math.PI : 0]
    : [shop.x - 0.2 * face, shop.y + 0.5, face < 0 ? -Math.PI / 2 : Math.PI / 2];
}

/** Het midden van een winkel, in rastercoördinaten. */
export const shopCenter = (shop: ShopSpot): [number, number] =>
  shop.edge === 'h' ? [shop.x + 0.5, shop.y] : shop.edge === 'v' ? [shop.x, shop.y + 0.5] : [shop.x + shop.size / 2, shop.y + shop.size / 2];

/** De twee tegels aan weerszijden van iets wat op een rand staat (alleen wat binnen het park ligt). */
export function edgeSides(shop: { x: number; y: number; edge?: 'h' | 'v' }): number[] {
  const sides: [number, number][] = shop.edge === 'h' ? [[shop.x, shop.y - 1], [shop.x, shop.y]] : [[shop.x - 1, shop.y], [shop.x, shop.y]];
  return sides.filter(([x, y]) => x >= 0 && y >= 0 && x < W && y < H).map(([x, y]) => tileIndex(x, y));
}

/** Waar een gast voor naar een winkel gaat. */
export type Need = 'food' | 'drink' | 'toilet' | 'icecream' | 'balloon' | 'hat' | 'souvenir' | 'play' | 'sit' | 'look' | 'ride';

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

export type GuestWish = { kind: Need | 'bored' | 'fav'; lacking: boolean; product?: string };

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
  guestSound(kind: 'flush' | 'guest.laugh' | 'toilet.pee' | 'toilet.poop'): void;
  /** Vraagt het level om afval op te ruimen? Dan laten gasten ook naast een afvalbak weleens iets vallen. */
  messy(): boolean;
  /** Hoeveel sneller gasten zin krijgen in iets van dit soort kraam: meer als een level erom vraagt. */
  craving(kind: ShopKind): number;
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
}

/** Een poppetje van blokjes. Een verzorger draagt groen met een pet; een verkoper de kleur van zijn kraam, een pet en een wit schort. */
function makePerson(keeper = false, outfit?: { shirt: number; hat: number }): Person {
  const skin = mat(pick(SKIN)), shirt = mat(outfit ? outfit.shirt : keeper ? 0x4fa35a : pick(SHIRT)), pants = mat(keeper ? 0x5a4636 : pick(PANTS));
  const part = (geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number): THREE.Mesh => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, 0);
    mesh.castShadow = true;
    return mesh;
  };
  const limbs = [part(LEG_GEO, pants, 0.052, 0.2), part(LEG_GEO, pants, -0.052, 0.2), part(ARM_GEO, shirt, 0.13, 0.41), part(ARM_GEO, shirt, -0.13, 0.41)];
  const group = new THREE.Group();
  group.add(...limbs, part(BODY_GEO, shirt, 0, 0.31), part(HEAD_GEO, skin, 0, 0.505));
  group.add(keeper || outfit ? part(CAP_GEO, mat(outfit ? outfit.hat : 0x2f6e39), 0, 0.615) : part(HAIR_GEO, mat(pick(HAIR)), 0, 0.6));
  if (outfit) {
    const apron = part(APRON_GEO, mat(0xf7f4ec), 0, 0.29);
    apron.position.z = 0.07;
    group.add(apron);
  }
  const child = !keeper && !outfit && Math.random() < 0.35;
  const scale = child ? 0.72 : outfit ? 1 : 1 + Math.random() * 0.12;
  group.scale.setScalar(scale);
  return { group, limbs, height: 0.66 * scale, child };
}

function swing(limbs: THREE.Mesh[], amount: number): void {
  limbs[0].rotation.x = amount;
  limbs[1].rotation.x = -amount;
  limbs[2].rotation.x = -amount * 0.8;
  limbs[3].rotation.x = amount * 0.8;
}

// ------------------------------------------------------------ gast
type GuestState = 'idle' | 'walk' | 'watch' | 'buy' | 'sit' | 'accident';
const MAX_PURCHASES = 4;
const NEED_SHOP: Record<Need, ShopKind> = {
  food: 'foodstall', drink: 'drinkstall', toilet: 'toilet', icecream: 'icecream', balloon: 'balloon', hat: 'hats', souvenir: 'souvenir', play: 'playground', sit: 'bench', look: 'fountain', ride: 'carousel',
};
const COLOR_OF = Object.fromEntries(PRODUCTS.filter(p => p.color !== undefined).map(p => [p.id, p.color as number]));
const footprint = (shop: ShopSpot): number[] => {
  const tiles: number[] = [];
  for (let y = shop.y; y < shop.y + shop.size; y++) for (let x = shop.x; x < shop.x + shop.size; x++) tiles.push(tileIndex(x, y));
  return tiles;
};

export class Guest {
  readonly mesh: THREE.Group;
  readonly height: number;
  readonly child: boolean;
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
  /** Op welk paardje de gast zit. */
  private seat = Math.floor(Math.random() * 4);
  /** Plezier van 0 tot 1. Een gast koopt alleen iets als hij het naar zijn zin heeft. */
  fun = 0.5;
  /** Het dier dat deze gast het liefst wil zien. */
  fav: string | null = null;
  favSeen = false;
  /** Wat de gast nu wil, voor het wolkje boven zijn hoofd. */
  wish: GuestWish | null = null;
  gone = false;
  /** Heeft de speler al naar deze gast gezwaaid? */
  waved = false;
  private bought: Partial<Record<ShopKind, number>> = {};
  /** Waar de gast precies om vraagt, per behoefte: 'lolly', 'cap_red', 'plush_pig', ... */
  private wanted: Partial<Record<Need, string>> = {};
  /** Behoeftes waarvoor de gast al tevergeefs heeft gezocht: dan neemt hij ook iets anders. */
  private settled = new Set<Need>();
  /** De boodschap waarvoor de gast nu onderweg is. */
  private errand: Need | null = null;

  private limbs: THREE.Mesh[];
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
  private face: [number, number] | null = null;
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
  /** Wat de gast draagt, om te kunnen bewaren. */
  private wornHat: string | null = null;
  private wornBalloon: string | null = null;
  private mess: 'poop' | 'pee' = 'pee';
  private ox = (Math.random() - 0.5) * 0.4;
  private oy = (Math.random() - 0.5) * 0.4;

  constructor(tile: number, species: string[]) {
    const person = makePerson();
    this.mesh = person.group;
    this.limbs = person.limbs;
    this.height = person.height;
    this.child = person.child;
    this.wantsBalloon = person.child || Math.random() < 0.2;
    this.wantsHat = Math.random() < 0.65;
    // wie een hoedje of ballon wil, heeft daar meteen al zin in: dan loopt hij er het hele bezoek mee rond
    if (this.wantsBalloon) this.balloon = 0.3 + Math.random() * 0.5;
    this.hat = this.wantsHat ? 0.4 + Math.random() * 0.5 : 0;
    this.fav = species.length ? pick(species) : null;
    const [x, y] = tileXY(tile);
    this.gx = x + 0.5;
    this.gy = y + 0.5;
    this.place();
  }

  get tile(): number {
    return tileIndex(Math.floor(this.gx), Math.floor(this.gy));
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

  get happy(): boolean {
    return this.fun >= 0.55 && this.hunger < 0.9 && this.thirst < 0.9 && this.bladder < 0.9;
  }

  /** Hoe ver de gast is met gaan zitten (0 = staat nog op het pad, 1 = zit); aan het eind staat hij weer op. */
  private settle(total: number): number {
    return Math.max(0, Math.min(1, (total - this.timer) / 0.45, this.timer / 0.35));
  }

  private place(): void {
    const kind = this.state === 'sit' ? this.shop?.kind : undefined;
    if (kind === 'bench' && this.shop?.edge) {
      // op het bankje: naast elkaar, met het gezicht dezelfde kant op als het bankje
      const [bx, by, rot] = edgePose(this.shop);
      const k = this.settle(4.5), lx = this.seat % 2 ? 0.2 : -0.2, lz = -0.02;
      const sx = bx + lx * Math.cos(rot) + lz * Math.sin(rot), sy = by - lx * Math.sin(rot) + lz * Math.cos(rot);
      this.mesh.position.set(toWorldX(this.gx + (sx - this.gx) * k), (0.3 - 0.2 * this.mesh.scale.y) * k, toWorldZ(this.gy + (sy - this.gy) * k));
      this.mesh.rotation.y = this.heading + Math.atan2(Math.sin(rot - this.heading), Math.cos(rot - this.heading)) * k;
      this.limbs[0].rotation.x = this.limbs[1].rotation.x = (-Math.PI / 2) * k;
      return;
    }
    if (kind === 'playground' && this.shop) {
      // de trap op, van de glijbaan af en weer terug: twee keer per bezoek
      const u = ((6 - this.timer) % 3) / 3;
      const cx = this.shop.x + 1, cy = this.shop.y + 1;
      const top: [number, number, number] = [cx - 0.39, 1.0, cy + 0.1], low: [number, number, number] = [cx - 0.39, 0.1, cy + 1.1];
      const here: [number, number, number] = [this.gx, 0, this.gy];
      const mix = (a: number[], b: number[], t: number): number[] => a.map((v, i) => v + (b[i] - v) * t);
      const sliding = u >= 0.45 && u < 0.8;
      const p = u < 0.45 ? mix(here, top, u / 0.45) : sliding ? mix(top, low, (u - 0.45) / 0.35) : mix(low, here, (u - 0.8) / 0.2);
      this.mesh.position.set(toWorldX(p[0]), p[1], toWorldZ(p[2]));
      this.mesh.rotation.y = sliding ? 0 : this.heading;
      if (sliding) this.limbs[0].rotation.x = this.limbs[1].rotation.x = -1.3;
      return;
    }
    // in de draaimolen zit de gast op een paardje en draait mee
    if (this.state === 'sit' && this.shop?.kind === 'carousel') {
      const a = (this.shop.spin ?? 0) + (this.seat * Math.PI) / 2;
      this.mesh.position.set(toWorldX(this.shop.x + 1) + Math.sin(a) * 0.56, 0.3, toWorldZ(this.shop.y + 1) + Math.cos(a) * 0.56);
      this.mesh.rotation.y = a + Math.PI / 2;
      this.limbs[0].rotation.x = this.limbs[1].rotation.x = -1.1;
      return;
    }
    this.mesh.position.set(toWorldX(this.gx), this.state === 'accident' ? -0.07 : 0, toWorldZ(this.gy));
    this.mesh.rotation.y = this.heading;
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

  /** Een padtegel naast een winkel van dit soort waar een gast kan staan. Met `product`: alleen winkels die dat verkopen. */
  private spotBeside(w: GuestWorld, reach: Set<number>, kind: ShopKind, product?: string): { shop: ShopSpot; tile: number } | null {
    const options: { shop: ShopSpot; tile: number }[] = [];
    for (const shop of w.shops) {
      if (shop.kind !== kind || (product && !shop.sells.includes(product))) continue;
      if (shop.edge) {
        // wat op een rand staat, gebruik je vanaf het pad ernaast
        for (const n of edgeSides(shop)) if (reach.has(n)) options.push({ shop, tile: n });
        continue;
      }
      const own = footprint(shop);
      for (const t of own) for (const n of w.grid.neighbors(t)) if (reach.has(n) && !own.includes(n)) options.push({ shop, tile: n });
    }
    return options.length ? pick(options) : null;
  }

  /** Wat wil de gast nu het liefst? Het dringendste eerst. */
  private want(): Need | null {
    if (this.bladder > 0.6) return 'toilet';
    if (this.hunger > 0.6 && this.hunger >= this.thirst) return 'food';
    if (this.thirst > 0.6) return 'drink';
    if (this.hunger > 0.6) return 'food';
    if (this.tired > 0.75) return 'sit';
    if (this.child && this.playful > 0.7) return 'play';
    if (this.rideWish > 0.7) return 'ride';
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
  }

  private decide(w: GuestWorld, list: number[], reach: Set<number>): void {
    this.shop = null;
    this.face = null;
    this.errand = null;
    this.sees = [];
    if (this.age > this.stay || this.fun < 0.08) this.leaving = true;
    if (this.leaving) {
      this.wish = null;
      if (this.tile === ENTRANCE || !this.go(w, reach, ENTRANCE)) this.gone = true;
      return;
    }
    if (w.litterOn(this.tile)) this.fun = Math.max(0, this.fun - 0.04);
    this.wish = this.fun < 0.2 ? { kind: 'bored', lacking: true } : null;
    const want = this.want();
    if (want) {
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
      if (spot && (spot.tile === this.tile || this.go(w, reach, spot.tile))) {
        this.shop = spot.shop;
        this.errand = want;
        this.wish = { kind: want, lacking: false, product };
        if (spot.tile === this.tile) this.arrive(w);
        return;
      }
      // het is er niet: de gast laat zien wat hij mist en heeft het wat minder naar zijn zin
      this.wish = { kind: want, lacking: true, product };
      if (product && w.shops.some(sh => sh.kind === kind)) {
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
    for (let tries = 0; tries < 16; tries++) {
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

  private arrive(w: GuestWorld): void {
    if (this.leaving && this.tile === ENTRANCE) {
      this.gone = true;
    } else if (this.shop) {
      this.face = shopCenter(this.shop);
      const kind = this.shop.kind;
      this.state = kind === 'bench' || kind === 'playground' || kind === 'fountain' || kind === 'carousel' ? 'sit' : 'buy';
      this.timer = kind === 'bench' ? 4.5 : kind === 'playground' ? 6 : kind === 'carousel' ? 8 : kind === 'fountain' ? 4 : kind === 'toilet' ? 3 : 1.8;
      // op de wc hoor je af en toe wat er achter de deur gebeurt
      if (kind === 'toilet' && Math.random() < 0.6) w.guestSound(Math.random() < 0.55 ? 'toilet.pee' : 'toilet.poop');
      if (!w.shops.includes(this.shop)) this.timer = 0.2; // de kraam is intussen weggehaald
    } else if (this.face) {
      this.state = 'watch';
      this.timer = 4 + Math.random() * 3;
    } else {
      this.state = 'idle';
      this.timer = 0.6 + Math.random();
    }
  }

  private finish(w: GuestWorld): void {
    if (this.state === 'watch') {
      this.fun = Math.min(1, this.fun + this.gain);
      if (this.fav && !this.favSeen && this.sees.includes(this.fav)) {
        this.favSeen = true;
        this.fun = Math.min(1, this.fun + 0.25);
        w.cheer(this);
      }
    } else if (this.state === 'sit' && this.shop?.kind === 'playground') {
      w.guestSound('guest.laugh');
      this.playful = 0;
      this.fun = Math.min(1, this.fun + 0.25);
    } else if (this.state === 'sit' && this.shop?.kind === 'carousel') {
      w.guestSound('guest.laugh');
      this.rideWish = 0;
      this.fun = Math.min(1, this.fun + 0.35);
    } else if (this.state === 'sit' && this.shop?.kind === 'fountain') {
      this.curious = 0;
      this.fun = Math.min(1, this.fun + 0.2);
    } else if (this.state === 'sit') {
      this.tired = 0;
      this.fun = Math.min(1, this.fun + 0.15);
    } else if (this.state === 'buy' && this.shop && w.shops.includes(this.shop)) {
      const kind = this.shop.kind;
      const asked = this.errand ? this.wanted[this.errand] : undefined;
      const exact = !asked || this.shop.sells.includes(asked);
      const got = exact ? asked : this.shop.sells.length ? pick(this.shop.sells) : undefined;
      if (kind === 'toilet') {
        this.bladder = 0;
        this.fun = Math.min(1, this.fun + 0.08);
        w.guestSound('flush');
      } else if ((exact || got) && w.buy(this.shop, this, got, exact)) {
        this.bought[kind] = (this.bought[kind] ?? 0) + 1;
        this.purchases++;
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
        // precies wat de gast vroeg maakt hem blijer dan iets anders
        const joy = kind === 'foodstall' || kind === 'drinkstall' ? 0.1 : 0.2;
        this.fun = Math.min(1, this.fun + (exact ? joy : joy * 0.3));
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
  }

  /** De gast loopt verder met de ballon die hij kocht. */
  private addBalloon(product?: string): void {
    this.wornBalloon = product ?? '';
    const colors = [0xe0584f, 0x4a90e2, 0xffd23f, 0x6cc04a, 0xf06aa6];
    const color = (product && COLOR_OF[product]) || pick(colors);
    const balloon = new THREE.Mesh(BALLOON_GEO, new THREE.MeshStandardMaterial({ color, roughness: 0.4 }));
    balloon.position.set(0.17, 0.95, 0);
    if (product === 'balloon_heart') balloon.scale.set(1.5, 1.25, 0.8);
    const string = new THREE.Mesh(STRING_GEO, mat(0xf4f1e8));
    string.position.set(0.17, 0.68, 0);
    this.mesh.add(balloon, string);
  }

  /** De gast zet het hoedje op dat hij kocht: een petje, een strohoed, een feestmuts of een kroon. */
  private addHat(product = 'cap_red'): void {
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

  update(dt: number, w: GuestWorld, list: number[], reach: Set<number>): void {
    this.age += dt;
    const demand = w.demand();
    if (w.sells('foodstall') && !this.bought.foodstall) this.hunger = Math.min(1, this.hunger + (dt / 160) * demand * w.craving('foodstall'));
    if (w.sells('drinkstall') && !this.bought.drinkstall) this.thirst = Math.min(1, this.thirst + (dt / 130) * demand * w.craving('drinkstall'));
    if (w.sells('toilet')) this.bladder = Math.min(1, this.bladder + dt / 170);
    if (w.sells('icecream') && !this.bought.icecream) this.treat = Math.min(1, this.treat + (dt / 190) * demand * w.craving('icecream'));
    if (w.sells('balloon') && this.wantsBalloon && !this.bought.balloon) this.balloon = Math.min(1, this.balloon + (dt / 85) * demand * w.craving('balloon'));
    if (w.sells('hats') && this.wantsHat && !this.bought.hats) this.hat = Math.min(1, this.hat + (dt / 75) * demand * w.craving('hats'));
    if (w.sells('bench')) this.tired = Math.min(1, this.tired + dt / 180);
    if (w.sells('souvenir') && !this.bought.souvenir) this.gift = Math.min(1, this.gift + (dt / 120) * demand * w.craving('souvenir'));
    if (w.sells('playground') && this.child) this.playful = Math.min(1, this.playful + dt / 90);
    if (w.sells('fountain')) this.curious = Math.min(1, this.curious + dt / 120);
    if (w.sells('carousel')) this.rideWish = Math.min(1, this.rideWish + dt / (this.child ? 70 : 170));
    this.fun = Math.max(0, this.fun - dt / 240);
    if (!reach.has(this.tile)) {
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
    if (this.urgent > 30 && !(this.state === 'buy' && this.shop?.kind === 'toilet')) {
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
      const near = w.shops.some(sh => sh.kind === 'bin' && Math.abs(shopCenter(sh)[0] - this.gx) < 1.6 && Math.abs(shopCenter(sh)[1] - this.gy) < 1.6);
      if (near && !this.sloppy) this.trash = 0;
      else {
        this.trash -= dt;
        if (this.trash <= 0 && w.sells('bin')) w.dropLitter(this.gx, this.gy);
      }
    }
    if (this.state === 'walk') {
      const next = this.route[0];
      if (next === undefined) this.arrive(w);
      else {
        const [tx, ty] = tileXY(next);
        const dx = tx + 0.5 + this.ox - this.gx, dy = ty + 0.5 + this.oy - this.gy;
        const dist = Math.hypot(dx, dy), step = 0.8 * dt;
        if (dist <= step) {
          this.gx += dx;
          this.gy += dy;
          this.route.shift();
        } else {
          this.gx += (dx / dist) * step;
          this.gy += (dy / dist) * step;
          this.turnTo(dx, dy, dt);
        }
      }
    } else {
      if (this.face) this.turnTo(this.face[0] - this.gx, this.face[1] - this.gy, dt);
      this.timer -= dt;
      if (this.timer <= 0) {
        this.finish(w);
        this.state = 'idle';
        this.decide(w, list, reach);
      }
    }
    // benen en armen zwaaien tijdens het lopen
    this.phase += dt * 11;
    swing(this.limbs, this.state === 'walk' ? Math.sin(this.phase) * 0.7 : 0);
    this.place();
  }
}

// ------------------------------------------------------------ alle gasten samen
export class GuestManager {
  guests: Guest[] = [];
  private spawnIn = 2;
  private list: number[] = [];
  private reach = new Set<number>();
  private reachIn = 0;

  constructor(private scene: THREE.Scene, private world: GuestWorld) {}

  snapshot(): GuestSave[] {
    return this.guests.filter(g => !g.gone).map(g => g.snapshot());
  }

  /** De gasten uit een bewaard spel lopen weer rond waar ze waren. Kind blijft kind; kleren zijn nieuw. */
  restore(list: GuestSave[], dx = 0, dy = 0): void {
    const species = this.world.parkSpecies();
    for (const s of list) {
      let guest = new Guest(ENTRANCE, species);
      for (let tries = 0; tries < 8 && guest.child !== s.child; tries++) guest = new Guest(ENTRANCE, species);
      guest.restore(s, dx, dy);
      this.scene.add(guest.mesh);
      this.guests.push(guest);
    }
  }

  /** Is de ingang met een pad verbonden? Zonder pad komen er geen gasten. */
  get open(): boolean {
    return this.reach.size > 0;
  }

  /** Alle padtegels die vanaf de ingang te bereiken zijn. */
  private refresh(): void {
    const grid = this.world.grid;
    this.reach = new Set();
    if (grid.terrain[ENTRANCE] === PATH) {
      const queue = [ENTRANCE];
      this.reach.add(ENTRANCE);
      for (let head = 0; head < queue.length; head++)
        for (const n of grid.neighbors(queue[head]))
          if (grid.terrain[n] === PATH && !this.reach.has(n)) {
            this.reach.add(n);
            queue.push(n);
          }
    }
    this.list = [...this.reach];
  }

  update(dt: number): void {
    this.reachIn -= dt;
    if (this.reachIn <= 0) {
      this.reachIn = 1;
      this.refresh();
    }
    if (this.open && this.guests.length < this.world.capacity()) {
      this.spawnIn -= dt;
      if (this.spawnIn <= 0) {
        this.spawnIn = Math.max(3, 100 / this.world.capacity()) * (0.7 + Math.random() * 0.6);
        const guest = new Guest(ENTRANCE, this.world.parkSpecies());
        this.scene.add(guest.mesh);
        this.guests.push(guest);
      }
    }
    for (const g of this.guests) {
      g.update(dt, this.world, this.list, this.reach);
      if (g.gone) this.scene.remove(g.mesh);
    }
    if (this.guests.some(g => g.gone)) this.guests = this.guests.filter(g => !g.gone);
  }

  stats(): { total: number; happy: number; lacking: Record<string, number> } {
    const lacking: Record<string, number> = {};
    for (const g of this.guests) if (g.wish?.lacking) lacking[g.wish.kind] = (lacking[g.wish.kind] ?? 0) + 1;
    return { total: this.guests.length, happy: this.guests.filter(g => g.happy).length, lacking };
  }
}

/** Kramen waar een gast iets koopt (voor de kas). */
export const sellsForCoin = (kind: ShopKind): boolean => STALLS.includes(kind);

// ------------------------------------------------------------ verzorger
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
export interface KeeperWorld {
  grid: Grid;
  /** De poepjes in dit verblijf. */
  poopsOf(regionId: number): KeeperPoop[];
  /** De voerbakken in dit verblijf, met het voer dat de dieren daar nodig hebben (null als er geen dieren zijn). */
  troughsOf(regionId: number): { trough: KeeperTrough; food: FoodId | null }[];
  keeperClean(poop: KeeperPoop): void;
  keeperFill(trough: KeeperTrough, food: FoodId): void;
}

/** Een verzorger hoort bij één verblijf: hij vult lege voerbakken en ruimt poep op. */
export class Keeper {
  readonly mesh: THREE.Group;
  readonly height: number;
  gx: number;
  gy: number;
  private limbs: THREE.Mesh[];
  private route: number[] = [];
  private job: { poop?: KeeperPoop; trough?: KeeperTrough; food?: FoodId } | null = null;
  private timer = 1;
  private working = 0;
  private heading = 0;
  private phase = 0;
  /** Heeft de werker dit uur loon gekregen? Zo niet, dan wacht hij. */
  paid = true;

  /** `role`: een voerder vult alleen de voerbakken, een schoonmaker veegt alleen het hok. */
  constructor(tile: number, readonly role: 'feed' | 'clean' = 'feed') {
    const person = makePerson(true);
    this.mesh = person.group;
    this.limbs = person.limbs;
    this.height = person.height;
    const [x, y] = tileXY(tile);
    this.gx = x + 0.5;
    this.gy = y + 0.5;
    this.place();
  }

  get tile(): number {
    return tileIndex(Math.floor(this.gx), Math.floor(this.gy));
  }

  private place(): void {
    this.mesh.position.set(toWorldX(this.gx), 0, toWorldZ(this.gy));
    this.mesh.rotation.y = this.heading;
  }

  /** Het verblijf is veranderd: opnieuw beginnen op deze tegel. */
  reset(tile: number): void {
    const [x, y] = tileXY(tile);
    this.gx = x + 0.5;
    this.gy = y + 0.5;
    this.route = [];
    this.job = null;
    this.timer = 1;
    this.place();
  }

  private plan(w: KeeperWorld, regionId: number): void {
    const isTrough = (i: number): boolean => w.troughsOf(regionId).some(t => tileIndex(t.trough.x, t.trough.y) === i);
    for (const { trough, food } of this.role === 'feed' ? w.troughsOf(regionId) : []) {
      if (!food || (trough.food === food && trough.amount > 1)) continue;
      const spots = w.grid.neighbors(tileIndex(trough.x, trough.y)).filter(i => !isTrough(i));
      const route = spots.length ? w.grid.path(this.tile, spots[0], isTrough) : null;
      if (route) {
        this.job = { trough, food };
        this.route = route.slice(1);
        return;
      }
    }
    const poop = this.role === 'clean' ? w.poopsOf(regionId)[0] : undefined;
    if (poop) {
      const route = w.grid.path(this.tile, tileIndex(Math.floor(poop.gx), Math.floor(poop.gy)), isTrough);
      if (route) {
        this.job = { poop };
        this.route = route.slice(1);
        return;
      }
    }
    // niets te doen: een stapje wandelen
    const options = w.grid.neighbors(this.tile).filter(i => !isTrough(i));
    if (options.length && Math.random() < 0.5) this.route = [pick(options)];
    this.timer = 2 + Math.random() * 2;
  }

  update(dt: number, w: KeeperWorld, regionId: number): void {
    if (!this.paid) return; // geen loon: even wachten
    const next = this.route[0];
    if (next !== undefined) {
      const [tx, ty] = tileXY(next);
      const dx = tx + 0.5 - this.gx, dy = ty + 0.5 - this.gy;
      const dist = Math.hypot(dx, dy), step = 0.9 * dt;
      if (dist <= step) {
        this.gx += dx;
        this.gy += dy;
        this.route.shift();
        if (!this.route.length && this.job) this.working = 1.6;
      } else {
        this.gx += (dx / dist) * step;
        this.gy += (dy / dist) * step;
        let d = Math.atan2(dx, dy) - this.heading;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        this.heading += d * Math.min(1, dt * 10);
      }
    } else if (this.job) {
      if (this.working <= 0) this.working = 1.6; // de verzorger stond er al
      this.working -= dt;
      if (this.working <= 0) {
        if (this.job.poop && w.poopsOf(regionId).includes(this.job.poop)) w.keeperClean(this.job.poop);
        if (this.job.trough && this.job.food) w.keeperFill(this.job.trough, this.job.food);
        this.job = null;
        this.timer = 1.5;
      }
    } else {
      this.timer -= dt;
      if (this.timer <= 0) this.plan(w, regionId);
    }
    this.phase += dt * 11;
    swing(this.limbs, this.route.length ? Math.sin(this.phase) * 0.7 : this.job ? Math.sin(this.phase) * 0.25 : 0);
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
    this.mesh.position.set(0.18, 0.05, 0.2);
    this.mesh.rotation.y = Math.PI / 4;
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
