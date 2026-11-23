// Het spel zelf: bouwen, verblijven, dieren, voeren, opruimen, gasten, winkels, munten, verzorgers,
// zieke en ontsnapte dieren, figuren, geluid, levels en opslaan.
import type * as THREE from 'three';
import { saveSet, t } from '@smj/shared';
import { Animal, type AnimalWorld, type TrickSound, type Trough } from './animal';
import { miniOpen, playMini, type MiniOptions } from './minigame';
import { ambience, animalSound, hasVoice, heard, layer, listen, music, playVoice, reshuffle, sfx } from './audio';
import {
  BEDS, COIN_CAP, FEATURE, FOODS, LEVELS, PLUSH, PRODUCTS, SHOP_SIZE, SHOP_DEEP, shopSpan, herdOf, productsFor, slotsOf, LEVELS_PER_WORLD, LEVEL_BONUS, MAX_POOPS_CLEAN, PRICE, refund, SHOPS, SHOP_PRICE, SPECIES, START_COINS, TERRAINS,
  TERRAIN_INFO, WISH_ORDER, WORLDS, migrateLevel, unlockedSpecies, worldOf,
  type BedKind, type FenceNeed, type FoodId, type Goal, type Level, type ShopKind, type SpeciesId, type Terrain, type Variant,
  type WishId, type WorldId, TOYS, type ToyKind, HOUR_SECONDS, hourAt, WAGE, TOY_OF, DECOR, DECORS, type DecorKind, PLAY, FENCE_COLORS, TROUGH, TROUGHS, type TroughKind, ALSO, AQUATIC, BONUS, bonusSpecies, TANK_WATER, LAND_PRICE, DAY_SECONDS, NIGHT_SECONDS, DUSK_SECONDS, GUESTS_HOME, STAFF_HOME, STAFF_BACK, VENDORS_BACK, LIGHT, SPACE, guestsAt, SERVES,
  isPath, PATH_KINDS, PATH_FROM, TOY_FROM, TOY_PRICE, CLIMATE, palsOf, PETTABLE, PETTING_MIN, NATURES, pickRare, RARE_CHANCE, MUD_LOVERS, FERRIS, BUMPER_CARS, bumperCar, crowdLoad, CROWD_EASE,
  EDGE_DECOR, SMALL_DECOR, PARK_GROUPS, ATTRACTIONS, parkShopGroup, PROP, PROPS, WILD_PROPS, PARK_PROPS, WILD_KINDS, wildRange, wildWant, type PropKind, type WildKind, DIRT_PER_USE, CART_PRICE, SUIT_COLORS, SEASONS, RAIN_EVERY, RAIN_SECONDS, RAINBOW_SECONDS, STALLS, type Nature, type Rare, type Season, type Sky, } from './data';
import { CLIMB_SECONDS, PUSH, SWING, TETHER, TOY_PIVOT, UNDER, likesToy, rockAt, sinceHit, sway, swingAt, tetherAt } from './data';
import { WAYFIND, canStray, wayfound, type WaySign } from './data';
import { ESCAPE_WAY, escapeChance, escapeWay, pickEscaper, type EscapeWay } from './data';
import { Grid, H, SIDES, W, edgeAlong, edgeKey, nearestEdge, tileIndex, tileXY, type Edge, type EdgeKind, type Region, type Side } from './grid';
import { Hud, type GoalView, type ToolDef, type ToolOption } from './hud';
import { cursor, icon, type IconId } from './icons';
import { emptyStats, goalProgress, levelDone, type Stats } from './levels';
import { CHEERS, EVENT_SAYS, NAMED, PRAISE, callText, goalLine, say, textOf, voiceId, wishLine, type EventPart, type Line } from './lines';
import { TEACHERS, type TeacherId } from './figures';
import { MODEL_SCALE, hasSpecies, loadSpecies, modelReady, spawnModel, spawnStatic, speciesIcon } from './models';
import { ENTRANCE, GuestManager, Train, Vendor, Worker, edgePose, edgeSides, shopCenter, shopTiles, type Guest, type GuestSave, type GuestWorld, type KeeperPoop, type KeeperTrough, type PetSpot, type ShopSpot, type VetJob, type WorkerRole, type WorkerWorld, type FixJob, type GuardJob } from './people';
import { SIGHT, type GuestCue, type Sight } from './people';
import { PEN } from './people';
import { Road } from './road';
import { guestCard } from './traits';
import { EDGE_SHIFT, View, toWorldX, toWorldZ, type TroughMesh } from './view';

/** Wat je met de actieknop doet: poep vegen, een hek vasttimmeren of afval prikken. */
export type ActionId = 'broom' | 'hammer' | 'picker';
export type ToolId = 'hand' | 'action' | 'terrain' | 'fence' | 'trough' | 'bed' | 'toy' | 'prop' | 'shop' | 'rides' | 'decor' | 'animal' | 'staff' | 'erase';
type Verdict = 'good' | 'ok' | 'bad';
type Sex = 'male' | 'female';

/**
 * De balk in groepjes, van links naar rechts: doen (handje, actie, weghalen), grond (ondergrond en hek),
 * dieren (dier en wat in het verblijf hoort) en dierentuin (winkels, versiering, personeel).
 */
const TOOL_GROUPS: [string, ToolId[]][] = [
  ['do', ['hand', 'action', 'erase']],
  ['land', ['terrain', 'fence']],
  ['animal', ['animal', 'trough', 'bed', 'toy', 'prop']],
  ['park', ['shop', 'rides', 'decor', 'staff']],
];
/** Hoe snel een speeltoestel heen en weer gaat. */
const PLAY_SPEED: Partial<Record<ShopKind, number>> = { swing: 2.6, seesaw: 3, springer: 6, trampoline: 5 };
/**
 * De geluidjes van de gasten: [hoe hard, hoeveel tellen het daarna stil blijft]. Wat vaak gebeurt (een hap, een
 * sprong op de trampoline) klinkt zacht en met een lange pauze, zodat een vol park niet één groot lawaai wordt.
 * Wat hier niet staat, klinkt op 0,35 met vijf tellen ertussen.
 */
const GUEST_SOUND: Partial<Record<GuestCue, [number, number]>> = {
  'guest.yum': [0.22, 9], 'guest.slurp': [0.22, 8], 'guest.bite': [0.22, 8], 'guest.aah': [0.3, 6],
  'guest.uhoh': [0.3, 4], 'guest.shh': [0.3, 7], 'guest.yuck': [0.3, 6], 'guest.aww': [0.3, 6], 'guest.yawn': [0.25, 10], 'guest.sigh': [0.22, 8],
  'guest.phew': [0.3, 5], 'guest.dizzy': [0.3, 5], 'guest.five': [0.4, 2], 'guest.sniff': [0.3, 5], 'guest.echo': [0.35, 5], 'guest.chat': [0.3, 6],
  'park.scribble': [0.3, 4], 'park.splash': [0.25, 3], 'park.brolly': [0.25, 3],
  'guest.whee': [0.3, 4], 'ride.boing': [0.2, 1.8], 'ride.creak': [0.18, 4], 'ride.bump': [0.25, 2.5],
};
/** De geluiden bij de kunstjes van de dieren: [welk geluid, hoe hard, hoe snel afgespeeld]. Trappelen is stampen, maar lichter en vlugger. */
const TRICK_SOUND: Record<TrickSound, [string, number, number]> = {
  stomp: ['animal.stomp', 0.4, 1], trot: ['animal.stomp', 0.28, 1.35], clap: ['animal.clap', 0.4, 1], slide: ['animal.slide', 0.35, 1], fan: ['animal.fan', 0.4, 1], splash: ['animal.splash', 0.45, 1],
};
const PAINT_TOOLS = new Set<ToolId>(['terrain', 'fence', 'erase', 'action']);
const TROUGH_ICON: Record<TroughKind, IconId> = { wood: 'trough_empty', big: 'trough_big', silo: 'trough_silo' };
const ROLE_ICON: Record<WorkerRole, IconId> = { feed: 'feed', clean: 'broom', fix: 'hammer', vet: 'vet', guide: 'guide', photo: 'photo', guard: 'guard' };
/** Vanaf wanneer je welk personeel kunt aannemen, en wie een karretje kan krijgen. */
const STAFF_FROM: Record<WorkerRole, keyof typeof FEATURE> = { feed: 'keeper', clean: 'keeper', fix: 'wear', photo: 'photo', guide: 'guide', vet: 'vet', guard: 'guard' };
const CART_ROLES: WorkerRole[] = ['feed', 'clean', 'fix', 'vet'];
/** Zo lang moet de speler niets doen voor het hulphandje komt, zo lang blijft het, en zo lang duurt het tot het volgende. */
const HAND_AFTER = 25;
/** Zoveel tegel mag de rand van een pad verder weg liggen dan de dichtstbijzijnde rand om toch een bankje of bak te krijgen. */
const PATH_PULL = 0.2;
const HAND_SECONDS = 7;
const HAND_GAP = 80;
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
/** Staat er een dier achter het verkeerde hek, dan ontsnapt er veel vaker een. */
const ESCAPE_WRONG: [number, number] = [80, 130];
const MAX_LITTER = 8;
/** Zoveel stuks afval kun je tegelijk in je handen hebben. */
const MAX_CARRY = 5;
const SEX_COLOR: Record<Sex, number> = { male: 0x4a90e2, female: 0xf06aa6 };
const FENCE_KIND: Record<string, EdgeKind> = { fence: 1, gate: 2, wall: 3, net: 4, glass: 5, window: 6, picket: 7, petgate: 8 };
const FENCE_SOUND = ['', 'fence', 'fence', 'stone', 'net', 'stone', 'stone', 'fence', 'fence'];
const NEED_ICON: Record<FenceNeed, IconId> = { wall: 'wall', net: 'net', glass: 'glass' };
const PATH = TERRAINS.indexOf('path');
const WATER = TERRAINS.indexOf('water');
/** In welke wereld hoort een soort thuis? Dat volgt uit het level waarin je hem krijgt. */
/** Wat er bij de gasten kan gebeuren. Bij alles behalve het verdwaalde kind hoort een kaartje met een puzzeltje. */
type EventKind = 'schoolclass' | 'party' | 'celeb' | 'lost' | 'delivery' | 'photo' | 'build' | 'bedtime' | 'crates' | 'till' | 'mayor';
type CardEvent = Exclude<EventKind, 'lost'>;
const EVENT_KINDS: EventKind[] = ['schoolclass', 'party', 'celeb', 'lost', 'delivery', 'photo', 'build', 'bedtime', 'crates', 'till', 'mayor'];
/** Welk puzzeltje er bij een kaartje hoort, en hoe het eruitziet (zie MiniOptions). */
type MiniSetup = Pick<MiniOptions, 'kind' | 'animals' | 'first' | 'sizeIcons'>;
/**
 * Elk evenement met een kaartje. `from`: vanaf welk level (een sleutel van FEATURE). `sound`: het geluid waarmee het
 * zich aankondigt. `mini`: het puzzeltje. `coins`: de munten als het lukt. `boost`: zoveel tellen meer gasten als het
 * lukt. Wie erbij praat en wat die zegt, staat in lines.ts (EVENT_SAYS).
 */
const EVENTS: Record<CardEvent, { from: keyof typeof FEATURE; icon: IconId; sound: string; mini: MiniSetup; coins: number; boost?: number }> = {
  // de klas: zie CLASS_TASKS voor wat ze kan vragen
  schoolclass: { from: 'schoolclass', icon: 'schoolclass', sound: 'guest.kid', mini: { kind: 'sum' }, coins: 4 },
  // de jarige: cadeautjes op volgorde
  party: { from: 'party', icon: 'cake', sound: 'party', mini: { kind: 'order', sizeIcons: ['balloon_red', 'cake', 'hat_party', 'balloon_blue'] }, coins: 3 },
  // de beroemde gast: een woord
  celeb: { from: 'celeb', icon: 'star', sound: 'fanfare', mini: { kind: 'spell' }, coins: 2 },
  // de vrachtwagen met voer: kisten tellen
  delivery: { from: 'schoolclass', icon: 'truck', sound: 'train.toot', mini: { kind: 'sum' }, coins: 6 },
  // de fotograaf van de krant: het woord onder de foto
  photo: { from: 'celeb', icon: 'photo', sound: 'camera', mini: { kind: 'spell' }, coins: 0, boost: 150 },
  // de bouwer is aan het timmeren: zijn spullen van klein naar groot
  build: { from: 'window', icon: 'hammer', sound: 'fence', mini: { kind: 'order', first: 'size', sizeIcons: ['log', 'fence', 'hammer'] }, coins: 3 },
  // de verzorger telt de dieren als het donker wordt
  bedtime: { from: 'night', icon: 'moon', sound: 'animal.owl', mini: { kind: 'sum' }, coins: 3 },
  // de verzorger heeft nieuwe kisten met voer: op volgorde zetten
  crates: { from: 'cart', icon: 'crate', sound: 'place', mini: { kind: 'order', first: 'count', sizeIcons: ['crate', 'hay', 'fruit'] }, coins: 4 },
  // de kassier telt de munten in de kassa
  till: { from: 'upkeep', icon: 'coin', sound: 'coin', mini: { kind: 'sum' }, coins: 5 },
  // de burgemeester wil weten hoe een dier heet; daarna vertelt hij iedereen over het park
  mayor: { from: 'tower', icon: 'mayor', sound: 'fanfare', mini: { kind: 'spell', animals: true }, coins: 0, boost: 120 },
};
/** Wat een klas kan vragen. `guide`: de weg wijzen in het park zelf; de rest is een puzzeltje met een eigen kaartje. */
type ClassTask = 'sum' | 'count' | 'draw' | 'line' | 'guide';
const CLASS_TASKS: Record<Exclude<ClassTask, 'guide'>, { label: string; mini: MiniSetup }> = {
  sum: { label: 'event.schoolclass', mini: { kind: 'sum' } },
  // zijn alle kinderen er nog?
  count: { label: 'event.class.count', mini: { kind: 'sum' } },
  // de naam van het dier bij de tekening
  draw: { label: 'event.class.draw', mini: { kind: 'spell', animals: true } },
  // de kinderen in de rij, van klein naar groot
  line: { label: 'event.class.line', mini: { kind: 'order', first: 'size', sizeIcons: ['guest', 'cap_red', 'cap_blue'] } },
};
/** De juf heeft een oranje vest aan, de meester een groene trui: zo lopen ze ook door het park. */
const TEACHER_SHIRT: Record<TeacherId, number> = { teacher: 0xf08a24, master: 0x4f9a5a };
const HOME = Object.fromEntries(LEVELS.map((l, i) => [l.reward, worldOf(i)])) as Record<SpeciesId, WorldId>;
const between = ([lo, hi]: [number, number]): number => lo + Math.random() * (hi - lo);
/** Het midden van het blok tegels waar een winkel op staat (bij iets op een rand: het midden van zijn tegel). */
const blockCenter = (shop: ShopSpot): [number, number] => [shop.x + shopTiles(shop)[0] / 2, shop.y + shopTiles(shop)[1] / 2];
/** Zoveel dieren in nood staan er hooguit in het lijstje links; daaronder komt de knop voor gasten die de weg kwijt zijn. */
const NEEDS_SHOWN = 20;
/** Bij welke winkel hoort een wens van een gast? */
const NEED_KIND: Record<string, ShopKind> = {
  food: 'foodstall', drink: 'drinkstall', toilet: 'toilet', icecream: 'icecream', balloon: 'balloon', hat: 'hats', souvenir: 'souvenir', play: 'playground', sit: 'bench', look: 'fountain', ride: 'carousel',
  umbrella: 'umbrellas', shelter: 'shelter',
};

/** Elke handeling heeft een eigen cursor, zodat je ziet wat een tik gaat doen. */
const CUR: Record<string, string> = {
  grab: 'grab',
  grabbing: 'grabbing',
  fence: cursor('fence'),
  gate: cursor('gate'),
  wall: cursor('wall'),
  net: cursor('net'),
  glass: cursor('glass'),
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
for (const id of ['window', 'picket', 'petgate'] as const) CUR[id] = cursor(id);

export interface SaveData {
  /** 1 = het spel met veertien levels, 2 = vijftig levels. */
  v: 1 | 2 | 3 | 4;
  level: number;
  fed: number;
  cleaned: number;
  terrain: number[];
  h: number[];
  vv: number[];
  /** `rot` (ook bij slaapplek, speelgoed en versiering): hoeveel kwartslagen het gedraaid staat. */
  troughs: { x: number; y: number; food: FoodId | null; amount: number; kind?: TroughKind; rot?: number }[];
  animals: { species: SpeciesId; variant: Variant; gx: number; gy: number; hunger: number; name?: string; sick?: boolean; escaped?: boolean; nature?: Nature; rare?: Rare }[];
  poops: { gx: number; gy: number }[];
  /** `keeper`, `feeder` en `cleaner` komen uit oudere spellen, toen een werker bij één verblijf hoorde. */
  pens?: { tile: number; name: string; color?: number; keeper?: boolean; feeder?: boolean; cleaner?: boolean }[];
  /** Het personeel dat door het park loopt. */
  staff?: { role: WorkerRole; gx: number; gy: number; suit?: number; cart?: boolean }[];
  beds?: { x: number; y: number; kind: BedKind; rot?: number }[];
  toys?: { x: number; y: number; kind: ToyKind; rot?: number }[];
  decor?: { x: number; y: number; kind: DecorKind; edge?: 'h' | 'v'; rot?: number; q?: number }[];
  /** Natuur op een kwart tegel: `x`, `y` in vakjes (twee per tegel), `r` de draaiing in kwartslagen. */
  props?: { k: PropKind; x: number; y: number; r?: number }[];
  shops?: { x: number; y: number; kind: ShopKind; sells?: string[]; edge?: 'h' | 'v'; turned?: boolean; face?: number; rot?: number; manual?: boolean; dirt?: number }[];
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
  /** De stroken grond die erbij gekocht zijn. */
  land?: Side[];
  /** Hoe laat het is in het park (in tellen sinds het begin): daar hangen dag, nacht en het seizoen aan. */
  time?: number;
  /** Het gastenboek: per diersoort hoeveel gasten er een tekening van hebben achtergelaten. */
  book?: Record<string, number>;
  /** De dieren waarvan het weetje al verteld is, en uitleg die al gegeven is. */
  facts?: string[];
  told?: string[];
  /** Hoe graag schoolklassen komen (0 tot 3). */
  fans?: number;
}

export const slotKey = (slot: number): string => `zoo-slot-${slot}`;

interface TroughObj extends Trough {
  food: FoodId | null;
  kind: TroughKind;
  mesh: TroughMesh;
  /** Hoeveel kwartslagen het gedraaid staat (ook bij slaapplek, speelgoed en versiering). */
  rot?: number;
}
interface BedObj {
  x: number;
  y: number;
  kind: BedKind;
  mesh: THREE.Object3D;
  rot?: number;
}
interface DecorObj {
  x: number;
  y: number;
  kind: DecorKind;
  /** Een paal of bord staat op een rand van tegel (x, y): 'h' is de noordrand, 'v' de westrand. */
  edge?: 'h' | 'v';
  mesh: THREE.Object3D;
  rot?: number;
  /** Iets kleins staat in een kwart van de tegel: 0 = noordwest, 1 = noordoost, 2 = zuidwest, 3 = zuidoost. */
  q?: number;
}
/** Waar iets op zijn tegel staat: midden in zijn kwart, of (zonder kwart) midden op de tegel. */
const quarterAt = (q?: number): [number, number] => (q === undefined ? [0.5, 0.5] : [0.25 + 0.5 * (q & 1), 0.25 + 0.5 * (q >> 1)]);
/** Het kwart van de tegel onder de vinger. */
const quarterOf = (gx: number, gy: number): number => (gx - Math.floor(gx) >= 0.5 ? 1 : 0) + (gy - Math.floor(gy) >= 0.5 ? 2 : 0);
/** De groepen onder de knop Park, met hun plaatje. Klein, Handig en Speeltuin zet je anders neer dan de rest. */
const PARK_GROUP_ICON: Record<string, IconId> = { green: 'tree', water: 'pond', art: 'flag', light: 'lantern', small: 'parkprops', signs: 'signpost', service: 'toilet', play: 'slide' };
/** Natuur: een graspol, steen of boom. `sx`, `sy`: het vakje linksboven (twee vakjes per tegel). */
interface PropObj {
  kind: PropKind;
  sx: number;
  sy: number;
  rot: number;
}
/** Bij elk natuurding het plaatje van de knop; boom, den, palm en rots lenen dat van het park. */
/** Het staande balkje naast een wens in het menu van het dier: hoe voller, hoe beter het gaat. */
/**
 * Het staande balkje naast een wens in het menu van het dier. Het heeft vier standen, zodat je het in één oogopslag
 * ziet: slecht (rood, een kwart), matig (oranje, half), goed (lichtgroen, driekwart) en vol (groen).
 */
const meter = (level: number): string => {
  const step = level >= 0.9 ? 3 : level >= 0.6 ? 2 : level >= 0.3 ? 1 : 0;
  return `<i class="meter ${['low', 'mid', 'good', 'full'][step]}"><b style="height:${(step + 1) * 25}%"></b></i>`;
};
/** Het plaatje bij bomen, planten en stenen in de wens van een dier. */
const WILD_ICON: Record<WildKind, IconId> = { tree: 'oak', plant: 'tuft', stone: 'stone' };
/**
 * Het plaatje van een natuurwens. Bij de boom en de steen staat er klein het plaatje van de knop Natuur bij, zodat
 * je weet waar je hem vindt: een boom staat ook bij Park, en een rots ook bij Speelgoed en Slaapplek.
 */
/**
 * Het plaatje van een speelgoedwens (ook de warmtelamp en het ijsblok). Er staat klein het plaatje van de knop
 * Speelgoed bij, zodat je weet waar je het vindt: een rots of een vijver staat ook bij Natuur, Park en Slaapplek.
 * Bij de bal zelf hoeft dat niet: dat is hetzelfde plaatje.
 */
const toyIcon = (kind: string): string => icon(kind as IconId) + (kind === 'ball' ? '' : `<i class="from">${icon('ball')}</i>`);
const wildIcon = (kind: WildKind): string => icon(WILD_ICON[kind]) + (kind === 'plant' ? '' : `<i class="from">${icon('tuft')}</i>`);
const PROP_ICON: Record<PropKind, IconId> = { tuft: 'tuft', daisies: 'daisies', fern: 'fern', shrub: 'shrub', pebbles: 'pebbles', stone: 'stone', oak: 'oak', fir: 'pine', coco: 'palm', crag: 'boulder',
  // het kleine spul voor het park heeft een plaatje met dezelfde naam
  pot: 'pot', gnome: 'gnome', pinwheel: 'pinwheel', ducky: 'ducky', birdhouse: 'birdhouse', can: 'can', bucket: 'bucket', snail: 'snail', crate: 'crate' };
interface ToyObj {
  x: number;
  y: number;
  kind: ToyKind;
  mesh: THREE.Object3D;
  rot?: number;
  /** Tot dit moment speelt er een dier mee: het ding beweegt. */
  playUntil?: number;
  /** Naar welke kant de hoepel gedraaid staat. Bij speelgoed dat zelf beweegt: de kant waar het dier dat ermee speelt naartoe kijkt. */
  facing?: number;
  /** Sinds dit moment wordt ermee gespeeld: speelgoed dat zelf beweegt telt vanaf hier (net als het dier). */
  playFrom?: number;
  /** Hoe het beweegt: 0 = een dier zit of staat erop, 1 = een dier geeft er stootjes tegen, -1 = jij gaf er een tik op. */
  hits?: number;
  /** De slingerbal: aan welke kant hij hing voor dit dier kwam (de `facing` van toen). */
  was?: number;
  /** De losse stukken (de ballen, de liggende stam, de autoband): die rollen echt door het verblijf. */
  loose?: LoosePiece[];
  /** Ligt er een los stuk niet op zijn plek? Alleen dan is er iets te bewegen. */
  live?: boolean;
}
/** Een los stuk van speelgoed: waar het nu ligt en hoe het rolt. Alleen het beeld beweegt; het speelgoed zelf houdt zijn tegel. */
interface LoosePiece {
  obj: THREE.Object3D;
  /** De straal: zo hoog ligt het midden, en zo snel draait het stuk bij het rollen. */
  r: number;
  /** De eigen plek, gemeten in het speelgoed zelf (dat draait mee met `rot`). */
  hx: number;
  hz: number;
  /** Een stam: zo ligt hij gedraaid. Hij rolt alleen dwars op zijn lengte; een bal rolt alle kanten op. */
  turn: number;
  line: boolean;
  /** Een autoband: die rolt rechtop. `yaw`: naar welke kant hij gedraaid staat, `spin`: hoe ver hij om zijn as gerold is. */
  wheel: boolean;
  yaw: number;
  spin: number;
  /** Waar het stuk nu ligt, in tegels vanaf het midden van de eigen tegel, en hoe snel het gaat. */
  ox: number;
  oy: number;
  vx: number;
  vy: number;
  /** De bal stuitert: zo hoog is hij nu, en zo snel gaat hij omhoog. */
  h: number;
  vh: number;
  /** De stam: hoe ver hij van zijn plek gerold is, hoe snel, en hoe ver hij naar elke kant kan. */
  s: number;
  vs: number;
  lo: number;
  hi: number;
  /** De weg terug naar de eigen tegel (tegel voor tegel) en hoe ver de bal daarop is; null zolang hij vrij rolt. */
  route: number[] | null;
  step: number;
  /** Zoveel seconden is de bal al op weg naar huis. */
  homing: number;
  /** Ligt het stuk stil op zijn eigen plek? */
  home: boolean;
}
/**
 * Hoe een bal rolt: zo hard valt hij na een stuit, zo snel remt hij af (`brake` altijd, `drag` meer naarmate hij
 * harder gaat), zoveel snelheid houdt hij over tegen het hek (`wall`) en op de grond (`bounce`), en zo snel rolt hij naar huis.
 */
const BALL = { gravity: 9, brake: 0.9, drag: 0.7, wall: 0.65, bounce: 0.5, home: 1.1 };
/**
 * Hoe een stam rolt: hij wil terug naar zijn plek (`pull`) en remt af (`damp`). Zo ver kan hij op de eigen tegel
 * (`near`) en met een vrije tegel ernaast (`far`). Met `kick` keer die ruimte als snelheid rolt hij er net niet tegenaan.
 */
const LOG = { pull: 4, damp: 2.4, near: 0.3, far: 0.8, kick: 3.8 };
interface ShopObj extends ShopSpot {
  mesh: THREE.Object3D;
  /** Hoe vies de kraam is (0 tot 1); bij 1 koopt de helft van de gasten er niets meer. */
  dirt?: number;
  dirtShown?: boolean;
  /** Tot dit moment is het hier feest: slingers en taart. */
  partyUntil?: number;
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
/** Er staat niemand bij dit verblijf te kijken. */
const NOBODY: Guest[] = [];

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

  private option = { trough: 'wood', action: 'broom', terrain: 'mud', fence: 'fence', fenceMode: 'box', bed: 'straw', toy: 'ball', prop: 'tuft', ride: 'slide', rideGroup: 'play', staff: 'feed', decor: 'tree', decorGroup: 'green', terrainGroup: 'pen', shop: 'foodstall', animal: '', sex: 'male', world: 'farm' };
  private puddles: { mesh: THREE.Mesh; life: number }[] = [];
  private bubbles = new Map<Animal, HTMLElement>();
  private guestBubbles = new Map<Guest, HTMLElement>();
  private hud: Hud;
  private guests: GuestManager;
  /** De weg voor de poort, met het verkeer: alleen om naar te kijken. */
  private road: Road;
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
  /** Een sterk dier duwt het hek om: op dat moment (speltijd) valt dat stuk hek om en is het kapot. */
  private pushes: { a: Animal; e: Edge; out: 1 | -1; at: number }[] = [];
  /** Een dier dat de bewaker niet thuis kon brengen: tot dit moment probeert geen bewaker het opnieuw. */
  private guardRest = new Map<Animal, number>();
  private celebrating = false;
  private toolsKey = '';
  /** Tot dit moment knippert de veger, omdat er net op een poepje is getikt. */
  private nudge = 0;
  /** De prijskaartjes boven de stroken grond die te koop zijn. */
  private landSigns = new Map<Side, HTMLElement>();
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
  /** De tijd in het park loopt door over opslaan heen: `timeBase` is wat er al op de klok stond. */
  private timeBase = 0;
  private season: Season = 'summer';
  private seasonTold = false;
  /** Het weer: over zoveel tellen begint een bui, zo lang regent het nog, zo lang staat de regenboog er nog. */
  private rainIn = RAIN_EVERY[0] * 0.6;
  private rainLeft = 0;
  private rainbow = 0;
  private wet = 0;
  private skyKey = '';
  rainPuddles: { gx: number; gy: number; mesh: THREE.Mesh; life: number }[] = [];
  /** Het gastenboek, de weetjes die al verteld zijn en uitleg die al gegeven is. */
  private book: Record<string, number> = {};
  private facts = new Set<string>();
  private told = new Set<string>();
  /** Bijzondere gasten: over zoveel tellen komt er weer een klas, een feestje, een beroemde gast of een verdwaald kind. */
  private eventIn = 90;
  /** Dit park komt uit een opgeslagen spel: wat er al was, wordt bij het openen niet opnieuw aangekondigd. */
  private resumed = false;
  private lastEvent = '';
  private boostUntil = 0;
  /** Het kaartje van een evenement dat nu op het scherm ligt: de speler mag helpen of het wegklikken. */
  private offer: { kind: EventKind; who: Guest | null; until: number; ask: Line } | null = null;
  /** Bij elke klas hoort een juf of een meester: die stelt de vraag, zegt hoe het ging en neemt afscheid. */
  private classTeacher = new WeakMap<Guest, TeacherId>();
  /** Wat de vorige klas vroeg, en welke variant van een zin het laatst klonk: zo is het elke keer anders. */
  private lastTask: ClassTask | '' = '';
  private lastSaid = new Map<string, number>();
  /** De klas zoekt een dier: de speler wijst de weg door op het goede verblijf te tikken. */
  private guideAsk: { species: SpeciesId; teacher: Guest; until: number } | null = null;
  /** De schoolbus is onderweg: zodra hij voor de poort stilstaat, stapt deze klas uit (na `until` komt ze te voet). */
  private classDue: { n: number; teacher: TeacherId; until: number } | null = null;
  /** Hoe graag schoolklassen komen (0 tot 3): had een klas het leuk, dan komt er vaker een klas, met meer kinderen. */
  private classFans = 0;
  private guestBadges = new Map<Guest, HTMLElement>();
  /** De kinderboerderijen: welke verblijven het zijn en waar gasten naar binnen kunnen. */
  private petRegions = new Set<number>();
  private petSpots: PetSpot[] = [];
  /** Padtegels waar iets te zien is (voor de gids en de fotograaf), en wanneer dat lijstje gemaakt is. */
  private spots: number[] = [];
  private spotsAt = -99;
  /** Het hulphandje: wanneer de speler voor het laatst iets deed, wanneer het handje er was en waar het naar wijst. */
  private lastInput = 0;
  private handAt = -HAND_GAP;
  private handOn: { gx: number; gy: number; h: number } | null = null;

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
      turn: dir => this.view.rotate(dir),
      spin: () => this.spinGhost(),
    });
    this.guests = new GuestManager(this.view.scene, this);
    this.road = new Road(this.view.scene);
    const train = this.view.makeTrain();
    this.guests.train = new Train([train.loco, ...train.wagons]);
    if (data) this.load(data);
    this.season = this.seasonNow();
    this.view.setSeason(this.season);
    // een ouder spel dat al verder is: even vertellen dat de dieren nu iets leuks willen
    if (data && this.has('fun') && !this.toys.length) this.lines.push(say.funNew());
    if (data && this.has('climate') && !this.toys.some(toy => toy.kind === 'lamp' || toy.kind === 'icebox')) this.lines.push(say.climateNew());
    this.startPath();
    this.view.paintTerrain(this.grid);
    this.syncPens(false);
    // een ouder spel, van voor de natuur: de tuinman zet in elk verblijf alvast neer wat de dieren willen
    if (data && data.props === undefined && this.has('wild')) {
      this.plantAll();
      this.lines.push(say.wildNew());
    }
    this.syncWear();
    this.syncLand();
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
    for (const side of d.land ?? []) if (SIDES.includes(side)) this.grid.expand(side);
    this.grid.recompute();
    this.syncLand();
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
    this.timeBase = d.time ?? 0;
    this.book = d.book ?? {};
    this.facts = new Set(d.facts ?? []);
    this.told = new Set(d.told ?? []);
    this.resumed = true;
    // een park dat al verder is, heeft zijn eerste gasten al lang gehad
    if (d.level > FEATURE.paths) this.told.add('guests');
    this.classFans = d.fans ?? 0;
    this.savedPens = (d.pens ?? []).map(p => ({ name: p.name, color: p.color, tile: tileIndex((p.tile % ow) + ox, Math.floor(p.tile / ow) + oy) }));
    for (const tr of d.troughs) this.addTrough(tr.x + ox, tr.y + oy, tr.food, tr.amount, tr.kind && TROUGH[tr.kind] ? tr.kind : 'wood', tr.rot);
    for (const b of d.beds ?? []) this.addBed(b.x + ox, b.y + oy, b.kind, b.rot);
    for (const b of d.toys ?? []) this.addToy(b.x + ox, b.y + oy, b.kind, b.rot);
    // iets op een rand ligt langs die rand; een heg of bloemperk uit een ouder spel staat nog midden op zijn tegel
    for (const b of d.decor ?? []) if (DECOR[b.kind]) this.addDecor(b.x + ox, b.y + oy, b.kind, b.edge, b.rot ?? (b.edge === 'v' ? 1 : 0), b.edge ? undefined : b.q);
    for (const p of d.props ?? []) if (PROP[p.k]) this.props.push({ kind: p.k, sx: p.x + ox * 2, sy: p.y + oy * 2, rot: p.r ?? 0 });
    this.syncProps();
    // eerst de losse dingen (bankje, bloemen, afvalbak): die blijven staan waar ze stonden
    // de speeltuin als één gebouw bestaat niet meer: in een ouder park wordt hij een glijbaan (even groot)
    const stored = [...(d.shops ?? [])].map(sh => (sh.kind === 'playground' ? { ...sh, kind: 'slide' as ShopKind } : sh)).sort((p, q) => (SHOP_SIZE[p.kind] ?? 1) - (SHOP_SIZE[q.kind] ?? 1));
    for (const sh of stored) {
      const size = SHOP_SIZE[sh.kind];
      if (!size) continue;
      let x = sh.x + ox, y = sh.y + oy;
      if (size === 1) {
        // een bankje, bloembak of afvalbak staat op een rand; uit een ouder spel stond het nog op een tegel
        const spot = sh.edge ? { o: sh.edge, x, y } : this.edgeNear(x, y);
        if (spot && this.edgeFits(spot)) this.addShop(spot.x, spot.y, sh.kind, sh.sells, spot.o, sh.turned, undefined, undefined, sh.face).dirt = sh.dirt;
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
        const spot = fits.find(([ax, ay]) => this.touchesPath(ax, ay, ...shopSpan(sh.kind))) ?? fits[0];
        if (!spot) {
          this.coins = Math.min(COIN_CAP, this.coins + SHOP_PRICE[sh.kind]);
          continue;
        }
        [x, y] = spot;
      }
      let rot = sh.manual ? sh.rot : undefined;
      if (SHOP_DEEP[sh.kind]) {
        const was = sh.rot ?? 0;
        if ((d.v ?? 1) === 3) {
          // marktkramen waren eerst 2 bij 2: de kraam komt in de helft waar zijn voorkant was
          if (was === 0) y += 1;
          else if (was === 1) x += 1;
        }
        // een kraam draait uit zichzelf alleen een halve slag: zo blijft hij op zijn eigen tegels staan
        rot = sh.manual ? was : this.autoRot(x, y, sh.kind, was);
      }
      this.addShop(x, y, sh.kind, sh.sells, undefined, undefined, rot, sh.manual).dirt = sh.dirt;
    }
    for (const a of d.animals) {
      if (!modelReady(`${a.species}_${a.variant}`)) continue;
      const animal = this.addAnimal(a.species, a.variant, a.gx + ox, a.gy + oy, a.name, a.nature ?? 'plain', a.rare);
      animal.hunger = a.hunger;
      if (a.sick) animal.fallIll();
      animal.escaped = !!a.escaped;
    }
    for (const p of d.poops) this.dropPoop(p.gx + ox, p.gy + oy);
    for (const p of d.litter ?? []) this.dropLitter(p.gx + ox, p.gy + oy);
    this.guests.restore(d.guests ?? [], ox, oy);
    for (const w of d.staff ?? []) this.addWorker(w.role, w.gx + ox, w.gy + oy, w.suit, w.cart);
    if (!d.staff) {
      // een ouder spel: werkers hoorden toen bij één verblijf. Eén werker per vijf van die verblijven loopt nu rond.
      const [ex, ey] = tileXY(ENTRANCE);
      const old = (role: WorkerRole): number => Math.ceil((d.pens ?? []).filter(p => p.keeper || (role === 'feed' ? p.feeder : p.cleaner)).length / 5);
      for (const role of ['feed', 'clean'] as const) for (let i = 0; i < old(role); i++) this.addWorker(role, ex + 0.5, ey + 0.5 - i * 0.4);
    }
    // slijtage staat per rand opgeslagen; in een ouder, kleiner raster schuift de rand mee met het park
    for (const [key, phase] of Object.entries(d.wear ?? {})) {
      const [x, y] = key.slice(1).split(',').map(Number);
      this.wear.set(`${key[0]}${x + ox},${y + oy}`, phase);
    }
  }

  serialize(): SaveData {
    return {
      v: 4,
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
      troughs: this.troughs.map(({ x, y, food, amount, kind, rot }) => ({ x, y, food, amount, kind: kind === 'wood' ? undefined : kind, rot: rot || undefined })),
      animals: this.animals.map(a => ({
        species: a.species, variant: a.variant, gx: a.gx, gy: a.gy, hunger: a.hunger, name: a.name, sick: a.sick || undefined, escaped: a.escaped || undefined,
        nature: a.nature === 'plain' ? undefined : a.nature, rare: a.rare ?? undefined,
      })),
      poops: this.poops.map(({ gx, gy }) => ({ gx, gy })),
      litter: this.litter.map(({ gx, gy }) => ({ gx, gy })),
      guests: this.guests.snapshot(),
      wear: Object.fromEntries(this.wear),
      pens: this.pens.map(p => ({ tile: p.region.tiles[0], name: p.name, color: p.color || undefined })),
      staff: this.workers.map(w => ({ role: w.role, gx: w.gx, gy: w.gy, suit: w.suit || undefined, cart: w.cart || undefined })),
      beds: this.beds.map(({ x, y, kind, rot }) => ({ x, y, kind, rot: rot || undefined })),
      toys: this.toys.map(({ x, y, kind, rot }) => ({ x, y, kind, rot: rot || undefined })),
      decor: this.decors.map(({ x, y, kind, edge, rot, q }) => ({ x, y, kind, edge, rot: rot || undefined, q })),
      props: this.props.map(p => ({ k: p.kind, x: p.sx, y: p.sy, r: p.rot || undefined })),
      shops: this.shops.map(({ x, y, kind, sells, edge, turned, set, rot, manual, dirt }) => ({ x, y, kind, sells, edge, turned, face: set, rot, manual, dirt: dirt ? Math.round(dirt * 100) / 100 : undefined })),
      gw: W,
      gh: H,
      land: SIDES.filter(side => this.grid.owns(side)),
      time: Math.round(this.now()),
      book: this.book,
      facts: [...this.facts],
      told: [...this.told],
      fans: this.classFans,
    };
  }

  save(): Promise<void> {
    return saveSet(slotKey(this.slot), this.serialize());
  }

  // ------------------------------------------------------------ wat is vrijgespeeld
  private levelDef(): Level | undefined {
    return this.level < this.maxLevel ? LEVELS[this.level] : undefined;
  }

  /** De dieren die je kunt neerzetten: de beloningen van de levels en, als hun model er is, de zeedieren. */
  private species(): SpeciesId[] {
    return [...unlockedSpecies(this.level), ...bonusSpecies(this.level).filter(hasSpecies)];
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
    // de grond van elk dier dat je hebt, en de stukjes van de mix die die dieren willen
    const mix = new Set(this.species().flatMap(sp => ALSO[sp] ?? []));
    const list = this.unlocked(TERRAINS.filter(k => !PATH_KINDS.includes(k)), ['grass', 'mud'], sp => SPECIES[sp].terrain);
    for (const k of TERRAINS) if (mix.has(k) && !list.includes(k)) list.push(k);
    list.sort((p, q) => TERRAINS.indexOf(p) - TERRAINS.indexOf(q));
    // de paden komen er een voor een bij: eerst het gewone pad, later kiezels, een brug, planken, klinkers en meer
    return [...list, ...PATH_KINDS.filter(k => (PATH_FROM[k] ?? 0) <= this.level)];
  }

  /**
   * Grond staat in twee groepen: grond voor in de verblijven (waar de dieren van houden) en paden voor het park
   * (waar de gasten over lopen). Zolang er nog geen pad is, is er maar één groep.
   */
  private terrainGroups(): { pen: Terrain[]; park: Terrain[] } {
    const all = this.terrainOptions();
    return { pen: all.filter(k => !PATH_KINDS.includes(k)), park: all.filter(k => PATH_KINDS.includes(k)) };
  }

  private foodList(): FoodId[] {
    return this.unlocked(FOODS, ['veg', 'hay'], sp => SPECIES[sp].food);
  }

  private bedOptions(): BedKind[] {
    return this.unlocked(BEDS, ['straw', 'shed'], sp => SPECIES[sp].bed);
  }

  /** Wat onder de knop Winkel staat: kramen, het restaurant en de attracties. De rest staat onder Park. */
  private shopOptions(): ShopKind[] {
    return SHOPS.filter(k => this.has(k) && !parkShopGroup(k));
  }

  /**
   * Onder de knop Park staan ook dingen die je anders neerzet dan een versiering: het kleine spul op een kwart tegel
   * (zoals natuur) en de bloembak, wc's, bankjes en speeltoestellen (zoals een winkel). Dit zegt hoe je nu aan het
   * neerzetten bent, aan de hand van wat er bij Park gekozen is.
   */
  private mode(): ToolId {
    // de attracties hebben een eigen knop, maar je zet ze neer zoals een winkel
    if (this.tool === 'rides') return 'shop';
    if (this.tool !== 'decor') return this.tool;
    const id = this.option.decor;
    return id in PROP ? 'prop' : (SHOPS as string[]).includes(id) ? 'shop' : 'decor';
  }

  private propKind(): PropKind {
    return (this.tool === 'decor' ? this.option.decor : this.option.prop) as PropKind;
  }

  private shopKind(): ShopKind {
    return (this.tool === 'decor' ? this.option.decor : this.tool === 'rides' ? this.option.ride : this.option.shop) as ShopKind;
  }

  /** Zet de goede knop klaar voor dit gebouw: bij Winkels, bij Attracties, of bij Park in zijn groep. */
  private pickShop(kind: ShopKind): void {
    const group = parkShopGroup(kind);
    if (group) {
      this.option.decorGroup = group;
      this.option.decor = kind;
    } else if (ATTRACTIONS.includes(kind) || PLAY.includes(kind)) {
      this.option.rideGroup = PLAY.includes(kind) ? 'play' : 'rides';
      this.option.ride = kind;
    } else this.option.shop = kind;
  }

  private fenceOptions(): string[] {
    const needs = new Set(this.species().map(sp => SPECIES[sp].need));
    return ['fence', ...(this.has('keeper') ? ['gate'] : []), ...(needs.has('wall') ? ['wall'] : []), ...(needs.has('net') ? ['net'] : []), ...(needs.has('glass') ? ['glass'] : []),
      ...(this.has('window') ? ['window'] : []), ...(this.has('petting') ? ['picket', 'petgate'] : [])];
  }

  /** De werelden waar je al een dier van hebt. */
  private worldOptions(): string[] {
    const worlds: string[] = WORLDS.slice(0, Math.max(1, Math.ceil(unlockedSpecies(this.level).length / LEVELS_PER_WORLD)));
    // het aquarium is een eigen afdeling, zodra er een zeedier is
    return this.species().some(sp => AQUATIC.includes(sp)) ? [...worlds, 'aqua'] : worlds;
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
    if (!this.has('paths') || this.goingHome()) return 0;
    const base = Math.min(guestsAt(this.level, this.view.speed), 2 + Math.floor(this.animals.filter(a => !a.young).length * 1.3));
    // was de beroemde gast tevreden, dan komen er een poos meer gasten
    return this.clock < this.boostUntil ? Math.round(base * 1.25) : base;
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
    const [cx, cy] = blockCenter(shop);
    const stall = shop as ShopObj;
    // een vieze kraam verkoopt minder: een derde van de gasten loopt door
    if (this.has('upkeep') && (STALLS.includes(shop.kind) || shop.kind === 'restaurant')) {
      if ((stall.dirt ?? 0) >= 1 && Math.random() < 0.35) {
        this.floatAt(icon('dirty'), cx, cy, 1.4);
        // de gast baalt er maar een klein beetje van (een mislukte koop kost anders veel plezier)
        guest.fun = Math.min(1, guest.fun + 0.07);
        return false;
      }
      stall.dirt = Math.min(1, (stall.dirt ?? 0) + DIRT_PER_USE);
    }
    (shop as ShopObj).vendor?.sold();
    this.pulse((shop as ShopObj).mesh, 0.04);
    this.soldAt[shop.kind] = (this.soldAt[shop.kind] ?? 0) + 1;
    if (exact && product) {
      this.sold[product] = (this.sold[product] ?? 0) + 1;
      this.soldAll++;
    }
    if (product) this.floatAt(this.productIcon(product), cx - 0.4, cy, 1.5);
    if (shop.kind === 'foodstall' || shop.kind === 'icecream') sfx('guest.yum', { volume: 0.5, every: 6, at: [cx, cy] });
    this.earn(1, cx, cy);
    return true;
  }

  cheer(guest: Guest): void {
    this.floatAt(icon('heart'), guest.gx, guest.gy, guest.height + 0.2);
    sfx('cheer', { volume: 0.3, every: 5, at: [guest.gx, guest.gy] });
    this.sellPhoto(guest, 0.8);
  }

  guestSound(kind: GuestCue, guest: Guest): void {
    const [volume, every] = GUEST_SOUND[kind] ?? [0.35, 5];
    sfx(kind, { volume, every, at: [guest.gx, guest.gy] });
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

  // ------------------------------------------------------------ de dieren en hun publiek
  /**
   * Wie er per verblijf staat te kijken en welke kinderen erlangs lopen. Een paar keer per tel opnieuw uitgezocht,
   * voor alle verblijven tegelijk; de lijsten zelf blijven dezelfde.
   */
  private crowdAt = -1;
  private crowds = new Map<number, Guest[]>();
  private strollers = new Map<number, Guest[]>();
  /** Waar een kind de vorige keer stond: zo is te zien of het loopt. */
  private lastSpot = new WeakMap<Guest, number>();
  /** Per verblijf: vanaf wanneer er weer een dier iets voor de gasten mag doen. */
  private showNext = new Map<number, number>();

  private syncCrowds(): void {
    if (this.clock >= this.crowdAt && this.clock - this.crowdAt < 0.3) return;
    this.crowdAt = this.clock;
    for (const list of this.crowds.values()) list.length = 0;
    for (const list of this.strollers.values()) list.length = 0;
    const add = (lists: Map<number, Guest[]>, regionId: number, g: Guest): void => {
      let list = lists.get(regionId);
      if (!list) lists.set(regionId, (list = []));
      if (!list.includes(g)) list.push(g);
    };
    for (const g of this.guests.guests) {
      if (g.gone) continue;
      if (g.watching) {
        // kijkt naar een verblijf (of staat erin, in de kinderboerderij)
        const region = g.face && this.grid.enclosureAt(Math.floor(g.face[0]), Math.floor(g.face[1]));
        if (region) add(this.crowds, region.id, g);
        continue;
      }
      if (!g.child || g.inside || g.riding) continue;
      // een kind dat loopt (het staat niet meer waar het net stond) op een tegel naast een verblijf
      const spot = g.gx + g.gy * 1000, was = this.lastSpot.get(g);
      this.lastSpot.set(g, spot);
      if (was === undefined || Math.abs(spot - was) < 0.05) continue;
      const x = Math.floor(g.gx), y = Math.floor(g.gy);
      for (let k = 0; k < 4; k++) {
        const region = this.grid.enclosureAt(x + (k === 0 ? 1 : k === 1 ? -1 : 0), y + (k === 2 ? 1 : k === 3 ? -1 : 0));
        if (region) add(this.strollers, region.id, g);
      }
    }
  }

  watchers(regionId: number): readonly Guest[] {
    this.syncCrowds();
    return this.crowds.get(regionId) ?? NOBODY;
  }

  passers(regionId: number): readonly Guest[] {
    this.syncCrowds();
    return this.strollers.get(regionId) ?? NOBODY;
  }

  /** Per verblijf doet er om de vijf tot negen tellen één dier iets voor de gasten: niet allemaal tegelijk. */
  showTurn(regionId: number): boolean {
    const next = this.showNext.get(regionId);
    if (next !== undefined && this.clock < next && next - this.clock < 20) return false;
    this.showNext.set(regionId, this.clock + 5 + Math.random() * 4);
    return true;
  }

  /** Een dier laat zijn kunstje zien: wie staat te kijken, krijgt er een beetje plezier bij. */
  showOff(animal: Animal): void {
    for (const g of this.watchers(this.regionAt(animal))) g.fun = Math.min(1, g.fun + 0.02);
  }

  /** Een dier laat zich horen bij zijn kunstje. Van brullen schrikken de gasten bij het hek (zie `penMood`). */
  cry(animal: Animal, loud: boolean): void {
    animalSound(animal.species, animal.young, loud ? 0.9 : 0.5, [animal.gx, animal.gy]);
    if (loud) {
      this.loud = animal;
      this.loudAt = this.clock;
    }
  }

  spray(gx: number, gy: number, height: number): void {
    this.view.burst(gx, gy, height, 0xbfe6ff, 2);
    // dit komt een paar keer per tel langs zolang de olifant spuit: het geluid klinkt één keer per keer spuiten
    sfx('animal.spray', { volume: 0.4, every: 4, at: [gx, gy] });
  }

  /** Het geluid bij een kunstje van een dier (stampen, klappen met de vinnen, op de buik glijden, pronken, de plons na een sprong). */
  trickSound(animal: Animal, kind: TrickSound): void {
    const [id, volume, rate] = TRICK_SOUND[kind];
    sfx(id, { volume, rate: rate * (animal.young ? 1.25 : 1), every: 2.5, at: [animal.gx, animal.gy] });
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
    // midden in de nacht slaapt alles en is er geen personeel: dan komt er geen honger bij
    if (this.deepNight()) return 0;
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
    return serves ? Math.max(1, Math.ceil(crowdLoad(this.capacity()) / serves)) : 1;
  }

  /** Welk deel van de gasten bij dit soort kraam geen plek vindt: te weinig kramen voor zoveel gasten. */
  busy(kind: ShopKind): number {
    const serves = SERVES[kind];
    // alle speeltoestellen tellen samen als plek om te spelen
    const pool = kind === 'playground' ? PLAY : [kind];
    const have = this.shops.filter(s => pool.includes(s.kind)).length;
    const guests = crowdLoad(this.guests.guests.length);
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
      let score = 0.12 + 0.06 * here.filter(a => a.happy).length - (this.poopsIn(region.id) > MAX_POOPS_CLEAN ? 0.1 : 0) - (this.litterOn(tile) ? 0.05 : 0);
      const species = [...new Set(here.map(a => a.species))];
      // door glas of een kijkruit zie je de dieren beter; vriendjes samen en een zeldzame kleur zijn extra leuk
      const fence = this.grid.getEdge(dy === -1 ? { o: 'h', x, y } : dy === 1 ? { o: 'h', x, y: y + 1 } : dx === -1 ? { o: 'v', x, y } : { o: 'v', x: x + 1, y });
      if (fence === 5 || fence === 6) score *= 1.4;
      if (species.some(sp => palsOf(sp).some(pal => species.includes(pal)))) score += 0.05;
      score += 0.05 * Math.min(2, here.filter(a => a.rare).length);
      // een dier dat net zijn kunstje laat zien aan de gasten: dat is extra leuk om te zien
      if (here.some(a => a.showing)) score += 0.04;
      if (!best || score > best.score) best = { score, x: x + dx + 0.5, y: y + dy + 0.5, species };
    }
    return best;
  }

  /** Het dier dat zich het laatst liet horen, en wanneer: een gast die ernaar kijkt, schrikt even. */
  private loud: Animal | null = null;
  private loudAt = 0;

  /** Wat de dieren doen in het verblijf waar een gast vanaf deze padtegel naar kijkt: een optelsom van PEN. */
  penMood(tile: number): number {
    const view = this.viewScore(tile);
    const region = view && this.grid.enclosureAt(Math.floor(view.x), Math.floor(view.y));
    if (!region) return 0;
    const [x, y] = tileXY(tile);
    let mood = this.poopsIn(region.id) > MAX_POOPS_CLEAN ? PEN.dirty : 0, awake = 0;
    for (const a of this.animals) {
      if (this.grid.regionOf[a.tile] !== region.id) continue;
      if (a.sick) mood |= PEN.sick;
      else if (!a.sleeping) {
        awake++;
        const doing = a.doing;
        if (doing === 'play' || doing === 'jump' || doing === 'roll' || doing === 'leap' || doing === 'happy' || a.showing) mood |= PEN.playing;
        // vlak bij het hek, of het dier liet zich net horen: daar schrikt een gast van
        if (Math.hypot(a.gx - x - 0.5, a.gy - y - 0.5) < 1.1 || (a === this.loud && this.clock - this.loudAt < 1.5)) mood |= PEN.scare;
      }
    }
    return awake || mood & PEN.sick ? mood : mood | PEN.asleep;
  }

  /** Loopt er een ontsnapt dier vlak bij dit punt? Zo ja, dan staat in `out` waar het is. */
  looseNear(gx: number, gy: number, out: [number, number]): boolean {
    for (const a of this.animals) {
      if (!a.escaped || Math.abs(a.gx - gx) > 2.6 || Math.abs(a.gy - gy) > 2.6) continue;
      out[0] = a.gx;
      out[1] = a.gy;
      return true;
    }
    return false;
  }

  /** Staat er een regenboog aan de hemel? Dan wijzen de gasten ernaar. */
  rainbowUp(): boolean {
    return this.rainbow > 3;
  }

  /** Ligt er een regenplas op deze tegel? Kinderen stampen erin. */
  puddleOn(tile: number): boolean {
    for (const p of this.rainPuddles) if (tileIndex(Math.floor(p.gx), Math.floor(p.gy)) === tile) return true;
    return false;
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
    // wie voor het eerst het witte hekje kiest, krijgt de uitleg van de kinderboerderij
    if (id === 'fence' && (option === 'picket' || option === 'petgate') && !this.told.has('petting')) this.showPettingGuide();
    this.lastInput = this.clock;
    this.hideHand();
    this.tool = id;
    this.linger = null;
    this.moving = null;
    if (row && option && row in this.option) this.option[row as keyof typeof this.option] = option;
    if (option) this.fresh.delete(option);
    // een ander ding begint weer recht; kies je hetzelfde nog een keer, dan staat het zoals je het had gedraaid
    if (this.canSpin()) {
      const key = `${id}:${(this.option as Record<string, string>)[id]}`;
      if (key !== this.quarterKey) this.quarter = this.spins = 0;
      this.quarterKey = key;
    }
    this.hud.hideMenu();
    this.view.hideGhost();
    this.refreshTools(true);
  }

  /** Hoeveel kwartslagen het ding dat je gaat neerzetten gedraaid is (de draaiknop, of de toets R). */
  private quarter = 0;
  private quarterKey = '';
  /** Hoe vaak er op de draaiknop is gedrukt: zo draait het pijltje op de knop steeds dezelfde kant op. */
  private spins = 0;
  /** Waar de vinger of muis het laatst was: daar verschijnt het voorbeeld na het draaien. */
  private lastHover: [number, number] | null = null;

  /** Kun je wat je nu vasthebt draaien? Voerbak, slaapplek, speelgoed, alles van Park en alle winkels. */
  private canSpin(): boolean {
    return this.tool === 'trough' || this.tool === 'bed' || this.tool === 'toy' || this.tool === 'prop' || this.tool === 'decor' || this.tool === 'shop' || this.tool === 'rides';
  }

  /** De draaiknop: het ding dat je gaat neerzetten draait een kwartslag; het voorbeeld laat meteen zien hoe het komt te staan. */
  private spinGhost(): void {
    if (!this.canSpin()) return;
    this.quarter = (this.quarter + 1) % 4;
    this.spins++;
    this.hud.setSpin(true, this.spins, (this.option as Record<string, string>)[this.tool] ?? '');
    const box = this.view.renderer.domElement.getBoundingClientRect();
    const [cx, cy] = this.lastHover ?? [box.left + box.width / 2, box.top + box.height / 2];
    this.hover(cx, cy, false);
  }

  /** Iets op een rand een halve slag gedraaid? (De draaiknop een of drie keer ingedrukt.) */
  private get flip(): 1 | -1 {
    return this.quarter % 2 ? -1 : 1;
  }

  /**
   * Hoe een bord, heg of bloemperk op deze rand komt te liggen: langs de rand, met de voorkant naar het pad (of
   * naar de kant waar je tikt), en andersom als je de draaiknop hebt gebruikt. In kwartslagen, zoals bij een gebouw.
   */
  private edgeRot(e: Edge, side: 1 | -1): number {
    const face = this.faceFor(e, side) * this.flip;
    return e.o === 'h' ? (face > 0 ? 0 : 2) : face > 0 ? 1 : 3;
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
    const shown = species.filter(sp => (HOME[sp] ?? 'aqua') === this.option.world);
    pickFrom('animal', shown);
    const grounds = this.terrainGroups();
    if (this.option.terrainGroup === 'park' && !grounds.park.length) this.option.terrainGroup = 'pen';
    // het gekozen stuk grond hoort bij de groep die open staat; wissel je van groep, dan komt het eerste van die groep
    const ground = this.option.terrainGroup === 'park' ? grounds.park : grounds.pen;
    if (!ground.includes(this.option.terrain as Terrain)) this.option.terrain = ground[0] ?? 'grass';
    pickFrom('bed', this.bedOptions());
    // voor het park speel je bijna elk level iets vrij
    const decors = DECORS.filter(k => DECOR[k].from <= this.level);
    // onder Park staat alles in groepen; in een groep staan versieringen, klein spul (op een kwart tegel) en
    // gebouwtjes (de bloembak, wc, bankje, speeltoestellen) door elkaar
    const parkProps = PARK_PROPS.filter(k => (PROP[k].from ?? 0) <= this.level);
    const parkIds = (group: string): string[] =>
      group === 'small' ? parkProps : [...decors.filter(k => DECOR[k].group === group), ...SHOPS.filter(k => this.has(k) && parkShopGroup(k) === group)];
    const decorGroups: string[] = PARK_GROUPS.filter(g => parkIds(g).length);
    if (!decorGroups.includes(this.option.decorGroup)) this.option.decorGroup = decorGroups[0] ?? 'green';
    pickFrom('decor', parkIds(this.option.decorGroup));
    // de kramen staan onder de knop Winkels; de speeltuin en de grote attracties onder de knop Attracties
    const rides = this.shopOptions().filter(k => ATTRACTIONS.includes(k)), plays = this.shopOptions().filter(k => PLAY.includes(k));
    const stalls = this.shopOptions().filter(k => !ATTRACTIONS.includes(k) && !PLAY.includes(k));
    if (this.option.rideGroup === 'rides' ? !rides.length : !plays.length) this.option.rideGroup = plays.length ? 'play' : 'rides';
    const rideRow = this.option.rideGroup === 'rides' ? rides : plays;
    pickFrom('ride', rideRow);
    pickFrom('shop', stalls);
    pickFrom('fence', this.fenceOptions());
    const toys = TOYS.filter(k => TOY_FROM[k] <= this.level);
    pickFrom('toy', toys);
    // natuur is er meteen helemaal
    const propRow = WILD_PROPS;
    if (!propRow.includes(this.option.prop as PropKind)) this.option.prop = propRow[0];
    const roles = (Object.keys(STAFF_FROM) as WorkerRole[]).filter(r => this.has(STAFF_FROM[r]));
    pickFrom('staff', roles);
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
        fresh: this.terrainOptions().some(k => this.fresh.has(k)),
        rows: [
          // van onder naar boven: de knop Grond, de groep (voor dieren of paden), en daarboven de soorten grond
          { key: 'terrain', active: this.option.terrain, options: ground.map(k => ({ ...opt(k, k, t(`terrain.${k}`)), fresh: this.fresh.has(k) })) },
          ...(grounds.park.length ? [{
            key: 'terrainGroup', active: this.option.terrainGroup,
            options: [
              { ...opt('pen', 'paw', t('terrain.group.pen')), fresh: grounds.pen.some(k => this.fresh.has(k)) },
              { ...opt('park', 'pathway', t('terrain.group.park')), fresh: grounds.park.some(k => this.fresh.has(k)) },
            ],
          }] : []),
        ],
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
        fresh: toys.some(k => this.fresh.has(k)),
        rows: [{ key: 'toy', active: this.option.toy, options: toys.map(k => ({ ...opt(k, k, t(`toy.${k}`), TOY_PRICE[k] ?? PRICE.toy), fresh: this.fresh.has(k) })) }],
      });
    // natuur voor in de verblijven: graspollen, bloemetjes, stenen en bomen, per kwart tegel
    if (this.has('wild'))
      defs.push({
        ...opt('prop', 'tuft', t('tool.prop')),
        rows: [{ key: 'prop', active: this.option.prop, options: propRow.map(k => ({ ...opt(k, PROP_ICON[k], t(`prop.${k}`), PROP[k].price), fresh: this.fresh.has(k) })) }],
      });
    if (this.has('decor')) {
      // een knop voor een versiering, voor klein spul of voor een gebouwtje: elk met zijn eigen plaatje, naam en prijs
      const parkOpt = (k: string) =>
        k in PROP ? opt(k, PROP_ICON[k as PropKind], t(`prop.${k}`), PROP[k as PropKind].price)
          : (SHOPS as string[]).includes(k) ? opt(k, k as IconId, t(`shop.${k}`), SHOP_PRICE[k as ShopKind])
            : opt(k, k as IconId, t(`decor.${k}`), DECOR[k as DecorKind].price);
      defs.push({
        ...opt('decor', 'parkgate', t('tool.decor')),
        fresh: decorGroups.some(g => parkIds(g).some(k => this.fresh.has(k))),
        rows: [
          // van onder naar boven: de knop Park, de groepen, en daarboven wat je uit die groep neerzet
          { key: 'decor', active: this.option.decor, options: parkIds(this.option.decorGroup).map(k => ({ ...parkOpt(k), fresh: this.fresh.has(k) })) },
          { key: 'decorGroup', active: this.option.decorGroup, options: decorGroups.map(g => ({ ...opt(g, PARK_GROUP_ICON[g], t(`decor.group.${g}`)), fresh: parkIds(g).some(k => this.fresh.has(k)) })) },
        ],
      });
    }
    if (stalls.length)
      defs.push({
        ...opt('shop', 'shopmix', t('tool.shop')),
        fresh: stalls.some(k => this.fresh.has(k)),
        rows: [{ key: 'shop', active: this.option.shop, options: stalls.map(k => ({ ...opt(k, k, t(`shop.${k}`), SHOP_PRICE[k]), fresh: this.fresh.has(k) })) }],
      });
    // de knop Attracties: de speeltuin (glijbaan, schommel, ...) en de grote attracties (fontein, uitkijktoren,
    // draaimolen, treintje, botsauto's, reuzenrad), elk in een eigen groep zodra ze er allebei zijn
    if (rides.length || plays.length)
      defs.push({
        ...opt('rides', 'carousel', t('tool.rides')),
        fresh: [...rides, ...plays].some(k => this.fresh.has(k)),
        rows: [
          { key: 'ride', active: this.option.ride, options: rideRow.map(k => ({ ...opt(k, k, t(`shop.${k}`), SHOP_PRICE[k]), fresh: this.fresh.has(k) })) },
          ...(rides.length && plays.length ? [{
            key: 'rideGroup', active: this.option.rideGroup,
            options: [
              { ...opt('play', 'slide', t('decor.group.play')), fresh: plays.some(k => this.fresh.has(k)) },
              { ...opt('rides', 'ferris', t('shop.group.rides')), fresh: rides.some(k => this.fresh.has(k)) },
            ],
          }] : []),
        ],
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
        rows: [{ key: 'staff', active: this.option.staff, options: roles.map(r => ({ id: r, icon: icon(ROLE_ICON[r]), label: t(`staff.${r}`), price: WAGE, per: true })) }],
      });
    defs.push(opt('erase', 'erase', t('tool.erase')));
    const grouped = TOOL_GROUPS.flatMap(([group, ids]) => ids.flatMap(id => defs.filter(d => d.id === id).map(d => ({ ...d, group }))));
    this.hud.setTools(grouped, this.tool, hint, this.linger);
    this.hud.setSpin(this.canSpin() && !this.moving, this.spins, (this.option as Record<string, string>)[this.tool] ?? '');
    // boven het gekozen hek hangen twee knoppen met het plaatje van dat hek: een heel hok slepen, of los plaatsen
    // (een poort, kijkruit of poortje zet je altijd los neer: daar valt niets te kiezen)
    const fenceKind = FENCE_KIND[this.option.fence], fenceIcon = icon(this.option.fence as IconId);
    const choice = this.tool === 'fence' && !this.moving && fenceKind !== 2 && fenceKind !== 6 && fenceKind !== 8;
    this.hud.setPick(choice ? [
      { id: 'box', icon: fenceIcon + icon('fencebox', 'mark'), label: t('fence.mode.box'), on: this.option.fenceMode === 'box' },
      { id: 'loose', icon: fenceIcon, label: t('fence.mode.loose'), on: this.option.fenceMode !== 'box' },
    ] : null, this.option.fence, id => {
      this.option.fenceMode = id;
      sfx('tap');
      this.refreshTools(true);
    });
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
      case 'shop': return goal.shop && parkShopGroup(goal.shop) ? 'decor' : goal.shop && (ATTRACTIONS.includes(goal.shop) || PLAY.includes(goal.shop)) ? 'rides' : 'shop';
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
    const at = line.at, tap = at && at() ? () => this.showSpot(at) : null;
    // af en toe noemt het figuur de speler eerst bij zijn naam: "Senna, de gasten hebben honger."
    const call = this.player && !line.key.startsWith('name.') && !line.vars?.name ? voiceId(line.who, callText(t, this.player)) : '';
    if (call && this.clock - this.namedAt > 40 && Math.random() < 0.35 && hasVoice(call) && hasVoice(id)) {
      this.namedAt = this.clock;
      this.hud.say(line.who, line.mood, `${this.player}, ${text.charAt(0).toLowerCase()}${text.slice(1)}`, playVoice([call, id]), tap);
    } else this.hud.say(line.who, line.mood, text, playVoice(id), tap);
  }

  /** Een melding die over dit dier, deze gast of deze plek gaat: tik je erop, dan gaat het beeld erheen. */
  private lineAbout(line: Line, who: Animal | Guest | { gx: number; gy: number }): Line {
    return {
      ...line,
      at: () => {
        // weg uit het park? Dan valt er niets meer aan te wijzen
        if (who instanceof Animal ? !this.animals.includes(who) : 'wish' in who && !this.guests.guests.includes(who)) return null;
        return [who.gx, who.gy];
      },
    };
  }

  /** Het beeld gaat naar waar de melding over ging, en die plek licht een paar tellen op. */
  private showSpot(at: () => [number, number] | null): void {
    const spot = at();
    if (!spot) return;
    this.view.flyTo(spot[0], spot[1]);
    this.pointed = { at, until: this.clock + 6 };
    sfx('tap');
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
    // de uitleg van iets nieuws hoor je één keer: niet opnieuw als je het spel later weer opent in hetzelfde level
    const once = (line: Line): void => {
      if (this.told.has(`new.${line.key}`)) return;
      this.told.add(`new.${line.key}`);
      this.lines.push(line);
    };
    if (this.level === FEATURE.fun) once(say.funNew());
    if (this.level === FEATURE.decor) once(say.decorNew());
    if (this.level === FEATURE.petting) once(say.pettingNew());
    if (this.level === FEATURE.climate) once(say.climateNew());
    if (this.level === FEATURE.wild) once(say.wildNew());
    if (this.level === FEATURE.night) once(say.nightNew());
    if (this.level === FEATURE.guard) once(say.guardNew());
    if (this.level === BONUS.dolphin && hasSpecies('dolphin')) once(say.aquaNew());
    // vanaf nu kun je hulp aannemen: de verzorger vertelt hoe
    if (this.level === FEATURE.keeper) this.showStaffGuide();
    // de lucht, het gras en het achtergrondgeluid blijven overal hetzelfde: ze wisselen niet meer per wereld
    this.view.setWorld('farm');
    ambience('amb.farm');
    music();
    layer('amb.wind', 0.6);
    // de knop voor het eerste doel staat alvast op de goede keuze
    const first = level?.goals[0];
    if (first?.type === 'path') this.option.terrain = 'path';
    for (const g of level?.goals ?? []) if (g.type === 'shop' && g.shop && !this.stats.shops[g.shop]) this.pickShop(g.shop);
    // een kraam die er al was, kan vanaf nu iets nieuws verkopen
    if (PRODUCTS.some(p => p.from === this.level && p.from > FEATURE[p.shop]) && !this.told.has(`products.${this.level}`)) {
      this.told.add(`products.${this.level}`);
      this.lines.push(say.host('new', 'happy'));
    }
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

  private addWorker(role: WorkerRole, gx: number, gy: number, suit = 0, cart = false): Worker {
    const worker = new Worker(gx, gy, role);
    if (suit) worker.setSuit(suit);
    if (cart) worker.setCart(true);
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
    const items: ToolOption[] = [{ id: 'suit', icon: icon('suit'), label: t('staff.suit') }];
    // een karretje: daarmee loopt en werkt hij sneller
    if (this.has('cart') && !worker.cart && CART_ROLES.includes(worker.role)) items.push({ id: 'cart', icon: icon('cart'), label: t('staff.cart'), price: CART_PRICE, cant: this.coins < CART_PRICE });
    items.push({ id: 'bye', icon: icon('empty'), label: t('staff.bye') });
    this.hud.showMenu(s.x, s.y, t(`staff.${worker.role}`), items, id => {
      if (id === 'suit') {
        const swatches: ToolOption[] = SUIT_COLORS.map((c, i) => ({ id: String(i), icon: `<span class="swatch" style="background:#${c.toString(16).padStart(6, '0')}"></span>`, label: '', on: i === worker.suit }));
        this.hud.showMenu(s.x, s.y, t('staff.suit.pick'), swatches, pick => {
          worker.setSuit(Number(pick));
          sfx('paint');
          this.floatAt(icon('sparkle'), worker.gx, worker.gy, worker.height);
          void this.save();
        });
      } else if (id === 'cart') {
        if (!this.pay(CART_PRICE, worker.gx, worker.gy)) return;
        worker.setCart(true);
        sfx('place');
        this.floatAt(icon('cart'), worker.gx, worker.gy, worker.height);
      } else {
        this.removeWorker(worker);
        sfx('erase');
      }
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

  /** Poep, afval en vieze kramen: bij elke vieze kraam hoort één vast briefje, zodat er maar één schoonmaker op afgaat. */
  private grime = new Map<ShopObj, { gx: number; gy: number; shop: ShopObj }>();
  cleanJobs(): KeeperPoop[] {
    for (const shop of [...this.grime.keys()]) if (!this.shops.includes(shop) || (shop.dirt ?? 0) < 1) this.grime.delete(shop);
    for (const shop of this.shops) if ((shop.dirt ?? 0) >= 1 && !this.grime.has(shop)) this.grime.set(shop, { gx: blockCenter(shop)[0], gy: blockCenter(shop)[1], shop });
    return [...this.poops, ...this.litter, ...this.grime.values()];
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
    const grimy = (mess as { shop?: ShopObj }).shop;
    if (grimy) return this.cleanShop(grimy, false);
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
    this.alert(this.lineAbout(say.noGate(), { gx, gy }));
  }

  /** Een nieuw uur: elke werker krijgt loon. Is het geld op, dan wachten de werkers die niets kregen. */
  private payWages(): void {
    let short = false;
    // wie naar huis is, krijgt dat uur geen loon
    const here = this.workers.filter(w => !w.away);
    for (const worker of here) {
      worker.paid = this.coins >= WAGE;
      if (worker.paid) this.coins -= WAGE;
      else short = true;
    }
    if (here.length) sfx('coin', { volume: 0.35, every: 1 });
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

  // ------------------------------------------------------------ grond erbij
  /** Het beeld volgt de grond van het park: tegels, bomen en de bordjes Te koop. */
  private syncLand(): void {
    this.view.setLand(this.grid.land, SIDES.filter(side => !this.grid.owns(side)), side => this.grid.plot(side));
    for (const side of SIDES) {
      if (this.grid.owns(side)) {
        this.landSigns.get(side)?.remove();
        this.landSigns.delete(side);
      } else if (!this.landSigns.has(side)) this.landSigns.set(side, this.hud.makeForSale(LAND_PRICE, () => this.landMenu(side)));
    }
  }

  /** De strook die te koop is op dit punt, als die er is. */
  private plotAt(gx: number, gy: number): Side | null {
    for (const side of SIDES) {
      if (this.grid.owns(side)) continue;
      const p = this.grid.plot(side);
      if (gx >= p.x0 && gx < p.x1 && gy >= p.y0 && gy < p.y1) return side;
    }
    return null;
  }

  /** Tik op een strook grond die te koop is: kopen voor LAND_PRICE munten. */
  private landMenu(side: Side): void {
    const [cx, cy] = this.view.plotCenter(this.grid.plot(side));
    const s = this.view.toScreen(cx, cy, 1.6);
    this.hud.showMenu(s.x, s.y, t('land.title'), [{ id: 'buy', icon: icon('land'), label: t('land.buy'), price: LAND_PRICE, cant: this.coins < LAND_PRICE }], () => this.buyLand(side));
  }

  private buyLand(side: Side): void {
    const plot = this.grid.plot(side);
    const [cx, cy] = this.view.plotCenter(plot);
    if (this.grid.owns(side) || !this.pay(LAND_PRICE, cx, cy)) return;
    this.grid.expand(side);
    this.syncLand();
    this.view.paintTerrain(this.grid);
    this.gridChanged();
    // feest: de nieuwe grond licht op en het beeld schuift ernaartoe
    const tiles: number[] = [];
    for (let y = plot.y0; y < plot.y1; y++) for (let x = plot.x0; x < plot.x1; x++) tiles.push(tileIndex(x, y));
    this.view.flash(tiles);
    this.view.flyTo(cx, cy);
    sfx('fanfare');
    for (let k = 0; k < 9; k++) setTimeout(() => this.floatAt(icon('sparkle'), plot.x0 + Math.random() * (plot.x1 - plot.x0), plot.y0 + Math.random() * (plot.y1 - plot.y0), 0.4), k * 120);
    this.sayNow(say.bigger());
    void this.save();
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

  /**
   * De verblijven waar het feest is als dit level gehaald is: die van de dieren waar het level om ging. Ging het
   * level niet over een dier (munten, gasten, een kraam), dan het verblijf met dieren het dichtst bij waar je kijkt.
   */
  private partyPens(level: Level): Pen[] {
    const stars = new Set(level.goals.map(g => g.species).filter((sp): sp is SpeciesId => !!sp));
    const lived = this.pens.filter(pen => this.animalsIn(pen.region.id).length);
    const named = lived.filter(pen => this.animalsIn(pen.region.id).some(a => stars.has(a.species)));
    if (named.length) return named;
    const at = this.view.target, far = (pen: Pen): number => Math.hypot(toWorldX(pen.cx) - at.x, toWorldZ(pen.cy) - at.z);
    return lived.sort((p, q) => far(p) - far(q)).slice(0, 1);
  }

  private penAt(x: number, y: number): Pen | undefined {
    const region = this.grid.enclosureAt(x, y);
    return region ? this.pens.find(p => p.region.id === region.id) : undefined;
  }

  private gridChanged(): void {
    this.syncPens(true);
    this.syncWear();
    this.poseEdgeDecors();
  }

  /** Tekent de hekken opnieuw met hun slijtage en houdt bij welke verblijven een kapot hek hebben. */
  private syncWear(): void {
    const wood = new Set(this.grid.edges().filter(x => x.kind === 1).map(x => edgeKey(x.e)));
    for (const key of [...this.wear.keys()]) if (!wood.has(key)) this.wear.delete(key);
    // elk verblijf kleurt zijn eigen hek; een hek tussen twee verblijven krijgt de kleur van het laatste
    const tints = new Map<string, number>();
    for (const pen of this.pens) if (pen.color) for (const e of this.grid.borderEdges(pen.region)) tints.set(edgeKey(e), pen.color);
    this.view.syncFences(this.grid, this.wear, tints);
    this.syncTanks();
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
    sfx('tap', { every: 0.1 });
    this.floatAt(icon('litter'), p.gx, p.gy, 0.4);
  }

  /** Alles wat je in je handen hebt gaat in de afvalbak: een munt per stuk. */
  private dump(bin: ShopObj): void {
    const [x, y] = edgePose(bin);
    this.tidied += this.carry;
    this.earn(this.carry, x, y);
    this.carry = 0;
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
    // alles wat in het park staat beweegt een beetje: het beeld weet per ding hoe
    for (const d of this.decors) this.view.animateDecor(d.mesh, d.kind, t, d.x * 2 + d.y);
  }

  /** Het verblijf onder de muis (met het handje) en het verblijf waarvan het menu open staat: die lichten zacht op. */
  private hoverPen: Pen | null = null;
  /** Waar de muis boven hangt en waar een tik een menu opent (dier, gast, werker, voerbak, winkel): daar komt een ring. */
  private hoverAt: { at: () => [number, number]; w: number; h: number } | null = null;
  /** De tegels en randen die nu wit oplichten onder wat je aanwijst, en voor welk blok dat was uitgerekend. */
  private hoverGlow: { key: string; tiles: number[]; edges: Edge[] } = { key: '', tiles: [], edges: [] };

  /** Het witte vlak met rand onder een blok tegels (een kraam, een voerbak, of de tegel waar een dier of gast op staat). */
  private glowBlock(x: number, y: number, w: number, h: number): { tiles: number[]; edges: Edge[] } {
    const glow = this.hoverGlow, key = `${x},${y},${w},${h}`;
    if (glow.key === key) return glow;
    glow.key = key;
    glow.tiles = [];
    glow.edges = [];
    for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) if (this.grid.inBounds(x + dx, y + dy)) glow.tiles.push(tileIndex(x + dx, y + dy));
    for (let dx = 0; dx < w; dx++) glow.edges.push({ o: 'h', x: x + dx, y }, { o: 'h', x: x + dx, y: y + h });
    for (let dy = 0; dy < h; dy++) glow.edges.push({ o: 'v', x, y: y + dy }, { o: 'v', x: x + w, y: y + dy });
    return glow;
  }
  private menuPen: Pen | null = null;

  private penMenu(pen: Pen): void {
    this.menuPen = pen;
    const s = this.view.toScreen(pen.cx, pen.cy, 0.5);
    const opt = (id: string, ic: IconId, key: string, price = 0): ToolOption => ({ id, icon: icon(ic), label: t(key), price: price || undefined, cant: price > this.coins });
    const items = [opt('color', 'paint', 'pen.color'), opt('rename', 'dice', 'pen.rename')];
    items.push(opt('empty', 'empty', 'pen.empty'));
    const header = '';
    this.hud.showMenu(s.x, s.y, pen.name, items, id => {
      if (id === 'color') {
        // tien kleuren die bij dit soort hek horen: hout, steen of net
        const colors = FENCE_COLORS[this.grid.penKind(pen.region) as 1 | 3 | 4 | 5 | 7] ?? FENCE_COLORS[1];
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
    return this.shops.find(s => !s.edge && x >= s.x && x < s.x + shopTiles(s)[0] && y >= s.y && y < s.y + shopTiles(s)[1]);
  }

  /** Het bankje, de bloembak of de afvalbak op deze rand. */
  private edgeItemAt(e: Edge): ShopObj | undefined {
    return this.shops.find(s => s.edge === e.o && s.x === e.x && s.y === e.y);
  }

  /** Aan welke kant van de rand ligt het pad? 1 = zuid of oost, -1 = noord of west, 0 = aan geen of aan beide kanten. */
  private edgeFace(e: Edge): number {
    const onPath = (x: number, y: number): boolean => this.grid.inBounds(x, y) && isPath(this.grid.terrain[tileIndex(x, y)]);
    const before = e.o === 'h' ? onPath(e.x, e.y - 1) : onPath(e.x - 1, e.y), after = onPath(e.x, e.y);
    return before === after ? 0 : after ? 1 : -1;
  }

  /**
   * Mag hier iets op de rand staan (bankje, afvalbak, bloembak, paraplubak)? Niet dubbel, en niet in of tegen een
   * gebouw. Op een vrije rand niet tegen een verblijf aan. Staat er een hek, dan mag het er net naast, aan de kant
   * buiten het verblijf en met het gezicht naar het hek (zo kijk je vanaf een bankje naar de dieren); niet bij een poort.
   */
  private edgeFits(e: Edge): boolean {
    if (!this.grid.validEdge(e) || this.edgeItemAt(e) || this.edgeDecorAt(e)) return false;
    const sides = edgeSides({ x: e.x, y: e.y, edge: e.o });
    if (!sides.length) return false;
    const free = (i: number): boolean => {
      const [x, y] = tileXY(i);
      return !this.grid.enclosureAt(x, y) && !this.shopAt(x, y) && this.grid.terrain[i] !== WATER;
    };
    const fence = this.grid.getEdge(e);
    if (fence !== 0) return fence !== 2 && fence !== 8 && sides.length === 2 && sides.filter(free).length === 1;
    return sides.every(free);
  }

  /**
   * Staat er een hek op deze rand, dan staat een bankje of bak aan de kant buiten het verblijf en kijkt het naar het
   * hek: 1 of -1. Zonder hek 0 (dan kiest het pad of de speler de kant).
   */
  private fencedFace(e: Edge): number {
    if (this.grid.getEdge(e) === 0) return 0;
    // het ding staat een stukje van de rand af, aan de kant waar het vanaf kijkt; tegel (x, y) is de zuid- of oostkant
    return this.grid.inBounds(e.x, e.y) && !this.grid.enclosureAt(e.x, e.y) ? -1 : 1;
  }

  /** De rand van tegel (x, y) waar een los ding uit een ouder spel het best past: het liefst langs het pad. */
  private edgeNear(x: number, y: number): Edge | null {
    const options: Edge[] = [{ o: 'h', x, y }, { o: 'h', x, y: y + 1 }, { o: 'v', x, y }, { o: 'v', x: x + 1, y }];
    const fits = options.filter(e => this.edgeFits(e));
    return fits.find(e => this.edgeFace(e) !== 0) ?? fits[0] ?? null;
  }

  /**
   * Naar welke kant iets op een rand kijkt. Ligt er aan één kant pad, dan staat het op de rand van dat pad en
   * kijkt het naar het pad (bij iets uit een ouder spel dat toen was omgedraaid: er juist vanaf). Ligt er aan beide
   * kanten pad, of aan geen van beide, dan telt de kant waar de speler bij het neerzetten tikte (`set`).
   */
  private faceOf(s: { x: number; y: number; edge?: 'h' | 'v'; turned?: boolean; set?: number }): number {
    const fenced = this.fencedFace({ o: s.edge!, x: s.x, y: s.y });
    if (fenced) return fenced;
    const auto = this.edgeFace({ o: s.edge!, x: s.x, y: s.y });
    if (auto) return s.turned ? -auto : auto;
    return s.set || (s.turned ? -1 : 1);
  }

  /**
   * Op welke rand komt een bankje, bloembak of afvalbak als je hier tikt? De dichtstbijzijnde, maar de rand van
   * een pad trekt een beetje: tik je op een tegel naast het pad, dan komt het langs het pad te staan en niet
   * er dwars op of midden in het gras.
   */
  private itemEdge(gx: number, gy: number): Edge | null {
    const near = nearestEdge(gx, gy);
    if (!near || this.edgeFace(near) !== 0) return near;
    const tx = Math.max(0, Math.min(W - 1, Math.floor(gx))), ty = Math.max(0, Math.min(H - 1, Math.floor(gy)));
    const fx = gx - tx, fy = gy - ty;
    const options: [number, Edge][] = [
      [Math.abs(fy), { o: 'h', x: tx, y: ty }],
      [Math.abs(1 - fy), { o: 'h', x: tx, y: ty + 1 }],
      [Math.abs(fx), { o: 'v', x: tx, y: ty }],
      [Math.abs(1 - fx), { o: 'v', x: tx + 1, y: ty }],
    ];
    const reach = Math.min(...options.map(o => o[0])) + PATH_PULL;
    let best: Edge | null = null, bestD = reach;
    for (const [d, e] of options) {
      if (d <= bestD && this.edgeFace(e) !== 0 && this.edgeFits(e)) {
        best = e;
        bestD = d;
      }
    }
    return best ?? near;
  }

  /** Hoe iets op deze rand komt te staan als je aan kant `side` tikt: naar het pad als dat er aan één kant ligt, anders naar jou toe. */
  private faceFor(e: Edge, side: 1 | -1): number {
    return this.fencedFace(e) || this.edgeFace(e) || side;
  }

  /**
   * Naar welke kant een gebouw het best kan kijken: de kant waar het meeste pad tegenaan ligt. Bij gelijk
   * spel het liefst naar het zuiden of oosten, want dan zie je de voorkant. 0 = zuid, 1 = oost, 2 = noord, 3 = west.
   * Een marktkraam is niet vierkant: die kijkt alleen over een lange kant, dus hij draait uit zichzelf hooguit
   * een halve slag. `like`: zo staat hij nu (of zo komt hij te staan).
   */
  private autoRot(x: number, y: number, kind: ShopKind, like = 0): number {
    const sides = this.pathSides(x, y, ...shopSpan(kind, like));
    const turns = SHOP_DEEP[kind] ? [like % 2, (like % 2) + 2] : [0, 1, 2, 3];
    return turns.reduce((best, r) => (sides[r] > sides[best] ? r : best), turns[0]);
  }

  /** Hoeveel tegels pad er tegen elke kant van een blok aan liggen: [zuid, oost, noord, west]. */
  private pathSides(x: number, y: number, w: number, h: number): number[] {
    const onPath = (tx: number, ty: number): number => (this.grid.inBounds(tx, ty) && isPath(this.grid.terrain[tileIndex(tx, ty)]) ? 1 : 0);
    const sides = [0, 0, 0, 0];
    for (let i = 0; i < w; i++) {
      sides[0] += onPath(x + i, y + h);
      sides[2] += onPath(x + i, y - 1);
    }
    for (let i = 0; i < h; i++) {
      sides[1] += onPath(x + w, y + i);
      sides[3] += onPath(x - 1, y + i);
    }
    return sides;
  }

  /** Het pad is veranderd: bankjes, bakken en gebouwen draaien hun gezicht naar het pad. */
  private faceEdgeItems(): void {
    for (const s of this.shops) {
      if (!s.edge) {
        if (!s.manual) s.rot = this.autoRot(s.x, s.y, s.kind, s.rot ?? 0);
        this.view.poseShop(s.mesh, s.x, s.y, s.kind, undefined, s.rot ?? 0);
        continue;
      }
      s.face = this.faceOf(s);
      this.view.poseShop(s.mesh, s.x, s.y, s.kind, { o: s.edge, face: s.face });
    }
  }

  /** Aan welke kant van de rand ligt dit punt? 1 = zuid of oost, -1 = noord of west. Daar kijkt een bankje of bak naartoe. */
  private edgeSide(e: Edge, gx: number, gy: number): 1 | -1 {
    return (e.o === 'h' ? gy >= e.y : gx >= e.x) ? 1 : -1;
  }

  private taken(x: number, y: number): boolean {
    return !!(this.troughAt(x, y) || this.bedAt(x, y) || this.toyAt(x, y) || this.decorAt(x, y) || this.shopAt(x, y));
  }

  private addTrough(x: number, y: number, food: FoodId | null, amount: number, kind: TroughKind = 'wood', rot = 0): TroughObj {
    const tr: TroughObj = { x, y, food, amount, kind, rot, mesh: this.view.makeTrough(x, y, kind, rot) };
    this.view.fillTrough(tr.mesh, food, amount);
    this.troughs.push(tr);
    return tr;
  }

  /** Wat er op deze tegel staat (palen en borden op een rand tellen niet: die nemen geen tegel in). */
  /** Wat er op deze tegel staat. Staan er meer kleine dingen op, dan het ding dat het dichtst bij (gx, gy) staat. */
  private decorAt(x: number, y: number, gx?: number, gy?: number): DecorObj | undefined {
    let best: DecorObj | undefined, bestD = 99;
    for (const b of this.decors) {
      if (b.edge || b.x !== x || b.y !== y) continue;
      if (gx === undefined || gy === undefined) return b;
      const [qx, qy] = quarterAt(b.q), d = Math.hypot(x + qx - gx, y + qy - gy);
      if (d < bestD) [best, bestD] = [b, d];
    }
    return best;
  }

  /** Staat er op dit vakje (een kwart tegel) al iets? Een gebouw, voerbak of grote versiering vult de hele tegel. */
  private cellTaken(cx: number, cy: number): boolean {
    const x = cx >> 1, y = cy >> 1, q = (cx & 1) + (cy & 1) * 2;
    if (this.troughAt(x, y) || this.bedAt(x, y) || this.toyAt(x, y) || this.shopAt(x, y)) return true;
    return this.decors.some(d => !d.edge && d.x === x && d.y === y && (d.q === undefined || d.q === q));
  }

  /** De paal of het bord op deze rand. */
  private edgeDecorAt(e: Edge): DecorObj | undefined {
    return this.decors.find(b => b.edge === e.o && b.x === e.x && b.y === e.y);
  }

  /** Waar een versiering staat: midden op de tegel, of op de rand (naast het hek, als daar een hek staat). */
  private decorPos(d: { x: number; y: number; edge?: 'h' | 'v'; q?: number }): [number, number] {
    const shift = this.decorShift(d) * EDGE_SHIFT, [qx, qy] = quarterAt(d.edge ? undefined : d.q);
    return [d.x + (d.edge === 'v' ? shift : qx), d.y + (d.edge === 'h' ? shift : qy)];
  }

  /**
   * Staat er een hek op de rand van deze versiering, dan schuift hij een stukje op, zodat hij naast het hek staat
   * en binnen de tegel blijft: naar de kant buiten het verblijf (1 = zuid of oost, -1 = noord of west). Zonder
   * hek staat hij midden op de rand (0).
   */
  private decorShift(d: { x: number; y: number; edge?: 'h' | 'v' }): number {
    if (!d.edge || this.grid.getEdge({ o: d.edge, x: d.x, y: d.y }) === 0) return 0;
    const free = (x: number, y: number): boolean => this.grid.inBounds(x, y) && !this.grid.enclosureAt(x, y);
    // de tegel aan de zuid- of oostkant is tegel (x, y) zelf; aan de andere kant ligt zijn buur
    if (free(d.x, d.y)) return 1;
    return (d.edge === 'h' ? free(d.x, d.y - 1) : free(d.x - 1, d.y)) ? -1 : 1;
  }

  /** Er is een hek bij gekomen of weggehaald: wat op een rand staat, schuift naast het hek of weer terug. */
  private poseEdgeDecors(): void {
    for (const d of this.decors) if (d.edge) this.view.poseDecor(d.mesh, d.x, d.y, d.edge, this.decorShift(d));
    this.syncStrings();
  }

  /**
   * Mag hier een paal, bord, heg of bloemperk op de rand? Niet dubbel en niet in een gebouw. Op een vrije rand niet
   * tegen een verblijf aan. Staat er een hek, dan mag het ernaast, aan de kant buiten het verblijf; niet bij een
   * poort (daar moet je doorheen kunnen) en geen bloemenboog (daar loop je onderdoor).
   */
  private edgeDecorFits(e: Edge, kind: DecorKind = this.option.decor as DecorKind): boolean {
    if (!this.grid.validEdge(e) || this.edgeItemAt(e) || this.edgeDecorAt(e)) return false;
    const fence = this.grid.getEdge(e);
    if (fence !== 0) {
      if (fence === 2 || fence === 8 || kind === 'arch') return false;
      return edgeSides({ x: e.x, y: e.y, edge: e.o }).some(i => !this.grid.enclosureAt(...tileXY(i)) && !this.shopAt(...tileXY(i)) && this.grid.terrain[i] !== WATER);
    }
    const sides = edgeSides({ x: e.x, y: e.y, edge: e.o }).map(i => tileXY(i));
    if (!sides.length || sides.some(([x, y]) => !this.grid.inBounds(x, y) || this.grid.enclosureAt(x, y))) return false;
    const [a, b] = sides.map(([x, y]) => this.shopAt(x, y));
    return !(a && a === b);
  }

  /** Een lantaarn, vlag, wegwijzer, heg of bloemperk zet je op een rand, net als een hek: het ligt langs die rand. */
  private placeDecorOnEdge(e: Edge | null, side: 1 | -1 = 1): void {
    const kind = this.option.decor as DecorKind;
    if (!e) return;
    const [cx, cy] = this.decorPos({ x: e.x, y: e.y, edge: e.o });
    if (!this.edgeDecorFits(e)) return this.nope(cx, cy);
    if (!this.pay(DECOR[kind].price, cx, cy)) return;
    this.addDecor(e.x, e.y, kind, e.o, this.edgeRot(e, side));
    // een wegwijzer of plattegrond: verdwaalde gasten in de buurt weten de weg weer
    if (kind === 'signpost' || kind === 'mapboard') this.signPlaced(cx, cy, WAYFIND[kind]);
    sfx('place');
    this.floatAt(icon('sparkle'), cx, cy, 0.6);
    this.backToHand();
  }

  private addDecor(x: number, y: number, kind: DecorKind, edge?: 'h' | 'v', rot = 0, q?: number): DecorObj {
    // iets kleins staat in zijn kwart van de tegel: een halve tegel van het midden af
    const [qx, qy] = quarterAt(q);
    const decor: DecorObj = { x, y, kind, edge, rot, q, mesh: this.view.makeDecor(x + qx - 0.5, y + qy - 0.5, kind, edge, rot, this.decorShift({ x, y, edge })) };
    this.decors.push(decor);
    if (kind === 'bunting' || kind === 'lightstring') this.syncStrings();
    if (kind === 'pond') this.syncPonds();
    return decor;
  }

  /** Vijvers die naast elkaar liggen, laat het beeld in elkaar overlopen: na elke vijver erbij of eraf opnieuw. */
  private syncPonds(): void {
    this.view.syncPonds(this.decors.filter(d => d.kind === 'pond'));
  }

  /**
   * Een versiering mag op een vrije tegel buiten de verblijven, niet op het pad of in het water. Iets kleins (`q`:
   * het kwart van de tegel) heeft alleen zijn eigen kwart nodig: er mogen dus vier kleine dingen op één tegel, ook
   * naast een graspol of een steen, maar niet op een tegel waar al iets groots staat.
   */
  private decorFits(x: number, y: number, q?: number): boolean {
    if (!this.grid.inBounds(x, y) || this.grid.enclosureAt(x, y)) return false;
    const terrain = this.grid.terrain[tileIndex(x, y)];
    if (isPath(terrain) || terrain === WATER) return false;
    if (q === undefined) return !this.taken(x, y);
    const cx = x * 2 + (q & 1), cy = y * 2 + (q >> 1);
    return !this.cellTaken(cx, cy) && !this.propCells.has(this.cellKey(cx, cy));
  }

  /** Het kwart waar deze versiering komt als je hier tikt; iets groots staat midden op de tegel (geen kwart). */
  private decorQuarter(kind: DecorKind, gx?: number, gy?: number): number | undefined {
    return SMALL_DECOR.includes(kind) && gx !== undefined && gy !== undefined ? quarterOf(gx, gy) : undefined;
  }

  private placeDecor(x: number, y: number, gx?: number, gy?: number): void {
    const kind = this.option.decor as DecorKind;
    const q = this.decorQuarter(kind, gx, gy), [qx, qy] = quarterAt(q);
    if (!this.decorFits(x, y, q)) return this.nope(x + qx, y + qy);
    if (!this.pay(DECOR[kind].price, x + qx, y + qy)) return;
    this.addDecor(x, y, kind, undefined, this.quarter, q);
    this.uncover(x, y);
    sfx('place');
    this.floatAt(icon('sparkle'), x + qx, y + qy, 0.6);
    // iets kleins zet je vaak met een paar tegelijk neer: dan blijft de knop aan
    if (q === undefined) this.backToHand();
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

  private addToy(x: number, y: number, kind: ToyKind, rot = 0): ToyObj {
    const toy: ToyObj = { x, y, kind, rot, mesh: this.view.makeToy(x, y, kind, rot) };
    // de losse stukken (de ballen, de liggende stam) kunnen rollen: bij elk stuk hoort waar het ligt en hoe snel het gaat
    const parts = toy.mesh.userData.loose as THREE.Object3D[] | undefined;
    if (parts) {
      const c = Math.cos((rot * Math.PI) / 2), s = Math.sin((rot * Math.PI) / 2);
      toy.loose = parts.map(obj => {
        const { x: hx, z: hz, r, turn, wheel } = obj.userData as { x: number; z: number; r: number; turn?: number; wheel?: boolean };
        return {
          obj, r, hx, hz, turn: turn ?? 0, line: turn !== undefined, wheel: !!wheel, yaw: 0, spin: 0,
          ox: hx * c + hz * s, oy: hz * c - hx * s, vx: 0, vy: 0, h: 0, vh: 0, s: 0, vs: 0, lo: 0, hi: 0, route: null, step: 0, homing: 0, home: true,
        };
      });
    }
    this.toys.push(toy);
    return toy;
  }

  playWith(toy: { x: number; y: number }, seconds: number, facing?: number, hits = 0): void {
    const obj = this.toyAt(toy.x, toy.y);
    if (!obj) return;
    obj.playUntil = this.clock + seconds;
    // speelgoed dat zelf beweegt, telt vanaf nu: precies gelijk met het dier
    obj.playFrom = this.clock;
    obj.hits = hits;
    // de hoepel draait naar het dier dat erdoor springt
    if (facing !== undefined) {
      obj.was = obj.facing;
      obj.facing = facing;
    }
  }

  /** Een dier geeft een los stuk speelgoed een duwtje met zijn neus: het rolt van het dier weg. Lukt niet als het ding weg is. */
  nudgeToy(toy: { x: number; y: number }, piece: number, fromX: number, fromY: number): boolean {
    const obj = this.toyAt(toy.x, toy.y), p = obj?.loose?.[piece];
    if (!obj || !p) return false;
    this.shove(obj, p, fromX, fromY, 1);
    return true;
  }

  inTank(tile: number): boolean {
    return this.tankTiles.has(tile);
  }

  // ------------------------------------------------------------ natuur op een kwart tegel
  /**
   * Graspollen, bloemetjes, stenen en bomen. Elke tegel is in vier vakjes verdeeld (twee bij twee): iets kleins neemt
   * één vakje, een boom of rots de hele tegel. Ze staan in de verblijven en in het park; dieren willen er net genoeg van.
   */
  private props: PropObj[] = [];
  /** Per bezet vakje wat er staat. */
  private propCells = new Map<number, PropObj>();
  /** De tegels met een boom of een rots: daar lopen dieren omheen. */
  private solid = new Set<number>();
  /** Per verblijf hoeveel groen en steen er staat; elk beeldje opnieuw uitgerekend zodra iemand ernaar vraagt. */
  private wildCache: Map<number, Record<WildKind, number> & { land: number }> | null = null;
  /** Wat er nu in het wenswolkje van elk dier staat, zodat het alleen opnieuw getekend wordt als het verandert. */
  private bubbleShows = new WeakMap<Animal, string>();
  /** De plek uit de melding waar de speler net op tikte: die licht een paar tellen op. */
  private pointed: { at: () => [number, number] | null; until: number } | null = null;

  private cellKey(sx: number, sy: number): number {
    return sy * W * 2 + sx;
  }

  /** Na elke verandering: welke vakjes bezet zijn, waar een boom of rots staat, en het beeld. */
  private syncProps(): void {
    this.propCells.clear();
    this.solid.clear();
    this.wildCache = null;
    for (const p of this.props) {
      const n = PROP[p.kind].size;
      for (let dy = 0; dy < n; dy++) for (let dx = 0; dx < n; dx++) this.propCells.set(this.cellKey(p.sx + dx, p.sy + dy), p);
      if (n === 2) this.solid.add(tileIndex(p.sx >> 1, p.sy >> 1));
    }
    this.view.syncProps(this.props.map(p => ({ kind: p.kind, gx: this.propCenter(p)[0], gy: this.propCenter(p)[1], rot: p.rot })));
  }

  /** Het midden van een natuurding, in tegels. */
  private propCenter(p: { kind: PropKind; sx: number; sy: number }): [number, number] {
    const n = PROP[p.kind].size;
    return [(p.sx + n / 2) / 2, (p.sy + n / 2) / 2];
  }

  /** Het vakje waar dit ding komt als je hier tikt: iets kleins in het kwart onder je vinger, iets groots op de hele tegel. */
  private propSpot(kind: PropKind, gx: number, gy: number): [number, number] {
    return PROP[kind].size === 2 ? [Math.floor(gx) * 2, Math.floor(gy) * 2] : [Math.floor(gx * 2), Math.floor(gy * 2)];
  }

  private propUnder(gx: number, gy: number): PropObj | undefined {
    return this.propCells.get(this.cellKey(Math.floor(gx * 2), Math.floor(gy * 2)));
  }

  /**
   * Past het hier? Op vrije vakjes, niet op het pad of in het water, en niet waar al iets groots staat. Wat voor het
   * park is (een kabouter, een bloempot) mag niet in een verblijf.
   */
  private propFits(kind: PropKind, sx: number, sy: number): boolean {
    const n = PROP[kind].size, park = PROP[kind].group === 'park';
    for (let dy = 0; dy < n; dy++)
      for (let dx = 0; dx < n; dx++) {
        const cx = sx + dx, cy = sy + dy, x = cx >> 1, y = cy >> 1;
        if (cx < 0 || cy < 0 || !this.grid.inBounds(x, y) || this.cellTaken(cx, cy) || this.propCells.has(this.cellKey(cx, cy))) return false;
        if (park && this.grid.enclosureAt(x, y)) return false;
        const terrain = this.grid.terrain[tileIndex(x, y)];
        // klein spul voor het park (een bloempot, een kabouter) mag ook op het pad staan, in een hoekje van de tegel
        if ((isPath(terrain) && !park) || terrain === WATER) return false;
      }
    return true;
  }

  private placeProp(gx: number, gy: number): void {
    const kind = this.propKind();
    const [sx, sy] = this.propSpot(kind, gx, gy);
    const [cx, cy] = this.propCenter({ kind, sx, sy });
    if (!this.propFits(kind, sx, sy)) return this.nope(cx, cy);
    if (!this.pay(PROP[kind].price, cx, cy)) return;
    const region = this.grid.enclosureAt(sx >> 1, sy >> 1);
    const here = region ? this.animalsIn(region.id) : [];
    this.props.push({ kind, sx, sy, rot: this.quarter });
    this.syncProps();
    sfx('place');
    this.floatAt(icon('sparkle'), cx, cy, 0.4);
    // elk dier laat met een smiley zien wat het ervan vindt: groen als het hier juist om vroeg, geel als het prima
    // is maar niet nodig was, rood als er nu te veel van staat
    const wild = PROP[kind].wild;
    const have = region ? this.wildIn(region) : null;
    for (const a of here) {
      a.checkWishes(this);
      const want = wild && have && this.wantsWild() && !this.petRegions.has(region!.id) ? wildRange(a.species, have.land) : null;
      if (!want || !wild || !have) continue;
      const [min, max] = want[wild], n = have[wild];
      this.react(a, n > max ? 'bad' : n - 1 < min ? 'good' : 'ok', true);
    }
  }

  private removeProp(p: PropObj): void {
    this.props = this.props.filter(k => k !== p);
    this.syncProps();
    this.earn(refund(PROP[p.kind].price), ...this.propCenter(p));
  }

  /** Komt er een voerbak, gebouw, pad of water op de plek van een graspol of steen, dan gaat die weg; je krijgt de munten terug. */
  private sweepProps(): void {
    const gone = this.props.filter(p => {
      const n = PROP[p.kind].size;
      for (let dy = 0; dy < n; dy++)
        for (let dx = 0; dx < n; dx++) {
          const x = (p.sx + dx) >> 1, y = (p.sy + dy) >> 1, terrain = this.grid.terrain[tileIndex(x, y)];
          if (this.cellTaken(p.sx + dx, p.sy + dy) || (isPath(terrain) && PROP[p.kind].group !== 'park') || terrain === WATER) return true;
        }
      return false;
    });
    if (!gone.length) return;
    this.props = this.props.filter(p => !gone.includes(p));
    for (const p of gone) this.coins = Math.min(COIN_CAP, this.coins + PROP[p.kind].price);
    this.syncProps();
  }

  solidAt(tile: number): boolean {
    return this.solid.has(tile);
  }

  /** Hoeveel bomen, planten en stenen er in dit verblijf staan (in stuks), en hoeveel tegels land het heeft (water telt niet mee). */
  wildIn(region: { id: number; tiles: number[] }): Record<WildKind, number> & { land: number } {
    const cache = this.wildCache ?? (this.wildCache = new Map());
    let rec = cache.get(region.id);
    if (!rec) {
      rec = { tree: 0, plant: 0, stone: 0, land: region.tiles.filter(i => this.grid.terrain[i] !== WATER).length };
      const inside = new Set(region.tiles);
      // wat voor het park is (zonder `wild`) telt niet mee, ook niet als er later een verblijf omheen is gebouwd
      for (const p of this.props) {
        const wild = PROP[p.kind].wild;
        if (wild && inside.has(tileIndex(p.sx >> 1, p.sy >> 1))) rec[wild] += 1;
      }
      cache.set(region.id, rec);
    }
    return rec;
  }

  /**
   * Zet in dit verblijf één boom, plantje of steen neer waar een dier om vraagt, op een vrije plek. Gratis: voor
   * een ouder spel van voor de natuur (en de speelrobot betaalt er zelf voor). Geeft terug of er iets is neergezet.
   */
  plantOne(region: Region): boolean {
    const animals = this.animalsIn(region.id);
    for (const a of animals) a.checkWishes(this);
    const ask = animals.map(a => a.wildAsk).find(q => q?.more);
    if (!ask) return false;
    // een boom neemt een hele tegel; van de stenen alleen de kleine, zodat het verblijf niet dichtslibt
    const kinds = PROPS.filter(k => PROP[k].wild === ask.kind && PROP[k].size === (ask.kind === 'tree' ? 2 : 1));
    const step = PROP[kinds[0]].size === 2 ? 2 : 1;
    const cells: [number, number][] = [];
    for (const i of region.tiles) {
      const [x, y] = tileXY(i);
      for (let dy = 0; dy < 2; dy += step) for (let dx = 0; dx < 2; dx += step) if (this.propFits(kinds[0], x * 2 + dx, y * 2 + dy)) cells.push([x * 2 + dx, y * 2 + dy]);
    }
    if (!cells.length) return false;
    const [sx, sy] = cells[Math.floor(Math.random() * cells.length)];
    this.props.push({ kind: kinds[Math.floor(Math.random() * kinds.length)], sx, sy, rot: Math.floor(Math.random() * 4) });
    this.syncProps();
    return true;
  }

  private plantAll(): void {
    for (const pen of this.pens) for (let i = 0; i < 60 && this.plantOne(pen.region); i++);
  }

  /** De watertegels in bakken van glas: daar staat het water hoog en zwemmen de dieren erin. */
  private tankTiles = new Set<number>();
  private syncTanks(): void {
    const tiles: number[] = [];
    for (const pen of this.pens)
      if (this.grid.penKind(pen.region) === 5) for (const i of pen.region.tiles) if (this.grid.terrain[i] === WATER) tiles.push(i);
    this.tankTiles = new Set(tiles);
    this.view.syncTanks(tiles.map(i => tileXY(i)), TANK_WATER);
  }

  /**
   * Een tik op speelgoed: het veert op (een bal of een stam rolt weg) en een dier uit het verblijf komt ermee
   * spelen (het liefst een dier dat er dol op is).
   */
  private pokeToy(toy: ToyObj): void {
    const region = this.grid.enclosureAt(toy.x, toy.y);
    if (toy.loose) {
      // elk los stuk krijgt een duw, een eigen kant op
      for (const p of toy.loose) {
        const a = Math.random() * Math.PI * 2;
        this.shove(toy, p, toy.x + 0.5 + p.ox - Math.cos(a), toy.y + 0.5 + p.oy - Math.sin(a), 0.85);
      }
    } else {
      this.pulse(toy.mesh, 0.18);
      // wat hangt of wipt, krijgt een zetje (als er niet net een dier mee speelt)
      if (TOY_PIVOT[toy.kind] && toy.playUntil === undefined) {
        toy.playFrom = this.clock;
        toy.playUntil = this.clock + 3;
        toy.hits = -1;
      }
    }
    sfx('tap');
    if (!region) return;
    const here = this.animalsIn(region.id).sort((p, q) => Number(likesToy(q.species, toy.kind)) - Number(likesToy(p.species, toy.kind)) ||Math.hypot(p.gx - toy.x, p.gy - toy.y) - Math.hypot(q.gx - toy.x, q.gy - toy.y));
    const comer = here.find(a => a.comePlay(this, toy));
    if (comer) this.floatAt(icon('heart'), toy.x + 0.5, toy.y + 0.5, 0.9);
  }

  /**
   * Speelgoed waar een dier mee speelt, beweegt. Wat los ligt, rolt echt: de ballen door het verblijf, de stam een
   * stukje opzij en terug. Wat geplant is, ritselt of wuift. Wat vast staat (tunnel, vijver), trilt alleen even.
   */
  private animateToys(dt: number): void {
    for (const toy of this.toys) {
      const m = toy.mesh;
      if (toy.loose) {
        // het ding zelf blijft staan; alleen de losse stukken bewegen, en alleen als er een niet op zijn plek ligt
        if (toy.live) this.rollToy(toy, dt);
        continue;
      }
      if (toy.playUntil === undefined) continue;
      // zo staat het ding gedraaid; het bewegen komt daar bovenop
      const base = ((toy.rot ?? 0) * Math.PI) / 2;
      if (this.clock > toy.playUntil) {
        toy.playUntil = undefined;
        m.position.y = 0;
        m.rotation.set(0, toy.kind === 'hoop' ? toy.facing ?? base : base, 0);
        m.scale.set(1, 1, 1);
        this.swayToy(toy, 0, true);
        continue;
      }
      const t = this.clock;
      // speelgoed met een los onderdeel beweegt op zijn eigen manier
      if (this.swayToy(toy, t - (toy.playFrom ?? t), false)) continue;
      if (toy.kind === 'hoop') {
        // de hoepel staat dwars op de sprong en trilt even na
        m.rotation.y = toy.facing ?? base;
        m.rotation.z = Math.sin(t * 22) * 0.03;
      } else if (toy.kind === 'bush') {
        m.rotation.z = Math.sin(t * 16) * 0.07;
        m.scale.y = 1 + Math.sin(t * 9) * 0.05;
      } else if (toy.kind === 'flowerbed') {
        // de bloemen wuiven; het perk zelf draait niet mee
        m.rotation.z = Math.sin(t * 5) * 0.03;
        m.scale.y = 1 + Math.sin(t * 8) * 0.07;
      } else {
        // wat vast staat (de tunnel, de vijver, de waterval) trilt alleen een beetje
        m.scale.y = 1 + Math.sin(t * 14) * 0.025;
      }
    }
  }

  /**
   * Speelgoed met een los onderdeel dat zelf beweegt (altijd het laatste onderdeel, zie TOY_PARTS in view.ts): de band
   * van de schommel, de bal aan de paal, de wipplank, de slierten van de kruipboog en het touw van de klimpaal.
   * `u`: zoveel seconden beweegt het al, met dezelfde tel als het dier dat ermee speelt. `still`: het is uitgespeeld
   * en hangt of ligt weer stil. Geeft terug of dit zulk speelgoed is.
   */
  private swayToy(toy: ToyObj, u: number, still: boolean): boolean {
    const pivot = TOY_PIVOT[toy.kind];
    if (!pivot) return false;
    const m = toy.mesh, part = m.children[m.children.length - 1], base = ((toy.rot ?? 0) * Math.PI) / 2;
    // een tik van jou (`poke`): het ding zwaait of wipt vanzelf even uit
    const poke = toy.hits === -1, facing = toy.facing ?? base;
    // kijkt het dier met de as van het ding mee (1) of ertegenin (-1)? `turn`: hoe die as in het ding ligt
    const dir = (turn: number): number => (Math.cos(facing - base - turn) >= 0 ? 1 : -1);
    if (toy.kind === 'tyreswing') {
      // de band schommelt langs z: rustig heen en weer met een dier erop, en na een duw steeds minder ver
      const speed = (Math.PI * 2) / SWING.period;
      const a = poke ? 0.3 * sway(u, speed, 0.9) : toy.hits ? -PUSH.angle * sway(sinceHit(u, PUSH), speed, 0.45) * dir(0) : -swingAt(u) * dir(0);
      this.view.swingPart(part, pivot, 1, 0, still ? 0 : a);
    } else if (toy.kind === 'rocker') {
      // de plank wipt langs x, gelijk met het dier dat erop staat
      const a = poke ? 0.2 * sway(u, 9, 1.5) : -rockAt(u) * dir(Math.PI / 2);
      this.view.swingPart(part, pivot, 0, 1, still ? 0 : a);
    } else if (toy.kind === 'tetherball') {
      // de bal draait om de paal en zwaait daarbij naar buiten; stil hangt hij aan de kant van het dier dat hem het laatst sloeg
      const sideOf = (heading: number | undefined): number => (heading === undefined ? 0 : heading + Math.PI / 2 - base);
      const side = sideOf(toy.facing);
      let yaw = side, out = 0;
      if (!still && !poke && u < TETHER.first) {
        // eerst draait hij rustig naar de kant van het dier
        const from = sideOf(toy.was), d = Math.atan2(Math.sin(side - from), Math.cos(side - from)), k = u / TETHER.first;
        yaw = from + d * k * k * (3 - 2 * k);
      } else if (!still) {
        const [turn, far] = tetherAt(poke ? u : sinceHit(u, TETHER));
        yaw += turn;
        out = far;
      }
      this.view.swingPart(part, pivot, 0, 1, out * TETHER.tilt, yaw);
    } else if (toy.kind === 'logarch') {
      // de slierten zwaaien mee met het dier dat eronderdoor loopt, en hangen daarna langzaam weer stil
      const a = poke ? 0.5 * sway(u, 7, 1.3) : -0.7 * sway(u - UNDER.touch, 7, 1.3) * dir(0);
      this.view.swingPart(part, pivot, 1, 0, still ? 0 : a);
    } else {
      // de klimpaal: het touw schudt zolang het dier klimt en bungelt daarna uit; de paal zelf trilt een beetje mee
      const climbing = !still && !poke && u < CLIMB_SECONDS;
      const a = poke ? 0.4 * sway(u, 6, 1.2) : climbing ? Math.sin((u / CLIMB_SECONDS) * Math.PI * 7) * 0.14 * Math.min(1, u * 4) : -0.29 * sway(u - CLIMB_SECONDS, 6, 1.2);
      this.view.swingPart(part, pivot, 0.6, 0.8, still ? 0 : a);
      m.rotation.z = climbing ? Math.sin(u * 23) * 0.012 : 0;
    }
    return true;
  }

  /**
   * Een autoband rolt rechtop: hij draait mee met de kant waar hij heen gaat (`dx`, `dz`: in het speelgoed zelf
   * gemeten) en rolt precies zo ver om zijn as als hij over de grond gaat (`moved`).
   */
  private rollWheel(p: LoosePiece, dx: number, dz: number, moved: number, dt: number): void {
    let d = Math.atan2(dx, dz) - p.yaw, dir = 1;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    // een band is van voren en van achteren gelijk: liever achteruit rollen dan een halve draai maken
    if (Math.abs(d) > Math.PI / 2) {
      d -= Math.sign(d) * Math.PI;
      dir = -1;
    }
    p.yaw += d * Math.min(1, dt * 10);
    p.spin += (dir * moved) / p.r;
    p.obj.rotation.set(p.spin, p.yaw, 0);
  }

  /** Mag los speelgoed over deze tegel rollen? Alleen in het eigen verblijf, niet waar iets staat, en een bal op het land niet het water in (een bal in het water blijft daar drijven). */
  private rollFree(toy: ToyObj, x: number, y: number): boolean {
    if (x === toy.x && y === toy.y) return true;
    if (!this.grid.inBounds(x, y)) return false;
    const i = tileIndex(x, y), home = tileIndex(toy.x, toy.y);
    if (this.grid.regionOf[i] !== this.grid.regionOf[home] || this.solid.has(i)) return false;
    if ((this.grid.terrain[i] === WATER) !== (this.grid.terrain[home] === WATER)) return false;
    // gewone lussen: dit loopt elk beeldje, en dan maken we liever niets nieuws aan
    for (const tr of this.troughs) if (tr.x === x && tr.y === y) return false;
    for (const b of this.beds) if (b.x === x && b.y === y) return false;
    for (const k of this.toys) if (k.x === x && k.y === y) return false;
    return true;
  }

  /** Kan los speelgoed van tegel (x, y) een stap (dx, dy) verder rollen? Niet door een hek, en alleen naar een vrije tegel. */
  private rollPass(toy: ToyObj, x: number, y: number, dx: number, dy: number): boolean {
    return this.grid.canStep(x, y, dx, dy) && this.rollFree(toy, x + dx, y + dy);
  }

  /**
   * Kan een bal van tegel (x, y) een stap (dx, dy) verder? Een bal is breed: hij raakt soms twee rijen of twee
   * kolommen tegelijk (`a` en `b`). Dan moeten beide vrij zijn, en mag er daar geen hek tussen die twee staan.
   */
  private rollOn(toy: ToyObj, x: number, y: number, dx: number, dy: number, a: number, b: number): boolean {
    if (dx) return this.rollPass(toy, x, a, dx, 0) && (a === b || (this.rollPass(toy, x, b, dx, 0) && this.grid.canStep(x + dx, a, 0, 1)));
    return this.rollPass(toy, a, y, 0, dy) && (a === b || (this.rollPass(toy, b, y, 0, dy) && this.grid.canStep(a, y + dy, 1, 0)));
  }

  /**
   * Een duw tegen een los stuk, weg van het punt (fromX, fromY). Een bal rolt die kant op en maakt een sprongetje.
   * Een stam rolt dwars op zijn lengte, weg van de duw. Buiten een dicht verblijf blijft het bij een sprongetje.
   */
  private shove(toy: ToyObj, p: LoosePiece, fromX: number, fromY: number, power: number): void {
    const penned = !!this.grid.enclosureAt(toy.x, toy.y);
    const cx = toy.x + 0.5 + p.ox, cy = toy.y + 0.5 + p.oy, dx = cx - fromX, dy = cy - fromY;
    toy.live = true;
    // na de laatste duw blijft het nog even liggen, en dan gaat het terug naar zijn plek
    toy.playUntil = Math.max(toy.playUntil ?? 0, this.clock + 2.2);
    p.home = false;
    p.route = null;
    if (p.line) {
      // dwars op de stam, in tegels: die kant en de andere kant kan hij op
      const base = ((toy.rot ?? 0) * Math.PI) / 2, c = Math.cos(base), s = Math.sin(base);
      const lx = Math.sin(p.turn), lz = Math.cos(p.turn), nx = lx * c + lz * s, ny = lz * c - lx * s;
      const sx = Math.round(nx), sy = Math.round(ny);
      p.hi = penned && this.rollPass(toy, toy.x, toy.y, sx, sy) ? LOG.far : LOG.near;
      p.lo = penned && this.rollPass(toy, toy.x, toy.y, -sx, -sy) ? -LOG.far : -LOG.near;
      // een duw tegen het uiteinde: dan rolt hij naar de kant met de meeste ruimte
      const push = dx * nx + dy * ny;
      const side = Math.abs(push) > 0.15 ? Math.sign(push) : p.hi > -p.lo ? 1 : p.hi < -p.lo ? -1 : Math.random() < 0.5 ? 1 : -1;
      // net hard genoeg om bijna tot het eind te rollen
      p.vs = side * power * LOG.kick * (side > 0 ? p.hi : -p.lo);
      return;
    }
    const wet = this.grid.terrain[tileIndex(toy.x, toy.y)] === WATER;
    // weg van de duw, met een beetje toeval erin; een kleine bal schiet harder weg dan een grote
    const a = (dx || dy ? Math.atan2(dy, dx) : Math.random() * Math.PI * 2) + (Math.random() - 0.5) * 0.7;
    const speed = penned ? power * (2.3 + Math.random() * 0.8) * (p.r < 0.15 ? 1.15 : 1) * (wet ? 0.6 : 1) : 0;
    p.vx = Math.cos(a) * speed;
    p.vy = Math.sin(a) * speed;
    p.vh = wet ? 0.8 : 1.5 + Math.random() * 0.7;
    if (wet) this.splash(cx, cy);
  }

  /** De losse stukken van één ding een stapje verder. Is alles weer thuis, dan hoeft er niets meer te bewegen. */
  private rollToy(toy: ToyObj, dt: number): void {
    const pieces = toy.loose!, base = ((toy.rot ?? 0) * Math.PI) / 2, c = Math.cos(base), s = Math.sin(base);
    // uitgespeeld: dan rollen de ballen terug naar hun eigen tegel
    const over = toy.playUntil === undefined || this.clock > toy.playUntil;
    const step = Math.min(dt, 0.05);
    let busy = false;
    for (const p of pieces) {
      if (p.home) continue;
      if (p.line) this.rollLog(p, step, c, s);
      else this.rollBall(toy, p, step, c, s, over);
      if (!p.home) busy = true;
    }
    if (pieces.length > 1 && !pieces[0].line && !pieces[1].line && this.clack(pieces[0], pieces[1])) busy = true;
    if (!busy) {
      toy.live = false;
      toy.playUntil = undefined;
    }
  }

  /** Eén bal een stapje verder: vrij rollen (afremmen, stuiteren, terugkaatsen van het hek), of over zijn weg naar huis. */
  private rollBall(toy: ToyObj, p: LoosePiece, dt: number, c: number, s: number, over: boolean): void {
    const wet = this.grid.terrain[tileIndex(toy.x, toy.y)] === WATER;
    // de eigen plek, in tegels vanaf het midden van de tegel
    const hx = p.hx * c + p.hz * s, hy = p.hz * c - p.hx * s;
    let mx = 0, my = 0;
    if (!p.route) {
      const speed = Math.hypot(p.vx, p.vy);
      if (speed > 0) {
        // in het water remt de bal veel sneller af
        const k = Math.max(0, speed - (BALL.brake + BALL.drag * (wet ? 3 : 1) * speed) * dt) / speed;
        p.vx *= k;
        p.vy *= k;
      }
      mx = p.vx * dt;
      my = p.vy * dt;
      const cx = toy.x + 0.5 + p.ox, cy = toy.y + 0.5 + p.oy, tx = Math.floor(cx), ty = Math.floor(cy), e = p.r * 0.85;
      // tegen een hek, een bak, een boom of de rand van het water: terugkaatsen. Eerst van links naar rechts, dan van boven naar beneden.
      if (mx) {
        const dir = mx > 0 ? 1 : -1;
        if (Math.floor(cx + mx + dir * p.r) !== tx && !this.rollOn(toy, tx, ty, dir, 0, Math.floor(cy - e), Math.floor(cy + e))) {
          p.vx *= -BALL.wall;
          mx = 0;
        }
      }
      if (my) {
        const dir = my > 0 ? 1 : -1;
        if (Math.floor(cy + my + dir * p.r) !== ty && !this.rollOn(toy, tx, ty, 0, dir, Math.floor(cx + mx - e), Math.floor(cx + mx + e))) {
          p.vy *= -BALL.wall;
          my = 0;
        }
      }
      if (p.h > 0 || p.vh > 0) {
        // het sprongetje: neerkomen en nog een paar keer stuiteren, steeds lager (in het water plonst hij meteen)
        p.vh -= BALL.gravity * dt;
        p.h += p.vh * dt;
        if (p.h <= 0) {
          p.h = 0;
          p.vh = p.vh < -0.5 && !wet ? -p.vh * BALL.bounce : 0;
        }
      }
      // uitgespeeld en bijna uitgerold, of er is iets neergezet waar hij ligt: naar huis
      if ((over && speed < 0.3 && p.h === 0) || !this.rollFree(toy, tx, ty)) this.sendHome(toy, p);
    } else {
      // naar huis: van tegel naar tegel, en het laatste stukje naar de eigen plek
      p.homing += dt;
      const last = p.step >= p.route.length - 1, at = last ? 0 : p.route[p.step];
      const dx = (last ? hx : (at % W) - toy.x) - p.ox, dy = (last ? hy : Math.floor(at / W) - toy.y) - p.oy, d = Math.hypot(dx, dy);
      if ((last && d < 0.015) || p.homing > 3 + p.route.length * 1.5) {
        // thuis (of het duurde te lang: dan ligt hij er meteen)
        p.ox = hx;
        p.oy = hy;
        p.vx = p.vy = p.h = p.vh = 0;
        p.route = null;
        p.home = true;
      } else if (!last && d < 0.3) p.step++;
      else {
        // rustig aan, en het laatste stukje steeds langzamer
        const want = last ? Math.min(BALL.home, 0.25 + d * 2.5) : BALL.home, k = Math.min(1, dt * 6);
        p.vx += ((dx / d) * want - p.vx) * k;
        p.vy += ((dy / d) * want - p.vy) * k;
        mx = p.vx * dt;
        my = p.vy * dt;
        p.h = Math.max(0, p.h - dt);
      }
    }
    p.ox += mx;
    p.oy += my;
    const moved = Math.hypot(mx, my);
    if (moved > 1e-5) {
      // rollen: draaien om de as dwars op de richting, precies zo ver als de bal over de grond gaat (hoek = afstand / straal)
      const wx = my / moved, wz = -mx / moved;
      if (p.wheel) this.rollWheel(p, mx * c - my * s, mx * s + my * c, moved, dt);
      else this.view.rollLoose(p.obj, wx * c - wz * s, wx * s + wz * c, (moved / p.r) * (wet ? 0.5 : 1));
    }
    // in het water dobbert de bal een beetje
    const bob = wet && !p.home ? Math.sin(this.clock * 3 + p.r * 40) * 0.015 : 0;
    p.obj.position.set(p.ox * c - p.oy * s, p.r + p.h + bob, p.ox * s + p.oy * c);
  }

  /** De bal gaat terug naar zijn eigen tegel: over vrije tegels, om alles heen. Is er geen weg (meer), dan ligt hij er meteen. */
  private sendHome(toy: ToyObj, p: LoosePiece): void {
    const x = Math.floor(toy.x + 0.5 + p.ox), y = Math.floor(toy.y + 0.5 + p.oy);
    const route = this.grid.enclosureAt(toy.x, toy.y) && this.grid.inBounds(x, y)
      ? this.grid.path(tileIndex(x, y), tileIndex(toy.x, toy.y), i => !this.rollFree(toy, i % W, Math.floor(i / W)))
      : null;
    // eerst naar het midden van de tegel waar hij ligt: zo snijdt hij geen hoek af langs een hek
    p.route = route ?? [];
    p.step = 0;
    p.homing = route ? 0 : 99;
  }

  /** Twee ballen die tegen elkaar rollen, ketsen van elkaar af: de kleine schiet harder weg dan de grote. Geeft terug of het raak was. */
  private clack(a: LoosePiece, b: LoosePiece): boolean {
    // op weg naar huis rollen ze gewoon langs elkaar
    if (a.route || b.route || (a.home && b.home)) return false;
    const dx = b.ox - a.ox, dy = b.oy - a.oy, d = Math.hypot(dx, dy);
    if (d >= a.r + b.r || d < 1e-4) return false;
    const nx = dx / d, ny = dy / d, closing = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
    if (closing <= 0) return false;
    const ma = a.r ** 3, mb = b.r ** 3, j = (1.8 * closing) / (ma + mb);
    a.vx -= j * mb * nx;
    a.vy -= j * mb * ny;
    b.vx += j * ma * nx;
    b.vy += j * ma * ny;
    a.home = b.home = false;
    return true;
  }

  /** De stam een stapje verder: hij rolt dwars op zijn lengte, draait daarbij om zijn lengte, en wil terug naar zijn plek. */
  private rollLog(p: LoosePiece, dt: number, c: number, s: number): void {
    p.vs += (-LOG.pull * p.s - LOG.damp * p.vs) * dt;
    p.s += p.vs * dt;
    // tegen het hek of de rand van zijn ruimte: een klein stootje terug
    if (p.s > p.hi || p.s < p.lo) {
      p.s = p.s > p.hi ? p.hi : p.lo;
      p.vs *= -0.3;
    }
    if (Math.abs(p.s) < 0.004 && Math.abs(p.vs) < 0.03) {
      p.s = p.vs = 0;
      p.home = true;
    }
    const x = p.hx + Math.sin(p.turn) * p.s, z = p.hz + Math.cos(p.turn) * p.s;
    p.obj.position.set(x, p.r, z);
    // rollen zonder schuiven: hoek = afstand / straal
    p.obj.rotation.x = p.s / p.r;
    p.ox = x * c + z * s;
    p.oy = z * c - x * s;
  }

  /** Vanaf level 10 willen dieren iets leuks in hun verblijf. */
  wantsFun(): boolean {
    return this.has('fun');
  }

  // ------------------------------------------------------------ dag en nacht
  /** Hoe donker het is: 0 overdag, 1 in de nacht, met een schemering ertussen. Voor FEATURE.night is het altijd dag. */
  private night = 0;
  private wasNight = false;
  private nightTold = false;
  private lightList: { gx: number; gy: number; r: number }[] = [];

  private darkness(): number {
    if (!this.has('night')) return 0;
    const cycle = DAY_SECONDS + NIGHT_SECONDS, phase = this.now() % cycle;
    if (phase < DAY_SECONDS - DUSK_SECONDS) return 0;
    if (phase < DAY_SECONDS) return (phase - (DAY_SECONDS - DUSK_SECONDS)) / DUSK_SECONDS;
    return phase < cycle - DUSK_SECONDS ? 1 : (cycle - phase) / DUSK_SECONDS;
  }

  /** De tijd op de klok rechtsboven, digitaal (12:05). De minuten springen per vijf, zodat de klok rustig blijft. */
  /** Het uur van de dag als getal: 7 is zeven uur 's ochtends, 21,5 half tien 's avonds, 0 tot 7 de nacht. */
  private hourNow(): number {
    if (!this.has('night')) return 8 + ((this.clock / HOUR_SECONDS) % 12);
    return hourAt(this.now() % (DAY_SECONDS + NIGHT_SECONDS)) % 24;
  }

  /**
   * Het park is dicht van middernacht tot zeven uur 's ochtends: er komen geen gasten en wie er nog is, gaat naar
   * huis. Voor het nacht wordt in het spel (FEATURE.night) is het park altijd open.
   */
  closed(): boolean {
    return this.has('night') && this.hourNow() < 7;
  }

  /** Vanaf tien uur 's avonds gaan de gasten naar huis, zodat het park om middernacht leeg is. */
  goingHome(): boolean {
    return this.has('night') && (this.hourNow() >= GUESTS_HOME || this.hourNow() < 7);
  }

  /**
   * Vanaf half twaalf 's avonds gaat ook het personeel naar huis: elke werker loopt naar de poort en is dan weg. Om
   * vijf uur komen ze een voor een weer binnen.
   */
  staffHome(): boolean {
    return this.has('night') && (this.hourNow() >= STAFF_HOME || this.hourNow() < STAFF_BACK);
  }

  /** De verkopers in de kramen gaan tegelijk met het personeel weg en staan er weer vlak voor de gasten komen. */
  private vendorsHome(): boolean {
    return this.has('night') && (this.hourNow() >= STAFF_HOME || this.hourNow() < VENDORS_BACK);
  }

  /** Van middernacht tot vijf uur slaapt elk dier en is het park leeg. Vanaf vijf uur komt het personeel weer binnen. */
  deepNight(): boolean {
    return this.has('night') && this.hourNow() < 5;
  }

  private clockText(): string {
    const hours = this.hourNow();
    const h = Math.floor(hours), m = Math.floor(((hours - h) * 60) / 5) * 5;
    return `${h}:${String(m).padStart(2, '0')}`;
  }

  /** Alles wat licht geeft: lantaarns, kampvuren, winkels en speeltoestellen, en de ingang. */
  private lights(): { gx: number; gy: number; r: number }[] {
    const [ex, ey] = tileXY(ENTRANCE);
    const list = [{ gx: ex + 0.5, gy: ey + 0.5, r: LIGHT.entrance }];
    for (const d of this.decors) {
      const [gx, gy] = this.decorPos(d);
      const r = (LIGHT as Record<string, number>)[d.kind];
      if (r) list.push({ gx, gy, r });
    }
    for (const s of this.shops) if (!s.edge) list.push({ gx: blockCenter(s)[0], gy: blockCenter(s)[1], r: LIGHT.shop });
    this.road.lights(list);
    return list;
  }

  isNight(): boolean {
    return this.night > 0.6;
  }

  dark(tile: number): boolean {
    if (!this.isNight()) return false;
    const [x, y] = tileXY(tile);
    return !this.lightList.some(l => Math.hypot(l.gx - x - 0.5, l.gy - y - 0.5) <= l.r);
  }

  /** Elk beeldje: de schemering, het geluid van de nacht en het donkere vlak met gaten bij elk licht. */
  /** Was het park net nog dicht? Zo zegt de directeur het één keer als het dichtgaat en als het weer opengaat. */
  private wasShut = false;

  private updateNight(): void {
    const shut = this.closed();
    if (shut !== this.wasShut) {
      this.wasShut = shut;
      // (niet meteen bij het openen van het spel)
      if (this.clock > 3) this.mention({ who: 'director', mood: 'happy', key: shut ? 'say.park.closed' : 'say.park.open' }, 30);
    }
    const night = this.darkness();
    if (night !== this.night) {
      this.night = night;
      this.view.setNight(night);
    }
    this.lightList = night > 0 ? this.lights() : [];
    if (night > 0.6 && !this.wasNight) {
      this.wasNight = true;
      ambience('amb.night');
      // de eerste nacht legt de directeur uit wat je moet doen
      if (!this.nightTold) {
        this.nightTold = true;
        this.lines.push(say.night());
      }
    } else if (night < 0.4 && this.wasNight) {
      this.wasNight = false;
      ambience('amb.farm');
      // de zon komt op: de haan kraait en de dieren worden een voor een wakker
      sfx('rooster', { volume: 0.5 });
      for (const a of this.animals) if (a.sleeping) a.dawn(Math.random() * 12);
    }
    this.view.drawNight(night, this.lightList);
  }

  private addBed(x: number, y: number, kind: BedKind, rot = 0): BedObj {
    const bed: BedObj = { x, y, kind, rot, mesh: this.view.makeBed(x, y, kind, rot) };
    this.beds.push(bed);
    return bed;
  }

  /** `set`: de kant waar een bankje of bak naartoe kijkt, zoals de speler die bij het neerzetten koos. */
  private addShop(x: number, y: number, kind: ShopKind, sells?: string[], edge?: 'h' | 'v', turned?: boolean, rot?: number, manual?: boolean, set?: number): ShopObj {
    const face = edge ? this.faceOf({ x, y, edge, turned, set }) : undefined;
    // een gebouw kijkt vanzelf naar het pad, tenzij de speler het zelf heeft gedraaid
    const turn = edge ? undefined : rot ?? this.autoRot(x, y, kind);
    const [w, h] = edge ? [1, 1] : shopSpan(kind, turn ?? 0);
    const shop: ShopObj = {
      x, y, kind, size: SHOP_SIZE[kind], w, h, sells: sells?.length ? [...sells] : this.products(kind).slice(0, slotsOf(kind)),
      mesh: this.view.makeShop(x, y, kind, edge && { o: edge, face: face! }, turn), vendor: Vendor.of(kind), edge, face, turned: turned || undefined, set: edge ? set : undefined, rot: turn, manual: manual || undefined,
    };
    if (shop.vendor) shop.mesh.add(shop.vendor.mesh);
    this.shops.push(shop);
    return shop;
  }

  /** `nature`: het karakter; een nieuw dier krijgt er zelf een (de helft is gewoon). `rare`: een zeldzame kleur. */
  private addAnimal(species: SpeciesId, variant: Variant, gx: number, gy: number, name?: string, nature?: Nature, rare?: Rare | null): Animal {
    const a = new Animal(species, variant, gx, gy);
    a.name = name || this.animalName(a);
    a.nature = nature ?? (Math.random() < 0.5 ? 'plain' : NATURES[1 + Math.floor(Math.random() * (NATURES.length - 1))]);
    if (rare) a.setRare(rare);
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
    this.sweepProps();
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
    if (this.deepNight()) return 0;
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
    // de eerste voerbak in een verblijf is precies wat de dieren nodig hebben (groen); een bak extra is prima (geel)
    const first = !this.troughs.some(tr => this.grid.regionOf[tileIndex(tr.x, tr.y)] === region.id);
    this.addTrough(x, y, null, 0, kind, this.quarter);
    this.uncover(x, y);
    sfx('place');
    this.floatAt(icon('sparkle'), x + 0.5, y + 0.5);
    for (const a of this.animalsIn(region.id)) this.react(a, first ? 'good' : 'ok', true);
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
    this.addBed(x, y, kind, this.quarter);
    this.uncover(x, y);
    sfx('place');
    this.floatAt(icon('sparkle'), x + 0.5, y + 0.5);
    // de slaapplek waar het dier van houdt: groen; een andere: geel
    for (const a of this.animalsIn(region.id)) this.react(a, SPECIES[a.species].bed === kind ? 'good' : 'ok', true);
    this.backToHand();
  }

  /** Speelgoed of een plant in een verblijf: daar worden alle dieren in dat verblijf blij van. */
  private placeToy(x: number, y: number): void {
    const region = this.grid.enclosureAt(x, y);
    if (!region) return this.nope(x + 0.5, y + 0.5);
    const kind = this.option.toy as ToyKind;
    if (this.taken(x, y) || !this.pay(TOY_PRICE[kind] ?? PRICE.toy, x + 0.5, y + 0.5)) return;
    this.addToy(x, y, kind, this.quarter);
    this.uncover(x, y);
    sfx('place');
    this.floatAt(icon('sparkle'), x + 0.5, y + 0.5);
    // elk dier laat zien wat het ervan vindt: groen als dit zijn lievelingsding is (dan speelt het meteen), anders geel
    for (const a of this.animalsIn(region.id)) {
      const fav = likesToy(a.species, kind) || CLIMATE[a.species] === kind;
      if (fav) a.emote('Play', 2);
      this.react(a, fav ? 'good' : 'ok', true);
    }
    this.backToHand();
  }

  /**
   * Een winkel mag overal buiten de verblijven staan, behalve op het pad of in het water. Een gebouw heeft 2 bij 2
   * tegels nodig; een marktkraam 2 bij 1, of 1 bij 2 als hij een kwartslag gedraaid staat (`rot`).
   */
  private shopFits(x: number, y: number, kind: ShopKind, rot = 0): boolean {
    const [w, h] = shopSpan(kind, rot);
    for (let ty = y; ty < y + h; ty++)
      for (let tx = x; tx < x + w; tx++) {
        if (!this.grid.inBounds(tx, ty) || this.grid.enclosureAt(tx, ty) || this.taken(tx, ty)) return false;
        const terrain = this.grid.terrain[tileIndex(tx, ty)];
        if (isPath(terrain) || terrain === WATER) return false;
      }
    return true;
  }

  /** De tegels rondom een blok van `w` bij `h` tegels. */
  private around(x: number, y: number, w: number, h: number): number[] {
    const spots: [number, number][] = [];
    for (let i = 0; i < w; i++) spots.push([x + i, y - 1], [x + i, y + h]);
    for (let i = 0; i < h; i++) spots.push([x - 1, y + i], [x + w, y + i]);
    return spots.filter(([tx, ty]) => this.grid.inBounds(tx, ty)).map(([tx, ty]) => tileIndex(tx, ty));
  }

  /** Ligt er pad tegen dit blok van `w` bij `h` tegels aan? Dan kunnen gasten erbij. */
  private touchesPath(x: number, y: number, w: number, h: number): boolean {
    for (let ty = y; ty < y + h; ty++)
      for (let tx = x; tx < x + w; tx++) if (this.grid.neighbors(tileIndex(tx, ty)).some(i => isPath(this.grid.terrain[i]))) return true;
    return false;
  }

  /**
   * Waar een gebouw komt dat je onder de vinger neerzet: [linkerbovenhoek x, y, draaiing]. Het komt met zijn midden
   * onder de vinger en kijkt naar het pad. Een marktkraam is niet vierkant: die gaat zo staan dat er het meeste
   * pad voor zijn lange kant ligt. De draaiknop draait daar nog kwartslagen bovenop.
   */
  private shopPose(g: { gx: number; gy: number }, kind: ShopKind): [number, number, number] {
    const at = (rot: number): [number, number, number] => {
      const [w, h] = shopSpan(kind, rot);
      return [Math.round(g.gx - w / 2), Math.round(g.gy - h / 2), rot];
    };
    let best = 0;
    if (SHOP_DEEP[kind]) {
      const front = [0, 1, 2, 3].map(rot => this.pathSides(at(rot)[0], at(rot)[1], ...shopSpan(kind, rot))[rot]);
      best = front.indexOf(Math.max(...front));
    } else best = this.autoRot(at(0)[0], at(0)[1], kind);
    return at((best + this.quarter) % 4);
  }

  /**
   * Een bankje, bloembak of afvalbak zet je op een rand, net als een hek. Langs een pad kijkt het vanzelf naar
   * het pad; anders naar de kant van de rand waar je tikt (`side`). Wil je het anders, dan haal je het weg en zet
   * je het opnieuw neer.
   */
  private placeOnEdge(e: Edge | null, side: 1 | -1 = 1): void {
    const kind = this.shopKind();
    if (!e) return;
    const [cx, cy] = shopCenter({ x: e.x, y: e.y, kind, size: 1, sells: [], edge: e.o });
    if (!this.edgeFits(e)) return this.nope(cx, cy);
    if (!this.pay(SHOP_PRICE[kind], cx, cy)) return;
    // met de draaiknop staat het andersom: langs een pad met de rug naar het pad, anders van je af
    const auto = this.edgeFace(e), flipped = this.flip < 0;
    this.addShop(e.x, e.y, kind, undefined, e.o, auto !== 0 && flipped, undefined, undefined, auto ? side : side * this.flip);
    sfx('place');
    this.floatAt(icon('sparkle'), cx, cy, 0.5);
    this.backToHand();
  }

  private placeShop(x: number, y: number, rot?: number): void {
    const kind = this.shopKind();
    const turn = rot ?? this.autoRot(x, y, kind);
    const [w, h] = shopSpan(kind, turn);
    const cx = x + w / 2, cy = y + h / 2;
    if (!this.shopFits(x, y, kind, turn)) return this.nope(cx, cy);
    if (!this.pay(SHOP_PRICE[kind], cx, cy)) return;
    // zelf gedraaid met de draaiknop? Dan blijft het zo staan; anders kijkt het vanzelf naar het pad
    // (een marktkraam houdt de stand waarin je hem neerzet, en draait uit zichzelf hooguit een halve slag)
    if (this.quarter) this.addShop(x, y, kind, undefined, undefined, undefined, turn, true);
    else this.addShop(x, y, kind, undefined, undefined, undefined, SHOP_DEEP[kind] ? turn : undefined);
    this.sweepProps();
    sfx('place');
    this.floatAt(icon('sparkle'), cx, cy, 0.8);
    // één halte: de trein wacht nog; bij de tweede gaat hij rijden
    if (kind === 'station') {
      const n = this.shops.filter(sh => sh.kind === 'station').length;
      if (n <= 2) this.sayNow(n === 1 ? say.trainOne() : say.trainGo());
    }
    this.backToHand();
  }

  /** Tik op een kraam: kies wat hij verkoopt. Er passen maar een paar dingen tegelijk in; een keuze te veel vervangt de oudste. */
  private shopMenu(shop: ShopObj): void {
    const options = [...new Set([...this.products(shop.kind), ...shop.sells])];
    const s = this.view.toScreen(...blockCenter(shop), 1.5);
    const items: ToolOption[] = [
      { id: '__turn', icon: icon('turn'), label: t('shop.turn') },
      ...options.map(id => ({ id, icon: this.productIcon(id), label: this.productName(id), on: shop.sells.includes(id) })),
    ];
    this.hud.showMenu(s.x, s.y, t(`shop.${shop.kind}`), items, id => {
      if (id === '__turn') {
        // een kwartslag draaien; daarna draait het gebouw niet meer vanzelf. Een marktkraam draait een halve slag:
        // hij is niet vierkant en moet op zijn eigen tegels blijven staan.
        shop.rot = ((shop.rot ?? 0) + (SHOP_DEEP[shop.kind] ? 2 : 1)) % 4;
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
    const pal = !this.told.has('pals') && this.animalsIn(region.id).some(other => palsOf(species).includes(other.species));
    const a = this.addAnimal(species, this.option.sex as Sex, x + 0.5, y + 0.5);
    animalSound(a.species, a.young, 1, [a.gx, a.gy]);
    // twee soorten die vriendjes zijn in één verblijf: de verzorger vertelt het één keer
    if (pal) {
      this.told.add('pals');
      this.lines.push(say.pals());
    }
    // bij het eerste dier van een soort: een weetje
    this.tellFact(species, false);
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
    // in de kinderboerderij lusten de boerderijdieren alles
    const petting = this.petRegions.has(this.grid.regionOf[tileIndex(tr.x, tr.y)]);
    const fans = here.filter(a => SPECIES[a.species].food === food || (petting && PETTABLE.includes(a.species)));
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
          // een jong met een zeldzame kleur blijft het langst
          const grown = young.find(y => !y.rare) ?? young[0];
          this.mention(say.grown(grown.name));
          this.earn(2, grown.gx, grown.gy);
          this.removeAnimal(grown);
        }
        // af en toe heeft een jong een heel bijzondere kleur
        const rare = this.level >= 7 && Math.random() < RARE_CHANCE ? pickRare() : null;
        const baby = this.addAnimal(sp, Math.random() < 0.5 ? 'young_m' : 'young_f', mother.gx, mother.gy, undefined, undefined, rare);
        baby.hunger = 0.2;
        if (rare) {
          this.floatAt(icon('rare'), baby.gx, baby.gy, baby.top + 0.8);
          this.mention(this.lineAbout(say.rare(), baby), 60);
        }
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
    if (!this.celebrating) this.sayNow(this.lineAbout(say.sick(t, a.species), a));
  }

  private heal(a: Animal): void {
    a.heal();
    this.healed++;
    sfx('heal');
    this.floatAt(icon('heart'), a.gx, a.gy, a.top + 0.2);
    this.sayNow(say.healed());
  }

  /**
   * Een dier ontsnapt uit zijn verblijf en loopt buiten rond tot je het terugzet. Elke soort op zijn eigen manier
   * (`ESCAPE_WAY`): springen, klimmen, vliegen, het hek omduwen of erdoor glippen. Achter het verkeerde hek
   * gebeurt het veel vaker; een blij dier achter het goede hek ontsnapt bijna nooit (`escapeChance`).
   * `forGoal`: het level vraagt om een ontsnapt dier, dan ontsnapt er altijd een. Om te proberen (in de console):
   * `only` laat juist dit dier ontsnappen, `how` op deze manier.
   */
  private letEscape(forGoal: boolean, only?: Animal, how?: EscapeWay): void {
    // een zeedier springt nooit uit zijn bak
    const options = (only ? [only] : this.animals).filter(a => !a.sick && !a.escaped && !a.led && ESCAPE_WAY[a.species] && this.grid.enclosureAt(...tileXY(a.tile)));
    const a = pickEscaper(options.map(item => ({ item, chance: escapeChance(item.species, !!item.needsFence, item.happy) })), forGoal);
    if (!a) return;
    const region = this.grid.enclosureAt(...tileXY(a.tile))!;
    const way = how ?? escapeWay(a.species, !!a.needsFence) ?? 'slip';
    const inside = new Set(region.tiles);
    let best: { x: number; y: number; d: number; e: Edge; score: number } | null = null;
    for (const i of region.tiles) {
      const [x, y] = tileXY(i);
      for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
        const nx = x + dx, ny = y + dy;
        if (!this.grid.inBounds(nx, ny) || inside.has(tileIndex(nx, ny)) || this.grid.enclosureAt(nx, ny) || this.taken(nx, ny)) continue;
        const e: Edge = dx ? { o: 'v', x: x + Math.max(0, dx), y } : { o: 'h', x, y: y + Math.max(0, dy) };
        const kind = this.grid.getEdge(e);
        // het hek dicht bij het dier; wie duwt, kiest liefst hout (dat valt om), wie glipt liefst een poort
        const likes = (way === 'push' && kind === 1) || (way === 'slip' && (kind === 2 || kind === 8));
        const score = Math.hypot(x + 0.5 - a.gx, y + 0.5 - a.gy) + Math.random() * 0.8 - (likes ? 1.5 : 0);
        if (!best || score < best.score) best = { x: nx, y: ny, d: dx + dy, e, score };
      }
    }
    if (!best) return;
    const { e } = best, mid: [number, number] = e.o === 'h' ? [e.x + 0.5, e.y] : [e.x, e.y + 0.5];
    a.homeTile = a.tile;
    a.fledFence = a.needsFence;
    const hit = a.escape(best.x + 0.5, best.y + 0.5, way, mid);
    if (way === 'push' && this.grid.getEdge(e) === 1) this.pushes.push({ a, e, out: best.d > 0 ? 1 : -1, at: this.clock + hit });
    sfx('alarm');
    animalSound(a.species, a.young, 1, [a.gx, a.gy]);
    this.floatAt(icon('catch'), a.gx, a.gy, a.top + 0.25);
    if (!this.celebrating) {
      this.sayNow(this.lineAbout(say.escaped(t, a.species, a.fledFence), a));
      this.callForHelp('name.help.2');
    }
  }

  /** Het sterke dier duwt tegen het hek: dat stuk valt om en is kapot, tot de klusser of jij het weer maakt. */
  private knockDown(e: Edge, out: 1 | -1): void {
    this.wear.set(edgeKey(e), 3);
    this.syncWear();
    this.view.topple(e, out);
    sfx('fence', { volume: 1.2, rate: 0.7 });
    const [x, y] = e.o === 'h' ? [e.x + 0.5, e.y] : [e.x, e.y + 0.5];
    this.view.burst(x, y, 0.15, 0xc9b28a, 8);
    this.floatAt(icon('hammer'), x, y, 0.7);
  }

  // ------------------------------------------------------------ de bewaker
  /** Ontsnapte dieren, voor de bewaker. Niet het dier dat de speler vasthoudt of dat nog over het hek gaat. */
  guardJobs(): GuardJob[] {
    return this.animals
      .filter(a => a.escaped && a !== this.moving && !a.bolting && (this.guardRest.get(a) ?? 0) <= this.clock)
      .map(a => ({ animal: a, gx: a.gx, gy: a.gy }));
  }

  /**
   * De bewaker fluit: het dier loopt achter hem aan. Hij brengt het naar zijn eigen verblijf, anders naar het
   * dichtstbijzijnde verblijf met dezelfde soort, anders naar een leeg verblijf.
   */
  guardMeet(job: GuardJob, guard: Worker): Set<number> | null {
    const a = job.animal as Animal;
    if (!this.animals.includes(a) || !a.escaped) return null;
    const room = (region: Region): Set<number> =>
      new Set(region.tiles.filter(i => {
        const [x, y] = tileXY(i);
        return this.canHost(x, y, a) && this.walkable(i);
      }));
    const far = (pen: Pen): number => Math.hypot(pen.cx - a.gx, pen.cy - a.gy);
    const others = (pen: Pen): Animal[] => this.animalsIn(pen.region.id).filter(b => b !== a);
    const own = (pen: Pen): boolean => others(pen).some(b => b.species === a.species);
    const home = a.homeTile >= 0 ? this.penAt(...tileXY(a.homeTile)) : undefined;
    const same = this.pens.filter(own).sort((p, q) => far(p) - far(q));
    const empty = this.pens.filter(pen => !others(pen).length).sort((p, q) => far(p) - far(q));
    // het eigen verblijf, zolang daar intussen geen andere soort is komen wonen
    const homes = home && (own(home) || !others(home).length) ? [home] : [];
    for (const pen of [...homes, ...same, ...empty]) {
      const tiles = room(pen.region);
      if (!tiles.size) continue;
      const back = 0.35 + a.info.length * MODEL_SCALE * 0.5;
      a.heel(() => (guard.leads(a) ? guard.leadPoint(back) : null));
      sfx('chime', { volume: 0.4, rate: 1.4 });
      this.floatAt(icon('guard'), guard.gx, guard.gy, guard.height + 0.3);
      return tiles;
    }
    return null;
  }

  guardDone(job: GuardJob, guard: Worker, force: boolean): boolean {
    const a = job.animal as Animal;
    if (!this.animals.includes(a) || !a.escaped) return true;
    const [x, y] = tileXY(a.tile);
    const home = !!this.grid.enclosureAt(x, y) && this.canHost(x, y, a);
    if (!home && !force) return false;
    if (!home) {
      // het dier bleef hangen: dan zet de bewaker het bij zich neer, als het daar mag
      const [gx, gy] = tileXY(guard.tile);
      if (!this.canHost(gx, gy, a)) return true;
      a.moveTo(guard.gx, guard.gy);
    }
    a.settle();
    this.caught++;
    sfx('place');
    this.floatAt(icon('heart'), a.gx, a.gy, a.top + 0.2);
    this.mention(say.guardBack(), 60);
    return true;
  }

  guardLet(job: GuardJob, noGate: boolean): void {
    const a = job.animal as Animal;
    this.guardRest.set(a, this.clock + 20);
    if (noGate) this.noGate(a.gx, a.gy);
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
      // vraagt het level erom, of staat er een dier achter het verkeerde hek, dan hoef je er niet lang op te wachten
      const goal = this.goalOpen('caught');
      const wrong = this.animals.some(a => a.needsFence && !a.escaped && ESCAPE_WAY[a.species]);
      if (goal) this.escapeIn = Math.min(this.escapeIn, ESCAPE_FOR_GOAL[1]);
      else if (wrong) this.escapeIn = Math.min(this.escapeIn, ESCAPE_WRONG[1]);
      this.escapeIn -= dt;
      if (this.escapeIn <= 0) {
        this.escapeIn = between(goal ? ESCAPE_FOR_GOAL : wrong ? ESCAPE_WRONG : ESCAPE_EVERY);
        if (!this.animals.some(a => a.escaped)) this.letEscape(goal);
      }
    }
    // een sterk dier dat het hek omduwt: het hek valt pas om als het dier ertegenaan duwt
    if (this.pushes.length) {
      for (const p of this.pushes) if (this.clock >= p.at && p.a.escaped && p.a.bolting && this.grid.getEdge(p.e) === 1) this.knockDown(p.e, p.out);
      this.pushes = this.pushes.filter(p => this.clock < p.at);
    }
    // het oor van de speler: het midden van het beeld. Ingezoomd hoor je alleen wat daar vlakbij is, maar wel goed;
    // uitgezoomd hoor je meer tegelijk, maar doffer en verder weg
    const [earX, earY, zoom, rx, ry] = this.view.hearing();
    const far = Math.max(0, Math.min(1, (zoom - 9) / 26));
    listen(earX, earY, zoom * 0.7, far, rx, ry);
    // een dier met een glimmende vacht fonkelt af en toe
    for (const a of this.animals) if (a.rare === 'shiny' && !a.sleeping && Math.random() < dt * 0.3) this.floatAt(icon('sparkle'), a.gx + (Math.random() - 0.5) * 0.5, a.gy, a.top * (0.5 + Math.random() * 0.5));
    // af en toe laat een dier zich horen: een dier dat in beeld is. Kijk je van dichtbij, dan hoor je ze vaker
    this.chatterIn -= dt;
    if (this.chatterIn <= 0) {
      const awake = this.animals.filter(a => !a.sleeping && heard(a.gx, a.gy) > 0.1);
      const a = awake[Math.floor(Math.random() * awake.length)];
      this.chatterIn = (a ? 3.5 + 5 * far : 6) + Math.random() * (4 + 6 * far);
      if (a) animalSound(a.species, a.young, 0.65 - 0.2 * far, [a.gx, a.gy]);
      if (a) {
        this.loud = a;
        this.loudAt = this.clock;
      }
    }
    // gasten: geroezemoes van de gasten die in beeld zijn (hoe meer, hoe drukker het klinkt), en af en toe een lachje
    const crowd = this.guests.guests.length;
    let near = 0;
    for (const guest of this.guests.guests) near += heard(guest.gx, guest.gy);
    layer('crowd.small', near > 0.3 ? Math.min(1, near / 6) * (near > 12 ? 0.3 : 0.6) : 0);
    layer('crowd.big', near > 8 ? Math.min(1, (near - 8) / 12) * 0.55 : 0);
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
    this.specialGuests(dt, crowd);
    this.babbleIn -= dt;
    if (this.babbleIn <= 0) {
      this.babbleIn = 5 + Math.random() * 9;
      // kinderen hoor je het vaakst
      // een kinderstem of een praatje van een gast die in beeld is
      const talker = this.guests.guests[Math.floor(Math.random() * crowd)];
      if (talker && Math.random() < Math.min(1, crowd / 10)) sfx(talker.child ? 'guest.kid' : 'guest.chat', { volume: 0.4, every: 2, at: [talker.gx, talker.gy] });
    }
  }

  private wishIcon(a: Animal, wish: WishId): string {
    const info = SPECIES[a.species];
    switch (wish) {
      case 'health': return icon('sick');
      case 'enclosure': return icon(a.needsFence ? NEED_ICON[a.needsFence] : a.fenceBroken ? 'hammer' : 'fence');
      // bij het voer staat klein het plaatje van de knop Voerbak: daar zet je het neer
      case 'food': return icon(info.food) + `<i class="from">${icon('trough_empty')}</i>`;
      case 'bed': return icon(info.bed);
      case 'fun': return toyIcon(TOY_OF[a.species] ?? 'ball');
      case 'climate': return toyIcon(CLIMATE[a.species] ?? 'lamp');
      // te weinig bomen, planten of stenen: erbij staat hoeveel er nog bij moeten; te veel: hoeveel eraf
      case 'wild': {
        const ask = a.wildAsk;
        return wildIcon(ask?.kind ?? 'plant') + (ask ? `<i class="count">${ask.more ? '+' : '−'}${ask.by}</i>` : '');
      }
      case 'space': return icon('grow');
      case 'terrain': return icon(a.missing ?? info.terrain);
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

  /**
   * Natuur in het menu van het dier: een vakje voor bomen, planten en stenen, elk met een balkje dat laat zien of
   * het er genoeg zijn (geen getallen: hoeveel er nog bij of af moeten, staat in het wolkje boven het dier).
   */
  private wildChips(a: Animal): string {
    const region = this.grid.regions[this.grid.regionOf[a.tile]];
    if (!region) return '';
    const have = this.wildIn(region), want = wildRange(a.species, have.land);
    if (!want || !have.land) return '';
    return WILD_KINDS.filter(kind => want[kind][0] > 0 || have[kind] > 0 || a.wildAsk?.kind === kind).map(kind => {
      const [min, max] = want[kind], ok = have[kind] >= min && have[kind] <= max;
      // het balkje: vol als het ruim klopt, goed als het net klopt (op het randje), matig als het bijna klopt
      // (er staat al iets, of er staat er één te veel) en slecht als er niets staat of veel te veel
      const n = have[kind];
      const level = ok ? (n > min && n < max ? 1 : 0.75) : n < min ? (n > 0 ? 0.5 : 0.1) : n - max <= 1 ? 0.5 : 0.1;
      return `<span class="wish wild ${ok ? 'ok' : 'no'}">${wildIcon(kind)}${meter(level)}</span>`;
    }).join('');
  }

  /**
   * Hoe goed het met deze wens gaat, van 0 tot 1, voor het balkje in het menu van het dier. Honger, een vies
   * verblijf en eenzaamheid lopen geleidelijk op; de rest is in orde of niet.
   */
  private wishLevel(a: Animal, wish: WishId, ok: boolean): number {
    if (wish === 'food') return Math.max(0.05, 1 - a.hunger);
    if (wish === 'friend') return ok ? 1 : Math.max(0.12, 1 - a.lonely / Math.max(1, herdOf(a.species) - 1));
    if (wish === 'clean') {
      const region = this.grid.regionOf[a.tile];
      const poops = this.poops.filter(p => this.grid.regionOf[tileIndex(Math.floor(p.gx), Math.floor(p.gy))] === region).length;
      return Math.max(0.08, 1 - poops / (MAX_POOPS_CLEAN + 2));
    }
    return ok ? 1 : 0.12;
  }

  private animalMenu(a: Animal): void {
    // de speler weet nu dat je op een dier kunt tikken: de uitleg hoeft niet meer
    this.told.add('tapAnimal');
    const s = this.view.toScreen(a.gx, a.gy, a.top);
    const wishes = a.checkWishes(this);
    // bovenaan het dier zelf, zoals het nu beweegt, met eronder wat het aan het doen is
    const header =
      '<span class="live"><canvas class="portrait3d" width="144" height="144"></canvas><b class="doing"></b></span>' +
      icon(sexOf(a) === 'male' ? 'boy' : 'girl') +
      (a.rare ? icon('rare') : '') + (a.nature !== 'plain' ? `<span class="wish ok" title="${t(`nature.${a.nature}`)}">${icon(`nature_${a.nature}` as IconId)}</span>` : '') +
      '<span class="needs">' + WISH_ORDER.filter(k => (k !== 'health' || a.sick) && (k !== 'fun' || (this.has('fun') && !!TOY_OF[a.species])) && (k !== 'space' || !!SPACE[a.species]) && (k !== 'climate' || (this.has('climate') && !!CLIMATE[a.species])) && (k !== 'wild' || (this.has('wild') && !!wildWant(a.species)))).map(k =>
        // bij de grond staat elk stukje van de mix apart: zo zie je wat er nog bij moet
        k === 'terrain'
          ? [SPECIES[a.species].terrain, ...(ALSO[a.species] ?? [])].map((kind, i) => {
            const ok = i ? !a.lacking.includes(kind) : a.mainOk;
            return `<span class="wish ${ok ? 'ok' : 'no'}">${icon(kind)}${meter(ok ? 1 : 0.12)}</span>`;
          }).join('')
          : k === 'wild' ? this.wildChips(a)
          : `<span class="wish ${wishes[k] ? 'ok' : 'no'}">${this.wishIcon(a, k)}${meter(this.wishLevel(a, k, wishes[k]))}</span>`).join('') + '</span>';
    const opt = (id: string, ic: IconId, key: string): ToolOption => ({ id, icon: icon(ic), label: t(key) });
    const items = [opt('pet', 'pet', 'animal.pet'), opt('fact', 'fact', 'animal.fact'), opt('rename', 'nametag', 'animal.rename'), opt('sedate', 'sleep', 'animal.sedate'), opt('move', 'move', 'animal.move'), opt('away', 'empty', 'animal.away')];
    if (a.sick) items.unshift(opt('vet', 'vet', 'animal.vet'));
    animalSound(a.species, a.young, 0.8, [a.gx, a.gy]);
    // het karakter staat achter de naam: 'Bobo (speels)'
    const title = a.nature === 'plain' ? a.name : `${a.name} (${t(`nature.${a.nature}`)})`;
    this.hud.showMenu(s.x, s.y, title, items, id => {
      if (id === 'vet') {
        this.vetGame(a);
      } else if (id === 'fact') {
        this.tellFact(a.species, true);
      } else if (id === 'pet') {
        a.emote('Happy', 1.4);
        animalSound(a.species, a.young, 1, [a.gx, a.gy]);
        this.floatAt(icon('heart'), a.gx, a.gy, a.top + 0.2);
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
    }, header, 'animal');
    const canvas = document.querySelector<HTMLCanvasElement>('#menu canvas.portrait3d');
    this.live = canvas ? { a, canvas, label: document.querySelector<HTMLElement>('#menu .doing'), was: '', skip: false } : null;
    this.updateLive();
  }

  /** Het dier in het menu: een levend plaatje en wat het nu doet. */
  private live: { a: Animal; canvas: HTMLCanvasElement; label: HTMLElement | null; was: string; skip: boolean } | null = null;

  private updateLive(): void {
    const L = this.live;
    if (!L) return;
    if (!L.canvas.isConnected || !this.hud.menuOpen || !this.animals.includes(L.a)) {
      this.live = null;
      return;
    }
    // om het andere beeldje is vaak genoeg
    L.skip = !L.skip;
    if (L.skip) this.view.portrait(L.a.model.root, L.canvas, Math.max(1.2, L.a.top * 1.45, L.a.info.length * MODEL_SCALE * 1.2));
    const doing = L.a.doing;
    if (doing !== L.was) {
      L.was = doing;
      if (L.label) L.label.textContent = t(`doing.${doing}`);
    }
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
      animalSound(a.species, a.young, 1, [a.gx, a.gy]);
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
    const a = index < NEEDS_SHOWN ? this.needy[index] : undefined;
    if (!a) {
      // de knop onderaan het lijstje: naar een gast die de weg kwijt is
      const guest = this.guests.guests.find(q => q.astray > 0);
      if (!guest) return;
      this.view.flyTo(guest.gx, guest.gy);
      this.pointed = { at: () => (this.guests.guests.includes(guest) ? [guest.gx, guest.gy] : null), until: this.clock + 6 };
      return;
    }
    this.marked = { a, until: this.clock + 8 };
    this.view.flyTo(a.gx, a.gy);
    animalSound(a.species, a.young, 0.8, [a.gx, a.gy]);
  }

  /** Bij een gast zie je hoe het gaat, wat zijn lievelingsdier is en wat hij nu wil. */
  private guestMenu(guest: Guest): void {
    const s = this.view.toScreen(guest.gx, guest.gy, guest.height);
    // een wens met een staand balkje: hoe voller, hoe beter het gaat (honger 0 is een vol balkje)
    const need = (value: number, ic: IconId): string => `<span class="wish ${value > 0.6 ? 'no' : 'ok'}">${icon(ic)}${meter(1 - value)}</span>`;
    // extra zin in iets (een ijsje, een ballon, een ritje): alleen als de gast er nu echt zin in heeft
    const want = (value: number, ic: IconId): string => (value > 0.7 ? need(value, ic) : '');
    // wie is het: een naam en een paar weetjes, bij dezelfde gast steeds dezelfde (zie traits.ts)
    const teacher = this.classTeacher.get(guest), lead = guest.leader as { badge?: string | null } | null;
    const trip = lead?.badge === 'schoolclass', party = guest.badge === 'cake' || lead?.badge === 'cake';
    // een bijzondere gast heeft één vast weetje: de juf of meester, de beroemde gast, een kind op schoolreis, het feestje
    const fixed: [IconId, string] | null = teacher ? ['schoolclass', teacher] : guest.star ? ['star', 'star'] : trip ? ['schoolclass', 'trip'] : party ? ['cake', 'party'] : guest.wheels === 'pram' ? ['pram', 'pram'] : null;
    const card = guestCard(guest.seed, guest.child, document.documentElement.lang, {
      sex: teacher ? (teacher === 'master' ? 'm' : 'f') : guest.sex,
      count: fixed ? 2 : 3,
      skip: teacher || trip ? ['job', 'school', 'today', 'travel'] : guest.star ? ['job'] : party ? ['today'] : [],
      calm: guest.wheels === 'chair',
    });
    const line = (text: string, ic?: IconId): string => `<span class="fact${ic ? ' now' : ''}">${ic ? icon(ic) : ''}${text}</span>`;
    // wat er nu speelt, hooguit twee regels: het lievelingsdier en de hoogste nood
    const urgent = ([[guest.bladder, 'toilet', 'toilet'], [guest.hunger, 'foodstall', 'hungry'], [guest.thirst, 'drinkstall', 'thirsty'], [guest.tired, 'bench', 'tired']] as [number, IconId, string][])
      .filter(n => n[0] > 0.6).sort((a, b) => b[0] - a[0]);
    const now = [
      ...(guest.fav ? [line(t(`guest.fact.${guest.favSeen ? 'favSeen' : 'fav'}`, { animal: t(`species.${guest.fav}.the`) }), 'heart')] : []),
      ...urgent.map(n => line(t(`guest.fact.${n[2]}`), n[1])),
    ].slice(0, 2);
    const facts = `<span class="facts">${now.join('')}${fixed ? line(t(`guest.fact.${fixed[1]}`), fixed[0]) : ''}${card.facts.map(f => line(f)).join('')}</span>`;
    // bovenaan de gast zelf, uitvergroot en bewegend, met eronder wat hij doet; daaronder zijn wensen en zijn weetjes
    const header =
      '<span class="live"><canvas class="portrait3d" width="144" height="144"></canvas><b class="doing"></b></span>' +
      '<span class="needs">' +
      `<span class="wish ${guest.fun >= 0.3 ? 'ok' : 'no'}">${icon(guest.fun >= 0.55 ? 'smile_good' : guest.fun >= 0.3 ? 'smile_ok' : 'smile_bad')}${meter(guest.fun)}</span>` +
      (guest.fav ? `<span class="wish ${guest.favSeen ? 'ok' : 'no'}">${speciesIcon(guest.fav)}${icon('heart', 'badge')}</span>` : '') +
      need(guest.hunger, 'foodstall') + need(guest.thirst, 'drinkstall') + need(guest.bladder, 'toilet') + need(guest.tired, 'bench') +
      want(guest.treat, 'icecream') + want(guest.balloon, 'balloon') + want(guest.gift, 'souvenir') + want(guest.playful, 'slide') + want(guest.hat, 'hats') +
      want(guest.curious, 'fountain') + want(guest.rideWish, 'carousel') +
      '</span>' + facts;
    this.hud.showMenu(s.x, s.y, card.name || t('guest.title'), [{ id: 'wave', icon: icon('hand'), label: t('guest.wave') }], () => {
      if (!guest.waved) guest.fun = Math.min(1, guest.fun + 0.1);
      guest.waved = true;
      // de gast zwaait terug
      guest.greet();
      this.floatAt(icon('heart'), guest.gx, guest.gy, guest.height + 0.2);
    }, header, 'guest');
    const canvas = document.querySelector<HTMLCanvasElement>('#menu canvas.portrait3d');
    this.liveGuest = canvas ? { g: guest, canvas, label: document.querySelector<HTMLElement>('#menu .doing'), was: '', skip: false } : null;
    this.updateLiveGuest();
  }

  /** De gast in het menu: een levend plaatje en wat hij nu doet. */
  private liveGuest: { g: Guest; canvas: HTMLCanvasElement; label: HTMLElement | null; was: string; skip: boolean } | null = null;

  private updateLiveGuest(): void {
    const L = this.liveGuest;
    if (!L) return;
    if (!L.canvas.isConnected || !this.hud.menuOpen || !this.guests.guests.includes(L.g)) {
      this.liveGuest = null;
      return;
    }
    // om het andere beeldje is vaak genoeg
    L.skip = !L.skip;
    if (L.skip) this.view.portrait(L.g.mesh, L.canvas, L.g.child ? 0.95 : 1.15);
    const doing = L.g.doing;
    if (doing !== L.was) {
      L.was = doing;
      if (L.label) L.label.textContent = t(`guest.doing.${doing}`);
    }
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
    this.lastHover = [cx, cy];
    if (this.staffGhost) this.staffGhost.worker.mesh.visible = false;
    this.hoverPoop = null;
    this.hoverWorn = null;
    this.hoverPen = null;
    this.hoverAt = null;
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
    switch (this.mode()) {
      case 'terrain': {
        const terrain = this.option.terrain as Terrain;
        if (inside) this.view.ghostTile(x, y, TERRAIN_INFO[terrain].colors[0]);
        return this.hud.setCursor(CUR[terrain]);
      }
      case 'fence': {
        const kind = FENCE_KIND[this.option.fence];
        // tijdens het slepen van een hok zie je het hele hok als voorbeeld
        if (dragging && this.rect) return this.hud.setCursor(CUR[this.option.fence]);
        const L = dragging ? this.line : null;
        const e = L?.axis
          ? L.axis === 'h' ? { o: 'h' as const, x: Math.floor(g.gx), y: L.fixed } : { o: 'v' as const, x: L.fixed, y: Math.floor(g.gy) }
          : nearestEdge(g.gx, g.gy);
        if (e && this.grid.validEdge(e)) this.view.ghostFence(e, kind, kind === 1 ? this.grid.getEdge(e) === 0 : this.grid.getEdge(e) !== kind);
        return this.hud.setCursor(CUR[this.option.fence]);
      }
      case 'trough':
        if (free) this.view.ghostTrough(x, y, !!this.grid.enclosureAt(x, y), this.quarter);
        return this.hud.setCursor(inside && this.troughAt(x, y) ? CUR.feed : CUR.trough);
      case 'bed':
        if (free) this.view.ghostBed(x, y, this.option.bed as BedKind, !!this.grid.enclosureAt(x, y), this.quarter);
        return this.hud.setCursor(CUR[this.option.bed]);
      case 'toy':
        if (free) this.view.ghostToy(x, y, this.option.toy as ToyKind, !!this.grid.enclosureAt(x, y), this.quarter);
        return this.hud.setCursor(CUR[this.option.toy]);
      case 'decor':
        if (EDGE_DECOR.includes(this.option.decor as DecorKind)) {
          const e = nearestEdge(g.gx, g.gy);
          if (e && this.grid.validEdge(e)) this.view.ghostDecor(e.x, e.y, this.option.decor as DecorKind, this.edgeDecorFits(e), e.o, this.edgeRot(e, this.edgeSide(e, g.gx, g.gy)), this.decorShift({ x: e.x, y: e.y, edge: e.o }));
        } else if (inside) {
          // iets kleins hangt boven het kwart onder je vinger
          const q = this.decorQuarter(this.option.decor as DecorKind, g.gx, g.gy), [qx, qy] = quarterAt(q);
          this.view.ghostDecor(x + qx - 0.5, y + qy - 0.5, this.option.decor as DecorKind, this.decorFits(x, y, q), undefined, this.quarter);
        }
        return this.hud.setCursor(CUR[this.option.decor]);
      case 'prop': {
        const kind = this.propKind();
        const [sx, sy] = this.propSpot(kind, g.gx, g.gy), n = PROP[kind].size;
        this.view.ghostProp(kind, (sx + n / 2) / 2, (sy + n / 2) / 2, this.quarter, this.propFits(kind, sx, sy));
        return this.hud.setCursor((CUR[`prop.${kind}`] ??= cursor(PROP_ICON[kind])));
      }
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
        const kind = this.shopKind();
        if (SHOP_SIZE[kind] === 1) {
          const e = this.itemEdge(g.gx, g.gy);
          // het voorbeeld staat al zoals het komt: naar het pad, of anders naar de kant waar je bent
          if (e) this.view.ghostShop(e.x, e.y, kind, this.edgeFits(e), { o: e.o, face: this.faceFor(e, this.edgeSide(e, g.gx, g.gy)) * this.flip });
          return this.hud.setCursor(CUR[this.shopKind()]);
        }
        const [ax, ay, rot] = this.shopPose(g, kind);
        this.view.ghostShop(ax, ay, kind, this.shopFits(ax, ay, kind, rot), undefined, rot);
        return this.hud.setCursor(CUR[this.shopKind()]);
      }
      case 'animal': {
        const sex = this.option.sex as Sex;
        if (inside && this.option.animal) animalGhost(`${this.option.animal}_${sex}`, sex, this.canHost(x, y));
        return this.hud.setCursor(CUR.animal);
      }
      case 'erase': {
        const e = nearestEdge(g.gx, g.gy, 0.3);
        const item = e && this.edgeItemAt(e), post = e && this.edgeDecorAt(e);
        if (e && this.grid.getEdge(e) !== 0) this.view.ghostFence(e, this.grid.getEdge(e), false);
        else if (item) this.view.ghostShop(item.x, item.y, item.kind, false, { o: item.edge!, face: item.face ?? 1 });
        else if (post) this.view.ghostDecor(post.x, post.y, post.kind, false, post.edge, post.rot ?? 0, this.decorShift(post));
        else if (inside && this.troughAt(x, y)) this.view.ghostTrough(x, y, false, this.troughAt(x, y)!.rot ?? 0);
        else if (inside && this.bedAt(x, y)) this.view.ghostBed(x, y, this.bedAt(x, y)!.kind, false, this.bedAt(x, y)!.rot ?? 0);
        else if (inside && this.toyAt(x, y)) this.view.ghostToy(x, y, this.toyAt(x, y)!.kind, false, this.toyAt(x, y)!.rot ?? 0);
        else if (inside && this.decorAt(x, y)) {
          const d = this.decorAt(x, y, g.gx, g.gy)!, [qx, qy] = quarterAt(d.q);
          this.view.ghostDecor(x + qx - 0.5, y + qy - 0.5, d.kind, false, undefined, d.rot ?? 0);
        }
        else if (inside && this.shopAt(x, y)) this.view.ghostShop(this.shopAt(x, y)!.x, this.shopAt(x, y)!.y, this.shopAt(x, y)!.kind, false, undefined, this.shopAt(x, y)!.rot ?? 0);
        else {
          const p = this.propUnder(g.gx, g.gy);
          if (p) this.view.ghostProp(p.kind, ...this.propCenter(p), p.rot, false);
        }
        return this.hud.setCursor(CUR.erase);
      }
      case 'action':
        this.hoverPoop = (this.option.action === 'broom' ? this.pickPoop(cx, cy) : this.option.action === 'picker' ? this.pickLitter(cx, cy) : null) ?? null;
        this.hoverWorn = this.option.action === 'hammer' ? this.wornAt(g.gx, g.gy) : null;
        return this.hud.setCursor(CUR[this.option.action]);
      default:
        if (dragging) return this.hud.setCursor(CUR.grabbing);
        if (this.pickLoose(cx, cy)) return this.hud.setCursor(CUR.catch);
        // alles waar een tik een menu opent, krijgt een ring zolang je erboven hangt: zo zie je dat je erop kunt tikken
        const pet = this.pickAnimal(cx, cy);
        if (pet) {
          this.hoverAt = { at: () => [Math.floor(pet.gx), Math.floor(pet.gy)], w: 1, h: 1 };
          return this.hud.setCursor(CUR.pet);
        }
        const person = this.pick(this.workers.filter(w => !w.away), cx, cy, w => w.height * 0.6, 0.4) ?? this.pick(this.guests.guests, cx, cy, q => q.height * 0.6, 0.4);
        if (person) {
          this.hoverAt = { at: () => [Math.floor(person.gx), Math.floor(person.gy)], w: 1, h: 1 };
          return this.hud.setCursor(CUR.menu);
        }
        if (inside && (this.troughAt(x, y) || this.shopAt(x, y))) {
          const stall = this.troughAt(x, y) ? undefined : this.shopAt(x, y);
          const spot: [number, number] = stall ? [stall.x, stall.y] : [x, y];
          const [sw, sh] = stall ? shopTiles(stall) : [1, 1];
          this.hoverAt = { at: () => spot, w: sw, h: sh };
          return this.hud.setCursor(stall ? CUR.menu : CUR.feed);
        }
        if (inside && this.penAt(x, y)) {
          // een tik hier opent het menu van het verblijf: het licht alvast zacht op (niet op speelgoed, daar tik je op)
          if (!this.toyAt(x, y) && !this.bedAt(x, y)) this.hoverPen = this.penAt(x, y) ?? null;
          return this.hud.setCursor(CUR.menu);
        }
        return this.hud.setCursor(CUR.grab);
    }
  }

  /** Eén punt van een tik of sleepbeweging. `along` is de sleeprichting; bij een tik is die er niet. */
  private paint(cx: number, cy: number, along?: 'h' | 'v'): void {
    const g = this.view.groundPoint(cx, cy);
    if (!g) return;
    const first = !along;
    const x = Math.floor(g.gx), y = Math.floor(g.gy);
    // ook met het hek of de grond in de hand: een tik op grond die te koop is, opent het koopmenu
    if (first && !this.grid.inBounds(x, y)) {
      const side = this.plotAt(g.gx, g.gy);
      if (side) return this.landMenu(side);
    }
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
      if (PATH_KINDS.includes(terrain) && this.grid.inBounds(x, y) && this.shopAt(x, y)) return;
      if (!this.grid.setTerrain(x, y, TERRAINS.indexOf(terrain))) return;
      sfx('paint', { volume: 0.5, every: 0.09 });
      this.view.paintTerrain(this.grid);
      this.faceEdgeItems();
      this.sweepProps();
      const region = this.grid.enclosureAt(x, y);
      if (region)
        for (const a of this.animalsIn(region.id)) {
          // wat miste het dier, en wat mist het nu? Veel dieren willen een mix: naast hun eigen grond ook een stukje
          // van iets anders (een giraf wil zand met wat droog gras). Groen: dit miste het dier, of zijn grond klopt nu.
          // Rood: nu klopt er iets niet meer wat eerst goed was. Geel: prima, maar het maakt geen verschil.
          const was = a.missing;
          a.checkWishes(this);
          const now = a.missing;
          const wanted = SPECIES[a.species].terrain === terrain || (ALSO[a.species] ?? []).includes(terrain);
          const better = (wanted && was === terrain) || (was !== null && now === null);
          const worse = now !== null && (was === null || (now !== was && !wanted));
          this.react(a, better ? 'good' : worse ? 'bad' : wanted && SPECIES[a.species].terrain === terrain ? 'good' : 'ok');
        }
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
      const decor = !shop ? (near && this.edgeDecorAt(near)) || this.decorAt(x, y, g.gx, g.gy) : undefined;
      if (tr || bed || shop || toy || decor) sfx('erase');
      else {
        // niets groots op deze tegel: dan het graspolletje, de steen of de boom onder de gum
        const p = this.propUnder(g.gx, g.gy);
        if (p) {
          sfx('erase');
          this.removeProp(p);
        }
        return;
      }
      if (decor) {
        this.view.scene.remove(decor.mesh);
        this.decors = this.decors.filter(k => k !== decor);
        this.syncStrings();
        // de vijvers ernaast krijgen hun ronde rand terug
        if (decor.kind === 'pond') this.syncPonds();
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
        this.earn(refund(TOY_PRICE[toy.kind] ?? PRICE.toy), x + 0.5, y + 0.5);
      } else if (shop) {
        this.view.scene.remove(shop.mesh);
        shop.warn?.remove();
        this.shops = this.shops.filter(k => k !== shop);
        this.earn(refund(SHOP_PRICE[shop.kind]), ...shopCenter(shop));
      }
    }
  }

  /** Het hok dat je aan het slepen bent (in tegels, van hoek tot en met hoek) en de tegels daarvan. */
  private rect: { x0: number; y0: number; x1: number; y1: number } | null = null;
  private rectTiles: number[] = [];

  /** De randen rondom het blok tegels van (x0, y0) tot en met (x1, y1). */
  private boxEdges(b: { x0: number; y0: number; x1: number; y1: number }): Edge[] {
    const edges: Edge[] = [];
    for (let x = b.x0; x <= b.x1; x++) edges.push({ o: 'h', x, y: b.y0 }, { o: 'h', x, y: b.y1 + 1 });
    for (let y = b.y0; y <= b.y1; y++) edges.push({ o: 'v', x: b.x0, y }, { o: 'v', x: b.x1 + 1, y });
    return edges;
  }

  /**
   * Een hok slepen: van de tegel waar je begint tot de tegel onder je vinger. Je ziet het hok als voorbeeld; de
   * hekken komen er pas te staan als je loslaat. Een poort, kijkruit of poortje zet je los neer, met een tik.
   */
  private fenceDrag(cx: number, cy: number): void {
    const g = this.view.groundPoint(cx, cy), L = this.line;
    if (!g || !L) return;
    const kind = FENCE_KIND[this.option.fence];
    if (kind === 2 || kind === 6 || kind === 8) return;
    // met losse hekken sleep je geen hok
    if (this.option.fenceMode !== 'box') return;
    const land = this.grid.land;
    const tx = (v: number): number => Math.max(land.x0, Math.min(land.x1 - 1, Math.floor(v)));
    const ty = (v: number): number => Math.max(land.y0, Math.min(land.y1 - 1, Math.floor(v)));
    const ax = tx(L.gx0), ay = ty(L.gy0), bx = tx(g.gx), by = ty(g.gy);
    // nog op dezelfde tegel: dat is geen hok maar een tik
    if (ax === bx && ay === by) return this.clearRect();
    const box = { x0: Math.min(ax, bx), y0: Math.min(ay, by), x1: Math.max(ax, bx), y1: Math.max(ay, by) };
    const was = this.rect;
    if (was && was.x0 === box.x0 && was.y0 === box.y0 && was.x1 === box.x1 && was.y1 === box.y1) return;
    this.rect = box;
    this.rectTiles = [];
    for (let y = box.y0; y <= box.y1; y++) for (let x = box.x0; x <= box.x1; x++) this.rectTiles.push(tileIndex(x, y));
    this.view.ghostRun(this.boxEdges(box), kind, true);
    sfx('tap', { volume: 0.3, every: 0.07 });
  }

  /** Staat de knop Hek op losse hekken, en is het een gewoon hek (geen poort of kijkruit, die zet je met een tik)? */
  private looseFence(): boolean {
    const kind = FENCE_KIND[this.option.fence];
    return this.option.fenceMode === 'loose' && kind !== 2 && kind !== 6 && kind !== 8;
  }

  private clearRect(): void {
    this.rect = null;
    this.rectTiles = [];
    this.view.ghostRun([], FENCE_KIND[this.option.fence], true);
  }

  /** Losgelaten: nu komen de hekken rondom het gesleepte hok te staan. Een houten hek laat staan wat er al stond. */
  private buildRect(box: { x0: number; y0: number; x1: number; y1: number }): void {
    const kind = FENCE_KIND[this.option.fence];
    let changed = false;
    for (const e of this.boxEdges(box)) {
      if (kind === 1 && this.grid.getEdge(e) !== 0) continue;
      if (this.grid.setEdge(e, kind)) changed = true;
    }
    if (!changed) return;
    sfx(FENCE_SOUND[kind]);
    this.gridChanged();
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

    // een tik op grond die te koop is: het koopmenu
    if (!inside && g && !this.moving) {
      const side = this.plotAt(g.gx, g.gy);
      if (side) return this.landMenu(side);
    }
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
      animalSound(loose.species, loose.young, 1, [loose.gx, loose.gy]);
      return this.floatAt(icon('catch'), loose.gx, loose.gy, loose.top + 0.2);
    }
    // vegen, afval prikken en hekken timmeren kan alleen met de actieknop. Een tik met iets anders (of met het
    // verkeerde gereedschap) kiest alvast het goede en wijst de knop aan
    const litter = this.pickLitter(cx, cy);
    const mess = this.pickPoop(cx, cy);
    const worn = g ? this.wornAt(g.gx, g.gy) : null;
    const item = g ? this.shops.find(sh => sh.edge && Math.hypot(edgePose(sh)[0] - g.gx, edgePose(sh)[1] - g.gy) < 0.38) : undefined;
    const grimy = inside ? this.shopAt(x, y) : undefined;
    // de klas zoekt een dier: een tik op een verblijf met dieren is het antwoord
    if (this.guideAsk && g && this.guideTap(g.gx, g.gy)) return;
    if (this.tool === 'action') {
      // wat je geprikt hebt gaat met een tik in de afvalbak
      if (item?.kind === 'bin' && this.carry) return this.dump(item);
      // een vieze kraam veeg je schoon met de veger
      if (grimy && (grimy.dirt ?? 0) >= 1) return this.option.action === 'broom' ? this.cleanShop(grimy, true) : this.pointTo('broom', x + 0.5, y + 0.5);
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
      // een tik op een bankje, bloembak of afvalbak draait het niet meer om: het veert alleen even op
      if (item && !this.pickAnimal(cx, cy, 0.3)) {
        if (item.kind === 'bin' && this.carry) return this.dump(item);
        sfx('tap');
        return this.pulse(item.mesh, 0.1);
      }
      // een paal of bord op een rand: aantikken laat het bewegen
      const post = this.decors.find(d => d.edge && Math.hypot(this.decorPos(d)[0] - g.gx, this.decorPos(d)[1] - g.gy) < 0.38);
      if (post && !this.pickAnimal(cx, cy, 0.3)) return this.pokeDecor(post);
      if (worn) return this.pointTo('hammer', g.gx, g.gy);
    }
    if (this.tool === 'hand') {
      // een verdwaald kind: één tik en het rent naar papa of mama
      const kid = this.pick(this.guests.guests.filter(q => q.lost), cx, cy, q => q.height * 0.6, 0.7);
      if (kid) {
        kid.bringBack();
        sfx('chime');
        return this.floatAt(icon('heart'), kid.gx, kid.gy, kid.height + 0.3);
      }
      const animal = this.pickAnimal(cx, cy);
      // een ziek dier: meteen naar de dokter
      if (animal?.sick) return this.vetGame(animal);
      if (animal) return this.animalMenu(animal);
      const worker = this.pick(this.workers.filter(w => !w.away), cx, cy, w => w.height * 0.6, 0.4);
      if (worker) return this.workerMenu(worker);
      const guest = this.pick(this.guests.guests, cx, cy, q => q.height * 0.6, 0.4);
      if (guest) return this.guestMenu(guest);
    }
    if (this.mode() === 'decor' && g && EDGE_DECOR.includes(this.option.decor as DecorKind)) {
      const e = nearestEdge(g.gx, g.gy);
      return this.placeDecorOnEdge(e, e ? this.edgeSide(e, g.gx, g.gy) : 1);
    }
    if (this.mode() === 'shop' && g) {
      const kind = this.shopKind();
      const e = SHOP_SIZE[kind] === 1 ? this.itemEdge(g.gx, g.gy) : null;
      return SHOP_SIZE[kind] === 1 ? this.placeOnEdge(e, e ? this.edgeSide(e, g.gx, g.gy) : 1) : this.placeShop(...this.shopPose(g, kind));
    }
    if (this.mode() === 'prop' && g) return this.placeProp(g.gx, g.gy);
    if (!inside) return;
    const tr = this.troughAt(x, y);
    if (tr) return this.troughMenu(tr);
    const stall = this.shopAt(x, y);
    if (stall && this.tool === 'hand') return (stall.dirt ?? 0) >= 1 ? this.pointTo('broom', x + 0.5, y + 0.5) : this.shopMenu(stall);
    if (this.tool === 'trough') return this.placeTrough(x, y);
    if (this.tool === 'bed') return this.placeBed(x, y);
    if (this.tool === 'toy') return this.placeToy(x, y);
    if (this.mode() === 'decor') return this.placeDecor(x, y, g?.gx, g?.gy);
    if (this.tool === 'staff') return this.placeStaff(x, y);
    if (this.tool === 'animal') return this.placeAnimal(x, y);
    // een tik op speelgoed: een dier komt ermee spelen
    const toy = this.toyAt(x, y);
    if (toy && this.tool === 'hand') return this.pokeToy(toy);
    // een tik op iets in het park: het beweegt, en het gastenboek gaat open
    const decor = this.decorAt(x, y, g?.gx, g?.gy);
    if (decor && this.tool === 'hand') return this.pokeDecor(decor);
    const pen = this.penAt(x, y);
    if (pen) this.penMenu(pen);
  }

  private attachInput(canvas: HTMLCanvasElement): void {
    canvas.style.touchAction = 'none';
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    // de toets R draait wat je gaat neerzetten, net als de draaiknop
    window.addEventListener('keydown', e => {
      if (!canvas.isConnected || e.repeat || (e.key !== 'r' && e.key !== 'R')) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      this.spinGhost();
    });
    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      this.view.zoomBy(e.deltaY > 0 ? 1.1 : 0.9);
    }, { passive: false });
    canvas.addEventListener('pointerleave', () => {
      this.hoverPen = null;
      this.hoverAt = null;
      this.view.hideGhost();
      if (this.staffGhost) this.staffGhost.worker.mesh.visible = false;
    });

    canvas.addEventListener('pointerdown', e => {
      canvas.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      this.hud.hideMenu();
      this.menuPen = null;
      this.lastInput = this.clock;
      this.hideHand();
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
      // een hek: een heel hok slepen, of (stand Los hek) hekken langs de rand waar je overheen veegt; een poort of
      // kijkruit zet je altijd los neer met een tik
      if (d.paint && this.tool === 'fence' && !this.looseFence()) this.fenceDrag(e.clientX, e.clientY);
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
      // een hok gesleept: nu pas komen de hekken. Een heel kort veegje met het hek telt als een tik op die rand
      const box = d.paint && this.tool === 'fence' && e.type === 'pointerup' ? this.rect : null;
      const flick = d.paint && this.tool === 'fence' && d.moved && !!this.line && !box && !this.looseFence();
      this.line = null;
      this.clearRect();
      if (box) this.buildRect(box);
      else if (e.type === 'pointerup' && (!d.moved || flick) && !d.pan) {
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

  // ------------------------------------------------------------ tijd, seizoenen en weer
  /** Hoe laat het is in het park: de tijd loopt door over opslaan heen. */
  private now(): number {
    return this.timeBase + this.clock;
  }

  /** Elk seizoen duurt één dag in het spel (een dag en een nacht: ongeveer dertien minuten). Voor FEATURE.season is het altijd zomer. */
  private seasonNow(): Season {
    if (!this.has('season')) return 'summer';
    return SEASONS[Math.floor(this.now() / (DAY_SECONDS + NIGHT_SECONDS)) % SEASONS.length];
  }

  /** Regent het (en is het geen sneeuw)? Dan worden gasten nat en schuilen de dieren. */
  raining(): boolean {
    return this.rainLeft > 0 && this.season !== 'winter';
  }

  wantsClimate(): boolean {
    return this.has('climate');
  }

  wantsWild(): boolean {
    return this.has('wild');
  }

  /** Een bui begint: de eerste keer vertelt de gastvrouw wat je kunt doen, en er komen plassen. */
  private startRain(): void {
    this.rainLeft = between(RAIN_SECONDS);
    if (this.season === 'winter') return;
    if (!this.told.has('rain')) {
      this.told.add('rain');
      this.lines.push(say.rain());
    }
    // plassen: een paar in de verblijven van de modderliefhebbers, de rest op gras en pad
    const spots: [number, number][] = [];
    for (const pen of this.pens) {
      if (!this.animalsIn(pen.region.id).some(a => MUD_LOVERS.includes(a.species))) continue;
      const free = pen.region.tiles.filter(i => !this.taken(...tileXY(i)) && this.grid.terrain[i] !== WATER);
      for (let k = 0; k < 2 && free.length; k++) spots.push(tileXY(free.splice(Math.floor(Math.random() * free.length), 1)[0]));
    }
    const { x0, y0, x1, y1 } = this.grid.land;
    for (let tries = 0; tries < 40 && spots.length < 12; tries++) {
      const x = x0 + Math.floor(Math.random() * (x1 - x0)), y = y0 + Math.floor(Math.random() * (y1 - y0));
      if (!this.taken(x, y) && this.grid.terrain[tileIndex(x, y)] !== WATER) spots.push([x, y]);
    }
    for (const [x, y] of spots) {
      const gx = x + 0.3 + Math.random() * 0.4, gy = y + 0.3 + Math.random() * 0.4;
      this.rainPuddles.push({ gx, gy, mesh: this.view.makeWetPuddle(gx, gy, 0.22 + Math.random() * 0.14), life: this.rainLeft + 50 + Math.random() * 25 });
    }
  }

  /** Elk beeldje: het seizoen, de regen, de plassen en de regenboog. */
  private updateSky(dt: number): void {
    const season = this.seasonNow();
    if (season !== this.season) {
      this.season = season;
      this.view.setSeason(season);
      // een nieuw seizoen: de directeur zegt het (niet bij het laden van een spel)
      if (this.seasonTold) this.lines.push(say.season(season));
      this.view.paintTerrain(this.grid);
    }
    this.seasonTold = true;
    if (this.has('weather')) {
      if (this.rainLeft > 0) {
        this.rainLeft -= dt;
        // niet na elke bui: dan blijft het iets bijzonders
        if (this.rainLeft <= 0 && this.season !== 'winter' && this.night < 0.3 && Math.random() < 0.55) {
          // de bui is voorbij en de zon schijnt: een regenboog, en de gasten kijken ernaar
          this.rainbow = RAINBOW_SECONDS;
          this.mention(say.rainbow(), 300);
          for (const g of this.guests.guests) {
            g.fun = Math.min(1, g.fun + 0.08);
            if (Math.random() < 0.5) g.greet();
          }
        }
      } else if (!this.celebrating) {
        this.rainIn -= dt;
        if (this.rainIn <= 0) {
          this.rainIn = between(RAIN_EVERY);
          this.startRain();
        }
      }
    }
    this.wet += ((this.rainLeft > 0 ? 1 : 0) - this.wet) * Math.min(1, dt * 0.7);
    if (this.rainbow > 0) {
      this.rainbow -= dt;
      this.view.showRainbow(Math.max(0, Math.min(1, this.rainbow / 6, (RAINBOW_SECONDS - this.rainbow) / 5)));
    }
    // wat er uit de lucht valt: regen (in de winter sneeuw), en anders blaadjes in de herfst en bloesem in de lente
    const snowy = season === 'winter';
    const sky: Sky = this.wet > 0.03 ? (snowy ? 'snow' : 'rain') : season === 'autumn' ? 'leaves' : season === 'spring' ? 'petals' : snowy ? 'snow' : 'clear';
    const amount = this.wet > 0.03 ? this.wet : sky === 'clear' ? 0 : 0.18;
    const key = `${sky}:${amount.toFixed(1)}`;
    if (key !== this.skyKey) {
      this.skyKey = key;
      this.view.setWeather(sky, amount);
    }
    layer('amb.rain', snowy ? 0 : this.wet * 0.5);
    for (const p of this.rainPuddles) {
      p.life -= dt;
      (p.mesh.material as THREE.MeshStandardMaterial).opacity = Math.max(0, Math.min(0.55, p.life / 8, 0.55));
      if (p.life <= 0) this.view.scene.remove(p.mesh);
    }
    if (this.rainPuddles.some(p => p.life <= 0)) this.rainPuddles = this.rainPuddles.filter(p => p.life > 0);
  }

  // ------------------------------------------------------------ wat gasten van het park moeten weten
  feature(name: string): boolean {
    return name in FEATURE && this.has(name as keyof typeof FEATURE);
  }

  /** Bij een heel vol park krijgt elke gast wat minder snel trek: zo kunnen de kramen het aan. */
  ease(): number {
    const n = this.guests.guests.length;
    return n <= CROWD_EASE ? 1 : crowdLoad(n) / n;
  }

  /** Is het pad hier twee tegels breed (een blok van twee bij twee)? */
  wide(tile: number): boolean {
    const [x, y] = tileXY(tile);
    const path = (tx: number, ty: number): boolean => this.grid.inBounds(tx, ty) && isPath(this.grid.terrain[tileIndex(tx, ty)]);
    for (const dx of [-1, 1]) for (const dy of [-1, 1]) if (path(x + dx, y) && path(x, y + dy) && path(x + dx, y + dy)) return true;
    return false;
  }

  mapNear(gx: number, gy: number): boolean {
    return this.decors.some(d => d.kind === 'mapboard' && Math.abs(this.decorPos(d)[0] - gx) < 2.5 && Math.abs(this.decorPos(d)[1] - gy) < 2.5);
  }

  /** De borden die de weg wijzen (wegwijzers, plattegronden en de poort), elk met zijn bereik. Eén keer per tel opnieuw uitgezocht. */
  private signList: WaySign[] = [];
  private signsAt = -9;

  private signs(): WaySign[] {
    if (Math.abs(this.clock - this.signsAt) < 1) return this.signList;
    this.signsAt = this.clock;
    const [ex, ey] = tileXY(ENTRANCE);
    this.signList = [{ gx: ex + 0.5, gy: ey + 0.5, r: WAYFIND.entrance }];
    for (const d of this.decors) {
      const r = (WAYFIND as Record<string, number>)[d.kind];
      if (!r) continue;
      const [gx, gy] = this.decorPos(d);
      this.signList.push({ gx, gy, r });
    }
    return this.signList;
  }

  /** Weet een gast hier de weg? In een klein park altijd; in een groot park alleen binnen het bereik van een bord. */
  signed(tile: number): boolean {
    if (!canStray(this.level, this.guests.paths.size)) return true;
    const [x, y] = tileXY(tile);
    return wayfound(this.signs(), x + 0.5, y + 0.5);
  }

  /** Er staat een nieuw bord: wie binnen het bereik de weg kwijt was, weet het meteen weer en is er blij om. */
  private signPlaced(gx: number, gy: number, r: number): void {
    this.signsAt = -9;
    for (const g of this.guests.guests) {
      if (g.astray <= 0 || Math.hypot(g.gx - gx, g.gy - gy) > r) continue;
      g.findWay(true);
      g.joy = Math.max(g.joy, 0.8);
      this.floatAt(icon('heart'), g.gx, g.gy, g.height + 0.2);
    }
  }

  /** Een blije gast laat bij het weggaan een tekening van zijn lievelingsdier achter in het gastenboek. */
  signBook(guest: Guest): void {
    if (!guest.fav || !guest.favSeen || !this.decors.some(d => d.kind === 'guestbook')) return;
    this.book[guest.fav] = Math.min(999, (this.book[guest.fav] ?? 0) + 1);
  }

  /** Het gastenboek: de dieren waar de meeste tekeningen van zijn, bovenaan. */
  private openBook(): void {
    const entries = Object.entries(this.book).sort((p, q) => q[1] - p[1]).slice(0, 12).map(([sp, n]) => ({ icon: speciesIcon(sp), n }));
    this.hud.showBook(t('book.title'), entries, t('book.empty'), t('guide.ok'));
  }

  watched(guest: Guest): void {
    this.sellPhoto(guest, 0.25);
  }

  /** Staat de fotograaf in de buurt, dan koopt een tevreden gast soms een foto: een munt. */
  private sellPhoto(guest: Guest, chance: number): void {
    if (guest.fun < 0.4 || Math.random() > chance) return;
    const snapper = this.workers.find(w => w.role === 'photo' && w.paid && !w.away && Math.hypot(w.gx - guest.gx, w.gy - guest.gy) < 3.5);
    if (!snapper) return;
    snapper.snap();
    this.view.burst(snapper.gx, snapper.gy, 0.6, 0xffffff, 5);
    this.floatAt(icon('photo'), guest.gx, guest.gy, guest.height + 0.4);
    sfx('camera', { volume: 0.4, every: 1 });
    this.earn(1, guest.gx, guest.gy);
  }

  /** Vanaf de uitkijktoren zie je alle dieren in de buurt: hoe meer soorten, hoe leuker. */
  towerView(shop: ShopSpot): number {
    const [cx, cy] = shopCenter(shop);
    const seen = new Set(this.animals.filter(a => !a.escaped && Math.hypot(a.gx - cx, a.gy - cy) < 9).map(a => a.species));
    return Math.min(0.3, seen.size * 0.05);
  }

  trainRuns(): boolean {
    return !!this.guests.train?.running;
  }

  binned(bin: ShopSpot): void {
    this.view.flapLid((bin as ShopObj).mesh);
    // het propje ritselt en ploft in de bak
    sfx('park.bin', { volume: 0.25, every: 4, at: shopCenter(bin) });
  }

  // ------------------------------------------------------------ dingen in het park waar gasten iets mee doen
  private sightList: Sight[] = [];
  private sightOf = new Map<object, Sight>();
  private sightsAt = -9;

  /**
   * De versieringen, bloembakken en afvalbakken waar gasten naartoe lopen (zie SIGHT bij de gasten), elk met de
   * tegels ernaast. Om de anderhalve tel opnieuw uitgezocht; een ding houdt hetzelfde object zolang het er staat.
   */
  sights(): Sight[] {
    if (Math.abs(this.clock - this.sightsAt) < 1.5) return this.sightList;
    this.sightsAt = this.clock;
    for (const s of this.sightList) s.gone = true;
    const list: Sight[] = [];
    const add = (ref: object, kind: string, x: number, y: number, tiles: number[], rot: number): void => {
      let s = this.sightOf.get(ref);
      if (!s) this.sightOf.set(ref, (s = { ref, kind, x, y, tiles, rot, n: 0, used: 0, gone: false }));
      s.x = x;
      s.y = y;
      s.tiles = tiles;
      s.rot = rot;
      s.gone = false;
      list.push(s);
    };
    for (const d of this.decors) {
      if (!SIGHT[d.kind]) continue;
      const [x, y] = this.decorPos(d);
      add(d, d.kind, x, y, d.edge ? edgeSides(d) : this.grid.neighbors(tileIndex(d.x, d.y)), d.rot ?? 0);
    }
    for (const sh of this.shops) {
      if (!sh.edge || (sh.kind !== 'flowers' && sh.kind !== 'bin')) continue;
      const [x, y] = edgePose(sh);
      add(sh, sh.kind, x, y, edgeSides(sh), 0);
    }
    // wat weg is, blijft `gone`: een gast die ernaartoe liep, loopt dan gewoon door
    for (const s of this.sightList) if (s.gone) this.sightOf.delete(s.ref);
    this.sightList = list;
    return list;
  }

  /** Een gast doet iets met een ding in het park: het beweegt even mee, net als wanneer de speler erop tikt (zonder het tikje, wel met het geluid van het ding zelf). */
  sightUsed(sight: Sight): void {
    if (sight.kind === 'bin') {
      if (this.shops.includes(sight.ref as ShopObj)) this.binned(sight.ref as ShopObj);
      return;
    }
    const decor = sight.ref as DecorObj, kind = decor.kind;
    if (!this.decors.includes(decor)) return;
    const moves = kind === 'pond' || kind === 'well' || kind === 'pump' || kind === 'birdbath' || kind === 'campfire' || kind === 'snowman' || kind === 'scarecrow' || kind === 'windmill' || kind === 'guestbook';
    if (!moves) return;
    this.view.pokeDecor(decor.mesh, kind, this.clock);
    if (kind === 'pond' || kind === 'pump') this.view.splash(sight.x, sight.y);
    else if (kind === 'birdbath') this.view.burst(sight.x, sight.y, 0.7, 0xcfeaff, 3);
    // de pomp piept en geeft water, de kikker plonst in de vijver, het vuur knettert even op
    if (kind === 'pump') sfx('park.pump', { volume: 0.3, every: 2.2, at: [sight.x, sight.y] });
    else if (kind === 'pond') sfx('park.splash', { volume: 0.22, every: 3, at: [sight.x, sight.y] });
    else if (kind === 'campfire') sfx('park.fire', { volume: 0.3, every: 5, at: [sight.x, sight.y] });
    // een nieuwe tekening in het gastenboek
    if (kind === 'guestbook') this.floatAt(icon('heart'), sight.x, sight.y, 1.1);
  }

  /** Een plons in de vijver of de fontein. Met een muntje erbij glinstert het even, en heel af en toe verdient het park er een munt aan. */
  plons(gx: number, gy: number, height: number, coin: boolean): void {
    if (height > 0) this.view.burst(gx, gy, height, 0xcfeaff, 4);
    else this.view.splash(gx, gy);
    // een muntje maakt een klein plopje, een hand of een stukje brood een plons
    sfx(coin ? 'park.coinplop' : 'park.splash', { volume: coin ? 0.3 : 0.22, every: coin ? 2 : 3, at: [gx, gy] });
    if (!coin) return;
    this.view.burst(gx, gy, height, 0xffd23f, 1);
    if (Math.random() < 0.2) this.earn(1, gx, gy);
  }

  /** In de avond, de nacht en de winter is het fris: dan is het kampvuur extra fijn. */
  chilly(): boolean {
    return this.night > 0.4 || this.season === 'winter';
  }

  // ------------------------------------------------------------ de kinderboerderij
  pettingPen(regionId: number): boolean {
    return this.petRegions.has(regionId);
  }

  pettingSpots(): PetSpot[] {
    return this.petSpots;
  }

  /**
   * Welke verblijven zijn een kinderboerderij (wit hekje rondom), en waar kunnen gasten naar binnen? Dat kan als
   * er alleen boerderijdieren wonen, het verblijf groot genoeg is en er een poortje aan het pad zit.
   */
  private syncPets(): void {
    const regions = new Set<number>();
    const spots: PetSpot[] = [];
    let small = false, gateless = false;
    for (const pen of this.pens) {
      if (this.grid.penKind(pen.region) !== 7) continue;
      regions.add(pen.region.id);
      const here = this.animalsIn(pen.region.id);
      if (!here.length || here.some(a => !PETTABLE.includes(a.species))) continue;
      if (pen.region.tiles.length < PETTING_MIN) {
        small = true;
        continue;
      }
      const inside = new Set(pen.region.tiles);
      const free = pen.region.tiles.filter(i => !this.taken(...tileXY(i)));
      let gates = 0;
      for (const e of this.grid.borderEdges(pen.region)) {
        if (this.grid.getEdge(e) !== 8) continue;
        gates++;
        const sides: [number, number][] = e.o === 'h' ? [[e.x, e.y - 1], [e.x, e.y]] : [[e.x - 1, e.y], [e.x, e.y]];
        const [a, b] = sides.map(([x, y]) => (this.grid.inBounds(x, y) ? tileIndex(x, y) : -1));
        const inn = inside.has(a) ? a : b, out = inn === a ? b : a;
        if (out < 0 || !isPath(this.grid.terrain[out]) || !free.length) continue;
        const old = this.petSpots.find(sp => sp.inn === inn && sp.out === out);
        if (old) {
          old.region = pen.region.id;
          old.tiles = free;
          spots.push(old);
        } else spots.push({ out, inn, region: pen.region.id, tiles: free, count: 0 });
      }
      if (!gates) gateless = true;
    }
    this.petRegions = regions;
    // een kinderboerderij die er al stond toen je het spel opende, is niet nieuw: dan zegt niemand dat hij open is
    if (spots.length && !this.petSpots.length && this.guests.open && !(this.resumed && this.clock < 8)) this.mention(say.pettingOpen(), 600);
    this.petSpots = spots;
    if (small) this.alert(say.pettingSmall(), 400);
    else if (gateless) this.alert(say.pettingGate(), 400);
  }

  /** Een gast staat in de kinderboerderij: het dichtstbijzijnde dier komt naar hem toe en laat zich aaien en voeren. */
  petAt(spot: PetSpot, guest: Guest): [number, number] | null {
    const here = this.animalsIn(spot.region).filter(a => !a.sick && !a.sleeping).sort((p, q) => Math.hypot(p.gx - guest.gx, p.gy - guest.gy) - Math.hypot(q.gx - guest.gx, q.gy - guest.gy));
    const a = here.find(x => x.comeTo(this, guest.gx, guest.gy)) ?? here[0];
    if (!a) return null;
    this.floatAt(icon('petting'), guest.gx, guest.gy, guest.height + 0.3);
    setTimeout(() => {
      if (this.animals.includes(a)) this.floatAt(icon('heart'), a.gx, a.gy, a.top + 0.2);
    }, 2200);
    // de gast koopt een zakje voer: het dier heeft minder honger en er komt een munt in de kas
    a.hunger = Math.max(0, a.hunger - 0.12);
    if (Math.random() < 0.4) this.earn(1, guest.gx, guest.gy);
    return [a.gx, a.gy];
  }

  /** De uitleg van de kinderboerderij in vier stappen. */
  private showPettingGuide(): void {
    this.told.add('petting');
    this.hud.showGuide(t('guide.petting.title'), [
      { icon: icon('picket'), text: t('guide.petting.1') },
      { icon: icon('petgate'), text: t('guide.petting.2') },
      { icon: speciesIcon('goat') + speciesIcon('rabbit'), text: t('guide.petting.3') },
      { icon: icon('petting'), text: t('guide.petting.4') },
    ], t('guide.ok'));
  }

  // ------------------------------------------------------------ bijzondere gasten
  /**
   * Af en toe gebeurt er iets in het park: een schoolklas, een verjaardag, een beroemde gast, een verdwaald kind,
   * een vrachtwagen met voer, een fotograaf van de krant, of iemand van het park zelf die hulp vraagt (zie EVENTS).
   * Bij de meeste hoort een kaartje: tik je erop, dan help je met een puzzeltje (een som, een woord, iets op
   * volgorde, of de klas de weg wijzen). Gaat het goed, dan is er een beloning; gaat het mis of klik je het weg,
   * dan gebeurt er verder niets ergs.
   */
  private specialGuests(dt: number, crowd: number): void {
    // een kaartje blijft niet eeuwig liggen, en de klas wacht niet eeuwig tot je de weg wijst
    if (this.offer && this.clock > this.offer.until) this.closeOffer();
    if (this.guideAsk && (this.clock > this.guideAsk.until || !this.guests.guests.includes(this.guideAsk.teacher))) {
      this.guideAsk = null;
      this.hud.hideOffer();
    }
    // na tien uur 's avonds komt er geen klas meer binnen en gebeurt er niets nieuws: iedereen gaat naar huis
    if (this.goingHome()) {
      this.classDue = null;
      return;
    }
    // de bus staat voor de poort (of blijft te lang weg): de klas stapt uit, en de juf of meester vraagt om hulp
    if (this.classDue && (this.road.busStopped() || this.clock > this.classDue.until)) {
      const due = this.classDue, [ex, ey] = tileXY(ENTRANCE);
      this.classDue = null;
      const group = this.guests.spawnClass(due.n, TEACHER_SHIRT[due.teacher], this.road.busStopped());
      if (group) {
        this.classTeacher.set(group, due.teacher);
        // een hele klas betaalt samen entree
        this.earn(3 + this.classFans, ex + 0.5, ey + 0.5);
        this.offerEvent('schoolclass', group);
      }
      return;
    }
    if (!this.guests.open || crowd < 4 || this.celebrating || this.offer || this.guideAsk || this.classDue) return;
    this.eventIn -= dt;
    if (this.eventIn > 0) return;
    this.eventIn = 150 + Math.random() * 130;
    const busyPens = this.pens.filter(p => this.animalsIn(p.region.id).length).length;
    // de verzorger telt de dieren alleen als het donker wordt
    const kinds = EVENT_KINDS.filter(k =>
      this.has(k === 'lost' ? k : EVENTS[k].from) && k !== this.lastEvent
      && (k !== 'party' || this.shops.some(sh => PLAY.includes(sh.kind))) && (k !== 'schoolclass' || busyPens >= 2)
      && (k !== 'bedtime' || this.night > 0.3));
    // een klas die het leuk had, vertelt het door op school: dan komt er vaker een klas
    if (kinds.includes('schoolclass')) for (let i = 0; i < this.classFans; i++) kinds.push('schoolclass');
    const kind = kinds[Math.floor(Math.random() * kinds.length)];
    if (!kind) return;
    this.lastEvent = kind;
    if (kind === 'lost') {
      const pair = this.guests.spawnLost();
      if (!pair) return;
      this.mention(this.lineAbout(say.lost(), pair.child), 60);
      this.marked = null;
      this.view.flyTo(pair.child.gx, pair.child.gy);
      return;
    }
    // hoe liever de klassen komen, hoe groter de klas; er komt een juf of een meester mee
    const teacher = TEACHERS[Math.floor(Math.random() * TEACHERS.length)];
    if (kind === 'schoolclass') {
      // de schoolbus komt eraan: de klas stapt pas uit als hij voor de poort stilstaat (zie hierboven)
      this.road.callBus();
      this.classDue = { n: 5 + this.classFans + Math.floor(Math.random() * 3), teacher, until: this.clock + 45 };
      return;
    }
    const group = kind === 'party' ? this.guests.spawnParty() : kind === 'celeb' ? this.guests.spawnStar() : null;
    // een feestje of een beroemde gast komt niet als het park dicht is
    if (!group && (kind === 'party' || kind === 'celeb')) return;
    // de vrachtwagen met voer staat een poosje voor de poort
    if (kind === 'delivery') this.road.callTruck();
    this.offerEvent(kind, group);
  }

  /** Een zin bij een evenement: nooit dezelfde variant als de vorige keer. `teacher`: wie er praat bij een klas. */
  private eventLine(id: string, part: EventPart, teacher?: TeacherId): Line {
    const n = EVENT_SAYS[id][part], key = `${id}.${part}`;
    let i = Math.floor(Math.random() * n);
    // dezelfde als de vorige keer? Dan een van de andere
    if (n > 1 && i === this.lastSaid.get(key)) i = (i + 1 + Math.floor(Math.random() * (n - 1))) % n;
    this.lastSaid.set(key, i);
    return say.event(id, part, i, teacher);
  }

  /** Wat deze klas vraagt: iets anders dan de vorige klas. De weg wijzen kan alleen als er een dier te kiezen is. */
  private classTask(): { task: ClassTask; species: SpeciesId | null } {
    const species = this.guideSpecies();
    // de allereerste klassen vragen iets eenvoudigs: een som, of de weg
    const tasks: ClassTask[] = this.level > FEATURE.schoolclass ? ['sum', 'count', 'draw', 'line'] : ['sum'];
    // de weg wijzen telt dubbel: dat spel is in het park zelf en mag vaak komen
    if (species) tasks.push('guide', 'guide');
    const fresh = tasks.filter(k => k !== this.lastTask);
    const list = fresh.length ? fresh : tasks;
    const task = list[Math.floor(Math.random() * list.length)];
    this.lastTask = task;
    return { task, species: task === 'guide' ? species : null };
  }

  /**
   * Het kaartje komt in beeld, met het geluid van het evenement, en wie erbij hoort vraagt om hulp (bij een klas de
   * juf of de meester). Tik op het kaartje om te helpen, of klik het weg.
   */
  private offerEvent(kind: CardEvent, who: Guest | null): void {
    const def = EVENTS[kind];
    // een klas komt elke keer met iets anders
    const { task, species } = kind === 'schoolclass' ? this.classTask() : { task: null, species: null };
    const plan = task && task !== 'guide' ? CLASS_TASKS[task] : null;
    const mini = plan?.mini ?? def.mini;
    const picture = icon(def.icon);
    const line = this.eventLine(task ? `class.${task}` : kind, 'ask', who ? this.classTeacher.get(who) : undefined);
    // gaat het over gasten in het park, dan brengt een tik op de vraag je naar ze toe
    const ask = who ? this.lineAbout(line, who) : line;
    sfx(def.sound, { volume: 0.5 });
    this.lines.push(ask);
    if (!this.told.has('event')) {
      this.told.add('event');
      this.lines.push(say.eventNew());
    }
    this.offer = { kind, who, until: this.clock + 50, ask };
    this.hud.showOffer(picture, t(plan?.label ?? `event.${kind}`), () => {
      this.closeOffer();
      if (species && who) return this.startGuide(species, who);
      this.hud.hush();
      // wie om hulp vroeg, leest ook de uitleg van het puzzeltje voor
      playMini({ ...mini, picture, say: text => void playVoice(voiceId(line.who, text)), onDone: r => this.endEvent(kind, who, r.skipped ? 'skip' : r.won ? 'won' : 'lost') });
    }, () => this.closeOffer());
  }

  /** Het kaartje is aangetikt, weggeklikt of te lang blijven liggen. Wegklikken: het evenement gaat gewoon door, zonder beloning. */
  private closeOffer(): void {
    // stond de vraag nog in de rij, dan hoeft hij niet meer te klinken
    const ask = this.offer?.ask;
    this.lines = this.lines.filter(l => l !== ask);
    this.offer = null;
    this.hud.hideOffer();
  }

  /** Een padtegel waar je deze diersoort kunt zien. */
  private guideSpot(sp: SpeciesId): number | null {
    return this.tourSpots().find(tile => this.viewScore(tile)?.species.includes(sp)) ?? null;
  }

  /** Een dier waar de klas naar kan vragen: het moet vanaf het pad te zien zijn, en er moet iets te kiezen zijn. */
  private guideSpecies(): SpeciesId | null {
    const seen = [...new Set(this.animals.filter(a => !a.escaped).map(a => a.species))].filter(sp => this.guideSpot(sp) !== null);
    return seen.length >= 2 ? seen[Math.floor(Math.random() * seen.length)] : null;
  }

  /** De klas zoekt een dier: het plaatje van het dier blijft in beeld tot je op het goede verblijf tikt. */
  private startGuide(species: SpeciesId, teacher: Guest): void {
    this.guideAsk = { species, teacher, until: this.clock + 45 };
    this.hud.showOffer(speciesIcon(species), t('event.guide'), null, () => {
      this.guideAsk = null;
      this.hud.hideOffer();
    });
    this.sayNow(this.lineAbout(this.eventLine('class.go', 'ask', this.classTeacher.get(teacher)), teacher));
  }

  /** Een tik terwijl de klas een dier zoekt. Geeft terug of de tik daarmee af is (op een verblijf met dieren). */
  private guideTap(gx: number, gy: number): boolean {
    const ask = this.guideAsk;
    const region = this.grid.enclosureAt(Math.floor(gx), Math.floor(gy));
    const here = region ? this.animalsIn(region.id) : [];
    if (!ask || !here.length) return false;
    // het verkeerde verblijf: gewoon nog een keer proberen
    if (!here.some(a => a.species === ask.species)) {
      this.nope(gx, gy);
      return true;
    }
    this.guideAsk = null;
    this.hud.hideOffer();
    const tile = this.guideSpot(ask.species);
    if (tile !== null) ask.teacher.sendTo = tile;
    this.endEvent('schoolclass', ask.teacher, 'won', true);
    return true;
  }

  /**
   * Het puzzeltje is af. Goed gedaan: de gasten juichen, er is confetti en een beloning die bij het evenement past
   * (munten, een blije klas die vaker terugkomt, of een tijdje meer gasten). Niet gelukt: een sip geluidje en geen
   * beloning. Weggeklikt: er gebeurt niets.
   */
  private endEvent(kind: CardEvent, who: Guest | null, how: 'won' | 'lost' | 'skip', guided = false): void {
    if (how === 'skip') return;
    const def = EVENTS[kind];
    const here = who && this.guests.guests.includes(who) ? who : null;
    const [ex, ey] = tileXY(ENTRANCE);
    const gx = here ? here.gx : ex + 0.5, gy = here ? here.gy : ey + 0.5;
    const won = how === 'won';
    // bij een klas zegt de juf of de meester van die klas hoe het ging
    const says = kind === 'schoolclass' ? (guided ? 'class.guide' : 'class') : kind;
    const line = this.eventLine(says, won ? 'good' : 'bad', who ? this.classTeacher.get(who) : undefined);
    this.sayNow(here ? this.lineAbout(line, here) : line);
    if (!won) {
      sfx('sad', { volume: 0.4 });
      if (kind === 'schoolclass') this.classFans = Math.max(0, this.classFans - 1);
      if (kind === 'celeb' && here) here.fun = Math.max(0, here.fun - 0.2);
      return;
    }
    sfx('cheer', { volume: 0.4 });
    this.guests.cheerNear(gx, gy, 3.5);
    for (let k = 0; k < 5; k++) setTimeout(() => this.view.burst(gx + (Math.random() - 0.5) * 1.6, gy + (Math.random() - 0.5) * 1.6, 1.2, [0xe0584f, 0xffd23f, 0x4a90e2, 0x6cc04a, 0xf06aa6][k], 6), k * 250);
    if (kind === 'schoolclass') {
      this.classFans = Math.min(3, this.classFans + 1);
      // de kinderen zijn blij: een hartje boven elk kind
      for (const kid of this.guests.guests)
        if (kid.leader === here) {
          kid.fun = Math.min(1, kid.fun + 0.3);
          this.floatAt(icon('heart'), kid.gx, kid.gy, kid.height + 0.3);
        }
    }
    // de beroemde gast gaat straks blij naar huis: dan komen er meer gasten
    if (kind === 'celeb' && here) here.fun = 1;
    if (kind === 'photo') sfx('camera');
    // de beloning: munten, of een tijdje meer gasten (een foto in de krant, een trotse burgemeester)
    if (def.coins) this.earn(def.coins, gx, gy);
    if (def.boost) this.boostUntil = Math.max(this.boostUntil, this.clock + def.boost);
  }

  /** De schoolklas gaat naar huis: de juf of meester zegt hoe het was. Was het leuk, dan komt er vaker een klas. */
  classLeft(teacher: Guest, happy: boolean): void {
    this.mention(this.eventLine('class.bye', happy ? 'good' : 'bad', this.classTeacher.get(teacher)), 60);
    if (happy && this.classFans < 2) this.classFans++;
  }

  /** Het verjaardagsgroepje is er: slingers en taart bij het speeltoestel, en iedereen in de buurt juicht mee. */
  partyAt(shop: ShopSpot, guest: Guest): void {
    const obj = shop as ShopObj;
    const [cx, cy] = shopCenter(shop);
    obj.partyUntil = this.clock + 22;
    this.view.setShopParty(obj.mesh, true);
    this.guests.cheerNear(cx, cy, 3.5);
    this.floatAt(icon('cake'), cx, cy, 1.8);
    for (let k = 0; k < 6; k++) setTimeout(() => this.view.burst(cx + (Math.random() - 0.5) * 1.6, cy + (Math.random() - 0.5) * 1.6, 1.2, [0xe0584f, 0xffd23f, 0x4a90e2, 0x6cc04a, 0xf06aa6][k % 5], 6), k * 350);
    sfx('party', { volume: 0.5 });
    this.earn(3, guest.gx, guest.gy);
  }

  /** Het verdwaalde kind is terug bij papa of mama. Heeft de speler geholpen, dan is er een beloning. */
  reunited(child: Guest, parent: Guest, helped: boolean): void {
    this.floatAt(icon('heart'), (child.gx + parent.gx) / 2, (child.gy + parent.gy) / 2, parent.height + 0.3);
    this.guests.cheerNear(parent.gx, parent.gy, 2.5);
    if (!helped) return;
    sfx('chime');
    this.earn(3, parent.gx, parent.gy);
    this.sayNow(say.found());
  }

  /** De beroemde gast gaat naar huis. Had hij het naar zijn zin, dan komen er een paar minuten meer gasten. */
  starLeft(_guest: Guest, happy: boolean): void {
    if (!happy) return;
    this.boostUntil = this.clock + 180;
    this.mention(say.celebHappy(), 60);
  }

  // ------------------------------------------------------------ meer personeel
  /** Zieke dieren, voor de dierenarts: steeds hetzelfde briefje per dier, zodat er maar één dokter op afgaat. */
  vetJobs(): VetJob[] {
    return this.animals.filter(a => a.sick && !a.escaped).map(a => ({ animal: a, gx: a.gx, gy: a.gy }));
  }

  workerHeal(job: VetJob): void {
    const a = job.animal as Animal;
    if (this.animals.includes(a) && a.sick) this.heal(a);
  }

  pathTiles(): Set<number> {
    return this.guests.paths;
  }

  /** Padtegels waar iets te zien is. Het lijstje wordt om de paar tellen opnieuw gemaakt. */
  tourSpots(): number[] {
    if (this.clock - this.spotsAt > 3) {
      this.spotsAt = this.clock;
      this.spots = [...this.guests.paths].filter(tile => !!this.viewScore(tile));
    }
    return this.spots;
  }

  viewOf(tile: number): [number, number] | null {
    const view = this.viewScore(tile);
    return view ? [view.x, view.y] : null;
  }

  tourGuests(gx: number, gy: number, n: number): Guest[] {
    return this.guests.guests.filter(g => g.free && Math.hypot(g.gx - gx, g.gy - gy) < 4).slice(0, n);
  }

  /** De gids vertelt bij de dieren: het groepje vindt het extra leuk, en soms hoor je een weetje. */
  tourStop(group: Guest[], tile: number): void {
    const view = this.viewScore(tile);
    if (!view) return;
    for (const g of group) {
      g.fun = Math.min(1, g.fun + view.score * 1.5);
      if (g.fav && view.species.includes(g.fav)) g.favSeen = true;
    }
    const [first] = group;
    if (first) this.floatAt(icon('heart'), first.gx, first.gy, first.height + 0.3);
    const sp = view.species[Math.floor(Math.random() * view.species.length)] as SpeciesId | undefined;
    if (sp && !this.hud.speaking && !this.lines.length && Math.random() < 0.5) this.sayNow(say.fact(sp));
  }

  // ------------------------------------------------------------ dokter, weetjes, vieze kramen en dingen aantikken
  /** De dokter: eerst de thermometer, dan een pleister, dan een drankje. Daarna is het dier beter. */
  private vetGame(a: Animal): void {
    if (!this.told.has('vet')) {
      this.told.add('vet');
      this.sayNow(say.vetHow());
    }
    animalSound(a.species, a.young, 0.6, [a.gx, a.gy]);
    const step = (id: string): { id: string; icon: string; label: string } => ({ id, icon: icon(id as IconId), label: t(`vet.${id}`) });
    this.hud.showVet(t('vet.title'), speciesIcon(a.species), [step('thermo'), step('plaster'), step('syrup')], () => {
      if (this.animals.includes(a) && a.sick) this.heal(a);
    });
  }

  /** Het weetje van een diersoort: vanzelf bij het eerste dier van die soort, of als je erom vraagt. */
  private tellFact(species: SpeciesId, asked: boolean): void {
    if (!asked && this.facts.has(species)) return;
    this.facts.add(species);
    const line = say.fact(species);
    const text = textOf(t, line);
    this.hud.hush();
    this.hud.showFact(speciesIcon(species), t(`species.${species}`), text, t('guide.ok'));
    playVoice(voiceId(line.who, text));
  }

  /** Een vieze kraam schoonvegen. `mine`: de speler deed het zelf (dan is er een munt). */
  private cleanShop(shop: ShopObj, mine: boolean): void {
    if ((shop.dirt ?? 0) < 1) return;
    shop.dirt = 0;
    const [cx, cy] = blockCenter(shop);
    sfx('sweep', { every: 0.1 });
    for (let k = 0; k < 4; k++) this.floatAt(icon('sparkle'), cx - 0.6 + Math.random() * 1.2, cy - 0.6 + Math.random() * 1.2, 0.3 + Math.random());
    this.pulse(shop.mesh, 0.06);
    if (mine) this.earn(1, cx, cy);
  }

  /** De palen met vlaggetjes en lichtjes: het beeld hangt er slingers tussen. */
  private syncStrings(): void {
    // het beeld rekent met het midden van een tegel; een paal op een rand staat een halve tegel verder
    const poles = this.decors.filter(d => d.kind === 'bunting' || d.kind === 'lightstring').map(d => ({ x: this.decorPos(d)[0] - 0.5, y: this.decorPos(d)[1] - 0.5, kind: d.kind as 'bunting' | 'lightstring' }));
    this.view.syncStrings(poles);
  }

  /** Een tik op iets in het park: het beweegt en er springt iets uit. Het gastenboek gaat open. */
  private pokeDecor(decor: DecorObj): void {
    if (decor.kind === 'guestbook') return this.openBook();
    const [cx, cy] = this.decorPos(decor);
    this.view.pokeDecor(decor.mesh, decor.kind, this.clock);
    sfx('tap');
    const water = decor.kind === 'pond' || decor.kind === 'well' || decor.kind === 'birdbath' || decor.kind === 'waterfall' || decor.kind === 'pump';
    const fire = decor.kind in LIGHT;
    const flower = decor.kind === 'roses' || decor.kind === 'tulips' || decor.kind === 'sunflowers' || decor.kind === 'cherry';
    if (water) this.view.splash(cx, cy);
    else this.view.burst(cx, cy, DECOR[decor.kind].group === 'green' ? 0.9 : 0.6, fire ? 0xffc21f : flower ? 0xf48fb1 : DECOR[decor.kind].group === 'green' ? 0x5fa544 : 0xfff1a8, 6);
  }

  // ------------------------------------------------------------ het hulphandje
  private hideHand(): void {
    this.handOn = null;
    this.hud.hidePointer();
  }

  /**
   * Doet de speler een poos niets terwijl er nog een doel openstaat, dan wijst een handje aan waar je kunt
   * tikken: een lege voerbak, een poepje, een ziek of ontsnapt dier, of anders de knop die bij het doel hoort.
   * Rustig aan: pas na HAND_AFTER tellen, hooguit HAND_SECONDS lang, en daarna een hele poos niet.
   */
  private updateHand(): void {
    if (this.hud.pointing) {
      if (this.clock - this.handAt > HAND_SECONDS || this.celebrating || this.hud.menuOpen) return this.hideHand();
      // het handje volgt de plek in het park als het beeld schuift
      if (this.handOn) {
        const s = this.view.toScreen(this.handOn.gx, this.handOn.gy, this.handOn.h);
        this.hud.pointAt(s.x, s.y);
      }
      return;
    }
    if (this.celebrating || this.hud.menuOpen || this.hud.speaking || this.moving || this.clock - this.lastInput < HAND_AFTER || this.clock - this.handAt < HAND_GAP) return;
    // nog nooit op een dier getikt? Dan wijst het handje een dier aan dat iets mist, en de verzorger legt het uit
    if (!this.told.has('tapAnimal') && this.tool === 'hand') {
      const sad = this.animals.find(x => !x.happy && !x.escaped && !x.sick && x.unmet && this.grid.enclosureAt(...tileXY(x.tile)));
      if (sad) {
        this.handAt = this.clock;
        this.handOn = { gx: sad.gx, gy: sad.gy, h: sad.top * 0.5 };
        const s = this.view.toScreen(sad.gx, sad.gy, sad.top * 0.5);
        this.hud.pointAt(s.x, s.y);
        if (!this.said.has('say.tap.animal')) this.sayNow(this.lineAbout(say.tapAnimal(), sad));
        return;
      }
    }
    const goal = this.levelDef()?.goals[this.firstOpenGoal()];
    if (!goal) return;
    let at: { gx: number; gy: number; h: number } | null = null;
    if (goal.type === 'fed') {
      const tr = this.troughs.find(k => k.amount <= 0 && this.animalsIn(this.grid.regionOf[tileIndex(k.x, k.y)]).length);
      if (tr) at = { gx: tr.x + 0.5, gy: tr.y + 0.5, h: 0.3 };
    } else if (goal.type === 'healed') {
      const a = this.animals.find(x => x.sick);
      if (a) at = { gx: a.gx, gy: a.gy, h: a.top * 0.5 };
    } else if (goal.type === 'caught') {
      const a = this.animals.find(x => x.escaped);
      if (a) at = { gx: a.gx, gy: a.gy, h: a.top * 0.5 };
    } else if (goal.type === 'cleaned' && this.tool === 'action') {
      const p = this.poops[0];
      if (p) at = { gx: p.gx, gy: p.gy, h: 0.1 };
    }
    const tool = at ? null : this.hintTool();
    if (!at && (!tool || tool === this.tool || tool === 'hand')) return;
    this.handAt = this.clock;
    this.handOn = at;
    if (at) {
      const s = this.view.toScreen(at.gx, at.gy, at.h);
      this.hud.pointAt(s.x, s.y);
    } else this.hud.pointAtTool(tool!);
  }

  // ------------------------------------------------------------ elk beeldje
  private evaluate(): void {
    this.syncTanks();
    this.syncPets();
    const stats = emptyStats();
    const crowd = this.guests.stats();
    stats.enclosures = this.grid.enclosures().length;
    stats.troughs = this.troughs.filter(tr => this.grid.enclosureAt(tr.x, tr.y)).length;
    stats.beds = this.beds.filter(b => this.grid.enclosureAt(b.x, b.y)).length;
    stats.paths = this.grid.terrain.reduce((n, v) => n + (isPath(v) ? 1 : 0), 0);
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
      const atPath = s.edge ? edgeSides(s).some(i => isPath(this.grid.terrain[i])) : this.touchesPath(s.x, s.y, ...shopTiles(s));
      // werkt het ook echt? Alleen als gasten erbij kunnen: het pad ernaast moet aan de ingang vastzitten
      const around = s.edge ? edgeSides(s) : this.around(s.x, s.y, ...shopTiles(s));
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
      const calm = a.unmet === 'fun' || a.unmet === 'climate' || a.unmet === 'wild' || a.unmet === 'space' || (a.unmet === 'terrain' && a.mixOnly) || (a.unmet === 'enclosure' && a.fenceBroken && !a.escaped);
      const rate = a.unmet === null ? -2 : calm ? 0 : care ? 1 : 0.4;
      a.neglect = Math.max(0, a.neglect + rate * 0.4);
      if (a.neglect > NEGLECT_GONE) taken.push(a);
      const bubble = this.bubbles.get(a)!;
      bubble.hidden = a.happy;
      bubble.classList.toggle('warn', a.neglect > NEGLECT_WARN);
      bubble.classList.toggle('danger', a.neglect > NEGLECT_WARN * 1.8);
      // het wolkje laat altijd zien wat er nu nog mist: ook als de wens dezelfde blijft maar het plaatje verandert
      // (eerst zand, dan droog gras; eerst een boom, dan twee stenen)
      const shown = a.escaped ? icon('catch') : a.unmet ? this.wishIcon(a, a.unmet) : '';
      if (shown && this.bubbleShows.get(a) !== shown) {
        this.bubbleShows.set(a, shown);
        bubble.innerHTML = shown;
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
    const needs = this.needy.slice(0, NEEDS_SHOWN).map(a => ({
      icon: speciesIcon(a.species),
      badge: a.escaped ? icon('catch') : a.unmet ? this.wishIcon(a, a.unmet) : icon('sick'),
    }));
    // onderaan het lijstje: er zijn gasten de weg kwijt (tik: het beeld gaat naar zo'n gast)
    if (crowd.lacking.astray) needs.push({ icon: icon('signpost'), badge: icon('question') });
    this.hud.setNeeds(needs);
    stats.kinds = Object.values(stats.happy).filter(n => n >= 2).length;
    this.stats = stats;
    if (taken.length) {
      const first = taken[0];
      const region = this.grid.regionOf[first.tile];
      this.takeAway(first);
      for (const a of this.animalsIn(region)) a.neglect = Math.min(a.neglect, NEGLECT_WARN);
    }
    this.checkBirths();
    // naast het uur: een plaatje van het seizoen, of een wolkje als het regent
    const skyIcon = this.rainLeft > 0 ? icon(this.season === 'winter' ? 'winter' : 'rain') : this.has('season') ? icon(this.season) : '';
    this.hud.setWallet(this.coins, COIN_CAP, this.has('paths') ? crowd.total : null, this.has('night') || this.has('keeper') ? this.clockText() : null, this.has('night') ? (this.night > 0.5 ? 'moon' : 'sun') : null, skyIcon);

    // een dier wacht al een poos op iets: de verzorger of de bouwer zegt wat er aan de hand is
    const light = worst && (worst.wish === 'bed' || worst.wish === 'terrain' || worst.wish === 'friend' || worst.wish === 'fun' || worst.wish === 'climate' || worst.wish === 'wild' || worst.wish === 'space' || (worst.wish === 'enclosure' && !!worst.a.needsFence));
    if (worst && worst.age > (light ? ALERT_AFTER * 2 : ALERT_AFTER)) {
      const { a, wish } = worst;
      this.alert(this.lineAbout(a.escaped ? say.escaped(t, a.species, a.fledFence) : wish === 'enclosure' && a.fenceBroken ? say.broken() : wishLine(t, wish, a.species, a.needsFence, a.neglect > NEGLECT_WARN, a.wildAsk ? `${a.wildAsk.group}.${a.wildAsk.more ? 'more' : 'less'}` : undefined), a));
      if (a.neglect > NEGLECT_WARN * 1.5 && !this.hud.speaking) this.callForHelp('name.help.1');
    }
    // de gastvrouw let op de gasten
    const lack: Record<string, number> = {};
    const full: Record<string, number> = {};
    let picky = 0;
    // de melding wijst een gast aan die dit mist
    // staat er wel zo'n winkel in het park, maar vinden de gasten hem niet? Dan helpt een wegwijzer of een plattegrond
    const hidden = (kind: 'toilet' | 'food' | 'drink'): 'astray' | 'toilet' | 'food' | 'drink' => (this.shops.some(sh => sh.kind === NEED_KIND[kind] && !sh.off) ? 'astray' : kind);
    const lacks = (kind: string, line: Line): Line => {
      const guest = this.guests.guests.find(q => q.wish?.lacking && !q.wish.busy && q.wish.kind === kind);
      return guest ? this.lineAbout(line, guest) : line;
    };
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
    if (crowd.total && !this.told.has('guests')) {
      // "Daar zijn de eerste gasten!" hoor je één keer per park, niet elke keer dat je het spel opent
      this.alert(say.host('first', 'happy'), 1e9);
      if (this.said.has('host.first')) this.told.add('guests');
    } else if (lack.toilet) this.alert(lacks('toilet', say.host(hidden('toilet'))));
    else if (lack.food) this.alert(lacks('food', say.host(hidden('food'))));
    else if (lack.drink) this.alert(lacks('drink', say.host(hidden('drink'))));
    else if (Object.values(full).some(n => n >= 2)) {
      // het is ergens te druk: de gastvrouw zegt waar er een bij moet
      const need = Object.keys(full).sort((p, q) => full[q] - full[p])[0];
      this.alert(say.busy(NEED_KIND[need]), 240);
    } else if (this.isNight() && this.guests.guests.filter(q => q.wish?.kind === 'dark').length >= 2) this.alert(say.host('dark'), 240);
    else if ((lack.astray ?? 0) >= 2) this.alert(lacks('astray', say.host('astray')), 240);
    else if ((lack.umbrella ?? 0) + (lack.shelter ?? 0) >= 2) this.alert(say.host('rain'), 300);
    else if (this.shops.some(sh => (sh.dirt ?? 0) >= 1)) this.alert(say.dirty(), 300);
    else if (this.shops.some(sh => sh.off)) {
      const [gx, gy] = shopCenter(this.shops.find(sh => sh.off)!);
      this.alert(this.lineAbout(say.host('nopath'), { gx, gy }), 300);
    }
    else if (picky) this.alert(say.host('product'), 300);
    else if (this.litter.length >= 6) this.alert(this.lineAbout(say.host('litter'), this.litter[0]), 240);
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
      // feest: de dieren van het verblijf waar het om ging dansen, en de gasten er vlak omheen juichen mee
      for (const pen of this.partyPens(level)) {
        for (const a of this.animalsIn(pen.region.id)) a.cheer();
        const far = Math.max(...pen.region.tiles.map(i => Math.hypot(tileXY(i)[0] + 0.5 - pen.cx, tileXY(i)[1] + 0.5 - pen.cy)));
        this.guests.cheerNear(pen.cx, pen.cy, far + 2.2);
      }
      // ook de zeedieren die er nu bij komen, worden alvast geladen
      const extra = (Object.keys(BONUS) as SpeciesId[]).filter(sp => BONUS[sp] === this.level + 1 && hasSpecies(sp));
      const ready = Promise.all([loadSpecies(level.reward), ...extra.map(loadSpecies)]);
      const done = this.praise();
      // wat er naast het dier nog vrijkomt: iets voor het park of een nieuw speeltoestel
      const soon: string[] = [...TROUGHS.filter(k => TROUGH[k].from === this.level + 1), ...DECORS.filter(k => DECOR[k].from === this.level + 1), ...SHOPS.filter(k => FEATURE[k] === this.level + 1),
        ...TOYS.filter(k => TOY_FROM[k] === this.level + 1 && TOY_FROM[k] > FEATURE.fun), ...PATH_KINDS.filter(k => k !== 'path' && PATH_FROM[k] === this.level + 1),
        ...PARK_PROPS.filter(k => PROP[k].from === this.level + 1)];
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
      }, done.who, [...extra.map(sp => speciesIcon(sp)), ...soon.map(k => icon(k in TROUGH ? TROUGH_ICON[k as TroughKind] : (k as IconId)))]);
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
    for (const [g, badge] of this.guestBadges)
      if (g.gone || !g.badge) {
        badge.remove();
        this.guestBadges.delete(g);
      }
    for (const g of this.guests.guests) {
      // een vast plaatje boven een bijzondere gast: de juf, de jarige, de beroemde gast, het verdwaalde kind
      if (g.badge) {
        let badge = this.guestBadges.get(g);
        if (!badge) this.guestBadges.set(g, (badge = this.hud.makeBadge(icon(g.badge as IconId), g.badge === 'lost' || g.badge === 'seek' ? 'sad' : 'star')));
        const at = this.view.toScreen(g.gx, g.gy, g.height + 0.2);
        // twijfelt de juf over de weg, dan staat er even een vraagteken in plaats van haar bordje
        badge.hidden = g.astray > 0;
        badge.style.transform = `translate(${at.x}px, ${at.y}px) translate(-50%, -100%) scale(0.85)`;
      }
      let bubble = this.guestBubbles.get(g);
      // een wolkje staat er alleen als de gast iets echt niet kan vinden (of de weg kwijt is): wie gewoon onderweg is
      // naar een kraam of een bankje, loopt zonder wolkje
      if (!g.wish || !g.wish.lacking || (g.badge && g.astray <= 0)) {
        if (bubble) bubble.hidden = true;
        continue;
      }
      // buiten beeld hoeft er geen wolkje te zijn: dat scheelt veel werk bij een vol park
      const s = this.view.toScreen(g.gx, g.gy, g.height + 0.1);
      if (s.x < -40 || s.y < -40 || s.x > innerWidth + 40 || s.y > innerHeight + 40) {
        if (bubble) bubble.hidden = true;
        continue;
      }
      if (!bubble) this.guestBubbles.set(g, (bubble = this.hud.makeBubble()));
      const key = g.wish.kind + (g.wish.product ?? '');
      if (bubble.dataset.wish !== key) {
        bubble.dataset.wish = key;
        bubble.innerHTML =
          g.wish.kind === 'fav' && g.fav ? speciesIcon(g.fav) + icon('heart', 'badge')
          : g.wish.kind === 'dark' ? icon('lantern')
          : g.wish.kind === 'astray' ? icon('question') + icon('signpost', 'badge')
          : g.wish.kind === 'wide' ? icon('wide')
          : g.wish.kind === 'pet' ? icon('petting')
          : g.wish.product ? this.productIcon(g.wish.product)
          : icon(NEED_KIND[g.wish.kind] ?? 'smile_bad');
      }
      bubble.classList.toggle('lacking', g.wish.lacking);
      bubble.hidden = false;
      bubble.style.transform = `translate(${s.x}px, ${s.y}px) translate(-50%, -100%) scale(0.8)`;
    }
  }

  update(dt: number): void {
    // tijdens een puzzeltje staat het park even stil: een kind mag er rustig over doen
    if (miniOpen()) return;
    this.wildCache = null;
    this.clock += dt;
    this.view.update(dt);
    this.updateNight();
    this.updateSky(dt);
    this.updateHand();
    // wat er oplicht: met de veger alle poepjes en afval, anders alleen wat onder de muis ligt; en het dier in nood
    const spots: { gx: number; gy: number; r?: number; hot?: boolean; brown?: boolean; soft?: boolean }[] = [];
    const hot = this.hoverPoop && (this.poops.includes(this.hoverPoop) || this.litter.includes(this.hoverPoop)) ? this.hoverPoop : null;
    // de wegwijzer of plattegrond in de hand: een zachte ring laat zien hoe ver elk bord de weg wijst, ook het bord onder je vinger
    if (this.tool === 'decor' && (this.option.decor === 'signpost' || this.option.decor === 'mapboard')) {
      for (const s of this.signs()) spots.push({ gx: s.gx, gy: s.gy, r: s.r, soft: true });
      const g = this.lastHover ? this.view.groundPoint(...this.lastHover) : null, e = g ? nearestEdge(g.gx, g.gy) : null;
      if (e && this.grid.validEdge(e)) {
        const [gx, gy] = this.decorPos({ x: e.x, y: e.y, edge: e.o });
        spots.push({ gx, gy, r: WAYFIND[this.option.decor], soft: true, hot: true });
      }
    }
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
      if (this.option.action === 'broom') for (const sh of this.shops) if ((sh.dirt ?? 0) >= 1) spots.push({ gx: blockCenter(sh)[0], gy: blockCenter(sh)[1], hot: true, r: 3 });
      if (this.option.action === 'picker' && this.carry)
        for (const bin of this.shops) if (bin.kind === 'bin') spots.push({ gx: edgePose(bin)[0], gy: edgePose(bin)[1], hot: true, r: 1.6 });
    } else if (hot) spots.push({ gx: hot.gx, gy: hot.gy, hot: true, r: 1.4 });
    // elk poepje heeft een bruine ring, zodat je het goed ziet liggen (met de veger in de hand zijn ze al geel)
    if (!(this.tool === 'action' && this.option.action === 'broom')) for (const p of this.poops) if (p !== hot) spots.push({ gx: p.gx, gy: p.gy, r: 0.9, brown: true });
    if (this.marked && (this.clock > this.marked.until || !this.animals.includes(this.marked.a))) this.marked = null;
    if (this.marked) spots.push({ gx: this.marked.a.gx, gy: this.marked.a.gy, hot: true, r: 2.6 });
    // waar je boven hangt en op kunt tikken voor een menu: dat licht straks wit op, net als een verblijf
    if (!(this.hoverAt && this.tool === 'hand' && !this.moving && !this.hud.menuOpen)) this.hoverAt = null;
    // waar de melding over ging waar je net op tikte
    const pointed = this.pointed && this.clock < this.pointed.until ? this.pointed.at() : null;
    if (pointed) spots.push({ gx: pointed[0], gy: pointed[1], hot: true, r: 2.6 });
    else this.pointed = null;
    this.view.showMarks(spots, this.clock * 5);
    // het gekozen verblijf (menu open) licht iets duidelijker op dan het verblijf dat je alleen aanwijst
    if (this.menuPen && (!this.hud.menuOpen || !this.pens.includes(this.menuPen))) this.menuPen = null;
    if (this.hoverPen && (this.tool !== 'hand' || this.moving || !this.pens.includes(this.hoverPen))) this.hoverPen = null;
    const lit = this.menuPen ?? this.hoverPen;
    // het hok dat je sleept licht op; anders het verblijf dat je aanwijst of gekozen hebt
    if (this.rect) this.view.highlight(this.rectTiles, [], 1.6, this.clock);
    else if (!lit && this.hoverAt) {
      // een kraam, voerbak, dier, gast of werker waar je boven hangt: hetzelfde witte vlak met rand als bij een verblijf
      const [hx, hy] = this.hoverAt.at(), glow = this.glowBlock(hx, hy, this.hoverAt.w, this.hoverAt.h);
      this.view.highlight(glow.tiles, glow.edges, 0.9, this.clock);
    } else this.view.highlight(lit ? lit.region.tiles : null, lit ? this.grid.borderEdges(lit.region) : [], this.menuPen ? 1 : 0.6, this.clock);
    for (const a of this.animals) a.update(dt, this);
    this.guests.update(dt);
    this.road.update(dt, this.night);
    this.animateToys(dt);
    if (this.staffGhost?.worker.mesh.visible) this.staffGhost.worker.dangle(this.staffGhost.gx, this.staffGhost.gy, this.clock, this.staffGhost.ok);
    this.animateProps();
    for (const worker of this.workers) worker.update(dt, this, this.claimed);
    const hour = Math.floor(this.clock / HOUR_SECONDS);
    if (hour !== this.hour) {
      this.hour = hour;
      this.payWages();
    }
    if (this.guests.train?.arrived) sfx('train.toot', { volume: 0.3, every: 4 });
    const vendorsHome = this.vendorsHome();
    for (const shop of this.shops) {
      shop.vendor?.update(dt, (shop.busyNow ?? 0) > 0, vendorsHome);
      if (!shop.edge || shop.kind !== 'bench') this.view.animateShop(shop.mesh, shop.kind, this.clock, shop.busyNow ?? 0, shop.x * 3 + shop.y);
      // feest voorbij: de slingers gaan weer weg; een vieze kraam krijgt vlekken en vliegjes
      if (shop.partyUntil && this.clock > shop.partyUntil) {
        shop.partyUntil = 0;
        this.view.setShopParty(shop.mesh, false);
      }
      const dirty = (shop.dirt ?? 0) >= 1;
      if (dirty !== !!shop.dirtShown) {
        shop.dirtShown = dirty;
        this.view.setShopDirt(shop.mesh, dirty);
      }
      if (shop.kind === 'ferris') {
        // het reuzenrad draait altijd rustig rond
        shop.spin = ((shop.spin ?? 0) + dt * FERRIS.speed) % (Math.PI * 2);
        const wheel = shop.mesh.userData.moving as THREE.Object3D | undefined;
        if (wheel) wheel.rotation.z = shop.spin;
        continue;
      }
      if (shop.kind === 'bumper') {
        // de botsauto's rijden hard met iemand erin en kruipen als ze leeg zijn
        shop.spin = (shop.spin ?? 0) + dt * (shop.busyNow ? 1 : 0.3);
        const cars = (shop.mesh.userData.cars ?? []) as THREE.Object3D[];
        for (let i = 0; i < Math.min(cars.length, BUMPER_CARS); i++) {
          const [cx, cz, heading] = bumperCar(i, shop.spin);
          cars[i].position.set(cx, 0.05, cz);
          cars[i].rotation.y = heading;
        }
        continue;
      }
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
      const s = this.view.toScreen(a.px, a.py, a.top);
      bubble.style.transform = `translate(${s.x}px, ${s.y}px) translate(-50%, -100%)`;
    }
    this.guestBubblesUpdate();
    this.updateLive();
    this.updateLiveGuest();
    // het prijskaartje boven elke strook grond die te koop is
    for (const [side, sign] of this.landSigns) {
      const [cx, cy] = this.view.plotCenter(this.grid.plot(side));
      const s = this.view.toScreen(cx, cy, 2.4);
      sign.hidden = false;
      sign.style.transform = `translate(${s.x}px, ${s.y}px) translate(-50%, -100%)`;
    }
    // een bordje boven alles wat niet aan het pad staat
    for (const shop of this.shops) {
      if (!shop.off) {
        if (shop.warn) shop.warn.hidden = true;
        continue;
      }
      shop.warn ??= this.hud.makeNoPath();
      shop.warn.hidden = false;
      const [cx, cy] = shopCenter(shop);
      // vlak boven het ding zelf: een bankje of bak is laag, een gebouw hoog
      const s = this.view.toScreen(cx, cy, shop.edge ? 0.62 : 1.9);
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
