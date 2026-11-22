// Eén dier: wat het wil, wat het doet en welke animatie daarbij hoort.
import * as THREE from 'three';
import {
  ALSO, AQUATIC, CLIMATE, MIX_TILES, MUD_LOVERS, PETTABLE, TANK_WATER, TOY_DRINK, TOY_LIFT, type Nature, type Rare, type Terrain, type ToyKind,
  MAX_POOPS_CLEAN, SPACE, SPECIES, TERRAINS, TOY_OF, WISH_ORDER, herdOf, palsOf, wildRange, WILD_KINDS, type PropGroup, type WildKind, type FenceNeed, type SpeciesId, type Variant, type WishId,
} from './data';
import { CLIMB_SECONDS, PUSH, ROCK_SECONDS, SWING, SWING_SECONDS, TETHER, TOY_PIVOT, UNDER, likesToy, rockAt, swingAt, type Beat } from './data';
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
  /** Hoeveel kwartslagen het gedraaid is; een tunnel ligt dan van boven naar beneden in plaats van links naar rechts. */
  rot?: number;
  /**
   * De losse stukken (de ballen, de liggende stam): waar elk nu ligt, in tegels vanaf het midden van de tegel, en
   * hoe dik het is. `line`: een stam, die rolt uit zichzelf weer terug.
   */
  loose?: { ox: number; oy: number; r: number; line?: boolean }[];
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
  /**
   * Een dier speelt zoveel seconden met dit ding: het ding beweegt mee. `facing`: de kant waar het dier naartoe kijkt.
   * `hits`: 1 = het dier geeft er stootjes tegen (in plaats van erop te zitten), -1 = het snuffelt er alleen aan.
   */
  playWith(toy: Toy, seconds: number, facing?: number, hits?: number): void;
  /** Een dier op (fromX, fromY) geeft een los stuk van dit ding een duwtje: het rolt van het dier weg. Lukt niet als het ding weg is. */
  nudgeToy(toy: Toy, piece: number, fromX: number, fromY: number): boolean;
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
  /** Staat deze tegel in een bak van glas vol water? Dan zwemt een dier hoger: in het water in de bak. */
  inTank(tile: number): boolean;
  /** Regent het? Dan schuilen de meeste dieren bij hun slaapplek. */
  raining(): boolean;
  /** Willen dieren al warmte of kou (vanaf FEATURE.climate)? */
  wantsClimate(): boolean;
  /** Willen dieren al groen en steen in hun verblijf (vanaf FEATURE.wild)? */
  wantsWild(): boolean;
  /** Hoeveel bomen, planten en stenen er in dit verblijf staan (in stuks), en hoeveel tegels land het heeft. */
  wildIn(region: { id: number; tiles: number[] }): Record<WildKind, number> & { land: number };
  /** Staat er op deze tegel een boom of een rots? Daar loopt een dier omheen. */
  solidAt(tile: number): boolean;
  /** Regenplassen in het park: daar rollen varkens en andere modderliefhebbers in. */
  rainPuddles: { gx: number; gy: number }[];
  /** Is dit verblijf een kinderboerderij (wit hekje)? Daar mogen de boerderijdieren door elkaar. */
  pettingPen(regionId: number): boolean;
}

type State = 'idle' | 'walk' | 'eat' | 'poop' | 'pee' | 'rest' | 'emote';

// Een volle bak (vier porties) houdt twee volwassen dieren ongeveer een kwartier zoet; daarna duurt het
// nog een paar minuten voor ze echt honger hebben. Jongen eten mee zonder dat de bak er leger van wordt, en
// poepen niet. Zo wordt het zorgen niet zwaarder als er jongen bij komen.
const HUNGER_PER_SEC = 1 / 1200;
const NEED_KIND: Record<FenceNeed, number> = { wall: 3, net: 4, glass: 5 };
/** Zo hoog ligt een dier dat op zijn slaapplek slaapt: boven op de rots of het stro, niet erin. */
const BED_LIFT: Record<string, number> = { straw: 0.1, shed: 0.1, rock: 0.22, nest: 0.07, cave: 0.03 };
const WATER_TILE = TERRAINS.indexOf('water');
/** Kunstjes die een dier zomaar kan doen: hoe lang ze duren en welke animatie uit het model erbij hoort. */
type Solo = 'hop' | 'spin' | 'roll' | 'shake' | 'wiggle' | 'stretch' | 'sniff' | 'dig' | 'bow' | 'jumpturn' | 'sway' | 'peek' | 'survey';
type Trick = Solo | 'nuzzle' | 'greet' | 'dance' | 'leap' | 'look' | 'tunnel' | 'peekin' | 'fetch'
  // bij het speelgoed dat zelf beweegt: schommelen, wippen, stootjes geven, klimmen en ergens onderdoor lopen
  | 'swing' | 'rock' | 'punch' | 'climb' | 'under';
const SHOW: Record<Solo, [number, string]> = {
  hop: [1.6, 'Happy'], spin: [1.1, 'Play'], roll: [2.6, 'Lie'], shake: [0.9, 'Idle'], wiggle: [1.4, 'Idle'], stretch: [2.2, 'Idle'],
  sniff: [2.62, 'Eat'], dig: [2.2, 'Eat'], bow: [1.8, 'Idle'], jumpturn: [1.8, 'Happy'], sway: [2.95, 'Idle'], peek: [2.6, 'Idle'], survey: [5.24, 'Idle'],
};
const SEEK_FOOD = 0.4;
const HUNGRY = 0.6;
/** Hoe snel een dier loopt, naar zijn karakter. */
const PACE: Record<Nature, number> = { plain: 1, shy: 0.85, playful: 1.2, sleepy: 0.85, brave: 1 };
/** Dingen voor dieren op het land: een zeedier doet er niets mee. */
const LAND_TOYS: string[] = ['hill', 'rocks', 'frame', 'tunnel', 'drink', 'fall', 'lamp', 'icebox', 'tyre', 'rocker', 'tetherball', 'logarch', 'tyreswing', 'pole'];
/** Zoveel ruimte blijft er tussen het lijf van een dier en het hek. */
const FENCE_GAP = 0.1;
const GOLD = new THREE.Color(0xf2c14e);
const WHITE = new THREE.Color(0xffffff);
const TINT = new THREE.Color();

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));
const luminance = (c: THREE.Color): number => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
/** Een zeldzame kleur: wit, goud of donker. Heel donkere stukjes (ogen, neus) en zuiver wit blijven zoals ze zijn. */
function tint(c: THREE.Color, kind: Rare, floor: number): void {
  if (luminance(c) < floor || (c.r > 0.98 && c.g > 0.98 && c.b > 0.98)) return;
  if (kind === 'white') c.lerp(WHITE, 0.75);
  else if (kind === 'gold') c.lerp(GOLD, 0.55);
  else c.multiplyScalar(0.42);
}

/** Een tegel waar een dier niet overheen loopt: daar staat een voerbak, een boom of een rots. */
const isTroughTile = (w: AnimalWorld, i: number): boolean => w.solidAt(i) || w.troughs.some(t => tileIndex(t.x, t.y) === i);

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
  /**
   * Wat er aan natuur niet klopt in het verblijf: te weinig (`more`) of te veel bomen, planten of stenen, en
   * hoeveel stuks het scheelt (`by`). `group` is groen of steen: daar praat de verzorger over.
   */
  wildAsk: { kind: WildKind; group: PropGroup; more: boolean; by: number } | null = null;
  /** Het karakter: verlegen, speels, slaperig of dapper. Je ziet het aan hoe het dier loopt en wat het doet. */
  nature: Nature = 'plain';
  /** Een zeldzame kleur (zie `setRare`). */
  rare: Rare | null = null;

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
  /** De sprong door de hoepel: van waar naar waar. */
  private leap: { fx: number; fy: number; tx: number; ty: number; top: number; seconds: number } | null = null;
  /** Een zeedier: leeft alleen in water. */
  readonly aquatic: boolean;
  /** Hoe hoog het dier nu ligt en moet liggen (boven op een slaapplek). */
  private lift = 0;
  private y = 0;
  /** Vaste kleine afwijking, zodat dieren niet precies op elkaar staan. */
  private ox = (Math.random() - 0.5) * 0.36;
  private oy = (Math.random() - 0.5) * 0.36;
  /** Zoveel staat het dier anders getekend dan waar het echt is: zo steekt een lang lijf niet door het hek. */
  private nx = 0;
  private ny = 0;
  /** Meteen op de goede plek zetten (na het neerzetten), zonder te schuiven. */
  private snap = true;
  /** Tussen deze grenzen mag het getekende midden van het dier komen. */
  private x0 = -Infinity;
  private x1 = Infinity;
  private y0 = -Infinity;
  private y1 = Infinity;
  /** Staat boven op een heuvel, de rotsen of het klimrek: daarna komt het eerst naar beneden. */
  private perched = false;
  /** De ren door de tunnel: van waar naar waar. Ook voor het lopen onder de kruipboog door en de sprong op de bandenschommel. */
  private dash: { fx: number; fy: number; tx: number; ty: number; seconds: number; down?: boolean } | null = null;
  /**
   * Stootjes geven tegen de slingerbal of de bandenschommel: wanneer (`first`, `every`, `hits`), hoe lang het hele
   * spel duurt, hoe ver het dier daarvoor naar voren of naar achteren stapt (`back`) en hoe ver het uithaalt (`lunge`).
   */
  private hit: (Beat & { seconds: number; back: number; lunge: number }) | null = null;
  /**
   * Spelen met een bal of een stam: achter welk los stuk het dier aan gaat (`i`), hoe vaak het nog duwt, hoe lang
   * het eerst kijkt hoe het ding rolt (`wait`), de tel van het duwtje zelf (`bump`) en hoe lang het er al niet bij kan.
   */
  private fetch: { toy: Toy; i: number; kicks: number; wait: number; bump: number; stuck: number } | null = null;
  /** Het kunstje dat hierna komt (uitrekken na het slapen, een sprong na het eten). */
  private encore: Solo | null = null;
  /** Waar het dier naartoe loopt om te rollen ('roll') of om iemand te begroeten ('come'). */
  private goal: 'roll' | 'come' | null = null;
  private spotX = 0;
  private spotY = 0;
  /** Tikkertje: het dier rent naar zijn vriendje, en dat rent dan weg. */
  private chasing = false;
  /** Heen en weer rennen: nog harder dan gewoon rennen. */
  private rush = false;
  /** Wat het dier op zijn slaapplek doet: slapen, of zitten of liggen (schuilen voor de regen). */
  private napClip = 'Sleep';
  /** Hier drinkt het dier uit. */
  private drinkAt: Toy | null = null;
  /** Rolt in een plas: dat spat. */
  private mud = false;
  /** De kant waar het dier rustig naartoe draait (naar een gast), of null. */
  private faceTo: number | null = null;
  /** Verdoofd: het dier wordt niet wakker van de zon. */
  private drugged = false;
  /** Voor de zeldzame kleur: de eigen kleuren van dit ene dier, en de gewone om terug te zetten. */
  private tinted: { mesh: THREE.Mesh; base: THREE.BufferGeometry; own: THREE.BufferGeometry }[] = [];
  private painted: { color: THREE.Color; base: THREE.Color }[] = [];
  private tintReady = false;

  constructor(readonly species: SpeciesId, readonly variant: Variant, gx: number, gy: number) {
    this.aquatic = AQUATIC.includes(species);
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

  /** Waar het dier getekend staat (voor wolkjes en hartjes): net iets anders dan `gx`, `gy` als het bij een hek staat. */
  get px(): number {
    return this.gx + this.nx;
  }

  get py(): number {
    return this.gy + this.ny;
  }

  /**
   * Een zeldzame kleur voor dit ene dier: wit, goud of donker; `null` zet de gewone kleur terug.
   * De kleuren zitten in de punten van het model, dus dit dier krijgt een eigen lijst met kleuren.
   */
  setRare(kind: Rare | null): void {
    this.rare = kind;
    if (!kind && !this.tintReady) return;
    if (!this.tintReady) {
      this.tintReady = true;
      this.model.root.traverse(o => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        const base = mesh.geometry;
        const src = base.getAttribute('color');
        if (src) {
          // alles delen met het gewone model, behalve de kleuren
          const own = new THREE.BufferGeometry();
          own.index = base.index;
          for (const name in base.attributes) own.setAttribute(name, base.attributes[name]);
          own.morphAttributes = base.morphAttributes;
          own.morphTargetsRelative = base.morphTargetsRelative;
          for (const g of base.groups) own.addGroup(g.start, g.count, g.materialIndex);
          own.boundingBox = base.boundingBox;
          own.boundingSphere = base.boundingSphere;
          const dst = new THREE.BufferAttribute(new Float32Array(src.count * src.itemSize), src.itemSize);
          if (src.itemSize > 3) for (let i = 0; i < src.count; i++) dst.setW(i, src.getW(i));
          own.setAttribute('color', dst);
          this.tinted.push({ mesh, base, own });
        } else {
          // een model zonder kleuren in de punten: dan de kleur van het materiaal
          const many = Array.isArray(mesh.material);
          const own = ((many ? mesh.material : [mesh.material]) as THREE.Material[]).map(m => m.clone());
          mesh.material = many ? own : own[0];
          for (const m of own) {
            const color = (m as THREE.MeshStandardMaterial).color;
            if (color) this.painted.push({ color, base: color.clone() });
          }
        }
      });
    }
    for (const p of this.painted) {
      p.color.copy(p.base);
      if (kind) tint(p.color, kind, 0.08);
    }
    for (const t of this.tinted) {
      if (!kind) {
        t.mesh.geometry = t.base;
        continue;
      }
      const src = t.base.getAttribute('color'), dst = t.own.getAttribute('color') as THREE.BufferAttribute;
      // een dier dat zelf donker is (panter, gorilla, orka): dan blijven alleen de echt zwarte stukjes zwart
      let dark = 0;
      for (let i = 0; i < src.count; i++) if (luminance(TINT.setRGB(src.getX(i), src.getY(i), src.getZ(i), THREE.LinearSRGBColorSpace)) < 0.08) dark++;
      const floor = dark > src.count * 0.3 ? 0.015 : 0.08;
      for (let i = 0; i < src.count; i++) {
        tint(TINT.setRGB(src.getX(i), src.getY(i), src.getZ(i), THREE.LinearSRGBColorSpace), kind, floor);
        dst.setXYZ(i, TINT.r, TINT.g, TINT.b);
      }
      dst.needsUpdate = true;
      t.mesh.geometry = t.own;
    }
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
    let y = this.y + wave, yaw = this.heading, roll = 0, pitch = 0, sx = 1, sy = 1, sz = 1;
    // een stukje naar voren of opzij, voor kunstjes waarbij het dier even van zijn plek gaat
    let along = 0, aside = 0;
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
      } else if (k.kind === 'leap' && this.leap) {
        // door de hoepel: een boog van de ene kant naar de andere, neus eerst omhoog en dan omlaag
        const p = Math.min(1, u / this.leap.seconds);
        this.gx = this.leap.fx + (this.leap.tx - this.leap.fx) * p;
        this.gy = this.leap.fy + (this.leap.ty - this.leap.fy) * p;
        y += Math.sin(p * Math.PI) * this.leap.top;
        pitch = -Math.cos(p * Math.PI) * 0.95;
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
      } else if (k.kind === 'sniff') {
        // snuffelen: neus omlaag, met kleine rukjes naar links en rechts en een schuifelpasje
        pitch = 0.1 + Math.sin(u * 9) * 0.03;
        yaw += Math.round(Math.sin(u * 4.8) * 1.5) * 0.24;
        along = Math.sin(u * 2.4) * 0.05;
      } else if (k.kind === 'dig') {
        // graven: snel op en neer met de neus bij de grond
        const s = Math.sin(u * 20);
        pitch = 0.14 + s * 0.08;
        sz = 1 + s * 0.04;
        y += Math.abs(s) * tall * 0.03;
      } else if (k.kind === 'bow') {
        // buigen: diep voorover en weer omhoog
        const s = Math.sin(Math.min(1, u / 1.8) * Math.PI);
        pitch = s * 0.3;
        sy = 1 - s * 0.07;
      } else if (k.kind === 'jumpturn') {
        // twee sprongen met elke keer een halve draai: weg en weer terug
        const h = u / 0.9, n = Math.min(1, Math.floor(h)), f = Math.min(1, h - n), up = Math.sin(f * Math.PI);
        y += up * tall * 0.6;
        yaw += (n + f * f * (3 - 2 * f)) * Math.PI;
        sy = 1 + (up - 0.5) * 0.14;
        sx = sz = 1 - (up - 0.5) * 0.07;
      } else if (k.kind === 'sway') {
        // wiegen: rustig van links naar rechts
        const s = Math.sin(u * 3.2);
        roll = s * 0.13;
        aside = s * 0.05;
      } else if (k.kind === 'peek') {
        // zich lang maken en naar links en rechts kijken
        const s = clamp(Math.min(u * 3, (2.6 - u) * 3), 0, 1);
        sy = 1 + s * 0.2;
        sx = sz = 1 - s * 0.06;
        pitch = -s * 0.12;
        yaw += Math.sin(u * 3.4) * 0.75 * s;
      } else if (k.kind === 'survey') yaw += Math.sin(u * 1.2) * 1.1; // rondkijken: langzaam heen en weer draaien
      else if (k.kind === 'look') {
        // naar een gast kijken: iets langer, kopje scheef
        const s = clamp(Math.min(u * 2, (2.6 - u) * 2), 0, 1);
        sy = 1 + s * 0.05;
        roll = Math.sin(u * 2.2) * 0.06 * s;
      } else if (k.kind === 'tunnel' && this.dash) {
        // door de tunnel: het dier duikt erin weg en komt er aan de andere kant met een sprongetje weer uit
        const d = this.dash, p = Math.min(1, u / d.seconds);
        // langs de tunnel gelijkmatig; dwars erop schuift het dier snel naar het midden
        const q = Math.min(1, p / 0.3);
        this.gx = d.fx + (d.tx - d.fx) * (d.down ? q : p);
        this.gy = d.fy + (d.ty - d.fy) * (d.down ? p : q);
        const inside = p < 0.5 ? clamp((p - 0.2) / 0.12, 0, 1) : clamp((0.8 - p) / 0.12, 0, 1);
        sx = sy = sz = 1 - inside * 0.97;
        if (p > 0.8) y += Math.sin(((p - 0.8) / 0.2) * Math.PI) * tall * 0.45;
      } else if (k.kind === 'peekin') {
        // alleen even in de tunnel kijken en weer terug
        const s = Math.sin(Math.min(1, u / 2.2) * Math.PI);
        along = s * 0.42;
        sx = sy = sz = 1 - s * 0.45;
      } else if (k.kind === 'fetch' && this.fetch?.bump) {
        // het duwtje tegen de bal of de stam: een stootje naar voren, met de neus omlaag
        const s = Math.sin((1 - this.fetch.bump / 0.3) * Math.PI);
        along = s * 0.1;
        pitch = s * 0.12;
      } else if (k.kind === 'swing' && this.dash) {
        // op de bandenschommel: met een sprongetje erop, en dan mee heen en weer; de neus gaat mee omhoog en omlaag
        const d = this.dash, p = Math.min(1, u / d.seconds), rope = (TOY_PIVOT.tyreswing?.[1] ?? 1.25) - SWING.seat, a = swingAt(u);
        this.gx = d.fx + (d.tx - d.fx) * p;
        this.gy = d.fy + (d.ty - d.fy) * p;
        if (p < 1) y += Math.sin(p * Math.PI) * 0.22;
        along = Math.sin(a) * rope;
        y += (1 - Math.cos(a)) * rope;
        pitch = -a;
      } else if (k.kind === 'rock') {
        // op de wipplank: mee voorover en achterover, met het gewicht steeds naar de lage kant
        const a = rockAt(u);
        pitch = a;
        along = Math.sin(a) * 0.3;
      } else if (k.kind === 'punch' && this.hit) {
        // stootjes tegen de slingerbal of de schommel: op de goede afstand gaan staan en steeds even uithalen met de neus
        const h = this.hit, i = clamp(Math.round((u - h.first) / h.every), 0, h.hits - 1);
        const near = clamp(1 - Math.abs(u - h.first - i * h.every) / 0.16, 0, 1), s = near * near * (3 - 2 * near);
        along = h.back * clamp(Math.min(u, h.seconds - u) / 0.4, 0, 1) + s * h.lunge;
        pitch = s * 0.1;
      } else if (k.kind === 'climb') {
        // de klimpaal op: een stapje achteruit, rechtop tegen de paal, met kleine rukjes omhoog en bovenaan de vlonder op
        const p = Math.min(1, u / CLIMB_SECONDS), rear = clamp(p / 0.2, 0, 1) * clamp((1 - p) / 0.2, 0, 1), rise = clamp((p - 0.15) / 0.65, 0, 1);
        along = -0.4 * rear;
        pitch = -1.15 * rear;
        this.lift = (TOY_LIFT.pole ?? 1) * (rise + Math.sin(rise * Math.PI * 8) * 0.02);
      } else if (k.kind === 'under' && this.dash) {
        // onder de kruipboog door: bukken (een hoog dier maakt zich klein) en aan de andere kant weer rechtop
        const d = this.dash, p = Math.min(1, u / d.seconds), q = Math.min(1, p / 0.3);
        this.gx = d.fx + (d.tx - d.fx) * (d.down ? q : p);
        this.gy = d.fy + (d.ty - d.fy) * (d.down ? p : q);
        const low = clamp(Math.min(p - 0.2, 0.8 - p) / 0.12, 0, 1);
        sy = 1 - low * (1 - clamp(UNDER.clear / tall, 0.6, 0.92));
        pitch = low * 0.1;
      }
      // voorover of achterover: iets optillen, anders zakt de neus of de staart door de grond (niet op de schommel of de wipplank: daar kantelt het dier mee)
      if (pitch && k.kind !== 'leap' && k.kind !== 'swing' && k.kind !== 'rock') y += Math.abs(Math.sin(pitch)) * (pitch > 0 ? this.info.length - this.info.back : this.info.back) * MODEL_SCALE * 0.5;
    } else if (this.anim === 'Sleep') {
      sy = 1 + Math.sin(this.bob * 1.7) * 0.035; // ademen in de slaap
      // af en toe een schokje: het dier droomt
      const dream = Math.sin(this.bob * 0.83) - 0.965;
      if (dream > 0) roll = Math.sin(this.bob * 34) * dream * 1.6;
    }
    let px = this.gx + this.nx, py = this.gy + this.ny;
    if (along || aside) {
      // ook een kunstje gaat nooit door het hek
      const s = Math.sin(this.heading), c = Math.cos(this.heading);
      const fx = px + s * along + c * aside, fy = py + c * along - s * aside;
      px = clamp(fx, Math.min(px, this.x0), Math.max(px, this.x1));
      py = clamp(fy, Math.min(py, this.y0), Math.max(py, this.y1));
    }
    const root = this.model.root;
    root.position.set(toWorldX(px), y, toWorldZ(py));
    root.rotation.order = 'YXZ';
    root.rotation.set(pitch, yaw, roll);
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

  /** Een van de losse kunstjes doen. */
  private show(kind: Solo): void {
    this.doTrick(kind, SHOW[kind][0], SHOW[kind][1]);
  }

  /** Rustig naar dit punt toe draaien. */
  private face(x: number, y: number): void {
    if (Math.hypot(x - this.gx, y - this.gy) > 0.1) this.faceTo = Math.atan2(x - this.gx, y - this.gy);
  }

  /** Feest: het dier danst (als een level gehaald is). */
  cheer(): void {
    if (this.sick || this.escaped || this.anim === 'Sleep') return;
    this.doTrick('dance', 2.4 + Math.random(), 'Happy');
  }

  /** Kort gebaar, bijvoorbeeld blij na het voeren. */
  emote(name: 'Happy' | 'Sad' | 'Play', seconds: number): void {
    this.trick = null;
    this.drinkAt = null;
    this.faceTo = null;
    this.state = 'emote';
    this.timeLeft = seconds;
    this.route = [];
    this.eatAt = null;
    this.play(name);
  }

  /** Wat het dier nu doet, in één woord: voor het menu van het dier ('sleep', 'eat', 'walk', ...). */
  get doing(): string {
    if (this.sick) return 'sick';
    if (this.anim === 'Sleep') return 'sleep';
    const k = this.trick?.kind;
    if (k) {
      if (k === 'hop' || k === 'jumpturn' || k === 'dance' || k === 'spin') return 'jump';
      if (k === 'roll') return 'roll';
      if (k === 'shake') return 'shake';
      if (k === 'stretch' || k === 'bow') return 'stretch';
      if (k === 'nuzzle') return 'cuddle';
      if (k === 'greet' || k === 'look') return 'greet';
      if (k === 'leap') return 'leap';
      if (k === 'sniff' || k === 'dig') return 'sniff';
      if (k === 'peek' || k === 'survey') return 'watch';
      return 'play';
    }
    if (this.anim === 'Eat') return this.drinkAt ? 'drink' : 'eat';
    if (this.state === 'poop' || this.state === 'pee') return 'poop';
    if (this.state === 'walk') return this.sink ? 'swim' : this.fast ? 'run' : 'walk';
    if (this.anim === 'Sit') return 'sit';
    if (this.anim === 'Lie') return 'lie';
    if (this.anim === 'Play') return 'play';
    if (this.anim === 'Happy') return 'happy';
    if (this.anim === 'Sad') return 'sad';
    return this.sink ? 'swim' : 'stand';
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
    this.perched = false;
    this.dash = null;
    this.drugged = false;
    this.drop();
  }

  /** Vergeet waar het dier mee bezig was of naartoe wilde. */
  private drop(): void {
    this.pal = null;
    this.chasing = false;
    this.rush = false;
    this.eatAt = null;
    this.napFor = 0;
    this.napBed = null;
    this.napClip = 'Sleep';
    this.goal = null;
    this.encore = null;
    this.drinkAt = null;
    this.mud = false;
    this.faceTo = null;
  }

  /** Is het dier ergens mee bezig dat eerst af moet? */
  private get busy(): boolean {
    return !!this.trick || this.state === 'eat' || this.state === 'poop' || this.state === 'pee' || !!this.eatAt || !!this.playAt || !!this.pal || this.napFor > 0 || !!this.goal || !!this.drinkAt || this.drugged;
  }

  /** Slaapt een poosje, wat er ook gebeurt. */
  sedate(seconds: number): void {
    this.stop();
    this.drugged = true;
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
    this.nx = this.ny = 0;
    this.snap = true;
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
      health: !this.sick, enclosure: !!region && !this.needsFence && !this.fenceBroken, food: this.hunger < HUNGRY, bed: false, terrain: false, friend: false, clean: false, space: true, fun: true, climate: true, wild: true,
    };
    if (region && this.tameIn(w, region.id)) {
      // in de kinderboerderij wonen de boerderijdieren door elkaar: een stukje eigen grond, een slaapplek en wat gezelschap is genoeg
      const own = TERRAINS.indexOf(info.terrain);
      this.mainOk = region.tiles.filter(i => w.grid.terrain[i] === own).length >= MIX_TILES;
      this.lacking = [];
      this.missing = this.mainOk ? null : info.terrain;
      this.mixOnly = false;
      result.terrain = this.mainOk;
      this.lonely = Math.max(0, 2 - w.animals.filter(a => w.grid.regionOf[a.tile] === region.id).length);
      result.friend = this.lonely === 0;
      result.clean = w.poopsIn(region.id) <= MAX_POOPS_CLEAN;
      result.bed = w.beds.some(b => w.grid.regionOf[tileIndex(b.x, b.y)] === region.id);
      const fav = TOY_OF[this.species];
      result.fun = !fav || !w.wantsFun() || w.toys.some(t => likesToy(this.species, t.kind) && w.grid.regionOf[tileIndex(t.x, t.y)] === region.id);
    } else if (region) {
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
      // groepsdieren willen met meer bij elkaar zijn (een vriendje van een andere soort telt mee); grote dieren willen een groot verblijf
      const friends = palsOf(this.species);
      this.lonely = Math.max(0, herdOf(this.species) - w.animals.filter(a => (a.species === this.species || friends.includes(a.species)) && w.grid.regionOf[a.tile] === region.id).length);
      result.friend = this.lonely === 0;
      result.space = region.tiles.length >= (SPACE[this.species] ?? 0);
      result.clean = w.poopsIn(region.id) <= MAX_POOPS_CLEAN;
      result.bed = w.beds.some(b => b.kind === info.bed && w.grid.regionOf[tileIndex(b.x, b.y)] === region.id);
      const fav = TOY_OF[this.species];
      result.fun = !fav || !w.wantsFun() || w.toys.some(t => likesToy(this.species, t.kind) && w.grid.regionOf[tileIndex(t.x, t.y)] === region.id);
    }
    if (region) {
      // warmte of kou: een lamp of een blok ijs in het verblijf
      const need = CLIMATE[this.species];
      result.climate = !need || !w.wantsClimate() || w.toys.some(t => t.kind === need && w.grid.regionOf[tileIndex(t.x, t.y)] === region.id);
    }
    // bomen, planten en stenen: van elk niet te weinig en niet te veel (in de kinderboerderij hoeft het niet)
    this.wildAsk = null;
    if (region && w.wantsWild() && !this.tameIn(w, region.id)) {
      const have = w.wildIn(region), want = wildRange(this.species, have.land);
      // een verblijf met alleen water: daar kan niets staan, dus daar vraagt geen dier erom
      if (want && have.land) {
        for (const kind of WILD_KINDS) {
          if (this.wildAsk) break;
          const group: PropGroup = kind === 'stone' ? 'stone' : 'green', [min, max] = want[kind];
          if (have[kind] < min) this.wildAsk = { kind, group, more: true, by: min - have[kind] };
          else if (have[kind] > max) this.wildAsk = { kind, group, more: false, by: have[kind] - max };
        }
        result.wild = !this.wildAsk;
      }
    }
    this.unmet = WISH_ORDER.find(k => !result[k]) ?? null;
    this.happy = this.unmet === null;
    return result;
  }

  /** Een boerderijdier in een kinderboerderij: extra tam, en tevreden met minder. */
  private tameIn(w: AnimalWorld, regionId: number): boolean {
    return PETTABLE.includes(this.species) && w.pettingPen(regionId);
  }

  /** Doet dit dier iets met dit ding? Een zeedier niet met dingen voor op het land. */
  private uses(toy: Toy): boolean {
    return !this.aquatic || !LAND_TOYS.includes(toy.kind);
  }

  /** De tegels vanwaar het dier met dit ding speelt: ernaast, erbovenop (heuvel, rotsen, klimrek) of voor de ingang (tunnel). */
  private toySpots(w: AnimalWorld, toy: Toy, regionId: number, blocked: (i: number) => boolean): number[] {
    const ti = tileIndex(toy.x, toy.y);
    if (TOY_LIFT[toy.kind as ToyKind] !== undefined) return w.grid.regionOf[ti] === regionId && !this.dry(w, ti) ? [ti] : [];
    const near = w.grid.neighbors(ti).filter(i => !blocked(i) && w.grid.regionOf[i] === regionId);
    // de tunnel ligt langs x; onder de kruipboog door en op de bandenschommel gaat het juist dwars daarop (langs z)
    const along = toy.kind === 'tunnel' ? 1 : toy.kind === 'logarch' || toy.kind === 'tyreswing' ? 0 : -1;
    if (along < 0) return near;
    const down = (toy.rot ?? 0) % 2 === along;
    const inLine = near.filter(i => (down ? tileXY(i)[0] === toy.x : tileXY(i)[1] === toy.y));
    // op de schommel springen kan desnoods ook van opzij
    return inLine.length || toy.kind !== 'tyreswing' ? inLine : near;
  }

  /** Naar dit ding toe lopen (of rennen) om ermee te spelen. Lukt dat? */
  private goPlay(w: AnimalWorld, toy: Toy, regionId: number, blocked: (i: number) => boolean, run: boolean): boolean {
    const spots = this.toySpots(w, toy, regionId, blocked);
    let best: number[] | null = null;
    if (run) {
      // wie geroepen wordt, neemt de kortste weg
      for (const i of spots) {
        const route = w.grid.path(this.tile, i, blocked);
        if (route && (!best || route.length < best.length)) best = route;
      }
    } else if (spots.length) best = w.grid.path(this.tile, spots[Math.floor(Math.random() * spots.length)], blocked);
    if (!best) return false;
    this.drop();
    this.playAt = toy;
    if (best.length > 1) {
      this.startWalk(best);
      if (run) {
        this.fast = true;
        this.play('Run', this.young ? 2 : 1.5);
      }
    } else this.startPlay(w);
    return true;
  }

  /**
   * Spelen met speelgoed dat zelf beweegt: wippen op de wipplank, de klimpaal op, schommelen op de band (of hem een
   * duw geven), stootjes tegen de slingerbal en onder de kruipboog door. Geeft terug of dit zulk speelgoed is.
   */
  private playMoving(w: AnimalWorld, toy: Toy): boolean {
    const kind = toy.kind as ToyKind, cx = toy.x + 0.5, cy = toy.y + 0.5, base = ((toy.rot ?? 0) * Math.PI) / 2;
    const tall = this.info.height * MODEL_SCALE, long = this.info.length * MODEL_SCALE;
    // langs deze lijn van het ding kijken: heen of terug, wat het dichtst bij is
    const facing = (line: number): number => (Math.cos(this.heading - line) >= 0 ? line : line + Math.PI);
    if (kind === 'rocker') {
      // de wipplank: erop gaan staan, in de lengte van de plank, en heen en weer wippen
      this.gx = cx;
      this.gy = cy;
      this.lift = TOY_LIFT.rocker ?? 0;
      this.heading = facing(base + Math.PI / 2);
      w.playWith(toy, ROCK_SECONDS, this.heading);
      this.doTrick('rock', ROCK_SECONDS, 'Idle');
      this.perched = true;
      return true;
    }
    if (kind === 'pole') {
      // de klimpaal: omhoog klimmen en boven op de vlonder rondkijken
      this.gx = cx;
      this.gy = cy;
      w.playWith(toy, CLIMB_SECONDS + 2.5);
      this.doTrick('climb', CLIMB_SECONDS, 'Walk');
      this.encore = Math.random() < 0.6 ? 'survey' : 'peek';
      this.perched = true;
      return true;
    }
    if (kind !== 'tyreswing' && kind !== 'tetherball' && kind !== 'logarch') return false;
    const to = Math.atan2(cx - this.gx, cy - this.gy);
    this.heading = to;
    if (kind === 'tetherball') {
      // de slingerbal: een stootje, kijken hoe de bal om de paal draait, en nog een keer
      this.punch(w, toy, TETHER, 0.56, 0.26, 0);
      return true;
    }
    // de schommel en de boog hebben een richting (langs z): staat het dier er recht voor of recht achter?
    const inLine = Math.abs(Math.cos(to - base)) > 0.8, face = facing(base);
    if (kind === 'tyreswing') {
      if (tall <= 0.9 && long <= 1) {
        // klein genoeg: met een sprongetje op de band, en schommelen
        this.heading = face;
        this.dash = { fx: this.gx, fy: this.gy, tx: cx, ty: cy, seconds: SWING.hop };
        this.lift = SWING.seat;
        w.playWith(toy, SWING_SECONDS, face);
        this.doTrick('swing', SWING_SECONDS, 'Sit');
        this.perched = true;
      } else if (inLine) {
        // te groot om erop te zitten: de band een paar duwtjes geven
        this.heading = face;
        this.punch(w, toy, PUSH, 0.42, 0.14, 3);
      } else {
        w.playWith(toy, 2.5, undefined, -1);
        this.show('sniff');
      }
      return true;
    }
    // de kruipboog: eronderdoor naar de tegel aan de andere kant; wie te hoog is of er niet door kan, snuffelt alleen aan de slierten
    const dx = Math.round(Math.sin(face)), dy = Math.round(Math.cos(face)), far = tileIndex(toy.x + dx, toy.y + dy);
    if (!inLine || tall > 1.33 || !w.grid.canStep(toy.x, toy.y, dx, dy) || w.grid.regionOf[far] !== w.grid.regionOf[this.tile] || isTroughTile(w, far) || this.dry(w, far)) {
      w.playWith(toy, 2.5, undefined, -1);
      this.show('sniff');
      return true;
    }
    this.heading = face;
    this.dash = { fx: this.gx, fy: this.gy, tx: cx + dx, ty: cy + dy, seconds: UNDER.seconds, down: dx === 0 };
    w.playWith(toy, UNDER.seconds + 2.5, face);
    this.doTrick('under', UNDER.seconds, 'Walk');
    return true;
  }

  /**
   * Naast iets wat hangt gaan staan en er een paar keer met de neus tegenaan stoten. `gap`: zo ver blijft de neus van
   * het midden van het ding, `lunge`: zo ver haalt het dier uit, `after`: zo lang zwaait het ding daarna nog uit.
   */
  private punch(w: AnimalWorld, toy: Toy, beat: Beat, gap: number, lunge: number, after: number): void {
    const dist = Math.hypot(toy.x + 0.5 - this.gx, toy.y + 0.5 - this.gy), front = (this.info.length - this.info.back) * MODEL_SCALE;
    const seconds = beat.first + beat.every * beat.hits;
    this.hit = { first: beat.first, every: beat.every, hits: beat.hits, seconds, back: clamp(dist - front - gap, -0.4, 0.4), lunge };
    w.playWith(toy, seconds + after, this.heading, 1);
    this.doTrick('punch', seconds, 'Play');
  }

  /** Bij het speelgoed aangekomen: ernaar kijken en spelen; het ding beweegt mee. */
  private startPlay(w: AnimalWorld): void {
    const toy = this.playAt;
    this.playAt = null;
    if (!toy) return;
    const kind = toy.kind as ToyKind, cx = toy.x + 0.5, cy = toy.y + 0.5;
    if (this.playMoving(w, toy)) return;
    const up = TOY_LIFT[kind];
    if (up !== undefined) {
      // boven op de heuvel, de rotsen of het klimrek: rondkijken, zich lang maken of even zitten
      this.gx = cx;
      this.gy = cy;
      this.lift = up;
      const p = Math.random();
      if (p < 0.45) this.show('survey');
      else if (p < 0.7) this.show('peek');
      else this.rest('Sit', 4 + Math.random() * 3);
      this.perched = true;
      return;
    }
    this.heading = Math.atan2(cx - this.gx, cy - this.gy);
    if (kind === 'tunnel') {
      // de tunnel ligt van links naar rechts, of gedraaid van boven naar beneden; een groot dier past er niet in en snuffelt er alleen aan
      const down = (toy.rot ?? 0) % 2 === 1;
      const side = down
        ? Math.floor(this.gx) !== toy.x ? 0 : Math.sign(toy.y - Math.floor(this.gy))
        : Math.floor(this.gy) !== toy.y ? 0 : Math.sign(toy.x - Math.floor(this.gx));
      if (!side || this.info.height * MODEL_SCALE > 0.8 || this.info.length * MODEL_SCALE > 1.3) return this.show('sniff');
      const dx = down ? 0 : side, dy = down ? side : 0;
      this.heading = Math.atan2(dx, dy);
      const far = tileIndex(toy.x + dx, toy.y + dy);
      const free = w.grid.canStep(toy.x, toy.y, dx, dy) && w.grid.regionOf[far] === w.grid.regionOf[this.tile] && !isTroughTile(w, far) && !this.dry(w, far);
      w.playWith(toy, 2);
      if (!free) return this.doTrick('peekin', 2.2, 'Walk');
      this.dash = { fx: this.gx, fy: this.gy, tx: cx + dx, ty: cy + dy, seconds: 2, down };
      return this.doTrick('tunnel', 2, 'Run');
    }
    if (TOY_DRINK.includes(kind)) {
      // drinken uit de vijver of onder de waterval; van de waterval wordt het dier nat en schudt het zich droog
      w.splash(cx, cy);
      w.playWith(toy, 3);
      this.trick = null;
      this.state = 'emote';
      this.timeLeft = 3 + Math.random();
      this.route = [];
      this.play('Eat');
      this.drinkAt = toy;
      if (kind === 'fall') this.encore = 'shake';
      return;
    }
    if (kind === 'lamp' || kind === 'icebox') {
      // lekker bij de warmte of de kou gaan liggen
      if (CLIMATE[this.species] === kind) w.heart(this.gx, this.gy, this.top);
      return this.rest('Lie', 7 + Math.random() * 4);
    }
    if (toy.kind === 'hoop') {
      // de hoepel: erdoorheen springen naar de tegel aan de andere kant (als die vrij is)
      const tx = toy.x + 0.5 + (toy.x + 0.5 - this.gx), ty = toy.y + 0.5 + (toy.y + 0.5 - this.gy);
      const far = tileIndex(Math.floor(tx), Math.floor(ty));
      const free = w.grid.inBounds(Math.floor(tx), Math.floor(ty)) && w.grid.regionOf[far] === w.grid.regionOf[this.tile] && !isTroughTile(w, far) && !this.dry(w, far);
      this.leap = { fx: this.gx, fy: this.gy, tx: free ? tx : this.gx, ty: free ? ty : this.gy, top: 1.25 - this.top * 0.5, seconds: 1.5 };
      w.playWith(toy, 1.7, this.heading);
      w.splash(this.gx, this.gy);
      return this.doTrick('leap', 1.5, 'Play');
    }
    if (toy.loose?.length) {
      // een bal of een stam ligt los: het dier duwt er met zijn neus tegen, het ding rolt weg en het dier gaat erachteraan
      const log = !!toy.loose[0].line;
      w.playWith(toy, 3);
      this.fetch = { toy, i: 0, kicks: log ? 3 : 4 + Math.floor(Math.random() * 2), wait: 0.25, bump: 0, stuck: 0 };
      return this.doTrick('fetch', log ? 10 : 14, 'Play');
    }
    const seconds = 4 + Math.random() * 2;
    w.playWith(toy, seconds);
    this.emote('Play', seconds);
  }

  /** Mag het dier hier los lopen (niet van tegel naar tegel)? In het eigen verblijf, niet waar een voerbak, boom of rots staat, en een zeedier alleen in het water. */
  private roomAt(w: AnimalWorld, x: number, y: number, regionId: number): boolean {
    if (!w.grid.inBounds(x, y)) return false;
    const i = tileIndex(x, y);
    if (w.grid.regionOf[i] !== regionId || w.solidAt(i) || this.dry(w, i)) return false;
    for (const t of w.troughs) if (t.x === x && t.y === y) return false;
    return true;
  }

  /**
   * Een los stapje, recht op het doel af. Eerst opzij en dan vooruit: zo schuift het dier langs een hek of een bak
   * in plaats van erdoorheen te gaan. Geeft terug of het dier echt opschoot.
   */
  private stepFree(w: AnimalWorld, mx: number, my: number): boolean {
    const x = Math.floor(this.gx), y = Math.floor(this.gy), regionId = w.grid.regionOf[tileIndex(x, y)];
    let gain = 0;
    // een klein stukje van de rand af blijven, zodat het dier niet met zijn neus in het hek staat
    const nx = Math.floor(this.gx + mx + Math.sign(mx) * 0.2);
    if (mx && (nx === x || (w.grid.canStep(x, y, nx - x, 0) && this.roomAt(w, nx, y, regionId)))) {
      this.gx += mx;
      gain += Math.abs(mx);
    }
    const cx = Math.floor(this.gx), ny = Math.floor(this.gy + my + Math.sign(my) * 0.2);
    if (my && (ny === y || (w.grid.canStep(cx, y, 0, ny - y) && this.roomAt(w, cx, ny, regionId)))) {
      this.gy += my;
      gain += Math.abs(my);
    }
    return gain > 0.3 * (Math.abs(mx) + Math.abs(my));
  }

  /**
   * Spelen met een bal of een stam: ernaartoe rennen, een duwtje geven met de neus, kijken hoe het ding wegrolt,
   * en er weer achteraan. Bij twee ballen is daarna de andere aan de beurt.
   */
  private chase(dt: number, w: AnimalWorld): void {
    const f = this.fetch!, p = f.toy.loose?.[f.i];
    if (!p) {
      this.timeLeft = 0;
      return;
    }
    f.wait -= dt;
    f.bump = Math.max(0, f.bump - dt);
    const dx = f.toy.x + 0.5 + p.ox - this.gx, dy = f.toy.y + 0.5 + p.oy - this.gy, dist = Math.hypot(dx, dy);
    if (dist > 0.05) this.turnTo(Math.atan2(dx, dy), dt);
    // even kijken hoe het rolt (een stam komt vanzelf weer terug)
    if (f.wait > 0 || !f.kicks) return this.play('Play');
    const reach = clamp((this.info.length - this.info.back) * MODEL_SCALE, 0.2, 0.6) + p.r + 0.05;
    if (dist <= reach) {
      if (!w.nudgeToy(f.toy, f.i, this.gx, this.gy)) {
        this.timeLeft = 0;
        return;
      }
      f.kicks--;
      f.bump = 0.3;
      f.wait = p.line ? 1.9 : 0.5;
      f.stuck = 0;
      f.i = (f.i + 1) % f.toy.loose!.length;
      // na het laatste duwtje kijkt het dier het ding nog even na
      if (!f.kicks) this.timeLeft = Math.min(this.timeLeft, 1.6);
      return;
    }
    const speed = (this.young ? 0.72 : 0.92) * MODEL_SCALE * 2.3 * PACE[this.nature];
    const step = Math.min(speed * dt, 0.3, dist - reach * 0.9);
    if (this.stepFree(w, (dx / dist) * step, (dy / dist) * step)) {
      f.stuck = 0;
      this.play('Run', this.young ? 2 : 1.5);
    } else {
      // het ding ligt waar het dier niet bij kan: even wachten, en dan is het spelen voorbij
      f.stuck += dt;
      this.play('Play');
      if (f.stuck > 1.5) this.timeLeft = 0;
    }
  }

  /** Een zeedier kan niet over het droge: die tegels telt het als versperd. */
  private dry(w: AnimalWorld, tile: number): boolean {
    return this.aquatic && w.grid.terrain[tile] !== WATER_TILE;
  }

  /** Iemand tikt op het speelgoed: het dier komt eraan en gaat ermee spelen. Lukt dat (is er een weg)? */
  comePlay(w: AnimalWorld, toy: Toy): boolean {
    if (this.sick || this.escaped || this.trick || this.anim === 'Sleep' || !this.uses(toy)) return false;
    const blocked = (i: number): boolean => isTroughTile(w, i) || this.dry(w, i);
    return this.goPlay(w, toy, w.grid.regionOf[this.tile], blocked, true);
  }

  /** Het eigen verblijf, als het dier nu iets nieuws kan gaan doen (niet bezig, ziek, ontsnapt of in slaap). */
  private freePen(w: AnimalWorld): { id: number; tiles: number[] } | null {
    if (this.sick || this.escaped || this.sleeping || this.busy) return null;
    const [x, y] = tileXY(this.tile);
    return w.grid.enclosureAt(x, y);
  }

  /** Loopt naar dit punt in het eigen verblijf en rolt daar (in een regenplas). Lukt dat? */
  rollAt(w: AnimalWorld, gx: number, gy: number): boolean {
    const region = this.aquatic ? null : this.freePen(w);
    return !!region && this.goRoll(w, region.id, gx, gy, i => isTroughTile(w, i));
  }

  private goRoll(w: AnimalWorld, regionId: number, gx: number, gy: number, blocked: (i: number) => boolean): boolean {
    const x = Math.floor(gx), y = Math.floor(gy);
    if (!w.grid.inBounds(x, y) || w.grid.regionOf[tileIndex(x, y)] !== regionId) return false;
    const route = w.grid.path(this.tile, tileIndex(x, y), blocked);
    if (!route) return false;
    this.drop();
    this.startWalk(route);
    this.goal = 'roll';
    this.spotX = gx;
    this.spotY = gy;
    return true;
  }

  /**
   * Loopt naar de tegel in het eigen verblijf die het dichtst bij dit punt ligt (een gast bij het hek, of in de
   * kinderboerderij), draait ernaartoe en begroet de gast. Lukt dat?
   */
  comeTo(w: AnimalWorld, gx: number, gy: number): boolean {
    const region = this.aquatic ? null : this.freePen(w);
    return !!region && this.goNear(w, region.tiles, gx, gy, i => isTroughTile(w, i));
  }

  private goNear(w: AnimalWorld, tiles: number[], gx: number, gy: number, blocked: (i: number) => boolean): boolean {
    // niet boven op de gast gaan staan (in de kinderboerderij loopt die in het verblijf)
    const at = tileIndex(Math.floor(gx), Math.floor(gy));
    let best = -1, bestD = Infinity;
    for (const i of tiles) {
      if (i === at || blocked(i)) continue;
      const [x, y] = tileXY(i);
      const d = Math.hypot(x + 0.5 - gx, y + 0.5 - gy);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    const route = best < 0 ? null : w.grid.path(this.tile, best, blocked);
    if (!route) return false;
    this.drop();
    this.startWalk(route);
    this.goal = 'come';
    this.spotX = gx;
    this.spotY = gy;
    return true;
  }

  /** Een verlegen dier loopt weg van een gast: naar een tegel die een stuk verder van hem af ligt. */
  private shyAway(w: AnimalWorld, tiles: number[], gx: number, gy: number, blocked: (i: number) => boolean): boolean {
    let best = -1, bestD = Math.hypot(gx - this.gx, gy - this.gy) + 0.8;
    for (let n = 0; n < 6; n++) {
      const i = tiles[Math.floor(Math.random() * tiles.length)];
      if (blocked(i)) continue;
      const [x, y] = tileXY(i);
      const d = Math.hypot(x + 0.5 - gx, y + 0.5 - gy);
      if (d > bestD) {
        bestD = d;
        best = i;
      }
    }
    const route = best < 0 ? null : w.grid.path(this.tile, best, blocked);
    if (!route || route.length < 2) return false;
    this.startWalk(route);
    return true;
  }

  /** Tikkertje: een ander dier heeft dit dier getikt, en het rent weg. Lukt dat (heeft het dier niets anders te doen)? */
  private flee(w: AnimalWorld, gx: number, gy: number): boolean {
    const calm = this.state === 'idle' || this.state === 'walk' || (this.state === 'rest' && this.anim === 'Sit') || this.state === 'emote';
    const region = calm ? this.freePen(w) : null;
    if (!region) return false;
    const blocked = (i: number): boolean => isTroughTile(w, i) || this.dry(w, i);
    const far = region.tiles.filter(i => !blocked(i) && Math.hypot(tileXY(i)[0] + 0.5 - gx, tileXY(i)[1] + 0.5 - gy) > 2);
    const route = far.length ? w.grid.path(this.tile, far[Math.floor(Math.random() * far.length)], blocked) : null;
    if (!route || route.length < 2) return false;
    this.startWalk(route);
    this.fast = true;
    this.play('Run', this.young ? 2 : 1.5);
    return true;
  }

  /**
   * De zon komt op: het dier slaapt nog zoveel seconden door en wordt dan wakker met een flinke rek. Zo worden
   * de dieren een voor een wakker.
   */
  dawn(delay: number): void {
    if (this.sick || this.escaped || this.drugged || this.state !== 'rest') return;
    this.timeLeft = Math.max(0.1, delay);
    this.encore = 'stretch';
  }

  private choose(w: AnimalWorld): void {
    const encore = this.encore, wasUp = this.perched;
    this.trick = null;
    this.fast = false;
    this.perched = false;
    this.drugged = false;
    // het dier blijft boven op zijn slaapplek staan tot het wegloopt
    this.drop();
    const [x, y] = tileXY(this.tile);
    const region = w.grid.enclosureAt(x, y);
    const nature = this.nature;
    if (this.sick) return this.rest(Math.random() < 0.5 ? 'Lie' : 'Sad', 4);
    if (encore && region) {
      // het kunstje dat nog moest komen: uitrekken na de nacht, een sprong na het eten, droogschudden na de waterval
      if (encore === 'shake') w.splash(this.gx, this.gy);
      this.show(encore);
      this.perched = wasUp;
      return;
    }
    // 's nachts liggen de meeste dieren te slapen (wie honger heeft, gaat eerst eten)
    if (w.isNight() && this.hunger < HUNGRY && Math.random() < (nature === 'sleepy' ? 0.85 : 0.65)) return this.rest('Lie', 5 + Math.random() * 4);
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
    const isTrough = (i: number): boolean => w.troughs.some(t => tileIndex(t.x, t.y) === i) || this.dry(w, i);
    const tame = this.tameIn(w, region.id);
    if (wasUp) {
      // eerst van de heuvel, de rotsen of het klimrek af
      const down = w.grid.neighbors(this.tile).filter(i => !isTrough(i) && w.grid.regionOf[i] === region.id);
      if (down.length) return this.startWalk([this.tile, down[Math.floor(Math.random() * down.length)]]);
      this.lift = 0;
    }
    if (this.hunger > SEEK_FOOD) {
      const food = SPECIES[this.species].food;
      for (const trough of w.troughs) {
        // in de kinderboerderij eet een dier uit elke bak waar iets in zit
        if ((trough.food !== food && !tame) || trough.amount <= 0) continue;
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
    if (w.raining() && !this.aquatic) {
      if (MUD_LOVERS.includes(this.species)) {
        // regen is feest: in een plas gaan rollen
        const pools = w.rainPuddles.filter(p => w.grid.inBounds(Math.floor(p.gx), Math.floor(p.gy)) && w.grid.regionOf[tileIndex(Math.floor(p.gx), Math.floor(p.gy))] === region.id);
        const pool = pools[Math.floor(Math.random() * pools.length)];
        if (pool && Math.random() < 0.5 && this.goRoll(w, region.id, pool.gx, pool.gy, isTrough)) return;
      } else if (SPECIES[this.species].terrain !== 'water' && Math.random() < 0.75) {
        // schuilen: bij de slaapplek gaan zitten of liggen tot het droog is
        const beds = w.beds.filter(b => w.grid.regionOf[tileIndex(b.x, b.y)] === region.id);
        const mine = beds.filter(b => b.kind === SPECIES[this.species].bed);
        const bed = (mine.length ? mine : beds)[Math.floor(Math.random() * (mine.length || beds.length))];
        const route = bed ? w.grid.path(this.tile, tileIndex(bed.x, bed.y), isTrough) : null;
        const clip = Math.random() < 0.5 ? 'Sit' : 'Lie';
        if (!route || (route.length === 1 && this.lift)) return this.rest(clip, 4 + Math.random() * 3);
        this.napFor = 6 + Math.random() * 5;
        this.napBed = bed;
        this.napClip = clip;
        return this.startWalk(route);
      }
    }
    // een speels dier doet van alles twee keer zo vaak, een slaperig dier wat minder
    const lively = nature === 'playful' ? 2 : nature === 'sleepy' ? 0.7 : 1;
    // een blij dier loopt graag naar zijn speelgoed, de heuvel of de drinkvijver en doet er iets mee; het liefst met zijn eigen ding
    if (this.happy && Math.random() < 0.22 * lively) {
      const here = w.toys.filter(t => w.grid.regionOf[tileIndex(t.x, t.y)] === region.id && this.uses(t));
      const mine = here.filter(t => likesToy(this.species, t.kind) || t.kind === CLIMATE[this.species]);
      const pool = mine.length && Math.random() < 0.7 ? mine : here;
      const toy = pool[Math.floor(Math.random() * pool.length)];
      if (toy && this.goPlay(w, toy, region.id, isTrough, false)) return;
    }
    // een gast in de buurt: een tam of dapper dier loopt ernaartoe, een verlegen dier loopt juist weg
    const guest = w.guestNear(this.gx, this.gy);
    if (guest) {
      const p = Math.random();
      if (tame ? p < 0.35 : nature === 'brave' && this.happy && p < 0.3) {
        if (this.goNear(w, region.tiles, guest[0], guest[1], isTrough)) return;
      } else if (nature === 'shy' && !tame && p < 0.45 && this.shyAway(w, region.tiles, guest[0], guest[1], isTrough)) return;
    }
    // een blij dier doet af en toe iets geks: springen, draaien, rollen, graven, buigen, rennen, tikkertje, kroelen, een gast begroeten
    if (this.happy && Math.random() < 0.3 * lively) {
      if (guest && Math.random() < (tame ? 0.6 : 0.4)) {
        // een verlegen dier begroet niemand: het kijkt alleen
        if (nature === 'shy' || Math.random() < 0.3) this.doTrick('look', 2.6, 'Idle');
        else this.doTrick('greet', 1.6, 'Happy');
        return this.face(guest[0], guest[1]);
      }
      if (nature === 'sleepy' && Math.random() < 0.45) return this.show('stretch'); // gapen
      const p = nature === 'playful' && Math.random() < 0.3 ? 0.7 : Math.random();
      if (p < 0.09) return this.show('hop');
      if (p < 0.15) return this.show('spin');
      if (p < 0.22) return this.show('roll');
      if (p < 0.27) return this.show('wiggle');
      if (p < 0.33) return this.show('stretch');
      if (p < 0.4) return this.show('sniff');
      if (p < 0.45) return this.show('dig');
      if (p < 0.5) return this.show('bow');
      if (p < 0.56) return this.show('jumpturn');
      if (p < 0.61) return this.show('sway');
      if (p < 0.67) return this.show('peek');
      if (p < 0.76) {
        // rennen: een sprintje naar de andere kant van het verblijf
        const far = region.tiles.filter(i => !isTrough(i) && Math.hypot(tileXY(i)[0] + 0.5 - this.gx, tileXY(i)[1] + 0.5 - this.gy) > 1.6);
        const goal = far[Math.floor(Math.random() * far.length)];
        const route = goal === undefined ? null : w.grid.path(this.tile, goal, isTrough);
        if (route && route.length > 1) {
          this.startWalk(route);
          this.fast = true;
          return this.play('Run', this.young ? 2 : 1.5);
        }
      } else if (p < 0.83) {
        // dolle bui: twee keer heel hard heen en weer
        const near = region.tiles.filter(i => {
          const d = Math.hypot(tileXY(i)[0] + 0.5 - this.gx, tileXY(i)[1] + 0.5 - this.gy);
          return !isTrough(i) && d > 1.4 && d < 3.3;
        });
        const route = near.length ? w.grid.path(this.tile, near[Math.floor(Math.random() * near.length)], isTrough) : null;
        if (route && route.length > 1 && route.length < 6) {
          const back = route.slice(0, -1).reverse();
          this.startWalk(route.concat(back, route.slice(1), back));
          this.fast = this.rush = true;
          return this.play('Run', this.young ? 2.4 : 1.9);
        }
      } else {
        // kroelen of tikkertje: naar een vriendje (ook van een bevriende soort) of naar mama lopen
        const friends = palsOf(this.species);
        const pals = w.animals.filter(a => a !== this && (a.species === this.species || friends.includes(a.species)) && w.grid.regionOf[a.tile] === region.id && !a.sick && !a.escaped);
        const pal = (this.young && pals.find(a => a.variant === 'female')) || pals[Math.floor(Math.random() * pals.length)];
        const spots = pal ? [pal.tile, ...w.grid.neighbors(pal.tile)].filter(i => !isTrough(i)) : [];
        const spot = spots[Math.floor(Math.random() * spots.length)];
        const route = spot === undefined ? null : w.grid.path(this.tile, spot, isTrough);
        if (pal && route && route.length > 1) {
          this.startWalk(route);
          this.pal = pal;
          if (p < 0.9) {
            this.chasing = this.fast = true;
            this.play('Run', this.young ? 2 : 1.5);
          }
          return;
        }
      }
    }
    // een slaperig dier loopt minder en ligt meer; een verlegen dier zit wat vaker stil
    const pWalk = nature === 'sleepy' ? 0.32 : nature === 'shy' ? 0.48 : 0.55;
    const pSit = pWalk + (nature === 'shy' ? 0.18 : 0.11), pLie = pSit + (nature === 'sleepy' ? 0.2 : 0.1), pBed = pLie + (nature === 'sleepy' ? 0.25 : 0.12);
    const r = Math.random();
    if (r < pWalk) {
      const free = region.tiles.filter(i => !isTrough(i));
      const goal = free[Math.floor(Math.random() * free.length)];
      const route = goal === undefined ? null : w.grid.path(this.tile, goal, isTrough);
      if (route && route.length > 1) return this.startWalk(route);
    }
    if (r < pSit) return this.rest('Sit', 4 + Math.random() * 3);
    if (r < pLie) return this.rest('Lie', 5 + Math.random() * 3);
    if (r < pBed) {
      // naar de eigen slaapplek lopen en daar gaan slapen
      const mine = w.beds.filter(b => b.kind === SPECIES[this.species].bed && w.grid.regionOf[tileIndex(b.x, b.y)] === region.id);
      const bed = mine[Math.floor(Math.random() * mine.length)];
      const route = bed ? w.grid.path(this.tile, tileIndex(bed.x, bed.y), isTrough) : null;
      if (route) {
        this.napFor = 10 + Math.random() * 6;
        this.napBed = bed;
        return this.startWalk(route);
      }
      if (r < (pLie + pBed) / 2 && this.happy) return this.rest('Sleep', 8 + Math.random() * 4);
    }
    if (r < 0.92) return this.emote(this.happy ? 'Play' : 'Sad', 3);
    if (r < 0.96) {
      this.state = 'pee';
      this.timeLeft = 2.6;
      this.dropped = false;
      this.play('Pee');
      return;
    }
    // of even aan de grond snuffelen
    if (Math.random() < 0.5) return this.show('sniff');
    this.state = 'idle';
    this.timeLeft = 1.5 + Math.random() * 2.5;
    this.play('Idle');
  }

  private rest(name: string, seconds: number): void {
    this.trick = null;
    this.state = 'rest';
    // een slaperig dier blijft langer liggen
    this.timeLeft = seconds * (this.nature === 'sleepy' && name !== 'Sit' ? 1.5 : 1);
    this.play(name);
  }

  private startWalk(route: number[]): void {
    this.route = route.slice(1);
    this.lift = 0;
    this.perched = false;
    this.faceTo = null;
    this.drinkAt = null;
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

  /**
   * Een lang dier (orka, krokodil) loopt van tegel naar tegel, en dan steekt zijn kop of staart door het hek.
   * Daarom schuift het getekende dier zo ver naar binnen dat het hele lijf in het verblijf blijft.
   */
  private keepInside(dt: number, w: AnimalWorld): void {
    const x = Math.floor(this.gx), y = Math.floor(this.gy), kind = this.trick?.kind;
    let tx = 0, ty = 0;
    this.x0 = this.y0 = -Infinity;
    this.x1 = this.y1 = Infinity;
    if (!this.escaped && kind !== 'leap' && w.grid.enclosureAt(x, y)) {
      const front = (this.info.length - this.info.back) * MODEL_SCALE, back = this.info.back * MODEL_SCALE;
      const half = Math.min(front, back, 0.14 + this.info.height * MODEL_SCALE * 0.22);
      const s = Math.sin(this.heading), c = Math.cos(this.heading), as = Math.abs(s), ac = Math.abs(c);
      // hoe ver het lijf naar elke kant reikt; wie ronddraait heeft overal zijn hele lengte nodig
      const turning = kind === 'spin' || kind === 'dance' || kind === 'jumpturn' || kind === 'peek' || kind === 'survey';
      const all = Math.max(front, back);
      const east = turning ? all : (s > 0 ? front : back) * as + half * ac, west = turning ? all : (s > 0 ? back : front) * as + half * ac;
      const south = turning ? all : (c > 0 ? front : back) * ac + half * as, north = turning ? all : (c > 0 ? back : front) * ac + half * as;
      // hoeveel tegels vrij tot het hek (of de rand van het park), hooguit drie
      let w0 = 0, e0 = 0, n0 = 0, s0 = 0;
      while (w0 < 3 && w.grid.canStep(x - w0, y, -1, 0)) w0++;
      while (e0 < 3 && w.grid.canStep(x + e0, y, 1, 0)) e0++;
      while (n0 < 3 && w.grid.canStep(x, y - n0, 0, -1)) n0++;
      while (s0 < 3 && w.grid.canStep(x, y + s0, 0, 1)) s0++;
      this.x0 = x - w0 + west + FENCE_GAP;
      this.x1 = x + 1 + e0 - east - FENCE_GAP;
      this.y0 = y - n0 + north + FENCE_GAP;
      this.y1 = y + 1 + s0 - south - FENCE_GAP;
      // te smal voor het lijf: dan in het midden
      if (this.x0 > this.x1) this.x0 = this.x1 = (this.x0 + this.x1) / 2;
      if (this.y0 > this.y1) this.y0 = this.y1 = (this.y0 + this.y1) / 2;
      tx = clamp(this.gx, this.x0, this.x1) - this.gx;
      ty = clamp(this.gy, this.y0, this.y1) - this.gy;
    }
    const f = this.snap ? 1 : Math.min(1, dt * (this.fast ? 14 : 8));
    this.snap = false;
    this.nx += (tx - this.nx) * f;
    this.ny += (ty - this.ny) * f;
  }

  update(dt: number, w: AnimalWorld): void {
    this.model.mixer.update(dt);
    this.bob += dt;
    if (this.trick) this.trick.t += dt;
    if (this.leap && this.trick?.kind !== 'leap') {
      this.leap = null;
      w.splash(this.gx, this.gy);
    }
    if (this.dash && this.trick?.kind !== 'tunnel' && this.trick?.kind !== 'under' && this.trick?.kind !== 'swing') this.dash = null;
    if (this.hit && this.trick?.kind !== 'punch') this.hit = null;
    if (this.fetch && this.trick?.kind !== 'fetch') this.fetch = null;
    const swims = w.grid.terrain[this.tile] === WATER_TILE && !this.lift;
    // in een bak van glas staat het water hoger: daar zwemt het dier in het water, met de rug net boven
    this.sink = swims ? (w.inTank(this.tile) ? this.top * 0.62 - TANK_WATER : this.top * 0.34) : 0;
    if (swims) this.wet = true;
    // wie door het water loopt, spat af en toe
    if (swims && this.state === 'walk' && Math.random() < dt * 2.2) w.splash(this.gx, this.gy);
    this.hunger = Math.min(1, this.hunger + dt * HUNGER_PER_SEC * w.hungerRate() * (this.young ? 0.5 : 1));
    this.poopIn -= dt * w.poopRate();

    if (this.state === 'walk') {
      const next = this.route[0];
      // het laatste stukje naar de plas: precies naar die plek
      const toSpot = next === undefined && this.goal === 'roll' && Math.hypot(this.spotX - this.gx, this.spotY - this.gy) > 0.03;
      if (next === undefined && !toSpot) {
        this.fast = this.rush = false;
        if (this.wet && !swims) {
          // net uit het water: even droogschudden
          this.wet = false;
          w.splash(this.gx, this.gy);
          this.doTrick('shake', 0.9, 'Idle');
        } else if (this.goal === 'roll') {
          // in de plas: rollen, en dat spat
          this.goal = null;
          w.splash(this.gx, this.gy);
          w.heart(this.gx, this.gy, this.top);
          this.show('roll');
          this.mud = true;
        } else if (this.goal === 'come') {
          // bij de gast: ernaartoe draaien en hem begroeten (een verlegen dier snuffelt alleen)
          this.goal = null;
          if (this.nature === 'shy') this.show('sniff');
          else this.doTrick('greet', 1.8, 'Happy');
          this.face(this.spotX, this.spotY);
        } else if (this.pal) {
          const pal = this.pal, chasing = this.chasing;
          this.pal = null;
          this.chasing = false;
          if (Math.hypot(pal.gx - this.gx, pal.gy - this.gy) > 0.1) this.heading = Math.atan2(pal.gx - this.gx, pal.gy - this.gy);
          if (chasing && pal.flee(w, this.gx, this.gy)) {
            // tikkertje: getikt, en het vriendje rent weg
            this.show('hop');
          } else {
            // bij het vriendje: neus aan neus, met een hartje
            w.heart((this.gx + pal.gx) / 2, (this.gy + pal.gy) / 2, this.top);
            this.doTrick('nuzzle', 1.8, 'Happy');
          }
        } else if (this.playAt) {
          this.startPlay(w);
        } else if (this.napFor) {
          const seconds = this.napFor, clip = this.napClip;
          this.napFor = 0;
          this.napClip = 'Sleep';
          if (this.napBed) {
            // midden op de slaapplek gaan liggen, en erbovenop (wie schuilt, zit er net naast het midden)
            const spread = clip === 'Sleep' ? 0 : 0.9;
            this.gx = this.napBed.x + 0.5 + this.ox * spread;
            this.gy = this.napBed.y + 0.5 + this.oy * spread;
            this.lift = BED_LIFT[this.napBed.kind] ?? 0;
          }
          this.rest(clip, seconds);
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
        let dx = this.spotX - this.gx, dy = this.spotY - this.gy;
        if (next !== undefined) {
          const [tx, ty] = tileXY(next);
          dx = tx + 0.5 + this.ox - this.gx;
          dy = ty + 0.5 + this.oy - this.gy;
        }
        const dist = Math.hypot(dx, dy);
        const step = (this.young ? 0.72 : 0.92) * MODEL_SCALE * dt * (this.fast ? (this.rush ? 3 : 2.3) : 1) * PACE[this.nature];
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
      // spelen met een bal of een stam: erachteraan en een duwtje geven
      if (this.fetch) this.chase(dt, w);
      // rustig naar de gast toe draaien (kijken gaat langzamer dan begroeten)
      if (this.faceTo !== null) this.turnTo(this.faceTo, this.trick?.kind === 'look' ? dt * 0.35 : dt);
      if (this.drinkAt && Math.random() < dt * 1.3) w.splash(this.drinkAt.x + 0.5, this.drinkAt.y + 0.5);
      if (this.mud && this.trick?.kind === 'roll' && Math.random() < dt * 2.5) w.splash(this.gx, this.gy);
      if (this.state === 'eat' && this.eatAt) {
        this.turnTo(Math.atan2(this.eatAt.x + 0.5 - this.gx, this.eatAt.y + 0.5 - this.gy), dt);
        if (this.timeLeft <= 0) {
          this.hunger = 0;
          if (!this.young) w.ate(this.eatAt);
          this.eatAt = null;
        }
      }
      // lekker gegeten: een blij dier maakt daarna soms een sprong met een draai
      if (this.state === 'eat' && this.timeLeft <= 0 && this.happy && Math.random() < 0.5) this.encore = 'jumpturn';
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
    this.keepInside(dt, w);
    this.place();
  }
}
