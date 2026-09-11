"""Bake the idle PNG's own folded wing into a wave with matched resting poses.

All visible neutral pixels come from pipi-idle.png. A small hidden torso patch
comes from an existing raised-pose raster. This script does not draw a character.
"""
from pathlib import Path
import json
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent / 'assets'
idle_image = Image.open(ROOT / 'pipi-idle.png').convert('RGBA')
idle = np.asarray(idle_image).copy()
h, w = idle.shape[:2]

# Trace only the inside edge of the original folded wing. Its outside edge
# retains the source PNG's alpha, including its original individual feathers.
mask_image = Image.new('L', (w, h))
ImageDraw.Draw(mask_image).polygon([
    (0, 400), (105, 400), (120, 407), (125, 422), (125, 440),
    (121, 460), (117, 480), (113, 500), (110, 520), (114, 540),
    (118, 553), (104, 562), (83, 570), (0, 570)
], fill=255)
mask = np.asarray(mask_image.filter(ImageFilter.GaussianBlur(.7))) / 255.0
wing_mask_image = Image.new('L', (w, h))
ImageDraw.Draw(wing_mask_image).polygon([
    (0, 400), (105, 400), (118, 407), (121, 422), (121, 440),
    (117, 460), (113, 480), (109, 500), (106, 520), (110, 540),
    (114, 552), (98, 561), (80, 568), (0, 568)
], fill=255)
wing_mask = np.asarray(wing_mask_image.filter(ImageFilter.GaussianBlur(.65))) / 255.0
wing_data = idle.copy()
wing_data[:, :, 3] = np.uint8(np.round(idle[:, :, 3] * wing_mask))
wing_data[wing_data[:, :, 3] == 0] = 0
Image.fromarray(wing_data).save(ROOT / 'pipi-wave-idle-wing.png')

# Only the region concealed by the folded wing needs an underlying torso.
# Align and reuse the green torso from the already generated raised pose.
raised = np.asarray(Image.open(ROOT / 'pipi-wave-stable.png').crop((15*576, 0, 16*576, 724))).copy()
hsv = cv2.cvtColor(raised[:, :, :3], cv2.COLOR_RGB2HSV)
raised[(hsv[:, :, 0] < 34) | (hsv[:, :, 0] > 86)] = 0
patch = cv2.warpAffine(raised, np.float32([[1, 0, -184], [0, 1.08, 405-395*1.08]]),
                       (w, h), flags=cv2.INTER_CUBIC)
# Match the exposed patch to the original green torso at its inner seam.
# Only this previously hidden area is adjusted; visible original pixels stay put.
correction = np.zeros((h, 3), dtype=np.float32)
for y in range(405, 570):
    cut = np.flatnonzero(mask[y] > .5)
    if not len(cut):
        continue
    seam = int(cut[-1]) + 5
    if idle[y, seam, 3] > 250 and patch[y, seam, 3] > 250:
        correction[y] = idle[y, seam:seam+4, :3].mean(0) - patch[y, seam:seam+4, :3].mean(0)
correction = cv2.GaussianBlur(correction, (1, 9), 2)
patch[:, :, :3] = np.uint8(np.clip(patch[:, :, :3].astype(np.float32) + correction[:, None, :], 0, 255))

def premultiply(rgba):
    result = rgba.astype(np.float32) / 255
    result[:, :, :3] *= result[:, :, 3:4]
    return result

def straight_rgba(premult):
    alpha = np.clip(premult[:, :, 3:4], 0, 1)
    rgb = np.divide(premult[:, :, :3], alpha, out=np.zeros_like(premult[:, :, :3]), where=alpha > 1e-6)
    result = np.uint8(np.clip(np.round(np.concatenate((rgb, alpha), axis=2) * 255), 0, 255))
    result[result[:, :, 3] == 0] = 0
    return result

idle_premult = premultiply(idle)
base = idle_premult * (1-mask[:, :, None]) + premultiply(patch) * mask[:, :, None]
head = np.zeros_like(base)
head[:400] = idle_premult[:400]
base[:400] = 0
Image.fromarray(straight_rgba(base + head)).save(ROOT / 'pipi-wave-idle-body.png')

COUNT, OUT_W, OUT_H = 96, 336, 422
SCALE = OUT_H / h  # 211/362, so both dimensions of the static PNG scale exactly.
IDLE_X = 107
ANCHOR = {'x': IDLE_X + 181*SCALE, 'y': 620*SCALE}
idle_scaled = idle_image.resize((211, OUT_H), Image.Resampling.LANCZOS)
neutral = Image.new('RGBA', (OUT_W, OUT_H))
neutral.paste(idle_scaled, (IDLE_X, 0))
neutral.save(ROOT / 'pipi-wave-neutral-matched.png')
wing = premultiply(wing_data)
shoulder = np.array([105., 411.])
axis = np.array([-22., 153.]); axis /= np.linalg.norm(axis)
across = np.array([-axis[1], axis[0]])

def ease(t):
    return .5 - .5*np.cos(np.pi*t)

def lift_at(t):
    if t < .38:
        return ease(t/.38)
    if t < .67:
        return 1 - .12*np.sin(2*np.pi*((t-.38)/.29))**2
    return 1-ease((t-.67)/.33)

# Work at twice the output size and downsample once, keeping rotation edges smooth.
native_size = (OUT_W*2, OUT_H*2)
source_to_native = np.float32([[SCALE*2, 0, IDLE_X*2], [0, SCALE*2, 0]])
base_native = cv2.warpAffine(base, source_to_native, native_size, flags=cv2.INTER_CUBIC)
head_native = cv2.warpAffine(head, source_to_native, native_size, flags=cv2.INTER_CUBIC)
mask_native = cv2.warpAffine(mask.astype(np.float32), source_to_native, native_size, flags=cv2.INTER_LINEAR)
neutral_data = np.asarray(neutral)
fixed_head = np.zeros((OUT_H, OUT_W), dtype=bool)
fixed_head[:int(400*SCALE)] = neutral_data[:int(400*SCALE), :, 3] == 255
frames, trajectory = [], []
for i in range(COUNT):
    lift = float(lift_at(i/(COUNT-1)))
    theta = np.deg2rad(132*lift)
    unfold = (1+.70*lift)*np.outer(axis, axis) + (1+.55*lift)*np.outer(across, across)
    rotation = np.array([[np.cos(theta), -np.sin(theta)], [np.sin(theta), np.cos(theta)]]) @ unfold
    offset = shoulder - rotation @ shoulder
    matrix = np.column_stack((rotation*SCALE*2, offset*SCALE*2 + [IDLE_X*2, 0])).astype(np.float32)
    moving = np.clip(cv2.warpAffine(wing, matrix, native_size, flags=cv2.INTER_CUBIC), 0, 1)
    composite = moving + base_native*(1-moving[:, :, 3:4])
    composite = head_native + composite*(1-head_native[:, :, 3:4])
    frame = Image.fromarray(straight_rgba(composite)).resize((OUT_W, OUT_H), Image.Resampling.LANCZOS)
    editable = cv2.resize(np.maximum(mask_native, moving[:, :, 3]), (OUT_W, OUT_H), interpolation=cv2.INTER_AREA) > .0001
    editable = cv2.dilate(np.uint8(editable), np.ones((5,5), np.uint8)) > 0
    data = np.asarray(frame).copy()
    data[(~editable) | fixed_head] = neutral_data[(~editable) | fixed_head]
    frame = Image.fromarray(data)
    # Preserve the original static PNG exactly after its documented uniform resize.
    if i in (0, COUNT-1):
        frame = neutral.copy()
    frames.append(frame)
    trajectory.append({'lift':round(lift,8), 'angle':round(132*lift,6)})

sheet = Image.new('RGBA', (OUT_W*COUNT, OUT_H))
boxes = []
for i, frame in enumerate(frames):
    box = frame.getbbox(); boxes.append(box)
    assert min(box[0], box[1], OUT_W-box[2], OUT_H-box[3]) >= 12, (i, box)
    sheet.paste(frame, (i*OUT_W, 0))
sheet.save(ROOT / 'pipi-wave-matched.png')
meta = {
    'version':5, 'id':'wave', 'label':'挥翅打招呼', 'image':'pipi-wave-matched.png',
    'frameWidth':OUT_W, 'frameHeight':OUT_H, 'columns':COUNT, 'frameCount':COUNT,
    'anchor':ANCHOR, 'subjectHeight':548*SCALE,
    'bounds':[min(b[0] for b in boxes), min(b[1] for b in boxes), max(b[2] for b in boxes), max(b[3] for b in boxes)],
    'frameDurationsMs':[1000/60]*COUNT, 'durationMs':1600, 'loop':True,
    'frames':[{'x':i*OUT_W, 'y':0, 'w':OUT_W, 'h':OUT_H, 'durationMs':1000/60} for i in range(COUNT)],
    'restPose':{'image':'pipi-idle.png', 'scale':SCALE, 'x':IDLE_X, 'y':0, 'width':211, 'height':OUT_H, 'frames':[0,COUNT-1]},
    'method':'Original idle raster and its own folded wing; continuous eased wing transform; original static pose at both endpoints. No crossfade.',
    'trajectory':trajectory,
}
(ROOT / 'pipi-wave-matched.json').write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding='utf-8')
contact = Image.new('RGBA', (OUT_W*4, OUT_H*3), '#233c34')
for n, i in enumerate([0,1,3,8,16,24,36,52,68,84,94,95]):
    contact.alpha_composite(frames[i], ((n%4)*OUT_W, (n//4)*OUT_H))
contact.convert('RGB').resize((1200,1130)).save(ROOT / 'pipi-wave-matched-check.jpg')
assert frames[0].tobytes() == neutral.tobytes() == frames[-1].tobytes()
differences = [float(np.abs(premultiply(np.asarray(b))-premultiply(np.asarray(a))).sum()) for a,b in zip(frames,frames[1:])]
validation = {'frameCount':COUNT, 'size':sheet.size, 'bounds':meta['bounds'], 'restPosePixelsMatch':True,
              'uniqueFrames':len({f.tobytes() for f in frames}), 'firstStepDifference':differences[0], 'lastStepDifference':differences[-1],
              'maxStepDifference':max(differences)}
(ROOT / 'pipi-wave-matched-validation.json').write_text(json.dumps(validation,indent=2), encoding='utf-8')
print(json.dumps(validation))
