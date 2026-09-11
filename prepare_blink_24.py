"""24-frame blink: landmark-aligned image inbetweening of existing PNG eyes.
No new character artwork; body and alpha remain identical to the first frame.
Requires Pillow, numpy, opencv-python-headless.
"""
from pathlib import Path
import json
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

root=Path(__file__).resolve().parent/'assets'
source=Image.open(root/'pipi-blink-strip.png').convert('RGBA')
w,h=362,724
frames=[np.asarray(source.crop((i*w,0,(i+1)*w,h))).copy() for i in range(3)]
base=frames[0]
mask=Image.new('L',(w,h))
draw=ImageDraw.Draw(mask)
for x in (106,251):
    draw.ellipse((x-49,217,x+49,351),fill=255)
mask=np.asarray(mask.filter(ImageFilter.GaussianBlur(5)),dtype=np.float32)[...,None]/255
grid_x,grid_y=np.meshgrid(np.arange(w,dtype=np.float32),np.arange(h,dtype=np.float32))
# Eyelid landmarks in the three supplied images: top and bottom of eye opening.
landmarks=[(244,328),(277,328),(306,313)]

def warp_eye(image,source_landmarks,target_landmarks):
    top,bottom=source_landmarks
    target_top,target_bottom=target_landmarks
    ys=np.interp(np.arange(h),[0,217,target_top,target_bottom,351,h-1],
                 [0,217,top,bottom,351,h-1]).astype(np.float32)
    return cv2.remap(image[:,:,:3],grid_x,np.repeat(ys[:,None],w,axis=1),
                     cv2.INTER_CUBIC,borderMode=cv2.BORDER_REFLECT)

def interpolate(position):
    index=min(1,int(position))
    t=position-index
    a,b=frames[index],frames[index+1]
    target=tuple(landmarks[index][j]*(1-t)+landmarks[index+1][j]*t for j in range(2))
    wa=warp_eye(a,landmarks[index],target)
    wb=warp_eye(b,landmarks[index+1],target)
    rgb=wa.astype(np.float32)*(1-t)+wb.astype(np.float32)*t
    result=base.copy()
    result[:,:,:3]=np.clip(rgb*mask+base[:,:,:3]*(1-mask),0,255).astype(np.uint8)
    if position==0: return Image.fromarray(base)
    return Image.fromarray(result)

positions=[2*i/7 for i in range(8)]+[2,2]+[2*(1-(i+1)/12) for i in range(12)]+[0,0]
out=Image.new('RGBA',(w*24,h))
contact=Image.new('RGBA',(w*6,h*4),'#243b39')
for i,p in enumerate(positions):
    frame=interpolate(p)
    out.paste(frame,(i*w,0))
    contact.alpha_composite(frame,((i%6)*w,(i//6)*h))
out.save(root/'pipi-blink-24.png')
contact.convert('RGB').resize((1086,1448)).save(root/'pipi-blink-24-check.jpg')
meta={'version':3,'id':'blink','image':'pipi-blink-24.png','frameWidth':w,'frameHeight':h,
      'columns':24,'frameCount':24,'fps':48,'duration':.5,'loop':True,
      'frames':[{'x':i*w,'y':0,'w':w,'h':h} for i in range(24)],
      'method':'Landmark-aligned image interpolation between existing open/half/closed eye artwork; fixed body and alpha.',
      'source':'pipi-blink-strip.png'}
(root/'pipi-blink-24.json').write_text(json.dumps(meta,indent=2),encoding='utf-8')
assert len(positions)==24
assert out.mode=='RGBA' and out.size==(8688,724)
assert out.crop((0,0,w,h)).tobytes()==out.crop((23*w,0,24*w,h)).tobytes()
print('PASS: 24 RGBA cells, 8688x724, matching loop endpoints; unique frames:',len({out.crop((i*w,0,(i+1)*w,h)).tobytes() for i in range(24)}))
