// Gasten en verzorgers. Gasten komen binnen bij de ingang, lopen over de paden, kijken bij de dieren,
// kopen iets als ze het naar hun zin hebben en laten met een wolkje zien wat ze willen.
import * as THREE from 'three';
import { STALLS, TERRAINS, type FoodId, type ShopKind } from './data';
import { Grid, H, W, tileIndex, tileXY } from './grid';
import { toWorldX, toWorldZ } from './view';

const PATH = TERRAINS.indexOf('path');

/** De tegel waar gasten binnenkomen en weer weggaan: midden aan de voorkant. */
export const ENTRANCE = tileIndex(Math.floor(W / 2), H - 1);

export interface ShopSpot {
  x: number;
  y: number;
  kind: ShopKind;
}

/** Wat een gast wil, voor het wolkje boven zijn hoofd. `lacking`: het is er niet in het park. */
export type GuestWish = { kind: 'food' | 'drink' | 'toilet' | 'icecream' | 'balloon' | 'souvenir' | 'play' | 'sit' | 'bored' | 'fav'; lacking: boolean };

export interface GuestWorld {
  grid: Grid;
  shops: ShopSpot[];
  /** Is er vanaf deze padtegel iets te zien? Zo ja: hoe leuk, waar kijk je naar en welke soorten staan er. */
  viewScore(tile: number): { score: number; x: number; y: number; species: string[] } | null;
  /** Een gast staat bij de kraam. Geeft terug of hij iets koopt. */
  buy(shop: ShopSpot, guest: Guest): boolean;
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
  guestSound(kind: 'flush'): void;
  /** Vraagt het level om afval op te ruimen? Dan laten gasten ook naast een afvalbak weleens iets vallen. */
  messy(): boolean;
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
const BALLOON_GEO = new THREE.IcosahedronGeometry(0.11, 1);
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

/** Een poppetje van blokjes. Een verzorger draagt groen met een pet. */
function makePerson(keeper = false): Person {
  const skin = mat(pick(SKIN)), shirt = mat(keeper ? 0x4fa35a : pick(SHIRT)), pants = mat(keeper ? 0x5a4636 : pick(PANTS));
  const part = (geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number): THREE.Mesh => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, 0);
    mesh.castShadow = true;
    return mesh;
  };
  const limbs = [part(LEG_GEO, pants, 0.052, 0.2), part(LEG_GEO, pants, -0.052, 0.2), part(ARM_GEO, shirt, 0.13, 0.41), part(ARM_GEO, shirt, -0.13, 0.41)];
  const group = new THREE.Group();
  group.add(...limbs, part(BODY_GEO, shirt, 0, 0.31), part(HEAD_GEO, skin, 0, 0.505));
  group.add(keeper ? part(CAP_GEO, mat(0x2f6e39), 0, 0.615) : part(HAIR_GEO, mat(pick(HAIR)), 0, 0.6));
  const child = !keeper && Math.random() < 0.35;
  const scale = child ? 0.72 : 1 + Math.random() * 0.12;
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
type GuestState = 'idle' | 'walk' | 'watch' | 'buy' | 'sit';
const MAX_PURCHASES = 3;
const NEED_SHOP = {
  food: 'foodstall', drink: 'drinkstall', toilet: 'toilet', icecream: 'icecream', balloon: 'balloon', sit: 'bench', souvenir: 'souvenir', play: 'playground',
} as const;

export class Guest {
  readonly mesh: THREE.Group;
  readonly height: number;
  readonly child: boolean;
  gx: number;
  gy: number;
  hunger = Math.random() * 0.3;
  thirst = Math.random() * 0.3;
  /** Moet de gast naar de wc? */
  bladder = Math.random() * 0.3;
  /** Zin in een ijsje. */
  treat = Math.random() * 0.4;
  /** Zin in een ballon (vooral kinderen). */
  balloon = 0;
  tired = Math.random() * 0.2;
  /** Zin in een knuffel uit de knuffelkraam. */
  gift = Math.random() * 0.6;
  /** Zin om te spelen in de speeltuin (alleen kinderen). */
  playful = Math.random() * 0.4;
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
  private ox = (Math.random() - 0.5) * 0.4;
  private oy = (Math.random() - 0.5) * 0.4;

  constructor(tile: number, species: string[]) {
    const person = makePerson();
    this.mesh = person.group;
    this.limbs = person.limbs;
    this.height = person.height;
    this.child = person.child;
    this.wantsBalloon = person.child || Math.random() < 0.2;
    this.fav = species.length ? pick(species) : null;
    const [x, y] = tileXY(tile);
    this.gx = x + 0.5;
    this.gy = y + 0.5;
    this.place();
  }

  get tile(): number {
    return tileIndex(Math.floor(this.gx), Math.floor(this.gy));
  }

  get happy(): boolean {
    return this.fun >= 0.55 && this.hunger < 0.9 && this.thirst < 0.9 && this.bladder < 0.9;
  }

  private place(): void {
    this.mesh.position.set(toWorldX(this.gx), 0, toWorldZ(this.gy));
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

  /** De padtegel naast een kraam of bankje waar een gast kan staan. */
  private spotBeside(w: GuestWorld, reach: Set<number>, kind: ShopKind): { shop: ShopSpot; tile: number } | null {
    const options: { shop: ShopSpot; tile: number }[] = [];
    for (const shop of w.shops) {
      if (shop.kind !== kind) continue;
      for (const n of w.grid.neighbors(tileIndex(shop.x, shop.y))) if (reach.has(n)) options.push({ shop, tile: n });
    }
    return options.length ? pick(options) : null;
  }

  /** Wat wil de gast nu het liefst? Het dringendste eerst. */
  private want(): keyof typeof NEED_SHOP | null {
    if (this.bladder > 0.7) return 'toilet';
    if (this.hunger > 0.6 && this.hunger >= this.thirst) return 'food';
    if (this.thirst > 0.6) return 'drink';
    if (this.hunger > 0.6) return 'food';
    if (this.tired > 0.75) return 'sit';
    if (this.child && this.playful > 0.7) return 'play';
    if (this.purchases < MAX_PURCHASES && this.treat > 0.7 && this.fun >= 0.5) return 'icecream';
    if (this.purchases < MAX_PURCHASES && this.balloon > 0.7 && this.fun >= 0.5) return 'balloon';
    if (this.purchases < MAX_PURCHASES && this.gift > 0.7 && this.fun >= 0.5) return 'souvenir';
    return null;
  }

  private decide(w: GuestWorld, list: number[], reach: Set<number>): void {
    this.shop = null;
    this.face = null;
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
      const spot = this.spotBeside(w, reach, NEED_SHOP[want]);
      if (spot && (spot.tile === this.tile || this.go(w, reach, spot.tile))) {
        this.shop = spot.shop;
        this.wish = { kind: want, lacking: false };
        if (spot.tile === this.tile) this.arrive(w);
        return;
      }
      // het is er niet: de gast laat zien wat hij mist en heeft het wat minder naar zijn zin
      this.wish = { kind: want, lacking: true };
      this.fun = Math.max(0, this.fun - (want === 'toilet' ? 0.07 : want === 'food' || want === 'drink' ? 0.05 : 0.02));
      if (want === 'sit') this.tired = 0.5;
      if (want === 'icecream') this.treat = 0.3;
      if (want === 'balloon') this.balloon = 0.3;
      if (want === 'souvenir') this.gift = 0.3;
      if (want === 'play') this.playful = 0.4;
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
      this.face = [this.shop.x + 0.5, this.shop.y + 0.5];
      const kind = this.shop.kind;
      this.state = kind === 'bench' || kind === 'playground' ? 'sit' : 'buy';
      this.timer = kind === 'bench' ? 4.5 : kind === 'playground' ? 6 : kind === 'toilet' ? 3 : 1.8;
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
      this.playful = 0;
      this.fun = Math.min(1, this.fun + 0.25);
    } else if (this.state === 'sit') {
      this.tired = 0;
      this.fun = Math.min(1, this.fun + 0.15);
    } else if (this.state === 'buy' && this.shop && w.shops.includes(this.shop)) {
      const kind = this.shop.kind;
      if (kind === 'toilet') {
        this.bladder = 0;
        this.fun = Math.min(1, this.fun + 0.08);
        w.guestSound('flush');
      } else if (w.buy(this.shop, this)) {
        this.bought[kind] = (this.bought[kind] ?? 0) + 1;
        this.purchases++;
        if (kind === 'foodstall') this.hunger = 0;
        else if (kind === 'drinkstall') {
          this.thirst = 0;
          this.bladder = Math.min(1, this.bladder + 0.3);
        } else if (kind === 'icecream') this.treat = 0;
        else if (kind === 'balloon') {
          this.balloon = 0;
          this.addBalloon();
        } else if (kind === 'souvenir') this.gift = 0;
        this.fun = Math.min(1, this.fun + (kind === 'foodstall' || kind === 'drinkstall' ? 0.1 : 0.2));
        if (kind !== 'balloon' && kind !== 'souvenir') {
          this.trash = 10 + Math.random() * 10;
          this.sloppy = w.messy() && Math.random() < 0.45;
        }
      } else this.fun = Math.max(0, this.fun - 0.1);
    }
    this.wish = null;
  }

  private addBalloon(): void {
    const colors = [0xe0584f, 0x4a90e2, 0xffd23f, 0x6cc04a, 0xf06aa6];
    const balloon = new THREE.Mesh(BALLOON_GEO, new THREE.MeshStandardMaterial({ color: pick(colors), roughness: 0.4 }));
    balloon.position.set(0.17, 0.95, 0);
    const string = new THREE.Mesh(STRING_GEO, mat(0xf4f1e8));
    string.position.set(0.17, 0.68, 0);
    this.mesh.add(balloon, string);
  }

  update(dt: number, w: GuestWorld, list: number[], reach: Set<number>): void {
    this.age += dt;
    const demand = w.demand();
    if (w.sells('foodstall') && !this.bought.foodstall) this.hunger = Math.min(1, this.hunger + (dt / 160) * demand);
    if (w.sells('drinkstall') && !this.bought.drinkstall) this.thirst = Math.min(1, this.thirst + (dt / 130) * demand);
    if (w.sells('toilet')) this.bladder = Math.min(1, this.bladder + dt / 170);
    if (w.sells('icecream') && !this.bought.icecream) this.treat = Math.min(1, this.treat + (dt / 190) * demand);
    if (w.sells('balloon') && this.wantsBalloon && !this.bought.balloon) this.balloon = Math.min(1, this.balloon + (dt / 110) * demand);
    if (w.sells('bench')) this.tired = Math.min(1, this.tired + dt / 180);
    if (w.sells('souvenir') && !this.bought.souvenir) this.gift = Math.min(1, this.gift + (dt / 120) * demand);
    if (w.sells('playground') && this.child) this.playful = Math.min(1, this.playful + dt / 90);
    this.fun = Math.max(0, this.fun - dt / 240);
    if (!reach.has(this.tile)) {
      this.gone = true; // het pad onder de gast is weggehaald
      return;
    }
    // afval: in de bak als er een vlakbij staat, anders valt het na een poosje op het pad
    if (this.trash > 0) {
      const near = w.shops.some(s => s.kind === 'bin' && Math.abs(s.x + 0.5 - this.gx) < 1.6 && Math.abs(s.y + 0.5 - this.gy) < 1.6);
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

  constructor(tile: number) {
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
    // eerst het voer: een dier met honger is erger dan een poepje
    for (const { trough, food } of w.troughsOf(regionId)) {
      if (!food || (trough.food === food && trough.amount > 1)) continue;
      const spots = w.grid.neighbors(tileIndex(trough.x, trough.y)).filter(i => !isTrough(i));
      const route = spots.length ? w.grid.path(this.tile, spots[0], isTrough) : null;
      if (route) {
        this.job = { trough, food };
        this.route = route.slice(1);
        return;
      }
    }
    const poop = w.poopsOf(regionId)[0];
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
