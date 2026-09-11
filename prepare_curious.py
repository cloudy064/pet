"""Pack image-generated curious expressions with an attentive head tilt.

Keep the existing character silhouette and body; register generated eye/beak
artwork, then move the head as one raster layer around its neck. No pupil blends.
"""
from pathlib import Path
import json
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT=Path(__file__).resolve().parent/'assets'
W,H,REST_W,REST_X=384,512,256,64
SCALE=REST_W/362
idle=Image.open(ROOT/'pipi-idle.png').convert('RGBA').resize((REST_W,H),Image.Resampling.LANCZOS)
rest_image=Image.new('RGBA',(W,H));rest_image.paste(idle,(REST_X,0))
rest=np.asarray(rest_image).copy();rest[rest[:,:,3]==0]=0
atlas=Image.open(ROOT/'pipi-curious-generated-poses.png').convert('RGBA')
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
foreground=np.uint8(data[:,:,3]>16)
_,labels,stats,centers=cv2.connectedComponentsWithStats(foreground,connectivity=8)
ids=[i for i in range(1,len(stats)) if stats[i,4]>atlas.width*atlas.height/200]
ids.sort(key=lambda i:(int(centers[i,1]//(atlas.height/2)),centers[i,0]))
assert len(ids)==8,('Expected 8 generated poses',len(ids))
raw=[]
for part in ids:
    x,y,w,h,_=stats[part]
    keep=cv2.dilate(np.uint8(labels==part),np.ones((3,3),np.uint8))>0
    sprite=data.copy();sprite[~keep]=0
    sprite=Image.fromarray(sprite).crop((max(0,x-2),max(0,y-2),min(atlas.width,x+w+2),min(atlas.height,y+h+2)))
    l,t,r,b=sprite.getbbox()
    rgba=np.asarray(sprite);hsv=cv2.cvtColor(rgba[:,:,:3],cv2.COLOR_RGB2HSV)
    yy,xx=np.mgrid[:sprite.height,:sprite.width]
    feet=(yy>t+(b-t)*.84)&(hsv[:,:,0]<25)&(hsv[:,:,1]>100)&(rgba[:,:,3]>128)
    fy,fx=np.where(feet);assert len(fx)>20
    scale=(548*SCALE)/(fy.max()+1-t)
    crop=sprite.crop((l,t,r,b)).resize((round((r-l)*scale),round((b-t)*scale)),Image.Resampling.LANCZOS)
    pos=(round(192+(l-(fx.min()+fx.max())/2)*scale),round(620*SCALE+(t-fy.max()-1)*scale))
    im=Image.new('RGBA',(W,H));im.alpha_composite(crop,pos);raw.append(np.asarray(im).copy())


def premult(a):
    p=a.astype(np.float32)/255;p[:,:,:3]*=p[:,:,3:4];return p


def straight(p):
    a=np.clip(p[:,:,3:4],0,1)
    rgb=np.divide(p[:,:,:3],a,out=np.zeros_like(p[:,:,:3]),where=a>1e-6)
    out=np.uint8(np.clip(np.round(np.concatenate((rgb,a),axis=2)*255),0,255));out[out[:,:,3]==0]=0;return out


def gray(a):
    p=premult(a);rgb=p[:,:,:3]+np.array([.25,.3,.27])*(1-p[:,:,3:4])
    return cv2.cvtColor(np.float32(rgb),cv2.COLOR_RGB2GRAY)


mask=np.zeros((H,W),np.uint8);mask[80:273,87:321]=255
mask[133:174,107:171]=0;mask[180:286,148:244]=0
aligned=[];registrations=[]
for i,pose in enumerate(raw):
    matrix=np.eye(2,3,dtype=np.float32)
    score,matrix=cv2.findTransformECC(gray(rest),gray(pose),matrix,cv2.MOTION_AFFINE,
        (cv2.TERM_CRITERIA_EPS|cv2.TERM_CRITERIA_COUNT,160,1e-5),mask,5)
    assert score>.8,(i,score)
    aligned.append(straight(cv2.warpAffine(premult(pose),matrix,(W,H),flags=cv2.INTER_CUBIC|cv2.WARP_INVERSE_MAP)))
    registrations.append({'cell':i,'correlation':float(score),'transform':matrix.tolist()})
debug=Image.new('RGBA',(W*4,H*2),'#233c34');draw=ImageDraw.Draw(debug)
for i,a in enumerate(aligned):
    debug.alpha_composite(Image.fromarray(a),((i%4)*W,(i//4)*H));draw.text(((i%4)*W+8,(i//4)*H+8),str(i),fill='white')
debug.convert('RGB').save(ROOT/'pipi-curious-registered-check.jpg')
(ROOT/'pipi-curious-registration.json').write_text(json.dumps(registrations,indent=2),encoding='utf-8')


def feature_mask(box,radius=12,blur=3):
    im=Image.new('L',(W,H));ImageDraw.Draw(im).rounded_rectangle(box,radius=radius,fill=255)
    m=np.asarray(im.filter(ImageFilter.GaussianBlur(blur)),np.float32)/255
    m[m>.99]=1;m[m<.01]=0;return m


def beak_anchor(a):
    hsv=cv2.cvtColor(a[:,:,:3],cv2.COLOR_RGB2HSV)
    selected=(hsv[:,:,0]<38)&(hsv[:,:,1]>130)&(hsv[:,:,2]>150)&(a[:,:,3]>128)
    selected[:177]=False;selected[229:]=False;selected[:,:145]=False;selected[:,245:]=False
    y,x=np.where(selected);assert len(x)>100
    return np.array([(x.min()+x.max())/2,y.min(),x.max()-x.min()+1],np.float32)


anchor=beak_anchor(rest);mouth_donors=[]
for i,donor in enumerate(aligned):
    measured=beak_anchor(donor);scale=float(anchor[2]/measured[2]);assert .8<scale<1.2
    matrix=np.float32([[scale,0,anchor[0]-measured[0]*scale],[0,scale,anchor[1]-measured[1]*scale]])
    mouth_donors.append(straight(cv2.warpAffine(premult(donor),matrix,(W,H),flags=cv2.INTER_CUBIC)))
    registrations[i]['beakTransform']=matrix.tolist()
brow_mask=feature_mask((112,139,163,170),8,2);brow_mask[174:]=0
mouth_mask=feature_mask((151,181,238,280))
mouth_mask[:177]=0;mouth_mask[286:]=0;mouth_mask[:,:148]=0;mouth_mask[:,243:]=0
yy,xx=np.mgrid[:H,:W]
protected_eyes=np.uint8(((xx-139)/36)**2+((yy-208)/38)**2<=1)
protected_eyes|=np.uint8(((xx-252)/32)**2+((yy-208)/38)**2<=1)
eye_distance=np.clip(cv2.distanceTransform(1-protected_eyes,cv2.DIST_L2,5)/4,0,1)
brow_mask*=eye_distance;mouth_mask*=eye_distance
# Restrict the brow insert to original cream skin, preserving the forehead edge.
cream=np.uint8((rest[:,:,0].astype(int)>=rest[:,:,1].astype(int)-8)&(rest[:,:,0]>140)&(rest[:,:,1]>115)&(rest[:,:,2]>80))*255
cream[:130]=0;cream[180:]=0;cream[:,:104]=0;cream[:,175:]=0
contours,_=cv2.findContours(cream,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE)
face=np.zeros((H,W),np.uint8)
cv2.drawContours(face,[c for c in contours if cv2.contourArea(c)>20],-1,255,cv2.FILLED)
face=cv2.GaussianBlur(cv2.erode(face,np.ones((3,3),np.uint8)),(5,5),.8)/255
brow_mask*=face


def expression(brow,mouth):
    out=rest.astype(np.float32)
    for index,m,poses in [(brow,brow_mask,aligned),(mouth,mouth_mask,mouth_donors)]:
        if index is None:continue
        weight=m*np.minimum(rest[:,:,3],poses[index][:,:,3])/255
        hsv=cv2.cvtColor(poses[index][:,:,:3],cv2.COLOR_RGB2HSV)
        green=np.uint8((hsv[:,:,0]>=35)&(hsv[:,:,0]<=85)&(hsv[:,:,1]>55)&(hsv[:,:,2]>75))
        safe=cv2.distanceTransform(1-green,cv2.DIST_L2,5)
        weight*=np.clip((safe-2)/5,0,1)
        out[:,:,:3]=out[:,:,:3]*(1-weight[:,:,None])+poses[index][:,:,:3]*weight[:,:,None]
    result=np.uint8(np.clip(np.round(out),0,255))
    assert np.array_equal(result[protected_eyes>0],rest[protected_eyes>0]),'Both eyes must remain fully open and unchanged on the head'
    return result


# Use original neck texture behind the original torso, with a rounded mask.
# This fills the small area revealed by the tilt without painting over the body.
body=rest.copy();body[:286]=0
neck=rest_image.crop((177,283,218,294)).resize((128,44),Image.Resampling.LANCZOS)
neck_alpha=Image.new('L',(128,44));ImageDraw.Draw(neck_alpha).ellipse((0,0,127,43),fill=255)
neck.putalpha(neck_alpha.filter(ImageFilter.GaussianBlur(1.2)))
neck_image=Image.new('RGBA',(W,H));neck_image.paste(neck,(128,252))
p=premult(body);body=straight(p+premult(np.asarray(neck_image))*(1-p[:,:,3:4]))

N=41;frames=[];motion=[]
for i in range(N):
    phase=min(i,N-1-i);u=phase/20;eased=u*u*(3-2*u)
    angle=16*eased;dip=2*eased
    brow=None if phase<6 else (1 if phase<9 else 2)
    mouth=None if phase<10 else (3 if phase<14 else 7)
    head=expression(brow,mouth);head[286:]=0
    matrix=cv2.getRotationMatrix2D((192,278),-angle,1);matrix[1,2]+=dip
    moved=cv2.warpAffine(premult(head),matrix,(W,H),flags=cv2.INTER_CUBIC)
    result=straight(moved+premult(body)*(1-moved[:,:,3:4]))
    if i in (0,N-1):result=rest.copy()
    frames.append(Image.fromarray(result))
    motion.append({'frame':i,'headAngleDegrees':angle,'headDownPixels':dip,'browSourceCell':brow,'mouthSourceCell':mouth})
durations=[1000/30]*N;durations[0]=100;durations[20]=600;durations[-1]=160
sheet=Image.new('RGBA',(W*N,H));boxes=[]
for i,im in enumerate(frames):
    boxes.append(im.getbbox());sheet.paste(im,(W*i,0))
sheet.save(ROOT/'pipi-curious.png')
meta={'version':1,'id':'curious','label':'好奇歪头','image':'pipi-curious.png','frameWidth':W,'frameHeight':H,
      'frameCount':N,'columns':N,'anchor':{'x':192,'y':620*SCALE},'subjectHeight':548*SCALE,
      'bounds':[min(b[0] for b in boxes),min(b[1] for b in boxes),max(b[2] for b in boxes),max(b[3] for b in boxes)],
      'durationMs':sum(durations),'frameDurationsMs':durations,'loop':True,
      'frames':[{'x':i*W,'y':0,'w':W,'h':H,'durationMs':durations[i]} for i in range(N)],
      'restPose':{'image':'pipi-idle.png','scale':SCALE,'x':REST_X,'y':0,'width':REST_W,'height':H,'frames':[0,N-1]},
      'phases':[{'label':'睁眼侧头','start':0,'end':19},{'label':'好奇观察','start':20,'end':20},{'label':'缓缓回正','start':21,'end':40}],
      'method':'Generated eyebrow and slight lower-beak opening registered onto the original face; both open eyes remain unchanged within the head. One head layer eases clockwise sixteen degrees, holds, and returns over the original fixed body. No pupil crossfades.',
      'provenance':{'reference':'pipi-curious-reference.png','generatedAtlas':'pipi-curious-generated-poses.png','frames':motion}}
(ROOT/'pipi-curious.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2),encoding='utf-8')
(ROOT/'pipi-curious-registration.json').write_text(json.dumps(registrations,indent=2),encoding='utf-8')
pixels=[np.asarray(im) for im in frames]
assert np.array_equal(pixels[0],rest) and np.array_equal(pixels[-1],rest)
body_changed=max(int(np.any(a[324:]!=rest[324:],axis=2).sum()) for a in pixels)
assert body_changed==0,('Body or feet moved',body_changed)
margins=[min(b[0] for b in boxes),min(b[1] for b in boxes),W-max(b[2] for b in boxes),H-max(b[3] for b in boxes)]
assert min(margins)>=24,margins
assert all(not np.array_equal(a,b) for a,b in zip(pixels,pixels[1:])), 'Store the held observation as duration, not duplicate pictures'
report={'frameCount':N,'size':[W*N,H],'durationMs':sum(durations),'restEndpointsMatch':True,
        'fixedBodyFromRow':324,'fixedBodyChangedPixels':body_changed,'minMargins':margins,
        'uniquePoses':len({a.tobytes() for a in pixels}),'adjacentDuplicateFrames':0,
        'maxHeadAngleStepDegrees':max(abs(a['headAngleDegrees']-b['headAngleDegrees']) for a,b in zip(motion,motion[1:])),
        'bothOpenEyesUnchangedBeforeHeadTransform':True,'sourceAtlas':'pipi-curious-generated-poses.png'}
(ROOT/'pipi-curious-validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
contact=Image.new('RGBA',(W*4,H*3),'#eaf8ee');draw=ImageDraw.Draw(contact)
for j,i in enumerate([0,4,6,9,10,14,18,20,24,30,36,40]):
    contact.alpha_composite(frames[i],((j%4)*W,(j//4)*H));draw.text(((j%4)*W+8,(j//4)*H+8),str(i),fill='#25463b')
contact.convert('RGB').save(ROOT/'pipi-curious-check.jpg')
detail=Image.new('RGBA',(W*3,H),'#233c34')
for j,i in enumerate((0,10,20)):detail.alpha_composite(frames[i],(j*W,0))
detail.convert('RGB').save(ROOT/'pipi-curious-detail-check.png')
print(json.dumps(report))
