// Alle spelinhoud als gegevens: soorten, voer, ondergrond en levels.
export type Terrain = 'grass' | 'mud';
export type FoodId = 'veg' | 'hay';
export type SpeciesId = 'pig' | 'cow' | 'sheep';
export type Variant = 'male' | 'female' | 'young_m' | 'young_f';
export type WishId = 'enclosure' | 'food' | 'terrain' | 'friend' | 'clean';

export const TERRAINS: Terrain[] = ['grass', 'mud'];
export const TERRAIN_INFO: Record<Terrain, { icon: string; colors: [number, number] }> = {
  grass: { icon: '🟩', colors: [0x86c95c, 0x7cc053] },
  mud: { icon: '🟫', colors: [0x9c6b44, 0x8f6039] },
};

export const FOODS: Record<FoodId, { icon: string; color: number }> = {
  veg: { icon: '🥕', color: 0xf08a2c },
  hay: { icon: '🌾', color: 0xe9d05a },
};
export const START_FOODS: FoodId[] = ['veg', 'hay'];

export interface SpeciesInfo {
  icon: string;
  terrain: Terrain;
  food: FoodId;
}
export const SPECIES: Record<SpeciesId, SpeciesInfo> = {
  pig: { icon: '🐷', terrain: 'mud', food: 'veg' },
  cow: { icon: '🐮', terrain: 'grass', food: 'hay' },
  sheep: { icon: '🐑', terrain: 'grass', food: 'hay' },
};

export type GoalType = 'enclosure' | 'trough' | 'animals' | 'happy' | 'fed' | 'cleaned';
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

export const WISH_ORDER: WishId[] = ['enclosure', 'food', 'terrain', 'friend', 'clean'];
export const MAX_POOPS_CLEAN = 2;
