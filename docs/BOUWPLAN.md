# Bouwplan dierentuinspel (4+)

Bijgewerkt op 16 november 2026. Werknaam: Dierentuin. Spelen: https://maxnieuwenhuijs.github.io/smj-games/zoo/

## Wat vaststaat

- **Doelgroep:** kinderen vanaf 4 jaar. Stem en plaatjes eerst, tekst hooguit een korte zin.
- **Beeld:** isometrisch, echte 3D-modellen, tegels van 1 bij 1 in een park van 20 bij 20, hekken op de randen van tegels.
- **Dieren:** vijftig soorten, eigen modellen uit code via Blender, stijl A (blokjes). Elk dier in vier varianten: man, vrouw, zoontje, dochtertje.
- **Animaties:** twaalf per dier: staan, lopen, rennen, eten, zitten, liggen, slapen, poepen, plassen, spelen, blij, verdrietig. Viervoeters en tweevoeters (vogels, kangoeroe) hebben elk hun eigen bewegingen op hetzelfde skelet.
- **Eigen plaatjes:** knoppen, wolkjes en cursors zijn eigen tekeningen, geen emoji. Overzicht: `figuren.html`.
- **Figuren:** vijf 2D-portretten met drie gezichten (blij, bezorgd, dringend) en drie mondjes, elk met een eigen stem.
- **Stem en geluid:** alle zinnen, effecten, dierengeluiden en achtergrondgeluiden zijn gemaakt met ElevenLabs. Nederlands en Engels.
- **Opslaan:** lokaal in de browser, drie opslagplekken. Bewaren in een bestand en terugzetten kan in het oudermenu.
- **Techniek:** Three.js, TypeScript, Vite. Elke push naar `main` zet het spel op GitHub Pages. Het spel is als app te installeren en werkt daarna ook zonder internet.

## De vijf werelden

Elke wereld heeft tien levels en tien dieren. De lucht, het land en de bomen rond het park kleuren mee, en elke wereld heeft een eigen achtergrondgeluid.

| Wereld | Levels | Nieuw in deze wereld |
|---|---|---|
| Boerderij | 1 t/m 10 | Verblijf, voer, slaapplek, poep opruimen, pad, gasten, eetkraam, drinkkraam, jongen, wc, bankje, nest, water |
| Savanne | 11 t/m 20 | Zand, stenen muur voor sterke dieren, ijskraam, bloemen, afval en afvalbakken, meer soorten tegelijk blij |
| Jungle | 21 t/m 30 | Bosgrond, hoog net voor klimmers en vliegers, klimboom, hol, bamboe, zieke dieren, ballonnen, verzorgers |
| IJs en bergen | 31 t/m 40 | Sneeuw, vis, dieren die ontsnappen |
| Verre landen | 41 t/m 50 | Alles door elkaar, en steeds meer tegelijk |

## Wensen van een dier

1. Gezond zijn (een ziek dier wil de dokter).
2. Een dicht verblijf met het goede hek: sterke dieren een stenen muur, klimmers, vliegers en springers een hoog net.
3. Het juiste voer in de voerbak.
4. De juiste slaapplek.
5. De juiste ondergrond.
6. Een vriendje van dezelfde soort.
7. Een schoon hok.

| Dier | Ondergrond | Voer | Slaapplek | Prijs | Hek |
|---|---|---|---|---|---|
| Varken | modder | groente | stro | 1 | |
| Koe | gras | hooi | stal | 2 | |
| Schaap | gras | hooi | stro | 2 | |
| Paard | gras | fruit | stal | 3 | |
| Ezel | gras | groente | stro | 3 | |
| Geit | gras | graan | rots | 3 | |
| Alpaca | gras | graan | stro | 4 | |
| Kip | gras | graan | nest | 2 | |
| Eend | water | graan | nest | 2 | |
| Konijn | gras | groente | hol | 2 | |
| Zebra | zand | hooi | boom | 5 | |
| Giraf | zand | bladeren | boom | 7 | |
| Leeuw | zand | vlees | rots | 10 | muur |
| Kameel | zand | hooi | rots | 6 | |
| Neushoorn | modder | hooi | rots | 10 | muur |
| Nijlpaard | water | groente | boom | 12 | muur |
| Olifant | zand | fruit | boom | 15 | muur |
| Struisvogel | zand | graan | nest | 6 | |
| Cheeta | zand | vlees | boom | 9 | muur |
| Gazelle | zand | bladeren | boom | 6 | |
| Aap | bos | fruit | klimboom | 6 | net |
| Papegaai | bos | fruit | nest | 6 | net |
| Tijger | bos | vlees | hol | 12 | muur |
| Gorilla | bos | bladeren | klimboom | 14 | muur |
| Krokodil | water | vlees | rots | 10 | muur |
| Panda | bos | bamboe | hol | 12 | |
| Pauw | gras | graan | nest | 7 | |
| Toekan | bos | fruit | nest | 8 | net |
| Luiaard | bos | bladeren | klimboom | 9 | net |
| Panter | bos | vlees | hol | 13 | muur |
| Pinguïn | sneeuw | vis | nest | 6 | |
| Zeehond | water | vis | rots | 8 | |
| IJsbeer | sneeuw | vis | hol | 14 | muur |
| Rendier | sneeuw | hooi | stal | 7 | |
| Wolf | sneeuw | vlees | hol | 10 | muur |
| Poolvos | sneeuw | vlees | hol | 7 | |
| Beer | bos | vis | hol | 13 | muur |
| Jak | sneeuw | hooi | stal | 8 | |
| Sneeuwuil | sneeuw | vlees | nest | 8 | net |
| Walrus | sneeuw | vis | rots | 12 | muur |
| Flamingo | water | vis | nest | 7 | |
| Schildpad | zand | groente | boom | 6 | |
| Otter | water | vis | hol | 8 | |
| Bever | water | bladeren | hol | 8 | |
| Pelikaan | water | vis | nest | 9 | |
| Koala | bos | bladeren | klimboom | 10 | net |
| Rode panda | bos | bamboe | klimboom | 11 | net |
| Maki | bos | fruit | klimboom | 10 | net |
| Bizon | gras | hooi | stal | 13 | muur |
| Kangoeroe | zand | hooi | boom | 15 | net |

## Zorgen heeft gevolgen

1. Een dier dat iets mist, toont een wolkje met wat het wil.
2. Na ongeveer een minuut kleurt het wolkje oranje en waarschuwt de verzorger met een dringend gezicht.
3. Na ongeveer tweeënhalve minuut zonder zorg haalt de verzorger één dier op (naar de opvang). De andere dieren in dat verblijf krijgen nog een kans.
4. Het verblijf gaat daarna 45 seconden dicht: er mogen even geen nieuwe dieren in. Zolang hangt er een bordje 'dicht' boven.

Ziek zijn, ontsnapt zijn, een open hek, honger en een vies hok tellen zwaar. Het soort hek, ondergrond, slaapplek en een vriendje tellen licht. De tijden staan bovenaan `games/zoo/src/game.ts`.

## Gebeurtenissen

- **Ziek (vanaf level 21):** af en toe wordt een dier ziek en gaat liggen. Tik erop en kies de dokter.
- **Verzorger (vanaf level 24):** tik op een verblijf en neem voor 5 munten een verzorger aan. Die vult de voerbakken en ruimt de poep op.
- **Ontsnapt (vanaf level 31):** af en toe springt een dier uit zijn verblijf en loopt buiten rond. Tik erop om het op te pakken en tik dan in een verblijf om het terug te zetten.

Vraagt een level om zieke of ontsnapte dieren, dan gebeurt het vaker, zodat je niet lang hoeft te wachten.

## Gasten

Gasten komen binnen bij de ingang zodra daar een pad ligt. Hoe meer volwassen dieren, hoe meer gasten (hooguit 30). Ze lopen alleen over pad. Elke gast laat met een wolkje zien wat hij wil; het wolkje is oranje als dat er niet is in het park.

| Wens | Wat helpt | Levert op |
|---|---|---|
| Honger | Eetkraam | 1 munt |
| Dorst | Drinkkraam | 1 munt |
| Naar de wc | Wc | plezier |
| Moe | Bankje | plezier |
| Zin in ijs | IJskraam | 1 munt |
| Ballon (vooral kinderen) | Ballonnenkraam | 1 munt, en de gast loopt met een ballon |
| Lievelingsdier zien | Een verblijf met dat dier aan het pad | veel plezier |

Wie iets gekocht heeft, loopt even met afval rond. Staat er een afvalbak in de buurt, dan gaat het daarin; anders valt het op het pad. Afval opruimen (erop tikken) levert 1 munt op. Bloembakken en schone verblijven met blije dieren maken gasten blijer; afval en poep maken ze minder blij. Gasten kopen alleen als ze het naar hun zin hebben.

## Munten

- De kas gaat nooit hoger dan 30, zodat tellen makkelijk blijft. Je begint met 10.
- Bijna alles levert 1 munt op: een poepje of afval opruimen, een jong dat geboren wordt, een gast die iets koopt. Een gehaald level geeft 5.
- Een voerbak, slaapplek, bankje, bloembak of afvalbak kost 1. Een eetkraam, drinkkraam of wc kost 3, een ijs- of ballonnenkraam 4, een verzorger 5. Dieren kosten 1 tot 15. Hekken en ondergrond zijn gratis.
- Een blij paar krijgt om de anderhalve minuut een jong. Zijn er al twee jongen, dan verhuist de oudste naar een andere dierentuin en krijg je 2 munten.
- Terugverdienen: heeft het park net veel uitgegeven, dan krijgen gasten wat sneller trek. Zo is een aankoop binnen een paar minuten terugverdiend, zolang de gasten tevreden zijn.

## Wat je kunt aantikken

| Onderdeel | Zit erin |
|---|---|
| Dier | Aaien (je hoort het dier), uit de hand voeren, andere naam, laten slapen, verzetten, dokter (als het ziek is); je ziet welke wensen vervuld zijn |
| Ontsnapt dier | Eén tik pakt het op, een tweede tik zet het in een verblijf |
| Verblijf | Je ziet de naam. Schoonmaken, andere naam, verzorger aannemen, leegmaken (met bevestiging) |
| Voerbak | Vullen met een voersoort; het voer dat de dieren daar lusten staat vooraan; je ziet hoeveel erin zit |
| Gast | Zien hoe het gaat, wat zijn lievelingsdier is en wat hij nu wil; zwaaien |
| Poep en afval | Erop tikken ruimt het op |

## Levels

Elk level speelt een dier vrij en vraagt om twee blije dieren van de soort die je net kreeg. De rest loopt per wereld op.

| Level | Doelen | Je krijgt |
|---|---|---|
| 1 | Verblijf, voerbak | Varken |
| 2 | 2 varkens, slaapplek, 2 keer voeren, 2 blije varkens | Koe |
| 3 | 2 koeien, 2 blije koeien, 3 poepjes | Schaap |
| 4 | 6 tegels pad, 2 blije schapen, 3 blije gasten | Paard |
| 5 | Eetkraam, 2 blije paarden, 8 munten | Ezel |
| 6 | Drinkkraam, 2 blije ezels, 5 blije gasten | Geit |
| 7 | 2 blije geiten, 1 jong, 12 munten | Alpaca |
| 8 | Wc, 2 blije alpaca's, 6 blije gasten | Kip |
| 9 | 2 blije kippen, 2 bankjes, 5 poepjes | Eend |
| 10 | 2 blije eenden, 3 soorten blij, 15 munten | Konijn |
| 11 | 2 blije konijnen, 2 jongen, 8 blije gasten | Zebra |
| 12 | 2 blije zebra's, ijskraam, 18 munten | Giraf |
| 13 | 2 blije giraffen, 4 soorten blij, 9 blije gasten | Leeuw |
| 14 | 2 blije leeuwen, 6 poepjes, 20 munten | Kameel |
| 15 | 2 blije kamelen, 3 bloembakken, 10 blije gasten | Neushoorn |
| 16 | 2 blije neushoorns, 2 jongen, 12 blije dieren | Nijlpaard |
| 17 | 2 blije nijlpaarden, 5 soorten blij, 22 munten | Olifant |
| 18 | 2 blije olifanten, 2 afvalbakken, 12 blije gasten | Struisvogel |
| 19 | 2 blije struisvogels, 4 keer afval, 3 jongen | Cheeta |
| 20 | 2 blije cheeta's, 6 soorten blij, 13 blije gasten, 25 munten | Gazelle |
| 21 | 2 blije gazellen, 1 ziek dier beter, 14 blije dieren | Aap |
| 22 | 2 blije apen, ballonnenkraam, 14 blije gasten | Papegaai |
| 23 | 2 blije papegaaien, 2 zieke dieren beter, 26 munten | Tijger |
| 24 | 2 blije tijgers, 1 verzorger, 8 poepjes | Gorilla |
| 25 | 2 blije gorilla's, 7 soorten blij, 15 blije gasten | Krokodil |
| 26 | 2 blije krokodillen, 3 jongen, 6 keer afval | Panda |
| 27 | 2 blije panda's, 16 blije dieren, 28 munten | Pauw |
| 28 | 2 blije pauwen, 2 verzorgers, 2 zieke dieren beter | Toekan |
| 29 | 2 blije toekans, 8 soorten blij, 16 blije gasten | Luiaard |
| 30 | 2 blije luiaards, 4 jongen, 18 blije dieren, 30 munten | Panter |
| 31 | 2 blije panters, 1 dier gevangen, 16 blije gasten | Pinguïn |
| 32 | 2 blije pinguïns, 2 zieke dieren beter, 18 blije dieren | Zeehond |
| 33 | 2 blije zeehonden, 2 dieren gevangen, 30 munten | IJsbeer |
| 34 | 2 blije ijsberen, 9 soorten blij, 17 blije gasten | Rendier |
| 35 | 2 blije rendieren, 4 jongen, 8 keer afval | Wolf |
| 36 | 2 blije wolven, 3 verzorgers, 20 blije dieren | Poolvos |
| 37 | 2 blije poolvossen, 3 zieke dieren beter, 2 dieren gevangen, 18 blije gasten | Beer |
| 38 | 2 blije beren, 10 soorten blij, 30 munten | Jak |
| 39 | 2 blije jakken, 5 jongen, 22 blije dieren | Sneeuwuil |
| 40 | 2 blije sneeuwuilen, 20 blije gasten, 3 zieke dieren beter, 10 poepjes | Walrus |
| 41 | 2 blije walrussen, 10 soorten blij, 20 blije gasten | Flamingo |
| 42 | 2 blije flamingo's, 5 jongen, 3 dieren gevangen | Schildpad |
| 43 | 2 blije schildpadden, 24 blije dieren, 30 munten | Otter |
| 44 | 2 blije otters, 4 verzorgers, 4 zieke dieren beter | Bever |
| 45 | 2 blije bevers, 11 soorten blij, 21 blije gasten | Pelikaan |
| 46 | 2 blije pelikanen, 6 jongen, 10 keer afval | Koala |
| 47 | 2 blije koala's, 26 blije dieren, 3 dieren gevangen, 30 munten | Rode panda |
| 48 | 2 blije rode panda's, 12 soorten blij, 22 blije gasten | Maki |
| 49 | 2 blije maki's, 5 zieke dieren beter, 6 jongen, 28 blije dieren | Bizon |
| 50 | 2 blije bizons, 12 soorten blij, 22 blije gasten, 30 blije dieren, 30 munten | Kangoeroe |

'Soorten blij' betekent: zoveel soorten waarvan er minstens twee blij zijn. Na level 50 is het vrij spelen.

## Stem en geluid

- `tools/voice/build.mjs` maakt alles met ElevenLabs. De zinnen komen uit het spel zelf (`games/zoo/src/lines.ts`), zodat tekst en stem nooit uit elkaar lopen. Wat al gemaakt is, wordt overgeslagen.
- De sleutel staat alleen lokaal in `.env` en komt nooit in de repo.
- Stemmen (Nederlands): directeur YME, verzorger Roos, bouwer Eric, gastvrouw Emma, kassier Marti. Andere stem kiezen: `tools/voice/voices.json` aanpassen en het script opnieuw draaien.
- Geluiden: `tools/voice/sounds.json` (effecten, vijftig dierengeluiden, vijf achtergronden).
- Het mondje van een figuur beweegt mee met het geluid. Zonder geluid praat het op een klokje.
- Beluisteren: `figuren.html`.

## Voor ouders

Op het startscherm staat rechtsonder een knop die je drie tellen vasthoudt. Daarachter: een opslagplek bewaren in een bestand, terugzetten uit een bestand, en de taal (Nederlands of Engels).

## Fases

| Fase | Wat | Stand |
|---|---|---|
| 0. Proef | Leeuwenfamilie in stijl A, twaalf animaties | Klaar |
| 1. Opzet | Repo-indeling, Vite, Three.js, automatisch publiceren | Klaar |
| 2. Speelbare kern | Raster, hekken, verblijven, wensen, voeren, poep, levels, opslaan | Gebouwd |
| 3. Figuren | Portretten, praatvenster, eigen plaatjes en cursors, menu's | Gebouwd |
| 4. Stem en geluid | Stemmen, effecten, dierengeluiden, achtergrond, mond beweegt mee | Gebouwd |
| 5. Gasten en geld | Paden, gasten met wensen, kramen, wc, bankje, afval, munten | Gebouwd |
| 6. Wereld 1 | Tien boerderijdieren, jongen krijgen | Gebouwd |
| 7. Wereld 2 t/m 5 | Veertig dieren, tweevoeters, vijftig levels | Gebouwd |
| 8. Gebeurtenissen | Ziek dier, ontsnapt dier, verzorger die helpt | Gebouwd |
| 9. Afwerking | Installeren als app, offline, kleinere modelbestanden, oudermenu | Gebouwd |
| 10. Vertalen | Engels met stem | Gebouwd |

Alles is gebouwd en door een proefspeler (script) doorgespeeld. Wat nog ontbreekt is spelen met een kind en op een tablet: daar komen de echte verbeterpunten vandaan.

## Onderhoud

- Dier toevoegen of aanpassen: `tools/animals/packs/*.py`, exporteren met Blender, daarna `node tools/animals/optimize.mjs`.
- Level, prijs of wens aanpassen: `games/zoo/src/data.ts`. Tekst: `games/zoo/src/nl.json` en `en.json`, daarna het stemmenscript.
- Proefspeler: `tools/playtest/autoplay.js` speelt alle levels achter elkaar en meet de tijd per level.

## Nog te beslissen

- De naam van het spel.
- Of de gekozen stemmen bevallen (beluisteren op `figuren.html`).
- Of er naast het achtergrondgeluid ook muziek komt.
- Hoe streng verwaarlozing moet zijn voor de jongste spelers.
