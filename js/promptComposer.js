/**
 * Canonical prompt composer for grid image generation.
 * Single source of truth: accepts layout + options + cells, returns optimized prompt text.
 * Used by Prompt Builder, Gallery (generated prompts), and Quick Idea flow.
 */
(function (root) {
  'use strict';

  function getStructuredLayoutInstruction(layoutCompact) {
    var map = {
      '2x2-B': 'Important geometry (STRICT): this is NOT a classic 2x2. Build a 2-column by 3-row base grid. Draw full-width horizontal lines at 1/3 and 2/3 of the height. Draw the vertical center line only inside the middle row (between 1/3 and 2/3 height), not in top or bottom rows. Final merged cells must be exactly: cell 1 = top full-width, cell 2 = middle-left, cell 3 = middle-right, cell 4 = bottom full-width.',
      '3x3-A': 'Important geometry: keep a 3x3 grid, with the center cell (row 2, col 2) as TXT and all other cells as IMG.',
      '3x3-B': 'Important geometry: keep a 3x3 grid, with the full middle row (cells 4,5,6) as TXT and top/bottom rows as IMG.',
      '3x3-D': 'Important geometry: keep a 3x3 grid, with diagonal TXT cells (1,5,9) and all others as IMG.',
      '4x4-A': 'Important geometry: keep a 4x4 grid, with the central 2x2 block (cells 6,7,10,11) as TXT and all others as IMG.',
      '4x4-B': 'Important geometry: keep a 4x4 grid, with the two middle columns as TXT and outer columns as IMG.',
      '4x4-C': 'Important geometry: keep a 4x4 grid, with border cells as BRD and interior cells as IMG.',
      '1L4S': 'Important geometry: this is NOT a classic grid. Use a 4-column by 2-row base grid: cell 1 is a large horizontal cell spanning all 4 columns on row 1; cells 2,3,4,5 are four normal cells on row 2 (one per column).',
      '3N': 'Important geometry: this layout has 3 cells in a single horizontal row (1x3), not 2x2.'
    };
    return map[layoutCompact] || '';
  }

  /**
   * Build a single prompt string from config. Optimized for image grid creation:
   * single grid lines, no double lines, no shadow, concise but complete.
   * @param {Object} config
   * @param {string} config.layoutCompact - e.g. "4x4", "3x3-A"
   * @param {number} config.cellCount - total number of cells
   * @param {string} [config.theme] - category e.g. "fruits"
   * @param {string} [config.style] - e.g. "minimalist vector"
   * @param {string} [config.background] - e.g. "pure white"
   * @param {string} [config.palette] - e.g. "flat and vivid"
   * @param {string} [config.outlines] - "bold black" | "fine" | "none"
   * @param {string} [config.labels] - "NO" | "English" | "French" | "other"
   * @param {string} [config.anthropomorphism] - "Off" | "On"
   * @param {string} [config.mood] - optional
   * @param {string|number} [config.maxColors] - optional
   * @param {Array<{name: string, description?: string, cellType?: string}>} [config.cells] - cell names/descriptions/types in order
   * @returns {string}
   */
  function buildPrompt(config) {
    var layoutCompact = (config.layoutCompact || '4x4').replace(/\s/g, '');
    var cellCount = config.cellCount != null ? Math.max(1, config.cellCount) : 16;
    var theme = (config.theme || '').trim() || 'fruits';
    var style = (config.style || '').trim() || 'minimalist vector';
    var background = (config.background || '').trim() || 'pure white';
    var palette = (config.palette || '').trim() || 'flat and vivid';
    var outlines = (config.outlines || '').trim() || 'bold black';
    var labels = (config.labels || '').trim() || 'NO';
    var anthropomorphism = (config.anthropomorphism || '').trim() || 'Off';
    var mood = (config.mood || '').trim();
    var maxColors = config.maxColors != null && config.maxColors !== '' && config.maxColors !== '—'
      ? String(config.maxColors).trim()
      : '';
    var cells = Array.isArray(config.cells) ? config.cells : [];

    var gridDesc = layoutCompact.indexOf('x') !== -1
      ? layoutCompact.replace(/x/gi, '×')
      : layoutCompact;
    var parts = [];

    parts.push('Create an image in a perfectly aligned ' + gridDesc + ' grid on a ' + background + ' background. Use pure black (#000000), fully continuous, straight grid lines between adjacent cells and along the outer border. One shared line per edge only—no double lines, no broken lines, no decorative borders. The final image must be fully opaque (no transparency / no alpha channel). Do not draw an outline or frame around each illustration.');
    parts.push('');

    var styleLine = 'Uniform style for all ' + cellCount + ' illustrations: ' + style + ', clean and precise lines, ' + palette + ' colors' + (outlines !== 'none' ? ', ' + outlines + ' outlines on the illustrated elements' : '; no outlines or frames around each illustration') + '. Flat, no shadows, no shading, no gradients, no 3D, no pixelation, no complex texture.';
    if (mood) styleLine += ' Mood: ' + mood + '.';
    if (maxColors) styleLine += ' Maximum ' + maxColors + ' colors per cell.';
    parts.push(styleLine);
    parts.push('');

    if (anthropomorphism === 'Off') {
      parts.push('No anthropomorphism: no eyes, no face, no mouth, no arms, no human features on the illustrated elements.');
      parts.push('');
    }

    var structuredLayoutInstruction = getStructuredLayoutInstruction(layoutCompact);
    if (structuredLayoutInstruction) {
      parts.push(structuredLayoutInstruction);
      parts.push('Critical rule: do not simplify or reinterpret this as a classic NxN equal-cell grid.');
      parts.push('');
    }

    if (labels !== 'NO') {
      parts.push('Below each illustration, write the name in ' + labels + ', simple black sans-serif font, uniform and readable size.');
    } else {
      parts.push('No text, numbers, or letters in the grid.');
    }
    parts.push('');
    parts.push('Exact layout of the ' + cellCount + ' elements (name and description per cell, order left-to-right top-to-bottom):');

    for (var i = 0; i < cellCount; i++) {
      var c = cells[i];
      var nameVal = (c && (c.name != null ? String(c.name) : c.title || '')) || '';
      var descVal = (c && (c.description != null ? String(c.description) : '')) || '';
      var cellType = (c && c.cellType) ? String(c.cellType).toLowerCase() : 'image';
      nameVal = nameVal.trim();
      descVal = descVal.trim();
      var roleTag = cellType === 'text' ? 'TXT cell' : (cellType === 'branding' ? 'BRD cell' : 'IMG cell');
      var line = (i + 1) + '. [' + nameVal + '] (' + roleTag + ')';
      if (descVal) line += ' — ' + descVal;
      if (!descVal && cellType === 'text') {
        line += ' — text-only cell (short label/wording area).';
      }
      parts.push(line);
    }

    parts.push('');
    parts.push('Grid layout: ' + gridDesc + '. Single grid lines only (no double lines), high resolution, sharp details. No element may extend outside its cell.');

    return parts.join('\n');
  }

  root.promptComposer = {
    buildPrompt: buildPrompt
  };
})(typeof self !== 'undefined' ? self : this);
