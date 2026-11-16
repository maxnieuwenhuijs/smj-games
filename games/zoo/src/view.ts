// Het beeld: isometrische camera, tegels, hekken en voerbakken.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { FOODS, TERRAINS, TERRAIN_INFO, type FoodId } from './data';
import { Grid, H, W, edgeKey, type Edge } from './grid';

const SQRT2 = Math.SQRT2;
const SQRT3 = Math.sqrt(3);

function boxAt(w: number, h: number, d: number, x: number, y: number, z: number): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  return g;
}

// Een hekdeel loopt van (0,0,0) naar (1,0,0).
const FENCE_GEO = mergeGeometries([
  boxAt(0.13, 0.5, 0.13, 0, 0.25, 0),
  boxAt(0.13, 0.5, 0.13, 1, 0.25, 0),
  boxAt(1, 0.08, 0.06, 0.5, 0.17, 0),
  boxAt(1, 0.08, 0.06, 0.5, 0.37, 0),
])!;
const GATE_GEO = mergeGeometries([
  boxAt(0.15, 0.72, 0.15, 0, 0.36, 0),
  boxAt(0.15, 0.72, 0.15, 1, 0.36, 0),
  boxAt(1.15, 0.1, 0.15, 0.5, 0.75, 0),
  boxAt(0.82, 0.4, 0.06, 0.5, 0.25, 0),
])!;
const FENCE_MAT = new THREE.MeshStandardMaterial({ color: 0xc58a4b, roughness: 0.9 });
const GATE_MAT = new THREE.MeshStandardMaterial({ color: 0xe0584f, roughness: 0.9 });
const WOOD_MAT = new THREE.MeshStandardMaterial({ color: 0xa8743f, roughness: 0.9 });

export const toWorldX = (gx: number): number => gx - W / 2;
export const toWorldZ = (gy: number): number => gy - H / 2;

export interface TroughMesh {
  group: THREE.Group;
  content: THREE.Mesh;
}

export class View {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
  /** Het punt op de grond waar de camera naar kijkt. */
  readonly target = new THREE.Vector3(0, 0, 0);
  /** Hoeveel tegels er verticaal in beeld passen. */
  zoom = 9.5;

  private ground: THREE.InstancedMesh;
  private fences = new Map<string, THREE.Mesh>();
  private raycaster = new THREE.Raycaster();
  private plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private tmp = new THREE.Vector3();

  constructor(parent: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    parent.prepend(this.renderer.domElement);
    this.scene.background = new THREE.Color(0xbfe6ff);

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x9ad07a, 1.6));
    const sun = new THREE.DirectionalLight(0xfff4dd, 2.2);
    sun.position.set(-6, 14, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -13, right: 13, top: 13, bottom: -13, near: 1, far: 40 });
    this.scene.add(sun);

    // omgeving rond het park
    const outer = new THREE.Mesh(
      new THREE.PlaneGeometry(120, 120).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0x6fb44c, roughness: 1 }),
    );
    outer.position.y = -0.02;
    outer.receiveShadow = true;
    this.scene.add(outer);
    this.addTrees();

    // tegels
    const tileGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    this.ground = new THREE.InstancedMesh(tileGeo, new THREE.MeshStandardMaterial({ roughness: 1 }), W * H);
    this.ground.receiveShadow = true;
    const m = new THREE.Matrix4();
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        m.makeTranslation(toWorldX(x + 0.5), 0, toWorldZ(y + 0.5));
        this.ground.setMatrixAt(x + y * W, m);
      }
    this.scene.add(this.ground);

    addEventListener('resize', () => this.resize());
    this.resize();
  }

  private addTrees(): void {
    const trunk = new THREE.MeshStandardMaterial({ color: 0x8a5a33, roughness: 1 });
    const leaves = [0x4f9e45, 0x5bab4c, 0x468f3e].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 1 }));
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 46; i++) {
      const side = i % 4;
      const along = rnd() * (W + 8) - (W + 8) / 2;
      const out = W / 2 + 1.2 + rnd() * 5;
      const x = side === 0 ? along : side === 1 ? out : side === 2 ? along : -out;
      const z = side === 0 ? -out : side === 1 ? along : side === 2 ? out : along;
      const s = 0.8 + rnd() * 0.7;
      const tree = new THREE.Group();
      const t = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.6, 0.22), trunk);
      t.position.y = 0.3;
      const a = new THREE.Mesh(new THREE.BoxGeometry(1, 0.8, 1), leaves[i % 3]);
      a.position.y = 0.95;
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.55, 0.65), leaves[(i + 1) % 3]);
      b.position.y = 1.55;
      tree.add(t, a, b);
      tree.traverse(o => { o.castShadow = true; });
      tree.position.set(x, 0, z);
      tree.scale.setScalar(s);
      tree.rotation.y = rnd() * Math.PI;
      this.scene.add(tree);
    }
  }

  resize(): void {
    const w = innerWidth, h = innerHeight, a = w / h;
    this.camera.left = (-this.zoom * a) / 2;
    this.camera.right = (this.zoom * a) / 2;
    this.camera.top = this.zoom / 2;
    this.camera.bottom = -this.zoom / 2;
    this.camera.position.copy(this.target).add(this.tmp.set(30, 30, 30));
    this.camera.lookAt(this.target);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  /** Schuif het beeld: de grond volgt de vinger. */
  pan(dxPx: number, dyPx: number): void {
    const upp = this.zoom / innerHeight;
    this.target.x += (-dxPx * upp) / SQRT2 - (dyPx * upp * SQRT3) / SQRT2;
    this.target.z += (dxPx * upp) / SQRT2 - (dyPx * upp * SQRT3) / SQRT2;
    const lim = W / 2 + 2;
    this.target.x = Math.max(-lim, Math.min(lim, this.target.x));
    this.target.z = Math.max(-lim, Math.min(lim, this.target.z));
    this.resize();
  }

  zoomBy(factor: number): void {
    this.zoom = Math.max(5, Math.min(22, this.zoom * factor));
    this.resize();
  }

  /** Schermpunt naar rastercoördinaten op de grond. */
  groundPoint(clientX: number, clientY: number): { gx: number; gy: number } | null {
    const ndc = new THREE.Vector2((clientX / innerWidth) * 2 - 1, -(clientY / innerHeight) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hit = this.raycaster.ray.intersectPlane(this.plane, this.tmp);
    return hit ? { gx: hit.x + W / 2, gy: hit.z + H / 2 } : null;
  }

  /** Rasterpunt (met hoogte) naar schermpixels. */
  toScreen(gx: number, gy: number, height = 0): { x: number; y: number } {
    this.tmp.set(toWorldX(gx), height, toWorldZ(gy)).project(this.camera);
    return { x: ((this.tmp.x + 1) / 2) * innerWidth, y: ((1 - this.tmp.y) / 2) * innerHeight };
  }

  paintTerrain(grid: Grid): void {
    const c = new THREE.Color();
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const info = TERRAIN_INFO[TERRAINS[grid.terrain[x + y * W]]];
        this.ground.setColorAt(x + y * W, c.setHex(info.colors[(x + y) % 2]));
      }
    this.ground.instanceColor!.needsUpdate = true;
  }

  syncFences(grid: Grid): void {
    const wanted = new Map<string, { e: Edge; kind: number }>();
    for (const item of grid.edges()) wanted.set(edgeKey(item.e) + ':' + item.kind, item);
    for (const [key, mesh] of this.fences)
      if (!wanted.has(key)) {
        this.scene.remove(mesh);
        this.fences.delete(key);
      }
    for (const [key, { e, kind }] of wanted) {
      if (this.fences.has(key)) continue;
      const mesh = new THREE.Mesh(kind === 2 ? GATE_GEO : FENCE_GEO, kind === 2 ? GATE_MAT : FENCE_MAT);
      mesh.position.set(toWorldX(e.x), 0, toWorldZ(e.y));
      if (e.o === 'v') mesh.rotation.y = -Math.PI / 2;
      mesh.castShadow = true;
      this.scene.add(mesh);
      this.fences.set(key, mesh);
    }
  }

  makeTrough(x: number, y: number): TroughMesh {
    const group = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.2, 0.44), WOOD_MAT);
    base.position.y = 0.1;
    const rim = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.07, 0.52), FENCE_MAT);
    rim.position.y = 0.2;
    const content = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.1, 0.36), new THREE.MeshStandardMaterial({ roughness: 1 }));
    content.position.y = 0.24;
    content.visible = false;
    group.add(base, rim, content);
    group.traverse(o => { o.castShadow = true; });
    group.position.set(toWorldX(x + 0.5), 0, toWorldZ(y + 0.5));
    this.scene.add(group);
    return { group, content };
  }

  fillTrough(mesh: TroughMesh, food: FoodId | null, amount: number): void {
    mesh.content.visible = !!food && amount > 0;
    if (food) (mesh.content.material as THREE.MeshStandardMaterial).color.setHex(FOODS[food].color);
  }

  makePuddle(gx: number, gy: number): THREE.Mesh {
    const mesh = new THREE.Mesh(
      new THREE.CircleGeometry(0.14, 14).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0xf1e05a, roughness: 0.3, transparent: true }),
    );
    mesh.position.set(toWorldX(gx), 0.006, toWorldZ(gy));
    this.scene.add(mesh);
    return mesh;
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }
}
