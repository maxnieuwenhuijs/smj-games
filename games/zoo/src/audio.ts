// Geluid: de stemmen van de figuren, effecten, dierengeluiden, het achtergrondgeluid en de muziek.
// Wat in het park gebeurt (dieren, gasten) hoor je alleen goed als het in het midden van je beeld is: zie `listen`.
// Alle bestanden zijn van tevoren gemaakt (tools/voice). Ontbreekt er een bestand, dan blijft het stil
// en gaat het spel gewoon door.
const MUTE_KEY = 'zoo-muted';
// Stemmen zijn het belangrijkst; al het andere blijft op de achtergrond.
const GAIN = { voice: 0.9, sfx: 0.4, ambience: 0.13, music: 0.16 };

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;
try {
  muted = localStorage.getItem(MUTE_KEY) === '1';
} catch {
  /* geen opslag: geluid staat aan */
}

/** Per taal: vingerafdruk van een zin -> bestand. */
let voices: Record<string, string> = {};
/** Effecten: naam -> een of meer bestanden (er wordt er steeds één gekozen). */
let effects: Record<string, string[]> = {};
/** Achtergrondmuziek: naam van het nummer -> bestand. */
let tracks: Record<string, string> = {};
let voiceDir = './audio/nl/';
const buffers = new Map<string, Promise<AudioBuffer | null>>();
const lastPlayed = new Map<string, number>();
const lastVariant = new Map<string, number>();

async function json<T>(url: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(url, { cache: 'no-cache' });
    return res.ok ? ((await res.json()) as T) : fallback;
  } catch {
    return fallback;
  }
}

/** Leest de lijstjes met geluiden. Bestaan ze niet, dan is het spel stil. */
export async function loadAudio(lang: string): Promise<void> {
  voiceDir = `./audio/${lang}/`;
  [voices, effects, tracks] = await Promise.all([json(`${voiceDir}voice.json`, {}), json('./audio/sfx/sfx.json', {}), json('./audio/music/music.json', {})]);
}

/** Geluid mag pas na een tik van de speler; roep dit aan bij de eerste tik. */
export function unlockAudio(): void {
  try {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 1;
      master.connect(ctx.destination);
      // alles wat in het park zelf klinkt (dieren, gasten) gaat door één filter: uitgezoomd klinkt het doffer en zachter
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = cutoff(ear.far);
      const gain = ctx.createGain();
      gain.gain.value = distant(ear.far);
      gain.connect(filter).connect(master);
      park = { gain, filter };
    }
    if (ctx.state === 'suspended') void ctx.resume();
  } catch {
    ctx = null;
  }
}

export const isMuted = (): boolean => muted;

export function setMuted(value: boolean): void {
  muted = value;
  try {
    localStorage.setItem(MUTE_KEY, value ? '1' : '0');
  } catch {
    /* niet erg */
  }
  if (master && ctx) master.gain.setTargetAtTime(value ? 0 : 1, ctx.currentTime, 0.05);
  if (tune) tune.el.muted = value;
}

function load(url: string): Promise<AudioBuffer | null> {
  let p = buffers.get(url);
  if (!p) {
    p = fetch(url)
      .then(r => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
      .then(data => ctx!.decodeAudioData(data))
      .catch(() => null);
    buffers.set(url, p);
  }
  return p;
}

// ------------------------------------------------------------ stemmen
/** Een zin die klinkt. `level()` is hoe hard er nu gepraat wordt: daar beweegt het mondje op mee. */
export interface Voice {
  level(): number;
  /** Klaar, gestopt of mislukt. */
  done: boolean;
  /** Is het geluid echt begonnen? Zo niet, dan praat het figuur op een klokje. */
  started: boolean;
  stop(): void;
}

let current: Voice | null = null;

/** Opnames met de naam van de speler erin: vingerafdruk -> adres. */
let personal: Record<string, string> = {};
export function setPersonalVoices(map: Record<string, string>): void {
  personal = map;
}

export const hasVoice = (id: string): boolean => id in personal || id in voices;

/**
 * Speelt de ingesproken zin met deze vingerafdruk; met een lijstje spelen de opnames achter elkaar
 * (eerst de naam van de speler, dan de zin). Geeft null als er een ontbreekt of het geluid uit staat.
 */
export function playVoice(ids: string | string[]): Voice | null {
  current?.stop();
  current = null;
  const urls = (Array.isArray(ids) ? ids : [ids]).map(id => personal[id] ?? (voices[id] ? voiceDir + voices[id] : ''));
  if (urls.some(u => !u) || !ctx || !master || muted) return null;
  const audio = ctx;
  const analyser = audio.createAnalyser();
  analyser.fftSize = 512;
  const gain = audio.createGain();
  gain.gain.value = GAIN.voice;
  analyser.connect(gain).connect(master);
  const samples = new Uint8Array(analyser.fftSize);
  let source: AudioBufferSourceNode | null = null;
  const voice: Voice = {
    done: false,
    started: false,
    level() {
      if (!this.started || this.done) return 0;
      analyser.getByteTimeDomainData(samples);
      let sum = 0;
      for (const v of samples) sum += (v - 128) * (v - 128);
      return Math.sqrt(sum / samples.length) / 128;
    },
    stop() {
      this.done = true;
      try {
        source?.stop();
      } catch {
        /* was al gestopt */
      }
    },
  };
  void Promise.all(urls.map(load)).then(buffers => {
    if (voice.done) return;
    if (buffers.some(b => !b)) {
      voice.done = true;
      return;
    }
    const playAt = (n: number): void => {
      source = audio.createBufferSource();
      source.buffer = buffers[n];
      source.connect(analyser);
      source.onended = () => {
        if (voice.done) return;
        if (n + 1 < buffers.length) playAt(n + 1);
        else voice.done = true;
      };
      source.start();
    };
    playAt(0);
    voice.started = true;
  });
  current = voice;
  return voice;
}

// ------------------------------------------------------------ luisteren naar wat in beeld is
/**
 * Het oor van de speler: het midden van het beeld (in tegels), hoe ver je daaromheen nog iets hoort (`reach`,
 * ongeveer zo ver als het beeld reikt), hoe ver er uitgezoomd is (`far`: 0 = dichtbij, 1 = heel ver weg), en welke
 * kant op het scherm rechts is (`rx`, `ry`), zodat een geluid links in beeld ook links klinkt.
 */
const ear = { x: 0, y: 0, reach: 9, far: 0, rx: 1, ry: 0, on: false };
/** Het filter en de volumeknop waar alle geluiden uit het park doorheen gaan. */
let park: { gain: GainNode; filter: BiquadFilterNode } | null = null;

/** Hoe dof het klinkt: dichtbij helder (alle hoge tonen), ver uitgezoomd dof, alsof het van ver komt. */
const cutoff = (far: number): number => 16000 * 0.1 ** far;
/** Uitgezoomd klinkt alles ook wat zachter. */
const distant = (far: number): number => 1 - 0.45 * far;

/** Het spel vertelt waar de speler naar kijkt; een paar keer per seconde is genoeg. */
export function listen(x: number, y: number, reach: number, far: number, rx: number, ry: number): void {
  Object.assign(ear, { x, y, reach, far, rx, ry, on: true });
  if (!park || !ctx) return;
  park.filter.frequency.setTargetAtTime(cutoff(far), ctx.currentTime, 0.25);
  park.gain.gain.setTargetAtTime(distant(far), ctx.currentTime, 0.25);
}

/**
 * Hoe goed je iets hoort dat op deze plek gebeurt (0 tot 1): in het midden van het beeld helemaal, naar de rand
 * toe zachter, en een eind buiten beeld niet meer.
 */
export function heard(x: number, y: number): number {
  if (!ear.on) return 1;
  const d = Math.hypot(x - ear.x, y - ear.y) / ear.reach;
  if (d <= 0.3) return 1;
  return d >= 1.5 ? 0 : (1 - (d - 0.3) / 1.2) ** 1.6;
}

// ------------------------------------------------------------ effecten
export interface SfxOptions {
  volume?: number;
  /** Afspeelsnelheid; hoger klinkt ook hoger (jonge dieren). */
  rate?: number;
  /** Niet vaker dan eens per zoveel seconden. */
  every?: number;
  /** Waar het in het park gebeurt (in tegels): dan hoor je het alleen als het in beeld is, en links of rechts. */
  at?: [number, number];
}

export function sfx(id: string, { volume = 1, rate = 1, every = 0.06, at }: SfxOptions = {}): void {
  const files = effects[id];
  if (!files?.length || !ctx || !master || muted || ctx.state !== 'running') return;
  // een geluid met een plek: buiten beeld hoor je het niet, aan de rand zacht
  const near = at ? heard(at[0], at[1]) : 1;
  if (near < 0.04) return;
  volume *= near;
  const now = ctx.currentTime;
  if (now - (lastPlayed.get(id) ?? -99) < every) return;
  lastPlayed.set(id, now);
  const audio = ctx;
  let out: AudioNode = master;
  if (at && park) {
    out = park.gain;
    // links in beeld klinkt links, rechts klinkt rechts (als de browser dat kan)
    if (typeof audio.createStereoPanner === 'function') {
      const pan = audio.createStereoPanner();
      pan.pan.value = Math.max(-0.75, Math.min(0.75, ((at[0] - ear.x) * ear.rx + (at[1] - ear.y) * ear.ry) / ear.reach));
      pan.connect(park.gain);
      out = pan;
    }
  }
  // nooit twee keer achter elkaar dezelfde variant
  let pickAt = Math.floor(Math.random() * files.length);
  if (files.length > 1 && pickAt === lastVariant.get(id)) pickAt = (pickAt + 1) % files.length;
  lastVariant.set(id, pickAt);
  void load(`./audio/sfx/${files[pickAt]}`).then(buffer => {
    if (!buffer) return;
    const source = audio.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = rate * (0.92 + Math.random() * 0.16);
    const gain = audio.createGain();
    gain.gain.value = GAIN.sfx * volume;
    source.connect(gain).connect(out);
    source.start();
  });
}

/** Het geluid van een dier; jonge dieren klinken hoger. Met `at` (de plek van het dier) hoor je het alleen als het in beeld is. */
export function animalSound(species: string, young: boolean, volume = 1, at?: [number, number]): void {
  // jonge dieren hebben hun eigen geluid; is dat er niet, dan het geluid van de ouders, maar hoger
  if (young && effects[`young.${species}`]?.length) sfx(`young.${species}`, { volume: volume * 0.7, every: 0.4, at });
  else sfx(`animal.${species}`, { volume: volume * 0.7, rate: young ? 1.4 : 1, every: 0.4, at });
}

// ------------------------------------------------------------ achtergrond
let ambient: { id: string; source: AudioBufferSourceNode; gain: GainNode } | null = null;
let wantedAmbience = '';

/** Zacht achtergrondgeluid dat blijft doorlopen, bijvoorbeeld vogels op de boerderij. */
export function ambience(id: string): void {
  wantedAmbience = id;
  if (!ctx || !master || ambient?.id === id) return;
  const files = effects[id];
  const audio = ctx, out = master;
  const old = ambient;
  ambient = null;
  if (old) {
    old.gain.gain.setTargetAtTime(0, audio.currentTime, 0.8);
    setTimeout(() => old.source.stop(), 4000);
  }
  if (!files?.length) return;
  void load(`./audio/sfx/${files[0]}`).then(buffer => {
    if (!buffer || wantedAmbience !== id || ambient) return;
    const source = audio.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const gain = audio.createGain();
    gain.gain.value = 0;
    gain.gain.setTargetAtTime(GAIN.ambience, audio.currentTime, 1.5);
    source.connect(gain).connect(out);
    source.start();
    ambient = { id, source, gain };
  });
}

// ------------------------------------------------------------ lagen: wind en publiek
const layers = new Map<string, { source: AudioBufferSourceNode; gain: GainNode } | 'loading'>();
const layerVolume = new Map<string, number>();

/**
 * Een geluid dat blijft doorlopen en harder of zachter kan, bijvoorbeeld het geroezemoes van gasten:
 * hoe meer gasten, hoe meer je ervan hoort. Volume 0 zet het uit.
 */
export function layer(id: string, volume: number): void {
  layerVolume.set(id, volume);
  if (!ctx || !master) return;
  // het geroezemoes van de gasten hoort bij het park: uitgezoomd klinkt het doffer
  const audio = ctx, out: AudioNode = id.startsWith('crowd.') && park ? park.gain : master;
  const have = layers.get(id);
  if (have && have !== 'loading') {
    have.gain.gain.setTargetAtTime(volume * GAIN.ambience, audio.currentTime, 1.2);
    return;
  }
  const files = effects[id];
  if (have || volume <= 0 || !files?.length) return;
  layers.set(id, 'loading');
  void load(`./audio/sfx/${files[Math.floor(Math.random() * files.length)]}`).then(buffer => {
    if (!buffer) {
      layers.delete(id);
      return;
    }
    const source = audio.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const gain = audio.createGain();
    gain.gain.value = 0;
    gain.gain.setTargetAtTime((layerVolume.get(id) ?? 0) * GAIN.ambience, audio.currentTime, 1.5);
    source.connect(gain).connect(out);
    source.start();
    layers.set(id, { source, gain });
  });
}

/** Wisselt een doorlopend geluid af met een andere opname, zodat het niet steeds hetzelfde riedeltje is. */
export function reshuffle(id: string): void {
  const have = layers.get(id);
  if (!ctx || !have || have === 'loading' || (effects[id]?.length ?? 0) < 2) return;
  have.gain.gain.setTargetAtTime(0, ctx.currentTime, 1.5);
  setTimeout(() => have.source.stop(), 6000);
  layers.delete(id);
  layer(id, layerVolume.get(id) ?? 0);
}

// ------------------------------------------------------------ muziek
let tune: { id: string; el: HTMLAudioElement; gain: GainNode | null } | null = null;
let wantedTune = false;
/** De nummers die nog niet geweest zijn in dit rondje; is het leeg, dan begint er een nieuw rondje in een andere volgorde. */
let queue: string[] = [];

/** Het volgende nummer: alle nummers komen om de beurt, steeds in een andere volgorde, en nooit twee keer hetzelfde achter elkaar. */
function nextTrack(): string {
  if (!queue.length) {
    queue = Object.keys(tracks).sort(() => Math.random() - 0.5);
    if (queue.length > 1 && queue[0] === tune?.id) queue.push(queue.shift()!);
  }
  return queue.shift() ?? '';
}

/** Rustige achtergrondmuziek: de nummers spelen na elkaar, met een korte stilte ertussen. */
export function music(): void {
  wantedTune = true;
  if (!ctx || !master || tune) return;
  playTrack(nextTrack());
}

function playTrack(world: string): void {
  const file = tracks[world];
  if (!ctx || !master) return;
  if (!file) return;
  const el = new Audio(`./audio/music/${file}`);
  el.crossOrigin = 'anonymous';
  el.muted = muted;
  let gain: GainNode | null = null;
  try {
    gain = ctx.createGain();
    gain.gain.value = 0;
    gain.gain.setTargetAtTime(GAIN.music, ctx.currentTime, 2);
    ctx.createMediaElementSource(el).connect(gain).connect(master);
  } catch {
    gain = null;
    el.volume = GAIN.music;
  }
  el.addEventListener('ended', () => {
    // even stil, en dan het volgende nummer
    setTimeout(() => {
      if (tune?.el === el) playTrack(nextTrack());
    }, 6000);
  });
  void el.play().catch(() => undefined);
  tune = { id: world, el, gain };
}

/**
 * Meteen dit nummer (bij het avondfeest): het nummer dat nu speelt, sterft snel weg. Daarna gaan de nummers gewoon
 * weer om de beurt verder. Staat het al op, dan gebeurt er niets.
 */
export function playTune(id: string): void {
  wantedTune = true;
  if (!ctx || !master || !tracks[id] || tune?.id === id) return;
  const old = tune;
  tune = null;
  if (old) {
    if (old.gain) old.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.4);
    else old.el.volume = 0;
    setTimeout(() => old.el.pause(), 2000);
  }
  playTrack(id);
}

/** Na de eerste tik: het achtergrondgeluid, de lagen en de muziek die al gevraagd waren alsnog starten. */
export function resumeAmbience(): void {
  if (wantedAmbience && !ambient) ambience(wantedAmbience);
  for (const [id, volume] of layerVolume) if (!layers.has(id)) layer(id, volume);
  if (wantedTune && !tune) music();
}
