// Ontwikkelpagina (modellen.html): alle zelfgebouwde modellen op een rij, om ze van dichtbij te bekijken en te
// fotograferen. Alleen te zien met `npm run dev`; de pagina zit niet in het gepubliceerde spel.
//
// In de adresbalk: ?groep=bedden (zie GROUPS), &alleen=nest,grot (alleen die modellen, groot in beeld),
// &bos=1 (de bomen rond het park), &seizoen=winter, &nacht=1, &spook=1 (het doorzichtige voorbeeld), &draai=1 (kwartslagen), &druk=1 (alsof er
// gasten zijn), &t=2.5 (het moment van de foto), &zoom=6 (tegels in beeld).
import * as THREE from 'three';
import { BEDS, BUMPER_CARS, DECORS, EDGE_DECOR, FOODS, PARK_PROPS, WILD_PROPS, SHOPS, TERRAINS, TOYS, TROUGHS, bumperCar, onEdge, shopSpan, type BedKind, type DecorKind, type FoodId, type PropKind, type Season, type ShopKind, type Terrain, type ToyKind, type TroughKind } from './data';
import { BASE_LAND, FULL_LAND, Grid, edgeKey, type Edge, type EdgeKind } from './grid';
import { View, toWorldX, toWorldZ } from './view';
import { FACES, sampleHead, showSample } from './faces';
import { SAMPLE_PEOPLE, samplePerson } from './people';
import { RIDE_SEATS, isRide, newRide, rideStep } from './rides';

const query = new URLSearchParams(location.search);
const num = (key: string, fallback: number): number => (query.has(key) ? Number(query.get(key)) : fallback);
const ghost = query.get('spook') === '1', rot = num('draai', 0), night = query.get('nacht') === '1', busy = num('druk', 0);
const season = (query.get('seizoen') ?? 'summer') as Season;
const only = query.get('alleen')?.split(',') ?? null;
/** De bomen rond het park bekijken: dan houdt het park zijn gewone grootte en staat het beeld op de bosrand. */
const forest = query.get('bos') === '1';

/** Eén model op de plaat: zijn naam, hoeveel tegels het breed is en hoe het op tegel (x, y) gezet wordt. */
interface Item {
  name: string;
  size: number;
  /** Hoeveel tegels het diep is, als dat anders is dan gewoon (iets van drie breed is anders één diep). */
  deep?: number;
  put: (x: number, y: number) => void;
}
const deepOf = (item: Item): number => item.deep ?? (item.size === 3 ? 1 : item.size);

const view = new View(document.body);
view.renderer.setPixelRatio(1);
const grid = new Grid(FULL_LAND);
view.setLand(forest ? BASE_LAND : FULL_LAND, []);
view.setSeason(season);

/** Wat elk beeldje moet bewegen. */
const live: ((t: number) => void)[] = [];
const wear = new Map<string, number>();
/** De natuurdingen: die tekent het beeld allemaal in een keer (zie View.syncProps). */
const props: { kind: PropKind; gx: number; gy: number; rot: number }[] = [];

const bed = (kind: BedKind): Item => ({
  name: kind, size: 1,
  put: (x, y) => (ghost ? view.ghostBed(x, y, kind, true, rot) : view.makeBed(x, y, kind, rot)),
});
const toy = (kind: ToyKind): Item => ({
  name: kind, size: 1,
  put: (x, y) => (ghost ? view.ghostToy(x, y, kind, true, rot) : view.makeToy(x, y, kind, rot)),
});
const decor = (kind: DecorKind): Item => ({
  name: kind, size: 1,
  put: (x, y) => {
    // wat op een rand hoort, staat hier ook op een rand: de noordrand van de tegel ervoor
    const edge = EDGE_DECOR.includes(kind) ? 'h' : undefined, py = edge ? y + 1 : y;
    if (ghost) return view.ghostDecor(x, py, kind, true, edge, rot);
    const group = view.makeDecor(x, py, kind, edge, rot);
    const seed = x * 1.3 + y * 0.7;
    live.push(t => view.animateDecor(group, kind, t, seed));
    if (query.get('tik') === '1') view.pokeDecor(group, kind, num('t', 1.3) - 0.3);
  },
});
/** De vijvers van de groep 'vijvers': het beeld laat buren in elkaar overlopen (zie View.syncPonds). */
const ponds: { x: number; y: number; rot: number; mesh: THREE.Object3D }[] = [];
/** Een vijver van meer tegels; `tiles` zijn de tegels, geteld vanaf de hoek linksboven. */
const pond = (name: string, size: number, tiles: [number, number][]): Item => ({
  name, size,
  put: (x, y) => {
    // het voorbeeld is altijd één losse vijver
    if (ghost) return view.ghostDecor(x, y, 'pond', true, undefined, rot);
    for (const [dx, dy] of tiles) {
      const mesh = view.makeDecor(x + dx, y + dy, 'pond', undefined, rot);
      ponds.push({ x: x + dx, y: y + dy, rot, mesh });
      const seed = (x + dx) * 2 + y + dy;
      live.push(t => view.animateDecor(mesh, 'pond', t, seed));
      if (query.get('tik') === '1') view.pokeDecor(mesh, 'pond', num('t', 1.3) - 0.3);
    }
  },
});
const shop = (kind: ShopKind): Item => ({
  // (zoveel tegels beslaat het zoals het hier gedraaid staat: niet elk gebouw is vierkant)
  name: kind, size: onEdge(kind) ? 1 : shopSpan(kind, rot)[0], deep: onEdge(kind) ? 1 : shopSpan(kind, rot)[1],
  put: (x, y) => {
    // een bankje, bloembak of afvalbak staat op de rand van een pad en kijkt naar het pad (hier: naar voren)
    const edge = onEdge(kind) ? { o: 'h' as const, face: 1 } : undefined, py = edge ? y + 1 : y;
    if (ghost) return view.ghostShop(x, py, kind, true, edge, rot);
    const group = view.makeShop(x, py, kind, edge, rot);
    const seed = x * 1.3 + y * 0.7, moving = group.userData.moving as THREE.Object3D | undefined;
    if (kind === 'bin' && query.get('tik') === '1') view.flapLid(group);
    // een attractie uit rides.ts: dezelfde stand en dezelfde stappen als in het spel; met &druk=1 zit hij vol gasten
    const ride = isRide(kind) ? newRide(kind) : null, riders = busy && isRide(kind) ? 2 ** RIDE_SEATS[kind] - 1 : 0;
    live.push(t => {
      view.animateShop(group, kind, t, busy, seed);
      if (ride) {
        while (ride.clock < t - 1e-6) rideStep(kind, ride, Math.min(1 / 30, t - ride.clock), riders);
        view.animateRide(group, kind, ride);
        return;
      }
      // wat het spel zelf laat bewegen: hier net genoeg om te zien dat het goede deel beweegt
      if (kind === 'fountain' && moving) moving.position.y = 0.97 + Math.sin(t * 3) * 0.08;
      if (kind === 'swing' && moving) moving.rotation.x = Math.sin(t * 2) * 0.5;
      if (kind === 'seesaw' && moving) moving.rotation.z = Math.sin(t * 2) * 0.3;
      if (kind === 'springer' && moving) moving.rotation.x = Math.sin(t * 2) * 0.3;
      if (kind === 'bumper')
        (group.userData.cars as THREE.Object3D[]).slice(0, BUMPER_CARS).forEach((car, i) => {
          const [cx, cz, heading] = bumperCar(i, t);
          car.position.set(cx, 0.05, cz);
          car.rotation.y = heading;
        });
    });
  },
});
const trough = (kind: TroughKind, food: FoodId | null, amount: number): Item => ({
  name: food ? `${kind}: ${food}` : kind, size: 1,
  put: (x, y) => {
    if (ghost) return view.ghostTrough(x, y, true, rot);
    view.fillTrough(view.makeTrough(x, y, kind, rot), food, amount);
  },
});
/** Drie hekdelen naast elkaar; `worn` is hoe versleten het houten hek is. */
const fence = (name: string, kind: EdgeKind, worn = 0): Item => ({
  name, size: 3,
  put: (x, y) => {
    for (let i = 0; i < 3; i++) {
      const e: Edge = { o: 'h', x: x + i, y: y + 1 };
      grid.setEdge(e, kind);
      if (worn) wear.set(edgeKey(e), worn);
    }
    // en een stukje de hoek om, zodat je het ook van opzij ziet
    const side: Edge = { o: 'v', x, y };
    grid.setEdge(side, kind === 2 || kind === 6 || kind === 8 ? 1 : kind);
    if (worn) wear.set(edgeKey(side), worn);
  },
});
const litter = (i: number): Item => ({
  name: `afval ${i + 1}`, size: 1,
  put: (x, y) => {
    // makeLitter kiest zelf een soort: hier krijgt hij vaste getallen, zodat elke soort een keer voorkomt
    const real = Math.random;
    Math.random = () => (i + 0.5) / 4;
    view.makeLitter(x + 0.5, y + 0.5);
    Math.random = real;
  },
});
const prop = (kind: PropKind): Item => ({
  name: kind, size: 1,
  put: (x, y) => {
    if (ghost) view.ghostProp(kind, x + 0.5, y + 0.5, rot, true);
    else props.push({ kind, gx: x + 0.5, gy: y + 0.5, rot });
  },
});
/** Drie tegels pad naast elkaar (het bloemenpad heeft bloemetjes langs de rand). */
const path = (kind: 'flowerpath' | 'bridge' | 'planks'): Item => ({
  name: kind, size: 3,
  put: (x, y) => {
    for (let i = 0; i < 3; i++) grid.setTerrain(x + i, y, TERRAINS.indexOf(kind));
  },
});
/** Een veldje van drie bij drie tegels van één soort grond. */
const patch = (kind: Terrain): Item => ({
  name: kind, size: 3, deep: 3,
  put: (x, y) => {
    for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 3; dx++) grid.setTerrain(x + dx, y + dy, TERRAINS.indexOf(kind));
  },
});
/** Een groot los hoofd met gezicht nummer `i`; de uitdrukkingen komen om de beurt langs (zie faces.ts). */
const face = (i: number): Item => ({
  name: `${i}`, size: 1,
  put: (x, y) => {
    const head = sampleHead(i);
    head.position.set(toWorldX(x + 0.5), 0, toWorldZ(y + 0.5));
    view.scene.add(head);
    live.push(t => showSample(head, i + Math.floor(t / 1.5)));
  },
});
/** Een heel poppetje (zie people.ts): gasten en kinderen met elk ander haar en andere kleren, een werker en een verkoper. */
const person = (name: string, i: number): Item => ({
  name, size: 1,
  put: (x, y) => {
    const figure = samplePerson(i);
    figure.position.set(toWorldX(x + 0.5), 0, toWorldZ(y + 0.5));
    view.scene.add(figure);
  },
});
const train: Item = {
  name: 'trein', size: 3,
  put: (x, y) => {
    const { loco, wagons } = view.makeTrain();
    [loco, ...wagons].forEach((part, i) => {
      part.visible = true;
      part.position.set(toWorldX(x + 2.4 - i * 0.95), 0, toWorldZ(y + 0.5));
      part.rotation.y = Math.PI / 2;
    });
  },
};

const DECOR_SETS: Record<string, DecorKind[]> = {
  bomen: ['tree', 'pine', 'palm', 'cherry', 'bamboogrove', 'topiary', 'cactus', 'hedge', 'arch'],
  bloemen: ['roses', 'tulips', 'sunflowers', 'mushrooms', 'pumpkins', 'boulder', 'pond', 'well', 'birdbath', 'waterfall', 'pump'],
  borden: ['signpost', 'flag', 'lantern', 'gardenlight', 'lampion', 'torch', 'streetlamp', 'bunting', 'lightstring', 'mapboard', 'guestbook', 'picnic'],
  beelden: ['scarecrow', 'totem', 'snowman', 'campfire', 'windmill', 'statue', 'clocktower'],
};
const SHOP_SETS: Record<string, ShopKind[]> = {
  kramen: ['foodstall', 'drinkstall', 'icecream', 'balloon', 'hats', 'souvenir', 'facepaint'],
  gebouwen: ['toilet', 'restaurant', 'shelter', 'station'],
  klein: ['bench', 'flowers', 'bin', 'umbrellas'],
  speeltuin: ['slide', 'swing', 'seesaw', 'springer', 'trampoline'],
  attracties: ['fountain', 'carousel', 'tower', 'bumper', 'ferris', 'show', 'cablecar'],
};
const GROUPS: Record<string, Item[]> = {
  bedden: BEDS.map(bed),
  voer: [...TROUGHS.map(kind => trough(kind, null, 0)), ...FOODS.map(food => trough('wood', food, 4)), trough('big', 'hay', 8), trough('silo', 'grain', 12)],
  speeltjes: TOYS.map(toy),
  hekken: [fence('hek', 1), fence('hek, versleten 1', 1, 1), fence('hek, versleten 2', 1, 2), fence('hek, versleten 3', 1, 3), fence('poort', 2), fence('muur', 3), fence('net', 4), fence('glas', 5), fence('kijkvenster', 6), fence('wit hekje', 7), fence('poortje', 8)],
  ...Object.fromEntries(Object.entries(DECOR_SETS).map(([name, kinds]) => [name, kinds.map(decor)])),
  ...Object.fromEntries(Object.entries(SHOP_SETS).map(([name, kinds]) => [name, kinds.map(shop)])),
  afval: [0, 1, 2, 3].map(litter),
  trein: [train],
  // alle gezichten van de poppetjes, elk met een andere uitdrukking (&t=... kiest het moment)
  gezichten: Array.from({ length: FACES }, (_, i) => face(i)),
  // hele poppetjes: elk kapsel, kinderen, een paar met een hoedje, een werker en een verkoper
  poppetjes: SAMPLE_PEOPLE.map(person),
  pad: [path('flowerpath'), path('bridge')],
  // elke soort ondergrond als een veldje, tegen elkaar aan: zo zie je ook de overgangen
  grond: TERRAINS.map(patch),
  natuur: WILD_PROPS.map(prop),
  // het kleine spul voor het park, elk in het midden van een eigen tegel
  parkjes: PARK_PROPS.map(prop),
  // vijvers die aan elkaar haken: los, twee naast elkaar, een blok, een hoek, drie op een rij en een grillige grote
  vijvers: [
    pond('vijver los', 1, [[0, 0]]),
    pond('vijver 2', 2, [[0, 0], [1, 0]]),
    pond('vijver 2x2', 2, [[0, 0], [1, 0], [0, 1], [1, 1]]),
    pond('vijver hoek', 2, [[0, 0], [0, 1], [1, 1]]),
    pond('vijver 3', 3, [[0, 0], [1, 0], [2, 0]]),
    pond('vijver groot', 4, [[1, 0], [2, 0], [0, 1], [1, 1], [2, 1], [3, 1], [0, 2], [1, 2], [2, 2], [1, 3]]),
  ],
};
// niets vergeten: wat in geen enkel rijtje staat, komt in 'rest'
const listed = new Set([...Object.values(DECOR_SETS).flat(), ...Object.values(SHOP_SETS).flat()] as string[]);
const rest = [...DECORS.filter(k => !listed.has(k)).map(decor), ...SHOPS.filter(k => !listed.has(k)).map(shop)];
if (rest.length) GROUPS.rest = rest;

const groupName = query.get('groep') ?? 'bedden';
const items = (GROUPS[groupName] ?? []).filter(item => !only || only.includes(item.name));

// Per groep: hoe hoog de modellen ongeveer zijn, hoeveel ruimte ertussen moet en hoeveel er op een rij staan.
const LOOK: Record<string, { tall?: number; gap?: number; row?: number }> = {
  kramen: { tall: 3.2 }, gebouwen: { tall: 3 }, speeltuin: { tall: 3 }, attracties: { tall: 4.6, gap: 2, row: 3 }, afval: { tall: 0.5 }, klein: { tall: 1.2 },
  voer: { tall: 1.4 }, hekken: { tall: 1.4 }, trein: { tall: 1.2 }, parkjes: { tall: 0.7, gap: 0, row: 5 }, grond: { tall: 0.4, gap: 0, row: 7 }, gezichten: { tall: 0.8, gap: 0, row: 8 },
  poppetjes: { tall: 1.2, gap: 0, row: 8 },
};
const look = only ? {} : LOOK[groupName] ?? {};
const perRow = num('rij', look.row ?? Math.ceil(Math.sqrt(items.length * 1.6)));
const gap = num('ruimte', look.gap ?? 1), rowGap = num('rijruimte', Math.max(2, look.gap ?? 1));
// Op een rij zetten: van links naar rechts; na `perRow` begint een nieuwe rij.
const labels: { name: string; gx: number; gy: number }[] = [];
const lights: { gx: number; gy: number; r: number }[] = [];
let x0 = 22, y0 = 18, maxX = x0, maxY = y0, rowDeep = 0, cx = x0, cy = y0;
items.forEach((item, i) => {
  if (i && i % perRow === 0) {
    cx = x0;
    cy += rowDeep + rowGap;
    rowDeep = 0;
  }
  item.put(cx, cy);
  labels.push({ name: item.name, gx: cx + item.size + 0.1, gy: cy + deepOf(item) + 0.1 });
  lights.push({ gx: cx + item.size / 2, gy: cy + deepOf(item) / 2, r: Math.max(2.2, Math.max(item.size, deepOf(item)) * 0.6 + 1) });
  rowDeep = Math.max(rowDeep, deepOf(item));
  maxX = Math.max(maxX, cx + item.size);
  maxY = Math.max(maxY, cy + rowDeep);
  cx += item.size + gap;
});
view.paintTerrain(grid);
view.syncFences(grid, wear);
view.syncProps(props);
view.syncPonds(ponds);

// De camera: midden boven de modellen, en zo ver uitgezoomd dat alles past.
const wide = maxX - x0, deep = maxY - y0, tall = num('hoog', look.tall ?? 1.9);
// (iets omhoog: de modellen steken boven de grond uit)
view.target.set(toWorldX(x0 + wide / 2), tall * 0.3, toWorldZ(y0 + deep / 2));
// (schuin van boven is een tegel 0,71 breed en 0,41 hoog; daarbovenop komt de hoogte van de modellen)
view.zoom = num('zoom', Math.max(1.6, (wide + deep) * 0.41 + tall, ((wide + deep) * 0.71 + 1) * (innerHeight / innerWidth)));
if (forest) {
  view.target.set(toWorldX(4), 0.6, toWorldZ(24));
  view.zoom = num('zoom', 9);
}
view.resize();
view.setNight(night ? 1 : 0);

let clock = num('t', 1.3);
const frozen = query.has('t');
function frame(t: number): void {
  for (const move of live) move(t);
  view.update(0.016);
  view.drawNight(night ? 1 : 0, lights);
  view.render();
}
let last = performance.now();
function loop(now: number): void {
  if (!frozen) clock += Math.min(0.1, (now - last) / 1000);
  last = now;
  frame(clock);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

/** Het beeld van nu, met de namen erbij, als plaatje. */
function picture(): HTMLCanvasElement {
  frame(clock);
  const gl = view.renderer.domElement, out = document.createElement('canvas');
  out.width = gl.width;
  out.height = gl.height;
  const ctx = out.getContext('2d')!;
  ctx.drawImage(gl, 0, 0);
  const dark = document.getElementById('night') as HTMLCanvasElement | null;
  if (night && dark) ctx.drawImage(dark, 0, 0, out.width, out.height);
  ctx.font = '600 15px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.fillStyle = '#1d2b3a';
  for (const label of labels) {
    const p = view.toScreen(label.gx, label.gy);
    ctx.strokeText(label.name, p.x, p.y);
    ctx.fillText(label.name, p.x, p.y);
  }
  return out;
}

/**
 * Bewaart een foto via het hulpje `node tools/modellen/fotos.mjs` (dat moet dan draaien), bijvoorbeeld
 * `foto('voor/bedden')`. Geeft terug wat het hulpje antwoordt.
 */
async function foto(name: string): Promise<string> {
  const blob = await new Promise<Blob | null>(done => picture().toBlob(done, 'image/jpeg', 0.9));
  // zonder soort erbij: dan stuurt de browser het zonder eerst toestemming te vragen
  const res = await fetch(`http://127.0.0.1:5198/${name}.jpg`, { method: 'POST', body: new Blob([blob!]) });
  return res.text();
}
Object.assign(window, { foto, modellen: { view, groepen: Object.keys(GROUPS), items: items.map(i => i.name) } });

// ?reeks=voor: maakt van elke groep een foto (voor/bedden, voor/voer, ...) en gaat vanzelf naar de volgende.
const series = query.get('reeks');
if (series) {
  const names = Object.keys(GROUPS), at = names.indexOf(groupName);
  void foto(`${series}/${groupName}`).then(() => {
    if (at + 1 >= names.length) return void (document.title = 'klaar');
    const next = new URLSearchParams(location.search);
    next.set('groep', names[at + 1]);
    location.search = `?${next}`;
  });
}

// De knoppen bovenaan: van groep wisselen.
const bar = document.getElementById('balk')!;
for (const name of Object.keys(GROUPS)) {
  const a = document.createElement('a');
  const next = new URLSearchParams(location.search);
  next.set('groep', name);
  next.delete('alleen');
  a.href = `?${next}`;
  a.textContent = name;
  if (name === groupName) a.className = 'aan';
  bar.append(a);
}
