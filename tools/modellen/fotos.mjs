// Hulpje bij de modellenpagina (games/zoo/modellen.html): bewaart de foto's die de pagina opstuurt.
//
//   node tools/modellen/fotos.mjs [map]
//
// Luistert alleen op deze computer (poort 5198). De pagina stuurt met `foto('voor/bedden')` een plaatje naar
// /voor/bedden.jpg; dat komt in docs/modellen/voor/bedden.jpg (of in de map die je meegeeft).
import { createServer } from 'node:http';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(process.argv[2] ?? join(dirname(fileURLToPath(import.meta.url)), '../../docs/modellen'));
const PORT = 5198;

createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') return res.writeHead(204).end();
  // alleen een plaatje in een eigen mapje, met een gewone naam: nooit ergens anders heen
  const name = /^\/([a-z0-9-]+\/[a-z0-9-]+\.jpg)$/.exec(req.url ?? '')?.[1];
  if (req.method !== 'POST' || !name) return res.writeHead(400).end('nee');
  const chunks = [];
  req.on('data', chunk => chunks.push(chunk));
  req.on('end', () => {
    const file = join(root, name);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, Buffer.concat(chunks));
    res.end(`bewaard: ${name}`);
  });
}).listen(PORT, '127.0.0.1', () => console.log(`Foto's komen in ${root} (poort ${PORT})`));
