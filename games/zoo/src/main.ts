// Opstarten: startscherm met drie opslagplekken, het oudermenu, daarna het spel.
import * as THREE from 'three';
import { askPersistence, saveDel, saveGet, saveSet, setStrings, t } from '@smj/shared';
import { loadAudio, resumeAmbience, sfx, unlockAudio } from './audio';
import { LEVELS, SPECIES, bonusSpecies, migrateLevel, unlockedSpecies } from './data';
import en from './en.json';
import { Game, slotKey, type SaveData } from './game';
import { icon, type IconId } from './icons';
import { hasSpecies, loadManifest, loadModel, loadSpecies, probeIcons } from './models';
import { cleanName, loadName, setElevenKey, storedElevenKey } from './names';
import nl from './nl.json';
import './style.css';
import { View } from './view';

// ------------------------------------------------------------ taal
const LANGS = { nl, en } as const;
type Lang = keyof typeof LANGS;
const LANG_KEY = 'zoo-lang';

function currentLang(): Lang {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved && saved in LANGS) return saved as Lang;
  } catch {
    /* geen opslag */
  }
  return navigator.language?.toLowerCase().startsWith('nl') ? 'nl' : 'en';
}

let lang = currentLang();
// een tekst die in een taal nog ontbreekt, valt terug op het Nederlands
setStrings({ ...nl, ...LANGS[lang] });
document.documentElement.lang = lang;
document.title = t('title');

const $ = (id: string): HTMLElement => document.getElementById(id)!;
const AVATARS: IconId[] = ['pig', 'cow', 'sheep'];
const HOLD_MS = 1200;
const PARENT_HOLD_MS = 3000;
const levelOf = (d: SaveData): number => migrateLevel(d.level, d.v ?? 1);

/** Een knop die pas iets doet als je hem een tijdje vasthoudt, zodat het niet per ongeluk gebeurt. */
function holdButton(b: HTMLElement, ms: number, done: () => void): void {
  let timer = 0;
  const stop = (): void => {
    clearTimeout(timer);
    b.classList.remove('holding');
  };
  b.style.setProperty('--hold', `${ms}ms`);
  b.addEventListener('pointerdown', () => {
    b.classList.add('holding');
    timer = window.setTimeout(() => {
      stop();
      done();
    }, ms);
  });
  b.addEventListener('pointerup', stop);
  b.addEventListener('pointerleave', stop);
  b.addEventListener('contextmenu', e => e.preventDefault());
}

/**
 * Het logo van SMJ Games: de letters S, M en J als figuurtjes (Super, Magical, Journeys). Ze springen er een voor
 * een in met een wiebel, en daarna wiebelen ze zachtjes na. `kind`: 'splash' groot op het laadscherm, 'start' klein
 * boven het beginscherm.
 */
const LOGO: [string, string][] = [['s', 'Super'], ['m', 'Magical'], ['j', 'Journeys']];
/** De belletjes op het laadscherm: [plek van links in %, grootte in px, tellen per belletje, vertraging, opzij in px]. */
const BUBBLES: [number, number, number, number, number][] = [
  [8, 18, 2.6, 0.2, -20], [18, 10, 2.1, 0.9, 14], [30, 24, 2.9, 0.5, -10], [44, 12, 2.3, 1.4, 22],
  [56, 20, 2.7, 0.1, -16], [68, 9, 2.0, 1.1, 10], [80, 22, 3.0, 0.7, 18], [92, 14, 2.4, 1.6, -12],
];
function logoHtml(kind: 'splash' | 'start'): string {
  return `<div class="logo ${kind}" aria-label="SMJ Games">` +
    LOGO.map(([k, word]) => `<figure class="l-${k}"><img src="./logo/${k}.png" alt="${k.toUpperCase()}" draggable="false"><figcaption>${word}</figcaption></figure>`).join('') +
    // op het laadscherm: belletjes die achter de letters opstijgen (elk met een eigen plek, grootte en tempo)
    (kind === 'splash' ? BUBBLES.map(([x, s, t, d, dx]) => `<i class="bub" style="left:${x}%;--s:${s}px;--t:${t}s;--d:${d}s;--x:${dx}px"></i>`).join('') : '') +
    '</div>';
}
/** Zo lang staat het laadscherm met de letters er minstens, ook als alles al geladen is (milliseconden). */
const SPLASH_MS = 2000;

async function showStart(): Promise<void> {
  if (!$('logo').childElementCount) $('logo').innerHTML = logoHtml('start');
  $('title').textContent = t('title');
  const slots = $('slots');
  slots.replaceChildren();
  for (let i = 1; i <= 3; i++) {
    const data = await saveGet<SaveData>(slotKey(i));
    const wrap = document.createElement('div');
    wrap.className = 'slot-wrap';
    const b = document.createElement('button');
    b.className = 'slot';
    b.dataset.slot = String(i);
    b.innerHTML = `${icon(AVATARS[i - 1])}<b>${data ? `${icon('star', 'mini')} ${Math.min(levelOf(data), LEVELS.length - 1) + 1}` : t('slot.new')}</b>`;
    // de naam van de speler staat onder het plaatje, zodat je meteen ziet welk spel van wie is
    if (data?.player) {
      const who = document.createElement('i');
      who.className = 'who';
      who.textContent = data.player;
      b.querySelector('b')?.before(who);
    }
    b.addEventListener('click', () => void (data ? begin(i, data, data.player ?? '') : askName().then(name => begin(i, undefined, name))));
    wrap.append(b);
    if (data) {
      // wissen kan alleen door de knop even vast te houden
      const del = document.createElement('button');
      del.className = 'slot-del';
      del.innerHTML = icon('trash');
      del.setAttribute('aria-label', t('slot.delete'));
      holdButton(del, HOLD_MS, () => void saveDel(slotKey(i)).then(showStart));
      // een gewone tik wist niets, maar zegt wel hoe het moet
      const tip = document.createElement('div');
      tip.className = 'slot-tip';
      tip.textContent = t('slot.delete.tip');
      tip.hidden = true;
      del.addEventListener('click', () => {
        tip.hidden = false;
        setTimeout(() => (tip.hidden = true), 3000);
      });
      wrap.append(del, tip);
    }
    slots.append(wrap);
  }
  const gear = $('parents');
  gear.innerHTML = `${icon('gear')}<b>${t('parents')}</b>`;
  gear.title = t('parents.hold');
}

// ------------------------------------------------------------ voor ouders
/** Bewaren in een bestand, terugzetten en de taal: achter een knop die je drie tellen vasthoudt. */
async function showParents(): Promise<void> {
  const panel = $('parentpanel');
  panel.replaceChildren();
  const card = document.createElement('div');
  card.className = 'card parents';
  const title = document.createElement('div');
  title.className = 'big';
  title.textContent = t('parents');
  card.append(title);
  const note = document.createElement('div');
  note.className = 'sub';

  const row = (label: string): HTMLElement => {
    const r = document.createElement('div');
    r.className = 'prow';
    const l = document.createElement('span');
    l.textContent = label;
    r.append(l);
    card.append(r);
    return r;
  };
  const button = (ic: IconId, label: string, click: () => void): HTMLButtonElement => {
    const b = document.createElement('button');
    b.className = 'pbtn';
    b.innerHTML = `${icon(ic)}<b></b>`;
    b.querySelector('b')!.textContent = label;
    b.addEventListener('click', click);
    return b;
  };

  for (let i = 1; i <= 3; i++) {
    const data = await saveGet<SaveData>(slotKey(i));
    const r = row(`${t('parents.slot', { n: i })}: ${data ? t('level', { n: Math.min(levelOf(data), LEVELS.length - 1) + 1 }) : t('parents.empty')}`);
    if (data) {
      // de naam van de speler op deze plek: aanpassen kan hier
      const name = document.createElement('input');
      name.className = 'nameinput small';
      name.maxLength = 14;
      name.placeholder = t('parents.name');
      name.value = data.player ?? '';
      name.addEventListener('change', () => {
        data.player = cleanName(name.value) || undefined;
        name.value = data.player ?? '';
        void saveSet(slotKey(i), data).then(() => {
          note.textContent = t('parents.done');
        });
      });
      r.append(name);
    }
    if (data)
      r.append(button('download', t('parents.export'), () => {
        const url = URL.createObjectURL(new Blob([JSON.stringify({ game: 'zoo', slot: i, data })], { type: 'application/json' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = `dierentuin-plek-${i}.json`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        note.textContent = t('parents.done');
      }));
    const file = document.createElement('input');
    file.type = 'file';
    file.accept = 'application/json,.json';
    file.hidden = true;
    file.addEventListener('change', () => {
      const f = file.files?.[0];
      if (!f) return;
      void f.text().then(async text => {
        try {
          const parsed = JSON.parse(text) as { game?: string; data?: SaveData };
          const d = parsed.data;
          if (parsed.game !== 'zoo' || !d || !Array.isArray(d.terrain) || !Array.isArray(d.animals) || typeof d.level !== 'number') throw new Error('vorm');
          await saveSet(slotKey(i), d);
          note.textContent = t('parents.done');
          await showStart();
          await showParents();
        } catch {
          note.textContent = t('parents.failed');
        }
      });
    });
    r.append(file, button('upload', t('parents.import'), () => file.click()));
    if (data) {
      // wissen vraagt eerst of je het zeker weet: de knop verandert, een tweede tik wist
      let sure = false;
      const del = button('trash', t('parents.delete'), () => {
        if (!sure) {
          sure = true;
          del.classList.add('warn');
          del.querySelector('b')!.textContent = t('parents.delete.sure');
          return;
        }
        void saveDel(slotKey(i)).then(async () => {
          await showStart();
          await showParents();
        });
      });
      r.append(del);
    }
  }

  // eigen sleutel: daarmee kan het spel ook een naam inspreken die het nog niet kent
  const keyRow = row(t('parents.key'));
  const keyInput = document.createElement('input');
  keyInput.className = 'nameinput small wide';
  keyInput.type = 'password';
  keyInput.autocomplete = 'off';
  keyInput.value = storedElevenKey();
  keyInput.addEventListener('change', () => {
    setElevenKey(keyInput.value);
    note.textContent = t('parents.done');
  });
  keyRow.append(keyInput);
  const hint = document.createElement('div');
  hint.className = 'sub hint';
  hint.textContent = t('parents.key.hint');
  card.append(hint);

  const langs = row(t('parents.language'));
  for (const code of Object.keys(LANGS) as Lang[]) {
    const b = button('globe', t(`lang.${code}`), () => {
      try {
        localStorage.setItem(LANG_KEY, code);
      } catch {
        /* dan blijft de taal zoals hij was */
      }
      location.reload();
    });
    b.classList.toggle('on', code === lang);
    langs.append(b);
  }

  card.append(note, button('check', t('parents.close'), () => {
    panel.hidden = true;
  }));
  panel.append(card);
  panel.hidden = false;
}

/** Bij een nieuw spel: hoe heet je? Een ouder typt de naam; overslaan kan ook. */
function askName(): Promise<string> {
  return new Promise(resolve => {
    const box = $('ask');
    box.replaceChildren();
    const card = document.createElement('div');
    card.className = 'card ask';
    const title = document.createElement('div');
    title.className = 'big';
    title.textContent = t('ask.name');
    const input = document.createElement('input');
    input.className = 'nameinput';
    input.maxLength = 14;
    input.autocomplete = 'off';
    input.setAttribute('aria-label', t('ask.name'));
    const done = (name: string): void => {
      box.hidden = true;
      resolve(cleanName(name));
    };
    const row = document.createElement('div');
    row.className = 'prow';
    const mk = (ic: IconId, label: string, click: () => void): HTMLButtonElement => {
      const b = document.createElement('button');
      b.className = 'pbtn';
      b.innerHTML = `${icon(ic)}<b></b>`;
      b.querySelector('b')!.textContent = label;
      b.addEventListener('click', click);
      return b;
    };
    row.append(mk('cross', t('ask.skip'), () => done('')), mk('check', t('ask.ok'), () => done(input.value)));
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') done(input.value);
    });
    card.append(title, input, row);
    box.append(card);
    box.hidden = false;
    input.focus();
  });
}

async function begin(slot: number, data: SaveData | undefined, player = ''): Promise<void> {
  $('start').hidden = true;
  // het laadscherm: de letters S, M en J springen er een voor een in, met een magisch deuntje
  const shownAt = performance.now();
  $('loading').innerHTML = logoHtml('splash');
  $('loading').classList.remove('out');
  $('loading').hidden = false;
  askPersistence();
  unlockAudio();
  try {
    await Promise.all([loadManifest(), loadAudio(lang)]);
    sfx('logo.jingle', { volume: 0.7, every: 0 });
    await loadName(lang, player, () => {
      if (!$('loading').querySelector('.wait')) $('loading').insertAdjacentHTML('beforeend', `<b class="wait">${t('ask.wait')}</b>`);
    });
    await probeIcons(Object.keys(SPECIES));
    // alleen de soorten laden die al vrijgespeeld zijn of in het opgeslagen park staan
    const level = data ? levelOf(data) : 0;
    const needed = new Set<string>([...unlockedSpecies(Math.min(level, LEVELS.length)), ...bonusSpecies(level), ...(data?.animals ?? []).map(a => a.species)]);
    await Promise.all([loadModel('poop'), ...[...needed].filter(hasSpecies).map(loadSpecies)]);
  } catch (err) {
    $('loading').innerHTML = icon('cross');
    throw err;
  }
  // de letters blijven even staan, en dan vervaagt het laadscherm
  const left = SPLASH_MS - (performance.now() - shownAt);
  if (left > 0) await new Promise(r => setTimeout(r, left));
  $('loading').classList.add('out');
  setTimeout(() => {
    $('loading').hidden = true;
    $('loading').classList.remove('out');
  }, 420);
  $('ui').hidden = false;

  const view = new View($('app'));
  const game = new Game(view, slot, data, () => location.reload(), player);
  resumeAmbience();
  const clock = new THREE.Clock();
  view.renderer.setAnimationLoop(() => {
    const dt = clock.getDelta();
    view.adapt(dt);
    game.update(Math.min(dt, 0.1));
    view.render();
  });
}

// geluid mag pas na een tik; daarna gaat ook het achtergrondgeluid aan
addEventListener('pointerdown', () => {
  unlockAudio();
  resumeAmbience();
}, { capture: true });

holdButton($('parents'), PARENT_HOLD_MS, () => void showParents());

// als app te installeren en daarna ook zonder internet te spelen
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  addEventListener('load', () => void navigator.serviceWorker.register('./sw.js').catch(() => undefined));
}

void showStart();
