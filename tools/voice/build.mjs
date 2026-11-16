// Maakt alle stemmen en geluiden van het spel met ElevenLabs en zet ze in games/zoo/public/audio.
//
//   node tools/voice/build.mjs plan            alleen tellen: hoeveel zinnen, tekens en geluiden ontbreken er
//   node tools/voice/build.mjs voices [nl|en]  de ontbrekende ingesproken zinnen maken
//   node tools/voice/build.mjs sfx             de ontbrekende effecten, dierengeluiden en achtergronden maken
//   node tools/voice/build.mjs all             alles
//   node tools/voice/build.mjs list            de stemmen in het account tonen
//   extra: --limit 5 (hooguit zoveel nieuwe bestanden), --only keeper (alleen dit figuur of geluid dat zo begint)
//
// De zinnen komen uit het spel zelf (games/zoo/src/lines.ts), zodat spel en stem nooit uit elkaar lopen.
// Wat al gemaakt is, wordt overgeslagen: alleen nieuwe of gewijzigde zinnen kosten tegoed. Verandert een
// stem, het model of een instelling, dan worden de zinnen van dat figuur opnieuw gemaakt.
// De sleutel staat in .env (ELEVENLABS_API_KEY) en komt nooit in de repo of in het spel.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, eleven, pool } from './eleven.mjs';

const HERE = join(ROOT, 'tools', 'voice');
const SRC = join(ROOT, 'games', 'zoo', 'src');
const AUDIO = join(ROOT, 'games', 'zoo', 'public', 'audio');
const args = process.argv.slice(2);
const mode = args.find(a => !a.startsWith('--') && !/^\d+$/.test(a)) ?? 'plan';
const flag = name => {
  const i = args.indexOf(`--${name}`);
  return i < 0 ? undefined : args[i + 1];
};
const LIMIT = Number(flag('limit') ?? Infinity);
const ONLY = flag('only');
const readJson = (file, fallback) => (existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : fallback);
const writeJson = (file, data) => writeFileSync(file, JSON.stringify(data, null, 1) + '\n');
const short = text => createHash('sha1').update(text).digest('hex').slice(0, 6);

/** Het spel zelf vertelt welke zinnen er zijn. */
async function gameLines() {
  const require = createRequire(import.meta.url);
  const { build } = require('esbuild');
  const out = join(ROOT, 'node_modules', '.cache', 'zoo-lines.mjs');
  await build({ entryPoints: [join(SRC, 'lines.ts')], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'silent' });
  return import(`${pathToFileURL(out).href}?t=${Date.now()}`);
}

// ------------------------------------------------------------ stemmen
async function voiceJobs(lang, config) {
  const { allLines, voiceId, fill } = await gameLines();
  const table = { ...readJson(join(SRC, 'nl.json')), ...readJson(join(SRC, `${lang}.json`)) };
  const tr = (key, vars) => fill(table[key] ?? key, vars);
  const cast = config.languages[lang];
  if (!cast) throw new Error(`Geen stemmen ingesteld voor taal ${lang} (tools/voice/voices.json).`);
  const dir = join(AUDIO, lang);
  const manifest = readJson(join(dir, 'voice.json'), {});
  const wanted = {};
  const jobs = [];
  for (const line of allLines(tr)) {
    const who = cast[line.who];
    if (!who) throw new Error(`Geen stem voor ${line.who} in ${lang}.`);
    const model = who.model ?? config.model;
    const settings = { ...config.settings, ...who.settings };
    const id = voiceId(line.who, line.text);
    const file = `${id}-${short(JSON.stringify([who.voice, model, settings, config.format]))}.mp3`;
    wanted[id] = file;
    if (manifest[id] !== file || !existsSync(join(dir, file))) jobs.push({ ...line, id, file, voice: who.voice, model, settings });
  }
  return { dir, manifest, wanted, jobs: ONLY ? jobs.filter(j => j.who === ONLY) : jobs };
}

async function buildVoices(lang, config, dry) {
  const { dir, manifest, wanted, jobs } = await voiceJobs(lang, config);
  const chars = jobs.reduce((n, j) => n + j.text.length, 0);
  console.log(`[${lang}] ${Object.keys(wanted).length} zinnen, ${jobs.length} te maken (${chars} tekens)`);
  if (dry || !jobs.length) return;
  mkdirSync(dir, { recursive: true });
  const todo = jobs.slice(0, LIMIT);
  let done = 0, failed = 0;
  await pool(todo, 4, async job => {
    try {
      const body = { text: job.text, model_id: job.model, voice_settings: job.settings };
      if (config.language_code !== false && job.model !== 'eleven_multilingual_v2') body.language_code = lang;
      const audio = await eleven(`/v1/text-to-speech/${job.voice}`, { method: 'POST', query: { output_format: config.format }, body });
      writeFileSync(join(dir, job.file), audio);
      manifest[job.id] = job.file;
      if (++done % 20 === 0) {
        writeJson(join(dir, 'voice.json'), manifest);
        console.log(`[${lang}] ${done}/${todo.length}`);
      }
    } catch (err) {
      failed++;
      console.log(`[${lang}] MISLUKT (${job.who}) "${job.text}": ${err.message}`);
      if (failed > 8) throw new Error('Te veel fouten achter elkaar; gestopt.');
    }
  });
  // alleen bewaren wat het spel nog gebruikt
  for (const id of Object.keys(manifest)) if (!ONLY && LIMIT === Infinity && wanted[id] !== manifest[id]) delete manifest[id];
  writeJson(join(dir, 'voice.json'), Object.fromEntries(Object.entries(manifest).sort()));
  if (!ONLY && LIMIT === Infinity) {
    const keep = new Set(Object.values(manifest));
    for (const f of readdirSync(dir)) if (f.endsWith('.mp3') && !keep.has(f)) rmSync(join(dir, f));
  }
  console.log(`[${lang}] klaar: ${done} gemaakt, ${failed} mislukt, ${Object.keys(manifest).length} in het lijstje`);
}

// ------------------------------------------------------------ effecten
async function buildSfx(dry) {
  const config = readJson(join(HERE, 'sounds.json'));
  const dir = join(AUDIO, 'sfx');
  const manifest = readJson(join(dir, 'sfx.json'), {});
  const wanted = {};
  const jobs = [];
  for (const s of config.sounds) {
    const model = s.model ?? config.model;
    const gen = short(JSON.stringify([s.prompt, s.seconds, s.influence ?? config.influence, !!s.loop, model, config.format]));
    const files = Array.from({ length: s.variants ?? 1 }, (_, i) => `${s.id}-${i + 1}-${gen}.mp3`);
    wanted[s.id] = files;
    files.forEach((file, i) => {
      if (!(manifest[s.id] ?? []).includes(file) || !existsSync(join(dir, file))) jobs.push({ ...s, model, file, index: i });
    });
  }
  const picked = ONLY ? jobs.filter(j => j.id.startsWith(ONLY)) : jobs;
  const seconds = picked.reduce((n, j) => n + j.seconds, 0);
  console.log(`[sfx] ${config.sounds.length} geluiden, ${picked.length} te maken (${seconds.toFixed(0)} seconden)`);
  if (dry || !picked.length) return;
  mkdirSync(dir, { recursive: true });
  const todo = picked.slice(0, LIMIT);
  let done = 0, failed = 0;
  await pool(todo, 3, async job => {
    try {
      const audio = await eleven('/v1/sound-generation', {
        method: 'POST',
        query: { output_format: config.format },
        body: { text: job.prompt, duration_seconds: job.seconds, prompt_influence: job.influence ?? config.influence, loop: !!job.loop, model_id: job.model },
      });
      writeFileSync(join(dir, job.file), audio);
      manifest[job.id] = [...new Set([...(manifest[job.id] ?? []).filter(f => wanted[job.id].includes(f)), job.file])].sort();
      writeJson(join(dir, 'sfx.json'), manifest);
      console.log(`[sfx] ${++done}/${todo.length} ${job.id}`);
    } catch (err) {
      failed++;
      console.log(`[sfx] MISLUKT ${job.id}: ${err.message}`);
      if (failed > 6) throw new Error('Te veel fouten achter elkaar; gestopt.');
    }
  });
  if (!ONLY && LIMIT === Infinity) {
    for (const id of Object.keys(manifest)) {
      if (!wanted[id]) delete manifest[id];
      else manifest[id] = manifest[id].filter(f => wanted[id].includes(f));
    }
    const keep = new Set(Object.values(manifest).flat());
    for (const f of readdirSync(dir)) if (f.endsWith('.mp3') && !keep.has(f)) rmSync(join(dir, f));
  }
  writeJson(join(dir, 'sfx.json'), Object.fromEntries(Object.entries(manifest).sort()));
  console.log(`[sfx] klaar: ${done} gemaakt, ${failed} mislukt`);
}

// ------------------------------------------------------------ uitvoeren
async function credits() {
  try {
    const s = await eleven('/v1/user/subscription');
    console.log(`Tegoed: ${s.character_limit - s.character_count} van ${s.character_limit} over (${s.tier}).`);
  } catch (err) {
    console.log(`Tegoed niet op te vragen: ${err.message}`);
  }
}

const config = readJson(join(HERE, 'voices.json'));
const langs = args.filter(a => a in config.languages);
const allLangs = langs.length ? langs : Object.keys(config.languages);

if (mode === 'list') {
  const v = await eleven('/v2/voices', { query: { page_size: 100 } });
  for (const x of v.voices) console.log([x.voice_id, x.name, x.category, x.labels?.language ?? '', x.labels?.gender ?? '', x.labels?.age ?? '', x.labels?.descriptive ?? ''].join(' | '));
} else if (mode === 'plan') {
  for (const lang of allLangs) await buildVoices(lang, config, true);
  await buildSfx(true);
  await credits();
} else {
  await credits();
  if (mode === 'voices' || mode === 'all') for (const lang of allLangs) await buildVoices(lang, config, false);
  if (mode === 'sfx' || mode === 'all') await buildSfx(false);
  await credits();
}
