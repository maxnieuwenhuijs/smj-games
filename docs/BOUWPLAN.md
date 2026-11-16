# Bouwplan dierentuinspel (4+)

Bijgewerkt op 16 november 2026. Werknaam: nog te kiezen. Spelen: https://maxnieuwenhuijs.github.io/smj-games/zoo/

## Wat vaststaat

- **Doelgroep:** kinderen vanaf 4 jaar. Stem en plaatjes eerst, tekst hooguit een korte zin.
- **Beeld:** isometrisch, echte 3D-modellen, tegels van 1 bij 1 in een park van 20 bij 20, hekken op de randen van tegels.
- **Dieren:** eigen modellen uit code via Blender, stijl A (blokjes). Elk dier in vier varianten: man, vrouw, zoontje, dochtertje.
- **Animaties:** twaalf per viervoeter: staan, lopen, rennen, eten, zitten, liggen, slapen, poepen, plassen, spelen, blij, verdrietig.
- **Eigen plaatjes:** knoppen, wolkjes en cursors zijn eigen tekeningen, geen emoji. Overzicht: `figuren.html`.
- **Figuren:** vijf 2D-portretten met drie gezichten (blij, bezorgd, dringend) en drie mondjes, elk straks met een eigen stem.
- **Stem en geluid:** Nederlandse teksten in een tekstenbestand, ingesproken met ElevenLabs tijdens het bouwen. Dierengeluiden en effecten komen uit hetzelfde script. Vertalen kan later met een tweede tekstenbestand.
- **Opslaan:** lokaal in de browser, drie opslagplekken, straks met export en import achter een oudersluis.
- **Techniek:** Three.js, TypeScript, Vite. Elke push naar `main` zet het spel op GitHub Pages.

## Zorgen heeft gevolgen

Het eerste plan zei dat je niet kunt verliezen. Dat is op verzoek veranderd: verwaarlozen heeft gevolgen, maar met veel waarschuwing vooraf.

1. Een dier dat iets mist, toont een wolkje met wat het wil.
2. Na ongeveer een minuut kleurt het wolkje oranje en waarschuwt de verzorger met een dringend gezicht.
3. Na ongeveer tweeënhalve minuut zonder zorg haalt de verzorger één dier op (naar de opvang). De andere dieren in dat verblijf krijgen nog een kans.
4. Het verblijf gaat daarna 45 seconden dicht: er mogen even geen nieuwe dieren in.

Verblijf, voer en een schoon hok tellen zwaar. Ondergrond, slaapplek, een vriendje en een stenen muur tellen licht. De tijden staan bovenaan `games/zoo/src/game.ts` en zijn makkelijk aan te passen.

## De vijf figuren

| Figuur | Gaat over | In het spel |
|---|---|---|
| Directeur | De levels | Opent elk level en feliciteert |
| Bouwer | Hekken, paden, slaapplekken | Geeft bouwopdrachten, noemt de naam van een nieuw verblijf |
| Verzorger | Dieren | Honger, vies hok, verkeerd voer, jong geboren, dier opgehaald |
| Gastvrouw | Gasten en kramen | Eerste gasten, honger en dorst, verveelde gasten |
| Kassier | Munten | Niet genoeg munten, kas vol |

## Wensen van een dier

1. Een dicht verblijf (sterke dieren: rondom een stenen muur).
2. Het juiste voer in de voerbak.
3. De juiste slaapplek.
4. De juiste ondergrond.
5. Een vriendje van dezelfde soort.
6. Een schoon hok.

| Dier | Ondergrond | Voer | Slaapplek | Prijs | Sterk |
|---|---|---|---|---|---|
| Varken | modder | groente | stro | 1 | |
| Koe | gras | hooi | stal | 2 | |
| Schaap | gras | hooi | stro | 2 | |
| Paard | gras | fruit | stal | 3 | |
| Ezel | gras | groente | stro | 3 | |
| Geit | gras | graan | rots | 3 | |
| Alpaca | gras | graan | stro | 4 | |
| Zebra | zand | hooi | boom | 5 | |
| Giraf | zand | bladeren | boom | 7 | |
| Leeuw | zand | vlees | rots | 10 | ja |
| Kameel | zand | hooi | rots | 6 | |
| Neushoorn | modder | hooi | rots | 10 | ja |
| Nijlpaard | water | groente | boom | 12 | ja |
| Olifant | zand | fruit | boom | 15 | ja |

## Munten

- De kas gaat nooit hoger dan 30, zodat tellen makkelijk blijft. Je begint met 10.
- Bijna alles levert 1 munt op: een poepje opruimen, een jong dat geboren wordt, een gast die iets koopt. Een gehaald level geeft 5.
- Een voerbak of slaapplek kost 1, een bankje 1, een kraam 3. Dieren kosten 1 tot 15. Hekken en ondergrond zijn gratis.
- Een blij paar krijgt om de anderhalve minuut een jong. Zijn er al twee jongen, dan verhuist de oudste naar een andere dierentuin en krijg je 2 munten.
- Gasten kopen alleen als ze het naar hun zin hebben, hooguit één keer eten en één keer drinken per bezoek.
- Terugverdienen: heeft het park net veel uitgegeven, dan krijgen gasten wat sneller trek. Zo is een aankoop binnen een paar minuten terugverdiend, zolang de gasten tevreden zijn.

## Gasten

Gasten komen binnen bij de ingang zodra daar een pad ligt. Hoe meer volwassen dieren, hoe meer gasten (hooguit 24). Ze lopen alleen over pad, kijken bij verblijven met dieren (blije dieren en een schoon hok geven meer plezier), kopen bij een kraam die aan het pad staat en rusten op een bankje. Wie zich verveelt, gaat eerder weg.

## Wat je kunt aantikken

| Onderdeel | Zit erin | Later |
|---|---|---|
| Dier | Aaien, uit de hand voeren, andere naam, laten slapen (verdoven), verzetten; je ziet welke wensen vervuld zijn | Dierenarts roepen, borstelen, speelgoed geven, foto maken |
| Verblijf | Schoonmaken, andere naam, leegmaken (met bevestiging) | Verzorger toewijzen, bordje met de soort, openen en sluiten |
| Voerbak | Vullen met een voersoort; je ziet hoeveel erin zit | Drinkbak, automatisch bijvullen door een verzorger |
| Gast | Zien hoe het gaat, zwaaien | Ballon geven, de weg wijzen, foto |
| Kraam en bankje | Neerzetten en weghalen | Zien hoeveel er verkocht is, ander assortiment, verzetten |
| Verzorger | Nog niet in het spel | Verblijf toewijzen, voeren, opruimen, naar een ziek dier sturen |

## Levels

Elk level speelt een dier vrij. Er zijn nu 14 levels uitgeschreven; een level doet pas mee als het model van het dier er is.

| Level | Doelen | Je krijgt |
|---|---|---|
| 1 | Verblijf, voerbak | Varken |
| 2 | 2 varkens, slaapplek, 2 keer voeren, 2 blije varkens | Koe |
| 3 | 2 koeien, 2 blije koeien, 3 poepjes | Schaap |
| 4 | 6 tegels pad, 2 blije schapen, 3 blije gasten | Paard |
| 5 | Eetkraam, 2 blije paarden, 8 munten | Ezel |
| 6 | Drinkkraam, 2 blije ezels, 5 blije gasten | Geit |
| 7 | 2 blije geiten, 1 jong, 15 munten | Alpaca |
| 8 | 2 blije alpaca's, 6 blije gasten, 5 poepjes | Zebra |
| 9 | 2 blije zebra's, 2 bankjes, 20 munten | Giraf |
| 10 | 2 blije giraffen, 2 jongen, 8 blije gasten | Leeuw |
| 11 | 2 blije leeuwen, 25 munten | Kameel |
| 12 | 2 blije kamelen, 10 blije gasten | Neushoorn |
| 13 | 2 blije neushoorns, 3 jongen | Nijlpaard |
| 14 | 2 blije nijlpaarden, 12 blije gasten, 30 munten | Olifant |

De vijf werelden blijven het doel: boerderij (1 t/m 10), savanne (11 t/m 20), jungle, ijs en bergen, water en verre landen. Vogels, apen en zwemmers hebben elk een eigen skelet nodig en komen daarna.

## Fases

| Fase | Wat | Stand |
|---|---|---|
| 0. Proef | Leeuwenfamilie in stijl A, twaalf animaties | **Klaar** |
| 1. Opzet | Repo-indeling, Vite, Three.js, automatisch publiceren | **Klaar** |
| 2. Speelbare kern | Raster, hekken, verblijven, wensen, voeren, poep, levels, opslaan | **Gebouwd**, nog niet met een kind getest |
| 3. Figuren | Portretten, praatvenster, portret bij elke balk, eigen plaatjes en cursors, menu's | **Gebouwd** |
| 4. Stem en geluid | ElevenLabs-script voor stemmen en geluiden, mond beweegt mee met het geluid | Nog doen |
| 5. Gasten en geld | Paden, gasten, kramen, bankje, munten | **Gebouwd**, afstelling nog te testen |
| 6. Wereld 1 | Boerderijdieren, jongen krijgen, levels | Bezig: zeven soorten, jongen worden geboren |
| 7. Wereld 2 t/m 5 | Meer dieren, nieuwe skeletten, levels tot 50 | Bezig: savanne met zeven soorten |
| 8. Gebeurtenissen | Ziek dier, ontsnapt dier, verzorger die helpt | Nog doen (verwaarlozing zit er al in) |
| 9. Afwerking | Installeren als app, offline, kleinere modelbestanden, oudersluis | Nog doen |
| 10. Vertalen | Tweede taal met stem | Nog doen |

## Nog te beslissen

- De naam van het spel.
- De stemmen van de vijf figuren.
- Of er achtergrondmuziek komt.
- Hoe streng verwaarlozing moet zijn voor de jongste spelers.
