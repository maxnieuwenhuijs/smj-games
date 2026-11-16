import { defineConfig } from 'vite';

// Relatieve paden, zodat het spel in elke submap van de site werkt.
export default defineConfig({ base: './', build: { target: 'es2022', chunkSizeWarningLimit: 900 } });
