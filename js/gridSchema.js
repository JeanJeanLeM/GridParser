/**
 * Unified grid schema: single representation for uniform, structured, and freeform grids.
 * Converts to/from xBounds/yBounds and segments/cells; provides compact LLM-parseable strings.
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.gridSchema = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /** @typedef {'uniform'|'structured'|'freeform'} LayoutMode */
  /**
   * @typedef {Object} GridCellUniform
   * @property {number} row
   * @property {number} col
   * @property {number} [rowSpan]
   * @property {number} [colSpan]
   * @property {string} [type]
   * @property {'image'|'text'|'branding'} [cellType] - content type: image, text (TXT), or branding (B)
   */
  /**
   * @typedef {{ x: number, y: number, w: number, h: number }} GridCellFreeform
   */
  /**
   * @typedef {Object} GridSpec
   * @property {LayoutMode} mode
   * @property {number} [rows]
   * @property {number} [cols]
   * @property {Array<GridCellUniform|GridCellFreeform>} cells
   */

  var PRESETS = {
    '2x2': { mode: 'uniform', rows: 2, cols: 2, cells: [], presetId: '2x2' },
    '2x2-B': {
      mode: 'structured',
      presetId: '2x2-B',
      rows: 3,
      cols: 2,
      cells: [
        { row: 0, col: 0, rowSpan: 1, colSpan: 2, cellType: 'image' },
        { row: 1, col: 0, cellType: 'image' },
        { row: 1, col: 1, cellType: 'image' },
        { row: 2, col: 0, rowSpan: 1, colSpan: 2, cellType: 'image' }
      ]
    },
    '3x3': { mode: 'uniform', rows: 3, cols: 3, cells: [], presetId: '3x3' },
    '3x3-A': {
      mode: 'structured',
      presetId: '3x3-A',
      rows: 3,
      cols: 3,
      cells: [
        { row: 0, col: 0, cellType: 'image' }, { row: 0, col: 1, cellType: 'image' }, { row: 0, col: 2, cellType: 'image' },
        { row: 1, col: 0, cellType: 'image' }, { row: 1, col: 1, cellType: 'text' }, { row: 1, col: 2, cellType: 'image' },
        { row: 2, col: 0, cellType: 'image' }, { row: 2, col: 1, cellType: 'image' }, { row: 2, col: 2, cellType: 'image' }
      ]
    },
    '3x3-B': {
      mode: 'structured',
      presetId: '3x3-B',
      rows: 3,
      cols: 3,
      cells: [
        { row: 0, col: 0, cellType: 'image' }, { row: 0, col: 1, cellType: 'image' }, { row: 0, col: 2, cellType: 'image' },
        { row: 1, col: 0, cellType: 'text' }, { row: 1, col: 1, cellType: 'text' }, { row: 1, col: 2, cellType: 'text' },
        { row: 2, col: 0, cellType: 'image' }, { row: 2, col: 1, cellType: 'image' }, { row: 2, col: 2, cellType: 'image' }
      ]
    },
    '3x3-C': {
      mode: 'uniform',
      presetId: '3x3-C',
      rows: 3,
      cols: 3,
      cells: [
        { row: 0, col: 0, cellType: 'image' }, { row: 0, col: 1, cellType: 'image' }, { row: 0, col: 2, cellType: 'image' },
        { row: 1, col: 0, cellType: 'image' }, { row: 1, col: 1, cellType: 'image' }, { row: 1, col: 2, cellType: 'image' },
        { row: 2, col: 0, cellType: 'image' }, { row: 2, col: 1, cellType: 'image' }, { row: 2, col: 2, cellType: 'image' }
      ]
    },
    '3x3-D': {
      mode: 'structured',
      presetId: '3x3-D',
      rows: 3,
      cols: 3,
      cells: [
        { row: 0, col: 0, cellType: 'text' }, { row: 0, col: 1, cellType: 'image' }, { row: 0, col: 2, cellType: 'image' },
        { row: 1, col: 0, cellType: 'image' }, { row: 1, col: 1, cellType: 'text' }, { row: 1, col: 2, cellType: 'image' },
        { row: 2, col: 0, cellType: 'image' }, { row: 2, col: 1, cellType: 'image' }, { row: 2, col: 2, cellType: 'text' }
      ]
    },
    '4x4': { mode: 'uniform', rows: 4, cols: 4, cells: [], presetId: '4x4' },
    '4x4-A': {
      mode: 'structured',
      presetId: '4x4-A',
      rows: 4,
      cols: 4,
      cells: (function () {
        var c = [];
        for (var r = 0; r < 4; r++) {
          for (var col = 0; col < 4; col++) {
            var isCenter = (r === 1 || r === 2) && (col === 1 || col === 2);
            c.push({ row: r, col: col, cellType: isCenter ? 'text' : 'image' });
          }
        }
        return c;
      })()
    },
    '4x4-B': {
      mode: 'structured',
      presetId: '4x4-B',
      rows: 4,
      cols: 4,
      cells: (function () {
        var c = [];
        for (var r = 0; r < 4; r++) {
          for (var col = 0; col < 4; col++) {
            var isBand = col === 1 || col === 2;
            c.push({ row: r, col: col, cellType: isBand ? 'text' : 'image' });
          }
        }
        return c;
      })()
    },
    '4x4-C': {
      mode: 'structured',
      presetId: '4x4-C',
      rows: 4,
      cols: 4,
      cells: (function () {
        var c = [];
        for (var r = 0; r < 4; r++) {
          for (var col = 0; col < 4; col++) {
            var isBorder = r === 0 || r === 3 || col === 0 || col === 3;
            c.push({ row: r, col: col, cellType: isBorder ? 'branding' : 'image' });
          }
        }
        return c;
      })()
    },
    '1L4S': {
      mode: 'structured',
      presetId: '1L4S',
      rows: 2,
      cols: 4,
      cells: [
        { row: 0, col: 0, rowSpan: 1, colSpan: 4 },
        { row: 1, col: 0 },
        { row: 1, col: 1 },
        { row: 1, col: 2 },
        { row: 1, col: 3 }
      ]
    },
    '3N': {
      mode: 'structured',
      presetId: '3N',
      rows: 1,
      cols: 3,
      cells: [
        { row: 0, col: 0 },
        { row: 0, col: 1 },
        { row: 0, col: 2 }
      ]
    }
  };

  function defaultCellsForUniform(rows, cols) {
    var cells = [];
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        cells.push({ row: r, col: c, rowSpan: 1, colSpan: 1 });
      }
    }
    return cells;
  }

  /**
   * Get a full spec with cells filled (for uniform, expand implied cells).
   * @param {GridSpec} spec
   * @returns {GridSpec}
   */
  function normalizeSpec(spec) {
    if (!spec || !spec.mode) return spec;
    if (spec.mode === 'uniform' && spec.rows != null && spec.cols != null) {
      var cells = spec.cells && spec.cells.length ? spec.cells : defaultCellsForUniform(spec.rows, spec.cols);
      var out = { mode: 'uniform', rows: spec.rows, cols: spec.cols, cells: cells };
      if (spec.presetId) out.presetId = spec.presetId;
      return out;
    }
    if (spec.mode === 'structured' && spec.cells && spec.cells.length) {
      var rows = spec.rows;
      var cols = spec.cols;
      for (var i = 0; i < spec.cells.length; i++) {
        var cell = spec.cells[i];
        var r = (cell.row || 0) + (cell.rowSpan || 1);
        var c = (cell.col || 0) + (cell.colSpan || 1);
        if (r > rows) rows = r;
        if (c > cols) cols = c;
      }
      var outStr = { mode: 'structured', rows: spec.rows, cols: spec.cols, cells: spec.cells };
      if (spec.presetId) outStr.presetId = spec.presetId;
      return outStr;
    }
    return spec;
  }

  /**
   * Convert spec to xBounds, yBounds for use with gridSplit.splitGridCustom.
   * Only for uniform and structured (grid-based) specs. Uses image dimensions to compute pixel bounds.
   * @param {GridSpec} spec - normalized spec
   * @param {number} w - image width
   * @param {number} h - image height
   * @returns {{ xBounds: number[], yBounds: number[] }|null}
   */
  function specToBounds(spec, w, h) {
    spec = normalizeSpec(spec);
    if (!spec || !w || !h) return null;
    if (spec.mode === 'freeform') return null;

    if (spec.mode === 'uniform') {
      var rows = spec.rows || 1;
      var cols = spec.cols || 1;
      var xBounds = [];
      var yBounds = [];
      for (var c = 0; c <= cols; c++) xBounds.push((c * w) / cols);
      for (var r = 0; r <= rows; r++) yBounds.push((r * h) / rows);
      return { xBounds: xBounds, yBounds: yBounds };
    }

    if (spec.mode === 'structured') {
      var strRows = spec.rows || 1;
      var strCols = spec.cols || 1;
      var xB = [];
      var yB = [];
      for (var c = 0; c <= strCols; c++) xB.push((c * w) / strCols);
      for (var r = 0; r <= strRows; r++) yB.push((r * h) / strRows);
      return { xBounds: xB, yBounds: yB };
    }

    return null;
  }

  /**
   * Convert xBounds, yBounds (uniform grid) to a uniform GridSpec.
   * @param {number[]} xBounds
   * @param {number[]} yBounds
   * @returns {GridSpec}
   */
  function boundsToSpec(xBounds, yBounds) {
    if (!xBounds || !yBounds || xBounds.length < 2 || yBounds.length < 2) {
      return { mode: 'uniform', rows: 2, cols: 2, cells: defaultCellsForUniform(2, 2) };
    }
    var cols = xBounds.length - 1;
    var rows = yBounds.length - 1;
    return {
      mode: 'uniform',
      rows: rows,
      cols: cols,
      cells: defaultCellsForUniform(rows, cols)
    };
  }

  /**
   * Convert segments + image size to a freeform GridSpec (cells as {x,y,w,h} in pixels).
   * Uses segmentArrangement.segmentsToCells if available.
   * @param {Array<{x1,y1,x2,y2}>} segments
   * @param {number} w
   * @param {number} h
   * @returns {GridSpec}
   */
  function segmentsToSpec(segments, w, h) {
    var cells = [];
    if (typeof segmentArrangement !== 'undefined' && segmentArrangement && segmentArrangement.segmentsToCells) {
      cells = segmentArrangement.segmentsToCells(w, h, segments || []);
    } else if (!segments || segments.length === 0) {
      cells = [{ x: 0, y: 0, w: w, h: h }];
    }
    return { mode: 'freeform', cells: cells };
  }

  /**
   * Compact string for LLM/prompt/API (e.g. "2x2", "4x4", "1L4S").
   * @param {GridSpec} spec
   * @returns {string}
   */
  function specToCompactString(spec) {
    spec = normalizeSpec(spec);
    if (!spec) return '4x4';
    if (spec.presetId) return spec.presetId;
    if (spec.mode === 'uniform' && spec.rows != null && spec.cols != null) {
      return spec.rows + 'x' + spec.cols;
    }
    if (spec.mode === 'structured') {
      if (spec.rows === 2 && spec.cols === 4 && spec.cells && spec.cells.length === 5) return '1L4S';
      if (spec.rows === 1 && spec.cols === 3) return '3N';
      return 'structured_' + (spec.cells ? spec.cells.length : 0);
    }
    if (spec.mode === 'freeform') {
      return 'freeform_' + (spec.cells ? spec.cells.length : 0);
    }
    return '4x4';
  }

  /**
   * Parse compact string or preset id into a GridSpec.
   * @param {string} s - e.g. "2x2", "3x3", "4x4", "1L4S", "3N"
   * @returns {GridSpec}
   */
  function parseCompactGrid(s) {
    if (!s || typeof s !== 'string') return PRESETS['4x4'];
    var t = s.trim();
    if (PRESETS[t]) return normalizeSpec(JSON.parse(JSON.stringify(PRESETS[t])));
    var match = t.match(/^(\d+)x(\d+)$/i);
    if (match) {
      var rows = Math.max(1, Math.min(10, parseInt(match[1], 10)));
      var cols = Math.max(1, Math.min(10, parseInt(match[2], 10)));
      return normalizeSpec({ mode: 'uniform', rows: rows, cols: cols, cells: defaultCellsForUniform(rows, cols) });
    }
    return PRESETS['4x4'];
  }

  /**
   * Cell count for a normalized spec (for prompts/API).
   * @param {GridSpec} spec
   * @returns {number}
   */
  function getCellCount(spec) {
    spec = normalizeSpec(spec);
    if (!spec) return 16;
    if (spec.cells && spec.cells.length) return spec.cells.length;
    if (spec.mode === 'uniform' && spec.rows != null && spec.cols != null) {
      return spec.rows * spec.cols;
    }
    return 16;
  }

  return {
    normalizeSpec: normalizeSpec,
    specToBounds: specToBounds,
    boundsToSpec: boundsToSpec,
    segmentsToSpec: segmentsToSpec,
    specToCompactString: specToCompactString,
    parseCompactGrid: parseCompactGrid,
    getCellCount: getCellCount,
    PRESETS: PRESETS
  };
});
