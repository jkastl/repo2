# Tolerance: Right Answers from Wrong Parts

A static GitHub Pages site (served from `main`, root folder) at https://jkastl.github.io/tolerance/.
Commit and push straight to `main`. There are no feature branches or PRs, no build step, and no dependencies.
If a session is set up on its own branch, commit there too, but always also push to `main`
(`git push origin HEAD:main`); that's the owner's standing instruction, and `main` is what the site serves.

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

## Lab progress

Each Lab page's build plan and status pill are the source of truth. As of October 2026: Traitors (08) and
Tear-Proof Secrets (10) are **live**; The Liar's Game (07) is **building** (step 1 of 5 done); Your Phone's Fingerprint (09)
is **blueprint**.
Known open items:

- Liar's Game questioner (`LG.question`) searches exactly only below 24 live candidates (cost grows fast past that). It's
  optimal for one lie at every size and at 10^6 for 0–3 lies, but with 3 lies some mid sizes (27, 28) take one extra question.
  An exact search at 24 candidates with 3 lies can take ~0.5 s, so reverse mode (step 3) shouldn't block on it.

- Tear-Proof camera scanning (`BarcodeDetector`, Chrome on Android) has only been tested with a mocked
  detector, and printed tags haven't been scanned from paper. Both need a real phone.
- OpenCV fails to read ~5% of version 9–10 QR codes no matter which library made them, so an occasional
  scan failure in `tests/tearproof-split.mjs` is the scanner, not the tags.
- Tear-Proof tags record the secret's length (documented on the page). Padding to a fixed size was offered
  and not taken up.

## Checking changes

Existing checks live in `tests/` (see `tests/README.md`; `sh tests/run.sh` runs them all). Add a test file
there for each new Lab page, alongside the build-plan step it checks.


Headless Chromium is available in the cloud environment:

```js
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
// launch, goto file://<repo root>/<page>/index.html, collect 'pageerror' events,
// screenshot each .panel at 1200 px and 390 px widths
```

For QR work, `pip install qrcode opencv-python-headless` gives a reference encoder and a scanner to verify against.
