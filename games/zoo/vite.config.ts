import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const page = (name: string): string => fileURLToPath(new URL(name, import.meta.url));

/**
 * De ElevenLabs-sleutel uit `.env` in de hoofdmap, alleen voor `npm run dev` op de eigen computer.
 * Bij het bouwen van de site is dit altijd leeg: de sleutel komt nooit in het gepubliceerde spel.
 */
function devKey(command: string): string {
  if (command !== 'serve') return '';
  try {
    const env = readFileSync(page('../../.env'), 'utf8');
    return /^ELEVENLABS_API_KEY=(.*)$/m.exec(env)?.[1].trim().replace(/^["']|["']$/g, '') ?? '';
  } catch {
    return '';
  }
}

// Relatieve paden, zodat het spel in elke submap van de site werkt.
export default defineConfig(({ command }) => ({
  base: './',
  define: { __ELEVEN_DEV_KEY__: JSON.stringify(devKey(command)) },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 900,
    rollupOptions: { input: { index: page('./index.html'), figuren: page('./figuren.html') } },
  },
}));
