// Step 4: fingerprint and repeat-capture check. node tests/fingerprint-id.mjs
import { chromium, PAGE, OUT, makeSynth, synthSample, synthScript, dispatch, pageErrors, sleep, rng, G0, FACES } from './fingerprint-lib.mjs';
const b = await chromium.launch();
const fails = [];
const check = (ok, msg) => { if (!ok) fails.push(msg); console.log((ok ? 'ok   ' : 'FAIL ') + msg); };
const p = await b.newPage({ viewport: { width: 1200, height: 900 } }); const errs = pageErrors(p);
await p.goto(PAGE);
const cols = S => [0, 1, 2, 3, 4, 5].map(i => S.map(s => s[i]));
const fpOf = S => p.evaluate(S => FP.fingerprint(FP.gridAll(S)), S);

// numbers the prose quotes
const perAxis = Math.log2(0.02 / 20e-6);
check(Math.round(perAxis) === 10, `log2(2% / 20 ppm) = ${perAxis.toFixed(2)} bits per axis (prose: ≈ 10)`);
const consts = await p.evaluate(() => [FP.FP_BIN, FP.FP_SPREAD]);
check(consts[0] === 20e-6 && consts[1] === 0.02, `page uses 20 ppm slices and a ±1% band (${consts})`);

// 30 phones, two captures each (fresh noise), float64 and float32: same hex, same verdict
const F = [];
for (const f32 of [false, true]) {
  let sameHex = 0, sameVerdict = 0, n = 0, worstRatio = 0;
  for (let seed = 1; seed <= 30; seed++) {
    const ph = makeSynth(seed * 13 + (f32 ? 5000 : 0), { f32 });
    const A = await fpOf(synthScript(ph, seed, 90)), B = await fpOf(synthScript(ph, seed + 999, 90));
    if (!f32) F.push(A);
    n++;
    if (A.ready && B.ready && A.hex === B.hex) sameHex++;
    if ((await p.evaluate(([a, b]) => FP.compareFP(a, b).same, [A, B]))) sameVerdict++;
    A.axes.forEach((ax, k) => worstRatio = Math.max(worstRatio, Math.abs(A.steps[k] / ph.axes[ax].step - 1) / Math.max(A.rel[k], 1e-15)));
    if (seed === 1) console.log(`  e.g. ${A.hex}  ${A.axes.length} axes  ${A.bits.toFixed(1)} bits`);
  }
  check(sameVerdict === n, `${f32 ? 'float32' : 'float64'}: repeat capture says "same phone" ${sameVerdict}/${n}`);
  check(sameHex >= n - 1, `${f32 ? 'float32' : 'float64'}: identical hex ${sameHex}/${n} (a step on a slice boundary may flip one)`);
  if (f32) check(worstRatio < 2.5, `float32: actual step error ≤ ${worstRatio.toFixed(1)} × the reported ± (so the 5× match tolerance covers it)`);
}
// different phones never match
{
  let falseSame = 0, hexCollide = 0, pairs = 0;
  for (let i = 0; i < F.length; i++) for (let j = i + 1; j < F.length; j++) {
    pairs++;
    if (await p.evaluate(([a, b]) => FP.compareFP(a, b).same, [F[i], F[j]])) falseSame++;
    if (F[i].hex === F[j].hex) hexCollide++;
  }
  check(falseSame === 0 && hexCollide === 0, `${pairs} pairs of different phones: ${falseSame} judged same, ${hexCollide} hex collisions`);
}
// all six axes → 6 × log2(1000) ≈ 60 bits
check(Math.round(F[0].bits) === Math.round(6 * perAxis) && Math.round(6 * perAxis) === 60, `six axes: ${F[0].bits.toFixed(2)} bits shown as ≈ 60`);
// one face of float32 data isn't precise enough: no ID yet, asks to turn the phone over
{
  const ph = makeSynth(3, { f32: true }), r = rng(1), S = [];
  for (let i = 0; i < 100; i++) S.push(synthSample(ph, [0, 0, G0, 0, 0, 0], r));
  const A = await fpOf(S);
  check(!A.ready, `float32, one face: not ready (worst ${(A.worst * 1e6).toFixed(2)} ppm, needs ${20 / 8})`);
}

// a drifting offset (like Safari's, per SensorID) blurs the steps to ~10⁻³: no ID, and the page says why
{
  const ph = makeSynth(6, { drift: 0.01 }), A = await fpOf(synthScript(ph, 6, 90));
  check(!A.ready && A.worst > 1e-5, `drifting offset: not ready (steps known to ${(A.worst * 1e6).toFixed(0)} ppm)`);
}
// cross-axis mixing (SensorID's iPhone XS: up to ~0.9%) doesn't disturb the ID
{
  let same = 0;
  for (let seed = 1; seed <= 10; seed++) {
    const ph = makeSynth(seed + 300, { mix: 0.01 }), A = await fpOf(synthScript(ph, seed, 90)), B = await fpOf(synthScript(ph, seed + 1, 90));
    if (A.ready && A.hex === B.hex) same++;
  }
  check(same === 10, `1% cross-axis mixing: same hex on repeat ${same}/10`);
}

// the panel: simulate, keep, same again, another phone
await p.evaluate(() => simulate(4242, true)); await sleep(900);
const hex1 = await p.textContent('#fp-hex');
check(/^[0-9a-f]{4}( [0-9a-f]{4}){3}$/.test(hex1), `panel shows a hex ID (${hex1})`);
check(await p.textContent('#fp-bits') === '≈ 60', 'panel: ≈ 60 bits with six axes');
await p.click('#fp-keep');
await p.evaluate(() => simulate(4242, true)); await sleep(900);
const v1 = await p.textContent('#fp-cmp');
check(/Same phone/.test(v1) && await p.textContent('#fp-hex') === hex1, 'same simulated phone again → "Same phone", same hex');
await (await p.$('#fp')).screenshot({ path: `${OUT}/fp-id-same.png` });
await p.evaluate(() => simulate(777, true)); await sleep(900);
check(/Different phone/.test(await p.textContent('#fp-cmp')), 'another phone → "Different phone"');
await (await p.$('#fp')).screenshot({ path: `${OUT}/fp-id-diff.png` });
// the button path (animated simulator)
await p.click('#fp-same'); await sleep(2800);
check(/Different phone/.test(await p.textContent('#fp-cmp')) && await p.evaluate(() => CAP.simSeed) === 777, '"Same simulated phone again" reruns phone 777');
// a real-sensor capture uses the same code: dispatched events of the kept phone's twin
await p.click('#cap-start');
const ph = makeSynth(55); await dispatch(p, synthScript(ph, 1, 90)); await sleep(900);
await p.click('#fp-keep');
await p.click('#cap-stop'); await p.click('#cap-start');
await dispatch(p, synthScript(ph, 2, 90)); await sleep(900);
check(/Same phone/.test(await p.textContent('#fp-cmp')), 'dispatched events, twice from one synthetic phone → "Same phone"');
check(await p.evaluate(() => !Object.keys(localStorage).length && !Object.keys(sessionStorage).length && !document.cookie), 'nothing stored (no localStorage, sessionStorage or cookies)');

for (const [W, scheme] of [[1200, 'light'], [1200, 'dark'], [390, 'dark'], [390, 'light']]) {
  await p.setViewportSize({ width: W, height: 900 }); await p.emulateMedia({ colorScheme: scheme }); await sleep(300);
  await (await p.$('#fp')).screenshot({ path: `${OUT}/fp-id-${W}-${scheme}.png` });
  const sw = await p.evaluate(() => document.documentElement.scrollWidth);
  check(sw === W, `${W} ${scheme}: no horizontal scroll (sw ${sw})`);
}
check(errs.length === 0, `no page errors ${errs.join(' ')}`);
await b.close();
console.log(fails.length ? `${fails.length} FAILED` : 'all passed');
process.exit(fails.length ? 1 : 0);
