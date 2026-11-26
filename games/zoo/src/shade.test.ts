import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ANIMAL_SHADE, PERSON_SHADE, SHADE_MIN_HEIGHT, THING_SHADE, shadeAttribute, shadeColors, shadeFactor, shadeGrey, shadeGroup, shadeable, toLinear } from './shade';

/** Een vorm met een vaste kleur per hoekpunt. */
const painted = (geo: THREE.BufferGeometry, c = 0.8): THREE.BufferGeometry => {
  const n = geo.getAttribute('position').count;
  return geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).fill(c), 3));
};

describe('de schaduw in de kleuren', () => {
  it('de onderkant is het donkerst, maar nooit meer dan het maximum', () => {
    const f = shadeFactor(0, 0, 0, 1, ANIMAL_SHADE);
    expect(f).toBeCloseTo(1 - ANIMAL_SHADE.low, 5);
    expect(shadeFactor(0, -1, 0, 1, ANIMAL_SHADE)).toBeCloseTo(1 - ANIMAL_SHADE.most, 5);
    for (const look of [ANIMAL_SHADE, PERSON_SHADE, THING_SHADE]) {
      for (let y = 0; y <= 1; y += 0.05) for (const ny of [-1, -0.5, 0, 1]) {
        const v = shadeFactor(y, ny, 0, 1, look);
        expect(v).toBeGreaterThanOrEqual(1 - look.most - 1e-9);
        expect(v).toBeLessThanOrEqual(1);
      }
      // nooit meer dan ongeveer een derde donkerder: het blijft vrolijk en licht
      expect(look.most).toBeLessThanOrEqual(0.35);
    }
  });

  it('loopt weg naar boven: vanaf de helft van de hoogte blijft een zijkant zoals hij was', () => {
    expect(shadeFactor(0.1, 0, 0, 1, ANIMAL_SHADE)).toBeGreaterThan(shadeFactor(0.05, 0, 0, 1, ANIMAL_SHADE));
    expect(shadeFactor(0.3, 0, 0, 1, ANIMAL_SHADE)).toBeGreaterThan(shadeFactor(0.1, 0, 0, 1, ANIMAL_SHADE));
    expect(shadeFactor(0.5, 0, 0, 1, ANIMAL_SHADE)).toBe(1);
    expect(shadeFactor(0.9, 0, 0, 1, ANIMAL_SHADE)).toBe(1);
  });

  it('naar beneden kijkende vlakken zijn donkerder, maar niet bovenin (de kop en de ogen)', () => {
    expect(shadeFactor(0.6, -1, 0, 1, ANIMAL_SHADE)).toBeLessThan(0.9);
    expect(shadeFactor(0.6, 1, 0, 1, ANIMAL_SHADE)).toBe(1);
    expect(shadeFactor(0.95, -1, 0, 1, ANIMAL_SHADE)).toBe(1);
  });

  it('een groot gebouw wordt alleen vlak bij de grond donker', () => {
    // 2,5 tegels hoog: op 0,6 tegel hoogte is er al niets meer van over (THING_SHADE.reach)
    expect(shadeFactor(0.02, 0, 0, 2.5, THING_SHADE)).toBeLessThan(0.8);
    expect(shadeFactor(0.6, 0, 0, 2.5, THING_SHADE)).toBe(1);
    // maar de onderkant van het dak (die naar beneden kijkt) wel een beetje
    expect(shadeFactor(2, -1, 0, 2.5, THING_SHADE)).toBeCloseTo(1 - THING_SHADE.under, 5);
  });

  it('keep 0 laat de kleur zoals hij was; zonder hoogte gebeurt er niets', () => {
    expect(shadeFactor(0, -1, 0, 1, ANIMAL_SHADE, 0)).toBe(1);
    expect(shadeFactor(0, -1, 0, 0, ANIMAL_SHADE)).toBe(1);
  });

  it('rekent om naar lineaire kleuren', () => {
    expect(toLinear(1)).toBe(1);
    expect(toLinear(0.7)).toBeCloseTo(Math.pow(0.7, 2.2), 6);
    expect(toLinear(0.7)).toBeLessThan(0.7);
  });
});

describe('vormen donkerder maken', () => {
  it('shadeColors: de onderste hoekpunten van een blok worden donkerder, de bovenste niet', () => {
    const geo = painted(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0));
    shadeColors(geo, 0, 1, ANIMAL_SHADE);
    const pos = geo.getAttribute('position'), color = geo.getAttribute('color');
    for (let i = 0; i < pos.count; i++) {
      if (pos.getY(i) > 0.99) expect(color.getX(i)).toBeCloseTo(0.8, 6);
      else expect(color.getX(i)).toBeLessThan(0.8);
    }
  });

  it('shadeColors werkt ook met kleuren als bytes (zoals in de modellen)', () => {
    const geo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), n = geo.getAttribute('position').count;
    geo.setAttribute('color', new THREE.BufferAttribute(new Uint8Array(n * 3).fill(200), 3, true));
    shadeColors(geo, 0, 1, ANIMAL_SHADE);
    const arr = geo.getAttribute('color').array as Uint8Array;
    expect(Math.min(...arr)).toBeLessThan(200);
    expect(Math.max(...arr)).toBe(200);
  });

  it('shadeGroup telt de hoogte over het hele model en doet een gedeelde vorm maar één keer', () => {
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true });
    const low = painted(new THREE.BoxGeometry(0.4, 0.2, 0.4).translate(0, 0.1, 0));
    const roof = painted(new THREE.BoxGeometry(1, 0.1, 1));
    const group = new THREE.Group();
    const top = new THREE.Mesh(roof, mat);
    top.position.y = 1.5;
    group.add(new THREE.Mesh(low, mat), top);
    shadeGroup(group);
    const c1 = Array.from(low.getAttribute('color').array as Float32Array);
    expect(Math.min(...c1)).toBeLessThan(0.8);
    // het dak hangt hoog: alleen de onderkant (die naar beneden kijkt) wordt iets donkerder
    const rc = roof.getAttribute('color'), rn = roof.getAttribute('normal');
    for (let i = 0; i < rc.count; i++) {
      if (rn.getY(i) < -0.5) expect(rc.getX(i)).toBeLessThan(0.8);
      else expect(rc.getX(i)).toBeCloseTo(0.8, 6);
    }
    // nog een keer: niets verandert meer
    shadeGroup(group);
    expect(Array.from(low.getAttribute('color').array as Float32Array)).toEqual(c1);
  });

  it('glas, lampjes, onderdelen zonder kleuren en platte dingen krijgen geen schaduw', () => {
    const glass = new THREE.Mesh(painted(new THREE.BoxGeometry()), new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, opacity: 0.4 }));
    const lamp = new THREE.Mesh(painted(new THREE.BoxGeometry()), new THREE.MeshStandardMaterial({ vertexColors: true, emissive: 0xffcc66, emissiveIntensity: 1 }));
    const plain = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ color: 0xff0000 }));
    const basic = new THREE.Mesh(painted(new THREE.BoxGeometry()), new THREE.MeshBasicMaterial({ vertexColors: true }));
    const moving = new THREE.Mesh(painted(new THREE.BoxGeometry()), new THREE.MeshStandardMaterial({ vertexColors: true }));
    for (const m of [glass, lamp, plain, basic]) expect(shadeable(m)).toBe(false);
    expect(shadeable(moving)).toBe(true);
    const flat = painted(new THREE.BoxGeometry(1, SHADE_MIN_HEIGHT / 2, 1));
    shadeGroup(new THREE.Group().add(new THREE.Mesh(flat, new THREE.MeshStandardMaterial({ vertexColors: true }))));
    expect(Math.min(...(flat.getAttribute('color').array as Float32Array))).toBeCloseTo(0.8, 6);
    // wat ronddraait (userData.noShade) blijft zoals het was
    const wheel = new THREE.Group();
    wheel.userData.noShade = true;
    wheel.add(moving);
    shadeGroup(new THREE.Group().add(wheel));
    expect(Math.min(...(moving.geometry.getAttribute('color').array as Float32Array))).toBeCloseTo(0.8, 6);
  });

  it('shadeAttribute: de schoenen van een poppetje zijn donkerder dan de heup', () => {
    const leg = new THREE.BoxGeometry(0.08, 0.2, 0.08).translate(0, -0.1, 0);
    shadeAttribute(leg, 0.2, 0, 0.66, PERSON_SHADE);
    const shade = leg.getAttribute('shade'), pos = leg.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      expect(shade.getX(i)).toBeGreaterThanOrEqual(0);
      expect(shade.getX(i)).toBeLessThan(1);
      if (pos.getY(i) > -0.01) expect(shade.getX(i)).toBeLessThan(0.2);
      else expect(shade.getX(i)).toBeGreaterThan(0.3);
    }
  });

  it('shadeGrey: grijze kleuren (wit = onveranderd) voor een vorm met één kleur', () => {
    const geo = shadeGrey(new THREE.CylinderGeometry(0.1, 0.1, 1, 6).translate(0, 0.5, 0), 0, 2, THING_SHADE);
    const c = geo.getAttribute('color'), pos = geo.getAttribute('position');
    for (let i = 0; i < c.count; i++) {
      expect(c.getX(i)).toBe(c.getY(i));
      if (pos.getY(i) > 0.99) expect(c.getX(i)).toBe(1);
      if (pos.getY(i) < 0.01) expect(c.getX(i)).toBeLessThan(1);
    }
  });
});
