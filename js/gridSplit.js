/**
 * Grid splitter: 4×4 grid separation with optional border trim.
 * Works in browser (no adapter) and in Node (pass adapter from node-canvas).
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.gridSplit = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function getWidth(img) {
    return img.naturalWidth != null ? img.naturalWidth : img.width;
  }
  function getHeight(img) {
    return img.naturalHeight != null ? img.naturalHeight : img.height;
  }

  /**
   * Split an image into 16 tiles (4×4 grid). Optional trim removes a border from each tile.
   * @param {HTMLImageElement|object} image - Image with width/height or naturalWidth/naturalHeight
   * @param {{ trimPixels?: number }} options - trimPixels: pixels to crop from each tile edge (default 0)
   * @param {{ createCanvas: function(number, number), toBlob: function(object, function) }} [adapter] - For Node: createCanvas(w,h), toBlob(canvas, callback(err, buffer))
   * @returns {Promise<Array<Blob|Buffer>>} - 16 blobs (browser) or buffers (Node) in row-major order
   */
  function splitGrid4x4(image, options, adapter) {
    var opts = options || {};
    var trim = Math.max(0, parseInt(opts.trimPixels, 10) || 0);
    var w = getWidth(image);
    var h = getHeight(image);
    var cellW = Math.floor(w / 4);
    var cellH = Math.floor(h / 4);
    var outW = cellW - 2 * trim;
    var outH = cellH - 2 * trim;
    if (outW <= 0 || outH <= 0) {
      return Promise.reject(new Error('Trim too large for image size'));
    }

    var createCanvas;
    var toBlobAsync;
    if (adapter && adapter.createCanvas && adapter.toBlob) {
      createCanvas = adapter.createCanvas;
      toBlobAsync = function (canvas) {
        return new Promise(function (resolve, reject) {
          adapter.toBlob(canvas, function (err, buf) {
            if (err) reject(err);
            else resolve(buf);
          });
        });
      };
    } else {
      createCanvas = function (width, height) {
        var el = typeof document !== 'undefined' && document.createElement('canvas');
        if (!el) throw new Error('Canvas not available');
        el.width = width;
        el.height = height;
        return el;
      };
      toBlobAsync = function (canvas) {
        return new Promise(function (resolve, reject) {
          canvas.toBlob(function (blob) {
            if (blob) resolve(blob);
            else reject(new Error('toBlob failed'));
          }, 'image/png');
        });
      };
    }

    var promises = [];
    for (var row = 0; row < 4; row++) {
      for (var col = 0; col < 4; col++) {
        (function (r, c) {
          var sx = c * cellW + trim;
          var sy = r * cellH + trim;
          var tileCanvas = createCanvas(outW, outH);
          var ctx = tileCanvas.getContext && tileCanvas.getContext('2d');
          if (!ctx) {
            promises.push(Promise.reject(new Error('getContext 2d failed')));
            return;
          }
          ctx.drawImage(image, sx, sy, outW, outH, 0, 0, outW, outH);
          promises.push(toBlobAsync(tileCanvas));
        })(row, col);
      }
    }
    return Promise.all(promises);
  }

  /**
   * Split an image into 16 tiles using custom boundaries (user-placed cutting lines).
   * @param {HTMLImageElement|object} image - Image element
   * @param {number[]} xBounds - 5 numbers: [left, div1, div2, div3, right] in image pixels
   * @param {number[]} yBounds - 5 numbers: [top, div1, div2, div3, bottom] in image pixels
   * @param {{ trimPixels?: number }} [options] - optional trim from each cell edge
   * @param {object} [adapter] - For Node: createCanvas, toBlob
   * @returns {Promise<Array<Blob|Buffer>>} - 16 blobs/buffers in row-major order
   */
  function splitGridCustom(image, xBounds, yBounds, options, adapter) {
    var opts = options || {};
    var trim = Math.max(0, parseInt(opts.trimPixels, 10) || 0);
    var w = getWidth(image);
    var h = getHeight(image);
    if (!xBounds || xBounds.length !== 5 || !yBounds || yBounds.length !== 5) {
      return Promise.reject(new Error('xBounds and yBounds must be arrays of 5 numbers'));
    }

    var createCanvas;
    var toBlobAsync;
    if (adapter && adapter.createCanvas && adapter.toBlob) {
      createCanvas = adapter.createCanvas;
      toBlobAsync = function (canvas) {
        return new Promise(function (resolve, reject) {
          adapter.toBlob(canvas, function (err, buf) {
            if (err) reject(err);
            else resolve(buf);
          });
        });
      };
    } else {
      createCanvas = function (width, height) {
        var el = typeof document !== 'undefined' && document.createElement('canvas');
        if (!el) throw new Error('Canvas not available');
        el.width = width;
        el.height = height;
        return el;
      };
      toBlobAsync = function (canvas) {
        return new Promise(function (resolve, reject) {
          canvas.toBlob(function (blob) {
            if (blob) resolve(blob);
            else reject(new Error('toBlob failed'));
          }, 'image/png');
        });
      };
    }

    var promises = [];
    for (var row = 0; row < 4; row++) {
      for (var col = 0; col < 4; col++) {
        (function (r, c) {
          var sx = Math.round(xBounds[c]) + trim;
          var sy = Math.round(yBounds[r]) + trim;
          var cw = Math.round(xBounds[c + 1] - xBounds[c]) - 2 * trim;
          var ch = Math.round(yBounds[r + 1] - yBounds[r]) - 2 * trim;
          if (cw <= 0 || ch <= 0) {
            promises.push(Promise.reject(new Error('Cell ' + r + ',' + c + ' has non-positive size')));
            return;
          }
          var tileCanvas = createCanvas(cw, ch);
          var ctx = tileCanvas.getContext && tileCanvas.getContext('2d');
          if (!ctx) {
            promises.push(Promise.reject(new Error('getContext 2d failed')));
            return;
          }
          ctx.drawImage(image, sx, sy, cw, ch, 0, 0, cw, ch);
          promises.push(toBlobAsync(tileCanvas));
        })(row, col);
      }
    }
    return Promise.all(promises);
  }

  return { splitGrid4x4: splitGrid4x4, splitGridCustom: splitGridCustom };
});
