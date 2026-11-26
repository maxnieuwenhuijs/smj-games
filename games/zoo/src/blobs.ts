// Zachte ronde schaduwvlekjes op de grond, onder elk dier en elk mens: dan staan ze echt op de grond. De zon geeft
// al echte schaduwen; dit vlekje is alleen de zachte donkere plek vlak onder de voeten. Alle vlekjes samen zijn één
// tekenopdracht; hun plek wordt elk beeldje overgenomen, zonder iets nieuws aan te maken.
import * as THREE from 'three';
import type { Animal } from './animal';
import type { Guest, Worker } from './people';
import type { Foot } from './shade';

export const BLOB = {
  /** Hoe donker een vlekje in het midden is. */
  opacity: 0.3,
  /** De kleur: een heel donker blauwgrijs, zodat het gras niet vies wordt. */
  color: 0x1c2430,
  /** Zo hoog boven de grond (in tegels) ligt het vlekje, tegen het flikkeren. */
  lift: 0.015,
  /** 's Nachts zoveel lichter (0,4 = 40 procent). */
  night: 0.4,
  /** Zo hoog (in tegels) moet een poppetje komen voor het vlekje helemaal weg is (een glijbaan, een bankje). */
  personUp: 0.45,
  /** Een dier: zoveel keer zijn eigen hoogte, maar minstens zoveel tegels. */
  animalUp: 0.9,
  animalUpMin: 0.5,
  /** Hoe groot het vlekje van een poppetje is, in tegels: van voor naar achter en opzij. */
  personAlong: 0.34,
  personAcross: 0.3,
  /** Een dier: het vlekje is iets groter dan zijn lijf (lengte keer `along`, breedte keer `across`). */
  along: 0.9,
  across: 1.3,
};

const smooth01 = (t: number): number => {
  const k = Math.min(1, Math.max(0, t));
  return k * k * (3 - 2 * k);
};

/** Hoe sterk het vlekje is (0 tot 1): weg als je hoog boven de grond bent, en 's nachts wat lichter. */
export function blobStrength(up: number, reach: number, night: number): number {
  const high = smooth01(up / Math.max(0.01, reach));
  return (1 - high) * (1 - BLOB.night * Math.min(1, Math.max(0, night)));
}

/** Een vlekje wordt iets kleiner naarmate je hoger komt. */
export const blobShrink = (up: number, reach: number): number => 1 - 0.3 * smooth01(up / Math.max(0.01, reach));

/**
 * Het materiaal: zwart met doorzichtigheid, rond en zacht uitlopend naar de rand. Per vlekje komt de sterkte uit
 * het getal `blob`. Mist en kleur van het licht doen gewoon mee, zoals bij elk ander materiaal.
 */
function blobMaterial(): THREE.MeshBasicMaterial {
  const m = new THREE.MeshBasicMaterial({ color: BLOB.color, transparent: true, opacity: BLOB.opacity, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  m.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float blob;\nvarying float vBlob;\nvarying vec2 vSpot;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBlob = blob;\nvSpot = position.xz * 2.0;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vBlob;\nvarying vec2 vSpot;')
      .replace('#include <alphamap_fragment>', '#include <alphamap_fragment>\nfloat edge = clamp( 1.0 - length( vSpot ), 0.0, 1.0 );\ndiffuseColor.a *= vBlob * edge * edge * ( 3.0 - 2.0 * edge );');
  };
  m.customProgramCacheKey = () => 'blob';
  return m;
}

export class BlobShadows {
  mesh: THREE.InstancedMesh;
  /** Uitzetten om te vergelijken: `__zoo.blobs.on = false` in de console. */
  on = true;
  private strength: THREE.InstancedBufferAttribute;
  private geo: THREE.BufferGeometry;
  private n = 0;
  private night = 0;

  constructor(private scene: THREE.Scene, private cap = 256) {
    // een vlak van 1 bij 1 op de grond; het midden is het donkerst
    this.geo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    this.strength = new THREE.InstancedBufferAttribute(new Float32Array(cap), 1);
    this.geo.setAttribute('blob', this.strength);
    this.mesh = this.makeMesh(blobMaterial());
    scene.add(this.mesh);
  }

  private makeMesh(mat: THREE.Material): THREE.InstancedMesh {
    const mesh = new THREE.InstancedMesh(this.geo, mat, this.cap);
    mesh.frustumCulled = false;
    mesh.castShadow = mesh.receiveShadow = false;
    mesh.renderOrder = 1;
    mesh.count = 0;
    return mesh;
  }

  /** Meer plek: twee keer zoveel vlekjes (gebeurt alleen als het park veel drukker wordt). */
  private grow(): void {
    const old = this.mesh;
    this.cap *= 2;
    const strength = new THREE.InstancedBufferAttribute(new Float32Array(this.cap), 1);
    strength.array.set(this.strength.array);
    const geo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    geo.setAttribute('blob', strength);
    this.geo.dispose();
    this.geo = geo;
    this.strength = strength;
    const mesh = this.makeMesh(old.material as THREE.Material);
    (mesh.instanceMatrix.array as Float32Array).set(old.instanceMatrix.array);
    this.scene.remove(old);
    old.dispose();
    this.scene.add(mesh);
    this.mesh = mesh;
  }

  begin(night: number): void {
    this.n = 0;
    this.night = night;
  }

  /**
   * Eén vlekje: het midden op (x, z), de grond op hoogte `ground`, `up` hoe hoog het dier of poppetje erboven is
   * (en `reach` waar het vlekje weg is), `along` en `across` de maat (in tegels) in en dwars op de richting `yaw`.
   */
  add(x: number, ground: number, z: number, up: number, reach: number, along: number, across: number, yaw: number): void {
    const s = blobStrength(Math.max(0, up), reach, this.night);
    if (s < 0.02 || !this.on) return;
    if (this.n >= this.cap) this.grow();
    const k = blobShrink(Math.max(0, up), reach), c = Math.cos(yaw), sn = Math.sin(yaw), a = across * k, l = along * k;
    // draaien om de hoogte-as en uitrekken, zonder een nieuwe matrix te maken
    const e = this.mesh.instanceMatrix.array as Float32Array, o = this.n * 16;
    e[o] = c * a; e[o + 1] = 0; e[o + 2] = -sn * a; e[o + 3] = 0;
    e[o + 4] = 0; e[o + 5] = 1; e[o + 6] = 0; e[o + 7] = 0;
    e[o + 8] = sn * l; e[o + 9] = 0; e[o + 10] = c * l; e[o + 11] = 0;
    e[o + 12] = x; e[o + 13] = ground + BLOB.lift; e[o + 14] = z; e[o + 15] = 1;
    this.strength.array[this.n] = s;
    this.n++;
  }

  /** Onder een dier: zo groot als het in rust op de grond staat (zie modelFoot), met het midden onder zijn lijf. */
  addAnimal(a: Animal): void {
    const root = a.model.root, ground = a.groundLevel;
    if (ground === null || !root.visible || !root.parent) return;
    const info = a.info, sx = root.scale.x, sz = root.scale.z;
    const foot = (root.userData.foot as Foot | null | undefined) ?? { cz: info.length / 2 - info.back, long: info.length, wide: info.length * 0.45 };
    const long = foot.long * sz, wide = foot.wide * sx, yaw = root.rotation.y, ahead = foot.cz * sz;
    const reach = Math.max(BLOB.animalUpMin, info.height * root.scale.y * BLOB.animalUp);
    this.add(root.position.x + Math.sin(yaw) * ahead, ground, root.position.z + Math.cos(yaw) * ahead, root.position.y - ground, reach,
      long * BLOB.along, wide * BLOB.across, yaw);
  }

  /** Onder een poppetje (een gast of een werker) dat los op de grond staat. */
  addPerson(mesh: THREE.Object3D): void {
    if (!mesh.visible) return;
    const s = mesh.scale.x;
    this.add(mesh.position.x, 0, mesh.position.z, mesh.position.y, BLOB.personUp, BLOB.personAlong * s, BLOB.personAcross * s, mesh.rotation.y);
  }

  /** Alle vlekjes voor dit beeldje. Wie in het treintje of de kabelbaan zit, heeft geen vlekje. */
  update(animals: readonly Animal[], guests: readonly Guest[], workers: readonly Worker[], night: number): void {
    this.begin(night);
    for (const a of animals) this.addAnimal(a);
    for (const g of guests) if (!g.riding && !g.gone) this.addPerson(g.mesh);
    for (const w of workers) if (w.mesh.parent) this.addPerson(w.mesh);
    this.end();
  }

  end(): void {
    this.mesh.count = this.n;
    this.mesh.visible = this.n > 0;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.strength.needsUpdate = true;
  }
}
