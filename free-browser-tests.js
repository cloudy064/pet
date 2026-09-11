(async()=>{
  const $=id=>document.getElementById(id),snap=()=>PipiFreeDebug.snapshot(),delay=ms=>new Promise(r=>setTimeout(r,ms));
  let checks=0;const passed=[];
  const ok=(v,m)=>{if(!v)throw Error(m+' | '+JSON.stringify(snap()));checks++;};
  async function decoded(){for(let i=0;snap().preparing&&i<1600;i++)await delay(10);ok(!snap().preparing,'Bounded preloading');ok(!snap().error,'No load error');await delay(0);}
  async function pump(ms,collect){const n=Math.ceil(ms/(1000/60));for(let i=0;i<n;i++){__freePump(ms/n);if(collect)collect(snap());}await delay(0);}
  async function reset(){$('freeReset').click();await pump(34);}
  function manual(action,dir='auto'){$('freeManualAction').value=action;$('freeManualAction').dispatchEvent(new Event('change'));$('freeManualDirection').value=dir;$('freeOnce').click();}
  async function begin(action,dir){manual(action,dir);await decoded();await pump(50);ok(snap().action===action,'Manual action starts '+action);}
  async function finish(collect){const target=snap().completed+1;for(let i=0;i<1000&&snap().completed<target;i++)await pump(17,collect);ok(snap().completed===target,'Action completes');ok(snap().action==='idle'&&snap().alt===0,'Ends grounded');}
  const picture=()=>$('freeCanvas').toDataURL();
  try{
    await pump(34);ok($('freeChoices').querySelectorAll('input').length===9,'All nine available actions');
    for(const action of ['blink','wave','wink','talk','pet','jump','curious']){
      await reset();const before=snap(),pixels=picture();await begin(action);
      await finish(s=>ok(s.x===before.x&&s.y===before.y&&s.alt===0,'Stationary '+action));
      ok(picture()===pixels,'Exact neutral pixels '+action);
    }
    passed.push('Seven expressions retain position and return to the same rendered neutral');
    for(const action of ['walk','flight'])for(const dir of Object.keys(PipiFreeEngine.vectors)){
      await reset();const p=snap(),v=PipiFreeEngine.vectors[dir];await begin(action,dir);ok(snap().direction===dir,'Requested direction '+action+' '+dir);
      const phases=new Set();let prior=snap(),maxStep=0,maxAlt=0;
      await finish(s=>{
        phases.add(s.phase);maxAlt=Math.max(maxAlt,s.alt);maxStep=Math.max(maxStep,Math.hypot(s.x-prior.x,s.y-prior.y));prior=s;
        ok(s.x>=s.limits.minX-.001&&s.x<=s.limits.maxX+.001&&s.y>=s.limits.minY-.001&&s.y<=s.limits.maxY+.001,'World bounds');
        ok(!s.preparing,'No loading inside movement');
      });
      const end=snap();ok(Math.sign(end.x-p.x)===v[0]&&Math.sign(end.y-p.y)===v[1],'Real displacement '+action+' '+dir);
      ok(maxStep<5,'Continuous position '+action+' '+dir);
      if(action==='flight')ok(maxAlt===86&&phases.has('持续飞行')&&phases.has('落地回稳'),'Full flight lifecycle');
      else ok(maxAlt===0&&phases.has('交替迈步')&&phases.has('停步回稳'),'Grounded walking lifecycle');
      const neutral=picture();await begin('wave');await finish(s=>ok(s.x===end.x&&s.y===end.y,'Expression stays at new destination'));
      ok(picture()===neutral,'New destination neutral is retained');
      ok(snap().cacheBytes<=snap().cacheBudget,'Bounded sprite cache');
    }
    passed.push('All 16 walking/flying directions: real travel, complete phases, no mid-action decode, stable destination for next expression');
    await reset();await begin('flight','ne');await pump(1600);
    $('freePause').click();const frozen=snap();await pump(5000);ok(snap().frame===frozen.frame&&snap().x===frozen.x&&snap().alt===frozen.alt,'Pause freezes sprite and position');
    $('freePause').click();$('freeStop').click();await finish();ok(!snap().running,'Graceful stop lands before stopping');
    await begin('walk','w');await pump(900);manual('pet');ok(snap().queued?.action==='pet'&&snap().action==='walk','Manual request queues');
    const target=snap().completed+1;for(let i=0;i<600&&snap().completed<target;i++)await pump(17);await decoded();await pump(300);ok(snap().action==='pet','Queued action begins after stopping');await finish();
    await reset();manual('flight','sw');$('freeReset').click();await delay(800);await pump(1000);ok(snap().action==='idle'&&!snap().preparing&&!snap().prepared,'Reset cancels asynchronous old route');
    passed.push('Pause/resume, natural stop, queued manual action, and reset during loading');
    const choices=[...$('freeChoices').querySelectorAll('input')];choices.forEach(c=>c.checked=false);$('freeChoices').dispatchEvent(new Event('change'));$('freeStart').click();await pump(1000);ok(!snap().running,'Empty action selection stays idle');
    choices.find(c=>c.value==='curious').checked=true;$('freeChoices').dispatchEvent(new Event('change'));$('freeStart').click();await decoded();await pump(650);ok(snap().action==='curious','Only enabled action chosen');await finish();await decoded();
    const waiting=snap().waiting;ok(waiting>=2900&&waiting<=6000,'Random 3–6 second rest interval');$('freePause').click();await pump(5000);ok(snap().waiting===waiting,'Paused countdown stays fixed');$('freePause').click();$('freeStop').click();await pump(10000);ok(!snap().prepared&&snap().action==='idle','Stop cancels pending random action');
    choices.forEach(c=>c.checked=true);$('freeChoices').dispatchEvent(new Event('change'));$('freeInterval').value='1,3';$('freeStart').click();
    let previousAction=null,completions=snap().completed;const targetCompletions=completions+18;
    for(let rounds=0;snap().completed<targetCompletions&&rounds<12000;rounds++){
      if(snap().preparing)await decoded();await pump(50);
      if(snap().completed>completions){const action=snap().history[0].action;ok(action!==previousAction,'No consecutive random repetition');previousAction=action;completions=snap().completed;}
    }
    ok(snap().completed===targetCompletions,'18 consecutive random actions finish');
    $('freeStop').click();if(snap().action!=='idle')await finish();
    ok(snap().history.length<=12&&snap().cacheBytes<=snap().cacheBudget,'History and cache stay bounded over random session');
    passed.push('Selectable action pool, pauseable random interval, no immediate repeats and bounded long-session memory');
    await reset();await begin('walk','e');await pump(1300);$('freePause').click();
    return {result:'PASS',checks,passed,performance:PipiFreeDebug.performance(),end:snap()};
  }catch(e){return {result:'FAIL',checks,passed,error:e.message};}
})()
