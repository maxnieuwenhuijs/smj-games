// Hoe de blaadjes, de hoop blaadjes en de sneeuwballen eruitzien. De sneeuwpop die af is, komt uit view.ts: dat is
// dezelfde sneeuwpop als die uit de winkel, met een sjaal in een eigen kleur.
import * as THREE from 'three';
import { toWorldX, toWorldZ } from './view';

/** Herfstkleuren: oranje, geel, rood en bruin. */
export const LEAF_COLORS = [0xf08a24, 0xffc23a, 0xd9532b, 0xa8642e, 0xe8a33a];

/** Een paar platte blaadjes op de grond, elk met een eigen kleur (in de hoekpunten). */
function leafGeo(n: number, spread: number, seed: number): THREE.BufferGeometry {
  const pos: number[] = [], col: number[] = [], c = new THREE.Color();
  let s = seed;
  const rnd = (): number => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * spread, x = Math.cos(a) * d, z = Math.sin(a) * d;
    const turn = rnd() * Math.PI, len = 0.07 + rnd() * 0.04, wide = len * 0.55, y = 0.012 + i * 0.0015;
    const ux = Math.cos(turn), uz = Math.sin(turn);
    // een ruitje: punt, zijkant, andere punt, andere zijkant
    const p = [[x + ux * len, z + uz * len], [x - uz * wide, z + ux * wide], [x - ux * len, z - uz * len], [x + uz * wide, z - ux * wide]];
    for (const k of [0, 1, 2, 0, 2, 3]) pos.push(p[k][0], y, p[k][1]);
    c.setHex(LEAF_COLORS[Math.floor(rnd() * LEAF_COLORS.length)]);
    for (let k = 0; k < 6; k++) col.push(c.r, c.g, c.b);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  return geo;
}

const LEAF_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide });
const PATCH_GEO = leafGeo(9, 0.22, 7);
const SNOW_MAT = new THREE.MeshStandardMaterial({ color: 0xfbfdff, roughness: 0.85 });

/**
 * Alle plekjes blaadjes in het park, in één keer getekend. `k` is hoe groot een plekje is (0 tot 1): zo groeit
 * het als de blaadjes vallen en krimpt het weg als de herfst voorbij is.
 */
export class LeafLayer {
  private mesh: THREE.InstancedMesh | null = null;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private up = new THREE.Vector3(0, 1, 0);
  private p = new THREE.Vector3();
  private s = new THREE.Vector3();

  constructor(private scene: THREE.Scene, private room: number) {}

  set(patches: { gx: number; gy: number; rot: number; k: number }[]): void {
    if (!this.mesh) {
      this.mesh = new THREE.InstancedMesh(PATCH_GEO, LEAF_MAT, this.room);
      this.mesh.frustumCulled = false;
      this.mesh.receiveShadow = true;
      this.mesh.renderOrder = 1;
      this.scene.add(this.mesh);
    }
    const n = Math.min(this.room, patches.length);
    for (let i = 0; i < n; i++) {
      const pt = patches[i];
      this.q.setFromAxisAngle(this.up, pt.rot);
      this.p.set(toWorldX(pt.gx), 0, toWorldZ(pt.gy));
      this.s.set(pt.k, 1, pt.k);
      this.mesh.setMatrixAt(i, this.m.compose(this.p, this.q, this.s));
    }
    this.mesh.count = n;
    this.mesh.visible = n > 0;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

/** Een hoop blaadjes: een bolletje met gekleurde vlekjes en wat losse blaadjes eromheen. Het spel schaalt hem mee met de hoop. */
export function makePile(scene: THREE.Scene, gx: number, gy: number): THREE.Group {
  const dome = new THREE.IcosahedronGeometry(0.42, 2).scale(1, 0.48, 1);
  const c = new THREE.Color(), col: number[] = [], at = dome.getAttribute('position');
  for (let i = 0; i < at.count; i++) {
    c.setHex(LEAF_COLORS[(i * 7 + Math.floor(Math.abs(at.getX(i) * 31 + at.getZ(i) * 17))) % LEAF_COLORS.length]);
    col.push(c.r, c.g, c.b);
  }
  dome.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const group = new THREE.Group();
  const heap = new THREE.Mesh(dome, LEAF_MAT);
  heap.castShadow = true;
  group.add(heap, new THREE.Mesh(leafGeo(14, 0.5, 31), LEAF_MAT));
  group.position.set(toWorldX(gx), 0, toWorldZ(gy));
  scene.add(group);
  return group;
}

/**
 * Een sneeuwpop in aanbouw, met de maten van de sneeuwpop uit de winkel: de buik (onderdeel 0), de middelste bal (1)
 * en het hoofd (2). De buik rolt om zijn eigen midden. Het spel laat de ballen een voor een zien.
 */
export function makeSnowball(scene: THREE.Scene): THREE.Group {
  const group = new THREE.Group();
  for (const [r, y] of [[0.27, 0.25], [0.2, 0.62], [0.15, 0.9]]) {
    const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 2), SNOW_MAT);
    ball.position.y = y;
    ball.castShadow = true;
    group.add(ball);
  }
  // een paar klontjes op de buik, zodat je hem ziet rollen
  for (const [x, y, z] of [[0.2, 0.1, 0.12], [-0.12, -0.15, 0.18], [0.05, 0.22, -0.16]]) {
    const lump = new THREE.Mesh(new THREE.IcosahedronGeometry(0.06, 0), SNOW_MAT);
    lump.position.set(x, y, z);
    group.children[0].add(lump);
  }
  scene.add(group);
  return group;
}
