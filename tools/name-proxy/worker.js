// Een klein servertje (Cloudflare Worker) dat de naam van een speler laat inspreken, zonder dat de
// ElevenLabs-sleutel in het spel of in de repo staat. De sleutel is een geheim van de Worker zelf.
//
// Wat het wel en niet doet:
// - Het spreekt alleen de vaste zinnen met een naam in (lines.js), met de vaste stemmen. Vrije tekst kan niet.
// - Een naam is hooguit 14 letters. Het antwoord wordt bewaard, dus dezelfde naam kost maar één keer tegoed.
// - Alleen het spel zelf (de adressen in ORIGINS) mag het aanroepen vanuit een browser.
// - Is er een KV-opslag NAMES gekoppeld, dan worden er per dag hooguit MAX_NAMES_PER_DAY nieuwe namen gemaakt.
import LINES from './lines.js';

const ORIGINS = ['https://maxnieuwenhuijs.github.io', 'http://localhost:5173'];
const NAME = /^[\p{L}\p{M}' -]{1,14}$/u;
const MAX_NAMES_PER_DAY = 40;

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get('Origin') ?? '';
    const cors = {
      'Access-Control-Allow-Origin': ORIGINS.includes(origin) ? origin : ORIGINS[0],
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      Vary: 'Origin',
    };
    const reply = (text, status) => new Response(text, { status, headers: cors });
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (request.method !== 'POST') return reply('alleen POST', 405);
    if (origin && !ORIGINS.includes(origin)) return reply('niet toegestaan', 403);

    let body;
    try {
      body = await request.json();
    } catch {
      return reply('geen geldige vraag', 400);
    }
    const lang = String(body?.lang ?? '');
    const raw = String(body?.name ?? '').replace(/\s+/g, ' ').trim();
    const i = Number(body?.i);
    const list = LINES.languages[lang];
    if (!list || !NAME.test(raw) || !Number.isInteger(i) || i < 0 || i >= list.length) return reply('geen geldige vraag', 400);
    const name = raw.charAt(0).toUpperCase() + raw.slice(1);
    const key = name.toLowerCase();

    // al eens gemaakt: dan kost het niets
    const cache = globalThis.caches?.default;
    const cacheKey = new Request(`https://name-proxy.invalid/${lang}/${encodeURIComponent(key)}/${i}`);
    const hit = cache ? await cache.match(cacheKey) : undefined;
    if (hit) {
      const again = new Response(hit.body, hit);
      for (const [k, v] of Object.entries(cors)) again.headers.set(k, v);
      return again;
    }

    // de dagelijkse rem: hooguit zoveel nieuwe namen per dag
    if (env.NAMES) {
      const day = `dag:${new Date().toISOString().slice(0, 10)}`;
      const seen = JSON.parse((await env.NAMES.get(day)) ?? '[]');
      if (!seen.includes(`${lang}/${key}`)) {
        if (seen.length >= MAX_NAMES_PER_DAY) return reply('vandaag zijn er genoeg namen gemaakt', 429);
        seen.push(`${lang}/${key}`);
        await env.NAMES.put(day, JSON.stringify(seen), { expirationTtl: 172800 });
      }
    }

    if (!env.ELEVENLABS_API_KEY) return reply('de sleutel is niet ingesteld', 500);
    const line = list[i];
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${line.voice}?output_format=${LINES.format}`, {
      method: 'POST',
      headers: { 'xi-api-key': env.ELEVENLABS_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: line.text.replaceAll('{name}', name),
        model_id: line.model,
        voice_settings: line.settings,
        ...(line.model === 'eleven_multilingual_v2' ? {} : { language_code: lang }),
      }),
    });
    if (!res.ok) return reply('inspreken lukte niet', 502);
    const audio = await res.arrayBuffer();
    const out = new Response(audio, { headers: { ...cors, 'Content-Type': 'audio/mpeg', 'Cache-Control': 'public, max-age=31536000' } });
    if (cache) ctx.waitUntil(cache.put(cacheKey, out.clone()));
    return out;
  },
};
