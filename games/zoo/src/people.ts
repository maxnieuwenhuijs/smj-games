// Gasten en verzorgers. Gasten komen binnen bij de ingang, lopen over de paden, kijken bij de dieren,
// kopen iets als ze het naar hun zin hebben en laten met een wolkje zien wat ze willen.
import * as THREE from 'three';
import { PLUSH, PRODUCTS, SEEK_REACH, STALLS, type FoodId, type ShopKind } from './data';
import { Grid, H, W, tileIndex, tileXY } from './grid';
import { DARK_FUN, LOOKS, PETTING_GUESTS, PLAY, RESTAURANT_TABLES, RIDES, SUIT_COLORS, TRAIN, isPath } from './data';
import { SHOW_ROWS, SHOW_TIME } from './data';
import { FOUNTAIN, RIDE_KINDS, RIDE_SEATS, isRide, newPose, planVisit, rideLocal, visitAge, visitOff, visitPose, visitTime, type RideState, type Visit } from './rides';
import { CABLE, cableAt, cableLength, cableLoop, cablePassed, cableStop } from './cable';
import { toWorldX, toWorldZ } from './view';
import { arrivalPath, busPath, exitPath, pavementY } from './road';
import { FaceCrowd, beardColor, faceFor, giveFace, setFace } from './faces';
import { BALLOON_FLY, KID_CHANCE, KID_WAIT, WAVE, balloonCatchable, balloonDrift, balloonHome, waveFresh, type KidMoment } from './kids';
import { PAINT, PARADE, WAY, paintNext, type FacePaint } from './guestfun';
import { PERSON_SHADE, shadeAttribute } from './shade';

/** De tegel waar gasten binnenkomen en weer weggaan: midden aan de voorkant. */
export const ENTRANCE = tileIndex(Math.floor(W / 2), H - 1);

export interface ShopSpot {
  /** De linkerbovenhoek; `size` is hoe breed het gebouw is langs zijn voorkant (zie SHOP_SIZE). */
  x: number;
  y: number;
  kind: ShopKind;
  size: number;
  /**
   * Zoveel tegels beslaat het echt, van west naar oost en van noord naar zuid. Wat niet vierkant is (een marktkraam
   * van 2 bij 1, het reuzenrad van 8 bij 2) staat een kwartslag gedraaid andersom: 1 bij 2, of 2 bij 8.
   */
  w?: number;
  h?: number;
  /** Wat deze kraam verkoopt (zie PRODUCTS; knuffels heten 'plush_' + soort). */
  sells: string[];
  /** Welke plekken bezet zijn (een bit per plek): zo zitten er geen twee gasten op hetzelfde zitje. */
  used?: number;
  /**
   * Een attractie of speeltoestel (zie rides.ts): de stand van dit moment (de klok, de hoek, hoe hard het gaat, de
   * botsauto's). Het spel houdt hem elk beeldje bij; het beeld en de gasten lezen hem.
   */
  ride?: RideState;
  /** Op welke plekken nu echt iemand zit (een bit per plek): wie er nog naartoe loopt of al weer afstapt, telt niet mee. */
  aboard?: number;
  /**
   * Een bankje, bloembak of afvalbak staat op de rand van tegel (x, y), net als een hek, en neemt geen
   * tegel in: 'h' is de noordrand, 'v' de westrand.
   */
  edge?: 'h' | 'v';
  /** Naar welke kant het kijkt: 1 = zuid of oost, -1 = noord of west. Het spel houdt dit bij. */
  face?: number;
  /** Uit oudere spellen: de speler had het omgedraaid, het kijkt van het pad af. */
  turned?: boolean;
  /** De kant die de speler bij het neerzetten heeft gekozen (1 of -1). Staat dit er, dan draait het niet meer vanzelf. */
  set?: number;
  /** Een gebouw draait in kwartslagen: 0 = voorkant naar het zuiden, 1 = oosten, 2 = noorden, 3 = westen. */
  rot?: number;
  /** De speler heeft het gebouw zelf gedraaid: dan draait het niet meer vanzelf naar het pad. */
  manual?: boolean;
  /** Hoeveel gasten er nu geholpen worden en hoeveel er in de rij staan (het spel houdt dit elk beeldje bij). */
  busyNow?: number;
  line?: number;
  /**
   * Het gebouw in het beeld, als het er is. Bij de wc zetten de gasten in `userData.ajar` welke deur open
   * moet (een bit per deur); het beeld laat de deuren daarop open- en dichtzwaaien (zie animateShop).
   */
  mesh?: THREE.Object3D;
}

/** Waar een bankje op een rand precies staat en hoe het gedraaid is: [x, y, draaiing]. Zelfde regels als in het beeld. */
export function edgePose(shop: ShopSpot): [number, number, number] {
  const face = shop.face ?? 1;
  return shop.edge === 'h'
    ? [shop.x + 0.5, shop.y - 0.2 * face, face < 0 ? Math.PI : 0]
    : [shop.x - 0.2 * face, shop.y + 0.5, face < 0 ? -Math.PI / 2 : Math.PI / 2];
}

/** Hoeveel tegels een winkel beslaat: [van west naar oost, van noord naar zuid]. */
export const shopTiles = (shop: ShopSpot): [number, number] => [shop.w ?? shop.size, shop.h ?? shop.size];

/** Het midden van een winkel, in rastercoördinaten. */
export const shopCenter = (shop: ShopSpot): [number, number] =>
  shop.edge === 'h' ? [shop.x + 0.5, shop.y] : shop.edge === 'v' ? [shop.x, shop.y + 0.5] : [shop.x + shopTiles(shop)[0] / 2, shop.y + shopTiles(shop)[1] / 2];

/** De twee tegels aan weerszijden van iets wat op een rand staat (alleen wat binnen het park ligt). */
export function edgeSides(shop: { x: number; y: number; edge?: 'h' | 'v' }): number[] {
  const sides: [number, number][] = shop.edge === 'h' ? [[shop.x, shop.y - 1], [shop.x, shop.y]] : [[shop.x - 1, shop.y], [shop.x, shop.y]];
  return sides.filter(([x, y]) => x >= 0 && y >= 0 && x < W && y < H).map(([x, y]) => tileIndex(x, y));
}

/** Waar een gast voor naar een winkel gaat. */
export type Need = 'food' | 'drink' | 'toilet' | 'icecream' | 'balloon' | 'hat' | 'souvenir' | 'play' | 'sit' | 'look' | 'ride' | 'umbrella' | 'shelter' | 'pet'
  // schmink: alleen kinderen, bij de schminktent
  | 'paint';

/** Een kinderboerderij waar gasten naar binnen mogen: het pad voor het poortje, de tegel erachter en alle tegels binnen. */
export interface PetSpot {
  out: number;
  inn: number;
  region: number;
  tiles: number[];
  /** Hoeveel gasten er nu binnen zijn (de gasten houden dit bij). */
  count: number;
}

/** Iemand waar een groepje achteraan loopt: een juf met haar klas, een jarige met vriendjes, of de gids. */
export interface Leader {
  gx: number;
  gy: number;
  /** Waar de leider net liep, het nieuwste achteraan: daar lopen de volgers overheen. */
  trail: [number, number][];
  gone: boolean;
  /** Staat de leider ergens naar te kijken? Dan kijkt het groepje mee naar `face`. */
  watching: boolean;
  face: [number, number] | null;
}

/** Wat een gast wil, voor het wolkje boven zijn hoofd. `lacking`: het is er niet in het park. `product`: het ding waar hij om vraagt. */
/** Een gast zoals hij bewaard wordt: waar hij loopt, hoe het met hem gaat en wat hij draagt. */
export interface GuestSave {
  gx: number;
  gy: number;
  child: boolean;
  fun: number;
  age: number;
  stay: number;
  hunger: number;
  thirst: number;
  bladder: number;
  hat?: string;
  /** De ballon die hij vasthoudt ('' als de kleur niet vastligt). */
  balloon?: string;
  /** Het dierengezicht dat een kind in de schminktent kreeg. */
  paint?: FacePaint;
}

/** `busy`: het is er wel, maar te druk: er zijn te weinig van voor zoveel gasten. */
export type GuestWish = { kind: Need | 'bored' | 'fav' | 'dark' | 'wide' | 'astray'; lacking: boolean; product?: string; busy?: boolean };

/**
 * De geluidjes bij wat een gast doet (de namen uit tools/voice/sounds.json). Hoe hard elk klinkt en hoe lang het
 * daarna stil blijft, staat bij `guestSound` in het spel.
 */
export type GuestCue =
  | 'flush' | 'guest.laugh' | 'toilet.pee' | 'toilet.poop' | 'guest.grumble' | 'guest.yum' | 'guest.uhoh' | 'guest.chat'
  // eten en drinken
  | 'guest.slurp' | 'guest.bite' | 'guest.aah'
  // bij de dieren en op het pad
  | 'guest.shh' | 'guest.yuck' | 'guest.aww' | 'guest.yawn' | 'guest.sigh' | 'guest.phew' | 'guest.dizzy' | 'guest.five'
  // bij de dingen in het park
  | 'guest.sniff' | 'guest.echo' | 'park.scribble' | 'park.splash' | 'park.brolly'
  // op de speeltoestellen en in de botsauto's
  | 'guest.whee' | 'ride.boing' | 'ride.creak' | 'ride.bump';

export interface GuestWorld {
  grid: Grid;
  shops: ShopSpot[];
  /** Is er vanaf deze padtegel iets te zien? Zo ja: hoe leuk, waar kijk je naar en welke soorten staan er. */
  viewScore(tile: number): { score: number; x: number; y: number; species: string[] } | null;
  /** Een gast staat bij de kraam. Geeft terug of hij iets koopt. `exact`: het is precies waar hij om vroeg. */
  buy(shop: ShopSpot, guest: Guest, product: string | undefined, exact: boolean): boolean;
  /** Waar gasten bij dit soort kraam nu om kunnen vragen. Leeg: er valt niets te kiezen. */
  products(kind: ShopKind): string[];
  /** Een gast kon het niet meer ophouden en deed het op het pad. */
  accident(guest: Guest, mess: 'poop' | 'pee'): void;
  /** Hoe snel gasten trek krijgen; hoger als het park net veel heeft uitgegeven. */
  demand(): number;
  /** Hoeveel gasten het park nu trekt. */
  capacity(): number;
  /** Het park is dicht (van middernacht tot zeven uur): er komen geen gasten en wie er nog is, gaat naar huis. */
  closed(): boolean;
  /** Het is bijna sluitingstijd (vanaf tien uur 's avonds) of het park is al dicht: de gasten gaan naar huis. */
  goingHome(): boolean;
  /** Bestaat dit soort kraam al in het spel? Zo niet, dan krijgen gasten er ook geen trek in. */
  sells(kind: ShopKind): boolean;
  /** De soorten die nu in het park wonen; een gast kiest er één als lievelingsdier. */
  parkSpecies(): string[];
  /** De gast heeft zijn lievelingsdier gezien. */
  cheer(guest: Guest): void;
  /** De gast laat afval vallen. */
  dropLitter(gx: number, gy: number): void;
  /** Ligt er afval op deze tegel? */
  litterOn(tile: number): boolean;
  /** Geluidje bij iets wat een gast doet. */
  guestSound(kind: GuestCue, guest: Guest): void;
  /** Vraagt het level om afval op te ruimen? Dan laten gasten ook naast een afvalbak weleens iets vallen. */
  messy(): boolean;
  /** Welk deel van de gasten bij dit soort kraam geen plek vindt, omdat er te weinig van zijn (0 = genoeg). */
  busy(kind: ShopKind): number;
  /** Hoeveel blijer een gast op deze tegel wordt van versieringen in de buurt. */
  charm(tile: number): number;
  /** Is het hier nacht en staat er geen licht in de buurt? Dan ziet een gast bijna niets. */
  dark(tile: number): boolean;
  /** Hoeveel sneller gasten zin krijgen in iets van dit soort kraam: meer als een level erom vraagt. */
  craving(kind: ShopKind): number;
  /** Een gast gooit zijn afval in deze bak: de klep klappert even. */
  binned(bin: ShopSpot): void;
  /** Regent het? Wie geen paraplu heeft, wordt nat en zoekt een schuilhut. */
  raining(): boolean;
  /** Doet dit al mee in het spel ('wheels', 'petting', 'weather', ...)? */
  feature(name: string): boolean;
  /** Is het pad hier twee tegels breed? Een rolstoel of kinderwagen heeft die ruimte nodig. */
  wide(tile: number): boolean;
  /** Staat er een plattegrond vlakbij? Wie die gezien heeft, vindt zijn lievelingsdier meteen. */
  mapNear(gx: number, gy: number): boolean;
  /** Weet een gast op deze tegel de weg? Ja bij een wegwijzer, een plattegrond of de poort in de buurt, en altijd in een klein park. */
  signed(tile: number): boolean;
  /** Een blije gast gaat naar huis en laat een tekening achter in het gastenboek. */
  signBook(guest: Guest): void;
  /** Een gast heeft net bij de dieren gekeken (de fotograaf verkoopt hem misschien een foto). */
  watched(guest: Guest): void;
  /** Hoeveel er vanaf deze uitkijktoren te zien is: meer soorten in de buurt is leuker (0 tot 0,3). */
  towerView(shop: ShopSpot): number;
  /** Rijdt het treintje? Daarvoor zijn twee haltes aan hetzelfde pad nodig. */
  trainRuns(): boolean;
  /** De kinderboerderijen waar gasten nu naar binnen mogen. Steeds dezelfde objecten zolang er niets verandert. */
  pettingSpots(): PetSpot[];
  /** Een gast staat in de kinderboerderij: er komt een dier naar hem toe. Geeft terug waar dat dier staat. */
  petAt(spot: PetSpot, guest: Guest): [number, number] | null;
  /** Het verjaardagsgroepje is bij het speeltoestel: tijd voor slingers en taart. */
  partyAt(shop: ShopSpot, guest: Guest): void;
  /** Het verdwaalde kind is terug bij zijn papa of mama. `helped`: de speler heeft erop getikt. */
  reunited(child: Guest, parent: Guest, helped: boolean): void;
  /** De beroemde gast gaat naar huis; was hij blij, dan komen er meer gasten. */
  starLeft(guest: Guest, happy: boolean): void;
  /** De schoolklas gaat naar huis; `happy`: de juf of meester had het naar zijn zin. */
  classLeft(guest: Guest, happy: boolean): void;
  /** Bij een heel vol park krijgt elke gast wat minder snel trek, zodat de kramen het aankunnen (1 = gewoon). */
  ease(): number;
  /**
   * De dingen in het park waar een gast naartoe kan lopen om er iets mee te doen (zie SIGHT). Het spel zoekt ze om
   * de paar tellen opnieuw uit; een ding houdt hetzelfde object zolang het er staat.
   */
  sights(): Sight[];
  /** Een gast doet iets met dit ding: het beweegt even mee (de pomp, de sneeuwpop, het gastenboek, de klep van de afvalbak). */
  sightUsed(sight: Sight): void;
  /** Een plons op deze plek en hoogte (in de fontein). `coin`: er ging een muntje in; heel af en toe levert dat een munt op. */
  plons(gx: number, gy: number, height: number, coin: boolean): void;
  /** Is het avond, nacht of winter? Dan warmen meer gasten hun handen bij het kampvuur. */
  chilly(): boolean;
  /** Wat doen de dieren waar je vanaf deze padtegel naar kijkt? Een optelsom van PEN (slapen, spelen, ziek, vies, schrik). */
  penMood(tile: number): number;
  /** Loopt er een ontsnapt dier vlak bij dit punt? Zo ja, dan staat in `out` waar het is. */
  looseNear(gx: number, gy: number, out: [number, number]): boolean;
  /** Is het nacht? Dan gapen de gasten en lopen ze slaperig. */
  isNight(): boolean;
  /** Staat er een regenboog? Dan wijzen de gasten omhoog. */
  rainbowUp(): boolean;
  /** Ligt er een regenplas op deze tegel? Kinderen stampen erin. */
  puddleOn(tile: number): boolean;
  /** Spetters op deze plek. */
  splash(gx: number, gy: number): void;
  /** Hoe ver de show bij deze tribune is: 0 = er is geen show, 1 = de gasten komen zitten, 2 = de dieren doen kunstjes. */
  showLive(shop: ShopSpot): number;
  /** Een gast heeft de hele show gezien: hij betaalt een munt. */
  showPaid(shop: ShopSpot, guest: Guest): void;
  /** Rijdt de kabelbaan bij dit huisje, en mag je nu instappen? */
  liftRuns(shop: ShopSpot): boolean;
  /** Welke soorten er onder dit punt wonen: dat ziet een gast vanuit de kabelbaan. */
  liftView(gx: number, gy: number): string[];
  /** Een gast is met de kabelbaan geweest: hij betaalt voor zijn ritje. */
  liftPaid(shop: ShopSpot, guest: Guest): void;
  /** Mag er nu zo'n moment met een kind gebeuren (zie kids.ts)? Zo ja, dan onthoudt het spel dat het er een was. */
  kidMoment(kind: KidMoment, guest: Guest): boolean;
  /** Een kind liet zijn ijsje vallen: een vlek op het pad. */
  splat(gx: number, gy: number): void;
}

/** Een ding in het park waar gasten iets mee doen: een versiering, een bloembak of een afvalbak. */
export interface Sight {
  /** Het ding zelf, voor het spel. */
  ref: object;
  kind: string;
  /** Waar het staat, in rastercoördinaten. */
  x: number;
  y: number;
  /** De tegels ernaast: ligt daar pad, dan kan een gast er vanaf die tegel bij. */
  tiles: number[];
  /** Hoe het gedraaid staat, in kwartslagen (voor de bankjes van de picknicktafel). */
  rot: number;
  /** Hoeveel gasten ernaartoe lopen of er al zijn, en welke plekken bezet zijn (een bit per plek). De gasten houden dit bij. */
  n: number;
  used: number;
  /** Het is weggehaald. */
  gone: boolean;
}

/**
 * Wat gasten met de dingen in het park doen. `off`: zo ver van het ding blijft de gast staan (hij stapt er van het
 * pad naartoe); `most`: zoveel gasten tegelijk; `time`: zo lang is hij bezig, in tellen; `fun`: zoveel plezier geeft
 * het; `zin`: hoe graag gasten erheen gaan (0: nooit zomaar); `roll`: kan ook vanuit een rolstoel of met een
 * kinderwagen (die blijft op het pad).
 */
export const SIGHT: Record<string, { off: number; most: number; time: number; fun: number; zin: number; roll?: boolean }> = {
  picnic: { off: 0, most: 4, time: 6, fun: 0.08, zin: 0.8 },
  pond: { off: 0.62, most: 3, time: 4.5, fun: 0.08, zin: 1.2 },
  well: { off: 0.52, most: 2, time: 4.2, fun: 0.06, zin: 1 },
  pump: { off: 0.42, most: 1, time: 4.2, fun: 0.07, zin: 1 },
  birdbath: { off: 0.6, most: 2, time: 4, fun: 0.06, zin: 0.9, roll: true },
  waterfall: { off: 0.95, most: 3, time: 4, fun: 0.07, zin: 1, roll: true },
  campfire: { off: 0.62, most: 4, time: 5, fun: 0.06, zin: 0.5 },
  statue: { off: 0.8, most: 3, time: 4.2, fun: 0.07, zin: 1, roll: true },
  totem: { off: 0.75, most: 3, time: 4.2, fun: 0.07, zin: 1, roll: true },
  clocktower: { off: 1, most: 3, time: 4.2, fun: 0.07, zin: 1, roll: true },
  windmill: { off: 1, most: 3, time: 4.2, fun: 0.07, zin: 1, roll: true },
  snowman: { off: 0.7, most: 3, time: 3.6, fun: 0.07, zin: 1, roll: true },
  scarecrow: { off: 0.7, most: 3, time: 3.6, fun: 0.07, zin: 1, roll: true },
  guestbook: { off: 0.42, most: 1, time: 4.4, fun: 0.06, zin: 1.5 },
  signpost: { off: 0.6, most: 2, time: 3.2, fun: 0.03, zin: 0.5, roll: true },
  mapboard: { off: 0.6, most: 2, time: 3.4, fun: 0.03, zin: 0.6, roll: true },
  roses: { off: 0.36, most: 2, time: 3.4, fun: 0.05, zin: 0.6 },
  tulips: { off: 0.36, most: 2, time: 3.4, fun: 0.05, zin: 0.6 },
  sunflowers: { off: 0.36, most: 2, time: 3.4, fun: 0.05, zin: 0.6 },
  flowers: { off: 0.4, most: 2, time: 3.4, fun: 0.05, zin: 0.6 },
  arch: { off: 0.05, most: 1, time: 3, fun: 0.05, zin: 0.5, roll: true },
  flag: { off: 0.7, most: 2, time: 2.8, fun: 0.03, zin: 0.25, roll: true },
  bunting: { off: 0.7, most: 2, time: 2.8, fun: 0.03, zin: 0.25, roll: true },
  bin: { off: 0.42, most: 2, time: 1.5, fun: 0.01, zin: 0 },
  // een grote hoop blaadjes in de herfst: daar springt een kind in (alleen als het spel het kind roept, zie callKid)
  leafpile: { off: 0.1, most: 1, time: 4.4, fun: 0.15, zin: 0 },
};
/** Zo vaak gaat een gast die niets dringends te doen heeft naar iets moois in de buurt, en hoe ver hij ervoor loopt (in tegels). */
const SIGHT_CHANCE = 0.4, SIGHT_NEAR = 5;
/** Meer gasten bij hetzelfde ding gaan er in een boogje omheen staan: zoveel draait elke plek (in radialen). */
const SIGHT_SPREAD = [0, 0.7, -0.7, 1.4];
/** Wat een gast bij een ding in het park doet. */
type Use = 'picnic' | 'crouch' | 'feed' | 'show' | 'well' | 'pump' | 'bird' | 'warm' | 'lookup' | 'mimic' | 'snap' | 'giggle' | 'write' | 'sign' | 'sniff' | 'arch' | 'toss'
  // in de hoop blaadjes springen, en een sneeuwballetje naar de sneeuwpop gooien
  | 'leap' | 'snowball';
/** Op welk moment van het bezoek (0 tot 1) het ding zelf even meebeweegt. */
const USE_POKE: Partial<Record<Use, number>> = { crouch: 0.5, show: 0.3, well: 0.4, bird: 0.5, warm: 0.3, giggle: 0.15, mimic: 0.2, write: 0.9, leap: 0.42, snowball: 0.62 };

// ------------------------------------------------------------ poppetje
const SKIN =[0xf6cfa6, 0xe8b48a, 0xc98d5e, 0xa86b42, 0x8a5637];
const SHIRT = [0xe0584f, 0x4a90e2, 0xf5a623, 0x6cc04a, 0xb06ad9, 0x2bb5a8, 0xf06aa6, 0xf4f1e8];
const PANTS = [0x3d4f7a, 0x5a4636, 0x38343c, 0x6b7a4a, 0x4a6fa5, 0x8a8f98, 0xc9b28a];
/** Haarkleuren; de laatste twee (grijs en wit) zijn alleen voor grote mensen. */
const HAIR = [0x2b1b14, 0x4a2f1c, 0x7a4a22, 0xa8743f, 0xd9a520, 0xd9532b, 0x9aa0a6, 0xd8dce0];
const SKIRTS = [0xe0584f, 0x4a90e2, 0xb06ad9, 0xf06aa6, 0x2bb5a8, 0x3d4f7a, 0xf5a623, 0xf4f1e8];
const SHOES = [0x38343c, 0x38343c, 0x5a4636, 0xf4f1e8, 0xe0584f, 0x4a90e2];
/** Onder een rok: blote benen (de kleur van de huid) of een maillot in een van deze kleuren. */
const TIGHTS = [0xf4f1e8, 0x38343c, 0xf06aa6];

/**
 * Eén doorsnede van een zachte vorm, van boven naar beneden: [hoogte, halve breedte, halve diepte, afgesneden hoek,
 * kleurvak, hoe ver het midden naar voren ligt]. Het kleurvak geldt voor het stuk tot de volgende doorsnede: 0 is de
 * eerste kleur, 1 de tweede, 2 een van beide (zie ToneMaterial). Zonder kleurvak heeft de vorm één kleur.
 */
type Ring = [y: number, w: number, d: number, cut: number, tone?: number, z?: number];

/**
 * Een zachte vorm van een paar doorsnedes boven elkaar, met weinig driehoeken: vier zijden, of acht als er hoeken
 * zijn afgesneden. Het licht loopt rond over de randen, zodat het geen blokje lijkt. `top` en `bottom`: met een
 * deksel en een bodem.
 */
function loft(rings: Ring[], top = true, bottom = true): THREE.BufferGeometry {
  const oct = rings.some(r => r[3] > 0), n = oct ? 8 : 4, toned = rings.some(r => r[4] !== undefined);
  const at: THREE.Vector3[] = [];
  for (const [y, w, d, c, , z = 0] of rings) {
    const around = oct ? [[w - c, d], [w, d - c], [w, c - d], [w - c, -d], [c - w, -d], [-w, c - d], [-w, d - c], [c - w, d]] : [[w, d], [w, -d], [-w, -d], [-w, d]];
    for (const [x, pz] of around) at.push(new THREE.Vector3(x, y, pz + z));
  }
  // de driehoeken: drie hoekpunten en hun kleurvak
  const tris: number[][] = [];
  for (let r = 0; r + 1 < rings.length; r++)
    for (let k = 0; k < n; k++) {
      const a = r * n + k, b = r * n + ((k + 1) % n), tone = rings[r][4] ?? 0;
      tris.push([a, a + n, b + n, tone], [a, b + n, b, tone]);
    }
  const last = (rings.length - 1) * n;
  for (let k = 1; k + 1 < n; k++) {
    if (top) tris.push([0, k, k + 1, rings[0][4] ?? 0]);
    if (bottom) tris.push([last, last + k + 1, last + k, rings[rings.length - 2][4] ?? 0]);
  }
  // per hoekpunt het gemiddelde van de vlakken eromheen: zo loopt het licht rond over de randen
  const normals = at.map(() => new THREE.Vector3()), e1 = new THREE.Vector3(), e2 = new THREE.Vector3();
  for (const [a, b, c] of tris) {
    e1.subVectors(at[b], at[a]);
    e2.subVectors(at[c], at[a]);
    e1.cross(e2);
    normals[a].add(e1);
    normals[b].add(e1);
    normals[c].add(e1);
  }
  // waar twee kleurvakken elkaar raken, staat het hoekpunt er twee keer: zo blijft de grens scherp
  const pos: number[] = [], nor: number[] = [], tones: number[] = [], index: number[] = [], ids = new Map<number, number>();
  for (const [a, b, c, tone] of tris)
    for (const v of [a, b, c]) {
      let i = ids.get(v * 4 + tone);
      if (i === undefined) {
        ids.set(v * 4 + tone, (i = tones.length));
        const m = normals[v].clone().normalize();
        pos.push(at[v].x, at[v].y, at[v].z);
        nor.push(m.x, m.y, m.z);
        tones.push(tone);
      }
      index.push(i);
    }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  if (toned) geo.setAttribute('tone', new THREE.Float32BufferAttribute(tones, 1));
  geo.setIndex(index);
  geo.computeBoundingSphere();
  return geo;
}

// De maten van het poppetje. De houdingen en alles wat een gast draagt rekenen hierop: de heup zit op 0,2 hoog, de
// schouder op 0,41 (0,13 uit het midden), de hand aan het eind van de arm (0,18 lager), het midden van het hoofd op
// 0,505 en de voorkant van het hoofd 0,085 daarvoor. Een hoedje begint op 0,62.
/** De romp: schouders die iets breder zijn dan het middel; het onderste stuk heeft de kleur van de broek of rok. */
const BODY_GEO = loft([[0.11, 0.07, 0.042, 0.02, 0], [0.085, 0.1, 0.065, 0.028, 0], [-0.05, 0.09, 0.06, 0.024, 1], [-0.11, 0.086, 0.058, 0.022]]);
/**
 * Het hoofd: iets breder dan het gezicht, met afgeronde hoeken. De voorkant is een plat vlak van 0,17 bij 0,17 op
 * 0,085 voor het midden: daar ligt het gezicht precies op (zie faces.ts).
 */
const HEAD_GEO = loft([[0.112, 0.058, 0.05, 0.02, undefined, -0.006], [0.085, 0.098, 0.0875, 0.013, undefined, -0.0025], [-0.085, 0.098, 0.0875, 0.013, undefined, -0.0025], [-0.103, 0.066, 0.058, 0.02, undefined, -0.004]]);
{
  // het licht valt op de voorkant net als op het gezicht dat ervoor zit: dan zie je geen rand om het gezicht
  const at = HEAD_GEO.getAttribute('position'), normal = HEAD_GEO.getAttribute('normal');
  for (let i = 0; i < at.count; i++) if (at.getZ(i) > 0.0849) normal.setXYZ(i, 0, 0, 1);
}
/** Het haar bovenop: een kapje dat op 0,066 boven het midden van het hoofd begint (daar ligt zijn nulpunt). */
const HAIR_GEO = loft([[0.064, 0.06, 0.052, 0.022, undefined, -0.006], [0.04, 0.104, 0.094, 0.036, undefined, -0.003], [0, 0.107, 0.0965, 0.022, undefined, -0.003]], true, false);
/** Het haar achter en opzij: een kokertje dat vanaf zijn bovenkant naar beneden hangt; langer of breder per kapsel (zie HAIRDO). */
const HAIR_BACK_GEO = loft([[0, 0.105, 0.049, 0.03], [-0.1, 0.105, 0.049, 0.03]], true, false);
/** Een rok: van het middel (het nulpunt) wijd uitlopend naar beneden. */
const SKIRT_GEO = loft([[0, 0.092, 0.062, 0.024], [-0.13, 0.118, 0.088, 0.03]], false, true);
/** Een streep om de romp: bij een werker laat hij zien wat zijn werk is, bij een gast is het een streep op het shirt. */
const STRIPE_GEO = loft([[0.025, 0.1005, 0.0665, 0.0275], [-0.025, 0.098, 0.065, 0.026]], false, false);
const CAP_GEO = new THREE.BoxGeometry(0.2, 0.06, 0.26).translate(0, 0, 0.035);
const APRON_GEO = new THREE.BoxGeometry(0.16, 0.17, 0.02);
const BALLOON_GEO = new THREE.IcosahedronGeometry(0.11, 1);
const BRIM_GEO = new THREE.CylinderGeometry(0.17, 0.17, 0.02, 10);
const CROWN_GEO = new THREE.CylinderGeometry(0.095, 0.1, 0.08, 10);
const PARTY_GEO = new THREE.ConeGeometry(0.075, 0.2, 8);
const POM_GEO = new THREE.IcosahedronGeometry(0.03, 0);
const SPIKE_GEO = new THREE.BoxGeometry(0.035, 0.05, 0.035);
const STRING_GEO = new THREE.BoxGeometry(0.012, 0.34, 0.012);
/** Een been, hangend aan de heup: de broekspijp (eerste kleur) en onderaan een schoen (tweede kleur) met de neus naar voren. */
const LEG_GEO = loft([[0, 0.0365, 0.04, 0, 0], [-0.15, 0.033, 0.036, 0, 1], [-0.166, 0.039, 0.052, 0, 1, 0.013], [-0.2, 0.04, 0.058, 0, undefined, 0.016]]);
/**
 * Een arm, hangend aan de schouder: de mouw (eerste kleur), de onderarm (bij korte mouwen de tweede kleur) en de
 * hand (tweede kleur: de huid).
 */
const ARM_GEO = loft([[0.008, 0.02, 0.026, 0, 0], [-0.015, 0.029, 0.036, 0, 0], [-0.075, 0.027, 0.033, 0, 2], [-0.14, 0.026, 0.032, 0, 1], [-0.185, 0.023, 0.029, 0]]);
// een beetje schaduw onderaan het poppetje (zie shade.ts en ToneMaterial): de benen hangen aan de heup op 0,2, de
// romp zit op 0,31 en de armen op 0,41; het hele poppetje is 0,66 hoog. Alle vormen met kleurvakken hebben hem.
for (const [geo, lift] of [[LEG_GEO, 0.2], [BODY_GEO, 0.31], [ARM_GEO, 0.41]] as const) shadeAttribute(geo, lift, 0, 0.66, PERSON_SHADE);
const mats = new Map<number, THREE.MeshStandardMaterial>();
const mat = (color: number): THREE.MeshStandardMaterial => {
  let m = mats.get(color);
  if (!m) mats.set(color, (m = new THREE.MeshStandardMaterial({ color, roughness: 0.9 })));
  return m;
};

/**
 * Een materiaal met twee kleuren, voor vormen met kleurvakken (zie Ring): vak 0 krijgt de gewone kleur, vak 1 de
 * tweede kleur, en vak 2 de tweede kleur als `alt` aan staat (korte mouwen) en anders de eerste. Zo is een arm met
 * een hand, of een been met een schoen, één onderdeel. In `tint` staan de tweede kleur en `alt` (als 0 of 1); bij
 * alle gasten samen (zie Crowd) komt dat per poppetje uit `tint2`.
 */
class ToneMaterial extends THREE.MeshStandardMaterial {
  readonly tint = { value: new THREE.Vector4() };
  /** De tweede kleur als getal, om het materiaal terug te vinden (zie `dye`). */
  second = 0;

  constructor() {
    super();
    this.roughness = 0.9;
  }

  /** Een kopie (voor het doorzichtige voorbeeld van een werker) houdt zijn tweede kleur. */
  override copy(source: THREE.MeshStandardMaterial): this {
    super.copy(source);
    if (source instanceof ToneMaterial) {
      this.tint.value.copy(source.tint.value);
      this.second = source.second;
    }
    return this;
  }

  override onBeforeCompile(shader: THREE.WebGLProgramParametersWithUniforms): void {
    shader.uniforms.tint2 = this.tint;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float tone;\nattribute float shade;\n#ifdef USE_INSTANCING\nattribute vec4 tint2;\n#else\nuniform vec4 tint2;\n#endif\nvarying vec4 vTint2;\nvarying float vShade;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTint2 = vec4( tint2.rgb, tone > 1.5 ? tint2.a : tone );\nvShade = shade;');
    // `shade`: de schaduw onderaan het poppetje (zie shadeAttribute in shade.ts)
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec4 vTint2;\nvarying float vShade;')
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = mix( diffuseColor.rgb, vTint2.rgb, vTint2.a ) * ( 1.0 - vShade );');
  }
}
const mats2 = new Map<number, ToneMaterial>();
const tintColor = new THREE.Color();
/** Het materiaal met `color` als eerste en `second` als tweede kleur. */
const mat2 = (color: number, second: number, alt = false): ToneMaterial => {
  const key = color * 0x2000000 + second * 2 + +alt;
  let m = mats2.get(key);
  if (!m) {
    mats2.set(key, (m = new ToneMaterial()));
    m.color.setHex(color);
    tintColor.setHex(second);
    m.tint.value.set(tintColor.r, tintColor.g, tintColor.b, +alt);
    m.second = second;
  }
  return m;
};
/** Geef een onderdeel een andere (eerste) kleur; wat het als tweede kleur had, houdt het. */
function dye(mesh: THREE.Mesh, color: number): void {
  const old = mesh.material as Partial<ToneMaterial>;
  mesh.material = old.tint ? mat2(color, old.second ?? 0, old.tint.value.w > 0.5) : mat(color);
}
const pick = <T>(list: T[]): T => list[Math.floor(Math.random() * list.length)];

interface Person {
  group: THREE.Group;
  limbs: THREE.Mesh[];
  height: number;
  child: boolean;
  /** Alles wat de kleur van het shirt heeft (armen en romp), om het pak een andere kleur te geven. */
  shirts: THREE.Mesh[];
  head: THREE.Mesh;
}

/** De kapsels: kort, met een scheiding, stekeltjes, een bob, lang, een staart, twee staartjes, een knot, krullen, een krans om een kale kruin, of kaal. */
type HairStyle = 'short' | 'side' | 'crew' | 'bob' | 'long' | 'tail' | 'tails' | 'bun' | 'curls' | 'ring' | 'bald';
/**
 * Waar elk kapsel uit bestaat. `top`: het kapje bovenop (HAIR_GEO), [breder, hoger]; `back`: het stuk achter en
 * opzij (HAIR_BACK_GEO), [breder, langer, dieper]; `blobs`: staarten en knotjes (bolletjes), elk [x, y, z, dik, lang].
 * De plekken zijn gemeten vanaf het midden van het hoofd.
 */
const HAIRDO: Record<HairStyle, { top?: number[]; back?: number[]; blobs?: number[][] }> = {
  short: { top: [1, 1], back: [1, 0.8, 1] },
  side: { top: [1, 1.12], back: [1, 0.8, 1] },
  crew: { top: [0.99, 0.8], back: [0.985, 0.75, 1] },
  bob: { top: [1, 1], back: [1.03, 1.7, 1.3] },
  long: { top: [1, 1], back: [1.02, 2.55, 0.85] },
  tail: { top: [1, 1], back: [1, 0.8, 1], blobs: [[0, 0.01, -0.128, 1.3, 2.4]] },
  tails: { top: [1, 1], back: [1, 0.8, 1], blobs: [[0.128, -0.005, -0.03, 1.2, 2.1], [-0.128, -0.005, -0.03, 1.2, 2.1]] },
  bun: { top: [1, 1], back: [1, 0.8, 1], blobs: [[0, 0.11, -0.07, 1.5, 1.4]] },
  curls: { top: [1.13, 1.35], back: [1.14, 1.2, 1.25] },
  ring: { back: [1, 0.62, 1] },
  bald: {},
};
/** Uit welke kapsels er gekozen wordt (wat er vaker in staat, komt vaker voor): met een baard of snor, grote mensen, wie een rok draagt, kinderen, en onder een pet. */
const HAIR_BEARD: HairStyle[] = ['short', 'short', 'short', 'side', 'side', 'side', 'crew', 'crew', 'curls', 'ring', 'bald', 'long'];
const HAIR_ADULT: HairStyle[] = ['short', 'short', 'side', 'side', 'crew', 'bob', 'bob', 'long', 'long', 'tail', 'tail', 'bun', 'curls', 'curls'];
const HAIR_SKIRT: HairStyle[] = ['bob', 'bob', 'long', 'long', 'tail', 'tail', 'bun', 'bun', 'curls', 'short'];
const HAIR_CHILD: HairStyle[] = ['short', 'short', 'short', 'side', 'side', 'crew', 'bob', 'long', 'tail', 'tails', 'curls', 'curls'];
const HAIR_GIRL: HairStyle[] = ['bob', 'long', 'tail', 'tails', 'tails', 'curls'];
const HAIR_CAPPED: HairStyle[] = ['short', 'short', 'short', 'bob', 'long', 'tail'];

/** Zet een kapsel op een hoofd. `capped`: er komt een pet op, dus alleen het haar dat eronder uitkomt. */
function addHair(head: THREE.Mesh, style: HairStyle, color: number, capped: boolean): void {
  const { top, back, blobs } = HAIRDO[style];
  if (top && !capped) {
    const cap = bit(HAIR_GEO, color, 0, 0.066, 0, top[0], top[1], top[0]);
    // een scheiding: het kapje zit een beetje scheef
    if (style === 'side') cap.rotation.z = Math.random() < 0.5 ? 0.1 : -0.1;
    head.add(cap);
  }
  // (de achterkant blijft op zijn plek, hoe diep het stuk ook is)
  if (back) head.add(bit(HAIR_BACK_GEO, color, 0, capped ? 0.09 : style === 'ring' ? 0.05 : 0.075, -0.0975 * back[0] + 0.049 * back[2], back[0], back[1], back[2]));
  for (const [x, y, z, wide, long] of blobs ?? []) head.add(bit(POM_GEO, color, x, y, z, wide, long, wide));
}

/** Hoe een poppetje eruitziet; wat hier niet in staat, wordt gegokt. */
interface PersonLook {
  hair?: HairStyle;
  /** 0 = een broek, 1 = een rok, 2 = een jurk. */
  skirt?: number;
  /** Korte mouwen, een streep op het shirt en een rugzak. */
  short?: boolean;
  stripe?: boolean;
  pack?: boolean;
}

/**
 * Een poppetje: een romp met schouders, een rond hoofd met haar, armen met handen en benen met schoenen. Een
 * verzorger draagt groen met een pet; een verkoper de kleur van zijn kraam, een pet en een wit schort (dat is dan
 * het laatste onderdeel). `solo`: het wordt los getekend en krijgt zijn eigen gezicht (zie faces.ts).
 */
function makePerson(keeper = false, outfit?: { shirt: number; hat: number }, force: { child?: boolean; shirt?: number; solo?: boolean; look?: PersonLook } = {}): Person {
  const staff = keeper || !!outfit, look = force.look ?? {};
  const child = force.child ?? (!staff && Math.random() < 0.35);
  const skin = pick(SKIN), shirt = force.shirt ?? (outfit ? outfit.shirt : keeper ? 0x4fa35a : pick(SHIRT));
  // `shadow`: de grote onderdelen geven een schaduw, het kleine spul niet
  const part = (geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, shadow = true): THREE.Mesh => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, 0);
    mesh.castShadow = shadow;
    return mesh;
  };
  const group = new THREE.Group();
  const head = part(HEAD_GEO, mat(skin), 0, 0.505);
  // een gezicht (zie faces.ts): gasten krijgen het via Crowd, een werker of verkoper wordt los getekend en heeft zijn eigen vlakje
  giveFace(head, child, staff || !!force.solo);
  // een kind heeft een groter hoofd; het gezicht en het haar groeien mee
  if (child) head.scale.setScalar(1.1);
  // wie een baard of snor heeft, krijgt haar in dezelfde kleur
  const beard = beardColor(head.userData.face as number);
  // de kleren: een broek, een rok (in een eigen kleur) of een jurk (in de kleur van het shirt)
  const skirt = look.skirt ?? (staff || beard !== null || Math.random() > 0.3 ? 0 : force.shirt === undefined && Math.random() < 0.4 ? 2 : 1);
  const bottom = skirt === 2 ? shirt : skirt ? pick(SKIRTS.filter(c => c !== shirt)) : keeper ? 0x5a4636 : pick(PANTS);
  // onder een rok: blote benen of een maillot
  const legs = !skirt ? bottom : Math.random() < 0.6 ? skin : pick(TIGHTS);
  const sleeve = mat2(shirt, skin, look.short ?? (!staff && Math.random() < 0.45)), leg = mat2(legs, staff ? 0x38343c : pick(SHOES));
  const limbs = [part(LEG_GEO, leg, 0.052, 0.2), part(LEG_GEO, leg, -0.052, 0.2), part(ARM_GEO, sleeve, 0.13, 0.41), part(ARM_GEO, sleeve, -0.13, 0.41)];
  const body = part(BODY_GEO, mat2(shirt, bottom), 0, 0.31);
  group.add(...limbs, body, head);
  if (skirt) group.add(part(SKIRT_GEO, mat(bottom), 0, 0.262, false));
  if (look.stripe ?? (!staff && !skirt && force.shirt === undefined && Math.random() < 0.14)) group.add(part(STRIPE_GEO, mat(shirt === 0xf4f1e8 ? 0xe0584f : 0xf4f1e8), 0, 0.35, false));
  const style = look.hair ?? pick(staff ? HAIR_CAPPED : beard !== null ? HAIR_BEARD : child ? (skirt ? HAIR_GIRL : HAIR_CHILD) : skirt ? HAIR_SKIRT : HAIR_ADULT);
  addHair(head, style, beard ?? pick(child ? HAIR.slice(0, 6) : HAIR), staff);
  if (look.pack ?? (!staff && style !== 'long' && Math.random() < (child ? 0.4 : 0.08))) {
    // een rugzak: een blokje op de rug met een klep in een andere kleur
    const color = pick(SHIRT.filter(c => c !== shirt));
    group.add(bit(SPIKE_GEO, color, 0, 0.325, -0.098, 4, 2.9, 1.9), bit(SPIKE_GEO, color === 0xf4f1e8 ? 0x4a90e2 : 0xf4f1e8, 0, 0.36, -0.118, 3.2, 1, 1.2));
  }
  if (staff) group.add(part(CAP_GEO, mat(outfit ? outfit.hat : 0x2f6e39), 0, 0.615));
  if (outfit) {
    const apron = part(APRON_GEO, mat(0xf7f4ec), 0, 0.29);
    apron.position.z = 0.07;
    group.add(apron);
  }
  const scale = child ? 0.72 : outfit ? 1 : 1 + Math.random() * 0.12;
  group.scale.setScalar(scale);
  return { group, limbs, height: 0.66 * scale, child, shirts: [limbs[2], limbs[3], body], head };
}

// ------------------------------------------------------------ alle gasten in een paar tekenopdrachten
/** Alle onderdelen van één vorm, van alle gasten samen. */
interface CrowdPool {
  mesh: THREE.InstancedMesh;
  n: number;
  cap: number;
  /** De tweede kleur per poppetje, bij een vorm met kleurvakken (zie ToneMaterial). */
  tint: THREE.InstancedBufferAttribute | null;
}
/** Klein spul dat geen eigen schaduw nodig heeft: dat scheelt per vorm een tekenopdracht. */
const NO_SHADOW = new Set<THREE.BufferGeometry>([HAIR_GEO, HAIR_BACK_GEO, SKIRT_GEO, STRIPE_GEO]);

/**
 * Elke gast bestaat uit een stuk of tien onderdelen. Los getekend kost dat per gast tien tekenopdrachten (en nog eens
 * zoveel voor de schaduw); bij honderd gasten hapert het spel daarvan. Daarom tekent dit alle onderdelen van dezelfde
 * vorm in één keer: de poppetjes zelf staan niet in het beeld, hun plek en kleur worden elk beeldje overgenomen.
 * Een vorm met kleurvakken (een arm met een hand, een been met een schoen) krijgt per poppetje ook zijn tweede kleur.
 */
class Crowd {
  private pools = new Map<THREE.BufferGeometry, CrowdPool>();
  private mat = new THREE.MeshStandardMaterial({ roughness: 0.9 });
  private mat2 = new ToneMaterial();
  private m = new THREE.Matrix4();
  private c = new THREE.Color();
  /** De gezichten: één vlakje voor elk hoofd dat voorbijkomt, allemaal samen in één tekenopdracht (zie faces.ts). */
  private faces: FaceCrowd | null = null;

  constructor(private scene: THREE.Scene) {}

  begin(): void {
    for (const p of this.pools.values()) p.n = 0;
    (this.faces ??= new FaceCrowd(this.scene)).begin();
  }

  add(root: THREE.Object3D): void {
    if (!root.visible) return;
    root.updateMatrixWorld(true);
    this.walk(root);
  }

  private walk(o: THREE.Object3D): void {
    if (!o.visible) return;
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh) {
      let p = this.pools.get(mesh.geometry);
      if (!p || p.n >= p.cap) p = this.grow(mesh.geometry, p);
      p.mesh.setMatrixAt(p.n, mesh.matrixWorld);
      const color = (mesh.material as THREE.MeshStandardMaterial).color;
      p.mesh.setColorAt(p.n, color);
      if (p.tint) {
        // (heeft het onderdeel een gewoon materiaal gekregen, dan is het helemaal van die ene kleur)
        const t = (mesh.material as Partial<ToneMaterial>).tint?.value;
        if (t) p.tint.setXYZW(p.n, t.x, t.y, t.z, t.w);
        else p.tint.setXYZW(p.n, color.r, color.g, color.b, 0);
      }
      p.n++;
      if (mesh.geometry === HEAD_GEO) this.faces?.add(mesh);
    }
    for (const child of o.children) this.walk(child);
  }

  /** Meer plek voor deze vorm: twee keer zoveel als eerst. */
  private grow(geo: THREE.BufferGeometry, old?: CrowdPool): CrowdPool {
    const cap = old ? old.cap * 2 : 64;
    let shape = geo, tint: THREE.InstancedBufferAttribute | null = null;
    if (geo.hasAttribute('tone')) {
      // een vorm met kleurvakken: dezelfde hoekpunten, met de tweede kleur per poppetje erbij (de vorm zelf blijft zoals hij is)
      shape = new THREE.BufferGeometry();
      for (const name of ['position', 'normal', 'tone', 'shade']) if (geo.hasAttribute(name)) shape.setAttribute(name, geo.getAttribute(name));
      shape.setIndex(geo.getIndex());
      tint = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4);
      shape.setAttribute('tint2', tint);
    }
    const mesh = new THREE.InstancedMesh(shape, tint ? this.mat2 : this.mat, cap);
    mesh.castShadow = !NO_SHADOW.has(geo);
    mesh.frustumCulled = false;
    mesh.count = 0;
    if (old) {
      for (let i = 0; i < old.n; i++) {
        old.mesh.getMatrixAt(i, this.m);
        mesh.setMatrixAt(i, this.m);
        old.mesh.getColorAt(i, this.c);
        mesh.setColorAt(i, this.c);
      }
      if (tint && old.tint) {
        (tint.array as Float32Array).set(old.tint.array);
        old.mesh.geometry.dispose();
      }
      this.scene.remove(old.mesh);
      old.mesh.dispose();
    }
    this.scene.add(mesh);
    const pool = { mesh, n: old?.n ?? 0, cap, tint };
    this.pools.set(geo, pool);
    return pool;
  }

  end(): void {
    for (const p of this.pools.values()) {
      p.mesh.count = p.n;
      p.mesh.instanceMatrix.needsUpdate = true;
      if (p.mesh.instanceColor) p.mesh.instanceColor.needsUpdate = true;
      if (p.tint) p.tint.needsUpdate = true;
    }
    this.faces?.end();
  }
}

function swing(limbs: THREE.Mesh[], amount: number): void {
  limbs[0].rotation.x = amount;
  limbs[1].rotation.x = -amount;
  limbs[2].rotation.x = -amount * 0.8;
  limbs[3].rotation.x = amount * 0.8;
}

// ------------------------------------------------------------ gast
type GuestState = 'idle' | 'walk' | 'watch' | 'buy' | 'sit' | 'accident' | 'queue' | 'use';
/** Wat een gast doet terwijl hij ergens staat. */
type Act = 'wave' | 'point' | 'photo' | 'clap' | 'pet' | 'jump' | 'peer' | 'kneel' | 'call' | 'laugh' | MoreAct;
/**
 * Houdingen bij een verblijf die erbij zijn gekomen: meedoen met een spelend dier, ssst bij een slapend dier, sip
 * kijken bij een ziek dier, op de tenen staan, door een verrekijker kijken, de neus dichtknijpen bij een vies
 * verblijf, uit de hand voeren, op de grond zitten, teleurgesteld staan (te donker) en confetti gooien.
 */
type MoreAct = 'join' | 'hush' | 'pity' | 'tiptoe' | 'scope' | 'stink' | 'feed' | 'ground' | 'gloom' | 'toss';
/**
 * Een kort gebaar dat even boven alles uit gaat: schrikken, schouders laten hangen, over de buik wrijven, de knuffel
 * knuffelen, het hoedje opzetten, opgelucht na de wc, de paraplu uitschudden, wijzen naar een ontsnapt dier, bah,
 * duizelig, een high five, een foto of handtekening bij de ster, de ballon nakijken en in een plas stampen.
 */
type Shot = 'startle' | 'slump' | 'rub' | 'hug' | 'don' | 'relief' | 'shake' | 'alarm' | 'yuck' | 'dizzy' | 'five' | 'fan' | 'lookup' | 'stomp';
/** Wat een gast in zijn hand heeft om van te eten of te drinken: zo beweegt de hand naar de mond. */
type Bite = 'lick' | 'sip' | 'bite';
/** Kleine dingen tussendoor: om je heen kijken, op je horloge kijken, je uitrekken, kletsen, een dansje. */
type Idle = 'look' | 'scratch' | 'watch' | 'stretch' | 'talk' | 'selfie' | 'dance' | 'tap' | 'nod' | 'shiver' | 'sway' | MoreIdle;
/** Kleine dingen die erbij zijn gekomen: gapen, zuchten, op de tenen kijken hoe lang de rij is, naar de regenboog wijzen, trappelen. */
type MoreIdle = 'yawn' | 'sigh' | 'peek' | 'rainbow' | 'fidget';
/** Zoveel gasten kan één kraam, wc, bankje of attractie tegelijk helpen; de rest staat in de rij. */
const AT_ONCE: Partial<Record<ShopKind, number>> = {
  toilet: 2, bench: 2, playground: 3, carousel: 4, fountain: 6, slide: 2, swing: 2, seesaw: 2, springer: 2, trampoline: 2,
  tower: 4, restaurant: 6, shelter: 6, station: 8, umbrellas: 2, show: SHOW_TIME.seats,
  // op het perron van de kabelbaan wachten er vier, elk in een hoekje; wie in een stoeltje zit, telt niet meer mee
  cablecar: 4,
};
// de attracties en speeltoestellen van rides.ts weten zelf hoeveel plekken ze hebben
for (const kind of RIDE_KINDS) AT_ONCE[kind] = RIDE_SEATS[kind];
/** De houding van een gast op een toestel: één keer gemaakt en bij elke gast opnieuw ingevuld (zie Guest.ridePlace). */
const RIDE_POSE = newPose();
/** Eerst de kant waar de gast heen kijkt, dan voorover hellen en dan opzij: zo helt hij altijd vanuit zichzelf gezien. */
const RIDE_TURN = new THREE.Euler(0, 0, 0, 'YXZ');
/** Zo lang duurt het voor een gast geholpen is. Op de tribune blijft hij zitten tot de show voorbij is. */
const SERVE_TIME: Partial<Record<ShopKind, number>> = {
  foodstall: 6, drinkstall: 6, icecream: 6, balloon: 4, hats: 4, souvenir: 4, toilet: 9, bench: 8, playground: 6, carousel: 8, fountain: 4, slide: 6, swing: 7, seesaw: 7, springer: 6, trampoline: 6,
  tower: 9, restaurant: 11, ferris: 14, bumper: 10, shelter: 4, station: 4, umbrellas: 2, show: 4, cablecar: 4, facepaint: 7,
};
const WC_TIME = SERVE_TIME.toilet ?? 9, BENCH_TIME = SERVE_TIME.bench ?? 8;
/**
 * Het bezoek aan de wc. `walk`: zo lang loopt de gast naar zijn deur; `step`: zo lang duurt de stap naar binnen
 * of naar buiten; `back`: zo lang loopt hij daarna terug naar het pad. `door`: zo ver zit een deur uit het
 * midden van het gebouw; `front`: zo ver voor het midden staat de gast voor de deur; `deep`: zo ver binnen.
 */
const WC = { walk: 1.1, step: 0.9, back: 1.1, door: 0.42, front: 1.18, deep: 0.15 };
/** Zo ver (in tegels) loopt een gast hooguit om voor een bankje om even uit te rusten. */
const REST_NEAR = 8;
/** Wie dit wil, gaat niet eerst nog even op een bankje zitten. */
const PRESSING: Need[] = ['toilet', 'food', 'drink', 'umbrella', 'shelter', 'sit'];
/**
 * De weg kwijt (buiten het bereik van elk bord). `chance`: zo vaak gebeurt het, per keer dat een gast kiest waar hij
 * heen gaat; `time`: zo lang zoekt hij (kortste en langste, in tellen); `fun`: zoveel plezier kost het; `rest`: zo lang
 * daarna gebeurt het hem niet nog eens; `most` en `share`: zoveel gasten zijn hooguit tegelijk de weg kwijt (een vast
 * aantal, of in een vol park dit deel van alle gasten). `doubt` en `pause`: zo vaak en zo lang twijfelt de juf.
 */
const STRAY = { chance: 0.07, time: [10, 15], fun: 0.04, rest: 70, most: 3, share: 0.06, doubt: 0.3, pause: [3, 5] };
/** Zoveel gasten mogen er nu nog de weg kwijtraken: de GuestManager telt het elk beeldje opnieuw. */
let strayRoom = 0;
/** Waar een gast op de wc nu staat, welke kant hij op gaat en de plek voor zijn deur; elke keer opnieuw ingevuld door `wcPose`. */
const WC_AT = { x: 0, y: 0, dx: 0, dy: 0, fx: 0, fy: 0, hidden: false, moving: false };
/** Waar een gast op of in gaat zitten of staan (in plaats van iets te kopen aan een toonbank). */
const SEATED: ShopKind[] = ['bench', ...PLAY, ...LOOKS, ...RIDES, 'restaurant', 'shelter', 'show'];
/**
 * Wie wil spelen, vindt elk speeltoestel goed; wie een ritje wil, elke attractie; wie iets moois wil zien de
 * fontein of de uitkijktoren; en in het restaurant kun je eten én drinken.
 */
const sameUse = (have: ShopKind, want: ShopKind): boolean =>
  have === want || (want === 'playground' && PLAY.includes(have)) || (want === 'carousel' && RIDES.includes(have)) || (want === 'fountain' && LOOKS.includes(have)) ||
  ((want === 'foodstall' || want === 'drinkstall') && have === 'restaurant');
/** Langer is de rij nooit; wie er dan bij wil, loopt mopperend door. Zo lang wacht een gast hooguit. */
const MAX_QUEUE = 6;
const PATIENCE = 32;
const MAX_PURCHASES = 4;
const NEED_SHOP: Record<Need, ShopKind> = {
  food: 'foodstall', drink: 'drinkstall', toilet: 'toilet', icecream: 'icecream', balloon: 'balloon', hat: 'hats', souvenir: 'souvenir', play: 'playground', sit: 'bench', look: 'fountain', ride: 'carousel',
  umbrella: 'umbrellas', shelter: 'shelter', pet: 'bench', paint: 'facepaint',
};
// rolstoel, kinderwagen, paraplu en zonnebril: van blokjes, net als de gasten zelf
const WHEEL_GEO = new THREE.CylinderGeometry(0.15, 0.15, 0.03, 12).rotateZ(Math.PI / 2);
const SMALL_WHEEL_GEO = new THREE.CylinderGeometry(0.05, 0.05, 0.03, 8).rotateZ(Math.PI / 2);
const CHAIR_BACK_GEO = new THREE.BoxGeometry(0.26, 0.3, 0.04);
const CHAIR_SEAT_GEO = new THREE.BoxGeometry(0.26, 0.04, 0.24);
const PRAM_GEO = new THREE.BoxGeometry(0.22, 0.14, 0.32);
const PRAM_HOOD_GEO = new THREE.BoxGeometry(0.22, 0.16, 0.14);
const PRAM_BAR_GEO = new THREE.BoxGeometry(0.2, 0.025, 0.025);
const BROLLY_GEO = new THREE.ConeGeometry(0.34, 0.14, 8);
const BROLLY_STICK_GEO = new THREE.BoxGeometry(0.02, 0.42, 0.02);
const SHADES_GEO = new THREE.BoxGeometry(0.19, 0.05, 0.03);
const BROLLY_COLORS = [0xe0584f, 0x4a90e2, 0xffd23f, 0x6cc04a, 0xa06ad9, 0xf06aa6];
const COLOR_OF = Object.fromEntries(PRODUCTS.filter(p => p.color !== undefined).map(p => [p.id, p.color as number]));
const SNACK_GEO = new THREE.BoxGeometry(0.06, 0.08, 0.06).translate(0, -0.2, 0.04);
/** Wat de dieren doen waar een gast naar kijkt (zie `penMood`): een bit per ding. */
export const PEN = { asleep: 1, playing: 2, sick: 4, dirty: 8, scare: 16 };
/** Waar een ontsnapt dier loopt: elke keer opnieuw ingevuld door `looseNear`. */
const LOOSE_AT: [number, number] = [0, 0];
/** De beroemde gast, als die in het park is, en waar de locomotief van het treintje rijdt (de GuestManager en het treintje vullen dit in). */
let theStar: Guest | null = null;
const TRAIN_AT = { x: 0, y: 0, on: false };
/** Een klok voor alle gasten samen, en wie het laatst uit een attractie stapte: stapt er meteen nog iemand uit, dan geven ze een high five. */
let crowdClock = 0;
let offRide: Guest | null = null, offRideAt = -9;
/** Zo lang duren de korte gebaren, in tellen. */
const SHOT_TIME: Record<Shot, number> = { startle: 1.1, slump: 1.8, rub: 1.6, hug: 1.7, don: 1.3, relief: 1.9, shake: 1.5, alarm: 2.2, yuck: 1.3, dizzy: 1.8, five: 1.3, fan: 2.2, lookup: 3, stomp: 1.5 };
/**
 * Het geluidje bij een kort gebaar, een houding bij een verblijf, iets kleins tussendoor of een ding in het park:
 * [welk geluid, na hoeveel tellen]. Bij de dingen in het park is het tweede getal het deel van het bezoek (0 tot 1).
 * Elk klinkt één keer per gebaar.
 */
const SHOT_SOUND: Partial<Record<Shot, [GuestCue, number]>> = {
  startle: ['guest.uhoh', 0.05], alarm: ['guest.uhoh', 0.1], slump: ['guest.aww', 0.5], lookup: ['guest.aww', 0.45], rub: ['guest.aah', 0.3],
  relief: ['guest.phew', 0.15], shake: ['park.brolly', 0.2], yuck: ['guest.yuck', 0.15], dizzy: ['guest.dizzy', 0.2], five: ['guest.five', 0.55], stomp: ['park.splash', 0.1],
};
const ACT_SOUND: Partial<Record<Act, [GuestCue, number]>> = { hush: ['guest.shh', 0.4], stink: ['guest.yuck', 0.5], pity: ['guest.aww', 0.6] };
const IDLE_SOUND: Partial<Record<Idle, [GuestCue, number]>> = { yawn: ['guest.yawn', 0.3], sigh: ['guest.sigh', 0.5] };
const USE_SOUND: Partial<Record<Use, [GuestCue, number]>> = {
  sniff: ['guest.sniff', 0.35], well: ['guest.echo', 0.52], write: ['park.scribble', 0.08], mimic: ['guest.laugh', 0.8], picnic: ['guest.chat', 0.3],
};
const SCOOPS = [0xffc1d6, 0xfff1c9, 0x8a5637, 0xb6e3c0];
const PLUSH_COLORS = [0xc98d5e, 0xf4f1e8, 0xf5a623, 0x9aa0a6, 0xf48fb1, 0x8a5637, 0xffd23f];
/** Waar de knuffel zit: onder de arm, en tegen de borst bij het knuffelen. */
const PLUSH_REST = [-0.19, 0.31, 0.075], PLUSH_HUG = [0, 0.37, 0.11];
/** Waar een losse ballon nu is (zie looseBalloon): steeds hetzelfde object. */
const LOOSE_BALLOON = new THREE.Vector3();
/** Waar de hand het touwtje van de ballon vasthoudt: daar draait de ballon omheen als hij wiebelt. */
const BALLOON_AT = [0.185, 0.27, 0.11];
/** Uit welke kleine dingen een gast kiest als hij even stilstaat: het hangt af van de regen, de rij, de nacht en de regenboog. */
const IDLES: Record<'wet' | 'queue' | 'queueLong' | 'queueChild' | 'child' | 'adult' | 'rainbow' | 'night', Idle[]> = {
  wet: ['shiver'],
  queue: ['tap', 'watch', 'look', 'sway'],
  queueLong: ['tap', 'watch', 'sigh', 'peek', 'sigh', 'peek', 'look'],
  queueChild: ['fidget', 'fidget', 'peek', 'look', 'sway'],
  child: ['look', 'dance', 'scratch', 'sway', 'stretch'],
  adult: ['look', 'scratch', 'watch', 'stretch', 'selfie', 'nod', 'sway'],
  rainbow: ['rainbow', 'rainbow', 'look'],
  night: ['yawn', 'yawn', 'look', 'stretch', 'sway'],
};
const smooth = (a: number, b: number, v: number): number => {
  const k = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return k * k * (3 - 2 * k);
};

/** Een los onderdeel van iets wat een gast draagt: een van de vormen die er al zijn, verschaald en gekleurd. Zo komt er geen tekenopdracht bij. */
function bit(geo: THREE.BufferGeometry, color: number, x: number, y: number, z: number, sx: number, sy = sx, sz = sx): THREE.Mesh {
  const mesh = new THREE.Mesh(geo, mat(color));
  mesh.position.set(x, y, z);
  mesh.scale.set(sx, sy, sz);
  return mesh;
}

/**
 * Wat een gast in zijn hand heeft na de kraam: een hoorntje met een bol, een waterijsje, een beker met een rietje,
 * een puntzak friet, een stapel pannenkoeken of een broodje. Het staat rechtop als de arm naar voren steekt.
 */
function makeTreat(kind: ShopKind, product: string | undefined): THREE.Group {
  const g = new THREE.Group();
  g.position.set(0, -0.19, 0.03);
  g.rotation.x = Math.PI / 2;
  if (kind === 'icecream' && product === 'lolly') {
    g.add(bit(STRING_GEO, 0xe9d5a8, 0, 0.03, 0, 1.6, 0.2, 1.6), bit(SPIKE_GEO, pick([0xe0584f, 0xf5a623, 0x4a90e2]), 0, 0.1, 0, 1.3, 1.8, 0.8));
  } else if (kind === 'icecream') {
    const cone = bit(PARTY_GEO, 0xe3b06a, 0, 0.042, 0, 0.42);
    cone.rotation.z = Math.PI; // de punt naar beneden
    g.add(cone, bit(POM_GEO, pick(SCOOPS), 0, 0.105, 0, 1.5));
  } else if (kind === 'drinkstall') {
    const straw = bit(STRING_GEO, 0xe0584f, 0.012, 0.11, 0, 1.6, 0.2, 1.6);
    straw.rotation.z = -0.3;
    g.add(bit(CROWN_GEO, product === 'milk' ? 0xf7f4ec : product === 'juice' ? 0xff9a3c : 0xffe45c, 0, 0.045, 0, 0.36, 1.1, 0.36), straw);
  } else if (product === 'pancake') {
    g.add(bit(BRIM_GEO, 0xe9b872, 0, 0.02, 0, 0.3, 1.5, 0.3), bit(BRIM_GEO, 0xe9b872, 0, 0.052, 0, 0.28, 1.5, 0.28), bit(BRIM_GEO, 0x8a5637, 0, 0.074, 0, 0.16, 0.8, 0.16));
  } else if (product === 'hotdog') {
    g.add(bit(SPIKE_GEO, 0xd9a05b, 0, 0.03, 0, 2.6, 0.9, 1.1), bit(SPIKE_GEO, 0xb5483a, 0, 0.052, 0, 3, 0.45, 0.6));
  } else {
    // een puntzak friet
    g.add(bit(SPIKE_GEO, 0xe0584f, 0, 0.04, 0, 1.7, 1.5, 1.1), bit(SPIKE_GEO, 0xffd23f, -0.014, 0.088, 0, 0.6, 0.9, 0.7), bit(SPIKE_GEO, 0xffd23f, 0.014, 0.08, 0, 0.6, 0.6, 0.7));
  }
  return g;
}

/** De knuffel uit de knuffelkraam: een lijfje, een kop en twee oortjes. Elke soort heeft zijn eigen kleur. */
function makePlush(product: string | undefined): THREE.Group {
  let n = 0;
  for (let i = 0; product && i < product.length; i++) n += product.charCodeAt(i);
  const color = PLUSH_COLORS[n % PLUSH_COLORS.length];
  const g = new THREE.Group();
  g.add(bit(BALLOON_GEO, color, 0, 0, 0, 0.5, 0.58, 0.45), bit(POM_GEO, color, 0, 0.075, 0.025, 1.5), bit(SPIKE_GEO, color, 0.03, 0.115, 0.02, 0.5), bit(SPIKE_GEO, color, -0.03, 0.115, 0.02, 0.5));
  g.position.set(PLUSH_REST[0], PLUSH_REST[1], PLUSH_REST[2]);
  return g;
}

/** Een hoedje uit de hoedenkraam: een petje, een strohoed, een feestmuts of een kroon. Het zit op het haar: vanaf 0,62 hoog. */
function makeHat(product: string): THREE.Group {
  const color = mat(COLOR_OF[product] ?? 0xe0584f);
  const hat = new THREE.Group();
  const add = (geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z = 0): void => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    hat.add(mesh);
  };
  if (product === 'hat_straw') {
    add(BRIM_GEO, color, 0, 0.65);
    add(CROWN_GEO, color, 0, 0.7);
  } else if (product === 'hat_party') {
    add(PARTY_GEO, color, 0, 0.74);
    add(POM_GEO, mat(0xffd23f), 0, 0.85);
  } else if (product === 'hat_crown') {
    add(CROWN_GEO, color, 0, 0.68);
    for (const [x, z] of [[0.07, 0], [-0.07, 0], [0, 0.07], [0, -0.07]]) add(SPIKE_GEO, color, x, 0.74, z);
  } else add(CAP_GEO, color, 0, 0.65);
  return hat;
}

/**
 * Wat de loper in de loopstand in zijn hand heeft (zie walkhand.ts): hetzelfde lekkers, dezelfde knuffel en hoed als
 * een gast, en een ballon aan een touwtje. Het staat rechtop, met de onderkant (waar je het vasthoudt) op 0.
 */
export function makeHeld(kind: ShopKind, product: string): THREE.Group {
  const g = new THREE.Group();
  let thing: THREE.Object3D;
  if (kind === 'balloon') {
    // de ballon zweeft boven je hand, het touwtje hangt eronder
    thing = new THREE.Group();
    const balloon = new THREE.Mesh(BALLOON_GEO, mat(COLOR_OF[product] ?? 0xe0584f));
    if (product === 'balloon_heart') balloon.scale.set(1.5, 1.25, 0.8);
    balloon.position.set(0, 0.68, 0);
    const string = new THREE.Mesh(STRING_GEO, mat(0xf4f1e8));
    string.position.set(0, 0.31, 0);
    string.scale.y = 1.8;
    thing.add(balloon, string);
  } else if (kind === 'hats') {
    // een hoed zit bij een gast op 0,65 hoog: hier op de hand
    thing = makeHat(product);
    thing.position.y = -0.63;
  } else if (kind === 'souvenir') {
    thing = makePlush(product);
    thing.position.set(0, 0.04, 0);
  } else {
    thing = makeTreat(kind, product);
    thing.position.set(0, 0, 0);
    thing.rotation.set(0, 0, 0);
  }
  g.add(thing);
  g.traverse(o => {
    o.castShadow = false;
    o.receiveShadow = false;
  });
  return g;
}

// ------------------------------------------------------------ schmink uit de schminktent
/**
 * Eén stukje schmink op het hoofd: [kleur, x, y, z, breed, hoog, diep, draaiing, vorm]. Het voorvlak van het hoofd
 * ligt op z = 0,085 en loopt van -0,085 tot 0,085; de ogen zitten net boven het midden, de mond eronder. De stukjes
 * zitten daar waar geen ogen of mond zijn: op het voorhoofd, de wangen, opzij en bovenop.
 */
type PaintBit = [color: number, x: number, y: number, z: number, w: number, h: number, d: number, turn?: number, shape?: 'box' | 'cone' | 'ball'];
const PAINT_INK = 0x2a1c16, PAINT_Z = 0.0878, PAINT_THIN = 0.003;
const onFace = (color: number, x: number, y: number, w: number, h: number, turn = 0): PaintBit => [color, x, y, PAINT_Z, w, h, PAINT_THIN, turn];
/** Hetzelfde stukje links en rechts, gespiegeld. */
const twice = (color: number, x: number, y: number, w: number, h: number, turn = 0): PaintBit[] => [onFace(color, x, y, w, h, turn), onFace(color, -x, y, w, h, -turn)];
/** De kleur van het hele gezicht (de tijger oranje, de panda wit). Zonder kleur blijft de huid. */
const PAINT_BASE: Partial<Record<FacePaint, number>> = { tiger: 0xf3a23c, panda: 0xf7f4ef };
const PAINT_BITS: Record<FacePaint, PaintBit[]> = {
  // tijger: strepen op het voorhoofd, de wangen en opzij
  tiger: [
    onFace(PAINT_INK, -0.03, 0.068, 0.009, 0.028), onFace(PAINT_INK, 0, 0.071, 0.01, 0.024), onFace(PAINT_INK, 0.03, 0.068, 0.009, 0.028),
    ...twice(PAINT_INK, 0.072, -0.014, 0.028, 0.007, 0.15), ...twice(PAINT_INK, 0.072, -0.036, 0.028, 0.007, -0.1),
    ...[0.03, -0.02].flatMap((y): PaintBit[] => [[PAINT_INK, 0.0995, y, 0.01, PAINT_THIN, 0.009, 0.05], [PAINT_INK, -0.0995, y, 0.01, PAINT_THIN, 0.009, 0.05]]),
  ],
  // poes: een roze neusje, snorharen en twee puntoortjes bovenop
  cat: [
    onFace(0xf06aa6, 0, -0.014, 0.017, 0.012),
    ...twice(PAINT_INK, 0.084, -0.02, 0.064, 0.0045, 0.14), ...twice(PAINT_INK, 0.084, -0.031, 0.064, 0.0045, -0.05),
    [0x5a5560, 0.058, 0.14, 0.005, 0.05, 0.06, 0.05, -0.35, 'cone'], [0x5a5560, -0.058, 0.14, 0.005, 0.05, 0.06, 0.05, 0.35, 'cone'],
  ],
  // vlinder: een vlinder op het voorhoofd en stippen op de wangen
  butterfly: [
    ...twice(0xa06ad9, 0.026, 0.066, 0.03, 0.026, 0.45), ...twice(0xf06aa6, 0.019, 0.047, 0.02, 0.016, -0.4),
    onFace(PAINT_INK, 0, 0.058, 0.006, 0.034), ...twice(PAINT_INK, 0.009, 0.08, 0.003, 0.014, 0.5),
    ...twice(0x4a90e2, 0.07, -0.03, 0.014, 0.014, 0.78), ...twice(0xffd23f, 0.062, -0.052, 0.01, 0.01, 0.78),
  ],
  // panda: zwarte oren, zwarte vlekken naast de ogen en een zwart neusje
  panda: [
    [PAINT_INK, 0.076, 0.11, -0.01, 0.075, 0.075, 0.06, 0, 'ball'], [PAINT_INK, -0.076, 0.11, -0.01, 0.075, 0.075, 0.06, 0, 'ball'],
    ...twice(PAINT_INK, 0.067, 0.004, 0.022, 0.036, 0.25), onFace(PAINT_INK, 0, -0.016, 0.018, 0.012),
  ],
};
/** Maak één stukje schmink. De vormen zijn die van de rest van de poppetjes: zo kost het geen extra tekenwerk. */
function paintBit([color, x, y, z, w, h, d, turn = 0, shape = 'box']: PaintBit): THREE.Mesh {
  const [geo, bw, bh, bd]: [THREE.BufferGeometry, number, number, number] = shape === 'cone' ? [PARTY_GEO, 0.15, 0.2, 0.15] : shape === 'ball' ? [POM_GEO, 0.06, 0.06, 0.06] : [SPIKE_GEO, 0.035, 0.05, 0.035];
  const mesh = bit(geo, color, x, y, z, w / bw, h / bh, d / bd);
  mesh.rotation.z = turn;
  return mesh;
}

/** De verrekijker: twee kokertjes voor de ogen. Hij zit aan het hoofd en is alleen te zien als de gast erdoor kijkt. */
function makeScope(): THREE.Group {
  const g = new THREE.Group();
  g.add(bit(SPIKE_GEO, 0x38343c, 0.042, 0.01, 0.12, 1, 0.85, 2.2), bit(SPIKE_GEO, 0x38343c, -0.042, 0.01, 0.12, 1, 0.85, 2.2));
  g.visible = false;
  return g;
}
/**
 * De tegel op het pad waar je bij een gebouw geholpen wordt: de bereikbare tegel het dichtst bij de voorkant.
 * Alle gasten gaan naar dezelfde plek, zodat er één rij ontstaat.
 */
function doorOf(w: GuestWorld, reach: Set<number>, shop: ShopSpot): number | null {
  const turn = ((shop.rot ?? 0) * Math.PI) / 2;
  const [cx, cy] = shopCenter(shop);
  // zo diep is het gebouw gezien vanaf zijn voorkant: een marktkraam is maar één tegel diep
  const deep = shopTiles(shop)[(shop.rot ?? 0) % 2 ? 0 : 1];
  const fx = cx + Math.sin(turn) * (deep / 2 + 0.5), fy = cy + Math.cos(turn) * (deep / 2 + 0.5);
  let best: number | null = null, bestD = Infinity;
  const own = footprint(shop);
  for (const t of own)
    for (const n of w.grid.neighbors(t)) {
      if (!reach.has(n) || own.includes(n)) continue;
      const [x, y] = tileXY(n);
      const d = Math.hypot(x + 0.5 - fx, y + 0.5 - fy);
      if (d < bestD) {
        bestD = d;
        best = n;
      }
    }
  return best;
}

const footprint = (shop: ShopSpot): number[] => {
  const tiles: number[] = [];
  const [wide, tall] = shopTiles(shop);
  for (let y = shop.y; y < shop.y + tall; y++) for (let x = shop.x; x < shop.x + wide; x++) tiles.push(tileIndex(x, y));
  return tiles;
};

/** Hoe een gast eruitziet als hij binnenkomt. */
export interface GuestOptions {
  child?: boolean;
  shirt?: number;
  /** In een rolstoel, of met een kinderwagen: die hebben een breed pad nodig. */
  wheels?: 'chair' | 'pram';
  /** De beroemde gast: gouden shirt en een zonnebril. */
  star?: boolean;
}

export class Guest implements Leader {
  readonly mesh: THREE.Group;
  readonly height: number;
  readonly child: boolean;
  readonly wheels: 'chair' | 'pram' | null;
  readonly star: boolean;
  /** Een vast getal voor het kaartje van deze gast: zijn naam en zijn weetjes (zie traits.ts). */
  readonly seed = Math.floor(Math.random() * 0x7fffffff);
  /** Voor een passende naam: een baard of snor is een man, een rok of jurk een vrouw; anders mag alles. */
  readonly sex: 'm' | 'f' | null;
  gx: number;
  gy: number;
  hunger = Math.random() * 0.3;
  thirst = Math.random() * 0.3;
  /** Moet de gast naar de wc? Bij 1 is de nood hoog; duurt dat te lang, dan doet hij het op het pad. */
  bladder = Math.random() * 0.3;
  /** Zoveel seconden is de nood al hoog. */
  private urgent = 0;
  /** Zin in een ijsje. */
  treat = Math.random() * 0.4;
  /** Zin in een ballon (vooral kinderen). */
  balloon = 0;
  /** Zin in een hoedje. */
  hat = Math.random() * 0.4;
  tired = Math.random() * 0.2;
  /** Zin in een knuffel uit de knuffelkraam. */
  gift = Math.random() * 0.6;
  /** Zin om te spelen in de speeltuin (alleen kinderen). */
  playful = Math.random() * 0.4;
  /** Zin om bij de fontein te gaan kijken. */
  curious = Math.random() * 0.5;
  /** Zin in een rondje draaimolen (kinderen het meest). */
  rideWish = Math.random() * 0.5;
  /** Zin om dieren te aaien in de kinderboerderij (kinderen het meest). */
  petWish = Math.random() * 0.5;
  /** Zin in schmink uit de schminktent (alleen kinderen), en het dierengezicht dat het kind al kreeg. */
  paintWish = Math.random() * 0.4;
  painted: FacePaint | null = null;
  /** Op welk paardje, zitje of plekje de gast zit. */
  seat = Math.floor(Math.random() * 4);
  /** Plezier van 0 tot 1. Een gast koopt alleen iets als hij het naar zijn zin heeft. */
  fun = 0.5;
  /** Het dier dat deze gast het liefst wil zien. */
  fav: string | null = null;
  favSeen = false;
  /** Wat de gast nu wil, voor het wolkje boven zijn hoofd. */
  wish: GuestWish | null = null;
  /** Een vast plaatje boven een bijzondere gast: 'celeb', 'lost', 'seek', 'cake' of 'schoolclass'. */
  badge: string | null = null;
  gone = false;
  /** Heeft de speler al naar deze gast gezwaaid? En wanneer het laatst (in de leeftijd van de gast)? */
  waved = false;
  private wavedAt: number | null = null;
  // ---- momentjes met kinderen waar de speler bij helpt (zie kids.ts)
  /** Het kind vraagt om hulp: een nieuw ijsje (het eerste viel op de grond) of een muntje (het geld is op). */
  ask: 'icecream' | 'coin' | null = null;
  private askT = 0;
  /** Waar het kind een muntje voor wil hebben: een ijsje, een ballon, een hoedje of een knuffel. */
  askFor: Need | null = null;
  /** Het kind kreeg een muntje van de speler: bij de volgende aankoop is het extra blij. */
  private gifted = false;
  /** Bij het weggaan tekent het kind een hartje in het gastenboek (voor het muntje). */
  owesHeart = false;
  /** De losse ballon: welke het was, en zoveel tellen zweeft hij al terug naar de hand (-1: niet). */
  private flownKind: string | null = null;
  private homing = -1;
  private homeFrom = new THREE.Vector3();
  /** Heeft de gast een paraplu? Die gaat open als het regent. */
  umbrella = false;
  /** Heeft de gast op de plattegrond gekeken? Dan vindt hij zijn lievelingsdier meteen. */
  knows = false;
  /** Achter wie de gast aan loopt (de juf, de jarige, de gids of papa en mama), en op welke plek in de rij. */
  leader: Leader | null = null;
  rank = 0;
  trail: [number, number][] = [];
  private leading = false;
  /** Een rondje langs de dieren (de juf met haar klas, de jarige): nog zoveel keer stoppen, en eerst naar het feest. */
  tour: { stops: number; party?: boolean } | null = null;
  /** Het avondfeest: het rondje door het park (padtegels voor de verblijven) en de plek waar de gast nu is. */
  private partyRound: { loop: number[]; i: number } | null = null;
  /** De speler heeft de weg gewezen: bij de volgende stop van het rondje loopt het groepje eerst naar deze padtegel. */
  sendTo?: number;
  private partyShop: ShopSpot | null = null;
  /** Op de tribune: hoe ver de show is (zie showLive). Bij de kunstjes klapt en juicht de gast. */
  private showMood = 0;
  /** Heeft de gast al een show gezien? Dan komt hij niet nog eens. */
  sawShow = false;
  /** Een verdwaald kind staat te huilen tot de speler erop tikt; dan rent het naar `seeker`. */
  lost = false;
  private seeker: Guest | null = null;
  private found = false;
  private helped = false;
  private lostFor = 0;
  /** De weg kwijt: zoveel tellen zoekt de gast nog, met een vraagteken boven zijn hoofd (0: hij weet de weg). */
  astray = 0;
  /** Tot deze leeftijd raakt de gast niet nog eens de weg kwijt; en of de juf bij deze stop al getwijfeld heeft. */
  private strayFree = 0;
  private doubted = false;
  /** In het treintje, of in een stoeltje van de kabelbaan. */
  riding: Train | CableCar | null = null;
  /**
   * In de kabelbaan: op welke plek (twee per stoeltje), hoe hoog de gast nu zit, welke soorten hij al onder zich zag
   * en hoe lang hij nog naar beneden wijst.
   */
  liftSeat = 0;
  air = 0;
  private airSeen: string[] = [];
  private peek = 0;
  private rode = false;
  private waitT = 0;
  /** In de kinderboerderij: 1 = op weg naar het poortje, 2 = naar binnen, 3 = aan het aaien, 4 = weer naar buiten. */
  private pen: PetSpot | null = null;
  private penPhase = 0;
  inside = false;
  /**
   * Buiten de poort, op de stoep: de punten die de gast nog af moet lopen (in tegels, buiten het raster). `out`: hij
   * gaat naar huis en is aan het eind weg; anders komt hij aan en eindigt hij op de tegel van de ingang.
   */
  private walkway: { pts: [number, number][]; out: boolean } | null = null;
  /** Hoe groot het poppetje is, en hoe ver het is met tevoorschijn komen (0 tot 1) als het buiten de poort begint. */
  private size = 1;
  private sprout = 1;
  private rainAsk = 0;
  private rainAlt = false;
  private bought: Partial<Record<ShopKind, number>> = {};
  /** Waar de gast precies om vraagt, per behoefte: 'lolly', 'cap_red', 'plush_pig', ... */
  private wanted: Partial<Record<Need, string>> = {};
  /** Behoeftes waarvoor de gast al tevergeefs heeft gezocht: dan neemt hij ook iets anders. */
  private settled = new Set<Need>();
  /** De boodschap waarvoor de gast nu onderweg is. */
  private errand: Need | null = null;

  private limbs: THREE.Mesh[];
  private head: THREE.Mesh;
  private state: GuestState = 'idle';
  private timer = 0.3;
  private age = 0;
  private stay = 90 + Math.random() * 80;
  private route: number[] = [];
  private heading = Math.PI;
  private phase = Math.random() * 6;
  private shop: ShopSpot | null = null;
  private gain = 0;
  private sees: string[] = [];
  face: [number, number] | null = null;
  private seen: number[] = [];
  private leaving = false;
  /** Zoveel seconden loopt de gast nog met afval in zijn hand. */
  private trash = 0;
  /** Deze gast let niet op en laat zijn afval vallen, ook als er een bak staat. */
  private sloppy = false;
  /** Een gast koopt per bezoek hooguit zoveel dingen; zo stroomt de kas niet over. */
  private purchases = 0;
  private wantsBalloon: boolean;
  private wantsHat: boolean;
  private headwear: THREE.Object3D | null = null;
  private brolly: THREE.Group | null = null;
  /** Wat de gast doet terwijl hij kijkt: zwaaien, wijzen, een foto maken, klappen, aaien, springen. */
  private act: Act | null = null;
  private actT = 0;
  /** Iets kleins tussendoor (om je heen kijken, je uitrekken, een dansje), en hoe lang het duurt tot het volgende. */
  private idle: { kind: Idle; t: number; dur: number } | null = null;
  private idleIn = 1.5 + Math.random() * 4;
  /** Zoveel tellen eet of drinkt de gast nog van wat hij net kocht; het zit in zijn hand. */
  private eating = 0;
  private snack: THREE.Object3D | null = null;
  /** Zoveel tellen springt de gast nog van blijdschap. */
  joy = 0;
  /** Zoveel tellen zwaait de gast nog (naar de speler, of bij het weggaan). */
  hello = 0;
  /** Zoveel tellen moppert de gast nog: armen in de zij en hoofdschudden. */
  private moan = 0;
  private hop = 0;
  /** Zoveel tellen rent een blij kind nog. */
  private dash = 0;
  /** Hoe de gast voorover leunt, opzij helt en om zijn as draait (bovenop het lopen). */
  private lean = 0;
  private tilt = 0;
  private twist = 0;
  /** In de rij: hoe lang de gast al wacht, wanneer hij aansloot en waar zijn plek in de rij is. */
  waited = 0;
  joined = 0;
  slot: [number, number] | null = null;
  /** De tegel voor de kraam waar de gast in de rij ging staan (-1: hij staat niet in de rij). Daar begint de rij. */
  gate = -1;
  /** Zet de gast nu een paar passen (opschuiven in de rij, naar de wc-deur)? Dan bewegen zijn benen mee. */
  private stepping = false;
  /** Op de wc: 0 = nog buiten, 1 = binnen, 2 = het geluidje is geweest, 3 = doorgetrokken. */
  private wc = 0;
  /** Op de wc: zoveel tellen heeft de gast aan het eind nog over als hij weer voor de deur staat. */
  private wcTail = 0;
  /** De gast gaat alleen even zitten als er plek is; is het bankje vol, dan loopt hij gewoon door. */
  private easy = false;
  /** Wat de gast draagt, om te kunnen bewaren. */
  private wornHat: string | null = null;
  private wornBalloon: string | null = null;
  private mess: 'poop' | 'pee' = 'pee';
  // ---- extra houdingen en dingen in de hand (zie `extras`, `overlay`, `poseAct` en `poseIdle`)
  /** Een kort gebaar dat even boven alles uit gaat (schrikken, bah, opgelucht, ...) en hoe ver het is. */
  private shot: Shot | null = null;
  private shotT = 0;
  /**
   * Het geluidje dat bij het volgende beeldje klinkt (zie `update`), en wat er nodig is om het maar één keer te laten
   * horen: hoe ver de hap of slok was, hoe ver het speeltoestel was, en of het geluid bij een ding in het park al klonk.
   */
  private cue: GuestCue | null = null;
  private chewC = 0;
  private rideMark = 0;
  /** Het bezoek aan een attractie of speeltoestel (zie rides.ts): op welk zitje, en hoe lang elk stuk duurt. */
  private onRide: Visit | null = null;
  /** Zit of staat de gast nu echt op het toestel (niet meer onderweg ernaartoe of terug)? De GuestManager telt het per zitje. */
  aboard = false;
  /** Is hij al van zijn zitje af en op de terugweg naar het pad? Dan is zijn plek weer vrij voor de volgende. */
  offRide = false;
  /** Waar hij op het toestel is, op het raster (zie ridePlace). */
  private rideX = 0;
  private rideY = 0;
  /** Het bezoek is voorbij: de gast staat weer op het pad. */
  private rideOver = false;
  private useHeard = false;
  /** Zoveel tellen blijft de gast nog even staan tijdens het lopen, voor een kort gebaar. `gaze`: hij kijkt dan naar (lookX, lookY). */
  private stall = 0;
  private gaze = false;
  private lookX = 0;
  private lookY = 0;
  /** Een stap achteruit of opzij (in tegels): alleen in het beeld, de gast blijft staan waar hij staat. */
  private back = 0;
  private aside = 0;
  /** Wat de dieren doen waar de gast naar kijkt (PEN), wat hij uit zichzelf deed, of hij erop let en tot wanneer hij er staat. */
  private mood = 0;
  private ownAct: Act | null = null;
  private heeds = false;
  private penEnd = 0;
  /** Hoe de gast eet van wat hij in zijn hand heeft; `full`: daarna wrijft hij over zijn buik. */
  private bite: Bite = 'bite';
  private full = false;
  /** Het muntje in de hand bij de toonbank, de verrekijker, het zakje voer en de knuffel onder de arm. */
  private coin: THREE.Mesh | null = null;
  private scope: THREE.Group | null = null;
  private feedBag: THREE.Mesh | null = null;
  private feeder = false;
  private plush: THREE.Group | null = null;
  private hugIn = 5 + Math.random() * 8;
  /** De ballon met zijn touwtje; `flown`: zoveel tellen is hij al weggevlogen (-1: de gast heeft hem nog vast). */
  private balloonG: THREE.Group | null = null;
  private flown = -1;
  /** De wielen van de rolstoel of kinderwagen en hoe groot ze zijn: zo draaien ze mee met het rijden. */
  private rims: THREE.Mesh[] = [];
  private rimR: number[] = [];
  private lastX = 0;
  private lastY = 0;
  private lastTile = -1;
  /** Is het nacht (1) en staat er een regenboog (2)? */
  private sky = 0;
  /** Tot deze leeftijd reageert de gast niet nog eens op iets vies, een ontsnapt dier of een plas. */
  private calmUntil = 0;
  private scanIn = Math.random();
  /** Heeft de gast de ster al gezien? En was zijn paraplu net nog dicht? */
  private fanned = false;
  private wasDry = true;
  private ox = (Math.random() - 0.5) * 0.4;
  private oy = (Math.random() - 0.5) * 0.4;
  /** Het ding in het park waar de gast naartoe loopt of mee bezig is (state 'use'), en wat hij er doet. */
  private sight: Sight | null = null;
  private use: Use | null = null;
  /** Waar hij daarbij staat en hoe hij gedraaid is; hoe lang de passen erheen en het bezig zijn duren. */
  private ux = 0;
  private uy = 0;
  private uturn = 0;
  private useGap = 0;
  private useLen = 1;
  /** Hoe ver hij van het pad af is (0 tot 1), hoe lang hij al bezig is, en hoeveel er onderweg al gebeurd is (een plons, de klep). */
  private useK = 0;
  private useE = 0;
  private useMark = 0;
  /** Een gok per bezoek: daarmee kiest de gast wat hij doet op het bankje en bij de fontein. */
  private whim = Math.random();
  /** De laatste dingen waar de gast was: daar gaat hij niet meteen nog eens heen. */
  private sightsSeen: Sight[] = [];
  /** Heeft de gast al in het gastenboek geschreven? */
  private wrote = false;
  /** Het propje afval in de hand, en zoveel tellen duurt het boogje naar de bak nog. */
  private litter: THREE.Mesh | null = null;
  private tossT = 0;

  constructor(tile: number, species: string[], opts: GuestOptions = {}) {
    const person = makePerson(false, undefined, { child: opts.wheels || opts.star ? false : opts.child, shirt: opts.star ? 0xffd23f : opts.shirt });
    this.mesh = person.group;
    // eerst vooroverleunen en opzij hellen, dan pas draaien: zo leunt de gast de kant op waar hij naar kijkt
    this.mesh.rotation.order = 'YXZ';
    this.size = this.mesh.scale.x;
    this.limbs = person.limbs;
    this.head = person.head;
    this.height = person.height;
    this.child = person.child;
    this.wheels = opts.wheels ?? null;
    this.star = !!opts.star;
    this.sex = beardColor(person.head.userData.face as number) !== null ? 'm' : person.group.children.some(c => (c as THREE.Mesh).geometry === SKIRT_GEO) ? 'f' : null;
    this.wantsBalloon = person.child || Math.random() < 0.2;
    this.wantsHat = Math.random() < 0.65;
    // wie een hoedje of ballon wil, heeft daar meteen al zin in: dan loopt hij er het hele bezoek mee rond
    if (this.wantsBalloon) this.balloon = 0.3 + Math.random() * 0.5;
    this.hat = this.wantsHat ? 0.4 + Math.random() * 0.5 : 0;
    this.fav = species.length ? pick(species) : null;
    const add = (geo: THREE.BufferGeometry, color: number, x: number, y: number, z: number): void => {
      const mesh = new THREE.Mesh(geo, mat(color));
      mesh.position.set(x, y, z);
      this.mesh.add(mesh);
    };
    // een wiel heeft spaken, zodat je het ziet draaien (zie `extras`): een groot wiel twee, een klein wieltje één
    const wheel = (geo: THREE.BufferGeometry, color: number, x: number, y: number, z: number, r: number): void => {
      const mesh = new THREE.Mesh(geo, mat(color)), spoke = color === 0x38343c ? 0xd8dce2 : 0x38343c;
      mesh.position.set(x, y, z);
      mesh.add(bit(STRING_GEO, spoke, 0, 0, 0, 3.4, (r * 1.8) / 0.34, 2.5));
      if (r > 0.1) {
        const cross = bit(STRING_GEO, spoke, 0, 0, 0, 3.4, (r * 1.8) / 0.34, 2.5);
        cross.rotation.x = Math.PI / 2;
        mesh.add(cross);
      }
      this.mesh.add(mesh);
      this.rims.push(mesh);
      this.rimR.push(r);
    };
    if (this.wheels === 'chair') {
      // de rolstoel: een zitting met een rugleuning en twee grote wielen
      add(CHAIR_BACK_GEO, 0x3d4f7a, 0, 0.34, -0.1);
      add(CHAIR_SEAT_GEO, 0x3d4f7a, 0, 0.17, 0.02);
      wheel(WHEEL_GEO, 0x38343c, 0.16, 0.15, -0.02, 0.15);
      wheel(WHEEL_GEO, 0x38343c, -0.16, 0.15, -0.02, 0.15);
      wheel(SMALL_WHEEL_GEO, 0x8a8f98, 0.1, 0.05, 0.2, 0.05);
      wheel(SMALL_WHEEL_GEO, 0x8a8f98, -0.1, 0.05, 0.2, 0.05);
    } else if (this.wheels === 'pram') {
      // de kinderwagen rijdt voor de gast uit
      const color = pick([0xe0584f, 0x4a90e2, 0x6cc04a, 0xf06aa6]);
      add(PRAM_GEO, color, 0, 0.3, 0.42);
      add(PRAM_HOOD_GEO, color, 0, 0.42, 0.33);
      add(PRAM_BAR_GEO, 0x8a8f98, 0, 0.42, 0.2);
      for (const [x, z] of [[0.11, 0.3], [-0.11, 0.3], [0.11, 0.54], [-0.11, 0.54]]) wheel(SMALL_WHEEL_GEO, 0x38343c, x, 0.07, z, 0.05);
    }
    if (this.star) {
      add(SHADES_GEO, 0x1d1d24, 0, 0.52, 0.09);
      this.badge = 'celeb';
      this.stay = 150;
      this.fun = 0.6;
    }
    const [x, y] = tileXY(tile);
    this.gx = x + 0.5;
    this.gy = y + 0.5;
    this.place();
  }

  /** De tegel waar de gast staat. Wie nog buiten de poort loopt (op de stoep), telt als op de tegel van de ingang. */
  get tile(): number {
    return this.gy >= H ? ENTRANCE : tileIndex(Math.floor(this.gx), Math.floor(this.gy));
  }

  /** Loopt de gast buiten de poort naar binnen? */
  get arriving(): boolean {
    return !!this.walkway && !this.walkway.out;
  }

  /** Is de gast de poort al uit, op weg naar huis? */
  get departing(): boolean {
    return !!this.walkway?.out;
  }

  /** Neerzetten op een plek buiten de poort: het poppetje komt daar in een oogwenk tevoorschijn. */
  private setDown(gx: number, gy: number, heading: number): void {
    this.gx = this.lastX = gx;
    this.gy = this.lastY = gy;
    this.heading = heading;
    this.sprout = 0;
    this.mesh.scale.setScalar(this.size * 0.05);
    this.place();
  }

  /**
   * Buiten de poort beginnen: de gast staat op het eerste punt en loopt de andere punten af, tot op de tegel van de
   * ingang. `tail`: zoveel volgers lopen er achter hem aan; voor hen ligt er alvast een spoor klaar, recht naar achteren.
   */
  arriveBy(pts: [number, number][], tail = 0): void {
    const [x, y] = pts[0], [nx, ny] = pts[1];
    const d = Math.hypot(nx - x, ny - y) || 1, ux = (x - nx) / d, uy = (y - ny) / d;
    this.walkway = { pts: pts.slice(1), out: false };
    this.state = 'walk';
    this.trail = [];
    for (let k = tail * 3; k >= 0; k--) this.trail.push([x + ux * k * 0.15, y + uy * k * 0.15]);
    this.setDown(x, y, Math.atan2(nx - x, ny - y));
  }

  /** Een volger gaat op zijn plek in de rij staan, achter een leider die buiten de poort begint (of bij de deur van de bus). */
  fallIn(): void {
    const L = this.leader;
    if (!L) return;
    const p = L.trail[Math.max(0, L.trail.length - 1 - this.rank * 3)] ?? [L.gx, L.gy];
    const x = p[0] + this.ox * 0.5, y = p[1] + this.oy * 0.5;
    this.setDown(x, y, Math.atan2(L.gx - x, L.gy - y));
  }

  /** Een bijzondere gast (in een groepje, verdwaald, beroemd): die doet niet mee met een rondleiding en wordt niet bewaard. */
  get special(): boolean {
    return !!(this.leader || this.tour || this.lost || this.star || this.badge || this.leading);
  }

  get watching(): boolean {
    return this.state === 'watch';
  }

  /**
   * Het avondfeest begint: de gast loopt mee in het rondje `loop`, vanaf de plek die het dichtst bij is. Wie in een
   * groepje loopt, verdwaald is of al naar huis gaat, doet niet mee. Een gast die stond te kijken, gaat meteen.
   */
  joinParty(loop: number[]): void {
    if (this.partyRound || !loop.length || this.leader || this.lost || this.tour || this.leaving || this.walkway) return;
    let near = 0, best = Infinity;
    loop.forEach((tile, i) => {
      const [x, y] = tileXY(tile), d = Math.hypot(x + 0.5 - this.gx, y + 0.5 - this.gy);
      if (d < best) {
        best = d;
        near = i;
      }
    });
    this.partyRound = { loop, i: near - 1 };
    this.fun = Math.max(this.fun, 0.6);
    this.joy = Math.max(this.joy, 0.8 + Math.random());
    if ((this.state === 'idle' || this.state === 'watch') && !this.shop && !this.pen && !this.riding) this.timer = Math.min(this.timer, 0.4 + Math.random() * 1.6);
  }

  /** Het feest is voorbij: de gast is er een stuk blijer van en juicht nog even. */
  leaveParty(): void {
    if (!this.partyRound) return;
    this.partyRound = null;
    this.fun = Math.min(1, this.fun + 0.3);
    this.joy = Math.max(this.joy, 1.2 + Math.random());
  }

  /** Het feest: naar de volgende plek van het rondje lopen, en daar naar de dieren kijken. Lukt dat? */
  private partyStep(w: GuestWorld, reach: Set<number>): boolean {
    const r = this.partyRound!, n = r.loop.length;
    for (let k = 0; k < Math.min(n, 4); k++) {
      r.i = (r.i + 1) % n;
      const tile = r.loop[r.i];
      if (tile === this.tile || !reach.has(tile) || !this.go(w, reach, tile)) continue;
      const view = w.viewScore(tile);
      this.face = view ? [view.x, view.y] : null;
      this.gain = view ? view.score * 0.5 : 0;
      this.sees = view?.species ?? [];
      this.wish = null;
      return true;
    }
    return false;
  }

  /** Kan deze gast nu mee met de gids? */
  get free(): boolean {
    return !this.special && !this.leaving && !this.inside && !this.riding && !this.walkway && !this.wheels && this.astray <= 0 && (this.state === 'idle' || this.state === 'walk' || this.state === 'watch') && !this.errand && !this.sight && !this.ask && this.flown < 0 && this.homing < 0;
  }

  /**
   * De bel van de dierenshow: de gast loopt naar de tribune (`door`: de padtegel ervoor) en gaat er zitten. Lukt
   * dat? Alleen een gast die nergens mee bezig is en nog geen show zag, gaat mee.
   */
  toShow(w: GuestWorld, reach: Set<number>, shop: ShopSpot, door: number): boolean {
    if (!this.free || this.sawShow || this.shop || this.pen || this.partyShop) return false;
    if (door !== this.tile && !this.go(w, reach, door)) return false;
    this.sawShow = true;
    this.shop = shop;
    this.face = shopCenter(shop);
    this.act = null;
    this.idle = null;
    if (door === this.tile) this.arrive(w);
    return true;
  }

  /** Wacht de gast bij deze halte op het treintje? */
  get waitingAt(): ShopSpot | null {
    return this.state === 'sit' && !this.riding && this.shop?.kind === 'station' ? this.shop : null;
  }

  /** De kabelbaan waar de gast het laatst in zat, en hoeveel stukken kabel hij al achter elkaar reed (bij een tussenstation). */
  lastLift: CableCar | null = null;
  hops = 0;

  /** Staat de gast op het perron van dit huisje van de kabelbaan te wachten op een stoeltje? */
  get liftWaiting(): ShopSpot | null {
    return this.state === 'sit' && !this.riding && !this.rode && this.shop?.kind === 'cablecar' ? this.shop : null;
  }

  /** Instappen in de kabelbaan, op plek `seat` (twee per stoeltje). */
  liftOn(car: CableCar, seat: number): void {
    this.riding = car;
    this.lastLift = car;
    this.hops++;
    this.liftSeat = seat;
    this.airSeen = [];
    this.peek = 0;
    this.timer = 5;
    this.idle = null;
  }

  /**
   * Uitstappen bij een huisje (`shop`): de gast stapt van het perron het pad op (`tile`). Zonder huisje (de kabelbaan
   * is weg) staat hij meteen op het pad.
   */
  liftOff(shop: ShopSpot | null, tile: number, onward = false): void {
    const [x, y] = tileXY(tile);
    this.riding = null;
    this.air = 0;
    this.gx = x + 0.5;
    this.gy = y + 0.5;
    // verder met het volgende stuk kabel: op het perron van het tussenstation wachten op een stoeltje van de andere kabel
    if (!onward) {
      this.hops = 0;
      this.lastLift = null;
    }
    if (shop) {
      this.rode = !onward;
      this.shop = shop;
      this.seat = this.liftSeat % 4;
      this.face = shopCenter(shop);
      this.timer = 0.7;
    } else {
      this.state = 'idle';
      this.shop = null;
      this.errand = null;
      this.timer = 0.3;
    }
  }

  /** In de kabelbaan: het stoeltje is hier, zo hoog. */
  fly(gx: number, gy: number, h: number): void {
    this.gx = gx;
    this.gy = gy;
    this.air = h;
  }

  /** Vanuit de kabelbaan ziet de gast een dier onder zich: blij, en extra blij bij zijn lievelingsdier. */
  overlook(w: GuestWorld, species: string): void {
    if (this.airSeen.includes(species)) return;
    this.airSeen.push(species);
    this.fun = Math.min(1, this.fun + 0.05);
    this.peek = 2.2;
    if (species !== this.fav) return;
    if (!this.favSeen) {
      this.favSeen = true;
      this.fun = Math.min(1, this.fun + 0.25);
    }
    w.cheer(this);
    this.joy = 1.8;
  }

  snapshot(): GuestSave {
    return {
      gx: this.gx, gy: this.gy, child: this.child, fun: this.fun, age: this.age, stay: this.stay,
      hunger: this.hunger, thirst: this.thirst, bladder: this.bladder,
      hat: this.wornHat ?? undefined, balloon: this.wornBalloon ?? undefined, paint: this.painted ?? undefined,
    };
  }

  /** Zet een bewaarde gast terug op zijn plek, met zijn hoedje en ballon. */
  restore(s: GuestSave, dx = 0, dy = 0): void {
    this.gx = s.gx + dx;
    this.gy = s.gy + dy;
    this.fun = s.fun;
    this.age = s.age;
    this.stay = s.stay;
    this.hunger = s.hunger;
    this.thirst = s.thirst;
    this.bladder = Math.min(0.9, s.bladder);
    if (s.hat) {
      this.addHat(s.hat);
      this.bought.hats = 1;
      this.hat = 0;
    }
    if (s.balloon !== undefined) {
      this.addBalloon(s.balloon || undefined);
      this.bought.balloon = 1;
      this.balloon = 0;
    }
    if (s.paint && this.child) this.paintFace(s.paint);
    this.place();
  }

  /** De kraam waar de gast nu geholpen wordt of voor in de rij staat. */
  get using(): ShopSpot | null {
    // wie in een stoeltje van de kabelbaan zit, staat niet meer op het perron
    if (this.riding instanceof CableCar) return null;
    return this.state === 'buy' || this.state === 'sit' || this.state === 'queue' ? this.shop : null;
  }

  get queueing(): boolean {
    return this.state === 'queue';
  }

  /** Moet de wc-deur van deze gast nu open staan? Vlak voor hij naar binnen stapt, en als hij weer naar buiten komt. */
  get doorOpen(): boolean {
    if (this.state !== 'buy' || this.shop?.kind !== 'toilet') return false;
    const e = WC_TIME - this.timer, out = WC_TIME - this.wcTail;
    return (e > WC.walk - 0.45 && e < WC.walk + WC.step - 0.15) || (e > out - WC.step - 0.45 && e < out + 0.1);
  }

  /**
   * Waar de gast op de wc nu is: naar zijn deur lopen, naar binnen stappen, binnen zitten (dan zie je hem niet),
   * naar buiten stappen en terug naar het pad. Vult WC_AT in: de plek, de kant die hij op gaat en of hij loopt.
   */
  private wcPose(): void {
    const shop = this.shop!, p = WC_AT;
    const e = WC_TIME - this.timer, out = WC_TIME - this.wcTail;
    // de deur draait mee met het gebouw: links of rechts van het midden, aan de voorkant
    const turn = ((shop.rot ?? 0) * Math.PI) / 2, cos = Math.cos(turn), sin = Math.sin(turn);
    const [cx, cy] = shopCenter(shop), lx = this.seat % 2 ? WC.door : -WC.door;
    const fx = cx + lx * cos + WC.front * sin, fy = cy - lx * sin + WC.front * cos;
    const ix = cx + lx * cos + WC.deep * sin, iy = cy - lx * sin + WC.deep * cos;
    let ax = ix, ay = iy, bx = ix, by = iy, k = 0;
    p.fx = fx;
    p.fy = fy;
    p.hidden = false;
    if (e < WC.walk) {
      // van het pad naar de deur
      ax = this.gx;
      ay = this.gy;
      bx = fx;
      by = fy;
      k = e / WC.walk;
    } else if (e < WC.walk + WC.step) {
      ax = fx;
      ay = fy;
      k = (e - WC.walk) / WC.step;
    } else if (e < out - WC.step) p.hidden = true;
    else if (e < out) {
      bx = fx;
      by = fy;
      k = (e - (out - WC.step)) / WC.step;
    } else {
      // weer buiten: terug naar waar de gast op het pad stond
      ax = fx;
      ay = fy;
      bx = this.gx;
      by = this.gy;
      k = Math.min(1, (e - out) / WC.back);
    }
    p.x = ax + (bx - ax) * k;
    p.y = ay + (by - ay) * k;
    p.dx = bx - ax;
    p.dy = by - ay;
    p.moving = k < 1 && Math.hypot(p.dx, p.dy) > 0.05;
    // wie er al is, kijkt van de wc af
    if (!p.moving) {
      p.dx = sin;
      p.dy = cos;
    }
  }

  /** Het bezoek aan de wc, stap voor stap: de gast verdwijnt achter de deur, je hoort een geluidje en daarna de spoelbak. */
  private toiletStep(dt: number, w: GuestWorld, reach: Set<number>): void {
    const shop = this.shop!;
    if (!w.shops.includes(shop)) {
      this.timer = 0; // de wc is weggehaald: de gast staat meteen weer buiten
      return;
    }
    const e = WC_TIME - this.timer;
    if (this.wc === 0 && e >= WC.walk + WC.step) {
      this.wc = 1;
      this.wish = null;
      // ligt er pad voor de deur, dan loopt de gast daar straks verder; anders terug naar waar hij stond
      this.wcPose();
      const tx = Math.floor(WC_AT.fx), ty = Math.floor(WC_AT.fy);
      if (tx >= 0 && ty >= 0 && tx < W && ty < H && reach.has(tileIndex(tx, ty))) {
        this.gx = WC_AT.fx;
        this.gy = WC_AT.fy;
        this.wcTail = 0.35;
      }
    } else if (this.wc === 1 && e >= WC.walk + WC.step + 0.5) {
      this.wc = 2;
      w.guestSound(Math.random() < 0.55 ? 'toilet.pee' : 'toilet.poop', this);
    } else if (this.wc === 2 && e >= WC_TIME - this.wcTail - WC.step - 2.05) {
      this.wc = 3;
      w.guestSound('flush', this);
    }
    this.wcPose();
    this.stepping = WC_AT.moving;
    if (!WC_AT.hidden) this.turnTo(WC_AT.dx, WC_AT.dy, dt);
  }

  /** Een paar passen naar je plek in de rij of aan de toonbank. Geeft true zolang de gast nog loopt. */
  private shuffle(dt: number, reach: Set<number>): boolean {
    if (!this.slot) return false;
    const dx = this.slot[0] - this.gx, dy = this.slot[1] - this.gy, dist = Math.hypot(dx, dy);
    if (dist <= 0.03 || !reach.has(tileIndex(Math.floor(this.slot[0]), Math.floor(this.slot[1])))) return false;
    const step = Math.min(0.8 * dt, dist);
    this.gx += (dx / dist) * step;
    this.gy += (dy / dist) * step;
    this.turnTo(dx, dy, dt);
    this.stepping = true;
    return true;
  }

  /** Wat de gast nu doet, voor het menu van de gast: de weg kwijt, op weg naar huis, of gewoon zijn bezigheid. */
  get doing(): string {
    return this.astray > 0 ? 'astray' : this.leaving ? 'leaving' : this.state === 'sit' && this.shop?.kind === 'show' ? 'show' : this.riding instanceof CableCar ? 'cable' : this.state;
  }

  get happy(): boolean {
    return this.fun >= 0.55 && this.hunger < 0.9 && this.thirst < 0.9 && this.bladder < 0.9;
  }

  /**
   * Het gezicht van nu (zie faces.ts): de ogen en de mond volgen wat de gast doet en hoe hij zich voelt. Een gebaar
   * gaat voor; anders telt het plezier: blij, gewoon of sip. Knipperen, kauwen en praten regelt `faceFor`.
   */
  showFace(): void {
    const seat = this.state === 'sit' ? this.shop?.kind : undefined;
    const doing = this.lost ? (this.found ? 'joy' : 'cry')
      // een kind dat zijn ijsje liet vallen, huilt; wie zijn ballon ziet wegvliegen, kijkt met grote ogen
      : this.ask === 'icecream' ? 'cry' : !this.shot && balloonCatchable(this.flown) ? 'lookup' : this.ask === 'coin' && !this.shot ? 'slump'
      : this.shot ?? (this.joy > 0 ? 'joy' : this.moan > 0 ? 'moan' : this.state === 'accident' ? 'oops' : this.eating > 0 ? this.bite
        : this.state === 'watch' ? this.act : this.state === 'use' ? this.use
        : seat && (PLAY.includes(seat) || RIDES.includes(seat)) ? 'ride'
        // het dutje op het bankje (zie benchPose)
        : seat === 'bench' && this.whim >= 0.75 && !this.child ? 'nap'
        : this.astray > 0 || this.bladder > 0.85 ? 'worry'
        : this.state === 'queue' && this.waited > PATIENCE * 0.6 ? 'cross' : this.idle?.kind);
    setFace(this.head, faceFor(doing, this.fun >= 0.45 ? 'fine' : this.fun >= 0.25 ? 'plain' : 'glum', this.age, this.whim));
  }

  // ------------------------------------------------------------ groepjes
  /** Er loopt vanaf nu iemand achter deze gast aan: hij onthoudt waar hij liep. */
  lead(): void {
    this.leading = true;
    if (!this.trail.length) this.trail.push([this.gx, this.gy]);
  }

  /** Achter iemand aan gaan lopen, op plek `rank` in de rij. */
  join(leader: Leader, rank: number): void {
    this.leader = leader;
    this.rank = rank;
    this.route = [];
    this.shop = null;
    this.errand = null;
    this.wish = null;
    this.slot = null;
    this.state = 'idle';
  }

  /** De rondleiding is klaar: de gast gaat weer zijn eigen gang. */
  release(): void {
    this.leader = null;
    this.act = null;
    this.state = 'idle';
    this.timer = 0.3 + Math.random();
  }

  /** Dit kind is verdwaald: het staat te huilen tot het terug is bij `parent`. */
  loseTo(parent: Guest): void {
    this.lost = true;
    this.seeker = parent;
    this.badge = 'lost';
    parent.badge = 'seek';
    parent.stay += 240;
    parent.lead();
  }

  /** De speler tikt op het verdwaalde kind: het rent naar papa of mama. */
  bringBack(): void {
    if (!this.lost || this.found) return;
    this.found = true;
    this.helped = true;
  }

  /** Zwaaien (naar de speler). */
  greet(): void {
    this.hello = 1.8;
  }

  /**
   * De speler zwaait: de gast zwaait terug, en een kind springt van blijdschap. Geeft terug of het ook wat plezier
   * opleverde; bij dezelfde gast kan dat pas weer na WAVE.every tellen.
   */
  waveBack(): boolean {
    this.greet();
    if (this.child && !this.wheels) this.joy = Math.max(this.joy, 0.9);
    this.waved = true;
    if (!waveFresh(this.age, this.wavedAt)) return false;
    this.wavedAt = this.age;
    this.fun = Math.min(1, this.fun + WAVE.bonus);
    return true;
  }

  /** Instappen in het treintje, op plek `seat`. */
  board(train: Train, seat: number): void {
    this.riding = train;
    this.seat = seat;
    this.timer = 5;
  }

  /** Uitstappen bij de volgende halte. */
  alight(tile: number): void {
    const [x, y] = tileXY(tile);
    this.riding = null;
    this.rode = true;
    this.gx = x + 0.5;
    this.gy = y + 0.5;
    this.timer = 0.05;
  }

  /** Kletsen met de gast die naast je staat: naar elkaar toe draaien en praten. */
  chat(other: Guest): void {
    if (this.state !== 'idle' && this.state !== 'watch') return;
    this.idle = { kind: 'talk', t: 0, dur: 2.5 + Math.random() * 1.5 };
    this.chatAt = [other.gx, other.gy];
  }

  private chatAt: [number, number] | null = null;

  /** Kan de gast nu een praatje maken? */
  get chatty(): boolean {
    return !this.special && !this.walkway && !this.idle && !this.act && this.moan <= 0 && this.astray <= 0 && (this.state === 'idle' || this.state === 'queue');
  }

  /** Hoe ver de gast is met gaan zitten (0 = staat nog op het pad, 1 = zit); aan het eind staat hij weer op. */
  private settle(total: number): number {
    return Math.max(0, Math.min(1, (total - this.timer) / 0.45, this.timer / 0.35));
  }

  private place(): void {
    const m = this.mesh;
    m.visible = true;
    if (this.state === 'buy' && this.shop?.kind === 'toilet') {
      // op de wc: naar de deur, naar binnen (achter de deur zie je de gast niet) en weer naar buiten
      this.wcPose();
      m.visible = !WC_AT.hidden;
      m.position.set(toWorldX(WC_AT.x), this.hop, toWorldZ(WC_AT.y));
      m.rotation.set(0, this.heading, 0);
      return;
    }
    if (this.riding instanceof CableCar) {
      // in een stoeltje van de kabelbaan: benen naar voren, en naar beneden kijken naar de dieren
      this.riding.seatPose(this.liftSeat, m);
      this.limbs[0].rotation.x = this.limbs[1].rotation.x = -1.35 + Math.sin(this.phase * 0.3 + this.liftSeat) * (this.child ? 0.25 : 0.08);
      if (this.joy > 0) return; // het lievelingsdier: juichen met de armen omhoog (zie gesture)
      const mood = Math.sin(this.phase * 0.04 + this.liftSeat * 2.1);
      if (this.peek > 0) {
        // daar is een dier: wijzen naar beneden, en wie naast je zit zwaait ernaar
        this.head.rotation.x = 0.5;
        if (this.liftSeat % 2) {
          this.limbs[2].rotation.x = -2.3;
          this.limbs[2].rotation.z = Math.sin(this.phase * 0.85) * 0.45;
        } else this.limbs[3].rotation.x = -0.9 + Math.sin(this.phase * 0.3) * 0.08;
      } else if (mood > 0.4) {
        // even zwaaien naar de mensen beneden
        this.limbs[2].rotation.x = -2.6;
        this.limbs[2].rotation.z = 0.3 + Math.sin(this.phase * 0.85) * 0.45;
        this.head.rotation.x = 0.3;
      } else {
        // de handen op de beugel, en rustig rondkijken
        this.limbs[2].rotation.x = this.limbs[3].rotation.x = -1.1;
        this.head.rotation.x = 0.3;
        this.head.rotation.y = Math.sin(this.phase * 0.03 + this.liftSeat) * 0.6;
      }
      return;
    }
    if (this.riding) {
      // in het treintje: op het bankje van de wagon, met het gezicht in de rijrichting
      const [x, y, h] = this.riding.seatPos(this.seat);
      m.position.set(toWorldX(x), 0.24 - 0.2 * m.scale.y, toWorldZ(y));
      m.rotation.set(0, h, 0);
      this.limbs[0].rotation.x = this.limbs[1].rotation.x = -1.4;
      // af en toe naar buiten zwaaien
      if (Math.sin(this.phase * 0.05 + this.seat * 2.3) > 0.2) {
        this.limbs[2].rotation.x = -2.6;
        this.limbs[2].rotation.z = 0.3 + Math.sin(this.phase * 0.85) * 0.45;
      }
      return;
    }
    const kind = this.state === 'sit' ? this.shop?.kind : undefined;
    // op een attractie of speeltoestel: de plek en de houding komen uit rides.ts
    if (kind && this.onRide && this.shop?.ride && this.onRide.kind === kind) return this.ridePlace(this.shop, this.onRide, this.shop.ride);
    // bij een ding in het park of aan de rand van de fontein: een paar passen van het pad af
    if (this.state === 'use' && this.sight) return this.usePlace();
    if (kind === 'bench' && this.shop?.edge) {
      // op het bankje: naast elkaar, met het gezicht dezelfde kant op als het bankje
      const [bx, by, rot] = edgePose(this.shop);
      const k = this.settle(BENCH_TIME), lx = this.seat % 2 ? 0.2 : -0.2, lz = -0.02;
      const sx = bx + lx * Math.cos(rot) + lz * Math.sin(rot), sy = by - lx * Math.sin(rot) + lz * Math.cos(rot);
      m.position.set(toWorldX(this.gx + (sx - this.gx) * k), (0.3 - 0.2 * m.scale.y) * k, toWorldZ(this.gy + (sy - this.gy) * k));
      // achteroverleunen of een beetje scheef zakken bij een dutje (zie benchPose)
      m.rotation.set(this.lean * k, this.heading + Math.atan2(Math.sin(rot - this.heading), Math.cos(rot - this.heading)) * k, this.tilt * k);
      // een kind op het bankje zwaait met zijn benen
      const dangle = this.child ? Math.sin(this.phase * 0.45) * 0.35 * k : 0;
      this.limbs[0].rotation.x = (-Math.PI / 2) * k + dangle;
      this.limbs[1].rotation.x = (-Math.PI / 2) * k - dangle;
      return;
    }
    if (kind && this.shop && !this.shop.edge && kind !== 'fountain') {
      const shop = this.shop;
      const [cx, cy] = shopCenter(shop);
      // het toestel draait mee met het gebouw
      const turn = ((shop.rot ?? 0) * Math.PI) / 2, cos = Math.cos(turn), sin = Math.sin(turn);
      const at = (lx: number, h: number, lz: number): [number, number, number] => [cx + lx * cos + lz * sin, h, cy - lx * sin + lz * cos];
      const here: [number, number, number] = [this.gx, 0, this.gy];
      const mix = (a: number[], b: number[], t: number): number[] => a.map((v, i) => v + (b[i] - v) * t);
      const put = (p: number[], facing: number): void => {
        m.position.set(toWorldX(p[0]), p[1], toWorldZ(p[2]));
        m.rotation.set(0, facing, 0);
      };
      const legs = (a: number): void => {
        this.limbs[0].rotation.x = this.limbs[1].rotation.x = a;
      };
      const arms = (a: number): void => {
        this.limbs[2].rotation.x = this.limbs[3].rotation.x = a;
      };
      const total = SERVE_TIME[kind] ?? 6, k = this.settle(total), side = this.seat % 2 ? 1 : -1;
      const sit = m.scale.y * 0.2;
      if (kind === 'show') {
        // op de tribune: drie bankjes van drie, met het gezicht naar het water achter de tribune
        const row = SHOW_ROWS[Math.floor(this.seat / 3) % SHOW_ROWS.length], col = (this.seat % 3) - 1;
        put(mix(here, at(col * 0.52, row.h + 0.01 - sit, row.z), k), k > 0.5 ? turn + Math.PI : this.heading);
        legs(-1.4 * k);
        if (k > 0.9 && this.showMood === 2) {
          // de kunstjes: klappen, en af en toe juichen met de armen in de lucht
          const t = this.phase * 0.9 + this.seat * 1.7;
          if (Math.sin(t * 0.07) > 0.55) arms(-2.8);
          else {
            const clap = Math.abs(Math.sin(t)) * 0.5;
            arms(-1.25);
            this.limbs[2].rotation.z = -clap;
            this.limbs[3].rotation.z = clap;
          }
        } else if (k > 0.9) arms(-0.4);
        return;
      }
      if (kind === 'restaurant') {
        // aan tafel: op een kruk, met het gezicht naar de tafel
        const [tx, tz] = RESTAURANT_TABLES[(this.seat >> 1) % RESTAURANT_TABLES.length];
        put(mix(here, at(tx + side * 0.27, 0.25 - sit, tz), k), k > 0.5 ? turn - side * (Math.PI / 2) : this.heading);
        legs(-1.4 * k);
        // een hap of een slok
        if (k > 0.9) this.limbs[3].rotation.x = -1.75 + Math.sin(this.phase * 0.45 + this.seat) * 0.5;
        return;
      }
      if (kind === 'shelter') {
        // in de schuilhut: de eerste drie zitten op de bank achterin, de rest staat ervoor en kijkt naar de regen
        if (this.seat < 3) {
          put(mix(here, at(((this.seat % 3) - 1) * 0.45, 0.25 - sit, -0.6), k), k > 0.5 ? turn : this.heading);
          legs(-1.4 * k);
        } else {
          put(mix(here, at(((this.seat % 3) - 1) * 0.45, 0, 0.3), k), k > 0.5 ? turn + Math.sin(this.phase * 0.05 + this.seat) * 0.5 : this.heading);
          // af en toe een hand uitsteken om te voelen of het nog regent
          if (k > 0.9 && Math.sin(this.phase * 0.03 + this.seat * 2) > 0.8) this.limbs[2].rotation.x = -1.4;
        }
        return;
      }
      if (kind === 'cablecar') {
        // op het perron van de kabelbaan: in een hoekje wachten (daar zwaaien de stoeltjes niet langs), met het
        // gezicht naar het grote wiel. Af en toe zwaaien naar wie er al in zit.
        const p = at((this.seat & 1 ? 1 : -1) * 0.6, 0.12, (this.seat & 2 ? 1 : -1) * 0.6);
        put(mix(here, p, k), k > 0.5 ? Math.atan2(cx - p[0], cy - p[2]) : this.heading);
        if (k > 0.9 && Math.sin(this.phase * 0.05 + this.seat * 1.7) > 0.6) {
          this.limbs[2].rotation.x = -2.7;
          this.limbs[2].rotation.z = Math.sin(this.phase * 0.85) * 0.45;
          this.head.rotation.x = -0.3;
        }
        return;
      }
      if (kind === 'station') {
        // op het perron wachten tot het treintje komt
        put(mix(here, at(((this.seat % 4) - 1.5) * 0.36, 0.12, this.seat < 4 ? -0.45 : -0.15), k), k > 0.5 ? turn : this.heading);
        if (k > 0.9) {
          const bored = Math.sin(this.phase * 0.04 + this.seat * 1.9);
          if (TRAIN_AT.on && Math.abs(TRAIN_AT.x - this.gx) + Math.abs(TRAIN_AT.y - this.gy) < 4) {
            // daar komt het treintje: zwaaien
            this.limbs[2].rotation.x = -2.7;
            this.limbs[2].rotation.z = Math.sin(this.phase * 0.85) * 0.45;
          } else if (bored > 0.7) {
            // hoe laat is het? Op de klok kijken
            this.limbs[3].rotation.x = -1.3;
            this.limbs[3].rotation.z = 0.7;
            this.head.rotation.x = 0.35;
          } else if (bored < -0.7) this.head.rotation.y = this.seat % 2 ? 0.9 : -0.9; // komt hij er al aan?
        }
        return;
      }
    }
    const kneel = this.act === 'kneel' && this.state === 'watch' ? -0.07 : 0;
    // een stap achteruit of opzij (schrikken, bah): alleen in het beeld
    const hs = Math.sin(this.heading), hc = Math.cos(this.heading);
    m.position.set(toWorldX(this.gx - hs * this.back + hc * this.aside), (this.state === 'accident' ? -0.07 : kneel) + this.hop, toWorldZ(this.gy - hc * this.back - hs * this.aside));
    // een moe gastje loopt een beetje voorovergebogen
    m.rotation.set((this.tired > 0.7 && this.state === 'walk' ? 0.12 : 0) + this.lean, this.heading + this.twist, this.tilt);
  }

  /**
   * Op een attractie of speeltoestel (zie rides.ts): waar de gast is, hoe hij staat of zit, en wat hij met armen,
   * benen en hoofd doet. De plek komt uit het bezoek en uit de stand van het toestel: dezelfde getallen als waarmee
   * het beeld het model beweegt, dus de gast zit altijd precies op zijn zitje.
   */
  private ridePlace(shop: ShopSpot, visit: Visit, ride: RideState): void {
    const m = this.mesh, p = visitPose(RIDE_POSE, visit, ride), limbs = this.limbs, head = this.head;
    // het toestel draait mee met het gebouw
    const turn = ((shop.rot ?? 0) * Math.PI) / 2, cos = Math.cos(turn), sin = Math.sin(turn);
    const cx = shop.x + (shop.w ?? shop.size) / 2, cy = shop.y + (shop.h ?? shop.size) / 2, k = p.sit;
    // in een botsauto: bij een botsing wordt de gast door elkaar geschud
    const jolt = visit.kind === 'bumper' && p.on ? p.u : 0;
    // wie zit, zit met zijn billen op de zitting: de voeten hangen eronder
    // (wat de gebaren met het lijf doen, zoals hurken aan de rand van de fontein, telt er gewoon bij op)
    m.position.set(toWorldX(cx + p.x * cos + p.z * sin), p.h - k * 0.2 * m.scale.y + this.hop, toWorldZ(cy - p.x * sin + p.z * cos));
    // boven op de toren kijkt de gast rustig om zich heen
    const look = visit.kind === 'tower' && p.on ? Math.sin(this.phase * 0.07 + this.seat * 1.7) * 0.9 : 0;
    m.quaternion.setFromEuler(RIDE_TURN.set(p.pitch + this.lean - 0.14 * jolt, turn + p.face + this.twist + look, p.roll + this.tilt + Math.sin(this.phase * 2.6) * 0.16 * jolt));
    this.heading = turn + p.face;
    this.aboard = p.on;
    this.offRide = visitOff(visit, ride);
    this.rideX = cx + p.x * cos + p.z * sin;
    this.rideY = cy - p.x * sin + p.z * cos;
    this.rideOver = p.done;
    this.stepping = p.act === 'walk' || p.act === 'climb';
    if (p.act === 'climb') {
      // een trap op of af: om de beurt een been en een arm, de handen aan de leuning
      const step = Math.sin(this.phase * 0.9) * 0.5;
      limbs[0].rotation.x = step - 0.3;
      limbs[1].rotation.x = -step - 0.3;
      limbs[2].rotation.x = -0.9 - step * 0.5;
      limbs[3].rotation.x = -0.9 + step * 0.5;
      return;
    }
    if (p.act === 'walk') return;
    switch (visit.kind) {
      case 'ferris':
        this.legs(-1.3 * k);
        if (!p.on) {
          // op het perron: omhoog kijken naar het rad; een kind wipt van ongeduld
          if (k <= 0) {
            head.rotation.x = -0.35;
            if (this.child) m.position.y += Math.abs(Math.sin(this.phase * 0.6)) * 0.03;
          }
        } else if (p.u > 0.78) this.arms(-2.7); // bovenin gaan de armen omhoog
        else if (p.u > 0.25) {
          // onderweg zwaait de een naar beneden en wijst de ander iets aan in de diepte
          if (this.seat % 2) this.wave(limbs[2]);
          else {
            limbs[2].rotation.x = -0.95 + Math.sin(this.phase * 0.3) * 0.08;
            head.rotation.x = 0.35;
          }
        } else this.arms(-0.7 * k); // onderin: de handen op de rand
        break;
      case 'carousel':
        // schrijlings op het paard, de handen aan de stang
        this.straddle(k);
        this.legs(-0.9 * k);
        this.arms(-1.25 * k);
        // wie vooraan langskomt, zwaait met zijn buitenste arm naar de mensen langs de kant
        if (p.on && p.u > 0.72 && (ride.amp > 0.5 || this.child)) this.wave(limbs[3]);
        break;
      case 'bumper': {
        // in een botsauto: de benen in de kuip, de handen aan het stuur (dat heen en weer gaat)
        this.legs(-1.4 * k);
        const steer = p.on ? Math.sin(this.phase * 0.35 + this.seat) * 0.25 : 0;
        limbs[2].rotation.x = (-1.2 - steer - 1.5 * jolt) * k;
        limbs[3].rotation.x = (-1.2 + steer - 1.5 * jolt) * k;
        // de bons zelf hoor je één keer, en dan gaan de armen juichend omhoog
        if (jolt > 0.6 && !this.rideMark) this.cue = 'ride.bump';
        this.rideMark = jolt > 0.6 ? 1 : jolt < 0.3 ? 0 : this.rideMark;
        head.rotation.z = Math.sin(this.phase * 2.6 + 1) * 0.2 * jolt;
        break;
      }
      case 'tower': {
        // boven op de uitkijktoren: door de verrekijker kijken, iets aanwijzen of naar beneden zwaaien
        if (!p.on) break;
        const mood = Math.sin(this.phase * 0.02 + this.seat * 2.1);
        if (this.seat % 2 === 0 && mood > -0.3) {
          this.arms(-2.25);
          limbs[2].rotation.z = -0.5;
          limbs[3].rotation.z = 0.5;
          this.spy();
        } else if (mood > 0.3) {
          this.wave(limbs[2], -2.2);
          head.rotation.x = 0.3;
        } else limbs[2].rotation.x = -1.5;
        break;
      }
      case 'slide':
        // (de trap en het lopen zijn hierboven al gedaan) boven gaan zitten met de armen omhoog, joehoe de glijbaan
        // af, en onderaan weer opstaan
        this.legs(-1.35 * k);
        if (p.act === 'slide') {
          // joehoe: het geluidje op het moment dat het glijden begint
          if (!this.rideMark) this.cue = 'guest.whee';
          this.rideMark = 1;
          this.arms(-2.8);
        } else {
          this.rideMark = 0;
          if (p.on) this.arms(p.z < 0 ? -2.8 * k : -2.8 * (1 - p.u));
          // onderaan de trap wachten op je beurt: wippen van ongeduld
          else m.position.y += Math.abs(Math.sin(this.phase * 0.6)) * 0.03;
        }
        break;
      case 'swing':
        // op de schommel: de handen aan de kettingen; naar voren strekken de benen, naar achteren buigen ze
        this.legs((-0.7 - p.u) * k);
        this.arms(-1.5 * k);
        break;
      case 'seesaw': {
        // op de wipwap: onderaan zetten de voeten af tegen de grond; bovenaan zwaaien de benen naar voren, gaan de
        // handen even los en gaat het hoofd lachend in de nek
        const lift = p.on ? p.u * 2 - 1 : 0, low = lift < 0 ? 1 : 0;
        // de plank kantelt naar de andere kant: dan kraakt de wip
        if (p.on && low !== this.rideMark) this.cue = 'ride.creak';
        this.rideMark = low;
        this.legs((-1.2 + 0.8 * Math.max(0, -lift) - 0.35 * Math.max(0, lift)) * k);
        this.arms((-1 - 0.9 * Math.max(0, lift - 0.5)) * k);
        head.rotation.x = -0.25 * Math.max(0, lift) * k;
        break;
      }
      case 'springer':
        // op de wipkip: schrijlings, met de handen aan het handvat
        this.straddle(k);
        this.legs(-0.8 * k);
        this.arms(-1.15 * k);
        break;
      case 'trampoline': {
        // springen met de armen omhoog, en elke derde sprong op de billen landen en weer opveren
        if (!p.on) break;
        const jump = p.u, bum = p.w, down = jump < 0.2 ? 1 : 0;
        // boing: het geluidje op het moment dat de springer op het doek neerkomt
        if (down && !this.rideMark && ride.amps[visit.seat] > 0.5) this.cue = 'ride.boing';
        this.rideMark = down;
        m.position.y -= bum * 0.16 * m.scale.y;
        this.legs(0.5 * (1 - jump) * (1 - bum) - 1.45 * bum);
        this.arms(-2.7 * jump * (1 - bum) - 0.5 * bum);
        break;
      }
    }
  }

  /** Beide benen in dezelfde stand (0 = recht naar beneden, min = naar voren). */
  private legs(a: number): void {
    this.limbs[0].rotation.x = this.limbs[1].rotation.x = a;
  }

  /** Beide armen in dezelfde stand (0 = langs het lijf, min = naar voren en omhoog). */
  private arms(a: number): void {
    this.limbs[2].rotation.x = this.limbs[3].rotation.x = a;
  }

  /** Zwaaien met één arm, die `lift` omhoog staat. */
  private wave(arm: THREE.Object3D, lift = -2.6): void {
    arm.rotation.x = lift;
    arm.rotation.z = Math.sin(this.phase * 0.85) * 0.45;
  }

  /** Schrijlings zitten (op een paard, op de wipkip): de benen een stukje uit elkaar, aan weerszijden van het dier. */
  private straddle(k: number): void {
    this.limbs[0].rotation.z = 0.55 * k;
    this.limbs[1].rotation.z = -0.55 * k;
  }

  private turnTo(dx: number, dy: number, dt: number): void {
    let d = Math.atan2(dx, dy) - this.heading;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.heading += d * Math.min(1, dt * 10);
  }

  private go(w: GuestWorld, reach: Set<number>, to: number): boolean {
    const route = w.grid.path(this.tile, to, i => !reach.has(i));
    if (!route) return false;
    this.route = route.slice(1);
    this.state = 'walk';
    return true;
  }

  /** Een stap langs de route. Geeft true als de gast er is. */
  private stride(dt: number, speed: number): boolean {
    const next = this.route[0];
    if (next === undefined) return true;
    const [tx, ty] = tileXY(next);
    const dx = tx + 0.5 + this.ox - this.gx, dy = ty + 0.5 + this.oy - this.gy;
    const dist = Math.hypot(dx, dy), step = speed * dt;
    if (dist <= step) {
      this.gx += dx;
      this.gy += dy;
      this.route.shift();
    } else {
      this.gx += (dx / dist) * step;
      this.gy += (dy / dist) * step;
      this.turnTo(dx, dy, dt);
    }
    if (this.leading) this.mark();
    return false;
  }

  /** Onthoud waar je liep, voor wie achter je aan komt. */
  private mark(): void {
    const last = this.trail[this.trail.length - 1];
    if (last && Math.hypot(last[0] - this.gx, last[1] - this.gy) < 0.15) return;
    this.trail.push([this.gx, this.gy]);
    if (this.trail.length > 90) this.trail.shift();
  }

  /** Een padtegel naast een winkel van dit soort waar een gast kan staan. Met `product`: alleen winkels die dat verkopen. */
  private spotBeside(w: GuestWorld, reach: Set<number>, kind: ShopKind, product?: string): { shop: ShopSpot; tile: number } | null {
    const options: { shop: ShopSpot; tile: number }[] = [];
    for (const shop of w.shops) {
      if (!sameUse(shop.kind, kind) || (product && shop.kind === kind && !shop.sells.includes(product))) continue;
      // het treintje rijdt pas als er twee haltes zijn
      if (shop.kind === 'station' && !w.trainRuns()) continue;
      // de kabelbaan pas met twee huisjes aan het pad, en niet als het park bijna dichtgaat (en niet met een rolstoel
      // of kinderwagen: die past niet in een stoeltje)
      if (shop.kind === 'cablecar' && (this.wheels || !w.liftRuns(shop))) continue;
      if (shop.edge) {
        // wat op een rand staat, gebruik je vanaf het pad ernaast
        for (const n of edgeSides(shop)) if (reach.has(n)) options.push({ shop, tile: n });
        continue;
      }
      const door = doorOf(w, reach, shop);
      if (door !== null) options.push({ shop, tile: door });
    }
    // zonder wegwijzer of plattegrond in de buurt kijkt een gast niet verder dan een stuk om zich heen: wat verder weg
    // staat, vindt hij niet (dan vraagt hij erom met een wolkje, wordt minder blij en gaat op den duur naar huis)
    if (options.length && !w.signed(this.tile)) {
      const [gx, gy] = tileXY(this.tile);
      const near = options.filter(o => Math.hypot(tileXY(o.tile)[0] - gx, tileXY(o.tile)[1] - gy) <= SEEK_REACH);
      if (near.length !== options.length) {
        options.length = 0;
        options.push(...near);
      }
    }
    if (!options.length) return null;
    // de kortste rij is het aantrekkelijkst
    const load = (o: { shop: ShopSpot }): number => (o.shop.busyNow ?? 0) + (o.shop.line ?? 0) + Math.random() * 0.6;
    return options.reduce((best, o) => (load(o) < load(best) ? o : best));
  }

  /** Wat wil de gast nu het liefst? Het dringendste eerst. */
  private want(w: GuestWorld): Need | null {
    if (this.bladder > 0.6) return 'toilet';
    if (this.hunger > 0.6 && this.hunger >= this.thirst) return 'food';
    if (this.thirst > 0.6) return 'drink';
    if (this.hunger > 0.6) return 'food';
    // het regent: een paraplu halen of gaan schuilen
    if (w.raining() && !this.umbrella && this.age >= this.rainAsk && w.feature('weather'))
      return w.shops.some(s => s.kind === 'umbrellas') && !this.rainAlt ? 'umbrella' : 'shelter';
    // in een rolstoel of met een kinderwagen ga je niet op een bankje of in de draaimolen
    if (!this.wheels) {
      if (this.tired > 0.75) return 'sit';
      if (this.child && this.playful > 0.7) return 'play';
      if (this.petWish > 0.7 && w.pettingSpots().length) return 'pet';
      if (this.rideWish > 0.7) return 'ride';
    }
    if (this.curious > 0.7) return 'look';
    if (this.purchases >= MAX_PURCHASES || this.fun < 0.5) return null;
    // iets lekkers of leuks: waar de gast de meeste zin in heeft
    // alleen wat er in dit level al te koop is: een hoedje of ballon vragen voordat die kraam bestaat, kan niet
    const treats = ([['icecream', this.treat, 'icecream'], ['balloon', this.balloon, 'balloon'], ['hat', this.hat, 'hats'], ['souvenir', this.gift, 'souvenir']] as [Need, number, ShopKind][])
      .filter(t => w.sells(t[2]));
    // een kind wil misschien een dierengezicht uit de schminktent
    if (this.child && !this.painted && w.sells('facepaint')) treats.push(['paint', this.paintWish, 'facepaint']);
    if (!treats.length) return null;
    const [need, zin] = treats.sort((a, b) => b[1] - a[1])[0];
    return zin > 0.7 ? need : null;
  }

  /** De gast heeft niet gevonden wat hij zocht: de zin zakt wat, zodat hij het later nog eens probeert. */
  private postpone(want: Need): void {
    if (want === 'sit') this.tired = 0.5;
    if (want === 'icecream') this.treat = 0.3;
    if (want === 'balloon') this.balloon = 0.3;
    if (want === 'hat') this.hat = 0.3;
    if (want === 'souvenir') this.gift = 0.3;
    if (want === 'play') this.playful = 0.4;
    if (want === 'look') this.curious = 0.3;
    if (want === 'ride') this.rideWish = 0.3;
    if (want === 'pet') this.petWish = 0.4;
    if (want === 'paint') this.paintWish = 0.3;
    if (want === 'umbrella' || want === 'shelter') {
      // even later nog eens proberen, en dan het andere
      this.rainAsk = this.age + 12;
      this.rainAlt = !this.rainAlt;
    }
  }

  /**
   * Even uitrusten als het zo uitkomt: wie iets lekkers in zijn hand heeft of al een beetje moe is, gaat zitten
   * als er vlakbij een bankje met een vrij plekje staat. Is er geen, dan loopt hij gewoon door: geen wolkje en
   * niet minder blij. Geeft terug of de gast nu op weg is naar een bankje.
   */
  private rest(w: GuestWorld, reach: Set<number>): boolean {
    if (this.wheels || (w.raining() && !this.umbrella && w.feature('weather'))) return false;
    if (Math.random() > (this.snack ? 0.8 : this.tired > 0.3 ? this.tired * 2 : 0)) return false;
    let best: ShopSpot | null = null, tile = -1, near = REST_NEAR;
    for (const shop of w.shops) {
      if (shop.kind !== 'bench' || !shop.edge || (shop.busyNow ?? 0) >= (AT_ONCE.bench ?? 1)) continue;
      for (const n of edgeSides(shop)) {
        if (!reach.has(n)) continue;
        const [x, y] = tileXY(n);
        const d = Math.abs(x + 0.5 - this.gx) + Math.abs(y + 0.5 - this.gy);
        if (d < near) {
          near = d;
          best = shop;
          tile = n;
        }
      }
    }
    if (!best || (tile !== this.tile && !this.go(w, reach, tile))) return false;
    if (this.route.length > REST_NEAR * 2) {
      // het bankje is dichtbij, maar de weg erheen is een heel eind om
      this.route = [];
      this.state = 'idle';
      return false;
    }
    this.shop = best;
    this.errand = 'sit';
    this.easy = true;
    // wat lekkers gaat mee naar het bankje
    if (this.snack) this.eating = Math.max(this.eating, this.route.length / 0.8 + 4);
    if (tile === this.tile) this.arrive(w);
    return true;
  }

  /** Naar huis: door de poort naar buiten. Een blije gast laat een tekening achter in het gastenboek. */
  private leave(w: GuestWorld): void {
    if (this.gone || this.walkway) return;
    if (this.star) w.starLeft(this, this.happy);
    else if (this.badge === 'schoolclass' && this.tour) w.classLeft(this, this.happy);
    else if (!this.leader && (this.owesHeart || (this.happy && !this.wrote))) w.signBook(this);
    // kan hij niet bij de ingang komen (het pad is weg), dan is hij meteen weg
    if (this.gy >= H || tileIndex(Math.floor(this.gx), Math.floor(this.gy)) !== ENTRANCE) {
      this.gone = true;
      return;
    }
    // de poort uit en een eind de stoep af, naar links of naar rechts: daar pas is hij weg
    this.walkway = { pts: exitPath(Math.random() < 0.5 ? 1 : -1, 6 + Math.random() * 4, this.ox * 2.5), out: true };
    this.leaving = true;
    this.route = [];
    this.shop = null;
    this.errand = null;
    this.wish = null;
    this.state = 'walk';
  }

  // ------------------------------------------------------------ dingen in het park
  /** Loopt de gast naar een ding in het park of is hij ermee bezig? Dan telt hij daar mee (zie GuestManager.update). */
  claim(): void {
    const s = this.sight;
    if (!s || this.leader || (this.state !== 'walk' && this.state !== 'use')) return;
    s.n++;
    if (this.state === 'use') s.used |= 1 << this.seat;
  }

  /** Op weg naar een ding in het park, naar de padtegel ernaast. Is de weg erheen een heel eind om, dan gaat het niet door. */
  private headFor(w: GuestWorld, reach: Set<number>, sight: Sight, tile: number, far: number): boolean {
    if (tile !== this.tile) {
      if (!this.go(w, reach, tile)) return false;
      if (this.route.length > far) {
        this.route = [];
        this.state = 'idle';
        return false;
      }
    }
    this.sight = sight;
    sight.n++;
    if (tile === this.tile) this.arrive(w);
    return true;
  }

  /**
   * Het spel roept dit kind: het rent naar dit ding (een grote hoop blaadjes, een nieuwe sneeuwpop). Lukt dat?
   * Alleen een kind dat nergens mee bezig is, en alleen als er een padtegel naast het ding ligt.
   */
  visit(w: GuestWorld, reach: Set<number>, sight: Sight): boolean {
    const info = SIGHT[sight.kind];
    if (!info || sight.gone || sight.n >= info.most || !this.free || this.shop || this.pen || this.partyShop) return false;
    let tile = -1, near = 99;
    for (const n of sight.tiles) {
      if (!reach.has(n)) continue;
      const [x, y] = tileXY(n);
      const d = Math.hypot(x + 0.5 - sight.x, y + 0.5 - sight.y) * 4 + Math.abs(x + 0.5 - this.gx) + Math.abs(y + 0.5 - this.gy);
      if (d < near) {
        near = d;
        tile = n;
      }
    }
    if (tile < 0) return false;
    this.act = null;
    this.idle = null;
    if (!this.headFor(w, reach, sight, tile, SIGHT_NEAR * 4)) return false;
    // rennen!
    this.dash = Math.max(this.dash, this.route.length / 1.35 + 0.5);
    return true;
  }

  /** Afval in de hand en een afvalbak in de buurt: de gast loopt ernaartoe en gooit het erin. */
  private binTrip(w: GuestWorld, reach: Set<number>): boolean {
    if (this.trash <= 0 || this.eating > 0 || this.sloppy || this.bladder > 0.8) return false;
    let best: Sight | null = null, tile = -1, near = SIGHT_NEAR;
    for (const s of w.sights()) {
      if (s.kind !== 'bin' || s.gone) continue;
      for (const n of s.tiles) {
        if (!reach.has(n)) continue;
        const [x, y] = tileXY(n);
        const d = Math.abs(x + 0.5 - this.gx) + Math.abs(y + 0.5 - this.gy);
        if (d < near) {
          near = d;
          best = s;
          tile = n;
        }
      }
    }
    return !!best && this.headFor(w, reach, best, tile, SIGHT_NEAR * 2);
  }

  /**
   * Even naar iets moois in de buurt: de vijver, de pomp, het standbeeld, de bloemen, een bord. Alleen als het
   * dichtbij is, er plek is en de gast er niet net geweest is. Met `snack` (iets lekkers in de hand) alleen naar een
   * picknicktafel. Geeft terug of de gast nu op weg is.
   */
  private sightsee(w: GuestWorld, reach: Set<number>, snack: boolean): boolean {
    if (this.special || w.raining() || Math.random() > (snack ? 0.85 : SIGHT_CHANCE)) return false;
    const chilly = w.chilly();
    let best: Sight | null = null, bestTile = -1, total = 0;
    for (const s of w.sights()) {
      const info = SIGHT[s.kind];
      if (!info || s.gone || s.n >= info.most || (snack && s.kind !== 'picnic')) continue;
      if (Math.abs(s.x - this.gx) + Math.abs(s.y - this.gy) > SIGHT_NEAR + 1) continue;
      if (this.wheels && (snack || !info.roll)) continue;
      let zin = info.zin;
      if (!snack) {
        if (this.sightsSeen.includes(s)) continue;
        // bij het vuur is het vooral fijn als het koud of donker is; schrijven doet alleen wie blij is; aan tafel ga je zitten als je wat moe bent
        if (s.kind === 'campfire') zin = chilly ? 2.5 : 0.4;
        else if (s.kind === 'guestbook' && (this.wrote || !this.happy)) continue;
        else if (s.kind === 'picnic' && this.tired < 0.3) continue;
      }
      if (zin <= 0) continue;
      // de padtegel ernaast die het dichtst bij het ding ligt, en daarna het dichtst bij de gast
      let tile = -1, near = 99;
      for (const n of s.tiles) {
        if (!reach.has(n)) continue;
        const [x, y] = tileXY(n);
        const d = Math.hypot(x + 0.5 - s.x, y + 0.5 - s.y) * 4 + Math.abs(x + 0.5 - this.gx) + Math.abs(y + 0.5 - this.gy);
        if (d < near) {
          near = d;
          tile = n;
        }
      }
      if (tile < 0) continue;
      // loten: hoe meer zin, hoe groter de kans
      total += zin;
      if (Math.random() * total < zin) {
        best = s;
        bestTile = tile;
      }
    }
    // in het donker valt er niets te zien (het vuur geeft zelf licht)
    if (!best || (best.kind !== 'campfire' && w.dark(bestTile))) return false;
    if (!this.headFor(w, reach, best, bestTile, SIGHT_NEAR * 2)) return false;
    // wat lekkers gaat mee naar de picknicktafel
    if (snack) this.eating = Math.max(this.eating, this.route.length / 0.8 + 4);
    return true;
  }

  /** Wat de gast bij dit ding gaat doen. */
  private pickUse(kind: string): Use {
    const v = Math.random(), kid = this.child;
    switch (kind) {
      case 'picnic': return 'picnic';
      case 'pond': return this.wheels ? 'show' : kid ? (v < 0.5 ? 'show' : v < 0.8 ? 'feed' : 'crouch') : v < 0.45 ? 'crouch' : v < 0.85 ? 'feed' : 'show';
      case 'well': return 'well';
      case 'pump': return 'pump';
      case 'birdbath': return 'bird';
      case 'campfire': return 'warm';
      case 'waterfall': return v < 0.5 ? 'snap' : 'lookup';
      case 'statue':
      case 'totem':
      case 'clocktower':
      case 'windmill': return v < (kid ? 0.5 : 0.25) ? 'mimic' : v < 0.65 ? 'snap' : 'lookup';
      // een kind gooit soms een sneeuwballetje
      case 'snowman': return kid && v < 0.6 ? 'snowball' : 'giggle';
      case 'leafpile': return 'leap';
      case 'scarecrow': return v < 0.4 ? 'mimic' : 'giggle';
      case 'guestbook': return 'write';
      case 'signpost':
      case 'mapboard': return 'sign';
      case 'roses':
      case 'tulips':
      case 'sunflowers':
      case 'flowers': return 'sniff';
      case 'arch': return 'arch';
      case 'bin': return 'toss';
      default: return 'lookup';
    }
  }

  /** Aangekomen op het pad naast het ding: een vrij plekje kiezen, ernaartoe stappen en beginnen. */
  private beginUse(): void {
    const s = this.sight!, info = SIGHT[s.kind];
    this.state = 'idle';
    this.timer = 0.3;
    // aan de picknicktafel: het vrije plekje op de bank dat het dichtst bij is; anders gewoon het eerste vrije plekje
    const turn = (s.rot * Math.PI) / 2, cos = Math.cos(turn), sin = Math.sin(turn);
    let seat = -1, near = 99;
    for (let i = 0; info && !s.gone && i < info.most; i++) {
      if (s.used & (1 << i)) continue;
      if (s.kind !== 'picnic') {
        seat = i;
        break;
      }
      const lx = i & 1 ? 0.2 : -0.2, lz = i & 2 ? 0.34 : -0.34;
      const d = Math.hypot(s.x + lx * cos + lz * sin - this.gx, s.y - lx * sin + lz * cos - this.gy);
      if (d < near) {
        near = d;
        seat = i;
      }
    }
    if (seat < 0) {
      // weggehaald, of intussen vol: gewoon doorlopen
      this.sight = null;
      return;
    }
    this.seat = seat;
    s.used |= 1 << seat;
    this.use = this.pickUse(s.kind);
    this.useMark = 0;
    this.useHeard = false;
    this.whim = Math.random();
    // waar de gast gaat staan: een paar passen van het pad, met het gezicht naar het ding
    let tx = this.gx, ty = this.gy, face = Math.atan2(s.x - this.gx, s.y - this.gy);
    if (s.kind === 'picnic') {
      const lx = seat & 1 ? 0.2 : -0.2, lz = seat & 2 ? 0.34 : -0.34;
      tx = s.x + lx * cos + lz * sin;
      ty = s.y - lx * sin + lz * cos;
      face = turn + (lz > 0 ? Math.PI : 0);
    } else if (!this.wheels && Math.hypot(s.x - this.gx, s.y - this.gy) > info.off + 0.05) {
      face += SIGHT_SPREAD[seat % SIGHT_SPREAD.length];
      tx = s.x - Math.sin(face) * info.off;
      ty = s.y - Math.cos(face) * info.off;
    }
    const step = Math.hypot(tx - this.gx, ty - this.gy);
    this.ux = tx;
    this.uy = ty;
    this.uturn = face;
    this.useGap = step < 0.05 ? 0 : Math.max(0.35, step);
    this.useLen = info.time * (0.85 + Math.random() * 0.3);
    this.useK = this.useE = 0;
    this.timer = this.useLen + 2 * this.useGap;
    this.state = 'use';
    this.idle = null;
    this.face = [s.x, s.y];
    // wie met iets lekkers aan tafel gaat zitten, eet het daar rustig op
    if (this.use === 'picnic' && this.eating > 0) this.eating = Math.max(this.eating, this.timer - 1.5);
  }

  /**
   * Elk beeldje bij een ding in het park of aan de fontein: hoe ver de gast van het pad af is, hoe lang hij al bezig
   * is, en wat er op zijn tijd gebeurt (het ding beweegt mee, een plons, het afval gaat in de bak).
   */
  private useStep(w: GuestWorld): void {
    if (this.state === 'sit') {
      // aan de fontein: het muntje plonst in het water, of de hand spettert (recht voor de gast, een stuk van de rand af)
      const [t, left] = this.atRim(), coin = this.tossesCoin;
      if (this.useMark < (coin ? 1 : 2) && t > (coin ? 0.95 : this.useMark ? 2.1 : 1) && left > 0.4) {
        this.useMark++;
        const [cx, cy] = shopCenter(this.shop!), k = (coin ? 0.6 : 0.92) * (FOUNTAIN.water / FOUNTAIN.rim);
        w.plons(cx + (this.rideX - cx) * k, cy + (this.rideY - cy) * k, 0.3, coin);
      }
      return;
    }
    const s = this.sight, use = this.use;
    if (!s || !use) return;
    // het ding is weggehaald: meteen terug naar het pad
    if (s.gone) this.timer = Math.min(this.timer, this.useGap);
    const gap = this.useGap, e = this.useLen + 2 * gap - this.timer;
    this.useK = gap > 0 ? Math.max(0, Math.min(1, e / gap, this.timer / gap)) : 1;
    this.useE = Math.max(0, e - gap);
    this.stepping = this.useK < 1;
    if (s.gone || this.useK < 1) return;
    // het geluidje dat erbij hoort (snuffelen, schrijven, in de put roepen, kletsen aan tafel): één keer per bezoek
    const snd = USE_SOUND[use];
    if (snd && !this.useHeard && this.useE > snd[1] * this.useLen) {
      this.useHeard = true;
      if (use !== 'picnic' || s.n > 1) w.guestSound(snd[0], this);
    }
    if (use === 'feed') {
      // bij elke worp plonst er een stukje brood in de vijver
      if (this.useMark < 3 && this.useE > 0.95 + this.useMark * 1.3) {
        this.useMark++;
        w.plons(s.x, s.y, 0, false);
      }
    } else if (use === 'pump') {
      // zolang de gast pompt, gaat de zwengel flink op en neer
      if (this.useMark < 3 && this.useE > 0.2 + this.useMark * 1.15) {
        this.useMark++;
        w.sightUsed(s);
      }
    } else if (use === 'toss') {
      // het afval is los: de klep van de bak klappert
      if (!this.useMark && this.useE > 0.6) {
        this.useMark = 1;
        this.trash = 0;
        w.sightUsed(s);
      }
    } else if (!this.useMark && this.useE > (USE_POKE[use] ?? 2) * this.useLen) {
      // het ding doet even mee: de kikker springt, het vogeltje hipt, het vuur laait op, het blad slaat om
      this.useMark = 1;
      w.sightUsed(s);
      if (use === 'giggle' || use === 'leap') w.guestSound('guest.laugh', this);
      else if (use === 'snowball') w.guestSound('guest.whee', this);
    }
  }

  /** Klaar bij het ding: dat was leuk (leuker dan er alleen langs lopen). De gast loopt weer verder. */
  private endUse(w: GuestWorld): boolean {
    const s = this.sight, info = s ? SIGHT[s.kind] : undefined, use = this.use;
    if (s && info && !s.gone) {
      this.fun = Math.min(1, this.fun + info.fun + (use === 'warm' && w.chilly() ? 0.05 : 0));
      if (use === 'picnic') this.tired = Math.max(0, this.tired - 0.4);
      if (s.kind === 'mapboard') this.knows = true;
      if (use === 'write' && !this.wrote) {
        // de tekening van het lievelingsdier staat erin (anders pas bij het weggaan)
        this.wrote = true;
        w.signBook(this);
      }
      if (this.child && (use === 'giggle' || use === 'mimic' || use === 'show' || use === 'leap' || use === 'snowball')) this.joy = Math.max(this.joy, 0.6);
      if (this.sightsSeen.push(s) > 4) this.sightsSeen.shift();
    }
    this.sight = null;
    this.use = null;
    this.wish = null;
    this.errand = null;
    return false;
  }

  /** Bij een ding in het park: een paar passen van het pad ernaartoe, daar staan (of zitten, aan de picknicktafel) en weer terug. */
  private usePlace(): void {
    const m = this.mesh, k = this.useK;
    let h = this.hop * k;
    if (this.use === 'picnic') {
      // op de bank van de tafel, de benen eronder; een kind zwaait met zijn benen
      h = (0.22 - 0.2 * m.scale.y) * k;
      const dangle = this.child ? Math.sin(this.phase * 0.45) * 0.3 * k : 0;
      this.limbs[0].rotation.x = this.limbs[0].rotation.x * (1 - k) - (Math.PI / 2) * k + dangle;
      this.limbs[1].rotation.x = this.limbs[1].rotation.x * (1 - k) - (Math.PI / 2) * k - dangle;
    }
    m.position.set(toWorldX(this.gx + (this.ux - this.gx) * k), h, toWorldZ(this.gy + (this.uy - this.gy) * k));
    m.rotation.set(this.wheels ? 0 : this.lean, this.heading + Math.atan2(Math.sin(this.uturn - this.heading), Math.cos(this.uturn - this.heading)) * k + this.twist, this.tilt);
  }

  /**
   * Aan de fontein: hoe lang de gast al aan de rand van het bassin staat (onder nul: hij loopt er nog naartoe), en
   * hoe lang hij er nog blijft staan.
   */
  private atRim(): [number, number] {
    const v = this.onRide, ride = this.shop?.ride;
    if (!v || !ride) return [-1, 0];
    const e = visitAge(v, ride);
    return [e - v.walk, v.walk + v.ride - e];
  }

  /** Gooit deze gast een muntje in de fontein? (Anders steekt hij een hand in het water, of spettert hij.) */
  private get tossesCoin(): boolean {
    return !!this.wheels || this.whim < (this.child ? 0.3 : 0.5);
  }

  /**
   * Afval: de gast houdt het propje zichtbaar in zijn hand zodra het lekkers op is. Komt hij langs een afvalbak, dan
   * gooit hij het er met een boogje in (of hij loopt ernaartoe, zie binTrip); anders valt het na een poosje op het pad.
   */
  private carryTrash(dt: number, w: GuestWorld): void {
    if (this.tossT > 0) this.tossT -= dt;
    if (this.trash > 0 && this.eating > 0) this.trash = Math.max(2.5, this.trash - dt); // eerst opeten
    else if (this.trash > 0 && this.sight?.kind !== 'bin') {
      let bin: ShopSpot | null = null;
      if (!this.sloppy)
        for (const sh of w.shops) {
          if (sh.kind !== 'bin') continue;
          // het midden van de bak: op zijn rand, of (in een ouder park) midden op zijn tegel
          const x = sh.edge === 'v' ? sh.x : sh.x + 0.5, y = sh.edge === 'h' ? sh.y : sh.y + 0.5;
          if (Math.abs(x - this.gx) < 1.6 && Math.abs(y - this.gy) < 1.6) bin = sh;
        }
      if (bin) {
        this.trash = 0;
        this.tossT = 0.6;
        w.binned(bin);
      } else {
        this.trash -= dt;
        if (this.trash <= 0 && w.sells('bin')) w.dropLitter(this.gx, this.gy);
      }
    }
    const show = (this.trash > 0 && this.eating <= 0 && w.sells('bin')) || this.tossT > 0.25;
    if (show && !this.litter) {
      // een propje papier: het doosje van het lekkers, maar kleiner en vaal
      this.litter = new THREE.Mesh(SNACK_GEO, mat(0xe9e4d4));
      this.litter.scale.setScalar(0.8);
      // kleiner gemaakt, maar nog steeds onder de hand
      this.litter.position.set(0, -0.04, 0.008);
      this.limbs[3].add(this.litter);
    }
    if (this.litter) this.litter.visible = show;
  }

  /** Armen, hoofd en lijf bij een ding in het park, op het bankje en aan de fontein; en het afval in de hand. */
  private sightPose(): void {
    if (this.litter?.visible || this.tossT > 0) {
      // het propje voor zich uit dragen; in het voorbijgaan gaat het met een boogje in de bak
      const c = 1 - this.tossT / 0.6;
      this.limbs[3].rotation.x = this.tossT <= 0 ? -0.6 : c < 0.5 ? -0.6 - c * 4.2 : -2.7 + (c - 0.5) * 3.4;
    }
    if (this.state === 'use') this.usePose();
    else if (this.state === 'sit' && this.shop?.kind === 'bench') this.benchPose();
    else if (this.state === 'sit' && this.shop?.kind === 'fountain') this.fountainPose();
  }

  /** Lachen: schuddende schouders en de handen op de buik. */
  private chuckle(t: number): void {
    const right = this.limbs[2], left = this.limbs[3];
    this.hop = Math.abs(Math.sin(t * 12)) * 0.025;
    this.head.rotation.x = -0.2 + Math.sin(t * 12) * 0.1;
    right.rotation.x = left.rotation.x = -0.9;
    right.rotation.z = -0.5;
    left.rotation.z = 0.5;
  }

  /** Door de knieën: een been naar voren, een naar achteren, en het lijf een stukje omlaag. */
  private squat(lean: number): void {
    this.lean = lean;
    if (this.wheels) return;
    this.hop = -0.07;
    this.limbs[0].rotation.x = -0.95;
    this.limbs[1].rotation.x = 0.5;
  }

  /** Wat de gast met armen, hoofd en lijf doet bij een ding in het park (zie pickUse). */
  private usePose(): void {
    const s = this.sight, use = this.use;
    if (!s || !use || this.useK < 0.95) return;
    const right = this.limbs[2], left = this.limbs[3], head = this.head, kid = this.child;
    const t = this.useE, u = t / this.useLen;
    switch (use) {
      case 'picnic':
        // aan tafel: een arm op het blad, om je heen kijken, en kletsen als er iemand bij zit
        right.rotation.x = s.n > 1 ? -1.05 + Math.sin(t * 6 + this.seat) * 0.3 : -1.15;
        head.rotation.y = Math.sin(t * 1.3 + this.seat * 2) * 0.55;
        break;
      case 'crouch':
        // hurken aan de rand van de vijver en naar de vissen en de kikker kijken
        this.squat(0.3);
        right.rotation.x = -0.8 + Math.sin(t * 2.2) * 0.12;
        head.rotation.x = 0.3;
        head.rotation.y = Math.sin(t * 1.2) * 0.35;
        break;
      case 'show':
        // kijk, een kikker! Wijzen, wippen en even omkijken of iemand het ook ziet
        right.rotation.x = -1.1 + Math.sin(t * 3) * 0.06;
        left.rotation.x = -0.4;
        this.lean = 0.15;
        if (kid) this.hop = Math.abs(Math.sin(t * 6)) * 0.05;
        head.rotation.x = 0.25;
        if (u > 0.5 && u < 0.72) head.rotation.set(0, 1, 0);
        break;
      case 'feed': {
        // de eendjes voeren: een stukje brood pakken, uithalen en gooien
        const c = (t % 1.3) / 1.3;
        right.rotation.x = c < 0.45 ? -0.9 : c < 0.72 ? -0.9 - ((c - 0.45) / 0.27) * 1.8 : -2.7 + ((c - 0.72) / 0.28) * 1.6;
        right.rotation.z = c < 0.45 ? -0.35 : 0;
        left.rotation.x = -0.9;
        left.rotation.z = 0.35;
        this.lean = c > 0.72 ? 0.12 : 0;
        head.rotation.x = 0.15;
        break;
      }
      case 'well':
        // over de rand hangen en naar beneden kijken; dan iets naar beneden roepen en luisteren naar de echo
        right.rotation.x = left.rotation.x = -0.75;
        this.lean = 0.45;
        head.rotation.x = 0.45;
        if (u > 0.5 && u < 0.75) {
          right.rotation.x = left.rotation.x = -2.2;
          right.rotation.z = -0.4;
          left.rotation.z = 0.4;
        } else if (u >= 0.75) {
          this.lean = 0.3;
          head.rotation.set(0.3, 0, 0.3);
        }
        break;
      case 'pump': {
        // de zwengel op en neer, het hele lijf beweegt mee
        const p = Math.sin(t * 5.5);
        right.rotation.x = left.rotation.x = -1.4 + p * 0.55;
        this.lean = 0.14 + p * 0.09;
        head.rotation.x = 0.2;
        break;
      }
      case 'bird':
        // doodstil staan kijken met de handen op de rug; hipt het vogeltje op, dan klapt de gast (een kind wijst en springt)
        right.rotation.x = left.rotation.x = 0.4;
        this.lean = 0.12;
        head.rotation.x = 0.15;
        head.rotation.z = Math.sin(t * 0.9) * 0.14;
        if (u > 0.5 && u < 0.8) {
          if (kid) {
            right.rotation.x = -1.3;
            left.rotation.x = 0;
            this.hop = Math.abs(Math.sin(t * 8)) * 0.05;
          } else {
            const clap = Math.abs(Math.sin(t * 10)) * 0.4;
            right.rotation.x = left.rotation.x = -1.25;
            right.rotation.z = -clap;
            left.rotation.z = clap;
          }
        }
        break;
      case 'warm':
        // de handen naar het vuur, en ze af en toe warm wrijven; een kind hurkt erbij
        this.lean = 0.1;
        if (kid) this.squat(0.2);
        head.rotation.x = 0.15;
        if (u > 0.45 && u < 0.7) {
          const rub = Math.sin(t * 16) * 0.08;
          right.rotation.x = left.rotation.x = -1.1;
          right.rotation.z = -0.42 + rub;
          left.rotation.z = 0.42 + rub;
        } else {
          right.rotation.x = left.rotation.x = -1.3 + Math.sin(t * 2.2) * 0.06;
          right.rotation.z = -0.12;
          left.rotation.z = 0.12;
        }
        break;
      case 'lookup':
        // omhoog kijken met een hand boven de ogen; een kind zwaait naar de vlag
        head.rotation.x = -0.5;
        head.rotation.y = Math.sin(t * 1.1) * 0.3;
        this.lean = -0.08;
        right.rotation.x = kid && u > 0.4 ? -2.7 : -2.45;
        right.rotation.z = kid && u > 0.4 ? Math.sin(t * 9) * 0.45 : -0.5;
        break;
      case 'mimic':
        this.mimicPose(s.kind, t, u);
        break;
      case 'snap':
        // een foto: het toestel voor de ogen, klik, en dan kijken of hij gelukt is
        if (u < 0.7) {
          right.rotation.x = left.rotation.x = -1.95;
          this.lean = Math.sin(t * 2.4) > 0.9 ? -0.06 : 0;
          head.rotation.x = -0.12;
        } else {
          right.rotation.x = left.rotation.x = -1.2;
          right.rotation.z = -0.2;
          left.rotation.z = 0.2;
          head.rotation.x = 0.35 + Math.sin(t * 7) * 0.08;
        }
        break;
      case 'giggle':
        // eerst zwaaien, dan lachen
        if (u < 0.45) {
          right.rotation.x = -2.7;
          right.rotation.z = Math.sin(t * 9) * 0.45;
          if (kid) this.hop = Math.abs(Math.sin(t * 7)) * 0.06;
        } else this.chuckle(t);
        break;
      case 'write':
        // voorover over het boek en schrijven; halverwege even nadenken, aan het eind tevreden knikken
        this.lean = 0.22;
        head.rotation.x = 0.4;
        left.rotation.x = -1;
        left.rotation.z = 0.2;
        if (u > 0.4 && u < 0.55) {
          this.lean = 0.05;
          right.rotation.x = -2.25;
          right.rotation.z = -0.4;
          head.rotation.set(-0.1, 0, 0.15);
        } else if (u > 0.9) {
          this.lean = 0;
          left.rotation.set(0, 0, 0);
          head.rotation.x = Math.sin(t * 8) * 0.2;
        } else {
          right.rotation.x = -1.15 + Math.sin(t * 13) * 0.07;
          right.rotation.z = -0.25 + Math.sin(t * 4.3) * 0.2;
        }
        break;
      case 'sign':
        if (u < 0.45) {
          // lezen, met een hand aan de kin
          head.rotation.x = s.kind === 'signpost' ? -0.25 : -0.05;
          head.rotation.y = Math.sin(t * 2.5) * 0.22;
          left.rotation.x = -2.2;
          left.rotation.z = 0.45;
        } else if (u < 0.6) head.rotation.x = Math.sin(t * 10) * 0.22; // aha
        else {
          // die kant op: het lijf draait mee met de wijzende arm
          this.twist = (this.whim < 0.5 ? 1.1 : -1.1) * Math.min(1, (u - 0.6) / 0.1);
          right.rotation.x = -1.5 + Math.sin(t * 3) * 0.05;
          head.rotation.x = -0.08;
        }
        break;
      case 'sniff':
        if (u < 0.62) {
          // vooroverbuigen met de handen op de rug en snuffelen (zonnebloemen zijn hoog: daar hoeft het niet zo diep)
          this.lean = s.kind === 'sunflowers' ? 0.16 : kid ? 0.4 : 0.55;
          right.rotation.x = left.rotation.x = 0.45;
          head.rotation.x = (s.kind === 'sunflowers' ? -0.2 : 0.15) + Math.sin(t * 10) * 0.07;
        } else {
          // mmm: weer overeind, de neus in de lucht
          this.lean = -0.06;
          head.rotation.x = -0.3;
          right.rotation.z = 0.3;
          left.rotation.z = -0.3;
          if (kid) this.hop = Math.abs(Math.sin(t * 7)) * 0.04;
        }
        break;
      case 'arch':
        // onder de boog: omhoog kijken en langzaam ronddraaien; een kind reikt naar de bloemen
        head.rotation.x = -0.55;
        this.twist = Math.sin(t * 1.4) * 0.9;
        if (kid) {
          right.rotation.x = left.rotation.x = -2.8;
          this.hop = Math.abs(Math.sin(t * 5)) * 0.07;
        } else {
          right.rotation.z = 0.3;
          left.rotation.z = -0.3;
        }
        break;
      case 'leap':
        if (u < 0.2) {
          // door de knieën, de armen naar achteren
          this.squat(0.25);
          right.rotation.x = left.rotation.x = 0.7;
        } else if (u < 0.42) {
          // hop, hoog de lucht in met de armen omhoog
          this.hop = Math.sin(((u - 0.2) / 0.22) * Math.PI) * 0.42;
          right.rotation.x = left.rotation.x = -2.8;
          right.rotation.z = 0.3;
          left.rotation.z = -0.3;
        } else if (u < 0.78) {
          // plof, half in de blaadjes, de armen wijd
          this.hop = -0.1;
          this.lean = -0.12;
          right.rotation.z = 1.2 + Math.sin(t * 6) * 0.15;
          left.rotation.z = -1.2 - Math.sin(t * 6) * 0.15;
          head.rotation.x = -0.3;
        } else this.chuckle(t);
        break;
      case 'snowball':
        if (u < 0.3) {
          // bukken en sneeuw pakken
          this.squat(0.45);
          right.rotation.x = left.rotation.x = -0.6;
          head.rotation.x = 0.3;
        } else if (u < 0.5) {
          // de arm naar achteren
          right.rotation.x = -2.6;
          this.lean = -0.08;
        } else if (u < 0.65) {
          // en gooien!
          right.rotation.x = -2.6 + ((u - 0.5) / 0.15) * 2.2;
          this.lean = 0.15;
        } else {
          // raak: juichen
          right.rotation.x = left.rotation.x = -2.8;
          this.hop = Math.abs(Math.sin(t * 8)) * 0.07;
        }
        break;
      case 'toss':
        // uithalen, gooien en de handen afkloppen
        if (t < 0.45) left.rotation.x = -0.6 - (t / 0.45) * 2.1;
        else if (t < 0.7) {
          left.rotation.x = -2.7 + ((t - 0.45) / 0.25) * 1.7;
          this.lean = 0.15;
        } else {
          const clap = Math.abs(Math.sin(t * 12)) * 0.35;
          right.rotation.x = left.rotation.x = -1.1;
          right.rotation.z = -clap;
          left.rotation.z = clap;
        }
        break;
    }
  }

  /** De houding nadoen: brullen als de leeuw van het standbeeld, stijf als de totempaal, wieken als de molen, tikken als de klok. */
  private mimicPose(kind: string, t: number, u: number): void {
    const right = this.limbs[2], left = this.limbs[3], head = this.head;
    // aan het eind moet de gast er zelf om lachen
    if (u > 0.78) return this.chuckle(t);
    if (kind === 'windmill') {
      // de armen draaien rond als wieken
      right.rotation.x = t * 4.5;
      left.rotation.x = t * 4.5 + Math.PI;
      head.rotation.x = -0.3;
    } else if (kind === 'clocktower') {
      // tik, tak: heen en weer als de slinger
      this.tilt = Math.sin(t * 3) * 0.16;
      head.rotation.z = -Math.sin(t * 3) * 0.12;
    } else if (kind === 'totem' || kind === 'scarecrow') {
      // de armen wijd, stokstijf (de vogelverschrikker met het hoofd scheef)
      right.rotation.z = 1.45;
      left.rotation.z = -1.45;
      if (kind === 'scarecrow') head.rotation.z = 0.3;
      else this.tilt = Math.sin(t * 5) * 0.05;
    } else {
      // de leeuw: klauwen omhoog en brullen
      right.rotation.x = left.rotation.x = -2 + Math.sin(t * 9) * 0.08;
      right.rotation.z = 0.45;
      left.rotation.z = -0.45;
      head.rotation.x = -0.3;
      this.lean = -0.08;
    }
  }

  /** Op het bankje: kletsen met de buur, achteroverleunen, om je heen kijken of een dutje doen. */
  private benchPose(): void {
    const t = BENCH_TIME - this.timer, v = this.whim;
    if (this.eating > 0 || t < 0.6 || this.timer < 0.5) return;
    const right = this.limbs[2], left = this.limbs[3], head = this.head;
    if ((this.shop?.busyNow ?? 0) > 1 && v < 0.6) {
      // kletsen: het hoofd naar de buur en een handgebaar
      head.rotation.y = this.seat % 2 ? -0.75 : 0.75;
      head.rotation.x = Math.sin(t * 4) * 0.12;
      right.rotation.x = -0.8 + Math.sin(t * 6) * 0.4;
    } else if (v < 0.3) {
      // achteroverleunen: de armen wijd over de leuning en het gezicht in de zon
      this.lean = -0.2;
      right.rotation.set(0.2, 0, 1.1);
      left.rotation.set(0.2, 0, -1.1);
      head.rotation.x = -0.3;
    } else if (v < 0.75 || this.child) {
      // rondkijken
      this.lean = -0.06;
      head.rotation.y = Math.sin(t * 1.1 + this.seat) * 0.85;
    } else {
      // een dutje: het hoofd zakt op de borst en het lijf helt een beetje opzij
      head.rotation.set(0.5, 0, 0.15);
      this.tilt = 0.07 + Math.sin(t * 1.6) * 0.02;
      this.lean = 0.05 + Math.sin(t * 1.6) * 0.02;
    }
  }

  /** Aan de rand van de fontein: een muntje gooien en een wens doen, een hand door het water halen, of spetteren (kinderen). */
  private fountainPose(): void {
    const [t, stay] = this.atRim();
    if (t < 0 || stay < 0.35) return;
    const right = this.limbs[2], left = this.limbs[3], head = this.head;
    if (this.tossesCoin) {
      if (t < 0.5) {
        // het muntje in de hand
        right.rotation.x = -0.9;
        right.rotation.z = -0.3;
        head.rotation.x = 0.3;
      } else if (t < 0.8) right.rotation.x = -0.9 - ((t - 0.5) / 0.3) * 1.8;
      else if (t < 1) right.rotation.x = -2.7 + ((t - 0.8) / 0.2) * 1.5;
      else if (t < 2.3) {
        // een wens doen: de handen tegen elkaar en het hoofd gebogen
        right.rotation.x = left.rotation.x = -1.35;
        right.rotation.z = -0.4;
        left.rotation.z = 0.4;
        head.rotation.x = 0.3;
      } else head.rotation.x = -0.3;
    } else if (!this.child || this.whim < 0.6) {
      // hurken en een hand door het water halen
      this.squat(0.4);
      right.rotation.x = -0.95 + Math.sin(t * 3) * 0.1;
      right.rotation.z = Math.sin(t * 4) * 0.3;
      head.rotation.x = 0.3;
    } else {
      // spetteren met twee handen
      const s = Math.abs(Math.sin(t * 7));
      this.lean = 0.3;
      right.rotation.x = -0.6 - s * 0.8;
      left.rotation.x = -0.6 - (1 - s) * 0.8;
      this.hop = s * 0.04;
      head.rotation.x = 0.15;
    }
  }

  /** Naar de kinderboerderij: eerst naar het poortje lopen. Lukt dat? */
  private visitPen(w: GuestWorld, reach: Set<number>): boolean {
    const spots = w.pettingSpots().filter(sp => reach.has(sp.out) && sp.count < PETTING_GUESTS);
    if (!spots.length) return false;
    const spot = pick(spots);
    if (spot.out !== this.tile && !this.go(w, reach, spot.out)) return false;
    this.pen = spot;
    this.penPhase = 1;
    spot.count++;
    this.wish = { kind: 'pet', lacking: false };
    if (spot.out === this.tile) this.arrive(w);
    return true;
  }

  /** Een rondje met een groepje: eerst naar het feest (bij een verjaardag), dan een paar keer bij de dieren kijken, dan naar huis. */
  private tourStep(w: GuestWorld, list: number[], reach: Set<number>): void {
    const t = this.tour!;
    this.wish = null;
    // sluitingstijd: ook een klas of een feestje gaat nu naar huis
    if (w.goingHome()) {
      t.party = false;
      t.stops = 0;
      this.sendTo = undefined;
    }
    if (t.party) {
      t.party = false;
      const spot = this.spotBeside(w, reach, 'playground');
      if (spot && (spot.tile === this.tile || this.go(w, reach, spot.tile))) {
        this.partyShop = spot.shop;
        if (spot.tile === this.tile) this.arrive(w);
        return;
      }
    }
    if (this.sendTo !== undefined) {
      const tile = this.sendTo, view = w.viewScore(tile);
      this.sendTo = undefined;
      if (view && tile !== this.tile && this.go(w, reach, tile)) {
        // daar is het extra leuk: de speler heeft het zelf aangewezen
        this.gain = view.score * 1.5;
        this.sees = view.species;
        this.face = [view.x, view.y];
        this.seen = [...this.seen.slice(-6), tile];
        return;
      }
    }
    if (t.stops <= 0) {
      this.leaving = true;
      if (this.tile === ENTRANCE || !this.go(w, reach, ENTRANCE)) this.leave(w);
      return;
    }
    // ver van elk bord twijfelt de juf of meester soms even: welke kant moeten we op? Daarna loopt de klas gewoon door
    if (!this.doubted && Math.random() < STRAY.doubt && !w.signed(this.tile)) {
      this.doubted = true;
      return this.stray(STRAY.pause[0] + Math.random() * (STRAY.pause[1] - STRAY.pause[0]), 0);
    }
    this.doubted = false;
    t.stops--;
    for (let tries = 0; tries < 30; tries++) {
      const tile = pick(list);
      if (tile === this.tile || this.seen.includes(tile)) continue;
      const view = w.viewScore(tile);
      if (!view || !this.go(w, reach, tile)) continue;
      this.gain = view.score;
      this.sees = view.species;
      this.face = [view.x, view.y];
      this.seen = [...this.seen.slice(-6), tile];
      return;
    }
    // niets te zien: een stukje wandelen
    if (!this.go(w, reach, pick(list))) {
      this.state = 'idle';
      this.timer = 1.5;
    }
  }

  private decide(w: GuestWorld, list: number[], reach: Set<number>): void {
    this.shop = null;
    this.face = null;
    this.errand = null;
    this.sees = [];
    this.act = null;
    this.gate = -1;
    this.easy = false;
    this.sight = null;
    this.use = null;
    if (this.tour && !this.leaving) return this.tourStep(w, list, reach);
    // het avondfeest: een rondje door het park; wie meedoet, blijft tot het feest voorbij is
    if (this.partyRound && !this.leaving && this.partyStep(w, reach)) return;
    if (this.age > this.stay || this.fun < 0.08 || w.goingHome()) this.leaving = true;
    if (this.leaving) {
      this.wish = null;
      if (this.tile === ENTRANCE || !this.go(w, reach, ENTRANCE)) this.leave(w);
      return;
    }
    if (w.litterOn(this.tile)) this.fun = Math.max(0, this.fun - 0.04);
    this.fun = Math.min(1, this.fun + w.charm(this.tile));
    this.wish = this.fun < 0.2 ? { kind: 'bored', lacking: true } : null;
    // (een rolstoel of kinderwagen vroeg eerst om een pad van twee tegels breed; dat is eruit: het was vooral lastig)
    // ver van elk bord raakt een gast in een groot park soms de weg kwijt; niet met hoge nood en niet in de regen
    if (strayRoom > 0 && this.age >= this.strayFree && !this.special && !this.wheels && this.bladder < 0.6 && !w.raining() && Math.random() < STRAY.chance && !w.signed(this.tile))
      return this.stray(STRAY.time[0] + Math.random() * (STRAY.time[1] - STRAY.time[0]), STRAY.fun);
    // op de plattegrond gekeken: nu weet de gast de weg
    if (!this.knows && w.mapNear(this.gx, this.gy)) {
      this.knows = true;
      this.fun = Math.min(1, this.fun + 0.05);
      this.idle = { kind: 'nod', t: 0, dur: 1.2 };
    }
    const want = this.want(w);
    // niets dringends, of net iets lekkers gekocht: even gaan zitten als er vlakbij een bankje vrij is
    const calm = !want || !PRESSING.includes(want) || (!!this.snack && (want === 'food' || want === 'drink'));
    // afval in de hand: eerst naar de bak als die vlakbij staat. En met iets lekkers het liefst aan de picknicktafel
    if (this.binTrip(w, reach) || (calm && this.eating > 0 && this.sightsee(w, reach, true))) return;
    if (calm && this.rest(w, reach)) return;
    // niets dringends: misschien even naar iets moois in de buurt (de vijver, het standbeeld, de bloemen)
    if ((!want || !PRESSING.includes(want)) && this.sightsee(w, reach, false)) return;
    if (want === 'pet') {
      if (this.visitPen(w, reach)) return;
      this.postpone(want);
    } else if (want) {
      const kind = NEED_SHOP[want];
      // waar vraagt de gast precies om? Bij de knuffelkraam het liefst zijn lievelingsdier.
      const options = w.products(kind);
      let product = this.wanted[want];
      if (options.length && (!product || !options.includes(product))) {
        product = want === 'souvenir' && this.fav && options.includes(PLUSH + this.fav) ? PLUSH + this.fav : pick(options);
        this.wanted[want] = product;
      }
      if (!options.length) product = undefined;
      let spot = this.spotBeside(w, reach, kind, product);
      // nergens te koop: de tweede keer neemt de gast ook iets anders van dezelfde kraam
      if (!spot && product && this.settled.has(want)) spot = this.spotBeside(w, reach, kind);
      // de rij is al te lang: dan loopt de gast mopperend door en komt hij later terug
      const full = !!spot && (spot.shop.line ?? 0) >= MAX_QUEUE;
      if (spot && !full && (spot.tile === this.tile || this.go(w, reach, spot.tile))) {
        this.shop = spot.shop;
        this.errand = want;
        this.wish = { kind: want, lacking: false, product };
        if (spot.tile === this.tile) this.arrive(w);
        return;
      }
      // het is er niet: de gast laat zien wat hij mist en heeft het wat minder naar zijn zin
      this.wish = { kind: want, lacking: true, product, busy: full || undefined };
      if (full) this.grumble(w);
      else if (product && w.shops.some(sh => sameUse(sh.kind, kind))) {
        this.settled.add(want);
        this.fun = Math.max(0, this.fun - 0.03);
      } else {
        const miss = want === 'look' || want === 'ride' ? 0 : want === 'toilet' ? 0.07 : want === 'food' || want === 'drink' ? 0.05 : 0.02;
        this.fun = Math.max(0, this.fun - miss);
        this.postpone(want);
      }
    }
    // naar een plek lopen waar iets te zien is; het lievelingsdier eerst
    let fallback: { tile: number; view: NonNullable<ReturnType<GuestWorld['viewScore']>> } | null = null;
    if (this.knows && this.fav && !this.favSeen) {
      // wie de plattegrond kent, loopt recht naar zijn lievelingsdier
      for (let i = 0, n = Math.min(list.length, 160), from = Math.floor(Math.random() * list.length); i < n && !fallback; i++) {
        const tile = list[(from + i) % list.length];
        const view = w.viewScore(tile);
        if (view?.species.includes(this.fav)) fallback = { tile, view };
      }
    }
    for (let tries = 0; tries < 16 && !(fallback && this.knows); tries++) {
      const tile = pick(list);
      if (tile === this.tile || this.seen.includes(tile)) continue;
      const view = w.viewScore(tile);
      if (!view) continue;
      if (this.fav && !this.favSeen && view.species.includes(this.fav)) {
        fallback = { tile, view };
        break;
      }
      fallback ??= { tile, view };
    }
    if (fallback && this.go(w, reach, fallback.tile)) {
      this.gain = fallback.view.score;
      this.sees = fallback.view.species;
      this.face = [fallback.view.x, fallback.view.y];
      this.seen = [...this.seen.slice(-4), fallback.tile];
      if (!this.wish && this.fav && !this.favSeen && this.age < 30) this.wish = { kind: 'fav', lacking: false };
      return;
    }
    // niets te zien: een stukje wandelen
    if (!this.go(w, reach, pick(list))) {
      this.state = 'idle';
      this.timer = 1.5;
    }
    this.fun = Math.max(0, this.fun - 0.03);
  }

  /** Bij het kijken doet de gast iets: zwaaien, wijzen, een foto maken, klappen, door zijn handen turen, roepen, lachen. */
  private pickAct(): Act | null {
    const p = Math.random();
    if (!this.wheels) {
      // moe: even op de grond gaan zitten kijken. Een kind staat soms op zijn tenen, een groot mens pakt de verrekijker
      const q = Math.random();
      if (this.tired > 0.45 && q < 0.35) return 'ground';
      if (this.child ? q > 0.82 : q > 0.88) return this.child ? 'tiptoe' : 'scope';
    }
    if (this.child && p < 0.22) return 'jump';
    return p < 0.36 ? 'wave' : p < 0.5 ? 'point' : p < 0.64 ? 'photo' : p < 0.73 ? 'clap' : p < 0.8 ? 'peer' : p < 0.86 ? 'kneel' : p < 0.91 ? 'call' : p < 0.96 ? 'laugh' : null;
  }

  private arrive(w: GuestWorld): void {
    if (this.pen) return this.penArrive(w);
    if (this.sight) return this.beginUse();
    if (this.partyShop) {
      // het feest: slingers, taart en iedereen klapt
      const shop = this.partyShop;
      this.partyShop = null;
      this.face = shopCenter(shop);
      this.state = 'watch';
      this.timer = 14;
      this.act = 'clap';
      this.actT = 0;
      this.joy = 3;
      w.partyAt(shop, this);
      return;
    }
    if (this.leaving && this.tile === ENTRANCE) {
      this.leave(w);
    } else if (this.shop) {
      this.face = shopCenter(this.shop);
      if (!w.shops.includes(this.shop)) {
        this.state = 'idle'; // de kraam is intussen weggehaald
        this.timer = 0.2;
      } else if ((this.shop.busyNow ?? 0) < (AT_ONCE[this.shop.kind] ?? 1) && this.serve()) {
        // meteen aan de beurt
      } else if (this.shop.kind === 'bench') {
        // het bankje is vol: voor een bankje ga je niet in de rij staan. Wie echt moe is, moppert en loopt door;
        // wie alleen even wilde uitrusten, loopt gewoon verder
        if (this.easy) this.timer = 0.3;
        else {
          this.wish = { kind: 'sit', lacking: true, busy: true };
          this.grumble(w);
          this.tired = 0.6;
          this.timer = 1.6;
        }
        this.state = 'idle';
        this.shop = null;
        this.errand = null;
      } else {
        // bezet: achteraan aansluiten; de rij begint op de tegel waar de gast nu staat
        this.state = 'queue';
        this.waited = 0;
        this.joined = this.age;
        this.slot = null;
        this.gate = this.tile;
      }
    } else if (this.face && this.partyRound) {
      // feest bij het verblijf: zwaaien, klappen of juichen naar de dieren, of even dansen
      this.state = 'watch';
      this.timer = 2.5 + Math.random() * 2;
      const p = Math.random();
      this.act = p < 0.35 ? 'wave' : p < 0.55 ? 'clap' : p < 0.7 ? 'jump' : null;
      this.actT = 0;
      if (!this.act) this.idle = { kind: 'dance', t: 0, dur: this.timer };
    } else if (this.face) {
      this.state = 'watch';
      this.timer = this.tour ? 6 + Math.random() * 2 : 4 + Math.random() * 3;
      // te donker om iets te zien: het wolkje vraagt om een lantaarn
      if (w.dark(this.tile)) this.wish = { kind: 'dark', lacking: true };
      this.act = this.tour ? 'point' : this.pickAct();
      this.actT = 0;
      // kijken wat de dieren doen: slapen ze, speelt er een, is het er vies? Daar past de gast zijn houding bij aan
      if (!this.tour) this.eyePen(w, true);
    } else if (this.partyRound) {
      // feest, maar hier valt niets te zien: dan maar dansen
      this.state = 'idle';
      this.timer = 2 + Math.random() * 1.5;
      this.idle = { kind: 'dance', t: 0, dur: this.timer };
    } else {
      this.state = 'idle';
      this.timer = 0.6 + Math.random();
    }
  }

  /** De stappen van een bezoek aan de kinderboerderij: door het poortje, naar een dier, aaien en weer terug. */
  private penArrive(w: GuestWorld): void {
    const pen = this.pen!;
    if (!w.pettingSpots().includes(pen)) {
      // het hek is intussen veranderd: de gast gaat er gewoon weer uit
      // stond de gast al binnen, dan is hij meteen weg
      if (this.inside) this.gone = true;
      this.endPen();
      return;
    }
    if (this.penPhase === 1) {
      const goal = pick(pen.tiles);
      this.route = w.grid.path(pen.inn, goal) ?? [pen.inn];
      this.inside = true;
      this.penPhase = 2;
      this.state = 'walk';
    } else if (this.penPhase === 2) {
      this.penPhase = 3;
      this.state = 'watch';
      this.timer = 6 + Math.random() * 3;
      // de een aait, de ander heeft een zakje voer bij zich en voert uit de hand
      this.feeder = !this.wheels && Math.random() < 0.6;
      this.act = this.feeder ? 'feed' : 'pet';
      if (this.feeder && !this.feedBag) this.limbs[3].add((this.feedBag = new THREE.Mesh(SNACK_GEO, mat(0xb88a52))));
      this.actT = 0;
      this.face = w.petAt(pen, this);
    } else {
      this.endPen();
      this.state = 'idle';
      this.timer = 0.4;
    }
  }

  private endPen(): void {
    if (this.pen) this.pen.count = Math.max(0, this.pen.count - 1);
    this.feeder = false;
    this.pen = null;
    this.penPhase = 0;
    this.inside = false;
  }

  /**
   * Aan de beurt: bestellen, naar de wc, gaan zitten of instappen. Geeft false als het nu niet kan: de draaimolen
   * draait al of de botsauto's rijden (dan wacht de gast in de rij tot het ritje voorbij is).
   */
  serve(): boolean {
    if (!this.shop) return false;
    const kind = this.shop.kind, used = this.shop.used ?? 0;
    // een attractie of speeltoestel: een zitje kiezen en uitrekenen hoe het bezoek verloopt (zie rides.ts)
    let visit: Visit | null = null;
    if (isRide(kind) && this.shop.ride) {
      const shop = this.shop, [fx, fz] = rideLocal(this.gx, this.gy, shop.x + (shop.w ?? shop.size) / 2, shop.y + (shop.h ?? shop.size) / 2, shop.rot ?? 0);
      visit = planVisit(kind, shop.ride!, used, fx, fz);
      if (!visit) return false;
    }
    this.onRide = visit;
    this.aboard = this.offRide = this.rideOver = false;
    this.state = SEATED.includes(kind) ? 'sit' : 'buy';
    // de eerste vrije plek: zo zitten er geen twee op hetzelfde zitje
    const places = AT_ONCE[kind] ?? 1;
    let seat = visit ? visit.seat : 0;
    while (!visit && seat < places - 1 && used & (1 << seat)) seat++;
    this.seat = seat;
    this.shop.used = used | (1 << seat);
    this.timer = visit ? visitTime(visit) : SERVE_TIME[kind] ?? 3;
    this.waitT = 0;
    this.rode = false;
    // een nieuwe gok voor wat de gast op het bankje of bij de fontein doet
    this.whim = Math.random();
    this.useMark = 0;
    this.rideMark = 0;
    this.shop.busyNow = (this.shop.busyNow ?? 0) + 1;
    this.slot = null;
    if (this.gate >= 0 && this.state === 'buy' && kind !== 'toilet') {
      // uit de rij aan de beurt: de gast stapt naar de toonbank, waar de rij begint
      const [x, y] = tileXY(this.gate);
      this.slot = [x + 0.5 + this.ox, y + 0.5 + this.oy];
    }
    this.gate = -1;
    if (this.wish) this.wish = { ...this.wish, lacking: false, busy: undefined };
    if (kind === 'toilet') {
      // het bezoek begint buiten, op het pad (zie toiletStep)
      this.wc = 0;
      this.wcTail = WC.back + 0.1;
    }
    // wie met iets lekkers op het bankje gaat zitten, eet het daar rustig op
    if (kind === 'bench' && this.snack) this.eating = Math.max(this.eating, this.timer - 1.5);
    return true;
  }

  /** Te lang gewacht of nergens plek: de gast moppert, wordt minder blij en laat zien waar het te druk is. */
  private grumble(w: GuestWorld): void {
    this.fun = Math.max(0, this.fun - 0.06);
    if (this.wish) this.wish = { ...this.wish, lacking: true, busy: true };
    this.moan = 1.4;
    w.guestSound('guest.grumble', this);
  }

  /** Klaar met kijken, kopen of zitten. Geeft true als de gast zelf al weet wat hij hierna doet. */
  private finish(w: GuestWorld): boolean {
    const kind = this.shop?.kind;
    // (een bezoek aan een toestel is hiermee voorbij)
    this.onRide = null;
    this.aboard = this.offRide = this.rideOver = false;
    if (this.state === 'use') return this.endUse(w);
    if (this.state === 'watch' && this.pen && this.penPhase === 3) {
      // genoeg geaaid: door het poortje weer naar buiten
      this.fun = Math.min(1, this.fun + 0.3);
      this.petWish = 0;
      this.playful = Math.max(0, this.playful - 0.3);
      const back = w.grid.path(this.tile, this.pen.inn) ?? [this.pen.inn];
      this.route = [...back.slice(1), this.pen.out];
      this.penPhase = 4;
      this.state = 'walk';
      this.wish = null;
      this.act = null;
      this.face = null;
      this.inside = true;
      return true;
    }
    if (this.state === 'watch') {
      // in het donker valt er weinig te zien
      const dark = w.dark(this.tile);
      this.fun = Math.min(1, this.fun + this.gain * (dark ? DARK_FUN : 1));
      if (!dark) w.watched(this);
      if (!dark && this.fav && !this.favSeen && this.sees.includes(this.fav)) {
        this.favSeen = true;
        this.fun = Math.min(1, this.fun + 0.25);
        w.cheer(this);
        this.joy = 1.6;
      }
    } else if (this.state === 'sit' && kind && PLAY.includes(kind)) {
      w.guestSound('guest.laugh', this);
      this.playful = 0;
      this.fun = Math.min(1, this.fun + 0.25);
    } else if (this.state === 'sit' && kind === 'station') {
      // uitgestapt bij de volgende halte, of het treintje kwam niet
      if (this.rode) {
        this.rideWish = 0;
        this.tired = 0;
        this.fun = Math.min(1, this.fun + 0.3);
        this.joy = 1;
      } else this.postpone('ride');
    } else if (this.state === 'sit' && kind === 'cablecar') {
      // uitgestapt bij het andere huisje: blij, en hoe meer soorten hij van bovenaf zag, hoe blijer; dan betalen
      if (this.rode && this.shop && w.shops.includes(this.shop)) {
        this.rideWish = 0;
        this.curious = 0;
        this.fun = Math.min(1, this.fun + 0.25 + 0.04 * Math.min(5, this.airSeen.length));
        this.joy = Math.max(this.joy, 1);
        w.guestSound('guest.laugh', this);
        w.liftPaid(this.shop, this);
      } else if (!this.rode) {
        // geen stoeltje gekregen (of de kabelbaan stopte): later nog eens
        this.postpone('ride');
        this.postpone('look');
      }
    } else if (this.state === 'sit' && kind && RIDES.includes(kind)) {
      w.guestSound('guest.laugh', this);
      this.rideWish = 0;
      this.fun = Math.min(1, this.fun + (kind === 'ferris' ? 0.4 : 0.35));
      // duizelig van het draaien, of een high five met wie er tegelijk uitstapt
      this.afterRide();
    } else if (this.state === 'sit' && kind === 'tower' && this.shop) {
      this.curious = 0;
      this.fun = Math.min(1, this.fun + 0.1 + w.towerView(this.shop));
    } else if (this.state === 'sit' && kind === 'fountain') {
      this.curious = 0;
      this.fun = Math.min(1, this.fun + 0.2);
    } else if (this.state === 'sit' && kind === 'restaurant' && this.shop && w.shops.includes(this.shop)) {
      // samen eten aan tafel: eten én drinken, twee munten
      this.hunger = 0;
      this.thirst = 0;
      this.tired = Math.max(0, this.tired - 0.4);
      this.bought.foodstall = this.bought.drinkstall = 1;
      if (w.buy(this.shop, this, undefined, true)) w.buy(this.shop, this, undefined, true);
      this.fun = Math.min(1, this.fun + 0.2);
      this.fire('rub'); // dat was lekker
    } else if (this.state === 'sit' && kind === 'shelter') {
      this.fun = Math.min(1, this.fun + 0.05);
    } else if (this.state === 'sit' && kind === 'show') {
      // de hele show gezien: blij, een munt in de kas en juichend weer op pad
      this.showMood = 0;
      if (this.rode && this.shop && w.shops.includes(this.shop)) {
        this.fun = Math.min(1, this.fun + 0.3);
        this.curious = 0;
        this.joy = 1.4;
        w.showPaid(this.shop, this);
      }
    } else if (this.state === 'sit') {
      // op het bankje: hoe moeier de gast was, hoe meer hij ervan opknapt
      this.fun = Math.min(1, this.fun + 0.05 + 0.1 * Math.min(1, this.tired / 0.75));
      this.tired = 0;
    } else if (this.state === 'buy' && this.shop && kind && w.shops.includes(this.shop)) {
      const asked = this.errand ? this.wanted[this.errand] : undefined;
      const exact = !asked || this.shop.sells.includes(asked);
      const got = exact ? asked : this.shop.sells.length ? pick(this.shop.sells) : undefined;
      if (kind === 'toilet') {
        // het doortrekken was al te horen toen de gast nog binnen zat (zie toiletStep)
        this.bladder = 0;
        this.fun = Math.min(1, this.fun + 0.08);
        // opgelucht: een zucht, en dan de handen droog schudden
        this.fire('relief', 0.8);
      } else if ((exact || got) && w.buy(this.shop, this, got, exact)) {
        this.bought[kind] = (this.bought[kind] ?? 0) + 1;
        this.purchases++;
        // wat lekkers gaat mee in de hand: de gast eet of drinkt er nog even van
        if (kind === 'foodstall' || kind === 'drinkstall' || kind === 'icecream') {
          if (this.snack) this.limbs[3].remove(this.snack);
          // een hoorntje, een beker met een rietje, een zak friet, ...: elk met zijn eigen manier van eten
          this.snack = makeTreat(kind, got);
          this.bite = kind === 'icecream' ? 'lick' : kind === 'drinkstall' ? 'sip' : 'bite';
          this.full = kind !== 'drinkstall';
          this.limbs[3].add(this.snack);
          this.eating = 7;
        }
        if (kind === 'foodstall') this.hunger = 0;
        else if (kind === 'drinkstall') {
          this.thirst = 0;
          this.bladder = Math.min(0.85, this.bladder + 0.15);
        } else if (kind === 'icecream') this.treat = 0;
        else if (kind === 'balloon') {
          this.balloon = 0;
          this.addBalloon(got);
        } else if (kind === 'hats') {
          this.hat = 0;
          this.addHat(got);
          this.fire('don'); // opzetten met een zwier
        } else if (kind === 'souvenir') {
          this.gift = 0;
          this.takePlush(got);
        } else if (kind === 'facepaint') this.getPainted(this.shop);
        else if (kind === 'umbrellas') this.takeUmbrella();
        // precies wat de gast vroeg maakt hem blijer dan iets anders
        const joy = kind === 'foodstall' || kind === 'drinkstall' ? 0.1 : 0.2;
        this.fun = Math.min(1, this.fun + (exact ? joy : joy * 0.3));
        // een kind dat net iets leuks kreeg, springt even
        if (this.child && (kind === 'icecream' || kind === 'balloon' || kind === 'souvenir' || kind === 'facepaint')) this.joy = 0.9;
        // gekocht met het muntje van de speler: heel blij
        if (this.gifted) {
          this.gifted = false;
          this.fun = 1;
          this.joy = 1.6;
        }
        if (this.errand) {
          delete this.wanted[this.errand];
          this.settled.delete(this.errand);
        }
        if (kind === 'foodstall' || kind === 'drinkstall' || kind === 'icecream') {
          this.trash = 10 + Math.random() * 10;
          this.sloppy = w.messy() && Math.random() < 0.45;
        }
      } else this.fun = Math.max(0, this.fun - 0.1);
    }
    this.wish = null;
    this.errand = null;
    return false;
  }

  /** De gast loopt verder met de ballon die hij kocht. */
  private addBalloon(product?: string): void {
    this.wornBalloon = product ?? '';
    const colors = [0xe0584f, 0x4a90e2, 0xffd23f, 0x6cc04a, 0xf06aa6];
    const color = (product && COLOR_OF[product]) || pick(colors);
    const balloon = new THREE.Mesh(BALLOON_GEO, mat(color));
    if (product === 'balloon_heart') balloon.scale.set(1.5, 1.25, 0.8);
    const string = new THREE.Mesh(STRING_GEO, mat(0xf4f1e8));
    // de ballon en zijn touwtje hangen samen aan de hand: daar draaien ze omheen als de ballon wiebelt (zie `overlay`)
    balloon.position.set(0, 0.68, 0);
    string.position.set(0, 0.31, 0);
    string.scale.y = 1.8;
    if (this.balloonG) this.mesh.remove(this.balloonG);
    this.balloonG = new THREE.Group();
    this.balloonG.position.set(BALLOON_AT[0], BALLOON_AT[1], BALLOON_AT[2]);
    this.balloonG.add(balloon, string);
    this.flown = -1;
    this.mesh.add(this.balloonG);
  }

  /** De gast zet het hoedje op dat hij kocht: een petje, een strohoed, een feestmuts of een kroon. */
  addHat(product = 'cap_red'): void {
    this.wornHat = product;
    if (this.headwear) this.mesh.remove(this.headwear);
    const hat = makeHat(product);
    this.headwear = hat;
    this.mesh.add(hat);
  }

  /** In de schminktent: het gezicht dat bij de tent gekozen is (of een gok); daarna mag de volgende weer kiezen. */
  private getPainted(shop: ShopSpot): void {
    this.paintWish = 0;
    this.paintFace(paintNext(shop.sells));
    shop.sells = [];
    this.fun = Math.min(1, this.fun + PAINT.fun);
  }

  /** Een dierengezicht: het hele gezicht in een kleur (zie faces.ts: het gezicht krijgt de kleur van het hoofd) en de stukjes erop. */
  paintFace(face: FacePaint): void {
    if (this.painted) return;
    this.painted = face;
    const base = PAINT_BASE[face];
    if (base !== undefined) this.head.material = mat(base);
    for (const b of PAINT_BITS[face]) this.head.add(paintBit(b));
  }

  /** Kan deze gast nu ergens naartoe gestuurd worden (geen rij, geen attractie, niet bezig met iets anders)? */
  private get loose(): boolean {
    return !this.special && !this.leaving && !this.inside && !this.riding && !this.walkway && !this.sight && !this.pen && (this.state === 'idle' || this.state === 'walk' || this.state === 'watch');
  }

  /**
   * Over het pad naar `to` lopen en daar kijken naar wat er te zien is (`view`): staat zijn lievelingsdier erbij, dan
   * juicht hij. Geeft false als de gast nu niet kan (hij is met iets anders bezig) of er niet kan komen.
   */
  headTo(w: GuestWorld, reach: Set<number>, to: number, view: { x: number; y: number; species: string[]; score: number } | null): boolean {
    if (!this.loose || this.astray > 0 || !this.go(w, reach, to)) return false;
    this.shop = null;
    this.errand = null;
    this.act = null;
    this.gate = -1;
    this.gain = view?.score ?? 0;
    this.sees = view?.species ?? [];
    this.face = view ? [view.x, view.y] : null;
    this.seen = [...this.seen.slice(-4), to];
    return true;
  }

  /** De speler wijst de weg met zijn vinger: de gast weet het weer, is blij en loopt erheen (zie headTo). */
  showWay(w: GuestWorld, reach: Set<number>, to: number, view: { x: number; y: number; species: string[]; score: number } | null): boolean {
    if (this.astray <= 0) return false;
    this.findWay(true);
    this.fun = Math.min(1, this.fun + WAY.fun);
    this.joy = 1.2;
    this.headTo(w, reach, to, view);
    return true;
  }

  /** Kan dit kind meelopen in de optocht? Ook als het net onderweg was naar een kraam: dat komt straks wel. */
  get paradeReady(): boolean {
    return this.child && this.loose && !this.wheels && this.astray <= 0;
  }

  /** Een groot mens ziet de optocht langskomen: even stilstaan, ernaar kijken en klappen. */
  clapFor(gx: number, gy: number): void {
    if (this.child || !this.loose || this.astray > 0 || this.errand || this.state === 'watch') return;
    this.route = [];
    this.state = 'watch';
    this.face = [gx, gy];
    this.act = 'clap';
    this.actT = 0;
    this.timer = 3.5 + Math.random() * 1.5;
    this.sees = [];
    this.gain = 0.04;
  }

  /** Een paraplu uit de bak: die gaat open zodra het regent. */
  private takeUmbrella(): void {
    this.umbrella = true;
    if (this.brolly) return;
    const brolly = new THREE.Group();
    const top = new THREE.Mesh(BROLLY_GEO, mat(pick(BROLLY_COLORS)));
    top.position.set(-0.1, 0.98, 0.02);
    const stick = new THREE.Mesh(BROLLY_STICK_GEO, mat(0x5a4636));
    stick.position.set(-0.1, 0.74, 0.02);
    brolly.add(top, stick);
    this.brolly = brolly;
    this.mesh.add(brolly);
  }

  /** Achter de leider aan: over het spoor dat hij achterlaat, elk op zijn eigen plek in de rij. */
  private follow(dt: number): void {
    const L = this.leader!;
    if (L.gone) {
      // de leider is de stoep af: wie buiten de poort nog achter hem liep, loopt zelf door tot waar hij verdween
      if (this.gy >= H) {
        this.leader = null;
        this.leaving = true;
        this.walkway = { pts: [[L.gx, L.gy]], out: true };
        this.state = 'walk';
      } else this.gone = true;
      return;
    }
    const trail = L.trail, idx = trail.length - 1 - this.rank * 3;
    const target = idx >= 0 ? trail[idx] : trail[0] ?? [L.gx, L.gy];
    const dx = target[0] + this.ox * 0.5 - this.gx, dy = target[1] + this.oy * 0.5 - this.gy, dist = Math.hypot(dx, dy);
    const moving = dist > 0.1;
    if (moving) {
      // wie achterop raakt, zet er even de pas in
      const step = Math.min(dist, (dist > 1.2 ? 1.6 : 0.95) * dt);
      this.gx += (dx / dist) * step;
      this.gy += (dy / dist) * step;
      this.turnTo(dx, dy, dt);
      this.act = null;
    } else if (L.face) this.turnTo(L.face[0] - this.gx, L.face[1] - this.gy, dt);
    this.state = moving ? 'walk' : L.watching ? 'watch' : 'idle';
    if (this.state === 'watch' && !this.act) {
      // op het verjaardagsfeest gooien de kinderen confetti
      this.act = L instanceof Guest && L.tour && L.act === 'clap' && Math.random() < 0.6 ? 'toss' : this.pickAct();
      this.actT = Math.random() * 2;
    }
    if (this.leading) this.mark();
    this.fun = Math.min(1, this.fun + dt * 0.004);
    this.phase += dt * 11;
    swing(this.limbs, moving ? Math.sin(this.phase) * 0.7 : 0);
    this.gesture(dt, false);
    this.place();
  }

  /** Verdwaald: staan huilen tot er iemand helpt; daarna rennen naar papa of mama. */
  private cry(dt: number, w: GuestWorld, reach: Set<number>): void {
    const P = this.seeker;
    if (!P || P.gone || !reach.has(this.tile)) {
      this.gone = true;
      return;
    }
    this.lostFor += dt;
    // komt er niemand helpen, dan vinden ze elkaar na een poos vanzelf
    if (this.lostFor > 160) this.found = true;
    this.phase += dt * 11;
    if (this.found) {
      if (Math.hypot(P.gx - this.gx, P.gy - this.gy) < 0.9) {
        this.lost = false;
        this.badge = null;
        P.badge = null;
        this.joy = 2;
        P.joy = 2;
        this.join(P, 1);
        w.reunited(this, P, this.helped);
        return;
      }
      if (!this.route.length && !this.go(w, reach, P.tile)) {
        this.gx = P.gx;
        this.gy = P.gy;
      }
      this.stride(dt, 1.5);
      this.state = 'walk';
      swing(this.limbs, Math.sin(this.phase * 1.4) * 0.9);
      this.limbs[2].rotation.x = this.limbs[3].rotation.x = -2.6;
    } else {
      // handen voor de ogen en schokkende schouders
      this.state = 'idle';
      swing(this.limbs, 0);
      this.limbs[2].rotation.x = this.limbs[3].rotation.x = -2.35;
      this.limbs[2].rotation.z = 0.35;
      this.limbs[3].rotation.z = -0.35;
      this.head.rotation.x = 0.3;
      this.tilt = Math.sin(this.phase * 0.9) * 0.05;
    }
    this.place();
  }

  /** De weg kwijt: de gast blijft staan en kijkt om zich heen, zoveel tellen lang. Het kost een beetje plezier. */
  private stray(time: number, cost: number): void {
    this.astray = time;
    this.fun = Math.max(0, this.fun - cost);
    this.wish = { kind: 'astray', lacking: true };
    this.route = [];
    this.state = 'idle';
    this.timer = 1.5 + Math.random() * 1.5;
    // geen dansje of selfie tussendoor: hij zoekt de weg
    this.idle = null;
    this.idleIn = 30;
    strayRoom--;
  }

  /** De gast weet de weg weer. `glad`: omdat hij een bord ziet; dan knikt hij en is het plezier terug. */
  findWay(glad = false): void {
    if (this.astray <= 0) return;
    this.astray = 0;
    this.strayFree = this.age + STRAY.rest;
    if (this.wish?.kind === 'astray') this.wish = null;
    this.route = [];
    this.state = 'idle';
    this.timer = 0.3;
    this.idleIn = 2 + Math.random() * 3;
    if (glad) {
      this.fun = Math.min(1, this.fun + STRAY.fun);
      this.idle = { kind: 'nod', t: 0, dur: 1.2 };
      this.timer = 1.2;
    }
  }

  /** De weg kwijt: staan en om je heen kijken, een paar passen een willekeurige kant op, en weer kijken. */
  private roam(dt: number, w: GuestWorld, reach: Set<number>): void {
    this.astray -= dt;
    // een bord in zicht, of lang genoeg gezocht: de gast weet het weer
    const found = w.signed(this.tile);
    if (found || this.astray <= 0) return this.findWay(found);
    if (this.state === 'walk') {
      if (this.stride(dt, 0.55)) {
        this.state = 'idle';
        this.timer = 1.5 + Math.random() * 1.5;
      }
      return;
    }
    this.timer -= dt;
    // een groepje blijft bij elkaar staan; wie alleen is, probeert een paar passen een andere kant op
    if (this.timer > 0 || this.tour) return;
    let at = this.tile, prev = -1;
    for (let n = 2 + Math.floor(Math.random() * 3); n > 0; n--) {
      const next = w.grid.neighbors(at).filter(i => reach.has(i) && i !== prev);
      if (!next.length) break;
      prev = at;
      at = pick(next);
      this.route.push(at);
    }
    if (this.route.length) this.state = 'walk';
    else this.timer = 1;
  }

  update(dt: number, w: GuestWorld, list: number[], reach: Set<number>): void {
    this.age += dt;
    this.stepping = false;
    const rain = w.raining();
    if (this.brolly) this.brolly.visible = rain;
    // het geluidje bij wat de gast net begon te doen (een gebaar, een hap, een sprong)
    if (this.cue) {
      w.guestSound(this.cue, this);
      this.cue = null;
    }
    // wie buiten de poort begint, komt in een oogwenk tevoorschijn
    if (this.sprout < 1) {
      this.sprout = Math.min(1, this.sprout + dt * 4);
      this.mesh.scale.setScalar(this.size * (0.05 + 0.95 * this.sprout));
    }
    if (this.leader) return this.follow(dt);
    if (this.lost) return this.cry(dt, w, reach);
    if (this.walkway) return this.outdoors(dt, w, reach);
    // wielen, ballon en paraplu, en opletten wat er om de gast heen gebeurt (iets vies, een ontsnapt dier, de ster)
    this.extras(dt, w);
    const ease = w.ease(), demand = w.demand() * ease;
    if (w.sells('foodstall') && !this.bought.foodstall) this.hunger = Math.min(1, this.hunger + (dt / 160) * demand * w.craving('foodstall'));
    if (w.sells('drinkstall') && !this.bought.drinkstall) this.thirst = Math.min(1, this.thirst + (dt / 130) * demand * w.craving('drinkstall'));
    if (w.sells('toilet')) this.bladder = Math.min(1, this.bladder + (dt / 170) * ease);
    if (w.sells('icecream') && !this.bought.icecream) this.treat = Math.min(1, this.treat + (dt / 190) * demand * w.craving('icecream'));
    if (w.sells('balloon') && this.wantsBalloon && !this.bought.balloon) this.balloon = Math.min(1, this.balloon + (dt / 85) * demand * w.craving('balloon'));
    if (w.sells('hats') && this.wantsHat && !this.bought.hats) this.hat = Math.min(1, this.hat + (dt / 75) * demand * w.craving('hats'));
    if (w.sells('bench')) this.tired = Math.min(1, this.tired + (dt / 180) * ease);
    if (w.sells('souvenir') && !this.bought.souvenir) this.gift = Math.min(1, this.gift + (dt / 120) * demand * w.craving('souvenir'));
    if (w.sells('playground') && this.child) this.playful = Math.min(1, this.playful + (dt / 90) * ease);
    if (w.sells('fountain')) this.curious = Math.min(1, this.curious + (dt / 120) * ease);
    if (w.sells('carousel')) this.rideWish = Math.min(1, this.rideWish + (dt / (this.child ? 70 : 170)) * ease);
    if (w.feature('petting')) this.petWish = Math.min(1, this.petWish + dt / (this.child ? 60 : 170));
    if (w.sells('facepaint') && this.child && !this.painted) this.paintWish = Math.min(1, this.paintWish + (dt / PAINT.want) * demand * w.craving('facepaint'));
    // in een vol park koopt een gast minder vaak iets leuks; zijn plezier zakt dan ook wat langzamer
    this.fun = Math.max(0, this.fun - (dt / 240) * (0.5 + 0.5 * ease));
    // in de regen zonder paraplu is het minder leuk, en wie nat wordt gaat eerder naar huis
    const dry = this.umbrella || (this.state === 'sit' && (this.shop?.kind === 'shelter' || this.shop?.kind === 'restaurant'));
    if (rain && !dry && w.feature('weather')) {
      this.fun = Math.max(0, this.fun - dt / 90);
      this.stay -= dt * 0.5;
    }
    if (this.tour) this.fun = Math.max(this.fun, 0.5);
    if (!this.inside && !this.riding && !reach.has(this.tile)) {
      this.gone = true; // het pad onder de gast is weggehaald
      return;
    }
    // hoge nood: de gast houdt het niet meer en doet het ter plekke op het pad
    if (this.state === 'accident') {
      this.timer -= dt;
      this.limbs[0].rotation.x = this.limbs[1].rotation.x = -1.2;
      this.limbs[2].rotation.x = this.limbs[3].rotation.x = -0.5;
      if (this.timer <= 0) {
        w.accident(this, this.mess);
        this.bladder = 0;
        this.fun = Math.max(0, this.fun - 0.25);
        this.state = 'idle';
        this.decide(w, list, reach);
      }
      this.place();
      return;
    }
    // hoge nood: de gast heeft nog een halve minuut om een wc te halen
    this.urgent = this.bladder >= 1 ? this.urgent + dt : 0;
    if (this.urgent > 30 && !(this.state === 'buy' && this.shop?.kind === 'toilet') && !this.inside && !this.riding && !this.tour && !(this.state === 'sit' && this.aboard)) {
      this.urgent = 0;
      this.state = 'accident';
      this.timer = 2.4;
      this.route = [];
      this.shop = null;
      this.errand = null;
      this.mess = Math.random() < 0.35 ? 'poop' : 'pee';
      this.wish = { kind: 'toilet', lacking: true };
      this.place();
      return;
    }
    // afval: zichtbaar in de hand, in de bak als er een vlakbij staat, anders valt het na een poosje op het pad
    // (hoog in de kabelbaan houd je je afval nog even vast)
    if ((this.trash > 0 || this.litter) && !(this.riding instanceof CableCar)) this.carryTrash(dt, w);
    if (this.astray > 0) this.roam(dt, w, reach);
    else if (this.state === 'walk') {
      // een blij kind zet het af en toe op een rennen
      if (this.dash > 0) this.dash -= dt;
      else if (this.child && this.fun > 0.7 && !this.inside && Math.random() < dt * 0.04) this.dash = 2 + Math.random() * 1.5;
      // het regent en de gast heeft geen paraplu: op een holletje naar de schuilhut of de paraplubak
      // (en wie hoge nood heeft, rent naar de wc)
      // wie na sluitingstijd nog in het park is, loopt stevig door naar de uitgang
      const speed = this.wheels ? (this.leaving && w.closed() ? 0.9 : 0.62) : this.dash > 0 || this.hurrying(w) || this.bursting || (this.leaving && w.closed()) ? 1.35 : 0.8;
      // even blijven staan voor een kort gebaar (bah, kijk daar, een high five)
      if (this.stall > 0) this.linger(dt);
      else if (this.stride(dt, speed)) this.arrive(w);
    } else if (this.state === 'queue') {
      // in de rij: opschuiven naar je plek en wachten; wie te lang wacht, loopt mopperend weg
      this.waited += dt;
      this.fun = Math.max(0, this.fun - dt / 150);
      if (this.slot && !this.shuffle(dt, reach) && this.face) this.turnTo(this.face[0] - this.gx, this.face[1] - this.gy, dt);
      if (this.waited > PATIENCE / 2 && this.wish && !this.wish.busy) this.wish = { ...this.wish, lacking: true, busy: true };
      if (this.waited > PATIENCE || !this.shop || !w.shops.includes(this.shop)) {
        if (this.shop && w.shops.includes(this.shop)) this.grumble(w);
        if (this.errand) this.postpone(this.errand);
        this.state = 'idle';
        this.shop = null;
        this.errand = null;
        this.slot = null;
        this.gate = -1;
        this.timer = 1.2;
      }
    } else {
      const talk = this.idle?.kind === 'talk' ? this.chatAt : null;
      const face = talk ?? this.face;
      // bij een ding in het park of aan de fontein: de passen ernaartoe en wat er onderweg gebeurt
      if (this.state === 'use' || (this.state === 'sit' && this.shop?.kind === 'fountain')) this.useStep(w);
      if (this.state === 'buy' && this.shop?.kind === 'toilet') this.toiletStep(dt, w, reach);
      // wie uit de rij aan de beurt is, stapt eerst naar de toonbank
      else if (!(this.state === 'buy' && this.shuffle(dt, reach)) && face) this.turnTo(face[0] - this.gx, face[1] - this.gy, dt);
      if (this.state === 'sit' && this.shop) {
        if (this.onRide) {
          // op een attractie of speeltoestel: het bezoek loopt gelijk met de klok van het toestel zelf (zie rides.ts)
          // en is voorbij zodra de gast weer op het pad staat. Is het toestel intussen weggehaald, dan meteen
          const ride = this.shop.ride;
          this.timer = ride && !this.rideOver && w.shops.includes(this.shop) ? visitTime(this.onRide) - visitAge(this.onRide, ride) + dt : 0;
        } else if (this.riding) {
          // in het treintje blijf je zitten tot de volgende halte; op het perron wacht je tot het komt
          this.timer = Math.max(this.timer, 1);
          this.peek = Math.max(0, this.peek - dt);
        } else if (this.shop.kind === 'station' && !this.rode) {
          this.waitT += dt;
          this.timer = this.waitT > 75 || !w.trainRuns() ? Math.min(this.timer, 0.2) : Math.max(this.timer, 1);
        } else if (this.shop.kind === 'cablecar' && !this.rode) {
          // op het perron van de kabelbaan: wachten tot er een stoeltje langs het wiel komt
          this.waitT += dt;
          this.timer = this.waitT > 60 || !w.liftRuns(this.shop) ? Math.min(this.timer, 0.2) : Math.max(this.timer, 1);
        } else if (this.shop.kind === 'shelter' && rain) this.timer = Math.max(this.timer, 1.5); // schuilen tot het droog is
        else if (this.shop.kind === 'show') {
          // op de tribune: blijven zitten tot de show voorbij is (wie te laat kwam, staat meteen weer op)
          this.showMood = w.showLive(this.shop);
          if (this.showMood === 2) this.rode = true;
          this.timer = this.showMood ? Math.max(this.timer, 1) : Math.min(this.timer, this.rode ? 1.2 : 0.3);
        }
      }
      this.timer -= dt;
      if (this.timer <= 0 && !this.finish(w)) {
        this.state = 'idle';
        this.decide(w, list, reach);
      }
    }
    // benen en armen zwaaien tijdens het lopen
    this.phase += dt * 11;
    swing(this.limbs, this.state === 'walk' || this.stepping ? Math.sin(this.phase * (this.dash > 0 ? 1.5 : 1)) * (this.wheels === 'chair' ? 0 : this.stepping ? 0.5 : 0.7) : 0);
    this.gesture(dt, rain && !this.umbrella && w.feature('weather'));
    this.place();
  }

  /**
   * Buiten de poort: over de stoep naar het pleintje en door de poort naar binnen, of na het bezoek de poort uit en de
   * stoep af. De gast loopt gewoon van punt naar punt (buiten het raster is er geen pad om te zoeken); honger, dorst
   * en boodschappen tellen hier niet.
   */
  private outdoors(dt: number, w: GuestWorld, reach: Set<number>): void {
    let way = this.walkway!;
    this.extras(dt, w);
    // het park is ineens dicht (het pad bij de ingang is weg): omkeren en de stoep weer af
    if (!way.out && !reach.has(ENTRANCE)) {
      const back = this.gx < W / 2 ? -1 : 1, y = Math.max(this.gy, pavementY());
      way = this.walkway = { pts: [[this.gx, y], [this.gx + back * 7, y]], out: true };
      this.leaving = true;
    }
    // een groepje en wie op wielen rijdt, gaat rustig; wie alleen aankomt, loopt vlot door (hij heeft er zin in)
    const speed = this.wheels || this.leading ? 0.85 : way.out ? 0.9 : 1.15;
    if (this.stall > 0) this.linger(dt);
    else {
      const [tx, ty] = way.pts[0];
      const dx = tx - this.gx, dy = ty - this.gy, dist = Math.hypot(dx, dy), step = speed * dt;
      if (dist <= step) {
        this.gx = tx;
        this.gy = ty;
        way.pts.shift();
      } else {
        this.gx += (dx / dist) * step;
        this.gy += (dy / dist) * step;
        this.turnTo(dx, dy, dt);
      }
      if (this.leading) this.mark();
      // de laatste halve tegel van de weg naar huis wordt hij kleiner, een eind bij de poort vandaan
      if (way.out && way.pts.length === 1 && this.sprout >= 1) this.mesh.scale.setScalar(this.size * Math.max(0.05, Math.min(1, dist / 0.5)));
      if (!way.pts.length) {
        if (way.out) {
          this.gone = true;
          return;
        }
        // binnen, op de tegel van de ingang: vanaf hier gaat het bezoek gewoon verder
        this.walkway = null;
        this.state = 'idle';
        this.timer = 0.05;
        this.place();
        return;
      }
    }
    this.state = 'walk';
    this.phase += dt * 11;
    swing(this.limbs, this.stall > 0 || this.wheels === 'chair' ? 0 : Math.sin(this.phase * (speed > 1 ? 1.2 : 1)) * 0.7);
    this.gesture(dt, false);
    this.place();
  }

  /** Rent de gast door de regen naar een droge plek? */
  private hurrying(w: GuestWorld): boolean {
    return !this.umbrella && (this.errand === 'shelter' || this.errand === 'umbrella') && w.raining() && w.feature('weather');
  }

  /**
   * Alles wat een gast met zijn armen, hoofd en lijf doet boven op het lopen of staan: zwaaien, wijzen, een foto
   * maken, klappen, aaien, turen, lachen, eten, juichen, mopperen, en kleine dingen tussendoor.
   */
  private gesture(dt: number, wet: boolean): void {
    const right = this.limbs[2], left = this.limbs[3], head = this.head;
    right.rotation.z = left.rotation.z = 0;
    head.rotation.set(0, 0, 0);
    this.hop = 0;
    this.lean = this.tilt = this.twist = 0;
    this.prep();
    const standing = this.state === 'idle' || this.state === 'queue' || this.state === 'watch';
    // in de rolstoel liggen de handen op de wielen; de kinderwagen duw je voor je uit
    if (this.wheels === 'chair') {
      this.limbs[0].rotation.x = this.limbs[1].rotation.x = -1.45;
      right.rotation.x = left.rotation.x = this.state === 'walk' ? -0.5 + Math.sin(this.phase * 0.5) * 0.35 : -0.4;
    } else if (this.wheels === 'pram') right.rotation.x = left.rotation.x = -1.25;
    // door de regen naar de schuilhut: de handen boven het hoofd
    else if (wet && this.state === 'walk' && (this.errand === 'shelter' || this.errand === 'umbrella')) {
      right.rotation.x = left.rotation.x = -2.7;
      right.rotation.z = -0.35;
      left.rotation.z = 0.35;
      this.lean = 0.14;
    }
    if (this.state === 'watch' && this.act) {
      this.actT += dt;
      const t = this.actT;
      // ssst, bah of ach: het geluidje bij de houding, één keer
      const snd = ACT_SOUND[this.act];
      if (snd && t >= snd[1] && t - dt < snd[1]) this.cue = snd[0];
      if (this.poseAct(t)) {
        // een van de houdingen die erbij zijn gekomen (ssst, meedoen, verrekijker, ...): zie poseAct
      } else if (this.act === 'wave') {
        right.rotation.x = -2.7;
        right.rotation.z = Math.sin(t * 9) * 0.45;
      } else if (this.act === 'point') {
        right.rotation.x = -1.45 + Math.sin(t * 3) * 0.06;
        head.rotation.x = -0.1;
      } else if (this.act === 'photo') {
        // de camera voor de ogen, en af en toe klik
        right.rotation.x = left.rotation.x = -1.95;
        this.lean = Math.sin(t * 2) > 0.9 ? -0.06 : 0;
      } else if (this.act === 'clap') {
        const clap = Math.abs(Math.sin(t * 10)) * 0.5;
        right.rotation.x = left.rotation.x = -1.25;
        right.rotation.z = -clap;
        left.rotation.z = clap;
      } else if (this.act === 'pet') {
        // vooroverbuigen en aaien
        this.lean = 0.42;
        right.rotation.x = -1.0 + Math.sin(t * 5) * 0.28;
        head.rotation.x = 0.2;
      } else if (this.act === 'jump') {
        this.hop = Math.abs(Math.sin(t * 7)) * 0.12;
        right.rotation.x = left.rotation.x = -2.8;
      } else if (this.act === 'peer') {
        // door je handen turen als door een verrekijker
        right.rotation.x = left.rotation.x = -2.3;
        right.rotation.z = 0.35;
        left.rotation.z = -0.35;
        head.rotation.y = Math.sin(t * 1.5) * 0.4;
      } else if (this.act === 'kneel') {
        // door de knieën om het beter te zien
        this.lean = 0.28;
        this.limbs[0].rotation.x = -0.9;
        this.limbs[1].rotation.x = 0.5;
        right.rotation.x = -0.7;
      } else if (this.act === 'call') {
        right.rotation.x = -2.4;
        right.rotation.z = 0.6;
        head.rotation.x = -0.2;
      } else {
        // lachen: schuddende schouders, handen op de buik
        this.hop = Math.abs(Math.sin(t * 12)) * 0.025;
        head.rotation.x = -0.2 + Math.sin(t * 12) * 0.1;
        right.rotation.x = left.rotation.x = -0.9;
        right.rotation.z = 0.5;
        left.rotation.z = -0.5;
      }
    } else if (standing && !this.wheels) {
      // iets kleins tussendoor
      this.idleIn -= dt;
      if (!this.idle && this.idleIn <= 0) {
        this.idle = { kind: pick(this.idleKinds(wet)), t: 0, dur: 1.4 + Math.random() * 1.6 };
      }
      const a = this.idle;
      if (a) {
        a.t += dt;
        const t = a.t, u = Math.min(1, t / a.dur);
        // een gaap of een zucht hoor je ook, één keer
        const snd = IDLE_SOUND[a.kind];
        if (snd && t >= snd[1] && t - dt < snd[1]) this.cue = snd[0];
        if (this.poseIdle(a.kind, t, u)) {
          // een van de kleine dingen die erbij zijn gekomen (gapen, zuchten, trappelen, ...): zie poseIdle
        } else if (a.kind === 'look') head.rotation.y = Math.sin(t * 2.2) * 0.9;
        else if (a.kind === 'scratch') {
          right.rotation.x = -2.6;
          right.rotation.z = 0.5 + Math.sin(t * 14) * 0.12;
          head.rotation.z = 0.12;
        } else if (a.kind === 'watch') {
          // op het horloge kijken
          left.rotation.x = -1.3;
          left.rotation.z = -0.7;
          head.rotation.x = 0.35;
        } else if (a.kind === 'stretch') {
          const s = Math.sin(u * Math.PI);
          right.rotation.x = left.rotation.x = -3.0 * s;
          right.rotation.z = -0.4 * s;
          left.rotation.z = 0.4 * s;
          this.lean = -0.12 * s;
        } else if (a.kind === 'selfie') {
          right.rotation.x = -1.9;
          right.rotation.z = -0.5;
          head.rotation.z = 0.15;
          this.twist = 0.25;
        } else if (a.kind === 'dance') {
          this.hop = Math.abs(Math.sin(t * 8)) * 0.07;
          this.twist = Math.sin(t * 8) * 0.4;
          right.rotation.x = -1.2 + Math.sin(t * 8) * 0.6;
          left.rotation.x = -1.2 - Math.sin(t * 8) * 0.6;
        } else if (a.kind === 'tap') this.limbs[0].rotation.x = -Math.abs(Math.sin(t * 9)) * 0.35;
        else if (a.kind === 'nod') head.rotation.x = Math.sin(t * 7) * 0.25;
        else if (a.kind === 'shiver') {
          // koud en nat: armen over elkaar en bibberen
          right.rotation.x = left.rotation.x = -1.1;
          right.rotation.z = 0.9;
          left.rotation.z = -0.9;
          this.twist = Math.sin(t * 38) * 0.05;
        } else if (a.kind === 'talk') {
          // kletsen: om de beurt een handgebaar en knikken
          right.rotation.x = -0.9 + Math.sin(t * 6) * 0.45;
          left.rotation.x = -0.5 + Math.cos(t * 5) * 0.3;
          head.rotation.x = Math.sin(t * 4) * 0.15;
        } else this.tilt = Math.sin(t * 2) * 0.07;
        if (t >= a.dur) {
          this.idle = null;
          this.chatAt = null;
          this.idleIn = 2.5 + Math.random() * 5;
        }
      }
    } else if (this.state === 'walk') this.idle = null;
    if (this.astray > 0) {
      // de weg kwijt: links en rechts kijken, en wie stilstaat houdt een hand boven de ogen en draait heen en weer
      head.rotation.y = Math.sin(this.phase * 0.2) * 0.95;
      if (this.state !== 'walk') {
        right.rotation.x = -2.45;
        right.rotation.z = 0.5;
        this.twist = Math.sin(this.phase * 0.09) * 0.35;
      }
    }
    // bij een ding in het park, op het bankje of aan de fontein; en het afval in de hand
    this.sightPose();
    if (this.state === 'buy' && this.shop?.kind !== 'toilet') right.rotation.x = -1.3; // de hand uitsteken naar de toonbank
    if (this.eating > 0) {
      // een hap of een slok: de hand gaat naar de mond en weer terug
      this.eating -= dt;
      this.munch();
      if (this.eating <= 0 && this.snack) {
        left.remove(this.snack);
        this.snack = null;
        // dat was lekker: even over de buik wrijven
        if (this.full) this.fire('rub');
      }
    }
    // de paraplu omhoog houden als het regent
    if (this.brolly?.visible) left.rotation.x = -2.5;
    // bij het weggaan nog even zwaaien
    if (this.leaving && this.fun > 0.6 && this.state === 'walk' && this.route.length < 3 && !this.wheels && !this.walkway) this.hello = Math.max(this.hello, 0.3);
    if (this.hello > 0) {
      this.hello -= dt;
      right.rotation.x = -2.7;
      right.rotation.z = Math.sin(this.phase * 0.85) * 0.5;
    }
    // het muntje, de ballon, hoge nood, ongeduld, slaperig lopen en de korte gebaren (schrikken, bah, ...)
    this.overlay(dt);
    if (this.moan > 0) {
      // mopperen: handen in de zij en heen en weer draaien
      this.moan -= dt;
      right.rotation.x = left.rotation.x = -0.5;
      right.rotation.z = -0.5;
      left.rotation.z = 0.5;
      this.tilt = Math.sin(this.moan * 14) * 0.08;
      head.rotation.y = Math.sin(this.moan * 9) * 0.5;
    }
    if (this.joy > 0) {
      // juichen: armen omhoog en springen
      this.joy -= dt;
      right.rotation.x = left.rotation.x = -2.9;
      this.hop = Math.abs(Math.sin(this.joy * 9)) * 0.13;
    } else if (this.child && this.state === 'walk' && this.fun > 0.6 && this.stall <= 0 && !(this.sky & 1)) this.hop = Math.abs(Math.sin(this.phase * 0.5)) * 0.05; // een blij kind huppelt
    // het avondfeest: onder het lopen af en toe zwaaien, de een wat vaker dan de ander
    if (this.partyRound && this.state === 'walk' && this.joy <= 0 && !this.wheels && Math.sin(this.phase * 0.06 + this.seat * 1.7) > -0.1) {
      right.rotation.x = -2.7;
      right.rotation.z = Math.sin(this.phase * 0.8) * 0.45;
    }
  }

  // ------------------------------------------------------------ extra houdingen en dingen in de hand
  /** Loopt of staat de gast gewoon op het pad (niet op een bankje, in een attractie, op de wc of in de trein)? */
  private get afoot(): boolean {
    return (this.state === 'walk' || this.state === 'idle' || this.state === 'watch' || this.state === 'queue') && !this.riding && !this.walkway;
  }

  /** Hoge nood en op weg naar de wc: dan zet de gast er de pas in. */
  private get bursting(): boolean {
    return this.bladder > 0.85 && this.errand === 'toilet';
  }

  /** Begin een kort gebaar. `stall`: zo lang blijft de gast er even voor staan als hij liep; `gaze`: hij kijkt naar (lookX, lookY). */
  private fire(kind: Shot, stall = 0, gaze = false): void {
    // in een rolstoel of achter de kinderwagen geen gebaren met de benen
    if (this.wheels && (kind === 'stomp' || kind === 'startle' || kind === 'dizzy' || kind === 'slump' || kind === 'yuck')) return;
    this.calm();
    this.shot = kind;
    this.shotT = 0;
    this.gaze = gaze;
    this.stall = Math.max(this.stall, stall);
  }

  /** Het gebaar is voorbij: wat het verplaatst heeft (het hoedje, de paraplu, de knuffel) staat weer op zijn plek. */
  private calm(): void {
    this.shot = null;
    this.gaze = false;
    if (this.headwear) {
      this.headwear.position.set(0, 0, 0);
      this.headwear.rotation.set(0, 0, 0);
    }
    if (this.brolly) {
      this.brolly.rotation.set(0, 0, 0);
      this.brolly.scale.set(1, 1, 1);
    }
    if (this.plush) this.plush.position.set(PLUSH_REST[0], PLUSH_REST[1], PLUSH_REST[2]);
  }

  /** Even stilstaan tijdens het lopen, en kijken naar waar het om gaat. */
  private linger(dt: number): void {
    if (this.gaze) this.turnTo(this.lookX - this.gx, this.lookY - this.gy, dt);
  }

  /** De knuffel uit de knuffelkraam gaat mee onder de arm. */
  private takePlush(product?: string): void {
    if (this.plush) this.mesh.remove(this.plush);
    this.plush = makePlush(product);
    this.mesh.add(this.plush);
  }

  /** De verrekijker voor de ogen (hij verdwijnt vanzelf weer als de gast er niet meer door kijkt). */
  private spy(): void {
    if (!this.scope) this.head.add((this.scope = makeScope()));
    this.scope.visible = true;
  }

  /** Net uit een attractie: duizelig wiebelen, of een high five met wie er tegelijk uitstapt. */
  private afterRide(): void {
    const mate = offRide;
    if (mate && mate !== this && !mate.gone && !mate.wheels && crowdClock - offRideAt < 0.8 && mate.shot !== 'five' && Math.hypot(mate.gx - this.gx, mate.gy - this.gy) < 1.2) {
      offRide = null;
      this.lookX = mate.gx;
      this.lookY = mate.gy;
      mate.lookX = this.gx;
      mate.lookY = this.gy;
      this.fire('five', 1.3, true);
      mate.fire('five', 1.3, true);
      return;
    }
    offRide = this;
    offRideAt = crowdClock;
    if (Math.random() < 0.6) this.fire('dizzy', 1.4);
  }

  /**
   * Kijken wat de dieren doen en de houding daarbij kiezen: ssst bij slapende dieren, sip bij een ziek dier, de neus
   * dicht bij een vies verblijf, meedoen als er een speelt, en even schrikken als er een ineens vlak bij het hek
   * komt of zich laat horen. `first`: de gast komt net aan.
   */
  private eyePen(w: GuestWorld, first: boolean): void {
    const mood = w.penMood(this.tile), was = this.mood;
    this.mood = mood;
    if (first) {
      this.ownAct = this.act;
      this.heeds = Math.random() < 0.75;
      this.penEnd = this.age + this.timer;
      if (w.dark(this.tile)) {
        // te donker om iets te zien: de schouders hangen
        this.act = 'gloom';
        this.heeds = false;
        return;
      }
      // de gast zoekt zijn lievelingsdier al een poos, en hier staat het weer niet
      if (this.fav && !this.favSeen && this.age > 40 && !this.sees.includes(this.fav) && Math.random() < 0.35) this.fire('slump');
    }
    if (!this.heeds) return;
    const act: Act | null = mood & PEN.asleep ? 'hush' : mood & PEN.sick ? 'pity' : mood & PEN.dirty ? 'stink' : mood & PEN.playing ? 'join' : this.ownAct;
    if (act !== this.act) {
      this.act = act;
      this.actT = 0;
    }
    if (!first && mood & PEN.scare && !(was & PEN.scare) && !(mood & PEN.asleep) && !this.shot && this.act !== 'ground' && Math.random() < 0.4) this.fire('startle');
  }

  /**
   * Elk beeldje, voor de gast loopt of staat: de wielen draaien, de ballon vliegt soms weg, de paraplu wordt
   * uitgeschud, en de gast let op wat er om hem heen is (iets vies op het pad, een plas, een ontsnapt dier, de
   * beroemde gast, wat de dieren doen).
   */
  private extras(dt: number, w: GuestWorld): void {
    this.sky = (w.isNight() ? 1 : 0) | (w.rainbowUp() ? 2 : 0);
    const afoot = this.afoot && !this.inside;
    if (this.rims.length) {
      // de wielen draaien mee met de weg die de gast aflegt
      const d = Math.hypot(this.gx - this.lastX, this.gy - this.lastY);
      if (d < 0.5) for (let i = 0; i < this.rims.length; i++) this.rims[i].rotation.x += d / this.rimR[i];
      this.lastX = this.gx;
      this.lastY = this.gy;
    }
    // het is droog: de paraplu gaat dicht, maar eerst even uitschudden (niet allemaal tegelijk)
    const dry = !this.brolly?.visible;
    if (dry && !this.wasDry && afoot && !this.shot) {
      this.fire('shake');
      this.shotT = -Math.random() * 1.5;
    }
    this.wasDry = dry;
    // een nieuwe tegel: ligt er iets vies, of een plas om in te stampen?
    const tile = this.tile;
    if (tile !== this.lastTile) {
      this.lastTile = tile;
      if (this.state === 'walk' && afoot && !this.shot && !this.wheels && !this.special && this.astray <= 0 && this.age > this.calmUntil && this.bladder <= 0.85 && this.errand !== 'shelter' && this.errand !== 'umbrella') {
        if (this.child && w.puddleOn(tile)) {
          this.fire('stomp', 1.5);
          this.calmUntil = this.age + 10;
          w.splash(this.gx, this.gy);
        } else if (Math.random() < 0.6 && w.litterOn(tile)) {
          this.fire('yuck', 1.2);
          this.calmUntil = this.age + 20;
        }
      }
    }
    if (this.shot === 'stomp' && this.shotT < 0.75 && this.shotT + dt >= 0.75) w.splash(this.gx, this.gy);
    this.scanIn -= dt;
    if (this.scanIn <= 0) {
      this.scanIn = 0.7 + Math.random() * 0.4;
      // bij een regenboog kijkt iedereen wat eerder op
      if (this.sky & 2 && this.idleIn > 2.5) this.idleIn = 2.5;
      if (this.heeds && this.state === 'watch' && this.age < this.penEnd && !this.pen) this.eyePen(w, false);
      if (afoot && this.age > this.calmUntil && w.looseNear(this.gx, this.gy, LOOSE_AT)) {
        // een ontsnapt dier! Wijzen en roepen, en een stap opzij
        this.lookX = LOOSE_AT[0];
        this.lookY = LOOSE_AT[1];
        this.fire('alarm', 2, true);
        this.calmUntil = this.age + 10;
      } else if (theStar && theStar !== this && !this.fanned && afoot && !this.special && !this.shot && this.state !== 'queue' && this.bladder < 0.6 && Math.hypot(theStar.gx - this.gx, theStar.gy - this.gy) < 1.7) {
        // de beroemde gast! Een foto maken of om een handtekening vragen; de ster zwaait terug
        this.fanned = true;
        if (Math.random() < 0.7) {
          this.lookX = theStar.gx;
          this.lookY = theStar.gy;
          this.fire('fan', 2.2, true);
          theStar.greet();
        }
      }
    }
    // af en toe de knuffel even knuffelen
    if (this.plush && afoot && !this.shot && this.eating <= 0) {
      this.hugIn -= dt;
      if (this.hugIn <= 0) {
        this.hugIn = (this.child ? 6 : 11) + Math.random() * 8;
        this.fire('hug');
      }
    }
    // de ballon die loskomt, het ijsje dat valt, een kind zonder geld
    this.kidMoments(dt, w, afoot);
  }

  /** Aan het begin van elk beeldje: alles wat een houding kan verzetten, staat weer gewoon. */
  private prep(): void {
    this.back = this.aside = 0;
    this.limbs[0].rotation.z = this.limbs[1].rotation.z = 0;
    if (this.scope) this.scope.visible = false;
    if (this.coin) this.coin.visible = false;
    if (this.feedBag) this.feedBag.visible = this.feeder;
    // wie even blijft staan voor een gebaar, zwaait niet met armen en benen
    if (this.stall > 0 && this.state === 'walk') swing(this.limbs, 0);
  }

  /** Uit welke kleine dingen de gast nu kiest als hij even stilstaat. */
  private idleKinds(wet: boolean): Idle[] {
    if (wet) return IDLES.wet;
    if (this.state === 'queue') return this.child ? IDLES.queueChild : this.waited > PATIENCE * 0.25 ? IDLES.queueLong : IDLES.queue;
    if (this.sky & 2) return IDLES.rainbow;
    if (this.sky & 1) return IDLES.night;
    return this.child ? IDLES.child : IDLES.adult;
  }

  /** Eten of drinken van wat de gast in zijn hand heeft: likken aan een ijsje, een slok door het rietje of een hap en kauwen. */
  private munch(): void {
    const left = this.limbs[3], head = this.head;
    left.rotation.z = 0.45;
    if (this.bite === 'lick') {
      // het ijsje bij de mond houden en likken, en af en toe even kijken hoeveel er nog is
      const c = (this.phase * 0.045) % 1, up = smooth(0, 0.15, c) * (1 - smooth(0.75, 0.95, c));
      left.rotation.x = -1.25 - 0.3 * up;
      head.rotation.x = (0.15 + Math.sin(this.phase * 0.9) * 0.1) * up;
      this.nibble(c, 0.12, 'guest.yum');
    } else if (this.bite === 'sip') {
      // de beker omhoog, het hoofd naar het rietje en een lange slok
      const c = (this.phase * 0.035) % 1, up = smooth(0.1, 0.3, c) * (1 - smooth(0.7, 0.9, c));
      left.rotation.x = -1.15 - 0.4 * up;
      head.rotation.x = 0.2 * up;
      this.nibble(c, 0.3, 'guest.slurp');
    } else {
      // een hap nemen en dan kauwen
      const c = (this.phase * 0.055) % 1, up = smooth(0, 0.18, c) * (1 - smooth(0.3, 0.5, c));
      left.rotation.x = -1.1 - 0.5 * up;
      head.rotation.x = 0.2 * smooth(0.15, 0.25, c) * (1 - smooth(0.3, 0.4, c)) + (c > 0.45 ? Math.sin(this.phase * 1.4) * 0.05 : 0);
      this.nibble(c, 0.16, 'guest.bite');
    }
  }

  /** Het geluidje bij een lik, een slok of een hap: op het moment dat de hand bij de mond is (`at`, in de beweging `c`), en niet bij elke. */
  private nibble(c: number, at: number, kind: GuestCue): void {
    if (this.chewC < at && c >= at && Math.random() < 0.5) this.cue = kind;
    this.chewC = c;
  }

  /** De houdingen bij een verblijf die erbij zijn gekomen. Geeft true als dit er een van was. */
  private poseAct(t: number): boolean {
    const legs = this.limbs, right = legs[2], left = legs[3], head = this.head, flip = this.seat % 2 ? 1 : -1;
    // vlak voor de gast verder loopt, komt hij weer gewoon te staan (wie achter een leider aan loopt, heeft geen eigen klok)
    const out = this.leader ? 1 : smooth(0, 0.35, this.timer);
    switch (this.act) {
      case 'join': {
        // het dier speelt: meedoen! Een kind springt mee, een groot mens danst
        const b = Math.sin(t * 8);
        this.hop = Math.abs(b) * (this.child ? 0.13 : 0.05);
        this.twist = Math.sin(t * 4) * 0.35;
        right.rotation.x = -1.9 + b * 0.7;
        left.rotation.x = -1.9 - b * 0.7;
        right.rotation.z = 0.3;
        left.rotation.z = -0.3;
        head.rotation.z = Math.sin(t * 4) * 0.15;
        return true;
      }
      case 'hush': {
        // ssst, het dier slaapt: een vinger voor de mond, en af en toe omkijken naar de anderen
        const turn = Math.max(0, Math.sin(t * 1.3) - 0.5) * 2;
        right.rotation.x = -2.3;
        right.rotation.z = -0.78;
        this.lean = 0.1;
        head.rotation.y = turn * 0.9 * flip;
        left.rotation.x = turn * (-0.9 + Math.sin(t * 6) * 0.15);
        return true;
      }
      case 'pity': {
        // ach, het dier is ziek: hoofd schuin, handen samen voor de borst
        right.rotation.x = left.rotation.x = -1;
        right.rotation.z = -0.55;
        left.rotation.z = 0.55;
        head.rotation.x = 0.3;
        head.rotation.z = Math.sin(t * 0.9) * 0.2;
        this.lean = 0.12;
        this.tilt = Math.sin(t * 1.2) * 0.04;
        return true;
      }
      case 'tiptoe': {
        // een kind op zijn tenen bij het hek: handen op de rand, hoofd omhoog en een beetje wiebelen
        const up = smooth(0, 0.4, t) * out;
        this.hop = (0.05 + Math.max(0, Math.sin(t * 2.3)) * 0.015) * up;
        this.lean = 0.14 * up;
        this.tilt = Math.sin(t * 2.3) * 0.04 * up;
        right.rotation.x = left.rotation.x = -1.25 * up;
        legs[0].rotation.x = legs[1].rotation.x = 0.1 * up;
        head.rotation.x = -0.25 * up;
        return true;
      }
      case 'scope': {
        // door de verrekijker: langzaam van links naar rechts
        const up = smooth(0, 0.5, t) * out;
        right.rotation.x = left.rotation.x = -2.25 * up;
        right.rotation.z = -0.5 * up;
        left.rotation.z = 0.5 * up;
        this.twist = Math.sin(t * 0.9) * 0.45 * up;
        head.rotation.x = -0.08;
        if (up > 0.8) this.spy();
        return true;
      }
      case 'stink': {
        // bah, wat stinkt het hier: de neus dicht, wapperen met de andere hand en een beetje achterover
        right.rotation.x = -2.3;
        right.rotation.z = -0.78;
        left.rotation.x = -1.5 + Math.sin(t * 11) * 0.3;
        left.rotation.z = Math.sin(t * 11) * 0.4;
        this.lean = -0.14;
        this.back = 0.08;
        head.rotation.y = 0.45 * flip;
        head.rotation.x = -0.1;
        return true;
      }
      case 'feed': {
        // uit de hand voeren: een greep in het zakje, vooroverbuigen en de hand ophouden
        const c = (t % 3.2) / 3.2, dip = c < 0.2 ? Math.sin((c / 0.2) * Math.PI) : 0, offer = smooth(0.2, 0.35, c) * (1 - smooth(0.9, 1, c));
        this.lean = 0.12 + 0.3 * offer;
        left.rotation.x = -0.9;
        left.rotation.z = 0.25;
        right.rotation.x = -0.9 * dip - (1.05 + Math.sin(t * 9) * 0.05) * offer;
        right.rotation.z = -0.6 * dip;
        head.rotation.x = 0.1 + 0.15 * offer;
        return true;
      }
      case 'ground': {
        // even op de grond zitten: benen vooruit, achterover leunen op de handen en rondkijken
        const k = smooth(0, 0.45, t) * out;
        this.hop = -0.15 * this.mesh.scale.y * k;
        this.lean = -0.16 * k;
        legs[0].rotation.x = -1.36 * k;
        legs[1].rotation.x = (-1.36 + (this.child ? Math.sin(t * 3) * 0.15 : 0)) * k;
        legs[0].rotation.z = 0.12 * k;
        legs[1].rotation.z = -0.12 * k;
        right.rotation.x = left.rotation.x = 0.55 * k;
        right.rotation.z = 0.2 * k;
        left.rotation.z = -0.2 * k;
        head.rotation.y = Math.sin(t * 0.8) * 0.3;
        return true;
      }
      case 'gloom': {
        // te donker om iets te zien: de schouders hangen, turen en het hoofd schudden
        this.lean = 0.14;
        this.hop = -0.012;
        head.rotation.x = 0.28;
        head.rotation.y = Math.sin(t * 1.1) > 0.3 ? Math.sin(t * 5) * 0.3 : 0;
        right.rotation.x = left.rotation.x = 0.08;
        return true;
      }
      case 'toss': {
        // confetti gooien: door de knieën en dan allebei de armen omhoog
        const c = (t * 0.9) % 1, up = smooth(0.25, 0.5, c) * (1 - smooth(0.8, 1, c));
        right.rotation.x = left.rotation.x = -0.4 - 2.5 * up;
        right.rotation.z = 0.35 * up;
        left.rotation.z = -0.35 * up;
        this.hop = up * 0.08;
        head.rotation.x = -0.2 * up;
        return true;
      }
    }
    return false;
  }

  /** De kleine dingen tussendoor die erbij zijn gekomen. Geeft true als dit er een van was. */
  private poseIdle(kind: Idle, t: number, u: number): boolean {
    const legs = this.limbs, right = legs[2], left = legs[3], head = this.head, s = Math.sin(u * Math.PI);
    switch (kind) {
      case 'yawn':
        // gapen: een hand voor de mond, de andere arm rekt zich uit, het hoofd achterover
        right.rotation.x = -2.3 * s;
        right.rotation.z = -0.78 * s;
        left.rotation.x = -2.9 * s;
        left.rotation.z = -0.5 * s;
        head.rotation.x = -0.3 * s;
        this.lean = -0.08 * s;
        return true;
      case 'sigh': {
        // zuchten: de schouders omhoog en dan alles laten zakken
        const up = smooth(0, 0.35, u) * (1 - smooth(0.4, 0.6, u)), down = smooth(0.5, 0.75, u) * (1 - smooth(0.9, 1, u));
        this.hop = 0.02 * up;
        this.lean = 0.1 * down;
        head.rotation.x = -0.2 * up + 0.3 * down;
        right.rotation.x = left.rotation.x = 0.1 * s;
        return true;
      }
      case 'peek': {
        // op de tenen opzij leunen met een hand boven de ogen: hoe lang is de rij nog?
        const side = this.seat % 2 ? 1 : -1;
        this.hop = 0.05 * s;
        this.tilt = 0.2 * s * side;
        head.rotation.z = -0.15 * s * side;
        head.rotation.x = -0.12 * s;
        right.rotation.x = -2.45 * s;
        right.rotation.z = -0.5 * s;
        return true;
      }
      case 'rainbow': {
        // kijk, een regenboog: omhoog wijzen en kijken
        const up = smooth(0, 0.2, u) * (1 - smooth(0.85, 1, u));
        right.rotation.x = (-2.5 + Math.sin(t * 3) * 0.07) * up;
        right.rotation.z = 0.25 * up;
        head.rotation.x = -0.4 * up;
        this.lean = -0.08 * up;
        return true;
      }
      case 'fidget': {
        // trappelen van ongeduld: van de ene voet op de andere
        const b = Math.sin(t * 10);
        legs[0].rotation.x = -Math.max(0, b) * 0.5;
        legs[1].rotation.x = -Math.max(0, -b) * 0.5;
        this.tilt = b * 0.07;
        this.hop = Math.abs(b) * 0.02;
        right.rotation.x = left.rotation.x = -0.5 + b * 0.2;
        return true;
      }
    }
    return false;
  }

  /**
   * Wat boven op de gewone houding komt: het muntje bij de toonbank, de ballon die aan zijn touwtje trekt, de
   * knuffel onder de arm, hoge nood, ongeduld in de rij, slaperig lopen in de nacht, en de korte gebaren.
   */
  private overlay(dt: number): void {
    const legs = this.limbs, right = legs[2], left = legs[3], head = this.head;
    // (het stilstaan voor een gebaar loopt hier af, zodat het ook stopt bij wie achter een leider aan loopt)
    if (this.stall > 0) this.stall -= dt;
    const walking = this.state === 'walk' && this.stall <= 0, afoot = this.afoot, flip = this.seat % 2 ? 1 : -1;
    if (this.state === 'buy' && this.shop && this.shop.kind !== 'toilet') {
      // bij de toonbank: een muntje in de hand, en dat even later aangeven
      const e = 1 - this.timer / (SERVE_TIME[this.shop.kind] ?? 3), give = smooth(0.5, 0.6, e) * (1 - smooth(0.68, 0.8, e));
      right.rotation.x = -1.3 - 0.3 * give;
      this.lean = 0.1 * give;
      if (e > 0.08 && e < 0.64) {
        if (!this.coin) {
          this.coin = bit(BRIM_GEO, 0xffd23f, 0, -0.2, 0.04, 0.26, 1.2, 0.26);
          this.coin.rotation.x = Math.PI / 2;
          right.add(this.coin);
        }
        this.coin.visible = true;
      }
    }
    const g = this.balloonG;
    if (g && this.flown < 0 && this.homing < 0) {
      // de ballon trekt omhoog aan zijn touwtje en wiebelt; bij het lopen blijft hij een beetje achter
      g.rotation.z = Math.sin(this.phase * 0.11) * 0.1;
      g.rotation.x = walking ? -0.2 + Math.sin(this.phase * 0.23) * 0.05 : Math.sin(this.phase * 0.07) * 0.06;
      g.position.y = BALLOON_AT[1] + Math.abs(Math.sin(this.phase * 0.13)) * 0.03;
      // de hand houdt het touwtje vast
      if (afoot && right.rotation.z === 0 && right.rotation.x > -0.75) {
        right.rotation.x = -0.55 + right.rotation.x * 0.3;
        right.rotation.z = 0.3;
      }
    }
    // de knuffel zit onder de arm geklemd; het zakje voer draag je voor je buik
    if (this.plush && afoot && this.trash <= 0 && left.rotation.z === 0 && left.rotation.x > -0.75) {
      left.rotation.x *= 0.35;
      left.rotation.z = -0.3;
    }
    if (this.feeder && this.act !== 'feed') left.rotation.x = -0.85;
    if (this.bladder > 0.85 && afoot && !this.wheels && !this.shot) {
      // hoge nood: de benen tegen elkaar, de handen ervoor en wiebelen
      legs[0].rotation.z = -0.16;
      legs[1].rotation.z = 0.16;
      right.rotation.x = left.rotation.x = -0.5;
      right.rotation.z = -0.55;
      left.rotation.z = 0.55;
      this.lean = 0.12;
      if (!walking) {
        const b = Math.sin(this.phase * 1.2);
        this.tilt = b * 0.09;
        this.hop = Math.abs(b) * 0.02;
        legs[0].rotation.x = -Math.max(0, b) * 0.25;
        legs[1].rotation.x = -Math.max(0, -b) * 0.25;
        head.rotation.x = -0.1;
      }
    } else if (this.state === 'queue' && !this.idle && !this.stepping && !this.wheels && !this.shot) {
      if (this.child) {
        // een kind in de rij kan niet stilstaan
        this.tilt = Math.sin(this.phase * 0.5) * 0.05;
        this.hop = Math.max(0, Math.sin(this.phase)) * 0.02;
      } else if (this.waited > PATIENCE * 0.45 && this.eating <= 0) {
        // al lang in de rij: de armen over elkaar en met de voet tikken
        right.rotation.x = left.rotation.x = -1.06;
        right.rotation.z = -1.05;
        left.rotation.z = 1.05;
        legs[0].rotation.x = -Math.abs(Math.sin(this.phase * 0.8)) * 0.3;
        head.rotation.z = 0.1;
      }
    } else if (this.sky & 1 && walking && !this.wheels && !this.shot && this.dash <= 0 && this.eating <= 0) {
      // 's nachts: slaperig lopen, het hoofd knikkebolt en af en toe een gaap
      this.lean += 0.09;
      head.rotation.x = 0.22 + Math.sin(this.phase * 0.12) * 0.12;
      if (right.rotation.z === 0) right.rotation.x *= 0.45;
      if (left.rotation.z === 0 && !this.brolly?.visible && this.trash <= 0) left.rotation.x *= 0.45;
      if (Math.sin(this.phase * 0.035 + this.seat * 2) > 0.92) {
        right.rotation.x = -2.3;
        right.rotation.z = -0.78;
        head.rotation.x = -0.25;
      }
    }
    if (this.shot) {
      this.shotT += dt;
      const kind = this.shot, t = this.shotT, u = Math.max(0, t / SHOT_TIME[kind]);
      // `e`: het gebaar komt rustig op en gaat rustig weer weg
      const e = smooth(0, 0.2, u) * (1 - smooth(0.8, 1, u));
      // het geluidje bij het gebaar: één keer, op zijn eigen moment
      const snd = SHOT_SOUND[kind];
      if (snd && t >= snd[1] && t - dt < snd[1]) this.cue = snd[0];
      if (u >= 1) this.calm();
      else if (kind === 'shake') {
        // de paraplu naar opzij, half dicht, en de druppels eraf schudden (tot het zover is blijft hij nog even omhoog)
        const b = this.brolly;
        if (b) {
          b.visible = true;
          b.scale.set(1 - 0.5 * e, 1 - 0.25 * e, 1 - 0.5 * e);
          b.rotation.z = (0.7 + Math.sin(t * 22) * 0.12) * e;
        }
        left.rotation.x = -2.5 * (1 - e);
        left.rotation.z = (-0.9 + Math.sin(t * 22) * 0.1) * e;
      } else if (t < 0) {
        // nog even wachten
      } else if (kind === 'startle') {
        // schrikken: een sprongetje en een stap achteruit, de handen omhoog
        const k = smooth(0, 0.15, u) * (1 - smooth(0.6, 1, u));
        this.back = 0.22 * k;
        this.hop = Math.sin(Math.min(1, u / 0.3) * Math.PI) * 0.1;
        this.lean = -0.22 * k;
        right.rotation.x = left.rotation.x = -2 * k;
        right.rotation.z = 0.4 * k;
        left.rotation.z = -0.4 * k;
        head.rotation.x = -0.15 * k;
      } else if (kind === 'slump') {
        // teleurgesteld: de schouders hangen, het hoofd omlaag en even schudden
        this.lean = 0.2 * e;
        this.hop = -0.02 * e;
        head.rotation.x = 0.4 * e;
        head.rotation.y = u > 0.4 ? Math.sin(t * 6) * 0.2 * e : 0;
        right.rotation.x = left.rotation.x = -0.12 * e;
      } else if (kind === 'rub') {
        // dat was lekker: over de buik wrijven
        left.rotation.x = (-0.56 + Math.sin(t * 9) * 0.14) * e;
        left.rotation.z = (0.78 + Math.cos(t * 9) * 0.14) * e;
        head.rotation.x = -0.15 * e;
        this.lean -= 0.06 * e;
      } else if (kind === 'hug') {
        // de knuffel even stevig tegen zich aan
        right.rotation.x = left.rotation.x = -1.06 * e;
        right.rotation.z = -1.05 * e;
        left.rotation.z = 1.05 * e;
        head.rotation.x = 0.25 * e;
        head.rotation.z = 0.2 * e;
        this.tilt = Math.sin(t * 5) * 0.08 * e;
        if (this.plush) this.plush.position.set(PLUSH_REST[0] + (PLUSH_HUG[0] - PLUSH_REST[0]) * e, PLUSH_REST[1] + (PLUSH_HUG[1] - PLUSH_REST[1]) * e, PLUSH_REST[2] + (PLUSH_HUG[2] - PLUSH_REST[2]) * e);
      } else if (kind === 'don') {
        // het hoedje opzetten met een zwier: omhoog met een boog, een draai erbij en dan op het hoofd
        const a = smooth(0, 0.45, u), b = smooth(0.45, 0.8, u), off = 1 - smooth(0.85, 1, u);
        const ax = -1.3 - 1.5 * a, az = 0.6 * Math.sin(a * Math.PI) * (1 - b) - 0.5 * b;
        right.rotation.x = ax * off;
        right.rotation.z = az * off;
        if (this.headwear) {
          // het hoedje zit eerst in de hand
          this.headwear.position.set((0.13 + 0.2 * Math.sin(az)) * (1 - b), (0.41 - 0.2 * Math.cos(ax) * Math.cos(az) - 0.66) * (1 - b), -0.2 * Math.sin(ax) * Math.cos(az) * (1 - b));
          this.headwear.rotation.y = b * Math.PI * 2;
        }
        this.hop = Math.sin(smooth(0.8, 1, u) * Math.PI) * 0.05;
        head.rotation.z = 0.15 * b * off;
      } else if (kind === 'relief') {
        if (u < 0.4) {
          // hè hè: een diepe zucht
          const k = Math.sin((u / 0.4) * Math.PI);
          this.lean = -0.1 * k;
          head.rotation.x = -0.25 * k;
          right.rotation.x = left.rotation.x = 0.15 * k;
        } else {
          // en de handen droog schudden
          const k = 1 - smooth(0.85, 1, u);
          right.rotation.x = (-0.75 + Math.sin(t * 28) * 0.25) * k;
          left.rotation.x = (-0.75 + Math.cos(t * 28) * 0.25) * k;
          head.rotation.x = 0.15 * k;
        }
      } else if (kind === 'alarm') {
        // kijk daar, een dier is los! Wijzen, roepen en een stap opzij
        right.rotation.x = (-1.5 + Math.sin(t * 10) * 0.08) * e;
        left.rotation.x = -2.3 * e;
        left.rotation.z = 0.5 * e;
        this.hop = Math.abs(Math.sin(t * 8)) * 0.04 * e;
        this.aside = 0.2 * e * flip;
        this.lean = -0.08 * e;
        head.rotation.x = -0.1 * e;
      } else if (kind === 'yuck') {
        // bah: de neus dicht, afweren met de andere hand en een stap opzij
        right.rotation.x = -2.3 * e;
        right.rotation.z = -0.78 * e;
        left.rotation.x = -1.3 * e;
        left.rotation.z = -0.4 * e;
        this.aside = 0.24 * e * flip;
        this.lean = -0.12 * e;
        this.tilt = 0.1 * e * flip;
        head.rotation.y = 0.5 * e * flip;
        head.rotation.x = -0.1 * e;
      } else if (kind === 'dizzy') {
        // duizelig van het draaien: wiebelen met de armen wijd
        this.tilt = Math.sin(t * 6) * 0.16 * e;
        this.lean = Math.cos(t * 6) * 0.1 * e;
        this.twist = Math.sin(t * 3) * 0.3 * e;
        right.rotation.x = left.rotation.x = -0.2 * e;
        right.rotation.z = e;
        left.rotation.z = -e;
        legs[0].rotation.z = 0.12 * e;
        legs[1].rotation.z = -0.12 * e;
        head.rotation.z = Math.sin(t * 6 + 1) * 0.25 * e;
      } else if (kind === 'five') {
        // een high five: de hand omhoog en klap
        const k = smooth(0.1, 0.45, u) * (1 - smooth(0.7, 1, u));
        right.rotation.x = -2.5 * k;
        right.rotation.z = -0.3 * k;
        this.hop = Math.sin(smooth(0.35, 0.6, u) * Math.PI) * 0.07;
      } else if (kind === 'fan') {
        if (flip > 0) {
          // een foto van de ster: de camera voor de ogen, en klik
          right.rotation.x = left.rotation.x = -1.95 * e;
          right.rotation.z = -0.35 * e;
          left.rotation.z = 0.35 * e;
          this.lean = Math.sin(t * 4) > 0.9 ? -0.06 : 0;
        } else {
          // om een handtekening vragen: zwaaien, springen en het boekje ophouden
          right.rotation.x = -2.7 * e;
          right.rotation.z = Math.sin(t * 9) * 0.45 * e;
          left.rotation.x = -1.4 * e;
          this.hop = Math.abs(Math.sin(t * 9)) * 0.06 * e;
        }
      } else if (kind === 'lookup') {
        // de ballon is weg: ernaar reiken en hem nakijken, en dan sip het hoofd laten hangen
        const up = 1 - smooth(0.7, 0.8, u), sad = smooth(0.75, 0.85, u) * (1 - smooth(0.92, 1, u));
        head.rotation.x = -0.55 * up * e + 0.4 * sad;
        right.rotation.x = -2.9 * up * e;
        right.rotation.z = 0.2 * up * e;
        this.hop = t < 1.2 ? Math.abs(Math.sin(t * 7)) * 0.08 : 0;
        this.lean = -0.08 * up * e + 0.15 * sad;
      } else if (kind === 'stomp') {
        // in de plas stampen: om de beurt een voet omhoog en hard neer
        const b = Math.sin(t * 9);
        legs[0].rotation.x = -Math.max(0, b) * 0.9 * e;
        legs[1].rotation.x = -Math.max(0, -b) * 0.9 * e;
        this.hop = Math.abs(b) * 0.05 * e;
        this.tilt = b * 0.06 * e;
        right.rotation.x = left.rotation.x = -0.6 * e;
        right.rotation.z = 0.7 * e;
        left.rotation.z = -0.7 * e;
        head.rotation.x = 0.3 * e;
      }
      // meedraaien naar waar het om gaat (wie liep, draait zich helemaal om: zie `linger`)
      if (this.gaze && this.shot) {
        const d = Math.atan2(this.lookX - this.gx, this.lookY - this.gy) - this.heading;
        this.twist += Math.atan2(Math.sin(d), Math.cos(d)) * e;
      }
    }
    this.kidPose();
    // in de rolstoel of achter de kinderwagen blijft het lijf recht
    if (this.wheels) this.hop = this.lean = this.tilt = this.back = this.aside = 0;
  }

  // ------------------------------------------------------------ momentjes met kinderen (zie kids.ts)
  /**
   * De ballon die loskomt en wegvliegt (of terugkomt), het ijsje dat valt, en een kind dat geen geld meer heeft. Een
   * kind dat om hulp vraagt, blijft staan tot het geholpen is of het opgeeft.
   */
  private kidMoments(dt: number, w: GuestWorld, afoot: boolean): void {
    this.flyBalloon(dt);
    if (this.ask) {
      this.askT -= dt;
      if (this.askT <= 0 || !afoot) this.giveUp();
      return;
    }
    if (!this.child || this.special || !afoot || this.state !== 'walk' || this.shot || this.stall > 0 || this.astray > 0 || this.bladder > 0.85 || this.leaving) return;
    if (this.balloonG && this.flown < 0 && this.homing < 0) {
      if (Math.random() < dt * KID_CHANCE.balloon && w.kidMoment('balloon', this)) this.letGo();
    } else if (this.snack && this.bite === 'lick' && this.eating > 1.5) {
      if (Math.random() < dt * KID_CHANCE.icecream && w.kidMoment('icecream', this)) this.dropIceCream(w);
    } else if (this.purchases >= MAX_PURCHASES && this.fun >= 0.5 && !this.gifted && !this.owesHeart && Math.random() < dt * KID_CHANCE.coin) {
      const want = this.brokeWant(w);
      if (want && w.kidMoment('coin', this)) {
        this.ask = 'coin';
        this.askFor = want;
        this.askT = KID_WAIT.coin;
        this.fire('slump', KID_WAIT.coin);
      }
    }
  }

  /** Waar een kind zonder geld nog zin in heeft: een ijsje, een ballon, een hoedje of een knuffel, als dat in het park te koop is. */
  private brokeWant(w: GuestWorld): Need | null {
    const wants = ([['icecream', this.treat, 'icecream'], ['balloon', this.balloon, 'balloon'], ['hat', this.hat, 'hats'], ['souvenir', this.gift, 'souvenir']] as [Need, number, ShopKind][])
      .filter(t => t[1] > 0.7 && w.shops.some(s => s.kind === t[2]));
    return wants.length ? wants.sort((a, b) => b[1] - a[1])[0][0] : null;
  }

  /** Het kind laat zijn ballon los: hij stijgt langzaam op, en de speler kan hem nog even vangen. */
  private letGo(): void {
    this.flown = 0;
    this.flownKind = this.wornBalloon;
    this.wornBalloon = null;
    this.stall = BALLOON_FLY.catchFor;
  }

  /** De losse ballon stijgt en wiebelt; is hij gevangen, dan zweeft hij terug naar de hand. */
  private flyBalloon(dt: number): void {
    const g = this.balloonG;
    if (!g) return;
    if (this.homing >= 0) {
      this.homing += dt;
      const k = balloonHome(this.homing);
      g.position.set(BALLOON_AT[0], BALLOON_AT[1], BALLOON_AT[2]).sub(this.homeFrom).multiplyScalar(k).add(this.homeFrom);
      g.rotation.set(0, 0, Math.sin(this.homing * 5) * 0.2 * (1 - k));
      g.scale.setScalar(1);
      if (k >= 1) {
        // weer vast: juichen!
        this.homing = -1;
        this.wornBalloon = this.flownKind ?? '';
        this.flownKind = null;
        this.fun = Math.min(1, this.fun + 0.15);
        this.joy = 1.4;
        this.cue = 'guest.laugh';
      }
      return;
    }
    if (this.flown < 0) return;
    const was = this.flown;
    this.flown += dt;
    const d = balloonDrift(this.flown);
    g.position.set(BALLOON_AT[0] + d.side, BALLOON_AT[1] + d.up, BALLOON_AT[2]);
    g.rotation.set(0, 0, d.tilt);
    g.scale.setScalar(d.size);
    if (was < BALLOON_FLY.catchFor && this.flown >= BALLOON_FLY.catchFor) {
      // niet gevangen: hij gaat de lucht in. Het kind kijkt hem na en is een beetje verdrietig
      this.fun = Math.max(0, this.fun - 0.05);
      this.fire('lookup', 3);
    }
    if (this.flown >= BALLOON_FLY.gone) {
      this.mesh.remove(g);
      this.balloonG = null;
      this.flown = -1;
      this.flownKind = null;
    }
  }

  /** Waar de losse ballon nu is (in de wereld), zolang je hem nog kunt vangen; anders null. */
  looseBalloon(): THREE.Vector3 | null {
    const g = this.balloonG;
    if (!g || !balloonCatchable(this.flown)) return null;
    return g.children[0].getWorldPosition(LOOSE_BALLOON);
  }

  /** De speler tikt op de losse ballon: hij zweeft terug naar de hand van het kind. Geeft terug of dat lukte. */
  catchBalloon(): boolean {
    if (!this.balloonG || !balloonCatchable(this.flown)) return false;
    this.homeFrom.copy(this.balloonG.position);
    this.homing = 0;
    this.flown = -1;
    this.stall = BALLOON_FLY.back + 0.5;
    return true;
  }

  /** Oei, het ijsje valt op het pad: een vlek, een sip gezicht en een traan. Het kind wacht even of iemand helpt. */
  private dropIceCream(w: GuestWorld): void {
    if (this.snack) this.limbs[3].remove(this.snack);
    this.snack = null;
    this.eating = 0;
    this.full = false;
    this.trash = 0; // het hoorntje ligt op de grond: er blijft geen papiertje over
    w.splat(this.gx + Math.sin(this.heading) * 0.22, this.gy + Math.cos(this.heading) * 0.22);
    this.fun = Math.max(0, this.fun - 0.08);
    this.fire('slump', KID_WAIT.icecream);
    this.ask = 'icecream';
    this.askT = KID_WAIT.icecream;
  }

  /** De speler helpt: een nieuw ijsje van de ijskraam, gratis. Het kind juicht. */
  freshIceCream(product?: string): void {
    if (this.ask !== 'icecream') return;
    this.clearAsk();
    if (this.snack) this.limbs[3].remove(this.snack);
    this.snack = makeTreat('icecream', product);
    this.bite = 'lick';
    this.full = true;
    this.limbs[3].add(this.snack);
    this.eating = 7;
    this.trash = 10 + Math.random() * 10;
    this.fun = Math.min(1, this.fun + 0.2);
    this.joy = 1.2;
    this.cue = 'guest.laugh';
  }

  /** De speler geeft een muntje: het kind kan nog één ding kopen, en gaat daar meteen naartoe. */
  takeCoin(): void {
    if (this.ask !== 'coin') return;
    const want = this.askFor;
    this.clearAsk();
    this.purchases = Math.min(this.purchases, MAX_PURCHASES - 1);
    this.gifted = true;
    this.owesHeart = true;
    this.fun = Math.min(1, this.fun + 0.1);
    this.joy = 1;
    this.cue = 'guest.laugh';
    // nog meer zin in wat het wilde, zodat het daar als eerste naartoe gaat
    if (want === 'icecream') this.treat = 1;
    else if (want === 'balloon') this.balloon = 1;
    else if (want === 'hat') this.hat = 1;
    else if (want === 'souvenir') this.gift = 1;
    if (!this.errand && !this.sight && this.state === 'walk') {
      this.route = [];
      this.state = 'idle';
      this.timer = 0.4;
    }
  }

  /** Niemand hielp: het kind loopt verder. Om het ijsje is het nog wat verdrietig; zonder geld zakt de zin. */
  private giveUp(): void {
    if (this.ask === 'icecream') this.fun = Math.max(0, this.fun - 0.04);
    else if (this.askFor) this.postpone(this.askFor);
    this.clearAsk();
  }

  private clearAsk(): void {
    this.ask = null;
    this.askFor = null;
    this.askT = 0;
    this.stall = Math.min(this.stall, 0.4);
    if (this.shot === 'slump') this.calm();
  }

  /** Een kind dat de speler nodig heeft: reiken naar de losse ballon, huilen om het ijsje, de lege handjes laten zien. */
  private kidPose(): void {
    if (this.shot) return;
    const right = this.limbs[2], left = this.limbs[3], head = this.head;
    if (balloonCatchable(this.flown)) {
      // naar boven kijken en reiken, en een beetje springen
      const t = this.flown;
      head.rotation.x = -0.6;
      right.rotation.x = -2.9;
      right.rotation.z = 0.2 + Math.sin(t * 6) * 0.15;
      this.hop = Math.abs(Math.sin(t * 6)) * 0.07;
    } else if (this.ask === 'icecream') {
      // huilen: de handjes bij de ogen en het hoofd een beetje omlaag
      right.rotation.x = left.rotation.x = -2.5;
      right.rotation.z = -0.7;
      left.rotation.z = 0.7;
      head.rotation.x = 0.25;
      this.tilt = Math.sin(this.phase * 0.9) * 0.04;
    } else if (this.ask === 'coin') {
      // de lege handjes laten zien en de schoudertjes ophalen
      right.rotation.x = left.rotation.x = -1.1;
      right.rotation.z = 0.45;
      left.rotation.z = -0.45;
      head.rotation.z = Math.sin(this.phase * 0.3) * 0.12;
    }
  }
}

// ------------------------------------------------------------ het treintje
/**
 * Het treintje rijdt over het pad van halte naar halte en weer terug naar de eerste. Bij elke halte stopt het
 * even: wie erin zat stapt uit, wie stond te wachten stapt in. Met minder dan twee haltes staat het stil.
 */
export class Train {
  running = false;
  private points: [number, number][] = [];
  private dist: number[] = [];
  private total = 0;
  private stops: { shop: ShopSpot; at: number; tile: number }[] = [];
  private s = 0;
  private next = 0;
  private wait = 0;
  private key = '';
  private checkIn = 0;
  private riders: (Guest | null)[] = new Array(TRAIN.wagons * TRAIN.seats).fill(null);
  /** Net gestopt bij een halte (voor het belletje). */
  arrived = false;

  /** `cars`: de locomotief en de wagons uit het beeld, in die volgorde. */
  constructor(private cars: THREE.Object3D[]) {}

  /** De route opnieuw uitzoeken: langs alle haltes die aan het pad staan, in de volgorde waarin ze gebouwd zijn. */
  private plan(w: GuestWorld, reach: Set<number>): void {
    const stations = w.shops.filter(sh => sh.kind === 'station').map(shop => ({ shop, tile: doorOf(w, reach, shop) })).filter((x): x is { shop: ShopSpot; tile: number } => x.tile !== null);
    const key = stations.map(x => `${x.shop.x},${x.shop.y},${x.tile}`).join(';') + `/${reach.size}`;
    if (key === this.key) return;
    this.key = key;
    this.points = [];
    this.dist = [];
    this.stops = [];
    this.total = 0;
    this.drop();
    let ok = stations.length >= 2;
    for (let i = 0; ok && i < stations.length; i++) {
      const leg = w.grid.path(stations[i].tile, stations[(i + 1) % stations.length].tile, t => !reach.has(t));
      if (!leg) {
        ok = false;
        break;
      }
      this.stops.push({ shop: stations[i].shop, at: this.total, tile: stations[i].tile });
      for (let k = 0; k < leg.length - 1; k++) {
        const [x, y] = tileXY(leg[k]);
        this.points.push([x + 0.5, y + 0.5]);
        this.dist.push(this.total);
        this.total += 1;
      }
    }
    this.running = ok && this.total > 1;
    this.s = 0;
    this.next = 1 % Math.max(1, this.stops.length);
    this.wait = TRAIN.stop;
    for (const car of this.cars) car.visible = this.running;
  }

  /** Iedereen eruit (de route is veranderd). */
  private drop(): void {
    const tile = this.stops[0]?.tile ?? ENTRANCE;
    this.riders.forEach((g, i) => {
      if (g?.riding === this) g.alight(tile);
      this.riders[i] = null;
    });
  }

  /** Het punt op de route op afstand `d` vanaf het begin: [x, y, richting]. */
  private point(d: number): [number, number, number] {
    const n = this.points.length;
    if (!n) return [0, 0, 0];
    const u = ((d % this.total) + this.total) % this.total;
    const i = Math.min(n - 1, Math.floor(u)), a = this.points[i], b = this.points[(i + 1) % n], f = u - i;
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, Math.atan2(b[0] - a[0], b[1] - a[1])];
  }

  /** Waar plek `seat` nu is: de wagon en het bankje daarin. */
  seatPos(seat: number): [number, number, number] {
    const wagon = Math.floor(seat / TRAIN.seats) + 1, j = seat % TRAIN.seats;
    return this.point(this.s - wagon * TRAIN.gap - (j - (TRAIN.seats - 1) / 2) * 0.26);
  }

  update(dt: number, w: GuestWorld, reach: Set<number>, guests: Guest[]): void {
    this.arrived = false;
    this.checkIn -= dt;
    if (this.checkIn <= 0) {
      this.checkIn = 1.5;
      this.plan(w, reach);
    }
    TRAIN_AT.on = this.running;
    if (!this.running) return;
    if (this.wait > 0) {
      this.wait -= dt;
    } else {
      const goal = this.next === 0 ? this.total : this.stops[this.next].at;
      this.s += TRAIN.speed * dt;
      if (this.s >= goal) {
        // bij de halte: uitstappen, instappen, even wachten
        const stop = this.stops[this.next];
        this.s = stop.at;
        this.wait = TRAIN.stop;
        this.arrived = true;
        this.riders.forEach((g, i) => {
          if (g && g.riding === this && !g.gone) g.alight(stop.tile);
          this.riders[i] = null;
        });
        let seat = 0;
        for (const g of guests) {
          if (seat >= this.riders.length) break;
          if (g.waitingAt !== stop.shop) continue;
          this.riders[seat] = g;
          g.board(this, seat++);
        }
        this.next = (this.next + 1) % this.stops.length;
      }
    }
    this.cars.forEach((car, k) => {
      const [x, y, h] = this.point(this.s - k * TRAIN.gap);
      if (!k) {
        // waar de locomotief is: wie op het perron staat, zwaait als hij eraan komt
        TRAIN_AT.x = x;
        TRAIN_AT.y = y;
      }
      car.position.set(toWorldX(x), 0, toWorldZ(y));
      car.rotation.y = h;
    });
  }
}

// ------------------------------------------------------------ de kabelbaan
/** Het beeld van één kabelbaan (zie View.makeCable): de groep, de stoeltjes en de twee grote wielen. */
export interface CableModel {
  group: THREE.Object3D;
  chairs: THREE.Object3D[];
  wheels: THREE.Object3D[];
}
/** Wie er in een stoeltje zit, naar welk huisje hij gaat en of hij daarna nog terug rijdt. */
interface CableRider {
  g: Guest;
  to: ShopSpot;
  back: boolean;
}
const CABLE_V = new THREE.Vector3();

/**
 * Eén kabelbaan tussen twee huisjes. De stoeltjes gaan steeds rond: heen aan de ene kant van de kabel en terug aan
 * de andere. Bij elk huisje stapt eruit wie daar moet zijn en stapt in wie op het perron stond te wachten. Elk
 * stoeltje heeft twee plekken. 's Nachts, als het park dicht is, staan de stoeltjes stil.
 */
export class CableCar {
  readonly len: number;
  /** Het midden van het eerste huisje en de richting naar het tweede (een van de vier windrichtingen). */
  private ax: number;
  private ay: number;
  private ux: number;
  private uy: number;
  private loop: number;
  /** Hoe ver het eerste stoeltje langs de lus is, en hoe hard het nu gaat (0 = stil, 1 = gewoon). */
  private s = 0;
  private go = 0;
  private riders: (CableRider | null)[];
  private doors: [number | null, number | null] = [null, null];
  private checkIn = 0;
  private lookIn = 0;
  private clock = Math.random() * 10;
  /** Kunnen gasten nu instappen? Beide huisjes staan aan het pad en het park is open. */
  boarding = false;

  constructor(readonly a: ShopSpot, readonly b: ShopSpot, readonly model: CableModel) {
    this.len = cableLength(a, b);
    this.ux = Math.sign(b.x - a.x);
    this.uy = Math.sign(b.y - a.y);
    [this.ax, this.ay] = shopCenter(a);
    this.loop = cableLoop(this.len);
    this.riders = new Array(model.chairs.length * 2).fill(null);
  }

  /** Hoort dit huisje bij deze kabelbaan, en kun je er nu instappen? */
  serves(shop: ShopSpot): boolean {
    return this.boarding && (shop === this.a || shop === this.b);
  }

  /** Iedereen eruit (een huisje is weggehaald): bij het huisje waar ze instapten, of anders bij de ingang. */
  drop(): void {
    this.riders.forEach((r, i) => {
      if (r?.g.riding === this) r.g.liftOff(null, this.doors[0] ?? this.doors[1] ?? ENTRANCE);
      this.riders[i] = null;
    });
  }

  /** Een punt langs de lus in rastercoördinaten: `a` tegels langs de lijn en `side` opzij. */
  private grid(a: number, side: number): [number, number] {
    return [this.ax + this.ux * a - this.uy * side, this.ay + this.uy * a + this.ux * side];
  }

  /** Waar plek `seat` nu is: de gast zit erin, met het gezicht in de rijrichting en hij schommelt mee. */
  seatPose(seat: number, m: THREE.Object3D): void {
    const chair = this.model.chairs[seat >> 1];
    CABLE_V.set(seat % 2 ? 0.12 : -0.12, -CABLE.hang + 0.03 - 0.2 * m.scale.y, -0.02);
    chair.localToWorld(CABLE_V);
    m.position.copy(CABLE_V);
    chair.getWorldQuaternion(m.quaternion);
  }

  /** Waar het stoeltje van plek `seat` is en hoe hoog de kabel daar hangt: voor het wolkje en voor wat de gast onder zich ziet. */
  private seatSpot(seat: number): { gx: number; gy: number; h: number } {
    const c = cableAt(this.len, this.s + ((seat >> 1) * this.loop) / this.model.chairs.length);
    const [gx, gy] = this.grid(c.a, c.side);
    return { gx, gy, h: c.h };
  }

  update(dt: number, w: GuestWorld, reach: Set<number>, guests: Guest[], lifts: CableCar[] = []): void {
    this.clock += dt;
    this.checkIn -= dt;
    if (this.checkIn <= 0) {
      this.checkIn = 1;
      this.doors = [doorOf(w, reach, this.a), doorOf(w, reach, this.b)];
    }
    for (let i = 0; i < this.riders.length; i++) if (this.riders[i] && (this.riders[i]!.g.gone || this.riders[i]!.g.riding !== this)) this.riders[i] = null;
    const linked = this.doors[0] !== null && this.doors[1] !== null;
    this.boarding = linked && !w.goingHome() && !w.closed();
    const aboard = this.riders.some(r => r);
    // 's nachts staan de stoeltjes stil; wie er nog in zit, wordt eerst naar een huisje gebracht
    const target = (linked && !w.closed()) || aboard ? 1 : 0;
    this.go += (target - this.go) * Math.min(1, dt * 0.8);
    if (this.go < 0.01 && !target) this.go = 0;
    const n = this.model.chairs.length, before = this.s;
    this.s = (this.s + CABLE.speed * this.go * dt) % this.loop;
    for (let i = 0; i < n; i++) {
      const off = (i * this.loop) / n;
      for (const end of [0, 1] as const) {
        if (!cablePassed(before + off, this.s + off, cableStop(this.len, end), this.loop)) continue;
        const here = end ? this.b : this.a, there = end ? this.a : this.b, door = this.doors[end];
        // bij het wiel: eerst uitstappen, dan instappen
        for (const k of [i * 2, i * 2 + 1]) {
          const r = this.riders[k];
          if (r && r.to === here) {
            if (r.back) {
              // nog een keer: terug naar waar hij instapte
              r.back = false;
              r.to = there;
            } else {
              // een tussenstation: de meeste gasten rijden met de andere kabel verder (hooguit vier stukken achter elkaar)
              const onward = door !== null && r.g.hops < 4 && Math.random() < 0.65 && lifts.some(l => l !== this && l.serves(here));
              r.g.liftOff(door === null ? null : here, door ?? this.doors[1 - end] ?? ENTRANCE, onward);
              this.riders[k] = null;
            }
          }
          if (this.riders[k] || !this.boarding) continue;
          // wie net met deze kabel kwam en verder wil, wacht op de andere kabel
          const g = guests.find(q => q.liftWaiting === here && q.lastLift !== this);
          if (!g) continue;
          g.liftOn(this, k);
          this.riders[k] = { g, to: there, back: Math.random() < CABLE.back };
        }
      }
    }
    // de stoeltjes, met een beetje schommelen; de grote wielen draaien mee
    const { chairs, wheels, group } = this.model;
    for (let i = 0; i < n; i++) {
      const c = cableAt(this.len, this.s + (i * this.loop) / n);
      const chair = chairs[i];
      chair.position.set(c.a, c.h, c.side);
      chair.rotation.order = 'YXZ';
      const t = this.clock * 1.6 + i * 1.7, turning = Math.abs(c.mz) > 0.05 ? 1 : 0;
      chair.rotation.set(Math.sin(t * 0.7) * 0.05 * this.go, Math.atan2(c.mx, c.mz), (Math.sin(t) * 0.05 + turning * 0.1) * this.go);
    }
    for (const wheel of wheels) wheel.rotation.y += (CABLE.speed * this.go * dt) / CABLE.r;
    group.updateMatrixWorld(true);
    // wie erin zit, kijkt naar beneden: welke dieren zijn daar?
    this.lookIn -= dt;
    const look = this.lookIn <= 0;
    if (look) this.lookIn = 0.4;
    this.riders.forEach((r, k) => {
      if (!r) return;
      const spot = this.seatSpot(k);
      r.g.fly(spot.gx, spot.gy, spot.h - CABLE.hang);
      if (look && spot.h > CABLE.low + 0.4) for (const sp of w.liftView(spot.gx, spot.gy)) r.g.overlook(w, sp);
    });
  }
}

// ------------------------------------------------------------ alle gasten samen
export class GuestManager {
  guests: Guest[] = [];
  /** Het treintje, zodra het beeld er een heeft gemaakt. */
  train: Train | null = null;
  /** De kabelbanen: één per paar huisjes (het spel houdt deze lijst bij). */
  lifts: CableCar[] = [];
  private spawnIn = 2;
  private list: number[] = [];
  private reach = new Set<number>();
  private reachIn = 0;
  private chatIn = 3;
  /** Een klas die uit de bus stapt: de juf of meester, het hoeveelste kind nu aan de beurt is (van `n`) en hoe lang het vorige geleden is. */
  private alighting: { leader: Guest; next: number; n: number; wait: number }[] = [];
  private crowd: Crowd;

  constructor(scene: THREE.Scene, private world: GuestWorld) {
    this.crowd = new Crowd(scene);
  }

  snapshot(): GuestSave[] {
    // (wie nog buiten de poort loopt, op weg naar binnen of naar huis, wordt niet bewaard)
    return this.guests.filter(g => !g.gone && !g.special && !g.inside && !g.riding && !g.arriving && !g.departing).map(g => g.snapshot());
  }

  /** De gasten uit een bewaard spel lopen weer rond waar ze waren. Kind blijft kind; kleren zijn nieuw. */
  restore(list: GuestSave[], dx = 0, dy = 0): void {
    const species = this.world.parkSpecies();
    for (const s of list) {
      const guest = new Guest(ENTRANCE, species, { child: s.child });
      guest.restore(s, dx, dy);
      this.guests.push(guest);
    }
  }

  /** Het dichtstbijzijnde kind (hooguit `near` tegels weg) dat nergens mee bezig is, rent naar dit ding. Geeft het kind, of null. */
  callKid(sight: Sight, near = 9): Guest | null {
    const kids = this.guests
      .filter(g => g.child && !g.gone && Math.hypot(g.gx - sight.x, g.gy - sight.y) <= near)
      .sort((a, b) => Math.hypot(a.gx - sight.x, a.gy - sight.y) - Math.hypot(b.gx - sight.x, b.gy - sight.y));
    for (const kid of kids) if (kid.visit(this.world, this.reach, sight)) return kid;
    return null;
  }

  /** Kunnen gasten deze tegel bereiken (pad dat aan de ingang vastzit)? */
  reaches(tile: number): boolean {
    return this.reach.has(tile);
  }

  /** Is de ingang met een pad verbonden? Zonder pad komen er geen gasten. */
  get open(): boolean {
    return this.reach.size > 0;
  }

  /** Alle padtegels waar gasten kunnen komen. */
  get paths(): Set<number> {
    return this.reach;
  }

  /** Alle padtegels die vanaf de ingang te bereiken zijn. */
  private refresh(): void {
    const grid = this.world.grid;
    this.reach = new Set();
    if (isPath(grid.terrain[ENTRANCE])) {
      const queue = [ENTRANCE];
      this.reach.add(ENTRANCE);
      for (let head = 0; head < queue.length; head++)
        for (const n of grid.neighbors(queue[head]))
          if (isPath(grid.terrain[n]) && !this.reach.has(n)) {
            this.reach.add(n);
            queue.push(n);
          }
    }
    this.list = [...this.reach];
  }

  private make(opts: GuestOptions = {}, tile = ENTRANCE): Guest {
    const guest = new Guest(tile, this.world.parkSpecies(), opts);
    this.guests.push(guest);
    return guest;
  }

  /**
   * Een schoolklas: een juf of meester met een rij kinderen in dezelfde kleur shirt erachteraan.
   * `shirt`: de kleur van de juf (oranje vest) of de meester (groene trui), net als op hun portret.
   */
  spawnClass(n = 6, shirt = 0xf08a24, byBus = false): Guest | null {
    if (!this.open) return null;
    const teacher = this.make({ child: false, shirt });
    teacher.tour = { stops: 5 };
    teacher.badge = 'schoolclass';
    if (byBus) {
      // de bus staat voor de poort: de juf of meester stapt als eerste uit, de kinderen een voor een erachteraan
      teacher.arriveBy(busPath());
      teacher.lead();
      this.alighting.push({ leader: teacher, next: 1, n, wait: 0 });
      return teacher;
    }
    this.walkIn(teacher, n);
    teacher.lead();
    for (let i = 0; i < n; i++) {
      const kid = this.make({ child: true, shirt: 0xffd23f });
      kid.join(teacher, i + 1);
      kid.fallIn();
    }
    return teacher;
  }

  /** Een verjaardag: de jarige en zijn vriendjes, allemaal met een feestmuts, eerst naar de speeltuin. */
  spawnParty(n = 4): Guest | null {
    if (!this.open) return null;
    const parent = this.make({ child: false });
    parent.tour = { stops: 2, party: true };
    parent.badge = 'cake';
    this.walkIn(parent, n);
    parent.lead();
    for (let i = 0; i < n; i++) {
      const kid = this.make({ child: true });
      kid.addHat('hat_party');
      kid.join(parent, i + 1);
      kid.fallIn();
    }
    return parent;
  }

  /** De beroemde gast: gouden shirt, zonnebril en een ster boven zijn hoofd. */
  spawnStar(): Guest | null {
    return this.open ? this.walkIn(this.make({ star: true })) : null;
  }

  /**
   * Een nieuwe gast begint buiten: op de stoep, een eind links of rechts van de poort. Hij loopt naar het pleintje en
   * door de poort naar binnen. `tail`: zoveel volgers komen er achter hem aan (die beginnen wat dichterbij: een
   * groepje loopt rustiger).
   */
  private walkIn(guest: Guest, tail = 0): Guest {
    const side = Math.random() < 0.5 ? 1 : -1;
    const far = tail || guest.wheels ? 4 + Math.random() * 1.5 : 5 + Math.random() * 3;
    guest.arriveBy(arrivalPath(side, far, Math.random() - 0.5), tail);
    return guest;
  }

  /** Een kind raakt zijn papa of mama kwijt: het staat ergens op het pad te huilen. */
  spawnLost(): { child: Guest; parent: Guest } | null {
    const parents = this.guests.filter(g => !g.child && g.free);
    const parent = parents[Math.floor(Math.random() * parents.length)];
    if (!parent || this.list.length < 8) return null;
    // een plek een eind bij papa of mama vandaan
    const far = this.list.filter(t => Math.hypot(tileXY(t)[0] - parent.gx, tileXY(t)[1] - parent.gy) > 5);
    const tile = far[Math.floor(Math.random() * far.length)];
    if (tile === undefined) return null;
    const child = this.make({ child: true }, tile);
    child.loseTo(parent);
    return { child, parent };
  }

  update(dt: number): void {
    this.reachIn -= dt;
    if (this.reachIn <= 0) {
      this.reachIn = 1;
      this.refresh();
    }
    const capacity = this.world.capacity();
    // (wie de poort al uit is en de stoep af loopt, telt niet meer mee)
    let here = 0;
    for (const g of this.guests) if (!g.departing) here++;
    if (this.open && here < capacity) {
      this.spawnIn -= dt;
      if (this.spawnIn <= 0) {
        // hoe meer gasten het park trekt, hoe sneller ze na elkaar binnenkomen
        this.spawnIn = Math.max(0.8, 110 / capacity) * (0.7 + Math.random() * 0.6) * (here < capacity * 0.5 ? 0.4 : 1);
        const wheels = this.world.feature('wheels') && Math.random() < 0.06 ? (Math.random() < 0.5 ? 'chair' : 'pram') : undefined;
        // een nieuwe gast komt over de stoep aanlopen en gaat door de poort naar binnen
        this.walkIn(this.make({ wheels }));
      }
    }
    // de klas stapt uit de bus: een kind komt naar buiten zodra de rij ver genoeg is opgeschoven (of na ruim een tel)
    for (const a of this.alighting) {
      a.wait += dt;
      if (a.leader.gone) a.next = a.n + 1;
      if (a.next > a.n || (a.leader.trail.length <= a.next * 3 && a.wait < 1.2)) continue;
      const kid = this.make({ child: true, shirt: 0xffd23f });
      kid.join(a.leader, a.next++);
      kid.fallIn();
      a.wait = 0;
    }
    if (this.alighting.some(a => a.next > a.n)) this.alighting = this.alighting.filter(a => a.next <= a.n);
    this.lines();
    // de klok voor de korte gebaren, en waar de beroemde gast loopt (wie hem tegenkomt, wil een foto of een handtekening)
    crowdClock += dt;
    theStar = null;
    for (const g of this.guests) if (g.star && !g.gone) theStar = g;
    // bij elk ding in het park: wie er nu staat of ernaartoe loopt
    for (const s of this.world.sights()) s.n = s.used = 0;
    for (const g of this.guests) g.claim();
    // hooguit een paar gasten tegelijk zijn de weg kwijt
    let astray = 0;
    for (const g of this.guests) if (g.astray > 0) astray++;
    strayRoom = Math.max(STRAY.most, Math.floor(this.guests.length * STRAY.share)) - astray;
    // eerst de stoeltjes van de kabelbaan, dan de gasten: wie erin zit, zit zo precies op zijn stoeltje
    for (const lift of this.lifts) lift.update(dt, this.world, this.reach, this.guests, this.lifts);
    for (const g of this.guests) g.update(dt, this.world, this.list, this.reach);
    for (const g of this.guests) g.showFace();
    if (this.guests.some(g => g.gone)) this.guests = this.guests.filter(g => !g.gone);
    this.train?.update(dt, this.world, this.reach, this.guests);
    // af en toe maken twee gasten die naast elkaar staan een praatje
    this.chatIn -= dt;
    if (this.chatIn <= 0 && this.guests.length > 1) {
      this.chatIn = 1.2 + Math.random() * 2;
      const a = this.guests[Math.floor(Math.random() * this.guests.length)];
      const b = a.chatty ? this.guests.find(g => g !== a && g.chatty && Math.hypot(g.gx - a.gx, g.gy - a.gy) < 1.1) : undefined;
      if (b) {
        a.chat(b);
        b.chat(a);
      }
    }
    this.crowd.begin();
    for (const g of this.guests) this.crowd.add(g.mesh);
    this.crowd.end();
  }

  /**
   * De rijen: per kraam tellen wie er geholpen wordt en wie er wacht, de wachtenden een plek in de rij
   * geven (achter elkaar langs het pad) en de voorste laten doorlopen zodra er plek is. Hier wordt ook
   * bijgehouden welke wc-deur open moet.
   */
  private lines(): void {
    const waiting = new Map<ShopSpot, Guest[]>();
    for (const shop of this.world.shops) {
      shop.busyNow = 0;
      shop.line = 0;
      shop.used = 0;
      shop.aboard = 0;
      if (shop.kind === 'toilet' && shop.mesh) shop.mesh.userData.ajar = 0;
    }
    for (const g of this.guests) {
      const shop = g.using;
      if (!shop) continue;
      if (g.queueing) waiting.set(shop, [...(waiting.get(shop) ?? []), g]);
      else if (!g.offRide) {
        // (wie al van zijn zitje af is en terugloopt naar het pad, houdt geen plek meer bezet)
        shop.busyNow = (shop.busyNow ?? 0) + 1;
        shop.used = (shop.used ?? 0) | (1 << g.seat);
        if (g.aboard) shop.aboard = (shop.aboard ?? 0) | (1 << g.seat);
        if (shop.mesh && g.doorOpen) shop.mesh.userData.ajar |= 1 << g.seat;
      }
    }
    for (const [shop, line] of waiting) {
      line.sort((p, q) => p.joined - q.joined);
      // (lukt het de voorste niet, dan draait de draaimolen nog of rijden de botsauto's: de hele rij wacht)
      while (line.length && (shop.busyNow ?? 0) < (AT_ONCE[shop.kind] ?? 1) && line[0].serve()) line.shift();
      shop.line = line.length;
      if (!line.length) continue;
      // de rij begint op de tegel voor de kraam waar de gasten aankwamen. Die plek blijft vast: zo schuift de
      // rij niet steeds verder het pad op als de voorste aan de beurt is.
      const head = line[0].gate >= 0 ? line[0].gate : line[0].tile;
      const [hx, hy] = tileXY(head);
      const [cx, cy] = shopCenter(shop);
      const ox = hx + 0.5 - cx, oy = hy + 0.5 - cy;
      const away: [number, number] = Math.abs(ox) > Math.abs(oy) ? [Math.sign(ox), 0] : [0, Math.sign(oy)];
      // de rij loopt langs het pad: de kant op waar het meeste pad ligt. Bij gelijke stand eerst langs de gevel
      // naar het midden van het gebouw toe, zodat de rij voor de deur staat en niet ernaast.
      const turn = ox * away[1] + oy * away[0] > 0 ? -1 : 1;
      const sides: [number, number][] = [[away[1] * turn, away[0] * turn], [-away[1] * turn, -away[0] * turn], away];
      const run = (d: [number, number]): number => {
        let n = 0;
        while (n < 4 && this.reach.has(tileIndex(hx + d[0] * (n + 1), hy + d[1] * (n + 1))) && hx + d[0] * (n + 1) >= 0 && hx + d[0] * (n + 1) < W) n++;
        return n;
      };
      const dir = sides.reduce((best, d) => (run(d) > run(best) ? d : best));
      // op de wc is de gast die aan de beurt is binnen: daar begint de rij vooraan. Bij een toonbank staat hij
      // op de eerste plek en sluit de rij achter hem aan.
      const first = shop.kind === 'toilet' ? 0 : 1;
      // niet verder dan het pad reikt; is het pad kort, dan gaat de rij dichter op elkaar staan
      const room = run(dir) + 0.35, last = first + line.length - 1;
      const gap = last > 0 ? Math.min(0.5, Math.max(0.3, room / last)) : 0.5;
      for (let i = 0; i < line.length; i++) {
        const g = line[i], at = Math.min((first + i) * gap, room);
        const sx = hx + 0.5 + dir[0] * at, sy = hy + 0.5 + dir[1] * at;
        if (g.slot) {
          g.slot[0] = sx;
          g.slot[1] = sy;
        } else g.slot = [sx, sy];
      }
    }
  }

  /** Het avondfeest: elke gast die gewoon rondloopt, maakt een rondje langs `loop` (zie Guest.joinParty). Ook wie later binnenkomt. */
  startParty(loop: number[]): void {
    for (const g of this.guests) g.joinParty(loop);
  }

  /** Het avondfeest is voorbij: iedereen is blijer en loopt weer gewoon (of naar huis). */
  endParty(): void {
    for (const g of this.guests) g.leaveParty();
  }

  /** Feest: alle gasten juichen even (als een level gehaald is). */
  cheer(): void {
    for (const g of this.guests) g.joy = 1.4 + Math.random() * 1.2;
  }

  /** De gasten in de buurt van dit punt juichen (bij het feest, of als het verdwaalde kind terug is). */
  cheerNear(gx: number, gy: number, r: number): void {
    for (const g of this.guests) if (Math.hypot(g.gx - gx, g.gy - gy) < r) g.joy = Math.max(g.joy, 1 + Math.random());
  }

  /**
   * De bel van de dierenshow: de gasten die dichtbij rondlopen (tot `r` tegels), gaan op de tribune zitten, de
   * dichtstbijzijnde eerst, tot hij vol is. Geeft terug hoeveel er komen.
   */
  callToShow(shop: ShopSpot, r: number): number {
    const door = doorOf(this.world, this.reach, shop);
    if (door === null) return 0;
    const [cx, cy] = shopCenter(shop), dist = (g: Guest): number => Math.hypot(g.gx - cx, g.gy - cy);
    const near = this.guests.filter(g => g.free && !g.sawShow && dist(g) <= r).sort((p, q) => dist(p) - dist(q));
    let n = 0;
    for (const g of near) if (n < SHOW_TIME.seats && g.toShow(this.world, this.reach, shop, door)) n++;
    return n;
  }

  stats(): { total: number; happy: number; lacking: Record<string, number> } {
    const lacking: Record<string, number> = {};
    for (const g of this.guests) if (g.wish?.lacking) lacking[g.wish.kind] = (lacking[g.wish.kind] ?? 0) + 1;
    return { total: this.guests.length, happy: this.guests.filter(g => g.happy).length, lacking };
  }
}

/** Kramen waar een gast iets koopt (voor de kas). */
export const sellsForCoin = (kind: ShopKind): boolean => STALLS.includes(kind);

// ------------------------------------------------------------ personeel
export interface KeeperPoop {
  gx: number;
  gy: number;
}
export interface KeeperTrough {
  x: number;
  y: number;
  food: string | null;
  amount: number;
}
export type WorkerRole = 'feed' | 'clean' | 'fix' | 'vet' | 'guide' | 'photo' | 'guard';
/** Een ontsnapt dier dat de bewaker weer naar huis brengt. */
export interface GuardJob {
  animal: object;
  gx: number;
  gy: number;
}
/** Een ziek dier dat de dierenarts beter moet maken. */
export interface VetJob {
  animal: object;
  gx: number;
  gy: number;
}
/** Een versleten hek dat gemaakt moet worden. */
export interface FixJob {
  e: { o: 'h' | 'v'; x: number; y: number };
  gx: number;
  gy: number;
}
export interface WorkerWorld {
  /** Is het personeel naar huis (van half twaalf 's avonds tot vijf uur 's ochtends)? Dan loopt elke werker naar de poort. */
  staffHome(): boolean;
  grid: Grid;
  /** Voerbakken die bijgevuld moeten worden, met het voer dat erin hoort. */
  feedJobs(): { trough: KeeperTrough; food: FoodId }[];
  /** Poep (in de verblijven en op het pad) en afval dat opgeruimd moet worden. */
  cleanJobs(): KeeperPoop[];
  /** Versleten hekken die gemaakt moeten worden. */
  fixJobs(): FixJob[];
  workerFix(job: FixJob): void;
  /** Mag een werker over deze tegel lopen? Niet door een gebouw, voerbak of versiering. */
  walkable(tile: number): boolean;
  workerFill(trough: KeeperTrough, food: FoodId): void;
  workerClean(mess: KeeperPoop): void;
  /** Deze klus is niet te bereiken: er zit geen poort in het hek. */
  noGate(gx: number, gy: number): void;
  /** Zieke dieren, voor de dierenarts. */
  vetJobs(): VetJob[];
  workerHeal(job: VetJob): void;
  /** De padtegels waar gasten kunnen komen: daar lopen de gids en de fotograaf. */
  pathTiles(): Set<number>;
  /** Padtegels waar iets te zien is, en waar je dan naar kijkt. */
  tourSpots(): number[];
  viewOf(tile: number): [number, number] | null;
  /** Gasten in de buurt die mee kunnen met een rondleiding (hooguit `n`). */
  tourGuests(gx: number, gy: number, n: number): Guest[];
  /** De gids staat met zijn groepje bij de dieren en vertelt erover. */
  tourStop(group: Guest[], tile: number): void;
  /** Ontsnapte dieren, voor de bewaker. */
  guardJobs(): GuardJob[];
  /**
   * De bewaker staat bij het ontsnapte dier en fluit: het loopt nu achter hem aan. Geeft de tegels in het verblijf
   * waar hij het heen brengt, of null als er geen plek is.
   */
  guardMeet(job: GuardJob, guard: Worker): Set<number> | null;
  /** De bewaker is met het dier in het verblijf. Is het dier er ook (of `force`), dan is het weer thuis: true. */
  guardDone(job: GuardJob, guard: Worker, force: boolean): boolean;
  /** Het lukt niet: het dier loopt weer los. `noGate`: er is geen poort om het verblijf in te komen. */
  guardLet(job: GuardJob, noGate: boolean): void;
}

// Al het personeel draagt hetzelfde groene pak; de rol zie je aan de streep, de pet en wat ze dragen.
const ROLE_COLOR: Record<WorkerRole, number> = { feed: 0xf5a623, clean: 0x4a90e2, fix: 0xe0584f, vet: 0xf7f4ec, guide: 0xffd23f, photo: 0x7a5cc9, guard: 0x2f3a68 };
const BAG_GEO = new THREE.BoxGeometry(0.15, 0.12, 0.09).translate(0, -0.2, 0.05);
const CROSS_GEO = new THREE.BoxGeometry(0.07, 0.025, 0.012).translate(0, -0.2, 0.1);
const CROSS2_GEO = new THREE.BoxGeometry(0.025, 0.07, 0.012).translate(0, -0.2, 0.1);
const POLE_GEO = new THREE.BoxGeometry(0.02, 0.5, 0.02).translate(0, -0.3, 0.05);
const PENNANT_GEO = new THREE.BoxGeometry(0.16, 0.1, 0.015).translate(0.08, -0.5, 0.05);
const CAMERA_GEO = new THREE.BoxGeometry(0.13, 0.09, 0.08).translate(0, -0.19, 0.07);
const LENS_GEO = new THREE.CylinderGeometry(0.03, 0.03, 0.05, 8).rotateX(Math.PI / 2).translate(0, -0.19, 0.13);
const CART_GEO = new THREE.BoxGeometry(0.3, 0.16, 0.34);
const CART_WHEEL_GEO = new THREE.CylinderGeometry(0.07, 0.07, 0.03, 10).rotateZ(Math.PI / 2);
const CART_BAR_GEO = new THREE.BoxGeometry(0.26, 0.025, 0.025);
const HAMMER_GEO = new THREE.BoxGeometry(0.03, 0.3, 0.03).translate(0, -0.14, 0.06);
const HAMMERHEAD_GEO = new THREE.BoxGeometry(0.13, 0.07, 0.07).translate(0, -0.3, 0.06);
const BROOM_GEO = new THREE.BoxGeometry(0.025, 0.46, 0.025).translate(0, -0.1, 0.06);
const BRISTLE_GEO = new THREE.BoxGeometry(0.13, 0.07, 0.05).translate(0, -0.34, 0.06);
const SACK_GEO = new THREE.BoxGeometry(0.13, 0.16, 0.1).translate(0, -0.2, 0.05);
const PATCH_GEO = new THREE.BoxGeometry(0.07, 0.07, 0.01).translate(0, -0.2, 0.105);
// de bewaker: een vangnet aan een stok
const NETPOLE_GEO = new THREE.BoxGeometry(0.022, 0.46, 0.022).translate(0, -0.26, 0.06);
const NETRING_GEO = new THREE.TorusGeometry(0.085, 0.014, 5, 14).rotateX(Math.PI / 2).translate(0, -0.56, 0.06);
const NETBAG_GEO = new THREE.ConeGeometry(0.08, 0.13, 8, 1, true).rotateX(Math.PI).translate(0, -0.625, 0.06);

/**
 * Een werker loopt door het hele park. Een voerder vult lege voerbakken, een schoonmaker veegt poep en raapt
 * afval op, een klusser timmert versleten hekken vast en de dierenarts maakt zieke dieren beter. Naar binnen
 * kunnen ze alleen door een poort. De gids neemt een groepje gasten mee langs de dieren en de fotograaf staat
 * bij een verblijf foto's te maken: die twee blijven op het pad.
 */
export class Worker implements Leader {
  readonly mesh: THREE.Group;
  readonly height: number;
  gx: number;
  gy: number;
  /** Heeft de werker dit uur loon gekregen? Zo niet, dan wacht hij. */
  paid = true;
  private limbs: THREE.Mesh[];
  /** Het hoofd, voor het gezicht (zie faces.ts), en een vast gokgetal: zo knippert niet iedereen tegelijk. */
  private head: THREE.Mesh;
  private faceSeed = Math.random();
  private route: number[] = [];
  private job: { key: object; trough?: KeeperTrough; food?: FoodId; mess?: KeeperPoop; fix?: FixJob; heal?: VetJob; guard?: GuardJob } | null = null;
  /**
   * De bewaker: `leading` zolang het dier achter hem aan naar huis loopt. Over `recheck` tellen kijkt hij weer
   * waar het dier is; `leadWait`: zo lang wacht hij al in het verblijf tot het dier er ook is.
   */
  private leading = false;
  private recheck = 0;
  private leadWait = 0;
  private timer = 0.5;
  private working = 0;
  private heading = 0;
  private phase = 0;
  private shirts: THREE.Mesh[];
  private cartMesh: THREE.Group | null = null;
  /** De kleur van het pak (een plek in SUIT_COLORS) en of de werker een karretje heeft: daarmee werkt hij sneller. */
  suit = 0;
  cart = false;
  // de gids: het spoor waar zijn groepje overheen loopt, wie er meeloopt en hoeveel keer hij nog stopt
  trail: [number, number][] = [];
  gone = false;
  watching = false;
  face: [number, number] | null = null;
  private group: Guest[] = [];
  private stops = 0;
  private standFor = 0;
  private stopTile = -1;
  /** Zoveel tellen houdt de fotograaf zijn camera nog omhoog (klik!). */
  private flash = 0;
  /**
   * 's Nachts is de werker naar huis: `homing` zolang hij naar de poort loopt, `away` zodra hij weg is (dan zie je
   * hem niet en kun je hem niet aantikken). `homeIn`: zoveel tellen wacht hij nog; zo gaat niet iedereen tegelijk.
   */
  away = false;
  private homing = false;
  private homeIn = Math.random() * 10;

  constructor(gx: number, gy: number, readonly role: WorkerRole) {
    const person = makePerson(true, { shirt: 0x4fa35a, hat: ROLE_COLOR[role] });
    this.mesh = person.group;
    this.limbs = person.limbs;
    this.head = person.head;
    this.shirts = person.shirts;
    this.height = person.height;
    // het schort van een verkoper hoort hier niet bij: dat laatste onderdeel gaat eraf
    this.mesh.remove(this.mesh.children[this.mesh.children.length - 1]);
    const accent = mat(ROLE_COLOR[role]);
    const stripe = new THREE.Mesh(STRIPE_GEO, accent);
    stripe.position.set(0, 0.33, 0);
    this.mesh.add(stripe);
    // wat hij draagt, zit aan zijn arm en beweegt dus mee
    if (role === 'clean') this.limbs[2].add(new THREE.Mesh(BROOM_GEO, mat(0xa8743f)), new THREE.Mesh(BRISTLE_GEO, mat(0xffd23f)));
    else if (role === 'fix') this.limbs[2].add(new THREE.Mesh(HAMMER_GEO, mat(0xa8743f)), new THREE.Mesh(HAMMERHEAD_GEO, mat(0x8a857a)));
    else if (role === 'vet') this.limbs[2].add(new THREE.Mesh(BAG_GEO, mat(0xf7f4ec)), new THREE.Mesh(CROSS_GEO, mat(0xe0584f)), new THREE.Mesh(CROSS2_GEO, mat(0xe0584f)));
    else if (role === 'guide') this.limbs[2].add(new THREE.Mesh(POLE_GEO, mat(0xa8743f)), new THREE.Mesh(PENNANT_GEO, mat(0xe0584f)));
    else if (role === 'photo') this.limbs[2].add(new THREE.Mesh(CAMERA_GEO, mat(0x38343c)), new THREE.Mesh(LENS_GEO, mat(0x9fd8f5)));
    else if (role === 'guard') this.limbs[2].add(new THREE.Mesh(NETPOLE_GEO, mat(0xa8743f)), new THREE.Mesh(NETRING_GEO, mat(0xe0584f)), new THREE.Mesh(NETBAG_GEO, mat(0xf7f4ec)));
    else this.limbs[2].add(new THREE.Mesh(SACK_GEO, mat(0xb88a52)), new THREE.Mesh(PATCH_GEO, accent));
    this.gx = gx;
    this.gy = gy;
    this.place();
  }

  get tile(): number {
    return tileIndex(Math.floor(this.gx), Math.floor(this.gy));
  }

  private place(): void {
    this.mesh.position.set(toWorldX(this.gx), 0, toWorldZ(this.gy));
    this.mesh.rotation.y = this.heading;
  }

  /** Het pak een andere kleur geven. */
  setSuit(index: number): void {
    this.suit = index;
    // (de handen en de broek houden hun eigen kleur)
    for (const mesh of this.shirts) dye(mesh, SUIT_COLORS[index] ?? SUIT_COLORS[0]);
  }

  /** Een karretje erbij: de werker duwt het voor zich uit, loopt sneller en is sneller klaar. */
  setCart(on: boolean): void {
    this.cart = on;
    if (on && !this.cartMesh) {
      const cart = new THREE.Group();
      const box = new THREE.Mesh(CART_GEO, mat(0xc58a4b));
      box.position.set(0, 0.2, 0.36);
      const bar = new THREE.Mesh(CART_BAR_GEO, mat(0x8a8f98));
      bar.position.set(0, 0.34, 0.17);
      cart.add(box, bar);
      for (const x of [0.17, -0.17]) {
        const wheel = new THREE.Mesh(CART_WHEEL_GEO, mat(0x38343c));
        wheel.position.set(x, 0.07, 0.36);
        cart.add(wheel);
      }
      cart.traverse(o => { o.castShadow = true; });
      this.cartMesh = cart;
      this.mesh.add(cart);
    }
    if (this.cartMesh) this.cartMesh.visible = on;
  }

  /** De fotograaf maakt een foto: camera omhoog. */
  snap(): void {
    this.flash = 0.7;
  }

  /** De rondleiding is afgelopen: het groepje gaat weer zijn eigen gang. */
  private dismiss(): void {
    for (const g of this.group) if (g.leader === this) g.release();
    this.group = [];
    this.stops = 0;
  }

  /** Laat de klus los (als de werker weggaat of de klus er niet meer is). */
  drop(claimed: Set<object>): void {
    if (this.job) claimed.delete(this.job.key);
    this.job = null;
    this.route = [];
    this.working = 0;
    this.leading = false;
    this.dismiss();
  }

  /** Loopt de bewaker nu met dit dier naar huis? */
  leads(animal: object): boolean {
    return this.leading && this.job?.key === animal && !this.away;
  }

  /** Waar het dier loopt dat achter de bewaker aan komt: zo ver (in tegels) achter hem op zijn spoor. */
  leadPoint(back: number): [number, number] {
    const i = this.trail.length - 1 - Math.ceil(back / 0.15);
    return i >= 0 ? this.trail[i] : this.trail[0] ?? [this.gx, this.gy];
  }

  /** De bewaker: de kortste weg naar het ontsnapte dier (naar de tegel waar het staat of ernaast). */
  private routeToAnimal(w: WorkerWorld, job: GuardJob): number[] | null {
    const here = tileIndex(Math.floor(job.gx), Math.floor(job.gy));
    return this.routeTo(w, new Set([here, ...w.grid.neighbors(here)]));
  }

  /** Het ontsnapte dier zoals het er nu bij staat, of null als het niet meer los loopt. */
  private liveJob(w: WorkerWorld): GuardJob | null {
    const key = this.job?.key;
    return w.guardJobs().find(j => j.animal === key) ?? null;
  }

  /** De bewaker heeft gefloten: het dier komt achter hem aan en hij loopt naar het verblijf, door de poort. */
  private startLead(w: WorkerWorld, claimed: Set<object>): void {
    const job = this.liveJob(w);
    this.working = 0;
    if (!job || Math.hypot(job.gx - this.gx, job.gy - this.gy) > 1.8) {
      // het dier is alweer verder gelopen (of al thuis): opnieuw kijken
      this.drop(claimed);
      this.timer = 0.3;
      return;
    }
    const goals = w.guardMeet(job, this);
    const route = goals ? this.routeTo(w, goals) : null;
    if (!goals || !route) {
      w.guardLet(job, !!goals);
      this.drop(claimed);
      this.timer = 2;
      return;
    }
    // nog een tegel dieper het verblijf in, zodat het dier achter hem ook binnen staat
    const end = route[route.length - 1], prev = route[route.length - 2] ?? this.tile;
    const deeper = w.grid.neighbors(end).find(i => i !== prev && goals.has(i));
    if (deeper !== undefined) route.push(deeper);
    this.job = { key: job.animal, guard: job };
    this.leading = true;
    this.leadWait = 0;
    this.recheck = 1;
    this.trail = [[this.gx, this.gy]];
    this.route = route.slice(1);
  }

  /** Naar huis: de klus loslaten en naar de poort lopen. Is er geen weg naartoe, dan is de werker meteen weg. */
  private goHome(w: WorkerWorld, claimed: Set<object>): void {
    this.drop(claimed);
    this.standFor = 0;
    this.watching = false;
    this.flash = 0;
    this.homing = true;
    if (this.walledIn(w)) this.stepOut(w);
    const route = this.routeTo(w, new Set([ENTRANCE]));
    this.route = route ? route.slice(1) : [];
  }

  /** De gids en de fotograaf lopen over het pad van de ene kijkplek naar de andere. */
  private stroll(w: WorkerWorld): void {
    const paths = w.pathTiles();
    this.timer = 2;
    if (!paths.size) return;
    if (!paths.has(this.tile)) {
      // eerst naar het pad lopen
      const route = this.routeTo(w, paths);
      if (route) this.route = route.slice(1);
      return;
    }
    const spots = w.tourSpots().filter(t => t !== this.stopTile);
    const goal = spots[Math.floor(Math.random() * spots.length)];
    const route = goal === undefined ? null : w.grid.path(this.tile, goal, i => !paths.has(i));
    if (!route) return;
    // de gids verzamelt eerst een groepje gasten
    if (this.role === 'guide' && !this.group.length) {
      this.group = w.tourGuests(this.gx, this.gy, 5);
      this.group.forEach((g, i) => g.join(this, i + 1));
      this.stops = this.group.length ? 3 : 0;
      this.trail = [[this.gx, this.gy]];
    }
    this.route = route.slice(1);
    this.stopTile = goal;
    if (!this.route.length) this.halt(w);
  }

  /** Aangekomen bij een kijkplek: naar de dieren kijken en vertellen, of foto's maken. */
  private halt(w: WorkerWorld): void {
    this.face = w.viewOf(this.tile);
    if (this.face) this.heading = Math.atan2(this.face[0] - this.gx, this.face[1] - this.gy);
    this.watching = true;
    this.standFor = this.role === 'guide' ? (this.group.length ? 7 : 2) : 20 + Math.random() * 15;
  }

  /** De kortste weg naar een van deze tegels: over vrije tegels en door poorten. */
  private routeTo(w: WorkerWorld, goals: Set<number>): number[] | null {
    if (goals.has(this.tile)) return [this.tile];
    const prev = new Map<number, number>([[this.tile, -1]]);
    const queue = [this.tile];
    for (let head = 0; head < queue.length; head++) {
      const i = queue[head];
      for (const j of w.grid.neighbors(i, true)) {
        if (prev.has(j) || !(goals.has(j) || w.walkable(j))) continue;
        prev.set(j, i);
        if (goals.has(j)) {
          const route = [j];
          for (let k = i; k !== -1; k = prev.get(k)!) route.push(k);
          return route.reverse();
        }
        queue.push(j);
      }
    }
    return null;
  }

  /**
   * Zit de werker opgesloten? Dat gebeurt als hij in een verblijf stond dat open lag en de speler het hek weer
   * dichtmaakt of het verblijf groter maakt: dan staat hij in een verblijf zonder poort en kan hij nergens meer heen.
   */
  private walledIn(w: WorkerWorld): boolean {
    const [x, y] = tileXY(this.tile);
    if (!w.grid.enclosureAt(x, y)) return false;
    const seen = new Set<number>([this.tile]), queue = [this.tile];
    for (let head = 0; head < queue.length; head++)
      for (const j of w.grid.neighbors(queue[head], true)) {
        if (seen.has(j)) continue;
        const [jx, jy] = tileXY(j);
        // via een poort kom je buiten: niet opgesloten
        if (!w.grid.enclosureAt(jx, jy)) return false;
        seen.add(j);
        queue.push(j);
      }
    return true;
  }

  /** De werker stapt over het hek naar de dichtstbijzijnde vrije tegel buiten de verblijven. */
  private stepOut(w: WorkerWorld): void {
    const seen = new Set<number>([this.tile]), queue = [this.tile];
    for (let head = 0; head < queue.length; head++) {
      const [x, y] = tileXY(queue[head]);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (!w.grid.inBounds(nx, ny)) continue;
        const j = tileIndex(nx, ny);
        if (seen.has(j)) continue;
        seen.add(j);
        if (!w.grid.enclosureAt(nx, ny) && w.walkable(j)) {
          this.gx = nx + 0.5;
          this.gy = ny + 0.5;
          this.route = [];
          this.job = null;
          this.timer = 0.6;
          return;
        }
        queue.push(j);
      }
    }
  }

  /** Zoekt de dichtstbijzijnde klus die nog niemand doet en waar hij bij kan. */
  private plan(w: WorkerWorld, claimed: Set<object>): void {
    // staat de werker in een verblijf zonder poort (het hek is om hem heen dichtgegaan), dan gaat hij er eerst uit:
    // anders kan hij bij geen enkele klus en roept hij overal ten onrechte dat er een poort moet komen
    if (this.walledIn(w)) return this.stepOut(w);
    const near = <T extends { at: [number, number] }>(list: T[]): T[] =>
      list.sort((p, q) => Math.hypot(p.at[0] - this.gx, p.at[1] - this.gy) - Math.hypot(q.at[0] - this.gx, q.at[1] - this.gy)).slice(0, 6);
    if (this.role === 'feed') {
      const jobs = w.feedJobs().filter(j => !claimed.has(j.trough)).map(j => ({ ...j, at: [j.trough.x + 0.5, j.trough.y + 0.5] as [number, number] }));
      for (const j of near(jobs)) {
        // naast de voerbak gaan staan, in het verblijf
        const beside = new Set(w.grid.neighbors(tileIndex(j.trough.x, j.trough.y)).filter(i => w.walkable(i)));
        const route = beside.size ? this.routeTo(w, beside) : null;
        if (!route) {
          w.noGate(j.at[0], j.at[1]);
          continue;
        }
        this.job = { key: j.trough, trough: j.trough, food: j.food };
        claimed.add(j.trough);
        this.route = route.slice(1);
        return;
      }
    } else if (this.role === 'guide' || this.role === 'photo') {
      return this.stroll(w);
    } else if (this.role === 'guard') {
      const jobs = w.guardJobs().filter(j => !claimed.has(j.animal)).map(j => ({ guard: j, at: [j.gx, j.gy] as [number, number] }));
      for (const j of near(jobs)) {
        const route = this.routeToAnimal(w, j.guard);
        if (!route) continue;
        this.job = { key: j.guard.animal, guard: j.guard };
        claimed.add(j.guard.animal);
        this.route = route.slice(1);
        this.recheck = 1;
        return;
      }
    } else if (this.role === 'vet') {
      const jobs = w.vetJobs().filter(j => !claimed.has(j.animal)).map(j => ({ heal: j, at: [j.gx, j.gy] as [number, number] }));
      for (const j of near(jobs)) {
        // naast het zieke dier gaan staan, in het verblijf
        const here = tileIndex(Math.floor(j.heal.gx), Math.floor(j.heal.gy));
        const beside = new Set([here, ...w.grid.neighbors(here)].filter(i => w.walkable(i)));
        const route = beside.size ? this.routeTo(w, beside) : null;
        if (!route) {
          w.noGate(j.at[0], j.at[1]);
          continue;
        }
        this.job = { key: j.heal.animal, heal: j.heal };
        claimed.add(j.heal.animal);
        this.route = route.slice(1);
        return;
      }
    } else if (this.role === 'fix') {
      const jobs = w.fixJobs().filter(j => !claimed.has(j)).map(j => ({ fix: j, at: [j.gx, j.gy] as [number, number] }));
      for (const j of near(jobs)) {
        // naast het hek gaan staan: aan de kant waar hij bij kan
        const { o, x, y } = j.fix.e;
        const sides = (o === 'h' ? [[x, y - 1], [x, y]] : [[x - 1, y], [x, y]]).filter(([sx, sy]) => w.grid.inBounds(sx, sy)).map(([sx, sy]) => tileIndex(sx, sy)).filter(i => w.walkable(i));
        const route = sides.length ? this.routeTo(w, new Set(sides)) : null;
        if (!route) continue;
        this.job = { key: j.fix, fix: j.fix };
        claimed.add(j.fix);
        this.route = route.slice(1);
        return;
      }
    } else {
      const jobs = w.cleanJobs().filter(p => !claimed.has(p)).map(p => ({ mess: p, at: [p.gx, p.gy] as [number, number] }));
      for (const j of near(jobs)) {
        const route = this.routeTo(w, new Set([tileIndex(Math.floor(j.mess.gx), Math.floor(j.mess.gy))]));
        if (!route) {
          w.noGate(j.at[0], j.at[1]);
          continue;
        }
        this.job = { key: j.mess, mess: j.mess };
        claimed.add(j.mess);
        this.route = route.slice(1);
        return;
      }
    }
    // niets te doen: een stapje wandelen
    const options = w.grid.neighbors(this.tile).filter(i => w.walkable(i));
    if (options.length && Math.random() < 0.5) this.route = [pick(options)];
    this.timer = 2 + Math.random() * 2;
  }

  /** Maakt van dit poppetje een doorzichtig voorbeeld (voor onder de muis, voordat je het neerzet). */
  ghost(): this {
    this.mesh.traverse(o => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const own = (m.material as THREE.MeshStandardMaterial).clone();
      own.transparent = true;
      own.opacity = 0.6;
      own.depthWrite = false;
      m.material = own;
      m.castShadow = false;
    });
    return this;
  }

  /** Het voorbeeld hangt in de lucht boven deze plek en spartelt, tot je het neerzet. `ok`: mag het hier staan? */
  dangle(gx: number, gy: number, t: number, ok: boolean): void {
    this.mesh.position.set(toWorldX(gx), 0.5 + Math.sin(t * 4) * 0.07, toWorldZ(gy));
    this.mesh.rotation.set(Math.sin(t * 7) * 0.14, Math.PI / 4 + Math.sin(t * 2.5) * 0.5, Math.sin(t * 9) * 0.16);
    // spartelen: benen trappelen, armen zwaaien boven het hoofd
    this.limbs[0].rotation.x = Math.sin(t * 14) * 0.9;
    this.limbs[1].rotation.x = -Math.sin(t * 14) * 0.9;
    this.limbs[2].rotation.x = -2.5 + Math.sin(t * 11) * 0.55;
    this.limbs[3].rotation.x = -2.5 + Math.cos(t * 12) * 0.55;
    // grote ogen en een open mond: hij hangt in de lucht
    setFace(this.head, faceFor('startle', 'fine', t, 0));
    this.mesh.traverse(o => {
      const m = o as THREE.Mesh;
      if (m.isMesh) (m.material as THREE.MeshStandardMaterial).opacity = ok ? 0.6 : 0.28;
    });
  }

  /** Neerploffen: de werker valt het laatste stukje, veert in en begint dan pas. */
  plop(): void {
    this.dropT = 0.55;
  }

  private dropT = 0;

  update(dt: number, w: WorkerWorld, claimed: Set<object>): void {
    // het gezicht: blij, of sip zolang het loon niet betaald is; knipperen gaat vanzelf
    setFace(this.head, faceFor(null, this.paid ? 'fine' : 'glum', performance.now() / 1000, this.faceSeed));
    if (this.dropT > 0) {
      // eerst vallen (0,3 tel), dan inveren (0,25 tel)
      this.dropT -= dt;
      const fall = Math.max(0, (this.dropT - 0.25) / 0.3);
      const squash = this.dropT < 0.25 ? Math.sin((Math.max(0, this.dropT) / 0.25) * Math.PI) * 0.28 : 0;
      this.place();
      this.mesh.position.y = fall * fall * 0.5;
      const size = this.height / 0.66;
      this.mesh.scale.set(size * (1 + squash * 0.5), size * (1 - squash), size * (1 + squash * 0.5));
      this.limbs[2].rotation.x = this.limbs[3].rotation.x = -2.5 * fall;
      return;
    }
    const home = w.staffHome();
    if (this.away) {
      // thuis; 's ochtends komt de werker na een poosje weer binnen door de poort
      if (home) return;
      this.homeIn -= dt;
      if (this.homeIn > 0) return;
      this.away = false;
      this.mesh.visible = true;
      this.timer = 0.4;
    }
    if (home && !this.homing) {
      // sluitingstijd: de klus afmaken en dan naar huis, niet allemaal tegelijk
      this.homeIn -= dt;
      if (this.homeIn <= 0 && this.working <= 0) this.goHome(w, claimed);
    } else if (!home) {
      // (het werd ochtend terwijl hij nog onderweg was: gewoon weer aan het werk)
      if (this.homing) this.route = [];
      this.homing = false;
      this.homeIn = Math.random() * 10;
    }
    if (this.homing && !this.route.length) {
      // bij de poort: de werker is naar huis
      this.homing = false;
      this.away = true;
      this.homeIn = 1 + Math.random() * 12;
      this.mesh.visible = false;
      const [ex, ey] = tileXY(ENTRANCE);
      this.gx = ex + 0.5;
      this.gy = ey + 0.5;
      return;
    }
    if (!this.paid && !this.homing) {
      // geen loon: even wachten (en de rondleiding is afgelopen)
      if (this.group.length) this.dismiss();
      swing(this.limbs, 0);
      return this.place();
    }
    this.phase += dt * 11;
    if (this.standFor > 0) {
      // bij de dieren: de gids vertelt en wijst, de fotograaf maakt foto's
      this.standFor -= dt;
      this.flash = Math.max(0, this.flash - dt);
      swing(this.limbs, 0);
      if (this.role === 'guide') {
        this.limbs[2].rotation.x = -2.2 + Math.sin(this.phase * 0.35) * 0.2;
        this.limbs[3].rotation.x = -0.6 + Math.sin(this.phase * 0.5) * 0.4;
      } else this.limbs[2].rotation.x = this.limbs[3].rotation.x = this.flash > 0 || Math.sin(this.phase * 0.12) > 0.6 ? -1.9 : -0.3;
      if (this.standFor <= 0) {
        this.watching = false;
        this.group = this.group.filter(g => !g.gone && g.leader === this);
        if (this.role === 'guide' && this.group.length) {
          w.tourStop(this.group, this.tile);
          if (--this.stops <= 0) this.dismiss();
        }
        this.timer = 0.3;
      }
      return this.place();
    }
    if (this.working > 0) {
      // aan het werk: vegen of voer in de bak scheppen
      this.working -= dt;
      swing(this.limbs, Math.sin(this.phase) * 0.3);
      this.limbs[2].rotation.x = -0.9 + Math.sin(this.phase * 1.3) * 0.5;
      if (this.job?.guard) {
        // de bewaker fluit: het net omhoog, en met de andere hand wenkt hij het dier
        swing(this.limbs, 0);
        this.limbs[2].rotation.x = -2.3;
        this.limbs[3].rotation.x = -1.4 + Math.sin(this.phase * 0.9) * 0.5;
      }
      if (this.working <= 0 && this.job?.guard && !this.leading) {
        this.startLead(w, claimed);
        return this.place();
      }
      if (this.working <= 0 && this.job) {
        if (this.job.trough && this.job.food) w.workerFill(this.job.trough, this.job.food);
        if (this.job.mess) w.workerClean(this.job.mess);
        if (this.job.fix) w.workerFix(this.job.fix);
        if (this.job.heal) w.workerHeal(this.job.heal);
        if (this.job) claimed.delete(this.job.key);
        this.job = null;
        this.route = [];
        this.working = 0;
        this.timer = 0.4;
      }
      return this.place();
    }
    const next = this.route[0];
    if (next !== undefined) {
      const [tx, ty] = tileXY(next);
      const dx = tx + 0.5 - this.gx, dy = ty + 0.5 - this.gy;
      // met een groepje achter je aan loop je rustig; met een karretje ben je sneller
      const dist = Math.hypot(dx, dy), step = (this.group.length || this.leading ? 0.8 : this.cart ? 1.5 : 1.05) * dt;
      if (this.job?.guard && (this.recheck -= dt) <= 0) {
        // de bewaker kijkt af en toe waar het dier nu is: loopt het weg, dan gaat hij erachteraan
        this.recheck = 1;
        const job = this.liveJob(w);
        if (!job) {
          this.drop(claimed);
          this.timer = 0.4;
          return this.place();
        }
        const [lx, ly] = tileXY(this.route[this.route.length - 1]);
        if (!this.leading && Math.hypot(lx + 0.5 - job.gx, ly + 0.5 - job.gy) > 1.5) {
          const again = this.routeToAnimal(w, job);
          if (!again) {
            this.drop(claimed);
            this.timer = 1;
            return this.place();
          }
          this.route = again.slice(1);
          if (!this.route.length) return this.place();
        }
      }
      if (this.group.length || this.leading) {
        const last = this.trail[this.trail.length - 1];
        if (!last || Math.hypot(last[0] - this.gx, last[1] - this.gy) >= 0.15) {
          this.trail.push([this.gx, this.gy]);
          if (this.trail.length > 90) this.trail.shift();
        }
      }
      if (dist <= step) {
        this.gx += dx;
        this.gy += dy;
        this.route.shift();
        // de gids of de fotograaf is bij zijn kijkplek
        if (!this.route.length && (this.role === 'guide' || this.role === 'photo') && this.tile === this.stopTile) this.halt(w);
      } else {
        this.gx += (dx / dist) * step;
        this.gy += (dy / dist) * step;
        let d = Math.atan2(dx, dy) - this.heading;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        this.heading += d * Math.min(1, dt * 10);
      }
      swing(this.limbs, Math.sin(this.phase) * 0.7);
      // het karretje duw je met twee handen; de gids houdt zijn vlaggetje hoog
      if (this.cart) this.limbs[2].rotation.x = this.limbs[3].rotation.x = -1.2;
      else if (this.group.length) this.limbs[2].rotation.x = -2.6;
      else if (this.leading) this.limbs[3].rotation.x = -0.9 + Math.sin(this.phase * 0.5) * 0.3; // wenken: kom maar mee
      return this.place();
    }
    swing(this.limbs, 0);
    if (!this.job && this.timer > 1.4 && this.timer < 2.4) this.limbs[3].rotation.x = -2.5 + Math.sin(this.phase * 0.6) * 0.15;
    if (this.job?.guard) {
      if (this.leading) {
        // in het verblijf: even wachten tot het dier er ook is, dan is het weer thuis
        this.leadWait += dt;
        if (w.guardDone(this.job.guard, this, this.leadWait > 4)) {
          claimed.delete(this.job.key);
          this.job = null;
          this.leading = false;
          this.timer = 1;
          // en weer terug naar het pad, door de poort
          const paths = w.pathTiles(), back = paths.size ? this.routeTo(w, paths) : null;
          if (back) this.route = back.slice(1);
        }
        return this.place();
      }
      // bij het dier: ernaar kijken en fluiten
      const job = this.liveJob(w);
      if (!job) {
        this.drop(claimed);
        this.timer = 0.4;
        return this.place();
      }
      if (Math.hypot(job.gx - this.gx, job.gy - this.gy) > 0.05) this.heading = Math.atan2(job.gx - this.gx, job.gy - this.gy);
      this.working = 0.9;
    } else if (this.job) {
      // aangekomen: naar het werk kijken en beginnen
      const [ax, ay] = this.job.trough ? [this.job.trough.x + 0.5, this.job.trough.y + 0.5] : this.job.fix ? [this.job.fix.gx, this.job.fix.gy] : this.job.heal ? [this.job.heal.gx, this.job.heal.gy] : [this.job.mess!.gx, this.job.mess!.gy];
      if (Math.hypot(ax - this.gx, ay - this.gy) > 0.05) this.heading = Math.atan2(ax - this.gx, ay - this.gy);
      this.working = this.job.heal ? 3 : this.cart ? 0.8 : 1.4;
    } else {
      this.timer -= dt;
      if (this.timer <= 0) this.plan(w, claimed);
    }
    this.place();
  }
}

// ------------------------------------------------------------ de clown van de optocht
const DRUM_GEO = new THREE.CylinderGeometry(0.075, 0.075, 0.08, 12);
const DRUM_RIM_GEO = new THREE.CylinderGeometry(0.079, 0.079, 0.014, 12);
const NOSE_GEO = new THREE.IcosahedronGeometry(0.02, 1);

/**
 * De clown: een roze pak met een gele kraag, een rode neus, een feestmuts en een trommel op zijn buik. Hij loopt de
 * optocht voor over het pad (`route`, een rij tegels) en laat een spoor achter waar de kinderen overheen lopen.
 */
export class Clown implements Leader {
  readonly mesh: THREE.Group;
  gx: number;
  gy: number;
  trail: [number, number][] = [];
  gone = false;
  watching = false;
  face: [number, number] | null = null;
  private limbs: THREE.Mesh[];
  private head: THREE.Mesh;
  private heading = 0;
  private phase = 0;
  private t = 0;
  /** Hoe ver hij tevoorschijn is gekomen (0 tot 1); aan het eind krimpt hij weer weg. */
  private grow = 0;
  private leaving = false;

  constructor(private route: number[]) {
    const person = makePerson(false, undefined, { child: false, shirt: 0xf06aa6, solo: true, look: { skirt: 0, short: false, stripe: true, pack: false, hair: 'curls' } });
    this.mesh = person.group;
    this.limbs = person.limbs;
    this.head = person.head;
    this.mesh.rotation.order = 'YXZ';
    // de kraag, de neus en de muts
    this.mesh.add(bit(BRIM_GEO, 0xffd23f, 0, 0.445, 0, 0.62, 1.2, 0.62), makeHat('hat_party'));
    const nose = new THREE.Mesh(NOSE_GEO, mat(0xe0453a));
    nose.position.set(0, -0.012, 0.1);
    this.head.add(nose);
    // de trommel op de buik, en een stokje in elke hand
    const drum = new THREE.Mesh(DRUM_GEO, mat(0xe0584f));
    drum.position.set(0, 0.25, 0.12);
    const rimA = new THREE.Mesh(DRUM_RIM_GEO, mat(0xf7f4ec)), rimB = new THREE.Mesh(DRUM_RIM_GEO, mat(0xffd23f));
    rimA.position.y = 0.04;
    rimB.position.y = -0.04;
    drum.add(rimA, rimB);
    this.mesh.add(drum);
    for (const arm of [this.limbs[2], this.limbs[3]]) {
      const stick = bit(STRING_GEO, 0xf7f4ec, 0, -0.2, 0.06, 1.2, 0.45, 1.2);
      stick.rotation.x = 1.2;
      arm.add(stick);
    }
    const [x, y] = tileXY(route[0]);
    this.gx = x + 0.5;
    this.gy = y + 0.5;
    this.trail.push([this.gx, this.gy]);
    this.mesh.scale.setScalar(0.05);
    this.place();
  }

  /** Is hij aan het eind van zijn rondje? */
  get done(): boolean {
    return this.route.length <= 1;
  }

  /** Klaar: hij zwaait nog even en krimpt dan weg (daarna is `gone` waar). */
  leave(): void {
    this.leaving = true;
  }

  update(dt: number): void {
    this.t += dt;
    if (this.leaving) {
      this.grow = Math.max(0, this.grow - dt * 1.5);
      if (this.grow <= 0) this.gone = true;
    } else this.grow = Math.min(1, this.grow + dt * 2.5);
    this.mesh.scale.setScalar(1.12 * Math.max(0.05, this.grow));
    const next = this.route[1];
    let walking = false;
    if (next !== undefined && !this.leaving && this.grow >= 1) {
      const [tx, ty] = tileXY(next);
      const dx = tx + 0.5 - this.gx, dy = ty + 0.5 - this.gy, dist = Math.hypot(dx, dy), step = PARADE.speed * dt;
      if (dist <= step) {
        this.gx += dx;
        this.gy += dy;
        this.route.shift();
      } else {
        this.gx += (dx / dist) * step;
        this.gy += (dy / dist) * step;
        let turn = Math.atan2(dx, dy) - this.heading;
        turn = Math.atan2(Math.sin(turn), Math.cos(turn));
        this.heading += turn * Math.min(1, dt * 8);
      }
      walking = true;
      const last = this.trail[this.trail.length - 1];
      if (!last || Math.hypot(last[0] - this.gx, last[1] - this.gy) >= 0.15) this.trail.push([this.gx, this.gy]);
      if (this.trail.length > 90) this.trail.shift();
    }
    this.phase += dt * 11;
    swing(this.limbs, walking ? Math.sin(this.phase) * 0.6 : 0);
    if (this.leaving) {
      // tot ziens: zwaaien
      this.limbs[2].rotation.x = -2.7;
      this.limbs[2].rotation.z = Math.sin(this.t * 9) * 0.5;
    } else {
      // trommelen: om en om een stokje omhoog en omlaag
      this.limbs[2].rotation.x = -1.05 + Math.sin(this.t * 12) * 0.35;
      this.limbs[3].rotation.x = -1.05 - Math.sin(this.t * 12) * 0.35;
    }
    setFace(this.head, faceFor('joy', 'fine', this.t, 0.4));
    this.place(walking ? Math.abs(Math.sin(this.phase * 0.5)) * 0.06 : 0);
  }

  private place(hop = 0): void {
    this.mesh.position.set(toWorldX(this.gx), hop, toWorldZ(this.gy));
    this.mesh.rotation.y = this.heading;
  }
}

// ------------------------------------------------------------ verkoper
/** Wat de verkoper draagt. Hij staat in het gebouw achter de toonbank, schuin naar voren gekeerd. */
const VENDORS: Partial<Record<ShopKind, { shirt: number; hat: number }>> = {
  foodstall: { shirt: 0xe0584f, hat: 0xffffff },
  drinkstall: { shirt: 0x4a90e2, hat: 0xffffff },
  icecream: { shirt: 0xf48fb1, hat: 0xffffff },
  balloon: { shirt: 0xb06ad9, hat: 0xffd23f },
  hats: { shirt: 0x6cc04a, hat: 0xe0584f },
  souvenir: { shirt: 0x7a5cc9, hat: 0xffe08a },
  facepaint: { shirt: 0x2bb5a8, hat: 0xf06aa6 },
};
/** De kleur van wat de verkoper aangeeft: een zak friet, een beker, een ijsje, een ballon, een petje of een knuffel. */
const VENDOR_ITEM: Partial<Record<ShopKind, number>> = { foodstall: 0xffd23f, drinkstall: 0x9fd8f5, icecream: 0xffc1d6, balloon: 0xe0584f, hats: 0x4a90e2, souvenir: 0xc98d5e, facepaint: 0xa06ad9 };

/** Het poppetje dat in een kraam werkt. Het wiegt een beetje en zwaait als het iets verkoopt. */
export class Vendor {
  readonly mesh: THREE.Group;
  private limbs: THREE.Mesh[];
  /** Het hoofd, voor het gezicht (zie faces.ts), en een vast gokgetal voor het knipperen. */
  private head: THREE.Mesh;
  private faceSeed = Math.random();
  private phase = Math.random() * 6;
  private wave = 0;
  /** 's Nachts is de verkoper naar huis: 0 = hij staat er, 1 = hij is weg (hij zakt achter de toonbank weg). */
  private out = 0;
  /** Zo lang is de verkoper al met een klant bezig, en het doosje dat hij aangeeft. */
  private serveT = 0;
  private item: THREE.Mesh;

  private constructor(outfit: { shirt: number; hat: number }, item: number) {
    const person = makePerson(false, outfit);
    this.mesh = person.group;
    this.limbs = person.limbs;
    this.head = person.head;
    // achter de tafel van de marktkraam, met het gezicht naar de gasten
    this.mesh.position.set(0, 0.03, -0.12);
    this.mesh.scale.setScalar(1.15);
    // wat hij aangeeft zit in zijn hand; je ziet het pas als hij het ophoudt
    this.item = new THREE.Mesh(SNACK_GEO, mat(item));
    this.item.visible = false;
    this.limbs[2].add(this.item);
  }

  /** De verkoper voor dit soort winkel, of null als er niemand werkt (bankje, wc, bloemen, ...). */
  static of(kind: ShopKind): Vendor | null {
    const spot = VENDORS[kind];
    return spot ? new Vendor(spot, VENDOR_ITEM[kind] ?? 0xffd23f) : null;
  }

  sold(): void {
    this.wave = 1.3;
  }

  /** `serving`: er staat een klant aan de toonbank. `home`: het is nacht, de verkoper gaat naar huis. */
  update(dt: number, serving = false, home = false): void {
    const gone = home && !serving ? 1 : 0;
    if (this.out !== gone) {
      this.out = gone > this.out ? Math.min(1, this.out + dt * 1.6) : Math.max(0, this.out - dt * 1.6);
      this.mesh.visible = this.out < 1;
      this.mesh.position.y = 0.03 - 0.55 * this.out;
    }
    if (this.out >= 1) return;
    this.phase += dt * 2;
    this.wave = Math.max(0, this.wave - dt);
    // het gezicht: een brede lach bij een verkoop en voor een klant, anders een gewone lach; knipperen gaat vanzelf
    setFace(this.head, faceFor(this.wave > 0 ? 'joy' : serving ? 'ride' : null, 'fine', this.phase / 2, this.faceSeed));
    const sway = Math.sin(this.phase) * 0.14, right = this.limbs[2], left = this.limbs[3];
    // een klant: eerst iets pakken (bukken en rommelen onder de toonbank), dan het ophouden tot de klant betaald heeft
    this.serveT = serving && this.wave <= 0 ? this.serveT + dt : 0;
    const t = this.serveT, grab = smooth(0, 0.4, t) * (1 - smooth(1.5, 2.1, t)), hold = smooth(1.6, 2.2, t);
    this.mesh.rotation.x = 0.3 * grab;
    this.mesh.rotation.y = -0.5 * grab;
    this.item.visible = t > 1.5;
    // bij een verkoop gaat één arm omhoog en zwaait
    right.rotation.x = this.wave > 0 ? -2.5 + Math.sin(this.phase * 7) * 0.35 : t > 0 ? (-0.8 + Math.sin(this.phase * 6) * 0.25) * grab - (1.35 + Math.sin(this.phase * 1.5) * 0.06) * hold : sway;
    left.rotation.x = t > 0 ? (-0.7 + Math.cos(this.phase * 6) * 0.25) * grab - 0.3 * hold : -sway;
  }
}

// ------------------------------------------------------------ voor de modellenpagina
/** De poppetjes van de modellenpagina (modellen.html, groep 'poppetjes'): [naam, hoe het eruitziet, is het een kind, welk hoedje]. */
const SAMPLES: [string, PersonLook, boolean?, string?][] = [
  ['kort', { hair: 'short' }],
  ['scheiding', { hair: 'side', short: true, stripe: true }],
  ['stekels', { hair: 'crew', short: true, pack: true }],
  ['bob', { hair: 'bob', skirt: 1, short: true }],
  ['lang', { hair: 'long', skirt: 2 }],
  ['staart, pet', { hair: 'tail', short: true }, false, 'cap_red'],
  ['knot', { hair: 'bun', skirt: 1 }],
  ['krullen', { hair: 'curls', stripe: true }],
  ['krans', { hair: 'ring' }],
  ['kaal', { hair: 'bald', short: true }],
  ['lang, strohoed', { hair: 'long', skirt: 1, short: true }, false, 'hat_straw'],
  ['kind', { hair: 'short', short: true, pack: true }, true],
  ['kind, staartjes', { hair: 'tails', skirt: 2 }, true],
  ['kind, feestmuts', { hair: 'curls' }, true, 'hat_party'],
];
/** De namen van de poppetjes op de modellenpagina; de laatste twee zijn een werker en een verkoper. */
export const SAMPLE_PEOPLE = [...SAMPLES.map(s => s[0]), 'werker', 'verkoper'];

/** Poppetje nummer `n` van de modellenpagina: los getekend, naar de camera gedraaid en anderhalf keer zo groot als in het spel. */
export function samplePerson(n: number): THREE.Group {
  const holder = new THREE.Group(), real = Math.random, sample = SAMPLES[n];
  // vaste gokgetallen: zo ziet elk poppetje er elke keer hetzelfde uit
  let from = n * 7919 + 17, seed = from;
  Math.random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  // `ok`: geen baard boven een rok of jurk
  const build = (): { figure: THREE.Group; ok: boolean } => {
    seed = from;
    if (!sample) return { figure: n === SAMPLES.length ? new Worker(0, 0, 'feed').mesh : Vendor.of('icecream')!.mesh, ok: true };
    const [, look, child, hat] = sample;
    const person = makePerson(false, undefined, { child: !!child, solo: true, look: { skirt: 0, short: false, stripe: false, pack: false, ...look } });
    if (hat) person.group.add(makeHat(hat));
    return { figure: person.group, ok: !look.skirt || beardColor(person.head.userData.face as number) === null };
  };
  /** Welk gezicht en welke kleuren een poppetje heeft gekregen. */
  const sign = (figure: THREE.Group): string => {
    let all = '';
    figure.traverse(o => (all += `${(o.userData.face as number | undefined) ?? ''}:${((o as THREE.Mesh).material as THREE.Material | undefined)?.id ?? ''},`));
    return all;
  };
  try {
    // Een nieuw materiaal gebruikt zelf ook gokgetallen, dus de eerste keer valt het anders uit dan daarna: daarom
    // nog eens bouwen tot het twee keer hetzelfde poppetje is. Klopt het dan niet, dan met andere gokgetallen opnieuw.
    let made = build();
    for (let shifts = 0; shifts < 12; shifts++) {
      for (let tries = 0, was = ''; tries < 6; tries++) {
        const now = sign(made.figure);
        if (now === was) break;
        was = now;
        made = build();
      }
      if (made.ok) break;
      from += 31;
      made = build();
    }
    made.figure.position.set(0, 0, 0);
    holder.add(made.figure);
  } finally {
    Math.random = real;
  }
  holder.rotation.y = Math.PI / 4;
  holder.scale.setScalar(1.5);
  return holder;
}
