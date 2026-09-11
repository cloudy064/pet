const {spawn}=require('node:child_process'),fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const port=9345,child=spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',[
 '--headless','--disable-gpu','--no-first-run','--disable-extensions','--disable-sync','--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows','--disable-features=CalculateNativeWinOcclusion','--allow-file-access-from-files','--remote-debugging-port='+port,'--user-data-dir='+path.resolve('edge-free-cdp'),'about:blank'],{windowsHide:true,stdio:'ignore'});let ws;
 try{
  let targets;for(let i=0;i<100;i++){try{targets=await(await fetch('http://127.0.0.1:'+port+'/json')).json();if(targets.length)break;}catch{}await delay(100);}if(!targets?.length)throw Error('Debug port unavailable');
  ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});let id=0;const pending=new Map(),errors=[];
  ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);if(pending.has(m.id)){const {r,j}=pending.get(m.id);pending.delete(m.id);m.error?j(m.error):r(m.result);}};
  const send=(method,params={})=>new Promise((r,j)=>{const key=++id;pending.set(key,{r,j});ws.send(JSON.stringify({id:key,method,params}));});
  const evaluate=async(expression,awaitPromise=false)=>{const r=await send('Runtime.evaluate',{expression,awaitPromise,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
  await send('Runtime.enable');await send('Page.enable');await send('Emulation.setFocusEmulationEnabled',{enabled:true});await send('Emulation.setDeviceMetricsOverride',{width:1400,height:1100,deviceScaleFactor:1,mobile:false});
  const hook=await send('Page.addScriptToEvaluateOnNewDocument',{source:'window.__freeNow=0;window.__freeRAFs=new Map();let freeRAFId=0;requestAnimationFrame=cb=>{const i=++freeRAFId;__freeRAFs.set(i,cb);return i;};cancelAnimationFrame=i=>__freeRAFs.delete(i);window.__freePump=dt=>{__freeNow+=dt;const c=[...__freeRAFs.values()];__freeRAFs.clear();c.forEach(cb=>cb(__freeNow));};'});
  const url=pathToFileURL(path.resolve('皮皮_自由动作.html')).href;
  async function ready(){for(let i=0;i<500;i++){if(await evaluate('window.PipiFreeDebug?.snapshot().ready'))return;await delay(40);}throw Error('Free mode not ready');}
  await send('Page.navigate',{url});await ready();
  if(process.argv.includes('--resilience-only')){
    const report=await evaluate(fs.readFileSync('free-resilience-tests.js','utf8'),true);fs.writeFileSync('free-resilience-check.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(report.result!=='PASS')throw Error(report.error);await send('Browser.close');return;
  }
  if(!process.argv.includes('--native-only')){
    const report=await evaluate(fs.readFileSync('free-browser-tests.js','utf8'),true);report.runtimeErrors=errors;fs.writeFileSync('free-browser-check.json',JSON.stringify(report,null,2));console.log(JSON.stringify({result:report.result,checks:report.checks,passed:report.passed,error:report.error,performance:report.performance},null,2));
    if(report.result!=='PASS'||errors.length)throw Error(report.error||'Browser runtime errors');
  }
  // Capture after restoring native RAF. Some Edge versions wait forever for
  // a compositor frame while the deterministic test clock is intercepted.
  let shot;
  await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:hook.identifier});await send('Page.navigate',{url});await ready();await send('Page.bringToFront');
  const native=await evaluate(fs.readFileSync('free-real-playback.js','utf8'),true);fs.writeFileSync('free-playback-performance.json',JSON.stringify(native,null,2));console.log(JSON.stringify(native,null,2));if(native.result!=='PASS')throw Error('Free native playback failed');
  shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync('free-preview.png',Buffer.from(shot.data,'base64'));
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});const mobile=await evaluate('({width:innerWidth,scrollWidth:document.documentElement.scrollWidth})');if(mobile.scrollWidth>mobile.width+1)throw Error('Mobile overflow');
  shot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync('free-mobile-preview.png',Buffer.from(shot.data,'base64'));console.log('Mobile:',JSON.stringify(mobile));await send('Browser.close');
 }catch(e){console.error(e);process.exitCode=1;}finally{ws?.close();child.kill();}
})();
