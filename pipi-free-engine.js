/* Shared ground position + separate flight altitude. No runtime image deformation. */
((root) => {
  'use strict';
  const T=root.PipiTiming||(typeof require==='function'&&require('./pipi-timing.js'));
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
  const vectors={n:[0,-1],ne:[1,-1],e:[1,0],se:[1,1],s:[0,1],sw:[-1,1],w:[-1,0],nw:[-1,-1]};
  const headings={n:'front',s:'front',e:'right',w:'left',ne:'up-right',nw:'up-left',se:'down-right',sw:'down-left'};
  const labels={blink:'眨眼',wave:'打招呼',wink:'单眼眨眼',talk:'说话',pet:'抚摸反馈',jump:'开心跳跃',curious:'好奇歪头',walk:'散步',flight:'飞行'};
  class Engine {
    constructor(base,walk,flight,random=Math.random){
      this.base=base;this.walk=walk;this.flight=flight;this.random=random;
      this.width=1200;this.height=800;this.subjectHeight=240;this.lift=86;
      this.assets={};for(const [group,ms] of Object.entries({base,walk:walk.assets,flight:flight.assets}))
        for(const [id,m] of Object.entries(ms))this.assets[group+':'+id]=m;
      const ext=[0,0,0,0];
      for(const m of Object.values(this.assets)){
        const z=this.scale(m),b=m.bounds,a=m.anchor;
        [a.x-b[0],a.y-b[1],b[2]-a.x,b[3]-a.y].forEach((v,i)=>ext[i]=Math.max(ext[i],v*z));
      }
      // Reserve wing/body bounds and altitude before choosing a destination.
      this.limits={minX:24+ext[0],maxX:this.width-24-ext[2],minY:24+ext[1]+this.lift,maxY:this.height-28-ext[3]};
      this.history=[];this.autoBlink=true;this.reset();
    }
    scale(m){return this.subjectHeight/(m.subjectHeight||548);}
    reset(){this.x=600;this.y=620;this.alt=0;this.active=null;this.index=0;this.elapsed=0;this.idleTime=0;this.frame=0;this.key='base:idle';this.completed=0;this.history=[];}
    extentAlong(dx,dy){
      const b=this.limits;
      return Math.min(dx>0?(b.maxX-this.x)/dx:dx<0?(b.minX-this.x)/dx:Infinity,
        dy>0?(b.maxY-this.y)/dy:dy<0?(b.minY-this.y)/dy:Infinity);
    }
    available(action){
      return Object.keys(vectors).filter(dir=>{
        if(action==='walk'){const m=this.walk.assets[dir],z=this.scale(m);return this.extentAlong(m.stride.x*z,m.stride.y*z)>=1-1e-8;}
        const v=vectors[dir],len=Math.hypot(...v);return this.extentAlong(v[0]/len,v[1]/len)>=90;
      });
    }
    choose(excluded,previous){
      let choices=Object.keys(labels).filter(k=>!excluded.includes(k)&&(k!=='walk'&&k!=='flight'||this.available(k).length));
      if(choices.length>1)choices=choices.filter(k=>k!==previous);
      if(!choices.length)return null;
      const weights={blink:1,wave:1,wink:1,talk:1.2,pet:1,jump:.8,curious:1.3,walk:2,flight:1.1};
      let n=this.random()*choices.reduce((sum,k)=>sum+weights[k],0);
      return choices.find(k=>(n-=weights[k])<0)||choices.at(-1);
    }
    plan(action,requestedDirection){
      if(!labels[action])throw Error('未知动作：'+action);
      const plan={action,label:labels[action],direction:null,segments:[],start:{x:this.x,y:this.y},end:{x:this.x,y:this.y}};
      const add=(key,phase,options={})=>{
        const meta=this.assets[key];if(!meta)throw Error('缺少片段：'+key);
        const timeline=T.timeline(meta,options.first??0,options.last??meta.frameCount-1,options.reverse||false);
        const segment={key,phase,timeline,duration:timeline.duration,...options};plan.segments.push(segment);return segment;
      };
      if(action!=='walk'&&action!=='flight')add('base:'+action,labels[action]);
      else{
        const available=this.available(action);if(!available.length)return null;
        const dir=available.includes(requestedDirection)?requestedDirection:available[Math.floor(this.random()*available.length)];
        plan.direction=dir;
        if(action==='walk'){
          const m=this.walk.assets[dir],z=this.scale(m),dx=m.stride.x*z,dy=m.stride.y*z;
          const cycles=Math.min(2+Math.floor(this.random()*4),Math.floor(this.extentAlong(dx,dy)+1e-8));
          add('walk:'+dir,'转身起步',{first:0,last:13});
          for(let i=0;i<cycles;i++)add('walk:'+dir,'交替迈步',{first:14,last:45,
            move:{x0:this.x+i*dx,y0:this.y+i*dy,x1:this.x+(i+1)*dx,y1:this.y+(i+1)*dy}});
          add('walk:'+dir,'停步回稳',{first:46,last:60});
          plan.end={x:this.x+cycles*dx,y:this.y+cycles*dy};
        }else{
          const v=vectors[dir],length=Math.hypot(...v),dx=v[0]/length,dy=v[1]/length;
          const distance=Math.min(170+this.random()*180,this.extentAlong(dx,dy));
          const cycles=Math.max(2,Math.ceil(distance/100));
          const take=add('flight:takeoff','起飞蓄力');
          take.altitude={from:0,to:this.lift,start:take.timeline.starts[16],end:take.duration};
          const facing=headings[dir],path=[];
          if(facing!=='front'){
            const side=dir.includes('w')?'left':'right';path.push('turn-'+side);
            if(facing!==side)path.push('bank-'+facing);
          }
          for(const key of path)add('flight:'+key,'空中转向');
          const key='flight:'+(facing==='front'?'hover':facing);
          for(let i=0;i<cycles;i++)add(key,'持续飞行',{move:{x0:this.x,y0:this.y,x1:this.x+distance*dx,y1:this.y+distance*dy,curve:true,part:i,parts:cycles}});
          for(const key of [...path].reverse())add('flight:'+key,'转身准备落地',{reverse:true});
          const land=add('flight:land','落地回稳');
          land.altitude={from:this.lift,to:0,start:0,end:land.timeline.starts[10]};
          plan.end={x:this.x+distance*dx,y:this.y+distance*dy};
        }
      }
      plan.duration=plan.segments.reduce((n,s)=>n+s.duration,0);
      plan.keys=[...new Set(plan.segments.map(s=>s.key))];return plan;
    }
    begin(plan){
      if(this.active)throw Error('当前动作尚未结束');
      if(Math.hypot(this.x-plan.start.x,this.y-plan.start.y)>.01)throw Error('动作起点已改变');
      this.active=plan;this.index=0;this.elapsed=0;this.idleTime=0;this.apply();
    }
    apply(){
      const segment=this.active.segments[this.index],p=clamp(this.elapsed/segment.duration,0,1);
      this.key=segment.key;this.frame=T.frame(segment.timeline,this.elapsed);
      if(segment.move){const m=segment.move,q=m.curve?smooth((m.part+p)/m.parts):p;
        this.x=m.x0+(m.x1-m.x0)*q;this.y=m.y0+(m.y1-m.y0)*q;}
      if(segment.altitude){const a=segment.altitude,q=smooth((this.elapsed-a.start)/(a.end-a.start));this.alt=a.from+(a.to-a.from)*q;}
    }
    advance(ms){
      if(!Number.isFinite(ms)||ms<0)return null;
      if(!this.active){
        this.idleTime+=ms;const t=T.timeline(this.base.blink),p=this.idleTime%(3300+t.duration);
        this.key=this.autoBlink&&p>=2700&&p<2700+t.duration?'base:blink':'base:idle';
        this.frame=this.key==='base:blink'?T.frame(t,p-2700):0;return null;
      }
      while(ms>1e-8&&this.active){
        const segment=this.active.segments[this.index],used=Math.min(ms,segment.duration-this.elapsed);
        this.elapsed+=used;ms-=used;this.apply();
        if(this.elapsed<segment.duration-1e-7)break;
        this.index++;this.elapsed=0;
        if(this.index===this.active.segments.length){
          const done=this.active;this.x=done.end.x;this.y=done.end.y;this.alt=0;this.active=null;this.completed++;
          this.key='base:idle';this.frame=0;this.idleTime=0;
          this.history.unshift({action:done.action,direction:done.direction,start:done.start,end:done.end,duration:done.duration});
          this.history.length=Math.min(this.history.length,12);return done;
        }
        this.apply();
      }
      return null;
    }
    snapshot(){return {x:this.x,y:this.y,alt:this.alt,key:this.key,frame:this.frame,action:this.active?.action||'idle',direction:this.active?.direction||null,
      phase:this.active?.segments[this.index]?.phase||'自在休息',segment:this.index,elapsed:this.elapsed,completed:this.completed,
      destination:this.active?.end||null,limits:{...this.limits},history:this.history.map(h=>({...h}))};}
  }
  Engine.labels=labels;Engine.vectors=vectors;root.PipiFreeEngine=Engine;
  if(typeof module!=='undefined')module.exports=Engine;
})(typeof window==='undefined'?globalThis:window);
