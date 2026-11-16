// Opstarten: startscherm met drie opslagplekken, daarna het spel.
import * as THREE from 'three';
import { askPersistence, saveDel, saveGet, setStrings, t } from '@smj/shared';
import { SPECIES, type SpeciesId, type Variant } from './data';
import { Game, slotKey, type SaveData } from './game';
import { loadManifest, loadModel } from './models';
import strings from './nl.json';
import './style.css';
import { View } from './view';

setStrings(strings);
document.title = t('title');

const $ = (id: string): HTMLElement => document.getElementById(id)!;
const AVATARS = ['🦁', '🐼', '🐧'];
const VARIANTS: Variant[] = ['male', 'female', 'young_m', 'young_f'];
const HOLD_MS = 1200;

async function showStart(): Promise<void> {
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
    b.innerHTML = `<span>${AVATARS[i - 1]}</span>${data ? `⭐ ${data.level + 1}` : t('slot.new')}`;
    b.addEventListener('click', () => void begin(i, data));
    wrap.append(b);
    if (data) {
      // wissen kan alleen door de knop even vast te houden, zodat het niet per ongeluk gebeurt
      const del = document.createElement('button');
      del.className = 'slot-del';
      del.textContent = '🗑️';
      del.setAttribute('aria-label', t('slot.delete'));
      let timer = 0;
      const stop = () => {
        clearTimeout(timer);
        del.classList.remove('holding');
      };
      del.addEventListener('pointerdown', () => {
        del.classList.add('holding');
        timer = window.setTimeout(() => void saveDel(slotKey(i)).then(showStart), HOLD_MS);
      });
      del.addEventListener('pointerup', stop);
      del.addEventListener('pointerleave', stop);
      wrap.append(del);
    }
    slots.append(wrap);
  }
}

async function begin(slot: number, data: SaveData | undefined): Promise<void> {
  $('start').hidden = true;
  $('loading').hidden = false;
  askPersistence();
  try {
    await loadManifest();
    const keys = (Object.keys(SPECIES) as SpeciesId[]).flatMap(s => VARIANTS.map(v => `${s}_${v}`));
    await Promise.all([...keys, 'poop'].map(loadModel));
  } catch (err) {
    $('loading').textContent = '⚠️';
    throw err;
  }
  $('loading').hidden = true;
  $('ui').hidden = false;

  const view = new View($('app'));
  const game = new Game(view, slot, data, () => location.reload());
  const clock = new THREE.Clock();
  view.renderer.setAnimationLoop(() => {
    game.update(Math.min(clock.getDelta(), 0.1));
    view.render();
  });
}

void showStart();
