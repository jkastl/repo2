// Step 6: write-up and live status. node tests/fingerprint-writeup.mjs
import { chromium, PAGE, ROOT_URL, OUT, makeSynth, synthScript, dispatch, pageErrors, sleep } from './fingerprint-lib.mjs';
const b = await chromium.launch();
const fails = [];
const check = (ok, msg) => { if (!ok) fails.push(msg); console.log((ok ? 'ok   ' : 'FAIL ') + msg); };

// numbers the write-up and Try this quote
check((9.80665 / 0.1).toFixed(2) === '98.07', `0.1 m/s² grid = ${(9.80665 / 0.1).toFixed(4)} counts per g (Try this: 98.07)`);

for (const [W, scheme] of [[1200, 'light'], [390, 'dark'], [390, 'light']]) {
  const p = await b.newPage({ viewport: { width: W, height: 900 }, colorScheme: scheme });
  const errs = pageErrors(p), net = [];
  p.on('request', r => { if (!r.url().startsWith('file:') && !r.url().startsWith('data:')) net.push(r.url()); });
  await p.goto(PAGE);
  // exercise everything: sensors (synthetic), simulator, keep, defenses
  await p.click('#cap-start'); await dispatch(p, synthScript(makeSynth(3), 1, 90)); await sleep(900);
  await p.click('#fp-keep');
  await p.click('#cap-sim'); await sleep(2700);
  await p.click('#def-mode [data-v="round"]'); await sleep(100);
  const per = await p.$$eval('#grid-tab tr', rs => rs.slice(1, 4).map(r => r.children[3].textContent));
  if (W === 1200) check(per.every(x => x === '98.07'), `rounded: counts per g ${per.join(', ')}`);
  await p.click('#def-mode [data-v="none"]'); await sleep(100);
  await p.screenshot({ path: `${OUT}/fp-full-${W}-${scheme}.png`, fullPage: true });
  const sw = await p.evaluate(() => document.documentElement.scrollWidth);
  check(errs.length === 0 && sw === W, `${W} ${scheme}: no errors, no horizontal scroll (sw ${sw}) ${errs.join(' ')}`);
  check(net.length === 0, `${W} ${scheme}: no network requests ${net.join(' ')}`);
  if (W === 1200) {
    const R = await p.evaluate(() => ({
      status: document.querySelector('.status').textContent, cls: document.querySelector('.status').className,
      done: [...document.querySelectorAll('ol.plan > li')].map(l => l.classList.contains('done')),
      tries: document.querySelectorAll('.try li').length, blueprint: !!document.querySelector('.blueprint'),
      deep: !!document.querySelector('.deep'), links: [...document.querySelectorAll('.prose a')].map(a => a.href),
      text: document.body.innerText,
    }));
    check(R.status === 'live' && R.cls.includes('live'), 'header pill: live');
    check(R.done.length === 6 && R.done.every(Boolean), 'all six build-plan items done');
    check(R.tries === 6 && R.deep && !R.blueprint, 'Try this (6), deep cut, no blueprint placeholder');
    check(R.links.includes('https://jkastl.github.io/ride-report/') && R.links.includes('https://jkastl.github.io/scroll-report/'), 'links Ride Report and Scroll Report');
    check(/Everything runs on your device/.test(R.text) && /runs on this device/.test(R.text), 'says it runs on the device');
    check(/None of this has been tried on a real phone yet/.test(R.text), 'says real phones are untested');
    check(/36 steps/.test(R.text) && await p.evaluate(() => FP.WALK_HZ * FP.WALK_S) === 36, 'the walk is 36 steps (1.8/s × 20 s)');
  }
  await p.close();
}
// Try this #6: flat + face down, then flat again with one end lifted 3°: the level-only y offset moves
{
  const { synthSample, rng, gauss, G0 } = await import('./fingerprint-lib.mjs');
  const p = await b.newPage(); await p.goto(PAGE); await p.click('#cap-start');
  const ph = makeSynth(8), r = rng(2), t = 3 * Math.PI / 180, S = [];
  const pose = (v, n) => { for (let i = 0; i < n; i++) S.push(synthSample(ph, [...v, 0, 0, 0], r)); };
  const move = () => { for (let i = 0; i < 30; i++) S.push(synthSample(ph, [5 * gauss(r), 5 * gauss(r), 5 * gauss(r), 90, 0, 0], r)); };
  pose([0, 0, G0], 100); move(); pose([0, 0, -G0], 100); move();
  await dispatch(p, S); await sleep(150);
  const y0 = await p.evaluate(() => [GRAV.acc[1].bias, GRAV.acc[1].how]);
  S.length = 0; move(); pose([0, G0 * Math.sin(t), G0 * Math.cos(t)], 200);
  await dispatch(p, S); await sleep(150);
  const y1 = await p.evaluate(() => [GRAV.acc[1].bias, GRAV.acc[1].how]);
  check(y0[1] === 'level' && y1[1] === 'level' && Math.abs(y1[0] - y0[0]) > 0.1, `lifting one end 3°: y offset (amber) moves ${y0[0].toFixed(3)} → ${y1[0].toFixed(3)} m/s²`);
  await p.close();
}
const p = await b.newPage(); await p.goto(ROOT_URL + 'index.html');
const st = await p.$$eval('.lab-card', cs => cs.map(c => c.querySelector('.st').textContent));
check(st[8] === 'live', `front-page card 09: ${st[8]} (all: ${st.join(' ')})`);
await b.close();
console.log(fails.length ? `${fails.length} FAILED` : 'all passed');
process.exit(fails.length ? 1 : 0);
