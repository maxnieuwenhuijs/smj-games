// Spelen in het park met de seizoenen en de nacht: blaadjes harken in de herfst, een sneeuwpop bouwen in de winter
// en 's nachts de lampjes uit en aan doen. Geen DOM en geen Three.js in dit bestand: alleen rekenen, zodat het te testen is.
import type { DecorKind, Season } from './data';

/** Wat er bij de actieknop bij komt: de hark in de herfst, sneeuw in de winter. */
export type ParkAct = 'rake' | 'snowball';

/** Welke knop er in dit seizoen bij de actieknop hoort (pas vanaf de seizoenen). */
export function seasonActs(season: Season, seasons: boolean): ParkAct[] {
  if (!seasons) return [];
  return season === 'autumn' ? ['rake'] : season === 'winter' ? ['snowball'] : [];
}

// ------------------------------------------------------------ blaadjes
/** Blaadjes in de herfst. */
export const LEAF = {
  /** Om de zoveel tellen valt er een plekje blaadjes onder een boom. */
  every: 3,
  /** Zoveel plekjes liggen er hooguit tegelijk in het park. */
  max: 36,
  /** Zo ver van de boom vallen ze (in tegels), en minstens zo ver. */
  spread: 1.5,
  close: 0.35,
  /** Twee plekjes liggen minstens zo ver uit elkaar. */
  apart: 0.32,
  /** Zo dichtbij moet de hark komen (in tegels). */
  reach: 0.5,
  /** Een plekje gaat bij een hoop die zo dichtbij ligt; anders begint het een nieuwe hoop. */
  join: 1.6,
  /** Vanaf zoveel plekjes is de hoop groot: dan komt er een kind in springen. */
  big: 6,
  /** Komt er na zoveel tellen geen kind, dan mag je de hoop toch wegharken. */
  wait: 25,
  /** Een grote hoop wegharken: zoveel munten (na de sprong van een kind een munt meer), en zoveel plezier voor gasten in de buurt. */
  coins: 1,
  fun: 0.1,
  /** Zo lang krimpen de blaadjes weg als de herfst voorbij is. */
  fade: 4,
};

/** Een plekje onder een boom waar blaadjes vallen. `a` en `b` zijn twee toevalsgetallen van 0 tot 1. */
export function leafSpot(tree: [number, number], a: number, b: number): [number, number] {
  const angle = a * Math.PI * 2, dist = LEAF.close + b * (LEAF.spread - LEAF.close);
  return [tree[0] + Math.cos(angle) * dist, tree[1] + Math.sin(angle) * dist];
}

/** Het dichtstbijzijnde ding binnen `within` tegels van (gx, gy), of null. */
export function nearest<T extends { gx: number; gy: number }>(list: T[], gx: number, gy: number, within: number): T | null {
  let best: T | null = null, bestD = within;
  for (const p of list) {
    const d = Math.hypot(p.gx - gx, p.gy - gy);
    if (d <= bestD) {
      best = p;
      bestD = d;
    }
  }
  return best;
}

/** Een plekje blaadjes gaat bij de hoop: de hoop wordt groter en schuift een stukje naar het plekje toe. */
export function joinPile(pile: { gx: number; gy: number; n: number }, gx: number, gy: number): { gx: number; gy: number; n: number } {
  const n = pile.n + 1;
  return { gx: pile.gx + (gx - pile.gx) / n, gy: pile.gy + (gy - pile.gy) / n, n };
}

/** Is de hoop groot genoeg om in te springen? */
export const bigPile = (n: number): boolean => n >= LEAF.big;

/** Hoe groot de hoop eruitziet: hij groeit snel in het begin en daarna langzamer. */
export const pileSize = (n: number): number => Math.min(1.25, 0.35 + Math.sqrt(n) * 0.28);

// ------------------------------------------------------------ sneeuw
/** Een sneeuwpop bouwen in de winter. */
export const SNOW = {
  /** Een nieuwe sneeuwbal, en hoe groot hij hooguit wordt (de onderste bal van de sneeuwpop uit de winkel is 0,27). */
  r0: 0.1,
  r1: 0.3,
  /** Zoveel groeit de bal per tegel die hij rolt. */
  grow: 0.06,
  /** Zo ver van de bal mag je tikken om hem te raken (bovenop zijn straal). */
  reach: 0.3,
  /** Zoveel sneeuwpoppen (af of niet) staan er hooguit tegelijk. */
  max: 8,
  /** Zo lang smelt een sneeuwpop als de winter voorbij is. */
  melt: 6,
  /** De kleuren van de sjaal. */
  scarves: [0xe0584f, 0x4a90e2, 0xf5a623, 0x6cc04a, 0xb06ad9, 0xf06aa6, 0x2bb5a8],
};
/** 0: een bal (de buik), 1: de middelste bal erop, 2: het hoofd erop, 3: af, met een wortelneus en een sjaal. */
export type SnowStage = 0 | 1 | 2 | 3;

/** De bal rolt `dist` tegels: hij wordt groter, maar niet groter dan SNOW.r1. */
export const rolled = (r: number, dist: number): number => Math.min(SNOW.r1, r + Math.max(0, dist) * SNOW.grow);

/** Een tik op de sneeuwbal: de volgende bal komt erop. Een sneeuwpop die af is, blijft af. */
export const stackUp = (stage: SnowStage): SnowStage => Math.min(3, stage + 1) as SnowStage;

/** Zo groot is de sneeuwpop, vergeleken met de sneeuwpop uit de winkel. */
export const snowScale = (r: number): number => r / 0.27;

/** Hoeveel er nog over is van een smeltende sneeuwpop (1 tot 0), `t` tellen nadat de winter voorbij is. */
export const meltLeft = (t: number): number => Math.max(0, Math.min(1, 1 - t / SNOW.melt));

// ------------------------------------------------------------ lampjes
/** Lampen die je 's nachts uit en aan kunt tikken. Het kampvuur hoort er niet bij. */
export const LAMPS: DecorKind[] = ['lantern', 'lightstring', 'gardenlight', 'lampion', 'torch', 'streetlamp'];
export const isLamp = (kind: string): boolean => (LAMPS as string[]).includes(kind);

/** Het lichtfeestje. */
export const LAMP = {
  /** Doe je alle lampen binnen zoveel tellen weer aan, dan is er een feestje. */
  window: 15,
  /** Daarvoor moet je er minstens zoveel aandoen (of alle, als er minder zijn). */
  min: 3,
  /** Het golfje gaat zo snel van lamp naar lamp: zoveel tellen per tegel. */
  step: 0.12,
  /** Zo lang knippert elke lamp in de kleuren van het golfje. */
  flash: 1.6,
  /** De kleuren van het golfje, één voor één. */
  colors: [0xff5a5a, 0xffb03a, 0xffe14a, 0x6fdc5a, 0x4ab8ff, 0xb57aff],
};

/**
 * Komt er een lichtfeestje? Alleen als alle lampen weer aan zijn (`off` is 0), er minstens twee zijn, en er net
 * genoeg zijn aangedaan: `onTimes` zijn de momenten waarop je een lamp aandeed.
 */
export function waveDue(onTimes: number[], now: number, off: number, total: number): boolean {
  if (off > 0 || total < 2) return false;
  const recent = onTimes.filter(t => now - t <= LAMP.window).length;
  return recent >= Math.min(total, LAMP.min);
}

/** Welke kleur een lamp in het golfje heeft, `t` tellen na het begin, `dist` tegels van waar het begon. Null: gewoon aan. */
export function waveColor(t: number, dist: number): number | null {
  const own = t - dist * LAMP.step;
  if (own < 0 || own >= LAMP.flash) return null;
  return LAMP.colors[Math.floor((own / LAMP.flash) * LAMP.colors.length) % LAMP.colors.length];
}

/** Zo lang duurt het hele golfje, tot de verste lamp (`far` tegels weg) klaar is. */
export const waveLength = (far: number): number => far * LAMP.step + LAMP.flash;
