/**
 * Shared RGBA image buffer for parse detectors (browser canvas or Node rgba).
 * Avoids repeated getImageData / canvas allocations across modes.
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.imageBuffer = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var DEFAULT_MAX_SIDE = 640;

  function luminance(r, g, b) {
    return 0.299 * r + 0.587 * g + 0.114 * b;
  }

  /**
   * @param {HTMLImageElement|HTMLCanvasElement|{data,width,height,naturalWidth?,naturalHeight?}} source
   * @param {{ maxSide?: number }} [options]
   * @returns {{ data: Uint8ClampedArray|Uint8Array, width: number, height: number, scale: number, fullWidth: number, fullHeight: number }|null}
   */
  function fromImage(source, options) {
    if (!source) return null;
    if (source.data && (source.width || source.naturalWidth)) {
      var sw = source.width || source.naturalWidth;
      var sh = source.height || source.naturalHeight;
      return {
        data: source.data,
        width: sw,
        height: sh,
        scale: 1,
        fullWidth: sw,
        fullHeight: sh
      };
    }

    var fullW = source.naturalWidth || source.width;
    var fullH = source.naturalHeight || source.height;
    if (!fullW || !fullH) return null;

    var maxSide = (options && options.maxSide) || DEFAULT_MAX_SIDE;
    var scale = 1;
    var w = fullW;
    var h = fullH;
    if (Math.max(fullW, fullH) > maxSide) {
      scale = maxSide / Math.max(fullW, fullH);
      w = Math.max(1, Math.round(fullW * scale));
      h = Math.max(1, Math.round(fullH * scale));
    }

    if (typeof document === 'undefined') return null;
    var canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    var ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(source, 0, 0, w, h);
    var imageData = ctx.getImageData(0, 0, w, h);
    return {
      data: imageData.data,
      width: w,
      height: h,
      scale: scale,
      fullWidth: fullW,
      fullHeight: fullH
    };
  }

  /**
   * Build buffer from raw RGBA (e.g. Jimp / sharp in Node).
   */
  function fromRgba(data, width, height, options) {
    if (!data || !width || !height) return null;
    var maxSide = (options && options.maxSide) || DEFAULT_MAX_SIDE;
    if (Math.max(width, height) <= maxSide) {
      return {
        data: data instanceof Uint8ClampedArray ? data : new Uint8ClampedArray(data),
        width: width,
        height: height,
        scale: 1,
        fullWidth: width,
        fullHeight: height
      };
    }
    // Nearest-neighbor downscale for Node tests (no canvas).
    var scale = maxSide / Math.max(width, height);
    var w = Math.max(1, Math.round(width * scale));
    var h = Math.max(1, Math.round(height * scale));
    var out = new Uint8ClampedArray(w * h * 4);
    for (var y = 0; y < h; y++) {
      var sy = Math.min(height - 1, Math.floor(y / scale));
      for (var x = 0; x < w; x++) {
        var sx = Math.min(width - 1, Math.floor(x / scale));
        var si = (sy * width + sx) * 4;
        var di = (y * w + x) * 4;
        out[di] = data[si];
        out[di + 1] = data[si + 1];
        out[di + 2] = data[si + 2];
        out[di + 3] = data[si + 3];
      }
    }
    return {
      data: out,
      width: w,
      height: h,
      scale: scale,
      fullWidth: width,
      fullHeight: height
    };
  }

  /**
   * Resolve imageData from options.imageData, buffer-like image, or canvas draw.
   * @returns {{ data, width, height }|null}
   */
  function resolve(image, options) {
    var opts = options || {};
    if (opts.imageData && opts.imageData.data) {
      return {
        data: opts.imageData.data,
        width: opts.imageData.width,
        height: opts.imageData.height
      };
    }
    if (image && image.data && (image.width || image.naturalWidth)) {
      return {
        data: image.data,
        width: image.width || image.naturalWidth,
        height: image.height || image.naturalHeight
      };
    }
    var buf = fromImage(image, { maxSide: opts.maxSide || Infinity });
    if (!buf) return null;
    return { data: buf.data, width: buf.width, height: buf.height };
  }

  function getQuickSignals(buffer) {
    if (!buffer || !buffer.data) return { darkRatio: 0, lightRatio: 0, w: 0, h: 0 };
    var data = buffer.data;
    var w = buffer.width;
    var h = buffer.height;
    var darkCount = 0;
    var lightCount = 0;
    var total = w * h;
    for (var i = 0; i < data.length; i += 4) {
      var a = data[i + 3] / 255;
      var L = luminance(data[i], data[i + 1], data[i + 2]) * a + 255 * (1 - a);
      if (L <= 80) darkCount++;
      else if (L >= 200) lightCount++;
    }
    return {
      darkRatio: darkCount / total,
      lightRatio: lightCount / total,
      w: w,
      h: h
    };
  }

  /**
   * Scale a value from analysis buffer coords back to full-image coords.
   */
  function toFull(value, scale) {
    if (!scale || scale === 1) return value;
    return value / scale;
  }

  function scaleBounds(bounds, scale) {
    if (!bounds || !scale || scale === 1) return bounds ? bounds.slice() : bounds;
    return bounds.map(function (v) { return v / scale; });
  }

  function scaleCells(cells, scale) {
    if (!cells || !scale || scale === 1) {
      return cells ? cells.map(function (c) { return { x: c.x, y: c.y, w: c.w, h: c.h }; }) : cells;
    }
    return cells.map(function (c) {
      return { x: c.x / scale, y: c.y / scale, w: c.w / scale, h: c.h / scale };
    });
  }

  return {
    DEFAULT_MAX_SIDE: DEFAULT_MAX_SIDE,
    fromImage: fromImage,
    fromRgba: fromRgba,
    resolve: resolve,
    getQuickSignals: getQuickSignals,
    toFull: toFull,
    scaleBounds: scaleBounds,
    scaleCells: scaleCells
  };
});
