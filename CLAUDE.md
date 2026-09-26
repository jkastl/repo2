# repo2: Right Answers from Wrong Parts

A static GitHub Pages site (served from `main`, root folder) at https://jkastl.github.io/repo2/.
Commit and push straight to `main`. There are no feature branches or PRs, no build step, and no dependencies.

## Layout

- `index.html`: the main page, six finished exhibits (01–06) plus the Lab sub-index (`#lab`).
  Fully self-contained: inline CSS and JS, no external files. Each exhibit is one IIFE in the
  script block, registered with `register(el, {tick, resize})` so it only animates while visible.
- `lab.css`: shared stylesheet for the Lab subpages only. It uses the same tokens as `index.html`.
- `liar/`, `traitors/`, `fingerprint/`, `tearproof/`: Lab exhibits 07–10, one `index.html` each.

## Working on a Lab page

Each Lab page has a numbered **Build plan** (`<ol class="plan">`). Work through it one item at a time.

1. Implement the next item inside that page's `index.html` (inline `<script>`, no libraries).
   Replace the `.blueprint` placeholder panel with the real instrument once there is one.
2. Mark the item finished with `<li class="done">`.
3. Update the status in **two places**: the `.status` pill in the page header and the matching
   `.lab-card .st` in the main `index.html`. Values: `blueprint` → `building` → `live`
   (add class `building` or `live` to the header pill for its color).
4. When a page goes live, add "Try this" and "Deep cut" sections the way the main exhibits have them.

Reusable code already in `index.html`: `const QR` (GF(256) tables, Reed–Solomon encode/decode,
QR version 3-H encoder/decoder) and helpers such as `fit()` (DPR-aware canvas sizing), `gauss()`, and `COL`
(instrument palette). Copy what you need into the subpage; subpages don't import from the main page.

## Conventions

- Instrument panels are always dark (`--bezel`) in both themes. The page itself follows `prefers-color-scheme`.
- Phone-first: check at 390 px wide with no horizontal scroll. Canvas text must not overlap at that width.
- No network calls. Sensor and camera features process data on the device and say so on the page.
- Keep the prose accurate; cite sources in the page's reading list.

## Checking changes

Headless Chromium is available in the cloud environment:

```js
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
// launch, goto file:///home/user/repo2/<page>/index.html, collect 'pageerror' events,
// screenshot each .panel at 1200 px and 390 px widths
```

For QR work, `pip install qrcode opencv-python-headless` gives a reference encoder and a scanner to verify against.
