/* Lossless runtime storage behind the unchanged logical animation metadata. */
(() => {
  'use strict';
  const defaultMode=new URLSearchParams(location.search).get('assets')==='original'?'original':'runtime';
  function record(meta){
    const r=window.PIPI_RUNTIME?.assets[meta.image];
    if(!r)return null;
    if(r.sourceVersion!==(meta.version||1)||r.sourceFrameWidth!==meta.frameWidth||r.sourceFrameHeight!==meta.frameHeight||r.frameCount!==meta.frameCount)
      throw Error('运行素材需要重新打包：'+meta.image);
    return r;
  }
  async function load(meta,{mode=defaultMode,scale=1}={}){
    const r=mode==='original'?null:record(meta);
    const crop=r?r.crop:{x:0,y:0,w:meta.frameWidth,h:meta.frameHeight};
    const rects=r?r.tiles:meta.frames,map=r?r.frameMap:meta.frames.map((_,i)=>i);
    const units=[],image=new Image();let decoded=null,asset=null;
    try{
      await new Promise((resolve,reject)=>{
        image.onload=resolve;image.onerror=()=>reject(Error('无法加载 '+(r?r.image:meta.image)));
        image.src='assets/'+(r?r.image:meta.image)+'?v='+encodeURIComponent(r?r.sha256.slice(0,12):meta.version||1);
      });
      if(image.naturalWidth!==(r?r.width:meta.frameWidth*meta.frameCount)||image.naturalHeight!==(r?r.height:meta.frameHeight))throw Error('帧尺寸不符：'+meta.image);
      const width=Math.round(crop.w*scale),height=Math.round(crop.h*scale);
      // Decode the strip once. Cropping a large HTMLImageElement repeatedly
      // can make the browser decode its PNG again for each requested tile.
      if(window.createImageBitmap){decoded=await createImageBitmap(image);image.removeAttribute('src');}
      for(const f of rects){
        if(window.createImageBitmap){
          const options=scale===1?{}:{resizeWidth:width,resizeHeight:height,resizeQuality:'high'};
          units.push(await createImageBitmap(decoded,f.x,f.y,f.w,f.h,options));
        }else{
          const tile=document.createElement('canvas');tile.width=width;tile.height=height;
          tile.getContext('2d').drawImage(image,f.x,f.y,f.w,f.h,0,0,width,height);units.push(tile);
        }
      }
      asset={meta,crop:{...crop},units,tiles:map.map(i=>units[i]),bytes:width*height*4*units.length,
        logicalFrames:meta.frameCount,storedFrames:units.length,mode:r?'runtime':'original',
        sourceBytes:r?.sourceBytes??null,runtimeBytes:r?.runtimeBytes??null};
      // Keep the shared resting rectangle intact for identical resampling at
      // action boundaries. This costs one small surface per resting pose, not
      // a full virtual canvas for every frame.
      asset.restTiles=new Map();asset.restUnits=[];
      if(meta.restPose){
        const rest=meta.restPose,byUnit=new Map();
        for(const frame of rest.frames){
          const unit=asset.tiles[frame];let tile=byUnit.get(unit);
          if(!tile){
            tile=document.createElement('canvas');tile.width=Math.round(rest.width*scale);tile.height=Math.round(rest.height*scale);
            draw(tile.getContext('2d'),asset,frame,0,0,tile.width,tile.height,rest);
            byUnit.set(unit,tile);asset.restUnits.push(tile);asset.bytes+=tile.width*tile.height*4;
          }
          asset.restTiles.set(frame,tile);
        }
      }
      return asset;
    }catch(e){dispose(asset||{units,restUnits:[]});throw e;}
    finally{decoded?.close();image.onload=image.onerror=null;image.removeAttribute('src');}
  }
  // Destination describes a rectangle in the original virtual frame. Intersect
  // it with the union crop and retain its original sampling origin and scale.
  function draw(ctx,asset,frame,dx,dy,dw,dh,source){
    const tile=asset.tiles[frame];if(!tile)return;
    const rest=asset.meta.restPose,restTile=asset.restTiles?.get(frame);
    if(source&&restTile&&source.x===rest.x&&source.y===rest.y&&(source.width??source.w)===rest.width&&(source.height??source.h)===rest.height){
      ctx.drawImage(restTile,0,0,restTile.width,restTile.height,dx,dy,dw,dh);return;
    }
    const c=asset.crop,m=asset.meta,s=source?{x:source.x,y:source.y,w:source.width??source.w,h:source.height??source.h}:{x:0,y:0,w:m.frameWidth,h:m.frameHeight};
    const x=Math.max(s.x,c.x),y=Math.max(s.y,c.y),r=Math.min(s.x+s.w,c.x+c.w),b=Math.min(s.y+s.h,c.y+c.h);
    if(r<=x||b<=y)return;
    const sx=tile.width/c.w,sy=tile.height/c.h,zx=dw/s.w,zy=dh/s.h;
    ctx.drawImage(tile,(x-c.x)*sx,(y-c.y)*sy,(r-x)*sx,(b-y)*sy,
      dx+(x-s.x)*zx,dy+(y-s.y)*zy,(r-x)*zx,(b-y)*zy);
  }
  function dispose(asset){
    for(const tile of [...asset.units,...asset.restUnits]){if(tile.close)tile.close();else{tile.width=0;tile.height=0;}}
  }
  window.PipiSprites=Object.freeze({load,draw,dispose,record,mode:defaultMode});
})();
