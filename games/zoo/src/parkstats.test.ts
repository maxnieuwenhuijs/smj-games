import { describe, expect, it } from 'vitest';
import { addSample, funBands, newHistory, tally, topCounts } from './parkstats';

describe('parkoverzicht', () => {
  it('bewaart alleen de laatste metingen', () => {
    const h = newHistory();
    for (let i = 0; i < 30; i++) addSample(h.guests, i, 24);
    expect(h.guests.length).toBe(24);
    expect(h.guests[0]).toBe(6);
    expect(h.guests[23]).toBe(29);
  });

  it('zet de grootste tellingen bovenaan en laat nullen weg', () => {
    expect(topCounts({ ice: 3, food: 7, toilet: 0, drink: 3 }, 2)).toEqual([['food', 7], ['drink', 3]]);
  });

  it('telt lievelingsdieren zonder lege plekken', () => {
    expect(tally(['lion', null, 'lion', 'zebra', undefined])).toEqual({ lion: 2, zebra: 1 });
  });

  it('deelt gasten in blij, gewoon en niet blij', () => {
    expect(funBands([0.9, 0.55, 0.4, 0.3, 0.1])).toEqual({ good: 2, ok: 2, bad: 1 });
  });
});
