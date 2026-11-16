// Alle teksten komen uit een tekstenbestand per taal; in de code staan alleen sleutels.
export type Strings = Record<string, string>;

let table: Strings = {};

export function setStrings(strings: Strings): void {
  table = strings;
}

export function t(key: string, vars?: Record<string, string | number>): string {
  let s = table[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}
