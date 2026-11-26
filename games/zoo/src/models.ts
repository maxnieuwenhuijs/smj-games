// Laden van de diermodellen. Elk dier in het park krijgt een eigen kopie met een eigen animatiespeler.
// Een soort wordt pas geladen als hij vrijgespeeld is, zodat het spel snel start.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { ICON_IDS, icon, type IconId } from './icons';
import { modelFoot, shadeModel } from './shade';

/** Maten van een model in model-eenheden (zie tools/animals). */
export interface ModelInfo {
  height: number;
  back: number;
  length: number;
  /** Vingerafdruk van het bestand; verandert als het model verandert. */
  v?: string;
}

/** Eén model-eenheid is zoveel tegels. */
export const MODEL_SCALE = 0.62;
const VARIANTS = ['male', 'female', 'young_m', 'young_f'];

// de modellen zijn ingepakt met meshopt (tools/animals/optimize.mjs)
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const cache = new Map<string, { scene: THREE.Object3D; clips: THREE.AnimationClip[] }>();
const pending = new Map<string, Promise<void>>();
const pngIcons = new Set<string>();
let manifest: Record<string, ModelInfo> = {};

export async function loadManifest(): Promise<void> {
  const res = await fetch('./models/manifest.json', { cache: 'no-cache' });
  manifest = ((await res.json()) as { models: Record<string, ModelInfo> }).models;
}

export function modelInfo(key: string): ModelInfo {
  return manifest[key] ?? { height: 1, back: 0.4, length: 1.2 };
}

/** Is er een model voor deze soort? Levels met een soort zonder model doen nog niet mee. */
export function hasSpecies(species: string): boolean {
  return `${species}_male` in manifest && `${species}_female` in manifest;
}

export function loadModel(key: string): Promise<void> {
  if (cache.has(key)) return Promise.resolve();
  let p = pending.get(key);
  if (!p) {
    const v = manifest[key]?.v;
    p = loader.loadAsync(`./models/${key}.glb${v ? `?v=${v}` : ''}`).then(gltf => {
      gltf.scene.traverse(o => {
        if ((o as THREE.Mesh).isMesh) {
          o.castShadow = true;
          o.frustumCulled = false;
        }
      });
      // een beetje schaduw in de kleuren (buik en poten donkerder), één keer per model: alle kopieën delen de vorm
      shadeModel(gltf.scene);
      // hoe het dier op de grond staat, voor het schaduwvlekje eronder (een kopie neemt userData mee)
      gltf.scene.userData.foot = modelFoot(gltf.scene);
      cache.set(key, { scene: gltf.scene, clips: gltf.animations });
    });
    pending.set(key, p);
  }
  return p;
}

export function loadSpecies(species: string): Promise<unknown> {
  return Promise.all(VARIANTS.filter(v => `${species}_${v}` in manifest).map(v => loadModel(`${species}_${v}`)));
}

export function modelReady(key: string): boolean {
  return cache.has(key);
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

// ------------------------------------------------------------ plaatjes van de soorten
/** Het kopplaatje krijgt dezelfde vingerafdruk als het model, zodat een nieuw plaatje ook echt wordt opgehaald. */
function iconUrl(species: string): string {
  const v = manifest[`${species}_male`]?.v;
  return `./icons/${species}.png${v ? `?v=${v}` : ''}`;
}

/** Kijkt welke soorten een eigen kopplaatje hebben (public/icons); de rest krijgt een getekend plaatje. */
export function probeIcons(species: string[]): Promise<unknown> {
  return Promise.all(
    species.map(
      sp =>
        new Promise<void>(resolve => {
          const img = new Image();
          img.onload = () => {
            pngIcons.add(sp);
            resolve();
          };
          img.onerror = () => resolve();
          img.src = iconUrl(sp);
        }),
    ),
  );
}

export function speciesIcon(species: string, cls = ''): string {
  if (pngIcons.has(species)) return `<img class="ic ${cls}" src="${iconUrl(species)}" alt="" draggable="false" decoding="sync">`;
  return icon((ICON_IDS as string[]).includes(species) ? (species as IconId) : 'paw', cls);
}
