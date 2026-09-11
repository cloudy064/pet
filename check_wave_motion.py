"""Measure movement in the exported artwork, alongside player timing checks."""
from pathlib import Path
import hashlib
import json
import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent / 'assets'


def inspect(name):
    meta = json.loads((ROOT / f'pipi-wave-{name}.json').read_text(encoding='utf-8'))
    image = Image.open(ROOT / meta['image']).convert('RGBA')
    w, h, count = meta['frameWidth'], meta['frameHeight'], meta['frameCount']
    frames = [np.asarray(image.crop((i*w,0,(i+1)*w,h))) for i in range(count)]
    centers, tops = [], []
    for frame in frames:
        hsv = cv2.cvtColor(frame[:,:,:3], cv2.COLOR_RGB2HSV)
        blue = (hsv[:,:,0]>84)&(hsv[:,:,0]<126)&(hsv[:,:,1]>135)&(frame[:,:,3]>128)
        blue[:,242:] = False
        y, x = np.where(blue)
        assert len(x)>200, 'Wing is missing'
        centers.append([float(x.mean()), float(y.mean())])
        tops.append(float(np.quantile(y,.02)))
    centers = np.array(centers)
    steps = np.linalg.norm(np.diff(centers,axis=0),axis=1)
    acceleration = np.linalg.norm(np.diff(centers,n=2,axis=0),axis=1)
    return frames, meta, {
        'maxWingCenterStepPx':float(steps.max()),
        'maxWingCenterAccelerationPx':float(acceleration.max()),
        'maxWingTopStepPx':float(np.abs(np.diff(tops)).max()),
        'wingCenters':centers.tolist(),
        'wingTopQuantiles':tops,
    }


old, _, before = inspect('stabilized')
frames, meta, after = inspect('smooth')
assert np.array_equal(frames[0],frames[-1]) and np.array_equal(frames[0],old[0]), 'Neutral endpoints changed'
fixed = {}
for name,(x,y,w,h) in meta['stabilization']['fixedRegions'].items():
    count = max(int(np.any(f[y:y+h,x:x+w]!=frames[0][y:y+h,x:x+w],axis=2).sum()) for f in frames)
    fixed[name] = count
    assert count==0, (name,count)
# Whole torso, opposite wing, feet, and head outside expression windows.
mask = np.zeros(frames[0].shape[:2],bool)
mask[280:,254:] = True
mask[408:] = True
mask[:112,252:] = True
mask[:,331:] = True
mask[:135] |= frames[0][:135,:,3] == 255
assert all(np.array_equal(f[mask],frames[0][mask]) for f in frames), 'Fixed base moved'
boxes = [Image.fromarray(f).getbbox() for f in frames]
margins = [min(b[0] for b in boxes),min(b[1] for b in boxes),480-max(b[2] for b in boxes),512-max(b[3] for b in boxes)]
assert min(margins)>=12, margins
# Guard against the actual previously observed large positional jumps. These
# are motion diagnostics, not a claim that an automatic test judges artistry.
assert after['maxWingCenterStepPx'] < before['maxWingCenterStepPx']*.4
assert after['maxWingCenterAccelerationPx'] < before['maxWingCenterAccelerationPx']*.4
assert after['maxWingTopStepPx'] < before['maxWingTopStepPx']*.5
report = {'frameCount':len(frames),'restEndpointsMatch':True,'fixedRegionChangedPixels':fixed,
          'wholeFixedRegionPixels':int(mask.sum()),'minMargins':margins,
          'before':before,'after':after,
          'method':'Track the visible blue wing centroid and 2nd-percentile upper edge; all distances are in native frame pixels.',
          'limits':'These measurements detect large source-pose jumps. They do not independently certify natural anatomy or every feather detail.',
          'pngSha256':hashlib.sha256((ROOT/meta['image']).read_bytes()).hexdigest()}
(ROOT/'pipi-wave-smooth-validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({k:v for k,v in report.items() if k not in ('before','after')}))
print(json.dumps({'before':{k:v for k,v in before.items() if k.startswith('max')},'after':{k:v for k,v in after.items() if k.startswith('max')}}))
