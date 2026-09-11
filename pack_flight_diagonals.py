"""Extend established flight assets with four baked diagonal banks and loops."""
from pathlib import Path
import json
import cv2
import numpy as np
from PIL import Image
from sprite_motion import warp,ease

ROOT=Path(__file__).resolve().parent/'assets'
W,H=704,576;AX,AY=352,48+620*256/362
base=np.asarray(Image.open(ROOT/'pipi-flight-right.png').convert('RGBA').crop((0,0,W,H)))

def pitch(a,angle):
    padded=np.pad(a,((32,32),(0,0),(0,0)))
    return warp(padded,cv2.getRotationMatrix2D((AX,342),angle,1))

def save(config,key,label,frames,loop):
    h=640;n=len(frames);sheet=Image.new('RGBA',(W*n,h));boxes=[]
    for i,a in enumerate(frames):
        a[a[:,:,3]==0]=0;im=Image.fromarray(a);sheet.paste(im,(i*W,0));boxes.append(im.getbbox())
    bounds=[min(b[0] for b in boxes),min(b[1] for b in boxes),max(b[2] for b in boxes),max(b[3] for b in boxes)]
    assert min(bounds[0],bounds[1],W-bounds[2],h-bounds[3])>=18,(key,bounds)
    name='pipi-flight-'+key;sheet.save(ROOT/(name+'.png'))
    m={'version':1,'id':key,'label':label,'image':name+'.png','frameWidth':W,'frameHeight':h,'frameCount':n,'columns':n,
       'anchor':{'x':AX,'y':AY+32},'subjectHeight':548*256/362,'bounds':bounds,'frameRate':40,
       'frameDurationsMs':[25]*n,'durationMs':n*25,'loop':loop,
       'frames':[{'x':i*W,'y':0,'w':W,'h':h,'durationMs':25} for i in range(n)],
       'provenance':{'method':'Previously stabilized image-generated right flight cycle, baked fixed body pitch and continuous bank transitions. Left partners are mirrored. New candidate atlases were rejected for inconsistent proportions.',
                     'prompts':'pipi-flight-diagonal-generation.md'}}
    config['assets'][key]=m;(ROOT/(name+'.json')).write_text(json.dumps(m,ensure_ascii=False,indent=2),encoding='utf-8')

def main():
    config=json.loads((ROOT/'pipi-flight.json').read_text(encoding='utf-8'))
    log=[]
    approved=Image.open(ROOT/'pipi-flight-right.png').convert('RGBA')
    for d,angle,label in [('up-right',22,'右上'),('down-right',-22,'右下')]:
        # New generated atlases were reviewed but changed the wing/body
        # proportions. Reuse the already stabilized generated flight cycle
        # and bake its bank into actual directional PNGs, not runtime CSS.
        raw=[np.asarray(approved.crop((i*W,0,(i+1)*W,H))) for i in range(32)]
        loop=[pitch(a,angle) for a in raw]
        bank=[pitch(base,angle*ease(i/16)) for i in range(17)]
        bank[0]=pitch(base,0);bank[-1]=loop[0].copy()
        log.append({'direction':d,'source':'pipi-flight-right.png','bakedAngleDegrees':angle,'frames':32,
                    'rejectedCandidate':'pipi-flight-'+d+'-generated.png','reason':'Generated variant changed wing/body proportions; stabilized existing cycle preserves identity and phase.'})
        save(config,d,label+'飞行',loop,True);save(config,'bank-'+d,'右侧转向'+label,bank,False)
        dl=d.replace('right','left');ll=label.replace('右','左')
        save(config,dl,ll+'飞行',[np.ascontiguousarray(a[:,::-1]) for a in loop],True)
        save(config,'bank-'+dl,'左侧转向'+ll,[np.ascontiguousarray(a[:,::-1]) for a in bank],False)
        config['directions'][d]=d;config['directions'][dl]=dl
        print('Saved',d,dl,flush=True)
    config['version']=2
    config['turnGraph']=[{'from':'front','to':side,'clip':'turn-'+side} for side in ('left','right')]+[
        {'from':side,'to':vertical+'-'+side,'clip':'bank-'+vertical+'-'+side} for side in ('left','right') for vertical in ('up','down')]
    (ROOT/'pipi-flight.json').write_text(json.dumps(config,ensure_ascii=False,indent=2),encoding='utf-8')
    (ROOT/'pipi-flight-assets.js').write_text('window.PIPI_FLIGHT = '+json.dumps(config,ensure_ascii=False)+';\n',encoding='utf-8')
    (ROOT/'pipi-flight-diagonal-registration.json').write_text(json.dumps(log,indent=2),encoding='utf-8')

if __name__=='__main__':main()
