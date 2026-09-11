"""Pack registered image-generated limbs with one face and a smooth jump arc."""
from pathlib import Path
import json
import cv2
import numpy as np
from PIL import Image,ImageDraw,ImageFilter

ROOT=Path(__file__).resolve().parent/'assets'
W,H=544,640
SCALE=256/362
AX,AY=272,96+620*SCALE
rest_image=Image.new('RGBA',(W,H))
rest_image.paste(Image.open(ROOT/'pipi-idle.png').convert('RGBA').resize((256,512),Image.Resampling.LANCZOS),(144,96))
rest=np.asarray(rest_image).copy();rest[rest[:,:,3]==0]=0
registered=np.load(ROOT/'pipi-jump-registered.npz')['poses']
yy,xx=np.mgrid[:H,:W].astype(np.float32);grid=np.dstack((xx,yy))


def premult(a):
    p=a.astype(np.float32)/255;p[:,:,:3]*=p[:,:,3:4];return p


def straight(p):
    alpha=np.clip(p[:,:,3:4],0,1)
    rgb=np.divide(p[:,:,:3],alpha,out=np.zeros_like(p[:,:,:3]),where=alpha>1e-6)
    out=np.uint8(np.clip(np.round(np.concatenate((rgb,alpha),axis=2)*255),0,255));out[out[:,:,3]==0]=0;return out


def feature_mask(box,radius=14,blur=4):
    im=Image.new('L',(W,H));ImageDraw.Draw(im).rounded_rectangle(box,radius=radius,fill=255)
    m=np.asarray(im.filter(ImageFilter.GaussianBlur(blur)),np.float32)/255
    m[m>.99]=1;m[m<.01]=0;return m


def belly_bottom(a):
    hsv=cv2.cvtColor(a[:,:,:3],cv2.COLOR_RGB2HSV)
    region=(hsv[:,:,0]>=35)&(hsv[:,:,0]<=85)&(hsv[:,:,1]>90)&(a[:,:,3]>128)&(xx>=250)&(xx<=296)&(yy>=430)&(yy<530)
    y,x=np.where(region);assert len(y)>100
    return float(np.percentile(y,99))


# Keep the head silhouette and torso length stable after head registration.
# Correct generated torso length before interpolating wings and feet.
neck_y=378;bottom=belly_bottom(rest)
head=rest.copy()
head[:,:,3]=np.uint8(np.round(head[:,:,3]*np.clip((382-yy)/7,0,1)))
head[head[:,:,3]==0]=0
head_bounds=head[:,:,3]>0
head_opaque=head[:,:,3]==255
# Rebuild only the narrow background collar behind the original head. Simply
# clearing the donor head leaves a transparent seam through its antialiased edge.
collar=cv2.dilate(np.uint8(head[:,:,3]>=128),np.ones((13,13),np.uint8))>0
# Keep the generated neck connection underneath a short feathered lower edge;
# extending the collar downward would create a flat green ledge at the neck.
collar[376:]=False
_,nearest=cv2.distanceTransformWithLabels(np.uint8(collar),cv2.DIST_L2,5,labelType=cv2.DIST_LABEL_PIXEL)
palette_size=int(nearest.max())+1
sources={0:rest.copy()};body_adjustments=[]
for index in (2,3,5,7,11):
    donor=registered[index].copy();measured=belly_bottom(donor)
    scale=(bottom-neck_y)/(measured-neck_y)
    assert .75<scale<1.25,(index,scale)
    mapping=grid.copy();mapping[:,:,1]=np.where(yy>neck_y,neck_y+(yy-neck_y)/scale,yy)
    donor=straight(cv2.remap(premult(donor),mapping[:,:,0],mapping[:,:,1],cv2.INTER_CUBIC))
    if index in (2,3,5):
        def sole(a):
            hsv=cv2.cvtColor(a[:,:,:3],cv2.COLOR_RGB2HSV)
            feet=(yy>475)&(hsv[:,:,0]<34)&(hsv[:,:,1]>100)&(a[:,:,3]>128)
            return float(yy[feet].max())
        foot_scale=(sole(rest)-498)/(sole(donor)-498)
        mapping=grid.copy();mapping[:,:,1]=np.where(yy>498,498+(yy-498)/foot_scale,yy)
        donor=straight(cv2.remap(premult(donor),mapping[:,:,0],mapping[:,:,1],cv2.INTER_CUBIC))
    # Erase the generated head before restoring the immutable original. Wing
    # tips outside the head remain visible behind the head layer.
    palette=np.zeros((palette_size,4),np.uint8);palette[nearest[~collar]]=donor[~collar]
    donor[collar]=palette[nearest[collar]]
    p=premult(head);donor=straight(p+premult(donor)*(1-p[:,:,3:4]))
    donor[:225]=rest[:225]
    sources[index]=donor
    body_adjustments.append({'sourceCell':index,'torsoScaleY':scale})

# Reuse the approved generated smile/eyelid progression from the petting action.
# Undo its documented head motion, then transfer only the interior expression.
pet_meta=json.loads((ROOT/'pipi-pet.json').read_text(encoding='utf-8'))
pet_sheet=Image.open(ROOT/'pipi-pet.png').convert('RGBA')
expression_mask=feature_mask((180,267,390,369),14,3)
expression_mask*=rest[:,:,3]/255
faces={0:rest.copy()}
for phase in range(3,13):
    p=pet_meta['provenance']['frames'][phase]
    a=np.asarray(pet_sheet.crop((phase*384,0,(phase+1)*384,512))).copy()
    matrix=cv2.getRotationMatrix2D((192,278),-p['headAngleDegrees'],1);matrix[1,2]+=p['headDownPixels']
    unposed=straight(cv2.warpAffine(premult(a),matrix,(384,512),flags=cv2.INTER_CUBIC|cv2.WARP_INVERSE_MAP))
    donor=np.zeros_like(rest);donor[96:608,80:464]=unposed
    face=rest.copy()
    face[:,:,:3]=np.uint8(np.round(rest[:,:,:3]*(1-expression_mask[:,:,None])+donor[:,:,:3]*expression_mask[:,:,None]))
    faces[phase]=face


def gray(a):
    p=premult(a);rgb=p[:,:,:3]+np.array([.12,.18,.15])*(1-p[:,:,3:4])
    return np.uint8(np.clip((.45*cv2.cvtColor(np.float32(rgb),cv2.COLOR_RGB2GRAY)+.55*p[:,:,3])*255,0,255))


def flow(a,b):
    dis=cv2.DISOpticalFlow_create(cv2.DISOPTICAL_FLOW_PRESET_MEDIUM)
    dis.setFinestScale(0);dis.setGradientDescentIterations(50);dis.setVariationalRefinementIterations(15)
    return cv2.GaussianBlur(dis.calc(gray(a),gray(b),None),(0,0),2)


def remap(a,coords):
    return cv2.remap(a,coords[:,:,0],coords[:,:,1],cv2.INTER_LINEAR,borderMode=cv2.BORDER_CONSTANT)


def coordinates_at(displacement,t):
    coords=grid-t*displacement
    for _ in range(8):coords=.25*coords+.75*(grid-t*remap(displacement,coords))
    return coords


def distance_field(a):
    mask=np.uint8(a[:,:,3]>=128)
    return cv2.distanceTransform(mask,cv2.DIST_L2,5)-cv2.distanceTransform(1-mask,cv2.DIST_L2,5)


flows={};distances={i:distance_field(a) for i,a in sources.items()}


def between(a,b,t):
    if a==b or t<1e-7:return sources[a].copy()
    if t>1-1e-7:return sources[b].copy()
    if (a,b) not in flows:
        f,r=flow(sources[a],sources[b]),flow(sources[b],sources[a])
        # Estimate feet independently, so coarse matching cannot confuse
        # orange toes with yellow feathers on the unfolding wings.
        feet_a=sources[a].copy();feet_b=sources[b].copy();feet_a[:465]=0;feet_b[:465]=0
        foot_f,foot_r=flow(feet_a,feet_b),flow(feet_b,feet_a)
        weight=np.clip((yy-465)/25,0,1)[:,:,None]
        f=f*(1-weight)+foot_f*weight;r=r*(1-weight)+foot_r*weight
        flows[a,b]=f,r;flows[b,a]=r,f
        print(f'Reconstructed limbs {a} -> {b}',flush=True)
    f,r=flows[a,b];left=coordinates_at(f,t);right=coordinates_at(r,1-t)
    out=straight(remap(premult(sources[a]),left)*(1-t)+remap(premult(sources[b]),right)*t)
    sdf=remap(distances[a],left)*(1-t)+remap(distances[b],right)*t
    out[:,:,3]=np.uint8(np.clip((sdf+.8)/1.6,0,1)*255)
    same=np.uint8(np.all(sources[a]==sources[b],axis=2));safe=cv2.erode(same,np.ones((13,13),np.uint8))>0
    out[safe]=sources[a][safe];out[out[:,:,3]==0]=0
    return out


def ease(t):
    t=np.clip(t,0,1);return float(t*t*(3-2*t))


N=49
keys=[(0,0),(5,0),(8,2),(11,3),(14,5),(18,7),(22,11),(25,11),(29,7),(32,5),(35,3),(39,2),(45,0),(48,0)]
frames=[];motion=[]
for i in range(N):
    k=min(next((j for j in range(len(keys)-1) if i<=keys[j+1][0]),len(keys)-2),len(keys)-2)
    start,a=keys[k];end,b=keys[k+1];fraction=(i-start)/(end-start)
    if a==0 or b==0:fraction=ease(fraction)
    pose=between(a,b,fraction)
    phase=0 if i<10 or i>38 else (min(12,i-7) if i<20 else (12 if i<=29 else max(3,41-i)))
    face=faces.get(phase,faces[0])
    # Expressions are opaque interior replacements; preserve the clean alpha
    # collar and wing occlusion already present in the registered sources.
    pose[head_opaque]=face[head_opaque]
    pose[:225]=rest[:225]
    if i<=8:
        height=0;stretch=1-.025*ease(i/8)
    elif i<=35:
        u=(i-8)/27;height=90*4*u*(1-u);stretch=1-.025*(1-ease((i-8)/2))
    elif i<=38:
        height=0;stretch=1-.035*ease((i-35)/3)
    else:
        height=0;stretch=1-.035*(1-ease((i-38)/10))
    angle=-3*(height/90)
    scale_matrix=np.float32([[1,0,0],[0,stretch,AY*(1-stretch)]])
    rotation=cv2.getRotationMatrix2D((AX,AY),angle,1)
    combined=np.vstack((rotation,[0,0,1]))@np.vstack((scale_matrix,[0,0,1]))
    combined[1,2]-=height
    result=straight(cv2.warpAffine(premult(pose),combined[:2],(W,H),flags=cv2.INTER_CUBIC))
    if i in (0,N-1):result=rest.copy()
    frames.append(Image.fromarray(result))
    motion.append({'frame':i,'fromSource':a,'toSource':b,'fraction':fraction,'heightPixels':height,'scaleY':stretch,'angleDegrees':angle,'expressionFromPetFrame':phase})

durations=[1000/30]*N;durations[0]=80;durations[-1]=140
sheet=Image.new('RGBA',(W*N,H));boxes=[]
for i,im in enumerate(frames):
    boxes.append(im.getbbox());sheet.paste(im,(i*W,0))
sheet.save(ROOT/'pipi-jump.png')
meta={'version':1,'id':'jump','label':'开心跳跃','image':'pipi-jump.png','frameWidth':W,'frameHeight':H,
      'frameCount':N,'columns':N,'anchor':{'x':AX,'y':AY},'subjectHeight':548*SCALE,
      'bounds':[min(b[0] for b in boxes),min(b[1] for b in boxes),max(b[2] for b in boxes),max(b[3] for b in boxes)],
      'durationMs':sum(durations),'frameDurationsMs':durations,'loop':True,
      'frames':[{'x':i*W,'y':0,'w':W,'h':H,'durationMs':durations[i]} for i in range(N)],
      'restPose':{'image':'pipi-idle.png','scale':SCALE,'x':144,'y':96,'width':256,'height':512,'frames':[0,N-1]},
      'phases':[{'label':'轻轻蓄力','start':0,'end':8},{'label':'展翅跳起','start':9,'end':21},{'label':'开心腾空','start':22,'end':25},{'label':'收翅落地','start':26,'end':35},{'label':'缓冲回正','start':36,'end':48}],
      'method':'Registered image-generated wing/leg drawings with bidirectional motion-compensated inbetweens; immutable head and stabilized torso. Approved generated happy expression reused. A controlled jump arc and landing compression are baked into the PNG.',
      'provenance':{'reference':'pipi-jump-reference.png','generatedAtlas':'pipi-jump-generated-poses.png','expressionSource':'pipi-pet.png','keyframes':keys,'torsoAdjustments':body_adjustments,'frames':motion}}
(ROOT/'pipi-jump.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2),encoding='utf-8')
pixels=[np.asarray(im) for im in frames]
assert np.array_equal(pixels[0],rest) and np.array_equal(pixels[-1],rest)
margins=[min(b[0] for b in boxes),min(b[1] for b in boxes),W-max(b[2] for b in boxes),H-max(b[3] for b in boxes)]
assert min(margins)>=24,margins
assert all(not np.array_equal(a,b) for a,b in zip(pixels,pixels[1:])), 'Unnecessary adjacent duplicate frames'
report={'frameCount':N,'size':[W*N,H],'durationMs':sum(durations),'restEndpointsMatch':True,
        'minMargins':margins,'uniquePoses':len({a.tobytes() for a in pixels}),'adjacentDuplicateFrames':0,
        'maxJumpHeightPixels':max(m['heightPixels'] for m in motion),'groundAnchor':meta['anchor']}
(ROOT/'pipi-jump-validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
contact=Image.new('RGBA',(W*4,H*3),'#eaf8ee');draw=ImageDraw.Draw(contact)
for j,i in enumerate([0,5,8,11,15,19,22,26,30,35,40,48]):
    contact.alpha_composite(frames[i],((j%4)*W,(j//4)*H));draw.text(((j%4)*W+10,(j//4)*H+10),str(i),fill='#25463b')
contact.convert('RGB').resize((1632,1440),Image.Resampling.LANCZOS).save(ROOT/'pipi-jump-check.jpg')
detail=Image.new('RGBA',(W*3,H),'#233c34')
for j,i in enumerate((0,15,22)):detail.alpha_composite(frames[i],(j*W,0))
detail.convert('RGB').save(ROOT/'pipi-jump-detail-check.png')
print(json.dumps(report),flush=True)
