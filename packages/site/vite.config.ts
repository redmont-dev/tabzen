import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { resolve } from 'path';

export default defineConfig({
  plugins: [preact()],
  resolve: {
    alias: {
      '@tabzen/shared': resolve(__dirname, '../../shared'),
      'preact/jsx-dev-runtime': resolve(__dirname, 'node_modules/preact/jsx-runtime'),
      'preact/jsx-runtime': resolve(__dirname, 'node_modules/preact/jsx-runtime'),
      'preact': resolve(__dirname, 'node_modules/preact'),
    },
  },
  build: {
    outDir: 'dist',
  },
});
