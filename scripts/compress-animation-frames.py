"""Compress each distinct sprite with local tinyimg; repack by consumers, keeping source files untouched."""
import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import numpy as np
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
GENERATOR='pipi-tinyimg-frames-v1'
spec=importlib.util.spec_from_file_location('optimizer',ROOT/'scripts/optimize-animation-assets.py')
opt=importlib.util.module_from_spec(spec);spec.loader.exec_module(opt)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output',type=Path)
    parser.add_argument('--format',choices=['png','webp'],default='png')
    parser.add_argument('--quality',type=int,default=82)
    parser.add_argument('--webp-layout',choices=['direct','frame-repack'],default='direct')
    parser.add_argument('--tinyimg',default=os.environ.get('TINYIMG_BIN'))
    parser.add_argument('--jobs',type=int,default=4)
    parser.add_argument('--keep-frames',action='store_true',help='Also export individual compressed images and a separate SDK manifest')
    args=parser.parse_args()
    if not 1<=args.jobs<=8: parser.error('jobs must be 1..8')
    if not 0<=args.quality<=100: parser.error('quality must be 0..100')
    target=(args.output or ROOT/('dist/optimized-webp-frames' if args.format=='webp' else 'dist/optimized-tinyimg-frames')).resolve()
    inputs=[ROOT/'assets/engine',ROOT/'assets/companion']
    if any(target.is_relative_to(p) or p.is_relative_to(target) for p in inputs): parser.error('Keep output separate from sources')
    if target.exists() and any(target.iterdir()):
        try: assert json.loads((target/'frame-compression-report.json').read_text())['generator']==GENERATOR
        except (OSError,ValueError,KeyError,AssertionError): parser.error('Output must be empty or owned by this tool')
    binary=args.tinyimg or shutil.which('tinyimg') or str(ROOT.parent/'tinypng/dist/static/tinyimg-static')
    sources=opt.load_sources(inputs)
    # Hash all on-disk source resources before and after; the engine preset is read through its public exporter.
    hashes={p:hashlib.sha256(p.read_bytes()).hexdigest() for folder in inputs for p in folder.rglob('*') if p.is_file()}
    records,assets,actions,before=opt.extract(sources)
    opt.cluster(records,'exact')
    unique={r['pixelKey']:r['image'] for r in records}
    target.parent.mkdir(parents=True,exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='.pipi-frame-',dir=target.parent) as tmp:
        stage=Path(tmp);out=stage/'new';out.mkdir();work=stage/'frames';work.mkdir()
        def compress(item):
            index,(key,image)=item
            src=work/f'{index}.png';dest=work/f'{index}.tiny.{args.format}'
            image.save(src,compress_level=6)
            result=subprocess.run([binary,str(src),'-o',str(dest),'--format',args.format,'--quality',str(args.quality),'--no-dither','--json'],check=True,capture_output=True,text=True)
            metadata=json.loads(result.stdout)
            with Image.open(dest) as decoded: candidate=decoded.convert('RGBA')
            if candidate.size!=image.size: raise ValueError('Frame dimensions changed')
            return key,candidate,src.stat().st_size,dest.stat().st_size,metadata['used_original'],dest
        textures={};compressed_files={};individual_before=individual_after=reused=0
        print(f'Compressing {len(unique)} distinct sprites from {len(assets)} assets with {args.jobs} workers...',flush=True)
        with ThreadPoolExecutor(max_workers=args.jobs) as pool:
            jobs=[pool.submit(compress,item) for item in enumerate(unique.items())]
            for n,job in enumerate(as_completed(jobs),1):
                key,candidate,old,new,unchanged,dest=job.result()
                textures[key]=candidate;compressed_files[key]=dest;individual_before+=old;individual_after+=new;reused+=unchanged
                if n%100==0 or n==len(unique): print(f'Compressed {n}/{len(unique)}',flush=True)
        print('Packing independently compressed frames into small action/shared atlases...',flush=True)
        direct_webp=args.format=='webp' and args.webp_layout=='direct'
        locations,pages,owners=opt.pack(records,out,1024,unique if direct_webp else textures,np.array([0]),layout='paged')
        if args.format=='webp':
            # Direct mode encodes original atlas pixels once; frame-repack preserves decoded frame pixels.
            print('Encoding original pages directly as WebP...' if direct_webp else 'Encoding packed pages as lossless WebP...',flush=True)
            def encode_page(page):
                old=out/page['file'];dest=stage/(page['file']+'.webp')
                subprocess.run([binary,str(old),'-o',str(dest),'--format','webp','--mode','auto' if direct_webp else 'lossless','--quality',str(args.quality),'--json'],check=True,capture_output=True,text=True)
                with Image.open(old) as a, Image.open(dest) as b:
                    assert a.size==b.size,'Page dimensions changed'
                    assert a.convert('RGBA').getchannel('A').tobytes()==b.convert('RGBA').getchannel('A').tobytes(),'WebP alpha changed'
                    if not direct_webp: assert a.convert('RGBA').tobytes()==b.convert('RGBA').tobytes(),'Lossless page pixels changed'
                data=dest.read_bytes();md5=hashlib.md5(data).hexdigest();name='atlas-'+md5[:20]+'.webp'
                (out/name).write_bytes(data)
                return page['file'],dict(page,file=name,md5=md5,bytes=len(data))
            with ThreadPoolExecutor(max_workers=args.jobs) as pool:
                converted=dict(pool.map(encode_page,list(pages.values())))
            locations={key:(converted[value[0]]['file'],*value[1:]) for key,value in locations.items()}
            for name in pages:(out/name).unlink()
            pages={page['file']:page for page in converted.values()}
        manifest=opt.build_manifest(assets,records,actions,locations,pages);manifest['layout']='paged'
        if args.keep_frames:
            individual=out/'individual';individual.mkdir();frame_locations={};frame_pages={}
            for key,image in textures.items():
                data=compressed_files[key].read_bytes();md5=hashlib.md5(data).hexdigest();name='frame-'+md5[:20]+'.'+args.format
                (individual/name).write_bytes(data)
                frame_pages[name]=dict(file=name,width=image.width,height=image.height,md5=md5,bytes=len(data))
                frame_locations[key]=(name,0,0,image.width,image.height)
            frame_manifest=opt.build_manifest(assets,records,actions,frame_locations,frame_pages)
            opt.write_json(individual/'manifest.json',frame_manifest)
        # Decode saved pages and check every logical mapping against its compressed sprite.
        decoded={};rows=[];checked=0;max_error={k:0. for k in ['mean','alpha','face','severe']}
        for aid,item in assets.items():
            a=manifest['assets'][aid];original=item['source'];worst={k:0. for k in max_error}
            for k in ['durations','anchor','subjectHeight','restFrames','patch']:
                assert a.get(k)==original.get(k),(aid,k)
            assert len(a['frameMap'])==len(original['frameMap'])
            for frame,old_tile in enumerate(original['frameMap']):
                r=records[item['records'][old_tile]];ti=a['frameMap'][frame];pi,x,y,w,h=a['tiles'][ti];name=a['pages'][pi]['file']
                if name not in decoded: decoded[name]=Image.open(out/name).convert('RGBA')
                candidate=decoded[name].crop((x,y,x+w,y+h))
                if not direct_webp: assert candidate.tobytes()==textures[r['pixelKey']].tobytes(),(aid,frame)
                assert a['tileRects'][ti]==opt.rect_for(r,r)
                assert a['tileSampling'][ti]==opt.sampling_for(r,r)
                checked+=1
            for rid in item['records']:
                r=records[rid]
                file,x,y,w,h=locations[r['pixelKey']]
                rendered=decoded[file].crop((x,y,x+w,y+h))
                error=opt.error_metrics(opt.normalized(r['image'],r['rect'],r['asset']),
                                        opt.normalized(rendered,r['rect'],r['asset']))
                for k in worst: worst[k]=max(worst[k],error[k]);max_error[k]=max(max_error[k],error[k])
            old_bytes=sum(p.get('bytes',0) for p in original['pages']);new_bytes=sum(p['bytes'] for p in a['pages'])
            rows.append(dict(asset=aid,logicalFrames=len(a['frameMap']),sourceBytes=old_bytes,outputBytes=new_bytes,
                             savingFraction=1-new_bytes/old_bytes if old_bytes else 0,pages=len(a['pages']),maxError=worst))
        opt.write_json(out/'manifest.json',manifest)
        for folder,source in sources:
            view=dict(source);view['layout']='paged';view['assets']={aid:manifest['assets'][aid] for aid in source['assets']}
            opt.write_json(out/(folder.name+'.json'),view)
            if (folder/'audio').is_dir(): shutil.copytree(folder/'audio',out/'audio',dirs_exist_ok=True)
        after=dict(imageBytes=sum(p['bytes'] for p in pages.values()),pages=len(pages),
                   decodedBytes=sum(p['width']*p['height']*4 for p in pages.values()),logicalFrames=checked,physicalTiles=len(locations))
        after['webpBytes' if args.format=='webp' else 'pngBytes']=after['imageBytes']
        assert all(hashlib.sha256(p.read_bytes()).hexdigest()==digest for p,digest in hashes.items()),'Source files changed'
        verification=dict(logicalFramesChecked=checked,packedPixelsMatchCompressedFrames=not direct_webp,timingAndIndicesUnchanged=True,
                          sourceFilesUnchanged=True,alphaExact=args.format=='webp',maxVisualError=max_error,
                          measurement='Premultiplied RGBA versus source at 96px body height; lossy colour, exact WebP alpha')
        report=dict(generator=GENERATOR,mode='tinyimg-webp-direct-atlas' if direct_webp else 'tinyimg-per-frame',format=args.format,quality=args.quality,webpLayout=args.webp_layout if args.format=='webp' else None,before=before,after=after,savedImageFraction=1-after['imageBytes']/before['pngBytes'],
                    compressedUniqueFrames=len(unique),tinyimgKeptOriginal=reused,
                    individualFrameBytes=dict(sourcePng=individual_before,compressed=individual_after),verification=verification,assets=rows)
        if args.format=='png':
            report['savedPngFraction']=report['savedImageFraction']
            report['individualFramePngBytes']=dict(before=individual_before,after=individual_after)
        report['individualFrameDirectory']='individual' if args.keep_frames else None
        opt.write_json(out/'frame-compression-report.json',report)
        # Compatible report for the existing synchronized comparison page.
        opt.write_json(out/'optimization-report.json',{**report,'profile':'webp-direct-atlas' if direct_webp else 'tinyimg-'+args.format+'-per-frame','layout':'paged'})
        lines=['# tinyimg '+args.format+' 逐帧压缩统计','', '原始素材保持不变。以下按资源统计，共享页面在多个资源行中出现，不能直接对行求和。','',
               '| 资源 | 逻辑帧 | 原图 KiB | 压缩后图集 KiB | 减少 |','| --- | ---: | ---: | ---: | ---: |']
        for row in rows:lines.append(f"| {row['asset']} | {row['logicalFrames']} | {row['sourceBytes']/1024:.1f} | {row['outputBytes']/1024:.1f} | {row['savingFraction']:.1%} |")
        (out/'per-action-report.md').write_text('\n'.join(lines)+'\n')
        validator="const fs=require('fs');const {validateAsset}=require('./engine/core/assets');for(const [id,a] of Object.entries(JSON.parse(fs.readFileSync(process.argv[1])).assets))validateAsset(id,a);"
        subprocess.run(['node','-e',validator,str(out/'manifest.json')],cwd=ROOT,check=True)
        backup=stage/'previous'
        if target.exists():target.rename(backup)
        try:out.rename(target)
        except BaseException:
            if backup.exists():backup.rename(target)
            raise
        print(json.dumps({k:v for k,v in report.items() if k!='assets'},indent=2),flush=True)


if __name__=='__main__':main()
