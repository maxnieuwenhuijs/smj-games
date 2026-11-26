// De trainer van de dierenshow: het poppetje op het podium bij de tribune (zie SHOP_PARTS.show in view.ts). Hij
// roept de gasten, geeft bij elk kunstje een sein (zie SHOW_ROUTINE in data.ts), gooit de hapjes en buigt na afloop.
import * as THREE from 'three';
import type { ShowCue } from './data';
import { faceFor, setFace } from './faces';
import { makeFigure } from './people';

/** Waar de trainer staat, gezien vanuit het midden van de tribune: op het podium aan de kant van het water. */
export const TRAINER_AT = { x: 0, y: 0.13, z: -0.87 };
/** Zo hoog is de hand van de trainer ongeveer (boven de grond): daar komt het hapje vandaan. */
export const TRAINER_HAND = 0.75;
/** Zoveel tellen na het sein laat de trainer het hapje los. */
export const TOSS_AFTER = 0.42;
/** Wat de trainer doet: een sein bij een kunstje, de gasten roepen, of gewoon staan. */
export type TrainerPose = ShowCue | 'call' | 'idle';

const SCALE = 1.15;
/** Zo lang duurt elk sein; daarna staat de trainer weer gewoon. */
const POSE_SECONDS: Record<ShowCue, number> = { up: 1.7, point: 1.8, throw: 1.5, bow: 2.1 };
const BUCKET_GEO = new THREE.CylinderGeometry(0.04, 0.03, 0.065, 10).translate(0, -0.225, 0.02);
const FISH_GEO = new THREE.BoxGeometry(0.03, 0.085, 0.022).translate(0, -0.21, 0.03);
const BUCKET_MAT = new THREE.MeshStandardMaterial({ color: 0xd6dde3, roughness: 0.5, metalness: 0.3 });
const FISH_MAT = new THREE.MeshStandardMaterial({ color: 0x8fb4d1, roughness: 0.6 });

const smooth = (a: number, b: number, v: number): number => {
  const k = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return k * k * (3 - 2 * k);
};
/** Zacht aanzwellen en weer afnemen: 0 aan het begin en het eind van `len` tellen, 1 ertussen. */
const swell = (t: number, len: number, edge: number): number => smooth(0, edge, t) * (1 - smooth(len - edge, len, t));

export class Trainer {
  readonly mesh: THREE.Group;
  private limbs: THREE.Mesh[];
  private head: THREE.Mesh;
  private fish: THREE.Mesh;
  private seed = Math.random();
  private clock = Math.random() * 6;
  private pose: TrainerPose = 'idle';
  /** Zo lang staat de trainer al in deze houding. */
  private t = 0;
  /** 0 = hij is er niet (naar huis), 1 = hij staat op het podium. */
  private here = 0;
  /** 0 = met het gezicht naar het water, 1 = naar het publiek. */
  private turn = 0;

  constructor() {
    const figure = makeFigure({ shirt: 0x2f7fb8, hat: 0xffd23f });
    this.mesh = figure.group;
    this.limbs = figure.limbs;
    this.head = figure.head;
    this.mesh.position.set(TRAINER_AT.x, TRAINER_AT.y, TRAINER_AT.z);
    // eerst draaien, dan buigen: zo buigt hij altijd naar voren, welke kant hij ook op kijkt
    this.mesh.rotation.order = 'YXZ';
    this.mesh.rotation.y = Math.PI;
    this.mesh.visible = false;
    // een emmertje met vis in de linkerhand, en in de rechterhand het hapje dat hij gaat gooien
    const bucket = new THREE.Mesh(BUCKET_GEO, BUCKET_MAT);
    bucket.castShadow = true;
    this.limbs[3].add(bucket);
    this.fish = new THREE.Mesh(FISH_GEO, FISH_MAT);
    this.fish.visible = false;
    this.limbs[2].add(this.fish);
  }

  /** Een nieuw sein, of de gasten roepen. */
  cue(pose: TrainerPose): void {
    this.pose = pose;
    this.t = 0;
  }

  /** `on`: het park is open en er zijn dieren voor een show; anders is de trainer naar huis. */
  update(dt: number, on: boolean): void {
    this.here = on ? Math.min(1, this.here + dt * 2.5) : Math.max(0, this.here - dt * 2.5);
    this.mesh.visible = this.here > 0;
    if (!this.mesh.visible) return;
    this.mesh.scale.setScalar(SCALE * Math.max(0.05, this.here));
    this.clock += dt;
    this.t += dt;
    const t = this.t, sway = Math.sin(this.clock * 2) * 0.14;
    let turn = 0, lean = 0, hop = 0, rightX = sway, rightZ = 0, leftX = -sway * 0.4, leftZ = 0;
    this.fish.visible = false;
    if (this.pose === 'call') {
      // kom kijken: naar het publiek gekeerd, zwaaien en een beetje springen
      turn = 1;
      rightX = -2.65 + Math.sin(this.clock * 9) * 0.25;
      rightZ = Math.sin(this.clock * 9) * 0.4;
      hop = Math.abs(Math.sin(this.clock * 5)) * 0.04;
    } else if (this.pose === 'up') {
      // spring! Beide armen de lucht in, met een sprongetje
      const k = swell(t, POSE_SECONDS.up, 0.18);
      rightX = leftX = -2.9 * k;
      rightZ = -0.28 * k;
      leftZ = 0.28 * k;
      hop = Math.sin(Math.min(1, t / 0.45) * Math.PI) * 0.1;
    } else if (this.pose === 'point') {
      // jij daar: wijzen naar het dier dat aan de beurt is
      const k = swell(t, POSE_SECONDS.point, 0.2);
      rightX = -1.5 * k;
      lean = 0.16 * k;
    } else if (this.pose === 'throw') {
      // uithalen en gooien
      const back = smooth(0, 0.26, t), forward = smooth(0.3, TOSS_AFTER + 0.1, t), rest = 1 - smooth(1, POSE_SECONDS.throw, t);
      rightX = (-3.05 * back + 2.1 * forward) * rest;
      lean = (-0.14 * back + 0.34 * forward) * rest;
      this.fish.visible = t < TOSS_AFTER;
    } else if (this.pose === 'bow') {
      // dank u wel: een diepe buiging voor het publiek
      turn = 1;
      const k = swell(t, POSE_SECONDS.bow, 0.4);
      lean = 0.44 * k;
      rightX = leftX = 0.55 * k;
    }
    if (this.pose !== 'idle' && this.pose !== 'call' && t > POSE_SECONDS[this.pose]) this.pose = 'idle';
    this.turn += (turn - this.turn) * Math.min(1, dt * 7);
    this.mesh.rotation.y = Math.PI * (1 - this.turn);
    this.mesh.rotation.x = lean;
    this.mesh.position.y = TRAINER_AT.y + hop;
    const [, , right, left] = this.limbs;
    right.rotation.x = rightX;
    right.rotation.z = rightZ;
    left.rotation.x = leftX;
    left.rotation.z = leftZ;
    setFace(this.head, faceFor(this.pose === 'idle' ? null : 'joy', 'fine', this.clock, this.seed));
  }
}
