"""Offline premultiplied raster registration and motion-compensated inbetweens."""
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from prepare_flight import premult, straight

def ease(t):
    t=float(np.clip(t,0,1));return t*t*(3-2*t)

def warp(a,m,size=None):
    size=size or (a.shape[1],a.shape[0])
    return straight(cv2.warpAffine(premult(a),np.float32(m),size,flags=cv2.INTER_CUBIC))

def composite(front,back):
    a,b=premult(front),premult(back)
    return straight(a+b*(1-a[:,:,3:4]))

def mask_image(a,mask):
    p=premult(a)*mask[:,:,None];return straight(p)

def rounded(shape,box,radius=25,blur=2):
    h,w=shape[:2];m=Image.new('L',(w,h));ImageDraw.Draw(m).rounded_rectangle(box,radius=radius,fill=255)
    return np.asarray(m.filter(ImageFilter.GaussianBlur(blur)),np.float32)/255

def gray(a):
    p=premult(a);rgb=p[:,:,:3]+np.array([.12,.18,.15])*(1-p[:,:,3:4])
    return np.uint8(np.clip((.45*cv2.cvtColor(np.float32(rgb),cv2.COLOR_RGB2GRAY)+.55*p[:,:,3])*255,0,255))

def remap(a,c):
    return cv2.remap(a,c[:,:,0],c[:,:,1],cv2.INTER_LINEAR,borderMode=cv2.BORDER_CONSTANT)

def flow(a,b):
    d=cv2.DISOpticalFlow_create(cv2.DISOPTICAL_FLOW_PRESET_MEDIUM)
    d.setFinestScale(0);d.setGradientDescentIterations(40);d.setVariationalRefinementIterations(12)
    return cv2.GaussianBlur(d.calc(gray(a),gray(b),None),(0,0),1.5)

def sdf(a):
    m=np.uint8(a[:,:,3]>=128)
    return cv2.distanceTransform(m,cv2.DIST_L2,5)-cv2.distanceTransform(1-m,cv2.DIST_L2,5)

class Morph:
    def __init__(self,a,b):
        self.a,self.b=a,b;self.pa,self.pb=premult(a),premult(b)
        self.f,self.r=flow(a,b),flow(b,a)
        self.da,self.db=sdf(a),sdf(b)
        yy,xx=np.mgrid[:a.shape[0],:a.shape[1]].astype(np.float32);self.grid=np.dstack((xx,yy))
        self.safe=cv2.erode(np.uint8(np.all(a==b,2)),np.ones((9,9),np.uint8))>0

    def inverse(self,f,t):
        c=self.grid-t*f
        for _ in range(7):c=.25*c+.75*(self.grid-t*remap(f,c))
        return c

    def at(self,t):
        if t<=0:return self.a.copy()
        if t>=1:return self.b.copy()
        l=self.inverse(self.f,t);r=self.inverse(self.r,1-t)
        out=straight(remap(self.pa,l)*(1-t)+remap(self.pb,r)*t)
        d=remap(self.da,l)*(1-t)+remap(self.db,r)*t
        out[:,:,3]=np.uint8(np.clip((d+.8)/1.6,0,1)*255)
        out[self.safe]=self.a[self.safe];out[out[:,:,3]==0]=0
        return out

def sequence(poses,keys,count):
    out=[];pairs={}
    for i in range(count):
        j=next((j for j in range(len(keys)-1) if i<=keys[j+1][0]),len(keys)-2)
        start,a=keys[j];end,b=keys[j+1];t=(i-start)/(end-start)
        if t<=0:frame=poses[a].copy()
        elif t>=1:frame=poses[b].copy()
        else:
            if (a,b) not in pairs:pairs[a,b]=Morph(poses[a],poses[b]);print('Interpolate',a,b,flush=True)
            frame=pairs[a,b].at(ease(t))
        out.append(frame)
    return out
