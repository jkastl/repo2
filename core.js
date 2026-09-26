/* Shared plumbing for the exhibit pages: helpers, instrument palette, and a
   visibility-gated animation loop. Loaded before each page's inline exhibit script. */
"use strict";
/* ================================================================
   shared plumbing
   ================================================================ */
const $ = s => document.querySelector(s);
const TAU = Math.PI * 2;
const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
const lerp = (a, b, t) => a + (b - a) * t;
function gauss() {
  let u = 0; while (!u) u = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * Math.random());
}
const COL = {
  bg: '#0b0f14', grid: '#18212c', grid2: '#243140', text: '#8d9db0', bright: '#e8eef5',
  sig: '#6ee7a0', fault: '#ff6b5b', caution: '#ffc861', ir: '#69c9ff', violet: '#b69cff',
};
const MONO = '"SF Mono", SFMono-Regular, ui-monospace, Menlo, Consolas, monospace';

/* size a canvas to its container; aspect = h/w, optionally bounded */
function fit(cv, aspect, minH = 0, maxH = 1e9) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = cv.parentElement.clientWidth;
  const h = Math.round(clamp(w * aspect, minH, maxH));
  cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
  cv.style.height = h + 'px';
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w, h };
}
function font(px, weight = 400) { return `${weight} ${px}px ${MONO}`; }
function fmtPct(x, d = 1) {
  if (x === 0) return '0%';
  if (x < 0.0001) return '1 in ' + Math.round(1 / x).toLocaleString('en-US');
  if (x < 0.01) return (x * 100).toFixed(2) + '%';
  return (x * 100).toFixed(d) + '%';
}
/* pointer position in CSS px relative to a canvas */
function ptr(cv, e) {
  const r = cv.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}
function radioValue(groupEl) {
  const c = groupEl.querySelector('input:checked'); return c ? c.value : null;
}

/* exhibits register tick/resize; only visible ones animate */
const EXHIBITS = [];
function register(el, obj) { obj.el = el; obj.visible = false; EXHIBITS.push(obj); return obj; }
const io = new IntersectionObserver(entries => {
  for (const e of entries) { const x = EXHIBITS.find(o => o.el === e.target); if (x) x.visible = e.isIntersecting; }
}, { rootMargin: '120px 0px' });
let lastT = performance.now();
function frame(t) {
  const dt = Math.min(0.05, (t - lastT) / 1000); lastT = t;
  for (const x of EXHIBITS) if (x.visible && x.tick) x.tick(dt);
  requestAnimationFrame(frame);
}
let resizeTimer = 0, lastW = window.innerWidth;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (window.innerWidth === lastW) return;   // ignore mobile URL-bar height jiggle
    lastW = window.innerWidth;
    for (const x of EXHIBITS) x.resize && x.resize();
  }, 120);
});

// start the shared animation loop; each page registers its exhibit(s) above or below
requestAnimationFrame(frame);
