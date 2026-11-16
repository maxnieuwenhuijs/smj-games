// Laden van de diermodellen. Elk dier in het park krijgt een eigen kopie met een eigen animatiespeler.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';

/** Maten van een model in model-eenheden (zie tools/animals). */
export interface ModelInfo {
  height: number;
  back: number;
  length: number;
}

/** Eén model-eenheid is zoveel tegels. */
export const MODEL_SCALE = 0.62;

const loader = new GLTFLoader();
const cache = new Map<string, { scene: THREE.Object3D; clips: THREE.AnimationClip[] }>();
let manifest: Record<string, ModelInfo> = {};

export async function loadManifest(): Promise<void> {
  const res = await fetch('./models/manifest.json');
  manifest = ((await res.json()) as { models: Record<string, ModelInfo> }).models;
}

export function modelInfo(key: string): ModelInfo {
  return manifest[key] ?? { height: 1, back: 0.4, length: 1.2 };
}

export async function loadModel(key: string): Promise<void> {
  if (cache.has(key)) return;
  const gltf = await loader.loadAsync(`./models/${key}.glb`);
  gltf.scene.traverse(o => {
    if ((o as THREE.Mesh).isMesh) {
      o.castShadow = true;
      o.frustumCulled = false;
    }
  });
  cache.set(key, { scene: gltf.scene, clips: gltf.animations });
}

export interface Spawned {
  root: THREE.Object3D;
  mixer: THREE.AnimationMixer;
  actions: Record<string, THREE.AnimationAction>;
}

export function spawnModel(key: string): Spawned {
  const src = cache.get(key);
  if (!src) throw new Error(`Model niet geladen: ${key}`);
  const root = cloneSkinned(src.scene);
  root.scale.setScalar(MODEL_SCALE);
  const mixer = new THREE.AnimationMixer(root);
  const actions: Record<string, THREE.AnimationAction> = {};
  for (const clip of src.clips) actions[clip.name] = mixer.clipAction(clip);
  return { root, mixer, actions };
}

export function spawnStatic(key: string): THREE.Object3D {
  const src = cache.get(key);
  if (!src) throw new Error(`Model niet geladen: ${key}`);
  const root = src.scene.clone();
  root.scale.setScalar(MODEL_SCALE);
  return root;
}
