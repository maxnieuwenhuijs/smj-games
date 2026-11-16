# SMJ Games

Browserspellen voor kinderen vanaf 4 jaar.

- `games/zoo`: het dierentuinspel (Three.js, TypeScript, Vite).
- `packages/shared`: gedeelde code voor teksten en opslaan.
- `tools/animals`: het Blender-script dat de diermodellen maakt.
- `docs/BOUWPLAN.md`: het bouwplan met alle fases.

## Starten

```bash
npm install
npm run dev
```

Daarna staat het spel op http://localhost:5173.

## Controleren en bouwen

```bash
npm test
npm run build
```

## Diermodellen opnieuw maken

Blender 5.1 is nodig. Het script draait zonder venster en schrijft de modellen naar `games/zoo/public/models`.

```bash
blender --background --python tools/animals/build_animals.py
```

## Publiceren

Elke push naar `main` bouwt de site en zet hem op GitHub Pages (zie `.github/workflows/deploy.yml`).
