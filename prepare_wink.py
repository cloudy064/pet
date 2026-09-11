"""Pack image-generated wink expressions with a controlled, small head tilt.

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
atlas=Image.open(ROOT/'pipi-wink-generated-poses.png').convert('RGBA')
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
assert len(ids)==16,('Expected 16 generated poses',len(ids))
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


mask=np.zeros((H,W),np.uint8);mask[80:268,102:321]=255
mask[144:270,225:309]=0;mask[183:283,149:238]=0
aligned=[];registrations=[]
for i,pose in enumerate(raw):
    transform=np.eye(2,3,dtype=np.float32)
    score,transform=cv2.findTransformECC(gray(rest),gray(pose),transform,cv2.MOTION_AFFINE,
        (cv2.TERM_CRITERIA_EPS|cv2.TERM_CRITERIA_COUNT,160,1e-5),mask,5)
    assert score>.7,(i,score)
    aligned.append(straight(cv2.warpAffine(premult(pose),transform,(W,H),flags=cv2.INTER_CUBIC|cv2.WARP_INVERSE_MAP)))
    registrations.append({'cell':i,'correlation':float(score),'transform':transform.tolist()})
debug=Image.new('RGBA',(W*4,H*4),'#233c34');draw=ImageDraw.Draw(debug)
for i,a in enumerate(aligned):
    debug.alpha_composite(Image.fromarray(a),((i%4)*W,(i//4)*H));draw.text(((i%4)*W+8,(i//4)*H+8),str(i),fill='white')
debug.convert('RGB').save(ROOT/'pipi-wink-registered-check.jpg')
(ROOT/'pipi-wink-registration.json').write_text(json.dumps(registrations,indent=2),encoding='utf-8')


def feature_mask(box):
    im=Image.new('L',(W,H));ImageDraw.Draw(im).rounded_rectangle(box,radius=14,fill=255)
    m=np.asarray(im.filter(ImageFilter.GaussianBlur(3)),np.float32)/255
    m[m>.99]=1;m[m<.01]=0;return m


eye_mask=feature_mask((222,171,309,260))
eye_mask[:166]=0
mouth_mask=feature_mask((151,183,239,278))
# Keep the original cream/green face boundary. The generated eye expression
# belongs inside the cream patch and must not replace the forehead contour.
cream=np.uint8((rest[:,:,0].astype(int)>=rest[:,:,1].astype(int)-8)&(rest[:,:,0]>140)&(rest[:,:,1]>115)&(rest[:,:,2]>80))*255
cream[:140]=0;cream[281:]=0;cream[:,:100]=0;cream[:,320:]=0
contours,_=cv2.findContours(cream,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE)
face=np.zeros((H,W),np.uint8)
cv2.drawContours(face,[c for c in contours if cv2.contourArea(c)>100],-1,255,cv2.FILLED)
face=cv2.erode(face,np.ones((5,5),np.uint8))
face=cv2.GaussianBlur(face,(7,7),1.2).astype(np.float32)/255
eye_mask*=face
eye_donors=[]
for donor in aligned:
    clean=donor.copy()
    # The generator lowers its eyebrow while winking. Preserve the original
    # eyebrow by removing that extra brow from the eye-only donor, using the
    # adjacent cream skin; the eyelid itself is retained intact.
    brow=np.zeros((H,W),np.uint8)
    brow[162:183,233:279]=np.uint8(donor[162:183,233:279,:3].max(2)<145)*255
    brow=cv2.dilate(brow,np.ones((5,5),np.uint8))
    clean[:,:,:3]=cv2.inpaint(clean[:,:,:3],brow,4,cv2.INPAINT_TELEA)
    eye_donors.append(clean)


def expression(eye,mouth):
    out=rest.astype(np.float32)
    for donor,m,poses in [(eye,eye_mask,eye_donors),(mouth,mouth_mask,aligned)]:
        if donor is None:continue
        weight=m*np.minimum(rest[:,:,3],poses[donor][:,:,3])/255
        out[:,:,:3]=out[:,:,:3]*(1-weight[:,:,None])+poses[donor][:,:,:3]*weight[:,:,None]
    return np.uint8(np.clip(np.round(out),0,255))


# Retain one body raster. The small neck area is filled from the original
# green torso texture, entirely behind the moving head.
body=rest.copy();body[:280]=0
body_image=Image.fromarray(body)
neck=rest_image.crop((177,283,218,294)).resize((64,28),Image.Resampling.LANCZOS)
body_image.paste(neck,(162,252))
body=np.asarray(body_image).copy()

N=33;frames=[];motion=[]
for i in range(N):
    phase=min(i,N-1-i)
    u=min(1,phase/16)
    eased=u*u*(3-2*u)
    angle=5*eased
    # Generated poses 6 and 7 supply the half-closed and nearly-closed eyelid.
    eye=None if phase<10 else (6 if phase==10 else (7 if phase==11 else 12))
    mouth=None if phase<7 else (4 if phase==7 else (5 if phase in (8,9) else 12))
    head=expression(eye,mouth);head[286:]=0
    matrix=cv2.getRotationMatrix2D((192,278),-angle,1)
    moved=cv2.warpAffine(premult(head),matrix,(W,H),flags=cv2.INTER_CUBIC)
    result=straight(moved+premult(body)*(1-moved[:,:,3:4]))
    if i in (0,N-1):result=rest.copy()
    frames.append(Image.fromarray(result))
    motion.append({'frame':i,'headAngleDegrees':angle,'eyeSourceCell':eye,'mouthSourceCell':mouth})

sheet=Image.new('RGBA',(W*N,H));boxes=[]
for i,im in enumerate(frames):
    boxes.append(im.getbbox());sheet.paste(im,(i*W,0))
sheet.save(ROOT/'pipi-wink.png')
durations=[1000/30]*N;durations[0]=100;durations[16]=180+8*1000/30;durations[-1]=160
meta={'version':1,'id':'wink','label':'俏皮单眼眨眼','image':'pipi-wink.png','frameWidth':W,'frameHeight':H,
      'frameCount':N,'columns':N,'anchor':{'x':192,'y':620*SCALE},'subjectHeight':548*SCALE,
      'bounds':[min(b[0] for b in boxes),min(b[1] for b in boxes),max(b[2] for b in boxes),max(b[3] for b in boxes)],
      'durationMs':sum(durations),'frameDurationsMs':durations,'loop':True,
      'frames':[{'x':i*W,'y':0,'w':W,'h':H,'durationMs':durations[i]} for i in range(N)],
      'restPose':{'image':'pipi-idle.png','scale':SCALE,'x':REST_X,'y':0,'width':REST_W,'height':H,'frames':[0,N-1]},
      'phases':[{'label':'歪头与闭眼','start':0,'end':15},{'label':'俏皮微笑','start':16,'end':16},{'label':'睁眼与回正','start':17,'end':32}],
      'method':'Generated viewer-right eyelid and smile artwork registered to the original head; controlled five-degree head tilt with a fixed body. No pupil crossfades.',
      'provenance':{'reference':'pipi-wink-reference.png','generatedAtlas':'pipi-wink-generated-poses.png','frames':motion}}
(ROOT/'pipi-wink.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2),encoding='utf-8')
pixels=[np.asarray(im) for im in frames]
assert np.array_equal(pixels[0],rest) and np.array_equal(pixels[-1],rest)
body_changed=max(int(np.any(a[304:]!=rest[304:],axis=2).sum()) for a in pixels)
assert body_changed==0,('Body or feet moved',body_changed)
margins=[min(b[0] for b in boxes),min(b[1] for b in boxes),W-max(b[2] for b in boxes),H-max(b[3] for b in boxes)]
assert min(margins)>=24,margins
assert all(not np.array_equal(a,b) for a,b in zip(pixels,pixels[1:])), 'Store the central hold as duration, not repeated pictures'
report={'frameCount':N,'size':[W*N,H],'durationMs':sum(durations),'restEndpointsMatch':True,
        'fixedBodyFromRow':304,'fixedBodyChangedPixels':body_changed,'minMargins':margins,
        'uniquePoses':len({a.tobytes() for a in pixels}),'adjacentDuplicateFrames':0,
        'maxHeadAngleStepDegrees':max(abs(a['headAngleDegrees']-b['headAngleDegrees']) for a,b in zip(motion,motion[1:])),
        'winkEye':'viewer-right','sourceAtlas':'pipi-wink-generated-poses.png'}
(ROOT/'pipi-wink-validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
contact=Image.new('RGBA',(W*4,H*3),'#eaf8ee');draw=ImageDraw.Draw(contact)
for j,i in enumerate([0,4,7,9,10,11,12,16,20,23,27,32]):
    contact.alpha_composite(frames[i],((j%4)*W,(j//4)*H));draw.text(((j%4)*W+8,(j//4)*H+8),str(i),fill='#25463b')
contact.convert('RGB').save(ROOT/'pipi-wink-check.jpg')
print(json.dumps({'frames':N,'durationMs':sum(durations),'bounds':meta['bounds'],'minRegistration':min(x['correlation'] for x in registrations)}))
