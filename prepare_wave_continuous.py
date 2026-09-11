"""Bake a continuous, single-raster wing motion into a transparent PNG strip.
No frame crossfades: one texture follows a smooth trajectory over a static body.
"""
from pathlib import Path
import json
import cv2
import numpy as np
from PIL import Image

ROOT=Path(__file__).resolve().parent/'assets'
original=Image.open(ROOT/'pipi-wing-motion-source.png').convert('RGB')
rgb=np.asarray(original)
neutral=np.uint8(rgb.max(2).astype(int)-rgb.min(2).astype(int)<=35)
_,labels,_,_=cv2.connectedComponentsWithStats(neutral,connectivity=4)
edge=np.unique(np.concatenate((labels[0],labels[-1],labels[:,0],labels[:,-1])))
fg=np.uint8(~np.isin(labels,edge[edge!=0]))*255
fg=cv2.morphologyEx(fg,cv2.MORPH_OPEN,np.ones((3,3),np.uint8))
alpha=cv2.GaussianBlur(fg,(5,5),.65)
alpha[alpha<6]=0;alpha[alpha>249]=255
wing_rgba=np.dstack((rgb,alpha));wing_rgba[alpha==0]=0
Image.fromarray(wing_rgba).save(ROOT/'pipi-wing-motion.png')

source=Image.open(ROOT/'pipi-wave-stable.png').convert('RGBA')
neutral_frame=np.asarray(source.crop((0,0,576,724))).copy()
high=np.asarray(source.crop((15*576,0,16*576,724))).copy()
# Recover the unoccluded torso from the raised pose, with the fixed neutral head.
body=high.copy()
body[:430,:275]=0
body[:378,:312]=0
hsv=cv2.cvtColor(body[:,:,:3],cv2.COLOR_RGB2HSV)
yy,xx=np.mgrid[:724,:576]
stray=(xx<315)&(yy>=378)&(yy<430)&((hsv[:,:,0]<40)|(hsv[:,:,0]>85))
body[stray]=0
head=neutral_frame.copy();head[378:]=0
head_mask=head[:,:,3]>0
body[head_mask]=head[head_mask]
body_img=Image.fromarray(body)

def ease(t):return .5-.5*np.cos(np.pi*t)
def lift_at(t):
    if t<.38:return ease(t/.38)
    if t<.67:
        u=(t-.38)/.29
        return 1-.12*np.sin(2*np.pi*u)**2
    return 1-ease((t-.67)/.33)

count=96
native_w,native_h=576,724
out_w,out_h=336,422
scale_out=out_w/native_w
source_anchor=np.array([865.,980.])
shoulder=np.array([289.,395.])
wing=wing_rgba.astype(np.float32)/255
wing[:,:,:3]*=wing[:,:,3:4]
base=body.astype(np.float32)/255
base[:,:,:3]*=base[:,:,3:4]
head_premult=head.astype(np.float32)/255
head_premult[:,:,:3]*=head_premult[:,:,3:4]
frames=[];trajectory=[];tip_path=[]
for i in range(count):
    t=i/(count-1);lift=float(lift_at(t))
    theta=np.deg2rad(144*(1-lift))
    size=.3*(.53+.47*lift)
    axis=np.array([-382.,-920.]);axis/=np.linalg.norm(axis)
    across=np.array([-axis[1],axis[0]])
    fold=np.outer(axis,axis)+(.8+.2*lift)*np.outer(across,across)
    rotation=np.array([[np.cos(theta),np.sin(theta)],[-np.sin(theta),np.cos(theta)]],dtype=np.float32)@fold*size
    offset=shoulder-rotation@source_anchor
    matrix=np.column_stack((rotation,offset)).astype(np.float32)
    moving=cv2.warpAffine(wing,matrix,(native_w,native_h),flags=cv2.INTER_CUBIC,borderMode=cv2.BORDER_CONSTANT)
    moving=np.clip(moving,0,1)
    # Wing above torso, fixed head above wing: the root is naturally occluded.
    composite=moving+base*(1-moving[:,:,3:4])
    composite=head_premult+composite*(1-head_premult[:,:,3:4])
    straight=np.divide(composite[:,:,:3],composite[:,:,3:4],out=np.zeros_like(composite[:,:,:3]),where=composite[:,:,3:4]>1e-6)
    rgba=np.uint8(np.clip(np.round(np.dstack((straight,composite[:,:,3]))*255),0,255))
    rgba[rgba[:,:,3]<6]=0
    frame=Image.fromarray(rgba).resize((out_w,out_h),Image.Resampling.LANCZOS)
    frames.append(frame)
    trajectory.append({'lift':round(lift,8),'angle':round(float(np.rad2deg(theta)),6),'scale':round(size,8)})
    tip_path.append((rotation@np.array([483.,60.])+offset)*scale_out)

frames[-1]=frames[0].copy()
sheet=Image.new('RGBA',(out_w*count,out_h))
boxes=[]
for i,f in enumerate(frames):
    box=f.getbbox();boxes.append(box)
    assert box[0]>12 and box[2]<out_w-12 and box[1]>12 and box[3]<out_h-12,(i,box)
    sheet.paste(f,(i*out_w,0))
sheet.save(ROOT/'pipi-wave-continuous.png')
meta={'version':4,'id':'wave','label':'挥翅打招呼','image':'pipi-wave-continuous.png',
      'frameWidth':out_w,'frameHeight':out_h,'columns':count,'frameCount':count,
      'anchor':{'x':365*scale_out,'y':620*out_h/native_h},'subjectHeight':548*scale_out,
      'bounds':[min(b[0] for b in boxes),min(b[1] for b in boxes),max(b[2] for b in boxes),max(b[3] for b in boxes)],
      'frameDurationsMs':[1000/60]*count,'durationMs':count*1000/60,'loop':True,
      'frames':[{'x':i*out_w,'y':0,'w':out_w,'h':out_h,'durationMs':1000/60} for i in range(count)],
      'method':'Single generated raster wing baked along cosine-eased lift/return and continuous waving arcs; fixed torso/head; no optical flow or image crossfade.',
      'trajectory':trajectory}
(ROOT/'pipi-wave-continuous.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2),encoding='utf-8')
contact=Image.new('RGBA',(out_w*4,out_h*3),'#233c34')
for n,i in enumerate(np.linspace(0,count-1,12).astype(int)):contact.alpha_composite(frames[i],((n%4)*out_w,(n//4)*out_h))
contact.convert('RGB').resize((1200,round(1200*out_h*3/(out_w*4)))).save(ROOT/'pipi-wave-continuous-check.jpg')
assert frames[0].tobytes()==frames[-1].tobytes()
speed=np.linalg.norm(np.diff(np.array(tip_path),axis=0),axis=1)
print(json.dumps({'frames':count,'uniqueFrames':len({f.tobytes() for f in frames}),'size':sheet.size,'maxTipStepPx':float(speed.max()),'bounds':meta['bounds']}))
