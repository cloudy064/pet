(async()=>{
 const $=id=>document.getElementById(id),snap=()=>PipiFreeDebug.snapshot(),delay=ms=>new Promise(r=>setTimeout(r,ms)),results=[];
 // Observe every actual RAF throughout several consecutive, mixed actions.
 for(const [action,dir] of [['wave','auto'],['walk','ne'],['talk','auto'],['flight','sw'],['curious','auto'],['jump','auto']]){
  const start=snap();$('freeManualAction').value=action;$('freeManualAction').dispatchEvent(new Event('change'));$('freeManualDirection').value=dir;$('freeOnce').click();
  const result=await new Promise(resolve=>{
   let prior=null,started=null,maxStep=0,maxGap=0,lastRAF=null,frames=0;const skips=[],phases=new Set(),deadline=performance.now()+30000;
   function sample(now){
    const s=snap();
    if(s.action===action){
      if(started===null)started=now;if(lastRAF!==null)maxGap=Math.max(maxGap,now-lastRAF);lastRAF=now;
      phases.add(s.phase);frames++;
      if(prior){
       maxStep=Math.max(maxStep,Math.hypot(s.x-prior.x,s.y-prior.y,s.alt-prior.alt));
       if(s.key===prior.key&&s.segment===prior.segment&&Math.abs(s.frame-prior.frame)>1)skips.push({key:s.key,from:prior.frame,to:s.frame});
      }prior=s;
    }
    if(s.completed>start.completed){const stationary=!['walk','flight'].includes(action);resolve({action,dir,frames,skips,maxStep,maxRafGapMs:maxGap,phases:[...phases],positionRetained:stationary?s.x===start.x&&s.y===start.y:Math.hypot(s.x-start.x,s.y-start.y)>0,grounded:s.alt===0});}
    else if(s.error||now>deadline)resolve({action,error:s.error||'Timeout'});
    else requestAnimationFrame(sample);
   }
   requestAnimationFrame(sample);
  });
  results.push(result);await delay(150);
 }
 return {result:results.every(r=>!r.error&&r.skips.length===0&&r.positionRetained&&r.grounded)?'PASS':'FAIL',actions:results,render:PipiFreeDebug.performance()};
})()
