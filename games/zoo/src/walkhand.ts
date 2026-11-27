// Wat je in de loopstand in je hand hebt: iets van een kraam, rechtsonder in beeld, zoals in een spel waarin je zelf
// rondloopt. Het wiebelt mee met je stapjes. Eten en drinken doe je vanzelf, hapje voor hapje: je hand gaat naar je
// mond, je hapt (kruimels), likt of drinkt (het bekertje kantelt) en je kauwt na, waarbij je hoofd meeknikt. Een hoed
// zet je vanzelf op. Tik op het scherm (of Spatie) voor meteen een hapje, een knuffel of een rukje aan de ballon.
// De regels staan in held.ts, het kopen in game.ts.
import * as THREE from 'three';
import { t } from '@smj/shared';
import { sfx } from './audio';
import { HELD, SHOP_OF, eatPose, hold, paintOf, sizeLeft, useHeld, useSeconds, usesItself, type Held, type HeldUse } from './held';
import { icon, type IconId } from './icons';
import { PRODUCTS } from './data';
import { makeHeld } from './people';
import type { FacePaint } from './guestfun';
import type { View } from './view';
import { touchy } from './walkmode';

/** Wat de hand van het spel nodig heeft. */
export interface HandHost {
  view: View;
  /** Een plaatje of woordje dat even op het scherm opstijgt (zie Hud.float). */
  float(html: string, x: number, y: number, cls?: string): void;
  /** Je stapjes: hoe ver je al gelopen hebt (voor het wiebelen) en hoe hard je nu loopt (0 tot 1). */
  gait(): [phase: number, moving: number];
  /** Het plaatje van iets wat je kunt kopen. */
  pic(product: string): string;
}

/** Waar je hand is, gezien vanuit je ogen (rechts, omlaag, vooruit is min), per soort ding; en hoe groot en schuin het is. */
const REST: Record<Held['kind'], { at: [number, number, number]; size: number; tilt: number }> = {
  food: { at: [0.15, -0.165, -0.33], size: 1.35, tilt: 0.35 },
  drink: { at: [0.15, -0.17, -0.33], size: 1.25, tilt: 0.3 },
  ice: { at: [0.15, -0.17, -0.33], size: 1.25, tilt: 0.25 },
  floss: { at: [0.15, -0.18, -0.34], size: 1.15, tilt: 0.2 },
  // de ballon leunt naar voren: zo zweeft hij rechtsboven in beeld
  balloon: { at: [0.17, -0.2, -0.4], size: 1, tilt: -0.95 },
  hat: { at: [0.14, -0.15, -0.34], size: 0.55, tilt: 0.55 },
  plush: { at: [0.14, -0.16, -0.3], size: 1.6, tilt: 0.15 },
};
/** Naar je mond: daar gaat een hapje of slokje naartoe (midden onder in beeld, vlak voor je neus). */
const MOUTH: [number, number, number] = [0.012, -0.098, -0.235];
/** Zo ver knikt je hoofd mee (radialen): omlaag naar je hand als je hapt, en op en neer bij het kauwen. */
const NOD = { eat: -0.07, chew: 0.016 };
const USE_SOUND: Record<HeldUse, [string, number]> = {
  bite: ['guest.bite', 0.6], lick: ['guest.yum', 0.6], sip: ['guest.slurp', 0.6], wear: ['chime', 0.4], tug: ['ride.boing', 0.3], hug: ['heart', 0.5],
};
const CRUMB_GEO = new THREE.BoxGeometry(0.006, 0.006, 0.006);
/** Je hand: een vuistje dat het ding vasthoudt, net onder in beeld. */
const FIST_GEO = new THREE.BoxGeometry(0.05, 0.045, 0.05).translate(0, -0.03, 0);
const FIST_MAT = new THREE.MeshStandardMaterial({ color: 0xf2c49b, roughness: 0.9 });
const crumbMats = new Map<number, THREE.MeshBasicMaterial>();
const crumbMat = (color: number): THREE.MeshBasicMaterial => {
  let m = crumbMats.get(color);
  if (!m) crumbMats.set(color, (m = new THREE.MeshBasicMaterial({ color })));
  return m;
};
const colorOf = (product: string): number => PRODUCTS.find(p => p.id === product)?.color ?? 0xe0584f;
const smooth = (k: number): number => {
  const v = Math.max(0, Math.min(1, k));
  return v * v * (3 - 2 * v);
};
const div = (id: string): HTMLDivElement => {
  const d = document.createElement('div');
  d.id = id;
  d.hidden = true;
  return d;
};

export class WalkHand {
  /** Wat je vasthoudt, de hoed op je hoofd en het gezicht dat geschminkt is. Weg als je de loopstand uit gaat. */
  held: Held | null = null;
  hat: string | null = null;
  paint: FacePaint | null = null;
  /** Hangt aan de loopcamera: alles hierin staat vast in beeld. */
  private root = new THREE.Group();
  private model: THREE.Group | null = null;
  private fist = new THREE.Mesh(FIST_GEO, FIST_MAT);
  /** Wat je hand nu doet, en hoe lang al (tellen). */
  private act: { use: HeldUse; t: number; gone: boolean; from: number; to: number; chomps: number } | null = null;
  /** Over zoveel tellen neem je vanzelf het volgende hapje; en zo lang kauw je nog na. */
  private autoIn = 0;
  private chew = 0;
  private crumbs: { mesh: THREE.Mesh; v: THREE.Vector3; life: number }[] = [];
  private clock = 0;
  /** Het rijtje plaatjes om te kiezen, en bij welke kraam (op het raster). */
  private pick = div('walkpick');
  private pickAt: [number, number] | null = null;
  private pickIds: string[] = [];
  private pickDo: ((id: string) => void) | null = null;
  private useBtn = document.createElement('button');
  private brim = div('walkbrim');
  private tmp = new THREE.Vector3();

  constructor(private host: HandHost) {
    const ui = document.getElementById('ui') ?? document.body;
    this.useBtn.id = 'walkuse';
    this.useBtn.className = 'tool';
    this.useBtn.hidden = true;
    this.useBtn.setAttribute('aria-label', t('walk.use'));
    this.useBtn.addEventListener('click', () => {
      this.useBtn.blur();
      this.use();
    });
    // de rand van de hoed komt achter alle knoppen
    ui.prepend(this.brim);
    ui.append(this.pick, this.useBtn);
    this.root.visible = false;
    this.fist.visible = false;
    onTop(this.fist);
    this.root.add(this.fist);
  }

  /** Is het rijtje om te kiezen open? */
  get choosing(): boolean {
    return !this.pick.hidden;
  }

  /** Een rijtje grote plaatjes onderin: tik er een aan om het te krijgen. `at`: de kraam (zo ver weg en het rijtje gaat dicht). */
  ask(options: { id: string; label: string }[], at: [number, number], done: (id: string) => void): void {
    this.pick.replaceChildren();
    this.pickIds = options.map(o => o.id);
    this.pickAt = at;
    this.pickDo = done;
    for (const o of options) {
      const b = document.createElement('button');
      b.className = 'tool';
      b.innerHTML = this.host.pic(o.id);
      b.setAttribute('aria-label', o.label);
      b.title = o.label;
      b.addEventListener('click', () => this.choose(o.id));
      this.pick.append(b);
    }
    this.pick.hidden = false;
    sfx('tap', { volume: 0.5 });
  }

  private choose(id: string): void {
    const done = this.pickDo;
    this.closePick();
    done?.(id);
  }

  private closePick(): void {
    this.pick.hidden = true;
    this.pick.replaceChildren();
    this.pickAt = this.pickDo = null;
    this.pickIds = [];
  }

  /** Een toets terwijl je loopt. Met het rijtje open: 1 tot 4 kiest dat plaatje, Spatie of Enter het eerste. Geeft terug of hij gebruikt is. */
  key(code: string): boolean {
    if (!this.choosing) return false;
    const n = code.startsWith('Digit') ? Number(code.slice(5)) : code.startsWith('Numpad') ? Number(code.slice(6)) : NaN;
    if (n >= 1 && n <= this.pickIds.length) {
      this.choose(this.pickIds[n - 1]);
      return true;
    }
    if (code === 'Space' || code === 'Enter' || code === 'KeyE' || code === 'NumpadEnter') {
      this.choose(this.pickIds[0]);
      return true;
    }
    return false;
  }

  /** Je krijgt dit van de kraam: het komt in je hand (wat je al had gaat weg). Schmink komt meteen op je gezicht. */
  give(product: string): void {
    const face = paintOf(product);
    if (face) {
      this.paint = face;
      sfx('paint', { volume: 0.6 });
      this.host.float(`${icon(product as IconId, 'tiny')} ${t('walk.paint', { face: t(`paint.${face}`).toLowerCase() })}`, innerWidth / 2, innerHeight * 0.35, 'word');
      return;
    }
    const h = hold(product);
    if (!h) return;
    this.dropModel();
    this.held = h;
    this.act = null;
    this.model = makeHeld(SHOP_OF[h.kind], product);
    onTop(this.model);
    this.root.add(this.model);
    this.autoIn = HELD.first;
    this.place(0, 0);
    this.useBtn.innerHTML = this.host.pic(product);
  }

  /** Tik op het scherm (niet op een dier, gast of kraam): gebruik wat je vasthoudt. Geeft terug of er iets gebeurde. */
  use(): boolean {
    if (this.choosing) {
      this.closePick();
      return true;
    }
    const h = this.held;
    // nog bezig: een laatste hapje of de hoed opzetten maak je eerst af
    if (!h || !this.model || (this.act && (this.act.gone || this.act.use === 'wear' || this.act.t < useSeconds(this.act.use) * 0.7))) return false;
    const { use, left, gone } = useHeld(h);
    const from = sizeLeft(h);
    h.left = left;
    this.act = { use, t: 0, gone: gone && use !== 'tug' && use !== 'hug', from, to: sizeLeft(h), chomps: 0 };
    this.autoIn = HELD.every;
    // eten en drinken hoor je als het bij je mond is (zie `chomp`); de rest meteen
    const eating = use === 'bite' || use === 'lick' || use === 'sip';
    const [sound, volume] = USE_SOUND[use];
    if (!eating) sfx(sound, { volume, every: 0.1 });
    const s = this.screenAt();
    if (use === 'hug') this.host.float(icon('heart'), s.x - 30, s.y - 60);
    if (use === 'tug') this.host.float(icon('heart', 'tiny'), innerWidth * 0.68, innerHeight * 0.2);
    return true;
  }

  /** Elk beeldje: de hand wiebelt mee, en wat hij aan het doen is gaat verder. `down`: je bent beneden aan het lopen. */
  update(dt: number, down: boolean, at: [number, number]): void {
    // van boven gespeeld, met lege handen: niets te doen
    if (!down && !this.root.parent) return;
    this.clock += dt;
    const cam = this.host.view.eyeCam;
    if (this.root.parent !== cam) {
      cam.add(this.root);
      // een camera tekent zijn kinderen alleen als hij zelf in de scène hangt
      if (!cam.parent) this.host.view.scene.add(cam);
    }
    this.root.visible = down && (!!this.model || this.crumbs.length > 0);
    if (this.choosing && (!down || (this.pickAt && Math.hypot(this.pickAt[0] - at[0], this.pickAt[1] - at[1]) > HELD.away))) this.closePick();
    this.useBtn.hidden = !down || !this.held || !touchy();
    this.brim.hidden = !down || !this.hat;
    if (this.hat) this.brim.style.setProperty('--brim', `#${colorOf(this.hat).toString(16).padStart(6, '0')}`);
    // kruimels vallen naar beneden en verdwijnen
    for (const c of this.crumbs) {
      c.life -= dt;
      c.v.y -= dt * 0.9;
      c.mesh.position.addScaledVector(c.v, dt);
    }
    for (const c of this.crumbs) if (c.life <= 0) this.root.remove(c.mesh);
    this.crumbs = this.crumbs.filter(c => c.life > 0);
    // nakauwen: je hoofd knikt nog even mee
    this.chew = Math.max(0, this.chew - dt);
    let nod = down ? Math.sin(this.clock * 15) * NOD.chew * Math.min(1, this.chew * 3) : 0;
    this.host.view.eyeNod = nod;
    if (!this.model || !this.held) return;
    const [phase, moving] = this.host.gait();
    let k = 0;
    if (this.act) {
      this.act.t += dt;
      k = Math.min(1, this.act.t / useSeconds(this.act.use));
      if (k >= 1) return this.finish();
      const [near, chomp] = eatPose(k), eating = this.act.use === 'bite' || this.act.use === 'lick' || this.act.use === 'sip';
      if (eating) {
        nod += NOD.eat * near;
        // twee keer happen, likken of klokken terwijl het bij je mond is
        const due = near >= 1 ? 1 + Math.floor(chomp * 2) : 0;
        while (this.act.chomps < Math.min(2, due)) this.chomp(this.act.use, this.act.chomps++);
      }
      this.host.view.eyeNod = down ? nod : 0;
    } else if (down && !this.choosing && usesItself(this.held) && (this.autoIn -= dt) <= 0) this.use();
    this.place(phase, moving, k);
  }

  /** Een hap, een lik of een slok, nu het bij je mond is: het geluid, en kruimels of druppeltjes. */
  private chomp(use: HeldUse, n: number): void {
    const [sound, volume] = USE_SOUND[use];
    sfx(sound, { volume: n ? volume * 0.6 : volume, rate: n ? 1.2 : 1, every: 0.05 });
    this.spray(use === 'lick' ? 0xffc1d6 : use === 'sip' ? 0x9fd8f5 : 0xe9b872, use === 'sip' ? 3 : 5);
  }

  /** Zet het ding in je hand neer: in rust, wiebelend met je stapjes, of halverwege iets doen (`k` van 0 tot 1). */
  private place(phase: number, moving: number, k = 0): void {
    const h = this.held!, m = this.model!, rest = REST[h.kind];
    const swing = Math.sin(phase) * 0.006 * moving, bob = Math.abs(Math.cos(phase)) * 0.008 * moving + Math.sin(this.clock * 1.6) * 0.002;
    let [x, y, z] = rest.at;
    x += swing;
    y += bob;
    let size = rest.size, sx = 1, sy = 1, tilt = rest.tilt, roll = h.kind === 'balloon' ? Math.sin(this.clock * 1.3) * 0.06 : 0;
    const a = this.act, there = Math.sin(Math.PI * k);
    if (a?.use === 'bite' || a?.use === 'lick' || a?.use === 'sip') {
      // naar je mond toe, daar happen, likken of drinken, en weer terug; bij elk hapje wordt het kleiner
      const [near, chomp] = eatPose(k), beat = Math.sin(chomp * Math.PI * 4);
      x += (MOUTH[0] - x) * near;
      y += (MOUTH[1] - y) * near;
      z += (MOUTH[2] - z) * near;
      if (a.use === 'sip') {
        // het bekertje kantelt naar je toe, en bij elke slok nog een beetje verder
        tilt += (1.05 + Math.max(0, beat) * 0.18) * near;
      } else if (a.use === 'lick') {
        // twee likjes: het ijsje gaat langs je tong omhoog
        tilt += 0.45 * near;
        y += Math.max(0, beat) * 0.014 * near;
      } else {
        // twee happen: het hapje schokt even naar je toe
        tilt += 0.55 * near;
        z += Math.max(0, beat) * 0.014 * near;
        y -= Math.max(0, beat) * 0.006 * near;
      }
      size *= a.from + (a.to - a.from) * smooth((chomp - 0.1) * 2);
    } else if (a?.use === 'hug') {
      // tegen je aan, en even platgeknuffeld
      x += (0.01 - x) * there;
      y += (-0.1 - y) * there;
      z += (-0.24 - z) * there;
      sx = 1 + 0.25 * there;
      sy = 1 - 0.22 * there;
    } else if (a?.use === 'tug') {
      // een rukje: de ballon dipt en wiebelt terug
      y -= 0.05 * there;
      roll += Math.sin(k * Math.PI * 3) * 0.25 * (1 - k);
    } else if (a?.use === 'wear') {
      // de hoed gaat omhoog, je hoofd op: uit beeld
      x += (0 - x) * smooth(k);
      y += 0.45 * smooth(k);
      z += (-0.18 - z) * smooth(k);
      tilt -= 0.5 * smooth(k);
    }
    m.position.set(x, y, z);
    m.rotation.set(tilt, -0.35, roll);
    m.scale.set(size * sx, size * sy, size * sx);
    // het vuistje houdt het onderaan vast; een hoed gaat zonder hand je hoofd op
    this.fist.visible = a?.use !== 'wear';
    this.fist.position.set(x, y, z);
    this.fist.rotation.set(tilt, -0.35, roll);
  }

  /** Klaar met een hapje, de hoed of een knuffel. Op: dan is je hand weer leeg. */
  private finish(): void {
    const a = this.act!, h = this.held!;
    this.act = null;
    if (a.use === 'wear') {
      this.hat = h.product;
      this.drop();
      return;
    }
    if (a.use === 'bite' || a.use === 'lick') this.chew = HELD.chewTime;
    if (a.gone) {
      sfx('guest.aah', { volume: 0.6, every: 0.3 });
      const s = this.screenAt();
      this.host.float(icon('heart', 'tiny'), s.x, s.y - 40);
      this.drop();
      return;
    }
    this.place(...this.host.gait());
  }

  /** Een paar kruimels of druppeltjes bij je mond. */
  private spray(color: number, n = 5): void {
    for (let i = 0; i < n; i++) {
      const mesh = new THREE.Mesh(CRUMB_GEO, crumbMat(i % 2 ? 0xfff4c2 : color));
      mesh.position.set(MOUTH[0] + (Math.random() - 0.5) * 0.03, MOUTH[1] - 0.01, MOUTH[2]);
      this.root.add(mesh);
      this.crumbs.push({ mesh, v: new THREE.Vector3((Math.random() - 0.5) * 0.15, 0.05 + Math.random() * 0.08, (Math.random() - 0.5) * 0.05), life: 0.7 });
    }
  }

  /** Waar het ding in je hand op het scherm staat (pixels). */
  private screenAt(): { x: number; y: number } {
    if (!this.model) return { x: innerWidth * 0.75, y: innerHeight * 0.8 };
    this.model.getWorldPosition(this.tmp).project(this.host.view.eyeCam);
    return { x: ((this.tmp.x + 1) / 2) * innerWidth, y: ((1 - this.tmp.y) / 2) * innerHeight };
  }

  /** Je hand is weer leeg. */
  private drop(): void {
    this.dropModel();
    this.held = null;
    this.act = null;
  }

  private dropModel(): void {
    if (this.model) this.root.remove(this.model);
    this.model = null;
    this.fist.visible = false;
  }

  /** Uit de loopstand: alles wat je vasthoudt of draagt wordt opgeruimd. */
  clear(): void {
    this.drop();
    this.closePick();
    this.hat = null;
    this.paint = null;
    for (const c of this.crumbs) this.root.remove(c.mesh);
    this.crumbs = [];
    this.chew = 0;
    this.host.view.eyeNod = 0;
    this.root.visible = false;
    this.useBtn.hidden = this.brim.hidden = true;
  }

  /** De plaatjes bij je munten: je hoed en je schmink. */
  worn(): string {
    return (this.hat ? icon(this.hat as IconId) : '') + (this.paint ? icon(`paint_${this.paint}` as IconId) : '');
  }
}

/**
 * Wat je in je hand hebt, wordt altijd vooraan getekend: ook als je vlak tegen een kraam of muur staat, steekt het er
 * niet in. Elk stukje krijgt een eigen kopie van zijn materiaal, zodat de gasten met hetzelfde ding gewoon blijven.
 */
function onTop(obj: THREE.Object3D): void {
  obj.traverse(o => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const mats = (Array.isArray(m.material) ? m.material : [m.material]).map(x => {
      const own = x.clone();
      own.depthTest = false;
      own.depthWrite = false;
      return own;
    });
    m.material = Array.isArray(m.material) ? mats : mats[0];
    m.renderOrder = 1000;
    m.castShadow = false;
  });
}
