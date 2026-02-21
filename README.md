# 4×4 Grid Image Splitter

Split a single image that contains a 4×4 grid (e.g. from ChatGPT) into 16 separate tile images. Optional border trim and adjustable cutting lines.

## How to use

- Open `index.html` in a browser (or serve the folder with any static server).
- Upload a grid image, optionally adjust cutting lines, then download all 16 tiles as a ZIP.

## Safety and privacy

**This app does not contain malware.** All processing runs in your browser:

- Your image is never sent to any server. Splitting and ZIP creation happen entirely in the browser from your own upload.
- The downloaded ZIP and PNG tiles are standard files generated locally (canvas PNG + JSZip). No executable or remote payload is included.

If Windows shows a security warning when you open or extract the download, it is due to **Mark of the Web** (files from the internet are tagged as untrusted). To unblock: right-click the file → **Properties** → check **Unblock** → OK.

## Development

- `npm run test:grid` — runs the Node test script (reads from `Examples/`, writes tiles to `test-output/`).
