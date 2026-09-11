(async()=>{
  const $=id=>document.getElementById(id),snap=()=>PipiWalkDebug.snapshot(),delay=ms=>new Promise(r=>setTimeout(r,ms));
  let checks=0;const passed=[];
  function ok(v,m){if(!v){const {meta,...state}=snap();throw Error(m+' | '+JSON.stringify({...state,hidden:document.hidden}));}checks++;}
  async function decoded(){for(let i=0;snap().loading&&i<500;i++)await delay(10);ok(!snap().loading,'Sprite decode completes');await delay(0);}
  async function advance(ms,collect){await delay(0);const count=Math.ceil(ms/(1000/60));for(let i=0;i<count;i++){__walkPump(ms/count);if(snap().loading)await decoded();if(collect)collect(snap());}}
  function select(d){$('walkDirection').value=d;$('walkDirection').dispatchEvent(new Event('change'));}
  function key(k,type='keydown',target=document.body){target.dispatchEvent(new KeyboardEvent(type,{key:k,bubbles:true,cancelable:true}));}
  async function reset(){$('resetWalk').click();await advance(17);}
  const pixels=()=>$('walkCanvas').getContext('2d').getImageData(0,0,1000,780).data;
  try{
    const config=PipiWalkDebug.configuration();ok(Object.keys(config.assets).length===8,'Eight genuine directional strips');
    for(const [d,m] of Object.entries(config.assets)){
      select(d);$('walkCycleOnly').checked=false;$('inspectWalk').click();await decoded();await advance(17);
      ok(snap().mode==='inspect'&&snap().dir===d,'Select view '+d);
      ok($('walkFilmstrip').children.length===61,'All thumbnails '+d);
      ok($('walkPng').getAttribute('href')==='assets/'+m.image,'PNG link '+d);
      ok($('walkJson').getAttribute('href')==='assets/pipi-walk-'+d+'.json','JSON link '+d);
      for(let i=0;i<61;i++){$('walkTimeline').value=i;$('walkTimeline').dispatchEvent(new Event('input'));ok(snap().frame===i&&snap().paused,'Seek '+d+' '+i);}
      $('walkTimeline').value=0;$('walkTimeline').dispatchEvent(new Event('input'));
      const a=pixels();ok(a[3]===0&&a[(779*1000+999)*4+3]===0,'Transparent canvas '+d);ok(a.some((v,i)=>i%4===3&&v>128),'Visible default '+d);
      const seen=new Set([0]);$('pauseWalk').click();await advance(m.durationMs+100,s=>seen.add(s.frame));ok(seen.size===61,'Every native frame '+d);
      ok(snap().cached.length<=3,'Bounded decoded directions '+d);
    }
    passed.push('Eight directions: all 488 native frames, transparent canvas, exact export links and bounded cache');
    for(const [d,m] of Object.entries(config.assets)){
      await reset();select(d);$('walkInPlace').checked=false;$('startWalk').click();const p=snap();await advance(1650);
      ok(snap().dir===d&&snap().phase==='cycle','Continuous direction '+d);
      if(m.stride.x)ok(Math.sign(snap().x-p.x)===Math.sign(m.stride.x),'World X agrees '+d);else ok(snap().x===p.x,'No X drift '+d);
      if(m.stride.y)ok(Math.sign(snap().y-p.y)===Math.sign(m.stride.y),'World Y agrees '+d);else ok(snap().y===p.y,'No Y drift '+d);
      const prior=snap();$('pauseWalk').click();await advance(500);ok(snap().frame===prior.frame&&snap().x===prior.x&&snap().y===prior.y,'Pause '+d);$('pauseWalk').click();
      $('stopWalk').click();await advance(2200);ok(snap().phase==='idle'&&snap().frame===0,'Finish step and return neutral '+d);
    }
    passed.push('Movement vectors in all eight directions, native pause and phase-aware stop');
    await reset();$('walkInPlace').checked=true;const initial=pixels();select('n');$('oneWalk').click();const phases=new Set();await advance(2500,s=>phases.add(s.phase));
    ok(snap().phase==='idle'&&snap().cycles===1,'Single cycle starts, walks once and stops');ok(phases.has('intro')&&phases.has('cycle')&&phases.has('outro'),'All action phases');
    const final=pixels();ok(initial.every((v,i)=>v===final[i]),'Rendered start/end matches exact default');
    await reset();$('walkInPlace').checked=false;key('ArrowUp');key('ArrowRight');await advance(1700);ok(snap().dir==='ne'&&snap().requested==='ne','Combined arrows choose rear three-quarter view');
    key('ArrowUp','keyup');key('ArrowRight','keyup');await advance(2100);ok(snap().phase==='idle','Key release stops');
    key('a');await advance(800);window.dispatchEvent(new Event('blur'));await advance(2200);ok(snap().phase==='idle'&&!snap().requested,'Blur clears held walk');
    key('ArrowRight','keydown',$('walkSpeed'));await advance(500);ok(snap().phase==='idle','Form arrows do not initiate walking');key('ArrowRight','keyup',$('walkSpeed'));
    await reset();select('w');$('startWalk').click();await advance(1800);select('e');await advance(3200);ok(snap().dir==='e'&&snap().phase==='cycle','Reverse direction through neutral transition');
    await advance(20000);ok(snap().x<=snap().limits.maxX&&snap().y<=snap().limits.maxY,'Stage bounds preserve sprite margins');
    $('stopWalk').click();await advance(2200);$('inspectWalk').click();await decoded();$('walkCycleOnly').checked=true;$('walkCycleOnly').dispatchEvent(new Event('change'));await decoded();const loopFrames=new Set();await advance(2400,s=>loopFrames.add(s.frame));ok(loopFrames.size===32&&Math.min(...loopFrames)===14&&Math.max(...loopFrames)===45,'Continuous preview loops only gait');
    select('n');select('sw');select('ne');await decoded();await advance(17);ok(snap().dir==='ne'&&$('walkFilmstrip').children.length===61,'Rapid direction selection keeps newest request');
    passed.push('Exact neutral rendering, one-cycle mode, diagonal keys, blur, forms, direction reversal, bounds, gait-only loop and async selection');
    return {result:'PASS',checks,passed,performance:PipiWalkDebug.performance()};
  }catch(error){return {result:'FAIL',checks,error:error.message,passed};}
})()
