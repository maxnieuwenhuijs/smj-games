// Kleine momentjes met kinderen in het park, waar de speler bij kan helpen: zwaaien, een ballon die wegvliegt
// terugvangen, een nieuw ijsje als het eerste op de grond viel, en een muntje voor een kind zonder geld.
// Hier staan alleen de vaste getallen en de rekensommen; het spel en de gasten doen de rest.
import { FEATURE } from './data';

/** De momentjes die uit zichzelf gebeuren. */
export type KidMoment = 'balloon' | 'icecream' | 'coin';
export const KID_MOMENTS: KidMoment[] = ['balloon', 'icecream', 'coin'];

/** Zwaaien naar een gast: zoveel blijer, en pas na zoveel tellen kan dat bij dezelfde gast weer. */
export const WAVE = { bonus: 0.08, every: 45 };

/** Is zwaaien nu weer goed voor een beetje plezier? `at`: wanneer de speler het laatst zwaaide (in de leeftijd van de gast). */
export const waveFresh = (age: number, at: number | null): boolean => at === null || age - at >= WAVE.every;

/**
 * Vanaf hoeveel gehaalde levels een moment kan gebeuren, en hoeveel tellen er in het hele park minstens tussen
 * twee van dezelfde soort zitten. Een ijsje valt pas als er ijs te koop is, een ballon pas als er ballonnen zijn;
 * een kind zonder geld komt pas als er iets leuks te koop is (een ijsje) en de speler munten genoeg heeft.
 */
export const KID_MOMENT: Record<KidMoment, { from: number; gap: number }> = {
  icecream: { from: FEATURE.icecream + 1, gap: 150 },
  coin: { from: FEATURE.icecream + 2, gap: 200 },
  balloon: { from: FEATURE.balloon + 1, gap: 150 },
};

/** Kans per tel dat het gebeurt bij een kind dat ervoor in aanmerking komt (daarna telt nog de pauze van KID_MOMENT). */
export const KID_CHANCE: Record<KidMoment, number> = { balloon: 1 / 200, icecream: 1 / 30, coin: 1 / 60 };

/** Zo lang (in tellen) staat het kind te wachten op hulp: het wolkje met het ijsje, of met de lege portemonnee. */
export const KID_WAIT = { icecream: 14, coin: 16 };

/** Zo lang blijft de vlek van het ijsje op het pad liggen, als niemand hem opruimt. */
export const SPLAT_MELT = 90;

/** Mag er nu weer zo'n moment komen? `last`: wanneer het vorige was (de klok van het spel). */
export function momentReady(kind: KidMoment, level: number, now: number, last: number): boolean {
  const m = KID_MOMENT[kind];
  return level >= m.from && now - last >= m.gap;
}

/** De wegvliegende ballon: zo lang kun je hem vangen, en na zoveel tellen is hij helemaal weg in de lucht. */
export const BALLOON_FLY = { catchFor: 6, gone: 9, back: 1.6 };

const smooth = (a: number, b: number, x: number): number => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * Waar de losse ballon is, `t` tellen nadat het kind hem losliet: hoe hoog boven de hand, hoe ver opzij, hoe
 * schuin hij wiebelt en hoe groot hij nog is. Eerst stijgt hij heel langzaam (dan kun je hem nog vangen), daarna
 * steeds sneller de lucht in, en wordt hij kleiner.
 */
export function balloonDrift(t: number): { up: number; side: number; tilt: number; size: number } {
  const slow = Math.min(t, BALLOON_FLY.catchFor), fast = Math.max(0, t - BALLOON_FLY.catchFor);
  return {
    up: slow * 0.25 + fast * (0.5 + fast * 0.5),
    side: Math.sin(t * 1.4) * 0.16 + t * 0.04,
    tilt: Math.sin(t * 2.6) * 0.25,
    size: 1 - smooth(BALLOON_FLY.catchFor, BALLOON_FLY.gone, t) * 0.95,
  };
}

/** Kun je de ballon nog vangen? */
export const balloonCatchable = (t: number): boolean => t >= 0 && t < BALLOON_FLY.catchFor;

/** Terug naar de hand: hoe ver de ballon is (0 = waar je hem ving, 1 = weer in de hand), rustig afremmend. */
export const balloonHome = (t: number): number => smooth(0, BALLOON_FLY.back, t);

/** De bladzijde in het gastenboek met de hartjes van kinderen die een muntje kregen (naast de dieren). */
export const BOOK_HEART = 'heart';
