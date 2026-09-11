"""Stabilize generated wing poses over one immutable character base.

The natural wing drawings remain generated artwork. Registration corrects source
placement only; no wing rotation/scale animation or optical-flow frame synthesis.
"""
from pathlib import Path
import json
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent/'assets'
meta = json.loads((ROOT/'pipi-wave-generated.json').read_text(encoding='utf-8'))
W,H,N = meta['frameWidth'],meta['frameHeight'],meta['frameCount']
source = Image.open(ROOT/meta['image']).convert('RGBA')
raw = [np.asarray(source.crop((i*W,0,(i+1)*W,H))).copy() for i in range(N)]
rest = raw[0].copy()
rest[rest[:,:,3]==0]=0

def premult(data):
    out = data.astype(np.float32)/255
    out[:,:,:3] *= out[:,:,3:4]
    return out

def straight(data):
    alpha=np.clip(data[:,:,3:4],0,1)
    rgb=np.divide(data[:,:,:3],alpha,out=np.zeros_like(data[:,:,:3]),where=alpha>1e-6)
    out=np.uint8(np.clip(np.round(np.concatenate((rgb,alpha),axis=2)*255),0,255))
    out[out[:,:,3]==0]=0
    return out

def gray(data):
    p=premult(data)
    rgb=p[:,:,:3]+np.array([.25,.3,.27])*(1-p[:,:,3:4])
    return cv2.cvtColor(np.float32(rgb),cv2.COLOR_RGB2GRAY)

template = gray(rest)
registration_mask = np.zeros((H,W),np.uint8)
registration_mask[75:265,198:414]=255
# Exclude the expressive left eye and the opening mouth, keeping forehead,
# cream boundary and the consistently open right eye for registration.
registration_mask[150:250,198:271]=0
registration_mask[200:275,257:333]=0
aligned, registrations = [], []
for i,data in enumerate(raw):
    transform=np.eye(2,3,dtype=np.float32)
    if i in (0,N-1):
        score=1.0;image=data.copy()
    else:
        try:
            score,transform=cv2.findTransformECC(template,gray(data),transform,cv2.MOTION_AFFINE,
                (cv2.TERM_CRITERIA_EPS|cv2.TERM_CRITERIA_COUNT,120,1e-5),registration_mask,5)
        except cv2.error as exc:
            raise RuntimeError(f'Frame {i}: head registration failed') from exc
        assert score>.65,(i,score)
        warped=cv2.warpAffine(premult(data),transform,(W,H),flags=cv2.INTER_CUBIC|cv2.WARP_INVERSE_MAP)
        image=straight(warped)
    aligned.append(image)
    registrations.append({'frame':i,'correlation':float(score),'transform':transform.tolist()})
    if i%15==0:print(f'Registered {i+1}/{N}',flush=True)

registered_sheet=Image.new('RGBA',(W*N,H))
for i,data in enumerate(aligned):registered_sheet.paste(Image.fromarray(data),(i*W,0))
registered_sheet.save(ROOT/'pipi-wave-registered.png')
(ROOT/'pipi-wave-registration.json').write_text(json.dumps(registrations,indent=2),encoding='utf-8')

# One existing raster clean plate: original head, torso, resting right wing and
# feet, with only the area originally concealed by the left wing reconstructed.
plate=Image.new('RGBA',(W,H))
body=Image.open(ROOT/'pipi-wave-idle-body.png').convert('RGBA').resize((256,H),Image.Resampling.LANCZOS)
plate.paste(body,(160,0))
base=np.asarray(plate).copy()
# Keep every visible region away from the moving left shoulder exactly original.
base[:280]=rest[:280]
base[:,254:]=rest[:,254:]
base[408:]=rest[408:]

yy,xx=np.mgrid[:H,:W]
head_alpha=rest[:,:,3].copy();head_alpha[282:]=0

def extract_registered_wing(index):
    data=raw[index]
    matrix=np.float32(registrations[index]['transform'])
    source_head=cv2.warpAffine(head_alpha,matrix,(W,H),flags=cv2.INTER_LINEAR)
    shoulder=matrix@np.array([234.,291.,1.])
    hsv=cv2.cvtColor(data[:,:,:3],cv2.COLOR_RGB2HSV)
    color=((hsv[:,:,0]>84)&(hsv[:,:,0]<126))|((hsv[:,:,0]>22)&(hsv[:,:,0]<37))
    feet=(yy>385)&(hsv[:,:,0]<35)
    seed=color&(hsv[:,:,1]>135)&(xx<shoulder[0]+10)&(source_head<32)&(data[:,:,3]>128)&~feet
    sy,sx=np.where(seed)
    assert len(sx)>20,(index,'No generated feather seeds')
    distance=cv2.distanceTransform(np.uint8(~seed),cv2.DIST_L2,5)
    candidate=(distance<50)&(xx<shoulder[0]+12)&(yy<sy.max()+13)&(source_head<128)&~feet
    moving=data.copy();moving[~candidate]=0
    return np.clip(cv2.warpAffine(premult(moving),matrix,(W,H),flags=cv2.INTER_CUBIC|cv2.WARP_INVERSE_MAP),0,1)

def feature_mask(box,radius,blur):
    mask=Image.new('L',(W,H));ImageDraw.Draw(mask).rounded_rectangle(box,radius=radius,fill=255)
    result=np.asarray(mask.filter(ImageFilter.GaussianBlur(blur)),dtype=np.float32)/255
    result[result>.99]=1
    return result

eye_mask=feature_mask((187,145,276,258),13,3)
mouth_mask=feature_mask((250,183,328,277),19,3)
mouth_mask[:,331:]=0
mouth_mask[mouth_mask<.01]=0

def patch_expression(frame,eye_frame,mouth_frame):
    # Feather boundaries in cream skin only; keep eye and beak artwork opaque.
    out=frame.astype(np.float32)
    for index,mask in [(eye_frame,eye_mask),(mouth_frame,mouth_mask)]:
        if index is None:continue
        donor=aligned[index].astype(np.float32)
        weight=mask*np.minimum(rest[:,:,3],donor[:,:,3])/255
        out[:,:,:3]=donor[:,:,:3]*weight[:,:,None]+out[:,:,:3]*(1-weight[:,:,None])
    return np.uint8(np.clip(np.round(out),0,255))

frames=[]
wing_layers=[]
for i,pose in enumerate(aligned):
    wing=extract_registered_wing(i)
    wing_layers.append(Image.fromarray(straight(wing)))
    static=premult(base)
    composite=static+wing*(1-static[:,:,3:4])
    result=straight(composite)
    # Reuse registered expression poses during each hold. This prevents the
    # held wink/smile from changing shape in every independently generated frame.
    eye_index=None if i<22 or i>46 else (22 if i==22 else (23 if i==23 else (45 if i==45 else (46 if i==46 else 27))))
    mouth_index=None
    if 19<=i<=48:
        mouth_index=19 if i in (19,48) else (20 if i in (20,47) else (21 if i in (21,46) else 27))
    result=patch_expression(result,eye_index,mouth_index)
    # The crest cannot be occluded by this wing action. Preserve even its
    # translucent edge pixels exactly, avoiding round-trip alpha differences.
    result[:112,252:]=rest[:112,252:]
    result[result[:,:,3]==0]=0
    if i in (0,N-1):result=rest.copy()
    frames.append(Image.fromarray(result))

sheet=Image.new('RGBA',(W*N,H));boxes=[]
for i,frame in enumerate(frames):
    box=frame.getbbox();boxes.append(box)
    assert min(box[0],box[1],W-box[2],H-box[3])>=12,(i,box)
    sheet.paste(frame,(i*W,0))
sheet.save(ROOT/'pipi-wave-stabilized.png')
wing_sheet=Image.new('RGBA',(W*N,H))
for i,wing in enumerate(wing_layers):wing_sheet.paste(wing,(i*W,0))
wing_sheet.save(ROOT/'pipi-wave-wing-layers.png')
Image.fromarray(base).save(ROOT/'pipi-wave-fixed-base.png')
meta.update(version=7,image='pipi-wave-stabilized.png',label='自然挥翅打招呼',
    bounds=[min(b[0] for b in boxes),min(b[1] for b in boxes),max(b[2] for b in boxes),max(b[3] for b in boxes)],
    method='Generated wing poses registered to a fixed raster head/body/right-wing/feet base; separately registered wink and mouth poses. No procedural wing animation or crossfade frames.')
fixed_regions={'crest':[263,48,83,48],'rightEye':[333,184,27,31],'body':[271,315,43,48],
    'rightWing':[351,305,23,64],'leftFoot':[232,418,30,15],'rightFoot':[307,418,30,15]}
comparison={}
for name,(x,y,w,h) in fixed_regions.items():
    before=[];after=[]
    reference=rest[y:y+h,x:x+w].astype(int)
    for old,new in zip(raw,frames):
        before.append(int(np.any(old[y:y+h,x:x+w].astype(int)!=reference,axis=2).sum()))
        after.append(int(np.any(np.asarray(new)[y:y+h,x:x+w].astype(int)!=reference,axis=2).sum()))
    assert max(after)==0,(name,max(after))
    comparison[name]={'bounds':[x,y,w,h],'beforeMaxChangedPixels':max(before),'afterMaxChangedPixels':max(after)}
meta['stabilization']={'fixedRegions':fixed_regions,'registeredPoseSource':'pipi-wave-generated.png',
    'fixedBase':'pipi-idle.png','minHeadCorrelation':min(r['correlation'] for r in registrations)}
(ROOT/'pipi-wave-stabilized-validation.json').write_text(json.dumps({
    'frameCount':N,'fixedRegionComparisons':comparison,'restEndpointsMatch':frames[0].tobytes()==frames[-1].tobytes()==Image.fromarray(rest).tobytes(),
    'minMargins':[min(b[0] for b in boxes),min(b[1] for b in boxes),W-max(b[2] for b in boxes),H-max(b[3] for b in boxes)]
},ensure_ascii=False,indent=2),encoding='utf-8')
(ROOT/'pipi-wave-stabilized.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2),encoding='utf-8')
contact=Image.new('RGBA',(W*4,H*3),'#233c34')
for n,i in enumerate([0,4,12,18,23,27,32,39,45,49,55,60]):
    contact.alpha_composite(frames[i],((n%4)*W,(n//4)*H))
contact.convert('RGB').resize((1440,1152)).save(ROOT/'pipi-wave-stabilized-check.jpg')
print('Saved stabilized candidate',flush=True)
