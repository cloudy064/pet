/* No fetch/modules: the lab also works when opened using file://. */
'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const defaults = { speed: 1, fps: 48, zoom: 1, blinkDuration: .5 };
  const state = { ...defaults, action: 'idle', autoBlink: true, frame: 0, playing: false, loop: true, frames: [], imported: false };
  const size = 320;
  const sourceFrames = [];
  const waveFrames = [];
  const waveImage = new Image();
  const original = new Image();
  const canvas = $('preview'), ctx = canvas.getContext('2d');
  let lastTime = 0, accumulated = 0, importRevision = 0;
  const makeCanvas = () => Object.assign(document.createElement('canvas'), { width: size, height: size });
  function sourceIndex(time) {
    if(state.action==='idle'&&!state.autoBlink)return 0;
    const t=(time-(state.action==='blink'?.2:2.4))/state.blinkDuration;
    return t<0||t>=1?0:Math.min(23,Math.floor(t*24));
  }
  function generate() {
    if(state.action==='wave'){
      if(!waveFrames.length)return;
      state.frames=Array.from({length:Math.ceil(state.fps*1.4)},(_,i)=>waveFrames[Math.min(7,Math.floor(i/state.fps/1.4*8))]);
      state.frame=Math.min(state.frame,state.frames.length-1);refreshFrames();return;
    }
    if(!sourceFrames.length)return;
    const seconds=state.action==='blink'?state.blinkDuration+.5:4;
    // Timing only: display original PNG cells without warping or painting pixels.
    state.frames=Array.from({length:Math.ceil(state.fps*seconds)},(_,i)=>sourceFrames[sourceIndex(i/state.fps)]);
    state.frame=Math.min(state.frame,state.frames.length-1);
    refreshFrames();
  }
  function refreshFrames() {
    $('timeline').max = state.frames.length - 1;
    $('filmstrip').replaceChildren();
    for (let n = 0; n < Math.min(6, state.frames.length); n++) {
      const index = Math.floor(n * state.frames.length / Math.min(6, state.frames.length));
      const button = document.createElement('button'), thumb = makeCanvas(), label = document.createElement('span');
      thumb.getContext('2d').drawImage(state.frames[index], 0, 0);
      label.textContent = String(index + 1).padStart(2, '0');
      button.setAttribute('aria-label', `查看第 ${index + 1} 帧`);
      button.dataset.frame = index;
      button.append(thumb, label);
      button.onclick = () => seek(index);
      $('filmstrip').append(button);
    }
    $('duration').textContent = `${(state.frames.length/state.fps).toFixed(1)} s · 回到起点`;
    document.querySelector('.timeline-label span:first-child').textContent='0 s · 初始姿态';
    document.querySelector('.stage-label').textContent=state.imported?'PNG / 导入序列':state.action==='blink'?'BLINK / 双眼眨眼':'IDLE / 静止与眨眼';
    if(!state.imported&&state.action==='wave')document.querySelector('.stage-label').textContent='WAVE / 挥翅打招呼';
    if(!state.imported){
      $('autoBlink').disabled=state.action==='wave';$('blinkDuration').disabled=state.action==='wave';
      $('downloadPng').href=state.action==='wave'?'assets/pipi-wave-strip.png':'assets/pipi-blink-24.png';
      $('downloadJson').href=state.action==='wave'?'assets/pipi-wave-strip.json':'assets/pipi-blink-24.json';
    }
    document.querySelector('.timeline-label span:nth-child(2)').textContent = `${(state.frames.length/state.fps/2).toFixed(1)} s · 中点`;
    render();
  }
  function render() {
    if (!state.frames.length) return;
    ctx.clearRect(0,0,640,640);
    ctx.save();
    ctx.translate(320,576);ctx.scale(state.zoom*2,state.zoom*2);ctx.translate(-160,-288);
    if ($('onion').checked && !$('reference').checked) {
      ctx.globalAlpha=.22;ctx.drawImage(state.frames[(state.frame-1+state.frames.length)%state.frames.length],-3,0);ctx.globalAlpha=1;
    }
    ctx.drawImage(state.frames[$('reference').checked ? 0 : state.frame],0,0);
    ctx.restore();
    if ($('guides').checked) {
      ctx.strokeStyle='#84998b';ctx.setLineDash([5,6]);ctx.beginPath();ctx.moveTo(320,40);ctx.lineTo(320,606);ctx.moveTo(50,576);ctx.lineTo(590,576);ctx.stroke();ctx.setLineDash([]);
    }
    $('timeline').value=state.frame;
    $('counter').textContent=`${String(state.frame+1).padStart(2,'0')} / ${state.frames.length}`;
    $('status').textContent=$('reference').checked ? '原始姿态对照' : `${state.playing ? '播放中' : '已暂停'} · ${state.imported ? '导入序列' : state.action==='blink'?'仅眨眼':sourceIndex(state.frame/state.fps)>0?'眨眼中':'默认姿态'}`;
    if(!state.imported&&state.action==='wave'&&!$('reference').checked)$('status').textContent=`${state.playing?'播放中':'已暂停'} · 打招呼`;
    [...$('filmstrip').children].forEach(b=>b.classList.toggle('active',state.frame >= Number(b.dataset.frame) && state.frame < Number(b.dataset.frame)+Math.ceil(state.frames.length/6)));
  }
  function setPlaying(value) { state.playing=value;lastTime=0;accumulated=0;$('play').textContent=value?'暂停':'播放';render(); }
  function seek(index) { setPlaying(false);state.frame=(index+state.frames.length)%state.frames.length;render(); }
  function tick(now) {
    if(state.playing && !document.hidden && !$('reference').checked) {
      if(lastTime) accumulated+=Math.min(now-lastTime,250)*state.speed;
      const steps=Math.floor(accumulated/(1000/state.fps));
      if(steps) {
        accumulated-=steps*1000/state.fps;
        const next=state.frame+steps;
        if(next>=state.frames.length && !state.loop) {state.frame=state.frames.length-1;setPlaying(false);}
        else state.frame=next%state.frames.length;
        render();
      }
      lastTime=now;
    } else lastTime=0;
    requestAnimationFrame(tick);
  }
  function labels() { for(const key of ['speed','zoom']) $(key+'Value').textContent=Number(state[key]).toFixed(2)+'×';$('blinkDurationValue').textContent=state.blinkDuration.toFixed(2)+' s'; }
  function selectAction(){state.action=$('action').value;state.frame=0;$('reference').checked=false;accumulated=0;generate();document.querySelector('.ground-label').textContent=state.action==='blink'?'闭合 → 短停 → 睁开':'透明 PNG · 24 帧序列播放';}
  $('action').onchange=selectAction;
  $('waveOnce').onclick=()=>{if(!waveFrames.length)return;$('action').value='wave';selectAction();state.loop=false;$('loop').checked=false;document.querySelector('.ground-label').textContent='抬翅 → 轻挥两下 → 收翅';setPlaying(true);};
  $('autoBlink').onchange=()=>{state.autoBlink=$('autoBlink').checked;if(!state.imported)generate();};
  $('blinkDuration').oninput=()=>{state.blinkDuration=Number($('blinkDuration').value);labels();if(!state.imported)generate();};
  $('blinkOnce').onclick=()=>{$('action').value='blink';selectAction();state.loop=false;$('loop').checked=false;setPlaying(true);};
  for(const key of ['speed','zoom']) $(key).oninput=()=>{state[key]=Number($(key).value);labels();render();};
  $('fps').onchange=()=>{state.fps=Number($('fps').value);accumulated=0;if(!state.imported)generate();else refreshFrames();};
  $('play').onclick=()=>{if(!state.playing&&state.frame===state.frames.length-1)state.frame=0;setPlaying(!state.playing);};
  $('prev').onclick=()=>seek(state.frame-1);$('next').onclick=()=>seek(state.frame+1);
  $('timeline').oninput=()=>{if(state.frames.length)seek(Number($('timeline').value));};
  $('loop').onchange=()=>state.loop=$('loop').checked;
  ['guides','onion','reference'].forEach(id=>$(id).onchange=render);
  $('background').onchange=()=>$('stage').className='stage '+$('background').value;
  $('reset').onclick=()=>{
    Object.assign(state,defaults,{frame:0,loop:true,action:'idle',autoBlink:true});
    $('action').value='idle';$('autoBlink').checked=true;
    for(const key of Object.keys(defaults)) $(key).value=defaults[key];
    ['guides','onion','reference'].forEach(id=>$(id).checked=false);
    $('loop').checked=true;$('background').value='mint';$('stage').className='stage';labels();
    if(!state.imported&&original.complete&&original.naturalWidth)generate();else refreshFrames();
    setPlaying(state.frames.length>0);
  };
  function download(blob,name) { const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000); }
  function exportMetadata(){
    if(!state.imported&&state.action==='wave')return {version:3,id:'wave',image:'pipi-wave-strip.png',frameWidth:512,frameHeight:724,columns:8,frameCount:8,fps:8/1.4,loop:state.loop,frames:Array.from({length:8},(_,i)=>({x:i*512,y:0,w:512,h:724}))};
    const built=!state.imported, count=built?24:state.frames.length;
    const width=built?original.naturalWidth/24:size,height=built?original.naturalHeight:size;
    return {version:3,id:built?'blink':'imported',image:built?'pipi-blink-24.png':'pipi-imported.png',
      frameWidth:width,frameHeight:height,columns:count,frameCount:count,
      fps:built?24/state.blinkDuration:state.fps,loop:state.loop,
      frames:Array.from({length:count},(_,i)=>({x:i*width,y:0,w:width,h:height}))};
  }
  $('sheet').onclick=()=>{
    const info=exportMetadata(),sheet=document.createElement('canvas');
    sheet.width=info.frameWidth*info.frameCount;sheet.height=info.frameHeight;
    const g=sheet.getContext('2d');
    if(!state.imported)g.drawImage(state.action==='wave'?waveImage:original,0,0);
    else state.frames.forEach((f,i)=>g.drawImage(f,i*size,0));
    try {sheet.toBlob(blob=>{if(blob)download(blob,info.image);else $('message').textContent='导出失败，请重试。';});}
    catch {$('message').textContent='浏览器限制了本地图片导出，请直接下载下方原始 PNG 文件。';}
  };
  $('manifest').onclick=()=>{const info=exportMetadata();download(new Blob([JSON.stringify(info,null,2)],{type:'application/json'}),info.image.replace('.png','.json'));};
  $('import').onchange=async()=>{
    const files=[...$('import').files].sort((a,b)=>a.name.localeCompare(b.name,'en',{numeric:true}));
    if(!files.length)return;
    const revision=++importRevision;
    if(files.length>96){$('message').textContent='请一次导入不超过 96 帧。';return;}
    $('message').textContent='正在读取序列…';
    try {
      const images=await Promise.all(files.map(file=>new Promise((resolve,reject)=>{const url=URL.createObjectURL(file),im=new Image();im.onload=()=>{URL.revokeObjectURL(url);resolve(im);};im.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('图片读取失败'));};im.src=url;})));
      if(revision!==importRevision)return;
      if(images.some(im=>im.width!==images[0].width||im.height!==images[0].height))throw new Error('所有帧须具有相同画布尺寸');
      state.frames=images.map(im=>{const c=makeCanvas(),g=c.getContext('2d'),scale=Math.min(size/im.width,size/im.height);g.drawImage(im,(size-im.width*scale)/2,(size-im.height*scale)/2,im.width*scale,im.height*scale);return c;});
      state.imported=true;state.frame=0;$('reference').checked=false;
      ['action','autoBlink','blinkDuration','blinkOnce','waveOnce'].forEach(id=>$(id).disabled=true);
      $('sourceNote').textContent='正在播放导入的 PNG 序列，保持原始帧画面。';
      $('message').textContent=`已导入 ${files.length} 帧：${files[0].name} → ${files.at(-1).name}`;
      enable();refreshFrames();setPlaying(true);
    }catch(error){if(revision===importRevision)$('message').textContent=error.message;}
    finally{$('import').value='';}
  };
  const initialNote=$('sourceNote').textContent;
  $('builtin').onclick=()=>{++importRevision;if(!original.naturalWidth)return;state.imported=false;state.frame=0;['action','autoBlink','blinkDuration','blinkOnce','waveOnce'].forEach(id=>$(id).disabled=false);$('sourceNote').textContent=initialNote;$('message').textContent='已切回内置待机';selectAction();setPlaying(true);};
  function enable(){['play','prev','next','sheet','manifest'].forEach(id=>$(id).disabled=false);$('blinkOnce').disabled=state.imported;$('waveOnce').disabled=state.imported||!waveFrames.length;}
  waveImage.onload=()=>{
    for(let i=0;i<8;i++){
      const frame=makeCanvas();frame.getContext('2d').drawImage(waveImage,i*512,0,512,724,(320-512*320/724)/2,14,512*320/724,320);waveFrames.push(frame);
    }
    if(!state.imported){$('waveOnce').disabled=false;if(state.action==='wave'){generate();enable();}}
  };
  waveImage.onerror=()=>{$('message').textContent='打招呼素材加载失败，请确认 assets/pipi-wave-strip.png 存在。';};
  waveImage.src='assets/pipi-wave-strip.png';
  original.onload=()=>{
    for(let i=0;i<24;i++){
      const frame=makeCanvas();
      frame.getContext('2d').drawImage(original,i*362,0,362,724,80,14,160,320);
      sourceFrames.push(frame);
    }
    if(state.imported)return;
    generate();enable();setPlaying(!matchMedia('(prefers-reduced-motion: reduce)').matches);
  };
  original.onerror=()=>{$('status').textContent='素材加载失败';$('message').textContent='请确认 assets/pipi-blink-24.png 与调试台一起保存在原目录。';};
  labels();original.src='assets/pipi-blink-24.png';requestAnimationFrame(tick);
  // Other actions can be added as frame arrays behind this same player.
})();
