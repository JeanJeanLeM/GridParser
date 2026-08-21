/**
 * Generate synthetic random grids for parse-auto regression tests.
 * Usage: node scripts/generate-random-grids.js [count]
 */
const fs = require('fs');
const path = require('path');
const Jimp = require('jimp');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'Examples', 'synthetic');
const MANIFEST_PATH = path.join(ROOT, 'Examples', 'synthetic-manifest.json');

function randInt(a, b) {
  return a + Math.floor(Math.random() * (b - a + 1));
}

function pick(arr) {
  return arr[randInt(0, arr.length - 1)];
}

function color(r, g, b, a) {
  return Jimp.rgbaToInt(r, g, b, a == null ? 255 : a);
}

async function drawIcon(img, x, y, w, h, hue, clip) {
  const pad = Math.floor(Math.min(w, h) * 0.18);
  const ix = x + pad;
  const iy = y + pad;
  var iw = w - pad * 2;
  var ih = h - pad * 2;
  if (iw < 4 || ih < 4) return;
  const r = 40 + (hue % 180);
  const g = 80 + ((hue * 3) % 140);
  const b = 60 + ((hue * 7) % 160);
  // Fill only interior (do not erase grid lines at cell edges)
  const fx0 = Math.max(x, clip ? clip.x0 : x);
  const fy0 = Math.max(y, clip ? clip.y0 : y);
  const fx1 = Math.min(x + w, clip ? clip.x1 : x + w);
  const fy1 = Math.min(y + h, clip ? clip.y1 : y + h);
  for (var yy = fy0; yy < fy1; yy++) {
    for (var xx = fx0; xx < fx1; xx++) {
      if (xx >= 0 && yy >= 0 && xx < img.bitmap.width && yy < img.bitmap.height) {
        img.setPixelColor(color(255, 255, 255), xx, yy);
      }
    }
  }
  const iconH = Math.floor(ih * 0.55);
  const ix0 = Math.max(ix, fx0);
  const iy0 = Math.max(iy, fy0);
  const ix1 = Math.min(ix + iw, fx1);
  const iy1 = Math.min(iy + iconH, fy1);
  if (ix1 > ix0 && iy1 > iy0) {
    img.scan(ix0, iy0, ix1 - ix0, iy1 - iy0, function (px, py, idx) {
      this.bitmap.data[idx] = r;
      this.bitmap.data[idx + 1] = g;
      this.bitmap.data[idx + 2] = b;
      this.bitmap.data[idx + 3] = 255;
    });
  }
  const outline = color(20, 20, 20);
  for (var ox = ix0; ox < ix1; ox++) {
    if (iy0 < fy1) img.setPixelColor(outline, ox, iy0);
    if (iy1 - 1 >= fy0 && iy1 - 1 < fy1) img.setPixelColor(outline, ox, iy1 - 1);
  }
  for (var oy = iy0; oy < iy1; oy++) {
    if (ix0 < fx1) img.setPixelColor(outline, ix0, oy);
    if (ix1 - 1 >= fx0 && ix1 - 1 < fx1) img.setPixelColor(outline, ix1 - 1, oy);
  }
}

function drawLabelBand(img, x, y, w, h, side) {
  const ink = color(15, 15, 15);
  const pct = 0.22;
  let bx = x;
  let by = y;
  let bw = w;
  let bh = h;
  if (side === 'bottom') {
    bh = Math.max(6, Math.floor(h * pct));
    by = y + h - bh;
  } else if (side === 'top') {
    bh = Math.max(6, Math.floor(h * pct));
  } else {
    return;
  }
  // Pseudo-text: horizontal dashed dark strokes
  const midY = by + Math.floor(bh / 2);
  const startX = bx + Math.floor(bw * 0.2);
  const endX = bx + Math.floor(bw * 0.8);
  for (var xx = startX; xx < endX; xx++) {
    if ((xx - startX) % 3 !== 2) {
      img.setPixelColor(ink, xx, midY);
      if (midY + 1 < by + bh) img.setPixelColor(ink, xx, midY + 1);
    }
  }
  // Extra row of dots for HF edge score
  for (var xx2 = startX; xx2 < endX; xx2 += 4) {
    img.setPixelColor(ink, xx2, midY - 2);
  }
}

function drawGridLines(img, rows, cols, lineW, lineColor, bgColor) {
  const W = img.bitmap.width;
  const H = img.bitmap.height;
  img.scan(0, 0, W, H, function (x, y, idx) {
    this.bitmap.data[idx] = (bgColor >> 24) & 255;
    this.bitmap.data[idx + 1] = (bgColor >> 16) & 255;
    this.bitmap.data[idx + 2] = (bgColor >> 8) & 255;
    this.bitmap.data[idx + 3] = 255;
  });
  const cellW = W / cols;
  const cellH = H / rows;
  for (var c = 0; c <= cols; c++) {
    const x0 = Math.round(c * cellW);
    for (var t = 0; t < lineW; t++) {
      const x = Math.min(W - 1, x0 + t);
      for (var y = 0; y < H; y++) img.setPixelColor(lineColor, x, y);
    }
  }
  for (var r = 0; r <= rows; r++) {
    const y0 = Math.round(r * cellH);
    for (var t2 = 0; t2 < lineW; t2++) {
      const y = Math.min(H - 1, y0 + t2);
      for (var x = 0; x < W; x++) img.setPixelColor(lineColor, x, y);
    }
  }
  return { cellW: cellW, cellH: cellH, lineW: lineW };
}

async function makeUniform(rows, cols, labelSide) {
  const size = 512;
  const lineW = randInt(2, 4);
  const img = await new Jimp(size, size, 0xffffffff);
  const meta = drawGridLines(img, rows, cols, lineW, color(10, 10, 10), color(255, 255, 255));
  for (var r = 0; r < rows; r++) {
    for (var c = 0; c < cols; c++) {
      const x = Math.round(c * meta.cellW) + lineW;
      const y = Math.round(r * meta.cellH) + lineW;
      const w = Math.max(4, Math.round((c + 1) * meta.cellW) - Math.round(c * meta.cellW) - lineW);
      const h = Math.max(4, Math.round((r + 1) * meta.cellH) - Math.round(r * meta.cellH) - lineW);
      // Keep a 1px margin so outer/inner grid lines are never erased
      const clip = {
        x0: Math.round(c * meta.cellW) + lineW,
        y0: Math.round(r * meta.cellH) + lineW,
        x1: Math.round((c + 1) * meta.cellW),
        y1: Math.round((r + 1) * meta.cellH)
      };
      await drawIcon(img, x, y, w, h, r * 17 + c * 31, clip);
      if (labelSide && labelSide !== 'none') {
        drawLabelBand(img, x, y, w, h, labelSide);
      }
    }
  }
  return img;
}

async function makeBlackBg(rows, cols) {
  const size = 512;
  const img = await new Jimp(size, size, 0x000000ff);
  const gap = 4;
  const cellW = Math.floor((size - gap * (cols + 1)) / cols);
  const cellH = Math.floor((size - gap * (rows + 1)) / rows);
  for (var r = 0; r < rows; r++) {
    for (var c = 0; c < cols; c++) {
      const x = gap + c * (cellW + gap);
      const y = gap + r * (cellH + gap);
      await drawIcon(img, x, y, cellW, cellH, r * 13 + c * 29 + 40);
    }
  }
  return img;
}

async function makeLineform(rows, cols) {
  // Same as uniform but thicker borders (panel look)
  const size = 480;
  const lineW = 5;
  const img = await new Jimp(size, size, 0xffffffff);
  drawGridLines(img, rows, cols, lineW, color(0, 0, 0), color(250, 250, 250));
  const cellW = size / cols;
  const cellH = size / rows;
  for (var r = 0; r < rows; r++) {
    for (var c = 0; c < cols; c++) {
      const x = Math.round(c * cellW) + lineW;
      const y = Math.round(r * cellH) + lineW;
      const w = Math.round(cellW) - lineW;
      const h = Math.round(cellH) - lineW;
      await drawIcon(img, x, y, w, h, r * 11 + c * 19);
    }
  }
  return img;
}

async function main() {
  const count = Math.max(10, parseInt(process.argv[2], 10) || 36);
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  // Clear old synthetics
  fs.readdirSync(OUT_DIR).forEach(function (f) {
    if (/\.(png|jpg)$/i.test(f)) fs.unlinkSync(path.join(OUT_DIR, f));
  });

  const entries = [];
  for (var i = 0; i < count; i++) {
    const rows = randInt(2, 5);
    const cols = randInt(2, 5);
    const kind = pick(['uniform', 'uniform', 'uniform', 'blackbg', 'lineform', 'uniform_label']);
    let mode = 'uniform';
    let labelSide = 'none';
    let hasLabel = false;
    let img;
    let name;

    if (kind === 'blackbg') {
      mode = 'blackbg';
      img = await makeBlackBg(rows, cols);
      name = 'syn_' + String(i).padStart(3, '0') + '_blackbg_' + rows + 'x' + cols + '.png';
    } else if (kind === 'lineform') {
      mode = 'lineform';
      img = await makeLineform(rows, cols);
      name = 'syn_' + String(i).padStart(3, '0') + '_lineform_' + rows + 'x' + cols + '.png';
    } else if (kind === 'uniform_label') {
      mode = 'uniform';
      labelSide = pick(['bottom', 'top']);
      hasLabel = true;
      img = await makeUniform(rows, cols, labelSide);
      name = 'syn_' + String(i).padStart(3, '0') + '_uniform_' + rows + 'x' + cols + '_label_' + labelSide + '.png';
    } else {
      mode = 'uniform';
      img = await makeUniform(rows, cols, 'none');
      name = 'syn_' + String(i).padStart(3, '0') + '_uniform_' + rows + 'x' + cols + '.png';
    }

    const filePath = path.join(OUT_DIR, name);
    await img.writeAsync(filePath);
    entries.push({
      file: 'synthetic/' + name,
      rows: rows,
      cols: cols,
      mode: mode,
      modeAlternates: mode === 'uniform' ? ['lineform'] : (mode === 'lineform' ? ['uniform'] : ['uniform', 'lineform']),
      hasLabel: hasLabel,
      labelRegion: hasLabel ? labelSide : 'none',
      labelPercent: hasLabel ? 22 : undefined
    });
    process.stdout.write('.');
  }
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify({ version: 1, images: entries }, null, 2));
  console.log('\nWrote ' + entries.length + ' images to ' + OUT_DIR);
  console.log('Manifest: ' + MANIFEST_PATH);
}

main().catch(function (err) {
  console.error(err);
  process.exit(1);
});
