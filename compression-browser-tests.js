(async()=>{
  let checks=0,frames=0;const rows=[];
  const ok=(v,m)=>{if(!v)throw Error(m);checks++;};
  const canvas=()=>{const c=document.createElement('canvas');return [c,c.getContext('2d',{willReadFrequently:true})];};
  const [left,lg]=canvas(),[right,rg]=canvas();
  function diff(a,b){let count=0,max=0,total=0;for(let i=0;i<a.length;i++){const d=Math.abs(a[i]-b[i]);if(d)count++;max=Math.max(max,d);total+=d;}return {channels:count,max,mean:total/a.length};}
  function compare(a,b,frame,scale=1){
    const m=a.meta,w=Math.ceil(m.frameWidth*scale)+8,h=Math.ceil(m.frameHeight*scale)+8;
    left.width=right.width=w;left.height=right.height=h;
    for(const [g,asset] of [[lg,a],[rg,b]]){g.imageSmoothingQuality='high';PipiSprites.draw(g,asset,frame,4,4,m.frameWidth*scale,m.frameHeight*scale);}
    return diff(lg.getImageData(0,0,w,h).data,rg.getImageData(0,0,w,h).data);
  }
  try{
    document.getElementById('comparePlay').click();
    for(const [key,m] of Object.entries(PipiCompressionDebug.assets())){
      window.__compressionProgress={key,frames,checks};
      const a=await PipiSprites.load(m,{mode:'original'}),b=await PipiSprites.load(m,{mode:'runtime'});
      try{
        const r=PipiSprites.record(m);
        ok(b.mode==='runtime'&&b.units.length===r.uniqueFrameCount,key+' runtime decode count');
        ok(b.tiles.length===m.frameCount&&new Set(b.tiles).size===r.uniqueFrameCount,key+' aliases reuse bitmaps');
        ok(r.frameDurationsMs.every((v,i)=>v===m.frameDurationsMs[i]),key+' timing unchanged');
        let scaled={channels:0,max:0,mean:0};
        for(let f=0;f<m.frameCount;f++){
          const d=compare(a,b,f);ok(d.channels===0,key+' native frame '+f+' '+JSON.stringify(d));frames++;
          if([0,Math.floor(m.frameCount/2),m.frameCount-1].includes(f))for(const z of [.6,.75,1.3]){
            const sample=compare(a,b,f,z);if(sample.mean>scaled.mean)scaled=sample;
            ok(sample.mean<1,key+' fractional scale '+z+' has no material pixel drift '+JSON.stringify(sample));
          }
        }
        rows.push({key,frames:m.frameCount,stored:b.units.length,cacheBytes:b.bytes,fractionalScaleDifference:scaled});
      }finally{PipiSprites.dispose(a);PipiSprites.dispose(b);}
      const scaledA=await PipiSprites.load(m,{mode:'original',scale:.75}),scaledB=await PipiSprites.load(m,{mode:'runtime',scale:.75});
      try{
        let worst={channels:0,max:0,mean:0};
        for(const f of new Set([0,Math.floor(m.frameCount/2),m.frameCount-1])){
          const d=compare(scaledA,scaledB,f,.65);if(d.mean>worst.mean)worst=d;
          ok(d.mean<1,key+' 75% decode preserves displayed pose '+JSON.stringify(d));
        }
        rows.at(-1).previewDecodeDifference=worst;
      }finally{PipiSprites.dispose(scaledA);PipiSprites.dispose(scaledB);}
    }
    // Exercise the Canvas fallback using a real alpha PNG with duplicate poses.
    const native=window.createImageBitmap;let a,b;
    try{
      const m=PipiCompressionDebug.assets()['base:talk'];a=await PipiSprites.load(m,{mode:'runtime'});
      window.createImageBitmap=undefined;b=await PipiSprites.load(m,{mode:'runtime'});
      for(let f=0;f<m.frameCount;f++)ok(compare(a,b,f).channels===0,'Canvas fallback frame '+f);
      const surfaces=[...b.units,...b.restUnits];PipiSprites.dispose(b);b=null;
      ok(surfaces.every(c=>c.width===0&&c.height===0),'Fallback surfaces released');
    }finally{window.createImageBitmap=native;if(a)PipiSprites.dispose(a);if(b)PipiSprites.dispose(b);}
    return {result:'PASS',checks,nativeFramesCompared:frames,rows};
  }catch(e){return {result:'FAIL',checks,nativeFramesCompared:frames,rows,error:e.message};}
})()
