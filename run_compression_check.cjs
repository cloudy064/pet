const {spawn}=require('node:child_process'),fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const port=9346,child=spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',[
 '--headless','--disable-gpu','--no-first-run','--disable-extensions','--disable-sync','--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows','--disable-features=CalculateNativeWinOcclusion','--allow-file-access-from-files','--remote-debugging-port='+port,'--user-data-dir='+path.resolve('edge-compression-cdp'),'about:blank'],{windowsHide:true,stdio:'ignore'});let ws;
 try{
  let targets;for(let i=0;i<100;i++){try{targets=await(await fetch('http://127.0.0.1:'+port+'/json')).json();if(targets.length)break;}catch{}await delay(100);}if(!targets?.length)throw Error('Debug port unavailable');
  ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});let id=0;const pending=new Map(),errors=[],requests=[];
  ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);if(m.method==='Network.requestWillBeSent')requests.push(m.params.request.url);if(pending.has(m.id)){const {r,j}=pending.get(m.id);pending.delete(m.id);m.error?j(m.error):r(m.result);}};
  const send=(method,params={})=>new Promise((r,j)=>{const key=++id;pending.set(key,{r,j});ws.send(JSON.stringify({id:key,method,params}));});
  const evaluate=async(expression,awaitPromise=false)=>{const r=await send('Runtime.evaluate',{expression,awaitPromise,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
  const navigate=async name=>{await send('Page.navigate',{url:pathToFileURL(path.resolve(name)).href});};
  const until=async expr=>{for(let i=0;i<500;i++){if(await evaluate(expr))return;await delay(40);}throw Error('Timeout: '+expr);};
  await send('Runtime.enable');await send('Page.enable');await send('Network.enable');await send('Emulation.setFocusEmulationEnabled',{enabled:true});await send('Emulation.setDeviceMetricsOverride',{width:1320,height:1200,deviceScaleFactor:1,mobile:false});
  await navigate('皮皮_压缩前后对比.html');await until('window.PipiCompressionDebug?.snapshot().ready');
  const report=process.argv.includes('--ui-only')?JSON.parse(fs.readFileSync('compression-browser-check.json','utf8')):await evaluate(fs.readFileSync('compression-browser-tests.js','utf8'),true);
  fs.writeFileSync('compression-browser-check.json',JSON.stringify(report,null,2));console.log(JSON.stringify({result:report.result,checks:report.checks,nativeFramesCompared:report.nativeFramesCompared,error:report.error}));
  if(report.result!=='PASS')throw Error(report.error);
  for(const key of await evaluate('Object.keys(PipiCompressionDebug.assets())')){
    await evaluate(`document.getElementById('compareAction').value=${JSON.stringify(key)};document.getElementById('compareAction').dispatchEvent(new Event('change'));`);
    await until('PipiCompressionDebug.snapshot().ready');
    const result=await evaluate(`(()=>{const t=document.getElementById('compareTimeline');t.value=t.max;t.dispatchEvent(new Event('input'));return PipiCompressionDebug.snapshot();})()`);
    if(result.key!==key||result.playing||result.frame!==await evaluate('Number(document.getElementById("compareTimeline").max)'))throw Error('Comparison seek failed '+key);
  }
  await evaluate(`document.getElementById('compareAction').value='base:wave';document.getElementById('compareAction').dispatchEvent(new Event('change'));`);await until('PipiCompressionDebug.snapshot().ready');
  await evaluate(`const t=document.getElementById('compareTimeline');t.value=33;t.dispatchEvent(new Event('input'));`);
  let shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync('compression-preview.png',Buffer.from(shot.data,'base64'));
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  if(await evaluate('document.documentElement.scrollWidth>innerWidth+1'))throw Error('Comparison mobile overflow');
  shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync('compression-mobile-preview.png',Buffer.from(shot.data,'base64'));
  // Runtime mode must actually request runtime PNGs in every player.
  const players=[['皮皮_动画调试台.html','window.PipiDebug?.snapshot().count > 0'],['皮皮_走路调试台.html','window.PipiWalkDebug?.snapshot().ready'],['皮皮_飞行调试台.html','window.PipiFlightDebug?.snapshot().ready'],['皮皮_自由动作.html','window.PipiFreeDebug?.snapshot().ready']];
  const network=[];
  const masterNames=new Set(Object.keys(JSON.parse(fs.readFileSync('assets/runtime/manifest.json','utf8')).assets));
  for(const [name,ready] of players){requests.length=0;await navigate(name);await until(ready);const pngs=requests.filter(u=>/\.png(?:\?|$)/.test(u));
    const runtime=pngs.filter(u=>u.includes('/assets/runtime/')),masters=pngs.filter(u=>masterNames.has(decodeURIComponent(new URL(u).pathname.split('/').at(-1))));
    if(!runtime.length||masters.length)throw Error('Unexpected source sprite PNG request '+name+' '+JSON.stringify(masters));network.push({page:name,runtimePngRequests:runtime.length,referencePngRequests:pngs.length-runtime.length});}
  if(errors.length)throw Error('Browser errors '+JSON.stringify(errors));
  report.interfaceChecks={all31ActionsSeek:true,mobileOverflow:false,network};fs.writeFileSync('compression-browser-check.json',JSON.stringify(report,null,2));console.log('PASS comparison controls, mobile layout, and runtime network requests');
  await send('Browser.close');
 }catch(e){console.error(e);process.exitCode=1;}finally{ws?.close();child.kill();}
})();
