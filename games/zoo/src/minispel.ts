// Ontwikkelpagina (minispel.html): de puzzeltjes uit minigame.ts, de spelletjes van de dokter (vetgame.ts) en het
// maken van een hek (fixgame.ts) los van het spel uitproberen. Alleen te zien met `npm run dev`; de pagina zit niet in
// het gepubliceerde spel.
//
// In de adresbalk: ?taal=en voor de Engelse teksten en woorden.
import { setStrings } from '@smj/shared';
import { animalSound, loadAudio, unlockAudio } from './audio';
import { SPECIES } from './data';
import en from './en.json';
import { playFix } from './fixgame';
import { CLUES, guessChoices } from './guestfun';
import { icon, type IconId } from './icons';
import { MINI_KINDS, closeMini, miniOpen, playMini, type MiniKind, type MiniOptions, type MiniResult } from './minigame';
import { probeIcons, speciesIcon } from './models';
import nl from './nl.json';
import { cardOpen } from './playcard';
import './style.css';
import { playVet } from './vetgame';
import { VET_GAMES, type VetGame } from './vetplan';
import { MENDS, type Mend } from './wear';

const lang = new URLSearchParams(location.search).get('taal') === 'en' ? 'en' : 'nl';
setStrings(lang === 'en' ? { ...nl, ...en } : nl);
document.documentElement.lang = lang;

const $ = (id: string): HTMLElement => document.getElementById(id)!;
const LABELS: Record<MiniKind, string> = {
  sum: 'Som', count: 'Tellen', more: 'De meeste', spell: 'Woord', order: 'Volgorde', memory: 'Memory', odd: 'Hoort er niet bij', pattern: 'Rijtje',
  shadow: 'Schaduw', eat: 'Wat eet het', bed: 'Wie slaapt hier', sound: 'Geluid', guess: 'Raden',
};
/** De plaatjes van een evenement, om te zien hoe een puzzel er dan uitziet ('' is: de gewone dingen). */
const THEMES: Record<string, IconId[]> = {
  '': [],
  voer: ['crate', 'hay', 'fruit', 'veg', 'fish'],
  kassa: ['coin'],
  feest: ['balloon_red', 'cake', 'hat_party', 'balloon_blue', 'gift'],
  bouwen: ['log', 'nail', 'wallbrick', 'hammer', 'trowel'],
  klas: ['guest'],
};
/** Een park met deze dieren erin: daar gaan de vragen over dieren het liefst over. */
const PARK = ['pig', 'cow', 'chicken', 'lion', 'giraffe', 'penguin', 'dolphin', 'parrot'] as const;
const lines: string[] = [];

function note(text: string): void {
  lines.unshift(text);
  $('uitslag').textContent = lines.slice(0, 8).join('\n');
}

function report(kind: MiniKind, r: MiniResult): void {
  note(`${kind}: ${JSON.stringify(r)}  (open: ${miniOpen()})`);
}

function start(kind: MiniKind): void {
  const theme = THEMES[($('plaatjes') as HTMLSelectElement).value] ?? [];
  playMini({
    kind,
    rounds: Number(($('rondes') as HTMLSelectElement).value) || undefined,
    picture: ($('plaatje') as HTMLInputElement).checked ? icon(kind === 'guess' ? 'guess' : 'schoolclass') : undefined,
    things: theme.length ? theme : undefined,
    animals: ($('dieren') as HTMLInputElement).checked,
    park: ($('park') as HTMLInputElement).checked ? [...PARK] : undefined,
    sound: ($('geluid') as HTMLInputElement).checked ? sp => animalSound(sp, false) : undefined,
    guess: kind === 'guess' ? guessFor(PARK[Math.floor(Math.random() * PARK.length)]) : undefined,
    onDone: r => report(kind, r),
  });
}

function guessFor(answer: (typeof PARK)[number]): MiniOptions['guess'] {
  return { answer, options: guessChoices(answer, [...PARK]) ?? [answer], ...CLUES[answer], sound: () => animalSound(answer, false) };
}

for (const kind of MINI_KINDS) {
  const b = document.createElement('button');
  b.textContent = LABELS[kind];
  b.dataset.kind = kind;
  b.addEventListener('click', () => start(kind));
  $('knoppen').append(b);
}
for (const name of Object.keys(THEMES)) {
  const o = document.createElement('option');
  o.value = name;
  o.textContent = name || 'gewoon';
  $('plaatjes').append(o);
}
// om te zien dat een open puzzeltje netjes dichtgaat: na vier tellen komt er vanzelf een ander, na acht gaat alles dicht
const swap = document.createElement('button');
swap.textContent = 'Som, dan vanzelf Woord, dan dicht';
swap.addEventListener('click', () => {
  start('sum');
  setTimeout(() => start('spell'), 4000);
  setTimeout(closeMini, 8000);
});
$('knoppen').append(swap);

// de dokter: een heel bezoek (twee of drie spelletjes, zoals in het spel), of één spelletje apart
const VET_LABELS: Record<VetGame, string> = { thermo: 'Koorts', plaster: 'Pleisters', stetho: 'Hart', thorn: 'Doorn', syrup: 'Drankje', cotton: 'Watje', teeth: 'Tanden' };
function vet(games?: VetGame[]): void {
  const sp = ($('patient') as HTMLSelectElement).value || PARK[Math.floor(Math.random() * PARK.length)];
  playVet({ picture: speciesIcon(sp), games, voice: () => animalSound(sp, false), onDone: cured => note(`dokter ${games?.join('+') ?? 'bezoek'} (${sp}): ${cured ? 'beter' : 'weggeklikt'}  (open: ${cardOpen()})`) });
}
for (const [label, games] of [['Bezoek', undefined], ...VET_GAMES.map(g => [VET_LABELS[g], [g]])] as [string, VetGame[] | undefined][]) {
  const b = document.createElement('button');
  b.textContent = label;
  b.dataset.vet = games?.[0] ?? 'visit';
  b.addEventListener('click', () => vet(games));
  $('dokter').append(b);
}
for (const sp of ['', ...Object.keys(SPECIES)]) {
  const o = document.createElement('option');
  o.value = sp;
  o.textContent = sp || 'een dier uit het park';
  $('patient').append(o);
}

// een hek maken: elk soort hek, los (fase 2) en kapot (fase 3); en licht versleten om te zien dat het spelletje dat ook kan
const FIX_LABELS: Record<Mend, string> = { wood: 'Hout', stone: 'Steen', net: 'Net', glass: 'Glas' };
for (const mend of MENDS)
  for (const phase of [1, 2, 3]) {
    const b = document.createElement('button');
    b.textContent = `${FIX_LABELS[mend]} ${phase}`;
    b.dataset.fix = `${mend}${phase}`;
    b.addEventListener('click', () => {
      const color = ($('kleur') as HTMLInputElement).checked ? { wood: '#4a90e2', stone: '#c9553f', net: '#2b2f36', glass: '#e0584f' }[mend] : undefined;
      playFix({
        mend, phase, color, white: ($('wit') as HTMLInputElement).checked, tank: ($('bak') as HTMLInputElement).checked,
        onDone: fixed => note(`hek ${mend} ${phase}: ${fixed ? 'gemaakt' : 'weggeklikt'}  (open: ${cardOpen()})`),
      });
    });
    $('hek').append(b);
  }

// geluid mag pas na een tik
addEventListener('pointerdown', unlockAudio, { capture: true });
// de kopplaatjes van de dieren, net als in het spel; daarna pas kloppen de woorden met een dier
await Promise.all([loadAudio(lang), probeIcons(Object.keys(SPECIES))]);
$('uitslag').textContent = 'Klaar om te proberen.';
