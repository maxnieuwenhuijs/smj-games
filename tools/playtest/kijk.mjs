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
  v: 4, level, fed: 0, cleaned: 0, terrain: [], h: [], vv: [], troughs: [], animals: [], poops: [], coins, gw: 44, gh: 36,
  // alle uitleg is al gegeven: dan praat er niemand door je foto heen
  told: ['guests', 'vet', 'walk', 'walkbuy', 'cable.first', 'stars', 'event', 'staff', 'petting', 'night', 'hose', 'treat'],
  ...extra,
});

/**
 * Opent het spel en begint op opslagplek 1.
 * `level` of `save`: begin in een leeg park in dat level, of met dit opgeslagen spel (zie SaveData in game.ts).
 * Zonder allebei begint er een nieuw spel. `lang`: 'nl' of 'en'.
 */
export async function boot({ port = 5173, path = '', width = 1280, height = 800, lang = 'nl', level, coins = 99, save, scale = 1 } = {}) {
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
        const store = db.transaction('saves', 'readwrite').objectStore('saves');
        const req = data ? store.put(data, 'zoo-slot-1') : store.delete('zoo-slot-1');
        req.onsuccess = () => resolve(null);
        req.onerror = () => reject(req.error);
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
  // het laadscherm met het logo
  await page.waitForTimeout(3500);
  return { browser, page, errors };
}
