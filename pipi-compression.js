(() => {
  'use strict';
  const $=id=>document.getElementById(id),left=$('compareOriginal'),right=$('compareRuntime');
  const contexts=[left.getContext('2d',{willReadFrequently:true}),right.getContext('2d',{willReadFrequently:true})];
  const assets={},labels={base:'表情',walk:'走路',flight:'飞行'},MiB=n=>(n/1048576).toFixed(2)+' MiB';
  for(const [group,items] of Object.entries({base:PIPI_ASSETS,walk:PIPI_WALK.assets,flight:PIPI_FLIGHT.assets}))
    for(const [id,m] of Object.entries(items)){assets[group+':'+id]=m;$('compareAction').add(new Option(labels[group]+' · '+m.label,group+':'+id));}
  const totals=PIPI_RUNTIME.totals;
  $('compareTotal').textContent=`运行 PNG：${MiB(totals.sourceBytes)} → ${MiB(totals.runtimeBytes)}，减少 ${totals.fileSavingPercent.toFixed(1)}%。完整播放时间轴 ${totals.frameCount} 帧，共存储 ${totals.uniqueFrameCount} 张不同图片；解码像素量减少 ${totals.pixelSavingPercent.toFixed(1)}%。`;
  let pair=null,meta=null,timeline=null,frame=0,time=0,playing=false,previous=null,epoch=0,ready=false;
  function render(){
    if(!ready)return;
    const z=Math.min(420/(meta.subjectHeight||548),490/(meta.anchor.y-meta.bounds[1]),280/Math.max(meta.anchor.x-meta.bounds[0],meta.bounds[2]-meta.anchor.x));
    for(let i=0;i<2;i++){
      const g=contexts[i];g.clearRect(0,0,640,640);g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';
      PipiSprites.draw(g,pair[i],frame,320-meta.anchor.x*z,550-meta.anchor.y*z,meta.frameWidth*z,meta.frameHeight*z);
    }
    $('compareFrame').value=(frame+1)+' / '+meta.frameCount;$('compareTimeline').value=frame;
    if($('compareDiff').checked){
      const a=contexts[0].getImageData(0,0,640,640),b=contexts[1].getImageData(0,0,640,640);let max=0,count=0;
      for(let i=0;i<a.data.length;i+=4){let d=0;for(let c=0;c<4;c++)d=Math.max(d,Math.abs(a.data[i+c]-b.data[i+c]));if(d)count++;max=Math.max(max,d);b.data[i]=Math.min(255,d*16);b.data[i+1]=0;b.data[i+2]=Math.min(255,d*16);b.data[i+3]=255;}
      contexts[1].putImageData(b,0,0);$('compareDifference').textContent=`当前浏览器缩放后的差异：${count} 个像素，最大通道差 ${max}/255。黑色表示一致，差异放大显示为紫色。原尺寸 PNG 还原已逐像素校验。`;
    }else $('compareDifference').textContent='播放观察动作衔接，也可以暂停逐帧比较翅膀边缘、眼睛和脚底位置。';
  }
  function controls(){['comparePlay','comparePrev','compareNext','compareTimeline'].forEach(id=>$(id).disabled=!ready);$('comparePlay').textContent=playing?'暂停':'播放';$('compareAction').disabled=!ready;}
  async function select(){
    const revision=++epoch;ready=false;playing=false;previous=null;controls();$('compareError').textContent='';
    if(pair){pair.forEach(PipiSprites.dispose);pair=null;}
    meta=assets[$('compareAction').value];const selected=meta,results=[];
    try{
      for(const mode of ['original','runtime'])results.push(await PipiSprites.load(selected,{mode}));
      if(revision!==epoch){results.forEach(PipiSprites.dispose);return;}
      pair=results;timeline=PipiTiming.timeline(meta);frame=0;time=0;ready=true;playing=true;
      const r=PipiSprites.record(meta);$('compareTimeline').max=meta.frameCount-1;
      $('compareOriginalInfo').textContent=`文件 ${MiB(r.sourceBytes)} · 解码像素 ${MiB(r.sourceDecodedBytes)} · ${meta.frameCount} 张图片`;
      $('compareRuntimeInfo').textContent=`文件 ${MiB(r.runtimeBytes)} · 解码像素 ${MiB(r.runtimeDecodedBytes)} · ${r.uniqueFrameCount} 张图片复用为 ${meta.frameCount} 个播放帧`;
      $('comparePng').href='assets/'+r.image;$('compareJson').href='assets/runtime/'+meta.image.replace('.png','.json');
      previous=null;render();controls();
    }catch(e){results.forEach(PipiSprites.dispose);if(revision===epoch){$('compareError').textContent=e.message;$('compareAction').disabled=false;}}
  }
  function seek(n){if(!ready)return;frame=(n+meta.frameCount)%meta.frameCount;time=timeline.starts[frame];playing=false;previous=null;controls();render();}
  $('compareAction').onchange=select;$('comparePlay').onclick=()=>{playing=!playing;previous=null;controls();};
  $('compareTimeline').oninput=e=>seek(Number(e.target.value));$('comparePrev').onclick=()=>seek(frame-1);$('compareNext').onclick=()=>seek(frame+1);
  $('compareBackground').onchange=()=>{left.className=right.className=$('compareBackground').value;};$('compareDiff').onchange=render;
  document.addEventListener('visibilitychange',()=>previous=null);
  function tick(now){if(ready&&playing&&!document.hidden&&previous!==null){time=(time+Math.min(33,now-previous))%(timeline.duration+500);const next=PipiTiming.frame(timeline,Math.min(time,timeline.duration));if(next!==frame){frame=next;render();}}previous=now;requestAnimationFrame(tick);}
  window.PipiCompressionDebug=Object.freeze({snapshot:()=>({ready,frame,playing,key:$('compareAction').value}),assets:()=>assets});
  $('compareAction').value='base:wave';select();requestAnimationFrame(tick);
})();
