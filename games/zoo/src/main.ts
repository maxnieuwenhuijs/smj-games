// Opstarten: startscherm met drie opslagplekken, daarna het spel.
import * as THREE from 'three';
import { askPersistence, saveDel, saveGet, setStrings, t } from '@smj/shared';
import { LEVELS, SPECIES, unlockedSpecies } from './data';
import { Game, slotKey, type SaveData } from './game';
import { icon, type IconId } from './icons';
import { hasSpecies, loadManifest, loadModel, loadSpecies, probeIcons } from './models';
import strings from './nl.json';
import './style.css';
import { View } from './view';

setStrings(strings);
document.title = t('title');

const $ = (id: string): HTMLElement => document.getElementById(id)!;
const AVATARS: IconId[] = ['pig', 'cow', 'sheep'];
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
    b.innerHTML = `${icon(AVATARS[i - 1])}<b>${data ? `${icon('star', 'mini')} ${data.level + 1}` : t('slot.new')}</b>`;
    b.addEventListener('click', () => void begin(i, data));
    wrap.append(b);
    if (data) {
      // wissen kan alleen door de knop even vast te houden, zodat het niet per ongeluk gebeurt
      const del = document.createElement('button');
      del.className = 'slot-del';
      del.innerHTML = icon('trash');
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
  $('loading').innerHTML = icon('paw');
  $('loading').hidden = false;
  askPersistence();
  try {
    await loadManifest();
    await probeIcons(Object.keys(SPECIES));
    // alleen de soorten laden die al vrijgespeeld zijn of in het opgeslagen park staan
    const needed = new Set<string>([...unlockedSpecies(Math.min(data?.level ?? 0, LEVELS.length)), ...(data?.animals ?? []).map(a => a.species)]);
    await Promise.all([loadModel('poop'), ...[...needed].filter(hasSpecies).map(loadSpecies)]);
  } catch (err) {
    $('loading').innerHTML = icon('cross');
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
