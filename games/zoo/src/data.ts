// Alle spelinhoud als gegevens: soorten, voer, ondergrond, slaapplekken, winkels, prijzen en levels.
export type Terrain = 'grass' | 'mud' | 'sand' | 'water' | 'path';
export type FoodId = 'veg' | 'hay' | 'fruit' | 'grain' | 'meat' | 'leaves';
export type BedKind = 'straw' | 'shed' | 'rock' | 'shade';
export type ShopKind = 'foodstall' | 'drinkstall' | 'bench';
export type FenceOption = 'fence' | 'gate' | 'wall';
export type SpeciesId =
  | 'pig' | 'cow' | 'sheep' | 'horse' | 'donkey' | 'goat' | 'alpaca'
  | 'zebra' | 'giraffe' | 'lion' | 'camel' | 'rhino' | 'hippo' | 'elephant';
export type Variant = 'male' | 'female' | 'young_m' | 'young_f';
export type WishId = 'enclosure' | 'food' | 'bed' | 'terrain' | 'friend' | 'clean';

/** De volgorde is ook de waarde in het opslagbestand: nieuwe soorten komen achteraan. */
export const TERRAINS: Terrain[] = ['grass', 'mud', 'sand', 'water', 'path'];
export const TERRAIN_INFO: Record<Terrain, { colors: [number, number] }> = {
  grass: { colors: [0x86c95c, 0x7cc053] },
  mud: { colors: [0x9c6b44, 0x8f6039] },
  sand: { colors: [0xecd591, 0xe3ca82] },
  water: { colors: [0x6ec3e8, 0x62b7dd] },
  path: { colors: [0xd8c7ab, 0xcdbb9d] },
};

export const FOODS: FoodId[] = ['veg', 'hay', 'fruit', 'grain', 'meat', 'leaves'];
export const BEDS: BedKind[] = ['straw', 'shed', 'rock', 'shade'];
export const SHOPS: ShopKind[] = ['foodstall', 'drinkstall', 'bench'];

// ------------------------------------------------------------ munten
/** Er passen nooit meer munten in de kas dan dit; zo blijft tellen makkelijk. */
export const COIN_CAP = 30;
export const START_COINS = 10;
export const LEVEL_BONUS = 5;
export const PRICE = { trough: 1, bed: 1 };
export const SHOP_PRICE: Record<ShopKind, number> = { foodstall: 3, drinkstall: 3, bench: 1 };

export interface SpeciesInfo {
  terrain: Terrain;
  food: FoodId;
  /** De slaapplek waar dit dier graag op slaapt. */
  bed: BedKind;
  /** Sterk dier: het verblijf moet rondom van steen zijn. */
  strong?: boolean;
  /** Prijs in munten. */
  cost: number;
}
export const SPECIES: Record<SpeciesId, SpeciesInfo> = {
  pig: { terrain: 'mud', food: 'veg', bed: 'straw', cost: 1 },
  cow: { terrain: 'grass', food: 'hay', bed: 'shed', cost: 2 },
  sheep: { terrain: 'grass', food: 'hay', bed: 'straw', cost: 2 },
  horse: { terrain: 'grass', food: 'fruit', bed: 'shed', cost: 3 },
  donkey: { terrain: 'grass', food: 'veg', bed: 'straw', cost: 3 },
  goat: { terrain: 'grass', food: 'grain', bed: 'rock', cost: 3 },
  alpaca: { terrain: 'grass', food: 'grain', bed: 'straw', cost: 4 },
  zebra: { terrain: 'sand', food: 'hay', bed: 'shade', cost: 5 },
  giraffe: { terrain: 'sand', food: 'leaves', bed: 'shade', cost: 7 },
  lion: { terrain: 'sand', food: 'meat', bed: 'rock', strong: true, cost: 10 },
  camel: { terrain: 'sand', food: 'hay', bed: 'rock', cost: 6 },
  rhino: { terrain: 'mud', food: 'hay', bed: 'rock', strong: true, cost: 10 },
  hippo: { terrain: 'water', food: 'veg', bed: 'shade', strong: true, cost: 12 },
  elephant: { terrain: 'sand', food: 'fruit', bed: 'shade', strong: true, cost: 15 },
};

// ------------------------------------------------------------ levels
export type GoalType =
  | 'enclosure' | 'trough' | 'bed' | 'animals' | 'happy' | 'fed' | 'cleaned'
  | 'path' | 'guests' | 'coins' | 'shop' | 'born';
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

export const LEVELS: Level[] = [
  // boerderij
  { goals: [goal('enclosure', 1), goal('trough', 1)], reward: 'pig' },
  { goals: [animals('pig'), goal('bed', 1), goal('fed', 2), happy('pig')], reward: 'cow' },
  { goals: [animals('cow'), happy('cow'), goal('cleaned', 3)], reward: 'sheep' },
  { goals: [goal('path', 6), happy('sheep'), goal('guests', 3)], reward: 'horse' },
  { goals: [shop('foodstall'), happy('horse'), goal('coins', 8)], reward: 'donkey' },
  { goals: [shop('drinkstall'), happy('donkey'), goal('guests', 5)], reward: 'goat' },
  { goals: [happy('goat'), goal('born', 1), goal('coins', 15)], reward: 'alpaca' },
  // savanne
  { goals: [happy('alpaca'), goal('guests', 8), goal('cleaned', 5)], reward: 'zebra' },
  { goals: [happy('zebra'), shop('bench', 2), goal('coins', 20)], reward: 'giraffe' },
  { goals: [happy('giraffe'), goal('born', 2), goal('guests', 10)], reward: 'lion' },
  { goals: [happy('lion'), goal('coins', 25)], reward: 'camel' },
  { goals: [happy('camel'), goal('guests', 12)], reward: 'rhino' },
  { goals: [happy('rhino'), goal('born', 3)], reward: 'hippo' },
  { goals: [happy('hippo'), goal('guests', 14), goal('coins', 30)], reward: 'elephant' },
];

/** Soorten die vrij zijn als je `done` levels hebt gehaald. */
export function unlockedSpecies(done: number): SpeciesId[] {
  return LEVELS.slice(0, done).map(l => l.reward);
}

/** Vanaf hoeveel gehaalde levels iets meedoet. */
export const FEATURE = { paths: 3, foodstall: 4, drinkstall: 5, bench: 5 };

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
  guests: 'host',
  shop: 'host',
  coins: 'cashier',
};

export const WISH_ORDER: WishId[] = ['enclosure', 'food', 'bed', 'terrain', 'friend', 'clean'];
export const MAX_POOPS_CLEAN = 2;
