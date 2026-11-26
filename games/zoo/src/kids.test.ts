import { describe, expect, it } from 'vitest';
import en from './en.json';
import nl from './nl.json';
import { FEATURE } from './data';
import { BALLOON_FLY, KID_CHANCE, KID_MOMENT, KID_MOMENTS, KID_WAIT, WAVE, balloonCatchable, balloonDrift, balloonHome, momentReady, waveFresh } from './kids';

describe('momentjes met kinderen', () => {
  it('zwaaien geeft plezier, maar bij dezelfde gast pas weer na een poosje', () => {
    expect(waveFresh(10, null)).toBe(true);
    expect(waveFresh(30, 10)).toBe(false);
    expect(waveFresh(10 + WAVE.every, 10)).toBe(true);
    expect(WAVE.bonus).toBeGreaterThan(0);
    expect(WAVE.bonus).toBeLessThanOrEqual(0.1);
  });

  it('een moment komt pas als het vrij is, en niet vaker dan eens in de paar minuten', () => {
    for (const kind of KID_MOMENTS) {
      const { from, gap } = KID_MOMENT[kind];
      expect(gap).toBeGreaterThanOrEqual(120);
      expect(momentReady(kind, from - 1, 1000, -999)).toBe(false);
      expect(momentReady(kind, from, 1000, -999)).toBe(true);
      expect(momentReady(kind, from, 1000, 1000 - gap + 1)).toBe(false);
      expect(momentReady(kind, from, 1000, 1000 - gap)).toBe(true);
      expect(KID_CHANCE[kind]).toBeGreaterThan(0);
      expect(KID_CHANCE[kind]).toBeLessThan(0.1);
    }
  });

  it('een ijsje valt pas als er ijs is, een ballon pas als er ballonnen zijn', () => {
    expect(KID_MOMENT.icecream.from).toBeGreaterThan(FEATURE.icecream);
    expect(KID_MOMENT.coin.from).toBeGreaterThan(FEATURE.icecream);
    expect(KID_MOMENT.balloon.from).toBeGreaterThan(FEATURE.balloon);
    expect(KID_WAIT.icecream).toBeGreaterThanOrEqual(10);
    expect(KID_WAIT.coin).toBeGreaterThanOrEqual(10);
  });

  it('de ballon stijgt eerst langzaam (dan kun je hem vangen) en is daarna weg', () => {
    expect(balloonCatchable(-1)).toBe(false);
    expect(balloonCatchable(0)).toBe(true);
    expect(balloonCatchable(BALLOON_FLY.catchFor - 0.01)).toBe(true);
    expect(balloonCatchable(BALLOON_FLY.catchFor)).toBe(false);
    // genoeg tijd voor een klein kind, en toch niet heel lang
    expect(BALLOON_FLY.catchFor).toBeGreaterThanOrEqual(4);
    expect(BALLOON_FLY.gone).toBeGreaterThan(BALLOON_FLY.catchFor);
    let last = -1;
    for (let t = 0; t <= BALLOON_FLY.gone; t += 0.25) {
      const d = balloonDrift(t);
      expect(d.up).toBeGreaterThan(last);
      last = d.up;
      expect(Math.abs(d.tilt)).toBeLessThanOrEqual(0.25);
    }
    // in de tijd om te vangen blijft hij laag en groot, daarna vliegt hij snel weg en wordt hij klein
    expect(balloonDrift(BALLOON_FLY.catchFor).up).toBeLessThan(2);
    expect(balloonDrift(BALLOON_FLY.catchFor).size).toBe(1);
    expect(balloonDrift(BALLOON_FLY.gone).up).toBeGreaterThan(balloonDrift(BALLOON_FLY.catchFor).up * 2);
    expect(balloonDrift(BALLOON_FLY.gone).size).toBeLessThan(0.1);
  });

  it('een gevangen ballon zweeft rustig terug naar de hand', () => {
    expect(balloonHome(0)).toBe(0);
    expect(balloonHome(BALLOON_FLY.back / 2)).toBeCloseTo(0.5);
    expect(balloonHome(BALLOON_FLY.back)).toBe(1);
    expect(balloonHome(BALLOON_FLY.back + 5)).toBe(1);
  });

  it('elke zin en elk woordje staat er in het Nederlands en in het Engels', () => {
    for (const key of ['say.kid.balloon', 'say.kid.icecream', 'say.kid.coin', 'say.kid.thanks', 'guest.hi']) {
      expect((nl as Record<string, string>)[key], key).toBeTruthy();
      expect((en as Record<string, string>)[key], key).toBeTruthy();
    }
  });
});
