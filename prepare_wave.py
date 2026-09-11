"""Extract generated wave sprites and align feet on a transparent horizontal strip."""
from pathlib import Path
import json
import cv2
import numpy as np
from PIL import Image, ImageFilter

root=Path(__file__).resolve().parent/'assets'
im=Image.open(root/'pipi-wave-draft.png').convert('RGB')
rgb=np.asarray(im)
neutral=(rgb.max(2).astype(int)-rgb.min(2).astype(int)<=40).astype('uint8')
_,labels,stats,_=cv2.connectedComponentsWithStats(neutral,4)
border=np.unique(np.concatenate((labels[0],labels[-1],labels[:,0],labels[:,-1])))
background=np.isin(labels,border[border!=0])
mask=(~background).astype('uint8')
mask=cv2.morphologyEx(mask,cv2.MORPH_OPEN,np.ones((3,3),np.uint8))
mask[:,235:239]=0  # Separate the faint generated bridge between the first two silhouettes.
n,parts,stats,_=cv2.connectedComponentsWithStats(mask,8)
ids=sorted([i for i in range(1,n) if stats[i,cv2.CC_STAT_AREA]>10000],key=lambda i:stats[i,0])
assert len(ids)==8,[(stats[i].tolist()) for i in ids]
sheet=Image.new('RGBA',(512*8,724))
frames=[]
for i,part in enumerate(ids):
    x,y,w,h,area=stats[part]
    a=Image.fromarray(((parts==part)*255).astype('uint8')).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(.45))
    rgba=im.convert('RGBA');rgba.putalpha(a)
    sprite=rgba.crop((x-2,y-2,x+w+2,y+h+2))
    # Locate feet below 90% of the silhouette rather than centering the raised wing.
    feet=np.argwhere(parts[y+int(h*.9):y+h,x:x+w]==part)
    foot_center=(feet[:,1].min()+feet[:,1].max())/2+2
    scale=548/h
    sprite=sprite.resize((round(sprite.width*scale),round(sprite.height*scale)),Image.Resampling.LANCZOS)
    frame=Image.new('RGBA',(512,724))
    frame.alpha_composite(sprite,(round(256-foot_center*scale),round(620-(h+2)*scale)))
    frames.append(frame)
frames[-1]=frames[0].copy()
for i,f in enumerate(frames):sheet.paste(f,(i*512,0))
sheet.save(root/'pipi-wave-strip.png')
preview=Image.new('RGBA',sheet.size,'#243b39');preview.alpha_composite(sheet)
preview.convert('RGB').resize((2048,362)).save(root/'pipi-wave-check.jpg')
meta={'version':3,'id':'wave','image':'pipi-wave-strip.png','frameWidth':512,'frameHeight':724,
      'columns':8,'frameCount':8,'duration':1.4,'fps':8/1.4,'loop':True,
      'frames':[{'x':i*512,'y':0,'w':512,'h':724} for i in range(8)]}
(root/'pipi-wave-strip.json').write_text(json.dumps(meta,indent=2),encoding='utf-8')
assert sheet.getchannel('A').getextrema()==(0,255)
assert frames[0].tobytes()==frames[-1].tobytes()
print('PASS: eight extracted silhouettes, RGBA 4096x724, matched first/last frames')
