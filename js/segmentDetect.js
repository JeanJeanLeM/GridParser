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

  function buildLightMask(data, w, h, whiteThreshold) {
    var out = new Uint8Array(w * h);
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var i = (y * w + x) * 4;
        var L = luminance(data[i], data[i + 1], data[i + 2]);
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

  return { detectWhiteGaps: detectWhiteGaps };
});
