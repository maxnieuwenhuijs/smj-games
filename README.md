# SMJ Games

Browserspellen voor kinderen vanaf 4 jaar.

Spelen: https://maxnieuwenhuijs.github.io/smj-games/

- `games/zoo`: het dierentuinspel (Three.js, TypeScript, Vite).
- `packages/shared`: gedeelde code voor teksten en opslaan.
- `tools/animals`: het Blender-script dat de diermodellen maakt, en het script dat ze klein maakt.
- `tools/voice`: het script dat stemmen en geluiden maakt met ElevenLabs.
- `tools/playtest`: een proefspeler die alle levels automatisch doorspeelt.
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

`plan` telt alleen wat er ontbreekt. `all` maakt de ontbrekende zinnen (Nederlands en Engels) en geluiden; wat er al is, wordt overgeslagen. De zinnen komen uit het spel zelf (`games/zoo/src/lines.ts`), de stemmen staan in `tools/voice/voices.json` en de geluiden in `tools/voice/sounds.json`.

## Proefspelen

Start het spel, begin een nieuw spel en typ in de console van de browser (met het pad naar deze map):

```js
const { T } = await import('/@fs/<pad naar deze map>/tools/playtest/autoplay.js');
await T.run(50);
T.log;
```

## Publiceren

Elke push naar `main` bouwt de site en zet hem op GitHub Pages (zie `.github/workflows/deploy.yml`).
