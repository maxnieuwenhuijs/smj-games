// De proefspeler (autoplay.js) alle levels laten spelen in een browser zonder venster.
//
//   node tools/playtest/speel.mjs [tot level] [kind] [poort]
//
// `kind`: 0 = snel en foutloos, de kas wordt bijgevuld als hij leeg is (zo zie je of elk level haalbaar is);
// 8 = als een kind: één handeling per acht tellen en de kas wordt nooit bijgevuld (zo zie je of de munten en het
// zorgen kloppen). Start eerst het spel (`npm run dev`, poort 5173). Het spel tekent niets, zodat het ook zonder
// beeldkaart snel gaat: vijftig levels duren een paar minuten. Per level komt er een regel met de speltijd; blijft
// een level langer dan een kwartier speltijd hangen, dan stopt hij en zie je waar het op wacht.
import { fileURLToPath } from 'url';
import { boot } from './kijk.mjs';

const to = Number(process.argv[2] ?? 50), kid = Number(process.argv[3] ?? 0), port = Number(process.argv[4] ?? 5173);
const robot = fileURLToPath(new URL('./autoplay.js', import.meta.url));
const { browser, page, errors } = await boot({ port, draw: false });
await page.evaluate(async ([robot, to, kid]) => {
  const { T } = await import(`/@fs${robot}`);
  T.kid = kid;
  T.honest = !!kid;
  T.run(to).then(() => (window.__done = true), e => (window.__failed = String((e && e.stack) || e)));
}, [robot, to, kid]);

const started = Date.now();
let shown = 0;
for (;;) {
  await page.waitForTimeout(3000);
  const { log, done, failed, now } = await page.evaluate(() => ({ log: window.T.log, done: !!window.__done, failed: window.__failed, now: window.T.state() }));
  for (const row of log.slice(shown)) {
    if (row.stuck) console.log(`level ${row.level}: BLIJFT HANGEN op ${row.state.goals.join(', ')} (munten ${row.state.coins}, gasten ${row.state.guests})`);
    else console.log(`level ${row.level}: ${row.seconds} tellen, munten ${row.coins}${row.topups ? `, kas ${row.topups} keer bijgevuld` : ''}${row.lost ? `, ${row.lost} dieren kwijt` : ''}`);
  }
  shown = log.length;
  const stuck = log.some(row => row.stuck);
  if (done || failed || stuck) {
    const rows = log.filter(row => !row.stuck);
    const seconds = rows.reduce((sum, row) => sum + row.seconds, 0), topups = rows.reduce((sum, row) => sum + row.topups, 0);
    console.log(failed ? `MISLUKT: ${failed}` : `${stuck ? 'GESTOPT' : 'KLAAR'}: ${rows.length} levels in ${Math.round(seconds / 60)} minuten speltijd (${Math.round((Date.now() - started) / 1000)} tellen echt), kas ${topups} keer bijgevuld, ${rows.at(-1)?.lost ?? 0} dieren kwijt`);
    break;
  }
  if (Date.now() - started > 3 * 60 * 60 * 1000) {
    console.log(`TE LANG: nog bezig met level ${now.level} (${now.goals.join(', ')})`);
    break;
  }
}
if (errors.length) console.log('fouten in de pagina:', errors.slice(0, 5));
await browser.close();
process.exit(0);
