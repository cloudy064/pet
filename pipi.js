/* File-friendly PNG player: per-action rectangles, pixel anchors, per-frame timing. */
'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const catalog = window.PIPI_ASSETS;
  // All built-in actions share one display scale, including their transparent
  // padding. Different frame resolutions must not resize the bird on a switch.
  const builtinExtents = [0,0,0,0];
  Object.values(catalog).forEach(meta=>{
    const [l,t,r,b]=meta.bounds,{x,y}=meta.anchor,factor=548/(meta.subjectHeight||548);
    [x-l,y-t,r-x,b-y].forEach((value,i)=>builtinExtents[i]=Math.max(builtinExtents[i],value*factor));
  });
  const cache = new Map();
  const view = $('preview'), ctx = view.getContext('2d');
  const state = { action:'idle', entries:[], starts:[], duration:0, frame:0, time:0,
    playing:false, loop:true, speed:1, zoom:1, timing:'native', blinkDuration:catalog.blink.durationMs,
    autoBlink:true, imported:null, ready:false };
  let previousTime = null, importRevision = 0, waitForPaint = false;
  const renderTimes=[];
  const initialNote = $('sourceNote').innerHTML;
  const currentMeta = () => state.imported?.meta || catalog[state.action];
  const pngName = () => currentMeta().image;
  function baseEntries(asset) {
    return asset.meta.frames.map((rect,i)=>({sprite:asset,image:asset.tiles[i],rect:{x:0,y:0,w:rect.w,h:rect.h},
      anchor:asset.meta.anchor,bounds:asset.meta.bounds,
      restRect:asset.meta.restPose?.frames.includes(i)?asset.meta.restPose:null,
      subjectHeight:asset.meta.subjectHeight||548,ms:asset.meta.frameDurationsMs[i],source:i}));
  }
  function entriesForAction() {
    if(state.imported)return state.imported.entries.map(entry=>({...entry}));
    if(!['idle','blink'].includes(state.action))return baseEntries(cache.get(state.action));
    const blink = baseEntries(cache.get('blink')).map(e=>({...e,ms:e.ms*state.blinkDuration/catalog.blink.durationMs}));
    if(state.action==='blink')return blink;
    const rest=baseEntries(cache.get('idle'))[0];
    return state.autoBlink ? [{...rest,ms:2600},...blink,{...rest,ms:900}] : [{...rest,ms:4000}];
  }
  function rebuild(resetTime=false) {
    if(!state.ready)return;
    state.entries=entriesForAction();
    if(state.timing!=='native')state.entries.forEach(e=>e.ms=1000/Number(state.timing));
    let total=0;
    state.starts=state.entries.map(e=>{const start=total;total+=e.ms;return start;});
    state.duration=total;
    state.time=resetTime?0:Math.min(state.time,Math.max(0,total-.001));
    state.frame=frameAt(state.time);
    previousTime=null;
    $('timeline').max=state.entries.length-1;
    $('duration').textContent=`${(total/1000).toFixed(2)} s · 结束`;
    document.querySelector('.timeline-label span:first-child').textContent='0 s · 开始';
    document.querySelector('.timeline-label span:nth-child(2)').textContent='按实际图片帧排列';
    buildThumbnails();syncUI();render();
  }
  function frameAt(ms) {
    let low=0,high=state.starts.length-1;
    while(low<high){const mid=Math.ceil((low+high)/2);if(state.starts[mid]<=ms)low=mid;else high=mid-1;}
    return low;
  }
  function syncUI() {
    const imported=!!state.imported,meta=currentMeta();
    $('action').disabled=imported||!state.ready;
    ['play','prev','next','timeline','sheet','manifest'].forEach(id=>$(id).disabled=!state.ready);
    ['blinkOnce','waveOnce','winkOnce','talkOnce','petOnce','jumpOnce','curiousOnce'].forEach(id=>$(id).disabled=imported||!state.ready);
    $('autoBlink').disabled=imported||state.action!=='idle';
    $('blinkDuration').disabled=imported||!['idle','blink'].includes(state.action)||state.timing!=='native';
    $('play').textContent=state.playing?'暂停':'播放';
    document.querySelector('.stage-label').textContent=`${imported?'PNG':state.action.toUpperCase()} / ${meta.label}`;
    document.querySelector('.ground-label').textContent=imported?'脚底锚点固定':({wave:'抬翅 → 展开与眨眼 → 轻挥 → 收回',wink:'轻轻歪头 → 单眼眨眼 → 微笑 → 回正',talk:'张嘴 → 合拢 → 小幅张合 → 闭嘴停顿',pet:'轻轻低头 → 眯眼微笑 → 开心停留 → 缓缓回正',jump:'轻轻蓄力 → 展翅跳起 → 开心腾空 → 落地缓冲',curious:'睁眼侧头 → 好奇观察 → 停留片刻 → 缓缓回正'}[state.action]||'脚底锚点固定');
    $('assetInfo').textContent=`${meta.frameWidth} × ${meta.frameHeight} / 格 · ${meta.frameCount} 格 · 当前帧停留 ${state.entries[state.frame]?.ms.toFixed(0)||0} ms`;
    $('downloadPng').hidden=imported;$('downloadJson').hidden=imported;
    if(!imported){$('downloadPng').href='assets/'+meta.image;$('downloadJson').href='assets/'+meta.image.replace('.png','.json');}
    $('speedValue').textContent=state.speed.toFixed(2)+'×';
    $('zoomValue').textContent=state.zoom.toFixed(2)+'×';
    $('blinkDurationValue').textContent=(state.blinkDuration/1000).toFixed(2)+' s';
  }
  function layout(entry) {
    const footX=view.width*.55,footY=view.height*.88;
    // Fit shared bounds for built-ins, or the imported action's own full bounds.
    const [l,t,r,b]=entry.bounds,ax=entry.anchor.x,ay=entry.anchor.y,margin=30;
    const factor=548/(entry.subjectHeight||548);
    const extents=state.imported?[ax-l,ay-t,r-ax,b-ay].map(v=>v*factor):builtinExtents;
    const limit=Math.min((footX-margin)/Math.max(1,extents[0]),
      (view.width-footX-margin)/Math.max(1,extents[2]),
      (footY-margin)/Math.max(1,extents[1]),
      (view.height-footY-margin)/Math.max(1,extents[3]));
    const scale=Math.min(.86*state.zoom,limit)*factor;
    return {x:footX-ax*scale,y:footY-ay*scale,scale,footX,footY};
  }
  function draw(entry,opacity=1) {
    const p=layout(entry),r=entry.rect;
    ctx.globalAlpha=opacity;
    if(entry.restRect){
      // Identical resting pixels must use the same sampling rectangle even
      // when an action adds transparent padding above or beside the character.
      const s=entry.restRect;
      const dx=p.footX-(entry.anchor.x-s.x)*p.scale,dy=p.footY-(entry.anchor.y-s.y)*p.scale;
      if(entry.sprite)PipiSprites.draw(ctx,entry.sprite,entry.source,dx,dy,s.width*p.scale,s.height*p.scale,s);
      else ctx.drawImage(entry.image,s.x,s.y,s.width,s.height,dx,dy,s.width*p.scale,s.height*p.scale);
    }else if(entry.sprite)PipiSprites.draw(ctx,entry.sprite,entry.source,p.x,p.y,r.w*p.scale,r.h*p.scale);
    else ctx.drawImage(entry.image,r.x,r.y,r.w,r.h,p.x,p.y,r.w*p.scale,r.h*p.scale);
    ctx.globalAlpha=1;
  }
  function render() {
    if(!state.ready||!state.entries.length)return;
    const renderStart=performance.now();
    const index=$('reference').checked?0:state.frame;
    const entry=$('reference').checked&&!state.imported?baseEntries(cache.get('idle'))[0]:state.entries[index];
    ctx.clearRect(0,0,view.width,view.height);
    if($('onion').checked&&!state.playing&&!$('reference').checked)draw(state.entries[(index-1+state.entries.length)%state.entries.length],.2);
    draw(entry);
    if($('guides').checked){
      const p=layout(entry);ctx.save();ctx.strokeStyle='#749c8d';ctx.setLineDash([5,5]);
      ctx.strokeRect(p.x,p.y,entry.rect.w*p.scale,entry.rect.h*p.scale);
      ctx.beginPath();ctx.moveTo(p.footX,25);ctx.lineTo(p.footX,view.height-20);ctx.moveTo(25,p.footY);ctx.lineTo(view.width-25,p.footY);ctx.stroke();ctx.restore();
    }
    $('timeline').value=state.frame;
    $('counter').textContent=`${state.frame+1} / ${state.entries.length}`;
    $('status').textContent=$('reference').checked?(state.imported?'首帧对照':'静态原图对照'):`${state.playing?'播放中':'已暂停'} · ${currentMeta().label}`;
    $('assetInfo').textContent=`${currentMeta().frameWidth} × ${currentMeta().frameHeight} / 格 · ${currentMeta().frameCount} 格 · 当前帧停留 ${entry.ms.toFixed(0)} ms`;
    [...$('filmstrip').children].forEach(b=>b.classList.toggle('active',Number(b.dataset.index)===state.frame));
    renderTimes.push(performance.now()-renderStart);if(renderTimes.length>300)renderTimes.shift();
  }
  function buildThumbnails() {
    $('filmstrip').replaceChildren();
    state.entries.forEach((entry,index)=>{
      const button=document.createElement('button'),thumb=document.createElement('canvas'),label=document.createElement('span');
      thumb.width=96;thumb.height=110;
      const g=thumb.getContext('2d'),r=entry.rect,scale=Math.min(92/r.w,106/r.h);
      if(entry.sprite)PipiSprites.draw(g,entry.sprite,entry.source,(96-r.w*scale)/2,(110-r.h*scale)/2,r.w*scale,r.h*scale);
      else g.drawImage(entry.image,r.x,r.y,r.w,r.h,(96-r.w*scale)/2,(110-r.h*scale)/2,r.w*scale,r.h*scale);
      label.textContent=`${index+1} · ${Math.round(entry.ms)}ms`;
      button.dataset.index=index;button.setAttribute('aria-label',`第 ${index+1} 帧，${Math.round(entry.ms)} 毫秒`);
      button.append(thumb,label);button.onclick=()=>seek(index);$('filmstrip').append(button);
    });
  }
  function play(value) {state.playing=value;previousTime=null;waitForPaint=value;$('play').textContent=value?'暂停':'播放';render();}
  function seek(index) {if(!state.entries.length)return;play(false);state.frame=(index+state.entries.length)%state.entries.length;state.time=state.starts[state.frame];render();}
  function selectAction(action,once=false) {
    if(!state.ready||state.imported)return;
    state.action=action;$('action').value=action;$('reference').checked=false;
    if(once){state.loop=false;$('loop').checked=false;}
    rebuild(true);if(once)play(true);
  }
  function tick(now) {
    if(state.playing&&state.ready&&!document.hidden&&!$('reference').checked){
      // Let the action's new thumbnails and first pose paint before starting
      // its clock, so the initial layout cost cannot skip the first motion frame.
      if(waitForPaint){waitForPaint=false;previousTime=null;requestAnimationFrame(tick);return;}
      if(previousTime!==null){
        state.time+=Math.max(0,now-previousTime)*state.speed;
        if(state.time>=state.duration){
          if(state.loop)state.time%=state.duration;
          else{state.time=state.duration-.001;state.playing=false;$('play').textContent='播放';}
        }
        // RAF timestamps can round a 16.667 ms boundary down to 16.6 ms.
        // A sub-millisecond tolerance prevents a repeat/skip pair at 60 Hz.
        const next=frameAt(state.time+.25);
        if(next!==state.frame||!state.playing){state.frame=next;render();}
      }
      previousTime=now;
    }else previousTime=null;
    requestAnimationFrame(tick);
  }
  document.addEventListener('visibilitychange',()=>previousTime=null);
  $('action').onchange=()=>selectAction($('action').value);
  $('waveOnce').onclick=()=>selectAction('wave',true);
  $('blinkOnce').onclick=()=>selectAction('blink',true);
  $('winkOnce').onclick=()=>selectAction('wink',true);
  $('talkOnce').onclick=()=>selectAction('talk',true);
  $('petOnce').onclick=()=>selectAction('pet',true);
  $('jumpOnce').onclick=()=>selectAction('jump',true);
  $('curiousOnce').onclick=()=>selectAction('curious',true);
  $('play').onclick=()=>{if(!state.playing&&state.frame===state.entries.length-1){state.time=0;state.frame=0;}play(!state.playing);};
  $('prev').onclick=()=>seek(state.frame-1);$('next').onclick=()=>seek(state.frame+1);
  $('timeline').oninput=()=>seek(Number($('timeline').value));
  $('loop').onchange=()=>state.loop=$('loop').checked;
  $('autoBlink').onchange=()=>{state.autoBlink=$('autoBlink').checked;rebuild(true);};
  $('blinkDuration').oninput=()=>{state.blinkDuration=Number($('blinkDuration').value)*1000;rebuild(true);};
  $('fps').onchange=()=>{state.timing=$('fps').value;rebuild(true);};
  for(const key of ['speed','zoom'])$(key).oninput=()=>{state[key]=Number($(key).value);syncUI();render();};
  ['guides','onion','reference'].forEach(id=>$(id).onchange=()=>{previousTime=null;render();});
  $('background').onchange=()=>$('stage').className='stage '+$('background').value;
  function reset() {
    state.speed=1;state.zoom=1;state.timing='native';state.blinkDuration=catalog.blink.durationMs;state.loop=true;state.autoBlink=true;
    if(!state.imported){state.action='idle';$('action').value='idle';}
    $('speed').value=1;$('zoom').value=1;$('fps').value='native';$('blinkDuration').value=catalog.blink.durationMs/1000;
    $('loop').checked=true;$('autoBlink').checked=true;
    ['guides','onion','reference'].forEach(id=>$(id).checked=false);
    $('background').value='mint';$('stage').className='stage';rebuild(true);play(state.ready);
  }
  $('reset').onclick=reset;
  function download(blob,name) {const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
  function exportData() {
    // Idle is one stored pose; its automatic blink scheduling is described separately.
    const meta=currentMeta(), result=structuredClone(meta);
    result.loop=state.loop;
    if(state.action==='idle'&&!state.imported){
      result.autoBlink=state.autoBlink;result.blinkAction=catalog.blink.image.replace('.png','.json');
      result.blinkStartMs=state.entries[0].ms;
      result.blinkDurationMs=state.autoBlink?state.entries.slice(1,-1).reduce((sum,e)=>sum+e.ms,0):0;
      result.restAfterBlinkMs=state.autoBlink?state.entries.at(-1).ms:0;
      result.frameDurationsMs=[state.entries[0].ms];result.frames[0].durationMs=state.entries[0].ms;
      result.durationMs=state.entries[0].ms;result.cycleDurationMs=state.duration;
    }
    else{result.frameDurationsMs=state.entries.map(e=>e.ms);result.durationMs=state.duration;result.frames.forEach((f,i)=>f.durationMs=result.frameDurationsMs[i]);delete result.fps;delete result.duration;}
    return result;
  }
  $('manifest').onclick=()=>download(new Blob([JSON.stringify(exportData(),null,2)],{type:'application/json'}),pngName().replace('.png','.json'));
  $('sheet').onclick=()=>{
    const meta=currentMeta(),out=document.createElement('canvas');out.width=meta.frameWidth*meta.frameCount;out.height=meta.frameHeight;
    const g=out.getContext('2d');
    if(state.imported)state.imported.entries.forEach((e,i)=>g.drawImage(e.image,i*meta.frameWidth,0));
    else for(let i=0;i<meta.frameCount;i++)PipiSprites.draw(g,cache.get(state.action),i,i*meta.frameWidth,0,meta.frameWidth,meta.frameHeight);
    const name=meta.image;
    try{out.toBlob(blob=>{if(blob)download(blob,name);else $('message').textContent='导出失败，请直接下载原始 PNG。';});}
    catch{$('message').textContent='本地浏览器限制了 Canvas 导出，请使用直接下载链接。';}
  };
  function loadImage(url) {return new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(Error('无法读取图片：'+url));im.src=url;});}
  $('import').onchange=async()=>{
    const files=[...$('import').files].sort((a,b)=>a.name.localeCompare(b.name,'en',{numeric:true}));
    if(!files.length)return;
    const revision=++importRevision;
    try{
      if(files.length>96)throw Error('请一次导入不超过 96 张。');
      $('message').textContent='正在读取原尺寸 PNG…';
      const images=await Promise.all(files.map(async file=>{const url=URL.createObjectURL(file);try{return await loadImage(url);}finally{URL.revokeObjectURL(url);}}));
      if(revision!==importRevision)return;
      const w=images[0].naturalWidth,h=images[0].naturalHeight;
      if(images.some(im=>im.naturalWidth!==w||im.naturalHeight!==h))throw Error('同一个动作内部，所有帧必须宽高相同。');
      if(w*images.length>30000||w*h*images.length>40000000)throw Error('序列超过本页的长图导出尺寸限制，请减少图片或缩小整套素材。');
      const meta={version:4,id:'imported',label:'导入序列',image:'pipi-imported.png',frameWidth:w,frameHeight:h,frameCount:images.length,columns:images.length,
        anchor:{x:w/2,y:h*.9},bounds:[0,0,w,h],frameDurationsMs:images.map(()=>1000/24),frames:images.map((_,i)=>({x:i*w,y:0,w,h,durationMs:1000/24}))};
      state.imported={meta,entries:images.map((im,i)=>({image:im,rect:{x:0,y:0,w,h},anchor:meta.anchor,bounds:meta.bounds,ms:1000/24,source:i}))};
      state.ready=true;state.timing='native';$('fps').value='native';$('reference').checked=false;
      $('sourceNote').textContent=`导入的 ${images.length} 帧保持原尺寸 ${w} × ${h}；此动作的每帧使用相同画布。`;
      $('message').textContent=`已导入 ${files[0].name} → ${files.at(-1).name}`;rebuild(true);play(true);
    }catch(error){if(revision===importRevision)$('message').textContent=error.message;}
    finally{if(revision===importRevision)$('import').value='';}
  };
  $('builtin').onclick=()=>{if(cache.size<Object.keys(catalog).length)return;++importRevision;state.imported=null;$('sourceNote').innerHTML=initialNote;$('message').textContent='已切回内置动作';reset();};
  Promise.all(Object.entries(catalog).map(async([id,meta])=>{
    cache.set(id,await PipiSprites.load(meta));
  })).then(()=>{if(state.imported)return;state.ready=true;rebuild(true);play(!matchMedia('(prefers-reduced-motion: reduce)').matches);})
    .catch(error=>{$('status').textContent='加载失败';$('message').textContent=error.message;});
  // Read-only diagnostic snapshot for browser checks and debugging.
  window.PipiDebug={snapshot:()=>({action:state.action,frame:state.frame,count:state.entries.length,durationMs:state.duration,playing:state.playing,
    meta:structuredClone(currentMeta()),layout:state.entries.length?layout(state.entries[state.frame]):null,
    resourceMode:PipiSprites.mode,cacheBytes:[...cache.values()].reduce((n,a)=>n+a.bytes,0)}),exportMetadata:exportData,
    performance:()=>{const sorted=[...renderTimes].sort((a,b)=>a-b);return {samples:sorted.length,p95Ms:sorted[Math.floor(sorted.length*.95)]||0,maxMs:sorted.at(-1)||0};}};
  requestAnimationFrame(tick);
})();
