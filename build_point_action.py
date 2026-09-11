"""Package an independent pointing action from approved, unchanged wave poses.

No new artwork, layer deformation, interpolation, or PNG masters are overwritten.
The Mini Program references these same poses in its already-published wave atlas.
"""
import json
import hashlib
from pathlib import Path
from PIL import Image, ImageDraw
from build_runtime_assets import build

ROOT = Path(__file__).resolve().parent
OUT = ROOT / 'assets'
source = json.loads((OUT/'pipi-wave-smooth.json').read_text(encoding='utf-8'))
png = OUT/source['image']
digest = hashlib.sha256(png.read_bytes()).hexdigest()
original = Image.open(png).convert('RGBA')
order = list(range(19)) + list(range(17,-1,-1))
durations = [60] + [40]*17 + [1800] + [40]*17 + [80]
w,h = source['frameWidth'],source['frameHeight']
strip = Image.new('RGBA',(w*len(order),h))
tiles = []
for i,f in enumerate(order):
    tile = original.crop((f*w,0,(f+1)*w,h))
    tiles.append(tile)
    strip.paste(tile,(i*w,0))
strip.save(OUT/'pipi-point-left.png',optimize=True)
bounds = Image.new('RGBA',(w,h))
for tile in tiles: bounds.alpha_composite(tile)
meta = {k:source[k] for k in ['frameWidth','frameHeight','anchor','subjectHeight']}
meta.update(version=1,id='point',label='单翅指字 · 展开、停留、收回',
    image='pipi-point-left.png',frameCount=len(order),columns=len(order),
    bounds=list(bounds.getbbox()),durationMs=sum(durations),frameDurationsMs=durations,
    frames=[{'x':i*w,'y':0,'w':w,'h':h,'durationMs':t} for i,t in enumerate(durations)],
    restPose={**source['restPose'],'frames':[0,len(order)-1]},
    phases=[{'name':'展开单翅','first':0,'last':17},
            {'name':'保持指向','first':18,'last':18},
            {'name':'收回原位','first':19,'last':36}],
    pointing={'side':'screen-left','holdFrame':18,'openMs':740,'closeMs':760,
              'holdMs':1800,'suggestedWingTip':{'x':60,'y':255}},
    reuse={'sourceImage':source['image'],'sourceVersion':source['version'],
           'sourceSha256':digest,'sourceFrames':order,
           'description':'复用已确认的生成素材完整帧，停止在横向展开姿态；没有重新绘制角色。'})
(OUT/'pipi-point-left.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2),encoding='utf-8')
r=build(meta,'point')
(OUT/'pipi-point-assets.js').write_text('window.PIPI_POINT = '+json.dumps(meta,ensure_ascii=False)+';\n'
    +'window.PIPI_RUNTIME = {assets:{'+json.dumps(meta['image'])+':'+json.dumps(r,ensure_ascii=False)+'}};\n',encoding='utf-8')
decoded=Image.open(OUT/meta['image']).convert('RGBA')
for i,f in enumerate(order):
    assert decoded.crop((i*w,0,(i+1)*w,h)).tobytes()==tiles[i].tobytes()
assert tiles[0].tobytes()==tiles[-1].tobytes()
assert hashlib.sha256(png.read_bytes()).hexdigest()==digest
report={'result':'PASS','frames':len(order),'uniqueFrames':r['uniqueFrameCount'],
        'durationMs':sum(durations),'sourceFramesUnchanged':True,'neutralEndpointsExact':True,
        'runtimeBytes':r['runtimeBytes'],'miniprogramLeftArtworkAdditionalPngBytes':0}
(OUT/'pipi-point-validation.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
preview=Image.new('RGB',(6*240,4*280),'#eaf8ee');draw=ImageDraw.Draw(preview)
for n,i in enumerate([0,3,6,9,12,15,18,21,24,27,30,36]):
    small=tiles[i].resize((240,256),Image.Resampling.LANCZOS)
    x,y=(n%6)*240,(n//6)*280
    preview.paste(small,(x,y+20),small);draw.text((x+8,y+6),str(i+1),fill='#345745')
preview.crop((0,0,1440,560)).save(OUT/'pipi-point-check.jpg',quality=92)
print(json.dumps(report,indent=2))
