/**
 * Logo style gallery data + G2I-oriented prompt builders.
 */
(function (root) {
  'use strict';

  var DEFAULT_SUBJECT = 'apple';
  var DEFAULT_GRID = '4x4';

  var STYLE_CATALOG = [
    { id: 'clay-3d', name: '3D Clay', tagline: 'Soft clay render', thumb: '/assets/styles/clay-3d.webp' },
    { id: 'flat-vector', name: 'Flat Vector', tagline: 'Clean flat icon', thumb: '/assets/styles/flat-vector.webp' },
    { id: 'manga', name: 'Manga', tagline: 'Ink & screentone', thumb: '/assets/styles/manga.webp' },
    { id: 'chrome', name: 'Chrome Metal', tagline: 'Polished chrome', thumb: '/assets/styles/chrome.webp' },
    { id: 'pixel', name: 'Pixel Art', tagline: 'Retro pixels', thumb: '/assets/styles/pixel.webp' },
    { id: 'watercolor', name: 'Watercolor', tagline: 'Soft washes', thumb: '/assets/styles/watercolor.webp' },
    { id: 'neon', name: 'Neon Glow', tagline: 'Electric glow', thumb: '/assets/styles/neon.webp' },
    { id: 'papercut', name: 'Paper Cut', tagline: 'Layered paper', thumb: '/assets/styles/papercut.webp' },
    { id: 'embroidered', name: 'Embroidered', tagline: 'Thread stitches', thumb: '/assets/styles/embroidered.webp' },
    { id: 'stained-glass', name: 'Stained Glass', tagline: 'Lead & glass', thumb: '/assets/styles/stained-glass.webp' },
    { id: 'isometric', name: 'Isometric', tagline: '30deg isometric', thumb: '/assets/styles/isometric.webp' },
    { id: 'lowpoly', name: 'Low Poly', tagline: 'Faceted mesh', thumb: '/assets/styles/lowpoly.webp' },
    { id: 'chalk', name: 'Chalk', tagline: 'Blackboard chalk', thumb: '/assets/styles/chalk.webp' },
    { id: 'graffiti', name: 'Graffiti', tagline: 'Spray paint', thumb: '/assets/styles/graffiti.webp' },
    { id: 'porcelain', name: 'Porcelain', tagline: 'Ceramic glaze', thumb: '/assets/styles/porcelain.webp' },
    { id: 'hologram', name: 'Hologram', tagline: 'Iridescent HUD', thumb: '/assets/styles/hologram.webp' },
    { id: 'wood', name: 'Wood Carving', tagline: 'Carved wood', thumb: '/assets/styles/wood.webp' },
    { id: 'origami', name: 'Origami', tagline: 'Folded paper', thumb: '/assets/styles/origami.webp' },
    { id: 'popart', name: 'Pop Art', tagline: 'Bold pop print', thumb: '/assets/styles/popart.webp' },
    { id: 'blueprint', name: 'Blueprint', tagline: 'Technical plan', thumb: '/assets/styles/blueprint.webp' },
    { id: 'claymation', name: 'Claymation', tagline: 'Stop-motion clay', thumb: '/assets/styles/claymation.webp' },
    { id: 'steampunk', name: 'Steampunk', tagline: 'Brass & gears', thumb: '/assets/styles/steampunk.webp' },
    { id: 'glassmorph', name: 'Glassmorphism', tagline: 'Frosted glass', thumb: '/assets/styles/glassmorph.webp' },
    { id: 'kawaii', name: 'Kawaii', tagline: 'Cute pastel', thumb: '/assets/styles/kawaii.webp' },
    { id: 'sumi-e', name: 'Sumi-e', tagline: 'Ink wash brush', thumb: '/assets/styles/sumi-e.webp' },
    { id: 'bauhaus', name: 'Bauhaus', tagline: 'Geometric primary', thumb: '/assets/styles/bauhaus.webp' },
    { id: 'art-deco', name: 'Art Deco', tagline: 'Gold geometric', thumb: '/assets/styles/art-deco.webp' },
    { id: 'risograph', name: 'Risograph', tagline: 'Grainy print layers', thumb: '/assets/styles/risograph.webp' },
    { id: 'duotone', name: 'Duotone', tagline: 'Two-tone print', thumb: '/assets/styles/duotone.webp' },
    { id: 'enamel-pin', name: 'Enamel Pin', tagline: 'Hard enamel badge', thumb: '/assets/styles/enamel-pin.webp' },
    { id: 'sticker', name: 'Sticker', tagline: 'Die-cut sticker', thumb: '/assets/styles/sticker.webp' },
    { id: 'contour', name: 'Contour', tagline: 'Outline only', thumb: '/assets/styles/contour.webp' },
    { id: 'charcoal', name: 'Charcoal', tagline: 'Graphite sketch', thumb: '/assets/styles/charcoal.webp' },
    { id: 'monoline', name: 'Monoline', tagline: 'Single-weight line', thumb: '/assets/styles/monoline.webp' },
    { id: 'acrylic', name: 'Acrylic', tagline: 'Impasto brush', thumb: '/assets/styles/acrylic.webp' },
    { id: 'halftone', name: 'Halftone', tagline: 'Dot print', thumb: '/assets/styles/halftone.webp' }
  ];

  /** 16 fruits used for every per-style showcase grid (row-major). */
  var FRUIT_GRID_SUBJECTS = [
    'apple', 'banana', 'orange', 'strawberry',
    'grape', 'watermelon', 'pineapple', 'cherry',
    'lemon', 'peach', 'kiwi', 'mango',
    'pear', 'blueberry', 'coconut', 'avocado'
  ];

  var MULTI_STYLE_GRID_IMAGE = '/assets/styles/fruit-grid-4x4.webp';

  function escapeSubject(subject) {
    return String(subject || DEFAULT_SUBJECT).trim() || DEFAULT_SUBJECT;
  }

  function labelToken(name) {
    return String(name || 'Icon').replace(/\s+/g, '');
  }

  function styleFruitGridPath(style) {
    var id = style && style.id ? style.id : 'style';
    return '/assets/styles/fruit-grid-' + id + '.webp';
  }

  function fruitCellMapLines() {
    var lines = [];
    var i;
    for (i = 0; i < FRUIT_GRID_SUBJECTS.length; i++) {
      var row = Math.floor(i / 4) + 1;
      var col = (i % 4) + 1;
      var fruit = FRUIT_GRID_SUBJECTS[i];
      lines.push(
        '- Row ' + row + ' Col ' + col + ': fruit "' + fruit +
        '" + label "' + labelToken(fruit) + '" in ONE open cell (no line between icon and text).'
      );
    }
    return lines.join('\n');
  }

  /** Shared rules so Grid2icons Grid mode + OCR + label crop work reliably. */
  function g2iLayoutRules(grid) {
    return [
      'GRID2ICONS LAYOUT (must follow exactly):',
      '- One square image that is a perfect ' + grid + ' regular grid of CONTENT tiles only (equal cell sizes).',
      '- CRITICAL — ONE undivided cell per tile: icon + label share ONE continuous open rectangle. Do NOT draw any horizontal (or vertical) black/gray line inside a cell between the icon and the text. No inner frame, no subtitle bar border, no rule under the icon. A line under the icon = WRONG (it looks like two cells and breaks Grid mode).',
      '- Never put labels in separate cells, never add an extra label-only row/column, never put caption text between cells.',
      '- Inside each cell (top to bottom, same white fill): fruit/icon centered in the upper area, then the label text floating near the bottom — same background, no divider.',
      '- ONLY black separator lines allowed: the thin continuous pure-black grid lines BETWEEN cells (1-3 px), full span, no gaps, no dashes. Nothing else is a line.',
      '- Pure white margins outside the grid; no outer frame, watermark, title, or caption outside cells.',
      '- Cell fill: solid plain white behind icon and text; no scenic backdrop, no floor.',
      '- Label: short black sans-serif text only, OCR-friendly, high contrast, no effects, no box, no underline.',
      '- Designed so Grid mode detects exactly ' + grid + ' tiles (not 2× that because of fake inner label rows), then Auto-name reads the in-cell label and Remove-label crops the bottom text area.'
    ].join('\n');
  }

  /**
   * Prompt for ONE style: same subject repeated in a G2I-ready grid.
   */
  function buildPrompt(style, subject, options) {
    var s = escapeSubject(subject);
    var grid = (options && options.grid) || DEFAULT_GRID;
    var styleName = style && style.name ? style.name : 'icon';
    var label = labelToken(styleName);

    return [
      'Generate a single square image for Grid2icons (G2I).',
      'Content: a perfect ' + grid + ' grid of the SAME subject: "' + s + '".',
      'Art direction for EVERY tile: ' + styleName + ' (' + (style.tagline || styleName) + ').',
      'Each tile is ONE open cell: icon above + label text below on the SAME white fill — NO horizontal line between icon and label.',
      'In-cell label text on every tile (identical): "' + label + '".',
      g2iLayoutRules(grid),
      'Output: one high-resolution square image, consistent lighting, no collage chaos.'
    ].join('\n');
  }

  /**
   * Prompt for ONE style: the fixed 16-fruit set, all rendered in that style.
   */
  function buildStyleFruitGridPrompt(style, options) {
    var grid = (options && options.grid) || DEFAULT_GRID;
    var styleName = style && style.name ? style.name : 'icon';
    var tagline = style && style.tagline ? style.tagline : styleName;

    return [
      'Generate a single square image for Grid2icons (G2I): a perfect ' + grid + ' fruit icon grid.',
      'Art direction for EVERY cell: "' + styleName + '" (' + tagline + '). Same style on all 16 tiles — do not mix styles.',
      'Exactly 16 content cells. Each cell = icon + label on ONE continuous white area. FORBIDDEN: any horizontal black line under the icon / above the text (that splits the cell).',
      'Use this exact fruit map (row-major, left-to-right, top-to-bottom):',
      fruitCellMapLines(),
      'Every cell on solid plain white. Labels are the fruit names only (Apple, Banana, …), text floating at the bottom of the cell with no bar or divider.',
      g2iLayoutRules(grid),
      'Output: one high-resolution square image ready for Grid2icons Parser (Grid mode, 4 rows x 4 cols).'
    ].join('\n');
  }

  /**
   * Prompt for the mixed showcase 4x4: different fruits, each in a different style.
   * Uses the first 16 styles from STYLE_CATALOG.
   */
  function buildMultiStyleFruitGridPrompt(options) {
    var grid = (options && options.grid) || DEFAULT_GRID;
    var styles = STYLE_CATALOG.slice(0, 16);
    var lines = [];
    var i;
    for (i = 0; i < 16; i++) {
      var row = Math.floor(i / 4) + 1;
      var col = (i % 4) + 1;
      var fruit = FRUIT_GRID_SUBJECTS[i];
      var st = styles[i];
      lines.push(
        '- Row ' + row + ' Col ' + col + ': ONE open cell — fruit "' + fruit + '" in style "' + st.name +
        '" (' + st.tagline + ') with label "' + labelToken(fruit) + '" at bottom; NO horizontal divider inside the cell.'
      );
    }

    return [
      'Generate a single square image for Grid2icons (G2I): a perfect ' + grid + ' icon grid of FRUITS.',
      'Exactly 16 content cells. Labels sit in the same open cell as the fruit — NEVER a separate label cell, NEVER a horizontal line splitting icon from text.',
      'Each cell is a different fruit in a different graphic style (16 unique fruit+style pairs).',
      'Cell map (row-major, left-to-right, top-to-bottom):',
      lines.join('\n'),
      'Every cell = icon + floating label on solid plain white (no inner bars).',
      g2iLayoutRules(grid),
      'Do not repeat the same fruit or the same style twice.',
      'Output: one high-resolution square image ready for Grid2icons Parser (Grid mode, 4 rows x 4 cols).'
    ].join('\n');
  }

  function getStyleById(id) {
    for (var i = 0; i < STYLE_CATALOG.length; i++) {
      if (STYLE_CATALOG[i].id === id) return STYLE_CATALOG[i];
    }
    return null;
  }

  var api = {
    DEFAULT_SUBJECT: DEFAULT_SUBJECT,
    DEFAULT_GRID: DEFAULT_GRID,
    STYLE_CATALOG: STYLE_CATALOG,
    FRUIT_GRID_SUBJECTS: FRUIT_GRID_SUBJECTS,
    MULTI_STYLE_GRID_IMAGE: MULTI_STYLE_GRID_IMAGE,
    styleFruitGridPath: styleFruitGridPath,
    buildPrompt: buildPrompt,
    buildStyleFruitGridPrompt: buildStyleFruitGridPrompt,
    buildMultiStyleFruitGridPrompt: buildMultiStyleFruitGridPrompt,
    getStyleById: getStyleById
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.StylePrompts = api;
  }
})(typeof self !== 'undefined' ? self : this);
