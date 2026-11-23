import { describe, expect, it } from 'vitest';
import { CABLE, cableAt, cableChairs, cableFit, cableHeight, cableLoop, cableOpen, cablePairs, cablePassed, cablePoles, cableStop, type CableEnd } from './cable';

describe('kabelbaan: waar het tweede huisje mag staan', () => {
  it('in een rechte lijn, niet te dichtbij en niet te ver', () => {
    const a = { x: 10, y: 10 };
    expect(cableFit(a, { x: 10 + CABLE.min, y: 10 })).toBe('ok');
    expect(cableFit(a, { x: 10, y: 10 - CABLE.max })).toBe('ok');
    expect(cableFit(a, { x: 10 - 8, y: 10 })).toBe('ok');
    expect(cableFit(a, { x: 16, y: 12 })).toBe('line');
    expect(cableFit(a, { x: 10 + CABLE.min - 1, y: 10 })).toBe('near');
    expect(cableFit(a, { x: 10, y: 10 + CABLE.max + 1 })).toBe('far');
    // de huisjes zijn 2 bij 2: ze raken elkaar nooit
    expect(CABLE.min).toBeGreaterThanOrEqual(3);
  });

  it('twee huisjes horen bij elkaar als ze naar elkaar wijzen; het laatste losse huisje wacht op zijn maatje', () => {
    const a: CableEnd = { x: 4, y: 6, link: [8, 0] }, b: CableEnd = { x: 12, y: 6, link: [-8, 0] };
    const c: CableEnd = { x: 4, y: 12 };
    expect(cablePairs([a, b, c])).toEqual([[a, b]]);
    expect(cableOpen([a, b, c])).toBe(c);
    expect(cableOpen([a, b])).toBeNull();
    // het maatje is weggehaald: dan wacht het overgebleven huisje weer
    expect(cablePairs([a, c])).toEqual([]);
    expect(cableOpen([a, c])).toBe(c);
    expect(cableOpen([a])).toBe(a);
    // wijst maar één van de twee, of past de kabel niet (scheef), dan is het geen paar
    expect(cablePairs([a, { x: 12, y: 6 }])).toEqual([]);
    expect(cablePairs([{ x: 4, y: 6, link: [8, 2] }, { x: 12, y: 8, link: [-8, -2] }])).toEqual([]);
  });
});

describe('kabelbaan: de kabel, de palen en de stoeltjes', () => {
  it('de kabel hangt laag in de huisjes en hoog boven het park', () => {
    for (let len = CABLE.min; len <= CABLE.max; len++) {
      expect(cableHeight(0, len)).toBeCloseTo(CABLE.low);
      expect(cableHeight(len, len)).toBeCloseTo(CABLE.low);
      // binnen het huisje (een tegel van het midden) blijft hij laag
      expect(cableHeight(0.9, len)).toBeCloseTo(CABLE.low);
      expect(cableHeight(len / 2, len)).toBeCloseTo(CABLE.high);
      for (let t = 0; t <= len; t += 0.25) {
        expect(cableHeight(t, len)).toBeGreaterThanOrEqual(CABLE.low - 1e-9);
        expect(cableHeight(t, len)).toBeLessThanOrEqual(CABLE.high + 1e-9);
      }
    }
  });

  it('palen staan tussen de huisjes, niet te ver uit elkaar, waar de kabel hoog is', () => {
    for (let len = CABLE.min; len <= CABLE.max; len++) {
      const poles = cablePoles(len);
      expect(poles.length, `${len}`).toBeGreaterThanOrEqual(1);
      expect([...poles].sort((p, q) => p - q)).toEqual(poles);
      for (const t of poles) {
        expect(t).toBeGreaterThanOrEqual(1.5);
        expect(t).toBeLessThanOrEqual(len - 1.5);
      }
      for (let i = 1; i < poles.length; i++) {
        expect(poles[i] - poles[i - 1]).toBeLessThanOrEqual(CABLE.poleGap + 1e-9);
        expect(poles[i] - poles[i - 1]).toBeGreaterThanOrEqual(1.5);
      }
      expect(cableHeight(poles[0], len)).toBeGreaterThan(CABLE.low + 1);
    }
    expect(cablePoles(5)).toEqual([2.5]);
    expect(cablePoles(14).length).toBe(4);
  });

  it('de stoeltjes gaan heen aan de ene kant en terug aan de andere, en de lus is rond', () => {
    for (const len of [CABLE.min, 9, CABLE.max]) {
      const L = cableLoop(len);
      const start = cableAt(len, 0);
      expect(start.a).toBeCloseTo(0);
      expect(start.side).toBeCloseTo(CABLE.r);
      expect([start.mx, start.mz]).toEqual([1, 0]);
      // halverwege de heenweg: midden boven het park, aan de + kant
      const out = cableAt(len, len / 2);
      expect(out.side).toBeCloseTo(CABLE.r);
      expect(out.h).toBeCloseTo(CABLE.high);
      // halverwege de terugweg: aan de - kant, de andere kant op
      const back = cableAt(len, len + Math.PI * CABLE.r + len / 2);
      expect(back.a).toBeCloseTo(len / 2);
      expect(back.side).toBeCloseTo(-CABLE.r);
      expect(back.mx).toBe(-1);
      // geen sprongen: elke kleine stap langs de lus is een kleine stap in het park
      for (let s = 0; s < L; s += 0.05) {
        const p = cableAt(len, s), q = cableAt(len, s + 0.05);
        expect(Math.hypot(q.a - p.a, q.side - p.side), `${len} bij ${s}`).toBeLessThan(0.06);
        expect(Math.hypot(p.mx, p.mz)).toBeCloseTo(1);
      }
      // na een hele lus ben je weer bij het begin
      expect(cableAt(len, L).a).toBeCloseTo(0);
      expect(cableAt(len, L + 1).a).toBeCloseTo(1);
      expect(cableAt(len, -1).a).toBeCloseTo(cableAt(len, L - 1).a);
    }
  });

  it('in- en uitstappen gebeurt bij het wiel van elk huisje, laag bij de grond', () => {
    for (const len of [CABLE.min, 11, CABLE.max]) {
      const far = cableAt(len, cableStop(len, 1)), near = cableAt(len, cableStop(len, 0));
      expect(far.a).toBeCloseTo(len + CABLE.r);
      expect(far.side).toBeCloseTo(0);
      expect(near.a).toBeCloseTo(-CABLE.r);
      expect(near.side).toBeCloseTo(0);
      expect(far.h).toBeCloseTo(CABLE.low);
      expect(near.h).toBeCloseTo(CABLE.low);
      // het stoeltje hangt dan net boven het perron
      expect(CABLE.low - CABLE.hang).toBeGreaterThan(0.25);
      expect(CABLE.low - CABLE.hang).toBeLessThan(0.6);
    }
  });

  it('een stoeltje komt langs een punt, ook als de lus net weer rond is', () => {
    expect(cablePassed(1, 2, 1.5, 10)).toBe(true);
    expect(cablePassed(1, 2, 2.5, 10)).toBe(false);
    expect(cablePassed(9.8, 10.3, 0.1, 10)).toBe(true);
    expect(cablePassed(9.8, 10.3, 9.9, 10)).toBe(true);
    expect(cablePassed(9.8, 10.3, 5, 10)).toBe(false);
    expect(cablePassed(3, 3, 3, 10)).toBe(false);
  });

  it('vier tot acht stoeltjes, meer bij een lange kabel', () => {
    for (let len = CABLE.min; len <= CABLE.max; len++) {
      expect(cableChairs(len)).toBeGreaterThanOrEqual(4);
      expect(cableChairs(len)).toBeLessThanOrEqual(8);
      if (len > CABLE.min) expect(cableChairs(len)).toBeGreaterThanOrEqual(cableChairs(len - 1));
    }
    expect(cableChairs(CABLE.min)).toBe(4);
    expect(cableChairs(CABLE.max)).toBe(8);
  });
});
