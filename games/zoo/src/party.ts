// Het avondfeest: een bijzondere avond, ongeveer eens per tien levels. 's Ochtends vertelt de directeur dat er
// vanavond feest is; om acht uur staat er een grote gong bij de ingang. Tik je erop (of wordt het negen uur), dan
// begint het feest: lampen in alle kleuren, muziek, gasten die zwaaiend een rondje door het park lopen, dieren die
// aan het hek hun kunstje doen en aan het eind confetti boven de poort.
// Geen DOM en geen Three.js in dit bestand: de rekensommen kun je los testen (party.test.ts).

/** De getallen van het feest. */
export const PARTY = {
  /** Na zoveel gehaalde levels is er de eerstvolgende avond feest (de nacht komt vanaf level 15). */
  levels: [20, 30, 40, 50],
  /** Vanaf dit uur staat de gong bij de ingang; om `autoAt` begint het feest vanzelf, zodat je het nooit mist. */
  gongFrom: 20,
  autoAt: 21,
  /** Zo lang duurt het feest, in tellen speltijd. */
  seconds: 75,
  /** Tijdens het feest loopt de klok half zo snel: de sluitingstijd schuift wat op en de gasten blijven tot het eind. */
  pace: 0.5,
  /** De munten aan het eind. */
  coins: 10,
  /** Om de zoveel tellen komen de dieren weer naar het hek voor een kunstje. */
  animalEvery: 7,
  /** De laatste zoveel tellen: confetti boven de poort. */
  fireworks: 9,
  /** De kleuren van de confetti boven de poort. */
  colors: [0xff5a8a, 0xffd23f, 0x4a90e2, 0x7ed957, 0xb07cf0, 0xff9a3a],
  /** Het vrolijke nummer dat tijdens het feest speelt (uit public/audio/music). */
  track: 'farm',
} as const;

/**
 * Is er vanavond feest? Geeft het feest dat aan de beurt is (een getal uit PARTY.levels), of 0. `done`: zoveel
 * levels waren gehaald bij de feesten die al geweest zijn. Wie meerdere feesten heeft overgeslagen (een oud spel),
 * krijgt er één: het hoogste.
 */
export function partyDue(level: number, done: readonly number[]): number {
  let due = 0;
  for (const n of PARTY.levels) if (level >= n && !done.includes(n)) due = n;
  return due;
}

/** Het feest voor `due` is geweest: dat en alle feesten ervoor tellen als gevierd. */
export function partyDone(due: number, done: readonly number[]): number[] {
  const out = new Set(done);
  for (const n of PARTY.levels) if (n <= due) out.add(n);
  return [...out].sort((a, b) => a - b);
}

/**
 * Waar is het feest op dit uur van de avond? 'wait': nog niet (overdag), 'gong': de gong staat klaar om op te
 * tikken, 'start': het is negen uur, het feest begint vanzelf, 'late': te laat voor vanavond (dan morgen).
 */
export function partyClock(hour: number): 'wait' | 'gong' | 'start' | 'late' {
  if (hour < 7) return 'late';
  if (hour < PARTY.gongFrom) return 'wait';
  if (hour < PARTY.autoAt) return 'gong';
  // tot een uur na het begin kan het nog: zo begint het ook als het spel net na negenen weer opengaat
  return hour < PARTY.autoAt + 1 ? 'start' : 'late';
}

/**
 * Het rondje door het park: de plekken (padtegels voor de verblijven) op volgorde van de klok, rond hun midden.
 * Zo loopt iedereen dezelfde kant op en lijkt het een optocht. Elke tegel komt er één keer in.
 */
export function partyLoop(spots: readonly { tile: number; x: number; y: number }[]): number[] {
  const seen = new Set<number>();
  const list = spots.filter(s => !seen.has(s.tile) && !!seen.add(s.tile));
  if (!list.length) return [];
  const cx = list.reduce((n, s) => n + s.x, 0) / list.length, cy = list.reduce((n, s) => n + s.y, 0) / list.length;
  return list.map(s => ({ tile: s.tile, a: Math.atan2(s.y - cy, s.x - cx) })).sort((p, q) => p.a - q.a).map(s => s.tile);
}

/** De kleur van de lampen tijdens het feest: rustig door de regenboog, elke lamp net iets anders (0 tot 360). */
export function partyHue(t: number, i = 0): number {
  return (((t * 40 + i * 47) % 360) + 360) % 360;
}
