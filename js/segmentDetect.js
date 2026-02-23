/**
 * Detect white/light gaps in an image and return axis-aligned segments.
 * Used for freeform grid: comic-style layouts with white space between cells.
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.segmentDetect = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function luminance(r, g, b) {
    return 0.299 * r + 0.587 * g + 0.114 * b;
  }

  /**
   * Build "light" profile: fraction of pixels in each row/column that are above whiteThreshold.
   */
  function lightProfile(data, w, h, axis, whiteThreshold) {
    var out = [];
    if (axis === 'x') {
      for (var x = 0; x < w; x++) {
        var light = 0;
        for (var y = 0; y < h; y++) {
          var i = (y * w + x) * 4;
          var L = luminance(data[i], data[i + 1], data[i + 2]);
          if (L >= whiteThreshold) light++;
        }
        out.push(light / h);
      }
    } else {
      for (var y = 0; y < h; y++) {
        var light = 0;
        for (var x = 0; x < w; x++) {
          var i = (y * w + x) * 4;
          var L = luminance(data[i], data[i + 1], data[i + 2]);
          if (L >= whiteThreshold) light++;
        }
        out.push(light / w);
      }
    }
    return out;
  }

  /**
   * Find runs of indices where profile value >= threshold.
   * Returns array of { start, end } (inclusive end = last index of run).
   */
  function findLightRuns(profile, threshold, minRunLength) {
    var runs = [];
    var i = 0;
    while (i < profile.length) {
      if (profile[i] >= threshold) {
        var start = i;
        while (i < profile.length && profile[i] >= threshold) i++;
        if (i - start >= minRunLength) {
          runs.push({ start: start, end: i - 1 });
        }
      } else {
        i++;
      }
    }
    return runs;
  }

  /**
   * Merge runs that are very close (e.g. gap of 1-2 rows/cols).
   */
  function mergeCloseRuns(runs, maxGap) {
    if (runs.length <= 1) return runs;
    var out = [runs[0]];
    for (var k = 1; k < runs.length; k++) {
      var prev = out[out.length - 1];
      var cur = runs[k];
      if (cur.start - prev.end <= maxGap) {
        out[out.length - 1] = { start: prev.start, end: cur.end };
      } else {
        out.push(cur);
      }
    }
    return out;
  }

  /**
   * Detect white/light gaps and return axis-aligned segments.
   * @param {HTMLImageElement} image - image with naturalWidth/naturalHeight
   * @param {Object} options - { whiteThreshold?: number (0-255), lightFraction?: number (0-1), minGapPx?: number, maxGapPx?: number, mergeGap?: number }
   * @returns {Array<{x1,y1,x2,y2}>} segments in image coordinates
   */
  function detectWhiteGaps(image, options) {
    var opts = options || {};
    var whiteThreshold = Math.min(255, Math.max(0, parseInt(opts.whiteThreshold, 10) || 220));
    var lightFraction = typeof opts.lightFraction === 'number' ? opts.lightFraction : 0.85;
    var minGapPx = Math.max(1, parseInt(opts.minGapPx, 10) || 3);
    var maxGapPx = typeof opts.maxGapPx === 'number' ? opts.maxGapPx : (parseInt(opts.maxGapPx, 10) || 100);
    var mergeGap = Math.max(0, parseInt(opts.mergeGap, 10) || 2);

    var w = image.naturalWidth || image.width;
    var h = image.naturalHeight || image.height;
    if (!w || !h) return [];

    var canvas = typeof document !== 'undefined' && document.createElement('canvas');
    if (!canvas) return [];
    canvas.width = w;
    canvas.height = h;
    var ctx = canvas.getContext('2d');
    if (!ctx) return [];
    ctx.drawImage(image, 0, 0);
    var data = ctx.getImageData(0, 0, w, h).data;

    var segments = [];

    var rowProfile = lightProfile(data, w, h, 'y', whiteThreshold);
    var rowRuns = findLightRuns(rowProfile, lightFraction, minGapPx);
    rowRuns = mergeCloseRuns(rowRuns, mergeGap);
    for (var r = 0; r < rowRuns.length; r++) {
      var run = rowRuns[r];
      var mid = (run.start + run.end) / 2;
      if (mid > 0 && mid < h) {
        segments.push({ x1: 0, y1: mid, x2: w, y2: mid });
      }
    }

    var colProfile = lightProfile(data, w, h, 'x', whiteThreshold);
    var colRuns = findLightRuns(colProfile, lightFraction, minGapPx);
    colRuns = mergeCloseRuns(colRuns, mergeGap);
    for (var c = 0; c < colRuns.length; c++) {
      var crun = colRuns[c];
      var cmid = (crun.start + crun.end) / 2;
      if (cmid > 0 && cmid < w) {
        segments.push({ x1: cmid, y1: 0, x2: cmid, y2: h });
      }
    }

    return segments;
  }

  return { detectWhiteGaps: detectWhiteGaps };
});
