(async()=>{
  const $=id=>document.getElementById(id),results={};
  for(const d of Object.keys(PipiWalkDebug.configuration().assets)){
    $('walkDirection').value=d;$('walkDirection').dispatchEvent(new Event('change'));$('walkCycleOnly').checked=false;$('inspectWalk').click();
    for(let i=0;PipiWalkDebug.snapshot().loading&&i<500;i++)await new Promise(r=>setTimeout(r,10));
    await new Promise(r=>setTimeout(r,0));
    $('walkTimeline').value=0;$('walkTimeline').dispatchEvent(new Event('input'));$('pauseWalk').click();
    results[d]=await new Promise(resolve=>{let start=null,last=null;const frames=new Set([0]),skips=[];
      function sample(now){const s=PipiWalkDebug.snapshot();if(start===null)start=now;frames.add(s.frame);if(last!==null&&s.frame>last+1)skips.push({from:last,to:s.frame});last=s.frame;
        if(now-start<s.meta.durationMs+100)requestAnimationFrame(sample);else resolve({distinctFrames:frames.size,totalFrames:s.meta.frameCount,skips});}
      requestAnimationFrame(sample);
    });
  }
  return {result:Object.values(results).every(v=>v.distinctFrames===v.totalFrames&&!v.skips.length)?'PASS':'FAIL',directions:results,render:PipiWalkDebug.performance()};
})()
