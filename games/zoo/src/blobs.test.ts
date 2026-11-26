import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { BLOB, BlobShadows, blobShrink, blobStrength } from './blobs';

describe('de schaduwvlekjes', () => {
  it('op de grond het sterkst, weg als je hoog genoeg bent', () => {
    expect(blobStrength(0, 0.5, 0)).toBe(1);
    expect(blobStrength(0.25, 0.5, 0)).toBeGreaterThan(0.2);
    expect(blobStrength(0.25, 0.5, 0)).toBeLessThan(1);
    expect(blobStrength(0.5, 0.5, 0)).toBe(0);
    expect(blobStrength(3, 0.5, 0)).toBe(0);
  });

  it("'s nachts wat lichter, maar niet weg", () => {
    expect(blobStrength(0, 0.5, 1)).toBeCloseTo(1 - BLOB.night, 6);
    expect(blobStrength(0, 0.5, 0.5)).toBeGreaterThan(blobStrength(0, 0.5, 1));
  });

  it('een vlekje wordt kleiner als je omhoog gaat', () => {
    expect(blobShrink(0, 0.5)).toBe(1);
    expect(blobShrink(0.5, 0.5)).toBeCloseTo(0.7, 6);
  });

  it('blijft zacht: niet donkerder dan ongeveer een derde', () => {
    expect(BLOB.opacity).toBeGreaterThanOrEqual(0.2);
    expect(BLOB.opacity).toBeLessThanOrEqual(0.35);
  });

  it('zet de vlekjes op hun plek, gedraaid en uitgerekt, en groeit als er meer nodig zijn', () => {
    const scene = new THREE.Scene(), blobs = new BlobShadows(scene, 2);
    blobs.begin(0);
    blobs.add(1, 0, 2, 0, 0.5, 0.8, 0.4, Math.PI / 2);
    blobs.add(3, 0.2, 4, 0.6, 0.5, 0.8, 0.4, 0); // te hoog: geen vlekje
    blobs.add(5, 0, 6, 0, 0.5, 0.3, 0.3, 0);
    blobs.add(7, 0, 8, 0, 0.5, 0.3, 0.3, 0);
    blobs.end();
    expect(blobs.mesh.count).toBe(3);
    expect(scene.children.filter(c => c instanceof THREE.InstancedMesh)).toHaveLength(1);
    const m = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
    blobs.mesh.getMatrixAt(0, m);
    m.decompose(p, q, s);
    expect(p.x).toBeCloseTo(1, 6);
    expect(p.y).toBeCloseTo(BLOB.lift, 6);
    expect(p.z).toBeCloseTo(2, 6);
    expect(s.x).toBeCloseTo(0.4, 6);
    expect(s.z).toBeCloseTo(0.8, 6);
    // een kwartslag gedraaid: de lange kant (z) wijst nu langs x
    const along = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
    expect(along.x).toBeCloseTo(1, 6);
    blobs.mesh.getMatrixAt(2, m);
    expect(new THREE.Vector3().setFromMatrixPosition(m).x).toBeCloseTo(7, 6);
  });

  it('uit te zetten om te vergelijken', () => {
    const blobs = new BlobShadows(new THREE.Scene());
    blobs.on = false;
    blobs.begin(0);
    blobs.add(0, 0, 0, 0, 0.5, 1, 1, 0);
    blobs.end();
    expect(blobs.mesh.count).toBe(0);
    expect(blobs.mesh.visible).toBe(false);
  });
});
