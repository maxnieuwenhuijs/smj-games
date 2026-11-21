// Maakt lines.js: de zinnen met een naam erin, zoals het spel ze kent, met de stem die erbij hoort.
// Het servertje spreekt alleen deze zinnen in; zo kan niemand het voor iets anders gebruiken.
// Draai dit opnieuw als de zinnen met een naam of de stemmen veranderen: node tools/name-proxy/make-lines.mjs
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const SRC = join(ROOT, 'games', 'zoo', 'src');
const readJson = file => JSON.parse(readFileSync(file, 'utf8'));

const require = createRequire(import.meta.url);
const { build } = require('esbuild');
const bundle = join(ROOT, 'node_modules', '.cache', 'zoo-lines-proxy.mjs');
await build({ entryPoints: [join(SRC, 'lines.ts')], bundle: true, format: 'esm', platform: 'node', outfile: bundle, logLevel: 'silent' });
const { namedLines, fill } = await import(`${pathToFileURL(bundle).href}?t=${Date.now()}`);

const config = readJson(join(ROOT, 'tools', 'voice', 'voices.json'));
const languages = {};
for (const lang of Object.keys(config.languages)) {
  const table = { ...readJson(join(SRC, 'nl.json')), ...readJson(join(SRC, `${lang}.json`)) };
  const tr = (key, vars) => fill(table[key] ?? key, vars);
  // de naam blijft als {name} in de zin staan; het servertje vult hem in
  languages[lang] = namedLines(tr, '{name}').map(line => {
    const who = config.languages[lang][line.who];
    return { text: line.text, voice: who.voice, model: who.model ?? config.model, settings: { ...config.settings, ...who.settings } };
  });
}
writeFileSync(join(HERE, 'lines.js'), `// Gemaakt door make-lines.mjs; niet met de hand aanpassen.\nexport default ${JSON.stringify({ format: config.format, languages }, null, 1)};\n`);
console.log(Object.entries(languages).map(([lang, list]) => `${lang}: ${list.length} zinnen`).join(', '));
