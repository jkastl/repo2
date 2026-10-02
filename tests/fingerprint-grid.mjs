// Step 3: grid recovery. node tests/fingerprint-grid.mjs
import { chromium, PAGE, OUT, makeSynth, synthSample, synthScript, dispatch, pageErrors, sleep, rng, G0, FACES } from './fingerprint-lib.mjs';
const b = await chromium.launch();
const fails = [];
const check = (ok, msg) => { if (!ok) fails.push(msg); console.log((ok ? 'ok   ' : 'FAIL ') + msg); };
const p = await b.newPage(); const errs = pageErrors(p);
await p.goto(PAGE);
const find = (vals) => p.evaluate(v => FP.gridFind(v), vals);
const findAll = (cols) => p.evaluate(C => C.map(v => FP.gridFind(v)), cols);
const cols = S => [0, 1, 2, 3, 4, 5].map(i => S.map(s => s[i]));
const circ = (a, b) => { let d = a - b; d -= Math.round(d); return Math.abs(d); };

// 100 still samples on one face, many phones, three noise levels, float64 and float32
for (const sigma of [1, 1.5, 3]) for (const f32 of [false, true]) {
  let worst = 0, worstPh = 0, miss = 0, few = 0, n = 0;
  for (let seed = 1; seed <= 60; seed++) {
    const ph = makeSynth(seed * 7 + sigma * 1000, { sigma, f32 }), r = rng(seed);
    const S = []; for (let i = 0; i < 100; i++) S.push(synthSample(ph, [...FACES[seed % 6], 0, 0, 0], r));
    const R = await findAll(cols(S));
    R.forEach((g, i) => {
      n++;
      if (g.reason === 'few') { few++; return; }
      if (!g.ok) { miss++; return; }
      const ax = ph.axes[i];
      worst = Math.max(worst, Math.abs(g.step / ax.step - 1));
      worstPh = Math.max(worstPh, circ(g.phase, ax.offset / ax.step));
      if (g.rounded) miss++;
    });
  }
  // float32 near 9.8 m/s² only has ~1e-6 resolution, so one face of float32 data pins the step to ~1e-4
  check(miss === 0 && (f32 ? worst < 3e-4 : worst < 1e-6 && worstPh < 2e-3),
    `σ=${sigma} counts${f32 ? ' f32' : ''}, 100 still samples: ${n - few - miss}/${n} axes found, worst step error ${worst.toExponential(1)} (< ${f32 ? '3e-4' : '1e-6'}), worst offset ${worstPh.toExponential(1)} step${few ? `, ${few} too few levels` : ''}`);
}
// very quiet sensor: few distinct values must say "few", never a wrong step
{
  let wrong = 0, few = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const ph = makeSynth(seed, { sigma: 0.3 }), r = rng(seed);
    const S = []; for (let i = 0; i < 100; i++) S.push(synthSample(ph, [0, 0, G0, 0, 0, 0], r));
    for (const [i, g] of (await findAll(cols(S))).entries()) {
      if (g.reason === 'few') few++;
      else if (g.ok && Math.abs(g.step / ph.axes[i].step - 1) > 1e-6) wrong++;
    }
  }
  check(wrong === 0, `σ=0.3 counts: ${few}/240 axes say "need more", 0 wrong steps (got ${wrong})`);
}
// the full six-face capture, large gaps between faces included
{
  let worst = 0, bad = 0;
  for (let seed = 1; seed <= 20; seed++) {
    const ph = makeSynth(seed + 500, { f32: seed % 2 === 0 });
    const R = await findAll(cols(synthScript(ph, seed, 90)));
    R.forEach((g, i) => { if (!g.ok || g.rounded) bad++; else worst = Math.max(worst, Math.abs(g.step / ph.axes[i].step - 1)); });
  }
  check(bad === 0 && worst < 1e-6, `six-face captures: all 120 axes found, worst step error ${worst.toExponential(1)}`);
}
// noise added before calibration (±½ count): no grid, ever
{
  let fp = 0, n = 0;
  for (let seed = 1; seed <= 100; seed++) {
    const ph = makeSynth(seed, { noiseDefense: true, f32: seed % 2 === 0 });
    const S = seed % 3 ? synthScript(ph, seed, 90) : synthScript(ph, seed, 100, FACES.slice(0, 1));
    for (const g of await findAll(cols(S))) { n++; if (g.ok) fp++; }
  }
  check(fp === 0, `noise defense: ${fp} of ${n} axes falsely report a grid`);
}
// browser rounding to 0.1: found, flagged as the browser's grid
{
  const ph = makeSynth(77), r = rng(1), S = [];
  for (let i = 0; i < 300; i++) S.push(synthSample(ph, [0.3 * Math.sin(i / 9), 0.3 * Math.cos(i / 11), G0 + 0.25 * Math.cos(i / 7), 0.4 * Math.sin(i / 5), 0.3, -0.2 * Math.cos(i / 4)], r).map(v => Math.round(v / 0.1) * 0.1));
  const R = await findAll(cols(S));
  check(R.every(g => g.ok && g.rounded && Math.abs(g.step - 0.1) < 1e-9), `rounded to 0.1: all six axes flagged as browser rounding (${R.map(g => g.rounded).join(',')})`);
}

// the panel: real capture → table and message
await p.click('#cap-start');
const ph = makeSynth(31);
await dispatch(p, synthScript(ph, 3, 90)); await sleep(400);
const T = await p.$$eval('#grid-tab tr', rs => rs.slice(1).map(r => [...r.children].map(c => c.textContent)));
check(T.every(r => r[1] === 'grid'), 'table: grid on all six axes');
check(T.every((r, i) => Math.abs(parseFloat(r[2]) / ph.axes[i].step - 1) < 1e-6), 'table: steps match the synthetic phone to 7 digits');
check(T.slice(0, 3).every((r, i) => Math.abs(parseFloat(r[3]) - G0 / ph.axes[i].step) < 0.01), 'table: counts per g = 9.80665 / step');
check(/Grid found on 6 of 6 axes/.test(await p.textContent('#grid-msg')), 'message: found on 6 of 6');
for (const [W, scheme] of [[1200, 'light'], [1200, 'dark'], [390, 'dark'], [390, 'light']]) {
  await p.setViewportSize({ width: W, height: 900 }); await p.emulateMedia({ colorScheme: scheme });
  await sleep(300);
  for (const ax of [2, 4]) {
    await p.click(`#grid-ax [data-v="${ax}"]`);
    await (await p.$('#grid')).screenshot({ path: `${OUT}/fp-grid-${W}-${scheme}-ax${ax}.png` });
  }
  const sw = await p.evaluate(() => document.documentElement.scrollWidth);
  check(sw === W, `${W} ${scheme}: no horizontal scroll (sw ${sw})`);
}
// noisy capture in the panel: "no grid", flat fold
await p.click('#cap-stop'); await p.click('#cap-start');
await dispatch(p, synthScript(makeSynth(32, { noiseDefense: true }), 3, 90)); await sleep(400);
check(/no grid/.test(await p.textContent('#grid-msg')), 'noisy capture: panel says no grid');
await (await p.$('#grid')).screenshot({ path: `${OUT}/fp-grid-noise.png` });
check(errs.length === 0, `no page errors ${errs.join(' ')}`);
await b.close();
console.log(fails.length ? `${fails.length} FAILED` : 'all passed');
process.exit(fails.length ? 1 : 0);
