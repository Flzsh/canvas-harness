import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// Content scripts cannot be ES modules, so they are built separately as a single IIFE.
export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    target: 'chrome116',
    lib: {
      entry: resolve(__dirname, 'src/content/activity.ts'),
      formats: ['iife'],
      name: 'NotePilotActivity',
      fileName: () => 'content.js',
    },
  },
});
