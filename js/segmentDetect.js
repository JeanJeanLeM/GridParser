/**
 * Detect white/light gaps in an image and return axis-aligned segments.
 * (Placeholder until full implementation in step 3.)
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.segmentDetect = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  function detectWhiteGaps(image, options) {
    return [];
  }
  return { detectWhiteGaps: detectWhiteGaps };
});
