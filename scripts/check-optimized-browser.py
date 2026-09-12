"""Compare every logical frame with the pre-optimizer renderer in real Chromium."""
import argparse
from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
import json
from pathlib import Path
import threading
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *args): pass


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--profile', choices=['balanced','exact','compact','frames','webp'], default='balanced')
    args=parser.parse_args()
    out=ROOT/'test-results/optimization'/args.profile
    out.mkdir(parents=True,exist_ok=True)
    server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)))
    threading.Thread(target=server.serve_forever,daemon=True).start()
    report={}
    try:
        with sync_playwright() as p:
            browser=p.chromium.launch(headless=True)
            page=browser.new_page(viewport={'width':1240,'height':1050})
            errors=[]
            page.on('pageerror',lambda error: errors.append(str(error)))
            page.goto(f'http://127.0.0.1:{server.server_port}/examples/optimization/comparison.html?profile={args.profile}')
            page.wait_for_function('window.pipiOptimization?.pets.every(p=>p.status==="playing")',timeout=30000)
            source=(ROOT/'tests/assets/reference-renderer.cjs').read_text()
            page.evaluate('''source=>{const module={exports:{}};new Function('module',source)(module);
              const p=pipiOptimization.original;p.stop();p.renderer.clear();
              p.renderer=new module.exports.CanvasRenderer(p.adapter);
              pipiOptimization.pets.forEach(p=>{p.stop();p.renderer.resize(512,512,1)});
            }''', source)
            report=page.evaluate('''async()=>{
              const {pets,report}=pipiOptimization;
              const ids=pets[1].assets.list(), rows=[];let checked=0,peakDecoded=0;
              function compare(){
                const [a,b]=pets.map(p=>p.adapter.canvas.getContext('2d').getImageData(0,0,512,512).data);
                let sum=0,count=0,maximum=0,severe=0;
                for(let i=0;i<a.length;i+=4){
                  if(a[i+3]<=8&&b[i+3]<=8)continue;
                  count++;let biggest=0;
                  for(let c=0;c<4;c++){
                    const x=c===3?a[i+c]:Math.round(a[i+c]*a[i+3]/255);
                    const y=c===3?b[i+c]:Math.round(b[i+c]*b[i+3]/255);
                    const d=Math.abs(x-y);sum+=d;biggest=Math.max(biggest,d);
                  }
                  maximum=Math.max(maximum,biggest);if(biggest>32)severe++;
                }
                return {mean:count?sum/(count*4):0,maximum,severe:count?severe/count:0};
              }
              for(const id of ids){
                const leases=await Promise.all(pets.map(p=>p.assets.acquire([id,'base:idle','base:talk'])));
                const n=pets[0].assets.get(id).frameMap.length;
                if(n!==pets[1].assets.get(id).frameMap.length)throw Error('Frame count differs: '+id);
                for(let frame=0;frame<n;frame++){
                  const state={x:256,y:380,size:112,layers:[{asset:id,frame}],mouth:null};
                  pets.forEach((p,i)=>p.renderer.draw(state,leases[i].assets));
                  const error=compare();rows.push({id,frame,...error});checked++;
                }
                peakDecoded=Math.max(peakDecoded,pets[1].assets.stats().bytes);
                leases.forEach(l=>l.release());
              }
              rows.sort((a,b)=>b.mean-a.mean);
              window.optimizationWorst=rows.slice(0,12);
              return {profile:report.profile,logicalFramesChecked:checked,worstFrames:rows.slice(0,12),
                maxMean:rows[0].mean,maxChannelDifference:Math.max(...rows.map(r=>r.maximum)),
                maxSevereFraction:Math.max(...rows.map(r=>r.severe)),peakDecodedBytes:peakDecoded};
            }''')
            assert report['logicalFramesChecked'] == page.evaluate('pipiOptimization.report.after.logicalFrames')
            # Original raster bounds are restored before filtering: exact also means
            # identical rendered pixels against the frozen pre-optimizer renderer.
            if args.profile=='exact':
                assert report['maxMean'] == 0, report
                assert report['maxChannelDifference'] == 0, report
            else:
                assert report['maxMean'] < (8 if args.profile=='compact' else 6), report
                assert report['maxSevereFraction'] < (.09 if args.profile=='compact' else .06), report
            report['plans']=page.evaluate('''async()=>{
              const {pets}=pipiOptimization,results=[];
              for(const action of pets[0].actions.list().filter(a=>a.id!=='idle')){
                pets.forEach(p=>{p.stop();p.position={x:256,y:380};p.scale=1});
                const options={direction:'e',distance:80};
                if(['staged','wave','point'].includes(action.type))options.sustain=true;
                const tasks=pets.map(p=>p.play(action.id,options));await Promise.all(tasks.map(p=>p.ready));
                if(tasks.some(p=>p.status!=='playing'))throw Error('Plan failed: '+action.id);
                if(options.sustain){tasks.forEach(p=>{p.elapsed=800;p.release()});}
                if(tasks[0].duration!==tasks[1].duration)throw Error('Duration changed: '+action.id);
                for(const ratio of [0,.25,.5,.75,1]){
                  const a=tasks[0].plan.sample(tasks[0].duration*ratio),b=tasks[1].plan.sample(tasks[1].duration*ratio);
                  for(const key of ['frame','phase','x','y','altitude','scale'])
                    if(JSON.stringify(a[key])!==JSON.stringify(b[key]))throw Error('Plan changed: '+action.id+' '+key);
                }
                results.push(action.id);pets.forEach(p=>p.stop());
              }
              return results;
            }''')
            worst=report['worstFrames'][0]
            page.evaluate('''async ({id,frame})=>{
              const {pets}=pipiOptimization;
              document.getElementById('size').value='216';
              document.getElementById('notice').textContent='逐帧检查：'+id+'，逻辑帧 '+frame+'，身体高度 216px';
              for(const p of pets){const lease=await p.assets.acquire([id,'base:idle','base:talk']);
                p.renderer.draw({x:256,y:380,size:216,layers:[{asset:id,frame}]},lease.assets);lease.release();}
            }''',worst)
            page.screenshot(path=str(out/'worst-frame.png'),full_page=True)
            page.locator('#background').click()
            page.screenshot(path=str(out/'worst-frame-dark.png'),full_page=True)
            assert not errors,errors
            report['errors']=errors
            browser.close()
    finally:
        server.shutdown()
        (out/'browser.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(report,ensure_ascii=False,indent=2))


if __name__=='__main__': main()
