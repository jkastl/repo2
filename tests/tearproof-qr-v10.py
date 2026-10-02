"""Large tags (QR versions 9-10): are ours identical to the reference library, and does
OpenCV read them? It misses ~5% of these whoever generated them; that's its detector,
not the tags. Run: python3 tests/tearproof-qr-v10.py  (needs: pip install qrcode opencv-python-headless)"""
import json, os, subprocess, cv2, numpy as np, qrcode
from qrcode.util import QRData, MODE_ALPHA_NUM
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'out'); os.makedirs(OUT, exist_ok=True)
subprocess.run(['node', os.path.join(HERE, 'qrdump-v10.mjs'), f'{OUT}/v10.json'], check=True)
cases = json.load(open(f'{OUT}/v10.json'))
def img(rows, scale=6):
    a = np.array([[0 if ch == '1' else 255 for ch in r] for r in rows], np.uint8)
    return cv2.resize(np.pad(a, 4, constant_values=255), None, fx=scale, fy=scale, interpolation=cv2.INTER_NEAREST)
d = cv2.QRCodeDetector(); same = ours_ok = ref_ok = 0
for c in cases:
    q = qrcode.QRCode(version=c['version'], error_correction=qrcode.constants.ERROR_CORRECT_Q, mask_pattern=c['mask'], border=0)
    q.add_data(QRData(c['text'].encode(), mode=MODE_ALPHA_NUM)); q.make(fit=False)
    ref = [''.join('1' if x else '0' for x in row) for row in q.modules]
    same += ref == c['grid']
    ours_ok += d.detectAndDecode(img(c['grid']))[0] == c['text']; ref_ok += d.detectAndDecode(img(ref))[0] == c['text']
print(f"identical to reference library: {same}/{len(cases)}")
print(f"OpenCV reads ours: {ours_ok}/{len(cases)}, the reference library's: {ref_ok}/{len(cases)}")
raise SystemExit(0 if same == len(cases) else 1)
