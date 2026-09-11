"""Build uncropped equal-size wave frames with measured bounds and timed exposures.
Uses generated keyposes; preserves raster artwork, no drawn character parts.
"""
from pathlib import Path
import json
import math
import cv2
import numpy as np
from PIL import Image, ImageFilter

ROOT=Path(__file__).resolve().parent
assets=ROOT/'assets'
source=Image.open(assets/'pipi-wave-16-keyposes.png').convert('RGB')
rgb=np.asarray(source)
neutral=(rgb.max(2).astype(int)-rgb.min(2).astype(int)<=35).astype('uint8')
_,labels,_,_=cv2.connectedComponentsWithStats(neutral,connectivity=4)
edge=np.unique(np.concatenate((labels[0],labels[-1],labels[:,0],labels[:,-1])))
mask=(~np.isin(labels,edge[edge!=0])).astype('uint8')
count,parts,stats,centers=cv2.connectedComponentsWithStats(mask,connectivity=8)
ids=[i for i in range(1,count) if stats[i,4]>15000]
ids.sort(key=lambda i:(int(centers[i,1]//(source.height/4)),centers[i,0]))
assert len(ids)==16
scale=548/float(np.median([stats[i,3] for i in ids]))
sprites=[]
extents=[]
for part in ids:
    x,y,w,h,_=stats[part]
    assert x>0 and y>0 and x+w<source.width and y+h<source.height
    foot_pixels=np.argwhere(parts[y+int(h*.95):y+h,x:x+w]==part)
    anchor=(foot_pixels[:,1].min()+foot_pixels[:,1].max())/2+x
    alpha=Image.fromarray(((parts==part)*255).astype('uint8'))
    alpha=alpha.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(.45))
    rgba=source.convert('RGBA');rgba.putalpha(alpha)
    sprite=rgba.crop((x-3,y-3,x+w+3,y+h+3))
    sprite=sprite.resize((round(sprite.width*scale),round(sprite.height*scale)),Image.Resampling.LANCZOS)
    offset=(round((x-3-anchor)*scale),round(-(h+3)*scale))
    sprites.append((sprite,offset))
    extents.append((offset[0],offset[1],offset[0]+sprite.width,offset[1]+sprite.height))

padding=40
# One common canvas for the WHOLE action, determined before placing any frame.
left=min(e[0] for e in extents);right=max(e[2] for e in extents)
width=math.ceil((right-left+2*padding)/16)*16
height=724
anchor={'x':padding-left,'y':620}
keyframes=[]
for sprite,(dx,dy) in sprites:
    frame=Image.new('RGBA',(width,height))
    frame.alpha_composite(sprite,(anchor['x']+dx,anchor['y']+dy))
    keyframes.append(frame)

poses=keyframes
# Fast start, small arcs while waving, then a complete reverse path to settle.
order=list(range(16))+[14,13,12,11,10,11,12,13,14,15]+list(range(14,-1,-1))
durations=[36]*len(order)
durations[0]=25;durations[-1]=45
durations[15]=65;durations[25]=65
frames=[poses[i] for i in order]
sheet=Image.new('RGBA',(width*len(frames),height))
bounds=[]
for i,frame in enumerate(frames):
    box=frame.getbbox();bounds.append(box)
    assert box and box[0]>=24 and box[2]<=width-24 and box[1]>=24 and box[3]<=height-24,(i,box)
    sheet.paste(frame,(i*width,0))
sheet.save(assets/'pipi-wave-v2.png')
meta={'version':4,'id':'wave','label':'挥翅打招呼','image':'pipi-wave-v2.png',
      'frameWidth':width,'frameHeight':height,'frameCount':len(frames),'columns':len(frames),
      'anchor':anchor,'bounds':[min(b[0] for b in bounds),min(b[1] for b in bounds),max(b[2] for b in bounds),max(b[3] for b in bounds)],
      'durationMs':sum(durations),'frameDurationsMs':durations,'loop':True,
      'frames':[{'x':i*width,'y':0,'w':width,'h':height,'durationMs':durations[i]} for i in range(len(frames))],
      'notes':'16 generated poses, 41 timed exposures forming two waving arcs; no optical-flow ghost frames. Canvas measured from all poses around a fixed foot anchor.'}
(assets/'pipi-wave-v2.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2),encoding='utf-8')
contact=Image.new('RGBA',(width*4,height*4),'#233c34')
for i,frame in enumerate(poses):contact.alpha_composite(frame,((i%4)*width,(i//4)*height))
contact.convert('RGB').resize((1200,round(1200*height/width))).save(assets/'pipi-wave-v2-check.jpg')
assert frames[0].tobytes()==frames[-1].tobytes()
report={'frameCount':len(frames),'uniquePoses':len(poses),'width':width,'height':height,'anchor':anchor,
        'durationMs':sum(durations),'minMargins':[min(b[0] for b in bounds),min(b[1] for b in bounds),width-max(b[2] for b in bounds),height-max(b[3] for b in bounds)]}
(assets/'pipi-wave-v2-validation.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps(report))
