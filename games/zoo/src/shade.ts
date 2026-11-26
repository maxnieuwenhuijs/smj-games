// Nep-schaduw in de kleuren zelf (een goedkope "ambient occlusion"): de onderkant van een dier, poppetje of ding
// wordt wat donkerder, en vlakken die naar beneden kijken ook. Zo zien de modellen er ronder en steviger uit.
// Het gebeurt één keer, als een model geladen of een vorm gemaakt wordt: tijdens het spelen kost het niets.
import * as THREE from 'three';

/** Hoe de schaduw loopt. Alle getallen zijn delen van 1 (0,28 = 28 procent donkerder). */
export interface ShadeLook {
  /** Zoveel donkerder is de onderste rand. */
  low: number;
  /** Tot dit deel van de hoogte loopt het donker weg. */
  fade: number;
  /** ... maar nooit verder dan zoveel tegels omhoog (een groot gebouw wordt alleen onderaan donker). */
  reach: number;
  /** Zoveel donkerder is een vlak dat recht naar beneden kijkt. */
  under: number;
  /** Boven dit deel van de hoogte doen de naar beneden kijkende vlakken niet meer mee (de kop, de ogen). */
  top: number;
  /** Nooit meer dan zoveel donkerder in totaal. */
  most: number;
}

/** Dieren: buik en poten donkerder, de kop blijft licht. */
export const ANIMAL_SHADE: ShadeLook = { low: 0.28, fade: 0.45, reach: Infinity, under: 0.16, top: 0.72, most: 0.32 };
/** Poppetjes: broekspijpen en schoenen onderaan donkerder. */
export const PERSON_SHADE: ShadeLook = { low: 0.26, fade: 0.45, reach: Infinity, under: 0.12, top: 0.7, most: 0.3 };
/** Kramen, speeltoestellen, versiering en bomen: alleen het stuk vlak bij de grond, en de onderkant van daken en planken. */
export const THING_SHADE: ShadeLook = { low: 0.25, fade: 0.45, reach: 0.55, under: 0.13, top: 2, most: 0.3 };
/** Lager dan dit (in tegels) is iets plat (een plas, een kleed): dat krijgt geen schaduw. */
export const SHADE_MIN_HEIGHT = 0.12;

/** Uitzetten om te vergelijken: `localStorage.zooNoShade = '1'` en de pagina opnieuw laden. */
export const SHADE_ON = ((): boolean => {
  try {
    return globalThis.localStorage?.getItem('zooNoShade') !== '1';
  } catch {
    return true;
  }
})();

const smooth01 = (t: number): number => {
  const k = Math.min(1, Math.max(0, t));
  return k * k * (3 - 2 * k);
};

/**
 * Hoe licht een hoekpunt blijft (1 = zoals het was, 0,7 = 30 procent donkerder, zoals het oog het ziet).
 * `y`: de hoogte van het punt; `ny`: hoe ver zijn normaal omhoog wijst (-1 is recht naar beneden); `bottom` en
 * `height`: waar het model begint en hoe hoog het is; `keep`: 1 = volle schaduw, 0 = geen (de kop van een dier).
 */
export function shadeFactor(y: number, ny: number, bottom: number, height: number, look: ShadeLook, keep = 1): number {
  if (!(height > 0)) return 1;
  const rise = Math.max(0, y - bottom), frac = rise / height;
  // vlak bij de grond het donkerst, en snel lichter naar boven
  const fade = Math.min(look.fade * height, look.reach), q = 1 - Math.min(1, rise / fade);
  const ground = look.low * q * q;
  // vlakken die naar beneden kijken (de buik, de onderkant van een dak), maar niet bovenin
  const under = look.under * Math.max(0, -ny) * (1 - smooth01((frac - look.top + 0.15) / 0.15));
  return 1 - Math.min(look.most, (ground + under) * Math.max(0, keep));
}

/** De kleuren in een model zijn 'lineair': zo wordt een factor zoals het oog hem ziet daarnaar omgerekend. */
export const toLinear = (f: number): number => Math.pow(f, 2.2);

const P = new THREE.Vector3(), N = new THREE.Vector3(), NM = new THREE.Matrix3();

/**
 * Maakt de kleuren per hoekpunt van een vorm donkerder (zie shadeFactor). `at`: waar de vorm in het model staat
 * (voor de hoogte en de richting van de normalen); `keep` per hoekpunt, zie shadeFactor. Zonder kleuren of
 * normalen gebeurt er niets.
 */
export function shadeColors(geo: THREE.BufferGeometry, bottom: number, height: number, look: ShadeLook, at?: THREE.Matrix4, keep?: (i: number) => number): void {
  const color = geo.getAttribute('color'), pos = geo.getAttribute('position'), normal = geo.getAttribute('normal');
  if (!color || !pos || !normal) return;
  if (at) NM.getNormalMatrix(at);
  for (let i = 0; i < color.count; i++) {
    P.fromBufferAttribute(pos, i);
    N.fromBufferAttribute(normal, i);
    if (at) {
      P.applyMatrix4(at);
      N.applyMatrix3(NM).normalize();
    }
    const f = toLinear(shadeFactor(P.y, N.y, bottom, height, look, keep ? keep(i) : 1));
    if (f >= 0.999) continue;
    color.setXYZ(i, color.getX(i) * f, color.getY(i) * f, color.getZ(i) * f);
  }
  color.needsUpdate = true;
}

/**
 * Voor vormen zonder kleuren per hoekpunt (de poppetjes): hoeveel donkerder elk hoekpunt is, als getal
 * `shade` (0 = niets). Het materiaal rekent `kleur * (1 - shade)` (zie ToneMaterial in people.ts). `lift`: zo hoog
 * hangt de vorm in het model.
 */
export function shadeAttribute(geo: THREE.BufferGeometry, lift: number, bottom: number, height: number, look: ShadeLook): void {
  const pos = geo.getAttribute('position'), normal = geo.getAttribute('normal'), a = new Float32Array(pos.count);
  if (SHADE_ON) for (let i = 0; i < pos.count; i++) a[i] = 1 - toLinear(shadeFactor(pos.getY(i) + lift, normal.getY(i), bottom, height, look));
  geo.setAttribute('shade', new THREE.BufferAttribute(a, 1));
}

/** Voor een vorm met één kleur (de bomen): grijze kleuren per hoekpunt, die met de kleur van het materiaal vermenigvuldigd worden. */
export function shadeGrey(geo: THREE.BufferGeometry, bottom: number, height: number, look: ShadeLook): THREE.BufferGeometry {
  const n = geo.getAttribute('position').count;
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3));
  if (SHADE_ON) shadeColors(geo, bottom, height, look);
  return geo;
}

/** Vormen die al donkerder gemaakt zijn: een vorm die in meer modellen zit, wordt maar één keer gedaan. */
const done = new WeakSet<THREE.BufferGeometry>();

/** Krijgt dit onderdeel schaduw? Alleen gewone, ondoorzichtige onderdelen met kleuren per hoekpunt; geen glas, water of lampjes. */
export function shadeable(mesh: THREE.Mesh): boolean {
  const m = mesh.material;
  if (Array.isArray(m) || !(m instanceof THREE.MeshStandardMaterial)) return false;
  if (!m.vertexColors || m.transparent || m.userData.noShade) return false;
  if (m.emissiveIntensity > 0 && m.emissive.getHex() !== 0) return false;
  return mesh.geometry.hasAttribute('color') && mesh.geometry.hasAttribute('normal');
}

/**
 * Geeft alle onderdelen van een gebouwd model (een kraam, een speeltoestel, een slaapplek) de schaduw. De hoogte
 * telt over het hele model, met de onderdelen op hun plek. Een vorm die al gedaan is, blijft zoals hij is.
 */
export function shadeGroup(root: THREE.Object3D, look: ShadeLook = THING_SHADE): void {
  if (!SHADE_ON) return;
  root.updateMatrixWorld(true);
  const inv = root.matrixWorld.clone().invert(), box = new THREE.Box3(), part = new THREE.Box3();
  const todo: [THREE.BufferGeometry, THREE.Matrix4][] = [];
  // (wat ronddraait of kantelt, zoals het reuzenrad, heeft `userData.noShade`: daar zou de schaduw mee omhoog draaien)
  const walk = (o: THREE.Object3D, shade: boolean): void => {
    const mesh = o as THREE.Mesh, here = shade && !o.userData.noShade;
    if (mesh.isMesh) {
      const at = new THREE.Matrix4().multiplyMatrices(inv, mesh.matrixWorld), geo = mesh.geometry;
      if (!geo.boundingBox) geo.computeBoundingBox();
      box.union(part.copy(geo.boundingBox!).applyMatrix4(at));
      if (here && !done.has(geo) && shadeable(mesh)) todo.push([geo, at]);
    }
    for (const child of o.children) walk(child, here);
  };
  walk(root, true);
  const height = box.max.y - box.min.y;
  if (!todo.length || !(height >= SHADE_MIN_HEIGHT)) return;
  for (const [geo, at] of todo) {
    if (done.has(geo)) continue;
    done.add(geo);
    shadeColors(geo, box.min.y, height, look, at);
  }
}

/**
 * Een geladen dier (GLB met kleuren per hoekpunt): de schaduw gaat in de gedeelde vorm, dus alle dieren van die
 * soort hebben hem meteen. Wat aan de kop vastzit (ogen, snuit), houdt bijna zijn eigen kleur.
 */
export function shadeModel(scene: THREE.Object3D, look: ShadeLook = ANIMAL_SHADE): void {
  if (!SHADE_ON) return;
  scene.traverse(o => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || done.has(mesh.geometry) || !mesh.geometry.hasAttribute('color')) return;
    const geo = mesh.geometry;
    done.add(geo);
    if (!geo.boundingBox) geo.computeBoundingBox();
    const box = geo.boundingBox!, keep = headKeep(mesh);
    shadeColors(geo, box.min.y, box.max.y - box.min.y, look, undefined, keep);
  });
}

/** De botten van de kop (zie tools/animals): daar blijft de kleur zoals hij was. */
const HEAD_BONES = new Set(['head', 'lids']);

/** Per hoekpunt hoeveel schaduw het krijgt: weinig als het aan de kop vastzit. */
function headKeep(mesh: THREE.Mesh): ((i: number) => number) | undefined {
  const skinned = mesh as THREE.SkinnedMesh, joints = mesh.geometry.getAttribute('skinIndex'), weights = mesh.geometry.getAttribute('skinWeight');
  if (!skinned.isSkinnedMesh || !skinned.skeleton || !joints || !weights) return undefined;
  const head = new Set<number>();
  skinned.skeleton.bones.forEach((b, i) => {
    if (HEAD_BONES.has(b.name)) head.add(i);
  });
  if (!head.size) return undefined;
  return i => {
    let w = 0;
    for (let k = 0; k < 4; k++) if (head.has(joints.getComponent(i, k))) w += weights.getComponent(i, k);
    return 1 - 0.85 * Math.min(1, w);
  };
}

/** Waar een dier op de grond staat, in model-eenheden: het midden van voor naar achter, de lengte en de breedte. */
export interface Foot {
  cz: number;
  long: number;
  wide: number;
}

/** Meet hoe een dier in rust op de grond staat (voor het schaduwvlekje, zie blobs.ts). Eén keer per model. */
export function modelFoot(scene: THREE.Object3D): Foot | null {
  scene.updateMatrixWorld(true);
  const box = new THREE.Box3(), v = new THREE.Vector3();
  scene.traverse(o => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const pos = mesh.geometry.getAttribute('position');
    for (let i = 0; i < pos.count; i += 3) box.expandByPoint(mesh.getVertexPosition(i, v).applyMatrix4(mesh.matrixWorld));
  });
  if (box.isEmpty()) return null;
  return { cz: (box.min.z + box.max.z) / 2, long: box.max.z - box.min.z, wide: box.max.x - box.min.x };
}
