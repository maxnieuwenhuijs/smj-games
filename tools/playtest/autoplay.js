// Proefspeler: speelt het spel automatisch door, level voor level, en meet hoe lang elk level duurt.
// Alleen voor het ontwikkelen. Start het spel (npm run dev), begin een nieuw spel en typ in de console:
//
//   const { T } = await import('/@fs/<pad naar de repo>/tools/playtest/autoplay.js');
//   await T.run(50);          // speelt tot en met level 50 (of tot er geen modellen meer zijn)
//   T.log                     // per level: speltijd in seconden en of de kas is bijgevuld
//
// De proefspeler bouwt verblijven, voert, ruimt op, geneest en vangt zoals een speler dat doet, maar
// zonder muis. Met T.honest = true vult hij de kas nooit bij: dan zie je of de munten kloppen.
// Met T.kid = 8 doet hij maar één ding per acht seconden, zoals een kind: dan zie je of het zorgen bij
// te houden is. T.lost telt de dieren die door verwaarlozing zijn opgehaald.
const data = await import('/src/data.ts');
const { goalProgress } = await import('/src/levels.ts');
const models = await import('/src/models.ts');
const { SPECIES, LEVELS, TERRAINS, FEATURE, SHOP_PRICE, PRICE } = data;

const { W, H } = await import('/src/grid.ts');
// De indeling is getekend op 20 bij 20 en ligt midden tegen de voorkant van het park, bij de ingang.
const OX = Math.floor((W - 20) / 2), OY = H - 20;
const z = () => window.__zoo;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const KIND = { wall: 3, net: 4 };

// Plekken voor verblijven: vier rijen van vijf, langs twee dwarspaden (y = 4 en y = 12).
const SLOTS = [];
for (const y0 of [1, 5, 9, 13]) for (const [x0, x1] of [[0, 2], [4, 6], [8, 9], [11, 13], [15, 17]]) SLOTS.push({ x0: x0 + OX, y0: y0 + OY, x1: x1 + OX, y1: y0 + 2 + OY });
// Plekken voor kramen: boven en onder een zijpad bij de ingang (y = 17).
const SHOP_SPOTS = [];
for (const y of [18, 16]) for (const x of [9, 11, 8, 12, 7, 13, 6, 14, 5, 15]) SHOP_SPOTS.push([x + OX, y + OY]);

export const T = {
  log: [],
  topups: 0,
  honest: false,
  kid: 0,
  noHelp: false,   // true: neemt alleen verzorgers aan als een level erom vraagt
  nextAct: 0,
  lost: 0,
  home: {},        // soort -> nummer van de plek
  order: [],       // soorten in volgorde van bouwen
  pathsDone: false,

  step(seconds, dt = 0.1) {
    const game = z();
    for (let t = 0; t < seconds; t += dt) game.update(dt);
  },

  /** Betalen zoals het spel dat doet. Is de kas leeg, dan vult de proefspeler hem bij (en telt dat). */
  pay(cost) {
    const game = z();
    if (game.coins < cost) {
      if (this.honest) return false;
      this.topups++;
      game.coins = 30;
    }
    game.coins -= cost;
    game.debt += cost;
    return true;
  },

  fence(slot, kind) {
    const game = z();
    for (let x = slot.x0; x <= slot.x1; x++) for (const y of [slot.y0, slot.y1 + 1]) game.grid.setEdge({ o: 'h', x, y }, kind);
    for (let y = slot.y0; y <= slot.y1; y++) for (const x of [slot.x0, slot.x1 + 1]) game.grid.setEdge({ o: 'v', x, y }, kind);
    game.gridChanged();
  },

  terrain(x0, y0, x1, y1, name) {
    const game = z();
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) game.grid.setTerrain(x, y, TERRAINS.indexOf(name));
    game.view.paintTerrain(game.grid);
  },

  animalsOf(sp) {
    const game = z();
    return game.animals.filter(a => a.species === sp && !a.escaped);
  },

  /** Een verblijf dat past bij de soort, met voerbak en slaapplek. Is alles vol, dan maakt de oudste soort plaats. */
  pen(sp) {
    const game = z();
    if (this.home[sp] !== undefined) return SLOTS[this.home[sp]];
    const info = SPECIES[sp];
    let n = this.order.length;
    if (n >= SLOTS.length) {
      const needed = new Set(game.levelDef()?.goals.map(g => g.species).filter(Boolean));
      const old = this.order.find(s => !needed.has(s));
      n = this.home[old];
      for (const a of this.animalsOf(old)) game.removeAnimal(a);
      delete this.home[old];
      this.order = this.order.filter(s => s !== old);
      const slot = SLOTS[n];
      for (const b of game.beds.filter(b => b.x >= slot.x0 && b.x <= slot.x1 && b.y >= slot.y0 && b.y <= slot.y1)) {
        game.view.scene.remove(b.mesh);
        game.beds = game.beds.filter(k => k !== b);
      }
    }
    const slot = SLOTS[n];
    this.home[sp] = n;
    this.order.push(sp);
    this.terrain(slot.x0, slot.y0, slot.x1, slot.y1, info.terrain);
    this.fence(slot, info.need ? KIND[info.need] : 1);
    this.furnish(sp);
    return slot;
  },

  /** Voerbak en slaapplek; lukt het nu niet (geen munten), dan een volgende keer. */
  furnish(sp) {
    const game = z();
    const slot = SLOTS[this.home[sp]];
    if (!game.troughs.some(t => t.x === slot.x0 && t.y === slot.y0) && this.pay(PRICE.trough)) game.addTrough(slot.x0, slot.y0, null, 0);
    if (!game.beds.some(b => b.x === slot.x1 && b.y === slot.y0) && this.pay(PRICE.bed)) game.addBed(slot.x1, slot.y0, SPECIES[sp].bed);
  },

  /** Zorgt dat er minstens `n` volwassen dieren van de soort zijn (om en om jongen en meisje). */
  async stock(sp, n = 2) {
    const game = z();
    if (!models.hasSpecies(sp)) return false;
    await models.loadSpecies(sp);
    const slot = this.pen(sp);
    let adults = this.animalsOf(sp).filter(a => !a.young);
    while (adults.length < n) {
      if (!this.pay(SPECIES[sp].cost)) return false;
      const sex = adults.filter(a => a.variant === 'male').length <= adults.filter(a => a.variant === 'female').length ? 'male' : 'female';
      game.addAnimal(sp, sex, slot.x0 + 0.5 + (adults.length % 2), slot.y1 + 0.5 - Math.floor(adults.length / 2));
      adults = this.animalsOf(sp).filter(a => !a.young);
    }
    return true;
  },

  paths() {
    if (this.pathsDone) return;
    this.pathsDone = true;
    this.terrain(10 + OX, 4 + OY, 10 + OX, 19 + OY, 'path');
    this.terrain(OX, 4 + OY, 19 + OX, 4 + OY, 'path');
    this.terrain(OX, 12 + OY, 19 + OX, 12 + OY, 'path');
    this.terrain(5 + OX, 17 + OY, 15 + OX, 17 + OY, 'path');
  },

  shop(kind, n = 1) {
    const game = z();
    while (game.shops.filter(s => s.kind === kind).length < n) {
      const spot = SHOP_SPOTS.find(([x, y]) => !game.shops.some(s => s.x === x && s.y === y));
      if (!spot || !this.pay(SHOP_PRICE[kind])) return;
      game.addShop(spot[0], spot[1], kind);
    }
  },

  /** Het vangen van een ontsnapt dier, met dezelfde tik als bij een speler. */
  catch(a) {
    const game = z();
    const slot = SLOTS[this.home[a.species]];
    if (!slot) return;
    game.moving = a;
    const s = game.view.toScreen(slot.x0 + 1.5, slot.y1 + 0.5, 0);
    game.tap(s.x, s.y);
    if (a.escaped) {
      game.moving = null;
      a.moveTo(slot.x0 + 1.5, slot.y1 + 0.5);
      game.caught++;
    }
  },

  /** Zoals een kind: één handeling per keer, het dringendste eerst. */
  careLikeAKid() {
    const game = z();
    if (game.clock < this.nextAct) return;
    this.nextAct = game.clock + this.kid;
    const sick = game.animals.find(a => a.sick);
    if (sick) return game.heal(sick);
    const loose = game.animals.find(a => a.escaped);
    if (loose) return this.catch(loose);
    // de bak van de dieren met de meeste honger
    let worst = null;
    for (const sp of this.order) {
      const slot = SLOTS[this.home[sp]];
      const tr = game.troughs.find(t => t.x === slot.x0 && t.y === slot.y0);
      const mine = this.animalsOf(sp);
      if (!tr || !mine.length || (tr.food === SPECIES[sp].food && tr.amount > 0)) continue;
      const hunger = Math.max(...mine.map(a => a.hunger));
      if (!worst || hunger > worst.hunger) worst = { tr, sp, hunger };
    }
    if (worst && worst.hunger > 0.35) return game.feed(worst.tr, SPECIES[worst.sp].food);
    // het vieste verblijf: alle poepjes daar
    const dirty = game.pens.map(p => ({ p, n: game.poopsIn(p.region.id) })).sort((a, b) => b.n - a.n)[0];
    if (dirty && dirty.n >= 2) return game.poopsOf(dirty.p.region.id).forEach(p => game.cleanPoop(p));
    if (game.litter.length) return game.cleanLitter(game.litter[0]);
    if (worst) return game.feed(worst.tr, SPECIES[worst.sp].food);
    if (dirty && dirty.n) game.cleanPoop(game.poopsOf(dirty.p.region.id)[0]);
  },

  /** Wat een speler tussendoor doet: voeren, opruimen, genezen en vangen. */
  care() {
    const game = z();
    if (!game.takeAwayCounted) {
      const original = game.takeAway.bind(game);
      game.takeAway = a => {
        this.lost++;
        original(a);
      };
      game.takeAwayCounted = true;
    }
    if (this.kid) return this.careLikeAKid();
    for (const sp of this.order) {
      const slot = SLOTS[this.home[sp]];
      const tr = game.troughs.find(t => t.x === slot.x0 && t.y === slot.y0);
      if (tr && this.animalsOf(sp).length && (tr.food !== SPECIES[sp].food || tr.amount <= 1)) game.feed(tr, SPECIES[sp].food);
    }
    for (const p of [...game.poops]) game.cleanPoop(p);
    for (const p of [...game.litter]) game.cleanLitter(p);
    for (const a of game.animals) if (a.sick) game.heal(a);
    for (const a of game.animals.filter(k => k.escaped)) this.catch(a);
  },

  /** Alles klaarzetten wat de doelen van dit level vragen. */
  async prepare() {
    const game = z();
    const level = game.levelDef();
    if (!level) return;
    const done = game.level;
    const have = LEVELS.slice(0, done).map(l => l.reward).filter(models.hasSpecies);
    if (done === 0) this.pen('pig');
    for (const sp of this.order) this.furnish(sp);
    // een kind dat het druk krijgt, neemt hulp aan zodra dat kan en er munten over zijn
    if (this.kid && !this.noHelp && done >= FEATURE.keeper && game.coins >= PRICE.keeper + 4 && game.pens.length >= 5) {
      const busy = game.pens.filter(p => !p.keeper && game.animalsIn(p.region.id).length).sort((a, b) => game.poopsIn(b.region.id) - game.poopsIn(a.region.id))[0];
      if (busy) {
        game.penMenu(busy);
        document.querySelector('#menu [data-item="keeper"]')?.click();
      }
    }
    for (const g of level.goals) if (g.species) await this.stock(g.species, Math.max(2, g.type === 'animals' ? g.n : 2));
    if (done >= FEATURE.paths) this.paths();
    for (const kind of ['foodstall', 'drinkstall', 'toilet', 'bench', 'playground', 'icecream', 'balloon', 'bin', 'souvenir']) if (done >= FEATURE[kind]) this.shop(kind, 1);
    for (const g of level.goals) {
      if (g.type === 'shop') this.shop(g.shop, g.n);
      if (g.type === 'kinds') for (const sp of have.slice(-Math.min(have.length, g.n + 1))) await this.stock(sp, 2);
      if (g.type === 'happyany') {
        for (const sp of have.slice(-SLOTS.length)) await this.stock(sp, 2);
        for (let extra = 3; extra <= 4 && game.animals.length < g.n + 3; extra++)
          for (const sp of [...this.order].reverse()) {
            const slot = SLOTS[this.home[sp]];
            const room = Math.max(2, Math.floor(((slot.x1 - slot.x0 + 1) * 3) / 2));
            if (game.animals.length < g.n + 3 && extra <= room) await this.stock(sp, extra);
          }
      }
      if (g.type === 'keeper') {
        for (const pen of game.pens) {
          if (game.pens.filter(p => p.keeper).length >= g.n) break;
          if (pen.keeper) continue;
          if (game.coins < PRICE.keeper && !this.honest) {
            this.topups++;
            game.coins = 30;
          }
          game.penMenu(pen);
          document.querySelector('#menu [data-item="keeper"]')?.click();
        }
      }
    }
  },

  state() {
    const game = z();
    const level = game.levelDef();
    return {
      level: game.level + 1,
      coins: game.coins,
      animals: game.animals.length,
      happy: game.stats.happyAll,
      kinds: game.stats.kinds,
      guests: `${game.stats.guests}/${game.guests.guests.length}`,
      pens: game.pens.length,
      goals: level ? level.goals.map(g => `${g.type}${g.species ? ':' + g.species : ''}${g.shop ? ':' + g.shop : ''} ${goalProgress(g, game.stats)}/${g.n}`) : 'vrij spelen',
    };
  },

  /** Speelt door tot en met level `to`. Stopt als een level langer duurt dan `maxMinutes` speltijd. */
  async run(to = 50, maxMinutes = 15) {
    const game = z();
    while (game.level < to && game.levelDef()) {
      const L = game.level, start = game.clock, tops = this.topups;
      await this.prepare();
      let turns = 0;
      while (game.level === L) {
        this.step(2);
        this.care();
        const go = document.querySelector('#overlay:not([hidden]) .go');
        if (go) {
          go.click();
          for (let i = 0; i < 200 && game.level === L; i++) await sleep(25);
          break;
        }
        if (++turns % 15 === 0) await this.prepare();   // een opgehaald dier of een weggelopen gast: opnieuw aanvullen
        if (turns % 40 === 0) await sleep(0);
        if (game.clock - start > maxMinutes * 60) {
          this.log.push({ level: L + 1, stuck: true, state: this.state() });
          return this.log;
        }
      }
      this.log.push({ level: L + 1, seconds: Math.round(game.clock - start), topups: this.topups - tops, coins: game.coins, lost: this.lost });
    }
    return this.log;
  },
};
window.T = T;
