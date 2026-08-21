/**
 * Force functional OCR labels on fruit-grid PNGs:
 * white bottom 20% of each cell + plain black sans-serif text.
 *
 * Usage:
 *   node scripts/normalize-fruit-grid-labels.js [inputDir] [outputDir]
 */
const fs = require('fs');
const path = require('path');

const FRUITS = [
  'apple', 'banana', 'orange', 'strawberry',
  'grape', 'watermelon', 'pineapple', 'cherry',
  'lemon', 'peach', 'kiwi', 'mango',
  'pear', 'blueberry', 'coconut', 'avocado'
];

const ROWS = 4;
const COLS = 4;
const LABEL_PCT = 0.24; // slightly taller than 20% to erase leftover AI divider lines

async function normalizeGrid(sharp, inputPath, outputPath) {
  const meta = await sharp(inputPath).metadata();
  const w = meta.width;
  const h = meta.height;
  const cellW = Math.floor(w / COLS);
  const cellH = Math.floor(h / ROWS);
  const labelH = Math.max(12, Math.round(cellH * LABEL_PCT));
  const fontSize = Math.max(10, Math.round(labelH * 0.42));

  const composites = [];
  for (let i = 0; i < FRUITS.length; i++) {
    const row = Math.floor(i / COLS);
    const col = i % COLS;
    const left = col * cellW;
    const top = row * cellH + (cellH - labelH);
    const fruit = FRUITS[i];
    const whiteBand = await sharp({
      create: {
        width: cellW,
        height: labelH,
        channels: 3,
        background: { r: 255, g: 255, b: 255 }
      }
    })
      .png()
      .toBuffer();

    const svg = Buffer.from(
      `<svg width="${cellW}" height="${labelH}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#ffffff"/>
        <text x="50%" y="52%" dominant-baseline="middle" text-anchor="middle"
          font-family="Inter, Arial, Helvetica, sans-serif"
          font-size="${fontSize}" font-weight="500" fill="#000000">${fruit}</text>
      </svg>`
    );

    composites.push({ input: whiteBand, left: left, top: top });
    composites.push({ input: svg, left: left, top: top });
  }

  await sharp(inputPath)
    .composite(composites)
    .png()
    .toFile(outputPath);
}

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

  if (!fs.existsSync(inputDir)) {
    console.error('Input dir missing:', inputDir);
    process.exit(1);
  }
  fs.mkdirSync(outputDir, { recursive: true });

  const files = fs
    .readdirSync(inputDir)
    .filter((f) => /^fruit-grid-.+\.png$/i.test(f) && f !== 'fruit-grid-4x4.png');

  if (!files.length) {
    console.error('No fruit-grid-*.png found in', inputDir);
    process.exit(1);
  }

  for (const file of files) {
    const input = path.join(inputDir, file);
    const tmpPng = path.join(outputDir, file);
    const webp = path.join(outputDir, file.replace(/\.png$/i, '.webp'));
    console.log('Normalize', file);
    await normalizeGrid(sharp, input, tmpPng);
    await sharp(tmpPng)
      .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82, effort: 5 })
      .toFile(webp);
    fs.unlinkSync(tmpPng);
    console.log(' ->', path.basename(webp));
  }

  console.log('Done:', files.length, 'grids');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
