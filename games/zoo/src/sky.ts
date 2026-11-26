// De lucht om de wereld heen: een grote bol met een verloop van diep blauw bovenin naar licht bij de horizon, een
// paar zachte wolken die langzaam rond drijven, en een waas over de wereld buiten het park in de kleur van de
// horizon. Alles samen twee extra tekenbeurten, geen extra licht of schaduw.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { H, W } from './grid';

/**
 * Het waas buiten het park (in tegels vanaf de rand van het raster): vanaf `near` begint het, bij `far` zie je alleen
 * nog de kleur van de horizon (daar houdt het gras op). `max` is hoe dik het hooguit wordt. Binnen het park blijft
 * alles scherp; de weg ligt zo'n zes tegels voor het park.
 */
export const HAZE = { near: 6, far: 38, max: 1 };
/** Hoe groot de lucht is (moet binnen het verste vlak van beide camera's passen: 160 en 200). */
const SKY_R = 150;
/** De wolken: zoveel, zo ver van het midden van het park, zo hoog, en zo snel draaien ze rond (radialen per tel). */
const CLOUDS = { count: 7, near: 96, far: 114, low: 17, high: 30, spin: 0.004 };

// ---------------------------------------------------------------- het waas
// De gewone mist van Three.js kijkt alleen naar de afstand tot de camera. Van boven is die overal bijna even groot,
// dus kijkt het waas naar hoe ver iets buiten het park ligt. Het dikste van de twee telt: zo blijft de mist van de
// loopstand gewoon werken.
const f = (n: number): string => n.toFixed(2);
const ORIGINAL = {
  fog_pars_vertex: THREE.ShaderChunk.fog_pars_vertex,
  fog_vertex: THREE.ShaderChunk.fog_vertex,
  fog_pars_fragment: THREE.ShaderChunk.fog_pars_fragment,
  fog_fragment: THREE.ShaderChunk.fog_fragment,
};
const HAZY = {
  fog_pars_vertex: '#ifdef USE_FOG\n\tvarying float vFogDepth;\n\tvarying vec2 vFogXZ;\n#endif',
  // waar het punt in de wereld ligt: terug van het beeld van de camera (draaien is omkeren met transpose)
  fog_vertex: '#ifdef USE_FOG\n\tvFogDepth = - mvPosition.z;\n\tvFogXZ = ( transpose( mat3( viewMatrix ) ) * ( mvPosition.xyz - viewMatrix[ 3 ].xyz ) ).xz;\n#endif',
  fog_pars_fragment: ORIGINAL.fog_pars_fragment.replace('varying float vFogDepth;', 'varying float vFogDepth;\n\tvarying vec2 vFogXZ;'),
  fog_fragment: ORIGINAL.fog_fragment.replace(
    '\tgl_FragColor.rgb = mix(',
    `\tvec2 hazeOut = max( abs( vFogXZ ) - vec2( ${f(W / 2)}, ${f(H / 2)} ), 0.0 );\n` +
      `\tfogFactor = max( fogFactor, ${f(HAZE.max)} * smoothstep( ${f(HAZE.near)}, ${f(HAZE.far)}, length( hazeOut ) ) );\n` +
      '\tgl_FragColor.rgb = mix(',
  ),
};

/**
 * Het waas aan of uit. Let op: Three.js bewaart gemaakte shaders per soort; daarom wisselt view.ts tegelijk de
 * tone mapping, zodat alles opnieuw gemaakt wordt met de goede stukjes.
 */
export function useHaze(on: boolean): void {
  Object.assign(THREE.ShaderChunk, on ? HAZY : ORIGINAL);
}
useHaze(true);

// ---------------------------------------------------------------- de lucht
const SKY_VERT = `
varying vec3 vDir;
void main() {
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`;
const SKY_FRAG = `
uniform vec3 top;
uniform vec3 horizon;
varying vec3 vDir;
void main() {
  // onder de horizon: de kleur van de horizon (die heeft het waas ook); daarboven langzaam dieper blauw
  float h = normalize( vDir ).y;
  float t = pow( smoothstep( 0.0, 0.8, h ), 0.75 );
  gl_FragColor = vec4( mix( horizon, top, t ), 1.0 );
  #include <colorspace_fragment>
}`;

/** Een klein vast toeval, zodat de wolken elke keer op dezelfde plek staan. */
function rand(seed: number): () => number {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

/** Eén vorm voor alle wolken samen: elke wolk is een paar platte bollen met hoekjes, bovenkant licht en onderkant iets blauwer. */
function cloudGeometry(): THREE.BufferGeometry {
  const r = rand(7);
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < CLOUDS.count; i++) {
    const a = (i / CLOUDS.count) * Math.PI * 2 + r() * 0.5;
    const dist = CLOUDS.near + r() * (CLOUDS.far - CLOUDS.near);
    const y = CLOUDS.low + r() * (CLOUDS.high - CLOUDS.low);
    const cx = Math.cos(a) * dist, cz = Math.sin(a) * dist;
    // de wolk ligt dwars op de lijn naar het midden, zodat je hem van binnen breed ziet
    const side = new THREE.Vector3(-Math.sin(a), 0, Math.cos(a));
    const puffs = 4 + Math.floor(r() * 3);
    for (let p = 0; p < puffs; p++) {
      const along = (p - (puffs - 1) / 2) * 3.4 + (r() - 0.5) * 1.5;
      const size = 3.2 + r() * 2.6 - Math.abs(p - (puffs - 1) / 2) * 0.6;
      const g = new THREE.IcosahedronGeometry(size, 1);
      g.scale(1, 0.62, 0.85);
      g.rotateY(r() * Math.PI);
      g.translate(cx + side.x * along, y + r() * 1.2 + (size - 3) * 0.3, cz + side.z * along);
      parts.push(g.toNonIndexed());
      g.dispose();
    }
  }
  const geo = mergeGeometries(parts);
  for (const p of parts) p.dispose();
  geo.computeVertexNormals();
  // per vlakje een kleur: van boven bijna wit, van onder zacht grijsblauw (de hoekjes geven het lage-poly-gevoel)
  const n = geo.getAttribute('normal'), count = n.count;
  const colors = new Float32Array(count * 3);
  for (let v = 0; v < count; v++) {
    const up = n.getY(v) * 0.5 + 0.5, k = 0.78 + 0.22 * up;
    colors[v * 3] = k * (0.93 + 0.07 * up);
    colors[v * 3 + 1] = k * (0.95 + 0.05 * up);
    colors[v * 3 + 2] = k;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.deleteAttribute('uv');
  return geo;
}

export class SkyDome {
  readonly dome: THREE.Mesh;
  readonly clouds: THREE.Mesh;
  private mat: THREE.ShaderMaterial;
  private cloudMat = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, toneMapped: false });

  constructor(scene: THREE.Scene) {
    this.mat = new THREE.ShaderMaterial({
      uniforms: { top: { value: new THREE.Color(0x6fb0f0) }, horizon: { value: new THREE.Color(0xbfe6ff) } },
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      side: THREE.BackSide,
      depthTest: false,
      depthWrite: false,
      fog: false,
      toneMapped: false,
    });
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(SKY_R, 32, 16), this.mat);
    // als eerste getekend, achter alles
    this.dome.renderOrder = -1000;
    this.dome.frustumCulled = false;
    this.clouds = new THREE.Mesh(cloudGeometry(), this.cloudMat);
    this.clouds.frustumCulled = false;
    this.clouds.renderOrder = -999;
    scene.add(this.dome, this.clouds);
  }

  /** De kleuren van nu: bovenin, de horizon, en de wolken. */
  setColors(top: THREE.Color, horizon: THREE.Color, cloud: THREE.Color): void {
    (this.mat.uniforms.top.value as THREE.Color).copy(top);
    (this.mat.uniforms.horizon.value as THREE.Color).copy(horizon);
    this.cloudMat.color.copy(cloud);
  }

  set visible(on: boolean) {
    this.dome.visible = this.clouds.visible = on;
  }

  /** De bol staat altijd om de camera heen; de wolken drijven langzaam rond het park. */
  step(dt: number, eye: THREE.Vector3): void {
    this.dome.position.copy(eye);
    this.clouds.rotation.y += dt * CLOUDS.spin;
  }
}
