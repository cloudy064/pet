'use strict';
const { getPetAssetCache } = require('./wechat-cache');
const call=(object,name,args)=>new Promise((resolve,reject)=>object[name]({...args,success:resolve,fail:reject}));

class WechatAdapter {
  constructor(canvas,wxApi) {
    if(!canvas||typeof canvas.createImage!=='function')throw new TypeError('WeChat Canvas 2D node is required');
    if(!wxApi)throw new TypeError('Pass the wx API explicitly');
    this.canvas=canvas;this.wx=wxApi;this.cache=getPetAssetCache(wxApi);this.embedded=new Map();
  }
  now() {return Date.now();}
  requestFrame(callback) {return this.canvas.requestAnimationFrame(callback);}
  cancelFrame(id) {this.canvas.cancelAnimationFrame(id);}
  resize(width,height,dpr) {
    const w=Math.max(1,Math.round(width*dpr)),h=Math.max(1,Math.round(height*dpr));
    if(this.canvas.width!==w)this.canvas.width=w;if(this.canvas.height!==h)this.canvas.height=h;
  }
  fetchManifest(baseURL) {return this.cache.manifest(baseURL);}
  decode(src) {
    return new Promise((resolve,reject)=>{
      const image=this.canvas.createImage();
      image.onload=()=>{image.onload=image.onerror=null;resolve(image);};
      image.onerror=()=>{image.onload=image.onerror=null;reject(new Error('WeChat image decode failed'));};
      image.src=src;
    });
  }
  async starter(page) {
    const id=page.md5;
    if(!id)throw new Error('Embedded images require an MD5');
    if(!this.embedded.has(id)) {
      const task=(async()=>{
        const fs=this.wx.getFileSystemManager(),root=this.wx.env.USER_DATA_PATH+'/pipi-engine-starter';
        const path=root+'/'+id+'.png';
        const info=await call(fs,'getFileInfo',{filePath:path,digestAlgorithm:'md5'}).catch(()=>null);
        if(!info||info.digest.toLowerCase()!==id||info.size!==page.bytes) {
          await call(fs,'mkdir',{dirPath:root,recursive:true}).catch(()=>{});
          await call(fs,'writeFile',{filePath:path,data:page.url.split(',')[1],encoding:'base64'});
          const written=await call(fs,'getFileInfo',{filePath:path,digestAlgorithm:'md5'});
          if(written.digest.toLowerCase()!==id||written.size!==page.bytes)throw new Error('Embedded atlas checksum mismatch');
        }
        return path;
      })();
      this.embedded.set(id,task);task.catch(()=>this.embedded.delete(id));
    }
    return this.decode(await this.embedded.get(id));
  }
  loadImage(page,baseURL) {
    if(page.url.startsWith('data:'))return this.starter(page);
    if(!/^https?:/.test(page.url))return this.decode(page.url);
    // The persistent PNG cache expects a directory and a basename.
    const plain=page.url.split('?')[0],slash=plain.lastIndexOf('/');
    return this.cache.loadImage(plain.slice(0,slash),{...page,file:plain.slice(slash+1)},src=>this.decode(src));
  }
  releaseImage(image) {if(image&&typeof image.close==='function')image.close();}
  createAudio(source,callbacks) {
    const audio=this.wx.createInnerAudioContext();audio.src=source;
    audio.onEnded(callbacks.ended);audio.onError(()=>callbacks.error(new Error('WeChat audio playback failed')));
    return {play:()=>audio.play(),pause:()=>audio.pause(),stop:()=>audio.stop(),dispose:()=>audio.destroy()};
  }
  bind() {return ()=>{};}
  clearCache() {return this.cache.clear();}
}
module.exports={WechatAdapter};
