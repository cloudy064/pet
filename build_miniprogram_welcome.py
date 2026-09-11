"""Package all 61 approved greeting frames without a startup network request.

The original idle PNG is already packaged as fallback.png. Store only the
changing region, deduplicated, retaining every pose and original frame timing.
"""
from pathlib import Path
from io import BytesIO
import json,sys,hashlib
from PIL import Image
import numpy as np
from quantize_pipi import palette as compact_palette

ROOT=Path(__file__).resolve().parent;A=ROOT/'assets'
APP=Path(r'C:\Users\cloudy064\workspace\aiede\pipi\pipi-wxmp')
m=json.loads((A/'pipi-wave-smooth.json').read_text(encoding='utf-8'))
sheet=Image.open(A/m['image']).convert('RGBA');w,h=m['frameWidth'],m['frameHeight']
frames=[np.asarray(sheet.crop((i*w,0,(i+1)*w,h))) for i in range(m['frameCount'])]
changed=np.any(np.asarray(frames)!=frames[0],axis=(0,3));ys,xs=np.where(changed)
x,y=max(0,int(xs.min())-4),max(0,int(ys.min())-4);r,b=min(w,int(xs.max())+5),min(h,int(ys.max())+5)
crop={'x':x,'y':y,'w':r-x,'h':b-y};z=240/m['subjectHeight']
tw,th=round(crop['w']*z),round(crop['h']*z)
unique=[];lookup={};mapping=[]
for f in frames:
    tile=Image.fromarray(f).crop((x,y,r,b)).resize((tw,th),Image.Resampling.LANCZOS)
    digest=hashlib.sha256(tile.tobytes()).digest()
    if digest not in lookup:lookup[digest]=len(unique);unique.append(tile)
    mapping.append(lookup[digest])
cols=min(len(unique),2048//tw);atlas=Image.new('RGBA',(cols*tw,((len(unique)+cols-1)//cols)*th));tiles=[]
for i,tile in enumerate(unique):
    px,py=(i%cols)*tw,(i//cols)*th;atlas.paste(tile,(px,py));tiles.append([0,px,py,tw,th])
palette=compact_palette(atlas)
buffer=BytesIO();palette.save(buffer,format='PNG',optimize=True)
sys.path.insert(0,str(ROOT/'.tools/pyoxipng'));import oxipng
data=oxipng.optimize_from_memory(buffer.getvalue(),level=4,optimize_alpha=False,strip=oxipng.StripChunks.safe(),timeout=30)
(APP/'images/pet/wave.png').write_bytes(data)
# Keep the source fallback available outside the upload package, then use a
# compact palette derivative so the complete greeting fits the 2 MiB main pack.
fallbackPath=APP/'images/pet/fallback.png'
original=APP/'scripts/legacy-pet-images/fallback-ttt-fullcolor.png'
if not original.exists():original.write_bytes(fallbackPath.read_bytes())
fallback=compact_palette(Image.open(original))
buffer=BytesIO();fallback.save(buffer,format='PNG',optimize=True)
fallbackPath.write_bytes(oxipng.optimize_from_memory(buffer.getvalue(),level=4,optimize_alpha=False,strip=oxipng.StripChunks.safe(),timeout=15))
record={'pages':[{'file':'/images/pet/wave.png','width':atlas.width,'height':atlas.height}],
    'tiles':tiles,'frameMap':mapping,'durations':m['frameDurationsMs'],'anchor':m['anchor'],
    'crop':crop,'subjectHeight':m['subjectHeight'],'restFrames':m['restPose']['frames'],'patch':True}
idle={'pages':[{'file':'/images/pet/fallback.png','width':240,'height':240}],
    'tiles':[[0,0,0,240,240]],'frameMap':[0],'durations':[1000],
    'anchor':{'x':120,'y':240},'crop':{'x':0,'y':0,'w':240,'h':240},'subjectHeight':240,'restFrames':[0]}
artPath=APP/'components/pipi-pet/art.js'
text=artPath.read_text(encoding='utf-8');art=json.loads(text[text.index('=')+1:text.rindex(';')])
art.setdefault('localAssets',{}).update({'base:idle':idle,'base:wave':record})
# Seven complete natural beak drawings are shared by speech, pointing and the
# longer welcome. This tiny local patch also works with no manifest/network.
talk=json.loads((A/'pipi-talk.json').read_text(encoding='utf-8'))
im=Image.open(A/talk['image']).convert('RGBA');unique=[];seen={};mapping=[]
for i in range(talk['frameCount']):
    tile=im.crop((i*384+148,177,i*384+243,286)).resize((59,68),Image.Resampling.LANCZOS)
    key=tile.tobytes()
    if key not in seen:seen[key]=len(unique);unique.append(tile)
    mapping.append(seen[key])
mouth=Image.new('RGBA',(59*len(unique),68))
for i,tile in enumerate(unique):mouth.paste(tile,(59*i,0))
buf=BytesIO();compact_palette(mouth).save(buf,format='PNG',optimize=True)
mouthData=oxipng.optimize_from_memory(buf.getvalue(),level=3,optimize_alpha=False,strip=oxipng.StripChunks.safe(),timeout=15)
(APP/'images/pet/talk-mouth.png').write_bytes(mouthData)
art['localAssets']['base:talk']={'pages':[{'file':'/images/pet/talk-mouth.png','width':mouth.width,'height':mouth.height}],
    'tiles':[[0,59*i,0,59,68] for i in range(len(unique))],'frameMap':mapping,'durations':talk['frameDurationsMs'],
    'anchor':talk['anchor'],'subjectHeight':talk['subjectHeight'],'crop':{'x':148,'y':177,'w':95,'h':109},'patch':True,'restFrames':[0,31]}
artPath.write_text('module.exports = '+json.dumps(art,separators=(',',':'))+';\n',encoding='utf-8')
report={'frames':len(frames),'storedPoses':len(record['tiles']),'subjectHeight':240,'bytes':len(data),'crop':crop,
    'encoding':'256-color PNG','originalMasterUnchanged':True,'localIdle':'/images/pet/fallback.png',
    'idleBytes':fallbackPath.stat().st_size,'mouthBytes':len(mouthData),'fullcolorIdleArchive':str(original)}
(A/'pipi-welcome-package-validation.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps(report,indent=2))
