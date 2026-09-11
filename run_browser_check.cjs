const {spawn}=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const port=9338;
 const child=spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',[
  '--headless','--disable-gpu','--no-first-run','--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows','--disable-features=CalculateNativeWinOcclusion','--allow-file-access-from-files',`--remote-debugging-port=${port}`,
  '--user-data-dir='+path.resolve('edge-player-cdp'),'about:blank'],{windowsHide:true,stdio:'ignore'});
 let ws;
 try{
  let targets;
  for(let i=0;i<100;i++){try{targets=await(await fetch(`http://127.0.0.1:${port}/json`)).json();if(targets.length)break;}catch{}await delay(100);}
  if(!targets?.length)throw Error('Debug port unavailable');
  ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);
  await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});
  let id=0;const pending=new Map();
  ws.onmessage=e=>{const m=JSON.parse(e.data);if(pending.has(m.id)){const {r,j}=pending.get(m.id);pending.delete(m.id);m.error?j(m.error):r(m.result);}};
  const send=(method,params={})=>new Promise((r,j)=>{const key=++id;pending.set(key,{r,j});ws.send(JSON.stringify({id:key,method,params}));});
  await send('Emulation.setFocusEmulationEnabled',{enabled:true});
  await send('Emulation.setDeviceMetricsOverride',{width:1400,height:1450,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url:pathToFileURL(path.resolve('player-check.html')).href});
  let result='';
  for(let i=0;i<300;i++){
   await delay(100);
   const value=await send('Runtime.evaluate',{expression:"document.getElementById('result')?.textContent",returnByValue:true});
   result=value.result.value||'';
   if(result.startsWith('PASS')||result.startsWith('FAIL'))break;
  }
  console.log(result);
  const shot=await send('Page.captureScreenshot',{format:'png'});
  fs.writeFileSync('wave-v2-preview.png',Buffer.from(shot.data,'base64'));
  fs.writeFileSync('player-check-result.txt',result);
  if(result.startsWith('PASS')){
   await send('Page.navigate',{url:pathToFileURL(path.resolve('皮皮_动画调试台.html')).href});
   for(let i=0;i<100;i++){
    const ready=await send('Runtime.evaluate',{expression:"window.PipiDebug?.snapshot().count > 0",returnByValue:true});
    if(ready.result.value)break;await delay(50);
   }
   const measurement=await send('Runtime.evaluate',{awaitPromise:true,returnByValue:true,expression:`new Promise(resolve=>{
    document.getElementById('waveOnce').click();
    const frames=new Set(),times=[],skips=[];let previous=null,start=null,lastFrame=null;
    function sample(now){if(start===null)start=now;if(previous!==null)times.push(now-previous);previous=now;
      const s=PipiDebug.snapshot();frames.add(s.frame);
      if(lastFrame!==null&&s.frame>lastFrame+1)skips.push({from:lastFrame,to:s.frame});lastFrame=s.frame;
      if(now-start<s.durationMs+400)requestAnimationFrame(sample);
      else{times.sort((a,b)=>a-b);resolve({distinctFrames:frames.size,totalFrames:s.count,finished:!s.playing,
       skippedTransitions:skips,rafP95Ms:times[Math.floor(times.length*.95)],rafMaxMs:times.at(-1),render:PipiDebug.performance()});}}
    requestAnimationFrame(sample);
   })`});
   const report=measurement.result.value;
   console.log('Real playback:',JSON.stringify(report));
   fs.writeFileSync('playback-performance.json',JSON.stringify(report,null,2));
   const winkPlayback=await send('Runtime.evaluate',{awaitPromise:true,returnByValue:true,expression:`new Promise(resolve=>{
    document.getElementById('winkOnce').click();const frames=new Set(),skips=[];let start=null,last=null;
    function sample(now){if(start===null)start=now;const s=PipiDebug.snapshot();frames.add(s.frame);
      if(last!==null&&s.frame>last+1)skips.push({from:last,to:s.frame});last=s.frame;
      if(now-start<s.durationMs+200)requestAnimationFrame(sample);
      else resolve({distinctFrames:frames.size,totalFrames:s.count,finished:!s.playing,skippedTransitions:skips});}
    requestAnimationFrame(sample);
   })`});
   console.log('Wink playback:',JSON.stringify(winkPlayback.result.value));
   fs.writeFileSync('wink-playback-performance.json',JSON.stringify(winkPlayback.result.value,null,2));
   await send('Runtime.evaluate',{expression:`document.getElementById('timeline').value=16;document.getElementById('timeline').dispatchEvent(new Event('input'));`});
   const winkShot=await send('Page.captureScreenshot',{format:'png'});
   fs.writeFileSync('wink-preview.png',Buffer.from(winkShot.data,'base64'));
   const talkPlayback=await send('Runtime.evaluate',{awaitPromise:true,returnByValue:true,expression:`new Promise(resolve=>{
    document.getElementById('talkOnce').click();const frames=new Set(),skips=[];let start=null,last=null;
    function sample(now){if(start===null)start=now;const s=PipiDebug.snapshot();frames.add(s.frame);
      if(last!==null&&s.frame>last+1)skips.push({from:last,to:s.frame});last=s.frame;
      if(now-start<s.durationMs+200)requestAnimationFrame(sample);
      else resolve({distinctFrames:frames.size,totalFrames:s.count,finished:!s.playing,skippedTransitions:skips});}
    requestAnimationFrame(sample);
   })`});
   console.log('Talk playback:',JSON.stringify(talkPlayback.result.value));
   fs.writeFileSync('talk-playback-performance.json',JSON.stringify(talkPlayback.result.value,null,2));
   await send('Runtime.evaluate',{expression:`document.getElementById('timeline').value=25;document.getElementById('timeline').dispatchEvent(new Event('input'));`});
   const talkShot=await send('Page.captureScreenshot',{format:'png'});
   fs.writeFileSync('talk-preview.png',Buffer.from(talkShot.data,'base64'));
   const petPlayback=await send('Runtime.evaluate',{awaitPromise:true,returnByValue:true,expression:`new Promise(resolve=>{
    document.getElementById('petOnce').click();const frames=new Set(),skips=[];let start=null,last=null;
    function sample(now){if(start===null)start=now;const s=PipiDebug.snapshot();frames.add(s.frame);
      if(last!==null&&s.frame>last+1)skips.push({from:last,to:s.frame});last=s.frame;
      if(now-start<s.durationMs+200)requestAnimationFrame(sample);
      else resolve({distinctFrames:frames.size,totalFrames:s.count,finished:!s.playing,skippedTransitions:skips});}
    requestAnimationFrame(sample);
   })`});
   console.log('Pet playback:',JSON.stringify(petPlayback.result.value));
   fs.writeFileSync('pet-playback-performance.json',JSON.stringify(petPlayback.result.value,null,2));
   await send('Runtime.evaluate',{expression:`document.getElementById('timeline').value=18;document.getElementById('timeline').dispatchEvent(new Event('input'));`});
   const petShot=await send('Page.captureScreenshot',{format:'png'});
   fs.writeFileSync('pet-preview.png',Buffer.from(petShot.data,'base64'));
   const jumpPlayback=await send('Runtime.evaluate',{awaitPromise:true,returnByValue:true,expression:`new Promise(resolve=>{
    document.getElementById('jumpOnce').click();const frames=new Set(),skips=[];let start=null,last=null;
    function sample(now){if(start===null)start=now;const s=PipiDebug.snapshot();frames.add(s.frame);
      if(last!==null&&s.frame>last+1)skips.push({from:last,to:s.frame});last=s.frame;
      if(now-start<s.durationMs+200)requestAnimationFrame(sample);
      else resolve({distinctFrames:frames.size,totalFrames:s.count,finished:!s.playing,skippedTransitions:skips});}
    requestAnimationFrame(sample);
   })`});
   console.log('Jump playback:',JSON.stringify(jumpPlayback.result.value));
   fs.writeFileSync('jump-playback-performance.json',JSON.stringify(jumpPlayback.result.value,null,2));
   await send('Runtime.evaluate',{expression:`document.getElementById('timeline').value=22;document.getElementById('timeline').dispatchEvent(new Event('input'));`});
   const jumpShot=await send('Page.captureScreenshot',{format:'png'});
   fs.writeFileSync('jump-preview.png',Buffer.from(jumpShot.data,'base64'));
   const curiousPlayback=await send('Runtime.evaluate',{awaitPromise:true,returnByValue:true,expression:`new Promise(resolve=>{
    document.getElementById('curiousOnce').click();const frames=new Set(),skips=[];let start=null,last=null;
    function sample(now){if(start===null)start=now;const s=PipiDebug.snapshot();frames.add(s.frame);
      if(last!==null&&s.frame>last+1)skips.push({from:last,to:s.frame});last=s.frame;
      if(now-start<s.durationMs+200)requestAnimationFrame(sample);
      else resolve({distinctFrames:frames.size,totalFrames:s.count,finished:!s.playing,skippedTransitions:skips});}
    requestAnimationFrame(sample);
   })`});
   console.log('Curious playback:',JSON.stringify(curiousPlayback.result.value));
   fs.writeFileSync('curious-playback-performance.json',JSON.stringify(curiousPlayback.result.value,null,2));
   await send('Runtime.evaluate',{expression:`document.getElementById('timeline').value=20;document.getElementById('timeline').dispatchEvent(new Event('input'));`});
   const curiousShot=await send('Page.captureScreenshot',{format:'png'});
   fs.writeFileSync('curious-preview.png',Buffer.from(curiousShot.data,'base64'));
   await send('Page.navigate',{url:pathToFileURL(path.resolve('皮皮_打招呼对比.html')).href});
   let compareReady=false;
   for(let i=0;i<100;i++){
    const state=await send('Runtime.evaluate',{expression:"document.getElementById('play')?.disabled === false",returnByValue:true});
    if(state.result.value){compareReady=true;break;}await delay(50);
   }
   if(!compareReady)throw Error('Comparison assets failed to load');
   const comparison=await send('Runtime.evaluate',{expression:`(()=>{
    const seek=document.getElementById('seek');seek.value=33;seek.dispatchEvent(new Event('input'));
    return {counter:document.getElementById('counter').textContent,
      visible:['before','after'].map(id=>{const g=document.getElementById(id).getContext('2d');return g.getImageData(288,350,1,1).data[3]===255;})};
   })()`,returnByValue:true});
   if(comparison.result.value.counter!=='34 / 61'||comparison.result.value.visible.some(v=>!v))throw Error('Comparison does not show both synchronized frames');
   const compareShot=await send('Page.captureScreenshot',{format:'png'});
   fs.writeFileSync('wave-comparison-preview.png',Buffer.from(compareShot.data,'base64'));
   console.log('Comparison page: both assets loaded, synchronized seek verified');
  }
  await send('Browser.close');
  if(!result.startsWith('PASS'))process.exitCode=1;
 }catch(error){console.error(error);process.exitCode=1;child.kill();}
 finally{ws?.close();}
})();
