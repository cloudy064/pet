(async()=>{
 const $=id=>document.getElementById(id),snap=()=>PipiFreeDebug.snapshot(),delay=ms=>new Promise(r=>setTimeout(r,ms));let checks=0;
 const ok=(v,m)=>{if(!v)throw Error(m);checks++;};
 async function pump(ms){const n=Math.ceil(ms/(1000/60));for(let i=0;i<n;i++)__freePump(ms/n);await delay(0);}
 async function decoded(){for(let i=0;snap().preparing&&i<1500;i++)await delay(10);ok(!snap().preparing,'Loading resolves');}
 function once(action,dir='s'){$('freeManualAction').value=action;$('freeManualDirection').value=dir;$('freeOnce').click();}
 const NativeImage=window.Image;
 try{
  // A missing PNG must leave the bird grounded and allow a retry of that key.
  let rejectOne=true;
  window.Image=class extends NativeImage{set src(value){if(rejectOne&&value.includes('pipi-wave-smooth')){rejectOne=false;super.src='assets/missing-test-sprite.png';}else super.src=value;}get src(){return super.src;}};
  once('wave');await decoded();ok(!!snap().error&&snap().action==='idle'&&!snap().running,'Failed decode leaves a recoverable idle state');
  window.Image=NativeImage;once('wave');await decoded();await pump(60);ok(snap().action==='wave'&&!snap().error,'Retry of the failed key succeeds');await pump(2000);
  const blink=$('freeChoices').querySelector('[value=blink]');blink.checked=false;blink.dispatchEvent(new Event('change',{bubbles:true}));
  for(let i=0;i<240;i++){await pump(17);ok(snap().key==='base:idle','Unchecked blink also disables idle blinking');}
  once('walk','w');await decoded();await pump(900);const before=snap();
  Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));await pump(10000);
  ok(snap().frame===before.frame&&snap().x===before.x&&snap().y===before.y,'Hidden page freezes the complete animation clock');
  delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));__freePump(17);ok(snap().x===before.x,'Returning warms the clock without a large delta');await pump(100);ok(snap().x<before.x,'Visible playback resumes at original position');
  $('freeReset').click();once('flight','ne');$('freeStop').click();await delay(600);await pump(1200);ok(!snap().prepared&&!snap().preparing&&snap().action==='idle','Stop cancels pending flight before takeoff');
  return {result:'PASS',checks,passed:['Failed-load retry','Disabled idle blink','Hidden-page freeze and resume','Cancel pending flight']};
 }catch(e){return {result:'FAIL',checks,error:e.message};}finally{window.Image=NativeImage;delete document.hidden;}
})()
