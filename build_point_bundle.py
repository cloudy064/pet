"""Build pointing preview assets and a small local Mini Program wing atlas.

Mouths reuse the existing talk atlas; screen-left pointing reuses wave. Only
the new screen-right wing rectangle is packaged, at the same 240 px subject
resolution as the published assets. The new packaged patch uses a 256-color
palette; full-color transparent masters and desktop runtime PNGs are preserved.
"""
from pathlib import Path
import json,sys,hashlib
from io import BytesIO
from PIL import Image
import numpy as np
from build_runtime_assets import build
from quantize_pipi import palette as compact_palette

ROOT=Path(__file__).resolve().parent;A=ROOT/'assets'
APP=Path(r'C:\Users\cloudy064\workspace\aiede\pipi\pipi-wxmp')
read=lambda p:json.loads(p.read_text(encoding='utf-8'))
left=read(A/'pipi-point-left.json');right=read(A/'pipi-point-right.json');talk=read(A/'pipi-talk.json')
runtime=read(A/'runtime/manifest.json')['assets']
records={left['image']:read(A/'runtime/pipi-point-left.json'),right['image']:build(right,'point'),talk['image']:runtime[talk['image']]}
(A/'pipi-point-assets.js').write_text('window.PIPI_POINT = '+json.dumps(left,ensure_ascii=False)+';\n'
    +'window.PIPI_POINTS = '+json.dumps({'left':left,'right':right,'talk':talk},ensure_ascii=False)+';\n'
    +'window.PIPI_RUNTIME = {assets:'+json.dumps(records,ensure_ascii=False)+'};\n',encoding='utf-8')

frames=np.load(A/'pipi-point-right-final.npz')['poses']
rest=frames[0];changed=np.any(frames!=rest,axis=(0,3));ys,xs=np.where(changed)
# Add filter padding and keep integer coordinates in the logical frame.
x,y=max(0,int(xs.min())-4),max(0,int(ys.min())-4)
r,b=min(480,int(xs.max())+5),min(512,int(ys.max())+5)
crop={'x':x,'y':y,'w':r-x,'h':b-y};z=240/right['subjectHeight']
w,h=round((r-x)*z),round((b-y)*z);cols=min(19,2048//w)
atlas=Image.new('RGBA',(cols*w,((19+cols-1)//cols)*h));tiles=[]
for i,a in enumerate(frames):
    tile=Image.fromarray(a).crop((x,y,r,b)).resize((w,h),Image.Resampling.LANCZOS)
    px,py=(i%cols)*w,(i//cols)*h;atlas.paste(tile,(px,py));tiles.append([0,px,py,w,h])
palette=compact_palette(atlas)
buffer=BytesIO();palette.save(buffer,format='PNG',optimize=True)
sys.path.insert(0,str(ROOT/'.tools/pyoxipng'));import oxipng
data=oxipng.optimize_from_memory(buffer.getvalue(),level=4,optimize_alpha=False,strip=oxipng.StripChunks.safe(),timeout=30)
assert Image.open(BytesIO(data)).convert('RGBA').tobytes()==palette.convert('RGBA').tobytes()
target=APP/'images/pet/point-right-wing.png';target.write_bytes(data)
record={'pages':[{'file':'/images/pet/point-right-wing.png','width':atlas.width,'height':atlas.height}],
    'tiles':tiles,'frameMap':list(range(19)),'durations':[40]*19,'anchor':right['anchor'],
    'crop':crop,'subjectHeight':right['subjectHeight'],'restFrames':[0],'patch':True}
artPath=APP/'components/pipi-pet/art.js'
text=artPath.read_text(encoding='utf-8');art=json.loads(text[text.index('=')+1:text.rindex(';')])
art.setdefault('localAssets',{})['point:right']=record
artPath.write_text('module.exports = '+json.dumps(art,separators=(',',':'))+';\n',encoding='utf-8')
report={'rightWingFrames':37,'uniquePoses':19,'packagePngBytes':len(data),'crop':crop,
    'masterRgbaExact':True,'packageEncoding':'256-color RGBA palette','sharedMouthAtlas':'base:talk','leftWingAtlas':'base:wave',
    'rightWingAtlas':'/images/pet/point-right-wing.png','master':right['image']}
(A/'pipi-point-bundle-validation.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps(report,indent=2))
