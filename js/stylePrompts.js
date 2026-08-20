/**
 * Logo style gallery data + G2I-oriented prompt builder.
 * Each style produces a prompt for a regular labeled grid that Grid2icons can parse.
 */
(function (root) {
  'use strict';

  var DEFAULT_SUBJECT = 'apple';
  var DEFAULT_GRID = '4x4';

  var STYLE_CATALOG = [
    { id: 'clay-3d', name: '3D Clay', tagline: 'Soft clay render', thumb: '/assets/styles/clay-3d.png' },
    { id: 'flat-vector', name: 'Flat Vector', tagline: 'Clean flat icon', thumb: '/assets/styles/flat-vector.png' },
    { id: 'manga', name: 'Manga', tagline: 'Ink & screentone', thumb: '/assets/styles/manga.png' },
    { id: 'chrome', name: 'Chrome Metal', tagline: 'Polished chrome', thumb: '/assets/styles/chrome.png' },
    { id: 'pixel', name: 'Pixel Art', tagline: 'Retro pixels', thumb: '/assets/styles/pixel.png' },
    { id: 'watercolor', name: 'Watercolor', tagline: 'Soft washes', thumb: '/assets/styles/watercolor.png' },
    { id: 'neon', name: 'Neon Glow', tagline: 'Electric glow', thumb: '/assets/styles/neon.png' },
    { id: 'papercut', name: 'Paper Cut', tagline: 'Layered paper', thumb: '/assets/styles/papercut.png' },
    { id: 'embroidered', name: 'Embroidered', tagline: 'Thread stitches', thumb: '/assets/styles/embroidered.png' },
    { id: 'stained-glass', name: 'Stained Glass', tagline: 'Lead & glass', thumb: '/assets/styles/stained-glass.png' },
    { id: 'isometric', name: 'Isometric', tagline: '30° isometric', thumb: '/assets/styles/isometric.png' },
    { id: 'lowpoly', name: 'Low Poly', tagline: 'Faceted mesh', thumb: '/assets/styles/lowpoly.png' },
    { id: 'chalk', name: 'Chalk', tagline: 'Blackboard chalk', thumb: '/assets/styles/chalk.png' },
    { id: 'graffiti', name: 'Graffiti', tagline: 'Spray paint', thumb: '/assets/styles/graffiti.png' },
    { id: 'porcelain', name: 'Porcelain', tagline: 'Ceramic glaze', thumb: '/assets/styles/porcelain.png' },
    { id: 'hologram', name: 'Hologram', tagline: 'Iridescent HUD', thumb: '/assets/styles/hologram.png' },
    { id: 'wood', name: 'Wood Carving', tagline: 'Carved wood', thumb: '/assets/styles/wood.png' },
    { id: 'origami', name: 'Origami', tagline: 'Folded paper', thumb: '/assets/styles/origami.png' },
    { id: 'popart', name: 'Pop Art', tagline: 'Bold pop print', thumb: '/assets/styles/popart.png' },
    { id: 'blueprint', name: 'Blueprint', tagline: 'Technical plan', thumb: '/assets/styles/blueprint.png' },
    { id: 'claymation', name: 'Claymation', tagline: 'Stop-motion clay', thumb: '/assets/styles/claymation.png' },
    { id: 'steampunk', name: 'Steampunk', tagline: 'Brass & gears', thumb: '/assets/styles/steampunk.png' },
    { id: 'glassmorph', name: 'Glassmorphism', tagline: 'Frosted glass', thumb: '/assets/styles/glassmorph.png' },
    { id: 'kawaii', name: 'Kawaii', tagline: 'Cute pastel', thumb: '/assets/styles/kawaii.png' }
  ];

  function escapeSubject(subject) {
    return String(subject || DEFAULT_SUBJECT).trim() || DEFAULT_SUBJECT;
  }

  /**
   * Build a full image-gen prompt for one style, optimized for Grid2icons.
   * @param {{ id: string, name: string, tagline?: string }} style
   * @param {string} [subject]
   * @param {{ grid?: string }} [options]
   */
  function buildPrompt(style, subject, options) {
    var s = escapeSubject(subject);
    var grid = (options && options.grid) || DEFAULT_GRID;
    var styleName = style && style.name ? style.name : 'icon';
    var labelWord = styleName.replace(/\s+/g, '');

    return [
      'Create a single image that is a perfect ' + grid + ' grid of icon tiles.',
      'Subject for EVERY tile: ' + s + ' (same object, same pose family, only small harmless variation).',
      'Visual style for EVERY tile: ' + styleName + ' — ' + (style.tagline || styleName) + '.',
      'Layout requirements (critical for automatic splitting):',
      '- Exactly ' + grid + ' equal rectangular cells in a regular row/column grid.',
      '- Thin continuous black separator lines between cells (1–3 px), full length, no gaps.',
      '- Pure white background outside and between cells.',
      '- No outer decorative frame, watermark, or title outside the grid.',
      'Label requirements (critical for OCR naming):',
      '- Bottom 25% of EACH cell is a clean white label band with short black sans-serif text.',
      '- Label text is ONLY the style name word: "' + labelWord + '" (same on every tile, readable, no effects).',
      '- Icon artwork stays in the upper ~75% of each cell; do not put the label over the object.',
      'After crop of the bottom label band, each tile must still be a clean centered ' + s + ' icon.',
      'Square overall image, high resolution, consistent lighting, no collage randomness.'
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
    buildPrompt: buildPrompt,
    getStyleById: getStyleById
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.StylePrompts = api;
  }
})(typeof self !== 'undefined' ? self : this);
