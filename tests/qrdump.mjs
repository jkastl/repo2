// Run from anywhere: node tests/qrdump.mjs  (screenshots go to tests/out/)
import { mkdirSync as __mk } from 'fs';
const ROOT_URL = new URL('../', import.meta.url).href;
const OUT = new URL('./out/', import.meta.url).pathname; __mk(OUT, { recursive: true });
// dump our matrices for a set of cases as JSON
import fs from 'fs';
const src = fs.readFileSync(new URL('../tearproof/index.html', import.meta.url), 'utf8');
const js = src.split('QR encoder, versions 1–10')[1].split('</script>')[0];
const { QRG, TAG } = new Function('/*' + js + '; return { QRG, TAG };')();
const cases = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const out = cases.map(c => { const r = QRG.encode(c.text, { ecl: c.ecl, version: c.version, mask: c.mask }); return r.grid.map(row => Array.from(row).join('')); });
fs.writeFileSync(process.argv[3], JSON.stringify(out));
