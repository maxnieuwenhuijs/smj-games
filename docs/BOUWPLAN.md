# Bouwplan dierentuinspel (4+)

Bijgewerkt op 16 november 2026. Werknaam: nog te kiezen.

## Wat vaststaat

- **Doelgroep:** kinderen vanaf 4 jaar. Stem en iconen eerst, tekst hooguit een of twee woorden.
- **Niet kunnen verliezen:** geen failliet, geen dode dieren. Een dier wordt hooguit verdrietig.
- **Beeld:** isometrisch, echte 3D-modellen, tegels van 1 bij 1, hekken op de randen van tegels.
- **Dieren:** eigen modellen uit code via Blender, stijl A (blokjes). Elk dier in vier varianten: man, vrouw, zoontje, dochtertje.
- **Animaties:** twaalf per viervoeter: staan, lopen, rennen, eten, zitten, liggen, slapen, poepen, plassen, spelen, blij, verdrietig.
- **Figuren:** vijf 2D-portretten met drie mondjes en drie gezichten, elk met een eigen stem.
- **Stem:** Nederlandse teksten in een tekstenbestand, ingesproken met ElevenLabs tijdens het bouwen. Vertalen kan later door een tweede tekstenbestand toe te voegen.
- **Geluiden:** dierengeluiden en effecten (bouwen, munt, opruimen, feestje bij een gehaald level) komen ook van ElevenLabs. Ze staan als korte omschrijving in een geluidenlijst en worden door hetzelfde script gemaakt als de stemmen.
- **Opslaan:** lokaal in de browser, drie opslagplekken, met export en import achter een oudersluis.
- **Techniek:** Three.js, TypeScript, Vite. Publiceren via GitHub Pages; de repo mag openbaar blijven omdat alle modellen van onszelf zijn.

## De vijf figuren

| Figuur | Gaat over |
|---|---|
| Directeur | De levels en de grote opdrachten |
| Dierenverzorger | Dieren: honger, vies hok, verdrietig dier |
| Parkbouwer | Het park: hekken, paden, gebouwen |
| Gastvrouw | Bezoekers: honger, dorst, plezier |
| Kassier | Munten |

## Wensen van een dier

Elk dier heeft vier wensen, elk met een icoon:

1. De juiste ondergrond.
2. Het juiste voer in de voerbak.
3. Een vriendje van dezelfde soort.
4. Een schoon hok.

**Voersoorten:** hooi en gras, groente en fruit, graan en zaden (Boerderij), vlees (Savanne), bladeren (Jungle), vis (IJs en bergen). Fout voer geeft geen straf; het dier schudt zijn kop en het kind kiest opnieuw.

**Vies hok:** dieren poepen en plassen af en toe. Poepjes blijven liggen tot het kind erop tikt; plasjes drogen vanzelf op.

## De 50 levels

Een park dat blijft groeien. Elk level heeft een tot drie doelen met voortgangsbalken en speelt een dier vrij.

| Wereld | Levels | Speelt ook vrij |
|---|---|---|
| Boerderij | 1 t/m 10 | houten hek, gras, eetkraam |
| Savanne | 11 t/m 20 | zand, stenen hek, drinkkraam |
| Jungle | 21 t/m 30 | planten, water, speeltuin |
| IJs en bergen | 31 t/m 40 | sneeuw, rots, glazen wand |
| Water en verre landen | 41 t/m 50 | bassin, souvenirwinkel |

## Fases

| Fase | Wat | Klaar als |
|---|---|---|
| 0. Proef | Leeuwenfamilie in stijl A, twaalf animaties, bouwscript, testpagina | **Klaar** |
| 1. Opzet | Repo-indeling (`games/zoo`, `packages/shared`, `tools`), Vite, Three.js, automatisch publiceren | **Klaar.** Het spel staat op https://maxnieuwenhuijs.github.io/smj-games/zoo/ |
| 2. Speelbare kern | Raster, camera, ondergrond, hek en poort, verblijfherkenning, dieren plaatsen, vier wensen, voerbak met twee voersoorten, poepjes opruimen, levels 1 t/m 3, opslaan | **Gebouwd en zelf doorgespeeld.** Nog niet met een kind getest. Levels 1 t/m 3 gebruiken varken, koe en schaap |
| 3. Figuren | Vijf portretten, opdrachtvenster, portret naast elke voortgangsbalk, alle teksten in het tekstenbestand | Elke opdracht komt van het juiste figuur |
| 4. Stem en geluid | ElevenLabs-script voor stemmen en geluiden, een stem per figuur, mond beweegt mee, een geluid per dier en per handeling | Het spel is speelbaar zonder te lezen en elke tik geeft geluid |
| 5. Gasten en geld | Paden, gasten met honger, dorst en plezier, kramen, bankje, speeltuin, munten | Blije gasten leveren munten op waarmee je bouwt |
| 6. Wereld 1 | Tien boerderijdieren in vier varianten, kindjes krijgen, eigen gedrag (slapen, spelen), levels 1 t/m 10 | Wereld 1 is van begin tot eind speelbaar |
| 7. Wereld 2 t/m 5 | Veertig dieren, nieuwe skeletten (vogel, aap, zwemmer), materialen en gebouwen, levels 11 t/m 50 | Alle 50 levels zijn te halen |
| 8. Gebeurtenissen | Ziek dier, ontsnapt dier, verzorger die automatisch voert en opruimt | Elke gebeurtenis is met een of twee tikken op te lossen |
| 9. Afwerking | Installeren als app, offline, kleinere modelbestanden, oudersluis, export en import | Het spel draait soepel op een gewone tablet |
| 10. Vertalen | Tweede taal met stem | Het spel is volledig in twee talen te spelen |

Na fase 2 en na fase 4 testen we met een kind en sturen we de bediening bij voordat er meer inhoud bijkomt.

## Nog te beslissen

- De naam van het spel.
- Welke tien dieren in elke wereld komen.
- De stemmen van de vijf figuren.
- Of er achtergrondmuziek komt.
