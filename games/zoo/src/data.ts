// Alle spelinhoud als gegevens: soorten, voer, ondergrond, slaapplekken, winkels, prijzen en levels.
export type Terrain = 'grass' | 'mud' | 'sand' | 'water' | 'path' | 'snow' | 'forest';
export type FoodId = 'veg' | 'hay' | 'fruit' | 'grain' | 'meat' | 'leaves' | 'fish' | 'bamboo';
export type BedKind = 'straw' | 'shed' | 'rock' | 'shade' | 'nest' | 'cave' | 'climb';
export type ShopKind = 'foodstall' | 'drinkstall' | 'bench' | 'toilet' | 'icecream' | 'balloon' | 'flowers' | 'bin';
export type FenceOption = 'fence' | 'gate' | 'wall' | 'net';
/** Wat voor hek een dier nodig heeft: sterke dieren een stenen muur, klimmers en vliegers een hoog net. */
export type FenceNeed = 'wall' | 'net';
export type WorldId = 'farm' | 'savanna' | 'jungle' | 'ice' | 'far';
export type SpeciesId =
  | 'pig' | 'cow' | 'sheep' | 'horse' | 'donkey' | 'goat' | 'alpaca' | 'chicken' | 'duck' | 'rabbit'
  | 'zebra' | 'giraffe' | 'lion' | 'camel' | 'rhino' | 'hippo' | 'elephant' | 'ostrich' | 'cheetah' | 'gazelle'
  | 'monkey' | 'parrot' | 'tiger' | 'gorilla' | 'crocodile' | 'panda' | 'peacock' | 'toucan' | 'sloth' | 'panther'
  | 'penguin' | 'seal' | 'polarbear' | 'reindeer' | 'wolf' | 'arcticfox' | 'bear' | 'yak' | 'owl' | 'walrus'
  | 'flamingo' | 'turtle' | 'otter' | 'beaver' | 'pelican' | 'koala' | 'redpanda' | 'lemur' | 'bison' | 'kangaroo';
export type Variant = 'male' | 'female' | 'young_m' | 'young_f';
export type WishId = 'health' | 'enclosure' | 'food' | 'bed' | 'terrain' | 'friend' | 'clean';

/** De volgorde is ook de waarde in het opslagbestand: nieuwe soorten komen achteraan. */
export const TERRAINS: Terrain[] = ['grass', 'mud', 'sand', 'water', 'path', 'snow', 'forest'];
export const TERRAIN_INFO: Record<Terrain, { colors: [number, number] }> = {
  grass: { colors: [0x86c95c, 0x7cc053] },
  mud: { colors: [0x9c6b44, 0x8f6039] },
  sand: { colors: [0xecd591, 0xe3ca82] },
  water: { colors: [0x6ec3e8, 0x62b7dd] },
  path: { colors: [0xd8c7ab, 0xcdbb9d] },
  snow: { colors: [0xf4f8fc, 0xe6eef6] },
  forest: { colors: [0x4f9a4a, 0x458d42] },
};

export const FOODS: FoodId[] = ['veg', 'hay', 'fruit', 'grain', 'meat', 'leaves', 'fish', 'bamboo'];
export const BEDS: BedKind[] = ['straw', 'shed', 'rock', 'shade', 'nest', 'cave', 'climb'];
export const SHOPS: ShopKind[] = ['foodstall', 'drinkstall', 'toilet', 'bench', 'icecream', 'flowers', 'bin', 'balloon'];
/** Kramen waar een gast iets koopt voor één munt. */
export const STALLS: ShopKind[] = ['foodstall', 'drinkstall', 'icecream', 'balloon'];
export const WORLDS: WorldId[] = ['farm', 'savanna', 'jungle', 'ice', 'far'];

// ------------------------------------------------------------ munten
/** Er passen nooit meer munten in de kas dan dit; zo blijft tellen makkelijk. */
export const COIN_CAP = 30;
export const START_COINS = 10;
export const LEVEL_BONUS = 5;
export const PRICE = { trough: 1, bed: 1, keeper: 5 };
export const SHOP_PRICE: Record<ShopKind, number> = {
  foodstall: 3, drinkstall: 3, bench: 1, toilet: 3, icecream: 4, balloon: 4, flowers: 1, bin: 1,
};

export interface SpeciesInfo {
  terrain: Terrain;
  food: FoodId;
  /** De slaapplek waar dit dier graag op slaapt. */
  bed: BedKind;
  /** Het verblijf moet rondom van steen (sterk dier) of van hoog net (klimmer, vlieger, springer) zijn. */
  need?: FenceNeed;
  /** Prijs in munten. */
  cost: number;
}

const sp = (terrain: Terrain, food: FoodId, bed: BedKind, cost: number, need?: FenceNeed): SpeciesInfo => ({ terrain, food, bed, cost, need });

export const SPECIES: Record<SpeciesId, SpeciesInfo> = {
  // boerderij
  pig: sp('mud', 'veg', 'straw', 1),
  cow: sp('grass', 'hay', 'shed', 2),
  sheep: sp('grass', 'hay', 'straw', 2),
  horse: sp('grass', 'fruit', 'shed', 3),
  donkey: sp('grass', 'veg', 'straw', 3),
  goat: sp('grass', 'grain', 'rock', 3),
  alpaca: sp('grass', 'grain', 'straw', 4),
  chicken: sp('grass', 'grain', 'nest', 2),
  duck: sp('water', 'grain', 'nest', 2),
  rabbit: sp('grass', 'veg', 'cave', 2),
  // savanne
  zebra: sp('sand', 'hay', 'shade', 5),
  giraffe: sp('sand', 'leaves', 'shade', 7),
  lion: sp('sand', 'meat', 'rock', 10, 'wall'),
  camel: sp('sand', 'hay', 'rock', 6),
  rhino: sp('mud', 'hay', 'rock', 10, 'wall'),
  hippo: sp('water', 'veg', 'shade', 12, 'wall'),
  elephant: sp('sand', 'fruit', 'shade', 15, 'wall'),
  ostrich: sp('sand', 'grain', 'nest', 6),
  cheetah: sp('sand', 'meat', 'shade', 9, 'wall'),
  gazelle: sp('sand', 'leaves', 'shade', 6),
  // jungle
  monkey: sp('forest', 'fruit', 'climb', 6, 'net'),
  parrot: sp('forest', 'fruit', 'nest', 6, 'net'),
  tiger: sp('forest', 'meat', 'cave', 12, 'wall'),
  gorilla: sp('forest', 'leaves', 'climb', 14, 'wall'),
  crocodile: sp('water', 'meat', 'rock', 10, 'wall'),
  panda: sp('forest', 'bamboo', 'cave', 12),
  peacock: sp('grass', 'grain', 'nest', 7),
  toucan: sp('forest', 'fruit', 'nest', 8, 'net'),
  sloth: sp('forest', 'leaves', 'climb', 9, 'net'),
  panther: sp('forest', 'meat', 'cave', 13, 'wall'),
  // ijs en bergen
  penguin: sp('snow', 'fish', 'nest', 6),
  seal: sp('water', 'fish', 'rock', 8),
  polarbear: sp('snow', 'fish', 'cave', 14, 'wall'),
  reindeer: sp('snow', 'hay', 'shed', 7),
  wolf: sp('snow', 'meat', 'cave', 10, 'wall'),
  arcticfox: sp('snow', 'meat', 'cave', 7),
  bear: sp('forest', 'fish', 'cave', 13, 'wall'),
  yak: sp('snow', 'hay', 'shed', 8),
  owl: sp('snow', 'meat', 'nest', 8, 'net'),
  walrus: sp('snow', 'fish', 'rock', 12, 'wall'),
  // water en verre landen
  flamingo: sp('water', 'fish', 'nest', 7),
  turtle: sp('sand', 'veg', 'shade', 6),
  otter: sp('water', 'fish', 'cave', 8),
  beaver: sp('water', 'leaves', 'cave', 8),
  pelican: sp('water', 'fish', 'nest', 9),
  koala: sp('forest', 'leaves', 'climb', 10, 'net'),
  redpanda: sp('forest', 'bamboo', 'climb', 11, 'net'),
  lemur: sp('forest', 'fruit', 'climb', 10, 'net'),
  bison: sp('grass', 'hay', 'shed', 13, 'wall'),
  kangaroo: sp('sand', 'hay', 'shade', 15, 'net'),
};

// ------------------------------------------------------------ levels
export type GoalType =
  | 'enclosure' | 'trough' | 'bed' | 'animals' | 'happy' | 'fed' | 'cleaned'
  | 'path' | 'guests' | 'coins' | 'shop' | 'born'
  | 'kinds' | 'happyany' | 'healed' | 'caught' | 'keeper' | 'tidy';
export interface Goal {
  type: GoalType;
  n: number;
  species?: SpeciesId;
  shop?: ShopKind;
}
export interface Level {
  goals: Goal[];
  /** Het dier dat je vrijspeelt als het level gehaald is. */
  reward: SpeciesId;
}

const animals = (species: SpeciesId, n = 2): Goal => ({ type: 'animals', species, n });
const happy = (species: SpeciesId, n = 2): Goal => ({ type: 'happy', species, n });
const goal = (type: GoalType, n: number): Goal => ({ type, n });
const shop = (kind: ShopKind, n = 1): Goal => ({ type: 'shop', shop: kind, n });

/**
 * Vijftig levels in vijf werelden van tien. Elk level speelt één dier vrij en vraagt om twee blije dieren
 * van de soort die je net kreeg. De rest loopt op: meer gasten, meer soorten tegelijk blij, en vanaf de
 * jungle ook zieke dieren, verzorgers en ontsnapte dieren.
 */
export const LEVELS: Level[] = [
  // ---- wereld 1: boerderij. Eén nieuw ding per level.
  { goals: [goal('enclosure', 1), goal('trough', 1)], reward: 'pig' },
  { goals: [animals('pig'), goal('bed', 1), goal('fed', 2), happy('pig')], reward: 'cow' },
  { goals: [animals('cow'), happy('cow'), goal('cleaned', 3)], reward: 'sheep' },
  { goals: [goal('path', 6), happy('sheep'), goal('guests', 3)], reward: 'horse' },
  { goals: [shop('foodstall'), happy('horse'), goal('coins', 8)], reward: 'donkey' },
  { goals: [shop('drinkstall'), happy('donkey'), goal('guests', 5)], reward: 'goat' },
  { goals: [happy('goat'), goal('born', 1), goal('coins', 12)], reward: 'alpaca' },
  { goals: [shop('toilet'), happy('alpaca'), goal('guests', 6)], reward: 'chicken' },
  { goals: [happy('chicken'), shop('bench', 2), goal('cleaned', 5)], reward: 'duck' },
  { goals: [happy('duck'), goal('kinds', 3), goal('coins', 15)], reward: 'rabbit' },
  // ---- wereld 2: savanne. Stenen muren, meer soorten tegelijk, meer gasten.
  { goals: [happy('rabbit'), goal('born', 2), goal('guests', 8)], reward: 'zebra' },
  { goals: [happy('zebra'), shop('icecream'), goal('coins', 18)], reward: 'giraffe' },
  { goals: [happy('giraffe'), goal('kinds', 4), goal('guests', 9)], reward: 'lion' },
  { goals: [happy('lion'), goal('cleaned', 6), goal('coins', 20)], reward: 'camel' },
  { goals: [happy('camel'), shop('flowers', 3), goal('guests', 10)], reward: 'rhino' },
  { goals: [happy('rhino'), goal('born', 2), goal('happyany', 12)], reward: 'hippo' },
  { goals: [happy('hippo'), goal('kinds', 5), goal('coins', 22)], reward: 'elephant' },
  { goals: [happy('elephant'), shop('bin', 2), goal('guests', 12)], reward: 'ostrich' },
  { goals: [happy('ostrich'), goal('tidy', 4), goal('born', 3)], reward: 'cheetah' },
  { goals: [happy('cheetah'), goal('kinds', 6), goal('guests', 13), goal('coins', 25)], reward: 'gazelle' },
  // ---- wereld 3: jungle. Hoge netten, zieke dieren en de eerste verzorgers.
  { goals: [happy('gazelle'), goal('healed', 1), goal('happyany', 14)], reward: 'monkey' },
  { goals: [happy('monkey'), shop('balloon'), goal('guests', 14)], reward: 'parrot' },
  { goals: [happy('parrot'), goal('healed', 2), goal('coins', 26)], reward: 'tiger' },
  { goals: [happy('tiger'), goal('keeper', 1), goal('cleaned', 8)], reward: 'gorilla' },
  { goals: [happy('gorilla'), goal('kinds', 7), goal('guests', 15)], reward: 'crocodile' },
  { goals: [happy('crocodile'), goal('born', 3), goal('tidy', 6)], reward: 'panda' },
  { goals: [happy('panda'), goal('happyany', 16), goal('coins', 28)], reward: 'peacock' },
  { goals: [happy('peacock'), goal('keeper', 2), goal('healed', 2)], reward: 'toucan' },
  { goals: [happy('toucan'), goal('kinds', 8), goal('guests', 16)], reward: 'sloth' },
  { goals: [happy('sloth'), goal('born', 4), goal('happyany', 18), goal('coins', 30)], reward: 'panther' },
  // ---- wereld 4: ijs en bergen. Sneeuw, vis en dieren die ontsnappen.
  { goals: [happy('panther'), goal('caught', 1), goal('guests', 16)], reward: 'penguin' },
  { goals: [happy('penguin'), goal('healed', 2), goal('happyany', 18)], reward: 'seal' },
  { goals: [happy('seal'), goal('caught', 2), goal('coins', 30)], reward: 'polarbear' },
  { goals: [happy('polarbear'), goal('kinds', 9), goal('guests', 17)], reward: 'reindeer' },
  { goals: [happy('reindeer'), goal('born', 4), goal('tidy', 8)], reward: 'wolf' },
  { goals: [happy('wolf'), goal('keeper', 3), goal('happyany', 20)], reward: 'arcticfox' },
  { goals: [happy('arcticfox'), goal('healed', 3), goal('caught', 2), goal('guests', 18)], reward: 'bear' },
  { goals: [happy('bear'), goal('kinds', 10), goal('coins', 30)], reward: 'yak' },
  { goals: [happy('yak'), goal('born', 5), goal('happyany', 22)], reward: 'owl' },
  { goals: [happy('owl'), goal('guests', 20), goal('healed', 3), goal('cleaned', 10)], reward: 'walrus' },
  // ---- wereld 5: water en verre landen. Alles door elkaar, en steeds meer.
  { goals: [happy('walrus'), goal('kinds', 10), goal('guests', 20)], reward: 'flamingo' },
  { goals: [happy('flamingo'), goal('born', 5), goal('caught', 3)], reward: 'turtle' },
  { goals: [happy('turtle'), goal('happyany', 24), goal('coins', 30)], reward: 'otter' },
  { goals: [happy('otter'), goal('keeper', 4), goal('healed', 4)], reward: 'beaver' },
  { goals: [happy('beaver'), goal('kinds', 11), goal('guests', 21)], reward: 'pelican' },
  { goals: [happy('pelican'), goal('born', 6), goal('tidy', 10)], reward: 'koala' },
  { goals: [happy('koala'), goal('happyany', 26), goal('caught', 3), goal('coins', 30)], reward: 'redpanda' },
  { goals: [happy('redpanda'), goal('kinds', 12), goal('guests', 22)], reward: 'lemur' },
  { goals: [happy('lemur'), goal('healed', 5), goal('born', 6), goal('happyany', 28)], reward: 'bison' },
  { goals: [happy('bison'), goal('kinds', 12), goal('guests', 22), goal('happyany', 30), goal('coins', 30)], reward: 'kangaroo' },
];

export const LEVELS_PER_WORLD = 10;
/** In welke wereld speelt dit level (0 = het eerste level)? */
export function worldOf(levelIndex: number): WorldId {
  return WORLDS[Math.min(WORLDS.length - 1, Math.floor(levelIndex / LEVELS_PER_WORLD))];
}

/** Soorten die vrij zijn als je `done` levels hebt gehaald. */
export function unlockedSpecies(done: number): SpeciesId[] {
  return LEVELS.slice(0, done).map(l => l.reward);
}

/** Vanaf hoeveel gehaalde levels iets meedoet. */
export const FEATURE = {
  paths: 3, foodstall: 4, drinkstall: 5, toilet: 7, bench: 8, icecream: 11, flowers: 14, bin: 17,
  /** Vanaf hier kunnen dieren ziek worden. */
  sick: 20,
  balloon: 21,
  /** Vanaf hier kun je een verzorger aannemen. */
  keeper: 23,
  /** Vanaf hier kan er een dier ontsnappen. */
  escape: 30,
};

/** Welk figuur geeft de opdracht voor welk soort doel. */
export const GOAL_OWNER: Record<GoalType, 'builder' | 'keeper' | 'host' | 'cashier'> = {
  enclosure: 'builder',
  trough: 'builder',
  bed: 'builder',
  path: 'builder',
  animals: 'keeper',
  happy: 'keeper',
  fed: 'keeper',
  cleaned: 'keeper',
  born: 'keeper',
  kinds: 'keeper',
  happyany: 'keeper',
  healed: 'keeper',
  caught: 'keeper',
  keeper: 'keeper',
  guests: 'host',
  shop: 'host',
  tidy: 'host',
  coins: 'cashier',
};

export const WISH_ORDER: WishId[] = ['health', 'enclosure', 'food', 'bed', 'terrain', 'friend', 'clean'];
export const MAX_POOPS_CLEAN = 2;

/**
 * Oudere opgeslagen spellen kenden veertien levels in een andere volgorde. Wie toen verder was dan de
 * alpaca, krijgt de drie nieuwe boerderijdieren erbij en gaat verder waar hij was.
 */
export function migrateLevel(level: number, version: number): number {
  return version < 2 && level > 7 ? level + 3 : level;
}
