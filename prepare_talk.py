"""Build a transparent speaking cycle from generated mouth artwork.

Only registered mouth pixels change; eyes, head outline, body, wings, feet and
alpha remain the exact static source. Complete mouth poses avoid crossfade ghosts.
"""
from pathlib import Path
import json
import cv2
import numpy as np
from PIL import Image,ImageDraw,ImageFilter

ROOT=Path(__file__).resolve().parent/'assets'
W,H=384,512
SCALE=256/362
rest_image=Image.new('RGBA',(W,H))
rest_image.paste(Image.open(ROOT/'pipi-idle.png').convert('RGBA').resize((256,H),Image.Resampling.LANCZOS),(64,0))
rest=np.asarray(rest_image).copy();rest[rest[:,:,3]==0]=0
atlas=Image.open(ROOT/'pipi-talk-generated-poses.png').convert('RGBA')
data=np.asarray(atlas).copy();rgb=data[:,:,:3]
if np.mean(data[:,:,3]==0)<.1:
    neutral=np.uint8(rgb.max(2).astype(int)-rgb.min(2).astype(int)<=35)
    _,labels,_,_=cv2.connectedComponentsWithStats(neutral,connectivity=4)
    border=np.unique(np.concatenate((labels[0],labels[-1],labels[:,0],labels[:,-1])))
    foreground=np.uint8(~np.isin(labels,border[border!=0]))*255
    alpha=cv2.GaussianBlur(foreground,(3,3),.45);alpha[alpha<5]=0;alpha[alpha>250]=255
    data[:,:,3]=alpha;data[alpha==0]=0
_,labels,stats,centers=cv2.connectedComponentsWithStats(np.uint8(data[:,:,3]>16),connectivity=8)
ids=[i for i in range(1,len(stats)) if stats[i,4]>atlas.width*atlas.height/200]
ids.sort(key=lambda i:(int(centers[i,1]//(atlas.height/4)),centers[i,0]))
assert len(ids)==16,('Expected 16 mouth poses',len(ids))
raw=[]
for part in ids:
    x,y,w,h,_=stats[part]
    keep=cv2.dilate(np.uint8(labels==part),np.ones((3,3),np.uint8))>0
    sprite=data.copy();sprite[~keep]=0
    sprite=Image.fromarray(sprite).crop((max(0,x-2),max(0,y-2),min(atlas.width,x+w+2),min(atlas.height,y+h+2)))
    l,t,r,b=sprite.getbbox();a=np.asarray(sprite)
    hsv=cv2.cvtColor(a[:,:,:3],cv2.COLOR_RGB2HSV);yy,xx=np.mgrid[:sprite.height,:sprite.width]
    feet=(yy>t+(b-t)*.84)&(hsv[:,:,0]<25)&(hsv[:,:,1]>100)&(a[:,:,3]>128)
    fy,fx=np.where(feet);assert len(fx)>20
    scale=(548*SCALE)/(fy.max()+1-t)
    crop=sprite.crop((l,t,r,b)).resize((round((r-l)*scale),round((b-t)*scale)),Image.Resampling.LANCZOS)
    im=Image.new('RGBA',(W,H))
    im.alpha_composite(crop,(round(192+(l-(fx.min()+fx.max())/2)*scale),round(620*SCALE+(t-fy.max()-1)*scale)))
    raw.append(np.asarray(im).copy())


def premult(a):
    p=a.astype(np.float32)/255;p[:,:,:3]*=p[:,:,3:4];return p


def straight(p):
    alpha=np.clip(p[:,:,3:4],0,1)
    rgb=np.divide(p[:,:,:3],alpha,out=np.zeros_like(p[:,:,:3]),where=alpha>1e-6)
    a=np.uint8(np.clip(np.round(np.concatenate((rgb,alpha),axis=2)*255),0,255));a[a[:,:,3]==0]=0;return a


def gray(a):
    p=premult(a);rgb=p[:,:,:3]+np.array([.25,.3,.27])*(1-p[:,:,3:4])
    return cv2.cvtColor(np.float32(rgb),cv2.COLOR_RGB2GRAY)


mask=np.zeros((H,W),np.uint8);mask[85:273,100:321]=255;mask[176:291,146:245]=0
registered=[];registrations=[]
for i,pose in enumerate(raw):
    matrix=np.eye(2,3,dtype=np.float32)
    score,matrix=cv2.findTransformECC(gray(rest),gray(pose),matrix,cv2.MOTION_AFFINE,
        (cv2.TERM_CRITERIA_EPS|cv2.TERM_CRITERIA_COUNT,160,1e-5),mask,5)
    assert score>.8,(i,score)
    registered.append(straight(cv2.warpAffine(premult(pose),matrix,(W,H),flags=cv2.INTER_CUBIC|cv2.WARP_INVERSE_MAP)))
    registrations.append({'cell':i,'headCorrelation':float(score),'headTransform':matrix.tolist()})


def beak_anchor(a):
    # Locate the upper orange beak, excluding its moving lower jaw and tongue.
    hsv=cv2.cvtColor(a[:,:,:3],cv2.COLOR_RGB2HSV)
    yellow=(hsv[:,:,0]<38)&(hsv[:,:,1]>130)&(hsv[:,:,2]>150)&(a[:,:,3]>128)
    yellow[:177]=False;yellow[229:]=False;yellow[:,:145]=False;yellow[:,245:]=False
    y,x=np.where(yellow);assert len(x)>100
    return np.array([(x.min()+x.max())/2,y.min(),x.max()-x.min()+1],np.float32)


anchor=beak_anchor(rest);donors=[]
for i,a in enumerate(registered):
    measured=beak_anchor(a);scale=float(anchor[2]/measured[2])
    assert .8<scale<1.2,(i,scale)
    matrix=np.float32([[scale,0,anchor[0]-measured[0]*scale],[0,scale,anchor[1]-measured[1]*scale]])
    donors.append(straight(cv2.warpAffine(premult(a),matrix,(W,H),flags=cv2.INTER_CUBIC)))
    registrations[i]['beakScale']=scale;registrations[i]['beakTransform']=matrix.tolist()

blend=Image.new('L',(W,H));ImageDraw.Draw(blend).rounded_rectangle((151,181,238,282),radius=15,fill=255)
weight=np.asarray(blend.filter(ImageFilter.GaussianBlur(3)),np.float32)/255
weight[weight>.99]=1;weight[weight<.01]=0
# Keep the surrounding eyes and the outer cream face boundary untouched.
weight[:177]=0;weight[286:]=0;weight[:,:148]=0;weight[:,243:]=0
yy,xx=np.mgrid[:H,:W]
protected_eyes=np.uint8(((xx-139)/36)**2+((yy-208)/38)**2<=1)
protected_eyes|=np.uint8(((xx-252)/32)**2+((yy-208)/38)**2<=1)
eye_distance=cv2.distanceTransform(1-protected_eyes,cv2.DIST_L2,5)
weight*=np.clip(eye_distance/4,0,1)
weight*=rest[:,:,3]/255


def mouth_pose(index):
    if index is None:return rest.copy()
    donor=donors[index]
    out=rest.copy()
    out[:,:,:3]=np.uint8(np.clip(np.round(rest[:,:,:3]*(1-weight[:,:,None])+donor[:,:,:3]*weight[:,:,None]),0,255))
    out[out[:,:,3]==0]=0
    return out


# Natural beak opening/closing only. The second group uses two smaller openings;
# the last opens wider. Exclude the rounded-vowel drawings in atlas cells 8-11.
sequence=[None,1,2,12,13,14,13,12,2,1,None,1,2,12,2,1,2,12,2,1,None,1,2,12,13,5,14,13,12,2,1,None]
assert not set(range(8,12)).intersection(sequence),'Rounded mouths are not used for this bird'
N=len(sequence);frames=[mouth_pose(i) for i in sequence]
durations=[50]*N
for i,ms in {0:100,5:70,10:110,15:70,20:90,25:70,N-1:140}.items():durations[i]=ms
sheet=Image.new('RGBA',(W*N,H));boxes=[]
for i,a in enumerate(frames):
    im=Image.fromarray(a);sheet.paste(im,(W*i,0));boxes.append(im.getbbox())
sheet.save(ROOT/'pipi-talk.png')
meta={'version':2,'id':'talk','label':'说话','image':'pipi-talk.png','frameWidth':W,'frameHeight':H,
      'frameCount':N,'columns':N,'anchor':{'x':192,'y':620*SCALE},'subjectHeight':548*SCALE,
      'bounds':[min(b[0] for b in boxes),min(b[1] for b in boxes),max(b[2] for b in boxes),max(b[3] for b in boxes)],
      'durationMs':sum(durations),'frameDurationsMs':durations,'loop':True,
      'frames':[{'x':i*W,'y':0,'w':W,'h':H,'durationMs':durations[i]} for i in range(N)],
      'restPose':{'image':'pipi-idle.png','scale':SCALE,'x':64,'y':0,'width':256,'height':H,'frames':[0,N-1]},
      'phases':[{'label':'开口说话','start':0,'end':10},{'label':'小幅张合','start':11,'end':20},{'label':'张嘴与合拢','start':21,'end':31}],
      'method':'Image-generated natural beak opening/closing poses only; rounded-vowel atlas cells 8-11 excluded. Only mouth RGB changes on the original static character, with unchanged alpha. No crossfade or optical-flow mouth frames.',
      'mouthRegion':[148,177,95,109],
      'provenance':{'reference':'pipi-talk-reference.png','generatedAtlas':'pipi-talk-generated-poses.png','sourceCells':sequence}}
(ROOT/'pipi-talk.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2),encoding='utf-8')
(ROOT/'pipi-talk-registration.json').write_text(json.dumps(registrations,indent=2),encoding='utf-8')
fixed=weight==0
assert all(np.array_equal(a[fixed],rest[fixed]) for a in frames),'Non-mouth pixels changed'
assert all(np.array_equal(a[:,:,3],rest[:,:,3]) for a in frames),'Alpha changed'
assert all(np.array_equal(a[protected_eyes>0],rest[protected_eyes>0]) for a in frames),'Open eye artwork changed'
assert np.array_equal(frames[0],rest) and np.array_equal(frames[-1],rest),'Rest endpoints changed'
assert all(not np.array_equal(a,b) for a,b in zip(frames,frames[1:])),'Adjacent duplicate mouth frames'
margins=[min(b[0] for b in boxes),min(b[1] for b in boxes),W-max(b[2] for b in boxes),H-max(b[3] for b in boxes)]
assert min(margins)>=24,margins
report={'frameCount':N,'durationMs':sum(durations),'size':[W*N,H],'restEndpointsMatch':True,
        'fixedPixelCount':int(fixed.sum()),'changedPixelsOutsideMouth':0,'bothEyesUnchanged':True,'allAlphaIdentical':True,
        'minMargins':margins,'uniqueMouthPoses':len({a.tobytes() for a in frames}),'adjacentDuplicateFrames':0,
        'mouthMotion':'beak opening/closing only','excludedRoundMouthCells':[8,9,10,11]}
(ROOT/'pipi-talk-validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
contact=Image.new('RGBA',(W*4,H*2),'#eaf8ee');draw=ImageDraw.Draw(contact)
for j,i in enumerate([None]+sorted({i for i in sequence if i is not None})):
    contact.alpha_composite(Image.fromarray(mouth_pose(i)),((j%4)*W,(j//4)*H));draw.text(((j%4)*W+8,(j//4)*H+8),'rest' if i is None else str(i),fill='#25463b')
contact.convert('RGB').save(ROOT/'pipi-talk-mouths-check.jpg')
preview=Image.new('RGBA',(W*4,H*3),'#233c34');draw=ImageDraw.Draw(preview)
for j,i in enumerate([0,1,2,4,5,10,12,14,15,20,25,31]):
    preview.alpha_composite(Image.fromarray(frames[i]),((j%4)*W,(j//4)*H));draw.text(((j%4)*W+8,(j//4)*H+8),str(i),fill='white')
preview.convert('RGB').save(ROOT/'pipi-talk-check.jpg')
print(json.dumps(report))
