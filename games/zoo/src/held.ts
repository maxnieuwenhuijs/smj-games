// Iets kopen bij een kraam terwijl je rondloopt (de loopstand), en het dan vasthouden, opeten, opdrinken of opzetten.
// Hier staan alleen de regels: wat je waar krijgt en hoeveel hapjes er in zitten. Geen Three.js en geen DOM, zodat
// dit los te testen is. Het ding in je hand zit in walkhand.ts, het kopen zelf in game.ts.
import { PLUSH, PRODUCTS, productsFor, type ShopKind } from './data';
import { FACE_PAINTS, paintId, type FacePaint } from './guestfun';

export const HELD = {
  /** Zoveel hapjes, likjes of slokjes zitten er in iets lekkers. */
  bites: 3,
  /** Zoveel plaatjes staan er hooguit in het rijtje om te kiezen. */
  most: 4,
  /** Zoveel munten kost het. Heb je geen munten, dan krijg je het toch: een kind mag nooit vastzitten. */
  price: 1,
  /** Zo lang duurt een hapje, slokje, knuffel of rukje aan de ballon (tellen). */
  useTime: 0.6,
  /** Zo lang duurt het opzetten van een hoed (tellen). */
  wearTime: 0.8,
  /** Zo ver mag je van de kraam weglopen voor het rijtje met plaatjes weer weggaat (tegels). */
  away: 6.5,
};

/** Wat je in je hand hebt: iets te eten, te drinken, een ijsje, een ballon, een hoed of een knuffel. */
export type HeldKind = 'food' | 'drink' | 'ice' | 'balloon' | 'hat' | 'plush';

/** Kramen waar je zelf iets kunt kopen (de schminktent en het restaurant staan apart in `walkOffer`). */
const SELLING: ShopKind[] = ['foodstall', 'drinkstall', 'icecream', 'balloon', 'hats', 'souvenir'];

/**
 * Wat je bij deze kraam kunt kiezen: hooguit HELD.most dingen. De kraam verkoopt wat hij aan de gasten verkoopt; de
 * schminktent heeft alle gezichten, het restaurant wat eten en drinken (wat er in dit level te koop is). Leeg: hier
 * kun je niets kopen (een bankje, de wc, een prullenbak).
 */
export function walkOffer(kind: ShopKind, sells: readonly string[], level: number): string[] {
  if (kind === 'facepaint') return FACE_PAINTS.map(paintId);
  if (kind === 'restaurant') {
    const menu = [...productsFor('foodstall', level).slice(0, 2), ...productsFor('drinkstall', level).slice(0, 2)];
    return menu.length ? menu : ['fries', 'lemonade'];
  }
  if (!SELLING.includes(kind)) return [];
  return [...new Set(sells)].slice(0, HELD.most);
}

/** Het gezicht, als dit schmink is ('paint_tiger' wordt 'tiger'). */
export function paintOf(product: string): FacePaint | null {
  return (FACE_PAINTS as string[]).includes(product.slice(6)) && product.startsWith('paint_') ? (product.slice(6) as FacePaint) : null;
}

/** Wat voor ding dit in je hand is. Null: je houdt het niet vast (schmink, of iets onbekends). */
export function heldKind(product: string): HeldKind | null {
  if (product.startsWith(PLUSH)) return 'plush';
  const shop = PRODUCTS.find(p => p.id === product)?.shop;
  return shop === 'foodstall' ? 'food' : shop === 'drinkstall' ? 'drink' : shop === 'icecream' ? 'ice' : shop === 'balloon' ? 'balloon' : shop === 'hats' ? 'hat' : null;
}

/** De kraam waar dit vandaan komt, voor het model (zie makeHeld in people.ts). */
export const SHOP_OF: Record<HeldKind, ShopKind> = { food: 'foodstall', drink: 'drinkstall', ice: 'icecream', balloon: 'balloon', hat: 'hats', plush: 'souvenir' };

/** Wat je vasthoudt, en hoeveel hapjes of slokjes er nog in zitten (een ballon of knuffel raakt nooit op). */
export interface Held {
  product: string;
  kind: HeldKind;
  left: number;
}

/** Je krijgt dit van de kraam. Null: dit houd je niet vast. */
export function hold(product: string): Held | null {
  const kind = heldKind(product);
  if (!kind) return null;
  const left = kind === 'food' || kind === 'drink' || kind === 'ice' ? HELD.bites : kind === 'hat' ? 1 : Infinity;
  return { product, kind, left };
}

/** Wat er gebeurt als je iets gebruikt: een hap, een lik, een slok, de hoed opzetten, een rukje aan de ballon of een knuffel. */
export type HeldUse = 'bite' | 'lick' | 'sip' | 'wear' | 'tug' | 'hug';

/** Gebruik wat je vasthoudt. Geeft wat er gebeurt, hoeveel er nog over is en of het nu op is (of op je hoofd zit). */
export function useHeld(h: Held): { use: HeldUse; left: number; gone: boolean } {
  const use: HeldUse = h.kind === 'food' ? 'bite' : h.kind === 'ice' ? 'lick' : h.kind === 'drink' ? 'sip' : h.kind === 'hat' ? 'wear' : h.kind === 'balloon' ? 'tug' : 'hug';
  const left = Math.max(0, h.left - 1);
  return { use, left, gone: left <= 0 };
}

/** Hoe groot iets lekkers nog is, als je er al wat van op hebt: van heel (1) tot bijna op. */
export const sizeLeft = (h: Held): number => (h.kind === 'food' || h.kind === 'drink' || h.kind === 'ice' ? 0.45 + 0.55 * (h.left / HELD.bites) : 1);

/** Kost het een munt? Alleen als je er een hebt. */
export const walkPrice = (coins: number): number => (coins >= HELD.price ? HELD.price : 0);
