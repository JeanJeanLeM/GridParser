/**
 * Compute rectangular cells from axis-aligned segments and image bounds.
 * (Placeholder until full implementation in step 2.)
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.segmentArrangement = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  function segmentsToCells(w, h, segments) {
    if (!segments || segments.length === 0) {
      return [{ x: 0, y: 0, w: w, h: h }];
    }
    var xs = [0, w];
    var ys = [0, h];
    for (var i = 0; i < segments.length; i++) {
      var s = segments[i];
      var x1 = Math.min(s.x1, s.x2);
      var x2 = Math.max(s.x1, s.x2);
      var y1 = Math.min(s.y1, s.y2);
      var y2 = Math.max(s.y1, s.y2);
      if (y1 === y2) {
        if (xs.indexOf(x1) === -1) xs.push(x1);
        if (xs.indexOf(x2) === -1) xs.push(x2);
      } else {
        if (ys.indexOf(y1) === -1) ys.push(y1);
        if (ys.indexOf(y2) === -1) ys.push(y2);
      }
    }
    xs.sort(function (a, b) { return a - b; });
    ys.sort(function (a, b) { return a - b; });
    var cells = [];
    for (var yi = 0; yi < ys.length - 1; yi++) {
      for (var xi = 0; xi < xs.length - 1; xi++) {
        var xa = xs[xi];
        var xb = xs[xi + 1];
        var yc = ys[yi];
        var yd = ys[yi + 1];
        var cut = false;
        for (var j = 0; j < segments.length; j++) {
          var seg = segments[j];
          var segY1 = Math.min(seg.y1, seg.y2);
          var segY2 = Math.max(seg.y1, seg.y2);
          var segX1 = Math.min(seg.x1, seg.x2);
          var segX2 = Math.max(seg.x1, seg.x2);
          if (segY1 === segY2) {
            if (segY1 > yc && segY1 < yd && segX1 < xb && segX2 > xa) cut = true;
          } else {
            if (segX1 > xa && segX1 < xb && segY1 < yd && segY2 > yc) cut = true;
          }
          if (cut) break;
        }
        if (!cut) cells.push({ x: xa, y: yc, w: xb - xa, h: yd - yc });
      }
    }
    cells.sort(function (a, b) { return a.y !== b.y ? a.y - b.y : a.x - b.x; });
    return cells;
  }
  return { segmentsToCells: segmentsToCells };
});
