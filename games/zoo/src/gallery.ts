// Overzichtspagina om alle figuren en plaatjes in een keer te bekijken (figuren.html).
import { setStrings, t } from '@smj/shared';
import { FIGURES, MOODS, portrait, type Mouth } from './figures';
import { ICON_IDS, icon } from './icons';
import strings from './nl.json';
import './style.css';

setStrings(strings);
const root = document.getElementById('gallery')!;
const MOOD_NAMES = { happy: 'blij', worried: 'bezorgd', urgent: 'dringend' };
const MOUTH_NAMES = ['dicht', 'half', 'open'];

let html = '';
for (const id of FIGURES) {
  html += `<h2>${t(`figure.${id}`)}</h2><div class="grid">`;
  for (const mood of MOODS)
    for (const frame of [0, 1, 2] as Mouth[])
      html += `<div class="cell">${portrait(id, mood, frame)}${MOOD_NAMES[mood]}, ${MOUTH_NAMES[frame]}</div>`;
  html += '</div>';
}
html += '<h2>Plaatjes</h2><div class="grid">';
for (const id of ICON_IDS) html += `<div class="cell">${icon(id)}${id}</div>`;
html += '</div>';
root.innerHTML = html;
