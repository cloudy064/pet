"""Register generated right-wing keyframes to Pipi's immutable neutral body.

Only the generated wing region is used. Head, crest, left wing and feet are
restored from the original PNG; no whole-character mirroring is performed.
"""
from pathlib import Path
import json
import cv2
import numpy as np
from PIL import Image, ImageDraw

ROOT=Path(__file__).resolve().parent
A=ROOT/'assets'
W,H=480,512
SCALE=256/362
rest_image=Image.new('RGBA',(W,H))
rest_image.paste(Image.open(A/'pipi-idle.png').convert('RGBA').resize((256,H),Image.Resampling.LANCZOS),(64,0))
rest=np.asarray(rest_image).copy();rest[rest[:,:,3]==0]=0

def premult(a):
    p=a.astype(np.float32)/255;p[:,:,:3]*=p[:,:,3:4];return p
def straight(p):
    alpha=np.clip(p[:,:,3:4],0,1)
    rgb=np.divide(p[:,:,:3],alpha,out=np.zeros_like(p[:,:,:3]),where=alpha>1e-6)
    a=np.uint8(np.clip(np.round(np.concatenate((rgb,alpha),axis=2)*255),0,255));a[a[:,:,3]==0]=0;return a
def gray(a):
    p=premult(a);return cv2.cvtColor(np.float32(p[:,:,:3]+.2*(1-p[:,:,3:4])),cv2.COLOR_RGB2GRAY)

data=np.asarray(Image.open(A/'pipi-point-right-generated-poses.png').convert('RGBA')).copy()
if np.mean(data[:,:,3]==0)<.1:
    # Generated RGB uses a neutral checker backdrop. Remove only border-
    # connected neutral pixels, preserving the enclosed cream face/eye whites.
    rgb=data[:,:,:3].astype(int)
    neutral=np.uint8(rgb.max(2)-rgb.min(2)<38)
    _,labels,_,_=cv2.connectedComponentsWithStats(neutral,connectivity=4)
    border=np.unique(np.concatenate((labels[0],labels[-1],labels[:,0],labels[:,-1])))
    mask=np.uint8(~np.isin(labels,border[border!=0]))
    # A narrow antialiased contour avoids keeping grey checker pixels.
    inside=cv2.distanceTransform(mask,cv2.DIST_L2,5)
    data[:,:,3]=np.uint8(np.clip(inside-.35,0,1)*255)
    data[data[:,:,3]==0]=0

raw=[];records=[]
for i in range(6):
    a=data[(i//3)*512:(i//3+1)*512,(i%3)*512:(i%3+1)*512].copy()
    im=Image.fromarray(a);l,t,r,b=im.getbbox()
    hsv=cv2.cvtColor(a[:,:,:3],cv2.COLOR_RGB2HSV);yy,xx=np.mgrid[:512,:512]
    feet=(yy>t+(b-t)*.85)&(hsv[:,:,0]<25)&(hsv[:,:,1]>100)&(a[:,:,3]>128)
    fy,fx=np.where(feet)
    z=(548*SCALE)/(fy.max()+1-t)
    crop=im.crop((l,t,r,b)).resize((round((r-l)*z),round((b-t)*z)),Image.Resampling.LANCZOS)
    pose=Image.new('RGBA',(W,H));pose.alpha_composite(crop,(round(192+(l-(fx.min()+fx.max())/2)*z),round(620*SCALE+(t-fy.max()-1)*z)))
    pose=np.asarray(pose).copy()
    mask=np.zeros((H,W),np.uint8);mask[100:275,85:310]=255
    matrix=np.eye(2,3,dtype=np.float32)
    score,matrix=cv2.findTransformECC(gray(rest),gray(pose),matrix,cv2.MOTION_AFFINE,
        (cv2.TERM_CRITERIA_EPS|cv2.TERM_CRITERIA_COUNT,180,1e-6),mask,5)
    assert score>.85,(i,score)
    aligned=straight(cv2.warpAffine(premult(pose),matrix,(W,H),flags=cv2.INTER_CUBIC|cv2.WARP_INVERSE_MAP))
    raw.append(aligned);records.append({'cell':i,'correlation':float(score),'transform':matrix.tolist()})

contact=Image.new('RGBA',(W*3,H*2),'#eaf8ee')
for i,a in enumerate(raw):contact.alpha_composite(Image.fromarray(a),((i%3)*W,(i//3)*H))
contact.convert('RGB').save(A/'pipi-point-right-registration.jpg')
(A/'pipi-point-right-registration.json').write_text(json.dumps(records,indent=2),encoding='utf-8')
np.savez_compressed(A/'pipi-point-right-registered.npz',poses=raw,rest=rest)
print('Registered six generated poses')

# A single fixed seam through green shoulder plumage; generated head/body
# variations never enter the sequence. Keep the original opaque head in front.
yy,xx=np.mgrid[:H,:W].astype(np.float32)
weight=np.clip((xx-218)/10,0,1)*np.clip((yy-232)/8,0,1)*np.clip((408-yy)/10,0,1)
weight[(yy<284)&(rest[:,:,3]==255)]=0
keys=[rest]
for donor in raw[1:4]:
    donor=donor.copy()
    head=straight(premult(rest)+premult(donor)*(1-premult(rest)[:,:,3:4]))
    donor[yy<284]=head[yy<284]
    out=straight(premult(rest)*(1-weight[:,:,None])+premult(donor)*weight[:,:,None])
    out[weight==0]=rest[weight==0]
    keys.append(out)

grid=np.dstack((xx,yy))
def remap(a,p):return cv2.remap(a,p[:,:,0],p[:,:,1],cv2.INTER_LINEAR,borderMode=cv2.BORDER_CONSTANT)
def flow(a,b):
    dis=cv2.DISOpticalFlow_create(cv2.DISOPTICAL_FLOW_PRESET_MEDIUM)
    dis.setFinestScale(0);dis.setGradientDescentIterations(50);dis.setVariationalRefinementIterations(15)
    return cv2.GaussianBlur(dis.calc(np.uint8(gray(a)*255),np.uint8(gray(b)*255),None),(0,0),1.5)
def coords(f,t):
    p=grid-t*f
    for _ in range(8):p=.25*p+.75*(grid-t*remap(f,p))
    return p
def sdf(a):
    m=np.uint8(a[:,:,3]>=128)
    return cv2.distanceTransform(m,cv2.DIST_L2,5)-cv2.distanceTransform(1-m,cv2.DIST_L2,5)

poses=[]
for k,(a,b) in enumerate(zip(keys,keys[1:])):
    f,g=flow(a,b),flow(b,a)
    for j in range(6):
        t=j/6
        if k==0:t=t*t
        if k==2:t=1-(1-t)**2
        if j==0:out=a.copy()
        else:
            p,q=coords(f,t),coords(g,1-t)
            out=straight(remap(premult(a),p)*(1-t)+remap(premult(b),q)*t)
            d=remap(sdf(a),p)*(1-t)+remap(sdf(b),q)*t
            out[:,:,3]=np.uint8(np.clip((d+.8)/1.6,0,1)*255)
            out[weight==0]=rest[weight==0];out[out[:,:,3]==0]=0
        poses.append(out)
poses.append(keys[-1])
order=list(range(19))+list(range(17,-1,-1))
strip=Image.new('RGBA',(W*len(order),H))
for i,f in enumerate(order):strip.paste(Image.fromarray(poses[f]),(i*W,0))
strip.save(A/'pipi-point-right.png',optimize=True)
meta=json.loads((A/'pipi-point-left.json').read_text(encoding='utf-8'))
meta.update(id='pointRight',label='画面右翅指字',image='pipi-point-right.png',anchor={'x':192,'y':620*SCALE})
meta['restPose']['x']=64
meta['pointing'].update(side='screen-right',suggestedWingTip={'x':416,'y':275})
meta.pop('reuse',None)
meta['provenance']={'generatedAtlas':'pipi-point-right-generated-poses.png','cells':[1,2,3],
    'method':'Registered generated wing; immutable original head, crest, left wing, central body and feet. Bidirectional motion interpolation; exact neutral endpoints.'}
union=Image.new('RGBA',(W,H))
for a in poses:union.alpha_composite(Image.fromarray(a))
meta['bounds']=list(union.getbbox())
(A/'pipi-point-right.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2),encoding='utf-8')
assert all(np.array_equal(a[weight==0],rest[weight==0]) for a in poses)
assert np.array_equal(poses[0],rest)
contact=Image.new('RGBA',(W*4,H*2),'#eaf8ee');draw=ImageDraw.Draw(contact)
for i,f in enumerate([0,2,5,8,11,14,16,18]):
    contact.alpha_composite(Image.fromarray(poses[f]),((i%4)*W,(i//4)*H))
    draw.text(((i%4)*W+10,(i//4)*H+10),str(f),fill='black')
contact.convert('RGB').save(A/'pipi-point-right-check.jpg')
np.savez_compressed(A/'pipi-point-right-final.npz',poses=poses,fixed=weight==0)
print('Saved right-wing sequence; original head, feet and left side unchanged')
