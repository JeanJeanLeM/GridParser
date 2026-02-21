/**
 * Test grid split on all images in Examples/. Writes 16 tiles per image to test-output/<basename>-tiles/.
 * Run: node scripts/test-grid-split.js
 * Requires: npm install jimp
 */
var path = require('path');
var fs = require('fs');
var Jimp = require('jimp');

var projectRoot = path.join(__dirname, '..');
var examplesDir = path.join(projectRoot, 'Examples');
var outputDir = path.join(projectRoot, 'test-output');

var imageExtensions = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];

function getImageFiles(dir) {
  if (!fs.existsSync(dir)) {
    return [];
  }
  return fs.readdirSync(dir)
    .filter(function (name) {
      var ext = path.extname(name).toLowerCase();
      return imageExtensions.indexOf(ext) !== -1;
    })
    .map(function (name) {
      return path.join(dir, name);
    });
}

/**
 * Same grid split logic as js/gridSplit.js: 4x4 cells, optional trim. Returns Promise of 16 PNG buffers.
 */
function splitGrid4x4WithJimp(image, trimPixels) {
  var w = image.bitmap.width;
  var h = image.bitmap.height;
  var cellW = Math.floor(w / 4);
  var cellH = Math.floor(h / 4);
  var trim = Math.max(0, trimPixels || 0);
  var outW = cellW - 2 * trim;
  var outH = cellH - 2 * trim;
  if (outW <= 0 || outH <= 0) {
    return Promise.reject(new Error('Trim too large for image size'));
  }
  var promises = [];
  for (var row = 0; row < 4; row++) {
    for (var col = 0; col < 4; col++) {
      var sx = col * cellW + trim;
      var sy = row * cellH + trim;
      promises.push(
        image.clone().crop(sx, sy, outW, outH).getBufferAsync(Jimp.MIME_PNG)
      );
    }
  }
  return Promise.all(promises);
}

function run() {
  var files = getImageFiles(examplesDir);
  if (files.length === 0) {
    console.log('No image files found in Examples/');
    return;
  }

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  var trimOptions = [0, 1, 2];
  var allPromises = files.map(function (filePath) {
    var basename = path.basename(filePath, path.extname(filePath));
    var outSubdir = path.join(outputDir, basename + '-tiles');
    return Jimp.read(filePath)
      .then(function (img) {
        return Promise.all(trimOptions.map(function (trimPixels) {
          var subdir = trimPixels === 0 ? outSubdir : path.join(outputDir, basename + '-tiles-trim' + trimPixels);
          if (!fs.existsSync(subdir)) {
            fs.mkdirSync(subdir, { recursive: true });
          }
          return splitGrid4x4WithJimp(img, trimPixels)
            .then(function (buffers) {
              if (buffers.length !== 16) {
                throw new Error('Expected 16 tiles, got ' + buffers.length);
              }
              buffers.forEach(function (buf, index) {
                var r = Math.floor(index / 4);
                var c = index % 4;
                var name = 'tile_' + r + '_' + c + '.png';
                fs.writeFileSync(path.join(subdir, name), buf);
              });
              console.log('Split ' + path.basename(filePath) + ' (trim=' + trimPixels + ') -> 16 files in ' + path.relative(projectRoot, subdir));
            });
        }));
      })
      .catch(function (err) {
        console.error('Error processing ' + filePath + ': ' + err.message);
      });
  });

  Promise.all(allPromises).then(function () {
    console.log('Done. Check test-output/ for tiles.');
  }).catch(function (err) {
    console.error(err);
    process.exit(1);
  });
}

run();
