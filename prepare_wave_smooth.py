"""Retiming and motion-compensated inbetweens of selected generated poses.

No new character drawing: the inputs are the existing generated/stabilized PNG.
Both interpolation directions are warped into correspondence before compositing.
The original abrupt source sequence remains available for comparison.
"""
from pathlib import Path
import json
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent / 'assets'
meta = json.loads((ROOT / 'pipi-wave-stabilized.json').read_text(encoding='utf-8'))
W, H = meta['frameWidth'], meta['frameHeight']
sheet = Image.open(ROOT / meta['image']).convert('RGBA')
source = [np.asarray(sheet.crop((i*W, 0, (i+1)*W, H))).copy() for i in range(meta['frameCount'])]
wing_sheet = Image.open(ROOT / 'pipi-wave-wing-layers.png').convert('RGBA')
wings = [np.asarray(wing_sheet.crop((i*W, 0, (i+1)*W, H))).copy() for i in range(meta['frameCount'])]
base = np.asarray(Image.open(ROOT / 'pipi-wave-fixed-base.png').convert('RGBA')).copy()
yy, xx = np.mgrid[:H, :W].astype(np.float32)
grid = np.dstack((xx, yy))


def premult(data):
    out = data.astype(np.float32) / 255
    out[:, :, :3] *= out[:, :, 3:4]
    return out


def straight(data):
    alpha = np.clip(data[:, :, 3:4], 0, 1)
    rgb = np.divide(data[:, :, :3], alpha, out=np.zeros_like(data[:, :, :3]), where=alpha > 1e-6)
    out = np.uint8(np.clip(np.round(np.concatenate((rgb, alpha), axis=2)*255), 0, 255))
    out[out[:, :, 3] == 0] = 0
    return out


def gray(data):
    p = premult(data)
    rgb = p[:, :, :3] + np.array([.12, .18, .15]) * (1-p[:, :, 3:4])
    luminance = cv2.cvtColor(np.float32(rgb), cv2.COLOR_RGB2GRAY)
    return np.uint8(np.clip((.45*luminance + .55*p[:, :, 3])*255, 0, 255))


def get_flow(a, b):
    dis = cv2.DISOpticalFlow_create(cv2.DISOPTICAL_FLOW_PRESET_MEDIUM)
    dis.setFinestScale(0)
    dis.setGradientDescentIterations(50)
    dis.setVariationalRefinementIterations(15)
    flow = dis.calc(gray(a), gray(b), None)
    return cv2.GaussianBlur(flow, (0,0), 2)


def remap(data, coords):
    return cv2.remap(data, coords[:, :, 0], coords[:, :, 1], cv2.INTER_LINEAR,
                     borderMode=cv2.BORDER_CONSTANT)


def coordinates_at(flow, t):
    # Solve q = p + t*flow(p) for the source coordinate p, instead of sampling
    # the flow at q once (which leaves mismatched feather edges).
    coords = grid - t*flow
    for _ in range(8):
        update = grid - t*remap(flow, coords)
        coords = .25*coords + .75*update
    return coords


def distance_field(data):
    mask = np.uint8(data[:, :, 3] >= 128)
    return cv2.distanceTransform(mask, cv2.DIST_L2, 5) - cv2.distanceTransform(1-mask, cv2.DIST_L2, 5)


flow_cache = {}


def between(a, b, t):
    if t < 1e-7: return source[a].copy()
    if t > 1-1e-7: return source[b].copy()
    inputs = source if 0 in (a,b) else wings
    if (a, b) not in flow_cache:
        forward, backward = get_flow(inputs[a], inputs[b]), get_flow(inputs[b], inputs[a])
        flow_cache[a, b] = forward, backward
        flow_cache[b, a] = backward, forward
        print(f'Registered motion {a} -> {b}', flush=True)
    forward, backward = flow_cache[a, b]
    coords_left, coords_right = coordinates_at(forward, t), coordinates_at(backward, 1-t)
    left = remap(premult(inputs[a]), coords_left)
    right = remap(premult(inputs[b]), coords_right)
    out = straight(left*(1-t) + right*t)
    # Reconstruct one opaque silhouette. An unmatched emerging feather must
    # grow from the boundary, not appear as a translucent second wing.
    sdf_left = remap(distance_field(inputs[a]), coords_left)
    sdf_right = remap(distance_field(inputs[b]), coords_right)
    sdf = sdf_left*(1-t) + sdf_right*t
    out[:, :, 3] = np.uint8(np.clip((sdf+.8)/1.6, 0, 1)*255)
    if inputs is wings:
        static = premult(base)
        out = straight(static + premult(out)*(1-static[:,:,3:4]))
    # Restore the invariant base beyond the union of both moving silhouettes.
    # This is a full-region constraint, not six isolated test patches.
    changed = np.any(source[a] != source[b], axis=2).astype(np.uint8)
    moving = cv2.dilate(changed, np.ones((13, 13), np.uint8)) > 0
    out[~moving] = source[a][~moving]
    for x, y, w, h in meta['stabilization']['fixedRegions'].values():
        out[y:y+h, x:x+w] = source[0][y:y+h, x:x+w]
    out[out[:, :, 3] == 0] = 0
    return out


# Select a coherent unfolding path from the generated artwork. The middle
# section in the previous asset jumped among unrelated high/low fan poses.
# Returning along these same drawings also eliminates the mismatched D poses.
keys = [(0, 0), (4, 4), (7, 7), (10, 12), (13, 14), (16, 18),
        (19, 20), (22, 22), (25, 26), (30, 22), (35, 26),
        (38, 22), (41, 20), (44, 18), (47, 14), (50, 12),
        (53, 7), (56, 4), (60, 0)]
N = 61
frames, provenance = [], []
for i in range(N):
    k = min(next((j for j in range(len(keys)-1) if i <= keys[j+1][0]), len(keys)-2), len(keys)-2)
    start, a = keys[k]
    end, b = keys[k+1]
    t = (i-start)/(end-start)
    # Slow the first separation and final return, while keeping intermediate
    # sections continuous rather than stopping at every source picture.
    if k == 0: t = t*t
    if 25 <= i <= 35: t = t*t*(3-2*t)
    if k == len(keys)-2: t = 1-(1-t)**2
    frame = between(a, b, t)
    opaque_head = (yy<282) & (source[0][:,:,3] == 255)
    frame[opaque_head] = source[0][opaque_head]
    frame[:,331:] = source[0][:,331:]
    frame[280:,254:] = source[0][280:,254:]
    frame[408:] = source[0][408:]
    frame[:112,252:] = source[0][:112,252:]
    # Eye closure and mouth opening are semantic changes, unsuitable for
    # generic optical flow. Copy their complete generated expression poses.
    # Only the surrounding cream skin is feathered; never blend pupils.
    for box, donor in [((187,145,276,258), 26 if 24 <= i <= 37 else (22 if i in (23,38) else 0)),
                       ((250,183,328,277), 26 if 22 <= i <= 38 else (21 if i in (21,39) else (20 if i in (20,40) else (19 if i in (19,41) else 0))))]:
        mask = Image.new('L', (W,H))
        ImageDraw.Draw(mask).rounded_rectangle(box, radius=13, fill=255)
        weight = np.asarray(mask.filter(ImageFilter.GaussianBlur(3)), dtype=np.float32)/255
        weight[weight>.99] = 1
        weight[:,331:] = 0
        weight *= np.minimum(source[0][:,:,3], source[donor][:,:,3])/255
        frame[:,:,:3] = np.uint8(np.round(frame[:,:,:3]*(1-weight[:,:,None])+source[donor][:,:,:3]*weight[:,:,None]))
    # Entire stable face/body, including skin outside expression masks, keeps
    # its existing pixels except for the registered expression windows above.
    frame[280:,254:] = source[0][280:,254:]
    frame[frame[:,:,3]==0] = 0
    if i in (0,N-1): frame = source[0].copy()
    frames.append(frame)
    provenance.append({'frame':i, 'fromSource':a, 'toSource':b, 'fraction':round(t,6)})

out = Image.new('RGBA', (W*N, H))
boxes = []
for i, frame in enumerate(frames):
    im = Image.fromarray(frame)
    boxes.append(im.getbbox())
    out.paste(im, (i*W, 0))
out.save(ROOT / 'pipi-wave-smooth.png')
meta.update(version=8, image='pipi-wave-smooth.png', frameCount=N, columns=N,
            method='Selected generated poses with bidirectional motion-compensated inbetweens; shared unfolding/folding path and immutable body.')
meta['motionReconstruction'] = {'source':'pipi-wave-stabilized.png', 'keyframes':keys, 'frames':provenance}
meta['provenance'] = provenance
meta['phases'] = [
    {'label':'抬翅与展开', 'start':0, 'end':25},
    {'label':'微笑与轻挥', 'start':26, 'end':35},
    {'label':'沿原路径收翅', 'start':36, 'end':60}]
meta['bounds'] = [min(b[0] for b in boxes), min(b[1] for b in boxes), max(b[2] for b in boxes), max(b[3] for b in boxes)]
(ROOT / 'pipi-wave-smooth.json').write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding='utf-8')
contact = Image.new('RGB', (8*240, 8*256), '#dceee6')
draw = ImageDraw.Draw(contact)
for i, frame in enumerate(frames):
    im = Image.fromarray(frame).resize((240,256), Image.Resampling.LANCZOS)
    xy = ((i%8)*240, (i//8)*256)
    contact.paste(im, xy, im)
    draw.text((xy[0]+8, xy[1]+8), str(i), fill='black')
contact.save(ROOT / 'pipi-wave-smooth-check.jpg')
print('Saved candidate', flush=True)
