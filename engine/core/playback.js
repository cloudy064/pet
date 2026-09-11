'use strict';
const { deferred } = require('./utils');
class Playback {
  constructor(engine,id,options) {
    this.engine=engine;this.action=id;this.options=options;this.status='queued';this.elapsed=0;this.duration=0;
    this._ready=deferred();this._finished=deferred();this.ready=this._ready.promise;this.finished=this._finished.promise;
  }
  then(resolve,reject) {return this.finished.then(resolve,reject);}
  cancel() {this.engine.cancel(this);return this;}
  release() {this.engine.release(this);return this;}
  settle(status,extra={}) {
    if(this.result)return;
    this.status=status;this.result={action:this.action,status,...extra};this._ready.resolve(this.result);this._finished.resolve(this.result);
  }
}
module.exports={Playback};
