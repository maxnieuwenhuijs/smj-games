// Het spel openen in een browser zonder venster (Playwright), om iets na te lopen of een foto te maken.
// Alleen voor het ontwikkelen. Start eerst het spel (`npm run dev`, of op een andere poort:
// `npx vite --port 5180 --strictPort` in games/zoo) en gebruik dit dan vanuit een eigen scriptje:
//
//   import { boot } from '<pad naar de repo>/tools/playtest/kijk.mjs';
//   const { page, browser, errors } = await boot({ level: 30, coins: 99 });
//   await page.evaluate(() => { const g = window.__zoo; g.addShop(20, 30, 'carousel'); });
//   await page.screenshot({ path: 'foto.png' });
//   await browser.close();
//
// In de pagina is het hele spel te bereiken via `window.__zoo` (ook wat in TypeScript `private` is).
// Handig: `g.update(dt)` speelt de tijd vooruit, `g.view.flyTo(gx, gy)` schuift het beeld, `g.view.zoomBy(f)` zoomt.
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

/** Playwright staat niet in package.json: het komt van de computer zelf (in de cloud is het er al). */
function playwright() {
  try {
    return require('playwright');
  } catch {
    throw new Error('Playwright ontbreekt: installeer het los (npm i -g playwright) of draai dit in de cloudomgeving.');
  }
}

/** Een leeg park in dit level (0 = het eerste), met een volle kas: zo hoef je niet eerst vijftig levels te spelen. */
export const emptyPark = (level = 0, coins = 99, extra = {}) => ({
  v: 5, level, fed: 0, cleaned: 0, terrain: [], h: [], vv: [], troughs: [], animals: [], poops: [], coins, gw: 44, gh: 36,
  // alle uitleg is al gegeven: dan praat er niemand door je foto heen
  told: ['guests', 'vet', 'walk', 'walkbuy', 'walkride', 'cable.first', 'cable.pole', 'rails', 'train.go', 'crossing', 'stars', 'event', 'staff', 'petting', 'night', 'hose', 'treat', 'keys'],
  ...extra,
});

/**
 * Opent het spel en begint op opslagplek 1.
 * `level` of `save`: begin in een leeg park in dat level, of met dit opgeslagen spel (zie SaveData in game.ts).
 * Zonder allebei begint er een nieuw spel. `lang`: 'nl' of 'en'. `draw: false`: het spel tekent niets (voor de
 * proefspeler en ander rekenwerk: zonder beeldkaart kost elk beeldje bijna een tel, en dan lopen ook de klokjes
 * in de pagina traag). `speed`: doe alsof het apparaat zo snel is (2 = prima, 1 = wat traag, 0 = een trage tablet:
 * daar komen minder gasten, zie guestsAt); zonder `speed` meet het spel het zelf, en zonder beeldkaart is dat traag.
 */
export async function boot({ port = 5173, path = '', width = 1280, height = 800, lang = 'nl', level, coins = 99, save, scale = 1, draw = true, speed } = {}) {
  const { chromium } = playwright();
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: scale });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => {
    if (m.type() === 'error') errors.push(m.text());
  });
  const url = `http://localhost:${port}/${path}`;
  await page.goto(url);
  const data = save ?? (level === undefined ? null : emptyPark(level, coins));
  await page.evaluate(
    async ([lang, data]) => {
      localStorage.setItem('zoo-lang', lang);
      localStorage.setItem('zoo-muted', '1');
      const db = await new Promise((resolve, reject) => {
        const req = indexedDB.open('smj-games', 1);
        req.onupgradeneeded = () => req.result.createObjectStore('saves');
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      await new Promise((resolve, reject) => {
        // wachten tot het echt is weggeschreven: anders kan het herladen hierna het opslaan nog afbreken
        const tx = db.transaction('saves', 'readwrite');
        const req = data ? tx.objectStore('saves').put(data, 'zoo-slot-1') : tx.objectStore('saves').delete('zoo-slot-1');
        tx.oncomplete = () => resolve(null);
        tx.onabort = tx.onerror = () => reject(tx.error ?? req.error);
      });
      db.close();
    },
    [lang, data],
  );
  // een andere pagina dan het spel zelf (modellen.html, minispel.html): die heeft geen startscherm
  if (path && !path.startsWith('index.html') && !path.startsWith('?')) {
    await page.reload();
    await page.waitForTimeout(1500);
    return { browser, page, errors };
  }
  await page.reload();
  await page.waitForSelector('#slots .slot');
  await page.click('#slots .slot[data-slot="1"]');
  // een nieuw spel vraagt eerst om een naam: overslaan
  await page.waitForTimeout(400);
  if (await page.$('#ask:not([hidden])')) {
    const buttons = await page.$$('#ask button');
    if (buttons.length) await buttons[buttons.length - 1].click();
  }
  await page.waitForFunction(() => !!window.__zoo, null, { timeout: 90000 });
  if (!draw) await page.evaluate(() => void (window.__zoo.view.renderer.render = () => {}));
  if (speed !== undefined)
    await page.evaluate(speed => {
      const view = window.__zoo.view;
      view.quality = speed;
      view.adapt = () => {};
    }, speed);
  // het laadscherm met het logo
  await page.waitForTimeout(3500);
  return { browser, page, errors };
}
