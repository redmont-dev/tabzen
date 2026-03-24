import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { resolve } from 'path';

export default defineConfig({
  plugins: [preact()],
  resolve: {
    alias: {
      '@tabzen/shared': resolve(__dirname, '../../shared'),
    },
  },
  build: {
    outDir: 'dist',
  },
});
