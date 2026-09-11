"""Repair ghosted blink frames and stabilize wave's non-moving raster pixels."""
from pathlib import Path
import json
import cv2
import numpy as np
from PIL import Image, ImageFilter, ImageDraw

ROOT=Path(__file__).resolve().parent/'assets'

def clean_edges(image):
    data=np.asarray(image).copy()
    alpha=data[:,:,3]
    # Remove isolated alpha flecks, gently smooth the contour at final resolution.
    solid=np.uint8(alpha>=96)*255
    n,labels,stats,_=cv2.connectedComponentsWithStats(solid,connectivity=8)
    biggest=1+np.argmax(stats[1:,4])
    solid=np.uint8(labels==biggest)*255
    solid=cv2.morphologyEx(solid,cv2.MORPH_CLOSE,np.ones((3,3),np.uint8))
    solid=cv2.morphologyEx(solid,cv2.MORPH_OPEN,np.ones((3,3),np.uint8))
    smooth=cv2.GaussianBlur(solid,(5,5),.65)
    smooth[smooth<6]=0;smooth[smooth>249]=255
    # Extend clean interior RGB through the translucent edge, avoiding gray fringes.
    core=cv2.erode(solid,np.ones((5,5),np.uint8))==255
    _,nearest=cv2.distanceTransformWithLabels(np.uint8(~core),cv2.DIST_L2,5,labelType=cv2.DIST_LABEL_PIXEL)
    palette=np.zeros((int(nearest.max())+1,3),dtype=np.uint8)
    palette[nearest[core]]=data[:,:,:3][core]
    rim=(smooth>0)&~core
    data[:,:,:3][rim]=palette[nearest[rim]]
    data[:,:,3]=smooth
    data[smooth==0]=0
    return Image.fromarray(data)

def extract_blink():
    source=Image.open(ROOT/'pipi-blink-clean-keyposes.png').convert('RGB')
    rgb=np.asarray(source)
    neutral=np.uint8(rgb.max(2).astype(int)-rgb.min(2).astype(int)<=35)
    _,labels,_,_=cv2.connectedComponentsWithStats(neutral,connectivity=4)
    edge=np.unique(np.concatenate((labels[0],labels[-1],labels[:,0],labels[:,-1])))
    mask=np.uint8(~np.isin(labels,edge[edge!=0]))
    n,parts,stats,centers=cv2.connectedComponentsWithStats(mask,connectivity=8)
    ids=[i for i in range(1,n) if stats[i,4]>20000]
    ids.sort(key=lambda i:(int(centers[i,1]//(source.height/3)),centers[i,0]))
    assert len(ids)==12
    scale=548/float(np.median([stats[i,3] for i in ids]))
    result=[]
    for part in ids:
        x,y,w,h,_=stats[part]
        feet=np.argwhere(parts[y+int(h*.95):y+h,x:x+w]==part)
        foot=(feet[:,1].min()+feet[:,1].max())/2+x
        alpha=Image.fromarray(np.uint8(parts==part)*255)
        rgba=source.convert('RGBA');rgba.putalpha(alpha)
        crop=rgba.crop((x-3,y-3,x+w+3,y+h+3))
        crop=crop.resize((round(crop.width*scale),round(crop.height*scale)),Image.Resampling.LANCZOS)
        frame=Image.new('RGBA',(362,724))
        frame.alpha_composite(crop,(round(181+(x-3-foot)*scale),round(620-(h+3)*scale)))
        result.append(clean_edges(frame))
    return result

def save_sheet(frames,filename,meta):
    w,h=frames[0].size
    sheet=Image.new('RGBA',(w*len(frames),h))
    for i,frame in enumerate(frames):sheet.paste(frame,(i*w,0))
    sheet.save(ROOT/filename)
    meta.update(image=filename,frameWidth=w,frameHeight=h,columns=len(frames),frameCount=len(frames))
    meta['frames']=[{'x':i*w,'y':0,'w':w,'h':h,'durationMs':meta['frameDurationsMs'][i]} for i in range(len(frames))]
    boxes=[f.getbbox() for f in frames]
    meta['bounds']=[min(b[0] for b in boxes),min(b[1] for b in boxes),max(b[2] for b in boxes),max(b[3] for b in boxes)]
    (ROOT/filename.replace('.png','.json')).write_text(json.dumps(meta,ensure_ascii=False,indent=2),encoding='utf-8')
    return sheet

blink=extract_blink()
base=np.asarray(blink[0]).copy()
# Copy complete, opaque generated eye regions. Feather only the outer cream border.
mask=Image.new('L',blink[0].size)
draw=ImageDraw.Draw(mask)
draw.rounded_rectangle((61,218,149,351),radius=15,fill=255)
draw.rounded_rectangle((213,218,301,351),radius=15,fill=255)
eye_mask=np.asarray(mask.filter(ImageFilter.GaussianBlur(2)),dtype=np.float32)/255
eye_mask[eye_mask>.97]=1
clean_blink=[]
for frame in blink:
    rgb=np.asarray(frame)[:,:,:3]
    out=base.copy()
    out[:,:,:3]=np.uint8(np.round(rgb*eye_mask[:,:,None]+base[:,:,:3]*(1-eye_mask[:,:,None])))
    clean_blink.append(Image.fromarray(out))
order=list(range(12))+list(range(11,-1,-1))
blink_meta={'version':4,'id':'blink','label':'眨眼','anchor':{'x':181,'y':620},'durationMs':500,
            'frameDurationsMs':[500/24]*24,'loop':True,
            'method':'12 crisp generated eye poses, closed/open traversal; no crossfade of pupils or eyelids. Static base outside the eye patches.'}
save_sheet([clean_blink[i] for i in order],'pipi-blink-clean.png',blink_meta)
contact=Image.new('RGBA',(362*4,724*3),'#233c34')
for i,f in enumerate(clean_blink):contact.alpha_composite(f,((i%4)*362,(i//4)*724))
contact.convert('RGB').resize((1086,1629)).save(ROOT/'pipi-blink-clean-check.jpg')

wave_source=Image.open(ROOT/'pipi-wave-v2.png').convert('RGBA')
wave_meta=json.loads((ROOT/'pipi-wave-v2.json').read_text(encoding='utf-8'))
w,h=wave_meta['frameWidth'],wave_meta['frameHeight']
raw=[clean_edges(wave_source.crop((i*w,0,(i+1)*w,h))) for i in range(wave_meta['frameCount'])]
wave_base=np.asarray(raw[0]).copy()
# Body/face/feet come from one reference. The only writable area is the moving wing.
wing_region=np.zeros((h,w),dtype=np.uint8)
wing_region[55:565,:312]=255
head=wave_base[:,:,3].copy();head[378:]=0
head=cv2.dilate(np.uint8(head>8),np.ones((3,3),np.uint8))
wing_region[head>0]=0
fixed=wing_region==0
yy,xx=np.mgrid[:h,:w]
seam_width=np.where((xx>288)&(yy>378),12,1.5)
weight=np.minimum(cv2.distanceTransform(np.uint8(~fixed),cv2.DIST_L2,5)/seam_width,1)[:,:,None]
stable=[]
for frame in raw:
    out=wave_base.copy();data=np.asarray(frame)
    # Feather only the seam inside the wing-root region; the fixed pixels stay exact.
    a=wave_base.astype(np.float32)/255;b=data.astype(np.float32)/255
    a[:,:,:3]*=a[:,:,3:4];b[:,:,:3]*=b[:,:,3:4]
    mix=a*(1-weight)+b*weight
    mix[:,:,:3]=np.divide(mix[:,:,:3],mix[:,:,3:4],out=np.zeros_like(mix[:,:,:3]),where=mix[:,:,3:4]>1e-6)
    out[~fixed]=np.uint8(np.clip(np.round(mix*255),0,255))[~fixed]
    out[(out[:,:,3]<8)&~fixed]=0
    stable.append(Image.fromarray(out))
wave_meta['method']='One fixed raster base for head, torso, opposite wing and feet; generated moving wing region only. Cleaned alpha contour and decontaminated edge RGB.'
save_sheet(stable,'pipi-wave-stable.png',wave_meta)
preview=Image.new('RGBA',(w*4,h*2),'#233c34')
for i,index in enumerate([0,2,4,7,9,11,13,15]):preview.alpha_composite(stable[index],((i%4)*w,(i//4)*h))
preview.convert('RGB').resize((1200,round(1200*h*2/(w*4)))).save(ROOT/'pipi-wave-stable-check.jpg')
assert all(np.array_equal(np.asarray(f)[fixed],wave_base[fixed]) for f in stable)
assert all(np.array_equal(np.asarray(f)[eye_mask==0],base[eye_mask==0]) for f in clean_blink)
assert stable[0].tobytes()==stable[-1].tobytes()
for f in stable:
    b=f.getbbox();assert b[0]>=24 and b[2]<=w-24 and b[1]>=24 and b[3]<=h-24
print('PASS: static pixels identical outside moving regions; all wave margins safe; matched loop endpoints; 24 clean blink frames / 41 stable wave frames')
