/**
 * Detect whether cells have text labels and where (top/bottom/left/right).
 * Pure pixel heuristics — no OCR.
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.labelDetect = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function luminance(r, g, b) {
    return 0.299 * r + 0.587 * g + 0.114 * b;
  }

  function pixelL(data, i) {
    var a = data[i + 3] / 255;
    return luminance(data[i], data[i + 1], data[i + 2]) * a + 255 * (1 - a);
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
    return null;
  }

  /**
   * Score a band for "text-like" content: dark ink density + horizontal high-freq variance.
   */
  function scoreBand(data, w, h, x0, y0, bw, bh) {
    x0 = Math.max(0, Math.floor(x0));
    y0 = Math.max(0, Math.floor(y0));
    bw = Math.max(1, Math.floor(bw));
    bh = Math.max(1, Math.floor(bh));
    var x1 = Math.min(w, x0 + bw);
    var y1 = Math.min(h, y0 + bh);
    var dark = 0;
    var total = 0;
    var edge = 0;
    var prevL = null;
    for (var y = y0; y < y1; y++) {
      prevL = null;
      for (var x = x0; x < x1; x++) {
        var i = (y * w + x) * 4;
        var L = pixelL(data, i);
        total++;
        if (L < 90) dark++;
        if (prevL != null && Math.abs(L - prevL) > 40) edge++;
        prevL = L;
      }
    }
    if (total < 8) return 0;
    var darkRatio = dark / total;
    var edgeRatio = edge / total;
    // Text: moderate dark ink + high horizontal transitions; solid icons: high fill, lower HF
    if (darkRatio < 0.02) return 0;
    if (darkRatio > 0.55) return darkRatio * 0.3; // large solid shape, not label
    return darkRatio * 2.2 + edgeRatio * 3.5;
  }

  function bandRects(cell, pct) {
    var p = Math.max(0.12, Math.min(0.4, pct || 0.25));
    var bandH = Math.max(4, Math.floor(cell.h * p));
    var bandW = Math.max(4, Math.floor(cell.w * p));
    return {
      bottom: { x: cell.x, y: cell.y + cell.h - bandH, w: cell.w, h: bandH, pct: Math.round(p * 100) },
      top: { x: cell.x, y: cell.y, w: cell.w, h: bandH, pct: Math.round(p * 100) },
      left: { x: cell.x, y: cell.y, w: bandW, h: cell.h, pct: Math.round(p * 100) },
      right: { x: cell.x + cell.w - bandW, y: cell.y, w: bandW, h: cell.h, pct: Math.round(p * 100) }
    };
  }

  /**
   * @param {object} image - image or {data,width,height}
   * @param {Array<{x,y,w,h}>} cells
   * @param {{ imageData?, sampleLimit?, bandPct? }} [options]
   * @returns {{ hasLabel: boolean, region: 'none'|'bottom'|'top'|'left'|'right', percent: number, confidence: number, votes: object }}
   */
  function detectLabelRegion(image, cells, options) {
    var opts = options || {};
    var pix = resolvePixels(image, opts);
    if (!pix || !cells || !cells.length) {
      return { hasLabel: false, region: 'none', percent: 30, confidence: 0, votes: {} };
    }
    var data = pix.data;
    var w = pix.width;
    var h = pix.height;
    var sampleLimit = opts.sampleLimit || 12;
    var bandPct = opts.bandPct || 0.25;
    var sample = cells.slice(0, Math.min(cells.length, sampleLimit));
    var votes = { bottom: 0, top: 0, left: 0, right: 0, none: 0 };
    var bestPctSum = { bottom: 0, top: 0, left: 0, right: 0 };
    var scored = 0;

    for (var i = 0; i < sample.length; i++) {
      var cell = sample[i];
      if (!cell || cell.w < 12 || cell.h < 12) continue;
      var bands = bandRects(cell, bandPct);
      var scores = {};
      var regions = ['bottom', 'top', 'left', 'right'];
      var maxR = 'none';
      var maxS = 0;
      var second = 0;
      for (var r = 0; r < regions.length; r++) {
        var key = regions[r];
        var b = bands[key];
        var s = scoreBand(data, w, h, b.x, b.y, b.w, b.h);
        scores[key] = s;
        if (s > maxS) {
          second = maxS;
          maxS = s;
          maxR = key;
        } else if (s > second) {
          second = s;
        }
      }
      // Center band (icon body) as baseline — labels should beat mid content text density carefully
      var midH = Math.max(4, Math.floor(cell.h * 0.3));
      var midY = cell.y + Math.floor((cell.h - midH) / 2);
      var midScore = scoreBand(data, w, h, cell.x + cell.w * 0.15, midY, cell.w * 0.7, midH);
      scored++;
      // Prefer top/bottom labels; left/right need much stronger evidence (avoid icon edges).
      var sideBias = 1;
      if (maxR === 'left' || maxR === 'right') sideBias = 0.55;
      var effective = maxS * sideBias;
      if (effective < 0.28 || effective < midScore * 1.05) {
        votes.none++;
      } else if (maxS - second < 0.08 && maxR !== 'bottom' && maxR !== 'top') {
        votes.none++;
      } else if ((maxR === 'left' || maxR === 'right') && maxS < 0.45) {
        votes.none++;
      } else {
        votes[maxR]++;
        bestPctSum[maxR] += bands[maxR].pct;
      }
    }

    if (scored === 0) {
      return { hasLabel: false, region: 'none', percent: 30, confidence: 0, votes: votes };
    }

    var bestRegion = 'none';
    var bestVotes = votes.none;
    ['bottom', 'top', 'left', 'right'].forEach(function (k) {
      if (votes[k] > bestVotes) {
        bestVotes = votes[k];
        bestRegion = k;
      }
    });

    var hasLabel = bestRegion !== 'none' && bestVotes >= Math.ceil(scored * 0.5);
    var percent = 30;
    if (hasLabel && bestVotes > 0) {
      percent = Math.round(bestPctSum[bestRegion] / bestVotes);
      percent = Math.max(12, Math.min(40, percent));
    }
    var confidence = bestVotes / scored;
    return {
      hasLabel: hasLabel,
      region: hasLabel ? bestRegion : 'none',
      percent: percent,
      confidence: confidence,
      votes: votes
    };
  }

  return { detectLabelRegion: detectLabelRegion, scoreBand: scoreBand };
});
