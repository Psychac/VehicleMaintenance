import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Preloads the two Geist subsets the UI actually uses (Latin, and Latin-extended for the rupee
 * sign) so text paints in the final font on the first frame instead of swapping in later.
 */
function preloadFonts(): Plugin {
  return {
    name: 'preload-geist-fonts',
    transformIndexHtml: {
      order: 'post',
      handler(_html, ctx) {
        if (!ctx.bundle) return;
        return Object.keys(ctx.bundle)
          .filter((file) => /geist-latin(-ext)?-wght-normal.*\.woff2$/.test(file))
          .map((file) => ({
            tag: 'link',
            attrs: { rel: 'preload', as: 'font', type: 'font/woff2', href: '/' + file, crossorigin: '' },
            injectTo: 'head' as const,
          }));
      },
    },
  };
}

export default defineConfig({
  plugins: [react(), preloadFonts()],
  // sqlite-wasm locates its .wasm via import.meta.url, so it must not be pre-bundled.
  optimizeDeps: { exclude: ['@sqlite.org/sqlite-wasm'] },
  worker: { format: 'es' },
});
