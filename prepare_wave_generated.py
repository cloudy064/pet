"""Pack image-generated natural greeting frames; no anatomical animation in code.

Allowed image operations: background extraction, edge cleanup, uniform whole-
character scaling, foot alignment, and equal-size transparent PNG packing.
"""
from pathlib import Path
import json
import cv2
import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent/'assets'
FRAME_W, FRAME_H = 480, 512
REST_W, REST_X = 256, 160
REST_SCALE = REST_W / 362
ANCHOR = {'x': REST_X + 181*REST_SCALE, 'y':620*REST_SCALE}
SUBJECT_HEIGHT = 548*REST_SCALE

def cutout(cell):
    rgba = np.asarray(cell.convert('RGBA')).copy()
    rgb = rgba[:, :, :3]
    if rgba[:, :, 3].min() == 0 and np.mean(rgba[:, :, 3] == 0) > .1:
        alpha = rgba[:, :, 3]
    else:
        # Neutral checker/gray background; retain enclosed white eye/face regions.
        neutral = np.uint8(rgb.max(2).astype(int)-rgb.min(2).astype(int) <= 35)
        _, parts, _, _ = cv2.connectedComponentsWithStats(neutral, connectivity=4)
        edge = np.unique(np.concatenate((parts[0],parts[-1],parts[:,0],parts[:,-1])))
        fg = np.uint8(~np.isin(parts,edge[edge!=0]))
        n, pieces, stats, _ = cv2.connectedComponentsWithStats(fg, connectivity=8)
        keep = [i for i in range(1,n) if stats[i,4] > 20]
        fg = np.uint8(np.isin(pieces,keep))*255
        alpha = cv2.GaussianBlur(fg,(3,3),.45)
        alpha[alpha<5]=0;alpha[alpha>250]=255
        # Fill antialiased RGB from the clean interior, removing background gray.
        core = cv2.erode(fg,np.ones((3,3),np.uint8)) == 255
        if core.any():
            _, nearest = cv2.distanceTransformWithLabels(np.uint8(~core),cv2.DIST_L2,5,labelType=cv2.DIST_LABEL_PIXEL)
            palette = np.zeros((int(nearest.max())+1,3),dtype=np.uint8)
            palette[nearest[core]] = rgb[core]
            rim = (alpha>0)&~core
            rgb[rim] = palette[nearest[rim]]
    rgba[:, :, 3] = alpha
    rgba[alpha==0] = 0
    result = Image.fromarray(rgba)
    bounds = result.getbbox()
    assert bounds is not None, 'Empty generated cell'
    return result, bounds

sprites, provenance, phases = [], [], []
orders = {'A':list(range(16)), 'B':list(range(3,16)), 'C':list(range(16)),
          'D':[0,1,2,4,3,5,6,8,7,9,10,11,12,14,13,15]}
phase_labels = dict(zip('ABCD',['准备抬翅','展开与眨眼','轻挥与微笑','收翅回到静态']))
for phase in 'ABCD':
    filename = f'pipi-wave-natural-{phase}.png'
    atlas = Image.open(ROOT/filename)
    clean, _ = cutout(atlas)
    clean_data = np.asarray(clean)
    _, labels, stats, centers = cv2.connectedComponentsWithStats(np.uint8(clean_data[:,:,3]>16),connectivity=8)
    ids = [i for i in range(1,len(stats)) if stats[i,4]>atlas.width*atlas.height/200]
    ids.sort(key=lambda i:(int(centers[i,1]//(atlas.height/4)),centers[i,0]))
    assert len(ids)==16,(phase,'Expected 16 complete generated characters',len(ids))
    start = len(sprites)
    # Use measured complete silhouettes, not assumed grid cuts: generation may
    # shift a crest across a nominal cell boundary.
    for cell_index in orders[phase]:
            row,col = divmod(cell_index,4)
            part = ids[cell_index]
            cx,cy,cw,ch,_ = stats[part]
            keep = cv2.dilate(np.uint8(labels==part),np.ones((3,3),np.uint8))>0
            data = clean_data.copy();data[~keep]=0
            sprite = Image.fromarray(data).crop((max(0,cx-2),max(0,cy-2),min(atlas.width,cx+cw+2),min(atlas.height,cy+ch+2)))
            l,t,r,b = sprite.getbbox()
            rgba = np.asarray(sprite)
            # Orange feet, rather than the changing wing silhouette, locate x.
            hsv = cv2.cvtColor(rgba[:, :, :3],cv2.COLOR_RGB2HSV)
            ys,xs = np.mgrid[:sprite.height,:sprite.width]
            feet = (ys>t+(b-t)*.84)&(hsv[:,:,0]<25)&(hsv[:,:,1]>100)&(rgba[:,:,3]>128)
            fy,fx = np.where(feet)
            assert len(fx)>20, (phase,row,col,'Cannot find feet')
            foot_x = (fx.min()+fx.max())/2
            foot_y = fy.max()+1
            scale = SUBJECT_HEIGHT/(foot_y-t)
            crop = sprite.crop((l,t,r,b))
            crop = crop.resize((round(crop.width*scale),round(crop.height*scale)),Image.Resampling.LANCZOS)
            x = round(ANCHOR['x']+(l-foot_x)*scale)
            y = round(ANCHOR['y']+(t-foot_y)*scale)
            frame = Image.new('RGBA',(FRAME_W,FRAME_H))
            assert x>=12 and y>=12 and x+crop.width<=FRAME_W-12 and y+crop.height<=FRAME_H-12,(phase,row,col,x,y,crop.size)
            frame.alpha_composite(crop,(x,y))
            sprites.append(frame)
            provenance.append({'source':filename,'cell':row*4+col,'scale':float(scale),'position':[x,y]})
    phases.append({'label':phase_labels[phase],'start':start,'end':len(sprites)-1})

idle = Image.open(ROOT/'pipi-idle.png').convert('RGBA').resize((REST_W,FRAME_H),Image.Resampling.LANCZOS)
rest = Image.new('RGBA',(FRAME_W,FRAME_H));rest.paste(idle,(REST_X,0))
sprites[0] = rest.copy();sprites[-1] = rest.copy()
provenance[0]={'source':'pipi-idle.png','role':'exact resting start'}
provenance[-1]={'source':'pipi-idle.png','role':'exact resting end'}
count = len(sprites)
sheet = Image.new('RGBA',(FRAME_W*count,FRAME_H))
boxes = []
for i,frame in enumerate(sprites):
    box=frame.getbbox();boxes.append(box)
    assert min(box[0],box[1],FRAME_W-box[2],FRAME_H-box[3])>=12,(i,box)
    sheet.paste(frame,(i*FRAME_W,0))
sheet.save(ROOT/'pipi-wave-generated.png')
durations = [1000/30]*count
meta = {
    'version':6,'id':'wave','label':'自然挥翅打招呼','image':'pipi-wave-generated.png',
    'frameWidth':FRAME_W,'frameHeight':FRAME_H,'frameCount':count,'columns':count,
    'anchor':ANCHOR,'subjectHeight':SUBJECT_HEIGHT,
    'bounds':[min(b[0] for b in boxes),min(b[1] for b in boxes),max(b[2] for b in boxes),max(b[3] for b in boxes)],
    'durationMs':sum(durations),'frameDurationsMs':durations,'loop':True,
    'frames':[{'x':i*FRAME_W,'y':0,'w':FRAME_W,'h':FRAME_H,'durationMs':durations[i]} for i in range(count)],
    'restPose':{'image':'pipi-idle.png','scale':REST_SCALE,'x':REST_X,'y':0,'width':REST_W,'height':FRAME_H,'frames':[0,count-1]},
    'phases':phases,
    'method':'Full character poses rendered by built-in image_gen; background extraction, uniform whole-frame scaling and foot alignment only. No rotated/stretched wing cutouts, no optical flow or crossfades.',
    'provenance':provenance,
}
(ROOT/'pipi-wave-generated.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2),encoding='utf-8')
contact = Image.new('RGBA',(FRAME_W*4,FRAME_H*4),'#233c34')
for n,i in enumerate(np.linspace(0,count-1,16).astype(int)):
    contact.alpha_composite(sprites[i],((n%4)*FRAME_W,(n//4)*FRAME_H))
contact.convert('RGB').resize((1440,1536)).save(ROOT/'pipi-wave-generated-check.jpg')
report={'frameCount':count,'size':sheet.size,'bounds':meta['bounds'],'restEndpointsMatch':sprites[0].tobytes()==rest.tobytes()==sprites[-1].tobytes(),
        'uniqueFrames':len({f.tobytes() for f in sprites}),'method':meta['method']}
(ROOT/'pipi-wave-generated-validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(report,ensure_ascii=False))
