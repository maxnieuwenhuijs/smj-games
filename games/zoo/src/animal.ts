// Eén dier: wat het wil, wat het doet en welke animatie daarbij hoort.
import { ALSO, MIX_TILES, type Terrain, MAX_POOPS_CLEAN, SPACE, SPECIES, TERRAINS, TOY_OF, WISH_ORDER, herdOf, type FenceNeed, type SpeciesId, type Variant, type WishId } from './data';
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

export interface Toy {
  x: number;
  y: number;
  kind: string;
}

/** Wat een dier van het park moet weten en kunnen. */
export interface AnimalWorld {
  grid: Grid;
  troughs: Trough[];
  beds: Bed[];
  toys: Toy[];
  /** Willen dieren al iets leuks in hun verblijf (vanaf level 10)? */
  wantsFun(): boolean;
  /** Is het nacht? Dan slapen de meeste dieren. */
  isNight(): boolean;
  /** Een dier speelt zoveel seconden met dit ding: het ding beweegt mee. */
  playWith(toy: Toy, seconds: number): void;
  animals: Animal[];
  poopsIn(regionId: number): number;
  dropPoop(gx: number, gy: number): void;
  dropPuddle(gx: number, gy: number): void;
  /** Een dier poept of plast: af en toe hoor je dat. */
  messSound(kind: 'poop' | 'pee'): void;
  /** Hoeveel sneller dieren honger krijgen: meer als een level om voeren vraagt. */
  hungerRate(): number;
  /** De gast die het dichtst bij staat te kijken (binnen een paar tegels), of null. */
  guestNear(gx: number, gy: number): [number, number] | null;
  /** Een hartje boven deze plek. */
  heart(gx: number, gy: number, height: number): void;
  /** Een dier beweegt door het water: een paar spatters op deze plek. */
  splash(gx: number, gy: number): void;
  ate(trough: Trough): void;
  /** Hoe snel dieren moeten poepen; sneller als het level om opruimen vraagt. */
  poopRate(): number;
  /** Is er een hek van dit verblijf helemaal kapot? Dan voelen de dieren zich niet veilig. */
  brokenPen(regionId: number): boolean;
}

type State = 'idle' | 'walk' | 'eat' | 'poop' | 'pee' | 'rest' | 'emote';

// Een volle bak (vier porties) houdt twee volwassen dieren ongeveer een kwartier zoet; daarna duurt het
// nog een paar minuten voor ze echt honger hebben. Jongen eten mee zonder dat de bak er leger van wordt, en
// poepen niet. Zo wordt het zorgen niet zwaarder als er jongen bij komen.
const HUNGER_PER_SEC = 1 / 1200;
const NEED_KIND: Record<FenceNeed, number> = { wall: 3, net: 4 };
/** Zo hoog ligt een dier dat op zijn slaapplek slaapt: boven op de rots of het stro, niet erin. */
const BED_LIFT: Record<string, number> = { straw: 0.1, shed: 0.1, rock: 0.22, nest: 0.07, cave: 0.03 };
const WATER_TILE = TERRAINS.indexOf('water');
type Trick = 'hop' | 'spin' | 'roll' | 'shake' | 'wiggle' | 'stretch' | 'nuzzle' | 'greet' | 'dance';
const SEEK_FOOD = 0.4;
const HUNGRY = 0.6;

const isTroughTile = (w: AnimalWorld, i: number): boolean => w.troughs.some(t => tileIndex(t.x, t.y) === i);

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
  /** De grond die nog ontbreekt (eerst de eigen grond, dan de mix), en welke stukjes van de mix er nog niet zijn. */
  missing: Terrain | null = null;
  lacking: Terrain[] = [];
  /** De eigen grond klopt; er ontbreekt alleen nog een stukje van de mix. Daar wordt een dier nooit voor opgehaald. */
  mixOnly = false;
  mainOk = false;
  /** Het verblijf heeft niet het hek dat dit dier nodig heeft: 'wall' (stenen muur) of 'net' (hoog net). */
  needsFence: FenceNeed | null = null;
  /** Ziek: het dier ligt stil tot de dokter is geweest. */
  sick = false;
  /** Ontsnapt: het dier loopt buiten zijn verblijf rond tot je het terugzet. */
  escaped = false;
  happy = false;
  unmet: WishId | null = 'enclosure';

  private state: State = 'idle';
  private timeLeft = 1;
  private route: number[] = [];
  private eatAt: Trough | null = null;
  private anim = '';
  private heading = Math.random() * Math.PI * 2;
  private poopIn = 160 + Math.random() * 160;
  private dropped = false;
  /** Zoveel seconden slapen zodra het dier op zijn slaapplek aankomt. */
  private napFor = 0;
  /** De slaapplek waar het dier naartoe loopt. */
  private napBed: Bed | null = null;
  /** Hoeveel soortgenoten er nog bij moeten voor het dier zich thuis voelt. */
  lonely = 0;
  /** Het hek van het verblijf is kapot (en niet gewoon open). */
  fenceBroken = false;
  /** Het speelgoed waar het dier naartoe loopt om mee te spelen. */
  private playAt: Toy | null = null;
  /** Hoe hoog het dier nu ligt en moet liggen (boven op een slaapplek). */
  private lift = 0;
  private y = 0;
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

  /**
   * Een kunstje boven op de gewone animatie: het hele dier springt, draait, rolt, schudt of rekt zich uit.
   * Zo heeft elk dier veel meer bewegingen dan de twaalf uit het model.
   */
  private trick: { kind: Trick; t: number } | null = null;
  /** Het dier rent (in plaats van loopt) naar zijn doel. */
  private fast = false;
  /** Net uit het water: aan land schudt het zich droog. */
  private wet = false;
  /** Het vriendje waar het dier naartoe loopt om te kroelen. */
  private pal: Animal | null = null;

  /** Hoe diep het dier in het water ligt, en de tel voor het dobberen. */
  private sink = 0;
  private bob = Math.random() * 6;

  private place(): void {
    // in het water zakt het dier een stuk weg en dobbert het: zo zwemt het
    this.y += (this.lift - this.sink - this.y) * 0.18;
    const wave = this.sink ? Math.sin(this.bob * 3) * 0.02 : 0;
    let y = this.y + wave, yaw = this.heading, roll = 0, sx = 1, sy = 1, sz = 1;
    const k = this.trick;
    if (k) {
      const u = k.t, tall = this.info.height * MODEL_SCALE;
      if (k.kind === 'hop' || k.kind === 'greet' || k.kind === 'dance') {
        // springen, met een beetje indrukken en uitrekken
        const h = Math.abs(Math.sin(u * (k.kind === 'greet' ? 7 : 6)));
        y += h * tall * (k.kind === 'greet' ? 0.3 : 0.5);
        sy = 1 + (h - 0.5) * 0.16;
        sx = sz = 1 - (h - 0.5) * 0.08;
        if (k.kind === 'dance') yaw += Math.sin(u * 5) * 0.6;
        if (k.kind === 'greet') yaw += Math.sin(u * 12) * 0.12;
      } else if (k.kind === 'spin') yaw += u * 7.5;
      else if (k.kind === 'roll') roll = Math.sin(u * 2.4) * 1.25;
      else if (k.kind === 'shake') roll = Math.sin(u * 40) * 0.16;
      else if (k.kind === 'wiggle') yaw += Math.sin(u * 15) * 0.24;
      else if (k.kind === 'stretch') {
        const s = Math.sin(Math.min(1, u / 2.2) * Math.PI);
        sz = 1 + s * 0.18;
        sy = 1 - s * 0.1;
      } else if (k.kind === 'nuzzle') {
        roll = Math.sin(u * 6) * 0.1;
        y += Math.abs(Math.sin(u * 6)) * tall * 0.06;
      }
    } else if (this.anim === 'Sleep') sy = 1 + Math.sin(this.bob * 1.7) * 0.035; // ademen in de slaap
    const root = this.model.root;
    root.position.set(toWorldX(this.gx), y, toWorldZ(this.gy));
    root.rotation.set(0, yaw, roll);
    root.scale.set(MODEL_SCALE * sx, MODEL_SCALE * sy, MODEL_SCALE * sz);
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

  /** Een kunstje doen: de animatie uit het model met een beweging van het hele dier eroverheen. */
  private doTrick(kind: Trick, seconds: number, clip: string): void {
    this.state = 'emote';
    this.timeLeft = seconds;
    this.route = [];
    this.eatAt = null;
    this.play(clip);
    this.trick = { kind, t: 0 };
  }

  /** Feest: het dier danst (als een level gehaald is). */
  cheer(): void {
    if (this.sick || this.escaped || this.anim === 'Sleep') return;
    this.doTrick('dance', 2.4 + Math.random(), 'Happy');
  }

  /** Kort gebaar, bijvoorbeeld blij na het voeren. */
  emote(name: 'Happy' | 'Sad' | 'Play', seconds: number): void {
    this.trick = null;
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
    this.trick = null;
    this.fast = false;
    this.pal = null;
    this.lift = 0;
    this.napBed = null;
    this.playAt = null;
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

  /** Wordt ziek en gaat liggen. */
  fallIll(): void {
    this.stop();
    this.sick = true;
    this.state = 'rest';
    this.timeLeft = 4;
    this.play('Lie');
  }

  /** De dokter is geweest. */
  heal(): void {
    this.sick = false;
    this.emote('Happy', 1.6);
  }

  /** Springt uit het verblijf en gaat rondlopen. */
  escape(gx: number, gy: number): void {
    this.moveTo(gx, gy);
    this.escaped = true;
    this.emote('Play', 1.2);
  }

  /** Wordt opgetild en ergens anders neergezet. */
  moveTo(gx: number, gy: number): void {
    this.stop();
    this.escaped = false;
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
    this.needsFence = region && info.need && w.grid.penKind(region) !== NEED_KIND[info.need] ? info.need : null;
    this.fenceBroken = !!region && w.brokenPen(region.id);
    const result: Record<WishId, boolean> = {
      health: !this.sick, enclosure: !!region && !this.needsFence && !this.fenceBroken, food: this.hunger < HUNGRY, bed: false, terrain: false, friend: false, clean: false, space: true, fun: true,
    };
    if (region) {
      const tilesOf = (kind: Terrain): number => {
        const k = TERRAINS.indexOf(kind);
        return region.tiles.filter(i => w.grid.terrain[i] === k).length;
      };
      // de mix: een paar tegels van elke extra soort (in een heel klein verblijf alleen de eerste); van wat
      // overblijft is minstens de helft de eigen grond
      const extras = (ALSO[this.species] ?? []).slice(0, Math.max(1, Math.floor((region.tiles.length - 1) / MIX_TILES)));
      this.mainOk = tilesOf(info.terrain) >= Math.max(1, Math.ceil((region.tiles.length - extras.length * MIX_TILES) / 2));
      this.lacking = extras.filter(kind => tilesOf(kind) < MIX_TILES);
      this.missing = !this.mainOk ? info.terrain : this.lacking[0] ?? null;
      this.mixOnly = this.mainOk && this.lacking.length > 0;
      result.terrain = this.mainOk && !this.lacking.length;
      // groepsdieren willen met meer bij elkaar zijn; grote dieren willen een groot verblijf
      this.lonely = Math.max(0, herdOf(this.species) - w.animals.filter(a => a.species === this.species && w.grid.regionOf[a.tile] === region.id).length);
      result.friend = this.lonely === 0;
      result.space = region.tiles.length >= (SPACE[this.species] ?? 0);
      result.clean = w.poopsIn(region.id) <= MAX_POOPS_CLEAN;
      result.bed = w.beds.some(b => b.kind === info.bed && w.grid.regionOf[tileIndex(b.x, b.y)] === region.id);
      const fav = TOY_OF[this.species];
      result.fun = !fav || !w.wantsFun() || w.toys.some(t => t.kind === fav && w.grid.regionOf[tileIndex(t.x, t.y)] === region.id);
    }
    this.unmet = WISH_ORDER.find(k => !result[k]) ?? null;
    this.happy = this.unmet === null;
    return result;
  }

  /** Bij het speelgoed aangekomen: ernaar kijken en spelen; het ding beweegt mee. */
  private startPlay(w: AnimalWorld): void {
    const toy = this.playAt;
    this.playAt = null;
    if (!toy) return;
    this.heading = Math.atan2(toy.x + 0.5 - this.gx, toy.y + 0.5 - this.gy);
    const seconds = 4 + Math.random() * 2;
    w.playWith(toy, seconds);
    this.emote('Play', seconds);
  }

  private choose(w: AnimalWorld): void {
    this.trick = null;
    this.fast = false;
    this.pal = null;
    // het dier blijft boven op zijn slaapplek staan tot het wegloopt
    this.napBed = null;
    const [x, y] = tileXY(this.tile);
    const region = w.grid.enclosureAt(x, y);
    this.eatAt = null;
    this.napFor = 0;
    if (this.sick) return this.rest(Math.random() < 0.5 ? 'Lie' : 'Sad', 4);
    // 's nachts liggen de meeste dieren te slapen (wie honger heeft, gaat eerst eten)
    if (w.isNight() && this.hunger < HUNGRY && Math.random() < 0.65) return this.rest('Lie', 5 + Math.random() * 4);
    if (!region) {
      if (this.escaped) {
        // buiten rondlopen: een paar stappen naar een willekeurige kant
        const route = [this.tile];
        for (let k = 0; k < 3; k++) {
          const options = w.grid.neighbors(route[route.length - 1]).filter(i => !route.includes(i) && !isTroughTile(w, i));
          if (!options.length) break;
          route.push(options[Math.floor(Math.random() * options.length)]);
        }
        if (route.length > 1) return this.startWalk(route);
      }
      this.state = 'emote';
      this.timeLeft = 3;
      this.play('Sad');
      return;
    }
    if (this.poopIn <= 0 && !this.young) {
      this.poopIn = 340 + Math.random() * 220;
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
    // een blij dier loopt graag naar zijn speelgoed of struik en doet er iets mee
    if (this.happy && Math.random() < 0.22) {
      const here = w.toys.filter(t => w.grid.regionOf[tileIndex(t.x, t.y)] === region.id);
      const mine = here.filter(t => t.kind === TOY_OF[this.species]);
      const pool = mine.length ? mine : here;
      const toy = pool[Math.floor(Math.random() * pool.length)];
      const spots = toy ? w.grid.neighbors(tileIndex(toy.x, toy.y)).filter(i => !isTrough(i) && w.grid.regionOf[i] === region.id) : [];
      const spot = spots[Math.floor(Math.random() * spots.length)];
      const route = spot === undefined ? null : w.grid.path(this.tile, spot, isTrough);
      if (toy && route) {
        this.playAt = toy;
        if (route.length > 1) return this.startWalk(route);
        return this.startPlay(w);
      }
    }
    // een blij dier doet af en toe iets geks: springen, rondjes draaien, rollen, rennen, kroelen, een gast begroeten
    if (this.happy && Math.random() < 0.24) {
      const guest = w.guestNear(this.gx, this.gy);
      if (guest && Math.random() < 0.4) {
        this.heading = Math.atan2(guest[0] - this.gx, guest[1] - this.gy);
        return this.doTrick('greet', 1.6, 'Happy');
      }
      const p = Math.random();
      if (p < 0.18) return this.doTrick('hop', 1.6, 'Happy');
      if (p < 0.3) return this.doTrick('spin', 1.1, 'Play');
      if (p < 0.44) return this.doTrick('roll', 2.6, 'Lie');
      if (p < 0.54) return this.doTrick('wiggle', 1.4, 'Idle');
      if (p < 0.64) return this.doTrick('stretch', 2.2, 'Idle');
      if (p < 0.82) {
        // rennen: een sprintje naar de andere kant van het verblijf
        const far = region.tiles.filter(i => !isTrough(i) && Math.hypot(tileXY(i)[0] + 0.5 - this.gx, tileXY(i)[1] + 0.5 - this.gy) > 1.6);
        const goal = far[Math.floor(Math.random() * far.length)];
        const route = goal === undefined ? null : w.grid.path(this.tile, goal, isTrough);
        if (route && route.length > 1) {
          this.startWalk(route);
          this.fast = true;
          return this.play('Run', this.young ? 2 : 1.5);
        }
      } else {
        // kroelen: naar een vriendje of naar mama lopen
        const pals = w.animals.filter(a => a !== this && a.species === this.species && w.grid.regionOf[a.tile] === region.id && !a.sick);
        const pal = (this.young && pals.find(a => a.variant === 'female')) || pals[Math.floor(Math.random() * pals.length)];
        const spots = pal ? [pal.tile, ...w.grid.neighbors(pal.tile)].filter(i => !isTrough(i)) : [];
        const spot = spots[Math.floor(Math.random() * spots.length)];
        const route = spot === undefined ? null : w.grid.path(this.tile, spot, isTrough);
        if (pal && route) {
          this.pal = pal;
          if (route.length > 1) return this.startWalk(route);
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
        this.napBed = bed;
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
    this.lift = 0;
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
    this.bob += dt;
    if (this.trick) this.trick.t += dt;
    const swims = w.grid.terrain[this.tile] === WATER_TILE && !this.lift;
    this.sink = swims ? this.top * 0.34 : 0;
    if (swims) this.wet = true;
    // wie door het water loopt, spat af en toe
    if (swims && this.state === 'walk' && Math.random() < dt * 2.2) w.splash(this.gx, this.gy);
    this.hunger = Math.min(1, this.hunger + dt * HUNGER_PER_SEC * w.hungerRate() * (this.young ? 0.5 : 1));
    this.poopIn -= dt * w.poopRate();

    if (this.state === 'walk') {
      const next = this.route[0];
      if (next === undefined) {
        this.fast = false;
        if (this.wet && !swims) {
          // net uit het water: even droogschudden
          this.wet = false;
          w.splash(this.gx, this.gy);
          this.doTrick('shake', 0.9, 'Idle');
        } else if (this.pal) {
          // bij het vriendje: neus aan neus, met een hartje
          const pal = this.pal;
          this.pal = null;
          if (Math.hypot(pal.gx - this.gx, pal.gy - this.gy) > 0.1) this.heading = Math.atan2(pal.gx - this.gx, pal.gy - this.gy);
          w.heart((this.gx + pal.gx) / 2, (this.gy + pal.gy) / 2, this.top);
          this.doTrick('nuzzle', 1.8, 'Happy');
        } else if (this.playAt) {
          this.startPlay(w);
        } else if (this.napFor) {
          const seconds = this.napFor;
          this.napFor = 0;
          if (this.napBed) {
            // midden op de slaapplek gaan liggen, en erbovenop
            this.gx = this.napBed.x + 0.5;
            this.gy = this.napBed.y + 0.5;
            this.lift = BED_LIFT[this.napBed.kind] ?? 0;
          }
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
        const step = (this.young ? 0.72 : 0.92) * MODEL_SCALE * dt * (this.fast ? 2.3 : 1);
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
          if (!this.young) w.ate(this.eatAt);
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
        w.messSound(this.state);
        if (this.state === 'poop') w.dropPoop(px, py);
        else w.dropPuddle(px, py);
      }
      if (this.timeLeft <= 0) this.choose(w);
    }
    this.place();
  }
}
