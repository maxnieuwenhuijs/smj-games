import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const page = (name: string): string => fileURLToPath(new URL(name, import.meta.url));

// Relatieve paden, zodat het spel in elke submap van de site werkt.
export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 900,
    rollupOptions: { input: { index: page('./index.html'), figuren: page('./figuren.html') } },
  },
});
