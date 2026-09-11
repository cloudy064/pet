'use strict';
const { EventEmitter } = require('./events');
const { copy, freeze, positive, finite, identifier, joinURL } = require('./utils');

function validateAsset(id, input) {
  identifier(id,'Asset id');
  const asset=copy(input);
  if (!asset || !Array.isArray(asset.pages) || !asset.pages.length) throw new TypeError(id+': pages are required');
  for (const page of asset.pages) {
    if (typeof page.file!=='string' || !page.file) throw new TypeError(id+': page file is required');
    positive(page.width,'Page width');positive(page.height,'Page height');
    if (page.md5!==undefined && !/^[a-f0-9]{32}$/i.test(page.md5)) throw new TypeError(id+': invalid MD5');
  }
  if (!asset.crop || !asset.anchor) throw new TypeError(id+': crop and anchor are required');
  positive(asset.crop.w,'Crop width');positive(asset.crop.h,'Crop height');
  for (const [name,value] of Object.entries({cropX:asset.crop.x,cropY:asset.crop.y,anchorX:asset.anchor.x,anchorY:asset.anchor.y})) finite(value,name);
  positive(asset.subjectHeight,'Subject height');
  if (!Array.isArray(asset.tiles)||!asset.tiles.length||!Array.isArray(asset.frameMap)||!asset.frameMap.length||asset.frameMap.length>4096) throw new TypeError(id+': tiles and frameMap are required');
  for (const tile of asset.tiles) {
    if (!Array.isArray(tile)||tile.length!==5||tile.some(n=>!Number.isInteger(n)||n<0)) throw new TypeError(id+': tile must be [page,x,y,width,height]');
    const page=asset.pages[tile[0]];
    if (!page||!tile[3]||!tile[4]||tile[1]+tile[3]>page.width||tile[2]+tile[4]>page.height) throw new RangeError(id+': tile outside image');
  }
  if (asset.frameMap.some(n=>!Number.isInteger(n)||!asset.tiles[n])) throw new RangeError(id+': invalid frame mapping');
  if (!Array.isArray(asset.durations)||asset.durations.length!==asset.frameMap.length||asset.durations.some(t=>!Number.isFinite(t)||t<=0)) throw new TypeError(id+': invalid frame durations');
  asset.restFrames=asset.restFrames||[];
  if (!Array.isArray(asset.restFrames)||asset.restFrames.some(n=>!Number.isInteger(n)||n<0||n>=asset.frameMap.length)) throw new RangeError(id+': invalid rest frame');
  return freeze(asset);
}

class AssetManager extends EventEmitter {
  constructor(adapter,{maxBytes=48*1024*1024}={}) {
    super();this.adapter=adapter;this.maxBytes=positive(maxBytes,'Asset memory budget');
    this.definitions=new Map();this.cache=new Map();this.revision=0;this.disposed=false;
  }
  define(id,asset,{baseURL=''}={}) {
    const definition=validateAsset(id,asset);
    this.definitions.set(id,{id,definition,baseURL,revision:++this.revision});
    this.emit('change',{id});return this;
  }
  import(manifest,{baseURL='',replace=false}={}) {
    if (!manifest||manifest.version!==1||!manifest.assets||typeof manifest.assets!=='object') throw new TypeError('Expected asset manifest version 1');
    const prepared=Object.entries(manifest.assets).map(([id,definition])=>[id,validateAsset(id,definition)]);
    const next=replace?new Map():new Map(this.definitions);
    for (const [id,definition] of prepared) next.set(id,{id,definition,baseURL,revision:++this.revision});
    this.definitions=next;this.emit('change',{type:'import'});return this;
  }
  has(id) { return this.definitions.has(id); }
  get(id) { const record=this.definitions.get(id);if(!record)throw new Error('Unknown asset: '+id);return record.definition; }
  list() { return [...this.definitions.keys()]; }
  export() { return {version:1,assets:Object.fromEntries([...this.definitions].map(([id,r])=>[id,{...copy(r.definition),pages:r.definition.pages.map(p=>({...p,file:joinURL(r.baseURL,p.file)}))}]))}; }
  async refresh(baseURL,{replace=false}={}) {
    const manifest=await this.adapter.fetchManifest(baseURL);
    if (this.disposed) throw new Error('Asset manager disposed');
    this.import(manifest,{baseURL,replace});return manifest;
  }
  async acquire(ids) {
    if (this.disposed) throw new Error('Asset manager disposed');
    const selected=[...new Set(ids)].map(id=>{
      const record=this.definitions.get(id);if(!record)throw new Error('Unknown asset: '+id);return record;
    });
    const held=[];let released=false;
    const release=()=>{if(released)return;released=true;for(const item of held)item.references--;this.trim();};
    try {
      for (const record of selected) {
        const key=record.id+'@'+record.revision;
        let item=this.cache.get(key);
        if (!item) {
          item={key,id:record.id,definition:record.definition,images:[],references:0,used:Date.now(),bytes:0,pending:true};
          this.cache.set(key,item);
          item.ready=this.load(item,record);
          item.ready.catch(()=>{});
        }
        item.references++;item.used=Date.now();held.push(item);
      }
      await Promise.all(held.map(item=>item.ready));
      if (this.disposed) throw new Error('Asset manager disposed');
      return {assets:new Map(held.map(item=>[item.id,item])),release};
    } catch (error) { release();throw error; }
  }
  async load(item,record) {
    try {
      for (const page of record.definition.pages) {
        const image=await this.adapter.loadImage({...page,url:joinURL(record.baseURL,page.file)},record.baseURL);
        if (this.disposed) { this.adapter.releaseImage(image);throw new Error('Asset manager disposed'); }
        const width=image.naturalWidth||image.width,height=image.naturalHeight||image.height;
        if (width!==page.width||height!==page.height) { this.adapter.releaseImage(image);throw new Error('Atlas dimensions differ: '+record.id); }
        item.images.push(image);item.bytes+=page.width*page.height*4;
      }
      item.pending=false;this.emit('loaded',{id:item.id,bytes:item.bytes});this.trim();return item;
    } catch (error) {
      item.pending=false;this.remove(item);this.emit('error',{id:item.id,error});throw error;
    }
  }
  remove(item) {
    this.cache.delete(item.key);
    for (const image of item.images) this.adapter.releaseImage(image);
    item.images=[];item.bytes=0;
  }
  trim({all=false}={}) {
    let bytes=this.stats().bytes;
    for (const item of [...this.cache.values()].sort((a,b)=>a.used-b.used)) {
      if (!all && bytes<=this.maxBytes) break;
      if (item.references||item.pending) continue;
      bytes-=item.bytes;this.remove(item);
    }
  }
  stats() {
    const items=[...this.cache.values()];
    return {definitions:this.definitions.size,decoded:items.filter(a=>!a.pending).length,pending:items.filter(a=>a.pending).length,bytes:items.reduce((n,a)=>n+a.bytes,0),budget:this.maxBytes};
  }
  dispose() { this.disposed=true;for(const item of [...this.cache.values()])this.remove(item);this.removeAllListeners(); }
}
module.exports={AssetManager,validateAsset};
