// Alle spelinhoud als gegevens: soorten, voer, ondergrond en levels.
export type Terrain = 'grass' | 'mud';
export type FoodId = 'veg' | 'hay';
export type SpeciesId = 'pig' | 'cow' | 'sheep';
export type Variant = 'male' | 'female' | 'young_m' | 'young_f';
export type BedKind = 'straw' | 'shed';
export type WishId = 'enclosure' | 'food' | 'bed' | 'terrain' | 'friend' | 'clean';

export const TERRAINS: Terrain[] = ['grass', 'mud'];
export const TERRAIN_INFO: Record<Terrain, { colors: [number, number] }> = {
  grass: { colors: [0x86c95c, 0x7cc053] },
  mud: { colors: [0x9c6b44, 0x8f6039] },
};

export const FOODS: FoodId[] = ['veg', 'hay'];
export const BEDS: BedKind[] = ['straw', 'shed'];

export interface SpeciesInfo {
  terrain: Terrain;
  food: FoodId;
  /** De slaapplek waar dit dier graag op slaapt. */
  bed: BedKind;
}
export const SPECIES: Record<SpeciesId, SpeciesInfo> = {
  pig: { terrain: 'mud', food: 'veg', bed: 'straw' },
  cow: { terrain: 'grass', food: 'hay', bed: 'shed' },
  sheep: { terrain: 'grass', food: 'hay', bed: 'straw' },
};

export type GoalType = 'enclosure' | 'trough' | 'bed' | 'animals' | 'happy' | 'fed' | 'cleaned';
export interface Goal {
  type: GoalType;
  n: number;
  species?: SpeciesId;
}
export interface Level {
  goals: Goal[];
  /** Het dier dat je vrijspeelt als het level gehaald is. */
  reward: SpeciesId;
}

export const LEVELS: Level[] = [
  { goals: [{ type: 'enclosure', n: 1 }, { type: 'trough', n: 1 }], reward: 'pig' },
  {
    goals: [
      { type: 'animals', species: 'pig', n: 2 },
      { type: 'bed', n: 1 },
      { type: 'fed', n: 2 },
      { type: 'happy', species: 'pig', n: 2 },
    ],
    reward: 'cow',
  },
  {
    goals: [
      { type: 'animals', species: 'cow', n: 2 },
      { type: 'happy', species: 'cow', n: 2 },
      { type: 'cleaned', n: 3 },
    ],
    reward: 'sheep',
  },
];

/** Soorten die vrij zijn als je `done` levels hebt gehaald. */
export function unlockedSpecies(done: number): SpeciesId[] {
  return LEVELS.slice(0, done).map(l => l.reward);
}

/** Welk figuur geeft de opdracht voor welk soort doel. */
export const GOAL_OWNER: Record<GoalType, 'builder' | 'keeper'> = {
  enclosure: 'builder',
  trough: 'builder',
  bed: 'builder',
  animals: 'keeper',
  happy: 'keeper',
  fed: 'keeper',
  cleaned: 'keeper',
};

export const WISH_ORDER: WishId[] = ['enclosure', 'food', 'bed', 'terrain', 'friend', 'clean'];
export const MAX_POOPS_CLEAN = 2;
