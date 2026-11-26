// Hekken slijten (vanaf FEATURE.wear) en worden weer gemaakt. Hier staan de getallen en de rekenregels: welke hekken
// slijten, hoe snel, welk hek er aan de beurt is, en hoeveel werk het maken is. Het spel (game.ts), het beeld (view.ts)
// en het spelletje (fixgame.ts) gebruiken ze. Alles hier is zonder beeld, zodat het te testen is.
import type { IconId } from './icons';

/** Hoe je een hek maakt: timmeren (hout), metselen (steen), knopen (net) of lijmen (glas). */
export type Mend = 'wood' | 'stone' | 'net' | 'glass';
/**
 * De soorten rand die slijten, en hoe je ze maakt: het houten hek (1), de stenen muur (3), het hoge net (4), het glas
 * (5) en het witte hekje (7). Poorten (2 en 8) en de kijkruit (6) slijten niet.
 */
export const MEND: Partial<Record<number, Mend>> = { 1: 'wood', 3: 'stone', 4: 'net', 5: 'glass', 7: 'wood' };
export const MENDS: Mend[] = ['wood', 'stone', 'net', 'glass'];
/** Slijt dit soort rand? */
export const wears = (kind: number): boolean => kind in MEND;
/** Een sterk dier duwt elk hek kapot dat kan slijten, behalve een stenen muur: die houdt het. */
export const pushable = (kind: number): boolean => wears(kind) && MEND[kind] !== 'stone';
/** Het gereedschap bij elke klus (het plaatje dat opzweeft als een hek gemaakt is) en het geluid erbij. */
export const MEND_ICON: Record<Mend, IconId> = { wood: 'hammer', stone: 'trowel', net: 'knot', glass: 'glue' };
export const MEND_SOUND: Record<Mend, string> = { wood: 'fence', stone: 'stone', net: 'net', glass: 'place' };

/**
 * Het tempo van het slijten. `first`: na zoveel tellen slijt het eerste hek; `every`: daarna om de zoveel tellen (van,
 * tot) één stap; `max`: hooguit zoveel versleten hekken tegelijk; `deepen`: de kans dat een hek dat al versleten is een
 * fase verder gaat in plaats van dat er een nieuw hek begint; `broken`: in deze fase is het hek kapot (de dieren in dat
 * verblijf zijn dan niet blij); `game`: vanaf deze fase is het maken een spelletje, daaronder is één tik met de hamer
 * genoeg; `leak`: om de zoveel tellen druppelt er water uit een gebarsten bak.
 */
export const WEAR = { first: 70, every: [50, 90] as [number, number], max: 4, deepen: 0.6, broken: 3, game: 2, leak: 1.3 };

/** Over hoeveel tellen het volgende hek een stap slijt. */
export const wearGap = (rnd: () => number = Math.random): number => WEAR.every[0] + rnd() * (WEAR.every[1] - WEAR.every[0]);

/**
 * Eén stap slijtage. `worn`: per rand de fase (1, 2 of 3); `fresh`: de randen die nog heel zijn en mogen slijten (om
 * een verblijf met dieren). Meestal gaat een hek dat al versleten is een fase verder, soms begint er een nieuw; zijn
 * er al `WEAR.max`, dan komt er geen nieuw bij. Geeft de rand met zijn nieuwe fase, of null als er niets slijt.
 */
export function wearStep(worn: ReadonlyMap<string, number>, fresh: readonly string[], rnd: () => number = Math.random): { key: string; phase: number } | null {
  const deeper = [...worn].filter(([, phase]) => phase < WEAR.broken).map(([key]) => key);
  if (deeper.length && (worn.size >= WEAR.max || rnd() < WEAR.deepen)) {
    const key = deeper[Math.floor(rnd() * deeper.length)];
    return { key, phase: worn.get(key)! + 1 };
  }
  if (worn.size >= WEAR.max || !fresh.length) return null;
  return { key: fresh[Math.floor(rnd() * fresh.length)], phase: 1 };
}

/** Is het maken van een hek in deze fase een spelletje (true), of is één tik met de hamer genoeg (false)? */
export const needsGame = (phase: number): boolean => phase >= WEAR.game;

/**
 * Hoeveel werk het spelletje is, per fase: los (fase 2) is korter dan kapot (fase 3).
 *   wood: zoveel spijkers, elk met `hits` tikken erin.
 *   stone: zoveel stenen terugleggen, en daarna van elke steen de voeg dichtsmeren.
 *   net: het net in `pulls` tikjes (of in één keer slepen) strak trekken, en dan zoveel knopen leggen.
 *   glass: zoveel stukken van de barst dichtlijmen, en daarna zoveel vlekken wegvegen.
 */
export const FIX = {
  wood: { nails: [0, 1, 2, 3], hits: 3 },
  stone: { bricks: [0, 1, 2, 3] },
  net: { knots: [0, 1, 2, 3], pulls: 3 },
  glass: { seals: [0, 2, 3, 5], smudges: [0, 1, 2, 3] },
};
const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));
const phaseOf = (phase: number): number => Math.max(1, Math.min(WEAR.broken, Math.round(phase)));
/** Zoveel spijkers, stenen, knopen of stukken barst zijn er in deze fase. */
export const fixCount = (mend: Mend, phase: number): number =>
  (mend === 'wood' ? FIX.wood.nails : mend === 'stone' ? FIX.stone.bricks : mend === 'net' ? FIX.net.knots : FIX.glass.seals)[phaseOf(phase)];
/** Zoveel vlekken moet je in deze fase van het glas vegen. */
export const smudgeCount = (phase: number): number => FIX.glass.smudges[phaseOf(phase)];

/** Bijna klaar is klaar: zo blijft er na de laatste tik nooit een haartje over. */
const snap = (v: number): number => (v < 0.02 ? 0 : v > 0.98 ? 1 : v);
/** Een spijker: hoe ver hij erin zit (0 tot 1) na nog een tik met de hamer. */
export const hammerIn = (depth: number): number => snap(clamp01(depth + 1 / FIX.wood.hits));
/** Het net: hoe ver het nog doorhangt (1 tot 0) na een tikje, of als de vinger het tot `to` (1 onderaan, 0 strak) omhoog heeft getrokken. Het zakt nooit terug. */
export const pullUp = (sag: number, to?: number): number => snap(clamp01(Math.min(sag, to ?? sag - 1 / FIX.net.pulls)));
