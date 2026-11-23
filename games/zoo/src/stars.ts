// De sterren van het park: 1 tot 5. Hoe beter je voor het park zorgt, hoe meer sterren en hoe meer gasten.
// Geen DOM en geen Three.js in dit bestand: alleen rekenen, zodat het te testen is.

/** Waar de sterren op letten: blije dieren, blije gasten, een schoon park, veel soorten dieren en een mooi park. */
export type StarFactor = 'animals' | 'guests' | 'clean' | 'kinds' | 'pretty';
export const STAR_FACTORS: StarFactor[] = ['animals', 'guests', 'clean', 'kinds', 'pretty'];

/** Wat er nu in het park is. */
export interface StarInput {
  /** Dieren in het park, en hoeveel daarvan blij zijn. */
  animals: number;
  happyAnimals: number;
  /** Gasten in het park, en hoeveel daarvan blij zijn. */
  guests: number;
  happyGuests: number;
  /** Afval op het pad, poepjes, en kramen die vies zijn. */
  litter: number;
  poops: number;
  dirty: number;
  /** Verschillende diersoorten in een verblijf. */
  kinds: number;
  /** Versiering in het park (bomen, bloemen, beelden) en verschillende soorten kramen aan het pad. */
  decor: number;
  shopKinds: number;
  /** Kun je al versiering kopen? Anders tellen alleen de kramen. */
  decorOpen: boolean;
}

/** Hoe zwaar elk ding meetelt (samen 1). */
export const STAR_WEIGHT: Record<StarFactor, number> = { animals: 0.35, guests: 0.3, clean: 0.2, kinds: 0.1, pretty: 0.05 };
/** Vanaf deze score heb je 2, 3, 4 of 5 sterren. */
export const STAR_AT = [0.45, 0.6, 0.78, 0.92];
/** Zoveel moet de score voorbij een grens zijn voor er een ster bij komt of af gaat: zo knippert het niet. */
export const STAR_MARGIN = 0.02;
/** Zo vaak (in tellen) kijkt het spel opnieuw hoeveel sterren het park heeft; er gaat hooguit één ster tegelijk bij of af. */
export const STAR_EVERY = 20;
/** Zo traag volgt de score wat er in het park gebeurt (in tellen): een poepje of een boze gast doet niet meteen iets. */
export const STAR_SMOOTH = 30;
/** Meer sterren, meer gasten: zo vaak het gewone aantal bij 1, 2, 3, 4 en 5 sterren. */
export const STAR_GUESTS = [0.9, 0.95, 1, 1.1, 1.2];
/** Tot dit level kosten weinig sterren nooit gasten: in de eerste wereld is het nooit moeilijker dan zonder sterren. */
export const STAR_EASY = 10;
/** Met zoveel soorten dieren is 'veel soorten' helemaal goed. */
export const STAR_KINDS = 6;
/** Met zoveel versiering en zoveel soorten kramen is het park helemaal mooi. */
export const STAR_DECOR = 6;
export const STAR_SHOPS = 5;
/** Hooguit eens in de zoveel tellen geeft de gastvrouw een tip als er een ster af ging. */
export const STAR_TIP_GAP = 240;
/** Vanaf deze waarde (0 tot 1) staat er een groen gezichtje bij een ding in de uitleg, anders een oranje. */
export const STAR_GOOD = 0.7;

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));

/** Hoe goed elk ding is, van 0 tot 1. Zijn er nog (bijna) geen dieren of gasten, dan telt dat als redelijk goed. */
export function starFactors(p: StarInput): Record<StarFactor, number> {
  // een paar poepjes mag: hoe meer dieren, hoe meer er mag liggen. Een vieze kraam telt als twee stuks afval.
  const mess = p.litter + p.poops * 0.5 + p.dirty * 2;
  const free = 1 + p.animals / 4;
  const range = 6 + p.animals / 2;
  const shops = clamp01(p.shopKinds / STAR_SHOPS);
  return {
    animals: p.animals ? clamp01(p.happyAnimals / p.animals) : 0.8,
    guests: p.guests >= 3 ? clamp01(p.happyGuests / p.guests) : 0.8,
    clean: clamp01(1 - Math.max(0, mess - free) / range),
    kinds: clamp01(p.kinds / STAR_KINDS),
    pretty: p.decorOpen ? clamp01(p.decor / STAR_DECOR) * 0.6 + shops * 0.4 : shops,
  };
}

/** De score van het park, van 0 tot 1. */
export function parkScore(p: StarInput): number {
  const f = starFactors(p);
  return STAR_FACTORS.reduce((sum, k) => sum + f[k] * STAR_WEIGHT[k], 0);
}

/** Zoveel sterren hoort er bij deze score, zonder rekening te houden met wat het park nu heeft. */
export const starsAt = (score: number): number => 1 + STAR_AT.filter(at => score >= at).length;

/**
 * Het nieuwe aantal sterren: hooguit één erbij of eraf, en alleen als de score een stukje voorbij de grens is.
 * `now` is wat het park nu heeft (1 tot 5).
 */
export function nextStars(score: number, now: number): number {
  const up = STAR_AT[now - 1];
  if (up !== undefined && score >= up + STAR_MARGIN) return now + 1;
  const down = STAR_AT[now - 2];
  if (down !== undefined && score < down - STAR_MARGIN) return now - 1;
  return now;
}

/** Een score midden tussen de grenzen van dit aantal sterren: daar begint een opgeslagen park weer. */
export function scoreOf(stars: number): number {
  const lo = STAR_AT[stars - 2] ?? 0.3, hi = STAR_AT[stars - 1] ?? 1;
  return (lo + hi) / 2;
}

/** De score volgt rustig wat er nu in het park gebeurt (`dt` tellen later). */
export const smoothScore = (score: number, now: number, dt: number): number => score + (now - score) * (1 - Math.exp(-dt / STAR_SMOOTH));

/** Zo vaak het gewone aantal gasten komt bij dit aantal sterren. In de eerste levels nooit minder. */
export function starGuests(stars: number, level: number): number {
  const k = STAR_GUESTS[Math.max(1, Math.min(5, Math.round(stars))) - 1];
  return level < STAR_EASY ? Math.max(1, k) : k;
}

/** Wat het meeste sterren kost: daar gaat de tip van de gastvrouw over. Wat nog niet te kopen is, telt niet mee. */
export function weakest(p: StarInput): StarFactor {
  const f = starFactors(p);
  const can = STAR_FACTORS.filter(k => k !== 'pretty' || p.decorOpen);
  return can.reduce((worst, k) => ((1 - f[k]) * STAR_WEIGHT[k] > (1 - f[worst]) * STAR_WEIGHT[worst] ? k : worst), can[0]);
}
