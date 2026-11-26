import { describe, expect, it } from 'vitest';
import { PARTY, partyClock, partyDone, partyDue, partyHue, partyLoop } from './party';

describe('avondfeest', () => {
  it('is er pas na level 20, en elk feest maar één keer', () => {
    expect(partyDue(19, [])).toBe(0);
    expect(partyDue(20, [])).toBe(20);
    expect(partyDue(25, [20])).toBe(0);
    expect(partyDue(30, [20])).toBe(30);
    expect(partyDue(50, [20, 30, 40, 50])).toBe(0);
  });

  it('geeft een oud spel dat feesten oversloeg er maar één', () => {
    expect(partyDue(44, [])).toBe(40);
    const done = partyDone(40, []);
    expect(done).toEqual([20, 30, 40]);
    expect(partyDue(44, done)).toBe(0);
    expect(partyDue(50, done)).toBe(50);
  });

  it('volgt de klok: wachten, de gong, vanzelf beginnen en te laat', () => {
    expect(partyClock(9)).toBe('wait');
    expect(partyClock(PARTY.gongFrom)).toBe('gong');
    expect(partyClock(20.9)).toBe('gong');
    expect(partyClock(PARTY.autoAt)).toBe('start');
    expect(partyClock(21.6)).toBe('start');
    expect(partyClock(22.5)).toBe('late');
    expect(partyClock(3)).toBe('late');
  });

  it('maakt een rondje met de klok mee, zonder dubbele tegels', () => {
    // vier plekken in een vierkant, door elkaar aangeleverd
    const loop = partyLoop([
      { tile: 1, x: 10, y: 0 },
      { tile: 2, x: 0, y: 10 },
      { tile: 3, x: -10, y: 0 },
      { tile: 4, x: 0, y: -10 },
      { tile: 2, x: 0, y: 10 },
    ]);
    expect(loop).toHaveLength(4);
    expect(new Set(loop).size).toBe(4);
    // buren in het rondje liggen naast elkaar, niet aan de overkant
    const at = (t: number) => loop.indexOf(t);
    expect(Math.abs(at(1) - at(3))).toBe(2);
    expect(partyLoop([])).toEqual([]);
  });

  it('laat de lampen door alle kleuren gaan', () => {
    expect(partyHue(0)).toBe(0);
    expect(partyHue(1)).toBe(40);
    expect(partyHue(9)).toBe(0);
    expect(partyHue(0, 1)).toBe(47);
    expect(partyHue(-1)).toBeGreaterThanOrEqual(0);
  });
});
