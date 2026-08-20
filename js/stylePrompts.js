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

  /** 16 fruits for the showcase 4x4 multi-style grid (row-major). */
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

  /** Shared rules so Grid2icons Grid mode + OCR + label crop work reliably. */
  function g2iLayoutRules(grid) {
    return [
      'GRID2ICONS LAYOUT (must follow exactly):',
      '- One square image that is a perfect ' + grid + ' regular grid (equal cell sizes).',
      '- Thin continuous pure-black separator lines between every cell (1-3 px), full span, no gaps, no dashes.',
      '- Pure white margins outside the grid; no outer frame, watermark, title, or caption outside cells.',
      '- Each cell: upper ~75% = centered icon on solid plain white (or solid flat neutral) background; no scenic backdrop, no floor, no shadows on the page.',
      '- Each cell: bottom ~25% = solid white label band with short black sans-serif text only (no icons in the band).',
      '- Labels must be OCR-friendly: high contrast, no effects, one short word or CamelCase token.',
      '- Designed so Grid mode detects ' + grid + ' and Auto-name + Remove-label crop cleanly.'
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
      'Each tile is an app-icon / logo mark of "' + s + '" only — plain background inside the tile.',
      'Label on every tile (identical): "' + label + '".',
      g2iLayoutRules(grid),
      'Output: one high-resolution square PNG-like image, consistent lighting, no collage chaos.'
    ].join('\n');
  }

  /**
   * Prompt for the showcase 4x4: different fruits, each in a different style.
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
        '- Row ' + row + ' Col ' + col + ': fruit "' + fruit + '" in style "' + st.name +
        '" (' + st.tagline + '); label text exactly "' + labelToken(fruit) + '".'
      );
    }

    return [
      'Generate a single square image for Grid2icons (G2I): a perfect ' + grid + ' icon grid of FRUITS.',
      'Each cell is a different fruit in a different graphic style (16 unique fruit+style pairs).',
      'Cell map (row-major, left-to-right, top-to-bottom):',
      lines.join('\n'),
      'Every cell must look like a clean app icon: fruit only, solid plain white tile background.',
      g2iLayoutRules(grid),
      'Do not repeat the same fruit or the same style twice.',
      'Output: one high-resolution square image ready to upload into Grid2icons Parser (Grid mode, 4 rows x 4 cols).'
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
    buildPrompt: buildPrompt,
    buildMultiStyleFruitGridPrompt: buildMultiStyleFruitGridPrompt,
    getStyleById: getStyleById
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.StylePrompts = api;
  }
})(typeof self !== 'undefined' ? self : this);
