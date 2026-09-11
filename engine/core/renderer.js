'use strict';
class CanvasRenderer {
  constructor(adapter) {this.adapter=adapter;this.context=adapter.canvas.getContext('2d');this.width=0;this.height=0;this.dpr=1;this.signature='';}
  resize(width,height,dpr=1) {
    this.width=width;this.height=height;this.dpr=dpr;
    this.adapter.resize(width,height,dpr);
    this.signature='';
  }
  draw(state,assets) {
    const signature=JSON.stringify([state.x,state.y,state.size,state.altitude,state.layers,state.mouth,state.openEye,[...assets.values()].map(a=>a.key)]);
    if(signature===this.signature)return false;this.signature=signature;
    const ctx=this.context,dpr=this.dpr;
    ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,this.adapter.canvas.width,this.adapter.canvas.height);
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.imageSmoothingEnabled=true;
    const idle=assets.get('base:idle');
    const paint=(asset,frame,region,replace=false)=>{
      if(!asset)return;
      const m=asset.definition,c=m.crop,t=m.tiles[m.frameMap[frame]],z=state.size/m.subjectHeight;
      if(!t)return;
      const r=region||c,x=state.x+(r.x-m.anchor.x)*z,y=state.y-(state.altitude||0)+(r.y-m.anchor.y)*z;
      if(replace)ctx.clearRect(x,y,r.w*z,r.h*z);
      ctx.drawImage(asset.images[t[0]],t[1]+(r.x-c.x)*t[3]/c.w,t[2]+(r.y-c.y)*t[4]/c.h,r.w*t[3]/c.w,r.h*t[4]/c.h,x,y,r.w*z,r.h*z);
    };
    for (const layer of state.layers) {
      let asset=assets.get(layer.asset),frame=layer.frame;
      if(!asset)continue;
      if(asset.definition.restFrames.includes(frame)&&idle&&!layer.region){asset=idle;frame=0;}
      if(asset.definition.patch){paint(idle,0);paint(asset,frame,layer.region,true);}
      else paint(asset,frame,layer.region,layer.replace);
    }
    if(state.openEye && idle) {
      const z=240/(548*256/362);
      paint(idle,0,{x:120+(183-288)*z,y:240+(141-620*256/362)*z,w:97*z,h:121*z});
    }
    if(state.mouth && assets.has('base:talk')) paint(assets.get('base:talk'),state.mouth.frame,{x:148,y:177,w:95,h:109});
    return true;
  }
  clear() {this.context.setTransform(1,0,0,1,0,0);this.context.clearRect(0,0,this.adapter.canvas.width,this.adapter.canvas.height);}
}
module.exports={CanvasRenderer};
