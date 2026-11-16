// Het beeld: isometrische camera, tegels, hekken, voerbakken en het voorbeeld van wat je gaat plaatsen.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { TERRAINS, TERRAIN_INFO, type BedKind, type FoodId, type ShopKind } from './data';
import { Grid, H, W, edgeKey, tileXY, type Edge } from './grid';

const SQRT2 = Math.SQRT2;
const SQRT3 = Math.sqrt(3);
const OK_COLOR = 0x7dff7d;
const BAD_COLOR = 0xff5a4a;

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
// De poort is van hetzelfde hout, maar hoger en met een deurtje.
const GATE_GEO = mergeGeometries([
  boxAt(0.15, 0.72, 0.15, 0, 0.36, 0),
  boxAt(0.15, 0.72, 0.15, 1, 0.36, 0),
  boxAt(1.15, 0.1, 0.15, 0.5, 0.75, 0),
  boxAt(0.82, 0.07, 0.06, 0.5, 0.12, 0),
  boxAt(0.82, 0.07, 0.06, 0.5, 0.42, 0),
  boxAt(0.07, 0.36, 0.06, 0.2, 0.27, 0),
  boxAt(0.07, 0.36, 0.06, 0.5, 0.27, 0),
  boxAt(0.07, 0.36, 0.06, 0.8, 0.27, 0),
])!;
// Stenen muur voor sterke dieren.
const WALL_GEO = mergeGeometries([
  boxAt(1.1, 0.46, 0.2, 0.5, 0.23, 0),
  boxAt(0.22, 0.12, 0.24, 0.12, 0.52, 0),
  boxAt(0.22, 0.12, 0.24, 0.5, 0.52, 0),
  boxAt(0.22, 0.12, 0.24, 0.88, 0.52, 0),
])!;
const TROUGH_GEO = mergeGeometries([
  boxAt(0.8, 0.06, 0.48, 0, 0.03, 0),
  boxAt(0.8, 0.2, 0.06, 0, 0.13, -0.21),
  boxAt(0.8, 0.2, 0.06, 0, 0.13, 0.21),
  boxAt(0.06, 0.2, 0.36, -0.37, 0.13, 0),
  boxAt(0.06, 0.2, 0.36, 0.37, 0.13, 0),
])!;
// Slaapplekken. Het stalletje heeft alleen achterwanden en een afdakje, zodat je het slapende dier blijft zien.
const STRAW_GEO = mergeGeometries([
  boxAt(0.86, 0.07, 0.86, 0, 0.035, 0),
  boxAt(0.6, 0.06, 0.6, 0.03, 0.1, -0.02),
])!;
const SHED_WALL_GEO = mergeGeometries([
  boxAt(0.94, 0.62, 0.06, 0, 0.31, -0.44),
  boxAt(0.06, 0.62, 0.94, -0.44, 0.31, 0),
  boxAt(0.08, 0.62, 0.08, 0.44, 0.31, 0.44),
])!;
const SHED_ROOF_GEO = mergeGeometries([
  boxAt(1.08, 0.07, 0.5, 0, 0.66, -0.3),
  boxAt(0.5, 0.07, 1.08, -0.3, 0.66, 0),
])!;
const STRAW_MAT = new THREE.MeshStandardMaterial({ color: 0xe9d05a, roughness: 1 });
const ROOF_MAT = new THREE.MeshStandardMaterial({ color: 0xc0523f, roughness: 0.9 });
const FENCE_MAT = new THREE.MeshStandardMaterial({ color: 0xc58a4b, roughness: 0.9 });
const WOOD_MAT = new THREE.MeshStandardMaterial({ color: 0xa8743f, roughness: 0.9 });
const STONE_MAT = new THREE.MeshStandardMaterial({ color: 0xa9adb3, roughness: 1 });
const ROCK_MAT = new THREE.MeshStandardMaterial({ color: 0x8f949c, roughness: 1 });
const LEAF_MAT = new THREE.MeshStandardMaterial({ color: 0x5fa544, roughness: 1 });
const WHITE_MAT = new THREE.MeshStandardMaterial({ color: 0xf7f4ec, roughness: 0.9 });

// Slaapplekken voor de savanne: een platte rots en een boom met schaduw.
const ROCK_GEO = mergeGeometries([boxAt(0.84, 0.16, 0.74, 0, 0.08, 0), boxAt(0.5, 0.13, 0.46, -0.1, 0.22, 0.06)])!;
const TRUNK_GEO = boxAt(0.13, 1.05, 0.13, -0.36, 0.525, -0.36);
const CANOPY_GEO = mergeGeometries([boxAt(0.95, 0.2, 0.95, -0.18, 1.14, -0.18), boxAt(0.6, 0.16, 0.6, -0.2, 1.32, -0.2)])!;

// Winkels: een kraam met gestreept afdak, en een bankje.
const STALL_GEO = mergeGeometries([
  boxAt(0.86, 0.42, 0.46, 0, 0.21, 0.14),
  boxAt(0.07, 0.98, 0.07, -0.4, 0.49, -0.3),
  boxAt(0.07, 0.98, 0.07, 0.4, 0.49, -0.3),
  boxAt(0.07, 0.98, 0.07, -0.4, 0.49, 0.4),
  boxAt(0.07, 0.98, 0.07, 0.4, 0.49, 0.4),
])!;
const AWNING_A_GEO = mergeGeometries([boxAt(0.2, 0.07, 0.96, -0.4, 1.0, 0.05), boxAt(0.2, 0.07, 0.96, 0, 1.0, 0.05), boxAt(0.2, 0.07, 0.96, 0.4, 1.0, 0.05)])!;
const AWNING_B_GEO = mergeGeometries([boxAt(0.2, 0.07, 0.96, -0.2, 1.0, 0.05), boxAt(0.2, 0.07, 0.96, 0.2, 1.0, 0.05)])!;
const GOODS_GEO = mergeGeometries([boxAt(0.14, 0.14, 0.14, -0.22, 0.49, 0.2), boxAt(0.14, 0.2, 0.14, 0, 0.52, 0.2), boxAt(0.14, 0.14, 0.14, 0.22, 0.49, 0.2)])!;
const BENCH_GEO = mergeGeometries([
  boxAt(0.8, 0.06, 0.28, 0, 0.24, 0.02),
  boxAt(0.8, 0.26, 0.05, 0, 0.42, -0.12),
  boxAt(0.07, 0.24, 0.07, -0.33, 0.12, -0.08),
  boxAt(0.07, 0.24, 0.07, 0.33, 0.12, -0.08),
  boxAt(0.07, 0.24, 0.07, -0.33, 0.12, 0.12),
  boxAt(0.07, 0.24, 0.07, 0.33, 0.12, 0.12),
])!;
const STALL_COLORS: Record<string, [number, number]> = { foodstall: [0xe0584f, 0xf5a623], drinkstall: [0x4a90e2, 0x9fd8f5] };
const DARK_MAT = new THREE.MeshStandardMaterial({ color: 0x5a3d22, roughness: 1 });

// Losse stukjes voer: een bak met vier porties toont vier stukjes.
const FOOD_MATS = {
  carrot: new THREE.MeshStandardMaterial({ color: 0xf08a2c, roughness: 0.8 }),
  leaf: LEAF_MAT,
  hay: new THREE.MeshStandardMaterial({ color: 0xe9d05a, roughness: 1 }),
  apple: new THREE.MeshStandardMaterial({ color: 0xe0453a, roughness: 0.6 }),
  grain: new THREE.MeshStandardMaterial({ color: 0xe3c88f, roughness: 1 }),
  meat: new THREE.MeshStandardMaterial({ color: 0xc9553f, roughness: 0.8 }),
  bone: WHITE_MAT,
};
const CARROT_GEO = new THREE.ConeGeometry(0.06, 0.28, 6).rotateX(Math.PI / 2);
const LEAF_GEO = new THREE.BoxGeometry(0.05, 0.05, 0.08).translate(0, 0, -0.17);
const BALE_GEO = new THREE.BoxGeometry(0.14, 0.12, 0.3);
const APPLE_GEO = new THREE.IcosahedronGeometry(0.075, 0).translate(0, 0.02, 0);
const STALK_GEO = new THREE.BoxGeometry(0.03, 0.05, 0.03).translate(0, 0.1, 0);
const GRAIN_GEO = new THREE.BoxGeometry(0.14, 0.09, 0.28);
const MEAT_GEO = new THREE.BoxGeometry(0.13, 0.1, 0.2).translate(0, 0, -0.03);
const BONE_GEO = new THREE.BoxGeometry(0.04, 0.04, 0.12).translate(0, 0, 0.12);
const LEAVES_GEO = mergeGeometries([boxAt(0.13, 0.05, 0.3, 0, 0, 0), boxAt(0.1, 0.05, 0.2, 0.02, 0.05, 0.02)])!;

function foodPiece(food: FoodId): THREE.Object3D {
  const pair = (a: THREE.BufferGeometry, am: THREE.Material, b: THREE.BufferGeometry, bm: THREE.Material): THREE.Group => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(a, am), new THREE.Mesh(b, bm));
    return g;
  };
  switch (food) {
    case 'hay': return new THREE.Mesh(BALE_GEO, FOOD_MATS.hay);
    case 'grain': return new THREE.Mesh(GRAIN_GEO, FOOD_MATS.grain);
    case 'leaves': return new THREE.Mesh(LEAVES_GEO, FOOD_MATS.leaf);
    case 'fruit': return pair(APPLE_GEO, FOOD_MATS.apple, STALK_GEO, FOOD_MATS.leaf);
    case 'meat': return pair(MEAT_GEO, FOOD_MATS.meat, BONE_GEO, FOOD_MATS.bone);
    default: return pair(CARROT_GEO, FOOD_MATS.carrot, LEAF_GEO, FOOD_MATS.leaf);
  }
}

export const toWorldX = (gx: number): number => gx - W / 2;
export const toWorldZ = (gy: number): number => gy - H / 2;

export interface TroughMesh {
  group: THREE.Group;
  food: THREE.Group;
}

export class View {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
  /** Het punt op de grond waar de camera naar kijkt. */
  readonly target = new THREE.Vector3(0, 0, 0);
  /** Hoeveel tegels er verticaal in beeld passen. */
  zoom = 11;

  private ground: THREE.InstancedMesh;
  private fences = new Map<string, THREE.Mesh>();
  private raycaster = new THREE.Raycaster();
  private plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private tmp = new THREE.Vector3();

  // voorbeeld van wat je gaat plaatsen
  private ghostMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.6, depthWrite: false });
  private ghostFenceMesh = new THREE.Mesh(FENCE_GEO, this.ghostMat);
  private ghostGateMesh = new THREE.Mesh(GATE_GEO, this.ghostMat);
  private ghostTroughMesh = new THREE.Mesh(TROUGH_GEO, this.ghostMat);
  private ghostWallMesh = new THREE.Mesh(WALL_GEO, this.ghostMat);
  private ghostBeds: Record<BedKind, THREE.Mesh> = {
    straw: new THREE.Mesh(STRAW_GEO, this.ghostMat),
    shed: new THREE.Mesh(mergeGeometries([SHED_WALL_GEO, SHED_ROOF_GEO])!, this.ghostMat),
    rock: new THREE.Mesh(ROCK_GEO, this.ghostMat),
    shade: new THREE.Mesh(mergeGeometries([TRUNK_GEO, CANOPY_GEO])!, this.ghostMat),
  };
  private ghostStall = new THREE.Mesh(mergeGeometries([STALL_GEO, AWNING_A_GEO, AWNING_B_GEO])!, this.ghostMat);
  private ghostBench = new THREE.Mesh(BENCH_GEO, this.ghostMat);
  private ghostTileMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.75, depthWrite: false });
  private ghostTileMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.94, 0.94).rotateX(-Math.PI / 2), this.ghostTileMat);
  private ghostRingMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.85, depthWrite: false });
  private ghostRing = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.44, 28).rotateX(-Math.PI / 2), this.ghostRingMat);
  private ghostAnimals = new Map<string, THREE.Object3D>();
  private ghosts: THREE.Object3D[] = [];

  private flashes: { meshes: THREE.Mesh[]; mat: THREE.MeshBasicMaterial; life: number }[] = [];
  private flashGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);

  constructor(parent: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    parent.prepend(this.renderer.domElement);
    this.scene.background = new THREE.Color(0xbfe6ff);

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x9ad07a, 1.6));
    const sun = new THREE.DirectionalLight(0xfff4dd, 2.2);
    sun.position.set(-8, 20, 11);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -18, right: 18, top: 18, bottom: -18, near: 1, far: 60 });
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
    this.addEntrance();

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

    this.ghostTileMesh.position.y = 0.012;
    this.ghostRing.position.y = 0.014;
    this.ghosts = [this.ghostFenceMesh, this.ghostGateMesh, this.ghostWallMesh, this.ghostTroughMesh, ...Object.values(this.ghostBeds), this.ghostStall, this.ghostBench, this.ghostTileMesh, this.ghostRing];
    for (const g of this.ghosts) {
      g.visible = false;
      g.renderOrder = 5;
      this.scene.add(g);
    }

    addEventListener('resize', () => this.resize());
    this.resize();
  }

  /** De ingang van het park: hier komen de gasten binnen. */
  private addEntrance(): void {
    const x = toWorldX(Math.floor(W / 2)), z = toWorldZ(H) + 0.12;
    const gate = new THREE.Group();
    for (const dx of [-0.12, 1.12]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.5, 0.22), WOOD_MAT);
      post.position.set(x + dx, 0.75, z);
      gate.add(post);
    }
    const sign = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.44, 0.14), ROOF_MAT);
    sign.position.set(x + 0.5, 1.6, z);
    const star = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 0.18), STRAW_MAT);
    star.position.set(x + 0.5, 1.6, z);
    star.rotation.z = Math.PI / 4;
    gate.add(sign, star);
    gate.traverse(o => { o.castShadow = true; });
    this.scene.add(gate);
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
    this.zoom = Math.max(5, Math.min(30, this.zoom * factor));
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

  private placeEdge(mesh: THREE.Object3D, e: Edge): void {
    mesh.position.set(toWorldX(e.x), 0, toWorldZ(e.y));
    mesh.rotation.y = e.o === 'v' ? -Math.PI / 2 : 0;
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
      const mesh = new THREE.Mesh(kind === 3 ? WALL_GEO : kind === 2 ? GATE_GEO : FENCE_GEO, kind === 3 ? STONE_MAT : FENCE_MAT);
      this.placeEdge(mesh, e);
      mesh.castShadow = true;
      this.scene.add(mesh);
      this.fences.set(key, mesh);
    }
  }

  // ------------------------------------------------------------ voerbak
  makeTrough(x: number, y: number): TroughMesh {
    const group = new THREE.Group();
    const box = new THREE.Mesh(TROUGH_GEO, WOOD_MAT);
    const bottom = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.02, 0.36), DARK_MAT);
    bottom.position.y = 0.07;
    const food = new THREE.Group();
    group.add(box, bottom, food);
    box.castShadow = true;
    group.position.set(toWorldX(x + 0.5), 0, toWorldZ(y + 0.5));
    this.scene.add(group);
    return { group, food };
  }

  /** Toont net zoveel stukjes voer als er porties in de bak zitten. */
  fillTrough(mesh: TroughMesh, food: FoodId | null, amount: number): void {
    mesh.food.clear();
    if (!food) return;
    for (let i = 0; i < amount; i++) {
      const piece = foodPiece(food);
      piece.position.set(-0.255 + i * 0.17, food === 'hay' ? 0.14 : 0.13, 0);
      piece.rotation.y = food === 'veg' || food === 'meat' ? (i % 2 ? 0.25 : -0.25) : 0;
      piece.traverse(o => { o.castShadow = true; });
      mesh.food.add(piece);
    }
  }

  private at<T extends THREE.Object3D>(obj: T, x: number, y: number): T {
    obj.position.set(toWorldX(x + 0.5), 0, toWorldZ(y + 0.5));
    return obj;
  }

  makeBed(x: number, y: number, kind: BedKind): THREE.Group {
    const group = new THREE.Group();
    const add = (geo: THREE.BufferGeometry, m: THREE.Material, shadow = true): void => {
      const mesh = new THREE.Mesh(geo, m);
      mesh.castShadow = shadow;
      mesh.receiveShadow = !shadow;
      group.add(mesh);
    };
    if (kind === 'straw' || kind === 'shed') add(STRAW_GEO, STRAW_MAT, false);
    if (kind === 'shed') {
      add(SHED_WALL_GEO, WOOD_MAT);
      add(SHED_ROOF_GEO, ROOF_MAT);
    }
    if (kind === 'rock') add(ROCK_GEO, ROCK_MAT);
    if (kind === 'shade') {
      add(TRUNK_GEO, WOOD_MAT);
      add(CANOPY_GEO, LEAF_MAT);
    }
    this.scene.add(this.at(group, x, y));
    return group;
  }

  ghostBed(x: number, y: number, kind: BedKind, ok: boolean): void {
    this.ghostMat.color.setHex(ok ? OK_COLOR : BAD_COLOR);
    this.at(this.ghostBeds[kind], x, y).visible = true;
  }

  makeShop(x: number, y: number, kind: ShopKind): THREE.Group {
    const group = new THREE.Group();
    const add = (geo: THREE.BufferGeometry, m: THREE.Material): void => {
      const mesh = new THREE.Mesh(geo, m);
      mesh.castShadow = true;
      group.add(mesh);
    };
    if (kind === 'bench') add(BENCH_GEO, FENCE_MAT);
    else {
      const [stripe, goods] = STALL_COLORS[kind];
      add(STALL_GEO, WOOD_MAT);
      add(AWNING_A_GEO, new THREE.MeshStandardMaterial({ color: stripe, roughness: 0.9 }));
      add(AWNING_B_GEO, WHITE_MAT);
      add(GOODS_GEO, new THREE.MeshStandardMaterial({ color: goods, roughness: 0.8 }));
    }
    this.scene.add(this.at(group, x, y));
    return group;
  }

  ghostShop(x: number, y: number, kind: ShopKind, ok: boolean): void {
    this.ghostMat.color.setHex(ok ? OK_COLOR : BAD_COLOR);
    this.at(kind === 'bench' ? this.ghostBench : this.ghostStall, x, y).visible = true;
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

  // ------------------------------------------------------------ voorbeeld
  hideGhost(): void {
    for (const g of this.ghosts) g.visible = false;
    for (const g of this.ghostAnimals.values()) g.visible = false;
  }

  ghostFence(e: Edge, kind: number, ok: boolean): void {
    const mesh = kind === 3 ? this.ghostWallMesh : kind === 2 ? this.ghostGateMesh : this.ghostFenceMesh;
    this.ghostMat.color.setHex(ok ? OK_COLOR : BAD_COLOR);
    this.placeEdge(mesh, e);
    mesh.visible = true;
  }

  ghostTile(x: number, y: number, color: number): void {
    this.ghostTileMat.color.setHex(color);
    this.ghostTileMesh.position.set(toWorldX(x + 0.5), 0.012, toWorldZ(y + 0.5));
    this.ghostTileMesh.visible = true;
  }

  ghostTrough(x: number, y: number, ok: boolean): void {
    this.ghostMat.color.setHex(ok ? OK_COLOR : BAD_COLOR);
    this.ghostTroughMesh.position.set(toWorldX(x + 0.5), 0, toWorldZ(y + 0.5));
    this.ghostTroughMesh.visible = true;
  }

  /** Doorzichtig dier op de tegel, met een ring in de kleur van jongen of meisje. */
  ghostAnimal(key: string, make: () => THREE.Object3D, x: number, y: number, ok: boolean, ringColor: number): void {
    let ghost = this.ghostAnimals.get(key);
    if (!ghost) {
      ghost = make();
      ghost.traverse(o => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        const mat = (mesh.material as THREE.MeshStandardMaterial).clone();
        mat.transparent = true;
        mat.opacity = 0.6;
        mesh.material = mat;
        mesh.castShadow = false;
      });
      this.ghostAnimals.set(key, ghost);
      this.scene.add(ghost);
    }
    ghost.traverse(o => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) (mesh.material as THREE.MeshStandardMaterial).color.setHex(ok ? 0xffffff : 0xff7a6a);
    });
    ghost.position.set(toWorldX(x + 0.5), 0, toWorldZ(y + 0.5));
    ghost.rotation.y = Math.PI / 4;
    ghost.visible = true;
    this.ghostRingMat.color.setHex(ok ? ringColor : BAD_COLOR);
    this.ghostRing.position.set(toWorldX(x + 0.5), 0.014, toWorldZ(y + 0.5));
    this.ghostRing.visible = true;
  }

  // ------------------------------------------------------------ effecten
  /** Witte gloed over een stel tegels, bijvoorbeeld als een hek een verblijf is geworden. */
  flash(tiles: number[]): void {
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false });
    const meshes = tiles.map(i => {
      const [x, y] = tileXY(i);
      const mesh = new THREE.Mesh(this.flashGeo, mat);
      mesh.position.set(toWorldX(x + 0.5), 0.02, toWorldZ(y + 0.5));
      mesh.renderOrder = 4;
      this.scene.add(mesh);
      return mesh;
    });
    this.flashes.push({ meshes, mat, life: 1 });
  }

  update(dt: number): void {
    for (const f of this.flashes) {
      f.life -= dt / 1.1;
      f.mat.opacity = Math.max(0, f.life) * 0.85;
      if (f.life <= 0) {
        for (const m of f.meshes) this.scene.remove(m);
        f.mat.dispose();
      }
    }
    this.flashes = this.flashes.filter(f => f.life > 0);
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }
}
