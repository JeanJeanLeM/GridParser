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
  function almostEqual(a, b, eps) {
    return Math.abs(a - b) <= eps;
  }

  function uniqSorted(values, eps) {
    values.sort(function (a, b) { return a - b; });
    var out = [];
    for (var i = 0; i < values.length; i++) {
      var v = values[i];
      if (!out.length || !almostEqual(v, out[out.length - 1], eps)) out.push(v);
    }
    return out;
  }

  function overlapLen(a1, a2, b1, b2) {
    return Math.max(0, Math.min(a2, b2) - Math.max(a1, b1));
  }

  function toSegments(segments, eps) {
    var hs = [];
    var vs = [];
    for (var i = 0; i < segments.length; i++) {
      var s = segments[i];
      var x1 = Math.min(s.x1, s.x2);
      var x2 = Math.max(s.x1, s.x2);
      var y1 = Math.min(s.y1, s.y2);
      var y2 = Math.max(s.y1, s.y2);
      if (almostEqual(y1, y2, eps)) {
        hs.push({ y: (s.y1 + s.y2) / 2, x1: x1, x2: x2 });
      } else if (almostEqual(x1, x2, eps)) {
        vs.push({ x: (s.x1 + s.x2) / 2, y1: y1, y2: y2 });
      }
    }
    return { hs: hs, vs: vs };
  }

  function buildAtomicGrid(w, h, hs, vs, eps) {
    var xs = [0, w];
    var ys = [0, h];
    for (var i = 0; i < hs.length; i++) {
      xs.push(hs[i].x1, hs[i].x2);
      ys.push(hs[i].y);
    }
    for (var j = 0; j < vs.length; j++) {
      ys.push(vs[j].y1, vs[j].y2);
      xs.push(vs[j].x);
    }
    xs = uniqSorted(xs, eps);
    ys = uniqSorted(ys, eps);
    return { xs: xs, ys: ys };
  }

  function isBlockedByVertical(vs, xBoundary, y0, y1, eps) {
    for (var i = 0; i < vs.length; i++) {
      var s = vs[i];
      if (!almostEqual(s.x, xBoundary, eps)) continue;
      if (overlapLen(s.y1, s.y2, y0, y1) > eps) return true;
    }
    return false;
  }

  function isBlockedByHorizontal(hs, yBoundary, x0, x1, eps) {
    for (var i = 0; i < hs.length; i++) {
      var s = hs[i];
      if (!almostEqual(s.y, yBoundary, eps)) continue;
      if (overlapLen(s.x1, s.x2, x0, x1) > eps) return true;
    }
    return false;
  }

  function componentToRectangles(cells, comp) {
    var minI = Infinity;
    var maxI = -Infinity;
    var minJ = Infinity;
    var maxJ = -Infinity;
    var occ = {};
    for (var k = 0; k < comp.length; k++) {
      var id = comp[k];
      var c = cells[id];
      if (c.i < minI) minI = c.i;
      if (c.i > maxI) maxI = c.i;
      if (c.j < minJ) minJ = c.j;
      if (c.j > maxJ) maxJ = c.j;
      occ[c.i + ',' + c.j] = true;
    }
    var fullCount = (maxI - minI + 1) * (maxJ - minJ + 1);
    if (fullCount === comp.length) {
      return [{ minI: minI, maxI: maxI, minJ: minJ, maxJ: maxJ }];
    }
    var out = [];
    for (var i = 0; i < comp.length; i++) {
      var cc = cells[comp[i]];
      out.push({ minI: cc.i, maxI: cc.i, minJ: cc.j, maxJ: cc.j });
    }
    return out;
  }

  function segmentsToCells(w, h, segments) {
    if (!segments || segments.length === 0) {
      return [{ x: 0, y: 0, w: w, h: h }];
    }
    var eps = 1e-3;
    var normalized = toSegments(segments, eps);
    var hs = normalized.hs;
    var vs = normalized.vs;
    if (!hs.length && !vs.length) return [{ x: 0, y: 0, w: w, h: h }];

    var grid = buildAtomicGrid(w, h, hs, vs, eps);
    var xs = grid.xs;
    var ys = grid.ys;
    if (xs.length < 2 || ys.length < 2) return [{ x: 0, y: 0, w: w, h: h }];

    var cols = xs.length - 1;
    var rows = ys.length - 1;
    var atomCells = [];
    var idxByPos = {};
    var id = 0;
    for (var j = 0; j < rows; j++) {
      for (var i = 0; i < cols; i++) {
        var cw = xs[i + 1] - xs[i];
        var ch = ys[j + 1] - ys[j];
        if (cw <= eps || ch <= eps) continue;
        atomCells.push({ id: id, i: i, j: j });
        idxByPos[i + ',' + j] = id;
        id++;
      }
    }

    var visited = {};
    var outRects = [];
    for (var ci = 0; ci < atomCells.length; ci++) {
      var start = atomCells[ci];
      if (visited[start.id]) continue;
      var queue = [start];
      visited[start.id] = true;
      var comp = [];
      while (queue.length) {
        var cur = queue.shift();
        comp.push(cur.id);
        var i0 = cur.i;
        var j0 = cur.j;
        var rightId = idxByPos[(i0 + 1) + ',' + j0];
        if (rightId != null && !visited[rightId]) {
          var blockedR = isBlockedByVertical(vs, xs[i0 + 1], ys[j0], ys[j0 + 1], eps);
          if (!blockedR) {
            visited[rightId] = true;
            queue.push(atomCells[rightId]);
          }
        }
        var leftId = idxByPos[(i0 - 1) + ',' + j0];
        if (leftId != null && !visited[leftId]) {
          var blockedL = isBlockedByVertical(vs, xs[i0], ys[j0], ys[j0 + 1], eps);
          if (!blockedL) {
            visited[leftId] = true;
            queue.push(atomCells[leftId]);
          }
        }
        var downId = idxByPos[i0 + ',' + (j0 + 1)];
        if (downId != null && !visited[downId]) {
          var blockedD = isBlockedByHorizontal(hs, ys[j0 + 1], xs[i0], xs[i0 + 1], eps);
          if (!blockedD) {
            visited[downId] = true;
            queue.push(atomCells[downId]);
          }
        }
        var upId = idxByPos[i0 + ',' + (j0 - 1)];
        if (upId != null && !visited[upId]) {
          var blockedU = isBlockedByHorizontal(hs, ys[j0], xs[i0], xs[i0 + 1], eps);
          if (!blockedU) {
            visited[upId] = true;
            queue.push(atomCells[upId]);
          }
        }
      }

      var ranges = componentToRectangles(atomCells, comp);
      for (var r = 0; r < ranges.length; r++) {
        var rr = ranges[r];
        outRects.push({
          x: xs[rr.minI],
          y: ys[rr.minJ],
          w: xs[rr.maxI + 1] - xs[rr.minI],
          h: ys[rr.maxJ + 1] - ys[rr.minJ]
        });
      }
    }
    outRects = outRects.filter(function (c) { return c.w > eps && c.h > eps; });
    outRects.sort(function (a, b) { return a.y !== b.y ? a.y - b.y : a.x - b.x; });
    return outRects;
  }
  return { segmentsToCells: segmentsToCells };
});
