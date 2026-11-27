import { describe, expect, it } from 'vitest';
import {
  BUMPER, CAROUSEL, CAROUSEL_SEATS, CLIMBER, CLIMB_DO, climberBridge, climberChute, FERRIS, FOUNTAIN, RESTAURANT, RIDE_KINDS, RIDE_SEATS, RIDE_SPAN, SEESAW, SLIDE, SLIDE_LAP, SPRINGER, SWINGSET, TOWER, TRAMPOLINE,
  bumperSeat, carouselAt, carouselLift, carouselSeat, chuteHeight, ferrisAngle, ferrisSeat, ferrisSway, fountainJet, fountainSpot, newCars, newPose, newRide,
  planVisit, restaurantSeat, rideLocal, rideRunning, rideStep, rideWorld, seatPose, seesawSeat, slideLap, springerSeat, stepCars, swingSeat, trampolineSeat,
  visitPose, visitTime, type RideKind, type RideState, type Visit,
} from './rides';
import { SHOP_DEEP, SHOP_SIZE } from './data';

const DT = 1 / 30;
/** Alle toestellen waar hier rekensommen voor staan. */
const ALL = RIDE_KINDS;
/** Hoe breed en diep het toestel is, in tegels. */
const span = (kind: RideKind): [number, number] => RIDE_SPAN[kind];
/** Laat een toestel `seconds` tellen lopen. */
function run(kind: RideKind, s: RideState, seconds: number, aboard = 0, used = aboard): void {
  for (let t = 0; t < seconds - 1e-9; t += DT) rideStep(kind, s, DT, aboard, false, used);
}

/**
 * Speelt een heel bezoek af, beeldje voor beeldje, en geeft terug wat er gebeurde: de grootste sprong tussen twee
 * beeldjes, hoe lang de gast op het toestel zat, het laagste en hoogste punt, en hoe ver hij buiten zijn tegels kwam.
 */
function play(kind: RideKind, s: RideState, v: Visit, others = 0): { jump: number; on: number; low: number; high: number; out: number; end: number; steps: number } {
  const pose = newPose(), [w, d] = span(kind);
  let px = v.fx, ph = 0, pz = v.fz, jump = 0, on = 0, low = Infinity, high = -Infinity, out = 0, steps = 0;
  const limit = visitTime(v) + 2;
  for (let t = 0; t < limit; t += DT) {
    visitPose(pose, v, s);
    expect(Number.isFinite(pose.x + pose.h + pose.z + pose.face + pose.pitch + pose.roll + pose.u + pose.w + pose.sit), `${kind} op ${t.toFixed(2)}`).toBe(true);
    jump = Math.max(jump, Math.hypot(pose.x - px, pose.h - ph, pose.z - pz));
    [px, ph, pz] = [pose.x, pose.h, pose.z];
    low = Math.min(low, pose.h);
    high = Math.max(high, pose.h);
    if (pose.on) {
      on += DT;
      // wie op het toestel zit, zit binnen zijn eigen tegels
      out = Math.max(out, Math.abs(pose.x) - w / 2, Math.abs(pose.z) - d / 2);
    }
    steps++;
    if (pose.done) break;
    // (de gast is vanaf het plannen op weg naar zijn zitje: zo draait het reuzenrad al voor hem)
    rideStep(kind, s, DT, others | (pose.on ? 1 << v.seat : 0), false, others | (1 << v.seat));
  }
  return { jump, on, low, high, out, end: Math.hypot(pose.x - v.fx, pose.z - v.fz) + Math.abs(pose.h), steps };
}

describe('attracties', () => {
  it('een plek in het park en een plek in het gebouw rekenen heen en terug', () => {
    for (const rot of [0, 1, 2, 3]) {
      const [x, z] = rideLocal(13.2, 7.9, 12, 9, rot);
      const [gx, gy] = rideWorld(x, z, 12, 9, rot);
      expect(gx).toBeCloseTo(13.2, 9);
      expect(gy).toBeCloseTo(7.9, 9);
    }
    // de voorkant (+z) wijst zonder draaien naar het zuiden, een kwartslag gedraaid naar het oosten
    expect(rideWorld(0, 1, 5, 5, 0)).toEqual([5, 6]);
    expect(rideWorld(0, 1, 5, 5, 1)[0]).toBeCloseTo(6, 9);
    expect(rideWorld(0, 1, 5, 5, 2)[1]).toBeCloseTo(4, 9);
    expect(rideWorld(0, 1, 5, 5, 3)[0]).toBeCloseTo(4, 9);
  });

  it('het spel geeft elk toestel de tegels waar het voor gemaakt is', () => {
    for (const kind of RIDE_KINDS) expect([SHOP_SIZE[kind], SHOP_DEEP[kind] ?? SHOP_SIZE[kind]], kind).toEqual(RIDE_SPAN[kind]);
  });

  it('elk toestel heeft niet meer plekken dan er in het bezet-lijstje passen', () => {
    for (const kind of ALL) {
      expect(RIDE_SEATS[kind], kind).toBeGreaterThan(0);
      expect(RIDE_SEATS[kind], kind).toBeLessThanOrEqual(30);
    }
  });

  it('elke gast krijgt een eigen plek, tot het toestel vol is', () => {
    for (const kind of ALL) {
      const s = newRide(kind);
      let used = 0;
      const seats = new Set<number>();
      for (let i = 0; i < RIDE_SEATS[kind]; i++) {
        const v = planVisit(kind, s, used, 0.3, span(kind)[1] / 2 + 0.5);
        expect(v, `${kind} plek ${i}`).not.toBeNull();
        expect(seats.has(v!.seat), `${kind} dubbel ${v!.seat}`).toBe(false);
        seats.add(v!.seat);
        used |= 1 << v!.seat;
      }
      expect(planVisit(kind, s, used, 0.3, span(kind)[1] / 2 + 0.5), `${kind} vol`).toBeNull();
    }
  });

  it('een heel bezoek loopt vloeiend: van het pad erop, het ritje, en weer terug op het pad', () => {
    for (const kind of ALL) {
      const [w, d] = span(kind);
      for (const [fx, fz] of [[0.3, d / 2 + 0.5], [-w / 2 + 0.5, d / 2 + 0.5], [w / 2 + 0.5, 0.2]]) {
        const s = newRide(kind);
        run(kind, s, 3.3);
        // (de draaimolen en de botsauto's: is het te laat om nog in te stappen, dan wacht de gast op het volgende ritje)
        let v = planVisit(kind, s, 0, fx, fz);
        for (let t = 0; !v && t < 40; t += DT) {
          rideStep(kind, s, DT, 0);
          v = planVisit(kind, s, 0, fx, fz);
        }
        if (!v) throw new Error(`${kind}: geen plek`);
        expect(v.walk, kind).toBeGreaterThan(0);
        expect(v.wait, kind).toBeGreaterThanOrEqual(0);
        expect(v.ride, kind).toBeGreaterThan(2);
        const r = play(kind, s, v);
        // nooit een sprong: hooguit een flinke stap per beeldje (op de glijbaan en in de botsauto gaat het hard)
        expect(r.jump, `${kind} sprong`).toBeLessThan(0.16);
        expect(r.on, `${kind} erop`).toBeGreaterThan(Math.min(v.ride, 4) - 1);
        expect(r.low, `${kind} onder de grond`).toBeGreaterThanOrEqual(-0.01);
        expect(r.out, `${kind} buiten zijn tegels`).toBeLessThanOrEqual(0.12);
        expect(r.end, `${kind} terug op het pad`).toBeLessThan(0.05);
        expect(r.steps * DT, `${kind} duurt`).toBeLessThanOrEqual(visitTime(v) + 0.1);
      }
    }
  });

  it('ligt het pad opzij of achter een groot toestel, dan loopt de gast buitenom naar de voorkant', () => {
    // waar op de grond iets staat (x van, x tot, z van, z tot): de poten en het huisje van het rad, de vloer van de
    // botsauto's, de palen en de trap van de toren, en de keuken van het restaurant
    const blocks: Partial<Record<RideKind, number[][]>> = {
      ferris: [[1.5, 3.85, -0.9, 0.85], [-3.85, -1.5, -0.9, 0.85]],
      bumper: [[-BUMPER.ax, BUMPER.ax, BUMPER.z0, BUMPER.z1]],
      tower: [[-0.9, 0.9, -0.9, 0.45]],
      restaurant: [[-1.4, 0.26, -0.92, -0.16]],
    };
    for (const kind of Object.keys(blocks) as RideKind[]) {
      const [w, d] = span(kind);
      for (const [fx, fz] of [[w / 2 + 0.5, 0], [-w / 2 - 0.5, -0.5], [0.5, -d / 2 - 0.5], [-0.5, -d / 2 - 0.5]]) {
        const s = newRide(kind);
        let v = planVisit(kind, s, 0, fx, fz);
        for (let t = 0; !v && t < 40; t += DT) {
          rideStep(kind, s, DT, 0);
          v = planVisit(kind, s, 0, fx, fz);
        }
        if (!v) throw new Error(`${kind}: geen plek`);
        const p = newPose();
        let rode = false;
        for (let t = 0; t < visitTime(v) + 1; t += DT) {
          visitPose(p, v, s);
          if (p.on) rode = true;
          // over de grond, nog niet op het toestel: nooit dwars door iets heen
          if (!rode && p.h < 0.02)
            for (const [x0, x1, z0, z1] of blocks[kind]!) expect(p.x > x0 && p.x < x1 && p.z > z0 && p.z < z1, `${kind} van (${fx}, ${fz}) op ${t.toFixed(2)}: (${p.x.toFixed(2)}, ${p.z.toFixed(2)})`).toBe(false);
          if (p.done) break;
          rideStep(kind, s, DT, p.on ? 1 << v.seat : 0);
        }
        expect(rode, kind).toBe(true);
        expect(p.done, kind).toBe(true);
      }
    }
  });

  it('seatPose geeft dezelfde plek als waar de gast tijdens het ritje zit', () => {
    for (const kind of ALL) {
      const s = newRide(kind), a = newPose(), b = newPose();
      run(kind, s, 1);
      const v = planVisit(kind, s, 0, 0.2, span(kind)[1] / 2 + 0.5)!;
      // naar het midden van het ritje
      const mid = v.walk + v.wait + v.ride / 2;
      for (let t = 0; t < mid; t += DT) rideStep(kind, s, DT, t > v.walk ? 1 << v.seat : 0);
      visitPose(a, v, s);
      expect(a.on, kind).toBe(true);
      if (kind === 'fountain') continue; // (aan de fontein hangt de plek af van waar de gast vandaan kwam)
      seatPose(b, kind, v.seat, s);
      expect(Math.hypot(a.x - b.x, a.h - b.h, a.z - b.z), kind).toBeLessThan(1e-6);
      expect(a.face).toBeCloseTo(b.face, 6);
    }
  });
});

describe('het reuzenrad', () => {
  it('is echt reuzen: acht tegels breed, met twaalf bakjes voor twee', () => {
    expect(RIDE_SPAN.ferris).toEqual([8, 2]);
    expect(FERRIS.radius).toBeGreaterThanOrEqual(3.3);
    expect(FERRIS.radius).toBeLessThanOrEqual(3.5);
    expect(FERRIS.cabins).toBeGreaterThanOrEqual(10);
    expect(RIDE_SEATS.ferris).toBe(FERRIS.cabins * 2);
    // het past binnen zijn tegels, ook met een bakje dat slingert
    expect(FERRIS.radius + 0.45).toBeLessThan(RIDE_SPAN.ferris[0] / 2);
  });

  it('de bakjes hangen rondom het rad, gaan vrij over het perron en blijven rechtop', () => {
    const s = newRide('ferris'), p = newPose();
    for (let step = 0; step < 400; step++) {
      rideStep('ferris', s, 0.1, 0b11 << 6);
      for (let c = 0; c < FERRIS.cabins; c++) {
        const a = ferrisAngle(c, s.spin);
        ferrisSeat(p, c * 2, s);
        // de zitting hangt onder het asje, nooit meer dan een klein stukje opzij
        expect(Math.abs(p.x - Math.cos(a) * FERRIS.radius)).toBeLessThan(FERRIS.side + FERRIS.seat * Math.sin(FERRIS.sway) + 1e-9);
        expect(p.h).toBeLessThan(FERRIS.hub + Math.sin(a) * FERRIS.radius - FERRIS.seat * Math.cos(FERRIS.sway) + 0.05);
        // de vloer van het bakje blijft boven het perron
        expect(FERRIS.hub + Math.sin(a) * FERRIS.radius - FERRIS.floor - 0.4 * Math.sin(FERRIS.sway)).toBeGreaterThan(FERRIS.deck);
        expect(Math.abs(ferrisSway(c, s))).toBeLessThanOrEqual(FERRIS.sway + 1e-9);
        expect(Math.abs(p.roll)).toBeLessThanOrEqual(FERRIS.sway + 1e-9);
      }
    }
    // een bakje met gasten slingert meer dan een leeg bakje
    expect(s.amps[3]).toBeGreaterThan(0.9);
    expect(s.amps[0]).toBeLessThan(0.1);
  });

  it('je stapt in als je bakje onderin is en maakt precies één rondje', () => {
    const s = newRide('ferris'), p = newPose();
    run('ferris', s, 7.7, 0, 1);
    const v = planVisit('ferris', s, 0, 0.4, 1.5)!;
    const cabin = Math.floor(v.seat / 2);
    // op het moment van instappen is het bakje onderin
    const at = ferrisAngle(cabin, s.spin + (v.walk + v.wait) * FERRIS.speed);
    expect(Math.sin(at)).toBeCloseTo(-1, 3);
    expect(v.wait).toBeGreaterThan(0.3);
    expect(v.wait).toBeLessThan((Math.PI * 2) / FERRIS.speed / FERRIS.cabins + 0.5);
    expect(v.ride).toBeCloseTo((Math.PI * 2) / FERRIS.speed, 6);
    // halverwege zit de gast bovenin
    run('ferris', s, v.walk + v.wait + v.ride / 2, 0, 1 << v.seat);
    visitPose(p, v, s);
    expect(p.on).toBe(true);
    expect(p.h).toBeGreaterThan(FERRIS.hub + FERRIS.radius - FERRIS.seat - 0.1);
    expect(p.u).toBeGreaterThan(0.98);
  });

  it('twee gasten die samen komen, zitten naast elkaar in hetzelfde bakje', () => {
    const s = newRide('ferris');
    const a = planVisit('ferris', s, 0, 0, 1.5)!, b = planVisit('ferris', s, 1 << a.seat, 0.2, 1.5)!;
    expect(Math.floor(a.seat / 2)).toBe(Math.floor(b.seat / 2));
    expect(a.seat).not.toBe(b.seat);
  });
});

describe('de draaimolen', () => {
  it('de paarden staan in twee ringen, elk op een eigen plek', () => {
    expect(RIDE_SPAN.carousel).toEqual([3, 3]);
    expect(CAROUSEL_SEATS).toBe(9);
    const spots: [number, number][] = [];
    for (let i = 0; i < CAROUSEL_SEATS; i++) {
      const [a, r] = carouselAt(i, 0.4);
      expect(r).toBeLessThan(CAROUSEL.r - 0.2);
      spots.push([Math.sin(a) * r, Math.cos(a) * r]);
    }
    for (let i = 0; i < spots.length; i++)
      for (let j = i + 1; j < spots.length; j++) expect(Math.hypot(spots[i][0] - spots[j][0], spots[i][1] - spots[j][1])).toBeGreaterThan(0.45);
  });

  it('staat stil om in te stappen, en draait daarna; leeg draait hij niet', () => {
    const turned = (aboard: number): number => {
      const s = newRide('carousel');
      let was = s.spin, total = 0, still = 0;
      for (let t = 0; t < 33; t += DT) {
        rideStep('carousel', s, DT, aboard);
        const step = (s.spin - was + Math.PI * 2) % (Math.PI * 2);
        if (rideRunning('carousel', s)) total += step;
        else still += step;
        was = s.spin;
      }
      expect(still).toBeLessThan(1e-9);
      return total;
    };
    const empty = turned(0), full = turned(1);
    expect(empty).toBeLessThan(1e-9);
    expect(full).toBeGreaterThan(2.5);
  });

  it('wie komt terwijl hij draait, wacht in de rij tot hij weer stilstaat', () => {
    const s = newRide('carousel');
    run('carousel', s, CAROUSEL.stop + 2);
    expect(rideRunning('carousel', s)).toBe(true);
    expect(planVisit('carousel', s, 0, 0, 2)).toBeNull();
    // een hele ronde later staat hij stil en kan het weer
    run('carousel', s, CAROUSEL.up + CAROUSEL.run + CAROUSEL.down - 2 + 0.2);
    expect(rideRunning('carousel', s)).toBe(false);
    const v = planVisit('carousel', s, 0, 0, 2)!;
    expect(v).not.toBeNull();
    // hij zit voordat het ritje begint
    expect(v.walk + v.wait).toBeCloseTo(CAROUSEL.stop - (s.clock % (CAROUSEL.stop + CAROUSEL.up + CAROUSEL.run + CAROUSEL.down)), 6);
  });

  it('de paarden gaan op en neer terwijl hij draait', () => {
    const s = newRide('carousel'), p = newPose();
    let low = Infinity, high = -Infinity;
    for (let t = 0; t < 20; t += DT) {
      rideStep('carousel', s, DT, 1);
      carouselSeat(p, 0, s);
      low = Math.min(low, p.h);
      high = Math.max(high, p.h);
      expect(p.h).toBeCloseTo(carouselLift(0, s.spin), 9);
      expect(Math.hypot(p.x, p.z)).toBeCloseTo(CAROUSEL.rings[0].r, 9);
    }
    expect(high - low).toBeGreaterThan(CAROUSEL.bob * 1.8);
  });
});

describe('de botsauto\'s', () => {
  it('de auto\'s blijven op de vloer en rijden niet door elkaar heen', () => {
    const cars = newCars();
    expect(cars).toHaveLength(BUMPER.cars);
    let bumps = 0, moved = 0;
    for (let t = 0; t < 60; t += DT) {
      const was = cars.map(c => c.bump);
      stepCars(cars, DT, t, 1, 0b111111);
      cars.forEach((c, i) => {
        expect(Math.abs(c.x)).toBeLessThanOrEqual(BUMPER.ax - BUMPER.r + 1e-9);
        expect(c.z).toBeGreaterThanOrEqual(BUMPER.z0 + BUMPER.r - 1e-9);
        expect(c.z).toBeLessThanOrEqual(BUMPER.z1 - BUMPER.r + 1e-9);
        if (c.bump > was[i]) bumps++;
        moved += Math.hypot(c.vx, c.vz) * DT;
      });
      for (let i = 0; i < cars.length; i++)
        // (bij een botsing mogen de rubberen randen elkaar een haartje indrukken)
        for (let j = i + 1; j < cars.length; j++) expect(Math.hypot(cars[i].x - cars[j].x, cars[i].z - cars[j].z)).toBeGreaterThan(BUMPER.r * 2 - 0.05);
    }
    // het heet niet voor niets botsauto's
    expect(bumps).toBeGreaterThan(10);
    expect(moved / BUMPER.cars).toBeGreaterThan(30);
  });

  it('zonder stroom rollen ze uit en staan ze stil', () => {
    const cars = newCars();
    for (let t = 0; t < 5; t += DT) stepCars(cars, DT, t, 1, 0b111111);
    for (let t = 0; t < BUMPER.down; t += DT) stepCars(cars, DT, 5 + t, 0, 0b111111);
    for (const c of cars) expect(Math.hypot(c.vx, c.vz)).toBeLessThan(0.05);
  });

  it('een auto zonder bestuurder rijdt niet zelf; zonder gasten staan ze allemaal stil', () => {
    const one = newCars();
    for (let t = 0; t < 8; t += DT) stepCars(one, DT, t, 1, 0b000001);
    expect(Math.hypot(one[0].vx, one[0].vz)).toBeGreaterThan(0.3);
    const idle = newCars();
    let fastest = 0;
    for (let t = 0; t < 8; t += DT) {
      stepCars(idle, DT, t, 1, 0);
      for (const c of idle) fastest = Math.max(fastest, Math.hypot(c.vx, c.vz));
    }
    expect(fastest).toBeLessThan(1e-9);
  });

  it('de gast zit in zijn auto, waar die ook rijdt', () => {
    const s = newRide('bumper'), p = newPose();
    run('bumper', s, BUMPER.stop + 4, 0b10);
    bumperSeat(p, 1, s);
    expect(p.x).toBe(s.cars[1].x);
    expect(p.z).toBe(s.cars[1].z);
    expect(p.face).toBe(s.cars[1].dir);
  });
});

describe('de fontein', () => {
  it('de stralen spuiten altijd, nooit hoger dan helemaal, en zonder schokken', () => {
    for (let i = 0; i <= FOUNTAIN.jets; i++) {
      let was = fountainJet(i, 0), low = 1, high = 0;
      for (let t = 0; t < FOUNTAIN.round * 2; t += 0.02) {
        const now = fountainJet(i, t);
        expect(now).toBeGreaterThanOrEqual(0.15);
        expect(now).toBeLessThanOrEqual(1);
        expect(Math.abs(now - was), `straal ${i} op ${t.toFixed(2)}`).toBeLessThan(0.12);
        low = Math.min(low, now);
        high = Math.max(high, now);
        was = now;
      }
      // elke straal doet echt mee met het waterballet
      expect(high - low).toBeGreaterThan(0.4);
    }
    // het ballet herhaalt zich
    expect(fountainJet(2, 3.3)).toBeCloseTo(fountainJet(2, 3.3 + FOUNTAIN.round), 9);
  });

  it('de gasten staan om het bassin, elk op een eigen plek en met het gezicht naar het water', () => {
    const p = newPose(), spots: [number, number][] = [];
    for (let i = 0; i < RIDE_SEATS.fountain; i++) {
      fountainSpot(p, i, 0.2, 2);
      expect(Math.hypot(p.x, p.z)).toBeCloseTo(FOUNTAIN.rim, 9);
      expect(FOUNTAIN.rim).toBeGreaterThan(FOUNTAIN.wall + 0.15);
      // hij kijkt naar het midden
      expect(Math.sin(p.face) * p.x + Math.cos(p.face) * p.z).toBeLessThan(-FOUNTAIN.rim + 1e-6);
      spots.push([p.x, p.z]);
    }
    for (let i = 0; i < spots.length; i++)
      for (let j = i + 1; j < spots.length; j++) expect(Math.hypot(spots[i][0] - spots[j][0], spots[i][1] - spots[j][1])).toBeGreaterThan(0.4);
  });
});

describe('de uitkijktoren', () => {
  it('je klimt de hele trap op en staat boven aan het hek', () => {
    const s = newRide('tower'), p = newPose();
    const v = planVisit('tower', s, 0, 0.5, 1.5)!;
    let top = 0, last = 0;
    for (let t = 0; t < v.walk; t += DT) {
      visitPose(p, v, s);
      // omhoog gaat het nooit meer dan een trede per beeldje, en nooit omlaag
      expect(p.h).toBeGreaterThanOrEqual(last - 1e-9);
      expect(p.h - last).toBeLessThan(0.08);
      last = p.h;
      top = Math.max(top, p.h);
      rideStep('tower', s, DT, 0);
    }
    run('tower', s, 0.5);
    visitPose(p, v, s);
    expect(p.on).toBe(true);
    expect(p.h).toBe(TOWER.top);
    expect(Math.max(Math.abs(p.x), Math.abs(p.z))).toBeLessThan(0.8);
    // de trap op duurt even: het is een hoge toren
    expect(v.walk).toBeGreaterThan(3.5);
    expect(TOWER.top).toBeGreaterThan(2.4);
  });
});

describe('de glijbaan', () => {
  it('de glijbaan loopt van het torentje omlaag tot vlak boven de grond', () => {
    expect(chuteHeight(SLIDE.chuteTop)).toBe(SLIDE.top);
    expect(chuteHeight(SLIDE.chuteEnd)).toBeCloseTo(SLIDE.endH, 9);
    let was = SLIDE.top;
    for (let z = SLIDE.chuteTop; z <= SLIDE.chuteEnd; z += 0.01) {
      expect(chuteHeight(z)).toBeLessThanOrEqual(was + 1e-9);
      was = chuteHeight(z);
    }
    // de trap en de glijbaan liggen naast elkaar, allebei binnen de tegels
    expect(SLIDE.stairX - SLIDE.chuteX).toBeGreaterThan(0.8);
    expect(SLIDE.chuteEnd + 0.16).toBeLessThan(RIDE_SPAN.slide[1] / 2);
  });

  it('een rondje: de trap op, over het torentje, glijden en terug naar de trap', () => {
    const p = newPose();
    let high = 0, slid = false, climbed = false;
    for (let t = 0; t < SLIDE_LAP; t += 0.02) {
      slideLap(p, t);
      high = Math.max(high, p.h);
      if (p.act === 'slide') slid = true;
      if (p.act === 'climb') climbed = true;
    }
    expect(high).toBeGreaterThan(SLIDE.top - 0.01);
    expect(slid && climbed).toBe(true);
    // het rondje sluit: aan het eind staat het kind weer onderaan de trap
    slideLap(p, SLIDE_LAP - 1e-6);
    expect(Math.hypot(p.x - SLIDE.stairX, p.z - SLIDE.stairFoot)).toBeLessThan(0.01);
  });

  it('drie kinderen lopen een derde rondje na elkaar en zitten elkaar nooit in de weg', () => {
    const s = newRide('slide'), a = newPose(), b = newPose();
    for (let t = 0; t < SLIDE_LAP; t += 0.05) {
      rideStep('slide', s, 0.05, 0);
      for (let i = 0; i < SLIDE.slots; i++)
        for (let j = i + 1; j < SLIDE.slots; j++) {
          seatPose(a, 'slide', i, s);
          seatPose(b, 'slide', j, s);
          expect(Math.hypot(a.x - b.x, a.h - b.h, a.z - b.z)).toBeGreaterThan(0.3);
        }
    }
  });

  it('ligt het pad opzij of achter de glijbaan, dan loopt het kind eromheen en nergens dwars doorheen', () => {
    // waar op de grond iets staat: het torentje, de trap en de glijbaan (x van, x tot, z van, z tot)
    const blocks = [[-0.9, 0.9, -1.4, SLIDE.chuteTop], [SLIDE.stairX - 0.2, SLIDE.stairX + 0.2, SLIDE.stairTop, SLIDE.stairFoot - 0.25], [SLIDE.chuteX - 0.22, SLIDE.chuteX + 0.22, SLIDE.chuteTop, SLIDE.chuteEnd]];
    for (const [fx, fz] of [[0.5, 2], [-0.5, 2], [-1.5, 1], [1.5, -1], [-1.5, -1], [0.5, -2], [-0.5, -2]]) {
      const s = newRide('slide'), v = planVisit('slide', s, 0, fx, fz)!, p = newPose();
      let rode = false;
      for (let t = 0; t < visitTime(v) + 1; t += DT) {
        visitPose(p, v, s);
        if (p.on) rode = true;
        // wie over de grond loopt (naar de trap toe, of na het glijden terug naar het pad), raakt niets
        else if (p.h < 0.02)
          for (const [x0, x1, z0, z1] of blocks) expect(p.x > x0 && p.x < x1 && p.z > z0 && p.z < z1, `van (${fx}, ${fz}) op ${t.toFixed(2)}: (${p.x.toFixed(2)}, ${p.z.toFixed(2)})`).toBe(false);
        if (p.done) break;
        rideStep('slide', s, DT, 0);
      }
      expect(rode).toBe(true);
      expect(p.done).toBe(true);
    }
  });
});

describe('de speeltoestellen', () => {
  it('de schommel is twee tegels breed en één diep, en zwaait niet ver buiten zijn tegel', () => {
    expect(RIDE_SPAN.swing).toEqual([2, 1]);
    const s = newRide('swing'), p = newPose();
    let reach = 0, apart = 0;
    for (let t = 0; t < 20; t += DT) {
      rideStep('swing', s, DT, 0b11);
      swingSeat(p, 0, s);
      const z0 = p.z;
      reach = Math.max(reach, Math.abs(p.z));
      expect(p.h).toBeGreaterThan(0.35);
      // het zitje hangt aan zijn touw: altijd even ver van de balk
      expect(Math.hypot(p.h - SWINGSET.top, p.z)).toBeCloseTo(SWINGSET.rope, 9);
      swingSeat(p, 1, s);
      apart = Math.max(apart, Math.abs(p.z - z0));
    }
    expect(reach).toBeGreaterThan(0.45);
    expect(reach).toBeLessThan(0.62);
    // de twee zitjes gaan niet gelijk op
    expect(apart).toBeGreaterThan(0.3);
  });

  it('een leeg zitje hangt stil, een zitje met een kind gaat flink heen en weer', () => {
    const s = newRide('swing'), p = newPose();
    let empty = 0, busy = 0;
    for (let t = 0; t < 20; t += DT) {
      rideStep('swing', s, DT, 0b01);
      if (t < 3) continue;
      busy = Math.max(busy, Math.abs(swingSeat(p, 0, s).z));
      empty = Math.max(empty, Math.abs(swingSeat(p, 1, s).z));
    }
    expect(empty).toBeLessThan(1e-6);
    expect(busy).toBeGreaterThan(0.08);
  });

  it('de wipwap: gaat de ene kant omhoog, dan gaat de andere omlaag', () => {
    expect(RIDE_SPAN.seesaw).toEqual([2, 1]);
    const s = newRide('seesaw'), a = newPose(), b = newPose();
    let swing = 0;
    for (let t = 0; t < 12; t += DT) {
      rideStep('seesaw', s, DT, 0b11);
      seesawSeat(a, 0, s);
      seesawSeat(b, 1, s);
      expect(a.h + b.h).toBeCloseTo(2 * (SEESAW.pivot + SEESAW.lift * Math.cos(Math.asin((b.h - a.h) / 2 / SEESAW.side))), 1);
      expect(Math.min(a.h, b.h)).toBeGreaterThan(0.2);
      expect(a.u + b.u).toBeCloseTo(1, 6);
      swing = Math.max(swing, Math.abs(a.h - b.h));
      // ze kijken elkaar aan
      expect(Math.sin(a.face)).toBeCloseTo(1, 9);
      expect(Math.sin(b.face)).toBeCloseTo(-1, 9);
    }
    expect(swing).toBeGreaterThan(0.3);
  });

  it('de wipkip is één tegel groot en wipt voor- en achterover', () => {
    expect(RIDE_SPAN.springer).toEqual([1, 1]);
    expect(RIDE_SEATS.springer).toBe(1);
    const s = newRide('springer'), p = newPose();
    let front = 0, back = 0;
    for (let t = 0; t < 8; t += DT) {
      rideStep('springer', s, DT, 1);
      springerSeat(p, s);
      front = Math.max(front, p.z);
      back = Math.min(back, p.z);
      expect(Math.hypot(p.x, p.z)).toBeLessThan(0.2);
      expect(p.h).toBeGreaterThan(SPRINGER.seat - 0.05);
    }
    expect(front).toBeGreaterThan(0.06);
    expect(back).toBeLessThan(-0.06);
  });

  it('op de trampoline springt elk kind op zijn eigen plek, en het doek veert mee', () => {
    const s = newRide('trampoline'), p = newPose();
    const high = [0, 0, 0];
    for (let t = 0; t < 12; t += DT) {
      rideStep('trampoline', s, DT, 0b101);
      for (let i = 0; i < TRAMPOLINE.seats; i++) {
        trampolineSeat(p, i, s);
        expect(Math.hypot(p.x, p.z)).toBeCloseTo(TRAMPOLINE.ring, 9);
        expect(p.h).toBeGreaterThan(TRAMPOLINE.mat - 0.12);
        high[i] = Math.max(high[i], p.h - TRAMPOLINE.mat);
      }
    }
    expect(high[0]).toBeGreaterThan(TRAMPOLINE.jump * 0.9);
    expect(high[2]).toBeGreaterThan(TRAMPOLINE.jump * 0.9);
    // op de lege plek springt niemand
    expect(high[1]).toBeLessThan(0.02);
  });

  it('op de trampoline klim je langs het trapje, en aan het eind land je netjes voor je eraf gaat', () => {
    for (const [fx, fz] of [[0.5, 1.5], [1.5, -0.5], [-0.5, -1.5]]) {
      const s = newRide('trampoline'), v = planVisit('trampoline', s, 0, fx, fz)!, p = newPose();
      let climbed = false, last = 0, top = 0;
      for (let t = 0; t < visitTime(v) + 1; t += DT) {
        visitPose(p, v, s);
        if (p.act === 'climb') climbed = true;
        // wie nog niet boven is, staat buiten de rand of op het trapje: nooit dwars door het doek
        if (p.h < TRAMPOLINE.mat - 0.05 && Math.hypot(p.x, p.z) < TRAMPOLINE.frame) {
          expect(Math.abs(p.x), `van (${fx}, ${fz}) op ${t.toFixed(2)}`).toBeLessThan(0.05);
          expect(p.z).toBeGreaterThan(TRAMPOLINE.frame - 0.12);
        }
        if (p.on) {
          last = p.h;
          top = Math.max(top, p.h);
        }
        if (p.done) break;
        rideStep('trampoline', s, DT, p.on ? 1 << v.seat : 0);
      }
      expect(climbed).toBe(true);
      expect(top).toBeGreaterThan(TRAMPOLINE.mat + TRAMPOLINE.jump * 0.8);
      // het laatste beeldje op het doek: de voeten staan er weer op
      expect(last).toBeLessThan(TRAMPOLINE.mat + 0.03);
      expect(p.done).toBe(true);
    }
  });
});

describe('het restaurant', () => {
  it('heeft een terras met tafels voor twee, elk op een eigen kruk', () => {
    expect(RIDE_SPAN.restaurant).toEqual([3, 2]);
    expect(RIDE_SEATS.restaurant).toBe(RESTAURANT.tables.length * 2);
    const p = newPose(), spots: [number, number][] = [];
    for (let i = 0; i < RIDE_SEATS.restaurant; i++) {
      restaurantSeat(p, i);
      const [tx, tz] = RESTAURANT.tables[Math.floor(i / 2)];
      // aan zijn eigen tafel, met het gezicht ernaartoe
      expect(Math.abs(p.x - tx)).toBeCloseTo(RESTAURANT.stool, 9);
      expect(p.z).toBe(tz);
      expect(Math.sign(Math.sin(p.face))).toBe(Math.sign(tx - p.x));
      spots.push([p.x, p.z]);
    }
    for (let i = 0; i < spots.length; i++)
      for (let j = i + 1; j < spots.length; j++) expect(Math.hypot(spots[i][0] - spots[j][0], spots[i][1] - spots[j][1])).toBeGreaterThan(0.4);
  });
});

describe('het klimkasteel', () => {
  /** Loopt een heel bezoek af en schrijft op wat het kind doet: per stuk van het parcours het eerste moment. */
  function walkThrough(fx: number, fz: number, seat = 0): { order: string[]; top: number; inside: boolean; done: boolean; slid: boolean } {
    const s = newRide('climber'), used = seat ? (1 << seat) - 1 : 0, v = planVisit('climber', s, used, fx, fz)!, p = newPose();
    const [w, d] = RIDE_SPAN.climber, order: string[] = [];
    let top = 0, inside = true, slid = false;
    const mark = (what: string): void => {
      if (order[order.length - 1] !== what) order.push(what);
    };
    for (let t = 0; t < visitTime(v) + 1; t += DT) {
      visitPose(p, v, s);
      if (p.on) {
        top = Math.max(top, p.h);
        // op het toestel blijft het kind binnen zijn tegels
        if (Math.abs(p.x) > w / 2 || Math.abs(p.z) > d / 2) inside = false;
      }
      if (p.act === 'climb' && p.w === 0 && p.h > 0.05) mark('ladder');
      if (p.w === CLIMB_DO.bridge) mark('brug');
      if (p.w === CLIMB_DO.crawl) mark('tunnel');
      if (p.on && p.act === 'stand' && p.h > CLIMBER.towers[2][1] - 0.01) mark('toren');
      if (p.w === CLIMB_DO.beam) mark('balk');
      if (p.act === 'slide') {
        mark('glijbaan');
        slid = true;
        // de glijbaan af: het kind zit op de baan
        expect(p.h).toBeCloseTo(climberChute(p.x) + 0.03, 6);
      }
      if (p.done) break;
      rideStep('climber', s, DT, p.on ? 1 << v.seat : 0);
    }
    return { order, top, inside, done: p.done, slid };
  }

  it('is groot: tien tegels breed en drie diep, voor tien kinderen tegelijk', () => {
    expect(RIDE_SPAN.climber).toEqual([10, 3]);
    expect(RIDE_SEATS.climber).toBe(CLIMBER.seats);
    expect(CLIMBER.seats).toBeGreaterThanOrEqual(8);
  });

  it('elk kind doet het hele parcours, in de goede volgorde, en komt weer op het pad', () => {
    for (const [fx, fz] of [[0, 2], [-3, 2], [4.5, 2], [5.5, 0], [-5.5, -1], [0, -2]]) {
      const r = walkThrough(fx, fz);
      expect(r.order.filter(k => k !== 'ladder' || r.order.indexOf('ladder') === r.order.lastIndexOf('ladder')), `van (${fx}, ${fz})`).toEqual(['ladder', 'brug', 'tunnel', 'toren', 'balk', 'glijbaan']);
      expect(r.inside).toBe(true);
      expect(r.slid).toBe(true);
      expect(r.done).toBe(true);
      // nooit hoger dan de vloer van de grote toren
      expect(r.top).toBeLessThan(CLIMBER.towers[2][1] + 0.05);
    }
  });

  it('kinderen die na elkaar komen, krijgen elk een eigen plekje boven op de grote toren', () => {
    const p = newPose(), spots = new Set<string>();
    for (let seat = 0; seat < CLIMBER.seats; seat++) {
      seatPose(p, 'climber', seat, newRide('climber'));
      expect(p.h).toBe(CLIMBER.towers[2][1]);
      // binnen het hekje van de toren
      expect(Math.abs(p.x - CLIMBER.towers[2][0])).toBeLessThan(CLIMBER.towers[2][2]);
      expect(Math.abs(p.z - CLIMBER.z)).toBeLessThan(CLIMBER.towers[2][2]);
      spots.add(`${p.x.toFixed(2)},${p.z.toFixed(2)}`);
    }
    expect(spots.size).toBe(CLIMBER.seats);
  });

  it('kinderen gaan om de beurt de ladder op: wie later komt, wacht in de rij en schuift op', () => {
    const s = newRide('climber'), visits: Visit[] = [];
    let used = 0;
    for (let i = 0; i < 4; i++) {
      const v = planVisit('climber', s, used, -3.5, 2)!;
      used |= 1 << v.seat;
      visits.push(v);
    }
    // wanneer elk kind de onderste sport van de ladder verlaat
    const starts = visits.map(v => {
      const p = newPose(), probe = newRide('climber');
      probe.clock = v.t0;
      for (let t = 0; t < visitTime(v); t += DT) {
        visitPose(p, v, probe);
        if (p.act === 'climb' && p.h > 0.02) return t;
        probe.clock += DT;
      }
      return Infinity;
    });
    for (let i = 1; i < starts.length; i++) expect(starts[i] - starts[i - 1]).toBeGreaterThan(CLIMBER.gap - 0.1);
    // het laatste kind staat eerst in de rij, rechts van de ladder, en niet op dezelfde plek als het kind voor hem
    expect(visits[3].q).toBeGreaterThan(visits[2].q! + 0.2);
    expect(visits[3].q).toBeLessThanOrEqual(CLIMBER.queueMax);
  });

  it('de wiebelbrug hangt door en de glijbaan loopt van toren 4 naar beneden', () => {
    const [t1, t2, , t4] = CLIMBER.towers;
    expect(climberBridge(0)).toBeCloseTo(t1[1], 9);
    expect(climberBridge(1)).toBeCloseTo(t2[1], 9);
    expect(climberBridge(0.5)).toBeLessThan((t1[1] + t2[1]) / 2);
    expect(climberChute(CLIMBER.slideTop)).toBe(t4[1]);
    expect(climberChute(CLIMBER.slideEnd)).toBe(CLIMBER.endH);
    for (let x = CLIMBER.slideTop; x < CLIMBER.slideEnd; x += 0.05) expect(climberChute(x + 0.05)).toBeLessThanOrEqual(climberChute(x));
    // de glijbaan blijft binnen de tegels
    expect(CLIMBER.slideEnd + 0.06).toBeLessThan(RIDE_SPAN.climber[0] / 2);
  });

  it('leeg wiebelt het nauwelijks, met kinderen erop gaat het flink', () => {
    const s = newRide('climber');
    run('climber', s, 3);
    expect(s.amp).toBeLessThan(0.01);
    run('climber', s, 3, 0b11);
    expect(s.amp).toBeGreaterThan(0.9);
  });
});

describe('de grote speeltuin', () => {
  const KINDS: RideKind[] = ['sandbox', 'splash', 'zipline', 'bouncy', 'pirate', 'roundabout', 'nestswing', 'ballpit', 'crawlhill'];

  it('elk kind speelt op zijn eigen plekje, binnen de tegels van het toestel en nooit onder de grond', () => {
    for (const kind of KINDS) {
      const [w, d] = RIDE_SPAN[kind], s = newRide(kind), p = newPose();
      for (let t = 0; t < 12; t += 0.5) {
        rideStep(kind, s, 0.5, (1 << RIDE_SEATS[kind]) - 1);
        const spots = new Set<string>();
        for (let seat = 0; seat < RIDE_SEATS[kind]; seat++) {
          seatPose(p, kind, seat, s);
          expect(Math.abs(p.x), `${kind} ${seat}`).toBeLessThan(w / 2);
          expect(Math.abs(p.z), `${kind} ${seat}`).toBeLessThan(d / 2);
          expect(p.h, `${kind} ${seat}`).toBeGreaterThanOrEqual(0);
          spots.add(`${p.x.toFixed(2)},${p.z.toFixed(2)},${p.h.toFixed(2)}`);
        }
        // (in de waterspeeltuin kunnen twee springers heel even langs hetzelfde fonteintje komen, en aan de tokkelbaan
        // zit maar een kind tegelijk klaar: zie de test hieronder)
        if (kind !== 'splash' && kind !== 'zipline') expect(spots.size, kind).toBe(RIDE_SEATS[kind]);
      }
    }
  });

  it('aan de tokkelbaan hangt er maar een tegelijk: wie later komt, wacht boven op het torentje', () => {
    const s = newRide('zipline'), a = planVisit('zipline', s, 0, -2, 1.5)!, b = planVisit('zipline', s, 1 << a.seat, -2, 1.5)!;
    expect(b.seat).not.toBe(a.seat);
    expect(b.walk + b.wait).toBeGreaterThanOrEqual(a.walk + a.wait + a.ride);
  });

  it('het draaimolentje draait alleen met kinderen erop, en de nestschommel zwaait dan pas flink', () => {
    const r = newRide('roundabout');
    run('roundabout', r, 4);
    expect(r.spin).toBeCloseTo(0, 6);
    run('roundabout', r, 4, 1);
    expect(r.spin).toBeGreaterThan(1);
    const n = newRide('nestswing');
    run('nestswing', n, 4, 1);
    expect(n.amp).toBeGreaterThan(0.9);
  });
});
