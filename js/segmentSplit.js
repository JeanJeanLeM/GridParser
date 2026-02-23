/**
 * Split image into blobs by segment-defined cells, with optional excluded cells.
 * (Placeholder until full implementation in step 4.)
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.segmentSplit = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  function exportCells(image, cells, options) {
    var excluded = options && options.excludedCellIds;
    var trim = Math.max(0, (options && options.trimPixels) || 0);
    var toExport = [];
    for (var i = 0; i < cells.length; i++) {
      if (excluded && excluded[i]) continue;
      toExport.push(cells[i]);
    }
    if (toExport.length === 0) return Promise.resolve([]);
    var createCanvas = typeof document !== 'undefined' && document.createElement('canvas');
    if (!createCanvas) createCanvas = function () { throw new Error('Canvas not available'); };
    else createCanvas = function (width, height) {
      var el = document.createElement('canvas');
      el.width = width;
      el.height = height;
      return el;
    };
    var toBlobAsync = function (canvas) {
      return new Promise(function (resolve, reject) {
        canvas.toBlob(function (blob) {
          if (blob) resolve(blob);
          else reject(new Error('toBlob failed'));
        }, 'image/png');
      });
    };
    var promises = toExport.map(function (cell) {
      var cw = Math.max(1, cell.w - 2 * trim);
      var ch = Math.max(1, cell.h - 2 * trim);
      var sx = Math.round(cell.x) + trim;
      var sy = Math.round(cell.y) + trim;
      var tileCanvas = createCanvas(cw, ch);
      var ctx = tileCanvas.getContext('2d');
      if (!ctx) return Promise.reject(new Error('getContext 2d failed'));
      ctx.drawImage(image, sx, sy, cw, ch, 0, 0, cw, ch);
      return toBlobAsync(tileCanvas);
    });
    return Promise.all(promises);
  }

  function splitByCells(image, cells, options) {
    if (!cells || !cells.length) return Promise.resolve([]);
    return exportCells(image, cells, options);
  }

  function splitBySegments(image, segments, options, adapter) {
    var w = image.naturalWidth || image.width;
    var h = image.naturalHeight || image.height;
    if (typeof segmentArrangement === 'undefined' || !segmentArrangement.segmentsToCells) {
      return Promise.reject(new Error('segmentArrangement not loaded'));
    }
    var cells = segmentArrangement.segmentsToCells(w, h, segments);
    return exportCells(image, cells, options);
  }
  return { splitBySegments: splitBySegments, splitByCells: splitByCells };
});
