import { renameSync, rmSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dist = resolve(__dirname, '..', 'dist');

const htmlMoves = [
  ['src/ui/popup/index.html', 'popup.html'],
  ['src/ui/sidepanel/index.html', 'sidepanel.html'],
  ['src/ui/newtab/index.html', 'newtab.html'],
  ['src/ui/options/index.html', 'options.html'],
];

for (const [from, to] of htmlMoves) {
  const src = resolve(dist, from);
  const dest = resolve(dist, to);
  if (existsSync(src)) {
    renameSync(src, dest);
    console.log(`  moved ${from} -> ${to}`);
  }
}

// Clean up empty src/ directory
const srcDir = resolve(dist, 'src');
if (existsSync(srcDir)) {
  rmSync(srcDir, { recursive: true });
  console.log('  removed dist/src/');
}
