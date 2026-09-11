"""Extract and register image-generated flight poses; never draw bird anatomy."""
from pathlib import Path
import json
import cv2
import numpy as np
from PIL import Image, ImageDraw

ROOT=Path(__file__).resolve().parent/'assets'
W,H=640,576
SCALE=256/362
AX,AY=320,48+620*SCALE
rest_im=Image.new('RGBA',(W,H))
rest_im.paste(Image.open(ROOT/'pipi-idle.png').convert('RGBA').resize((256,512),Image.Resampling.LANCZOS),(192,48))
rest=np.asarray(rest_im).copy();rest[rest[:,:,3]==0]=0

def premult(a):
    p=a.astype(np.float32)/255;p[:,:,:3]*=p[:,:,3:4];return p

def straight(p):
    alpha=np.clip(p[:,:,3:4],0,1)
    rgb=np.divide(p[:,:,:3],alpha,out=np.zeros_like(p[:,:,:3]),where=alpha>1e-6)
    out=np.uint8(np.clip(np.round(np.concatenate((rgb,alpha),2)*255),0,255));out[out[:,:,3]==0]=0;return out

def gray(a):
    p=premult(a);rgb=p[:,:,:3]+np.array([.25,.3,.27])*(1-p[:,:,3:4])
    return cv2.cvtColor(np.float32(rgb),cv2.COLOR_RGB2GRAY)

def extract(name,cols,rows):
    a=np.asarray(Image.open(ROOT/name).convert('RGBA')).copy();original=a.copy();rgb=a[:,:,:3]
    if np.mean(a[:,:,3]==0)<.1:
        # A low chroma threshold keeps the pale far cheek/eye at a side-view
        # silhouette. A 35-level threshold incorrectly opens a hole there.
        neutral=np.uint8(rgb.max(2).astype(int)-rgb.min(2).astype(int)<=12)
        _,labels,_,_=cv2.connectedComponentsWithStats(neutral,connectivity=4)
        border=np.unique(np.concatenate((labels[0],labels[-1],labels[:,0],labels[:,-1])))
        fg=np.uint8(~np.isin(labels,border[border!=0]))*255
        alpha=cv2.GaussianBlur(fg,(3,3),.45);alpha[alpha<5]=0;alpha[alpha>250]=255
        core=cv2.erode(fg,np.ones((5,5),np.uint8))==255
        _,nearest=cv2.distanceTransformWithLabels(np.uint8(~core),cv2.DIST_L2,5,labelType=cv2.DIST_LABEL_PIXEL)
        palette=np.zeros((int(nearest.max())+1,3),np.uint8);palette[nearest[core]]=rgb[core]
        rim=(alpha>0)&~core;rgb[rim]=palette[nearest[rim]]
        a[:,:,3]=alpha;a[alpha==0]=0
    _,labels,stats,centers=cv2.connectedComponentsWithStats(np.uint8(a[:,:,3]>16),connectivity=8)
    # The atlas has two touching blue feather tips in its landing row.
    # Separate only oversized connected components at their thinnest neck.
    for x,y,w,h,area in stats[1:]:
        if w>a.shape[1]/cols*1.5 and area>a.shape[0]*a.shape[1]/(cols*rows*12):
            mid=x+w//2;radius=round(a.shape[1]/cols*.12)
            density=np.sum(a[y:y+h,mid-radius:mid+radius,3]>16,axis=0)
            cut=mid-radius+int(np.argmin(density));a[y:y+h,cut]=0
    _,labels,stats,centers=cv2.connectedComponentsWithStats(np.uint8(a[:,:,3]>16),connectivity=8)
    ids=[i for i in range(1,len(stats)) if stats[i,4]>a.shape[0]*a.shape[1]/(cols*rows*12)]
    ids.sort(key=lambda i:(int(centers[i,1]//(a.shape[0]/rows)),centers[i,0]))
    assert len(ids)==cols*rows,(name,len(ids),[stats[i].tolist() for i in ids])
    parts=[]
    for part in ids:
        x,y,w,h,_=stats[part];keep=cv2.dilate(np.uint8(labels==part),np.ones((3,3),np.uint8))>0
        sprite=a.copy();sprite[~keep]=0
        y1,y2=max(0,y-2),min(a.shape[0],y+h+2);x1,x2=max(0,x-2),min(a.shape[1],x+w+2)
        sprite=sprite[y1:y2,x1:x2].copy();sh,sw=sprite.shape[:2]
        # Restore only missing interior face pixels. The far pale eye can
        # connect to a neutral background at its rim in a three-quarter view.
        hsv=cv2.cvtColor(sprite[:,:,:3],cv2.COLOR_RGB2HSV)
        cream=np.uint8((hsv[:,:,1]<90)&(hsv[:,:,2]>150)&(sprite[:,:,3]>128))
        cream[round(sh*.7):]=0;cream[:,:round(sw*.27)]=0;cream[:,round(sw*.85):]=0
        _,clab,cstats,_=cv2.connectedComponentsWithStats(cream,connectivity=8)
        face_ids=sorted(range(1,len(cstats)),key=lambda k:cstats[k,4],reverse=True)[:2]
        face_ids=[k for k in face_ids if cstats[k,4]>100]
        points=cv2.findNonZero(np.uint8(np.isin(clab,face_ids)))
        if name=='pipi-flight-turn-generated.png' and points is not None and len(points)>100:
            hull=np.zeros((sh,sw),np.uint8);cv2.fillConvexPoly(hull,cv2.convexHull(points),255)
            fill=(hull>0)&(sprite[:,:,3]<128)
            if np.count_nonzero(fill)<sh*sw*.025:
                sprite[fill]=original[y1:y2,x1:x2][fill];sprite[fill,3]=255
        parts.append(sprite)
    return parts

def beak(a,box=None):
    sh,sw=a.shape[:2]
    if box is None:box=(round(sw*.45),round(sh*.30),round(sw*.82),round(sh*.72))
    x1,y1,x2,y2=box;hsv=cv2.cvtColor(a[:,:,:3],cv2.COLOR_RGB2HSV)
    m=np.zeros(a.shape[:2],np.uint8)
    m[y1:y2,x1:x2]=np.uint8((hsv[y1:y2,x1:x2,0]<32)&(hsv[y1:y2,x1:x2,1]>135)&(hsv[y1:y2,x1:x2,2]>135)&(a[y1:y2,x1:x2,3]>128))
    _,lab,st,_=cv2.connectedComponentsWithStats(m,connectivity=8)
    part=1+int(np.argmax(st[1:,4]));y,x=np.where(lab==part)
    return np.array([(x.min()+x.max())/2,y.min(),x.max()-x.min()+1],np.float32)

def head_ecc(pose,reference,mask):
    matrix=np.eye(2,3,dtype=np.float32)
    score,matrix=cv2.findTransformECC(gray(reference),gray(pose),matrix,cv2.MOTION_TRANSLATION,
        (cv2.TERM_CRITERIA_EPS|cv2.TERM_CRITERIA_COUNT,140,1e-5),mask,5)
    assert score>.55,score
    return straight(cv2.warpAffine(premult(pose),matrix,(W,H),flags=cv2.INTER_CUBIC|cv2.WARP_INVERSE_MAP)),float(score),matrix.tolist()

def normalize(part,target,box=None):
    measured=beak(part,box);scale=float(target[2]/measured[2])
    mat=np.float32([[scale,0,target[0]-measured[0]*scale],[0,scale,target[1]-measured[1]*scale]])
    return straight(cv2.warpAffine(premult(part),mat,(W,H),flags=cv2.INTER_CUBIC))

def montage(poses,name,cols):
    out=Image.new('RGBA',(W*cols,H*((len(poses)+cols-1)//cols)),'#233c34');d=ImageDraw.Draw(out)
    for i,a in enumerate(poses):
        xy=((i%cols)*W,(i//cols)*H);out.alpha_composite(Image.fromarray(a),xy);d.text((xy[0]+12,xy[1]+12),str(i),fill='white')
    out.convert('RGB').resize((cols*384,out.height*384//W),Image.Resampling.LANCZOS).save(ROOT/name)

if __name__=='__main__':
    front=extract('pipi-flight-front-generated.png',4,3)
    target=beak(rest,(272,220,374,314))
    mask=np.zeros((H,W),np.uint8);mask[128:319,215:449]=255
    mask[220:311,220:440]=0
    fp=[];log=[]
    for i,a in enumerate(front):
        sh,sw=a.shape[:2]
        raw=normalize(a,target,(round(sw*.38),round(sh*.3),round(sw*.63),round(sh*.85)))
        if i in (1,2,8,9,10):
            p,score,matrix=raw,None,None
        else:
            p,score,matrix=head_ecc(raw,rest,mask)
        print('front',i,score,flush=True)
        fp.append(p);log.append({'frontCell':i,'score':score,'transform':matrix})
    side=extract('pipi-flight-side-generated.png',3,3)
    # One fixed three-quarter head, body and tail provide a stable wingbeat.
    side_target=target.copy();side_target[0]+=42;side_target[1]-=4;side_target[2]*=1.0
    side_raw=[]
    for i,a in enumerate(side):
        sh,sw=a.shape[:2]
        box=None
        if i==6:box=(round(sw*.4),round(sh*.3),round(sw*.62),round(sh*.7))
        if i==7:box=(round(sw*.48),round(sh*.3),round(sw*.68),round(sh*.7))
        side_raw.append(normalize(a,side_target,box))
    smask=np.zeros((H,W),np.uint8);smask[120:325,245:455]=255
    sp=[]
    for i,p in enumerate(side_raw):
        if i<6:
            p,score,matrix=head_ecc(p,side_raw[0],smask)
            log.append({'sideCell':i,'score':score,'transform':matrix})
        sp.append(p)
    # Turn poses share the center of the head, not the advancing beak tip.
    for i,offset in ((6,-42),(7,-26),(8,-8)):
        mat=np.float32([[1,0,offset],[0,1,4]])
        sp[i]=straight(cv2.warpAffine(premult(sp[i]),mat,(W,H),flags=cv2.INTER_CUBIC))
    montage(fp,'pipi-flight-front-registered-check.jpg',4)
    montage(sp,'pipi-flight-side-registered-check.jpg',3)
    flap=extract('pipi-flight-flap-generated.png',4,2);hp=[]
    for i,a in enumerate(flap):
        sh,sw=a.shape[:2]
        raw=normalize(a,target,(round(sw*.38),round(sh*.30),round(sw*.63),round(sh*.72)))
        p,score,matrix=head_ecc(raw,rest,mask)
        hp.append(p);log.append({'flapCell':i,'score':score,'transform':matrix})
    montage(hp,'pipi-flight-flap-registered-check.jpg',4)
    turns=extract('pipi-flight-turn-generated.png',3,3);tp=[]
    def cream_box(a):
        hsv=cv2.cvtColor(a[:,:,:3],cv2.COLOR_RGB2HSV);sh,sw=a.shape[:2]
        m=np.uint8((hsv[:,:,1]<90)&(hsv[:,:,2]>150)&(a[:,:,3]>128))
        m[round(sh*.73):]=0
        _,lab,st,_=cv2.connectedComponentsWithStats(m,connectivity=8)
        ids=[i for i in range(1,len(st)) if st[i,4]>200]
        y,x=np.where(np.isin(lab,ids));return np.array([(x.min()+x.max())/2,y.max(),y.max()-y.min()+1],np.float32)
    face_target=cream_box(rest)
    for i,a in enumerate(turns):
        measured=cream_box(a);scale=float(face_target[2]/measured[2])
        # Perspective moves the face slightly right while the torso turns.
        center=face_target[0]+18*i/8
        mat=np.float32([[scale,0,center-measured[0]*scale],[0,scale,face_target[1]-measured[1]*scale]])
        tp.append(straight(cv2.warpAffine(premult(a),mat,(W,H),flags=cv2.INTER_CUBIC)))
        log.append({'turnCell':i,'faceHeightScale':scale,'transform':mat.tolist()})
    montage(tp,'pipi-flight-turn-registered-check.jpg',3)
    np.savez_compressed(ROOT/'pipi-flight-registered.npz',front=np.stack(fp),side=np.stack(sp),flap=np.stack(hp),turn=np.stack(tp),rest=rest)
    (ROOT/'pipi-flight-registration.json').write_text(json.dumps(log,indent=2),encoding='utf-8')
    print('Registered 12 front, 9 side, 8 refined wingbeat and 9 turning poses.',flush=True)
