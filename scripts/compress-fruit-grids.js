/**
 * Convert fruit-grid PNGs to WebP WITHOUT modifying labels.
 * Usage: node scripts/compress-fruit-grids.js [inputDir] [outputDir]
 */
const fs = require('fs');
const path = require('path');

async function main() {
  let sharp;
  try {
    sharp = require('sharp');
  } catch (e) {
    console.error('Install sharp: npm install --save-dev sharp');
    process.exit(1);
  }

  const inputDir =
    process.argv[2] ||
    path.join(
      process.env.USERPROFILE || '',
      '.cursor',
      'projects',
      'c-Users-cramp-Projects-GridParser',
      'assets'
    );
  const outputDir =
    process.argv[3] || path.join(__dirname, '..', 'assets', 'styles');

  fs.mkdirSync(outputDir, { recursive: true });
  const files = fs
    .readdirSync(inputDir)
    .filter((f) => /^fruit-grid-.+\.png$/i.test(f) && !/^fruit-grid-4x4\.png$/i.test(f));

  if (!files.length) {
    console.error('No fruit-grid-*.png in', inputDir);
    process.exit(1);
  }

  for (const file of files) {
    const input = path.join(inputDir, file);
    const webp = path.join(outputDir, file.replace(/\.png$/i, '.webp'));
    await sharp(input)
      .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 84, effort: 5 })
      .toFile(webp);
    console.log(file, '->', path.basename(webp));
  }
  console.log('Done:', files.length, '(labels untouched)');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
