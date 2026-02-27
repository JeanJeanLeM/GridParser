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

  function pixelLuminanceOverWhite(data, i) {
    var a = data[i + 3] / 255;
    var r = data[i] * a + 255 * (1 - a);
    var g = data[i + 1] * a + 255 * (1 - a);
    var b = data[i + 2] * a + 255 * (1 - a);
    return luminance(r, g, b);
  }

  function buildLightMask(data, w, h, whiteThreshold) {
    var out = new Uint8Array(w * h);
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var i = (y * w + x) * 4;
        var L = pixelLuminanceOverWhite(data, i);
        out[y * w + x] = L >= whiteThreshold ? 1 : 0;
      }
    }
    return out;
  }

  function mergeCloseRuns(runs, maxGap) {
    if (runs.length <= 1) return runs;
    runs.sort(function (a, b) { return a.start - b.start; });
    var out = [runs[0]];
    for (var k = 1; k < runs.length; k++) {
      var prev = out[out.length - 1];
      var cur = runs[k];
      if (cur.start - prev.end <= maxGap) {
        out[out.length - 1] = { start: prev.start, end: Math.max(prev.end, cur.end) };
      } else {
        out.push(cur);
      }
    }
    return out;
  }

  function findRunsInRow(mask, w, y, minLen) {
    var runs = [];
    var x = 0;
    while (x < w) {
      if (mask[y * w + x]) {
        var start = x;
        while (x < w && mask[y * w + x]) x++;
        if (x - start >= minLen) runs.push({ start: start, end: x });
      } else {
        x++;
      }
    }
    return runs;
  }

  function findRunsInCol(mask, w, h, x, minLen) {
    var runs = [];
    var y = 0;
    while (y < h) {
      if (mask[y * w + x]) {
        var start = y;
        while (y < h && mask[y * w + x]) y++;
        if (y - start >= minLen) runs.push({ start: start, end: y });
      } else {
        y++;
      }
    }
    return runs;
  }

  function overlapLen(a1, a2, b1, b2) {
    return Math.max(0, Math.min(a2, b2) - Math.max(a1, b1));
  }

  function collectHorizontalTracks(mask, w, h, opts) {
    var minLen = Math.max(2, Math.floor(w * opts.minRunFraction));
    var tracks = [];
    for (var y = 0; y < h; y++) {
      var runs = mergeCloseRuns(findRunsInRow(mask, w, y, minLen), opts.mergeGapPx);
      var matched = new Array(runs.length);
      for (var r = 0; r < runs.length; r++) matched[r] = false;
      for (var t = 0; t < tracks.length; t++) {
        var tr = tracks[t];
        if (y - tr.lastY > opts.maxTrackGapPx) continue;
        var bestIdx = -1;
        var bestScore = 0;
        for (var rr = 0; rr < runs.length; rr++) {
          if (matched[rr]) continue;
          var run = runs[rr];
          var ov = overlapLen(tr.x1, tr.x2, run.start, run.end);
          if (ov <= 0) continue;
          var union = Math.max(tr.x2, run.end) - Math.min(tr.x1, run.start);
          var score = union > 0 ? ov / union : 0;
          if (score > bestScore) {
            bestScore = score;
            bestIdx = rr;
          }
        }
        if (bestIdx >= 0 && bestScore >= opts.minOverlapRatio) {
          var mr = runs[bestIdx];
          matched[bestIdx] = true;
          tr.x1 = Math.min(tr.x1, mr.start);
          tr.x2 = Math.max(tr.x2, mr.end);
          tr.y2 = y + 1;
          tr.lastY = y;
        }
      }
      for (var nr = 0; nr < runs.length; nr++) {
        if (!matched[nr]) {
          tracks.push({ x1: runs[nr].start, x2: runs[nr].end, y1: y, y2: y + 1, lastY: y });
        }
      }
    }
    var out = [];
    for (var i = 0; i < tracks.length; i++) {
      var trk = tracks[i];
      var thickness = trk.y2 - trk.y1;
      var len = trk.x2 - trk.x1;
      if (thickness < opts.minTrackThicknessPx || thickness > opts.maxTrackThicknessPx) continue;
      if (len < minLen) continue;
      var midY = (trk.y1 + trk.y2) / 2;
      out.push({ x1: trk.x1, y1: midY, x2: trk.x2, y2: midY });
    }
    return out;
  }

  function collectVerticalTracks(mask, w, h, opts) {
    var minLen = Math.max(2, Math.floor(h * opts.minRunFraction));
    var tracks = [];
    for (var x = 0; x < w; x++) {
      var runs = mergeCloseRuns(findRunsInCol(mask, w, h, x, minLen), opts.mergeGapPx);
      var matched = new Array(runs.length);
      for (var r = 0; r < runs.length; r++) matched[r] = false;
      for (var t = 0; t < tracks.length; t++) {
        var tr = tracks[t];
        if (x - tr.lastX > opts.maxTrackGapPx) continue;
        var bestIdx = -1;
        var bestScore = 0;
        for (var rr = 0; rr < runs.length; rr++) {
          if (matched[rr]) continue;
          var run = runs[rr];
          var ov = overlapLen(tr.y1, tr.y2, run.start, run.end);
          if (ov <= 0) continue;
          var union = Math.max(tr.y2, run.end) - Math.min(tr.y1, run.start);
          var score = union > 0 ? ov / union : 0;
          if (score > bestScore) {
            bestScore = score;
            bestIdx = rr;
          }
        }
        if (bestIdx >= 0 && bestScore >= opts.minOverlapRatio) {
          var mr = runs[bestIdx];
          matched[bestIdx] = true;
          tr.y1 = Math.min(tr.y1, mr.start);
          tr.y2 = Math.max(tr.y2, mr.end);
          tr.x2 = x + 1;
          tr.lastX = x;
        }
      }
      for (var nr = 0; nr < runs.length; nr++) {
        if (!matched[nr]) {
          tracks.push({ x1: x, x2: x + 1, y1: runs[nr].start, y2: runs[nr].end, lastX: x });
        }
      }
    }
    var out = [];
    for (var i = 0; i < tracks.length; i++) {
      var trk = tracks[i];
      var thickness = trk.x2 - trk.x1;
      var len = trk.y2 - trk.y1;
      if (thickness < opts.minTrackThicknessPx || thickness > opts.maxTrackThicknessPx) continue;
      if (len < minLen) continue;
      var midX = (trk.x1 + trk.x2) / 2;
      out.push({ x1: midX, y1: trk.y1, x2: midX, y2: trk.y2 });
    }
    return out;
  }

  function mergeCollinearSegments(segments, orientation, axisEps, gapEps) {
    if (!segments.length) return segments;
    var keyed = {};
    for (var i = 0; i < segments.length; i++) {
      var s = segments[i];
      var axis = orientation === 'h' ? s.y1 : s.x1;
      var key = Math.round(axis / axisEps);
      if (!keyed[key]) keyed[key] = [];
      keyed[key].push(s);
    }
    var out = [];
    for (var k in keyed) {
      if (!Object.prototype.hasOwnProperty.call(keyed, k)) continue;
      var list = keyed[k];
      list.sort(function (a, b) {
        var a0 = orientation === 'h' ? Math.min(a.x1, a.x2) : Math.min(a.y1, a.y2);
        var b0 = orientation === 'h' ? Math.min(b.x1, b.x2) : Math.min(b.y1, b.y2);
        return a0 - b0;
      });
      var cur = list[0];
      for (var j = 1; j < list.length; j++) {
        var nxt = list[j];
        var cur0 = orientation === 'h' ? Math.min(cur.x1, cur.x2) : Math.min(cur.y1, cur.y2);
        var cur1 = orientation === 'h' ? Math.max(cur.x1, cur.x2) : Math.max(cur.y1, cur.y2);
        var nxt0 = orientation === 'h' ? Math.min(nxt.x1, nxt.x2) : Math.min(nxt.y1, nxt.y2);
        var nxt1 = orientation === 'h' ? Math.max(nxt.x1, nxt.x2) : Math.max(nxt.y1, nxt.y2);
        if (nxt0 <= cur1 + gapEps) {
          if (orientation === 'h') {
            cur.x1 = Math.min(cur0, nxt0);
            cur.x2 = Math.max(cur1, nxt1);
          } else {
            cur.y1 = Math.min(cur0, nxt0);
            cur.y2 = Math.max(cur1, nxt1);
          }
        } else {
          out.push(cur);
          cur = nxt;
        }
      }
      out.push(cur);
    }
    return out;
  }

  function removeNearDuplicates(segments, eps) {
    var out = [];
    for (var i = 0; i < segments.length; i++) {
      var s = segments[i];
      var dup = false;
      for (var j = 0; j < out.length; j++) {
        var t = out[j];
        if (
          Math.abs(s.x1 - t.x1) <= eps &&
          Math.abs(s.y1 - t.y1) <= eps &&
          Math.abs(s.x2 - t.x2) <= eps &&
          Math.abs(s.y2 - t.y2) <= eps
        ) {
          dup = true;
          break;
        }
      }
      if (!dup) out.push(s);
    }
    return out;
  }

  function buildNonWhiteMask(data, w, h, nonWhiteThreshold) {
    var out = new Uint8Array(w * h);
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var i = (y * w + x) * 4;
        var L = pixelLuminanceOverWhite(data, i);
        out[y * w + x] = L <= nonWhiteThreshold ? 1 : 0;
      }
    }
    return out;
  }

  function buildDarkMask(data, w, h, darkThreshold) {
    var out = new Uint8Array(w * h);
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var i = (y * w + x) * 4;
        var L = pixelLuminanceOverWhite(data, i);
        out[y * w + x] = L <= darkThreshold ? 1 : 0;
      }
    }
    return out;
  }

  function darknessProfile(data, w, h, axis, darkThreshold) {
    var out = [];
    if (axis === 'x') {
      for (var x = 0; x < w; x++) {
        var dark = 0;
        for (var y = 0; y < h; y++) {
          var i = (y * w + x) * 4;
          var L = pixelLuminanceOverWhite(data, i);
          if (L <= darkThreshold) dark++;
        }
        out.push(dark / h);
      }
    } else {
      for (var y = 0; y < h; y++) {
        var dark = 0;
        for (var x = 0; x < w; x++) {
          var i = (y * w + x) * 4;
          var L = pixelLuminanceOverWhite(data, i);
          if (L <= darkThreshold) dark++;
        }
        out.push(dark / w);
      }
    }
    return out;
  }

  function maxContiguousDark(data, w, h, axis, index, darkThreshold) {
    var maxRun = 0;
    var run = 0;
    if (axis === 'y') {
      var y = index;
      for (var x = 0; x < w; x++) {
        var i = (y * w + x) * 4;
        var L = pixelLuminanceOverWhite(data, i);
        if (L <= darkThreshold) {
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
        if (L <= darkThreshold) {
          run++;
          if (run > maxRun) maxRun = run;
        } else {
          run = 0;
        }
      }
    }
    return maxRun;
  }

  function detectDarkLines(image, options) {
    var opts = options || {};
    var darkThreshold = Math.min(255, Math.max(0, parseInt(opts.darkThreshold, 10) || 140));
    var minRunFraction = typeof opts.minRunFraction === 'number' ? opts.minRunFraction : 0.12;
    var minTrackThicknessPx = Math.max(1, parseInt(opts.minLinePx, 10) || 1);
    var maxTrackThicknessPx = typeof opts.maxLinePx === 'number' ? Math.max(minTrackThicknessPx, parseInt(opts.maxLinePx, 10) || 18) : 18;
    var mergeGapPx = Math.max(0, parseInt(opts.mergeGap, 10) || 2);
    var maxTrackGapPx = Math.max(1, parseInt(opts.maxTrackGapPx, 10) || 2);
    var minOverlapRatio = typeof opts.minOverlapRatio === 'number' ? opts.minOverlapRatio : 0.45;
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
    var mask = buildDarkMask(data, w, h, darkThreshold);
    var trackOpts = {
      minRunFraction: minRunFraction,
      minTrackThicknessPx: minTrackThicknessPx,
      maxTrackThicknessPx: Math.min(maxTrackThicknessPx, Math.round(Math.max(w, h) * 0.08)),
      mergeGapPx: mergeGapPx,
      maxTrackGapPx: maxTrackGapPx,
      minOverlapRatio: minOverlapRatio
    };
    var horizontals = collectHorizontalTracks(mask, w, h, trackOpts);
    var verticals = collectVerticalTracks(mask, w, h, trackOpts);
    horizontals = mergeCollinearSegments(horizontals, 'h', 2, 2);
    verticals = mergeCollinearSegments(verticals, 'v', 2, 2);
    var segments = horizontals.concat(verticals).map(function (s) {
      return {
        x1: Math.max(0, Math.min(w, s.x1)),
        y1: Math.max(0, Math.min(h, s.y1)),
        x2: Math.max(0, Math.min(w, s.x2)),
        y2: Math.max(0, Math.min(h, s.y2))
      };
    });
    segments = segments.filter(function (s) {
      var len = Math.hypot(s.x2 - s.x1, s.y2 - s.y1);
      return len >= Math.max(6, Math.min(w, h) * 0.04);
    });
    return removeNearDuplicates(segments, 1.5);
  }

  function detectAdjacentDarkSeparators(image, options) {
    var opts = options || {};
    var darkThreshold = Math.min(255, Math.max(0, parseInt(opts.darkThreshold, 10) || 100));
    var minSpanFraction = typeof opts.minSpanFraction === 'number' ? opts.minSpanFraction : 0.4;
    var darknessFraction = typeof opts.darknessFraction === 'number' ? opts.darknessFraction : 0.5;
    var maxThicknessPx = Math.max(1, parseInt(opts.maxThicknessPx, 10) || 10);
    var mergeGapPx = Math.max(0, parseInt(opts.mergeGapPx, 10) || 2);
    var minFlankLuminance = opts.minFlankLuminance != null ? Math.min(255, Math.max(0, parseInt(opts.minFlankLuminance, 10) || 0)) : null;
    var flankSamplePx = Math.max(0, parseInt(opts.flankSamplePx, 10) || 0);
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
    var colProfile = darknessProfile(data, w, h, 'x', darkThreshold);
    var rowProfile = darknessProfile(data, w, h, 'y', darkThreshold);
    function filterByContiguous(profile, size, minSpanFrac) {
      var minSpan = Math.floor(size * minSpanFrac);
      var out = [];
      for (var i = 0; i < profile.length; i++) {
        var axis = profile === rowProfile ? 'y' : 'x';
        var span = axis === 'y' ? maxContiguousDark(data, w, h, 'y', i, darkThreshold) : maxContiguousDark(data, w, h, 'x', i, darkThreshold);
        out.push(span >= minSpan && profile[i] >= darknessFraction ? profile[i] : 0);
      }
      return out;
    }
    var colFiltered = filterByContiguous(colProfile, h, minSpanFraction);
    var rowFiltered = filterByContiguous(rowProfile, w, minSpanFraction);
    function findBands(profile, maxThick) {
      var bands = [];
      var i = 0;
      while (i < profile.length) {
        if (profile[i] > 0) {
          var start = i;
          while (i < profile.length && profile[i] > 0) i++;
          var thickness = i - start;
          if (thickness <= maxThick) bands.push({ start: start, end: i, mid: start + thickness / 2 });
        } else {
          i++;
        }
      }
      return bands;
    }
    function mergeBands(bands, maxGap) {
      if (bands.length <= 1) return bands;
      bands.sort(function (a, b) { return a.start - b.start; });
      var out = [bands[0]];
      for (var k = 1; k < bands.length; k++) {
        var prev = out[out.length - 1];
        var cur = bands[k];
        if (cur.start - prev.end <= maxGap) {
          out[out.length - 1] = { start: prev.start, end: cur.end, mid: (prev.mid + cur.mid) / 2 };
        } else {
          out.push(cur);
        }
      }
      return out;
    }
    var rowBands = mergeBands(findBands(rowFiltered, maxThicknessPx), mergeGapPx);
    var colBands = mergeBands(findBands(colFiltered, maxThicknessPx), mergeGapPx);
    var segments = [];
    for (var r = 0; r < rowBands.length; r++) {
      var midY = rowBands[r].mid;
      segments.push({ x1: 0, y1: midY, x2: w, y2: midY });
    }
    for (var c = 0; c < colBands.length; c++) {
      var midX = colBands[c].mid;
      segments.push({ x1: midX, y1: 0, x2: midX, y2: h });
    }
    return segments;
  }

  function buildSeparatorMask(image, options) {
    var segs = detectAdjacentDarkSeparators(image, options);
    var w = image.naturalWidth || image.width;
    var h = image.naturalHeight || image.height;
    if (!w || !h) return new Uint8Array(0);
    var mask = new Uint8Array(w * h);
    var tol = 2;
    for (var i = 0; i < segs.length; i++) {
      var s = segs[i];
      if (Math.abs(s.y1 - s.y2) <= tol) {
        var y = Math.round((s.y1 + s.y2) / 2);
        y = Math.max(0, Math.min(h - 1, y));
        for (var x = 0; x < w; x++) mask[y * w + x] = 1;
      } else if (Math.abs(s.x1 - s.x2) <= tol) {
        var x = Math.round((s.x1 + s.x2) / 2);
        x = Math.max(0, Math.min(w - 1, x));
        for (var y = 0; y < h; y++) mask[y * w + x] = 1;
      }
    }
    return mask;
  }

  function detectForegroundRectsOnDarkBg(image, options) {
    var opts = options || {};
    var darkBgThreshold = Math.min(255, Math.max(0, parseInt(opts.darkBgThreshold, 10) || 80));
    var minAreaFraction = typeof opts.minAreaFraction === 'number' ? opts.minAreaFraction : 0.008;
    var minWFrac = typeof opts.minWFrac === 'number' ? opts.minWFrac : 0.05;
    var minHFrac = typeof opts.minHFrac === 'number' ? opts.minHFrac : 0.05;
    var pad = Math.max(0, parseInt(opts.padPx, 10) || 1);
    var mergeGap = Math.max(0, parseInt(opts.mergeGapPx, 10) || 2);
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
    var mask = new Uint8Array(w * h);
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var i = (y * w + x) * 4;
        var L = pixelLuminanceOverWhite(data, i);
        mask[y * w + x] = L > darkBgThreshold ? 1 : 0;
      }
    }
    var visited = new Uint8Array(w * h);
    var minArea = Math.max(20, Math.floor(w * h * minAreaFraction));
    var minW = Math.max(8, Math.floor(w * minWFrac));
    var minH = Math.max(8, Math.floor(h * minHFrac));
    var rects = [];
    function idx(x, y) { return y * w + x; }
    var queue = [];
    for (var yy = 0; yy < h; yy++) {
      for (var xx = 0; xx < w; xx++) {
        var start = idx(xx, yy);
        if (!mask[start] || visited[start]) continue;
        var qh = 0, qt = 0;
        queue[qt++] = start;
        visited[start] = 1;
        var minX = xx, minY = yy, maxX = xx, maxY = yy, area = 0;
        while (qh < qt) {
          var cur = queue[qh++];
          var cy = Math.floor(cur / w);
          var cx = cur - cy * w;
          area++;
          if (cx < minX) minX = cx;
          if (cy < minY) minY = cy;
          if (cx > maxX) maxX = cx;
          if (cy > maxY) maxY = cy;
          if (cx > 0) { var n = cur - 1; if (mask[n] && !visited[n]) { visited[n] = 1; queue[qt++] = n; } }
          if (cx + 1 < w) { n = cur + 1; if (mask[n] && !visited[n]) { visited[n] = 1; queue[qt++] = n; } }
          if (cy > 0) { n = cur - w; if (mask[n] && !visited[n]) { visited[n] = 1; queue[qt++] = n; } }
          if (cy + 1 < h) { n = cur + w; if (mask[n] && !visited[n]) { visited[n] = 1; queue[qt++] = n; } }
        }
        var bw = maxX - minX + 1;
        var bh = maxY - minY + 1;
        if (bw < minW || bh < minH || area < minArea) continue;
        rects.push({
          x: Math.max(0, minX - pad),
          y: Math.max(0, minY - pad),
          w: Math.min(w, maxX + 1 + pad) - Math.max(0, minX - pad),
          h: Math.min(h, maxY + 1 + pad) - Math.max(0, minY - pad)
        });
      }
    }
    rects = mergeRects(rects, mergeGap);
    rects = removeContainedRects(rects);
    rects.sort(function (a, b) { return a.y !== b.y ? a.y - b.y : a.x - b.x; });
    return rects;
  }

  function detectIsolatedShapesOnBlackBg(image, options) {
    var opts = options || {};
    var darkBgThreshold = Math.min(255, Math.max(0, parseInt(opts.darkBgThreshold, 10) || 80));
    var minAreaFraction = typeof opts.minAreaFraction === 'number' ? opts.minAreaFraction : 0.008;
    var minWFrac = typeof opts.minWFrac === 'number' ? opts.minWFrac : 0.05;
    var minHFrac = typeof opts.minHFrac === 'number' ? opts.minHFrac : 0.05;
    var pad = Math.max(0, parseInt(opts.padPx, 10) || 1);
    var mergeGap = Math.max(0, parseInt(opts.mergeGapPx, 10) || 2);
    var sepOpts = {
      darkThreshold: opts.darkThreshold != null ? parseInt(opts.darkThreshold, 10) : 90,
      minSpanFraction: typeof opts.minSpanFraction === 'number' ? opts.minSpanFraction : 0.45,
      darknessFraction: typeof opts.darknessFraction === 'number' ? opts.darknessFraction : 0.5,
      maxThicknessPx: parseInt(opts.maxThicknessPx, 10) || 12,
      mergeGapPx: parseInt(opts.mergeGapPx, 10) || 2
    };
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
    var separatorMask = buildSeparatorMask(image, sepOpts);
    var contentMask = new Uint8Array(w * h);
    for (var pi = 0; pi < w * h; pi++) {
      var oy = Math.floor(pi / w);
      var ox = pi - oy * w;
      var didx = (oy * w + ox) * 4;
      var L = pixelLuminanceOverWhite(data, didx);
      contentMask[pi] = (L > darkBgThreshold && !separatorMask[pi]) ? 1 : 0;
    }
    var visited = new Uint8Array(w * h);
    var minArea = Math.max(20, Math.floor(w * h * minAreaFraction));
    var minW = Math.max(8, Math.floor(w * minWFrac));
    var minH = Math.max(8, Math.floor(h * minHFrac));
    var rects = [];
    function idx(i, j) { return j * w + i; }
    var queue = [];
    for (var yy = 0; yy < h; yy++) {
      for (var xx = 0; xx < w; xx++) {
        var start = idx(xx, yy);
        if (!contentMask[start] || visited[start]) continue;
        var qh = 0, qt = 0;
        queue[qt++] = start;
        visited[start] = 1;
        var minX = xx, minY = yy, maxX = xx, maxY = yy, area = 0;
        while (qh < qt) {
          var cur = queue[qh++];
          var cy = Math.floor(cur / w);
          var cx = cur - cy * w;
          area++;
          if (cx < minX) minX = cx;
          if (cy < minY) minY = cy;
          if (cx > maxX) maxX = cx;
          if (cy > maxY) maxY = cy;
          if (cx > 0) { var n = cur - 1; if (contentMask[n] && !visited[n]) { visited[n] = 1; queue[qt++] = n; } }
          if (cx + 1 < w) { n = cur + 1; if (contentMask[n] && !visited[n]) { visited[n] = 1; queue[qt++] = n; } }
          if (cy > 0) { n = cur - w; if (contentMask[n] && !visited[n]) { visited[n] = 1; queue[qt++] = n; } }
          if (cy + 1 < h) { n = cur + w; if (contentMask[n] && !visited[n]) { visited[n] = 1; queue[qt++] = n; } }
        }
        var bw = maxX - minX + 1;
        var bh = maxY - minY + 1;
        if (bw < minW || bh < minH || area < minArea) continue;
        rects.push({
          x: Math.max(0, minX - pad),
          y: Math.max(0, minY - pad),
          w: Math.min(w, maxX + 1 + pad) - Math.max(0, minX - pad),
          h: Math.min(h, maxY + 1 + pad) - Math.max(0, minY - pad)
        });
      }
    }
    rects = mergeRects(rects, mergeGap);
    rects = removeContainedRects(rects);
    rects.sort(function (a, b) { return a.y !== b.y ? a.y - b.y : a.x - b.x; });
    return rects;
  }

  function mergeRects(rects, gapPx) {
    if (!rects.length) return rects;
    var changed = true;
    while (changed) {
      changed = false;
      for (var i = 0; i < rects.length && !changed; i++) {
        for (var j = i + 1; j < rects.length; j++) {
          var a = rects[i];
          var b = rects[j];
          var overlapX = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
          var overlapY = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
          var closeX = overlapX >= -gapPx;
          var closeY = overlapY >= -gapPx;
          if (closeX && closeY) {
            var nx = Math.min(a.x, b.x);
            var ny = Math.min(a.y, b.y);
            var nx2 = Math.max(a.x + a.w, b.x + b.w);
            var ny2 = Math.max(a.y + a.h, b.y + b.h);
            rects[i] = { x: nx, y: ny, w: nx2 - nx, h: ny2 - ny };
            rects.splice(j, 1);
            changed = true;
            break;
          }
        }
      }
    }
    return rects;
  }

  function removeContainedRects(rects) {
    var out = [];
    for (var i = 0; i < rects.length; i++) {
      var a = rects[i];
      var contained = false;
      for (var j = 0; j < rects.length; j++) {
        if (i === j) continue;
        var b = rects[j];
        if (
          a.x >= b.x &&
          a.y >= b.y &&
          a.x + a.w <= b.x + b.w &&
          a.y + a.h <= b.y + b.h &&
          (a.w * a.h) < (b.w * b.h)
        ) {
          contained = true;
          break;
        }
      }
      if (!contained) out.push(a);
    }
    return out;
  }

  function detectPanelRects(image, options) {
    var opts = options || {};
    var nonWhiteThreshold = Math.min(255, Math.max(0, parseInt(opts.nonWhiteThreshold, 10) || 245));
    var minAreaFraction = typeof opts.minAreaFraction === 'number' ? opts.minAreaFraction : 0.015;
    var minWFrac = typeof opts.minWFrac === 'number' ? opts.minWFrac : 0.09;
    var minHFrac = typeof opts.minHFrac === 'number' ? opts.minHFrac : 0.09;
    var minFillRatio = typeof opts.minFillRatio === 'number' ? opts.minFillRatio : 0.2;
    var pad = Math.max(0, parseInt(opts.padPx, 10) || 1);
    var mergeGap = Math.max(0, parseInt(opts.mergeGapPx, 10) || 2);

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
    var mask = buildNonWhiteMask(data, w, h, nonWhiteThreshold);
    var visited = new Uint8Array(w * h);

    var minArea = Math.max(20, Math.floor(w * h * minAreaFraction));
    var minW = Math.max(8, Math.floor(w * minWFrac));
    var minH = Math.max(8, Math.floor(h * minHFrac));
    var rects = [];

    function idx(x, y) { return y * w + x; }
    var queue = [];

    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var start = idx(x, y);
        if (!mask[start] || visited[start]) continue;
        var qh = 0;
        var qt = 0;
        queue[qt++] = start;
        visited[start] = 1;
        var minX = x;
        var minY = y;
        var maxX = x;
        var maxY = y;
        var area = 0;
        while (qh < qt) {
          var cur = queue[qh++];
          var cy = Math.floor(cur / w);
          var cx = cur - cy * w;
          area++;
          if (cx < minX) minX = cx;
          if (cy < minY) minY = cy;
          if (cx > maxX) maxX = cx;
          if (cy > maxY) maxY = cy;
          var n;
          if (cx > 0) {
            n = cur - 1;
            if (mask[n] && !visited[n]) { visited[n] = 1; queue[qt++] = n; }
          }
          if (cx + 1 < w) {
            n = cur + 1;
            if (mask[n] && !visited[n]) { visited[n] = 1; queue[qt++] = n; }
          }
          if (cy > 0) {
            n = cur - w;
            if (mask[n] && !visited[n]) { visited[n] = 1; queue[qt++] = n; }
          }
          if (cy + 1 < h) {
            n = cur + w;
            if (mask[n] && !visited[n]) { visited[n] = 1; queue[qt++] = n; }
          }
        }
        var bw = maxX - minX + 1;
        var bh = maxY - minY + 1;
        if (bw < minW || bh < minH || area < minArea) continue;
        var fill = area / (bw * bh);
        if (fill < minFillRatio) continue;
        var rx = Math.max(0, minX - pad);
        var ry = Math.max(0, minY - pad);
        var rx2 = Math.min(w, maxX + 1 + pad);
        var ry2 = Math.min(h, maxY + 1 + pad);
        rects.push({ x: rx, y: ry, w: rx2 - rx, h: ry2 - ry });
      }
    }

    rects = mergeRects(rects, mergeGap);
    rects = removeContainedRects(rects);
    rects.sort(function (a, b) { return a.y !== b.y ? a.y - b.y : a.x - b.x; });
    return rects;
  }

  function detectWhiteGaps(image, options) {
    var opts = options || {};
    var whiteThreshold = Math.min(255, Math.max(0, parseInt(opts.whiteThreshold, 10) || 220));
    var minRunFraction = typeof opts.minRunFraction === 'number' ? opts.minRunFraction : 0.12;
    var minTrackThicknessPx = Math.max(1, parseInt(opts.minGapPx, 10) || 2);
    var maxTrackThicknessPx = typeof opts.maxGapPx === 'number'
      ? Math.max(minTrackThicknessPx, parseInt(opts.maxGapPx, 10) || minTrackThicknessPx)
      : 40;
    var mergeGapPx = Math.max(0, parseInt(opts.mergeGap, 10) || 2);
    var maxTrackGapPx = Math.max(1, parseInt(opts.maxTrackGapPx, 10) || 2);
    var minOverlapRatio = typeof opts.minOverlapRatio === 'number' ? opts.minOverlapRatio : 0.45;

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
    var mask = buildLightMask(data, w, h, whiteThreshold);

    var trackOpts = {
      minRunFraction: minRunFraction,
      minTrackThicknessPx: minTrackThicknessPx,
      maxTrackThicknessPx: Math.max(2, Math.min(maxTrackThicknessPx, Math.round(Math.max(w, h) * 0.12))),
      mergeGapPx: mergeGapPx,
      maxTrackGapPx: maxTrackGapPx,
      minOverlapRatio: minOverlapRatio
    };

    var horizontals = collectHorizontalTracks(mask, w, h, trackOpts);
    var verticals = collectVerticalTracks(mask, w, h, trackOpts);
    horizontals = mergeCollinearSegments(horizontals, 'h', 2, 2);
    verticals = mergeCollinearSegments(verticals, 'v', 2, 2);

    var segments = horizontals.concat(verticals).map(function (s) {
      return {
        x1: Math.max(0, Math.min(w, s.x1)),
        y1: Math.max(0, Math.min(h, s.y1)),
        x2: Math.max(0, Math.min(w, s.x2)),
        y2: Math.max(0, Math.min(h, s.y2))
      };
    });

    segments = segments.filter(function (s) {
      var len = Math.hypot(s.x2 - s.x1, s.y2 - s.y1);
      return len >= Math.max(6, Math.min(w, h) * 0.06);
    });

    return removeNearDuplicates(segments, 1.5);
  }

  return {
    detectWhiteGaps: detectWhiteGaps,
    detectPanelRects: detectPanelRects,
    detectDarkLines: detectDarkLines,
    detectAdjacentDarkSeparators: detectAdjacentDarkSeparators,
    buildSeparatorMask: buildSeparatorMask,
    detectForegroundRectsOnDarkBg: detectForegroundRectsOnDarkBg,
    detectIsolatedShapesOnBlackBg: detectIsolatedShapesOnBlackBg
  };
});
