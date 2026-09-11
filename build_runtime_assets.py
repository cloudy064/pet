"""Lossless runtime PNGs: one union crop per action, exact frame deduplication.

Masters and their JSONs are read-only. Rebuild after changing any source artwork.
Install the optional optimizer locally with:
python -m pip install --target .tools/pyoxipng pyoxipng==9.1.1
"""
from pathlib import Path
from io import BytesIO
import hashlib
import json
import math
import os
import sys
import time
from PIL import Image
import numpy as np

ROOT = Path(__file__).resolve().parent
ASSETS = ROOT / 'assets'
OUT = ASSETS / 'runtime'
sys.path.insert(0, str(ROOT / '.tools' / 'pyoxipng'))
import oxipng

BASE = ['idle', 'blink-clean', 'wave-smooth', 'wink', 'talk', 'pet', 'jump', 'curious']
sha = lambda data: hashlib.sha256(data).hexdigest()

def read(path):
    return json.loads(path.read_text(encoding='utf-8'))

def atomic(path, data):
    temp = path.with_suffix(path.suffix + '.tmp')
    temp.write_bytes(data)
    temp.replace(path)

def build(meta, group):
    path = ASSETS / meta['image']
    original = path.read_bytes()
    source_hash = sha(original)
    image = Image.open(BytesIO(original)).convert('RGBA')
    w, h, count = meta['frameWidth'], meta['frameHeight'], meta['frameCount']
    assert image.size == (w*count, h), path.name
    frames, hashes, mapping, unique = [], {}, [], []
    left, top, right, bottom = w, h, 0, 0
    for f in meta['frames']:
        tile = image.crop((f['x'], f['y'], f['x']+w, f['y']+h))
        data = tile.tobytes()
        # Include invisible RGB in the union too, so round-trip equality is
        # strict RGBA equality, not merely visual equality on a background.
        ys, xs = np.where(np.asarray(tile).max(axis=2) != 0)
        if len(xs):
            left, top = min(left,int(xs.min())), min(top,int(ys.min()))
            right, bottom = max(right,int(xs.max())+1), max(bottom,int(ys.max())+1)
        digest = sha(data)
        if digest not in hashes:
            hashes[digest] = len(unique)
            unique.append(tile)
        else:
            assert unique[hashes[digest]].tobytes() == data
        frames.append(tile)
        mapping.append(hashes[digest])
    # Eight pixels of filter/feather clearance. Align with the existing 75%
    # preview sampling grid, preserving its pixel phase after cropping.
    left = max(0, math.floor((left-8)/4)*4)
    top = max(0, math.floor((top-8)/4)*4)
    right = min(w, math.ceil((right+8)/4)*4)
    bottom = min(h, math.ceil((bottom+8)/4)*4)
    cw, ch = right-left, bottom-top
    assert cw > 0 and ch > 0
    packed = Image.new('RGBA', (cw*len(unique), ch))
    for index, tile in enumerate(unique):
        packed.paste(tile.crop((left,top,right,bottom)), (index*cw,0))
    buffer = BytesIO()
    packed.save(buffer, format='PNG', optimize=True, compress_level=9)
    unoptimized = buffer.getvalue()
    optimized = oxipng.optimize_from_memory(unoptimized, level=3,
        optimize_alpha=False, strip=oxipng.StripChunks.safe(), timeout=15)
    result = optimized if len(optimized) < len(unoptimized) else unoptimized
    filename = path.stem + '-' + sha(result)[:12] + '.png'
    atomic(OUT / filename, result)
    decoded = Image.open(BytesIO(result)).convert('RGBA')
    assert decoded.size == packed.size
    assert decoded.tobytes() == packed.tobytes(), 'PNG optimizer changed pixels'
    # Reconstruct EVERY logical frame at its original origin and compare all
    # channels, including alpha and transparent RGB. This also tests frameMap.
    for index, tile in enumerate(frames):
        u = mapping[index]
        restored = Image.new('RGBA', (w,h))
        restored.paste(decoded.crop((u*cw,0,(u+1)*cw,ch)), (left,top))
        assert restored.tobytes() == tile.tobytes(), (path.name,index)
    assert sha(path.read_bytes()) == source_hash, 'Master was modified'
    record = {
        'version': 1, 'group': group, 'sourceImage': path.name,
        'sourceVersion': meta.get('version',1), 'sourceSha256': source_hash,
        'sourceFrameWidth': w, 'sourceFrameHeight': h,
        'frameCount': count, 'uniqueFrameCount': len(unique),
        'image': 'runtime/'+filename, 'sha256': sha(result),
        'crop': {'x':left,'y':top,'w':cw,'h':ch},
        'anchor': {'x':meta['anchor']['x']-left,'y':meta['anchor']['y']-top},
        'subjectHeight': meta.get('subjectHeight',548),
        'width': decoded.width, 'height': decoded.height,
        'frameMap': mapping,
        'tiles': [{'x':i*cw,'y':0,'w':cw,'h':ch} for i in range(len(unique))],
        'durationMs': meta['durationMs'], 'frameDurationsMs': meta['frameDurationsMs'],
        'sourceBytes': len(original), 'runtimeBytes': len(result),
        'sourceDecodedBytes': w*h*count*4, 'runtimeDecodedBytes': cw*ch*len(unique)*4,
        'beforeOptimizerBytes': len(unoptimized), 'allFramesExact': True,
    }
    atomic(OUT / (path.stem+'.json'), json.dumps(record,ensure_ascii=False,indent=2).encode('utf-8'))
    print(f'{group}/{meta["id"]}: {count} -> {len(unique)} stored frames; '
          f'{len(original)/2**20:.2f} -> {len(result)/2**20:.2f} MiB; RGBA exact', flush=True)
    return record

def main():
    OUT.mkdir(exist_ok=True)
    groups = {'base':[read(ASSETS/f'pipi-{name}.json') for name in BASE],
        'walk':list(read(ASSETS/'pipi-walk.json')['assets'].values()),
        'flight':list(read(ASSETS/'pipi-flight.json')['assets'].values())}
    entries = {}
    for group, metas in groups.items():
        for meta in metas:
            entries[meta['image']] = build(meta,group)
    fields = ['sourceBytes','runtimeBytes','sourceDecodedBytes','runtimeDecodedBytes',
              'beforeOptimizerBytes','frameCount','uniqueFrameCount']
    totals = {field:sum(m[field] for m in entries.values()) for field in fields}
    totals['fileSavingPercent'] = (1-totals['runtimeBytes']/totals['sourceBytes'])*100
    totals['pixelSavingPercent'] = (1-totals['runtimeDecodedBytes']/totals['sourceDecodedBytes'])*100
    totals['additionalOptimizerSavingPercent'] = (1-totals['runtimeBytes']/totals['beforeOptimizerBytes'])*100
    report = {'version':1,'format':'lossless-png-union-crop-frame-map','assets':entries,
        'totals':totals,'groups':{group:{field:sum(m[field] for m in entries.values() if m['group']==group)
            for field in fields} for group in groups},
        'validation':{'allLogicalFramesExact':True,'mastersUnmodified':True,'framesChecked':totals['frameCount']},
        'optimizer':'pyoxipng 9.1.1, level 3, optimize_alpha=False; smallest of Pillow/oxipng retained'}
    data = json.dumps(report,ensure_ascii=False,indent=2)
    atomic(OUT/'manifest.json',data.encode('utf-8'))
    atomic(ASSETS/'pipi-runtime-assets.js',('window.PIPI_RUNTIME = '+data+';\n').encode('utf-8'))
    print(json.dumps(totals,indent=2),flush=True)

if __name__ == '__main__':
    main()
