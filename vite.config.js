import { defineConfig } from 'vite';

export default defineConfig({
  server: { port: 5195, strictPort: true },
  build: {
    // Phaser es grande; se separa en su propio fragmento para cachearlo aparte.
    chunkSizeWarningLimit: 1600,
    rollupOptions: { output: { manualChunks: { phaser: ['phaser'] } } },
  },
  test: { environment: 'node' },
});
