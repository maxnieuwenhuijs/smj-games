import { describe, expect, it } from 'vitest';
import en from './en.json';
import nl from './nl.json';
import { STAR_EVERY, STAR_FACTORS, STAR_GUESTS, nextStars, parkScore, scoreOf, smoothScore, starFactors, starGuests, starsAt, weakest, type StarInput } from './stars';

/** Een klein park uit de eerste levels: twee soorten, blije dieren, een paar kramen en nog geen versiering. */
const farm: StarInput = { animals: 4, happyAnimals: 4, guests: 8, happyGuests: 5, litter: 0, poops: 2, dirty: 0, kinds: 2, decor: 0, shopKinds: 2, decorOpen: false };
/** Een groot park dat heel goed verzorgd is. */
const best: StarInput = { animals: 30, happyAnimals: 30, guests: 60, happyGuests: 56, litter: 0, poops: 3, dirty: 0, kinds: 10, decor: 12, shopKinds: 7, decorOpen: true };

describe('sterren van het park', () => {
  it('een klein, verzorgd park uit de eerste levels heeft makkelijk 3 sterren', () => {
    expect(starsAt(parkScore(farm))).toBeGreaterThanOrEqual(3);
    // ook als nog niet alle gasten blij zijn
    expect(starsAt(parkScore({ ...farm, happyGuests: 3 }))).toBeGreaterThanOrEqual(3);
    // nog geen gasten of dieren telt als redelijk goed
    expect(starsAt(parkScore({ ...farm, guests: 0, happyGuests: 0 }))).toBeGreaterThanOrEqual(3);
  });

  it('5 sterren vraagt een heel goed verzorgd park', () => {
    expect(starsAt(parkScore(best))).toBe(5);
    expect(starsAt(parkScore(farm))).toBeLessThan(5);
    expect(starsAt(parkScore({ ...best, happyGuests: 40 }))).toBeLessThan(5);
    expect(starsAt(parkScore({ ...best, happyAnimals: 24 }))).toBeLessThan(5);
    expect(starsAt(parkScore({ ...best, litter: 8, poops: 20 }))).toBeLessThan(5);
  });

  it('elk ding dat beter gaat, geeft een hogere score', () => {
    const base: StarInput = { ...best, happyAnimals: 15, happyGuests: 30, litter: 4, poops: 10, kinds: 3, decor: 1, shopKinds: 2 };
    for (const better of [{ happyAnimals: 25 }, { happyGuests: 50 }, { litter: 0, poops: 0 }, { kinds: 6 }, { decor: 6 }, { dirty: 0 }])
      expect(parkScore({ ...base, ...better }), JSON.stringify(better)).toBeGreaterThanOrEqual(parkScore(base));
    expect(parkScore({ ...base, dirty: 3 })).toBeLessThan(parkScore(base));
  });

  it('alles ligt tussen 0 en 1, ook bij een leeg park', () => {
    const empty: StarInput = { animals: 0, happyAnimals: 0, guests: 0, happyGuests: 0, litter: 0, poops: 0, dirty: 0, kinds: 0, decor: 0, shopKinds: 0, decorOpen: false };
    for (const p of [empty, farm, best, { ...best, litter: 99, poops: 99, dirty: 9 }]) {
      for (const v of Object.values(starFactors(p))) expect(v >= 0 && v <= 1).toBe(true);
      const s = parkScore(p);
      expect(s >= 0 && s <= 1).toBe(true);
    }
  });

  it('er gaat hooguit één ster tegelijk bij of af, en vlak bij de grens blijft het hetzelfde', () => {
    for (let now = 1; now <= 5; now++)
      for (let score = 0; score <= 1; score += 0.01) {
        const next = nextStars(score, now);
        expect(Math.abs(next - now)).toBeLessThanOrEqual(1);
        expect(next >= 1 && next <= 5).toBe(true);
      }
    // net op de grens van 4 sterren: van 3 gaat het nog niet omhoog, van 4 nog niet omlaag
    expect(nextStars(0.78, 3)).toBe(3);
    expect(nextStars(0.78, 4)).toBe(4);
    expect(nextStars(0.85, 3)).toBe(4);
    expect(nextStars(0.7, 4)).toBe(3);
    // een opgeslagen park begint midden in zijn eigen sterren
    for (let n = 1; n <= 5; n++) {
      expect(starsAt(scoreOf(n))).toBe(n);
      expect(nextStars(scoreOf(n), n)).toBe(n);
    }
  });

  it('de score volgt rustig: één slecht moment kost niet meteen een ster', () => {
    let score = scoreOf(4);
    for (let t = 0; t < STAR_EVERY; t += 0.4) score = smoothScore(score, 0.2, 0.4);
    // na twintig tellen een heel rommelig park is het park niet meer dan één ster gezakt
    expect(nextStars(score, 4)).toBeGreaterThanOrEqual(3);
    // blijft het lang goed, dan komt de score er wel
    for (let t = 0; t < 300; t += 0.4) score = smoothScore(score, 0.97, 0.4);
    expect(score).toBeGreaterThan(0.94);
  });

  it('meer sterren geven meer gasten, en in de eerste levels nooit minder dan zonder sterren', () => {
    for (let n = 2; n <= 5; n++) expect(starGuests(n, 30)).toBeGreaterThan(starGuests(n - 1, 30));
    expect(starGuests(3, 30)).toBe(1);
    expect(starGuests(1, 30)).toBeLessThan(1);
    expect(starGuests(1, 30)).toBeGreaterThanOrEqual(0.85);
    expect(starGuests(5, 30)).toBeLessThanOrEqual(1.25);
    for (let level = 0; level < 10; level++) for (let n = 1; n <= 5; n++) expect(starGuests(n, level)).toBeGreaterThanOrEqual(1);
    expect(STAR_GUESTS).toHaveLength(5);
  });

  it('de tip gaat over wat het meeste sterren kost, en nooit over versiering die je nog niet kunt kopen', () => {
    expect(weakest({ ...best, happyAnimals: 5 })).toBe('animals');
    expect(weakest({ ...best, happyGuests: 5 })).toBe('guests');
    expect(weakest({ ...best, litter: 20, poops: 30 })).toBe('clean');
    expect(weakest({ ...best, kinds: 1 })).toBe('kinds');
    expect(weakest({ ...best, decor: 0, shopKinds: 0 })).toBe('pretty');
    expect(weakest({ ...best, decor: 0, shopKinds: 0, decorOpen: false })).not.toBe('pretty');
  });

  it('elk ding heeft een naam en een tip, in het Nederlands en in het Engels', () => {
    for (const table of [nl, en] as Record<string, string>[]) {
      expect(table.stars).toBeTruthy();
      for (const k of STAR_FACTORS) {
        expect(table[`stars.${k}`], k).toBeTruthy();
        expect(table[`say.stars.tip.${k}`], k).toBeTruthy();
      }
      for (let n = 2; n <= 5; n++) expect(table[`say.stars.${n}`]).toContain(String(n));
    }
  });
});
