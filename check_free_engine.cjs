const fs=require('node:fs'),assert=require('node:assert/strict');
const Engine=require('./pipi-free-engine.js');
const read=name=>JSON.parse(fs.readFileSync('assets/'+name+'.json','utf8'));
const names={idle:'idle',blink:'blink-clean',wave:'wave-smooth',wink:'wink',talk:'talk',pet:'pet',jump:'jump',curious:'curious'};
const base=Object.fromEntries(Object.entries(names).map(([k,v])=>[k,read('pipi-'+v)]));
let seed=73911;const random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
const e=new Engine(base,read('pipi-walk'),read('pipi-flight'),random);let checks=0;
const ok=(v,m)=>{assert.ok(v,m);checks++;};
for(const m of Object.values(e.assets)){
  ok(Math.abs(m.durationMs-m.frameDurationsMs.reduce((a,b)=>a+b,0))<.001,'Metadata duration');
  ok(m.frames.every((f,i)=>f.durationMs===m.frameDurationsMs[i]),'Export agrees with playback');
}
let maxStep=0;
function play(p){
  const start={x:e.x,y:e.y};e.begin(p);let count=0;
  while(e.active){
    const before=e.snapshot();e.advance([1000/60,11,25,50][count++%4]);const s=e.snapshot();
    const m=e.assets[s.key],z=e.scale(m),b=m.bounds,a=m.anchor;
    ok(s.x+(b[0]-a.x)*z>=23.99&&s.x+(b[2]-a.x)*z<=1176.01,'Complete horizontal bounds');
    ok(s.y-s.alt+(b[1]-a.y)*z>=23.99&&s.y-s.alt+(b[3]-a.y)*z<=772.01,'Complete vertical bounds');
    if(!['walk','flight'].includes(p.action))ok(s.x===start.x&&s.y===start.y&&s.alt===0,'Stationary action retains world anchor');
    maxStep=Math.max(maxStep,Math.hypot(s.x-before.x,s.y-before.y));
    ok(count<5000,'Finite action completes');
  }
  ok(Math.hypot(e.x-p.end.x,e.y-p.end.y)<1e-6&&e.alt===0,'Lands at planned destination');
  ok(e.key==='base:idle'&&e.frame===0,'Exact shared neutral endpoint');
}
for(const action of Object.keys(Engine.labels)){
  for(const dir of ['walk','flight'].includes(action)?Object.keys(Engine.vectors):[null]){e.reset();const p=e.plan(action,dir);ok(p.direction===dir,'Requested heading at center');play(p);}
}
// Vary frame cadence and run for hundreds of moves, including corner recovery.
let previous=null;const coverage=new Set();
for(let i=0;i<400;i++){
  const action=e.choose([],previous);ok(action!==previous,'No immediate random repeat');
  const p=e.plan(action);coverage.add(action+(p.direction||''));play(p);previous=action;
}
for(const x of [e.limits.minX,e.limits.maxX])for(const y of [e.limits.minY,e.limits.maxY]){
  e.x=x;e.y=y;for(const action of ['walk','flight']){ok(e.available(action).length>0,'Can leave every corner');play(e.plan(action,'nw'));}
}
ok(e.choose(Object.keys(Engine.labels),null)===null,'No enabled actions is safe');
ok(e.choose(Object.keys(Engine.labels).filter(k=>k!=='wave'),'wave')==='wave','Single enabled action is usable');
ok(maxStep<12,'No position teleport in a 50 ms update');
const report={result:'PASS',checks,randomActions:400,maxMovementPer50ms:maxStep,coverage:[...coverage].sort(),limits:e.limits};
fs.writeFileSync('free-engine-check.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
