/**
 * Multi-mode auto parser: pick rows/cols + mode + optional label region.
 * Depends on: imageBuffer, gridDetect, segmentDetect, segmentArrangement, labelDetect (optional).
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory(
      require('./imageBuffer'),
      require('./gridDetect'),
      require('./segmentDetect'),
      require('./segmentArrangement'),
      require('./labelDetect')
    );
  } else {
    root.parseAuto = factory(
      root.imageBuffer,
      root.gridDetect,
      root.segmentDetect,
      root.segmentArrangement,
      root.labelDetect
    );
  }
})(typeof self !== 'undefined' ? self : this, function (imageBuffer, gridDetect, segmentDetect, segmentArrangement, labelDetect) {
  'use strict';

  var UNIFORM_PRESETS = [
    { blackThreshold: 110, darknessThreshold: 0.10, minLinePx: 1, minGap: 6, minSpanFraction: 0.30, useActualLinePositions: true },
    { blackThreshold: 185, darknessThreshold: 0.06, minLinePx: 1, minGap: 6, minSpanFraction: 0.12, allowDashed: true, useActualLinePositions: true }
  ];

  function boundsToCells(xBounds, yBounds) {
    var cells = [];
    if (!xBounds || !yBounds || xBounds.length < 2 || yBounds.length < 2) return cells;
    for (var j = 0; j < yBounds.length - 1; j++) {
      for (var i = 0; i < xBounds.length - 1; i++) {
        cells.push({
          x: xBounds[i],
          y: yBounds[j],
          w: xBounds[i + 1] - xBounds[i],
          h: yBounds[j + 1] - yBounds[j]
        });
      }
    }
    return cells;
  }

  function prioritizeModesFromSignals(signals) {
    if (!signals || typeof signals.darkRatio !== 'number') {
      return ['uniform', 'lineform', 'freeform', 'blackbg'];
    }
    var d = signals.darkRatio;
    var l = signals.lightRatio;
    // Dark canvases: try blackbg first.
    if (d > 0.45) return ['blackbg', 'uniform', 'lineform', 'freeform'];
    // Mostly white: try freeform (icon packs) before inventing grid lines.
    if (l > 0.45) return ['freeform', 'uniform', 'lineform'];
    if (d >= 0.15 && d <= 0.35) return ['uniform', 'lineform', 'freeform', 'blackbg'];
    return ['uniform', 'freeform', 'lineform', 'blackbg'];
  }

  function scoreUniformLayout(cand, w, h) {
    if (!cand || !cand.xBounds || !cand.yBounds) return -1e9;
    var cols = cand.xBounds.length - 1;
    var rows = cand.yBounds.length - 1;
    if (cols < 1 || rows < 1) return -1e9;
    var x0 = cand.xBounds[0];
    var x1 = cand.xBounds[cand.xBounds.length - 1];
    var y0 = cand.yBounds[0];
    var y1 = cand.yBounds[cand.yBounds.length - 1];
    var coverage = ((x1 - x0) * (y1 - y0)) / Math.max(1, w * h);
    function spanVariance(bounds) {
      if (bounds.length < 2) return 0;
      var spans = [];
      var sum = 0;
      for (var i = 1; i < bounds.length; i++) {
        var s = bounds[i] - bounds[i - 1];
        spans.push(s);
        sum += s;
      }
      var mean = sum / spans.length;
      var v = 0;
      for (var j = 0; j < spans.length; j++) {
        var d = spans[j] - mean;
        v += d * d;
      }
      return Math.sqrt(v / spans.length) / Math.max(1, mean);
    }
    var cv = spanVariance(cand.xBounds) + spanVariance(cand.yBounds);
    // Regularity first — do NOT reward denser grids (that caused 5×5 bias).
    var score = coverage * 50 - cv * 120;
    // Mild prior for common icon-sheet sizes; slight penalty for uncommon large grids.
    if ((rows === 3 && cols === 3) || (rows === 4 && cols === 4)) score += 18;
    else if ((rows === 2 && cols === 2) || (rows === 3 && cols === 4) || (rows === 4 && cols === 3)) score += 10;
    else if (rows >= 5 && cols >= 5) score -= 8;
    if (cand.inferredConfidence) score += cand.inferredConfidence * 40;
    if (cand.lineEvidence) score += cand.lineEvidence * 30;
    return score;
  }

  /**
   * Sample a cut line: good cuts stay on background/separators;
   * bad cuts cross multi-color icon content.
   * @returns {{ contentRatio: number, chromaVar: number, crossing: number }}
   *   crossing in [0,1] — higher = more likely cutting through artwork.
   */
  function sampleCutLine(data, w, h, axis, pos, from, to) {
    pos = Math.max(0, Math.min((axis === 'x' ? w : h) - 1, Math.round(pos)));
    from = Math.max(0, Math.floor(from));
    to = Math.min(axis === 'x' ? h : w, Math.ceil(to));
    var step = Math.max(1, Math.floor((to - from) / 64));
    var content = 0;
    var total = 0;
    var sumC = 0;
    var sumC2 = 0;
    var prevL = null;
    var transitions = 0;
    for (var t = from; t < to; t += step) {
      var x = axis === 'x' ? pos : t;
      var y = axis === 'x' ? t : pos;
      var i = (y * w + x) * 4;
      var a = data[i + 3] / 255;
      var r = data[i] * a + 255 * (1 - a);
      var g = data[i + 1] * a + 255 * (1 - a);
      var b = data[i + 2] * a + 255 * (1 - a);
      var L = 0.299 * r + 0.587 * g + 0.114 * b;
      var maxCh = Math.max(r, g, b);
      var minCh = Math.min(r, g, b);
      var chroma = maxCh - minCh;
      total++;
      sumC += chroma;
      sumC2 += chroma * chroma;
      // Content = mid-tone colorful OR mid-tone with structure (not plain white/black gutter).
      var isSeparator = L <= 45 || L >= 235 || (chroma < 18 && (L <= 70 || L >= 200));
      if (!isSeparator) content++;
      if (prevL != null && Math.abs(L - prevL) > 35) transitions++;
      prevL = L;
    }
    if (total < 4) return { contentRatio: 0, chromaVar: 0, crossing: 0 };
    var contentRatio = content / total;
    var meanC = sumC / total;
    var chromaVar = Math.max(0, sumC2 / total - meanC * meanC);
    var transitionRatio = transitions / total;
    // Crossing score: colorful mid-tones + chroma diversity + luminance jumps.
    var crossing = Math.min(1, contentRatio * 0.55 + Math.min(1, chromaVar / 1200) * 0.25 + transitionRatio * 0.35);
    return { contentRatio: contentRatio, chromaVar: chromaVar, crossing: crossing };
  }

  /**
   * Average cut-through score for inner grid lines (uniform bounds).
   * Outer bounds are ignored (image edges).
   */
  function cutThroughScoreBounds(imageData, xBounds, yBounds) {
    if (!imageData || !imageData.data || !xBounds || !yBounds) return 0;
    var data = imageData.data;
    var w = imageData.width;
    var h = imageData.height;
    var scores = [];
    var y0 = yBounds[0];
    var y1 = yBounds[yBounds.length - 1];
    var x0 = xBounds[0];
    var x1 = xBounds[xBounds.length - 1];
    for (var i = 1; i < xBounds.length - 1; i++) {
      scores.push(sampleCutLine(data, w, h, 'x', xBounds[i], y0, y1).crossing);
    }
    for (var j = 1; j < yBounds.length - 1; j++) {
      scores.push(sampleCutLine(data, w, h, 'y', yBounds[j], x0, x1).crossing);
    }
    if (!scores.length) return 0;
    var sum = 0;
    for (var k = 0; k < scores.length; k++) sum += scores[k];
    return sum / scores.length;
  }

  /**
   * For cell lists: sample shared mid-edges between neighboring cells.
   */
  function cutThroughScoreCells(imageData, cells) {
    if (!imageData || !imageData.data || !cells || cells.length < 2) return 0;
    var data = imageData.data;
    var w = imageData.width;
    var h = imageData.height;
    var scores = [];
    var tol = Math.max(3, Math.min(w, h) * 0.02);
    for (var i = 0; i < cells.length; i++) {
      for (var j = i + 1; j < cells.length; j++) {
        var a = cells[i];
        var b = cells[j];
        // Vertical adjacency: a's right ≈ b's left
        if (Math.abs((a.x + a.w) - b.x) <= tol) {
          var yFrom = Math.max(a.y, b.y);
          var yTo = Math.min(a.y + a.h, b.y + b.h);
          if (yTo - yFrom > 4) {
            scores.push(sampleCutLine(data, w, h, 'x', (a.x + a.w + b.x) / 2, yFrom, yTo).crossing);
          }
        } else if (Math.abs((b.x + b.w) - a.x) <= tol) {
          var yFrom2 = Math.max(a.y, b.y);
          var yTo2 = Math.min(a.y + a.h, b.y + b.h);
          if (yTo2 - yFrom2 > 4) {
            scores.push(sampleCutLine(data, w, h, 'x', (b.x + b.w + a.x) / 2, yFrom2, yTo2).crossing);
          }
        }
        // Horizontal adjacency
        if (Math.abs((a.y + a.h) - b.y) <= tol) {
          var xFrom = Math.max(a.x, b.x);
          var xTo = Math.min(a.x + a.w, b.x + b.w);
          if (xTo - xFrom > 4) {
            scores.push(sampleCutLine(data, w, h, 'y', (a.y + a.h + b.y) / 2, xFrom, xTo).crossing);
          }
        } else if (Math.abs((b.y + b.h) - a.y) <= tol) {
          var xFrom2 = Math.max(a.x, b.x);
          var xTo2 = Math.min(a.x + a.w, b.x + b.w);
          if (xTo2 - xFrom2 > 4) {
            scores.push(sampleCutLine(data, w, h, 'y', (b.y + b.h + a.y) / 2, xFrom2, xTo2).crossing);
          }
        }
      }
    }
    if (!scores.length) return 0;
    var sum = 0;
    for (var k = 0; k < scores.length; k++) sum += scores[k];
    return sum / scores.length;
  }

  function cutThroughForCandidate(cand, imageData) {
    if (!imageData) return 0;
    if ((cand.mode === 'uniform' || cand.mode === 'geometrical') && cand.xBounds && cand.yBounds) {
      return cutThroughScoreBounds(imageData, cand.xBounds, cand.yBounds);
    }
    if (cand.cells && cand.cells.length) {
      return cutThroughScoreCells(imageData, cand.cells);
    }
    return 0;
  }

  function isRectangularCount(n) {
    if (n < 2) return false;
    for (var r = 1; r <= 12; r++) {
      if (n % r === 0) {
        var c = n / r;
        if (c >= 1 && c <= 12) return true;
      }
    }
    return false;
  }

  function scoreCandidateUnified(cand, w, h, signals, imageData) {
    var minC = 2;
    var maxC = 72;
    var imgArea = w * h;
    var cells = (cand.mode === 'uniform' || cand.mode === 'geometrical')
      ? boundsToCells(cand.xBounds, cand.yBounds)
      : (cand.cells || []);
    if (cells.length < minC || cells.length > maxC) {
      return { valid: false, score: -1e9, confidence: 'low', cutThrough: 1 };
    }
    var maxArea = 0;
    var stripPenalty = 0;
    var tinyPenalty = 0;
    var areas = [];
    for (var i = 0; i < cells.length; i++) {
      var c = cells[i];
      var area = c.w * c.h;
      areas.push(area);
      if (area > maxArea) maxArea = area;
      var minSide = Math.min(c.w, c.h);
      var aspect = Math.max(c.w, c.h) / Math.max(1, minSide);
      if (minSide < Math.min(w, h) * 0.06) stripPenalty += 2;
      if (aspect > 6) stripPenalty += 1;
    }
    areas.sort(function (a, b) { return a - b; });
    var medianArea = areas[Math.floor(areas.length / 2)] || 1;
    for (var t = 0; t < areas.length; t++) {
      if (areas[t] < medianArea * 0.25) tinyPenalty++;
    }
    var meanArea = imgArea / cells.length;
    var variance = 0;
    for (var v = 0; v < areas.length; v++) variance += (areas[v] - meanArea) * (areas[v] - meanArea);
    variance = variance / cells.length;
    var cv = meanArea > 0 ? Math.sqrt(variance) / meanArea : 1;
    var variancePenalty = cv > 0.8 ? 25 : (cv > 0.5 ? 12 : 0);
    // Flat base — do not reward "more cells" alone (5×5 / over-segmentation bias).
    var score = 40;
    var dominance = maxArea / imgArea;
    if (dominance > 0.55) score -= (dominance - 0.55) * 200;
    score -= stripPenalty * 35;
    score -= tinyPenalty * 25;
    score -= variancePenalty;

    if (cand.mode === 'uniform') {
      score += 20 + Math.min(60, scoreUniformLayout(cand, w, h));
    } else if (isRectangularCount(cells.length) && cv < 0.4) {
      score += 35;
      // Prefer exact common sheet sizes for icon packs without lines.
      if (cells.length === 9 || cells.length === 16) score += 25;
      else if (cells.length === 4 || cells.length === 12 || cells.length === 20 || cells.length === 24) score += 12;
    } else if (!isRectangularCount(cells.length)) {
      score -= 20;
    }

    if (cand.mode === 'blackbg' && signals && signals.lightRatio > 0.4) {
      score -= 80;
    }
    if (cand.mode === 'freeform' && cand.source === 'whiteGaps' && cells.length > 24) {
      score -= (cells.length - 24) * 4;
    }
    if (cand.mode === 'lineform' && cells.length > 24) {
      score -= (cells.length - 24) * 5;
    }
    // Over-segmented lineform vs a clean freeform rectangle count
    if (cand.mode === 'lineform' && cv > 0.45) score -= 25;

    // Cut lines that cross multi-color shapes are almost always wrong.
    var cutThrough = cutThroughForCandidate(cand, imageData);
    cand.cutThrough = cutThrough;
    if (cutThrough > 0.55) {
      return { valid: false, score: -1e9, confidence: 'low', cutThrough: cutThrough, cellCount: cells.length };
    }
    if (cutThrough > 0.35) score -= (cutThrough - 0.35) * 180;
    else if (cutThrough < 0.15) score += 18;

    var confidence = score > 80 ? 'high' : (score > 40 ? 'medium' : 'low');
    return { valid: true, score: score, confidence: confidence, cellCount: cells.length, cutThrough: cutThrough };
  }

  function makeImageProxy(buffer) {
    return {
      data: buffer.data,
      width: buffer.width,
      height: buffer.height,
      naturalWidth: buffer.width,
      naturalHeight: buffer.height
    };
  }

  function getUniformCandidate(proxy, w, h, imageData) {
    if (!gridDetect || !gridDetect.detectGridLines) return null;
    var best = null;
    var bestScore = -1e9;
    for (var p = 0; p < UNIFORM_PRESETS.length; p++) {
      var opts = {};
      for (var k in UNIFORM_PRESETS[p]) opts[k] = UNIFORM_PRESETS[p][k];
      opts.inferSize = true;
      opts.imageData = imageData;
      var runs = gridDetect.detectLineRuns ? gridDetect.detectLineRuns(proxy, opts) : null;
      var result = gridDetect.detectGridLines(proxy, opts);
      if (!result || !result.xBounds || !result.yBounds) continue;
      var rows = result.yBounds.length - 1;
      var cols = result.xBounds.length - 1;
      if (rows < 2 || cols < 2 || rows > 12 || cols > 12) continue;
      if (rows * cols < 4) continue;
      var conf = result.inferred ? result.inferred.confidence : 0;
      // Line evidence: actual run count should match rows+1 / cols+1 (edged runs).
      var lineEvidence = 0;
      if (runs && result.inferred) {
        var cRuns = (result.inferred.colRuns || runs.colRuns || []).length;
        var rRuns = (result.inferred.rowRuns || runs.rowRuns || []).length;
        var colOk = Math.abs(cRuns - (cols + 1)) <= 1;
        var rowOk = Math.abs(rRuns - (rows + 1)) <= 1;
        if (colOk && rowOk) lineEvidence = 1;
        else if (colOk || rowOk) lineEvidence = 0.35;
        else lineEvidence = 0;
      }
      // Reject dashed-only weak lattices and sizes without line support.
      if (opts.allowDashed && conf < 0.7) continue;
      if (conf < 0.45 && lineEvidence < 0.9) continue;
      if (lineEvidence < 0.35 && conf < 0.75) continue;
      var cand = {
        mode: 'uniform',
        xBounds: result.xBounds.slice(),
        yBounds: result.yBounds.slice(),
        rows: rows,
        cols: cols,
        source: opts.allowDashed ? 'gridLinesDashed' : 'gridLines',
        inferredConfidence: conf,
        lineEvidence: lineEvidence
      };
      var cutThrough = cutThroughScoreBounds(imageData, cand.xBounds, cand.yBounds);
      if (cutThrough > 0.45) continue; // cuts through icons → reject
      cand.cutThrough = cutThrough;
      var score = scoreUniformLayout(cand, w, h) - cutThrough * 80;
      if (score > bestScore) {
        bestScore = score;
        best = cand;
      }
      if (!opts.allowDashed && conf >= 0.8 && lineEvidence >= 0.9 && cutThrough < 0.2 && score > 30) break;
    }
    return best;
  }

  function equalBoundsFromCells(cells, rows, cols, w, h) {
    if (!cells || !cells.length || rows < 1 || cols < 1) return null;
    var minX = Infinity;
    var minY = Infinity;
    var maxX = -Infinity;
    var maxY = -Infinity;
    for (var i = 0; i < cells.length; i++) {
      var c = cells[i];
      if (c.x < minX) minX = c.x;
      if (c.y < minY) minY = c.y;
      if (c.x + c.w > maxX) maxX = c.x + c.w;
      if (c.y + c.h > maxY) maxY = c.y + c.h;
    }
    if (!(maxX > minX && maxY > minY)) {
      minX = 0; minY = 0; maxX = w; maxY = h;
    }
    var xBounds = [];
    var yBounds = [];
    for (var c2 = 0; c2 <= cols; c2++) xBounds.push(minX + (c2 * (maxX - minX)) / cols);
    for (var r = 0; r <= rows; r++) yBounds.push(minY + (r * (maxY - minY)) / rows);
    return { xBounds: xBounds, yBounds: yBounds, rows: rows, cols: cols };
  }

  function filterTinyCells(cells, w, h) {
    if (!cells) return [];
    var minSide = Math.min(w, h) * 0.04;
    return cells.filter(function (c) {
      return c.w >= minSide && c.h >= minSide && c.w * c.h >= (w * h) * 0.004;
    });
  }

  function getFreeformCandidate(proxy, w, h, imageData) {
    if (!segmentDetect) return null;
    var best = null;
    var bestScore = -1;
    function consider(cells, source) {
      cells = filterTinyCells(cells, w, h);
      if (!cells || cells.length < 2 || cells.length > 64) return;
      var score = cells.length * 10;
      if (score > bestScore) {
        bestScore = score;
        best = { mode: 'freeform', cells: cells.slice(), source: source };
      }
    }
    if (segmentDetect.detectPanelRects) {
      consider(segmentDetect.detectPanelRects(proxy, {
        nonWhiteThreshold: 244,
        minAreaFraction: 0.006,
        minWFrac: 0.05,
        minHFrac: 0.05,
        minFillRatio: 0.10,
        padPx: 1,
        mergeGapPx: 1,
        imageData: imageData
      }) || [], 'panelRects');
    }
    if (segmentDetect.detectWhiteGaps && segmentArrangement && segmentArrangement.segmentsToCells) {
      var gaps = segmentDetect.detectWhiteGaps(proxy, { imageData: imageData }) || [];
      if (gaps.length) consider(segmentArrangement.segmentsToCells(w, h, gaps) || [], 'whiteGaps');
    }
    return best;
  }

  function getLineformCandidate(proxy, w, h, imageData) {
    if (!segmentDetect || !segmentDetect.detectDarkLines || !segmentArrangement) return null;
    var segs = segmentDetect.detectDarkLines(proxy, {
      darkThreshold: 140,
      minRunFraction: 0.12,
      minLinePx: 1,
      maxLinePx: 18,
      imageData: imageData
    }) || [];
    if (segs.length < 2) return null;
    var cells = filterTinyCells(segmentArrangement.segmentsToCells(w, h, segs) || [], w, h);
    if (cells.length < 2 || cells.length > 64) return null;
    return { mode: 'lineform', cells: cells, source: 'darkLines' };
  }

  function getBlackBgCandidate(proxy, w, h, imageData) {
    if (!segmentDetect) return null;
    var best = null;
    var bestScore = -1e9;
    if (segmentDetect.detectIsolatedShapesOnBlackBg) {
      var rects = segmentDetect.detectIsolatedShapesOnBlackBg(proxy, {
        darkBgThreshold: 80,
        minAreaFraction: 0.008,
        minWFrac: 0.05,
        minHFrac: 0.05,
        padPx: 1,
        mergeGapPx: 2,
        imageData: imageData
      }) || [];
      rects = filterTinyCells(rects, w, h);
      if (rects.length >= 2 && rects.length <= 64) {
        var cand = { mode: 'blackbg', cells: rects, source: 'isolatedShapes' };
        var s = scoreCandidateUnified(cand, w, h, null, imageData);
        if (s.valid && s.score > bestScore) {
          bestScore = s.score;
          best = cand;
        }
      }
    }
    if (segmentDetect.detectAdjacentDarkSeparators && segmentArrangement) {
      var segs = segmentDetect.detectAdjacentDarkSeparators(proxy, {
        darkThreshold: 100,
        minSpanFraction: 0.4,
        maxThicknessPx: 20,
        darknessFraction: 0.5,
        imageData: imageData
      }) || [];
      if (segs.length) {
        var cells = filterTinyCells(segmentArrangement.segmentsToCells(w, h, segs) || [], w, h);
        if (cells.length >= 2 && cells.length <= 64) {
          var cand2 = { mode: 'blackbg', cells: cells, source: 'cutLines' };
          var s2 = scoreCandidateUnified(cand2, w, h, null, imageData);
          if (s2.valid && s2.score > bestScore) best = cand2;
        }
      }
    }
    return best;
  }

  function inferRowsColsFromCells(cells, w, h) {
    if (!cells || !cells.length) return { rows: 0, cols: 0 };
    var ys = cells.map(function (c) { return Math.round(c.y + c.h / 2); }).sort(function (a, b) { return a - b; });
    var xs = cells.map(function (c) { return Math.round(c.x + c.w / 2); }).sort(function (a, b) { return a - b; });
    function cluster1D(vals, tol) {
      if (!vals.length) return 0;
      var groups = 1;
      var last = vals[0];
      for (var i = 1; i < vals.length; i++) {
        if (vals[i] - last > tol) {
          groups++;
          last = vals[i];
        } else {
          last = (last + vals[i]) / 2;
        }
      }
      return groups;
    }
    var rowTol = Math.max(8, h * 0.06);
    var colTol = Math.max(8, w * 0.06);
    return {
      rows: cluster1D(ys, rowTol),
      cols: cluster1D(xs, colTol)
    };
  }

  /**
   * Main entry: select best parse for an image buffer or DOM image.
   * @param {HTMLImageElement|{data,width,height}} image
   * @param {{ maxSide?: number, imageData?: object }} [options]
   */
  function selectBestParse(image, options) {
    var opts = options || {};
    var buffer = opts.imageData
      ? {
          data: opts.imageData.data,
          width: opts.imageData.width,
          height: opts.imageData.height,
          scale: opts.scale || 1,
          fullWidth: opts.fullWidth || opts.imageData.width,
          fullHeight: opts.fullHeight || opts.imageData.height
        }
      : (imageBuffer && imageBuffer.fromImage
          ? imageBuffer.fromImage(image, { maxSide: opts.maxSide || imageBuffer.DEFAULT_MAX_SIDE })
          : null);

    if (!buffer && image && image.data) {
      buffer = {
        data: image.data,
        width: image.width,
        height: image.height,
        scale: 1,
        fullWidth: image.width,
        fullHeight: image.height
      };
    }
    if (!buffer) return null;

    var w = buffer.width;
    var h = buffer.height;
    var imageData = { data: buffer.data, width: w, height: h };
    var proxy = makeImageProxy(buffer);
    var signals = imageBuffer && imageBuffer.getQuickSignals
      ? imageBuffer.getQuickSignals(buffer)
      : { darkRatio: 0.2, lightRatio: 0.5 };
    var shortlist = prioritizeModesFromSignals(signals);

    var candidates = [];
    var uniformCand = null;

    for (var i = 0; i < shortlist.length; i++) {
      var mode = shortlist[i];
      var cand = null;
      if (mode === 'uniform') {
        cand = getUniformCandidate(proxy, w, h, imageData);
        uniformCand = cand;
      } else if (mode === 'freeform') {
        cand = getFreeformCandidate(proxy, w, h, imageData);
      } else if (mode === 'lineform') {
        cand = getLineformCandidate(proxy, w, h, imageData);
      } else if (mode === 'blackbg') {
        cand = getBlackBgCandidate(proxy, w, h, imageData);
      }
      if (cand) candidates.push(cand);

      // Early exit only for strong line-backed uniform grids that don't cut icons
      if (mode === 'uniform' && cand && cand.lineEvidence >= 0.9 && cand.inferredConfidence >= 0.7) {
        var early = scoreCandidateUnified(cand, w, h, signals, imageData);
        if (early.valid && early.score >= 70 && (early.cutThrough == null || early.cutThrough < 0.25)) {
          candidates = [cand];
          break;
        }
      }
    }

    if (!candidates.length && uniformCand) candidates.push(uniformCand);
    if (!candidates.length) return null;

    var scored = [];
    for (var s = 0; s < candidates.length; s++) {
      var sc = scoreCandidateUnified(candidates[s], w, h, signals, imageData);
      if (sc.valid) scored.push({ candidate: candidates[s], score: sc.score, confidence: sc.confidence, cellCount: sc.cellCount, cutThrough: sc.cutThrough });
    }
    if (!scored.length) return null;
    scored.sort(function (a, b) { return b.score - a.score; });
    var best = scored[0];
    var gap = scored.length > 1 ? (best.score - scored[1].score) : best.score;
    var confidence = gap >= 30 ? 'high' : (gap >= 15 || best.score > 80 ? 'medium' : 'low');
    var candOut = best.candidate;

    // Icon packs without grid lines: snap freeform panels to equal uniform bounds
    // when we have a clean rectangular count (3×3 / 4×4 / …) AND snaps don't cut icons.
    if (candOut.mode === 'freeform' && candOut.cells && candOut.cells.length >= 4) {
      var dims = inferRowsColsFromCells(candOut.cells, w, h);
      if (dims.rows >= 2 && dims.cols >= 2 && dims.rows * dims.cols === candOut.cells.length) {
        var snapped = equalBoundsFromCells(candOut.cells, dims.rows, dims.cols, w, h);
        if (snapped) {
          var snapCut = cutThroughScoreBounds(imageData, snapped.xBounds, snapped.yBounds);
          if (snapCut < 0.35) {
            candOut = {
              mode: 'uniform',
              xBounds: snapped.xBounds,
              yBounds: snapped.yBounds,
              rows: dims.rows,
              cols: dims.cols,
              source: 'contentGrid',
              inferredConfidence: 0.8,
              lineEvidence: 0,
              cutThrough: snapCut
            };
          }
        }
      }
    }

    var cells = (candOut.mode === 'uniform')
      ? boundsToCells(candOut.xBounds, candOut.yBounds)
      : (candOut.cells || []);
    var rows = candOut.rows;
    var cols = candOut.cols;
    if ((!rows || !cols) && cells.length) {
      var inferred = inferRowsColsFromCells(cells, w, h);
      rows = inferred.rows;
      cols = inferred.cols;
    }

    // Scale coords back to full image if buffer was downscaled
    var scale = buffer.scale || 1;
    if (scale !== 1 && imageBuffer) {
      if (candOut.xBounds) candOut.xBounds = imageBuffer.scaleBounds(candOut.xBounds, scale);
      if (candOut.yBounds) candOut.yBounds = imageBuffer.scaleBounds(candOut.yBounds, scale);
      if (candOut.cells) candOut.cells = imageBuffer.scaleCells(candOut.cells, scale);
      cells = (candOut.mode === 'uniform')
        ? boundsToCells(candOut.xBounds, candOut.yBounds)
        : (candOut.cells || []);
    }

    var label = { hasLabel: false, region: 'none', percent: 30, confidence: 0 };
    if (labelDetect && labelDetect.detectLabelRegion && cells.length) {
      // Use analysis-scale cells for label detect on same buffer
      var labelCells = scale !== 1 && imageBuffer
        ? imageBuffer.scaleCells(cells, 1 / scale)
        : cells;
      label = labelDetect.detectLabelRegion(proxy, labelCells, { imageData: imageData });
    }

    return {
      mode: candOut.mode,
      xBounds: candOut.xBounds || null,
      yBounds: candOut.yBounds || null,
      cells: candOut.cells || null,
      rows: rows || 0,
      cols: cols || 0,
      cellCount: cells.length,
      confidence: confidence,
      source: candOut.source || null,
      score: best.score,
      label: label,
      signals: signals
    };
  }

  return {
    selectBestParse: selectBestParse,
    prioritizeModesFromSignals: prioritizeModesFromSignals,
    scoreCandidateUnified: scoreCandidateUnified,
    boundsToCells: boundsToCells,
    getUniformCandidate: getUniformCandidate
  };
});
