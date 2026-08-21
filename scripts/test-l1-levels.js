/**
 * Quick L1 parse check against grid2icons-levels fixtures.
 * Usage: node scripts/test-l1-levels.js [levelsDir]
 */
const path = require('path');
const Jimp = require('jimp');
const parseAuto = require('../js/parseAuto');

const DEFAULT_DIR = path.join(__dirname, '..', 'Examples', 'l1-simple');

const CASES = [
  { f: 'L1-01-3x3-finance-no-lines.png', n: 9 },
  { f: 'L1-02-3x3-finance-blacklines.png', n: 9 },
  { f: 'L1-03-4x4-ui-no-lines.png', n: 16 },
  { f: 'L1-04-4x4-ui-blacklines.png', n: 16 },
  { f: 'L1-05-4x4-food-no-lines.png', n: 16 },
  { f: 'L1-06-4x4-food-blacklines.png', n: 16 },
  { f: 'L1-07-4x5-emoji-no-lines.png', n: 20 },
  { f: 'L1-08-3x3-animaux-recrop.png', n: 9 },
  { f: 'L1-09-2x2-shapes-no-lines.png', n: 4 },
  { f: 'L1-10-3x3-tools-blacklines.png', n: 9 },
  { f: 'L1-11-4x4-fruit-no-lines.png', n: 16 }
];

async function main() {
  const dir = process.argv[2] || DEFAULT_DIR;
  let pass = 0;
  let fail = 0;
  for (const c of CASES) {
    const file = path.join(dir, c.f);
    const img = await Jimp.read(file);
    const { data, width, height } = img.bitmap;
    const imageData = { data: new Uint8ClampedArray(data), width: width, height: height };
    const r = parseAuto.selectBestParse(
      { data: imageData.data, width: width, height: height },
      { imageData: imageData, maxSide: 640 }
    );
    const ok = r && r.cellCount === c.n;
    if (ok) pass++;
    else fail++;
    console.log(
      (ok ? 'PASS' : 'FAIL'),
      c.f,
      'want',
      c.n,
      'got',
      r && r.cellCount,
      r && r.mode,
      r && r.source,
      'score',
      r && Math.round(r.score)
    );
  }
  console.log('Summary', pass + '/' + (pass + fail));
  if (fail) process.exit(1);
}

main().catch(function (err) {
  console.error(err);
  process.exit(1);
});
