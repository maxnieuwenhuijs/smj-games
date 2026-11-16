// Kleine hulpjes om met ElevenLabs te praten. De sleutel komt uit `.env` in de hoofdmap
// (ELEVENLABS_API_KEY=...). Dat bestand staat in .gitignore en mag nooit in de repo komen.
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const API = 'https://api.elevenlabs.io';

export function apiKey() {
  if (process.env.ELEVENLABS_API_KEY) return process.env.ELEVENLABS_API_KEY.trim();
  const file = join(ROOT, '.env');
  if (existsSync(file)) {
    for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*ELEVENLABS_API_KEY\s*=\s*(.+?)\s*$/);
      if (m) return m[1].replace(/^["']|["']$/g, '');
    }
  }
  throw new Error('Geen sleutel gevonden. Zet ELEVENLABS_API_KEY=... in het bestand .env in de hoofdmap.');
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

/** Roept de API aan. Geeft JSON terug, of een Buffer als het antwoord geluid is. Probeert het opnieuw bij drukte. */
export async function eleven(path, { method = 'GET', body, query } = {}) {
  const url = new URL(API + path);
  for (const [k, v] of Object.entries(query ?? {})) if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  for (let attempt = 0; ; attempt++) {
    let res;
    try {
      res = await fetch(url, {
        method,
        headers: { 'xi-api-key': apiKey(), ...(body ? { 'Content-Type': 'application/json' } : {}) },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (err) {
      if (attempt < 4) { await sleep(1500 * (attempt + 1)); continue; }
      throw err;
    }
    if ((res.status === 429 || res.status >= 500) && attempt < 5) {
      await sleep(2000 * (attempt + 1));
      continue;
    }
    const type = res.headers.get('content-type') ?? '';
    if (!res.ok) {
      const text = await res.text();
      const err = new Error(`${method} ${path} -> ${res.status}: ${text.slice(0, 400)}`);
      err.status = res.status;
      throw err;
    }
    if (type.includes('application/json')) return res.json();
    return Buffer.from(await res.arrayBuffer());
  }
}

/** Voert taken uit met een paar tegelijk. */
export async function pool(items, size, work) {
  let next = 0;
  const run = async () => {
    while (next < items.length) {
      const i = next++;
      await work(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, run));
}
