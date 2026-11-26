import { describe, expect, it } from 'vitest';
import { DECOR, LIGHT } from './data';
import en from './en.json';
import nl from './nl.json';
import {
  LAMP, LAMPS, LEAF, SNOW, bigPile, isLamp, joinPile, leafSpot, meltLeft, nearest, pileSize, rolled, seasonActs, snowScale, stackUp, waveColor, waveDue, waveLength,
} from './parkfun';
import { STAR_LEAF, starFactors, type StarInput } from './stars';

describe('de actieknop in elk seizoen', () => {
  it('de hark in de herfst, sneeuw in de winter, en niets voor de seizoenen meedoen', () => {
    expect(seasonActs('autumn', true)).toEqual(['rake']);
    expect(seasonActs('winter', true)).toEqual(['snowball']);
    expect(seasonActs('spring', true)).toEqual([]);
    expect(seasonActs('summer', true)).toEqual([]);
    expect(seasonActs('autumn', false)).toEqual([]);
  });

  it('elke knop heeft een naam in het Nederlands en het Engels', () => {
    for (const act of ['rake', 'snowball']) {
      expect((nl as Record<string, string>)[`action.${act}`]).toBeTruthy();
      expect((en as Record<string, string>)[`action.${act}`]).toBeTruthy();
    }
  });
});

describe('blaadjes harken', () => {
  it('blaadjes vallen vlak bij de boom, niet erop en niet ver weg', () => {
    for (let i = 0; i < 50; i++) {
      const [gx, gy] = leafSpot([5.5, 5.5], Math.random(), Math.random());
      const d = Math.hypot(gx - 5.5, gy - 5.5);
      expect(d).toBeGreaterThanOrEqual(LEAF.close - 1e-9);
      expect(d).toBeLessThanOrEqual(LEAF.spread + 1e-9);
    }
  });

  it('het dichtstbijzijnde plekje binnen bereik, of niets', () => {
    const list = [{ gx: 1, gy: 1 }, { gx: 2, gy: 1 }, { gx: 5, gy: 5 }];
    expect(nearest(list, 1.8, 1, 0.5)).toBe(list[1]);
    expect(nearest(list, 3.5, 3.5, 0.5)).toBeNull();
  });

  it('een hoop groeit met elk plekje en schuift naar het midden van de blaadjes', () => {
    let pile = { gx: 0, gy: 0, n: 1 };
    pile = joinPile(pile, 1, 0);
    expect(pile).toEqual({ gx: 0.5, gy: 0, n: 2 });
    pile = joinPile(pile, 0.5, 3);
    expect(pile.n).toBe(3);
    expect(pile.gy).toBeCloseTo(1);
  });

  it('pas een grote hoop is om in te springen, en een grote hoop is groter', () => {
    expect(bigPile(LEAF.big - 1)).toBe(false);
    expect(bigPile(LEAF.big)).toBe(true);
    expect(pileSize(LEAF.big)).toBeGreaterThan(pileSize(1));
    expect(pileSize(1000)).toBeLessThanOrEqual(1.25);
  });

  it('blaadjes op het pad maken het park een beetje minder schoon', () => {
    const park: StarInput = { animals: 8, happyAnimals: 8, guests: 10, happyGuests: 10, litter: 0, poops: 2, dirty: 0, kinds: 4, decor: 4, shopKinds: 3, decorOpen: true };
    const clean = starFactors(park).clean, leafy = starFactors({ ...park, leaves: 20 }).clean;
    expect(leafy).toBeLessThan(clean);
    // maar niet zo erg als afval: twintig plekjes zijn minder dan twintig stuks afval
    expect(leafy).toBeGreaterThan(starFactors({ ...park, litter: 20 }).clean);
    expect(STAR_LEAF).toBeLessThan(1);
    // zonder blaadjes (een ouder spel, of geen herfst) blijft alles zoals het was
    expect(starFactors({ ...park, leaves: 0 })).toEqual(starFactors(park));
  });
});

describe('een sneeuwpop bouwen', () => {
  it('de bal groeit met rollen, maar niet eindeloos', () => {
    expect(rolled(SNOW.r0, 0)).toBe(SNOW.r0);
    expect(rolled(SNOW.r0, 1)).toBeCloseTo(SNOW.r0 + SNOW.grow);
    expect(rolled(SNOW.r0, -3)).toBe(SNOW.r0);
    expect(rolled(SNOW.r0, 100)).toBe(SNOW.r1);
  });

  it('drie tikken: de middelste bal, het hoofd en dan is hij af', () => {
    let stage = stackUp(0);
    expect(stage).toBe(1);
    stage = stackUp(stackUp(stage));
    expect(stage).toBe(3);
    expect(stackUp(3)).toBe(3);
  });

  it('een volle bal is zo groot als de sneeuwpop uit de winkel', () => {
    expect(snowScale(0.27)).toBeCloseTo(1);
    expect(snowScale(SNOW.r0)).toBeLessThan(snowScale(SNOW.r1));
  });

  it('smelten gaat van helemaal naar niets', () => {
    expect(meltLeft(0)).toBe(1);
    expect(meltLeft(SNOW.melt / 2)).toBeCloseTo(0.5);
    expect(meltLeft(SNOW.melt * 2)).toBe(0);
  });

  it('de sjaal heeft een kleur', () => {
    expect(SNOW.scarves.length).toBeGreaterThan(2);
  });
});

describe('lampjes uit en aan', () => {
  it('alleen echte lampen gaan uit en aan, en ze geven allemaal licht', () => {
    for (const kind of LAMPS) {
      expect(isLamp(kind)).toBe(true);
      expect(kind in DECOR).toBe(true);
      expect((LIGHT as Record<string, number>)[kind]).toBeGreaterThan(0);
    }
    expect(isLamp('campfire')).toBe(false);
    expect(isLamp('tree')).toBe(false);
  });

  it('een feestje als alle lampen snel weer aan zijn', () => {
    // drie lampen net aangedaan, alles aan
    expect(waveDue([10, 12, 14], 15, 0, 3)).toBe(true);
    // er is er nog een uit
    expect(waveDue([10, 12, 14], 15, 1, 4)).toBe(false);
    // te lang geleden
    expect(waveDue([10, 12, 14], 10 + LAMP.window + 1, 0, 3)).toBe(false);
    // met twee lampen hoef je er maar twee aan te doen
    expect(waveDue([10, 11], 12, 0, 2)).toBe(true);
    // één lamp aan en uit is nog geen feestje
    expect(waveDue([10], 11, 0, 1)).toBe(false);
    // in een groot park is drie snel aandoen genoeg
    expect(waveDue([10, 11, 12], 13, 0, 20)).toBe(true);
    expect(waveDue([10, 11], 13, 0, 20)).toBe(false);
  });

  it('het golfje gaat van dichtbij naar ver weg, door alle kleuren', () => {
    // vlakbij begint het meteen, verder weg later
    expect(waveColor(0, 0)).toBe(LAMP.colors[0]);
    expect(waveColor(0, 5)).toBeNull();
    expect(waveColor(5 * LAMP.step + 0.01, 5)).toBe(LAMP.colors[0]);
    // aan het eind van zijn beurt heeft de lamp de laatste kleur, en daarna is hij gewoon weer aan
    expect(waveColor(LAMP.flash - 0.01, 0)).toBe(LAMP.colors[LAMP.colors.length - 1]);
    expect(waveColor(LAMP.flash + 0.01, 0)).toBeNull();
    expect(waveLength(10)).toBeCloseTo(10 * LAMP.step + LAMP.flash);
  });
});
