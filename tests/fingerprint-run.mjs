// The guided run: instructions, the bar pinned to the bottom, automatic stop, and the result summary.
// node tests/fingerprint-run.mjs  (screenshots → tests/out/)
import { chromium, PAGE, OUT, makeSynth, synthSample, synthScript, dispatch, pageErrors, sleep, rng, gauss, G0, FACES } from './fingerprint-lib.mjs';
const b = await chromium.launch();
const fails = [];
const check = (ok, msg) => { if (!ok) fails.push(msg); console.log((ok ? 'ok   ' : 'FAIL ') + msg); };
const pose = (ph, r, f, n = 90) => Array.from({ length: n }, () => synthSample(ph, [...f, 0, 0, 0], r));
const turn = (ph, r) => Array.from({ length: 30 }, () => synthSample(ph, [5 * gauss(r), 5 * gauss(r), 5 * gauss(r), 90, 20, -30], r));
const state = p => p.evaluate(() => ({ now: $('#cap-now').textContent, bar: !$('#runbar').hidden, barTxt: $('#runbar-txt').textContent,
  running: CAP.running, listening: CAP.listening, result: $('#cap-result').hidden ? null : $('#cap-result').textContent, body: document.body.className }));

// a full guided run, poses in the order asked
{
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, colorScheme: 'dark' }); const errs = pageErrors(p);
  await p.goto(PAGE); await p.click('#cap-start');
  let S = await state(p);
  check(S.bar && S.running && /Lay the phone flat/.test(S.now) && /Lay the phone flat/.test(S.barTxt) && S.body === 'running', 'start: bar pinned at the bottom, first instruction in both places');
  const ph = makeSynth(5), r = rng(5), expect = [/flip it face down/, /one long edge/, /other long edge/, /one end/, /other end/, /All six poses done/];
  for (let f = 0; f < 6; f++) {
    await dispatch(p, [...pose(ph, r, FACES[f]), ...turn(ph, r)]); await sleep(50);
    S = await state(p);
    check(expect[f].test(S.now) && S.barTxt.includes(`${f + 1} of 6 poses`), `after pose ${f + 1}: "${S.now}"`);
  }
  await (await p.$('#runbar')).screenshot({ path: `${OUT}/fp-runbar-390.png` });
  const sw = await p.evaluate(() => document.documentElement.scrollWidth);
  check(sw === 390, `390 px with the bar showing: no horizontal scroll (sw ${sw})`);
  await sleep(1300); S = await state(p);
  check(!S.running && !S.listening && !S.bar && S.body === '', 'all six poses: stops by itself about a second later, bar gone');
  check(/^Done\./.test(S.result) && /6 of 6 poses/.test(S.result) && /its own grid/.test(S.result) && /could tell this phone apart/.test(S.result), 'result: own grid, fingerprint, in plain words');
  await (await p.$('#cap')).screenshot({ path: `${OUT}/fp-result-390.png` });
  const n = await p.evaluate(() => CAP.samples.length);
  await dispatch(p, pose(ph, r, FACES[0], 30)); await sleep(50);
  check(await p.evaluate(() => CAP.samples.length) === n, 'after the stop, further sensor events are ignored');
  check(errs.length === 0, `no page errors ${errs.join(' ')}`);
  await p.close();
}
// poses in a different order (face down first): the guide counts faces per axis, not signs
{
  const p = await b.newPage(); await p.goto(PAGE); await p.click('#cap-start');
  const ph = makeSynth(6), r = rng(6);
  await dispatch(p, [...pose(ph, r, FACES[1]), ...turn(ph, r)]); await sleep(50);
  const a = (await state(p)).now;
  await dispatch(p, [...pose(ph, r, FACES[0]), ...turn(ph, r)]); await sleep(50);
  const c = (await state(p)).now;
  check(/flip it face down/.test(a) && /one long edge/.test(c), `face down first: "${a}" then "${c}"`);
  await p.close();
}
// Finish in the bar after one pose; leaving the page; the two-minute cap
{
  const p = await b.newPage({ viewport: { width: 390, height: 844 } }); await p.goto(PAGE); await p.click('#cap-start');
  const ph = makeSynth(7), r = rng(7);
  await dispatch(p, pose(ph, r, FACES[0], 150)); await sleep(50);
  await p.click('#runbar-finish'); let S = await state(p);
  check(!S.running && !S.listening && !S.bar && /^Done\./.test(S.result) && /1 of 6 poses/.test(S.result), 'Finish in the bar: stops and shows the result');
  await p.click('#cap-start');
  await p.evaluate(() => { Object.defineProperty(document, 'visibilityState', { get: () => 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
  S = await state(p);
  check(!S.listening && !S.bar, 'leaving the page before any readings: stops, no result');
  await p.evaluate(() => { Object.defineProperty(document, 'visibilityState', { get: () => 'visible', configurable: true }); });
  await p.click('#cap-start'); await dispatch(p, pose(ph, r, FACES[0], 100)); await sleep(50);
  await p.evaluate(() => { Object.defineProperty(document, 'visibilityState', { get: () => 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
  S = await state(p);
  check(!S.listening && /Stopped when you left the page/.test(S.result), 'leaving the page mid-run: stops and says so');
  await p.close();
  const q = await b.newPage(); await q.clock.install(); await q.goto(PAGE); await q.click('#cap-start');
  await dispatch(q, pose(makeSynth(8), rng(8), FACES[0], 100));
  await q.clock.fastForward(119000); const before = await state(q);
  await q.clock.fastForward(2000); S = await state(q);
  check(before.listening && !S.listening && /Stopped after two minutes/.test(S.result), `still listening at 1:59, stopped at 2:01 with a note${before.listening && !S.listening && /Stopped after two/.test(S.result) ? '' : ' ' + JSON.stringify({ before: before.listening, after: S.listening, result: S.result })}`);
  await q.close();
}
// an iPhone-like capture (accelerometer on the 1/65536 g format, gyroscope noisy): the result says no fingerprint
{
  const p = await b.newPage(); await p.goto(PAGE); await p.click('#cap-start');
  const ph = makeSynth(4, { noiseDefense: true }), r = rng(4), q = 9.80665 / 65536, S0 = [];
  for (const f of FACES) for (const v of [...pose(ph, r, f), ...turn(ph, r)]) S0.push([...v.slice(0, 3).map(x => Math.round(x / q) * q), ...v.slice(3)]);
  await dispatch(p, S0); await sleep(1300);
  const R = (await state(p)).result || '';
  check(/a number format \(steps of 1\/65536 g\)/.test(R) && /Gyroscope: no grid/.test(R) && /No calibration fingerprint reached this page/.test(R), 'iPhone-like run: "number format", "no grid", no fingerprint');
  await p.close();
}
// simulator and desktop
{
  const p = await b.newPage(); await p.goto(PAGE);
  await p.click('#cap-sim'); let S = await state(p);
  check(S.bar && /Simulating/.test(S.barTxt), 'simulator: bar shows while it runs');
  await sleep(2700); S = await state(p);
  check(!S.bar && /^Simulated phone #\d{4}: done\./.test(S.result) && /could tell this phone apart/.test(S.result), 'simulator: result when it ends');
  await p.click('#cap-start'); await sleep(2300); S = await state(p);
  check(!S.bar && !S.running && /No motion sensor reached this page/.test(await p.textContent('#cap-msg')), 'desktop: no sensor, bar gone, says so');
  await p.close();
}
await b.close();
console.log(fails.length ? `${fails.length} FAILED` : 'all passed');
process.exit(fails.length ? 1 : 0);
