// Wat je ziet bij het zorgen met de hand: het snoepje dat door de lucht vliegt, de straal van de tuinslang en de
// stofjes op een vies dier. De regels staan in care.ts.
import * as THREE from 'three';
import { arcAt } from './care';
import { MUD_LOVERS, type FoodId } from './data';
import type { Animal } from './animal';
import { MODEL_SCALE } from './models';
import { foodPiece, toWorldX, toWorldZ } from './view';

type Spot = [number, number, number];

/** Een snoepje onderweg: van waar, naar waar (dat kan meebewegen), hoe lang, en wat er gebeurt als het er is. */
interface Flight {
  mesh: THREE.Object3D;
  from: Spot;
  to: () => Spot;
  seconds: number;
  rise: number;
  t: number;
  done: () => void;
  /** Valt op de grond (een ziek dier eet het niet): het blijft even liggen en verdwijnt dan. */
  land: boolean;
  spin: THREE.Vector3;
}

/** De waterstraal: elke druppel vliegt in een boog en valt na `life` tellen. */
interface Drop {
  mesh: THREE.Mesh;
  p: THREE.Vector3;
  v: THREE.Vector3;
  life: number;
}

const GRAVITY = 7;
/** Zo lang is een druppel onderweg van de slang naar het dier. */
const JET_SECONDS = 0.42;
const JET_RATE = 45;
const MAX_DROPS = 160;
const DROP_GEO = new THREE.SphereGeometry(0.03, 5, 4);
const DROP_MAT = new THREE.MeshBasicMaterial({ color: 0xbfe9ff, transparent: true, opacity: 0.85 });
const SPECK_GEO = new THREE.IcosahedronGeometry(1, 0).scale(1, 0.45, 1);
const DUST_MAT = new THREE.MeshStandardMaterial({ color: 0x9a8b74, roughness: 1 });
const MUD_MAT = new THREE.MeshStandardMaterial({ color: 0x6e5338, roughness: 1 });
/** Zo groot is een stofje, in tegels. */
const SPECK_SIZE = 0.045;
const MAX_SPECKS = 6;

/** De spuitmond van de tuinslang: een stukje groene slang met een gele spuitkop, langs z. */
function makeNozzle(): THREE.Group {
  const g = new THREE.Group();
  const hose = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.5, 8).rotateX(Math.PI / 2).translate(0, 0, -0.3), new THREE.MeshStandardMaterial({ color: 0x3f9f4a, roughness: 0.7 }));
  const head = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.065, 0.16, 10).rotateX(Math.PI / 2).translate(0, 0, 0.02), new THREE.MeshStandardMaterial({ color: 0xffd23f, roughness: 0.5 }));
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.018, 6, 12).translate(0, 0, -0.06), new THREE.MeshStandardMaterial({ color: 0xe0584f, roughness: 0.6 }));
  g.add(hose, head, ring);
  g.visible = false;
  return g;
}

export class CareFx {
  private flights: Flight[] = [];
  private lying: { mesh: THREE.Object3D; life: number }[] = [];
  private drops: Drop[] = [];
  private nozzle = makeNozzle();
  private jetDue = 0;
  /** Het snoepje dat je vasthoudt zolang je sleept. */
  private held: THREE.Object3D | null = null;
  private heldFood: FoodId | null = null;
  private heldAt: Spot = [0, 0, 0];
  private clock = 0;
  /** Per dier: de stofjes op zijn vacht (in het model zelf, zodat ze meebewegen). */
  private specks = new Map<Animal, THREE.Mesh[]>();

  constructor(private scene: THREE.Scene) {
    scene.add(this.nozzle);
  }

  private placeAt(obj: THREE.Object3D, s: Spot): void {
    obj.position.set(toWorldX(s[0]), s[2], toWorldZ(s[1]));
  }

  /** Een snoepje gooien: in `seconds` tellen in een boog van `from` naar `to`. Daarna `done`. */
  throwTreat(food: FoodId, from: Spot, to: () => Spot, seconds: number, done: () => void, land = false): void {
    const mesh = foodPiece(food);
    mesh.scale.setScalar(1.35);
    this.scene.add(mesh);
    const dist = Math.hypot(to()[0] - from[0], to()[1] - from[1]);
    const spin = new THREE.Vector3(5 + Math.random() * 4, 3 + Math.random() * 3, Math.random() * 2);
    this.flights.push({ mesh, from, to, seconds, rise: 0.7 + dist * 0.12, t: 0, done, land, spin });
    this.placeAt(mesh, from);
  }

  /** Het snoepje in je hand (op deze plek), zolang je sleept om te mikken; met null is het weg. */
  hold(food: FoodId | null, at?: Spot): void {
    if (!food) {
      if (this.held) this.scene.remove(this.held);
      this.held = null;
      this.heldFood = null;
      return;
    }
    if (this.heldFood !== food) {
      if (this.held) this.scene.remove(this.held);
      this.held = foodPiece(food);
      this.held.scale.setScalar(1.35);
      this.heldFood = food;
      this.scene.add(this.held);
    }
    if (at) this.heldAt = at;
  }

  /** De tuinslang spuit van `from` naar `to` (zolang je dit elke beurt opnieuw doet). */
  spray(from: Spot, to: Spot, dt: number): void {
    const n = this.nozzle;
    n.visible = true;
    this.placeAt(n, from);
    n.lookAt(toWorldX(to[0]), to[2], toWorldZ(to[1]));
    this.jetDue += dt * JET_RATE;
    const v = new THREE.Vector3((to[0] - from[0]) / JET_SECONDS, (to[2] - from[2]) / JET_SECONDS + 0.5 * GRAVITY * JET_SECONDS, (to[1] - from[1]) / JET_SECONDS);
    while (this.jetDue >= 1) {
      this.jetDue -= 1;
      if (this.drops.length >= MAX_DROPS) continue;
      const mesh = new THREE.Mesh(DROP_GEO, DROP_MAT);
      mesh.scale.setScalar(0.7 + Math.random() * 0.7);
      const p = new THREE.Vector3(toWorldX(from[0]), from[2], toWorldZ(from[1]));
      const jitter = new THREE.Vector3((Math.random() - 0.5) * 0.35, (Math.random() - 0.5) * 0.35, (Math.random() - 0.5) * 0.35);
      mesh.position.copy(p);
      this.scene.add(mesh);
      this.drops.push({ mesh, p, v: v.clone().add(jitter), life: JET_SECONDS * (0.9 + Math.random() * 0.3) });
    }
  }

  /** De tuinslang spuit niet meer. */
  stopSpray(): void {
    this.nozzle.visible = false;
    this.jetDue = 0;
  }

  /** Zoveel stofjes op dit dier (0 tot 6). */
  setDust(a: Animal, n: number): void {
    let list = this.specks.get(a);
    if (!list) {
      if (n <= 0) return;
      list = this.makeSpecks(a);
      this.specks.set(a, list);
    }
    list.forEach((m, i) => (m.visible = i < n));
  }

  /** Het dier is weg uit het park: zijn stofjes ook. */
  forget(a: Animal): void {
    const list = this.specks.get(a);
    if (list) for (const m of list) m.parent?.remove(m);
    this.specks.delete(a);
  }

  /** De dieren waar stofjes op zitten. */
  dusted(): Animal[] {
    return [...this.specks.keys()];
  }

  /**
   * Stofjes op de rug van het dier: op plekken van het model zelf waar de vacht naar boven wijst, in het midden van
   * het lijf (niet op de kop of de staart). Ze hangen in het model, zodat ze meebewegen.
   */
  private makeSpecks(a: Animal): THREE.Mesh[] {
    const root = a.model.root;
    root.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
    const rel = new THREE.Matrix4(), nm = new THREE.Matrix3();
    const v = new THREE.Vector3(), nv = new THREE.Vector3();
    const spots: THREE.Vector3[] = [];
    root.traverse(o => {
      const mesh = o as THREE.Mesh;
      const pos = mesh.isMesh ? mesh.geometry?.attributes.position : undefined;
      if (!pos) return;
      const nor = mesh.geometry.attributes.normal;
      rel.multiplyMatrices(inv, mesh.matrixWorld);
      nm.getNormalMatrix(rel);
      const step = Math.max(1, Math.floor(pos.count / 500));
      for (let i = 0; i < pos.count; i += step) {
        if (nor) {
          nv.fromBufferAttribute(nor, i).applyMatrix3(nm).normalize();
          if (nv.y < 0.6) continue;
        }
        spots.push(v.fromBufferAttribute(pos, i).applyMatrix4(rel).clone());
      }
    });
    // alleen het midden van het lijf: tussen een kwart en driekwart van achter naar voren, en in de bovenste helft
    const info = a.info;
    let pick = spots;
    if (spots.length) {
      const zs = spots.map(s => s.z), ys = spots.map(s => s.y);
      const z0 = Math.min(...zs), z1 = Math.max(...zs), y0 = Math.min(...ys), y1 = Math.max(...ys);
      const mid = spots.filter(s => s.z > z0 + (z1 - z0) * 0.25 && s.z < z1 - (z1 - z0) * 0.3 && s.y > y0 + (y1 - y0) * 0.35);
      if (mid.length >= MAX_SPECKS) pick = mid;
    }
    if (pick.length < MAX_SPECKS) {
      // geen goede plekken in het model: dan ongeveer op de rug
      pick = Array.from({ length: MAX_SPECKS }, (_, i) => new THREE.Vector3((i % 2 ? 1 : -1) * info.length * 0.08, info.height * 0.72, -info.back * 0.4 + (info.length * 0.5 * i) / MAX_SPECKS));
    }
    const mat = MUD_LOVERS.includes(a.species) ? MUD_MAT : DUST_MAT;
    const out: THREE.Mesh[] = [];
    for (let i = 0; i < MAX_SPECKS; i++) {
      const s = pick[Math.floor(((i * 0.618 + 0.13) % 1) * pick.length)];
      const m = new THREE.Mesh(SPECK_GEO, mat);
      m.position.copy(s);
      m.scale.setScalar((SPECK_SIZE / MODEL_SCALE) * (0.7 + ((i * 0.37) % 0.6)));
      m.rotation.y = i * 1.3;
      m.visible = false;
      root.add(m);
      out.push(m);
    }
    return out;
  }

  update(dt: number): void {
    this.clock += dt;
    for (const f of this.flights) {
      f.t += dt;
      const p = f.t / f.seconds;
      this.placeAt(f.mesh, arcAt(f.from, f.to(), p, f.rise));
      f.mesh.rotation.x += f.spin.x * dt;
      f.mesh.rotation.y += f.spin.y * dt;
      f.mesh.rotation.z += f.spin.z * dt;
      if (p < 1) continue;
      if (f.land) {
        f.mesh.rotation.set(0, f.mesh.rotation.y, 0);
        this.lying.push({ mesh: f.mesh, life: 1.8 });
      } else this.scene.remove(f.mesh);
      f.done();
    }
    this.flights = this.flights.filter(f => f.t < f.seconds);
    for (const l of this.lying) {
      l.life -= dt;
      l.mesh.scale.setScalar(1.35 * Math.min(1, l.life / 0.5));
      if (l.life <= 0) this.scene.remove(l.mesh);
    }
    this.lying = this.lying.filter(l => l.life > 0);
    if (this.held) {
      this.placeAt(this.held, [this.heldAt[0], this.heldAt[1], this.heldAt[2] + Math.sin(this.clock * 6) * 0.05]);
      this.held.rotation.y += dt * 2;
    }
    for (const d of this.drops) {
      d.life -= dt;
      d.v.y -= GRAVITY * dt;
      d.p.addScaledVector(d.v, dt);
      d.mesh.position.copy(d.p);
      if (d.life <= 0 || d.p.y < 0) this.scene.remove(d.mesh);
    }
    this.drops = this.drops.filter(d => d.life > 0 && d.p.y >= 0);
  }
}
