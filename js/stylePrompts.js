/**
 * Logo style gallery data + G2I-oriented prompt builder.
 * Each style produces a prompt for a regular labeled grid that Grid2icons can parse.
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
    { id: 'isometric', name: 'Isometric', tagline: '30Â° isometric', thumb: '/assets/styles/isometric.webp' },
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
      'Visual style for EVERY tile: ' + styleName + ' â€” ' + (style.tagline || styleName) + '.',
      'Each tile must look like an app icon / logo mark: subject only, solid plain white or solid flat neutral background (no colorful scenic backdrop, no floor, no room).',
      'Layout requirements (critical for automatic splitting):',
      '- Exactly ' + grid + ' equal rectangular cells in a regular row/column grid.',
      '- Thin continuous black separator lines between cells (1â€“3 px), full length, no gaps.',
      '- Pure white background outside and between cells.',
      '- No outer decorative frame, watermark, or title outside the grid.',
      'Label requirements (critical for OCR naming):',
      '- Bottom 25% of EACH cell is a clean white label band with short black sans-serif text.',
      '- Label text is ONLY the style name word: "' + labelWord + '" (same on every tile, readable, no effects).',
      '- Icon artwork stays in the upper ~75% of each cell; do not put the label over the object.',
      'After crop of the bottom label band, each tile must still be a clean centered ' + s + ' icon on a plain background.',
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

