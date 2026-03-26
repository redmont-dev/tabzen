import sharp from 'sharp';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsDir = join(__dirname, '..', 'icons');

function createSvg(size, mode = 'light') {
  const padding = Math.round(size * 0.1);
  const inner = size - padding * 2;
  const scale = inner / 28;

  function cx(x) { return padding + x * scale; }
  function cy(y) { return padding + y * scale; }
  const r = 3 * scale;

  const bg = mode === 'light' ? 'white' : '#1a1a1a';
  const dot = mode === 'light' ? '#1a1a1a' : '#e5e5e5';
  const dotOpacity = mode === 'light' ? '0.35' : '0.3';

  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" fill="${bg}" rx="${Math.round(size * 0.15)}"/>
  <circle cx="${cx(6)}" cy="${cy(6)}" r="${r}" fill="#3b82f6"/>
  <circle cx="${cx(14)}" cy="${cy(6)}" r="${r}" fill="${dot}" opacity="${dotOpacity}"/>
  <circle cx="${cx(22)}" cy="${cy(6)}" r="${r}" fill="${dot}" opacity="${dotOpacity}"/>
  <circle cx="${cx(6)}" cy="${cy(14)}" r="${r}" fill="${dot}" opacity="${dotOpacity}"/>
  <circle cx="${cx(14)}" cy="${cy(14)}" r="${r}" fill="#22c55e"/>
  <circle cx="${cx(22)}" cy="${cy(14)}" r="${r}" fill="${dot}" opacity="${dotOpacity}"/>
  <circle cx="${cx(6)}" cy="${cy(22)}" r="${r}" fill="${dot}" opacity="${dotOpacity}"/>
  <circle cx="${cx(14)}" cy="${cy(22)}" r="${r}" fill="${dot}" opacity="${dotOpacity}"/>
  <circle cx="${cx(22)}" cy="${cy(22)}" r="${r}" fill="#a855f7"/>
</svg>`;
}

const sizes = [16, 32, 48, 128];

for (const size of sizes) {
  // Light mode icons
  const lightSvg = createSvg(size, 'light');
  await sharp(Buffer.from(lightSvg))
    .png()
    .toFile(join(iconsDir, `icon-${size}.png`));
  console.log(`Generated icon-${size}.png (light)`);

  // Dark mode icons
  const darkSvg = createSvg(size, 'dark');
  await sharp(Buffer.from(darkSvg))
    .png()
    .toFile(join(iconsDir, `icon-${size}-dark.png`));
  console.log(`Generated icon-${size}-dark.png`);
}

console.log('Done!');
