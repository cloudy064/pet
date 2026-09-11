"""A joyful jump using generated unfolding wings and tucked feet.

Register the generated pose library, retain one head/torso, reconstruct limb
inbetweens, and bake a controlled jump trajectory into a transparent PNG strip.
"""
from pathlib import Path
import json
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT=Path(__file__).resolve().parent/'assets'
W,H=544,640
SCALE=256/362
REST_X,REST_Y=144,96
AX,AY=272,96+620*SCALE
rest_image=Image.new('RGBA',(W,H))
rest_image.paste(Image.open(ROOT/'pipi-idle.png').convert('RGBA').resize((256,512),Image.Resampling.LANCZOS),(REST_X,REST_Y))
rest=np.asarray(rest_image).copy();rest[rest[:,:,3]==0]=0


def premult(a):
    p=a.astype(np.float32)/255;p[:,:,:3]*=p[:,:,3:4];return p


def straight(p):
    alpha=np.clip(p[:,:,3:4],0,1)
    rgb=np.divide(p[:,:,:3],alpha,out=np.zeros_like(p[:,:,:3]),where=alpha>1e-6)
    out=np.uint8(np.clip(np.round(np.concatenate((rgb,alpha),axis=2)*255),0,255));out[out[:,:,3]==0]=0;return out


def gray(a):
    p=premult(a);rgb=p[:,:,:3]+np.array([.25,.3,.27])*(1-p[:,:,3:4])
    return cv2.cvtColor(np.float32(rgb),cv2.COLOR_RGB2GRAY)


atlas=Image.open(ROOT/'pipi-jump-generated-poses.png').convert('RGBA')
data=np.asarray(atlas).copy();rgb=data[:,:,:3]
if np.mean(data[:,:,3]==0)<.1:
    neutral=np.uint8(rgb.max(2).astype(int)-rgb.min(2).astype(int)<=35)
    _,labels,_,_=cv2.connectedComponentsWithStats(neutral,connectivity=4)
    border=np.unique(np.concatenate((labels[0],labels[-1],labels[:,0],labels[:,-1])))
    fg=np.uint8(~np.isin(labels,border[border!=0]))*255
    alpha=cv2.GaussianBlur(fg,(3,3),.45);alpha[alpha<5]=0;alpha[alpha>250]=255
    core=cv2.erode(fg,np.ones((3,3),np.uint8))==255
    _,nearest=cv2.distanceTransformWithLabels(np.uint8(~core),cv2.DIST_L2,5,labelType=cv2.DIST_LABEL_PIXEL)
    palette=np.zeros((int(nearest.max())+1,3),np.uint8);palette[nearest[core]]=rgb[core]
    rim=(alpha>0)&~core;rgb[rim]=palette[nearest[rim]]
    data[:,:,3]=alpha;data[alpha==0]=0
_,labels,stats,centers=cv2.connectedComponentsWithStats(np.uint8(data[:,:,3]>16),connectivity=8)
ids=[i for i in range(1,len(stats)) if stats[i,4]>atlas.width*atlas.height/200]
ids.sort(key=lambda i:(int(centers[i,1]//(atlas.height/4)),centers[i,0]))
assert len(ids)==16,('Expected 16 generated jump poses',len(ids))


def orange_beak(a,box):
    x1,y1,x2,y2=box;hsv=cv2.cvtColor(a[:,:,:3],cv2.COLOR_RGB2HSV)
    mask=np.zeros(a.shape[:2],np.uint8)
    mask[y1:y2,x1:x2]=np.uint8((hsv[y1:y2,x1:x2,0]<32)&(hsv[y1:y2,x1:x2,1]>135)&(hsv[y1:y2,x1:x2,2]>135)&(a[y1:y2,x1:x2,3]>128))
    _,lab,st,_=cv2.connectedComponentsWithStats(mask,connectivity=8)
    part=1+int(np.argmax(st[1:,4]));y,x=np.where(lab==part)
    return np.array([(x.min()+x.max())/2,y.min(),x.max()-x.min()+1],np.float32)


beak_rest=orange_beak(rest,(225,270,326,353))
raw=[]
for part in ids:
    x,y,w,h,_=stats[part]
    keep=cv2.dilate(np.uint8(labels==part),np.ones((3,3),np.uint8))>0
    sprite=data.copy();sprite[~keep]=0
    sprite=sprite[max(0,y-2):min(atlas.height,y+h+2),max(0,x-2):min(atlas.width,x+w+2)]
    sh,sw=sprite.shape[:2]
    measured=orange_beak(sprite,(round(sw*.28),round(sh*.28),round(sw*.72),round(sh*.62)))
    scale=float(beak_rest[2]/measured[2])
    matrix=np.float32([[scale,0,beak_rest[0]-measured[0]*scale],[0,scale,beak_rest[1]-measured[1]*scale]])
    raw.append(straight(cv2.warpAffine(premult(sprite),matrix,(W,H),flags=cv2.INTER_CUBIC)))

mask=np.zeros((H,W),np.uint8);mask[176:369,167:401]=255
mask[270:355,177:390]=0;mask[276:385,228:324]=0
registered=[];registrations=[]
for i,pose in enumerate(raw):
    matrix=np.eye(2,3,dtype=np.float32)
    score,matrix=cv2.findTransformECC(gray(rest),gray(pose),matrix,cv2.MOTION_AFFINE,
        (cv2.TERM_CRITERIA_EPS|cv2.TERM_CRITERIA_COUNT,160,1e-5),mask,5)
    assert score>.8,(i,score)
    registered.append(straight(cv2.warpAffine(premult(pose),matrix,(W,H),flags=cv2.INTER_CUBIC|cv2.WARP_INVERSE_MAP)))
    registrations.append({'cell':i,'headCorrelation':float(score),'transform':matrix.tolist()})
contact=Image.new('RGBA',(W*4,H*4),'#233c34');draw=ImageDraw.Draw(contact)
for i,a in enumerate(registered):
    contact.alpha_composite(Image.fromarray(a),((i%4)*W,(i//4)*H));draw.text(((i%4)*W+10,(i//4)*H+10),str(i),fill='white')
contact.convert('RGB').resize((1632,1920),Image.Resampling.LANCZOS).save(ROOT/'pipi-jump-registered-check.jpg')
(ROOT/'pipi-jump-registration.json').write_text(json.dumps(registrations,indent=2),encoding='utf-8')
np.savez_compressed(ROOT/'pipi-jump-registered.npz',poses=np.stack(registered))
print('Registered sixteen generated jump poses',flush=True)
