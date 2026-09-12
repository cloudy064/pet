"""Compress a single atlas locally with tinyimg, retaining alpha and protected/error-limited tiles."""
import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
LIMITS = dict(mean=3, face=3, alpha=0, severe=.015)
GENERATOR = 'pipi-tinyimg-guarded-v1'
spec = importlib.util.spec_from_file_location('optimizer', ROOT/'scripts/optimize-animation-assets.py')
optimizer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(optimizer)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', type=Path, default=ROOT/'dist/optimized-assets')
    parser.add_argument('--output', type=Path, default=ROOT/'dist/optimized-tinyimg')
    parser.add_argument('--tinyimg', default=os.environ.get('TINYIMG_BIN'))
    args = parser.parse_args()
    source, target = args.input.resolve(), args.output.resolve()
    if source.is_relative_to(target) or target.is_relative_to(source):
        parser.error('Input and output must be separate directories')
    if target.exists() and any(target.iterdir()):
        try:
            marker = json.loads((target/'tinyimg-report.json').read_text())
            assert marker['generator'] == GENERATOR
        except (OSError, ValueError, KeyError, AssertionError):
            parser.error('Output must be empty or owned by this compressor')
    binary = args.tinyimg or shutil.which('tinyimg')
    if not binary:
        sibling = ROOT.parent/'tinypng/dist/static/tinyimg-static'
        if sibling.is_file(): binary = str(sibling)
    if not binary: parser.error('Set TINYIMG_BIN or --tinyimg to your local tinyimg executable')
    manifest = json.loads((source/'manifest.json').read_text())
    pages = {p['file'] for a in manifest['assets'].values() for p in a['pages']}
    if len(pages) != 1: parser.error('Build a single atlas first: npm run build:assets')
    name = pages.pop()
    original_path = (source/name).resolve()
    if not original_path.is_relative_to(source): parser.error('Invalid atlas path')
    data = original_path.read_bytes()
    digest = hashlib.md5(data).hexdigest()
    original = Image.open(original_path).convert('RGBA')
    for asset in manifest['assets'].values():
        for page in asset['pages']:
            if page['md5'] != digest or page['bytes'] != len(data) or original.size != (page['width'],page['height']):
                parser.error('Source atlas metadata mismatch')
    target.parent.mkdir(parents=True,exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='.pipi-tinyimg-',dir=target.parent) as tmp:
        stage = Path(tmp)
        result = subprocess.run([binary,str(original_path),'-o',str(stage/'raw.png'),'--no-dither','--json'],check=True,capture_output=True,text=True)
        raw = json.loads(result.stdout)
        candidate = Image.open(stage/'raw.png').convert('RGBA')
        if candidate.size != original.size: raise ValueError('tinyimg changed atlas dimensions')
        candidate.putalpha(original.getchannel('A'))
        protected, fallback, seen = set(), set(), set()
        for aid, asset in manifest['assets'].items():
            exact = asset.get('patch') or ':prop' in aid or aid in ('base:idle','base:talk')
            frames = optimizer.protected_frames(aid,asset,manifest.get('actions',[]))
            tiles = {asset['frameMap'][f] for f in frames}
            for ti, tile in enumerate(asset['tiles']):
                key = tuple(tile[1:]); seen.add(key)
                if exact or ti in tiles: protected.add(key)
        maximum = {k:0 for k in LIMITS}
        for asset in manifest['assets'].values():
            for ti, tile in enumerate(asset['tiles']):
                x,y,w,h = tile[1:]; key = tuple(tile[1:]); box = (x,y,x+w,y+h)
                if key in protected or key in fallback: continue
                rect = asset['tileRects'][ti]
                error = optimizer.error_metrics(optimizer.normalized(original.crop(box),rect,asset),
                                                optimizer.normalized(candidate.crop(box),rect,asset))
                if any(error[k]>v for k,v in LIMITS.items()): fallback.add(key)
                else:
                    for k in maximum: maximum[k] = max(maximum[k],error[k])
        for x,y,w,h in protected|fallback:
            candidate.paste(original.crop((x,y,x+w,y+h)),(x,y))
        candidate.save(stage/'guarded.png',optimize=True,compress_level=9)
        output_data = (stage/'guarded.png').read_bytes()
        if len(output_data) >= len(data): raise ValueError('No guarded size improvement; source is unchanged')
        md5 = hashlib.md5(output_data).hexdigest()
        output_name = 'atlas-'+md5[:20]+'.png'
        out = stage/'new'; out.mkdir()
        (out/output_name).write_bytes(output_data)
        # Keep the runtime metadata and all subset views in sync with the new hashed image.
        for file in source.glob('*.json'):
            document = json.loads(file.read_text())
            if isinstance(document,dict) and isinstance(document.get('assets'),dict):
                for asset in document['assets'].values():
                    for page in asset['pages']:
                        if page['file'] != name: raise ValueError('Subset references unexpected atlas')
                        page.update(file=output_name,md5=md5,bytes=len(output_data))
                (out/file.name).write_text(json.dumps(document)+'\n')
        if (source/'audio').is_dir(): shutil.copytree(source/'audio',out/'audio')
        report = dict(generator=GENERATOR, sourceMD5=digest, tinyimg=raw,
                      inputBytes=len(data),outputBytes=len(output_data),savingFraction=1-len(output_data)/len(data),
                      alphaExact=True,protectedTiles=len(protected),fallbackTiles=len(fallback),
                      compressedTiles=len(seen-protected-fallback),limits=LIMITS,maxAcceptedError=maximum,
                      measurement='Additional premultiplied RGBA error versus input at 96px body height')
        (out/'tinyimg-report.json').write_text(json.dumps(report,indent=2)+'\n')
        if (source/'optimization-report.json').exists():
            summary=json.loads((source/'optimization-report.json').read_text())
            summary['preCompressionVerification']=summary.pop('verification',None)
            summary['compression']=report
            summary['after']['pngBytes']=len(output_data)
            summary['savedPngFraction']=1-len(output_data)/summary['before']['pngBytes']
            (out/'optimization-report.json').write_text(json.dumps(summary,indent=2)+'\n')
        # Atomic replacement with rollback for subsequent builds.
        backup=stage/'previous'
        if target.exists(): target.rename(backup)
        try: out.rename(target)
        except BaseException:
            if backup.exists(): backup.rename(target)
            raise
        print(json.dumps(report,indent=2))


if __name__ == '__main__': main()
