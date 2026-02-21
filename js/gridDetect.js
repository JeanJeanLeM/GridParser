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
   * Longest contiguous run of dark pixels along one row (axis 'y') or one column (axis 'x').
   * Used to reject text: text has short segments; grid lines span most of the row/column.
   */
  function maxContiguousDark(data, w, h, axis, index, blackThreshold) {
    var maxRun = 0;
    var run = 0;
    if (axis === 'y') {
      var y = index;
      for (var x = 0; x < w; x++) {
        var i = (y * w + x) * 4;
        var L = luminance(data[i], data[i + 1], data[i + 2]);
        if (L <= blackThreshold) {
          run++;
          if (run > maxRun) maxRun = run;
        } else {
          run = 0;
        }
      }
    } else {
      var x = index;
      for (var y = 0; y < h; y++) {
        var i = (y * w + x) * 4;
        var L = luminance(data[i], data[i + 1], data[i + 2]);
        if (L <= blackThreshold) {
          run++;
          if (run > maxRun) maxRun = run;
        } else {
          run = 0;
        }
      }
    }
    return maxRun;
  }

  /**
   * Darkness profile that is zero where the longest contiguous dark run is too short.
   * This rejects text rows/columns (short segments) while keeping real grid lines (long span).
   */
  function lineAwareProfile(data, w, h, axis, blackThreshold, minSpanFraction) {
    var raw = darknessProfile(data, w, h, axis, blackThreshold);
    var size = axis === 'x' ? h : w;
    var out = [];
    for (var i = 0; i < raw.length; i++) {
      var span = maxContiguousDark(data, w, h, axis, i, blackThreshold);
      var minSpan = Math.floor(size * minSpanFraction);
      out.push(span >= minSpan ? raw[i] : 0);
    }
    return out;
  }

  /**
   * Find runs of consecutive indices where profile value >= threshold. Returns [{ position, thickness }, ...].
   * position = center of run (in index), thickness = length of run.
   * Only keeps runs with minRunLength <= thickness <= maxRunLength so thin grid lines are kept and thick bands (e.g. text) are ignored.
   */
  function findRuns(profile, threshold, minRunLength, maxRunLength) {
    if (maxRunLength == null) maxRunLength = Infinity;
    var runs = [];
    var i = 0;
    while (i < profile.length) {
      if (profile[i] >= threshold) {
        var start = i;
        while (i < profile.length && profile[i] >= threshold) i++;
        var thickness = i - start;
        if (thickness >= minRunLength && thickness <= maxRunLength) {
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
   * Pick exactly N lines that best divide the range [0, size] into N+1 equal parts.
   * Targets: size/(N+1), 2*size/(N+1), ..., N*size/(N+1).
   * If we have more than N, choose the N whose positions minimize distance to targets.
   * If we have fewer, fill in with geometric positions.
   */
  function pickNLines(detectedLines, size, count) {
    if (count <= 0) return [];
    var targets = [];
    for (var t = 1; t <= count; t++) {
      targets.push((t * size) / (count + 1));
    }
    if (detectedLines.length === 0) {
      return targets.slice();
    }
    var positions = detectedLines.map(function (l) { return l.position; }).sort(function (a, b) { return a - b; });
    while (positions.length < count) {
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
    if (positions.length <= count) return positions.slice(0, count);
    var sorted = positions;
    var best = [];
    var bestScore = Infinity;
    function scoreChoice(choice) {
      var s = 0;
      for (var i = 0; i < count; i++) s += Math.abs(choice[i] - targets[i]);
      return s;
    }
    function choose(from, need, start, chosen) {
      if (need === 0) {
        var sc = scoreChoice(chosen);
        if (sc < bestScore) {
          bestScore = sc;
          best = chosen.slice();
        }
        return;
      }
      for (var k = start; k <= from.length - need; k++) {
        chosen.push(from[k]);
        choose(from, need - 1, k + 1, chosen);
        chosen.pop();
      }
    }
    choose(sorted, count, 0, []);
    return best.length ? best : targets.slice();
  }

  /**
   * Detect grid lines from image pixel data.
   * Uses continuity (long contiguous dark span) to reject text; only accepts lines with thickness <= maxLinePx.
   * @param {HTMLImageElement|object} image - image with naturalWidth/naturalHeight
   * @param {Object} options - { blackThreshold?, darknessThreshold?, minLinePx?, maxLinePx?, minGap?, minSpanFraction?, gridCols?, gridRows? }
   * @returns {{ xBounds: number[], yBounds: number[], suggestedTrim: number }} - (gridCols+1) x, (gridRows+1) y, and trim in pixels
   */
  function detectGridLines(image, options) {
    var opts = options || {};
    var blackThreshold = Math.min(255, Math.max(0, parseInt(opts.blackThreshold, 10) || 80));
    var darknessThreshold = typeof opts.darknessThreshold === 'number' ? opts.darknessThreshold : 0.15;
    var minLinePx = Math.max(1, parseInt(opts.minLinePx, 10) || 1);
    var maxLinePx = typeof opts.maxLinePx === 'number' ? opts.maxLinePx : (parseInt(opts.maxLinePx, 10) || 15);
    maxLinePx = Math.max(minLinePx, maxLinePx);
    var minGap = Math.max(2, parseInt(opts.minGap, 10) || 8);
    var minSpanFraction = typeof opts.minSpanFraction === 'number' ? opts.minSpanFraction : 0.35;
    var gridCols = Math.max(1, Math.min(4, parseInt(opts.gridCols, 10) || 4));
    var gridRows = Math.max(1, Math.min(4, parseInt(opts.gridRows, 10) || 4));

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

    /* Use line-aware profiles so rows/columns with only short dark segments (e.g. text) are ignored. */
    var colProfile = lineAwareProfile(data, w, h, 'x', blackThreshold, minSpanFraction);
    var rowProfile = lineAwareProfile(data, w, h, 'y', blackThreshold, minSpanFraction);

    var colRuns = findRuns(colProfile, darknessThreshold, minLinePx, maxLinePx);
    var rowRuns = findRuns(rowProfile, darknessThreshold, minLinePx, maxLinePx);

    colRuns = mergeCloseLines(colRuns, minGap);
    rowRuns = mergeCloseLines(rowRuns, minGap);

    colRuns.sort(function (a, b) { return a.position - b.position; });
    rowRuns.sort(function (a, b) { return a.position - b.position; });

    var leftOuter = 0;
    var rightOuter = w;
    if (colRuns.length >= 1) {
      leftOuter = Math.max(0, colRuns[0].position);
      rightOuter = Math.min(w, colRuns[colRuns.length - 1].position);
    }
    var topOuter = 0;
    var bottomOuter = h;
    if (rowRuns.length >= 1) {
      topOuter = Math.max(0, rowRuns[0].position);
      bottomOuter = Math.min(h, rowRuns[rowRuns.length - 1].position);
    }

    var contentW = rightOuter - leftOuter;
    var contentH = bottomOuter - topOuter;
    var innerColRuns = colRuns.length > 2 ? colRuns.slice(1, -1) : colRuns;
    var innerRowRuns = rowRuns.length > 2 ? rowRuns.slice(1, -1) : rowRuns;
    var relCol = innerColRuns.map(function (r) { return { position: r.position - leftOuter, thickness: r.thickness }; });
    var relRow = innerRowRuns.map(function (r) { return { position: r.position - topOuter, thickness: r.thickness }; });
    var numInnerCol = gridCols - 1;
    var numInnerRow = gridRows - 1;
    var innerX = pickNLines(relCol, contentW, numInnerCol).map(function (p) { return leftOuter + p; });
    var innerY = pickNLines(relRow, contentH, numInnerRow).map(function (p) { return topOuter + p; });
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
