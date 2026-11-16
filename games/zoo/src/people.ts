// Gasten: ze komen binnen bij de ingang, lopen over de paden, kijken bij de dieren
// en kopen eten of drinken als ze het naar hun zin hebben.
import * as THREE from 'three';
import { TERRAINS, type ShopKind } from './data';
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

export interface GuestWorld {
  grid: Grid;
  shops: ShopSpot[];
  /** Is er vanaf deze padtegel iets te zien? Zo ja: hoe leuk, en waar kijk je dan naar. */
  viewScore(tile: number): { score: number; x: number; y: number } | null;
  /** Een gast staat bij de kraam. Geeft terug of hij iets koopt. */
  buy(shop: ShopSpot, guest: Guest): boolean;
  /** Hoe snel gasten trek krijgen; hoger als het park net veel heeft uitgegeven. */
  demand(): number;
  /** Hoeveel gasten het park nu trekt. */
  capacity(): number;
  /** Bestaat dit soort kraam al in het spel? Zo niet, dan krijgen gasten er ook geen trek in. */
  sells(kind: ShopKind): boolean;
}

// ------------------------------------------------------------ poppetje
const SKIN = [0xf6cfa6, 0xe8b48a, 0xc98d5e, 0xa86b42, 0x8a5637];
const SHIRT = [0xe0584f, 0x4a90e2, 0xf5a623, 0x6cc04a, 0xb06ad9, 0x2bb5a8, 0xf06aa6, 0xf4f1e8];
const PANTS = [0x3d4f7a, 0x5a4636, 0x38343c, 0x6b7a4a];
const HAIR = [0x2b1b14, 0x7a4a22, 0xd9a520, 0xd9532b, 0x9aa0a6];
const BODY_GEO = new THREE.BoxGeometry(0.2, 0.22, 0.13);
const HEAD_GEO = new THREE.BoxGeometry(0.17, 0.17, 0.17);
const HAIR_GEO = new THREE.BoxGeometry(0.185, 0.07, 0.185);
const LEG_GEO = new THREE.BoxGeometry(0.075, 0.2, 0.08).translate(0, -0.1, 0);
const ARM_GEO = new THREE.BoxGeometry(0.055, 0.18, 0.07).translate(0, -0.09, 0);
const mats = new Map<number, THREE.MeshStandardMaterial>();
const mat = (color: number): THREE.MeshStandardMaterial => {
  let m = mats.get(color);
  if (!m) mats.set(color, (m = new THREE.MeshStandardMaterial({ color, roughness: 0.9 })));
  return m;
};
const pick = <T>(list: T[]): T => list[Math.floor(Math.random() * list.length)];

function makePerson(): { group: THREE.Group; limbs: THREE.Mesh[]; height: number } {
  const skin = mat(pick(SKIN)), shirt = mat(pick(SHIRT)), pants = mat(pick(PANTS));
  const part = (geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number): THREE.Mesh => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, 0);
    mesh.castShadow = true;
    return mesh;
  };
  const limbs = [part(LEG_GEO, pants, 0.052, 0.2), part(LEG_GEO, pants, -0.052, 0.2), part(ARM_GEO, shirt, 0.13, 0.41), part(ARM_GEO, shirt, -0.13, 0.41)];
  const group = new THREE.Group();
  group.add(...limbs, part(BODY_GEO, shirt, 0, 0.31), part(HEAD_GEO, skin, 0, 0.505), part(HAIR_GEO, mat(pick(HAIR)), 0, 0.6));
  const scale = Math.random() < 0.35 ? 0.72 : 1 + Math.random() * 0.12; // kind of volwassene
  group.scale.setScalar(scale);
  return { group, limbs, height: 0.66 * scale };
}

// ------------------------------------------------------------ gast
type GuestState = 'idle' | 'walk' | 'watch' | 'buy' | 'sit';

export class Guest {
  readonly mesh: THREE.Group;
  readonly height: number;
  gx: number;
  gy: number;
  hunger = Math.random() * 0.3;
  thirst = Math.random() * 0.3;
  /** Plezier van 0 tot 1. Een gast koopt alleen iets als hij het naar zijn zin heeft. */
  fun = 0.5;
  /** Wat de gast mist, voor het wolkje boven zijn hoofd. */
  need: 'food' | 'drink' | 'sad' | null = null;
  gone = false;
  /** Heeft de speler al naar deze gast gezwaaid? */
  waved = false;
  private bought = { foodstall: 0, drinkstall: 0, bench: 0 };

  private limbs: THREE.Mesh[];
  private state: GuestState = 'idle';
  private timer = 0.3;
  private age = 0;
  private stay = 80 + Math.random() * 70;
  private route: number[] = [];
  private heading = Math.PI;
  private phase = Math.random() * 6;
  private shop: ShopSpot | null = null;
  private gain = 0;
  private face: [number, number] | null = null;
  private seen: number[] = [];
  private leaving = false;
  private ox = (Math.random() - 0.5) * 0.4;
  private oy = (Math.random() - 0.5) * 0.4;

  constructor(tile: number) {
    const person = makePerson();
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

  get happy(): boolean {
    return this.fun >= 0.55 && this.hunger < 0.9 && this.thirst < 0.9;
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

  private decide(w: GuestWorld, list: number[], reach: Set<number>): void {
    this.shop = null;
    this.face = null;
    if (this.age > this.stay || this.fun < 0.08) this.leaving = true;
    if (this.leaving) {
      if (this.tile === ENTRANCE || !this.go(w, reach, ENTRANCE)) this.gone = true;
      return;
    }
    // eerst honger en dorst
    const want: ShopKind | null = this.hunger > 0.6 && this.hunger >= this.thirst ? 'foodstall' : this.thirst > 0.6 ? 'drinkstall' : this.hunger > 0.6 ? 'foodstall' : null;
    this.need = this.fun < 0.2 ? 'sad' : null;
    if (want) {
      const spot = this.spotBeside(w, reach, want);
      if (spot && (spot.tile === this.tile || this.go(w, reach, spot.tile))) {
        this.shop = spot.shop;
        if (spot.tile === this.tile) this.arrive(w);
        return;
      }
      this.need = want === 'foodstall' ? 'food' : 'drink';
      this.fun = Math.max(0, this.fun - 0.05);
    }
    // even zitten als het tegenzit
    if (this.fun < 0.5 && Math.random() < 0.4) {
      const spot = this.spotBeside(w, reach, 'bench');
      if (spot && this.go(w, reach, spot.tile)) {
        this.shop = spot.shop;
        return;
      }
    }
    // naar een plek lopen waar iets te zien is
    for (let tries = 0; tries < 14; tries++) {
      const tile = pick(list);
      if (tile === this.tile || this.seen.includes(tile)) continue;
      const view = w.viewScore(tile);
      if (view && this.go(w, reach, tile)) {
        this.gain = view.score;
        this.face = [view.x, view.y];
        this.seen = [...this.seen.slice(-4), tile];
        return;
      }
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
      this.state = this.shop.kind === 'bench' ? 'sit' : 'buy';
      this.timer = this.shop.kind === 'bench' ? 4.5 : 1.8;
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
    if (this.state === 'watch') this.fun = Math.min(1, this.fun + this.gain);
    else if (this.state === 'sit') this.fun = Math.min(1, this.fun + 0.15);
    else if (this.state === 'buy' && this.shop && w.shops.includes(this.shop)) {
      if (w.buy(this.shop, this)) {
        this.bought[this.shop.kind]++;
        if (this.shop.kind === 'foodstall') this.hunger = 0;
        else this.thirst = 0;
        this.fun = Math.min(1, this.fun + 0.1);
      } else this.fun = Math.max(0, this.fun - 0.1);
    }
  }

  update(dt: number, w: GuestWorld, list: number[], reach: Set<number>): void {
    this.age += dt;
    const demand = w.demand();
    if (w.sells('foodstall') && !this.bought.foodstall) this.hunger = Math.min(1, this.hunger + (dt / 160) * demand);
    if (w.sells('drinkstall') && !this.bought.drinkstall) this.thirst = Math.min(1, this.thirst + (dt / 130) * demand);
    this.fun = Math.max(0, this.fun - dt / 240);
    if (!reach.has(this.tile)) {
      this.gone = true; // het pad onder de gast is weggehaald
      return;
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
    const swing = this.state === 'walk' ? Math.sin(this.phase) * 0.7 : 0;
    this.limbs[0].rotation.x = swing;
    this.limbs[1].rotation.x = -swing;
    this.limbs[2].rotation.x = -swing * 0.8;
    this.limbs[3].rotation.x = swing * 0.8;
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
        const guest = new Guest(ENTRANCE);
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

  stats(): { total: number; happy: number; hungry: number; thirsty: number } {
    return {
      total: this.guests.length,
      happy: this.guests.filter(g => g.happy).length,
      hungry: this.guests.filter(g => g.need === 'food').length,
      thirsty: this.guests.filter(g => g.need === 'drink').length,
    };
  }
}
