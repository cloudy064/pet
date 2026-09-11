"""Bake eight walk cycles from generated views and articulated raster feet."""
from pathlib import Path
import json, math
import cv2
import numpy as np
from PIL import Image, ImageDraw
from prepare_walk import montage
from prepare_flight import premult,straight
from sprite_motion import Morph,sequence,warp,composite,ease,remap

ROOT=Path(__file__).resolve().parent/'assets'
W,H=512,576;AX,AY=256,48+620*256/362
yy,xx=np.mgrid[:H,:W].astype(np.float32)
data=np.load(ROOT/'pipi-walk-registered.npz');rest=data['rest']

def feet(a):
    hsv=cv2.cvtColor(a[:,:,:3],cv2.COLOR_RGB2HSV)
    m=np.uint8((hsv[:,:,0]<29)&(hsv[:,:,1]>90)&(a[:,:,3]>128)&(yy>410))
    _,lab,st,c=cv2.connectedComponentsWithStats(m)
    ids=sorted(range(1,len(st)),key=lambda k:st[k,4],reverse=True)[:2]
    ids.sort(key=lambda k:c[k,0]);out=[]
    for k in ids:
        mask=cv2.dilate(np.uint8(lab==k),np.ones((9,9),np.uint8))>0
        f=a.copy();f[~mask]=0
        y,x=np.where(lab==k);top=y.min();bottom=y.max()+1
        green=np.uint8((hsv[:,:,0]>32)&(hsv[:,:,0]<88)&(hsv[:,:,1]>90)&(a[:,:,3]>128))
        joint=(lab==k)&(cv2.dilate(green,np.ones((7,7),np.uint8))>0)
        jy,jx=np.where(joint)
        rootx=float(np.median(jx)) if len(jx) else float(np.median(x[y<top+8]))
        rooty=float(np.median(jy)) if len(jy) else float(top)
        bank=warp(f,[[1,0,80-rootx],[0,1,100-bottom]],(160,128))
        out.append({'image':f,'bank':bank,'root':(rootx,rooty),'bottom':float(bottom),'mask':mask})
    return out

def body_without_feet(a):
    out=a.copy()
    hsv=cv2.cvtColor(a[:,:,:3],cv2.COLOR_RGB2HSV)
    orange=np.uint8((hsv[:,:,0]<29)&(hsv[:,:,1]>90)&(a[:,:,3]>128)&(yy>410))
    for f in feet(a):out[f['mask']&(cv2.dilate(orange,np.ones((3,3),np.uint8))>0)]=0
    return out

def rig(direction):
    poses=data[direction];parts=[feet(a) for a in poses]
    # Source 1 gives an intact stable torso; only the generated foot artwork
    # changes. The upper silhouette is never passed through a general flow.
    base=poses[0].copy();body=body_without_feet(base)
    foot0,foot1=parts[0]
    dy=AY-foot1['bottom'];body=warp(body,[[1,0,0],[0,1,dy]])
    roots=[(f['root'][0],f['root'][1]+dy-2) for f in (foot0,foot1)]
    banks=[parts[1][0]['bank'],parts[1][1]['bank'],parts[2 if direction!='sw' else 6][1]['bank'],parts[0][0]['bank']]
    if direction=='n':banks[2]=parts[6][1]['bank']
    if direction in ('s','n'):
        # Front/rear toes face the viewer/away. Mirroring the paired foot
        # preserves handedness; side-view toes always keep pointing left.
        banks[2]=np.ascontiguousarray(banks[2][:,::-1])
        banks[1]=parts[0][1]['bank']
    morphs={}
    def shaped(p):
        keys=[(0,3),(.07,0),(.43,0),(.56,1),(.74,2),(.94,3),(1,3)]
        j=next(i for i in range(len(keys)-1) if p<=keys[i+1][0]+1e-8)
        lo,a=keys[j];hi,b=keys[j+1]
        if a==b:return banks[a]
        if (a,b) not in morphs:morphs[a,b]=Morph(banks[a],banks[b])
        return morphs[a,b].at(ease((p-lo)/(hi-lo)))
    # Per-half-step displacement. During stance this moves opposite the
    # world displacement, so a planted toe is stationary on the stage.
    travel={'s':(0,12),'n':(0,-12),'w':(-26,0),'sw':(-23,13),'nw':(-23,-13)}[direction]
    def foot_frame(bank,root,offset,lift,index,bob):
        rx,ry=root;ry+=bob
        oy=offset[1];bottom=AY+oy-lift
        if direction not in ('s','n'):bottom-=4*index
        sample=bank if index==0 or direction not in ('s','n') else np.ascontiguousarray(bank[:,::-1])
        hsv=cv2.cvtColor(sample[:,:,:3],cv2.COLOR_RGB2HSV)
        orange=(hsv[:,:,0]<29)&(hsv[:,:,1]>90)&(sample[:,:,3]>128)
        green=np.uint8((hsv[:,:,0]>32)&(hsv[:,:,0]<88)&(hsv[:,:,1]>90)&(sample[:,:,3]>128))
        joint=orange&(cv2.dilate(green,np.ones((7,7),np.uint8))>0)
        jy,jx=np.where(joint);bx=float(np.median(jx)) if len(jx) else 80;by=float(np.median(jy)) if len(jy) else 58
        out=warp(sample,[[1,0,rx+offset[0]-bx],[0,1,bottom-100]],(W,H))
        return out,(rx+offset[0],bottom-100+by)
    def frame(p,standing=False):
        bob=0 if standing else 1.6*(1-math.cos(4*math.pi*p))
        b=warp(body,[[1,0,0],[0,1,bob]]) if bob else body.copy()
        fs=[];contacts=[];joints=[]
        for i in range(2):
            phase=(p+i*.5)%1
            if standing:offset=(0,0);lift=0;bank=banks[0]
            else:
                if phase<.5:q=1-4*phase;lift=0
                else:
                    t=(phase-.5)*2;q=-1-2*t+12*t*t-8*t*t*t
                    lift=19*math.sin(math.pi*t)**2
                offset=(travel[0]*q,travel[1]*q);bank=shaped(phase)
            foot,joint=foot_frame(bank,roots[i],offset,lift,i,bob);fs.append(foot);joints.append(joint)
            contacts.append({'foot':i,'planted':standing or phase<.5,'x':roots[i][0]+offset[0],
                             'y':AY+offset[1]-(4*i if direction not in ('s','n') else 0),'lift':lift})
        # Carry the small existing green ankle cuffs with the complete
        # raster feet. This keeps toes intact and their attachments closed.
        weights=[];deltas=[]
        for root,joint in zip(roots,joints):
            rx,ry=root;ry+=bob
            weights.append(np.exp(-((xx-rx)/32)**2)*np.clip((yy-(ry-38))/38,0,1))
            deltas.append((joint[0]-rx,joint[1]-ry))
        norm=np.maximum(1,weights[0]+weights[1]);field=np.zeros((H,W,2),np.float32)
        for weight,delta in zip(weights,deltas):field+=weight[:,:,None]/norm[:,:,None]*np.array(delta,np.float32)
        grid=np.dstack((xx,yy));coords=grid-field
        for _ in range(5):coords=.25*coords+.75*(grid-remap(field,coords))
        b=straight(remap(premult(b),coords))
        out=composite(b,composite(fs[0],fs[1]))
        return out,contacts
    cycle=[];contacts=[]
    for i in range(32):
        a,c=frame(i/32);cycle.append(a);contacts.append(c)
    stand,_=frame(0,True)
    return cycle,stand,contacts,{'x':travel[0]*4,'y':travel[1]*4}

def save(d,frames,contacts,stride):
    # Crop equal padding only; no per-frame bounds cropping or normalization.
    frames=[a[:,16:-16].copy() for a in frames];w=480;h=H;n=len(frames)
    sheet=Image.new('RGBA',(w*n,h));boxes=[]
    for i,a in enumerate(frames):
        a[a[:,:,3]==0]=0;im=Image.fromarray(a);sheet.paste(im,(w*i,0));boxes.append(im.getbbox())
    bounds=[min(b[0] for b in boxes),min(b[1] for b in boxes),max(b[2] for b in boxes),max(b[3] for b in boxes)]
    assert min(bounds[0],bounds[1],w-bounds[2],h-bounds[3])>=12,(d,bounds)
    assert w*n<=30000
    name='pipi-walk-'+d;sheet.save(ROOT/(name+'.png'))
    labels={'s':'向下 · 正面','sw':'左下 · 侧前','w':'向左 · 侧面','nw':'左上 · 侧后','n':'向上 · 背面','ne':'右上 · 侧后','e':'向右 · 侧面','se':'右下 · 侧前'}
    meta={'version':1,'id':d,'label':labels[d],'image':name+'.png','frameWidth':w,'frameHeight':h,'frameCount':n,'columns':n,
          'anchor':{'x':240,'y':AY},'subjectHeight':548*256/362,'bounds':bounds,'frameRate':30,
          'frameDurationsMs':[1000/30]*n,'durationMs':n*1000/30,'loop':False,
          'loopRange':{'start':14,'end':45},'introRange':{'start':0,'end':13},'outroRange':{'start':46,'end':60},
          'cycleDurationMs':32*1000/30,'stride':stride,
          'restPose':{'image':'pipi-idle.png','scale':256/362,'x':112,'y':48,'width':256,'height':512,'frames':[0,60]},
          'frames':[{'x':i*w,'y':0,'w':w,'h':h,'durationMs':1000/30} for i in range(n)],
          'contacts':[[{**c,'x':c['x']-16} for c in frame] for frame in contacts],
          'provenance':{'method':'Built-in image_gen directional artwork; fixed torso and articulated generated raster toes, premultiplied inbetweens; no runtime image deformation.',
                        'prompts':'pipi-walk-generation.md','mirrorOf':{'e':'w','se':'sw','ne':'nw'}.get(d)}}
    (ROOT/(name+'.json')).write_text(json.dumps(meta,ensure_ascii=False,indent=2),encoding='utf-8')
    return meta

def main():
    cycles={};stands={'rest':rest};contact_data={};strides={}
    for d in ('s','sw','w','nw','n'):
        cycles[d],stands[d],contact_data[d],strides[d]=rig(d)
        montage(cycles[d][::4],'pipi-walk-'+d+'-cycle-check.jpg',4)
        print('Gait',d,flush=True)
    for d,source in (('e','w'),('ne','nw'),('se','sw')):
        cycles[d]=[np.ascontiguousarray(a[:,::-1]) for a in cycles[source]]
        stands[d]=np.ascontiguousarray(stands[source][:,::-1])
        contact_data[d]=[[{**c,'x':W-1-c['x']} for c in frame] for frame in contact_data[source]]
        strides[d]={'x':-strides[source]['x'],'y':strides[source]['y']}
    routes={'s':['s'],'sw':['s','sw'],'w':['s','sw','w'],'nw':['s','sw','w','nw'],
            'n':['s','sw','w','nw','n'],'se':['s','se'],'e':['s','se','e'],'ne':['s','se','e','ne']}
    assets={}
    for d,route in routes.items():
        poses={k:stands[k] for k in ['rest']+route};poses['contact']=cycles[d][0]
        keys=[(0,'rest')]+[(round(2+8*i/max(1,len(route)-1)),k) for i,k in enumerate(route)]+[(14,'contact')]
        # With one heading allow enough time to establish the walking smile.
        if len(route)==1:keys=[(0,'rest'),(7,'s'),(14,'contact')]
        intro=sequence(poses,keys,15)
        intro[0]=rest.copy();intro[-1]=cycles[d][0].copy()
        frames=intro[:-1]+cycles[d]+list(reversed(intro))
        assets[d]=save(d,frames,contact_data[d],strides[d]);print('Saved',d,len(frames),flush=True)
    config={'version':1,'assets':assets,'order':['nw','n','ne','w','e','sw','s','se'],
            'movement':{'stageWidth':1000,'stageHeight':780,'spriteScale':.65,'startX':500,'startY':560},
            'playback':'Play intro once, loop loopRange inclusive, exit at phase zero through outroRange. World displacement is stride per cycle.'}
    (ROOT/'pipi-walk.json').write_text(json.dumps(config,ensure_ascii=False,indent=2),encoding='utf-8')
    (ROOT/'pipi-walk-assets.js').write_text('window.PIPI_WALK = '+json.dumps(config,ensure_ascii=False)+';\n',encoding='utf-8')
    montage([stands[d] for d in config['order']],'pipi-walk-eight-directions-check.jpg',4)
    print('Eight directional strips ready.',flush=True)

if __name__=='__main__':main()
