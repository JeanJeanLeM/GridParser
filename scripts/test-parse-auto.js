/**
 * Test parseAuto against synthetic + real fixtures (expected vs result).
 * Usage: npm run test:parse
 */
const fs = require('fs');
const path = require('path');
const Jimp = require('jimp');

const ROOT = path.join(__dirname, '..');

// Load modules (UMD / CommonJS)
const imageBuffer = require('../js/imageBuffer');
const gridDetect = require('../js/gridDetect');
const segmentDetect = require('../js/segmentDetect');
const segmentArrangement = require('../js/segmentArrangement');
const labelDetect = require('../js/labelDetect');

// parseAuto factory expects deps when required from Node
const parseAuto = require('../js/parseAuto');

async function loadRgba(filePath) {
  const img = await Jimp.read(filePath);
  const { data, width, height } = img.bitmap;
  // Jimp uses Buffer RGBA
  return {
    data: new Uint8ClampedArray(data),
    width: width,
    height: height
  };
}

function modeMatches(expected, actual, alternates) {
  if (expected === actual) return true;
  if (alternates && alternates.indexOf(actual) !== -1) return true;
  return false;
}

function evaluateCase(expected, result) {
  const issues = [];
  if (!result) {
    return { ok: false, issues: ['no result'] };
  }
  const expectedCount = expected.cells != null
    ? expected.cells
    : (expected.rows && expected.cols ? expected.rows * expected.cols : null);

  let geometryOk = true;
  if (expectedCount != null) {
    if (result.cellCount !== expectedCount) {
      // Allow ±0 only for exact; also accept correct rows×cols even if clustering differs
      const dimsMatch = expected.rows && expected.cols &&
        ((result.rows === expected.rows && result.cols === expected.cols) ||
         (result.rows === expected.cols && result.cols === expected.rows));
      if (!dimsMatch) {
        geometryOk = false;
        issues.push('grid expected ' + (expected.rows || '?') + 'x' + (expected.cols || '?') +
          ' (' + expectedCount + ' cells) got ' + result.rows + 'x' + result.cols +
          ' (' + result.cellCount + ' cells)');
      }
    } else if (expected.rows && expected.cols) {
      if (result.rows !== expected.rows || result.cols !== expected.cols) {
        issues.push('rows/cols ' + result.rows + 'x' + result.cols + ' (count ok ' + result.cellCount + ')');
      }
    }
  }

  if (!modeMatches(expected.mode, result.mode, expected.modeAlternates)) {
    issues.push('mode expected ' + expected.mode + ' got ' + result.mode);
  }

  if (typeof expected.hasLabel === 'boolean' && result.label) {
    if (expected.hasLabel !== !!result.label.hasLabel) {
      issues.push('label.hasLabel expected ' + expected.hasLabel + ' got ' + !!result.label.hasLabel);
    } else if (expected.hasLabel && expected.labelRegion && expected.labelRegion !== 'none') {
      if (result.label.region !== expected.labelRegion) {
        issues.push('label.region expected ' + expected.labelRegion + ' got ' + result.label.region);
      }
    }
  }

  // Hard fail = wrong cell count / geometry. Mode + label are soft when geometry is correct.
  const hard = issues.filter(function (msg) {
    return msg.indexOf('grid expected') === 0 || msg.indexOf('cells expected') === 0 || msg.indexOf('no result') === 0;
  });
  const modeIssue = issues.some(function (m) { return m.indexOf('mode expected') === 0; });
  const labelIssue = issues.some(function (m) { return m.indexOf('label.') === 0; });
  const softNote = issues.some(function (m) { return m.indexOf('(count ok') !== -1; });

  return {
    ok: hard.length === 0 && geometryOk,
    warn: softNote || (geometryOk && (modeIssue || labelIssue)),
    issues: issues,
    result: {
      rows: result.rows,
      cols: result.cols,
      mode: result.mode,
      cellCount: result.cellCount,
      label: result.label,
      confidence: result.confidence,
      source: result.source
    }
  };
}

async function runManifest(manifestPath, label, options) {
  options = options || {};
  if (!fs.existsSync(manifestPath)) {
    console.log('Skip ' + label + ': no manifest at ' + manifestPath);
    return { pass: 0, fail: 0, warn: 0, total: 0 };
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const images = manifest.images || [];
  let pass = 0;
  let fail = 0;
  let warn = 0;
  const failures = [];

  console.log('\n=== ' + label + ' (' + images.length + ' cases) ===');
  for (var i = 0; i < images.length; i++) {
    const entry = images[i];
    const filePath = path.join(ROOT, 'Examples', entry.file);
    if (!fs.existsSync(filePath)) {
      fail++;
      failures.push({ file: entry.file, issues: ['missing file'] });
      console.log('FAIL  ' + entry.file + ' — missing file');
      continue;
    }
    const rgba = await loadRgba(filePath);
    const buffer = imageBuffer.fromRgba(rgba.data, rgba.width, rgba.height, { maxSide: 640 });
    const result = parseAuto.selectBestParse(
      { data: buffer.data, width: buffer.width, height: buffer.height },
      {
        imageData: { data: buffer.data, width: buffer.width, height: buffer.height },
        scale: buffer.scale,
        fullWidth: buffer.fullWidth,
        fullHeight: buffer.fullHeight
      }
    );
    // Scale rows/cols from analysis — already in buffer coords but selectBestParse scales bounds;
    // rows/cols are counts so OK.
    const ev = evaluateCase(entry, result);
    if (ev.ok) {
      pass++;
      if (ev.warn) {
        warn++;
        console.log('PASS~ ' + entry.file + '  → ' + JSON.stringify(ev.result) + (ev.issues.length ? '  (' + ev.issues.join('; ') + ')' : ''));
      } else {
        console.log('PASS  ' + entry.file + '  → ' + ev.result.rows + 'x' + ev.result.cols + ' ' + ev.result.mode + (ev.result.label && ev.result.label.hasLabel ? ' label:' + ev.result.label.region : ''));
      }
    } else {
      fail++;
      failures.push({ file: entry.file, expected: entry, result: ev.result, issues: ev.issues });
      console.log('FAIL  ' + entry.file + '  — ' + ev.issues.join('; ') + '  got=' + JSON.stringify(ev.result));
    }
  }

  return { pass: pass, fail: fail, warn: warn, total: images.length, failures: failures };
}

async function main() {
  // Ensure synthetic set exists
  const synManifest = path.join(ROOT, 'Examples', 'synthetic-manifest.json');
  if (!fs.existsSync(synManifest)) {
    console.log('Generating synthetic grids…');
    require('child_process').execSync('node scripts/generate-random-grids.js 36', {
      cwd: ROOT,
      stdio: 'inherit'
    });
  }

  const syn = await runManifest(synManifest, 'Synthetic random grids');
  const real = await runManifest(path.join(ROOT, 'Examples', 'manifest.json'), 'Real fixtures');

  console.log('\n========== SUMMARY ==========');
  console.log('Synthetic: ' + syn.pass + '/' + syn.total + ' pass (' + syn.fail + ' fail, ' + syn.warn + ' warn)');
  console.log('Real:      ' + real.pass + '/' + real.total + ' pass (' + real.fail + ' fail, ' + real.warn + ' warn)');
  const totalFail = syn.fail + real.fail;
  const totalPass = syn.pass + real.pass;
  const total = syn.total + real.total;
  console.log('Overall:   ' + totalPass + '/' + total + ' pass');

  // Soft gate: synthetic must be mostly green; real fixtures are informational for now
  const synRate = syn.total ? syn.pass / syn.total : 1;
  const realRate = real.total ? real.pass / real.total : 1;
  console.log('Synthetic rate: ' + (synRate * 100).toFixed(1) + '%');
  console.log('Real rate:      ' + (realRate * 100).toFixed(1) + '%');
  if (synRate < 0.75) {
    console.error('\nSynthetic pass rate below 75% — failing.');
    process.exit(1);
  }
  console.log('\nOK');
}

main().catch(function (err) {
  console.error(err);
  process.exit(1);
});
