// De loopstand: zelf als bezoeker door je eigen park lopen. Hier zitten de toetsen, het slepen om rond te kijken,
// de grote ronde knop op een tablet, het stipje in het midden en het wolkje met de naam. De sommen staan in walk.ts,
// de camera in view.ts; wat er in het park staat en wat een dier of gast doet, vraagt dit aan het spel (WalkHost).
import { t } from '@smj/shared';
import { sfx } from './audio';
import type { View } from './view';
import { WALK, ahead, bobHeight, clampPitch, pickLook, rightOf, stepWalker, stickInput, type LookTarget, type WalkGround } from './walk';

/** Iets waar je in de loopstand naar kunt kijken: een dier, een gast of een kraam. */
export interface WalkTarget extends LookTarget {
  /** Zo hoog staat het wolkje met de naam. */
  top: number;
  /** Het dier, de gast of de kraam zelf: zo weet je of je nog naar hetzelfde kijkt. */
  id: object;
  /** Wat er in het wolkje staat (HTML). */
  tag(): string;
  /** Een tik of de spatiebalk: het dier of de gast doet iets voor je. */
  poke?(): void;
}

/** Wat de loopstand van het spel nodig heeft. */
export interface WalkHost {
  view: View;
  canvas: HTMLCanvasElement;
  /** Waar je begint: een plek op het raster en de kant waar je naar kijkt. */
  start(): [gx: number, gy: number, yaw: number];
  /** Waar je niet doorheen kunt. */
  ground(): WalkGround;
  /** Alles waar je naar kunt kijken. */
  targets(): WalkTarget[];
  /** De loopstand gaat aan of uit (het spel verstopt dan de knoppenbalk, of laat hem weer zien). */
  changed(on: boolean): void;
  /** Een tik (of Spatie) terwijl je nergens naar kijkt: gebruik wat je in je hand hebt (zie walkhand.ts). */
  use?(): void;
  /** Een toets die het spel zelf wil hebben (een plaatje kiezen bij een kraam). Geeft terug of hij gebruikt is. */
  key?(code: string): boolean;
}

/** Toetsen om te lopen. Spatie, Enter en E zijn om iets aan te tikken, Escape om weer omhoog te gaan. */
const MOVE_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight']);
const POKE_KEYS = new Set(['Space', 'Enter', 'KeyE', 'NumpadEnter']);
/** Zoveel pixels mag je vinger bewegen en is het nog een tik. */
const TAP_SLOP = 9;

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));
const div = (id: string, html = ''): HTMLDivElement => {
  const d = document.createElement('div');
  d.id = id;
  d.innerHTML = html;
  d.hidden = true;
  return d;
};

export class WalkMode {
  /** Staat de loopstand aan (ook al tijdens het naar beneden vliegen)? */
  on = false;
  private gx = 0;
  private gy = 0;
  private yaw = 0;
  private pitch = WALK.pitch;
  /** Hoe snel je nu loopt (tegels per tel, op het raster) en draait (radialen per tel). */
  private vx = 0;
  private vy = 0;
  private spin = 0;
  /** Loopt op met de afgelegde weg: voor het knikje en de stapjes. */
  private phase = 0;
  private moving = 0;
  private keys = new Set<string>();
  private stick = { id: -1, cx: 0, cy: 0, forward: 0, turn: 0 };
  private drag: { id: number; x: number; y: number; sx: number; sy: number; moved: boolean } | null = null;
  private ground: WalkGround | null = null;
  private groundAge = 0;
  private targets: WalkTarget[] = [];
  /** Waar je nu naar kijkt. */
  private seen: WalkTarget | null = null;
  private tagFor: object | null = null;

  private dot = div('walkdot');
  private tag = div('walktag');
  private pad = div('walkpad', '<i class="knob"></i>');
  private knob: HTMLElement;

  constructor(private host: WalkHost) {
    const ui = document.getElementById('ui') ?? document.body;
    this.pad.setAttribute('aria-label', t('walk.stick'));
    ui.append(this.dot, this.tag, this.pad);
    this.knob = this.pad.querySelector('.knob')!;
    this.listen();
  }

  /** Naar beneden (aan) of weer omhoog (uit). */
  set(on: boolean): void {
    if (on === this.on) return;
    this.on = on;
    const v = this.host.view;
    if (on) {
      // de knop die je net aantikte, mag de spatiebalk niet opvangen
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      // nog op weg naar boven? Dan ga je gewoon terug naar waar je was
      if (!v.walking) {
        const [gx, gy, yaw] = this.host.start();
        Object.assign(this, { gx, gy, yaw, pitch: WALK.pitch });
      }
      Object.assign(this, { vx: 0, vy: 0, spin: 0, moving: 0 });
      this.ground = this.host.ground();
      this.groundAge = 0;
      v.setEye(this.gx, this.gy, WALK.eye, this.yaw, this.pitch);
    } else {
      this.keys.clear();
      this.drag = null;
      this.release();
      this.seen = null;
    }
    v.setWalk(on);
    this.dot.hidden = !on;
    this.pad.hidden = !on || !touchy();
    this.tag.hidden = true;
    this.tagFor = null;
    this.host.canvas.style.cursor = on ? 'grab' : '';
    this.host.changed(on);
  }

  toggle(): void {
    this.set(!this.on);
  }

  /** Waar de loper nu staat, op het raster. */
  get at(): [number, number] {
    return [this.gx, this.gy];
  }

  /** Je stapjes: hoe ver je al gelopen hebt en hoe hard je nu loopt (0 tot 1). Daar wiebelt je hand op mee. */
  get gait(): [number, number] {
    return [this.phase, this.moving];
  }

  /** De ring op de grond onder wat je aankijkt (zie View.showMarks). */
  marks(spots: { gx: number; gy: number; r?: number }[]): void {
    const s = this.on ? this.seen : null;
    if (s) spots.push({ gx: s.gx, gy: s.gy, r: (s.r + 0.3) / 0.25 });
  }

  /** Elk beeldje: lopen, draaien, en kijken waar je naar kijkt. */
  update(dt: number): void {
    if (!this.on) return;
    const v = this.host.view;
    // af en toe opnieuw vragen wat in de weg staat: een omgeduwd hek, een nieuwe sneeuwpop
    this.groundAge += dt;
    if (!this.ground || this.groundAge > 2) {
      this.ground = this.host.ground();
      this.groundAge = 0;
    }
    if (v.walkDown) this.walk(dt);
    v.setEye(this.gx, this.gy, bobHeight(this.phase, this.moving), this.yaw, this.pitch);
    this.lookAround();
  }

  /** Lopen en draaien met de pijltjes, WASD of de grote ronde knop. */
  private walk(dt: number): void {
    const k = this.keys, shift = k.has('ShiftLeft') || k.has('ShiftRight');
    const left = k.has('KeyA') || k.has('ArrowLeft'), right = k.has('KeyD') || k.has('ArrowRight');
    let forward = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    // met shift stap je opzij in plaats van te draaien
    let turn = shift ? 0 : (left ? 1 : 0) - (right ? 1 : 0);
    const side = shift ? (right ? 1 : 0) - (left ? 1 : 0) : 0;
    forward = clamp(forward + this.stick.forward, -1, 1);
    turn = clamp(turn - this.stick.turn, -1, 1);
    // zacht op gang komen en zacht stoppen
    const ease = Math.min(1, dt * 8);
    this.spin += (turn * WALK.turn - this.spin) * ease;
    this.yaw += this.spin * dt;
    const speed = forward >= 0 ? WALK.speed : WALK.back;
    const [fx, fy] = ahead(this.yaw), [rx, ry] = rightOf(this.yaw);
    const wx = fx * forward * speed + rx * side * WALK.back, wy = fy * forward * speed + ry * side * WALK.back;
    this.vx += (wx - this.vx) * ease;
    this.vy += (wy - this.vy) * ease;
    let moved = 0;
    if (this.ground && Math.hypot(this.vx, this.vy) > 1e-3) {
      const [nx, ny] = stepWalker(this.gx, this.gy, this.vx * dt, this.vy * dt, this.ground);
      moved = Math.hypot(nx - this.gx, ny - this.gy);
      this.gx = nx;
      this.gy = ny;
    }
    this.moving += (clamp(moved / Math.max(dt, 1e-4) / WALK.speed, 0, 1) - this.moving) * ease;
    // bij elke stap een zacht tikje
    const before = Math.floor(this.phase / Math.PI);
    this.phase += (moved / WALK.stride) * Math.PI;
    if (Math.floor(this.phase / Math.PI) !== before) sfx('walk.step', { volume: 0.35, rate: 0.9 + Math.random() * 0.2, every: 0.15 });
  }

  /** Wat recht voor je staat: dat krijgt een ring op de grond en een wolkje met zijn naam. */
  private lookAround(): void {
    const v = this.host.view;
    if (!v.walkDown) {
      this.seen = null;
      this.tag.hidden = true;
      this.dot.classList.remove('on');
      return;
    }
    this.targets = this.host.targets();
    const i = pickLook(this.gx, this.gy, WALK.eye, this.yaw, this.pitch, this.targets);
    const seen = i < 0 ? null : this.targets[i];
    this.seen = seen;
    this.dot.classList.toggle('on', !!seen);
    if (!seen) {
      this.tag.hidden = true;
      this.tagFor = null;
      return;
    }
    if (this.tagFor !== seen.id) {
      this.tagFor = seen.id;
      this.tag.innerHTML = seen.tag();
    }
    const s = v.toScreen(seen.gx, seen.gy, seen.top);
    this.tag.hidden = s.x < -999;
    this.tag.style.transform = `translate(${s.x}px, ${s.y}px) translate(-50%, -100%)`;
  }

  /** Tik op iets: wat onder je vinger staat, of anders wat je met het stipje aankijkt. */
  private tap(x: number, y: number): void {
    const v = this.host.view;
    if (!v.walkDown) return;
    const focal = innerHeight / (2 * Math.tan((WALK.fov * Math.PI) / 360));
    let best: WalkTarget | null = null, bestD = Infinity;
    for (const target of this.targets) {
      const d = Math.hypot(target.gx - this.gx, target.gy - this.gy);
      if (d > WALK.lookRange + 2) continue;
      const s = v.toScreen(target.gx, target.gy, target.h);
      if (s.x < -999) continue;
      const reach = Math.max(44, (target.r * focal) / Math.max(0.3, d));
      const off = Math.hypot(s.x - x, s.y - y);
      if (off < reach && off / reach < bestD) {
        bestD = off / reach;
        best = target;
      }
    }
    this.poke(best ?? this.seen);
  }

  /** Iets aantikken; kijk je nergens naar, dan gebruik je wat je in je hand hebt. */
  private poke(target: WalkTarget | null): void {
    if (target) target.poke?.();
    else this.host.use?.();
  }

  private release(): void {
    this.stick.id = -1;
    this.stick.forward = this.stick.turn = 0;
    this.knob.style.transform = '';
  }

  private listen(): void {
    const canvas = this.host.canvas;
    addEventListener('keydown', e => {
      if (!this.on || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === 'Escape') {
        e.preventDefault();
        this.set(false);
      } else if (!e.repeat && this.host.key?.(e.code)) {
        e.preventDefault();
      } else if (POKE_KEYS.has(e.code)) {
        e.preventDefault();
        if (!e.repeat) this.poke(this.seen);
      } else if (MOVE_KEYS.has(e.code)) {
        e.preventDefault();
        this.keys.add(e.code);
      }
    });
    addEventListener('keyup', e => {
      this.keys.delete(e.code);
      if (this.on && POKE_KEYS.has(e.code)) e.preventDefault();
    });
    addEventListener('blur', () => this.keys.clear());

    // slepen op het beeld: rondkijken; een tik: iets aantikken
    canvas.addEventListener('pointerdown', e => {
      if (!this.on || this.drag) return;
      this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: false };
      canvas.style.cursor = 'grabbing';
    });
    canvas.addEventListener('pointermove', e => {
      const d = this.drag;
      if (!this.on || !d || d.id !== e.pointerId) return;
      this.yaw -= (e.clientX - d.x) * WALK.drag;
      this.pitch = clampPitch(this.pitch - (e.clientY - d.y) * WALK.drag);
      d.x = e.clientX;
      d.y = e.clientY;
      if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > TAP_SLOP) d.moved = true;
    });
    const up = (e: PointerEvent): void => {
      const d = this.drag;
      if (!d || d.id !== e.pointerId) return;
      this.drag = null;
      if (!this.on) return;
      canvas.style.cursor = 'grab';
      if (!d.moved && e.type === 'pointerup') this.tap(e.clientX, e.clientY);
    };
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);

    // de grote ronde knop linksonder: duw hem de kant op waar je heen wilt
    const pad = this.pad;
    pad.addEventListener('pointerdown', e => {
      if (!this.on || this.stick.id >= 0) return;
      e.preventDefault();
      pad.setPointerCapture(e.pointerId);
      const box = pad.getBoundingClientRect();
      Object.assign(this.stick, { id: e.pointerId, cx: box.left + box.width / 2, cy: box.top + box.height / 2 });
      this.moveStick(e.clientX, e.clientY);
    });
    pad.addEventListener('pointermove', e => {
      if (e.pointerId === this.stick.id) this.moveStick(e.clientX, e.clientY);
    });
    const done = (e: PointerEvent): void => {
      if (e.pointerId === this.stick.id) this.release();
    };
    pad.addEventListener('pointerup', done);
    pad.addEventListener('pointercancel', done);
  }

  private moveStick(x: number, y: number): void {
    const s = this.stick, dx = x - s.cx, dy = y - s.cy;
    const { forward, turn } = stickInput(dx, dy);
    s.forward = forward;
    // op een tablet draai je wat rustiger dan met de pijltjes: anders draait de wereld je om de oren
    s.turn = turn * 0.8;
    const len = Math.hypot(dx, dy), k = len > WALK.stick ? WALK.stick / len : 1;
    this.knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
  }
}

/** Wat er in het wolkje staat: de naam, een plaatje en eronder klein wat het is. Namen kunnen van de speler zijn: dus als tekst. */
export function tagHtml(name: string, pic: string, sub: string): string {
  const esc = (s: string): string => s.replace(/[&<>"]/g, c => `&#${c.charCodeAt(0)};`);
  return `<b>${esc(name)}</b><span class="sub">${pic}${sub ? `<i>${esc(sub)}</i>` : ''}</span>`;
}

/** Een scherm met aanraken: dan staat de grote ronde knop er. */
export function touchy(): boolean {
  return (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches) || navigator.maxTouchPoints > 0;
}
