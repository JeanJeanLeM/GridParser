/**
 * Detect straight black/dark lines in an image to find grid boundaries.
 * Returns 5 x-positions and 5 y-positions (outer + 3 inner) and suggested trim from line thickness.
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.gridDetect = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function luminance(r, g, b) {
    return 0.299 * r + 0.587 * g + 0.114 * b;
  }

  /**
   * Build darkness profile along an axis (columns or rows).
   * @param {Uint8ClampedArray} data - RGBA ImageData.data
   * @param {number} w - width
   * @param {number} h - height
   * @param {string} axis - 'x' for column profile (index = column), 'y' for row profile
   * @param {number} blackThreshold - luminance below this = black (0-255)
   * @returns {number[]} - for each index, fraction of pixels that are black (0-1)
   */
  function darknessProfile(data, w, h, axis, blackThreshold) {
    var out = [];
    if (axis === 'x') {
      for (var x = 0; x < w; x++) {
        var dark = 0;
        for (var y = 0; y < h; y++) {
          var i = (y * w + x) * 4;
          var L = luminance(data[i], data[i + 1], data[i + 2]);
          if (L <= blackThreshold) dark++;
        }
        out.push(dark / h);
      }
    } else {
      for (var y = 0; y < h; y++) {
        var dark = 0;
        for (var x = 0; x < w; x++) {
          var i = (y * w + x) * 4;
          var L = luminance(data[i], data[i + 1], data[i + 2]);
          if (L <= blackThreshold) dark++;
        }
        out.push(dark / w);
      }
    }
    return out;
  }

  /**
   * Find runs of consecutive indices where profile value >= threshold. Returns [{ position, thickness }, ...].
   * position = center of run (in index), thickness = length of run.
   */
  function findRuns(profile, threshold, minRunLength) {
    var runs = [];
    var i = 0;
    while (i < profile.length) {
      if (profile[i] >= threshold) {
        var start = i;
        while (i < profile.length && profile[i] >= threshold) i++;
        var thickness = i - start;
        if (thickness >= minRunLength) {
          runs.push({ position: start + thickness / 2, thickness: thickness });
        }
      } else {
        i++;
      }
    }
    return runs;
  }

  /**
   * Merge lines that are too close (avoid cut lines on top of each other).
   * @param {Array<{position, thickness}>} lines - sorted by position
   * @param {number} minGap - minimum gap between line centers
   * @returns {Array<{position, thickness}>}
   */
  function mergeCloseLines(lines, minGap) {
    if (lines.length <= 1) return lines;
    var out = [lines[0]];
    for (var k = 1; k < lines.length; k++) {
      var prev = out[out.length - 1];
      var cur = lines[k];
      if (cur.position - prev.position < minGap) {
        var totalThick = prev.thickness + cur.thickness;
        out[out.length - 1] = {
          position: (prev.position * prev.thickness + cur.position * cur.thickness) / totalThick,
          thickness: Math.max(prev.thickness, cur.thickness)
        };
      } else {
        out.push(cur);
      }
    }
    return out;
  }

  /**
   * Pick exactly 3 lines that best divide the range [0, size] into 4 equal parts.
   * If we have more than 3, choose the 3 whose positions are closest to 1/4, 2/4, 3/4.
   * If we have fewer, fill in with geometric positions.
   */
  function pickThreeLines(detectedLines, size) {
    var target1 = size / 4;
    var target2 = size / 2;
    var target3 = (3 * size) / 4;
    if (detectedLines.length === 0) {
      return [target1, target2, target3];
    }
    if (detectedLines.length <= 3) {
      var positions = detectedLines.map(function (l) { return l.position; }).sort(function (a, b) { return a - b; });
      while (positions.length < 3) {
        var gaps = [];
        for (var i = 0; i <= positions.length; i++) {
          var left = i === 0 ? 0 : positions[i - 1];
          var right = i === positions.length ? size : positions[i];
          gaps.push({ i: i, mid: (left + right) / 2, len: right - left });
        }
        gaps.sort(function (a, b) { return b.len - a.len; });
        positions.splice(gaps[0].i, 0, gaps[0].mid);
        positions.sort(function (a, b) { return a - b; });
      }
      return positions.slice(0, 3);
    }
    var sorted = detectedLines.slice().sort(function (a, b) { return a.position - b.position; });
    var best = [];
    var bestScore = Infinity;
    for (var a = 0; a < sorted.length - 2; a++) {
      for (var b = a + 1; b < sorted.length - 1; b++) {
        for (var c = b + 1; c < sorted.length; c++) {
          var p1 = sorted[a].position;
          var p2 = sorted[b].position;
          var p3 = sorted[c].position;
          var score = Math.abs(p1 - target1) + Math.abs(p2 - target2) + Math.abs(p3 - target3);
          if (score < bestScore) {
            bestScore = score;
            best = [p1, p2, p3];
          }
        }
      }
    }
    return best.length ? best : [target1, target2, target3];
  }

  /**
   * Detect grid lines from image pixel data.
   * @param {HTMLImageElement|object} image - image with naturalWidth/naturalHeight
   * @param {Object} options - { blackThreshold?: number (0-255), darknessThreshold?: number (0-1), minLinePx?: number, minGap?: number }
   * @returns {{ xBounds: number[], yBounds: number[], suggestedTrim: number }} - 5 x, 5 y, and trim in pixels
   */
  function detectGridLines(image, options) {
    var opts = options || {};
    var blackThreshold = Math.min(255, Math.max(0, parseInt(opts.blackThreshold, 10) || 80));
    var darknessThreshold = typeof opts.darknessThreshold === 'number' ? opts.darknessThreshold : 0.15;
    var minLinePx = Math.max(1, parseInt(opts.minLinePx, 10) || 1);
    var minGap = Math.max(2, parseInt(opts.minGap, 10) || 8);

    var w = image.naturalWidth || image.width;
    var h = image.naturalHeight || image.height;
    if (!w || !h) return null;

    var canvas = typeof document !== 'undefined' && document.createElement('canvas');
    if (!canvas) return null;
    canvas.width = w;
    canvas.height = h;
    var ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(image, 0, 0);
    var data = ctx.getImageData(0, 0, w, h).data;

    var colProfile = darknessProfile(data, w, h, 'x', blackThreshold);
    var rowProfile = darknessProfile(data, w, h, 'y', blackThreshold);

    var colRuns = findRuns(colProfile, darknessThreshold, minLinePx);
    var rowRuns = findRuns(rowProfile, darknessThreshold, minLinePx);

    colRuns = mergeCloseLines(colRuns, minGap);
    rowRuns = mergeCloseLines(rowRuns, minGap);

    colRuns.sort(function (a, b) { return a.position - b.position; });
    rowRuns.sort(function (a, b) { return a.position - b.position; });

    var leftOuter = 0;
    var rightOuter = w;
    if (colRuns.length >= 1) {
      leftOuter = Math.max(0, colRuns[0].position - colRuns[0].thickness / 2);
      rightOuter = Math.min(w, colRuns[colRuns.length - 1].position + colRuns[colRuns.length - 1].thickness / 2);
    }
    var topOuter = 0;
    var bottomOuter = h;
    if (rowRuns.length >= 1) {
      topOuter = Math.max(0, rowRuns[0].position - rowRuns[0].thickness / 2);
      bottomOuter = Math.min(h, rowRuns[rowRuns.length - 1].position + rowRuns[rowRuns.length - 1].thickness / 2);
    }

    var contentW = rightOuter - leftOuter;
    var contentH = bottomOuter - topOuter;
    var innerColRuns = colRuns.length > 2 ? colRuns.slice(1, -1) : colRuns;
    var innerRowRuns = rowRuns.length > 2 ? rowRuns.slice(1, -1) : rowRuns;
    var relCol = innerColRuns.map(function (r) { return { position: r.position - leftOuter, thickness: r.thickness }; });
    var relRow = innerRowRuns.map(function (r) { return { position: r.position - topOuter, thickness: r.thickness }; });
    var innerX = pickThreeLines(relCol, contentW).map(function (p) { return leftOuter + p; });
    var innerY = pickThreeLines(relRow, contentH).map(function (p) { return topOuter + p; });
    innerX.sort(function (a, b) { return a - b; });
    innerY.sort(function (a, b) { return a - b; });

    function enforceMinGap(bounds, size, gap) {
      var b = bounds.slice();
      for (var i = 1; i < b.length - 1; i++) {
        var prev = b[i - 1];
        var next = b[i + 1];
        if (b[i] - prev < gap) b[i] = Math.min(prev + gap, (prev + next) / 2);
        if (next - b[i] < gap) b[i] = Math.max(next - gap, (prev + next) / 2);
      }
      return b;
    }
    var xBounds = enforceMinGap([leftOuter].concat(innerX).concat([rightOuter]), w, minGap);
    var yBounds = enforceMinGap([topOuter].concat(innerY).concat([bottomOuter]), h, minGap);

    var innerThickness = [];
    innerColRuns.forEach(function (r) { innerThickness.push(r.thickness); });
    innerRowRuns.forEach(function (r) { innerThickness.push(r.thickness); });
    var suggestedTrim = innerThickness.length
      ? Math.max.apply(null, innerThickness)
      : 0;

    return { xBounds: xBounds, yBounds: yBounds, suggestedTrim: Math.min(20, Math.ceil(suggestedTrim)) };
  }

  return { detectGridLines: detectGridLines };
});
