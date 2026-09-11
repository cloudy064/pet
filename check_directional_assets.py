"""Artifact checks for all new directional sprite strips, including exact seams."""
from pathlib import Path
import json
import cv2
import numpy as np
from PIL import Image

root=Path(__file__).resolve().parent/'assets';checks=0;report={}
def ok(value,message):
    global checks
    assert value,message
    checks+=1
def frames(m):
    im=Image.open(root/m['image']).convert('RGBA');w,h,n=m['frameWidth'],m['frameHeight'],m['frameCount']
    ok(im.size==(w*n,h),m['id']+' dimensions')
    return [np.asarray(im.crop((i*w,0,(i+1)*w,h))) for i in range(n)]
def inspect(m,fs):
    w,h=m['frameWidth'],m['frameHeight'];minmargin=1000
    for i,a in enumerate(fs):
        ok(np.mean(a[:,:,3]==0)>.42,m['id']+' transparency '+str(i))
        ok(np.all(a[a[:,:,3]==0]==0),m['id']+' hidden RGB '+str(i))
        box=Image.fromarray(a).getbbox();margin=min(box[0],box[1],w-box[2],h-box[3]);minmargin=min(minmargin,margin)
        ok(margin>=12,m['id']+' clipping '+str(i))
        _,_,stats,_=cv2.connectedComponentsWithStats(np.uint8(a[:,:,3]>128))
        fragments=[st[4] for st in stats[1:] if st[4]>180]
        ok(len(fragments)==1,m['id']+' detached anatomy '+str(i)+' '+str(fragments))
    return {'frames':len(fs),'width':w,'height':h,'minimumMargin':int(minmargin)}
walk=json.loads((root/'pipi-walk.json').read_text(encoding='utf-8'));ok(len(walk['assets'])==8,'walk eight views')
walk_frames={}
for d,m in walk['assets'].items():
    ok(json.loads((root/('pipi-walk-'+d+'.json')).read_text(encoding='utf-8'))==m,d+' standalone configuration matches registry')
    fs=frames(m);walk_frames[d]=fs;report['walk-'+d]=inspect(m,fs)
    rest=Image.new('RGBA',(m['frameWidth'],m['frameHeight']));p=m['restPose'];rest.paste(Image.open(root/'pipi-idle.png').convert('RGBA').resize((p['width'],p['height']),Image.Resampling.LANCZOS),(p['x'],p['y']))
    expected=np.asarray(rest).copy();expected[expected[:,:,3]==0]=0
    ok(np.array_equal(fs[0],expected) and np.array_equal(fs[-1],expected),d+' exact default endpoints')
    ok(np.array_equal(fs[14],fs[46]),d+' exit matches loop phase zero')
    for i,c in enumerate(m['contacts']):
        ok(any(f['planted'] for f in c),d+' grounded stance '+str(i))
        for j,f in enumerate(c):
            next=m['contacts'][(i+1)%32][j]
            if f['planted'] and next['planted']:
                ok(abs(next['x']-f['x']+m['stride']['x']/32)<1e-6 and abs(next['y']-f['y']+m['stride']['y']/32)<1e-6,d+' planted contact cancels world travel '+str(i))
    steps=[float(np.mean(np.abs(fs[14+i].astype(float)-fs[14+(i+1)%32].astype(float)))) for i in range(32)]
    ok(steps[-1]<=max(steps[:-1])*1.6,d+' loop seam within native motion')
    report['walk-'+d]['loopSeamMeanDelta']=steps[-1]
for a,b in [('w','e'),('sw','se'),('nw','ne')]:
    for i in range(14,46):ok(np.array_equal(walk_frames[a][i][:,::-1],walk_frames[b][i]),a+b+' paired phase '+str(i))
flight=json.loads((root/'pipi-flight.json').read_text(encoding='utf-8'));ok(len(flight['directions'])==8,'flight eight mapped directions')
for d in ('up-right','up-left','down-right','down-left'):
    loop=frames(flight['assets'][d]);bank=frames(flight['assets']['bank-'+d]);side=d.split('-')[1];base=frames(flight['assets'][side])[0]
    report['flight-'+d]=inspect(flight['assets'][d],loop);report['bank-'+d]=inspect(flight['assets']['bank-'+d],bank)
    ok(np.array_equal(bank[0],np.pad(base,((32,32),(0,0),(0,0)))),d+' bank shares side endpoint')
    ok(np.array_equal(bank[-1],loop[0]),d+' bank shares diagonal endpoint')
    ok(not np.array_equal(loop[-1],loop[0]),d+' no duplicate loop endpoint')
result={'result':'PASS','checks':checks,'assets':report}
(root/'pipi-directional-artifact-check.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
print(json.dumps(result,indent=2))
