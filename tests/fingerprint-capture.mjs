// Step 1: capture. node tests/fingerprint-capture.mjs  (screenshots → tests/out/)
// Headless Chromium has no motion sensor: it answers with empty readings, which is the desktop case.
// Everything else is synthetic DeviceMotionEvents dispatched into the page.
import { chromium, PAGE, OUT, makeSynth, synthSample, synthScript, dispatch, pageErrors, sleep, rng, G0 } from './fingerprint-lib.mjs';
const b = await chromium.launch();
const fails = [];
const check = (ok, msg) => { if (!ok) fails.push(msg); console.log((ok ? 'ok   ' : 'FAIL ') + msg); };

// layout in both themes
for (const [W, scheme] of [[1200, 'light'], [1200, 'dark'], [390, 'dark'], [390, 'light']]) {
  const p = await b.newPage({ viewport: { width: W, height: 900 }, colorScheme: scheme });
  const errs = pageErrors(p);
  await p.goto(PAGE);
  await p.click('#cap-start');
  await dispatch(p, synthScript(makeSynth(7), 11, 80));
  await sleep(150);
  await (await p.$('#cap')).screenshot({ path: `${OUT}/fp-cap-${W}-${scheme}.png` });
  const sw = await p.evaluate(() => document.documentElement.scrollWidth);
  console.log(W, scheme, { errs, sw });
  check(errs.length === 0 && sw === W, `${W} ${scheme}: no errors, no horizontal scroll`);
  await p.close();
}

// desktop: no sensor → plain message
{
  const p = await b.newPage(); const errs = pageErrors(p);
  await p.goto(PAGE); await p.click('#cap-start'); await sleep(2300);
  const msg = await p.textContent('#cap-msg');
  check(/No motion sensor reached this page/.test(msg) && /empty readings/.test(msg), 'desktop: says there is no sensor');
  check(/runs on this device/.test(msg), 'says it runs on the device');
  check(errs.length === 0, 'no page errors');
  await p.close();
}

// synthetic sensor: values arrive at full precision, still detector, rate
{
  const p = await b.newPage(); const errs = pageErrors(p);
  await p.goto(PAGE); await p.click('#cap-start');
  const ph = makeSynth(42), r = rng(5);
  const still = []; for (let i = 0; i < 90; i++) still.push(synthSample(ph, [0, 0, G0, 0, 0, 0], r));
  await dispatch(p, still);
  await sleep(100);
  const st1 = await p.textContent('#cap-still'), rate = await p.textContent('#cap-rate'), src = await p.textContent('#cap-src');
  const got = await p.evaluate(() => CAP.samples.slice(-1)[0]);
  check(st1 === 'still', `still after 90 still samples (${st1})`);
  check(rate === '60 Hz', `rate from event interval (${rate})`);
  check(src === 'your sensors', `source shown as sensors (${src})`);
  check(got.every((v, i) => v === still[89][i]), 'last sample stored exactly, all six axes');
  const log = await p.textContent('#cap-log');
  check(log.includes(still[89][2].toPrecision(12)), 'raw log shows 12 significant digits');
  const moving = []; for (let i = 0; i < 10; i++) moving.push(synthSample(ph, [3 * Math.sin(i), 2, G0 + 4 * Math.cos(i), 60, 10, -30], r));
  await dispatch(p, moving); await sleep(100);
  check(await p.textContent('#cap-still') === 'moving', 'moving when shaken');
  // accelerometer only (some browsers send no rotationRate)
  await dispatch(p, still.slice(0, 40), 1000 / 60, true); await sleep(100);
  check(await p.evaluate(() => CAP.samples.slice(-1)[0][3] === null), 'missing gyro stored as null');
  check(errs.length === 0, 'no page errors');
  await p.close();
}

// iOS 13+: requestPermission granted / denied (mocked)
for (const answer of ['granted', 'denied']) {
  const p = await b.newPage(); const errs = pageErrors(p);
  await p.addInitScript(a => { DeviceMotionEvent.requestPermission = async () => a; }, answer);
  await p.goto(PAGE); await p.click('#cap-start'); await sleep(50);
  const listening = await p.evaluate(() => CAP.listening), msg = await p.textContent('#cap-msg');
  if (answer === 'granted') check(listening && /Listening/.test(msg), 'iOS granted → listening');
  else check(!listening && /wasn't granted/.test(msg), 'iOS denied → explains');
  check(errs.length === 0, 'no page errors');
  await p.close();
}

// simulator
{
  const p = await b.newPage(); const errs = pageErrors(p);
  await p.goto(PAGE); await p.click('#cap-sim'); await sleep(2600);
  const n = await p.evaluate(() => CAP.samples.length), src = await p.textContent('#cap-src');
  check(n === 6 * 90 + 5 * 30 && src === 'simulated', `simulator fed ${n} samples`);
  check(errs.length === 0, 'no page errors');
  await p.close();
}
await b.close();
console.log(fails.length ? `${fails.length} FAILED` : 'all passed');
process.exit(fails.length ? 1 : 0);
