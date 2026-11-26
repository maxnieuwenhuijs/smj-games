import { describe, expect, it } from 'vitest';
import { CARE_ACTIONS, CATCH, DUST, HOSE, TREAT, arcAt, dustAfter, dustSpecks, flightTime, isCare, treatFor, treatReady, dusty } from './care';
import { FEATURE, FOODS, MUD_LOVERS, SPECIES, type SpeciesId } from './data';
import { ICON_IDS } from './icons';
import en from './en.json';
import nl from './nl.json';

const land = { species: 'cow' as SpeciesId, aquatic: false, swimming: false, rolling: false };

describe('snoepje gooien', () => {
  it('elk dier krijgt een snoepje van zijn eigen voer', () => {
    for (const sp of Object.keys(SPECIES) as SpeciesId[]) expect(FOODS).toContain(treatFor(sp));
    expect(treatFor('pig')).toBe('veg');
    expect(treatFor('dolphin')).toBe('fish');
  });

  it('hooguit één snoepje per minuut per dier', () => {
    expect(treatReady(undefined, 0)).toBe(true);
    expect(treatReady(10, 10 + TREAT.every - 1)).toBe(false);
    expect(treatReady(10, 10 + TREAT.every)).toBe(true);
    expect(TREAT.every).toBeGreaterThanOrEqual(30);
  });

  it('het snoepje is lang genoeg onderweg om omhoog te kijken en te springen', () => {
    for (const d of [0, 1, 3, 8, 20]) {
      const s = flightTime(d);
      expect(s - CATCH.up / 2).toBeGreaterThan(0.2);
      expect(s).toBeLessThanOrEqual(1.3);
    }
    expect(flightTime(8)).toBeGreaterThan(flightTime(1));
  });

  it('de boog begint en eindigt op de goede plek en komt boven allebei uit', () => {
    const from: [number, number, number] = [2, 3, 0.5], to: [number, number, number] = [6, 1, 1.2];
    expect(arcAt(from, to, 0, 1)).toEqual(from);
    const end = arcAt(from, to, 1, 1);
    for (let i = 0; i < 3; i++) expect(end[i]).toBeCloseTo(to[i], 6);
    let top = 0;
    for (let p = 0; p <= 1; p += 0.01) top = Math.max(top, arcAt(from, to, p, 1)[2]);
    expect(top).toBeCloseTo(2.2, 2);
    // ook omlaag gooien (naar de grond naast een ziek dier) gaat in een boog
    expect(arcAt([0, 0, 0.5], [2, 0, 0.05], 0.5, 0.7)[2]).toBeGreaterThan(0.5);
  });
});

describe('wassen met de tuinslang', () => {
  it('een dier wordt langzaam stoffig, en nooit meer dan helemaal', () => {
    expect(dustAfter(0, DUST.full / 2, land)).toBeCloseTo(0.5, 5);
    expect(dustAfter(0.9, DUST.full, land)).toBe(1);
    expect(dustSpecks(0)).toBe(0);
    expect(dustSpecks(DUST.shows - 0.01)).toBe(0);
    expect(dustSpecks(DUST.shows)).toBeGreaterThan(0);
    expect(dustSpecks(1)).toBe(6);
  });

  it('een modderliefhebber wordt sneller vies, vooral als hij in de modder rolt', () => {
    expect(MUD_LOVERS).toContain('pig');
    const pig = { ...land, species: 'pig' as SpeciesId };
    expect(dustAfter(0, 60, pig)).toBeGreaterThan(dustAfter(0, 60, land));
    // een keer rollen (een paar tellen) en hij is goed vies
    expect(dustAfter(0, 2.6, { ...pig, rolling: true })).toBeGreaterThanOrEqual(DUST.shows);
    // een koe die rolt, wordt er niet vies van
    expect(dustAfter(0, 2.6, { ...land, rolling: true })).toBeLessThan(DUST.shows);
  });

  it('zwemmen spoelt het stof eraf, en een zeedier wordt nooit stoffig', () => {
    expect(dustAfter(0.8, 0.1, { ...land, swimming: true })).toBe(0);
    expect(dustAfter(0, 1000, { ...land, species: 'dolphin', aquatic: true })).toBe(0);
  });

  it('even loslaten mag: het dier blijft langer nat dan het wassen duurt', () => {
    expect(HOSE.keep).toBeGreaterThan(HOSE.soak);
    expect(HOSE.mudBack[0]).toBeLessThan(HOSE.mudBack[1]);
  });
});

describe('snoepje en slang bij de actieknop', () => {
  it('het snoepje komt vroeg (level 2), de slang pas vanaf level 20', () => {
    expect(FEATURE.treat).toBe(1);
    expect(FEATURE.hose).toBe(19);
  });

  it('elke keuze heeft een plaatje en een naam', () => {
    for (const k of CARE_ACTIONS) {
      expect(isCare(k)).toBe(true);
      expect(ICON_IDS).toContain(k);
      expect((nl as Record<string, string>)[`action.${k}`]).toBeTruthy();
      expect((en as Record<string, string>)[`action.${k}`]).toBeTruthy();
    }
    expect(isCare('broom')).toBe(false);
  });
});

describe('stof: wanneer een dier gewassen wil worden', () => {
  it('pas als het echt stoffig is, en je ziet de stofjes al eerder', () => {
    expect(dusty(DUST.dirty)).toBe(true);
    expect(dusty(DUST.dirty - 0.01)).toBe(false);
    expect(DUST.shows).toBeLessThan(DUST.dirty);
    expect(DUST.dirty).toBeLessThan(1);
  });
});
