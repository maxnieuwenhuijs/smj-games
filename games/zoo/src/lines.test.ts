import { describe, expect, it } from 'vitest';
import en from './en.json';
import nl from './nl.json';
import { BUSY_KINDS, allLines, fill, say, type Tr, type Vars } from './lines';

/** Een vertaler die bijhoudt welke sleutels er niet zijn: die zou het spel als kale sleutel laten zien. */
function translator(strings: Record<string, string>): { tr: Tr; missing: string[] } {
  const missing: string[] = [];
  const tr: Tr = (key: string, vars?: Vars): string => {
    const text = strings[key];
    if (text === undefined) missing.push(key);
    return fill(text ?? key, vars);
  };
  return { tr, missing };
}

describe('de teksten van de figuren', () => {
  it('heeft in het Nederlands en het Engels dezelfde sleutels', () => {
    expect(Object.keys(nl).filter(k => !(k in en))).toEqual([]);
    expect(Object.keys(en).filter(k => !(k in nl))).toEqual([]);
  });

  for (const [lang, strings] of [['nl', nl], ['en', en]] as const) {
    it(`heeft voor elke zin een tekst (${lang})`, () => {
      const { tr, missing } = translator(strings);
      const lines = allLines(tr);
      expect(lines.length).toBeGreaterThan(500);
      expect([...new Set(missing)]).toEqual([]);
      // geen enkele zin is een kale sleutel of heeft nog een open {vakje}
      for (const line of lines) expect(line.text).not.toMatch(/\{[a-zA-Z]+\}/);
    });
  }

  it('zegt bij elke drukke winkel een echte zin, ook als die winkel geen eigen zin heeft', () => {
    const { tr, missing } = translator(nl);
    for (const kind of [...BUSY_KINDS, 'cablecar', 'station', undefined]) {
      const line = say.busy(kind);
      expect(tr(line.key)).not.toBe(line.key);
    }
    expect(say.busy('hats').key).toBe('host.busy.hats');
    expect(say.busy('cablecar').key).toBe('host.busy.any');
    expect(say.busy(undefined).key).toBe('host.busy.any');
    expect(missing).toEqual([]);
  });
});
