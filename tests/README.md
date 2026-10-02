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
| `liar-board.mjs` | Steps 2 and 4. 1–64 with one lie: the hint button always finishes in exactly 10; the six binary digits then hints also take 10; a lopsided first question ("≥ 60") shows "stuck" and needs 11; taps, presets, flip, clear, history wording. Step 4: the hint finishes in exactly the promised minimum on the picture, 64 and million boards with 0–3 lies (the million games take ~10 s each); million-board presets and strip; picture presets; switching boards while "thinking…"; 390 px in both themes for every board. |
| `liar-reverse.mjs` | Steps 3–4. Plays every secret (1–64 and the 20 pictures) by reading the highlighted cells, for 0–3 lies at random questions: always found within the promised count (64: 6 / 10 / 13 / 16; pictures: 5 / 8 / 11 / 14), and exactly the lies told are marked. One lie too many is never caught (no question can empty the board) and gives a wrong number. Undo; 390 px both themes. |
| `liar-writeup.mjs` | Step 5. Recomputes every number the prose quotes (20/25/29/33, 6/10/13/16, 8 pictures, the 3-number trap 15 vs 9 > 8, 16 numbers in 7); live status in both places; full page at 390 px in both themes. |

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

## Your Phone's Fingerprint (`fingerprint/`)

Headless Chromium has no motion sensors (it answers with empty readings, the desktop case), so these tests
dispatch synthetic `DeviceMotionEvent`s built by `fingerprint-lib.mjs`: each axis reports `step·A + offset`
for whole-number ADC counts `A`, with known step, offset, scale error, bias and noise. `fingerprint-lib.mjs` can
also add cross-axis mixing (a 3×3 gain matrix), a drifting offset and float32 rounding, the effects SensorID describes.
Each file prints `ok`/`FAIL` lines and exits non-zero on a failure. Real phones: one iPhone so far (see CLAUDE.md).
The figures the page quotes from the SensorID paper (870 devices, 42 + 25 ≈ 67 bits, ~5 bits per gyroscope gain,
6.5–7.2 per cross term, 53% for Bojinov et al., 2,653 sites) were checked by hand against the paper's text.

| file | checks |
|---|---|
| `fingerprint-capture.mjs` | Step 1. 1200/390 px in both themes; desktop "no sensor" message; synthetic events stored at full precision on all six axes; still/moving detector; rate from `interval`; accelerometer-only events; mocked iOS `requestPermission` granted and denied; the simulator. |
| `fingerprint-gravity.mjs` | Step 2. Recomputes the prose numbers (a 1° tilt reads 0.17 m/s²; WGS84 gravity 9.78 at the equator, 9.83 at the poles, about ±0.3%). Six faces on five phones (two with float32 values): offsets within 0.002 m/s², gain errors within 0.03%, gyro offsets within 0.02 °/s. Flat + face down only: z fitted, x/y level-only with a warning. A 2° tilted table shows up in the level offset as g·sin 2°. 1200/390 px in both themes. |
| `fingerprint-grid.mjs` | Step 3, the SensorID method (consecutive differences, a 3×3 gain matrix per sensor recovered by rounding to whole counts and refitting in growing batches). On 30 synthetic phones per case: 100 still samples (step error < 10⁻⁶), float32 (< 3·10⁻⁴, ± within 2.5×), 1% cross-axis mixing (steps and cross terms < 10⁻⁶), σ = 3 counts, six-face captures, six faces with float32 + mixing; a drifting offset (1% of a step per sample) still finds the grid but to ~10⁻³, with an honest ±. A very quiet sensor says "need more"; across every case no axis is ever reported with a wrong step. Noise added before calibration: no grid on any of 600 axes (float32's own 2⁻²⁰ grid is rejected). Values rounded to 0.1 are flagged as the browser's grid; an iPhone-like capture (accelerometer on an exact 1/65536 g grid, as a real iPhone sent in Safari, also blurred by a few parts in 10⁴ as in a capture with movement; gyroscope with noise) shows "format" and no grid, and gives no ID; calibrated-looking steps are never called a format. 3000 samples analyse in well under a second. Panel table (steps, counts per g, "mixes in"), message, 1200/390 px in both themes. |
| `fingerprint-id.mjs` | Step 4. Recomputes log₂(2% ÷ 20 ppm) ≈ 10 bits per axis and ≈ 60 for six. 30 phones × two captures, float64 and float32: "same phone" 30/30 and identical hex; the reported ± covers the real step error (float32 within 2.5×); 435 pairs of different phones: none judged the same, no hex collisions; one face of float32 data isn't precise enough and says so; a drifting offset gives no ID; 1% cross-axis mixing keeps the same hex. Panel: keep, same simulated phone (same hex), another phone, the animated "same again" button, dispatched events from one synthetic phone twice; nothing in localStorage, sessionStorage or cookies; 1200/390 px in both themes. |
| `fingerprint-defense.mjs` | Step 5. A simulated 20 s walk on 20 phones counts 36 of 36 steps as delivered, with half-step noise, and rounded to 0.1; noise nudges stay within half a step (≈ 0.001 m/s², under a thousandth of the walking swing; prose numbers recomputed) and rounding within 0.05. The switch on a simulated capture: 6/6 axes and an ID → noise: no grid, no ID → rounding: all six "browser 0.1", no ID → back: the same hex. A phone whose data already carries the noise shows no grid as delivered. 1200/390 px in both themes. The 0.1 m/s² and 0.1 °/s limits quoted on the page come from the W3C spec (`w3c/deviceorientation` index.bs) and Chromium's `services/device/generic_sensor/platform_sensor_util.h`, read when the page was written. |
| `fingerprint-writeup.mjs` | Step 6. Live in the header pill and on the front-page card; all six plan items done; Try this (6 items), deep cut, no placeholder; Ride Report / Scroll Report links; says it runs on the device and that real phones are untested. Recomputes 98.07 counts per g for the 0.1 grid and the 36-step walk; Try this #6 (lifting one end 3° moves the level-only y offset). Exercises sensors, simulator, keep and both defenses with **no network requests**; full page at 1200 and 390 px in both themes. |
