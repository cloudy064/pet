"""Bake registered generated flight artwork into transparent horizontal strips."""
from pathlib import Path
import json
import cv2
import numpy as np
from PIL import Image,ImageDraw,ImageFilter
from prepare_flight import premult,straight

ROOT=Path(__file__).resolve().parent/'assets'
W,H=704,576
AX,AY=352,48+620*256/362
data=np.load(ROOT/'pipi-flight-registered.npz')
def pad(a):return np.pad(a,((0,0),(32,32),(0,0)))
rest=pad(data['rest']);front=[pad(a) for a in data['front']];side=[pad(a) for a in data['side']]
flap=[pad(a) for a in data['flap']]
turn_sources=[pad(a) for a in data['turn']]
yy,xx=np.mgrid[:H,:W].astype(np.float32);grid=np.dstack((xx,yy))
def remap(a,c):return cv2.remap(a,c[:,:,0],c[:,:,1],cv2.INTER_LINEAR,borderMode=cv2.BORDER_CONSTANT)
def ease(t):
    t=float(np.clip(t,0,1));return t*t*(3-2*t)
def warp(a,mat):return straight(cv2.warpAffine(premult(a),np.float32(mat),(W,H),flags=cv2.INTER_CUBIC))
def rounded(box,r=15,blur=2):
    m=Image.new('L',(W,H));ImageDraw.Draw(m).rounded_rectangle(box,radius=r,fill=255)
    return np.asarray(m.filter(ImageFilter.GaussianBlur(blur)),np.float32)/255
def overlay(base,donor,mask):
    p=premult(base);p*=mask[:,:,None]
    return straight(p+premult(donor)*(1-p[:,:,3:4]))
def fixed_core(base,donor,mask,collar_radius=5):
    # A small reconstructed underlap prevents double silhouettes and seams.
    core=base.copy();core[:,:,3]=np.uint8(np.round(core[:,:,3]*mask));core[core[:,:,3]==0]=0
    collar=cv2.dilate(np.uint8(core[:,:,3]>128),np.ones((collar_radius,collar_radius),np.uint8))>0
    _,nearest=cv2.distanceTransformWithLabels(np.uint8(collar),cv2.DIST_L2,5,labelType=cv2.DIST_LABEL_PIXEL)
    palette=np.zeros((int(nearest.max())+1,4),np.uint8);palette[nearest[~collar]]=donor[~collar]
    d=donor.copy();d[collar]=palette[nearest[collar]]
    return overlay(core,d,np.ones((H,W),np.float32))

# Front-facing hover has one immutable original head, plus one tucked torso.
# Only generated wings articulate. The small original neck edge is feathered.
headmask=np.clip((334-yy)/7,0,1)
head=rest.copy();head[:,:,3]=np.uint8(head[:,:,3]*headmask)
def with_head(donor,face=rest,down=0):
    shifted=warp(face,[[1,0,0],[0,1,down]]) if down else face
    mask=np.clip((334+down-yy)/7,0,1)
    d=donor.copy()
    d[(xx>248)&(xx<470)&(yy<150+down)]=0
    return fixed_core(shifted,d,mask,17)
base=with_head(flap[0])
bodymask=rounded((294,326,408,453),24,3)
frontmask=np.maximum(headmask*(rest[:,:,3]>0),bodymask)
front_sources={}
for i in range(8):
    d=with_head(flap[i])
    front_sources[i]=fixed_core(base,d,frontmask,5)

# The side view uses one generated head/body/tail registration throughout.
# Its far wing can pass behind the fixed head; the near wing stays in front
# below the shoulder, so the lowered wing is not covered by a pasted body.
side_base=side[0].copy()
side_head=rounded((262,75,458,323),65,2)
side_body=rounded((292,326,404,393),25,3)
side_core=np.maximum(side_head,side_body)
side_sources={i:fixed_core(side_base,side[i],side_core,5) for i in (0,1,2,4,5)}
# Freeze the far cheek/eye interior without freezing a rectangular piece of
# the far wing behind it. Its natural occlusion still follows each drawing.
hsv=cv2.cvtColor(side_base[:,:,:3],cv2.COLOR_RGB2HSV)
cream=np.uint8((hsv[:,:,1]<90)&(hsv[:,:,2]>150)&(side_base[:,:,3]>128)&(xx>275)&(xx<459)&(yy>150)&(yy<324))
face_hull=np.zeros((H,W),np.uint8)
cv2.fillConvexPoly(face_hull,cv2.convexHull(cv2.findNonZero(cream)),255)
side_face_mask=(cv2.erode(face_hull,np.ones((3,3),np.uint8))>0)&(side_base[:,:,3]==255)
for a in side_sources.values():a[side_face_mask]=side_base[side_face_mask]

sources={'rest':rest}
for i,a in front_sources.items():sources['h'+str(i)]=a
sources['f5']=front_sources[0]
for i,a in side_sources.items():sources['s'+str(i)]=a

# Crouch uses the generated bent legs/spread wings and focused expression,
# with the original head size. Feet stay on the ground during anticipation.
def sole(a):
    hsv=cv2.cvtColor(a[:,:,:3],cv2.COLOR_RGB2HSV)
    m=(yy>320)&(hsv[:,:,0]<28)&(hsv[:,:,1]>120)&(a[:,:,3]>128)&(xx>240)&(xx<455)
    return float(np.max(yy[m]))
for i in (1,2):
    a=front[i].copy()
    # Retain the source's down-looking face; scale as one full rendered pose.
    mat=np.float32([[.91,0,AX*.09],[0,.91,0]])
    mat[1,2]=AY-sole(a)*.91
    sources['c'+str(i)]=with_head(warp(a,mat),down=94 if i==1 else 110)

# Landing expression comes from the approved petting asset, not an eye morph.
# Reconstruct its unposed expression and blend only cream-face interior.
pet=json.loads((ROOT/'pipi-pet.json').read_text(encoding='utf-8'))
pet_sheet=Image.open(ROOT/'pipi-pet.png').convert('RGBA')
features=rounded((258,218,467,321),14,3)*(rest[:,:,3]/255)
faces={0:rest}
for phase in range(1,13):
    p=pet['provenance']['frames'][phase]
    pet_pose=np.asarray(pet_sheet.crop((phase*384,0,(phase+1)*384,512)))
    mat=cv2.getRotationMatrix2D((192,278),-p['headAngleDegrees'],1);mat[1,2]+=p['headDownPixels']
    unposed=straight(cv2.warpAffine(premult(pet_pose),mat,(384,512),flags=cv2.INTER_CUBIC|cv2.WARP_INVERSE_MAP))
    donor=np.zeros_like(rest);donor[48:560,160:544]=unposed
    face=rest.copy();face[:,:,:3]=np.uint8(np.round(rest[:,:,:3]*(1-features[:,:,None])+donor[:,:,:3]*features[:,:,None]))
    faces[phase]=face
happy=faces[12]
# Full horizontal wings from a clean hover drawing; generated standing legs
# from landing cell 10. Avoid atlas cells 8/9 whose feather tips touch.
landing=front_sources[0].copy()
legmask=rounded((267,346,439,501),28,3)
legs=front[10].copy()
legs=warp(legs,[[1,0,0],[0,1,AY-sole(legs)]])
landing=overlay(legs,landing,legmask)
landing=with_head(landing,happy)
sources['land']=landing
fold=with_head(legs,happy);sources['fold']=fold
sources['happyRest']=with_head(rest,happy)

# A real intermediate drawing turns the head in perspective.
# Equalize turn head height/position without changing the wing anatomy.
sources['t1']=side[7];sources['t2']=side[8]
for i,a in enumerate(turn_sources):sources['g'+str(i)]=a

def gray(a):
    p=premult(a);rgb=p[:,:,:3]+np.array([.12,.18,.15])*(1-p[:,:,3:4])
    return np.uint8(np.clip((.45*cv2.cvtColor(np.float32(rgb),cv2.COLOR_RGB2GRAY)+.55*p[:,:,3])*255,0,255))
def flow(a,b):
    d=cv2.DISOpticalFlow_create(cv2.DISOPTICAL_FLOW_PRESET_MEDIUM)
    d.setFinestScale(0);d.setGradientDescentIterations(40);d.setVariationalRefinementIterations(12)
    return cv2.GaussianBlur(d.calc(gray(a),gray(b),None),(0,0),1.5)
def sdf(a):
    m=np.uint8(a[:,:,3]>=128)
    return cv2.distanceTransform(m,cv2.DIST_L2,5)-cv2.distanceTransform(1-m,cv2.DIST_L2,5)
distances={k:sdf(a) for k,a in sources.items()}
flows={}
def inverse(f,t):
    c=grid-t*f
    for _ in range(7):c=.25*c+.75*(grid-t*remap(f,c))
    return c
def between(a,b,t):
    if a==b or t<1e-7:return sources[a].copy()
    if t>1-1e-7:return sources[b].copy()
    if (a,b) not in flows:
        f,r=flow(sources[a],sources[b]),flow(sources[b],sources[a])
        # Isolate feet from visually similar yellow wing feathers.
        fa=sources[a].copy();fb=sources[b].copy();fa[:405]=0;fb[:405]=0
        weight=np.clip((yy-405)/25,0,1)[:,:,None]
        f=f*(1-weight)+flow(fa,fb)*weight;r=r*(1-weight)+flow(fb,fa)*weight
        flows[a,b]=f,r;flows[b,a]=r,f
        print('Flow',a,b,flush=True)
    f,r=flows[a,b];l=inverse(f,t);q=inverse(r,1-t)
    out=straight(remap(premult(sources[a]),l)*(1-t)+remap(premult(sources[b]),q)*t)
    d=remap(distances[a],l)*(1-t)+remap(distances[b],q)*t
    out[:,:,3]=np.uint8(np.clip((d+.8)/1.6,0,1)*255)
    safe=cv2.erode(np.uint8(np.all(sources[a]==sources[b],2)),np.ones((9,9),np.uint8))>0
    out[safe]=sources[a][safe];out[out[:,:,3]==0]=0
    return out
def sequence(keys,n,core=None):
    frames=[]
    for i in range(n):
        j=next((j for j in range(len(keys)-1) if i<=keys[j+1][0]),len(keys)-2)
        start,a=keys[j];end,b=keys[j+1];t=(i-start)/(end-start)
        p=between(a,b,ease(t))
        if core is not None:
            template,mask=core
            # Exact identity inside the fixed head/torso; preserve wing occlusion.
            opaque=(template[:,:,3]==255)&(mask>.999);p[opaque]=template[opaque]
            if template is side_base:p[side_face_mask]=side_base[side_face_mask]
        frames.append(p)
    return frames

# Cycles are sampled periodically, with no duplicate last frame.
hover=sequence([(0,'f5'),(3,'h1'),(6,'h2'),(9,'h3'),(12,'h2'),(15,'h1'),(17,'f5'),(19,'h4'),(21,'h5'),(23,'h6'),(25,'h7'),(28,'h6'),(30,'h4'),(32,'f5')],32,(base,frontmask))
right=sequence([(0,'s0'),(4,'s1'),(8,'s2'),(16,'s0'),(21,'s4'),(24,'s5'),(29,'s4'),(32,'s0')],32,(side_base,side_core))
takeoff=sequence([(0,'rest'),(10,'c1'),(16,'c2'),(28,'f5')],29)
land=sequence([(0,'f5'),(10,'land'),(23,'fold'),(32,'happyRest'),(40,'rest')],41)
for i,a in enumerate(takeoff):
    down=94*ease(i/10) if i<=10 else 94+16*ease((i-10)/6) if i<=16 else 110*(1-ease((i-16)/12))
    takeoff[i]=with_head(a,down=down)
for i,a in enumerate(land):
    phase=round(12*ease(i/10)) if i<=10 else 12 if i<=32 else round(12*(1-ease((i-32)/8)))
    land[i]=with_head(a,faces[phase])
turn=sequence([(0,'f5'),(2,'g1'),(4,'g2'),(6,'g3'),(8,'g4'),(10,'g5'),(12,'g7'),(16,'s0')],17)
# Explicit shared endpoints prevent jumps between phases.
takeoff[0]=rest.copy();takeoff[-1]=hover[0].copy()
land[0]=hover[0].copy();land[-1]=rest.copy()
turn[0]=hover[0].copy();turn[-1]=right[0].copy()
# Mirror only the side part; front endpoint must remain the actual front.
turn_left=[np.ascontiguousarray(a[:,::-1]) for a in turn]
# Morph from the true (slightly asymmetric) front into the mirrored turn,
# avoiding a first-frame flip in the face.
sources['tl1']=turn_left[2];distances['tl1']=sdf(sources['tl1'])
for i in range(3):turn_left[i]=between('f5','tl1',ease(i/2))
turn_left[0]=hover[0].copy()

assets={}
def save(key,label,frames,fps,loop,rest_frames=(),phases=None):
    n=len(frames);sheet=Image.new('RGBA',(W*n,H));boxes=[]
    for i,a in enumerate(frames):
        im=Image.fromarray(a);sheet.paste(im,(i*W,0));boxes.append(im.getbbox())
    assert W*n<=30000
    bounds=[min(b[0] for b in boxes),min(b[1] for b in boxes),max(b[2] for b in boxes),max(b[3] for b in boxes)]
    margins=[bounds[0],bounds[1],W-bounds[2],H-bounds[3]]
    assert min(margins)>=12,(key,margins)
    image_name='pipi-flight-'+key+'.png';sheet.save(ROOT/image_name)
    ms=[1000/fps]*n
    meta={'version':1,'id':key,'label':label,'image':image_name,'frameWidth':W,'frameHeight':H,'frameCount':n,'columns':n,
          'anchor':{'x':AX,'y':AY},'subjectHeight':548*256/362,'bounds':bounds,'frameDurationsMs':ms,
          'durationMs':sum(ms),'loop':loop,'frameRate':fps,
          'frames':[{'x':i*W,'y':0,'w':W,'h':H,'durationMs':ms[i]} for i in range(n)],
          'coordinateSpace':'Local sprite. World flight translation is separate. Anchor is the neutral sole origin; flight feet tuck above it.',
          'provenance':{'frontAtlas':'pipi-flight-front-generated.png','sideAtlas':'pipi-flight-side-generated.png',
                        'flapAtlas':'pipi-flight-flap-generated.png',
                        'turnAtlas':'pipi-flight-turn-generated.png',
                        'method':'Generated key poses, raster registration, fixed hover core and bidirectional motion-compensated inbetweens. Front eyes use complete approved expression frames outside general optical flow.'}}
    if rest_frames:meta['restPose']={'image':'pipi-idle.png','scale':256/362,'x':224,'y':48,'width':256,'height':512,'frames':list(rest_frames)}
    if phases:meta['phases']=phases
    (ROOT/('pipi-flight-'+key+'.json')).write_text(json.dumps(meta,ensure_ascii=False,indent=2),encoding='utf-8')
    assets[key]=meta
    return {'frameCount':n,'dimensions':[W*n,H],'minMargins':margins,'bytes':(ROOT/image_name).stat().st_size}
reports={}
reports['takeoff']=save('takeoff','起飞蓄力',takeoff,30,False,[0],[{'label':'蓄力','start':0,'end':16},{'label':'蹬地展翅','start':17,'end':28}])
reports['hover']=save('hover','正面扑翼 · 悬停 / 上下',hover,40,True)
reports['right']=save('right','向右飞行',right,40,True)
left=[np.ascontiguousarray(a[:,::-1]) for a in right]
reports['left']=save('left','向左飞行',left,40,True)
reports['turn-right']=save('turn-right','正面转向右侧',turn,40,False)
reports['turn-left']=save('turn-left','正面转向左侧',turn_left,40,False)
reports['land']=save('land','落地回稳',land,30,False,[40],[{'label':'伸脚准备','start':0,'end':10},{'label':'缓冲收翅','start':11,'end':32},{'label':'回到默认','start':33,'end':40}])
config={'version':1,'assets':assets,'directions':{'up':'hover','down':'hover','right':'right','left':'left'},
        'transitions':{'takeoffToHover':[28,0],'hoverToLanding':[0,0],'frontToRight':['turn-right','forward'],
                       'rightToFront':['turn-right','reverse'],'frontToLeft':['turn-left','forward'],'leftToFront':['turn-left','reverse']},
        'timing':{'wingbeatMs':800,'turnMs':425,'takeoffMs':sum(assets['takeoff']['frameDurationsMs']),'landMs':sum(assets['land']['frameDurationsMs'])},
        'movement':{'units':'stage pixels per second','speed':190,'hoverAltitude':130,'groundY':650,'stageWidth':1000,'stageHeight':720,
                    'spriteScale':.65,'boundaryPadding':20,'accelerationSmoothingSeconds':.18},
        'notes':['All strips have uniform 704 by 576 cells and shared anchor.','Up/down are frontal screen-plane flight; left/right use three-quarter views.',
                 'PNG contains local articulation. Apply stage/world movement once, outside the sprite.',
                 'Turn only at wingbeat frame 0; use the transition backwards to face front before landing.',
                 'Landing contact occurs at frame 10; drive world altitude to zero by that frame.']}
(ROOT/'pipi-flight.json').write_text(json.dumps(config,ensure_ascii=False,indent=2),encoding='utf-8')
(ROOT/'pipi-flight-assets.js').write_text('window.PIPI_FLIGHT = '+json.dumps(config,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf-8')
assert np.array_equal(takeoff[0],rest) and np.array_equal(land[-1],rest)
assert np.array_equal(takeoff[-1],hover[0]) and np.array_equal(land[0],hover[0])
assert np.array_equal(turn[-1],right[0]) and np.array_equal(turn_left[-1],left[0])
reports['checks']={'restEndpointsExact':True,'phaseSeamsExact':True,'transparentZeroRGB':all(not np.any(a[a[:,:,3]==0,:3]) for a in hover+right+takeoff+land+turn)}
(ROOT/'pipi-flight-validation.json').write_text(json.dumps(reports,ensure_ascii=False,indent=2),encoding='utf-8')
# Review both stable key poses and reconstructed inbetweens.
samples=[takeoff[0],takeoff[10],takeoff[16],takeoff[25],hover[0],hover[4],hover[8],hover[24],turn[4],turn[8],right[5],right[22],land[5],land[15],land[28],land[40]]
contact=Image.new('RGBA',(W*4,H*4),'#233c34');d=ImageDraw.Draw(contact)
for i,a in enumerate(samples):
    xy=(i%4*W,i//4*H);contact.alpha_composite(Image.fromarray(a),xy);d.text((xy[0]+15,xy[1]+15),str(i),fill='white')
contact.convert('RGB').resize((1690,1382),Image.Resampling.LANCZOS).save(ROOT/'pipi-flight-check.jpg')
print(json.dumps(reports),flush=True)
