"""Reproducibly key, register, interpolate and pack the generated companion poses.

User approved local image processing. Originals are never modified. Run with the
versions in requirements-companion-assets.txt. No model/network calls are made.
"""
from pathlib import Path
import argparse
import hashlib
import json
import math
import cv2
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / 'assets/companion'
SIZE = (320, 256)
GROUND = 244
HEIGHT = 216
cv2.setNumThreads(1)


def digest(path, kind='sha256'):
    return hashlib.new(kind, path.read_bytes()).hexdigest()


def key_image(im, checker=False):
    rgb = np.array(im.convert('RGB')).astype(np.float32)
    hi, lo = rgb.max(2), rgb.min(2)
    # Flood only background-connected neutral pixels, preserving white eyes,
    # highlights and the black interior of the beak.
    candidate = hi - lo < 35 if checker else (np.minimum(rgb[:, :, 0], rgb[:, :, 2]) - rgb[:, :, 1] > 65)
    if not checker:
        candidate |= (hi - lo < 16) & (lo > 205)  # white grid lines
    border = np.zeros(candidate.shape, bool)
    border[[0, -1], :] = True
    border[:, [0, -1]] = True
    background = ndi.binary_propagation(border & candidate, mask=candidate)
    foreground = ~background
    labels, _ = ndi.label(foreground)
    sizes = np.bincount(labels.ravel())
    foreground &= sizes[labels] > 70
    # Remove disconnected chroma remnants, including spaces between toes.
    if not checker:
        foreground &= ~(np.minimum(rgb[:, :, 0], rgb[:, :, 2]) - rgb[:, :, 1] > 110)
    solid = ndi.binary_erosion(foreground, iterations=1)
    alpha = ndi.gaussian_filter(foreground.astype(np.float32), .55)
    alpha[~ndi.binary_dilation(foreground)] = 0
    # Replace mixed background-edge RGB with nearby interior colour. Alpha
    # still carries the soft silhouette; no magenta/grey halo on dark ground.
    _, nearest = ndi.distance_transform_edt(~solid, return_indices=True)
    edge = ~solid
    rgb[edge] = rgb[nearest[0][edge], nearest[1][edge]]
    return Image.fromarray(np.dstack([rgb, alpha * 255]).clip(0, 255).astype('uint8'))


def landmarks(im):
    a = np.array(im)
    ys, xs = np.where(a[:, :, 3] > 128)
    # Feet are orange and in the bottom third, excluding the yellow beak.
    foot = (a[:, :, 0] > 165) & (a[:, :, 1] > 65) & (a[:, :, 1] < 210) & (a[:, :, 2] < 85) & (a[:, :, 3] > 180)
    foot[:round(ys.min() + (ys.max()-ys.min())*.77)] = False
    fy, fx = np.where(foot)
    ground = float(np.quantile(fy, .98)) if len(fy) else float(ys.max())
    # Centre from the torso, not a raised wing or the lifted foot.
    green = (a[:, :, 1] > a[:, :, 0]*1.06) & (a[:, :, 1] > a[:, :, 2]*1.3) & (a[:, :, 3] > 180)
    green[:round(ys.min() + (ground-ys.min())*.58)] = False
    green[round(ys.min() + (ground-ys.min())*.88):] = False
    gy, gx = np.where(green)
    center = float(np.median(gx)) if len(gx) else float(np.median(xs))
    return center, ground, float(ys.min())


def connected_grid_poses(raw):
    """Split bath's 16 separate silhouettes, including wings crossing cell boundaries."""
    pixels = np.array(key_image(raw))
    labels, _ = ndi.label(pixels[:, :, 3] > 0)
    sizes = np.bincount(labels.ravel())
    poses = [None] * 16
    for label, box in enumerate(ndi.find_objects(labels), 1):
        if sizes[label] < 1000:
            continue
        y, x = box
        column = int((x.start + x.stop) / 2 * 4 / raw.width)
        row = int((y.start + y.stop) / 2 * 4 / raw.height)
        index = row * 4 + column
        if not 0 <= index < 16 or poses[index] is not None:
            raise ValueError('Ambiguous bath silhouette grid')
        pose = pixels[y, x].copy()
        pose[:, :, 3][labels[y, x] != label] = 0
        poses[index] = Image.fromarray(pose)
    if any(pose is None for pose in poses):
        raise ValueError('Expected 16 complete bath silhouettes')
    return poses


def register(im, scale):
    x, y, _ = landmarks(im)
    # One scale per sequence: preserve crouching, nodding and stretching.
    resized = im.resize((round(im.width*scale), round(im.height*scale)), Image.Resampling.LANCZOS)
    out = Image.new('RGBA', SIZE)
    out.alpha_composite(resized, (round(SIZE[0]/2-x*scale), round(GROUND-y*scale)))
    return out


def neutral():
    im = Image.open(ROOT/'assets/pipi-idle.png').convert('RGBA')
    scale = HEIGHT / 548
    out = Image.new('RGBA', SIZE)
    out.alpha_composite(im.resize((round(im.width*scale), round(im.height*scale)), Image.Resampling.LANCZOS),
                        (round(SIZE[0]/2-181*scale), round(GROUND-620*scale)))
    return out


def between(a, b, t):
    """Motion-compensated tween from ONE endpoint, never crossfade anatomy.

    Occluding wings and closing eyes cannot safely be alpha-blended. Select
    the nearer endpoint and move its pixels toward the other pose instead.
    """
    aa, bb = np.array(a).astype(np.float32)/255, np.array(b).astype(np.float32)/255
    ga = cv2.cvtColor((aa[:, :, :3]*aa[:, :, 3:]*255).astype('uint8'), cv2.COLOR_RGB2GRAY)
    gb = cv2.cvtColor((bb[:, :, :3]*bb[:, :, 3:]*255).astype('uint8'), cv2.COLOR_RGB2GRAY)
    flow = cv2.DISOpticalFlow_create(cv2.DISOPTICAL_FLOW_PRESET_MEDIUM)
    ab, ba = flow.calc(ga, gb, None), flow.calc(gb, ga, None)
    yy, xx = np.mgrid[:SIZE[1], :SIZE[0]].astype(np.float32)
    aa[:, :, :3] *= aa[:, :, 3:]
    bb[:, :, :3] *= bb[:, :, 3:]
    wa = cv2.remap(aa, xx-t*ab[:, :, 0], yy-t*ab[:, :, 1], cv2.INTER_LINEAR)
    wb = cv2.remap(bb, xx-(1-t)*ba[:, :, 0], yy-(1-t)*ba[:, :, 1], cv2.INTER_LINEAR)
    out = wa if t <= .5 else wb
    out[:, :, :3] /= np.maximum(out[:, :, 3:], 1/255)
    return Image.fromarray((out*255).clip(0,255).astype('uint8'))


def write_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2)+'\n')


def split_prop(frame, name, index, count):
    """Separate the generated physical prop from the registered character."""
    pixels = np.array(frame)
    rgb = pixels[:, :, :3].astype(float)
    yy, xx = np.mgrid[:SIZE[1], :SIZE[0]]
    if name == 'beakWipe':
        brown = ((xx < 116) & (yy > 142) & (rgb[:, :, 0] > rgb[:, :, 1]*1.12)
                & (rgb[:, :, 1] > rgb[:, :, 2]*1.15) & (rgb[:, :, 2] > 40) & (pixels[:, :, 3] > 0))
        core = brown & (yy > 180) & (yy < 230)
        labels, _ = ndi.label(core)
        sizes = np.bincount(labels.ravel()); sizes[0] = 0
        core = labels == sizes.argmax() if sizes.max() else np.zeros(core.shape, bool)
        cy, cx = np.where(core)
        mask = np.zeros(brown.shape, bool)
        if len(cx):
            left, right = cx.min()-1, cx.max()+1
            center = round(float(np.median(cx)))
            top = np.where(brown[:, center-1:center+2].any(1))[0].min()-1
            mask = (xx >= left) & (xx <= right) & (yy >= top) & (yy <= GROUND+5)
            # A leaning beak can overlap the post's right upper corner.
            mask &= ~((rgb[:, :, 0] > 200) & (rgb[:, :, 2] < 40))
    elif name == 'eatSeed' and 6 <= index <= 14:
        mask = ((xx > 119) & (xx < 159) & (yy > 129) & (yy < 158)
                & (rgb.max(2)-rgb.min(2) < 45) & (rgb.min(2) > 20) & (rgb.max(2) < 225))
        labels, _ = ndi.label(mask)
        sizes = np.bincount(labels.ravel()); sizes[0] = 0
        mask = labels == sizes.argmax() if sizes.max() > 4 else np.zeros(mask.shape, bool)
    else:
        mask = np.zeros(pixels.shape[:2], bool)
    mask = ndi.binary_dilation(mask) & (pixels[:, :, 3] > 0)
    prop = pixels.copy(); prop[:, :, 3][~mask] = 0
    body = pixels.copy()
    if name == 'beakWipe':
        body[:, :, 3][mask] = 0
        prop[:, :, 3] = (prop[:, :, 3] * min(1, index/3, (count-1-index)/3)).astype('uint8')
    elif mask.any():
        body[:, :, :3] = cv2.inpaint(pixels[:, :, :3], mask.astype('uint8')*255, 3, cv2.INPAINT_TELEA)
    return Image.fromarray(body), Image.fromarray(prop)


def pack(frames, name, crop=None):
    crop = crop or (0, 0, *SIZE)
    cx, cy, width, height = crop
    cols = min(6, 2048//width)
    per_page = cols * min(7, 2048//height)
    tiles=[]; pages=[]
    for page_no,start in enumerate(range(0,len(frames),per_page)):
        group=frames[start:start+per_page];columns=min(cols,len(group));rows=math.ceil(len(group)/columns)
        sheet=Image.new('RGBA',(columns*width,rows*height))
        for n,frame in enumerate(group):
            x=n%columns*width;y=n//columns*height
            sheet.paste(frame.crop((cx,cy,cx+width,cy+height)),(x,y))
            tiles.append([page_no,x,y,width,height])
        path=BASE/'runtime'/f'{name}-{page_no}.png';sheet.save(path,optimize=True)
        pages.append({'file':str(path.relative_to(BASE)),'width':sheet.width,'height':sheet.height,'md5':digest(path,'md5'),'bytes':path.stat().st_size})
    return tiles,pages


def bounds(frames):
    boxes=[frame.getbbox() for frame in frames if frame.getbbox()]
    x=max(0,min(b[0] for b in boxes)-2);y=max(0,min(b[1] for b in boxes)-2)
    right=min(SIZE[0],max(b[2] for b in boxes)+2);bottom=min(SIZE[1],max(b[3] for b in boxes)+2)
    return x,y,right-x,bottom-y


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--action', help='Rebuild one action, retaining the other generated assets')
    args = parser.parse_args()
    for directory in ['runtime', 'masters', 'contacts']:
        (BASE/directory).mkdir(exist_ok=True)
    plan = json.loads((BASE/'source/sequences.json').read_text())
    manifest = {'version':1, 'assets':{}, 'actions':[]}
    audit = {'version':1, 'canvas':list(SIZE), 'subjectHeight':HEIGHT, 'anchor':[160,GROUND], 'actions':[]}
    if args.action:
        if args.action not in [a['id'] for a in plan['actions']]:
            parser.error('Unknown action')
        manifest = json.loads((BASE/'manifest.json').read_text())
        audit = json.loads((BASE/'build.json').read_text())
        manifest['actions'] = [a for a in manifest['actions'] if a['id'] != args.action]
        audit['actions'] = [a for a in audit['actions'] if a['id'] != args.action]
    rest = neutral()
    for action in plan['actions']:
        name = action['id']
        if args.action and name != args.action:
            continue
        raw = Image.open(BASE/'source'/action['source'])
        if name == 'flap':
            # The generated grid is slightly offset from quarter-cell bounds.
            # Detect its full-length white lines before cropping; replace only
            # those lines and their antialias fringe with the key colour.
            pixels = np.array(raw.convert('RGB'))
            white = pixels.min(2) > 200
            rows = ndi.binary_dilation(white.mean(1) > .95, iterations=2)
            columns = ndi.binary_dilation(white.mean(0) > .95, iterations=2)
            pixels[rows, :] = [255, 0, 255]
            pixels[:, columns] = [255, 0, 255]
            raw = Image.fromarray(pixels)
        poses=[]
        if name == 'bath':
            poses = connected_grid_poses(raw)
        else:
            for n in range(16):
                box = (round(n%4*raw.width/4), round(n//4*raw.height/4), round((n%4+1)*raw.width/4), round((n//4+1)*raw.height/4))
                poses.append(key_image(raw.crop(box), name in ['nod','sleep']))
        baseline = poses[15 if name=='standOneFoot' else 0]
        _, foot, top = landmarks(baseline)
        scale = HEIGHT / (foot-top)
        poses = [register(p,scale) for p in poses]
        # Exact existing idle pixels bookend every sequence. All internal
        # key poses remain newly generated anatomy, not transformed idle art.
        ordered = [poses[i] for i in action['order']]
        ordered[0] = ordered[-1] = rest
        frames=[]; durations=[]; mapping=[]
        for n, pose in enumerate(ordered):
            mapping.append(len(frames))
            frames.append(pose)
            duration = action['durations'][n]
            if n+1<len(ordered):
                # 3 subframes at endpoints, 2 elsewhere; durations unchanged.
                divisions = 3 if n in [0,len(ordered)-2] else 2
                durations.append(duration/divisions)
                for part in range(1,divisions):
                    frames.append(between(pose,ordered[n+1],part/divisions))
                    durations.append(duration/divisions)
            else:
                durations.append(duration)
        # Mapping preserves authored phase order (including ping-pong loops).
        stages={}
        for stage, indices in action.get('stages',{}).items():
            if stage == 'close' and name in ['sleep', 'bath', 'flap']:
                indices = list(range(5, indices[0])) + indices
            seq=[]
            for j,n in enumerate(indices):
                seq.append(mapping[n])
                if j+1<len(indices):
                    nxt=indices[j+1]
                    if nxt==n+1:
                        seq.extend(range(mapping[n]+1,mapping[nxt]))
                    elif nxt==n-1:
                        seq.extend(reversed(range(mapping[nxt]+1,mapping[n])))
            # Include the authored transition from open into loop / loop into close.
            if stage=='open':
                seq.extend(range(mapping[indices[-1]]+1,mapping[indices[-1]+1]))
            if stage=='loop' and indices[-1] == indices[0]+1:
                seq.extend(reversed(range(mapping[indices[0]]+1,mapping[indices[-1]])))
            stages[stage]=seq
        props=[]
        if name in ['eatSeed','beakWipe']:
            split=[split_prop(frame,name,n,len(frames)) for n,frame in enumerate(frames)]
            frames=[pair[0] for pair in split];props=[pair[1] for pair in split]
        body_crop=bounds(frames)
        tiles,pages=pack(frames,name,body_crop)
        # Transparent key-pose mother sheet and two-background review sheet.
        master=Image.new('RGBA',(4*SIZE[0],4*SIZE[1]))
        contact=Image.new('RGB',(4*SIZE[0],4*(SIZE[1]+24)))
        draw=ImageDraw.Draw(contact)
        for n,pose in enumerate(poses):
            master.paste(pose,(n%4*SIZE[0],n//4*SIZE[1]))
            x=n%4*SIZE[0];y=n//4*(SIZE[1]+24)
            draw.rectangle((x,y,x+SIZE[0],y+SIZE[1]+24),fill='#fffdf4' if n%2==0 else '#253d34')
            contact.paste(pose,(x,y+24),pose);draw.text((x+8,y+6),f'{name} / source {n}',fill='#777777')
        master.save(BASE/'masters'/f'{name}.png',optimize=True)
        contact.save(BASE/'contacts'/f'{name}.jpg',quality=90)
        asset_id='companion:'+name
        manifest['assets'][asset_id]={'pages':pages,'tiles':tiles,'frameMap':list(range(len(frames))),'durations':durations,
            'anchor':{'x':160,'y':GROUND},'crop':dict(zip(['x','y','w','h'],body_crop)),'subjectHeight':HEIGHT,'restFrames':[0,len(frames)-1]}
        definition={'id':name,'label':action['label'],'type':'staged' if stages else 'clip','asset':asset_id,'allowSpeech':False}
        if stages: definition.update(stages=stages,holdMs=1200)
        if props:
            # Tight prop tiles keep decoded memory small even for sparse tracks.
            crop=bounds(props)
            prop_tiles,prop_pages=pack(props,name+'-prop',crop)
            prop_id=asset_id+':prop'
            manifest['assets'][prop_id]={**manifest['assets'][asset_id], 'pages':prop_pages,'tiles':prop_tiles,
                'crop':dict(zip(['x','y','w','h'],crop)),'restFrames':[]}
            definition.update(type='companionClip',overlays=[prop_id])
            if name == 'eatSeed':
                definition['cues']=[{'name':label,'frame':mapping[n]} for n,label in
                    [(0,'offer'),(3,'seed-at-beak'),(7,'chew'),(11,'satisfied')]]
            pages=pages+prop_pages
            # The separate transparent track is also a reusable master.
            prop_master=Image.new('RGBA',(6*SIZE[0],math.ceil(len(props)/6)*SIZE[1]))
            for n,p in enumerate(props):prop_master.paste(p,(n%6*SIZE[0],n//6*SIZE[1]))
            prop_master.save(BASE/'masters'/f'{name}-prop.png',optimize=True)
        manifest['actions'].append(definition)
        audit['actions'].append({'id':name,'sourceSHA256':digest(BASE/'source'/action['source']),'masterSHA256':digest(BASE/'masters'/f'{name}.png'),
            'frames':len(frames),'keyPoses':16,'scale':scale,'decodedBytes':sum(p['width']*p['height']*4 for p in pages),'pages':[{**p,'sha256':digest(BASE/p['file'])} for p in pages]})
        print(name,len(frames),'frames',flush=True)
    order = {a['id']: i for i, a in enumerate(plan['actions'])}
    manifest['actions'].sort(key=lambda a: order[a['id']])
    audit['actions'].sort(key=lambda a: order[a['id']])
    write_json(BASE/'manifest.json',manifest)
    write_json(BASE/'build.json',audit)

if __name__=='__main__':
    main()
