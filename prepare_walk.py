"""Register generated walking/turning artwork to one physical character scale."""
from pathlib import Path
import json
import cv2
import numpy as np
from PIL import Image,ImageDraw
from prepare_flight import extract,premult,straight

ROOT=Path(__file__).resolve().parent/'assets'
W,H=512,576
AX,AY=256,48+620*256/362
rest_im=Image.new('RGBA',(W,H))
rest_im.paste(Image.open(ROOT/'pipi-idle.png').convert('RGBA').resize((256,512),Image.Resampling.LANCZOS),(128,48))
rest=np.asarray(rest_im).copy();rest[rest[:,:,3]==0]=0

def head_measure(a):
    hsv=cv2.cvtColor(a[:,:,:3],cv2.COLOR_RGB2HSV)
    sh,sw=a.shape[:2];yy,xx=np.mgrid[:sh,:sw]
    alpha=a[:,:,3]>128
    top=int(np.where(alpha)[0].min())
    m=np.uint8((hsv[:,:,1]<100)&(hsv[:,:,2]>145)&alpha&(yy<top+(sh-top)*.65))
    _,lab,st,_=cv2.connectedComponentsWithStats(m,connectivity=8)
    ids=sorted(range(1,len(st)),key=lambda k:st[k,4],reverse=True)[:2]
    ids=[k for k in ids if st[k,4]>100]
    cy,cx=np.where(np.isin(lab,ids))
    if len(cy):bottom=int(cy.max())
    else:
        # Rear views have no cream face: find the neck immediately under
        # the round head, before the folded wings widen the silhouette.
        widths=np.array([np.ptp(np.where(row)[0])+1 if row.any() else 0 for row in alpha])
        lo=round(top+(sh-top)*.54);hi=round(top+(sh-top)*.66)
        bottom=lo+int(np.argmin(cv2.GaussianBlur(widths.astype(np.float32)[:,None],(1,9),2)[lo:hi,0]))
    strip=alpha&(yy>top+(bottom-top)*.4)&(yy<top+(bottom-top)*.75)
    sy,sx=np.where(strip);center=(sx.min()+sx.max())/2
    return np.array([center,top,bottom-top],np.float32)

def warp(a,m):
    return straight(cv2.warpAffine(premult(a),np.float32(m),(W,H),flags=cv2.INTER_CUBIC))

def montage(poses,name,cols=4):
    out=Image.new('RGBA',(W*cols,H*((len(poses)+cols-1)//cols)),'#233c34');d=ImageDraw.Draw(out)
    for i,a in enumerate(poses):
        xy=(i%cols*W,i//cols*H);out.alpha_composite(Image.fromarray(a),xy);d.text((xy[0]+12,xy[1]+12),str(i),fill='white')
    out.convert('RGB').resize((cols*320,out.height*320//W),Image.Resampling.LANCZOS).save(ROOT/name)

if __name__=='__main__':
    target=head_measure(rest)
    all_poses={};log=[]
    files=[('pipi-walk-generated.png',4,2,'sw'),('pipi-walk-turn-generated.png',3,2,'turn')]
    files += [('pipi-walk-'+d+'-generated.png',4,2,d) for d in ('s','w','nw','n')]
    for name,cols,rows,key in files:
        poses=[]
        for i,a in enumerate(extract(name,cols,rows)):
            # Neutral checker pockets between both planted feet can be
            # enclosed by the legs; they must also become transparent.
            ygrid=np.arange(a.shape[0])[:,None]
            low=(ygrid>a.shape[0]*.70)&(a[:,:,:3].max(2).astype(int)-a[:,:,:3].min(2).astype(int)<=12)
            a[low]=0
            measured=head_measure(a);scale=float(target[2]/measured[2])
            m=[[scale,0,target[0]-measured[0]*scale],[0,scale,target[1]-measured[1]*scale]]
            poses.append(warp(a,m));log.append({'atlas':name,'cell':i,'scale':scale,'head':measured.tolist(),'matrix':np.asarray(m).tolist()})
        all_poses[key]=np.stack(poses)
        montage(poses,'pipi-walk-'+key+'-registered-check.jpg',cols)
    np.savez_compressed(ROOT/'pipi-walk-registered.npz',rest=rest,**all_poses)
    (ROOT/'pipi-walk-registration.json').write_text(json.dumps(log,indent=2),encoding='utf-8')
    print('Registered five walking views and preparation turns.')
