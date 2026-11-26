import { describe, expect, it } from 'vitest';
import {
  CABLE, CABLE_CORNERS, CABLE_DECK, cableAt, cableChairs, cableClear, cableCut, cableDrafts, cableFit, cableHeight, cableLoop, cableOpen, cablePairs, cablePassed, cablePath, cablePoles,
  cablePosts, cableRoute, cableSlot, cableSpot, cableStop, cableTurn, cableValid, cableWait, type CableEnd, type P2,
} from './cable';

/** Een rechte kabel van `len` tegels langs de x-as: het eenvoudigste pad. */
const line = (len: number) => cablePath([[0, 0], [len, 0]]);
/** Past een tweede huisje (linkerbovenhoek `b`) bij huisje `a`, zonder tussenpalen? */
const fits = (a: { x: number; y: number }, b: { x: number; y: number }) => cableFit([cableSpot(a)], cableSpot(b), true);

describe('kabelbaan: waar het tweede huisje mag staan', () => {
  it('in elke richting, niet te dichtbij en niet te ver', () => {
    const a = { x: 10, y: 10 };
    expect(fits(a, { x: 10 + CABLE.min, y: 10 })).toBe('ok');
    expect(fits(a, { x: 10, y: 10 - CABLE.max })).toBe('ok');
    expect(fits(a, { x: 10 - 8, y: 10 })).toBe('ok');
    // schuin mag ook
    expect(fits(a, { x: 16, y: 12 })).toBe('ok');
    expect(fits(a, { x: 3, y: 17 })).toBe('ok');
    expect(fits(a, { x: 10 + CABLE.min - 1, y: 10 })).toBe('near');
    expect(fits(a, { x: 13, y: 13 })).toBe('near');
    expect(fits(a, { x: 10, y: 10 + CABLE.max + 1 })).toBe('far');
    expect(fits(a, { x: 20, y: 20 })).toBe('far');
    // de huisjes zijn 2 bij 2: ze raken elkaar nooit
    expect(CABLE.min).toBeGreaterThanOrEqual(3);
  });

  it('twee huisjes horen bij elkaar als ze naar elkaar wijzen; het laatste losse huisje wacht op zijn maatje', () => {
    const a: CableEnd = { x: 4, y: 6, link: [8, 0] }, b: CableEnd = { x: 12, y: 6, link: [-8, 0] };
    const c: CableEnd = { x: 4, y: 12 };
    expect(cablePairs([a, b, c])).toEqual([[a, b]]);
    expect(cableOpen([a, b, c])?.from).toBe(c);
    expect(cableOpen([a, b])).toBeNull();
    // het maatje is weggehaald: dan wacht het overgebleven huisje weer
    expect(cablePairs([a, c])).toEqual([]);
    expect(cableOpen([a, c])?.from).toBe(c);
    expect(cableOpen([a])?.from).toBe(a);
    // wijst maar één van de twee, of past de kabel niet (te dichtbij, te ver), dan is het geen paar
    expect(cablePairs([a, { x: 12, y: 6 }])).toEqual([]);
    expect(cablePairs([{ x: 4, y: 6, link: [3, 2] }, { x: 7, y: 8, link: [-3, -2] }])).toEqual([]);
    expect(cablePairs([{ x: 4, y: 6, link: [15, 2] }, { x: 19, y: 8, link: [-15, -2] }])).toEqual([]);
    // schuin is wel een paar
    expect(cablePairs([{ x: 4, y: 6, link: [8, 2] }, { x: 12, y: 8, link: [-8, -2] }])).toHaveLength(1);
  });
});

describe('kabelbaan: tussenpalen', () => {
  const house: P2 = [11, 11];

  it('een paal staat niet te dicht bij een huisje of een andere paal, en niet te ver weg', () => {
    // vanaf een huisje: de kabel moet eerst omhoog
    expect(cableFit([house], [14.5, 11.5], false)).toBe('near');
    expect(cableFit([house], [15.5, 11.5], false)).toBe('ok');
    expect(cableFit([house], [14.5, 13.5], false)).toBe('ok');
    expect(cableFit([house], [11.5, 25.5], false)).toBe('far');
    // tussen twee palen mag het korter
    const pts: P2[] = [house, [15.5, 11.5]];
    expect(cableFit(pts, [16.5, 12.5], false)).toBe('near');
    expect(cableFit(pts, [17.5, 11.5], false)).toBe('ok');
    expect(cableFit(pts, [17.5, 12.5], false)).toBe('ok');
    expect(cableFit(pts, [30.5, 11.5], false)).toBe('far');
    // en het huisje aan het eind staat weer een stuk van de laatste paal af
    expect(cableFit(pts, [18, 12], true)).toBe('near');
    expect(cableFit(pts, [20, 12], true)).toBe('ok');
    expect(CABLE.near).toBeGreaterThan(1 + CABLE.ramp);
    expect(CABLE.span).toBeLessThan(CABLE.near);
  });

  it('de bocht bij een paal mag niet terug over zichzelf', () => {
    expect(cableTurn([0, 0], [4, 0], [8, 0])).toBeCloseTo(0);
    expect(cableTurn([0, 0], [4, 0], [4, 5])).toBeCloseTo(90);
    expect(cableTurn([0, 0], [4, 0], [0, 0])).toBeCloseTo(180);
    const pts: P2[] = [house, [16.5, 11.5]];
    // rechtdoor, de hoek om en een stukje terug: goed; echt terug: niet
    expect(cableFit(pts, [20.5, 11.5], false)).toBe('ok');
    expect(cableFit(pts, [16.5, 15.5], false)).toBe('ok');
    expect(cableFit(pts, [15.5, 16.5], false)).toBe('ok');
    expect(cableFit(pts, [13.5, 14.5], false)).toBe('bend');
    expect(cableFit(pts, [12.5, 11.5], false)).toBe('bend');
    expect(CABLE.bend).toBeGreaterThanOrEqual(90);
    expect(CABLE.bend).toBeLessThan(135);
  });

  it('een hele kabel klopt als elk stuk en elke bocht klopt', () => {
    expect(cableValid([[0, 0], [8, 0]])).toBe(true);
    expect(cableValid([[0, 0], [4, 0]])).toBe(false);
    expect(cableValid([[0, 0], [4.5, 0.5], [6.5, 2.5], [8.5, 0.5], [13, 1]])).toBe(true);
    // de laatste paal staat te dicht bij het eindhuisje; in aanbouw (zonder eindhuisje) mag het wel
    expect(cableValid([[0, 0], [4.5, 0.5], [7, 1]])).toBe(false);
    expect(cableValid([[0, 0], [4.5, 0.5], [6.5, 0.5]], true)).toBe(true);
    expect(cableValid([[0, 0]], true)).toBe(true);
    // een te scherpe bocht
    expect(cableValid([[0, 0], [4.5, 0.5], [2.5, 2.5], [2, 8]])).toBe(false);
    // bij een tussenstation telt de kabel die er al hangt mee, aan allebei de kanten
    expect(cableValid([[0, 0], [8, 0]], false, [8, 0])).toBe(false);
    expect(cableValid([[0, 0], [8, 0]], false, [-8, 0])).toBe(true);
    expect(cableValid([[0, 0], [8, 0]], false, undefined, [0, 0])).toBe(false);
    expect(cableValid([[0, 0], [8, 0]], false, undefined, [8, 8])).toBe(true);
  });

  it('de palen staan bewaard bij een van de twee huisjes, op volgorde vanaf dat huisje', () => {
    const a: CableEnd = { x: 10, y: 10, link: [12, 6], via: [[5, 1], [8, 3]] }, b: CableEnd = { x: 22, y: 16, link: [-12, -6] };
    const route: P2[] = [[11, 11], [15.5, 11.5], [18.5, 13.5], [23, 17]];
    expect(cableRoute(a, b)).toEqual(route);
    expect(cableRoute(b, a)).toEqual([...route].reverse());
    expect(cablePairs([a, b])).toEqual([[a, b]]);
    expect(cablePairs([b, a])).toEqual([[b, a]]);
    // een paal die er niet tussen past: geen kabelbaan
    expect(cablePairs([{ ...a, via: [[5, 1], [-3, 3]] }, b])).toEqual([]);
    // zonder palen is het gewoon een rechte kabel
    expect(cableRoute({ x: 0, y: 0, link: [8, 0] }, { x: 8, y: 0, link: [-8, 0] })).toEqual([[1, 1], [9, 1]]);
  });

  it('bouwen: de palen van het stuk in aanbouw staan bij het huisje dat wacht', () => {
    const a: CableEnd = { x: 10, y: 10 };
    expect(cableOpen([a], { x: 15, y: 10 }, true)).toEqual({ from: a, slot: 'link', pts: [[11, 11]], before: undefined });
    a.via = [[5, 0]];
    const open = cableOpen([a], { x: 18, y: 12 })!;
    expect(open.pts).toEqual([[11, 11], [15.5, 10.5]]);
    expect(cableDrafts([a])).toEqual([[[11, 11], [15.5, 10.5]]]);
    // het eindhuisje erbij: nu is het een kabelbaan en is er niets meer in aanbouw
    const b: CableEnd = { x: 19, y: 12, link: [-9, -2] };
    a.link = [9, 2];
    expect(cablePairs([a, b])).toHaveLength(1);
    expect(cableDrafts([a, b])).toEqual([]);
    expect(cableOpen([a, b])).toBeNull();
  });

  it('een huisje weg: zijn kabels en hun palen gaan mee', () => {
    const a: CableEnd = { x: 0, y: 0, link: [10, 0], via: [[5, 0]] }, b: CableEnd = { x: 10, y: 0, link: [-10, 0], link2: [0, 12], via2: [[0, 5], [1, 8]] };
    const c: CableEnd = { x: 10, y: 12, link: [0, -12] };
    expect(cablePairs([a, b, c])).toHaveLength(2);
    // het tussenstation weg: drie palen, en de twee huisjes die blijven wachten weer zonder palen
    const ends = [a, b, c].map(e => ({ ...e }));
    expect(cableCut(ends, ends[1])).toBe(3);
    expect(ends[0]).toEqual({ x: 0, y: 0 });
    expect(ends[2]).toEqual({ x: 10, y: 12 });
    // een eindhuisje weg: alleen zijn eigen kabel
    const rest = [a, b, c].map(e => ({ ...e }));
    expect(cableCut(rest, rest[0])).toBe(1);
    expect(rest[1].link).toBeUndefined();
    expect(rest[1].link2).toEqual([0, 12]);
    expect(cablePairs([rest[1], rest[2]])).toHaveLength(1);
    // palen van een stuk in aanbouw tellen ook mee
    expect(cableCut([{ x: 0, y: 0, via: [[5, 0], [8, 0]] }], { x: 0, y: 0, via: [[5, 0], [8, 0]] })).toBe(2);
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
        // en de stoeltjes hangen even hoog als de kabel
        expect(cableAt(line(len), t).h).toBeCloseTo(cableHeight(t, len));
      }
    }
  });

  it('palen staan tussen de huisjes, niet te ver uit elkaar, waar de kabel hoog is', () => {
    for (let len = CABLE.min; len <= CABLE.max; len++) {
      const poles = cablePoles(line(len)).map(p => p.gx);
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
      // de paal is zo hoog als de kabel daar hangt, en zijn dwarsbalk ligt dwars op de kabel
      for (const p of cablePoles(line(len))) {
        expect(p.h).toBeCloseTo(cableHeight(p.gx, len));
        expect([p.gy, p.ax, p.ay]).toEqual([0, -0, 1]);
      }
    }
    expect(cablePoles(line(5)).map(p => p.gx)).toEqual([2.5]);
    expect(cablePoles(line(14)).length).toBe(4);
  });

  it('de stoeltjes gaan heen aan de ene kant en terug aan de andere, en de lus is rond', () => {
    for (const len of [CABLE.min, 9, CABLE.max]) {
      const path = line(len), L = cableLoop(len);
      expect(path.len).toBeCloseTo(len);
      expect(path.loop).toBeCloseTo(L);
      const start = cableAt(path, 0);
      expect(start.gx).toBeCloseTo(0);
      expect(start.gy).toBeCloseTo(CABLE.r);
      expect([start.mx, start.my]).toEqual([1, 0]);
      // halverwege de heenweg: midden boven het park, aan de + kant
      const out = cableAt(path, len / 2);
      expect(out.gy).toBeCloseTo(CABLE.r);
      expect(out.h).toBeCloseTo(CABLE.high);
      // halverwege de terugweg: aan de - kant, de andere kant op
      const back = cableAt(path, len + Math.PI * CABLE.r + len / 2);
      expect(back.gx).toBeCloseTo(len / 2);
      expect(back.gy).toBeCloseTo(-CABLE.r);
      expect(back.mx).toBe(-1);
      // geen sprongen: elke kleine stap langs de lus is een kleine stap in het park
      for (let s = 0; s < L; s += 0.05) {
        const p = cableAt(path, s), q = cableAt(path, s + 0.05);
        expect(Math.hypot(q.gx - p.gx, q.gy - p.gy), `${len} bij ${s}`).toBeLessThan(0.06);
        expect(Math.hypot(p.mx, p.my)).toBeCloseTo(1);
      }
      // na een hele lus ben je weer bij het begin
      expect(cableAt(path, L).gx).toBeCloseTo(0);
      expect(cableAt(path, L + 1).gx).toBeCloseTo(1);
      expect(cableAt(path, -1).gx).toBeCloseTo(cableAt(path, L - 1).gx);
    }
  });

  it('in- en uitstappen gebeurt bij het wiel van elk huisje, laag bij de grond', () => {
    for (const len of [CABLE.min, 11, CABLE.max]) {
      const path = line(len), far = cableAt(path, cableStop(path, 1)), near = cableAt(path, cableStop(path, 0));
      expect(far.gx).toBeCloseTo(len + CABLE.r);
      expect(far.gy).toBeCloseTo(0);
      expect(near.gx).toBeCloseTo(-CABLE.r);
      expect(near.gy).toBeCloseTo(0);
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

  it('een heel lange kabel krijgt meer stoeltjes, maar nooit te veel om te tekenen', () => {
    for (let len = CABLE.max; len <= 400; len++) {
      expect(cableChairs(len)).toBeGreaterThanOrEqual(cableChairs(len - 1));
      expect(cableChairs(len)).toBeLessThanOrEqual(CABLE.chairs);
    }
    expect(cableChairs(30)).toBeGreaterThan(12);
    expect(cableChairs(120)).toBe(CABLE.chairs);
    expect(CABLE.chairs).toBeLessThanOrEqual(24);
  });
});

describe('kabelbaan: schuin en de bocht om', () => {
  /** Een zigzag met drie palen: bochten naar links en naar rechts, ruim en scherp. */
  const zigzag: P2[] = [[11, 11], [15.5, 13.5], [19.5, 11.5], [21.5, 15.5], [27, 17]];
  const routes: P2[][] = [
    [[11, 11], [17, 15]],
    [[11, 11], [5, 4]],
    zigzag,
    [...zigzag].reverse(),
    // een vierkante hoek, en twee scherpe bochten vlak na elkaar
    [[11, 11], [16.5, 11.5], [16.5, 18.5], [12, 23]],
    [[11, 11], [16.5, 11.5], [17.5, 13.5], [15.5, 14.5], [10, 15]],
  ];

  it('een schuine kabel is dezelfde kabel, gedraaid', () => {
    const path = cablePath([[11, 11], [14, 15]]), flat = line(5);
    expect(path.len).toBeCloseTo(5);
    expect(path.loop).toBeCloseTo(cableLoop(5));
    for (let s = 0; s < path.loop; s += 0.3) {
      const p = cableAt(path, s), q = cableAt(flat, s);
      // (3, 4) is de richting, (-4, 3) ligt er dwars op
      expect(p.gx).toBeCloseTo(11 + (q.gx * 3 - q.gy * 4) / 5);
      expect(p.gy).toBeCloseTo(11 + (q.gx * 4 + q.gy * 3) / 5);
      expect(p.h).toBeCloseTo(q.h);
      expect(p.mx).toBeCloseTo((q.mx * 3 - q.my * 4) / 5);
      expect(p.my).toBeCloseTo((q.mx * 4 + q.my * 3) / 5);
    }
    const poles = cablePoles(path);
    expect(poles).toHaveLength(1);
    expect(poles[0].gx).toBeCloseTo(12.5);
    expect(poles[0].gy).toBeCloseTo(13);
    expect(poles[0].ax * 3 + poles[0].ay * 4).toBeCloseTo(0);
  });

  it('de lus is rond en zonder sprongen: de stoeltjes glijden de bocht om', () => {
    for (const pts of routes) {
      expect(cableValid(pts), JSON.stringify(pts)).toBe(true);
      const path = cablePath(pts), L = path.loop, step = 0.05;
      expect(path.out + path.back + 2 * Math.PI * CABLE.r).toBeCloseTo(L);
      expect(L).toBeCloseTo(cableLoop(path.len));
      let prev = cableAt(path, -step);
      for (let s = 0; s < L; s += step) {
        const p = cableAt(path, s);
        // even snel overal, en de richting draait rustig mee (hooguit zo snel als om het grote wiel)
        expect(Math.hypot(p.gx - prev.gx, p.gy - prev.gy), `bij ${s}`).toBeLessThan(step + 1e-6);
        expect(Math.hypot(p.gx - prev.gx, p.gy - prev.gy), `bij ${s}`).toBeGreaterThan(step * 0.98);
        expect(Math.hypot(p.mx, p.my)).toBeCloseTo(1);
        expect(Math.hypot(p.mx - prev.mx, p.my - prev.my), `richting bij ${s}`).toBeLessThan(step / CABLE.r + 1e-6);
        expect(p.h).toBeGreaterThanOrEqual(CABLE.low - 1e-9);
        expect(p.h).toBeLessThanOrEqual(CABLE.high + 1e-9);
        prev = p;
      }
      const a = cableAt(path, 0), b = cableAt(path, L);
      expect([b.gx, b.gy, b.h]).toEqual([a.gx, a.gy, a.h]);
    }
  });

  it('heen en terug liggen elk aan een kant van de lijn, en de twee kabels raken elkaar nergens', () => {
    for (const pts of routes) {
      const path = cablePath(pts), half = Math.PI * CABLE.r;
      const out: P2[] = [], back: P2[] = [];
      for (let s = 0; s <= path.out; s += 0.1) out.push([cableAt(path, s).gx, cableAt(path, s).gy]);
      for (let s = 0; s <= path.back; s += 0.1) back.push([cableAt(path, path.out + half + s).gx, cableAt(path, path.out + half + s).gy]);
      let least = 9;
      for (const p of out) for (const q of back) least = Math.min(least, Math.hypot(p[0] - q[0], p[1] - q[1]));
      // (bij de huisjes en op de rechte stukken precies de breedte van het wiel)
      expect(least, JSON.stringify(pts)).toBeGreaterThan(2 * CABLE.r - 0.02);
      // de heenweg begint links van de lijn (gezien in de rijrichting op de kaart: de + kant), de terugweg rechts
      const [ax, ay] = pts[0], l = Math.hypot(pts[1][0] - ax, pts[1][1] - ay), dx = (pts[1][0] - ax) / l, dy = (pts[1][1] - ay) / l;
      expect((out[10][0] - ax) * -dy + (out[10][1] - ay) * dx).toBeCloseTo(CABLE.r);
      expect((back[back.length - 10][0] - ax) * -dy + (back[back.length - 10][1] - ay) * dx).toBeCloseTo(-CABLE.r);
    }
  });

  it('bij een tussenpaal hangt de kabel hoog en gaat hij om een wiel: de buitenbocht om de paal zelf', () => {
    for (const pts of routes) {
      const path = cablePath(pts);
      expect(path.masts).toHaveLength(pts.length - 2);
      path.masts.forEach((m, i) => {
        expect([m.x, m.y]).toEqual(pts[i + 1]);
        expect(Math.abs(m.bend) * 180 / Math.PI).toBeCloseTo(cableTurn(pts[i], pts[i + 1], pts[i + 2]));
        expect(Math.hypot(m.ax, m.ay)).toBeCloseTo(1);
        expect(Math.hypot(m.wx - m.x, m.wy - m.y)).toBeCloseTo((2 * CABLE.r) / Math.cos(m.bend / 2));
        // elk van de twee kabels raakt zijn wiel: de ene de paal zelf, de andere het tweede wiel
        let onMast = 9, onWheel = 9;
        for (let s = 0; s < path.loop; s += 0.01) {
          const p = cableAt(path, s), dm = Math.hypot(p.gx - m.x, p.gy - m.y), dw = Math.hypot(p.gx - m.wx, p.gy - m.wy);
          if (dm < 1.2 || dw < 1.2) expect(p.h, `bij paal ${i}`).toBeCloseTo(CABLE.high);
          onMast = Math.min(onMast, dm);
          onWheel = Math.min(onWheel, dw);
        }
        expect(onMast).toBeCloseTo(CABLE.r, 3);
        expect(onWheel).toBeCloseTo(CABLE.r, 3);
      });
    }
  });

  it('de kabel is in de huisjes laag en klimt daarna, ook met palen', () => {
    for (const pts of routes) {
      const path = cablePath(pts), half = Math.PI * CABLE.r;
      for (const s of [0, 0.9, path.out - 0.9, path.out, path.out + half / 2, path.out + half + 0.9, path.loop - half - 0.9, path.loop - half / 2]) expect(cableAt(path, s).h).toBeCloseTo(CABLE.low);
      expect(cableAt(path, path.out / 2).h).toBeCloseTo(CABLE.high);
      expect(cableAt(path, path.out + half + path.back / 2).h).toBeCloseTo(CABLE.high);
      const a = cableAt(path, cableStop(path, 0)), b = cableAt(path, cableStop(path, 1)), n = pts.length - 1;
      expect(Math.hypot(a.gx - pts[0][0], a.gy - pts[0][1])).toBeCloseTo(CABLE.r);
      expect(Math.hypot(b.gx - pts[n][0], b.gy - pts[n][1])).toBeCloseTo(CABLE.r);
    }
  });

  it('per stuk kabel staan er vanzelf palen, niet te ver uit elkaar en nooit vlak naast een tussenpaal', () => {
    for (const pts of [...routes, [[11, 11], [25, 11.5], [39, 11.5], [39.5, 25.5], [30, 30]] as P2[]]) {
      const path = cablePath(pts), poles = cablePoles(path), n = pts.length - 1;
      for (const p of poles) {
        expect(p.h).toBeGreaterThan(CABLE.low + 1);
        expect(Math.hypot(p.ax, p.ay)).toBeCloseTo(1);
        for (const q of pts) expect(Math.hypot(p.gx - q[0], p.gy - q[1])).toBeGreaterThanOrEqual(1.5);
      }
      for (let i = 0; i < n; i++) {
        // de steunpunten van dit stuk op een rij: wat er op de lijn staat, met de twee uiteinden
        const [a, b] = [pts[i], pts[i + 1]], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
        const on = poles.map(p => ((p.gx - a[0]) * (b[0] - a[0]) + (p.gy - a[1]) * (b[1] - a[1])) / l)
          .filter((t, k) => t > 0 && t < l && Math.abs((poles[k].gx - a[0]) * (b[1] - a[1]) - (poles[k].gy - a[1]) * (b[0] - a[0])) < 1e-6);
        const stops = [i === 0 ? 1 : 0, ...on.sort((p, q) => p - q), i === n - 1 ? l - 1 : l];
        for (let k = 1; k < stops.length; k++) expect(stops[k] - stops[k - 1], `stuk ${i} van ${JSON.stringify(pts)}`).toBeLessThanOrEqual(Math.max(CABLE.poleGap, 1 + CABLE.ramp) + 1e-6);
      }
    }
    // een lang stuk tussen twee palen: drie palen ertussen; en bij elk huisje een paal waar de kabel boven is
    const long = cablePath([[0, 0], [5, 0], [19, 0], [24, 0]]);
    expect(cablePoles(long).map(p => p.gx)).toEqual([1 + CABLE.ramp, 8.5, 12, 15.5, 24 - 1 - CABLE.ramp]);
    // staat de paal vlak achter de klim, dan hoeft daar geen paal bij
    expect(cablePoles(cablePath([[0, 0], [4.5, 0], [9, 0]]))).toEqual([]);
  });
});

describe('kabelbaan: verder bouwen met een tussenstation', () => {
  it('vanaf het laatste huisje rechtdoor, de hoek om of schuin, maar niet terug over de kabel', () => {
    const a: CableEnd = { x: 0, y: 0, link: [8, 0] }, b: CableEnd = { x: 8, y: 0, link: [-8, 0] };
    const ends = [a, b];
    expect(cablePairs(ends)).toHaveLength(1);
    // zonder plek: niemand wacht, dus een nieuwe kabelbaan
    expect(cableOpen(ends)).toBeNull();
    // de hoek om en rechtdoor: het huisje dat het dichtst bij staat wordt een tussenstation
    expect(cableOpen(ends, { x: 8, y: 6 })?.from).toBe(b);
    expect(cableOpen(ends, { x: 16, y: 0 })?.from).toBe(b);
    expect(cableOpen(ends, { x: 0, y: -7 })?.from).toBe(a);
    // schuin mag nu ook; het nieuwe stuk mag niet terug over de kabel die er al hangt
    expect(cableOpen(ends, { x: 12, y: 5 })).toEqual({ from: b, slot: 'link2', pts: [[9, 1]], before: [1, 1] });
    expect(cableOpen(ends, { x: 3, y: 0 })).toBeNull();
    expect(cableOpen(ends, { x: 3, y: 4 })).toBeNull();
    // te ver van allebei: een nieuwe kabelbaan
    expect(cableOpen(ends, { x: 30, y: 30 })).toBeNull();
    // het nieuwe maatje komt in het tweede vakje, en dan zijn er twee stukken kabel
    expect(cableSlot(b, ends)).toBe('link2');
    const c: CableEnd = { x: 8, y: 6, link: [0, -6] };
    b.link2 = [0, 6];
    expect(cablePairs([a, b, c])).toHaveLength(2);
    // een tussenstation met twee maatjes gaat niet nog een keer verder
    expect(cableOpen([a, b, c], { x: 8, y: -7 })).toBeNull();
  });

  it('ook met tussenpalen: de eerste paal bij een eindhuisje begint een nieuw stuk', () => {
    const a: CableEnd = { x: 0, y: 0, link: [8, 0] }, b: CableEnd = { x: 8, y: 0, link: [-8, 0] };
    const ends = [a, b];
    // een paal op vier tegels of meer van het eindhuisje, niet terug over de kabel
    expect(cableOpen(ends, { x: 13, y: 2 }, true)?.from).toBe(b);
    expect(cableOpen(ends, { x: 11, y: 0 }, true)).toBeNull();
    expect(cableOpen(ends, { x: 4, y: 4 }, true)).toBeNull();
    // de paal staat er: nu hoort alles wat erbij komt bij dat stuk, waar je ook tikt
    b.via2 = [[5, 2]];
    expect(cableSlot(b, ends)).toBe('link2');
    expect(cableDrafts(ends)).toEqual([[[9, 1], [13.5, 2.5]]]);
    const open = cableOpen(ends, { x: 30, y: 30 })!;
    expect(open.from).toBe(b);
    expect(open.pts).toEqual([[9, 1], [13.5, 2.5]]);
    expect(open.before).toEqual([1, 1]);
    // het eerste huisje weg: de palen in aanbouw blijven bij het tweede staan, dat nu weer alleen wacht
    const rest = [{ ...a }, { ...b }];
    expect(cableCut(rest, rest[0])).toBe(0);
    expect(rest[1]).toEqual({ x: 8, y: 0, via2: [[5, 2]] });
    expect(cableSlot(rest[1], [rest[1]])).toBe('link2');
    expect(cableOpen([rest[1]])?.pts).toEqual([[9, 1], [13.5, 2.5]]);
  });
});

describe('kabelbaan: het perron', () => {
  const along = (deg: number): P2 => [Math.cos((deg * Math.PI) / 180), Math.sin((deg * Math.PI) / 180)];
  /** De plek van een paal of gast ligt vrij van elke kabel: achter het wiel, of ver genoeg opzij. */
  const beside = (p: P2, dirs: P2[]): number =>
    Math.min(9, ...dirs.filter(d => p[0] * d[0] + p[1] * d[1] > 0).map(d => Math.abs(p[0] * d[1] - p[1] * d[0])));

  it('langs het raster blijft alles zoals het was: vier palen en in elke hoek een gast', () => {
    for (const dirs of [[], [along(0)], [along(90)], [along(180), along(0)], [along(0), along(270)]] as P2[][]) {
      expect(cablePosts(dirs)).toEqual([true, true, true, true]);
      expect(cableWait(dirs)).toEqual(CABLE_CORNERS.map(([x, y]) => [x * CABLE_DECK.wait, y * CABLE_DECK.wait]));
    }
  });

  it('waar de stoeltjes schuin naar buiten gaan, staat geen paal en wacht niemand', () => {
    expect(cablePosts([along(45)])).toEqual([true, true, true, false]);
    expect(cablePosts([along(225)])).toEqual([false, true, true, true]);
    expect(cablePosts([along(20)])).toEqual([true, true, true, false]);
    expect(cablePosts([along(-30), along(150)])).toEqual([true, false, false, true]);
    // een heel klein beetje schuin: alle palen blijven staan
    expect(cablePosts([along(5)])).toEqual([true, true, true, true]);
    for (let deg = 0; deg < 360; deg += 7)
      for (const other of [null, 85, 130, 180, 265]) {
        const dirs = other === null ? [along(deg)] : [along(deg), along(deg + other)];
        const posts = cablePosts(dirs), spots = cableWait(dirs);
        expect(posts.filter(Boolean).length, `${deg} en ${other}`).toBeGreaterThanOrEqual(dirs.length === 1 ? 3 : 2);
        CABLE_CORNERS.forEach(([x, y], i) => {
          if (posts[i]) expect(beside([x * CABLE_DECK.post, y * CABLE_DECK.post], dirs)).toBeGreaterThanOrEqual(CABLE_DECK.postRoom - 1e-6);
        });
        // vier plekken op het perron, buiten het wiel, naast de stoeltjes en niet op elkaar
        expect(spots).toHaveLength(4);
        spots.forEach((p, i) => {
          expect(Math.max(Math.abs(p[0]), Math.abs(p[1])), `${deg} en ${other}`).toBeLessThanOrEqual(CABLE_DECK.edge + 1e-6);
          expect(Math.hypot(p[0], p[1])).toBeGreaterThan(CABLE.r + 0.25 + 0.14);
          expect(beside(p, dirs), `${deg} en ${other}`).toBeGreaterThanOrEqual(CABLE_DECK.waitRoom - 1e-6);
          expect(cableClear(p, dirs, CABLE_DECK.waitRoom)).toBe(true);
          for (let k = 0; k < i; k++) expect(Math.hypot(p[0] - spots[k][0], p[1] - spots[k][1]), `${deg} en ${other}`).toBeGreaterThan(0.3);
        });
      }
  });
});
