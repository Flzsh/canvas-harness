'use strict';
// Optional build tool: install sharp to regenerate PNGs. Extension runtime needs no dependency.
// All sizes deliberately use the original large artwork in extension/icon.svg.
const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require('sharp');

async function main() {
  const root = path.resolve(__dirname, '..', 'extension');
  const source = await fs.readFile(path.join(root, 'icon.svg'));
  await fs.mkdir(path.join(root, 'icons'), { recursive: true });
  for (const size of [16, 32, 48, 128]) {
    await sharp(source, { density: 288 }).resize(size, size).png()
      .toFile(path.join(root, 'icons', `icon-${size}.png`));
  }
  console.log('Rendered all four browser icons from the large Canvas Harness logo.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
