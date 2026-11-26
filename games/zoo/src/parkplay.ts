// Spelen in het park met de seizoenen en de nacht (de getallen staan in parkfun.ts):
// - herfst: er vallen blaadjes onder de bomen; met de hark veeg je ze op een hoop. Is de hoop groot, dan komt er
//   een kind in springen. Daarna hark je de hoop weg (een munt, en de gasten worden blij).
// - winter: met Sneeuw rol je een sneeuwbal over het gras; drie tikken en het is een sneeuwpop. Als de winter
//   voorbij is, smelt hij.
// - nacht: tik op een lamp en hij gaat uit, nog een tik en hij gaat aan. Doe je ze allemaal snel weer aan (of tik
//   je op de grote lamp bij de ingang), dan gaat er een golfje kleuren langs alle lampen.
// Het spel (game.ts) roept dit aan en geeft door wat er nodig is (ParkHost).
import * as THREE from 'three';
import { sfx } from './audio';
import type { DecorKind, Season } from './data';
import { icon } from './icons';
import { say, type Line } from './lines';
import {
  LEAF, SNOW, bigPile, isLamp, joinPile, leafSpot, meltLeft, nearest, pileSize, rolled, seasonActs, snowScale, stackUp, waveColor, waveDue, waveLength,
  type ParkAct, type SnowStage,
} from './parkfun';
import { LEAF_COLORS, LeafLayer, makePile, makeSnowball } from './parklook';
import type { Guest, Sight } from './people';
import { toWorldX, toWorldZ, type View } from './view';

/** Een lamp in het park. */
export interface ParkLamp {
  ref: object;
  kind: DecorKind;
  mesh: THREE.Object3D;
  gx: number;
  gy: number;
}

/** Wat het spel doorgeeft. */
export interface ParkHost {
  view: View;
  /** De klok van het spel, in tellen. */
  clock(): number;
  season(): Season;
  /** Doen de seizoenen en de nacht al mee? */
  seasons(): boolean;
  nights(): boolean;
  /** Hoe donker het is: 0 overdag, 1 in de nacht. */
  dark(): number;
  /** De loofbomen in het park, buiten de verblijven (het midden, in tegels). */
  trees(): [number, number][];
  /** Wat voor grond hier ligt, in het park, buiten een verblijf en zonder kraam erop: gras, pad, of null. */
  ground(gx: number, gy: number): 'grass' | 'path' | null;
  /** De tegel onder dit punt en de tegels ernaast: vanaf daar kan een gast erbij. */
  tilesNear(gx: number, gy: number): number[];
  lamps(): ParkLamp[];
  guests(): Guest[];
  /** Het ding waar gasten naartoe lopen dat bij dit object hoort, of null. */
  sightOf(ref: object): Sight | null;
  /** Een kind in de buurt komt ernaartoe rennen. */
  callKid(sight: Sight): Guest | null;
  earn(n: number, gx: number, gy: number): void;
  float(html: string, gx: number, gy: number, height?: number): void;
  /** Uitleg die maar één keer komt (`id` wordt bewaard). */
  once(id: string, line: Line): void;
  /** Kies alvast het goede gereedschap bij de actieknop en laat de knop oplichten. */
  pointTo(act: ParkAct, gx: number, gy: number): void;
  /** Bouw de knoppen opnieuw op: wat er bij de actieknop zit, hangt af van het seizoen. */
  tools(): void;
  /** Een paal met lichtjes ging uit of aan: de slingers opnieuw. */
  strings(): void;
}

interface Patch {
  gx: number;
  gy: number;
  rot: number;
  /** Hoe groot (0 tot 1): het groeit als de blaadjes vallen. */
  k: number;
  path: boolean;
}
interface Pile {
  gx: number;
  gy: number;
  n: number;
  mesh: THREE.Group;
  /** Het kind dat eraan komt, en wanneer het geroepen werd. */
  kid: Guest | null;
  calledAt: number;
  callIn: number;
  /** Er is al een kind in gesprongen, op dit moment. */
  jumped: boolean;
  jumpedAt: number;
  /** Wanneer hij voor het laatst opveerde (bij harken of springen). */
  bounce: number;
}
interface Ball {
  gx: number;
  gy: number;
  r: number;
  stage: SnowStage;
  mesh: THREE.Group;
  scarf: number;
  /** Tellen sinds hij begon te smelten (-1: hij smelt niet). */
  melt: number;
  /** Wanneer de laatste bal erop kwam (voor het plopje). */
  pop: number;
  turn: number;
}
/** Een sneeuwpop zoals hij bewaard wordt. */
export interface SnowSave {
  gx: number;
  gy: number;
  r: number;
  s: number;
  c: number;
}

/** Hoe hoog het licht van elke lamp zit (in tegels): daar komen de vonkjes. */
const LAMP_TOP: Record<string, number> = { lantern: 1.15, lightstring: 1.3, gardenlight: 0.3, lampion: 1, torch: 1.05, streetlamp: 1.42 };
const rnd = (list: number[]): number => list[Math.floor(Math.random() * list.length)];

export class ParkPlay {
  private patches: Patch[] = [];
  private piles: Pile[] = [];
  private balls: Ball[] = [];
  private leaves: LeafLayer;
  private leavesDirty = false;
  private fallIn = LEAF.every;
  /** Tellen sinds de herfst voorbij is: zo lang krimpen de blaadjes al. */
  private fade = 0;
  private seasonWas: Season | null = null;
  /** Wat deze sleepbeweging doet: welke hoop ze vult of welke sneeuwbal ze rolt, en of er al een bal op kwam. */
  private stroke: { pile?: Pile; ball?: Ball; stacked?: boolean } | null = null;
  // de lampjes
  private off = new Set<object>();
  private onTimes: number[] = [];
  private wave: { at: number; gx: number; gy: number; far: number } | null = null;
  private looks = new WeakMap<object, 'on' | 'off' | number>();
  private gateLook: 'on' | number | null = null;
  private darkWas = 0;
  private lampsTold = false;

  constructor(private host: ParkHost) {
    this.leaves = new LeafLayer(host.view.scene, LEAF.max);
  }

  /** Wat er in dit seizoen bij de actieknop komt. */
  actions(): ParkAct[] {
    return seasonActs(this.host.season(), this.host.seasons());
  }

  /** Is de lamp aan? Een uitgetikte lamp geeft geen licht. */
  lit(ref: object): boolean {
    return !this.off.has(ref);
  }

  /** Zoveel plekjes blaadjes liggen er op het pad (dat telt een beetje mee als rommel bij de sterren). */
  leavesOnPath(): number {
    return this.patches.filter(p => p.path).length;
  }

  // ------------------------------------------------------------ aanwijzen
  private pileAt(gx: number, gy: number): Pile | null {
    let best: Pile | null = null, bestD = 99;
    for (const p of this.piles) {
      const d = Math.hypot(p.gx - gx, p.gy - gy);
      if (d <= 0.25 + pileSize(p.n) * 0.42 && d < bestD) [best, bestD] = [p, d];
    }
    return best;
  }

  /** De sneeuwbal of sneeuwpop onder de vinger: op de grond eromheen, of (een hoge sneeuwpop) op het scherm. */
  ballAt(cx: number, cy: number, gx: number, gy: number): Ball | null {
    const view = this.host.view;
    let best: Ball | null = null, bestD = 99;
    for (const b of this.balls) {
      if (b.melt >= 0) continue;
      const ground = Math.hypot(b.gx - gx, b.gy - gy);
      const tall = (b.stage === 0 ? 0.5 : b.stage === 1 ? 0.82 : 1.05) * snowScale(b.r);
      const mid = view.toScreen(b.gx, b.gy, tall / 2), top = view.toScreen(b.gx, b.gy, tall);
      const px = Math.hypot(mid.x - cx, mid.y - cy), reach = Math.max(18, Math.abs(mid.y - top.y) * 1.3);
      const d = ground <= b.r + SNOW.reach ? ground : px <= reach ? 0.5 + px / reach : 99;
      if (d < bestD) [best, bestD] = [b, d];
    }
    return best;
  }

  /** Mag hier een nieuwe sneeuwbal? In de winter, op het besneeuwde gras, niet tegen een andere bal aan. */
  private snowy(gx: number, gy: number, r = SNOW.r0, skip?: Ball): boolean {
    if (this.host.season() !== 'winter' || !this.host.seasons() || this.host.ground(gx, gy) !== 'grass') return false;
    return !this.balls.some(b => b !== skip && Math.hypot(b.gx - gx, b.gy - gy) < (b.r + r) * 1.05);
  }

  /** Begint de actieknop hier aan het werk (en sleep je dus niet het veld)? */
  target(act: string, cx: number, cy: number, g: { gx: number; gy: number } | null): boolean {
    if (!g) return false;
    if (act === 'rake') return !!nearest(this.patches, g.gx, g.gy, LEAF.reach) || !!this.pileAt(g.gx, g.gy);
    if (act === 'snowball') return !!this.ballAt(cx, cy, g.gx, g.gy) || (this.snowy(g.gx, g.gy) && this.balls.length < SNOW.max);
    return false;
  }

  /**
   * Een tik met het handje of ander gereedschap: de grote lamp bij de ingang (een lichtfeestje), of een hoop blaadjes
   * of sneeuwbal waar het goede gereedschap bij hoort. Geeft true als de tik hier iets deed.
   */
  tap(cx: number, cy: number, g: { gx: number; gy: number } | null, hand: boolean): boolean {
    if (hand && this.gateTap(cx, cy)) return true;
    if (!g) return false;
    const pile = this.pileAt(g.gx, g.gy), ball = this.ballAt(cx, cy, g.gx, g.gy);
    if (pile && this.actions().includes('rake')) {
      this.host.pointTo('rake', pile.gx, pile.gy);
      return true;
    }
    if (ball && ball.stage < 3 && this.actions().includes('snowball')) {
      this.host.pointTo('snowball', ball.gx, ball.gy);
      return true;
    }
    // een sneeuwpop die af is: met het handje laat hij zich even aantikken
    if (ball && hand) {
      this.host.view.pokeDecor(ball.mesh, 'snowman', this.host.clock());
      this.host.view.burst(ball.gx, ball.gy, 0.9 * snowScale(ball.r), 0xffffff, 4);
      sfx('tap');
      return true;
    }
    return false;
  }

  /** Eén punt van een tik of veeg met de hark of de sneeuw. Geeft false als dit gereedschap hier niet bij hoort. */
  paint(act: string, cx: number, cy: number, g: { gx: number; gy: number }, tap: boolean): boolean {
    if (act === 'rake') this.rake(g.gx, g.gy, tap);
    else if (act === 'snowball') this.snow(cx, cy, g.gx, g.gy, tap);
    else return false;
    return true;
  }

  /** De vinger is los: een gerolde sneeuwbal blijft liggen, de hark is klaar met deze hoop. */
  release(): void {
    const ball = this.stroke?.ball;
    if (ball && !this.stroke?.stacked) {
      ball.pop = this.host.clock();
      sfx('place', { volume: 0.5 });
    }
    this.stroke = null;
  }

  // ------------------------------------------------------------ harken
  private rake(gx: number, gy: number, tap: boolean): void {
    const host = this.host, pile = this.pileAt(gx, gy), start = !this.stroke;
    const stroke = (this.stroke ??= {});
    const hits = this.patches.filter(p => Math.hypot(p.gx - gx, p.gy - gy) <= LEAF.reach);
    // een tik op een grote hoop, of een veeg die op een grote hoop begint: weg ermee
    if (pile && bigPile(pile.n) && (tap || (start && !hits.length))) return this.clearPile(pile);
    if (!hits.length) {
      if (pile) this.bouncePile(pile);
      return;
    }
    for (const p of hits) {
      this.patches.splice(this.patches.indexOf(p), 1);
      // alles van één veeg gaat op dezelfde hoop; anders op de hoop vlakbij, of er komt een nieuwe hoop
      let to = stroke.pile && this.piles.includes(stroke.pile) ? stroke.pile : nearest(this.piles, p.gx, p.gy, LEAF.join);
      if (!to) to = this.newPile(p.gx, p.gy);
      stroke.pile = to;
      const was = to.n, next = joinPile(to, p.gx, p.gy);
      if (host.ground(next.gx, next.gy)) [to.gx, to.gy] = [next.gx, next.gy];
      to.n = next.n;
      this.bouncePile(to);
      host.view.burst(p.gx, p.gy, 0.05, rnd(LEAF_COLORS), 2);
      // de hoop is nu groot: er mag een kind in springen
      if (!bigPile(was) && bigPile(to.n)) {
        to.callIn = 0.6;
        host.float(icon('star'), to.gx, to.gy, 0.6);
        sfx('chime', { volume: 0.4 });
      }
    }
    this.leavesDirty = true;
    sfx('sweep', { volume: 0.4, rate: 1.25, every: 0.18 });
  }

  private newPile(gx: number, gy: number): Pile {
    const pile: Pile = { gx, gy, n: 0, mesh: makePile(this.host.view.scene, gx, gy), kid: null, calledAt: 0, callIn: -1, jumped: false, jumpedAt: 0, bounce: -9 };
    pile.mesh.rotation.y = Math.random() * Math.PI * 2;
    this.piles.push(pile);
    return pile;
  }

  private bouncePile(pile: Pile): void {
    if (this.host.clock() - pile.bounce > 0.4) pile.bounce = this.host.clock();
  }

  /** Een grote hoop wegharken: een munt (na een sprong van een kind een munt meer) en blije gasten in de buurt. */
  private clearPile(pile: Pile): void {
    const host = this.host;
    // er komt nog een kind aan rennen: even wachten
    if (pile.kid && !pile.jumped) {
      this.bouncePile(pile);
      sfx('tap');
      return;
    }
    this.dropPile(pile);
    for (let i = 0; i < 3; i++) host.view.burst(pile.gx, pile.gy, 0.2, rnd(LEAF_COLORS), 4);
    host.float(icon('sparkle'), pile.gx, pile.gy, 0.5);
    sfx('sweep', { volume: 0.6 });
    host.earn(LEAF.coins + (pile.jumped ? 1 : 0), pile.gx, pile.gy);
    for (const g of host.guests()) if (Math.hypot(g.gx - pile.gx, g.gy - pile.gy) < 3.5) g.fun = Math.min(1, g.fun + LEAF.fun);
  }

  private dropPile(pile: Pile): void {
    this.host.view.scene.remove(pile.mesh);
    this.piles = this.piles.filter(p => p !== pile);
  }

  /** Er valt een plekje blaadjes onder een boom (op gras of pad, niet te dicht bij een ander plekje). */
  private dropLeaves(): void {
    const trees = this.host.trees();
    if (!trees.length || this.patches.length >= LEAF.max) return;
    const tree = trees[Math.floor(Math.random() * trees.length)];
    for (let tries = 0; tries < 6; tries++) {
      const [gx, gy] = leafSpot(tree, Math.random(), Math.random());
      const ground = this.host.ground(gx, gy);
      if (!ground || nearest(this.patches, gx, gy, LEAF.apart) || this.pileAt(gx, gy)) continue;
      this.patches.push({ gx, gy, rot: Math.random() * Math.PI * 2, k: 0, path: ground === 'path' });
      this.leavesDirty = true;
      return;
    }
  }

  // ------------------------------------------------------------ sneeuw
  private snow(cx: number, cy: number, gx: number, gy: number, tap: boolean): void {
    const host = this.host;
    if (tap) {
      // een tik: de volgende bal erop, of een kleine nieuwe sneeuwbal
      const ball = this.ballAt(cx, cy, gx, gy);
      if (ball) return this.stack(ball);
      if (this.snowy(gx, gy) && this.balls.length < SNOW.max) {
        this.newBall(gx, gy).pop = host.clock();
        sfx('place', { volume: 0.5 });
      }
      return;
    }
    if (!this.stroke) {
      // het begin van een veeg: op een bal komt er een bal bij, op het gras begint er een nieuwe te rollen
      const ball = this.ballAt(cx, cy, gx, gy);
      if (ball) {
        this.stroke = { stacked: true };
        return this.stack(ball);
      }
      this.stroke = this.snowy(gx, gy) && this.balls.length < SNOW.max ? { ball: this.newBall(gx, gy) } : {};
      return;
    }
    const ball = this.stroke.ball;
    if (!ball || this.stroke.stacked) return;
    // rollen: de bal gaat mee met de vinger (een klein stukje per keer), over het gras, en wordt groter
    const dx = gx - ball.gx, dy = gy - ball.gy, far = Math.hypot(dx, dy);
    if (far < 0.01) return;
    const dist = Math.min(far, 0.5), nx = ball.gx + (dx / far) * dist, ny = ball.gy + (dy / far) * dist;
    const r = rolled(ball.r, dist);
    if (!this.snowy(nx, ny, r, ball)) return;
    ball.gx = nx;
    ball.gy = ny;
    ball.r = r;
    const body = ball.mesh.children[0];
    body.rotateOnWorldAxis(new THREE.Vector3(dy, 0, -dx).normalize(), dist / ball.r);
    this.placeBall(ball);
    if (Math.random() < 0.3) host.view.burst(nx, ny, 0.05, 0xffffff, 1);
    sfx('sweep', { volume: 0.25, rate: 0.7, every: 0.3 });
  }

  private newBall(gx: number, gy: number, r = SNOW.r0): Ball {
    const ball: Ball = { gx, gy, r, stage: 0, mesh: makeSnowball(this.host.view.scene), scarf: rnd(SNOW.scarves), melt: -1, pop: -9, turn: (Math.random() - 0.5) * 1.2 };
    ball.mesh.children[1].visible = ball.mesh.children[2].visible = false;
    this.balls.push(ball);
    this.placeBall(ball);
    return ball;
  }

  private placeBall(ball: Ball): void {
    const left = ball.melt < 0 ? 1 : meltLeft(ball.melt), k = snowScale(ball.r) * (0.3 + 0.7 * left);
    ball.mesh.position.set(toWorldX(ball.gx), 0, toWorldZ(ball.gy));
    ball.mesh.scale.set(k, k * left, k);
  }

  /** Een tik op een sneeuwbal: de middelste bal erop, dan het hoofd, en dan de wortelneus en een sjaal. */
  private stack(ball: Ball): void {
    const host = this.host, top = 1.05 * snowScale(ball.r);
    if (ball.stage === 3) {
      host.view.pokeDecor(ball.mesh, 'snowman', host.clock());
      sfx('tap');
      return;
    }
    ball.stage = stackUp(ball.stage);
    ball.pop = host.clock();
    host.view.burst(ball.gx, ball.gy, top * 0.8, 0xffffff, 5);
    if (ball.stage < 3) {
      ball.mesh.children[ball.stage].visible = true;
      sfx('place', { volume: 0.6, rate: 1 + ball.stage * 0.15 });
      return;
    }
    // af: een echte sneeuwpop, met een wortelneus, een hoed en een sjaal in een eigen kleur
    host.view.scene.remove(ball.mesh);
    ball.mesh = host.view.snowmanModel(ball.scarf);
    ball.mesh.rotation.y = ball.turn;
    this.placeBall(ball);
    host.view.burst(ball.gx, ball.gy, top, ball.scarf, 6);
    host.float(icon('heart'), ball.gx, ball.gy, top + 0.2);
    sfx('chime');
    sfx('guest.kid', { volume: 0.4, at: [ball.gx, ball.gy] });
    host.once('park.snowman', say.snowman());
    for (const g of host.guests()) if (Math.hypot(g.gx - ball.gx, g.gy - ball.gy) < 4) g.fun = Math.min(1, g.fun + 0.08);
    // de kinderen in de buurt komen kijken
    const sight = host.sightOf(ball);
    if (sight) host.callKid(sight);
  }

  /** Sneeuwpoppen om te bewaren (niet de smeltende). */
  save(): SnowSave[] | undefined {
    const list = this.balls.filter(b => b.melt < 0).map(b => ({ gx: Math.round(b.gx * 100) / 100, gy: Math.round(b.gy * 100) / 100, r: Math.round(b.r * 1000) / 1000, s: b.stage, c: b.scarf }));
    return list.length ? list : undefined;
  }

  /** De sneeuwpoppen uit een bewaard spel, als het nog winter is. */
  restore(list: SnowSave[] | undefined): void {
    if (!list || this.host.season() !== 'winter' || !this.host.seasons()) return;
    for (const s of list.slice(0, SNOW.max)) {
      const ball = this.newBall(s.gx, s.gy, Math.max(SNOW.r0, Math.min(SNOW.r1, s.r)));
      ball.scarf = SNOW.scarves.includes(s.c) ? s.c : ball.scarf;
      const stage = Math.max(0, Math.min(3, Math.floor(s.s))) as SnowStage;
      while (ball.stage < stage) {
        ball.stage = stackUp(ball.stage);
        if (ball.stage < 3) ball.mesh.children[ball.stage].visible = true;
      }
      if (ball.stage === 3) {
        this.host.view.scene.remove(ball.mesh);
        ball.mesh = this.host.view.snowmanModel(ball.scarf);
        ball.mesh.rotation.y = ball.turn;
        this.placeBall(ball);
      }
    }
  }

  // ------------------------------------------------------------ gasten
  /** De dingen waar gasten naartoe lopen: een grote hoop blaadjes (alleen voor het kind dat geroepen wordt) en de sneeuwpoppen. */
  sights(add: (ref: object, kind: string, x: number, y: number, tiles: number[], rot: number) => void): void {
    // (het kind dat erin sprong, ligt er daarna nog even in te lachen)
    const t = this.host.clock();
    for (const p of this.piles) if (bigPile(p.n) && (!p.jumped || t - p.jumpedAt < 6) && !this.fade) add(p, 'leafpile', p.gx, p.gy, this.host.tilesNear(p.gx, p.gy), 0);
    for (const b of this.balls) if (b.stage === 3 && b.melt < 0) add(b, 'snowman', b.gx, b.gy, this.host.tilesNear(b.gx, b.gy), 0);
  }

  /** Een gast doet iets met een hoop of een sneeuwpop. Geeft false als het niet van hier is. */
  used(sight: Sight): boolean {
    const host = this.host, pile = this.piles.find(p => p === sight.ref);
    if (pile) {
      // het kind springt erin: de blaadjes vliegen op
      if (pile.jumped) return true;
      pile.jumped = true;
      pile.jumpedAt = host.clock();
      pile.kid = null;
      pile.bounce = host.clock();
      for (let i = 0; i < 4; i++) host.view.burst(pile.gx, pile.gy, 0.15, rnd(LEAF_COLORS), 6);
      sfx('sweep', { volume: 0.5, rate: 0.85, at: [pile.gx, pile.gy] });
      host.float(icon('heart'), pile.gx, pile.gy, 0.9);
      host.once('park.leafjump', say.leavesJump());
      return true;
    }
    const ball = this.balls.find(b => b === sight.ref);
    if (!ball) return false;
    // een sneeuwballetje: plof, tegen de sneeuwpop
    const top = 0.7 * snowScale(ball.r);
    host.view.pokeDecor(ball.mesh, 'snowman', host.clock());
    host.view.burst(ball.gx, ball.gy, top, 0xffffff, 5);
    sfx('park.coinplop', { volume: 0.3, rate: 0.7, at: [ball.gx, ball.gy] });
    return true;
  }

  // ------------------------------------------------------------ lampjes
  /** Een tik op een lamp: 's nachts gaat hij uit of aan. Geeft false als het geen lamp is of als het dag is. */
  tapLamp(lamp: ParkLamp): boolean {
    const host = this.host;
    if (!host.nights() || host.dark() < 0.3 || !isLamp(lamp.kind)) return false;
    const on = this.off.has(lamp.ref), top = LAMP_TOP[lamp.kind] ?? 1;
    if (on) {
      this.off.delete(lamp.ref);
      this.onTimes.push(host.clock());
    } else this.off.add(lamp.ref);
    this.look(lamp, on ? 'on' : 'off');
    host.view.pokeDecor(lamp.mesh, lamp.kind, host.clock());
    // plop, en een paar vonkjes
    sfx('park.coinplop', { volume: 0.55, rate: on ? 1.3 : 0.75 });
    host.view.burst(lamp.gx, lamp.gy, top, on ? 0xfff1a8 : 0x9aa3ad, on ? 6 : 3);
    if (on) host.float(icon('sparkle'), lamp.gx, lamp.gy, top + 0.2);
    if (lamp.kind === 'lightstring') host.strings();
    if (on) {
      const lamps = host.lamps();
      if (waveDue(this.onTimes, host.clock(), lamps.filter(l => this.off.has(l.ref)).length, lamps.length)) this.startWave(lamp.gx, lamp.gy);
    }
    return true;
  }

  /** Een tik op de grote lamp boven de ingang: alles gaat aan, met een golfje kleuren. */
  private gateTap(cx: number, cy: number): boolean {
    const host = this.host;
    if (!host.nights() || host.dark() < 0.3) return false;
    const [gx, gy, h] = host.view.gateLampAt, s = host.view.toScreen(gx, gy, h), up = host.view.toScreen(gx, gy, h + 0.4);
    if (Math.hypot(s.x - cx, s.y - cy) > Math.max(20, Math.abs(s.y - up.y) * 1.2)) return false;
    this.allOn();
    this.startWave(gx, gy);
    return true;
  }

  private allOn(): void {
    if (!this.off.size) return;
    const strings = this.host.lamps().some(l => l.kind === 'lightstring' && this.off.has(l.ref));
    this.off.clear();
    for (const l of this.host.lamps()) this.look(l, 'on');
    if (strings) this.host.strings();
  }

  private startWave(gx: number, gy: number): void {
    const host = this.host, [ex, ey] = host.view.gateLampAt;
    const far = Math.max(Math.hypot(ex - gx, ey - gy), ...host.lamps().map(l => Math.hypot(l.gx - gx, l.gy - gy)));
    this.wave = { at: host.clock(), gx, gy, far };
    this.onTimes = [];
    sfx('chime');
    sfx('party', { volume: 0.4 });
    host.once('park.lampwave', say.lampsWave());
    for (const g of host.guests()) {
      g.fun = Math.min(1, g.fun + 0.05);
      if (Math.random() < 0.4) g.greet();
    }
  }

  private look(lamp: ParkLamp, look: 'on' | 'off' | number): void {
    if ((this.looks.get(lamp.ref) ?? 'on') === look) return;
    this.looks.set(lamp.ref, look);
    this.host.view.setLamp(lamp.mesh, look);
  }

  // ------------------------------------------------------------ elk beeldje
  /** Ringen om wat je met de hark of de sneeuw kunt doen. */
  marks(spots: { gx: number; gy: number; r?: number; hot?: boolean }[], act: string): void {
    if (act === 'rake') {
      for (const p of this.patches) spots.push({ gx: p.gx, gy: p.gy, r: 0.6 });
      for (const p of this.piles) if (bigPile(p.n)) spots.push({ gx: p.gx, gy: p.gy, hot: true, r: 1.4 + pileSize(p.n) });
    } else if (act === 'snowball') for (const b of this.balls) if (b.stage < 3 && b.melt < 0) spots.push({ gx: b.gx, gy: b.gy, hot: true, r: 1 + snowScale(b.r) });
  }

  update(dt: number): void {
    const host = this.host, t = host.clock(), season = host.season();
    if (season !== this.seasonWas) {
      // een ander seizoen: de actieknop krijgt de hark of de sneeuw (of geen van beide)
      if (this.seasonWas !== null) host.tools();
      this.seasonWas = season;
      if (season === 'autumn') this.fade = 0;
    }
    this.updateLeaves(dt, t, season);
    this.updateSnow(dt, t, season);
    this.updateLamps(t);
  }

  private updateLeaves(dt: number, t: number, season: Season): void {
    const host = this.host, autumn = season === 'autumn' && host.seasons();
    if (autumn) {
      this.fallIn -= dt;
      if (this.fallIn <= 0) {
        this.fallIn = LEAF.every * (0.6 + Math.random() * 0.8);
        this.dropLeaves();
      }
      if (this.patches.length >= 3) host.once('park.leaves', say.leavesNew());
    } else if (this.patches.length || this.piles.length) {
      // de herfst is voorbij: alles krimpt weg
      this.fade += dt;
      const left = Math.max(0, 1 - this.fade / LEAF.fade);
      for (const p of this.patches) p.k = Math.min(p.k, left);
      this.leavesDirty = true;
      if (left <= 0) {
        this.patches = [];
        for (const p of [...this.piles]) this.dropPile(p);
        this.fade = 0;
      }
    }
    for (const p of this.patches)
      if (autumn && p.k < 1) {
        p.k = Math.min(1, p.k + dt * 1.6);
        this.leavesDirty = true;
      }
    if (this.leavesDirty) {
      this.leavesDirty = false;
      this.leaves.set(this.patches);
    }
    const shrink = autumn ? 1 : Math.max(0, 1 - this.fade / LEAF.fade);
    for (const pile of this.piles) {
      // de hoop veert op als je hem harkt of als er een kind in springt
      const since = t - pile.bounce, b = since < 0.6 ? Math.sin(since * 18) * 0.18 * (1 - since / 0.6) : 0;
      const k = pileSize(pile.n) * shrink;
      pile.mesh.position.set(toWorldX(pile.gx), 0, toWorldZ(pile.gy));
      pile.mesh.scale.set(k * (1 - b * 0.5), k * (1 + b), k * (1 - b * 0.5));
      if (!autumn || !bigPile(pile.n) || pile.jumped) continue;
      // een grote hoop: er komt een kind in springen. Komt het niet, dan wordt er later een ander geroepen
      if (pile.kid && (pile.kid.gone || t - pile.calledAt > LEAF.wait)) pile.kid = null;
      if (pile.kid || pile.callIn < 0) continue;
      pile.callIn -= dt;
      if (pile.callIn > 0) continue;
      pile.callIn = 6;
      const sight = host.sightOf(pile);
      pile.kid = sight ? host.callKid(sight) : null;
      pile.calledAt = t;
    }
  }

  private updateSnow(dt: number, t: number, season: Season): void {
    const host = this.host, winter = season === 'winter' && host.seasons();
    if (winter) host.once('park.snow', say.snowNew());
    for (const ball of this.balls) {
      if (!winter && ball.melt < 0) ball.melt = 0;
      if (ball.melt >= 0) {
        ball.melt += dt;
        this.placeBall(ball);
      }
      if (ball.stage === 3) host.view.animateDecor(ball.mesh, 'snowman', t, ball.gx * 2 + ball.gy);
      else if (ball.stage > 0) {
        // de nieuwe bal ploft erop
        const k = Math.min(1, (t - ball.pop) / 0.25);
        ball.mesh.children[ball.stage].scale.setScalar(0.4 + 0.6 * k + Math.sin(k * Math.PI) * 0.25);
      }
    }
    const gone = this.balls.filter(b => b.melt >= SNOW.melt);
    for (const b of gone) {
      host.view.scene.remove(b.mesh);
      host.view.splash(b.gx, b.gy);
    }
    if (gone.length) this.balls = this.balls.filter(b => !gone.includes(b));
  }

  private updateLamps(t: number): void {
    const host = this.host;
    if (!host.nights()) return;
    if (this.gateLook === null) {
      this.gateLook = 'on';
      host.view.setGateLamp('on');
    }
    // elke avond, en elke ochtend, gaan alle lampen vanzelf weer aan
    const dark = host.dark();
    if ((dark > 0.02) !== (this.darkWas > 0.02)) this.allOn();
    this.darkWas = dark;
    if (!this.lampsTold && dark > 0.6 && host.lamps().length) {
      this.lampsTold = true;
      host.once('park.lamps', say.lampsNew());
    }
    const wave = this.wave;
    if (!wave) return;
    const since = t - wave.at, [ex, ey] = host.view.gateLampAt;
    for (const l of host.lamps()) this.look(l, waveColor(since, Math.hypot(l.gx - wave.gx, l.gy - wave.gy)) ?? (this.off.has(l.ref) ? 'off' : 'on'));
    const gate = waveColor(since, Math.hypot(ex - wave.gx, ey - wave.gy)) ?? 'on';
    if (gate !== this.gateLook) {
      this.gateLook = gate;
      host.view.setGateLamp(gate);
    }
    if (since > waveLength(wave.far) + 0.1) this.wave = null;
  }
}
