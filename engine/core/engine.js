'use strict';
const {EventEmitter}=require('./events');
const {ActionRegistry}=require('./registry');
const {AssetManager}=require('./assets');
const {CanvasRenderer}=require('./renderer');
const {PlanFactory}=require('./plans');
const {Playback}=require('./playback');
const {frameAt}=require('./timeline');
const {DIRECTIONS,clamp,positive,finite,copy,deferred}=require('./utils');
const {DEFAULT_ACTIONS,DEFAULT_ASSET_BASE,DEFAULT_AUDIO_BASE,installPipiAssets}=require('../presets/pipi');

class PipiEngine extends EventEmitter {
  constructor(options={}) {
    super();
    if(!options.adapter)throw new TypeError('Provide a WebAdapter or WechatAdapter');
    this.adapter=options.adapter;this.options=options;this.destroyed=false;this.visible=true;this.paused=false;this.status='loading';
    this.width=positive(options.width||this.adapter.canvas.clientWidth||this.adapter.canvas.width||360,'Width');
    this.height=positive(options.height||this.adapter.canvas.clientHeight||this.adapter.canvas.height||320,'Height');
    this.baseSize=positive(options.size||112,'Body size');this.scale=positive(options.scale||1,'Scale');this.speed=positive(options.speed||1,'Speed');
    this.dpr=positive(options.dpr||1,'Pixel ratio');this.position={x:this.width/2,y:this.height*.8,...options.position};
    finite(this.position.x,'x');finite(this.position.y,'y');
    this.time=0;this.idleTime=0;this.lastTime=null;this.frameId=null;this.autoTick=options.autoTick!==false;this.random=options.random||Math.random;
    this.assets=options.assets||new AssetManager(this.adapter,{maxBytes:options.maxMemoryBytes||48*1024*1024});
    this.assetBaseURL=options.assetBaseURL||DEFAULT_ASSET_BASE;
    if(options.preset!==false)installPipiAssets(this.assets,this.assetBaseURL);
    if(options.manifest)this.assets.import(options.manifest,{baseURL:this.assetBaseURL});
    this.actions=options.actions||new ActionRegistry(options.preset===false?[]:DEFAULT_ACTIONS);
    this.actions.assetResolver=id=>this.assets.get(id);
    for(const action of this.actions.list())this.actions.validate(action);
    this.plans=new PlanFactory();this.renderer=new CanvasRenderer(this.adapter);this.renderer.resize(this.width,this.height,this.dpr);
    this.current=null;this.queue=[];this.plugins=[];this.sequenceGeneration=0;this.free=null;this.speech=null;this.manualSpeaking=false;
    this.pointer=null;this.tap=null;this.idleLease=null;this.lastState=null;
    this._offRegistry=this.actions.on('change',detail=>this.emit('librarychange',detail));
    this._unbind=this.adapter.bind?this.adapter.bind(this,{interactive:options.interactive!==false}):()=>{};
    this.ready=this.initialize();this.ready.catch(error=>this.emit('error',{error,phase:'initialize'}));
  }
  async initialize() {
    const keys=['base:idle'];if(this.assets.has('base:talk'))keys.push('base:talk');
    const lease=await this.assets.acquire(keys);
    if(this.destroyed){lease.release();throw new Error('Engine destroyed');}
    this.idleLease=lease;this.position=this.constrain(this.position);this.status='ready';this.draw();this.schedule();this.emit('ready',this.snapshot());return this;
  }
  ensureAlive() {if(this.destroyed)throw new Error('Engine destroyed');}
  get size() {return this.baseSize*this.scale;}
  snapshot() {
    return {status:this.status,action:this.current?this.current.action:'idle',position:{...this.position},size:this.size,scale:this.scale,speed:this.speed,
      paused:this.paused,visible:this.visible,speaking:!!this.speech||this.manualSpeaking,frame:this.lastState?this.lastState.frame||0:0,
      elapsed:this.current?this.current.elapsed:0,duration:this.current?this.current.duration:0,queue:this.queue.map(p=>p.action),free:!!this.free,cache:this.assets.stats()};
  }
  bounds({lift=0}={}) {
    const ext=[0,0,0,0];
    for(const id of this.assets.list()) {
      const a=this.assets.get(id);if(a.patch)continue;const z=this.size/a.subjectHeight,c=a.crop;
      const values=[(a.anchor.x-c.x)*z,(a.anchor.y-c.y)*z,(c.x+c.w-a.anchor.x)*z,(c.y+c.h-a.anchor.y)*z];
      values.forEach((v,i)=>{ext[i]=Math.max(ext[i],v);});
    }
    const pad=this.options.padding===undefined?8:Math.max(0,this.options.padding);
    let left=pad+ext[0],right=this.width-pad-ext[2],top=pad+ext[1]+lift,bottom=this.height-pad-ext[3];
    if(left>right)left=right=this.width/2;if(top>bottom)top=bottom=this.height*.8;
    return {left,right,top,bottom};
  }
  constrain(point,options) {
    finite(point.x,'x');finite(point.y,'y');const b=this.bounds(options);
    return {x:clamp(point.x,b.left,b.right),y:clamp(point.y,b.top,b.bottom)};
  }
  setPosition(x,y) {
    this.ensureAlive();this.stop();this.position=this.constrain(typeof x==='object'?x:{x,y});this.draw();this.emit('move',this.snapshot());return this;
  }
  setScale(scale) {this.ensureAlive();this.scale=positive(scale,'Scale');this.position=this.constrain(this.position);this.draw();this.emit('scale',this.snapshot());return this;}
  resize(width,height,dpr=this.dpr) {
    this.ensureAlive();positive(width,'Width');positive(height,'Height');positive(dpr,'Pixel ratio');
    this.pointerCancel();this.stop();this.width=width;this.height=height;this.dpr=dpr;this.renderer.resize(width,height,dpr);this.position=this.constrain(this.position);this.draw();return this;
  }
  setSpeed(speed) {this.speed=positive(speed,'Speed');this.emit('speed',this.snapshot());return this;}
  context() {
    return {assets:this.assets,actions:this.actions,position:{...this.position},scale:this.scale,size:this.size,baseSize:this.baseSize,
      destination:(options,action,from=this.position)=>{
        let to=options.to;
        if(!to) {
          const vector=DIRECTIONS[options.direction||'e'];if(!vector)throw new TypeError('Expected one of eight direction codes');
          const distance=options.distance===undefined?this.size*1.5:positive(options.distance,'Distance'),norm=Math.hypot(...vector);
          to={x:from.x+vector[0]*distance/norm,y:from.y+vector[1]*distance/norm};
        }
        const end=this.constrain(to,{lift:action.type==='flight'?this.size*86/240:0});
        if(Math.hypot(end.x-from.x,end.y-from.y)<1)throw new RangeError('Destination is outside the available movement area');
        return end;
      }};
  }
  play(id,options={}) {
    this.ensureAlive();const action=this.actions.get(id);if(action.enabled===false)throw new Error('Action disabled: '+id);
    if(options.speed!==undefined)positive(options.speed,'Playback speed');
    if(!options.queue)this.stop({clearQueue:true,reason:'replaced'});
    const playback=new Playback(this,id,{...options});this.queue.push(playback);this.pump();return playback;
  }
  async pump() {
    if(this.destroyed||this.current||!this.queue.length)return;
    const playback=this.current=this.queue.shift();playback.status='loading';this.status='loading';
    try {
      await this.ready;
      if(this.current!==playback||this.destroyed)return;
      const action=this.actions.get(playback.action);playback.definition=action;
      const plan=this.plans.build(action,playback.options,this.context());playback.plan=plan;playback.duration=plan.duration;
      const keys=[...plan.assetIds,'base:idle'];if(this.assets.has('base:talk'))keys.push('base:talk');
      const lease=await this.assets.acquire(keys);
      if(this.current!==playback||this.destroyed){lease.release();return;}
      playback.lease=lease;playback.status='playing';this.status='playing';this.idleTime=0;
      if(playback.wantsRelease)this.release(playback);
      playback._ready.resolve({status:'ready',action:playback.action});this.draw();this.emit('start',{playback,action:playback.action});this.schedule();
    } catch(error) {
      if(this.current!==playback||this.destroyed)return;
      this.finish(playback,'failed',{error});this.emit('error',{error,action:playback.action,phase:'play'});
    }
  }
  finish(playback,status,detail={}) {
    if(playback!==this.current)return;
    if(playback.lease)playback.lease.release();
    this.current=null;this.status='ready';playback.settle(status,detail);this.idleTime=0;
    if(this.free)this.free.next=this.time+this.free.minDelay+this.random()*(this.free.maxDelay-this.free.minDelay);
    this.emit(status==='finished'?'finish':'cancel',{...playback.result,playback});this.draw();this.pump();
  }
  cancel(playback) {
    if(playback===this.current){this.stop({clearQueue:false,reason:'cancelled'});return;}
    const index=this.queue.indexOf(playback);if(index>=0){this.queue.splice(index,1);playback.settle('cancelled',{reason:'cancelled'});}
  }
  stop({clearQueue=true,reason='stopped'}={}) {
    this.sequenceGeneration++;
    if(clearQueue){for(const item of this.queue)item.settle('cancelled',{reason});this.queue=[];}
    this.stopSpeech(reason);this.manualSpeaking=false;
    if(this.current)this.finish(this.current,'cancelled',{reason});
    return this;
  }
  release(playback=this.current) {
    if(!playback||playback.result)return this;playback.wantsRelease=true;
    if(playback.plan) {
      if(typeof playback.plan.release==='function')playback.plan.release(playback.elapsed);
      if(playback.plan.duration===Infinity) { // Generic looping clip: finish its current cycle.
        const cycle=playback.plan.segments&&playback.plan.segments[0].cycle;
        playback.releaseAt=cycle?Math.max(cycle,Math.ceil(playback.elapsed/cycle)*cycle):playback.elapsed;
      }
      playback.duration=Number.isFinite(playback.plan.duration)?playback.plan.duration:playback.releaseAt;
    }
    return this;
  }
  moveTo(to,{mode='walk',...options}={}) {if(!['walk','flight'].includes(mode))throw new TypeError('Movement mode must be walk or flight');return this.play(mode,{...options,to});}
  growTo(scale,options={}) {return this.play('grow',{...options,scale:positive(scale,'Target scale')});}
  seek(elapsed) {
    this.ensureAlive();finite(elapsed,'Elapsed time');if(!this.current||!this.current.plan)return this;
    this.current.elapsed=clamp(elapsed,0,this.current.duration);this.applySample();this.draw();this.emit('seek',this.snapshot());return this;
  }
  pause() {this.paused=true;this.halt();if(this.speech&&this.speech.audio)this.speech.audio.pause();this.emit('pause',this.snapshot());return this;}
  resume() {this.ensureAlive();this.paused=false;this.lastTime=null;if(this.visible&&this.speech&&this.speech.audio)this.playAudio(this.speech);this.schedule();this.emit('resume',this.snapshot());return this;}
  setVisible(visible) {
    this.visible=!!visible;this.pointerCancel();this.lastTime=null;
    if(!this.visible){this.halt();if(this.speech&&this.speech.audio)this.speech.audio.pause();}
    else {if(!this.paused&&this.speech&&this.speech.audio)this.playAudio(this.speech);this.schedule();}
    return this;
  }
  halt() {if(this.frameId!==null){this.adapter.cancelFrame(this.frameId);this.frameId=null;}}
  schedule() {
    if(!this.autoTick||this.destroyed||this.paused||!this.visible||!this.idleLease||this.frameId!==null)return;
    this.frameId=this.adapter.requestFrame(()=>{
      this.frameId=null;const now=this.adapter.now(),dt=this.lastTime===null?0:Math.max(0,now-this.lastTime);this.lastTime=now;this.update(dt);this.schedule();
    });
  }
  update(milliseconds) {
    finite(milliseconds,'Delta time');if(milliseconds<0)throw new RangeError('Delta time cannot be negative');
    if(this.destroyed||this.paused||!this.visible||!this.idleLease)return;
    const dt=milliseconds*this.speed;this.time+=dt;
    if(this.tap&&this.time>=this.tap.at){this.tap=null;this.play('pet');if(this.options.interactionAudio)this.speak(this.options.interactionAudio,{gesture:'pet'});}
    const current=this.current;
    if(current&&current.status==='playing') {
      current.elapsed+=dt*(current.options.speed||1)*(current.definition.speed||1);this.applySample();this.draw();
      if(current.elapsed>=current.duration){
        if(current.plan.destination)this.position={...current.plan.destination};
        if(current.plan.targetScale)this.scale=current.plan.targetScale;
        this.finish(current,'finished');
      }
    } else if(!current) {
      this.idleTime+=dt;
      if(this.free&&this.time>=this.free.next&&!this.pointer)this.runFree();
      else if(this.options.autoBlink!==false&&this.idleTime>=3300&&this.actions.has('blink')&&!this.pointer){this.play('blink');}
      this.draw();
    }
    if(this.speech){this.speech.elapsed+=milliseconds;if(this.speech.elapsed>=this.speech.timeout)this.endSpeech(this.speech,'failed',new Error('Speech timeout'));}
    this.emit('frame',this.snapshot());
  }
  applySample() {
    if(!this.current||!this.current.plan)return;
    const state=this.current.plan.sample(this.current.elapsed);
    if(Number.isFinite(state.x)&&Number.isFinite(state.y))this.position={x:state.x,y:state.y};
    if(Number.isFinite(state.scale))this.scale=state.scale;
  }
  draw() {
    if(!this.idleLease||this.destroyed)return;
    const playback=this.current&&this.current.status==='playing'?this.current:null;
    const sample=playback?playback.plan.sample(playback.elapsed):{layers:[{asset:'base:idle',frame:0}],frame:0};
    const speaking=!!this.speech||this.manualSpeaking,activeWave=playback&&playback.definition.type==='wave';
    const mouthTimes=this.assets.has('base:talk')?this.assets.get('base:talk').durations:null;
    const mouth=mouthTimes&&(speaking||activeWave)?{frame:speaking?frameAt(mouthTimes,this.time%mouthTimes.reduce((a,b)=>a+b,0)):0}:null;
    const state={...sample,x:this.position.x,y:this.position.y,size:this.size*(sample.pulse||1),mouth,openEye:!!activeWave};
    this.lastState=state;this.renderer.draw(state,playback?playback.lease.assets:this.idleLease.assets);
  }
  setSpeaking(speaking) {this.manualSpeaking=!!speaking;this.draw();return this;}
  async speak(source,{gesture='talk',timeout=30000,...options}={}) {
    this.ensureAlive();if(typeof source!=='string'||!source)throw new TypeError('Audio source URL is required');positive(timeout,'Speech timeout');
    const playback=this.play(gesture,{...options,sustain:true});
    const done=deferred(),speech={playback,done,audio:null,elapsed:0,timeout};this.speech=speech;
    const ready=await playback.ready;
    if(this.speech!==speech||ready.status!=='ready')return {status:'cancelled'};
    try {
      speech.audio=this.adapter.createAudio(source,{ended:()=>this.endSpeech(speech,'finished'),error:error=>this.endSpeech(speech,'failed',error)});
      if(this.visible&&!this.paused)this.playAudio(speech);
      this.emit('speechstart',{source,gesture});this.draw();
    } catch(error){this.endSpeech(speech,'failed',error);}
    return done.promise;
  }
  playAudio(speech) {
    try {const result=speech.audio.play();if(result&&result.catch)result.catch(error=>this.endSpeech(speech,'failed',error));}
    catch(error){this.endSpeech(speech,'failed',error);}
  }
  endSpeech(speech,status,error) {
    if(this.speech!==speech)return;
    this.speech=null;if(speech.audio)speech.audio.dispose();speech.done.resolve({status,error});
    this.release(speech.playback);this.draw();this.emit('speechend',{status,error});
  }
  stopSpeech(reason) {
    const speech=this.speech;if(!speech)return;this.speech=null;if(speech.audio)speech.audio.dispose();speech.done.resolve({status:'cancelled',reason});
  }
  async celebrate({audio,scale=this.scale}={}) {
    positive(scale,'Target scale');this.stop();const generation=this.sequenceGeneration;
    const jump=this.play('jump');const owned=this.sequenceGeneration;
    const result=await jump.finished;if(result.status!=='finished'||this.destroyed||this.sequenceGeneration!==owned)return result;
    if(audio){const speech=await this.speak(audio);if(speech.status==='cancelled'||this.destroyed)return speech;}
    if(scale>this.scale)return this.growTo(scale).finished;
    return {status:'finished',action:'celebrate'};
  }
  startFree({actions=['blink','wink','curious','wave','pet','jump','walk','flight'],minDelay=3000,maxDelay=6000}={}) {
    positive(minDelay,'Minimum delay');positive(maxDelay,'Maximum delay');if(maxDelay<minDelay)throw new RangeError('Maximum delay is smaller than minimum');
    if(!actions.length||actions.some(id=>!this.actions.has(id)))throw new TypeError('Choose registered free actions');
    this.free={actions:[...actions],minDelay,maxDelay,next:this.time+minDelay};this.emit('freemode',true);return this;
  }
  stopFree({cancel=false}={}) {this.free=null;if(cancel)this.stop();this.emit('freemode',false);return this;}
  runFree() {
    const candidates=this.free.actions.filter(id=>this.actions.get(id).enabled!==false);if(!candidates.length){this.stopFree();return;}
    const id=candidates[Math.floor(this.random()*candidates.length)],action=this.actions.get(id);
    if(['walk','flight'].includes(action.type)) {
      const b=this.bounds({lift:action.type==='flight'?this.size*86/240:0}),to={x:b.left+this.random()*(b.right-b.left),y:b.top+this.random()*(b.bottom-b.top)};
      if(Math.hypot(to.x-this.position.x,to.y-this.position.y)<8){this.free.next=this.time+this.free.minDelay;return;}
      this.play(id,{to});
    } else this.play(id);
  }
  pointerDown(point) {
    if(this.destroyed||this.paused||!this.visible||this.pointer)return;
    finite(point.x,'Pointer x');finite(point.y,'Pointer y');this.stop();
    if(this.tap){this.tap=null;this.doubleTap=true;}else this.doubleTap=false;
    this.pointer={id:point.id,start:{x:point.x,y:point.y},origin:{...this.position},moved:false};
  }
  pointerMove(point) {
    const pointer=this.pointer;if(!pointer||pointer.id!==point.id)return;
    const dx=point.x-pointer.start.x,dy=point.y-pointer.start.y;
    if(Math.hypot(dx,dy)>8)pointer.moved=true;
    if(pointer.moved){this.position=this.constrain({x:pointer.origin.x+dx,y:pointer.origin.y+dy});this.draw();this.emit('move',this.snapshot());}
  }
  pointerUp(point) {
    const pointer=this.pointer;if(!pointer||pointer.id!==point.id)return;this.pointer=null;
    if(!pointer.moved&&!this.doubleTap)this.tap={at:this.time+350};this.doubleTap=false;
  }
  pointerCancel() {this.pointer=null;this.tap=null;this.doubleTap=false;}
  registerType(type,{validate,create}) {this.actions.addType(type,validate);this.plans.register(type,create);return this;}
  use(plugin) {
    this.ensureAlive();if(!plugin||typeof plugin.install!=='function')throw new TypeError('Plugin requires install(engine)');
    const remove=plugin.install(this);this.plugins.push(typeof remove==='function'?remove:()=>{});return this;
  }
  exportProject() {return {version:1,actions:this.actions.export().actions,assets:this.assets.export().assets,settings:{size:this.baseSize,scale:this.scale,speed:this.speed}};}
  async preload(ids) {
    await this.ready;const keys=[];
    for(const id of ids)keys.push(...this.plans.build(this.actions.get(id),{},this.context()).assetIds);
    const lease=await this.assets.acquire(keys);lease.release();return this.assets.stats();
  }
  async clearCache() {this.assets.trim({all:true});if(this.adapter.clearCache)await this.adapter.clearCache();return this.assets.stats();}
  destroy() {
    if(this.destroyed)return;this.stopFree();this.stop({reason:'destroyed'});this.destroyed=true;this.status='destroyed';this.pointerCancel();this.halt();
    this._unbind();this._offRegistry();for(const remove of this.plugins.reverse())remove();if(this.idleLease)this.idleLease.release();this.assets.dispose();this.renderer.clear();this.emit('destroy',{});this.removeAllListeners();
  }
}
module.exports={PipiEngine};
