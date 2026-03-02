# Grid to Icon

Split a single image that contains a grid (e.g. 4×4 from ChatGPT) into separate tile images. All processing runs in your browser: upload, adjust cutting lines, then download tiles as a ZIP.

## Features

- **Multiple detection modes**: Grid (uniform grid lines), Freeform (panel/shape-first), Lines (border/line-first), Adjacent (thin dark dividers or foreground on dark BG), Black BG (isolated shapes on dark background), Simple Grid (equal split with corner handles).
- **Optional border trim** and adjustable cutting lines.
- **OCR auto-naming** (Tesseract) for tile labels.
- **No server upload**: your image never leaves your device; splitting and ZIP creation happen locally.

## How to use

1. Open `index.html` in a browser (or run `npm run dev` and open the URL).
2. Choose an editor mode, then upload an image. Auto-detect runs; adjust lines or shapes if needed.
3. Download tiles as a single ZIP.

## Development

- `npm run dev` — static server for local testing.
- `npm run test:grid` — Node test script (reads from `Examples/`, writes to `test-output/`).
- Parser modes and detector APIs are documented in [PARSER_GUIDE.md](PARSER_GUIDE.md).

## Deployment

Deploy as a static site (e.g. Vercel). No environment variables or serverless functions are required; the app is client-only.

## Safety and privacy

This app does not contain malware. Images are processed entirely in the browser. The downloaded ZIP contains standard PNG files generated locally (canvas + JSZip). On Windows, if you see a security warning when opening or extracting, right-click the file → **Properties** → check **Unblock** → OK.
