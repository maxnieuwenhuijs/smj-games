import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { DAY_TABLE, dayLook, luma, newLook, type RGB } from './daylight';
import { HAZE } from './sky';

const look = (hour: number, season: 'spring' | 'summer' | 'autumn' | 'winter' = 'summer', sky = 0xbfe6ff) => dayLook(hour, sky, season, newLook());
const hex = (c: RGB): number => (Math.round(c[0] * 255) << 16) | (Math.round(c[1] * 255) << 8) | Math.round(c[2] * 255);
/** Hoe warm een kleur is: rood min blauw. */
const warmth = (c: RGB): number => c[0] - c[2];

describe('licht en lucht per uur', () => {
  it("'s middags is het precies het oude beeld: witte zon, de lucht van de wereld", () => {
    const l = look(13);
    expect(hex(l.sun)).toBe(0xfff4dd);
    expect(hex(l.hemi)).toBe(0xffffff);
    expect(l.sunK).toBeCloseTo(1);
    expect(l.hemiK).toBeCloseTo(1);
    expect(hex(l.horizon)).toBe(0xbfe6ff);
    expect(hex(look(13, 'summer', 0xffe6bd).horizon)).toBe(0xffe6bd);
  });

  it("'s ochtends en 's avonds is de zon warmer, 's nachts koel blauw", () => {
    const noon = warmth(look(13).sun);
    expect(warmth(look(8).sun)).toBeGreaterThan(noon + 0.1);
    expect(warmth(look(19).sun)).toBeGreaterThan(noon + 0.1);
    const night = look(23).sun;
    expect(night[2]).toBeGreaterThan(night[0]);
    // de horizon: roze-oranje in de ochtend, goud in de avond, donkerblauw in de nacht
    expect(warmth(look(7.5).horizon)).toBeGreaterThan(0.1);
    expect(warmth(look(19).horizon)).toBeGreaterThan(0.1);
    expect(luma(look(23).horizon)).toBeLessThan(0.1);
  });

  it('de lucht is bovenin dieper blauw dan bij de horizon', () => {
    for (const h of [8, 13, 19, 23]) {
      const l = look(h);
      expect(luma(l.top)).toBeLessThan(luma(l.horizon));
    }
  });

  it('het licht wordt nooit veel donkerder dan de middag (de nacht doet de rest)', () => {
    const noon = look(13);
    const sun0 = noon.sunK * luma(noon.sun), hemi0 = noon.hemiK * luma(noon.hemi);
    for (let h = 0; h < 24; h += 0.25) {
      for (const s of ['summer', 'autumn', 'winter'] as const) {
        const l = look(h, s);
        expect(l.sunK * luma(l.sun)).toBeGreaterThan(0.75 * sun0);
        expect(l.hemiK * luma(l.hemi)).toBeGreaterThan(0.85 * hemi0);
        expect(l.sunK * luma(l.sun)).toBeLessThan(1.05 * sun0);
      }
    }
  });

  it('loopt zacht over: geen sprongen (view.ts rekent opnieuw per 0,02 uur), en om middernacht sluit het rond', () => {
    let prev = look(0);
    for (let h = 0.02; h <= 24; h += 0.02) {
      const l = look(h);
      for (const k of ['sun', 'hemi', 'horizon', 'top'] as const) for (let c = 0; c < 3; c++) expect(Math.abs(l[k][c] - prev[k][c])).toBeLessThan(0.03);
      prev = l;
    }
    expect(look(24)).toEqual(look(0));
    expect(look(-1)).toEqual(look(23));
    expect(DAY_TABLE[0].h).toBe(0);
    expect(DAY_TABLE[DAY_TABLE.length - 1].h).toBe(24);
  });

  it('de herfst is iets warmer en de winter iets koeler, even fel', () => {
    const summer = look(13).sun, autumn = look(13, 'autumn'), winter = look(13, 'winter');
    expect(warmth(autumn.sun)).toBeGreaterThan(warmth(summer));
    expect(warmth(winter.sun)).toBeLessThan(warmth(summer));
    expect(autumn.sunK * luma(autumn.sun)).toBeCloseTo(luma(summer), 3);
  });

  it('het waas zit in de mist van Three.js, en begint pas buiten het park', () => {
    expect(THREE.ShaderChunk.fog_fragment).toContain('hazeOut');
    expect(THREE.ShaderChunk.fog_vertex).toContain('vFogXZ');
    expect(HAZE.near).toBeGreaterThan(0);
    expect(HAZE.far).toBeGreaterThan(HAZE.near);
  });
});
