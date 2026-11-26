// De cijfers voor het overzicht van je park (een tik op de poort): hoeveel gasten er waren en wat je verdiende in de
// laatste tijd, wat er verkocht is, de lievelingsdieren van de gasten en hoe blij ze zijn. Zonder Three.js of scherm.

/** Om de zoveel tellen een meting, en zoveel metingen bewaren (24 x 20 tellen = 8 minuten). */
export const HISTORY = { every: 20, keep: 24 };

/** Wat er gemeten is, oudste eerst: gasten in het park, en munten verdiend sinds de vorige meting. */
export interface History {
  guests: number[];
  earned: number[];
}

export const newHistory = (): History => ({ guests: [], earned: [] });

/** Een meting erbij; de oudste valt eraf als het lijstje vol is. */
export function addSample(list: number[], value: number, keep = HISTORY.keep): void {
  list.push(value);
  if (list.length > keep) list.splice(0, list.length - keep);
}

/** De `n` grootste tellingen, grootste eerst (bij gelijk: op naam, zodat het niet heen en weer springt). */
export function topCounts(counts: Record<string, number>, n: number): [string, number][] {
  return Object.entries(counts)
    .filter(([, c]) => c > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, n);
}

/** Tellen hoe vaak elk ding voorkomt (lege plekken tellen niet mee). */
export function tally(items: (string | null | undefined)[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const it of items) if (it) out[it] = (out[it] ?? 0) + 1;
  return out;
}

/** Hoeveel gasten blij, gewoon en niet blij zijn (dezelfde grenzen als het gezichtje bij een gast). */
export function funBands(funs: number[]): { good: number; ok: number; bad: number } {
  const out = { good: 0, ok: 0, bad: 0 };
  for (const f of funs) {
    if (f >= 0.55) out.good++;
    else if (f >= 0.3) out.ok++;
    else out.bad++;
  }
  return out;
}
