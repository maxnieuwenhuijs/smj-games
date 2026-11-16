import type { Goal, Level } from './data';

/** Momentopname van het park waar de doelen aan worden afgemeten. */
export interface Stats {
  enclosures: number;
  troughs: number;
  beds: number;
  animals: Record<string, number>;
  happy: Record<string, number>;
  fed: number;
  cleaned: number;
}

export function emptyStats(): Stats {
  return { enclosures: 0, troughs: 0, beds: 0, animals: {}, happy: {}, fed: 0, cleaned: 0 };
}

export function goalProgress(goal: Goal, s: Stats): number {
  let value = 0;
  switch (goal.type) {
    case 'enclosure': value = s.enclosures; break;
    case 'trough': value = s.troughs; break;
    case 'bed': value = s.beds; break;
    case 'animals': value = s.animals[goal.species ?? ''] ?? 0; break;
    case 'happy': value = s.happy[goal.species ?? ''] ?? 0; break;
    case 'fed': value = s.fed; break;
    case 'cleaned': value = s.cleaned; break;
  }
  return Math.max(0, Math.min(goal.n, value));
}

export function levelDone(level: Level, s: Stats): boolean {
  return level.goals.every(g => goalProgress(g, s) >= g.n);
}
