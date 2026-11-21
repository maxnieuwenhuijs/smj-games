# Namen laten inspreken zonder de sleutel in het spel

Het spel staat openbaar op GitHub Pages; daar kan geen geheim in zitten. Dit mapje bevat een klein servertje (een Cloudflare Worker) dat de ElevenLabs-sleutel als geheim bewaart en alleen de vaste zinnen met een naam inspreekt. Het spel vraagt daar de opnames op voor een naam die nog niet in het lijstje staat, en bewaart ze op het apparaat.

## Eén keer aanzetten

Je hebt een (gratis) Cloudflare-account nodig. In deze map:

```powershell
npx wrangler login
```

```powershell
npx wrangler secret put ELEVENLABS_API_KEY
```

```powershell
npx wrangler deploy
```

De laatste regel print een adres, bijvoorbeeld `https://smj-zoo-namen.<jouw-naam>.workers.dev`. Zet dat adres in `games/zoo/public/config.json` bij `nameProxy` en push. Daarna werkt elke naam op de live site.

Maak het liefst een aparte ElevenLabs-sleutel voor dit servertje, met een limiet.

## Beveiliging

- Alleen de vaste zinnen met een naam (`lines.js`), met de vaste stemmen. Vrije tekst kan niet.
- Een naam is hooguit 14 letters.
- Alleen het spel op `maxnieuwenhuijs.github.io` (en `localhost:5173`) mag het vanuit een browser aanroepen. Wie het adres kent, kan het met een eigen programma toch aanroepen; daarom is er de dagelijkse rem.
- Dezelfde naam wordt bewaard en kost maar één keer tegoed (ongeveer 300 tekens per naam).
- Dagelijkse rem: zie `wrangler.toml` (hooguit 40 nieuwe namen per dag, als je de KV-opslag koppelt).

De naam van de speler gaat naar dit servertje en naar ElevenLabs om te worden ingesproken, verder nergens heen.

## Als de zinnen of stemmen veranderen

```powershell
node tools/name-proxy/make-lines.mjs
```

en daarna opnieuw `npx wrangler deploy`.
