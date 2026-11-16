// Maakt de diermodellen kleiner, zodat ze snel laden op een tablet.
//
//   node tools/animals/optimize.mjs            alle modellen in games/zoo/public/models
//   node tools/animals/optimize.mjs pig cow    alleen deze soorten
//
// Draai dit na elke export uit Blender (tools/animals/build_animals.py). Een model dat al klein gemaakt
// is, wordt overgeslagen. Er gaat niets zichtbaars verloren: dubbele punten en overbodige animatiestappen
// verdwijnen, getallen worden compacter opgeslagen en het geheel wordt ingepakt (meshopt).
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { EXTMeshoptCompression, KHRMeshQuantization } from '@gltf-transform/extensions';
import { dedup, meshopt, prune, resample, weld } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';

const MODELS = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'games', 'zoo', 'public', 'models');
const only = process.argv.slice(2);

await MeshoptDecoder.ready;
await MeshoptEncoder.ready;
const io = new NodeIO()
  .registerExtensions([EXTMeshoptCompression, KHRMeshQuantization])
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });

let before = 0, after = 0, done = 0, skipped = 0;
for (const file of readdirSync(MODELS).filter(f => f.endsWith('.glb')).sort()) {
  if (only.length && !only.some(sp => file.startsWith(`${sp}_`) || file === `${sp}.glb`)) continue;
  const path = join(MODELS, file);
  const size = statSync(path).size;
  const doc = await io.read(path);
  if (doc.getRoot().listExtensionsUsed().some(e => e.extensionName === 'EXT_meshopt_compression')) {
    skipped++;
    continue;
  }
  await doc.transform(dedup(), prune(), weld(), resample({ tolerance: 1e-4 }), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  await io.write(path, doc);
  before += size;
  after += statSync(path).size;
  done++;
}
// Elk model krijgt in het lijstje een vingerafdruk van zijn inhoud. Het spel zet die achter de bestandsnaam,
// zodat een gewijzigd model ook bij spelers met een opgeslagen (offline) versie opnieuw wordt opgehaald.
const manifestPath = join(MODELS, 'manifest.json');
if (existsSync(manifestPath)) {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  for (const [key, info] of Object.entries(manifest.models ?? {})) {
    const file = join(MODELS, `${key}.glb`);
    if (existsSync(file)) info.v = createHash('sha1').update(readFileSync(file)).digest('hex').slice(0, 8);
  }
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 1)}\n`);
}
const mb = n => (n / 1048576).toFixed(1);
console.log(`${done} modellen kleiner gemaakt: ${mb(before)} MB -> ${mb(after)} MB. ${skipped} waren al klaar.`);
