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

  function pixelLuminanceOverWhite(data, i) {
    var a = data[i + 3] / 255;
    var r = data[i] * a + 255 * (1 - a);
    var g = data[i + 1] * a + 255 * (1 - a);
    var b = data[i + 2] * a + 255 * (1 - a);
    return luminance(r, g, b);
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
          var L = pixelLuminanceOverWhite(data, i);
          if (L <= blackThreshold) dark++;
        }
        out.push(dark / h);
      }
    } else {
      for (var y = 0; y < h; y++) {
        var dark = 0;
        for (var x = 0; x < w; x++) {
          var i = (y * w + x) * 4;
          var L = pixelLuminanceOverWhite(data, i);
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
        var L = pixelLuminanceOverWhite(data, i);
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
        var L = pixelLuminanceOverWhite(data, i);
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
   * When allowDashed is true, uses total dark fraction along the axis instead of one long run
   * (so dotted/dashed separators can still register as grid lines).
   */
  function lineAwareProfile(data, w, h, axis, blackThreshold, minSpanFraction, allowDashed) {
    var raw = darknessProfile(data, w, h, axis, blackThreshold);
    var size = axis === 'x' ? h : w;
    var out = [];
    for (var i = 0; i < raw.length; i++) {
      if (allowDashed) {
        // Dashed lines: require enough total dark coverage, not one continuous stroke.
        var minFrac = Math.max(0.08, minSpanFraction * 0.85);
        out.push(raw[i] >= minFrac ? raw[i] : 0);
      } else {
        var span = maxContiguousDark(data, w, h, axis, i, blackThreshold);
        var minSpan = Math.floor(size * minSpanFraction);
        out.push(span >= minSpan ? raw[i] : 0);
      }
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
   * Pick N lines from actual detected positions (no equal-spacing target).
   * Uses the real line positions; when there are more than N, picks N spread across by index.
   * When fewer than N detected, fills with interpolated positions so layout still has N divisions.
   */
  function pickNLinesFromActual(detectedLines, size, count) {
    if (count <= 0) return [];
    var positions = detectedLines.map(function (l) { return l.position; }).sort(function (a, b) { return a - b; });
    if (positions.length >= count) {
      var out = [];
      for (var i = 0; i < count; i++) {
        var idx = Math.round((i + 1) * positions.length / (count + 1)) - 1;
        idx = Math.max(0, Math.min(positions.length - 1, idx));
        out.push(positions[idx]);
      }
      out.sort(function (a, b) { return a - b; });
      return out;
    }
    if (positions.length === 0) {
      var filled = [];
      for (var t = 1; t <= count; t++) filled.push((t * size) / (count + 1));
      return filled;
    }
    var result = positions.slice();
    while (result.length < count) {
      var bestIdx = 0;
      var bestGap = 0;
      for (var k = 0; k <= result.length; k++) {
        var left = k === 0 ? 0 : result[k - 1];
        var right = k === result.length ? size : result[k];
        if (right - left > bestGap) {
          bestGap = right - left;
          bestIdx = k;
        }
      }
      result.splice(bestIdx, 0, (bestIdx === 0 ? 0 : result[bestIdx - 1]) + bestGap / 2);
      result.sort(function (a, b) { return a - b; });
    }
    return result.slice(0, count);
  }

  function resolvePixels(image, options) {
    var opts = options || {};
    if (typeof imageBuffer !== 'undefined' && imageBuffer.resolve) {
      var resolved = imageBuffer.resolve(image, opts);
      if (resolved) return resolved;
    }
    if (opts.imageData && opts.imageData.data) {
      return { data: opts.imageData.data, width: opts.imageData.width, height: opts.imageData.height };
    }
    if (image && image.data && (image.width || image.naturalWidth)) {
      return {
        data: image.data,
        width: image.width || image.naturalWidth,
        height: image.height || image.naturalHeight
      };
    }
    var w = image && (image.naturalWidth || image.width);
    var h = image && (image.naturalHeight || image.height);
    if (!w || !h || typeof document === 'undefined') return null;
    var canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    var ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(image, 0, 0);
    return { data: ctx.getImageData(0, 0, w, h).data, width: w, height: h };
  }

  function enforceMinGap(bounds, size, gap) {
    // Collapse near-duplicate cut positions — never push them apart (that creates micro-columns).
    if (!bounds || bounds.length < 2) return bounds ? bounds.slice() : bounds;
    var b = [bounds[0]];
    for (var i = 1; i < bounds.length - 1; i++) {
      if (bounds[i] - b[b.length - 1] >= gap) b.push(bounds[i]);
    }
    var last = bounds[bounds.length - 1];
    if (last - b[b.length - 1] >= gap) {
      b.push(last);
    } else if (b.length >= 2) {
      b[b.length - 1] = last;
    } else {
      b.push(last);
    }
    return b;
  }

  /**
   * If any cell span is a thin gutter (<< median), rebuild equal splits between outer edges.
   * Prevents black grid lines from becoming fake columns/rows.
   */
  function sanitizeLatticeBounds(bounds, divisions, minGap) {
    if (!bounds || bounds.length < 2 || divisions < 1) return bounds;
    var spans = [];
    for (var i = 1; i < bounds.length; i++) spans.push(bounds[i] - bounds[i - 1]);
    if (!spans.length) return bounds;
    var sorted = spans.slice().sort(function (a, b) { return a - b; });
    var median = sorted[Math.floor(sorted.length / 2)];
    var minSpan = Math.min.apply(null, spans);
    var needEqual = bounds.length !== divisions + 1 ||
      minSpan < Math.max(minGap, median * 0.35);
    if (!needEqual) return bounds;
    var x0 = bounds[0];
    var x1 = bounds[bounds.length - 1];
    if (!(x1 > x0)) return bounds;
    var out = [];
    for (var d = 0; d <= divisions; d++) out.push(x0 + (d * (x1 - x0)) / divisions);
    return out;
  }

  /**
   * Infer grid rows/cols from detected line runs (no size brute-force).
   * Prefer cases where outer + inner lines form a regular lattice.
   */
  function inferGridSizeFromRuns(colRuns, rowRuns, w, h) {
    // Drop separator pairs that only enclose a thin gutter (line thickness artifact).
    function collapseThinSpans(runs, size) {
      var list = (runs || []).slice().sort(function (a, b) { return a.position - b.position; });
      if (list.length < 2) return list;
      var minCell = Math.max(8, size * 0.06);
      var out = [list[0]];
      for (var i = 1; i < list.length; i++) {
        if (list[i].position - out[out.length - 1].position < minCell) {
          var prev = out[out.length - 1];
          var cur = list[i];
          var t = prev.thickness + cur.thickness;
          out[out.length - 1] = {
            position: (prev.position * prev.thickness + cur.position * cur.thickness) / Math.max(1, t),
            thickness: Math.max(prev.thickness, cur.thickness)
          };
        } else {
          out.push(list[i]);
        }
      }
      return out;
    }
    // Ensure outer edges count as bounds when only inner separators were found.
    function withEdges(runs, size) {
      var list = collapseThinSpans(runs, size);
      var edgeTol = Math.max(3, size * 0.02);
      if (!list.length || list[0].position > edgeTol) {
        list.unshift({ position: 0, thickness: 1 });
      }
      if (!list.length || size - 1 - list[list.length - 1].position > edgeTol) {
        list.push({ position: size - 1, thickness: 1 });
      }
      return collapseThinSpans(list, size);
    }
    var colsRuns = withEdges(colRuns, w);
    var rowsRuns = withEdges(rowRuns, h);
    var cols = Math.max(1, Math.min(12, colsRuns.length - 1));
    var rows = Math.max(1, Math.min(12, rowsRuns.length - 1));
    function regularity(runs, size) {
      if (!runs || runs.length < 2) return 0;
      var spans = [];
      for (var i = 1; i < runs.length; i++) spans.push(runs[i].position - runs[i - 1].position);
      var sum = 0;
      for (var j = 0; j < spans.length; j++) sum += spans[j];
      var mean = sum / spans.length;
      if (mean < size * 0.04) return 0;
      var v = 0;
      for (var k = 0; k < spans.length; k++) {
        var d = spans[k] - mean;
        v += d * d;
      }
      var cv = Math.sqrt(v / spans.length) / mean;
      return cv < 0.18 ? 1 : (cv < 0.35 ? 0.6 : 0.25);
    }
    var reg = (regularity(colsRuns, w) + regularity(rowsRuns, h)) / 2;
    var confidence = reg;
    if (cols >= 2 && rows >= 2 && reg >= 0.6) confidence = Math.max(confidence, 0.75);
    if (cols * rows >= 4 && reg >= 0.85) confidence = Math.max(confidence, 0.9);
    return { rows: rows, cols: cols, confidence: confidence, colRuns: colsRuns, rowRuns: rowsRuns };
  }

  /**
   * Detect line runs once; optionally infer grid size.
   * @returns {{ colRuns, rowRuns, w, h, inferred }|null}
   */
  function detectLineRuns(image, options) {
    var opts = options || {};
    var blackThreshold = Math.min(255, Math.max(0, parseInt(opts.blackThreshold, 10) || 80));
    var darknessThreshold = typeof opts.darknessThreshold === 'number' ? opts.darknessThreshold : 0.15;
    var minLinePx = Math.max(1, parseInt(opts.minLinePx, 10) || 1);
    var maxLinePx = typeof opts.maxLinePx === 'number' ? opts.maxLinePx : (parseInt(opts.maxLinePx, 10) || 15);
    maxLinePx = Math.max(minLinePx, maxLinePx);
    var minGap = Math.max(2, parseInt(opts.minGap, 10) || 8);
    var minSpanFraction = typeof opts.minSpanFraction === 'number' ? opts.minSpanFraction : 0.35;
    var allowDashed = opts.allowDashed === true;

    var pix = resolvePixels(image, opts);
    if (!pix) return null;
    var data = pix.data;
    var w = pix.width;
    var h = pix.height;

    var colProfile = lineAwareProfile(data, w, h, 'x', blackThreshold, minSpanFraction, allowDashed);
    var rowProfile = lineAwareProfile(data, w, h, 'y', blackThreshold, minSpanFraction, allowDashed);
    var colRuns = mergeCloseLines(findRuns(colProfile, darknessThreshold, minLinePx, maxLinePx), minGap);
    var rowRuns = mergeCloseLines(findRuns(rowProfile, darknessThreshold, minLinePx, maxLinePx), minGap);
    colRuns.sort(function (a, b) { return a.position - b.position; });
    rowRuns.sort(function (a, b) { return a.position - b.position; });

    return {
      colRuns: colRuns,
      rowRuns: rowRuns,
      w: w,
      h: h,
      inferred: inferGridSizeFromRuns(colRuns, rowRuns, w, h)
    };
  }

  /**
   * Build bounds from runs for a given rows/cols.
   */
  function boundsFromRuns(colRuns, rowRuns, w, h, gridCols, gridRows, options) {
    var opts = options || {};
    var minGap = Math.max(2, parseInt(opts.minGap, 10) || 8);
    var useActualPositions = opts.useActualLinePositions !== false;

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

    var contentW = Math.max(1, rightOuter - leftOuter);
    var contentH = Math.max(1, bottomOuter - topOuter);
    var innerColRuns = colRuns.length > 2 ? colRuns.slice(1, -1) : colRuns;
    var innerRowRuns = rowRuns.length > 2 ? rowRuns.slice(1, -1) : rowRuns;
    var relCol = innerColRuns.map(function (r) { return { position: r.position - leftOuter, thickness: r.thickness }; });
    var relRow = innerRowRuns.map(function (r) { return { position: r.position - topOuter, thickness: r.thickness }; });
    var numInnerCol = Math.max(0, gridCols - 1);
    var numInnerRow = Math.max(0, gridRows - 1);
    var innerX = (useActualPositions ? pickNLinesFromActual(relCol, contentW, numInnerCol) : pickNLines(relCol, contentW, numInnerCol)).map(function (p) { return leftOuter + p; });
    var innerY = (useActualPositions ? pickNLinesFromActual(relRow, contentH, numInnerRow) : pickNLines(relRow, contentH, numInnerRow)).map(function (p) { return topOuter + p; });
    innerX.sort(function (a, b) { return a - b; });
    innerY.sort(function (a, b) { return a - b; });

    var xBounds = enforceMinGap([leftOuter].concat(innerX).concat([rightOuter]), w, minGap);
    var yBounds = enforceMinGap([topOuter].concat(innerY).concat([bottomOuter]), h, minGap);
    xBounds = sanitizeLatticeBounds(xBounds, gridCols, minGap);
    yBounds = sanitizeLatticeBounds(yBounds, gridRows, minGap);

    var innerThickness = [];
    innerColRuns.forEach(function (r) { innerThickness.push(r.thickness); });
    innerRowRuns.forEach(function (r) { innerThickness.push(r.thickness); });
    var suggestedTrim = innerThickness.length ? Math.max.apply(null, innerThickness) : 0;

    return {
      xBounds: xBounds,
      yBounds: yBounds,
      suggestedTrim: Math.min(20, Math.ceil(suggestedTrim)),
      rows: gridRows,
      cols: gridCols
    };
  }

  /**
   * Detect grid lines from image pixel data.
   * Uses continuity (long contiguous dark span) to reject text; only accepts lines with thickness <= maxLinePx.
   * Pass options.inferSize=true to derive rows/cols from line runs instead of options.gridRows/gridCols.
   * @param {HTMLImageElement|object} image - image with naturalWidth/naturalHeight or {data,width,height}
   * @param {Object} options - { blackThreshold?, darknessThreshold?, minLinePx?, maxLinePx?, minGap?, minSpanFraction?, gridCols?, gridRows?, inferSize?, imageData? }
   * @returns {{ xBounds: number[], yBounds: number[], suggestedTrim: number, rows?: number, cols?: number }}
   */
  function detectGridLines(image, options) {
    var opts = options || {};
    var runs = detectLineRuns(image, opts);
    if (!runs) return null;

    var gridCols = Math.max(1, Math.min(12, parseInt(opts.gridCols, 10) || 4));
    var gridRows = Math.max(1, Math.min(12, parseInt(opts.gridRows, 10) || 4));
    var colRuns = runs.colRuns;
    var rowRuns = runs.rowRuns;
    if (opts.inferSize && runs.inferred && runs.inferred.cols >= 1 && runs.inferred.rows >= 1) {
      gridCols = runs.inferred.cols;
      gridRows = runs.inferred.rows;
      if (runs.inferred.colRuns) colRuns = runs.inferred.colRuns;
      if (runs.inferred.rowRuns) rowRuns = runs.inferred.rowRuns;
    }

    var result = boundsFromRuns(colRuns, rowRuns, runs.w, runs.h, gridCols, gridRows, opts);
    result.inferred = runs.inferred;
    return result;
  }

  return {
    detectGridLines: detectGridLines,
    detectLineRuns: detectLineRuns,
    boundsFromRuns: boundsFromRuns,
    inferGridSizeFromRuns: inferGridSizeFromRuns
  };
});
