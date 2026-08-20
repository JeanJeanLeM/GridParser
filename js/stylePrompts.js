/**
 * Logo style gallery data + G2I-oriented prompt builder.
 * Each style produces a prompt for a regular labeled grid that Grid2icons can parse.
 */
(function (root) {
  'use strict';

  var DEFAULT_SUBJECT = 'apple';
  var DEFAULT_GRID = '4x4';

  var STYLE_CATALOG = [
    { id: 'clay-3d', name: '3D Clay', tagline: 'Soft clay render', cssClass: 'style-clay-3d' },
    { id: 'flat-vector', name: 'Flat Vector', tagline: 'Clean flat icon', cssClass: 'style-flat-vector' },
    { id: 'manga', name: 'Manga', tagline: 'Ink & screentone', cssClass: 'style-manga' },
    { id: 'chrome', name: 'Chrome Metal', tagline: 'Polished chrome', cssClass: 'style-chrome' },
    { id: 'pixel', name: 'Pixel Art', tagline: 'Retro pixels', cssClass: 'style-pixel' },
    { id: 'watercolor', name: 'Watercolor', tagline: 'Soft washes', cssClass: 'style-watercolor' },
    { id: 'neon', name: 'Neon Glow', tagline: 'Electric glow', cssClass: 'style-neon' },
    { id: 'papercut', name: 'Paper Cut', tagline: 'Layered paper', cssClass: 'style-papercut' },
    { id: 'embroidered', name: 'Embroidered', tagline: 'Thread stitches', cssClass: 'style-embroidered' },
    { id: 'stained-glass', name: 'Stained Glass', tagline: 'Lead & glass', cssClass: 'style-stained-glass' },
    { id: 'isometric', name: 'Isometric', tagline: '30° isometric', cssClass: 'style-isometric' },
    { id: 'lowpoly', name: 'Low Poly', tagline: 'Faceted mesh', cssClass: 'style-lowpoly' },
    { id: 'chalk', name: 'Chalk', tagline: 'Blackboard chalk', cssClass: 'style-chalk' },
    { id: 'graffiti', name: 'Graffiti', tagline: 'Spray paint', cssClass: 'style-graffiti' },
    { id: 'porcelain', name: 'Porcelain', tagline: 'Ceramic glaze', cssClass: 'style-porcelain' },
    { id: 'hologram', name: 'Hologram', tagline: 'Iridescent HUD', cssClass: 'style-hologram' },
    { id: 'wood', name: 'Wood Carving', tagline: 'Carved wood', cssClass: 'style-wood' },
    { id: 'origami', name: 'Origami', tagline: 'Folded paper', cssClass: 'style-origami' },
    { id: 'popart', name: 'Pop Art', tagline: 'Bold pop print', cssClass: 'style-popart' },
    { id: 'blueprint', name: 'Blueprint', tagline: 'Technical plan', cssClass: 'style-blueprint' },
    { id: 'claymation', name: 'Claymation', tagline: 'Stop-motion clay', cssClass: 'style-claymation' },
    { id: 'steampunk', name: 'Steampunk', tagline: 'Brass & gears', cssClass: 'style-steampunk' },
    { id: 'glassmorph', name: 'Glassmorphism', tagline: 'Frosted glass', cssClass: 'style-glassmorph' },
    { id: 'kawaii', name: 'Kawaii', tagline: 'Cute pastel', cssClass: 'style-kawaii' }
  ];

  function escapeSubject(subject) {
    return String(subject || DEFAULT_SUBJECT).trim() || DEFAULT_SUBJECT;
  }

  /**
   * Build a full image-gen prompt for one style, optimized for Grid2icons.
   * @param {{ id: string, name: string }} style
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
