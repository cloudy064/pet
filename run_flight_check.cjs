const {spawn}=require('node:child_process');
const fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const port=9342;
 const child=spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',[
 '--headless','--disable-gpu','--no-first-run','--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows','--disable-features=CalculateNativeWinOcclusion','--allow-file-access-from-files','--remote-debugging-port='+port,
 '--user-data-dir='+path.resolve('edge-flight-cdp'),'about:blank'],{windowsHide:true,stdio:'ignore'});
 let ws,shot;
 try{
   let targets;
   for(let i=0;i<100;i++){try{targets=await(await fetch('http://127.0.0.1:'+port+'/json')).json();if(targets.length)break;}catch{}await delay(100);}
   if(!targets?.length)throw Error('Debug port unavailable');
   ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);
   await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});
   let id=0;const pending=new Map(),errors=[];
   ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);if(pending.has(m.id)){const {r,j}=pending.get(m.id);pending.delete(m.id);m.error?j(m.error):r(m.result);}};
   const send=(method,params={})=>new Promise((r,j)=>{const key=++id;pending.set(key,{r,j});ws.send(JSON.stringify({id:key,method,params}));});
   const evaluate=async(expression,awaitPromise=false)=>{const r=await send('Runtime.evaluate',{expression,awaitPromise,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
   await send('Runtime.enable');
   await send('Page.enable');
   await send('Emulation.setFocusEmulationEnabled',{enabled:true});
   await send('Emulation.setDeviceMetricsOverride',{width:1400,height:1450,deviceScaleFactor:1,mobile:false});
   const hook=await send('Page.addScriptToEvaluateOnNewDocument',{source:'window.__flightNow=0;window.__flightRAFs=new Map();let flightRAFId=0;window.requestAnimationFrame=cb=>{const id=++flightRAFId;__flightRAFs.set(id,cb);return id;};window.cancelAnimationFrame=id=>__flightRAFs.delete(id);window.__flightPump=dt=>{__flightNow+=dt;const callbacks=[...__flightRAFs.values()];__flightRAFs.clear();callbacks.forEach(cb=>cb(__flightNow));};'});
   const url=pathToFileURL(path.resolve('皮皮_飞行调试台.html')).href;
   async function ready(){
     for(let i=0;i<200;i++){if(await evaluate('window.PipiFlightDebug?.snapshot().ready'))return;await delay(50);}
     throw Error('Flight assets failed to load: '+await evaluate("document.getElementById('flightStatus')?.textContent"));
   }
   await send('Page.navigate',{url});await ready();
   if(!process.argv.includes('--playback-only')&&!process.argv.includes('--controls-only')){
   const report=await evaluate(fs.readFileSync('flight-browser-tests.js','utf8'),true);
   report.runtimeErrors=errors;fs.writeFileSync('flight-check-result.json',JSON.stringify(report,null,2));
   console.log(JSON.stringify(report,null,2));
   shot=await send('Page.captureScreenshot',{format:'png'});
   fs.writeFileSync('flight-inspector-preview.png',Buffer.from(shot.data,'base64'));
   if(report.result!=='PASS')throw Error(report.error);
   }
   await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:hook.identifier});
   await send('Page.navigate',{url});await ready();
   await send('Page.bringToFront');
   if(!process.argv.includes('--controls-only')){
   const performance=await evaluate(fs.readFileSync('flight-real-playback.js','utf8'),true);
   fs.writeFileSync('flight-playback-performance.json',JSON.stringify(performance,null,2));console.log(JSON.stringify(performance,null,2));
   if(performance.result!=='PASS')throw Error('Actual playback skipped a native frame');
   }
   for(let i=0;i<300&&await evaluate('PipiFlightDebug.snapshot().loading');i++)await delay(10);
   const point=await evaluate("(()=>{const r=document.querySelector('[data-dir=right]').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()");
   await send('Input.dispatchMouseEvent',{type:'mousePressed',x:point.x,y:point.y,button:'left',clickCount:1});
   await delay(2200);
   // Cold sprite decoding is covered by loading state, separately from
   // the fixed-rate playback measurements above. Keep the real pointer
   // held until motion is observed, with a bounded wall-clock timeout.
   for(let i=0;i<80&&await evaluate('PipiFlightDebug.snapshot().x<=580');i++)await delay(100);
   const held=await evaluate('PipiFlightDebug.snapshot()');
   await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:5,y:5,button:'left',clickCount:1});
   const released=await evaluate('PipiFlightDebug.snapshot()');
   const pointerReport={startedFlight:held.phase!=='ground',movedRight:held.x>580,held:held.input.includes('right'),releasedOutside:released.input.length===0};
   fs.writeFileSync('flight-pointer-check.json',JSON.stringify(pointerReport,null,2));console.log('Pointer controls:',JSON.stringify(pointerReport));
   if(Object.values(pointerReport).some(v=>!v))throw Error('Pointer hold/capture/release failed');
   await evaluate("document.getElementById('flightClip').value='up-right';document.getElementById('inspectClip').click()");
   for(let i=0;i<300&&await evaluate('PipiFlightDebug.snapshot().loading');i++)await delay(10);
   await evaluate("document.getElementById('flightTimeline').value=8;document.getElementById('flightTimeline').dispatchEvent(new Event('input'))");
   shot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync('flight-diagonal-preview.png',Buffer.from(shot.data,'base64'));
   await evaluate("document.getElementById('demoFlight').click()");
   await delay(4000);
   await evaluate("document.getElementById('pauseFlight').click()");
   shot=await send('Page.captureScreenshot',{format:'png'});
   fs.writeFileSync('flight-preview.png',Buffer.from(shot.data,'base64'));
   await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
   const mobile=await evaluate('({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,canvasWidth:document.getElementById("flightCanvas").getBoundingClientRect().width})');
   console.log('Mobile layout:',JSON.stringify(mobile));if(mobile.scrollWidth>mobile.width+1)throw Error('Mobile horizontal overflow');
   shot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync('flight-mobile-preview.png',Buffer.from(shot.data,'base64'));
   await send('Browser.close');
 }catch(error){console.error(error);process.exitCode=1;}finally{if(ws)ws.close();child.kill();}
})();
