# Tolerance: Right Answers from Wrong Parts

A static GitHub Pages site (served from `main`, root folder) at https://jkastl.github.io/tolerance/.
Commit and push straight to `main`. There are no feature branches or PRs, no build step, and no dependencies.

## Layout

- `index.html`: the short front page. Title, intro, cards for the six exhibits and the four Lab
  pages, and the closing "common thread" section. Uses `site.css`.
- Exhibits 01–06, one folder each: `vote/`, `qr/`, `gps/`, `kalman/`, `pulse-ox/`, `bufferbloat/`.
  Each page has one `<section class="ex" id="…">` (the `id` is what its script registers), a
  prev/next pager, and a reading list. The exhibit's code is one inline IIFE in the page, loaded
  after `core.js`.
- `site.css`: styles for the front page and the exhibit pages (instrument panels, controls, readouts).
- `core.js`: shared plumbing for exhibit pages. `$`, `clamp`, `lerp`, `gauss`, `COL` (instrument
  palette), `fit()` (DPR-aware canvas sizing), `font()`, `fmtPct()`, `ptr()`, `radioValue()`, and
  `register(el, {tick, resize})` plus the visibility-gated animation loop, which it starts itself.
  Top-level `const`s in classic scripts are shared, so page scripts can use these directly.
- `lab.css`: styles for the Lab pages only (`liar/`, `traitors/`, `fingerprint/`, `tearproof/`).
  Lab pages are fully self-contained apart from this stylesheet.

Adding an exhibit or Lab page means adding a card to `index.html` (`.lab-card` inside `.lab-grid`)
and, for exhibits, updating the neighbours' pager links.

## Working on a Lab page

Each Lab page has a numbered **Build plan** (`<ol class="plan">`). Work through it one item at a time.

1. Implement the next item inside that page's `index.html` (inline `<script>`, no libraries).
   Replace the `.blueprint` placeholder panel with the real instrument once there is one.
2. Mark the item finished with `<li class="done">`.
3. Update the status in **two places**: the `.status` pill in the page header and the matching
   `.lab-card .st` in the front page `index.html`. Values: `blueprint` → `building` → `live`
   (add class `building` or `live` to the header pill for its color).
4. When a page goes live, add "Try this" and "Deep cut" sections the way the main exhibits have them.

Reusable code: `qr/index.html` has `const QR` (GF(256) tables, Reed–Solomon encode/decode,
QR version 3-H encoder/decoder). Lab pages may also load `../core.js` for the canvas helpers.

## Conventions

- Instrument panels are always dark (`--bezel`) in both themes. The page itself follows `prefers-color-scheme`.
- Phone-first: check at 390 px wide with no horizontal scroll. Canvas text must not overlap at that width.
- No network calls. Sensor and camera features process data on the device and say so on the page.
- Keep the prose accurate; cite sources in the page's reading list.

## Checking changes

Headless Chromium is available in the cloud environment:

```js
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
// launch, goto file://<repo root>/<page>/index.html, collect 'pageerror' events,
// screenshot each .panel at 1200 px and 390 px widths
```

For QR work, `pip install qrcode opencv-python-headless` gives a reference encoder and a scanner to verify against.
