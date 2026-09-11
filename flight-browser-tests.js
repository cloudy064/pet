(async()=>{
  const $=id=>document.getElementById(id),snap=()=>PipiFlightDebug.snapshot();
  let checks=0;const passed=[];
  function ok(value,message){if(!value)throw Error(message+' | '+JSON.stringify({phase:snap().phase,frame:snap().frame,clip:snap().clip,x:snap().x,alt:snap().alt,facing:snap().facing}));checks++;}
  function click(id){$(id).click();}
  function key(name,type='keydown',target=document.body){target.dispatchEvent(new KeyboardEvent(type,{key:name,bubbles:true,cancelable:true}));}
  async function advance(ms,collect){
    await new Promise(r=>setTimeout(r,0));
    const count=Math.ceil(ms/(1000/60));
    for(let i=0;i<count;i++){__flightPump(ms/count);if(snap().loading){for(let w=0;snap().loading&&w<500;w++)await new Promise(r=>setTimeout(r,10));ok(!snap().loading,"Sprite decoding finishes");}if(collect)collect(snap());}
  }
  function select(id,value){$(id).value=value;$(id).dispatchEvent(new Event('change'));}
  function canvasPixels(){return $('flightCanvas').getContext('2d').getImageData(0,0,1000,720).data;}
  async function reset(){click('resetFlight');await advance(17);}
  try {
    ok(snap().ready,'All assets loaded from file URL');
    const config=PipiFlightDebug.configuration();
    ok(Object.keys(config.assets).length===15,'Fifteen independent PNG strips registered');
    ok(Object.keys(config.directions).length===8,'All eight directions mapped');
    for(const [id,m] of Object.entries(config.assets)){
      select('flightClip',id);click('inspectClip');await advance(17);
      ok(snap().mode==='inspect'&&snap().clip===id,'Inspector loads '+id);
      ok($('flightFilmstrip').children.length===m.frameCount,'All thumbnails '+id);
      ok($('flightPng').getAttribute('href')==='assets/'+m.image,'PNG download '+id);
      ok($('flightJson').getAttribute('href')==='assets/pipi-flight-'+id+'.json','JSON download '+id);
      for(let frame=0;frame<m.frameCount;frame++){
        $('flightTimeline').value=frame;$('flightTimeline').dispatchEvent(new Event('input'));
        ok(snap().frame===frame&&snap().paused,'Seek '+id+' '+frame);
      }
      $('flightTimeline').value=0;$('flightTimeline').dispatchEvent(new Event('input'));
      const pixels=canvasPixels();
      ok(pixels[3]===0&&pixels[(719*1000+999)*4+3]===0,'Canvas remains transparent '+id);
      ok(pixels.some((v,i)=>i%4===3&&v>128),'Visible sprite '+id);
      const frames=new Set([0]);click('pauseFlight');await advance(m.durationMs+100,v=>frames.add(v.frame));
      ok(frames.size===m.frameCount,'Every native frame displayed '+id);
    }
    passed.push('All fifteen strips: full frame traversal, native playback, transparent canvas and matching export links');
    await reset();const initial=canvasPixels();click('takeoff');const takeoffFrames=new Set([0]);
    await advance(1200,v=>{if(v.clip==='takeoff')takeoffFrames.add(v.frame);});
    ok(snap().phase==='air','Takeoff enters continuous flight');
    ok(takeoffFrames.size===29,'Takeoff displays all 29 frames');
    ok(snap().alt===130,'Takeoff reaches default hover altitude');
    const fixedX=snap().x;key('ArrowUp');await advance(1700);
    ok(snap().alt>250&&snap().x===fixedX,'Up moves vertically');
    ok(snap().alt<=snap().limits.maxAlt,'Top boundary keeps crest inside stage');
    key('ArrowUp','keyup');await advance(1200);const hover=snap();await advance(500);
    ok(Math.abs(snap().alt-hover.alt)<.1,'Release decelerates to stationary hover');
    ok(snap().wing!==hover.wing,'Hover keeps flapping');
    key('ArrowRight');await advance(1700);key('ArrowRight','keyup');
    ok(snap().x>fixedX+100&&snap().facing==='right','Right movement uses right-facing sprites');
    ok(snap().x<=snap().limits.maxX,'Right boundary accounts for full wing span');
    const reversePhases=new Set();key('ArrowLeft');await advance(2300,v=>reversePhases.add(v.clip));key('ArrowLeft','keyup');
    ok(snap().facing==='left','Reversal reaches left-facing flight');
    ok(reversePhases.has('turn-right')&&reversePhases.has('turn-left'),'Reversal passes through both turn strips');
    key('ArrowDown');await advance(2400);key('ArrowDown','keyup');
    ok(snap().alt===60&&snap().phase!=='ground','Down stops at low hover until land requested');
    ok(snap().facing==='front','Vertical flight turns toward camera');
    key('ArrowLeft');key('ArrowRight');await advance(1200);key('ArrowLeft','keyup');key('ArrowRight','keyup');
    const cancelled=snap().x;await advance(250);
    ok(Math.abs(snap().x-cancelled)<1,'Opposite keys cancel motion');
    key('ArrowRight');await advance(600);click('pauseFlight');const paused=snap();await advance(1200);
    ok(snap().x===paused.x&&snap().frame===paused.frame&&snap().alt===paused.alt,'Pause freezes movement and wing animation');
    ok(snap().input.length===0,'Pause clears held inputs');
    click('pauseFlight');await advance(200);
    ok(Math.abs(snap().x-paused.x)<.01,'Resume does not retain stale direction input');
    key('ArrowLeft');await advance(200);window.dispatchEvent(new Event('blur'));const blurred=snap();await advance(500);
    ok(snap().input.length===0&&Math.abs(snap().x-blurred.x)<.01,'Blur releases controls without stuck flight');
    const beforeForm=snap().x;key('ArrowRight','keydown',$('moveSpeed'));await advance(300);
    ok(Math.abs(snap().x-beforeForm)<.01,'Arrow keys on sliders retain native form behavior');
    key('ArrowRight','keyup',$('moveSpeed'));
    click('land');await advance(5000);ok(snap().phase==='ground'&&snap().alt===0,'Landing completes after turning to front');
    ok(snap().clip==='takeoff'&&snap().frame===0,'Landing returns to exact neutral frame');
    passed.push('Four directions, reversal, full-wing bounds, release/hover, pause, blur, input focus and landing');

    await reset();click('takeoff');await advance(180);click('land');await advance(6000);
    ok(snap().phase==='ground','Landing requested during anticipation is honored');
    const final=canvasPixels();ok(initial.length===final.length&&initial.every((v,i)=>v===final[i]),'Rendered neutral after full flight is pixel-exact at original position');
    await reset();key('w');await advance(1200);key('w','keyup');ok(snap().phase==='air','WASD can initiate flight');
    await reset();key(' ');await advance(1200);key(' ');await advance(5000);ok(snap().phase==='ground','Space starts and lands');
    await reset();click('takeoff');await advance(1200);key('ArrowUp');key('ArrowRight');const diagStart=snap();await advance(500);key('ArrowUp','keyup');key('ArrowRight','keyup');
    ok(snap().x>diagStart.x&&snap().alt>diagStart.alt,'Diagonal input moves along both axes');
    passed.push('Queued landing, exact rest recovery, WASD, space and diagonal controls');

    for(const [direction,vertical,horizontal] of [['up-right','ArrowUp','ArrowRight'],['up-left','ArrowUp','ArrowLeft'],['down-right','ArrowDown','ArrowRight'],['down-left','ArrowDown','ArrowLeft']]){
      await reset();click('takeoff');await advance(1200);key(vertical);key(horizontal);const clips=new Set();await advance(4000,v=>clips.add(v.clip));
      ok(snap().facing===direction&&snap().clip===direction,'Independent diagonal sprite '+direction);
      ok(clips.has('bank-'+direction),'Baked bank transition '+direction);
      key(vertical,'keyup');key(horizontal,'keyup');click('land');await advance(5500);
      ok(snap().phase==='ground','Diagonal returns through side/front and lands '+direction);
    }
    passed.push('All four independent diagonal loops, bank transitions and return-to-front landings');

    await reset();select('flightClip','takeoff');click('inspectClip');$('inspectLoop').checked=false;await advance(1300);
    ok(snap().paused&&snap().frame===28,'One-shot inspection ends at final frame');
    click('pauseFlight');await advance(100);ok(snap().frame<8&&!snap().paused,'Finished one-shot restarts cleanly');
    await reset();click('demoFlight');const beforeDemo=snap().clock,demoPhases=new Set();await advance(26000,v=>demoPhases.add(v.clip));
    ok(snap().phase==='ground'&&!snap().demo,'Full demonstration lands and finishes '+JSON.stringify({demoTime:snap().demoTime,elapsed:snap().elapsed,loading:snap().loading,speed:$('flightSpeed').value,paused:snap().paused,landRequested:snap().landRequested,clockBefore:beforeDemo,clockAfter:snap().clock,hidden:snap().hidden}));
    ok(demoPhases.has('hover')&&demoPhases.has('right')&&demoPhases.has('left')&&demoPhases.has('land'),'Demo visits all directional flight phases');
    await reset();select('flightClip','right');click('inspectClip');$('flightTimeline').value=8;$('flightTimeline').dispatchEvent(new Event('input'));
    passed.push('Inspector one-shot restart and complete automatic eight-direction demo');
    return {result:'PASS',checks,passed,performance:PipiFlightDebug.performance()};
  } catch(error){return {result:'FAIL',checks,error:error.message,passed};}
})()
