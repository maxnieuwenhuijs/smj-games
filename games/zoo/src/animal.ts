// Eén dier: wat het wil, wat het doet en welke animatie daarbij hoort.
import { MAX_POOPS_CLEAN, SPECIES, TERRAINS, WISH_ORDER, type SpeciesId, type Variant, type WishId } from './data';
import { Grid, tileIndex, tileXY } from './grid';
import { MODEL_SCALE, modelInfo, spawnModel, type ModelInfo, type Spawned } from './models';
import { toWorldX, toWorldZ } from './view';

export interface Bed {
  x: number;
  y: number;
  kind: string;
}

export interface Trough {
  x: number;
  y: number;
  food: string | null;
  amount: number;
}

/** Wat een dier van het park moet weten en kunnen. */
export interface AnimalWorld {
  grid: Grid;
  troughs: Trough[];
  beds: Bed[];
  animals: Animal[];
  poopsIn(regionId: number): number;
  dropPoop(gx: number, gy: number): void;
  dropPuddle(gx: number, gy: number): void;
  ate(trough: Trough): void;
}

type State = 'idle' | 'walk' | 'eat' | 'poop' | 'pee' | 'rest' | 'emote';

const HUNGER_PER_SEC = 1 / 80;
const SEEK_FOOD = 0.4;
const HUNGRY = 0.6;

export class Animal {
  readonly model: Spawned;
  readonly info: ModelInfo;
  readonly young: boolean;
  gx: number;
  gy: number;
  hunger = 0.7;
  name = '';
  /** Loopt op zolang het dier iets mist; bij te veel wordt het opgehaald. */
  neglect = 0;
  /** Sterk dier in een verblijf met een houten hek: het wil een stenen muur. */
  needsWall = false;
  happy = false;
  unmet: WishId | null = 'enclosure';

  private state: State = 'idle';
  private timeLeft = 1;
  private route: number[] = [];
  private eatAt: Trough | null = null;
  private anim = '';
  private heading = Math.random() * Math.PI * 2;
  private poopIn = 25 + Math.random() * 30;
  private dropped = false;
  /** Zoveel seconden slapen zodra het dier op zijn slaapplek aankomt. */
  private napFor = 0;
  /** Vaste kleine afwijking, zodat dieren niet precies op elkaar staan. */
  private ox = (Math.random() - 0.5) * 0.36;
  private oy = (Math.random() - 0.5) * 0.36;

  constructor(readonly species: SpeciesId, readonly variant: Variant, gx: number, gy: number) {
    const key = `${species}_${variant}`;
    this.model = spawnModel(key);
    this.info = modelInfo(key);
    this.young = variant.startsWith('young');
    this.gx = gx;
    this.gy = gy;
    this.play('Idle');
    this.place();
  }

  get tile(): number {
    return tileIndex(Math.floor(this.gx), Math.floor(this.gy));
  }

  /** Hoogte boven de grond voor het wolkje, in tegels. */
  get top(): number {
    return this.info.height * MODEL_SCALE + 0.25;
  }

  private place(): void {
    this.model.root.position.set(toWorldX(this.gx), 0, toWorldZ(this.gy));
    this.model.root.rotation.y = this.heading;
  }

  private play(name: string, timeScale = 1): void {
    if (this.anim === name) return;
    const next = this.model.actions[name];
    if (!next) return;
    const prev = this.model.actions[this.anim];
    next.reset();
    next.timeScale = timeScale;
    next.play();
    if (prev) prev.crossFadeTo(next, 0.25, false);
    this.anim = name;
  }

  /** Kort gebaar, bijvoorbeeld blij na het voeren. */
  emote(name: 'Happy' | 'Sad' | 'Play', seconds: number): void {
    this.state = 'emote';
    this.timeLeft = seconds;
    this.route = [];
    this.eatAt = null;
    this.play(name);
  }

  get sleeping(): boolean {
    return this.anim === 'Sleep';
  }

  get hungry(): boolean {
    return this.hunger > 0.25;
  }

  private stop(): void {
    this.route = [];
    this.eatAt = null;
    this.napFor = 0;
  }

  /** Slaapt een poosje, wat er ook gebeurt. */
  sedate(seconds: number): void {
    this.stop();
    this.state = 'rest';
    this.timeLeft = seconds;
    this.play('Sleep');
  }

  /** Krijgt voer uit de hand: meteen eten, honger is weg. */
  handFeed(): void {
    this.stop();
    this.hunger = 0;
    this.state = 'eat';
    this.timeLeft = 2.2;
    this.play('Eat');
  }

  /** Wordt opgetild en ergens anders neergezet. */
  moveTo(gx: number, gy: number): void {
    this.stop();
    this.gx = gx;
    this.gy = gy;
    this.state = 'idle';
    this.timeLeft = 0.8;
    this.play('Idle');
    this.place();
  }

  /** Welke wensen zijn vervuld? */
  checkWishes(w: AnimalWorld): Record<WishId, boolean> {
    const [x, y] = tileXY(this.tile);
    const region = w.grid.enclosureAt(x, y);
    const info = SPECIES[this.species];
    this.needsWall = !!region && !!info.strong && w.grid.penStrength(region) < 2;
    const result: Record<WishId, boolean> = { enclosure: !!region && !this.needsWall, food: this.hunger < HUNGRY, bed: false, terrain: false, friend: false, clean: false };
    if (region) {
      const want = TERRAINS.indexOf(info.terrain);
      result.terrain = region.tiles.filter(i => w.grid.terrain[i] === want).length * 2 >= region.tiles.length;
      result.friend = w.animals.some(a => a !== this && a.species === this.species && w.grid.regionOf[a.tile] === region.id);
      result.clean = w.poopsIn(region.id) <= MAX_POOPS_CLEAN;
      result.bed = w.beds.some(b => b.kind === info.bed && w.grid.regionOf[tileIndex(b.x, b.y)] === region.id);
    }
    this.unmet = WISH_ORDER.find(k => !result[k]) ?? null;
    this.happy = this.unmet === null;
    return result;
  }

  private choose(w: AnimalWorld): void {
    const [x, y] = tileXY(this.tile);
    const region = w.grid.enclosureAt(x, y);
    this.eatAt = null;
    this.napFor = 0;
    if (!region) {
      this.state = 'emote';
      this.timeLeft = 3;
      this.play('Sad');
      return;
    }
    if (this.poopIn <= 0) {
      this.poopIn = 40 + Math.random() * 40;
      this.state = 'poop';
      this.timeLeft = 2.6;
      this.dropped = false;
      this.play('Poop');
      return;
    }
    const isTrough = (i: number) => w.troughs.some(t => tileIndex(t.x, t.y) === i);
    if (this.hunger > SEEK_FOOD) {
      const food = SPECIES[this.species].food;
      for (const trough of w.troughs) {
        if (trough.food !== food || trough.amount <= 0) continue;
        const ti = tileIndex(trough.x, trough.y);
        if (w.grid.regionOf[ti] !== region.id) continue;
        const spots = w.grid.neighbors(ti).filter(i => !isTrough(i));
        const spot = spots[Math.floor(Math.random() * spots.length)];
        const route = spot === undefined ? null : w.grid.path(this.tile, spot, isTrough);
        if (route) {
          this.eatAt = trough;
          this.startWalk(route);
          return;
        }
      }
    }
    const r = Math.random();
    if (r < 0.55) {
      const free = region.tiles.filter(i => !isTrough(i));
      const goal = free[Math.floor(Math.random() * free.length)];
      const route = goal === undefined ? null : w.grid.path(this.tile, goal, isTrough);
      if (route && route.length > 1) return this.startWalk(route);
    }
    if (r < 0.66) return this.rest('Sit', 4 + Math.random() * 3);
    if (r < 0.76) return this.rest('Lie', 5 + Math.random() * 3);
    if (r < 0.88) {
      // naar de eigen slaapplek lopen en daar gaan slapen
      const mine = w.beds.filter(b => b.kind === SPECIES[this.species].bed && w.grid.regionOf[tileIndex(b.x, b.y)] === region.id);
      const bed = mine[Math.floor(Math.random() * mine.length)];
      const route = bed ? w.grid.path(this.tile, tileIndex(bed.x, bed.y), isTrough) : null;
      if (route) {
        this.napFor = 10 + Math.random() * 6;
        return this.startWalk(route);
      }
      if (r < 0.82 && this.happy) return this.rest('Sleep', 8 + Math.random() * 4);
    }
    if (r < 0.92) return this.emote(this.happy ? 'Play' : 'Sad', 3);
    if (r < 0.96) {
      this.state = 'pee';
      this.timeLeft = 2.6;
      this.dropped = false;
      this.play('Pee');
      return;
    }
    this.state = 'idle';
    this.timeLeft = 1.5 + Math.random() * 2.5;
    this.play('Idle');
  }

  private rest(name: string, seconds: number): void {
    this.state = 'rest';
    this.timeLeft = seconds;
    this.play(name);
  }

  private startWalk(route: number[]): void {
    this.route = route.slice(1);
    this.state = 'walk';
    this.play('Walk', this.young ? 2.2 : 1.35);
  }

  private behind(distance: number): [number, number] {
    return [this.gx - Math.sin(this.heading) * distance, this.gy - Math.cos(this.heading) * distance];
  }

  private turnTo(target: number, dt: number): void {
    let d = target - this.heading;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.heading += d * Math.min(1, dt * 8);
  }

  update(dt: number, w: AnimalWorld): void {
    this.model.mixer.update(dt);
    this.hunger = Math.min(1, this.hunger + dt * HUNGER_PER_SEC);
    this.poopIn -= dt;

    if (this.state === 'walk') {
      const next = this.route[0];
      if (next === undefined) {
        if (this.napFor) {
          const seconds = this.napFor;
          this.napFor = 0;
          this.rest('Sleep', seconds);
        } else if (this.eatAt && this.eatAt.amount > 0) {
          this.state = 'eat';
          this.timeLeft = 3;
          this.play('Eat');
        } else {
          this.state = 'idle';
          this.timeLeft = 1 + Math.random() * 2;
          this.play('Idle');
        }
      } else {
        const [tx, ty] = tileXY(next);
        const dx = tx + 0.5 + this.ox - this.gx;
        const dy = ty + 0.5 + this.oy - this.gy;
        const dist = Math.hypot(dx, dy);
        const step = (this.young ? 0.72 : 0.92) * MODEL_SCALE * dt;
        if (dist <= step) {
          this.gx += dx;
          this.gy += dy;
          this.route.shift();
        } else {
          this.gx += (dx / dist) * step;
          this.gy += (dy / dist) * step;
          this.turnTo(Math.atan2(dx, dy), dt);
        }
      }
    } else {
      this.timeLeft -= dt;
      if (this.state === 'eat' && this.eatAt) {
        this.turnTo(Math.atan2(this.eatAt.x + 0.5 - this.gx, this.eatAt.y + 0.5 - this.gy), dt);
        if (this.timeLeft <= 0) {
          this.hunger = 0;
          w.ate(this.eatAt);
          this.eatAt = null;
        }
      }
      if ((this.state === 'poop' || this.state === 'pee') && !this.dropped && this.timeLeft < 1.2) {
        this.dropped = true;
        const reach = this.info.back * MODEL_SCALE + 0.12;
        let [px, py] = this.behind(this.state === 'poop' ? reach : reach * 0.7);
        // nooit buiten het eigen verblijf laten vallen
        if (!w.grid.inBounds(Math.floor(px), Math.floor(py)) || w.grid.regionOf[tileIndex(Math.floor(px), Math.floor(py))] !== w.grid.regionOf[this.tile])
          [px, py] = [this.gx, this.gy];
        if (this.state === 'poop') w.dropPoop(px, py);
        else w.dropPuddle(px, py);
      }
      if (this.timeLeft <= 0) this.choose(w);
    }
    this.place();
  }
}
