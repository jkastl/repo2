import json, random, subprocess, sys, qrcode
from qrcode.util import QRData, MODE_ALPHA_NUM, MODE_8BIT_BYTE
import os
HERE = os.path.dirname(os.path.abspath(__file__))
SP = os.path.join(HERE, 'out'); os.makedirs(SP, exist_ok=True)
E = {'L': qrcode.constants.ERROR_CORRECT_L, 'M': qrcode.constants.ERROR_CORRECT_M, 'Q': qrcode.constants.ERROR_CORRECT_Q, 'H': qrcode.constants.ERROR_CORRECT_H}
ALNUM = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
cases = []
random.seed(7)
for v in range(1, 11):
    for ecl in 'LMQH':
        for mask in range(8):
            alnum = (v + mask) % 2 == 0
            # fill a good fraction of capacity
            n = random.randint(3, {'L': 40, 'M': 30, 'Q': 22, 'H': 15}[ecl] + 9 * v)
            text = ''.join(random.choice(ALNUM) for _ in range(n)) if alnum else ''.join(random.choice('abcdefgh xyz:é') for _ in range(max(2, n // 2)))
            cases.append(dict(text=text, ecl=ecl, version=v, mask=mask, alnum=alnum))
ok = bad = skip = 0
keep = []
for c in cases:
    q = qrcode.QRCode(version=c['version'], error_correction=E[c['ecl']], mask_pattern=c['mask'], border=0)
    q.add_data(QRData(c['text'].encode('utf-8'), mode=MODE_ALPHA_NUM if c['alnum'] else MODE_8BIT_BYTE))
    try:
        q.make(fit=False)
    except Exception:
        skip += 1; continue
    c['ref'] = [''.join('1' if x else '0' for x in row) for row in q.modules]
    keep.append(c)
json.dump([{k: c[k] for k in ('text', 'ecl', 'version', 'mask')} for c in keep], open(f'{SP}/cases.json', 'w'))
subprocess.run(['node', os.path.join(HERE, 'qrdump.mjs'), f'{SP}/cases.json', f'{SP}/ours.json'], check=True)
ours = json.load(open(f'{SP}/ours.json'))
for c, o in zip(keep, ours):
    if o == c['ref']: ok += 1
    else:
        bad += 1
        if bad <= 3:
            diff = [(r, col) for r in range(len(o)) for col in range(len(o)) if o[r][col] != c['ref'][r][col]]
            print('MISMATCH', c['version'], c['ecl'], c['mask'], 'alnum' if c['alnum'] else 'byte', len(diff), diff[:6])
print(f'{ok} identical, {bad} different, {skip} skipped (text too long for that version)')
