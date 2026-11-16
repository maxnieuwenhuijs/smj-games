// Overzichtspagina om alle figuren, plaatjes, stemmen en geluiden in een keer te bekijken en te beluisteren (figuren.html).
import { setStrings, t } from '@smj/shared';
import { FIGURES, MOODS, portrait, type FigureId, type Mouth } from './figures';
import { ICON_IDS, icon } from './icons';
import { voiceId } from './lines';
import strings from './nl.json';
import './style.css';

setStrings(strings);
const root = document.getElementById('gallery')!;
const MOOD_NAMES = { happy: 'blij', worried: 'bezorgd', urgent: 'dringend' };
const MOUTH_NAMES = ['dicht', 'half', 'open'];
/** Per figuur een paar zinnen om de stem te beoordelen. */
const SAMPLES: Record<FigureId, string[]> = {
  director: [t('say.welcome'), t('say.level.1'), t('say.level.14'), t('say.done')],
  keeper: [t('goal.happy', { n: 2, many: t('species.pig.many') }), t('alert.clean'), t('say.healed'), t('say.hired')],
  builder: [t('goal.enclosure'), t('goal.trough'), t('alert.enclosure')],
  host: [t('host.first'), t('host.food'), t('host.toilet'), t('goal.guests', { n: 3 })],
  cashier: [t('cash.short'), t('cash.full'), t('goal.coins', { n: 8 })],
};

async function json<T>(url: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(url, { cache: 'no-cache' });
    return res.ok ? ((await res.json()) as T) : fallback;
  } catch {
    return fallback;
  }
}

const voices = await json<Record<string, string>>('./audio/nl/voice.json', {});
const sounds = await json<Record<string, string[]>>('./audio/sfx/sfx.json', {});
const play = (url: string, label: string): string => `<button class="pbtn" data-play="${url}">${icon('sound_on')}<b>${label}</b></button>`;

let html = '';
for (const id of FIGURES) {
  html += `<h2>${t(`figure.${id}`)}</h2><div class="grid">`;
  for (const mood of MOODS)
    for (const frame of [0, 1, 2] as Mouth[])
      html += `<div class="cell">${portrait(id, mood, frame)}${MOOD_NAMES[mood]}, ${MOUTH_NAMES[frame]}</div>`;
  html += '</div><div class="grid">';
  for (const text of SAMPLES[id]) {
    const file = voices[voiceId(id, text)];
    html += file ? play(`./audio/nl/${file}`, text) : `<div class="cell">(nog geen stem) ${text}</div>`;
  }
  html += '</div>';
}
html += '<h2>Geluiden</h2><div class="grid">';
for (const [id, files] of Object.entries(sounds)) files.forEach((file, i) => (html += play(`./audio/sfx/${file}`, files.length > 1 ? `${id} ${i + 1}` : id)));
html += '</div><h2>Plaatjes</h2><div class="grid">';
for (const id of ICON_IDS) html += `<div class="cell">${icon(id)}${id}</div>`;
html += '</div>';
root.innerHTML = html;

let playing: HTMLAudioElement | null = null;
root.addEventListener('click', e => {
  const url = (e.target as HTMLElement).closest<HTMLElement>('[data-play]')?.dataset.play;
  if (!url) return;
  playing?.pause();
  playing = new Audio(url);
  void playing.play();
});
