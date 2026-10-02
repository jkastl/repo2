// Run from anywhere: node tests/qrdump-v10.mjs  (screenshots go to tests/out/)
import { mkdirSync as __mk } from 'fs';
const ROOT_URL = new URL('../', import.meta.url).href;
const OUT = new URL('./out/', import.meta.url).pathname; __mk(OUT, { recursive: true });
import fs from 'fs';
const src = fs.readFileSync(new URL('../tearproof/index.html', import.meta.url), 'utf8');
const js = src.split('QR encoder, versions 1–10')[1].split('</script>')[0];
const { QRG } = new Function('/*' + js + '; return { QRG };')();
const A = '0123456789ABCDEFGHJKMNPQRSTVWXYZ', out = [];
for (let i = 0; i < 200; i++) {
  const len = 160 + Math.floor(Math.random() * 48);
  let t = ''; for (let j = 0; j < len; j++) t += A[Math.floor(Math.random() * 32)];
  const r = QRG.encode(t, { ecl: 'Q' });
  out.push({ text: t, version: r.version, mask: r.mask, grid: r.grid.map(row => Array.from(row).join('')) });
}
fs.writeFileSync(process.argv[2], JSON.stringify(out));
