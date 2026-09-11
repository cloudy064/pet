'use strict';
const { positive, clamp } = require('./utils');

function frameAt(durations, elapsed) {
  let remaining=Math.max(0,elapsed);
  for (let i=0;i<durations.length-1;i++) {if(remaining<durations[i])return i;remaining-=durations[i];}
  return durations.length-1;
}
const range=(first,last)=>Array.from({length:Math.abs(last-first)+1},(_,i)=>first+i*Math.sign(last-first));

class AnimationPlan {
  constructor() { this.duration=0;this.assetIds=[]; }
  sample() { throw new Error('AnimationPlan.sample must be implemented'); }
  release() {}
}

class Timeline extends AnimationPlan {
  constructor(segments,assets) {
    super();if(!segments.length)throw new TypeError('Timeline requires segments');
    this.segments=segments.map((input,index)=>{
      const asset=assets.get(input.asset);
      const frames=input.frames||range(0,asset.frameMap.length-1);
      if (!frames.length||frames.some(f=>!Number.isInteger(f)||f<0||f>=asset.frameMap.length)) throw new RangeError('Frame outside asset: '+input.asset);
      const durations=input.durations||frames.map(f=>asset.durations[f]);
      if(durations.length!==frames.length)throw new RangeError('Duration count differs from frame count');
      durations.forEach(t=>positive(t,'Frame duration'));
      const repeat=input.repeat===Infinity?Infinity:input.repeat===undefined?1:positive(input.repeat,'Repeat count');
      if(repeat===Infinity && index!==segments.length-1)throw new TypeError('Only the last segment may loop forever');
      const speed=input.speed===undefined?1:positive(input.speed,'Segment speed');
      const times=durations.map(t=>t/speed),cycle=times.reduce((a,b)=>a+b,0);
      return {...input,frames:[...frames],durations:times,cycle,duration:cycle*repeat};
    });
    this.duration=this.segments.reduce((sum,s)=>sum+s.duration,0);
    this.assetIds=[...new Set(this.segments.map(s=>s.asset))];
  }
  sample(elapsed) {
    let time=clamp(elapsed,0,this.duration),segment=this.segments[this.segments.length-1];
    for (const current of this.segments) {segment=current;if(time<current.duration)break;time-=current.duration;}
    if (elapsed>=this.duration && Number.isFinite(this.duration)) time=segment.duration;
    const finished=Number.isFinite(segment.duration)&&time>=segment.duration;
    const phaseTime=finished?segment.cycle:time%segment.cycle;
    const frame=segment.frames[frameAt(segment.durations,phaseTime)];
    return {layers:[{asset:segment.asset,frame}],segment,segmentTime:time,frame,asset:segment.asset};
  }
}

class SustainPlan extends AnimationPlan {
  constructor({open,loop,close,holdMs=0,sustain=false},assets) {
    super();this.open=new Timeline([open],assets);this.loop=new Timeline([loop],assets);this.close=new Timeline([close],assets);
    this.assetIds=[...new Set([...this.open.assetIds,...this.loop.assetIds,...this.close.assetIds])];
    this.closeAt=sustain?Infinity:this.open.duration+Math.max(1,Math.ceil(holdMs/this.loop.duration))*this.loop.duration;
    this.duration=this.closeAt+this.close.duration;
  }
  release(elapsed) {
    if (this.closeAt!==Infinity) return;
    const cycles=Math.max(1,Math.ceil(Math.max(0,elapsed-this.open.duration)/this.loop.duration));
    this.closeAt=this.open.duration+cycles*this.loop.duration;this.duration=this.closeAt+this.close.duration;
  }
  sample(elapsed) {
    if(elapsed<this.open.duration)return {...this.open.sample(elapsed),phase:'open'};
    if(elapsed<this.closeAt)return {...this.loop.sample((elapsed-this.open.duration)%this.loop.duration),phase:'loop'};
    return {...this.close.sample(elapsed-this.closeAt),phase:'close'};
  }
}

class CombinedPlan extends AnimationPlan {
  constructor(plans) {
    super();if(plans.some(p=>!Number.isFinite(p.duration)))throw new TypeError('Sequences cannot contain an unbounded loop');
    this.plans=plans;this.duration=plans.reduce((n,p)=>n+p.duration,0);this.assetIds=[...new Set(plans.flatMap(p=>p.assetIds))];
  }
  sample(elapsed) {
    let time=Math.max(0,elapsed);
    for (let i=0;i<this.plans.length;i++) {
      const plan=this.plans[i];if(time<plan.duration||i===this.plans.length-1)return plan.sample(time);time-=plan.duration;
    }
  }
}
module.exports={AnimationPlan,Timeline,SustainPlan,CombinedPlan,frameAt,range};
