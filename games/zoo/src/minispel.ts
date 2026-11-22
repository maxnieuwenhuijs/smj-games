// Ontwikkelpagina (minispel.html): de puzzeltjes uit minigame.ts los van het spel uitproberen.
// Alleen te zien met `npm run dev`; de pagina zit niet in het gepubliceerde spel.
//
// In de adresbalk: ?taal=en voor de Engelse teksten en woorden.
import { setStrings } from '@smj/shared';
import { loadAudio, unlockAudio } from './audio';
import { SPECIES } from './data';
import en from './en.json';
import { icon } from './icons';
import { closeMini, miniOpen, playMini, type MiniKind, type MiniResult } from './minigame';
import { probeIcons } from './models';
import nl from './nl.json';
import './style.css';

const lang = new URLSearchParams(location.search).get('taal') === 'en' ? 'en' : 'nl';
setStrings(lang === 'en' ? { ...nl, ...en } : nl);
document.documentElement.lang = lang;

const $ = (id: string): HTMLElement => document.getElementById(id)!;
const KINDS: [MiniKind, string][] = [['sum', 'Som'], ['spell', 'Woord'], ['order', 'Volgorde']];
const lines: string[] = [];

function report(kind: MiniKind, r: MiniResult): void {
  lines.unshift(`${kind}: ${JSON.stringify(r)}  (open: ${miniOpen()})`);
  $('uitslag').textContent = lines.slice(0, 8).join('\n');
}

function start(kind: MiniKind): void {
  playMini({
    kind,
    rounds: Number(($('rondes') as HTMLSelectElement).value),
    picture: ($('plaatje') as HTMLInputElement).checked ? icon('schoolclass') : undefined,
    onDone: r => report(kind, r),
  });
}

for (const [kind, label] of KINDS) {
  const b = document.createElement('button');
  b.textContent = label;
  b.addEventListener('click', () => start(kind));
  $('knoppen').append(b);
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

// geluid mag pas na een tik
addEventListener('pointerdown', unlockAudio, { capture: true });
// de kopplaatjes van de dieren, net als in het spel; daarna pas kloppen de woorden met een dier
await Promise.all([loadAudio(lang), probeIcons(Object.keys(SPECIES))]);
$('uitslag').textContent = 'Klaar om te proberen.';
