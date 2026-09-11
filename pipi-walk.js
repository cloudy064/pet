/* Eight independent transparent sprite strips; native per-frame playback. */
(() => {
  'use strict';
  const cfg=window.PIPI_WALK,assets=cfg.assets,$=id=>document.getElementById(id);
  const canvas=$('walkCanvas'),ctx=canvas.getContext('2d'),cache=new Map(),pending=new Map();
  const keys=new Set(),pointers=new Map(),scale=cfg.movement.spriteScale;
  const range=(m,phase)=>PipiTiming.timeline(m,...({intro:[0,13],cycle:[14,45],outro:[46,60]}[phase]||[0,60]));
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const keyDirs={ArrowUp:'n',ArrowDown:'s',ArrowLeft:'w',ArrowRight:'e',w:'n',s:'s',a:'w',d:'e'};
  const vectors={n:[0,-1],s:[0,1],w:[-1,0],e:[1,0],nw:[-1,-1],ne:[1,-1],sw:[-1,1],se:[1,1]};
  const extent=Object.values(assets).reduce((b,m)=>[Math.max(b[0],m.anchor.x-m.bounds[0]),Math.max(b[1],m.anchor.y-m.bounds[1]),Math.max(b[2],m.bounds[2]-m.anchor.x),Math.max(b[3],m.bounds[3]-m.anchor.y)],[0,0,0,0]);
  const limits={minX:20+extent[0]*scale,maxX:canvas.width-20-extent[2]*scale,minY:20+extent[1]*scale,maxY:canvas.height-20-extent[3]*scale};
  const s={ready:false,loading:false,mode:'live',phase:'idle',dir:'s',frame:0,elapsed:0,paused:false,x:500,y:560,latched:null,one:false,inspectTime:0,cycles:0};
  let previous=null,epoch=0,renderTimes=[];
  function clearInput(){keys.clear();pointers.clear();document.querySelectorAll('[data-walk-dir]').forEach(b=>b.classList.remove('held'));}
  function requested(){
    const dirs=[...[...keys].map(k=>keyDirs[k]).filter(Boolean),...pointers.values()];
    if(!dirs.length)return s.latched;
    let x=0,y=0;for(const d of dirs){x+=vectors[d][0];y+=vectors[d][1];}
    return Object.keys(vectors).find(d=>vectors[d][0]===Math.sign(x)&&vectors[d][1]===Math.sign(y))||null;
  }
  function trim(){
    while(cache.size>3){const key=[...cache.keys()].find(k=>k!==s.dir);if(!key)break;PipiSprites.dispose(cache.get(key));cache.delete(key);}
  }
  async function load(key){
    if(cache.has(key)){const a=cache.get(key);cache.delete(key);cache.set(key,a);return a;}
    if(pending.has(key))return pending.get(key);
    const job=(async()=>{
      const out=await PipiSprites.load(assets[key]);cache.set(key,out);trim();return out;
    })().finally(()=>pending.delete(key));pending.set(key,job);return job;
  }
  async function activate(key){
    const revision=++epoch;s.dir=key;s.loading=true;render();
    try{await load(key);if(revision!==epoch)return false;s.loading=false;previous=null;render();return true;}
    catch(e){if(revision===epoch){s.loading=false;s.paused=true;$('walkStatus').textContent=e.message;}return false;}
  }
  function links(){const m=assets[$('walkDirection').value];$('walkPng').href='assets/'+m.image;$('walkJson').href='assets/pipi-walk-'+m.id+'.json';$('walkAssetInfo').textContent=m.label+' · '+m.frameCount+' 帧 · 每格 '+m.frameWidth+' × '+m.frameHeight;document.querySelectorAll('[data-walk-dir]').forEach(b=>b.classList.toggle('selected',b.dataset.walkDir===m.id));}
  function select(d){$('walkDirection').value=d;links();}
  async function begin(d){s.phase='intro';s.elapsed=0;s.frame=0;select(d);await activate(d);}
  function reset(){++epoch;clearInput();Object.assign(s,{mode:'live',phase:'idle',frame:0,elapsed:0,paused:false,x:500,y:560,latched:null,one:false,inspectTime:0,cycles:0,loading:false});$('walkInspector').hidden=true;previous=null;render();sync();}
  function start(one=false){if(!s.ready)return;if(s.mode==='inspect')reset();clearInput();s.paused=false;s.one=one;s.latched=$('walkDirection').value;previous=null;}
  function stop(){clearInput();s.latched=null;s.one=false;}
  function step(ms){
    if(!s.ready||s.loading||s.paused)return;
    const m=assets[s.dir];
    if(s.mode==='inspect'){
      const t=range(m,$('walkCycleOnly').checked?'cycle':'all');
      s.inspectTime=(s.inspectTime+ms)%t.duration;s.frame=PipiTiming.frame(t,s.inspectTime);return;
    }
    const desired=requested();
    if(s.phase==='idle'){if(desired)begin(desired);return;}
    // Carry time across phase boundaries so a display refresh never loses a
    // piece of the stride. Translation and planted feet use the same clock.
    while(ms>1e-7&&s.phase!=='idle'){
      const t=range(m,s.phase),used=Math.min(ms,t.duration-s.elapsed);
      if(s.phase==='cycle'&&!$('walkInPlace').checked){
        s.x=clamp(s.x+m.stride.x*used/m.cycleDurationMs*scale,limits.minX,limits.maxX);
        s.y=clamp(s.y+m.stride.y*used/m.cycleDurationMs*scale,limits.minY,limits.maxY);
      }
      s.elapsed+=used;ms-=used;s.frame=PipiTiming.frame(t,s.elapsed);
      if(s.elapsed<t.duration-1e-7)break;
      s.elapsed=0;
      if(s.phase==='intro')s.phase='cycle';
      else if(s.phase==='outro')s.phase='idle';
      else{
        s.cycles++;
        if(s.one||!desired||desired!==s.dir){if(s.one){s.latched=null;s.one=false;}s.phase='outro';}
      }
      s.frame=s.phase==='idle'?0:range(m,s.phase).frames[0];
    }
  }
  function render(){
    const start=performance.now(),m=assets[s.dir],tile=cache.get(s.dir)?.tiles[s.frame];
    if(tile){
      ctx.clearRect(0,0,canvas.width,canvas.height);
      const inspect=s.mode==='inspect',z=inspect?.9:scale,x=inspect?500:s.x,y=inspect?590:s.y;
      if(!inspect){ctx.strokeStyle=$('walkBackground').value==='dark'?'#395346':'#d5e3db';ctx.lineWidth=1;for(let gy=320;gy<780;gy+=80){ctx.beginPath();ctx.moveTo(20,gy);ctx.lineTo(980,gy);ctx.stroke();}}
      ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
      const rest=m.restPose.frames.includes(s.frame)?m.restPose:null;
      if(rest)PipiSprites.draw(ctx,cache.get(s.dir),s.frame,x-(m.anchor.x-rest.x)*z,y-(m.anchor.y-rest.y)*z,rest.width*z,rest.height*z,rest);
      else PipiSprites.draw(ctx,cache.get(s.dir),s.frame,x-m.anchor.x*z,y-m.anchor.y*z,m.frameWidth*z,m.frameHeight*z);
      if($('walkGuides').checked){ctx.strokeStyle='#dd9856';ctx.strokeRect(x-m.anchor.x*z,y-m.anchor.y*z,m.frameWidth*z,m.frameHeight*z);ctx.beginPath();ctx.moveTo(x-10,y);ctx.lineTo(x+10,y);ctx.moveTo(x,y-10);ctx.lineTo(x,y+10);ctx.stroke();}
    }
    const label={idle:'默认站姿',intro:'转身起步',cycle:'交替迈步',outro:'停步回稳'}[s.phase];
    $('walkStatus').textContent=s.loading?'正在加载 '+assets[s.dir].label+'…':s.paused?'已暂停':s.mode==='inspect'?'逐帧检查':label;
    $('walkMode').textContent=s.mode==='inspect'?'逐帧检查':'自由行走';$('walkPhase').textContent=s.mode==='inspect'?m.label:label+' · '+m.label;
    $('walkCoordinates').textContent=s.mode==='inspect'?(s.frame+1)+' / '+m.frameCount:'X '+Math.round(s.x)+' · Y '+Math.round(s.y);
    $('pauseWalk').textContent=s.paused?'继续':'暂停';
    if(s.mode==='inspect'){$('walkTimeline').value=s.frame;$('walkFrameCounter').value=(s.frame+1)+' / '+m.frameCount;$('walkFilmstrip').querySelectorAll('button').forEach((b,i)=>b.classList.toggle('active',i===s.frame));}
    renderTimes.push(performance.now()-start);if(renderTimes.length>600)renderTimes.shift();
  }
  function sync(){for(const id of ['startWalk','stopWalk','oneWalk','pauseWalk','resetWalk','walkDirection','inspectWalk','liveWalk'])$(id).disabled=!s.ready;document.querySelectorAll('[data-walk-dir]').forEach(b=>b.disabled=!s.ready||s.paused||s.mode!=='live');}
  async function inspect(){
    stop();s.mode='inspect';s.paused=false;s.inspectTime=0;s.frame=$('walkCycleOnly').checked?14:0;previous=null;
    if(!await activate($('walkDirection').value))return;
    $('walkInspector').hidden=false;const frag=document.createDocumentFragment();
    cache.get(s.dir).tiles.forEach((t,i)=>{const b=document.createElement('button'),c=document.createElement('canvas');c.width=120;c.height=144;PipiSprites.draw(c.getContext('2d'),cache.get(s.dir),i,0,0,120,144);b.append(c,document.createTextNode(String(i+1)));b.title='第 '+(i+1)+' 帧';b.onclick=()=>seek(i);frag.append(b);});
    $('walkFilmstrip').replaceChildren(frag);sync();render();
  }
  function seek(frame){if(s.mode!=='inspect'||s.loading)return;s.frame=clamp(frame,0,60);if(s.frame<14||s.frame>45)$('walkCycleOnly').checked=false;const t=range(assets[s.dir],$('walkCycleOnly').checked?'cycle':'all');s.inspectTime=t.starts[t.frames.indexOf(s.frame)];s.paused=true;previous=null;render();sync();}
  $('startWalk').onclick=()=>start();$('oneWalk').onclick=()=>start(true);$('stopWalk').onclick=stop;
  $('pauseWalk').onclick=()=>{s.paused=!s.paused;clearInput();previous=null;render();sync();};$('resetWalk').onclick=reset;$('liveWalk').onclick=reset;$('inspectWalk').onclick=inspect;
  $('walkDirection').onchange=()=>{links();if(s.mode==='inspect')inspect();else if(s.latched)s.latched=$('walkDirection').value;};
  $('walkCycleOnly').onchange=()=>{if(s.mode==='inspect')inspect();};$('walkPrevious').onclick=()=>seek(s.frame-1);$('walkNext').onclick=()=>seek(s.frame+1);$('walkTimeline').oninput=e=>seek(Number(e.target.value));
  $('walkSpeed').oninput=()=>{$('walkSpeedValue').value=$('walkSpeed').value+'×';previous=null;};$('walkBackground').onchange=()=>{$('walkStage').dataset.bg=$('walkBackground').value;render();};$('walkGuides').onchange=render;
  document.querySelectorAll('[data-walk-dir]').forEach(b=>{
    b.onpointerdown=e=>{if(b.disabled||e.button>0)return;e.preventDefault();s.latched=null;s.one=false;pointers.set(e.pointerId,b.dataset.walkDir);select(b.dataset.walkDir);b.setPointerCapture(e.pointerId);b.classList.add('held');};
    for(const event of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(event,e=>{pointers.delete(e.pointerId);b.classList.remove('held');});
  });
  const key=e=>e.key.length===1?e.key.toLowerCase():e.key;
  document.addEventListener('keydown',e=>{if(e.target.closest('input,select,textarea')||e.ctrlKey||e.metaKey||e.altKey||!s.ready)return;const k=key(e);if(k===' '&&!e.target.closest('button,a')){e.preventDefault();if(!e.repeat)s.phase==='idle'?start():stop();return;}if(!keyDirs[k]||s.paused||s.mode!=='live')return;e.preventDefault();s.latched=null;s.one=false;keys.add(k);});
  document.addEventListener('keyup',e=>keys.delete(key(e)));
  window.addEventListener('blur',()=>{stop();previous=null;});document.addEventListener('visibilitychange',()=>{stop();previous=null;});
  // A busy compositor must not catch up by jumping over a 30 ms gait pose.
  // Apply the same bounded time to the sprite and its stride displacement.
  function tick(now){if(previous!==null&&!document.hidden)step(Math.min(30,Math.max(0,now-previous))*Number($('walkSpeed').value));previous=now;if(s.ready){render();sync();}requestAnimationFrame(tick);}
  window.PipiWalkDebug=Object.freeze({snapshot:()=>({...s,requested:requested(),limits:{...limits},cached:[...cache.keys()],meta:assets[s.dir]}),configuration:()=>JSON.parse(JSON.stringify(cfg)),performance:()=>{const a=[...renderTimes].sort((a,b)=>a-b);return {samples:a.length,p95Ms:a[Math.floor(a.length*.95)]||0,maxMs:a.at(-1)||0};}});
  Object.values(assets).forEach(m=>$('walkDirection').add(new Option(m.label,m.id)));select('s');
  activate('s').then(ok=>{if(!ok)return;s.ready=true;reset();requestAnimationFrame(tick);});
})();
