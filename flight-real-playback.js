(async()=>{
  const $=id=>document.getElementById(id),results={};
  for(const key of Object.keys(PipiFlightDebug.configuration().assets)){
    $('flightClip').value=key;$('flightClip').dispatchEvent(new Event('change'));$('inspectClip').click();
    $('inspectLoop').checked=false;
    for(let i=0;PipiFlightDebug.snapshot().loading&&i<500;i++)await new Promise(r=>setTimeout(r,10));
    // Arm observation from a known paused first frame. Decoder completion
    // can happen between RAF callbacks while an inspector is already playing.
    $('flightTimeline').value=0;$('flightTimeline').dispatchEvent(new Event('input'));
    $('pauseFlight').click();
    results[key]=await new Promise(resolve=>{
      let start=null,last=null,previous=null,maxRafGapMs=0;const frames=new Set([0]),skips=[];
      function sample(now){
        const s=PipiFlightDebug.snapshot();if(start===null)start=now;frames.add(s.frame);
        if(previous!==null)maxRafGapMs=Math.max(maxRafGapMs,now-previous);previous=now;
        if(last!==null&&s.frame>last+1)skips.push({from:last,to:s.frame});last=s.frame;
        if(now-start<s.meta.durationMs+100)requestAnimationFrame(sample);
        else resolve({distinctFrames:frames.size,totalFrames:s.meta.frameCount,finished:s.paused,skippedTransitions:skips,maxRafGapMs});
      }
      requestAnimationFrame(sample);
    });
  }
  $('resetFlight').click();
  return {result:Object.values(results).every(v=>v.distinctFrames===v.totalFrames&&v.finished&&!v.skippedTransitions.length)?'PASS':'FAIL',clips:results,render:PipiFlightDebug.performance()};
})()
