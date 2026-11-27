import type { Goal, Level } from './data';

/** Momentopname van het park waar de doelen aan worden afgemeten. */
export interface Stats {
  enclosures: number;
  troughs: number;
  beds: number;
  paths: number;
  /** Blije gasten die nu in het park lopen. */
  guests: number;
  coins: number;
  shops: Record<string, number>;
  animals: Record<string, number>;
  happy: Record<string, number>;
  /** Alle blije dieren bij elkaar. */
  happyAll: number;
  /** Aantal soorten waarvan er minstens twee blij zijn. */
  kinds: number;
  fed: number;
  cleaned: number;
  born: number;
  healed: number;
  caught: number;
  keepers: number;
  tidied: number;
  /** Verkocht in dit level: per ding (alleen als de gast er precies om vroeg) en per soort kraam (alles). */
  sold: Record<string, number>;
  soldAt: Record<string, number>;
  /** Alles wat verkocht is aan een gast die er precies om vroeg. */
  soldAll: number;
  /** Jongen per soort die nu in een verblijf wonen. */
  young: Record<string, number>;
  /**
   * Per tweetal soorten ('goat+alpaca', de namen op alfabet): in hoeveel verblijven ze samen wonen met van elk
   * minstens één blij dier.
   */
  together: Record<string, number>;
  /** Hoeveel verschillende soorten speelgoed er in de verblijven staan. */
  toyKinds: number;
  /** Blije dieren per wereld. */
  happyWorld: Record<string, number>;
  /** Hoeveel gasten er in dit level een ritje maakten, per soort attractie. */
  rode: Record<string, number>;
  /** Hoeveel tegels glazen tunnel er liggen. */
  tunnels: number;
}

/** De naam waaronder een tweetal soorten in `Stats.together` staat: op alfabet, zodat de volgorde niet uitmaakt. */
export const pairKey = (a: string, b: string): string => (a < b ? `${a}+${b}` : `${b}+${a}`);

export function emptyStats(): Stats {
  return {
    enclosures: 0, troughs: 0, beds: 0, paths: 0, guests: 0, coins: 0, shops: {}, animals: {}, happy: {},
    happyAll: 0, kinds: 0, fed: 0, cleaned: 0, born: 0, healed: 0, caught: 0, keepers: 0, tidied: 0, sold: {}, soldAt: {}, soldAll: 0,
    young: {}, together: {}, toyKinds: 0, happyWorld: {}, rode: {}, tunnels: 0,
  };
}

export function goalProgress(goal: Goal, s: Stats): number {
  let value = 0;
  switch (goal.type) {
    case 'enclosure': value = s.enclosures; break;
    case 'trough': value = s.troughs; break;
    case 'bed': value = s.beds; break;
    case 'path': value = s.paths; break;
    case 'guests': value = s.guests; break;
    case 'coins': value = s.coins; break;
    case 'shop': value = s.shops[goal.shop ?? ''] ?? 0; break;
    case 'rode': value = s.rode[goal.shop ?? ''] ?? 0; break;
    case 'tunnel': value = s.tunnels; break;
    case 'animals': value = s.animals[goal.species ?? ''] ?? 0; break;
    case 'happy': value = s.happy[goal.species ?? ''] ?? 0; break;
    case 'fed': value = s.fed; break;
    case 'cleaned': value = s.cleaned; break;
    case 'born': value = s.born; break;
    case 'kinds': value = s.kinds; break;
    case 'happyany': value = s.happyAll; break;
    case 'healed': value = s.healed; break;
    case 'caught': value = s.caught; break;
    case 'keeper': value = s.keepers; break;
    case 'tidy': value = s.tidied; break;
    case 'sold': value = goal.product ? s.sold[goal.product] ?? 0 : goal.shop ? s.soldAt[goal.shop] ?? 0 : s.soldAll; break;
    case 'together': value = s.together[pairKey(goal.species ?? '', goal.mate ?? '')] ?? 0; break;
    case 'young': value = s.young[goal.species ?? ''] ?? 0; break;
    case 'toys': value = s.toyKinds; break;
    case 'happyworld': value = s.happyWorld[goal.world ?? ''] ?? 0; break;
  }
  return Math.max(0, Math.min(goal.n, value));
}

export function levelDone(level: Level, s: Stats): boolean {
  return level.goals.every(g => goalProgress(g, s) >= g.n);
}
