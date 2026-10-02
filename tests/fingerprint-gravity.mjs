// Step 2: offset and gain from gravity. node tests/fingerprint-gravity.mjs
import { chromium, PAGE, OUT, makeSynth, synthSample, synthScript, dispatch, pageErrors, sleep, rng, gauss, G0, FACES } from './fingerprint-lib.mjs';
const b = await chromium.launch();
const fails = [];
const check = (ok, msg) => { if (!ok) fails.push(msg); console.log((ok ? 'ok   ' : 'FAIL ') + msg); };
const fmt = x => x.toExponential(2);

// numbers the prose quotes
const tilt1 = G0 * Math.sin(Math.PI / 180);
check(tilt1.toFixed(2) === '0.17', `a 1° tilt reads ${tilt1.toFixed(4)} m/s² (prose: 0.17)`);
const somig = phi => { const s2 = Math.sin(phi) ** 2; return 9.7803253359 * (1 + 0.00193185265241 * s2) / Math.sqrt(1 - 0.00669437999013 * s2); };
const ge = somig(0), gp = somig(Math.PI / 2);
check(ge.toFixed(2) === '9.78' && gp.toFixed(2) === '9.83', `WGS84 normal gravity: equator ${ge.toFixed(4)}, pole ${gp.toFixed(4)} (prose: 9.78, 9.83)`);
const spread = Math.max(Math.abs(ge / G0 - 1), Math.abs(gp / G0 - 1)) * 100;
check(spread > 0.2 && spread < 0.35, `latitude alone moves "1 g" by up to ${spread.toFixed(2)}% (prose: about ±0.3%)`);

async function run(ph, samples, label) {
  const p = await b.newPage(); const errs = pageErrors(p);
  await p.goto(PAGE); await p.click('#cap-start');
  await dispatch(p, samples); await sleep(120);
  const R = await p.evaluate(() => ({ g: GRAV, faces: [...document.querySelectorAll('#grav-faces .face')].map(f => f.className), msg: document.querySelector('#grav-msg').textContent }));
  check(errs.length === 0, `${label}: no page errors`);
  await p.close();
  return R;
}

// all six faces, several phones, with and without float32 values
for (const [seed, f32] of [[1, false], [2, false], [3, true], [4, true], [5, false]]) {
  const ph = makeSynth(seed, { f32 });
  const R = await run(ph, synthScript(ph, seed + 100, 100), `phone ${seed}${f32 ? ' f32' : ''}`);
  let worstB = 0, worstS = 0, worstG = 0;
  for (let i = 0; i < 3; i++) {
    worstB = Math.max(worstB, Math.abs(R.g.acc[i].bias - ph.axes[i].bias));
    worstS = Math.max(worstS, Math.abs(R.g.acc[i].scale - ph.axes[i].scale));
    worstG = Math.max(worstG, Math.abs(R.g.gyro[i] - ph.axes[3 + i].bias));
  }
  check(R.g.acc.every(a => a.how === 'both'), `phone ${seed}: all three axes fitted from both faces`);
  check(worstB < 0.002, `phone ${seed}: accel offsets within 0.002 m/s² (worst ${fmt(worstB)})`);
  check(worstS < 3e-4, `phone ${seed}: gain errors within 0.03% (worst ${fmt(worstS)})`);
  check(worstG < 0.02, `phone ${seed}: gyro offsets within 0.02 °/s (worst ${fmt(worstG)})`);
  check(R.faces.every(c => c.includes('got')) && /All three axes/.test(R.msg), `phone ${seed}: six faces shown, message says done`);
}

// flat and face down only: z gets offset and gain; x and y only a level-surface offset
{
  const ph = makeSynth(9);
  const R = await run(ph, synthScript(ph, 9, 100, FACES.slice(0, 2)), 'flat + face down');
  check(R.g.acc[2].how === 'both' && R.g.acc[0].how === 'level' && R.g.acc[1].how === 'level', 'z both, x/y level');
  check(Math.abs(R.g.acc[0].bias - ph.axes[0].bias) < 0.002, 'level offset right on a level table');
  check(/missing x\+ and x−, y\+ and y−/.test(R.msg) && /assume the surface is level/.test(R.msg), 'says what is missing and warns about level');
}
// a table tilted 2° about y, flat only: the level offset of x is wrong by g·sin 2°.
// (Flat plus face down on the same tilt cancel in the average, so test the flat pose alone.)
{
  const ph = makeSynth(10), r = rng(3), t = 2 * Math.PI / 180, S = [];
  const tilt = v => [v[0] * Math.cos(t) + v[2] * Math.sin(t), v[1], -v[0] * Math.sin(t) + v[2] * Math.cos(t)];
  for (const f of FACES.slice(0, 1)) { for (let i = 0; i < 100; i++) S.push(synthSample(ph, [...tilt(f), 0, 0, 0], r));
    for (let i = 0; i < 30; i++) S.push(synthSample(ph, [5 * gauss(r), 5 * gauss(r), 5 * gauss(r), 80, 0, 0], r)); }
  const R = await run(ph, S, 'tilted 2°');
  const errX = R.g.acc[0].bias - ph.axes[0].bias;
  check(Math.abs(Math.abs(errX) - G0 * Math.sin(t)) < 0.01 * G0 * Math.sin(t) + 0.003 * 2, `tilt shows up as x offset error ${errX.toFixed(3)} ≈ g·sin2° = ${(G0 * Math.sin(t)).toFixed(3)}`);
}

// screenshots
for (const [W, scheme] of [[1200, 'light'], [1200, 'dark'], [390, 'dark'], [390, 'light']]) {
  const p = await b.newPage({ viewport: { width: W, height: 900 }, colorScheme: scheme }); const errs = pageErrors(p);
  await p.goto(PAGE); await p.click('#cap-start');
  const ph = makeSynth(21); await dispatch(p, synthScript(ph, 4, 90, FACES.slice(0, 5))); await sleep(150);
  await (await p.$('#grav')).screenshot({ path: `${OUT}/fp-grav-${W}-${scheme}.png` });
  const sw = await p.evaluate(() => document.documentElement.scrollWidth);
  check(errs.length === 0 && sw === W, `${W} ${scheme}: no errors, no horizontal scroll (sw ${sw})`);
  await p.close();
}
await b.close();
console.log(fails.length ? `${fails.length} FAILED` : 'all passed');
process.exit(fails.length ? 1 : 0);
