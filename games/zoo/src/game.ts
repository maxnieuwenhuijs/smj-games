// Het spel zelf: bouwen, dieren, voeren, opruimen, levels en opslaan.
import type * as THREE from 'three';
import { saveSet, t } from '@smj/shared';
import { Animal, type AnimalWorld, type Trough } from './animal';
import {
  FOODS, LEVELS, SPECIES, START_FOODS, TERRAINS, TERRAIN_INFO, unlockedSpecies,
  type FoodId, type Goal, type Level, type SpeciesId, type Terrain, type Variant, type WishId,
} from './data';
import { Grid, edgeAlong, edgeKey, nearestEdge, tileIndex, type Edge, type EdgeKind } from './grid';
import { Hud, type GoalView, type ToolDef } from './hud';
import { emptyStats, goalProgress, levelDone, type Stats } from './levels';
import { MODEL_SCALE, spawnStatic } from './models';
import { View, toWorldX, toWorldZ, type TroughMesh } from './view';

export type ToolId = 'hand' | 'terrain' | 'fence' | 'trough' | 'animal' | 'erase';
const PAINT_TOOLS = new Set<ToolId>(['terrain', 'fence', 'erase']);
const TROUGH_PORTIONS = 4;

export interface SaveData {
  v: 1;
  level: number;
  fed: number;
  cleaned: number;
  terrain: number[];
  h: number[];
  vv: number[];
  troughs: { x: number; y: number; food: FoodId | null; amount: number }[];
  animals: { species: SpeciesId; variant: Variant; gx: number; gy: number; hunger: number }[];
  poops: { gx: number; gy: number }[];
}

export const slotKey = (slot: number): string => `zoo-slot-${slot}`;

interface TroughObj extends Trough {
  food: FoodId | null;
  mesh: TroughMesh;
}
interface PoopObj {
  gx: number;
  gy: number;
  mesh: THREE.Object3D;
}

export class Game implements AnimalWorld {
  readonly grid = new Grid();
  troughs: TroughObj[] = [];
  animals: Animal[] = [];
  poops: PoopObj[] = [];
  level = 0;
  fed = 0;
  cleaned = 0;
  stats: Stats = emptyStats();
  tool: ToolId = 'hand';

  private option = { terrain: 'mud', fence: 'fence', animal: '' };
  private puddles: { mesh: THREE.Mesh; life: number }[] = [];
  private bubbles = new Map<Animal, HTMLElement>();
  private hud: Hud;
  private tick = 0;
  private saveIn = 5;
  private celebrating = false;
  private lastHint: string | null = null;

  // invoer
  private pointers = new Map<number, { x: number; y: number }>();
  private drag: { id: number; sx: number; sy: number; moved: boolean; pan: boolean; paint: boolean } | null = null;
  private pinch: { dist: number; cx: number; cy: number } | null = null;
  private stroke = new Map<string, { lo: number; hi: number }>();

  constructor(private view: View, private slot: number, data: SaveData | undefined, onHome: () => void) {
    this.hud = new Hud({
      tool: (id, option) => this.selectTool(id as ToolId, option),
      home: () => void this.save().then(onHome),
    });
    if (data) this.load(data);
    this.view.paintTerrain(this.grid);
    this.view.syncFences(this.grid);
    this.refreshGoals();
    this.refreshTools();
    this.attachInput(this.view.renderer.domElement);
    addEventListener('pagehide', () => void this.save());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) void this.save();
    });
    (window as unknown as { __zoo: Game }).__zoo = this;
  }

  // ------------------------------------------------------------ opslaan
  private load(d: SaveData): void {
    if (d.terrain.length === this.grid.terrain.length) this.grid.terrain.set(d.terrain);
    if (d.h.length === this.grid.h.length) this.grid.h.set(d.h);
    if (d.vv.length === this.grid.v.length) this.grid.v.set(d.vv);
    this.grid.recompute();
    this.level = Math.min(d.level, LEVELS.length);
    this.fed = d.fed;
    this.cleaned = d.cleaned;
    for (const tr of d.troughs) this.addTrough(tr.x, tr.y, tr.food, tr.amount);
    for (const a of d.animals) this.addAnimal(a.species, a.variant, a.gx, a.gy).hunger = a.hunger;
    for (const p of d.poops) this.dropPoop(p.gx, p.gy);
  }

  serialize(): SaveData {
    return {
      v: 1,
      level: this.level,
      fed: this.fed,
      cleaned: this.cleaned,
      terrain: Array.from(this.grid.terrain),
      h: Array.from(this.grid.h),
      vv: Array.from(this.grid.v),
      troughs: this.troughs.map(({ x, y, food, amount }) => ({ x, y, food, amount })),
      animals: this.animals.map(a => ({ species: a.species, variant: a.variant, gx: a.gx, gy: a.gy, hunger: a.hunger })),
      poops: this.poops.map(({ gx, gy }) => ({ gx, gy })),
    };
  }

  save(): Promise<void> {
    return saveSet(slotKey(this.slot), this.serialize());
  }

  // ------------------------------------------------------------ knoppen
  private selectTool(id: ToolId, option?: string): void {
    this.tool = id;
    if (option && (id === 'terrain' || id === 'fence' || id === 'animal')) this.option[id] = option;
    this.hud.hidePicker();
    this.refreshTools();
  }

  private refreshTools(): void {
    const species = unlockedSpecies(this.level);
    if (!species.includes(this.option.animal as SpeciesId)) this.option.animal = species[species.length - 1] ?? '';
    if (this.tool === 'animal' && !species.length) this.tool = 'hand';
    const defs: ToolDef[] = [
      { id: 'hand', icon: '✋', label: t('tool.hand') },
      {
        id: 'terrain', icon: '🌱', label: t('tool.terrain'),
        options: TERRAINS.map(k => ({ id: k, icon: TERRAIN_INFO[k].icon, label: t(`terrain.${k}`) })),
      },
      {
        id: 'fence', icon: '🚧', label: t('tool.fence'),
        options: [
          { id: 'fence', icon: '🚧', label: t('fence.fence') },
          { id: 'gate', icon: '🚪', label: t('fence.gate') },
        ],
      },
      { id: 'trough', icon: '🍽️', label: t('tool.trough') },
    ];
    if (species.length)
      defs.push({
        id: 'animal', icon: '🐾', label: t('tool.animal'),
        options: species.map(k => ({ id: k, icon: SPECIES[k].icon, label: t(`species.${k}`) })),
      });
    defs.push({ id: 'erase', icon: '❌', label: t('tool.erase') });
    const opt = this.tool === 'terrain' || this.tool === 'fence' || this.tool === 'animal' ? this.option[this.tool] : undefined;
    this.lastHint = this.hintTool();
    this.hud.setTools(defs, this.tool, opt, this.lastHint);
  }

  /** De knop die hoort bij het eerste doel dat nog niet af is. */
  private hintTool(): string | null {
    const level = LEVELS[this.level];
    const goal = level?.goals.find(g => goalProgress(g, this.stats) < g.n);
    switch (goal?.type) {
      case 'enclosure': return 'fence';
      case 'trough': return 'trough';
      case 'animals': return 'animal';
      case 'fed':
      case 'cleaned': return 'hand';
      default: return null;
    }
  }

  private goalView(g: Goal, level: Level): GoalView {
    const name = g.species ? t(`species.${g.species}`) : '';
    const sp = g.species ?? level.goals.find(x => x.species)?.species;
    const icon = {
      enclosure: '🏡',
      trough: '🍽️',
      animals: g.species ? SPECIES[g.species].icon : '🐾',
      happy: `${g.species ? SPECIES[g.species].icon : '🐾'}❤️`,
      fed: sp ? FOODS[SPECIES[sp].food].icon : '🥕',
      cleaned: '💩',
    }[g.type];
    return { icon, label: t(`goal.${g.type}`, { name }), n: g.n };
  }

  private refreshGoals(): void {
    const level = LEVELS[this.level];
    this.hud.setGoals(level ? this.level + 1 : null, level ? level.goals.map(g => this.goalView(g, level)) : []);
  }

  // ------------------------------------------------------------ park
  private troughAt(x: number, y: number): TroughObj | undefined {
    return this.troughs.find(tr => tr.x === x && tr.y === y);
  }

  private addTrough(x: number, y: number, food: FoodId | null, amount: number): TroughObj {
    const tr: TroughObj = { x, y, food, amount, mesh: this.view.makeTrough(x, y) };
    this.view.fillTrough(tr.mesh, food, amount);
    this.troughs.push(tr);
    return tr;
  }

  private addAnimal(species: SpeciesId, variant: Variant, gx: number, gy: number): Animal {
    const a = new Animal(species, variant, gx, gy);
    this.view.scene.add(a.model.root);
    this.animals.push(a);
    this.bubbles.set(a, this.hud.makeBubble());
    return a;
  }

  private removeAnimal(a: Animal): void {
    this.view.scene.remove(a.model.root);
    this.bubbles.get(a)?.remove();
    this.bubbles.delete(a);
    this.animals = this.animals.filter(x => x !== a);
  }

  private animalsIn(regionId: number): Animal[] {
    return this.animals.filter(a => this.grid.regionOf[a.tile] === regionId);
  }

  poopsIn(regionId: number): number {
    return this.poops.filter(p => this.grid.regionOf[tileIndex(Math.floor(p.gx), Math.floor(p.gy))] === regionId).length;
  }

  dropPoop(gx: number, gy: number): void {
    const mesh = spawnStatic('poop');
    mesh.scale.setScalar(MODEL_SCALE * 0.9);
    mesh.position.set(toWorldX(gx), 0, toWorldZ(gy));
    this.view.scene.add(mesh);
    this.poops.push({ gx, gy, mesh });
  }

  dropPuddle(gx: number, gy: number): void {
    this.puddles.push({ mesh: this.view.makePuddle(gx, gy), life: 14 });
  }

  ate(trough: Trough): void {
    const tr = trough as TroughObj;
    tr.amount = Math.max(0, tr.amount - 1);
    this.view.fillTrough(tr.mesh, tr.food, tr.amount);
  }

  private floatAt(icon: string, gx: number, gy: number, height = 0.4): void {
    const s = this.view.toScreen(gx, gy, height);
    this.hud.float(icon, s.x, s.y);
  }

  private placeTrough(x: number, y: number): void {
    if (!this.grid.enclosureAt(x, y)) return this.floatAt('🚧', x + 0.5, y + 0.5);
    if (this.troughAt(x, y)) return;
    this.addTrough(x, y, null, 0);
    this.floatAt('✨', x + 0.5, y + 0.5);
  }

  private placeAnimal(x: number, y: number): void {
    const species = this.option.animal as SpeciesId;
    if (!species) return;
    const region = this.grid.enclosureAt(x, y);
    if (!region) return this.floatAt('🚧', x + 0.5, y + 0.5);
    if (this.troughAt(x, y)) return;
    if (this.animalsIn(region.id).length >= Math.max(2, Math.floor(region.tiles.length / 2))) return this.floatAt('🚫', x + 0.5, y + 0.5);
    const same = this.animals.filter(a => a.species === species);
    const males = same.filter(a => a.variant === 'male').length;
    this.addAnimal(species, males * 2 <= same.length ? 'male' : 'female', x + 0.5, y + 0.5);
    this.floatAt('✨', x + 0.5, y + 0.5, 0.8);
  }

  /** Voer in de bak doen. Lust geen enkel dier in het verblijf het, dan gaat het er niet in. */
  feed(tr: TroughObj, food: FoodId): void {
    const region = this.grid.regionOf[tileIndex(tr.x, tr.y)];
    const here = this.animalsIn(region);
    const fans = here.filter(a => SPECIES[a.species].food === food);
    if (here.length && !fans.length) {
      for (const a of here) a.emote('Sad', 1.8);
      return this.floatAt('❌', tr.x + 0.5, tr.y + 0.5, 0.6);
    }
    // bijvullen van een bak die al vol zit met dit voer telt niet mee voor het doel
    const wasFull = tr.food === food && tr.amount >= TROUGH_PORTIONS;
    tr.food = food;
    tr.amount = TROUGH_PORTIONS;
    this.view.fillTrough(tr.mesh, food, tr.amount);
    this.floatAt(FOODS[food].icon, tr.x + 0.5, tr.y + 0.5, 0.6);
    if (fans.length) {
      if (!wasFull) this.fed++;
      for (const a of fans) a.emote('Happy', 1.2);
    }
  }

  private cleanPoop(p: PoopObj): void {
    this.view.scene.remove(p.mesh);
    this.poops = this.poops.filter(x => x !== p);
    this.cleaned++;
    this.floatAt('✨', p.gx, p.gy, 0.2);
  }

  private wishIcon(a: Animal, wish: WishId): string {
    const info = SPECIES[a.species];
    switch (wish) {
      case 'enclosure': return '🚧';
      case 'food': return FOODS[info.food].icon;
      case 'terrain': return TERRAIN_INFO[info.terrain].icon;
      case 'friend': return `➕${info.icon}`;
      case 'clean': return '💩';
    }
  }

  // ------------------------------------------------------------ invoer
  private pxPerTile(): number {
    return innerHeight / this.view.zoom;
  }

  private pick<T extends { gx: number; gy: number }>(items: T[], cx: number, cy: number, height: (i: T) => number, radius: number): T | undefined {
    let best: T | undefined;
    let bestD = Math.max(34, radius * this.pxPerTile());
    for (const item of items) {
      const s = this.view.toScreen(item.gx, item.gy, height(item));
      const d = Math.hypot(s.x - cx, s.y - cy);
      if (d < bestD) [best, bestD] = [item, d];
    }
    return best;
  }

  /** Eén punt van een tik of sleepbeweging. `along` is de sleeprichting; bij de eerste tik is die er niet. */
  private paint(cx: number, cy: number, along?: 'h' | 'v'): void {
    const g = this.view.groundPoint(cx, cy);
    if (!g) return;
    const first = !along;
    const x = Math.floor(g.gx), y = Math.floor(g.gy);
    if (this.tool === 'terrain') {
      if (this.grid.setTerrain(x, y, TERRAINS.indexOf(this.option.terrain as Terrain))) this.view.paintTerrain(this.grid);
    } else if (this.tool === 'fence') {
      const e = along ? edgeAlong(g.gx, g.gy, along) : nearestEdge(g.gx, g.gy);
      if (!e || (along && !this.covered(e, g.gx, g.gy))) return;
      const kind: EdgeKind = this.option.fence === 'gate' ? 2 : 1;
      if (kind === 1 && this.grid.getEdge(e) !== 0) return;
      if (this.grid.setEdge(e, kind)) this.view.syncFences(this.grid);
    } else if (this.tool === 'erase') {
      const e = along ? edgeAlong(g.gx, g.gy, along, 0.3) : nearestEdge(g.gx, g.gy, 0.3);
      if (e && this.grid.getEdge(e) !== 0 && (!along || this.covered(e, g.gx, g.gy))) {
        this.grid.setEdge(e, 0);
        return this.view.syncFences(this.grid);
      }
      if (!first) return;
      const animal = this.pick(this.animals, cx, cy, a => a.top * 0.45, 0.5);
      if (animal) return this.removeAnimal(animal);
      const tr = this.troughAt(x, y);
      if (tr) {
        this.view.scene.remove(tr.mesh.group);
        this.troughs = this.troughs.filter(k => k !== tr);
      }
    }
  }

  /**
   * Heeft deze sleepbeweging al een flink stuk van de rand afgelegd? Zo komt er geen los stukje hek bij
   * als je net iets te ver doorsleept over een hoek.
   */
  private covered(e: Edge, gx: number, gy: number): boolean {
    const at = e.o === 'h' ? gx - e.x : gy - e.y;
    const key = edgeKey(e);
    const span = this.stroke.get(key) ?? { lo: at, hi: at };
    span.lo = Math.min(span.lo, at);
    span.hi = Math.max(span.hi, at);
    this.stroke.set(key, span);
    return span.hi - span.lo >= 0.3;
  }

  /** Een stukje sleepbeweging, in kleine stapjes zodat een snelle veeg geen tegels overslaat. */
  private paintStroke(x0: number, y0: number, x1: number, y1: number): void {
    const a = this.view.groundPoint(x0, y0), b = this.view.groundPoint(x1, y1);
    if (!a || !b) return;
    const along = Math.abs(b.gx - a.gx) >= Math.abs(b.gy - a.gy) ? 'h' : 'v';
    const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / (this.pxPerTile() * 0.2)));
    for (let i = 1; i <= steps; i++) this.paint(x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps, along);
  }

  private tap(cx: number, cy: number): void {
    const poop = this.pick(this.poops, cx, cy, () => 0.08, 0.5);
    if (poop) return this.cleanPoop(poop);
    const g = this.view.groundPoint(cx, cy);
    if (!g) return;
    const x = Math.floor(g.gx), y = Math.floor(g.gy);
    if (!this.grid.inBounds(x, y)) return;
    const tr = this.troughAt(x, y);
    if (tr) {
      const s = this.view.toScreen(tr.x + 0.5, tr.y + 0.5, 0.3);
      return this.hud.showPicker(s.x, s.y, START_FOODS.map(f => ({ id: f, icon: FOODS[f].icon, label: t(`food.${f}`) })), id =>
        this.feed(tr, id as FoodId),
      );
    }
    if (this.tool === 'trough') return this.placeTrough(x, y);
    if (this.tool === 'animal') return this.placeAnimal(x, y);
    const animal = this.pick(this.animals, cx, cy, a => a.top * 0.45, 0.6);
    if (animal) {
      const wishes = animal.checkWishes(this);
      const missing = (Object.keys(wishes) as WishId[]).filter(k => !wishes[k]);
      if (!missing.length) animal.emote('Happy', 1.2);
      this.floatAt(missing.length ? missing.map(k => this.wishIcon(animal, k)).join(' ') : '❤️', animal.gx, animal.gy, animal.top + 0.3);
    }
  }

  private attachInput(canvas: HTMLCanvasElement): void {
    canvas.style.touchAction = 'none';
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      this.view.zoomBy(e.deltaY > 0 ? 1.1 : 0.9);
    }, { passive: false });

    canvas.addEventListener('pointerdown', e => {
      canvas.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      this.hud.hidePicker();
      if (this.pointers.size === 2) {
        this.drag = null;
        this.pinch = this.pinchState();
        return;
      }
      if (this.pointers.size > 2 || this.celebrating) return;
      const pan = e.button !== 0;
      const paint = !pan && PAINT_TOOLS.has(this.tool);
      this.drag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, moved: false, pan, paint };
      this.stroke.clear();
      // grond kleurt meteen; hek en weghalen wachten tot duidelijk is of het een tik of een veeg wordt
      if (paint && this.tool === 'terrain') this.paint(e.clientX, e.clientY);
    });

    canvas.addEventListener('pointermove', e => {
      const prev = this.pointers.get(e.pointerId);
      if (!prev) return;
      const dx = e.clientX - prev.x, dy = e.clientY - prev.y;
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pinch && this.pointers.size >= 2) {
        const now = this.pinchState();
        this.view.zoomBy(this.pinch.dist / Math.max(1, now.dist));
        this.view.pan(now.cx - this.pinch.cx, now.cy - this.pinch.cy);
        this.pinch = now;
        return;
      }
      const d = this.drag;
      if (!d || d.id !== e.pointerId) return;
      if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 8) d.moved = true;
      if (d.paint) this.paintStroke(prev.x, prev.y, e.clientX, e.clientY);
      else if (d.pan || d.moved) this.view.pan(dx, dy);
    });

    const end = (e: PointerEvent) => {
      this.pointers.delete(e.pointerId);
      if (this.pointers.size < 2) this.pinch = null;
      const d = this.drag;
      if (!d || d.id !== e.pointerId) return;
      this.drag = null;
      if (e.type !== 'pointerup' || d.moved || d.pan) return;
      if (!d.paint) this.tap(e.clientX, e.clientY);
      else if (this.tool !== 'terrain') this.paint(e.clientX, e.clientY);
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
  }

  private pinchState(): { dist: number; cx: number; cy: number } {
    const [a, b] = [...this.pointers.values()];
    return { dist: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
  }

  // ------------------------------------------------------------ elke beeldje
  private evaluate(): void {
    const stats = emptyStats();
    stats.enclosures = this.grid.enclosures().length;
    stats.troughs = this.troughs.filter(tr => this.grid.enclosureAt(tr.x, tr.y)).length;
    stats.fed = this.fed;
    stats.cleaned = this.cleaned;
    for (const a of this.animals) {
      const was = a.happy;
      const wishes = a.checkWishes(this);
      if (wishes.enclosure) stats.animals[a.species] = (stats.animals[a.species] ?? 0) + 1;
      if (a.happy) stats.happy[a.species] = (stats.happy[a.species] ?? 0) + 1;
      if (a.happy && !was) this.floatAt('❤️', a.gx, a.gy, a.top);
      const bubble = this.bubbles.get(a)!;
      bubble.hidden = a.happy;
      if (a.unmet) bubble.textContent = this.wishIcon(a, a.unmet);
    }
    this.stats = stats;

    const level = LEVELS[this.level];
    if (!level) return;
    this.hud.updateGoals(level.goals.map(g => goalProgress(g, stats)));
    if (this.hintTool() !== this.lastHint) this.refreshTools();
    if (!this.celebrating && levelDone(level, stats)) {
      this.celebrating = true;
      this.hud.showLevelDone(this.level + 1, SPECIES[level.reward].icon, t(`species.${level.reward}`), () => {
        this.level++;
        this.fed = 0;
        this.cleaned = 0;
        this.celebrating = false;
        this.option.animal = level.reward;
        this.refreshGoals();
        this.refreshTools();
        void this.save();
      });
    }
  }

  update(dt: number): void {
    for (const a of this.animals) a.update(dt, this);

    for (const p of this.puddles) {
      p.life -= dt;
      (p.mesh.material as THREE.MeshStandardMaterial).opacity = Math.min(1, p.life / 3);
      if (p.life <= 0) this.view.scene.remove(p.mesh);
    }
    this.puddles = this.puddles.filter(p => p.life > 0);

    this.tick -= dt;
    if (this.tick <= 0) {
      this.tick = 0.4;
      this.evaluate();
    }

    for (const [a, bubble] of this.bubbles) {
      if (bubble.hidden) continue;
      const s = this.view.toScreen(a.gx, a.gy, a.top);
      bubble.style.transform = `translate(${s.x}px, ${s.y}px) translate(-50%, -100%)`;
    }

    this.saveIn -= dt;
    if (this.saveIn <= 0) {
      this.saveIn = 5;
      void this.save();
    }
  }
}
