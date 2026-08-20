/**
 * Compress gallery thumbs: resize + WebP for faster loads.
 * Usage: node scripts/compress-style-thumbs.js
 */
const fs = require('fs');
const path = require('path');

async function main() {
  let sharp;
  try {
    sharp = require('sharp');
  } catch (e) {
    console.error('Install sharp first: npm install --save-dev sharp');
    process.exit(1);
  }

  const dir = path.join(__dirname, '..', 'assets', 'styles');
  const files = fs.readdirSync(dir).filter((f) => /\.png$/i.test(f));
  let before = 0;
  let after = 0;

  for (const file of files) {
    const input = path.join(dir, file);
    const outName = file.replace(/\.png$/i, '.webp');
    const output = path.join(dir, outName);
    before += fs.statSync(input).size;

    await sharp(input)
      .resize(512, 512, { fit: 'cover', withoutEnlargement: true })
      .webp({ quality: 78, effort: 5 })
      .toFile(output);

    after += fs.statSync(output).size;
    fs.unlinkSync(input);
    console.log(file, '->', outName);
  }

  console.log(
    'Done:',
    files.length,
    'images,',
    (before / 1e6).toFixed(2) + 'MB ->',
    (after / 1e6).toFixed(2) + 'MB'
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
