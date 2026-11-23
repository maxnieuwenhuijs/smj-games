// Alle spelinhoud als gegevens: soorten, voer, ondergrond, slaapplekken, winkels, prijzen en levels.
export type Terrain = 'grass' | 'mud' | 'sand' | 'water' | 'path' | 'snow' | 'forest' | 'stones' | 'ice' | 'swamp' | 'meadow' | 'steppe'
  // soorten pad: gasten lopen over allemaal; de brug leg je over water
  | 'gravel' | 'planks' | 'flowerpath' | 'bridge'
  // nog drie paden om later vrij te spelen: rode klinkers, grijze keien en wit marmer
  | 'brick' | 'cobble' | 'marble';
export type FoodId = 'veg' | 'hay' | 'fruit' | 'grain' | 'meat' | 'leaves' | 'fish' | 'bamboo';
export type BedKind = 'straw' | 'shed' | 'rock' | 'shade' | 'nest' | 'cave' | 'climb' | 'coral';
export type ShopKind = 'foodstall' | 'drinkstall' | 'bench' | 'toilet' | 'icecream' | 'balloon' | 'flowers' | 'bin' | 'souvenir' | 'playground' | 'hats' | 'fountain' | 'carousel'
  | 'slide' | 'swing' | 'seesaw' | 'springer' | 'trampoline'
  // uitkijktoren, restaurant, reuzenrad, botsauto's, schuilhut, treinhalte en een bak met paraplu's
  | 'tower' | 'restaurant' | 'ferris' | 'bumper' | 'shelter' | 'station' | 'umbrellas'
  // de tribune bij de dolfijnen: daar is af en toe een dierenshow
  | 'show'
  // een huisje van de kabelbaan: twee in een rechte lijn, met stoeltjes hoog boven de dieren
  | 'cablecar';
export type FenceOption = 'fence' | 'gate' | 'wall' | 'net' | 'glass' | 'window' | 'picket' | 'petgate';
/** Wat voor hek een dier nodig heeft: sterke dieren een stenen muur, klimmers en vliegers een hoog net. */
export type FenceNeed = 'wall' | 'net' | 'glass';
export type WorldId = 'farm' | 'savanna' | 'jungle' | 'ice' | 'far';
export type SpeciesId =
  | 'pig' | 'cow' | 'sheep' | 'horse' | 'donkey' | 'goat' | 'alpaca' | 'chicken' | 'duck' | 'rabbit'
  | 'zebra' | 'giraffe' | 'lion' | 'camel' | 'rhino' | 'hippo' | 'elephant' | 'ostrich' | 'cheetah' | 'gazelle'
  | 'monkey' | 'parrot' | 'tiger' | 'gorilla' | 'crocodile' | 'panda' | 'peacock' | 'toucan' | 'sloth' | 'panther'
  | 'penguin' | 'seal' | 'polarbear' | 'reindeer' | 'wolf' | 'arcticfox' | 'bear' | 'yak' | 'owl' | 'walrus'
  | 'flamingo' | 'turtle' | 'otter' | 'beaver' | 'pelican' | 'koala' | 'redpanda' | 'lemur' | 'bison' | 'kangaroo'
  // het aquarium: geen beloning van een level, maar erbij vanaf een bepaald level (zie BONUS)
  | 'dolphin' | 'orca' | 'ray' | 'shark';
export type Variant = 'male' | 'female' | 'young_m' | 'young_f';
export type WishId = 'health' | 'enclosure' | 'food' | 'bed' | 'terrain' | 'friend' | 'clean' | 'space' | 'fun' | 'climate' | 'wild'
  // niet bang hoeven zijn: geen roofdier in het eigen verblijf
  | 'safe';
/** Iets leuks in een verblijf: speelgoed of groen. Elk dier is er blij mee. */
export type ToyKind = 'ball' | 'bush' | 'log' | 'flowerbed' | 'hoop'
  // heuvel, rotsen, drinkvijver, waterval, warmtelamp, ijsblok, klimrek en tunnel
  | 'hill' | 'rocks' | 'drink' | 'fall' | 'lamp' | 'icebox' | 'frame' | 'tunnel'
  // speelgoed dat zelf beweegt: een losse autoband, een wipplank, een slingerbal, een kruipboog, een bandenschommel en een klimpaal
  | 'tyre' | 'rocker' | 'tetherball' | 'logarch' | 'tyreswing' | 'pole'
  // een waterfilter voor in een bak van glas: daarmee blijft het water langer schoon
  | 'filter';

/** De volgorde is ook de waarde in het opslagbestand: nieuwe soorten komen achteraan. */
export const TERRAINS: Terrain[] = ['grass', 'mud', 'sand', 'water', 'path', 'snow', 'forest', 'stones', 'ice', 'swamp', 'meadow', 'steppe', 'gravel', 'planks', 'flowerpath', 'bridge', 'brick', 'cobble', 'marble'];
export const TERRAIN_INFO: Record<Terrain, { colors: [number, number] }> = {
  grass: { colors: [0x86c95c, 0x7cc053] },
  mud: { colors: [0x9c6b44, 0x8f6039] },
  sand: { colors: [0xecd591, 0xe3ca82] },
  water: { colors: [0x6ec3e8, 0x62b7dd] },
  path: { colors: [0xd8c7ab, 0xcdbb9d] },
  snow: { colors: [0xf4f8fc, 0xe6eef6] },
  forest: { colors: [0x4f9a4a, 0x458d42] },
  // rotsgrond, ijs, moeras, bloemenwei (groen met roze: bloemen) en droog gras
  stones: { colors: [0x9aa0a8, 0x8d939b] },
  ice: { colors: [0xcfeaf7, 0xbfe0f1] },
  swamp: { colors: [0x5f7f4a, 0x4f6f55] },
  meadow: { colors: [0x8fd06a, 0xf2c9de] },
  steppe: { colors: [0xd6c46a, 0xc9b65b] },
  // paden: kiezels, houten planken, een pad met een bloemenrand, en een brug (het water eronder; de planken tekent het beeld)
  gravel: { colors: [0xc9c5bd, 0xb8b4ac] },
  planks: { colors: [0xc79a63, 0xb98a55] },
  flowerpath: { colors: [0xe6d3b3, 0xdcc7a2] },
  bridge: { colors: [0x6ec3e8, 0x62b7dd] },
  brick: { colors: [0xc9795a, 0xb9694b] },
  cobble: { colors: [0x9fa6ae, 0x8d949c] },
  marble: { colors: [0xf1f3f5, 0xdfe4e8] },
};
/** Alles waar gasten over lopen. `PATH_FROM`: na hoeveel gehaalde levels je het vrijspeelt. */
export const PATH_KINDS: Terrain[] = ['path', 'gravel', 'planks', 'flowerpath', 'bridge', 'brick', 'cobble', 'marble'];
export const PATH_FROM: Partial<Record<Terrain, number>> = { path: 3, gravel: 10, bridge: 13, planks: 17, brick: 21, flowerpath: 24, cobble: 30, marble: 37 };
const PATH_IDS = new Set(PATH_KINDS.map(k => TERRAINS.indexOf(k)));
/** Is dit (het nummer van) een soort pad? */
export const isPath = (terrain: number): boolean => PATH_IDS.has(terrain);
/** Grond die met de seizoenen meekleurt: wit in de winter, geel in de herfst. */
export const SEASONAL: Terrain[] = ['grass', 'forest', 'meadow', 'steppe'];

export const FOODS: FoodId[] = ['veg', 'hay', 'fruit', 'grain', 'meat', 'leaves', 'fish', 'bamboo'];
export const BEDS: BedKind[] = ['straw', 'shed', 'rock', 'shade', 'nest', 'cave', 'climb', 'coral'];
export const TOYS: ToyKind[] = ['ball', 'bush', 'log', 'flowerbed', 'hoop', 'tunnel', 'drink', 'hill', 'rocks', 'frame', 'fall', 'lamp', 'icebox',
  'tyre', 'rocker', 'tetherball', 'logarch', 'tyreswing', 'pole', 'filter'];
/** Na hoeveel gehaalde levels je iets voor in het verblijf vrijspeelt, en wat het kost (anders PRICE.toy). */
export const TOY_FROM: Record<ToyKind, number> = {
  ball: 9, bush: 9, log: 9, flowerbed: 9, tunnel: 11, drink: 12, hill: 14, rocks: 17, hoop: 20, frame: 22, fall: 27, lamp: 25, icebox: 30,
  // het bewegende speelgoed komt er één voor één bij, steeds in een level waarin er geen ander speelgoed vrijkomt
  tyre: 13, rocker: 16, tetherball: 19, logarch: 23, tyreswing: 28, pole: 32,
  // het waterfilter komt tegelijk met het aquarium (BONUS.dolphin)
  filter: 20,
};
export const TOY_PRICE: Partial<Record<ToyKind, number>> = {
  hill: 4, rocks: 3, drink: 3, fall: 8, lamp: 5, icebox: 5, frame: 6, tunnel: 4,
  tyre: 3, rocker: 4, tetherball: 4, logarch: 5, tyreswing: 6, pole: 6, filter: 6,
};
/** Hier klimt een dier bovenop: zo hoog staat het dan (in tegels). */
export const TOY_LIFT: Partial<Record<ToyKind, number>> = { hill: 0.34, rocks: 0.3, frame: 0.8, rocker: 0.21, pole: 1 };
/**
 * Speelgoed dat zelf beweegt. Het dier (animal.ts) en het ding (game.ts) rekenen met dezelfde getallen en dezelfde
 * tel `u` (seconden sinds het spelen begon): zo gaan ze precies gelijk op.
 * `TOY_PIVOT`: het punt waar het losse onderdeel om draait (x, hoogte, z), gemeten in het ding zelf.
 */
export const TOY_PIVOT: Partial<Record<ToyKind, [number, number, number]>> = {
  tyreswing: [0, 1.25, 0], tetherball: [0, 0.97, 0], rocker: [0, 0.16, 0], logarch: [0, 0.88, 0], pole: [0.25, 0.95, 0.1],
};
/** De bandenschommel: `hop` seconden om erop te springen, dan `swings` keer heen en weer. `seat`: zo hoog zit het dier. */
export const SWING = { hop: 0.5, period: 1.8, swings: 4, angle: 0.32, seat: 0.4 };
export const SWING_SECONDS = SWING.hop + SWING.period * SWING.swings;
/** Hoe ver de schommel op tel `u` uitslaat (in radialen): rustig op gang, en aan het eind hangt hij weer stil. */
export function swingAt(u: number): number {
  const v = u - SWING.hop, left = SWING_SECONDS - u;
  if (v <= 0 || left <= 0) return 0;
  return SWING.angle * Math.min(1, v / 1.5, left / 1.5) * Math.sin((v / SWING.period) * Math.PI * 2);
}
/** De wipplank: `rocks` keer heen en weer. */
export const ROCK = { period: 1.4, rocks: 4, angle: 0.24 };
export const ROCK_SECONDS = ROCK.period * ROCK.rocks;
/** Hoe schuin de wipplank op tel `u` ligt (in radialen); hij blijft steeds even op de grond liggen voor hij terugwipt. */
export function rockAt(u: number): number {
  const left = ROCK_SECONDS - u;
  if (u <= 0 || left <= 0) return 0;
  const s = Math.max(-1, Math.min(1, Math.sin((u / ROCK.period) * Math.PI * 2) * 1.5));
  return ROCK.angle * Math.min(1, u / 0.8, left / 0.8) * s;
}
/** Een paar stootjes met de neus achter elkaar: het eerste na `first` seconden, daarna om de `every` seconden. */
export interface Beat { first: number; every: number; hits: number }
/** De slingerbal: na elk stootje draait hij `turns` keer om de paal en zwaait hij hooguit `tilt` (radialen) naar buiten. */
export const TETHER = { first: 0.5, every: 2, hits: 3, turns: 2, tilt: 0.5 };
/** Een dier dat te groot is voor de bandenschommel geeft hem duwtjes: steeds als de band weer terug is. */
export const PUSH = { first: 0.5, every: SWING.period, hits: 3, angle: 0.4 };
/** Hoeveel seconden geleden het laatste stootje was (of -1: er is er nog geen geweest). */
export function sinceHit(u: number, beat: Beat): number {
  if (u < beat.first) return -1;
  return u - beat.first - Math.min(beat.hits - 1, Math.floor((u - beat.first) / beat.every)) * beat.every;
}
/** Iets wat hangt en een zetje krijgt: het zwaait uit (tussen -1 en 1) en komt langzaam tot rust. `v`: seconden sinds het zetje. */
export const sway = (v: number, speed: number, fade: number): number => (v <= 0 ? 0 : Math.sin(v * speed) * Math.exp(-v * fade));
/** De slingerbal, `v` seconden na een stootje: hoe ver hij rond de paal is (radialen) en hoe ver hij naar buiten zwaait (0 tot 1). */
export function tetherAt(v: number): [number, number] {
  if (v <= 0) return [0, 0];
  const x = Math.min(1, v / TETHER.every), slow = 1 - x;
  return [TETHER.turns * Math.PI * 2 * (1 - slow ** 1.6), Math.min(1, x * 10) * slow ** 0.8];
}
/** De klimpaal: zo lang doet een dier erover om boven te komen. De kruipboog: zo lang om eronderdoor te lopen, en zo hoog is het eronder. */
export const CLIMB_SECONDS = 1.8;
export const UNDER = { seconds: 2.6, touch: 0.9, clear: 0.8 };
/** Hier drinkt een dier uit. */
export const TOY_DRINK: ToyKind[] = ['drink', 'fall'];
/**
 * Warmte en kou: een krokodil wil een warmtelamp in zijn verblijf, een pinguïn een blok ijs (vanaf FEATURE.climate).
 * Net als bij speelgoed wordt een dier er nooit voor opgehaald.
 */
export const CLIMATE: Partial<Record<SpeciesId, 'lamp' | 'icebox'>> = {
  crocodile: 'lamp', turtle: 'lamp', lemur: 'lamp', penguin: 'icebox', polarbear: 'icebox', walrus: 'icebox', arcticfox: 'icebox',
};
/**
 * Vriendjes: deze soorten kunnen goed samen in één verblijf. Een vriendje van de andere soort telt mee als
 * gezelschap, ze kroelen met elkaar en gasten vinden zo'n gemengd verblijf extra leuk.
 */
export const PALS: [SpeciesId, SpeciesId][] = [
  ['zebra', 'giraffe'], ['ostrich', 'gazelle'], ['cow', 'sheep'], ['horse', 'donkey'], ['goat', 'alpaca'], ['chicken', 'duck'],
  ['reindeer', 'yak'], ['flamingo', 'pelican'], ['otter', 'beaver'], ['dolphin', 'ray'],
];
export const palsOf = (sp: SpeciesId): SpeciesId[] => PALS.filter(p => p.includes(sp)).map(p => (p[0] === sp ? p[1] : p[0]));
/**
 * Bang voor elkaar (vanaf FEATURE.safe): een roofdier en de dieren die bang voor hem zijn, wonen niet samen. Er
 * gebeurt nooit iets engs: het roofdier doet niets, maar de andere dieren zijn bang. Ze kruipen weg in een hoekje,
 * trillen en rennen weg als hij dichtbij komt. De oplossing: elk een eigen verblijf. Een zeedier is alleen bang
 * voor een zeedier.
 */
const LITTLE: SpeciesId[] = ['chicken', 'duck', 'rabbit'];
const FARM: SpeciesId[] = ['pig', 'cow', 'sheep', 'horse', 'donkey', 'goat', 'alpaca'];
const PLAINS: SpeciesId[] = ['zebra', 'gazelle', 'giraffe', 'ostrich', 'camel', 'kangaroo', 'reindeer', 'flamingo', 'peacock'];
const BIG_CAT: SpeciesId[] = [...LITTLE, ...FARM, ...PLAINS];
export const PREY_OF: Partial<Record<SpeciesId, SpeciesId[]>> = {
  lion: BIG_CAT, tiger: BIG_CAT, cheetah: BIG_CAT, panther: BIG_CAT,
  wolf: [...LITTLE, ...FARM, 'reindeer', 'gazelle'],
  bear: [...LITTLE, 'sheep', 'goat', 'pig', 'reindeer'],
  polarbear: [...LITTLE, 'seal', 'penguin', 'reindeer'],
  arcticfox: [...LITTLE, 'penguin'],
  crocodile: [...LITTLE, 'zebra', 'gazelle', 'flamingo', 'pelican', 'sheep', 'goat', 'pig'],
  orca: ['dolphin', 'ray'],
  shark: ['ray'],
};
/** Is `prey` bang voor `hunter` als ze in hetzelfde verblijf wonen? */
export const scares = (hunter: SpeciesId, prey: SpeciesId): boolean => !!PREY_OF[hunter]?.includes(prey);
/** Voor wie dit dier bang is. */
export const huntersOf = (prey: SpeciesId): SpeciesId[] => (Object.keys(PREY_OF) as SpeciesId[]).filter(h => scares(h, prey));
/**
 * De kinderboerderij: een verblijf met het witte hekje (rand 7) en een poortje voor de gasten (rand 8), minstens
 * PETTING_MIN tegels groot. Daar mogen alle boerderijdieren door elkaar in: elk dier heeft genoeg aan een paar
 * tegels van zijn eigen grond, elke slaapplek en elk voer is goed en ieder ander dier is een vriendje. Gasten
 * lopen door het poortje naar binnen om de dieren te aaien.
 */
export const PETTING_MIN = 12;
/** Zoveel gasten mogen er tegelijk in één kinderboerderij. */
export const PETTING_GUESTS = 4;
export const PETTABLE: SpeciesId[] = ['pig', 'cow', 'sheep', 'horse', 'donkey', 'goat', 'alpaca', 'chicken', 'duck', 'rabbit'];
/** Het karakter van een dier: je ziet het aan hoe het loopt en wat het doet. */
export type Nature = 'plain' | 'shy' | 'playful' | 'sleepy' | 'brave';
export const NATURES: Nature[] = ['plain', 'shy', 'playful', 'sleepy', 'brave'];
/**
 * Een bijzonder jong: heel af en toe wordt er een wit, goudkleurig of donker jong geboren. Nog zeldzamer is een jong
 * met een glimmende vacht, en het allerzeldzaamst een jong in een gekke felle kleur (een roze olifant!).
 */
export type Rare = 'white' | 'gold' | 'dark' | 'shiny' | 'pink' | 'yellow' | 'green' | 'blue';
export const RARES: Rare[] = ['white', 'gold', 'dark', 'shiny', 'pink', 'yellow', 'green', 'blue'];
/** Zo vaak is een jong bijzonder: ongeveer een op de twintig. */
export const RARE_CHANCE = 0.05;
/**
 * Welke bijzondere kleur het wordt: zes van de tien keer wit, goud of donker, twee van de tien keer glimmend, en twee
 * van de tien keer een gekke kleur. Een roze jong is dus ongeveer een op de vierhonderd geboortes.
 */
export function pickRare(roll = Math.random()): Rare {
  if (roll < 0.6) return (['white', 'gold', 'dark'] as const)[Math.floor(roll / 0.2)];
  if (roll < 0.8) return 'shiny';
  return (['pink', 'yellow', 'green', 'blue'] as const)[Math.min(3, Math.floor((roll - 0.8) / 0.05))];
}
/** Dieren die graag in een regenplas rollen. */
export const MUD_LOVERS: SpeciesId[] = ['pig', 'hippo', 'rhino', 'elephant', 'bison'];
/**
 * Grote dieren hebben ruimte nodig: het verblijf moet minstens zoveel tegels groot zijn. Wie hier niet staat,
 * past in elk verblijf.
 */
export const SPACE: Partial<Record<SpeciesId, number>> = {
  orca: 12, shark: 10, dolphin: 9, ray: 6,
  elephant: 9, giraffe: 9, rhino: 9, hippo: 9, polarbear: 9, bison: 9, walrus: 9,
  lion: 8, tiger: 8, bear: 8, gorilla: 8, camel: 8, panther: 8, cheetah: 8, wolf: 8, kangaroo: 8,
  horse: 6, cow: 6, zebra: 6, donkey: 6, reindeer: 6, yak: 6, crocodile: 6, seal: 6, panda: 6, ostrich: 6,
};
/**
 * Groepsdieren willen met meer bij elkaar zijn: zoveel van dezelfde soort in één verblijf (jongen tellen mee).
 * Alle andere dieren zijn tevreden met één vriendje, dus met z'n tweeën.
 */
export const HERD: Partial<Record<SpeciesId, number>> = {
  chicken: 5, penguin: 5, flamingo: 5,
  dolphin: 3, ray: 3,
  duck: 4, rabbit: 4, gazelle: 4, monkey: 4, lemur: 4,
  sheep: 3, goat: 3, alpaca: 3, zebra: 3, ostrich: 3, parrot: 3, toucan: 3, reindeer: 3, wolf: 3, otter: 3, pelican: 3, bison: 3,
};
export const herdOf = (sp: SpeciesId): number => HERD[sp] ?? 2;

/**
 * Dingen voor in het park (de knop Park): ze staan op een tegel buiten de verblijven en maken gasten in de
 * buurt blijer. `from`: na hoeveel gehaalde levels je het vrijspeelt; bijna elk level komt er iets bij.
 */
export type DecorKind =
  | 'tree' | 'roses' | 'hedge' | 'tulips' | 'pine' | 'mushrooms' | 'cactus' | 'sunflowers' | 'palm' | 'pumpkins' | 'bamboogrove' | 'cherry'
  | 'pond' | 'well' | 'birdbath' | 'waterfall' | 'pump'
  | 'boulder' | 'signpost' | 'flag' | 'lantern' | 'picnic' | 'scarecrow' | 'topiary' | 'arch' | 'totem' | 'snowman' | 'campfire' | 'windmill' | 'statue' | 'clocktower'
  // een gastenboek, een plattegrond, en palen waar vanzelf vlaggetjes of lichtjes tussen komen te hangen
  | 'guestbook' | 'mapboard' | 'bunting' | 'lightstring'
  // meer licht voor de nacht: een tuinlampje, een lampion, een fakkel en een hoge straatlamp met twee lampen
  | 'gardenlight' | 'lampion' | 'torch' | 'streetlamp';
/**
 * Sier is alleen om naar te kijken. Borden wijzen de weg (de wegwijzer en de plattegrond). Handig is waar gasten
 * iets mee doen: de picknicktafel en het gastenboek staan bij het bankje en de wc.
 */
export type DecorGroup = 'green' | 'water' | 'art' | 'light' | 'signs' | 'service';
export const DECOR_GROUPS: DecorGroup[] = ['green', 'water', 'art', 'light', 'signs', 'service'];
export const DECOR: Record<DecorKind, { group: DecorGroup; price: number; from: number }> = {
  tree: { group: 'green', price: 4, from: 5 }, roses: { group: 'green', price: 3, from: 5 }, hedge: { group: 'green', price: 3, from: 6 },
  tulips: { group: 'green', price: 3, from: 7 }, pine: { group: 'green', price: 4, from: 8 }, mushrooms: { group: 'green', price: 2, from: 9 },
  cactus: { group: 'green', price: 4, from: 12 }, sunflowers: { group: 'green', price: 3, from: 13 }, palm: { group: 'green', price: 6, from: 17 },
  pumpkins: { group: 'green', price: 3, from: 19 }, bamboogrove: { group: 'green', price: 5, from: 21 }, cherry: { group: 'green', price: 8, from: 27 },
  pond: { group: 'water', price: 10, from: 10 }, well: { group: 'water', price: 8, from: 16 }, birdbath: { group: 'water', price: 6, from: 22 },
  waterfall: { group: 'water', price: 15, from: 26 }, pump: { group: 'water', price: 8, from: 34 },
  boulder: { group: 'art', price: 2, from: 5 }, signpost: { group: 'signs', price: 4, from: 7 }, flag: { group: 'art', price: 5, from: 11 },
  lantern: { group: 'light', price: 5, from: 14 }, picnic: { group: 'service', price: 8, from: 15 }, scarecrow: { group: 'art', price: 6, from: 18 },
  topiary: { group: 'art', price: 12, from: 23 }, arch: { group: 'art', price: 10, from: 24 }, totem: { group: 'art', price: 10, from: 29 },
  snowman: { group: 'art', price: 6, from: 31 }, campfire: { group: 'light', price: 8, from: 33 }, windmill: { group: 'art', price: 18, from: 36 },
  statue: { group: 'art', price: 20, from: 38 }, clocktower: { group: 'art', price: 25, from: 41 },
  guestbook: { group: 'service', price: 6, from: 9 }, mapboard: { group: 'signs', price: 8, from: 12 }, bunting: { group: 'art', price: 4, from: 13 }, lightstring: { group: 'light', price: 6, from: 15 },
  gardenlight: { group: 'light', price: 3, from: 16 }, lampion: { group: 'light', price: 5, from: 18 }, torch: { group: 'light', price: 4, from: 20 }, streetlamp: { group: 'light', price: 9, from: 26 },
};
/**
 * Kleine versieringen: die zet je niet midden op een tegel maar in een van de vier kwarten, net als de natuur. Zo
 * passen er meer op een tegel en kun je ze preciezer neerzetten (naast een bankje, in een hoekje).
 */
export const SMALL_DECOR: DecorKind[] = ['mushrooms', 'cactus', 'pumpkins', 'birdbath', 'pump', 'boulder', 'guestbook', 'scarecrow', 'topiary', 'totem', 'snowman', 'campfire', 'statue',
  'gardenlight', 'lampion', 'torch', 'streetlamp'];
/**
 * De groepen onder de knop Park, van links naar rechts. In een groep staan versieringen, klein spul en gebouwtjes
 * door elkaar: de bloembak staat bij Groen, wc en bankje bij Handig.
 */
export const PARK_GROUPS = ['green', 'water', 'art', 'light', 'small', 'signs', 'service'] as const;
export type ParkGroup = (typeof PARK_GROUPS)[number];
export const SERVICE_SHOPS: ShopKind[] = ['toilet', 'bench', 'bin', 'umbrellas', 'shelter'];
/** In welke groep onder Park dit gebouwtje staat; niets als het onder de knop Winkel hoort. */
export const parkShopGroup = (kind: ShopKind): ParkGroup | null =>
  kind === 'flowers' ? 'green' : SERVICE_SHOPS.includes(kind) ? 'service' : null;
/** Onder de knop Attracties staan de speeltoestellen (groep Speeltuin) en de grote attracties. */
export const ATTRACTIONS: ShopKind[] = ['fountain', 'tower', 'show', 'carousel', 'station', 'bumper', 'ferris', 'cablecar'];
/** Palen waar een slinger tussen komt: staan er twee in één lijn, hooguit zoveel tegels uit elkaar, dan hangt er vanzelf een slinger. */
export const STRING_REACH = 5;
export const STRING_HEIGHT = 1.25;
export const DECORS = Object.keys(DECOR) as DecorKind[];
/**
 * Palen, borden en alles wat langwerpig is (heg, rozen, tulpen, zonnebloemen, de bloemenboog) zet je op de rand
 * van een tegel, net als een hek of een bankje: ze nemen geen tegel in en liggen langs die rand.
 */
export const EDGE_DECOR: DecorKind[] = ['lantern', 'lightstring', 'flag', 'bunting', 'signpost', 'mapboard', 'hedge', 'roses', 'tulips', 'sunflowers', 'arch'];
/**
 * De meeste dieren hebben een eigen lievelingsding: daar spelen ze mee, en zonder vervelen ze zich (vanaf level 10).
 * Kippen, eenden en een paar andere rustige dieren hebben niets nodig.
 */
export const TOY_OF: Partial<Record<SpeciesId, ToyKind>> = {
  pig: 'ball', cow: 'bush', sheep: 'bush', horse: 'ball', donkey: 'log', goat: 'log', alpaca: 'bush', 
  zebra: 'bush', giraffe: 'bush', lion: 'ball', camel: 'bush', rhino: 'log', hippo: 'ball', elephant: 'log', cheetah: 'ball', gazelle: 'flowerbed',
  monkey: 'ball', parrot: 'flowerbed', tiger: 'ball', gorilla: 'log', panda: 'bush', toucan: 'bush', sloth: 'log', panther: 'log',
  dolphin: 'hoop', orca: 'ball', shark: 'ball',
  penguin: 'ball', seal: 'ball', polarbear: 'log', reindeer: 'bush', wolf: 'ball', arcticfox: 'flowerbed', bear: 'log', yak: 'bush', owl: 'log', walrus: 'ball',
  otter: 'ball', beaver: 'log', koala: 'bush', redpanda: 'log', lemur: 'bush', bison: 'log', kangaroo: 'ball',
};
/**
 * Het bewegende speelgoed is voor deze dieren net zo leuk als hun lievelingsding: staat het in hun verblijf, dan
 * vervelen ze zich niet, en ze spelen er het liefst mee.
 */
export const TOY_ALSO: Partial<Record<ToyKind, SpeciesId[]>> = {
  tyre: ['pig', 'horse', 'rhino', 'hippo', 'elephant', 'bison', 'bear', 'polarbear', 'wolf', 'walrus'],
  rocker: ['goat', 'sheep', 'alpaca', 'donkey', 'penguin', 'seal', 'reindeer', 'yak', 'otter'],
  tetherball: ['lion', 'tiger', 'cheetah', 'panther', 'kangaroo', 'cow', 'zebra', 'camel', 'giraffe', 'arcticfox'],
  logarch: ['gazelle', 'pig', 'wolf', 'arcticfox', 'beaver', 'otter', 'panda', 'cheetah'],
  tyreswing: ['monkey', 'gorilla', 'panda', 'lemur', 'koala', 'redpanda', 'sloth', 'parrot', 'toucan'],
  pole: ['monkey', 'lemur', 'redpanda', 'koala', 'sloth', 'panther', 'goat', 'owl', 'parrot', 'toucan', 'bear'],
};
/** Is dit het lievelingsding van deze soort, of iets wat hij net zo leuk vindt? */
export const likesToy = (sp: SpeciesId, kind: string): boolean => TOY_OF[sp] === kind || !!TOY_ALSO[kind as ToyKind]?.includes(sp);
/**
 * Wat je kunt bouwen. De speeltuin als één gebouw staat er niet meer bij: je bouwt losse toestellen (eerst de
 * glijbaan, later de schommel, de wipwap, de wipkip en de trampoline). 'playground' bestaat nog als naam voor
 * 'iets om te spelen' (de wens van een gast) en voor oude parken, waar hij bij het laden een glijbaan wordt.
 */
export const SHOPS: ShopKind[] = ['foodstall', 'drinkstall', 'toilet', 'bench', 'slide', 'swing', 'seesaw', 'springer', 'trampoline', 'icecream', 'flowers', 'bin', 'umbrellas', 'shelter', 'balloon', 'hats', 'souvenir', 'restaurant', 'fountain', 'tower', 'carousel', 'station', 'bumper', 'ferris', 'show', 'cablecar'];
/** Waar een gast naar kijkt (zin in iets moois) en waar hij in rijdt (zin in een ritje). De kabelbaan is allebei. */
export const LOOKS: ShopKind[] = ['fountain', 'tower', 'cablecar'];
export const RIDES: ShopKind[] = ['carousel', 'ferris', 'bumper', 'station', 'cablecar'];
/** Maten van de grote attracties; het beeld en de gasten gebruiken dezelfde getallen. Alles ten opzichte van het midden van het gebouw. */
export const FERRIS = { hub: 2.25, radius: 1.5, cabins: 6, speed: 0.45 };
export const TOWER_TOP = 1.75;
/** De tafels van het restaurant (x, z) met aan weerszijden (x - 0,27 en x + 0,27) een kruk. */
export const RESTAURANT_TABLES: [number, number][] = [[-0.45, 0.5], [0.5, 0.5], [0.5, -0.4]];
export const BUMPER_CARS = 3;
/** Waar botsauto `i` op tijdstip `t` rijdt: [x, z, richting]. De vloer is 1,84 breed; de auto's blijven binnen de rand. */
export function bumperCar(i: number, t: number): [number, number, number] {
  const a = t * (0.9 + i * 0.17) + i * 2.1, b = t * (0.7 + i * 0.13) + i * 1.3;
  const x = Math.sin(a) * 0.55 + Math.sin(b * 1.7) * 0.1, z = Math.cos(b) * 0.55 + Math.cos(a * 1.3) * 0.1;
  const dx = Math.cos(a) * 0.55 * (0.9 + i * 0.17), dz = -Math.sin(b) * 0.55 * (0.7 + i * 0.13);
  return [x, z, Math.atan2(dx, dz)];
}
/** Het treintje: een locomotief met zoveel wagons, elk met zoveel plekken; `gap` is de afstand tussen twee wagens, `speed` in tegels per tel. */
export const TRAIN = { wagons: 2, seats: 3, gap: 0.95, speed: 1.5, stop: 5 };
/** Kramen waar een gast iets koopt voor één munt. */
export const STALLS: ShopKind[] = ['foodstall', 'drinkstall', 'icecream', 'balloon', 'hats', 'souvenir'];
/** Alles waar kinderen op spelen: de speeltuin en de losse toestellen. Een kind dat wil spelen kiest er zelf een. */
export const PLAY: ShopKind[] = ['playground', 'slide', 'swing', 'seesaw', 'springer', 'trampoline'];
/**
 * Hoeveel gasten één kraam, wc, speeltuin of bankje aankan. Zijn er meer gasten in het park, dan is het er
 * te druk en moet er een bij: zo groeit het park mee met het aantal gasten.
 */
export const SERVES: Partial<Record<ShopKind, number>> = { foodstall: 10, drinkstall: 10, toilet: 8, icecream: 12, playground: 14, bench: 6 };
/**
 * Zoveel gasten kunnen er hooguit tegelijk in het park zijn: het groeit mee met het level, tot 60. Op een
 * apparaat dat het niet bijhoudt (het spel merkt dat zelf) blijft het bij 45 of 30.
 */
export const MAX_GUESTS = 160;
export const guestsAt = (level: number, quality = 2): number => Math.min([45, 90, MAX_GUESTS][quality] ?? MAX_GUESTS, 14 + level * 3);
/**
 * Boven de twintig gasten telt elke gast maar voor een derde mee bij honger, dorst en drukte bij de kramen. Er
 * lopen nu drie keer zoveel gasten rond als vroeger; zo heb je toch ongeveer evenveel kramen nodig als toen
 * (bij 160 gasten tellen er 68 mee) en loopt de kas niet over.
 */
export const CROWD_EASE = 20;
export const crowdLoad = (guests: number): number => (guests <= CROWD_EASE ? guests : CROWD_EASE + (guests - CROWD_EASE) * 0.34);

/**
 * Tien kleuren per soort hek (1 = hout, 3 = steen, 4 = net). De eerste is de gewone kleur. Je kiest de kleur
 * door op een verblijf te tikken.
 */
export const FENCE_COLORS: Record<1 | 3 | 4 | 5 | 7, number[]> = {
  1: [0xc58a4b, 0xf3ead6, 0xe0584f, 0x4a90e2, 0x6cc04a, 0xffd23f, 0xf48fb1, 0xa06ad9, 0xf08a24, 0x6b4a2a],
  3: [0xa9adb3, 0xe8dcc0, 0xc9553f, 0xf7f4ec, 0x5a6470, 0x8fae7a, 0x8fb4d9, 0xe6a9b8, 0xe5c66a, 0x8a6a4a],
  4: [0x3f7f6b, 0x2b2f36, 0xf3f3f3, 0x4a90e2, 0xe0584f, 0xffd23f, 0xf08a24, 0xa06ad9, 0xf48fb1, 0xb9c2c9],
  // glas: de kleur van de lijst om de ruit
  5: [0xd9e6ee, 0x2b2f36, 0xf7f4ec, 0x4a90e2, 0xe0584f, 0xffd23f, 0xf08a24, 0xa06ad9, 0xf48fb1, 0x3f7f6b],
  // het witte hekje van de kinderboerderij (en het poortje voor de gasten)
  7: [0xf7f4ec, 0xffd23f, 0xe0584f, 0x4a90e2, 0x6cc04a, 0xf48fb1, 0xa06ad9, 0xf08a24, 0x9fd8f5, 0xc58a4b],
};

/** Hoeveel tegels breed en diep een winkel is: gebouwen 2 bij 2, losse dingen 1 bij 1. */
export const SHOP_SIZE: Record<ShopKind, number> = {
  foodstall: 2, drinkstall: 2, toilet: 2, playground: 2, slide: 2, swing: 2, seesaw: 2, springer: 2, trampoline: 2, icecream: 2, balloon: 2, hats: 2, souvenir: 2, bench: 1, flowers: 1, bin: 1, fountain: 2, carousel: 2,
  tower: 2, restaurant: 2, ferris: 2, bumper: 2, shelter: 2, station: 2, umbrellas: 1, show: 2, cablecar: 2,
};
/**
 * Een marktkraam is twee tegels breed maar maar één tegel diep: zijn lange kant is de voorkant. Alle andere
 * gebouwen zijn vierkant.
 */
export const SHOP_DEEP: Partial<Record<ShopKind, number>> = { foodstall: 1, drinkstall: 1, icecream: 1, balloon: 1, hats: 1, souvenir: 1 };
/**
 * Hoeveel tegels een gebouw beslaat, [van west naar oost, van noord naar zuid], als het zo gedraaid staat
 * (0 = voorkant naar het zuiden, 1 = oosten, 2 = noorden, 3 = westen).
 */
export const shopSpan = (kind: ShopKind, rot = 0): [number, number] => {
  const wide = SHOP_SIZE[kind], deep = SHOP_DEEP[kind] ?? wide;
  return rot % 2 ? [deep, wide] : [wide, deep];
};

// ------------------------------------------------------------ wat een kraam verkoopt
/** Eén ding dat een kraam kan verkopen. `from`: vanaf hoeveel gehaalde levels gasten erom vragen. */
export interface Product {
  id: string;
  shop: ShopKind;
  from: number;
  /** Kleur van een ballon of hoedje, zoals de gast hem daarna draagt. */
  color?: number;
}
export const PRODUCTS: Product[] = [
  { id: 'fries', shop: 'foodstall', from: 4 },
  { id: 'pancake', shop: 'foodstall', from: 16 },
  { id: 'hotdog', shop: 'foodstall', from: 28 },
  { id: 'lemonade', shop: 'drinkstall', from: 5 },
  { id: 'milk', shop: 'drinkstall', from: 18 },
  { id: 'juice', shop: 'drinkstall', from: 32 },
  { id: 'scoop', shop: 'icecream', from: 11 },
  { id: 'lolly', shop: 'icecream', from: 19 },
  { id: 'balloon_red', shop: 'balloon', from: 21, color: 0xe0584f },
  { id: 'balloon_blue', shop: 'balloon', from: 21, color: 0x4a90e2 },
  { id: 'balloon_yellow', shop: 'balloon', from: 24, color: 0xffd23f },
  { id: 'balloon_heart', shop: 'balloon', from: 34, color: 0xf06aa6 },
  { id: 'cap_red', shop: 'hats', from: 22, color: 0xe0584f },
  { id: 'cap_blue', shop: 'hats', from: 22, color: 0x4a90e2 },
  { id: 'hat_straw', shop: 'hats', from: 26, color: 0xe9d05a },
  { id: 'hat_party', shop: 'hats', from: 31, color: 0xf06aa6 },
  { id: 'hat_crown', shop: 'hats', from: 40, color: 0xffd23f },
];
/** Een kraam verkoopt hooguit zoveel dingen tegelijk; wil je meer, dan zet je er een kraam bij. */
export const SHOP_SLOTS: Partial<Record<ShopKind, number>> = { souvenir: 4, hats: 3, balloon: 3 };
export const slotsOf = (kind: ShopKind): number => SHOP_SLOTS[kind] ?? 2;
/** Knuffels zijn er van elke diersoort: 'plush_pig', 'plush_lion', ... */
export const PLUSH = 'plush_';
/** Wat gasten bij dit soort kraam kunnen vragen als je `done` levels hebt gehaald (knuffels: zie het spel). */
export function productsFor(kind: ShopKind, done: number): string[] {
  return PRODUCTS.filter(p => p.shop === kind && p.from <= done).map(p => p.id);
}
export const WORLDS: WorldId[] = ['farm', 'savanna', 'jungle', 'ice', 'far'];

// ------------------------------------------------------------ munten
/** Er passen nooit meer munten in de kas dan dit: twee cijfers, net genoeg voor twee van de duurste dieren. */
export const COIN_CAP = 99;
/** Dag en nacht (vanaf FEATURE.night): zo lang duren ze, in tellen. De schemering duurt DUSK_SECONDS. */
export const DAY_SECONDS = 600;
/**
 * De nacht in drie stukken, elk [van uur, tot uur, tellen]: de avond (21 tot 24 uur: donker, het park is nog open),
 * de slaapnacht (0 tot 5 uur: het park is dicht, alles slaapt en er is niemand meer; die duurt anderhalve minuut,
 * zodat je het lege park echt ziet) en de vroege ochtend (5 tot 7 uur: het personeel komt weer binnen, de gasten
 * komen om 7 uur).
 */
export const NIGHT_PARTS: [number, number, number][] = [[21, 24, 90], [0, 5, 90], [5, 7, 40]];
/**
 * Wie wanneer naar huis gaat, als uur op de klok: de gasten vanaf GUESTS_HOME, het personeel en de verkopers vanaf
 * STAFF_HOME (half twaalf: de meeste gasten zijn dan al weg). Het personeel komt om STAFF_BACK weer binnen, de verkopers om VENDORS_BACK.
 */
export const GUESTS_HOME = 22, STAFF_HOME = 23.5, STAFF_BACK = 5, VENDORS_BACK = 6.5;
export const NIGHT_SECONDS = NIGHT_PARTS.reduce((n, p) => n + p[2], 0);
/** Het uur van de dag (7 = zeven uur 's ochtends, 21,5 = half tien 's avonds) op dit moment in de kring van dag en nacht. */
export function hourAt(phase: number): number {
  if (phase < DAY_SECONDS) return 7 + (phase / DAY_SECONDS) * 14;
  let left = phase - DAY_SECONDS;
  for (const [from, to, seconds] of NIGHT_PARTS) {
    if (left < seconds) return from + (left / seconds) * (to - from);
    left -= seconds;
  }
  return 7;
}
export const DUSK_SECONDS = 20;
/** Hoe ver het licht reikt, in tegels: een lantaarn, een kampvuur, een winkel of speeltoestel, en de ingang. */
export const LIGHT = { lantern: 3.5, campfire: 3, shop: 2.4, entrance: 4.5, lightstring: 2.4, gardenlight: 1.8, lampion: 3, torch: 2.6, streetlamp: 5 };
/** In het donker ziet een gast bijna niets: zoveel van het plezier blijft er over. */
export const DARK_FUN = 0.25;
/**
 * De weg wijzen: een wegwijzer, een plattegrond en de poort laten gasten zien waar ze zijn, tot zoveel tegels ver
 * (hemelsbreed). Buiten het bereik van elk bord raakt een gast in een groot park weleens de weg kwijt.
 */
export const WAYFIND = { signpost: 7, mapboard: 11, entrance: 9 };
/**
 * Zo ver kijkt een gast om zich heen als hij iets zoekt (een wc, eten, een bankje) en er geen wegwijzer of plattegrond
 * in de buurt staat. Staat hij binnen het bereik van een bord, dan weet hij de weg door het hele park.
 */
export const SEEK_REACH = 14;
/** Pas bij meer padtegels dan dit is een park groot genoeg om in te verdwalen. */
export const WAYFIND_PATHS = 40;
export interface WaySign {
  gx: number;
  gy: number;
  r: number;
}
/** Staat dit punt binnen het bereik van een van deze borden? */
export const wayfound = (signs: WaySign[], gx: number, gy: number): boolean => signs.some(s => Math.hypot(s.gx - gx, s.gy - gy) <= s.r);
/** Kunnen gasten in dit park de weg kwijtraken? Pas als de wegwijzer te koop is en het park groot genoeg is. */
export const canStray = (level: number, paths: number): boolean => level >= DECOR.signpost.from && paths > WAYFIND_PATHS;
/** Een strook grond erbij (links, rechts of achter) is duur: daar spaar je lang voor. */
export const LAND_PRICE = 75;
export const START_COINS = 10;
export const LEVEL_BONUS = 5;
export const PRICE = { trough: 1, bed: 1, toy: 2 };
/**
 * Drie soorten voerbakken: hoe groter, hoe meer porties erin passen en hoe langer het voer meegaat.
 * `from`: na hoeveel gehaalde levels je hem vrijspeelt.
 */
export type TroughKind = 'wood' | 'big' | 'silo';
export const TROUGHS: TroughKind[] = ['wood', 'big', 'silo'];
export const TROUGH: Record<TroughKind, { price: number; portions: number; from: number }> = {
  wood: { price: 1, portions: 4, from: 0 },
  big: { price: 4, portions: 8, from: 6 },
  silo: { price: 10, portions: 16, from: 16 },
};
/** Werkers (voerder, schoonmaker) kosten loon: zoveel munten per uur. Een uur in het spel duurt twee minuten. */
export const WAGE = 2;
export const HOUR_SECONDS = 120;
/** Wat je terugkrijgt als je iets weghaalt of een dier laat verhuizen: de helft, naar beneden afgerond. */
export const refund = (price: number): number => Math.floor(price / 2);
export const SHOP_PRICE: Record<ShopKind, number> = {
  foodstall: 4, drinkstall: 4, bench: 2, toilet: 5, icecream: 8, balloon: 12, flowers: 2, bin: 2, souvenir: 16, playground: 6, slide: 5, swing: 6, seesaw: 6, springer: 5, trampoline: 8, hats: 14,
  // de grote attracties: daar spaar je voor
  fountain: 30, carousel: 60,
  tower: 25, restaurant: 30, ferris: 80, bumper: 45, shelter: 10, station: 20, umbrellas: 6, show: 30,
  // één huisje van de kabelbaan: je hebt er twee nodig
  cablecar: 25,
};
/** Een kraam wordt vies van het verkopen (vanaf FEATURE.upkeep): na vijftig keer is hij vies en koopt een derde van de gasten er niets meer. */
export const DIRT_PER_USE = 0.02;
/** Personeel: een karretje kost eenmalig zoveel munten; daarmee werkt een werker sneller. */
export const CART_PRICE = 6;
/** De kleuren die je voor het pak van je personeel kunt kiezen (de eerste is het gewone groen). */
export const SUIT_COLORS = [0x4fa35a, 0x4a90e2, 0xe0584f, 0xf5a623, 0xa06ad9, 0xf06aa6, 0x2bb5a8, 0x6b4a2a, 0xf4f1e8, 0x3d4f7a];
/** Seizoenen (vanaf FEATURE.season): elk duurt twee dagen in het spel. */
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
export const SEASONS: Season[] = ['spring', 'summer', 'autumn', 'winter'];
/** Het weer (vanaf FEATURE.weather): af en toe een rustige bui. Tussen twee buien zit minstens RAIN_EVERY[0] tellen. */
export const RAIN_EVERY: [number, number] = [330, 560];
export const RAIN_SECONDS: [number, number] = [45, 75];
export const RAINBOW_SECONDS = 50;
export type Sky = 'clear' | 'rain' | 'snow' | 'leaves' | 'petals';

export interface SpeciesInfo {
  terrain: Terrain;
  food: FoodId;
  /** De slaapplek waar dit dier graag op slaapt. */
  bed: BedKind;
  /** Het verblijf moet rondom van steen (sterk dier) of van hoog net (klimmer, vlieger, springer) zijn. */
  need?: FenceNeed;
  /** Prijs in munten. */
  cost: number;
}

const sp = (terrain: Terrain, food: FoodId, bed: BedKind, cost: number, need?: FenceNeed): SpeciesInfo => ({ terrain, food, bed, cost, need });

export const SPECIES: Record<SpeciesId, SpeciesInfo> = {
  // boerderij
  pig: sp('mud', 'veg', 'straw', 2),
  cow: sp('grass', 'hay', 'shed', 3),
  sheep: sp('grass', 'hay', 'straw', 3),
  horse: sp('grass', 'fruit', 'shed', 5),
  donkey: sp('grass', 'veg', 'straw', 5),
  goat: sp('grass', 'grain', 'rock', 5),
  alpaca: sp('grass', 'grain', 'straw', 6),
  chicken: sp('grass', 'grain', 'nest', 3),
  duck: sp('water', 'grain', 'nest', 3),
  rabbit: sp('grass', 'veg', 'cave', 3),
  // savanne
  zebra: sp('sand', 'hay', 'shade', 8),
  giraffe: sp('sand', 'leaves', 'shade', 14),
  lion: sp('sand', 'meat', 'rock', 20, 'wall'),
  camel: sp('sand', 'hay', 'rock', 10),
  rhino: sp('mud', 'hay', 'rock', 20, 'wall'),
  hippo: sp('water', 'veg', 'shade', 22, 'wall'),
  elephant: sp('sand', 'fruit', 'shade', 28, 'wall'),
  ostrich: sp('sand', 'grain', 'nest', 9),
  cheetah: sp('sand', 'meat', 'shade', 16, 'wall'),
  gazelle: sp('sand', 'leaves', 'shade', 9),
  // jungle
  monkey: sp('forest', 'fruit', 'climb', 14, 'net'),
  parrot: sp('forest', 'fruit', 'nest', 14, 'net'),
  tiger: sp('forest', 'meat', 'cave', 34, 'wall'),
  gorilla: sp('forest', 'leaves', 'climb', 40, 'wall'),
  crocodile: sp('water', 'meat', 'rock', 26, 'wall'),
  panda: sp('forest', 'bamboo', 'cave', 30),
  peacock: sp('grass', 'grain', 'nest', 15),
  toucan: sp('forest', 'fruit', 'nest', 16, 'net'),
  sloth: sp('forest', 'leaves', 'climb', 18, 'net'),
  panther: sp('forest', 'meat', 'cave', 36, 'wall'),
  // ijs en bergen
  penguin: sp('snow', 'fish', 'nest', 15),
  seal: sp('water', 'fish', 'rock', 20),
  polarbear: sp('snow', 'fish', 'cave', 45, 'wall'),
  reindeer: sp('snow', 'hay', 'shed', 18),
  wolf: sp('snow', 'meat', 'cave', 30, 'wall'),
  arcticfox: sp('snow', 'meat', 'cave', 18),
  bear: sp('forest', 'fish', 'cave', 40, 'wall'),
  yak: sp('snow', 'hay', 'shed', 20),
  owl: sp('snow', 'meat', 'nest', 20, 'net'),
  walrus: sp('snow', 'fish', 'rock', 36, 'wall'),
  // water en verre landen
  flamingo: sp('water', 'fish', 'nest', 18),
  turtle: sp('sand', 'veg', 'shade', 16),
  otter: sp('water', 'fish', 'cave', 20),
  beaver: sp('water', 'leaves', 'cave', 20),
  pelican: sp('water', 'fish', 'nest', 22),
  koala: sp('forest', 'leaves', 'climb', 30, 'net'),
  redpanda: sp('forest', 'bamboo', 'climb', 36, 'net'),
  lemur: sp('forest', 'fruit', 'climb', 30, 'net'),
  bison: sp('grass', 'hay', 'shed', 42, 'wall'),
  kangaroo: sp('sand', 'hay', 'shade', 50, 'net'),
  // aquarium: een bak van glas vol water, met koraal om bij te rusten
  dolphin: sp('water', 'fish', 'coral', 45, 'glass'),
  orca: sp('water', 'fish', 'coral', 60, 'glass'),
  ray: sp('water', 'fish', 'coral', 35, 'glass'),
  shark: sp('water', 'meat', 'coral', 55, 'glass'),
};

/**
 * Veel dieren willen een mix: naast hun eigen grond (minstens de helft van wat overblijft) ook een stukje van
 * iets anders, minstens MIX_TILES tegels per soort. De boerderij blijft eenvoudig; alleen de eend wil ook gras.
 */
export const MIX_TILES = 2;
export const ALSO: Partial<Record<SpeciesId, Terrain[]>> = {
  duck: ['grass'],
  zebra: ['steppe'], giraffe: ['steppe'], lion: ['steppe', 'stones'], camel: ['stones'], rhino: ['steppe', 'water'], hippo: ['mud', 'grass'],
  elephant: ['mud', 'water'], cheetah: ['steppe'], gazelle: ['steppe'],
  tiger: ['water'], gorilla: ['grass'], crocodile: ['swamp', 'sand'], panda: ['grass'], peacock: ['meadow'], panther: ['stones'],
  penguin: ['ice', 'water'], seal: ['ice', 'stones'], polarbear: ['ice', 'water'], reindeer: ['grass'], wolf: ['forest', 'stones'], arcticfox: ['stones'],
  bear: ['stones', 'water'], yak: ['stones'], walrus: ['ice', 'water'],
  flamingo: ['swamp', 'sand'], turtle: ['water', 'grass'], otter: ['grass', 'stones'], beaver: ['forest', 'mud'], pelican: ['sand'], redpanda: ['stones'],
  lemur: ['sand'], bison: ['steppe', 'mud'], kangaroo: ['steppe', 'grass'],
};

// ------------------------------------------------------------ levels
export type GoalType =
  | 'enclosure' | 'trough' | 'bed' | 'animals' | 'happy' | 'fed' | 'cleaned'
  | 'path' | 'guests' | 'coins' | 'shop' | 'born'
  | 'kinds' | 'happyany' | 'healed' | 'caught' | 'keeper' | 'tidy' | 'sold';
export interface Goal {
  type: GoalType;
  n: number;
  species?: SpeciesId;
  shop?: ShopKind;
  /** Bij 'sold': het ding dat verkocht moet worden. Zonder `product` en `shop` telt alles waar een gast precies om vroeg. */
  product?: string;
}
export interface Level {
  goals: Goal[];
  /** Het dier dat je vrijspeelt als het level gehaald is. */
  reward: SpeciesId;
}

const animals = (species: SpeciesId, n = 2): Goal => ({ type: 'animals', species, n });
const happy = (species: SpeciesId, n = 2): Goal => ({ type: 'happy', species, n });
const goal = (type: GoalType, n: number): Goal => ({ type, n });
const shop = (kind: ShopKind, n = 1): Goal => ({ type: 'shop', shop: kind, n });
/** Zoveel keer verkopen: een bepaald ding ('scoop'), alles van een soort kraam ('hats') of alles waar gasten om vragen. */
const sold = (n: number, what?: string): Goal =>
  what && SHOPS.includes(what as ShopKind) ? { type: 'sold', n, shop: what as ShopKind } : { type: 'sold', n, product: what };

/**
 * Vijftig levels in vijf werelden van tien. Elk level speelt één dier vrij en vraagt om twee blije dieren
 * van de soort die je net kreeg. De rest loopt op: meer gasten, meer soorten tegelijk blij, en vanaf de
 * savanne verzorgers die helpen, en later zieke en ontsnapte dieren.
 */
export const LEVELS: Level[] = [
  // ---- wereld 1: boerderij. Eén nieuw ding per level.
  { goals: [goal('enclosure', 1), goal('trough', 1)], reward: 'pig' },
  { goals: [animals('pig'), goal('bed', 1), goal('fed', 1), happy('pig')], reward: 'cow' },
  { goals: [animals('cow'), happy('cow'), goal('cleaned', 3)], reward: 'sheep' },
  { goals: [goal('path', 6), happy('sheep'), goal('guests', 3)], reward: 'horse' },
  { goals: [shop('foodstall'), happy('horse'), goal('coins', 8)], reward: 'donkey' },
  { goals: [shop('drinkstall'), happy('donkey'), goal('guests', 5)], reward: 'goat' },
  { goals: [happy('goat'), goal('born', 1), goal('coins', 12)], reward: 'alpaca' },
  { goals: [shop('toilet'), happy('alpaca'), goal('guests', 6)], reward: 'chicken' },
  { goals: [happy('chicken'), shop('bench', 2), goal('cleaned', 5)], reward: 'duck' },
  { goals: [happy('duck'), goal('kinds', 3), shop('slide')], reward: 'rabbit' },
  // ---- wereld 2: savanne. Stenen muren, meer soorten tegelijk, meer gasten.
  { goals: [happy('rabbit'), goal('born', 2), goal('guests', 8)], reward: 'zebra' },
  { goals: [happy('zebra'), shop('icecream'), goal('coins', 18)], reward: 'giraffe' },
  { goals: [happy('giraffe'), goal('keeper', 1), goal('guests', 9)], reward: 'lion' },
  { goals: [happy('lion'), goal('kinds', 4), sold(3, 'scoop')], reward: 'camel' },
  { goals: [happy('camel'), shop('flowers', 3), goal('guests', 10)], reward: 'rhino' },
  { goals: [happy('rhino'), shop('fountain'), goal('happyany', 12)], reward: 'hippo' },
  { goals: [happy('hippo'), goal('kinds', 5), sold(3, 'pancake')], reward: 'elephant' },
  { goals: [happy('elephant'), shop('bin', 2), goal('guests', 12)], reward: 'ostrich' },
  { goals: [happy('ostrich'), goal('tidy', 4), goal('born', 3)], reward: 'cheetah' },
  { goals: [happy('cheetah'), goal('kinds', 6), goal('guests', 13), sold(4, 'lolly')], reward: 'gazelle' },
  // ---- wereld 3: jungle. Hoge netten, zieke dieren en de eerste verzorgers.
  { goals: [happy('gazelle'), goal('healed', 1), goal('happyany', 14)], reward: 'monkey' },
  { goals: [happy('monkey'), shop('balloon'), goal('guests', 14)], reward: 'parrot' },
  { goals: [happy('parrot'), goal('healed', 2), shop('hats')], reward: 'tiger' },
  { goals: [happy('tiger'), goal('keeper', 3), goal('cleaned', 8)], reward: 'gorilla' },
  { goals: [happy('gorilla'), goal('guests', 15), sold(4, 'hats')], reward: 'crocodile' },
  { goals: [happy('crocodile'), shop('carousel'), goal('tidy', 6)], reward: 'panda' },
  { goals: [happy('panda'), goal('happyany', 16), shop('souvenir')], reward: 'peacock' },
  { goals: [happy('peacock'), goal('keeper', 4), goal('healed', 2)], reward: 'toucan' },
  { goals: [happy('toucan'), goal('kinds', 8), sold(4, 'souvenir')], reward: 'sloth' },
  { goals: [happy('sloth'), goal('born', 4), goal('happyany', 18), goal('coins', 30)], reward: 'panther' },
  // ---- wereld 4: ijs en bergen. Sneeuw, vis en dieren die ontsnappen.
  { goals: [happy('panther'), goal('caught', 1), goal('guests', 16)], reward: 'penguin' },
  { goals: [happy('penguin'), goal('healed', 2), goal('happyany', 18)], reward: 'seal' },
  { goals: [happy('seal'), goal('caught', 2), goal('coins', 30)], reward: 'polarbear' },
  { goals: [happy('polarbear'), goal('kinds', 9), goal('guests', 17)], reward: 'reindeer' },
  { goals: [happy('reindeer'), goal('born', 4), goal('tidy', 8)], reward: 'wolf' },
  { goals: [happy('wolf'), goal('keeper', 6), goal('happyany', 20)], reward: 'arcticfox' },
  { goals: [happy('arcticfox'), goal('healed', 3), goal('caught', 2), goal('guests', 18)], reward: 'bear' },
  { goals: [happy('bear'), goal('kinds', 10), sold(5, 'milk')], reward: 'yak' },
  { goals: [happy('yak'), goal('born', 5), goal('happyany', 22)], reward: 'owl' },
  { goals: [happy('owl'), goal('guests', 20), goal('healed', 3), goal('cleaned', 10)], reward: 'walrus' },
  // ---- wereld 5: water en verre landen. Alles door elkaar, en steeds meer.
  { goals: [happy('walrus'), goal('kinds', 10), goal('guests', 20)], reward: 'flamingo' },
  { goals: [happy('flamingo'), goal('born', 5), goal('caught', 3)], reward: 'turtle' },
  { goals: [happy('turtle'), goal('happyany', 24), sold(10)], reward: 'otter' },
  { goals: [happy('otter'), goal('keeper', 8), goal('healed', 4)], reward: 'beaver' },
  { goals: [happy('beaver'), goal('kinds', 11), goal('guests', 21)], reward: 'pelican' },
  { goals: [happy('pelican'), goal('born', 6), goal('tidy', 10)], reward: 'koala' },
  { goals: [happy('koala'), goal('happyany', 26), goal('caught', 3), sold(15)], reward: 'redpanda' },
  { goals: [happy('redpanda'), goal('kinds', 12), goal('guests', 22)], reward: 'lemur' },
  { goals: [happy('lemur'), goal('healed', 5), goal('born', 6), goal('happyany', 28)], reward: 'bison' },
  { goals: [happy('bison'), goal('kinds', 12), goal('guests', 22), goal('happyany', 30), goal('coins', 30)], reward: 'kangaroo' },
];

export const LEVELS_PER_WORLD = 10;
/** In welke wereld speelt dit level (0 = het eerste level)? */
export function worldOf(levelIndex: number): WorldId {
  return WORLDS[Math.min(WORLDS.length - 1, Math.floor(levelIndex / LEVELS_PER_WORLD))];
}

/** Soorten die vrij zijn als je `done` levels hebt gehaald. */
export function unlockedSpecies(done: number): SpeciesId[] {
  return LEVELS.slice(0, done).map(l => l.reward);
}

/**
 * De dieren van het aquarium zijn geen beloning van een level: je krijgt ze erbij zodra je zoveel levels
 * gehaald hebt. Ze leven alleen in water, achter glas.
 */
export const BONUS: Partial<Record<SpeciesId, number>> = { dolphin: 20, ray: 23, shark: 27, orca: 35 };
export const AQUATIC: SpeciesId[] = ['dolphin', 'orca', 'ray', 'shark'];

/**
 * Natuur voor in de verblijven (en in het park): graspollen, bloemetjes, varens, struikjes, kiezels en stenen. Elke
 * tegel is in vier vakjes verdeeld: iets kleins neemt één vakje (`size` 1), een boom of rots de hele tegel (`size` 2).
 */
export type PropKind = 'tuft' | 'daisies' | 'fern' | 'shrub' | 'pebbles' | 'stone' | 'oak' | 'fir' | 'coco' | 'crag'
  // klein spul voor in het park (de groep `park`): ook op een kwart tegel, zodat er een paar op één tegel passen
  | 'pot' | 'gnome' | 'pinwheel' | 'ducky' | 'birdhouse' | 'can' | 'bucket' | 'snail' | 'crate';
export type PropGroup = 'green' | 'stone' | 'park';
/** Waar een dier om vraagt: bomen, planten (graspollen, bloemetjes, varens, struikjes) of stenen. */
export type WildKind = 'tree' | 'plant' | 'stone';
export const WILD_KINDS: WildKind[] = ['tree', 'plant', 'stone'];
/**
 * `wild`: waar het voor de dieren als telt (bomen, planten of stenen). Wat voor het park is heeft geen `wild`: het
 * telt voor geen enkel dier mee en staat alleen buiten de verblijven. `from`: na hoeveel gehaalde levels je het
 * vrijspeelt; zonder `from` is het er zodra de natuur er is (FEATURE.wild).
 */
export const PROP: Record<PropKind, { group: PropGroup; wild?: WildKind; size: 1 | 2; price: number; from?: number }> = {
  tuft: { group: 'green', wild: 'plant', size: 1, price: 1 }, daisies: { group: 'green', wild: 'plant', size: 1, price: 1 }, fern: { group: 'green', wild: 'plant', size: 1, price: 1 },
  shrub: { group: 'green', wild: 'plant', size: 1, price: 1 },
  pebbles: { group: 'stone', wild: 'stone', size: 1, price: 1 }, stone: { group: 'stone', wild: 'stone', size: 1, price: 1 },
  oak: { group: 'green', wild: 'tree', size: 2, price: 3 }, fir: { group: 'green', wild: 'tree', size: 2, price: 3 }, coco: { group: 'green', wild: 'tree', size: 2, price: 3 },
  crag: { group: 'stone', wild: 'stone', size: 2, price: 3 },
  // voor het park: een paar per keer, vanaf een paar levels na de natuur
  pot: { group: 'park', size: 1, price: 1, from: 10 }, gnome: { group: 'park', size: 1, price: 1, from: 10 }, pinwheel: { group: 'park', size: 1, price: 1, from: 10 },
  ducky: { group: 'park', size: 1, price: 1, from: 12 },
  birdhouse: { group: 'park', size: 1, price: 1, from: 15 }, can: { group: 'park', size: 1, price: 1, from: 15 },
  bucket: { group: 'park', size: 1, price: 1, from: 18 }, snail: { group: 'park', size: 1, price: 1, from: 18 },
  crate: { group: 'park', size: 1, price: 1, from: 21 },
};
export const PROPS = Object.keys(PROP) as PropKind[];
/** De natuur (voor verblijven en park) en het kleine spul dat alleen in het park mag. */
export const WILD_PROPS = PROPS.filter(k => PROP[k].group !== 'park');
export const PARK_PROPS = PROPS.filter(k => PROP[k].group === 'park');
/** Hoeveel vakjes iets vult: zoveel telt het mee als groen of als steen. */
export const propPoints = (kind: PropKind): number => PROP[kind].size * PROP[kind].size;
/**
 * Hoeveel bomen, planten en stenen een dier in zijn verblijf wil (vanaf FEATURE.wild): per tegel land, van minstens
 * tot hooguit. Het hangt af van de grond waar het dier van houdt: een bosdier wil veel bomen en planten, een dier
 * van zand of sneeuw wil stenen en weinig groen. Dieren die alleen in het water leven vragen er niet om. Hoeveel
 * stuks dat in een verblijf zijn, staat in wildRange: hoe groter het verblijf, hoe meer.
 */
export const WILD_WANT: Partial<Record<Terrain, Record<WildKind, [number, number]>>> = {
  grass: { tree: [1 / 16, 1 / 4], plant: [1 / 8, 1], stone: [0, 1 / 4] },
  mud: { tree: [1 / 16, 1 / 4], plant: [1 / 8, 1], stone: [0, 1 / 4] },
  forest: { tree: [1 / 8, 1 / 2], plant: [1 / 6, 1.25], stone: [0, 1 / 3] },
  sand: { tree: [1 / 16, 1 / 5], plant: [1 / 12, 1 / 2], stone: [1 / 8, 2 / 3] },
  snow: { tree: [0, 1 / 8], plant: [0, 1 / 4], stone: [1 / 8, 2 / 3] },
  water: { tree: [0, 1 / 5], plant: [0, 1 / 2], stone: [0, 1 / 2] },
};
export const wildWant = (sp: SpeciesId): Record<WildKind, [number, number]> | null => (AQUATIC.includes(sp) ? null : WILD_WANT[SPECIES[sp].terrain] ?? null);
/**
 * Hoeveel bomen, planten en stenen dit dier wil in een verblijf met `land` tegels land: [minstens, hooguit], in
 * stuks. Een klein verblijf vraagt nog geen boom (die neemt een hele tegel in); er mag er altijd minstens één staan.
 */
export function wildRange(sp: SpeciesId, land: number): Record<WildKind, [number, number]> | null {
  const want = wildWant(sp);
  if (!want) return null;
  const range = {} as Record<WildKind, [number, number]>;
  for (const kind of WILD_KINDS) {
    // een boom vraagt het dier pas als er een hele boom in past: naar beneden afgerond; de rest gewoon afgerond
    const min = kind === 'tree' ? Math.floor(land * want[kind][0] + 1e-9) : Math.round(land * want[kind][0]);
    range[kind] = [min, Math.max(min + 1, Math.round(land * want[kind][1]))];
  }
  return range;
}
export const bonusSpecies = (done: number): SpeciesId[] => (Object.keys(BONUS) as SpeciesId[]).filter(sp => BONUS[sp]! <= done);
/** Zo hoog staat het water in een bak van glas. */
export const TANK_WATER = 0.42;
/**
 * Vies water (vanaf FEATURE.murk): het water in een bak van glas wordt langzaam troebel, van 0 (helder) tot 1. Hoe
 * meer en hoe grotere zeedieren erin zwemmen, hoe sneller. `perSec`: zoveel erbij per tel voor één dolfijn (drie
 * dolfijnen maken het water in zes minuten vies). Met een waterfilter in de bak gaat het `filter` keer zo snel.
 * Vanaf `dirty` vinden de zeedieren het water vies, vanaf `sad` zijn ze er verdrietig van. Vanaf `job` gaat een
 * schoonmaker de bak al poetsen, zodat het water met hulp schoon blijft.
 */
export const MURK = { perSec: 1 / 1800, filter: 0.25, dirty: 0.6, sad: 0.85, job: 0.45 };
/** Hoeveel een dier het water vies maakt: een zeedier naar zijn grootte (een dolfijn is 1), een jong half zoveel. */
export const murkLoad = (sp: SpeciesId, young = false): number => (AQUATIC.includes(sp) ? ((SPACE[sp] ?? 9) / 9) * (young ? 0.5 : 1) : 0);
/** Zoveel wordt het water per tel viezer, met deze dieren (`load`, opgeteld met murkLoad) en wel of geen waterfilter. */
export const murkRate = (load: number, filter: boolean): number => load * MURK.perSec * (filter ? MURK.filter : 1);
/** Hoe vies het water is na `seconds` tellen. Nooit meer dan 1. */
export const murkAfter = (murk: number, load: number, filter: boolean, seconds: number): number => Math.min(1, Math.max(0, murk + murkRate(load, filter) * seconds));
/** Vinden de zeedieren dit water vies? */
export const murkyWater = (murk: number): boolean => murk >= MURK.dirty;

/** Vanaf hoeveel gehaalde levels iets meedoet. */
export const FEATURE = {
  paths: 3, foodstall: 4, drinkstall: 5, toilet: 7, bench: 8, playground: 9, slide: 9, swing: 12, seesaw: 16, springer: 19, trampoline: 23, icecream: 11, flowers: 14, bin: 5, hats: 22, souvenir: 26,
  /** De grote attracties: een fontein om naar te kijken en een draaimolen om in te rijden. */
  fountain: 15, carousel: 25,
  tower: 20, restaurant: 24, ferris: 35, bumper: 30, shelter: 10, station: 27, umbrellas: 10,
  /** De tribune voor de dierenshow: even na de dolfijn. */
  show: 22,
  /** De kabelbaan: in de wereld van ijs en bergen, waar hij het best past. */
  cablecar: 32,
  /** Een ruit in het hek, het weer (regen), seizoenen, kramen die vies worden, warmte en kou. */
  window: 13, weather: 10, season: 16, upkeep: 17, climate: 31,
  /** Bijzondere gasten: rolstoel en kinderwagen, een schoolklas, een verjaardag, een beroemde gast, een verdwaald kind. */
  wheels: 8, schoolclass: 12, party: 14, celeb: 15, lost: 18,
  /** Meer personeel: fotograaf, gids en dierenarts; en een karretje voor je werkers. */
  photo: 18, guide: 21, vet: 23, cart: 15,
  /** Een kinderboerderij maak je van een verblijf met boerderijdieren. */
  petting: 6,
  /** Vanaf hier willen dieren groen en steen in hun verblijf: niet te weinig en niet te veel. */
  wild: 8,
  /** Vanaf hier kun je het park mooi maken met bomen, bloemen, water en beelden. */
  decor: 5,
  /** Vanaf hier slijten houten hekken: af en toe moet je er een repareren. */
  wear: 7,
  /** Vanaf hier willen dieren iets leuks in hun verblijf: speelgoed of een plant. */
  fun: 9,
  /** Vanaf hier wordt het ook nacht: dan zie je alleen iets waar licht is, dus zet je lantaarns neer. */
  night: 14,
  /** Vanaf hier kunnen dieren ziek worden. */
  sick: 20,
  balloon: 21,
  /** Vanaf hier kun je een verzorger aannemen: zodra het park te groot wordt om alles zelf te doen. */
  keeper: 11,
  /** Vanaf hier kan er een dier ontsnappen. */
  escape: 30,
  /** Vanaf hier zijn dieren bang voor een roofdier in hun verblijf: dan komt de leeuw (zie PREY_OF). */
  safe: 13,
  /** Vanaf hier wordt het water in de bakken van glas langzaam vies: tegelijk met het aquarium en het waterfilter. */
  murk: 20,
  /** Een level later: de bewaker, die ontsnapte dieren weer naar huis brengt. */
  guard: 31,
};

/**
 * Hoe een dier ontsnapt (vanaf FEATURE.escape): springers springen over het hek, klimmers klimmen eroverheen,
 * vogels vliegen eroverheen, sterke dieren duwen het hek om (dat stuk is dan kapot) en de rest glipt erdoor.
 * Zeedieren ontsnappen nooit.
 */
export type EscapeWay = 'jump' | 'climb' | 'fly' | 'push' | 'slip';
export const ESCAPE_WAY: Record<SpeciesId, EscapeWay | null> = {
  // boerderij
  pig: 'slip', cow: 'slip', sheep: 'slip', horse: 'jump', donkey: 'slip', goat: 'jump', alpaca: 'slip', chicken: 'fly', duck: 'fly', rabbit: 'slip',
  // savanne
  zebra: 'jump', giraffe: 'slip', lion: 'push', camel: 'slip', rhino: 'push', hippo: 'push', elephant: 'push', ostrich: 'jump', cheetah: 'jump', gazelle: 'jump',
  // jungle
  monkey: 'climb', parrot: 'fly', tiger: 'push', gorilla: 'push', crocodile: 'slip', panda: 'climb', peacock: 'fly', toucan: 'fly', sloth: 'climb', panther: 'jump',
  // ijs
  penguin: 'slip', seal: 'slip', polarbear: 'push', reindeer: 'jump', wolf: 'jump', arcticfox: 'jump', bear: 'push', yak: 'slip', owl: 'fly', walrus: 'push',
  // verre landen
  flamingo: 'fly', turtle: 'slip', otter: 'slip', beaver: 'slip', pelican: 'fly', koala: 'climb', redpanda: 'climb', lemur: 'climb', bison: 'push', kangaroo: 'jump',
  // aquarium
  dolphin: null, orca: null, ray: null, shark: null,
};

/**
 * Hoe het dier deze keer ontsnapt. Met het verkeerde hek op zijn eigen manier; met het goede hek kan dat niet
 * meer (de muur valt niet om, over het net kom je niet), en glipt het hooguit eens door een kier.
 */
export function escapeWay(sp: SpeciesId, wrongFence: boolean): EscapeWay | null {
  const way = ESCAPE_WAY[sp];
  if (!way) return null;
  return !wrongFence && SPECIES[sp].need ? 'slip' : way;
}

/**
 * Hoe graag een dier ontsnapt, van 0 tot 1: met het verkeerde hek altijd, een dier dat niet blij is vaak en een
 * blij dier achter het goede hek bijna nooit. Een zeedier nooit.
 */
export const ESCAPE_CHANCE = { wrong: 1, sad: 0.6, happy: 0.04 };
export function escapeChance(sp: SpeciesId, wrongFence: boolean, happy: boolean): number {
  if (!ESCAPE_WAY[sp]) return 0;
  return wrongFence ? ESCAPE_CHANCE.wrong : happy ? ESCAPE_CHANCE.happy : ESCAPE_CHANCE.sad;
}

/**
 * Wie er ontsnapt: een gok, waarbij een dier met een grotere kans vaker aan de beurt is. Daarna lukt het nog
 * met die kans; vraagt het level om een ontsnapt dier (`forGoal`), dan lukt het altijd. Null: niemand.
 */
export function pickEscaper<T>(list: { item: T; chance: number }[], forGoal: boolean, rnd: () => number = Math.random): T | null {
  const options = list.filter(o => o.chance > 0);
  const total = options.reduce((s, o) => s + o.chance, 0);
  if (!total) return null;
  let r = rnd() * total;
  const pick = options.find(o => (r -= o.chance) < 0) ?? options[options.length - 1];
  return forGoal || rnd() < pick.chance ? pick.item : null;
}

/** Welk figuur geeft de opdracht voor welk soort doel. */
export const GOAL_OWNER: Record<GoalType, 'builder' | 'keeper' | 'host' | 'cashier'> = {
  enclosure: 'builder',
  trough: 'builder',
  bed: 'builder',
  path: 'builder',
  animals: 'keeper',
  happy: 'keeper',
  fed: 'keeper',
  cleaned: 'keeper',
  born: 'keeper',
  kinds: 'keeper',
  happyany: 'keeper',
  healed: 'keeper',
  caught: 'keeper',
  keeper: 'keeper',
  guests: 'host',
  shop: 'host',
  tidy: 'host',
  sold: 'host',
  coins: 'cashier',
};

/** De wens 'safe' (niet bang zijn) staat vooraan: zolang een dier bang is, zie je dat het eerst. */
export const WISH_ORDER: WishId[] = ['health', 'enclosure', 'safe', 'food', 'bed', 'terrain', 'friend', 'clean', 'space', 'fun', 'climate', 'wild'];
/** Zoveel poepjes mogen er in een verblijf liggen voordat de dieren het vies vinden. */
export const MAX_POOPS_CLEAN = 3;

/**
 * Oudere opgeslagen spellen kenden veertien levels in een andere volgorde. Wie toen verder was dan de
 * alpaca, krijgt de drie nieuwe boerderijdieren erbij en gaat verder waar hij was.
 */
export function migrateLevel(level: number, version: number): number {
  return version < 2 && level > 7 ? level + 3 : level;
}

// ------------------------------------------------------------ de dierenshow
/** Deze dieren doen de show bij de tribune: de dolfijn, de orka en de zeehond. */
export const SHOW_STARS: SpeciesId[] = ['dolphin', 'orca', 'seal'];
/** Een zeehond woont achter een gewoon hek (geen glas): de tribune mag dan tegen elk soort hek staan, niet tegen een poort. */
export const SHOW_FENCES = [1, 3, 4, 5, 6, 7];
/**
 * De dierenshow (vanaf FEATURE.show), in tellen: `first` tot de eerste show, `every` tussen twee shows, `retry` tot
 * een nieuwe poging als de dieren niet konden, `call` om naar de tribune te lopen, `tricks` zo lang doen de dieren
 * kunstjes, `soon` zo snel begint de show na een tik, `trick` om de zoveel tellen een nieuw kunstje. `reach`: gasten
 * tot zoveel tegels ver komen kijken; `seats`: zoveel plekken heeft de tribune.
 */
export const SHOW_TIME = { first: 45, every: 150, retry: 30, call: 10, tricks: 18, soon: 3, trick: 2.6, reach: 10, seats: 9 };
/** De drie bankjes van de tribune, van voor (bij het water) naar achter: waar ze staan (z) en hoe hoog je zit (h). */
export const SHOW_ROWS = [{ z: -0.5, h: 0.24 }, { z: 0.05, h: 0.46 }, { z: 0.6, h: 0.68 }];
export type ShowPhase = 'wait' | 'call' | 'tricks';
/** Hoe ver een tribune is met haar show: wachten, de gasten roepen of de kunstjes, en hoeveel tellen dat nog duurt. */
export interface ShowClock {
  phase: ShowPhase;
  left: number;
}
export const newShow = (): ShowClock => ({ phase: 'wait', left: SHOW_TIME.first });
/**
 * Eén stapje van de klok van de show. `open`: het park is open en de gasten gaan nog niet naar huis (anders wacht de
 * klok). `ready`: de dieren kunnen (blij en wakker). Geeft terug wat er net gebeurde: 'call' (de bel: kom kijken),
 * 'tricks' (de kunstjes beginnen), 'end' (klaar), 'skip' (de dieren konden niet) of null.
 */
export function showTick(c: ShowClock, dt: number, open: boolean, ready: boolean): 'call' | 'tricks' | 'end' | 'skip' | null {
  if (c.phase === 'wait') {
    if (!open) return null;
    c.left -= dt;
    if (c.left > 0) return null;
    if (!ready) {
      c.left = SHOW_TIME.retry;
      return 'skip';
    }
    c.phase = 'call';
    c.left = SHOW_TIME.call;
    return 'call';
  }
  c.left -= dt;
  // sluitingstijd: de show houdt op
  if (!open) {
    c.phase = 'wait';
    c.left = SHOW_TIME.every;
    return 'end';
  }
  if (c.left > 0) return null;
  if (c.phase === 'call') {
    // de dieren zijn intussen in slaap gevallen of verdrietig: dan geen show
    if (!ready) {
      c.phase = 'wait';
      c.left = SHOW_TIME.retry;
      return 'skip';
    }
    c.phase = 'tricks';
    c.left = SHOW_TIME.tricks;
    return 'tricks';
  }
  c.phase = 'wait';
  c.left = SHOW_TIME.every;
  return 'end';
}
/** Een tik op de tribune: de volgende show begint over een paar tellen. Geeft false als er al een show bezig is. */
export function showSoon(c: ShowClock): boolean {
  if (c.phase !== 'wait') return false;
  c.left = Math.min(c.left, SHOW_TIME.soon);
  return true;
}
/** Kunnen de dieren een show doen? 'none': er zijn er geen, 'sleep': er slaapt er een, 'sad': er is er een niet blij of ziek. */
export function showReady(stars: readonly { happy: boolean; sleeping: boolean; sick: boolean }[]): 'ok' | 'none' | 'sleep' | 'sad' {
  if (!stars.length) return 'none';
  if (stars.some(a => a.sleeping)) return 'sleep';
  return stars.every(a => a.happy && !a.sick) ? 'ok' : 'sad';
}
