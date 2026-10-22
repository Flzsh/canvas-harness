import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';

/**
 * Generates dist/manifest.json from manifest.base.json, injecting the OAuth client id and the
 * extension public key from .env / .env.local (see README → "Google OAuth setup").
 */
function manifestPlugin(env: Record<string, string>): Plugin {
  return {
    name: 'notepilot-manifest',
    generateBundle() {
      const base = JSON.parse(readFileSync(resolve(__dirname, 'manifest.base.json'), 'utf8'));
      const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf8'));
      base.version = pkg.version;
      const clientId = env.NOTEPILOT_OAUTH_CLIENT_ID?.trim();
      if (clientId) {
        base.oauth2.client_id = clientId;
      } else {
        this.warn('NOTEPILOT_OAUTH_CLIENT_ID is not set: Google sign-in will not work until you add it (see README).');
      }
      const key = env.NOTEPILOT_EXTENSION_KEY?.trim();
      if (key) base.key = key;
      this.emitFile({ type: 'asset', fileName: 'manifest.json', source: JSON.stringify(base, null, 2) });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, ['NOTEPILOT_', 'VITE_']);
  return {
    plugins: [react(), manifestPlugin(env)],
    resolve: { alias: { '@': resolve(__dirname, 'src') } },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      sourcemap: mode === 'development',
      target: 'chrome116',
      chunkSizeWarningLimit: 1500,
      rollupOptions: {
        input: {
          sidepanel: resolve(__dirname, 'sidepanel.html'),
          background: resolve(__dirname, 'src/background/index.ts'),
        },
        output: {
          entryFileNames: (chunk) => (chunk.name === 'background' ? 'background.js' : 'assets/[name]-[hash].js'),
        },
      },
    },
  };
});
