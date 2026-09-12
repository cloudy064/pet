"""Global, offline post-processing for the shipped Pipi runtime and companion frames.

Physical poses are shared across actions; logical frame indices/timing are retained.
Sources are read-only. Output requires the tileRects-aware engine in this repository.
"""
import argparse
import base64
import hashlib
import io
import json
import shutil
import subprocess
import tempfile
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy.spatial import cKDTree

ROOT = Path(__file__).resolve().parents[1]
HEIGHT = 96
CANVAS = (384, 288)
ORIGIN = (192, 192)
PROFILES = {
    'exact': None,
    'balanced': dict(mean=2.0, alpha=1.5, face=1.0, severe=0.015),
    'compact': dict(mean=4.0, alpha=3.0, face=2.0, severe=0.035),
}

# Colour-only error has a separate budget; alpha and pose substitution stay strict.
COLOUR_LIMITS = {
    'exact': None,
    'balanced': dict(mean=4.0, alpha=1.5, face=4.0, severe=0.03),
    'compact': dict(mean=6.0, alpha=3.0, face=6.0, severe=0.06),
}


def write_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, separators=(',', ':')) + '\n')


def sha(data):
    return hashlib.sha256(data).hexdigest()


def load_sources(inputs):
    manifests = []
    for source in inputs:
        path = Path(source).resolve()
        manifest = json.loads((path / 'manifest.json').read_text())
        # The engine actually replaces some atlas actions with embedded startup patches,
        # and creates timed up/down flight aliases. Include those physical images too.
        if path == (ROOT / 'assets/engine').resolve():
            code = "const {AssetManager}=require('./engine/core/assets');const {installPipiAssets}=require('./engine/presets/pipi');const m=new AssetManager({});installPipiAssets(m,'');process.stdout.write(JSON.stringify(m.export()));"
            manifest = json.loads(subprocess.check_output(['node', '-e', code], cwd=ROOT))
        manifests.append((path, manifest))
    return manifests


def protected_frames(aid, asset, actions):
    count = len(asset['frameMap'])
    frames = {0, count - 1, *asset.get('restFrames', [])}
    # Core plan boundaries, including both sides of every release/turn transition.
    if aid.startswith('walk:'):
        frames.update([13, 14, 45, 46])
    elif aid.startswith('flight:'):
        frames.update([0, 10, 16, count - 1])
    elif aid in ('base:wave', 'point:right'):
        frames.update([17, 18, 24, 25, 34, 36])
    for action in actions:
        if action.get('asset') != aid:
            continue
        for stage in action.get('stages', {}).values():
            frames.update([stage[0], stage[-1]])
        frames.update(cue['frame'] for cue in action.get('cues', []))
    return {f for f in frames if 0 <= f < count}


def normalized(image, rect, asset):
    scale = HEIGHT / asset['subjectHeight']
    sx, sy = rect['w'] * scale / image.width, rect['h'] * scale / image.height
    x = ORIGIN[0] + (rect['x'] - asset['anchor']['x']) * scale
    y = ORIGIN[1] + (rect['y'] - asset['anchor']['y']) * scale
    # Pixel-centred affine sampling also preserves fractional anchors.
    im = image.transform(CANVAS, Image.Transform.AFFINE,
                         (1 / sx, 0, -x / sx, 0, 1 / sy, -y / sy),
                         resample=Image.Resampling.BICUBIC)
    a = np.asarray(im).copy()
    a[:, :, :3] = (a[:, :, :3].astype(np.uint16) * a[:, :, 3:] // 255).astype(np.uint8)
    return a


def error_metrics(a, b):
    mask = (a[:, :, 3] > 8) | (b[:, :, 3] > 8)
    if not mask.any():
        return dict(mean=0.0, alpha=0.0, face=0.0, severe=0.0)
    d = np.abs(a.astype(np.int16) - b.astype(np.int16))
    values = d[mask]
    face_mask = mask.copy()
    face_mask[:round(ORIGIN[1] - 1.15 * HEIGHT)] = False
    face_mask[round(ORIGIN[1] - .42 * HEIGHT):] = False
    face_mask[:, :round(ORIGIN[0] - .48 * HEIGHT)] = False
    face_mask[:, round(ORIGIN[0] + .48 * HEIGHT):] = False
    return dict(mean=float(values.mean()), alpha=float(values[:, 3].mean()),
                face=float(d[face_mask].mean()) if face_mask.any() else 0.0,
                severe=float((values.max(1) > 32).mean()))


def extract(manifests):
    records, assets, actions, page_bytes, page_pixels = [], {}, [], {}, {}
    for _, m in manifests:
        actions.extend(m.get('actions', []))
    for directory, manifest in manifests:
        decoded, page_keys = {}, {}
        for aid, asset in manifest['assets'].items():
            if aid in assets:
                raise ValueError('Duplicate asset id across inputs: ' + aid)
            protected = {asset['frameMap'][f] for f in protected_frames(aid, asset, actions)}
            # Mouth/wing patches and independent tiny props are never approximated.
            exact_only = asset.get('patch') or ':prop' in aid or aid in ('base:idle', 'base:talk')
            ids = []
            for ti, (page, x, y, w, h) in enumerate(asset['tiles']):
                file = asset['pages'][page]['file']
                if file not in decoded:
                    if file.startswith('data:image/png;base64,'):
                        data = base64.b64decode(file.split(',', 1)[1])
                    else:
                        p = (directory / file).resolve()
                        if not p.is_relative_to(directory):
                            raise ValueError('Source image outside input directory: ' + file)
                        data = p.read_bytes()
                    meta = asset['pages'][page]
                    if meta.get('md5') and hashlib.md5(data).hexdigest() != meta['md5']:
                        raise ValueError('Source checksum mismatch: ' + aid)
                    image = Image.open(io.BytesIO(data)).convert('RGBA')
                    if image.size != (meta['width'], meta['height']):
                        raise ValueError('Source page dimensions differ: ' + aid)
                    decoded[file] = image
                    key = sha(data)
                    page_keys[file] = key
                    page_bytes[key] = len(data)
                    page_pixels[key] = image.width * image.height
                slot = (page_keys[file],x,y,w,h)
                original = decoded[file].crop((x, y, x + w, y + h))
                c = asset.get('tileRects', [asset['crop']] * len(asset['tiles']))[ti]
                if asset.get('tileSampling'):
                    sample = asset['tileSampling'][ti]
                    r = sample['rect']
                    target = [(c['x']-r['x'])/r['w']*sample['width'], (c['y']-r['y'])/r['h']*sample['height'],
                              c['w']/r['w']*sample['width'], c['h']/r['h']*sample['height']]
                    if any(abs(v-round(v))>1e-6 for v in target) or [round(v) for v in target[2:]] != [w,h]:
                        raise ValueError('Input sampling requires resampling; bake it before exact optimization')
                    full = Image.new('RGBA',(sample['width'],sample['height']))
                    full.paste(original,tuple(round(v) for v in target[:2]))
                    original, w, h, c = full, full.width, full.height, r
                box = original.getbbox()
                if box:
                    box = (max(0, box[0] - 2), max(0, box[1] - 2), min(w, box[2] + 2), min(h, box[3] + 2))
                else:
                    box = (0, 0, 1, 1)
                im = original.crop(box)
                pixels = np.asarray(im).copy()
                pixels[pixels[:, :, 3] == 0] = 0
                im = Image.fromarray(pixels)
                rect = dict(x=c['x'] + box[0] * c['w'] / w, y=c['y'] + box[1] * c['h'] / h,
                            w=im.width * c['w'] / w, h=im.height * c['h'] / h)
                rid = len(records)
                records.append(dict(id=rid, aid=aid, tile=ti, image=im, rect=rect, asset=asset,
                                    originalSlot=slot,
                                    pixelKey=f'{im.width}x{im.height}:' + sha(pixels.tobytes()),
                                    protected=ti in protected or bool(exact_only), original=original, box=box, samplingRect=c.copy()))
                ids.append(rid)
            assets[aid] = dict(source=asset, records=ids)
    return records, assets, actions, dict(pngBytes=sum(page_bytes.values()), pages=len(page_bytes),
        decodedBytes=sum(page_pixels.values()) * 4,
        logicalFrames=sum(len(a['source']['frameMap']) for a in assets.values()),
        physicalTiles=len({r['originalSlot'] for r in records}), tileReferences=len(records), uniquePixels=len({r['pixelKey'] for r in records}))


def cluster(records, profile):
    for r in records:
        r['representative'] = r['id']
        r['error'] = dict(mean=0., alpha=0., face=0., severe=0.)
    if profile == 'exact':
        return
    print('Comparing poses globally at a common body scale...', flush=True)
    analysis = [normalized(r['image'], r['rect'], r['asset']) for r in records]
    descriptors = np.stack([np.asarray(Image.fromarray(a).resize((24, 18), Image.Resampling.BOX),
                                      dtype=np.float32).ravel() for a in analysis])
    neighbours = cKDTree(descriptors).query(descriptors, k=min(24, len(records)))[1]
    counts = Counter(r['pixelKey'] for r in records)
    order = sorted(range(len(records)), key=lambda i: (not records[i]['protected'], -counts[records[i]['pixelKey']], i))
    retained = set()
    limits = PROFILES[profile]
    for i in order:
        r = records[i]
        if not r['protected']:
            for j in np.atleast_1d(neighbours[i]):
                j = int(j)
                if j not in retained or bool(records[j]['asset'].get('patch')) != bool(r['asset'].get('patch')):
                    continue
                metrics = error_metrics(analysis[i], analysis[j])
                if all(metrics[k] <= limits[k] for k in limits):
                    r['representative'], r['error'] = j, metrics
                    break
        if r['representative'] == i:
            retained.add(i)
    # Keep visual diagnostics small; no analysis bitmaps are needed during packing.


def rect_for(source, representative):
    if source['id'] == representative['id']:
        return source['rect'].copy()
    a, b = source['asset'], representative['asset']
    r, scale = representative['rect'], a['subjectHeight'] / b['subjectHeight']
    return dict(x=a['anchor']['x'] + (r['x'] - b['anchor']['x']) * scale,
                y=a['anchor']['y'] + (r['y'] - b['anchor']['y']) * scale,
                w=r['w'] * scale, h=r['h'] * scale)


def sampling_for(source, representative):
    a, b = source['asset'], representative['asset']
    if source['id'] == representative['id']:
        return dict(width=representative['original'].width, height=representative['original'].height, rect=representative['samplingRect'].copy())
    r, scale = representative['samplingRect'], a['subjectHeight'] / b['subjectHeight']
    return dict(width=representative['original'].width, height=representative['original'].height,
                rect=dict(x=a['anchor']['x'] + (r['x'] - b['anchor']['x']) * scale,
                          y=a['anchor']['y'] + (r['y'] - b['anchor']['y']) * scale,
                          w=r['w'] * scale, h=r['h'] * scale))


def pack_group(items, max_side):
    # Deterministic shelves, within identical consumer sets: no action downloads another
    # action's private poses, and shared poses remain a single physical copy.
    pages = []
    for key, im in sorted(items, key=lambda item: (-item[1].height, -item[1].width, item[0])):
        w, h = im.width + 2, im.height + 2
        if max(w, h) > max_side:
            raise ValueError('Frame exceeds page size; increase --page-size')
        chosen = None
        for page in pages:
            for shelf in page['shelves']:
                if h <= shelf['h'] and shelf['x'] + w <= max_side:
                    chosen = (page, shelf)
                    break
            if chosen:
                break
            y = sum(s['h'] for s in page['shelves'])
            if y + h <= max_side:
                shelf = dict(x=0, y=y, h=h)
                page['shelves'].append(shelf)
                chosen = (page, shelf)
                break
        if not chosen:
            shelf = dict(x=0, y=0, h=h)
            page = dict(shelves=[shelf], items=[])
            pages.append(page)
            chosen = (page, shelf)
        page, shelf = chosen
        page['items'].append((key, im, shelf['x'] + 1, shelf['y'] + 1))
        shelf['x'] += w
    return pages


def quantize_global(records, profile):
    """One RGB palette for the whole library, with a per-consumer error fallback.

    Protected poses retain their original pixels. Reusing one palette prevents
    independently quantized actions from acquiring different body colours.
    """
    textures = {records[r['representative']]['pixelKey']: records[r['representative']]['image'] for r in records}
    if profile == 'exact':
        return textures, None, dict(quantizedTextures=0, paletteFallbacks=0)
    consumers = defaultdict(list)
    for r in records:
        consumers[records[r['representative']]['pixelKey']].append(r)
    samples = []
    for im in textures.values():
        a = np.asarray(im).reshape(-1, 4)
        a = a[a[:, 3] > 0]
        samples.append(a[::max(1, len(a)//2048)][:2048])
    sample = np.concatenate(samples + [np.zeros((1024,4), dtype=np.uint8)])
    # Quantize RGB globally but preserve every alpha value. A small RGBA palette
    # spends most entries on edge opacity and damages eyes/feathers unnecessarily.
    rgb = sample[:, :3]
    buckets = 4 if profile == 'balanced' else 1
    luminance = rgb @ np.array([.2126,.7152,.0722])
    cuts = np.quantile(luminance, np.arange(1,buckets)/buckets)
    labels = np.searchsorted(cuts,luminance)
    palettes = []
    for bucket in range(buckets):
        colours = rgb[labels==bucket]
        if not len(colours): continue
        length = int(np.ceil(len(colours)/1024))*1024
        training = np.empty((length,3),dtype=np.uint8)
        training[:len(colours)] = colours
        training[len(colours):] = colours[-1]
        image = Image.fromarray(training.reshape(-1,1024,3)).quantize(colors=256,method=Image.Quantize.MEDIANCUT)
        palettes.append(np.asarray(image.getpalette(),dtype=np.uint8).reshape(-1,3))
    palette = np.unique(np.concatenate(palettes),axis=0)
    tree = cKDTree(palette.astype(np.float32))
    changed, fallbacks = 0, 0
    for key, original in list(textures.items()):
        if any(r['protected'] for r in consumers[key]):
            continue
        a = np.asarray(original).copy()
        indices = tree.query(a[:,:,:3].reshape(-1,3))[1]
        a[:,:,:3] = palette[indices].reshape(original.height,original.width,3)
        a[a[:,:,3]==0] = 0
        quantized = Image.fromarray(a)
        ok = True
        for r in consumers[key]:
            rep = records[r['representative']]
            metrics = error_metrics(normalized(r['image'],r['rect'],r['asset']),
                                    normalized(quantized,rep['rect'],rep['asset']))
            if any(metrics[k] > COLOUR_LIMITS[profile][k] for k in metrics):
                ok = False
                break
        if ok:
            textures[key] = quantized
            changed += 1
        else:
            fallbacks += 1
    return textures, palette, dict(quantizedTextures=changed, paletteFallbacks=fallbacks, paletteColours=len(palette))


def pack(records, output, page_size, textures, palette, layout='paged'):
    pixels, owners = {}, defaultdict(set)
    for r in records:
        rep = records[r['representative']]
        pixels[rep['pixelKey']] = textures[rep['pixelKey']]
        owners[rep['pixelKey']].add(r['aid'])
    groups = defaultdict(list)
    for key, im in pixels.items():
        groups[() if layout == 'single' else tuple(sorted(owners[key]))].append((key, im))
    if layout == 'single':
        # Find a square bound that fits the whole deduplicated library on one page.
        for side in range(1024, 16385, 256):
            if max(max(im.size)+2 for im in pixels.values()) > side:
                continue
            if sum((im.width+2)*(im.height+2) for im in pixels.values()) > side*side:
                continue
            if len(pack_group(groups[()], side)) == 1:
                page_size = side
                break
        else:
            raise ValueError('Single atlas exceeds 16384px; use --layout paged')
    locations, pages = {}, {}
    for group in sorted(groups):
        for packed in pack_group(groups[group], page_size):
            width = max(x + im.width + 1 for _, im, x, _ in packed['items'])
            height = max(y + im.height + 1 for _, im, _, y in packed['items'])
            sheet = Image.new('RGBA', (width, height))
            for key, im, x, y in packed['items']:
                sheet.paste(im, (x, y))
            buffer = io.BytesIO()
            if palette is not None and layout != 'single':
                rgba = np.asarray(sheet)
                values, inverse = np.unique(rgba.view('<u4').reshape(-1), return_inverse=True)
                colours = values.view(np.uint8).reshape(-1,4)
                if len(colours) <= 256:
                    indexed = Image.fromarray(inverse.astype(np.uint8).reshape(height,width), mode='P')
                    rgb = np.zeros((256,3),dtype=np.uint8); rgb[:len(colours)] = colours[:,:3]
                    alpha = np.zeros(256,dtype=np.uint8); alpha[:len(colours)] = colours[:,3]
                    indexed.putpalette(rgb.tobytes())
                    indexed.info['transparency'] = alpha.tobytes()
                    sheet = indexed
            sheet.save(buffer, format='PNG', optimize=True, compress_level=9)
            data = buffer.getvalue()
            md5 = hashlib.md5(data).hexdigest()
            name = 'atlas-' + md5[:20] + '.png'
            (output / name).write_bytes(data)
            pages[name] = dict(file=name, width=width, height=height, md5=md5, bytes=len(data))
            for key, im, x, y in packed['items']:
                locations[key] = (name, x, y, im.width, im.height)
    return locations, pages, owners


def build_manifest(assets, records, actions, locations, pages):
    result = dict(version=1, assets={}, actions=actions)
    for aid, item in assets.items():
        asset = dict(item['source'])
        tile_map, local, rectangles, sampling, files, mapping = {}, [], [], [], [], []
        for rid in item['records']:
            source, rep = records[rid], records[records[rid]['representative']]
            file, x, y, w, h = locations[rep['pixelKey']]
            rect = rect_for(source, rep)
            sample = sampling_for(source, rep)
            signature = (file, x, y, w, h, *rect.values(), sample['width'],sample['height'],*sample['rect'].values())
            if signature not in tile_map:
                if file not in files:
                    files.append(file)
                tile_map[signature] = len(local)
                local.append([files.index(file), x, y, w, h])
                rectangles.append(rect)
                sampling.append(sample)
            mapping.append(tile_map[signature])
        asset.update(pages=[pages[f] for f in files], tiles=local, tileRects=rectangles, tileSampling=sampling,
                     frameMap=[mapping[t] for t in asset['frameMap']])
        c = asset['crop']
        left = min([c['x']] + [r['x'] for r in rectangles])
        top = min([c['y']] + [r['y'] for r in rectangles])
        right = max([c['x'] + c['w']] + [r['x'] + r['w'] for r in rectangles])
        bottom = max([c['y'] + c['h']] + [r['y'] + r['h'] for r in rectangles])
        asset['crop'] = dict(x=left, y=top, w=right-left, h=bottom-top)
        result['assets'][aid] = asset
    return result


def verify(manifest, records, assets, output, profile, textures):
    decoded = {}
    max_error = dict(mean=0., alpha=0., face=0., severe=0.)
    for aid, item in assets.items():
        a, original = manifest['assets'][aid], item['source']
        for key in ['durations', 'anchor', 'subjectHeight', 'restFrames', 'patch']:
            assert a.get(key) == original.get(key), (aid, key)
        assert len(a['frameMap']) == len(original['frameMap'])
        for logical, old_tile in enumerate(original['frameMap']):
            source = records[item['records'][old_tile]]
            rep = records[source['representative']]
            tile = a['frameMap'][logical]
            page, x, y, w, h = a['tiles'][tile]
            file = a['pages'][page]['file']
            if file not in decoded:
                decoded[file] = Image.open(output / file).convert('RGBA')
            restored = decoded[file].crop((x, y, x+w, y+h))
            assert restored.tobytes() == textures[rep['pixelKey']].tobytes(), (aid, logical, 'packing')
            assert a['tileRects'][tile] == rect_for(source, rep)
            assert a['tileSampling'][tile] == sampling_for(source, rep)
            if source['protected'] or profile == 'exact':
                assert source['representative'] == source['id'], (aid, logical, 'protected')
                reconstructed = Image.new('RGBA', source['original'].size)
                reconstructed.paste(restored, source['box'][:2])
                expected = np.asarray(source['original']).copy()
                expected[expected[:, :, 3] == 0] = 0
                assert np.array_equal(np.asarray(reconstructed), expected), (aid, logical, 'exact')
            else:
                metrics = error_metrics(normalized(source['image'], source['rect'], source['asset']),
                                        normalized(restored, a['tileRects'][tile], a))
                assert all(metrics[k] <= COLOUR_LIMITS[profile][k] + 1e-6 for k in metrics), (aid, logical, metrics)
                source['finalError'] = metrics
                for key in metrics:
                    max_error[key] = max(max_error[key], metrics[key])
    return dict(logicalFramesChecked=sum(len(a['frameMap']) for a in manifest['assets'].values()),
                protectedTilesChecked=sum(bool(r['protected']) for r in records),
                packingExact=True, timingAndIndicesUnchanged=True, maxVisualError=max_error,
                measurement='Premultiplied RGBA on occupied pixels at 96px body height; not a perceptual guarantee at all sizes')


def contact_sheet(records, output, textures):
    changed = sorted((r for r in records if r.get('finalError', {}).get('mean',0)>0), key=lambda r: -r['finalError']['mean'])[:12]
    if not changed:
        return
    sheet = Image.new('RGB', (800, len(changed)*150), '#e5e9ed')
    draw = ImageDraw.Draw(sheet)
    for row, r in enumerate(changed):
        for col, item in enumerate([r, records[r['representative']]]):
            im = textures[item['pixelKey']] if col else item['image']
            normalized_im = Image.fromarray(normalized(im, item['rect'], item['asset']))
            # Premultiplied on black makes silhouette differences visible without alpha halos.
            thumb = normalized_im.convert('RGB').crop((80, 65, 304, 215)).resize((224,150))
            sheet.paste(thumb, (col*400, row*150))
            draw.text((col*400+225,row*150+12), item['aid']+' #'+str(item['tile']), fill='black')
        draw.text((630,row*150+50), 'MAE %.3f' % r['finalError']['mean'], fill='black')
    sheet.save(output/'pose-comparison.jpg', quality=90)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', action='append', dest='inputs', help='Directory containing manifest.json; repeat across packs')
    parser.add_argument('--output', type=Path, default=ROOT/'dist/optimized-assets')
    parser.add_argument('--profile', choices=PROFILES, default='balanced')
    parser.add_argument('--page-size', type=int, default=1024)
    parser.add_argument('--layout', choices=['single', 'paged'], default='single', help='Single image for all actions (default), or demand-loaded pages')
    args = parser.parse_args()
    inputs = args.inputs or [ROOT/'assets/engine', ROOT/'assets/companion']
    out = args.output.resolve()
    if any(out.is_relative_to(Path(p).resolve()) or Path(p).resolve().is_relative_to(out) for p in inputs):
        parser.error('Output must be separate from input directories')
    if out.exists() and any(out.iterdir()):
        try:
            previous = json.loads((out/'optimization-report.json').read_text())
            if previous.get('generator') != 'pipi-global-optimizer-v1':
                raise ValueError()
        except (OSError, ValueError):
            parser.error('Existing output is not owned by this optimizer; choose an empty directory')
    if not 256 <= args.page_size <= 2048:
        parser.error('page-size must be 256–2048')
    out.parent.mkdir(parents=True, exist_ok=True)
    destination = out
    with tempfile.TemporaryDirectory(prefix='.pipi-opt-', dir=out.parent) as temporary:
        out = Path(temporary)/'new'
        out.mkdir()
        build(inputs, args, out)
        backup = Path(temporary)/'previous'
        if destination.exists():
            destination.rename(backup)
        try:
            out.rename(destination)
        except BaseException:
            if backup.exists(): backup.rename(destination)
            raise


def build(inputs, args, out):
    manifests = load_sources(inputs)
    records, assets, actions, before = extract(manifests)
    print('Input:', before, flush=True)
    cluster(records, args.profile)
    print('Building a shared colour palette with bounded-error fallbacks...', flush=True)
    textures, palette, palette_report = quantize_global(records, args.profile)
    print('Palette:', palette_report, flush=True)
    print('Packing shared poses...', flush=True)
    locations, pages, owners = pack(records, out, args.page_size, textures, palette, args.layout)
    manifest = build_manifest(assets, records, actions, locations, pages)
    manifest['layout'] = args.layout
    validation = verify(manifest, records, assets, out, args.profile, textures)
    write_json(out/'manifest.json', manifest)
    validator = "const fs=require('node:fs');const {validateAsset}=require('./engine/core/assets');for(const [id,a] of Object.entries(JSON.parse(fs.readFileSync(process.argv[1])).assets))validateAsset(id,a);"
    subprocess.run(['node','-e',validator,str(out/'manifest.json')],cwd=ROOT,check=True)
    # Pack-specific views refer to the SAME atlas files in this directory.
    for directory, source in manifests:
        view = dict(source)
        view['assets'] = {aid: manifest['assets'][aid] for aid in source['assets']}
        write_json(out/(directory.name+'.json'), view)
        if (directory/'audio').is_dir():
            shutil.copytree(directory/'audio', out/'audio', dirs_exist_ok=True)
    changed = [r for r in records if r['representative'] != r['id']]
    after = dict(pngBytes=sum(p['bytes'] for p in pages.values()), pages=len(pages),
                 decodedBytes=sum(p['width']*p['height']*4 for p in pages.values()),
                 logicalFrames=before['logicalFrames'], physicalTiles=len(locations),
                 maxActionDecodedBytes=max(sum(p['width']*p['height']*4 for p in a['pages']) for a in manifest['assets'].values()))
    report = dict(generator='pipi-global-optimizer-v1', profile=args.profile, layout=args.layout, palette=palette_report, before=before, after=after, limits=COLOUR_LIMITS[args.profile], poseLimits=PROFILES[args.profile],
                  savedPngFraction=1-after['pngBytes']/before['pngBytes'],
                  sharedAcrossActions=sum(len(v)>1 for v in owners.values()),
                  approximateReplacements=len(changed),
                  crossActionApproximateReplacements=sum(r['aid']!=records[r['representative']]['aid'] and
                      r['originalSlot']!=records[r['representative']]['originalSlot'] for r in changed),
                  verification=validation,
                  replacements=[dict(asset=r['aid'],tile=r['tile'],representativeAsset=records[r['representative']]['aid'],
                                     representativeTile=records[r['representative']]['tile'],error=r['error']) for r in changed])
    write_json(out/'optimization-report.json', report)
    contact_sheet(records, out, textures)
    print(json.dumps({k:v for k,v in report.items() if k!='replacements'}, ensure_ascii=False, indent=2), flush=True)


if __name__ == '__main__':
    main()
