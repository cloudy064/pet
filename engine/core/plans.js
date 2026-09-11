'use strict';
const { AnimationPlan, Timeline, SustainPlan, CombinedPlan, range } = require('./timeline');
const { positive, smooth, clamp, direction } = require('./utils');

const HEADINGS={n:'up',s:'down',e:'right',w:'left',ne:'up-right',nw:'up-left',se:'down-right',sw:'down-left'};
const waveFrames=[25,26,27,28,29,30,31,32,33,34,25,26,27,28,29,28,27,26,25];
const waveTimes=[120,70,65,65,80,110,80,65,65,70,160,85,80,90,150,90,80,85,520];

class MotionPlan extends Timeline {
  constructor(segments,assets,{from,to,lift=0,direction:heading,mode}) {
    super(segments,assets);this.from=from;this.destination=to;this.lift=lift;this.direction=heading;this.mode=mode;
  }
  sample(elapsed) {
    const sample=super.sample(elapsed),segment=sample.segment,time=sample.segmentTime;
    const progress=segment.phase==='cruise'?(this.mode==='flight'?smooth(time/segment.duration):clamp(time/segment.duration,0,1))
      : ['return','land','outro'].includes(segment.phase)?1:0;
    const altitude=segment.phase==='takeoff'?this.lift*smooth((time-segment.liftStart)/(segment.duration-segment.liftStart))
      :segment.phase==='land'?this.lift*(1-smooth(time/segment.liftEnd)):this.mode==='flight'?this.lift:0;
    return {...sample,x:this.from.x+(this.destination.x-this.from.x)*progress,y:this.from.y+(this.destination.y-this.from.y)*progress,altitude,phase:segment.phase,direction:this.direction};
  }
}

class GrowPlan extends AnimationPlan {
  constructor(from,to,duration=1200) {super();this.from=positive(from,'Starting scale');this.targetScale=positive(to,'Target scale');this.duration=positive(duration,'Growth duration');this.assetIds=['base:idle'];}
  sample(elapsed) {
    const t=clamp(elapsed/this.duration,0,1),scale=this.from+(this.targetScale-this.from)*smooth(t);
    return {layers:[{asset:'base:idle',frame:0}],scale,pulse:1+.07*Math.sin(Math.PI*t),frame:0,asset:'base:idle',phase:'grow'};
  }
}

function atPosition(plan,context) {
  const sample=plan.sample.bind(plan);
  plan.sample=elapsed=>({x:context.position.x,y:context.position.y,scale:context.scale,altitude:0,...sample(elapsed)});
  return plan;
}

class PlanFactory {
  constructor() {
    this.types=new Map();
    this.register('clip',(action,options,context)=>{
      const loop=options.loop===undefined?action.loop:options.loop;
      return new Timeline([{asset:action.asset,frames:action.frames,durations:action.durations,repeat:(loop===true||options.sustain)?Infinity:loop||1}],context.assets);
    });
    this.register('wave',(action,options,context)=>new SustainPlan({
      open:{asset:action.asset,frames:range(0,24)},
      loop:{asset:action.asset,frames:action.loopFrames||waveFrames,durations:action.loopDurations||waveTimes},
      close:{asset:action.asset,frames:range(36,60)},holdMs:options.holdMs===undefined?action.holdMs||2200:options.holdMs,sustain:!!options.sustain
    },context.assets));
    this.register('point',(action,options,context)=>new SustainPlan({
      open:{asset:action.asset,frames:range(0,17),durations:[60,...Array(17).fill(40)]},
      loop:{asset:action.asset,frames:[18],durations:[40]},
      close:{asset:action.asset,frames:range(17,0),durations:[...Array(17).fill(40),80]},
      holdMs:options.holdMs===undefined?action.holdMs||1800:options.holdMs,sustain:!!options.sustain
    },context.assets));
    this.register('walk',(action,options,context)=>{
      const to=context.destination(options,action,context.position),from=context.position,heading=direction(to.x-from.x,to.y-from.y),key='walk:'+heading;
      const distance=Math.hypot(to.x-from.x,to.y-from.y),cycles=Math.max(1,Math.round(distance/(context.size*(options.stride||action.stride||.65))));
      return new MotionPlan([
        {asset:key,frames:range(0,13),phase:'intro'},
        {asset:key,frames:range(14,45),repeat:cycles,phase:'cruise'},
        {asset:key,frames:range(46,60),phase:'outro'}
      ],context.assets,{from,to,mode:'walk',direction:heading});
    });
    this.register('flight',(action,options,context)=>{
      const to=context.destination(options,action,context.position),from=context.position,dir=direction(to.x-from.x,to.y-from.y),heading=HEADINGS[dir];
      const path=[];if(!['up','down'].includes(heading)) {const side=dir.includes('w')?'left':'right';path.push('turn-'+side);if(heading!==side)path.push('bank-'+heading);}
      const meta=id=>context.assets.get('flight:'+id),sum=(id,n)=>meta(id).durations.slice(0,n).reduce((a,b)=>a+b,0);
      const cycle=sum(heading),distance=Math.hypot(to.x-from.x,to.y-from.y);
      const cycles=Math.max(1,Math.ceil(Math.max(650,distance/(.15*context.size/96))/cycle));
      const segments=[{asset:'flight:takeoff',phase:'takeoff',liftStart:sum('takeoff',16)}];
      for(const id of path)segments.push({asset:'flight:'+id,phase:'turn'});
      segments.push({asset:'flight:'+heading,repeat:cycles,phase:'cruise'});
      for(const id of path.slice().reverse())segments.push({asset:'flight:'+id,frames:range(meta(id).durations.length-1,0),phase:'return'});
      segments.push({asset:'flight:land',phase:'land',liftEnd:sum('land',10)});
      return new MotionPlan(segments,context.assets,{from,to,mode:'flight',direction:dir,lift:options.lift===undefined?context.size*86/240:Math.max(0,options.lift)});
    });
    this.register('grow',(action,options,context)=>new GrowPlan(context.scale,options.scale===undefined?context.scale*1.1:options.scale,options.duration||action.duration||1200));
  }
  register(type,builder) {if(typeof builder!=='function')throw new TypeError('Action builder must be a function');this.types.set(type,builder);return this;}
  build(action,options,context) {
    if(action.type==='sequence') {
      const plans=[];let state={...context,position:{...context.position}};
      for(const step of action.steps)for(let i=0;i<(step.repeat||1);i++) {
        const child=context.actions.get(step.action);if(child.enabled===false)throw new Error('Sequence action is disabled: '+child.id);
        const plan=this.build(child,step.options||{},state);plans.push(plan);
        if(plan.destination)state={...state,position:{...plan.destination}};
        if(plan.targetScale)state={...state,scale:plan.targetScale,size:context.baseSize*plan.targetScale};
      }
      const result=new CombinedPlan(plans);result.destination=state.position;result.targetScale=state.scale;return result;
    }
    const builder=this.types.get(action.type);if(!builder)throw new Error('No builder for action type: '+action.type);
    const plan=builder(action,options,context);
    if(!plan||typeof plan.sample!=='function'||!Array.isArray(plan.assetIds)||!(plan.duration>=0))throw new TypeError('Custom builder must return an AnimationPlan');
    return atPosition(plan,context);
  }
}
module.exports={PlanFactory,MotionPlan,GrowPlan,HEADINGS};
