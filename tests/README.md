# Tests

Checks for the Lab pages. None of this is part of the site: the pages are static and have no build step.
Screenshots and scratch files go to `tests/out/` (git-ignored). Run everything with `sh tests/run.sh`,
or any single file with `node tests/<file>.mjs` / `python3 tests/<file>.py` from any directory.

Needs the cloud environment's Playwright (`/opt/node22/lib/node_modules/playwright`) and, for the QR
checks, `pip install qrcode opencv-python-headless`.

Most UI tests print what they saw rather than asserting. A clean run prints `errs: []` / `errors: []`
(no page errors) and `sw` equal to the viewport width (no horizontal scroll) at 1200 and 390 px.
Look at the screenshots in `tests/out/` after layout changes.

## The Liar's Game (`liar/`)

| file | checks |
|---|---|
| `liar-math.mjs` | Step 1. Volume conservation on random questions; the bound for 10⁶ is 20/25/29/33 for 0–3 lies; exact search for n ≤ 40 matches Pelc's one-lie formula; the questioner beats *every* answer sequence at 10⁶ in exactly the bound (0–3 lies), and in a sweep of other sizes (one lie: always Pelc's number); questioner vs adversary on small boards uses the exact optimum. ~4 s. |

## Traitors (`traitors/`)

| file | checks |
|---|---|
| `traitors-engine.mjs` | Exhaustive: a perfect traitor (every possible message combination) against OM(1) and SM(m). Expected: OM(1) n=3 t=1 loses 6 of 18 setups, n≥4 t=1 none; SM(1) never loses with 1 traitor, even at n=3; SM(1) with 2 traitors loses, SM(2) doesn't. |
| `traitors-bots.mjs` | 2 humans + 2 bots played to the reveal 20 times; "bots only" never deals a human a traitor; watch mode ≈ 66% loyal wins at 3 generals, 100% at 4. |
| `traitors-sealed.mjs` | Sealed games with random human traitor choices and with 2 bot traitors: the loyal side wins every one. |
| `traitors-writeup.mjs` | The 3f+1 proof panel in light and dark at 1200/390; the front-page card text. |

## Tear-Proof Secrets (`tearproof/`)

| file | checks |
|---|---|
| `tearproof-math.mjs` | GF(256) inverses; split→combine for every k-subset with n ≤ 8, both modes (5,020 round trips); secret mode k−1 shares exactly uniform for k = 2, 3, 4 (exhaustive, ~20 s); backup mode leaks. |
| `tearproof-tags.mjs` | Tag pack → sloppy typing (lowercase, O/0, l/1, no dashes) → unpack → combine; every single-character typo caught (expect 3360 of 3360). |
| `tearproof-qr.py` + `qrdump.mjs` | Our QR encoder vs the Python `qrcode` library, module for module, versions 1–10 × L/M/Q/H × 8 masks (expect 0 different). |
| `tearproof-qr-v10.py` + `qrdump-v10.mjs` | 200 large tag codes: identical to the reference; OpenCV reads ~95% of them *whichever library made them*. |
| `tearproof-explainer.mjs` | Tear tags off the curve plot (fan appears at k−1), forge a tag with spares (outvoted). |
| `tearproof-split.mjs` | Screenshot tags, scan with OpenCV, recombine from k scans. A version-10 tag occasionally fails to scan (OpenCV, see above); everything else should print OK. |
| `tearproof-recover.mjs` | Demo button, one tag short, sloppy typing, duplicates, wrong set, bad checksum, forged tag with 0/1/2 spares, camera fallback, and a mocked BarcodeDetector + fake camera. |
| `tearproof-print.mjs` | Print media shows only `#sheet` (the tags); screenshot of the cut sheet. |
| `tearproof-writeup.mjs` | Comparison table at 390 px in both themes; backup-mode leak counter; front-page statuses. |
