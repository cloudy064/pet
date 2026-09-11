(() => {
  'use strict';
  const $=id=>document.getElementById(id),canvas=$('pointCanvas'),ctx=canvas.getContext('2d');
  let meta=PIPI_POINTS.left,side='left',assets,talk,mouthTime=0,mouthFrame=0;
  const mouthTimeline=PipiTiming.timeline(PIPI_POINTS.talk);
  let asset,frame=0,time=0,previous=null,mode='paused',resumeMode='cycle',timeline=PipiTiming.timeline(meta);
  const peak=meta.pointing.holdFrame;
  function render(){
    if(!asset)return;
    ctx.clearRect(0,0,900,640);
    if($('pointCard').checked){
      ctx.fillStyle='#fffdf5';ctx.strokeStyle='#a8c6a2';ctx.lineWidth=2;
      const x=side==='left'?290:506,y=side==='left'?310:328;
      ctx.beginPath();ctx.roundRect(x,y,100,118,16);ctx.fill();ctx.stroke();
      ctx.textAlign='center';ctx.fillStyle='#6d876b';ctx.font='18px "Microsoft YaHei"';ctx.fillText('shān',x+50,y+30);
      ctx.fillStyle='#254e39';ctx.font='bold 54px "KaiTi","Microsoft YaHei"';ctx.fillText('山',x+50,y+90);
    }
    const z=.9,footX=side==='left'?575:325,footY=540,rest=meta.restPose.frames.includes(frame)?meta.restPose:null;
    ctx.imageSmoothingQuality='high';
    if(rest)PipiSprites.draw(ctx,asset,frame,footX-(meta.anchor.x-rest.x)*z,footY-(meta.anchor.y-rest.y)*z,rest.width*z,rest.height*z,rest);
    else PipiSprites.draw(ctx,asset,frame,footX-meta.anchor.x*z,footY-meta.anchor.y*z,meta.frameWidth*z,meta.frameHeight*z);
    if($('pointSpeaking').checked&&talk){
      const m=PIPI_POINTS.talk,[x,y,w,h]=m.mouthRegion;
      PipiSprites.draw(ctx,talk,mouthFrame,footX+(x-m.anchor.x)*z,footY+(y-m.anchor.y)*z,w*z,h*z,{x,y,w,h});
    }
    $('pointSeek').value=frame;$('pointCounter').value=`${frame+1} / ${meta.frameCount}`;
    $('pointPhase').textContent=frame<peak?'展开单翅':frame===peak?'保持指向':'收回原位';
    $('pointPause').textContent=mode==='paused'?'继续':'暂停';
  }
  function seek(n){frame=Math.max(0,Math.min(meta.frameCount-1,n));time=timeline.starts[frame];previous=null;render();}
  $('pointPlay').onclick=()=>{mode='cycle';seek(0);};
  $('pointOpen').onclick=()=>{mode='hold';if(frame>peak)seek(36-frame);else seek(frame);};
  $('pointClose').onclick=()=>{mode='close';seek(frame<=peak?36-frame:frame);};
  $('pointPause').onclick=()=>{if(mode==='paused')mode=resumeMode;else{resumeMode=mode;mode='paused';}previous=null;render();};
  $('pointSeek').oninput=e=>{mode='paused';resumeMode='cycle';seek(Number(e.target.value));};
  $('pointHold').oninput=()=>{
    const durations=[...meta.frameDurationsMs];durations[peak]=Number($('pointHold').value)*1000;
    timeline=PipiTiming.timeline({...meta,frameDurationsMs:durations});$('pointHoldValue').value=(durations[peak]/1000).toFixed(2)+' s';seek(frame);
  };
  $('pointSide').onchange=()=>{
    side=$('pointSide').value;meta=PIPI_POINTS[side];asset=assets?.[side];mode='paused';resumeMode='cycle';mouthTime=mouthFrame=0;
    $('pointPng').href='assets/'+meta.image;$('pointJson').href='assets/pipi-point-'+side+'.json';
    $('pointRuntime').href='assets/'+PipiSprites.record(meta).image;
    frame=0;$('pointHold').oninput();
  };
  $('pointSpeaking').onchange=()=>{mouthTime=mouthFrame=0;render();};
  $('pointSpeed').onchange=()=>previous=null;$('pointCard').onchange=render;
  $('pointBackground').onchange=()=>{$('pointStage').className='card point-stage '+$('pointBackground').value;};
  document.addEventListener('visibilitychange',()=>previous=null);
  function tick(now){
    if(asset&&mode!=='paused'&&!document.hidden&&previous!==null){
      const beforeMode=mode;
      const dt=Math.min(30,now-previous)*Number($('pointSpeed').value);
      time+=dt;
      const beforeMouth=mouthFrame;
      if($('pointSpeaking').checked){mouthTime+=dt;mouthFrame=PipiTiming.frame(mouthTimeline,mouthTime%mouthTimeline.duration);}
      if(mode==='hold')time=Math.min(time,timeline.starts[peak]);
      else if(time>=timeline.duration){time=timeline.duration;mode='paused';}
      const next=PipiTiming.frame(timeline,time);if(next!==frame||mode!==beforeMode||beforeMouth!==mouthFrame){frame=next;render();}
    }
    previous=now;requestAnimationFrame(tick);
  }
  window.PipiPointDebug=Object.freeze({snapshot:()=>({ready:!!asset,side,mouthFrame,frame,sourceFrame:frame<=18?frame:36-frame,mode,time,duration:timeline.duration}),meta:()=>meta});
  Promise.all(['left','right','talk'].map(key=>PipiSprites.load(PIPI_POINTS[key]))).then(results=>{
    assets={left:results[0],right:results[1]};talk=results[2];asset=assets[side];for(const id of ['pointPlay','pointOpen','pointClose','pointPause','pointSide'])$(id).disabled=false;
    $('pointRuntime').href='assets/'+PipiSprites.record(meta).image;render();
  }).catch(e=>$('pointError').textContent=e.message);
  requestAnimationFrame(tick);
})();
