// De naam van de speler, uitgesproken door de figuren. Er zijn drie manieren waarop het spel aan die
// opnames komt:
//   1. De naam staat in het lijstje namen dat al is ingesproken (tools/voice/names.json).
//   2. De naam is op dit apparaat eerder ingesproken en bewaard.
//   3. Een ouder heeft in het oudermenu een eigen ElevenLabs-sleutel ingevuld: dan wordt de naam nu ingesproken
//      en op dit apparaat bewaard. De sleutel blijft in deze browser en gaat alleen naar ElevenLabs zelf.
// Lukt geen van drie, dan staat de naam alleen in beeld en klinken de gewone complimenten.
import { saveGet, saveSet, t } from '@smj/shared';
import cast from '../../../tools/voice/voices.json';
import { setPersonalVoices } from './audio';
import { namedLines, voiceId } from './lines';

const KEY_STORE = 'zoo-eleven-key';
type Cast = Record<string, Record<string, { voice: string; model?: string; settings?: Record<string, number> }>>;

export function elevenKey(): string {
  try {
    return localStorage.getItem(KEY_STORE) ?? '';
  } catch {
    return '';
  }
}

export function setElevenKey(key: string): void {
  try {
    if (key.trim()) localStorage.setItem(KEY_STORE, key.trim());
    else localStorage.removeItem(KEY_STORE);
  } catch {
    /* dan blijft het zoals het was */
  }
}

/** Een naam zoals we hem bewaren: zonder rare tekens, niet te lang, met een hoofdletter. */
export function cleanName(raw: string): string {
  const name = raw.replace(/[^\p{L}\p{M}' -]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 14);
  return name ? name.charAt(0).toUpperCase() + name.slice(1) : '';
}

/**
 * Zoekt de opnames met deze naam erin en geeft ze door aan het geluid. Geeft terug of de naam kan klinken.
 * `onWait` wordt aangeroepen als de naam nu nog ingesproken moet worden (dat duurt een paar tellen).
 */
export async function loadName(lang: string, name: string, onWait?: () => void): Promise<boolean> {
  setPersonalVoices({});
  if (!name) return false;
  const key = name.toLowerCase();
  // 1. al ingesproken en meegeleverd met het spel
  try {
    const res = await fetch(`./audio/${lang}/names.json`, { cache: 'no-cache' });
    const known = res.ok ? ((await res.json()) as Record<string, Record<string, string>>)[key] : undefined;
    if (known) {
      setPersonalVoices(Object.fromEntries(Object.entries(known).map(([id, file]) => [id, `./audio/${lang}/names/${file}`])));
      return true;
    }
  } catch {
    /* geen lijstje: verder zoeken */
  }
  // 2. eerder op dit apparaat ingesproken
  const store = `zoo-name-${lang}-${key}`;
  let clips = await saveGet<Record<string, ArrayBuffer>>(store);
  // 3. nu inspreken met de sleutel van de ouder
  const apiKey = elevenKey();
  const voices = (cast as { languages: Cast; model: string; format: string; settings: Record<string, number> });
  if (!clips && apiKey && voices.languages[lang]) {
    onWait?.();
    try {
      const made: Record<string, ArrayBuffer> = {};
      for (const line of namedLines(t, name)) {
        const who = voices.languages[lang][line.who];
        const model = who.model ?? voices.model;
        const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${who.voice}?output_format=${voices.format}`, {
          method: 'POST',
          headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: line.text, model_id: model, voice_settings: { ...voices.settings, ...who.settings },
            ...(model === 'eleven_multilingual_v2' ? {} : { language_code: lang }),
          }),
        });
        if (!res.ok) throw new Error(String(res.status));
        made[voiceId(line.who, line.text)] = await res.arrayBuffer();
      }
      clips = made;
      await saveSet(store, clips);
    } catch {
      clips = undefined; // inspreken lukte niet: dan zonder naam
    }
  }
  if (!clips) return false;
  setPersonalVoices(Object.fromEntries(Object.entries(clips).map(([id, data]) => [id, URL.createObjectURL(new Blob([data], { type: 'audio/mpeg' }))])));
  return true;
}
