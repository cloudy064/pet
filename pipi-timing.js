/* One cumulative timeline for variable-duration frames in every player. */
((root) => {
  'use strict';
  const memo = new WeakMap();
  function timeline(meta, first=0, last=meta.frameCount-1, reverse=false) {
    let byRange=memo.get(meta);if(!byRange)memo.set(meta,byRange=new Map());
    const key=[first,last,reverse].join(':');if(byRange.has(key))return byRange.get(key);
    const frames=[],starts=[];let duration=0;
    for(let n=first;n<=last;n++){
      const frame=reverse?last-(n-first):n;frames.push(frame);starts.push(duration);
      duration+=meta.frameDurationsMs[frame];
    }
    const out={frames,starts,duration};byRange.set(key,out);return out;
  }
  function index(t, ms) {
    let lo=0,hi=t.frames.length-1;
    while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(t.starts[mid]<=ms+.2)lo=mid;else hi=mid-1;}
    return lo;
  }
  const api={timeline,index,frame:(t,ms)=>t.frames[index(t,ms)]};
  root.PipiTiming=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
