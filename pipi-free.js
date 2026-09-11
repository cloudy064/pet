(() => {
  'use strict';
  const $=id=>document.getElementById(id),canvas=$('freeCanvas'),ctx=canvas.getContext('2d');
  const engine=new PipiFreeEngine(PIPI_ASSETS,PIPI_WALK,PIPI_FLIGHT);
  const cache=new Map(),pending=new Map(),budget=(PipiSprites.mode==='original'?192:96)*1024*1024,renderTimes=[];
  const directions={n:'↑ 上',ne:'↗ 右上',e:'→ 右',se:'↘ 右下',s:'↓ 下',sw:'↙ 左下',w:'← 左',nw:'↖ 左上'};
  const s={ready:false,running:false,paused:false,preparing:false,waiting:0,queued:null,previousAction:null,error:''};
  let epoch=0,prepared=null,preparingPlan=null,previous=null,lastUI=0,lastDraw='',lastHistory=-1;
  function pins(){return new Set(['base:idle','base:blink',...(engine.active?.keys||[]),...(preparingPlan?.keys||[]),...(prepared?.keys||[])]);}
  function trim(){
    const pinned=pins();let bytes=[...cache.values()].reduce((n,a)=>n+a.bytes,0);
    for(const [key,a] of cache){if(bytes<=budget)break;if(pinned.has(key))continue;
      PipiSprites.dispose(a);cache.delete(key);bytes-=a.bytes;}
  }
  async function load(key){
    if(cache.has(key)){const a=cache.get(key);cache.delete(key);cache.set(key,a);return a;}
    if(pending.has(key))return pending.get(key);
    const job=(async()=>{
      const result=await PipiSprites.load(engine.assets[key],{scale:.75});cache.set(key,result);trim();return result;
    })().finally(()=>pending.delete(key));
    pending.set(key,job);return job;
  }
  const excluded=()=>[...$('freeChoices').querySelectorAll('input:not(:checked)')].map(el=>el.value);
  function fail(error){
    s.error=error.message;s.running=false;s.preparing=false;prepared=null;preparingPlan=null;s.queued=null;trim();sync();
  }
  async function prepare(action,dir,wait=0){
    const token=++epoch;prepared=null;s.error='';s.waiting=wait;
    const plan=engine.plan(action,dir);if(!plan){s.running=false;s.error='当前位置没有足够空间，请换个方向或回到中央。';sync();return;}
    preparingPlan=plan;s.preparing=true;sync();
    try{
      // Protect the whole route from eviction and finish decoding before lift-off.
      for(const key of plan.keys){await load(key);if(token!==epoch)return;}
      if(token!==epoch)return;prepared=plan;preparingPlan=null;s.preparing=false;previous=null;trim();sync();
    }catch(error){if(token===epoch)fail(error);}
  }
  function schedule(wait){
    const action=engine.choose(excluded(),s.previousAction);
    if(!action){s.running=false;s.waiting=0;sync();return;}
    prepare(action,null,wait);
  }
  function interval(){const [a,b]=$('freeInterval').value.split(',').map(Number);return (a+Math.random()*(b-a))*1000;}
  function cancelPrepared(){++epoch;prepared=null;preparingPlan=null;s.preparing=false;s.waiting=0;trim();}
  function start(){
    if(!s.ready)return;s.running=true;s.paused=false;s.error='';previous=null;
    if(!engine.active&&!prepared&&!s.preparing)schedule(600);sync();
  }
  function stop(){s.running=false;s.queued=null;if(!engine.active)cancelPrepared();sync();}
  function reset(){cancelPrepared();Object.assign(s,{running:false,paused:false,queued:null,previousAction:null,error:''});engine.reset();previous=null;lastDraw='';lastHistory=-1;draw();sync();}
  function once(){
    if(!s.ready)return;s.paused=false;s.error='';previous=null;
    const item={action:$('freeManualAction').value,dir:$('freeManualDirection').value};
    if(engine.active){s.queued=item;sync();return;}
    s.queued=null;prepare(item.action,item.dir,0);
  }
  function advance(ms){
    if(!s.ready||s.paused)return;
    const done=engine.advance(ms);
    if(done){
      s.previousAction=done.action;trim();
      if(s.queued){const item=s.queued;s.queued=null;prepare(item.action,item.dir,250);}
      else if(s.running)schedule(interval());
      return;
    }
    if(!engine.active){
      s.waiting=Math.max(0,s.waiting-ms);
      // Finish any idle blink before starting a new full-body action.
      if(prepared&&s.waiting===0&&engine.key==='base:idle'){
        const plan=prepared;prepared=null;engine.begin(plan);trim();
      }
    }
  }
  function draw(){
    let key=engine.key,frame=engine.frame,m=engine.assets[key];
    const neutral=m.restPose?.frames.includes(frame)||key==='base:blink'&&(frame===0||frame===m.frameCount-1);
    if(neutral){key='base:idle';frame=0;m=engine.base.idle;}
    const tile=cache.get(key)?.tiles[frame];if(!tile)return;
    const signature=[key,frame,engine.x,engine.y,engine.alt,$('freeGuides').checked,$('freeBackground').value].join(':');
    if(signature===lastDraw)return;lastDraw=signature;
    const started=performance.now(),z=engine.scale(m),x=engine.x,y=engine.y-engine.alt;
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle=$('freeBackground').value==='dark'?'rgba(4,15,9,.23)':'rgba(67,107,65,.12)';
    ctx.beginPath();ctx.ellipse(x,engine.y+4,37*(1-engine.alt/220),7,0,0,Math.PI*2);ctx.fill();
    ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
    PipiSprites.draw(ctx,cache.get(key),frame,x-m.anchor.x*z,y-m.anchor.y*z,m.frameWidth*z,m.frameHeight*z);
    if($('freeGuides').checked){
      const b=engine.limits;ctx.save();ctx.strokeStyle='#9aac72';ctx.setLineDash([6,7]);ctx.lineWidth=1;
      ctx.strokeRect(b.minX,b.minY,b.maxX-b.minX,b.maxY-b.minY);
      const p=engine.active;if(p){ctx.beginPath();ctx.moveTo(p.start.x,p.start.y);ctx.lineTo(p.end.x,p.end.y);ctx.stroke();ctx.beginPath();ctx.arc(p.end.x,p.end.y,7,0,Math.PI*2);ctx.stroke();}
      ctx.setLineDash([]);ctx.beginPath();ctx.moveTo(x-10,engine.y);ctx.lineTo(x+10,engine.y);ctx.moveTo(x,engine.y-10);ctx.lineTo(x,engine.y+10);ctx.stroke();ctx.restore();
    }
    renderTimes.push(performance.now()-started);if(renderTimes.length>900)renderTimes.shift();
  }
  function sync(){
    const a=engine.snapshot();
    $('freeAction').textContent=a.phase;
    $('freeStatus').textContent=!s.ready?'准备皮皮…':s.error?'素材加载遇到问题':s.paused?'已暂停':engine.active?(s.running?'自由活动中':'完成这一轮后休息'):s.preparing?'准备下一段动作…':s.running?'自在休息':'等你开始';
    $('freeStart').disabled=!s.ready||s.running&&!s.paused;
    $('freeStart').textContent=s.running?'自由活动中':'开始自由活动';
    $('freePause').disabled=!s.ready;$('freePause').textContent=s.paused?'继续':'暂停';
    $('freeStop').disabled=!s.ready||!s.running&&!engine.active&&!prepared&&!s.preparing;
    $('freeReset').disabled=!s.ready;$('freeOnce').disabled=!s.ready;
    $('freeManualDirection').disabled=!['walk','flight'].includes($('freeManualAction').value);
    $('freeDirection').textContent=a.direction?directions[a.direction]:'';
    $('freePosition').textContent=`X ${a.x.toFixed(0)} · Y ${a.y.toFixed(0)} · 高度 ${a.alt.toFixed(0)}`;
    $('freeNext').textContent=s.paused?'动作和倒计时已冻结':engine.active?'动作完成后在当前位置休息':prepared||s.preparing?(s.waiting>0?`${(s.waiting/1000).toFixed(1)} 秒后继续`:'准备完成后继续'):excluded().length===9?'请先勾选一个自由活动的动作':s.running?'休息片刻':'点击开始，或指定一个动作';
    $('freeQueue').textContent=s.queued?`接下来：${PipiFreeEngine.labels[s.queued.action]}，等当前动作完成。`:'会等当前动作自然结束。靠近边缘时，自动选择有空间的方向。';
    $('freeError').hidden=!s.error;$('freeError').textContent=s.error?s.error+'。请确认 assets 文件夹完整，再点击开始或做一次重试。':'';
    if(lastHistory!==engine.completed){
      lastHistory=engine.completed;
      const entries=engine.history.map(h=>{const li=document.createElement('li');li.textContent=PipiFreeEngine.labels[h.action]+(h.direction?' '+directions[h.direction]:'');return li;});
      if(!entries.length){const li=document.createElement('li');li.textContent='皮皮正在等你。';entries.push(li);}
      $('freeHistory').replaceChildren(...entries);
    }
  }
  for(const [id,label] of Object.entries(PipiFreeEngine.labels)){
    const el=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.checked=true;input.value=id;el.append(input,document.createTextNode(label));$('freeChoices').append(el);
    $('freeManualAction').add(new Option(label,id));
  }
  $('freeChoices').onchange=()=>{
    engine.autoBlink=!excluded().includes('blink');
    // An in-progress gesture finishes; a disabled pending random action is replaced.
    if(s.running&&!engine.active){cancelPrepared();schedule(interval());}sync();
  };
  $('freeInterval').onchange=()=>{if(s.running&&!engine.active)s.waiting=interval();};
  $('freeStart').onclick=start;$('freeStop').onclick=stop;$('freeReset').onclick=reset;$('freeOnce').onclick=once;
  $('freePause').onclick=()=>{s.paused=!s.paused;previous=null;sync();};
  $('freeManualAction').onchange=sync;
  $('freeSpeed').oninput=()=>{$('freeSpeedValue').value=$('freeSpeed').value+'×';previous=null;};
  $('freeBackground').onchange=()=>{$('freeStage').dataset.bg=$('freeBackground').value;draw();};$('freeGuides').onchange=()=>{lastDraw='';draw();};
  document.addEventListener('visibilitychange',()=>{previous=null;});
  function tick(now){
    if(previous!==null&&!document.hidden)advance(Math.min(50,Math.max(0,now-previous))*Number($('freeSpeed').value));
    previous=now;draw();if(now-lastUI>=90){sync();lastUI=now;}requestAnimationFrame(tick);
  }
  window.PipiFreeDebug=Object.freeze({snapshot:()=>({...s,...engine.snapshot(),prepared:prepared?.action||null,cached:[...cache.keys()],cacheBytes:[...cache.values()].reduce((n,a)=>n+a.bytes,0),cacheBudget:budget,resourceMode:PipiSprites.mode}),
    configuration:()=>({width:engine.width,height:engine.height,subjectHeight:engine.subjectHeight,limits:{...engine.limits}}),
    performance:()=>{const a=[...renderTimes].sort((a,b)=>a-b);return {samples:a.length,p95Ms:a[Math.floor(a.length*.95)]||0,maxMs:a.at(-1)||0};}});
  async function initialize(){
    try{await load('base:idle');await load('base:blink');s.ready=true;draw();sync();requestAnimationFrame(tick);}
    catch(e){s.error=e.message;sync();$('freeError').textContent=e.message+'。请确认 assets 文件夹完整后刷新页面。';}
  }
  initialize();
})();
