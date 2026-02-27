# 4×4 Grid Image Splitter

Split a single image that contains a 4×4 grid (e.g. from ChatGPT) into 16 separate tile images. Optional border trim and adjustable cutting lines. Supports multiple editor modes: **Grid** (uniform grid-line detection), **Freeform** (panel/shape-first), **Lines** (border/line-first), **Adjacent** (thin dark dividers or foreground on dark BG), **Black BG** (isolated shapes on dark background; separators removed), and **Simple Grid** (equal split from grid format and corner handles). Each mode uses a distinct detection approach; after auto-detect, the legend shows the active mode and source (e.g. Grid (gridLines), Lines (darkLines)).

## How to use

- Open `index.html` in a browser (or serve the folder with any static server).
- Choose an editor mode, then upload an image. Auto-detect runs per mode; adjust cutting lines or forms if needed, then download tiles as a ZIP.

## Safety and privacy

**This app does not contain malware.** All processing runs in your browser:

- Your image is never sent to any server. Splitting and ZIP creation happen entirely in the browser from your own upload.
- The downloaded ZIP and PNG tiles are standard files generated locally (canvas PNG + JSZip). No executable or remote payload is included.

If Windows shows a security warning when you open or extract the download, it is due to **Mark of the Web** (files from the internet are tagged as untrusted). To unblock: right-click the file → **Properties** → check **Unblock** → OK.

## Development

- `npm run test:grid` — runs the Node test script (reads from `Examples/`, writes tiles to `test-output/`).
- Parser internals and mode behavior are documented in [PARSER_GUIDE.md](PARSER_GUIDE.md). Modes are centralized in `PARSER_MODE_REGISTRY`; detector APIs live in `js/segmentDetect.js` (e.g. `detectDarkLines`, `detectAdjacentDarkSeparators`, `detectIsolatedShapesOnBlackBg`). Use **Adjacent** for thin black dividers or a black background; use **Black BG** for isolated shapes on a dark background (separators removed).
