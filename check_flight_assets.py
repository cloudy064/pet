"""Validate the actual deliverable PNGs/JSON, independent of the packing code."""
from pathlib import Path
import json
import numpy as np
from PIL import Image
ROOT=Path(__file__).resolve().parent/'assets'
config=json.loads((ROOT/'pipi-flight.json').read_text(encoding='utf-8'))
checks=0
def check(value,label):
    global checks
    assert value,label
    checks+=1
frames={}
for key,m in config['assets'].items():
    own=json.loads((ROOT/('pipi-flight-'+key+'.json')).read_text(encoding='utf-8'))
    check(own==m,'Catalog matches standalone metadata: '+key)
    sheet=Image.open(ROOT/m['image'])
    check(sheet.mode=='RGBA','RGBA: '+key)
    check(sheet.size==(m['frameWidth']*m['frameCount'],m['frameHeight']),'Native strip geometry: '+key)
    check(len(m['frames'])==len(m['frameDurationsMs'])==m['frameCount'],'Timing count: '+key)
    check(abs(sum(m['frameDurationsMs'])-m['durationMs'])<1e-5,'Native duration: '+key)
    frames[key]=[]
    for i,r in enumerate(m['frames']):
        check((r['x'],r['y'],r['w'],r['h'])==(i*m['frameWidth'],0,m['frameWidth'],m['frameHeight']),'Uniform cells: '+key)
        im=sheet.crop((r['x'],0,r['x']+r['w'],r['h']));a=np.asarray(im)
        frames[key].append(a)
        b=im.getbbox()
        check(b[0]>=24 and b[1]>=24 and r['w']-b[2]>=24 and r['h']-b[3]>=24,'No clipping: '+key)
        check(np.mean(a[:,:,3]==0)>.45,'Transparent background: '+key)
        check(not np.any(a[a[:,:,3]==0,:3]),'Transparent RGB cleared: '+key)
        if i:check(not np.array_equal(frames[key][i-1],a),'No adjacent duplicate holds: '+key)
base=Image.new('RGBA',(704,576))
base.paste(Image.open(ROOT/'pipi-idle.png').convert('RGBA').resize((256,512),Image.Resampling.LANCZOS),(224,48))
rest=np.asarray(base).copy();rest[rest[:,:,3]==0]=0
for key,i in [('takeoff',0),('land',40)]:
    check(np.array_equal(frames[key][i],rest),'Exact original neutral: '+key)
for a,i,b,j in [('takeoff',28,'hover',0),('hover',0,'land',0),('hover',0,'turn-right',0),
                ('hover',0,'turn-left',0),('turn-right',16,'right',0),('turn-left',16,'left',0)]:
    check(np.array_equal(frames[a][i],frames[b][j]),'Shared phase endpoint: '+a+' / '+b)
for i in range(32):
    check(np.array_equal(frames['left'][i],frames['right'][i][:,::-1]),'Matching directional flap phase')
# Opaque central eye/face pixels remain stable through the full wingbeat.
for key,box in [('hover',(285,215,436,313)),('right',(320,212,410,302)),('right',(424,234,440,270))]:
    x1,y1,x2,y2=box;ref=frames[key][0][y1:y2,x1:x2]
    opaque=ref[:,:,3]==255
    for a in frames[key][1:]:
        check(np.array_equal(a[y1:y2,x1:x2][opaque],ref[opaque]),'Fixed opaque face while flapping: '+key)
result={'result':'PASS','checks':checks,'clips':len(frames),'totalFrames':sum(len(v) for v in frames.values()),
        'cellsByClip':{key:[m['frameWidth'],m['frameHeight']] for key,m in config['assets'].items()},'restEndpointsExact':True,'phaseEndpointsExact':True,'fixedLoopFaces':True}
(ROOT/'pipi-flight-artifact-check.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
print(json.dumps(result))
