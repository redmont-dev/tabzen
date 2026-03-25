import sharp from 'sharp';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsDir = join(__dirname, '..', 'icons');

function createSvg(size) {
  // Scale factor from 28x28 viewBox to target size
  const padding = Math.round(size * 0.1); // 10% padding
  const inner = size - padding * 2;
  const scale = inner / 28;

  function cx(x) { return padding + x * scale; }
  function cy(y) { return padding + y * scale; }
  const r = 3 * scale;

  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" fill="white" rx="${Math.round(size * 0.15)}"/>
  <circle cx="${cx(6)}" cy="${cy(6)}" r="${r}" fill="#3b82f6"/>
  <circle cx="${cx(14)}" cy="${cy(6)}" r="${r}" fill="#1a1a1a" opacity="0.35"/>
  <circle cx="${cx(22)}" cy="${cy(6)}" r="${r}" fill="#1a1a1a" opacity="0.35"/>
  <circle cx="${cx(6)}" cy="${cy(14)}" r="${r}" fill="#1a1a1a" opacity="0.35"/>
  <circle cx="${cx(14)}" cy="${cy(14)}" r="${r}" fill="#22c55e"/>
  <circle cx="${cx(22)}" cy="${cy(14)}" r="${r}" fill="#1a1a1a" opacity="0.35"/>
  <circle cx="${cx(6)}" cy="${cy(22)}" r="${r}" fill="#1a1a1a" opacity="0.35"/>
  <circle cx="${cx(14)}" cy="${cy(22)}" r="${r}" fill="#1a1a1a" opacity="0.35"/>
  <circle cx="${cx(22)}" cy="${cy(22)}" r="${r}" fill="#a855f7"/>
</svg>`;
}

const sizes = [16, 32, 48, 128];

for (const size of sizes) {
  const svg = createSvg(size);
  await sharp(Buffer.from(svg))
    .png()
    .toFile(join(iconsDir, `icon-${size}.png`));
  console.log(`Generated icon-${size}.png`);
}

console.log('Done!');
