// Geluid: de stemmen van de figuren, effecten, dierengeluiden en het achtergrondgeluid per wereld.
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
/** Achtergrondmuziek: wereld -> bestand. */
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

/** Speelt de ingesproken zin met deze vingerafdruk. Geeft null als die er niet is of het geluid uit staat. */
export function playVoice(id: string): Voice | null {
  current?.stop();
  current = null;
  const url = personal[id] ?? (voices[id] ? voiceDir + voices[id] : '');
  if (!url || !ctx || !master || muted) return null;
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
  void load(url).then(buffer => {
    if (voice.done) return;
    if (!buffer) {
      voice.done = true;
      return;
    }
    source = audio.createBufferSource();
    source.buffer = buffer;
    source.connect(analyser);
    source.onended = () => {
      voice.done = true;
    };
    source.start();
    voice.started = true;
  });
  current = voice;
  return voice;
}

// ------------------------------------------------------------ effecten
export interface SfxOptions {
  volume?: number;
  /** Afspeelsnelheid; hoger klinkt ook hoger (jonge dieren). */
  rate?: number;
  /** Niet vaker dan eens per zoveel seconden. */
  every?: number;
}

export function sfx(id: string, { volume = 1, rate = 1, every = 0.06 }: SfxOptions = {}): void {
  const files = effects[id];
  if (!files?.length || !ctx || !master || muted || ctx.state !== 'running') return;
  const now = ctx.currentTime;
  if (now - (lastPlayed.get(id) ?? -99) < every) return;
  lastPlayed.set(id, now);
  const audio = ctx, out = master;
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

/** Het geluid van een dier; jonge dieren klinken hoger. */
export function animalSound(species: string, young: boolean, volume = 1): void {
  sfx(`animal.${species}`, { volume: volume * 0.7, rate: young ? 1.4 : 1, every: 0.4 });
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
  const audio = ctx, out = master;
  const have = layers.get(id);
  if (have && have !== 'loading') {
    have.gain.gain.setTargetAtTime(volume * GAIN.ambience, audio.currentTime, 1.2);
    return;
  }
  const files = effects[id];
  if (have || volume <= 0 || !files?.length) return;
  layers.set(id, 'loading');
  void load(`./audio/sfx/${files[0]}`).then(buffer => {
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

// ------------------------------------------------------------ muziek
let tune: { id: string; el: HTMLAudioElement; gain: GainNode | null } | null = null;
let wantedTune = '';

/** Rustige achtergrondmuziek die bij de wereld hoort. Het nummer begint steeds opnieuw, met een korte stilte ertussen. */
export function music(world: string): void {
  wantedTune = world;
  const file = tracks[world];
  if (!ctx || !master || tune?.id === world) return;
  if (tune) {
    const old = tune;
    old.gain?.gain.setTargetAtTime(0, ctx.currentTime, 1);
    setTimeout(() => old.el.pause(), 4000);
    tune = null;
  }
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
    setTimeout(() => {
      if (tune?.el === el) void el.play().catch(() => undefined);
    }, 6000);
  });
  void el.play().catch(() => undefined);
  tune = { id: world, el, gain };
}

/** Na de eerste tik: het achtergrondgeluid, de lagen en de muziek die al gevraagd waren alsnog starten. */
export function resumeAmbience(): void {
  if (wantedAmbience && !ambient) ambience(wantedAmbience);
  for (const [id, volume] of layerVolume) if (!layers.has(id)) layer(id, volume);
  if (wantedTune && !tune) music(wantedTune);
}
