// Het spel zelf: bouwen, verblijven, dieren, voeren, opruimen, gasten, winkels, munten, verzorgers,
// zieke en ontsnapte dieren, figuren, geluid, levels en opslaan.
import type * as THREE from 'three';
import { saveSet, t } from '@smj/shared';
import { Animal, type AnimalWorld, type Trough } from './animal';
import { ambience, animalSound, hasVoice, layer, music, playVoice, reshuffle, sfx } from './audio';
import {
  BEDS, COIN_CAP, FEATURE, FOODS, LEVELS, PLUSH, PRODUCTS, SHOP_SIZE, productsFor, slotsOf, LEVELS_PER_WORLD, LEVEL_BONUS, MAX_POOPS_CLEAN, PRICE, refund, SHOPS, SHOP_PRICE, SPECIES, START_COINS, TERRAINS,
  TERRAIN_INFO, WISH_ORDER, WORLDS, migrateLevel, unlockedSpecies, worldOf,
  type BedKind, type FenceNeed, type FoodId, type Goal, type Level, type ShopKind, type SpeciesId, type Terrain, type Variant,
  type WishId, type WorldId, TOYS, type ToyKind, HOUR_SECONDS, WAGE, TOY_OF, DECOR, DECORS, DECOR_GROUPS, type DecorKind, type DecorGroup, PLAY, FENCE_COLORS, TROUGH, TROUGHS, type TroughKind, SPACE, guestsAt, SERVES, } from './data';
import { Grid, H, W, edgeAlong, edgeKey, nearestEdge, tileIndex, tileXY, type Edge, type EdgeKind, type Region } from './grid';
import { Hud, type GoalView, type ToolDef, type ToolOption } from './hud';
import { cursor, icon, type IconId } from './icons';
import { emptyStats, goalProgress, levelDone, type Stats } from './levels';
import { CHEERS, NAMED, PRAISE, callText, goalLine, say, textOf, voiceId, wishLine, type Line } from './lines';
import { MODEL_SCALE, hasSpecies, loadSpecies, modelReady, spawnModel, spawnStatic, speciesIcon } from './models';
import { ENTRANCE, GuestManager, Vendor, Worker, edgePose, edgeSides, shopCenter, type Guest, type GuestSave, type GuestWorld, type KeeperPoop, type KeeperTrough, type ShopSpot, type WorkerRole, type WorkerWorld, type FixJob } from './people';
import { View, toWorldX, toWorldZ, type TroughMesh } from './view';

/** Wat je met de actieknop doet: poep vegen, een hek vasttimmeren of afval prikken. */
export type ActionId = 'broom' | 'hammer' | 'picker';
export type ToolId = 'hand' | 'action' | 'terrain' | 'fence' | 'trough' | 'bed' | 'toy' | 'shop' | 'decor' | 'animal' | 'staff' | 'erase';
type Verdict = 'good' | 'ok' | 'bad';
type Sex = 'male' | 'female';

/**
 * De balk in groepjes, van links naar rechts: doen (handje, actie, weghalen), grond (ondergrond en hek),
 * dieren (dier en wat in het verblijf hoort) en dierentuin (winkels, versiering, personeel).
 */
const TOOL_GROUPS: [string, ToolId[]][] = [
  ['do', ['hand', 'action', 'erase']],
  ['land', ['terrain', 'fence']],
  ['animal', ['animal', 'trough', 'bed', 'toy']],
  ['park', ['shop', 'decor', 'staff']],
];
/** Hoe snel een speeltoestel heen en weer gaat. */
const PLAY_SPEED: Partial<Record<ShopKind, number>> = { swing: 2.6, seesaw: 3, springer: 6, trampoline: 5 };
const PAINT_TOOLS = new Set<ToolId>(['terrain', 'fence', 'erase', 'action']);
/** Hek slepen (in tegels): na zoveel beweging ligt de richting vast, zoveel opzij is een hoek, en zo ver moet je een rand op zijn. */
const AXIS_AFTER = 0.3;
const TURN_AFTER = 0.75;
const EDGE_REACH = 0.35;
const TROUGH_ICON: Record<TroughKind, IconId> = { wood: 'trough_empty', big: 'trough_big', silo: 'trough_silo' };
const ROLE_ICON: Record<WorkerRole, IconId> = { feed: 'feed', clean: 'broom', fix: 'hammer' };
/** Verwaarlozing in seconden: eerst waarschuwen, daarna haalt de verzorger het dier op. */
const NEGLECT_WARN = 150;
const NEGLECT_GONE = 360;
/**
 * Rust: de figuren praten niet de hele tijd. Tussen twee meldingen uit zichzelf zit minstens ALERT_GAP
 * seconden, een wens moet al ALERT_AFTER seconden openstaan (iets wat kan wachten, zoals een slaapplek,
 * twee keer zo lang) en dezelfde melding komt pas na REPEAT_AFTER seconden terug.
 */
const ALERT_GAP = 60;
const ALERT_AFTER = 30;
const REPEAT_AFTER = 180;
const PEN_CLOSED_SECONDS = 45;
/** Zo lang moeten een jongen en een meisje samen blij zijn voor er een jong komt. */
const BIRTH_SECONDS = 50;
/** Om de zoveel seconden wordt er een dier ziek of ontsnapt er een; vaker als het level erom vraagt. */
const SICK_EVERY: [number, number] = [200, 320];
const SICK_FOR_GOAL: [number, number] = [35, 55];
const ESCAPE_EVERY: [number, number] = [280, 420];
const ESCAPE_FOR_GOAL: [number, number] = [45, 70];
const MAX_LITTER = 8;
/** Zoveel stuks afval kun je tegelijk in je handen hebben. */
const MAX_CARRY = 5;
const SEX_COLOR: Record<Sex, number> = { male: 0x4a90e2, female: 0xf06aa6 };
const FENCE_KIND: Record<string, EdgeKind> = { fence: 1, gate: 2, wall: 3, net: 4 };
const FENCE_SOUND = ['', 'fence', 'fence', 'stone', 'net'];
const NEED_ICON: Record<FenceNeed, IconId> = { wall: 'wall', net: 'net' };
const PATH = TERRAINS.indexOf('path');
const WATER = TERRAINS.indexOf('water');
/** In welke wereld hoort een soort thuis? Dat volgt uit het level waarin je hem krijgt. */
const HOME = Object.fromEntries(LEVELS.map((l, i) => [l.reward, worldOf(i)])) as Record<SpeciesId, WorldId>;
const between = ([lo, hi]: [number, number]): number => lo + Math.random() * (hi - lo);
/** Bij welke winkel hoort een wens van een gast? */
const NEED_KIND: Record<string, ShopKind> = {
  food: 'foodstall', drink: 'drinkstall', toilet: 'toilet', icecream: 'icecream', balloon: 'balloon', hat: 'hats', souvenir: 'souvenir', play: 'playground', sit: 'bench', look: 'fountain', ride: 'carousel',
};

/** Elke handeling heeft een eigen cursor, zodat je ziet wat een tik gaat doen. */
const CUR: Record<string, string> = {
  grab: 'grab',
  grabbing: 'grabbing',
  fence: cursor('fence'),
  gate: cursor('gate'),
  wall: cursor('wall'),
  net: cursor('net'),
  trough: cursor('trough_empty'),
  animal: cursor('paw'),
  erase: cursor('erase', 6, 24),
  broom: cursor('broom', 6, 26),
  pet: cursor('pet', 12, 10),
  feed: cursor('feed', 16, 8),
  menu: cursor('hand', 14, 5),
  move: cursor('move'),
  catch: cursor('catch', 20, 12),
  hammer: cursor('hammer', 8, 26),
  picker: cursor('picker', 5, 30),
  staff: cursor('keeper'),
};
for (const id of [...TERRAINS, ...BEDS, ...SHOPS, ...TOYS, ...DECORS]) CUR[id] = cursor(id);

export interface SaveData {
  /** 1 = het spel met veertien levels, 2 = vijftig levels. */
  v: 1 | 2 | 3;
  level: number;
  fed: number;
  cleaned: number;
  terrain: number[];
  h: number[];
  vv: number[];
  troughs: { x: number; y: number; food: FoodId | null; amount: number; kind?: TroughKind }[];
  animals: { species: SpeciesId; variant: Variant; gx: number; gy: number; hunger: number; name?: string; sick?: boolean; escaped?: boolean }[];
  poops: { gx: number; gy: number }[];
  /** `keeper`, `feeder` en `cleaner` komen uit oudere spellen, toen een werker bij één verblijf hoorde. */
  pens?: { tile: number; name: string; color?: number; keeper?: boolean; feeder?: boolean; cleaner?: boolean }[];
  /** Het personeel dat door het park loopt. */
  staff?: { role: WorkerRole; gx: number; gy: number }[];
  beds?: { x: number; y: number; kind: BedKind }[];
  toys?: { x: number; y: number; kind: ToyKind }[];
  decor?: { x: number; y: number; kind: DecorKind }[];
  shops?: { x: number; y: number; kind: ShopKind; sells?: string[]; edge?: 'h' | 'v'; turned?: boolean; rot?: number; manual?: boolean }[];
  sold?: Record<string, number>;
  soldAt?: Record<string, number>;
  soldAll?: number;
  litter?: { gx: number; gy: number }[];
  /** De gasten die in het park liepen toen het spel werd bewaard. */
  guests?: GuestSave[];
  /** Versleten houten hekken: per rand de fase (1, 2 of 3). */
  wear?: Record<string, number>;
  coins?: number;
  debt?: number;
  born?: number;
  healed?: number;
  caught?: number;
  tidied?: number;
  /** De naam van de speler, als die is ingevuld. */
  player?: string;
  /** Afmetingen van het park toen dit is opgeslagen; oudere spellen waren 14 bij 14 of 20 bij 20. */
  gw?: number;
  gh?: number;
}

export const slotKey = (slot: number): string => `zoo-slot-${slot}`;

interface TroughObj extends Trough {
  food: FoodId | null;
  kind: TroughKind;
  mesh: TroughMesh;
}
interface BedObj {
  x: number;
  y: number;
  kind: BedKind;
  mesh: THREE.Object3D;
}
interface DecorObj {
  x: number;
  y: number;
  kind: DecorKind;
  mesh: THREE.Object3D;
}
interface ToyObj {
  x: number;
  y: number;
  kind: ToyKind;
  mesh: THREE.Object3D;
  /** Tot dit moment speelt er een dier mee: het ding beweegt. */
  playUntil?: number;
}
interface ShopObj extends ShopSpot {
  mesh: THREE.Object3D;
  /** Staat het niet aan een pad dat gasten kunnen bereiken? Dan hangt er een bordje boven. */
  off?: boolean;
  warn?: HTMLElement;
  /** Het poppetje dat in de kraam werkt, als er een is. */
  vendor: Vendor | null;
}
interface PoopObj {
  gx: number;
  gy: number;
  mesh: THREE.Object3D;
}
/** Een verblijf met een naam. De naam zie je als je op het verblijf tikt. */
interface Pen {
  name: string;
  /** De kleur van het hek: een plek in FENCE_COLORS (0 = de gewone kleur). */
  color: number;
  region: Region;
  cx: number;
  cy: number;
  /** De achterste hoek, waar het bordje 'dicht' boven hangt. */
  ax: number;
  ay: number;
  sign: HTMLElement;
  /** Tot dit moment (speltijd) mogen er geen nieuwe dieren in. */
  closedUntil: number;
  /** Per soort: hoe lang een jongen en een meisje al samen blij zijn. */
  love: Record<string, number>;
}

const sexOf = (a: Animal): Sex => (a.variant === 'male' || a.variant === 'young_m' ? 'male' : 'female');
const penCap = (region: Region): number => Math.max(2, Math.floor(region.tiles.length / 2));

export class Game implements AnimalWorld, GuestWorld, WorkerWorld {
  readonly grid = new Grid();
  troughs: TroughObj[] = [];
  animals: Animal[] = [];
  poops: PoopObj[] = [];
  litter: PoopObj[] = [];
  beds: BedObj[] = [];
  toys: ToyObj[] = [];
  decors: DecorObj[] = [];
  shops: ShopObj[] = [];
  pens: Pen[] = [];
  level = 0;
  fed = 0;
  cleaned = 0;
  born = 0;
  healed = 0;
  caught = 0;
  tidied = 0;
  /** Verkocht in dit level: per ding (alleen als de gast er precies om vroeg), per soort kraam, en alles bij elkaar. */
  sold: Record<string, number> = {};
  soldAt: Record<string, number> = {};
  soldAll = 0;
  coins = START_COINS;
  /** Wat het park net heeft uitgegeven en nog niet heeft terugverdiend. */
  debt = 0;
  stats: Stats = emptyStats();
  tool: ToolId = 'hand';

  private option = { trough: 'wood', action: 'broom', terrain: 'mud', fence: 'fence', bed: 'straw', toy: 'ball', staff: 'feed', decor: 'tree', decorGroup: 'green', shop: 'foodstall', animal: '', sex: 'male', world: 'farm' };
  private puddles: { mesh: THREE.Mesh; life: number }[] = [];
  private bubbles = new Map<Animal, HTMLElement>();
  private guestBubbles = new Map<Guest, HTMLElement>();
  private hud: Hud;
  private guests: GuestManager;
  private clock = 0;
  private tick = 0;
  private saveIn = 5;
  private zzzIn = 1.5;
  private chatterIn = 6;
  /** Versleten houten hekken (rand -> fase 1, 2 of 3) en de verblijven waar er een helemaal kapot is. */
  private wear = new Map<string, number>();
  private broken = new Set<number>();
  private wearIn = 70;
  /** Afval dat je hebt opgeraapt en nog naar een afvalbak moet. */
  private carry = 0;
  /** Dingen die even opveren omdat ze gebruikt worden. */
  private pulses: { mesh: THREE.Object3D; from: number; until: number; amp: number }[] = [];
  private babbleIn = 8;
  private calledAt = -999;
  /** Wanneer de speler voor het laatst bij zijn naam is genoemd vóór een melding. */
  private namedAt = 0;
  private shuffleIn = 70;
  private sickIn = between(SICK_FOR_GOAL);
  private escapeIn = between(ESCAPE_FOR_GOAL);
  private celebrating = false;
  private toolsKey = '';
  /** Tot dit moment knippert de veger, omdat er net op een poepje is getikt. */
  private nudge = 0;
  /** Wat je dit level hebt vrijgespeeld voor het park en bij de winkels: daar staat een sterretje op. */
  private fresh = new Set<string>();
  private fullAt = 0;
  /** De knop waarvan de keuzerij nog open staat nadat er iets is neergezet (het handje is dan aan). */
  private linger: ToolId | null = null;
  /** Het poepje of afval onder de muis of vinger: dat licht op. */
  private hoverPoop: PoopObj | null = null;
  private hoverWorn: Edge | null = null;
  /** Dieren die hulp nodig hebben, de dringendste eerst; en het dier waar de knop je net heen bracht. */
  private needy: Animal[] = [];
  /** Alle dieren in nood; `needy` is daarvan één per diersoort (wat je links in beeld ziet). */
  private needyAll: Animal[] = [];
  private marked: { a: Animal; until: number } | null = null;
  private savedPens: { tile: number; name: string; color?: number }[] = [];
  /** Het personeel, en de klussen die al iemand doet. */
  workers: Worker[] = [];
  private claimed = new Set<object>();
  private gateHintAt = -99;
  private guideShown = false;
  /** Het uur van de dag (telt door); elk uur krijgen de werkers loon. */
  private hour = 0;
  /** Tot welk level er modellen zijn; daarna is het vrij spelen. */
  private maxLevel: number;
  /** Het level uit het opgeslagen spel; dat kan hoger zijn dan er nu levels zijn. */
  private savedLevel = 0;
  /** Het dier dat je aan het verplaatsen bent. */
  private moving: Animal | null = null;

  // figuren
  private lines: Line[] = [];
  private said = new Map<string, number>();
  private quietUntil = 0;
  /** Tot dit moment komt er uit zichzelf geen nieuwe melding. */
  private calmUntil = 0;
  /** Vanaf dit moment mag er weer een complimentje tussendoor komen. */
  private cheerAt = 90;
  private goalIdx = -2;
  private unmet = new Map<Animal, { wish: WishId | null; since: number }>();
  private reacted = new Map<Animal, number>();

  // invoer
  private pointers = new Map<number, { x: number; y: number }>();
  private drag: { id: number; sx: number; sy: number; moved: boolean; pan: boolean; paint: boolean } | null = null;
  private pinch: { dist: number; cx: number; cy: number } | null = null;
  private stroke = new Map<string, { lo: number; hi: number }>();
  /**
   * Het hek dat je nu sleept. Het volgt één lijn van het raster (`axis`, op `fixed`), vanaf `from`.
   * Pas als je een flink stuk opzij gaat, slaat het de hoek om.
   */
  private line: { gx0: number; gy0: number; e0: Edge | null; axis: 'h' | 'v' | null; fixed: number; from: number } | null = null;

  constructor(private view: View, private slot: number, data: SaveData | undefined, onHome: () => void, private player = data?.player ?? '') {
    const missing = LEVELS.findIndex(l => !hasSpecies(l.reward));
    this.maxLevel = missing < 0 ? LEVELS.length : missing;
    this.hud = new Hud({
      tool: (id, row, option) => this.selectTool(id as ToolId, row, option),
      home: () => void this.save().then(onHome),
      goal: i => this.explainGoal(i),
      need: i => this.gotoNeed(i),
    });
    this.guests = new GuestManager(this.view.scene, this);
    if (data) this.load(data);
    // een ouder spel dat al verder is: even vertellen dat de dieren nu iets leuks willen
    if (data && this.has('fun') && !this.toys.length) this.lines.push(say.funNew());
    this.startPath();
    this.view.paintTerrain(this.grid);
    this.syncPens(false);
    this.syncWear();
    this.refreshGoals();
    this.refreshTools();
    this.attachInput(this.view.renderer.domElement);
    addEventListener('pagehide', () => void this.save());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) void this.save();
    });
    if (!data) this.lines.push(say.welcome());
    // wie zijn naam heeft opgegeven, wordt bij het begin één keer begroet
    const hello = this.named('name.hello');
    if (hello) this.lines.push(hello);
    this.introduceLevel();
    (window as unknown as { __zoo: Game }).__zoo = this;
  }

  // ------------------------------------------------------------ opslaan
  private load(d: SaveData): void {
    // een park uit een kleiner raster komt midden tegen de voorkant van het nieuwe, grotere park te liggen:
    // zo blijft het pad aan de ingang vastzitten
    const ow = d.gw ?? 14, oh = d.gh ?? 14;
    const ox = Math.floor((W - ow) / 2), oy = H - oh;
    if (d.terrain.length === ow * oh)
      for (let y = 0; y < oh; y++) for (let x = 0; x < ow; x++) this.grid.terrain[tileIndex(x + ox, y + oy)] = d.terrain[x + y * ow];
    if (d.h.length === ow * (oh + 1))
      for (let y = 0; y <= oh; y++) for (let x = 0; x < ow; x++) this.grid.h[x + ox + (y + oy) * W] = d.h[x + y * ow];
    if (d.vv.length === (ow + 1) * oh)
      for (let y = 0; y < oh; y++) for (let x = 0; x <= ow; x++) this.grid.v[x + ox + (y + oy) * (W + 1)] = d.vv[x + y * (ow + 1)];
    this.grid.recompute();
    this.savedLevel = migrateLevel(d.level, d.v ?? 1);
    this.level = Math.min(this.savedLevel, this.maxLevel);
    this.fed = d.fed;
    this.cleaned = d.cleaned;
    this.born = d.born ?? 0;
    this.healed = d.healed ?? 0;
    this.caught = d.caught ?? 0;
    this.tidied = d.tidied ?? 0;
    this.sold = d.sold ?? {};
    this.soldAt = d.soldAt ?? {};
    this.soldAll = d.soldAll ?? 0;
    this.coins = d.coins ?? START_COINS;
    this.debt = d.debt ?? 0;
    this.savedPens = (d.pens ?? []).map(p => ({ name: p.name, color: p.color, tile: tileIndex((p.tile % ow) + ox, Math.floor(p.tile / ow) + oy) }));
    for (const tr of d.troughs) this.addTrough(tr.x + ox, tr.y + oy, tr.food, tr.amount, tr.kind && TROUGH[tr.kind] ? tr.kind : 'wood');
    for (const b of d.beds ?? []) this.addBed(b.x + ox, b.y + oy, b.kind);
    for (const b of d.toys ?? []) this.addToy(b.x + ox, b.y + oy, b.kind);
    for (const b of d.decor ?? []) if (DECOR[b.kind]) this.addDecor(b.x + ox, b.y + oy, b.kind);
    // eerst de losse dingen (bankje, bloemen, afvalbak): die blijven staan waar ze stonden
    const stored = [...(d.shops ?? [])].sort((p, q) => (SHOP_SIZE[p.kind] ?? 1) - (SHOP_SIZE[q.kind] ?? 1));
    for (const sh of stored) {
      const size = SHOP_SIZE[sh.kind];
      if (!size) continue;
      let x = sh.x + ox, y = sh.y + oy;
      if (size === 1) {
        // een bankje, bloembak of afvalbak staat op een rand; uit een ouder spel stond het nog op een tegel
        const spot = sh.edge ? { o: sh.edge, x, y } : this.edgeNear(x, y);
        if (spot && this.edgeFits(spot)) this.addShop(spot.x, spot.y, sh.kind, sh.sells, spot.o, sh.turned);
        else this.coins = Math.min(COIN_CAP, this.coins + SHOP_PRICE[sh.kind]);
        continue;
      }
      if ((d.v ?? 1) < 3 && size > 1) {
        // winkels waren eerst één tegel groot: zoek de dichtstbijzijnde plek van 2 bij 2, het liefst aan het pad;
        // is er in de buurt geen plek, dan krijg je de munten terug
        const near: [number, number][] = [];
        for (let dy = -6; dy <= 5; dy++) for (let dx = -6; dx <= 5; dx++) near.push([x + dx, y + dy]);
        near.sort((p, q) => Math.abs(p[0] + 0.5 - x) + Math.abs(p[1] + 0.5 - y) - Math.abs(q[0] + 0.5 - x) - Math.abs(q[1] + 0.5 - y));
        const fits = near.filter(([ax, ay]) => this.shopFits(ax, ay, sh.kind));
        const spot = fits.find(([ax, ay]) => this.touchesPath(ax, ay, size)) ?? fits[0];
        if (!spot) {
          this.coins = Math.min(COIN_CAP, this.coins + SHOP_PRICE[sh.kind]);
          continue;
        }
        [x, y] = spot;
      }
      this.addShop(x, y, sh.kind, sh.sells, undefined, undefined, sh.manual ? sh.rot : undefined, sh.manual);
    }
    for (const a of d.animals) {
      if (!modelReady(`${a.species}_${a.variant}`)) continue;
      const animal = this.addAnimal(a.species, a.variant, a.gx + ox, a.gy + oy, a.name);
      animal.hunger = a.hunger;
      if (a.sick) animal.fallIll();
      animal.escaped = !!a.escaped;
    }
    for (const p of d.poops) this.dropPoop(p.gx + ox, p.gy + oy);
    for (const p of d.litter ?? []) this.dropLitter(p.gx + ox, p.gy + oy);
    this.guests.restore(d.guests ?? [], ox, oy);
    for (const w of d.staff ?? []) this.addWorker(w.role, w.gx + ox, w.gy + oy);
    if (!d.staff) {
      // een ouder spel: werkers hoorden toen bij één verblijf. Eén werker per vijf van die verblijven loopt nu rond.
      const [ex, ey] = tileXY(ENTRANCE);
      const old = (role: WorkerRole): number => Math.ceil((d.pens ?? []).filter(p => p.keeper || (role === 'feed' ? p.feeder : p.cleaner)).length / 5);
      for (const role of ['feed', 'clean'] as const) for (let i = 0; i < old(role); i++) this.addWorker(role, ex + 0.5, ey + 0.5 - i * 0.4);
    }
    if (!ox && !oy) for (const [key, phase] of Object.entries(d.wear ?? {})) this.wear.set(key, phase);
  }

  serialize(): SaveData {
    return {
      v: 3,
      player: this.player || undefined,
      // wie al verder was dan de levels die er nu zijn, houdt dat level voor later
      level: this.level >= this.maxLevel ? Math.max(this.level, this.savedLevel) : this.level,
      fed: this.fed,
      cleaned: this.cleaned,
      born: this.born,
      healed: this.healed,
      caught: this.caught,
      tidied: this.tidied,
      sold: this.sold,
      soldAt: this.soldAt,
      soldAll: this.soldAll,
      coins: this.coins,
      debt: this.debt,
      terrain: Array.from(this.grid.terrain),
      h: Array.from(this.grid.h),
      vv: Array.from(this.grid.v),
      troughs: this.troughs.map(({ x, y, food, amount, kind }) => ({ x, y, food, amount, kind: kind === 'wood' ? undefined : kind })),
      animals: this.animals.map(a => ({
        species: a.species, variant: a.variant, gx: a.gx, gy: a.gy, hunger: a.hunger, name: a.name, sick: a.sick || undefined, escaped: a.escaped || undefined,
      })),
      poops: this.poops.map(({ gx, gy }) => ({ gx, gy })),
      litter: this.litter.map(({ gx, gy }) => ({ gx, gy })),
      guests: this.guests.snapshot(),
      wear: Object.fromEntries(this.wear),
      pens: this.pens.map(p => ({ tile: p.region.tiles[0], name: p.name, color: p.color || undefined })),
      staff: this.workers.map(w => ({ role: w.role, gx: w.gx, gy: w.gy })),
      beds: this.beds.map(({ x, y, kind }) => ({ x, y, kind })),
      toys: this.toys.map(({ x, y, kind }) => ({ x, y, kind })),
      decor: this.decors.map(({ x, y, kind }) => ({ x, y, kind })),
      shops: this.shops.map(({ x, y, kind, sells, edge, turned, rot, manual }) => ({ x, y, kind, sells, edge, turned, rot, manual })),
      gw: W,
      gh: H,
    };
  }

  save(): Promise<void> {
    return saveSet(slotKey(this.slot), this.serialize());
  }

  // ------------------------------------------------------------ wat is vrijgespeeld
  private levelDef(): Level | undefined {
    return this.level < this.maxLevel ? LEVELS[this.level] : undefined;
  }

  private species(): SpeciesId[] {
    return unlockedSpecies(this.level);
  }

  private has(feature: keyof typeof FEATURE): boolean {
    return this.level >= FEATURE[feature];
  }

  /** De wereld waarin je nu speelt. */
  private world(): WorldId {
    return worldOf(Math.min(this.level, LEVELS.length - 1));
  }

  /** Alles wat de vrijgespeelde dieren nodig hebben, plus een vaste basis. */
  private unlocked<T extends string>(all: T[], base: T[], of: (sp: SpeciesId) => T): T[] {
    const want = new Set<T>([...base, ...this.species().map(of)]);
    return all.filter(k => want.has(k));
  }

  private terrainOptions(): Terrain[] {
    const list = this.unlocked(TERRAINS.filter(k => k !== 'path'), ['grass', 'mud'], sp => SPECIES[sp].terrain);
    return this.has('paths') ? [...list, 'path'] : list;
  }

  private foodList(): FoodId[] {
    return this.unlocked(FOODS, ['veg', 'hay'], sp => SPECIES[sp].food);
  }

  private bedOptions(): BedKind[] {
    return this.unlocked(BEDS, ['straw', 'shed'], sp => SPECIES[sp].bed);
  }

  private shopOptions(): ShopKind[] {
    return SHOPS.filter(k => this.has(k));
  }

  private fenceOptions(): string[] {
    const needs = new Set(this.species().map(sp => SPECIES[sp].need));
    return ['fence', ...(this.has('keeper') ? ['gate'] : []), ...(needs.has('wall') ? ['wall'] : []), ...(needs.has('net') ? ['net'] : [])];
  }

  /** De werelden waar je al een dier van hebt. */
  private worldOptions(): WorldId[] {
    return WORLDS.slice(0, Math.max(1, Math.ceil(this.species().length / LEVELS_PER_WORLD)));
  }

  // ------------------------------------------------------------ munten
  /** Munten erbij, tot de kas vol is. */
  private earn(n: number, gx?: number, gy?: number): void {
    const before = this.coins;
    this.coins = Math.min(COIN_CAP, this.coins + n);
    this.debt = Math.max(0, this.debt - n);
    if (gx !== undefined && gy !== undefined && this.coins > before) {
      this.floatAt(icon('coin'), gx, gy, 0.7, 'coin');
      sfx('coin', { volume: 0.7, every: 0.12 });
    }
    if (before < COIN_CAP && this.coins >= COIN_CAP) this.alert(say.cash('full'), 600);
  }

  /** Betalen. Lukt het niet, dan zegt de kassier waarom. */
  private pay(cost: number, gx: number, gy: number): boolean {
    if (this.coins < cost) {
      this.nope(gx, gy);
      if (this.clock - (this.said.get('cash.short') ?? -999) > 20) this.sayNow(say.cash('short'));
      return false;
    }
    this.coins -= cost;
    this.debt += cost;
    return true;
  }

  /**
   * Hoe snel gasten trek krijgen. Heeft het park net veel uitgegeven, dan kopen tevreden gasten wat
   * vaker, zodat een aankoop binnen een paar minuten is terugverdiend.
   */
  demand(): number {
    return Math.max(0.7, Math.min(2.2, 0.8 + this.debt / 12));
  }

  capacity(): number {
    return this.has('paths') ? Math.min(guestsAt(this.level, this.view.speed), 2 + Math.floor(this.animals.filter(a => !a.young).length * 1.3)) : 0;
  }

  sells(kind: ShopKind): boolean {
    return this.has(kind);
  }

  parkSpecies(): string[] {
    return [...new Set(this.animals.filter(a => !a.escaped && this.grid.enclosureAt(...tileXY(a.tile))).map(a => a.species))];
  }

  /** Een gast koopt alleen iets als hij het naar zijn zin heeft. Elke koop is één munt. */
  buy(shop: ShopSpot, guest: Guest, product: string | undefined, exact: boolean): boolean {
    if (guest.fun < 0.35) return false;
    (shop as ShopObj).vendor?.sold();
    this.pulse((shop as ShopObj).mesh, 0.04);
    this.soldAt[shop.kind] = (this.soldAt[shop.kind] ?? 0) + 1;
    if (exact && product) {
      this.sold[product] = (this.sold[product] ?? 0) + 1;
      this.soldAll++;
    }
    const cx = shop.x + shop.size / 2, cy = shop.y + shop.size / 2;
    if (product) this.floatAt(this.productIcon(product), cx - 0.4, cy, 1.5);
    if (shop.kind === 'foodstall' || shop.kind === 'icecream') sfx('guest.yum', { volume: 0.4, every: 6 });
    this.earn(1, cx, cy);
    return true;
  }

  cheer(guest: Guest): void {
    this.floatAt(icon('heart'), guest.gx, guest.gy, guest.height + 0.2);
    sfx('cheer', { volume: 0.3, every: 5 });
  }

  guestSound(kind: 'flush' | 'guest.laugh' | 'toilet.pee' | 'toilet.poop' | 'guest.grumble'): void {
    sfx(kind, { volume: 0.25, every: 5 });
  }

  splash(gx: number, gy: number): void {
    this.view.splash(gx, gy);
  }

  guestNear(gx: number, gy: number): [number, number] | null {
    let best: [number, number] | null = null, bestD = 2.6;
    for (const q of this.guests.guests) {
      const d = Math.hypot(q.gx - gx, q.gy - gy);
      if (d < bestD) {
        bestD = d;
        best = [q.gx, q.gy];
      }
    }
    return best;
  }

  heart(gx: number, gy: number, height: number): void {
    this.floatAt(icon('heart'), gx, gy, height);
  }

  messSound(kind: 'poop' | 'pee'): void {
    // af en toe, niet elke keer: dieren plassen vaak
    if (kind === 'poop' ? Math.random() < 0.5 : Math.random() < 0.25) sfx(kind === 'poop' ? 'poop.plop' : 'pee.trickle', { volume: 0.3, every: kind === 'poop' ? 8 : 15 });
  }

  /** Vraagt een level om voeren, dan krijgen dieren sneller trek: zo hoef je daar niet lang op te wachten. */
  hungerRate(): number {
    return this.goalOpen('fed') ? 2.5 : 1;
  }

  /** Vraagt het level om iets te verkopen, dan krijgen gasten daar drie keer zo snel zin in: zo wacht je niet eindeloos. */
  craving(kind: ShopKind): number {
    const asked = this.levelDef()?.goals.some(g =>
      g.type === 'sold' && goalProgress(g, this.stats) < g.n && (g.product ? PRODUCTS.find(p => p.id === g.product)?.shop === kind : !g.shop || g.shop === kind));
    return asked ? 3 : 1;
  }

  /** Hoeveel van dit soort kraam het park nodig heeft voor zoveel gasten als er kunnen komen. */
  shopsNeeded(kind: ShopKind): number {
    const serves = SERVES[kind];
    return serves ? Math.max(1, Math.ceil(this.capacity() / serves)) : 1;
  }

  /** Welk deel van de gasten bij dit soort kraam geen plek vindt: te weinig kramen voor zoveel gasten. */
  busy(kind: ShopKind): number {
    const serves = SERVES[kind];
    // alle speeltoestellen tellen samen als plek om te spelen
    const pool = kind === 'playground' ? PLAY : [kind];
    const have = this.shops.filter(s => pool.includes(s.kind)).length;
    const guests = this.guests.guests.length;
    return serves && have && guests > have * serves ? 1 - (have * serves) / guests : 0;
  }

  messy(): boolean {
    return this.goalOpen('tidy');
  }

  dropLitter(gx: number, gy: number): void {
    if (this.litter.length >= MAX_LITTER) return;
    this.litter.push({ gx, gy, mesh: this.view.makeLitter(gx, gy) });
  }

  litterOn(tile: number): boolean {
    const on = (p: { gx: number; gy: number }): boolean => tileIndex(Math.floor(p.gx), Math.floor(p.gy)) === tile;
    return this.litter.some(on) || this.poops.some(on);
  }

  /** Waar gasten bij dit soort kraam om kunnen vragen. Knuffels zijn er van de dieren die in het park wonen. */
  products(kind: ShopKind): string[] {
    return kind === 'souvenir' ? this.parkSpecies().map(sp => PLUSH + sp) : productsFor(kind, this.level);
  }

  private productIcon(id: string, cls = ''): string {
    return id.startsWith(PLUSH) ? speciesIcon(id.slice(PLUSH.length), cls) : icon(id as IconId, cls);
  }

  private productName(id: string): string {
    return id.startsWith(PLUSH) ? t(`species.${id.slice(PLUSH.length)}`) : t(`product.${id}`);
  }

  /** Een gast kon het niet meer ophouden. Poep blijft liggen tot je erop tikt; een plas droogt vanzelf op. */
  accident(guest: Guest, mess: 'poop' | 'pee'): void {
    const loose = this.poops.filter(p => !this.grid.enclosureAt(Math.floor(p.gx), Math.floor(p.gy))).length;
    if (mess === 'poop' && loose < 6) this.dropPoop(guest.gx, guest.gy);
    else this.dropPuddle(guest.gx, guest.gy);
    sfx('guest.uhoh', { volume: 0.8, every: 1 });
    this.floatAt(icon('smile_bad'), guest.gx, guest.gy, guest.height + 0.2);
    for (const q of this.guests.guests) if (q !== guest && Math.hypot(q.gx - guest.gx, q.gy - guest.gy) < 2.5) q.fun = Math.max(0, q.fun - 0.08);
    this.alert(say.host('accident'), REPEAT_AFTER);
  }

  /** Wat een gast op deze padtegel te zien krijgt: het leukste verblijf ernaast. */
  viewScore(tile: number): { score: number; x: number; y: number; species: string[] } | null {
    const [x, y] = tileXY(tile);
    let best: { score: number; x: number; y: number; species: string[] } | null = null;
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      const region = this.grid.enclosureAt(x + dx, y + dy);
      if (!region) continue;
      const here = this.animalsIn(region.id);
      if (!here.length) continue;
      const score = 0.12 + 0.06 * here.filter(a => a.happy).length - (this.poopsIn(region.id) > MAX_POOPS_CLEAN ? 0.1 : 0) - (this.litterOn(tile) ? 0.05 : 0);
      if (!best || score > best.score) best = { score, x: x + dx + 0.5, y: y + dy + 0.5, species: [...new Set(here.map(a => a.species))] };
    }
    return best;
  }

  /** De eerste twee tegels pad bij de ingang liggen er al zodra er gasten mogen komen. */
  private startPath(): void {
    if (!this.has('paths')) return;
    const [x, y] = tileXY(ENTRANCE);
    for (const ty of [y, y - 1]) if (!this.grid.enclosureAt(x, ty)) this.grid.setTerrain(x, ty, PATH);
  }

  // ------------------------------------------------------------ knoppen
  private selectTool(id: ToolId, row?: string, option?: string): void {
    if (this.staffGhost) this.staffGhost.worker.mesh.visible = false;
    // wie voor het eerst personeel kiest, krijgt de uitleg
    if (id === 'staff' && !this.workers.length && !this.guideShown) this.showStaffGuide();
    this.tool = id;
    this.linger = null;
    this.moving = null;
    if (row && option && row in this.option) this.option[row as keyof typeof this.option] = option;
    if (option) this.fresh.delete(option);
    this.hud.hideMenu();
    this.view.hideGhost();
    this.refreshTools(true);
  }

  private refreshTools(force = false): void {
    const species = this.species();
    const pickFrom = <T extends string>(key: keyof typeof this.option, list: T[]): void => {
      if (!list.includes(this.option[key] as T)) this.option[key] = list[list.length - 1] ?? '';
    };
    pickFrom('world', this.worldOptions());
    const troughs = TROUGHS.filter(k => TROUGH[k].from <= this.level);
    if (!troughs.includes(this.option.trough as TroughKind)) this.option.trough = 'wood';
    if (!this.actionOptions().includes(this.option.action as ActionId)) this.option.action = 'broom';
    // eerst kies je de wereld (schuur, savanneboom, ...), daarboven staan de dieren van die wereld
    const shown = species.filter(sp => HOME[sp] === this.option.world);
    pickFrom('animal', shown);
    pickFrom('terrain', this.terrainOptions());
    pickFrom('bed', this.bedOptions());
    // voor het park speel je bijna elk level iets vrij
    const decors = DECORS.filter(k => DECOR[k].from <= this.level);
    const decorGroups = DECOR_GROUPS.filter(g => decors.some(k => DECOR[k].group === g));
    if (!decorGroups.includes(this.option.decorGroup as DecorGroup)) this.option.decorGroup = decorGroups[0] ?? 'green';
    pickFrom('decor', decors.filter(k => DECOR[k].group === this.option.decorGroup));
    pickFrom('shop', this.shopOptions());
    pickFrom('fence', this.fenceOptions());
    if ((this.tool === 'animal' && !species.length) || (this.tool === 'shop' && !this.shopOptions().length)) this.tool = 'hand';

    const hint = this.clock < this.nudge && this.tool !== 'action' ? 'action' : this.hintTool();
    // de balk wordt alleen opnieuw opgebouwd als er echt iets anders in komt; bij een munt meer of minder
    // verandert alleen het prijskaartje, anders flikkeren de plaatjes van de dieren
    this.hud.setAfford(this.coins);
    const key = [this.tool, this.linger, hint, this.level, ...Object.values(this.option), ...this.fresh].join('|');
    if (!force && key === this.toolsKey) return;
    this.toolsKey = key;

    const opt = (id: string, ic: IconId, label: string, price = 0, tone?: ToolOption['tone']): ToolOption => ({
      id, icon: icon(ic), label, tone, price: price || undefined, cant: price > this.coins,
    });
    const acts = this.actionOptions();
    const defs: ToolDef[] = [
      opt('hand', 'hand', t('tool.hand')),
      // de actieknop komt erbij zodra er dieren zijn die kunnen poepen. Eerst is het alleen de veger; komen er
      // afval en versleten hekken bij, dan kies je in de rij erboven: veger, hamer of prikker
      ...(this.level >= 1
        ? [{
            ...opt('action', acts.length > 1 ? 'action' : 'broom', acts.length > 1 ? t('tool.action') : t('action.broom')),
            rows: acts.length > 1 ? [{ key: 'action', active: this.option.action, options: acts.map(k => opt(k, k, t(`action.${k}`))) }] : [],
          }]
        : []),
      {
        ...opt('terrain', 'terrain', t('tool.terrain')),
        rows: [{ key: 'terrain', active: this.option.terrain, options: this.terrainOptions().map(k => opt(k, k, t(`terrain.${k}`))) }],
      },
      {
        ...opt('fence', 'fence', t('tool.fence')),
        rows: [{ key: 'fence', active: this.option.fence, options: this.fenceOptions().map(k => opt(k, k as IconId, t(`fence.${k}`))) }],
      },
      // eerst is er alleen de houten bak; komen er grotere bij, dan kies je in de rij erboven
      troughs.length > 1
        ? {
            ...opt('trough', 'trough_empty', t('tool.trough')),
            fresh: troughs.some(k => this.fresh.has(k)),
            rows: [{ key: 'trough', active: this.option.trough, options: troughs.map(k => ({ ...opt(k, TROUGH_ICON[k], t(`trough.${k}`), TROUGH[k].price), fresh: this.fresh.has(k) })) }],
          }
        : opt('trough', 'trough_empty', t('tool.trough'), PRICE.trough),
      {
        ...opt('bed', 'shed', t('tool.bed')),
        rows: [{ key: 'bed', active: this.option.bed, options: this.bedOptions().map(k => opt(k, k, t(`bed.${k}`), PRICE.bed)) }],
      },
    ];
    if (this.has('fun'))
      defs.push({
        ...opt('toy', 'ball', t('tool.toy')),
        rows: [{ key: 'toy', active: this.option.toy, options: TOYS.map(k => opt(k, k, t(`toy.${k}`), PRICE.toy)) }],
      });
    if (this.has('decor'))
      defs.push({
        ...opt('decor', 'tree', t('tool.decor')),
        fresh: decors.some(k => this.fresh.has(k)),
        rows: [
          // eerst de groep (groen, water, sier), dan wat je neerzet; een sterretje bij wat je net hebt vrijgespeeld
          { key: 'decorGroup', active: this.option.decorGroup, options: decorGroups.map(k => ({ ...opt(k, k === 'green' ? 'tree' : k === 'water' ? 'pond' : 'flag', t(`decor.group.${k}`)), fresh: decors.some(d => DECOR[d].group === k && this.fresh.has(d)) })) },
          { key: 'decor', active: this.option.decor, options: decors.filter(k => DECOR[k].group === this.option.decorGroup).map(k => ({ ...opt(k, k, t(`decor.${k}`), DECOR[k].price), fresh: this.fresh.has(k) })) },
        ],
      });
    if (this.shopOptions().length)
      defs.push({
        ...opt('shop', 'foodstall', t('tool.shop')),
        fresh: this.shopOptions().some(k => this.fresh.has(k)),
        rows: [{ key: 'shop', active: this.option.shop, options: this.shopOptions().map(k => ({ ...opt(k, k, t(`shop.${k}`), SHOP_PRICE[k]), fresh: this.fresh.has(k) })) }],
      });
    if (species.length) {
      const rows: NonNullable<ToolDef['rows']> = [
        { key: 'sex', active: this.option.sex, options: [opt('male', 'boy', t('sex.male'), 0, 'boy'), opt('female', 'girl', t('sex.female'), 0, 'girl')] },
      ];
      rows.push({
        key: 'animal',
        active: this.option.animal,
        options: shown.map(k => ({ id: k, icon: speciesIcon(k), label: t(`species.${k}`), price: SPECIES[k].cost, cant: SPECIES[k].cost > this.coins })),
      });
      // de werelden staan onderaan, vlak boven de knop Dier, elk met een eigen plaatje (geen dierenkop)
      if (this.worldOptions().length > 1)
        rows.push({ key: 'world', active: this.option.world, options: this.worldOptions().map(w => ({ id: w, icon: icon(`world_${w}` as IconId), label: t(`world.${w}`) })) });
      defs.push({ ...opt('animal', 'paw', t('tool.animal')), rows });
    }
    if (this.has('keeper'))
      defs.push({
        ...opt('staff', 'keeper', t('tool.staff')),
        rows: [{ key: 'staff', active: this.option.staff, options: (['feed', 'clean', ...(this.has('wear') ? (['fix'] as const) : [])] as WorkerRole[]).map(r => ({ id: r, icon: icon(ROLE_ICON[r]), label: t(`staff.${r}`), price: WAGE, per: true })) }],
      });
    defs.push(opt('erase', 'erase', t('tool.erase')));
    const grouped = TOOL_GROUPS.flatMap(([group, ids]) => ids.flatMap(id => defs.filter(d => d.id === id).map(d => ({ ...d, group }))));
    this.hud.setTools(grouped, this.tool, hint, this.linger);
  }

  /** Wat er onder de actieknop zit: de veger altijd, de prikker zodra er afval komt, de hamer zodra hekken slijten. */
  private actionOptions(): ActionId[] {
    return ['broom', ...(this.has('wear') ? (['hammer'] as const) : []), ...(this.has('bin') ? (['picker'] as const) : [])];
  }

  /** Een tik met het verkeerde gereedschap: het goede wordt alvast gekozen en de actieknop licht op. */
  private pointTo(act: ActionId, gx: number, gy: number): void {
    if (!this.actionOptions().includes(act)) return;
    this.option.action = act;
    this.floatAt(icon(act), gx, gy, 0.5);
    if (this.tool !== 'action') this.nudge = this.clock + 5;
    this.refreshTools(true);
  }

  /** Het versleten hek vlak bij dit punt, als dat er is. */
  private wornAt(gx: number, gy: number): Edge | null {
    const e = nearestEdge(gx, gy, 0.3);
    return e && this.wear.has(edgeKey(e)) ? e : null;
  }

  /** Ligt hier iets waar het gekozen gereedschap van de actieknop iets mee kan? Anders sleep je het veld. */
  private actionTarget(cx: number, cy: number): boolean {
    if (this.option.action === 'broom') return !!this.pickPoop(cx, cy);
    if (this.option.action === 'picker') return !!this.pickLitter(cx, cy);
    const g = this.view.groundPoint(cx, cy);
    return !!g && !!this.wornAt(g.gx, g.gy);
  }

  private firstOpenGoal(): number {
    const level = this.levelDef();
    return level ? level.goals.findIndex(g => goalProgress(g, this.stats) < g.n) : -1;
  }

  private goalOpen(type: Goal['type']): boolean {
    return !!this.levelDef()?.goals.some(g => g.type === type && goalProgress(g, this.stats) < g.n);
  }

  /** De knop die hoort bij het eerste doel dat nog niet af is. */
  private hintTool(): string | null {
    const goal = this.levelDef()?.goals[this.firstOpenGoal()];
    switch (goal?.type) {
      case 'enclosure': return 'fence';
      case 'trough': return 'trough';
      case 'bed': return 'bed';
      case 'path': return 'terrain';
      case 'shop': return 'shop';
      case 'animals': return 'animal';
      case 'cleaned':
      case 'tidy': return 'action';
      case 'fed':
      case 'healed':
      case 'caught':
      case 'keeper': return 'staff';
      case 'sold':
      case 'coins': return 'hand';
      default: return null;
    }
  }

  private goalView(g: Goal, levelSpecies: SpeciesId | undefined): GoalView {
    const sp = g.species ?? levelSpecies;
    const line = goalLine(t, g);
    const html: Record<Goal['type'], string> = {
      enclosure: icon('pen'),
      trough: icon('trough'),
      bed: icon('straw'),
      path: icon('path'),
      guests: icon('guest') + icon('smile_good', 'badge'),
      coins: icon('coin'),
      shop: icon(g.shop ?? 'foodstall'),
      animals: g.species ? speciesIcon(g.species) : icon('paw'),
      happy: (g.species ? speciesIcon(g.species) : icon('paw')) + icon('heart', 'badge'),
      fed: icon(sp ? SPECIES[sp].food : 'veg'),
      cleaned: icon('poop'),
      born: icon('born'),
      kinds: icon('kinds') + icon('heart', 'badge'),
      happyany: icon('paw') + icon('heart', 'badge'),
      healed: icon('vet'),
      caught: icon('catch'),
      keeper: icon('keeper'),
      tidy: icon('litter'),
      sold: (g.product ? this.productIcon(g.product) : icon(g.shop ?? 'coin')) + icon('coin', 'badge'),
    };
    return { icon: html[g.type], label: textOf(t, line), n: g.n, who: line.who };
  }

  private refreshGoals(): void {
    const level = this.levelDef();
    const sp = level?.goals.find(x => x.species)?.species;
    this.hud.setGoals(level ? this.level + 1 : null, level ? level.goals.map(g => this.goalView(g, sp)) : [], t(`world.${this.world()}`));
  }

  // ------------------------------------------------------------ figuren
  /** Een zin met de naam van de speler erin, als die naam is ingesproken. Anders null. */
  private named(key: string): Line | null {
    if (!this.player) return null;
    const line = say.named(key, this.player);
    return hasVoice(voiceId(line.who, textOf(t, line))) ? line : null;
  }

  /** Bij nood roept de verzorger de speler bij zijn naam, maar hooguit eens in de drie minuten. */
  private callForHelp(key: string): void {
    const line = this.named(key);
    if (!line || this.clock - this.calledAt < 300) return;
    this.calledAt = this.clock;
    this.lines.unshift(line);
  }

  /** Een compliment bij een gehaald level: elke keer een ander figuur en een andere stijl, met de naam als die er is. */
  private praise(): Line {
    const personal = Object.keys(NAMED).filter(k => k.startsWith('name.done')).map(k => this.named(k)).filter((l): l is Line => !!l);
    if (personal.length) return personal[this.level % personal.length];
    return say.praise((this.level * 3 + 1) % PRAISE.length);
  }

  private sayNow(line: Line): void {
    this.said.set(line.id ?? line.key, this.clock);
    this.quietUntil = this.clock + 9;
    const text = textOf(t, line);
    const id = voiceId(line.who, text);
    // af en toe noemt het figuur de speler eerst bij zijn naam: "Senna, de gasten hebben honger."
    const call = this.player && !line.key.startsWith('name.') && !line.vars?.name ? voiceId(line.who, callText(t, this.player)) : '';
    if (call && this.clock - this.namedAt > 40 && Math.random() < 0.35 && hasVoice(call) && hasVoice(id)) {
      this.namedAt = this.clock;
      this.hud.say(line.who, line.mood, `${this.player}, ${text.charAt(0).toLowerCase()}${text.slice(1)}`, playVoice([call, id]));
    } else this.hud.say(line.who, line.mood, text, playVoice(id));
  }

  /** Een melding die mag wachten: alleen als het stil is en hij niet net al gezegd is. */
  private alert(line: Line, cooldown = REPEAT_AFTER): void {
    if (this.hud.speaking || this.lines.length || this.clock < Math.max(this.quietUntil, this.calmUntil) || this.celebrating) return;
    const last = this.said.get(line.id ?? line.key);
    if (last !== undefined && this.clock - last < cooldown) return;
    this.calmUntil = this.clock + ALERT_GAP;
    this.sayNow(line);
  }

  /** Leuk nieuws dat in de rij mag: hooguit eens in de zoveel seconden, anders hoor je bij elk jong een stem. */
  private mention(line: Line, gap = 120): void {
    if (this.clock - (this.said.get(line.id ?? line.key) ?? -999) < gap || this.lines.some(l => l.key === line.key)) return;
    this.lines.push(line);
  }

  private introduceLevel(): void {
    this.goalIdx = -2;
    const level = this.levelDef();
    this.lines.push(level ? say.level(this.level + 1) : this.maxLevel < LEVELS.length ? say.soon() : say.free());
    if (this.level === FEATURE.fun) this.lines.push(say.funNew());
    if (this.level === FEATURE.decor) this.lines.push(say.decorNew());
    // vanaf nu kun je hulp aannemen: de verzorger vertelt hoe
    if (this.level === FEATURE.keeper) this.showStaffGuide();
    this.view.setWorld(this.world());
    ambience(`amb.${this.world()}`);
    music(this.world());
    layer('amb.wind', 0.6);
    // de knop voor het eerste doel staat alvast op de goede keuze
    const first = level?.goals[0];
    if (first?.type === 'path') this.option.terrain = 'path';
    for (const g of level?.goals ?? []) if (g.type === 'shop' && g.shop && !this.stats.shops[g.shop]) this.option.shop = g.shop;
    // een kraam die er al was, kan vanaf nu iets nieuws verkopen
    if (PRODUCTS.some(p => p.from === this.level && p.from > FEATURE[p.shop])) this.lines.push(say.host('new', 'happy'));
  }

  private explainGoal(i: number): void {
    const g = this.levelDef()?.goals[i];
    if (g) this.sayNow(goalLine(t, g));
  }

  // ------------------------------------------------------------ verblijven
  private pickName(listKey: string, used: string[]): string {
    const all = t(listKey).split(',');
    const free = all.filter(n => !used.includes(n));
    if (free.length) return free[Math.floor(Math.random() * free.length)];
    // alle namen zijn op: dezelfde namen opnieuw, met een volgnummer
    for (let n = 2; ; n++) {
      const again = all.filter(name => !used.includes(`${name} ${n}`));
      if (again.length) return `${again[Math.floor(Math.random() * again.length)]} ${n}`;
    }
  }

  /** Het doorzichtige poppetje onder de muis als je personeel gaat neerzetten. */
  private staffGhost: { worker: Worker; role: WorkerRole; gx: number; gy: number; ok: boolean } | null = null;

  private addWorker(role: WorkerRole, gx: number, gy: number): Worker {
    const worker = new Worker(gx, gy, role);
    this.view.scene.add(worker.mesh);
    this.workers.push(worker);
    return worker;
  }

  private removeWorker(worker: Worker): void {
    worker.drop(this.claimed);
    this.view.scene.remove(worker.mesh);
    this.workers = this.workers.filter(w => w !== worker);
  }

  /** Personeel zet je neer in het park, buiten de verblijven: daar begint de werker te lopen. */
  private placeStaff(x: number, y: number): void {
    if (!this.grid.inBounds(x, y) || this.grid.enclosureAt(x, y) || this.taken(x, y)) return this.nope(x + 0.5, y + 0.5);
    const role = this.option.staff as WorkerRole;
    this.addWorker(role, x + 0.5, y + 0.5).plop();
    if (this.staffGhost) this.staffGhost.worker.mesh.visible = false;
    sfx('place');
    this.floatAt(icon(ROLE_ICON[role]), x + 0.5, y + 0.5, 0.9);
    this.sayNow(say.hiredAs(role));
    this.backToHand();
  }

  /** Tik op een werker: je ziet wat hij doet en kunt hem naar huis sturen. */
  private workerMenu(worker: Worker): void {
    const s = this.view.toScreen(worker.gx, worker.gy, worker.height);
    const header = icon(ROLE_ICON[worker.role]) + `<i class="price">${WAGE}${t('per.hour')}</i>`;
    this.hud.showMenu(s.x, s.y, t(`staff.${worker.role}`), [{ id: 'bye', icon: icon('empty'), label: t('staff.bye') }], () => {
      this.removeWorker(worker);
      sfx('erase');
    }, header);
  }

  /** De uitleg in stappen, de eerste keer dat het personeel erbij komt of je de knop kiest zonder dat je al iemand hebt. */
  private showStaffGuide(): void {
    this.guideShown = true;
    this.hud.showGuide(t('guide.staff.title'), [
      { icon: icon('keeper'), text: t('guide.staff.1') },
      { icon: icon('feed'), text: t('guide.staff.2') },
      { icon: icon('gate'), text: t('guide.staff.3') },
      { icon: icon('coin'), text: t('guide.staff.4') },
    ], t('guide.ok'));
    this.sayNow(say.staffHow());
  }

  // --- wat het personeel van het park moet weten
  feedJobs(): { trough: TroughObj; food: FoodId }[] {
    const jobs: { trough: TroughObj; food: FoodId }[] = [];
    for (const pen of this.pens)
      for (const { trough, food } of this.troughsOf(pen.region.id)) if (food && !(trough.food === food && trough.amount > 1)) jobs.push({ trough, food });
    return jobs;
  }

  cleanJobs(): PoopObj[] {
    return [...this.poops, ...this.litter];
  }

  /** Voor de klusser: elk versleten hek is een klus. Hetzelfde hek geeft steeds hetzelfde briefje, zodat er maar één klusser op afgaat. */
  private fixTargets = new Map<string, FixJob>();
  fixJobs(): FixJob[] {
    for (const key of [...this.fixTargets.keys()]) if (!this.wear.has(key)) this.fixTargets.delete(key);
    for (const key of this.wear.keys()) {
      if (this.fixTargets.has(key)) continue;
      const o = key[0] as 'h' | 'v', [x, y] = key.slice(1).split(',').map(Number);
      this.fixTargets.set(key, { e: { o, x, y }, gx: o === 'h' ? x + 0.5 : x, gy: o === 'h' ? y : y + 0.5 });
    }
    return [...this.fixTargets.values()];
  }

  workerFix(job: FixJob): void {
    if (this.wear.has(edgeKey(job.e))) this.repair(job.e);
  }

  walkable(tile: number): boolean {
    const [x, y] = tileXY(tile);
    return !this.taken(x, y);
  }

  workerFill(trough: KeeperTrough, food: FoodId): void {
    if (this.troughs.includes(trough as TroughObj)) this.keeperFill(trough, food);
  }

  workerClean(mess: KeeperPoop): void {
    const p = mess as PoopObj;
    if (this.poops.includes(p)) this.keeperClean(p);
    else if (this.litter.includes(p)) {
      this.view.scene.remove(p.mesh);
      this.litter = this.litter.filter(x => x !== p);
      this.tidied++;
      this.floatAt(icon('sparkle'), p.gx, p.gy, 0.2);
    }
  }

  /** Een werker kan niet bij zijn klus: er zit geen poort in het hek. De bouwer zegt het en je ziet waar. */
  noGate(gx: number, gy: number): void {
    if (this.clock - this.gateHintAt > 12) {
      this.gateHintAt = this.clock;
      this.floatAt(icon('gate'), gx, gy, 0.9);
    }
    this.alert(say.noGate());
  }

  /** Een nieuw uur: elke werker krijgt loon. Is het geld op, dan wachten de werkers die niets kregen. */
  private payWages(): void {
    let short = false;
    for (const worker of this.workers) {
      worker.paid = this.coins >= WAGE;
      if (worker.paid) this.coins -= WAGE;
      else short = true;
    }
    if (this.workers.length) sfx('coin', { volume: 0.35, every: 1 });
    if (short) this.alert(say.cash('wage'), 300);
  }

  /** Na elke verandering aan de hekken: welke verblijven zijn er, welke zijn nieuw, welke zijn weg? */
  private syncPens(announce: boolean): void {
    const old = this.pens;
    const kept = new Set<Pen>();
    const next: Pen[] = [];
    for (const region of this.grid.enclosures()) {
      const tiles = new Set(region.tiles);
      let pen = old.find(p => !kept.has(p) && p.region.tiles.some(i => tiles.has(i)));
      if (pen) kept.add(pen);
      else {
        const saved = this.savedPens.find(s => tiles.has(s.tile));
        const name = saved?.name ?? this.pickName('names.pens', [...old, ...next].map(p => p.name));
        pen = { name, color: saved?.color ?? 0, region, cx: 0, cy: 0, ax: 0, ay: 0, sign: this.hud.makeSign(t('pen.closed')), closedUntil: 0, love: {} };
        if (announce) this.celebratePen(pen, !old.length && !next.length && this.level === 0);
      }
      pen.region = region;
      pen.cx = region.tiles.reduce((s, i) => s + tileXY(i)[0] + 0.5, 0) / region.tiles.length;
      pen.cy = region.tiles.reduce((s, i) => s + tileXY(i)[1] + 0.5, 0) / region.tiles.length;
      [pen.ax, pen.ay] = tileXY(region.tiles.reduce((best, i) => (tileXY(i)[0] + tileXY(i)[1] < tileXY(best)[0] + tileXY(best)[1] ? i : best)));
      next.push(pen);
    }
    for (const p of old) {
      if (kept.has(p)) continue;
      p.sign.remove();
      const gone = new Set(p.region.tiles);
      for (const a of this.animals) if (gone.has(a.tile)) this.react(a, 'bad');
    }
    this.pens = next;
  }

  /** Een hek is een verblijf geworden: witte gloed, sterretjes en de bouwer noemt de naam. */
  private celebratePen(pen: Pen, first = false): void {
    this.view.flash(pen.region.tiles);
    sfx('chime');
    const tiles = pen.region.tiles;
    for (let k = 0; k < Math.min(7, tiles.length); k++) {
      const [x, y] = tileXY(tiles[Math.floor(Math.random() * tiles.length)]);
      setTimeout(() => this.floatAt(icon('sparkle'), x + 0.2 + Math.random() * 0.6, y + 0.2 + Math.random() * 0.6, 0.3), k * 110);
    }
    this.sayNow(say.pen(pen.name));
    // bij het allereerste verblijf leert de bouwer je dat je het hek een kleur kunt geven
    if (first) this.lines.push(say.penColor());
  }

  private penAt(x: number, y: number): Pen | undefined {
    const region = this.grid.enclosureAt(x, y);
    return region ? this.pens.find(p => p.region.id === region.id) : undefined;
  }

  private gridChanged(): void {
    this.syncPens(true);
    this.syncWear();
  }

  /** Tekent de hekken opnieuw met hun slijtage en houdt bij welke verblijven een kapot hek hebben. */
  private syncWear(): void {
    const wood = new Set(this.grid.edges().filter(x => x.kind === 1).map(x => edgeKey(x.e)));
    for (const key of [...this.wear.keys()]) if (!wood.has(key)) this.wear.delete(key);
    // elk verblijf kleurt zijn eigen hek; een hek tussen twee verblijven krijgt de kleur van het laatste
    const tints = new Map<string, number>();
    for (const pen of this.pens) if (pen.color) for (const e of this.grid.borderEdges(pen.region)) tints.set(edgeKey(e), pen.color);
    this.view.syncFences(this.grid, this.wear, tints);
    this.broken = new Set(this.grid.enclosures().filter(r => this.grid.borderEdges(r).some(e => this.wear.get(edgeKey(e)) === 3)).map(r => r.id));
  }

  brokenPen(regionId: number): boolean {
    return this.broken.has(regionId);
  }

  /** Een houten hek slijt een stapje: meestal een hek dat al versleten is, soms een nieuw. Hooguit vier tegelijk. */
  private wearFence(): void {
    const worn = [...this.wear.entries()].filter(([, phase]) => phase < 3).map(([key]) => key);
    if (worn.length && (this.wear.size >= 4 || Math.random() < 0.6)) {
      const key = worn[Math.floor(Math.random() * worn.length)];
      this.wear.set(key, this.wear.get(key)! + 1);
    } else if (this.wear.size < 4) {
      const edges = this.pens.filter(p => this.animalsIn(p.region.id).length).flatMap(p => this.grid.borderEdges(p.region)).filter(e => this.grid.getEdge(e) === 1 && !this.wear.has(edgeKey(e)));
      if (!edges.length) return;
      this.wear.set(edgeKey(edges[Math.floor(Math.random() * edges.length)]), 1);
    } else return;
    this.syncWear();
  }

  /** Een tik met de hamer timmert een versleten hek weer vast. */
  private repair(e: Edge): void {
    this.wear.delete(edgeKey(e));
    this.syncWear();
    sfx('fence');
    const [x, y] = e.o === 'h' ? [e.x + 0.5, e.y] : [e.x, e.y + 0.5];
    this.floatAt(icon('hammer'), x, y, 0.6);
    this.floatAt(icon('sparkle'), x, y, 0.3);
  }

  /** Afval prikken: het gaat mee tot je op een afvalbak tikt. */
  private pickUp(p: PoopObj): void {
    if (this.carry >= MAX_CARRY) {
      // bij slepen over meer afval niet steeds opnieuw melden
      if (this.clock < this.fullAt) return;
      this.fullAt = this.clock + 1.5;
      this.floatAt(icon('bin'), p.gx, p.gy, 0.5);
      this.floatAt(t('carry.full'), p.gx, p.gy, 0.9, 'word');
      return;
    }
    this.view.scene.remove(p.mesh);
    this.litter = this.litter.filter(x => x !== p);
    this.carry++;
    this.hud.setCarry(this.carry);
    sfx('tap', { every: 0.1 });
    this.floatAt(icon('litter'), p.gx, p.gy, 0.4);
  }

  /** Alles wat je in je handen hebt gaat in de afvalbak: een munt per stuk. */
  private dump(bin: ShopObj): void {
    const [x, y] = edgePose(bin);
    this.tidied += this.carry;
    this.earn(this.carry, x, y);
    this.carry = 0;
    this.hud.setCarry(0);
    sfx('place');
    this.floatAt(icon('sparkle'), x, y, 0.6);
    this.pulse(bin.mesh, 0.25);
  }

  /** Laat iets even opveren, omdat het gebruikt wordt. */
  private pulse(mesh: THREE.Object3D, amp = 0.08, seconds = 0.4): void {
    if (!this.pulses.some(p => p.mesh === mesh)) this.pulses.push({ mesh, from: this.clock, until: this.clock + seconds, amp });
  }

  /** Alles wat uit zichzelf beweegt: opverende kramen en bakken, wuivende vlaggen en bomen, stromend water. */
  private animateProps(): void {
    for (const p of this.pulses) {
      const k = (this.clock - p.from) / (p.until - p.from);
      const s = k >= 1 ? 1 : 1 + p.amp * Math.sin(k * Math.PI);
      p.mesh.scale.set(s, s, s);
    }
    if (this.pulses.length) this.pulses = this.pulses.filter(p => this.clock < p.until + 0.05);
    const t = this.clock;
    for (const d of this.decors) {
      const m = d.mesh;
      if (d.kind === 'flag') m.rotation.y = Math.sin(t * 1.8 + d.x) * 0.3;
      else if (d.kind === 'tree' || d.kind === 'pine' || d.kind === 'palm' || d.kind === 'topiary' || d.kind === 'cherry' || d.kind === 'bamboogrove') m.rotation.z = Math.sin(t * 1.2 + d.x * 2 + d.y) * 0.025;
      else if (d.kind === 'roses' || d.kind === 'tulips') m.rotation.z = Math.sin(t * 2 + d.x) * 0.03;
      else if (d.kind === 'windmill' && m.children[3]) m.children[3].rotation.z = t * 1.4 + d.x;
      else if (d.kind === 'campfire' && m.children[3]) {
        m.children[2].scale.y = 1 + Math.sin(t * 11 + d.x) * 0.18;
        m.children[3].scale.y = 1 + Math.sin(t * 14 + d.y) * 0.25;
      } else if (d.kind === 'waterfall' && m.children[1]) m.children[1].scale.y = 1 + Math.sin(t * 7) * 0.04;
      else if (d.kind === 'pond' && m.children[2]) m.children[2].position.y = Math.sin(t * 2 + d.x) * 0.012;
    }
  }

  private penMenu(pen: Pen): void {
    const s = this.view.toScreen(pen.cx, pen.cy, 0.5);
    const opt = (id: string, ic: IconId, key: string, price = 0): ToolOption => ({ id, icon: icon(ic), label: t(key), price: price || undefined, cant: price > this.coins });
    const items = [opt('color', 'paint', 'pen.color'), opt('rename', 'dice', 'pen.rename')];
    items.push(opt('empty', 'empty', 'pen.empty'));
    const header = '';
    this.hud.showMenu(s.x, s.y, pen.name, items, id => {
      if (id === 'color') {
        // tien kleuren die bij dit soort hek horen: hout, steen of net
        const colors = FENCE_COLORS[this.grid.penKind(pen.region) as 1 | 3 | 4];
        const swatches: ToolOption[] = colors.map((c, i) => ({ id: String(i), icon: `<span class="swatch" style="background:#${c.toString(16).padStart(6, '0')}"></span>`, label: '', on: i === pen.color }));
        this.hud.showMenu(s.x, s.y, t('pen.color.pick'), swatches, pick => {
          pen.color = Number(pick);
          this.syncWear();
          sfx('paint');
          this.view.flash(pen.region.tiles);
          void this.save();
        });
      } else if (id === 'rename') {
        pen.name = this.pickName('names.pens', this.pens.map(p => p.name));
        this.floatAt(pen.name, pen.cx, pen.cy, 0.6, 'word');
      } else if (this.animalsIn(pen.region.id).length) {
        // leegmaken kan je niet terugdraaien, dus eerst nog even vragen
        this.hud.showMenu(s.x, s.y, t('pen.empty.sure'), [opt('yes', 'check', 'yes'), opt('no', 'cross', 'no')], answer => {
          if (answer === 'yes') for (const a of this.animalsIn(pen.region.id)) this.removeAnimal(a);
        });
      }
    }, header);
  }

  // ------------------------------------------------------------ park
  private troughAt(x: number, y: number): TroughObj | undefined {
    return this.troughs.find(tr => tr.x === x && tr.y === y);
  }

  private bedAt(x: number, y: number): BedObj | undefined {
    return this.beds.find(b => b.x === x && b.y === y);
  }

  private shopAt(x: number, y: number): ShopObj | undefined {
    return this.shops.find(s => !s.edge && x >= s.x && x < s.x + s.size && y >= s.y && y < s.y + s.size);
  }

  /** Het bankje, de bloembak of de afvalbak op deze rand. */
  private edgeItemAt(e: Edge): ShopObj | undefined {
    return this.shops.find(s => s.edge === e.o && s.x === e.x && s.y === e.y);
  }

  /** Aan welke kant van de rand ligt het pad? 1 = zuid of oost, -1 = noord of west, 0 = aan geen of aan beide kanten. */
  private edgeFace(e: Edge): number {
    const isPath = (x: number, y: number): boolean => this.grid.inBounds(x, y) && this.grid.terrain[tileIndex(x, y)] === PATH;
    const before = e.o === 'h' ? isPath(e.x, e.y - 1) : isPath(e.x - 1, e.y), after = isPath(e.x, e.y);
    return before === after ? 0 : after ? 1 : -1;
  }

  /** Mag hier iets op de rand staan? Niet op een hek, niet in of tegen een verblijf of gebouw, en niet dubbel. */
  private edgeFits(e: Edge): boolean {
    if (!this.grid.validEdge(e) || this.grid.getEdge(e) !== 0 || this.edgeItemAt(e)) return false;
    const sides = edgeSides({ x: e.x, y: e.y, edge: e.o });
    if (!sides.length) return false;
    return sides.every(i => {
      const [x, y] = tileXY(i);
      return !this.grid.enclosureAt(x, y) && !this.shopAt(x, y) && this.grid.terrain[i] !== WATER;
    });
  }

  /** De rand van tegel (x, y) waar een los ding uit een ouder spel het best past: het liefst langs het pad. */
  private edgeNear(x: number, y: number): Edge | null {
    const options: Edge[] = [{ o: 'h', x, y }, { o: 'h', x, y: y + 1 }, { o: 'v', x, y }, { o: 'v', x: x + 1, y }];
    const fits = options.filter(e => this.edgeFits(e));
    return fits.find(e => this.edgeFace(e) !== 0) ?? fits[0] ?? null;
  }

  /** Naar welke kant iets op een rand kijkt: naar het pad, of juist andersom als de speler het heeft omgedraaid. */
  private faceOf(s: { x: number; y: number; edge?: 'h' | 'v'; turned?: boolean }): number {
    const auto = this.edgeFace({ o: s.edge!, x: s.x, y: s.y }) || 1;
    return s.turned ? -auto : auto;
  }

  /**
   * Naar welke kant een gebouw het best kan kijken: de kant waar het meeste pad tegenaan ligt. Bij gelijk
   * spel het liefst naar het zuiden of oosten, want dan zie je de voorkant. 0 = zuid, 1 = oost, 2 = noord, 3 = west.
   */
  private autoRot(x: number, y: number, size: number): number {
    const isPath = (tx: number, ty: number): number => (this.grid.inBounds(tx, ty) && this.grid.terrain[tileIndex(tx, ty)] === PATH ? 1 : 0);
    const sides = [0, 0, 0, 0];
    for (let i = 0; i < size; i++) {
      sides[0] += isPath(x + i, y + size);
      sides[1] += isPath(x + size, y + i);
      sides[2] += isPath(x + i, y - 1);
      sides[3] += isPath(x - 1, y + i);
    }
    return sides.indexOf(Math.max(...sides));
  }

  /** Het pad is veranderd: bankjes, bakken en gebouwen draaien hun gezicht naar het pad. */
  private faceEdgeItems(): void {
    for (const s of this.shops) {
      if (!s.edge) {
        if (!s.manual) s.rot = this.autoRot(s.x, s.y, s.size);
        this.view.poseShop(s.mesh, s.x, s.y, s.kind, undefined, s.rot ?? 0);
        continue;
      }
      s.face = this.faceOf(s);
      this.view.poseShop(s.mesh, s.x, s.y, s.kind, { o: s.edge, face: s.face });
    }
  }

  /** Een tik met het handje draait een bankje, bloembak of afvalbak om. */
  private turnItem(item: ShopObj): void {
    item.turned = !item.turned || undefined;
    this.faceEdgeItems();
    sfx('place');
    const [x, y] = edgePose(item);
    this.floatAt(icon('sparkle'), x, y, 0.5);
  }

  private taken(x: number, y: number): boolean {
    return !!(this.troughAt(x, y) || this.bedAt(x, y) || this.toyAt(x, y) || this.decorAt(x, y) || this.shopAt(x, y));
  }

  private addTrough(x: number, y: number, food: FoodId | null, amount: number, kind: TroughKind = 'wood'): TroughObj {
    const tr: TroughObj = { x, y, food, amount, kind, mesh: this.view.makeTrough(x, y, kind) };
    this.view.fillTrough(tr.mesh, food, amount);
    this.troughs.push(tr);
    return tr;
  }

  private decorAt(x: number, y: number): DecorObj | undefined {
    return this.decors.find(b => b.x === x && b.y === y);
  }

  private addDecor(x: number, y: number, kind: DecorKind): DecorObj {
    const decor: DecorObj = { x, y, kind, mesh: this.view.makeDecor(x, y, kind) };
    this.decors.push(decor);
    return decor;
  }

  /** Een versiering mag op een vrije tegel buiten de verblijven, niet op het pad of in het water. */
  private decorFits(x: number, y: number): boolean {
    if (!this.grid.inBounds(x, y) || this.grid.enclosureAt(x, y) || this.taken(x, y)) return false;
    const terrain = this.grid.terrain[tileIndex(x, y)];
    return terrain !== PATH && terrain !== WATER;
  }

  private placeDecor(x: number, y: number): void {
    const kind = this.option.decor as DecorKind;
    if (!this.decorFits(x, y)) return this.nope(x + 0.5, y + 0.5);
    if (!this.pay(DECOR[kind].price, x + 0.5, y + 0.5)) return;
    this.addDecor(x, y, kind);
    this.uncover(x, y);
    sfx('place');
    this.floatAt(icon('sparkle'), x + 0.5, y + 0.5, 0.6);
    this.backToHand();
  }

  /** Versieringen binnen twee tegels maken een gast een beetje blijer; meer dan drie telt niet extra. */
  charm(tile: number): number {
    const [x, y] = tileXY(tile);
    let near = 0;
    for (const d of this.decors) if (Math.abs(d.x - x) <= 2 && Math.abs(d.y - y) <= 2) near++;
    return Math.min(3, near) * 0.015;
  }

  private toyAt(x: number, y: number): ToyObj | undefined {
    return this.toys.find(b => b.x === x && b.y === y);
  }

  private addToy(x: number, y: number, kind: ToyKind): ToyObj {
    const toy: ToyObj = { x, y, kind, mesh: this.view.makeToy(x, y, kind) };
    this.toys.push(toy);
    return toy;
  }

  playWith(toy: { x: number; y: number }, seconds: number): void {
    const obj = this.toyAt(toy.x, toy.y);
    if (obj) obj.playUntil = this.clock + seconds;
  }

  /** Speelgoed waar een dier mee speelt, beweegt: de bal stuitert, de struik ritselt, de stam wiebelt, de bloemen wuiven. */
  private animateToys(): void {
    for (const toy of this.toys) {
      const m = toy.mesh;
      if (toy.playUntil === undefined) continue;
      if (this.clock > toy.playUntil) {
        toy.playUntil = undefined;
        m.position.y = 0;
        m.rotation.set(0, 0, 0);
        m.scale.set(1, 1, 1);
        continue;
      }
      const t = this.clock;
      if (toy.kind === 'ball') {
        m.position.y = Math.abs(Math.sin(t * 6)) * 0.28;
        m.rotation.y = t * 3;
      } else if (toy.kind === 'bush') {
        m.rotation.z = Math.sin(t * 16) * 0.07;
        m.scale.y = 1 + Math.sin(t * 9) * 0.05;
      } else if (toy.kind === 'log') {
        m.rotation.z = Math.sin(t * 5) * 0.13;
        m.position.y = Math.abs(Math.sin(t * 5)) * 0.04;
      } else {
        m.rotation.y = Math.sin(t * 4) * 0.18;
        m.scale.y = 1 + Math.sin(t * 8) * 0.07;
      }
    }
  }

  /** Vanaf level 10 willen dieren iets leuks in hun verblijf. */
  wantsFun(): boolean {
    return this.has('fun');
  }

  private addBed(x: number, y: number, kind: BedKind): BedObj {
    const bed: BedObj = { x, y, kind, mesh: this.view.makeBed(x, y, kind) };
    this.beds.push(bed);
    return bed;
  }

  private addShop(x: number, y: number, kind: ShopKind, sells?: string[], edge?: 'h' | 'v', turned?: boolean, rot?: number, manual?: boolean): ShopObj {
    const face = edge ? this.faceOf({ x, y, edge, turned }) : undefined;
    // een gebouw kijkt vanzelf naar het pad, tenzij de speler het zelf heeft gedraaid
    const turn = edge ? undefined : rot ?? this.autoRot(x, y, SHOP_SIZE[kind]);
    const shop: ShopObj = {
      x, y, kind, size: SHOP_SIZE[kind], sells: sells?.length ? [...sells] : this.products(kind).slice(0, slotsOf(kind)),
      mesh: this.view.makeShop(x, y, kind, edge && { o: edge, face: face! }, turn), vendor: Vendor.of(kind), edge, face, turned: turned || undefined, rot: turn, manual: manual || undefined,
    };
    if (shop.vendor) shop.mesh.add(shop.vendor.mesh);
    this.shops.push(shop);
    return shop;
  }

  private addAnimal(species: SpeciesId, variant: Variant, gx: number, gy: number, name?: string): Animal {
    const a = new Animal(species, variant, gx, gy);
    a.name = name || this.animalName(a);
    this.view.scene.add(a.model.root);
    this.animals.push(a);
    this.bubbles.set(a, this.hud.makeBubble());
    return a;
  }

  private animalName(a: Animal): string {
    return this.pickName(sexOf(a) === 'male' ? 'names.boys' : 'names.girls', this.animals.map(x => x.name));
  }

  private removeAnimal(a: Animal): void {
    this.view.scene.remove(a.model.root);
    this.bubbles.get(a)?.remove();
    this.bubbles.delete(a);
    this.unmet.delete(a);
    this.reacted.delete(a);
    if (this.moving === a) this.moving = null;
    this.animals = this.animals.filter(x => x !== a);
  }

  private animalsIn(regionId: number): Animal[] {
    return this.animals.filter(a => this.grid.regionOf[a.tile] === regionId);
  }

  private regionAt(p: { gx: number; gy: number }): number {
    return this.grid.regionOf[tileIndex(Math.floor(p.gx), Math.floor(p.gy))];
  }

  poopsOf(regionId: number): PoopObj[] {
    return this.poops.filter(p => this.regionAt(p) === regionId);
  }

  poopsIn(regionId: number): number {
    return this.poopsOf(regionId).length;
  }

  /** De voerbakken van een verblijf, met het voer dat de dieren daar lusten (voor de verzorger). */
  troughsOf(regionId: number): { trough: TroughObj; food: FoodId | null }[] {
    const foods = [...new Set(this.animalsIn(regionId).map(a => SPECIES[a.species].food))];
    return this.troughs
      .filter(tr => this.grid.regionOf[tileIndex(tr.x, tr.y)] === regionId)
      .map((trough, i) => ({ trough, food: foods.length ? foods[i % foods.length] : null }));
  }

  keeperClean(poop: KeeperPoop): void {
    const p = poop as PoopObj;
    this.view.scene.remove(p.mesh);
    this.poops = this.poops.filter(x => x !== p);
    this.floatAt(icon('sparkle'), p.gx, p.gy, 0.2);
  }

  keeperFill(trough: KeeperTrough, food: FoodId): void {
    const tr = trough as TroughObj;
    tr.food = food;
    tr.amount = TROUGH[tr.kind].portions;
    this.view.fillTrough(tr.mesh, food, tr.amount);
    this.floatAt(icon(food), tr.x + 0.5, tr.y + 0.5, 0.6);
  }

  /**
   * Een plek naast een slaapplek of voerbak: daaronder zou je een poepje niet zien. Geeft het punt zelf
   * terug als de tegel vrij is, anders het dichtstbijzijnde punt op een vrije tegel ernaast.
   */
  private clearSpot(gx: number, gy: number): [number, number] {
    const x = Math.floor(gx), y = Math.floor(gy);
    if (!this.grid.inBounds(x, y) || !this.taken(x, y)) return [gx, gy];
    let best: [number, number] | null = null, bestD = Infinity;
    for (const [dx, dy] of [[0, 1], [1, 0], [0, -1], [-1, 0], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      const tx = x + dx, ty = y + dy;
      if (!this.grid.inBounds(tx, ty) || this.taken(tx, ty) || this.grid.regionOf[tileIndex(tx, ty)] !== this.grid.regionOf[tileIndex(x, y)]) continue;
      const px = Math.max(tx + 0.25, Math.min(tx + 0.75, gx)), py = Math.max(ty + 0.25, Math.min(ty + 0.75, gy));
      const d = Math.hypot(px - gx, py - gy);
      if (d < bestD) {
        bestD = d;
        best = [px, py];
      }
    }
    return best ?? [gx, gy];
  }

  /** Er is iets neergezet op deze tegel: poepjes die daar lagen schuiven ernaast. */
  private uncover(x: number, y: number): void {
    for (const p of this.poops) {
      if (Math.floor(p.gx) !== x || Math.floor(p.gy) !== y) continue;
      [p.gx, p.gy] = this.clearSpot(p.gx, p.gy);
      p.mesh.position.set(toWorldX(p.gx), 0, toWorldZ(p.gy));
    }
  }

  dropPoop(gx: number, gy: number): void {
    [gx, gy] = this.clearSpot(gx, gy);
    const mesh = spawnStatic('poop');
    mesh.scale.setScalar(MODEL_SCALE * 0.9);
    mesh.position.set(toWorldX(gx), 0, toWorldZ(gy));
    this.view.scene.add(mesh);
    this.poops.push({ gx, gy, mesh });
  }

  poopRate(): number {
    return this.goalOpen('cleaned') ? 4 : 1;
  }

  dropPuddle(gx: number, gy: number): void {
    this.puddles.push({ mesh: this.view.makePuddle(gx, gy), life: 14 });
  }

  ate(trough: Trough): void {
    const tr = trough as TroughObj;
    tr.amount = Math.max(0, tr.amount - 1);
    this.view.fillTrough(tr.mesh, tr.food, tr.amount);
    this.pulse(tr.mesh.group, 0.12, 0.5);
  }

  private floatAt(html: string, gx: number, gy: number, height = 0.4, cls = ''): void {
    const s = this.view.toScreen(gx, gy, height);
    this.hud.float(html, s.x, s.y, cls);
  }

  /** Dat kan hier niet: een kruisje en een geluidje. */
  private nope(gx: number, gy: number, height = 0.4): void {
    this.floatAt(icon('cross'), gx, gy, height);
    sfx('nope', { every: 0.3 });
  }

  /** Het dier laat met een smiley zien wat het ervan vindt: groen, oranje of rood. */
  private react(a: Animal, verdict: Verdict, force = false): void {
    if (!force && this.clock - (this.reacted.get(a) ?? -9) < 1) return;
    this.reacted.set(a, this.clock);
    this.floatAt(icon(`smile_${verdict}`), a.gx, a.gy, a.top + 0.25);
  }

  /** Mag er op deze tegel een dier staan? */
  private canHost(x: number, y: number, mover?: Animal): boolean {
    const region = this.grid.enclosureAt(x, y);
    if (!region || this.troughAt(x, y)) return false;
    if ((this.penAt(x, y)?.closedUntil ?? 0) > this.clock) return false;
    return this.animalsIn(region.id).filter(a => a !== mover && !a.young).length < penCap(region);
  }

  private placeTrough(x: number, y: number): void {
    const region = this.grid.enclosureAt(x, y);
    if (!region) return this.nope(x + 0.5, y + 0.5);
    const kind = this.option.trough as TroughKind;
    if (this.taken(x, y) || !this.pay(TROUGH[kind].price, x + 0.5, y + 0.5)) return;
    this.addTrough(x, y, null, 0, kind);
    this.uncover(x, y);
    sfx('place');
    this.floatAt(icon('sparkle'), x + 0.5, y + 0.5);
    for (const a of this.animalsIn(region.id)) this.react(a, 'good');
    this.backToHand();
  }

  /**
   * Na het neerzetten van een voerbak, slaapplek, winkel of dier staat het handje weer aan, zodat een
   * volgende tik niet per ongeluk nog iets koopt. Hek, ondergrond en de gum blijven aan: daar veeg je mee.
   */
  private backToHand(): void {
    const from = this.tool;
    this.selectTool('hand');
    // de rij met dieren of winkels blijft open staan, zodat je er zo nog een kiest
    this.linger = from;
    this.refreshTools(true);
  }

  private placeBed(x: number, y: number): void {
    const region = this.grid.enclosureAt(x, y);
    if (!region) return this.nope(x + 0.5, y + 0.5);
    if (this.taken(x, y) || !this.pay(PRICE.bed, x + 0.5, y + 0.5)) return;
    const kind = this.option.bed as BedKind;
    this.addBed(x, y, kind);
    this.uncover(x, y);
    sfx('place');
    this.floatAt(icon('sparkle'), x + 0.5, y + 0.5);
    for (const a of this.animalsIn(region.id)) this.react(a, SPECIES[a.species].bed === kind ? 'good' : 'ok');
    this.backToHand();
  }

  /** Speelgoed of een plant in een verblijf: daar worden alle dieren in dat verblijf blij van. */
  private placeToy(x: number, y: number): void {
    const region = this.grid.enclosureAt(x, y);
    if (!region) return this.nope(x + 0.5, y + 0.5);
    if (this.taken(x, y) || !this.pay(PRICE.toy, x + 0.5, y + 0.5)) return;
    this.addToy(x, y, this.option.toy as ToyKind);
    this.uncover(x, y);
    sfx('place');
    this.floatAt(icon('sparkle'), x + 0.5, y + 0.5);
    // de dieren voor wie dit het lievelingsding is, zijn er meteen blij mee
    for (const a of this.animalsIn(region.id)) {
      if (TOY_OF[a.species] !== this.option.toy) continue;
      a.emote('Play', 2);
      this.react(a, 'good');
    }
    this.backToHand();
  }

  /** Een winkel mag overal buiten de verblijven staan, behalve op het pad of in het water. Een gebouw heeft 2 bij 2 tegels nodig. */
  private shopFits(x: number, y: number, kind: ShopKind): boolean {
    for (let ty = y; ty < y + SHOP_SIZE[kind]; ty++)
      for (let tx = x; tx < x + SHOP_SIZE[kind]; tx++) {
        if (!this.grid.inBounds(tx, ty) || this.grid.enclosureAt(tx, ty) || this.taken(tx, ty)) return false;
        const terrain = this.grid.terrain[tileIndex(tx, ty)];
        if (terrain === PATH || terrain === WATER) return false;
      }
    return true;
  }

  /** De tegels rondom een blok van `size` bij `size` tegels. */
  private around(x: number, y: number, size: number): number[] {
    const out: number[] = [];
    for (let i = 0; i < size; i++)
      for (const [tx, ty] of [[x + i, y - 1], [x + i, y + size], [x - 1, y + i], [x + size, y + i]]) if (this.grid.inBounds(tx, ty)) out.push(tileIndex(tx, ty));
    return out;
  }

  /** Ligt er pad tegen dit blok van `size` bij `size` tegels aan? Dan kunnen gasten erbij. */
  private touchesPath(x: number, y: number, size: number): boolean {
    for (let ty = y; ty < y + size; ty++)
      for (let tx = x; tx < x + size; tx++) if (this.grid.neighbors(tileIndex(tx, ty)).some(i => this.grid.terrain[i] === PATH)) return true;
    return false;
  }

  /** De linkerbovenhoek van een winkel die je onder de vinger neerzet: een gebouw komt met zijn midden onder de vinger. */
  private shopAnchor(g: { gx: number; gy: number }, kind: ShopKind): [number, number] {
    return SHOP_SIZE[kind] === 1 ? [Math.floor(g.gx), Math.floor(g.gy)] : [Math.round(g.gx) - 1, Math.round(g.gy) - 1];
  }

  /** Een bankje, bloembak of afvalbak zet je op een rand, net als een hek. */
  private placeOnEdge(e: Edge | null): void {
    const kind = this.option.shop as ShopKind;
    if (!e) return;
    const [cx, cy] = shopCenter({ x: e.x, y: e.y, kind, size: 1, sells: [], edge: e.o });
    if (!this.edgeFits(e)) return this.nope(cx, cy);
    if (!this.pay(SHOP_PRICE[kind], cx, cy)) return;
    this.addShop(e.x, e.y, kind, undefined, e.o);
    sfx('place');
    this.floatAt(icon('sparkle'), cx, cy, 0.5);
    this.backToHand();
  }

  private placeShop(x: number, y: number): void {
    const kind = this.option.shop as ShopKind;
    const cx = x + SHOP_SIZE[kind] / 2, cy = y + SHOP_SIZE[kind] / 2;
    if (!this.shopFits(x, y, kind)) return this.nope(cx, cy);
    if (!this.pay(SHOP_PRICE[kind], cx, cy)) return;
    this.addShop(x, y, kind);
    sfx('place');
    this.floatAt(icon('sparkle'), cx, cy, 0.8);
    this.backToHand();
  }

  /** Tik op een kraam: kies wat hij verkoopt. Er passen maar een paar dingen tegelijk in; een keuze te veel vervangt de oudste. */
  private shopMenu(shop: ShopObj): void {
    const options = [...new Set([...this.products(shop.kind), ...shop.sells])];
    const s = this.view.toScreen(shop.x + shop.size / 2, shop.y + shop.size / 2, 1.5);
    const items: ToolOption[] = [
      { id: '__turn', icon: icon('turn'), label: t('shop.turn') },
      ...options.map(id => ({ id, icon: this.productIcon(id), label: this.productName(id), on: shop.sells.includes(id) })),
    ];
    this.hud.showMenu(s.x, s.y, t(`shop.${shop.kind}`), items, id => {
      if (id === '__turn') {
        // een kwartslag draaien; daarna draait het gebouw niet meer vanzelf
        shop.rot = ((shop.rot ?? 0) + 1) % 4;
        shop.manual = true;
        this.view.poseShop(shop.mesh, shop.x, shop.y, shop.kind, undefined, shop.rot);
        sfx('place');
        return this.shopMenu(shop);
      }
      if (!shop.sells.includes(id)) shop.sells = [...shop.sells, id].slice(-slotsOf(shop.kind));
      else if (shop.sells.length > 1) shop.sells = shop.sells.filter(k => k !== id);
      shop.vendor?.sold();
      sfx('place');
      this.shopMenu(shop);
    }, options.length ? `<b class="ask">${t('shop.sells')}</b>` : '');
  }

  private placeAnimal(x: number, y: number): void {
    const species = this.option.animal as SpeciesId;
    if (!species) return;
    if (!this.canHost(x, y)) return this.nope(x + 0.5, y + 0.5);
    if (!this.pay(SPECIES[species].cost, x + 0.5, y + 0.5)) return;
    const region = this.grid.enclosureAt(x, y)!;
    for (const a of this.animalsIn(region.id)) if (a.species === species) this.react(a, 'good');
    const a = this.addAnimal(species, this.option.sex as Sex, x + 0.5, y + 0.5);
    animalSound(a.species, a.young);
    this.floatAt(a.name, a.gx, a.gy, a.top + 0.2, `word ${sexOf(a) === 'male' ? 'boy' : 'girl'}`);
    // past het dier wel, maar is het verblijf te klein? Dat zie en hoor je meteen
    if ((SPACE[species] ?? 0) > region.tiles.length) {
      this.floatAt(icon('grow'), a.gx, a.gy, a.top + 0.8);
      this.sayNow(wishLine(t, 'space', species, null, false));
    }
    this.backToHand();
  }

  /** Voer in de bak doen. Lust geen enkel dier in het verblijf het, dan gaat het er niet in. */
  feed(tr: TroughObj, food: FoodId): void {
    const here = this.animalsIn(this.grid.regionOf[tileIndex(tr.x, tr.y)]);
    const fans = here.filter(a => SPECIES[a.species].food === food);
    if (here.length && !fans.length) {
      for (const a of here) {
        a.emote('Sad', 1.8);
        this.react(a, 'bad', true);
      }
      this.sayNow(say.wrongFood(t, here[0].species));
      return this.nope(tr.x + 0.5, tr.y + 0.5, 0.6);
    }
    // bijvullen van een bak die al vol zit met dit voer telt niet mee voor het doel
    const wasFull = tr.food === food && tr.amount >= TROUGH[tr.kind].portions;
    tr.food = food;
    tr.amount = TROUGH[tr.kind].portions;
    this.view.fillTrough(tr.mesh, food, tr.amount);
    sfx('pour');
    this.floatAt(icon(food), tr.x + 0.5, tr.y + 0.5, 0.6);
    if (!fans.length) return;
    if (!wasFull) this.fed++;
    for (const a of fans) {
      a.emote('Happy', 1.2);
      this.react(a, 'good', true);
    }
  }

  /** Opruimen levert een munt op: zo is er altijd een manier om iets te verdienen. */
  private cleanPoop(p: PoopObj): void {
    const region = this.regionAt(p);
    this.view.scene.remove(p.mesh);
    this.poops = this.poops.filter(x => x !== p);
    this.cleaned++;
    sfx('sweep', { every: 0.1 });
    this.floatAt(icon('sparkle'), p.gx, p.gy, 0.2);
    this.earn(1, p.gx, p.gy);
    for (const a of this.animalsIn(region)) this.react(a, 'good');
  }

  cleanLitter(p: PoopObj): void {
    this.view.scene.remove(p.mesh);
    this.litter = this.litter.filter(x => x !== p);
    this.tidied++;
    sfx('sweep', { every: 0.1 });
    this.floatAt(icon('sparkle'), p.gx, p.gy, 0.2);
    this.earn(1, p.gx, p.gy);
  }

  /** Te lang verwaarloosd: de verzorger haalt het dier op en het verblijf gaat even dicht. */
  private takeAway(a: Animal): void {
    const [x, y] = tileXY(a.tile);
    const pen = this.penAt(x, y);
    this.floatAt(icon('smile_bad'), a.gx, a.gy, a.top + 0.25);
    const species = a.species;
    this.removeAnimal(a);
    if (pen) pen.closedUntil = this.clock + PEN_CLOSED_SECONDS;
    this.lines = [];
    sfx('sad');
    this.sayNow(say.taken(t, species));
    // wie het niet meer bijhoudt, krijgt de tip om hulp aan te nemen
    if (this.has('keeper') && !this.workers.length) this.lines.push(say.tipKeeper());
  }

  /**
   * Een blije jongen en een blij meisje van dezelfde soort krijgen na een poosje een jong.
   * Zijn er al twee jongen, dan is de oudste groot genoeg en verhuist naar een andere dierentuin.
   */
  private checkBirths(): void {
    for (const pen of this.pens) {
      if (pen.closedUntil) continue;
      const here = this.animalsIn(pen.region.id);
      for (const sp of new Set(here.map(a => a.species))) {
        const same = here.filter(a => a.species === sp);
        const mother = same.find(a => a.variant === 'female' && a.happy);
        if (!mother || !same.some(a => a.variant === 'male' && a.happy)) {
          pen.love[sp] = Math.min(pen.love[sp] ?? 0, 0);
          if (pen.love[sp] < 0) pen.love[sp] += 0.4;
          continue;
        }
        pen.love[sp] = (pen.love[sp] ?? 0) + 0.4;
        if (pen.love[sp] < BIRTH_SECONDS) continue;
        pen.love[sp] = -40; // even rust voor het volgende jong
        const young = same.filter(a => a.young);
        if (young.length >= 2) {
          const grown = young[0];
          this.mention(say.grown(grown.name));
          this.earn(2, grown.gx, grown.gy);
          this.removeAnimal(grown);
        }
        const baby = this.addAnimal(sp, Math.random() < 0.5 ? 'young_m' : 'young_f', mother.gx, mother.gy);
        baby.hunger = 0.2;
        this.born++;
        this.earn(1);
        sfx('born');
        this.floatAt(icon('born'), baby.gx, baby.gy, baby.top + 0.4);
        this.floatAt(baby.name, baby.gx, baby.gy, baby.top + 0.1, `word ${sexOf(baby) === 'male' ? 'boy' : 'girl'}`);
        this.mention(say.born(baby.name));
      }
    }
  }

  // ------------------------------------------------------------ ziek en ontsnapt
  /** Een dier wordt ziek. Een dier dat het al niet naar zijn zin heeft, is eerder aan de beurt. */
  private makeSick(): void {
    const inPens = this.animals.filter(a => !a.sick && !a.escaped && this.grid.enclosureAt(...tileXY(a.tile)));
    if (!inPens.length) return;
    const sad = inPens.filter(a => !a.happy);
    const from = sad.length && Math.random() < 0.6 ? sad : inPens;
    const a = from[Math.floor(Math.random() * from.length)];
    a.fallIll();
    sfx('alarm');
    this.floatAt(icon('sick'), a.gx, a.gy, a.top + 0.25);
    if (!this.celebrating) this.sayNow(say.sick(t, a.species));
  }

  private heal(a: Animal): void {
    a.heal();
    this.healed++;
    sfx('heal');
    this.floatAt(icon('heart'), a.gx, a.gy, a.top + 0.2);
    this.sayNow(say.healed());
  }

  /** Een dier springt uit zijn verblijf en loopt buiten rond tot je het terugzet. */
  private letEscape(): void {
    const options = this.animals.filter(a => !a.sick && !a.escaped && this.grid.enclosureAt(...tileXY(a.tile)));
    const sad = options.filter(a => !a.happy);
    const from = sad.length && Math.random() < 0.6 ? sad : options;
    const a = from[Math.floor(Math.random() * from.length)];
    if (!a) return;
    const region = this.grid.enclosureAt(...tileXY(a.tile))!;
    const inside = new Set(region.tiles);
    const outside: [number, number][] = [];
    for (const i of region.tiles) {
      const [x, y] = tileXY(i);
      for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
        const nx = x + dx, ny = y + dy;
        if (this.grid.inBounds(nx, ny) && !inside.has(tileIndex(nx, ny)) && !this.grid.enclosureAt(nx, ny) && !this.taken(nx, ny)) outside.push([nx, ny]);
      }
    }
    if (!outside.length) return;
    const [x, y] = outside[Math.floor(Math.random() * outside.length)];
    a.escape(x + 0.5, y + 0.5);
    sfx('alarm');
    animalSound(a.species, a.young);
    this.floatAt(icon('catch'), a.gx, a.gy, a.top + 0.25);
    if (!this.celebrating) {
      this.sayNow(say.escaped(t, a.species));
      this.callForHelp('name.help.2');
    }
  }

  private events(dt: number): void {
    if (this.has('sick')) {
      // vraagt het level erom, dan hoef je er niet lang op te wachten
      if (this.goalOpen('healed')) this.sickIn = Math.min(this.sickIn, SICK_FOR_GOAL[1]);
      this.sickIn -= dt;
      if (this.sickIn <= 0) {
        this.sickIn = between(this.goalOpen('healed') ? SICK_FOR_GOAL : SICK_EVERY);
        if (!this.animals.some(a => a.sick)) this.makeSick();
      }
    }
    if (this.has('escape')) {
      if (this.goalOpen('caught')) this.escapeIn = Math.min(this.escapeIn, ESCAPE_FOR_GOAL[1]);
      this.escapeIn -= dt;
      if (this.escapeIn <= 0) {
        this.escapeIn = between(this.goalOpen('caught') ? ESCAPE_FOR_GOAL : ESCAPE_EVERY);
        if (!this.animals.some(a => a.escaped)) this.letEscape();
      }
    }
    // af en toe laat een dier zich horen
    this.chatterIn -= dt;
    if (this.chatterIn <= 0) {
      this.chatterIn = 7 + Math.random() * 9;
      const a = this.animals[Math.floor(Math.random() * this.animals.length)];
      if (a && !a.sleeping) animalSound(a.species, a.young, 0.4);
    }
    // gasten: geroezemoes dat meegroeit met de drukte, en af en toe een lachje of een 'wauw'
    const crowd = this.guests.guests.length;
    layer('crowd.small', crowd ? Math.min(1, crowd / 8) * (crowd > 14 ? 0.3 : 0.55) : 0);
    layer('crowd.big', crowd > 10 ? Math.min(1, (crowd - 10) / 14) * 0.55 : 0);
    if (this.has('wear')) {
      this.wearIn -= dt;
      if (this.wearIn <= 0) {
        this.wearIn = 50 + Math.random() * 40;
        this.wearFence();
      }
    }
    this.shuffleIn -= dt;
    if (this.shuffleIn <= 0) {
      this.shuffleIn = 60 + Math.random() * 40;
      reshuffle(Math.random() < 0.5 ? 'crowd.small' : 'crowd.big');
    }
    this.babbleIn -= dt;
    if (this.babbleIn <= 0) {
      this.babbleIn = 5 + Math.random() * 9;
      // kinderen hoor je het vaakst
      if (crowd && Math.random() < Math.min(1, crowd / 10)) sfx(Math.random() < 0.7 ? 'guest.kid' : 'guest.chat', { volume: 0.3, every: 2 });
    }
  }

  private wishIcon(a: Animal, wish: WishId): string {
    const info = SPECIES[a.species];
    switch (wish) {
      case 'health': return icon('sick');
      case 'enclosure': return icon(a.needsFence ? NEED_ICON[a.needsFence] : a.fenceBroken ? 'hammer' : 'fence');
      case 'food': return icon(info.food);
      case 'bed': return icon(info.bed);
      case 'fun': return icon(TOY_OF[a.species] ?? 'ball');
      case 'space': return icon('grow');
      case 'terrain': return icon(info.terrain);
      // bij een groepsdier staat erbij hoeveel er nog bij moeten
      case 'friend': return speciesIcon(a.species) + (a.lonely > 1 ? `<i class="count">+${a.lonely}</i>` : icon('plus', 'badge'));
      case 'clean': return icon('poop');
    }
  }

  // ------------------------------------------------------------ menu's
  /** Het voer dat de dieren in dit verblijf lusten staat vooraan. */
  private foodOptions(wanted: FoodId[] = []): ToolOption[] {
    const list = this.foodList();
    // altijd dezelfde volgorde, zodat je weet waar elk voer staat; het voer dat de dieren hier lusten is omlijnd
    return list.map(f => ({ id: f, icon: icon(f), label: t(`food.${f}`), on: wanted.includes(f) }));
  }

  private troughMenu(tr: TroughObj): void {
    const s = this.view.toScreen(tr.x + 0.5, tr.y + 0.5, 0.3);
    // in een grote bak of silo passen te veel porties om allemaal te tekenen: dan staat er een getal bij
    const inside = tr.food && tr.amount ? (tr.amount > 4 ? `${icon(tr.food)}<b>${tr.amount}</b>` : icon(tr.food).repeat(tr.amount)) : icon(TROUGH_ICON[tr.kind]);
    const wanted = this.animalsIn(this.grid.regionOf[tileIndex(tr.x, tr.y)]).map(a => SPECIES[a.species].food);
    this.hud.showMenu(s.x, s.y, t('tool.trough'), this.foodOptions(wanted), id => this.feed(tr, id as FoodId), inside);
  }

  private animalMenu(a: Animal): void {
    const s = this.view.toScreen(a.gx, a.gy, a.top);
    const wishes = a.checkWishes(this);
    const header =
      icon(sexOf(a) === 'male' ? 'boy' : 'girl') +
      WISH_ORDER.filter(k => (k !== 'health' || a.sick) && (k !== 'fun' || (this.has('fun') && !!TOY_OF[a.species])) && (k !== 'space' || !!SPACE[a.species])).map(k => `<span class="wish ${wishes[k] ? 'ok' : 'no'}">${this.wishIcon(a, k)}</span>`).join('');
    const opt = (id: string, ic: IconId, key: string): ToolOption => ({ id, icon: icon(ic), label: t(key) });
    const items = [opt('pet', 'pet', 'animal.pet'), opt('feed', 'feed', 'animal.feed'), opt('rename', 'dice', 'animal.rename'), opt('sedate', 'sleep', 'animal.sedate'), opt('move', 'move', 'animal.move'), opt('away', 'empty', 'animal.away')];
    if (a.sick) items.unshift(opt('vet', 'vet', 'animal.vet'));
    animalSound(a.species, a.young, 0.8);
    this.hud.showMenu(s.x, s.y, a.name, items, id => {
      if (id === 'vet') {
        this.heal(a);
      } else if (id === 'pet') {
        a.emote('Happy', 1.4);
        animalSound(a.species, a.young);
        this.floatAt(icon('heart'), a.gx, a.gy, a.top + 0.2);
      } else if (id === 'feed') {
        this.hud.showMenu(s.x, s.y, t('animal.feed'), this.foodOptions([SPECIES[a.species].food]), food => this.handFeed(a, food as FoodId));
      } else if (id === 'rename') {
        a.name = this.animalName(a);
        this.floatAt(a.name, a.gx, a.gy, a.top + 0.2, 'word');
      } else if (id === 'sedate') {
        a.sedate(20);
        this.floatAt(icon('sleep'), a.gx, a.gy, a.top + 0.2);
      } else if (id === 'away') {
        this.askAway(a);
      } else {
        this.moving = a;
      }
    }, header);
  }

  /**
   * Een dier laten verhuizen naar een andere dierentuin. Dat kun je niet terugdraaien, dus eerst even
   * vragen. Je krijgt de helft van de prijs terug; voor een jong dat hier geboren is, één munt.
   */
  private askAway(a: Animal): void {
    const s = this.view.toScreen(a.gx, a.gy, a.top);
    const back = a.young ? 1 : refund(SPECIES[a.species].cost);
    const yes: ToolOption = { id: 'yes', icon: icon('check'), label: t('yes'), gain: back || undefined };
    this.hud.showMenu(s.x, s.y, t('animal.away.sure', { name: a.name }), [yes, { id: 'no', icon: icon('cross'), label: t('no') }], answer => {
      if (answer !== 'yes' || !this.animals.includes(a)) return;
      animalSound(a.species, a.young);
      sfx('erase');
      this.floatAt(icon('empty'), a.gx, a.gy, a.top + 0.2);
      if (back) this.earn(back, a.gx, a.gy);
      const name = a.name;
      this.removeAnimal(a);
      this.sayNow(say.moved(name));
    });
  }

  /** De knop 'dier in nood': het beeld schuift naar het dier dat het hardst hulp nodig heeft en dat licht op. */
  private gotoNeed(index: number): void {
    const a = this.needy[index];
    if (!a) return;
    this.marked = { a, until: this.clock + 8 };
    this.view.flyTo(a.gx, a.gy);
    animalSound(a.species, a.young, 0.8);
  }

  /** Bij een gast zie je hoe het gaat, wat zijn lievelingsdier is en wat hij nu wil. */
  private guestMenu(guest: Guest): void {
    const s = this.view.toScreen(guest.gx, guest.gy, guest.height);
    const want = (on: boolean, ic: IconId): string => (on ? `<span class="wish no">${icon(ic)}</span>` : '');
    const header =
      icon(guest.fun >= 0.55 ? 'smile_good' : guest.fun >= 0.3 ? 'smile_ok' : 'smile_bad') +
      (guest.fav ? `<span class="wish ${guest.favSeen ? 'ok' : 'no'}">${speciesIcon(guest.fav)}${icon('heart', 'badge')}</span>` : '') +
      want(guest.hunger > 0.6, 'foodstall') + want(guest.thirst > 0.6, 'drinkstall') + want(guest.bladder > 0.6, 'toilet') +
      want(guest.treat > 0.7, 'icecream') + want(guest.balloon > 0.7, 'balloon') + want(guest.tired > 0.75, 'bench') +
      want(guest.gift > 0.7, 'souvenir') + want(guest.playful > 0.7, 'playground') + want(guest.hat > 0.7, 'hats') +
      want(guest.curious > 0.7, 'fountain') + want(guest.rideWish > 0.7, 'carousel');
    this.hud.showMenu(s.x, s.y, t('guest.title'), [{ id: 'wave', icon: icon('hand'), label: t('guest.wave') }], () => {
      if (!guest.waved) guest.fun = Math.min(1, guest.fun + 0.1);
      guest.waved = true;
      this.floatAt(icon('heart'), guest.gx, guest.gy, guest.height + 0.2);
    }, header);
  }

  /** Zelf een dier voeren, zonder voerbak. */
  private handFeed(a: Animal, food: FoodId): void {
    if (SPECIES[a.species].food !== food) {
      a.emote('Sad', 1.6);
      this.react(a, 'bad', true);
      return this.sayNow(say.wrongFood(t, a.species));
    }
    if (!a.hungry) return this.react(a, 'ok', true);
    a.handFeed();
    this.fed++;
    this.react(a, 'good', true);
  }

  // ------------------------------------------------------------ invoer
  private pxPerTile(): number {
    return innerHeight / this.view.zoom;
  }

  private pick<T extends { gx: number; gy: number }>(items: T[], cx: number, cy: number, height: (i: T) => number, radius: number): T | undefined {
    let best: T | undefined;
    let bestD = Math.max(34, radius * this.pxPerTile());
    for (const item of items) {
      const s = this.view.toScreen(item.gx, item.gy, height(item));
      const d = Math.hypot(s.x - cx, s.y - cy);
      if (d < bestD) [best, bestD] = [item, d];
    }
    return best;
  }

  private pickAnimal(cx: number, cy: number, radius = 0.6): Animal | undefined {
    return this.pick(this.animals, cx, cy, a => a.top * 0.45, radius);
  }

  private pickLoose(cx: number, cy: number): Animal | undefined {
    return this.pick(this.animals.filter(a => a.escaped), cx, cy, a => a.top * 0.45, 0.8);
  }

  private pickPoop(cx: number, cy: number): PoopObj | undefined {
    return this.pick(this.poops, cx, cy, () => 0.08, 0.5);
  }

  private pickLitter(cx: number, cy: number): PoopObj | undefined {
    return this.pick(this.litter, cx, cy, () => 0.05, 0.5);
  }

  /** Onder de muis: het voorbeeld van wat je gaat plaatsen en de cursor die bij de handeling hoort. */
  private hover(cx: number, cy: number, dragging: boolean): void {
    this.view.hideGhost();
    if (this.staffGhost) this.staffGhost.worker.mesh.visible = false;
    this.hoverPoop = null;
    this.hoverWorn = null;
    const g = this.view.groundPoint(cx, cy);
    if (!g) return;
    const x = Math.floor(g.gx), y = Math.floor(g.gy);
    const inside = this.grid.inBounds(x, y);
    const free = inside && !this.taken(x, y);
    const animalGhost = (key: string, sex: Sex, ok: boolean) =>
      this.view.ghostAnimal(key, () => spawnModel(key).root, x, y, ok, SEX_COLOR[sex]);

    if (this.moving) {
      const a = this.moving;
      if (inside) animalGhost(`${a.species}_${a.variant}`, sexOf(a), this.canHost(x, y, a));
      return this.hud.setCursor(CUR.move);
    }
    switch (this.tool) {
      case 'terrain': {
        const terrain = this.option.terrain as Terrain;
        if (inside) this.view.ghostTile(x, y, TERRAIN_INFO[terrain].colors[0]);
        return this.hud.setCursor(CUR[terrain]);
      }
      case 'fence': {
        const kind = FENCE_KIND[this.option.fence];
        const L = dragging ? this.line : null;
        const e = L?.axis
          ? L.axis === 'h' ? { o: 'h' as const, x: Math.floor(g.gx), y: L.fixed } : { o: 'v' as const, x: L.fixed, y: Math.floor(g.gy) }
          : nearestEdge(g.gx, g.gy);
        if (e && this.grid.validEdge(e)) this.view.ghostFence(e, kind, kind === 1 ? this.grid.getEdge(e) === 0 : this.grid.getEdge(e) !== kind);
        return this.hud.setCursor(CUR[this.option.fence]);
      }
      case 'trough':
        if (free) this.view.ghostTrough(x, y, !!this.grid.enclosureAt(x, y));
        return this.hud.setCursor(inside && this.troughAt(x, y) ? CUR.feed : CUR.trough);
      case 'bed':
        if (free) this.view.ghostBed(x, y, this.option.bed as BedKind, !!this.grid.enclosureAt(x, y));
        return this.hud.setCursor(CUR[this.option.bed]);
      case 'toy':
        if (free) this.view.ghostToy(x, y, this.option.toy as ToyKind, !!this.grid.enclosureAt(x, y));
        return this.hud.setCursor(CUR[this.option.toy]);
      case 'decor':
        if (inside) this.view.ghostDecor(x, y, this.option.decor as DecorKind, this.decorFits(x, y));
        return this.hud.setCursor(CUR[this.option.decor]);
      case 'staff': {
        const role = this.option.staff as WorkerRole;
        const ok = inside && !this.grid.enclosureAt(x, y) && !this.taken(x, y);
        if (inside) this.view.ghostTile(x, y, ok ? 0x8fd16a : 0xe0584f);
        // een doorzichtige werker hangt spartelend boven de plek tot je hem neerzet
        if (this.staffGhost && this.staffGhost.role !== role) {
          this.view.scene.remove(this.staffGhost.worker.mesh);
          this.staffGhost = null;
        }
        if (!this.staffGhost) {
          const worker = new Worker(0, 0, role).ghost();
          this.view.scene.add(worker.mesh);
          this.staffGhost = { worker, role, gx: 0, gy: 0, ok };
        }
        this.staffGhost.worker.mesh.visible = inside;
        this.staffGhost.gx = x + 0.5;
        this.staffGhost.gy = y + 0.5;
        this.staffGhost.ok = ok;
        return this.hud.setCursor(CUR.staff);
      }
      case 'shop': {
        const kind = this.option.shop as ShopKind;
        if (SHOP_SIZE[kind] === 1) {
          const e = nearestEdge(g.gx, g.gy);
          if (e) this.view.ghostShop(e.x, e.y, kind, this.edgeFits(e), { o: e.o, face: this.edgeFace(e) || 1 });
          return this.hud.setCursor(CUR[this.option.shop]);
        }
        const [ax, ay] = this.shopAnchor(g, kind);
        this.view.ghostShop(ax, ay, kind, this.shopFits(ax, ay, kind), undefined, this.autoRot(ax, ay, SHOP_SIZE[kind]));
        return this.hud.setCursor(CUR[this.option.shop]);
      }
      case 'animal': {
        const sex = this.option.sex as Sex;
        if (inside && this.option.animal) animalGhost(`${this.option.animal}_${sex}`, sex, this.canHost(x, y));
        return this.hud.setCursor(CUR.animal);
      }
      case 'erase': {
        const e = nearestEdge(g.gx, g.gy, 0.3);
        const item = e && this.edgeItemAt(e);
        if (e && this.grid.getEdge(e) !== 0) this.view.ghostFence(e, this.grid.getEdge(e), false);
        else if (item) this.view.ghostShop(item.x, item.y, item.kind, false, { o: item.edge!, face: item.face ?? 1 });
        else if (inside && this.troughAt(x, y)) this.view.ghostTrough(x, y, false);
        else if (inside && this.bedAt(x, y)) this.view.ghostBed(x, y, this.bedAt(x, y)!.kind, false);
        else if (inside && this.toyAt(x, y)) this.view.ghostToy(x, y, this.toyAt(x, y)!.kind, false);
        else if (inside && this.decorAt(x, y)) this.view.ghostDecor(x, y, this.decorAt(x, y)!.kind, false);
        else if (inside && this.shopAt(x, y)) this.view.ghostShop(this.shopAt(x, y)!.x, this.shopAt(x, y)!.y, this.shopAt(x, y)!.kind, false, undefined, this.shopAt(x, y)!.rot ?? 0);
        return this.hud.setCursor(CUR.erase);
      }
      case 'action':
        this.hoverPoop = (this.option.action === 'broom' ? this.pickPoop(cx, cy) : this.option.action === 'picker' ? this.pickLitter(cx, cy) : null) ?? null;
        this.hoverWorn = this.option.action === 'hammer' ? this.wornAt(g.gx, g.gy) : null;
        return this.hud.setCursor(CUR[this.option.action]);
      default:
        if (dragging) return this.hud.setCursor(CUR.grabbing);
        if (this.pickLoose(cx, cy)) return this.hud.setCursor(CUR.catch);
        if (this.pickAnimal(cx, cy)) return this.hud.setCursor(CUR.pet);
        if (this.pick(this.guests.guests, cx, cy, q => q.height * 0.6, 0.4)) return this.hud.setCursor(CUR.menu);
        if (inside && (this.troughAt(x, y) || this.shopAt(x, y))) return this.hud.setCursor(inside && this.troughAt(x, y) ? CUR.feed : CUR.menu);
        if (inside && this.penAt(x, y)) return this.hud.setCursor(CUR.menu);
        return this.hud.setCursor(CUR.grab);
    }
  }

  /** Eén punt van een tik of sleepbeweging. `along` is de sleeprichting; bij een tik is die er niet. */
  private paint(cx: number, cy: number, along?: 'h' | 'v'): void {
    const g = this.view.groundPoint(cx, cy);
    if (!g) return;
    const first = !along;
    const x = Math.floor(g.gx), y = Math.floor(g.gy);
    if (this.tool === 'action') {
      if (this.option.action === 'broom') {
        // vegen: alles waar je overheen gaat is weg
        const poop = this.pickPoop(cx, cy);
        if (poop) this.cleanPoop(poop);
      } else if (this.option.action === 'picker') {
        // prikken: het afval gaat mee tot je op een afvalbak tikt
        const litter = this.pickLitter(cx, cy);
        if (litter) this.pickUp(litter);
      } else {
        const worn = this.wornAt(g.gx, g.gy);
        if (worn) this.repair(worn);
      }
      return;
    }
    if (this.tool === 'terrain') {
      const terrain = this.option.terrain as Terrain;
      // geen pad door een kraam heen
      if (terrain === 'path' && this.grid.inBounds(x, y) && this.shopAt(x, y)) return;
      if (!this.grid.setTerrain(x, y, TERRAINS.indexOf(terrain))) return;
      sfx('paint', { volume: 0.5, every: 0.09 });
      this.view.paintTerrain(this.grid);
      this.faceEdgeItems();
      const region = this.grid.enclosureAt(x, y);
      if (region) for (const a of this.animalsIn(region.id)) this.react(a, SPECIES[a.species].terrain === terrain ? 'good' : 'bad');
    } else if (this.tool === 'fence') {
      const e = along ? edgeAlong(g.gx, g.gy, along) : nearestEdge(g.gx, g.gy);
      if (!e || (along && !this.covered(e, g.gx, g.gy))) return;
      const kind = FENCE_KIND[this.option.fence];
      if (kind === 1 && this.grid.getEdge(e) !== 0) return;
      if (this.grid.setEdge(e, kind)) {
        sfx(FENCE_SOUND[kind], { every: 0.08 });
        this.gridChanged();
      }
    } else if (this.tool === 'erase') {
      const e = along ? edgeAlong(g.gx, g.gy, along, 0.3) : nearestEdge(g.gx, g.gy, 0.3);
      if (e && this.grid.getEdge(e) !== 0 && (!along || this.covered(e, g.gx, g.gy))) {
        this.grid.setEdge(e, 0);
        sfx('erase', { every: 0.08 });
        return this.gridChanged();
      }
      if (first) {
        const animal = this.pickAnimal(cx, cy, 0.45);
        if (animal) return this.askAway(animal);
      }
      if (!first || !this.grid.inBounds(x, y)) return;
      const near = nearestEdge(g.gx, g.gy, 0.3);
      const tr = this.troughAt(x, y), bed = this.bedAt(x, y), shop = (near && this.edgeItemAt(near)) || this.shopAt(x, y), toy = this.toyAt(x, y);
      const decor = !shop ? this.decorAt(x, y) : undefined;
      if (tr || bed || shop || toy || decor) sfx('erase');
      if (decor) {
        this.view.scene.remove(decor.mesh);
        this.decors = this.decors.filter(k => k !== decor);
        this.earn(refund(DECOR[decor.kind].price), x + 0.5, y + 0.5);
        return;
      }
      if (tr) {
        this.view.scene.remove(tr.mesh.group);
        this.troughs = this.troughs.filter(k => k !== tr);
        this.earn(refund(TROUGH[tr.kind].price), x + 0.5, y + 0.5);
        const region = this.grid.enclosureAt(x, y);
        if (region) for (const a of this.animalsIn(region.id)) this.react(a, 'bad');
      } else if (bed) {
        this.view.scene.remove(bed.mesh);
        this.beds = this.beds.filter(k => k !== bed);
      } else if (toy) {
        this.view.scene.remove(toy.mesh);
        this.toys = this.toys.filter(k => k !== toy);
        this.earn(refund(PRICE.toy), x + 0.5, y + 0.5);
      } else if (shop) {
        this.view.scene.remove(shop.mesh);
        shop.warn?.remove();
        this.shops = this.shops.filter(k => k !== shop);
        this.earn(refund(SHOP_PRICE[shop.kind]), ...shopCenter(shop));
      }
    }
  }

  /**
   * Een hek slepen. De eerste beweging bepaalt de richting; daarna blijft het hek op die ene lijn, ook als
   * je vinger wat zwabbert. Ga je meer dan een halve tegel opzij, dan maakt het hek daar een hoek en
   * loopt het in de nieuwe richting verder. Zo teken je een heel verblijf in één beweging.
   */
  private fenceDrag(cx: number, cy: number): void {
    const g = this.view.groundPoint(cx, cy), L = this.line;
    if (!g || !L) return;
    if (!L.axis) {
      const dx = g.gx - L.gx0, dy = g.gy - L.gy0;
      if (Math.hypot(dx, dy) < AXIS_AFTER) return;
      L.axis = Math.abs(dx) >= Math.abs(dy) ? 'h' : 'v';
      // de lijn loopt door de rand waar je begon, of anders over de dichtstbijzijnde rasterlijn
      if (L.axis === 'h') {
        L.fixed = L.e0?.o === 'h' ? L.e0.y : Math.round(L.gy0);
        L.from = L.gx0;
      } else {
        L.fixed = L.e0?.o === 'v' ? L.e0.x : Math.round(L.gx0);
        L.from = L.gy0;
      }
    }
    let at = L.axis === 'h' ? g.gx : g.gy;
    const off = (L.axis === 'h' ? g.gy : g.gx) - L.fixed;
    let changed = false;
    if (Math.abs(off) > TURN_AFTER) {
      // ver genoeg opzij: de hoek om, vanaf het dichtstbijzijnde kruispunt
      const corner = Math.round(at);
      changed = this.fenceRun(L.axis, L.fixed, L.from, corner, true);
      const was = L.fixed;
      L.axis = L.axis === 'h' ? 'v' : 'h';
      L.fixed = corner;
      L.from = was;
      at = was + off;
    }
    changed = this.fenceRun(L.axis, L.fixed, L.from, at, false) || changed;
    if (changed) {
      sfx(FENCE_SOUND[FENCE_KIND[this.option.fence]], { every: 0.08 });
      this.gridChanged();
    }
  }

  /** Zet hek op de lijn van `from` tot `to`. `full`: helemaal tot het kruispunt, anders tot waar de vinger is. */
  private fenceRun(axis: 'h' | 'v', fixed: number, from: number, to: number, full: boolean): boolean {
    const kind = FENCE_KIND[this.option.fence];
    const forward = to >= from;
    const lo = forward ? Math.floor(from) : full ? to : Math.ceil(to - (1 - EDGE_REACH));
    const hi = forward ? (full ? to - 1 : Math.floor(to - EDGE_REACH)) : Math.ceil(from) - 1;
    let changed = false;
    for (let i = lo; i <= hi; i++) {
      const e: Edge = axis === 'h' ? { o: 'h', x: i, y: fixed } : { o: 'v', x: fixed, y: i };
      if (kind === 1 && this.grid.getEdge(e) !== 0) continue;
      if (this.grid.setEdge(e, kind)) changed = true;
    }
    return changed;
  }

  /**
   * Heeft deze sleepbeweging al een flink stuk van de rand afgelegd? Zo komt er geen los stukje hek bij
   * als je net iets te ver doorsleept over een hoek.
   */
  private covered(e: Edge, gx: number, gy: number): boolean {
    const at = e.o === 'h' ? gx - e.x : gy - e.y;
    const key = edgeKey(e);
    const span = this.stroke.get(key) ?? { lo: at, hi: at };
    span.lo = Math.min(span.lo, at);
    span.hi = Math.max(span.hi, at);
    this.stroke.set(key, span);
    return span.hi - span.lo >= 0.3;
  }

  /** Een stukje sleepbeweging, in kleine stapjes zodat een snelle veeg geen tegels overslaat. */
  private paintStroke(x0: number, y0: number, x1: number, y1: number): void {
    const a = this.view.groundPoint(x0, y0), b = this.view.groundPoint(x1, y1);
    if (!a || !b) return;
    const along = Math.abs(b.gx - a.gx) >= Math.abs(b.gy - a.gy) ? 'h' : 'v';
    const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / (this.pxPerTile() * 0.2)));
    for (let i = 1; i <= steps; i++) this.paint(x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps, along);
  }

  private tap(cx: number, cy: number): void {
    const g = this.view.groundPoint(cx, cy);
    const x = g ? Math.floor(g.gx) : -1, y = g ? Math.floor(g.gy) : -1;
    const inside = this.grid.inBounds(x, y);

    if (this.moving) {
      const a = this.moving;
      if (!inside) {
        this.moving = null;
        return;
      }
      if (!this.canHost(x, y, a)) return this.nope(x + 0.5, y + 0.5);
      const wasLoose = a.escaped;
      a.moveTo(x + 0.5, y + 0.5);
      this.moving = null;
      sfx('place');
      this.floatAt(icon('sparkle'), a.gx, a.gy, 0.5);
      if (wasLoose) {
        this.caught++;
        a.emote('Happy', 1.4);
        this.floatAt(icon('heart'), a.gx, a.gy, a.top + 0.2);
        this.sayNow(say.caught());
      }
      return;
    }

    // een ontsnapt dier pak je met één tik op, welke knop er ook aan staat
    const loose = this.pickLoose(cx, cy);
    if (loose) {
      this.moving = loose;
      animalSound(loose.species, loose.young);
      return this.floatAt(icon('catch'), loose.gx, loose.gy, loose.top + 0.2);
    }
    // vegen, afval prikken en hekken timmeren kan alleen met de actieknop. Een tik met iets anders (of met het
    // verkeerde gereedschap) kiest alvast het goede en wijst de knop aan
    const litter = this.pickLitter(cx, cy);
    const mess = this.pickPoop(cx, cy);
    const worn = g ? this.wornAt(g.gx, g.gy) : null;
    const item = g ? this.shops.find(sh => sh.edge && Math.hypot(edgePose(sh)[0] - g.gx, edgePose(sh)[1] - g.gy) < 0.38) : undefined;
    if (this.tool === 'action') {
      // wat je geprikt hebt gaat met een tik in de afvalbak
      if (item?.kind === 'bin' && this.carry) return this.dump(item);
      if (mess) this.pointTo('broom', mess.gx, mess.gy);
      else if (litter) this.pointTo('picker', litter.gx, litter.gy);
      else if (worn && g) this.pointTo('hammer', g.gx, g.gy);
      return;
    }
    if (!this.pickAnimal(cx, cy, 0.35)) {
      if (litter && this.tool === 'hand') return this.pointTo('picker', litter.gx, litter.gy);
      if (mess) return this.pointTo('broom', mess.gx, mess.gy);
    }
    if (this.tool === 'hand' && g) {
      // een tik op een bankje, bloembak of afvalbak draait het om (ook als er iemand op zit)
      if (item && !this.pickAnimal(cx, cy, 0.3)) return item.kind === 'bin' && this.carry ? this.dump(item) : this.turnItem(item);
      if (worn) return this.pointTo('hammer', g.gx, g.gy);
    }
    if (this.tool === 'hand') {
      const animal = this.pickAnimal(cx, cy);
      if (animal) return this.animalMenu(animal);
      const worker = this.pick(this.workers, cx, cy, w => w.height * 0.6, 0.4);
      if (worker) return this.workerMenu(worker);
      const guest = this.pick(this.guests.guests, cx, cy, q => q.height * 0.6, 0.4);
      if (guest) return this.guestMenu(guest);
    }
    if (this.tool === 'shop' && g) {
      const kind = this.option.shop as ShopKind;
      return SHOP_SIZE[kind] === 1 ? this.placeOnEdge(nearestEdge(g.gx, g.gy)) : this.placeShop(...this.shopAnchor(g, kind));
    }
    if (!inside) return;
    const tr = this.troughAt(x, y);
    if (tr) return this.troughMenu(tr);
    const stall = this.shopAt(x, y);
    if (stall && this.tool === 'hand') return this.shopMenu(stall);
    if (this.tool === 'trough') return this.placeTrough(x, y);
    if (this.tool === 'bed') return this.placeBed(x, y);
    if (this.tool === 'toy') return this.placeToy(x, y);
    if (this.tool === 'decor') return this.placeDecor(x, y);
    if (this.tool === 'staff') return this.placeStaff(x, y);
    if (this.tool === 'animal') return this.placeAnimal(x, y);
    const pen = this.penAt(x, y);
    if (pen) this.penMenu(pen);
  }

  private attachInput(canvas: HTMLCanvasElement): void {
    canvas.style.touchAction = 'none';
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      this.view.zoomBy(e.deltaY > 0 ? 1.1 : 0.9);
    }, { passive: false });
    canvas.addEventListener('pointerleave', () => {
      this.view.hideGhost();
      if (this.staffGhost) this.staffGhost.worker.mesh.visible = false;
    });

    canvas.addEventListener('pointerdown', e => {
      canvas.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      this.hud.hideMenu();
      if (this.pointers.size === 2) {
        this.drag = null;
        this.pinch = this.pinchState();
        return;
      }
      if (this.pointers.size > 2 || this.celebrating) return;
      const pan = e.button !== 0;
      // met de actieknop sleep je het veld net als met het handje; alleen als je op een poepje, afval of een
      // versleten hek begint (wat bij het gekozen gereedschap hoort), ga je aan het werk
      const sweeping = this.tool !== 'action' || this.actionTarget(e.clientX, e.clientY);
      const paint = !pan && !this.moving && PAINT_TOOLS.has(this.tool) && sweeping;
      this.drag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, moved: false, pan, paint };
      this.stroke.clear();
      const start = paint && this.tool === 'fence' ? this.view.groundPoint(e.clientX, e.clientY) : null;
      this.line = start ? { gx0: start.gx, gy0: start.gy, e0: nearestEdge(start.gx, start.gy), axis: null, fixed: 0, from: 0 } : null;
      // grond kleurt meteen; hek en weghalen wachten tot duidelijk is of het een tik of een veeg wordt
      if (paint && this.tool === 'terrain') this.paint(e.clientX, e.clientY);
      this.hover(e.clientX, e.clientY, true);
    });

    canvas.addEventListener('pointermove', e => {
      const prev = this.pointers.get(e.pointerId);
      if (!prev) return this.hover(e.clientX, e.clientY, false);
      const dx = e.clientX - prev.x, dy = e.clientY - prev.y;
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pinch && this.pointers.size >= 2) {
        const now = this.pinchState();
        this.view.zoomBy(this.pinch.dist / Math.max(1, now.dist));
        this.view.pan(now.cx - this.pinch.cx, now.cy - this.pinch.cy);
        this.pinch = now;
        return;
      }
      const d = this.drag;
      if (!d || d.id !== e.pointerId) return;
      if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 8) d.moved = true;
      if (d.paint && this.tool === 'fence') this.fenceDrag(e.clientX, e.clientY);
      else if (d.paint) this.paintStroke(prev.x, prev.y, e.clientX, e.clientY);
      else if (d.pan || d.moved) this.view.pan(dx, dy);
      this.hover(e.clientX, e.clientY, d.moved);
    });

    const end = (e: PointerEvent) => {
      this.pointers.delete(e.pointerId);
      if (this.pointers.size < 2) this.pinch = null;
      const d = this.drag;
      if (!d || d.id !== e.pointerId) return;
      this.drag = null;
      // een heel kort veegje met het hek telt als een tik op die rand
      const flick = d.paint && this.tool === 'fence' && d.moved && !!this.line && !this.line.axis;
      this.line = null;
      if (e.type === 'pointerup' && (!d.moved || flick) && !d.pan) {
        if (!d.paint) this.tap(e.clientX, e.clientY);
        else if (this.tool !== 'terrain') this.paint(flick ? d.sx : e.clientX, flick ? d.sy : e.clientY);
      }
      if (e.pointerType === 'mouse') this.hover(e.clientX, e.clientY, false);
      else {
        this.view.hideGhost();
        if (this.staffGhost) this.staffGhost.worker.mesh.visible = false;
      }
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
  }

  private pinchState(): { dist: number; cx: number; cy: number } {
    const [a, b] = [...this.pointers.values()];
    return { dist: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
  }

  // ------------------------------------------------------------ elk beeldje
  private evaluate(): void {
    const stats = emptyStats();
    const crowd = this.guests.stats();
    stats.enclosures = this.grid.enclosures().length;
    stats.troughs = this.troughs.filter(tr => this.grid.enclosureAt(tr.x, tr.y)).length;
    stats.beds = this.beds.filter(b => this.grid.enclosureAt(b.x, b.y)).length;
    stats.paths = this.grid.terrain.reduce((n, v) => n + (v === PATH ? 1 : 0), 0);
    stats.guests = crowd.happy;
    stats.coins = this.coins;
    stats.fed = this.fed;
    stats.cleaned = this.cleaned;
    stats.born = this.born;
    stats.healed = this.healed;
    stats.caught = this.caught;
    stats.tidied = this.tidied;
    stats.sold = this.sold;
    stats.soldAt = this.soldAt;
    stats.soldAll = this.soldAll;
    stats.keepers = this.workers.length;
    // een kraam telt pas als hij aan het pad staat, anders kan er niemand bij
    for (const s of this.shops) {
      const atPath = s.edge ? edgeSides(s).some(i => this.grid.terrain[i] === PATH) : this.touchesPath(s.x, s.y, s.size);
      // werkt het ook echt? Alleen als gasten erbij kunnen: het pad ernaast moet aan de ingang vastzitten
      const around = s.edge ? edgeSides(s) : this.around(s.x, s.y, s.size);
      s.off = this.has('paths') && this.guests.open && !around.some(i => this.guests.reaches(i));
      if (atPath) stats.shops[s.kind] = (stats.shops[s.kind] ?? 0) + 1;
      // een kraam verkoopt altijd iets: staat er niets aan, dan het eerste wat kan
      if (!s.sells.length) s.sells = this.products(s.kind).slice(0, slotsOf(s.kind));
    }

    let worst: { a: Animal; wish: WishId; age: number } | null = null;
    const taken: Animal[] = [];
    for (const a of this.animals) {
      const was = a.happy;
      a.checkWishes(this);
      const [x, y] = tileXY(a.tile);
      if (this.grid.enclosureAt(x, y)) stats.animals[a.species] = (stats.animals[a.species] ?? 0) + 1;
      if (a.happy) {
        stats.happy[a.species] = (stats.happy[a.species] ?? 0) + 1;
        stats.happyAll++;
      }
      if (a.happy && !was) {
        this.floatAt(icon('heart'), a.gx, a.gy, a.top);
        sfx('heart', { volume: 0.5, every: 1.5 });
      }
      // zorgwensen (ziek, verblijf, voer, schoon) tellen zwaarder dan het soort hek, ondergrond, slaapplek en een vriendje
      const care = a.unmet === 'health' || (a.unmet === 'enclosure' && !a.needsFence) || a.unmet === 'food' || a.unmet === 'clean';
      // verveling, te weinig ruimte en een kapot hek maken een dier ongelukkig, maar het wordt er nooit voor opgehaald
      const calm = a.unmet === 'fun' || a.unmet === 'space' || (a.unmet === 'enclosure' && a.fenceBroken && !a.escaped);
      const rate = a.unmet === null ? -2 : calm ? 0 : care ? 1 : 0.4;
      a.neglect = Math.max(0, a.neglect + rate * 0.4);
      if (a.neglect > NEGLECT_GONE) taken.push(a);
      const bubble = this.bubbles.get(a)!;
      bubble.hidden = a.happy;
      bubble.classList.toggle('warn', a.neglect > NEGLECT_WARN);
      bubble.classList.toggle('danger', a.neglect > NEGLECT_WARN * 1.8);
      const shown = a.escaped ? 'escaped' : a.unmet === 'enclosure' && a.needsFence ? a.needsFence : a.unmet === 'friend' ? `friend${a.lonely}` : a.unmet;
      if (shown && bubble.dataset.wish !== shown) {
        bubble.dataset.wish = shown;
        bubble.innerHTML = a.escaped ? icon('catch') : this.wishIcon(a, a.unmet!);
      }
      const rec = this.unmet.get(a);
      if (!rec || rec.wish !== a.unmet) this.unmet.set(a, { wish: a.unmet, since: this.clock });
      else if (rec.wish && (!worst || this.clock - rec.since > worst.age)) worst = { a, wish: rec.wish, age: this.clock - rec.since };
    }
    // dieren in nood: ontsnapt, ziek, of al een poosje honger, een vies hok of een open hek
    const rank = (a: Animal): number => (a.escaped ? 3 : a.sick ? 2 : 1);
    this.needyAll = this.animals
      .filter(a => {
        if (a.escaped || a.sick) return true;
        const care = a.unmet === 'health' || (a.unmet === 'enclosure' && !a.needsFence) || a.unmet === 'food' || a.unmet === 'clean';
        return care && this.clock - (this.unmet.get(a)?.since ?? this.clock) > 20;
      })
      .sort((p, q) => rank(q) - rank(p) || q.neglect - p.neglect);
    // in het lijstje links staat elke diersoort maar één keer: het dier van die soort dat het hardst hulp nodig heeft
    const seen = new Set<SpeciesId>();
    this.needy = this.needyAll.filter(a => !seen.has(a.species) && !!seen.add(a.species));
    this.hud.setNeeds(this.needy.slice(0, 20).map(a => ({
      icon: speciesIcon(a.species),
      badge: a.escaped ? icon('catch') : a.unmet ? this.wishIcon(a, a.unmet) : icon('sick'),
    })));
    stats.kinds = Object.values(stats.happy).filter(n => n >= 2).length;
    this.stats = stats;
    if (taken.length) {
      const first = taken[0];
      const region = this.grid.regionOf[first.tile];
      this.takeAway(first);
      for (const a of this.animalsIn(region)) a.neglect = Math.min(a.neglect, NEGLECT_WARN);
    }
    this.checkBirths();
    this.hud.setWallet(this.coins, COIN_CAP, this.has('paths') ? crowd.total : null, this.has('keeper') ? 8 + (this.hour % 12) : null);

    // een dier wacht al een poos op iets: de verzorger of de bouwer zegt wat er aan de hand is
    const light = worst && (worst.wish === 'bed' || worst.wish === 'terrain' || worst.wish === 'friend' || worst.wish === 'fun' || worst.wish === 'space' || (worst.wish === 'enclosure' && !!worst.a.needsFence));
    if (worst && worst.age > (light ? ALERT_AFTER * 2 : ALERT_AFTER)) {
      const { a, wish } = worst;
      this.alert(a.escaped ? say.escaped(t, a.species) : wish === 'enclosure' && a.fenceBroken ? say.broken() : wishLine(t, wish, a.species, a.needsFence, a.neglect > NEGLECT_WARN));
      if (a.neglect > NEGLECT_WARN * 1.5 && !this.hud.speaking) this.callForHelp('name.help.1');
    }
    // de gastvrouw let op de gasten
    const lack: Record<string, number> = {};
    const full: Record<string, number> = {};
    let picky = 0;
    for (const q of this.guests.guests) {
      if (!q.wish?.lacking) continue;
      if (q.wish.busy) {
        full[q.wish.kind] = (full[q.wish.kind] ?? 0) + 1;
        continue;
      }
      const kind = NEED_KIND[q.wish.kind];
      if (q.wish.product && kind && this.shops.some(sh => sh.kind === kind)) picky++;
      else lack[q.wish.kind] = (lack[q.wish.kind] ?? 0) + 1;
    }
    if (crowd.total && !this.said.has('host.first')) this.alert(say.host('first', 'happy'), 1e9);
    else if (lack.toilet) this.alert(say.host('toilet'));
    else if (lack.food) this.alert(say.host('food'));
    else if (lack.drink) this.alert(say.host('drink'));
    else if (Object.values(full).some(n => n >= 2)) {
      // het is ergens te druk: de gastvrouw zegt waar er een bij moet
      const need = Object.keys(full).sort((p, q) => full[q] - full[p])[0];
      this.alert(say.busy(NEED_KIND[need]), 240);
    } else if (this.shops.some(sh => sh.off)) this.alert(say.host('nopath'), 300);
    else if (picky) this.alert(say.host('product'), 300);
    else if (this.litter.length >= 6) this.alert(say.host('litter'), 240);
    else if (crowd.total >= 3 && crowd.happy * 3 < crowd.total) this.alert(say.host('sad'), 300);
    // gaat het goed, dan komt er af en toe een complimentje: over de dieren, de gasten, het park of de kas
    // alleen als er niets ernstigs speelt: geen dier dat al lang op hulp wacht
    if (this.clock > this.cheerAt && !this.needyAll.some(a => a.neglect > NEGLECT_WARN) && this.animals.length >= 2) {
      const fits = CHEERS.map((c, i) => ({ c, i })).filter(({ c }) =>
        c.about === 'animals' ? stats.happyAll * 5 >= this.animals.length * 4
        : c.about === 'guests' ? crowd.total >= 3 && crowd.happy * 3 >= crowd.total * 2
        : c.about === 'coins' ? this.coins >= 20
        : this.pens.length >= 2);
      const pick = fits[Math.floor(Math.random() * fits.length)];
      if (pick) {
        const line = say.cheer(pick.i);
        this.alert(line, 600);
        // gezegd? Dan duurt het weer een paar minuten tot het volgende
        if (this.said.get(line.key) === this.clock) this.cheerAt = this.clock + 150 + Math.random() * 90;
      }
    }

    this.refreshTools();
    const level = this.levelDef();
    if (!level) return;
    this.hud.updateGoals(level.goals.map(g => goalProgress(g, stats)));
    if (this.celebrating) return;
    if (levelDone(level, stats)) {
      this.celebrating = true;
      this.lines = [];
      // feest: de dieren dansen en de gasten juichen
      for (const a of this.animals) a.cheer();
      this.guests.cheer();
      const ready = loadSpecies(level.reward);
      const done = this.praise();
      // wat er naast het dier nog vrijkomt: iets voor het park of een nieuw speeltoestel
      const soon: string[] = [...TROUGHS.filter(k => TROUGH[k].from === this.level + 1), ...DECORS.filter(k => DECOR[k].from === this.level + 1), ...SHOPS.filter(k => FEATURE[k] === this.level + 1)];
      sfx('fanfare');
      this.hud.showLevelDone(this.level + 1, speciesIcon(level.reward), t(`species.${level.reward}`), textOf(t, done), () => {
        void ready.then(() => {
          this.level++;
          this.fresh = new Set(soon);
          this.fed = 0;
          this.cleaned = 0;
          this.born = 0;
          this.healed = 0;
          this.caught = 0;
          this.tidied = 0;
          this.sold = {};
          this.soldAt = {};
          this.soldAll = 0;
          this.celebrating = false;
          this.option.animal = level.reward;
          this.option.world = HOME[level.reward];
          this.earn(LEVEL_BONUS);
          this.startPath();
          this.view.paintTerrain(this.grid);
          this.refreshGoals();
          this.introduceLevel();
          this.refreshTools(true);
          animalSound(level.reward, false);
          void this.save();
        });
      }, done.who, soon.map(k => icon(k in TROUGH ? TROUGH_ICON[k as TroughKind] : (k as IconId))));
      playVoice(voiceId(done.who, textOf(t, done)));
      return;
    }
    // het volgende doel is aan de beurt: het figuur dat erbij hoort geeft de opdracht
    const open = this.firstOpenGoal();
    if (open !== this.goalIdx) {
      this.goalIdx = open;
      const g = level.goals[open];
      if (g) this.lines.push(goalLine(t, g));
    }
  }

  /** Wolkjes boven gasten: wat ze willen. Oranje als het er niet is in het park. */
  private guestBubblesUpdate(): void {
    for (const [g, bubble] of this.guestBubbles)
      if (g.gone) {
        bubble.remove();
        this.guestBubbles.delete(g);
      }
    for (const g of this.guests.guests) {
      let bubble = this.guestBubbles.get(g);
      if (!g.wish) {
        if (bubble) bubble.hidden = true;
        continue;
      }
      if (!bubble) this.guestBubbles.set(g, (bubble = this.hud.makeBubble()));
      const key = g.wish.kind + (g.wish.product ?? '');
      if (bubble.dataset.wish !== key) {
        bubble.dataset.wish = key;
        bubble.innerHTML =
          g.wish.kind === 'fav' && g.fav ? speciesIcon(g.fav) + icon('heart', 'badge')
          : g.wish.product ? this.productIcon(g.wish.product)
          : icon(NEED_KIND[g.wish.kind] ?? 'smile_bad');
      }
      bubble.classList.toggle('lacking', g.wish.lacking);
      bubble.hidden = false;
      const s = this.view.toScreen(g.gx, g.gy, g.height + 0.1);
      bubble.style.transform = `translate(${s.x}px, ${s.y}px) translate(-50%, -100%) scale(0.8)`;
    }
  }

  update(dt: number): void {
    this.clock += dt;
    this.view.update(dt);
    // wat er oplicht: met de veger alle poepjes en afval, anders alleen wat onder de muis ligt; en het dier in nood
    const spots: { gx: number; gy: number; r?: number; hot?: boolean }[] = [];
    const hot = this.hoverPoop && (this.poops.includes(this.hoverPoop) || this.litter.includes(this.hoverPoop)) ? this.hoverPoop : null;
    if (this.tool === 'action' && this.option.action === 'hammer') {
      // de hamer: alle versleten hekken lichten op
      const at = this.hoverWorn ? edgeKey(this.hoverWorn) : '';
      for (const e of this.grid.edges()) {
        const key = edgeKey(e.e);
        if (this.wear.has(key)) spots.push({ gx: e.e.x + (e.e.o === 'h' ? 0.5 : 0), gy: e.e.y + (e.e.o === 'h' ? 0 : 0.5), hot: key === at, r: key === at ? 1.8 : 1.3 });
      }
    } else if (this.tool === 'action') {
      // de veger: alle poepjes; de prikker: al het afval, en de afvalbakken zodra je iets bij je hebt
      for (const p of this.option.action === 'broom' ? this.poops : this.litter) spots.push({ gx: p.gx, gy: p.gy, hot: p === hot, r: p === hot ? 1.5 : 1 });
      if (this.option.action === 'picker' && this.carry)
        for (const bin of this.shops) if (bin.kind === 'bin') spots.push({ gx: edgePose(bin)[0], gy: edgePose(bin)[1], hot: true, r: 1.6 });
    } else if (hot) spots.push({ gx: hot.gx, gy: hot.gy, hot: true, r: 1.4 });
    if (this.marked && (this.clock > this.marked.until || !this.animals.includes(this.marked.a))) this.marked = null;
    if (this.marked) spots.push({ gx: this.marked.a.gx, gy: this.marked.a.gy, hot: true, r: 2.6 });
    this.view.showMarks(spots, this.clock * 5);
    for (const a of this.animals) a.update(dt, this);
    this.guests.update(dt);
    this.animateToys();
    if (this.staffGhost?.worker.mesh.visible) this.staffGhost.worker.dangle(this.staffGhost.gx, this.staffGhost.gy, this.clock, this.staffGhost.ok);
    this.animateProps();
    for (const worker of this.workers) worker.update(dt, this, this.claimed);
    const hour = Math.floor(this.clock / HOUR_SECONDS);
    if (hour !== this.hour) {
      this.hour = hour;
      this.payWages();
    }
    for (const shop of this.shops) {
      shop.vendor?.update(dt);
      // de draaimolen draait, de waterstraal van de fontein gaat op en neer
      const moving = shop.mesh.userData.moving as THREE.Object3D | undefined;
      const speed = PLAY_SPEED[shop.kind];
      if (speed) {
        // speeltoestellen wiegen zachtjes als er niemand op zit en gaan flink heen en weer met een kind erop
        shop.spin = ((shop.spin ?? 0) + dt * speed) % (Math.PI * 2);
        shop.amp = (shop.amp ?? 0.12) + ((shop.busyNow ? 1 : 0.12) - (shop.amp ?? 0.12)) * Math.min(1, dt * 2.5);
        const swing = Math.sin(shop.spin) * shop.amp;
        if (moving && shop.kind === 'swing') moving.rotation.x = swing * 0.55;
        else if (moving && shop.kind === 'seesaw') moving.rotation.z = swing * 0.3;
        else if (moving && shop.kind === 'springer') moving.rotation.x = swing * 0.3;
        continue;
      }
      if (!moving) continue;
      if (shop.kind === 'carousel') {
        shop.spin = ((shop.spin ?? 0) + dt * 1.1) % (Math.PI * 2);
        moving.rotation.y = shop.spin;
      } else moving.scale.y = 1 + 0.25 * Math.sin(this.clock * 5 + shop.x);
    }
    this.events(dt);

    for (const p of this.puddles) {
      p.life -= dt;
      (p.mesh.material as THREE.MeshStandardMaterial).opacity = Math.min(1, p.life / 3);
      if (p.life <= 0) this.view.scene.remove(p.mesh);
    }
    this.puddles = this.puddles.filter(p => p.life > 0);

    this.tick -= dt;
    if (this.tick <= 0) {
      this.tick = 0.4;
      this.evaluate();
    }

    if (this.lines.length && !this.hud.speaking && !this.celebrating) this.sayNow(this.lines.shift()!);

    this.zzzIn -= dt;
    if (this.zzzIn <= 0) {
      this.zzzIn = 1.8;
      for (const a of this.animals) if (a.sleeping) this.floatAt(icon('sleep', 'tiny'), a.gx, a.gy, a.top);
    }

    for (const [a, bubble] of this.bubbles) {
      if (bubble.hidden) continue;
      const s = this.view.toScreen(a.gx, a.gy, a.top);
      bubble.style.transform = `translate(${s.x}px, ${s.y}px) translate(-50%, -100%)`;
    }
    this.guestBubblesUpdate();
    // een bordje boven alles wat niet aan het pad staat
    for (const shop of this.shops) {
      if (!shop.off) {
        if (shop.warn) shop.warn.hidden = true;
        continue;
      }
      shop.warn ??= this.hud.makeNoPath();
      shop.warn.hidden = false;
      const [cx, cy] = shopCenter(shop);
      const s = this.view.toScreen(cx, cy, shop.edge ? 0.8 : 2);
      shop.warn.style.transform = `translate(${s.x}px, ${s.y}px) translate(-50%, -100%)`;
    }
    for (const pen of this.pens) {
      if (pen.closedUntil && pen.closedUntil <= this.clock) {
        pen.closedUntil = 0;
        this.lines.push(say.reopen(pen.name));
      }
      pen.sign.hidden = !pen.closedUntil;
      if (!pen.closedUntil) continue;
      const s = this.view.toScreen(pen.ax, pen.ay, 0.6);
      pen.sign.style.transform = `translate(${s.x}px, ${s.y}px) translate(-50%, -100%)`;
    }

    this.saveIn -= dt;
    if (this.saveIn <= 0) {
      this.saveIn = 5;
      void this.save();
    }
  }
}
