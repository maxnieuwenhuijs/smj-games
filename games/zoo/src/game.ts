// Het spel zelf: bouwen, verblijven, dieren, voeren, opruimen, figuren, levels en opslaan.
import type * as THREE from 'three';
import { saveSet, t } from '@smj/shared';
import { Animal, type AnimalWorld, type Trough } from './animal';
import {
  BEDS, FOODS, GOAL_OWNER, LEVELS, SPECIES, TERRAINS, TERRAIN_INFO, WISH_ORDER, unlockedSpecies,
  type BedKind, type FoodId, type Goal, type SpeciesId, type Terrain, type Variant, type WishId,
} from './data';
import type { FigureId, Mood } from './figures';
import { Grid, H, W, edgeAlong, edgeKey, nearestEdge, tileIndex, tileXY, type Edge, type EdgeKind, type Region } from './grid';
import { Hud, type GoalView, type ToolDef, type ToolOption } from './hud';
import { cursor, icon } from './icons';
import { emptyStats, goalProgress, levelDone, type Stats } from './levels';
import { MODEL_SCALE, spawnModel, spawnStatic } from './models';
import { View, toWorldX, toWorldZ, type TroughMesh } from './view';

export type ToolId = 'hand' | 'terrain' | 'fence' | 'trough' | 'bed' | 'animal' | 'erase';
type Verdict = 'good' | 'ok' | 'bad';
type Sex = 'male' | 'female';
type Vars = Record<string, string | number>;

const PAINT_TOOLS = new Set<ToolId>(['terrain', 'fence', 'erase']);
const TROUGH_PORTIONS = 4;
/** Verwaarlozing in seconden: eerst waarschuwen, daarna haalt de verzorger het dier op. */
const NEGLECT_WARN = 60;
const NEGLECT_GONE = 150;
const PEN_CLOSED_SECONDS = 45;
const SEX_COLOR: Record<Sex, number> = { male: 0x4a90e2, female: 0xf06aa6 };

/** Elke handeling heeft een eigen cursor, zodat je ziet wat een tik gaat doen. */
const CUR = {
  grab: 'grab',
  grabbing: 'grabbing',
  fence: cursor('fence'),
  gate: cursor('gate'),
  grass: cursor('grass'),
  mud: cursor('mud'),
  trough: cursor('trough_empty'),
  straw: cursor('straw'),
  shed: cursor('shed'),
  animal: cursor('paw'),
  erase: cursor('erase', 6, 24),
  broom: cursor('broom', 6, 26),
  pet: cursor('pet', 12, 10),
  feed: cursor('feed', 16, 8),
  menu: cursor('hand', 14, 5),
  move: cursor('move'),
};

export interface SaveData {
  v: 1;
  level: number;
  fed: number;
  cleaned: number;
  terrain: number[];
  h: number[];
  vv: number[];
  troughs: { x: number; y: number; food: FoodId | null; amount: number }[];
  animals: { species: SpeciesId; variant: Variant; gx: number; gy: number; hunger: number; name?: string }[];
  poops: { gx: number; gy: number }[];
  pens?: { tile: number; name: string }[];
  beds?: { x: number; y: number; kind: BedKind }[];
  /** Afmetingen van het park toen dit is opgeslagen; oudere spellen waren 14 bij 14. */
  gw?: number;
  gh?: number;
}

export const slotKey = (slot: number): string => `zoo-slot-${slot}`;

interface TroughObj extends Trough {
  food: FoodId | null;
  mesh: TroughMesh;
}
interface BedObj {
  x: number;
  y: number;
  kind: BedKind;
  mesh: THREE.Object3D;
}
interface PoopObj {
  gx: number;
  gy: number;
  mesh: THREE.Object3D;
}
/** Een verblijf met een naam en een naambordje. */
interface Pen {
  name: string;
  region: Region;
  cx: number;
  cy: number;
  /** De achterste hoek, waar het naambordje boven hangt. */
  ax: number;
  ay: number;
  label: HTMLElement;
  /** Tot dit moment (speltijd) mogen er geen nieuwe dieren in. */
  closedUntil: number;
}
/** Eén zin van een figuur. */
interface Line {
  who: FigureId;
  mood: Mood;
  key: string;
  vars?: Vars;
  /** Voor de wachttijd tussen twee dezelfde meldingen. */
  id?: string;
}

const sexOf = (a: Animal): Sex => (a.variant === 'male' || a.variant === 'young_m' ? 'male' : 'female');
const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

export class Game implements AnimalWorld {
  readonly grid = new Grid();
  troughs: TroughObj[] = [];
  animals: Animal[] = [];
  poops: PoopObj[] = [];
  beds: BedObj[] = [];
  pens: Pen[] = [];
  level = 0;
  fed = 0;
  cleaned = 0;
  stats: Stats = emptyStats();
  tool: ToolId = 'hand';

  private option = { terrain: 'mud', fence: 'fence', bed: 'straw', animal: '', sex: 'male' };
  private puddles: { mesh: THREE.Mesh; life: number }[] = [];
  private bubbles = new Map<Animal, HTMLElement>();
  private hud: Hud;
  private clock = 0;
  private tick = 0;
  private saveIn = 5;
  private zzzIn = 1.5;
  private celebrating = false;
  private lastHint: string | null = null;
  private savedPens: { tile: number; name: string }[] = [];
  /** Het dier dat je aan het verplaatsen bent. */
  private moving: Animal | null = null;

  // figuren
  private lines: Line[] = [];
  private said = new Map<string, number>();
  private quietUntil = 0;
  private goalIdx = -2;
  private unmet = new Map<Animal, { wish: WishId | null; since: number }>();
  private reacted = new Map<Animal, number>();

  // invoer
  private pointers = new Map<number, { x: number; y: number }>();
  private drag: { id: number; sx: number; sy: number; moved: boolean; pan: boolean; paint: boolean } | null = null;
  private pinch: { dist: number; cx: number; cy: number } | null = null;
  private stroke = new Map<string, { lo: number; hi: number }>();

  constructor(private view: View, private slot: number, data: SaveData | undefined, onHome: () => void) {
    this.hud = new Hud({
      tool: (id, row, option) => this.selectTool(id as ToolId, row, option),
      home: () => void this.save().then(onHome),
      goal: i => this.explainGoal(i),
    });
    if (data) this.load(data);
    this.view.paintTerrain(this.grid);
    this.view.syncFences(this.grid);
    this.syncPens(false);
    this.refreshGoals();
    this.refreshTools();
    this.attachInput(this.view.renderer.domElement);
    addEventListener('pagehide', () => void this.save());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) void this.save();
    });
    if (!data) this.lines.push({ who: 'director', mood: 'happy', key: 'say.welcome' });
    this.introduceLevel();
    (window as unknown as { __zoo: Game }).__zoo = this;
  }

  // ------------------------------------------------------------ opslaan
  private load(d: SaveData): void {
    // een park uit een kleiner raster komt in het midden van het nieuwe, grotere park te liggen
    const ow = d.gw ?? 14, oh = d.gh ?? 14;
    const ox = Math.floor((W - ow) / 2), oy = Math.floor((H - oh) / 2);
    if (d.terrain.length === ow * oh)
      for (let y = 0; y < oh; y++) for (let x = 0; x < ow; x++) this.grid.terrain[tileIndex(x + ox, y + oy)] = d.terrain[x + y * ow];
    if (d.h.length === ow * (oh + 1))
      for (let y = 0; y <= oh; y++) for (let x = 0; x < ow; x++) this.grid.h[x + ox + (y + oy) * W] = d.h[x + y * ow];
    if (d.vv.length === (ow + 1) * oh)
      for (let y = 0; y < oh; y++) for (let x = 0; x <= ow; x++) this.grid.v[x + ox + (y + oy) * (W + 1)] = d.vv[x + y * (ow + 1)];
    this.grid.recompute();
    this.level = Math.min(d.level, LEVELS.length);
    this.fed = d.fed;
    this.cleaned = d.cleaned;
    this.savedPens = (d.pens ?? []).map(p => ({ name: p.name, tile: tileIndex((p.tile % ow) + ox, Math.floor(p.tile / ow) + oy) }));
    for (const tr of d.troughs) this.addTrough(tr.x + ox, tr.y + oy, tr.food, tr.amount);
    for (const b of d.beds ?? []) this.addBed(b.x + ox, b.y + oy, b.kind);
    for (const a of d.animals) this.addAnimal(a.species, a.variant, a.gx + ox, a.gy + oy, a.name).hunger = a.hunger;
    for (const p of d.poops) this.dropPoop(p.gx + ox, p.gy + oy);
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
      animals: this.animals.map(a => ({ species: a.species, variant: a.variant, gx: a.gx, gy: a.gy, hunger: a.hunger, name: a.name })),
      poops: this.poops.map(({ gx, gy }) => ({ gx, gy })),
      pens: this.pens.map(p => ({ tile: p.region.tiles[0], name: p.name })),
      beds: this.beds.map(({ x, y, kind }) => ({ x, y, kind })),
      gw: W,
      gh: H,
    };
  }

  save(): Promise<void> {
    return saveSet(slotKey(this.slot), this.serialize());
  }

  // ------------------------------------------------------------ knoppen
  private selectTool(id: ToolId, row?: string, option?: string): void {
    this.tool = id;
    this.moving = null;
    if (row && option && row in this.option) this.option[row as keyof typeof this.option] = option;
    this.hud.hideMenu();
    this.view.hideGhost();
    this.refreshTools();
  }

  private refreshTools(): void {
    const species = unlockedSpecies(this.level);
    if (!species.includes(this.option.animal as SpeciesId)) this.option.animal = species[species.length - 1] ?? '';
    if (this.tool === 'animal' && !species.length) this.tool = 'hand';
    const opt = (id: string, ic: Parameters<typeof icon>[0], label: string, tone?: ToolOption['tone']): ToolOption => ({ id, icon: icon(ic), label, tone });
    const defs: ToolDef[] = [
      opt('hand', 'hand', t('tool.hand')),
      {
        ...opt('terrain', 'terrain', t('tool.terrain')),
        rows: [{ key: 'terrain', active: this.option.terrain, options: TERRAINS.map(k => opt(k, k, t(`terrain.${k}`))) }],
      },
      {
        ...opt('fence', 'fence', t('tool.fence')),
        rows: [{ key: 'fence', active: this.option.fence, options: [opt('fence', 'fence', t('fence.fence')), opt('gate', 'gate', t('fence.gate'))] }],
      },
      opt('trough', 'trough_empty', t('tool.trough')),
      {
        ...opt('bed', 'shed', t('tool.bed')),
        rows: [{ key: 'bed', active: this.option.bed, options: BEDS.map(k => opt(k, k, t(`bed.${k}`))) }],
      },
    ];
    if (species.length)
      defs.push({
        ...opt('animal', 'paw', t('tool.animal')),
        rows: [
          { key: 'sex', active: this.option.sex, options: [opt('male', 'boy', t('sex.male'), 'boy'), opt('female', 'girl', t('sex.female'), 'girl')] },
          { key: 'animal', active: this.option.animal, options: species.map(k => opt(k, k, t(`species.${k}`))) },
        ],
      });
    defs.push(opt('erase', 'erase', t('tool.erase')));
    this.lastHint = this.hintTool();
    this.hud.setTools(defs, this.tool, this.lastHint);
  }

  private firstOpenGoal(): number {
    const level = LEVELS[this.level];
    return level ? level.goals.findIndex(g => goalProgress(g, this.stats) < g.n) : -1;
  }

  /** De knop die hoort bij het eerste doel dat nog niet af is. */
  private hintTool(): string | null {
    const goal = LEVELS[this.level]?.goals[this.firstOpenGoal()];
    switch (goal?.type) {
      case 'enclosure': return 'fence';
      case 'trough': return 'trough';
      case 'bed': return 'bed';
      case 'animals': return 'animal';
      case 'fed':
      case 'cleaned': return 'hand';
      default: return null;
    }
  }

  private goalVars(g: Goal): Vars {
    return { n: g.n, many: g.species ? t(`species.${g.species}.many`) : '' };
  }

  private goalView(g: Goal, levelSpecies: SpeciesId | undefined): GoalView {
    const sp = g.species ?? levelSpecies;
    const html = {
      enclosure: icon('pen'),
      trough: icon('trough'),
      bed: icon('straw'),
      animals: icon(g.species ?? 'paw'),
      happy: icon(g.species ?? 'paw') + icon('heart', 'badge'),
      fed: icon(sp ? SPECIES[sp].food : 'veg'),
      cleaned: icon('poop'),
    }[g.type];
    return { icon: html, label: t(`goal.${g.type}`, this.goalVars(g)), n: g.n, who: GOAL_OWNER[g.type] };
  }

  private refreshGoals(): void {
    const level = LEVELS[this.level];
    const sp = level?.goals.find(x => x.species)?.species;
    this.hud.setGoals(level ? this.level + 1 : null, level ? level.goals.map(g => this.goalView(g, sp)) : []);
  }

  // ------------------------------------------------------------ figuren
  private speciesVars(sp: SpeciesId): Vars {
    const the = t(`species.${sp}.the`);
    return {
      the,
      The: cap(the),
      many: t(`species.${sp}.many`),
      food: t(`food.${SPECIES[sp].food}`).toLowerCase(),
      terrain: t(`terrain.${SPECIES[sp].terrain}`).toLowerCase(),
    };
  }

  private sayNow(line: Line): void {
    this.said.set(line.id ?? line.key, this.clock);
    this.quietUntil = this.clock + 9;
    this.hud.say(line.who, line.mood, t(line.key, line.vars));
  }

  /** Een melding die mag wachten: alleen als het stil is en hij niet net al gezegd is. */
  private alert(line: Line, cooldown = 45): void {
    if (this.hud.speaking || this.lines.length || this.clock < this.quietUntil || this.celebrating) return;
    const last = this.said.get(line.id ?? line.key);
    if (last !== undefined && this.clock - last < cooldown) return;
    this.sayNow(line);
  }

  private introduceLevel(): void {
    this.goalIdx = -2;
    this.lines.push({ who: 'director', mood: 'happy', key: LEVELS[this.level] ? `say.level.${this.level + 1}` : 'say.free' });
  }

  private goalLine(i: number): Line | null {
    const g = LEVELS[this.level]?.goals[i];
    return g ? { who: GOAL_OWNER[g.type], mood: 'happy', key: `goal.${g.type}`, vars: this.goalVars(g) } : null;
  }

  private explainGoal(i: number): void {
    const line = this.goalLine(i);
    if (line) this.sayNow(line);
  }

  // ------------------------------------------------------------ verblijven
  private pickName(listKey: string, used: string[]): string {
    const all = t(listKey).split(',');
    const free = all.filter(n => !used.includes(n));
    if (free.length) return free[Math.floor(Math.random() * free.length)];
    return `${all[Math.floor(Math.random() * all.length)]} ${used.length + 1}`;
  }

  /** Na elke verandering aan de hekken: welke verblijven zijn er, welke zijn nieuw, welke zijn weg? */
  private syncPens(announce: boolean): void {
    const old = this.pens;
    const kept = new Set<Pen>();
    const next: Pen[] = [];
    for (const region of this.grid.enclosures()) {
      const tiles = new Set(region.tiles);
      let pen = old.find(p => !kept.has(p) && p.region.tiles.some(i => tiles.has(i)));
      if (pen) kept.add(pen);
      else {
        const name = this.savedPens.find(s => tiles.has(s.tile))?.name ?? this.pickName('names.pens', [...old, ...next].map(p => p.name));
        const made: Pen = { name, region, cx: 0, cy: 0, ax: 0, ay: 0, label: null as unknown as HTMLElement, closedUntil: 0 };
        made.label = this.hud.makeLabel(name, () => this.penMenu(made));
        pen = made;
        if (announce) this.celebratePen(made);
      }
      pen.region = region;
      pen.cx = region.tiles.reduce((s, i) => s + tileXY(i)[0] + 0.5, 0) / region.tiles.length;
      pen.cy = region.tiles.reduce((s, i) => s + tileXY(i)[1] + 0.5, 0) / region.tiles.length;
      [pen.ax, pen.ay] = tileXY(region.tiles.reduce((best, i) => (tileXY(i)[0] + tileXY(i)[1] < tileXY(best)[0] + tileXY(best)[1] ? i : best)));
      next.push(pen);
    }
    for (const p of old) {
      if (kept.has(p)) continue;
      p.label.remove();
      const gone = new Set(p.region.tiles);
      for (const a of this.animals) if (gone.has(a.tile)) this.react(a, 'bad');
    }
    this.pens = next;
  }

  /** Een hek is een verblijf geworden: witte gloed, sterretjes en de bouwer noemt de naam. */
  private celebratePen(pen: Pen): void {
    this.view.flash(pen.region.tiles);
    const tiles = pen.region.tiles;
    for (let k = 0; k < Math.min(7, tiles.length); k++) {
      const [x, y] = tileXY(tiles[Math.floor(Math.random() * tiles.length)]);
      setTimeout(() => this.floatAt(icon('sparkle'), x + 0.2 + Math.random() * 0.6, y + 0.2 + Math.random() * 0.6, 0.3), k * 110);
    }
    this.sayNow({ who: 'builder', mood: 'happy', key: 'say.pen', vars: { name: pen.name } });
  }

  private penAt(x: number, y: number): Pen | undefined {
    const region = this.grid.enclosureAt(x, y);
    return region ? this.pens.find(p => p.region.id === region.id) : undefined;
  }

  private gridChanged(): void {
    this.view.syncFences(this.grid);
    this.syncPens(true);
  }

  private penMenu(pen: Pen): void {
    const s = this.view.toScreen(pen.cx, pen.cy, 0.5);
    const opt = (id: string, ic: Parameters<typeof icon>[0], key: string): ToolOption => ({ id, icon: icon(ic), label: t(key) });
    this.hud.showMenu(s.x, s.y, pen.name, [opt('clean', 'broom', 'pen.clean'), opt('rename', 'dice', 'pen.rename'), opt('empty', 'empty', 'pen.empty')], id => {
      if (id === 'clean') {
        for (const p of this.poops.filter(q => this.grid.regionOf[tileIndex(Math.floor(q.gx), Math.floor(q.gy))] === pen.region.id)) this.cleanPoop(p);
        this.floatAt(icon('sparkle'), pen.cx, pen.cy, 0.4);
      } else if (id === 'rename') {
        pen.name = this.pickName('names.pens', this.pens.map(p => p.name));
        pen.label.querySelector('b')!.textContent = pen.closedUntil ? `${pen.name} (${t('pen.closed')})` : pen.name;
        this.floatAt(pen.name, pen.cx, pen.cy, 0.6, 'word');
      } else if (this.animalsIn(pen.region.id).length) {
        // leegmaken kan je niet terugdraaien, dus eerst nog even vragen
        this.hud.showMenu(s.x, s.y, t('pen.empty.sure'), [opt('yes', 'check', 'yes'), opt('no', 'cross', 'no')], answer => {
          if (answer === 'yes') for (const a of this.animalsIn(pen.region.id)) this.removeAnimal(a);
        });
      }
    });
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

  private bedAt(x: number, y: number): BedObj | undefined {
    return this.beds.find(b => b.x === x && b.y === y);
  }

  private addBed(x: number, y: number, kind: BedKind): BedObj {
    const bed: BedObj = { x, y, kind, mesh: this.view.makeBed(x, y, kind) };
    this.beds.push(bed);
    return bed;
  }

  private placeBed(x: number, y: number): void {
    const region = this.grid.enclosureAt(x, y);
    if (!region) return this.floatAt(icon('cross'), x + 0.5, y + 0.5);
    if (this.troughAt(x, y) || this.bedAt(x, y)) return;
    const kind = this.option.bed as BedKind;
    this.addBed(x, y, kind);
    this.floatAt(icon('sparkle'), x + 0.5, y + 0.5);
    for (const a of this.animalsIn(region.id)) this.react(a, SPECIES[a.species].bed === kind ? 'good' : 'ok');
  }

  private addAnimal(species: SpeciesId, variant: Variant, gx: number, gy: number, name?: string): Animal {
    const a = new Animal(species, variant, gx, gy);
    a.name = name || this.animalName(a);
    this.view.scene.add(a.model.root);
    this.animals.push(a);
    this.bubbles.set(a, this.hud.makeBubble());
    return a;
  }

  private animalName(a: Animal): string {
    return this.pickName(sexOf(a) === 'male' ? 'names.boys' : 'names.girls', this.animals.map(x => x.name));
  }

  private removeAnimal(a: Animal): void {
    this.view.scene.remove(a.model.root);
    this.bubbles.get(a)?.remove();
    this.bubbles.delete(a);
    this.unmet.delete(a);
    this.reacted.delete(a);
    if (this.moving === a) this.moving = null;
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

  private floatAt(html: string, gx: number, gy: number, height = 0.4, cls = ''): void {
    const s = this.view.toScreen(gx, gy, height);
    this.hud.float(html, s.x, s.y, cls);
  }

  /** Het dier laat met een smiley zien wat het ervan vindt: groen, oranje of rood. */
  private react(a: Animal, verdict: Verdict, force = false): void {
    if (!force && this.clock - (this.reacted.get(a) ?? -9) < 1) return;
    this.reacted.set(a, this.clock);
    this.floatAt(icon(`smile_${verdict}`), a.gx, a.gy, a.top + 0.25);
  }

  /** Mag er op deze tegel een dier staan? */
  private canHost(x: number, y: number, mover?: Animal): boolean {
    const region = this.grid.enclosureAt(x, y);
    if (!region || this.troughAt(x, y)) return false;
    if ((this.penAt(x, y)?.closedUntil ?? 0) > this.clock) return false;
    const others = this.animalsIn(region.id).filter(a => a !== mover).length;
    return others < Math.max(2, Math.floor(region.tiles.length / 2));
  }

  private placeTrough(x: number, y: number): void {
    const region = this.grid.enclosureAt(x, y);
    if (!region) return this.floatAt(icon('cross'), x + 0.5, y + 0.5);
    if (this.troughAt(x, y) || this.bedAt(x, y)) return;
    this.addTrough(x, y, null, 0);
    this.floatAt(icon('sparkle'), x + 0.5, y + 0.5);
    for (const a of this.animalsIn(region.id)) this.react(a, 'good');
  }

  private placeAnimal(x: number, y: number): void {
    const species = this.option.animal as SpeciesId;
    if (!species) return;
    if (!this.canHost(x, y)) return this.floatAt(icon('cross'), x + 0.5, y + 0.5);
    const region = this.grid.enclosureAt(x, y)!;
    for (const a of this.animalsIn(region.id)) if (a.species === species) this.react(a, 'good');
    const a = this.addAnimal(species, this.option.sex as Sex, x + 0.5, y + 0.5);
    this.floatAt(a.name, a.gx, a.gy, a.top + 0.2, `word ${sexOf(a) === 'male' ? 'boy' : 'girl'}`);
  }

  /** Voer in de bak doen. Lust geen enkel dier in het verblijf het, dan gaat het er niet in. */
  feed(tr: TroughObj, food: FoodId): void {
    const here = this.animalsIn(this.grid.regionOf[tileIndex(tr.x, tr.y)]);
    const fans = here.filter(a => SPECIES[a.species].food === food);
    if (here.length && !fans.length) {
      for (const a of here) {
        a.emote('Sad', 1.8);
        this.react(a, 'bad', true);
      }
      this.sayNow({ who: 'keeper', mood: 'worried', key: 'alert.wrongfood', vars: this.speciesVars(here[0].species) });
      return this.floatAt(icon('cross'), tr.x + 0.5, tr.y + 0.5, 0.6);
    }
    // bijvullen van een bak die al vol zit met dit voer telt niet mee voor het doel
    const wasFull = tr.food === food && tr.amount >= TROUGH_PORTIONS;
    tr.food = food;
    tr.amount = TROUGH_PORTIONS;
    this.view.fillTrough(tr.mesh, food, tr.amount);
    this.floatAt(icon(food), tr.x + 0.5, tr.y + 0.5, 0.6);
    if (!fans.length) return;
    if (!wasFull) this.fed++;
    for (const a of fans) {
      a.emote('Happy', 1.2);
      this.react(a, 'good', true);
    }
  }

  private cleanPoop(p: PoopObj): void {
    const region = this.grid.regionOf[tileIndex(Math.floor(p.gx), Math.floor(p.gy))];
    this.view.scene.remove(p.mesh);
    this.poops = this.poops.filter(x => x !== p);
    this.cleaned++;
    this.floatAt(icon('sparkle'), p.gx, p.gy, 0.2);
    for (const a of this.animalsIn(region)) this.react(a, 'good');
  }

  /** Te lang verwaarloosd: de verzorger haalt het dier op en het verblijf gaat even dicht. */
  private takeAway(a: Animal): void {
    const [x, y] = tileXY(a.tile);
    const pen = this.penAt(x, y);
    this.floatAt(icon('smile_bad'), a.gx, a.gy, a.top + 0.25);
    const vars = this.speciesVars(a.species);
    this.removeAnimal(a);
    if (pen) {
      pen.closedUntil = this.clock + PEN_CLOSED_SECONDS;
      pen.label.classList.add('closed');
      pen.label.querySelector('b')!.textContent = `${pen.name} (${t('pen.closed')})`;
    }
    this.lines = [];
    this.sayNow({ who: 'keeper', mood: 'urgent', key: 'say.taken', vars });
  }

  private wishIcon(a: Animal, wish: WishId): string {
    const info = SPECIES[a.species];
    switch (wish) {
      case 'enclosure': return icon('fence');
      case 'food': return icon(info.food);
      case 'bed': return icon(info.bed);
      case 'terrain': return icon(info.terrain);
      case 'friend': return icon(a.species) + icon('plus', 'badge');
      case 'clean': return icon('poop');
    }
  }

  // ------------------------------------------------------------ menu's
  private foodOptions(): ToolOption[] {
    return FOODS.map(f => ({ id: f, icon: icon(f), label: t(`food.${f}`) }));
  }

  private troughMenu(tr: TroughObj): void {
    const s = this.view.toScreen(tr.x + 0.5, tr.y + 0.5, 0.3);
    const inside = tr.food && tr.amount ? icon(tr.food).repeat(tr.amount) : icon('trough_empty');
    this.hud.showMenu(s.x, s.y, t('tool.trough'), this.foodOptions(), id => this.feed(tr, id as FoodId), inside);
  }

  private animalMenu(a: Animal): void {
    const s = this.view.toScreen(a.gx, a.gy, a.top);
    const wishes = a.checkWishes(this);
    const header =
      icon(sexOf(a) === 'male' ? 'boy' : 'girl') +
      WISH_ORDER.map(k => `<span class="wish ${wishes[k] ? 'ok' : 'no'}">${this.wishIcon(a, k)}</span>`).join('');
    const opt = (id: string, ic: Parameters<typeof icon>[0], key: string): ToolOption => ({ id, icon: icon(ic), label: t(key) });
    const items = [opt('pet', 'pet', 'animal.pet'), opt('feed', 'feed', 'animal.feed'), opt('rename', 'dice', 'animal.rename'), opt('sedate', 'sleep', 'animal.sedate'), opt('move', 'move', 'animal.move')];
    this.hud.showMenu(s.x, s.y, a.name, items, id => {
      if (id === 'pet') {
        a.emote('Happy', 1.4);
        this.floatAt(icon('heart'), a.gx, a.gy, a.top + 0.2);
      } else if (id === 'feed') {
        this.hud.showMenu(s.x, s.y, t('animal.feed'), this.foodOptions(), food => this.handFeed(a, food as FoodId));
      } else if (id === 'rename') {
        a.name = this.animalName(a);
        this.floatAt(a.name, a.gx, a.gy, a.top + 0.2, 'word');
      } else if (id === 'sedate') {
        a.sedate(20);
        this.floatAt(icon('sleep'), a.gx, a.gy, a.top + 0.2);
      } else {
        this.moving = a;
      }
    }, header);
  }

  /** Zelf een dier voeren, zonder voerbak. */
  private handFeed(a: Animal, food: FoodId): void {
    if (SPECIES[a.species].food !== food) {
      a.emote('Sad', 1.6);
      this.react(a, 'bad', true);
      return this.sayNow({ who: 'keeper', mood: 'worried', key: 'alert.wrongfood', vars: this.speciesVars(a.species) });
    }
    if (!a.hungry) return this.react(a, 'ok', true);
    a.handFeed();
    this.fed++;
    this.react(a, 'good', true);
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

  private pickAnimal(cx: number, cy: number, radius = 0.6): Animal | undefined {
    return this.pick(this.animals, cx, cy, a => a.top * 0.45, radius);
  }

  private pickPoop(cx: number, cy: number): PoopObj | undefined {
    return this.pick(this.poops, cx, cy, () => 0.08, 0.5);
  }

  /** Onder de muis: het voorbeeld van wat je gaat plaatsen en de cursor die bij de handeling hoort. */
  private hover(cx: number, cy: number, dragging: boolean): void {
    this.view.hideGhost();
    const g = this.view.groundPoint(cx, cy);
    if (!g) return;
    const x = Math.floor(g.gx), y = Math.floor(g.gy);
    const inside = this.grid.inBounds(x, y);
    const animalGhost = (key: string, sex: Sex, ok: boolean) =>
      this.view.ghostAnimal(key, () => spawnModel(key).root, x, y, ok, SEX_COLOR[sex]);

    if (this.moving) {
      const a = this.moving;
      if (inside) animalGhost(`${a.species}_${a.variant}`, sexOf(a), this.canHost(x, y, a));
      return this.hud.setCursor(CUR.move);
    }
    switch (this.tool) {
      case 'terrain': {
        const terrain = this.option.terrain as Terrain;
        if (inside) this.view.ghostTile(x, y, TERRAIN_INFO[terrain].colors[0]);
        return this.hud.setCursor(CUR[terrain]);
      }
      case 'fence': {
        const gate = this.option.fence === 'gate';
        const e = nearestEdge(g.gx, g.gy);
        if (e) this.view.ghostFence(e, gate, gate ? this.grid.getEdge(e) !== 2 : this.grid.getEdge(e) === 0);
        return this.hud.setCursor(gate ? CUR.gate : CUR.fence);
      }
      case 'trough':
        if (inside && !this.troughAt(x, y)) this.view.ghostTrough(x, y, !!this.grid.enclosureAt(x, y));
        return this.hud.setCursor(inside && this.troughAt(x, y) ? CUR.feed : CUR.trough);
      case 'bed':
        if (inside && !this.troughAt(x, y) && !this.bedAt(x, y)) this.view.ghostBed(x, y, this.option.bed as BedKind, !!this.grid.enclosureAt(x, y));
        return this.hud.setCursor(CUR[this.option.bed as BedKind]);
      case 'animal': {
        const sex = this.option.sex as Sex;
        if (inside && this.option.animal) animalGhost(`${this.option.animal}_${sex}`, sex, this.canHost(x, y));
        return this.hud.setCursor(CUR.animal);
      }
      case 'erase': {
        const e = nearestEdge(g.gx, g.gy, 0.3);
        if (e && this.grid.getEdge(e) !== 0) this.view.ghostFence(e, this.grid.getEdge(e) === 2, false);
        else if (inside && this.troughAt(x, y)) this.view.ghostTrough(x, y, false);
        else if (inside && this.bedAt(x, y)) this.view.ghostBed(x, y, this.bedAt(x, y)!.kind, false);
        return this.hud.setCursor(CUR.erase);
      }
      default:
        if (dragging) return this.hud.setCursor(CUR.grabbing);
        if (this.pickPoop(cx, cy)) return this.hud.setCursor(CUR.broom);
        if (this.pickAnimal(cx, cy)) return this.hud.setCursor(CUR.pet);
        if (inside && this.troughAt(x, y)) return this.hud.setCursor(CUR.feed);
        if (inside && this.penAt(x, y)) return this.hud.setCursor(CUR.menu);
        return this.hud.setCursor(CUR.grab);
    }
  }

  /** Eén punt van een tik of sleepbeweging. `along` is de sleeprichting; bij een tik is die er niet. */
  private paint(cx: number, cy: number, along?: 'h' | 'v'): void {
    const g = this.view.groundPoint(cx, cy);
    if (!g) return;
    const first = !along;
    const x = Math.floor(g.gx), y = Math.floor(g.gy);
    if (this.tool === 'terrain') {
      const terrain = this.option.terrain as Terrain;
      if (!this.grid.setTerrain(x, y, TERRAINS.indexOf(terrain))) return;
      this.view.paintTerrain(this.grid);
      const region = this.grid.enclosureAt(x, y);
      if (region) for (const a of this.animalsIn(region.id)) this.react(a, SPECIES[a.species].terrain === terrain ? 'good' : 'bad');
    } else if (this.tool === 'fence') {
      const e = along ? edgeAlong(g.gx, g.gy, along) : nearestEdge(g.gx, g.gy);
      if (!e || (along && !this.covered(e, g.gx, g.gy))) return;
      const kind: EdgeKind = this.option.fence === 'gate' ? 2 : 1;
      if (kind === 1 && this.grid.getEdge(e) !== 0) return;
      if (this.grid.setEdge(e, kind)) this.gridChanged();
    } else if (this.tool === 'erase') {
      const e = along ? edgeAlong(g.gx, g.gy, along, 0.3) : nearestEdge(g.gx, g.gy, 0.3);
      if (e && this.grid.getEdge(e) !== 0 && (!along || this.covered(e, g.gx, g.gy))) {
        this.grid.setEdge(e, 0);
        return this.gridChanged();
      }
      if (!first) return;
      const animal = this.pickAnimal(cx, cy, 0.5);
      if (animal) return this.removeAnimal(animal);
      const tr = this.troughAt(x, y);
      if (tr) {
        this.view.scene.remove(tr.mesh.group);
        this.troughs = this.troughs.filter(k => k !== tr);
        const region = this.grid.enclosureAt(x, y);
        if (region) for (const a of this.animalsIn(region.id)) this.react(a, 'bad');
        return;
      }
      const bed = this.bedAt(x, y);
      if (bed) {
        this.view.scene.remove(bed.mesh);
        this.beds = this.beds.filter(k => k !== bed);
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
    const g = this.view.groundPoint(cx, cy);
    const x = g ? Math.floor(g.gx) : -1, y = g ? Math.floor(g.gy) : -1;
    const inside = this.grid.inBounds(x, y);

    if (this.moving) {
      const a = this.moving;
      if (!inside) {
        this.moving = null;
        return;
      }
      if (!this.canHost(x, y, a)) return this.floatAt(icon('cross'), x + 0.5, y + 0.5);
      a.moveTo(x + 0.5, y + 0.5);
      this.moving = null;
      return this.floatAt(icon('sparkle'), a.gx, a.gy, 0.5);
    }

    const poop = this.pickPoop(cx, cy);
    if (poop) return this.cleanPoop(poop);
    if (this.tool === 'hand') {
      const animal = this.pickAnimal(cx, cy);
      if (animal) return this.animalMenu(animal);
    }
    if (!inside) return;
    const tr = this.troughAt(x, y);
    if (tr) return this.troughMenu(tr);
    if (this.tool === 'trough') return this.placeTrough(x, y);
    if (this.tool === 'bed') return this.placeBed(x, y);
    if (this.tool === 'animal') return this.placeAnimal(x, y);
    const pen = this.penAt(x, y);
    if (pen) this.penMenu(pen);
  }

  private attachInput(canvas: HTMLCanvasElement): void {
    canvas.style.touchAction = 'none';
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      this.view.zoomBy(e.deltaY > 0 ? 1.1 : 0.9);
    }, { passive: false });
    canvas.addEventListener('pointerleave', () => this.view.hideGhost());

    canvas.addEventListener('pointerdown', e => {
      canvas.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      this.hud.hideMenu();
      if (this.pointers.size === 2) {
        this.drag = null;
        this.pinch = this.pinchState();
        return;
      }
      if (this.pointers.size > 2 || this.celebrating) return;
      const pan = e.button !== 0;
      const paint = !pan && !this.moving && PAINT_TOOLS.has(this.tool);
      this.drag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, moved: false, pan, paint };
      this.stroke.clear();
      // grond kleurt meteen; hek en weghalen wachten tot duidelijk is of het een tik of een veeg wordt
      if (paint && this.tool === 'terrain') this.paint(e.clientX, e.clientY);
      this.hover(e.clientX, e.clientY, true);
    });

    canvas.addEventListener('pointermove', e => {
      const prev = this.pointers.get(e.pointerId);
      if (!prev) return this.hover(e.clientX, e.clientY, false);
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
      this.hover(e.clientX, e.clientY, d.moved);
    });

    const end = (e: PointerEvent) => {
      this.pointers.delete(e.pointerId);
      if (this.pointers.size < 2) this.pinch = null;
      const d = this.drag;
      if (!d || d.id !== e.pointerId) return;
      this.drag = null;
      if (e.type === 'pointerup' && !d.moved && !d.pan) {
        if (!d.paint) this.tap(e.clientX, e.clientY);
        else if (this.tool !== 'terrain') this.paint(e.clientX, e.clientY);
      }
      if (e.pointerType === 'mouse') this.hover(e.clientX, e.clientY, false);
      else this.view.hideGhost();
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
  }

  private pinchState(): { dist: number; cx: number; cy: number } {
    const [a, b] = [...this.pointers.values()];
    return { dist: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
  }

  // ------------------------------------------------------------ elk beeldje
  private evaluate(): void {
    const stats = emptyStats();
    stats.enclosures = this.grid.enclosures().length;
    stats.troughs = this.troughs.filter(tr => this.grid.enclosureAt(tr.x, tr.y)).length;
    stats.beds = this.beds.filter(b => this.grid.enclosureAt(b.x, b.y)).length;
    stats.fed = this.fed;
    stats.cleaned = this.cleaned;
    let worst: { a: Animal; wish: WishId; age: number } | null = null;
    const taken: Animal[] = [];
    for (const a of this.animals) {
      const was = a.happy;
      const wishes = a.checkWishes(this);
      if (wishes.enclosure) stats.animals[a.species] = (stats.animals[a.species] ?? 0) + 1;
      if (a.happy) stats.happy[a.species] = (stats.happy[a.species] ?? 0) + 1;
      if (a.happy && !was) this.floatAt(icon('heart'), a.gx, a.gy, a.top);
      // zorgwensen (verblijf, voer, schoon) tellen zwaarder dan ondergrond, slaapplek en een vriendje
      const care = a.unmet === 'enclosure' || a.unmet === 'food' || a.unmet === 'clean';
      const rate = a.unmet === null ? -2 : care ? 1 : 0.4;
      a.neglect = Math.max(0, a.neglect + rate * 0.4);
      if (a.neglect > NEGLECT_GONE) taken.push(a);
      const bubble = this.bubbles.get(a)!;
      bubble.hidden = a.happy;
      bubble.classList.toggle('warn', a.neglect > NEGLECT_WARN);
      bubble.classList.toggle('danger', a.neglect > NEGLECT_WARN * 1.8);
      if (a.unmet && bubble.dataset.wish !== a.unmet) {
        bubble.dataset.wish = a.unmet;
        bubble.innerHTML = this.wishIcon(a, a.unmet);
      }
      const rec = this.unmet.get(a);
      if (!rec || rec.wish !== a.unmet) this.unmet.set(a, { wish: a.unmet, since: this.clock });
      else if (rec.wish && (!worst || this.clock - rec.since > worst.age)) worst = { a, wish: rec.wish, age: this.clock - rec.since };
    }
    this.stats = stats;
    if (taken.length) {
      const first = taken[0];
      const region = this.grid.regionOf[first.tile];
      this.takeAway(first);
      for (const a of this.animalsIn(region)) a.neglect = Math.min(a.neglect, NEGLECT_WARN);
    }

    // een dier wacht al een poos op iets: de verzorger of de bouwer zegt wat er aan de hand is
    if (worst && worst.age > 10) {
      const { a, wish } = worst;
      this.alert({
        who: wish === 'enclosure' ? 'builder' : 'keeper',
        mood: a.neglect > NEGLECT_WARN ? 'urgent' : 'worried',
        key: `alert.${wish}`,
        vars: this.speciesVars(a.species),
        id: `alert.${wish}.${a.species}`,
      });
    }

    const level = LEVELS[this.level];
    if (!level) return;
    this.hud.updateGoals(level.goals.map(g => goalProgress(g, stats)));
    if (this.hintTool() !== this.lastHint) this.refreshTools();
    if (this.celebrating) return;
    if (levelDone(level, stats)) {
      this.celebrating = true;
      this.lines = [];
      this.hud.showLevelDone(this.level + 1, icon(level.reward), t(`species.${level.reward}`), t('say.done'), () => {
        this.level++;
        this.fed = 0;
        this.cleaned = 0;
        this.celebrating = false;
        this.option.animal = level.reward;
        this.refreshGoals();
        this.refreshTools();
        this.introduceLevel();
        void this.save();
      });
      return;
    }
    // het volgende doel is aan de beurt: het figuur dat erbij hoort geeft de opdracht
    const open = this.firstOpenGoal();
    if (open !== this.goalIdx) {
      this.goalIdx = open;
      const line = this.goalLine(open);
      if (line) this.lines.push(line);
    }
  }

  update(dt: number): void {
    this.clock += dt;
    this.view.update(dt);
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

    if (this.lines.length && !this.hud.speaking && !this.celebrating) this.sayNow(this.lines.shift()!);

    this.zzzIn -= dt;
    if (this.zzzIn <= 0) {
      this.zzzIn = 1.8;
      for (const a of this.animals) if (a.sleeping) this.floatAt(icon('sleep', 'tiny'), a.gx, a.gy, a.top);
    }

    for (const [a, bubble] of this.bubbles) {
      if (bubble.hidden) continue;
      const s = this.view.toScreen(a.gx, a.gy, a.top);
      bubble.style.transform = `translate(${s.x}px, ${s.y}px) translate(-50%, -100%)`;
    }
    for (const pen of this.pens) {
      if (pen.closedUntil && pen.closedUntil <= this.clock) {
        pen.closedUntil = 0;
        pen.label.classList.remove('closed');
        pen.label.querySelector('b')!.textContent = pen.name;
        this.lines.push({ who: 'builder', mood: 'happy', key: 'say.reopen', vars: { name: pen.name } });
      }
      const s = this.view.toScreen(pen.ax, pen.ay, 0.6);
      pen.label.style.transform = `translate(${s.x}px, ${s.y}px) translate(-50%, -100%)`;
    }

    this.saveIn -= dt;
    if (this.saveIn <= 0) {
      this.saveIn = 5;
      void this.save();
    }
  }
}
