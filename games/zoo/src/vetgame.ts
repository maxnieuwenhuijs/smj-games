// De dokter: een ziek dier maak je beter met een paar kleine spelletjes. Er zijn er zeven (koorts meten, pleisters
// plakken, het hart zoeken, een doorn eruit trekken, een drankje geven, een wondje schoonvegen en tanden poetsen); een
// bezoek krijgt er twee of drie, elke keer andere. De patiënt is het plaatje van het dier zelf: eerst grijs en sip, na
// elk spelletje met wat meer kleur, en aan het eind springt het blij op tussen de hartjes.
// Fout gaan kan niet: een verkeerde tik doet niets of schudt even. Wegklikken mag altijd; dan blijft het dier ziek.
// Het spel roept playVet aan en hoort via onDone of het dier beter is. De getallen en regels staan in vetplan.ts.
import './vetgame.css';
import { t } from '@smj/shared';
import { drum, sfx } from './audio';
import { icon, type IconId } from './icons';
import { burst, openCard, track, type PlayCard, type Point } from './playcard';
import { VET, heartBeat, pickSpots, pickVisit, sickAfter, thornOut, warmUp, wipe, type VetGame } from './vetplan';

export interface VetOptions {
  /** Het plaatje van het zieke dier (HTML, van speciesIcon). */
  picture: string;
  /** Welke spelletjes, in deze volgorde. Zonder kiest de dokter er zelf twee of drie, andere dan de vorige keer. */
  games?: VetGame[];
  /** De uitleg van elk spelletje wordt hiermee voorgelezen (de tekst zelf staat er ook); mag ontbreken. */
  say?: (text: string) => void;
  /** Het dier laat zich horen, als het weer beter is; mag ontbreken. */
  voice?: () => void;
  /** Eén keer aangeroepen als de kaart dichtgaat: is het dier beter, of is de kaart weggeklikt? */
  onDone: (cured: boolean) => void;
}

/** Het plaatje bij elk spelletje, voor de bolletjes bovenaan de kaart. */
const TOOL: Record<VetGame, IconId> = { thermo: 'thermo', plaster: 'plaster', stetho: 'stetho', thorn: 'tweezers', syrup: 'syrup', cotton: 'cotton', teeth: 'toothbrush' };
/** De kleuren van de drankjes. */
const SYRUPS = ['#f06aa6', '#6cc04a', '#f5a623', '#4a90e2', '#9b6bd6'];
/** De spelletjes van het vorige bezoek, zodat het volgende anders is. */
let lastVisit: VetGame[] = [];

/** Eén bezoek aan de dokter. */
interface Visit {
  card: PlayCard;
  opts: VetOptions;
  games: VetGame[];
  /** Het hoeveelste spelletje (vanaf 0). */
  at: number;
  /** Het vak met het dier, de laag eroverheen waar een spelletje zijn dingen neerzet, en het vak eronder voor het gereedschap. */
  patient: HTMLElement;
  layer: HTMLElement;
  tray: HTMLElement;
  /** Zit er op deze plek van het plaatje dier (en geen lucht)? */
  solid: (x: number, y: number) => boolean;
  /** Wat het spelletje van nu moet stoppen als het klaar is. */
  stop: (() => void)[];
}

const rnd = (n: number): number => Math.floor(Math.random() * n);
function shuffle<T>(list: T[]): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = rnd(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
const pct = (v: number): string => `${(v * 100).toFixed(1)}%`;
const spot = (p: Point): string => `left:${pct(p.x)};top:${pct(p.y)}`;
const within = (p: Point): Point => ({ x: Math.max(0.04, Math.min(0.96, p.x)), y: Math.max(0.04, Math.min(0.96, p.y)) });

/** Laat een dierenplaatje vertellen waar het dicht is. Zonder plaatje (een getekend pootje): een rondje in het midden. */
function solidOf(img: HTMLImageElement | null): (x: number, y: number) => boolean {
  const round = (x: number, y: number): boolean => Math.hypot(x - 0.5, y - 0.5) < 0.36;
  if (!img || !img.naturalWidth) return round;
  try {
    const n = 40, canvas = document.createElement('canvas');
    canvas.width = canvas.height = n;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(img, 0, 0, n, n);
    const data = ctx.getImageData(0, 0, n, n).data;
    return (x, y) => x >= 0 && x < 1 && y >= 0 && y < 1 && data[(Math.floor(y * n) * n + Math.floor(x * n)) * 4 + 3] > 128;
  } catch {
    return round;
  }
}

/** Het dier reageert even: `hop` (blij opveren) of `ouch` (schrikken). */
function react(v: Visit, how: 'hop' | 'ouch'): void {
  v.patient.classList.remove('hop', 'ouch');
  void v.patient.offsetWidth;
  v.patient.classList.add(how);
}

/** Het volgende spelletje, of het eind van het bezoek. */
function next(v: Visit): void {
  for (const stop of v.stop) stop();
  v.stop = [];
  v.layer.innerHTML = '';
  v.tray.innerHTML = '';
  v.patient.classList.remove('mouth');
  v.card.steps(v.games.map(g => icon(TOOL[g])), v.at);
  if (v.at >= v.games.length) return cured(v);
  const game = v.games[v.at];
  v.card.title(t(`vet.${game}.how`));
  GAMES[game](v, () => stepDone(v));
}

/** Een spelletje is gelukt: het dier krijgt wat meer kleur en veert op, en dan komt het volgende. */
function stepDone(v: Visit): void {
  v.at++;
  v.card.hint();
  v.card.steps(v.games.map(g => icon(TOOL[g])), v.at);
  v.patient.style.setProperty('--sick', sickAfter(v.at, v.games.length).toFixed(2));
  react(v, 'hop');
  sfx('chime', { volume: 0.7 });
  burst(v.patient, { x: 0.5, y: 0.45 }, ['sparkle', 'heart']);
  v.card.later(1000, () => next(v));
}

/** Alles gedaan: het dier is weer op kleur, springt blij op en neer, en de kaart gaat vanzelf dicht. */
function cured(v: Visit): void {
  v.patient.classList.replace('sick', 'well');
  // de verzorger zegt het straks zelf: hier staat het alleen
  v.card.title(t('say.healed'), true);
  burst(v.patient, { x: 0.5, y: 0.5 }, ['heart', 'sparkle'], 8);
  v.opts.voice?.();
  v.card.later(1500, () => v.card.finish());
}

// ------------------------------------------------------------ koorts meten
/**
 * Houd je vinger op het dier: de thermometer onderaan loopt vol tot de ster. Loslaten mag, hij zakt niet terug; en
 * een paar losse tikjes vullen hem ook.
 */
function thermoGame(v: Visit, done: () => void): void {
  v.layer.innerHTML = `<span class="vg-tool vg-inmouth">${icon('thermo')}</span><div class="vg-pad"></div>`;
  v.tray.innerHTML = `<div class="vg-gauge"><span class="vg-bulb"></span><span class="vg-tube"><i class="vg-fill"></i></span><span class="vg-goal">${icon('star')}</span></div>`;
  const fill = v.tray.querySelector<HTMLElement>('.vg-fill')!, gauge = v.tray.querySelector<HTMLElement>('.vg-gauge')!;
  let level = 0, held = false, over = false;
  const show = (): void => {
    fill.style.width = pct(level);
    if (level < 1 || over) return;
    over = true;
    gauge.classList.add('full');
    done();
  };
  const hold = (): void => {
    if (over) return;
    held = true;
    v.patient.classList.add('held');
    level = Math.min(1, level + VET.thermo.tap);
    sfx('tap', { volume: 0.5, rate: 0.8 + level * 0.6 });
    show();
  };
  const release = (): void => {
    held = false;
    v.patient.classList.remove('held');
  };
  // vasthouden kan op het dier en op de thermometer zelf
  track(v.layer.querySelector<HTMLElement>('.vg-pad')!, { down: hold, up: release });
  track(gauge, { down: hold, up: release });
  v.stop.push(release, v.card.frame(dt => {
    if (!held || over) return;
    level = warmUp(level, dt);
    show();
  }));
  v.card.hint(v.layer, 'hold', { x: 0.5, y: 0.55 });
}

// ------------------------------------------------------------ pleisters plakken
/** Op het dier zitten een paar zere plekken (rode kloppende rondjes). Een tik op een plek plakt er een pleister op. */
function plasterGame(v: Visit, done: () => void): void {
  const sores = pickSpots(v.solid, VET.plaster.spots, 0.3);
  v.layer.innerHTML = sores.map((p, i) => `<button class="vg-sore" type="button" style="${spot(p)};--r:${rnd(120) - 60}deg" data-i="${i}"><i></i></button>`).join('');
  // onderaan liggen de pleisters klaar: bij elke plek gaat er een weg
  v.tray.innerHTML = `<span class="vg-stock">${sores.map(() => `<i>${icon('plaster')}</i>`).join('')}</span>`;
  let left = sores.length;
  for (const b of v.layer.querySelectorAll<HTMLButtonElement>('.vg-sore'))
    b.addEventListener('click', () => {
      if (b.classList.contains('done')) return;
      b.classList.add('done');
      b.innerHTML = icon('plaster');
      v.tray.querySelector('.vg-stock i:not(.used)')?.classList.add('used');
      sfx('place', { volume: 0.7 });
      left--;
      if (left === 0) done();
      else v.card.hint(v.layer, 'tap', sores[[...v.layer.querySelectorAll('.vg-sore')].findIndex(s => !s.classList.contains('done'))]);
    });
  v.card.hint(v.layer, 'tap', sores[0]);
}

// ------------------------------------------------------------ het hart zoeken
/**
 * Schuif de stethoscoop over het dier (met een muis hoef je niet eens te drukken). Hoe dichter bij het hart, hoe harder
 * en sneller het klopt: het hart onderaan wordt groter en je hoort de slag. Blijf je even op de goede plek, dan heb je
 * het gevonden. Wie lang zoekt, ziet de plek zachtjes oplichten.
 */
function stethoGame(v: Visit, done: () => void): void {
  const [heart] = pickSpots(v.solid, 1, 0);
  v.layer.innerHTML =
    `<i class="vg-glow" style="${spot(heart)}"></i><span class="vg-found" style="${spot(heart)}">${icon('heart')}</span>` +
    `<span class="vg-tool vg-scope">${icon('stetho')}</span><div class="vg-pad"></div>`;
  v.tray.innerHTML = `<span class="vg-beat">${icon('heart')}</span><span class="vg-loud"><i></i><i></i><i></i><i></i><i></i></span>`;
  const scope = v.layer.querySelector<HTMLElement>('.vg-scope')!, beat = v.tray.querySelector<HTMLElement>('.vg-beat')!;
  const bars = [...v.tray.querySelectorAll<HTMLElement>('.vg-loud i')];
  // de stethoscoop begint zo ver mogelijk van het hart
  let at: Point = { x: heart.x < 0.5 ? 0.85 : 0.15, y: heart.y < 0.5 ? 0.85 : 0.15 }, near = 0, searched = 0, phase = 0, found = false;
  const place = (p: Point): void => {
    at = within(p);
    scope.style.left = pct(at.x);
    scope.style.top = pct(at.y);
  };
  place(at);
  track(v.layer.querySelector<HTMLElement>('.vg-pad')!, { down: place, move: place });
  v.stop.push(v.card.frame(dt => {
    if (found) return;
    const loud = heartBeat(Math.hypot(at.x - heart.x, at.y - heart.y));
    bars.forEach((bar, i) => bar.classList.toggle('on', loud > i / bars.length));
    beat.style.setProperty('--loud', loud.toFixed(2));
    // de hartslag: boem-boem, van dichtbij harder en vlugger
    phase += dt * (1 + loud * 1.2);
    if (phase >= 1) {
      phase -= 1;
      beat.classList.remove('thump');
      void beat.offsetWidth;
      beat.classList.add('thump');
      if (loud > 0.02) {
        drum(true, 0.2 + loud * 0.8);
        v.card.later(150, () => drum(true, 0.1 + loud * 0.45));
      }
    }
    near = loud >= 1 ? near + dt : Math.max(0, near - dt * 0.5);
    searched += dt;
    if (searched > VET.stetho.help) v.layer.querySelector('.vg-glow')?.classList.add('on');
    if (near < VET.stetho.seconds) return;
    found = true;
    v.layer.querySelector('.vg-found')?.classList.add('on');
    done();
  }));
  v.card.hint(v.layer, 'rub', { x: 0.28, y: 0.32 }, { x: 0.72, y: 0.62 });
}

// ------------------------------------------------------------ een doorn eruit trekken
/** De doorn als tekening: hij wijst naar rechts, met de punt (links) in het dier. */
const THORN_SVG =
  '<svg viewBox="0 0 60 24" aria-hidden="true"><path d="M2 12 L40 5 Q56 4 57 12 Q56 20 40 19Z" fill="#8a5a3c" stroke="#5a3d22" stroke-width="2.5" stroke-linejoin="round"/>' +
  '<path d="M14 11 L42 9" stroke="#b98a5a" stroke-width="2.5" stroke-linecap="round"/></svg>';

/**
 * In het dier zit een doorn. Sleep hem eruit, de kant op waar hij naartoe wijst (waar je begint maakt niet uit), of
 * tik er een paar keer op: bij elke tik komt hij een stukje verder los. Is hij eruit, dan vliegt hij weg.
 */
function thornGame(v: Visit, done: () => void): void {
  const [at] = pickSpots(v.solid, 1, 0);
  // de doorn wijst van het midden van het dier af naar buiten
  let ux = at.x - 0.5, uy = at.y - 0.5;
  if (Math.hypot(ux, uy) < 0.06) [ux, uy] = [0.7, -0.7];
  const len = Math.hypot(ux, uy);
  ux /= len;
  uy /= len;
  const angle = (Math.atan2(uy, ux) * 180 / Math.PI).toFixed(0);
  v.layer.innerHTML =
    `<i class="vg-wound" style="${spot(at)}"></i>` +
    `<span class="vg-thorn" style="${spot(at)};--a:${angle}deg">${THORN_SVG}</span>` +
    `<span class="vg-tool vg-grip" style="--a:${angle}deg">${icon('tweezers')}</span><div class="vg-pad"></div>`;
  const thorn = v.layer.querySelector<HTMLElement>('.vg-thorn')!, grip = v.layer.querySelector<HTMLElement>('.vg-grip')!;
  let from: Point | null = null, base = 0, out = 0, over = false;
  const show = (): void => {
    thorn.style.setProperty('--out', out.toFixed(3));
    // het pincet houdt de kop van de doorn vast (de doorn is ruim een derde van het plaatje lang)
    grip.style.left = pct(at.x + ux * (0.41 + out * VET.thorn.pull));
    grip.style.top = pct(at.y + uy * (0.41 + out * VET.thorn.pull));
    if (out < 1 || over) return;
    over = true;
    thorn.classList.add('gone');
    grip.classList.add('gone');
    v.layer.querySelector('.vg-wound')?.classList.add('healed');
    sfx('erase', { volume: 0.8 });
    done();
  };
  show();
  track(v.layer.querySelector<HTMLElement>('.vg-pad')!, {
    down: p => {
      if (over) return;
      from = p;
      base = out;
      react(v, 'ouch');
    },
    move: (p, pressed) => {
      if (!pressed || !from || over) return;
      out = Math.max(out, Math.min(1, base + thornOut(p.x - from.x, p.y - from.y, ux, uy)));
      show();
    },
    up: p => {
      // een los tikje (niet gesleept): de doorn komt een stukje verder los
      if (from && !over && Math.hypot(p.x - from.x, p.y - from.y) < 0.03) {
        out = Math.min(1, out + 1 / VET.thorn.taps);
        sfx('tap', { volume: 0.6 });
        show();
      }
      from = null;
    },
  });
  v.card.hint(v.layer, 'drag', { x: at.x + ux * 0.12, y: at.y + uy * 0.12 }, { x: at.x + ux * 0.42, y: at.y + uy * 0.42 });
}

// ------------------------------------------------------------ een drankje geven
/** Het flesje met het drankje: het etiket heeft de kleur van het drankje. */
const bottle = (color: string): string =>
  '<svg viewBox="0 0 48 64" aria-hidden="true"><rect x="17" y="2" width="14" height="9" rx="2.5" fill="#fff" stroke="#8a8f98" stroke-width="2"/><rect x="19" y="10" width="10" height="9" fill="#a8622a"/>' +
  `<rect x="7" y="17" width="34" height="44" rx="7" fill="#a8622a" stroke="#7a4318" stroke-width="2"/><rect x="11" y="27" width="26" height="24" rx="3" fill="${color}" stroke="#fff" stroke-width="2.5"/>` +
  '<path d="M24 32 V46 M17 39 H31" stroke="#fff" stroke-width="4.5" stroke-linecap="round"/></svg>';
/** Een lepel met een drankje in deze kleur. */
const spoon = (color: string): string =>
  '<svg viewBox="0 0 48 64" aria-hidden="true"><path d="M24 34 V58" stroke="#9aa0a6" stroke-width="7" stroke-linecap="round"/><path d="M24 34 V58" stroke="#c8cdd4" stroke-width="3" stroke-linecap="round"/>' +
  `<ellipse cx="24" cy="20" rx="15" ry="18" fill="#c8cdd4" stroke="#8a8f98" stroke-width="2"/><ellipse cx="24" cy="21" rx="10.5" ry="13" fill="${color}"/>` +
  '<ellipse cx="20" cy="15" rx="3" ry="4.5" fill="#fff" opacity=".5"/></svg>';

/** Naast het dier staat een flesje; onderaan liggen drie lepels. Tik op de lepel met de kleur van het flesje. */
function syrupGame(v: Visit, done: () => void): void {
  const colors = shuffle(SYRUPS).slice(0, VET.syrup.spoons), right = colors[rnd(colors.length)];
  v.layer.innerHTML = `<span class="vg-tool vg-bottle">${bottle(right)}</span>`;
  v.tray.innerHTML = colors.map(c => `<button class="vg-spoon" type="button" data-c="${c}">${spoon(c)}</button>`).join('');
  let over = false;
  for (const b of v.tray.querySelectorAll<HTMLButtonElement>('.vg-spoon'))
    b.addEventListener('click', () => {
      if (over) return;
      if (b.dataset.c !== right) {
        // de verkeerde lepel schudt alleen even: gewoon nog een keer proberen
        b.classList.remove('no');
        void b.offsetWidth;
        b.classList.add('no');
        sfx('nope', { volume: 0.6, every: 0.2 });
        return;
      }
      over = true;
      b.classList.add('give');
      sfx('guest.slurp', { volume: 0.9 });
      v.card.later(450, done);
    });
}

// ------------------------------------------------------------ vegen: een wondje schoonmaken en tanden poetsen
/**
 * Vegen met iets in je hand (een watje, een tandenborstel): het volgt je vinger over `pad`, en elk plekje waar je
 * overheen veegt wordt schoner (`--dirt` van 1 naar 0). Een los tikje veegt ook een stukje. Alles schoon: klaar.
 */
function rubGame(v: Visit, tool: IconId, marks: { el: Element; at: Point }[], reach: number, rub: number, sound: string, done: () => void): void {
  v.layer.insertAdjacentHTML('beforeend', `<span class="vg-tool vg-rubber">${icon(tool)}</span><div class="vg-pad"></div>`);
  const hand = v.layer.querySelector<HTMLElement>('.vg-rubber')!;
  const dirt = marks.map(() => 1);
  let last: Point | null = null, left = marks.length;
  const move = (p: Point): void => {
    hand.style.left = pct(p.x);
    hand.style.top = pct(p.y);
    hand.classList.add('on');
  };
  const clean = (p: Point, len: number): void => {
    marks.forEach((mark, i) => {
      if (dirt[i] <= 0 || Math.hypot(p.x - mark.at.x, p.y - mark.at.y) > reach) return;
      dirt[i] = wipe(dirt[i], len, rub);
      (mark.el as HTMLElement).style.setProperty('--dirt', dirt[i].toFixed(2));
      if (dirt[i] > 0) return;
      mark.el.classList.add('clean');
      burst(v.layer, mark.at, ['sparkle'], 4);
      sfx('place', { volume: 0.5, rate: 1.3 });
      left--;
      if (left === 0) done();
    });
  };
  track(v.layer.querySelector<HTMLElement>('.vg-pad')!, {
    down: p => {
      last = p;
      move(p);
      // drie losse tikjes op een plekje maken het ook schoon
      clean(p, rub * 0.34);
    },
    move: (p, pressed) => {
      if (!pressed || !last) return;
      move(p);
      clean(p, Math.hypot(p.x - last.x, p.y - last.y));
      last = p;
      sfx(sound, { volume: 0.35, every: 0.3 });
    },
    up: () => {
      last = null;
    },
  });
  v.card.hint(v.layer, 'rub', { x: marks[0].at.x - 0.1, y: marks[0].at.y }, { x: marks[0].at.x + 0.1, y: marks[0].at.y });
}

/** Op het dier zitten een paar vieze plekjes: veeg ze weg met het watje. */
function cottonGame(v: Visit, done: () => void): void {
  const at = pickSpots(v.solid, VET.cotton.spots, 0.28);
  v.layer.innerHTML = at.map((p, i) => `<i class="vg-smudge" style="${spot(p)};--r:${i * 67}deg"></i>`).join('');
  const marks = [...v.layer.querySelectorAll('.vg-smudge')].map((el, i) => ({ el, at: at[i] }));
  rubGame(v, 'cotton', marks, VET.cotton.reach, VET.cotton.rub, 'paint', done);
}

/** De tanden van dichtbij: een open mond met zes tanden, elk met een gele aanslag. De plekken zijn in het vak van het dier. */
function mouth(): { html: string; teeth: Point[] } {
  const teeth: Point[] = [];
  let html = '';
  const n = VET.teeth.teeth / 2;
  for (let row = 0; row < 2; row++)
    for (let i = 0; i < n; i++) {
      const w = 56 / n, x = 22 + i * w, y = row ? 56 : 24;
      teeth.push({ x: (x + w / 2) / 100, y: (y + 10) / 100 });
      html +=
        `<g class="vg-tooth"><rect x="${x + 1.2}" y="${y}" width="${w - 2.4}" height="20" rx="4.5" fill="#fff" stroke="#c9d3da" stroke-width="1.2"/>` +
        `<path class="vg-plaque" d="M${x + 3} ${y + 6} q${w * 0.2} -4 ${w * 0.4} 0 t${w * 0.38} 1 v8 q-${w * 0.2} 4 -${w * 0.42} 0 t-${w * 0.36} -1Z" fill="#d9c94a"/>` +
        `<circle class="vg-plaque" cx="${x + w * 0.62}" cy="${y + 13}" r="2.2" fill="#8fae3a"/></g>`;
    }
  return {
    teeth,
    html:
      '<svg class="vg-mouth" viewBox="0 0 100 100" aria-hidden="true"><path d="M8 50 Q8 14 50 14 Q92 14 92 50 Q92 88 50 88 Q8 88 8 50Z" fill="#c9484f" stroke="#8f2e36" stroke-width="3"/>' +
      '<path d="M16 50 Q16 22 50 22 Q84 22 84 50 Q84 80 50 80 Q16 80 16 50Z" fill="#6b1f2a"/><path d="M30 76 Q50 60 70 76 Q60 81 50 81 Q40 81 30 76Z" fill="#f08aa0"/>' +
      html + '</svg>',
  };
}

/** Het dier doet zijn mond wijd open (het plaatje schuift naar de hoek): poets alle tanden schoon. */
function teethGame(v: Visit, done: () => void): void {
  const m = mouth();
  v.patient.classList.add('mouth');
  v.layer.innerHTML = m.html;
  const marks = [...v.layer.querySelectorAll('.vg-tooth')].map((el, i) => ({ el, at: m.teeth[i] }));
  rubGame(v, 'toothbrush', marks, VET.teeth.reach, VET.teeth.rub, 'sweep', done);
}

const GAMES: Record<VetGame, (v: Visit, done: () => void) => void> = {
  thermo: thermoGame, plaster: plasterGame, stetho: stethoGame, thorn: thornGame, syrup: syrupGame, cotton: cottonGame, teeth: teethGame,
};

// ------------------------------------------------------------ voor het spel
/** Opent de dokter over het spel heen. Staat er al een kaart open, dan gaat die eerst dicht. */
export function playVet(opts: VetOptions): void {
  const games = opts.games?.length ? opts.games : pickVisit(lastVisit);
  if (!opts.games?.length) lastVisit = games;
  const card = openCard({ kind: 'vet', label: t('vet.title'), picture: icon('vet'), say: opts.say, onClose: opts.onDone });
  card.stage.innerHTML = `<div class="vg-patient sick"><span class="vg-pic">${opts.picture}</span><div class="vg-layer"></div></div><div class="vg-tray"></div>`;
  const patient = card.stage.querySelector<HTMLElement>('.vg-patient')!;
  const v: Visit = {
    card, opts, games, at: 0, patient,
    layer: patient.querySelector<HTMLElement>('.vg-layer')!,
    tray: card.stage.querySelector<HTMLElement>('.vg-tray')!,
    solid: () => true,
    stop: [],
  };
  patient.addEventListener('animationend', e => {
    if (e.target === patient) patient.classList.remove('hop', 'ouch');
  });
  // de plekken op het dier kiezen we op het plaatje zelf: dat moet er dus eerst zijn
  const img = patient.querySelector<HTMLImageElement>('.vg-pic img');
  const begin = (): void => {
    if (!card.open) return;
    v.solid = solidOf(img);
    next(v);
  };
  if (img && !img.complete) {
    img.addEventListener('load', begin, { once: true });
    img.addEventListener('error', begin, { once: true });
  } else begin();
}
