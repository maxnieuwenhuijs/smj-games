# SMJ Games

Browserspellen voor kinderen vanaf 4 jaar.

Spelen: https://maxnieuwenhuijs.github.io/smj-games/

- `games/zoo`: het dierentuinspel (Three.js, TypeScript, Vite).
- `packages/shared`: gedeelde code voor teksten en opslaan.
- `tools/animals`: het Blender-script dat de diermodellen maakt, en het script dat ze klein maakt.
- `tools/voice`: het script dat stemmen en geluiden maakt met ElevenLabs.
- `tools/name-proxy`: een servertje dat namen laat inspreken zonder dat de sleutel in het spel staat (zie de README daar).
- `tools/playtest`: een proefspeler die alle levels automatisch doorspeelt, en een hulpje om het spel zonder venster te openen en na te lopen.
- `docs/BOUWPLAN.md`: het bouwplan met alle fases, dieren en levels.

## Starten

```bash
npm install
npm run dev
```

Daarna staat het spel op http://localhost:5173. Alle figuren, plaatjes, stemmen en geluiden staan op http://localhost:5173/figuren.html.

## Controleren en bouwen

```bash
npm test
npm run build
```

## Diermodellen opnieuw maken

Blender 5.1 is nodig. Het script draait zonder venster en schrijft de modellen naar `games/zoo/public/models`. De soorten staan in `tools/animals/build_animals.py` en in de pakketten in `tools/animals/packs`.

```bash
blender --background --python tools/animals/build_animals.py -- out export giraffe
blender --background --python tools/animals/build_animals.py -- out icons giraffe
node tools/animals/optimize.mjs
```

De laatste regel maakt de modellen ongeveer drie keer zo klein. Draai die na elke export.

## Stemmen en geluiden opnieuw maken

Zet je ElevenLabs-sleutel in een bestand `.env` in de hoofdmap. Dat bestand staat in `.gitignore` en komt dus nooit in de repo.

```
ELEVENLABS_API_KEY=...
```

```bash
node tools/voice/build.mjs plan
node tools/voice/build.mjs all
```

Er zijn ook `node tools/voice/build.mjs music` (de achtergrondmuziek) en `node tools/voice/build.mjs names` (de zinnen met een naam erin; `--add Sepp` voegt een naam toe).

Bij `npm run dev` gebruikt het spel die sleutel ook als standaard om een naam in te spreken die nog niet in het lijstje staat. Dat geldt alleen op je eigen computer: in de gebouwde site zit de sleutel nooit (zie `games/zoo/vite.config.ts`). Op de gepubliceerde site vul je hem per apparaat in het oudermenu in.

`plan` telt alleen wat er ontbreekt. `all` maakt de ontbrekende zinnen (Nederlands en Engels) en geluiden; wat er al is, wordt overgeslagen. De zinnen komen uit het spel zelf (`games/zoo/src/lines.ts`), de stemmen staan in `tools/voice/voices.json` en de geluiden in `tools/voice/sounds.json`.

## Proefspelen

Start het spel, begin een nieuw spel en typ in de console van de browser (met het pad naar deze map):

```js
const { T } = await import('/@fs/<pad naar deze map>/tools/playtest/autoplay.js');
await T.run(50);
T.log;
```

Tellen hoeveel berichten de figuren geven (in een bestaand park, plek 2, vijf minuten speltijd):

```js
const { measure } = await import('/@fs/<pad naar deze map>/tools/playtest/berichten.js');
await measure(1, 5);
```

Het spel zonder venster openen en nalopen (met Playwright; handig om iets te controleren of een foto te maken). Start eerst `npm run dev`:

```js
import { boot, emptyPark } from './tools/playtest/kijk.mjs';
const { browser, page, errors } = await boot({ level: 20, coins: 50 }); // een leeg park waarin 20 levels gehaald zijn
await page.evaluate(() => window.__zoo.level); // het spel zelf staat in window.__zoo
await page.screenshot({ path: 'park.png' });
await browser.close();
```

## Publiceren

Elke push naar `main` bouwt de site en zet hem op GitHub Pages (zie `.github/workflows/deploy.yml`).
