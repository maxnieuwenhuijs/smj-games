import { describe, expect, it } from 'vitest';
import { HELD, SHOP_OF, heldKind, hold, paintOf, sizeLeft, useHeld, walkOffer, walkPrice } from './held';
import { PRODUCTS } from './data';

describe('wat je bij een kraam krijgt', () => {
  it('een kraam geeft wat hij aan de gasten verkoopt, zonder dubbele en hooguit vier', () => {
    expect(walkOffer('foodstall', ['fries', 'hotdog'], 30)).toEqual(['fries', 'hotdog']);
    expect(walkOffer('balloon', ['balloon_red', 'balloon_red', 'balloon_blue'], 30)).toEqual(['balloon_red', 'balloon_blue']);
    expect(walkOffer('souvenir', ['plush_pig', 'plush_lion', 'plush_cow', 'plush_goat', 'plush_duck'], 30)).toHaveLength(HELD.most);
  });

  it('de schminktent heeft alle gezichten, ook als er net een kind geschminkt is', () => {
    expect(walkOffer('facepaint', [], 30)).toEqual(['paint_tiger', 'paint_cat', 'paint_butterfly', 'paint_panda']);
  });

  it('het restaurant heeft eten en drinken, ook in een vroeg level', () => {
    const menu = walkOffer('restaurant', [], 40);
    expect(menu.length).toBeGreaterThan(1);
    expect(menu.length).toBeLessThanOrEqual(HELD.most);
    expect(menu.some(id => heldKind(id) === 'food')).toBe(true);
    expect(menu.some(id => heldKind(id) === 'drink')).toBe(true);
    expect(walkOffer('restaurant', [], 0)).toEqual(['fries', 'lemonade']);
  });

  it('een bankje, de wc of een prullenbak verkoopt niets', () => {
    for (const kind of ['bench', 'toilet', 'bin', 'flowers', 'carousel'] as const) expect(walkOffer(kind, ['fries'], 30)).toEqual([]);
  });
});

describe('wat je in je hand hebt', () => {
  it('elk ding van een kraam kun je vasthouden, schmink niet', () => {
    for (const p of PRODUCTS) {
      const kind = heldKind(p.id);
      expect(kind).not.toBeNull();
      expect(SHOP_OF[kind!]).toBe(p.shop);
    }
    expect(heldKind('plush_lion')).toBe('plush');
    expect(heldKind('paint_tiger')).toBeNull();
    expect(hold('paint_tiger')).toBeNull();
    expect(paintOf('paint_tiger')).toBe('tiger');
    expect(paintOf('fries')).toBeNull();
    expect(paintOf('paint_dragon')).toBeNull();
  });

  it('na drie hapjes is het op, en het wordt steeds kleiner', () => {
    const h = hold('hotdog')!;
    expect(h.left).toBe(HELD.bites);
    const sizes = [sizeLeft(h)];
    const uses: string[] = [];
    let gone = false;
    while (!gone) {
      const u = useHeld(h);
      h.left = u.left;
      gone = u.gone;
      uses.push(u.use);
      sizes.push(sizeLeft(h));
    }
    expect(uses).toEqual(['bite', 'bite', 'bite']);
    for (let i = 1; i < sizes.length; i++) expect(sizes[i]).toBeLessThan(sizes[i - 1]);
    expect(sizes[0]).toBe(1);
  });

  it('drinken is slurpen, een ijsje likken', () => {
    expect(useHeld(hold('lemonade')!).use).toBe('sip');
    expect(useHeld(hold('scoop')!).use).toBe('lick');
  });

  it('een hoed zet je in één keer op', () => {
    const u = useHeld(hold('cap_red')!);
    expect(u).toEqual({ use: 'wear', left: 0, gone: true });
    expect(sizeLeft(hold('cap_red')!)).toBe(1);
  });

  it('een ballon en een knuffel raken nooit op', () => {
    for (const [id, use] of [['balloon_blue', 'tug'], ['plush_pig', 'hug']] as const) {
      const h = hold(id)!;
      for (let i = 0; i < 20; i++) {
        const u = useHeld(h);
        expect(u.use).toBe(use);
        expect(u.gone).toBe(false);
        h.left = u.left;
      }
    }
  });
});

describe('betalen', () => {
  it('één munt, en zonder munten krijg je het toch', () => {
    expect(walkPrice(10)).toBe(1);
    expect(walkPrice(1)).toBe(1);
    expect(walkPrice(0)).toBe(0);
  });
});
