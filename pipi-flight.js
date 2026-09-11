/* Local-file-compatible sprite flight controller. No runtime pixel morphing. */
(() => {
  'use strict';
  const config=window.PIPI_FLIGHT, assets=config.assets, $=id=>document.getElementById(id);
  const canvas=$('flightCanvas'),ctx=canvas.getContext('2d'),cache=new Map(),pending=new Map();
  const ground=config.movement.groundY,scale=config.movement.spriteScale;
  const keys=new Set(),pointers=new Map(),speed=()=>Number($('flightSpeed').value);
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),ease=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
  const labels={ground:'默认站姿',takeoff:'起飞蓄力',air:'持续飞行',turn:'平滑转向',landing:'落地回稳'};
  const dirs={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right',w:'up',s:'down',a:'left',d:'right'};
  const bounds=Object.values(assets).reduce((b,m)=>[
    Math.max(b[0],(m.anchor.x-m.bounds[0])*scale),Math.max(b[1],(m.anchor.y-m.bounds[1])*scale),
    Math.max(b[2],(m.bounds[2]-m.anchor.x)*scale),Math.max(b[3],(m.bounds[3]-m.anchor.y)*scale)
  ],[0,0,0,0]);
  const limits={minX:20+bounds[0],maxX:canvas.width-20-bounds[2],minAlt:60,maxAlt:ground-20-bounds[1]};
  const s={ready:false,mode:'live',phase:'ground',paused:false,x:500,alt:0,vx:0,vy:0,facing:'front',
    elapsed:0,wing:0,clip:'takeoff',frame:0,landRequested:false,landStart:0,turn:null,demo:false,demoTime:0,
    inspectTime:0,inspectEnded:false,loading:false};
  let previous=null,renderTimes=[],inspectRevision=0,inspectWarmup=0;
  const clockStats={ticks:0,hidden:0,loading:0,paused:0,warmup:0,advancedMs:0,blur:0,visibility:0};
  function clearInput(){keys.clear();pointers.clear();document.querySelectorAll('[data-dir]').forEach(b=>b.classList.remove('held'));}
  function manual(){s.demo=false;$('demoFlight').textContent='完整演示 · 起飞 → 八向飞行 → 落地';}
  function activeDirections(){
    const set=new Set([...keys].map(k=>dirs[k]).filter(Boolean));for(const d of pointers.values())for(const part of d.split('-'))set.add(part);return set;
  }
  function inputVector(){
    const d=activeDirections();let x=Number(d.has('right'))-Number(d.has('left')),y=Number(d.has('up'))-Number(d.has('down'));
    if(s.demo&&s.phase!=='ground'&&s.phase!=='takeoff'){
      const t=s.demoTime;
      const route=[[0,1],[1,1],[1,0],[1,-1],[0,-1],[-1,-1],[-1,0],[-1,1]];
      const leg=Math.floor(t/2000);if(leg<route.length){[x,y]=route[leg];}else{x=0;y=0;s.landRequested=true;}
    }
    if(s.landRequested)return {x:0,y:s.alt>60.5?-1:0};
    const length=Math.hypot(x,y)||1;return {x:x/length,y:y/length};
  }
  function chooseFacing(v){
    if(s.landRequested)return 'front';
    if(v.x!==0){const side=v.x<0?'left':'right';return v.y===0?side:(v.y>0?'up-':'down-')+side;}
    if(v.y!==0)return 'front';return s.facing;
  }
  function useClip(key,frame){
    s.clip=key;s.frame=clamp(frame,0,assets[key].frameCount-1);
    if(cache.has(key)){s.loading=false;return;}
    s.loading=true;load(key,assets[key]).then(()=>{if(s.clip===key){s.loading=false;previous=null;render();sync();}}).catch(e=>{$('flightStatus').textContent=e.message;s.paused=true;});
  }
  function frameFor(key,time){return PipiTiming.frame(PipiTiming.timeline(assets[key]),time);}
  function reset(){
    clearInput();manual();Object.assign(s,{mode:'live',phase:'ground',paused:false,x:500,alt:0,vx:0,vy:0,facing:'front',
      elapsed:0,wing:0,landRequested:false,turn:null,inspectEnded:false,demoTime:0});useClip('takeoff',0);previous=null;
    $('inspectTransport').hidden=true;render();sync();
  }
  function takeoff(){
    if(!s.ready)return;
    if(s.mode!=='live')reset();
    if(s.phase!=='ground')return;
    Object.assign(s,{phase:'takeoff',elapsed:0,paused:false,landRequested:false});useClip('takeoff',0);warm('hover');previous=null;sync();
  }
  function requestLand(){
    if(!s.ready||s.mode!=='live'||s.phase==='ground'||s.phase==='landing')return;
    clearInput();manual();s.landRequested=true;warm('land');warmTurn('front');sync();
  }
  function turnPath(target){
    const graph=config.turnGraph,queue=[{node:s.facing,path:[]}],seen=new Set([s.facing]);let path;
    while(queue.length){const item=queue.shift();if(item.node===target){path=item.path;break;}
      for(const edge of graph){const reverse=edge.to===item.node;if(edge.from!==item.node&&!reverse)continue;
        const next=reverse?edge.from:edge.to;if(seen.has(next))continue;seen.add(next);
        queue.push({node:next,path:[...item.path,{clip:edge.clip,reverse,to:next}]});}}
    return path||[];
  }
  function warm(key){load(key,assets[key]).catch(()=>{});}
  function warmTurn(target){const next=turnPath(target)[0];if(next){warm(next.clip);warm(next.to==='front'?'hover':next.to);}}
  function beginTurn(target){
    const path=turnPath(target);if(!path.length)return;s.turn=path[0];
    s.phase='turn';s.elapsed=0;s.wing=0;
    useClip(s.turn.clip,s.turn.reverse?assets[s.turn.clip].frameCount-1:0);
    warm(s.turn.to==='front'?'hover':s.turn.to);
    if(path[1]){warm(path[1].clip);warm(path[1].to==='front'?'hover':path[1].to);}
  }
  function beginLand(){
    s.phase='landing';s.elapsed=0;s.landStart=s.alt;s.vx=0;s.vy=0;useClip('land',0);
  }
  function movement(dt,v){
    const moveSpeed=Number($('moveSpeed').value);
    const targetX=s.landRequested?0:v.x*moveSpeed,targetY=v.y*moveSpeed;
    const k=1-Math.exp(-dt/.18);
    s.vx+=(targetX-s.vx)*k;s.vy+=(targetY-s.vy)*k;
    const nextX=s.x+s.vx*dt,nextAlt=s.alt+s.vy*dt;
    s.x=clamp(nextX,limits.minX,limits.maxX);s.alt=clamp(nextAlt,limits.minAlt,limits.maxAlt);
    if(s.x!==nextX)s.vx=0;if(s.alt!==nextAlt)s.vy=0;
  }
  function step(ms){
    if(!s.ready||s.paused||s.loading)return;
    if(s.mode==='inspect'){
      const meta=assets[$('flightClip').value];
      s.inspectTime+=ms;
      if(s.inspectTime>=meta.durationMs){
        if($('inspectLoop').checked)s.inspectTime%=meta.durationMs;
        else{s.inspectTime=meta.durationMs-.001;s.paused=true;s.inspectEnded=true;}
      }
      useClip(meta.id,frameFor(meta.id,s.inspectTime));return;
    }
    if(s.phase==='ground')return;
    if(s.phase==='takeoff'){
      s.elapsed+=ms;useClip('takeoff',frameFor('takeoff',s.elapsed));
      const duration=assets.takeoff.durationMs;
      const liftAt=PipiTiming.timeline(assets.takeoff).starts[16];
      s.alt=config.movement.hoverAltitude*ease((s.elapsed-liftAt)/(duration-liftAt));
      if(s.elapsed>=duration){s.phase='air';s.wing=0;s.alt=config.movement.hoverAltitude;useClip('hover',0);}
      return;
    }
    if(s.phase==='landing'){
      s.elapsed+=ms;useClip('land',frameFor('land',s.elapsed));
      s.alt=s.landStart*(1-ease(s.elapsed/PipiTiming.timeline(assets.land).starts[10]));
      if(s.elapsed>=assets.land.durationMs){
        s.phase='ground';s.alt=0;s.landRequested=false;s.facing='front';s.demo=false;
        useClip('takeoff',0);manual();
      }
      return;
    }
    if(s.demo)s.demoTime+=ms;
    const vector=inputVector();
    // Movement integration is independent of wing timing.
    for(let remaining=ms;remaining>0;){
      const slice=Math.min(remaining,1000/120);movement(slice/1000,vector);remaining-=slice;
    }
    if(s.phase==='turn'){
      s.elapsed+=ms;const t=s.turn,meta=assets[t.clip],n=frameFor(t.clip,s.elapsed);
      useClip(t.clip,t.reverse?meta.frameCount-1-n:n);
      if(s.elapsed>=meta.durationMs){s.facing=t.to;s.phase='air';s.turn=null;s.wing=0;useClip(s.facing==='front'?'hover':s.facing,0);}
      return;
    }
    const target=chooseFacing(vector),cycle=config.timing.wingbeatMs,oldWing=s.wing;
    s.wing=(s.wing+ms)%cycle;
    // View changes share a horizontal-wing drawing and pass through front.
    if((oldWing===0||oldWing+ms>=cycle)&&target!==s.facing){beginTurn(target);return;}
    if(s.landRequested&&s.facing==='front'&&s.alt<=60.5&&(oldWing===0||oldWing+ms>=cycle)){beginLand();return;}
    useClip(s.facing==='front'?'hover':s.facing,frameFor(s.facing==='front'?'hover':s.facing,s.wing));
  }
  function draw(){
    const m=assets[s.clip],tile=cache.get(s.clip)?.tiles[s.frame];if(!tile)return;
    const inspect=s.mode==='inspect',x=inspect?500:s.x,y=inspect?570:ground-s.alt;
    const drawScale=inspect ? .85 : scale;
    ctx.clearRect(0,0,canvas.width,canvas.height);
    if(!inspect){
      ctx.strokeStyle=$('flightBackground').value==='dark'?'#547668':'#d4e7df';ctx.lineWidth=1;
      ctx.beginPath();ctx.moveTo(24,ground+2);ctx.lineTo(976,ground+2);ctx.stroke();
    }
    ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
    const rest=m.restPose?.frames.includes(s.frame)?m.restPose:null;
    if(rest)PipiSprites.draw(ctx,cache.get(s.clip),s.frame,
      x-(m.anchor.x-rest.x)*drawScale,y-(m.anchor.y-rest.y)*drawScale,rest.width*drawScale,rest.height*drawScale,rest);
    else PipiSprites.draw(ctx,cache.get(s.clip),s.frame,x-m.anchor.x*drawScale,y-m.anchor.y*drawScale,m.frameWidth*drawScale,m.frameHeight*drawScale);
    if($('flightGuides').checked){
      ctx.strokeStyle='#e28e4d';ctx.lineWidth=1;
      ctx.strokeRect(x-m.anchor.x*drawScale,y-m.anchor.y*drawScale,m.frameWidth*drawScale,m.frameHeight*drawScale);
      ctx.beginPath();ctx.moveTo(x-10,y);ctx.lineTo(x+10,y);ctx.moveTo(x,y-10);ctx.lineTo(x,y+10);ctx.stroke();
    }
  }
  function render(){
    const start=performance.now();draw();
    const meta=assets[s.clip],inspect=s.mode==='inspect';
    $('phaseLabel').textContent=inspect?meta.label:s.landRequested&&s.phase==='air'?'准备落地':labels[s.phase];
    $('coordinates').textContent=inspect?(s.frame+1)+' / '+meta.frameCount:'X '+Math.round(s.x)+' · 高度 '+Math.round(s.alt);
    $('flightStatus').textContent=!s.ready||s.loading?'正在加载飞行素材…':s.paused?'已暂停':inspect?'片段预览':s.demo?'完整演示中':labels[s.phase];
    $('pauseFlight').textContent=s.paused?'继续':'暂停';
    document.querySelectorAll('[data-phase]').forEach(el=>el.classList.toggle('active',el.dataset.phase===(s.phase==='turn'?'air':s.phase)));
    if(inspect){
      $('flightTimeline').value=s.frame;$('frameCounter').value=(s.frame+1)+' / '+meta.frameCount;
      $('flightFilmstrip').querySelectorAll('button').forEach((b,i)=>b.classList.toggle('active',i===s.frame));
    }
    renderTimes.push(performance.now()-start);if(renderTimes.length>900)renderTimes.shift();
  }
  function sync(){
    $('takeoff').disabled=!s.ready||(s.mode==='live'&&s.phase!=='ground');
    $('land').disabled=!s.ready||s.mode!=='live'||s.phase==='ground'||s.phase==='landing'||s.landRequested;
    for(const id of ['pauseFlight','resetFlight','demoFlight','flightClip','inspectClip','liveFlight'])$(id).disabled=!s.ready;
    document.querySelectorAll('[data-dir]').forEach(b=>b.disabled=!s.ready||s.mode!=='live'||s.paused||s.phase==='landing'||s.landRequested);
    $('modeLabel').textContent=s.mode==='inspect'?'逐帧检查':'自由飞行';
    $('flightHint').textContent=s.mode==='inspect'?'拖动时间轴或点击缩略图检查每一帧。点击“返回自由飞行”继续控制方向。':'点击“起飞”，然后按住方向按钮、方向键或 WASD。松开后悬停；空格起飞 / 落地。';
  }
  function updateAssetLinks(){
    const m=assets[$('flightClip').value];
    $('flightPng').href='assets/'+m.image;$('flightJson').href='assets/pipi-flight-'+m.id+'.json';
    $('flightAssetInfo').textContent=m.frameCount+' 帧 · 每格 '+m.frameWidth+' × '+m.frameHeight+' · '+(m.durationMs/1000).toFixed(2)+' 秒'+(m.loop?' / 循环':'');
  }
  async function inspect(){
    if(!s.ready)return;
    const revision=++inspectRevision;
    clearInput();manual();s.mode='inspect';s.paused=false;s.inspectTime=0;s.inspectEnded=false;
    const key=$('flightClip').value;useClip(key,0);previous=null;
    await load(key,assets[key]);if(s.mode!=='inspect'||s.clip!==key||revision!==inspectRevision)return;s.loading=false;previous=null;
    $('inspectTransport').hidden=false;$('flightTimeline').max=assets[key].frameCount-1;
    const fragment=document.createDocumentFragment();
    cache.get(key).tiles.forEach((tile,i)=>{
      const b=document.createElement('button'),thumb=document.createElement('canvas');thumb.width=156;thumb.height=128;
      PipiSprites.draw(thumb.getContext('2d'),cache.get(key),i,0,0,156,128);b.append(thumb,document.createTextNode(String(i+1)));
      b.title='第 '+(i+1)+' 帧';b.addEventListener('click',()=>seek(i));fragment.append(b);
    });
    $('flightFilmstrip').replaceChildren(fragment);updateAssetLinks();sync();render();
    // Let the new thumbnail row and first pose reach the compositor before
    // starting the clock. Initial layout/raster work must not advance poses.
    inspectWarmup=2;previous=null;
  }
  function seek(frame){
    if(s.mode!=='inspect'||!s.ready)return;
    const key=$('flightClip').value;useClip(key,clamp(frame,0,assets[key].frameCount-1));
    s.inspectTime=PipiTiming.timeline(assets[key]).starts[s.frame];s.paused=true;s.inspectEnded=false;previous=null;render();sync();
  }
  function togglePause(){
    if(!s.ready)return;
    s.paused=!s.paused;clearInput();s.vx=0;s.vy=0;previous=null;
    if(!s.paused&&s.inspectEnded){s.inspectTime=0;s.inspectEnded=false;}
    sync();render();
  }
  $('takeoff').addEventListener('click',()=>{manual();takeoff();});
  $('land').addEventListener('click',requestLand);$('pauseFlight').addEventListener('click',togglePause);
  $('resetFlight').addEventListener('click',reset);$('liveFlight').addEventListener('click',reset);
  $('inspectClip').addEventListener('click',inspect);
  $('flightClip').addEventListener('change',()=>{updateAssetLinks();if(s.mode==='inspect')inspect();});
  $('framePrev').addEventListener('click',()=>seek(s.frame-1));$('frameNext').addEventListener('click',()=>seek(s.frame+1));
  $('flightTimeline').addEventListener('input',e=>seek(Number(e.target.value)));
  $('flightBackground').addEventListener('change',()=>{$('flightStage').dataset.bg=$('flightBackground').value;render();});
  $('flightGuides').addEventListener('change',render);
  $('flightSpeed').addEventListener('input',()=>{$('flightSpeedValue').value=speed()+'×';previous=null;});
  $('moveSpeed').addEventListener('input',()=>{$('moveSpeedValue').value=$('moveSpeed').value+' px/s';});
  $('demoFlight').addEventListener('click',()=>{
    if(s.demo){reset();return;}reset();s.demo=true;s.demoTime=0;
    $('demoFlight').textContent='停止演示';takeoff();
  });
  document.querySelectorAll('[data-dir]').forEach(button=>{
    button.disabled=true;
    button.addEventListener('pointerdown',e=>{
      if(button.disabled||e.button>0)return;
      e.preventDefault();manual();pointers.set(e.pointerId,button.dataset.dir);button.classList.add('held');
      button.setPointerCapture(e.pointerId);warmTurn(chooseFacing(inputVector()));if(s.phase==='ground')takeoff();
    });
    const release=e=>{pointers.delete(e.pointerId);button.classList.remove('held');};
    for(const event of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(event,release);
  });
  function keyName(e){return e.key.length===1?e.key.toLowerCase():e.key;}
  document.addEventListener('keydown',e=>{
    const key=keyName(e),form=e.target.closest('input,select,textarea');
    if(form||e.ctrlKey||e.metaKey||e.altKey||!s.ready)return;
    if(key===' '){if(e.target.closest('button,a'))return;e.preventDefault();if(!e.repeat){manual();s.phase==='ground'?takeoff():requestLand();}return;}
    if(!dirs[key]||s.mode!=='live'||s.paused||s.phase==='landing'||s.landRequested)return;
    e.preventDefault();manual();keys.add(key);warmTurn(chooseFacing(inputVector()));if(s.phase==='ground')takeoff();
  });
  document.addEventListener('keyup',e=>keys.delete(keyName(e)));
  window.addEventListener('blur',()=>{clockStats.blur++;clearInput();s.vx=0;s.vy=0;previous=null;});
  document.addEventListener('visibilitychange',()=>{clockStats.visibility++;clearInput();s.vx=0;s.vy=0;previous=null;});
  function tick(now){
    const warming=s.mode==='inspect'&&inspectWarmup>0&&!s.loading&&!document.hidden;
    if(warming)inspectWarmup--;
    clockStats.ticks++;if(document.hidden)clockStats.hidden++;if(s.loading)clockStats.loading++;if(s.paused)clockStats.paused++;if(previous===null)clockStats.warmup++;
    if(previous!==null&&!document.hidden&&!s.loading&&!s.paused&&!warming)clockStats.advancedMs+=Math.min(50,Math.max(0,now-previous))*speed();
    if(previous!==null&&!document.hidden&&!warming)step(Math.min(50,Math.max(0,now-previous))*speed());
    previous=now;if(s.ready){render();sync();}requestAnimationFrame(tick);
  }
  async function load(key,meta){
    if(cache.has(key)){const item=cache.get(key);cache.delete(key);cache.set(key,item);return item;}
    if(pending.has(key))return pending.get(key);
    const job=(async()=>{
    const out=await PipiSprites.load(meta);cache.set(key,out);
    while(cache.size>4){const old=[...cache.keys()].find(k=>k!==s.clip);if(!old)break;PipiSprites.dispose(cache.get(old));cache.delete(old);}
    return out;
    })().finally(()=>pending.delete(key));pending.set(key,job);return job;
  }
  window.PipiFlightDebug=Object.freeze({
    snapshot:()=>({...s,turn:s.turn?{...s.turn}:null,limits:{...limits},input:[...activeDirections()],clock:{...clockStats},hidden:document.hidden,meta:assets[s.clip]}),
    configuration:()=>JSON.parse(JSON.stringify(config)),
    performance:()=>{const a=[...renderTimes].sort((a,b)=>a-b);return {samples:a.length,p95Ms:a[Math.floor(a.length*.95)]||0,maxMs:a.at(-1)||0};}
  });
  Object.entries(assets).forEach(([key,m])=>{$('flightClip').add(new Option(m.label,key));});
  updateAssetLinks();
  Promise.all(['takeoff','hover'].map(key=>load(key,assets[key]))).then(()=>{s.ready=true;reset();requestAnimationFrame(tick);}).catch(error=>{
    $('flightStatus').textContent=error.message;$('flightHint').textContent='素材加载失败，请确认 assets 文件夹与本页面保存在一起。';
  });
})();
