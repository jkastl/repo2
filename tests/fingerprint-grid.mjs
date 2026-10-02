// Step 3: grid recovery. node tests/fingerprint-grid.mjs
// The page follows SensorID: consecutive differences (offsets and drift cancel), a 3×3 gain matrix per sensor
// recovered by rounding G⁻¹·ΔO to whole counts and refitting. These cases feed it synthetic phones with known
// steps, cross-axis mixing (SensorID's iPhone XS gyroscope: up to ~0.9%), drift, float32 values and the defenses.
import { chromium, PAGE, OUT, makeSynth, synthSample, synthScript, dispatch, pageErrors, sleep, rng, G0, FACES } from './fingerprint-lib.mjs';
const b = await chromium.launch();
const fails = [];
const check = (ok, msg) => { if (!ok) fails.push(msg); console.log((ok ? 'ok   ' : 'FAIL ') + msg); };
const p = await b.newPage(); const errs = pageErrors(p);
await p.goto(PAGE);
const grid = S => p.evaluate(S => FP.gridAll(S).map(g => ({ ok: g.ok, step: g.step, sd: g.sd, mix: g.mix, rounded: g.rounded, reason: g.reason })), S);
const stillSamples = (ph, r, n, face = FACES[0]) => Array.from({ length: n }, () => synthSample(ph, [...face, 0, 0, 0], r));
let wrong = 0;   // a grid reported with the wrong step (more than 1% off) — must never happen

function score(R, ph) {
  const o = { found: 0, few: 0, n: 0, err: 0, mixErr: 0, ratio: 0 };
  R.forEach((g, i) => {
    o.n++;
    if (g.reason === 'few') { o.few++; return; }
    if (!g.ok) return;
    o.found++;
    const e = Math.abs(g.step / ph.axes[i].step - 1);
    if (e > 0.01) wrong++;
    o.err = Math.max(o.err, e);
    o.ratio = Math.max(o.ratio, e / Math.max(g.sd / g.step, 1e-15));
    const others = [0, 1, 2].filter(j => j !== i % 3);
    o.mixErr = Math.max(o.mixErr, ...g.mix.map((m, k) => Math.abs(m - ph.mix[i][others[k]])));
  });
  return o;
}
async function run(label, opts, make, tol, extra = () => true) {
  const T = { found: 0, few: 0, n: 0, err: 0, mixErr: 0, ratio: 0 };
  for (let seed = 1; seed <= 30; seed++) {
    const ph = makeSynth(seed * 31 + 7, opts), R = await grid(make(ph, seed));
    const o = score(R, ph);
    T.found += o.found; T.few += o.few; T.n += o.n;
    T.err = Math.max(T.err, o.err); T.mixErr = Math.max(T.mixErr, o.mixErr); T.ratio = Math.max(T.ratio, o.ratio);
  }
  check(T.found + T.few === T.n && T.found >= 0.9 * T.n && T.err < tol && extra(T),
    `${label}: ${T.found}/${T.n} found${T.few ? ` (${T.few} need more)` : ''}, step error ≤ ${T.err.toExponential(1)} (< ${tol}), cross-term error ≤ ${T.mixErr.toExponential(1)}, error ≤ ${T.ratio.toFixed(1)} × reported ±`);
}
const still100 = (ph, seed) => stillSamples(ph, rng(seed), 100, FACES[seed % 6]);
const six = (ph, seed) => synthScript(ph, seed, 90);

await run('100 still samples', {}, still100, 1e-6);
await run('100 still, float32', { f32: true }, still100, 3e-4, T => T.ratio < 2.5);
await run('100 still, 1% cross-axis mixing', { mix: 0.01 }, still100, 1e-6, T => T.mixErr < 1e-6);
await run('100 still, σ = 3 counts', { sigma: 3 }, still100, 1e-6);
await run('six faces', {}, six, 1e-6);
await run('six faces, float32, 1% mixing', { f32: true, mix: 0.01 }, six, 1e-6, T => T.mixErr < 1e-6);
// a drifting offset (like Safari's bias correction): still found, but much less precisely, and the ± says so
await run('300 still, drift 1% of a step per sample', { drift: 0.01 }, (ph, s) => stillSamples(ph, rng(s), 300), 1e-2, T => T.ratio < 5);
await run('six faces, drift + mixing + float32', { drift: 0.01, mix: 0.01, f32: true }, six, 1e-2, T => T.ratio < 5);

// very quiet sensor: "need more", never a wrong step
{
  let few = 0, n = 0;
  for (let seed = 1; seed <= 30; seed++) {
    const ph = makeSynth(seed, { sigma: 0.25 }), R = await grid(stillSamples(ph, rng(seed), 60));
    n += 6; few += R.filter(g => g.reason === 'few').length; score(R, ph);
  }
  check(true, `σ = 0.25 counts, 60 samples: ${few}/${n} axes say "need more"`);
}
// the iOS 12.2-style defense: noise of up to ½ count before calibration — no grid, ever
{
  let falseGrid = 0, n = 0;
  for (let seed = 1; seed <= 100; seed++) {
    const ph = makeSynth(seed, { noiseDefense: true, f32: seed % 2 === 0, mix: seed % 3 ? 0.005 : 0 });
    const R = await grid(seed % 3 ? six(ph, seed) : stillSamples(ph, rng(seed), 150));
    n += 6; falseGrid += R.filter(g => g.ok).length;
  }
  check(falseGrid === 0, `noise defense: ${falseGrid} of ${n} axes falsely report a grid`);
}
// browser rounding to 0.1: found, flagged as the browser's grid
{
  const ph = makeSynth(77), r = rng(1), S = [];
  for (let i = 0; i < 300; i++) S.push(synthSample(ph, [0.3 * Math.sin(i / 9), 0.3 * Math.cos(i / 11), G0 + 0.25 * Math.cos(i / 7), 0.4 * Math.sin(i / 5), 0.3, -0.2 * Math.cos(i / 4)], r).map(v => Math.round(v / 0.1) * 0.1));
  const R = await grid(S);
  check(R.every(g => g.ok && g.rounded && Math.abs(g.step - 0.1) < 1e-9), `rounded to 0.1: all six axes flagged as browser rounding (${R.map(g => g.rounded).join(',')})`);
}
check(wrong === 0, `never a confidently wrong step (${wrong} axes off by more than 1%)`);
const t = await p.evaluate(S => { const t0 = performance.now(); FP.gridAll(S); return performance.now() - t0; }, Array.from({ length: 5 }, (_, k) => synthScript(makeSynth(k + 1, { mix: 0.005 }), k, 90)).flat().slice(0, 3000));
check(t < 1000, `3000 samples analysed in ${t.toFixed(0)} ms`);

// the panel
await p.click('#cap-start');
const ph = makeSynth(31, { mix: 0.008 });
await dispatch(p, synthScript(ph, 3, 90)); await sleep(900);
const T = await p.$$eval('#grid-tab tr', rs => rs.slice(1).map(r => [...r.children].map(c => c.textContent)));
check(T.every(r => r[1] === 'grid'), 'table: grid on all six axes');
check(T.every((r, i) => Math.abs(parseFloat(r[2]) / ph.axes[i].step - 1) < 1e-6), 'table: steps match the synthetic phone to 7 digits');
check(T.slice(0, 3).every((r, i) => Math.abs(parseFloat(r[3]) - G0 / ph.axes[i].step) < 0.01), 'table: counts per g = 9.80665 / step');
check(T.every((r, i) => Math.abs(parseFloat(r[4]) - 100 * Math.max(...ph.mix[i].map(Math.abs))) < 0.006), `table: "mixes in" = largest cross term (${T.map(r => r[4]).join(', ')})`);
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
await p.click('#cap-stop'); await p.click('#cap-start');
await dispatch(p, synthScript(makeSynth(32, { noiseDefense: true }), 3, 90)); await sleep(900);
check(/no grid/.test(await p.textContent('#grid-msg')), 'noisy capture: panel says no grid');
await (await p.$('#grid')).screenshot({ path: `${OUT}/fp-grid-noise.png` });
check(errs.length === 0, `no page errors ${errs.join(' ')}`);
await b.close();
console.log(fails.length ? `${fails.length} FAILED` : 'all passed');
process.exit(fails.length ? 1 : 0);
