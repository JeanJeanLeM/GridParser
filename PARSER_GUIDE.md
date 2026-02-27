# Parser Guide

This document explains how each parser mode works: where each algorithm lives, how outputs are converted into exportable cells, and when to use which mode.

## Data Model Used Across Parsers

- **Bounds**: `xBounds[]` and `yBounds[]` define a rectangular grid by vertical/horizontal cut positions.
- **Segments**: axis-aligned lines (`x1,y1 -> x2,y2`) used as structural constraints.
- **Cells**: rectangles `{ x, y, w, h }` used by overlay + export.

All modes end in **cells** before export.

---

## End-to-End Flow

1. User selects editor mode in `index.html` (Grid, Freeform, Lines, Adjacent, Black BG, or Simple Grid).
2. All modes are registered in **PARSER_MODE_REGISTRY** (`index.html`). Candidate selection is routed through `runCandidateForMode(mode, w, h)`, which calls the registry's `getCandidate(w, h)` for that mode.
3. Mode-specific auto-detect runs when the user uploads an image or clicks the mode's Auto-detect button:
   - **Grid (uniform)**: `runAutoDetect()` → `getUniformCandidate(w, h, true)` → `applyCandidateResult`.
   - **Freeform**: `runFreeformAutoDetect()` → `getFreeformCandidate(w, h)` → `applyCandidateResult`.
   - **Lines (lineform)**: `runLineFormAutoDetect()` → `getLineformCandidate(w, h)` → `applyCandidateResult`.
   - **Adjacent**: `runAdjacentAutoDetect()` → `getAdjacentCandidate(w, h)` → `applyCandidateResult`.
   - **Black BG**: `runBlackBgAutoDetect()` → `getBlackBgCandidate(w, h)` → `applyCandidateResult`.
   - **Simple Grid (geometrical)**: no detection; bounds come from grid format and corner handles.
4. Detection returns bounds or cells. Each candidate can include a **source** (e.g. `panelRects`, `darkLines`, `separators`) indicating which detector path produced it.
5. Overlay draws cells/lines. The **parser status** in the grid-editor legend shows the active mode and source (e.g. "Grid (gridLines)" or "Lines (darkLines)") after auto-detect.
6. Export uses:
   - `gridSplit.splitGridCustom(...)` for uniform and geometrical (bounds-based),
   - `segmentSplit.splitByCells(...)` for freeform, lineform, adjacent, and blackbg (cell-based).

---

## Multi-mode (Auto) flow (programmatic)

To choose the best parser automatically for an image (e.g. from script or a future Auto UI).

### Flow

1. **Shortlist**: `buildCandidateShortlist(w, h)` uses `quickImageAnalysis` → `prioritizeModesFromSignals` (or all modes if no strong signal).
2. **Candidates**: `buildAllCandidates(w, h)` runs `runCandidateForMode(mode, w, h)` for each shortlisted mode via the registry.
3. **Unified scoring**: `scoreCandidateUnified(cand, w, h)` uses the registry `minCells`/`maxCells` and applies strip/tiny/dominance penalties.
4. **Selection**: `scoreAndSelectBest(candidates, w, h)` picks the highest-scoring valid candidate and returns `mode`, `cells`/`xBounds`/`yBounds`, `confidence`, and `source`.
5. **Apply**: `applyCandidateResult(best)` applies the result; `updateParserStatus(cand)` shows mode and source in the legend.

---

## Mode 1: Uniform Grid Parser

### Entry points

- `index.html` -> `runAutoDetect()`
- `js/gridDetect.js` -> `detectGridLines(...)`
- `js/gridSplit.js` -> `splitGridCustom(...)`

### Algorithm

1. Build line-aware darkness profiles in X and Y:
   - `darknessProfile(...)`
   - `maxContiguousDark(...)`
   - `lineAwareProfile(...)`
2. Detect line runs above threshold:
   - `findRuns(...)`
   - `mergeCloseLines(...)`
3. Estimate outer bounds from first/last lines.
4. Select inner cut lines:
   - `pickNLines(...)` (equality-biased) or
   - `pickNLinesFromActual(...)` (actual-position-biased).
5. Build `xBounds` / `yBounds`.
6. Enforce minimum spacing with `enforceMinGap(...)`.

### Strengths

- Very good when image is an actual row/column grid.
- Robust to transparent backgrounds (uses luminance blended over white).

### Weaknesses

- Assumes grid topology.
- Can underperform when separators are partial, non-continuous, or semantically irregular.

---

## Mode 2: Freeform Forms Parser (Object/Layout First)

### Entry points

- `index.html` -> `runFreeformAutoDetect()` -> `getFreeformCandidate(w, h)` (registry).
- `js/segmentDetect.js` -> `detectPanelRects(...)`, `detectWhiteGaps(...)`
- `js/segmentArrangement.js` -> `segmentsToCells(...)`
- `js/segmentSplit.js` -> `splitByCells(...)`

### Priority chain (distinct primary, then fallbacks)

1. **Primary — Panel rects**: `detectPanelRects(...)` (source: `panelRects`).
   - Connected components over non-white mask; filters by area, min width/height fractions, fill ratio; merges nearby boxes, removes contained boxes.
2. **Fallback — White-gap segments**: `detectWhiteGaps(...)` (source: `whiteGaps`).
   - Detects light separator runs; converts to cells via `segmentsToCells(...)`.
3. **Last resort — Black-line grid**: `tryBlackLineGrid(...)` (source: `blackLineGrid`).

### Strengths

- Best for irregular page layouts and non-symmetric form arrangements.
- Works when geometry is shape-driven, not strict grid-driven.

### Weaknesses

- Can misinterpret whitespace and scene content as separators depending on art style.

---

## Mode 3: Freeform On Lines Parser (Border/Line First)

### Entry points

- `index.html` -> `runLineFormAutoDetect()` -> `getLineformCandidate(w, h)` (registry).
- `index.html` helpers: `tryDarkLineCells(...)`, `filterJunctionSegments(...)`, `keepCellsWithBorderSupport(...)`, `filterLineModeCells(...)`, `scoreLineModeCells(...)`.
- `js/segmentDetect.js` -> `detectDarkLines(image, options)` — axis-aligned dark line segments (options: darkThreshold, minRunFraction, minLinePx, maxLinePx, mergeGap, maxTrackGapPx, minOverlapRatio).
- `js/segmentArrangement.js` -> `segmentsToCells(...)`

### Algorithm

1. Detect dark axis-aligned line segments via `detectDarkLines(...)`.
2. Generate segment variants:
   - raw dark lines,
   - junction-filtered lines (`filterJunctionSegments(...)`).
3. Convert segments to candidate cells with `segmentsToCells(...)`.
4. Validate candidate cell border evidence:
   - `keepCellsWithBorderSupport(...)` checks side coverage (top/bottom/left/right).
5. Remove tiny/strip-like cells:
   - `filterLineModeCells(...)`.
6. Score candidates:
   - `scoreLineModeCells(...)` penalizes thin strips, tiny fragments, dominant giant cells.
7. Fallback candidate:
   - black-line grid (`tryBlackLineGrid(...)`).
8. Choose best candidate set by score.

### Strengths

- Better than freeform for border-driven compositions.
- Explicitly tries to reject inner drawing details.

### Weaknesses

- Still not ideal for "adjacent tiles with 1px separators and/or black background" where separators are ultra-thin and topology may not form strong closed-border evidence.

---

## Mode 4: Adjacent Tiles Parser (Thin Black Dividers / Black BG)

### Entry points

- `index.html` -> `runAdjacentAutoDetect()` -> `getAdjacentCandidate(w, h)` (registry).
- `index.html` helpers: `tryAdjacentSeparatorCells(...)`, `tryAdjacentForegroundCells(...)`, `filterAdjacentCells(...)`, `scoreAdjacentCells(...)`.
- `js/segmentDetect.js` -> `detectAdjacentDarkSeparators(image, options)` (thin dark row/column bands; options: darkThreshold, minSpanFraction, darknessFraction, maxThicknessPx, mergeGapPx, minFlankLuminance, flankSamplePx), `detectForegroundRectsOnDarkBg(image, options)` (non-dark connected components; options: darkBgThreshold, minAreaFraction, minWFrac, minHFrac, padPx, mergeGapPx).
- `js/segmentArrangement.js` -> `segmentsToCells(...)` (for separator-based candidates)

### Algorithm

1. **Candidate A — Thin dark separators**: `tryAdjacentSeparatorCells(...)`
   - Calls `detectAdjacentDarkSeparators(...)` with presets tuned for very thin (1–8 px), high-continuity dark lines.
   - Builds row/column profiles (dark fraction + max contiguous dark run), clusters consecutive separator rows/columns, merges nearby bands.
   - Converts separator positions into full-span axis-aligned segments, then `segmentsToCells(...)` to get cells.
2. **Candidate B — Foreground on dark background**: `tryAdjacentForegroundCells(...)`
   - Calls `detectForegroundRectsOnDarkBg(...)`: non-dark connected components (luminance > threshold), filtered by min area and min width/height fraction, merged and de-duplicated.
   - Returns rects directly as cells.
3. **Candidate C — Lineform fallbacks**: `tryDarkLineCells(...)` and `tryBlackLineGrid(...)`.
4. **Scoring and selection**: `scoreAdjacentCells(...)` penalizes strip-like cells, tiny fragments, and dominant giant cells; `filterAdjacentCells(...)` drops too-small cells. Best-scoring candidate set (2–64 cells) is chosen and stored in `freeformCells`.

### Strengths

- Suited for tiles directly next to each other with thin black separators or on a black background.
- Does not rely on closed-border evidence like lineform, so works when separators are minimal.

### Weaknesses

- Very faint or non-black separators may need other modes. Strong internal dark strokes can still be mistaken for separators on some images.

---

## Mode 5: Black BG Shapes Parser (Isolated Shapes on Dark Background)

### Entry points

- `index.html` -> `runBlackBgAutoDetect()` -> `getBlackBgCandidate(w, h)` (registry).
- `js/segmentDetect.js` -> `buildSeparatorMask(image, options)` (rasterizes thin dark separator bands to a pixel mask), `detectIsolatedShapesOnBlackBg(image, options)` (content mask minus separator mask, then connected components; options: darkBgThreshold, minAreaFraction, minWFrac, minHFrac, padPx, mergeGapPx, plus separator options).

### Algorithm

1. **Separator mask**: `buildSeparatorMask(image, options)` finds long thin dark row/column bands (same run-finding logic as `detectAdjacentDarkSeparators`: dark fraction, contiguous span, merge, optional flank-luminance filter). Rasterizes those bands to a pixel mask (1 = separator).
2. **Content mask**: Pixels with luminance above `darkBgThreshold` are content.
3. **Content-only mask**: `contentOnly[p] = content[p] && !separatorMask[p]` so connected components never cross separator pixels.
4. **Connected components**: 4-connected flood-fill on the content-only mask; each component yields one bounding rect. Same filtering as `detectForegroundRectsOnDarkBg` (min area, min width/height fraction, merge, remove contained).
5. **Candidate selection**: `getBlackBgCandidate` tries 2–3 presets; filters with `filterAdjacentCells`, scores with `scoreAdjacentCells`; returns `{ mode: 'blackbg', cells }` when 2–64 cells.

### When to use

- Dark-background images where long thin black lines separate content regions.
- When Adjacent or grid modes underperform (e.g. asymmetric layouts, or you want tiles = isolated shapes rather than grid cells).

### Strengths

- No grid assumption; asymmetric layouts (e.g. 2 on top, 1 wide below) come from the shapes alone.
- Separators are explicitly removed from the content mask, so tiles are true isolated shapes.

### Weaknesses

- If no separators are detected, behavior reduces to “foreground rects on dark BG”; internal dark lines may still be excluded when flank filter is used in the separator mask.

---

## Shared Core: Segments -> Cells

### File

- `js/segmentArrangement.js` -> `segmentsToCells(w, h, segments)`

### What it does

1. Normalizes segments into horizontal/vertical sets.
2. Builds an atomic grid from all unique X/Y coordinates induced by segment endpoints + image borders.
3. Builds adjacency between atomic cells.
4. Flood-fills connected components where no blocking segment exists between neighbors.
5. Converts each component into one rectangle if the component is full rectangular occupancy; else returns atomic rectangles.

### Why this matters

- Every segment-based parser depends on this conversion quality.
- Over-segmentation upstream directly increases false cells downstream.

---

## Shared Exporters

- Uniform export: `js/gridSplit.js` (`splitGridCustom`, `splitGrid4x4`)
- Forms export: `js/segmentSplit.js` (`splitByCells`)
- Both paths support trim and produce PNG blobs.

---

## Suggested Test Matrix

1. Adjacent tiles with **1px black separators**, white interior.
2. Adjacent tiles with **2-3px separators**.
3. Adjacent tiles on **solid black background** with thin borders.
4. Mixed artwork with strong internal black strokes (icons/text).
5. Non-uniform panel sizes sharing borders.
6. Transparent PNG variants.

Success criteria:
- No whitespace-only spacer cells.
- No internal-content micro-fragment cells.
- Expected tile count within tolerance (exact when known grid-like).

Auto mode is validated by running the above cases and confirming the chosen parser and output quality (badge confidence and absence of stray cuts).

---

## Practical Guidance for Users

- Use **Auto** to let the app pick the best parser (recommended default). You can override by switching to any specific mode.
- Use **Uniform grid** for explicit row/column layouts (e.g. 4×4 grid).
- Use **Freeform forms** for irregular, content-driven panel layouts.
- Use **Freeform on lines** for border-driven layouts with meaningful line structure (e.g. comic panels with clear black borders).
- Use **Adjacent tiles** for images where tiles are directly next to each other separated by very thin black lines or on a black background.

