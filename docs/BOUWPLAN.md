# Bouwplan dierentuinspel (4+)

Bijgewerkt op 16 november 2026. Werknaam: Dierentuin. Spelen: https://maxnieuwenhuijs.github.io/smj-games/zoo/

## Wat vaststaat

- **Doelgroep:** kinderen vanaf 4 jaar. Stem en plaatjes eerst, tekst hooguit een korte zin.
- **Beeld:** isometrisch, echte 3D-modellen, tegels van 1 bij 1 in een park van 28 bij 28, hekken op de randen van tegels. Een ouder, kleiner park komt bij het laden midden tegen de voorkant te liggen, zodat het pad aan de ingang vast blijft zitten.
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
| Savanne | 11 t/m 20 | Zand, stenen muur voor sterke dieren, ijskraam, voerders en schoonmakers, bloemen, afval en afvalbakken, meer soorten tegelijk blij |
| Jungle | 21 t/m 30 | Bosgrond, hoog net voor klimmers en vliegers, klimboom, hol, bamboe, zieke dieren, ballonnen |
| IJs en bergen | 31 t/m 40 | Sneeuw, vis, dieren die ontsnappen |
| Verre landen | 41 t/m 50 | Alles door elkaar, en steeds meer tegelijk |

Bij de knop Dier kies je eerst de wereld en dan het dier. Vlak boven de knop staat de rij met werelden, elk met een eigen plaatje (schuur, savanneboom, junglepalm, besneeuwde berg, eiland) en geen dierenkop. Daarboven staan de dieren van de gekozen wereld, en bovenaan jongen of meisje. De rij met werelden is er pas als je dieren uit meer dan één wereld hebt.

## Wensen van een dier

1. Gezond zijn (een ziek dier wil de dokter).
2. Een dicht verblijf met het goede hek: sterke dieren een stenen muur, klimmers, vliegers en springers een hoog net.
3. Het juiste voer in de voerbak.
4. De juiste slaapplek.
5. De juiste ondergrond.
6. Een vriendje van dezelfde soort; groepsdieren willen met meer zijn (zie hieronder).
7. Een schoon hok.
8. Genoeg ruimte: grote dieren willen een groot verblijf (zie hieronder).
9. Iets leuks in het verblijf (vanaf level 10): het eigen lievelingsding van het dier.

| Dier | Ondergrond | Voer | Slaapplek | Prijs | Hek |
|---|---|---|---|---|---|
| Varken | modder | groente | stro | 2 | |
| Koe | gras | hooi | stal | 3 | |
| Schaap | gras | hooi | stro | 3 | |
| Paard | gras | fruit | stal | 5 | |
| Ezel | gras | groente | stro | 5 | |
| Geit | gras | graan | rots | 5 | |
| Alpaca | gras | graan | stro | 6 | |
| Kip | gras | graan | nest | 3 | |
| Eend | water | graan | nest | 3 | |
| Konijn | gras | groente | hol | 3 | |
| Zebra | zand | hooi | boom | 8 | |
| Giraf | zand | bladeren | boom | 14 | |
| Leeuw | zand | vlees | rots | 20 | muur |
| Kameel | zand | hooi | rots | 10 | |
| Neushoorn | modder | hooi | rots | 20 | muur |
| Nijlpaard | water | groente | boom | 22 | muur |
| Olifant | zand | fruit | boom | 28 | muur |
| Struisvogel | zand | graan | nest | 9 | |
| Cheeta | zand | vlees | boom | 16 | muur |
| Gazelle | zand | bladeren | boom | 9 | |
| Aap | bos | fruit | klimboom | 14 | net |
| Papegaai | bos | fruit | nest | 14 | net |
| Tijger | bos | vlees | hol | 34 | muur |
| Gorilla | bos | bladeren | klimboom | 40 | muur |
| Krokodil | water | vlees | rots | 26 | muur |
| Panda | bos | bamboe | hol | 30 | |
| Pauw | gras | graan | nest | 15 | |
| Toekan | bos | fruit | nest | 16 | net |
| Luiaard | bos | bladeren | klimboom | 18 | net |
| Panter | bos | vlees | hol | 36 | muur |
| Pinguïn | sneeuw | vis | nest | 15 | |
| Zeehond | water | vis | rots | 20 | |
| IJsbeer | sneeuw | vis | hol | 45 | muur |
| Rendier | sneeuw | hooi | stal | 18 | |
| Wolf | sneeuw | vlees | hol | 30 | muur |
| Poolvos | sneeuw | vlees | hol | 18 | |
| Beer | bos | vis | hol | 40 | muur |
| Jak | sneeuw | hooi | stal | 20 | |
| Sneeuwuil | sneeuw | vlees | nest | 20 | net |
| Walrus | sneeuw | vis | rots | 36 | muur |
| Flamingo | water | vis | nest | 18 | |
| Schildpad | zand | groente | boom | 16 | |
| Otter | water | vis | hol | 20 | |
| Bever | water | bladeren | hol | 20 | |
| Pelikaan | water | vis | nest | 22 | |
| Koala | bos | bladeren | klimboom | 30 | net |
| Rode panda | bos | bamboe | klimboom | 36 | net |
| Maki | bos | fruit | klimboom | 30 | net |
| Bizon | gras | hooi | stal | 42 | muur |
| Kangoeroe | zand | hooi | boom | 50 | net |

### Iets leuks in het verblijf

Vanaf level 10 willen de meeste dieren iets leuks in hun verblijf, en elk dier heeft een eigen lievelingsding: een bal (varken, paard, leeuw, aap, zeehond, kangoeroe en andere speelse dieren), een struik met bessen (koe, schaap, giraf, panda, koala), een boomstam (ezel, geit, olifant, gorilla, beer, bever) of een bloemperk (gazelle, papegaai, poolvos). Het wolkje boven het dier laat zien welk ding het wil. Kippen, eenden, konijnen, struisvogels, pauwen, flamingo's, pelikanen, schildpadden en krokodillen hebben niets nodig. Met de knop Speelgoed zet je het neer; elk ding kost 2 munten en één is genoeg voor alle dieren van die soort in het verblijf. Blije dieren lopen er geregeld naartoe en spelen ermee, en dan beweegt het ding mee: de bal stuitert, de struik ritselt, de stam wiebelt, de bloemen wuiven. Een dier dat zich verveelt is niet blij (het telt dus niet mee voor een level), maar wordt er nooit voor opgehaald. De verzorger vertelt het één keer als het begint, ook in een ouder opgeslagen spel dat al verder is.

### Ruimte en groepen

- **Ruimte:** grote dieren willen een groot verblijf, en elk groot dier telt apart (`SPACE` en `spaceNeed` in data.ts; een jong telt half). Per dier 12 tegels: olifant, giraf. 10: neushoorn, nijlpaard. 9: ijsbeer, bizon, walrus. 8: leeuw, tijger, beer, gorilla, kameel, panter, cheeta, wolf, kangoeroe. 6: paard, koe, zebra, ezel, rendier, jak, krokodil, zeehond, panda, struisvogel. Twee olifanten willen dus 24 tegels en drie olifanten 36; een giraf en twee zebra's samen 24. De rest neemt geen ruimte in en past overal. Is het te klein, dan zie je een eigen plaatje (een klein hok met een dier erin en groene pijlen naar buiten) in het wolkje, en zegt de bouwer dat het verblijf groter moet. Zet je een dier in een te klein verblijf, dan zie en hoor je dat meteen. Het dier wordt er niet voor opgehaald.
- **Groepen:** groepsdieren willen met meer bij elkaar zijn (jongen tellen mee). Vijf: kip, pinguïn, flamingo. Vier: eend, konijn, gazelle, aap, maki. Drie: schaap, geit, alpaca, zebra, struisvogel, papegaai, toekan, rendier, wolf, otter, pelikaan, bizon. Alle andere dieren zijn tevreden met z'n tweeën. In het wolkje staat hoeveel er nog bij moeten (+3).

### Kunstjes en gebaren

Elk dier heeft twaalf animaties uit het model. Daar bovenop beweegt het spel het hele dier, zodat er veel meer te zien is. Een blij dier doet ongeveer een op de vier keer iets extra's:

| Kunstje | Wat je ziet |
|---|---|
| Springen | Op en neer, met indrukken en uitrekken |
| Rondje draaien | Om zijn eigen as |
| Rollen | Op de grond heen en weer rollen |
| Kwispelen | Snel heen en weer draaien |
| Uitrekken | Lang en plat worden |
| Rennen | Een sprintje naar de andere kant van het verblijf (de ren-animatie) |
| Kroelen | Naar een vriendje lopen, neus aan neus, met een hartje; een jong loopt naar zijn moeder |
| Gast begroeten | Naar een gast bij het hek draaien en opspringen |
| Droogschudden | Na het zwemmen schudt het zich uit, met spatters |
| Ademen | In de slaap gaat het lijf zachtjes op en neer |
| Dansen | Alle dieren dansen als je een level haalt |

Gasten doen ook meer. Bij een verblijf zwaaien ze, wijzen ze, maken ze een foto (handen voor het gezicht) of klappen ze. Wie iets lekkers kocht, heeft het in zijn hand en neemt nog een paar happen of slokken. Bij de toonbank steken ze hun hand uit. Wie zijn lievelingsdier ziet, juicht met de armen omhoog en springt; bij een gehaald level juichen alle gasten. Een blij kind huppelt en een moe gastje loopt voorovergebogen. Een werker die even niets te doen heeft, veegt zijn voorhoofd af.

### Zwemmen

Op een watertegel zakt een dier voor een derde weg en dobbert het; als het door het water loopt, spatten er druppels op.

### Slapen

Een dier dat gaat slapen, loopt naar zijn slaapplek en gaat er midden bovenop liggen: op de rots, op het stro, in het nest. Het blijft erbovenop staan tot het wegloopt.

## Zorgen heeft gevolgen

1. Een dier dat iets mist, toont een wolkje met wat het wil.
2. Na ongeveer tweeënhalve minuut kleurt het wolkje oranje en waarschuwt de verzorger met een dringend gezicht.
3. Na ongeveer zes minuten zonder zorg haalt de verzorger één dier op (naar de opvang). De andere dieren in dat verblijf krijgen nog een kans.
4. Het verblijf gaat daarna 45 seconden dicht: er mogen even geen nieuwe dieren in. Zolang hangt er een bordje 'dicht' boven.

Ziek zijn, ontsnapt zijn, een open hek, honger en een vies hok tellen zwaar. Het soort hek, ondergrond, slaapplek en een vriendje tellen licht. De tijden staan bovenaan `games/zoo/src/game.ts`.

Hoe vaak je moet zorgen: een volle voerbak houdt twee volwassen dieren ongeveer een kwartier zoet (een dier eet eens in de acht minuten en heeft pas na twaalf minuten zonder eten echt honger; vraagt een level om voeren, dan gaat dat tweeënhalf keer zo snel), en een verblijf met twee dieren is pas na ongeveer een kwartier vies: een volwassen dier poept eens in de zes tot negen minuten, en de dieren vinden het vies vanaf vier poepjes. Vraagt een level om opruimen, dan poepen ze vier keer zo vaak, zodat dat doel niet lang duurt. Jongen eten mee zonder dat de bak leger wordt en poepen niet. Zo is een boerderij met tien verblijven met de hand bij te houden. Wordt het park groter, dan zijn er verzorgers. Wordt er een dier opgehaald uit een verblijf zonder verzorger, dan geeft de verzorger de tip om hulp aan te nemen.

## Complimentjes tussendoor

Gaat het goed, dan zegt een figuur om de drie à vier minuten iets aardigs: de verzorger over de dieren (als vier van de vijf blij zijn), de gastvrouw over de gasten (als twee van de drie blij zijn), de directeur en de bouwer over het park, de kassier over de kas. Acht zinnen, bijvoorbeeld "Wat zien je dieren er blij uit!" en "Ik ben trots op jouw dierentuin." Een complimentje komt alleen als het stil is en er geen dier al lang op hulp wacht.

## Rust: hoe vaak de figuren praten

Een kind mag zich niet opgejaagd voelen. Daarom:

- Tussen twee meldingen die een figuur uit zichzelf geeft, zit minstens een minuut. Antwoorden op wat je zelf doet (verkeerd voer, te weinig munten) komen wel meteen.
- Een wens moet een halve minuut openstaan voordat een figuur erover begint; iets wat kan wachten (slaapplek, ondergrond, vriendje, soort hek) een minuut. Het wolkje boven het dier is er wel meteen.
- Dezelfde melding komt pas na drie minuten terug; "de gasten vervelen zich" en "iemand vraagt om iets wat je niet verkoopt" na vijf.
- "Er is een jong geboren" en "verhuist naar een andere dierentuin" hoor je hooguit eens in de twee minuten; het hartje en de naam boven het dier zie je elke keer.
- Een dier wordt pas na zes minuten zonder zorg opgehaald (was tweeënhalve minuut); het wolkje kleurt na tweeënhalve minuut oranje.
- Buiten de levels die erom vragen wordt een dier eens in de drie tot vijf minuten ziek en ontsnapt er eens in de vijf tot zeven minuten een.
- Het praatvenster schudt niet meer bij een dringende melding en het rode wolkje pulseert langzaam.

Ook wachten hoort bij rust: vraagt een level om iets te verkopen (bijvoorbeeld vier knuffels), dan krijgen gasten daar drie keer zo snel zin in. Het level met de knuffels duurde bij de proefspeler eerst tot bijna tien minuten, nu drie. En vraagt een level om een ziek of ontsnapt dier, dan hoef je daar hooguit een minuut op te wachten.

Gemeten met `tools/playtest/berichten.js` in een park met 80 dieren zonder verzorgers waar de speler vijf minuten niets doet: eerst 121 berichten, nu 10. (In die meting kost praten geen tijd; in het echte spel waren het er eerst hooguit ongeveer 35.) De getallen staan bovenaan `games/zoo/src/game.ts` (`ALERT_GAP`, `ALERT_AFTER`, `REPEAT_AFTER`, `NEGLECT_WARN`, `NEGLECT_GONE`).

## Gebeurtenissen

- **Personeel (vanaf level 12):** met de knop Personeel zet je een voerder of een schoonmaker neer in het park, buiten de verblijven, net zoals je een dier plaatst. Ze lopen echt door het hele park:
  - de voerder vult voerbakken die bijna leeg zijn;
  - de schoonmaker veegt poep (in de verblijven en op het pad) en raapt afval op.
  - Ze gaan een verblijf alleen in door een **poort**. Poorten kun je vanaf level 12 bouwen (knop Hek, keuze Poort). Kan een werker ergens niet in, dan verschijnt er een poortje boven die plek en zegt de bouwer dat er een poort moet komen.
  - Bij het neerzetten hangt er een doorzichtige werker boven de plek onder je vinger of muis: hij zweeft, trappelt met zijn benen en zwaait met zijn armen. Mag hij daar niet staan (in een verblijf of op iets anders), dan is hij bijna onzichtbaar en is de tegel rood. Tik je, dan ploft hij neer, veert even in en gaat aan het werk.
  - Al het personeel draagt hetzelfde groene pak. De rol zie je aan de pet en de streep (oranje voor de voerder, blauw voor de schoonmaker) en aan wat ze dragen: een voerzak of een bezem.
  - Loon: 2 munten per uur per werker. Een uur in het spel duurt twee minuten; rechtsboven staat een klokje met het uur. Is er op het hele uur te weinig geld, dan wachten de werkers die niets kregen tot het volgende uur en zegt de kassier dat.
  - Een tik op een werker met het handje laat zien wat hij doet en stuurt hem naar huis.
  - **Uitleg:** zodra het personeel erbij komt (en de eerste keer dat je de knop kiest zonder personeel) verschijnt een kaart met vier stappen en plaatjes, en de verzorger zegt hoe het werkt.
  - Uit een ouder opgeslagen spel, waarin werkers nog bij één verblijf hoorden, loopt nu één werker per vijf van die verblijven rond.
- **Ziek (vanaf level 21):** af en toe wordt een dier ziek en gaat liggen. Tik erop en kies de dokter.
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
| Hoedje | Hoedjeskraam (vanaf level 23) | 1 munt, en de gast draagt het hoedje |
| Knuffel | Knuffelkraam (vanaf level 27) | 1 munt |
| Spelen (alleen kinderen) | Speeltuin (vanaf level 10) | veel plezier |
| Naar de fontein kijken | Fontein (vanaf level 16) | plezier, kost de gast niets |
| Een rondje draaimolen (kinderen het vaakst) | Draaimolen (vanaf level 26) | het meeste plezier, kost de gast niets |
| Lievelingsdier zien | Een verblijf met dat dier aan het pad | veel plezier |

Een gast koopt per bezoek hooguit vier dingen.

### Winkels

Gebouwen (wc, restaurant, speeltuin, attracties) zijn 2 bij 2 tegels (sinds 27 november heeft elke attractie en elk speeltoestel zijn eigen maat, zie 'Attracties in allerlei maten' verderop). Een kraam is een marktkraam van 2 tegels breed en 1 tegel diep: vier palen, een schuin gestreept zeil, een tafel met spullen aan de lange voorkant en een doek achterlangs, zonder muren. Achter de tafel staat een verkoper die zwaait als hij iets verkoopt. Een marktkraam gaat bij het neerzetten vanzelf zo staan dat er het meeste pad voor zijn lange kant ligt; met de draaiknop draai je hem een kwartslag (dan staat hij 1 breed en 2 diep). Staat hij er eenmaal, dan draait hij uit zichzelf of via zijn menu alleen nog een halve slag, zodat hij op zijn eigen tegels blijft. In parken van voor deze verandering komt de kraam in de helft van zijn oude blok van 2 bij 2 waar zijn voorkant was. Bankje, bloembak en afvalbak staan op de rand van een tegel, net als een hek: ze nemen geen tegel in, staan langs de rand, een stukje van het pad af en met het gezicht naar het pad. Ze passen niet op een hek, niet tegen een verblijf of gebouw en niet twee op dezelfde rand. Uit een ouder opgeslagen spel verhuizen ze naar de rand van hun tegel die langs het pad ligt. Een tik met het handje draait zo'n ding om (het kijkt dan van het pad af); voor de andere richting zet je het op een andere rand.

Gasten gaan echt op een bankje zitten: twee naast elkaar, benen naar voren, en ze staan weer op als ze uitgerust zijn. Kinderen klimmen in de speeltuin de trap op en glijden twee keer van de glijbaan. In de draaimolen zitten ze op een paardje. Elke winkel heeft een eigen vorm: friet op het dak van de eetkraam, een beker op de drinkkraam, een reuzenijsje op de ijskraam, een tros ballonnen, een strohoed, een beer op de knuffelkraam. Het wc-gebouw heeft twee deuren en de speeltuin een glijbaan.

### Draaien en aan het pad

Een gebouw (kraam, wc, speeltuin, fontein, draaimolen) draait vanzelf met zijn voorkant naar de kant waar het meeste pad ligt, ook als je het pad pas later legt. Bij gelijk spel kijkt het naar het zuiden of oosten, want dan zie je de voorkant. Tik je met het handje op een gebouw, dan staat bovenaan het menu de knop Draaien: elke tik is een kwartslag, en daarna draait dat gebouw niet meer vanzelf. De glijbaan van de speeltuin draait mee.

Staat een gebouw, bankje, bloembak of afvalbak niet aan een pad dat aan de ingang vastzit, dan kunnen gasten er niet bij en werkt het niet. Je ziet dat aan een oranje wolkje erboven met een pad en een rood kruis, en de gastvrouw zegt dat er een pad naartoe moet.

### De grote attracties

Twee dure dingen om voor te sparen. Ze leveren zelf geen munten op; gasten worden er blijer van, en blije gasten kopen meer.

- **Fontein (30 munten, vanaf level 16):** een bassin met een waterstraal die op en neer gaat. Gasten komen ernaast staan kijken.
- **Draaimolen (60 munten, vanaf level 26):** gasten stappen op een paardje en draaien een rondje mee. Leeg staat hij stil (zie 'Attracties bewegen alleen met gasten' onderaan).

Dingen die gebruikt worden bewegen: een kraam veert op als er iets verkocht wordt, de voerbak als een dier eet, de afvalbak als je er iets in gooit. Vlaggen wapperen, bomen en bloemen wuiven, de waterval stroomt en de plompenbladen in de vijver dobberen.

Staat de attractie er nog niet, dan laten gasten in hun wolkje zien dat ze hem willen; ze worden er niet minder blij van. Level 16 en level 26 vragen erom, zodat je moet sparen.

### Wat een kraam verkoopt

Gasten vragen steeds vaker om iets bepaalds; hun wolkje laat zien wat. Tik op een kraam en kies wat hij verkoopt. Er passen maar een paar dingen tegelijk in (twee; drie bij ballonnen en hoedjes, vier bij knuffels), dus voor meer keus zet je er een kraam bij. Verkoopt geen enkele kraam wat de gast vraagt, dan is zijn wolkje oranje en neemt hij de tweede keer iets anders; daar wordt hij minder blij van.

| Kraam | Te koop (en vanaf welk level gasten erom vragen) |
|---|---|
| Eetkraam | Friet (5), pannenkoek (17), hotdog (29) |
| Drinkkraam | Limonade (6), melk (19), sap (33) |
| IJskraam | Schepijs (12), waterijs (20) |
| Suikerspin | Roze suikerspin (37), blauwe suikerspin (43). De gast loopt er daarna mee rond en doet er lang over. |
| Ballonnen | Rood en blauw (22), geel (25), hartjesballon (35). De gast loopt daarna met die ballon rond. |
| Hoedjes | Rood en blauw petje (23), strohoed (27), feestmuts (32), kroon (41). De gast draagt het hoedje daarna. |
| Knuffels | Een knuffel van elke diersoort die in je park woont. Gasten vragen het liefst om hun lievelingsdier. |

### Hoge nood

Moet een gast naar de wc en is er geen wc te bereiken, dan houdt hij het nog een halve minuut vol. Daarna hurkt hij en doet het op het pad: een plas droogt vanzelf op, poep blijft liggen tot je hem wegveegt. Gasten in de buurt vinden dat niet leuk en de gastvrouw vraagt om meer wc's. Met genoeg wc's gebeurt het niet.

Wie iets gekocht heeft, loopt even met afval rond. Staat er een afvalbak in de buurt, dan gaat het daarin; anders valt het op het pad. Afval wegvegen levert 1 munt op. Bloembakken en schone verblijven met blije dieren maken gasten blijer; afval en poep maken ze minder blij. Gasten kopen alleen als ze het naar hun zin hebben.

### Hoe meer gasten, hoe meer kramen

Het aantal gasten groeit mee met het park en het level: hooguit 14 plus het level (dus 18 in level 4 en 60 vanaf level 46), en nooit meer dan het aantal volwassen dieren maal 1,3 plus 2. Op een apparaat dat het niet bijhoudt blijft het bij 45 of 30.

Je ziet de drukte echt:

- **Rijen:** een kraam helpt één gast tegelijk (dat duurt zes tellen), een wc twee (negen tellen), een speeltuin drie, een draaimolen vier. Wie niet meteen aan de beurt is, sluit achteraan aan: de gasten staan achter elkaar langs het pad en schuiven op. Een gast kiest de kraam met de kortste rij.
- **Wachten:** na een kwart minuut wordt het wolkje van een wachtende oranje. Na een halve minuut loopt hij mopperend weg: handen in de zij, een zucht (zonder woorden) en wat minder blij. Staat er al een rij van zes, dan sluit een nieuwe gast niet eens aan.
- **Bankjes:** op een bankje passen er twee. Zijn alle bankjes vol, dan gaat een moe gastje niet in de rij staan maar moppert het meteen en loopt door.
- **De gastvrouw** zegt waar er een bij moet ("Er staat een rij voor de wc. Zet er nog een wc bij!", "Alle bankjes zijn bezet.").

Als vuistregel heb je per 10 gasten een eetkraam en een drinkkraam nodig, per 8 een wc, per 12 een ijskraam, per 14 een speeltuin en per 6 een bankje. Bij 60 gasten zijn dat 6 eetkramen, 6 drinkkramen, 8 wc's, 5 ijskramen, 5 speeltuinen en 10 bankjes. Te weinig wc's geeft vanzelf meer ongelukjes.

## Munten

- De kas gaat nooit hoger dan 99 (twee cijfers). Je begint met 10. Kun je iets niet betalen, dan is het prijskaartje grijs; een kind hoeft dus niet te rekenen.
- Bijna alles levert 1 munt op: een poepje of afval opruimen, een jong dat geboren wordt, een gast die iets koopt. Een gehaald level geeft 5.
- Een voerbak of slaapplek kost 1; een bankje, bloembak of afvalbak 2. Een eetkraam of drinkkraam kost 4, een wc 5, een speeltuin 6, een ijskraam 8, een ballonnenkraam 12, een hoedjeskraam 14, een knuffelkraam 16, een fontein 30, een draaimolen 60. Speelgoed of een plant in een verblijf kost 2. Een voerder of schoonmaker kost 1 munt loon per uur (twee minuten). Hekken en ondergrond zijn gratis.
- Dieren worden per wereld duurder, zodat je moet sparen: boerderij 2 tot 6, savanne 8 tot 28, jungle 14 tot 40, ijs en bergen 15 tot 45, verre landen 16 tot 50. Laat in het spel komen er tientallen munten per minuut binnen; voor twee dure dieren spaar je dan een minuut of twee.
- Weghalen geeft de helft terug (naar beneden afgerond): een kraam met de gum, een dier dat je laat verhuizen. Een jong dat in het park geboren is, levert 1 munt op.
- Een blij paar krijgt om de anderhalve minuut een jong. Zijn er al twee jongen, dan verhuist de oudste naar een andere dierentuin en krijg je 2 munten.
- Terugverdienen: heeft het park net veel uitgegeven, dan krijgen gasten wat sneller trek. Zo is een aankoop binnen een paar minuten terugverdiend, zolang de gasten tevreden zijn.

## De knoppenbalk in groepjes

De knoppen onderaan staan in vier vakken, elk met een eigen lichte kleur en een randje, met wat ruimte ertussen. Zo zie je wat bij elkaar hoort, ook als je niet kunt lezen.

| Vak | Kleur | Knoppen |
|---|---|---|
| Doen | Wit | Hand, Actie (veger, hamer, prikker), Weg |
| Grond | Groen | Grond, Hek |
| Dieren | Oranje | Dier, Voerbak, Slaapplek, Speelgoed |
| Dierentuin | Blauw | Winkel, Mooi, Personeel |

Knoppen die er in een level nog niet zijn, staan er niet; een vak zonder knoppen ook niet. Hoe meer knoppen, hoe smaller ze worden, zodat alles op één rij blijft. De volgorde staat bovenaan `games/zoo/src/game.ts` (`TOOL_GROUPS`).

## Terug naar het handje

Na het neerzetten van een voerbak, slaapplek, winkel of dier staat het handje weer aan. Zo koopt een volgende tik niet per ongeluk nog iets. De rij met dieren, winkels of slaapplekken blijft wel open staan, met de laatste keuze omlijnd: een tik op een dier in die rij zet de knop weer aan, een tik op het handje sluit de rij. Hek, ondergrond (ook pad) en de gum blijven aan staan: daar veeg je mee. Lukt het neerzetten niet (verkeerde plek, te weinig munten), dan blijft de knop aan.

## De actieknop: veger, hamer en prikker

Naast het handje staat de actieknop. In level 2 tot en met 5 is dat alleen de veger. Zodra er afval komt (level 6) en hekken gaan slijten (level 8), heet de knop Actie en kies je in de rij erboven uit drie dingen:

| Keuze | Wat je ermee doet |
|---|---|
| Veger | Poep wegvegen. Alle poepjes krijgen een gele ring; je veegt alles weg waar je overheen sleept. |
| Hamer | Een versleten hek vasttimmeren. Alle versleten hekken krijgen een ring. |
| Prikker | Afval prikken. Al het afval krijgt een ring; heb je iets bij je, dan lichten de afvalbakken op. Een tik op een afvalbak gooit het weg. |

Op de knop zelf staat het plaatje van wat je gekozen hebt. Vegen, timmeren en prikken kan alleen hiermee. Tik je met het handje (of met het verkeerde gereedschap) op poep, afval of een versleten hek, dan gebeurt er niets, behalve dat het goede plaatje erboven verschijnt, dat gereedschap alvast gekozen wordt en de actieknop een paar tellen knippert. Met de actieknop aan sleep je het veld net als met het handje; begin je op iets waar je gereedschap bij hoort, dan ga je aan het werk. Wat onder de muis ligt, krijgt een grotere oranje ring. Vraagt een level om opruimen, dan knippert de knop als tip.

Een poepje valt nooit onder een slaapplek of voerbak: het komt op de vrije tegel ernaast terecht. Zet je een slaapplek of voerbak op een tegel waar al poep ligt, dan schuift die ernaast.

## Het park (de knop Park)

Vanaf level 6 is er de knop Park (eerst heette die Mooi): dingen op een vrije tegel buiten de verblijven, in drie groepen. Je begint met een boom, rozen en een kei. Bijna elk level speel je er iets bij vrij; op de kaart na een gehaald level zie je het al staan naast het nieuwe dier, en in de balk staat er een sterretje op tot je het gekozen hebt.

| Groep | Wat (prijs, vrij vanaf level) |
|---|---|
| Groen | Boom (4, 6), rozen (3, 6), heg (3, 7), tulpen (3, 8), den (4, 9), paddenstoelen (2, 10), cactus (4, 13), zonnebloemen (3, 14), palm (6, 18), pompoenen (3, 20), bamboe (5, 22), bloesemboom (8, 28) |
| Water | Vijver (10, 11), waterput (8, 17), vogelbadje (6, 23), waterval (15, 27), waterpomp (8, 35) |
| Sier | Kei (2, 6), vlag (5, 12), lantaarn (5, 15), vogelverschrikker (6, 19), snoeiboom (12, 24), bloemenboog (10, 25), totempaal (10, 30), sneeuwpop (6, 32), kampvuur (8, 34), molentje (18, 37), beeld (20, 39), klok (25, 42) |

Gasten die binnen twee tegels lopen, worden er een beetje blijer van (tot drie dingen tellen mee). Weghalen met de gum geeft de helft terug. Het molentje draait, het kampvuur flakkert, bomen en bloemen wuiven. Wat al in een opgeslagen park staat, blijft staan, ook als het nu pas later vrijkomt. De lijst staat in `games/zoo/src/data.ts` (`DECOR`).

## Speeltoestellen

Naast de speeltuin (level 10) zijn er vijf losse toestellen van 2 bij 2 tegels. Ze staan bij de winkels en moeten aan het pad staan. Een kind dat wil spelen kiest zelf het toestel met de kortste rij.

| Toestel | Prijs | Vanaf level | Tegelijk | Wat je ziet |
|---|---|---|---|---|
| Glijbaan | 5 | 13 | 2 | De trap op en naar beneden glijden, om de beurt |
| Schommel | 6 | 17 | 2 | Twee zitjes die heen en weer gaan |
| Wipwap | 6 | 20 | 2 | De plank wipt, aan elke kant een kind |
| Wipkip | 5 | 24 | 2 | Twee kippen op een veer die hobbelen |
| Trampoline | 8 | 29 | 2 | Springen met de armen omhoog |
| Klimkasteel | 20 | 27 | 10 | Een heel parcours over vier torentjes, en de glijbaan af (zie 'Het klimkasteel') |

Zit er niemand op, dan wiegt het toestel zachtjes; met een kind erop gaat het flink heen en weer. Twee kinderen zitten nooit op hetzelfde zitje. Alle speeltoestellen tellen samen als plek om te spelen (de gastvrouw vraagt pas om meer als het bij allemaal te druk is).

## Afval prikken

Vanaf level 6, zodra er een eetkraam is, laten gasten afval vallen als er geen afvalbak binnen anderhalve tegel staat (hooguit acht stuks tegelijk in het park). Afvalbakken zijn er daarom ook al vanaf level 6. Het afval is er in vier soorten, groot en kleurig genoeg om op te vallen: een beker met rietje, een frietzak, een bananenschil en een blikje. Kies bij de actieknop de prikker en tik erop (of sleep eroverheen) om het op te prikken: je hebt het dan bij je (links in beeld zie je hoeveel, hooguit vijf). Tik daarna op een afvalbak om het weg te gooien; dat levert een munt per stuk op en telt voor de opdrachten. Een schoonmaker raapt het ook op.

## Dier in nood

Is er een dier ontsnapt, ziek, of heeft het al twintig tellen honger, een vies hok of een open hek, dan verschijnt onderin het midden, net boven de knoppen, een alarmbubbel met dat dier en wat het mist. Elke diersoort staat er maar één keer in: je ziet het dier van die soort dat het hardst hulp nodig heeft, en is dat geholpen, dan komt het volgende vanzelf. Er staan er tot vijf naast elkaar; zijn het er meer, dan schuif je het rijtje opzij. Een tik op een bubbel schuift het beeld naar dat dier en zet er acht tellen een oranje ring omheen. De dringendste staat links: ontsnapt, dan ziek, dan wie het langst wacht.

## Cursor

Elke handeling heeft een eigen cursorplaatje; die zijn anderhalf keer zo groot als een gewone cursor (48 beeldpunten).

## Hekken slijten

Vanaf level 8 slijt een houten hek (stenen muren en netten niet; sinds 27 november slijt elk soort hek en maak je een los of kapot hek met een spelletje, zie 'Hekken maken met een spelletje' verderop). Ongeveer eens per minuut gaat er één hek een fase verder, meestal een hek dat al versleten is, en er zijn er nooit meer dan vier tegelijk:

1. De bovenste plank zakt scheef en het hout wordt donkerder.
2. De plank hangt aan één kant los; nog donkerder.
3. Het hek ligt half plat en is bijna zwartbruin: het is kapot.

Kies bij de actieknop de hamer; een tik op het hek timmert het in elke fase weer vast. Bij een kapot hek voelen de dieren in dat verblijf zich niet veilig: ze zijn niet blij, het wolkje toont een hamertje en de bouwer zegt dat je het moet maken. Ze worden er niet voor opgehaald.

## Het aquarium

Na level 20 komt er een zesde afdeling bij de knop Dier: het aquarium, met de **dolfijn** (45 munten, na level 20) en de **orka** (60 munten, na level 35). Het zijn geen beloningen van een level; ze komen erbij, en staan op de kaart na het level naast het nieuwe dier. De directeur legt het uit: "Bouw een bak van glas, vul hem met water en zet er een dolfijn in."

- **Glas:** een vijfde soort hek (bij Hek, zodra je een zeedier hebt). Het is een lijst met een doorzichtige ruit, zodat je de dieren ziet zwemmen. De lijst kun je net als elk hek een kleur geven (tien kleuren).
- **Water in de bak:** in een verblijf dat rondom van glas is, staat het water op elke watertegel hoog (een doorzichtig blok). Dieren zwemmen daar in het water, met hun rug en rugvin er net boven. Dat geldt ook voor zeehonden, otters of pinguïns die je in een glazen bak zet.
- **Zeedieren** leven alleen in water: ze zwemmen nooit over een droge tegel, ontsnappen niet en willen een bak van glas, vis, en koraal om bij te rusten (een nieuwe slaapplek). De dolfijn wil met zijn drieën zijn en negen tegels; de orka twaalf tegels.
- **Hoepel:** nieuw speelgoed, het lievelingsding van de dolfijn. Hij springt er in een boog doorheen naar de andere kant, met spatters bij het opduiken en neerkomen. De orka speelt met de bal.
- **Aantikken:** tik met het handje op speelgoed in een verblijf (ook de bal, de boomstam of de struik bij andere dieren) en een dier komt eraan en gaat ermee spelen; bij de hoepel springt het erdoor.

De getallen staan in `games/zoo/src/data.ts` (`BONUS`, `AQUATIC`, `TANK_WATER`). De modellen komen uit `tools/animals/packs/50_sea.py`.

## Dag en nacht

Vanaf level 15 wordt het ook nacht. Een dag (7 tot 21 uur) duurt zeven en een halve minuut (tot 27 november tien: de nacht kwam te weinig langs) en een nacht bijna vier minuten, met twintig tellen schemering ertussen. De nacht bestaat uit drie stukken (`NIGHT_PARTS`): de avond van 21 tot 24 uur (anderhalve minuut, het park is nog open), de slaapnacht van 0 tot 5 uur (anderhalve minuut) en de vroege ochtend van 5 tot 7 uur (40 tellen). Elke keer dat je het spel opent, begint het overdag. Rechtsboven staat een zon of een maan met het uur (de dag loopt van 7 tot 21 uur).

- **Donker:** 's nachts ligt er een donkerblauw waas over het park. Alleen bij licht zie je alles goed: rond een lantaarn (3,5 tegel), een kampvuur (3), elke winkel en elk speeltoestel (2,4) en de ingang (4,5). De lantaarns branden dan fel.
- **Gasten:** staat een gast in het donker naar dieren te kijken, dan heeft hij er maar een kwart van het plezier van en ziet hij zijn lievelingsdier niet. Boven zijn hoofd staat een oranje wolkje met een lantaarn. Zijn er meer gasten in het donker, dan zegt de gastvrouw: "Het is te donker! Zet er lantaarns bij."
- **Dieren:** de meeste dieren gaan liggen slapen; wie honger heeft, eet eerst. Van 0 tot 5 uur slaapt elk dier en komt er geen honger en geen poep bij.
- **Iedereen naar huis:** vanaf 22 uur lopen de gasten naar de poort; er komt dan ook geen klas of ander evenement meer, en een klas of feestje dat er nog is, gaat mee naar huis. Vanaf half twaalf gaat het personeel: elke werker maakt zijn klus af, loopt naar de poort en is dan weg (niet allemaal tegelijk). De verkopers zakken dan achter hun toonbank weg. Rond half één is het park leeg, en dat blijft zo tot 5 uur: ruim een minuut zie je alleen slapende dieren en lampen. Om 5 uur komt het personeel een voor een weer binnen door de poort, om half zeven staan de verkopers er weer en om 7 uur komen de gasten. Wie thuis is, krijgt dat uur geen loon en kun je niet aantikken.
- **Uitleg:** de eerste nacht zegt de directeur: "Het wordt donker! Zet lantaarns in je park, dan kunnen de gasten de dieren blijven zien." De lantaarn (5 munten, bij Park onder Licht) komt in hetzelfde level vrij.
- **Geluid:** 's nachts hoor je krekels en af en toe een uil.

De getallen staan in `games/zoo/src/data.ts` (`DAY_SECONDS`, `NIGHT_PARTS`, `GUESTS_HOME`, `STAFF_HOME`, `STAFF_BACK`, `VENDORS_BACK`, `LIGHT`, `DARK_FUN`). Het donker is een vlak dat over het beeld wordt getekend met een zacht gat bij elk licht; dat kost weinig rekenkracht.

## Het park uitbreiden

Het park begint als een veld van 28 bij 28 tegels. Links, rechts en achter ligt een strook van 8 tegels breed die te koop is: je ziet er een licht vlak over de grond, een bordje met een vlag en een kaartje met de prijs. Een strook kost 75 munten (de kas gaat tot 99, dus daar spaar je echt voor). Tik op de strook of op het kaartje en kies Kopen; heb je te weinig, dan is de prijs grijs.

Na het kopen licht de nieuwe grond op, schuift het beeld ernaartoe en zegt de bouwer: "Het park is groter geworden! Hier kun je weer bouwen." De bomen die er stonden zijn weg en je kunt er alles bouwen. Wat er al stond, blijft staan; een verblijf tegen de oude rand blijft een verblijf. Met alle drie de stroken is het park 44 bij 36 tegels, ruim twee keer zo groot. De stroken worden bewaard met het spel, en een ouder opgeslagen park komt vanzelf midden tegen de voorkant te liggen.

De maten staan in `games/zoo/src/grid.ts` (`BASE_W`, `BASE_H`, `PLOT`), de prijs in `data.ts` (`LAND_PRICE`).

## Twaalf soorten grond en dieren die een mix willen

Er zijn vijf soorten grond bijgekomen: rots, ijs, moeras, bloemenwei en droog gras (naast gras, modder, zand, water, sneeuw, bos en pad). Je krijgt een soort in de rij bij Grond zodra je een dier hebt dat hem wil.

Veel dieren willen een mix: hun eigen grond, en daarnaast een stukje (minstens twee tegels) van een of twee andere soorten. Van wat overblijft moet minstens de helft de eigen grond zijn. Op de boerderij blijft het eenvoudig: alleen de eend wil naast water ook gras.

| Wereld | Wie wil wat erbij |
|---|---|
| Savanne | Zebra, giraffe, cheeta, gazelle: droog gras. Leeuw: droog gras en rots. Kameel: rots. Neushoorn: droog gras en water. Nijlpaard: modder en gras. Olifant: modder en water. |
| Jungle | Tijger: water. Gorilla en panda: gras. Krokodil: moeras en zand. Pauw: bloemenwei. Panter: rots. |
| IJs en bergen | Pinguïn, ijsbeer, walrus: ijs en water. Zeehond: ijs en rots. Rendier: gras. Wolf: bos en rots. Poolvos en jak: rots. Beer: rots en water. |
| Verre landen | Flamingo: moeras en zand. Schildpad: water en gras. Otter: gras en rots. Bever: bos en modder. Pelikaan en maki: zand. Rode panda: rots. Bizon: droog gras en modder. Kangoeroe: droog gras en gras. |

Ontbreekt er iets, dan toont het wolkje boven het dier precies die grond, en de verzorger noemt de hele mix ("De leeuw wil zand met een stukje droog gras en rotsgrond in het verblijf."). Tik je op het dier, dan staat elk stukje van de mix apart, groen of rood. Klopt de eigen grond en ontbreekt alleen nog een stukje van de mix, dan is het dier niet blij, maar het wordt er nooit voor opgehaald. In een bestaand opgeslagen park zijn daardoor veel dieren eerst niet blij, tot je de stukjes erbij legt. De lijst staat in `games/zoo/src/data.ts` (`ALSO`, `MIX_TILES`).

## Drie voerbakken

| Voerbak | Prijs | Porties | Vanaf level | Hoe hij eruitziet |
|---|---|---|---|---|
| Houten bak | 1 | 4 | 1 | De gewone bak |
| Grote bak | 4 | 8 | 7 | Van steen, breder en dieper, met twee rijen voer |
| Voersilo | 10 | 16 | 17 | Een ronde toren met een rood dak en een bakje ervoor |

Hoe groter de bak, hoe minder vaak je hoeft te vullen. Zodra de grote bak er is, kies je de soort in de rij boven de knop Voerbak. Tik je op een grote bak of silo, dan staat er een getal bij het voer (zoveel porties zitten er nog in). Weghalen geeft de helft terug. De getallen staan in `games/zoo/src/data.ts` (`TROUGH`).

## De klusser

Bij Personeel is er een derde werker: de klusser (rode pet en streep, hamer in de hand, 2 munten per uur, vanaf level 12). Hij loopt naar elk versleten houten hek en timmert het vast. Hij hoeft het verblijf niet in: hij gaat naast het hek staan aan de kant waar hij bij kan. Twee klussers gaan nooit naar hetzelfde hek.

## Hekken in een kleur

Tik met het handje op een verblijf en kies Kleur (de kwast): je krijgt tien kleuren die bij dat soort hek horen. Hout: gewoon, wit, rood, blauw, groen, geel, roze, paars, oranje en donkerbruin. Steen: grijs, zand, baksteen, wit, donkergrijs, mosgroen, blauwgrijs, roze, geel en bruin. Net: groen, zwart, wit, blauw, rood, geel, oranje, paars, roze en zilver. Het hele hek van dat verblijf krijgt de kleur, ook de poort; een hek tussen twee verblijven krijgt de kleur van het laatste. De kleur wordt bewaard met het spel. Versleten hout blijft zichtbaar donkerder.

Bij het allereerste verblijf zegt de bouwer het erbij: "Tik op het hok en kies een kleur voor het hek!" De kleuren staan in `games/zoo/src/data.ts` (`FENCE_COLORS`).

## Hekken slepen

Een hek teken je door te slepen. De eerste beweging (een derde tegel) bepaalt de richting; daarna blijft het hek op die ene lijn van het raster, ook als de vinger zwabbert. Pas als je driekwart tegel opzij gaat, maakt het hek op het dichtstbijzijnde kruispunt een hoek en loopt het haaks verder. Zo teken je een heel verblijf in één beweging. Een heel kort veegje telt als een tik op die rand. De getallen staan bovenaan `games/zoo/src/game.ts` (`AXIS_AFTER`, `TURN_AFTER`, `EDGE_REACH`).

## Wat je kunt aantikken

| Onderdeel | Zit erin |
|---|---|
| Dier | Aaien (je hoort het dier), uit de hand voeren, andere naam, laten slapen, verzetten, weg (het dier verhuist naar een andere dierentuin, na een ja of nee), dokter (als het ziek is); je ziet welke wensen vervuld zijn |
| Gum op een dier | Dezelfde vraag: mag dit dier verhuizen? |
| Ontsnapt dier | Eén tik pakt het op, een tweede tik zet het in een verblijf |
| Verblijf | Je ziet de naam. Kleur van het hek, andere naam, voerder en schoonmaker aannemen of naar huis sturen, leegmaken (met bevestiging) |
| Voerbak | Vullen met een voersoort; het voer staat altijd in dezelfde volgorde en wat de dieren daar lusten is geel; je ziet hoeveel erin zit |
| Gast | Zien hoe het gaat, wat zijn lievelingsdier is en wat hij nu wil; zwaaien |
| Poep, afval en versleten hekken | Alleen met de actieknop (veger, prikker, hamer); een tik met iets anders kiest het goede gereedschap en wijst de knop aan |

## Levels

Elk level speelt een dier vrij en vraagt om blije dieren van de soort die je net kreeg. Hoeveel dat er zijn wisselt (twee tot vijf, groepsdieren met meer), en vanaf de alpaca komen er andere doelen tussendoor: twee vriendjes samen blij in één verblijf, een jong bij een bepaalde soort, een aantal soorten speelgoed in je verblijven, of een aantal blije dieren uit één wereld. De rest loopt per wereld op.

| Level | Doelen | Je krijgt |
|---|---|---|
| 1 | Verblijf, voerbak | Varken |
| 2 | 2 varkens, slaapplek, 1 keer voeren, 2 blije varkens | Koe |
| 3 | 2 koeien, 2 blije koeien, 3 poepjes | Schaap |
| 4 | 6 tegels pad, 3 blije schapen, 3 blije gasten | Paard |
| 5 | Eetkraam, 2 blije paarden, 8 munten | Ezel |
| 6 | Drinkkraam, 2 blije ezels, 5 blije gasten | Geit |
| 7 | 3 blije geiten, 1 jong, 12 munten | Alpaca |
| 8 | Wc, alpaca en geit samen blij in één verblijf, 6 blije gasten | Kip |
| 9 | 5 blije kippen, 2 bankjes, 5 poepjes | Eend |
| 10 | 4 blije eenden, 3 soorten blij, glijbaan | Konijn |
| 11 | 4 blije konijnen, 2 jonge konijnen, 8 blije gasten | Zebra |
| 12 | 3 blije zebra's, ijskraam, 18 munten | Giraf |
| 13 | Giraf en zebra samen blij in één verblijf, 1 werker, 9 blije gasten | Leeuw |
| 14 | 2 blije leeuwen, 4 soorten blij, 3 keer schepijs verkopen | Kameel |
| 15 | 2 blije kamelen, 3 bloembakken, 10 blije dieren van de boerderij | Neushoorn |
| 16 | 2 blije neushoorns, fontein, 12 blije dieren | Nijlpaard |
| 17 | 2 blije nijlpaarden, 4 soorten speelgoed in je verblijven, 3 pannenkoeken verkopen | Olifant |
| 18 | 2 blije olifanten, 2 afvalbakken, 12 blije gasten | Struisvogel |
| 19 | 3 blije struisvogels, 4 keer afval, 3 jongen | Cheeta |
| 20 | 2 blije cheeta's, 6 soorten blij, 13 blije gasten, 4 keer waterijs verkopen | Gazelle |
| 21 | 4 blije gazellen, 1 ziek dier beter, 12 blije dieren van de savanne | Aap |
| 22 | 4 blije apen, ballonnenkraam, 14 blije gasten | Papegaai |
| 23 | 3 blije papegaaien, 2 zieke dieren beter, hoedjeskraam | Tijger |
| 24 | 2 blije tijgers, 3 werkers, 6 soorten speelgoed in je verblijven | Gorilla |
| 25 | 2 blije gorilla's, 15 blije gasten, 4 hoedjes verkopen | Krokodil |
| 26 | 2 blije krokodillen, draaimolen, 6 keer afval | Panda |
| 27 | 2 blije panda's, 1 jonge panda, knuffelkraam | Pauw |
| 28 | 2 blije pauwen, 4 werkers, 2 zieke dieren beter | Toekan |
| 29 | 3 blije toekans, 8 soorten blij, 4 knuffels verkopen | Luiaard |
| 30 | 2 blije luiaards, 14 blije dieren uit de jungle, 18 blije dieren, 30 munten | Panter |
| 31 | 2 blije panters, 1 dier gevangen, 16 blije gasten | Pinguïn |
| 32 | 5 blije pinguïns, 2 zieke dieren beter, 18 blije dieren | Zeehond |
| 33 | 2 blije zeehonden, 2 dieren gevangen, 30 munten | IJsbeer |
| 34 | 2 blije ijsberen, 9 soorten blij, 17 blije gasten | Rendier |
| 35 | 3 blije rendieren, 1 jong rendier, 8 keer afval | Wolf |
| 36 | 3 blije wolven, 6 werkers, 20 blije dieren | Poolvos |
| 37 | 2 blije poolvossen, zweefmolen, 3 zieke dieren beter, 18 blije gasten | Beer |
| 38 | 2 blije beren, 8 soorten speelgoed in je verblijven, 8 gasten in de zweefmolen, 4 roze suikerspinnen verkopen | Jak |
| 39 | Jak en rendier samen blij in één verblijf, schommelschip, 5 jongen, 22 blije dieren | Sneeuwuil |
| 40 | 2 blije sneeuwuilen, 8 gasten in het schommelschip, 20 blije gasten, 16 blije dieren van ijs en bergen | Walrus |
| 41 | 2 blije walrussen, luchtballon, 10 soorten blij, 20 blije gasten | Flamingo |
| 42 | 5 blije flamingo's, 8 gasten in de luchtballon, 5 jongen, 3 dieren gevangen | Schildpad |
| 43 | 2 blije schildpadden, wildwaterbaan, 24 blije dieren, 10 keer precies verkopen wat een gast vraagt | Otter |
| 44 | 3 blije otters, 10 gasten in de wildwaterbaan, 8 werkers, 4 zieke dieren beter | Bever |
| 45 | 2 blije bevers, safaritrein, 11 soorten blij, 21 blije gasten | Pelikaan |
| 46 | Pelikaan en flamingo samen blij in één verblijf, 8 gasten in de safaritrein, 6 jongen, 10 keer afval | Koala |
| 47 | 2 blije koala's, 3 stukken glazen tunnel, 26 blije dieren, 15 keer precies verkopen wat een gast vraagt | Rode panda |
| 48 | 2 blije rode panda's, 1 jonge rode panda, 12 soorten blij, 22 blije gasten | Maki |
| 49 | 4 blije maki's, achtbaan, 6 jongen, 28 blije dieren | Bizon |
| 50 | 3 blije bizons, 12 gasten in de achtbaan, 12 soorten blij, 22 blije gasten, 30 blije dieren | Kangoeroe |

'Soorten blij' betekent: zoveel soorten waarvan er minstens twee blij zijn. 'Samen blij in één verblijf' gaat altijd om twee soorten die vriendjes zijn (`PALS`): van elk minstens één blij dier in hetzelfde verblijf. 'Soorten speelgoed' telt de verschillende dingen die in een verblijf met dieren staan. 'Dieren van de boerderij' (of een andere wereld) telt alle blije dieren van de soorten die je in die wereld kreeg. Na level 50 is het vrij spelen. De tabel staat in `games/zoo/src/data.ts` (`LEVELS`), het tellen in `levels.ts`.

## Stem en geluid

- `tools/voice/build.mjs` maakt alles met ElevenLabs. De zinnen komen uit het spel zelf (`games/zoo/src/lines.ts`), zodat tekst en stem nooit uit elkaar lopen. Wat al gemaakt is, wordt overgeslagen.
- De sleutel staat alleen lokaal in `.env` en komt nooit in de repo.
- Stemmen (Nederlands): directeur YME, verzorger Roos, bouwer Eric, gastvrouw Emma, kassier Marti. Andere stem kiezen: `tools/voice/voices.json` aanpassen en het script opnieuw draaien.
- Geluiden: `tools/voice/sounds.json` (effecten, vijftig dierengeluiden, vijf achtergronden).
- Het mondje van een figuur beweegt mee met het geluid. Zonder geluid praat het op een klokje.
- Beluisteren: `figuren.html`.

## De naam van de speler

Bij een nieuw spel vraagt het spel: hoe heet je? Een ouder typt de naam (overslaan kan). De figuren noemen die naam daarna alleen op bijzondere momenten: één begroeting bij het begin, een compliment bij elk gehaald level, en bij nood ("Help, Bram! Er is een dier ontsnapt."), hooguit eens in de drie minuten. Daarnaast begint een gewone melding af en toe met de naam ("Senna, de gasten hebben honger."): ongeveer één op de drie keer en hooguit eens per veertig seconden. Daarvoor is van elk figuur een losse opname van de naam gemaakt, die vóór de zin wordt afgespeeld.

De opname van de naam komt uit een van deze vier bronnen:

1. De naam staat in het lijstje van ruim 140 veelvoorkomende namen (ook Senna, Maxime, Loua, Faas en Joep) die al zijn ingesproken (`tools/voice/names.json`). Een naam toevoegen: `node tools/voice/build.mjs names --add Sepp`, daarna committen.
2. De naam is eerder op dit apparaat ingesproken en bewaard.
3. In het oudermenu staat een eigen ElevenLabs-sleutel: dan spreekt het spel elke nieuwe naam ter plekke in en bewaart die op het apparaat. De sleutel blijft in de browser van dat apparaat en zit nooit in het spel of in de repo.

4. Er is een servertje aangezet (`tools/name-proxy`, een Cloudflare Worker): dat bewaart de ElevenLabs-sleutel als geheim en spreekt alleen de vaste zinnen met een naam in. Het adres staat in `games/zoo/public/config.json`; zolang dat leeg is, doet het spel dit niet. Zo werkt elke naam op de live site zonder dat de sleutel openbaar wordt. Aanzetten staat in `tools/name-proxy/README.md`.

Is er geen opname, dan staat de naam alleen in beeld en klinken de gewone complimenten.

Complimenten bij een gehaald level wisselen: acht stuks, van vijf figuren, elk in een eigen stijl ("Hoppa! Weer een level gehaald.", "Kassa! Dat heb je knap gedaan.").

## Geluid op de achtergrond

- **Muziek:** tien rustige nummers in dezelfde stijl (marimba, gitaar, klokkenspel), zacht onder alles door. Ze spelen na elkaar, steeds in een andere volgorde, met een korte stilte ertussen; ze horen niet meer bij een wereld.
- **Natuur:** overal dezelfde zachte achtergrond (vogels, zoals op de boerderij), met daaronder altijd een zacht briesje. De lucht, het gras en het achtergrondgeluid wisselen niet meer per wereld.
- **Luisteren naar wat in beeld is:** dieren en gasten hoor je alleen goed als ze in het midden van je beeld zijn; naar de rand toe klinken ze zachter, buiten beeld hoor je ze niet, en links in beeld klinkt links. Zoom je in op een verblijf, dan hoor je die dieren vaker en helder, met de gasten die erbij staan. Zoom je uit, dan hoor je meer tegelijk, maar doffer en zachter, alsof het van ver komt (`listen` en `heard` in `audio.ts`). Stemmen, knoppen en muziek veranderen niet.
- **Geen woorden:** alle geluiden van gasten zijn woordloos (lachen, giechelen, 'ooh', neuriën), zodat er in het Nederlandse spel geen Engels te horen is. Alleen de vijf figuren praten.
- **Publiek:** zacht geroezemoes dat meegroeit met het aantal gasten. Er zijn van elk drie opnames, die om de één à anderhalve minuut wisselen. Daaroverheen af en toe een los geluidje: 24 soorten kinderstemmetjes (giechelen, 'wauw', neuriën) en 8 van volwassenen; kinderen hoor je het vaakst.
- **Wc en poep:** bij de wc hoor je af en toe iemand plassen of poepen achter de deur, en daarna het doortrekken (drie opnames van elk). Bij de dieren hoor je af en toe een plofje of een straaltje: bij de helft van de poepjes en een kwart van de plasjes, en nooit vlak achter elkaar.
- **Dieren en mensen:** elk dierengeluid heeft drie varianten en klinkt nooit twee keer hetzelfde achter elkaar; alles behalve de stemmen van de figuren staat zacht. Jonge dieren hebben een eigen geluid (twee opnames per soort: een big, een kuiken, een welp).

## Wat er bewaard wordt

Het hele park: grond, hekken, verblijven, dieren, voerbakken, slaapplekken, winkels met hun assortiment, poep en afval, munten, de stand van de levels en de naam van de speler. Ook de gasten: waar ze lopen, hoe blij ze zijn, hoe lang ze er al zijn, en het hoedje of de ballon die ze kochten. Open je het spel opnieuw, dan lopen ze weer rond waar ze waren (een kind blijft een kind; de kleur van de kleren is nieuw).

## Een opgeslagen spel wissen

Op het startscherm staat bij elk opgeslagen spel een prullenbakje. Een gewone tik wist niets en laat alleen de tip "Houd vast om te wissen" zien; ruim een tel vasthouden wist het spel. Wissen kan ook in het oudermenu.

## Voor ouders

Op het startscherm staat rechtsonder een knop die je drie tellen vasthoudt. Daarachter: per opslagplek de naam van de speler, bewaren in een bestand, terugzetten uit een bestand en wissen (de knop wordt rood en vraagt "Echt wissen?"; een tweede tik wist); een eigen ElevenLabs-sleutel voor namen die het spel nog niet kent; en de taal (Nederlands of Engels).

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

## Wat de proefspeler liet zien (16 november 2026)

De proefspeler bouwt zonder muis en zonder na te denken, dus de tijden zeggen niets over hoe lang een kind erover doet. Ze laten wel zien of een level haalbaar is en of het zorgen bij te houden is.

| Proef | Uitkomst |
|---|---|
| Snel en foutloos, kas wordt bijgevuld als hij leeg is | Alle 50 levels gehaald, geen dier kwijt, de kas 3 keer bijgevuld |
| Als een kind: één handeling per 8 seconden, kas nooit bijgevuld, neemt verzorgers aan zodra het kan | Alle 50 levels gehaald, geen dier kwijt |
| Als een trager kind: één handeling per 15 seconden, verder hetzelfde | Alle 50 levels gehaald, geen dier kwijt |
| Als een kind dat alleen verzorgers aanneemt als een level erom vraagt | Goed tot en met level 24, daarna dieren kwijt en vast in level 26 |

Op 17 november 2026 zijn de prijzen omhooggegaan (zie Munten). De proefspeler-als-kind (één handeling per 8 seconden, kas nooit bijgevuld) haalde daarna opnieuw alle 50 levels zonder een dier kwijt te raken. Tot en met level 19 houdt hij na een level 11 tot 40 munten over; daarna loopt de kas tijdens de meeste levels vol tot 99, omdat hij alleen koopt wat een level vraagt. Laat in het spel is geld dus nog steeds ruim. Met de regels voor ruimte, groepen, lievelingsdingen en drukte (21 november 2026) haalde de proefspeler opnieuw alle 50 levels zonder een dier kwijt te raken; aan het eind stonden er 50 gasten, 6 eetkramen, 6 drinkkramen, 8 wc's, 5 ijskramen, 5 speeltuinen en 10 bankjes. Met personeel dat rondloopt, poorten en slijtende hekken (de proefspeler timmert een hek vast vanaf fase 2) lukte het ook: alle 50 levels, geen dier kwijt, 10 werkers en 24 poorten. Sinds de werkers loon kosten (21 november 2026) gaat er in een vol park met 40 werkers 20 munten per minuut naar loon; de proefspeler haalde ook daarmee alle 50 levels en eindigde de levels met 27 tot 99 munten. Daarna zijn de fontein en de draaimolen erbij gekomen; ook daarmee haalde hij alle 50 levels zonder een dier kwijt te raken (level 16 duurde door het sparen bijna twee keer zo lang).

De eerste versie van het zorgtempo was te zwaar: daarmee raakte de proefspeler-als-kind vanaf level 14 honderden dieren kwijt. Daarom eten en poepen dieren nu minder vaak en zijn verzorgers al vanaf level 13 te huur.

## De grote ronde van 21 november 2026 (41 ideeën uit de lijst)

Alles hieronder staat in `games/zoo/src`; de vaste getallen in `data.ts`. De volledige lijst van bewegingen staat in `docs/ANIMATIES.md`, de ideeën die zijn blijven liggen in `docs/IDEEEN.md`.

### Veel meer gasten
- **Tekenen:** de gasten staan niet meer los in het beeld. `Crowd` (in `people.ts`) tekent alle blokjes van dezelfde vorm in één keer; voor alle gasten samen zijn dat nog maar een stuk of vijftien tekenopdrachten in plaats van acht per gast.
- **Aantal:** `guestsAt` laat het park groeien tot 160 gasten (90 of 45 op een apparaat dat het niet bijhoudt). Ze komen sneller na elkaar binnen naarmate het park er meer trekt.
- **Drukte:** boven de 20 gasten telt elke gast maar voor een derde mee bij honger, dorst en drukte bij de kramen (`crowdLoad`, `ease`). Zo heb je ongeveer evenveel kramen nodig als vroeger, toen er hooguit 60 gasten kwamen, en loopt de kas niet over.
- Wolkjes boven gasten buiten beeld worden niet meer bijgewerkt.

### Gasten
- **Groepjes:** een gast kan achter een leider aan lopen (`Leader`, `join`, `follow`). Zo werken de schoolklas (juf met vijf tot zeven kinderen, 3 munten entree), de verjaardag (naar een speeltoestel; daar slingers en taart, 3 munten), de rondleiding van de gids en het kind dat weer bij papa of mama loopt.
- **Bijzondere gasten** komen om de paar minuten, steeds een andere: schoolklas (vanaf level 13), verjaardag (15), beroemde gast (16; is hij blij weggegaan, dan komen er drie minuten een kwart meer gasten), verdwaald kind (19; tik erop, 3 munten).
- **Rolstoel en kinderwagen** (vanaf level 9, ongeveer één op de zestien gasten): ze lopen langzamer en willen een pad van twee tegels breed; anders worden ze minder blij en vraagt de gastvrouw om een breder pad.
- **Plattegrond:** wie erlangs loopt, vindt daarna zijn lievelingsdier meteen.
- **Gastenboek:** blije gasten laten een tekening van hun lievelingsdier achter; tik op het boek om ze te zien.
- **Kletsen, zwaaien en tussendoortjes:** zie `docs/ANIMATIES.md`.

### Gebouwen
- **Uitkijktoren** (25 munten, level 21): hoe meer soorten in de buurt, hoe leuker.
- **Restaurant** (30, level 25): zes plekken aan tafel; eten én drinken in één keer, twee munten.
- **Reuzenrad** (80, level 36) en **botsauto's** (45, level 31): ritjes, net als de draaimolen.
- **Treinhalte** (20, level 28): met twee haltes aan hetzelfde pad rijdt het treintje van halte naar halte; gasten stappen in en bij de volgende halte weer uit. (Sinds 27 november rijdt het over rails die je zelf legt, zie 'Het treintje rijdt over rails' verderop.)
- **Schuilhut** (10) en **paraplu's** (6), beide vanaf level 11: voor als het regent.
- **Slingers:** palen met vlaggetjes of lichtjes (knop Park); tussen twee palen in één lijn, hooguit vijf tegels uit elkaar, hangt vanzelf een slinger. Lichtjes geven 's nachts licht.
- **Paden:** kiezels (level 11), brug (14), planken (18), bloemenpad (25). Gasten lopen over allemaal (`isPath`). Een rivier maak je door water te verven en er een brug overheen te leggen.
- **Vieze kramen** (vanaf level 18): na 50 keer verkopen is een kraam vies en koopt een derde van de gasten er niets. Vegen met de veger (1 munt) of een schoonmaker laten komen.

### Dieren
- **Niet meer door het hek:** een lang dier wordt op het scherm zo ver naar binnen geschoven dat het hele lijf in het verblijf blijft.
- **Haai en rog** in het aquarium (rog na level 23, haai na level 27).
- **Karakter:** gewoon, verlegen, speels, slaperig of dapper; je ziet het aan het gedrag en het staat achter de naam.
- **Zeldzame kleur:** ongeveer één op de acht jongen is wit, goud of donker. Gasten vinden dat extra leuk; zo'n jong verhuist als laatste.
- **Vriendjes:** tien paren soorten (zebra en giraffe, koe en schaap, ...) tellen als gezelschap voor elkaar, kroelen samen en maken een verblijf leuker voor gasten.
- **Warmte en kou** (vanaf level 32): krokodil, schildpad en maki willen een warmtelamp; pinguïn, ijsbeer, walrus en poolvos een blok ijs. Een dier wordt er nooit voor opgehaald.
- **In het verblijf:** heuvel, rotsen en klimrek (om op te klimmen), tunnel, drinkvijver en waterval.
- **Kijkruit:** een stuk hek met glas dat in elk hek past; gasten zien er 40 procent meer door (net als door het glas van het aquarium).
- **Dokterspel:** een ziek dier maak je beter in drie stappen: thermometer, pleister, drankje. (Sinds 27 november zijn het zeven kleine spelletjes, zie 'De dokter: zeven spelletjes' verderop.)
- **Weetjes:** bij het eerste dier van een soort hoor je een ingesproken weetje; later via het menu van het dier.
- **Voeren:** het doel in level 2 is nu één keer voeren.
- **Menu van een dier:** bovenin een levend plaatje van het dier (het park wordt van dichtbij nog eens getekend, `View.portrait`) met eronder in één of twee woorden wat het doet (`Animal.doing`, teksten `doing.*`).

### De kinderboerderij (vanaf level 7)
- Bouw een verblijf met het **witte hekje** en zet er een **poortje voor gasten** in dat aan een pad ligt. Minstens twaalf tegels groot.
- Alle tien boerderijdieren mogen er door elkaar in wonen: elk dier heeft genoeg aan twee tegels van zijn eigen grond, elke slaapplek en elk voer is goed, en ieder ander dier is een vriendje.
- Gasten (hooguit vier tegelijk per boerderij) lopen door het poortje naar binnen en aaien een dier, dat naar ze toe komt. Vier op de tien keer kopen ze een zakje voer: een munt.
- De uitleg komt de eerste keer dat je het witte hekje kiest.

### Personeel
- **Dierenarts** (level 24) maakt zieke dieren beter, **gids** (22) neemt hooguit vijf gasten mee langs drie verblijven en vertelt soms een weetje, **fotograaf** (19) verkoopt foto's aan tevreden gasten in de buurt.
- **Pak:** tien kleuren, te kiezen in het menu van de werker. **Karretje** (6 munten, level 16): sneller lopen en sneller klaar.

### Weer, seizoenen en tijd
- **Tijd:** de klok van het park loopt door over opslaan heen (`time` in het opslagbestand).
- **Regen** (vanaf level 11): om de zes tot negen minuten een bui van ongeveer een minuut. Gasten zonder paraplu worden minder blij en gaan eerder weg; ze halen een paraplu of schuilen. Dieren schuilen op hun slaapplek; modderliefhebbers rollen in een plas. Daarna een regenboog.
- **Seizoenen** (vanaf level 17): lente, zomer, herfst, winter. Sinds 27 november duurt elk seizoen drie dagen in het spel (`SEASON_DAYS`; een dag en een nacht is ruim elf minuten, dus een seizoen ruim een half uur). Eerst was dat één dag: dan wisselde het te snel. In de winter valt er sneeuw in plaats van regen.
- **Zonsopgang:** de haan kraait en de dieren worden een voor een wakker.

### Hulp
- **Hulphandje:** na 25 tellen niets doen wijst een handje zeven tellen lang aan waar je kunt tikken, daarna minstens 80 tellen niet.

### Bediening, bijgewerkt op 21 november 2026 (avond)
- **Hok slepen:** met Hek sleep je een rechthoek van de tegel waar je begint tot de tegel onder je vinger. Je ziet het hok als doorzichtig voorbeeld; de hekken komen pas bij loslaten. Een tik zet nog steeds één hekdeel; poort, kijkruit en poortje voor gasten gaan alleen met een tik.
- **Beeld draaien:** twee pijlen rechtsboven draaien het beeld een kwartslag (`View.rotate`). Op een smal scherm staan ze rechts onder elkaar.
- **Meldingen van dieren in nood:** links in het midden van het scherm, onder elkaar.
- **Op de tegelrand:** lantaarn, lichtjes, vlag, vlaggetjes, wegwijzer en plattegrond zet je op de rand van een tegel, net als een hek, bankje of afvalbak (`EDGE_DECOR`). Wat in een ouder spel nog op een tegel stond, blijft daar staan.
- **Niet aan het pad:** het wolkje met het pad en het rode kruisje staat stil vlak boven het ding. (Het zweefde eerst naar de hoek van het scherm: de animatie overschreef de plek.)
- **Verblijf kiezen:** het verblijf dat je aanwijst of waarvan het menu open is, licht heel zacht op.
- **Poep** heeft een bruine ring; met de veger in de hand een gele.
- **Afvalbak:** aan de voorkant een gleuf, een wit plaatje en een pedaal.
- **Natuur op een kwart tegel (22 november):** vanaf level 8 (`FEATURE.wild`) is er de knop Natuur: graspol, bloemetjes, varen, struikje, kiezels en steen (1 munt, elk één vakje) en boom, den, palm en rots (3 munten, een hele tegel). Elke tegel is in vier vakjes verdeeld; iets kleins komt in het kwart onder je vinger. Het mag in de verblijven en in het park, niet op pad of water. Om een boom of rots lopen de dieren heen. Komt er een voerbak, gebouw, pad of water op die plek, dan gaat het groen weg en krijg je de munten terug. Alles van één soort wordt in één keer getekend, dus honderden graspollen kosten bijna niets.
- **De natuurwens: bomen, planten en stenen:** elk dier wil van elk net genoeg in zijn verblijf: niet te weinig en niet te veel. Geteld wordt in stuks, in drie soorten: bomen (boom, den, palm), planten (graspol, bloemetjes, varen, struikje) en stenen (kiezels, steen, rotspunt). Hoeveel hangt af van de grond waar het dier van houdt en van de grootte van het verblijf (`WILD_WANT` per tegel land en `wildRange` in `data.ts`): hoe groter het verblijf, hoe meer. Een giraf (zand) in een verblijf van 16 tegels wil 1 tot 3 bomen, 1 tot 8 planten en 2 tot 11 stenen; een bosdier wil meer bomen en planten, een sneeuwdier vooral stenen. Een klein verblijf vraagt nog geen boom (die neemt een hele tegel). Hoe je het neerzet, mag je zelf weten. In het menu van het dier staat per soort een vakje met een staand balkje in vier standen (slecht, matig, goed, vol), zonder getallen; in het wolkje boven het dier staat hoeveel er nog bij of af moeten. Zet je iets neer waar het dier om vroeg, dan is het blij; staat er nu te veel van, dan is het sip. Klopt het niet, dan telt dat mee voor hoe blij het dier is, net als de andere wensen. Dolfijn, orka, rog en haai vragen er niet om, en in de kinderboerderij hoeft het niet. De verzorger zegt het na een poos (vier zinnen, voor alle dieren dezelfde: meer of minder groen, meer of minder stenen). Een ouder spel van voor de natuur krijgt bij het laden in elk verblijf gratis wat de dieren willen.
- **Draaiknop (22 november):** bij alles wat je neerzet en wat een richting heeft (voerbak, slaapplek, speelgoed, natuur, alles van Park, winkels en gebouwen) hangt een gele knop Draai in de balk onderaan, recht boven het ding dat je gekozen hebt. Elke tik is een kwartslag (toets R doet hetzelfde) en het voorbeeld draait meteen mee. Kies je hetzelfde ding nog een keer, dan staat het weer zo; een ander ding begint recht. Op een rand (bankje, bak, heg, bord) draait de knop het ding om: de andere kant op dan het vanzelf zou kijken. Een gedraaide tunnel ligt van boven naar beneden en de dieren rennen er dan in die richting doorheen. De stand (`rot`, in kwartslagen) wordt mee opgeslagen.
- **Lange dingen op de rand (22 november):** heg, rozen, tulpen, zonnebloemen en de bloemenboog zet je op de rand van een tegel, net als palen en borden (`EDGE_DECOR`). Ze liggen langs die rand en kijken naar het pad, of anders naar de kant waar je tikt. De modellen zijn daarvoor smaller gemaakt; een heg is precies een tegel lang, zodat een rij heggen één geheel wordt. Wat in een ouder spel nog midden op een tegel stond, blijft daar staan.
- **Richting van bankje, bloembak en afvalbak:** die wordt bij het neerzetten slim gekozen. Ligt er aan één kant van de rand pad, dan staat het op de rand van het pad en kijkt het naar het pad, ook als je vanaf het gras tikt; leg je later pad ernaast, dan draait het mee. Ligt er aan beide kanten pad, of nergens, dan kijkt het naar de kant waar je tikt. De rand van een pad trekt ook een beetje (0,2 tegel): tik je op een tegel naast het pad, dan komt het langs het pad. Het voorbeeld laat steeds zien hoe het komt te staan. Een tik erop draait het niet om; anders neerzetten doe je door het weg te halen en opnieuw te plaatsen.
- **Opgeslagen spellen:** de naam van de speler staat onder het plaatje.
- Het zwevende ballonnetje van de prikker (afval, getal, bak) is weg.

## De ronde van 22 november 2026 (wensen van Max tijdens het spelen)

- **Speeltuin als los gebouw is weg.** Er zijn alleen nog losse toestellen, die een voor een vrijkomen: glijbaan (level 10), schommel (13), wip (17), veerdier (20), trampoline (24). Een speeltuin uit een ouder spel wordt een glijbaan. Het level dat om een speeltuin vroeg, vraagt nu om een glijbaan.
- **Schuilen bij regen:** gasten rennen met hun armen boven hun hoofd naar de schuilhut. De eerste drie zitten op de bank, de rest staat eronder en kijkt om zich heen; is de hut vol, dan staat er een rij.
- **Rolstoel:** een gast in een rolstoel vraagt niet meer om een pad van twee breed. Is een pad onderbroken en kan een gast ergens niet komen, dan zegt de gastvrouw dat nog wel.
- **Vieren per verblijf:** is een dier blij omdat een wens uitkomt of een level klaar is, dan springen alleen de dieren van dat verblijf, en de gasten in een ring eromheen juichen mee.
- **Meldingen aantikken:** gaat een melding over een dier, een gast of een plek (een zeldzaam jong, een ziek of ontsnapt dier, een wens, een gast die iets mist), dan staat er een rondje met een stip in. Tik je op de melding, dan schuift het beeld erheen en licht de plek zes tellen op.
- **Menu van het dier:** de wensen staan groot bovenaan, elk met een staand balkje in vier standen (slecht, matig, goed, vol) en zonder getallen. De actieknoppen (aaien, weetje, naam, verdoven, verplaatsen, weg) zijn klein. Voeren uit de hand is weg; de naamknop heeft een naamkaartje als plaatje. Zolang de speler dat nog niet gedaan heeft, wijst het handje een sip dier aan en zegt de verzorger: tik op een dier om te zien wat het nodig heeft.
- **Wolkjes boven de dieren** worden opnieuw getekend zodra de wens verandert (eerst zand, daarna savanne bleef hangen).
- **Plaatjes:** elke kraam heeft in het menu het plaatje van wat hij verkoopt (hamburger, beker, ijsje). Vlees is een biefstuk met een botje. Alle slaapplekken hebben zzz in hun plaatje, zodat een rots om op te slapen anders is dan een rots om op te spelen.
- **Grond in twee groepen:** Voor dieren (gras, modder, zand, enzovoort) en Paden. Er zijn drie paden bij gekomen om vrij te spelen: klinkers (level 21), keien (30) en marmer (37).
- **Versiering naast een hek:** een lantaarn, vlaggetjes, een bord, een heg of een bloemperk mag ook op een rand waar een hek staat. Het schuift dan een stukje op (`EDGE_SHIFT`), naar de kant buiten het verblijf, en blijft binnen de tegel. Niet bij een poort en geen bloemenboog. Komt er later een hek bij of gaat het weg, dan schuift de versiering mee.
- **Draaiknop:** staat in de bovenste keuzerij, links naast de eerste knop.
- **Regenboog:** komt na ruim de helft van de buien, en loopt van rand tot rand over het beeld.
- **Nacht:** zonder lampen is het bijna zwart; alleen bij een lantaarn, een kampvuur, een winkel of de ingang zie je iets. De eerste keer legt de directeur uit dat het nu dag en nacht wordt.
- **Speelgoedstruik en natuurstruik** lijken niet meer op elkaar: het speelgoed is een struik met grote bessen in een houten bak, het struikje van de natuur is lage paarse hei.
- **Evenementen met een kaartje:** bij een schoolklas, een verjaardag, een beroemde gast, een vrachtwagen met voer (nieuw) en een fotograaf van de krant (nieuw) komt rechts een kaartje in beeld, met het geluid van dat evenement (kinderstemmen, feesttoeter, fanfare, toeter, klik van een camera). Tik je erop, dan help je met een puzzeltje; met het rode kruisje doe je het weg, en na vijftig tellen verdwijnt het vanzelf. Tijdens een puzzeltje staat het park stil.
  - Schoolklas: een som onder de tien, of de weg wijzen (het plaatje van een dier blijft in beeld; tik op het verblijf van dat dier en de klas loopt erheen). Goed: de juf zegt iets liefs, de kinderen juichen en krijgen een hartje, 4 munten, en klassen komen voortaan vaker en met meer kinderen (`classFans`, 0 tot 3, wordt bewaard). Fout: de juf zegt dat het jammer is en klassen komen weer wat minder vaak. Als de klas naar huis gaat, zegt de juf hoe het was.
  - Verjaardag: cadeautjes op volgorde zetten; goed is 3 munten.
  - Beroemde gast: een woord van drie letters leggen; goed is 2 munten en hij gaat blij naar huis (dan komen er meer gasten).
  - Vrachtwagen: een som; goed is 6 munten.
  - Fotograaf: een woord leggen; goed is tweeënhalve minuut een kwart meer gasten.
  - De puzzeltjes staan in `minigame.ts` (`playMini`); los uitproberen kan op `minispel.html`. De zinnen van de gastvrouw zijn ingesproken (Nederlands en Engels); de korte teksten in het puzzeltje zelf worden niet voorgelezen.

- **Zes nieuwe speeltjes voor in het verblijf:** autoband (level 14, 3 munten; rolt rechtop door het verblijf), wipplank (17, 4), slingerbal (20, 4), kruipboog (24, 5), bandenschommel (29, 6) en klimpaal (33, 6). Het dier doet echt mee: het wipt op de plank, geeft de bal een stootje, kruipt onder de boog door, zit op de schommel (grote dieren duwen ertegen) of klimt de paal op en kijkt boven rond. Een tik met het handje laat het ding zelf even bewegen. Zeedieren doen er niets mee. Sommige soorten vinden zo'n nieuw ding net zo leuk als hun lievelingsding (`TOY_ALSO` en `likesToy` in `data.ts`): een aap is ook tevreden met een bandenschommel of klimpaal. Het wolkje en de zin noemen nog wel het oude lievelingsding.
- **Kleine dingen voor het park:** negen dingen op een kwart tegel (bloempot, kabouter, windmolentje, badeend, vogelhuisje, gieter, emmertje, slak, kistje appels), 1 munt per stuk. Ze staan bij Natuur in een eigen groep Voor het park en komen een paar tegelijk vrij (level 11, 13, 16, 19 en 22). Ze mogen alleen buiten de verblijven, tellen niet mee voor de natuurwens en je loopt er gewoon langs. Bouw je er later een verblijf omheen, dan blijven ze staan.
- **Vijvers haken aan elkaar:** vijvers op tegels naast elkaar worden één vijver met ronde hoeken (twee een ovaal, vier een grote afgeronde vijver). Haal je er een weg, dan wordt de buur weer rond.
- **Slim geluid, vaste omgeving en muziek:** zie Geluid op de achtergrond. De savanne, de jungle, het ijs en de verre landen hebben geen eigen lucht, gras of achtergrondgeluid meer; de naam van de wereld staat nog wel bij het level en de dieren staan er nog per wereld.

### Later op 22 november: het menu opnieuw ingedeeld

- **Vier knoppen voor het park:** Winkels (kramen en het restaurant), Attracties, Park en Personeel. Onder Attracties staan twee groepen: Speeltuin (glijbaan, schommel, wip, veerdier, trampoline) en Attracties (fontein, uitkijktoren, draaimolen, treintje, botsauto's, reuzenrad). De knop Winkels heeft een plaatje met een hamburger, een beker, een ballon en een knuffel.
- **Park in zeven groepen:** Groen (bomen, bloemen, heg, en de bloembak), Water, Sier (alleen om naar te kijken), Licht, Klein, Borden (wegwijzer en plattegrond: die wijzen de weg) en Handig (wc, bankje, picknicktafel, gastenboek, afvalbak, paraplu's, schuilhut). In een groep staan versieringen, klein spul en gebouwtjes door elkaar; het spel kijkt naar wat je kiest om te weten hoe je het neerzet (`mode()` in `game.ts`, `PARK_GROUPS` en `parkShopGroup` in `data.ts`). De kleine dingen voor het park staan dus niet meer bij Natuur maar bij Park, groep Klein.
- **Volgorde van de rijen:** van onder naar boven staat er steeds de grote knop, dan de groep, dan de dingen zelf, en helemaal bovenaan de knop Draai (of jongen en meisje bij de dieren).
- **Kleine versieringen op een kwart tegel:** paddenstoelen, cactus, pompoenen, vogelbadje, pomp, kei, gastenboek, vogelverschrikker, vormboom, totempaal, sneeuwpop, kampvuur, standbeeld en de nieuwe lampen (`SMALL_DECOR`) zet je in het kwart van de tegel onder je vinger. Er passen er vier op één tegel, ook naast een graspol of steen, en de knop blijft aan zodat je er een paar achter elkaar zet. Wat er al stond, blijft midden op zijn tegel staan.
- **Licht:** lantaarn, kampvuur en lichtjes staan in de groep Licht, met vier nieuwe lampen: tuinlampje (level 17, 3 munten, licht 1,8 tegel ver), lampion (19, 5 munten, 3 tegels), fakkel (21, 4 munten, 2,6 tegels) en straatlamp (27, 9 munten, 5 tegels). De getallen staan in `LIGHT`.
- **Natuurplaatje:** bij de boom en de steen in de wensen van een dier staat klein het plaatje van de knop Natuur.
- **Smileys bij neerzetten:** zet je in een verblijf een voerbak, slaapplek, speelgoed of iets van de natuur neer, dan laat elk dier een smiley zien: groen (dit wilde ik), geel (prima, maar niet nodig) of rood (nu staat er te veel).
- **Ring bij zweven:** hang je met de muis boven een dier, gast, werker, voerbak of winkel, dan ligt er een gele ring omheen: daar kun je op tikken voor een menu.
- **Klok:** de tijd rechtsboven staat er digitaal (12:05); de minuten springen per vijf.
- **Meldingen:** de melding dat een werker ergens niet in kan (er moet een poort komen) kun je aantikken; het beeld gaat dan naar dat verblijf. Zinnen als "Daar zijn de eerste gasten!" en "De kinderboerderij is open!" klinken niet meer bij elke start.
- **Bijzondere jongen:** nog maar één op de twintig jongen is bijzonder (was één op de acht). Zes van de tien keer is dat wit, goud of donker, twee van de tien keer een glimmende vacht die af en toe fonkelt, en twee van de tien keer een gekke felle kleur: roze, geel, groen of blauw (`pickRare`). Een roze olifant is dus heel zeldzaam.

### De avond van 22 november: leven in het park

- **Weg voor de poort** (`road.ts`): een strook asfalt met een fietspad, een zebrapad, een bushokje en een fietsenrek, buiten het bouwbare park. Er rijden auto's in twee richtingen, 's nachts minder en met de lampen aan. Komt er een schoolklas, dan stopt de gele schoolbus bij de poort en lopen de kinderen naar binnen; bij het evenement met het voer stopt de vrachtwagen. Wandelaars, fietsers en kinderen op een step komen aan over de stoep. De weg is alleen om naar te kijken.
- **Wegwijzers en plattegronden** (`WAYFIND`, `SEEK_REACH`): een wegwijzer wijst de weg tot 7 tegels, een plattegrond tot 11, de poort tot 9. Staat een gast binnen dat bereik, dan weet hij de weg door het hele park. Daarbuiten zoekt hij niet verder dan 14 tegels om zich heen naar een wc, eten of een bankje, en kan hij in een groot park (meer dan 40 padtegels, vanaf level 8) de weg kwijtraken: hij staat met een vraagteken boven zijn hoofd en dwaalt even rond. Zet je een bord neer, dan herstellen de gasten in de buurt meteen. Met de wegwijzer of plattegrond in de hand zie je het bereik als ringen.
- **Wolkjes boven gasten** staan er alleen nog als een gast iets echt niet kan vinden. Hij wordt dan steeds minder blij en gaat op den duur naar huis. Staat er wel zo'n winkel in het park, dan zegt de gastvrouw dat er een wegwijzer bij moet.
- **Juf en meester:** elke schoolklas heeft een juf of een meester met een eigen poppetje, een eigen stem en een eigen kleur shirt. Zij stellen de vraag, reageren op het puzzeltje en nemen afscheid. De klas vraagt elke keer iets anders: een som, de kinderen tellen, de naam onder een tekening, in de rij van klein naar groot, of de weg wijzen.
- **Vijf nieuwe evenementen:** timmeren met de bouwer (volgorde), dieren tellen voor het slapen met de verzorger (som, alleen 's avonds), kisten voer sorteren (volgorde), de kassa tellen met de kassier (som) en de burgemeester op bezoek (een dierennaam leggen; goed is twee minuten meer gasten). Elk evenement heeft twee vragen, twee goede en twee slechte aflopen, zodat het niet steeds hetzelfde klinkt (`EVENTS` in `game.ts`, `EVENT_SAYS` in `lines.ts`).
- **Bezoekers bewegen veel meer:** de volledige lijst staat in `docs/ANIMATIES-BEZOEKERS.md` (44 animaties waren er, 52 zijn erbij gekomen). In het kort: een echt ijsje, een beker met een rietje, friet, een knuffel onder de arm, een ballon die soms wegvliegt, een verrekijker, schrikken als een dier brult, ssst bij een slapend dier, ongeduld in de rij, rennen naar de wc, en nieuwe houdingen op de glijbaan, de trampoline, de wip, de draaimolen, het reuzenrad, de botsauto's en de toren.
- **Bezoekers gebruiken het park:** een gast zonder dringende wens loopt soms naar iets binnen vijf tegels en doet er wat mee: aan de picknicktafel eten, bij de vijver de eendjes voeren, in de waterput roepen, pompen, handen warmen bij het kampvuur, een standbeeld nadoen, in het gastenboek schrijven, aan bloemen ruiken, afval in de bak gooien, een muntje in de fontein gooien. Elk gebruik maakt de gast iets blijer, dus versieren loont (`SIGHT` in `people.ts`).
- **Dieren doen een kunstje voor wie kijkt:** staat er iemand bij het hek, dan komt om de vijf tot negen tellen een dier kijken en doet het iets wat bij zijn soort past (`SHOW_OF` in `animal.ts`): brullen, huilen, stampen, rechtop zwaaien, terugzwaaien, tegen het hek staan, rollen, dribbelen, sprinten, huppen, knikken, pronken, buigen, sproeien, klappen, happen of uit het water springen. Jonge en speelse dieren lopen een stukje mee met een kind; in de kinderboerderij komen tamme dieren bedelen.
- **Gezichtjes** (`faces.ts`): elk poppetje heeft een eigen gezicht uit 64 mogelijkheden (ogen, wenkbrauwen, neus, mond, soms een bril, snor, baard, blosjes of sproeten). Het gezicht verandert mee met de stemming en knippert. Alle gezichten komen van één plaat en worden in één keer getekend.
- **Mooiere poppetjes:** ronder hoofd en lijf, handen, schoenen, elf kapsels, rokjes en jurken, korte mouwen, af en toe een streep of een rugzakje. De beweegbare onderdelen zijn dezelfde gebleven; een poppetje is ongeveer 310 driehoeken.
- **Grond met texturen** (`ground.ts`): elke soort grond heeft een getekend oppervlak dat over vier bij vier tegels doorloopt, zonder naden. Het water beweegt langzaam; gras, bos, wei en steppe kleuren mee met het seizoen.
- **Geluiden bij de animaties:** 33 korte geluidjes voor gasten, park, toestellen, dieren en de weg, elk met een eigen sterkte en een minimale tijd ertussen (`GUEST_SOUND` en `TRICK_SOUND` in `game.ts`). Ze klinken alleen als de plek in beeld is.
- **Klein:** de speeltuin staat onder Attracties; de paraplubak, het bankje, de afvalbak en de bloembak mogen langs een hek; de knoppen liggen altijd boven de wolkjes; de draaiknoppen tonen een videocamera met een oranje pijl.
- **Nog niet gebouwd:** een kind op de schouders, hand in hand lopen, een ober in het restaurant en een ouder die de schommel duwt.

### De nacht van 22 op 23 november: bezoekers als mensen

- **Menu van de bezoeker:** tik je op een gast, dan zie je hem uitvergroot en bewegend, met eronder wat hij doet (wandelt, staat in de rij, is de weg kwijt) en zijn wensen met balkjes: humeur, lievelingsdier, eten, drinken, wc, rusten en waar hij zin in heeft.
- **Namen en feitjes** (`traits.ts`): elke gast heeft een voornaam en drie feitjes uit een voorraad van 946 per taal (eten, hobby, wat hij kan, wat hij leuk vindt, grappige dingetjes, de dierentuin, vandaag, thuis, verzamelen, huisdier, school, muziek, weer, kleur). Kinderen en volwassenen hebben eigen feitjes; een gast in een rolstoel krijgt geen feitjes over rennen of klimmen. Daarboven staan hooguit twee dingen van nu: het lievelingsdier en de grootste nood. De juf, de meester, de beroemde gast, een kind op schoolreis, de jarige en een ouder met een kinderwagen hebben een eigen vaste regel. Een gast houdt zijn kaartje zolang hij in het park is; het wordt niet bewaard.
- **Door de poort:** een nieuwe gast verschijnt op de stoep, een tegel of zes naast de poort, loopt over de stoep, de hoek om en onder de boog door naar binnen. Wie weggaat, loopt de poort uit en nog een stuk over de stoep. Een schoolklas verschijnt pas als de bus bij de halte stilstaat: de juf of meester stapt uit en de kinderen komen er een voor een achteraan. De poppetjes van de weg zelf lopen of rijden alleen nog voorbij.
- **De weg** loopt door tot de rand van de wereld; de rotsen met tunnels zijn weg.
- **Oplichten bij zweven:** een kraam, voerbak, dier, gast of werker waar je boven hangt, krijgt hetzelfde witte vlak met rand als een verblijf.
- **Draai-knop:** staat recht boven het gekozen ding in de bovenste rij.
- **Grond:** de twee groepen heten Voor dieren (een pootje) en Voor het park (een boompje).
- **Klein spul voor het park** mag ook op een padtegel staan, in een kwart van de tegel. De stapel ballen is eruit; er zijn nu negen kleine dingen.
- **Puzzeltjes:** de uitleg boven de vraag en "Goed gedaan!" worden voorgelezen, in de stem van wie om hulp vroeg.
- **Opgesloten werker:** stond een werker in een verblijf toen het hek weer dichtging of het verblijf groter werd, dan stapt hij er nu eerst uit, in plaats van bij elke klus te melden dat er een poort moet komen.
- **Sluitingstijd:** vanaf tien uur 's avonds gaan de gasten naar huis en komt er niemand meer bij. Om middernacht is het park dicht: de directeur zegt welterusten, alle dieren slapen (ook wie honger heeft) en het personeel staat stil. Wie dan nog binnen is, loopt stevig door naar de uitgang. Om vijf uur gaat het personeel weer aan het werk (voeren, vegen, repareren). Om zeven uur gaat het park open, zegt de directeur goedemorgen en loopt het snel weer vol. Dit geldt pas vanaf het level waarin het nacht wordt (`closed`, `goingHome` en `deepNight` in `game.ts`).
- **Hek in twee standen:** boven het gekozen hek hangen twee knoppen met het plaatje van dat hek (net als de Draai-knop); daarmee kies je hoe je bouwt. Hok slepen: je sleept een rechthoek en bij loslaten staan de hekken eromheen. Los hek: een tik zet één stuk hek op de rand, en veeg je langs een rand, dan komt er een rij hekken. Een poort, kijkruit of poortje voor gasten zet je in beide standen los neer met een tik.
- **Wegwijzers:** de regels zijn even soepeler geweest en op verzoek weer teruggezet (zie de getallen hierboven).

### 23 november: ideeën uit het dierentuinspel-genre

Op verzoek van Max, als inspiratie uit het genre (niets overgenomen: geen namen, plaatjes of getallen van een bestaand spel). Elk onderdeel is door een eigen agent gebouwd en daarna samengevoegd.

- **Sterren voor het park** (`stars.ts`): 1 tot 5 sterren rechtsboven, onder het aantal gasten, en dezelfde sterren op het bord van de ingang. De score telt blije dieren (35%), blije gasten (30%), een schoon park (20%), het aantal soorten (10%, vol bij 6) en een mooi park (5%). De sterren volgen het park rustig: om de 20 tellen hooguit één ster erbij of eraf, 's nachts staan ze stil. Meer sterren geven meer gasten (1 ster 0,9×, 3 sterren 1×, 5 sterren 1,2×; tot level 10 nooit minder dan 1×). Een ster erbij is een klein feestje met een zin van de directeur; gaat er een af, dan geeft de gastvrouw hooguit eens per vier minuten één tip. Een tik op de sterren laat met plaatjes en gezichtjes zien wat goed gaat.
- **Bang voor een roofdier** (vanaf level 14, als de leeuw er is): zet je een roofdier bij een dier dat bang voor hem is (`PREY_OF` in `data.ts`), dan kruipen de bange dieren in het verste hoekje, trillen, rennen weg als hij dichtbij komt en hebben een oranje '!' boven hun kop. Er gebeurt nooit iets engs. Het is een nieuwe wens ('safe'), even zwaar als honger; de verzorger zegt welk dier bang is voor wie. Oplossing: zet ze elk in een eigen verblijf.
- **Vies water in de bak** (vanaf level 21, met het aquarium): het water in een bak van glas wordt langzaam troebel, sneller met meer zeedieren (drie dolfijnen: ongeveer zes minuten). Je ziet het water groengrijs worden met vlokjes; zeedieren willen dan schoon water. Een tik met de veger maakt het schoon, een schoonmaker poetst het vanaf het glas, en een **waterfilter** (bij Speelgoed, 6 munten) houdt het vier keer zo lang schoon.
- **Dierenshow** (vanaf level 23): een **showtribune** bij Attracties (30 munten) zet je met een kant tegen een bak van glas met dolfijnen of orka's. Om de tweeënhalve minuut klinkt de bel, komen gasten uit de buurt op de bankjes zitten en doen de dieren 18 tellen lang kunstjes: springen, draaien, door de hoepel en met hun vinnen klappen. Daarna applaus; elke kijker betaalt een munt. Rustende dolfijnen staan op voor de show; alleen als ze verdrietig of ziek zijn, of 's nachts slapen, gaat de show niet door. Tik op de tribune voor "Nu een show!". Ook **zeehonden** doen een show: hun verblijf heeft geen glas, dus bij zeehonden mag de tribune tegen elk hek staan (niet tegen een poort). Een zeehond klapt met zijn vinnen, maakt een koprol, haalt de bal als die er ligt en buigt voor het publiek.
- **Kabelbaan** (vanaf level 33, bij Attracties, 25 munten per huisje; sinds 27 november mag de kabel alle kanten op en langs tussenpalen, zie 'De kabelbaan: alle kanten op' verderop): zet twee huisjes in een rechte lijn, 5 tot 14 tegels uit elkaar, elk tegen een pad. Tijdens het richten zie je een groene of rode lijn waar de kabel komt. De kabel hangt hoog en mag over verblijven, paden en hekken; ertussen staan palen. Gekleurde stoeltjes voor twee gaan steeds rond. Gasten die een ritje willen of iets moois willen zien stappen in, kijken naar beneden en worden blij van elke soort die ze onder zich zien (bij hun lievelingsdier juichen ze). Een ritje kost 2 munten. Vanaf sluitingstijd stapt niemand meer in en 's nachts staan de stoeltjes stil; in de winter ligt er sneeuw op dak en palen (`cable.ts`). **Verder bouwen:** zet je een nieuw huisje in een rechte lijn met een eindhuisje (rechtdoor of de hoek om, niet terug over de kabel), dan wordt dat eindhuisje een tussenstation en hangt er een nieuw stuk kabel. Zo maak je een lange kabelbaan door het hele park. Bij een tussenstation rijden de meeste gasten met het volgende stuk verder (hooguit vier stukken achter elkaar); de rest stapt uit.
- **Ontsnappen op vijf manieren** (vanaf level 31, `ESCAPE_WAY`): springers springen over het hek, klimmers klimmen eroverheen, vogels vliegen eroverheen, sterke dieren duwen een houten hek om (dat stuk is dan kapot en moet gerepareerd worden) en de rest glipt erdoor. Achter het verkeerde hek ontsnapt een dier veel vaker en altijd op zijn eigen manier; met het goede hek en blij gebeurt het bijna nooit. De melding noemt het hek dat helpt. Je ziet het ook echt gebeuren (`BOLT_CUES` en de houding per manier in `animal.ts`, de effecten in `boltFx` in `game.ts`): eerst stiekem rondkijken, dan naar het hek rennen, en dan per manier een eigen beweging met stof, veertjes en een hek dat trilt, terugzwiept of opzij buigt (`wobbleFence`, `dust` en `feathers` in `view.ts`). Een stenen muur en glas bewegen niet mee.
- **Bewaker** (vanaf level 32, bij Personeel): loopt naar een ontsnapt dier, fluit, en het dier loopt achter hem aan door de poort naar zijn eigen verblijf. Zonder poort zegt de bouwer dat er een poort moet komen.

### 26 november: zelf iets doen met dieren, bezoekers en het park

Veertien ideeën uit `docs/IDEEEN-INTERACTIEF.md`, gekozen door Max en gebouwd door vijf agents tegelijk.

- **Snoepje** (vanaf level 2, bij Actie): tik op een dier of sleep naar een dier. Een stukje van zijn eigen voer vliegt in een boogje naartoe; het dier springt en vangt het (zeedieren springen uit het water), smult en krijgt een hartje. Minder honger en een poosje extra blij. Gratis, maar per dier één keer per minuut. Een ziek dier eet het niet (`care.ts`).
- **Tuinslang** (vanaf level 20, bij Actie en als snelknop rechtsboven): houd je vinger op een dier. Het staat stil onder de straal en schudt zich daarna droog met spetters en sterretjes. Dieren worden langzaam stoffig (je ziet stofjes op hun rug; sinds 27 november elk dier in zijn eigen tempo, zie 'Vies worden en wassen' verderop). Regen spoelt het stof er langzaam af. Een heel stoffig dier wil gewassen worden: de wens 'schoon' is dan niet vervuld (plaatje: het dier met de slang, en de verzorger zegt het), maar het wordt er nooit voor opgehaald. Wassen maakt het schoon en een poosje extra blij. Een modderliefhebber rolt daarna gewoon weer in de modder, en de olifant spuit terug.
- **Kinderen helpen** (`kids.ts`): zwaaien in het menu van een gast (de gast zwaait terug en een kind springt); een gevallen ijsje (vanaf level 13, tik op het bordje boven het huilende kind en het krijgt een nieuw); een muntje geven aan een kind zonder geld (vanaf level 14, het tekent bij het weggaan een hartje in het gastenboek); een wegvliegende ballon terugvangen (vanaf level 23, tik hem binnen zes tellen aan). Elk hooguit eens per paar minuten.
- **De weg wijzen**: sleep met het handje vanaf een gast die de weg kwijt is. Een stippellijn volgt je vinger; een roze ring met hartje boven het verblijf met zijn lievelingsdier. Laat je los, dan loopt hij erheen.
- **Raad het lievelingsdier** (vanaf level 7): een kaartje met drie hints (een kleur, het aantal poten en het geluid) en drie dieren uit het park om uit te kiezen. Goed: een munt en de gast loopt meteen naar zijn dier.
- **Optocht** (vanaf level 14): de trommel in het overzicht van je park (tik op de poort) laat een clown een rondje over de paden lopen; kinderen in de buurt lopen springend en zwaaiend mee, grote mensen klappen. Daarna rust de clown tweeënhalve minuut uit.
- **Schminktent** (vanaf level 18, bij Winkels, 12 munten): kinderen krijgen er zin in en dragen daarna een tijger-, poezen-, vlinder- of pandagezicht. Tik op de tent om het volgende gezicht te kiezen.
- **Bladeren harken** (in de herfst, vanaf level 17): onder bomen vallen blaadjes. Met de hark (bij Actie) veeg je ze op een hoop; is die groot, dan springt er een kind in. Harken geeft een munt; blaadjes op het pad tellen als rommel voor de sterren (`parkplay.ts`).
- **Sneeuwpop bouwen** (in de winter): met Sneeuw (bij Actie) rol je een sneeuwbal over het besneeuwde gras; drie tikken en het is een sneeuwpop met een sjaal. Kinderen komen kijken en gooien een sneeuwballetje. Na de winter smelt hij.
- **Lampjes aan en uit** (vanaf level 15, 's nachts): tik op een lamp en hij gaat uit of aan, met een plopje. Zet je er snel een paar weer aan, of tik op de grote lamp boven de ingang, dan gaat er een golfje kleuren langs alle lampen. Elke avond gaan alle lampen vanzelf aan.
- **Avondfeest** (`party.ts`): na 20, 30, 40 en 50 gehaalde levels is de eerstvolgende avond een feestavond (niet elke avond). 's Ochtends zegt de directeur het; om acht uur staat er een gong bij de ingang. Tik erop (of wacht tot negen uur): alle lampen gloeien in kleuren, er klinkt muziek, gasten lopen een rondje en dansen, de dieren komen naar het hek en doen hun kunstje, en aan het eind komen er zachte plopjes confetti. De klok loopt dan half zo snel, zodat iedereen blijft tot het feest voorbij is. Daarna 10 munten en iedereen gaat naar huis.

### Rondlopen als bezoeker

Vanaf het level met paden staat er een knop met een lopend kindje. Daarmee zak je in 1,3 tel naar ooghoogte van een kind, op het pad in het midden van je beeld (anders bij de ingang). Met dezelfde knop of Escape vlieg je terug naar precies waar je was (`walk.ts`, `walkmode.ts`).

- **Lopen:** pijltjes of WASD (links en rechts draaien, Shift erbij om opzij te stappen), rondkijken door te slepen; op een tablet een grote ronde knop linksonder. Rustig tempo, een zacht knikkend hoofd en voetstapjes (`walk.step`).
- **Niet door** hekken, verblijven, water, gebouwen, kramen, versieringen, bomen en rotsen; tegen een muur glijd je erlangs.
- **Kijken en aantikken:** een stipje in het midden. Kijk je binnen 5 tegels naar een dier, gast of kraam, dan wordt het stipje geel en zie je de naam. Tik (of Spatie/E): een dier laat zich horen, komt naar het hek en doet het kunstje van zijn soort, met een hartje; een gast zwaait terug en een kind springt.
- Tijdens het lopen verdwijnen de bouwknoppen; munten, sterren en de klok blijven. Dag en nacht, regen en sneeuw lopen gewoon door.
- **Kopen bij een kraam:** tik op een kraam en je krijgt iets van wat hij verkoopt (verkoopt hij meer dingen, dan kies je met grote plaatjes). Het kost 1 munt; zonder munten krijg je het toch. Je houdt het rechtsonder in beeld vast en het wiebelt mee met je stappen. Eten en drinken ga je vanzelf, hapje voor hapje (zie de ronde van 27 november); tik op het scherm (als je nergens naar kijkt) of Spatie om het meteen te gebruiken: drie hapjes of slokjes, een hoedje opzetten (je ziet de rand bovenin en een hoedje bij je munten), aan de ballon trekken, de knuffel knuffelen, of je schmink zien. De wc spoelt door. Wat je vasthoudt wordt altijd vooraan getekend (`held.ts`, `walkhand.ts`).

**Knoppen en kas** (26 november): rechtsboven één rij, iets kleiner: draaien, draaien, rondlopen, geluid, huis. Daaronder de kas: sterren, munten, klok, gasten, seizoen en weer. Het snoepje en de tuinslang staan gewoon bij Actie.

**Het overzicht van je park** (tik op de poort bij de ingang, `openPark`, `parkstats.ts`): hang je met het handje boven de poort, dan krijgt hij dezelfde witte rand als een kraam. bovenin sterren, gasten, blije dieren en munten. Daaronder grote knoppen: de optocht (de trommel; grijs met een rondlopende schaduw als de clown nog uitrust) en het gastenboek. Daaronder vakjes met cijfers: een grafiekje van het aantal gasten en van de verdiende munten (een meting om de 20 tellen, de laatste 8 minuten), wat er dit level verkocht is met de prijs per stuk (1 munt), de lievelingsdieren van de gasten in het park, en hoeveel gasten blij, gewoon of niet blij zijn.

**Snurken** ('s nachts): de slapende dieren die je kunt horen snurken om de paar tellen, een groot dier diep (`snore.big`) en een klein dier piepend (`snore.small`), elk in drie versies (`SNORE` in `game.ts`).

### Het logo van SMJ Games

SMJ staat voor **Super Magical Journeys**. De drie letters zijn figuurtjes: een oranje S met een cape, een paarse harige M met een toverstaf en een groene J met een safarihoed. De plaatjes zijn losgeknipt van hun witte achtergrond (`tools/logo/knip.py` met Blender, bron in `tools/logo/bron/`, uitkomst in `games/zoo/public/logo/`).

- **Laadscherm:** na het kiezen van een park ploppen de letters er snel een voor een in als drilpudding (ze staan dicht tegen elkaar aan, de J een stukje voor de M, en stuiteren daarna om de beurt rustig na, met belletjes erachter), met de woorden Super Magical Journeys als één regel in het midden eronder en een kort magisch deuntje (`logo.jingle`). Het scherm blijft minstens 2,6 tellen staan en vervaagt dan.
- **Beginscherm:** dezelfde letters klein boven "Dierentuin", zonder geluid.

### Mooier licht en kleur (26 november)

Zonder dat het spel trager wordt (geen extra beeldbewerking, alles één keer berekend of in één tekenbeurt):

- **Tone mapping** (`NeutralToneMapping`, belichting 1,1): felle plekken lopen zacht af in plaats van hard wit, de kleuren blijven vrolijk.
- **Licht per uur** (`daylight.ts`): 's ochtends zacht warm oranje, 's middags helder wit, 's avonds goud, in de schemering en 's nachts koel blauw. Herfst iets warmer, winter iets koeler. Voor de nacht in het spel zit is het altijd 13 uur.
- **Lucht met een verloop** (`sky.ts`): dieper blauw bovenin naar een lichte horizon in de kleur van het uur, met zeven zachte wolkjes die langzaam rond drijven (vooral te zien bij het rondlopen).
- **Waas aan de horizon**: het park blijft scherp, alles ver buiten het park vervaagt naar de kleur van de horizon.
- **Schaduw in de kleuren** (`shade.ts`): onderkanten, buiken en poten van dieren, poppetjes, kramen, speeltoestellen en bomen zijn iets donkerder. Eén keer berekend per model; ogen en de kop blijven licht.
- **Schaduwvlekjes** (`blobs.ts`): een zacht rond vlekje onder elk dier, elke gast en elke werker (niet in het water, de kabelbaan of het treintje; 's nachts lichter).

Vergelijken in de browser: `__zoo.view.setLook(false)` (oud licht, lucht en waas), `__zoo.blobs.on = false`, en `localStorage.zooNoShade = '1'` met herladen.

## De ronde van 27 november 2026 (eenentwintig verbeterpunten van Max)

Max speelde het spel en kwam met een lijst van eenentwintig punten. Hieronder per onderwerp wat er veranderd is. Nalopen kan zonder venster met `tools/playtest/kijk.mjs` (het spel openen in een onzichtbare browser, een park klaarzetten en foto's maken).

### Vies worden en wassen

Het waren steeds dezelfde dieren die vies werden, vooral de varkens. Dat kwam door vier dingen samen: het stof werd niet bewaard (na het laden begon iedereen op nul), een dier dat in de modder rolde kreeg er per tel veel stof bij, na het wassen ging het meteen weer rollen, en elke regenbui waste alle andere dieren helemaal schoon. Nu (`care.ts`):

- **Elk dier zijn eigen tempo:** gemiddeld is een dier in een kwartier stoffig, maar het ene 0,55 en het andere 1,6 keer zo snel (`DUST.pace`, `dustPace`). Het tempo en het stof worden bewaard.
- **Rollen in de modder** geeft alleen bruine vlekjes die na vier minuten weer weg zijn (`MUDDY`); gewassen hoeft het dier daar niet voor te worden.
- **Regen** spoelt nog maar langzaam: pas na vijf minuten regen zou een dier schoon zijn (`DUST.rain`).
- **Niet te veel tegelijk:** er zijn hooguit twee dieren tegelijk vies, en één erbij per twaalf dieren in het park, nooit meer dan zes (`DIRTY`). Tussen twee dieren die vies worden zit minstens twee minuten, en wie er aan de beurt is wordt geloot uit de dieren die stoffig genoeg zijn. In een proef met 20 dieren van vijf soorten (veertig minuten, waarbij een vies dier na een minuut gewassen werd) werden 6 geiten, 3 koeien, 3 schapen, 3 varkens en 3 paarden vies; eerst waren dat bijna alleen varkens.
- **Het plaatje:** het kopje van het dier zelf met moddervlekken, stanklijntjes en twee vliegjes eroverheen (`dirt` en `stacked` in `icons.ts`), in het wolkje boven het dier en in zijn menu. De tuinslang alleen was niet duidelijk genoeg.
- **Schoonmakers** wassen een dier dat anderhalve minuut vies is zelf (`WASH_AFTER`), en de meter 'schoon' van het park telt de vachten mee.

### Lampen en vlaggen op hoeken en randen

- **De rode punten:** een lantaarn, lamp, lichtjes of vlag (`POLE_DECOR`) zet je op de hoek van een tegel of midden op een rand (`Spot` in `grid.ts`: 'h', 'v' of 'c' voor een hoek), ook precies op een hek of op de hoekpaal van een verblijf. Het voorbeeld klikt naar het dichtstbijzijnde punt. Bankjes, afvalbakken, bloembakken, heggen en borden blijven midden op een rand.
- **Op een hek** staat de paal op het hek (`FENCE_TOP` per soort hek); slingers hangen in stappen van een halve tegel.
- **In de loopstand** is zo'n paal nog maar een dun blokje (`POLE_HALF`), en hij staat nooit meer midden op het pad: je loopt er gewoon langs. Lampen uit een ouder spel blijven staan waar ze stonden.
- **Weghalen:** de gum pakt eerst het losse ding dat het dichtst bij je vinger staat (binnen een derde tegel, `ERASE_REACH`): de lamp, de vlag, de afvalbak of het bankje. Pas als er niets los staat, gaat het hek weg.

### Poorten

- **Een poort houdt het materiaal van zijn hek:** hout, steen, net of glas (`gateStyle` in `view.ts` kijkt naar de hekken ernaast, en anders naar de soort verblijf). Eerst werd een poort in een glazen verblijf grijs steen.
- **In het aquarium** is de poort een glazen deur in een lijst, met aan de buitenkant een trapje omhoog naar een bordes (`STAIR_GEO`, `stairSide`).

### De melding "host busy hats"

Voor de drukte bij een kraam bestond niet voor elke soort kraam een zin. Nu is er een zin voor elke soort (`host.busy.*`) en een algemene zin voor wat er later nog bijkomt (`host.busy.any`). Een test (`lines.test.ts`) loopt alle zinnen na: elke sleutel moet in het Nederlands en het Engels bestaan.

### Speelgoed: een lijstje per soort

Dieren vroegen lang om hetzelfde ding, terwijl er veel meer te kiezen was. Nu heeft elke soort een lijstje van dingen die hij leuk vindt, het liefste eerst (`TOY_LIKES` in `data.ts`): bijna altijd vier of vijf, bij de zeedieren een of twee.

- **Hoeveel:** het begint met één ding. Heb je drie of meer dingen van hun lijstje vrijgespeeld, dan willen ze er twee; bij vijf of meer drie. Een groep van vier of meer wil er nog een bij. Nooit meer dan er past: één ding per vijf tegels van het verblijf, en hooguit vier (`TOY_KEY`, `toyNeed`). Twee dezelfde dingen tellen als één.
- **Welk:** het maakt niet uit welke dingen van het lijstje er staan. De verzorger vraagt eerst om het liefste ding, en daarna om 'nog iets anders om mee te spelen' (`alert.fun.more`).
- **Zien wat een dier leuk vindt:** in het menu van een dier staat een rij met alles van zijn lijstje (wat er al staat is groen aangevinkt). Kies je bij Speelgoed een ding, dan staat er een hartje op de knoppen die de dieren in je park nog missen, verschijnt er boven de balk een strookje met de kopjes van de soorten die dat ding leuk vinden, en krijgt elk dier in het verblijf waar je boven hangt een gezichtje: blij (dit wil ik nog), gewoon (leuk, maar ik heb al genoeg) of een streepje (niets voor mij). Bij Natuur werkt het gezichtje net zo (`toyVerdict`, `propVerdict`, `showFaces`).
- **Een ouder spel:** dieren zijn daar eerst niet blij tot er genoeg afwisseling staat; de verzorger zegt het één keer (`say.keys.new`). Een dier wordt er nooit voor opgehaald.

### Natuur: een eigen smaak per soort

Bomen, planten en stenen in een verblijf werden bijna niet gebruikt en elk dier op dezelfde grond wilde hetzelfde. Nu:

- **Smaak per soort** in vier standen per soort natuur (liever niet, een beetje, flink wat, veel): de grond waar het dier van houdt geeft het begin (`WILD_BASE`) en de soort wijkt daarvan af (`WILD_TASTE`). Een giraf wil veel bomen, een konijn en een koe veel planten, een kameel veel stenen en geen groen, een pinguïn alleen stenen.
- **Naar de grootte van het verblijf:** elke stand is een aantal stuks per tegel land, van minstens tot hooguit (`WILD_LEVEL`, `wildRange`). De standen overlappen een stukje, zodat vriendjes met een andere smaak samen kunnen wonen (een test loopt alle paren van `PALS` na).
- **De dieren gebruiken het:** een blij dier loopt af en toe naar een boom en schurkt ertegen, snuffelt en knabbelt aan een plant (die wiebelt), of gaat op een steen staan uitkijken (`goWild` in `animal.ts`).
- **Een ouder spel:** de tuinman past het groen en de stenen in elk verblijf één keer gratis aan de nieuwe smaak aan (`tuneWild`).

### Wat een dier het eerst wil

Elk dier liet zijn wensen in dezelfde volgorde zien: eerst eten, dan de slaapplek, dan de grond, dan spelen. Vanaf de savanne (level 11, `FEATURE.moods`) kiest elk dier zelf wat het vandaag het belangrijkst vindt: het heeft een eigen getal (`seed`, wordt bewaard) en schudt elke dag in het spel zijn lijstje opnieuw (`wishOrder`). Ziek zijn, een open hek en bang zijn gaan altijd voor. Twee dieren in hetzelfde verblijf vragen dus niet meer om hetzelfde, en het menu van een dier laat zijn wensen in zijn eigen volgorde zien. Op de boerderij blijft de volgorde vast, zodat de eerste levels uitleggen wat een dier nodig heeft.

### Gevarieerdere levels

Zie de tabel bij Levels. Nieuw zijn vier soorten doelen (`levels.ts`): twee vriendjes samen blij in één verblijf (`together`), een jong bij een bepaalde soort (`young`), zoveel soorten speelgoed in je verblijven (`toys`) en zoveel blije dieren uit één wereld (`happyworld`). Het aantal blije dieren van de nieuwe soort wisselt van twee tot vijf en volgt de groepsgrootte van de soort.

### Tijd

De dag duurt zeven en een halve minuut in plaats van tien, zodat de nacht vaker langskomt (`DAY_SECONDS`). Een seizoen duurt drie dagen in plaats van één (`SEASON_DAYS`).

Een kortere dag betekent ook minder uren met gasten, en afval komt alleen van gasten die iets gekocht hebben. Vraagt een level om afval op te rapen, dan gaat het daarom nu sneller: de gasten krijgen drie keer zo snel trek in eten, drinken en ijs (`craving` in `game.ts`, net als bij een level dat om verkopen vraagt), ook een ballon, hoedje of knuffel geeft een papiertje, en driekwart van de gasten laat het vallen in plaats van bijna de helft (`SLOPPY` in `people.ts`). Zonder die aanpassing wachtte de proefspeler-als-kind bij level 46 soms langer dan een kwartier op tien stukjes afval: na een nacht duurt het lang voor de gasten weer trek hebben.

### De dierenshow

- **Meer sterren:** naast dolfijnen, orka's en zeehonden geven nu ook olifanten, apen, papegaaien, pinguïns en otters een show (`SHOW_STARS`). De tribune mag tegen elk soort hek staan; een bak van glas gaat voor.
- **Een trainer** staat op een rond podium aan de kant van het verblijf (`showtime.ts`), zolang het park open is en er dieren voor een show zijn. Bij de bel zwaait hij naar het publiek; bij elk kunstje geeft hij een sein (armen omhoog, wijzen, een hapje gooien, buigen).
- **Een programma** van tien kunstjes in 28 tellen (`SHOW_ROUTINE`): allemaal springen, één dier een rondje, één dier met het speelgoed (de hoepel, de bal of iets van zijn lijstje), klappen of het eigen kunstje van de soort (de olifant spuit, de aap springt en zwaait), een hapje vangen dat de trainer gooit, nog een rondje, een solosprong, nog een hapje, buigen, en een finale waarin iedereen springt met confetti. Wie niet aan de beurt is, kijkt naar het publiek.
- **Na afloop** buigt de trainer en juichen de gasten.

### De loopstand

- **Eten en drinken gaat vanzelf en je ziet het:** wat je koopt, eet of drink je vanzelf op, hapje voor hapje (het eerste na ruim een tel, daarna om de drie en een halve tel; tikken mag ook nog). Je hand gaat naar je mond, je hapt twee keer met kruimels, likt aan het ijsje of kantelt het bekertje naar je toe, je hoofd knikt mee en je kauwt nog even na. Een hoed zet je vanzelf op (`held.ts`: `eatPose`, `usesItself`).
- **Ergens in gaan zitten:** tik een tribune of attractie aan en je zit erin; je ogen volgen de stoel (`WalkSeat` in `walkmode.ts`). Rondkijken kan nog steeds. Uitstappen doe je met de ronde knop onderin (een deur met een pijl), door even vooruit of achteruit te duwen, of door terug naar boven te gaan.
- **Naar de show kijken:** op de tribune zit je op het bovenste bankje, met je gezicht naar het verblijf. Is er geen show bezig, dan begint er zo een (als de dieren kunnen).
- **Het treintje:** tik een halte aan. Je wacht op het pad bij de halte tot de trein er stilstaat (een klokje laat zien dat hij nog komt), stapt in en rijdt mee zolang je wilt; je zit iets hoger dan de gasten, zodat je over het dak van de locomotief kijkt. Uitstappen zet je bij de halte waar de trein het dichtst bij is (`Train.walkerOn`, `seatPos`, `nearestStation`).
- **De kabelbaan:** tik een huisje aan. Je neemt het eerste vrije stoeltje dat langs het wiel komt, zweeft naar het andere huisje en stapt daar vanzelf uit (`CableCar.walker`). Is de kabelbaan dicht of rijdt er geen trein, dan zie je een kruisje.
- **Attracties en speeltoestellen:** tik er een aan en je maakt hetzelfde bezoek als een gast, door je eigen ogen (`Game.walkVisit`, met `planVisit` en `visitPose` uit `rides.ts`): de trap van de glijbaan op en naar beneden, schommelen, wippen, de wipkip, springen op de trampoline, de trap van de uitkijktoren op, een rondje op een paard van de draaimolen, in een botsauto en in een bakje van het reuzenrad tot ruim zeven tegels boven het park. Je zitje is bezet voor de gasten en het toestel gaat voor jou ook voluit (`GuestManager.walker`). Draait de draaimolen al, rijden de botsauto's of zit alles vol, dan wacht je waar je staat op je beurt (een klokje). Na afloop sta je weer waar je instapte. In het restaurant ga je aan een tafel op het terras zitten en krijg je daar iets te eten of te drinken (één munt), dat je vanzelf opeet. Bij de fontein valt niets in te stappen.

### De kabelbaan: alle kanten op, met tussenpalen

De kabel hoeft niet meer langs het raster en mag zo lang worden als je wilt (`cable.ts`).

- **Een rij punten:** een kabelbaan is een huisje, één of meer tussenpalen en weer een huisje (sinds 28 november hoort er altijd minstens één paal tussen; kabels zonder paal uit een ouder spel blijven hangen). Elk stuk is hooguit 14 tegels; twee palen staan minstens 2 tegels uit elkaar en een paal minstens 4 tegels van een huisje (de kabel moet eerst omhoog). Bij een paal of tussenstation draait de kabel hooguit 100 graden. De totale lengte is vrij; er hangen hooguit 24 stoeltjes aan een kabel.
- **Bouwen:** zet het eerste huisje. Zodra er een huisje staat, staat naast Kabelbaan de knop Tussenpaal (3 munten; de bouwer legt hem één keer uit), en na een huisje dat op zijn maatje wacht staat die knop meteen aan. Zet je het tweede huisje zonder paal ertussen, dan past het nergens: de bouwer zegt dat er eerst een paal moet komen (`say.cable.needpole`) en zet de knop Tussenpaal aan. De paal komt midden op de tegel onder je vinger en de knop blijft aan. Je ziet een lijn vanaf het laatste punt naar je vinger: groen als het past, rood als het niet past. Palen in aanbouw staan er al, met een geel stippellijntje vanaf het huisje. Het eindhuisje maakt de kabel af. Een eerste paal binnen bereik van een eindhuisje maakt daar een tussenstation van; een nieuw huisje zonder paal begint een eigen kabelbaan.
- **Waar een paal mag:** net als een lantaarn langs het pad: op een tegel naast een pad (ook schuin ernaast), niet op het pad zelf en nooit in een verblijf. Ook niet op een tegel waar iets staat, niet in het water, niet onder een boom of op een rots en niet in de ingang. Op de tegel van een paal mag daarna niets anders. Zet je hem toch in een verblijf of ver van een pad, dan zegt de bouwer dat (`say.cable.path`). Palen die al in een verblijf stonden (uit een ouder spel), blijven staan.
- **Het beeld:** bij een tussenpaal gaat elke kabel met een boog om een eigen liggend rood wiel; de stoeltjes hangen er naar buiten. Er komen geen palen meer vanzelf onder de kabel (tot 28 november stonden ze er wel, ook midden op paden): alleen de tussenpalen die je zelf neerzet staan er. Een huisje laat de hoekpaal weg waar de stoeltjes schuin naar buiten gaan.
- **Weghalen:** de gum op een paal haalt alleen die paal weg als de kabel dan nog klopt (anders een kruisje, en de bouwer zegt waarom). De laatste paal van een kabel die af is, blijft staan. Een huisje weghalen haalt zijn kabels en hun palen weg; van elke paal krijg je 1 munt terug.
- **Bewaren:** naast `link` en `link2` van een huisje staan nu `via` en `via2`: de tegels van de palen ten opzichte van het huisje dat de kabel begon.
- **Nog niet:** een paal invoegen in een kabel die af is, of twee bestaande huisjes alsnog verbinden. Kabels houden geen rekening met hoge dingen (een toren, het reuzenrad) of met elkaar.

### Het treintje rijdt over rails

- **Rails** zijn een nieuwe grondsoort bij Grond, tussen de paden, vanaf het level van de treinhalte (level 28). Je sleept ze zoals een pad en ze zijn gratis. Rails mogen niet in een verblijf, in het water, op een brug of waar iets staat, en op rails kun je niets bouwen of neerzetten; waar het niet kan, kleurt de tegel rood. De gum haalt een stuk spoor weg.
- **Het spoor sluit vanzelf aan** (`rails.ts`, met tests): recht, bocht, wissel, kruising (twee rechte sporen over elkaar; afslaan kan daar niet, zodat een acht werkt) en een eindje met een rood-wit stootblok. Een hek of poort dwars over het spoor breekt het.
- **Een overweg komt vanzelf:** rails over een pad, of een pad over rails, wordt een overweg. Het pad houdt zijn eigen soort (kiezels, klinkers, marmer). Er liggen planken tussen de rails, en aan elke kant waar het pad erop komt staat een paal met een andreaskruis, twee rode lampen en een rood-witte spoorboom. Gum je het spoor weg, dan ligt het oude pad er weer.
- **Spoorbomen:** 3,5 tegel voor de trein uit, en vlak voor het vertrek uit een halte, gaat de overweg dicht: de bomen zakken, de lampen knipperen om de beurt en de bel rinkelt. Gasten, werkers en de clown van de optocht wachten voor de boom; wie al op de overweg loopt, loopt eerst door. Na de laatste wagon gaan de bomen omhoog. Niemand blijft op een overweg staan (geen kijkplek, geen rij, geen feestje, geen zoekende gast).
- **Treinen:** elk spoor (alles wat aan elkaar vastzit) met minstens één halte ertegenaan krijgt één treintje, hooguit drie in het park, elk met eigen kleuren. Een rondje rijdt hij steeds rond; een lijn heen en weer, met een locomotief aan beide kanten. De route gaat langs de meeste haltes; zijtakken daarbuiten slaat hij over (een wissel neemt hij nooit zelf). Op een kort spoor rijdt een kortere trein: hooguit drie wagons met elk drie plekken; het kleinste rondje is 2 bij 2 tegels, de kortste lijn 5 tegels.
- **Rijden:** de trein trekt rustig op, remt af voor een halte en volgt de bochten. Hij stopt met het midden van de wagons voor de halte, en als het kan niet op een overweg. Draaiende wielen, stoomwolkjes, een koplamp die 's avonds licht geeft.
- **Haltes:** een halte werkt als er rails tegen een van zijn kanten liggen en er een pad bij ligt; hij draait zijn perron vanzelf naar het spoor. Zonder spoor hangt er een bordje met rails en een kruisje boven, en legt de bouwer het één keer uit. Gasten wachten op het perron, stappen in en bij de volgende halte waar ze het pad op kunnen weer uit; met één halte maken ze een ritje en stappen ze bij dezelfde halte uit.
- **'s Nachts** (0 tot 7 uur, als het park dicht is) slaapt de trein bij de halte waar hij aankomt: geen stoom, de koplamp uit, de overwegen open. Een trein die je 's nachts aanlegt, rijdt eerst nog naar de volgende halte.
- **Een ouder spel** met haltes maar zonder rails: er rijdt geen trein, de haltes krijgen het bordje en de bouwer zegt één keer dat het treintje nu over rails rijdt (`say.train.old`). Opslaan: twee nieuwe grondsoorten achteraan in `TERRAINS` en een veld `cross` (het soort pad onder elke overweg).
- **Nog niet af of zwak:** de bel van de overweg en het geratel bij het vertrek zijn bestaande geluiden van de weg buiten het park (de fietsbel, langzamer, en een auto); een eigen bel en treingeluid zijn nog te maken. Een vierde spoor krijgt geen trein, zonder uitleg waarom. Haal je de tegel onder de trein weg, dan springt hij naar zijn eerste halte. Rails kunnen in een verblijf terechtkomen als je er later een hek omheen zet. Ontsnapte dieren en de loper in de loopstand letten niet op de trein. Een slapende trein laat geen zzz zien.

### Attracties in allerlei maten

Alle attracties en speeltoestellen zijn opnieuw gemodelleerd, en bijna geen is nog 2 bij 2. De maten, de zitjes en het hele bezoek van een gast (lopen, wachten, instappen, het ritje, uitstappen) staan in `rides.ts`, met tests; het beeld en de gasten rekenen met dezelfde getallen, dus de gasten zitten er precies op.

| Wat | Maat | Prijs | Wat je ziet |
|---|---|---|---|
| Reuzenrad | 8 bij 2 | 90 | Een rad met een straal van 3,4 tegels (de top bijna acht tegels hoog), twaalf bakjes voor twee die rechtop blijven en licht slingeren, een perron met een trapje, een kaartjeshuisje en lampjes die rondlopen. Het draait altijd door; een gast wacht tot zijn bakje onderin is, maakt één rondje en stapt weer uit. |
| Botsauto's | 4 bij 3 | 50 | Een hal met een glazen dak en zes auto's die echt sturen, botsen en terugstuiten. In ritjes: vijf en een halve tel stilstaan om in te stappen, dan elf tellen rijden; bij een harde klap springt er een vonk van de spriet. |
| Draaimolen | 3 bij 3 | 60 | Negen paarden in twee ringen gaan op en neer onder een groot gestreept dak met looplicht. In ritjes: vijf tellen stilstaan om in te stappen, dan ruim elf tellen draaien; wie komt terwijl hij draait, wacht in de rij. |
| Fontein | 3 bij 3 | 30 | Een groot bassin met twee schalen, acht stralen in een kring en één in het midden, in een waterballet van 24 tellen; 's nachts gloeit er een lampje onder elke straal. Acht gasten staan eromheen te kijken. |
| Restaurant | 3 bij 2 | 30 | Een keuken met een kok achter het luik en een terras met vier tafels, parasols en lantaarns (acht gasten tegelijk). |
| Uitkijktoren | 2 bij 2 | 25 | 2,7 tegels hoog, met een trap die je ziet: vier stukken langs de vier kanten. Gasten klimmen echt naar boven (vijf plekken aan het hek), kijken rond en lopen weer naar beneden. |
| Glijbaan | 2 bij 3 | 6 | Een torentje met een dak, een trap met leuningen en een lange gele baan. |
| Schommel | 2 bij 1 | 5 | Twee zitjes die los van elkaar zwaaien. |
| Wipwap | 2 bij 1 | 4 | Een plank met zitjes en handvatten. |
| Wipkip | 1 bij 1 | 3 | Een kip, een paardje of een kikker op een veer (welke hangt af van de plek). |
| Trampoline | 2 bij 2 | 8 | Je klimt erop langs een trapje. |
| Klimkasteel | 10 bij 3 | 20 | Vier torentjes met gekleurde daken, een wiebelbrug, een kruiptunnel, een evenwichtsbalk, een klimnet en een glijbaan (zie 'Het klimkasteel'). |

De wc en de schuilhut zijn niet veranderd (2 bij 2). Leeg bewegen de toestellen een beetje, met gasten flink; 's nachts gloeien de lampjes, en het rad en de toren hebben een eigen gloed in de hoogte.

- **Plaatsen:** een gebouw mag elke maat hebben (`SHOP_SIZE` is de breedte langs de voorkant, `SHOP_DEEP` de diepte) en draait met de draaiknop mee (`shopSpan`); een niet-vierkant gebouw draait uit zichzelf alleen een halve slag. Het past niet over een hek, bankje of paal op een rand binnen zijn blok. Op een hoog toestel kun je ook tikken waar het boven zijn eigen tegels uitsteekt (het rad zelf).
- **Instappen:** gasten stappen kort na elkaar in en uit. Ligt het pad opzij of achter een groot toestel, dan lopen ze buitenom naar de ingang.
- **Een ouder spel** (het opslagbestand is nu versie 5): een gebouw dat een andere maat kreeg, zoekt bij het laden de dichtstbijzijnde plek waar het past, het liefst aan het pad en met de voorkant ernaartoe: hooguit acht tegels verderop, of vier als die plek los van het pad ligt. Lukt dat niet, dan krijg je de volle prijs terug en zegt de bouwer één keer dat je het opnieuw kunt neerzetten (`say.rides.bigger`). Wat niet in de kas van 99 past, komt terug doordat de gasten een poos vaker kopen.
- **Nog niet af of zwak:** de stand van een toestel wordt niet bewaard (na het laden begint elk toestel in rust). Bij een volle draaimolen of botsautohal is het bij de ingang nog druk als de ene groep eraf gaat en de volgende erop. Gasten wijken niet voor elkaar uit op de vloer en op de trap van de toren. Wie haast heeft, loopt twee keer zo snel met gewone stapjes. De plaatjes op de knoppen zijn nog de oude tekeningen.

### Puzzeltjes met plaatjes

De puzzeltjes bij de evenementen waren vooral cijfers. Nu zijn er dertien soorten, bijna allemaal met plaatjes (`minigame.ts`, `miniask.ts`):

- **Nieuw:** tellen (tik de dingen aan om mee te tellen), waar zijn de meeste, memory, wat hoort er niet bij, wat komt er daarna, van welk dier is deze schaduw, wat eet dit dier, wie slaapt hier, en welk dier maakt dit geluid.
- **Vernieuwd:** een som staat er nu met stapeltjes dingen die je kunt tellen (appels, munten, kisten, dieren uit het park), en op volgorde zetten gaat met groepjes plaatjes.
- **Afwisseling:** elk evenement en elke vraag van de klas kiest uit een paar puzzeltjes die erbij passen, en loopt die eerst allemaal langs voor er een terugkomt. De klas kan nu ook een dierenquiz of een spelletje vragen.
- Uitproberen kan los van het spel op `minispel.html`.

### De dokter: zeven spelletjes

Een ziek dier beter maken is nu een bezoek van twee of drie kleine spelletjes, elke keer andere (`vetgame.ts`, `vetplan.ts`): koorts meten (je vinger op het dier houden tot de thermometer vol is), pleisters plakken op de zere plekken, het hart zoeken met de stethoscoop (hoe dichterbij, hoe harder het klopt), een doorn eruit trekken, de lepel kiezen met de kleur van het flesje, vieze plekjes wegvegen met een watje, en tanden poetsen. De patiënt is het plaatje van het dier zelf: grijs en sip, na elk spelletje met meer kleur, en aan het eind springt het op tussen de hartjes. Fout gaan kan niet; een handje doet voor wat je moet doen. Wegklikken laat het dier ziek. De dierenarts (personeel) maakt een dier nog steeds zonder spelletje beter.

### Hekken maken met een spelletje

- **Elk soort hek slijt nu:** naast hout ook het witte hekje, de stenen muur, het hoge net en het glas, elk in drie fases met een eigen uiterlijk (latjes die omvallen; scheuren en dan stenen eruit; een net dat doorhangt en dan scheurt; een barst die groeit tot een gat, met druppels als er water achter staat). Het tempo is hetzelfde gebleven: hooguit vier tegelijk, ongeveer één stap per minuut, alleen om verblijven met dieren (`wear.ts`). Poorten en de kijkruit slijten niet.
- **Maken:** een tik met de hamer op een licht versleten hek (fase 1) maakt het meteen: zo blijft het klusje kort, en het spelletje bijzonder. Bij een los of kapot hek (fase 2 en 3) komt er een kaart met een spelletje dat bij het hek past (`fixgame.ts`), bij een kapot hek met meer werk: spijkers erin timmeren (hout en het witte hekje), stenen terugleggen en de voegen dichtsmeren (steen), het net strak omhoog trekken en de losse eindjes vastknopen (net), de barst dichtlijmen en het glas schoonvegen (glas, met water en een vis erachter als het een bak is). Wegklikken laat het hek zoals het was; slepen met de hamer opent hooguit één kaart. De grens staat in `WEAR.game` (`wear.ts`).
- De klusser (personeel) maakt een hek nog steeds zonder spelletje; het gereedschap dat opzweeft past bij het hek (hamer, troffel, knoop, lijm). Een sterk dier duwt nu ook het witte hekje, een net en glas kapot (een stenen muur niet; terug te draaien in `pushable()` in `wear.ts`). Bouw je een ander soort hek of een poort op de plek van een versleten hek, dan is het weer heel.
- **Eén kaart tegelijk:** zolang er een kaart open is (een puzzeltje, de dokter of een hek maken) staat het park stil, en er komt geen tweede kaart bij (`Game.playing()`, `playcard.ts`).
- **Nog niet:** de hartslag bij de stethoscoop is een nagemaakte trommel (er is geen hartslaggeluid); het lekken van een gebarsten bak is alleen te zien (geen plas, geen invloed op het water).

### Wat de proefspeler liet zien (27 november)

De proefspeler speelt nu ook zonder venster (`node tools/playtest/speel.mjs`), en dan zonder te tekenen: vijftig levels duren zo een paar minuten. Dezelfde proefspeler is losgelaten op het spel van vóór deze ronde en op het spel erna (een paar keer, want de tijden wisselen per keer). In de proeven op de eindstand haalde hij alle 50 levels zonder een dier kwijt te raken.

| Hoe | Vóór deze ronde | Na deze ronde |
|---|---|---|
| Snel en foutloos, de kas wordt bijgevuld als hij leeg is | 57 minuten speltijd, kas 31 keer bijgevuld | 63 minuten, kas 27 tot 32 keer bijgevuld |
| Als een kind: één handeling per 8 tellen, de kas nooit bijgevuld | 72 minuten | 81 tot 86 minuten |
| Als een kind op een trage tablet (daar komen hooguit 45 gasten) | 91 minuten | 87 tot 103 minuten |

Het spel duurt dus een tiende tot een vijfde langer: de levels vragen meer dieren tegelijk en meer soorten doelen, en de dieren willen meer afwisseling in speelgoed en natuur. Aan munten kost het niet meer dan eerst.

Eén ding kwam uit deze proeven: level 46 (tien keer afval oprapen) duurde na deze ronde vaak veel langer dan eerst (vijf tot tien minuten, en vier keer langer dan het kwartier waarna de proefspeler opgeeft), tegen twee minuten ervoor. Afval kwam alleen van gasten die iets gegeten of gedronken hadden, en met een kortere dag en een nacht ertussen kwam dat te weinig voor. Daarom komt afval nu sneller als een level erom vraagt (zie Tijd); in de acht proeven daarna duurde level 46 tussen de halve minuut en de vijf minuten. De tijden per level wisselen hoe dan ook flink per keer (een jong of de ochtend afwachten): level 35 duurde in de proeven tussen ruim een minuut en elf minuten, en vóór deze ronde ook al een keer vijf.

Zonder beeldkaart meet het spel zichzelf als een traag apparaat; de proefspeler zet daarom zelf vast hoe snel het apparaat is (`speed` in `kijk.mjs`).

## De grote attracties van het eind (28 november 2026)

Na het reuzenrad (level 36) kwam er niets groots meer bij. Nu komt er van level 37 tot en met 50 om het level iets bij dat steeds groter is, en het level erna vraagt dat gasten er ook echt in gaan.

| Level | Wat er vrijkomt | Maat | Prijs |
|---|---|---|---|
| 37 | Zweefmolen, en de suikerspinkraam | 4 bij 4 | 70 (kraam 14) |
| 39 | Schommelschip | 6 bij 2 | 80 |
| 41 | Luchtballon | 3 bij 3 | 75 |
| 43 | Wildwaterbaan | 8 bij 3 | 95 |
| 45 | Safaritrein, met de safaripoort bij Hek | 2 bij 2 | 90 |
| 47 | Glazen tunnel (bij Grond, tussen de paden) | per tegel | gratis |
| 49 | Achtbaan | 8 bij 4 | 99 |
| 50 | Vuurwerk als slot | | |

De kas kan niet voller dan 99 munten (`COIN_CAP`): voor de achtbaan moet hij dus helemaal vol zijn.

### Ritjes met een eigen ronde (`rides.ts`, `LapKind`)

De zweefmolen, het schommelschip, de luchtballon, de wildwaterbaan en de achtbaan werken allemaal hetzelfde. Het toestel staat stil met de deur open tot er iemand komt. Vanaf de eerste gast is er een vaste instaptijd (7 tot 9 tellen: wie later komt, sluit nog aan), dan duurt het ritje een vaste tijd en staat alles weer precies in rust. Zonder gasten begint er geen ritje. Het beeld en de gasten rekenen met dezelfde stand, dus iedereen zit precies op zijn plek.

- **Zweefmolen:** de kap schuift langs de mast omhoog en draait; de acht stoeltjes zwaaien aan hun kettingen steeds verder naar buiten. Gasten laten de benen bungelen, zwaaien als ze vooraan langskomen en steken op volle snelheid de armen omhoog.
- **Schommelschip:** een houten schip met een drakenkop tussen twee hoge poten. Het zwaait in zeven tellen steeds hoger, zes tellen voluit en komt dan uit. Vier banken die naar het midden kijken; wie bovenin komt, gooit de armen omhoog.
- **Luchtballon:** een mand voor vier onder een ballon in zes kleuren. Hij stijgt aan een touw (de brander brandt), blijft negen tellen hangen terwijl hij wat drijft en draait, en zakt dan. Gasten kijken door hun handen, wijzen en zwaaien naar beneden.
- **Wildwaterbaan:** een houten goot met water op palen. Drie boomstammen met elk twee gasten varen het station uit, gaan achterlangs aan de band omhoog, bovenlangs de bocht om en dan steil naar beneden het water in: daar spat het hoog op. De baan staat vast (`FLUME_TRACK`).
- **Achtbaan:** rode rails op witte palen. Drie karretjes voor twee: aan de ketting omhoog, de grote afdaling, een hoge heuvel, een krappe bocht en drie hupjes terug naar het station. De karretjes hangen scheef in de bochten en de gasten gooien de armen omhoog in de afdaling. De baan staat vast (`COASTER_TRACK`); de snelheid op elk punt staat erbij.
- Een baan is een rij punten met een snelheid; `makeTrack` maakt er vloeiende bochten van en rekent uit wanneer het treintje waar is. Een nieuwe baan is dus alleen een nieuw lijstje punten.
- De tests in `rides.test.ts` lopen ook over deze vijf: geen sprongen, niemand buiten zijn tegels, iedereen terug op het pad.

### De suikerspinkraam

Een eigen kraam met een reuzensuikerspin op het dak. Gasten krijgen er apart zin in (kinderen sneller), kopen een roze of blauwe suikerspin en lopen er lang mee rond. In de loopstand kun je er zelf ook een kopen.

### De glazen tunnel

Een nieuw pad (`seatunnel`, achteraan in `TERRAINS`) dat alleen in een bak van glas kan liggen. Hij ligt verzonken: 0,8 tegel onder de grond, met een dak van glas. Het water van de bak staat erboven en de vissen zwemmen er gewoon overheen.

- **Bouwen:** leg de tunnel met Grond dwars door een bak van glas. Waar hij tegen het glas van de bak aan komt en daarbuiten een pad ligt, wordt die padtegel vanzelf een trap naar beneden. Buiten een bak kan hij niet; dan zegt de bouwer waar hij hoort.
- **Lopen:** gasten, werkers en de speler in de loopstand dalen de trap af en lopen onder het water door (`View.sink` geeft de diepte, `setSink` in people.ts). Boven de tunnel is het water helderder, en de tunnel is van binnen verlicht.
- **Dieren:** voor een dier is de tunnel gewoon water. Door de ingang kan geen dier (`Grid.mouthBetween`), dus er ontsnapt niets, en de bak blijft één verblijf (`recompute` telt de ingang als dicht).
- **Het beeld:** in de grond zit een gat (`GROUND_HOLE`); het grote vlak onder het park wordt als eerste getekend, zodat je de tunnel erdoorheen ziet.
- **Nog niet:** een bocht of kruising in de tunnel krijgt wel wanden, maar het dak is per tegel een vlakke ruit. Het wolkje boven een gast in de tunnel hangt te hoog.

### De safaritrein en de safaripoort

- **Het station** (2 bij 2) moet tegen een gewoon verblijf aan staan, met een pad ervoor. Anders past het niet en zegt de bouwer waarom.
- **De jeep** staat in het verblijf, vlak naast het station, met een ranger aan het stuur en drie plekken voor gasten. Na de eerste gast wacht hij nog vijf tellen op meer gasten. Dan rijdt hij een rondje: naar de verste hoek, naar een tweede hoek en terug, om voerbakken, slaapplekken, speelgoed, bomen en water heen, in ronde bochten. De wielen draaien, de bak hobbelt en de ranger stuurt. Dieren waar hij langskomt, kijken op.
- **De safaripoort** (bij Hek, hekje 9) is een dubbele houten poort tussen twee verblijven, met een bord met zebrastrepen. Alleen de jeep kan erdoor. Komt hij eraan, dan zwaaien de twee deuren open, van de jeep af, en gaan de oranje zwaailichten op de palen om de beurt knipperen terwijl hun lichtbundels ronddraaien. Is hij voorbij, dan gaat de poort weer dicht. Zo rijdt hij bijvoorbeeld van de zebra's door naar de leeuwen: alle verblijven die zo aan elkaar zitten doen mee in het rondje. Voor de dieren is het een dicht hek.
- **Niet door een bak van glas.** Het rondje wordt elke tel nagekeken; verandert het verblijf, dan stappen de gasten uit en begint hij opnieuw.
- **Nog niet:** in de loopstand kun je zelf nog niet meerijden. Ontsnapte dieren en de jeep letten niet op elkaar.

### Vuurwerk

Als je een hele wereld af hebt (level 10, 20, 30 en 40) is er twaalf tellen vuurwerk; na level 50 een show van dertig tellen. Vanaf level 31 eindigt ook het avondfeest met vuurwerk. Pijlen stijgen op met een gouden staart en spatten uit elkaar in bollen, ringen, treurwilgen en dubbele bollen; aan het eind vijf tegelijk. Het wordt er even avond bij, ook midden op de dag. Het zijn lichtpuntjes in één wolk (`View.fireworks`), dus het kost weinig.

### Een dubbel hek tussen twee verblijven

Een stuk hek tussen twee verblijven kon maar één soort zijn: steen of hout, steen of net. Leeuwen (steen) naast apen (net) kon daardoor nooit voor allebei kloppen. Nu geldt:

- **Elk verblijf telt zijn eigen buitenhek.** Het hek dat het deelt met een ander verblijf telt niet meer mee voor het soort (`Grid.penKind`). Een verblijf dat helemaal tussen andere verblijven in ligt, neemt wat er staat.
- **Aan elke kant het eigen hek** (`Grid.sharedSide`): een verblijf met een bijzonder hek (steen, net, glas, wit hekje) heeft dat ook aan zijn kant van het gedeelde hek. Een verblijf met een gewoon houten hek neemt wat er gezet is. Zijn de twee kanten verschillend, dan tekent het beeld een dubbel hek: elk een stukje naar zijn eigen verblijf geschoven (`DOUBLE_FENCE`).
- Een poort, kijkvenster of safaripoort in een gedeeld hek blijft enkel. Slijtage hoort bij het hek dat er echt gezet is.
- **Nog niet:** een dier dat het gedeelde hek omduwt, gooit het hele stuk om, ook de kant van de buren.

Het plaatje "het hok is te klein" heeft nu rode pijlen en een rode stippellijn in plaats van groene: groen leek op "goed zo".

### Twee nieuwe soorten doelen

- **`rode`:** zoveel gasten hebben in dit level een ritje gemaakt in een attractie. Het spel telt het als een gast uitstapt.
- **`tunnel`:** zoveel tegels glazen tunnel.

### Geluid

De nieuwe geluiden staan in `tools/voice/sounds.json` en zijn in het spel aangesloten, maar nog niet gemaakt: een bel bij het vertrek van een ritje, het draaiorgeltje van de zweefmolen, het zoeven van het schip, de brander van de ballon, de ketting, het razen van de achtbaan, de grote plons, de toeter en de motor van de jeep, bubbels in de tunnel en drie geluiden voor het vuurwerk. Ook de nieuwe zinnen van de figuren zijn nog niet ingesproken. Zet de sleutel in `.env` en draai `node tools/voice/build.mjs all`. Zolang een geluid er niet is, blijft het stil; er gaat niets stuk.

### De proefspeler

De proefspeler bouwt vaste verblijven van 3 bij 3. Sinds grote dieren elk apart ruimte tellen, passen die daar niet meer blij in. Hij zet de ruimte-eis daarom laag (`data.SPACE`, bovenaan `autoplay.js`): of een speler genoeg ruimte kan maken, test hij dus niet. Voor de zweefmolen en de achtbaan koopt hij de strook achter het park, en voor de safaritrein en de tunnel de strook rechts.

### Meldingen terugzien, twee rijen knoppen en meer (27 november, avond)

- **Meldingen terugzien:** rechtsboven, naast de knop voor het geluid, staat een knop met een praatwolkje. Een rood tellertje zegt hoeveel meldingen er sinds de laatste keer kijken bij zijn gekomen. Een tik opent een venster met de laatste dertig meldingen, de nieuwste bovenaan: het figuur, wie het is, hoe lang geleden en de zin. Een zorgelijke melding is oranje, een dringende rood. Tik op een melding en je hoort hem opnieuw (met de stem als die er is); gaat hij over een plek, dan staat er een richtpuntje bij en schuift het beeld erheen. Dezelfde zin vlak achter elkaar staat er maar één keer in. Ernaast tikken of het kruisje doet het venster dicht (`hud.ts`, `remember`, `fillInbox`).
- **Twee rijen:** heeft een keuzerij twaalf knoppen of meer (alle speelgoed, alle winkels), of past hij niet op het scherm, dan staan de knoppen in twee rijen onder elkaar: de eerste helft boven. Past ook dat niet, dan schuif je het geheel opzij (`setTools`, `#options .row.two`).
- **Kabelbaanpalen langs het pad:** zie 'De kabelbaan: alle kanten op, met tussenpalen'.
- **Grote dieren willen echt ruimte:** zie 'Ruimte en groepen'. Drie olifanten passen niet meer blij in een verblijf van 3 bij 3.
- **Attracties bewegen alleen met gasten:** het reuzenrad draait zodra er een gast op of naartoe gaat (meteen op snelheid, want hij stapt in als zijn bakje langs het perron komt) en draait leeg in een paar tellen uit. De draaimolen draait alleen met iemand erop, lege botsauto's staan stil, lege schommels, wipwap, wipkip en trampoline bewegen niet, en de stoeltjes van de kabelbaan lopen alleen als er iemand in zit of in een huisje staat te wachten. Het treintje rijdt zijn rondjes zoals eerst. De fontein spuit overdag gewoon door: daar kijk je naar, je zit er niet in.
- **'s Nachts stil:** als het park dicht is (0 tot 7 uur) en er niemand meer op zit, zakt de fontein in acht tellen helemaal in (`RIDE_WAKE`), en om zeven uur komt hij net zo rustig weer op. De andere attracties staan dan al stil omdat er niemand is, de kabelbaan en de trein slapen zoals eerst.
- **Wat de gasten missen:** in het overzicht bij de poort staat een vak met wat de gasten die nu in het park zijn missen, het meest gemiste bovenaan (hooguit zes): het plaatje van wat ze willen, hoeveel gasten, en een label. Oranje "erbij bouwen": er is nog geen kraam of gebouw voor. Blauw "niet te koop": de kraam is er wel, maar verkoopt dit niet. Rood "te druk": er staat een rij, er moet er een bij.
- **Nog niet:** de nieuwe zin van de bouwer over de paal (`say.cable.path`) is nog niet ingesproken; tot dan praat hij op het klokje. Draai `node tools/voice/build.mjs all`.

### Het klimkasteel (27 november)

Een groot klimtoestel voor de kleintjes, bij Attracties in de groep Speeltuin: 10 bij 3 tegels, 20 munten, vanaf level 27 (na 26 gehaalde levels, `FEATURE.climber`). Tien kinderen kunnen er tegelijk op.

- **Hoe het eruitziet:** vier houten torentjes op een rij, elk met een eigen dak (rood, blauw, geel en groen; de gele toren in het midden is de grootste, met een vlag). Vooraan bij de eerste toren een ladder, tussen toren 1 en 2 een wiebelbrug van planken aan touwen, tussen toren 2 en 3 een kruiptunnel van groene ringen om een doorzichtige buis, tussen toren 3 en 4 een evenwichtsbalk met een touw, en aan toren 4 een gele glijbaan. Verder een rood klimnet tegen de grote toren, een klimmuur met gekleurde knoppen achter toren 2, een brandweerpaal, een stuurwiel en een verrekijker.
- **Wat een kind doet:** de ladder op, over de wiebelbrug (de handen aan de touwen), door de tunnel kruipen, boven op de grote toren even rondkijken (aan het stuurwiel draaien, zwaaien naar de mensen op het pad, of door de handen kijken als een verrekijker), voorzichtig over de balk met de armen wijd opzij, en joehoe de glijbaan af. Daarna loopt het vooraan terug naar het pad.
- **Om de beurt:** de kinderen beginnen anderhalve tel na elkaar aan de ladder. Wie moet wachten, staat in een rijtje vooraan rechts van de ladder en schuift op. Zo staan er nooit twee op dezelfde sport en lopen ze netjes achter elkaar het parcours af.
- **Bewegen:** de wiebelbrug zwaait opzij (met kinderen erop flink, leeg een heel klein beetje), het stuurwiel draait heen en weer als er kinderen zijn, en de vlag wappert altijd.
- **Code:** het bezoek staat in `rides.ts` (`CLIMBER`, `climberPlan`, `climberPose`, met eigen tests in `rides.test.ts`), het model in `view.ts` (`SHOP_PARTS.climber`, `RIDE_BUILD.climber`), armen en benen in `people.ts` (`CLIMB_DO`). Het icoon heet `climber`.
- **Meer ideeën** voor de speeltuin staan onderaan `docs/IDEEEN.md`.

## Bekende zwakke punten van de modellen

De modellen zijn op stilstaande beelden bekeken en doorgemeten (niets zakt meer dan een centimeter door de grond), maar geen enkele animatie is in beweging beoordeeld. Wat de modelbouwers zelf als zwak aanmerkten:

- **Alle dieren:** een poot is één bot zonder knie. Zitten en liggen gaat door de poten in de romp te schuiven; bij lange poten (giraf, struisvogel, flamingo) steken ze dan recht naar voren. Voor- en achterpoten zijn even lang, dus gorilla, luiaard en konijn hebben geen echt langere armen of kortere voorpoten.
- **Man en vrouw:** bij panda, gorilla, bever, maki en rode panda verschillen ze alleen in grootte of tint.
- **Krokodil:** de bek kan niet open.
- **Walrus:** de slagtanden raken eerst de grond, dus bij eten blijft de bek boven het voer.
- **Jak en schildpad:** zitten lijkt bijna op staan.
- **Otter:** het minst herkenbaar van allemaal; het kopplaatje kan voor een beer doorgaan.
- **Pauw:** de waaier staat altijd open, ook bij lopen en slapen.
- **Pinguïn en uil:** eten door voorover op de borst te kiepen.
- **Kangoeroe:** ligt op zijn zij; het jong in de buidel is erg klein.
- **Vogels:** zeven soorten slapen met de kop naar achteren gedraaid; de overgang van liggen naar slapen kan daardoor een rare draai geven.
- **Maki:** het wolkje zweeft boven de punt van de staart, omdat de hoogte van het model de staart meetelt.
- **Poep:** valt bij dieren met een lange of platte staart (otter, bever, rode panda, krokodil) onder de staart.

## Onderhoud

- Dier toevoegen of aanpassen: `tools/animals/packs/*.py`, exporteren met Blender, daarna `node tools/animals/optimize.mjs`.
- Level, prijs of wens aanpassen: `games/zoo/src/data.ts`. Tekst: `games/zoo/src/nl.json` en `en.json`, daarna het stemmenscript.
- Proefspeler: `tools/playtest/autoplay.js` speelt alle levels achter elkaar en meet de tijd per level. Zonder venster: `node tools/playtest/speel.mjs 50` (snel) of `node tools/playtest/speel.mjs 50 8` (als een kind). Iets nalopen of een foto maken zonder venster: `tools/playtest/kijk.mjs`.

## Nog te beslissen

- De naam van het spel.
- Of de gekozen stemmen bevallen (beluisteren op `figuren.html`).
- Of er naast het achtergrondgeluid ook muziek komt.
- Hoe streng verwaarlozing moet zijn voor de jongste spelers.
